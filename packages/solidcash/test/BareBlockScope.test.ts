import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// VM-verify that two sibling bare `{ ... }` blocks each get their OWN `x`: both contribute to `sum`, and the
// final require only holds if each block's `x` occupied a distinct stack slot (no aliasing across the blocks).
const SOURCE = `
contract BareBlockScope() {
    function f(int a) {
        int sum = 0;
        { int x = a + 1; sum = sum + x; }
        { int x = a + 10; sum = sum + x; }
        require(sum == a + a + 11);
    }
}`;

describe('bare block scopes give disjoint sibling blocks distinct locals (VM-verified)', () => {
  it('runs two sibling blocks that reuse a local name without aliasing', async () => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SOURCE), [], { provider });
    const utxo = randomUtxo();
    await provider.addUtxo(contract.address, utxo);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f(5n))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  });
});
