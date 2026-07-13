import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// A local Yul function with MULTIPLE return values (`function f() -> x, y, z`) is inlined by binding each
// call-site name to the corresponding return path (`let a, b, c := f(..)` / `a, b, c := f(..)`). VM-verify the
// values land in the right variables, with a negative.
describe('multi-return local Yul function inlining (VM)', () => {
  const spend = (src: string, args: bigint[]): TransactionBuilder => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(src, { solidityImportCompat: true }), [], { provider });
    const utxo = randomUtxo();
    provider.addUtxo(contract.address, utxo);
    return new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f(...args))
      .addOutput({ to: contract.address, amount: 10000n });
  };

  const SRC = `contract C {
    function f(uint m, uint n, uint ea, uint eb, uint ec) {
      uint a; uint b; uint c;
      assembly {
        function g(p, q) -> x, y, z { x := q  y := p  z := add(p, q) }
        a, b, c := g(m, n)
      }
      require(a == ea); require(b == eb); require(c == ec); require(true);
    } }`;

  it('binds a,b,c to the right return values (x:=q, y:=p, z:=p+q)', () => {
    // g(3, 5) -> x=5, y=3, z=8 ; so a=5, b=3, c=8
    expect(() => verifyTransaction(spend(SRC, [3n, 5n, 5n, 3n, 8n]))).not.toThrow();
  });
  it('negative: wrong expected fails the spend', () => {
    expect(() => verifyTransaction(spend(SRC, [3n, 5n, 3n, 5n, 8n]))).toThrow();
  });

  const DECL = `contract C {
    function f(uint m, uint ea, uint eb) {
      uint ra; uint rb;
      assembly {
        function g(p) -> x, y { x := mul(p, 2)  y := add(p, 1) }
        let a, b := g(m)
        ra := a
        rb := b }
      require(ra == ea); require(rb == eb); require(true);
    } }`;
  it('let a, b := g(m) declaration form inlines and binds correctly', () => {
    // g(10) -> x=20, y=11
    expect(() => verifyTransaction(spend(DECL, [10n, 20n, 11n]))).not.toThrow();
  });
});
