import { describe, expect, it } from 'vitest';
import { encodeIntegerValue, type RecordEntry } from '@solidcash/utils';
import { bytesToSlotValue, keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import {
  deployFramedMaster, evaluateMasterSpend, head, node, spent, type PlacedRecord,
} from './record-spend.js';

/**
 * A framed batch whose write a `delete` of another key of its mapping follows: swap-and-pop's
 * `m[last] = v; delete m[k]`, which an enumerable set's `remove` makes.
 *
 * Where the two keys meet at run time the EVM's delete wins, and the write is a no-op the body's alias gate skips.
 * A framed master admits the pair as an ordinary batch whose write may be declared skipped: its group is then the
 * kept predecessor of the key, the delete alone rewrites the node, and the two targets' slot operands may agree
 * (`emitFramedDistinctBatchTargets` passes a pair one of whose targets is skipped). Where the keys differ both
 * writes settle, a skipped declaration of the write is refused by its own update-only proof, and where they meet a
 * frame that declares the write as written is refused for naming one node twice. Each verdict is the BCH-2026
 * machine's on the master's own input.
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
const SWAP = deployFramedMaster(`${PRAGMA} contract Swap { mapping(uint => uint) m;`
  + ' function swap(uint a, uint b, uint x) { m[a] = x; delete m[b]; }'
  + ' }', 'swap remove alias');

type Key = 'a' | 'b';
const n = (value: bigint): Uint8Array => encodeIntegerValue(value);
const slotOf = (key: Uint8Array): Uint8Array => keyToSlotMulti([key]);
/** Two keys, `A` the one with the lower slot: the list `head -> A -> B`. */
const [KEY_A, KEY_B] = bytesToSlotValue(slotOf(n(3n))) < bytesToSlotValue(slotOf(n(5n)))
  ? [n(3n), n(5n)] : [n(5n), n(3n)];
const SLOT_A = slotOf(KEY_A);
const SLOT_B = slotOf(KEY_B);
const X = n(8n);
const ZERO = new Uint8Array(32);
const EMPTY = new Uint8Array(0);
const LOCK = SWAP.collectionLock('m');

/** The nodes of the list `head -> A -> B`, each holding `value`. */
const nodeA = (value: bigint): Uint8Array => node(SLOT_A, SLOT_B, n(value));
const nodeB = (value: bigint): Uint8Array => node(SLOT_B, ZERO, value === 0n ? EMPTY : n(value));

/** The params `swap` writes in the order its frame declares their groups: the order of their slots. */
const groupOrder = (): Key[] => [...SWAP.artifact.abi.find((fn) => fn.name === 'swap')!.entryAccesses!]
  .sort((left, right) => left.slotIndex! - right.slotIndex!)
  .map((access) => access.keyParams[0] as Key);

interface Spend { readonly records: PlacedRecord[]; readonly declared?: RecordEntry[] }

/** The write's group and the delete's, each one record spent at its own input, in their declared order. */
const spend = (write: PlacedRecord, remove: PlacedRecord): Spend => ({
  records: groupOrder().map((key) => (key === 'a' ? write : remove)),
});

/** The pushes of `(a, b, x)`, deepest parameter first; the contract's one entry takes no selector. */
const accepts = (a: Uint8Array, b: Uint8Array, records: Spend): boolean =>
  evaluateMasterSpend(SWAP, { args: [X, b, a], ...records }).accepted;

describe('a framed swap-remove pair: a write a delete of another key follows', () => {
  it('admits the pair and settles both writes where the keys differ', () => {
    expect(SWAP.artifact.composition?.refusedEntries ?? []).toStrictEqual([]);
    expect(accepts(KEY_A, KEY_B, spend(spent(LOCK, 2, nodeA(50n), nodeA(8n)), spent(LOCK, 3, nodeB(50n), nodeB(0n)))))
      .toBe(true);
  });

  it('settles the write skipped where the keys meet, the delete winning as on the EVM', () => {
    // The write's group keeps the key's predecessor, `A`'s node; the delete rewrites `B`'s.
    expect(accepts(KEY_B, KEY_B, spend(spent(LOCK, 2, nodeA(50n)), spent(LOCK, 3, nodeB(50n), nodeB(0n)))))
      .toBe(true);
    // The same node declared written by both: the write's 8 the delete then clears.
    const written = spent(LOCK, 3, nodeB(50n), nodeB(0n));
    const declared: RecordEntry[] = groupOrder().map((key) => (key === 'a'
      ? { in: 3, out: 3, viewIn: nodeB(50n), viewOut: nodeB(8n) }
      : { in: 3, out: 3, viewIn: nodeB(8n), viewOut: nodeB(0n) }));
    expect(accepts(KEY_B, KEY_B, { records: [written], declared })).toBe(false);
  });

  it('refuses the write declared skipped where the keys differ, which its update-only proof names', () => {
    // The head kept as the predecessor of `A`, the write's key, which the body does rewrite.
    expect(accepts(KEY_A, KEY_B, spend(spent(LOCK, 2, head(SLOT_A)), spent(LOCK, 3, nodeB(50n), nodeB(0n)))))
      .toBe(false);
  });
});
