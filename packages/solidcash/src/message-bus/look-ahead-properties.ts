/**
 * look-ahead property: look-ahead property runners over shipped kernel authority surfaces.
 *
 * Suites call these helpers (not reimplemented oracles). Each runner exercises
 * production digest / authorize / resolve / hostile-generator paths.
 */

import {
  assertKernelPlanComplete,
  assertWithinKernelBudgets,
  createKernelExecutionPlan,
  digestKernelExecutionPlan,
  type KernelExecutionPlan,
} from './kernel-execution-plan.js';
import {
  generateDigestIntegrityMutations,
  generateHostileKernelPlans,
  generateHostileLayouts,
} from './hostile-plan-generators.js';
import { resolveTransactionLayout, type SymbolicParticipantLayout } from './layout-resolver.js';
import { authorizeComposeParticipantLayout } from './compose-kernel-authority.js';

export type LookAheadPropertyResult = {
  id: string;
  ok: boolean;
  detail?: string;
};

/** Alpha-rename: diagnostic handlerName must not change plan digest or compose join key. */
export function evaluateAlphaRenameLookAhead(params: {
  handlerSelector: string;
  names: readonly [string, string];
  publishedBase?: number;
  selectedResources?: readonly string[];
}): LookAheadPropertyResult {
  const [nameA, nameB] = params.names;
  const planA = createKernelExecutionPlan({
    handlerId: `handler:${params.handlerSelector}`,
    handlerName: nameA,
    dynamicWrites: params.selectedResources ?? [],
    selectedResources: params.selectedResources,
  });
  const planB = createKernelExecutionPlan({
    handlerId: `handler:${params.handlerSelector}`,
    handlerName: nameB,
    dynamicWrites: params.selectedResources ?? [],
    selectedResources: params.selectedResources,
  });
  const digestOk = digestKernelExecutionPlan(planA) === digestKernelExecutionPlan(planB);
  const authA = authorizeComposeParticipantLayout({
    participant: 0,
    handlerSelector: params.handlerSelector,
    handlerDiagnosticName: nameA,
    publishedBase: params.publishedBase ?? 0,
    claimCount: 0,
    selectedResources: params.selectedResources,
    dynamicWrites: params.selectedResources,
  });
  const authB = authorizeComposeParticipantLayout({
    participant: 0,
    handlerSelector: params.handlerSelector,
    handlerDiagnosticName: nameB,
    publishedBase: params.publishedBase ?? 0,
    claimCount: 0,
    selectedResources: params.selectedResources,
    dynamicWrites: params.selectedResources,
  });
  const joinOk = authA.handlerJoinKey === authB.handlerJoinKey && authA.digest === authB.digest;
  return {
    id: 'alpha-rename-diagnostic-name',
    ok: digestOk && joinOk,
    detail: digestOk && joinOk
      ? undefined
      : `digestOk=${digestOk} joinOk=${joinOk} digests=${authA.digest.slice(0, 8)}/${authB.digest.slice(0, 8)}`,
  };
}

/**
 * Declaration reorder: reordering dynamicWrites must preserve the plan digest
 * (production sorts before hashing). Resource identity transplant must change it.
 */
export function evaluateReorderLookAhead(positive: KernelExecutionPlan): readonly LookAheadPropertyResult[] {
  const writes = [...(positive.dynamicWrites ?? [])];
  if (writes.length < 2) {
    writes.push('alpha', 'beta');
  }
  const forward = createKernelExecutionPlan({
    handlerId: positive.handlerId,
    selectedResources: positive.selectedResources,
    dynamicWrites: writes,
    budgets: positive.budgets,
  });
  const reversed = createKernelExecutionPlan({
    handlerId: positive.handlerId,
    selectedResources: positive.selectedResources,
    dynamicWrites: [...writes].reverse(),
    budgets: positive.budgets,
  });
  const reorderPreserves = digestKernelExecutionPlan(forward) === digestKernelExecutionPlan(reversed);

  const transplanted = createKernelExecutionPlan({
    handlerId: positive.handlerId,
    selectedResources: ['__transplanted__'],
    dynamicWrites: ['__transplanted__'],
    budgets: positive.budgets,
  });
  const transplantChanges = digestKernelExecutionPlan(forward) !== digestKernelExecutionPlan(transplanted);

  return [
    {
      id: 'reorder-dynamicWrites-preserves-digest',
      ok: reorderPreserves,
      detail: reorderPreserves ? undefined : 'reordered writes changed digest',
    },
    {
      id: 'transplant-selectedResources-changes-digest',
      ok: transplantChanges,
      detail: transplantChanges ? undefined : 'resource transplant failed to change digest',
    },
  ];
}

/**
 * Plan digest integrity: every generator mutation matches mustChangeDigest against production.
 * Reorder cases compare against the sorted-write baseline the generator constructs (not the
 * caller's original positive writes), matching `generateDigestIntegrityMutations` semantics.
 */
export function evaluateDigestIntegrityLookAhead(
  positive: KernelExecutionPlan,
): readonly LookAheadPropertyResult[] {
  const positiveDigest = digestKernelExecutionPlan(positive);
  const reorderBaselineDigest = digestKernelExecutionPlan(createKernelExecutionPlan({
    handlerId: positive.handlerId || 'handler:positive',
    selectedResources: positive.selectedResources ?? ['events'],
    dynamicWrites: ['alpha', 'beta'],
    budgets: positive.budgets,
  }));
  return generateDigestIntegrityMutations(positive).map((mutation) => {
    const next = digestKernelExecutionPlan(mutation.plan);
    if (mutation.mustChangeDigest) {
      const changed = next !== positiveDigest;
      return {
        id: `digest-integrity:${mutation.id}`,
        ok: changed,
        detail: changed ? undefined : 'expected digest change',
      };
    }
    // Reorder: production sorts writes → digest equals the alpha/beta sorted baseline.
    const ok = next === reorderBaselineDigest;
    return {
      id: `digest-integrity:${mutation.id}`,
      ok,
      detail: ok ? undefined : 'reorder did not match sorted-write baseline digest',
    };
  });
}

/** Hostile layouts: every generated case must be refused by resolveTransactionLayout. */
export function evaluateHostileLayoutLookAhead(
  positiveParticipants: readonly SymbolicParticipantLayout[],
): readonly LookAheadPropertyResult[] {
  return generateHostileLayouts(positiveParticipants).map((hostile) => {
    let refused = false;
    let message = '';
    try {
      resolveTransactionLayout(hostile.input);
    } catch (error) {
      refused = true;
      message = error instanceof Error ? error.message : String(error);
    }
    const matched = refused && hostile.expectThrow.test(message);
    return {
      id: `hostile-layout:${hostile.id}`,
      ok: matched,
      detail: matched ? undefined : `refused=${refused} message=${message.slice(0, 120)}`,
    };
  });
}

/** Hostile kernel plans: production assert gates refuse each case. */
export function evaluateHostileKernelPlanLookAhead(
  positive: KernelExecutionPlan,
): readonly LookAheadPropertyResult[] {
  return generateHostileKernelPlans(positive, { maximumRows: 1 }).map((hostile) => {
    let refused = false;
    let message = '';
    try {
      assertKernelPlanComplete(hostile.plan);
      assertWithinKernelBudgets(hostile.plan, hostile.usage);
    } catch (error) {
      refused = true;
      message = error instanceof Error ? error.message : String(error);
    }
    const matched = refused && hostile.expectThrow.test(message);
    return {
      id: `hostile-plan:${hostile.id}`,
      ok: matched,
      detail: matched ? undefined : `refused=${refused} message=${message.slice(0, 120)}`,
    };
  });
}

/** Run the four look-ahead property look-ahead axes and return every property result. */
export function evaluateAllLookAheadProperties(params?: {
  handlerSelector?: string;
  positivePlan?: KernelExecutionPlan;
  positiveParticipants?: readonly SymbolicParticipantLayout[];
}): readonly LookAheadPropertyResult[] {
  const selector = params?.handlerSelector ?? 'a9059cbb';
  const positive = params?.positivePlan ?? createKernelExecutionPlan({
    handlerId: `handler:${selector}`,
    handlerName: 'transfer',
    selectedResources: ['balances', 'events'],
    dynamicWrites: ['balances', 'events'],
    budgets: {
      maximumRows: 8,
      maximumParticipants: 32,
      maximumDynamicChunks: 64,
      maximumValueContinuationChunks: 64,
    },
  });
  const participants = params?.positiveParticipants ?? [
    {
      participant: 0,
      blockLayout: {
        blockSize: 40, trailingBase: 10, trailingCapacity: 20, slots: [],
      },
    },
  ];

  return [
    evaluateAlphaRenameLookAhead({
      handlerSelector: selector,
      names: ['transfer', 'renamedTransfer'],
      selectedResources: positive.selectedResources,
    }),
    ...evaluateReorderLookAhead(positive),
    ...evaluateDigestIntegrityLookAhead(positive),
    ...evaluateHostileLayoutLookAhead(participants),
    ...evaluateHostileKernelPlanLookAhead(positive),
  ];
}
