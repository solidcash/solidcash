import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// VM-verify a `transient` state var declared in a BASE contract and used in a DERIVED contract. It lowers to a
// per-function zero-init local (BCH has no transaction-scoped storage), so it starts at 0 each spend: x += 1 == 1,
// then x = x + 4 == 5. Previously the base's transient var was filtered out per-contract before inheritance ran,
// so the derived contract saw an undefined reference.
const SOURCE = `
contract A { int transient x; }
contract TransientChild() is A {
    function f() {
        x += 1;
        require(x == 1);
        x = x + 4;
        require(x == 5);
    }
}`;

describe('inherited transient state variable (VM-verified)', () => {
  it('lowers a base-declared transient var into the derived contract function', async () => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SOURCE), [], { provider });
    const utxo = randomUtxo();
    await provider.addUtxo(contract.address, utxo);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f())
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  });
});
