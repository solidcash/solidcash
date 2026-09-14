import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { encodeFunctionArgument } from '../../src/Argument.js';
import {
  canShareIdempotentCounterLoopSettlement,
  evalComputedKey,
  matchingRouteRowsForExpressionKey,
  parseRowArgsDecodeLabel,
  resolveRouteRowExpressionKey,
  type RouteExpressionKeyRow,
} from '../../src/stateful/StatefulContract.js';

function counterLoopRow(
  args: bigint[],
  op: 'set' | 'delete' | '+' = 'set',
  valueRuntimeExpression = false,
): RouteExpressionKeyRow {
  return {
    args,
    handler: {
      name: op === 'delete' ? 'clear' : 'write',
      selector: op === 'delete' ? '22222222' : '11111111',
      inputs: [
        { name: 'n', type: 'int' },
        ...(op === 'delete' ? [] : [{ name: 'value', type: 'int' }]),
        { name: '__internal__vmapCounterPerm_n_0', type: 'int[]' },
      ],
      requiredNftIndices: [],
      sortedUpsertLoopInfo: [{
        collection: 'm',
        fixedKeyParams: [],
        varyingArrayParam: '__internal__vmapCounterPerm_n_0',
        ...(op === 'set' && !valueRuntimeExpression && { valueScalarParam: 'value' }),
        ...(valueRuntimeExpression && { valueRuntimeExpression: true }),
        op,
      }],
    },
  };
}

function encodedUint(value: bigint): string {
  const encoded = encodeFunctionArgument(value, 'uint256');
  if (!(encoded instanceof Uint8Array)) throw new Error('expected uint encoding');
  return binToHex(encoded);
}

const THREE_ARG = 'AbiDecodeAtNode{data=id:rowArgs,index=0,schema=[,,]}';
const TWO_ARG = 'AbiDecodeAtNode{data=id:rowArgs,index=0,schema=[,]}';
const TWO_ARG_INDEX_1 = 'AbiDecodeAtNode{data=id:rowArgs,index=1,schema=[,]}';

function row(
  collection: string,
  inputs: string[],
  args: Array<bigint | string>,
  label?: string,
): RouteExpressionKeyRow {
  return {
    args,
    handler: {
      inputs: inputs.map((name) => ({ name, type: typeof args[0] === 'bigint' ? 'uint256' : 'address' })),
      entryAccesses: [{
        collection,
        keySources: label ? [{ kind: 'expression', expressionLabel: label }] : undefined,
      }],
    },
  };
}

describe('parseRowArgsDecodeLabel', () => {
  it('reads argument index and schema arity from the compiler label', () => {
    expect(parseRowArgsDecodeLabel(THREE_ARG)).toEqual({ argumentIndex: 0, schemaArity: 3 });
    expect(parseRowArgsDecodeLabel(TWO_ARG_INDEX_1)).toEqual({ argumentIndex: 1, schemaArity: 2 });
    expect(parseRowArgsDecodeLabel('call:hash160(id:pk)')).toBeUndefined();
    expect(parseRowArgsDecodeLabel(undefined)).toBeUndefined();
  });
});

describe('canShareIdempotentCounterLoopSettlement', () => {
  const canShare = (rows: RouteExpressionKeyRow[]): boolean => (
    canShareIdempotentCounterLoopSettlement({ rows, structs: undefined, dataNftCount: 0 })
  );

  it('accepts identical absolute sets and deletes', () => {
    expect(canShare([counterLoopRow([3n, 10n]), counterLoopRow([3n, 10n])])).toBe(true);
    expect(canShare([counterLoopRow([3n], 'delete'), counterLoopRow([3n], 'delete')])).toBe(true);
  });

  it('rejects differing rows, relative updates, and unproven runtime set expressions', () => {
    expect(canShare([counterLoopRow([3n, 10n]), counterLoopRow([3n, 11n])])).toBe(false);
    expect(canShare([counterLoopRow([3n, 1n], '+'), counterLoopRow([3n, 1n], '+')])).toBe(false);
    expect(canShare([
      counterLoopRow([3n, 10n], 'set', true),
      counterLoopRow([3n, 10n], 'set', true),
    ])).toBe(false);
  });
});

describe('matchingRouteRowsForExpressionKey', () => {
  const rows = [
    row('jobEvents', ['jobId_', 'event_', 'extra_'], [11n, 1n, 0n], THREE_ARG),
    row('userReviews', ['target_', 'reviewer_', 'jobId_'], [21n, 22n, 23n], THREE_ARG),
    row('jobEvents', ['jobId_', 'index_'], [31n, 0n], TWO_ARG),
    row('userReviews', ['target_', 'index_'], [41n, 1n], TWO_ARG),
  ];

  it('selects the later-row jobEvents access, not row 0', () => {
    const matched = matchingRouteRowsForExpressionKey({
      collection: 'jobEvents',
      schemaArity: 2,
      expressionLabel: TWO_ARG,
      rowArguments: rows,
    });
    expect(matched?.args[0]).toBe(31n);
  });

  it('does not confuse same-schema collections', () => {
    expect(matchingRouteRowsForExpressionKey({
      collection: 'userReviews',
      schemaArity: 3,
      expressionLabel: THREE_ARG,
      rowArguments: rows,
    })?.args[0]).toBe(21n);
  });

  it('uses the _rN hint when two rows share collection and arity', () => {
    const ambiguous = [
      row('jobEvents', ['jobId_', 'index_'], [1n, 0n], TWO_ARG),
      row('jobEvents', ['jobId_', 'index_'], [2n, 0n], TWO_ARG),
    ];
    expect(matchingRouteRowsForExpressionKey({
      collection: 'jobEvents',
      schemaArity: 2,
      expressionLabel: TWO_ARG,
      rowArguments: ambiguous,
      rowIndexHint: 1,
    })?.args[0]).toBe(2n);
  });

  it('returns undefined for an inactive reserved slot', () => {
    expect(matchingRouteRowsForExpressionKey({
      collection: 'meceTags',
      schemaArity: 1,
      rowArguments: rows,
    })).toBeUndefined();
  });
});

describe('resolveRouteRowExpressionKey', () => {
  const rows = [
    row('jobEvents', ['jobId_', 'event_', 'extra_'], [11n, 1n, 0n], THREE_ARG),
    row('userReviews', ['target_', 'reviewer_', 'jobId_'], [21n, 22n, 23n], THREE_ARG),
    row('jobEvents', ['jobId_', 'index_'], [31n, 0n], TWO_ARG),
    row('userReviews', ['target_', 'index_'], [41n, 1n], TWO_ARG),
  ];

  it('encodes the later-row jobEvents key from that row\'s args', () => {
    const encoded = resolveRouteRowExpressionKey({
      expressionLabel: TWO_ARG,
      collection: 'jobEvents',
      rowArguments: rows,
      routePlanningArgs: [99n],
      routeVisibleInputs: [{ name: 'unused', type: 'uint256' }],
    });
    expect(encoded).toBeDefined();
    expect(binToHex(encoded!)).toBe(encodedUint(31n));
  });

  it('encodes argument index 1 from the matching row', () => {
    const encoded = resolveRouteRowExpressionKey({
      expressionLabel: TWO_ARG_INDEX_1,
      collection: 'jobEvents',
      rowArguments: rows,
      routePlanningArgs: [],
      routeVisibleInputs: [],
    });
    expect(encoded).toBeDefined();
    expect(binToHex(encoded!)).toBe(encodedUint(0n));
  });

  it('does not fall back to route planning args for a rowArgs label', () => {
    const encoded = resolveRouteRowExpressionKey({
      expressionLabel: THREE_ARG,
      collection: 'userReviews',
      rowArguments: rows,
      routePlanningArgs: [99n, 98n, 97n],
      routeVisibleInputs: [
        { name: 'a', type: 'uint256' },
        { name: 'b', type: 'uint256' },
        { name: 'c', type: 'uint256' },
      ],
    });
    expect(encoded).toBeDefined();
    expect(binToHex(encoded!)).toBe(encodedUint(21n));
  });

  it('falls through to evalComputedKey for a non-rowArgs label', () => {
    const encoded = resolveRouteRowExpressionKey({
      expressionLabel: 'id:jobId_',
      collection: 'jobEvents',
      rowArguments: rows,
      routePlanningArgs: [77n],
      routeVisibleInputs: [{ name: 'jobId_', type: 'uint256' }],
    });
    expect(encoded).toBeDefined();
    expect(binToHex(encoded!)).toBe(encodedUint(77n));
  });

  it('returns undefined when the reserved slot has no active row', () => {
    expect(resolveRouteRowExpressionKey({
      expressionLabel: 'AbiDecodeAtNode{data=id:rowArgs,index=0,schema=[]}',
      collection: 'meceTags',
      rowArguments: rows,
      routePlanningArgs: [],
      routeVisibleInputs: [],
    })).toBeUndefined();
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
