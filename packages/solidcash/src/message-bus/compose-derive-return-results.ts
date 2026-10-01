/**
 * phase-boundary extract: Compose phase-boundary extract — derive return-result hex vectors from a provisional aggregate.
 */

import { binToHex } from '@bitauth/libauth';
import { decodePushdataValue } from '@solidcash/utils';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { StatefulContract } from '../stateful/StatefulContract.js';
import {
  finalizeAtomicInvocationGraph,
} from './graph.js';
import {
  canonicalNativeResultField,
  concatBytes,
  evmInvocationResultLength,
} from './compose-recipes.js';
import { deriveCompiledGraphPlan } from './worklist.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;

export interface DeriveReturnResultsContext {
  plan: CompiledGraphPlan;
  byLockingBytecode: Map<string, StatefulContract>;
  preparedResults: Readonly<Record<number, string>>;
  participantReturnBlob: (
    participant: number, results: Readonly<Record<number, string>>,
  ) => Uint8Array | undefined;
  participantReturnCommitment: (blob: Uint8Array | undefined) => Uint8Array | undefined;
  rebalanceFeeTail: (builder: TransactionBuilder, subject: string) => void;
}

export function deriveReturnResults(
  ctx: DeriveReturnResultsContext,
  graph: ReturnType<typeof finalizeAtomicInvocationGraph>,
  provisional: TransactionBuilder,
  priorResults: Readonly<Record<number, string>>,
  missingParticipants: Set<number>,
): Record<number, string> {
  const derivedResults: Record<number, string> = { ...priorResults };
  let normalizedNativeReturnOutput = false;
  // Every participant probe observes the same immutable provisional transaction. Materialize its unlocking
  // bytecode and source-output vector once per derivation pass; rebuilding both for each participant is
  // quadratic in large atomic graphs and cannot change the observed program.
  const probeProgram = provisional.buildLibauthProgram();
  for (const participant of ctx.plan.participants) {
    const owned = participant.invocations.filter(
      (invocation) => ctx.plan.invocations[invocation].resultTypes.length > 0,
    );
    if (owned.length === 0) continue;
    const returnSlot = participant.blockLayout!.slots.find((slot) => slot.kind === 'returnEvent');
    if (!returnSlot) throw new Error(`messageBus: returning participant ${participant.participant} has no return slot`);
    const contract = ctx.byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
    const participantBase = graph.layout.participantInputs[participant.participant];
    // A proxy master only pins and invokes its co-spent implementation. The implementation input executes
    // the message-bus route and publishes the return commitment, so probe that input for delegate owners.
    const executionInput = participant.executionKind === 1 && participant.executorOffset !== null
      ? participantBase + participant.executorOffset
      : participantBase;
    const blob = contract._messageBusReturnBlobFromTransaction(
      provisional, participantBase + returnSlot.offset, executionInput, probeProgram,
      {
        resultTypes: owned.flatMap((invocation) => ctx.plan.invocations[invocation].resultTypes),
        resultTypeGroups: owned.map((invocation) => ctx.plan.invocations[invocation].resultTypes),
        resultEncodings: owned.map((invocation) => ctx.plan.invocations[invocation].resultEncoding!),
      },
    );
    if (!blob) {
      // Progressive probes can stop at an earlier resource/layout claim before the producer reaches its
      // return-output comparison. Keep the exact schema-shaped vector already assembled from this pass's
      // prior claims as a convergence seed. It is not trusted: `admit` executes every ordinary covenant, so
      // a wrong seed either exposes a different return on a later pass or fails final BCH VM preflight.
      const priorBlob = ctx.participantReturnBlob(participant.participant, priorResults);
      const materialized = provisional.outputs[participantBase + returnSlot.offset]
        ?.token?.nft?.commitment?.toLowerCase();
      const priorCommitment = ctx.participantReturnCommitment(priorBlob);
      if (!priorCommitment || materialized !== binToHex(priorCommitment)) {
        missingParticipants.add(participant.participant);
      }
      continue;
    }
    if (blob.length === 0
        && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_RETURN_VECTOR === '1') {
      const output = provisional.outputs[participantBase + returnSlot.offset];
      console.error('atomic-empty-return-blob', JSON.stringify({
        participant: participant.participant,
        contract: participant.artifact.contractName,
        executionInput,
        returnOutput: participantBase + returnSlot.offset,
        outputCommitment: output?.token?.nft?.commitment,
        claimedResults: owned.map((invocation) => [invocation, priorResults[invocation]]),
      }));
    }
    const outer = decodePushdataValue(blob, 0, 'bytes');
    if (!(outer.value instanceof Uint8Array) || outer.bytesConsumed !== blob.length) {
      throw new Error(`messageBus: participant ${participant.participant} exposed a non-canonical return vector`);
    }
    if (outer.value.length === 0
        && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_RETURN_VECTOR === '1') {
      const output = provisional.outputs[participantBase + returnSlot.offset];
      console.error('atomic-empty-return-vector', JSON.stringify({
        participant: participant.participant,
        contract: participant.artifact.contractName,
        blob: binToHex(blob),
        outputCommitment: output?.token?.nft?.commitment,
        owned: owned.map((invocation) => ({
          invocation,
          resultTypes: ctx.plan.invocations[invocation].resultTypes,
          claimed: priorResults[invocation],
        })),
      }));
    }
    let cursor = 0;
    for (const invocationIndex of owned) {
      const invocation = ctx.plan.invocations[invocationIndex];
      const start = cursor;
      if (invocation.resultEncoding === 'evm-abi-v1') {
        cursor += evmInvocationResultLength(
          outer.value, cursor, invocation.resultTypes, participant.artifact,
        );
      } else {
        const canonicalFields: Uint8Array[] = [];
        for (const type of invocation.resultTypes) {
          const decoded = canonicalNativeResultField(
            outer.value, cursor, type, participant.artifact.structs,
          );
          cursor += decoded.bytesConsumed;
          canonicalFields.push(decoded.encoded);
        }
        derivedResults[invocationIndex] = binToHex(concatBytes(canonicalFields));
      }
      if (invocation.resultEncoding === 'evm-abi-v1') {
        derivedResults[invocationIndex] = binToHex(outer.value.slice(start, cursor));
      }
      const prepared = ctx.preparedResults[invocationIndex];
      if (prepared !== undefined && prepared !== derivedResults[invocationIndex]) {
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_RETURN_VECTOR === '1') {
          console.error('atomic-return-mismatch', JSON.stringify({
            invocation: invocationIndex,
            function: invocation.function,
            participant: participant.participant,
            contract: participant.artifact.contractName,
            resultTypes: invocation.resultTypes,
            prepared,
            observed: derivedResults[invocationIndex],
            owned: owned.slice(0, 24).map((index) => ({
              index,
              function: ctx.plan.invocations[index].function,
              sourceCallsiteId: ctx.plan.invocations[index].sourceCallsiteId,
              occurrenceIndex: ctx.plan.invocations[index].occurrenceIndex,
              prepared: ctx.preparedResults[index],
              observed: derivedResults[index],
            })),
          }));
        }
        throw new Error(
          `messageBus: prepared return commitment for invocation ${invocationIndex} `
            + 'differs from the observed producer result',
        );
      }
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RETURN_VECTOR === '1') {
      console.error('atomic-return-vector', JSON.stringify({
        participant: participant.participant,
        contract: participant.artifact.contractName,
        blob: binToHex(blob),
        vector: binToHex(outer.value),
        results: owned.map((invocation) => ({
          invocation,
          types: ctx.plan.invocations[invocation].resultTypes,
          value: derivedResults[invocation],
        })),
      }));
    }
    if (cursor !== outer.value.length) {
      throw new Error(`messageBus: participant ${participant.participant} return vector has an unchecked suffix`);
    }
    if (owned.some((invocation) => ctx.plan.invocations[invocation].resultEncoding === 'compact-pushdata-v1')) {
      // The trace extractor can observe the provisional output before the route's completed result still live
      // above it. Re-materialize the output from the completely decoded, canonical field vector; final BCH VM
      // preflight remains the authority and rejects this claim if it differs from the producer's actual result.
      const canonicalBlob = ctx.participantReturnBlob(participant.participant, derivedResults);
      const canonicalCommitment = ctx.participantReturnCommitment(canonicalBlob);
      const outputIndex = participantBase + returnSlot.offset;
      const output = provisional.outputs[outputIndex];
      if (!canonicalCommitment || !output?.token?.nft) {
        throw new Error(`messageBus: participant ${participant.participant} lost its native return output`);
      }
      const commitmentHex = binToHex(canonicalCommitment);
      if (output.token.nft.commitment !== commitmentHex) {
        provisional.outputs[outputIndex] = {
          ...output,
          token: { ...output.token, nft: { ...output.token.nft, commitment: commitmentHex } },
        };
        normalizedNativeReturnOutput = true;
      }
    }
  }
  if (normalizedNativeReturnOutput) ctx.rebalanceFeeTail(provisional, 'canonicalized native return results');
  return derivedResults;
}
