import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026, encodeDataPush, hexToBin } from '@bitauth/libauth';
import { encodeIntegerValue, encodeWitnessBlock, type RecordEntry, type WitnessBlock } from '@solidcash/utils';
import { bytesToSlotValue, keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { USER_LOCK, deployFramedMaster, distinctBytes, head, node } from './record-spend.js';
import { validatorFacetPlacements, validatorSpend } from './validator-input.js';

/**
 * A framed conditional write that did not run, beside later frames of its contract that write the node it skips.
 *
 * Where a guarded write's flag stays clear, the frame's batch transition binds the node its group names kept. That
 * kept binding compared the commitment the transaction spends with the one it writes, or for a node an earlier frame
 * created its written commitment with the frame's first view, and a conditional batch that did not run bound each
 * node's spent and written commitments: the views of the first and last frames to touch the node, not this frame's
 * own. Its declared end view, which settlement chains into the next frame, was bound to nothing. A frame that skipped
 * `balances[a] -= x` could so declare the node credited, and a later `move(a, b, x)` debit the forged balance back to
 * the spent one: settlement chained every view, and `b` held a credit no balance paid. An honest later rewrite was
 * refused the other way, its written commitment differing from the spent one. The kept binding now holds the node's
 * last view in the write segment, at its coordinate, to the first. Every master, the validator and its facets are
 * asked for their verdict on one transaction.
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
const LEDGER = deployFramedMaster(`${PRAGMA} contract Ledger { mapping(uint => uint) balances;`
  + ' function credit(uint a, uint x) { balances[a] += x; }'
  + ' function maybeDebit(uint a, uint x, bool c) { if (c) { balances[a] -= x; } }'
  + ' function move(uint a, uint b, uint x) { balances[a] -= x; balances[b] += x; }'
  + ' function maybeMove(uint a, uint b, uint x, bool c) { if (c) { balances[a] -= x; balances[b] += x; } }'
  + ' }', 'skipped write kept view');

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmInput = VmTransaction['inputs'][number];
type VmOutput = VmTransaction['outputs'][number];

type Key = 'a' | 'b';
const n = (value: bigint): Uint8Array => encodeIntegerValue(value);
const slotOf = (key: Uint8Array): Uint8Array => keyToSlotMulti([key]);
/** Two keys, `a` the one with the lower slot: the list `a -> b` ends at `b`, and an insert of `a` follows the head. */
const [KEY_A, KEY_B] = bytesToSlotValue(slotOf(n(3n))) < bytesToSlotValue(slotOf(n(5n)))
  ? [n(3n), n(5n)] : [n(5n), n(3n)];
const KEY: Record<Key, Uint8Array> = { a: KEY_A, b: KEY_B };
const SLOT: Record<Key, Uint8Array> = { a: slotOf(KEY_A), b: slotOf(KEY_B) };
const X = n(8n);
const YES = n(1n);
const NO = n(0n);
const ZERO = new Uint8Array(32);
const EMPTY = new Uint8Array(0);
const NONE = 0xffff;
const VALUE = 20_000n;
const LOCK = LEDGER.collectionLock('balances');
const FACETS = validatorFacetPlacements();

/** The key's node in the list `a -> b`, holding `value`. */
const held = (key: Key, value: bigint): Uint8Array => node(SLOT[key], key === 'a' ? SLOT.b : ZERO, n(value));

/**
 * Where a composition of `frames` frames puts its inputs: the masters from 0, the validator and its facets, the two
 * nodes the transaction spends (`a`'s, or the head an insert of `a` relinks, then `b`'s), and the user. Outputs
 * recreate each at its own index, and a created node follows the user.
 */
interface Layout {
  readonly validator: number;
  readonly first: number;
  readonly b: number;
  readonly user: number;
  readonly created: number;
}
const layout = (frames: number): Layout => {
  const first = frames + 1 + FACETS.length;
  return { validator: frames, first, b: first + 1, user: first + 2, created: first + 3 };
};

/** One root frame: its entry, its argument pushes (deepest parameter first) and the records its segment declares. */
interface Frame {
  readonly entry: string;
  readonly pushes: readonly Uint8Array[];
  readonly records: readonly RecordEntry[];
}

interface Composition {
  readonly frames: readonly Frame[];
  /** The commitments the two spent nodes carry in and out. */
  readonly spent: readonly [readonly [Uint8Array, Uint8Array], readonly [Uint8Array, Uint8Array]];
  /** The node the transaction creates, past the user. */
  readonly created?: Uint8Array;
}

interface Verdicts {
  /** Each master's, in frame order. */
  readonly frames: readonly boolean[];
  /** The validator and every facet: the settlement is theirs together. */
  readonly settlement: boolean;
}

function masterUnlocking(frame: Frame, at: Layout): Uint8Array {
  const block: WitnessBlock = {
    kind: 0, callerRef: at.user, originRef: at.user, validatorRef: at.validator, sender: USER_LOCK,
    self: LEDGER.address, value: 0n, retval: EMPTY, calls: [], segments: [[...frame.records]], events: [], sends: [],
  };
  return new Uint8Array([
    ...encodeDataPush(encodeWitnessBlock(block)),
    ...encodeDataPush(hexToBin(LEDGER.artifact.abi.find((fn) => fn.name === frame.entry)!.selector!)),
    ...frame.pushes.flatMap((push) => [...encodeDataPush(push)]),
    ...encodeDataPush(LEDGER.script),
  ]);
}

/** Every contract input's verdict on the composed transaction, the frames all roots under one validator. */
function verdicts(composition: Composition): Verdicts {
  const at = layout(composition.frames.length);
  const masters = composition.frames.map((_, index) => index);
  const validator = validatorSpend(LEDGER.category, {
    roots: masters,
    masters,
    settles: [{
      category: LEDGER.category,
      stateInputs: [at.first, at.b],
      createdOutputs: composition.created === undefined ? [] : [at.created],
    }],
  });
  const token = (capability: 'minting' | 'mutable', commitment: Uint8Array = EMPTY): VmOutput['token'] =>
    ({ category: LEDGER.category, amount: 0n, nft: { capability, commitment } });
  const input = (index: number, unlockingBytecode: Uint8Array): VmInput => ({
    outpointIndex: 0, outpointTransactionHash: distinctBytes(32, 0x80 + index), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const record = (commitment: Uint8Array): VmOutput =>
    ({ lockingBytecode: LOCK, valueSatoshis: VALUE, token: token('mutable', commitment) });
  const master: VmOutput = { lockingBytecode: LEDGER.lock, valueSatoshis: VALUE, token: token('minting') };
  const validatorUtxo: VmOutput = { lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token('mutable') };
  const user: VmOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const [[aIn, aOut], [bIn, bOut]] = composition.spent;
  const inputs: VmInput[] = [
    ...composition.frames.map((frame, index) => input(index, masterUnlocking(frame, at))),
    input(at.validator, validator.unlockingBytecode),
    ...FACETS.map((facet) => facet.input),
    input(at.first, encodeDataPush(new Uint8Array([1]))),
    input(at.b, encodeDataPush(new Uint8Array([1]))),
    input(at.user, callerUnlockingBytecode()),
  ];
  const shared = [...composition.frames.map(() => master), validatorUtxo, ...FACETS.map((facet) => facet.output)];
  const sourceOutputs: VmOutput[] = [...shared, record(aIn), record(bIn), user];
  const outputs: VmOutput[] = [
    ...shared, record(aOut), record(bOut), user,
    ...(composition.created === undefined ? [] : [record(composition.created)]),
  ];
  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  const accepted = (inputIndex: number): boolean =>
    vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
  return {
    frames: masters.map(accepted),
    settlement: accepted(at.validator) && FACETS.every((_, index) => accepted(at.validator + 1 + index)),
  };
}

/** A node spent at `index` and recreated there, declared from `viewIn` to `viewOut`. */
const spentNode = (index: number, viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry =>
  ({ in: index, out: index, viewIn, viewOut });
/** A node an earlier frame created at output `out`, which a later frame names there alone. */
const createdNode = (out: number, viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry =>
  ({ in: NONE, out, viewIn, viewOut });

/**
 * The keys an entry's targets write, in the order its frame declares their groups: the order of their slots, which
 * the entry cache's reads set for a read-modify-write.
 */
const targetKeys = (entry: string): Key[] => LEDGER.artifact.abi.find((fn) => fn.name === entry)!.entryAccesses!
  .filter((access) => access.operations.includes('write'))
  .sort((left, right) => left.slotIndex! - right.slotIndex!)
  .map((access) => access.keyParams[0] as Key);

const maybeDebit = (key: Key, c: Uint8Array, record: RecordEntry): Frame =>
  ({ entry: 'maybeDebit', pushes: [c, X, KEY[key]], records: [record] });
/** `move(a, b, 8)`: `a`'s balance debited 8 and `b`'s credited 8, each key's group in its frame's order. */
const move = (records: Record<Key, RecordEntry>): Frame =>
  ({ entry: 'move', pushes: [X, KEY_B, KEY_A], records: targetKeys('move').map((key) => records[key]) });
const maybeMove = (c: Uint8Array, records: Record<Key, RecordEntry>): Frame =>
  ({ entry: 'maybeMove', pushes: [c, X, KEY_B, KEY_A], records: targetKeys('maybeMove').map((key) => records[key]) });

describe('a framed write that did not run holds the node it spends to its own declared views', () => {
  const at = layout(2);
  /** The skipped debit of `a`, declared from 50 to `skipped`, then `move(a, b, 8)` from that view to `written`. */
  const beforeMove = (skipped: bigint, written: bigint): Composition => ({
    frames: [
      maybeDebit('a', NO, spentNode(at.first, held('a', 50n), held('a', skipped))),
      move({
        a: spentNode(at.first, held('a', skipped), held('a', written)),
        b: spentNode(at.b, held('b', 50n), held('b', 58n)),
      }),
    ],
    spent: [[held('a', 50n), held('a', written)], [held('b', 50n), held('b', 58n)]],
  });

  it('settles the skipped debit where no other frame writes the node', () => {
    expect(verdicts({
      frames: [
        maybeDebit('a', NO, spentNode(at.first, held('a', 50n), held('a', 50n))),
        maybeDebit('b', YES, spentNode(at.b, held('b', 50n), held('b', 42n))),
      ],
      spent: [[held('a', 50n), held('a', 50n)], [held('b', 50n), held('b', 42n)]],
    })).toStrictEqual({ frames: [true, true], settlement: true });
  });

  it('settles the skipped debit before a frame that rewrites the node', () => {
    // Before the binding the frame refused this: the node's written commitment is the move's.
    expect(verdicts(beforeMove(50n, 42n))).toStrictEqual({ frames: [true, true], settlement: true });
  });

  it('refuses the skipped debit declaring the node credited, which a later debit writes back', () => {
    // Before the binding the frame accepted this, and settlement chained its view into the move: `b` was credited 8
    // that `a`'s balance, spent and written at 50, never paid.
    expect(verdicts(beforeMove(58n, 50n))).toStrictEqual({ frames: [false, true], settlement: true });
  });
});

describe('a framed write that did not run holds a node an earlier frame created to its own declared views', () => {
  const at = layout(3);
  /** `credit(a, 50)` into the list holding `b` alone: the head relinked to `a`, and `a`'s node created after it. */
  const inserted: Frame = {
    entry: 'credit',
    pushes: [n(50n), KEY_A],
    records: [spentNode(at.first, head(SLOT.b), head(SLOT.a)), createdNode(at.created, EMPTY, held('a', 50n))],
  };
  /** The insert, the skipped debit of `a` declared from 50 to `skipped`, then the move from that view to `written`. */
  const continued = (skipped: bigint, written: bigint): Composition => ({
    frames: [
      inserted,
      maybeDebit('a', NO, createdNode(at.created, held('a', 50n), held('a', skipped))),
      move({
        a: createdNode(at.created, held('a', skipped), held('a', written)),
        b: spentNode(at.b, held('b', 50n), held('b', 58n)),
      }),
    ],
    spent: [[head(SLOT.b), head(SLOT.a)], [held('b', 50n), held('b', 58n)]],
    created: held('a', written),
  });

  it('settles the skipped debit before a frame that rewrites the node', () => {
    // Before the binding the frame refused this: it held the node's output to the view it began with.
    expect(verdicts(continued(50n, 42n))).toStrictEqual({ frames: [true, true, true], settlement: true });
  });

  it('refuses the skipped debit declaring the node credited, which a later debit writes back', () => {
    // Before the binding the frame accepted this: the node's output is the view it began with.
    expect(verdicts(continued(58n, 50n))).toStrictEqual({ frames: [true, false, true], settlement: true });
  });
});

describe('a framed conditional batch that did not run holds its nodes to their own declared views', () => {
  const at = layout(2);
  /** The skipped batch, `a` declared from 50 to `skipped` and `b` kept, then the move from those views. */
  const beforeMove = (skipped: bigint, written: bigint): Composition => ({
    frames: [
      maybeMove(NO, {
        a: spentNode(at.first, held('a', 50n), held('a', skipped)),
        b: spentNode(at.b, held('b', 50n), held('b', 50n)),
      }),
      move({
        a: spentNode(at.first, held('a', skipped), held('a', written)),
        b: spentNode(at.b, held('b', 50n), held('b', 58n)),
      }),
    ],
    spent: [[held('a', 50n), held('a', written)], [held('b', 50n), held('b', 58n)]],
  });

  it('settles the skipped batch before a frame that rewrites its nodes', () => {
    // Before the binding the frame refused this: the batch held each node's written commitment to its spent one.
    expect(verdicts(beforeMove(50n, 42n))).toStrictEqual({ frames: [true, true], settlement: true });
  });

  it('refuses the skipped batch declaring a node credited, which a later debit writes back', () => {
    expect(verdicts(beforeMove(58n, 50n))).toStrictEqual({ frames: [false, true], settlement: true });
  });
});
