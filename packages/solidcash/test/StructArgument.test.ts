import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, TransactionBuilder } from '../src/index.js';
import type { FunctionArgument } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, setupStatefulUtxos, verifyTransaction } from './test-util.js';

// First-class struct arguments: a struct-typed parameter (Solidity encodes a struct as an ABI tuple) accepts
// either an object keyed by field name `{x: 1n, y: 2n}` or a positional tuple `[1n, 2n]` (both valid Solidity/
// ethers forms). The SDK encodes it as the value-copy blob the covenant decodes (fields in declaration order),
// composing recursively for nested structs, arrays-of-structs, and struct fields that are arrays. require()s
// are VM gates - a wrong encoding fails the spend.
async function call(src: string, method: string, args: FunctionArgument[]): Promise<void> {
  const provider = createTestProvider();
  const artifact = compileString(src, {});
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const sc = StatefulContract.withCategory(contract, categoryId);
  await sc[method](...args).send();
}

describe('SDK first-class struct arguments', () => {
  it('struct argument as an object keyed by field name', async () => {
    await call(`contract C() {
      int counter;
      struct Point { uint x; uint y; }
      function f(Point memory p) { require(p.x == 10); require(p.y == 20); require(true); }
    }`, 'f', [{ x: 10n, y: 20n }]);
  });

  it('struct argument as a positional tuple array', async () => {
    await call(`contract C() {
      int counter;
      struct Point { uint x; uint y; }
      function f(Point memory p) { require(p.x == 10); require(p.y == 20); require(true); }
    }`, 'f', [[10n, 20n]]);
  });

  it('three value-field struct (object)', async () => {
    await call(`contract C() {
      int counter;
      struct P { uint a; uint b; uint c; }
      function f(P memory s) { require(s.a == 1); require(s.b == 2); require(s.c == 3); require(true); }
    }`, 'f', [{ a: 1n, b: 2n, c: 3n }]);
  });

  it('signed int field struct', async () => {
    await call(`contract C() {
      int counter;
      struct S { int a; int b; }
      function f(S memory s) { require(s.a == -5); require(s.b == 7); require(true); }
    }`, 'f', [{ a: -5n, b: 7n }]);
  });

  it('array-of-structs argument (objects)', async () => {
    await call(`contract C() {
      int counter;
      struct Point { uint x; uint y; }
      function g(Point[] memory ps) {
        require(ps.length == 2);
        require(ps[0].x == 1); require(ps[0].y == 2);
        require(ps[1].x == 3); require(ps[1].y == 4);
        require(true);
      }
    }`, 'g', [[{ x: 1n, y: 2n }, { x: 3n, y: 4n }]]);
  });

  it('array-of-structs argument (positional tuples)', async () => {
    await call(`contract C() {
      int counter;
      struct Point { uint x; uint y; }
      function g(Point[] memory ps) {
        require(ps.length == 2);
        require(ps[0].x == 1); require(ps[1].y == 4);
        require(true);
      }
    }`, 'g', [[[1n, 2n], [3n, 4n]]]);
  });

  it('struct with a dynamic-array field', async () => {
    await call(`contract C() {
      int counter;
      struct Bag { uint id; uint[] xs; }
      function h(Bag memory b) {
        require(b.id == 7);
        require(b.xs.length == 3);
        require(b.xs[0] == 10); require(b.xs[2] == 30);
        require(true);
      }
    }`, 'h', [{ id: 7n, xs: [10n, 20n, 30n] }]);
  });

  it('struct arg on a multi-function OP_INVOKE contract (functionBodies -> debug template path)', async () => {
    // Two entry points force OP_INVOKE dispatch (functionBodies populated). send() runs debug() which builds
    // the libauth template - that path must also thread struct defs, else a struct arg throws there.
    await call(`contract C() {
      int counter;
      struct Point { uint x; uint y; }
      function f(Point memory p) { require(p.x == 10); require(p.y == 20); require(true); }
      function other() { require(true); }
    }`, 'f', [{ x: 10n, y: 20n }]);
  });

  it('struct arg debug template + VM on a stateless multi-function contract (non-swallowed debug path)', async () => {
    // Stateful send() swallows covenant debug errors, masking a broken debug template. A stateless contract's
    // getBitauthUri()/getLibauthTemplate path is NOT swallowed, and two entry points populate functionBodies so
    // it reaches encodeFunctionArguments - which must thread the struct defs, or a struct arg throws here.
    const provider = createTestProvider();
    const contract = new Contract(compileString(`contract C() {
      struct Point { uint x; uint y; }
      function f(Point memory p) { require(p.x == 10); require(p.y == 20); }
      function other() { require(true); }
    }`), [], { provider });
    await provider.addUtxo(contract.address, randomUtxo());
    const [utxo] = await provider.getUtxos(contract.address);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f({ x: 10n, y: 20n }))
      .addOutput({ to: contract.address, amount: 10000n });
    const uri = tx.getBitauthUri();
    expect(uri.length).toBeGreaterThan(0);
    expect(() => verifyTransaction(tx)).not.toThrow();
  });

  it('nested struct argument', async () => {
    await call(`contract C() {
      int counter;
      struct Point { uint x; uint y; }
      struct Line { Point a; Point b; }
      function k(Line memory l) {
        require(l.a.x == 1); require(l.a.y == 2);
        require(l.b.x == 3); require(l.b.y == 4);
        require(true);
      }
    }`, 'k', [{ a: { x: 1n, y: 2n }, b: { x: 3n, y: 4n } }]);
  });
});

// Solidity parity: a struct is a valid CONSTRUCTOR argument (TypeChecker treats a ctor param like an external
// fn param; syntaxTests/abiEncoder/v2_call_to_v2_constructor_accepting_struct.sol). On BCH the ctor arg is a
// value-copy blob prepended to the redeem script, and the body reads its fields. VM-executed via verifyTransaction.
describe('SDK struct constructor arguments', () => {
  const CTOR_SRC = `contract C(Point p) {
    struct Point { uint x; uint y; }
    function f() { require(p.x == 10); require(p.y == 20); }
  }`;

  const spend = (contract: Contract, provider: ReturnType<typeof createTestProvider>): TransactionBuilder => {
    const utxo = randomUtxo();
    provider.addUtxo(contract.address, utxo);
    return new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f())
      .addOutput({ to: contract.address, amount: 10000n });
  };

  it('object-form struct ctor arg, fields read on-chain', () => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(CTOR_SRC), [{ x: 10n, y: 20n }], { provider });
    expect(() => verifyTransaction(spend(contract, provider))).not.toThrow();
  });

  it('positional-tuple struct ctor arg, fields read on-chain', () => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(CTOR_SRC), [[10n, 20n]], { provider });
    expect(() => verifyTransaction(spend(contract, provider))).not.toThrow();
  });

  it('wrong field value fails the spend (decode reads the real bytes, not a stub)', () => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(CTOR_SRC), [{ x: 99n, y: 20n }], { provider });
    expect(() => verifyTransaction(spend(contract, provider))).toThrow();
  });

  it('nested + multi-field struct ctor arg', () => {
    const provider = createTestProvider();
    const src = `contract C(Line l) {
      struct Point { uint x; uint y; }
      struct Line { Point a; Point b; uint tag; }
      function f() { require(l.a.x == 1); require(l.a.y == 2); require(l.b.x == 3); require(l.b.y == 4); require(l.tag == 7); }
    }`;
    const contract = new Contract(compileString(src), [{ a: { x: 1n, y: 2n }, b: { x: 3n, y: 4n }, tag: 7n }], { provider });
    expect(() => verifyTransaction(spend(contract, provider))).not.toThrow();
  });

  it('struct-with-dynamic-array-field ctor arg (variable-width decode in a redeem-script slot)', () => {
    const provider = createTestProvider();
    const src = `contract C(Bag b) {
      struct Bag { uint id; uint[] xs; }
      function f() { require(b.id == 7); require(b.xs.length == 3); require(b.xs[0] == 10); require(b.xs[2] == 30); }
    }`;
    const contract = new Contract(compileString(src), [{ id: 7n, xs: [10n, 20n, 30n] }], { provider });
    expect(() => verifyTransaction(spend(contract, provider))).not.toThrow();
  });
});
