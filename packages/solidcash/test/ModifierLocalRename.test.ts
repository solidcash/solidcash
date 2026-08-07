import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// VM-verify that a modifier applied multiple times gets a FRESH copy of its local each application. The two
// trailing `require(b == k)` checks discriminate: if both applications shared one `b`, the second binding
// (b = 5) would clobber the first, and the outer `require(b == 3)` would fail at runtime. It passing proves
// each application's local was alpha-renamed to a distinct slot.
const SOURCE = `
contract ModLocalRename() {
    modifier mod(int k) {
        int b = k;
        _;
        require(b == k);
    }
    function f(int z) mod(3) mod(5) {
        require(z == z);
    }
}`;

describe('modifier local variables are distinct per application (VM-verified)', () => {
  it('runs a modifier applied twice with a local without the applications aliasing', async () => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SOURCE), [], { provider });
    const utxo = randomUtxo();
    await provider.addUtxo(contract.address, utxo);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f(0n))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  });
});
