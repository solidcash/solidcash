/**
 * phase-boundary extract: Route value-chunk pin / extract / derive helpers.
 * (phase-boundary extract from StatefulContract.ts).
 */

import {
  AbiFunction,
  Op,
  VALUE_CHUNK_INDEX_SIZE,
  VALUE_CHUNK_MAX_COUNT,
  VALUE_CHUNK_SIZE,
  VALUE_HEAD_SIZE,
  parseValueChunkCommitment,
} from '@solidcash/utils';
import {
  AuthenticationProgramStateCommon,
  binToHex,
} from '@bitauth/libauth';
import {
  isP2sh32LockingBytecode,
  isValueChunkProbeFrame,
} from './faithful-probe-trace.js';
import { decodeScriptNumber } from './trace-commitment-helpers.js';
import {
  type RouteProbeObservationHistory,
  permitsRouteValueChunkDerivation,
  recordRouteProbeObservation,
  routeValueRunFingerprint,
} from './route-probe-progress.js';
import {
  ExternalCallUtxoGroup,
  StatefulTransactionBuilder,
  applyRedeemLockToChunks,
  chunksFromJobEventsValue,
  expectedFromOtcEqualVerify,
  extractIdentityScanValueChunkPin,
  legacyPersistedValueChunkLock,
  legacyPersistedValueChunkValue,
  legacyRememberValueChunkLock,
  legacyRememberValueChunkValue,
  permitsLegacyNamedValueChunkFallback,
  selectExpectedP2sh32OutputLock,
  selectHashedValueForChunkPin,
  selectValueChunkCommitmentObservations,
  type ValueChunkTraceObservation,
  type ValueChunkWriteDescriptor,
  ValueChunkWriteStagingSession,
  valueChunkWriteResourceIdentity,
} from './StatefulTransactionBuilder.js';
import {
  isEmptyValueChunkCommitment,
  persistedValueChunkWriteState,
  rememberValueChunkUnlockRecipe,
  selectPersistedValueChunkWrite,
  selectValueChunkResource,
  selectValueChunkWriteCategory,
  stagedValueChunkWrite,
  valueChunkIndexFromCommitment,
} from './value-chunk-persist.js';
import {
  selectSingletonValueChunkProducer,
  type ValueChunkProducerResourceClaim,
} from './ValueChunkProducerIdentity.js';
import {
  chunkableValueWriteCollections,
  describeValueChunkWrites,
  physicalExternalCallFunction,
  writesChunkableValue,
} from './writer-group-selection.js';

type MessageBusRuntimeAbiFunction = AbiFunction & {
  messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
};

type RouteValueChunkProgress = { changed: boolean; discovered: boolean };

/** emitSortedValueChunkPin: `DUP / PICK addr / SWAP / OUTPUTBYTECODE` leaves [addr35, idx] on top. */
export function isValueChunkOutputPin(state: AuthenticationProgramStateCommon): boolean {
  if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTBYTECODE) return false;
  if (state.instructions[state.ip - 1]?.opcode !== Op.OP_SWAP) return false;
  if (state.stack.length < 2) return false;
  return isP2sh32LockingBytecode(state.stack[state.stack.length - 2]);
}

export function extractRouteChunkPin(
  trace: AuthenticationProgramStateCommon[],
): { outputIndex: number; lockingBytecode: Uint8Array; commitment: string } | undefined {
  const isChunkShaped = isValueChunkProbeFrame;
  // Prefer the latest outlined address check. Earlier direct pins can remain in a longer trace after they have
  // already been satisfied; returning one of those first would hide the next failing outlined chunk.
  for (let i = trace.length - 1; i >= 0; i--) {
    const state = trace[i];
    if (!isValueChunkOutputPin(state)) continue;
    const activeFrameIsChunkShaped = isChunkShaped(state.instructions);
    const callerIsChunkShaped = trace.slice(Math.max(0, i - 96), i).some((candidate) =>
      candidate.instructions !== state.instructions && isChunkShaped(candidate.instructions));
    const commitmentLooksLikeChunk = state.stack.length >= 4
      && state.stack[state.stack.length - 4].length >= 3
      && state.stack[state.stack.length - 4].length <= VALUE_CHUNK_INDEX_SIZE + VALUE_CHUNK_SIZE;
    // An outlined chunk pin can use ADD/MUL in a different order than isChunkShaped,
    // but still leaves uint16||data under the address/index pair.
    if (!activeFrameIsChunkShaped && !callerIsChunkShaped && !commitmentLooksLikeChunk) continue;
    const equalStep = trace.slice(i + 1, Math.min(trace.length, i + 12)).find((candidate) =>
      candidate.instructions === state.instructions
      && candidate.instructions[candidate.ip]?.opcode === Op.OP_EQUALVERIFY
      && candidate.stack.length >= 2);
    if (!equalStep) continue;
    // The emitter leaves [expected, actual] for OP_EQUALVERIFY: the expected
    // chunk address is below the bytecode read from the candidate output.
    const expectedLockingBytecode = equalStep.stack[equalStep.stack.length - 2];
    const actualLockingBytecode = equalStep.stack[equalStep.stack.length - 1];
    if (binToHex(actualLockingBytecode) === binToHex(expectedLockingBytecode)) continue;
    if (!isP2sh32LockingBytecode(expectedLockingBytecode)) continue;
    const expectedCommitment = state.stack.length >= 4 ? state.stack[state.stack.length - 4] : undefined;
    const extracted = {
      outputIndex: Number(decodeScriptNumber(state.stack[state.stack.length - 1])),
      lockingBytecode: expectedLockingBytecode,
      commitment: commitmentLooksLikeChunk && expectedCommitment ? binToHex(expectedCommitment) : '00',
    };
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_CHUNK_SCAN === '1') {
      console.error('extracted-chunk-pin', {
        outputIndex: extracted.outputIndex,
        commitment: extracted.commitment.slice(0, 24),
        lock: binToHex(extracted.lockingBytecode).slice(0, 24),
        chunkShaped: activeFrameIsChunkShaped || callerIsChunkShaped,
        commitmentLooksLikeChunk,
      });
    }
    return extracted;
  }
  for (let i = trace.length - 1; i >= 0; i--) {
    const state = trace[i];
    if (!isValueChunkOutputPin(state)) continue;
    // Only the value-chunk loop body computes an offset as `i * VALUE_CHUNK_SIZE + VALUE_HEAD_SIZE`; requiring
    // that signature keeps this off every other OP_OUTPUTBYTECODE pin (entries, events, self-preservation).
    if (!isChunkShaped(state.instructions)) continue;
    // Emitter geometry: [.., expectedCommitment, outIdx, chunkAddress, outIdx]
    const stack = state.stack;
    if (stack.length < 4) continue;
    const lockingBytecode = stack[stack.length - 2];
    const commitment = stack[stack.length - 4];
    if (!isP2sh32LockingBytecode(lockingBytecode)) continue;
    if (commitment.length < 3 || commitment.length > VALUE_CHUNK_INDEX_SIZE + VALUE_CHUNK_SIZE) continue;
    return {
      outputIndex: Number(decodeScriptNumber(stack[stack.length - 1])),
      lockingBytecode,
      commitment: binToHex(commitment),
    };
  }

  // If the computed continuation is the first output beyond the current
  // transaction width, OP_OUTPUTBYTECODE aborts before EQUALVERIFY and before
  // the exact `uint16 || data` commitment is exposed in the expected stack
  // position. The address and absolute coordinate are already authenticated
  // by the chunk-shaped emitter, so seed that coordinate with an empty probe;
  // the next pass reaches the commitment comparison and replaces the seed.
  for (let i = trace.length - 1; i >= 0; i--) {
    const state = trace[i];
    if (!isValueChunkOutputPin(state)) continue;
    const activeFrameIsChunkShaped = isChunkShaped(state.instructions);
    const callerIsChunkShaped = trace.slice(Math.max(0, i - 96), i).some((candidate) =>
      candidate.instructions !== state.instructions && isChunkShaped(candidate.instructions));
    if (!activeFrameIsChunkShaped && !callerIsChunkShaped) continue;
    const outputIndex = Number(decodeScriptNumber(state.stack[state.stack.length - 1]));
    if (!Number.isSafeInteger(outputIndex) || outputIndex < 0) continue;
    return {
      outputIndex,
      lockingBytecode: state.stack[state.stack.length - 2],
      commitment: '00',
    };
  }

  // Outlining can put only `DUP OUTPUTBYTECODE ... EQUALVERIFY` in the active helper while the value-chunk
  // offset calculation remains in its caller. Recover that first address mismatch as a placeholder; the next
  // probe passes the address check and exposes the exact commitment. Restrict this to a recently-active
  // chunk-shaped caller frame so ordinary entry/event/self-preservation bytecode checks remain invisible here.
  for (let i = trace.length - 1; i >= 0; i--) {
    const state = trace[i];
    if (!isValueChunkOutputPin(state) || isChunkShaped(state.instructions)) continue;
    const callerIsChunkShaped = trace.slice(Math.max(0, i - 96), i).some((candidate) =>
      candidate.instructions !== state.instructions && isChunkShaped(candidate.instructions));
    if (!callerIsChunkShaped) continue;
    const equalStep = trace.slice(i + 1, Math.min(trace.length, i + 12)).find((candidate) =>
      candidate.instructions === state.instructions
      && candidate.instructions[candidate.ip]?.opcode === Op.OP_EQUALVERIFY
      && candidate.stack.length >= 2);
    if (!equalStep) continue;
    const expectedLockingBytecode = equalStep.stack[equalStep.stack.length - 2];
    const actualLockingBytecode = equalStep.stack[equalStep.stack.length - 1];
    if (binToHex(actualLockingBytecode) === binToHex(expectedLockingBytecode)) continue;
    if (!isP2sh32LockingBytecode(expectedLockingBytecode)) continue;
    return {
      outputIndex: Number(decodeScriptNumber(state.stack[state.stack.length - 1])),
      lockingBytecode: expectedLockingBytecode,
      commitment: '00',
    };
  }
  return undefined;
}

/** OUTPUTBYTECODE EQUALVERIFY mismatch whose expected side is a p2sh32 redeem lock. */
export function extractFailingP2sh32OutputPin(
  trace: AuthenticationProgramStateCommon[],
  band?: { start: number; end: number; nNew: number },
): { outputIndex: number; lockingBytecode: Uint8Array; commitment: string } | undefined {
  for (let i = trace.length - 1; i >= 0; i--) {
    const state = trace[i];
    if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTBYTECODE) continue;
    if (state.controlStack.some((flag) => flag === false)) continue;
    const equalStep = trace.slice(i + 1, Math.min(trace.length, i + 16)).find((candidate) =>
      candidate.instructions === state.instructions
      && candidate.instructions[candidate.ip]?.opcode === Op.OP_EQUALVERIFY
      && candidate.stack.length >= 2);
    if (!equalStep) continue;
    const actual = equalStep.stack[equalStep.stack.length - 1];
    const expected = isP2sh32LockingBytecode(equalStep.stack[equalStep.stack.length - 2])
      ? equalStep.stack[equalStep.stack.length - 2]
      : [...equalStep.stack].reverse().find((item) => (
        isP2sh32LockingBytecode(item) && binToHex(item) !== binToHex(actual)
      ));
    if (!expected || !isP2sh32LockingBytecode(expected)) continue;
    if (binToHex(expected) === binToHex(actual)) continue;
    const indexItem = state.stack[state.stack.length - 1];
    const outputIndex = Number(decodeScriptNumber(indexItem));
    if (!Number.isFinite(outputIndex) || outputIndex < 0) continue;
    if (band && (outputIndex < band.start || outputIndex > band.end)) continue;
    return { outputIndex, lockingBytecode: expected, commitment: '00' };
  }
  return undefined;
}

/**
 * A long computed vmap value is already on the stack at the chunk pin. Recover every
 * continuation at once so nNew>2 does not depend on the root covenant staying red.
 */
export let lastExtractedComputedValue: Uint8Array | undefined;

export function extractAllRouteValueChunks(
  trace: AuthenticationProgramStateCommon[],
  pin?: { outputIndex: number; commitment: string; lockingBytecode?: Uint8Array },
  fallbackBase = -1,
  plannedWidth = 0,
  categoryId?: string,
  valueChunkWrites?: ReadonlyArray<ValueChunkWriteDescriptor>,
  candidateValues: ReadonlyArray<Uint8Array> = [],
  stagingSession?: ValueChunkWriteStagingSession,
  producerClaims: ReadonlyArray<ValueChunkProducerResourceClaim> = [],
  stateOwner?: { categoryId: string; lockingBytecode: string },
): Array<{ outputIndex: number; lockingBytecode: Uint8Array; commitment: string }> {
  lastExtractedComputedValue = undefined;
  let minChunks = plannedWidth;
  const pinChunkIndex = pin ? valueChunkIndexFromCommitment(pin.commitment) : undefined;
  if (pinChunkIndex !== undefined) minChunks = Math.max(minChunks, pinChunkIndex + 1);
  if (pin && fallbackBase >= 0 && pin.outputIndex >= fallbackBase) {
    minChunks = Math.max(minChunks, pin.outputIndex - fallbackBase + 1);
  }
  const stacks = trace.flatMap((state) => {
    const extra = 'alternateStack' in state
      ? [(state as { alternateStack?: Uint8Array[] }).alternateStack ?? []]
      : [];
    return [state.stack, ...extra];
  });
  // Staged INSERT/UPDATE blobs (from publishJobEvent args / leading pushes) are
  // authoritative candidates when the VM stack no longer holds the full value.
  // A staged write is the derived continuation value for its exact resource, so it outranks every
  // reconstructed candidate: the pre-value witness authenticates the entry BEFORE this handler and must
  // never win while a post-value for the same resource is available. The historical category-global cache
  // is compatibility state, so it stays behind both.
  const stagedCandidates: Uint8Array[] = [];
  if (valueChunkWrites) {
    for (const write of valueChunkWrites) {
      const staged = stagedValueChunkWrite(write, stagingSession);
      if (staged && staged.length > VALUE_HEAD_SIZE) stagedCandidates.push(staged);
    }
  }
  // The historical category-global cache is compatibility state for descriptor-free callers. A compiler-described
  // call authenticates its collection signature and key slot, and borrowing from a category-wide cache lets an
  // array written for a different job - or a different collection - shadow this resource. It is never a
  // candidate when descriptors exist.
  const historicalCandidate = valueChunkWrites === undefined && categoryId
    ? legacyPersistedValueChunkValue(categoryId) : undefined;
  // Resource identity selects a storage cell, not a mutation epoch. Only the
  // compiler-authenticated terminal producer may authorize a post-state value
  // which is not itself present behind a VM tail/digest.
  let producerSelectionStatus = 'not-attempted';
  const selectedResource = valueChunkWrites?.length
    ? selectValueChunkResource(valueChunkWrites) : undefined;
  const exactWrite = selectedResource?.status === 'exact'
    ? valueChunkWrites?.find((candidate) => (
      valueChunkWriteResourceIdentity(candidate) === selectedResource.identity
    ))
    : undefined;
  const producerAuthenticatedCandidate = (() => {
    if (!valueChunkWrites?.length || !stagingSession || !stateOwner) return undefined;
    const resource = selectedResource ?? { status: 'absent' as const };
    producerSelectionStatus = `resource:${resource.status}`;
    if (resource.status !== 'exact') return undefined;
    const producer = selectSingletonValueChunkProducer(
      producerClaims, resource.identity, stateOwner,
    );
    producerSelectionStatus = `producer:${producer.status}`;
    if (producer.status !== 'exact') return undefined;
    const write = exactWrite;
    if (write === undefined) {
      producerSelectionStatus = 'write:absent';
      return undefined;
    }
    const owned = stagingSession.getOwned(write, producer.claim, stateOwner);
    producerSelectionStatus = owned === undefined ? 'owned:absent' : `owned:${owned.length}`;
    return owned;
  })();
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1' && valueChunkWrites !== undefined) {
    console.error('value-chunk-producer-select', JSON.stringify({
      producerSelectionStatus,
      writeCount: valueChunkWrites.length,
      claimCount: producerClaims.length,
      stateOwner,
      minChunks,
    }));
  }
  const allCandidates = [
    ...stagedCandidates,
    ...candidateValues,
    ...(historicalCandidate && historicalCandidate.length > VALUE_HEAD_SIZE ? [historicalCandidate] : []),
  ];
  let selected = selectHashedValueForChunkPin(
    stacks,
    pin?.lockingBytecode,
    minChunks,
    allCandidates,
    producerAuthenticatedCandidate,
    valueChunkWrites === undefined,
    exactWrite,
  );
  const persistedWrite = valueChunkWrites === undefined
    ? undefined : selectPersistedValueChunkWrite(valueChunkWrites, categoryId, stagingSession);
  // Compatibility-only callers without compiler descriptors may still use the historical category cache.
  // Descriptor-aware kernel calls must authenticate collection signature + key slot before borrowing state.
  const persisted = valueChunkWrites === undefined
    ? (categoryId ? legacyPersistedValueChunkValue(categoryId) : undefined)
    : (persistedWrite
      ? (stagedValueChunkWrite(persistedWrite, stagingSession)
        ?? persistedValueChunkWriteState(persistedWrite)?.value)
      : undefined);
  const persistWideEnough = persisted
    && Math.ceil((persisted.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE) >= Math.max(1, minChunks);
  if (valueChunkWrites === undefined && (!selected || (minChunks > 0
    && Math.ceil((selected.value.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE) < minChunks))
    && persistWideEnough && persisted) {
    selected = {
      value: persisted,
      lockingBytecode: pin?.lockingBytecode
        && pin.lockingBytecode.length === 35
        ? pin.lockingBytecode
        : selected?.lockingBytecode ?? chunksFromJobEventsValue(persisted)[0]?.lockingBytecode,
    };
  }
  if (!selected) return [];
  lastExtractedComputedValue = selected.value;
  const nNew = Math.ceil((selected.value.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE);
  if (nNew < 1) return [];
  const chunkIndex = pinChunkIndex ?? 0;
  const pinnedBase = pin !== undefined && pin.outputIndex >= chunkIndex
    ? pin.outputIndex - chunkIndex
    : -1;
  // A probe pin that lands before the known trailing band is a false positional hit
  // (e.g. dataNft / insert-band indices). Prefer the authoritative fallbackBase so
  // publishJobEvent value chunks stay at __internal__valueChunkOutputBase.
  const base = pinnedBase >= 0
    && (fallbackBase < 0 || pinnedBase >= fallbackBase)
    ? pinnedBase
    : fallbackBase;
  if (base < 0) return [];
  const redeemLock = pin?.lockingBytecode && isP2sh32LockingBytecode(pin.lockingBytecode)
    ? pin.lockingBytecode
    : valueChunkWrites === undefined
      ? (categoryId ? legacyPersistedValueChunkLock(categoryId) : undefined)
      : persistedWrite ? persistedValueChunkWriteState(persistedWrite)?.lockingBytecode : undefined;
  if (valueChunkWrites !== undefined && redeemLock) {
    const selection = selectValueChunkWriteCategory(valueChunkWrites.filter((write) => (
      categoryId === undefined || write.categoryId.toLowerCase() === categoryId.toLowerCase()
    )));
    if (selection.status === 'exact') {
      rememberValueChunkUnlockRecipe(selection.write, selected.value, redeemLock);
    } else if (selection.status === 'absent' && categoryId) {
      // Compatibility only for descriptor-free artifacts.
      legacyRememberValueChunkLock(categoryId, redeemLock);
    }
  } else if (categoryId && redeemLock) {
    // Compatibility only for descriptor-free artifacts.
    legacyRememberValueChunkLock(categoryId, redeemLock);
  }
  const lock = redeemLock ?? selected.lockingBytecode;
  return applyRedeemLockToChunks(
    chunksFromJobEventsValue(selected.value, lock, categoryId),
    lock,
  ).map((chunk, index) => ({
    outputIndex: base + index,
    lockingBytecode: chunk.lockingBytecode,
    commitment: chunk.commitment,
  }));
}

export function deriveRouteValueChunks(
  group: ExternalCallUtxoGroup, bOutputBase: number, trace: AuthenticationProgramStateCommon[],
  stb: StatefulTransactionBuilder,
  observations: RouteProbeObservationHistory,
  convention?: 'legacy-unroll' | 'kernel-row-loop',
): RouteValueChunkProgress {
  if (!group.blockLayout) return { changed: false, discovered: false };
  const sharedBand = stb.getPublishJobEventsBand();
  const explicitBase = group.valueChunkOutputBase !== undefined && group.valueChunkOutputBase >= 0
    ? group.valueChunkOutputBase : undefined;
  const witness = valueChunkOutputWitnessCarrier(stb, group);
  const usesSharedBand = explicitBase !== undefined && sharedBand?.start === explicitBase
    && witness !== undefined && writesChunkableValue(witness.carrier, witness.abiFunction);
  const pinBand = explicitBase === undefined ? sharedBand : {
    start: explicitBase,
    end: explicitBase + VALUE_CHUNK_MAX_COUNT - 1,
    nNew: group.valueChunkOutputCount ?? 0,
  };
  const identityPin = extractIdentityScanValueChunkPin(trace);
  const continuationBase = explicitBase ?? sharedBand?.start ?? -1;
  const pin = identityPin && continuationBase >= 0
    ? {
      outputIndex: continuationBase,
      lockingBytecode: identityPin.lockingBytecode,
      commitment: '00',
    }
    : extractRouteChunkPin(trace)
      ?? extractFailingP2sh32OutputPin(trace, pinBand);
  if (!pin) return { changed: false, discovered: false };
  if (usesSharedBand && isP2sh32LockingBytecode(pin.lockingBytecode)) {
    stb.setJobEventsRedeemLock(pin.lockingBytecode);
  }
  const blockSlot = pin.outputIndex - bOutputBase;
  const kind = group.blockLayout.slots[blockSlot]?.kind;
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
    console.error('route-value-chunks', {
      outputIndex: pin.outputIndex, blockSlot, kind, commitmentBytes: pin.commitment.length / 2,
      lockingBytecode: binToHex(pin.lockingBytecode),
    });
  }
  // The pin's absolute index belongs to whichever group's block covers it, which is NOT necessarily the group
  // this trace came from (the covenant's base is the proxy master). Storing it builder-level lets the block
  // loop match it wherever it lands.
  // The complete computed value is already present in the first failing trace. Recover its whole continuation
  // run at once: probing one placeholder at a time adds O(chunks) full VM evaluations and cannot expand a later
  // participant's already-fixed input base. This also applies to ordinary nested handlers, not only compiler
  // routes and embedded delegates; they use the same chunk covenant and balanced block geometry.
  let progressed = false;
  let discovered = false;
  const localWrites = group.valueChunkWrites ?? describeValueChunkWrites(group);
  // Compiler-authored kernel descriptors are authoritative. A P2SH32 equality in a carrier with no chunkable
  // write describes an entry/resource lock, never permission to infer a value-chunk resource by output shape.
  /* eslint-disable @typescript-eslint/indent */
  if (permitsRouteValueChunkDerivation(convention, localWrites)) {
  const writes = localWrites;
  const allChunks = extractAllRouteValueChunks(
    trace, pin,
    continuationBase,
    usesSharedBand
      ? sharedBand?.nNew ?? 0
      : group.valueChunkOutputCount ?? identityPin?.nNew ?? 0,
    usesSharedBand ? group.categoryId : undefined,
    writes,
    [],
    stb.valueChunkWriteStagingSession,
    group.valueChunkProducerClaims,
    group.valueChunkStateOwner,
  );
  if (witness && allChunks.length > 0) {
    for (const collection of chunkableValueWriteCollections(witness.carrier, witness.abiFunction)) {
      stb.rememberObservedValueChunks(group.categoryId, collection, allChunks.map((chunk) => ({
        ...chunk, categoryId: group.categoryId,
      })));
    }
  }
  /* eslint-enable @typescript-eslint/indent */
  if (usesSharedBand && group.categoryId && lastExtractedComputedValue) {
    const selection = selectValueChunkWriteCategory(
      writes,
    );
    if (selection.status === 'absent' && permitsLegacyNamedValueChunkFallback(
      [group], (physicalExternalCallFunction(group) as MessageBusRuntimeAbiFunction | undefined)
        ?.messageBusConvention,
    )) {
      // Compatibility only for descriptor-free artifacts.
      legacyRememberValueChunkValue(group.categoryId, lastExtractedComputedValue);
    }
    if (convention !== 'kernel-row-loop') {
      stb.rememberJobEventsChunks(group.categoryId, allChunks.map((chunk) => ({
        ...chunk,
        categoryId: group.categoryId,
      })));
      if (stb.bumpPublishJobEventsWidth(allChunks.length)) stb._refreshInputs();
    }
  }
  const resourceSelection = selectValueChunkWriteCategory(writes);
  const resourceIdentity = resourceSelection.status === 'exact'
    ? valueChunkWriteResourceIdentity(resourceSelection.write) : undefined;
  const exactRunObservation = convention === 'kernel-row-loop'
    && resourceIdentity !== undefined && allChunks.length > 0
    ? recordRouteProbeObservation(observations, {
      identity: `value-run:${resourceIdentity}`,
      fingerprint: routeValueRunFingerprint(allChunks),
    }, convention)
    : undefined;
  if (resourceIdentity !== undefined && allChunks.length > 0) {
    if (group.valueChunkWrites === undefined) group.valueChunkWrites = [...writes];
    if (witness && witness.carrier.valueChunkWrites === undefined) {
      witness.carrier.valueChunkWrites = [...writes];
    }
  }
  // A later P2SH32 mismatch in the same handler can belong to an entry or another resource. Once this exact
  // compiler resource has published the same semantic run, never re-project those bytes onto the later index.
  if (exactRunObservation !== 'same') {
    for (const chunk of allChunks) {
      const parsed = parseValueChunkCommitment(chunk.commitment);
      progressed = stb.setDerivedChunkOutput(chunk.outputIndex, {
        commitment: chunk.commitment,
        lockingBytecode: chunk.lockingBytecode,
        categoryId: group.categoryId,
        fixedIndex: !usesSharedBand,
        semanticKind: 'valueChunk',
        resourceIdentity,
        resourcePart: resourceIdentity ? `chunk:${parsed.chunkIndex}` : undefined,
      }) || progressed;
    }
    // An exact compiler resource is materialized only from its authenticated complete run. The failing pin can
    // be a one-byte discovery sentinel or belong to a later entry/resource check; it is not a value-chunk member
    // merely because this trace also exposed a value run.
    if (resourceIdentity === undefined
      && !allChunks.some((chunk) => chunk.outputIndex === pin.outputIndex)) {
      progressed = stb.setDerivedChunkOutput(pin.outputIndex, {
        commitment: pin.commitment, lockingBytecode: pin.lockingBytecode, categoryId: group.categoryId,
        fixedIndex: !usesSharedBand,
        semanticKind: 'valueChunk',
        resourceIdentity,
      }) || progressed;
    }
  }
  if (progressed) {
    const selection = resourceSelection;
    if (convention === 'kernel-row-loop'
      && selection.status !== 'exact') {
      throw new Error(
        'Kernel route value-chunk derivation requires one exact compiler-published resource identity.',
      );
    }
    if (exactRunObservation !== undefined) {
      discovered = exactRunObservation !== 'same';
    } else {
      const identity = selection.status === 'exact'
        ? `value-run:${valueChunkWriteResourceIdentity(selection.write)}`
        : `value-coordinate:${group.categoryId}:${pin.outputIndex}`;
      const fingerprint = routeValueRunFingerprint(allChunks.length > 0 ? allChunks : [pin]);
      discovered = recordRouteProbeObservation(
        observations, { identity, fingerprint }, convention,
      ) !== 'same';
    }
    return { changed: true, discovered };
  }
  }

  // After computed chunks converge, the route can reach an active fixed entry whose balanced input was a plain
  // funder (an absent sorted-batch target). Its outlined address helper fails before the commitment is visible.
  // Seed that exact physical output with the authenticated entry address; the next pass reveals its commitment.
  for (let i = trace.length - 1; i >= 0; i--) {
    const equal = trace[i];
    if (equal.instructions[equal.ip]?.opcode !== Op.OP_EQUALVERIFY || equal.stack.length < 2) continue;
    const expected = equal.stack[equal.stack.length - 1];
    const actual = equal.stack[equal.stack.length - 2];
    if (expected.length !== 35 || expected[0] !== 0xaa || expected[1] !== 0x20 || expected[34] !== 0x87
      || binToHex(expected) === binToHex(actual)) continue;
    const outputRead = trace.slice(Math.max(0, i - 12), i).reverse().find((candidate) =>
      candidate.instructions === equal.instructions
      && candidate.instructions[candidate.ip]?.opcode === Op.OP_OUTPUTBYTECODE
      && candidate.instructions[candidate.ip - 1]?.opcode === Op.OP_SWAP
      && candidate.stack.length > 1);
    if (!outputRead) continue;
    const outputIndex = Number(decodeScriptNumber(outputRead.stack[outputRead.stack.length - 1]));
    const blockSlot = outputIndex - bOutputBase;
    if (group.blockLayout.slots[blockSlot]?.kind !== 'entry') continue;
    if (stb.setDerivedChunkOutput(outputIndex, {
      commitment: '00', lockingBytecode: expected, categoryId: group.categoryId,
      fixedIndex: explicitBase !== undefined && !usesSharedBand,
      semanticKind: 'entryPin',
    })) {
      const identity = `entry-lock:${group.categoryId}:${blockSlot}`;
      discovered = recordRouteProbeObservation(observations, {
        identity,
        fingerprint: binToHex(expected),
      }, convention) !== 'same';
      return { changed: true, discovered };
    }
  }
  return { changed: false, discovered: false };
}

export function valueChunkOutputWitnessCarrier(
  stb: StatefulTransactionBuilder,
  group: ExternalCallUtxoGroup,
): { carrier: ExternalCallUtxoGroup; abiFunction: AbiFunction } | undefined {
  const carrier = group.delegateCallGroupIndex === undefined
    ? group
    : stb.getLowLevelCallUtxoGroups()[group.delegateCallGroupIndex];
  if (!carrier) return undefined;
  const carrierFunctionName = carrier.logicalFunctionName
    ?? carrier.compilerRoute?.abiFunction.name
    ?? carrier.functionName;
  const abiCandidates = [
    carrier.compilerRoute?.abiFunction,
    ...((carrier.externalContract?.inner.artifact.abi as readonly AbiFunction[] | undefined) ?? []),
    group.compilerRoute?.abiFunction,
    ...((group.externalContract?.inner.artifact.abi as readonly AbiFunction[] | undefined) ?? []),
  ];
  const abiFunction = abiCandidates.find((candidate) => (
    candidate?.inputs.some((input) => input.name === '__internal__valueChunkOutputBase')
      && (candidate === carrier.compilerRoute?.abiFunction
        || candidate === group.compilerRoute?.abiFunction
        || candidate.name === carrierFunctionName)
  ));
  // Several logical calls can share one delegated implementation input. The physical carrier's unlock bytecode,
  // rather than whichever logical call happens to represent the fused group, consumes this absolute witness.
  if (!abiFunction) return undefined;
  return { carrier, abiFunction };
}

