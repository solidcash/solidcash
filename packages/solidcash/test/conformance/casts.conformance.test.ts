// Cast conformance: integer width/sign. NOTE: native SolidCash INTENTIONALLY range-checks narrowing casts and
// REVERTS on data loss (a safety divergence from Solidity, with an unsafe() escape hatch); evmCompat truncates like
// the EVM. Same-width int <-> uint keeps the two's-complement bits in evmCompat, as on the EVM; native reverts.
import { describe, it } from 'vitest';
import { assertConformant, exprCase } from './harness.js';

const c = (expr: string, params: string, retType: string, args: readonly unknown[]): Promise<void> =>
  assertConformant(exprCase({ params, retType, expr, args }));

describe('casts: integer width + sign (in range - matches)', () => {
  it('uint256 -> uint8 in range (200)', () => c('uint8(a)', 'uint a', 'uint8', [200n]));
  it('uint8 -> uint256 zero-extends', () => c('uint256(a)', 'uint8 a', 'uint', [0xffn]));
  it('int8 -> int256 sign-extends (-1)', () => c('int256(a)', 'int8 a', 'int', [-1n]));
  it('int16 -> int8 in range (-1)', () => c('int8(a)', 'int16 a', 'int8', [-1n]));
  it('uint -> int (in range)', () => c('int256(a)', 'uint a', 'int', [5n]));
  it('int -> uint (positive)', () => c('uint256(a)', 'int a', 'uint', [5n]));
});

describe('casts: narrowing and byte order, per compile mode', () => {
  const inMode = (evmCompat: boolean) => (
    expr: string, params: string, retType: string, args: readonly unknown[],
  ): Promise<void> => assertConformant({ ...exprCase({ params, retType, expr, args }), evmCompat });
  const native = inMode(false);
  const compat = inMode(true);
  const BE_255 = `0x${'00'.repeat(31)}ff`;
  const TOP_BIT = (1n << 255n) + 0x1234n;

  // EVM narrowing truncates (uint8(0x1234) == 0x34), and so does evmCompat. Native SolidCash range-checks and reverts
  // on data loss (unsafe casts truncate): a deliberate safety divergence.
  it('evmCompat: uint256 -> uint8 truncates (0x1234 -> 0x34)', () => compat('uint8(a)', 'uint a', 'uint8', [0x1234n]));
  it.fails('native: uint256 -> uint8 truncation reverts', () => native('uint8(a)', 'uint a', 'uint8', [0x1234n]));
  // Same-width sign reinterpretation keeps the two's-complement bits on the EVM and in evmCompat; native SolidCash
  // range-checks the cast and reverts.
  it('evmCompat: int -> uint reinterpret (-1 -> 2^256-1)', () => compat('uint256(a)', 'int a', 'uint', [-1n]));
  it.fails('native: int -> uint reinterpret (-1 -> 2^256-1) reverts', () => native('uint256(a)', 'int a', 'uint', [-1n]));
  // The signed min, -1 and max, and the unsigned values that reinterpret to them.
  for (const bits of [8, 32, 256]) {
    const s = `int${bits}`;
    const u = `uint${bits}`;
    const half = 1n << BigInt(bits - 1);
    const extremes: readonly (readonly [string, bigint, bigint])[] = [
      ['min', -half, half], ['-1', -1n, 2n * half - 1n], ['max', half - 1n, half - 1n],
    ];
    for (const [name, signed, unsigned] of extremes) {
      it(`evmCompat: ${u}(${s} ${name})`, () => compat(`${u}(a)`, `${s} a`, u, [signed]));
      it(`evmCompat: ${s}(${u}) == ${s} ${name}`, () => compat(`${s}(a)`, `${u} a`, s, [unsigned]));
    }
  }
  // bytesN <-> uint byte order: big-endian on the EVM and under evmCompat, little-endian in native SolidCash.
  it('evmCompat: uint256(bytes32(0x00..ff)) == 255 (big-endian)', () => compat('uint256(a)', 'bytes32 a', 'uint', [BE_255]));
  // A same-width unsigned value with its top bit set converts too (its VM number needs a sign byte).
  it('evmCompat: bytes32(uint256) with the top bit set', () => compat('bytes32(a)', 'uint a', 'bytes32', [TOP_BIT]));
  it('evmCompat: bytes4(uint32) with the top bit set', () => compat('bytes4(a)', 'uint32 a', 'bytes4', [0xabcdef00n]));
  it.fails('native: uint256(bytes32(0x00..ff)) reads little-endian', () => native('uint256(a)', 'bytes32 a', 'uint', [BE_255]));
});
