import { describe, expect, it } from 'vitest';
import { foldChunkableResource, type ResourceFoldPlan } from '../../src/message-bus/resource-fold.js';

describe('resource-fold', () => {
  const concat = (encoded: Uint8Array, element: Uint8Array): Uint8Array => (
    Uint8Array.from([...encoded, ...element])
  );

  it('folds two pushes into leading + complete', () => {
    const plan: ResourceFoldPlan = {
      collection: 'events',
      initialSource: 'empty',
      steps: [
        { kind: 'push', rowSelector: 'rowA', effectOrdinal: 0 },
        { kind: 'push', rowSelector: 'rowB', effectOrdinal: 1 },
      ],
      leadingWitness: '__internal__leading_events',
      completeWitness: '__internal__complete_events',
    };
    const result = foldChunkableResource(plan, {
      emptyValue: () => new Uint8Array(),
      appendElement: concat,
      resolveElement: (step) => (
        step.rowSelector === 'rowA' ? Uint8Array.from([1]) : Uint8Array.from([2])
      ),
    });
    expect([...result.leading!]).toEqual([1]);
    expect([...result.complete]).toEqual([1, 2]);
    expect(result.activeSteps).toHaveLength(2);
  });

  it('skips inactive steps via activation predicate', () => {
    const plan: ResourceFoldPlan = {
      collection: 'events',
      initialSource: 'empty',
      steps: [
        { kind: 'push', rowSelector: 'rowA', activation: 'writeSecond' },
        { kind: 'push', rowSelector: 'rowB', activation: 'writeSecond' },
      ],
    };
    const result = foldChunkableResource(plan, {
      isActive: (step) => step.rowSelector === 'rowA',
      emptyValue: () => new Uint8Array(),
      appendElement: concat,
      resolveElement: () => Uint8Array.from([9]),
    });
    expect(result.leading).toBeUndefined();
    expect([...result.complete]).toEqual([9]);
    expect(result.activeSteps).toHaveLength(1);
  });

  it('fail-closes when an active element cannot be resolved', () => {
    const plan: ResourceFoldPlan = {
      collection: 'events',
      initialSource: 'empty',
      steps: [{ kind: 'push', rowSelector: 'rowA' }],
    };
    expect(() => foldChunkableResource(plan, {
      emptyValue: () => new Uint8Array(),
      appendElement: concat,
      resolveElement: () => undefined,
    })).toThrow(/cannot evaluate element/);
  });
});
