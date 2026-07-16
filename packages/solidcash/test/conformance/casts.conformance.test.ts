// Cast conformance: integer width/sign. NOTE: SolidCash INTENTIONALLY range-checks narrowing casts and
// REVERTS on data loss (a safety divergence from Solidity, with an unsafe() escape hatch), so the truncation
// and same-width sign-reinterpret cases are marked as documented divergences pending an evmCompat decision.
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

describe('casts DIVERGENCE (SolidCash safety by design): truncation reverts, and byte-order', () => {
  // EVM narrowing TRUNCATES (uint8(0x1234)==0x34); SolidCash range-checks + REVERTS (use unsafe() to truncate).
  it.fails('uint256 -> uint8 truncation (0x1234 -> 0x34) reverts on BCH', () => c('uint8(a)', 'uint a', 'uint8', [0x1234n]));
  it.fails('int -> uint reinterpret (-1 -> 2^256-1) reverts on BCH', () => c('uint256(a)', 'int a', 'uint', [-1n]));
  // uint <-> bytesN byte-order is little-endian on BCH vs big-endian on EVM (spec 8.3), until evmCompat.
  it.fails('uint256(bytes32(0x00..ff)) == 255 on EVM (BE), diverges on BCH (LE)', () => c('uint256(a)', 'bytes32 a', 'uint', [`0x${'00'.repeat(31)}ff`]));
});
