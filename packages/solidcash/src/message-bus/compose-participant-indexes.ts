/**
 * Compose phase-boundary extract: participant contract indexes,
 * categories, identities, and provisional results.
 */

import { binToHex } from '@bitauth/libauth';
import type NetworkProvider from '../network/NetworkProvider.js';
import { addressToLockScript } from '../utils.js';
import type { StatefulContract } from '../stateful/StatefulContract.js';
import {
  resolveLogicalIdentity, type ResolvedLogicalIdentity,
} from '../stateful/logical-identity.js';
import {
  preparedInvocationResult,
  provisionalInvocationResult,
} from './compose-recipes.js';
import { hasTransientConvergenceResultSeed, type CallDescriptor } from './compose-prepared-invocation.js';
import { deriveCompiledGraphPlan } from './worklist.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;

export interface ComposeParticipantIndexes {
  byLockingBytecode: Map<string, StatefulContract>;
  descriptorByLockingBytecode: Map<string, CallDescriptor>;
  categories: string[];
  logicalIdentities: Map<number, ResolvedLogicalIdentity>;
  returning: CompiledGraphPlan['invocations'];
  preparedResults: Record<number, string>;
  provisionalResults: Record<number, string>;
}

/**
 * Index prepared descriptors by locking bytecode, resolve master categories + identity anchors, and
 * seed provisional/prepared return commitments for result-dependent argument propagation.
 */
export async function resolveComposeParticipantIndexes(
  plan: CompiledGraphPlan,
  descriptors: readonly CallDescriptor[],
  provider: NetworkProvider,
): Promise<ComposeParticipantIndexes> {
  const byLockingBytecode = new Map<string, StatefulContract>();
  const descriptorByLockingBytecode = new Map<string, CallDescriptor>();
  for (const descriptor of descriptors) {
    const lockingBytecode = descriptor.contract.inner.lockingBytecode.toLowerCase();
    byLockingBytecode.set(lockingBytecode, descriptor.contract);
    descriptorByLockingBytecode.set(lockingBytecode, descriptor);
  }
  const categories = plan.participants.map((participant) => {
    const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase());
    if (!contract?.categoryId) throw new Error('messageBus: every participant must have a resolved master category');
    return contract.categoryId;
  });
  // Diagnostic (`SOLIDC_DEBUG_PARTICIPANT_CATEGORIES=1`): the master category of every participant, in plan
  // order. A covenant that embeds the wrong category is only diagnosable against this list.
  if ((globalThis as { process?: { env?: Record<string, string> } }).process
    ?.env?.SOLIDC_DEBUG_PARTICIPANT_CATEGORIES === '1') {
    console.error('participant-categories', plan.participants.map((participant, index) => ({
      participant: participant.participant,
      executionKind: participant.executionKind,
      category: categories[index],
      locking: participant.lockingBytecode.slice(0, 16),
    })));
  }
  // Public CREATE/proxy identities are authenticated by immutable SCID anchors. Resolve each required anchor
  // once per fixed-point assembly pass and supply it explicitly to the local builder: address(this) still comes
  // from the active covenant input, while an ordinary nested msg.sender can select this stable public identity.
  const logicalIdentities = new Map<number, ResolvedLogicalIdentity>();
  await Promise.all(plan.participants.map(async (participant) => {
    if (!participant.blockLayout?.slots.some((slot) => slot.kind === 'identityAnchor')) return;
    const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
    const identity = await resolveLogicalIdentity(provider, contract._logicalAddress ?? contract.target);
    const expected = participant.logicalLockingBytecode?.toLowerCase();
    const actual = binToHex(addressToLockScript(identity.logicalAddress)).toLowerCase();
    if (!expected || actual !== expected) {
      throw new Error('messageBus: resolved logical call target disagrees with its participant identity');
    }
    logicalIdentities.set(participant.participant, identity);
  }));
  const returning = plan.invocations.filter((invocation) => invocation.resultTypes.length > 0);
  const seededResults = Object.fromEntries(returning.flatMap((invocation) => {
    const artifact = plan.participants[invocation.callee].artifact;
    const seeded = preparedInvocationResult(
      descriptors[invocation.index]?.provisionalResultCommitment,
      artifact,
      invocation.resultTypes,
      invocation.resultEncoding,
    );
    return seeded === undefined ? [] : [[invocation.index, seeded] as const];
  }));
  // Values learned in an earlier provisional graph pass help convergence, but they are not caller-prepared
  // commitments. Retain their shape-checked bytes as seeds without making them immutable expected results;
  // the complete producer VM and final preflight remain authoritative.
  const preparedResults = Object.fromEntries(returning.flatMap((invocation) => {
    const descriptor = descriptors[invocation.index];
    return descriptor && !hasTransientConvergenceResultSeed(descriptor)
      && seededResults[invocation.index] !== undefined
      ? [[invocation.index, seededResults[invocation.index]] as const] : [];
  }));
  const provisionalResults = Object.fromEntries(returning.map((invocation) => {
    const artifact = plan.participants[invocation.callee].artifact;
    return [invocation.index, seededResults[invocation.index]
      ?? provisionalInvocationResult(artifact, invocation.resultTypes, invocation.resultEncoding)];
  }));
  return {
    byLockingBytecode,
    descriptorByLockingBytecode,
    categories,
    logicalIdentities,
    returning,
    preparedResults,
    provisionalResults,
  };
}
