// EVM unchecked (wrapping) conformance: mod-2^N two's-complement wrap across widths and signs.
// Uses same-width variable operands so the wrap is exercised on the fixed-width type (a bare integer
// literal is probed separately in literals.conformance for its promotion behavior).
import { describe, it } from 'vitest';
import { assertConformant, exprCase } from './harness.js';

const maxU = (bits: number): bigint => (1n << BigInt(bits)) - 1n;
const maxI = (bits: number): bigint => (1n << BigInt(bits - 1)) - 1n;
const minI = (bits: number): bigint => -(1n << BigInt(bits - 1));

describe('unchecked wrapping', () => {
  it('uint256 max + 1 -> 0', () => assertConformant(exprCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a + b', unchecked: true, args: [maxU(256), 1n],
  })));
  it('uint8 255 + 1 -> 0', () => assertConformant(exprCase({
    params: 'uint8 a, uint8 b', retType: 'uint8', expr: 'a + b', unchecked: true, args: [maxU(8), 1n],
  })));
  it('uint256 0 - 1 -> max', () => assertConformant(exprCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a - b', unchecked: true, args: [0n, 1n],
  })));
  it('int256 max + 1 -> int256.min', () => assertConformant(exprCase({
    params: 'int a, int b', retType: 'int', expr: 'a + b', unchecked: true, args: [maxI(256), 1n],
  })));
  it('int8 127 + 1 -> -128', () => assertConformant(exprCase({
    params: 'int8 a, int8 b', retType: 'int8', expr: 'a + b', unchecked: true, args: [maxI(8), 1n],
  })));
  it('int256 min - 1 -> int256.max', () => assertConformant(exprCase({
    params: 'int a, int b', retType: 'int', expr: 'a - b', unchecked: true, args: [minI(256), 1n],
  })));
  it('uint8 16 * 16 -> 0 (256 wraps)', () => assertConformant(exprCase({
    params: 'uint8 a, uint8 b', retType: 'uint8', expr: 'a * b', unchecked: true, args: [16n, 16n],
  })));
  it('int8 negate min -> min (-(-128) == -128)', () => assertConformant(exprCase({
    params: 'int8 a', retType: 'int8', expr: '-a', unchecked: true, args: [minI(8)],
  })));
});
