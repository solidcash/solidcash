import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// A bare enum type name as an expression statement (`Foo;` / `C.Foo;`) is a Solidity no-op. The name
// resolves as a valueless CONSTANT symbol; previously codegen tried to materialize it and crashed
// ("Expected variable 'Foo' does not exist on the stack"). It is now dropped; surrounding code runs.
const SOURCE = `
contract EnumStmt() {
    enum Foo { A, B }
    function f(int r) {
        Foo;
        EnumStmt.Foo;
        require(r == 1);
    }
}`;

describe('bare enum type reference statement (VM-verified)', () => {
  it('drops the statement as a no-op and the function still verifies', async () => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SOURCE), [], { provider });
    const utxo = randomUtxo();
    await provider.addUtxo(contract.address, utxo);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f(1n))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  });
});
