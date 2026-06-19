import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Compiler fixes surfaced by porting Solidity (Sablier) to SolidCash. See
// examples/legacy-contracts/scash/INTERVENTIONS.md.

describe('A4: address is a valid event parameter type', () => {
  it('compiles an event with an address param and an emit', () => {
    const artifact = compileString(`
      contract C() {
        event Moved(address indexed who, int amount);
        int n;
        function go(address dst, int amount) {
          emit Moved(dst, amount);
          this.n = this.n + 1;
        }
      }`);
    expect(artifact.contractName).toBe('C');
    const ev = artifact.events?.find((e) => e.name === 'Moved');
    expect(ev?.signature).toBe('Moved(address,int)');
    expect(ev?.parameters?.[0]?.type).toBe('address');
  });
});

describe('A3: identifiers matching [eE][0-9]+ are not mis-lexed as exponents', () => {
  it.each(['e2', 'e1', 'E5', 'e10'])('accepts %s as an identifier', (name) => {
    const artifact = compileString(`
      contract C() { int n; function f() { int ${name} = 5; this.n = ${name}; } }`);
    expect(artifact.contractName).toBe('C');
  });

  it('still lexes integer, underscore, and scientific number literals', () => {
    const artifact = compileString(`
      contract C() {
        int n;
        function f() { this.n = 123; this.n = 1_000; this.n = 1e3; }
      }`);
    expect(artifact.contractName).toBe('C');
  });

  // The fix unblocks repeated tuple-declarations whose error vars were named e1/e2 (the original
  // mis-diagnosis): the parser handles them fine once the names lex as identifiers.
  it('parses repeated tuple-declarations using e1/e2 names', () => {
    const artifact = compileString(`
      function g(int a) returns (int, int) { return (a, a); }
      function f(int a) returns (int) {
        int e1, int p = g(a);
        int e2, int q = g(a);
        return e1 + p + e2 + q;
      }
      contract C() { function go() { require(f(1) == 4); } }`);
    expect(artifact.contractName).toBe('C');
  });
});

describe('Solidity-compat features (from the minimal Sablier port)', () => {
  it('accepts `uint` as the unbounded int', () => {
    const a = compileString('contract C() { int n; function f(uint x) { this.n = x; } }');
    expect(a.contractName).toBe('C');
  });

  it('accepts constructor visibility (public/internal), ignoring it', () => {
    for (const vis of ['public', 'internal']) {
      const a = compileString(`contract C() { int n; constructor() ${vis} { this.n = 1; } function f() { this.n = this.n + 1; } }`);
      expect(a.contractName).toBe('C');
    }
  });

  it('resolves a library-qualified type (Library.Type) in a type position', () => {
    const a = compileString(`
      library Types { struct Stream { int a; } }
      contract C() {
        mapping(int => Types.Stream) m;
        function f(int k) { Types.Stream s = this.m[k]; require(s.a >= 0); }
      }`);
    expect(a.contractName).toBe('C');
  });

  it('compiles address(this) to OP_INPUTINDEX OP_UTXOBYTECODE (the spent UTXO locking script)', () => {
    const a = compileString('contract C() { int n; function f(address r) { require(r != address(this)); this.n = 1; } }');
    expect(a.bytecode).toContain('OP_INPUTINDEX');
    expect(a.bytecode).toContain('OP_UTXOBYTECODE');
  });
});

describe('A1: declaration order is not enforced', () => {
  it('allows a file-level free function before the struct it uses', () => {
    const artifact = compileString(`
      function area(Rect r) returns (int) { return r.w * r.h; }
      struct Rect { int w; int h; }
      contract C() { function go() { require(area(Rect(2, 3)) == 6); } }`);
    expect(artifact.contractName).toBe('C');
  });

  it('allows contract-body members (state var, event) after a function', () => {
    const artifact = compileString(`
      contract C() {
        function bump(pubkey pk, sig s) { require(checkSig(s, pk)); emit E(this.n); this.n = this.n + 1; }
        int n;
        event E(int v);
      }`);
    expect(artifact.contractName).toBe('C');
  });

  it('allows a function to reference a constant defined later', () => {
    const artifact = compileString(`
      contract C() {
        int n;
        function f() { this.n = LIMIT; }
        int constant LIMIT = 42;
      }`);
    expect(artifact.contractName).toBe('C');
  });

  it('still rejects more than one constructor', () => {
    expect(() => compileString(`
      contract C() { int n; constructor() { this.n = 1; } constructor(int x) { this.n = x; } }`))
      .toThrow(/at most one constructor/);
  });
});

describe('A2: uninitialized declarations zero-init (via the same path as delete)', () => {
  it.each([
    ['int', 'int x; this.n = x;'],
    ['bounded int', 'int128 x; this.n = x;'],
    ['bytes32', 'bytes32 x; this.h = x;'],
    ['bytes', 'bytes x; this.bb = x;'],
    ['string', 'string x; this.ss = x;'],
    ['bool', 'bool x; this.flag = x;'],
  ])('zero-inits %s', (_label, body) => {
    const artifact = compileString(`
      contract C() {
        int n; bytes32 h; bytes bb; string ss; bool flag;
        function f() { ${body} }
      }`);
    expect(artifact.contractName).toBe('C');
  });

  it('zero-inits a struct local (delete parity)', () => {
    const artifact = compileString(`
      struct S { int a; int b; }
      contract C() { int n; function f() { S z; this.n = z.a; } }`);
    expect(artifact.contractName).toBe('C');
  });

  it('still type-checks an explicit initializer', () => {
    expect(() => compileString(`
      contract C() { bytes32 h; function f() { bytes32 x = 5; this.h = x; } }`)).toThrow();
  });
});

describe('B7: a returning function that reads a mapping must not crash', () => {
  it('compiles a function that returns a mapping read', () => {
    const artifact = compileString(`
      contract C() {
        int n;
        mapping(int => int) m;
        function get(int k) returns (int) { return this.m[k]; }
        function go() { this.n = this.n + 1; }
      }`);
    expect(artifact.abi.find((f) => f.name === 'get')).toBeDefined();
  });

  it('compiles a returning function that reads a struct field from a mapping', () => {
    const artifact = compileString(`
      struct S { int a; int b; }
      contract C() {
        int n;
        mapping(int => S) m;
        function getA(int k) returns (int) { return this.m[k].a; }
        function go() { this.n = this.n + 1; }
      }`);
    expect(artifact.abi.find((f) => f.name === 'getA')).toBeDefined();
  });
});
