/**
 * Behavioral proofs for items 5–7/9/11–12: removing authorizeComposeParticipantLayout
 * effects (budget enforce, selector-stable id, phase freeze, digest stamp) fails these tests.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  authorizeComposeParticipantLayout,
  clearComposeKernelAuthorityResults,
  getComposeKernelAuthorityResults,
} from '../../src/message-bus/compose-kernel-authority.js';
import { digestKernelExecutionPlan } from '../../src/message-bus/kernel-execution-plan.js';
import {
  refuseVmExtractedRepairsIfRecipe,
  setMaterializationMode,
} from '../../src/message-bus/materialization-mode.js';

describe('compose kernel authority live path (items 5–7, 11–12)', () => {
  afterEach(() => {
    setMaterializationMode('recipe');
  });

  it('uses selector as StableId.id (not diagnostic name) and stamps a real digest', () => {
    clearComposeKernelAuthorityResults();
    setMaterializationMode('devOracle');
    const result = authorizeComposeParticipantLayout({
      participant: 0,
      handlerSelector: 'a9059cbb',
      handlerDiagnosticName: 'transfer',
      publishedBase: 10,
      claimCount: 1,
      selectedResources: ['balances'],
      dynamicWrites: [],
    });
    expect(result.handlerJoinKey).toBe('handler:a9059cbb');
    expect(result.handlerJoinKey).not.toContain('transfer');
    expect(result.digest).toBe(digestKernelExecutionPlan(result.plan));
    expect(result.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.phase.phase).toBe('absoluteLayout');
    expect(result.phase.payload.publishedBase).toBe(10);
    expect(getComposeKernelAuthorityResults()).toHaveLength(1);
    expect(getComposeKernelAuthorityResults()[0]?.digest).toBe(result.digest);
  });

  it('assertKernelPlanComplete + assertWithinKernelBudgets fail-close over budget (item 6/12)', () => {
    expect(() => authorizeComposeParticipantLayout({
      participant: 0,
      handlerSelector: 'deadbeef',
      publishedBase: 0,
      claimCount: 0,
      budgets: { maximumRows: 1 },
      usage: { maximumRows: 5 },
    })).toThrow(/maximumRows/);
  });

  it('renaming diagnostic name does not change digest or join key (item 7 alpha-rename)', () => {
    const a = authorizeComposeParticipantLayout({
      participant: 1,
      handlerSelector: 'cafef00d',
      handlerDiagnosticName: 'reset',
      publishedBase: 3,
      claimCount: 0,
    });
    const b = authorizeComposeParticipantLayout({
      participant: 1,
      handlerSelector: 'cafef00d',
      handlerDiagnosticName: 'foobar',
      publishedBase: 3,
      claimCount: 0,
    });
    expect(a.handlerJoinKey).toBe(b.handlerJoinKey);
    expect(a.digest).toBe(b.digest);
  });
});

describe('recipe mode refuses VM-extracted repairs (item 9)', () => {
  afterEach(() => {
    setMaterializationMode('recipe');
  });

  it('refuseVmExtractedRepairsIfRecipe throws when proposals>0 in recipe mode (preflight gate)', () => {
    setMaterializationMode('recipe');
    expect(() => refuseVmExtractedRepairsIfRecipe(1)).toThrow(/forbids/);
    expect(() => refuseVmExtractedRepairsIfRecipe(0)).not.toThrow();
    setMaterializationMode('devOracle');
    expect(() => refuseVmExtractedRepairsIfRecipe(3)).not.toThrow();
  });
});
