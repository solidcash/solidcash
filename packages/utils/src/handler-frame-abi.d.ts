/**
 * Typed handler-frame ABI for DEFINE'd message-bus handlers (backlog item 3).
 *
 * Frame layout (bottom → top at entry after caller band seeding):
 *   arguments | route context | journals | cursors | results
 *
 * Helpers declare stack-effect signatures; validateHandlerFrame proves entry/exit
 * shape agreement and rejects live anonymous / untracked cells at settlement.
 */
export type FrameSlotKind = 'argument' | 'routeContext' | 'journal' | 'cursor' | 'result' | 'trackedTemp';
export interface FrameSlot {
    name: string;
    kind: FrameSlotKind;
}
export interface HandlerFrameSchema {
    handlerId: string;
    handlerName?: string;
    slots: readonly FrameSlot[];
}
/** Net stack delta: positive = pushes, negative = pops. */
export interface StackEffectSignature {
    helperId: string;
    /** Named slots consumed from the frame (must exist). */
    reads?: readonly string[];
    /** Named slots written/replaced. */
    writes?: readonly string[];
    /** Anonymous / untracked cells pushed (must be zero at settlement). */
    anonymousPushes?: number;
    /** Anonymous cells popped. */
    anonymousPops?: number;
    /** Alt-stack net delta (must return to 0 at settlement). */
    altStackDelta?: number;
}
export interface FrameValidationFailure {
    invariantId: string;
    detail: string;
    slot?: string;
}
export interface FrameValidationResult {
    ok: boolean;
    failures: readonly FrameValidationFailure[];
    /** Live anonymous cell count after applying effects. */
    anonymousLive: number;
    altStackDepth: number;
}
export declare function buildHandlerFrameSchema(params: {
    handlerId: string;
    handlerName?: string;
    arguments: readonly string[];
    routeContext?: readonly string[];
    journals?: readonly string[];
    cursors?: readonly string[];
    results?: readonly string[];
}): HandlerFrameSchema;
/**
 * Symbolically apply stack-effect signatures against a frame schema.
 * Fails closed on unknown slot reads/writes, leftover anonymous cells, or alt-stack imbalance.
 */
export declare function validateHandlerFrame(schema: HandlerFrameSchema, effects: readonly StackEffectSignature[]): FrameValidationResult;
