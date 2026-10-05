import { ATOMIC_MESSAGE_BUS_MAX_ROWS, type ExternalCallIterationDomainAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';

/** Exact iteration domain of a compiler-described affine pre-test loop, before filtering call guards. */
export function externalCallIterationIndices(
  domain: ExternalCallIterationDomainAbi,
  evaluate: (
    expression: ExternalCallIterationDomainAbi['initialValue'], bindings: ReadonlyMap<string, bigint>,
  ) => FunctionArgument | undefined,
): number[] {
  if (!domain.counterName || !Number.isSafeInteger(domain.maximumIterations)
    || domain.maximumIterations < 0 || domain.maximumIterations > ATOMIC_MESSAGE_BUS_MAX_ROWS) {
    throw new Error('External-call iteration domain has an invalid compiler maximum or counter');
  }
  const empty = new Map<string, bigint>();
  const initial = evaluate(domain.initialValue, empty);
  const step = evaluate(domain.stepValue, empty);
  if (typeof initial !== 'bigint' || typeof step !== 'bigint' || step === 0n) {
    throw new Error('External-call iteration domain requires an integer initial value and a nonzero invariant step');
  }
  const indices: number[] = [];
  for (let index = 0; ; index += 1) {
    const bindings = new Map([[domain.counterName, initial + BigInt(index) * step]]);
    const continuing = evaluate(domain.continueCondition, bindings);
    if (typeof continuing !== 'boolean') {
      throw new Error('External-call iteration condition did not resolve to a boolean');
    }
    if (!continuing) return indices;
    if (index >= domain.maximumIterations) {
      throw new Error('External-call iteration domain exceeds its compiler maximum');
    }
    indices.push(index);
  }
}
