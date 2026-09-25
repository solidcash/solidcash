/**
 * Claims 3 and 4: insert (trailing new node + predecessor relinked in place) and update in place.
 *
 * Spec: docs/per-call/SPEC_PER_CALL_TRANSACTION.md
 *   1459 - mapping node row: "Insert: a new node as a trailing output, and the predecessor relinked in place |
 *          In place; slot and next kept";
 *   1495-1497 - "A node created in the transaction can be relinked or updated by later frames."
 * Doc: packages/solidc/docs/verified-mappings.md 5.1 (update), 5.2 (insert).
 */
import { describe, it, expect } from 'vitest';
import { utf8ToBin } from '@bitauth/libauth';
import { SortedList, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { ZERO_SLOT, entryCommitment, entryUtxo, headUtxo, splitCommitment, valueOf } from './fixtures.js';

const KEYS = ['balances-0', 'balances-1', 'balances-2'].map((name) => utf8ToBin(name));
const NEW_KEY = utf8ToBin('balances-new');

function seed(): { list: SortedList; slots: Uint8Array[] } {
  const slots = KEYS.map((key) => keyToSlot(key)).sort((a, b) => (valueOf(a) < valueOf(b) ? -1 : 1));
  const list = SortedList.fromUtxos([
    headUtxo('00'.repeat(32), slots[0]),
    entryUtxo('01'.repeat(32), entryCommitment(slots[0], slots[1], new Uint8Array([0x01]))),
    entryUtxo('02'.repeat(32), entryCommitment(slots[1], slots[2], new Uint8Array([0x02]))),
    entryUtxo('03'.repeat(32), entryCommitment(slots[2], ZERO_SLOT, new Uint8Array([0x03]))),
  ]);
  return { list, slots };
}

describe('section 20 insert and update', () => {
  it('insert relinks the predecessor in place and mints the new node as a trailing output (SPEC:1459)', () => {
    const { list } = seed();
    const newSlot = keyToSlot(NEW_KEY);
    const predecessor = list.predecessorOf(newSlot);
    const oldNext = predecessor.nextKey;

    const plan = list.planInsert(newSlot, new Uint8Array([0x2a]));
    // Predecessor: same slot and same value, `next` re-pointed at the new node.
    const predOut = splitCommitment(plan.predNewCommitment);
    expect(predOut.slot).toEqual(predecessor.slot);
    expect(predOut.value).toEqual(predecessor.value);
    expect(predOut.next).toEqual(newSlot);
    // New node: `[k | oldSuccessor | newValue]` - the old successor is preserved, never skipped.
    const newNode = splitCommitment(plan.newNodeCommitment);
    expect(newNode.slot).toEqual(newSlot);
    expect(newNode.next).toEqual(oldNext);
    expect(newNode.value).toEqual(new Uint8Array([0x2a]));

    // The batch form emits every affected node exactly once, in ascending slot order, so the new node is a
    // trailing output after the in-place predecessor rewrite.
    const batch = list.planBatchUpsert([{ slot: newSlot, value: new Uint8Array([0x2a]) }]);
    const predIndex = batch.outputs.findIndex((out) => valueOf(out.slot) === valueOf(predecessor.slot));
    const newIndex = batch.outputs.findIndex((out) => valueOf(out.slot) === valueOf(newSlot));
    expect(predIndex).toBeGreaterThanOrEqual(0);
    expect(newIndex).toBeGreaterThan(predIndex);
    expect(batch.outputs[newIndex].existed).toBe(false);
    expect(batch.outputs[predIndex].existed).toBe(true);
    expect(splitCommitment(batch.outputs[predIndex].commitment).next).toEqual(newSlot);
    expect(splitCommitment(batch.outputs[newIndex].commitment).next).toEqual(oldNext);
    expect(batch.outputs.filter((out) => valueOf(out.slot) === valueOf(newSlot))).toHaveLength(1);
  });

  it('update rewrites the value in place and keeps slot and next (SPEC:1459; verified-mappings 5.1)', () => {
    const { list, slots } = seed();
    const target = slots.find((slot) => valueOf(slot) === valueOf(keyToSlot(KEYS[1])))!;
    const before = list.find(target)!;
    const newValue = new Uint8Array([0x7f, 0x01, 0x02]);

    const plan = list.planUpdate(target, newValue);
    const after = splitCommitment(plan.newCommitment);
    expect(after.slot).toEqual(before.slot);      // slot kept
    expect(after.next).toEqual(before.nextKey);   // link kept
    expect(after.value).toEqual(newValue);        // only the value may change

    // The batch form keeps the same node (existed) at the same slot, still linked to its successor.
    const batch = list.planBatchUpsert([{ slot: target, value: newValue }]);
    const out = batch.outputs.find((candidate) => valueOf(candidate.slot) === valueOf(target))!;
    expect(out.existed).toBe(true);
    expect(splitCommitment(out.commitment).next).toEqual(before.nextKey);
    expect(splitCommitment(out.commitment).value).toEqual(newValue);
  });
});
