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
  | 'PER_CALL_MAPPING_UNPLANNABLE';

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

/** A resumed run filled no witness at its stop site. */
export function derivationStalled(frame: FrameRequest, site: StopSite): PerCallComposerError {
  return new PerCallComposerError(
    'PER_CALL_DERIVATION_STALLED',
    `master "${frame.master}" of ${frame.functionName} filled no witness at site ${site.site} `
    + `(${describeStopSite(site)})`,
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
 * A node the mapping plan must declare has no coordinate in the layout: an input to spend it at, or an output to
 * recreate or create it at. Which side is missing decides the message.
 */
export function mappingIndexUnavailable(slot: Uint8Array, side: 'input' | 'output'): PerCallComposerError {
  return new PerCallComposerError(
    'PER_CALL_MAPPING_UNPLANNABLE',
    `the mapping node at slot ${bytesToHex(slot)} needs an ${side} index the layout gives it none of`,
  );
}
