/**
 * phase-boundary extract: STB build-phase extract — owner master/data front band,
 * compute sidecars, outState, pre-callee chunks.
 */

import {
  buildPushdataCommitment,
  type FunctionBlockLayout,
  parsePushdataCommitment,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder, TransactionBuilderOptions } from '../TransactionBuilder.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import { stateUpdatesTouchNft } from './early-value-chunk-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

export interface MaterializeOwnerFrontOutputsHost {
  readonly masterUtxo: UnlockableUtxo;
  readonly requiredNftIndices: readonly number[];
  readonly dataNftUtxos: readonly UnlockableUtxo[];
  readonly stateRawCommitments: ReadonlyMap<number, string>;
  readonly stateLayout: StateLayout;
  readonly builderOptions: TransactionBuilderOptions;
  readonly categoryId: string;
  readonly readOnlyDataNftUtxos: readonly UnlockableUtxo[];
  readonly delegateComputeResources: boolean;
  readonly compilerRouteDelegateBlock: boolean;
  readonly blockhashCoSpendUtxos: readonly UnlockableUtxo[];
  readonly blockInfoCoSpendUtxos?: readonly UnlockableUtxo[];
  /** The oracle belongs to the delegated implementation; its recreate is emitted with that band. */
  readonly delegateBlockInfoOracle?: boolean;
  readonly blockhashCoSpendSlotOrdinals?: readonly number[];
  readonly keccakComputeCoSpendUtxos: readonly UnlockableUtxo[];
  readonly keccakComputeCommitments: readonly string[];
  readonly preserveBlockLayoutWidth: boolean;
  readonly blockLayout?: FunctionBlockLayout;
  readonly ecrecoverComputeRecreates: readonly Output[];
  readonly keccakLoopRecreates: readonly Output[];
  /** True when a trailing mapping loop precedes the dynamic keccak loop; recreates then follow the entries. */
  readonly keccakLoopFollowsTrailingUser: boolean;
  readonly externalOutStateUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly externalCallStateUpdates: ReadonlyMap<string, ReadonlyMap<string, StateValue>>;
  readonly externalCallStateRawCommitments: ReadonlyMap<string, ReadonlyMap<number, string>>;
  readonly iterationEntryInputs: readonly UnlockableUtxo[];
  /** Whether the assembled inputs co-spend the iteration chunk run before the callee blocks. */
  readonly iterationChunksPrecedeCallees: boolean;
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly delegateDynamicChunksAtSuffix: boolean;
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
}

/**
 * Emit the owner master/data/read-only front band, fixed compute sidecars, keccak-loop/ecrecover
 * recreations, external outState groups, and optional pre-callee iteration chunks.
 * Returns whether pre-callee loop chunks were placed (trailing iteration must skip when true).
 */
export function materializeOwnerFrontOutputs(
  host: MaterializeOwnerFrontOutputsHost,
  builder: TransactionBuilder,
  currentState: Readonly<Record<string, StateValue>>,
): boolean {
// Create master UTXO output (preserving locking bytecode and token)
  builder.addOutput({
    to: host.masterUtxo.unlocker.generateLockingBytecode(),
    amount: host.masterUtxo.satoshis,
    token: host.masterUtxo.token,
  });

  // Create data NFT outputs with updated commitments (only for required NFTs)
  for (let i = 0; i < host.requiredNftIndices.length; i++) {
    const nftIdx = host.requiredNftIndices[i];
    const nftUtxo = host.dataNftUtxos[i];

    const commitment = host.stateRawCommitments.get(nftIdx) ?? buildPushdataCommitment(
      host.stateLayout, currentState, nftIdx, host.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
    );

    builder.addOutput({
      to: nftUtxo.unlocker.generateLockingBytecode(),
      amount: nftUtxo.satoshis,
      token: {
        amount: nftUtxo.token?.amount ?? 0n,
        category: host.categoryId,
        nft: {
          capability: nftUtxo.token?.nft?.capability ?? 'mutable',
          commitment,
        },
      },
    });
  }

  // Create read-only data NFT outputs (commitment preserved unchanged)
  for (const roUtxo of host.readOnlyDataNftUtxos) {
    builder.addOutput({
      to: roUtxo.unlocker.generateLockingBytecode(),
      amount: roUtxo.satoshis,
      token: roUtxo.token,
    });
  }

  const ownsFrontComputeResources = !host.delegateComputeResources || host.compilerRouteDelegateBlock;
  const blockhashOutput = (index: number): Output | undefined => {
    const bhUtxo = host.blockhashCoSpendUtxos[index];
    return bhUtxo ? {
      to: bhUtxo.unlocker.generateLockingBytecode(),
      amount: bhUtxo.satoshis,
      token: bhUtxo.token,
    } : undefined;
  };
  const keccakOutput = (index: number): Output | undefined => {
    const kUtxo = host.keccakComputeCoSpendUtxos[index];
    return kUtxo ? {
      to: kUtxo.unlocker.generateLockingBytecode(),
      amount: kUtxo.satoshis,
      token: {
        category: kUtxo.token?.category ?? host.categoryId,
        amount: kUtxo.token?.amount ?? 0n,
        nft: { capability: 'mutable' as const, commitment: host.keccakComputeCommitments[index] ?? '' },
      },
    } : undefined;
  };
  if (host.preserveBlockLayoutWidth && host.blockLayout && ownsFrontComputeResources) {
    const blockhashOrdinals = host.blockhashCoSpendSlotOrdinals
    ?? host.blockhashCoSpendUtxos.map((_utxo, index) => index);
    const fixedComputeSlots = host.blockLayout.slots.filter((slot) => (
      slot.kind === 'blockhashOracle' || (slot.kind === 'blockInfoOracle' && !host.delegateBlockInfoOracle)
      || slot.kind === 'keccakSideCar' || slot.kind === 'ecrecoverSideCar'
    )).sort((left, right) => left.offset - right.offset);
    let blockhashOrdinal = 0;
    for (const slot of fixedComputeSlots) {
      while (builder.outputs.length < slot.offset) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      }
      let output: Output | undefined;
      if (slot.kind === 'blockhashOracle') {
        const activeIndex = blockhashOrdinals.indexOf(blockhashOrdinal++);
        output = activeIndex >= 0 ? blockhashOutput(activeIndex) : undefined;
      } else if (slot.kind === 'blockInfoOracle') {
        const oracle = host.blockInfoCoSpendUtxos?.[0];
        output = oracle === undefined ? undefined : {
          to: oracle.unlocker.generateLockingBytecode(),
          amount: oracle.satoshis,
          token: oracle.token,
        };
      } else if (slot.kind === 'keccakSideCar') {
        output = keccakOutput(slot.slotIndex ?? 0);
      } else {
        output = host.ecrecoverComputeRecreates[slot.slotIndex ?? 0];
      }
      builder.addOutput(output ?? { to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
    }
  } else {
  // Legacy layouts emit their active compute resources densely; they do not publish inactive coordinates.
    for (let index = 0; index < host.blockhashCoSpendUtxos.length; index++) {
      builder.addOutput(blockhashOutput(index)!);
    }
    for (const oracle of host.delegateBlockInfoOracle ? [] : host.blockInfoCoSpendUtxos ?? []) {
      builder.addOutput({
        to: oracle.unlocker.generateLockingBytecode(),
        amount: oracle.satoshis,
        token: oracle.token,
      });
    }
    if (ownsFrontComputeResources) {
      for (let index = 0; index < host.keccakComputeCoSpendUtxos.length; index++) {
        builder.addOutput(keccakOutput(index)!);
      }
    }
  }

  // Dynamic keccak loop: recreate the N trailing side-cars, each with its iteration result R_i. In the MVP
  // layout (no other front-region slots) these sit at [blockSize, blockSize+N) - right after the data NFTs.
  // When a mapping loop precedes the keccak loop the side-cars follow the mapping outputs, so
  // materializeRuntimeLoopTrailing emits them after the entry band instead of here.
  if (!host.keccakLoopFollowsTrailingUser) {
    for (const rec of host.keccakLoopRecreates) builder.addOutput(rec);
  }

  // ecrecover recovery-pair recreations (right after the keccak side-cars, matching the ecrecoverSideCar slots):
  // A commits H_A (the A->B binding hash), B commits the recovered pubkey Q. Built by buildEcrecoverComputeSidecars.
  if (ownsFrontComputeResources && !host.preserveBlockLayoutWidth) {
    for (const rec of host.ecrecoverComputeRecreates) builder.addOutput(rec);
  }

  // Create external outState outputs (same pattern as external call preservation)
  for (const group of host.externalOutStateUtxoGroups) {
  // B's master output: preserved unchanged
    const bMaster = group.masterUtxo as UnlockableUtxo;
    builder.addOutput({
      to: bMaster.unlocker.generateLockingBytecode(),
      amount: bMaster.satoshis,
      token: bMaster.token,
    });

    // B's data NFT outputs with state updates
    const bStateUpdates = host.externalCallStateUpdates.get(group.categoryId);
    const bCurrentState: Record<
    string, StateValue
    > = {};

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
        : buildPushdataCommitment(
          group.stateLayout, bCurrentState, nftIdx,
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

    // B's blockhash oracle recreations (after B's data NFT outputs, before keccak side-cars), matching the
    // input order master < dataNft < blockhashOracle < keccakSideCar.
    for (const rec of group.blockhashCoSpendRecreates ?? []) builder.addOutput(rec);

    // B's keccak256 side-car recreations (after B's data NFT outputs, matching the input order).
    for (const rec of group.keccakRecreates ?? []) builder.addOutput(rec);
  }

  // Loop external-call case: when the read array's chunk run is co-spent BEFORE the callees (input order
  // master..chunk..callees), and the covenant verifies callee output==input by index, the chunk
  // preservation outputs must precede the callee outputs here too. Emit them now; the trailing
  // iteration-entry block below skips itself when this fired. Dense placement instead appends the callee
  // blocks right after the caller's block and the chunk run after them: emitting the copies here would put
  // them on the callees' coordinates, where the callees' own re-creations later overwrite them, so the
  // trailing block emits them at their own input indices.
  // Delegate trailing storage lives at implementationInput+trailingBase. Emitting read-only chunks
  // before the implementation band would occupy its master output.
  // Read-only chunks must not precede a co-spent implementation: that implementation
  // self-preserves at OP_INPUTINDEX, so an early chunk output overwrites the master.
  const loopChunkBeforeCallees = host.iterationEntryInputs.length > 0
  && host.externalCallUtxoGroups.length > 0
  && host.iterationChunksPrecedeCallees
  && !host.delegateDynamicChunksAtSuffix
  && !host.lowLevelCallUtxoGroups.some((group) => group.callMode === 'delegatecall');
  if (loopChunkBeforeCallees) {
    for (const iterUtxo of host.iterationEntryInputs) {
      builder.addOutput({
        to: iterUtxo.unlocker.generateLockingBytecode(),
        amount: iterUtxo.satoshis,
        token: {
          amount: iterUtxo.token?.amount ?? 0n,
          category: host.categoryId,
          nft: { capability: 'mutable', commitment: iterUtxo.token?.nft?.commitment ?? '' },
        },
      });
    }
  }

  return loopChunkBeforeCallees;
}
