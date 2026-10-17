/**
 * DS-6: a direct body whose conditional deletes each own a one-target sorted batch, or share one only with writes a
 * branch guards, settles each batch target by what ran, not behind a guard the spender controls (the compiler's
 * `settlesSortedTargetsByActivity`). Both sides read that shape from the published layout.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction } from '@solidcash/utils';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';

const entryLayout = (fn: AbiFunction, slot: number): { conditional?: boolean; softDelete?: boolean } | undefined => (
  fn.blockLayout?.slots.find((layout) => layout.kind === 'entry' && layout.slotIndex === slot));

/** Whether the compiler settles this function's sorted batch targets by what ran. */
export function settlesSortedTargetsByActivity(fn: AbiFunction | undefined): boolean {
  if (fn === undefined || fn.name.startsWith('__message_bus')
    || fn.inputs.some((input) => input.name === 'batchBlob')) return false;
  const softDelete = (slot: number): boolean => entryLayout(fn, slot)?.softDelete === true;
  // A write a shared batch settles alone: one a branch guards, with no alias of its own bar the batch's delete.
  // A swap-remove whose moved key is a state array's last keeps the guarded batch and its alias sentinel.
  const settlesAlone = (slot: number, targets: readonly number[]): boolean => {
    const access = fn.entryAccesses?.find((candidate, dense) => (candidate.slotIndex ?? dense) === slot);
    const owner = access?.aliasCondDeleteSlot;
    return entryLayout(fn, slot)?.conditional === true && access !== undefined
      && access.operations.includes('write') && !access.operations.includes('delete')
      && (owner === undefined || (targets.includes(owner)
        && !(access.keySources ?? []).some((source) => source.kind === 'stateArrayLast')))
      && (access.runtimeAliasPriorSlots?.length ?? 0) === 0;
  };
  const runtime = (collection: string): boolean => fn.inputs.some((input) => (
    input.name === `__internal__vmapRuntimeInputCount_${collection}`
    || input.name === `__internal__vmapRuntimeOutputCount_${collection}`));
  const batches = (fn.sortedBatchInfo ?? []).filter((batch) => batch.slotIndices.some(softDelete)
    || (batch.slotIndices.length === 1 && settlesAlone(batch.slotIndices[0], batch.slotIndices)));
  return batches.length > 0 && batches.every((batch) => batch.slotIndices.length === 1
    || (!runtime(batch.collection) && batch.slotIndices.every((slot) => (
      softDelete(slot) || settlesAlone(slot, batch.slotIndices)))));
}

/** DS-6: the writes an activity-settled body's sorted batches share with a conditional delete; each settles alone. */
export function activityBatchWriteSlots(fn: AbiFunction | undefined): Set<number> {
  if (fn === undefined || !settlesSortedTargetsByActivity(fn)) return new Set();
  const softDelete = (slot: number): boolean => entryLayout(fn, slot)?.softDelete === true;
  return new Set((fn.sortedBatchInfo ?? []).filter((batch) => (batch.slotIndices.length > 1
    && batch.slotIndices.some(softDelete)) || (batch.slotIndices.length === 1
      && entryLayout(fn, batch.slotIndices[0])?.conditional === true))
    .flatMap((batch) => batch.slotIndices.filter((slot) => !softDelete(slot))));
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
 * (-2), move later relinks up and narrow the batch trailing count. Returns whether the plan changed.
 */
export function dropSkippedConditionalInserts(
  builder: StatefulTransactionBuilder, fn: AbiFunction | undefined, finalArgs: unknown[],
): boolean {
  if (fn === undefined || !settlesSortedTargetsByActivity(fn)) return false;
  const position = (name: string): number => fn.inputs.findIndex((input) => input.name === name);
  const trailingAt = position('__internal__vmapBatchTrailingCount');
  const shared = activityBatchWriteSlots(fn);
  let changed = false;
  for (const batch of fn.sortedBatchInfo ?? []) {
    for (const slotIndex of batch.slotIndices) {
      if ((batch.slotIndices.length !== 1 && !shared.has(slotIndex))
        || entryLayout(fn, slotIndex)?.softDelete === true) continue;
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
      fn.inputs.forEach((input, index) => {
        const later = finalArgs[index];
        if (/^__internal__vmapBatchPredOut_\d+$/.test(input.name) && typeof later === 'bigint' && later > predOut) {
          finalArgs[index] = later - 1n;
        }
      });
      changed = true;
    }
  }
  return changed;
}
