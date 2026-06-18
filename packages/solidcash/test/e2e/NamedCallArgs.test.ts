import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// Named call args f({b:.., a:..}) reorder to the function's declared parameter order. sub is
// non-commutative, so a wrong binding would compute the wrong result and fail the require.
const SOURCE = `
contract NamedArgs() {
    function check(int x, int y) {
        require(sub({b: y, a: x}) == x - y);
    }
    function sub(int a, int b) internal returns (int) {
        return a - b;
    }
}
`;

async function spend(x: bigint, y: bigint): Promise<unknown> {
  const provider: MockNetworkProvider = createTestProvider();
  const contract = new Contract(compileString(SOURCE), [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });
  return new TransactionBuilder({ provider })
    .addInputs(utxos, contract.unlock.check(x, y))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
}

describe('Named call arguments', () => {
  it('binds named args to the right parameters regardless of source order', async () => {
    await expect(spend(10n, 3n)).resolves.toBeDefined();
  });
});
