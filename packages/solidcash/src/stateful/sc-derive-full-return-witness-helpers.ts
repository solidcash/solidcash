/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — return-witness reconcile + entry/chunk unlocker rebind.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction, Artifact } from '@solidcash/utils';
import {
  createDynamicChunkUnlocker,
  createEntryNftUnlocker,
} from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { entryAccessAt } from './route-expression-key.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { logicalReturnGroupIndex } from './value-chunk-geometry.js';

export type DeriveFullEntryContract = {
  inner: {
    artifact: Artifact;
    unlock?: unknown;
  };
};

export function reconcileDeriveFullReturnWitnesses(
  stb: StatefulTransactionBuilder,
  externalCallUtxoGroups: ExternalCallUtxoGroup[],
): void {
  let refreshed = false;
  for (const [externalGroupIdx, externalGroup] of externalCallUtxoGroups.entries()) {
    // Views keep the tail that carries their precomputed result. Using the fused writer
    // here pointed `arbitratorRegistered` at FakeToken's in-block `00…01`.
    const actual = stb.getBuiltExternalCallReturnEventOutputIndex(
      logicalReturnGroupIndex(externalCallUtxoGroups, externalGroupIdx),
    );
    if (actual >= 0) externalGroup.returnOutputIndex = actual;
  }
  // Return witnesses can be carried by the root delegate implementation or by a nested participant that
  // itself calls another contract. Reconcile both from the authoritative built output layout.
  const returnWitnessCarriers = new Set([
    ...stb.getLowLevelCallUtxoGroups(),
    ...externalCallUtxoGroups,
  ]);
  for (const delegateGroup of returnWitnessCarriers) {
    if (!delegateGroup.returnWitnessGroups || !delegateGroup.refreshInternalArgs) continue;
    const updates: Record<string, bigint> = {};
    for (const [name, externalGroupIdx] of Object.entries(delegateGroup.returnWitnessGroups)) {
      const actual = stb.getBuiltExternalCallReturnEventOutputIndex(externalGroupIdx);
      if (actual >= 0 && delegateGroup.internalArgs?.[name] !== BigInt(actual)) {
        updates[name] = BigInt(actual);
      }
    }
    if (Object.keys(updates).length === 0) continue;
    delegateGroup.refreshInternalArgs(updates);
    refreshed = true;
  }
  if (refreshed) {
    stb._refreshInputs();
    (stb as unknown as { __returnWitnessesReconciled?: boolean }).__returnWitnessesReconciled = true;
  }
}

export function rebindDeriveFullExternalResourceMaster(
  stb: StatefulTransactionBuilder,
  group: ExternalCallUtxoGroup, entryMasterIdx: number,
): boolean {
  if (!group.blockLayout || !group.blockInputs || entryMasterIdx < 0) return false;
  const stateContract = group.externalContract as DeriveFullEntryContract | null;
  const delegateGroup = group.delegateCallGroupIndex === undefined
    ? undefined : stb.getLowLevelCallUtxoGroups()[group.delegateCallGroupIndex];
  const entryContract = group.delegateCallGroupIndex === undefined
    ? stateContract : delegateGroup?.externalContract as DeriveFullEntryContract | undefined;
  const abiFunction: AbiFunction | undefined = delegateGroup?.compilerRoute?.abiFunction
    ?? delegateGroup?.externalContract.inner.artifact.abi?.find(
      (candidate: { name: string }) => candidate.name === delegateGroup.functionName,
    )
    ?? group.compilerRoute?.abiFunction
    ?? stateContract?.inner.artifact.abi?.find(
      (candidate: { name: string }) => candidate.name === group.functionName,
    ) as AbiFunction | undefined;
  if (!entryContract) return false;
  let rebound = false;
  for (let slotIndex = 0; slotIndex < group.blockLayout.slots.length; slotIndex++) {
    const slot = group.blockLayout.slots[slotIndex];
    const input = group.blockInputs[slotIndex];
    if (slot?.kind !== 'entry' || !input?.token?.nft) continue;
    const access = entryAccessAt(abiFunction, slot.slotIndex ?? 0);
    if (!access) continue;
    input.unlocker = createEntryNftUnlocker(
      entryContract.inner as any, entryMasterIdx, group.categoryId, access.collection,
    );
    rebound = true;
  }
  const collections: string[] = [];
  for (const access of abiFunction?.entryAccesses ?? []) {
    if (typeof access.collection === 'string' && !collections.includes(access.collection)) {
      collections.push(access.collection);
    }
  }
  stb.rebindCategoryEntryUnlockers(group.categoryId, (input) => {
    const lockingBytecode = input.unlocker.generateLockingBytecode();
    for (const collection of collections) {
      const candidate = createEntryNftUnlocker(
        entryContract.inner as any, entryMasterIdx, group.categoryId, collection,
      );
      if (binToHex(candidate.generateLockingBytecode()) === binToHex(lockingBytecode)) {
        rebound = true;
        return candidate;
      }
    }
    return undefined;
  });
  if (group.entryLoopStart !== undefined && group.entryLoopCollection) {
    for (let index = 0; index < (group.entryLoopCommitments?.length ?? 0); index++) {
      const input = group.blockInputs[group.entryLoopStart + index];
      if (!input?.token?.nft) continue;
      input.unlocker = createEntryNftUnlocker(
        entryContract.inner as any, entryMasterIdx, group.categoryId, group.entryLoopCollection,
      );
      rebound = true;
    }
  }
  for (const resource of group.dynamicChunkResources ?? []) {
    if (!resource.write) continue;
    const input = group.blockInputs[resource.blockSlot];
    if (!input?.token?.nft) continue;
    input.unlocker = createDynamicChunkUnlocker(
      entryContract.inner as any, entryMasterIdx, group.categoryId, resource.name, resource.type,
    );
    rebound = true;
  }
  return rebound;
}
