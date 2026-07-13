import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, TransactionBuilder } from '../src/index.js';
import type { FunctionArgument } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// Yul assembly addressing a high-level memory struct: EVM lays a memory struct out as one 32-byte slot per
// field, so `mload(add(s, 32*i))` == `uint256(s.field_i)` and `mstore(add(s, 32*i), v)` == `s.field_i = v`.
// Mapped directly to field access / value-copy rebuild. VM-verify read AND write with negatives.
describe('Yul assembly reading/writing high-level struct memory (VM)', () => {
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
  it('mload reads the right field with the right value', () => {
    expect(() => verifyTransaction(spend(READ, 'f', [{ a: 5n, b: 9n, c: 30n }, 5n, 30n]))).not.toThrow();
  });
  it('mload negative', () => {
    expect(() => verifyTransaction(spend(READ, 'f', [{ a: 5n, b: 9n, c: 30n }, 6n, 30n]))).toThrow();
  });

  const WRITE = `contract C { struct P { uint a; uint b; }
    function g(uint va, uint vb, uint ea, uint eb) {
      P memory s = P(1, 2);
      assembly { mstore(s, va)
        mstore(add(s, 0x20), vb) }
      require(s.a == ea); require(s.b == eb); require(true);
    } }`;
  it('mstore writes both struct fields', () => {
    expect(() => verifyTransaction(spend(WRITE, 'g', [7n, 9n, 7n, 9n]))).not.toThrow();
  });
  it('mstore negative', () => {
    expect(() => verifyTransaction(spend(WRITE, 'g', [7n, 9n, 8n, 9n]))).toThrow();
  });
  it('mstore only field 0: field 1 stays at its init value', () => {
    const src = `contract C { struct P { uint a; uint b; }
      function g(uint va) { P memory s = P(1, 2); assembly { mstore(s, va) }
        require(s.a == va); require(s.b == 2); require(true); } }`;
    expect(() => verifyTransaction(spend(src, 'g', [7n]))).not.toThrow();
  });

  it('ISOLATION: s = P(va, s.b) reassignment at function level (no assembly)', () => {
    const src = `contract C { struct P { uint a; uint b; }
      function g(uint va) { P memory s = P(1, 2); s = P(va, s.b);
        require(s.a == va); require(s.b == 2); require(true); } }`;
    expect(() => verifyTransaction(spend(src, 'g', [7n]))).not.toThrow();
  });
  it('ISOLATION: s.a = va field write at function level (no assembly)', () => {
    const src = `contract C { struct P { uint a; uint b; }
      function g(uint va) { P memory s = P(1, 2); s.a = va;
        require(s.a == va); require(s.b == 2); require(true); } }`;
    expect(() => verifyTransaction(spend(src, 'g', [7n]))).not.toThrow();
  });

  // Narrow value fields: mstore of a full word into a uint8 field truncates to the field type (EVM stores the
  // word; the field reads its low bytes). Sound by reduction to `s.f = uint8(word)` + `uint256(s.f)`.
  const NARROW = `contract C { struct P { uint8 a; uint8 b; }
    function g(uint va, uint ea) { P memory s = P(1, 2);
      uint r;
      assembly { mstore(s, va)
        r := mload(s) }
      require(s.a == ea); require(r == ea); require(s.b == 2); require(true); } }`;
  it('narrow uint8 field: mstore of an in-range value, mload reads it back (round-trip)', () => {
    expect(() => verifyTransaction(spend(NARROW, 'g', [200n, 200n]))).not.toThrow();
  });
});
