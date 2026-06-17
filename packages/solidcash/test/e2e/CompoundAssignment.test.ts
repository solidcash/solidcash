import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// Compound assignment operators desugar to `x = x <op> e` and inherit the binary operator's type
// rules (arithmetic/shift on int; bitwise on bytes). Each function computes a known result and
// requires it, so the spend only succeeds if every operator behaved correctly on the VM.
const SOURCE = `
contract CompoundAssign() {
    function arith(int x) {
        int a = x;   // 10
        a += 5;      // 15
        a -= 3;      // 12
        a *= 2;      // 24
        a /= 4;      // 6
        a %= 4;      // 2
        a <<= 3;     // 16
        a >>= 1;     // 8
        require(a == 8);
    }
    function bitwise(bytes1 x) {
        bytes1 a = x;  // 0xff
        a &= 0x0f;     // 0x0f
        a |= 0x30;     // 0x3f
        a ^= 0x0f;     // 0x30
        require(a == 0x30);
    }
}
`;

async function spend(fn: string, arg: bigint | Uint8Array): Promise<unknown> {
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

describe('Compound assignment operators', () => {
  it('arithmetic/shift compound ops on int compute the expected result', async () => {
    await expect(spend('arith', 10n)).resolves.toBeDefined();
  });

  it('arithmetic compound ops fail when the result differs', async () => {
    // x=0 -> 5,2,4,1,1,8,4 -> a==4, not 8
    await expect(spend('arith', 0n)).rejects.toThrow();
  });

  it('bitwise compound ops on bytes compute the expected result', async () => {
    await expect(spend('bitwise', Uint8Array.from([0xff]))).resolves.toBeDefined();
  });
});
