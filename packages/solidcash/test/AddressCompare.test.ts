import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// address ordering `< <= > >=` compiles to unsigned big-endian comparison of the address bytes - the BCH
// analogue of EVM's uint160 address ordering (same machinery as bytesN). VM-verify the order is correct
// (big-endian, unsigned) via concrete values + negatives, so it is not a silent miscompile.
describe('address ordering comparison (VM, unsigned big-endian)', () => {
  const b32 = (hex: string): string => `0x${hex.padStart(64, '0')}`;
  const spend = (op: string, a: string, bb: string): TransactionBuilder => {
    const provider = createTestProvider();
    const src = `contract C { function f(address a, address b) { require(a ${op} b); require(true); } }`;
    const contract = new Contract(compileString(src, { solidityImportCompat: true }), [], { provider });
    const utxo = randomUtxo();
    provider.addUtxo(contract.address, utxo);
    return new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f(a, bb))
      .addOutput({ to: contract.address, amount: 10000n });
  };

  it('1 < 2', () => { expect(() => verifyTransaction(spend('<', b32('01'), b32('02')))).not.toThrow(); });
  it('2 < 1 is false (spend fails)', () => {
    expect(() => verifyTransaction(spend('<', b32('02'), b32('01')))).toThrow();
  });
  it('big-endian: 0x0100..00 > 0x00ff..ff (leading byte dominates)', () => {
    const beHigh = `0x01${'00'.repeat(31)}`; // 2^248
    const beLow = `0x00${'ff'.repeat(31)}`; // < 2^248
    expect(() => verifyTransaction(spend('>', beHigh, beLow))).not.toThrow();
  });
  it('>= is reflexive (equal addresses)', () => {
    expect(() => verifyTransaction(spend('>=', b32('05'), b32('05')))).not.toThrow();
  });
  it('<= strict-greater fails', () => {
    expect(() => verifyTransaction(spend('<=', b32('09'), b32('08')))).toThrow();
  });
});
