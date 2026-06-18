import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// require(cond, CustomError(args)): reverts with the custom error if cond is false. On BCH the
// error is tooling metadata (no revert data); the runtime behaviour is require(cond).
const SOURCE = `
contract RequireError() {
    error TooSmall(int min);
    function f(int x) {
        require(x >= 10, TooSmall(10));
    }
}
`;

async function spend(arg: bigint): Promise<unknown> {
  const provider: MockNetworkProvider = createTestProvider();
  const contract = new Contract(compileString(SOURCE), [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });
  return new TransactionBuilder({ provider })
    .addInputs(utxos, contract.unlock.f(arg))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
}

describe('require with custom error', () => {
  it('passes when the condition holds', async () => {
    await expect(spend(15n)).resolves.toBeDefined();
  });
  it('fails when the condition is false', async () => {
    await expect(spend(5n)).rejects.toThrow();
  });
});
