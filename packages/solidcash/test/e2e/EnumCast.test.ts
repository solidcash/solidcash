import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// int -> enum (Color(i), range-checked) and enum -> int (int(c)) explicit casts.
const SOURCE = `
contract EnumCast() {
    enum Color { Red, Green, Blue }
    function roundtrip(int i) {
        Color c = Color(i);   // int -> enum, range-checked (0..2)
        int back = int(c);    // enum -> int
        require(back == i);
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
    .addInputs(utxos, contract.unlock.roundtrip(arg))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
}

describe('Enum <-> int casts', () => {
  it('round-trips a valid enum value (Color(2) -> int 2)', async () => {
    await expect(spend(2n)).resolves.toBeDefined();
  });
  it('range-checks int -> enum (Color(99) is out of range and fails)', async () => {
    await expect(spend(99n)).rejects.toThrow();
  });
});
