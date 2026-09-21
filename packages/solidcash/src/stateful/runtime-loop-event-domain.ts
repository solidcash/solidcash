import type { RuntimeLoopEventAbi, RuntimeLoopIterationDomainAbi } from '@solidcash/utils';

export const RUNTIME_LOOP_EVENT_ITERATION_LIMIT = 64;

type DomainValue = bigint | number | string | boolean | Uint8Array | readonly unknown[] | object;

export type RuntimeLoopDomainEvaluator = (
  expression: RuntimeLoopIterationDomainAbi['initialValue'],
  bindings: ReadonlyMap<string, bigint>,
) => DomainValue | undefined;

export type RuntimeLoopEventRepeatSource =
  | { kind: 'fixed'; count: number }
  | { kind: 'permutation'; parameter: string }
  | { kind: 'iterationDomain'; domain: RuntimeLoopIterationDomainAbi };

/** Validate an artifact's repeat-source union before any transaction outputs are planned. */
export function runtimeLoopEventRepeatSource(loop: RuntimeLoopEventAbi): RuntimeLoopEventRepeatSource {
  const sources = Number(loop.repeatCount !== undefined)
    + Number(loop.permutationParam !== undefined)
    + Number(loop.iterationDomain !== undefined);
  if (sources !== 1) throw new Error('Runtime-loop event metadata must have exactly one repeat source');
  if (loop.repeatCount !== undefined) {
    if (!Number.isSafeInteger(loop.repeatCount) || loop.repeatCount < 0
      || loop.repeatCount > RUNTIME_LOOP_EVENT_ITERATION_LIMIT) {
      throw new Error(`Runtime-loop event repeat count must be between 0 and ${RUNTIME_LOOP_EVENT_ITERATION_LIMIT}`);
    }
    return { kind: 'fixed', count: loop.repeatCount };
  }
  if (loop.permutationParam !== undefined) {
    if (loop.permutationParam.length === 0) {
      throw new Error('Runtime-loop event permutation parameter must be non-empty');
    }
    return { kind: 'permutation', parameter: loop.permutationParam };
  }
  return { kind: 'iterationDomain', domain: loop.iterationDomain! };
}

function integerValue(value: DomainValue | undefined, label: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error(`Runtime-loop event ${label} did not resolve to an integer`);
}

function referencesIdentifier(value: unknown, name: string, seen = new Set<object>()): boolean {
  if (!value || typeof value !== 'object' || seen.has(value as object)) return false;
  seen.add(value as object);
  const record = value as Record<string, unknown>;
  if (record.kind === 'identifier' && record.name === name) return true;
  return Object.values(record).some((child) => Array.isArray(child)
    ? child.some((item) => referencesIdentifier(item, name, seen))
    : referencesIdentifier(child, name, seen));
}

/** Materialize the exact frame values of a bounded affine do-while recurrence. */
export function runtimeLoopEventIterationValues(
  domain: RuntimeLoopIterationDomainAbi,
  evaluate: RuntimeLoopDomainEvaluator,
): bigint[] {
  if (!domain.counterName) throw new Error('Runtime-loop event iteration domain has no counter name');
  if (!Number.isSafeInteger(domain.maximumIterations) || domain.maximumIterations < 1
    || domain.maximumIterations > RUNTIME_LOOP_EVENT_ITERATION_LIMIT) {
    throw new Error(
      `Runtime-loop event iteration maximum must be between 1 and ${RUNTIME_LOOP_EVENT_ITERATION_LIMIT}`,
    );
  }
  // Evaluating a counter-dependent delta once would silently turn a non-affine recurrence into an affine one.
  if (referencesIdentifier(domain.stepValue, domain.counterName)) {
    throw new Error('Runtime-loop event iteration step must be invariant');
  }
  const empty = new Map<string, bigint>();
  const initial = integerValue(evaluate(domain.initialValue, empty), 'iteration initial value');
  const step = integerValue(evaluate(domain.stepValue, empty), 'iteration step');
  if (step === 0n) throw new Error('Runtime-loop event iteration step must be non-zero');

  const values: bigint[] = [];
  let current = initial;
  while (true) {
    values.push(current);
    const bindings = new Map([[domain.counterName, current]]);
    const continuing = evaluate(domain.continueCondition, bindings);
    if (typeof continuing !== 'boolean') {
      throw new Error('Runtime-loop event continuation condition did not resolve to a boolean');
    }
    if (!continuing) return values;
    if (values.length >= domain.maximumIterations) {
      throw new Error('Runtime-loop event iteration domain exceeds its compiler-published maximum');
    }
    current += step;
  }
}
