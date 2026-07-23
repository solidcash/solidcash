import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';
import { bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import { decodePushdataValue, scriptToBytecode } from '@solidcash/utils';

const SOURCE = `pragma solidcash >=0.8.0;
contract HiddenBatchRelease4() {
  int counter;
  function add(int n) public { this.counter = this.counter + n; require(n >= 0); }
  function multiply(int n) public { this.counter = this.counter * n; require(n >= 0); }
  function note(bytes value) public { this.counter = value.length; require(value.length >= 0); }
  function clear() public { this.counter = 0; require(true); }
  function check(int expected) public { require(this.counter == expected); }
}`;

async function deploy() {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, {
    forceStateful: true,
    experimentalHiddenBatch: true,
  });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  return StatefulContract.withCategory(contract, categoryId);
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) { out.set(part, cursor); cursor += part.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);
const oneAddBlob = (selector: string, amount = 2n): Uint8Array => {
  const args = scriptToBytecode([bigIntToVmNumber(amount)]);
  return concat(
    hexToBin('53434231'), Uint8Array.from([1, 0, 1]), hexToBin(selector),
    le(0, 4), le(0, 2), le(args.length, 2), args,
  );
};

describe('Release 4 hidden owner-local batch SDK E2E', () => {
  it('executes three logical handlers in order and flushes one owner state', async () => {
    const contract = await deploy();
    await contract.batch([
      { function: 'add', args: [2n] },
      { function: 'add', args: [3n] },
      { function: 'multiply', args: [4n] },
    ]).send();
    await contract.check(20n).send();
  });

  it('preserves replacement order across distinct handlers', async () => {
    const contract = await deploy();
    await contract.batch([
      { function: 'add', args: [99n] },
      { function: 'clear' },
      { function: 'add', args: [7n] },
    ]).send();
    await contract.check(7n).send();
  });

  it('executes the frozen eight-row maximum through a minimal PUSHDATA1 blob', async () => {
    const contract = await deploy();
    await contract.batch(Array.from({ length: 8 }, () => ({ function: 'clear' }))).send();
    await contract.check(0n).send();
  });

  it('rejects malformed limits and unknown handlers before construction', async () => {
    const contract = await deploy();
    expect(() => contract.batch([])).toThrow(/row count/);
    expect(() => contract.batch([{ function: 'missing' }])).toThrow(/Unknown SCB1 handler/);
    expect(() => contract.batch(Array.from({ length: 9 }, () => ({ function: 'clear' }))))
      .toThrow(/row count/);
  });

  it('enforces the frozen blob-byte limit in both the SDK and covenant', async () => {
    const contract = await deploy();
    const oversizedArgument = new Uint8Array(211);
    expect(() => contract.batch([{ function: 'note', args: [oversizedArgument] }]))
      .toThrow(/maximum is 223/);

    const selector = contract.inner.artifact.hiddenBatch!.handlers
      .find((handler) => handler.name === 'note')!.selector;
    const encodedArgument = scriptToBytecode([oversizedArgument]);
    const oversizedRaw = concat(
      hexToBin('53434231'), Uint8Array.from([1, 0, 1]), hexToBin(selector),
      le(0, 4), le(0, 2), le(encodedArgument.length, 2), encodedArgument,
    );
    expect(oversizedRaw.length).toBeGreaterThan(223);
    await expect(contract._batchRaw(oversizedRaw).send()).rejects.toThrow();
  });

  it('rejects suffixes, count substitution, selector substitution, and noncanonical row identity in the VM', async () => {
    const cases: Array<(blob: Uint8Array) => Uint8Array> = [
      (blob) => concat(blob, Uint8Array.of(0)), // unchecked suffix
      (blob) => { const out = blob.slice(); out[6] = 2; return out; }, // count says two, contains one
      (blob) => { const out = blob.slice(); out.set(hexToBin('ffffffff'), 7); return out; },
      (blob) => { const out = blob.slice(); out[11] = 1; return out; }, // callsite must equal row index
      (blob) => { const out = blob.slice(); out[15] = 1; return out; }, // local occurrence must be zero
    ];
    for (const mutate of cases) {
      const contract = await deploy();
      const selector = contract.inner.artifact.hiddenBatch!.handlers
        .find((handler) => handler.name === 'add')!.selector;
      await expect(contract._batchRaw(mutate(oneAddBlob(selector))).send()).rejects.toThrow();
    }
  });
});

describe('Release 4 mapping-backed owner-local batch SDK E2E', () => {
  async function deployMappingBatch() {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract MappingBatchRelease4() {
        mapping(bigint => bigint) values;
        function add(bigint key, bigint amount) public {
          this.values[key] = this.values[key] + amount;
          require(amount >= 0);
        }
        function check(bigint key, bigint expected) public {
          require(this.values[key] == expected);
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    return StatefulContract.withCategory(inner, categoryId);
  }

  it('threads one authenticated mapping entry through two, three, and eight rows', async () => {
    const contract = await deployMappingBatch();
    for (const rowCount of [2, 3, 8]) {
      await contract.batch(Array.from({ length: rowCount }, () => ({
        function: 'add', args: [7n, 1n],
      }))).send();
    }
    await contract.check(7n, 13n).send();
  });

  it('rejects rows that would require two physical entries for one route witness', async () => {
    const contract = await deployMappingBatch();
    expect(() => contract.batch([
      { function: 'add', args: [7n, 1n] },
      { function: 'add', args: [8n, 1n] },
    ])).toThrow(/one physical entry/);
  });

  it('rejects a route witness that does not equal the canonical decoded row key', async () => {
    const contract = await deployMappingBatch();
    const handler = contract.inner.artifact.hiddenBatch!.handlers
      .find((candidate) => candidate.name === 'add')!;
    const rowArgs = scriptToBytecode([bigIntToVmNumber(7n), bigIntToVmNumber(2n)]);
    const blob = concat(
      hexToBin('53434231'), Uint8Array.from([1, 0, 1]), hexToBin(handler.selector),
      le(0, 4), le(0, 2), le(rowArgs.length, 2), rowArgs,
    );
    await expect(contract._batchRaw(blob, [8n]).send()).rejects.toThrow();
  });
});

describe('Release 4 ordered event batch SDK E2E', () => {
  it('emits one authenticated event per reached row and omits inactive suffix slots', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract EventBatchRelease4() {
        bigint current;
        event Changed(bigint next);
        function set(bigint next) public {
          this.current = next;
          emit Changed(next);
          require(next >= 0);
        }
        function check(bigint expected) public { require(this.current == expected); }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { current: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const transaction = await contract.batch([
      { function: 'set', args: [2n] },
      { function: 'set', args: [3n] },
      { function: 'set', args: [5n] },
    ]).send();
    await contract.check(5n).send();

    const events = getTxOutputs(transaction).filter((output) =>
      output.token?.category === categoryId && output.token.nft?.capability === 'none');
    expect(events.map((event) => event.token!.nft!.commitment))
      .toEqual(['52', '53', '55']);
  });
});

describe('Release 4 ordered result batch SDK E2E', () => {
  it('commits reached row results in order and zeroes inactive suffix slots', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract ResultBatchRelease4() {
        bigint total;
        function add(bigint amount) public returns (bigint) {
          this.total = this.total + amount;
          require(amount >= 0);
          return this.total;
        }
        function check(bigint expected) public { require(this.total == expected); }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const transaction = await contract.batch([
      { function: 'add', args: [2n] },
      { function: 'add', args: [3n] },
      { function: 'add', args: [5n] },
    ]).emitReturn().send();
    await contract.check(10n).send();

    const returnOutput = getTxOutputs(transaction).find((output) =>
      output.token?.category === categoryId && output.token.nft?.capability === 'none');
    expect(returnOutput).toBeDefined();
    const packed = decodePushdataValue(
      hexToBin(returnOutput!.token!.nft!.commitment), 0, 'bytes',
    ).value as Uint8Array;
    const values: bigint[] = [];
    let offset = 0;
    for (let index = 0; index < 8; index++) {
      const decoded = decodePushdataValue(
        packed, offset, 'bigint',
      );
      values.push(decoded.value as bigint);
      offset += decoded.bytesConsumed;
    }
    expect(values).toEqual([2n, 5n, 10n, 0n, 0n, 0n, 0n, 0n]);
  });
});

describe('Release 4 ordered value-effect batch SDK E2E', () => {
  it('executes reached transfers in order and leaves inactive slots empty', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract ValueBatchRelease4() {
        function pay(bytes recipient, bigint amount) public {
          this.transfer(recipient, amount);
          require(amount >= 0);
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await provider.addUtxo(contract.getSatoshiContainerAddress(), {
      txid: '74'.repeat(32), vout: 0, satoshis: 5000n,
    });
    const transaction = await contract.batch([
      { function: 'pay', args: [Uint8Array.of(0x51), 100n] },
      { function: 'pay', args: [Uint8Array.of(0x52), 200n] },
      { function: 'pay', args: [Uint8Array.of(0x53), 300n] },
    ]).send();
    const amounts = getTxOutputs(transaction).map((output) => output.amount);
    expect(amounts).toEqual(expect.arrayContaining([100n, 200n, 300n, 4400n]));
  });
});
