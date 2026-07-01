import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// `&&` / `||` must short-circuit (Solidity semantics): the right operand is only evaluated when
// needed. Each function's RHS divides by the argument, which FAILS the script (div-by-zero) if the
// VM ever evaluates it. Spending with the short-circuiting argument must therefore succeed.
// Compiled with { forceStateful: true } so each spend is the short `sc.<fn>(arg).send()` (no dummy state).
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

async function spend(fn: string, arg: bigint): Promise<unknown> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  const address = contract.withCategory(hexToBin(categoryId)).address;
  const sc = new StatefulContract(address, artifact, provider); // attach by address
  return sc.call[fn](arg); // thenable: the caller awaits, which sends
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
