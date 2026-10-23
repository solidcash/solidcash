import { describe, expect, it } from 'vitest';
import { encodeIntegerValue, type RecordEntry } from '@solidcash/utils';
import { bytesToSlotValue, keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import {
  created, deployFramedMaster, evaluateMasterSpend, head, node, spent, type PlacedRecord,
} from './record-spend.js';

/**
 * A framed batch two of whose write targets name one entry at run time.
 *
 * `balances[a] -= x; balances[b] -= x` is one batch of two targets. Each target reads the first view its write segment
 * declares for the node its proof names, and an update closes against the last view the segment declares there, so
 * with `a == b` a frame that declared the node once per target settled one debit where the EVM debits twice, and two
 * inserts of one key created two nodes, each a value a later read could prove. The master compares the targets' slot
 * operands pairwise where the batch ran (`emitFramedDistinctBatchTargets`), as the direct convention's dense rows do
 * by their strict order. Distinct keys, distinct inserts through one predecessor and a conditional batch that did not
 * run still settle. Each verdict is the BCH-2026 machine's on the master's own input.
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
const LEDGER = deployFramedMaster(`${PRAGMA} contract Ledger { mapping(uint => uint) balances;`
  + ' function debit(uint a, uint b, uint x) { balances[a] -= x; balances[b] -= x; }'
  + ' function credit(uint a, uint b, uint x) { balances[a] += x; balances[b] += x; }'
  + ' function set(uint a, uint b, uint x, uint y) { balances[a] = x; balances[b] = y; }'
  + ' function maybeDebit(uint a, uint b, uint x, bool c) { if (c) { balances[a] -= x; balances[b] -= x; } }'
  + ' }', 'aliased batch targets');

type Key = 'a' | 'b';
const n = (value: bigint): Uint8Array => encodeIntegerValue(value);
const A = n(3n);
const B = n(5n);
const X = n(8n);
const Y = n(9n);
const YES = n(1n);
const NO = n(0n);
const ZERO = new Uint8Array(32);
const EMPTY = new Uint8Array(0);
const NONE = 0xffff;
const SLOT: Record<Key, Uint8Array> = { a: keyToSlotMulti([A]), b: keyToSlotMulti([B]) };
const [LOWER, UPPER] = bytesToSlotValue(SLOT.a) < bytesToSlotValue(SLOT.b) ? [SLOT.a, SLOT.b] : [SLOT.b, SLOT.a];
const LOCK = LEDGER.collectionLock('balances');

/** A node's successor in the list `LOWER -> UPPER`. */
const nextOf = (slot: Uint8Array): Uint8Array => (slot === LOWER ? UPPER : ZERO);

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
  records: targetKeys(entry).map((key, at) => spent(LOCK, 2 + at,
    node(SLOT[key], nextOf(SLOT[key]), n(before[key])), node(SLOT[key], nextOf(SLOT[key]), n(after[key])))),
});

/** One node at input 2, declared once per target: from the first view through the second to the third. */
const oneNodeTwice = ([first, second, third]: readonly Uint8Array[]): Spend => ({
  records: [spent(LOCK, 2, first!, third!)],
  declared: [{ in: 2, out: 2, viewIn: first!, viewOut: second! }, { in: 2, out: 2, viewIn: second!, viewOut: third! }],
});

/** Two inserts through the empty list's head: each group the head relinked to `lowest`, then the node it creates. */
const twoInserts = (nodes: readonly Uint8Array[], lowest: Uint8Array): Spend => {
  const relinked = head(lowest);
  return {
    records: [spent(LOCK, 2, head(), relinked), created(LOCK, 3, nodes[0]!), created(LOCK, 4, nodes[1]!)],
    declared: [
      { in: 2, out: 2, viewIn: head(), viewOut: relinked }, { in: NONE, out: 3, viewIn: EMPTY, viewOut: nodes[0]! },
      { in: 2, out: 2, viewIn: relinked, viewOut: relinked }, { in: NONE, out: 4, viewIn: EMPTY, viewOut: nodes[1]! },
    ],
  };
};

/** The key's node holding `value` at the tail of the list. */
const held = (value: bigint): Uint8Array => node(SLOT.a, ZERO, n(value));

const accepts = (entry: string, args: Uint8Array[], spend: Spend): boolean =>
  evaluateMasterSpend(LEDGER, { entry, args, ...spend }).accepted;

describe('a framed batch two of whose targets name one entry at run time', () => {
  it('settles two debits of distinct keys and refuses a value the code did not compute', () => {
    expect(accepts('debit', [X, B, A], updates('debit', { a: 50n, b: 50n }, { a: 42n, b: 42n }))).toBe(true);
    expect(accepts('debit', [X, B, A], updates('debit', { a: 50n, b: 50n }, { a: 42n, b: 43n }))).toBe(false);
  });

  it('refuses one node declared for both debits of one key, whichever value it ends at', () => {
    // Before the check the frame accepted the first: one debit, 42, where the EVM debits twice to 34.
    expect(accepts('debit', [X, A, A], oneNodeTwice([held(50n), held(42n), held(42n)]))).toBe(false);
    expect(accepts('debit', [X, A, A], oneNodeTwice([held(50n), held(42n), held(34n)]))).toBe(false);
  });

  it('settles two inserts of distinct keys through one predecessor, and refuses two nodes for one key', () => {
    const credited = targetKeys('credit').map((key) => node(SLOT[key], nextOf(SLOT[key]), n(8n)));
    expect(accepts('credit', [X, B, A], twoInserts(credited, LOWER))).toBe(true);
    // Before the check the frame accepted two nodes at the key, each holding one credit, where the EVM's holds two.
    expect(accepts('credit', [X, A, A], twoInserts([held(8n), held(8n)], SLOT.a))).toBe(false);
  });

  it('refuses two writes of one key whatever values they leave, beside distinct keys that settle', () => {
    expect(accepts('set', [Y, X, B, A], updates('set', { a: 50n, b: 50n }, { a: 8n, b: 9n }))).toBe(true);
    // Before the check the frame accepted two nodes at the key holding 8 and 9, for a later read to choose from.
    const written: Record<Key, bigint> = { a: 8n, b: 9n };
    expect(accepts('set', [Y, X, A, A], twoInserts(targetKeys('set').map((key) => held(written[key])), SLOT.a)))
      .toBe(false);
    // The frame cannot tell the second write of the node from the first, so equal values are refused as well; the
    // builder's own plan refuses a batch that writes one slot twice before anything is signed.
    expect(accepts('set', [X, X, A, A], oneNodeTwice([held(50n), held(8n), held(8n)]))).toBe(false);
  });

  it('settles a conditional batch on one key where it did not run, and refuses it where it ran', () => {
    expect(accepts('maybeDebit', [NO, X, A, A], oneNodeTwice([held(50n), held(50n), held(50n)]))).toBe(true);
    expect(accepts('maybeDebit', [YES, X, A, A], oneNodeTwice([held(50n), held(42n), held(42n)]))).toBe(false);
    expect(accepts('maybeDebit', [YES, X, B, A], updates('maybeDebit', { a: 50n, b: 50n }, { a: 42n, b: 42n })))
      .toBe(true);
  });
});
