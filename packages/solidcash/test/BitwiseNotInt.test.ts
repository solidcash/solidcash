import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// `~x` on an unbounded int desugars to `-x - 1` (Solidity's arbitrary-precision two's-complement identity
// ~x == -x - 1). Sound and representation-independent: BCH is sign-magnitude, but the arithmetic identity is
// exact, so no bit-flip of the internal representation is involved. VM-verify concrete values + negatives.
describe('~ (bitwise NOT) on unbounded int (VM, ~x == -x - 1)', () => {
  const SRC = 'contract C { function f(bigint x, bigint expected) { require(~x == expected); require(true); } }';
  const spend = (x: bigint, expected: bigint): TransactionBuilder => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SRC, { solidityImportCompat: true }), [], { provider });
    const utxo = randomUtxo();
    provider.addUtxo(contract.address, utxo);
    return new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f(x, expected))
      .addOutput({ to: contract.address, amount: 10000n });
  };

  it('~5 == -6', () => { expect(() => verifyTransaction(spend(5n, -6n))).not.toThrow(); });
  it('~0 == -1', () => { expect(() => verifyTransaction(spend(0n, -1n))).not.toThrow(); });
  it('~(-1) == 0', () => { expect(() => verifyTransaction(spend(-1n, 0n))).not.toThrow(); });
  it('~100 == -101', () => { expect(() => verifyTransaction(spend(100n, -101n))).not.toThrow(); });
  it('~5 == -5 is false (spend fails, so the value is genuinely -6 not a stub)', () => {
    expect(() => verifyTransaction(spend(5n, -5n))).toThrow();
  });

  it('~1 == -2 literal fold compiles and spends', () => {
    const provider = createTestProvider();
    const contract = new Contract(
      compileString('contract C { function f() { require(~1 == -2); require(~~7 == 7); require(true); } }',
        { solidityImportCompat: true }), [], { provider });
    const utxo = randomUtxo();
    provider.addUtxo(contract.address, utxo);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f())
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  });
});
