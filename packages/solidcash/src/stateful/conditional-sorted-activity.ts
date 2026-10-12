/**
 * DS-6: a direct body whose conditional deletes each own a one-target sorted batch settles each one-target batch by
 * what ran, not behind a guard the spender controls (the compiler's `settlesSortedTargetsByActivity`). Both sides
 * read that shape from the published layout.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction } from '@solidcash/utils';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';

/** Whether the compiler settles this function's one-target sorted batches by what ran. */
export function settlesSortedTargetsByActivity(fn: AbiFunction | undefined): boolean {
  if (fn === undefined || fn.name.startsWith('__message_bus')
    || fn.inputs.some((input) => input.name === 'batchBlob')) return false;
  const batches = fn.sortedBatchInfo ?? [];
  const deletes = (fn.blockLayout?.slots ?? []).flatMap((slot) => (slot.kind === 'entry' && slot.softDelete === true
    && slot.slotIndex !== undefined && batches.some((batch) => batch.slotIndices.includes(slot.slotIndex!))
    ? [slot.slotIndex] : []));
  return deletes.length > 0 && deletes.every((slot) => batches.some((batch) => (
    batch.slotIndices.length === 1 && batch.slotIndices[0] === slot)));
}

/**
 * DS-6: the writes a guarded direct batch shares with a conditional delete (the compiler's `guardedBatchWriteSlots`).
 * The batch transition settles one only where it ran; elsewhere its slot keeps the node it spends.
 */
export function guardedBatchWriteSlots(fn: AbiFunction | undefined): Set<number> {
  if (fn === undefined || fn.name.startsWith('__message_bus') || fn.inputs.some((input) => input.name === 'batchBlob')
    || settlesSortedTargetsByActivity(fn)) return new Set();
  const slots = fn.blockLayout?.slots ?? [];
  const batches = fn.sortedBatchInfo ?? [];
  const entryWith = (slot: number, flag: 'conditional' | 'softDelete'): boolean => slots.some((layout) => (
    layout.kind === 'entry' && layout.slotIndex === slot && layout[flag] === true));
  if (!batches.every((batch) => batch.slotIndices.every((slot) => entryWith(slot, 'conditional')))
    || slots.find((layout) => layout.kind === 'entry' && layout.softDelete)?.slotIndex === undefined) return new Set();
  return new Set(batches.filter((batch) => batch.slotIndices.length > 1
    && batch.slotIndices.some((slot) => entryWith(slot, 'softDelete')))
    .flatMap((batch) => batch.slotIndices.filter((slot) => !entryWith(slot, 'softDelete'))));
}

/**
 * A conditional write of an activity-settled body whose arm did not run keeps the node its slot spends, and the
 * covenant counts that node alone: drop the predecessor relink its insert plan published, mark the write inactive
 * (-2) and narrow the batch trailing count. Returns whether the plan changed.
 */
export function dropSkippedConditionalInserts(
  builder: StatefulTransactionBuilder, fn: AbiFunction | undefined, finalArgs: unknown[],
): boolean {
  if (fn === undefined || !settlesSortedTargetsByActivity(fn)) return false;
  const position = (name: string): number => fn.inputs.findIndex((input) => input.name === name);
  const trailingAt = position('__internal__vmapBatchTrailingCount');
  let changed = false;
  for (const batch of fn.sortedBatchInfo ?? []) {
    if (batch.slotIndices.length !== 1) continue;
    const slotIndex = batch.slotIndices[0];
    const layout = fn.blockLayout?.slots.find((slot) => slot.kind === 'entry' && slot.slotIndex === slotIndex);
    if (layout?.softDelete === true) continue;
    const predOutAt = position(`__internal__vmapBatchPredOut_${slotIndex}`);
    const target = finalArgs[position(`__internal__vmapBatchSlot_${slotIndex}`)];
    const predOut = finalArgs[predOutAt];
    const trailing = finalArgs[trailingAt];
    if (typeof predOut !== 'bigint' || predOut < 0n || typeof trailing !== 'bigint'
      || !(target instanceof Uint8Array) || target.length !== 32) continue;
    // Only a write that did not run leaves its output equal to the node it spends.
    const kept = builder.getExistingEntryCommitment(slotIndex)?.toLowerCase();
    if (kept === undefined || kept.length < 128
      || builder.getEntryRawCommitment(slotIndex)?.toLowerCase() !== kept) continue;
    const relink = `${kept.slice(0, 64)}${binToHex(target)}${kept.slice(128)}`;
    const planned = builder.getLoopEntryCommitments(batch.collection);
    const at = planned.findIndex((commitment) => commitment.toLowerCase() === relink);
    if (at < 0) continue;
    const rest = planned.filter((_, index) => index !== at);
    if (builder.getRequiredLoopEntryCount(batch.collection) > 0) {
      builder.requireLoopEntryCount(batch.collection, rest.length);
    }
    builder.setLoopEntryCommitments(batch.collection, rest);
    finalArgs[predOutAt] = -2n;
    finalArgs[trailingAt] = trailing - 1n;
    changed = true;
  }
  return changed;
}
