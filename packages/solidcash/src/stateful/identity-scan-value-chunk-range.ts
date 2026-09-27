import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  ownsCapturedValueChunkOutputBase,
  refreshCapturedValueChunkOutputBase,
} from './value-chunk-base-writer-select.js';
import {
  valueChunkWriteResourceIdentity,
  type DerivedChunkOutputObservation,
} from './value-chunk-persist.js';

/** Allocate a discovered identity-scanned run without consuming another resource's authenticated coordinates. */
export function identityScanValueChunkOutputBase(
  preferredBase: number,
  count: number,
  resourceIdentity: string,
  observations: ReadonlyMap<number, DerivedChunkOutputObservation>,
): number {
  if (!Number.isSafeInteger(preferredBase) || preferredBase < 0
    || !Number.isSafeInteger(count) || count <= 0) {
    throw new Error('An identity-scanned continuation requires a nonnegative base and a positive width.');
  }
  // Repeated probes retain this resource's allocation. A different writer's earlier provisional witness
  // cannot reclaim it merely because both probes originally saw the same append coordinate.
  const ownStart = [...observations].find(([, chunk]) => (
    chunk.resourceIdentity === resourceIdentity && chunk.resourcePart === 'chunk:0'
  ))?.[0];
  let base = ownStart ?? preferredBase;
  for (;;) {
    const start = base;
    const conflicts = [...observations].filter(([index, chunk]) => (
      index >= start && index < start + count && chunk.resourceIdentity !== resourceIdentity
    ));
    if (conflicts.length === 0) return base;
    if (ownStart !== undefined) {
      throw new Error('An authenticated continuation range overlaps another resource.');
    }
    base = Math.max(...conflicts.map(([index]) => index)) + 1;
  }
}

/** Publish one allocation to the physical writer and its proxy/delegate aliases before materialization. */
export function publishIdentityScanValueChunkRange(
  carriers: readonly ExternalCallUtxoGroup[],
  resourceIdentity: string,
  base: number,
  count: number,
): boolean {
  let changed = false;
  for (const carrier of new Set(carriers)) {
    if (carrier.valueChunkOutputBase !== base || carrier.valueChunkOutputCount !== count
      || (ownsCapturedValueChunkOutputBase(carrier)
        && carrier.internalArgs?.__internal__valueChunkOutputBase !== BigInt(base))) changed = true;
    carrier.valueChunkOutputCount = count;
    carrier.valueChunkWrites = carrier.valueChunkWrites?.map((write) => (
      valueChunkWriteResourceIdentity(write) === resourceIdentity
        ? { ...write, outputBase: base, outputCount: count } : write
    ));
    refreshCapturedValueChunkOutputBase(carrier, base, { shiftPredOut: false });
    // Logical proxy aliases also describe the range, even when only their implementation encodes the witness.
    carrier.valueChunkOutputBase = base;
  }
  return changed;
}
