import { afterEach, describe, expect, it } from 'vitest';
import {
  assertKernelPlanComplete,
  assertWithinKernelBudgets,
  createKernelExecutionPlan,
  digestKernelExecutionPlan,
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

describe('kernel execution plan (items 5–6, 12)', () => {
  it('publishes explicit empty dynamicWrites and digests execution-affecting fields', () => {
    const plan = createKernelExecutionPlan({
      handlerId: 'h-1',
      handlerName: 'set',
      dynamicWrites: [],
      budgets: { maximumRows: 4, maximumDynamicChunks: 8 },
    });
    assertKernelPlanComplete(plan);
    expect(plan.dynamicWritesPublished).toBe(true);
    expect(plan.dynamicWrites).toEqual([]);

    const digA = digestKernelExecutionPlan(plan);
    const digB = digestKernelExecutionPlan({
      ...plan,
      dynamicWrites: ['label'],
    });
    expect(digA).not.toBe(digB);
  });

  it('rejects missing required kernel plan metadata', () => {
    expect(() => assertKernelPlanComplete({
      kernelPlanVersion: 1,
      handlerId: '',
      dynamicWritesPublished: true,
      dynamicWrites: [],
    })).toThrow(/handlerId/);
  });

  it('rejects over-budget envelopes before materialization', () => {
    const plan = createKernelExecutionPlan({
      handlerId: 'h-2',
      budgets: { maximumRows: 2, maximumBlobBytes: 100 },
    });
    expect(() => assertWithinKernelBudgets(plan, { maximumRows: 3 })).toThrow(/maximumRows/);
    expect(() => assertWithinKernelBudgets(plan, { maximumRows: 2, maximumBlobBytes: 100 }))
      .not.toThrow();
  });

  it('rejects malformed published limits and non-finite or negative usage', () => {
    const plan = createKernelExecutionPlan({
      handlerId: 'h-numeric', budgets: { maximumRows: 2 },
    });
    for (const used of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => assertWithinKernelBudgets(plan, { maximumRows: used }))
        .toThrow(/maximumRows.*non-negative safe integer/);
    }
    for (const limit of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const malformed = createKernelExecutionPlan({
        handlerId: 'h-numeric', budgets: { maximumRows: limit },
      });
      expect(() => assertKernelPlanComplete(malformed))
        .toThrow(/maximumRows.*non-negative safe integer/);
      expect(() => digestKernelExecutionPlan(malformed))
        .toThrow(/maximumRows.*non-negative safe integer/);
    }
  });
});

describe('layout sentinels (item 8)', () => {
  it('round-trips coordinates and preserves sentinels under rebase', () => {
    expect(encodeLayoutCoordinate({ kind: 'absent' })).toBe(-1n);
    expect(encodeLayoutCoordinate({ kind: 'inactive' })).toBe(-2n);
    expect(decodeLayoutCoordinate(42n)).toEqual({ kind: 'coordinate', index: 42 });
    expect(rebaseLayoutCoordinate({ kind: 'absent' }, 100)).toEqual({ kind: 'absent' });
    expect(rebaseLayoutCoordinate({ kind: 'coordinate', index: 5 }, 100))
      .toEqual({ kind: 'coordinate', index: 105 });
  });
});

describe('monotone lattice (item 10)', () => {
  it('allows unknown→resolved and freezes geometry', () => {
    const cell = new MonotoneCell<number>();
    cell.advance({ tag: 'placeholder', hint: 1 });
    cell.resolve(7);
    expect(cell.get()).toEqual({ tag: 'resolved', value: 7 });
    expect(() => cell.resolve(8)).toThrow(/cannot change/);
    expect(freezeGeometry({ trailingBase: 5 }).trailingBase).toBe(5);
  });
});

describe('materialization mode (item 9)', () => {
  afterEach(() => {
    setMaterializationMode('recipe');
  });

  it('recipe mode forbids failed-VM extraction; devOracle allows converge repairs', () => {
    setMaterializationMode('recipe');
    expect(getMaterializationMode()).toBe('recipe');
    expect(isVmValidationOnly()).toBe(true);
    expect(() => assertRecipeModeDoesNotProbe('extractFromFailedVm')).toThrow(/forbids/);
    setMaterializationMode('devOracle');
    expect(isVmValidationOnly()).toBe(false);
    expect(() => assertRecipeModeDoesNotProbe('extractFromFailedVm')).not.toThrow();
  });
});

describe('stable ids (item 7)', () => {
  it('joins by id only — diagnostic names do not affect equality', async () => {
    const { requireStableId, stableIdsEqual, stableJoinKey } = await import(
      '../../src/message-bus/stable-ids.js'
    );
    const a = requireStableId('handler', 'h-1', 'reset');
    const b = requireStableId('handler', 'h-1', 'foobar');
    expect(stableIdsEqual(a, b)).toBe(true);
    expect(stableJoinKey(a)).toBe(stableJoinKey(b));
    expect(() => requireStableId('callsite', undefined, 'poke')).toThrow(/missing/);
  });
});

describe('planning phases (item 11)', () => {
  it('advances sequentially with frozen payloads', async () => {
    const { startPhase, advancePhase, assertGeometryFrozen } = await import(
      '../../src/message-bus/planning-phases.js'
    );
    const start = startPhase({ source: 'x' });
    const ir = advancePhase(start, 'admittedHandlerIr', (p) => ({ ...p, handlers: ['a'] }));
    const plan = advancePhase(ir, 'symbolicResourcePlan', (p) => ({ ...p, claims: 1 }));
    const layout = advancePhase(plan, 'absoluteLayout', (p) => ({ ...p, base: 0 }));
    expect(() => assertGeometryFrozen(layout.phase)).not.toThrow();
    expect(() => advancePhase(start, 'absoluteLayout', (p) => p)).toThrow(/sequential/);
  });
});
