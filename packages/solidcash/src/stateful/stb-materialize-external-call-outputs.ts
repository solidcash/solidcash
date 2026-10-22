/**
 * phase-boundary extract: STB build-phase extract — external-call group output materialization.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import {
  type AbiFunction,
  buildChunkCommitment,
  buildEntryNftCovenantScript,
  buildEventNftCovenantScript,
  buildPushdataCommitment,
  computeCollectionHash,
  computeEventNameHash,
  dynamicChunkSignature,
  type FunctionBlockLayout,
  parsePushdataCommitment,
  splitValueIntoChunks,
  type StateValue,
} from '@solidcash/utils';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder, TransactionBuilderOptions } from '../TransactionBuilder.js';
import { addressToLockScript, calculateDust, scriptToLockingBytecode } from '../utils.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import { selectBalancedEntryOutputIdentity } from './collection-lock-strip.js';
import { stateUpdatesTouchNft } from './early-value-chunk-helpers.js';
import type { EntryNftInfo, ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { resolveExternalResultEncoding } from './solidityAbi.js';
import { cloneToken } from './stb-output-utils.js';
import { returnEventNftCommitment } from './return-event-nft-commitment.js';
import { directConventionMasterLock } from './covenant-helpers.js';
import {
  canonicalWriterReturnCommitment,
  isCompilerDescribedMintingBandWriter,
} from './value-chunk-geometry.js';
import type { DerivedChunkOutputObservation } from './value-chunk-persist.js';

export type PendingReturnEventLike = {
  categoryId: string;
  commitment: Uint8Array;
  identity: string;
  provisional?: boolean;
};

export interface MaterializeExternalCallOutputsHost {
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly externalCallStateUpdates: ReadonlyMap<string, ReadonlyMap<string, StateValue>>;
  readonly externalCallStateRawCommitments: ReadonlyMap<string, ReadonlyMap<number, string>>;
  readonly externalCallEntryInserts: ReadonlyArray<{ categoryId: string; to: Uint8Array; commitment: string }>;
  readonly externalCallEntryOutputs: ReadonlyMap<string, ReadonlyMap<number, string>>;
  readonly allInputs: readonly UnlockableUtxo[];
  readonly entryNfts: readonly EntryNftInfo[];
  readonly entryRawCommitments: ReadonlyMap<number, string>;
  readonly derivedChunkOutputs: ReadonlyMap<number, DerivedChunkOutputObservation>;
  readonly pendingReturnEventOutputs: readonly PendingReturnEventLike[];
  readonly categoryId: string;
  readonly builderOptions: TransactionBuilderOptions;
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  readonly delegateDynamicChunksAtSuffix: boolean;
  readonly delegateEntriesAfterLowLevel: boolean;
  readonly delegateReturnEventAfterEvents: boolean;
  readonly mintingOutputSwap?: { from: number; width: number; categoryId: string };
  readonly insertLoopPredecessorInputs: readonly UnlockableUtxo[];
  getExternalCallMasterInputIndex(groupIndex: number): number;
  getExternalCallOutputBase(groupIndex: number): number;
  padOutputsToIndex(builder: TransactionBuilder, index: number): void;
  externalEntryLockingBytecode(
    group: ExternalCallUtxoGroup,
    slot: FunctionBlockLayout['slots'][number],
  ): Uint8Array | undefined;
  tailReturnEventOutputs(): readonly PendingReturnEventLike[];
  /** The digest of the call a direct return record answers; none for a routed one. */
  callRecordDigest?(identity: string): Uint8Array | undefined;
}

/**
 * Materialize external-call participant output blocks (master/data/entries/events/returns)
 * and any deferred delegate-adjacent external return channels. Returns the set of owner
 * entry slots already embedded in a callee block so the owner-entries pass can skip them.
 */
export function materializeExternalCallOutputs(
  host: MaterializeExternalCallOutputsHost,
  builder: TransactionBuilder,
  addReturnOutput: (builder: TransactionBuilder, identity: string, output: Output) => void,
  appendDelegateGroupOutputs: (groupIndex: number) => void,
  deferredDelegateReturnEvents: PendingReturnEventLike[],
  debugOwnMutableOutputs: (stage: string) => void,
): Set<number> {
// Create external call outputs (B's master preserved + B's data NFTs with updated state)

  // Create external call outputs (B's master preserved + B's data NFTs with updated state)
  const embeddedEntrySlots = new Set<number>();
  for (let groupIndex = 0; groupIndex < host.externalCallUtxoGroups.length; groupIndex++) {
    const group = host.externalCallUtxoGroups[groupIndex];
    if (group.sharedGroupIndex !== undefined) continue;
    // Align each callee's output block with its assembled input master index. Dense input placement defers
    // participants past the caller's entry slots; without this pad a layout-less Probe would append immediately
    // after master/data and land on the caller's entry output coordinate (or be overwritten by it).
    const masterInputIndex = host.getExternalCallMasterInputIndex(groupIndex);
    if (masterInputIndex >= 0) host.padOutputsToIndex(builder, masterInputIndex);
    const groupOutputStart = builder.outputs.length;
    // B's master output: preserved unchanged
    const bMaster = group.masterUtxo as UnlockableUtxo;
    if (group.compilerRoute && group.delegateCallGroupIndex !== undefined) {
    // A routed delegate's proxy master is displaced from its packed physical block. Slot zero is only a
    // balanced spacer; the master covenant requires the real minting NFT to be recreated at INPUTINDEX.
      builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
    } else {
      builder.addOutput({
        to: bMaster.unlocker.generateLockingBytecode(),
        amount: bMaster.satoshis,
        token: bMaster.token,
      });
    }

    // Plain .staticcall / .delegatecall groups preserve exact input commitments. A compiler-routed
    // proxy group still owns a balanced output block (entries, events, and its return slot), even
    // when its implementation is invoked with delegatecall, so it must continue through the full
    // block materialization below.
    if (!group.compilerRoute
    && (group.callMode === 'staticcall' || group.callMode === 'delegatecall')) {
      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftUtxo = group.dataNftUtxos[i];
        builder.addOutput({
          to: nftUtxo.unlocker.generateLockingBytecode(),
          amount: nftUtxo.satoshis,
          token: nftUtxo.token,
        });
      }
      continue;
    }

    // B's data NFT outputs with state updates (regular and .call modes)
    const bStateUpdates = host.externalCallStateUpdates.get(group.categoryId);
    const bCurrentState: Record<
    string, StateValue
    > = {};

    // Read current state from B's data NFTs
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

    // Apply B's state overrides
    if (bStateUpdates) {
      for (const [name, value] of bStateUpdates) {
        bCurrentState[name] = value;
      }
    }

    const externalDynamicChunks: Output[] = [];
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
      console.error('external-dynamic-plan', {
        categoryId: group.categoryId,
        functionName: group.functionName,
        compilerRoute: group.compilerRoute?.abiFunction.name,
        logicalSelectors: group.compilerRoute?.logicalSelectors,
        blockInputs: group.blockInputs?.length,
        blockSize: group.blockLayout?.blockSize,
        trailingBase: group.blockLayout?.trailingBase,
        sharedGroupIndex: group.sharedGroupIndex,
        dynamicStateValues: Object.keys(group.dynamicStateValues ?? {}),
        stateUpdates: [...(bStateUpdates?.keys() ?? [])],
      });
    }
    for (const variable of group.stateLayout.variables) {
      if (!variable.dynamic) continue;
      const value = group.dynamicStateValues?.[variable.name]
      ?? bStateUpdates?.get(variable.name);
      if (value === undefined) continue;
      const raw = typeof value === 'string' ? utf8ToBin(value)
        : value instanceof Uint8Array ? value : undefined;
      if (!raw) {
        throw new Error(
          `External dynamic state '${variable.name}' requires a canonical bytes/string value`,
        );
      }
      const collectionHash = computeCollectionHash(
        dynamicChunkSignature(variable.name, variable.type),
      );
      const lockingBytecode = scriptToLockingBytecode(
        buildEntryNftCovenantScript(
          hexToBin(group.categoryId), collectionHash,
          group.externalContract?.inner ? directConventionMasterLock(group.externalContract.inner) : undefined,
        ),
        group.externalContract?.inner?.addressType ?? 'p2sh32',
      );
      for (const [index, chunk] of splitValueIntoChunks(raw).entries()) {
        const output: Output = {
          to: lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: group.categoryId,
            nft: {
              capability: 'mutable',
              commitment: buildChunkCommitment(index, chunk),
            },
          },
        };
        output.amount = BigInt(Math.max(1200, calculateDust(output)));
        externalDynamicChunks.push(output);
      }
    }

    const displacedRouteStateOutputs: Output[] = [];
    // Create B's data NFT outputs with updated commitments
    for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
      const nftIdx = group.requiredDataNftIndices[i];
      const nftUtxo = group.dataNftUtxos[i];
      // Rebuilding an untouched NFT from parsed defaults is not an identity
      // (an immutable-only data NFT can collapse to an empty pubkey commitment).
      // The callee then
      // EQUALVERIFYs UTXO vs OUTPUT commitment.
      const nftVars = group.stateLayout.variables.filter((variable) => variable.nftIndex === nftIdx);
      const nftIsImmutable = nftVars.length > 0 && nftVars.every((variable) => variable.immutable);
      const nftHasUpdate = !nftIsImmutable
      && stateUpdatesTouchNft(group.stateLayout, bStateUpdates, nftIdx);
      const inputCommitment = nftUtxo.token?.nft?.commitment;
      const commitment = (nftHasUpdate ? undefined
        : host.externalCallStateRawCommitments.get(group.categoryId)?.get(nftIdx))
      ?? (nftHasUpdate || !inputCommitment
        ? buildPushdataCommitment(
          group.stateLayout, bCurrentState, nftIdx,
          host.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
        )
        : inputCommitment);
      const stateOutput: Output = {
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
      };
      if (group.compilerRoute && group.delegateCallGroupIndex !== undefined) {
        displacedRouteStateOutputs.push(stateOutput);
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      } else {
        builder.addOutput(stateOutput);
      }
    }

    // Full block: output B's remaining slots (entries, SC, TCs, transfers, events, etc.)
    if (group.blockInputs && group.blockLayout) {
      if (externalDynamicChunks.length > (group.blockLayout.trailingCapacity ?? 0)) {
        throw new Error(
          'External dynamic state exceeds balanced trailing capacity '
        + `(${externalDynamicChunks.length} > ${group.blockLayout.trailingCapacity ?? 0})`,
        );
      }
      // The blockInputs already include master + dataNfts at positions 0..D.
      // The remaining positions (D+1..) need corresponding outputs.
      const dataNftEnd = 1 + group.requiredDataNftIndices.length;
      let eventIdx = 0;
      let keccakIdx = 0;
      let externalDynamicChunkIdx = 0;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_INPUTS === '1') {
      // eslint-disable-next-line no-console
        console.error(`[blockInputs g${groupIndex}] n=${group.blockInputs.length} `
        + `slots=${group.blockLayout.slots.length} :: ${group.blockInputs.slice(0, 24)
          .map((bi, k) => `${k}:${group.blockLayout!.slots[k]?.kind ?? '-'}`
            + `/${bi.token?.nft?.commitment ? 'NFT' : 'plain'}`).join(' ')}`);
        console.error('[block-output-metadata]', {
          groupIndex,
          categoryId: group.categoryId,
          blockSize: group.blockLayout.blockSize,
          trailingBase: group.blockLayout.trailingBase,
          plannedEntryInserts: group.plannedEntryInserts,
          batchPredecessorOutputs: group.batchPredecessorOutputs?.map((output) => ({
            outputBlockSlot: output.outputBlockSlot,
            lockingBytecode: binToHex(output.lockingBytecode),
            commitment: output.commitment.slice(0, 32),
          })),
        });
      }
      const promotedTrailingEnd = Math.max(
        0,
        ...(group.batchPredecessorOutputs ?? []).map(({ outputBlockSlot }) => outputBlockSlot + 1),
      );
      const materializationEnd = Math.max(group.blockInputs.length, promotedTrailingEnd);
      for (let si = dataNftEnd; si < materializationEnd; si++) {
        const input = group.blockInputs[si];
        const slot = group.blockLayout.slots[si];
        const streamed = group.streamedEventPlan?.outputs.get(si);
        if (streamed) {
          const output: Output = {
            to: streamed.lockingBytecode,
            amount: BALANCED_SLOT_SATOSHIS,
            token: { amount: 0n, category: group.categoryId,
              nft: { capability: 'none', commitment: streamed.commitment } },
          };
          output.amount = BigInt(Math.max(Number(output.amount), calculateDust(output)));
          builder.addOutput(output);
          continue;
        }
        const debugEnv = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
        const debugRouteOutputs = debugEnv?.SOLIDC_DEBUG_ROUTE_CONCISE === '1'
          || debugEnv?.SOLIDC_DEBUG_FAILURE_RING === '1';
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_CHUNK_GEOM === '1') {
          console.error('block-loop-pos', { groupIndex, si, absOut: builder.outputs.length, kind: slot?.kind });
        }

        // Matched on the absolute index this iteration is about to fill, across every group: the pin's owning
        // group is not the group it was probed from. See deriveRouteValueChunks.
        const derivedChunk = host.derivedChunkOutputs.get(builder.outputs.length);
        const derivedOccupant = host.allInputs[builder.outputs.length];
        const suffixOwnedChunk = host.delegateDynamicChunksAtSuffix && derivedChunk
        && (derivedChunk.categoryId ?? host.categoryId) === host.categoryId;
        // Cursor-keyed derived overlays must not drop entry pins onto dataNft slots
        // (stale entryIndex=15 while UPDATE lives at INPUTINDEX+3=16).
        const derivedOntoDataNft = slot?.kind === 'dataNft'
        && derivedChunk?.fixedIndex === true
        && derivedChunk.commitment.length >= 128;
        if (derivedChunk && !suffixOwnedChunk && !derivedOntoDataNft
        && derivedOccupant?.token?.nft?.capability !== 'minting') {
          if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
            console.error('chunk-placed', { groupIndex, si, absOut: builder.outputs.length });
          }
          builder.addOutput({
            to: derivedChunk.lockingBytecode,
            amount: 1000n,
            token: {
              amount: 0n,
              category: derivedChunk.categoryId ?? group.categoryId,
              nft: { capability: 'mutable', commitment: derivedChunk.commitment },
            },
          });
          continue;
        }
        const plannedInsertIndex = group.plannedEntryInserts
          ?.findIndex((planned) => planned.outputBlockSlot === si) ?? -1;
        const batchPredecessor = group.batchPredecessorOutputs
          ?.find((planned) => planned.outputBlockSlot === si);
        const routedDynamicResource = group.dynamicChunkResources
          ?.find((resource) => resource.blockSlot === si);

        if (routedDynamicResource && !routedDynamicResource.write) {
          builder.addOutput({
            to: input.unlocker.generateLockingBytecode(),
            amount: input.satoshis,
            token: cloneToken(input.token),
          });
          continue;
        }

        if (batchPredecessor) {
          builder.addOutput({
            to: batchPredecessor.lockingBytecode,
            amount: 1000n,
            token: {
              amount: 0n,
              category: group.categoryId,
              nft: { capability: 'mutable', commitment: batchPredecessor.commitment },
            },
          });
          continue;
        }

        // A fused writer can contribute a trailing predecessor planned against a smaller logical
        // function block. Promotion rebases it onto this carrier's trailing band, which may extend
        // beyond the carrier's balanced input vector. Only explicitly planned outputs may occupy
        // such coordinates; preserve any intervening coordinate as an inert alignment output.
        if (!input) {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
          continue;
        }

        if (plannedInsertIndex >= 0) {
          const plannedInsert = group.plannedEntryInserts![plannedInsertIndex];
          const handle = group.plannedEntryInsertHandles?.[plannedInsertIndex];
          const insert = handle === undefined ? undefined : host.externalCallEntryInserts[handle];
          const commitment = insert?.commitment || plannedInsert.commitment;
          // Multiple cold keys may share one proof input. The later entry slot is
          // then backed by a funder, while its proof witness still names the
          // original collection entry whose lock P' must recreate.
          const proofOffset = plannedInsert.slotIndex === undefined ? undefined
            : (group.internalArgs?.[`__internal__vmapBatchProof_${plannedInsert.slotIndex}`]
              ?? group.compilerRoute?.internalArgs?.[`__internal__vmapBatchProof_${plannedInsert.slotIndex}`]);
          const predecessor = typeof proofOffset === 'bigint' && proofOffset >= 0n
            ? group.blockInputs[Number(proofOffset)]
            : group.blockInputs[plannedInsert.blockSlot];
          builder.addOutput(commitment && predecessor
            ? {
              to: typeof proofOffset === 'bigint' && proofOffset >= 0n
                ? predecessor.unlocker.generateLockingBytecode()
                : insert?.to ?? predecessor.unlocker.generateLockingBytecode(),
              // The relinked predecessor keeps its own value: a fixed 1000 is dust beside a padded head's commitment.
              amount: predecessor.satoshis,
              token: {
                amount: 0n,
                category: group.categoryId,
                nft: { capability: 'mutable', commitment },
              },
            }
            : {
              to: input.unlocker.generateLockingBytecode(),
              amount: input.satoshis,
              token: cloneToken(input.token),
            });
          continue;
        }

        // Trailing cross-contract callee LOOP entry (no block-layout slot, si >= entryLoopStart): mint B's
        // SDK-computed updated commitment. B's covenant pins output[master+blockSize+counter] == coSlot|coNext|newVal,
        // so a wrong commitment reverts (never silent-wrong).
        if (group.entryLoopStart !== undefined && si >= group.entryLoopStart) {
          const commit = group.entryLoopCommitments?.[si - group.entryLoopStart];
          builder.addOutput(commit !== undefined
            ? {
              to: input.unlocker.generateLockingBytecode(),
              amount: input.satoshis,
              token: {
                amount: input.token?.amount ?? 0n,
                category: group.categoryId,
                nft: { capability: input.token?.nft?.capability ?? 'mutable', commitment: commit },
              },
            }
            : { to: input.unlocker.generateLockingBytecode(), amount: input.satoshis, token: cloneToken(input.token) });
          continue;
        }

        // keccak256 side-car slots: recreate with the computed result R_i (from the group's keccakRecreates).
        if (slot?.kind === 'keccakSideCar') {
          const rec = group.keccakRecreates?.[keccakIdx++];
          builder.addOutput(rec ?? {
            to: input.unlocker.generateLockingBytecode(), amount: input.satoshis, token: cloneToken(input.token),
          });
          continue;
        }

        // vmap sorted-entry slot for a cross-contract callee WRITE (docs/deferrals.md #1): mint B's updated entry
        // (UPDATE) or its re-pointed predecessor P' (INSERT) with the commitment derived from B's VM trace. A
        // read-only entry (or an absent-key funder placeholder) has no stored commitment -> mirror the input.
        if (slot?.kind === 'entry') {
          const bEntryOut = host.externalCallEntryOutputs.get(group.categoryId)?.get(si);
          const absoluteOutputIndex = builder.outputs.length;
          // Balanced slots are owned by the physical input at the same coordinate. A group's logical block can
          // retain a pre-layout occupant after participant compaction; it is not authority to recreate that
          // occupant at the group's new coordinate.
          const physicalInput = host.allInputs[absoluteOutputIndex];
          const embeddedEntry = physicalInput === undefined ? undefined : host.entryNfts.find((entry) => (
            entry.utxo !== undefined
          && entry.utxo.txid.toLowerCase() === physicalInput.txid.toLowerCase()
          && entry.utxo.vout === physicalInput.vout
          ));
          const embeddedCommitment = embeddedEntry === undefined
            ? undefined : host.entryRawCommitments.get(embeddedEntry.slotIndex);
          const entryLockingBytecode = host.externalEntryLockingBytecode(group, slot)
          ?? group.batchEntryLockingBytecodes?.get(si)
          ?? input.unlocker.generateLockingBytecode();
          const plannedEntryCommitment = bEntryOut
          ?? group.batchEntryCommitments?.get(si);
          if (debugRouteOutputs && group.compilerRoute && si < 12) {
            console.error('builder-route-entry-output', {
              groupIndex, si, absoluteOutput: builder.outputs.length,
              callMode: group.callMode, hasCommitment: bEntryOut !== undefined,
              hasLockingBytecode: group.batchEntryLockingBytecodes?.has(si) ?? false,
              embeddedEntrySlot: embeddedEntry?.slotIndex,
              hasEmbeddedCommitment: embeddedCommitment !== undefined,
              inputOutpoint: `${input.txid}:${input.vout}`,
              inputCommitment: input.token?.nft?.commitment,
              localEntries: host.entryNfts.map((entry) => ({
                slot: entry.slotIndex,
                outpoint: entry.utxo ? `${entry.utxo.txid}:${entry.utxo.vout}` : undefined,
              })),
              insertPredecessors: host.insertLoopPredecessorInputs.map((entry) =>
                `${entry.txid}:${entry.vout}`),
            });
          }
          const physicalLockingBytecode = physicalInput && 'unlocker' in physicalInput && physicalInput.unlocker
            ? physicalInput.unlocker.generateLockingBytecode()
            : input.unlocker.generateLockingBytecode();
          const selectedIdentity = selectBalancedEntryOutputIdentity({
            plannedCommitment: plannedEntryCommitment,
            declaredLockingBytecode: entryLockingBytecode,
            declaredCategoryId: group.categoryId,
            embeddedCommitment,
            inputLockingBytecode: physicalLockingBytecode,
            inputCategoryId: physicalInput?.token?.category,
          });
          if (selectedIdentity !== undefined) {
            const identityInput = selectedIdentity.preservesEmbeddedEntry ? physicalInput : input;
            if (selectedIdentity.preservesEmbeddedEntry && embeddedEntry !== undefined) {
              embeddedEntrySlots.add(embeddedEntry.slotIndex);
            }
            builder.addOutput({
              to: selectedIdentity.lockingBytecode,
              amount: identityInput?.satoshis ?? input.satoshis,
              token: {
                amount: identityInput?.token?.amount ?? 0n,
                category: selectedIdentity.categoryId,
                nft: {
                  capability: identityInput?.token?.nft?.capability ?? 'mutable',
                  commitment: selectedIdentity.commitment,
                },
              },
            });
            continue;
          }
          // After the 4-wide minting swap, a missing conditional entry is a funder in
          // blockInputs. Cloning that P2PKH leaves output master+offset empty of tokens
          // (updateJobPost: slot 2 / output 30) and FakeToken dies on pred-out GTE.
          if (!input.token && (host.mintingOutputSwap?.categoryId === group.categoryId
          || group.batchEntryLockingBytecodes?.has(si))) {
            const sibling = builder.outputs.slice(groupOutputStart).find((output) =>
              output.token?.category === group.categoryId && output.token.nft?.capability === 'mutable');
            const siblingLock = sibling?.to instanceof Uint8Array
              ? sibling.to
              : sibling?.to !== undefined ? addressToLockScript(sibling.to) : undefined;
            builder.addOutput({
              to: entryLockingBytecode ?? siblingLock ?? Uint8Array.of(0x51),
              amount: BigInt(Math.max(1000, Number(input.satoshis))),
              token: {
                amount: 0n,
                category: group.categoryId,
                nft: { capability: 'mutable', commitment: '00'.repeat(128) },
              },
            });
            continue;
          }
          builder.addOutput({
            to: input.unlocker.generateLockingBytecode(),
            amount: input.satoshis,
            token: cloneToken(input.token),
          });
          continue;
        }

        if (slot?.kind === 'trailing' && externalDynamicChunkIdx < externalDynamicChunks.length) {
          const output = externalDynamicChunks[externalDynamicChunkIdx++];
          builder.addOutput(output);
          continue;
        }

        // X13: B's return event belongs to B's OWN block slot, paired with the funding input the block now
        // carries at the same offset. The commitment comes from B's VM trace (setReturnEventOutput).
        if (slot?.kind === 'returnEvent' && debugRouteOutputs) {
          console.error('builder-route-return-output', {
            groupIndex, si, absoluteOutput: builder.outputs.length,
            returnEventInBlock: group.returnEventInBlock,
            fusedReturnGroupIndex: group.fusedReturnGroupIndex,
            pendingIdentities: host.pendingReturnEventOutputs.map((event) => ({
              identity: event.identity,
              categoryId: event.categoryId,
              commitmentLength: event.commitment.length,
              commitment: binToHex(event.commitment.slice(0, 24)),
            })),
          });
        }
        if (slot?.kind === 'returnEvent' && group.returnEventInBlock) {
          const returnIdentity = `external-call:${group.fusedReturnGroupIndex ?? groupIndex}`;
          const exact = host.pendingReturnEventOutputs.find((r) => r.identity === returnIdentity);
          const first = host.pendingReturnEventOutputs.find((r) => r.identity === `${returnIdentity}:0`);
          // A fused writer's exact return starts as a zero seed. Until its covenant reaches the return check,
          // keep the independently precomputed logical result in that physical slot so the shared route can
          // advance. Once authenticated (including a legitimate `false`), the exact result wins.
          const re = exact?.provisional && first?.commitment.some((byte) => byte !== 0)
            ? first : exact ?? first;
          const writerAbi = group.compilerRoute?.abiFunction
          ?? (group.externalContract?.inner?.artifact?.abi as AbiFunction[] | undefined)
            ?.find((fn) => fn.name === group.functionName);
          const writerReturnsBool = writerAbi?.outputs?.length === 1 && writerAbi.outputs[0].type === 'bool';
          const writerArtifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
          const evmBool = writerReturnsBool && writerArtifact !== undefined
          && resolveExternalResultEncoding(
            writerAbi.resultEncoding,
            writerArtifact,
            writerAbi.outputs!.map((output) => output.type),
            `function '${writerAbi.name}' result`,
          ) === 'evm-abi-v1';
          // State-writing bools (transferFrom) default to success. Views (arbitratorRegistered)
          // default to false so a missing precompute cannot admit an unregistered party.
          // A fused zero seed is unset, not false — SafeERC20 abi.decode(00) fails VERIFY.
          const identity = re?.identity ?? returnIdentity;
          const returnCommitment = returnEventNftCommitment(hexToBin(canonicalWriterReturnCommitment({
            pendingHex: re && re.commitment.length > 0 ? binToHex(re.commitment) : '',
            writesState: writerAbi?.writesState === true,
            evmBool,
            returnsBool: writerReturnsBool,
          })), host.callRecordDigest?.(identity));
          addReturnOutput(builder, identity, {
            to: new Uint8Array([0x51]),
            amount: BALANCED_SLOT_SATOSHIS,
            token: {
              amount: 0n,
              category: group.categoryId,
              nft: { capability: 'none', commitment: returnCommitment },
            },
          });
          continue;
        }

        // Event slots: use auto-derived event NFT output or placeholder
        if (slot?.kind === 'event') {
          const eo = group.eventOutputs?.[eventIdx];
          const debugEventIndexRaw = (globalThis as {
            process?: { env?: Record<string, string> };
          }).process?.env?.SOLIDC_DEBUG_EVENT_INDEX;
          const debugEventIndex = debugEventIndexRaw === undefined
            ? undefined : Number.parseInt(debugEventIndexRaw, 10);
          if (debugEventIndex === builder.outputs.length) {
            console.error('participant-event-materialization', JSON.stringify({
              groupIndex,
              physicalFunction: group.functionName,
              logicalFunction: group.logicalFunctionName,
              routeFunction: group.compilerRoute?.abiFunction.name,
              contract: group.externalContract?.inner?.artifact?.contractName,
              logicalContract: group.logicalContract?.inner?.artifact?.contractName,
              categoryId: group.categoryId,
              masterInput: host.getExternalCallMasterInputIndex(groupIndex),
              outputBase: host.getExternalCallOutputBase(groupIndex),
              slot,
              eventIdx,
              learnedSignature: eo?.eventSignature,
              learnedCommitment: eo?.commitment,
            }));
          }
          if (eo && eo.commitment !== '' && !/^0+$/.test(eo.commitment)) {
          // Use auto-derived commitment
            builder.addOutput({
              to: eo.lockingBytecode,
              amount: 1200n,
              token: {
                amount: 0n,
                category: group.categoryId,
                nft: { capability: 'none', commitment: eo.commitment },
              },
            });
          } else if (group.compilerRoute
          && !isCompilerDescribedMintingBandWriter(group, true, host.messageBusConvention)) {
          // A message-bus route reserves the union of every handler's event slots. Slots not reached by
          // this dispatch are ordinary balanced funding slots and the route covenant binds them by
          // preservation. Mirroring the input also works as the active-slot probe: its empty commitment
          // lets the trace expose the expected event blob, after which `eventOutputs` replaces this slot.
            builder.addOutput({
              to: input.unlocker.generateLockingBytecode(),
              amount: input.satoshis,
              token: cloneToken(input.token),
            });
          } else {
          // Placeholder: create event NFT with empty commitment so B's VM can
          // find the output structure. The iterative derivation will fill it in.
          // A proxy-forwarded participant owns the physical block, but the implementation owns the event ABI.
          // Resolve the logical function first so an unlearned nested delegate emit receives an event-NFT probe
          // rather than a pass-through copy of the unrelated input occupying that balanced slot.
            const bArt = group.logicalArtifact
            ?? group.logicalContract?.inner?.artifact
            ?? group.externalContract?.inner?.artifact
            ?? group.externalContract?.artifact;
            const bAbiFunc = bArt?.abi?.find(
              (f: any) => f.name === (group.logicalFunctionName ?? group.functionName),
            );
            const bEmits: Array<{ eventSignature: string }> = bAbiFunc?.emits ?? [];
            if (eventIdx < bEmits.length) {
              const emitInfo = bEmits[eventIdx];
              const eventNameHash = computeEventNameHash(emitInfo.eventSignature);
              const covenantScript = buildEventNftCovenantScript(
                hexToBin(group.categoryId), eventNameHash,
              );
              const lockingBytecode = scriptToLockingBytecode(
                covenantScript, group.externalContract?.inner?.addressType ?? 'p2sh32',
              );
              builder.addOutput({
                to: lockingBytecode,
                amount: 1200n,
                token: {
                  amount: 0n,
                  category: group.categoryId,
                  nft: { capability: 'none', commitment: '' },
                },
              });
            } else {
            // Fallback pass-through
              builder.addOutput({
                to: input.unlocker.generateLockingBytecode(),
                amount: input.satoshis,
                token: cloneToken(input.token),
              });
            }
          }
          eventIdx++;
        } else {
        // Pass-through: output mirrors input (preserve locking bytecode, value, token)
          builder.addOutput({
            to: input.unlocker.generateLockingBytecode(),
            amount: input.satoshis,
            token: cloneToken(input.token),
          });
        }
      }
    } else {
    // Legacy/unbalanced external calls place their runtime chunk run immediately after the fixed
    // master+data group. The callee covenant derives the same master-relative base.
      for (const output of externalDynamicChunks) builder.addOutput(output);
    }
    // Trailing NEW entry nodes for a cross-contract callee INSERT (docs/deferrals.md #1): B's covenant mints the
    // NEW at masterInputIndex + blockSize, right after B's block. Placed here in group order (skip cleared handles).
    for (const ins of host.externalCallEntryInserts) {
      if (ins.categoryId !== group.categoryId || ins.commitment === '') continue;
      const handle = host.externalCallEntryInserts.indexOf(ins);
      if (group.plannedEntryInsertHandles?.includes(handle)) continue;
      builder.addOutput({
        to: ins.to,
        amount: 1000n,
        token: { amount: 0n, category: group.categoryId, nft: { capability: 'mutable', commitment: ins.commitment } },
      });
    }
    if (group.delegateCallGroupIndex !== undefined) {
      if (!group.delegateEmbeddedInBlock) appendDelegateGroupOutputs(group.delegateCallGroupIndex);
      if (group.compilerRoute) {
      // Preserve the displaced proxy master immediately after its associated implementation band, which
      // is the same absolute coordinate as the proxy-master input in the routed input layout.
        builder.addOutput({
          to: bMaster.unlocker.generateLockingBytecode(), amount: bMaster.satoshis, token: bMaster.token,
        });
        for (const stateOutput of displacedRouteStateOutputs) builder.addOutput(stateOutput);
      }
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_FAILURE_RING === '1') {
      console.error('builder-route-group-output-range', {
        groupIndex,
        functionName: group.functionName,
        contract: group.externalContract?.inner?.artifact.contractName,
        categoryId: group.categoryId,
        start: groupOutputStart,
        end: builder.outputs.length,
      });
    }
  }
  debugOwnMutableOutputs('after-external-groups');

  // A delegate facet is preserved at its absolute input index, and the block layout now reserves that index
  // immediately after the proxy's master/data-NFT region - the position the delegate covenant derives with
  // `OP_INPUTINDEX - (1 + dataNftCount)`. Emit the facet preservation output there FIRST, then the proxy's
  // return channel, so the output side matches the reserved input side instead of claiming its slot.
  if (host.delegateEntriesAfterLowLevel) {
  // X56. The return channel follows the implementation's OWN output-only slots, not the facet master
  // directly. An implementation that also emits resolves its event at `implInput + 1` - the position this
  // used to hand the return event - and computeBlockLayout always orders events before the returnEvent, so
  // deferring the return channel past the event outputs is what makes the two agree. `deferred` is empty
  // for every implementation without an event slot, so a plain returning delegate keeps this exact index.
  // A full external-call block has already emitted its return event at the block's returnEvent slot. Only
  // legacy/transitive tail returns belong beside the delegated implementation; appending an in-block return
  // a second time shifts the implementation preservation output and invalidates its covenant frame.
    const externalReturnEvents = host.tailReturnEventOutputs()
      .filter((r) => r.categoryId !== host.categoryId);
    if (host.delegateReturnEventAfterEvents) deferredDelegateReturnEvents.push(...externalReturnEvents);
    for (const re of (host.delegateReturnEventAfterEvents ? [] : externalReturnEvents)) {
      addReturnOutput(builder, re.identity, {
        to: new Uint8Array([0x51]),
        amount: 800n,
        token: {
          amount: 0n,
          category: re.categoryId,
          nft: {
            capability: 'none',
            commitment: returnEventNftCommitment(re.commitment, host.callRecordDigest?.(re.identity)),
          },
        },
      });
    }
  }


  return embeddedEntrySlots;
}
