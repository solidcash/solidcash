/**
 * phase-boundary extract: Compose phase-boundary extract — validate upgrade targets against plan handlers / V2 / signatures.
 */

import type { CallDescriptor } from './compose-prepared-invocation.js';
import { findMessageBusHandlerForInvocation } from './graph-handler-join.js';
import { deriveCompiledGraphPlan } from './worklist.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;

/**
 * Fail closed when upgrade targets, selected upgrade handlers, protocol V2 advertisement, or
 * transaction-signature policy disagree with the compiled plan.
 */
export function validateComposeUpgradeTargets(
  plan: CompiledGraphPlan,
  descriptors: readonly CallDescriptor[],
  upgradeOutputs: ReadonlyMap<string, string>,
): void {
  for (const [index, descriptor] of descriptors.entries()) {
    if (!descriptor.upgradeTarget) continue;
    const invocation = plan.invocations[index];
    const artifact = plan.participants[invocation.callee].artifact;
    const handler = findMessageBusHandlerForInvocation(artifact, invocation);
    if (handler?.lifecycle?.kind !== 'upgrade') {
      throw new Error('messageBus: a replacement target must be attached to its compiler-authored upgrade call');
    }
  }
  if (upgradeOutputs.size > 0) {
    const legacyParticipant = plan.participants.find((participant) =>
      !participant.artifact.messageBus?.atomicMessageBus?.protocolVersions?.includes(2));
    if (legacyParticipant) {
      throw new Error(
        `messageBus: participant '${legacyParticipant.artifact.contractName}' does not advertise atomic V2 support`,
      );
    }
  }
  for (const participant of plan.participants) {
    const owner = participant.lockingBytecode.toLowerCase();
    const selectedHandlers = participant.invocations.map((invocationIndex) => {
      const invocation = plan.invocations[invocationIndex];
      return findMessageBusHandlerForInvocation(participant.artifact, invocation);
    });
    const upgradeRows = selectedHandlers.flatMap((handler, index) =>
      handler?.lifecycle?.kind === 'upgrade' ? [index] : []);
    const hasTarget = upgradeOutputs.has(owner);
    if (upgradeRows.length === 0 && hasTarget) {
      throw new Error('messageBus: a replacement target requires a selected compiler-authored upgrade handler');
    }
    if (upgradeRows.length > 0 && !hasTarget) {
      throw new Error('messageBus: a selected upgrade handler requires exactly one replacement target');
    }
    if (upgradeRows.length > 1) {
      throw new Error('messageBus: an upgraded participant may select exactly one upgrade row');
    }
    if (upgradeRows.length === 1 && upgradeRows[0] !== selectedHandlers.length - 1) {
      throw new Error('messageBus: the participant upgrade row must be its final invocation');
    }
  }
  if (upgradeOutputs.size > 0) {
    const signedInvocation = plan.invocations.find((invocation) => {
      const artifact = plan.participants[invocation.callee].artifact;
      const handler = findMessageBusHandlerForInvocation(artifact, invocation);
      return handler?.usesTransactionSignature === true
        && handler.transactionSignaturePolicy?.hashType !== 'all';
    });
    if (signedInvocation) {
      throw new Error(
        `messageBus: upgrade graphs cannot include transaction-signature checks in '${signedInvocation.function}'`,
      );
    }
  }
}
