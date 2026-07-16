// Comparison conformance: signed vs unsigned ordering, equality on ints and bytesN.
import { describe, it } from 'vitest';
import { assertConformant, exprCase } from './harness.js';

const MAX = (1n << 256n) - 1n;
const c = (expr: string, params: string, retType: string, args: readonly unknown[]): Promise<void> =>
  assertConformant(exprCase({ params, retType, expr, args }));

describe('comparisons', () => {
  it('int < (signed, neg/pos)', () => c('a < b', 'int a, int b', 'bool', [-5n, 3n]));
  it('int > (signed)', () => c('a > b', 'int a, int b', 'bool', [-5n, 3n]));
  it('int <= (equal)', () => c('a <= b', 'int a, int b', 'bool', [3n, 3n]));
  it('int >= (neg/neg)', () => c('a >= b', 'int a, int b', 'bool', [-1n, -2n]));
  it('int == (neg)', () => c('a == b', 'int a, int b', 'bool', [-7n, -7n]));
  it('int != (neg/pos)', () => c('a != b', 'int a, int b', 'bool', [-7n, 7n]));
  it('int -1 < 1 (signed ordering)', () => c('a < b', 'int a, int b', 'bool', [-1n, 1n]));
  it('uint <', () => c('a < b', 'uint a, uint b', 'bool', [5n, 3n]));
  it('uint MAX > 1 (unsigned ordering)', () => c('a > b', 'uint a, uint b', 'bool', [MAX, 1n]));
  it('bytes32 == (equal)', () => c('a == b', 'bytes32 a, bytes32 b', 'bool', [`0x${'ab'.repeat(32)}`, `0x${'ab'.repeat(32)}`]));
  it('bytes32 != ', () => c('a != b', 'bytes32 a, bytes32 b', 'bool', [`0x${'ab'.repeat(32)}`, `0x${'cd'.repeat(32)}`]));
});
