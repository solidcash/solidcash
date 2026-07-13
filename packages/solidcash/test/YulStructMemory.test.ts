import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, TransactionBuilder } from '../src/index.js';
import type { FunctionArgument } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// Yul assembly can address a high-level memory struct as an EVM memory pointer. EVM lays a memory struct out as
// one 32-byte slot per field, so `mload(add(s, 32*i))` reads field i. We map that directly to `uint256(s.field_i)`
// (no buffer needed). VM-verify the read is correct (right field, right value) with a negative. WRITE (mstore)
// is deferred - see docs/unified-linear-memory.md and the note in LowerInlineAssembly.
describe('Yul assembly reading high-level struct memory (VM)', () => {
  const spend = (src: string, method: string, args: FunctionArgument[]): TransactionBuilder => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(src, { solidityImportCompat: true }), [], { provider });
    const utxo = randomUtxo();
    provider.addUtxo(contract.address, utxo);
    return new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock[method](...args))
      .addOutput({ to: contract.address, amount: 10000n });
  };

  const READ = `contract C { struct P { uint a; uint b; uint c; }
    function f(P memory s, uint ea, uint ec) {
      uint x; uint z;
      assembly { x := mload(s)
        z := mload(add(s, 0x40)) }
      require(x == ea); require(z == ec); require(true);
    } }`;

  it('mload(s) reads field 0, mload(add(s,0x40)) reads field 2', () => {
    expect(() => verifyTransaction(spend(READ, 'f', [{ a: 5n, b: 9n, c: 30n }, 5n, 30n]))).not.toThrow();
  });
  it('reads the RIGHT field (field 2 is 30, not field 0/1)', () => {
    expect(() => verifyTransaction(spend(READ, 'f', [{ a: 5n, b: 9n, c: 30n }, 5n, 9n]))).toThrow();
  });
  it('negative: wrong expected value fails the spend', () => {
    expect(() => verifyTransaction(spend(READ, 'f', [{ a: 5n, b: 9n, c: 30n }, 6n, 30n]))).toThrow();
  });
});
