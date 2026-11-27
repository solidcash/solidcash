/**
 * phase-boundary extract: STB build-phase extract — low-level call / raw / child-deploy output materialization.
 */

import {
  buildPushdataCommitmentKeeping,
  parsePushdataCommitment,
  type FunctionBlockLayout,
  type StateValue,
} from '@solidcash/utils';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilderOptions } from '../TransactionBuilder.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { stateUpdatesTouchNft } from './early-value-chunk-helpers.js';

export interface MaterializeLowLevelCallOutputsHost {
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallRawInputs: readonly UnlockableUtxo[];
  readonly blockLayout?: FunctionBlockLayout;
  readonly delegateEntriesAfterLowLevel: boolean;
  readonly directCallDelegateBlock: boolean;
  readonly externalCallStateUpdates: ReadonlyMap<string, Map<string, StateValue>>;
  readonly externalCallStateRawCommitments: ReadonlyMap<string, Map<number, string>>;
  /** The records each callee's run derived, by category: they spell its rebuilt records' unchanged values. */
  readonly externalCallDerivedRecords: ReadonlyMap<string, ReadonlyMap<number, string>>;
  readonly childDeploymentOutputs: ReadonlyMap<number, readonly Output[]>;
  readonly builderOptions: TransactionBuilderOptions;
  /** The record a per-turn low-level call's turn reads from this group's run, or none (low-level-call-turns.ts). */
  turnRecord?(group: ExternalCallUtxoGroup): string | undefined;
}

/**
 * Emit remaining low-level call masters/data NFTs (skipping already-associated delegates), raw LLC
 * inputs, and fixed child-deployment genesis frames.
 */
export function materializeLowLevelCallOutputs(
  host: MaterializeLowLevelCallOutputsHost,
  builder: {
    addOutput(output: Output): unknown;
    outputs: Output[];
  },
  associatedDelegateOutputs: ReadonlySet<number>,
): void {
  // Create low-level call outputs (after A's block slots, matching block layout ordering)
  for (const [groupIndex, group] of host.lowLevelCallUtxoGroups.entries()) {
    // A delegate associated with an external proxy group was already emitted immediately after that proxy's
    // fixed block by appendDelegateGroupOutputs. Emitting it again here mints a second implementation master
    // output from one input and is rejected by the implementation's minting-NFT conservation covenant.
    if (associatedDelegateOutputs.has(groupIndex)) continue;
    if (host.delegateEntriesAfterLowLevel && group.callMode === 'delegatecall') continue;
    // A compiler-owned route's complete balanced block (including dynamic resources) precedes its physical
    // implementation. Recreate that executor only after the trailing band has been filled below.
    if (host.directCallDelegateBlock && group.callMode === 'delegatecall') continue;
    const bMaster = group.masterUtxo as UnlockableUtxo;
    builder.addOutput({
      to: bMaster.unlocker.generateLockingBytecode(),
      amount: bMaster.satoshis,
      token: bMaster.token,
    });

    if (group.callMode === 'staticcall' || group.callMode === 'delegatecall') {
      for (const nftUtxo of group.dataNftUtxos) {
        builder.addOutput({
          to: nftUtxo.unlocker.generateLockingBytecode(),
          amount: nftUtxo.satoshis,
          token: nftUtxo.token,
        });
      }
      continue;
    }

    const bStateUpdates = host.externalCallStateUpdates.get(group.categoryId);
    const bCurrentState: Record<string, StateValue> = {};
    for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
      const nftIdx = group.requiredDataNftIndices[i];
      const nftUtxo = group.dataNftUtxos[i];
      if (nftUtxo?.token?.nft?.commitment) {
        const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, group.stateLayout, nftIdx);
        for (const [key, value] of Object.entries(parsed)) {
          bCurrentState[key] = value;
        }
      }
    }
    if (bStateUpdates) {
      for (const [name, value] of bStateUpdates) {
        bCurrentState[name] = value;
      }
    }
    for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
      const nftIdx = group.requiredDataNftIndices[i];
      const nftUtxo = group.dataNftUtxos[i];
      const nftVars = group.stateLayout.variables.filter((variable) => variable.nftIndex === nftIdx);
      const nftIsImmutable = nftVars.length > 0 && nftVars.every((variable) => variable.immutable);
      const nftHasUpdate = stateUpdatesTouchNft(group.stateLayout, bStateUpdates, nftIdx);
      const inputCommitment = nftUtxo.token?.nft?.commitment;
      const commitment = (nftHasUpdate ? undefined
        : host.externalCallStateRawCommitments.get(group.categoryId)?.get(nftIdx))
        ?? (nftIsImmutable && inputCommitment
          ? inputCommitment
          : buildPushdataCommitmentKeeping(
            group.stateLayout, bCurrentState, nftIdx,
            [host.externalCallDerivedRecords.get(group.categoryId)?.get(nftIdx), inputCommitment],
            host.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
          ));
      builder.addOutput({
        to: nftUtxo.unlocker.generateLockingBytecode(),
        amount: nftUtxo.satoshis,
        token: {
          amount: nftUtxo.token?.amount ?? 0n,
          category: group.categoryId,
          nft: {
            capability: nftUtxo.token?.nft?.capability ?? 'mutable',
            commitment,
          },
        },
      });
    }
  }

  // Low-level call raw UTXO outputs (preserved unchanged)
  for (const rawUtxo of host.lowLevelCallRawInputs) {
    builder.addOutput({
      to: rawUtxo.unlocker.generateLockingBytecode(),
      amount: rawUtxo.satoshis,
      token: rawUtxo.token,
    });
  }

  // Child genesis frames are fixed output coordinates: master first, then each mutable data NFT. Inactive
  // rows retain neutral placeholders so the balanced atomic participant never changes width.
  for (const slot of host.blockLayout?.slots.filter((candidate) => candidate.kind === 'deploy') ?? []) {
    while (builder.outputs.length < slot.offset) {
      builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
    }
    const frameWidth = 1 + (host.blockLayout?.slots.filter((candidate) =>
      candidate.kind === 'deployDataNft' && candidate.slotIndex === slot.slotIndex).length ?? 0);
    const frameEnd = slot.offset + frameWidth;
    for (let offset = slot.offset; offset < frameEnd;) {
      const outputs = host.childDeploymentOutputs.get(offset);
      if (outputs && offset + outputs.length > frameEnd) {
        throw new Error(`Child deployment slot ${offset} exceeds its compiler-owned row frame`);
      }
      for (const output of outputs ?? [{
        to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS,
      }]) builder.addOutput(output);
      offset += outputs?.length ?? 1;
    }
  }

  // A per-turn call's records follow, one per turn in turn order, so turn k's sits at the first one's index plus k.
  for (const group of host.lowLevelCallUtxoGroups) {
    const commitment = group.lowLevelCallTurn === undefined ? undefined : host.turnRecord?.(group);
    if (commitment === undefined) continue;
    builder.addOutput({
      to: Uint8Array.of(0x51),
      amount: LOW_LEVEL_TURN_RECORD_SATOSHIS,
      token: { amount: 0n, category: group.categoryId, nft: { capability: 'none', commitment } },
    });
  }
}

/** A per-turn record carrier's value: above dust, within the 1,200 satoshis a caller admits. */
const LOW_LEVEL_TURN_RECORD_SATOSHIS = 1000n;

/** Whether `output` is the record carrier of `group`'s run: an `OP_TRUE` coin of its category with no capability. */
export function isLowLevelTurnRecord(output: Output | undefined, group: Pick<ExternalCallUtxoGroup, 'categoryId'>): boolean {
  const to = output?.to;
  return to instanceof Uint8Array && to.length === 1 && to[0] === 0x51
    && output!.token?.nft?.capability === 'none'
    && output!.token.category.toLowerCase() === group.categoryId.toLowerCase();
}
