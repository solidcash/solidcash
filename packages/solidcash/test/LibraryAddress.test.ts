import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// `address(L)` where L is a library resolves to the library's link-time address = a synthesized `__libAddr_L`
// address constructor arg (EVM library-linking parity: the SDK supplies the linked address). Here we bake a
// known address into that param and VM-verify the contract reads it back and compares it (positive + negative).
describe('address(L) library-as-address (VM)', () => {
  const SRC = 'library L {} contract C {'
    + ' function f(address expected) { require(address(L) == expected); require(true); } }';
  const LIB_ADDR = `0xaa20${'11'.repeat(32)}87`; // a p2sh32 locking bytecode as the linked library address

  const build = (libAddr: string, expected: string): TransactionBuilder => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SRC, { solidityImportCompat: true }), [libAddr], { provider });
    const utxo = randomUtxo();
    provider.addUtxo(contract.address, utxo);
    return new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f(expected))
      .addOutput({ to: contract.address, amount: 10000n });
  };

  it('reads the baked __libAddr_L and compares equal', () => {
    expect(() => verifyTransaction(build(LIB_ADDR, LIB_ADDR))).not.toThrow();
  });

  it('fails the spend when the compared value differs (real byte read, not a stub)', () => {
    expect(() => verifyTransaction(build(LIB_ADDR, `0xaa20${'22'.repeat(32)}87`))).toThrow();
  });
});
