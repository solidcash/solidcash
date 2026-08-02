import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// An integer literal paired with a fixed-point operand converts implicitly (Solidity): `x += 1` on a
// fixed adds 1.0 (scaled by the type's decimals), not raw 1. Also covers literal-only fixed % folding.
const SOURCE = `
contract FixedOps {
    function f() public pure {
        fixed x = 1.5;
        x += 1;
        require(x == 2.5);
        fixed y = -3.5 % 2;
        require(y == -1.5);
        require(x - 1 == 1.5);
    }
    function wrong() public pure {
        fixed x = 1.5;
        x += 1;
        require(x == 2.6);
    }
}`;

describe('int literal to fixed-point coercion (VM-verified)', () => {
  const setup = async (): Promise<{ contract: Contract, provider: ReturnType<typeof createTestProvider> }> => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SOURCE, { solidityImportCompat: true }), [], { provider });
    await provider.addUtxo(contract.address, randomUtxo());
    return { contract, provider };
  };

  it('x += 1 adds a scaled 1.0 and modulo/subtraction match', async () => {
    const { contract, provider } = await setup();
    const [utxo] = await provider.getUtxos(contract.address);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f())
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  });

  it('rejects a wrong expected value (guard against vacuous pass)', async () => {
    const { contract, provider } = await setup();
    const [utxo] = await provider.getUtxos(contract.address);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.wrong())
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).toThrow();
  });
});
