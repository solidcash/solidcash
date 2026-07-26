import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, layer3 } from '../../src/index.js';
import {
  createTestProvider, genesisFtContainer, getTxOutputs, setupStatefulUtxos,
} from '../test-util.js';
import {
  bigIntToVmNumber, binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
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

  it('preserves the owner-stable physical input index for every logical row', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract StableOwnerContextBatch() {
        bigint calls;
        function inspect(bigint expectedInput) public {
          require(this.activeInputIndex == expectedInput);
          this.calls = this.calls + 1;
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { calls: 0n },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.batch([
      { function: 'inspect', args: [0n] },
      { function: 'inspect', args: [0n] },
    ]).send();
    expect((await contract.getState()).calls).toBe(2n);
  });

  it('rolls back every prior row when a later row fails', async () => {
    const contract = await deploy();
    await expect(contract.batch([
      { function: 'add', args: [7n] },
      { function: 'add', args: [-1n] },
    ]).send()).rejects.toThrow();
    await contract.check(0n).send();
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
  it('commits exactly the reached row results in order', async () => {
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
    const invocations = [
      { function: 'add', args: [2n] },
      { function: 'add', args: [3n] },
      { function: 'add', args: [5n] },
    ];
    const plan = layer3.encodeHiddenBatch(artifact, invocations);
    const transaction = await contract.batch(invocations).emitReturn().send();
    await contract.check(10n).send();

    const returnOutput = getTxOutputs(transaction).find((output) =>
      output.token?.category === categoryId && output.token.nft?.capability === 'none');
    expect(returnOutput).toBeDefined();
    const packed = decodePushdataValue(
      hexToBin(returnOutput!.token!.nft!.commitment), 0, 'bytes',
    ).value as Uint8Array;
    const values: bigint[] = [];
    let offset = 0;
    for (let index = 0; index < 3; index++) {
      const decoded = decodePushdataValue(
        packed, offset, 'bigint',
      );
      values.push(decoded.value as bigint);
      offset += decoded.bytesConsumed;
    }
    expect(values).toEqual([2n, 5n, 10n]);
    expect(layer3.decodeHiddenBatchResults(
      artifact, plan, hexToBin(returnOutput!.token!.nft!.commitment),
    )).toEqual([
      { row: 0, type: 'bigint', value: 2n },
      { row: 1, type: 'bigint', value: 5n },
      { row: 2, type: 'bigint', value: 10n },
    ]);
  });

  it('executes and decodes heterogeneous scalar and tuple result rows', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      struct Pair { bigint n; bool ok; }
      contract HeterogeneousResultBatch() {
        function number(bigint n) public pure returns (bigint) { return n + 1; }
        function flag(bigint n) public pure returns (bool) { return n > 0; }
        function pair(bigint n) public pure returns (bigint, bool) { return (n * 2, n != 0); }
        function raw(bytes value) public pure returns (bytes) { return bytes.concat(value, hex"ff"); }
        function text(string value) public pure returns (string) { return string.concat(value, "!"); }
        function record(bigint n) public pure returns (Pair) { return Pair(n, n > 0); }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const invocations = [
      { function: 'number', args: [4n] },
      { function: 'flag', args: [0n] },
      { function: 'pair', args: [3n] },
      { function: 'raw', args: [hexToBin('aabb')] },
      { function: 'text', args: ['hello'] },
      { function: 'record', args: [9n] },
    ];
    const plan = layer3.encodeHiddenBatch(artifact, invocations);
    const transaction = await contract.batch(invocations).emitReturn().send();
    const returnOutput = getTxOutputs(transaction).find((output) =>
      output.token?.category === categoryId && output.token.nft?.capability === 'none');
    expect(returnOutput).toBeDefined();
    const commitment = hexToBin(returnOutput!.token!.nft!.commitment);
    expect(layer3.decodeHiddenBatchResults(artifact, plan, commitment)).toEqual([
      { row: 0, type: 'bigint', value: 5n },
      { row: 1, type: 'bool', value: false },
      { row: 2, type: '(bigint,bool)', value: [6n, true] },
      { row: 3, type: 'bytes', value: hexToBin('aabbff') },
      { row: 4, type: 'string', value: 'hello!' },
      { row: 5, type: 'Pair', value: { n: 9n, ok: true } },
    ]);
    expect(() => layer3.decodeHiddenBatchResults(
      artifact, plan, Uint8Array.from([...commitment, 0]),
    )).toThrow();
  });
});

describe('Release 4 ordered value-effect batch SDK E2E', () => {
  it('executes reached transfers in order and leaves inactive slots empty', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract ValueBatchRelease4() {
        function pay(bytes recipient, bigint amount) public {
          this.transfer(recipient, amount);
          // Each logical call sees its own effect, while the physical
          // container observes the aggregate -600 satoshi transition.
          require(msg.value == -amount && amount >= 0);
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

  it('rejects a row value that differs from its compiler-authored transfer effect', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract ValueBatchRelease4Hostile() {
        function pay(bytes recipient, bigint amount) public {
          this.transfer(recipient, amount);
          require(msg.value == -amount && amount >= 0);
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await provider.addUtxo(contract.getSatoshiContainerAddress(), {
      txid: '76'.repeat(32), vout: 0, satoshis: 5000n,
    });
    const encoded = layer3.encodeHiddenBatch(artifact, [
      { function: 'pay', args: [Uint8Array.of(0x51), 100n] },
      { function: 'pay', args: [Uint8Array.of(0x52), 200n] },
    ]);
    const forged = encoded.blob.slice();
    // Header(7) + selector/callsite/occurrence/args-length(12) + sign(1):
    // change row 0's authenticated magnitude from 100 to 101 without changing args.
    forged[20] = 101;
    await expect(contract._batchRaw(forged)
      .transfer(Uint8Array.of(0x51), 100n)
      .transfer(Uint8Array.of(0x52), 200n)
      .send()).rejects.toThrow();
  });
});

describe('Release C bounded dynamic-resource batch', () => {
  it('threads two string replacements and flushes only the final chunk set', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract DynamicBatchReleaseC() {
        string text;
        function replace(string next) public {
          this.text = next;
          require(next.length >= 0);
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch?.route.blockLayout?.trailingCapacity).toBe(64);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { text: '' }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const finalValue = 'second-'.repeat(25);
    const originalSend = provider.sendRawTransaction.bind(provider);
    let captured = '';
    (provider as any).sendRawTransaction = async (transactionHex: string): Promise<string> => {
      captured = transactionHex;
      throw new Error('capture-only');
    };
    try {
      await expect(contract.batch([
        { function: 'replace', args: ['first'] },
        { function: 'replace', args: [finalValue] },
      ]).send()).rejects.toThrow('capture-only');
    } finally {
      (provider as any).sendRawTransaction = originalSend;
    }
    const forged = decodeTransactionUnsafe(hexToBin(captured));
    expect(forged.inputs.length).toBe(forged.outputs.length);
    const mutableOutputs = forged.outputs.filter((output) =>
      output.token?.nft?.capability === 'mutable');
    expect(mutableOutputs.length).toBeGreaterThan(1);
    mutableOutputs[mutableOutputs.length - 1].token!.nft!.commitment[0] ^= 1;
    await expect(originalSend(binToHex(encodeTransaction(forged)))).rejects.toThrow();
    await expect(originalSend(captured)).resolves.toBeTypeOf('string');
    expect((await contract.getState()).text).toBe(finalValue);
  });

  it('journals ordered dynamic-array appends into one bounded chunk region', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract DynamicArrayBatchReleaseC() {
        bigint[] values;
        function append(bigint value) public {
          this.values.push(value);
          require(value >= 0);
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { values: [] }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.batch([
      { function: 'append', args: [11n] },
      { function: 'append', args: [22n] },
      { function: 'append', args: [33n] },
    ]).send();
    expect((await contract.getState()).values).toEqual([11n, 22n, 33n]);
  });

  it('settles repeated fungible-token container effects under one owner', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract TokenContainerBatchReleaseC() {
        bigint calls;
        function send(bytes32 category, bytes20 recipient, bigint amount) public {
          require(this.tokens[category].tokenAmount >= amount);
          this.tokens[category].transfer(new LockingBytecodeP2PKH(recipient), amount);
          this.calls = this.calls + 1;
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const token = await genesisFtContainer(provider, inner, categoryId, [1000n]);
    const contract = StatefulContract.withCategory(inner, categoryId);
    const recipient = hexToBin('11'.repeat(20));
    const originalSend = provider.sendRawTransaction.bind(provider);
    let captured = '';
    (provider as any).sendRawTransaction = async (transactionHex: string): Promise<string> => {
      captured = transactionHex;
      throw new Error('capture-only');
    };
    try {
      await expect(contract.batch([
        { function: 'send', args: [hexToBin(token.category), recipient, 100n] },
        { function: 'send', args: [hexToBin(token.category), recipient, 200n] },
      ]).send()).rejects.toThrow('capture-only');
    } finally {
      (provider as any).sendRawTransaction = originalSend;
    }

    // Preserve aggregate supply while substituting one row amount and the container remainder: both the
    // per-row transfer covenant and the container equation must reject the otherwise-balanced forgery.
    const amountForged = decodeTransactionUnsafe(hexToBin(captured));
    const firstTransfer = amountForged.outputs.find((output) => output.token?.amount === 100n);
    const remainder = amountForged.outputs.find((output) => output.token?.amount === 700n);
    expect(firstTransfer).toBeDefined();
    expect(remainder).toBeDefined();
    firstTransfer!.token!.amount = 101n;
    remainder!.token!.amount = 699n;
    await expect(originalSend(binToHex(encodeTransaction(amountForged)))).rejects.toThrow();

    const recipientForged = decodeTransactionUnsafe(hexToBin(captured));
    const secondTransfer = recipientForged.outputs.find((output) => output.token?.amount === 200n);
    expect(secondTransfer).toBeDefined();
    secondTransfer!.lockingBytecode[3] ^= 1;
    await expect(originalSend(binToHex(encodeTransaction(recipientForged)))).rejects.toThrow();

    await expect(originalSend(captured)).resolves.toBeTypeOf('string');
    expect((await contract.getState()).calls).toBe(2n);
    const outputs = await provider.getUtxos(token.address);
    expect(outputs.reduce((sum, output) => sum + (output.token?.amount ?? 0n), 0n)).toBe(700n);
  });
});

describe('Release 4 output-substitution adversarial gate', () => {
  it('rejects a forged ordered-result commitment while accepting the untouched transaction', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract ResultSubstitutionRelease4() {
        bigint total;
        function add(bigint amount) public returns (bigint) {
          this.total = this.total + amount;
          require(amount >= 0);
          return this.total;
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const originalSend = provider.sendRawTransaction.bind(provider);
    let captured = '';
    (provider as any).sendRawTransaction = async (transactionHex: string): Promise<string> => {
      captured = transactionHex;
      throw new Error('capture-only');
    };
    try {
      await expect(contract.batch([
        { function: 'add', args: [2n] },
        { function: 'add', args: [3n] },
      ]).emitReturn().send()).rejects.toThrow('capture-only');
    } finally {
      (provider as any).sendRawTransaction = originalSend;
    }
    expect(captured).not.toBe('');

    const forged = decodeTransactionUnsafe(hexToBin(captured));
    const result = forged.outputs.find((output) => output.token?.nft?.capability === 'none');
    expect(result).toBeDefined();
    result!.token!.nft!.commitment[0] ^= 1;
    await expect(originalSend(binToHex(encodeTransaction(forged)))).rejects.toThrow();
    await expect(originalSend(captured)).resolves.toBeTypeOf('string');
  });

  it('rejects event-output substitution while accepting the untouched transaction', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract EventSubstitutionRelease4() {
        bigint current;
        event Changed(bigint value);
        function set(bigint value) public {
          this.current = value;
          emit Changed(value);
          require(value >= 0);
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { current: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const originalSend = provider.sendRawTransaction.bind(provider);
    let captured = '';
    (provider as any).sendRawTransaction = async (transactionHex: string): Promise<string> => {
      captured = transactionHex;
      throw new Error('capture-only');
    };
    try {
      await expect(contract.batch([
        { function: 'set', args: [2n] },
        { function: 'set', args: [3n] },
      ]).send()).rejects.toThrow('capture-only');
    } finally {
      (provider as any).sendRawTransaction = originalSend;
    }

    const forged = decodeTransactionUnsafe(hexToBin(captured));
    const event = forged.outputs.find((output) =>
      output.token?.nft?.capability === 'none'
      && binToHex(output.token.category) === categoryId);
    expect(event).toBeDefined();
    event!.token!.nft!.commitment[0] ^= 1;
    await expect(originalSend(binToHex(encodeTransaction(forged)))).rejects.toThrow();
    await expect(originalSend(captured)).resolves.toBeTypeOf('string');
  });

  it('rejects value-output substitution while accepting the untouched transaction', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract ValueSubstitutionRelease4() {
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
      txid: '75'.repeat(32), vout: 0, satoshis: 5000n,
    });
    const originalSend = provider.sendRawTransaction.bind(provider);
    let captured = '';
    (provider as any).sendRawTransaction = async (transactionHex: string): Promise<string> => {
      captured = transactionHex;
      throw new Error('capture-only');
    };
    try {
      await expect(contract.batch([
        { function: 'pay', args: [Uint8Array.of(0x51), 100n] },
        { function: 'pay', args: [Uint8Array.of(0x52), 200n] },
      ]).send()).rejects.toThrow('capture-only');
    } finally {
      (provider as any).sendRawTransaction = originalSend;
    }

    const forged = decodeTransactionUnsafe(hexToBin(captured));
    const recipient = forged.outputs.find((output) =>
      output.valueSatoshis === 100n && output.lockingBytecode.length === 1
      && output.lockingBytecode[0] === 0x51);
    const container = forged.outputs.find((output) => output.valueSatoshis === 4700n);
    expect(recipient).toBeDefined();
    expect(container).toBeDefined();
    recipient!.valueSatoshis += 1n;
    container!.valueSatoshis -= 1n;
    await expect(originalSend(binToHex(encodeTransaction(forged)))).rejects.toThrow();
    await expect(originalSend(captured)).resolves.toBeTypeOf('string');
  });
});
