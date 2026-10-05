import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { graphSemanticDerivationCeiling } from '../../src/message-bus/semantic-derivation-budget.js';

const kernel = (ceiling?: number): Pick<Artifact, 'messageBus'> => ({
  messageBus: { convention: 'kernel-row-loop', resourceBudgets: ceiling === undefined
    ? undefined : { maximumSemanticDerivationPasses: ceiling } },
} as Pick<Artifact, 'messageBus'>);

describe('graph semantic derivation budget', () => {
  it('sums participant claim capacities with one shared assembly/confirmation allowance', () => {
    expect(graphSemanticDerivationCeiling([kernel(5)])).toBe(5);
    expect(graphSemanticDerivationCeiling([kernel(5), kernel(7)])).toBe(10);
    expect(graphSemanticDerivationCeiling([kernel(7), kernel(5)])).toBe(10);
    expect(graphSemanticDerivationCeiling([kernel(3129), kernel(3129)])).toBe(6256);
  });

  it('retains legacy artifacts without inventing an aggregate ceiling', () => {
    expect(graphSemanticDerivationCeiling([{}, kernel(5)])).toBeUndefined();
  });

  it.each([undefined, 0, 1, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects a missing or invalid kernel ceiling (%s), even after a legacy participant', (ceiling) => {
      expect(() => graphSemanticDerivationCeiling([{}, kernel(ceiling)])).toThrow(/maximumSemanticDerivationPasses/);
    },
  );

  it('rejects unsafe aggregate arithmetic', () => {
    expect(() => graphSemanticDerivationCeiling([kernel(Number.MAX_SAFE_INTEGER), kernel(3)]))
      .toThrow(/overflow/);
  });
});
