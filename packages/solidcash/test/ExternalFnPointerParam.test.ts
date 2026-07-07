import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// VM-verify passing an EXTERNAL function pointer as a parameter to a PUBLIC function and calling through it.
// `this.ev(this.g, a)` (external self-call) and `ev(this.g, a)` (internal call) both route to the internal
// OP_INVOKE path, so the (address, selector) pointer stays on the stack and the existing runtime call-through
// applies. This is the `pass_function_types_externally` Solidity pattern. Unblocked by the entry-point
// FunctionType relaxation + the public-function-internal-call return fix.
const SOURCE = `
contract ExtFnPtr() {
    function g(int x) public pure returns (int) { return x + 1; }
    function ev(function(int) external returns (int) fp, int a) public returns (int) { return fp(a); }
    function viaExternalSelfCall(int x) { require(this.ev(this.g, x) == x + 1); }
    function viaInternalCall(int x) { require(ev(this.g, x) == x + 1); }
}`;

describe('external function pointer as a public-function parameter (VM-verified)', () => {
  for (const fn of ['viaExternalSelfCall', 'viaInternalCall']) {
    it(`calls through the pointer: ${fn}`, async () => {
      const provider = createTestProvider();
      const contract = new Contract(compileString(SOURCE), [], { provider });
      const utxo = randomUtxo();
      await provider.addUtxo(contract.address, utxo);
      const tx = new TransactionBuilder({ provider })
        .addInput(utxo, (contract.unlock as Record<string, (x: bigint) => unknown>)[fn](5n))
        .addOutput({ to: contract.address, amount: 10000n });
      expect(() => verifyTransaction(tx)).not.toThrow();
    });
  }
});
