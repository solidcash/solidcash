import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { Contract } from '../../src/Contract.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { FailedRequireError, FailedTransactionEvaluationError } from '../../src/Errors.js';
import { randomUtxo } from '../../src/utils.js';
import { densityReserve } from '../test-util.js';

// A loop of 13 iterations outruns the operation budget this small script's own length buys. The deployer's salt is a
// density reserve: the pre-send check must evaluate the salted script, as a node does, or the reserve never helps.
const SRC = `contract Loop() {
  function calc(uint n) private pure returns (uint) {
    uint s = 0;
    for (uint i = 0; i < n; i++) { if (i % 3 == 0) continue; if (i > 12) break; s += i; }
    return s;
  }
  function f(uint n, uint expected) { require(calc(n) == expected); }
}`;
const artifact = compileString(SRC);

async function spend(salt: Uint8Array | undefined, expected: bigint): Promise<void> {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [], { provider, ...(salt ? { salt } : {}) });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
  const [utxo] = await contract.getUtxos();
  await new TransactionBuilder({ provider })
    .addInput(utxo, contract.unlock.f(20n, expected))
    .addOutput({ to: contract.address, amount: 990_000n })
    .send();
}

describe('stateless density reserve', () => {
  it('refuses the loop without a reserve', async () => {
    await expect(spend(undefined, 48n)).rejects.toThrow(FailedTransactionEvaluationError);
    await expect(spend(undefined, 48n)).rejects.toThrow(/operation cost density limit/);
  });

  it('spends the loop with a reserve', async () => {
    await expect(spend(densityReserve(512), 48n)).resolves.toBeUndefined();
  });

  it('still attributes a failed require behind a reserve', async () => {
    await expect(spend(densityReserve(512), 63n)).rejects.toThrow(FailedRequireError);
  });
});
