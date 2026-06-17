import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// `&&` / `||` must short-circuit (Solidity semantics): the right operand is only evaluated when
// needed. Each function's RHS divides by the argument, which FAILS the script (div-by-zero) if the
// VM ever evaluates it. Spending with the short-circuiting argument must therefore succeed.
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
  const provider: MockNetworkProvider = createTestProvider();
  const contract = new Contract(compileString(SOURCE), [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });
  return new TransactionBuilder({ provider })
    .addInputs(utxos, contract.unlock[fn](arg))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
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
