import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildEntryNftCovenantScript, computeCollectionHash, encodeChunkableValueTail, encodeIntegerValue,
  encodePushdataValue, scriptToBytecode, type Artifact,
} from '@solidcash/utils';
import { encodeEntryCommitment, keyToSlotMulti } from '../../solidcash/src/stateful/SortedList.js';
import { compileString } from '../src/index.js';
import { DirectStaleReadError } from '../src/Errors.js';

/**
 * A direct-convention body that reads a verified-mapping entry after writing it, settled on the BCH-2026 machine.
 *
 * A write to a verified mapping co-spends the entry's node and recreates it with the written value; a read takes the
 * node the transaction spends. A read of the same entry later in the body has to see the value the write left, as
 * the EVM's does: the body's last write keeps the value it stores, and the reads after it take that copy. Each body
 * requires what its read saw to equal an argument, so the EVM's value is accepted and the value from before the
 * write is refused. Scalar and struct-field writes were already served by the entry cache (`CacheMappingEntryInLoop`)
 * and stand beside the shapes the kept value serves; a read the body cannot serve is refused at compile time.
 *
 * The transaction spends the master at 0 and the node at 1, recreating both at the same indices, and a funder at 2;
 * every input runs its own program. The node is the end of its list, updated in place.
 */

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

/** `length` bytes that are pairwise distinct for any length up to 256. */
function distinctBytes(length: number, seed: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (seed + index * 37) & 0xff);
}

const EMPTY = new Uint8Array(0);
const ZERO_SLOT = new Uint8Array(32);
const CATEGORY = distinctBytes(32, 0x29);
const FUNDER_LOCK = Uint8Array.from([0x51]);
const VALUE = 20_000n;
const PRAGMA = 'pragma solidcash ^0.14.0;';

/** One body `f`'s spend: the entry it writes, its arguments, and the node it rewrites. */
interface Spend {
  readonly members: string;
  readonly collection: string;
  readonly keys: readonly Uint8Array[];
  readonly args: Record<string, Uint8Array>;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
}

/** The ABI witnesses of a write that updates the node at `slot` in place. */
function updateWitness(name: string, slot: Uint8Array): Uint8Array | undefined {
  if (/^__internal__vmapBatchSlot_\d+$/.test(name)) return slot;
  if (/^__internal__vmapBatchProof_\d+$/.test(name)) return encodeIntegerValue(1n);
  if (/^__internal__vmapBatchNext_\d+$/.test(name)) return ZERO_SLOT;
  if (/^__internal__vmapBatchPredOut_\d+$/.test(name)) return encodeIntegerValue(-1n);
  if (name === '__internal__vmapBatchTrailingCount' || name === '__internal__valueChunkOutputBase'
    || /^__internal__(valueWitness|leadingPushValue)_\d+$/.test(name)) return EMPTY;
  return undefined;
}

/** Verifies every input of `f`'s spend with `e` as its expected-value argument. */
function settle(artifact: Artifact, spend: Spend, e: Uint8Array): true | string {
  const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
  const lock = encodeLockingBytecodeP2sh32(hash256(redeem));
  const collection = artifact.stateLayout!.collections!.find((candidate) => candidate.name === spend.collection)!;
  // A direct contract's node covenant names the master's lock (CRYPTO-4).
  const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(CATEGORY,
    computeCollectionHash(collection.signature), lock));
  const entryLock = encodeLockingBytecodeP2sh32(hash256(entryRedeem));
  const slot = keyToSlotMulti([...spend.keys]);
  const inputs = artifact.abi.find((candidate) => candidate.name === 'f')!.inputs;
  const pushes = inputs.map((input) => {
    const value = input.name === 'e' ? e : spend.args[input.name] ?? updateWitness(input.name, slot);
    if (value === undefined) throw new Error(`no value for '${input.name}'`);
    return value;
  }).reverse();
  const token = (capability: 'minting' | 'mutable', commitment: Uint8Array): VmOutput['token'] =>
    ({ category: CATEGORY, amount: 0n, nft: { capability, commitment } });
  const outpoint = (index: number): Uint8Array => distinctBytes(32, 0x80 + index);
  const transaction: VmTransaction = {
    version: 2,
    locktime: 0,
    inputs: [
      {
        outpointIndex: 0, outpointTransactionHash: outpoint(0), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...pushes.flatMap((push) => [...encodeDataPush(push)]), ...encodeDataPush(redeem),
        ]),
      },
      {
        outpointIndex: 0, outpointTransactionHash: outpoint(1), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(EMPTY), ...encodeDataPush(encodeIntegerValue(1n)), ...encodeDataPush(entryRedeem),
        ]),
      },
      { outpointIndex: 0, outpointTransactionHash: outpoint(2), sequenceNumber: 0xffffffff, unlockingBytecode: EMPTY },
    ],
    outputs: [
      { lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting', EMPTY) },
      { lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', spend.after) },
      { lockingBytecode: FUNDER_LOCK, valueSatoshis: 90_000n },
    ],
  };
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    { lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting', EMPTY) },
    { lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', spend.before) },
    { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n },
  ];
  return createVirtualMachineBch2026().verify({ sourceOutputs, transaction });
}

const ID = encodeIntegerValue(7n);
const J = encodeIntegerValue(3n);
const USER = distinctBytes(20, 0x44);
const HELD = distinctBytes(4, 0x15);
const ADDED = distinctBytes(4, 0x3c);
const THIRD = distinctBytes(4, 0x61);
const YES = encodeIntegerValue(1n);
const num = (value: bigint): Uint8Array => encodeIntegerValue(value);

/** A node at `keys` holding `tail`, the end of its list. */
const nodeAt = (keys: readonly Uint8Array[], tail: Uint8Array): Uint8Array =>
  encodeEntryCommitment(keyToSlotMulti([...keys]), ZERO_SLOT, tail);
/** The `logs[ID]` node holding `kinds`, in the shipped encoding. */
const logsNode = (kinds: readonly Uint8Array[]): Uint8Array =>
  nodeAt([ID], encodeChunkableValueTail(encodePushdataValue([...kinds], 'bytes4[]')));
/** A two-field struct's node tail: each field as a minimal push. */
const pairOf = (a: bigint, b: bigint): Uint8Array =>
  encodeChunkableValueTail(new Uint8Array([a, b].flatMap((field) => [...encodeDataPush(encodeIntegerValue(field))])));
/** An `int[]` node tail. */
const intsOf = (values: readonly bigint[]): Uint8Array =>
  encodeChunkableValueTail(encodePushdataValue([...values], 'int[]'));

const LOGS = ' mapping(uint => bytes4[]) logs;';
const PAIR = ' struct Pair { uint a; uint b; }';

interface Served extends Spend {
  readonly name: string;
  /** The value the EVM's read sees, and the one it does not. */
  readonly right: Uint8Array;
  readonly wrong: Uint8Array;
}

/** `logs[ID]` from one element to two by a push of `ADDED`. */
const PUSHED = {
  collection: 'logs', keys: [ID], args: { id: ID, k: ADDED },
  before: logsNode([HELD]), after: logsNode([HELD, ADDED]), right: num(2n), wrong: num(1n),
} as const;

const SERVED: readonly Served[] = [
  {
    ...PUSHED,
    name: 'the length a push left',
    members: `${LOGS} function f(uint id, bytes4 k, uint e) { this.logs[id].push(k);`
      + ' require(this.logs[id].length == e); }',
  },
  {
    name: 'the length a pop left',
    members: `${LOGS} function f(uint id, uint e) { this.logs[id].pop(); require(this.logs[id].length == e); }`,
    collection: 'logs', keys: [ID], args: { id: ID },
    before: logsNode([HELD, ADDED, THIRD]), after: logsNode([HELD, ADDED]), right: num(2n), wrong: num(3n),
  },
  {
    name: 'the empty array a delete left',
    members: `${LOGS} function f(uint id, uint e) { delete this.logs[id]; require(this.logs[id].length == e); }`,
    collection: 'logs', keys: [ID], args: { id: ID },
    before: logsNode([HELD, ADDED]), after: logsNode([]), right: num(0n), wrong: num(2n),
  },
  {
    name: 'the element an element write left',
    members: `${LOGS} function f(uint id, bytes4 k, bytes4 e) { this.logs[id][0] = k;`
      + ' require(this.logs[id][0] == e); }',
    collection: 'logs', keys: [ID], args: { id: ID, k: ADDED },
    before: logsNode([HELD, THIRD]), after: logsNode([ADDED, THIRD]), right: ADDED, wrong: HELD,
  },
  {
    name: 'the element a whole-value write left',
    members: `${LOGS} function f(uint id, bytes4[] kinds, bytes4 e) { this.logs[id] = kinds;`
      + ' require(this.logs[id][0] == e); }',
    collection: 'logs', keys: [ID], args: { id: ID, kinds: encodePushdataValue([ADDED, THIRD], 'bytes4[]') },
    before: logsNode([HELD]), after: logsNode([ADDED, THIRD]), right: ADDED, wrong: HELD,
  },
  {
    name: 'the element a whole int[] write left under a bytes20 key',
    members: ' mapping(bytes20 => int[]) scores; function f(bytes20 user, int[] values, int e) {'
      + ' this.scores[user] = values; require(this.scores[user][0] == e); }',
    collection: 'scores', keys: [USER], args: { user: USER, values: encodePushdataValue([9n], 'int[]') },
    before: nodeAt([USER], intsOf([4n])), after: nodeAt([USER], intsOf([9n])), right: num(9n), wrong: num(4n),
  },
  {
    name: 'the field a whole struct write left',
    members: `${PAIR} mapping(uint => Pair) pairs; function f(uint id, uint v, uint e) {`
      + ' this.pairs[id] = Pair(v, 1); require(this.pairs[id].a == e); }',
    collection: 'pairs', keys: [ID], args: { id: ID, v: num(11n) },
    before: nodeAt([ID], pairOf(3n, 0n)), after: nodeAt([ID], pairOf(11n, 1n)), right: num(11n), wrong: num(3n),
  },
  {
    name: 'the field a whole struct write left in a nested mapping',
    members: `${PAIR} mapping(uint => mapping(uint => Pair)) grid; function f(uint id, uint j, uint v, uint e) {`
      + ' this.grid[id][j] = Pair(v, 1); require(this.grid[id][j].a == e); }',
    collection: 'grid', keys: [ID, J], args: { id: ID, j: J, v: num(11n) },
    before: nodeAt([ID, J], pairOf(3n, 0n)), after: nodeAt([ID, J], pairOf(11n, 1n)), right: num(11n),
    wrong: num(3n),
  },
  {
    ...PUSHED,
    name: 'the length a push left, in a branch arm after it',
    members: `${LOGS} function f(uint id, bytes4 k, bool b, uint e) { this.logs[id].push(k);`
      + ' if (b) { require(this.logs[id].length == e); } }',
    args: { id: ID, k: ADDED, b: YES },
  },
  {
    ...PUSHED,
    name: 'the length a push left, in a loop after it',
    members: `${LOGS} function f(uint id, bytes4 k, uint e) { this.logs[id].push(k);`
      + ' for (uint i = 0; i < 2; i++) { require(this.logs[id].length == e); } }',
  },
  {
    ...PUSHED,
    name: 'the length a helper\'s push left',
    members: `${LOGS} function _push(uint id, bytes4 k) internal { this.logs[id].push(k); }`
      + ' function f(uint id, bytes4 k, uint e) { _push(id, k); require(this.logs[id].length == e); }',
  },
  {
    ...PUSHED,
    name: 'the length a push left, keyed by a local',
    members: `${LOGS} function f(uint id, bytes4 k, uint e) { uint j = id; this.logs[j].push(k);`
      + ' require(this.logs[j].length == e); }',
  },
  {
    ...PUSHED,
    name: 'the length before a push in a branch arm',
    members: `${LOGS} function f(uint id, bytes4 k, bool b, uint e) { require(this.logs[id].length == e);`
      + ' if (b) { this.logs[id].push(k); } }',
    args: { id: ID, k: ADDED, b: YES }, right: num(1n), wrong: num(2n),
  },
  {
    ...PUSHED,
    name: 'the length two pushes left, which the entry cache serves',
    members: `${LOGS} function f(uint id, bytes4 k, uint e) { this.logs[id].push(k); this.logs[id].push(k);`
      + ' require(this.logs[id].length == e); }',
    after: logsNode([HELD, ADDED, ADDED]), right: num(3n),
  },
  {
    name: 'a scalar write, which the entry cache serves',
    members: ' mapping(uint => uint) totals; function f(uint id, uint v, uint e) { this.totals[id] = v;'
      + ' require(this.totals[id] == e); }',
    collection: 'totals', keys: [ID], args: { id: ID, v: num(11n) },
    before: nodeAt([ID], num(3n)), after: nodeAt([ID], num(11n)), right: num(11n), wrong: num(3n),
  },
  {
    name: 'a nested scalar write, which the entry cache serves',
    members: ' mapping(uint => mapping(uint => uint)) grid; function f(uint id, uint j, uint v, uint e) {'
      + ' this.grid[id][j] = v; require(this.grid[id][j] == e); }',
    collection: 'grid', keys: [ID, J], args: { id: ID, j: J, v: num(11n) },
    before: nodeAt([ID, J], num(3n)), after: nodeAt([ID, J], num(11n)), right: num(11n), wrong: num(3n),
  },
  {
    name: 'an array element two writes left, which the entry cache serves',
    members: ' uint[8] scores; function f(uint id, uint v, uint e) { this.scores[id] = this.scores[id] + v;'
      + ' this.scores[id] = this.scores[id] + v; require(this.scores[id] == e); }',
    collection: 'scores', keys: [ID], args: { id: ID, v: num(4n) },
    before: nodeAt([ID], num(3n)), after: nodeAt([ID], num(11n)), right: num(11n), wrong: num(3n),
  },
  {
    name: 'a struct field write, which the entry cache serves',
    members: `${PAIR} mapping(uint => Pair) pairs; function f(uint id, uint v, uint e) { this.pairs[id].a = v;`
      + ' require(this.pairs[id].a == e); }',
    collection: 'pairs', keys: [ID], args: { id: ID, v: num(11n) },
    before: nodeAt([ID], pairOf(3n, 5n)), after: nodeAt([ID], pairOf(11n, 5n)), right: num(11n), wrong: num(3n),
  },
];

describe('a direct body that reads a mapping entry after writing it', () => {
  for (const shape of SERVED) {
    it(`reads ${shape.name}: the EVM's value is accepted, the other refused`, () => {
      const artifact = compileString(`${PRAGMA} contract Probe {${shape.members} }`, { messageBus: false });
      expect(settle(artifact, shape, shape.right)).toBe(true);
      expect(settle(artifact, shape, shape.wrong)).toContain('Program failed an OP_VERIFY operation');
    });
  }
});

const readOf = (entry: string, shape: string): string => `a read of \`${entry}\` after its write ${shape} is not `
  + 'supported on the direct convention: read it before the write, or into a local';

/** The stale-read refusal a direct contract with `members` draws, or undefined when it compiles. */
function refusal(members: string): string | undefined {
  try {
    compileString(`${PRAGMA} contract Refused {${LOGS} mapping(uint => uint) totals;${members} }`,
      { messageBus: false });
    return undefined;
  } catch (error) {
    if (error instanceof DirectStaleReadError) return error.message;
    throw error;
  }
}

const REFUSED: readonly { readonly shape: string; readonly members: string; readonly message: string }[] = [
  {
    shape: 'a read after the branch arm that pushed',
    members: ' function f(uint id, bytes4 k, bool b, uint e) { if (b) { this.logs[id].push(k); }'
      + ' require(this.logs[id].length == e); }',
    message: readOf('logs[id]', 'in a branch arm'),
  },
  {
    shape: 'a read in the arm that pushed',
    members: ' function f(uint id, bytes4 k, bool b, uint e) { if (b) { this.logs[id].push(k);'
      + ' require(this.logs[id].length == e); } }',
    message: readOf('logs[id]', 'in a branch arm'),
  },
  {
    shape: 'a read in the code an early return nests',
    members: ' function f(uint id, bytes4 k, uint e) { if (id == 0) { return; } this.logs[id].push(k);'
      + ' require(this.logs[id].length == e); }',
    message: readOf('logs[id]', 'in the code after an early return'),
  },
  {
    shape: 'a read after a write in a loop',
    members: ' function f(uint[] ks, uint v) { for (uint i = 0; i < ks.length; i++) {'
      + ' this.totals[ks[i]] = v; require(this.totals[ks[i]] == v); } }',
    message: readOf('totals[ks[i]]', 'in a loop'),
  },
  {
    shape: 'a read of an entry an expression keys',
    members: ' function f(uint id, bytes4 k, uint e) { this.logs[id + 1].push(k);'
      + ' require(this.logs[id + 1].length == e); }',
    message: readOf('logs[id + 1]', 'with an expression key'),
  },
  {
    shape: 'a read of an entry a reassigned name keys',
    members: ' function f(uint id, uint v, uint e) { id = id + 1; this.totals[id] = v;'
      + ' require(this.totals[id] == e); }',
    message: readOf('totals[id]', 'with a reassigned key'),
  },
  {
    shape: 'a read of an array element a reassigned name keys',
    members: ' uint[8] scores; function f(uint id, uint v, uint e) { id = id + 1; this.scores[id] = v;'
      + ' this.scores[id] = this.scores[id] + v; require(this.scores[id] == e); }',
    message: readOf('scores[id]', 'with a reassigned key'),
  },
  {
    shape: 'a read between two writes of the entry',
    members: ' function f(uint id, bytes4[] kinds, uint e) { this.logs[id] = kinds;'
      + ' require(this.logs[id].length == e); this.logs[id] = kinds; }',
    message: readOf('logs[id]', 'when the body writes it again'),
  },
  {
    shape: 'a push after a whole write of the entry',
    members: ' function f(uint id, bytes4 k, bytes4[] kinds) { this.logs[id] = kinds; this.logs[id].push(k); }',
    message: 'a push on `logs[id]` after its write when the body writes it again is not supported on the direct '
      + 'convention: update a local and write the entry once',
  },
];

describe('a direct read of a mapping entry after a write the body does not keep', () => {
  for (const { shape, members, message } of REFUSED) {
    it(`refuses ${shape}, naming the entry and the shape`, () => {
      expect(refusal(members)).toContain(message);
    });
  }

  it('leaves the framed convention to its own refusal', () => {
    expect(() => compileString(`${PRAGMA} contract Refused {${LOGS}${REFUSED[0].members} }`,
      { composition: 'framed' })).toThrow('is not supported on the framed convention');
  });
});

describe('the entry cache beside a local named like a collection', () => {
  it('leaves the local array its own element writes', () => {
    const artifact = compileString(`${PRAGMA} contract Shadowed { uint[8] scores; function f(int i, int e) {`
      + ' int[] scores = new int[](4); scores[i] = 1; scores[i] = scores[i] + 1; require(scores[i] == e); }'
      + ' function g(uint id, uint v) { this.scores[id] = v; require(true); } }', { messageBus: false });
    expect(artifact.abi.find((entry) => entry.name === 'f')?.entryAccesses ?? []).toEqual([]);
  });
});
