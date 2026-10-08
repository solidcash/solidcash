import { binsAreEqual } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;

export type ComputedValueChunkRun = { id: string; collection: string; slot?: Uint8Array };

/** Register one continuation family per known entry in this state owner's builder. */
export function appendComputedValueChunkRun(
  runs: ComputedValueChunkRun[], collection: string, slot?: Uint8Array,
): void {
  // Several routed write lanes may alias one concrete entry. Unknown keys must remain separate
  // discoveries, and equal keys in different collections identify different resources.
  if (slot && runs.some((run) => run.collection === collection
    && run.slot && binsAreEqual(run.slot, slot))) return;
  runs.push({ id: `${collection}#${runs.length}`, collection, ...(slot && { slot: slot.slice() }) });
}
