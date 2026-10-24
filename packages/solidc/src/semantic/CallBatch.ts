import { FunctionDefinitionNode, FunctionModifier } from '../ast/AST.js';

/**
 * A direct callee's multi-call entry: one spend of its master runs several state-preserving calls, each frame
 * settling its own call record under its ordinal (docs/wip/call-records/DESIGN.md, section 3).
 */

/** The multi-call entry's reserved dispatch selector, 0x53434442. */
export const CALL_BATCH_SELECTOR_HEX = '53434442';

export const CALL_BATCH_SELECTOR = Uint8Array.of(0x53, 0x43, 0x44, 0x42);

/** A frame entry's hidden witness: how far past their layout slots its fixed entry inputs sit. Standalone: 0. */
export const CALL_BATCH_ROW_SHIFT = '__internal__rowEntryShift';

/** A frame entry's call context, popped from the alternate stack: its frame ordinal, or -1 when standalone. */
export const CALL_BATCH_CONTEXT = '__internal__callContext';

/**
 * The share of the per-input limit a contract leaves its spends when it carries the entry. A multi-call spend
 * pushes every frame's arguments, and a script grown to the limit leaves its other spends no room for theirs.
 */
export const CALL_BATCH_INPUT_RESERVE_FRACTION = 0.1;

const FRAME_MODIFIERS = new Set<FunctionModifier>([
  FunctionModifier.PUBLIC, FunctionModifier.EXTERNAL, FunctionModifier.VIEW, FunctionModifier.PURE,
  FunctionModifier.OVERRIDE, FunctionModifier.VIRTUAL,
]);

const FRAME_SLOT_KINDS = new Set(['master', 'dataNft', 'entry', 'returnEvent']);

/**
 * True when `fn` can run as a frame of the multi-call entry: a returning direct entry that preserves all state,
 * whose block holds only its master, data records, fixed read-only entries and its return carrier, and which takes
 * no value, delegate, external read or call, event, transfer, deploy, side-car or runtime-located input.
 */
export function isCallBatchFrameCandidate(fn: FunctionDefinitionNode, writesState: () => boolean): boolean {
  if (!fn.isEntryPoint || fn.returnTypes.length === 0 || fn.isFallback || fn.isReceive) return false;
  if (fn.graphEmissionHandler || fn.messageBusRoute === true || fn.name.startsWith('__')) return false;
  if (!fn.modifiers.every((modifier) => FRAME_MODIFIERS.has(modifier))) return false;
  if ((fn.externalCalls?.length ?? 0) > 0 || (fn.externalReads?.length ?? 0) > 0
    || (fn.externalOutStateReads?.length ?? 0) > 0 || (fn.lowLevelCalls?.length ?? 0) > 0
    || (fn.libraryDelegateCalls?.length ?? 0) > 0 || fn.hasContractInstantiation === true) return false;
  if ((fn.transferInfos?.length ?? 0) > 0 || (fn.tokenContainerAccesses?.length ?? 0) > 0
    || (fn.emitInfos?.length ?? 0) > 0 || fn.keccakCompute === true || fn.ecrecoverCompute === true) return false;
  if ((fn.sortedBatchInfo?.length ?? 0) > 0 || (fn.collectionIterations?.length ?? 0) > 0
    || (fn.dynamicReads?.length ?? 0) > 0 || (fn.dynamicWrites?.length ?? 0) > 0) return false;
  if (!(fn.entryAccesses ?? []).every((access) => !access.inLoop
    && access.operations.every((operation) => operation === 'read'))) return false;
  if (fn.parameters.some((parameter) => parameter.name.startsWith('__internal__')
    && parameter.name !== '__internal__returnOutputIdx')) return false;
  return fn.blockLayout !== undefined
    && fn.blockLayout.slots.every((slot) => FRAME_SLOT_KINDS.has(slot.kind)) && !writesState();
}
