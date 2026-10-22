/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 1 return-event blob + event discovery/progress.
 */

import { sha256 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction } from '@solidcash/utils';
import {
  Op,
  buildEventNftCovenantScript,
  computeEventNameHash,
} from '@solidcash/utils';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { StateValueType } from '../types/state-inference.js';
import { generateLibauthSourceOutputs, scriptToLockingBytecode } from '../utils.js';
import { isCompilerDescribedRouteEventCommitment } from './compiler-described-route-event.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  extractEvmScalarReturnCommitment,
  isCanonicalEvmReturnVector,
  selectEvmScalarReturnCommitment,
} from './external-return-encoding.js';
import {
  evaluateBoundedProbeCandidates,
  evaluateFaithfulOrDebugTrace,
  evaluateProbeTrace,
} from './faithful-probe-trace.js';
import { resolveExternalResultEncoding } from './solidityAbi.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import {
  decodeScriptNumber,
  extractCommitmentMapFromTrace,
  extractCommitmentsFromTrace,
  extractExpectedOutputCommitmentFromTrace,
  extractPendingReturnCommitment,
} from './trace-commitment-helpers.js';
import { commitmentsToState } from './trace-verified-value-helpers.js';
import { selectExternalEventProbeInput } from './value-chunk-base-writer-select.js';
import { logicalReturnGroupIndex } from './value-chunk-geometry.js';

export interface DeriveFullPhase1ReturnAndEventsHost {
  readonly inner: { provider: NetworkProvider };
}

/**
 * Derive the callee return-event commitment and progressively discover/install
 * event (and post-event entry/data) commitments for one Phase-1 external group.
 */
export function deriveFullPhase1ReturnAndEvents(
  host: DeriveFullPhase1ReturnAndEventsHost,
  stb: StatefulTransactionBuilder,
  externalCallUtxoGroups: ExternalCallUtxoGroup[],
  group: ExternalCallUtxoGroup,
  groupIdx: number,
  externalCalls: readonly { hasReturnValues?: boolean }[],
  hasReturnValues: boolean | undefined,
  bOutputBase: number,
  bMasterIdx: number,
): void {
  const ec = { hasReturnValues };
  const routeReturnDebugEnabled = (): boolean => {
    const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
    return env?.SOLIDC_DEBUG_ROUTE_CONCISE === '1' || env?.SOLIDC_DEBUG_RETURN === '1';
  };
  // Return event blob: extract from the dedicated return-event section, whose index is fixed at the
  // tx end and therefore order-independent. The inline data-NFT range only coincides with the return
  // event when the returning call is the LAST external call; a call following it shifts the return
  // event out of that range, so the extraction MUST target the return-event section directly. The
  // returning call's covenant pushes the expected return blob before its OP_EQUALVERIFY against the
  // (placeholder) return-event output, so the value is in the trace even when the probe aborts there.
  // Re-run B's VM with any data NFT commitments now set so B's script reliably reaches that point.
  // The range covers all return events (chained A->B->C give each group a distinct index); B's script
  // verifies only its own, so exactly one matches.
  if (ec.hasReturnValues
    && (group.fusedReturnGroupIndex !== undefined || !group.precomputedReturnCommitment)) {
    const probeBuilderRet = stb.build();
    const transactionRet = probeBuilderRet.buildLibauthTransaction();
    const sourceOutputsRet = generateLibauthSourceOutputs(probeBuilderRet.inputs);
    const returnProgram = {
      inputIndex: bMasterIdx,
      sourceOutputs: sourceOutputsRet,
      transaction: transactionRet,
    };
    let fullTraceRet = evaluateProbeTrace(host.inner.provider, returnProgram);

    // X13: in the in-block regime this group's return event sits at its own block slot, so scan exactly
    // that index; otherwise scan the appended tail band shared by every returning callee.
    const derivedInBlockIdx = stb.getExternalCallReturnEventOutputIndex(groupIdx);
    const inBlockIdx = group.returnOutputIndex ?? derivedInBlockIdx;
    const returnEventOutputBase = inBlockIdx >= 0 ? inBlockIdx : stb.getReturnEventOutputBase();
    const totalReturnEvents = inBlockIdx >= 0
      ? 1 : externalCalls.filter((e) => e.hasReturnValues).length;
    const returnOutputRange = {
      min: returnEventOutputBase,
      max: returnEventOutputBase + totalReturnEvents,
    };
    let returnCommitments = extractCommitmentsFromTrace(fullTraceRet, 1, returnOutputRange, true);
    const routeReturnTypes = (group.compilerRoute?.rowArguments ?? []).flatMap(
      (row) => row.handler.outputs?.map((output) => output.type) ?? [],
    );
    const calleeReturnArtifact = group.externalContract.inner.artifact;
    const calleeReturnFunction = (calleeReturnArtifact.abi as readonly AbiFunction[])
      .find((candidate) => candidate.name === group.functionName);
    const calleeReturnTypes = (calleeReturnFunction?.outputs ?? []).map((output) => output.type);
    const calleeReturnEncoding = calleeReturnTypes.length === 0 ? undefined
      : resolveExternalResultEncoding(
        calleeReturnFunction?.resultEncoding,
        calleeReturnArtifact,
        calleeReturnTypes,
        `function '${calleeReturnFunction?.name ?? group.functionName}' result`,
      );
    const routeReturnPushes = routeReturnTypes.length || 1;
    let aggregatePending = routeReturnPushes > 1
      ? extractPendingReturnCommitment(fullTraceRet, routeReturnPushes, routeReturnTypes) : undefined;
    if (!returnCommitments?.length && aggregatePending) returnCommitments = [aggregatePending];
    else if (!returnCommitments?.length) {
      const pending = extractPendingReturnCommitment(fullTraceRet, routeReturnPushes, routeReturnTypes);
      if (pending) returnCommitments = [pending];
    }
    let evmScalar = calleeReturnEncoding === 'evm-abi-v1'
      ? extractEvmScalarReturnCommitment(fullTraceRet, calleeReturnTypes, false) : undefined;
    if (!returnCommitments?.length && !evmScalar && calleeReturnEncoding === 'evm-abi-v1') {
      evmScalar = selectEvmScalarReturnCommitment(
        evaluateBoundedProbeCandidates(host.inner.provider, returnProgram), calleeReturnTypes, false,
      );
    }
    if (!returnCommitments?.length && !evmScalar) {
      fullTraceRet = evaluateFaithfulOrDebugTrace(host.inner.provider, returnProgram);
      returnCommitments = extractCommitmentsFromTrace(fullTraceRet, 1, returnOutputRange, true);
      aggregatePending = routeReturnPushes > 1
        ? extractPendingReturnCommitment(fullTraceRet, routeReturnPushes, routeReturnTypes) : undefined;
      if (!returnCommitments?.length && aggregatePending) returnCommitments = [aggregatePending];
      else if (!returnCommitments?.length) {
        const pending = extractPendingReturnCommitment(fullTraceRet, routeReturnPushes, routeReturnTypes);
        if (pending) returnCommitments = [pending];
      }
      evmScalar = calleeReturnEncoding === 'evm-abi-v1'
        ? extractEvmScalarReturnCommitment(fullTraceRet, calleeReturnTypes, false) : undefined;
    }
    if (inBlockIdx >= 0) {
      const materializedCommitment = transactionRet.outputs[inBlockIdx]?.token?.nft?.commitment;
      const materializedHex = materializedCommitment === undefined
        ? '' : binToHex(materializedCommitment);
      const expectedCommitment = extractExpectedOutputCommitmentFromTrace(
        fullTraceRet, inBlockIdx, materializedHex,
      );
      if (expectedCommitment && (!returnCommitments?.length
        || returnCommitments[0] === materializedHex
        || returnCommitments.every((commitment) => /^0+$/.test(commitment)))) {
        returnCommitments = [expectedCommitment];
      }
      // A long ABI return cannot fit in an NFT commitment. The generated covenant compares the
      // SHA256 of its raw return against this output instead. At the dedicated output read, the
      // adjacent stack word is that expected digest; recover its exact preimage from the same
      // trace only when the digest and declared ABI shape both match. The completed transaction
      // still has to pass the covenant VM proof with the resulting output.
      if (calleeReturnEncoding === 'evm-abi-v1' && calleeReturnTypes.length === 1) {
        const expectedDigests = new Set(fullTraceRet.flatMap((state) => {
          if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTTOKENCOMMITMENT
            || state.stack.length < 2
            || Number(decodeScriptNumber(state.stack.at(-1)!)) !== inBlockIdx) return [];
          const candidate = state.stack.at(-2)!;
          return candidate.length === 32 ? [binToHex(candidate)] : [];
        }));
        if (expectedDigests.size > 0) {
          const rawReturn = fullTraceRet.flatMap((state) => state.stack).find((candidate) =>
            candidate.length > 128
            && isCanonicalEvmReturnVector(candidate, calleeReturnTypes,
              calleeReturnArtifact.structs ?? calleeReturnArtifact.stateLayout?.structs,
              calleeReturnArtifact.enums)
            && expectedDigests.has(binToHex(sha256.hash(candidate))));
          if (rawReturn) returnCommitments = [binToHex(rawReturn)];
        }
      }
    }
    // A direct callee pins its call's record: the checks below read the result behind it.
    const recordIdentity = `external-call:${logicalReturnGroupIndex(externalCallUtxoGroups, groupIdx)}`;
    returnCommitments = returnCommitments?.map((commitment) => binToHex(
      stb.rawOfReturnRecord(recordIdentity, hexToBin(commitment), fullTraceRet),
    ));
    // An exact return-output comparison binds the result to the compiler-assigned channel. A schema-shaped
    // stack value is only fallback evidence: mappings and state serialization can leave canonical pushdata
    // wrappers around unrelated ABI-width words (for example a hashed key) in the same route frame.
    // Never let that weaker scan replace an authenticated output observation.
    if (evmScalar && !returnCommitments?.length
      && (!fullTraceRet.at(-1)?.error || !/^0+$/.test(evmScalar))) {
      const boolReturn = calleeReturnTypes.length === 1 && calleeReturnTypes[0] === 'bool';
      const precomputedHex = group.precomputedReturnCommitment
        ? binToHex(group.precomputedReturnCommitment) : undefined;
      const scannedTrue = boolReturn && /^(00)+01$/.test(evmScalar);
      const precomputedFalse = boolReturn && precomputedHex !== undefined
        && /^(00)+$/.test(precomputedHex);
      if (!(scannedTrue && precomputedFalse)) {
        returnCommitments = [evmScalar];
      } else if (!returnCommitments?.length && precomputedHex) {
        returnCommitments = [precomputedHex];
      }
    }
    const reachedReturnCommitmentRead = fullTraceRet.some((state) => {
      if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTTOKENCOMMITMENT
        || state.stack.length === 0) return false;
      try {
        const outputIndex = Number(decodeScriptNumber(state.stack.at(-1)!));
        return outputIndex >= returnOutputRange.min && outputIndex < returnOutputRange.max;
      } catch {
        return false;
      }
    });
    // A failing pre-return probe contains many ABI-zero words (addresses, keys, and seed outputs).
    // Neither the generic pending-stack scan nor scalar fallback can authenticate one as the return.
    // Keep the provisional advancing value until the callee actually reads its dedicated output.
    if (fullTraceRet.at(-1)?.error && !reachedReturnCommitmentRead
      && returnCommitments?.every((commitment) => /^0+$/.test(commitment))) {
      returnCommitments = undefined;
    }
    // A failed probe can leave a scalar `true` (0151) or a prior callee's result on the stack. Neither is an
    // authenticated fixed-array return merely because it was the last complete push observed. Keep the typed
    // provisional slot until the callee reaches its own return comparison.
    if (returnCommitments?.length && calleeReturnEncoding === 'evm-abi-v1'
      && !isCanonicalEvmReturnVector(hexToBin(returnCommitments[0]), calleeReturnTypes,
        calleeReturnArtifact.structs ?? calleeReturnArtifact.stateLayout?.structs,
        calleeReturnArtifact.enums)) {
      returnCommitments = undefined;
    }
    if (['SOLIDC_DEBUG_ROUTE', 'SOLIDC_DEBUG_RETURN'].some((name) =>
      (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[name] === '1')) {
      console.error('route-return-derivation', {
        groupIdx,
        functionName: group.functionName,
        fusedReturnGroupIndex: group.fusedReturnGroupIndex,
        bMasterIdx,
        returnOutputRange,
        configuredReturnOutputIndex: group.returnOutputIndex,
        derivedInBlockIdx,
        routeReturnTypes,
        routeReturnPushes,
        returnCommitments,
        traceError: fullTraceRet.at(-1)?.error,
        traceTail: fullTraceRet.slice((globalThis as { process?: { env?: Record<string, string> } })
          .process?.env?.SOLIDC_DEBUG_RETURN === '1' ? -120 : -25).map((state) => ({
          ip: state.ip,
          instructionCount: state.instructions.length,
          opcode: state.instructions[state.ip]?.opcode,
          error: state.error,
          stack: state.stack.slice((globalThis as { process?: { env?: Record<string, string> } })
            .process?.env?.SOLIDC_DEBUG_RETURN === '1' ? -80 : -4).map(binToHex),
        })),
      });
    }
    if (returnCommitments && returnCommitments.length > 0) {
      const returnGroupIndex = logicalReturnGroupIndex(externalCallUtxoGroups, groupIdx);
      stb.setReturnEventOutput(
        group.categoryId,
        hexToBin(returnCommitments[0]),
        `external-call:${returnGroupIndex}`,
        false,
        fullTraceRet,
      );
      // A shared ordinary readonly input executes only one selected zero-argument frame. Every active
      // identical alias is bound to that same result by the caller covenant; retain its distinct output channel.
      if (group.readonlyReturnSelector !== undefined && !group.compilerRoute) {
        for (const [aliasIndex, alias] of externalCallUtxoGroups.entries()) {
          if (alias.sharedGroupIndex !== groupIdx || alias.compilerRoute
            || alias.readonlyReturnSelector !== group.readonlyReturnSelector
            || alias.callerIdentity?.categoryId !== group.callerIdentity?.categoryId
            || alias.callerIdentity?.lockingBytecode !== group.callerIdentity?.lockingBytecode) continue;
          stb.setReturnEventOutput(
            group.categoryId, hexToBin(returnCommitments[0]), `external-call:${aliasIndex}`, false, fullTraceRet,
          );
        }
      }
      if (returnGroupIndex !== groupIdx) {
        stb.setReturnEventOutput(
          group.categoryId,
          hexToBin(returnCommitments[0]),
          `external-call:${groupIdx}`,
          false,
          fullTraceRet,
        );
      }
    }
  }

  // Extract B's event commitments (if B's function emits events).
  // This requires a second VM run after B's data NFT commitments are set,
  // because B's script verifies data NFT commitments before event commitments.
  // The first run extracts data NFT commitments; with those in place, the
  // second run gets further in B's script to extract event commitments.
  if (group.blockLayout && group.externalContract) {
    const delegateEventGroup = group.delegateCallGroupIndex === undefined
      ? undefined : stb.getLowLevelCallUtxoGroups()[group.delegateCallGroupIndex];
    const bArt = delegateEventGroup?.externalContract.inner?.artifact
      ?? group.externalContract.inner?.artifact ?? group.externalContract.artifact;
    const bAbiFunc = delegateEventGroup?.compilerRoute?.abiFunction
      ?? group.compilerRoute?.abiFunction
      ?? bArt?.abi?.find((f: any) => f.name === (delegateEventGroup?.functionName ?? group.functionName));
    const routeEventSignatures = delegateEventGroup?.compilerRoute?.eventSignaturesBySlot
      ?? group.compilerRoute?.eventSignaturesBySlot;
    const bEmits: Array<{ eventSignature: string; emitIndex: number } | undefined> =
      routeEventSignatures
        ? routeEventSignatures.map((eventSignature, emitIndex) => eventSignature
          ? { eventSignature, emitIndex } : undefined)
        : bAbiFunc?.emits ?? [];

    if (bEmits.some((emit) => emit !== undefined)) {
    // Delegate callees emit at their implementation-relative offset.
    // The proxy __forward layout is only master+data and has no event slot.
      const eventSlots: Array<{ kind: string; offset: number }> = (
        bAbiFunc?.blockLayout?.slots ?? group.blockLayout.slots
      ).filter((s: { kind: string; offset: number }) => s.kind === 'event');
      if (eventSlots.length > 0) {
      // Delegate output-only slots are implementation-relative. The compiler-published delegate-group
      // association identifies that execution input; source function names have no bearing on geometry.
        const delegateEventInput = group.delegateCallGroupIndex === undefined
          ? -1 : stb.getLowLevelCallMasterInputIndex(group.delegateCallGroupIndex);
        const eventProbeInput = selectExternalEventProbeInput(
          group, delegateEventInput, bMasterIdx,
        );
        const eventOutputBase = eventProbeInput >= 0 ? eventProbeInput : bOutputBase;
        const probeBuilder2 = stb.build();
        const transaction2 = probeBuilder2.buildLibauthTransaction();
        const sourceOutputs2 = generateLibauthSourceOutputs(probeBuilder2.inputs);
        const fullTrace2 = evaluateProbeTrace(host.inner.provider, {
          inputIndex: eventProbeInput >= 0 ? eventProbeInput : bMasterIdx,
          sourceOutputs: sourceOutputs2,
          transaction: transaction2,
        });

        const eventCommitments = extractCommitmentMapFromTrace(fullTrace2, undefined, true, false, true);
        if (['SOLIDC_DEBUG_ROUTE_CONCISE', 'SOLIDC_DEBUG_RETURN'].some((name) =>
          (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[name] === '1')) {
          console.error('route-event-discovery', {
            groupIdx,
            bOutputBase,
            returnOutput: transaction2.outputs[stb.getExternalCallReturnEventOutputIndex(groupIdx)],
            eventSlots: eventSlots.map((slot) => slot.offset),
            bEmits: bEmits.map((emit) => emit?.eventSignature),
            commitments: [...eventCommitments.entries()],
            error: fullTrace2.at(-1)?.error,
            invokedFrames: fullTrace2.flatMap((state, index) => {
              const previous = fullTrace2[index - 1];
              if (!previous || previous.instructions.length === state.instructions.length) return [];
              return [{
                index,
                from: previous.instructions.length,
                to: state.instructions.length,
                stack: state.stack.map((item) => {
                  const hex = binToHex(item);
                  return `${item.length}:${hex.slice(0, 48)}`;
                }),
              }];
            }).slice(-8),
            commitmentReads: fullTrace2.filter((state) =>
              state.instructions[state.ip]?.opcode === Op.OP_OUTPUTTOKENCOMMITMENT)
              .slice(-16).map((state) => ({
                index: state.stack.length > 0
                  ? Number(decodeScriptNumber(state.stack[state.stack.length - 1])) : undefined,
                stack: state.stack.slice(-6).map(binToHex),
              })),
          });
        }
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_ROUTE === '1') {
          console.error('route-event-derivation', {
            groupIdx,
            bOutputBase,
            bEmits,
            eventSlots,
            commitments: [...eventCommitments.entries()],
            traceError: fullTrace2.at(-1)?.error,
          });
        }
        const eventOutputs: Array<{
          eventSignature: string; commitment: string; lockingBytecode: Uint8Array;
        } | undefined> = Array(eventSlots.length);
        for (let ei = 0; ei < eventSlots.length; ei++) {
          const emitInfo = bEmits[ei];
          const commitment = eventCommitments.get(eventOutputBase + eventSlots[ei].offset);
          if (emitInfo && isCompilerDescribedRouteEventCommitment(commitment, {
            compilerOwnedEventSlot: true,
            eventSignature: emitInfo.eventSignature,
          })) {
            const eventNameHash = computeEventNameHash(emitInfo.eventSignature);
            const covenantScript = buildEventNftCovenantScript(
              hexToBin(group.categoryId), eventNameHash,
            );
            const lockingBytecode = scriptToLockingBytecode(
              covenantScript, group.externalContract.inner?.addressType ?? 'p2sh32',
            );
            eventOutputs[ei] = {
              eventSignature: emitInfo.eventSignature,
              commitment,
              lockingBytecode,
            };
          }
        }
        {
          group.eventOutputs = eventOutputs;
          // Conditional route events are verified in physical slot order. A route may validate the first
          // active event's covenant shape before exposing any event commitment, so bootstrap every
          // unresolved statically declared candidate with the right covenant and an empty commitment.
          // Retain a candidate only when the resulting trace proves that physical slot is active.
          for (let ei = 0; ei < eventSlots.length; ei++) {
            if (eventOutputs[ei] !== undefined) continue;
            const emitInfo = bEmits[ei];
            if (!emitInfo) continue;
            const eventNameHash = computeEventNameHash(emitInfo.eventSignature);
            const lockingBytecode = scriptToLockingBytecode(
              buildEventNftCovenantScript(hexToBin(group.categoryId), eventNameHash),
              group.externalContract.inner?.addressType ?? 'p2sh32',
            );
            eventOutputs[ei] = {
              eventSignature: emitInfo.eventSignature,
              commitment: '',
              lockingBytecode,
            };
            group.eventOutputs = eventOutputs;
            const progressiveProbe = stb.build();
            const progressiveTrace = evaluateProbeTrace(host.inner.provider, {
              inputIndex: eventProbeInput >= 0 ? eventProbeInput : bMasterIdx,
              sourceOutputs: generateLibauthSourceOutputs(progressiveProbe.inputs),
              transaction: progressiveProbe.buildLibauthTransaction(),
            });
            const progressiveCommitments = extractCommitmentMapFromTrace(
              progressiveTrace, undefined, true, false, true,
            );
            const commitment = progressiveCommitments.get(
              eventOutputBase + eventSlots[ei].offset,
            );
            if (isCompilerDescribedRouteEventCommitment(commitment, {
              compilerOwnedEventSlot: true,
              eventSignature: emitInfo.eventSignature,
            })) {
              eventOutputs[ei] = {
                eventSignature: emitInfo.eventSignature,
                commitment,
                lockingBytecode,
              };
            } else {
              eventOutputs[ei] = undefined;
            }
            group.eventOutputs = eventOutputs;
            if (routeReturnDebugEnabled()) {
              console.error('progressive-route-events', {
                candidate: ei,
                learned: eventOutputs.map((output, index) => output ? index : undefined)
                  .filter((index) => index !== undefined),
                error: progressiveTrace.at(-1)?.error,
                tail: progressiveTrace.slice(-8).map((state) => ({
                  ip: state.ip, count: state.instructions.length,
                  op: state.instructions[state.ip]?.opcode,
                  error: state.error,
                  stack: state.stack.slice(-30).map((item) => {
                    const hex = binToHex(item);
                    return `${item.length}:${hex.slice(0, 24)}`;
                  }),
                })),
                failureProgram: (() => {
                  const state = progressiveTrace.at(-1);
                  if (!state) return undefined;
                  return state.instructions.slice(Math.max(0, state.ip - 12), state.ip + 5)
                    .map((instruction, offset) => ({
                      ip: Math.max(0, state.ip - 12) + offset,
                      opcode: instruction.opcode,
                      data: 'data' in instruction && instruction.data
                        ? binToHex(instruction.data) : undefined,
                    }));
                })(),
                failureWindow: progressiveTrace.filter((state) =>
                  state.instructions.length === progressiveTrace.at(-1)?.instructions.length
                  && state.ip >= Math.max(0, (progressiveTrace.at(-1)?.ip ?? 0) - 8))
                  .slice(-16).map((state) => ({
                    ip: state.ip,
                    op: state.instructions[state.ip]?.opcode,
                    stack: state.stack.slice(-12).map((item) => {
                      const hex = binToHex(item);
                      return `${item.length}:${hex.slice(0, 64)}`;
                    }),
                  })),
                invokeWindow: progressiveTrace.filter((state) =>
                  state.instructions[state.ip]?.opcode === Op.OP_INVOKE)
                  .slice(-12).map((state) => ({
                    ip: state.ip,
                    count: state.instructions.length,
                    stack: state.stack.slice(-20).map((item) => {
                      const hex = binToHex(item);
                      return `${item.length}:${hex.slice(0, 64)}`;
                    }),
                  })),
                handlerPrefix: progressiveTrace.filter((state) =>
                  state.instructions.length > 300 && state.instructions.length < 2_000
                  && state.ip < 64)
                  .slice(-80).map((state) => ({
                    ip: state.ip,
                    count: state.instructions.length,
                    op: state.instructions[state.ip]?.opcode,
                    stack: state.stack.slice(-24).map((item) => {
                      const hex = binToHex(item);
                      return `${item.length}:${hex.slice(0, 64)}`;
                    }),
                  })),
                handlerRequire: progressiveTrace.filter((state) =>
                  state.instructions.length === 346 && state.ip >= 240)
                  .slice(-140).map((state) => ({
                    ip: state.ip,
                    count: state.instructions.length,
                    op: state.instructions[state.ip]?.opcode,
                    stack: state.stack.slice(-24).map((item) => {
                      const hex = binToHex(item);
                      return `${item.length}:${hex.slice(0, 64)}`;
                    }),
                  })),
              });
            }
          }
        }
      }
    }
  }

  // A compiler route can verify conditional events before its deferred collection-entry settlement.
  // The pre-event entry pass above then legitimately reveals only an event commitment. Once reached
  // events are installed, converge the entry band again so the route can advance to its return output.
  if (group.compilerRoute && group.blockLayout && group.blockInputs
    && group.eventOutputs?.some((output) => output !== undefined)) {
    const learnedEntries = new Set<number>();
    const entrySlotCount = group.blockLayout.slots.filter((slot) => slot.kind === 'entry').length;
    for (let pass = 0; pass <= entrySlotCount; pass++) {
      const entryProbe = stb.build();
      const entryTrace = evaluateProbeTrace(host.inner.provider, {
        inputIndex: bMasterIdx,
        sourceOutputs: generateLibauthSourceOutputs(entryProbe.inputs),
        transaction: entryProbe.buildLibauthTransaction(),
      });
      const revealed = extractCommitmentMapFromTrace(entryTrace, {
        min: bOutputBase,
        max: bOutputBase + group.blockInputs.length,
      }, true);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
        const transferFromInvokeWindows = entryTrace.flatMap((state, traceIndex) => {
          if (state.instructions[state.ip]?.opcode !== Op.OP_INVOKE
            || binToHex(state.stack.at(-1) ?? new Uint8Array()) !== '0d') return [];
          const returnIndex = entryTrace.findIndex((candidate, candidateIndex) =>
            candidateIndex > traceIndex
            && candidate.instructions.length === state.instructions.length
            && candidate.ip === state.ip + 1);
          const end = returnIndex < 0 ? Math.min(entryTrace.length, traceIndex + 8) : returnIndex + 48;
          return [{
            traceIndex,
            returnIndex,
            states: entryTrace.slice(Math.max(0, traceIndex - 4), end).map((candidate, candidateIndex) => ({
              traceIndex: Math.max(0, traceIndex - 4) + candidateIndex,
              ip: candidate.ip,
              count: candidate.instructions.length,
              op: candidate.instructions[candidate.ip]?.opcode,
              stack: candidate.stack.slice(-32).map((item) => {
                const hex = binToHex(item);
                return `${item.length}:${hex.slice(0, 64)}`;
              }),
            })),
          }];
        });
        console.error('post-event-route-entries', {
          groupIdx,
          pass,
          revealed: [...revealed.entries()],
          learned: [...learnedEntries],
          error: entryTrace.at(-1)?.error,
          tail: entryTrace.slice(-10).map((state) => ({
            ip: state.ip,
            count: state.instructions.length,
            op: state.instructions[state.ip]?.opcode,
            error: state.error,
            stack: state.stack.slice(-16).map((item) => {
              const hex = binToHex(item);
              return `${item.length}:${hex.slice(0, 64)}`;
            }),
          })),
          handlerTail: entryTrace.filter((state) => state.instructions.length >= 330
            && state.instructions.length <= 360
            && state.ip >= 300)
            .slice(-100).map((state) => ({
              ip: state.ip,
              op: state.instructions[state.ip]?.opcode,
              stack: state.stack.slice(-24).map((item) => {
                const hex = binToHex(item);
                return `${item.length}:${hex.slice(0, 64)}`;
              }),
            })),
          transferFromInvokeWindows,
          transferFromCallerTail: entryTrace.filter((state) =>
            state.instructions.length === 5117 && state.ip >= 1700 && state.ip <= 2100)
            .map((state) => ({
              ip: state.ip,
              op: state.instructions[state.ip]?.opcode,
              stack: state.stack.slice(-40).map((item) => {
                const hex = binToHex(item);
                return `${item.length}:${hex.slice(0, 64)}`;
              }),
            })),
        });
      }
      let progressed = false;
      for (const [outputIndex, commitment] of revealed) {
        const blockSlot = outputIndex - bOutputBase;
        const slot = group.blockLayout.slots[blockSlot];
        if (learnedEntries.has(blockSlot)) continue;
        if (slot?.kind === 'dataNft' && slot.nftIndex !== undefined) {
          // A failing progressive probe can expose an intermediate
          // stack item at a later output index before the complete
          // data-NFT commitment has been constructed. Only converge a
          // data slot once it decodes against that participant's state
          // layout; entry outputs discovered by the same probe remain
          // useful and can unlock the complete commitment next pass.
          let state: Record<string, StateValueType>;
          try {
            state = commitmentsToState(
              [commitment], group.stateLayout, [slot.nftIndex],
            );
          } catch {
            continue;
          }
          for (const [name, value] of Object.entries(state)) {
            stb.setExternalCallState(group.categoryId, name, value);
          }
          learnedEntries.add(blockSlot);
          progressed = true;
          continue;
        }
        if (slot?.kind !== 'entry') continue;
        learnedEntries.add(blockSlot);
        stb.setExternalCallEntryOutput(group.categoryId, blockSlot, commitment);
        progressed = true;
      }
      if (!progressed) break;
    }
  }

  // Conditional event verification can precede return verification.
  // Re-probe after installing the reached event so the VM can expose
  // the return commitment in the same fixed participant block.
  if (ec.hasReturnValues && group.eventOutputs?.some((output) => output !== undefined)
    && (group.fusedReturnGroupIndex !== undefined || !group.precomputedReturnCommitment)) {
    const returnProbe = stb.build();
    const returnProgram = {
      inputIndex: bMasterIdx,
      sourceOutputs: generateLibauthSourceOutputs(returnProbe.inputs),
      transaction: returnProbe.buildLibauthTransaction(),
    };
    // Most routed returns expose the final OUTPUTTOKENCOMMITMENT/EQUALVERIFY pair directly. Use the
    // sparse observer first, then the faithful recorder as a compatibility fallback for return
    // construction that can only be recovered from an intermediate stack state.
    let returnTrace = evaluateProbeTrace(host.inner.provider, returnProgram);
    const returnOutputIndex = group.returnOutputIndex
      ?? stb.getExternalCallReturnEventOutputIndex(groupIdx);
    let returnCommitments = extractCommitmentsFromTrace(
      returnTrace, 1, { min: returnOutputIndex, max: returnOutputIndex + 1 }, true,
    );
    const routeReturnTypes = (group.compilerRoute?.rowArguments ?? []).flatMap(
      (row) => row.handler.outputs?.map((output) => output.type) ?? [],
    );
    const routeReturnPushes = routeReturnTypes.length || 1;
    let aggregatePending = routeReturnPushes > 1
      ? extractPendingReturnCommitment(returnTrace, routeReturnPushes, routeReturnTypes) : undefined;
    if (!returnCommitments?.length && !aggregatePending) {
      returnTrace = evaluateFaithfulOrDebugTrace(host.inner.provider, returnProgram);
      returnCommitments = extractCommitmentsFromTrace(
        returnTrace, 1, { min: returnOutputIndex, max: returnOutputIndex + 1 }, true,
      );
      aggregatePending = routeReturnPushes > 1
        ? extractPendingReturnCommitment(returnTrace, routeReturnPushes, routeReturnTypes) : undefined;
    }
    if (!returnCommitments?.length && aggregatePending) returnCommitments = [aggregatePending];
    else if (!returnCommitments?.length) {
      const pending = extractPendingReturnCommitment(returnTrace, routeReturnPushes, routeReturnTypes);
      if (pending) returnCommitments = [pending];
    }
    if (['SOLIDC_DEBUG_ROUTE', 'SOLIDC_DEBUG_RETURN'].some((name) =>
      (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[name] === '1')) {
      console.error('route-return-after-events', {
        groupIdx, returnOutputIndex, returnCommitments,
        traceError: returnTrace.at(-1)?.error,
        traceTail: returnTrace.slice(-15).map((state) => ({
          ip: state.ip, instructionCount: state.instructions.length,
          opcode: state.instructions[state.ip]?.opcode,
          error: state.error, stack: state.stack.slice(-4).map(binToHex),
        })),
      });
    }
    if (returnCommitments?.length) {
      const returnGroupIndex = logicalReturnGroupIndex(externalCallUtxoGroups, groupIdx);
      const commitment = hexToBin(returnCommitments[0]);
      stb.setReturnEventOutput(
        group.categoryId, commitment, `external-call:${returnGroupIndex}`, false, returnTrace,
      );
      if (returnGroupIndex !== groupIdx) {
        stb.setReturnEventOutput(
          group.categoryId, commitment, `external-call:${groupIdx}`, false, returnTrace,
        );
      }
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
      console.error('progressive-route-return', {
        groupIdx, returnOutputIndex, returnCommitments, error: returnTrace.at(-1)?.error,
        tail: returnTrace.slice(-24).map((state) => ({
          ip: state.ip,
          count: state.instructions.length,
          op: state.instructions[state.ip]?.opcode,
          error: state.error,
          stack: state.stack.slice(-24).map((item) => {
            const hex = binToHex(item);
            return `${item.length}:${hex.slice(0, 64)}`;
          }),
        })),
      });
    }
  }

}
