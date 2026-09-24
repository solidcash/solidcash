import { describe, expect, it } from 'vitest';
import {
  evaluateFoldActivation,
  foldActivationFromExternalCallExpression,
  foldChunkableResource,
  normalizeFoldActivation,
  type ResourceFoldPlan,
} from '../../src/message-bus/resource-fold.js';

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

  it('path-effect activation: string activation is boolParam sugar and activationEnv gates steps', () => {
    expect(normalizeFoldActivation('writeRight')).toEqual({ kind: 'boolParam', name: 'writeRight' });
    const plan: ResourceFoldPlan = {
      collection: 'events',
      initialSource: 'empty',
      steps: [
        { kind: 'push', rowSelector: 'left' },
        { kind: 'push', rowSelector: 'right', activation: 'writeRight' },
      ],
    };
    const inactive = foldChunkableResource(plan, {
      activationEnv: { boolParams: { writeRight: false } },
      emptyValue: () => new Uint8Array(),
      appendElement: concat,
      resolveElement: (step) => (
        step.rowSelector === 'left' ? Uint8Array.from([1]) : Uint8Array.from([2])
      ),
    });
    expect([...inactive.complete]).toEqual([1]);
    expect(inactive.activeSteps.map((step) => step.rowSelector)).toEqual(['left']);

    const active = foldChunkableResource(plan, {
      activationEnv: { boolParams: { writeRight: true } },
      emptyValue: () => new Uint8Array(),
      appendElement: concat,
      resolveElement: (step) => (
        step.rowSelector === 'left' ? Uint8Array.from([1]) : Uint8Array.from([2])
      ),
    });
    expect([...active.complete]).toEqual([1, 2]);
  });

  it('path-effect activation: structured handlerInput + not activations evaluate beyond bool-param names', () => {
    expect(evaluateFoldActivation(
      { kind: 'handlerInput', inputIndex: 0 },
      { handlerInputs: [true, false] },
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'not', of: { kind: 'handlerInput', inputIndex: 1 } },
      { handlerInputs: [true, false] },
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'handlerInput', inputIndex: 3 },
      { handlerInputs: [true] },
    )).toBe(false);

    const plan: ResourceFoldPlan = {
      collection: 'events',
      initialSource: 'empty',
      steps: [
        {
          kind: 'push',
          rowSelector: 'gated',
          activation: { kind: 'not', of: { kind: 'handlerInput', inputIndex: 0 } },
        },
      ],
    };
    const skipped = foldChunkableResource(plan, {
      activationEnv: { handlerInputs: [true] },
      emptyValue: () => new Uint8Array([7]),
      appendElement: concat,
      resolveElement: () => Uint8Array.from([9]),
    });
    expect([...skipped.complete]).toEqual([7]);
    expect(skipped.activeSteps).toHaveLength(0);
  });

  it('path-effect activation: foldActivationFromExternalCallExpression maps compiler ECE onto recipes', () => {
    expect(foldActivationFromExternalCallExpression({
      kind: 'source',
      source: { kind: 'forward', paramIndex: 2 },
    })).toEqual({ kind: 'handlerInput', inputIndex: 2 });
    expect(foldActivationFromExternalCallExpression({
      kind: 'unary',
      operator: '!',
      expression: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
    })).toEqual({ kind: 'not', of: { kind: 'handlerInput', inputIndex: 0 } });
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '&&',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      right: { kind: 'identifier', name: 'writeRight' },
    })).toEqual({
      kind: 'and',
      left: { kind: 'handlerInput', inputIndex: 0 },
      right: { kind: 'boolParam', name: 'writeRight' },
    });
    expect(foldActivationFromExternalCallExpression({
      kind: 'state',
      name: 'counter',
    })).toBeUndefined();
  });

  it('path-effect activation: and/or activations evaluate with short-circuit semantics', () => {
    const andRecipe = {
      kind: 'and' as const,
      left: { kind: 'handlerInput' as const, inputIndex: 0 },
      right: { kind: 'boolParam' as const, name: 'writeRight' },
    };
    expect(evaluateFoldActivation(andRecipe, {
      handlerInputs: [true],
      boolParams: { writeRight: true },
    })).toBe(true);
    expect(evaluateFoldActivation(andRecipe, {
      handlerInputs: [true],
      boolParams: { writeRight: false },
    })).toBe(false);
    expect(evaluateFoldActivation({
      kind: 'or',
      left: { kind: 'handlerInput', inputIndex: 0 },
      right: { kind: 'boolParam', name: 'writeRight' },
    }, {
      handlerInputs: [false],
      boolParams: { writeRight: true },
    })).toBe(true);
  });

  it('path-effect activation: handlerInputCmp maps != / <> literals and evaluates relationally', () => {
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '!=',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      right: { kind: 'literal', type: 'bigint', value: '3' },
    })).toEqual({ kind: 'handlerInputCmp', inputIndex: 0, op: '!=', value: '3' });
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '>=',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      right: { kind: 'literal', type: 'bigint', value: '10' },
    })).toEqual({ kind: 'handlerInputCmp', inputIndex: 1, op: '>=', value: '10' });
    // Flipped literal-left: 5 < x ⇒ x > 5.
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '<',
      left: { kind: 'literal', type: 'bigint', value: '5' },
      right: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
    })).toEqual({ kind: 'handlerInputCmp', inputIndex: 0, op: '>', value: '5' });

    expect(evaluateFoldActivation(
      { kind: 'handlerInputCmp', inputIndex: 0, op: '!=', value: '3' },
      { handlerInputs: [4n] },
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'handlerInputCmp', inputIndex: 0, op: '!=', value: '3' },
      { handlerInputs: [3n] },
    )).toBe(false);
    expect(evaluateFoldActivation(
      { kind: 'handlerInputCmp', inputIndex: 0, op: '<=', value: '10' },
      { handlerInputs: [10n] },
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'handlerInputCmp', inputIndex: 0, op: '>', value: '10' },
      { handlerInputs: [10n] },
    )).toBe(false);
  });

  it('path-effect activation: handlerInputPairCmp maps cross-input compares', () => {
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '<',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      right: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
    })).toEqual({
      kind: 'handlerInputPairCmp',
      leftIndex: 0,
      op: '<',
      rightIndex: 1,
    });
    expect(evaluateFoldActivation(
      { kind: 'handlerInputPairCmp', leftIndex: 0, op: '<', rightIndex: 1 },
      { handlerInputs: [3n, 5n] },
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'handlerInputPairCmp', leftIndex: 0, op: '<', rightIndex: 1 },
      { handlerInputs: [5n, 3n] },
    )).toBe(false);
    expect(evaluateFoldActivation(
      { kind: 'handlerInputPairCmp', leftIndex: 0, op: '==', rightIndex: 1 },
      { handlerInputs: [7n, 7n] },
    )).toBe(true);
  });

  it('path-effect activation: boolParamEq maps identifier == / != bool literal', () => {
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '==',
      left: { kind: 'identifier', name: 'writeRight' },
      right: { kind: 'literal', type: 'bool', value: false },
    })).toEqual({ kind: 'boolParamEq', name: 'writeRight', value: false });
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '!=',
      left: { kind: 'literal', type: 'bool', value: true },
      right: { kind: 'identifier', name: 'emitIt' },
    })).toEqual({
      kind: 'not',
      of: { kind: 'boolParamEq', name: 'emitIt', value: true },
    });
    expect(evaluateFoldActivation(
      { kind: 'boolParamEq', name: 'writeRight', value: false },
      { boolParams: { writeRight: false } },
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'boolParamEq', name: 'writeRight', value: false },
      { boolParams: { writeRight: true } },
    )).toBe(false);
  });

  it('path-effect activation: namedInputEq/Cmp maps identifier vs int literal (non-forward side)', () => {
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '==',
      left: { kind: 'identifier', name: 'kind' },
      right: { kind: 'literal', type: 'bigint', value: '2' },
    })).toEqual({ kind: 'namedInputEq', name: 'kind', value: '2' });
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '>=',
      left: { kind: 'identifier', name: 'amount' },
      right: { kind: 'literal', type: 'bigint', value: '100' },
    })).toEqual({ kind: 'namedInputCmp', name: 'amount', op: '>=', value: '100' });
    expect(evaluateFoldActivation(
      { kind: 'namedInputEq', name: 'kind', value: '2' },
      { namedInputs: { kind: 2n } },
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'namedInputCmp', name: 'amount', op: '>=', value: '100' },
      { namedInputs: { amount: 50n } },
    )).toBe(false);
  });

  it('path-effect activation: namedInputPairCmp maps identifier vs identifier', () => {
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '<',
      left: { kind: 'identifier', name: 'a' },
      right: { kind: 'identifier', name: 'b' },
    })).toEqual({
      kind: 'namedInputPairCmp',
      leftName: 'a',
      op: '<',
      rightName: 'b',
    });
    expect(evaluateFoldActivation(
      { kind: 'namedInputPairCmp', leftName: 'a', op: '<', rightName: 'b' },
      { namedInputs: { a: 1n, b: 3n } },
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'namedInputPairCmp', leftName: 'a', op: '<', rightName: 'b' },
      { namedInputs: { a: 5n, b: 3n } },
    )).toBe(false);
  });

  it('path-effect activation: stateEq/Cmp maps state field vs literal', () => {
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '==',
      left: { kind: 'state', name: 'counter' },
      right: { kind: 'literal', type: 'bigint', value: '0' },
    })).toEqual({ kind: 'stateEq', name: 'counter', value: '0' });
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '>',
      left: { kind: 'state', stateName: 'balance' },
      right: { kind: 'literal', type: 'bigint', value: '10' },
    })).toEqual({ kind: 'stateCmp', name: 'balance', op: '>', value: '10' });
    expect(evaluateFoldActivation(
      { kind: 'stateEq', name: 'counter', value: '0' },
      { stateValues: { counter: 0n } },
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'stateCmp', name: 'balance', op: '>', value: '10' },
      { stateValues: { balance: 5n } },
    )).toBe(false);
  });

  it('path-effect activation: callEq/Cmp maps call result vs literal', () => {
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '==',
      left: { kind: 'call', name: 'quote' },
      right: { kind: 'literal', type: 'bigint', value: '42' },
    })).toEqual({ kind: 'callEq', name: 'quote', value: '42' });
    expect(evaluateFoldActivation(
      { kind: 'callEq', name: 'quote', value: '42' },
      { callResults: { quote: 42n } },
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'callCmp', name: 'quote', op: '<', value: '10' },
      { callResults: { quote: 42n } },
    )).toBe(false);
  });

  it('path-effect activation: stateCallCmp maps nested state vs call compound', () => {
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '>=',
      left: { kind: 'state', name: 'balance' },
      right: { kind: 'call', name: 'minOut' },
    })).toEqual({
      kind: 'stateCallCmp',
      stateName: 'balance',
      op: '>=',
      callName: 'minOut',
    });
    expect(evaluateFoldActivation(
      { kind: 'stateCallCmp', stateName: 'balance', op: '>=', callName: 'minOut' },
      { stateValues: { balance: 100n }, callResults: { minOut: 50n } },
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'stateCallCmp', stateName: 'balance', op: '>=', callName: 'minOut' },
      { stateValues: { balance: 10n }, callResults: { minOut: 50n } },
    )).toBe(false);
  });

  it('path-effect activation: ternary maps to and/or compound; member compare uses dotted name', () => {
    expect(foldActivationFromExternalCallExpression({
      kind: 'ternary',
      condition: { kind: 'identifier', name: 'useA' },
      consequent: { kind: 'identifier', name: 'a' },
      alternate: { kind: 'identifier', name: 'b' },
    })).toEqual({
      kind: 'or',
      left: {
        kind: 'and',
        left: { kind: 'boolParam', name: 'useA' },
        right: { kind: 'boolParam', name: 'a' },
      },
      right: {
        kind: 'and',
        left: { kind: 'not', of: { kind: 'boolParam', name: 'useA' } },
        right: { kind: 'boolParam', name: 'b' },
      },
    });
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '==',
      left: {
        kind: 'member',
        object: { kind: 'identifier', name: 'pool' },
        property: 'reserve',
      },
      right: { kind: 'literal', type: 'bigint', value: '1' },
    })).toEqual({ kind: 'namedInputEq', name: 'pool.reserve', value: '1' });
    expect(evaluateFoldActivation(
      { kind: 'namedInputEq', name: 'pool.reserve', value: '1' },
      { stateValues: { 'pool.reserve': 1n } },
    )).toBe(true);
  });

  it('path-effect activation: array-index and cast sides map to namedInputEq/Cmp paths', () => {
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '==',
      left: {
        kind: 'index',
        base: { kind: 'identifier', name: 'balances' },
        index: { kind: 'literal', type: 'bigint', value: '0' },
      },
      right: { kind: 'literal', type: 'bigint', value: '42' },
    })).toEqual({ kind: 'namedInputEq', name: 'balances[0]', value: '42' });
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '>',
      left: {
        kind: 'arrayIndex',
        base: { kind: 'state', stateName: 'scores' },
        index: { kind: 'identifier', name: 'i' },
      },
      right: { kind: 'literal', type: 'bigint', value: '10' },
    })).toEqual({ kind: 'namedInputCmp', name: 'scores[i]', op: '>', value: '10' });
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '==',
      left: {
        kind: 'cast',
        castType: 'int',
        expression: { kind: 'identifier', name: 'raw' },
      },
      right: { kind: 'literal', type: 'bigint', value: '7' },
    })).toEqual({ kind: 'namedInputEq', name: 'raw as int', value: '7' });
    expect(foldActivationFromExternalCallExpression({
      kind: 'binary',
      operator: '!=',
      left: {
        kind: 'cast',
        castType: 'uint',
        expression: {
          kind: 'index',
          base: { kind: 'identifier', name: 'vals' },
          index: 1,
        },
      },
      right: { kind: 'literal', type: 'bigint', value: '0' },
    })).toEqual({ kind: 'namedInputCmp', name: 'vals[1] as uint', op: '!=', value: '0' });
    expect(evaluateFoldActivation(
      { kind: 'namedInputEq', name: 'balances[0]', value: '42' },
      { namedInputs: { 'balances[0]': 42n } },
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'namedInputEq', name: 'raw as int', value: '7' },
      { stateValues: { 'raw as int': 7n } },
    )).toBe(true);
    expect(evaluateFoldActivation(
      { kind: 'namedInputCmp', name: 'scores[i]', op: '>', value: '10' },
      { namedInputs: { 'scores[i]': 5n } },
    )).toBe(false);
  });
});
