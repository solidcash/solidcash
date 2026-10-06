/**
 * Claim 5: `delete` writes the type default rather than unlinking the node.
 *
 * Spec: docs/framed/SPEC_FRAMED_TRANSACTION.md
 *   1459 - mapping node row: "Removed | Never unlinked: `delete` writes the default value".
 * Doc: packages/solidc/docs/verified-mappings.md 5.3 - "`delete m[k]` is encoded as an upsert of `default(V)` ...
 *   Nodes are not physically spliced out by ordinary source-level delete."
 * Compiler: GenerateTargetTraversal.ts:22995-23001 routes `delete m[k]` through the sorted upsert with the default
 *   value, and the `bool` value kind at :20826-20829 stores false as the empty tail (OP_BIN2NUM-normalized 0).
 */
import { describe, it, expect } from 'vitest';
import { utf8ToBin } from '@bitauth/libauth';
import { SortedList, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { compileString } from '../../direct-compile.js';
import { ZERO_SLOT, entryCommitment, entryUtxo, headUtxo, splitCommitment, valueOf, walkReachable } from './fixtures.js';

const KEYS = ['owner-0', 'owner-1', 'owner-2'].map((name) => utf8ToBin(name));

function seed(): { list: SortedList; slots: Uint8Array[] } {
  const slots = KEYS.map((key) => keyToSlot(key)).sort((a, b) => (valueOf(a) < valueOf(b) ? -1 : 1));
  const list = SortedList.fromUtxos([
    headUtxo('00'.repeat(31) + 'ff', slots[0]),
    entryUtxo('01'.repeat(31) + 'fe', entryCommitment(slots[0], slots[1], new Uint8Array([0x01]))),
    entryUtxo('02'.repeat(31) + 'fd', entryCommitment(slots[1], slots[2], new Uint8Array([0x01]))),
    entryUtxo('03'.repeat(31) + 'fc', entryCommitment(slots[2], ZERO_SLOT, new Uint8Array([0x01]))),
  ]);
  return { list, slots };
}

describe('section 20 delete-to-default', () => {
  it('delete m[k] compiles byte-identically to m[k] = <default> (SPEC:1459)', () => {
    // A bool set: delete == assign false, whose record tail is empty (the BIN2NUM script number 0).
    const boolDelete = compileString(
      'contract C { mapping(int=>bool) m; function f(int k) external { delete m[k]; require(true); } }',
    );
    const boolAssign = compileString(
      'contract C { mapping(int=>bool) m; function f(int k) external { m[k]=false; require(true); } }',
    );
    expect(boolDelete.debug!.bytecode).toBe(boolAssign.debug!.bytecode);

    // A value mapping: delete == assign the integer default 0.
    const intDelete = compileString(
      'contract C { mapping(int=>int) m; function f(int k) external { delete m[k]; require(true); } }',
    );
    const intAssign = compileString(
      'contract C { mapping(int=>int) m; function f(int k) external { m[k]=0; require(true); } }',
    );
    expect(intDelete.debug!.bytecode).toBe(intAssign.debug!.bytecode);
  });

  it('the delete upsert writes the default tail and preserves slot and next', () => {
    const { list, slots } = seed();
    const target = slots[1];
    const before = list.find(target)!;
    const defaultTail = new Uint8Array(); // false / 0 encode to the empty script number

    // Delete is the upsert of the type default (verified-mappings.md 5.3).
    const batch = list.planBatchUpsert([{ slot: target, value: defaultTail }]);
    const out = batch.outputs.find((candidate) => valueOf(candidate.slot) === valueOf(target))!;
    expect(out.existed).toBe(true); // updated in place, not removed
    const after = splitCommitment(out.commitment);
    expect(after.slot).toEqual(before.slot);    // slot kept
    expect(after.next).toEqual(before.nextKey); // link kept
    expect(after.value).toEqual(defaultTail);
    expect(out.commitment.length).toBe(64);
  });

  it('a source-level delete leaves the node in the reachable set (SPEC:1459)', () => {
    const { list, slots } = seed();
    const target = slots[1];
    const defaultTail = new Uint8Array();
    const batch = list.planBatchUpsert([{ slot: target, value: defaultTail }]);

    // Assemble the final record set independently: original nodes with the batch outputs applied.
    const finalNodes = list.all.map((entry) => {
      const rewritten = batch.outputs.find((out) => valueOf(out.slot) === valueOf(entry.slot));
      const commitment = rewritten ? rewritten.commitment : entryCommitment(entry.slot, entry.nextKey, entry.value);
      return splitCommitment(commitment);
    });
    const reachable = walkReachable(finalNodes.map((node) => ({ slot: node.slot, next: node.next })));

    // "Never unlinked": the default-valued node is still reachable from HEAD.
    expect(reachable.map((slot) => slot.toString())).toContain(valueOf(target).toString());
    // The predecessor still points at it, unchanged.
    const predecessor = list.predecessorOf(target);
    const predFinal = finalNodes.find((node) => valueOf(node.slot) === valueOf(predecessor.slot))!;
    expect(valueOf(predFinal.next)).toBe(valueOf(target));
  });

  it('the unused splice helper removes the node from the reachable set, unlike the delete path', () => {
    // `SortedList.planDelete` is a splice ("predecessor relinked to node.next"). It has no production caller:
    // every reference outside its definition is packages/solidcash/test/unit/SortedListSdk.test.ts, and the
    // documented delete semantics are the default upsert above. Recorded here so the divergence is explicit.
    const { list, slots } = seed();
    const target = slots[1];
    const node = list.find(target)!;
    const predecessor = list.predecessorOf(target);

    const plan = list.planDelete(target);
    const predOut = splitCommitment(plan.predNewCommitment);
    expect(predOut.slot).toEqual(predecessor.slot);
    expect(predOut.next).toEqual(node.nextKey); // unlinked: predecessor jumps over the node
    expect(predOut.value).toEqual(predecessor.value);

    const spliced = list.all
      .filter((entry) => valueOf(entry.slot) !== valueOf(target))
      .map((entry) => (valueOf(entry.slot) === valueOf(predecessor.slot)
        ? splitCommitment(plan.predNewCommitment)
        : splitCommitment(entryCommitment(entry.slot, entry.nextKey, entry.value))));
    const reachable = walkReachable(spliced.map((entry) => ({ slot: entry.slot, next: entry.next })));
    expect(reachable.map((slot) => slot.toString())).not.toContain(valueOf(target).toString());
  });
});
