import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// Enum-typed function parameters: previously crashed the compiler (p.type undefined). The ABI
// exposes the enum name; the SDK encodes the int-backed enum value as an int.
const SOURCE = `
contract EnumParam() {
    enum Color { Red, Green, Blue }
    function pick(Color c) {
        require(c == Color.Green);
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
    .addInputs(utxos, contract.unlock.pick(arg))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
}

describe('Enum-typed function parameters', () => {
  it('compiles, and the SDK encodes the enum value (Color.Green = 1)', async () => {
    await expect(spend(1n)).resolves.toBeDefined();
  });
  it('fails when the enum value does not match', async () => {
    await expect(spend(0n)).rejects.toThrow();
  });
  it('exposes the enum name in the ABI', () => {
    const art = compileString(SOURCE);
    expect(art.abi[0].inputs[0].type).toBe('Color');
  });
});
