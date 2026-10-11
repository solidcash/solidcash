// Inline-assembly (Yul) conformance. EVM assembly is UNCHECKED: arithmetic wraps mod 2^256, div/mod by zero return
// 0 (no revert), and the signed builtins read their words as two's complement. Every case runs against the EVM
// reference in both compile modes.
import { describe, it } from 'vitest';
import { assertConformant, asmCase } from './harness.js';

const MAX = (1n << 256n) - 1n;
// The two's-complement word of a (possibly negative) value.
const word = (v: bigint): bigint => (v < 0n ? (1n << 256n) + v : v);

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
  it('byte(31, 0xab) == 0xab (big-endian byte index)', () => asm('r := byte(n, x)', 'uint n, uint x', [31n, 0xabn]));
});

describe('assembly: unchecked word arithmetic (wraps mod 2^256, a zero divisor or modulus gives 0)', () => {
  it('add wraps (MAX + 1 == 0)', () => asm('r := add(a, b)', 'uint a, uint b', [MAX, 1n]));
  it('sub wraps (0 - 1 == MAX)', () => asm('r := sub(a, b)', 'uint a, uint b', [0n, 1n]));
  it('mul wraps (MAX * 2 == MAX - 1)', () => asm('r := mul(a, b)', 'uint a, uint b', [MAX, 2n]));
  it('div by zero is 0', () => asm('r := div(a, b)', 'uint a, uint b', [5n, 0n]));
  it('mod by zero is 0', () => asm('r := mod(a, b)', 'uint a, uint b', [5n, 0n]));
  it('shl drops the high bits (shl(4, MAX) == MAX - 15)', () => asm('r := shl(sh, v)', 'uint sh, uint v', [4n, MAX]));
  it('shl past the word is 0 (shl(300, 1))', () => asm('r := shl(sh, v)', 'uint sh, uint v', [300n, 1n]));
  it('shl by 2^200 is 0', () => asm('r := shl(sh, v)', 'uint sh, uint v', [1n << 200n, MAX]));
  it('addmod by a zero modulus is 0', () => asm('r := addmod(a, b, m)', 'uint a, uint b, uint m', [MAX, 5n, 0n]));
  it('mulmod by a zero modulus is 0', () => asm('r := mulmod(a, b, m)', 'uint a, uint b, uint m', [MAX, 3n, 0n]));
  it('exp wraps (3^200 mod 2^256)', () => asm('r := exp(b, e)', 'uint b, uint e', [3n, 200n]));
  it('exp(2, 256) == 0', () => asm('r := exp(b, e)', 'uint b, uint e', [2n, 256n]));
  it('exp(0, 0) == 1', () => asm('r := exp(b, e)', 'uint b, uint e', [0n, 0n]));
  it('exp(2, e) past the word is 0 (literal base)', () => asm('r := exp(2, e)', 'uint e', [300n]));
  it('literal exp folds to its word (3^200 mod 2^256)', () => asm('r := exp(3, 200)', '', []));
});

describe('assembly: signed builtins read words as two\'s complement', () => {
  it('sar(1, -1) == -1 (arithmetic shift)', () => asm('r := sar(sh, v)', 'uint sh, uint v', [1n, MAX]));
  it('sar(4, -256) == -16', () => asm('r := sar(sh, v)', 'uint sh, uint v', [4n, word(-256n)]));
  it('sar(300, -5) == -1 (shift past the word)', () => asm('r := sar(sh, v)', 'uint sh, uint v', [300n, word(-5n)]));
  it('slt(-1, 1) == 1', () => asm('r := slt(a, b)', 'uint a, uint b', [MAX, 1n]));
  it('slt(1, -1) == 0', () => asm('r := slt(a, b)', 'uint a, uint b', [1n, MAX]));
  it('sgt(-1, 1) == 0', () => asm('r := sgt(a, b)', 'uint a, uint b', [MAX, 1n]));
  it('sgt(1, -2) == 1', () => asm('r := sgt(a, b)', 'uint a, uint b', [1n, word(-2n)]));
  it('sdiv(-7, 2) == -3 (truncates toward zero)', () => asm('r := sdiv(a, b)', 'uint a, uint b', [word(-7n), 2n]));
  it('sdiv(7, -2) == -3', () => asm('r := sdiv(a, b)', 'uint a, uint b', [7n, word(-2n)]));
  it('sdiv(-2^255, -1) == -2^255 (overflow wraps)', () => asm('r := sdiv(a, b)', 'uint a, uint b', [1n << 255n, MAX]));
  it('sdiv by zero is 0', () => asm('r := sdiv(a, b)', 'uint a, uint b', [word(-7n), 0n]));
  it('smod(-7, 3) == -1 (sign of the dividend)', () => asm('r := smod(a, b)', 'uint a, uint b', [word(-7n), 3n]));
  it('smod(7, -3) == 1', () => asm('r := smod(a, b)', 'uint a, uint b', [7n, word(-3n)]));
  it('smod by zero is 0', () => asm('r := smod(a, b)', 'uint a, uint b', [word(-7n), 0n]));
  it('signextend(0, 0xff) == -1', () => asm('r := signextend(n, x)', 'uint n, uint x', [0n, 0xffn]));
  it('signextend(1, 0x127fff) == 0x7fff', () => asm('r := signextend(n, x)', 'uint n, uint x', [1n, 0x127fffn]));
  it('signextend(40, 0x80) == 0x80 (index past 31)', () => asm('r := signextend(n, x)', 'uint n, uint x', [40n, 0x80n]));
  it('signextend(2, 0x800000) == -2^23 (literal index)', () => asm('r := signextend(2, x)', 'uint x', [0x800000n]));
});

// OpenZeppelin Math.mul512 / mulDiv: the 512-bit product [hi lo] from wrapping mul, mulmod and sub.
describe('assembly: mulDiv-style 512-bit product', () => {
  const MUL512 = 'let mm := mulmod(a, b, not(0)) let lo := mul(a, b) let hi := sub(sub(mm, lo), lt(mm, lo))';
  it('high word of MAX * MAX', () => asm(`${MUL512} r := hi`, 'uint a, uint b', [MAX, MAX]));
  it('high word of a wide product', () => asm(`${MUL512} r := hi`, 'uint a, uint b', [MAX - 2n ** 77n, 2n ** 200n + 7n]));
  it('subtracting the remainder borrows across the words', () => asm(
    `${MUL512} let rem := mulmod(a, b, d) hi := sub(hi, gt(rem, lo)) lo := sub(lo, rem) r := add(hi, lo)`,
    'uint a, uint b, uint d',
    [1n << 128n, 1n << 128n, 1000003n],
  ));
});
