/**
 * Shared KernelExecutionPlan create/digest (KernelExecutionPlan create/digest; KernelExecutionPlan bytecode commitment).
 * solidc stamps at compile; solidcash stamps at compose/SDK; both share this canonical digest.
 */

import { sha256 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';

export const KERNEL_PLAN_VERSION = 1 as const;

export type KernelPlanFeatureBits = {
  ownerAltAnchor?: boolean;
  handlerBandModel?: boolean;
  multiContinuation?: boolean;
  resourceFold?: boolean;
};

export type KernelResourceBudget = {
  maximumRows?: number;
  maximumParticipants?: number;
  maximumBlobBytes?: number;
  maximumJournalRecords?: number;
  maximumDynamicChunks?: number;
  maximumValueContinuationChunks?: number;
  maximumEvents?: number;
  maximumTransfers?: number;
  maximumReturnCarriers?: number;
  maximumExternalEdges?: number;
  maximumExternalDepth?: number;
  maximumStackDepth?: number;
  maximumAltStackDepth?: number;
  maximumOperationCost?: number;
  maximumTransactionBytes?: number;
};

export type KernelExecutionPlan = {
  kernelPlanVersion: typeof KERNEL_PLAN_VERSION;
  /** Stable handler id (not name). */
  handlerId: string;
  /** Diagnostic only. */
  handlerName?: string;
  selectedResources?: readonly string[];
  symbolicBands?: readonly { kind: string; localBase: number; capacity: number }[];
  ownershipClaimCount?: number;
  journalDispositionDigest?: string;
  dynamicReads?: readonly string[];
  dynamicWrites?: readonly string[];
  /** Explicit empty vs omitted: always present on kernel plans. */
  dynamicWritesPublished: true;
  effectLanes?: readonly string[];
  resultLanes?: readonly string[];
  requiredFeatureBits?: KernelPlanFeatureBits;
  minimumSdkReaderVersion?: number;
  budgets?: KernelResourceBudget;
};

function assertKernelBudgetNumbers(
  values: Partial<KernelResourceBudget> | undefined,
  source: 'published budget' | 'budget usage',
): void {
  if (values === undefined) return;
  if (values === null || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error(`kernel-plan: ${source} must be an object`);
  }
  for (const [axis, value] of Object.entries(values)) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      throw new Error(`kernel-plan: ${source} ${axis} must be a non-negative safe integer`);
    }
  }
}

export function createKernelExecutionPlan(
  partial: Omit<KernelExecutionPlan, 'kernelPlanVersion' | 'dynamicWritesPublished'> & {
    dynamicWrites?: readonly string[];
  },
): KernelExecutionPlan {
  return {
    kernelPlanVersion: KERNEL_PLAN_VERSION,
    handlerId: partial.handlerId,
    handlerName: partial.handlerName,
    selectedResources: partial.selectedResources,
    symbolicBands: partial.symbolicBands,
    ownershipClaimCount: partial.ownershipClaimCount,
    journalDispositionDigest: partial.journalDispositionDigest,
    dynamicReads: partial.dynamicReads ?? [],
    dynamicWrites: partial.dynamicWrites ?? [],
    dynamicWritesPublished: true,
    effectLanes: partial.effectLanes,
    resultLanes: partial.resultLanes,
    requiredFeatureBits: partial.requiredFeatureBits,
    minimumSdkReaderVersion: partial.minimumSdkReaderVersion ?? 1,
    budgets: partial.budgets,
  };
}

/** Canonical digest of every execution-affecting descriptor. */
export function digestKernelExecutionPlan(plan: KernelExecutionPlan): string {
  assertKernelBudgetNumbers(plan.budgets, 'published budget');
  const canonical = {
    kernelPlanVersion: plan.kernelPlanVersion,
    handlerId: plan.handlerId,
    selectedResources: plan.selectedResources ?? [],
    symbolicBands: plan.symbolicBands ?? [],
    ownershipClaimCount: plan.ownershipClaimCount ?? 0,
    journalDispositionDigest: plan.journalDispositionDigest ?? '',
    dynamicReads: [...(plan.dynamicReads ?? [])].sort(),
    dynamicWrites: [...(plan.dynamicWrites ?? [])].sort(),
    dynamicWritesPublished: plan.dynamicWritesPublished,
    effectLanes: plan.effectLanes ?? [],
    resultLanes: plan.resultLanes ?? [],
    requiredFeatureBits: plan.requiredFeatureBits ?? {},
    minimumSdkReaderVersion: plan.minimumSdkReaderVersion ?? 1,
    budgets: plan.budgets ?? {},
  };
  return binToHex(sha256.hash(new TextEncoder().encode(JSON.stringify(canonical))));
}

/**
 * Kernel artifacts must publish required metadata; missing fields fail closed.
 * Legacy adapters may still see omitted vectors as undefined outside this plan object.
 */
export function assertKernelPlanComplete(plan: KernelExecutionPlan): void {
  if (plan.kernelPlanVersion !== KERNEL_PLAN_VERSION) {
    throw new Error(`kernel-plan: unsupported version ${String(plan.kernelPlanVersion)}`);
  }
  if (!plan.handlerId) {
    throw new Error('kernel-plan: handlerId required');
  }
  if (plan.dynamicWritesPublished !== true) {
    throw new Error('kernel-plan: dynamicWrites must be explicitly published (empty array allowed)');
  }
  if (plan.dynamicWrites === undefined) {
    throw new Error('kernel-plan: dynamicWrites missing (use [] for empty)');
  }
  assertKernelBudgetNumbers(plan.budgets, 'published budget');
}

/** Reject envelopes that exceed published worst-case budgets before UTXO fetch. */
export function assertWithinKernelBudgets(
  plan: KernelExecutionPlan,
  usage: Partial<KernelResourceBudget>,
): void {
  assertKernelBudgetNumbers(plan.budgets, 'published budget');
  assertKernelBudgetNumbers(usage, 'budget usage');
  const budgets = plan.budgets ?? {};
  const checks: Array<[keyof KernelResourceBudget, number | undefined]> = [
    ['maximumRows', usage.maximumRows],
    ['maximumParticipants', usage.maximumParticipants],
    ['maximumBlobBytes', usage.maximumBlobBytes],
    ['maximumJournalRecords', usage.maximumJournalRecords],
    ['maximumDynamicChunks', usage.maximumDynamicChunks],
    ['maximumValueContinuationChunks', usage.maximumValueContinuationChunks],
    ['maximumEvents', usage.maximumEvents],
    ['maximumTransfers', usage.maximumTransfers],
    ['maximumReturnCarriers', usage.maximumReturnCarriers],
    ['maximumExternalEdges', usage.maximumExternalEdges],
    ['maximumExternalDepth', usage.maximumExternalDepth],
    ['maximumStackDepth', usage.maximumStackDepth],
    ['maximumAltStackDepth', usage.maximumAltStackDepth],
    ['maximumOperationCost', usage.maximumOperationCost],
    ['maximumTransactionBytes', usage.maximumTransactionBytes],
  ];
  for (const [key, used] of checks) {
    const limit = budgets[key];
    if (limit === undefined || used === undefined) continue;
    if (used > limit) {
      throw new Error(`kernel-plan: budget ${key} exceeded (used ${used} > ${limit})`);
    }
  }
}

export type PublishedKernelExecutionPlan = {
  handlerId: string;
  kernelPlanVersion: number;
  digest: string;
  handlerName?: string;
};
