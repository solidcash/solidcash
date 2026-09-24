/**
 * hostile plan generator: hostile negative generators from positive kernel / layout plans.
 *
 * Each generator returns a mutated plan or layout input intended to be refused
 * by the shipped production authority (compose plan checks or layout resolver).
 */

import {
  createKernelExecutionPlan,
  type KernelExecutionPlan,
  type KernelResourceBudget,
} from './kernel-execution-plan.js';
import type {
  LayoutResolverInput,
  ResourceOwnershipClaim,
  SymbolicParticipantLayout,
} from './layout-resolver.js';

export type HostileKernelPlanCase = {
  id: string;
  description: string;
  plan: KernelExecutionPlan;
  usage: Partial<KernelResourceBudget>;
  /** Expected production refusal substring. */
  expectThrow: RegExp;
};

export type HostileLayoutCase = {
  id: string;
  description: string;
  input: LayoutResolverInput;
  expectThrow: RegExp;
};

/** Clone a positive plan into a mutable object. */
function clonePlan(plan: KernelExecutionPlan): KernelExecutionPlan {
  return {
    ...plan,
    dynamicReads: plan.dynamicReads ? [...plan.dynamicReads] : [],
    dynamicWrites: plan.dynamicWrites ? [...plan.dynamicWrites] : [],
    selectedResources: plan.selectedResources ? [...plan.selectedResources] : undefined,
    symbolicBands: plan.symbolicBands ? plan.symbolicBands.map((band) => ({ ...band })) : undefined,
    effectLanes: plan.effectLanes ? [...plan.effectLanes] : undefined,
    resultLanes: plan.resultLanes ? [...plan.resultLanes] : undefined,
    requiredFeatureBits: plan.requiredFeatureBits
      ? { ...plan.requiredFeatureBits } : undefined,
    budgets: plan.budgets ? { ...plan.budgets } : undefined,
  };
}

/**
 * Generate hostile KernelExecutionPlan variants from one positive plan.
 * Production `assertKernelPlanComplete` / `assertWithinKernelBudgets` must refuse each.
 */
export function generateHostileKernelPlans(
  positive: KernelExecutionPlan,
  usage: Partial<KernelResourceBudget> = { maximumRows: 1 },
): readonly HostileKernelPlanCase[] {
  const base = createKernelExecutionPlan({
    handlerId: positive.handlerId,
    handlerName: positive.handlerName,
    selectedResources: positive.selectedResources,
    dynamicWrites: positive.dynamicWrites ?? [],
    dynamicReads: positive.dynamicReads,
    budgets: positive.budgets ?? {
      maximumRows: 8,
      maximumParticipants: 32,
      maximumDynamicChunks: 256,
      maximumValueContinuationChunks: 256,
    },
  });

  const missingHandler = clonePlan(base);
  (missingHandler as { handlerId: string }).handlerId = '';

  const unpublishedWrites = clonePlan(base);
  (unpublishedWrites as { dynamicWritesPublished: boolean }).dynamicWritesPublished = false;

  const missingWrites = clonePlan(base);
  delete (missingWrites as { dynamicWrites?: readonly string[] }).dynamicWrites;

  const overBudgetUsage: Partial<KernelResourceBudget> = {
    ...usage,
    maximumRows: (base.budgets?.maximumRows ?? 8) + 5,
  };

  return [
    {
      id: 'drop-handlerId',
      description: 'empty handlerId fails completeness',
      plan: missingHandler,
      usage,
      expectThrow: /handlerId/,
    },
    {
      id: 'unpublish-dynamicWrites',
      description: 'dynamicWritesPublished=false fails completeness',
      plan: unpublishedWrites,
      usage,
      expectThrow: /dynamicWrites must be explicitly published/,
    },
    {
      id: 'omit-dynamicWrites',
      description: 'missing dynamicWrites array fails completeness',
      plan: missingWrites,
      usage,
      expectThrow: /dynamicWrites missing/,
    },
    {
      id: 'over-budget-rows',
      description: 'usage exceeding published maximumRows fails budget gate',
      plan: base,
      usage: overBudgetUsage,
      expectThrow: /maximumRows/,
    },
  ];
}

/**
 * Hostile layout inputs derived from a positive multi-participant packing.
 * Production `resolveTransactionLayout` must refuse colliding / inconsistent claims.
 */
export function generateHostileLayouts(
  positiveParticipants: readonly SymbolicParticipantLayout[],
): readonly HostileLayoutCase[] {
  const participants: SymbolicParticipantLayout[] = positiveParticipants.map((entry) => ({
    ...entry,
    blockLayout: entry.blockLayout ? { ...entry.blockLayout, slots: [...(entry.blockLayout.slots ?? [])] } : undefined,
  }));

  if (participants.length === 0) {
    throw new Error('hostile-plan-generators: need ≥1 positive participant');
  }

  const p0 = participants[0]!;
  const trailing = p0.blockLayout?.trailingBase ?? 10;
  const capacity = p0.blockLayout?.trailingCapacity ?? 20;
  const withTrailing: SymbolicParticipantLayout[] = [{
    ...p0,
    blockLayout: {
      blockSize: p0.blockLayout?.blockSize ?? 40,
      trailingBase: trailing,
      trailingCapacity: capacity,
      slots: [],
    },
  }];

  const collideOwnership: ResourceOwnershipClaim[] = [
    {
      participant: p0.participant,
      carrier: 'dynamicState',
      roles: { outputSlot: trailing },
      rangeWidth: 4,
    },
    {
      participant: p0.participant,
      carrier: 'valueChunk',
      collection: 'events',
      roles: { outputSlot: trailing + 2 },
      rangeWidth: 2,
    },
  ];

  const unknownParticipantClaim: LayoutResolverInput = {
    participants: withTrailing,
    valueChunkClaims: [{
      participant: 99,
      collection: 'ghost',
      bandOffset: 0,
      chunkCount: 1,
    }],
  };

  const dynValueCollision: LayoutResolverInput = {
    participants: withTrailing,
    dynamicBandClaims: [{ participant: p0.participant, chunkCount: 4 }],
    valueChunkClaims: [{
      participant: p0.participant,
      collection: 'events',
      bandOffset: 2,
      chunkCount: 2,
    }],
    ownership: collideOwnership,
  };

  const invalidBlock: LayoutResolverInput = {
    participants: [{
      participant: 0,
      blockLayout: { blockSize: 0, slots: [] },
    }],
  };

  return [
    {
      id: 'dyn-valuechunk-collision',
      description: 'overlapping dyn and valueChunk output ranges',
      input: dynValueCollision,
      expectThrow: /claim-slot-collision|overlapping-range/,
    },
    {
      id: 'unknown-participant-claim',
      description: 'value-chunk claim for participant absent from topology',
      input: unknownParticipantClaim,
      expectThrow: /unknown participant/,
    },
    {
      id: 'invalid-block-size',
      description: 'non-positive blockSize fails closed',
      input: invalidBlock,
      expectThrow: /block-size-invalid/,
    },
  ];
}

/**
 * Digest-integrity hostiles: reorder / remove / transplant descriptors that must
 * change the production digest relative to the positive plan.
 */
export function generateDigestIntegrityMutations(
  positive: KernelExecutionPlan,
): readonly { id: string; plan: KernelExecutionPlan; mustChangeDigest: boolean }[] {
  const base = createKernelExecutionPlan({
    handlerId: positive.handlerId || 'handler:positive',
    selectedResources: positive.selectedResources ?? ['events'],
    dynamicWrites: positive.dynamicWrites ?? ['events'],
    dynamicReads: positive.dynamicReads ?? [],
    budgets: positive.budgets,
  });

  const removedResource = clonePlan(base);
  removedResource.selectedResources = [];

  const reorderedWrites = clonePlan(base);
  reorderedWrites.dynamicWrites = [...(base.dynamicWrites ?? [])].reverse();
  if ((reorderedWrites.dynamicWrites?.length ?? 0) < 2) {
    reorderedWrites.dynamicWrites = ['alpha', 'beta'];
    // Ensure base also has the sorted-equivalent pair for a stable positive.
  }

  const transplanted = clonePlan(base);
  transplanted.handlerId = `${base.handlerId}#transplant`;

  const droppedBudget = clonePlan(base);
  droppedBudget.budgets = { ...(base.budgets ?? {}), maximumRows: (base.budgets?.maximumRows ?? 8) + 1 };

  return [
    { id: 'remove-selectedResources', plan: removedResource, mustChangeDigest: true },
    {
      id: 'reorder-dynamicWrites',
      plan: createKernelExecutionPlan({
        handlerId: base.handlerId,
        selectedResources: base.selectedResources,
        dynamicWrites: ['beta', 'alpha'],
        budgets: base.budgets,
      }),
      // Production sorts writes before digest → reorder alone must NOT change digest.
      mustChangeDigest: false,
    },
    { id: 'transplant-handlerId', plan: transplanted, mustChangeDigest: true },
    { id: 'bump-budget-axis', plan: droppedBudget, mustChangeDigest: true },
  ];
}
