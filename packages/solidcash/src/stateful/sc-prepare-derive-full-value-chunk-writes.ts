/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — bind value-chunk writes / claims and select persisted write.
 */

import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import {
  isValueChunkWriteReady,
  persistedValueChunkWriteState,
  selectPersistedValueChunkWrite,
  selectValueChunkResource,
  valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from './StatefulTransactionBuilder.js';
import {
  selectSingletonValueChunkProducer,
  terminalValueChunkProducerClaim,
} from './ValueChunkProducerIdentity.js';
import { describeValueChunkWrites } from './writer-group-selection.js';

export type DeriveFullValueChunkPrep = {
  valueChunkWrites: ValueChunkWriteDescriptor[];
  persistedChunkWrite: ValueChunkWriteDescriptor | undefined;
  persistWidthAtEntry: number;
};

/**
 * Describe and bind value-chunk writes across external + low-level groups, then select the
 * persisted write (and its entry width) for the derivation probe.
 */
export function prepareDeriveFullValueChunkWrites(
  stb: StatefulTransactionBuilder,
): DeriveFullValueChunkPrep {
  const externalGroups = stb.getExternalCallUtxoGroups();
  const lowLevelGroups = stb.getLowLevelCallUtxoGroups();
  const delegateStateOwners = new Map<number, ExternalCallUtxoGroup>();
  for (const group of externalGroups) {
    if (group.delegateCallGroupIndex === undefined
      || delegateStateOwners.has(group.delegateCallGroupIndex)) continue;
    delegateStateOwners.set(group.delegateCallGroupIndex, group);
  }

  const valueChunkWrites = [
    ...externalGroups, ...lowLevelGroups,
  ].flatMap((group) => {
    const lowLevelIndex = lowLevelGroups.indexOf(group);
    const stateOwnerGroup = lowLevelIndex >= 0
      ? delegateStateOwners.get(lowLevelIndex) : group;
    const stateOwnerCategoryId = group.valueChunkStateOwner?.categoryId
      ?? stateOwnerGroup?.categoryId ?? group.categoryId;
    const stateOwnerLockingBytecode = group.valueChunkStateOwner?.lockingBytecode
      ?? stateOwnerGroup?.externalContract?.inner?.lockingBytecode
      ?? group.externalContract?.inner?.lockingBytecode;
    const describedValueChunkWrites = describeValueChunkWrites(group, stateOwnerCategoryId);
    // A routed delegate may carry no independently addressable entry input until its proxy block is
    // materialized. In that case retain only compiler-authenticated transported descriptors; ordinary
    // descriptor-free groups continue to accept the locally described set (including an empty set).
    if (describedValueChunkWrites.length > 0 || !group.valueChunkProducerClaims?.length) {
      group.valueChunkWrites = describedValueChunkWrites;
    }
    const effectiveValueChunkWrites = group.valueChunkWrites ?? [];
    if (!group.valueChunkStateOwner && stateOwnerLockingBytecode !== undefined) {
      group.valueChunkStateOwner = {
        categoryId: stateOwnerCategoryId,
        lockingBytecode: stateOwnerLockingBytecode,
      };
    }
    const resource = selectValueChunkResource(effectiveValueChunkWrites);
    if (resource.status === 'exact' && group.valueChunkStateOwner) {
      const write = effectiveValueChunkWrites.find((candidate) => (
        valueChunkWriteResourceIdentity(candidate) === resource.identity
      ));
      const claim = group.valueChunkProducerClaims?.length ? undefined : write
        && terminalValueChunkProducerClaim({
        rows: group.compilerRoute?.rowArguments ?? [],
        collectionIdentities: [write.collection, write.collectionSignature],
        fixedChunkableWriteSelectors:
          group.externalContract?.inner?.artifact.messageBus?.fixedChunkableWritePolicy?.selectors,
        executionLockingBytecode: group.externalContract?.inner?.lockingBytecode ?? '',
        stateOwnerCategoryId: group.valueChunkStateOwner.categoryId,
        stateOwnerLockingBytecode: group.valueChunkStateOwner.lockingBytecode,
        resourceIdentity: resource.identity,
      });
      if (claim) group.valueChunkProducerClaims = Object.freeze([claim]);
      for (const transportedClaim of group.transportedValueChunkProductions
        ? group.valueChunkProducerClaims ?? [] : []) {
        const matchingWrites = effectiveValueChunkWrites.filter((candidate) => (
          valueChunkWriteResourceIdentity(candidate) === transportedClaim.resourceIdentity
        ));
        const derived = matchingWrites.length === 1 && terminalValueChunkProducerClaim({
          rows: group.compilerRoute?.rowArguments ?? [],
          collectionIdentities: [matchingWrites[0]!.collection, matchingWrites[0]!.collectionSignature],
          fixedChunkableWriteSelectors:
            group.externalContract?.inner?.artifact.messageBus?.fixedChunkableWritePolicy?.selectors,
          executionLockingBytecode: group.externalContract?.inner?.lockingBytecode ?? '',
          stateOwnerCategoryId: group.valueChunkStateOwner.categoryId,
          stateOwnerLockingBytecode: group.valueChunkStateOwner.lockingBytecode,
          resourceIdentity: transportedClaim.resourceIdentity,
        });
        const selection = derived ? selectSingletonValueChunkProducer(
          [transportedClaim, derived], transportedClaim.resourceIdentity, group.valueChunkStateOwner,
        ) : undefined;
        if (matchingWrites.length !== 1 || selection?.status !== 'exact') {
          throw new Error(
            'Transported value production does not match one final compiler-routed write.',
          );
        }
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
        console.error('value-chunk-producer-bind', JSON.stringify({
          resource: resource.identity,
          owner: group.valueChunkStateOwner,
          functionName: group.functionName,
          callMode: group.callMode,
          hasCompilerRoute: group.compilerRoute !== undefined,
          rowCount: group.compilerRoute?.rowArguments?.length ?? 0,
          claim: claim?.producer,
          transportedClaims: group.valueChunkProducerClaims?.map((candidate) => candidate.producer),
          rows: group.compilerRoute?.rowArguments?.map((row) => ({
            selector: row.selector,
            sourceEffectOrder: row.handler.sourceEffectOrder,
            producerPath: row.producerPath,
          })),
        }));
      }
    }
    return effectiveValueChunkWrites;
  });
  const selectedPersistedChunkWrite = selectPersistedValueChunkWrite(
    valueChunkWrites, undefined, stb.valueChunkWriteStagingSession,
  );
  const persistedChunkWrite = selectedPersistedChunkWrite
    && isValueChunkWriteReady(selectedPersistedChunkWrite) ? selectedPersistedChunkWrite : undefined;
  const persistWidthAtEntry = persistedChunkWrite
    ? persistedValueChunkWriteState(persistedChunkWrite)!.width : 0;

  return { valueChunkWrites, persistedChunkWrite, persistWidthAtEntry };
}
