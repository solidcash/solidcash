import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// `&&` / `||` must short-circuit (Solidity semantics): the right operand is only evaluated when
// needed. Each function's RHS divides by the argument, which FAILS the script (div-by-zero) if the
// VM ever evaluates it. Spending with the short-circuiting argument must therefore succeed.
// A nominal `nonce` state field makes this stateful, so each spend is the short `sc.<fn>(arg).send()`.
const SOURCE = `
contract ShortCircuit() {
    int nonce;
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

async function spend(fn: string, arg: bigint): Promise<unknown> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE);
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { nonce: 0n }, { saltContract: true },
  );
  const sc = new StatefulContract(categoryId, artifact, provider);
  return sc.call[fn](arg).send();
}

describe('Short-circuit && / ||', () => {
  it('|| skips the right operand (would div-by-zero) when the left is true', async () => {
    await expect(spend('spendOr', 0n)).resolves.toBeDefined();
  });

  it('|| still evaluates the right operand when the left is false', async () => {
    await expect(spend('spendOr', 5n)).resolves.toBeDefined();
  });

  it('&& skips the right operand (would div-by-zero) when the left is false', async () => {
    await expect(spend('spendAnd', 0n)).resolves.toBeDefined();
  });
});
