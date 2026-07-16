// Inline-assembly (Yul) conformance. EVM assembly is inherently UNCHECKED: arithmetic wraps mod 2^256
// and div/mod by zero returns 0 (no revert). This file pins both what already matches and the known
// divergences (via it.fails), which flip loudly when the Yul lowering is made EVM-faithful.
import { describe, it } from 'vitest';
import { assertConformant, asmCase } from './harness.js';

const MAX = (1n << 256n) - 1n;

const asm = (yul: string, params: string, args: readonly unknown[]): Promise<void> =>
  assertConformant(asmCase({ params, retType: 'uint', yul, args }));

describe('assembly: matches EVM (in-range)', () => {
  it('add', () => asm('r := add(a, b)', 'uint a, uint b', [5n, 7n]));
  it('mul', () => asm('r := mul(a, b)', 'uint a, uint b', [6n, 7n]));
  it('div', () => asm('r := div(a, b)', 'uint a, uint b', [17n, 5n]));
  it('mod', () => asm('r := mod(a, b)', 'uint a, uint b', [17n, 5n]));
  it('and', () => asm('r := and(a, b)', 'uint a, uint b', [0xf0n, 0x3cn]));
  it('or', () => asm('r := or(a, b)', 'uint a, uint b', [0xf0n, 0x0fn]));
  it('xor', () => asm('r := xor(a, b)', 'uint a, uint b', [0xffn, 0x0fn]));
  it('not: ~0 == MAX', () => asm('r := not(a)', 'uint a', [0n]));
  it('shl: shl(4, 1) == 16', () => asm('r := shl(sh, v)', 'uint sh, uint v', [4n, 1n]));
  it('shr: shr(4, 256) == 16', () => asm('r := shr(sh, v)', 'uint sh, uint v', [4n, 256n]));
  it('lt', () => asm('r := lt(a, b)', 'uint a, uint b', [3n, 5n]));
  it('gt', () => asm('r := gt(a, b)', 'uint a, uint b', [5n, 3n]));
  it('eq', () => asm('r := eq(a, b)', 'uint a, uint b', [7n, 7n]));
  it('iszero', () => asm('r := iszero(a)', 'uint a', [0n]));
  it('addmod', () => asm('r := addmod(a, b, m)', 'uint a, uint b, uint m', [MAX, 5n, 7n]));
  it('mulmod', () => asm('r := mulmod(a, b, m)', 'uint a, uint b, uint m', [MAX, 3n, 11n]));
});

// KNOWN DIVERGENCE (SolidCash safety by design): EVM assembly is UNCHECKED - add/sub/mul wrap mod 2^256 and
// div/mod-by-zero return 0. SolidCash intentionally keeps inline-assembly arithmetic CHECKED (byte-identical
// to high-level, enforced by InlineAssemblyYul.test.ts), so overflow and div-by-zero REVERT. EVM-unchecked
// assembly belongs behind the evmCompat gate (with the abi work), like cast truncation.
describe('assembly KNOWN DIVERGENCE: arithmetic is checked (add/sub/mul overflow + div/mod-by-zero revert)', () => {
  it.fails('add should wrap (MAX + 1 == 0) but reverts', () => asm('r := add(a, b)', 'uint a, uint b', [MAX, 1n]));
  it.fails('sub should wrap (0 - 1 == MAX) but reverts', () => asm('r := sub(a, b)', 'uint a, uint b', [0n, 1n]));
  it.fails('mul should wrap but reverts', () => asm('r := mul(a, b)', 'uint a, uint b', [MAX, 2n]));
  it.fails('div by zero should be 0 but reverts', () => asm('r := div(a, b)', 'uint a, uint b', [5n, 0n]));
  it.fails('mod by zero should be 0 but reverts', () => asm('r := mod(a, b)', 'uint a, uint b', [5n, 0n]));
});

// KNOWN DIVERGENCE: sign-magnitude / little-endian vs EVM two's-complement big-endian
// (docs/platform-differences.md sections 1-2). sar/slt reinterpret the sign bit; byte indexes big-endian.
describe('assembly KNOWN DIVERGENCE: sign / byte-order', () => {
  it.fails('sar(1, -1) == -1 (arithmetic shift, twos-complement)', () => asm('r := sar(sh, v)', 'uint sh, uint v', [1n, MAX]));
  it.fails('slt(-1, 1) == 1 (signed less-than, twos-complement)', () => asm('r := slt(a, b)', 'uint a, uint b', [MAX, 1n]));
  it.fails('byte(31, 0xab) == 0xab (big-endian byte index)', () => asm('r := byte(n, x)', 'uint n, uint x', [31n, 0xabn]));
  it.fails('signextend(0, 0xff) == -1 (unsupported / diverges)', () => asm('r := signextend(n, x)', 'uint n, uint x', [0n, 0xffn]));
});
