import { describe, expect, it } from 'vitest';
import { encodeIntegerValue } from '@solidcash/utils';
import { bytesToSlotValue, keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import { deployFramedMaster, evaluateMasterSpend, node, spent, type PlacedRecord } from './record-spend.js';

/**
 * A framed write a branch guards, held in a nested block.
 *
 * A write the entry cache does not take (a single plain `m[k] = v`) stays where the source puts it, and the
 * if-conversion leaves a branch alone whose arm holds a block rather than the write itself. The walk that gives a
 * guarded sorted write its "ran" flag stepped over a nested block statement, so `if (c) { { m[a] = x; } }`, or a branch
 * inside a `{ ... }` scope, got no flag: where `c` is false nothing bound the node, and the frame could declare it
 * rewritten to any value. The walk now enters a nested block, so the batch transition keeps the node where the flag
 * stays clear (`emitFramedKeptBatchTarget`). A write an `unchecked` block holds was already reached and stays so.
 * Each verdict is the BCH-2026 machine's on the master's own input.
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
const LEDGER = deployFramedMaster(`${PRAGMA} contract Ledger { mapping(uint => uint) balances;`
  + ' function put(uint a, uint b, uint x, bool c) { if (c) { { balances[a] = x; } } balances[b] -= x; }'
  + ' function wrap(uint a, uint b, uint x, bool c) {'
  + ' { if (c) { require(x > 0); balances[a] = x; } } balances[b] -= x; }'
  + ' function tick(uint a, uint b, uint x, bool c) { if (c) { unchecked { balances[a] = x; } } balances[b] -= x; }'
  + ' }', 'nested block guarded write');

type Key = 'a' | 'b';
type Entry = 'put' | 'wrap' | 'tick';
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
const LOCK = LEDGER.collectionLock('balances');

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

/** The pushes of `(a, b, x, c)`, deepest parameter first. */
const accepts = (entry: Entry, c: Uint8Array, after: Record<Key, bigint>): boolean =>
  evaluateMasterSpend(LEDGER, { entry, args: [c, X, KEY_B, KEY_A], records: updates(entry, after) }).accepted;

describe('a framed write a branch guards, held in a nested block', () => {
  it.each<Entry>(['put', 'wrap', 'tick'])('%s: keeps the skipped node and settles the taken write', (entry) => {
    // Before the walk entered the block, `put` and `wrap` accepted this: no flag stayed clear to bind the node.
    expect(accepts(entry, NO, { a: 99n, b: 42n })).toBe(false);
    expect(accepts(entry, NO, { a: 50n, b: 42n })).toBe(true);
    expect(accepts(entry, YES, { a: 8n, b: 42n })).toBe(true);
    // The write site refuses a node declared kept where the write ran.
    expect(accepts(entry, YES, { a: 50n, b: 42n })).toBe(false);
  });

  it('publishes the condition the nested write runs under', () => {
    const activation = (entry: Entry, key: Key): unknown => LEDGER.artifact.abi.find((fn) => fn.name === entry)!
      .entryAccesses!.find((access) => access.keyParams[0] === key)?.activation;
    for (const entry of ['put', 'tick'] as const) {
      expect(activation(entry, 'a')).toStrictEqual({ kind: 'source', source: { kind: 'forward', paramIndex: 3 } });
      expect(activation(entry, 'b')).toBeUndefined();
    }
  });
});
