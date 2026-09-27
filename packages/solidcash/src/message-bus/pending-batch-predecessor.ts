import { binToHex, hexToBin } from '@bitauth/libauth';
import type { AbiFunction } from '@solidcash/utils';

/** The shared predecessor links to the first active target in its original gap, not to each inserted key. */
export function batchPredecessorCommitment(
  fn: Pick<AbiFunction, 'inputs' | 'sortedBatchInfo'>,
  params: readonly unknown[],
  slotIndex: number,
  predecessorCommitment: string,
): string | undefined {
  if (predecessorCommitment.length < 128) return undefined;
  const batch = fn.sortedBatchInfo?.find((candidate) => candidate.slotIndices.includes(slotIndex));
  if (!batch) return undefined;
  const value = (name: string): unknown => params[fn.inputs.findIndex((input) => input.name === name)];
  const asNumber = (bytes: Uint8Array): bigint => bytes.reduceRight((n, byte) => (n << 8n) + BigInt(byte), 0n);
  const proofSlot = asNumber(hexToBin(predecessorCommitment.slice(0, 64)));
  const proofNext = asNumber(hexToBin(predecessorCommitment.slice(64, 128)));
  let next: Uint8Array | undefined;
  for (const targetIndex of batch.slotIndices) {
    if (value(`__internal__vmapBatchPredOut_${targetIndex}`) === -2n) continue;
    const target = value(`__internal__vmapBatchSlot_${targetIndex}`);
    if (!(target instanceof Uint8Array) || target.length !== 32) return undefined;
    const number = asNumber(target);
    // This proof is itself an active target: the fixed target output owns its recreation.
    if (number === proofSlot) return undefined;
    if (number > proofSlot && (proofNext === 0n || number < proofNext)
      && (next === undefined || number < asNumber(next))) next = target;
  }
  return next === undefined ? undefined
    : `${predecessorCommitment.slice(0, 64)}${binToHex(next)}${predecessorCommitment.slice(128)}`;
}

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
