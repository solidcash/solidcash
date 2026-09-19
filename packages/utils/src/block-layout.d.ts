import type { BlockLayoutSlot, BlockSlotKind, FunctionBlockLayout } from './artifact.js';
/** Slots which exist only in the output coordinate space and therefore do not advance input coordinates. */
export declare const OUTPUT_ONLY_BLOCK_SLOT_KINDS: ReadonlySet<BlockSlotKind>;
export declare function isOutputOnlyBlockSlot(slot: Pick<BlockLayoutSlot, 'kind'>): boolean;
/** Translate a block-relative output/layout coordinate to the corresponding compact input coordinate. */
export declare function blockInputOffset(layout: Pick<FunctionBlockLayout, 'blockSize' | 'slots'>, offset: number): number;
/** Number of physical inputs occupied by a layout after output-only coordinates are projected away. */
export declare function blockInputSize(layout: Pick<FunctionBlockLayout, 'blockSize' | 'slots'>): number;
