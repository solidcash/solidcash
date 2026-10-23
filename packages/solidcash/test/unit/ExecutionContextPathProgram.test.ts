import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import {
  activeStateWriteOrdinalsUnderContext,
  allowsWriteUnderExecutionContext,
  assertExecutionContextPathProgram,
  buildKernelExecutionContext,
  createExecutionContextLifecycle,
  planEffectsUnderExecutionContext,
  planEffectsUnderLifecycle,
} from '../../src/message-bus/execution-context.js';
import type { PublishedPathEffectSchedule } from '../../src/message-bus/path-effect-schedule.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  suppressWarnings: true,
} as const;

/**
 * Typed ExecutionContext binds handler-frame ABI to the published
 * pathEffectSchedule at activation and settle time.
 */
describe('path-effect activation/settle-time ExecutionContext ExecutionContext path programs', () => {
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

  it('builds a context whose active state writes follow writeRight under the published schedule', () => {
    const artifact = compileString(storeSource, KERNEL);
    const handler = artifact.messageBus?.handlers?.find((candidate) => candidate.name === 'set');
    expect(handler?.eligible).toBe(true);
    const schedule = handler?.pathEffectSchedule as PublishedPathEffectSchedule | undefined;
    expect(schedule?.version).toBe(1);

    const inactive = buildKernelExecutionContext({
      handlerId: handler!.selector,
      handlerName: 'set',
      inputs: handler!.inputs,
      args: [3n, new Uint8Array(4), new Uint8Array(4), false],
      pathEffectSchedule: schedule,
    });
    const active = buildKernelExecutionContext({
      handlerId: handler!.selector,
      handlerName: 'set',
      inputs: handler!.inputs,
      args: [3n, new Uint8Array(4), new Uint8Array(4), true],
      pathEffectSchedule: schedule,
    });

    const inactiveProof = assertExecutionContextPathProgram(inactive);
    const activeProof = assertExecutionContextPathProgram(active);
    expect(inactiveProof.ok).toBe(true);
    expect(activeProof.ok).toBe(true);
    expect(inactiveProof.activeEffects.length).toBeLessThan(activeProof.activeEffects.length);
    expect(activeStateWriteOrdinalsUnderContext(inactive).length)
      .toBeLessThan(activeStateWriteOrdinalsUnderContext(active).length);

    const right = artifact.abi.find((fn) => fn.name === 'set')
      ?.entryAccesses?.find((access) => access.collection === 'right');
    const left = artifact.abi.find((fn) => fn.name === 'set')
      ?.entryAccesses?.find((access) => access.collection === 'left');
    expect(allowsWriteUnderExecutionContext(inactive, right?.mutationEffectOrdinals)).toBe(false);
    expect(allowsWriteUnderExecutionContext(active, right?.mutationEffectOrdinals)).toBe(true);
    expect(allowsWriteUnderExecutionContext(inactive, left?.mutationEffectOrdinals)).toBe(true);
  });

  it('fail-closes when a schedule handlerInput is outside the frame arity', () => {
    const context = buildKernelExecutionContext({
      handlerId: 'h-bad',
      handlerName: 'bad',
      inputs: [{ name: 'flag', type: 'bool' }],
      args: [true],
      pathEffectSchedule: {
        version: 1,
        effects: [{
          ordinal: 0,
          kind: 'stateWrite',
          resultType: 'bytes',
          activation: { kind: 'handlerInput', inputIndex: 9 },
        }],
      },
    });
    const proof = assertExecutionContextPathProgram(context);
    expect(proof.ok).toBe(false);
    expect(proof.failures.some((failure) => failure.invariantId === 'path-effect-oob-handler-input'))
      .toBe(true);
  });

  it('fail-closes when a boolParam activation names a missing frame argument', () => {
    const context = buildKernelExecutionContext({
      handlerId: 'h-missing',
      inputs: [{ name: 'x', type: 'int' }],
      args: [1n],
      pathEffectSchedule: {
        version: 1,
        effects: [{
          ordinal: 0,
          kind: 'stateWrite',
          resultType: 'bytes',
          activation: { kind: 'boolParam', name: 'writeRight' },
        }],
      },
    });
    const proof = assertExecutionContextPathProgram(context);
    expect(proof.ok).toBe(false);
    expect(proof.failures.some((failure) => failure.invariantId === 'path-effect-unknown-bool-param'))
      .toBe(true);
  });

  it('settle-time ExecutionContext: planEffectsUnderExecutionContext / lifecycle aggregate active writes/events/transfers', () => {
    const artifact = compileString(storeSource, KERNEL);
    const handler = artifact.messageBus?.handlers?.find((candidate) => candidate.name === 'set');
    const schedule = handler?.pathEffectSchedule as PublishedPathEffectSchedule | undefined;
    const active = buildKernelExecutionContext({
      handlerId: handler!.selector,
      handlerName: 'set',
      participantIndex: 0,
      inputs: handler!.inputs,
      args: [3n, new Uint8Array(4), new Uint8Array(4), true],
      pathEffectSchedule: schedule,
    });
    const plan = planEffectsUnderExecutionContext(active);
    expect(plan.handlerId).toBe(handler!.selector);
    expect(plan.participantIndex).toBe(0);
    expect(plan.activeWrites.length).toBeGreaterThan(0);
    expect(plan.activeWrites).toEqual(activeStateWriteOrdinalsUnderContext(active));

    const lifecycle = createExecutionContextLifecycle();
    lifecycle.register(active);
    const inactive = buildKernelExecutionContext({
      handlerId: handler!.selector,
      handlerName: 'set',
      participantIndex: 1,
      inputs: handler!.inputs,
      args: [3n, new Uint8Array(4), new Uint8Array(4), false],
      pathEffectSchedule: schedule,
    });
    lifecycle.register(inactive);
    const plans = planEffectsUnderLifecycle(lifecycle);
    expect(plans).toHaveLength(2);
    expect(plans[0]!.activeWrites.length).toBeGreaterThan(plans[1]!.activeWrites.length);
  });
});
