import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';
import { randomUtxo } from '../../src/utils.js';

/**
 * A power of two literals folds at compile time, and the folded value replaces its operands on the VM stack too.
 *
 * The fold used to push the result above the two literal operands it had already pushed, so the guard compared the
 * operands instead of `x`, and the leftover items failed the clean-stack rule: no spend of `f` settled at all.
 */
describe('a guard on a power of two literals', () => {
  it('settles below the bound and refuses above it', async () => {
    const provider = createTestProvider();
    const artifact = compileString('contract P() { function f(int x) { require(x < 2 ** 8); } }');
    const contract = new Contract(artifact, [], { provider });
    const spend = async (x: bigint): Promise<unknown> => {
      const utxo = randomUtxo();
      await provider.addUtxo(contract.address, utxo);
      return new TransactionBuilder({ provider })
        .addInput(utxo, contract.unlock.f(x))
        .addOutput({ to: contract.address, amount: utxo.satoshis - 2000n })
        .send();
    };
    await expect(spend(1000n)).rejects.toThrow(/Require statement failed/);
    await expect(spend(5n)).resolves.toBeDefined();
  }, 120_000);
});
