import type { Artifact, ExternalCallExpression, ExternalCallIterationDomainAbi } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { externalCallIterationIndices } from '../../src/stateful/external-call-iteration-domain.js';
import { evaluateExternalExpression } from '../../src/stateful/sc-evaluate-external-expression.js';

const literal = (value: number): ExternalCallExpression => ({ kind: 'literal', type: 'bigint', value: String(value) });
const domain = (initial: number, step: number, end: number, maximumIterations = 5): ExternalCallIterationDomainAbi => ({
  counterName: 'i', initialValue: literal(initial), stepValue: literal(step), maximumIterations,
  continueCondition: {
    kind: 'binary', operator: step < 0 ? '>' : '<',
    left: { kind: 'identifier', name: 'i' }, right: literal(end),
  },
});
const indices = (value: ExternalCallIterationDomainAbi): number[] => externalCallIterationIndices(
  value, (expression, bindings) => evaluateExternalExpression(
    { resolveExternalArgs: () => undefined }, expression, [], {} as Artifact,
    undefined, undefined, undefined, 0, false, undefined, bindings,
  ),
);

describe('exact external-call iteration domain', () => {
  it('uses the pre-test condition, including an empty domain and nonunit descending steps', () => {
    expect(indices(domain(0, 1, 0, 0))).toEqual([]);
    expect(indices(domain(0, 1, 5))).toEqual([0, 1, 2, 3, 4]);
    expect(indices(domain(9, -2, 2))).toEqual([0, 1, 2, 3]);
  });

  it('rejects a recurrence exceeding the compiler ceiling instead of truncating it', () => {
    expect(() => indices(domain(0, 1, 6))).toThrow(/exceeds its compiler maximum/);
    expect(() => indices(domain(0, 1, 1, 0))).toThrow(/exceeds its compiler maximum/);
  });

  it.each([-1, 1.5, Number.NaN, 65536])('rejects invalid maximum %s', (maximum) => {
    expect(() => indices(domain(0, 1, 1, maximum))).toThrow(/invalid compiler maximum/);
  });

  it('rejects unresolved conditions and zero or counter-dependent steps', () => {
    expect(() => indices({ ...domain(0, 1, 3), continueCondition: { kind: 'identifier', name: 'unknown' } }))
      .toThrow(/did not resolve to a boolean/);
    expect(() => indices(domain(0, 0, 3))).toThrow(/nonzero invariant step/);
    expect(() => indices({ ...domain(0, 1, 3), stepValue: { kind: 'identifier', name: 'i' } }))
      .toThrow(/nonzero invariant step/);
  });
});
