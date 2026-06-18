import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// bytesN[k] returns the k-th byte (bytes1): literal index (b[1]) and variable index (b[k]).
const SOURCE = `
contract BytesIndex() {
    function f(bytes4 b, int k) {
        require(b[1] == 0x11);   // literal index
        require(b[k] == 0x22);   // variable index
    }
}
`;

async function spend(b: Uint8Array, k: bigint): Promise<unknown> {
  const provider: MockNetworkProvider = createTestProvider();
  const contract = new Contract(compileString(SOURCE), [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });
  return new TransactionBuilder({ provider })
    .addInputs(utxos, contract.unlock.f(b, k))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
}

describe('bytesN single-byte index', () => {
  it('indexes the k-th byte (literal and variable index)', async () => {
    // 0x00112233: [1]=0x11, [2]=0x22
    await expect(spend(Uint8Array.from([0x00, 0x11, 0x22, 0x33]), 2n)).resolves.toBeDefined();
  });
  it('fails when the indexed byte does not match', async () => {
    await expect(spend(Uint8Array.from([0x00, 0x11, 0x99, 0x33]), 2n)).rejects.toThrow();
  });
});
