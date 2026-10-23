import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import {
  foldChunkableResource,
  instantiateResourceFoldPlan,
  type PublishedResourceFoldPlanSummary,
} from '../../src/message-bus/resource-fold.js';
import {
  activeEventOrdinalsFromPathEffectSchedule,
  activeOrdinalsFromPathEffectSchedule,
  activeStateWriteOrdinalsFromPathEffectSchedule,
  activeTransferOrdinalsFromPathEffectSchedule,
  filterEmitsUnderPathEffectSchedule,
  filterTransfersUnderPathEffectSchedule,
  pathEffectActivationEnvironmentFromArgs,
  pathEffectEventOrdinal,
  pathEffectScheduleAllowsEffect,
  pathEffectScheduleAllowsWrite,
  pathEffectTransferOrdinal,
  selectActivePathEffects,
  type PublishedPathEffectSchedule,
} from '../../src/message-bus/path-effect-schedule.js';
import {
  activeOrdinalsUnderContext,
  allowsEffectUnderExecutionContext,
  buildKernelExecutionContext,
} from '../../src/message-bus/execution-context.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  suppressWarnings: true,
} as const;

/**
 * path-effect activation: compose-side consumption of published handler pathEffectSchedule.
 * Multi-effect activated schedules drive write selection + fold gating end-to-end.
 */
describe('path-effect activation pathEffectSchedule compose consumption', () => {
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

  it('selectActivePathEffects gates the activated right write from the published schedule', () => {
    const artifact = compileString(storeSource, KERNEL);
    const handler = artifact.messageBus?.handlers?.find((candidate) => candidate.name === 'set');
    expect(handler?.eligible).toBe(true);
    const schedule = handler?.pathEffectSchedule as PublishedPathEffectSchedule | undefined;
    expect(schedule?.version).toBe(1);
    expect(schedule!.effects.filter((effect) => effect.kind === 'stateWrite').length)
      .toBeGreaterThanOrEqual(2);

    const inputs = handler!.inputs;
    const inactiveEnv = pathEffectActivationEnvironmentFromArgs(inputs, [3n, new Uint8Array(4), new Uint8Array(4), false]);
    const activeEnv = pathEffectActivationEnvironmentFromArgs(inputs, [3n, new Uint8Array(4), new Uint8Array(4), true]);

    const inactive = selectActivePathEffects(schedule!, inactiveEnv);
    const active = selectActivePathEffects(schedule!, activeEnv);
    expect(inactive.length).toBeLessThan(active.length);
    expect(activeStateWriteOrdinalsFromPathEffectSchedule(schedule!, inactiveEnv).length)
      .toBeLessThan(activeStateWriteOrdinalsFromPathEffectSchedule(schedule!, activeEnv).length);

    const rightAccess = artifact.abi.find((fn) => fn.name === 'set')
      ?.entryAccesses?.find((access) => access.collection === 'right');
    expect(rightAccess?.mutationEffectOrdinals?.length).toBeGreaterThan(0);
    expect(pathEffectScheduleAllowsWrite({
      schedule,
      mutationEffectOrdinals: rightAccess!.mutationEffectOrdinals,
      env: inactiveEnv,
      fallbackActive: () => true,
    })).toBe(false);
    expect(pathEffectScheduleAllowsWrite({
      schedule,
      mutationEffectOrdinals: rightAccess!.mutationEffectOrdinals,
      env: activeEnv,
      fallbackActive: () => false,
    })).toBe(true);

    const leftAccess = artifact.abi.find((fn) => fn.name === 'set')
      ?.entryAccesses?.find((access) => access.collection === 'left');
    expect(pathEffectScheduleAllowsWrite({
      schedule,
      mutationEffectOrdinals: leftAccess!.mutationEffectOrdinals,
      env: inactiveEnv,
      fallbackActive: () => false,
    })).toBe(true);
  });

  it('pathEffectSchedule fills fold step activations and gates foldChunkableResource', () => {
    const artifact = compileString(`contract Journal() {
      mapping(int => int[]) events;
      function pushMaybe(int key, int value, bool writeIt) public {
        if (writeIt) {
          this.events[key].push(value);
        }
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers?.find((candidate) => candidate.name === 'pushMaybe');
    const foldPlan = artifact.messageBus?.resourceFoldPlans?.find((plan) => plan.collection === 'events');
    const pathEffectSchedule = handler?.pathEffectSchedule as PublishedPathEffectSchedule | undefined;
    expect(foldPlan).toBeDefined();
    expect(pathEffectSchedule?.version).toBe(1);

    const published: PublishedResourceFoldPlanSummary = {
      collection: foldPlan!.collection,
      initialSource: foldPlan!.initialSource,
      leadingWitness: foldPlan!.leadingWitness,
      completeWitness: foldPlan!.completeWitness,
      stepKind: foldPlan!.stepKind,
      ...(foldPlan!.activationSchedule && { activationSchedule: foldPlan!.activationSchedule }),
    };
    const plan = instantiateResourceFoldPlan(
      published,
      [
        { rowSelector: 'a', effectOrdinal: 0 },
        { rowSelector: 'b', effectOrdinal: 0 },
      ],
      pathEffectSchedule,
    );
    expect(plan.steps.every((step) => step.activation !== undefined)).toBe(true);

    const concat = (encoded: Uint8Array, element: Uint8Array): Uint8Array => (
      Uint8Array.from([...encoded, ...element])
    );
    const inactiveEnv = pathEffectActivationEnvironmentFromArgs(
      handler!.inputs, [1n, 9n, false],
    );
    const skipped = foldChunkableResource(plan, {
      activationEnv: inactiveEnv,
      emptyValue: () => new Uint8Array([0xee]),
      appendElement: concat,
      resolveElement: () => Uint8Array.from([1]),
    });
    expect([...skipped.complete]).toEqual([0xee]);
    expect(skipped.activeSteps).toHaveLength(0);

    const activeEnv = pathEffectActivationEnvironmentFromArgs(
      handler!.inputs, [1n, 9n, true],
    );
    const folded = foldChunkableResource(plan, {
      activationEnv: activeEnv,
      emptyValue: () => new Uint8Array(),
      appendElement: concat,
      resolveElement: () => Uint8Array.from([7]),
    });
    expect(folded.activeSteps).toHaveLength(2);
    expect([...folded.complete]).toEqual([7, 7]);
  });

  it('path-effect activation breadth: event/transfer ordinals filter under and/or activations + ExecutionContext', () => {
    const schedule: PublishedPathEffectSchedule = {
      version: 1,
      effects: [
        {
          ordinal: 0,
          kind: 'stateWrite',
          resultType: 'bytes',
          activation: { kind: 'always' },
        },
        {
          ordinal: pathEffectEventOrdinal(0),
          kind: 'event',
          resultType: 'Transfer(bytes20,int)',
          activation: { kind: 'boolParam', name: 'emitIt' },
        },
        {
          ordinal: pathEffectEventOrdinal(1),
          kind: 'event',
          resultType: 'Skip(bytes20)',
          activation: {
            kind: 'and',
            left: { kind: 'boolParam', name: 'emitIt' },
            right: { kind: 'boolParam', name: 'extra' },
          },
        },
        {
          ordinal: pathEffectTransferOrdinal(0),
          kind: 'transfer',
          resultType: 'int256',
          activation: {
            kind: 'or',
            left: { kind: 'boolParam', name: 'emitIt' },
            right: { kind: 'boolParam', name: 'extra' },
          },
        },
      ],
    };
    const inputs = [
      { name: 'emitIt', type: 'bool' },
      { name: 'extra', type: 'bool' },
    ];
    const none = pathEffectActivationEnvironmentFromArgs(inputs, [false, false]);
    const emitOnly = pathEffectActivationEnvironmentFromArgs(inputs, [true, false]);
    const both = pathEffectActivationEnvironmentFromArgs(inputs, [true, true]);

    expect(activeEventOrdinalsFromPathEffectSchedule(schedule, none)).toEqual([]);
    expect(activeEventOrdinalsFromPathEffectSchedule(schedule, emitOnly))
      .toEqual([pathEffectEventOrdinal(0)]);
    expect(activeEventOrdinalsFromPathEffectSchedule(schedule, both))
      .toEqual([pathEffectEventOrdinal(0), pathEffectEventOrdinal(1)]);
    expect(activeTransferOrdinalsFromPathEffectSchedule(schedule, none)).toEqual([]);
    expect(activeTransferOrdinalsFromPathEffectSchedule(schedule, emitOnly))
      .toEqual([pathEffectTransferOrdinal(0)]);
    expect(activeOrdinalsFromPathEffectSchedule(schedule, emitOnly).length).toBe(3);

    const emits = [
      { eventName: 'Transfer', emitIndex: 0 },
      { eventName: 'Skip', emitIndex: 1 },
    ];
    expect(filterEmitsUnderPathEffectSchedule(emits, schedule, none)).toEqual([]);
    expect(filterEmitsUnderPathEffectSchedule(emits, schedule, emitOnly)
      .map((entry) => entry.eventName)).toEqual(['Transfer']);
    expect(filterEmitsUnderPathEffectSchedule(emits, schedule, both)).toHaveLength(2);

    expect(filterTransfersUnderPathEffectSchedule(
      [{ transferIndex: 0 }, { transferIndex: 1 }],
      schedule,
      emitOnly,
    ).map((site) => site.transferIndex)).toEqual([0]);

    expect(pathEffectScheduleAllowsEffect({
      schedule,
      kind: 'event',
      effectOrdinals: [pathEffectEventOrdinal(0)],
      env: none,
      fallbackActive: () => true,
    })).toBe(false);

    const context = buildKernelExecutionContext({
      handlerId: 'h-multi',
      inputs,
      args: [true, false],
      pathEffectSchedule: schedule,
    });
    expect(activeOrdinalsUnderContext(context, 'event')).toEqual([pathEffectEventOrdinal(0)]);
    expect(allowsEffectUnderExecutionContext(
      context, 'event', [pathEffectEventOrdinal(1)],
    )).toBe(false);
    expect(allowsEffectUnderExecutionContext(
      context, 'transfer', [pathEffectTransferOrdinal(0)],
    )).toBe(true);

    // settle-time ExecutionContext: ExecutionContext-supplied active event ordinals override env evaluation.
    const contextActive = activeOrdinalsUnderContext(context, 'event');
    expect(filterEmitsUnderPathEffectSchedule(emits, schedule, none, contextActive)
      .map((entry) => entry.eventName)).toEqual(['Transfer']);

    // path-effect activation: ExecutionContext-supplied active transfer ordinals override env evaluation.
    const contextTransfers = activeOrdinalsUnderContext(context, 'transfer');
    expect(filterTransfersUnderPathEffectSchedule(
      [{ transferIndex: 0 }, { transferIndex: 1 }],
      schedule,
      none,
      contextTransfers,
    ).map((site) => site.transferIndex)).toEqual([0]);

    // settle-time ExecutionContext: settle-time context.activationEnv itself gates emits/transfers when ordinals omitted.
    expect(filterEmitsUnderPathEffectSchedule(emits, schedule, context.activationEnv)
      .map((entry) => entry.eventName)).toEqual(['Transfer']);
    expect(filterTransfersUnderPathEffectSchedule(
      [{ transferIndex: 0 }, { transferIndex: 1 }],
      schedule,
      context.activationEnv,
    ).map((site) => site.transferIndex)).toEqual([0]);
  });
});
