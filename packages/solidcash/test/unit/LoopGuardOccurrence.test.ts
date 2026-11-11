import { describe, expect, it } from 'vitest';
import type { Artifact, ExternalCallAbi } from '@solidcash/utils';
import { makeCallResolver } from '../../src/framed/proxy/call-resolution.js';
import { occurrenceCountOf } from '../../src/framed/proxy/external-calls.js';

/**
 * A loop site behind a branch the caller's own facts rule out places no record, whatever its bound.
 *
 * The row is UniswapV2Router02's `swapExactTokensForTokens` with `_swap` kept inline: `_swap` states its one- and
 * two-hop arms (`path.length == 2`, `== 3`) and loops only past them, so the loop's `getPair` row publishes the guard
 * `!(len == 2) && !(len == 3) && i < len - 2` and, inline, no iteration domain. A one- or two-hop path never reaches
 * the loop, so the planner counts it as no call rather than refusing to size a loop it does not run.
 */

const len = { kind: 'unary', operator: '.length', expression: { kind: 'source', source: { kind: 'forward', paramIndex: 2 } } };
const literal = (value: string): { kind: string; type: string; value: string } => (
  { kind: 'literal', type: 'bigint', value }
);
const not = (expression: unknown): { kind: string; operator: string; expression: unknown } => (
  { kind: 'unary', operator: '!', expression }
);
const loopIndex = {
  kind: 'source', source: { kind: 'loopIndex', counterName: '__inl13_i', initialValue: '0', stepValue: '1' },
};
const pathAt = (offset: string): {
  kind: string;
  expression: {
    kind: string;
    left: { kind: string; source: { kind: string; paramIndex: number } };
    right: { kind: string; operator: string; left: typeof loopIndex; right: ReturnType<typeof literal> };
    type: string;
  };
} => ({
  kind: 'expression',
  expression: {
    kind: 'arrayAccess',
    left: { kind: 'source', source: { kind: 'forward', paramIndex: 2 } },
    right: { kind: 'binary', operator: '+', left: loopIndex, right: literal(offset) },
    type: 'address',
  },
});
const pastStatedArms = {
  kind: 'binary', operator: '&&',
  left: not({ kind: 'binary', operator: '==', left: len, right: literal('2') }),
  right: not({ kind: 'binary', operator: '==', left: len, right: literal('3') }),
};
const loopBound = { kind: 'binary', operator: '<', left: loopIndex, right: { kind: 'binary', operator: '-', left: len, right: literal('2') } };

const artifact = {
  contractName: 'UniswapV2Router02',
  abi: [{
    name: 'swapExactTokensForTokens',
    inputs: [
      { name: 'amountIn', type: 'uint256' }, { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' }, { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  }],
} as unknown as Artifact;

const row = (condition: unknown): ExternalCallAbi => ({
  occurrence: 'loop', condition, argSources: [pathAt('1'), pathAt('2')],
} as unknown as ExternalCallAbi);

const count = (condition: unknown, hops: number): number => {
  const path = Array.from({ length: hops + 1 }, (_unused, index) => Uint8Array.of(0x76, 0xa9, 0x14,
    ...new Uint8Array(20).fill(index + 1), 0x88, 0xac));
  const args = [1_000n, 0n, path, path[0]!, 0n];
  const resolver = makeCallResolver({ artifact, functionName: 'swapExactTokensForTokens', args, stateValues: {} } as never);
  return occurrenceCountOf(
    row(condition), args, resolver, 'the loop', artifact, {} as never, 16, [], undefined,
  );
};

describe('a loop site behind a guard the caller rules out', () => {
  const inlineSwapGuard = { kind: 'binary', operator: '&&', left: pastStatedArms, right: loopBound };

  it('places no record for a one- or two-hop path, which takes a stated arm', () => {
    expect(count(inlineSwapGuard, 1)).toBe(0);
    expect(count(inlineSwapGuard, 2)).toBe(0);
  });

  it('still refuses by name a path that reaches the loop, whose width nothing published fixes', () => {
    expect(() => count(inlineSwapGuard, 3)).toThrow(/runs a loop whose bound is not fixed/);
  });

  it('never decides a loop by a conjunct that reads the turn', () => {
    // `i < len - 2` is false on turn 0 of a two-hop path, but a later turn could make it true: only a conjunct with
    // one value on every turn may rule the loop out.
    expect(() => count(loopBound, 2)).toThrow(/runs a loop whose bound is not fixed/);
  });
});
