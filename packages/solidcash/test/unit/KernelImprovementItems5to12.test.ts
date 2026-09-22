/**
 * Focused proofs for KERNEL_IMPROVEMENT_BACKLOG items 5–12.
 * Each `describe` is runnable via vitest `-t 'item N'` for per-item evidence logs.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertKernelPlanComplete,
  assertWithinKernelBudgets,
  createKernelExecutionPlan,
  digestKernelExecutionPlan,
  KERNEL_PLAN_VERSION,
} from '../../src/message-bus/kernel-execution-plan.js';
import {
  decodeLayoutCoordinate,
  encodeLayoutCoordinate,
  rebaseLayoutCoordinate,
} from '../../src/message-bus/layout-sentinels.js';
import { MonotoneCell, freezeGeometry } from '../../src/message-bus/monotone-lattice.js';
import {
  assertRecipeModeDoesNotProbe,
  getMaterializationMode,
  isVmValidationOnly,
  setMaterializationMode,
} from '../../src/message-bus/materialization-mode.js';
import {
  requireStableId,
  stableIdsEqual,
  stableJoinKey,
} from '../../src/message-bus/stable-ids.js';
import {
  advancePhase,
  assertGeometryFrozen,
  startPhase,
} from '../../src/message-bus/planning-phases.js';

describe('item 5 kernel execution plan digest', () => {
  it('createKernelExecutionPlan + digestKernelExecutionPlan change when execution fields change', () => {
    const plan = createKernelExecutionPlan({
      handlerId: 'h-set',
      handlerName: 'set',
      dynamicWrites: [],
      selectedResources: ['data'],
      journalDispositionDigest: 'abcd',
    });
    expect(plan.kernelPlanVersion).toBe(KERNEL_PLAN_VERSION);
    const digA = digestKernelExecutionPlan(plan);
    const digB = digestKernelExecutionPlan({
      ...plan,
      selectedResources: ['other'],
    });
    expect(digA).toMatch(/^[0-9a-f]{64}$/);
    expect(digA).not.toBe(digB);
  });
});

describe('item 6 explicit empty vs omitted metadata', () => {
  it('assertKernelPlanComplete requires published dynamicWrites array', () => {
    const plan = createKernelExecutionPlan({ handlerId: 'h-1', dynamicWrites: [] });
    expect(plan.dynamicWritesPublished).toBe(true);
    expect(plan.dynamicWrites).toEqual([]);
    assertKernelPlanComplete(plan);
    expect(() => assertKernelPlanComplete({
      ...plan,
      handlerId: '',
    })).toThrow(/handlerId/);
  });
});

describe('item 7 stable ids', () => {
  it('joins ignore diagnostic names; missing id fail-closes', () => {
    const a = requireStableId('handler', 'id-1', 'reset');
    const b = requireStableId('handler', 'id-1', 'foobar');
    expect(stableIdsEqual(a, b)).toBe(true);
    expect(stableJoinKey(a)).toBe('handler:id-1');
    expect(() => requireStableId('callsite', undefined, 'poke')).toThrow(/missing/);
  });
});

describe('item 8 layout sentinels', () => {
  it('encodes/decodes coordinates and inactive preserved indices without sentinel→coordinate drift', () => {
    expect(encodeLayoutCoordinate({ kind: 'absent' })).toBe(-1n);
    expect(encodeLayoutCoordinate({ kind: 'inactive' })).toBe(-2n);
    expect(decodeLayoutCoordinate(encodeLayoutCoordinate({ kind: 'inactive', preservedIndex: 4 })))
      .toEqual({ kind: 'inactive', preservedIndex: 4 });
    expect(rebaseLayoutCoordinate({ kind: 'absent' }, 100)).toEqual({ kind: 'absent' });
    expect(rebaseLayoutCoordinate({ kind: 'inactive', preservedIndex: 2 }, 100))
      .toEqual({ kind: 'inactive', preservedIndex: 2 });
    expect(rebaseLayoutCoordinate({ kind: 'coordinate', index: 7 }, 100))
      .toEqual({ kind: 'coordinate', index: 107 });
  });
});

describe('item 9 materialization mode', () => {
  afterEach(() => {
    setMaterializationMode('recipe');
  });

  it('recipe mode is VM validation-only and forbids failed-VM extraction', () => {
    setMaterializationMode('recipe');
    expect(getMaterializationMode()).toBe('recipe');
    expect(isVmValidationOnly()).toBe(true);
    expect(() => assertRecipeModeDoesNotProbe('extractFromFailedVm')).toThrow(/forbids/);
    setMaterializationMode('devOracle');
    expect(isVmValidationOnly()).toBe(false);
    expect(() => assertRecipeModeDoesNotProbe('extractFromFailedVm')).not.toThrow();
  });
});

describe('item 10 monotone lattice', () => {
  it('allows unknown→placeholder→resolved and refuses resolved→different', () => {
    const cell = new MonotoneCell<string>();
    cell.advance({ tag: 'placeholder', hint: 'a' });
    cell.resolve('final');
    expect(cell.get()).toEqual({ tag: 'resolved', value: 'final' });
    expect(() => cell.resolve('other')).toThrow(/cannot change/);
    expect(Object.isFrozen(freezeGeometry({ trailingBase: 3 }))).toBe(true);
  });
});

describe('item 11 planning phases', () => {
  it('advances only sequentially and freezes geometry at absoluteLayout', () => {
    const start = startPhase({ src: true });
    const ir = advancePhase(start, 'admittedHandlerIr', (p) => ({ ...p, handlers: 1 }));
    const plan = advancePhase(ir, 'symbolicResourcePlan', (p) => ({ ...p, claims: 1 }));
    const layout = advancePhase(plan, 'absoluteLayout', (p) => ({ ...p, base: 0 }));
    expect(() => assertGeometryFrozen(layout.phase)).not.toThrow();
    expect(() => advancePhase(start, 'absoluteLayout', (p) => p)).toThrow(/sequential/);
  });
});

describe('item 12 multidimensional budgets', () => {
  it('assertWithinKernelBudgets rejects over-budget envelopes', () => {
    const plan = createKernelExecutionPlan({
      handlerId: 'h-budget',
      budgets: {
        maximumRows: 2,
        maximumDynamicChunks: 4,
        maximumJournalRecords: 8,
        maximumTransactionBytes: 1000,
      },
    });
    expect(() => assertWithinKernelBudgets(plan, { maximumRows: 3 })).toThrow(/maximumRows/);
    expect(() => assertWithinKernelBudgets(plan, {
      maximumRows: 2,
      maximumDynamicChunks: 4,
      maximumJournalRecords: 8,
      maximumTransactionBytes: 1000,
    })).not.toThrow();
  });
});
