/**
 * Versioned KernelExecutionPlan (backlog items 5–6, 12; KernelExecutionPlan bytecode commitment).
 *
 * Core create/digest live in `@solidcash/utils` so solidc can stamp at compile.
 * This module keeps Artifact bytecode stamp + reader gates.
 */

import type { Artifact } from '@solidcash/utils';
import {
  assertKernelPlanComplete,
  createKernelExecutionPlan,
  digestKernelExecutionPlan,
  embedKernelPlanDigestInBytecode,
  encodeKernelPlanDigestBytecode,
  hasUniqueKernelPlanDigestCommitment,
  KERNEL_PLAN_VERSION,
  type KernelExecutionPlan,
  type PublishedKernelExecutionPlan,
} from '@solidcash/utils';

export {
  KERNEL_PLAN_VERSION,
  createKernelExecutionPlan,
  digestKernelExecutionPlan,
  assertKernelPlanComplete,
  assertWithinKernelBudgets,
  type KernelExecutionPlan,
  type KernelPlanFeatureBits,
  type KernelResourceBudget,
  type PublishedKernelExecutionPlan,
} from '@solidcash/utils';

/** KernelExecutionPlan bytecode commitment: ASM bytecode fragment committing a plan digest (SCKP push/drop). */
export function encodeKernelExecutionPlanBytecodeCommitment(digest: string): string {
  return encodeKernelPlanDigestBytecode(digest);
}

/** KernelExecutionPlan bytecode commitment: whether route ASM uniquely commits this plan digest. */
export function assertKernelExecutionPlanBytecodeCommitment(
  bytecode: string,
  digest: string,
): void {
  if (!hasUniqueKernelPlanDigestCommitment(bytecode, digest)) {
    throw new Error(
      `kernel-plan: digest ${digest.slice(0, 16)}… is not uniquely committed by route bytecode`,
    );
  }
}

/**
 * KernelExecutionPlan bytecode commitment: stamp plan digest into artifact bytecode + messageBus.kernelExecutionPlans.
 * Transplanting the metadata field without the bytecode marker fails closed under
 * `assertReadableKernelExecutionPlans`.
 */
export function stampKernelExecutionPlanCommitment(
  artifact: Artifact,
  plan: KernelExecutionPlan,
): { digest: string; bytecodeCommitment: string } {
  assertKernelPlanComplete(plan);
  const digest = digestKernelExecutionPlan(plan);
  const bytecodeCommitment = encodeKernelPlanDigestBytecode(digest);
  artifact.bytecode = embedKernelPlanDigestInBytecode(artifact.bytecode ?? '', digest);
  const existing = artifact.messageBus?.kernelExecutionPlans?.plans ?? [];
  const nextPlans = [
    ...existing.filter((entry) => entry.handlerId !== plan.handlerId),
    {
      handlerId: plan.handlerId,
      kernelPlanVersion: plan.kernelPlanVersion,
      digest,
      ...(plan.handlerName !== undefined && { handlerName: plan.handlerName }),
    },
  ];
  if (artifact.messageBus === undefined) {
    throw new Error('kernel-plan: cannot stamp commitment without messageBus metadata');
  }
  artifact.messageBus.kernelExecutionPlans = {
    version: 1,
    plans: Object.freeze(nextPlans) as PublishedKernelExecutionPlan[],
  };
  assertKernelExecutionPlanBytecodeCommitment(artifact.bytecode, digest);
  return { digest, bytecodeCommitment };
}

/**
 * KernelExecutionPlan version gate: StatefulContract / SDK plan reader gate.
 * Refuses missing publication, unsupported kernelPlanVersion, and digests not committed in bytecode.
 */
export function assertReadableKernelExecutionPlans(
  artifact: Artifact,
): readonly PublishedKernelExecutionPlan[] {
  const published = artifact.messageBus?.kernelExecutionPlans;
  if (published === undefined) {
    throw new Error('kernel-plan: no published kernelExecutionPlans (reader gate)');
  }
  if (published.version !== 1) {
    throw new Error(
      `kernel-plan: unsupported kernelExecutionPlans envelope version ${String(published.version)}`,
    );
  }
  if (!Array.isArray(published.plans) || published.plans.length === 0) {
    throw new Error('kernel-plan: kernelExecutionPlans.plans must be a non-empty array');
  }
  for (const entry of published.plans) {
    if (entry.kernelPlanVersion !== KERNEL_PLAN_VERSION) {
      throw new Error(
        `kernel-plan: unsupported kernelPlanVersion ${String(entry.kernelPlanVersion)} `
          + `(expected ${KERNEL_PLAN_VERSION}) for handler ${entry.handlerId}`,
      );
    }
    if (!entry.handlerId || !/^[0-9a-f]{64}$/.test(entry.digest)) {
      throw new Error(`kernel-plan: malformed published plan for '${String(entry.handlerId)}'`);
    }
    assertKernelExecutionPlanBytecodeCommitment(artifact.bytecode ?? '', entry.digest);
  }
  return published.plans;
}

/** KernelExecutionPlan digest: stamp every eligible handler plan into bytecode at a known publication site. */
export function stampEligibleHandlerKernelExecutionPlans(artifact: Artifact): void {
  if (artifact.messageBus === undefined) return;
  const handlers = artifact.messageBus.handlers ?? [];
  for (const handler of handlers) {
    if (handler.eligible !== true) continue;
    const abi = artifact.abi.find((entry) => entry.name === handler.name);
    const handlerId = handler.selector
      ? `handler:${handler.selector}`
      : `handler:${handler.name}`;
    const plan = createKernelExecutionPlan({
      handlerId,
      handlerName: handler.name,
      dynamicWrites: abi?.dynamicWrites ?? [],
      dynamicReads: abi?.dynamicReads ?? [],
    });
    stampKernelExecutionPlanCommitment(artifact, plan);
  }
}
