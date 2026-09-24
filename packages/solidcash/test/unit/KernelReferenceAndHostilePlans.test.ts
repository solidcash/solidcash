/**
 * kernel reference model: independent kernel reference model (plan acceptance + layout base packing).
 * hostile plan generator: hostile generators from positive plans; production authority refuses them.
 * Metamorphic suite drives shipped create/assert/digest + resolveTransactionLayout + compose authorize.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertKernelPlanComplete,
  assertWithinKernelBudgets,
  createKernelExecutionPlan,
  digestKernelExecutionPlan,
} from '../../src/message-bus/kernel-execution-plan.js';
import {
  referenceAgreesWithResolvedBases,
  referenceDigestKernelExecutionPlan,
  referenceEvaluateKernelPlan,
  referenceResolveParticipantBases,
} from '../../src/message-bus/kernel-reference-model.js';
import {
  generateDigestIntegrityMutations,
  generateHostileKernelPlans,
  generateHostileLayouts,
} from '../../src/message-bus/hostile-plan-generators.js';
import { resolveTransactionLayout } from '../../src/message-bus/layout-resolver.js';
import {
  authorizeComposeParticipantLayout,
  clearComposeKernelAuthorityResults,
} from '../../src/message-bus/compose-kernel-authority.js';
import { setMaterializationMode } from '../../src/message-bus/materialization-mode.js';

describe('kernel reference model independent kernel reference model', () => {
  const positivePlan = createKernelExecutionPlan({
    handlerId: 'handler:a9059cbb',
    handlerName: 'transfer',
    selectedResources: ['balances'],
    dynamicWrites: ['balances'],
    dynamicReads: [],
    budgets: {
      maximumRows: 8,
      maximumParticipants: 32,
      maximumDynamicChunks: 64,
      maximumValueContinuationChunks: 64,
    },
  });

  it('referenceEvaluateKernelPlan agrees with production completeness/budgets on a positive plan', () => {
    const usage = { maximumRows: 2, maximumParticipants: 1 };
    expect(() => assertKernelPlanComplete(positivePlan)).not.toThrow();
    expect(() => assertWithinKernelBudgets(positivePlan, usage)).not.toThrow();
    const reference = referenceEvaluateKernelPlan(positivePlan, usage);
    expect(reference.complete).toBe(true);
    expect(reference.withinBudgets).toBe(true);
    expect(reference.refusalReasons).toEqual([]);
    expect(reference.referenceDigest).toMatch(/^[0-9a-f]{64}$/);
    // Independent encoding differs from production JSON digest (not a tautology).
    expect(reference.referenceDigest).not.toBe(digestKernelExecutionPlan(positivePlan));
  });

  it('referenceEvaluateKernelPlan agrees with production refusals on incomplete / over-budget plans', () => {
    for (const hostile of generateHostileKernelPlans(positivePlan)) {
      const productionThrows = (() => {
        try {
          assertKernelPlanComplete(hostile.plan);
          assertWithinKernelBudgets(hostile.plan, hostile.usage);
          return false;
        } catch {
          return true;
        }
      })();
      expect(productionThrows).toBe(true);
      const reference = referenceEvaluateKernelPlan(hostile.plan, hostile.usage);
      expect(reference.complete && reference.withinBudgets).toBe(false);
      expect(reference.refusalReasons.length).toBeGreaterThan(0);
    }
  });

  it('referenceResolveParticipantBases agrees with resolveTransactionLayout packing', () => {
    const input = {
      nonParticipantInputPrefix: 2,
      nonParticipantOutputPrefix: 1,
      participants: [
        { participant: 0, blockLayout: { blockSize: 10, trailingBase: 4, trailingCapacity: 6, slots: [] } },
        { participant: 1, blockLayout: { blockSize: 8, trailingBase: 3, trailingCapacity: 5, slots: [] } },
      ],
    };
    const layout = resolveTransactionLayout(input);
    const reference = referenceResolveParticipantBases(
      input.participants, input.nonParticipantInputPrefix, input.nonParticipantOutputPrefix,
    );
    expect(reference).toEqual([
      { participant: 0, inputBase: 2, outputBase: 1, blockSize: 10 },
      { participant: 1, inputBase: 12, outputBase: 11, blockSize: 8 },
    ]);
    expect(layout.participants[0]?.inputBase).toBe(2);
    expect(layout.participants[0]?.outputBase).toBe(1);
    expect(layout.participants[1]?.inputBase).toBe(12);
    expect(layout.participants[1]?.outputBase).toBe(11);
    expect(referenceAgreesWithResolvedBases(input, layout.participants)).toBe(true);
  });

  it('referenceDigestKernelExecutionPlan is stable under alpha-rename of diagnostic handlerName', () => {
    const a = createKernelExecutionPlan({
      handlerId: 'handler:cafef00d',
      handlerName: 'reset',
      dynamicWrites: [],
    });
    const b = createKernelExecutionPlan({
      handlerId: 'handler:cafef00d',
      handlerName: 'foobar',
      dynamicWrites: [],
    });
    expect(referenceDigestKernelExecutionPlan(a)).toBe(referenceDigestKernelExecutionPlan(b));
    expect(digestKernelExecutionPlan(a)).toBe(digestKernelExecutionPlan(b));
  });
});

describe('hostile plan generator hostile generators from positive plans', () => {
  afterEach(() => {
    setMaterializationMode('recipe');
    clearComposeKernelAuthorityResults();
  });

  const positivePlan = createKernelExecutionPlan({
    handlerId: 'handler:deadbeef',
    selectedResources: ['events'],
    dynamicWrites: ['events'],
    budgets: {
      maximumRows: 4,
      maximumParticipants: 8,
      maximumDynamicChunks: 16,
      maximumValueContinuationChunks: 16,
    },
  });

  it('generateHostileKernelPlans are refused by production assert + compose authorize', () => {
    for (const hostile of generateHostileKernelPlans(positivePlan, { maximumRows: 1 })) {
      expect(() => {
        assertKernelPlanComplete(hostile.plan);
        assertWithinKernelBudgets(hostile.plan, hostile.usage);
      }).toThrow(hostile.expectThrow);

      // Compose authorize path also refuses over-budget / incomplete via the same gates.
      if (hostile.id === 'over-budget-rows') {
        expect(() => authorizeComposeParticipantLayout({
          participant: 0,
          handlerSelector: 'deadbeef',
          publishedBase: 0,
          claimCount: 0,
          budgets: hostile.plan.budgets,
          usage: hostile.usage,
        })).toThrow(/maximumRows/);
      }
    }
  });

  it('generateHostileLayouts are refused by resolveTransactionLayout before VM', () => {
    const positiveParticipants = [
      {
        participant: 0,
        blockLayout: {
          blockSize: 40, trailingBase: 10, trailingCapacity: 20, slots: [] as const,
        },
      },
    ];
    for (const hostile of generateHostileLayouts(positiveParticipants)) {
      expect(() => resolveTransactionLayout(hostile.input), hostile.id)
        .toThrow(hostile.expectThrow);
    }
  });

  it('digest integrity mutations change production digest iff required', () => {
    const positiveDigest = digestKernelExecutionPlan(positivePlan);
    for (const mutation of generateDigestIntegrityMutations(positivePlan)) {
      const next = digestKernelExecutionPlan(mutation.plan);
      if (mutation.mustChangeDigest) {
        expect(next, mutation.id).not.toBe(positiveDigest);
      } else {
        // Reorder of dynamicWrites: production sorts before digest.
        const sortedPositive = digestKernelExecutionPlan(createKernelExecutionPlan({
          handlerId: positivePlan.handlerId,
          selectedResources: positivePlan.selectedResources,
          dynamicWrites: ['alpha', 'beta'],
          budgets: positivePlan.budgets,
        }));
        expect(next, mutation.id).toBe(sortedPositive);
      }
    }
  });

  it('compose authorize digest changes when selectedResources are transplanted (metamorphic)', () => {
    clearComposeKernelAuthorityResults();
    const a = authorizeComposeParticipantLayout({
      participant: 0,
      handlerSelector: 'aabbccdd',
      publishedBase: 0,
      claimCount: 1,
      selectedResources: ['events'],
      dynamicWrites: ['events'],
    });
    const b = authorizeComposeParticipantLayout({
      participant: 0,
      handlerSelector: 'aabbccdd',
      publishedBase: 0,
      claimCount: 1,
      selectedResources: ['jobs'],
      dynamicWrites: ['jobs'],
    });
    expect(a.digest).not.toBe(b.digest);
    expect(a.handlerJoinKey).toBe(b.handlerJoinKey);
  });
});
