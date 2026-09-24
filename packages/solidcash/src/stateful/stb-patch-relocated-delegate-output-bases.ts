/**
 * phase-boundary extract: STB build-phase extract — patch relocated delegate data-NFT unlockers before input registration.
 */

import type { FunctionBlockLayout } from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';
import { createRelocatedDataNftUnlocker } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

export type ExternalCallEntryInsert = {
  categoryId: string;
  commitment: string;
};

export interface PatchRelocatedDelegateOutputBasesHost {
  readonly delegateEntriesAfterLowLevel: boolean;
  readonly compilerRouteDelegateBlock: boolean;
  readonly blockLayout?: FunctionBlockLayout;
  readonly requiredNftIndices: readonly number[];
  readonly readOnlyDataNftUtxos: readonly UnlockableUtxo[];
  readonly blockhashCoSpendUtxos: readonly UnlockableUtxo[];
  readonly keccakComputeCoSpendUtxos: readonly UnlockableUtxo[];
  readonly ecrecoverComputeCoSpendUtxos: readonly UnlockableUtxo[];
  readonly iterationEntryInputs: readonly UnlockableUtxo[];
  readonly externalOutStateUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly externalCallEntryInserts: readonly ExternalCallEntryInsert[];
  getLowLevelCallMasterInputIndex(groupIndex: number): number;
}

/**
 * Compiler-route delegate inputs can live in a leading implementation band while their recreations follow
 * all external participant blocks and derived INSERT outputs. Patch the shared unlockers before inputs are
 * registered, using the exact output ordering this build method emits.
 */
export function patchRelocatedDelegateOutputBases(
  host: PatchRelocatedDelegateOutputBasesHost,
): Map<number, { value: number }> {
  const relocatedDelegateOutputBases = new Map<number, { value: number }>();
  if (!host.delegateEntriesAfterLowLevel && !host.compilerRouteDelegateBlock) {
    return relocatedDelegateOutputBases;
  }
  const associated = new Set(host.externalCallUtxoGroups
    .map((group) => group.delegateCallGroupIndex)
    .filter((index): index is number => index !== undefined));
  let outputCursor = host.compilerRouteDelegateBlock && host.blockLayout
    ? host.blockLayout.blockSize
    : 1 + host.requiredNftIndices.length + host.readOnlyDataNftUtxos.length
      + host.blockhashCoSpendUtxos.length + host.keccakComputeCoSpendUtxos.length
      + host.ecrecoverComputeCoSpendUtxos.length + host.iterationEntryInputs.length
      + host.externalOutStateUtxoGroups.reduce(
        (sum, group) => sum + 1 + group.dataNftUtxos.length + (group.keccakInputs?.length ?? 0), 0,
      );
  const patchDelegate = (groupIndex: number, outputBase: number): number => {
    const group = host.lowLevelCallUtxoGroups[groupIndex];
    if (!group || group.callMode !== 'delegatecall') return outputBase;
    const masterInputIndex = host.getLowLevelCallMasterInputIndex(groupIndex);
    const outputBaseRef = relocatedDelegateOutputBases.get(groupIndex) ?? { value: outputBase };
    relocatedDelegateOutputBases.set(groupIndex, outputBaseRef);
    group.dataNftUtxos.forEach((nftUtxo, nftIndex) => {
      const relocated = createRelocatedDataNftUnlocker(
        group.externalContract.inner,
        masterInputIndex,
        outputBase + 1 + nftIndex,
        group.categoryId,
      );
      nftUtxo.unlocker = {
        ...relocated,
        generateUnlockingBytecode: (options) => createRelocatedDataNftUnlocker(
          group.externalContract.inner,
          masterInputIndex,
          outputBaseRef.value + 1 + nftIndex,
          group.categoryId,
        ).generateUnlockingBytecode(options),
      };
    });
    return outputBase + 1 + group.dataNftUtxos.length;
  };
  host.lowLevelCallUtxoGroups.forEach((group, groupIndex) => {
    if (group.callMode === 'delegatecall' && !associated.has(groupIndex)) {
      outputCursor = patchDelegate(groupIndex, outputCursor);
    }
  });
  host.externalCallUtxoGroups.forEach((group) => {
    if (group.sharedGroupIndex !== undefined) return;
    outputCursor += group.blockInputs?.length ?? 1 + group.dataNftUtxos.length;
    outputCursor += host.externalCallEntryInserts.filter((insert, handle) => (
      insert.categoryId === group.categoryId && insert.commitment !== ''
      && !group.plannedEntryInsertHandles?.includes(handle)
    )).length;
    if (group.delegateCallGroupIndex !== undefined) {
      outputCursor = patchDelegate(group.delegateCallGroupIndex, outputCursor);
    }
    host.externalCallUtxoGroups.forEach((shared) => {
      if (shared.sharedGroupIndex === host.externalCallUtxoGroups.indexOf(group)
        && shared.delegateCallGroupIndex !== undefined) {
        outputCursor = patchDelegate(shared.delegateCallGroupIndex, outputCursor);
      }
    });
  });
  return relocatedDelegateOutputBases;
}
