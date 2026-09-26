import { binToHex } from '@bitauth/libauth';
import type { AbiFunction } from '@solidcash/utils';

/**
 * A missing target does not necessarily require a separate predecessor output: its proof may be another active
 * target in the same batch. That target's fixed output already recreates the predecessor, so PredOut stays -1.
 */
export function isPendingBatchPredecessor(
  fn: Pick<AbiFunction, 'inputs' | 'sortedBatchInfo'>,
  params: readonly unknown[],
  slotIndex: number,
  predecessorCommitment: string,
): boolean {
  const value = (name: string): unknown => params[fn.inputs.findIndex((input) => input.name === name)];
  const selectedTarget = value(`__internal__vmapBatchSlot_${slotIndex}`);
  if (value(`__internal__vmapBatchPredOut_${slotIndex}`) !== -1n
    || predecessorCommitment.length < 128
    || !(selectedTarget instanceof Uint8Array) || selectedTarget.length !== 32) return false;
  const batch = fn.sortedBatchInfo?.find((candidate) => candidate.slotIndices.includes(slotIndex));
  if (!batch) return false;
  const proofSlot = predecessorCommitment.slice(0, 64).toLowerCase();
  return !batch.slotIndices.some((targetIndex) => {
    if (value(`__internal__vmapBatchPredOut_${targetIndex}`) === -2n) return false;
    const target = value(`__internal__vmapBatchSlot_${targetIndex}`);
    return target instanceof Uint8Array && target.length === 32 && binToHex(target) === proofSlot;
  });
}
