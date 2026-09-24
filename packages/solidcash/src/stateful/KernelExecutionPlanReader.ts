/**
 * KernelExecutionPlan version gate: StatefulContract-facing KernelExecutionPlan readers.
 * Gates on published `kernelPlanVersion` and KernelExecutionPlan bytecode commitment bytecode commitment.
 */

import type { Artifact } from '@solidcash/utils';
import {
  assertReadableKernelExecutionPlans,
  type PublishedKernelExecutionPlan,
} from '../message-bus/kernel-execution-plan.js';

/**
 * Read published kernel execution plans from an artifact.
 * Fail-closed when the envelope is missing, `kernelPlanVersion` mismatches, or
 * a plan digest is not uniquely committed in route bytecode.
 */
export function readKernelExecutionPlans(
  artifact: Artifact,
): readonly PublishedKernelExecutionPlan[] {
  return assertReadableKernelExecutionPlans(artifact);
}

/** Convenience: require a specific handler's published plan digest. */
export function requireKernelExecutionPlanDigest(
  artifact: Artifact,
  handlerId: string,
): string {
  const plans = readKernelExecutionPlans(artifact);
  const match = plans.find((plan) => plan.handlerId === handlerId);
  if (match === undefined) {
    throw new Error(`kernel-plan: no published plan for handler '${handlerId}'`);
  }
  return match.digest;
}
