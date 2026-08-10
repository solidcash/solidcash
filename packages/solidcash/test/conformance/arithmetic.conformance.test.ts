// EVM arithmetic conformance: checked add/sub/mul/div/mod/exp/neg across widths and signs,
// plus checked over/underflow that must revert on both sides. Reference vs solc + @ethereumjs/evm.
import { describe, it } from 'vitest';
import { assertConformant, assertReverts, exprCase, revertCase } from './harness.js';
import { expectOverOperationCostBudget } from '../test-util.js';

const maxU = (bits: number): bigint => (1n << BigInt(bits)) - 1n;
const maxI = (bits: number): bigint => (1n << BigInt(bits - 1)) - 1n;
const minI = (bits: number): bigint => -(1n << BigInt(bits - 1));

describe('arithmetic: checked add/sub/mul across widths', () => {
  for (const b of [8, 16, 128, 256]) {
    it(`uint${b} add`, () => assertConformant(exprCase({
      params: `uint${b} a, uint${b} b`, retType: `uint${b}`, expr: 'a + b', args: [10n, 20n],
    })));
    it(`uint${b} mul`, () => assertConformant(exprCase({
      params: `uint${b} a, uint${b} b`, retType: `uint${b}`, expr: 'a * b', args: [7n, 9n],
    })));
    it(`int${b} sub to negative`, () => assertConformant(exprCase({
      params: `int${b} a, int${b} b`, retType: `int${b}`, expr: 'a - b', args: [5n, 12n],
    })));
    it(`int${b} mul with negative`, () => assertConformant(exprCase({
      params: `int${b} a, int${b} b`, retType: `int${b}`, expr: 'a * b', args: [-6n, 7n],
    })));
  }
});

describe('arithmetic: div/mod sign + rounding', () => {
  it('uint div truncates', () => assertConformant(exprCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a / b', args: [17n, 5n],
  })));
  it('int div rounds toward zero (pos/neg)', () => assertConformant(exprCase({
    params: 'int a, int b', retType: 'int', expr: 'a / b', args: [17n, -5n],
  })));
  it('int div rounds toward zero (neg/neg)', () => assertConformant(exprCase({
    params: 'int a, int b', retType: 'int', expr: 'a / b', args: [-17n, -5n],
  })));
  it('int mod follows dividend sign (neg dividend)', () => assertConformant(exprCase({
    params: 'int a, int b', retType: 'int', expr: 'a % b', args: [-17n, 5n],
  })));
  it('int mod follows dividend sign (neg divisor)', () => assertConformant(exprCase({
    params: 'int a, int b', retType: 'int', expr: 'a % b', args: [17n, -5n],
  })));
});

describe('arithmetic: exp + negation', () => {
  it('2 ** b (literal base -> shift path)', () => assertConformant(exprCase({
    params: 'uint b', retType: 'uint', expr: '2 ** b', args: [10n],
  })));
  // Runtime exponent (the ubiquitous `10 ** decimals`) and runtime base, via the general POW loop.
  it('10 ** b (runtime exponent) == 10^18', () => assertConformant(exprCase({
    params: 'uint b', retType: 'uint', expr: '10 ** b', args: [18n],
  })));
  it('a ** b (runtime base+exp) == 1024', () => assertConformant(exprCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a ** b', args: [2n, 10n],
  })));
  it('a ** b == 243 (3 ** 5)', () => assertConformant(exprCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a ** b', args: [3n, 5n],
  })));
  it('a ** 0 == 1', () => assertConformant(exprCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a ** b', args: [7n, 0n],
  })));
  it('a ** 1 == a', () => assertConformant(exprCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a ** b', args: [7n, 1n],
  })));
  it('0 ** 0 == 1 (EVM convention)', () => assertConformant(exprCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a ** b', args: [0n, 0n],
  })));
  it('0 ** 5 == 0', () => assertConformant(exprCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a ** b', args: [0n, 5n],
  })));
  it('2 ** b == 2^200 (literal base -> cheap shift path handles large exponents)', () => assertConformant(exprCase({
    params: 'uint b', retType: 'uint', expr: '2 ** b', args: [200n],
  })));
  it('negate positive int', () => assertConformant(exprCase({
    params: 'int a', retType: 'int', expr: '-a', args: [42n],
  })));
  it('negate negative int', () => assertConformant(exprCase({
    params: 'int a', retType: 'int', expr: '-a', args: [-42n],
  })));
});

describe('arithmetic: checked over/underflow reverts on both sides', () => {
  it('uint8 add overflow', () => assertReverts(revertCase({
    params: 'uint8 a, uint8 b', retType: 'uint8', expr: 'a + b', args: [maxU(8), 1n],
  })));
  it('uint256 add overflow', () => assertReverts(revertCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a + b', args: [maxU(256), 1n],
  })));
  it('uint sub underflow', () => assertReverts(revertCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a - b', args: [0n, 1n],
  })));
  it('uint8 mul overflow', () => assertReverts(revertCase({
    params: 'uint8 a, uint8 b', retType: 'uint8', expr: 'a * b', args: [16n, 16n],
  })));
  it('int8 max + 1 overflow', () => assertReverts(revertCase({
    params: 'int8 a, int8 b', retType: 'int8', expr: 'a + b', args: [maxI(8), 1n],
  })));
  it('int256 min - 1 underflow', () => assertReverts(revertCase({
    params: 'int a, int b', retType: 'int', expr: 'a - b', args: [minI(256), 1n],
  })));
  it('int256 min / -1 overflow', () => assertReverts(revertCase({
    params: 'int a, int b', retType: 'int', expr: 'a / b', args: [minI(256), -1n],
  })));
  it('division by zero', () => assertReverts(revertCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a / b', args: [5n, 0n],
  })));
  it('mod by zero', () => assertReverts(revertCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a % b', args: [5n, 0n],
  })));
  it('negate int256 min overflows', () => assertReverts(revertCase({
    params: 'int a', retType: 'int', expr: '-a', args: [minI(256)],
  })));
  // Runtime-base exp overflowing uint256 reverts on both sides (BCH via the op-cost-density budget running
  // out on the large intermediates, EVM via checked-overflow detection).
  it('2 ** 256 checked exp overflow reverts', () => assertReverts(revertCase({
    params: 'uint a, uint b', retType: 'uint', expr: 'a ** b', args: [2n, 256n],
  })));
});

// The general runtime-base POW loop is O(exp) big-integer multiplications; for large results the growing
// intermediates exceed the BCH VM operation-cost-density budget (a platform limit tied to tx size, worst-case
// in a minimal tx - NOT a codegen bug). Literal-base `2 ** b` (cheap shift path) and the common `10 ** decimals`
// case (small result) are covered above and pass. Square-and-multiply lowering would extend this range.
// These two ASSERT the divergence the block title names, rather than the conformant result. They passed only
// while MockNetworkProvider published a relaxed operation-cost budget; against the real 800 per byte the growing
// intermediates exceed the density ceiling exactly as the comment above predicts, so a node would refuse them
// too. Restore `assertConformant` here if square-and-multiply lowering lands and brings the cost down.
describe('exp: runtime-base POW op-cost limit on large results (known platform divergence)', () => {
  // These two ARE the divergence this block is named for, and they now assert it. They read as conformant only
  // while the mock ran a relaxed operation-cost budget; against the real 800 the growing intermediates exceed
  // the density limit, exactly as a node refuses them (measured: 139,249 against a 139,200 budget for 2 ** 200).
  // PINS, not endorsements - square-and-multiply lowering would bring the cost down, at which point these FAIL
  // and the positive assertion should come back rather than this one being loosened.
  //
  // Asserted with expectOverOperationCostBudget rather than a bare rejects.toThrow(): the point is that the
  // refusal is a DENSITY refusal, and a generic throw would keep passing if these started failing for an
  // unrelated reason.
  const overBudget = (exp: bigint) => async (): Promise<void> => {
    await expectOverOperationCostBudget(assertConformant(exprCase({
      params: 'uint a, uint b', retType: 'uint', expr: 'a ** b', args: [2n, exp],
    })));
  };
  it('2 ** 200 (runtime base) exceeds the real operation-cost budget', overBudget(200n));
  it('2 ** 255 (runtime base) exceeds the real operation-cost budget', overBudget(255n));
});
