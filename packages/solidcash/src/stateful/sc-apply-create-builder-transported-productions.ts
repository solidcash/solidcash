/**
 * phase-boundary extract: SC _createBuilder extract — apply transported value-chunk productions
 * onto the active delegate carrier before STB construction.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import {
  VALUE_CHUNK_SIZE,
  VALUE_HEAD_SIZE,
  sha256 as sha256Sync,
  type Artifact,
} from '@solidcash/utils';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  buildTransportedContinuationResourceClaim,
  orderTransportedContinuationResourceClaims,
  selectSingletonValueChunkProducer,
  terminalValueChunkProducerClaim,
  type TransportedContinuationResourceClaim,
  type ValueChunkProducerMutationRow,
} from './ValueChunkProducerIdentity.js';
import {
  valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from './value-chunk-persist.js';

/** An existing route may describe the same write with aggregate geometry; the production owns its exact lane. */
export function authenticatedTransportedValueChunkWrite(
  existing: ValueChunkWriteDescriptor | undefined,
  production: ValueChunkWriteDescriptor,
): ValueChunkWriteDescriptor {
  if (existing && (existing.collection !== production.collection
    || existing.collectionSignature !== production.collectionSignature
    || existing.entryAccessSlot !== production.entryAccessSlot
    || existing.routeSlot !== production.routeSlot
    || existing.operation !== production.operation)) {
    throw new Error('Transported value production disagrees with its final routed write shape.');
  }
  return { ...production };
}

/**
 * When overrides carry compiler-authenticated value productions, bind them to
 * the routed delegate carrier (writes, claims, continuation band).
 */
export function applyCreateBuilderTransportedProductions(params: {
  transportedProductions: readonly any[];
  activeDelegateGroupIndex: number | undefined;
  lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
  overrides: { blockBase?: number } | undefined;
  ordinaryRoute?: {
    categoryId: string;
    lockingBytecode: string;
    artifact: Artifact;
    rows: readonly ValueChunkProducerMutationRow[];
  };
}): void {
  const {
    transportedProductions, activeDelegateGroupIndex, lowLevelCallUtxoGroups, overrides,
  } = params;
  if (transportedProductions.length === 0) return;

  const carrier = activeDelegateGroupIndex === undefined
    ? undefined : lowLevelCallUtxoGroups[activeDelegateGroupIndex];
  const ordinaryRoute = activeDelegateGroupIndex === undefined ? params.ordinaryRoute : undefined;
  const rows = carrier?.compilerRoute?.rowArguments ?? ordinaryRoute?.rows;
  if ((!carrier && !ordinaryRoute) || !rows?.length) {
    throw new Error('Compiler-authenticated value production has no routed execution carrier.');
  }
  const ownerKeys = new Set(transportedProductions.map((production) => (
    `${production.stateOwner.categoryId.toLowerCase()}:`
    + production.stateOwner.lockingBytecode.toLowerCase()
  )));
  if (ownerKeys.size !== 1) {
    throw new Error('One routed execution carrier cannot own value productions from multiple state owners.');
  }
  const provisionalWrites = new Map<string, ValueChunkWriteDescriptor>();
  for (const write of carrier?.valueChunkWrites ?? []) {
    provisionalWrites.set(valueChunkWriteResourceIdentity(write), write);
  }
  for (const production of transportedProductions) {
    if (ordinaryRoute && (production.stateOwner.categoryId.toLowerCase() !== ordinaryRoute.categoryId.toLowerCase()
      || production.stateOwner.lockingBytecode.toLowerCase() !== ordinaryRoute.lockingBytecode.toLowerCase())) {
      throw new Error('Transported value production does not belong to the ordinary routed state owner.');
    }
    const resourceIdentity = valueChunkWriteResourceIdentity(production.write);
    const existingWrite = provisionalWrites.get(resourceIdentity);
    provisionalWrites.set(resourceIdentity, authenticatedTransportedValueChunkWrite(
      existingWrite, production.write,
    ));
    const derived = terminalValueChunkProducerClaim({
      rows,
      collectionIdentities: [production.write.collection, production.write.collectionSignature],
      fixedChunkableWriteSelectors:
        (carrier?.externalContract.inner.artifact ?? ordinaryRoute!.artifact)
          .messageBus?.fixedChunkableWritePolicy?.selectors,
      executionLockingBytecode: carrier?.externalContract.inner.lockingBytecode ?? ordinaryRoute!.lockingBytecode,
      stateOwnerCategoryId: production.stateOwner.categoryId,
      stateOwnerLockingBytecode: production.stateOwner.lockingBytecode,
      resourceIdentity,
    });
    const selection = derived && selectSingletonValueChunkProducer(
      [production.claim, derived],
      resourceIdentity,
      production.stateOwner,
    );
    if (selection?.status !== 'exact') {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
        console.error('transported-value-producer-mismatch', JSON.stringify({
          resourceIdentity,
          collection: production.write.collection,
          transportedClaim: production.claim,
          derivedClaim: derived,
          selection,
          rowCount: rows.length,
          rows: rows.slice(0, 24).map((row) => ({
            selector: row.selector ?? row.handler.selector,
            producerPath: row.producerPath,
            sourceEffectOrder: row.handler.sourceEffectOrder,
            entryAccesses: row.handler.entryAccesses?.slice(0, 24).map((access) => ({
              collection: access.collection,
              operations: access.operations,
              mutationEffectOrdinals: access.mutationEffectOrdinals,
              storedValueSource: access.storedValueSource && {
                version: access.storedValueSource.version,
                execution: access.storedValueSource.execution,
                mutationEffectOrdinal: access.storedValueSource.mutationEffectOrdinal,
              },
            })),
          })),
        }));
      }
      throw new Error('Transported value production disagrees with its routed terminal producer.');
    }
  }
  // Ordinary participants own their route directly. The composer installs their validated continuation
  // outputs in that participant's balanced trailing slots; there is no separate delegate carrier to bind.
  if (!carrier) return;
  carrier.valueChunkWrites = [...provisionalWrites.values()];
  carrier.valueChunkOutputCount = transportedProductions.reduce((count, production) => (
    production.write.outputCount > 0
      ? count + production.write.outputCount
      : count + Math.ceil((production.value.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE)
  ), 0);
  carrier.valueChunkProducerClaims = Object.freeze(
    transportedProductions.map((production) => production.claim),
  );
  carrier.transportedValueChunkProductions = true;
  carrier.valueChunkStateOwner = Object.freeze({ ...transportedProductions[0]!.stateOwner });
  const blockBase = overrides?.blockBase ?? 0;
  const continuationClaims: TransportedContinuationResourceClaim[] = [];
  for (const production of transportedProductions) {
    if (production.write.outputBase < 0 || production.write.outputCount <= 0) continue;
    const claim = buildTransportedContinuationResourceClaim({
      owner: production.stateOwner,
      collectionSignature: production.write.collectionSignature,
      collectionHash: production.write.collectionHash,
      keySlot: production.write.keySlot,
      digest: binToHex(sha256Sync(production.value)),
      chunkCount: production.write.outputCount,
      bandOffset: production.write.outputBase - blockBase,
      producerClaim: production.claim,
    });
    if (!claim) {
      throw new Error('Transported continuation resource claim is not canonical.');
    }
    continuationClaims.push(claim);
  }
  if (continuationClaims.length > 0) {
    const ordered = orderTransportedContinuationResourceClaims(continuationClaims);
    if (ordered === undefined) {
      throw new Error('Transported continuation resource claims are not an ordered band list.');
    }
    carrier.continuationResourceClaims = ordered;
    carrier.valueChunkOutputBase = ordered[0]!.bandOffset + blockBase;
  }
}
