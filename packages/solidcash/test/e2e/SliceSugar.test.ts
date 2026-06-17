import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// `x[a:b]` index-range syntax is sugar for `x.slice(a, b)` (byte-identical output).
const SOURCE = `
contract SliceSugar() {
    function check(bytes data) {
        // data = 0x00112233; data[1:3] == 0x1122
        require(data[1:3] == 0x1122);
    }
}
`;

async function spend(arg: Uint8Array): Promise<unknown> {
  const provider: MockNetworkProvider = createTestProvider();
  const contract = new Contract(compileString(SOURCE), [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });
  return new TransactionBuilder({ provider })
    .addInputs(utxos, contract.unlock.check(arg))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
}

describe('Index-range slice sugar x[a:b]', () => {
  it('slices the same bytes as .slice() on the VM', async () => {
    await expect(spend(Uint8Array.from([0x00, 0x11, 0x22, 0x33]))).resolves.toBeDefined();
  });

  it('fails when the slice does not match', async () => {
    await expect(spend(Uint8Array.from([0x00, 0x99, 0x99, 0x33]))).rejects.toThrow();
  });
});
