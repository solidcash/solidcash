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
import { oracle, oraclePub } from '../fixture/vars.js';

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

  it('captures constructor authority and authenticates data-signature row arguments', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract DataSignatureBatch(pubkey oraclePk) {
        int accepted;
        function accept(datasig proof, bytes message) public {
          require(checkDataSig(proof, message, oraclePk));
          this.accepted = this.accepted + 1;
          require(message.length > 0);
        }
        function check(int expected) public { require(this.accepted == expected); }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    const inner = new Contract(artifact, [oraclePub], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { accepted: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const first = hexToBin('01020304');
    await contract.batch([
      { function: 'accept', args: [oracle.signMessage(first), first] },
    ]).send();
    await contract.check(1n).send();

    const forged = oracle.signMessage(first).slice();
    forged[0] ^= 1;
    await expect(contract.batch([
      { function: 'accept', args: [forged, first] },
    ]).send()).rejects.toThrow();
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
          // container observes the aggregate -1800 satoshi transition.
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
    // AMOUNTS ARE INCIDENTAL HERE. What this asserts is per-row transfer ordering and that inactive slots
    // stay empty; nothing about the assertion depends on the magnitudes, only on their being distinct and
    // increasing. They were 100/200/300, which pays a 10-byte output below the 474-satoshi dust floor
    // (3 * (10 + 148)) - the same floor BCHN used to refuse C1 with `64: dust`, so that shape was one the
    // real network rejects. 500/600/700 keeps the ordering and clears the floor.
    const transaction = await contract.batch([
      { function: 'pay', args: [Uint8Array.of(0x51), 500n] },
      { function: 'pay', args: [Uint8Array.of(0x52), 600n] },
      { function: 'pay', args: [Uint8Array.of(0x53), 700n] },
    ]).send();
    const outputs = getTxOutputs(transaction);
    const amounts = outputs.map((output) => output.amount);
    expect(amounts).toEqual(expect.arrayContaining([500n, 600n, 700n, 3200n]));
    // Strengthened while the amounts moved: `arrayContaining` is order-blind, and this test claims order.
    // The three bare-script recipients must carry their own row's amount, in row order.
    expect(outputs.filter((output) => ['51', '52', '53'].includes(output.to as string)))
      .toEqual([
        { to: '51', amount: 500n, token: undefined },
        { to: '52', amount: 600n, token: undefined },
        { to: '53', amount: 700n, token: undefined },
      ]);
  });

  it('rejects a row value that differs from its compiler-authored transfer effect', async () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract ValueBatchRelease4Hostile() {
        function pay(bytes recipient, bigint amount) public {
          this.transfer(recipient, amount);
          require(msg.value == -amount && amount >= 0);
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });

    // A fresh deployment per submission, so the control and the attack differ in the forged byte and in
    // nothing else - not in a spent container, not in carried state.
    const submit = async (blob: Uint8Array): Promise<unknown> => {
      const provider = createTestProvider();
      const inner = new Contract(artifact, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, inner, artifact.stateLayout!, {}, { saltContract: true },
      );
      const contract = StatefulContract.withCategory(inner, categoryId);
      await provider.addUtxo(contract.getSatoshiContainerAddress(), {
        txid: '76'.repeat(32), vout: 0, satoshis: 5000n,
      });
      return contract._batchRaw(blob)
        .transfer(Uint8Array.of(0x51), 500n)
        .transfer(Uint8Array.of(0x52), 600n)
        .send();
    };

    // AMOUNTS ARE INCIDENTAL: this asserts that an authenticated row value must equal the compiler-authored
    // transfer effect. 100/200 paid a 10-byte output under the 474-satoshi dust floor (3 * (10 + 148)), a
    // shape the network refuses `64: dust`; 500/600 clears it and the attack is byte-for-byte the same one.
    const encoded = layer3.encodeHiddenBatch(artifact, [
      { function: 'pay', args: [Uint8Array.of(0x51), 500n] },
      { function: 'pay', args: [Uint8Array.of(0x52), 600n] },
    ]);
    const forged = encoded.blob.slice();
    /*
     * SCB1 OFFSETS, RE-DERIVED FOR THE RAISED AMOUNTS.
     *   header  = magic 'SCB1'(4) + [version, valueMode, rowCount](3)          -> row 0 starts at 7
     *   row     = selector(4) + rowIndex(4) + occurrence(2) + argsLength(2)    -> value field at 7+12 = 19
     *   value   = sign(1) at 19, then magnitude as a FIXED-WIDTH uint64 LE at 20..27
     * The magnitude is fixed width and precedes the variable-length args, so byte 20 is the magnitude LSB
     * at any amount - it did not move when 100 became 500. 500 = 0x01f4, so byte 20 reads 0xf4 and byte 21
     * reads 0x01; writing 0xf5 authenticates 501 and touches nothing else. The row's own args still encode
     * 500 (`02 f4 01` at offset 30) and `.transfer` below still declares 500, which is the disagreement
     * under test. Asserted rather than assumed: a shifted layout must fail here, not silently forge a
     * selector byte and be refused for the wrong reason.
     */
    expect(forged.slice(0, 4)).toEqual(hexToBin('53434231'));
    expect(forged[19]).toBe(1); // sign: msg.value is -500
    expect(forged[20]).toBe(0xf4);
    expect(forged[21]).toBe(0x01);
    expect(binToHex(forged.slice(28, 33))).toBe('015102f401'); // args: push 0x51, push VM-number 500
    forged[20] = 0xf5;

    // GUARD NEGATIVE CONTROL: the identical submission with the unforged blob is accepted. Without it the
    // rejection below could be the dust floor, a broken `_batchRaw` path, or an unfunded container.
    await expect(submit(encoded.blob)).resolves.toBeDefined();

    /*
     * ATTRIBUTION. The refusal must be the forged byte's, so the message is matched rather than counted.
     * The covenant reaches input 0 and fails OP_VERIFY comparing the authenticated row value against the
     * negated row argument: the VM trace at ip=182..183 holds `f581` (sign-magnitude -501, the forged
     * field) beside `f481` (-500, negated from the row's own `02 f4 01`). A dust refusal would be a
     * `layer3:` byte-rule message raised in the SDK before the VM ever ran, which is asserted against
     * explicitly - that is the exact way this guard would go vacuous.
     */
    const failure = await submit(forged).then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toMatch(
      /mandatory-script-verify-flag-failed .*evaluating input index 0: Program failed an OP_VERIFY operation/,
    );
    expect(failure!.message).not.toMatch(/layer3: finalized transaction refused/);
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
  it('authenticates multiple non-scalar events per reached handler row', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract ComplexEventBatchRelease4() {
        event Complex(bytes payload, string label);
        function publish(bytes payload, string label) public {
          emit Complex(payload, label);
          emit Complex(payload, label);
          require(payload.length > 0);
        }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
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
        { function: 'publish', args: [hexToBin('aabb'), 'first'] },
        { function: 'publish', args: [hexToBin('ccdd'), 'second'] },
      ]).send()).rejects.toThrow('capture-only');
    } finally {
      (provider as any).sendRawTransaction = originalSend;
    }
    const transaction = decodeTransactionUnsafe(hexToBin(captured));
    const events = transaction.outputs.filter((output) =>
      output.token?.nft?.capability === 'none'
      && binToHex(output.token.category) === categoryId);
    expect(events).toHaveLength(4);

    events[2].token!.nft!.commitment[events[2].token!.nft!.commitment.length - 1] ^= 1;
    await expect(originalSend(binToHex(encodeTransaction(transaction)))).rejects.toThrow();
    await expect(originalSend(captured)).resolves.toBeTypeOf('string');
  });

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
      // AMOUNTS ARE INCIDENTAL: this asserts that moving a satoshi between a recipient and the container is
      // refused. 100/200 paid a 10-byte output under the 474-satoshi dust floor (3 * (10 + 148)), the same
      // floor BCHN used to refuse C1 `64: dust`; 500/600 clears it and the substitution is unchanged.
      await expect(contract.batch([
        { function: 'pay', args: [Uint8Array.of(0x51), 500n] },
        { function: 'pay', args: [Uint8Array.of(0x52), 600n] },
      ]).send()).rejects.toThrow('capture-only');
    } finally {
      (provider as any).sendRawTransaction = originalSend;
    }

    const forged = decodeTransactionUnsafe(hexToBin(captured));
    const recipient = forged.outputs.find((output) =>
      output.valueSatoshis === 500n && output.lockingBytecode.length === 1
      && output.lockingBytecode[0] === 0x51);
    // 5000 funded minus 500 + 600 paid out.
    const container = forged.outputs.find((output) => output.valueSatoshis === 3900n);
    expect(recipient).toBeDefined();
    expect(container).toBeDefined();
    recipient!.valueSatoshis += 1n;
    container!.valueSatoshis -= 1n;
    // The refusal is the covenant's at input 0, not a relay-byte observation: both sides of the move stay
    // well above their dust floors, so no byte rule is even in play.
    const failure = await originalSend(binToHex(encodeTransaction(forged)))
      .then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toMatch(
      /mandatory-script-verify-flag-failed .*evaluating input index 0: Program failed an OP_VERIFY operation/,
    );
    // Guard negative control: the same bytes without the one-satoshi move are accepted.
    await expect(originalSend(captured)).resolves.toBeTypeOf('string');
  });
});
