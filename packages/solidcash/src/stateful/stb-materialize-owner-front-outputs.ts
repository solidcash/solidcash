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
  isAuxiliaryBlockSlot,
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

  // Unified front-region auxiliary co-spend band outputs. One driver walks the compiler's emitted band slots
  // (readOnlyDataNft, blockhashOracle, blockInfoOracle, keccakSideCar, ecrecoverSideCar) and recreates each
  // family in that order, matching the input driver. Positioned mode pads inactive slots at their offsets;
  // dense mode emits only active co-spends. Manual builders without a layout use the canonical dense order.
  const readOnlyOutputs = host.readOnlyDataNftUtxos.map((roUtxo): Output => ({
    to: roUtxo.unlocker.generateLockingBytecode(),
    amount: roUtxo.satoshis,
    token: roUtxo.token,
  }));
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
  const blockInfoOutput = (): Output | undefined => {
    if (host.delegateBlockInfoOracle) return undefined;
    const oracle = host.blockInfoCoSpendUtxos?.[0];
    return oracle === undefined ? undefined : {
      to: oracle.unlocker.generateLockingBytecode(),
      amount: oracle.satoshis,
      token: oracle.token,
    };
  };
  const blockhashOrdinals = host.blockhashCoSpendSlotOrdinals
    ?? host.blockhashCoSpendUtxos.map((_utxo, index) => index);

  const auxSlots = host.blockLayout
    ? host.blockLayout.slots.filter((slot) => isAuxiliaryBlockSlot(slot) && slot.kind !== 'lowLevelCall') : [];
  let readOnlyIdx = 0, bhOrdinal = 0, kIdx = 0, erIdx = 0;
  const positioned = host.preserveBlockLayoutWidth && host.blockLayout !== undefined && ownsFrontComputeResources;
  const denseOutputs: Output[] = [];
  const emitAt = (slotOffset: number, output: Output | undefined): void => {
    if (positioned) {
      while (builder.outputs.length < slotOffset) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      }
      builder.addOutput(output ?? { to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
    } else if (output) {
      denseOutputs.push(output);
    }
  };
  for (const slot of auxSlots) {
    switch (slot.kind) {
      case 'readOnlyDataNft':
        emitAt(slot.offset, readOnlyIdx < readOnlyOutputs.length ? readOnlyOutputs[readOnlyIdx++] : undefined);
        break;
      case 'blockhashOracle': {
        const activeIndex = positioned ? blockhashOrdinals.indexOf(bhOrdinal) : bhOrdinal;
        bhOrdinal += 1;
        emitAt(slot.offset, activeIndex >= 0 ? blockhashOutput(activeIndex) : undefined);
        break;
      }
      case 'blockInfoOracle':
        if (positioned && host.delegateBlockInfoOracle) break;
        emitAt(slot.offset, blockInfoOutput());
        break;
      case 'keccakSideCar':
        emitAt(slot.offset, ownsFrontComputeResources
          ? keccakOutput(positioned ? (slot.slotIndex ?? 0) : kIdx++) : undefined);
        break;
      case 'ecrecoverSideCar':
        emitAt(slot.offset, ownsFrontComputeResources
          ? host.ecrecoverComputeRecreates[positioned ? (slot.slotIndex ?? 0) : erIdx++] : undefined);
        break;
      default:
        break;
    }
  }
  if (host.blockLayout === undefined) {
    // Manual builder without a block layout: emit the canonical dense order directly.
    for (const output of readOnlyOutputs) builder.addOutput(output);
    for (let index = 0; index < host.blockhashCoSpendUtxos.length; index++) builder.addOutput(blockhashOutput(index)!);
    const bio = blockInfoOutput();
    if (bio) builder.addOutput(bio);
    if (ownsFrontComputeResources) {
      for (let index = 0; index < host.keccakComputeCoSpendUtxos.length; index++) builder.addOutput(keccakOutput(index)!);
      for (const rec of host.ecrecoverComputeRecreates) builder.addOutput(rec);
    }
  } else {
    for (const output of denseOutputs) builder.addOutput(output);
  }

  // Dynamic keccak loop side-car recreations are emitted by materializeMidBuildOutputsCascade at the start of
  // the trailing band (after every fixed block slot), or by materializeRuntimeLoopTrailing when a mapping loop
  // precedes the keccak loop. They no longer live here: containers/transfers/events are fixed slots emitted
  // later in the cascade, and emitting the side-cars before them desynchronized the output coordinate.

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
