// Inline-assembly (Yul) conformance. EVM assembly is UNCHECKED: arithmetic wraps mod 2^256, div/mod by zero return
// 0 (no revert), and the signed builtins read their words as two's complement. Every case runs against the EVM
// reference in both compile modes.
import { describe, it } from 'vitest';
import {
  assertConformant, assertReverts, asmCase, fnCase, fnRevertCase,
} from './harness.js';

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

// Yul break/continue (solc semanticTests inlineAssembly/for_loop_*). Yul lowers after the break/continue expansion
// of source loops, and an unexpanded break or continue emitted nothing.
describe('assembly: for-loop break and continue', () => {
  it('break skips the rest of the body and the post block', () => asm(
    'for {} lt(r, 10) { r := add(r, 1) } { if eq(r, 6) { break } r := add(r, 1) }', '', [],
  ));
  it('continue still runs the post block', () => asm(
    'for { let i := 0 } lt(i, n) { i := add(i, 1) } { if eq(mod(i, 2), 0) { continue } r := add(r, 1) }',
    'uint n', [10n],
  ));
  // The fixture's ten outer iterations (x = 2) outrun a small script's operation budget; four keep every path, and
  // the deployer adds a density reserve.
  const NESTED = 'let y := x for {} lt(r, 4) { r := add(r, 1) } { if eq(y, 0) { r := 2 break } '
    + 'for {} lt(y, 3) { r := 17 y := 9 } { if eq(y, 1) { continue } if eq(y, 2) { break } } '
    + 'if eq(y, 4) { r := 90 } }';
  for (const x of [0n, 1n, 2n, 4n]) {
    it(`nested loops: each break/continue binds to its own loop (x = ${x})`, () => assertConformant({
      ...asmCase({ params: 'uint x', retType: 'uint', yul: NESTED, args: [x] }), densityReserve: 512,
    }));
  }
  it('break skips a multi-statement post block', () => asm(
    'for { let i := 0 } lt(i, 10) { i := add(i, 1) r := add(r, 2) } { if eq(i, 3) { break } }', '', [],
  ));
  it('continue in a switch case skips the statements after the switch', () => asm(
    'for { let i := 0 } lt(i, n) { i := add(i, 1) } { switch mod(i, 3) case 0 { continue } '
      + 'case 1 { r := add(r, 10) } default { r := add(r, 100) continue } r := add(r, 1) }',
    'uint n', [7n],
  ));
  it('break in a switch case leaves the loop', () => asm(
    'for { let i := 0 } lt(i, 10) { i := add(i, 1) } { switch i case 4 { break } default { r := add(r, i) } '
      + 'r := add(r, 1) }', '', [],
  ));
});

// `x := w` writes the raw word; Solidity cleans it to x's width at each use (low bits, sign-extended for intN). A
// signed source is read as its two's-complement word.
describe('assembly: a word assigned to a narrower integer is cleaned to its width', () => {
  const clean = (params: string, retType: string, body: string, args: readonly unknown[], label: string): Promise<void> =>
    assertConformant(fnCase({ params, retType, body, args, label }));
  it('uint8 := 0x0101 then + 1 == 2', () => clean(
    '', 'uint8', 'uint8 x = 0; assembly { x := 0x0101 } return x + 1;', [], 'uint8 wide literal'));
  it('uint8 := 0x0101 compares equal to 1', () => clean(
    '', 'bool', 'uint8 x = 1; uint8 y = 0; assembly { y := 0x0101 } return x == y;', [], 'uint8 compare'));
  it('int8 := 0xf0 sign-extends, then >> 3 == -2', () => clean(
    'uint8 b', 'int', 'int8 a = 0; assembly { a := 0xf0 } return a >> b;', [3n], 'int8 signextend shift'));
  it('~ of int8 := 0x9c is 99', () => clean(
    '', 'int', 'int8 a = 0; assembly { a := 0x9C } a = ~a; return a;', [], 'int8 bitnot'));
  it('int16 := int256 0x01fffe keeps the low half (-2)', () => clean(
    'int a', 'int', 'int16 x = 0; assembly { x := a } return x;', [0x01fffen], 'int16 from int256'));
  it('int8 := int256 -1 is -1', () => clean(
    'int a', 'int', 'int8 x = 0; assembly { x := a } return x;', [-1n], 'int8 from negative int256'));
  it('uint8 := int256 -2 is 0xfe', () => clean(
    'int a', 'uint8', 'uint8 x = 0; assembly { x := a } return x;', [-2n], 'uint8 from negative int256'));
  it('uint := int256 -7 is its two\'s-complement word', () => clean(
    'int a', 'uint', 'uint r = 0; assembly { r := a } return r;', [-7n], 'uint from negative int256'));
  it('int := sub(0, 7) is -7', () => clean(
    'uint a', 'int', 'int x = 0; assembly { x := sub(0, a) } return x;', [7n], 'int256 from word'));
  it('int8 := 0x80 is -128, so -x still overflows', () => assertReverts(fnRevertCase({
    params: '', retType: 'int8', body: 'int8 x = 0; assembly { x := 0x80 } return -x;', args: [], label: 'int8 neg',
  })));
});

// EVM memory is function-scoped: a later assembly block of the same function loads what an earlier one stored.
describe('assembly: memory stored in one block is loaded by a later block', () => {
  const flow = (params: string, body: string, args: readonly unknown[], label: string): Promise<void> =>
    assertConformant(fnCase({ params, retType: 'uint', body, args, label }));
  it('mstore(0, v) then mload(0) in the next block', () => flow(
    'uint v', 'uint x = 0; assembly { mstore(0, v) } assembly { x := mload(0) } return x;', [0x42n], 'scratch word'));
  it('a free-memory-pointer bump is seen by a later block', () => flow(
    'uint n', 'uint a = 0; uint b = 0; assembly { a := mload(0x40) } '
      + 'assembly { let p := mload(0x40) mstore(0x40, add(p, n)) } assembly { b := mload(0x40) } return b - a;',
    [0x20n], 'free pointer bump'));
  it('a word stored before a branch is loaded inside it', () => flow(
    'uint v', 'uint x = 0; assembly { mstore(0x20, v) } if (v > 3) { assembly { x := mload(0x20) } } return x;',
    [5n], 'branch load'));
});
