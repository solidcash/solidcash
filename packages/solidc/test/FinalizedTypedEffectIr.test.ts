/**
 * finalized typed effect IR: kernel admission on finalized typed effect IR (+ thin path-effect schedule).
 * Analysis may use pre-final intrinsic bridges; published childDeployments must be finalized.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allowsPreFinalIntrinsicTypes,
  assertFinalizedTypedEffectIr,
  assertPublishedChildDeploymentEffectIr,
  buildPathEffectSchedule,
  evaluatePathEffectActivation,
  hasFinalizedResultType,
  normalizePathEffectActivation,
  pathEffectActivationFromExpression,
  pathEffectScheduleFromChildDeployments,
  pathEffectScheduleFromHandlerEffects,
  selectActivePathEffects,
} from '../src/finalized-typed-effect-ir.js';
import { compileString } from '../src/compiler.js';

describe('finalized typed effect IR finalized typed effect IR', () => {
  it('assertFinalizedTypedEffectIr accepts ordered finalized effects and builds a path-effect schedule', () => {
    const effects = [
      { ordinal: 0, kind: 'constructorArg' as const, resultType: 'bytes20' },
      { ordinal: 1, kind: 'hash' as const, resultType: 'bytes32', activation: 'writeSecond' },
      { ordinal: 2, kind: 'salt' as const, resultType: 'bytes32' },
    ];
    expect(() => assertFinalizedTypedEffectIr(effects)).not.toThrow();
    const schedule = buildPathEffectSchedule(effects);
    expect(schedule.version).toBe(1);
    expect(schedule.effects).toHaveLength(3);
    expect(schedule.effects[1]?.activation).toBe('writeSecond');
  });

  it('path-effect activation: structured path-effect activations select beyond bool-param name strings', () => {
    expect(normalizePathEffectActivation('writeRight')).toEqual({
      kind: 'boolParam', name: 'writeRight',
    });
    const schedule = buildPathEffectSchedule([
      { ordinal: 0, kind: 'stateWrite', resultType: 'int' },
      {
        ordinal: 1,
        kind: 'stateWrite',
        resultType: 'int',
        activation: { kind: 'handlerInput', inputIndex: 0 },
      },
      {
        ordinal: 2,
        kind: 'event',
        resultType: 'bytes',
        activation: { kind: 'not', of: { kind: 'boolParam', name: 'mute' } },
      },
    ]);
    const active = selectActivePathEffects(schedule, {
      handlerInputs: [false],
      boolParams: { mute: false },
    });
    expect(active.map((effect) => effect.ordinal)).toEqual([0, 2]);
    expect(evaluatePathEffectActivation(
      { kind: 'not', of: { kind: 'handlerInput', inputIndex: 0 } },
      { handlerInputs: [true] },
    )).toBe(false);
    expect(evaluatePathEffectActivation({
      kind: 'and',
      left: { kind: 'handlerInput', inputIndex: 0 },
      right: { kind: 'boolParam', name: 'writeRight' },
    }, {
      handlerInputs: [true],
      boolParams: { writeRight: false },
    })).toBe(false);
    expect(evaluatePathEffectActivation({
      kind: 'or',
      left: { kind: 'handlerInput', inputIndex: 0 },
      right: { kind: 'boolParam', name: 'writeRight' },
    }, {
      handlerInputs: [false],
      boolParams: { writeRight: true },
    })).toBe(true);
  });

  it('fails closed on missing resultType, duplicate ordinal, or empty schedule', () => {
    expect(() => assertFinalizedTypedEffectIr([])).toThrow(/empty effect list/);
    expect(() => assertFinalizedTypedEffectIr([
      { ordinal: 0, kind: 'hash', resultType: '' },
    ])).toThrow(/missing finalized resultType/);
    expect(() => assertFinalizedTypedEffectIr([
      { ordinal: 1, kind: 'hash', resultType: 'bytes32' },
      { ordinal: 1, kind: 'salt', resultType: 'bytes32' },
    ])).toThrow(/duplicate ordinal/);
    expect(hasFinalizedResultType('bytes32')).toBe(true);
    expect(hasFinalizedResultType('')).toBe(false);
    expect(allowsPreFinalIntrinsicTypes({ requireFinalizedTypes: true })).toBe(false);
    expect(allowsPreFinalIntrinsicTypes({ requireFinalizedTypes: false })).toBe(true);
  });

  it('pathEffectScheduleFromChildDeployments fails closed without resultType and builds IR when present', () => {
    expect(() => pathEffectScheduleFromChildDeployments([{
      constructorArgs: [{ kind: 'hash' }],
    }])).toThrow(/missing resultType/);

    const schedule = assertPublishedChildDeploymentEffectIr([{
      constructorArgs: [
        { kind: 'hash', resultType: 'bytes20' },
        { kind: 'concat', resultType: 'bytes' },
      ],
      salt: { kind: 'hash', resultType: 'bytes32' },
    }]);
    expect(schedule?.effects.map((effect) => effect.kind)).toEqual([
      'hash', 'concat', 'salt',
    ]);
    expect(schedule?.effects.every((effect) => effect.resultType.length > 0)).toBe(true);
  });

  it('compiler kernel publish path asserts finalized child-deployment effect IR', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const compilerSrc = readFileSync(join(here, '../src/compiler.ts'), 'utf8');
    const recipeSrc = readFileSync(join(here, '../src/deploymentRecipes.ts'), 'utf8');
    expect(compilerSrc).toContain('assertPublishedChildDeploymentEffectIr');
    expect(compilerSrc).toMatch(
      /messageBusKernel === true[\s\S]*?assertPublishedChildDeploymentEffectIr\(deployments\)/,
    );
    expect(recipeSrc).toContain('allowsPreFinalIntrinsicTypes');
    expect(recipeSrc).toContain('activeTypedEffectOptions');
  });

  it('kernel compile publishes childDeployments that pass finalized typed-effect IR', () => {
    const artifact = compileString(`contract Payload(bytes20 digest) {
      bytes20 public stored;
      constructor() { this.stored = digest; }
    }
    contract Factory() {
      function create(bytes seed) public {
        Payload child = new Payload(hash160(seed));
        require(true);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      suppressWarnings: true,
    });
    const create = artifact.messageBus?.handlers?.find((handler) => handler.name === 'create');
    expect(create?.eligible).toBe(true);
    expect(create?.childDeployments?.[0]?.constructorArgs?.[0]).toMatchObject({
      kind: 'hash',
      algorithm: 'hash160',
      resultType: 'bytes20',
    });
    const schedule = assertPublishedChildDeploymentEffectIr(create?.childDeployments);
    expect(schedule?.effects[0]?.resultType).toBe('bytes20');
    expect(schedule?.effects[0]?.kind).toBe('hash');
  });

  it('path-effect activation: pathEffectScheduleFromHandlerEffects builds multi-effect programs with activations', () => {
    expect(pathEffectActivationFromExpression({
      kind: 'source',
      source: { kind: 'forward', paramIndex: 3 },
    })).toEqual({ kind: 'handlerInput', inputIndex: 3 });

    const schedule = pathEffectScheduleFromHandlerEffects({
      stateWrites: [
        { effectOrdinal: 0, resultType: 'bytes', collection: 'left' },
        {
          effectOrdinal: 1,
          resultType: 'bytes',
          collection: 'right',
          activation: { kind: 'source', source: { kind: 'forward', paramIndex: 3 } },
        },
      ],
      events: [
        { effectOrdinal: 2, resultType: 'Transfer(address,uint256)', eventName: 'Transfer' },
      ],
    });
    expect(schedule?.effects.map((effect) => effect.kind)).toEqual([
      'stateWrite', 'stateWrite', 'event',
    ]);
    expect(schedule?.effects[1]?.activation).toEqual({ kind: 'handlerInput', inputIndex: 3 });
    const active = selectActivePathEffects(schedule!, {
      handlerInputs: [false, false, false, true],
    });
    expect(active.map((effect) => effect.ordinal)).toEqual([0, 1, 2]);
    const inactiveRight = selectActivePathEffects(schedule!, {
      handlerInputs: [false, false, false, false],
    });
    expect(inactiveRight.map((effect) => effect.ordinal)).toEqual([0, 2]);
  });

  it('path-effect activation: kernel compile publishes handler pathEffectSchedule for bool-gated multi-write', () => {
    const artifact = compileString(`contract Store() {
      mapping(int => bytes) left;
      mapping(int => bytes) right;
      function set(int key, bytes leftValue, bytes rightValue, bool writeRight) public {
        this.left[key] = leftValue;
        if (writeRight) {
          this.right[key] = rightValue;
        }
        require(true);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      suppressWarnings: true,
    });
    const set = artifact.messageBus?.handlers?.find((handler) => handler.name === 'set');
    expect(set?.eligible).toBe(true);
    expect(set?.pathEffectSchedule).toMatchObject({
      version: 1,
      effects: expect.arrayContaining([
        expect.objectContaining({ kind: 'stateWrite', resultType: 'bytes' }),
        expect.objectContaining({
          kind: 'stateWrite',
          resultType: 'bytes',
          activation: expect.objectContaining({ kind: 'handlerInput' }),
        }),
      ]),
    });
    expect(set!.pathEffectSchedule!.effects.length).toBeGreaterThanOrEqual(2);
    const active = selectActivePathEffects(set!.pathEffectSchedule!, {
      handlerInputs: [true, true, true, false],
    });
    expect(active.every((effect) => effect.activation === undefined
      || evaluatePathEffectActivation(effect.activation, {
        handlerInputs: [true, true, true, false],
      }))).toBe(true);
    expect(active.length).toBeLessThan(set!.pathEffectSchedule!.effects.length);
  });

  it('path-effect activation: kernel compile stamps bool-param activations on event pathEffectSchedule entries', () => {
    const artifact = compileString(`contract Acc() {
      int public counter;
      event Ping(int value);
      function ping(bool emitIt, int value) public {
        this.counter = this.counter + 1;
        if (emitIt) {
          emit Ping(value);
        }
        require(true);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      suppressWarnings: true,
    });
    const ping = artifact.messageBus?.handlers?.find((handler) => handler.name === 'ping');
    expect(ping?.eligible).toBe(true);
    expect(ping?.pathEffectSchedule?.version).toBe(1);
    const eventEffects = ping!.pathEffectSchedule!.effects.filter((effect) => effect.kind === 'event');
    expect(eventEffects.length).toBeGreaterThanOrEqual(1);
    expect(eventEffects.some((effect) => effect.activation !== undefined)).toBe(true);
    expect(eventEffects[0]?.activation).toMatchObject({ kind: 'handlerInput' });

    const inactive = selectActivePathEffects(ping!.pathEffectSchedule!, {
      handlerInputs: [false, true],
      boolParams: { emitIt: false },
    });
    const active = selectActivePathEffects(ping!.pathEffectSchedule!, {
      handlerInputs: [true, true],
      boolParams: { emitIt: true },
    });
    expect(inactive.filter((effect) => effect.kind === 'event')).toHaveLength(0);
    expect(active.filter((effect) => effect.kind === 'event').length).toBeGreaterThan(0);
  });

  it('path-effect activation: opaque-control emits inherit enclosing bool-param activations (switch)', () => {
    // Bool-discriminant switch under if(emitIt): arms refine with emitIt∧arm / emitIt∧¬arm.
    const boolSwitch = compileString(`contract SwitchEmit() {
      int public counter;
      event Picked(int value);
      function pick(bool emitIt, bool arm) public {
        this.counter = this.counter + 1;
        if (emitIt) {
          switch (arm) {
            case true:
              emit Picked(1);
              break;
            case false:
              emit Picked(0);
              break;
          }
        }
        require(true);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      suppressWarnings: true,
    });
    const pick = boolSwitch.messageBus?.handlers?.find((handler) => handler.name === 'pick');
    expect(pick?.eligible).toBe(true);
    expect(pick?.pathEffectSchedule?.version).toBe(1);
    const boolEvents = pick!.pathEffectSchedule!.effects.filter((effect) => effect.kind === 'event');
    expect(boolEvents.length).toBeGreaterThanOrEqual(1);
    expect(boolEvents.every((effect) => effect.activation !== undefined)).toBe(true);
    const muted = selectActivePathEffects(pick!.pathEffectSchedule!, {
      handlerInputs: [false, true],
      boolParams: { emitIt: false, arm: true },
    });
    expect(muted.filter((effect) => effect.kind === 'event')).toHaveLength(0);
    const armedTrue = selectActivePathEffects(pick!.pathEffectSchedule!, {
      handlerInputs: [true, true],
      boolParams: { emitIt: true, arm: true },
    });
    expect(armedTrue.filter((effect) => effect.kind === 'event').length).toBeGreaterThan(0);

    // Int-discriminant switch: single emitting arm stamps handlerInputEq (which == 0).
    const intSwitch = compileString(`contract SwitchIntEmit() {
      int public counter;
      event Picked(int value);
      function pick(bool emitIt, int which) public {
        this.counter = this.counter + 1;
        if (emitIt) {
          switch (which) {
            case 0:
              emit Picked(0);
              break;
            default:
              break;
          }
        }
        require(true);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      suppressWarnings: true,
    });
    const pickInt = intSwitch.messageBus?.handlers?.find((handler) => handler.name === 'pick');
    expect(pickInt?.eligible).toBe(true);
    const intEvents = pickInt!.pathEffectSchedule!.effects.filter((effect) => effect.kind === 'event');
    expect(intEvents.length).toBeGreaterThanOrEqual(1);
    expect(intEvents[0]?.activation).toMatchObject({
      kind: 'and',
    });
    // emitIt=true but which≠0 ⇒ event inactive (equality refine).
    const wrongArm = selectActivePathEffects(pickInt!.pathEffectSchedule!, {
      handlerInputs: [true, 1n],
      boolParams: { emitIt: true },
    });
    expect(wrongArm.filter((effect) => effect.kind === 'event')).toHaveLength(0);
    const rightArm = selectActivePathEffects(pickInt!.pathEffectSchedule!, {
      handlerInputs: [true, 0n],
      boolParams: { emitIt: true },
    });
    expect(rightArm.filter((effect) => effect.kind === 'event').length).toBeGreaterThan(0);
  });

  it('path-effect activation: pathEffectActivationFromExpression maps handlerInput == int literal', () => {
    const recipe = pathEffectActivationFromExpression({
      kind: 'binary',
      operator: '==',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      right: { kind: 'literal', type: 'bigint', value: '7' },
    });
    expect(recipe).toEqual({ kind: 'handlerInputEq', inputIndex: 1, value: '7' });
    expect(evaluatePathEffectActivation(recipe, { handlerInputs: [true, 7n] })).toBe(true);
    expect(evaluatePathEffectActivation(recipe, { handlerInputs: [true, 8n] })).toBe(false);
  });

  it('path-effect activation: pathEffectActivationFromExpression maps handlerInputCmp != / <> literals', () => {
    const ne = pathEffectActivationFromExpression({
      kind: 'binary',
      operator: '!=',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      right: { kind: 'literal', type: 'bigint', value: '1' },
    });
    expect(ne).toEqual({ kind: 'handlerInputCmp', inputIndex: 0, op: '!=', value: '1' });
    expect(evaluatePathEffectActivation(ne, { handlerInputs: [2n] })).toBe(true);
    expect(evaluatePathEffectActivation(ne, { handlerInputs: [1n] })).toBe(false);

    const ge = pathEffectActivationFromExpression({
      kind: 'binary',
      operator: '>=',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      right: { kind: 'literal', type: 'bigint', value: '5' },
    });
    expect(ge).toEqual({ kind: 'handlerInputCmp', inputIndex: 0, op: '>=', value: '5' });
    expect(evaluatePathEffectActivation(ge, { handlerInputs: [5n] })).toBe(true);
    expect(evaluatePathEffectActivation(ge, { handlerInputs: [4n] })).toBe(false);
  });



  it('path-effect activation: pathEffectActivationFromExpression maps namedInputEq for identifier == int', () => {
    const eq = pathEffectActivationFromExpression({
      kind: 'binary',
      operator: '==',
      left: { kind: 'identifier', name: 'kind' },
      right: { kind: 'literal', type: 'bigint', value: '4' },
    });
    expect(eq).toEqual({ kind: 'namedInputEq', name: 'kind', value: '4' });
    expect(evaluatePathEffectActivation(eq, { namedInputs: { kind: 4n } })).toBe(true);
    expect(evaluatePathEffectActivation(eq, { namedInputs: { kind: 5n } })).toBe(false);
  });

  it('path-effect activation: pathEffectActivationFromExpression maps boolParamEq for identifier == bool', () => {
    const eq = pathEffectActivationFromExpression({
      kind: 'binary',
      operator: '==',
      left: { kind: 'identifier', name: 'writeRight' },
      right: { kind: 'literal', type: 'bool', value: true },
    });
    expect(eq).toEqual({ kind: 'boolParamEq', name: 'writeRight', value: true });
    expect(evaluatePathEffectActivation(eq, { boolParams: { writeRight: true } })).toBe(true);
    expect(evaluatePathEffectActivation(eq, { boolParams: { writeRight: false } })).toBe(false);
  });

  it('path-effect activation: pathEffectActivationFromExpression maps handlerInputPairCmp cross-input', () => {
    const pair = pathEffectActivationFromExpression({
      kind: 'binary',
      operator: '>',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      right: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
    });
    expect(pair).toEqual({
      kind: 'handlerInputPairCmp',
      leftIndex: 0,
      op: '>',
      rightIndex: 1,
    });
    expect(evaluatePathEffectActivation(pair, { handlerInputs: [9n, 3n] })).toBe(true);
    expect(evaluatePathEffectActivation(pair, { handlerInputs: [2n, 3n] })).toBe(false);
  });
});
