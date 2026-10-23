import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import {
  MessageBusDiagnosticError,
  parseCompositionPlanFailureTrailer,
} from '../../src/message-bus/diagnostics.js';
import {
  assertAndSettleExecutionContexts,
  buildExecutionContextSettleFailureReport,
  buildKernelExecutionContext,
  createExecutionContextLifecycle,
  executionContextJournalKey,
  planEffectsUnderLifecycle,
  registerExecutionContextOnSettlement,
} from '../../src/message-bus/execution-context.js';
import type { PublishedPathEffectSchedule } from '../../src/message-bus/path-effect-schedule.js';
import {
  CompositionSettlementSession,
  createCompositionSettlementSession,
} from '../../src/stateful/value-chunk-persist.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  suppressWarnings: true,
} as const;

/**
 * Path-effect activation and settle-time ExecutionContext lifecycle:
 * register → assert → settle (freeze).
 */
describe('path-effect activation/settle-time ExecutionContext ExecutionContext settle-time lifecycle', () => {
  const storeSource = `contract Store() {
    mapping(int => bytes) left;
    mapping(int => bytes) right;
    function set(int key, bytes leftValue, bytes rightValue, bool writeRight) public {
      this.left[key] = leftValue;
      if (writeRight) {
        this.right[key] = rightValue;
      }
      require(true);
    }
  }`;

  it('register → assertAll → settle freezes contexts on a composition session', () => {
    const artifact = compileString(storeSource, KERNEL);
    const handler = artifact.messageBus?.handlers?.find((candidate) => candidate.name === 'set');
    expect(handler?.eligible).toBe(true);
    const schedule = handler?.pathEffectSchedule as PublishedPathEffectSchedule | undefined;
    expect(schedule?.version).toBe(1);

    const session = createCompositionSettlementSession();
    expect(session).toBeInstanceOf(CompositionSettlementSession);
    expect(session.executionContexts.getPhase()).toBe('open');

    const context = buildKernelExecutionContext({
      handlerId: handler!.selector,
      handlerName: 'set',
      inputs: handler!.inputs,
      args: [3n, new Uint8Array(4), new Uint8Array(4), false],
      pathEffectSchedule: schedule,
    });
    session.executionContexts.register(context);
    expect(session.executionContexts.getPhase()).toBe('bound');
    expect(session.executionContexts.get(handler!.selector)?.handlerName).toBe('set');

    const asserted = session.executionContexts.assertAll();
    expect(asserted.ok).toBe(true);
    expect(session.executionContexts.getPhase()).toBe('asserted');
    expect(asserted.activeByHandler.get(handler!.selector)?.length).toBeGreaterThan(0);

    session.executionContexts.settle();
    expect(session.executionContexts.getPhase()).toBe('settled');
    expect(() => session.executionContexts.register(context)).toThrow(/cannot register after settle/);
    expect(() => session.executionContexts.assertAll()).toThrow(/cannot assert after settle/);

    // writeRight=false ⇒ fewer active state writes than true would.
    const activeTrue = buildKernelExecutionContext({
      handlerId: `${handler!.selector}-true`,
      handlerName: 'set',
      inputs: handler!.inputs,
      args: [3n, new Uint8Array(4), new Uint8Array(4), true],
      pathEffectSchedule: schedule,
    });
    const lifecycle = createExecutionContextLifecycle();
    lifecycle.register(context);
    lifecycle.register(activeTrue);
    const both = lifecycle.assertAll();
    expect(both.ok).toBe(true);
    const inactiveWrites = lifecycle.activeStateWrites(handler!.selector);
    const activeWrites = lifecycle.activeStateWrites(`${handler!.selector}-true`);
    expect(inactiveWrites.length).toBeLessThan(activeWrites.length);
  });

  it('settle without assertAll fails closed when contexts are registered', () => {
    const lifecycle = createExecutionContextLifecycle();
    lifecycle.register(buildKernelExecutionContext({
      handlerId: 'h1',
      inputs: [{ name: 'x', type: 'int' }],
      args: [1n],
    }));
    expect(() => lifecycle.settle()).toThrow(/settle requires assertAll/);
  });

  it('assertAll fails closed on OOB path-effect handlerInput and blocks settle', () => {
    const lifecycle = createExecutionContextLifecycle();
    lifecycle.register(buildKernelExecutionContext({
      handlerId: 'h-bad',
      inputs: [{ name: 'flag', type: 'bool' }],
      args: [true],
      pathEffectSchedule: {
        version: 1,
        effects: [{
          ordinal: 0,
          kind: 'stateWrite',
          resultType: 'bytes',
          activation: { kind: 'handlerInput', inputIndex: 4 },
        }],
      },
    }));
    const asserted = lifecycle.assertAll();
    expect(asserted.ok).toBe(false);
    expect(asserted.failures.some((failure) => failure.invariantId === 'path-effect-oob-handler-input'))
      .toBe(true);
    expect(() => lifecycle.settle()).toThrow(/settle requires assertAll|missing assert/);
  });

  it('session.clear() resets execution context lifecycle', () => {
    const session = createCompositionSettlementSession();
    session.executionContexts.register(buildKernelExecutionContext({
      handlerId: 'h-clear',
      inputs: [{ name: 'x', type: 'int' }],
      args: [1n],
    }));
    expect(session.executionContexts.getPhase()).toBe('bound');
    session.clear();
    expect(session.executionContexts.getPhase()).toBe('open');
    expect(session.executionContexts.list()).toHaveLength(0);
  });

  it('empty lifecycle settles without register (legacy compositions)', () => {
    const lifecycle = createExecutionContextLifecycle();
    expect(lifecycle.assertAll().ok).toBe(true);
    lifecycle.settle();
    expect(lifecycle.getPhase()).toBe('settled');
  });

  it('multi-participant journals isolate same handlerId under distinct participantIndex', () => {
    const schedule: PublishedPathEffectSchedule = {
      version: 1,
      effects: [{
        ordinal: 0,
        kind: 'stateWrite',
        resultType: 'bytes',
        activation: { kind: 'boolParam', name: 'writeRight' },
      }],
    };
    const lifecycle = createExecutionContextLifecycle();
    const left = buildKernelExecutionContext({
      handlerId: 'set',
      handlerName: 'set',
      participantIndex: 0,
      inputs: [{ name: 'writeRight', type: 'bool' }],
      args: [false],
      pathEffectSchedule: schedule,
    });
    const right = buildKernelExecutionContext({
      handlerId: 'set',
      handlerName: 'set',
      participantIndex: 1,
      inputs: [{ name: 'writeRight', type: 'bool' }],
      args: [true],
      pathEffectSchedule: schedule,
    });
    lifecycle.register(left);
    lifecycle.register(right);

    const leftKey = executionContextJournalKey(left);
    const rightKey = executionContextJournalKey(right);
    expect(leftKey).toBe('s0:p0:set');
    expect(rightKey).toBe('s0:p1:set');
    expect(leftKey).not.toBe(rightKey);

    expect(lifecycle.list()).toHaveLength(2);
    expect(lifecycle.listForParticipant(0)).toHaveLength(1);
    expect(lifecycle.listForParticipant(1)).toHaveLength(1);
    expect(lifecycle.getByJournalKey(leftKey)?.args[0]).toBe(false);
    expect(lifecycle.getByJournalKey(rightKey)?.args[0]).toBe(true);
    // Ambiguous handlerId lookup stays undefined when multiple participants bind it.
    expect(lifecycle.get('set')).toBeUndefined();

    const asserted = lifecycle.assertAll();
    expect(asserted.ok).toBe(true);
    expect(asserted.activeByJournalKey.get(leftKey)).toEqual([]);
    expect(asserted.activeByJournalKey.get(rightKey)?.map((effect) => effect.ordinal)).toEqual([0]);
    expect(lifecycle.activeStateWritesByJournalKey(leftKey)).toHaveLength(0);
    expect(lifecycle.activeStateWritesByJournalKey(rightKey)).toEqual([0]);

    lifecycle.settle();
    const kinds = lifecycle.journal().map((event) => event.kind);
    expect(kinds).toEqual([
      'register', 'register', 'assert', 'assert', 'settle',
    ]);
    expect(lifecycle.journal().filter((event) => event.kind === 'register')
      .map((event) => event.journalKey)).toEqual([leftKey, rightKey]);
  });

  it('keeps repeated handler rows distinct and refreshes only the rematerialized row', () => {
    const lifecycle = createExecutionContextLifecycle();
    const params = {
      handlerId: 'emitMaybe',
      participantIndex: 3,
      inputs: [{ name: 'emitIt', type: 'bool' }],
      pathEffectSchedule: {
        version: 1,
        effects: [{
          ordinal: 1_000_000,
          kind: 'event',
          resultType: 'bytes',
          activation: { kind: 'handlerInput', inputIndex: 0 },
        }],
      } as PublishedPathEffectSchedule,
    };
    registerExecutionContextOnSettlement(lifecycle, { ...params, rowIndex: 0, args: [true] });
    registerExecutionContextOnSettlement(lifecycle, { ...params, rowIndex: 1, args: [false] });
    expect(planEffectsUnderLifecycle(lifecycle).map((plan) => ({
      key: plan.journalKey, events: plan.activeEvents,
    }))).toEqual([
      { key: 's0:p3:r0:emitMaybe', events: [1_000_000] },
      { key: 's0:p3:r1:emitMaybe', events: [] },
    ]);
    expect(lifecycle.get('emitMaybe')).toBeUndefined();
    expect(lifecycle.assertAll().ok).toBe(true);

    registerExecutionContextOnSettlement(lifecycle, { ...params, rowIndex: 0, args: [false] });
    expect(lifecycle.getPhase()).toBe('bound');
    expect(planEffectsUnderLifecycle(lifecycle).map((plan) => plan.activeEvents)).toEqual([[], []]);
    expect(lifecycle.list()).toHaveLength(2);
    assertAndSettleExecutionContexts(lifecycle);
    expect(lifecycle.getPhase()).toBe('settled');
  });

  it('nested-compose scopes stamp nestedScopeId and journal push/pop', () => {
    const lifecycle = createExecutionContextLifecycle();
    lifecycle.register(buildKernelExecutionContext({
      handlerId: 'root',
      inputs: [{ name: 'x', type: 'int' }],
      args: [1n],
      participantIndex: 0,
    }));
    expect(lifecycle.currentNestedScope()).toBe(0);

    const scopeA = lifecycle.pushNestedScope();
    expect(scopeA).toBe(1);
    expect(lifecycle.currentNestedScope()).toBe(1);
    lifecycle.register(buildKernelExecutionContext({
      handlerId: 'child',
      inputs: [{ name: 'y', type: 'int' }],
      args: [2n],
      participantIndex: 0,
      // nestedScopeId inherited from current scope
    }));
    expect(lifecycle.getByJournalKey('s1:p0:child')?.handlerId).toBe('child');
    expect(lifecycle.listForScope(1)).toHaveLength(1);
    expect(lifecycle.listForScope(0)).toHaveLength(1);

    const scopeB = lifecycle.pushNestedScope();
    expect(scopeB).toBe(2);
    lifecycle.register(buildKernelExecutionContext({
      handlerId: 'grandchild',
      inputs: [{ name: 'z', type: 'int' }],
      args: [3n],
      participantIndex: 1,
    }));
    expect(lifecycle.listForScope(2)).toHaveLength(1);

    expect(lifecycle.popNestedScope()).toBe(2);
    expect(lifecycle.currentNestedScope()).toBe(1);
    expect(lifecycle.popNestedScope()).toBe(1);
    expect(lifecycle.currentNestedScope()).toBe(0);
    expect(() => lifecycle.popNestedScope()).toThrow(/at root scope/);

    const asserted = lifecycle.assertAll();
    expect(asserted.ok).toBe(true);
    expect(asserted.activeByJournalKey.size).toBe(3);
    lifecycle.settle();

    const kinds = lifecycle.journal().map((event) => event.kind);
    expect(kinds).toContain('push-scope');
    expect(kinds).toContain('pop-scope');
    expect(kinds.filter((kind) => kind === 'register')).toHaveLength(3);
    expect(lifecycle.journal().some((event) =>
      event.kind === 'register' && event.journalKey === 's1:p0:child')).toBe(true);
    expect(lifecycle.journal().some((event) =>
      event.kind === 'register' && event.journalKey === 's2:p1:grandchild')).toBe(true);
  });

  it('pushNestedScope / register fail closed after settle', () => {
    const lifecycle = createExecutionContextLifecycle();
    lifecycle.settle();
    expect(() => lifecycle.pushNestedScope()).toThrow(/after settle/);
    expect(() => lifecycle.register(buildKernelExecutionContext({
      handlerId: 'late',
      inputs: [{ name: 'x', type: 'int' }],
      args: [1n],
    }))).toThrow(/after settle/);
  });

  it('assertAndSettle throws structured plan-failure planFailure-shaped ExecutionContext settle diagnostics', () => {
    const lifecycle = createExecutionContextLifecycle();
    lifecycle.register(buildKernelExecutionContext({
      handlerId: 'h-bad',
      participantIndex: 2,
      nestedScopeId: 1,
      inputs: [{ name: 'flag', type: 'bool' }],
      args: [true],
      pathEffectSchedule: {
        version: 1,
        effects: [{
          ordinal: 7,
          kind: 'stateWrite',
          resultType: 'bytes',
          activation: { kind: 'handlerInput', inputIndex: 9 },
        }],
      },
    }));

    let caught: unknown;
    try {
      assertAndSettleExecutionContexts(lifecycle);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MessageBusDiagnosticError);
    const diagnostic = caught as MessageBusDiagnosticError;
    expect(diagnostic.code).toBe('L3_EXECUTION_CONTEXT');
    expect(diagnostic.planFailure?.kind).toBe('execution-context');
    expect(diagnostic.planFailure?.invariantId).toBe('path-effect-oob-handler-input');
    expect(diagnostic.planFailure?.participant).toBe(2);
    expect(diagnostic.planFailure?.handler).toBe('h-bad');
    expect(diagnostic.planFailure?.expected).toBe('s1:p2:h-bad');
    expect(diagnostic.message).toContain('plan-failure=');
    expect(diagnostic.message).toContain('journal=');

    const trailer = parseCompositionPlanFailureTrailer(diagnostic.message);
    expect(trailer?.kind).toBe('execution-context');
    expect(trailer?.code).toBe('L3_EXECUTION_CONTEXT');
    expect(trailer?.participant).toBe(2);

    const report = buildExecutionContextSettleFailureReport([{
      invariantId: 'path-effect-oob-handler-input',
      detail: 's1:p2:h-bad: effect 7 handlerInput 9 outside frame arity 1',
      journalKey: 's1:p2:h-bad',
      handlerId: 'h-bad',
      participantIndex: 2,
      nestedScopeId: 1,
      ordinal: 7,
    }], { journalSummary: lifecycle.journal() });
    expect(report.kind).toBe('execution-context');
    expect(report.detail).toContain('journal=[');
  });
});
