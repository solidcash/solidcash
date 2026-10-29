import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../src/compiler.js';

/**
 * A call argument read from a mapping at the frame's start is published as such (`readAtEntry`).
 *
 * `drain` keeps the balance it read before it zeroes it, so the call takes the value the frame started with. `bump`
 * passes the value it has just written, which the framed lowering caches in a local the body updates: that read is
 * where the call is, past the write, and is published without the mark.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' interface ISink { function take(uint256 v) external; }'
  + ' contract Pool { mapping(address => uint256) balances; mapping(uint256 => uint256) amounts; ISink sink;'
  + '   function drain(address who) external { uint256 had = balances[who]; balances[who] = 0; sink.take(had); }'
  + '   function bump(uint256 k) external { amounts[k] = amounts[k] + 1; sink.take(amounts[k]); } }';

const pool = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never).Pool!;
const argument = (entry: string): { readonly kind: string; readonly readAtEntry?: boolean } => {
  const source = pool.abi.find((candidate) => candidate.name === entry)!.externalCalls![0]!.argSources![0]!;
  return (source as { readonly expression: { readonly kind: string; readonly readAtEntry?: boolean } }).expression;
};

describe('a call argument read from a mapping', () => {
  it('is read at the frame\'s start where a local its declaration gives the value holds it', () => {
    expect(argument('drain')).toMatchObject({ kind: 'stateAccess', readAtEntry: true });
  });

  it('is read where the call is for a value the body updates before the call', () => {
    expect(argument('bump').kind).toBe('stateAccess');
    expect(argument('bump').readAtEntry).toBeUndefined();
  });
});
