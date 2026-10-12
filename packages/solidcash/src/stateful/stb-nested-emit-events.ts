/**
 * phase-boundary extract: STB class-body extract — nested chunkable-writer emit reassert.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { scriptToLockingBytecode } from '../utils.js';
import {
  buildEventNftCovenantScript,
  computeEventNameHash,
} from '@solidcash/utils';
import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { permitsLegacyValueChunkEventReconstruction } from './chunkable-value-write-selection.js';
import {
  encodeJobEventEmitCommitment,
  jobEventFieldEmpty,
  jobEventTypeOf,
  stampEmptyJobEventTimestamp,
} from './delegate-event-jobevent-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { legacyGroupLooksLikePublishJobEvent } from './legacy-planning-heuristics.js';
import {
  chunkableWriterEventOutputIndex,
  isCreatedJobEventCommitment,
  isJobEventEmitCommitment,
  relocateJobEventEmitToDest,
} from './same-index-twin-emit.js';
import {
  chunkableValueWriteAbi,
  chunkableValueWriteGroups,
  hasChunkableValueWriteMetadata,
  isInitialChunkableValueWrite,
  chunkableValueWriteCategory,
  permitsLegacyNamedValueChunkFallbackForGroups,
  shouldRematerializePersistUpdateForHost,
} from './stb-chunkable-write-planning.js';
import {
  chunkableValueWriteInputIndex,
  scaledEmitOutputIndex,
  type ScaledPreserveEmitHost,
} from './stb-scaled-preserve-emit.js';
import { selectCompilerWriterEvent } from './value-chunk-base-writer-select.js';
import {
  isPersistedCompatibilityValueChunkReady,
  persistedJobEventsWidth,
} from './value-chunk-persist.js';
import { placeChunkableWriterEventOutput } from './writer-event-delegate-layout.js';

export interface NestedEmitEventsHost extends ScaledPreserveEmitHost {
  readonly pendingValueChunkPredecessors: UnlockableUtxo[];
  forcedChunkableValueWriteBandStart?: number;
  detachedEventReceipts: Array<{ eventSignature: string; commitment: string }>;
  readonly builderOptions: { provider: object };
  ensureDistinctJobEventNfts(builder: TransactionBuilder): void;
  materializeValueChunkBand(builder: TransactionBuilder): void;
  placeValueChunkPredecessorInputs(extras?: UnlockableUtxo[]): void;
  reassertPersistedValueChunkOneToOnes(builder: TransactionBuilder, emitDest: number): void;
}

/**
 * Reassert the chunkable writer's compiler-owned event coordinate after occupancy repairs.
 * Older artifacts without write metadata retain their historical event reconstruction below.
 */
export function reassertNestedEmitEvents(
  host: NestedEmitEventsHost,
  builder: TransactionBuilder,
): void {
  const selectedWriter = chunkableValueWriteGroups(host);
  const proxyGroup = selectedWriter.external;
  const llcIndex = selectedWriter.lowLevelIndex;
  const llcGroup = selectedWriter.lowLevel;
  const eventSelection = selectCompilerWriterEvent(
    [proxyGroup, llcGroup].filter((group): group is ExternalCallUtxoGroup => group !== undefined),
  );
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_EMIT_MATCH === '1') {
    const publishJobEventGroups = [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]
      .filter((group) => legacyGroupLooksLikePublishJobEvent(group));
    console.error('reassert-nested-emit-enter', {
      eventSelection: eventSelection.status,
      publishJobEventGroups: publishJobEventGroups.length,
      allExt: host.externalCallUtxoGroups.map((group, index) => ({
        index,
        name: group.functionName ?? group.logicalFunctionName,
        shared: group.sharedGroupIndex,
        arg1Type: jobEventTypeOf((group.logicalFunctionArgs ?? group.functionArgs)?.[1]),
      })),
      allLlc: host.lowLevelCallUtxoGroups.map((group, index) => ({
        index,
        name: group.functionName ?? group.logicalFunctionName,
        arg1Type: jobEventTypeOf((group.logicalFunctionArgs ?? group.functionArgs)?.[1]),
      })),
      groups: publishJobEventGroups.map((group) => ({
        name: group.functionName ?? group.logicalFunctionName,
        arg1Type: jobEventTypeOf((group.logicalFunctionArgs ?? group.functionArgs)?.[1]),
        eventCommits: (group.eventOutputs ?? []).map((eventOutput) => String(eventOutput?.commitment ?? '').slice(0, 20)),
      })),
    });
  }
  if (eventSelection.status === 'ambiguous') return;
  const legacyEventFallback = eventSelection.status === 'absent'
    && permitsLegacyValueChunkEventReconstruction(
      [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups],
      hasChunkableValueWriteMetadata(host),
      host.messageBusConvention,
    );
  if (eventSelection.status === 'absent' && !legacyEventFallback) return;
  const publishFn = chunkableValueWriteAbi(host);
  // A known writer that declares no event emits none. Reconstructing one mints an immutable NFT no covenant reads,
  // branded with the executing implementation's category under a delegate (which DX-8 conservation refuses).
  if (eventSelection.status === 'absent' && publishFn !== undefined && (publishFn.emits?.length ?? 0) === 0
    && !publishFn.blockLayout?.slots.some((slot) => slot.kind === 'event')) return;
  const eventOffset = eventSelection.status === 'exact'
    ? eventSelection.slotOffset
    : publishFn?.blockLayout?.slots.find((slot) => slot.kind === 'event')?.offset ?? 4;
  const impl = chunkableValueWriteInputIndex(host);
  const dest = eventSelection.status === 'exact'
    ? (impl < 0 ? -1 : impl + eventOffset)
    : scaledEmitOutputIndex(host, builder.outputs.length)
      ?? chunkableWriterEventOutputIndex(impl, eventOffset);
  const persistEmitEarly = shouldRematerializePersistUpdateForHost(host);
  const categoryId = eventSelection.status === 'exact'
    ? eventSelection.categoryId : chunkableValueWriteCategory(host);
  const emitInfo = eventSelection.status === 'exact'
    ? { eventSignature: eventSelection.eventSignature }
    : publishFn?.emits?.[0];
  const derived = eventSelection.status === 'exact'
    ? eventSelection.eventOutput
    : proxyGroup?.eventOutputs?.[0]
      ?? llcGroup?.eventOutputs?.[0];
  if (dest < 0 || (impl >= 0 && dest <= impl)) {
    if (!legacyEventFallback) return;
    const fallback = chunkableWriterEventOutputIndex(impl, eventOffset);
    if (fallback >= 0) {
      relocateJobEventEmitToDest(builder.outputs, fallback, {
        consumedMutableOk: persistEmitEarly,
        preferCreated: isInitialChunkableValueWrite(host),
      });
    }
    // Still append distinct JobEvent NFTs for multi-emit receipt/queryFilter.
    const earlyCategory = categoryId
      ?? host.externalCallUtxoGroups.find((group) => (
        (group.functionName ?? group.logicalFunctionName) === '__forward'
        || legacyGroupLooksLikePublishJobEvent(group)
      ))?.categoryId
      ?? host.lowLevelCallUtxoGroups.find((group) => (
        legacyGroupLooksLikePublishJobEvent(group)
      ))?.categoryId;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EMIT_MATCH === '1') {
      console.error('nested-emit-early-dest', {
        dest, impl, fallback, categoryId, earlyCategory: earlyCategory?.slice(0, 16),
      });
    }
    host.ensureDistinctJobEventNfts(builder);
    return;
  }
  const debugEventIndex = Number.parseInt(
    (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EVENT_INDEX ?? '',
    10,
  );
  if (debugEventIndex === dest) {
    console.error('stateful-nested-event-owner', {
      impl,
      dest,
      categoryId,
      selectedExternalGroup: proxyGroup && {
        index: host.externalCallUtxoGroups.indexOf(proxyGroup),
        categoryId: proxyGroup.categoryId,
        functionName: proxyGroup.functionName,
        logicalFunctionName: proxyGroup.logicalFunctionName,
        delegateCallGroupIndex: proxyGroup.delegateCallGroupIndex,
        route: proxyGroup.compilerRoute?.abiFunction.name,
      },
      selectedLowLevelGroup: llcIndex >= 0 ? {
        index: llcIndex,
        categoryId: host.lowLevelCallUtxoGroups[llcIndex].categoryId,
        functionName: host.lowLevelCallUtxoGroups[llcIndex].functionName,
        logicalFunctionName: host.lowLevelCallUtxoGroups[llcIndex].logicalFunctionName,
        route: host.lowLevelCallUtxoGroups[llcIndex].compilerRoute?.abiFunction.name,
      } : undefined,
      selectedWriterViews: [proxyGroup, llcGroup].filter((group) => group !== undefined).map((group) => ({
        categoryId: group.categoryId,
        functionName: group.functionName,
        logicalFunctionName: group.logicalFunctionName,
        delegateCallGroupIndex: group.delegateCallGroupIndex,
        sharedGroupIndex: group.sharedGroupIndex,
        route: group.compilerRoute?.abiFunction.name,
      })),
    });
  }
  if (!categoryId) return;
  const minting = host.findMintingInputIndex(categoryId);
  if (minting >= 0 && dest === minting) return;
  const addressType = proxyGroup?.externalContract?.inner?.addressType
    ?? (llcIndex >= 0 ? host.lowLevelCallUtxoGroups[llcIndex].externalContract?.inner?.addressType : undefined)
    ?? 'p2sh32';
  const emitSignature = emitInfo?.eventSignature
    ?? (legacyEventFallback ? 'JobEvent(uint256,JobEventData)' : undefined);
  if (!emitSignature) return;
  const lockingBytecode = derived?.lockingBytecode ?? scriptToLockingBytecode(
    buildEventNftCovenantScript(hexToBin(categoryId), computeEventNameHash(emitSignature)), addressType,
  );
  let constructedCommit: string | undefined;
  if (legacyEventFallback) {
    const visibleArgs = proxyGroup?.logicalFunctionArgs ?? proxyGroup?.functionArgs
      ?? (llcIndex >= 0
        ? host.lowLevelCallUtxoGroups[llcIndex].logicalFunctionArgs
          ?? host.lowLevelCallUtxoGroups[llcIndex].functionArgs
        : undefined);
    const structs = proxyGroup?.externalContract?.inner?.artifact?.structs
      ?? (llcIndex >= 0
        ? host.lowLevelCallUtxoGroups[llcIndex].externalContract?.inner?.artifact?.structs
        : undefined);
    const now = BigInt((host.builderOptions.provider as { getBlockTime?: () => number })
      .getBlockTime?.() ?? 0);
    const eventType = visibleArgs && visibleArgs.length >= 2
      ? jobEventTypeOf(visibleArgs[1]) : undefined;
    const emptyAddressEvent = eventType !== undefined
      && (Array.isArray(visibleArgs![1])
        ? jobEventFieldEmpty(visibleArgs![1][1])
        : jobEventFieldEmpty((visibleArgs![1] as { address_?: unknown }).address_));
    // Compatibility for the historical timestamped event encoding, before traces published exact outputs.
    const stampWithdraw = emptyAddressEvent && eventType === 16 && now > 0n;
    const emitEvent = stampWithdraw
      ? stampEmptyJobEventTimestamp(visibleArgs![1], now)
      : visibleArgs?.[1];
    constructedCommit = emptyAddressEvent && emitEvent !== undefined
      ? encodeJobEventEmitCommitment(visibleArgs![0], emitEvent, structs)
      : undefined;
  }
  const eventCommitment = constructedCommit ?? derived?.commitment;
  if (!legacyEventFallback && !eventCommitment) return;
  const persistEmit = shouldRematerializePersistUpdateForHost(host);
  // Only descriptor-free legacy plans infer detached receipts from the historical JobEvent wire.
  // An exact compiler-described event owns its own receipt; similarly-shaped sibling NFT commitments do not.
  if (legacyEventFallback && emitSignature && categoryId) {
    const nextCommit = (eventCommitment ?? '').toLowerCase();
    const detachCommit = (commit: string): void => {
      if (!isJobEventEmitCommitment(commit)) return;
      if (commit.toLowerCase() === nextCommit) return;
      if (host.detachedEventReceipts.some((entry) => entry.commitment.toLowerCase() === commit.toLowerCase())) {
        return;
      }
      host.detachedEventReceipts.push({ eventSignature: emitSignature, commitment: commit });
    };
    for (const output of builder.outputs) {
      if (output?.token?.category !== categoryId) continue;
      if (output?.token?.nft?.capability !== 'none') continue;
      detachCommit(String(output?.token?.nft?.commitment ?? ''));
    }
    // Nested publishJobEvent rows may each learn a commitment even when only one
    // physical event slot is reasserted onto the covenant dest. Name discovery is legacy-only.
    const publishJobEventGroups = permitsLegacyNamedValueChunkFallbackForGroups(host)
      ? [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]
        .filter((group) => legacyGroupLooksLikePublishJobEvent(group))
      : [];
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EMIT_MATCH === '1') {
      console.error('publishJobEvent-groups', publishJobEventGroups.map((group, index) => ({
        index,
        name: group.functionName ?? group.logicalFunctionName,
        route: group.compilerRoute?.abiFunction?.name,
        eventOutputs: (group.eventOutputs ?? []).map((eventOutput) => ({
          sig: eventOutput?.eventSignature,
          commit: String(eventOutput?.commitment ?? '').slice(0, 24),
          created: isCreatedJobEventCommitment(String(eventOutput?.commitment ?? '')),
        })),
        arg0: (() => {
          const args = group.logicalFunctionArgs ?? group.functionArgs;
          return args?.[0] === undefined ? undefined : String(args[0]);
        })(),
        arg1Type: (() => {
          const args = group.logicalFunctionArgs ?? group.functionArgs;
          return args?.[1] === undefined ? undefined : jobEventTypeOf(args[1]);
        })(),
      })));
    }
    for (const group of publishJobEventGroups) {
      for (const eventOutput of group.eventOutputs ?? []) {
        if (eventOutput?.commitment) detachCommit(eventOutput.commitment);
      }
      // When the physical event slot only kept the latest emit, reconstruct earlier
      // JobEvent commitments from the nested call args for receipt parity.
      const args = group.logicalFunctionArgs ?? group.functionArgs;
      const structs = group.externalContract?.inner?.artifact?.structs;
      if (args && args.length >= 2 && structs) {
        try {
          // First insert: tip. Append (persist ready): tip-1 (= nLocktime / block.timestamp).
          const tip = Number(
            (host.builderOptions.provider as { getBlockTime?: () => number }).getBlockTime?.() ?? 0,
          );
          const unixThreshold = 500_000_000;
          const appending = isPersistedCompatibilityValueChunkReady(categoryId)
            && persistedJobEventsWidth(categoryId) > 0;
          const locktime = appending && Number.isFinite(tip) && tip >= unixThreshold
            ? (tip > unixThreshold ? Math.trunc(tip) - 1 : Math.trunc(tip))
            : undefined;
          const now = BigInt(locktime ?? (tip > 0 ? tip : Math.floor(Date.now() / 1000)));
          const stamped = stampEmptyJobEventTimestamp(args[1], now);
          const encoded = encodeJobEventEmitCommitment(args[0], stamped, structs);
          if (encoded) detachCommit(encoded);
        } catch { /* arg shape not encodable yet */ }
      }
    }
  }
  const placed = placeChunkableWriterEventOutput(builder.outputs, dest, {
    to: lockingBytecode,
    amount: 1200n,
    token: {
      amount: 0n,
      category: categoryId,
      nft: { capability: 'none', commitment: eventCommitment ?? '' },
    },
  }, {
    clearClonedStub: legacyEventFallback && persistEmit,
    refuseEmpty: legacyEventFallback && persistEmit && !constructedCommit,
    consumedMutableOk: legacyEventFallback && persistEmit,
    destInput: host.allInputs[dest],
    ...(legacyEventFallback && { legacyCompatibility: 'job-event-v1' as const }),
  });
  if (!placed && !legacyEventFallback) return;
  host.ensureDistinctJobEventNfts(builder);
  if (persistEmit && dest >= 0) {
    host.forcedChunkableValueWriteBandStart = dest + 1;
    host.placeValueChunkPredecessorInputs(host.pendingValueChunkPredecessors);
    host.materializeValueChunkBand(builder);
    host.reassertPersistedValueChunkOneToOnes(builder, dest);
  }
  const executingDest = legacyEventFallback && dest >= 0
    ? dest
    : legacyEventFallback
      ? chunkableWriterEventOutputIndex(chunkableValueWriteInputIndex(host), eventOffset)
      : -1;
  if (legacyEventFallback && executingDest >= 0) {
    relocateJobEventEmitToDest(builder.outputs, executingDest, {
      consumedMutableOk: persistEmit,
      preferCreated: isInitialChunkableValueWrite(host),
    });
  }
}
