/**
 * phase-boundary extract: STB build-phase extract — appendDelegateGroupOutputs + appendDelegateLoopEntries helpers.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  type AbiFunction,
  type FunctionBlockLayout,
} from '@solidcash/utils';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript, calculateDust } from '../utils.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import {
  hasMaterializedLowLevelCallBlock,
  lowLevelCallBlockLayout,
  type ExternalCallUtxoGroup,
  type TransferData,
} from './external-call-utxo-group.js';
import { cloneToken } from './stb-output-utils.js';
import type { DerivedChunkOutputObservation } from './value-chunk-persist.js';

export type LoopEntryVarLike = {
  collection: string;
  lockingBytecode: Uint8Array;
  categoryId?: string;
  delegate?: boolean;
};

export interface AppendDelegateOutputHelpersHost {
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly derivedChunkOutputs: ReadonlyMap<number, DerivedChunkOutputObservation>;
  readonly externalCallEntryOutputsByIndex: ReadonlyMap<number, { categoryId: string; commitment: string }>;
  readonly externalCallEntryOutputs: ReadonlyMap<string, ReadonlyMap<number, string>>;
  readonly delegateComputeResources: boolean;
  readonly compilerRouteDelegateBlock: boolean;
  readonly keccakComputeCoSpendUtxos: readonly UnlockableUtxo[];
  readonly keccakComputeCommitments: readonly string[];
  readonly categoryId: string;
  readonly ecrecoverComputeRecreates: readonly Output[];
  readonly pendingTransfers: readonly TransferData[];
  readonly activeDelegateGroupIndex?: number;
  readonly blockLayout?: FunctionBlockLayout;
  readonly iterationEntryInputs: readonly UnlockableUtxo[];
  readonly externalCallEntryInserts: ReadonlyArray<{ categoryId: string; to: Uint8Array; commitment: string }>;
  readonly loopEntryCommitments: ReadonlyMap<string, readonly string[]>;
  getLowLevelCallMasterInputIndex(groupIndex: number): number;
  delegateLoopEntryVars(): readonly LoopEntryVarLike[];
  unmaterializedReturnEventCompact(
    blockLayout: FunctionBlockLayout | undefined,
    unlocker: { abiFunction?: { inputs?: ReadonlyArray<{ name: string }> }; params?: readonly unknown[] } | undefined,
  ): number;
  getLoopEntryOutputBase(): number;
  loopEntryTransitionSatoshis(variable: LoopEntryVarLike, commitment: string): bigint | undefined;
  setIterationEntriesPlacedAtDelegateBase(value: boolean): void;
}

export interface AppendDelegateOutputHelpers {
  readonly associatedDelegateOutputs: ReadonlySet<number>;
  appendDelegateGroupOutputs: (groupIndex: number) => void;
  appendDelegateLoopEntries: () => void;
  getDelegateTransferSlotsConsumed: () => number;
}

/**
 * Build the associated-delegate set plus the two mid-build append helpers used by
 * delegateEntriesAfterLowLevel placement and external-call/LLC materialization.
 */
export function createAppendDelegateOutputHelpers(
  host: AppendDelegateOutputHelpersHost,
  builder: TransactionBuilder,
): AppendDelegateOutputHelpers {
  const associatedDelegateOutputs = new Set(host.externalCallUtxoGroups
    .map((group) => group.delegateCallGroupIndex)
    .filter((index): index is number => index !== undefined));
  let delegateTransferSlotsConsumed = 0;
  const appendDelegateGroupOutputs = (groupIndex: number): void => {
    const group = host.lowLevelCallUtxoGroups[groupIndex];
    if (!group || group.callMode !== 'delegatecall') return;
    const bMaster = group.masterUtxo as UnlockableUtxo;
    const delegateFn = group.compilerRoute?.abiFunction
    ?? (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
      .find((candidate) => candidate.name === group.functionName);
    const layout = lowLevelCallBlockLayout(group) ?? delegateFn?.blockLayout;
    const expectedMasterAbs = host.getLowLevelCallMasterInputIndex(groupIndex);
    const proxyOwners = host.externalCallUtxoGroups.filter(
      (candidate) => candidate.delegateCallGroupIndex === groupIndex,
    );
    // When flattenLlc spends full blockInputs, mirror entry/event here if the cursor is on this master.
    if (hasMaterializedLowLevelCallBlock(group) && group.blockInputs && layout
    && proxyOwners.length === 1
    && expectedMasterAbs >= 0 && builder.outputs.length === expectedMasterAbs) {
      const masterAbs = builder.outputs.length;
      for (let offset = 0; offset < group.blockInputs.length; offset += 1) {
      // An unlisted offset is a compiler-balanced physical cell. It is safe to preserve from the exact dense
      // input band; never reinterpret another array-position slot as owning this offset.
        const slot = layout.slots.find((candidate) => candidate.offset === offset);
        const input = group.blockInputs[offset];
        if (offset === 0) {
          builder.addOutput({
            to: bMaster.unlocker.generateLockingBytecode(),
            amount: bMaster.satoshis,
            token: bMaster.token,
          });
          continue;
        }
        if (slot?.kind === 'entry') {
          const abs = masterAbs + offset;
          const derived = host.derivedChunkOutputs.get(abs);
          const commitment = (derived?.fixedIndex ? derived.commitment : undefined)
          ?? host.externalCallEntryOutputsByIndex.get(abs)?.commitment
          ?? host.externalCallEntryOutputs.get(group.categoryId)?.get(offset);
          const lock = derived?.lockingBytecode
          ?? (input && 'unlocker' in input && input.unlocker
            ? input.unlocker.generateLockingBytecode()
            : Uint8Array.of(0x51));
          if (commitment && commitment.length >= 128) {
            builder.addOutput({
              to: lock,
              amount: 1000n,
              token: {
                amount: 0n,
                category: input?.token?.category ?? group.categoryId,
                nft: { capability: 'mutable', commitment },
              },
            });
          } else if (input && 'unlocker' in input && input.unlocker) {
            builder.addOutput({
              to: input.unlocker.generateLockingBytecode(),
              amount: input.satoshis,
              token: cloneToken(input.token),
            });
          } else {
            builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
          }
          continue;
        }
        if (slot?.kind === 'event') {
          const eo = group.eventOutputs?.[slot.slotIndex!];
          const proxyOwner = proxyOwners[0];
          if (eo && eo.commitment !== '' && !/^0+$/.test(eo.commitment)) {
            builder.addOutput({
              to: eo.lockingBytecode,
              amount: 1200n,
              token: {
                amount: 0n,
                category: proxyOwner?.categoryId ?? group.categoryId,
                nft: { capability: 'none', commitment: eo.commitment },
              },
            });
          } else if (input && 'unlocker' in input && input.unlocker) {
            builder.addOutput({
              to: input.unlocker.generateLockingBytecode(),
              amount: input.satoshis,
              token: cloneToken(input.token),
            });
          } else {
            builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
          }
          continue;
        }
        if (input && 'unlocker' in input && input.unlocker) {
          builder.addOutput({
            to: input.unlocker.generateLockingBytecode(),
            amount: input.satoshis,
            token: cloneToken(input.token),
          });
        } else {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
        }
      }
      return;
    }
    builder.addOutput({
      to: bMaster.unlocker.generateLockingBytecode(), amount: bMaster.satoshis, token: bMaster.token,
    });
    for (const nftUtxo of group.dataNftUtxos) {
      builder.addOutput({
        to: nftUtxo.unlocker.generateLockingBytecode(), amount: nftUtxo.satoshis, token: nftUtxo.token,
      });
    }
    const occupied = 1 + group.dataNftUtxos.length;
    const lastTransferOffset = delegateFn?.blockLayout?.slots
      .filter((slot) => slot.kind === 'transfer')
      .reduce((max, slot) => Math.max(max, slot.offset), -1) ?? -1;
    // A compiler-route delegate's side-cars are slots of the proxy-owned balanced route and were recreated at
    // those route offsets above. Only legacy delegate geometry places compute resources after the executor.
    const lastComputeOffset = host.delegateComputeResources && !host.compilerRouteDelegateBlock
      ? delegateFn?.blockLayout?.slots
        .filter((slot) => slot.kind === 'keccakSideCar' || slot.kind === 'ecrecoverSideCar')
        .reduce((max, slot) => Math.max(max, slot.offset), -1) ?? -1
      : -1;
    const lastImplementationResourceOffset = Math.max(lastTransferOffset, lastComputeOffset);
    for (let offset = occupied; offset <= lastImplementationResourceOffset; offset += 1) {
      const slot = delegateFn?.blockLayout?.slots.find((candidate) => candidate.offset === offset);
      if (host.delegateComputeResources && slot?.kind === 'keccakSideCar') {
        const sidecarIndex = slot.slotIndex ?? 0;
        const sidecar = host.keccakComputeCoSpendUtxos[sidecarIndex];
        builder.addOutput(sidecar ? {
          to: sidecar.unlocker.generateLockingBytecode(),
          amount: sidecar.satoshis,
          token: {
            category: sidecar.token?.category ?? host.categoryId,
            amount: sidecar.token?.amount ?? 0n,
            nft: {
              capability: 'mutable',
              commitment: host.keccakComputeCommitments[sidecarIndex] ?? '',
            },
          },
        } : { to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
        continue;
      }
      if (host.delegateComputeResources && slot?.kind === 'ecrecoverSideCar') {
        builder.addOutput(host.ecrecoverComputeRecreates[slot.slotIndex ?? 0]
        ?? { to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
        continue;
      }
      if (slot?.kind === 'transfer') {
        const transfer = host.pendingTransfers[delegateTransferSlotsConsumed++];
        builder.addOutput(!transfer || transfer.lockingBytecode.length === 0
          ? { to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS }
          : { to: transfer.lockingBytecode, amount: transfer.amount });
        continue;
      }
      // Other output-only implementation slots are populated by their specialized derivation paths. Reserve
      // their physical coordinates here so a following participant cannot collapse the balanced block.
      builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
    }
  };
  const appendDelegateLoopEntries = (): void => {
    const delegateLoopVars = host.delegateLoopEntryVars();
    if (delegateLoopVars.length === 0) return;
    const delegateFunction = (group: ExternalCallUtxoGroup): AbiFunction | undefined => (
      group.compilerRoute?.abiFunction
    ?? (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
      .find((candidate) => candidate.name === group.functionName)
    );
    const activeDelegate = host.activeDelegateGroupIndex === undefined
      ? undefined : host.lowLevelCallUtxoGroups[host.activeDelegateGroupIndex];
    const delegateGroupIndex = host.activeDelegateGroupIndex !== undefined
      ? (activeDelegate && (delegateFunction(activeDelegate)?.sortedUpsertLoopInfo?.length ?? 0) > 0
        ? host.activeDelegateGroupIndex : -1)
      : host.lowLevelCallUtxoGroups.findIndex((group) => group.callMode === 'delegatecall'
      && (delegateFunction(group)?.sortedUpsertLoopInfo?.length ?? 0) > 0);
    const delegateGroup = delegateGroupIndex < 0 ? undefined : host.lowLevelCallUtxoGroups[delegateGroupIndex];
    const delegateAbiFunction = delegateGroup === undefined ? undefined : delegateFunction(delegateGroup);
    const delegateMaster = delegateGroup?.masterUtxo as UnlockableUtxo | undefined;
    const delegateOutputIndex = delegateMaster ? builder.outputs.findIndex((output) => (
      binToHex(typeof output.to === 'string' ? addressToLockScript(output.to) : output.to)
      === binToHex(delegateMaster.unlocker.generateLockingBytecode())
    && output.token?.category === delegateMaster.token?.category
    )) : -1;
    const delegateBase = delegateOutputIndex >= 0 ? delegateOutputIndex
      : host.blockLayout?.slots.find((slot) => slot.kind === 'lowLevelCall')?.offset;
    const delegateUnlocker = delegateMaster?.unlocker as {
      abiFunction?: { inputs?: ReadonlyArray<{ name: string }> };
      params?: readonly unknown[];
    } | undefined;
    const compact = host.unmaterializedReturnEventCompact(
      delegateAbiFunction?.blockLayout, delegateUnlocker,
    );
    let outputIndex = delegateBase !== undefined
      ? delegateBase + (delegateAbiFunction?.blockLayout?.blockSize ?? 1) - compact
      : host.getLoopEntryOutputBase();
    // The implementation's block can contain output-only slots (most commonly its return-event slot). The
    // preservation helper above emits only master + data NFTs, so materialize any intervening balanced slots
    // before inserting the trailing loop band. Otherwise Array.splice clamps an absolute index beyond the end,
    // shifting every loop and nested-call output left by the number of omitted block slots.
    while (builder.outputs.length < outputIndex) {
      builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
    }
    // Read-only dynamic chunks self-preserve at OP_INPUTINDEX, so they occupy the leading output band before
    // mapping transitions. Written chunks are deliberately absent here: their replacements live in the
    // authenticated suffix rather than at the old chunks' input coordinates.
    if (host.iterationEntryInputs.length > 0) {
      for (const iterUtxo of host.iterationEntryInputs) {
        const chunkOutput = {
          to: iterUtxo.unlocker.generateLockingBytecode(),
          amount: iterUtxo.satoshis,
          token: {
            amount: iterUtxo.token?.amount ?? 0n,
            category: host.categoryId,
            nft: {
              capability: 'mutable' as const,
              commitment: iterUtxo.token?.nft?.commitment ?? '',
            },
          },
        };
        builder.outputs.splice(outputIndex++, 0, chunkOutput);
      }
      host.setIterationEntriesPlacedAtDelegateBase(true);
    }
    for (const lv of delegateLoopVars) {
      const emittedByExternalInsert = host.externalCallEntryInserts.some((insert) => (
        insert.commitment !== ''
      && insert.categoryId === lv.categoryId
      && insert.to.length === lv.lockingBytecode.length
      && insert.to.every((byte, index) => byte === lv.lockingBytecode[index])
      ));
      if (emittedByExternalInsert) continue;
      for (const commitment of host.loopEntryCommitments.get(lv.collection) ?? []) {
        const entryOutput = {
          to: lv.lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: lv.categoryId!,
            nft: { capability: 'mutable' as const, commitment },
          },
        };
        entryOutput.amount = host.loopEntryTransitionSatoshis(lv, commitment)
        ?? BigInt(Math.max(1200, calculateDust(entryOutput)));
        // Earlier composed participant/identity outputs may already have been materialized. The implementation
        // covenant owns an absolute master-relative loop coordinate, so insert at that coordinate rather than
        // appending after whichever caller outputs happened to be built first.
        builder.outputs.splice(outputIndex++, 0, entryOutput);
      }
    }
  };

  return {
    associatedDelegateOutputs,
    appendDelegateGroupOutputs,
    appendDelegateLoopEntries,
    getDelegateTransferSlotsConsumed: () => delegateTransferSlotsConsumed,
  };
}
