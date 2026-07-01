import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

// `&&` / `||` must short-circuit (Solidity semantics): the right operand is only evaluated when
// needed. Each function's RHS divides by the argument, which FAILS the script (div-by-zero) if the
// VM ever evaluates it. Spending with the short-circuiting argument must therefore succeed.
// Compiled with { forceStateful: true } so each test can deploy + call directly (`await sc.<fn>(arg)`).
const SOURCE = `
contract ShortCircuit() {
    function spendOr(int x) {
        // x == 0 short-circuits the ||, so 100 / x is never evaluated.
        require(x == 0 || 100 / x > 0);
    }
    function spendAnd(int x) {
        // x != 0 is false, so the && skips 100 / x; b is false and require(!b) passes.
        bool b = x != 0 && 100 / x > 50;
        require(!b);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('Short-circuit && / ||', () => {
  it('|| skips the right operand (would div-by-zero) when the left is true', async () => {
    const sc = await deployStateful(artifact);
    await expect(sc.spendOr(0n)).resolves.toBeDefined();
  });

  it('|| still evaluates the right operand when the left is false', async () => {
    const sc = await deployStateful(artifact);
    await expect(sc.spendOr(5n)).resolves.toBeDefined();
  });

  it('&& skips the right operand (would div-by-zero) when the left is false', async () => {
    const sc = await deployStateful(artifact);
    await expect(sc.spendAnd(0n)).resolves.toBeDefined();
  });
});
