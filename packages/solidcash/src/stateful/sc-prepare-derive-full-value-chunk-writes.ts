/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — bind value-chunk
 * writes / claims and select persisted write.
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
import { terminalValueChunkProducerClaim } from './ValueChunkProducerIdentity.js';
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
    // A direct delegatecall (no route external group to own it) executes the implementation against the
    // TOP-LEVEL contract's state, so its entries and value chunks live under that root category and master lock,
    // not the implementation's own deployment category.
    const rootOwner = lowLevelIndex >= 0 && stateOwnerGroup === undefined
      ? { categoryId: stb.rootCategoryId, lockingBytecode: stb.ownerMasterLock() } : undefined;
    const stateOwnerCategoryId = group.valueChunkStateOwner?.categoryId
      ?? stateOwnerGroup?.categoryId
      ?? rootOwner?.categoryId ?? group.categoryId;
    const stateOwnerLockingBytecode = group.valueChunkStateOwner?.lockingBytecode
      ?? stateOwnerGroup?.externalContract?.inner?.lockingBytecode
      ?? rootOwner?.lockingBytecode
      ?? group.externalContract?.inner?.lockingBytecode;
    const describedValueChunkWrites = describeValueChunkWrites(group, stateOwnerCategoryId);
    // A routed delegate may carry no independently addressable entry input until its proxy block is
    // materialized. In that case keep the descriptors it already carries; ordinary descriptor-free groups
    // continue to accept the locally described set (including an empty set).
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
          rows: [] as any[],
          collectionIdentities: [write.collection, write.collectionSignature],
          fixedChunkableWriteSelectors: undefined,
          executionLockingBytecode: group.externalContract?.inner?.lockingBytecode ?? '',
          stateOwnerCategoryId: group.valueChunkStateOwner.categoryId,
          stateOwnerLockingBytecode: group.valueChunkStateOwner.lockingBytecode,
          resourceIdentity: resource.identity,
        });
      if (claim) group.valueChunkProducerClaims = Object.freeze([claim]);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
        console.error('value-chunk-producer-bind', JSON.stringify({
          resource: resource.identity,
          owner: group.valueChunkStateOwner,
          functionName: group.functionName,
          callMode: group.callMode,
          rowCount: 0,
          claim: claim?.producer,
          producerClaims: group.valueChunkProducerClaims?.map((candidate) => candidate.producer),
          rows: [],
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
