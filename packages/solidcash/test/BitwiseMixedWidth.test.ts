import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// Integer-literal bitwise folds at compile time (BigInt two's-complement-infinite semantics, matching
// Solidity's arbitrary-precision constant evaluation, incl. negatives), and mixed-width operands of the
// same signedness widen to the larger width (uint8 & uint16 -> uint16), like Solidity.
const SOURCE = `
contract BitwiseOps {
    function f(uint8 a, uint16 b) public pure {
        require(1 & 0 == 0);
        require(-1 & 3 == 3);
        require(-1 & -1 == -1);
        require(-1 & 127 == 127);
        require(-2 ^ 3 == -3);
        require(5 | -8 == -3);
        require((a & b) == 0xff);
        require((a | b) == 0xffff);
        require((a ^ b) == 0xff00);
    }
    function wrong(uint8 a, uint16 b) public pure {
        require((a & b) == 0xfe);
    }
}`;

describe('bitwise literal folds + mixed-width widening (VM-verified)', () => {
  const setup = async (): Promise<{ contract: Contract, provider: ReturnType<typeof createTestProvider> }> => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SOURCE, { solidityImportCompat: true }), [], { provider });
    await provider.addUtxo(contract.address, randomUtxo());
    return { contract, provider };
  };

  it('folds negative-literal bitwise and widens uint8 op uint16 correctly', async () => {
    const { contract, provider } = await setup();
    const [utxo] = await provider.getUtxos(contract.address);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f(0xffn, 0xffffn))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  });

  it('rejects a wrong widened result (guard against vacuous pass)', async () => {
    const { contract, provider } = await setup();
    const [utxo] = await provider.getUtxos(contract.address);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.wrong(0xffn, 0xffffn))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).toThrow();
  });
});
