import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import { encodeFunctionArgument } from '../../src/Argument.js';
import { evalComputedKey as evalRouteComputedKey } from '../../src/stateful/call-expression-key.js';
import {
  evalComputedKey,
  resolveRouteRowExpressionKey,
  type RouteExpressionKeyRow,
} from '../../src/stateful/StatefulContract.js';

function encodedUint(value: bigint): string {
  const encoded = encodeFunctionArgument(value, 'uint256');
  if (!(encoded instanceof Uint8Array)) throw new Error('expected uint encoding');
  return binToHex(encoded);
}

describe('resolveRouteRowExpressionKey', () => {
  it('evaluates a label against the planning arguments', () => {
    const encoded = resolveRouteRowExpressionKey({
      expressionLabel: 'id:jobId_',
      routePlanningArgs: [77n],
      routeVisibleInputs: [{ name: 'jobId_', type: 'uint256' }],
    });
    expect(encoded).toBeDefined();
    expect(binToHex(encoded!)).toBe(encodedUint(77n));
  });
});

describe('evalComputedKey map: state-array labels', () => {
  const lockA = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x11), 0x87]);
  const lockB = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x22), 0x87]);

  it('indexes a decoded dynamic state array by a parameter index', () => {
    const encoded = evalComputedKey(
      'map:items(id:index_)', [1n], [{ name: 'index_', type: 'uint256' }], { items: [lockA, lockB] },
    );
    expect(encoded).toBeDefined();
    expect(binToHex(encoded!)).toBe(binToHex(lockB));
  });

  it('binds a numeric parameter handed over as a JS number', () => {
    const encoded = evalComputedKey(
      'map:items(binop:+(id:index_,lit:0))', [1], [{ name: 'index_', type: 'uint256' }], { items: [lockA, lockB] },
    );
    expect(encoded).toBeDefined();
    expect(binToHex(encoded!)).toBe(binToHex(lockB));
  });

  it('encodes a numeric element as its VM number', () => {
    const encoded = evalComputedKey('map:nums(lit:0)', [], [], { nums: [7n, 9n] });
    expect(encoded).toBeDefined();
    expect(binToHex(encoded!)).toBe(encodedUint(7n));
  });

  it('stays undefined for an absent, non-array, or out-of-range state slot', () => {
    expect(evalComputedKey('map:items(lit:0)', [], [], {})).toBeUndefined();
    expect(evalComputedKey('map:items(lit:0)', [], [], { items: 5n })).toBeUndefined();
    expect(evalComputedKey('map:items(lit:2)', [], [], { items: [lockA, lockB] })).toBeUndefined();
    expect(evalComputedKey('map:items(id:missing)', [], [], { items: [lockA] })).toBeUndefined();
  });
});

describe('route-key conditional expressions', () => {
  it('uses Script truthiness and refuses an unresolved ternary guard', () => {
    const label = 'ternary(id:choice,lit:7,lit:9)';
    const inputs = [{ name: 'choice', type: 'uint256' }];
    expect(evalRouteComputedKey(label, [2n], inputs)).toEqual(bigIntToVmNumber(7n));
    expect(evalRouteComputedKey(label, [0n], inputs)).toEqual(bigIntToVmNumber(9n));
    expect(evalRouteComputedKey(label, [], [])).toBeUndefined();
    expect(evalRouteComputedKey('ternary(binop:>(id:choice,lit:1),lit:7,lit:9)', [2n], inputs))
      .toEqual(bigIntToVmNumber(7n));
    expect(evalRouteComputedKey('ternary(binop:&&(id:active,unop:!(id:blocked)),lit:7,lit:9)',
      [true, false], [{ name: 'active', type: 'bool' }, { name: 'blocked', type: 'bool' }]))
      .toEqual(bigIntToVmNumber(7n));
    expect(evalRouteComputedKey('binop:+(map:counts(lit:0),lit:2)', [], [], { counts: [7n] }))
      .toEqual(bigIntToVmNumber(9n));
  });
});

describe('resolveRouteRowExpressionKey route-array labels', () => {
  const locker = Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x33), 0x88, 0xac]);
  const arrayRow = (occurrenceIndex?: number): RouteExpressionKeyRow => ({
    args: [0n],
    occurrenceIndex,
    handler: {
      inputs: [{ name: 'index_', type: 'uint256' }],
      entryAccesses: [{ collection: 'arbitrators' }],
    },
  });

  it('binds a source-loop local to the single selected row occurrence and indexes the state array', () => {
    const encoded = resolveRouteRowExpressionKey({
      expressionLabel: 'map:arbitratorAddresses(binop:+(id:i,id:index_))',
      rowArguments: [arrayRow(0)],
      routePlanningArgs: [0n],
      routeVisibleInputs: [{ name: 'index_', type: 'uint256' }],
      state: { arbitratorAddresses: [locker] },
    });
    expect(encoded).toBeDefined();
    expect(binToHex(encoded!)).toBe(binToHex(locker));
  });

  it('uses the row occurrence, not zero, when the selected row is a later occurrence', () => {
    const second = Uint8Array.from([...locker.slice(0, 23), ...locker.slice(23)].map((b, i) => (i === 3 ? 0x44 : b)));
    const encoded = resolveRouteRowExpressionKey({
      expressionLabel: 'map:arbitratorAddresses(binop:+(id:i,id:index_))',
      rowArguments: [arrayRow(1)],
      routePlanningArgs: [0n],
      routeVisibleInputs: [{ name: 'index_', type: 'uint256' }],
      state: { arbitratorAddresses: [locker, second] },
    });
    expect(encoded).toBeDefined();
    expect(binToHex(encoded!)).toBe(binToHex(second));
  });

  it('stays unresolved when the array is absent or more than one row could own the counter', () => {
    expect(resolveRouteRowExpressionKey({
      expressionLabel: 'map:arbitratorAddresses(binop:+(id:i,id:index_))',
      rowArguments: [arrayRow(0)],
      routePlanningArgs: [0n],
      routeVisibleInputs: [{ name: 'index_', type: 'uint256' }],
      state: {},
    })).toBeUndefined();
    expect(resolveRouteRowExpressionKey({
      expressionLabel: 'map:arbitratorAddresses(binop:+(id:i,id:index_))',
      rowArguments: [arrayRow(0), arrayRow(1)],
      routePlanningArgs: [0n],
      routeVisibleInputs: [{ name: 'index_', type: 'uint256' }],
      state: { arbitratorAddresses: [locker, locker] },
    })).toBeUndefined();
  });
});
