import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// addmod(x,y,k) = (x+y)%k, mulmod(x,y,k) = (x*y)%k. The contract recomputes the result and requires
// it equals the builtin, so the spend only succeeds if both builtins are correct on the VM.
const SOURCE = `
contract AddMulMod() {
    function check(int x, int y, int k) {
        require(addmod(x, y, k) == (x + y) % k);
        require(mulmod(x, y, k) == (x * y) % k);
    }
}
`;

async function spend(x: bigint, y: bigint, k: bigint): Promise<unknown> {
  const provider: MockNetworkProvider = createTestProvider();
  const contract = new Contract(compileString(SOURCE), [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });
  return new TransactionBuilder({ provider })
    .addInputs(utxos, contract.unlock.check(x, y, k))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
}

describe('addmod / mulmod', () => {
  it('computes (x+y)%k and (x*y)%k on the VM', async () => {
    await expect(spend(7n, 5n, 6n)).resolves.toBeDefined();
  });
});
