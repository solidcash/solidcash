/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 1
 * post-evaluate value-witness refresh + data-NFT apply.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import type { AbiFunction } from '@solidcash/utils';
import { sha256 as sha256Sync } from '@solidcash/utils';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../utils.js';
import {
  isCompleteCollectionValue,
  selectAuthenticatedPreValueWitness,
  storedChunkableValueRoots,
} from './authenticated-collection-value.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { evaluateProbeTrace } from './faithful-probe-trace.js';
import { entryAccessAt } from './route-expression-key.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { extractCommitmentsFromTrace } from './trace-commitment-helpers.js';
import { commitmentsToState } from './trace-verified-value-helpers.js';

export interface DeriveFullPhase1PostEvaluateHost {
  readonly inner: { provider: NetworkProvider };
}

export type DeriveFullPhase1PostEvaluateResult = {
  fullTrace: AuthenticationProgramStateCommon[];
  bOutputBase: number;
  skipGroup: boolean;
};

/**
 * After the Phase-1 probe evaluate: optionally learn a delegate valueWitness from the
 * trace, then extract/apply B's data-NFT commitments. Returns skipGroup when there is
 * nothing further to derive for this participant.
 */
export function deriveFullPhase1PostEvaluateDataCommitments(
  host: DeriveFullPhase1PostEvaluateHost,
  stb: StatefulTransactionBuilder,
  group: ExternalCallUtxoGroup,
  groupIdx: number,
  probeBuilder: TransactionBuilder,
  fullTraceIn: AuthenticationProgramStateCommon[],
  bMasterIdx: number,
  hasReturnValues: boolean | undefined,
): DeriveFullPhase1PostEvaluateResult {
  let fullTrace = fullTraceIn;
  if (group.delegateEmbeddedInBlock && group.delegateCallGroupIndex !== undefined) {
    const delegateGroup = stb.getLowLevelCallUtxoGroups()[group.delegateCallGroupIndex];
    const delegateFn = delegateGroup?.compilerRoute?.abiFunction
      ?? delegateGroup?.externalContract.inner.artifact.abi.find(
        (candidate: AbiFunction) => candidate.name === delegateGroup.functionName,
      );
    const witnessInputs = delegateFn?.inputs.filter((input: { name: string }) =>
      /^__internal__valueWitness_\d+$/.test(input.name)) ?? [];
    const witnessCollection = witnessInputs.length === 1
      ? entryAccessAt(delegateFn, Number(witnessInputs[0].name.match(/\d+$/)?.[0] ?? -1))?.collection
      : undefined;
    const witnessLayout = delegateGroup?.stateLayout
      ?? delegateGroup?.externalContract.inner.stateLayout;
    const witnessValueType = witnessLayout?.collections?.find((collection) =>
      collection.name === witnessCollection || collection.signature === witnessCollection)?.valueType;
    let learnedValue: Uint8Array | undefined;
    const storedRoots = storedChunkableValueRoots(
      delegateGroup?.blockInputs ?? group.blockInputs,
    );
    // A pre-value witness must be rooted in the authenticated proof-entry input.
    // With no stored root, trace roots may describe a derived prior/current-row result;
    // that value belongs in leading/post channels, never in valueWitness.
    for (let stateIndex = fullTrace.length - 1;
      storedRoots.size > 0 && stateIndex >= 0 && !learnedValue;
      stateIndex--) {
      const stack = fullTrace[stateIndex].stack;
      learnedValue = selectAuthenticatedPreValueWitness(
        stack, storedRoots, witnessValueType, witnessLayout?.structs,
      );
    }
    const currentWitness = witnessInputs.length === 1
      ? delegateGroup?.internalArgs?.[witnessInputs[0].name]
        ?? delegateGroup?.compilerRoute?.internalArgs?.[witnessInputs[0].name]
      : undefined;
    if (currentWitness instanceof Uint8Array && currentWitness.length > 60
      && isCompleteCollectionValue(currentWitness, witnessValueType, witnessLayout?.structs)) {
      learnedValue = undefined;
    } else if (currentWitness instanceof Uint8Array
      && storedRoots.has(binToHex(sha256Sync(currentWitness)))) {
      if (!learnedValue || !storedRoots.has(binToHex(sha256Sync(learnedValue)))) {
        learnedValue = currentWitness;
      }
    }
    if (learnedValue && witnessInputs.length === 1 && delegateGroup?.refreshInternalArgs) {
      delegateGroup.refreshInternalArgs({ [witnessInputs[0].name]: learnedValue });
      stb._refreshInputs();
      const witnessProbe = stb.build();
      fullTrace = evaluateProbeTrace(host.inner.provider, {
        inputIndex: bMasterIdx,
        sourceOutputs: generateLibauthSourceOutputs(witnessProbe.inputs),
        transaction: witnessProbe.buildLibauthTransaction(),
      });
    }
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
    console.error('route-derive-finish', {
      groupIdx, states: fullTrace.length, error: fullTrace.at(-1)?.error,
      tail: fullTrace.slice(-3).map((state) => ({
        ip: state.ip,
        count: state.instructions.length,
        opcode: state.instructions[state.ip]?.opcode,
        nearby: state.instructions.slice(Math.max(0, state.ip - 16), state.ip + 8)
          .map((instruction, offset) => ({
            ip: Math.max(0, state.ip - 16) + offset,
            opcode: instruction.opcode,
            data: 'data' in instruction && instruction.data
              ? binToHex(instruction.data).slice(0, 64)
              : undefined,
          })),
        stack: state.stack.slice(-16).map((item) => `${item.length}:${binToHex(item).slice(0, 32)}`),
      })),
    });
  }

  // B verifies its data NFT commitments; the return event is extracted separately below.
  const bRequiredNftCount = group.requiredDataNftIndices.length;

  // Filter by output index range: B's data NFTs start after B's master output. Best-effort: the
  // probe trace may abort at the return-event check before B reaches the data NFT preservation, so
  // this can legitimately come back empty - that must NOT skip the return-event extraction below.
  const expectedMasterLockingBytecode = (group.masterUtxo as UnlockableUtxo)
    .unlocker.generateLockingBytecode();
  const builtOutputBase = probeBuilder.outputs.findIndex((output) => {
    const lockingBytecode = typeof output.to === 'string'
      ? addressToLockScript(output.to) : output.to;
    return output.token?.category === group.categoryId
      && output.token?.nft?.capability === 'minting'
      && lockingBytecode.length === expectedMasterLockingBytecode.length
      && lockingBytecode.every((byte, index) => byte === expectedMasterLockingBytecode[index]);
  });
  // The concrete probe is authoritative: output-only caller slots and sorted INSERT expansion can shift
  // participant bands in ways the pre-build dense-coordinate helper cannot reconstruct. Compiler-routed
  // proxies deliberately emit a spacer in their nominal master slot, so retain the helper as their fallback.
  const bOutputBase = builtOutputBase >= 0
    ? builtOutputBase : stb.getExternalCallOutputBase(groupIdx);
  const bDataOutputRange = { min: bOutputBase + 1, max: bOutputBase + 1 + bRequiredNftCount };
  const commitments = bRequiredNftCount > 0
    ? extractCommitmentsFromTrace(fullTrace, bRequiredNftCount, bDataOutputRange)
    : undefined;
  if (!commitments && bRequiredNftCount > 0 && !hasReturnValues
    && !group.blockLayout?.slots.some((slot) => slot.kind === 'entry')) {
    return { fullTrace, bOutputBase, skipGroup: true };
  }

  // B's data NFT commitments
  if (commitments && commitments.length > 0) {
    const bCommitments = commitments.slice(0, bRequiredNftCount);
    const bState = commitmentsToState(bCommitments, group.stateLayout, group.requiredDataNftIndices);
    for (const [name, value] of Object.entries(bState)) {
      stb.setExternalCallState(group.categoryId, name, value);
    }
    // A callee with more than one data NFT authenticates its records one at a time: the probe reaches a record's
    // check only when every earlier record already carries its derived value in the probe's outputs, so a single
    // pass learns the first record and stops at the second. Re-probe after each round until every required record
    // is known or a round learns nothing (D49, a bigint or unbounded field per data NFT).
    let known = bCommitments;
    let currentTrace = fullTrace;
    for (let round = 1; round < bRequiredNftCount && known.length < bRequiredNftCount; round += 1) {
      stb._refreshInputs();
      const nextProbe = stb.build();
      const nextTrace = evaluateProbeTrace(host.inner.provider, {
        inputIndex: bMasterIdx,
        sourceOutputs: generateLibauthSourceOutputs(nextProbe.inputs),
        transaction: nextProbe.buildLibauthTransaction(),
      });
      const next = extractCommitmentsFromTrace(nextTrace, bRequiredNftCount, bDataOutputRange);
      if (!next || next.length <= known.length) {
        currentTrace = nextTrace;
        break;
      }
      const newlyKnown = next.slice(0, bRequiredNftCount);
      const nextState = commitmentsToState(newlyKnown, group.stateLayout, group.requiredDataNftIndices);
      for (const [name, value] of Object.entries(nextState)) {
        stb.setExternalCallState(group.categoryId, name, value);
      }
      known = newlyKnown;
      currentTrace = nextTrace;
    }
    return { fullTrace: currentTrace, bOutputBase, skipGroup: false };
  }

  return { fullTrace, bOutputBase, skipGroup: false };
}
