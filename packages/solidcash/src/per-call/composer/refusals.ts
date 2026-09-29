/**
 * The composer's refusals.
 *
 * A pool that cannot cover what a composition needs, a derivation step that fills no witness, and a mapping write
 * the inventory or the layout cannot place. They are raised while the composition is derived, so nothing is laid
 * out, assembled or signed.
 */

import { bytesToHex, describeStopSite, type StopSite } from '@solidcash/utils';
import type { FrameRequest } from './derivation.js';

/** The refusal codes the composer raises before it builds anything. */
export type ComposerRefusalCode =
  | 'PER_CALL_POOL_EXHAUSTED'
  | 'PER_CALL_DERIVATION_STALLED'
  | 'PER_CALL_MAPPING_UNPLANNABLE'
  | 'PER_CALL_CHUNK_UNPLANNABLE'
  | 'PER_CALL_VIEW_UNLEARNED';

/** A refusal the composer raises before it builds anything. */
export class PerCallComposerError extends Error {
  public readonly name = 'PerCallComposerError';

  public constructor(
    public readonly code: ComposerRefusalCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
  }
}

/**
 * A contract was asked for more entries than its master pool holds. A master covers exactly one entry, so the
 * count is the entries the composition needs so far.
 */
export function masterPoolExhausted(contract: string, entriesNeeded: number, poolSize: number): PerCallComposerError {
  const noun = entriesNeeded === 1 ? 'entry' : 'entries';
  return new PerCallComposerError(
    'PER_CALL_POOL_EXHAUSTED',
    `contract "${contract}" needs ${entriesNeeded} master ${noun} but its pool holds ${poolSize}`,
  );
}

/**
 * A contract was asked for a validator and its pool has none left. This is the first root's category having no
 * validator, which no other contract's validator can cover, seen after a disjoint group took the last one.
 */
export function rootWithoutValidator(contract: string): PerCallComposerError {
  return new PerCallComposerError(
    'PER_CALL_POOL_EXHAUSTED',
    `contract "${contract}" roots this composition but has no validator`,
  );
}

/**
 * A derived composition still declares a view its plan left unstated and no run learned.
 *
 * The placeholder the composer declared in its place would reach the record's output, so the transaction would
 * write a value no code computed. The first few positions are named, as `master` / segment / entry.
 */
export function viewUnlearned(
  views: readonly { readonly master: string; readonly segmentIndex: number; readonly entryIndex: number }[],
): PerCallComposerError {
  const named = views.slice(0, 3).map((view) => `"${view.master}" segment ${view.segmentIndex} entry ${view.entryIndex}`);
  const more = views.length > 3 ? ` and ${views.length - 3} more` : '';
  return new PerCallComposerError(
    'PER_CALL_VIEW_UNLEARNED',
    `no run learned the view the plan left unstated at ${named.join(', ')}${more}, so its placeholder would reach `
    + 'the transaction',
  );
}

/**
 * A resumed run filled no witness at its stop site.
 *
 * A site whose calls repeat is the one case where the table describes the source rather than one execution: the
 * site is named once and the execution reaches it as often as the loop turns, so a run that has moved past the
 * witnesses the table lists stops here, and the refusal says which statement the driver's sequence ran out on.
 */
export function derivationStalled(frame: FrameRequest, site: StopSite): PerCallComposerError {
  const repeats = site.kind === 'call' && site.repeated === true
    ? ' (the call runs in a loop, so the published sites describe the source rather than this execution)'
    : '';
  return new PerCallComposerError(
    'PER_CALL_DERIVATION_STALLED',
    `master "${frame.master}" of ${frame.functionName} filled no witness at site ${site.site} `
    + `(${describeStopSite(site)})${repeats}`,
  );
}

/**
 * A mapping write needs a bracketing predecessor the inventory does not hold, so the node it creates cannot be
 * spliced between that predecessor and the successor the predecessor currently points at.
 */
export function mappingPredecessorMissing(slot: Uint8Array): PerCallComposerError {
  return new PerCallComposerError(
    'PER_CALL_MAPPING_UNPLANNABLE',
    `a mapping write targets slot ${bytesToHex(slot)} but its inventory holds no predecessor below it`,
  );
}

/**
 * A sorted batch writes one slot twice. The body's batch verifies each target once, so the two writes do not
 * compose into one transition; the plan is refused rather than keeping either value.
 */
export function mappingBatchRepeatsSlot(slot: Uint8Array): PerCallComposerError {
  return new PerCallComposerError(
    'PER_CALL_MAPPING_UNPLANNABLE',
    `a sorted batch writes slot ${bytesToHex(slot)} more than once`,
  );
}

/**
 * A segment writes again a mapping node it created. The writes one body makes to a collection are one sorted batch,
 * which decides every predecessor against the list it started from, so laying them out one after another declares
 * the node created twice.
 */
export function mappingBatchWritesCreatedNode(slot: Uint8Array): PerCallComposerError {
  return new PerCallComposerError(
    'PER_CALL_MAPPING_UNPLANNABLE',
    `the mapping node at slot ${bytesToHex(slot)} is written again in the segment that created it; plan the `
    + 'segment\'s writes as one sorted batch (planMappingBatch)',
  );
}

/** A long value's chunk has no output in the layout to be created at. */
export function mappingChunkOutputUnavailable(slot: Uint8Array, index: number): PerCallComposerError {
  return new PerCallComposerError(
    'PER_CALL_MAPPING_UNPLANNABLE',
    `value chunk ${index} of the mapping node at slot ${bytesToHex(slot)} needs an output index the layout `
    + 'gives it none of',
  );
}

/**
 * A node the mapping plan must declare has no coordinate in the layout: an input to spend it at, or an output to
 * recreate or create it at. Which side is missing decides the message.
 */
export function mappingIndexUnavailable(slot: Uint8Array, side: 'input' | 'output'): PerCallComposerError {
  return new PerCallComposerError(
    'PER_CALL_MAPPING_UNPLANNABLE',
    `the mapping node at slot ${bytesToHex(slot)} needs an ${side} index the layout gives it none of`,
  );
}

/**
 * A write to a dynamic value cannot be laid out as chunk records: the variable is not one of the layout's dynamic
 * variables, or the write changes how many chunks the value occupies.
 */
export function chunkRunUnplannable(variable: string, reason: string): PerCallComposerError {
  return new PerCallComposerError(
    'PER_CALL_CHUNK_UNPLANNABLE',
    `the dynamic value "${variable}" cannot be planned: ${reason}`,
  );
}
