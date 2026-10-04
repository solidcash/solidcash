import { describe, expect, it } from 'vitest';
import { encodeIntegerValue, type RecordEntry } from '@solidcash/utils';
import { bytesToSlotValue, keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import {
  created, deployPerCallMaster, evaluateMasterSpend, head, node, spent, type PlacedRecord,
} from './record-spend.js';

/**
 * A per-call batch one of whose writes a branch guards, beside a write of the same collection that runs.
 *
 * `if (c) { balances[a] -= x; } balances[b] -= x` is one batch of two targets, and the entry cache leaves each write a
 * flush its dirty flag guards. Where `c` is false the first flush does not run, yet the second sets the batch's ran
 * flag, so the frame accepted the first target's node rewritten to any value: the batch held only its links. A
 * per-call batch target a branch guards now carries its own ran flag, and where that stays clear the batch transition
 * binds its group (`emitPerCallKeptBatchTarget`): the node keeps the value its proof began with, relinked only as the
 * batch's checks admit, and no node is created for the key. Beside a plain write, which leaves the batch no flag at
 * all, the guarded node is bound the same way. Each verdict is the BCH-2026 machine's on the master's own input.
 */

const PRAGMA = 'pragma solidcash ^0.13.0;';
const LEDGER = deployPerCallMaster(`${PRAGMA} contract Ledger { mapping(uint => uint) balances;`
  + ' function debit(uint a, uint b, uint x, bool c) { if (c) { balances[a] -= x; } balances[b] -= x; }'
  + ' function credit(uint a, uint b, uint x, bool c) { if (c) { balances[a] += x; } balances[b] += x; }'
  + ' function set(uint a, uint b, uint x, bool c) { if (c) { balances[a] -= x; } balances[b] = x; }'
  + ' }', 'guarded batch target');

type Key = 'a' | 'b';
const n = (value: bigint): Uint8Array => encodeIntegerValue(value);
const slotOf = (key: Uint8Array): Uint8Array => keyToSlotMulti([key]);
/** Two keys, `a` the one with the lower slot: a list holding only `a`'s node splices `b` in after it. */
const [KEY_A, KEY_B] = bytesToSlotValue(slotOf(n(3n))) < bytesToSlotValue(slotOf(n(5n)))
  ? [n(3n), n(5n)] : [n(5n), n(3n)];
const SLOT: Record<Key, Uint8Array> = { a: slotOf(KEY_A), b: slotOf(KEY_B) };
const X = n(8n);
const YES = n(1n);
const NO = n(0n);
const ZERO = new Uint8Array(32);
const EMPTY = new Uint8Array(0);
const NONE = 0xffff;
const LOCK = LEDGER.collectionLock('balances');

/** The key's node in the list `a -> b`, holding `value`. */
const held = (key: Key, value: bigint): Uint8Array => node(SLOT[key], key === 'a' ? SLOT.b : ZERO, n(value));

/**
 * The keys an entry's targets write, in the order its frame declares their groups: the order of their slots, which
 * the entry cache's reads set for a read-modify-write.
 */
const targetKeys = (entry: string): Key[] => LEDGER.artifact.abi.find((fn) => fn.name === entry)!.entryAccesses!
  .filter((access) => access.operations.includes('write'))
  .sort((left, right) => left.slotIndex! - right.slotIndex!)
  .map((access) => access.keyParams[0] as Key);

interface Spend { readonly records: PlacedRecord[]; readonly declared?: RecordEntry[] }

/** Each key's node at its own input, rewritten from `before` to `after`, in the entry's group order. */
const updates = (entry: string, before: Record<Key, bigint>, after: Record<Key, bigint>): Spend => ({
  records: targetKeys(entry).map((key, at) => spent(LOCK, 2 + at, held(key, before[key]), held(key, after[key]))),
});

/**
 * `a`'s node, the list's only one, relinked to `b` and left holding `value`, beside `b`'s node created holding 8.
 * `b`'s group declares `a`'s node again as its predecessor, so the node's first declaration starts from the view it
 * is spent with and a later one from the relinked view.
 */
const spliced = (value: bigint): Spend => {
  const start = node(SLOT.a, ZERO, n(50n));
  const relinked = node(SLOT.a, SLOT.b, n(value));
  const inserted = node(SLOT.b, ZERO, X);
  const declared: RecordEntry[] = [];
  const atA = (): RecordEntry => ({ in: 2, out: 2, viewIn: declared.length === 0 ? start : relinked, viewOut: relinked });
  for (const key of targetKeys('credit')) {
    declared.push(atA());
    if (key === 'b') declared.push({ in: NONE, out: 3, viewIn: EMPTY, viewOut: inserted });
  }
  return { records: [spent(LOCK, 2, start, relinked), created(LOCK, 3, inserted)], declared };
};

/** Both keys spliced into the empty list through its head: `a`'s node holding `value`, `b`'s holding 8. */
const bothInserted = (value: bigint): Spend => {
  const relinked = head(SLOT.a);
  const [first, second] = targetKeys('credit').map((key) => (key === 'a' ? held('a', value) : held('b', 8n)));
  return {
    records: [spent(LOCK, 2, head(), relinked), created(LOCK, 3, first!), created(LOCK, 4, second!)],
    declared: [
      { in: 2, out: 2, viewIn: head(), viewOut: relinked }, { in: NONE, out: 3, viewIn: EMPTY, viewOut: first! },
      { in: 2, out: 2, viewIn: relinked, viewOut: relinked }, { in: NONE, out: 4, viewIn: EMPTY, viewOut: second! },
    ],
  };
};

/** The pushes of `(a, b, x, c)`, deepest parameter first. */
const args = (c: Uint8Array): Uint8Array[] => [c, X, KEY_B, KEY_A];

const accepts = (entry: string, c: Uint8Array, spend: Spend): boolean =>
  evaluateMasterSpend(LEDGER, { entry, args: args(c), ...spend }).accepted;

describe('a per-call batch one of whose writes a branch guards, beside a write that runs', () => {
  it('keeps the guarded node where its arm is not taken, and refuses a value the code did not compute', () => {
    expect(accepts('debit', NO, updates('debit', { a: 50n, b: 50n }, { a: 50n, b: 42n }))).toBe(true);
    // Before the binding the frame accepted this: the write that ran set the batch's flag, which bound no node.
    expect(accepts('debit', NO, updates('debit', { a: 50n, b: 50n }, { a: 99n, b: 42n }))).toBe(false);
    expect(accepts('debit', YES, updates('debit', { a: 50n, b: 50n }, { a: 42n, b: 42n }))).toBe(true);
    expect(accepts('debit', YES, updates('debit', { a: 50n, b: 50n }, { a: 50n, b: 42n }))).toBe(false);
  });

  it('binds the guarded node beside a plain write, which sets no batch flag', () => {
    expect(accepts('set', NO, updates('set', { a: 50n, b: 50n }, { a: 50n, b: 8n }))).toBe(true);
    // Before the binding the frame accepted this: no flag of the batch stayed clear to bind the node.
    expect(accepts('set', NO, updates('set', { a: 50n, b: 50n }, { a: 99n, b: 8n }))).toBe(false);
    expect(accepts('set', YES, updates('set', { a: 50n, b: 50n }, { a: 42n, b: 8n }))).toBe(true);
  });

  it('keeps the guarded node\'s value where the other key\'s insert relinks it', () => {
    expect(accepts('credit', NO, spliced(50n))).toBe(true);
    expect(accepts('credit', NO, spliced(99n))).toBe(false);
    expect(accepts('credit', YES, spliced(58n))).toBe(true);
  });

  it('refuses a node created for the key whose write did not run, whatever it holds', () => {
    expect(accepts('credit', YES, bothInserted(8n))).toBe(true);
    expect(accepts('credit', NO, bothInserted(0n))).toBe(false);
    expect(accepts('credit', NO, bothInserted(8n))).toBe(false);
  });
});
