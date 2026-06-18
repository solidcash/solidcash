import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider } from './test-util.js';

// The debug/console.log decode path resolves enum-typed values via the artifact's enum definitions
// and decodes them as their int (not the raw hex fallback).
const SOURCE = `
contract EnumLog() {
    enum Color { Red, Green, Blue }
    function f(Color c) {
        console.log(c);
        require(c == Color.Green);
    }
}`;

describe('console.log of an enum value', () => {
  it('decodes an enum-typed value to its int, not hex', async () => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SOURCE), [], { provider });
    const utxo = randomUtxo();
    await provider.addUtxo(contract.address, utxo);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f(1n))
      .addOutput({ to: contract.address, amount: 10000n });
    // Color.Green = 1 -> logs " 1" (int), not " 0x01" (hex fallback)
    expect(tx).toLog(/EnumLog\.scash:5 1$/);
  });
});
