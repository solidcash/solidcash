/**
 * phase-boundary extract: Compose phase-boundary extract — event locking helpers + fee-tail rebalance.
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  buildAnonymousEventNftCovenantScript,
  buildEventNftCovenantScript,
  computeEventNameHash,
  type Artifact,
} from '@solidcash/utils';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { StatefulContract } from '../stateful/StatefulContract.js';
import { tryParseEventCommitment } from '../stateful/StateReader.js';
import { scriptToLockingBytecode } from '../utils.js';
import { findMessageBusHandlerForInvocation } from './graph-handler-join.js';
import { deriveCompiledGraphPlan } from './worklist.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;
type PlanParticipant = CompiledGraphPlan['participants'][number];

export interface ComposeEventHelpersContext {
  feeRate?: number;
  plan: CompiledGraphPlan;
  byLockingBytecode: Map<string, StatefulContract>;
  categories: readonly string[];
}

export function rebalanceFeeTail(
  ctx: Pick<ComposeEventHelpersContext, 'feeRate'>,
  builder: TransactionBuilder,
  subject: string,
): void {
  const tail = builder.outputs.length - 1;
  const totalInput = builder.inputs.reduce((sum, input) => sum + input.satoshis, 0n);
  const fixedOutput = builder.outputs.slice(0, tail).reduce((sum, output) => sum + output.amount, 0n);
  const fee = BigInt(Math.ceil((ctx.feeRate ?? 1) * Number(builder.getTransactionSize())));
  const amount = totalInput - fixedOutput - fee;
  if (amount <= 0n) throw new Error(`messageBus: fee funder cannot cover ${subject}`);
  builder.outputs[tail] = { ...builder.outputs[tail], amount };
}

export function eventCandidates(
  ctx: ComposeEventHelpersContext,
  participant: PlanParticipant,
): Array<{ event: NonNullable<Artifact['events']>[number]; lockingBytecode: string }> {
  const contract = ctx.byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
  const category = hexToBin(ctx.categories[participant.participant]);
  return participant.invocations.flatMap((invocationIndex) => {
    const invocation = ctx.plan.invocations[invocationIndex];
    const handler = findMessageBusHandlerForInvocation(participant.artifact, invocation);
    const signatures = [
      ...(handler?.emits ?? []).map((emitted) => emitted.eventSignature),
      ...(handler?.runtimeLoopEvents ?? []).flatMap((loop) => loop.eventSignatures),
    ];
    return [...new Set(signatures)].flatMap((eventSignature) => {
      const event = participant.artifact.events?.find((candidate) =>
        candidate.signature === eventSignature);
      if (!event) return [];
      const script = event?.anonymous
        ? buildAnonymousEventNftCovenantScript(category)
        : buildEventNftCovenantScript(category, computeEventNameHash(eventSignature));
      return [{ event, lockingBytecode: binToHex(scriptToLockingBytecode(script, contract.inner.addressType)) }];
    });
  });
}

export function eventLockingBytecodes(
  ctx: ComposeEventHelpersContext,
  participant: PlanParticipant,
): string[] {
  return eventCandidates(ctx, participant).map((candidate) => candidate.lockingBytecode);
}

export function eventLockingBytecodeAtOffset(
  ctx: ComposeEventHelpersContext,
  participant: PlanParticipant,
  offset: number,
): string | undefined {
  const frame = participant.artifact.messageBus?.route.graphEffectFrame;
  if (!frame || frame.eventWidth < 1) return undefined;
  const slot = participant.blockLayout!.slots.find((candidate) =>
    candidate.kind === 'event' && candidate.offset === offset && candidate.slotIndex !== undefined);
  if (slot?.slotIndex === undefined || slot.slotIndex < frame.eventBase) return undefined;
  const relative = slot.slotIndex - frame.eventBase;
  const localRow = Math.floor(relative / frame.eventWidth);
  const emitIndex = relative % frame.eventWidth;
  if (localRow >= frame.sites) return undefined;
  const invocationIndex = participant.invocations[localRow];
  const invocation = invocationIndex === undefined ? undefined : ctx.plan.invocations[invocationIndex];
  const handler = invocation === undefined
    ? undefined
    : findMessageBusHandlerForInvocation(participant.artifact, invocation);
  const signature = handler?.emits?.find((emitted) => emitted.emitIndex === emitIndex)?.eventSignature;
  const event = participant.artifact.events?.find((candidate) => candidate.signature === signature);
  if (!event) return undefined;
  const category = hexToBin(ctx.categories[participant.participant]);
  const script = event.anonymous
    ? buildAnonymousEventNftCovenantScript(category)
    : buildEventNftCovenantScript(category, computeEventNameHash(event.signature));
  const contract = ctx.byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
  return binToHex(scriptToLockingBytecode(script, contract.inner.addressType));
}

export function eventLockingBytecodeForCommitment(
  ctx: ComposeEventHelpersContext,
  participant: PlanParticipant,
  commitment: string,
): string | undefined {
  const matching = eventCandidates(ctx, participant).filter(({ event }) =>
    tryParseEventCommitment(commitment, event, participant.artifact.stateLayout?.structs) !== null);
  const locks = [...new Set(matching.map((candidate) => candidate.lockingBytecode))];
  return locks.length === 1 ? locks[0] : undefined;
}

