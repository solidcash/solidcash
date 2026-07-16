// High-level bitwise + shift conformance. Signed >> is arithmetic (SAR); bitwise on negatives is defined
// on the two's-complement pattern in EVM - SolidCash claims to match (TypeCheckTraversal), pinned here.
import { describe, it } from 'vitest';
import { assertConformant, exprCase } from './harness.js';

const c = (expr: string, params: string, retType: string, args: readonly unknown[]): Promise<void> =>
  assertConformant(exprCase({ params, retType, expr, args }));

describe('bitwise + shifts (high-level)', () => {
  it('uint &', () => c('a & b', 'uint a, uint b', 'uint', [0xf0n, 0x3cn]));
  it('uint |', () => c('a | b', 'uint a, uint b', 'uint', [0xf0n, 0x0fn]));
  it('uint ^', () => c('a ^ b', 'uint a, uint b', 'uint', [0xffn, 0x0fn]));
  it('uint ~ (~0 == MAX)', () => c('~a', 'uint a', 'uint', [0n]));
  it('uint << (1 << 8 == 256)', () => c('a << b', 'uint a, uint b', 'uint', [1n, 8n]));
  it('uint >> (256 >> 4 == 16)', () => c('a >> b', 'uint a, uint b', 'uint', [256n, 4n]));
  it('int >> negative is SAR (-8 >> 1 == -4)', () => c('a >> b', 'int a, uint b', 'int', [-8n, 1n]));
  it('int & on negative (-1 & 255 == 255)', () => c('a & b', 'int a, int b', 'int', [-1n, 255n]));
  it('int | on negative', () => c('a | b', 'int a, int b', 'int', [-256n, 255n]));
  it('int ^ on negative', () => c('a ^ b', 'int a, int b', 'int', [-1n, -1n]));
});
