/**
 * phase-boundary extract: STB build-phase extract — nested-callee identity, events/entries, and state restoration.
 */

import {
  binToHex, hexToBin,
} from '@bitauth/libauth';
import {
  type AbiFunction,
  buildEventNftCovenantScript,
  computeEventNameHash,
  encodeNftIndexTag,
  type FunctionBlockLayout,
} from '@solidcash/utils';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder, TransactionBuilderOptions } from '../TransactionBuilder.js';
import { addressToLockScript, calculateDust, scriptToLockingBytecode } from '../utils.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { isEmptyValueEntryCommitment } from './SortedList.js';
import { cloneToken } from './stb-output-utils.js';
import { permitsLegacyDelegateEventRepair } from './chunkable-value-write-selection.js';
import {
  encodeJobEventEmitCommitment,
  isLearnedEventEmitCommitment,
  jobEventFieldEmpty,
  jobEventTypeOf,
  stampEmptyJobEventTimestamp,
} from './delegate-event-jobevent-helpers.js';
import {
  chunkableWriterEventOutputIndex,
  isJobEventEmitCommitment,
  isOverwritableEmitOccupant,
  shouldDisplaceForNestedEvent,
} from './same-index-twin-emit.js';
import {
  physicalDelegateSlotOffset,
  placeChunkableWriterEventOutput,
} from './writer-event-delegate-layout.js';
import type { DerivedChunkOutputObservation } from './value-chunk-persist.js';

export type LoopEntryVarLike = {
  collection: string;
  lockingBytecode: Uint8Array;
  categoryId?: string;
  delegate?: boolean;
};

export interface RepairNestedCalleeOutputsHost {
  readonly externalIdentityAnchorUtxos: readonly UnlockableUtxo[];
  readonly loopEntryVars: readonly LoopEntryVarLike[];
  readonly loopEntryCommitments: ReadonlyMap<string, readonly string[]>;
  readonly categoryId: string;
  readonly pendingOutputs: readonly unknown[];
  readonly blockLayout?: FunctionBlockLayout;
  readonly logicalIdentityUtxo?: UnlockableUtxo;
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly allInputs: readonly UnlockableUtxo[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly compilerRouteDelegateBlock: boolean;
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  readonly builderOptions: TransactionBuilderOptions;
  readonly derivedChunkOutputs: ReadonlyMap<number, DerivedChunkOutputObservation>;
  readonly delegateDynamicChunksAtSuffix: boolean;
  loopEntryTransitionSatoshis(variable: LoopEntryVarLike, commitment: string): bigint | undefined;
  delegateLoopEntryVars(): readonly LoopEntryVarLike[];
  getLoopEntryOutputBase(): number;
  getChunkOutputBase(): number;
  getLowLevelCallMasterInputIndex(index: number): number;
  getExternalCallMasterInputIndex(index: number): number;
  chunkableValueWriteInputIndex(): number;
  shouldRematerializePersistUpdate(): boolean;
  getExternalCallEntryOutput(categoryId: string, blockSlot: number): string | undefined;
  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined;
  applyDerivedValueChunks(builder: TransactionBuilder): void;
}

/**
 * Recreate nested-callee identity anchors, mapping INSERTs, legacy delegate events/entries,
 * derived chunk pins, displaced identities, and immutable data-NFT restoration.
 */
export function repairNestedCalleeOutputs(
  host: RepairNestedCalleeOutputsHost,
  builder: TransactionBuilder,
  debugAtomicOutputStage: (stage: string) => void,
): void {
  // A callee's identity anchor is permissionless to spend, so consuming it without recreating it would destroy
  // that contract's logical identity. Recreate each one verbatim, mirroring the input ordering.
  for (const anchor of host.externalIdentityAnchorUtxos) {
    builder.addOutput({
      to: anchor.unlocker.generateLockingBytecode(),
      amount: anchor.satoshis,
      token: anchor.token,
    });
  }
  // Nested callee mapping INSERTs (MarketplaceData publishJobEvent) are not the
  // implementation's own delegated loop and must not sit in the impl trailing
  // band. Emit them after callee identity so the callee proxy's mutable-NFT
  // conservation sees P'/NEW (input EntryNft otherwise has no matching output).
  for (const lv of host.loopEntryVars) {
    if (lv.delegate === true) continue;
    if (lv.categoryId === undefined || lv.categoryId === host.categoryId) continue;
    for (const commitment of host.loopEntryCommitments.get(lv.collection) ?? []) {
      const entryOutput = {
        to: lv.lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: lv.categoryId,
          nft: { capability: 'mutable' as const, commitment },
        },
      };
      entryOutput.amount = host.loopEntryTransitionSatoshis(lv, commitment)
        ?? BigInt(Math.max(1200, calculateDust(entryOutput)));
      builder.addOutput(entryOutput);
    }
  }
  // A compiler route can settle a nested delegate's runtime mapping loop alongside the root's own dynamic
  // storage. Its covenant addresses NEW after callee identity preservation but before the caller's own logical
  // identity anchor. The distinct token category is the ownership boundary that keeps these outputs out of the
  // root's reserved trailing capacity.
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_CHUNK_SCAN === '1'
    && host.delegateLoopEntryVars().length > 0) {
    console.error('append-delegate-loop-entries', {
      physicalBase: builder.outputs.length,
      computedBase: host.getLoopEntryOutputBase(),
      outputCountBefore: builder.outputs.length,
      pendingOutputs: host.pendingOutputs.length,
      externalIdentityAnchors: host.externalIdentityAnchorUtxos.length,
      logicalIdentityAnchor: !!host.logicalIdentityUtxo,
      chunkBase: host.getChunkOutputBase(),
      trailingCapacity: host.blockLayout?.trailingCapacity,
    });
  }
  if (host.logicalIdentityUtxo) {
    builder.addOutput({
      to: host.logicalIdentityUtxo.unlocker.generateLockingBytecode(),
      amount: host.logicalIdentityUtxo.satoshis,
      token: host.logicalIdentityUtxo.token,
    });
  }
  debugAtomicOutputStage('identity-anchors');

  // Nested callee entry NFTs can sit outside that callee's published block (MarketplaceData
  // publishJobEvent predecessor at input 20 while the MD group occupies 14-17). Recreate any
  // still-unmatched nested-category mutable input at its input index so the callee proxy's
  // mutable-NFT conservation and the entry covenant both see a same-index twin.
  const nestedCategories = new Set(
    host.externalCallUtxoGroups.map((group) => group.categoryId).filter((id): id is string => !!id),
  );
  const consumedDynamicChunks = new Set(host.externalCallUtxoGroups.flatMap((group) => (
    group.ordinaryDynamicChunkInputs ?? []
  ).map((chunk) => `${chunk.utxo.txid.toLowerCase()}:${chunk.utxo.vout}`)));
  for (let index = 0; index < host.allInputs.length; index++) {
    const input = host.allInputs[index];
    // Dynamic writes consume the old chunk run and replace it with a potentially shorter new run. Mirroring
    // an unmatched old chunk here creates an unauthenticated extra output at the same collection address.
    if (consumedDynamicChunks.has(`${input.txid.toLowerCase()}:${input.vout}`)) continue;
    const category = input.token?.category;
    if (!category || input.token?.nft?.capability !== 'mutable' || !nestedCategories.has(category)) continue;
    const existing = builder.outputs[index];
    if (!('unlocker' in input) || !input.unlocker) continue;
    if (existing?.token?.category === category && existing.token.nft?.capability === 'mutable') {
      // Only replace an unfilled 128-byte empty-value placeholder. H(0) is
      // sha256(''), so a real UPDATE of key 0 also starts with e3b0c442.
      const outHex = existing.token.nft?.commitment ?? '';
      if (!isEmptyValueEntryCommitment(outHex)) continue;
      builder.outputs[index] = {
        to: input.unlocker.generateLockingBytecode(),
        amount: input.satoshis,
        token: cloneToken(input.token),
      };
      continue;
    }
    const existingLock = existing
      ? (existing.to instanceof Uint8Array ? existing.to : addressToLockScript(existing.to))
      : undefined;
    // A return-event witness is OP_TRUE + none-cap. Splicing a mutable twin here
    // leaves the covenant's witnessed index on the clone (amount/capability fail).
    if (existingLock?.length === 1 && existingLock[0] === 0x51) continue;
    builder.outputs.splice(index, 0, {
      to: input.unlocker.generateLockingBytecode(),
      amount: input.satoshis,
      token: cloneToken(input.token),
    });
  }
  debugAtomicOutputStage('nested-mutable-recreation');

  // Nested publishJobEvent emits at implInput+event.offset (delegate output-only
  // slots are implementation-relative). Identity anchors that landed on that
  // coordinate are re-appended after the event so the event pin keeps its index.
  const displacedDelegateIdentities: Array<{
    to: Uint8Array; amount: bigint; token: NonNullable<Output['token']>;
  }> = [];
  const permitsLegacyNestedDelegateEventRepair = permitsLegacyDelegateEventRepair([
    ...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups,
  ], host.compilerRouteDelegateBlock, host.messageBusConvention);
  for (const [llcIndex, llc] of host.lowLevelCallUtxoGroups.entries()) {
    // Compiler-owned delegate routes materialize every declared event and entry inside their balanced frame.
    // The legacy nested-delegate repair below is only for layouts without that physical ownership boundary.
    if (!permitsLegacyNestedDelegateEventRepair) continue;
    if (llc.callMode !== 'delegatecall') continue;
    const implIndex = host.getLowLevelCallMasterInputIndex(llcIndex);
    if (implIndex < 0) continue;
    const proxyGroup = host.externalCallUtxoGroups.find(
      (group) => group.delegateCallGroupIndex === llcIndex,
    );
    const fn = llc.compilerRoute?.abiFunction
      ?? proxyGroup?.compilerRoute?.abiFunction
      ?? llc.externalContract?.inner.artifact.abi.find((candidate: AbiFunction) => candidate.name === llc.functionName)
      ?? proxyGroup?.externalContract?.inner.artifact.abi.find(
        (candidate: AbiFunction) => candidate.name === (llc.functionName ?? proxyGroup.functionName),
      );
    const eventSlots = (fn?.blockLayout?.slots ?? []).filter((slot: { kind: string; offset: number }) => slot.kind === 'event');
    if (eventSlots.length === 0 || (fn?.emits?.length ?? 0) === 0) continue;
    // initialize (and other full-block delegates) already emit events inside the
    // proxy group's block walk. Only fill slots the walk never visits — e.g.
    // publishJobEvent's event at impl+4 while the MD proxy occupies 3 slots.
    const walkedWidth = proxyGroup?.blockInputs?.length
      ?? (1 + (proxyGroup?.requiredDataNftIndices.length ?? 0));
    const emits = fn?.emits ?? [];
    // Emits are authenticated by the proxy/CREATE category, not the
    // implementation minting UTXO (dest 16 lock pin: aa20ef32 vs impl aa20599f).
    const proxyMinting = host.allInputs.find((input) =>
      input.token?.nft?.capability === 'minting'
      && !!input.token.category
      && input.token.category !== llc.categoryId);
    const categoryId = proxyGroup?.categoryId
      ?? host.externalCallUtxoGroups.find((group) =>
        (group.functionName === llc.functionName || group.logicalFunctionName === llc.functionName)
        && !!group.categoryId)?.categoryId
      ?? proxyMinting?.token?.category
      ?? llc.categoryId;
    if (!categoryId) continue;
    const addressType = proxyGroup?.externalContract?.inner?.addressType
      ?? llc.externalContract?.inner?.addressType ?? 'p2sh32';
    for (let eventIndex = 0; eventIndex < eventSlots.length; eventIndex++) {
      const namedImpl = host.chunkableValueWriteInputIndex();
      const physicalEventOffset = physicalDelegateSlotOffset(
        fn?.blockLayout, eventSlots[eventIndex].offset,
        llc.externalContract?.inner.artifact.delegateOnly === true,
      );
      const outputIndex = namedImpl >= 0
        ? chunkableWriterEventOutputIndex(namedImpl, physicalEventOffset)
        : implIndex + physicalEventOffset;
      // The ordinary balanced-frame event path is authoritative whenever the active layout already projects
      // this implementation slot. Legacy repair is only for a genuinely out-of-frame delegate event; writing
      // it again would create an unauthenticated duplicate immutable NFT at the unnormalised coordinate.
      if (host.blockLayout?.slots.some((slot) => slot.kind === 'event' && slot.offset === outputIndex)) continue;
      const occupant = builder.outputs[outputIndex];
      const occupantNeedsEvent = isOverwritableEmitOccupant(occupant)
        || String(occupant?.token?.nft?.commitment ?? '').startsWith('53434944');
      // Full-block walks already own in-range slots that hold a real emit.
      // SCID / pad occupants still need dest fill (Initialized dest 16).
      if (namedImpl < 0 && eventSlots[eventIndex].offset < walkedWidth && !occupantNeedsEvent) {
        continue;
      }
      const derived = proxyGroup?.eventOutputs?.[eventIndex];
      const emitInfo = emits[eventIndex];
      const lockingBytecode = derived?.lockingBytecode
        ?? (emitInfo
          ? scriptToLockingBytecode(
            buildEventNftCovenantScript(
              hexToBin(categoryId), computeEventNameHash(emitInfo.eventSignature),
            ),
            addressType,
          )
          : undefined);
      if (!lockingBytecode) continue;
      const existing = builder.outputs[outputIndex];
      if (existing?.token?.nft?.capability === 'minting') continue;
      const persistEmit = host.shouldRematerializePersistUpdate();
      if (existing?.token?.nft?.capability === 'mutable'
        && (existing.token.nft.commitment?.length ?? 0) > 2
        && !isOverwritableEmitOccupant(existing, { consumedMutableOk: persistEmit })) {
        continue;
      }
      const visibleArgs = proxyGroup?.logicalFunctionArgs ?? proxyGroup?.functionArgs
        ?? llc.logicalFunctionArgs ?? llc.functionArgs;
      const now = BigInt((host.builderOptions.provider as { getBlockTime?: () => number })
        .getBlockTime?.() ?? 0);
      const eventType = visibleArgs && visibleArgs.length >= 2
        ? jobEventTypeOf(visibleArgs[1]) : undefined;
      const emptyAddressEvent = eventType !== undefined
        && (Array.isArray(visibleArgs![1])
          ? jobEventFieldEmpty(visibleArgs![1][1])
          : jobEventFieldEmpty((visibleArgs![1] as { address_?: unknown }).address_));
      const stampWithdraw = emptyAddressEvent && eventType === 16 && now > 0n;
      const emitEvent = stampWithdraw
        ? stampEmptyJobEventTimestamp(visibleArgs![1], now)
        : visibleArgs?.[1];
      const constructedCommit = emptyAddressEvent && emitEvent !== undefined
        ? encodeJobEventEmitCommitment(
          visibleArgs![0],
          emitEvent,
          (proxyGroup ?? llc).externalContract?.inner?.artifact?.structs,
        )
        : undefined;
      const learnedCommit = String(derived?.commitment ?? '');
      // Initialized(uint64) is OP_1 (`51`); JobEvent classifiers reject it.
      const typedCommit = emitInfo?.eventName === 'Initialized'
        || emitInfo?.eventSignature?.startsWith('Initialized(')
        ? '51'
        : '';
      const derivedCommit = constructedCommit
        ?? (isLearnedEventEmitCommitment(learnedCommit) ? learnedCommit : typedCommit);
      if (!isJobEventEmitCommitment(derivedCommit)) {
        placeChunkableWriterEventOutput(builder.outputs, outputIndex, {
          to: lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: categoryId,
            nft: { capability: 'none', commitment: derivedCommit },
          },
        }, {
          refuseEmpty: persistEmit && !constructedCommit,
          consumedMutableOk: persistEmit,
          destInput: host.allInputs[outputIndex],
          legacyCompatibility: 'job-event-v1',
        });
        continue;
      }
      if (shouldDisplaceForNestedEvent(existing, categoryId) && existing?.token) {
        // Nested events share the callee category with view-return tails and SCID-v1
        // identity anchors. Overwriting either destroys the witness the caller PICKs.
        displacedDelegateIdentities.push({
          to: existing.to instanceof Uint8Array ? existing.to : addressToLockScript(existing.to),
          amount: existing.amount,
          token: existing.token,
        });
      }
      while (builder.outputs.length < outputIndex) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      }
      const placed = {
        to: lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: categoryId,
          nft: { capability: 'none' as const, commitment: derivedCommit },
        },
      };
      placed.amount = BigInt(Math.max(1200, calculateDust(placed)));
      placeChunkableWriterEventOutput(builder.outputs, outputIndex, placed, {
        consumedMutableOk: persistEmit,
        destInput: host.allInputs[outputIndex],
        legacyCompatibility: 'job-event-v1',
      });
    }

    const entrySlots = (fn?.blockLayout?.slots ?? []).filter(
      (slot: { kind: string; offset: number }) => slot.kind === 'entry',
    );
    for (const slot of entrySlots) {
      if (slot.offset < walkedWidth) continue;
      const outputIndex = implIndex + slot.offset;
      const commitment = host.getExternalCallEntryOutput(categoryId, slot.offset);
      if (!commitment) continue;
      const existing = builder.outputs[outputIndex];
      if (existing?.token?.nft?.capability === 'minting') continue;
      const occupant = host.allInputs[outputIndex];
      const lockingBytecode = occupant && 'unlocker' in occupant && occupant.unlocker
        ? occupant.unlocker.generateLockingBytecode()
        : existing?.to instanceof Uint8Array
          ? existing.to
          : undefined;
      if (!lockingBytecode) continue;
      while (builder.outputs.length < outputIndex) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      }
      const placed = {
        to: lockingBytecode,
        amount: occupant?.satoshis ?? 1200n,
        token: {
          amount: 0n,
          category: categoryId,
          nft: { capability: 'mutable' as const, commitment },
        },
      };
      placed.amount = BigInt(Math.max(Number(placed.amount), calculateDust(placed)));
      if (builder.outputs.length === outputIndex) builder.addOutput(placed);
      else builder.outputs[outputIndex] = placed;
    }
  }
  debugAtomicOutputStage('delegate-events-and-entries');

  // Nested publishJobEvent pins value chunks at the covenant's trailing base
  // (proxy/master + blockSize), which is below impl+blockSize when the
  // implementation sits after the proxy block. Materialize every recovered
  // pin; extractRouteChunkPin already rejected non-chunk OUTPUTBYTECODE checks.
  for (const [llcIndex, llc] of host.lowLevelCallUtxoGroups.entries()) {
    // The balanced compiler route owns its trailing dynamic-resource frame. Replaying the legacy absolute
    // delegate placement would duplicate those chunks beyond the route block.
    if (host.compilerRouteDelegateBlock) continue;
    if (llc.callMode !== 'delegatecall') continue;
    const implIndex = host.getLowLevelCallMasterInputIndex(llcIndex);
    if (implIndex < 0) continue;
    const proxyGroupIndex = host.externalCallUtxoGroups.findIndex(
      (group) => group.delegateCallGroupIndex === llcIndex,
    );
    const masterIndex = proxyGroupIndex >= 0
      ? host.getExternalCallMasterInputIndex(proxyGroupIndex)
      : implIndex;
    const fn = llc.compilerRoute?.abiFunction
      ?? llc.externalContract?.inner.artifact.abi.find((candidate: AbiFunction) => candidate.name === llc.functionName);
    const blockSize = fn?.blockLayout?.blockSize ?? 1;
    // Executing impl verifies chunks at INPUTINDEX+trailingBase (15+5=20).
    // min(impl, proxy)+blockSize is 17 and overwrites meceTags.
    const chunkBase = host.getChunkableValueWriteBand()?.start
      ?? Math.max(implIndex + blockSize, masterIndex + blockSize);
    const derivedIndexes = [...host.derivedChunkOutputs.keys()]
      .filter((outputIndex) => {
        if (outputIndex < Math.min(chunkBase, masterIndex + 1)) return false;
        const chunk = host.derivedChunkOutputs.get(outputIndex);
        return !host.delegateDynamicChunksAtSuffix
          || (chunk?.categoryId ?? host.categoryId) !== host.categoryId;
      })
      .sort((left, right) => left - right);

    for (const outputIndex of derivedIndexes) {
      const chunk = host.derivedChunkOutputs.get(outputIndex);
      if (!chunk) continue;
      const existing = builder.outputs[outputIndex];
      const existingLock = existing?.to instanceof Uint8Array
        ? existing.to
        : existing?.to !== undefined ? addressToLockScript(existing.to) : undefined;
      const existingIsChunkAddress = !!existingLock
        && existingLock.length === 35
        && existingLock[0] === 0xaa && existingLock[1] === 0x20
        && existingLock[34] === 0x87;
      if (existing?.token?.nft?.capability === 'minting'
        && (!existingIsChunkAddress || binToHex(existingLock!) === binToHex(chunk.lockingBytecode))) {
        continue;
      }
      // Trailing slots at impl+blockSize are this write's value chunks. A long UPDATE
      // changes sha256(value) and therefore the chunk P2SH32; the previous digest's
      // chunks must be replaced rather than preserved as same-category mutables.
      while (builder.outputs.length < outputIndex) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      }
      const placed = {
        to: chunk.lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: chunk.categoryId ?? host.categoryId,
          nft: { capability: 'mutable' as const, commitment: chunk.commitment },
        },
      };
      placed.amount = BigInt(Math.max(1200, calculateDust(placed)));
      if (builder.outputs.length === outputIndex) builder.addOutput(placed);
      else builder.outputs[outputIndex] = placed;
    }
  }
  debugAtomicOutputStage('delegate-derived-chunk-placement');
  host.applyDerivedValueChunks(builder);
  debugAtomicOutputStage('derived-value-chunk-placement');
  for (const identity of displacedDelegateIdentities) {
    builder.addOutput(identity);
  }
  debugAtomicOutputStage('displaced-delegate-identities');
  for (let index = 0; index < Math.min(host.allInputs.length, builder.outputs.length); index++) {
    const input = host.allInputs[index];
    const output = builder.outputs[index];
    if (!input?.token?.category || !nestedCategories.has(input.token.category)) continue;
    if (input.token.nft?.capability !== 'mutable' || output?.token?.nft?.capability !== 'mutable') continue;
    if (output.token?.category !== input.token.category) continue;
    const outHex = output.token.nft?.commitment ?? '';
    if (!isEmptyValueEntryCommitment(outHex)) continue;
    if (!('unlocker' in input) || !input.unlocker) continue;
    builder.outputs[index] = {
      to: input.unlocker.generateLockingBytecode(),
      amount: input.satoshis,
      token: cloneToken(input.token),
    };
  }

  const commitmentBytes = (commitment: string | Uint8Array | undefined): Uint8Array => {
    if (!commitment) return new Uint8Array();
    return typeof commitment === 'string' ? hexToBin(commitment) : commitment;
  };
  // Rebuild of an immutable-only data NFT is not an identity. Restore the
  // co-spent input commitment so the callee's UTXO==OUTPUT pin succeeds.
  for (const group of host.externalCallUtxoGroups) {
    if (!group.categoryId || !group.stateLayout) continue;
    for (const nftIdx of group.requiredDataNftIndices) {
      const nftVars = group.stateLayout.variables.filter((variable) => variable.nftIndex === nftIdx);
      const taggedImmutable = nftVars.length > 0 && nftVars.every((variable) => variable.immutable);
      const tag = encodeNftIndexTag(nftIdx);
      const source = host.allInputs.find((input) => {
        if (input.token?.category !== group.categoryId || input.token.nft?.capability !== 'mutable') return false;
        const bytes = commitmentBytes(input.token.nft?.commitment);
        return bytes.length >= tag.length && tag.every((byte, at) => bytes[at] === byte);
      });
      if (!source?.token) continue;
      const sourceBytes = commitmentBytes(source.token.nft?.commitment);
      for (const output of builder.outputs) {
        if (output.token?.category !== group.categoryId || output.token.nft?.capability !== 'mutable') continue;
        const outBytes = commitmentBytes(output.token.nft?.commitment);
        if (outBytes.length < tag.length || !tag.every((byte, at) => outBytes[at] === byte)) continue;
        if (outBytes.length === sourceBytes.length && binToHex(outBytes) === binToHex(sourceBytes)) continue;
        const emptyPubkeyDefault = outBytes.length === 35 && outBytes[1] === 0x21
          && outBytes.slice(2).every((byte) => byte === 0);
        if (!taggedImmutable && !emptyPubkeyDefault) continue;
        output.token = cloneToken(source.token);
      }
    }
  }
  for (let index = 0; index < Math.min(host.allInputs.length, builder.outputs.length); index++) {
    const input = host.allInputs[index];
    const output = builder.outputs[index];
    const category = input.token?.category;
    if (!category || !nestedCategories.has(category)) continue;
    if (input.token?.nft?.capability !== 'mutable' || output.token?.nft?.capability !== 'mutable') continue;
    if (output.token?.category !== category) continue;
    const inBytes = commitmentBytes(input.token.nft?.commitment);
    const outBytes = commitmentBytes(output.token.nft?.commitment);
    const emptyPubkeyDefault = outBytes.length === 35 && outBytes[1] === 0x21
      && outBytes.slice(2).every((byte) => byte === 0);
    if (emptyPubkeyDefault && inBytes.length > outBytes.length) {
      output.token = cloneToken(input.token);
    }
  }
  debugAtomicOutputStage('nested-state-restoration');
}
