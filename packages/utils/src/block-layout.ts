import type { BlockLayoutSlot, BlockSlotKind, FunctionBlockLayout } from './artifact.js';

/** Slots which exist only in the output coordinate space and therefore do not advance input coordinates. */
export const OUTPUT_ONLY_BLOCK_SLOT_KINDS: ReadonlySet<BlockSlotKind> = new Set([
  'transfer', 'tcTransfer', 'event', 'eventChunk', 'returnEvent', 'deployDataNft',
]);

export function isOutputOnlyBlockSlot(slot: Pick<BlockLayoutSlot, 'kind'>): boolean {
  return OUTPUT_ONLY_BLOCK_SLOT_KINDS.has(slot.kind);
}

/**
 * Slots in the unified front-region auxiliary co-spend band. These sit between the contract's own data NFTs and
 * the effect tail, in one canonical compiler order; the SDK co-spend driver iterates the emitted blockLayout
 * slots in this same order so input/output indices stay 1:1. External read/call groups reserve offset space
 * without a slot kind and are not listed here.
 */
export const AUXILIARY_BLOCK_SLOT_KINDS: ReadonlySet<BlockSlotKind> = new Set([
  'lowLevelCall', 'readOnlyDataNft', 'blockhashOracle', 'blockInfoOracle', 'keccakSideCar', 'ecrecoverSideCar',
]);

export function isAuxiliaryBlockSlot(slot: Pick<BlockLayoutSlot, 'kind'>): boolean {
  return AUXILIARY_BLOCK_SLOT_KINDS.has(slot.kind);
}

/** Translate a block-relative output/layout coordinate to the corresponding compact input coordinate. */
export function blockInputOffset(layout: Pick<FunctionBlockLayout, 'blockSize' | 'slots'>, offset: number): number {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= layout.blockSize) {
    throw new Error(`Block-layout offset ${offset} is outside [0, ${layout.blockSize})`);
  }
  const duplicate = layout.slots.filter((slot) => slot.offset === offset);
  if (duplicate.length > 1) throw new Error(`Block-layout offset ${offset} is claimed by multiple slots`);
  return offset - layout.slots.filter((slot) => slot.offset < offset && isOutputOnlyBlockSlot(slot)).length;
}

/** Number of physical inputs occupied by a layout after output-only coordinates are projected away. */
export function blockInputSize(layout: Pick<FunctionBlockLayout, 'blockSize' | 'slots'>): number {
  return layout.blockSize - layout.slots.filter(isOutputOnlyBlockSlot).length;
}
