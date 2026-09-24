/**
 * look-ahead property: look-ahead property suites (alpha-rename, reorder, digest integrity, hostile layout).
 * Drives shipped `look-ahead-properties.ts` runners over production authority surfaces.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKernelExecutionPlan } from '../../src/message-bus/kernel-execution-plan.js';
import {
  clearComposeKernelAuthorityResults,
} from '../../src/message-bus/compose-kernel-authority.js';
import { setMaterializationMode } from '../../src/message-bus/materialization-mode.js';
import {
  evaluateAllLookAheadProperties,
  evaluateAlphaRenameLookAhead,
  evaluateDigestIntegrityLookAhead,
  evaluateHostileLayoutLookAhead,
  evaluateHostileKernelPlanLookAhead,
  evaluateReorderLookAhead,
} from '../../src/message-bus/look-ahead-properties.js';

describe('look-ahead property look-ahead property suites', () => {
  afterEach(() => {
    setMaterializationMode('recipe');
    clearComposeKernelAuthorityResults();
  });

  const positive = createKernelExecutionPlan({
    handlerId: 'handler:a9059cbb',
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

  const positiveParticipants = [
    {
      participant: 0,
      blockLayout: {
        blockSize: 40, trailingBase: 10, trailingCapacity: 20, slots: [] as const,
      },
    },
  ];

  it('alpha-rename: diagnostic handlerName does not change digest or compose join key', () => {
    const result = evaluateAlphaRenameLookAhead({
      handlerSelector: 'a9059cbb',
      names: ['transfer', 'sendTokens'],
      selectedResources: ['balances'],
    });
    expect(result.ok, result.detail).toBe(true);
    expect(result.id).toBe('alpha-rename-diagnostic-name');
  });

  it('reorder: dynamicWrites order is digest-stable; resource transplant is not', () => {
    const results = evaluateReorderLookAhead(positive);
    expect(results.length).toBeGreaterThanOrEqual(2);
    for (const result of results) {
      expect(result.ok, `${result.id}: ${result.detail ?? ''}`).toBe(true);
    }
  });

  it('digest integrity: production mutations match mustChangeDigest', () => {
    const results = evaluateDigestIntegrityLookAhead(positive);
    expect(results.length).toBeGreaterThanOrEqual(3);
    for (const result of results) {
      expect(result.ok, `${result.id}: ${result.detail ?? ''}`).toBe(true);
    }
  });

  it('hostile layout: resolveTransactionLayout refuses every generated case before VM', () => {
    const results = evaluateHostileLayoutLookAhead(positiveParticipants);
    expect(results.length).toBeGreaterThanOrEqual(3);
    for (const result of results) {
      expect(result.ok, `${result.id}: ${result.detail ?? ''}`).toBe(true);
    }
  });

  it('hostile kernel plans: production assert gates refuse every generated case', () => {
    const results = evaluateHostileKernelPlanLookAhead(positive);
    expect(results.length).toBeGreaterThanOrEqual(3);
    for (const result of results) {
      expect(result.ok, `${result.id}: ${result.detail ?? ''}`).toBe(true);
    }
  });

  it('evaluateAllLookAheadProperties aggregates every look-ahead property axis and all hold', () => {
    const results = evaluateAllLookAheadProperties({
      handlerSelector: 'a9059cbb',
      positivePlan: positive,
      positiveParticipants,
    });
    expect(results.some((result) => result.id === 'alpha-rename-diagnostic-name')).toBe(true);
    expect(results.some((result) => result.id.startsWith('reorder-'))).toBe(true);
    expect(results.some((result) => result.id.startsWith('digest-integrity:'))).toBe(true);
    expect(results.some((result) => result.id.startsWith('hostile-layout:'))).toBe(true);
    expect(results.some((result) => result.id.startsWith('hostile-plan:'))).toBe(true);
    const failures = results.filter((result) => !result.ok);
    expect(failures, JSON.stringify(failures)).toEqual([]);
  });

  it('production look-ahead module wires digest / authorize / resolve / hostile generators', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../../src/message-bus/look-ahead-properties.ts'), 'utf8');
    const indexSrc = readFileSync(join(here, '../../src/message-bus/index.ts'), 'utf8');
    expect(src).toContain('digestKernelExecutionPlan');
    expect(src).toContain('authorizeComposeParticipantLayout');
    expect(src).toContain('resolveTransactionLayout');
    expect(src).toContain('generateDigestIntegrityMutations');
    expect(src).toContain('generateHostileLayouts');
    expect(src).toContain('generateHostileKernelPlans');
    expect(src).toContain('evaluateAllLookAheadProperties');
    expect(indexSrc).toContain("from './look-ahead-properties.js'");
  });
});
