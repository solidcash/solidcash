import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import {
  encodeArgumentList, encodeIntegerValue, encodeWitnessBlock, type Artifact, type PublishedWriteSegment,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { bytesToSlotValue, keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import { compositionMachine } from '../machine.js';
import { eventOutput } from './event-input.js';
import {
  declarationOf, deployFramedMaster, masterSpendProgram, MASTER_INDEX, node, spent, USER_INDEX, USER_LOCK,
  type PlacedRecord,
} from './record-spend.js';

/**
 * Writes, emits and transfers a nested scope holds, as the walks that place them reach them.
 *
 * An `unchecked { }` block and a bare `{ }` block (a source scope, an inlined helper's body) run their statements in
 * place, so every walk that places a write, an emit or a transfer has to enter them. The per-write segment walk
 * stepped over an `unchecked` block, so a body whose mapping write sits in one published no per-write segments,
 * and the batch segment walk with it, so such a write before a call was refused outright. The code generator's
 * pre-allocation walks (mapping slots, state write keys, emits, token container transfers) stepped over a nested
 * block, so a branch arm's write held in one was not pre-allocated beside the arm's other effects. Each walk now
 * enters both. Each verdict below is the BCH-2026 machine's on the master's own input.
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
const PING = 'interface IOther { function ping(); } contract Other { function ping() { require(true); } }';
const OTHER = '0x' + '11'.repeat(31) + 'ee';
const CALL = `IOther(${OTHER}).ping.call();`;

/** One ledger whose entries make the same call and write, with and without an `unchecked` block around the write. */
const CALLER = compileStringMulti(`${PRAGMA}${PING}`
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + `   function uncheckedFirst(address to, uint amount) { unchecked { balances[to] = amount; } ${CALL} require(true); }`
  + `   function plainFirst(address to, uint amount) { balances[to] = amount; ${CALL} require(true); }`
  + `   function uncheckedLast(address to, uint amount) { ${CALL} unchecked { balances[to] = amount; } require(true); }`
  + `   function plainLast(address to, uint amount) { ${CALL} balances[to] = amount; require(true); }`
  + ' }', { composition: 'framed' }).Ledger!;

/** The single segment and the per-write segments one entry publishes beside its stop sites. */
function publishedWrites(
  artifact: Pick<Artifact, 'composition'>,
  entryName: string,
): { readonly single?: number | 'last'; readonly writes?: readonly PublishedWriteSegment[] } {
  const entry = artifact.composition?.stopSites?.entries
    .find((candidate) => candidate.functionName === `Ledger.${entryName}()`);
  return {
    ...(entry?.writeSegment === undefined ? {} : { single: entry.writeSegment }),
    ...(entry?.writeSegments === undefined ? {} : { writes: entry.writeSegments }),
  };
}

/** The segment the entry publishes for its write to `balances`, or undefined when it publishes none. */
const balancesSegment = (entryName: string): number | 'last' | undefined => publishedWrites(CALLER, entryName)
  .writes?.find((write) => write.collection === 'balances')?.segment;

describe('a mapping write an unchecked block holds beside a call', () => {
  it('serves every entry', () => {
    expect(CALLER.composition?.refusedEntries ?? []).toStrictEqual([]);
  });

  it('publishes the segment the frame opens with for a write before the call', () => {
    // Before the walks entered the block, the batch's segment was unstated and the call followed the write, so the
    // entry was refused as a write the call does not precede.
    expect(balancesSegment('uncheckedFirst')).toBe(0);
    expect(publishedWrites(CALLER, 'uncheckedFirst')).toStrictEqual(publishedWrites(CALLER, 'plainFirst'));
  });

  it('publishes the segment the call opens for a write after the call', () => {
    // Before, the write was no step of the walk, so the entry published no per-write segments at all.
    expect(balancesSegment('uncheckedLast')).toBe(1);
    expect(publishedWrites(CALLER, 'uncheckedLast')).toStrictEqual(publishedWrites(CALLER, 'plainLast'));
  });
});

/** A ledger whose branch emits and writes a node, the two held in a nested block or written in the arm itself. */
const LEDGER = deployFramedMaster(`${PRAGMA} contract Ledger { mapping(uint => uint) balances;`
  + ' event Moved(uint value);'
  + ' function nested(uint a, uint b, uint x, bool c) {'
  + ' if (c) { { emit Moved(x); balances[a] = x; } } balances[b] -= x; }'
  + ' function flat(uint a, uint b, uint x, bool c) {'
  + ' if (c) { emit Moved(x); balances[a] = x; } balances[b] -= x; }'
  + ' }', 'nested scope walks');

type Key = 'a' | 'b';
type Entry = 'nested' | 'flat';
const n = (value: bigint): Uint8Array => encodeIntegerValue(value);
const slotOf = (key: Uint8Array): Uint8Array => keyToSlotMulti([key]);
/** Two keys, `a` the one with the lower slot, so the list runs `a -> b`. */
const [KEY_A, KEY_B] = bytesToSlotValue(slotOf(n(3n))) < bytesToSlotValue(slotOf(n(5n)))
  ? [n(3n), n(5n)] : [n(5n), n(3n)];
const SLOT: Record<Key, Uint8Array> = { a: slotOf(KEY_A), b: slotOf(KEY_B) };
const X = n(8n);
const YES = n(1n);
const NO = n(0n);
const ZERO = new Uint8Array(32);
const EMPTY = new Uint8Array(0);
const LOCK = LEDGER.collectionLock('balances');
const SIGNATURE = LEDGER.artifact.events![0]!.signature;

/** The event's payload: the minimal push of the emitted value. */
const payload = (value: bigint): Uint8Array => encodeArgumentList([n(value)]);

/** The key's node in the list `a -> b`, holding `value`. */
const held = (key: Key, value: bigint): Uint8Array => node(SLOT[key], key === 'a' ? SLOT.b : ZERO, n(value));

/** The keys an entry's targets write, in the order its frame declares their groups: the order of their slots. */
const targetKeys = (entry: Entry): Key[] => LEDGER.artifact.abi.find((fn) => fn.name === entry)!.entryAccesses!
  .filter((access) => access.operations.includes('write'))
  .sort((left, right) => left.slotIndex! - right.slotIndex!)
  .map((access) => access.keyParams[0] as Key);

/** Each key's node at its own input, rewritten from 50 to `after`, in the entry's group order. */
const updates = (entry: Entry, after: Record<Key, bigint>): PlacedRecord[] =>
  targetKeys(entry).map((key, at) => spent(LOCK, 2 + at, held(key, 50n), held(key, after[key])));

/**
 * The machine's verdict on `(a, b, x, c)` with the records rewritten to `after` and the frame's one event output,
 * listed past the records, carrying `emitted`: the payload where the emit ran, the empty commitment where it did not.
 */
function settles(entry: Entry, c: Uint8Array, after: Record<Key, bigint>, emitted: Uint8Array): boolean {
  const records = updates(entry, after);
  const args = [c, X, KEY_B, KEY_A];
  const { sourceOutputs, transaction } = masterSpendProgram(LEDGER, { entry, args, records });
  const eventAt = transaction.outputs.length;
  const block: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: LEDGER.address,
    value: 0n,
    retval: EMPTY,
    calls: [],
    segments: [[...declarationOf(records)]],
    events: [eventAt],
    sends: [],
  };
  const selector = LEDGER.artifact.abi.find((fn) => fn.name === entry)!.selector!;
  const unlockingBytecode = new Uint8Array([
    ...encodeDataPush(encodeWitnessBlock(block)),
    ...encodeDataPush(new Uint8Array(Buffer.from(selector, 'hex'))),
    ...args.flatMap((arg) => [...encodeDataPush(arg)]),
    ...encodeDataPush(LEDGER.script),
  ]);
  const inputs = transaction.inputs
    .map((input, index) => (index === MASTER_INDEX ? { ...input, unlockingBytecode } : input));
  const outputs = [...transaction.outputs, eventOutput(LEDGER.category, SIGNATURE, emitted)];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction: { ...transaction, inputs, outputs } });
  return vm.stateSuccess(state) === true;
}

describe('a branch whose emit and mapping write a nested block holds', () => {
  it.each<Entry>(['nested', 'flat'])('%s: settles the taken arm with its event and both nodes', (entry) => {
    expect(settles(entry, YES, { a: 8n, b: 42n }, payload(8n))).toBe(true);
    // The event output carries the value the arm emitted, and the node the value the arm wrote.
    expect(settles(entry, YES, { a: 8n, b: 42n }, payload(9n))).toBe(false);
    expect(settles(entry, YES, { a: 50n, b: 42n }, payload(8n))).toBe(false);
  });

  it.each<Entry>(['nested', 'flat'])('%s: settles the skipped arm with its node kept', (entry) => {
    expect(settles(entry, NO, { a: 50n, b: 42n }, EMPTY)).toBe(true);
    // The skipped node stays bound, and the write past the branch still lands.
    expect(settles(entry, NO, { a: 99n, b: 42n }, EMPTY)).toBe(false);
    expect(settles(entry, NO, { a: 50n, b: 50n }, EMPTY)).toBe(false);
  });
});
