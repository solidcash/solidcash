import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeDataPush, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import type { AbiFunction } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { callRecordCommitment, callRecordDigest } from '../../src/stateful/call-record.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';

/**
 * The multi-call entry of a direct callee (docs/wip/call-records/DESIGN.md): one spend of the master runs several
 * calls, frame k settling the record of its call under ordinal k on the data records the frames before it left, and
 * the entry pins the records' final state, counts the spend's records and holds every other record of the contract
 * in place.
 */

const SOURCE = `pragma solidcash >=0.8.0;
contract Book() {
  mapping(bigint => bigint) prices;
  bigint total;
  function setPrice(bigint key, bigint value) public { this.prices[key] = value; }
  function setTotal(bigint value) public { this.total = value; }
  function priceOf(bigint key) public returns (bigint) { return this.prices[key]; }
  function totalOf() public returns (bigint) { return this.total; }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type Output = Tx['outputs'][number];
type Instruction = { opcode: number; data?: Uint8Array };

const COUNTER_SOURCE = `pragma solidcash >=0.8.0;
contract Counter() {
  bigint count;
  function inc() public returns (bigint) { this.count = this.count + 1; return this.count; }
  function add(bigint value) public { this.count = this.count + value; }
  function get() public returns (bigint) { return this.count; }
}`;

type CompiledArtifact = ReturnType<typeof compileString>;
let compiled: CompiledArtifact | undefined;
const artifact = (): CompiledArtifact => {
  compiled ??= compileString(SOURCE, { callBatch: true });
  return compiled;
};
let counterCompiled: CompiledArtifact | undefined;
const counterArtifact = (): CompiledArtifact => {
  counterCompiled ??= compileString(COUNTER_SOURCE, { callBatch: true });
  return counterCompiled;
};
const abiOf = (name: string, source: CompiledArtifact = artifact()): AbiFunction => source.abi
  .find((fn) => fn.name === name)!;

// P2SH32 of `OP_1`, spent with a push of its redeem script.
const FUNDER = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
const FUNDER_UNLOCK = Uint8Array.from([0x01, 0x51]);
const CALL_BATCH_SELECTOR = '53434442';

const decode = (hex: string): Tx => decodeTransactionUnsafe(hexToBin(hex));
const encode = (tx: Tx): string => binToHex(encodeTransaction(tx));
const outcomeOf = (provider: Provider, hex: string): Promise<string> => provider.sendRawTransaction(hex)
  .then(() => 'ACCEPTED').catch((e: Error) => e.message);
const resultOf = (value: bigint): Uint8Array => encodeDataPush(bigIntToVmNumber(value));

async function capture(provider: Provider, run: () => Promise<unknown>): Promise<Tx> {
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    throw new Error('capture-only');
  };
  await expect(run()).rejects.toThrow('capture-only');
  (provider as any).sendRawTransaction = send;
  expect(captured).not.toBe('');
  return decode(captured);
}

/** A frame's call, and its result: none for a void call. */
interface Frame { abiFunction: AbiFunction; args: (bigint | Uint8Array)[]; result?: bigint }

/**
 * A frame of `fn` with these named arguments; its genesis call is empty, its record names no reader (no contract
 * reads it) and every other ABI input is 0.
 */
const frame = (
  fn: string, values: Record<string, bigint>, result?: bigint, source: CompiledArtifact = artifact(),
): Frame => ({
  abiFunction: abiOf(fn, source),
  args: abiOf(fn, source).inputs.map((input) => values[input.name]
    ?? (input.name === '__internal__genesisCall' ? new Uint8Array()
      : input.name === '__internal__callRecordReader' ? -1n : 0n)),
  result,
});

/** The record frame k pins: the digest of its call under `ordinal`, then its result inline, empty for a void call. */
const recordOf = (spec: Frame, ordinal: number): Uint8Array => callRecordCommitment(
  spec.result === undefined ? new Uint8Array(0) : resultOf(spec.result),
  callRecordDigest(spec.abiFunction, spec.args, {}, ordinal)!,
);

const carrierOf = (category: string, commitment: Uint8Array): Output => ({
  lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1000n,
  token: { category, amount: 0n, nft: { capability: 'none', commitment } },
} as Output);

let funderNonce = 0x7000;

/** A spendable funder of 50,000 satoshis, its input, and the change output a spend returns to it. */
async function funder(provider: Provider, change: bigint): Promise<{ input: Tx['inputs'][number]; change: Output }> {
  const txid = (funderNonce++).toString(16).padStart(64, '0');
  await (provider as any).addUtxo(FUNDER, { txid, vout: 0, satoshis: 50000n });
  return {
    input: { outpointTransactionHash: hexToBin(txid), outpointIndex: 0, sequenceNumber: 0xffffffff,
      unlockingBytecode: FUNDER_UNLOCK },
    change: { lockingBytecode: hexToBin(FUNDER), valueSatoshis: change } as Output,
  };
}

interface Batch { provider: Provider; book: StatefulContract<any>; tx: Tx; frames: Frame[]; master: number }

/**
 * A deployed book (total 9, prices 1 -> 100 and 2 -> 200) and one spend of its master running three frames: both
 * prices and the total, or with `readers` the two prices alone. Inputs: the master, the data record, the entries of
 * keys 1 and 2, a funder; the price frames read the entries one and two inputs past their layout slot, and the
 * frames pin their records from output 4.
 */
async function batch(readers = false): Promise<Batch> {
  const provider = createTestProvider();
  const contract = new Contract(artifact(), [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact().stateLayout!, { total: 0n }, { saltContract: true },
  );
  const book = StatefulContract.withCategory(contract, categoryId) as StatefulContract<any>;
  await (book as any).setTotal(9n).send();
  await (book as any).setPrice(1n, 100n).send();
  await (book as any).setPrice(2n, 200n).send();

  // Standalone runs of the three calls name the inputs and the outputs that keep them.
  const one = await capture(provider, () => (book as any).priceOf(1n).send());
  const two = await capture(provider, () => (book as any).priceOf(2n).send());
  const total = await capture(provider, () => (book as any).totalOf().send());
  const master = one.outputs.findIndex((output) => output.token?.nft?.capability === 'minting');
  expect(master).toBe(0);
  for (const standalone of [two, total]) {
    expect(standalone.outputs.findIndex((output) => output.token?.nft?.capability === 'minting')).toBe(master);
  }

  const frames = [
    frame('priceOf', { key: 1n, __internal__returnOutputIdx: 4n, __internal__rowEntryShift: 1n }, 100n),
    frame('priceOf', { key: 2n, __internal__returnOutputIdx: 5n, __internal__rowEntryShift: 2n }, 200n),
    ...(readers ? [] : [frame('totalOf', { __internal__returnOutputIdx: 6n }, 9n)]),
  ];
  const unlocker = book.inner.createCallBatchUnlocker(frames);
  const category = one.outputs[master]!.token!.category;
  const pay = await funder(provider, 40000n);
  const tx: Tx = {
    version: one.version,
    locktime: one.locktime,
    inputs: [
      { ...one.inputs[master]!, unlockingBytecode: unlocker.generateUnlockingBytecode({} as never) },
      total.inputs[master + 1]!,
      one.inputs[master + 1]!,
      two.inputs[master + 1]!,
      pay.input,
    ],
    outputs: [
      one.outputs[master]!,
      total.outputs[master + 1]!,
      one.outputs[master + 1]!,
      two.outputs[master + 1]!,
      ...frames.map((spec, ordinal) => carrierOf(category, recordOf(spec, ordinal))),
      pay.change,
    ],
  };
  return { provider, book, tx, frames, master };
}

/** Replace the selector of the frame pushed first (frame 0), keeping its pushes. */
function withFirstFrameSelector(tx: Tx, master: number, selector: string): Tx {
  const copy = decode(encode(tx));
  const instructions = decodeAuthenticationInstructions(copy.inputs[master]!.unlockingBytecode) as Instruction[];
  expect(binToHex(instructions[0]!.data!)).toBe(CALL_BATCH_SELECTOR);
  // Frame 0 (`priceOf`) is its pushes, then its selector.
  const at = 1 + abiOf('priceOf').inputs.length;
  expect(binToHex(instructions[at]!.data!)).toBe(abiOf('priceOf').selector);
  instructions[at] = decodeAuthenticationInstructions(encodeDataPush(hexToBin(selector)))[0] as Instruction;
  copy.inputs[master]!.unlockingBytecode = encodeAuthenticationInstructions(instructions as any);
  return copy;
}

describe('multi-call entry', () => {
  it('publishes the entry and its frame entries', () => {
    expect(artifact().callBatch).toEqual({ selector: CALL_BATCH_SELECTOR });
    // A writer of a fixed field is a frame too; a mapping writer is not.
    expect(artifact().abi.filter((fn) => fn.callBatchRow).map((fn) => fn.name))
      .toEqual(['setTotal', 'priceOf', 'totalOf']);
    expect(abiOf('priceOf').inputs.map((input) => input.name)).toContain('__internal__rowEntryShift');
    const plain = compileString(SOURCE, { callBatch: false });
    expect(plain.callBatch).toBeUndefined();
    expect(plain.abi.some((fn) => fn.callBatchRow || fn.inputs.some((input) => input.name.includes('rowEntry'))))
      .toBe(false);
    // Off unless asked for: a contract compiled with no option is the plain contract, byte for byte.
    const lean = compileString(SOURCE);
    expect(lean.callBatch).toBeUndefined();
    expect(lean.bytecode).toBe(plain.bytecode);
  });

  it('runs three calls in one spend of the master, each pinning its own record, and refuses the forgeries', async () => {
    const { provider, book, tx, frames, master } = await batch();

    // Frame 0 is pushed first: `<sel> [frame 0]..[frame K-1] <K>`, a frame its arguments last first, then its selector.
    const layout = [hexToBin(CALL_BATCH_SELECTOR), ...frames.flatMap((spec) => [
      ...spec.args.map((arg) => (typeof arg === 'bigint' ? bigIntToVmNumber(arg) : arg)).reverse(),
      hexToBin(spec.abiFunction.selector!),
    ]), bigIntToVmNumber(BigInt(frames.length))].flatMap((push) => [...encodeDataPush(push)]);
    expect(binToHex(tx.inputs[master]!.unlockingBytecode.slice(0, layout.length)))
      .toBe(binToHex(Uint8Array.from(layout)));

    // A carrier of the callee's category beside the three records.
    const extra = decode(encode(tx));
    const txid = (0x8000 + Math.floor(Math.random() * 0x0fff)).toString(16).padStart(64, '0');
    await (provider as any).addUtxo(FUNDER, { txid, vout: 0, satoshis: 40000n });
    extra.inputs.push({ outpointTransactionHash: hexToBin(txid), outpointIndex: 0, sequenceNumber: 0xffffffff,
      unlockingBytecode: FUNDER_UNLOCK });
    extra.outputs.push({ ...tx.outputs[4]!, token: { ...tx.outputs[4]!.token!,
      nft: { ...tx.outputs[4]!.token!.nft!, commitment: tx.outputs[4]!.token!.nft!.commitment.slice() } } } as Output);
    extra.outputs.push({ lockingBytecode: hexToBin(FUNDER), valueSatoshis: 37000n });
    expectScriptRejection(await outcomeOf(provider, encode(extra)), master);

    // The first two frames' records laid under each other's ordinals.
    const swapped = decode(encode(tx));
    swapped.outputs[4]!.token!.nft!.commitment = recordOf(frames[0]!, 1);
    swapped.outputs[5]!.token!.nft!.commitment = recordOf(frames[1]!, 0);
    expectScriptRejection(await outcomeOf(provider, encode(swapped)), master);

    // An entry that runs no frame named as one, and the multi-call entry named as a frame of itself.
    const writer = withFirstFrameSelector(tx, master, abiOf('setPrice').selector!);
    expectScriptRejection(await outcomeOf(provider, encode(writer)), master);
    const nested = withFirstFrameSelector(tx, master, CALL_BATCH_SELECTOR);
    expectScriptRejection(await outcomeOf(provider, encode(nested)), master);

    expect(await outcomeOf(provider, encode(tx))).toBe('ACCEPTED');
    expect((await book.getState()).total).toBe(9n);
    // A standalone call still settles as one.
    await expect((book as any).priceOf(2n).send()).resolves.toBeDefined();
  }, 300_000);

  // No price frame counts the contract's mutable records in a batch: the entry holds them to the spend's inputs.
  it.each([
    ['data record', 1],
    ['mapping node', 2],
  ] as const)('refuses an extra %s at a lock the contract mints, beside a batch of reads', async (_kind, copied) => {
    const { provider, tx, master } = await batch(true);
    const forged = decode(encode(tx));
    const change = forged.outputs.pop()!;
    const extra = decode(encode(tx)).outputs[copied]!;
    forged.outputs.push(extra, { ...change, valueSatoshis: change.valueSatoshis - extra.valueSatoshis });
    expectScriptRejection(await outcomeOf(provider, encode(forged)), master);
    expect(await outcomeOf(provider, encode(tx))).toBe('ACCEPTED');
  }, 300_000);
});

describe('multi-call entry with state-changing frames', () => {
  it('publishes its writers and its void entry as frames', () => {
    expect(counterArtifact().abi.filter((fn) => fn.callBatchRow).map((fn) => fn.name)).toEqual(['inc', 'add', 'get']);
    // A void frame takes the witness its record is pinned at, the genesis call it requires empty as a frame, and the
    // reader its record names.
    expect(abiOf('add', counterArtifact()).inputs.map((input) => input.name))
      .toEqual(['value', '__internal__genesisCall', '__internal__callRecordReader', '__internal__returnOutputIdx']);
    expect(compileString(COUNTER_SOURCE).bytecode).toBe(compileString(COUNTER_SOURCE, { callBatch: false }).bytecode);
  });

  it('runs [inc, inc, add(5), get] in one spend: records 1, 2, void and 7, and state 7', async () => {
    const provider = createTestProvider();
    const contract = new Contract(counterArtifact(), [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, counterArtifact().stateLayout!, { count: 0n }, { saltContract: true },
    );
    const counter = StatefulContract.withCategory(contract, categoryId) as StatefulContract<any>;

    // A standalone write names the inputs; its output carries state 7, a read's state 0.
    const seven = await capture(provider, () => (counter as any).add(7n).send());
    const zero = await capture(provider, () => (counter as any).get().send());
    const master = seven.outputs.findIndex((output) => output.token?.nft?.capability === 'minting');
    expect(master).toBe(0);
    const category = seven.outputs[master]!.token!.category;
    const counterFrame = (fn: string, values: Record<string, bigint>, result?: bigint): Frame => frame(
      fn, values, result, counterArtifact(),
    );
    // Inputs: the master, the data record, a funder. Outputs: the master, the record's final state, then the
    // frames' records from output 2.
    const spend = async (
      frames: Frame[], records: Uint8Array[], state: Output = seven.outputs[master + 1]!,
    ): Promise<Tx> => {
      const pay = await funder(provider, 40000n);
      return {
        version: seven.version,
        locktime: seven.locktime,
        inputs: [
          { ...seven.inputs[master]!, unlockingBytecode: counter.inner.createCallBatchUnlocker(frames)
            .generateUnlockingBytecode({} as never) },
          seven.inputs[master + 1]!,
          pay.input,
        ],
        outputs: [seven.outputs[master]!, state, ...records.map((record) => carrierOf(category, record)), pay.change],
      } as Tx;
    };
    const frames = [
      counterFrame('inc', { __internal__returnOutputIdx: 2n }, 1n),
      counterFrame('inc', { __internal__returnOutputIdx: 3n }, 2n),
      counterFrame('add', { value: 5n, __internal__returnOutputIdx: 4n }),
      counterFrame('get', { __internal__returnOutputIdx: 5n }, 7n),
    ];
    const records = frames.map((spec, ordinal) => recordOf(spec, ordinal));
    // The void frame's record is its digest and the inline form of an empty result.
    expect(binToHex(records[2]!.slice(31))).toBe('01');

    // `get` run before `add(5)` leaves the same state, but not the records of the calls as made. Each frame's
    // record names no reader (-1).
    const swapped = [frames[0]!, frames[1]!, { ...frames[3]!, args: [new Uint8Array(), -1n, 4n] },
      { ...frames[2]!, args: [5n, new Uint8Array(), -1n, 5n] }];
    expectScriptRejection(await outcomeOf(provider, encode(await spend(swapped, records))), master);
    // The record of `get` under the ordinal of the frame before it.
    const misnumbered = [...records.slice(0, 3), recordOf(frames[3]!, 2)];
    expectScriptRejection(await outcomeOf(provider, encode(await spend(frames, misnumbered))), master);
    // The data record left at the state the frames started from.
    expectScriptRejection(await outcomeOf(provider, encode(await spend(frames, records, zero.outputs[master + 1]!))),
      master);

    expect(await outcomeOf(provider, encode(await spend(frames, records)))).toBe('ACCEPTED');
    expect((await counter.getState()).count).toBe(7n);

    // Standalone runs still settle, on the state the batch left.
    await (counter as any).inc().send();
    await (counter as any).add(2n).send();
    expect((await counter.getState()).count).toBe(10n);
    await expect((counter as any).get().send()).resolves.toBeDefined();

    // A standalone void run pins no record: one beside it is refused.
    const lone = await capture(provider, () => (counter as any).add(1n).send());
    const standalone = async (extra: Output[]): Promise<Tx> => {
      const pay = await funder(provider, 40000n);
      return {
        version: lone.version,
        locktime: lone.locktime,
        inputs: [lone.inputs[master]!, lone.inputs[master + 1]!, pay.input],
        outputs: [lone.outputs[master]!, lone.outputs[master + 1]!, ...extra, pay.change],
      } as Tx;
    };
    const voidRecord = recordOf(counterFrame('add', { value: 1n, __internal__returnOutputIdx: 2n }), 0);
    expectScriptRejection(await outcomeOf(provider, encode(await standalone([carrierOf(category, voidRecord)]))),
      master);
    expect(await outcomeOf(provider, encode(await standalone([])))).toBe('ACCEPTED');
    expect((await counter.getState()).count).toBe(11n);
  }, 300_000);
});
