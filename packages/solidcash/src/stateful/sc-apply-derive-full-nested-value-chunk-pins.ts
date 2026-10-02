/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — one nested-LLC value-chunk pin
 * iteration (probe → extract → stage/pin). Host keeps the for-loop and the
 * entry-NFT remainder that follows.
 */

import { binToHex, binsAreEqual } from '@bitauth/libauth';
import {
  VALUE_HEAD_SIZE,
  encodePushdataValue,
  sha256 as sha256Sync,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript } from '../utils.js';
import { permitsLegacyNamedValueChunkFallback } from './chunkable-value-write-selection.js';
import {
  extractIdentityScanValueChunkPin,
  legacyPersistedValueChunkWidth,
} from './early-value-chunk-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  compactFaithfulProbeTrace,
  evaluateProbeTrace,
  isP2sh32LockingBytecode,
} from './faithful-probe-trace.js';
import { encodeStructArgument } from './legacy-job-event-wire.js';
import {
  legacyGroupLooksLikePublishJobEvent,
  legacyIsPublishJobEventName,
} from './legacy-planning-heuristics.js';
import {
  appendEncodedArrayElement,
  concatenateEncodedArrays,
} from './resource-fold-route.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import {
  extractAllRouteValueChunks,
  extractFailingP2sh32OutputPin,
  extractRouteChunkPin,
  lastExtractedComputedValue,
} from './route-value-chunk-helpers.js';
import { providerUnixLocktime } from './soft-state-overlays.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import {
  isPersistedJobEventsReady,
  rememberJobEventsLock,
  rememberJobEventsValue,
  persistedCompatibilityValueChunkLock,
  selectValueChunkResource,
  selectValueChunkWriteCategory,
  stageJobEventsValue,
  valueChunkIndexFromCommitment,
  valueChunkWriteResourceIdentity,
} from './value-chunk-persist.js';
import { describeValueChunkWrites } from './writer-group-selection.js';
import {
  identityScanValueChunkOutputBase,
  publishIdentityScanValueChunkRange,
} from './identity-scan-value-chunk-range.js';

export type ApplyDeriveFullNestedValueChunkPinHost = {
  readonly categoryId: string;
  readonly inner: any;
};

export type ApplyDeriveFullNestedValueChunkPinSkipped = {
  readonly skipped: true;
};

export type ApplyDeriveFullNestedValueChunkPinApplied = {
  readonly skipped: false;
  nestedProbeHadError: boolean;
  commitmentProgressDelta: number;
  nestedPinProgressDelta: number;
  nestedTrace: any[];
  implInputIndex: number;
  llcIndex: number;
  llc: any;
  proxyGroup: ExternalCallUtxoGroup | undefined;
  proxyGroupIndex: number;
  proxyPhysicalGroup: ExternalCallUtxoGroup | undefined;
  nestedOutputBase: number;
  chunkCategory: string | undefined;
  valueChunkWrites: any[];
  attachedGroups: ExternalCallUtxoGroup[];
  band: any;
  allChunks: any[];
  fallbackBase: number;
  pin: any;
};

export type ApplyDeriveFullNestedValueChunkPinResult =
  | ApplyDeriveFullNestedValueChunkPinSkipped
  | ApplyDeriveFullNestedValueChunkPinApplied;

/**
 * Probe one nested delegatecall LLC and apply its value-chunk pins.
 * Returns `{ skipped: true }` for host `continue`, otherwise locals for the
 * entry-NFT remainder of the same iteration.
 */
export function applyDeriveFullNestedValueChunkPin(
  host: ApplyDeriveFullNestedValueChunkPinHost,
  params: {
    stb: StatefulTransactionBuilder;
    probeBuilder2: TransactionBuilder;
    sourceOutputs2: any;
    transaction2: any;
    llc: any;
    llcIndex: number;
    delegatecallInputIndex: number | undefined;
    skipNestedAfterPass: boolean;
    debugTargetsThisDerivation: boolean;
    iter: number;
  },
): ApplyDeriveFullNestedValueChunkPinResult {
  const {
    stb, probeBuilder2, sourceOutputs2, transaction2,
    llc, llcIndex, delegatecallInputIndex, skipNestedAfterPass,
    debugTargetsThisDerivation, iter,
  } = params;
  let commitmentProgressDelta = 0;
  let nestedPinProgressDelta = 0;
  let nestedProbeHadError = false;

  if (llc.callMode !== 'delegatecall') return { skipped: true as const };
  // A composed implementation band can shift as sorted inserts and dynamic outputs converge. Resolve
  // the executed implementation from the materialized transaction, not from a function-name exception
  // or a provisional dense coordinate.
  const builtImplInputIndex = probeBuilder2.inputs.findIndex((input) => (
    input.txid === llc.masterUtxo.txid && input.vout === llc.masterUtxo.vout
  ));
  const implInputIndex = builtImplInputIndex >= 0
    ? builtImplInputIndex : stb.getLowLevelCallMasterInputIndex(llcIndex);
  if (implInputIndex < 0 || implInputIndex === delegatecallInputIndex) return { skipped: true as const };
  if (skipNestedAfterPass) return { skipped: true as const };
  const attachedGroups = stb.getExternalCallUtxoGroups().filter(
    (group) => group.delegateCallGroupIndex === llcIndex,
  );
  const groupFunctionName = (group: ExternalCallUtxoGroup): string | undefined => (
    group.logicalFunctionName ?? group.compilerRoute?.abiFunction.name ?? group.functionName
  );
  const matchingGroups = attachedGroups.filter((group) => groupFunctionName(group) === llc.functionName);
  const physicalProxyGroups = attachedGroups.filter((group) => group.sharedGroupIndex === undefined);
  const proxyGroup = matchingGroups.find((group) => group.sharedGroupIndex === undefined)
  ?? matchingGroups[0]
  ?? (physicalProxyGroups.length === 1 ? physicalProxyGroups[0] : undefined)
  ?? (attachedGroups.length === 1 ? attachedGroups[0] : undefined);
  const proxyGroupIndex = proxyGroup === undefined
    ? -1 : stb.getExternalCallUtxoGroups().indexOf(proxyGroup);
  const proxyPhysicalGroupIndex = proxyGroupIndex < 0
    ? -1 : (proxyGroup?.sharedGroupIndex ?? proxyGroupIndex);
  const proxyPhysicalGroup = proxyPhysicalGroupIndex < 0
    ? undefined : stb.getExternalCallUtxoGroups()[proxyPhysicalGroupIndex];
  // An implementation embedded in a compiler-routed participant executes from an input in the
  // delegate band, but its output covenants remain relative to the owning participant block. These
  // coordinates can be far apart after route fusion (and are intentionally not reconstructible from
  // the implementation input alone). Use the materialized physical owner for output discovery; legacy
  // non-embedded delegates continue to own implementation-relative outputs.
  const nestedOutputBase = proxyPhysicalGroup?.delegateEmbeddedInBlock && proxyGroupIndex >= 0
    ? stb.getExternalCallOutputBase(proxyGroupIndex)
    : implInputIndex;
  const nestedTraceStartedAt = debugTargetsThisDerivation ? Date.now() : 0;
  // OP_INVOKE swaps the active instruction array but continues through the same observer-wrapped
  // instruction set. The sparse observer therefore sees nested introspection and retains the terminal
  // identity-count equality explicitly, avoiding construction of a multi-gigabyte faithful trace.
  const nestedTrace = compactFaithfulProbeTrace(evaluateProbeTrace(host.inner.provider, {
    inputIndex: implInputIndex,
    sourceOutputs: sourceOutputs2,
    transaction: transaction2,
  }));
  if (debugTargetsThisDerivation) console.error('derive-phase2-nested-evaluated', {
    iter, llcIndex, functionName: llc.functionName, implInputIndex,
    evaluateMs: Date.now() - nestedTraceStartedAt,
    states: nestedTrace.length,
    error: nestedTrace.at(-1)?.error,
  });
  if (debugTargetsThisDerivation) console.error('derive-nested-summary', JSON.stringify({
    iter,
    llcIndex,
    functionName: llc.functionName,
    implInputIndex,
    denseImplInputIndex: stb.getLowLevelCallMasterInputIndex(llcIndex),
    proxyGroupFunctionName: proxyGroup && groupFunctionName(proxyGroup),
    proxyPhysicalGroupIndex,
    nestedOutputBase,
    externalGroups: stb.getExternalCallUtxoGroups().map((group, groupIndex) => ({
      groupIndex,
      functionName: groupFunctionName(group),
      categoryId: group.categoryId,
      sharedGroupIndex: group.sharedGroupIndex,
      delegateCallGroupIndex: group.delegateCallGroupIndex,
      inputBase: stb.getExternalCallMasterInputIndex(groupIndex),
      outputBase: stb.getExternalCallOutputBase(groupIndex),
      blockSize: group.blockInputs?.length ?? group.blockLayout?.blockSize,
    })),
    elapsedMs: Date.now() - nestedTraceStartedAt,
    traceStates: nestedTrace.length,
    error: nestedTrace.find((state) => state.error)?.error,
    terminal: nestedTrace.at(-1) && {
      ip: nestedTrace.at(-1)!.ip,
      instructionCount: nestedTrace.at(-1)!.instructions.length,
      opcode: nestedTrace.at(-1)!.instructions[nestedTrace.at(-1)!.ip]?.opcode,
      stack: nestedTrace.at(-1)!.stack.slice(-8).map((item) => (
        `${item.length}:${binToHex(item.slice(0, 32))}`
      )),
    },
    outputs: probeBuilder2.outputs.slice(
      Math.max(0, implInputIndex - 1), implInputIndex + 10,
    ).map((output, offset) => ({
      outputIndex: Math.max(0, implInputIndex - 1) + offset,
      categoryId: output.token?.category?.slice(0, 8),
      capability: output.token?.nft?.capability,
      commitment: String(output.token?.nft?.commitment ?? '').slice(0, 32),
      lockingBytecode: output.to instanceof Uint8Array
        ? binToHex(output.to.slice(0, 8)) : String(output.to).slice(0, 16),
    })),
  }));
  nestedProbeHadError ||= nestedTrace.some((state) => state.error !== undefined);
  const band = stb.getChunkableValueWriteBand();
  const identityPin = extractIdentityScanValueChunkPin(nestedTrace);
  let fallbackBase = band?.start
  ?? llc.valueChunkOutputBase
  ?? proxyGroup?.valueChunkOutputBase
  ?? stb.getContinuationOutputBase(probeBuilder2);
  // Identity-scan count mismatch is the failing pin. A full debug trace also contains earlier
  // OUTPUTBYTECODE self-preservation checks; those positional hits must not steal placement.
  // After the count check passes, prefer failing p2sh32 pins (entry NFTs) over value-chunk shaped
  // OUTPUTBYTECODE hits that would only try to re-place already-staged trailing chunks.
  const pin = identityPin && fallbackBase >= 0
    ? {
      outputIndex: fallbackBase,
      lockingBytecode: identityPin.lockingBytecode,
      commitment: '00',
    }
    : (stb.hasStagedValueChunkOutputs() || stb.getValueChunkRedeemLock())
      ? extractFailingP2sh32OutputPin(nestedTrace)
      ?? extractRouteChunkPin(nestedTrace)
      : extractRouteChunkPin(nestedTrace)
      ?? extractFailingP2sh32OutputPin(nestedTrace, band);
  const nestedPinExtractedAt = debugTargetsThisDerivation ? Date.now() : 0;
  // Earlier logical aliases have different, valid producer IDs. The terminal physical call and its
  // delegate executor are the only consumer authority; aggregating every historical alias creates an
  // artificial ambiguity between sequential writes to the same resource.
  const producerClaimCarriers = [llc, ...(proxyPhysicalGroup ? [proxyPhysicalGroup] : [])];
  const transportedProducerClaims = producerClaimCarriers.flatMap(
    (carrier) => carrier.valueChunkProducerClaims ?? [],
  );
  const transportedStateOwner = producerClaimCarriers.find(
    (carrier) => carrier.valueChunkStateOwner !== undefined,
  )?.valueChunkStateOwner;
  const chunkCategory = transportedStateOwner?.categoryId
  ?? proxyGroup?.categoryId ?? llc.categoryId;
  const valueChunkWrites = [
    ...(llc.valueChunkWrites ?? describeValueChunkWrites(llc)),
    ...attachedGroups.flatMap((group) => (
      group.valueChunkWrites ?? describeValueChunkWrites(group)
    )),
  ];
  // Delegate outputs use the proxy category, while the resource descriptor authenticates the state
  // owner's category. Select by the complete descriptor identity, never by the projected output token.
  const valueChunkResourceSelection = selectValueChunkResource(valueChunkWrites);
  const valueChunkResourceIdentity = valueChunkResourceSelection.status === 'exact'
    ? valueChunkResourceSelection.identity : undefined;
  // Old descriptor-free routes reconstructed their computed array value from a historical ABI shape.
  // Keep that adapter outside kernel routes. A kernel candidate must come from the VM trace or from the
  // exact producer/resource pair staged while evaluating `storedElementSource`; a function name, argument
  // position, or same-typed value is not producer authority.
  const legacyValueCandidates: Uint8Array[] = [];
  const permitsLegacyValueCandidate = valueChunkResourceSelection.status === 'absent'
  && permitsLegacyNamedValueChunkFallback(
    [llc, ...(proxyGroup ? [proxyGroup] : [])],
    host.inner.artifact.messageBus?.convention
      ?? (llc.compilerRoute?.abiFunction as MessageBusRuntimeAbiFunction | undefined)
        ?.messageBusConvention,
  );
  const publishName = llc.functionName ?? llc.logicalFunctionName
  ?? llc.compilerRoute?.abiFunction?.name;
  // legacy JobEvent name adapter: JobEvent value-candidate discovery only via legacy adapter under the gate above.
  if (permitsLegacyValueCandidate && (
    legacyIsPublishJobEventName(publishName)
  || legacyGroupLooksLikePublishJobEvent({
    functionName: llc.functionName,
    logicalFunctionName: llc.logicalFunctionName,
    compilerRoute: llc.compilerRoute,
  })
  )) {
    const args = llc.logicalFunctionArgs ?? llc.functionArgs;
    const structs = llc.logicalArtifact?.structs
    ?? llc.externalContract?.inner?.artifact?.structs
    ?? proxyGroup?.logicalArtifact?.structs
    ?? proxyGroup?.externalContract?.inner?.artifact?.structs;
    const leading = (llc.internalArgs?.__internal__leadingPushValue_0
    ?? proxyGroup?.internalArgs?.__internal__leadingPushValue_0) as Uint8Array | undefined;
    const witness = (llc.internalArgs?.__internal__valueWitness_0
    ?? proxyGroup?.internalArgs?.__internal__valueWitness_0) as Uint8Array | undefined;
    if (structs && args && args.length >= 2) {
      try {
        const providerTime = Number(
          (host.inner.provider as { getBlockTime?: () => number }).getBlockTime?.() ?? 0,
        );
        // First insert stamps with tip; appends use nLocktime (= tip-1) so the
        // candidate matches the covenant (28B stamped, not 24B unstamped).
        const appending = isPersistedJobEventsReady()
        && (legacyPersistedValueChunkWidth(host.categoryId) > 0
          || legacyPersistedValueChunkWidth() > 0);
        const locktime = appending
          ? providerUnixLocktime(host.inner.provider as { getBlockTime?: () => number })
          : undefined;
        const now = BigInt(locktime ?? (providerTime > 0 ? providerTime : Math.floor(Date.now() / 1000)));
        const empty = encodePushdataValue([], 'JobEventData[]', structs);
        let built = leading instanceof Uint8Array && leading.length > 0
          ? concatenateEncodedArrays(empty, leading)
          : empty;
        const element = encodeStructArgument(
          args[1] as FunctionArgument, 'JobEventData', structs, now, true,
        );
        built = appendEncodedArrayElement(built, element);
        // Candidate only — do not stage yet. Staging a non-root-matching
        // encoding (timestamp / legacy mismatch) overwrites the witness blob
        // the unlocker and chunk commitments must share.
        if (built.length > VALUE_HEAD_SIZE) {
          legacyValueCandidates.push(built);
        }
      } catch { /* fall through to stack/staged selection */ }
    }
    if (witness instanceof Uint8Array && witness.length > VALUE_HEAD_SIZE) {
      legacyValueCandidates.push(witness);
    }
  }
  const allChunks = extractAllRouteValueChunks(
    nestedTrace, pin,
    fallbackBase,
    band?.nNew ?? identityPin?.nNew ?? llc.valueChunkOutputCount ?? 0,
    chunkCategory,
    valueChunkWrites,
    legacyValueCandidates,
    stb.valueChunkWriteStagingSession,
    transportedProducerClaims,
    transportedStateOwner,
  );
  if (identityPin && valueChunkResourceIdentity !== undefined && allChunks.length > 0) {
    fallbackBase = identityScanValueChunkOutputBase(
      fallbackBase, allChunks.length, valueChunkResourceIdentity, stb.getDerivedChunkOutputs(),
    );
    for (const [offset, chunk] of allChunks.entries()) chunk.outputIndex = fallbackBase + offset;
    if (pin) pin.outputIndex = fallbackBase;
    if (publishIdentityScanValueChunkRange(
      [llc, ...attachedGroups], valueChunkResourceIdentity, fallbackBase, allChunks.length,
    )) stb._refreshInputs();
  }
  // The extracted value is the derived post-handler value: it owns continuation
  // outputs and persistence only. `__internal__valueWitness_N` authenticates the
  // exact proof-entry value before this handler; replacing it here would make a
  // long-value read authenticate the post-state digest against the pre-state entry.
  if (permitsLegacyValueCandidate && lastExtractedComputedValue
  && lastExtractedComputedValue.length > VALUE_HEAD_SIZE) {
    const selectedValue = lastExtractedComputedValue;
    if (chunkCategory) stageJobEventsValue(chunkCategory, selectedValue);
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
    const last = nestedTrace.at(-1);
    const identityLockHex = identityPin
      ? binToHex(identityPin.lockingBytecode) : undefined;
    const matchingLocks = identityLockHex
      ? probeBuilder2.outputs.flatMap((output, outputIndex) => {
        const lock = output.to instanceof Uint8Array
          ? output.to
          : output.to !== undefined ? addressToLockScript(output.to) : undefined;
        if (!lock || binToHex(lock) !== identityLockHex) return [];
        return [{
          outputIndex,
          commitment: String(output.token?.nft?.commitment ?? '').slice(0, 20),
          category: output.token?.category?.slice(0, 8),
          capability: output.token?.nft?.capability,
        }];
      })
      : [];
    const nearby = last
      ? last.instructions.slice(Math.max(0, last.ip - 8), last.ip + 6).map((item, offset) => {
        const ip = Math.max(0, last.ip - 8) + offset;
        const data = 'data' in item && item.data ? binToHex(item.data).slice(0, 16) : '';
        return `${ip}:${item.opcode}${data ? `:${data}` : ''}${ip === last.ip ? '*' : ''}`;
      })
      : undefined;
    const describeOut = (outputIndex: number): Record<string, unknown> => {
      const output = probeBuilder2.outputs[outputIndex];
      const lock = output?.to instanceof Uint8Array
        ? output.to
        : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
      return {
        i: outputIndex,
        lock: lock ? binToHex(lock).slice(0, 20) : undefined,
        cat: output?.token?.category?.slice(0, 8),
        cap: output?.token?.nft?.capability,
        commit: String(output?.token?.nft?.commitment ?? '').slice(0, 24),
        commitLen: String(output?.token?.nft?.commitment ?? '').length / 2,
      };
    };
    const selectedRoot = lastExtractedComputedValue
      ? binToHex(sha256Sync(lastExtractedComputedValue)).slice(0, 16) : undefined;
    console.error('nested-identity-scan', JSON.stringify({
      llc: llc.functionName, callMode: llc.callMode, implInputIndex,
      states: nestedTrace.length, error: last?.error, ip: last?.ip,
      opcode: last ? last.instructions[last.ip]?.opcode : undefined,
      identityNNew: identityPin?.nNew,
      identityLock: identityLockHex?.slice(0, 20),
      resourceSelection: valueChunkResourceSelection.status,
      resourceIdentities: valueChunkWrites.map(valueChunkWriteResourceIdentity),
      fallbackBase, bandStart: band?.start, chunks: allChunks.length,
      placed: allChunks.map((chunk) => chunk.outputIndex),
      hasStaged: stb.hasStagedValueChunkOutputs(),
      matchingLocks,
      chunkCommitments: allChunks.map((chunk) => chunk.commitment.slice(0, 20)),
      selectedLen: lastExtractedComputedValue?.length,
      selectedRoot,
      bandOuts: (band?.start !== undefined
        ? [band.start, band.start + 1, band.start + 2]
        : [23, 24, 25]).map(describeOut),
      stack: last?.stack.slice(-10).map((item) => `${item.length}:${binToHex(item).slice(0, 24)}`),
      nearby,
      out14: describeOut(14),
    }));
  }
  if (debugTargetsThisDerivation) console.error('derive-phase2-nested-chunks-extracted', {
    iter, llcIndex, functionName: llc.functionName,
    pinMs: nestedPinExtractedAt - nestedTraceStartedAt,
    chunksMs: Date.now() - nestedPinExtractedAt,
    chunks: allChunks.length,
  });
  if (chunkCategory && allChunks.length > 0) {
    if (permitsLegacyValueCandidate) {
      stb.rememberJobEventsChunks(chunkCategory, allChunks.map((chunk) => ({
        ...chunk,
        categoryId: chunkCategory,
      })));
    }
    if (stb.bumpChunkableValueWriteWidth(allChunks.length)) stb._refreshInputs();
    if (lastExtractedComputedValue) {
      const selection = selectValueChunkWriteCategory(valueChunkWrites.filter(
        (write) => write.categoryId.toLowerCase() === chunkCategory.toLowerCase(),
      ));
      if (selection.status === 'absent' && permitsLegacyNamedValueChunkFallback(
        [llc, ...(proxyGroup ? [proxyGroup] : [])],
        (llc.compilerRoute?.abiFunction as MessageBusRuntimeAbiFunction | undefined)
          ?.messageBusConvention,
      )) {
      // Compatibility only for descriptor-free artifacts.
        rememberJobEventsValue(chunkCategory, lastExtractedComputedValue);
      }
    }
  }
  const redeemLock = pin?.lockingBytecode && isP2sh32LockingBytecode(pin.lockingBytecode)
    ? pin.lockingBytecode
    : (permitsLegacyValueCandidate && chunkCategory
      ? persistedCompatibilityValueChunkLock(chunkCategory) : undefined);
  if (chunkCategory && redeemLock) {
    const selection = selectValueChunkWriteCategory(valueChunkWrites.filter(
      (write) => write.categoryId.toLowerCase() === chunkCategory.toLowerCase(),
    ));
    if (selection.status === 'absent' && permitsLegacyNamedValueChunkFallback(
      [llc, ...(proxyGroup ? [proxyGroup] : [])],
      (llc.compilerRoute?.abiFunction as MessageBusRuntimeAbiFunction | undefined)
        ?.messageBusConvention,
    )) {
    // Compatibility only for descriptor-free artifacts.
      rememberJobEventsLock(chunkCategory, redeemLock);
    }
    stb.setValueChunkRedeemLock(redeemLock);
  }
  if (identityPin && allChunks.length > 0 && identityPin.nNew === allChunks.length) {
  // A compiler-identified resource has one authoritative materializer: its exact absolute derived
  // run. Descriptor-free legacy identity scans retain append staging as a compatibility path.
    if (valueChunkResourceIdentity === undefined) {
      stb.stageValueChunkOutputs(identityPin.lockingBytecode, allChunks.map((chunk) => ({
        to: chunk.lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: chunkCategory,
          nft: { capability: 'mutable' as const, commitment: chunk.commitment },
        },
      })));
    }
    // Also pin absolute band indices. Staging alone appends at the current probe
    // width (often the dataNft band); __internal__valueChunkOutputBase expects
    // fallbackBase/band.start (e.g. 19), not out14.
    const absoluteBase = fallbackBase >= 0 ? fallbackBase : (band?.start ?? -1);
    if (absoluteBase >= 0) {
      for (const [offset, chunk] of allChunks.entries()) {
        if (stb.setDerivedChunkOutput(absoluteBase + offset, {
          commitment: chunk.commitment,
          lockingBytecode: chunk.lockingBytecode,
          categoryId: chunkCategory,
          fixedIndex: true,
          semanticKind: 'valueChunk',
          ...(valueChunkResourceIdentity && {
            resourceIdentity: valueChunkResourceIdentity,
            resourcePart: `chunk:${offset}`,
          }),
        })) {
          commitmentProgressDelta += 1;
          nestedPinProgressDelta += 1;
        }
      }
    } else {
      commitmentProgressDelta += allChunks.length;
      nestedPinProgressDelta += allChunks.length;
    }
  } else if (!identityPin) {
  // Keep staged identity-scan value chunks, but still apply unrelated positional pins
  // (entry NFT locks, etc.) that become reachable after the count check passes.
    const stagedValueLock = stb.getValueChunkRedeemLock();
    for (const chunk of allChunks) {
      if (stagedValueLock && binsAreEqual(chunk.lockingBytecode, stagedValueLock)) continue;
      if (stb.setDerivedChunkOutput(chunk.outputIndex, {
        commitment: chunk.commitment,
        lockingBytecode: chunk.lockingBytecode,
        categoryId: chunkCategory,
        semanticKind: 'valueChunk',
        ...(valueChunkResourceIdentity && {
          resourceIdentity: valueChunkResourceIdentity,
          resourcePart: `chunk:${valueChunkIndexFromCommitment(chunk.commitment) ?? 0}`,
        }),
      })) {
        commitmentProgressDelta += 1;
        nestedPinProgressDelta += 1;
      }
    }
    if (pin && !(stagedValueLock && binsAreEqual(pin.lockingBytecode, stagedValueLock))
    && stb.setDerivedChunkOutput(pin.outputIndex, {
      commitment: pin.commitment,
      lockingBytecode: pin.lockingBytecode,
      categoryId: chunkCategory,
      semanticKind: 'entryPin',
    })) {
      commitmentProgressDelta += 1;
      nestedPinProgressDelta += 1;
    }
  }
  return {
    skipped: false as const,
    nestedProbeHadError,
    commitmentProgressDelta,
    nestedPinProgressDelta,
    nestedTrace,
    implInputIndex,
    llcIndex,
    llc,
    proxyGroup,
    proxyGroupIndex,
    proxyPhysicalGroup,
    nestedOutputBase,
    chunkCategory,
    valueChunkWrites,
    attachedGroups,
    band,
    allChunks,
    fallbackBase,
    pin,
  };
}
