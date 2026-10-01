/**
 * phase-boundary extract: STB class-body extract — rebind/reconcile materialized data-NFT and entry-NFT
 * unlockers, plus minting-input witness refresh orchestration.
 */

import { binsAreEqual } from '@bitauth/libauth';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import { isContractUnlocker } from '../interfaces.js';
import {
  createDataNftUnlocker,
  createEntryNftUnlocker,
  createRelocatedDataNftUnlocker,
  createSatoshiContainerUnlocker,
} from './covenant-helpers.js';
import type { EntryNftInfo, ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { sameOutpoint } from './external-call-utxo-group.js';

export interface MaterializedNftUnlockerReconcileHost {
  readonly allInputs: UnlockableUtxo[];
  readonly externalCallUtxoGroups: ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly iterationEntryInputs: readonly UnlockableUtxo[];
  readonly entryNfts: readonly EntryNftInfo[];
  findMintingInputIndex(categoryId: string): number;
  syncBuilderUnlockers(builder: TransactionBuilder): void;
  syncRefreshedCarrierMasters(
    builder: TransactionBuilder,
    carriers: ReadonlySet<ExternalCallUtxoGroup>,
  ): void;
}

// Manually assembled transaction builders can carry a Contract directly; SDK-composed groups carry its
// StatefulContract wrapper. Both identify the same covenant, but only the latter has an `inner` property.
const groupContract = (group: ExternalCallUtxoGroup): any =>
  group.externalContract?.inner ?? group.externalContract;

/**
 * Rebind write-path entry NFT unlockers of `categoryId` to `masterInputIndex`.
 * Entry inputs may live outside their owner's fixed participant block, so a
 * blockInputs-only pass cannot update every co-spend after final relocation.
 */
export function rebindCategoryEntryUnlockers(
  host: MaterializedNftUnlockerReconcileHost,
  categoryId: string,
  rebind: (current: UnlockableUtxo) => Unlocker | undefined,
): void {
  const visit = (input: UnlockableUtxo | undefined): void => {
    if (!input?.token || input.token.category !== categoryId) return;
    if (input.token.nft?.capability !== 'mutable' || !input.unlocker) return;
    const next = rebind(input);
    if (next) input.unlocker = next;
  };
  for (const input of host.allInputs) visit(input);
  for (const group of host.externalCallUtxoGroups) {
    for (const input of group.blockInputs ?? []) visit(input);
  }
  for (const input of host.iterationEntryInputs) visit(input);
  for (const info of host.entryNfts) {
    if (info.utxo) visit(info.utxo);
  }
}

/** Rebind each participant data-NFT covenant to its master in the final physical input order. */
export function reconcileMaterializedDataNftUnlockers(
  host: MaterializedNftUnlockerReconcileHost,
  builder: TransactionBuilder,
): boolean {
  const status = { changed: false };
  const groups = [
    ...host.externalCallUtxoGroups.filter((group) => group.sharedGroupIndex === undefined),
    ...host.lowLevelCallUtxoGroups,
  ];
  for (const group of groups) {
    const master = group.masterUtxo as UnlockableUtxo | undefined;
    if (!master) continue;
    const masterInputIndex = host.allInputs.findIndex((input) => (
      input.txid.toLowerCase() === master.txid.toLowerCase() && input.vout === master.vout
    ));
    if (masterInputIndex < 0) continue;
    group.dataNftUtxos = group.dataNftUtxos.map((dataNft) => {
      if (!isContractUnlocker(dataNft.unlocker)) return dataNft;
      const flagIndex = dataNft.unlocker.abiFunction.inputs.findIndex((input) => input.name === 'flag');
      const masterIndex = dataNft.unlocker.abiFunction.inputs
        .findIndex((input) => input.name === 'masterInputIndex');
      const flag = flagIndex < 0 ? undefined : dataNft.unlocker.params[flagIndex];
      const priorMaster = masterIndex < 0 ? undefined : dataNft.unlocker.params[masterIndex];
      if ((flag !== 1n && flag !== 3n) || priorMaster === BigInt(masterInputIndex)) return dataNft;
      const outputIndexParam = dataNft.unlocker.abiFunction.inputs
        .findIndex((input) => input.name === 'outputIndex');
      const outputIndex = outputIndexParam < 0 ? undefined : dataNft.unlocker.params[outputIndexParam];
      const contract = groupContract(group);
      if (!contract?.addressType) {
        throw new Error(`Cannot rebind data NFT for participant ${group.categoryId} without its contract`);
      }
      const unlocker = flag === 3n && typeof outputIndex === 'bigint'
        ? createRelocatedDataNftUnlocker(
          contract, masterInputIndex, Number(outputIndex), group.categoryId,
        )
        : createDataNftUnlocker(contract, masterInputIndex, group.categoryId);
      const rebound = { ...dataNft, unlocker } as UnlockableUtxo;
      const matches = (candidate: Utxo | undefined): boolean => candidate !== undefined
        && candidate.txid.toLowerCase() === dataNft.txid.toLowerCase() && candidate.vout === dataNft.vout;
      const flatIndex = host.allInputs.findIndex(matches);
      if (flatIndex >= 0) host.allInputs[flatIndex] = rebound;
      const builtIndex = builder.inputs.findIndex(matches);
      if (builtIndex >= 0) builder.inputs[builtIndex] = rebound;
      if (group.blockInputs) {
        const blockIndex = group.blockInputs.findIndex(matches);
        if (blockIndex >= 0) group.blockInputs[blockIndex] = rebound;
      }
      status.changed = true;
      return rebound;
    });
  }
  return status.changed;
}

/** Rebind write-path entry covenants to their state owner's final physical minting-master input. */
export function reconcileMaterializedEntryNftUnlockers(
  host: MaterializedNftUnlockerReconcileHost,
  builder: TransactionBuilder,
): boolean {
  const status = { changed: false };
  const groups = [
    ...host.externalCallUtxoGroups.filter((group) => group.sharedGroupIndex === undefined),
    ...host.lowLevelCallUtxoGroups,
  ];
  const categories = new Set(groups.map((group) => group.categoryId).filter(Boolean));
  for (const categoryId of categories) {
    const masterInputIndex = host.findMintingInputIndex(categoryId);
    if (masterInputIndex < 0) continue;
    const descriptors = groups.flatMap((group) => {
      if (group.categoryId !== categoryId) return [];
      const delegateGroup = group.delegateCallGroupIndex === undefined
        ? undefined : host.lowLevelCallUtxoGroups[group.delegateCallGroupIndex];
      const entryContract = delegateGroup ? groupContract(delegateGroup) : groupContract(group);
      if (!entryContract?.addressType) return [];
      return (group.stateLayout?.collections ?? []).flatMap((collection) => (
        typeof collection.signature === 'string'
          ? [{ entryContract, signature: collection.signature }]
          : []
      ));
    });
    if (descriptors.length === 0) continue;
    rebindCategoryEntryUnlockers(host, categoryId, (input) => {
      if (!isContractUnlocker(input.unlocker)) return undefined;
      const flagIndex = input.unlocker.abiFunction.inputs.findIndex((candidate) => candidate.name === 'flag');
      const masterIndex = input.unlocker.abiFunction.inputs
        .findIndex((candidate) => candidate.name === 'masterInputIndex');
      if (flagIndex < 0 || masterIndex < 0 || input.unlocker.params[flagIndex] !== 1n
        || input.unlocker.params[masterIndex] === BigInt(masterInputIndex)) return undefined;
      const lockingBytecode = input.unlocker.generateLockingBytecode();
      for (const { entryContract, signature } of descriptors) {
        const candidate = createEntryNftUnlocker(
          entryContract, masterInputIndex, categoryId, signature,
        );
        if (!binsAreEqual(candidate.generateLockingBytecode(), lockingBytecode)) continue;
        status.changed = true;
        return candidate;
      }
      return undefined;
    });
  }
  if (status.changed) host.syncBuilderUnlockers(builder);
  return status.changed;
}

/** Rebind real container spends, leaving inactive funding pads at their original locks. */
export function reconcileMaterializedSatoshiContainerUnlockers(
  host: MaterializedNftUnlockerReconcileHost,
  builder: TransactionBuilder,
): boolean {
  let changed = false;
  for (const group of [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]) {
    if (group.sharedGroupIndex !== undefined) continue;
    const masterIndex = host.findMintingInputIndex(group.categoryId);
    if (masterIndex < 0) continue;
    for (const slot of group.blockLayout?.slots ?? []) {
      if (slot.kind !== 'satoshiContainer') continue;
      const input = group.blockInputs?.[slot.offset];
      if (!input || input.token || !isContractUnlocker(input.unlocker)) continue;
      const params = input.unlocker.abiFunction.inputs;
      const flag = params.findIndex((param) => param.name === 'flag');
      const master = params.findIndex((param) => param.name === 'masterInputIndex');
      if (flag < 0 || master < 0 || input.unlocker.params[flag] !== 1n
        || input.unlocker.params[master] === BigInt(masterIndex)) continue;
      const contract = groupContract(group);
      if (!contract?.addressType) {
        throw new Error(`Cannot rebind satoshi container for participant ${group.categoryId} without its contract`);
      }
      const unlocker = createSatoshiContainerUnlocker(contract, masterIndex, group.categoryId);
      if (!binsAreEqual(unlocker.generateLockingBytecode(), input.unlocker.generateLockingBytecode())) continue;
      const rebound = { ...input, unlocker };
      group.blockInputs![slot.offset] = rebound;
      const flatIndex = host.allInputs.findIndex((candidate) => sameOutpoint(candidate, input));
      if (flatIndex >= 0) host.allInputs[flatIndex] = rebound;
      const builtIndex = builder.inputs.findIndex((candidate) => sameOutpoint(candidate, input));
      if (builtIndex >= 0) builder.inputs[builtIndex] = rebound;
      changed = true;
    }
  }
  return changed;
}

/** Rebind hidden callee-master arguments from the final physical input order. */
export function reconcileMaterializedInputWitnesses(
  host: MaterializedNftUnlockerReconcileHost,
  builder: TransactionBuilder,
): boolean {
  const dataNftsChanged = reconcileMaterializedDataNftUnlockers(host, builder);
  const entryNftsChanged = reconcileMaterializedEntryNftUnlockers(host, builder);
  const containersChanged = reconcileMaterializedSatoshiContainerUnlockers(host, builder);
  const changedCarriers = new Set<ExternalCallUtxoGroup>();
  for (const carrier of [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]) {
    if (!carrier.mintingInputWitnessCategories || !carrier.refreshInternalArgs) continue;
    const updates: Record<string, bigint> = {};
    for (const [name, categoryId] of Object.entries(carrier.mintingInputWitnessCategories)) {
      const inputIndex = host.findMintingInputIndex(categoryId);
      if (inputIndex < 0 || carrier.internalArgs?.[name] === BigInt(inputIndex)) continue;
      updates[name] = BigInt(inputIndex);
    }
    if (Object.keys(updates).length === 0) continue;
    carrier.refreshInternalArgs(updates, { shiftPredOut: false });
    carrier.internalArgs = { ...carrier.internalArgs, ...updates };
    changedCarriers.add(carrier);
  }
  if (changedCarriers.size === 0) return dataNftsChanged || entryNftsChanged || containersChanged;
  host.syncRefreshedCarrierMasters(builder, changedCarriers);
  return true;
}
