/**
 * phase-boundary extract: STB class-body extract — distinct JobEvent NFT detach + delegate
 * implementation event-slot reassert over DelegateImplEventReassertHost.
 */

import {
  type AbiFunction,
  type EventDefinitionAbi,
  buildEventNftCovenantScript,
  computeEventNameHash,
} from '@solidcash/utils';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { scriptToLockingBytecode } from '../utils.js';
import {
  demoteUnclaimedDelegateEventClones,
  encodeJobEventEmitCommitment,
  jobEventTypeOf,
  stampEmptyJobEventTimestamp,
  type DelegateEventClaim,
} from './delegate-event-jobevent-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { isScidIdentityCommitment } from './logical-identity.js';
import { isJobEventEmitCommitment } from './same-index-twin-emit.js';
import { permitsLegacyNamedValueChunkFallbackForGroups } from './stb-chunkable-write-planning.js';
import {
  isPersistedCompatibilityValueChunkReady,
  persistedJobEventsWidth,
} from './value-chunk-persist.js';
import { legacyGroupLooksLikePublishJobEvent } from './legacy-planning-heuristics.js';
import { groupEventSignatures, lowLevelCallStateOwnerCategory } from './value-chunk-base-writer-select.js';

export interface DelegateImplEventReassertHost {
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly categoryId: string;
  detachedEventReceipts: Array<{ eventSignature: string; commitment: string }>;
  readonly builderOptions: {
    // NetworkProvider is structural; getBlockTime is optional on mock providers.
    provider: object;
  };
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  readonly composedParticipant: boolean;
  getLowLevelCallMasterInputIndex(index: number): number;
  getExternalCallMasterInputIndex(index: number): number;
  registerDetachedEvent(eventDef: EventDefinitionAbi, lockingBytecode: Uint8Array): void;
}

/**
 * Multi-emit JobEvents share one physical MD event slot (covenant uniqueness).
 * Park every distinct commitment on detachedEventReceipts so the send receipt
 * still exposes Created + WhitelistedWorkerAdded to chained `.to.emit()`.
 */
export function ensureDistinctJobEventNfts(
  host: DelegateImplEventReassertHost,
  _builder: TransactionBuilder,
): void {
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DISABLE_JOBEVENT_DETACH === '1') return;
  // Multi-emit receipt detach uses legacy-name discovery; kernel uses descriptor emits.
  if (!permitsLegacyNamedValueChunkFallbackForGroups(host)) return;
  const eventSignature = 'JobEvent(uint256,JobEventData)';
  const publishers = [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups].filter((group) => {
    if (legacyGroupLooksLikePublishJobEvent(group)) {
      return true;
    }
    const name = group.functionName ?? group.logicalFunctionName;
    return name === '__forward'
      && jobEventTypeOf((group.logicalFunctionArgs ?? group.functionArgs)?.[1]) !== undefined;
  });
  if (publishers.length === 0) return;
  const categoryId = publishers[0].categoryId
    ?? host.lowLevelCallUtxoGroups.find((group) => (
      legacyGroupLooksLikePublishJobEvent(group)
    ))?.categoryId;
  if (!categoryId) return;
  const addressType = publishers[0].externalContract?.inner?.addressType ?? 'p2sh32';
  const lockingBytecode = scriptToLockingBytecode(
    buildEventNftCovenantScript(hexToBin(categoryId), computeEventNameHash(eventSignature)),
    addressType,
  );
  const eventDef: EventDefinitionAbi = publishers[0].logicalArtifact?.events
    ?.find((event: EventDefinitionAbi) => event.signature === eventSignature)
    ?? publishers[0].externalContract?.inner?.artifact?.events
      ?.find((event: EventDefinitionAbi) => event.signature === eventSignature)
    ?? {
      name: 'JobEvent',
      signature: eventSignature,
      parameters: [
        { name: 'jobId', type: 'uint256', indexed: true },
        { name: 'eventData', type: 'JobEventData' },
      ],
    };
  host.registerDetachedEvent(eventDef, lockingBytecode);
  const present = new Set(
    host.detachedEventReceipts
      .filter((entry) => entry.eventSignature === eventSignature)
      .map((entry) => entry.commitment.toLowerCase()),
  );
  const detach = (commitment: string, eventType?: number): void => {
    // Full Created blobs exceed the short-form isJobEventEmitCommitment length cap.
    if (!(isJobEventEmitCommitment(commitment) || (eventType !== undefined && commitment.length >= 20))) {
      return;
    }
    const key = commitment.toLowerCase();
    if (present.has(key)) return;
    present.add(key);
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EMIT_MATCH === '1') {
      console.error('detach-job-event', {
        commit: commitment.slice(0, 24),
        len: commitment.length,
        eventType,
        present: present.size,
      });
    }
    host.detachedEventReceipts.push({ eventSignature, commitment });
  };
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_EMIT_MATCH === '1') {
    console.error('ensure-distinct-job-events', {
      categoryId: categoryId.slice(0, 16),
      publishers: publishers.map((group) => ({
        name: group.functionName ?? group.logicalFunctionName,
        arg1Type: jobEventTypeOf((group.logicalFunctionArgs ?? group.functionArgs)?.[1]),
      })),
    });
  }
  const providerTime = Number(
    (host.builderOptions.provider as { getBlockTime?: () => number }).getBlockTime?.() ?? 0,
  );
  const unixThreshold = 500_000_000;
  const appending = isPersistedCompatibilityValueChunkReady(categoryId)
    && persistedJobEventsWidth(categoryId) > 0;
  const locktime = appending && Number.isFinite(providerTime) && providerTime >= unixThreshold
    ? (providerTime > unixThreshold ? Math.trunc(providerTime) - 1 : Math.trunc(providerTime))
    : undefined;
  // First insert stamps with tip; appends use nLocktime (= tip-1).
  const now = BigInt(locktime ?? (providerTime > 0 ? providerTime : Math.floor(Date.now() / 1000)));
  for (const group of publishers) {
    const expectedType = jobEventTypeOf((group.logicalFunctionArgs ?? group.functionArgs)?.[1]);
    for (const eventOutput of group.eventOutputs ?? []) {
      if (eventOutput?.commitment) detach(eventOutput.commitment, expectedType);
    }
    const args = group.logicalFunctionArgs ?? group.functionArgs;
    const structs = group.logicalArtifact?.structs
      ?? group.externalContract?.inner?.artifact?.structs;
    if (args && args.length >= 2 && structs) {
      try {
        const stamped = stampEmptyJobEventTimestamp(args[1], now);
        const encoded = encodeJobEventEmitCommitment(args[0], stamped, structs);
        if (encoded) detach(encoded, expectedType);
      } catch { /* ignore */ }
    }
  }
}

/**
 * Implementation emit verification is `OP_INPUTINDEX + event.offset`. Move a
 * parked VersionChanged / Paused NFT from the proxy event band onto that dest.
 */
export function reassertDelegateImplEvents(
  host: DelegateImplEventReassertHost,
  builder: TransactionBuilder,
): void {
  const claims: DelegateEventClaim[] = [];
  const commitmentHex = (value: unknown): string => (
    value instanceof Uint8Array ? binToHex(value) : String(value ?? '').toLowerCase()
  );
  for (const [groupIndex, group] of host.lowLevelCallUtxoGroups.entries()) {
    if (group.callMode !== 'delegatecall') continue;
    const fn = group.compilerRoute?.abiFunction
      ?? (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
        .find((candidate) => candidate.name === (group.logicalFunctionName ?? group.functionName));
    const implIndex = host.getLowLevelCallMasterInputIndex(groupIndex);
    if (implIndex < 0) continue;
    const proxyGroup = host.externalCallUtxoGroups.find((candidate) => (
      candidate.delegateCallGroupIndex === groupIndex
    ));
    const eventSlots = fn?.blockLayout?.slots.filter((slot) => slot.kind === 'event') ?? [];
    const eventSignatures = groupEventSignatures(group, fn);
    for (const [eventOrdinal, eventSlot] of eventSlots.entries()) {
      const eventSignature = eventSignatures[eventOrdinal];
      if (!eventSignature) continue;
      const dest = implIndex + eventSlot.offset;
      const existing = builder.outputs[dest];
      // Delegate bytecode executes against its associated proxy's storage/category. Output contents are not
      // ownership evidence: a none-cap OP_TRUE return witness can legitimately occupy another delegate's same
      // relative slot. Inferring the category from that occupant promotes the witness into a duplicate event,
      // which the implementation's event-uniqueness epilogue correctly rejects.
      const executionCategory = lowLevelCallStateOwnerCategory(
        groupIndex, group, host.externalCallUtxoGroups, host.categoryId,
      );
      // Top-level proxy calls already project their event frame through the builder's own block layout. This
      // repair is only for a nested execution category; otherwise reserved union slots could activate
      // inactive initialization ordinals.
      if (!proxyGroup || executionCategory === host.categoryId) continue;
      const locking = scriptToLockingBytecode(
        buildEventNftCovenantScript(
          hexToBin(executionCategory), computeEventNameHash(eventSignature),
        ),
        group.externalContract.inner.addressType,
      );
      const learned = group.eventOutputs?.[eventOrdinal] ?? proxyGroup?.eventOutputs?.[eventOrdinal];
      const existingCommitment = commitmentHex(existing?.token?.nft?.commitment);
      const physicalEventIsMaterialized = existing?.token?.category === executionCategory
        && existing.token.nft?.capability === 'none'
        && existingCommitment !== '' && !/^0+$/.test(existingCommitment)
        && !isScidIdentityCommitment(existingCommitment);
      // The exact physical slot belongs to this transaction and outranks cached derivation output, which can
      // describe an earlier invocation of a repeated route. The cache is only a fallback when the slot has not
      // yet been materialized.
      let commitment = physicalEventIsMaterialized
        ? existingCommitment : (learned ? commitmentHex(learned.commitment) : undefined);
      if (!commitment || /^0*$/.test(commitment) || isScidIdentityCommitment(commitment)) continue;
      while (builder.outputs.length <= dest) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
      }
      if (builder.outputs[dest]?.token?.nft?.capability === 'minting') continue;
      builder.outputs[dest] = {
        to: locking,
        amount: 1200n,
        token: {
          amount: 0n,
          category: executionCategory,
          nft: { capability: 'none', commitment },
        },
      };
      claims.push({
        destination: dest,
        categoryId: executionCategory,
        lockingBytecode: locking,
        commitment,
      });
    }
  }
  demoteUnclaimedDelegateEventClones(builder.outputs, claims);
}
