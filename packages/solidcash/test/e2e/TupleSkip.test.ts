import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// Tuple destructuring with skipped slots: the skipped value is dropped, the kept value bound.
const SOURCE = `
contract TupleSkip() {
    function keepSecond(bytes b) {
        (, bytes y) = b.split(2);   // drop first half, keep second
        require(y == 0x2233);
    }
    function keepFirst(bytes b) {
        (bytes x, ) = b.split(2);   // keep first half, drop second
        require(x == 0x0011);
    }
}
`;

async function spend(fn: string, b: Uint8Array): Promise<unknown> {
  const provider: MockNetworkProvider = createTestProvider();
  const contract = new Contract(compileString(SOURCE), [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });
  return new TransactionBuilder({ provider })
    .addInputs(utxos, contract.unlock[fn](b))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
}

describe('Tuple destructuring with skipped slots', () => {
  it('(, y) keeps the second value', async () => {
    await expect(spend('keepSecond', Uint8Array.from([0x00, 0x11, 0x22, 0x33]))).resolves.toBeDefined();
  });
  it('(x, ) keeps the first value', async () => {
    await expect(spend('keepFirst', Uint8Array.from([0x00, 0x11, 0x22, 0x33]))).resolves.toBeDefined();
  });
});
