import { describe, expect, it } from 'vitest';
import {
  buildKernelExecutionContext,
  createExecutionContextLifecycle,
  executionContextJournalKey,
} from '../../src/message-bus/execution-context.js';
import {
  applyResourceFoldStep,
  evaluateFoldActivation,
  findPublishedResourceFoldPlan,
  foldChunkableResource,
  instantiateResourceFoldPlan,
  type PublishedResourceFoldPlanSummary,
  type ResourceFoldPlan,
} from '../../src/message-bus/resource-fold.js';
import {
  buildChunkablePushFoldPlan,
  createFoldRowActivationEnvResolver,
  foldActivationEnvironmentFromRouteRow,
  foldLeadingRouteArrayPushes,
} from '../../src/stateful/StatefulContract.js';
import type { RouteExpressionKeyRow } from '../../src/stateful/route-expression-key.js';

/**
 * published resource-fold plan: published `resourceFoldPlans` are fold authority when present.
 * Removing / missing a published plan fails closed; rediscovery is legacy-only when absent.
 */
describe('published resource-fold plan published resourceFoldPlans authority', () => {
  const concat = (encoded: Uint8Array, element: Uint8Array): Uint8Array => (
    Uint8Array.from([...encoded, ...element])
  );

  const publishedPush: PublishedResourceFoldPlanSummary = {
    collection: 'events',
    initialSource: 'empty',
    leadingWitness: '__internal__leadingPushValue',
    completeWitness: '__internal__completePushValue',
    stepKind: 'push',
  };

  it('instantiateResourceFoldPlan stamps every step with the published stepKind', () => {
    const plan = instantiateResourceFoldPlan(publishedPush, [
      { rowSelector: 'k', effectOrdinal: 0, elementRecipeId: 'row-0' },
      { rowSelector: 'k', effectOrdinal: 1, elementRecipeId: 'row-1' },
    ]);
    expect(plan.collection).toBe('events');
    expect(plan.initialSource).toBe('empty');
    expect(plan.leadingWitness).toBe('__internal__leadingPushValue');
    expect(plan.completeWitness).toBe('__internal__completePushValue');
    expect(plan.steps.every((step) => step.kind === 'push')).toBe(true);
    expect(plan.steps).toHaveLength(2);
  });

  it('path-effect activation: published activationSchedule fills missing step activations by effectOrdinal', () => {
    const publishedWithSchedule: PublishedResourceFoldPlanSummary = {
      ...publishedPush,
      activationSchedule: {
        version: 1,
        effects: [
          {
            effectOrdinal: 0,
            activation: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
          },
          {
            effectOrdinal: 1,
            activation: {
              kind: 'unary',
              operator: '!',
              expression: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
            },
          },
        ],
      },
    };
    const plan = instantiateResourceFoldPlan(publishedWithSchedule, [
      { rowSelector: 'a', effectOrdinal: 0 },
      { rowSelector: 'b', effectOrdinal: 1 },
    ]);
    expect(plan.steps.map((step) => step.activation)).toEqual([
      { kind: 'handlerInput', inputIndex: 1 },
      { kind: 'not', of: { kind: 'handlerInput', inputIndex: 1 } },
    ]);
    // Shell-provided activation wins over schedule.
    const overridden = instantiateResourceFoldPlan(publishedWithSchedule, [
      { rowSelector: 'a', effectOrdinal: 0, activation: 'writeRight' },
      { rowSelector: 'b', effectOrdinal: 1 },
    ]);
    expect(overridden.steps[0]?.activation).toEqual({ kind: 'boolParam', name: 'writeRight' });
    expect(overridden.steps[1]?.activation).toEqual({
      kind: 'not', of: { kind: 'handlerInput', inputIndex: 1 },
    });
  });

  it('foldChunkableResource driven by a published push plan yields leading + complete', () => {
    const plan = instantiateResourceFoldPlan(publishedPush, [
      { rowSelector: 'rowA', effectOrdinal: 0 },
      { rowSelector: 'rowB', effectOrdinal: 1 },
    ]);
    const result = foldChunkableResource(plan, {
      emptyValue: () => new Uint8Array(),
      appendElement: concat,
      resolveElement: (step) => (
        step.rowSelector === 'rowA' ? Uint8Array.from([1]) : Uint8Array.from([2])
      ),
    });
    expect([...result.leading!]).toEqual([1]);
    expect([...result.complete]).toEqual([1, 2]);
  });

  it('assign replaces rather than appends (honest transition algebra)', () => {
    const plan: ResourceFoldPlan = {
      collection: 'slot',
      initialSource: 'empty',
      steps: [
        { kind: 'assign', rowSelector: 'a' },
        { kind: 'assign', rowSelector: 'b' },
      ],
    };
    const result = foldChunkableResource(plan, {
      emptyValue: () => Uint8Array.from([0xff]),
      appendElement: concat,
      resolveElement: (step) => (
        step.rowSelector === 'a' ? Uint8Array.from([1, 2]) : Uint8Array.from([9])
      ),
    });
    // Leading is first assign result; complete is second assign (replace), never concat.
    expect([...result.leading!]).toEqual([1, 2]);
    expect([...result.complete]).toEqual([9]);
  });

  it('update fails closed without updateElement applicator', () => {
    expect(() => applyResourceFoldStep(
      Uint8Array.from([1]),
      { kind: 'update', rowSelector: 'u' },
      Uint8Array.from([2]),
      { appendElement: concat },
    )).toThrow(/update step requires updateElement/);

    expect(() => foldChunkableResource({
      collection: 'slot',
      initialSource: 'empty',
      steps: [
        { kind: 'push', rowSelector: 'a' },
        { kind: 'update', rowSelector: 'b' },
      ],
    }, {
      emptyValue: () => new Uint8Array(),
      appendElement: concat,
      resolveElement: () => Uint8Array.from([7]),
    })).toThrow(/update step requires updateElement/);
  });

  it('update applies when updateElement is provided', () => {
    const result = foldChunkableResource({
      collection: 'slot',
      initialSource: 'empty',
      steps: [
        { kind: 'assign', rowSelector: 'a' },
        { kind: 'update', rowSelector: 'b' },
      ],
    }, {
      emptyValue: () => new Uint8Array(),
      appendElement: concat,
      updateElement: (encoded, element) => Uint8Array.from([...encoded, 0xaa, ...element]),
      resolveElement: (step) => (
        step.rowSelector === 'a' ? Uint8Array.from([1]) : Uint8Array.from([2])
      ),
    });
    expect([...result.leading!]).toEqual([1]);
    expect([...result.complete]).toEqual([1, 0xaa, 2]);
  });

  it('findPublishedResourceFoldPlan matches collection; miss returns undefined', () => {
    const plans = [publishedPush];
    expect(findPublishedResourceFoldPlan(plans, 'events')).toEqual(publishedPush);
    expect(findPublishedResourceFoldPlan(plans, 'missing')).toBeUndefined();
    expect(findPublishedResourceFoldPlan(undefined, 'events')).toBeUndefined();
  });

  it('buildChunkablePushFoldPlan fails closed when published list omits the collection', () => {
    expect(() => buildChunkablePushFoldPlan({
      rowArguments: [],
      collection: 'events',
      valueType: 'int[]',
      structs: [],
      // Artifact stamped resourceFoldPlans but for a different collection only.
      publishedFoldPlans: [{
        collection: 'other',
        initialSource: 'empty',
        stepKind: 'push',
        leadingWitness: '__internal__leadingPushValue',
        completeWitness: '__internal__completePushValue',
      }],
    })).toThrow(/no plan for collection 'events'/);
  });

  it('buildChunkablePushFoldPlan rediscovers when publishedFoldPlans is absent', () => {
    // No rows ⇒ undefined (cannot fold); must not throw fail-closed.
    expect(buildChunkablePushFoldPlan({
      rowArguments: [],
      collection: 'events',
      valueType: 'int[]',
      structs: [],
    })).toBeUndefined();
  });

  it('removing publishedFoldPlans changes outcome: prefer path throws, absent path does not', () => {
    const base = {
      rowArguments: [] as const,
      collection: 'events',
      valueType: 'int[]',
      structs: [] as const,
    };
    expect(() => buildChunkablePushFoldPlan({
      ...base,
      publishedFoldPlans: [],
    })).toThrow(/no plan for collection 'events'/);
    expect(buildChunkablePushFoldPlan(base)).toBeUndefined();
    expect(foldLeadingRouteArrayPushes(base)).toBeUndefined();
  });

  it('published assign stepKind forces replace algebra through instantiateResourceFoldPlan', () => {
    const publishedAssign: PublishedResourceFoldPlanSummary = {
      collection: 'slot',
      initialSource: 'empty',
      stepKind: 'assign',
      leadingWitness: '__internal__leadingPushValue',
      completeWitness: '__internal__completePushValue',
    };
    const plan = instantiateResourceFoldPlan(publishedAssign, [
      { rowSelector: 'a' },
      { rowSelector: 'b' },
    ]);
    expect(plan.steps.map((s) => s.kind)).toEqual(['assign', 'assign']);
    const folded = foldChunkableResource(plan, {
      emptyValue: () => new Uint8Array(),
      appendElement: concat,
      resolveElement: (step) => (
        step.rowSelector === 'a' ? Uint8Array.from([10, 11]) : Uint8Array.from([20])
      ),
    });
    expect([...folded.complete]).toEqual([20]);
  });

  it('path-effect activation: route fold stamps entry-access ECE activations and gates via resolveRowActivationEnv', () => {
    const makeRow = (
      writeRight: boolean,
      activation?: { kind: string; operator?: string; expression?: object; source?: object },
    ): RouteExpressionKeyRow => ({
      args: [1n, writeRight],
      handler: {
        name: 'push',
        inputs: [
          { name: 'key', type: 'int256' },
          { name: 'writeRight', type: 'bool' },
        ],
        entryAccesses: [{
          collection: 'events',
          keyParams: ['key'],
          keySources: [{ kind: 'param', paramName: 'key' }],
          operations: ['write'],
          arrayMutation: 'push',
          mutationEffectOrdinals: [0],
          storedElementSource: {
            version: 1,
            mutationEffectOrdinal: 0,
            elementType: 'bytes',
            expression: { kind: 'literal', type: 'bytes', value: '01' },
          },
          ...(activation !== undefined && { activation }),
        }],
      } as RouteExpressionKeyRow['handler'],
    });
    const requireWriteRight = { kind: 'source' as const, source: { kind: 'forward' as const, paramIndex: 1 } };
    const requireNotWriteRight = {
      kind: 'unary' as const,
      operator: '!',
      expression: requireWriteRight,
    };
    const elemA = Uint8Array.of(0xaa);
    const elemB = Uint8Array.of(0xbb);
    const rows = [
      makeRow(false, requireNotWriteRight),
      makeRow(true, requireWriteRight),
    ];

    const built = buildChunkablePushFoldPlan({
      rowArguments: rows,
      collection: 'events',
      valueType: 'bytes[]',
      structs: [],
      resolveElement: (row) => (row === rows[0] ? elemA : elemB),
    });
    expect(built).toBeDefined();
    expect(built!.plan.steps.map((step) => step.activation)).toEqual([
      { kind: 'not', of: { kind: 'handlerInput', inputIndex: 1 } },
      { kind: 'handlerInput', inputIndex: 1 },
    ]);
    expect(built!.rows).toHaveLength(2);

    const folded = foldLeadingRouteArrayPushes({
      rowArguments: rows,
      collection: 'events',
      valueType: 'bytes[]',
      structs: [],
      resolveElement: (row) => (row === rows[0] ? elemA : elemB),
      resolveRowActivationEnv: foldActivationEnvironmentFromRouteRow,
    });
    // Row0 !writeRight with false ⇒ active; row1 writeRight with true ⇒ active.
    expect(folded).toBeDefined();
    expect(folded!.plan.steps[0]?.activation).toEqual({
      kind: 'not', of: { kind: 'handlerInput', inputIndex: 1 },
    });
    expect(folded!.leading).toBeDefined();
    expect(folded!.complete.length).toBeGreaterThan(folded!.leading!.length);

    // Unconditional first row + gated second (writeRight=false) ⇒ only one active step.
    const gatedRows = [
      makeRow(false),
      makeRow(false, requireWriteRight),
    ];
    const gated = foldLeadingRouteArrayPushes({
      rowArguments: gatedRows,
      collection: 'events',
      valueType: 'bytes[]',
      structs: [],
      resolveElement: (row) => (row === gatedRows[0] ? elemA : elemB),
      resolveRowActivationEnv: foldActivationEnvironmentFromRouteRow,
    });
    expect(gated).toBeUndefined();
  });

  it('settle-time ExecutionContext: foldActivationEnvironmentFromRouteRow preserves scalar handlerInputs for handlerInputEq', () => {
    const row: RouteExpressionKeyRow = {
      args: [7n, false],
      selector: '0xdeadbeef',
      handler: {
        name: 'push',
        selector: '0xdeadbeef',
        inputs: [
          { name: 'kind', type: 'int256' },
          { name: 'writeRight', type: 'bool' },
        ],
      } as RouteExpressionKeyRow['handler'],
    };
    const env = foldActivationEnvironmentFromRouteRow(row);
    expect(env.handlerInputs).toEqual([7n, false]);
    expect(env.boolParams).toEqual({ writeRight: false });
    expect(evaluateFoldActivation(
      { kind: 'handlerInputEq', inputIndex: 0, value: '7' },
      env,
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'handlerInputEq', inputIndex: 0, value: '1' },
      env,
    )).toBe(false);
  });

  it('settle-time ExecutionContext: fold route prefers settle-time ExecutionContext.activationEnv over row args', () => {
    const makeRow = (writeRight: boolean): RouteExpressionKeyRow => ({
      args: [1n, writeRight],
      selector: '0xfold01',
      handler: {
        name: 'push',
        selector: '0xfold01',
        inputs: [
          { name: 'key', type: 'int256' },
          { name: 'writeRight', type: 'bool' },
        ],
        entryAccesses: [{
          collection: 'events',
          keyParams: ['key'],
          keySources: [{ kind: 'param', paramName: 'key' }],
          operations: ['write'],
          arrayMutation: 'push',
          mutationEffectOrdinals: [0],
          storedElementSource: {
            version: 1,
            mutationEffectOrdinal: 0,
            elementType: 'bytes',
            expression: { kind: 'literal', type: 'bytes', value: '01' },
          },
          activation: {
            kind: 'source',
            source: { kind: 'forward', paramIndex: 1 },
          },
        }],
      } as RouteExpressionKeyRow['handler'],
    });
    const elemA = Uint8Array.of(0xaa);
    const elemB = Uint8Array.of(0xbb);
    // Row args say writeRight=false for both → without EC override fold is inactive.
    const rows = [makeRow(false), makeRow(false)];
    const withoutContext = foldLeadingRouteArrayPushes({
      rowArguments: rows,
      collection: 'events',
      valueType: 'bytes[]',
      structs: [],
      resolveElement: (row) => (row === rows[0] ? elemA : elemB),
      resolveRowActivationEnv: foldActivationEnvironmentFromRouteRow,
    });
    expect(withoutContext).toBeUndefined();

    // Register settle-time contexts that force writeRight=true for both participant rows.
    const lifecycle = createExecutionContextLifecycle();
    for (const participantIndex of [0, 1]) {
      const context = buildKernelExecutionContext({
        handlerId: '0xfold01',
        handlerName: 'push',
        participantIndex,
        inputs: [
          { name: 'key', type: 'int256' },
          { name: 'writeRight', type: 'bool' },
        ],
        args: [1n, true],
      });
      lifecycle.register(context);
      expect(lifecycle.getByJournalKey(executionContextJournalKey({
        handlerId: '0xfold01',
        participantIndex,
      }))).toBeDefined();
    }

    const withContext = foldLeadingRouteArrayPushes({
      rowArguments: rows,
      collection: 'events',
      valueType: 'bytes[]',
      structs: [],
      resolveElement: (row) => (row === rows[0] ? elemA : elemB),
      resolveRowActivationEnv: createFoldRowActivationEnvResolver({
        lifecycle,
        useActiveSettlement: false,
      }),
    });
    expect(withContext).toBeDefined();
    expect(withContext!.complete.length).toBeGreaterThan(withContext!.leading!.length);

    // Direct env resolve also prefers the registered context.
    const preferred = foldActivationEnvironmentFromRouteRow(rows[0]!, {
      participantIndex: 0,
      lifecycle,
    });
    expect(preferred.handlerInputs?.[1]).toBe(true);
    expect(preferred.boolParams?.writeRight).toBe(true);
  });
});
