import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Compiler features surfaced by porting Solidity (Sablier) to SolidCash.
// See packages/solidc/docs/solidity-import-compat.md.

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

describe('solidityImportCompat', () => {
  const SRC = 'pragma solidity =0.5.17;\ncontract C() { int n; function f() { this.n = 1; } }';

  it('accepts `pragma solidity` and skips the version check under the option', () => {
    expect(compileString(SRC, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('rejects `pragma solidity` without the option (clean error)', () => {
    expect(() => compileString(SRC)).toThrow(/solidityImportCompat/);
  });

  it('parses an imported source whose own `pragma solidity` would otherwise fail', () => {
    const resolver = (p: string): { source: string; id: string } | undefined => (p.includes('Dep')
      ? { source: 'pragma solidity ^0.5.0;\nlibrary L { function two() returns (int) { return 2; } }', id: 'Dep' }
      : undefined);
    const a = compileString(
      'pragma solidity ^0.5.0;\nimport "./Dep.sol";\ncontract C() { int n; function f() { this.n = 1; } }',
      { solidityImportCompat: true, importResolver: resolver },
    );
    expect(a.contractName).toBe('C');
  });
});

describe('Solidity-compat features (OpenZeppelin imports)', () => {
  it('accepts visibility modifiers on interface functions (ignored)', () => {
    const a = compileString(`
      interface I { function bal(int x) external view returns (int); function poke() external; }
      contract C() is I {
        int n;
        function bal(int x) returns (int) { return x; }
        function poke() { this.n = this.n + 1; }
      }`);
    expect(a.contractName).toBe('C');
  });

  it('accepts `using ... for ...` inside a library body', () => {
    const a = compileString(`
      library Math { using Math for int; function dbl(int x) returns (int) { return x * 2; } }
      contract C() { int n; function go() { this.n = 1; } }`);
    expect(a.contractName).toBe('C');
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

// Features surfaced by the modern Sablier Flow port. See examples/flow/scash/INTERVENTIONS.md.

describe('Qualified + named-arg event emit', () => {
  it('accepts a qualified emit `emit C.E(...)` (qualifier stripped)', () => {
    const a = compileString(`
      contract C() {
        int n;
        event Moved(address who, int amt);
        function go(address dst, int amt) { emit C.Moved(dst, amt); this.n = this.n + 1; }
      }`);
    expect(a.events?.find((e) => e.name === 'Moved')?.signature).toBe('Moved(address,int)');
  });

  it('reorders named-arg emit `emit E({b, a})` into the event param order', () => {
    const a = compileString(`
      contract C() {
        int n;
        event Moved(address who, int amt);
        function go(address dst, int amt) { emit Moved({amt: amt, who: dst}); this.n = this.n + 1; }
      }`);
    expect(a.contractName).toBe('C');
  });

  it('rejects a named-arg emit whose names do not match the event', () => {
    expect(() => compileString(`
      contract C() {
        int n;
        event Moved(address who, int amt);
        function go(address dst, int amt) { emit Moved({amt: amt, nope: dst}); this.n = this.n + 1; }
      }`)).toThrow(/named argument|No event/);
  });
});

describe('Named-arg external interface call', () => {
  it('reorders named args into the interface function param order', () => {
    const a = compileString(`
      interface IBank { function balanceOf(address who, int day) external view returns (int); }
      contract C() {
        int n;
        function f(bytes32 cat, address who) { int b = IBank(cat).balanceOf({day: 5, who: who}); this.n = b; }
      }`);
    expect(a.contractName).toBe('C');
  });
});

describe('error declarations inside libraries', () => {
  it('accepts an `error` declared in a library body', () => {
    const a = compileString(`
      library Errors { error InsufficientBalance(int available, int required); function id(int x) returns (int) { return x; } }
      contract C() { int n; function go() { this.n = 1; } }`);
    expect(a.contractName).toBe('C');
  });
});

describe('Visibility on free / library functions', () => {
  it('accepts visibility/mutability on a free function (ignored)', () => {
    const a = compileString(`
      function helper(int x) internal pure returns (int) { return x * 2; }
      contract C() { int n; function go() { this.n = helper(3); } }`);
    expect(a.contractName).toBe('C');
  });

  it('accepts visibility/mutability on a library function (ignored)', () => {
    const a = compileString(`
      library Math { function dbl(int x) internal pure returns (int) { return x * 2; } }
      contract C() { int n; function go() { this.n = 1; } }`);
    expect(a.contractName).toBe('C');
  });
});

describe('Interface-only / type-only files', () => {
  it('parses an interface-only file (no trailing contract) and reports it as not directly compilable', () => {
    expect(() => compileString('interface I { function f(int x) external returns (int); }'))
      .toThrow(/do not produce artifacts|Cannot compile/);
  });

  it('parses a type-only file (UDVT + free function, no trailing contract)', () => {
    expect(() => compileString('type UD is int;\nfunction unwrap(UD x) returns (int) { return UD.unwrap(x); }'))
      .toThrow(/do not produce artifacts|Cannot compile/);
  });

  it('imports an interface-only file under solidityImportCompat', () => {
    const resolver = (p: string): { source: string; id: string } | undefined => (p.includes('IBank')
      ? { source: 'interface IBank { function bal(address who) external view returns (int); }', id: 'IBank' }
      : undefined);
    const a = compileString(
      'import { IBank } from "./IBank.sol";\ncontract C() { int n; function f(bytes32 c, address w) { this.n = IBank(c).bal(w); } }',
      { solidityImportCompat: true, importResolver: resolver },
    );
    expect(a.contractName).toBe('C');
  });
});

describe('Qualified + named-arg custom-error revert', () => {
  it('accepts a qualified revert `revert Lib.Err(args)` (qualifier stripped)', () => {
    const a = compileString(`
      library Errors { error Bad(int x); }
      contract C() { int n; function f(int x) { if (x < 0) { revert Errors.Bad(x); } this.n = x; } }`);
    expect(a.contractName).toBe('C');
  });

  it('reorders a named-arg revert into the error param order', () => {
    const a = compileString(`
      contract C() {
        int n;
        error Range(int lo, int hi);
        function f(int x) { if (x < 0) { revert Range({hi: 10, lo: 0}); } this.n = x; }
      }`);
    expect(a.contractName).toBe('C');
  });
});

describe('Named-arg call statement', () => {
  it('accepts a bare named-arg free-function call statement, reordered', () => {
    const a = compileString(`
      function check(int lo, int hi) returns (int) { require(hi >= lo); return hi; }
      contract C() { int n; function f() { check({hi: 5, lo: 1}); this.n = 1; } }`);
    expect(a.contractName).toBe('C');
  });
});

describe('Compound assignment on state (desugars to read <op> rhs)', () => {
  it.each([
    ['scalar',
      'contract C() { int x; function f(int v) { this.x += v; } }',
      'contract C() { int x; function f(int v) { this.x = this.x + v; } }'],
    ['mapping',
      'contract C() { mapping(int=>int) m; function f(int k, int v) { this.m[k] += v; } }',
      'contract C() { mapping(int=>int) m; function f(int k, int v) { this.m[k] = this.m[k] + v; } }'],
    ['mapping field',
      'struct S{int a;} contract C() { mapping(int=>S) m; function f(int k, int v) { this.m[k].a += v; } }',
      'struct S{int a;} contract C() { mapping(int=>S) m; function f(int k, int v) { this.m[k].a = this.m[k].a + v; } }'],
  ])('%s compound matches the explicit form byte-for-byte', (_l, compound, explicit) => {
    expect(compileString(compound).bytecode).toBe(compileString(explicit).bytecode);
  });

  it('supports arithmetic/shift compound operators on an int state var', () => {
    for (const op of ['+=', '-=', '*=', '/=', '%=', '<<=', '>>=']) {
      expect(compileString(`contract C() { int x; function f(int v) { this.x ${op} v; } }`).contractName).toBe('C');
    }
  });

  it('supports bitwise compound operators on a bytes state var', () => {
    for (const op of ['&=', '|=', '^=']) {
      expect(compileString(`contract C() { bytes32 b; function f(bytes32 v) { this.b ${op} v; } }`).contractName).toBe('C');
    }
  });
});

describe('Bare state access (implicit this., Solidity-compatible)', () => {
  it.each([
    ['scalar read',
      'contract C() { int x; int n; function f() { this.n = x + 1; } }',
      'contract C() { int x; int n; function f() { this.n = this.x + 1; } }'],
    ['scalar write',
      'contract C() { int x; function f(int v) { x = v; } }',
      'contract C() { int x; function f(int v) { this.x = v; } }'],
    ['scalar compound write',
      'contract C() { int x; function f(int v) { x += v; } }',
      'contract C() { int x; function f(int v) { this.x = this.x + v; } }'],
    ['mapping read',
      'contract C() { mapping(int=>int) m; int n; function f(int k) { this.n = m[k]; } }',
      'contract C() { mapping(int=>int) m; int n; function f(int k) { this.n = this.m[k]; } }'],
    ['mapping write',
      'contract C() { mapping(int=>int) m; function f(int k, int v) { m[k] = v; } }',
      'contract C() { mapping(int=>int) m; function f(int k, int v) { this.m[k] = v; } }'],
    ['mapping single-key compound write',
      'contract C() { mapping(int=>int) m; function f(int k, int v) { m[k] += v; } }',
      'contract C() { mapping(int=>int) m; function f(int k, int v) { this.m[k] = this.m[k] + v; } }'],
    ['mapping field read',
      'struct S{int a;} contract C() { mapping(int=>S) m; int n; function f(int k) { this.n = m[k].a; } }',
      'struct S{int a;} contract C() { mapping(int=>S) m; int n; function f(int k) { this.n = this.m[k].a; } }'],
    ['mapping field write',
      'struct S{int a;} contract C() { mapping(int=>S) m; function f(int k, int v) { m[k].a = v; } }',
      'struct S{int a;} contract C() { mapping(int=>S) m; function f(int k, int v) { this.m[k].a = v; } }'],
    ['mapping field compound write',
      'struct S{int a;} contract C() { mapping(int=>S) m; function f(int k, int v) { m[k].a += v; } }',
      'struct S{int a;} contract C() { mapping(int=>S) m; function f(int k, int v) { this.m[k].a = this.m[k].a + v; } }'],
    ['nested mapping write',
      'contract C() { mapping(int=>mapping(int=>int)) m; function f(int a, int b, int v) { m[a][b] = v; } }',
      'contract C() { mapping(int=>mapping(int=>int)) m; function f(int a, int b, int v) { this.m[a][b] = v; } }'],
  ])('%s matches the this.-prefixed form byte-for-byte', (_l, bare, explicit) => {
    expect(compileString(bare).bytecode).toBe(compileString(explicit).bytecode);
  });

  it('bare names resolve to a param vs state distinctly (scope chain)', () => {
    const readParam = compileString('contract C() { int s; int out; function f(int p) { require(p >= 0); this.out = p; } }');
    const readState = compileString('contract C() { int s; int out; function f(int p) { require(p >= 0); this.out = s; } }');
    expect(readParam.bytecode).not.toBe(readState.bytecode);
  });
});

// Blockers cleared from the solidity-by-example corpus run. See docs/solidity-by-example-blockers.md.

describe('State-variable inline initializers (lowered into the constructor)', () => {
  it.each([
    ['scalar', 'contract C() { uint public count = 123; function f() { this.count = this.count + 1; } }'],
    ['bool', 'contract C() { bool flag = true; function f() { this.flag = false; } }'],
    ['bytes32', 'contract C() { bytes32 h = 0x0000000000000000000000000000000000000000000000000000000000000001; function f() { this.h = 0x0000000000000000000000000000000000000000000000000000000000000002; } }'],
  ])('accepts %s initializer', (_l, src) => {
    expect(compileString(src).contractName).toBe('C');
  });

  it('runs the initializer before the user constructor body', () => {
    const a = compileString('contract C() { uint x = 5; constructor(uint v) { this.x = this.x + v; } function f() { this.x = this.x + 1; } }');
    expect(a.contractName).toBe('C');
  });
});

describe('Multiple top-level definitions per file', () => {
  it('compiles the last contract as primary, earlier ones available', () => {
    const a = compileString('contract A() { function f() returns (int) { return 1; } } contract C() { int n; function g() { this.n = 1; } }');
    expect(a.contractName).toBe('C');
  });

  it('the primary may inherit an earlier contract in the same file', () => {
    const a = compileString('contract Base() { int n; function base() { this.n = 1; } } contract C() is Base { function g() { this.n = 2; } }');
    expect(a.contractName).toBe('C');
  });

  it('interface + contract in one file', () => {
    const a = compileString('interface I { function f() external; } contract C() is I { int n; function f() { this.n = 1; } }');
    expect(a.contractName).toBe('C');
  });
});

describe('Constructor payable + interface body ordering', () => {
  it('accepts payable on a constructor (ignored)', () => {
    expect(compileString('contract C() { int n; constructor() payable { this.n = 1; } function f() { this.n = this.n + 1; } }').contractName).toBe('C');
  });

  it('accepts events/errors interleaved with functions in an interface body', () => {
    const a = compileString('interface I { function f() external; event E(int v); error Bad(int x); } contract C() is I { int n; function f() { this.n = 1; } }');
    expect(a.contractName).toBe('C');
  });
});

describe('uint256 <-> int compatibility', () => {
  it.each([
    ['state assign', 'contract C() { uint256 x; function f() { this.x = 5; } }'],
    ['return int as uint256', 'contract C() { int n; function f() returns (uint256) { this.n = 1; return 7; } }'],
    ['local int -> uint256', 'contract C() { int n; function f() { uint256 y = 3; this.n = y; } }'],
  ])('%s', (_l, src) => {
    expect(compileString(src).contractName).toBe('C');
  });
});

describe('address casts + enum state + unresolved-type params', () => {
  it('allows the explicit address(int) cast (e.g. address(0))', () => {
    const a = compileString('contract C() { address a; function f() { this.a = address(0); } }');
    expect(a.contractName).toBe('C');
  });

  it('allows a bytes address literal to initialize an address', () => {
    const a = compileString('contract C() { address a = 0x0000000000000000000000000000000000000001; function f() { this.a = address(0); } }');
    expect(a.contractName).toBe('C');
  });

  it('allows an enum-typed state variable', () => {
    const a = compileString('contract C() { enum S { A, B } S status; function f() { this.status = S.B; } }');
    expect(a.contractName).toBe('C');
  });

  it('does not crash on a contract/interface-typed parameter (resolves to address)', () => {
    const a = compileString('interface ICallee { function setX(int x) external; } contract C() { int n; function f(ICallee c) { require(c != address(0)); this.n = 1; } }');
    expect(a.contractName).toBe('C');
  });
});

describe('Array return types, unnamed params, array locals, bare delete', () => {
  it('accepts an array return type', () => {
    const a = compileString('contract C() { int[3] arr; function f() returns (int[] memory) { int[] r; return r; } }');
    expect(a.contractName).toBe('C');
  });

  it('accepts unnamed parameters (interface signatures)', () => {
    const a = compileString('interface I { function transfer(address, uint256) external returns (bool); } contract C() { int n; function g() { this.n = 1; } }');
    expect(a.contractName).toBe('C');
  });

  it('accepts an uninitialized array local (zero-init)', () => {
    const a = compileString('contract C() { int n; function f() { int[] r; this.n = r.length; } }');
    expect(a.contractName).toBe('C');
  });

  it('accepts bare `delete m[k]` (routed to state)', () => {
    const a = compileString('contract C() { mapping(int => int) m; function f(int k) { delete m[k]; } }');
    expect(a.contractName).toBe('C');
  });
});

describe('Soft keywords (reserved in SolidCash, valid identifiers in Solidity)', () => {
  it.each([
    ['param named error, read in body', 'contract C() { int n; function f(int error) { this.n = error; } }'],
    ['function named deploy', 'contract C() { int n; function deploy() { this.n = 1; } }'],
    ['local named revert', 'contract C() { int n; function f() { int revert = 5; this.n = revert; } }'],
    ['local named delegate', 'contract C() { int n; function f() { int delegate = 3; this.n = delegate; } }'],
    ['local named global', 'contract C() { int n; function f() { int global = 7; this.n = global; } }'],
    ['struct field named error', 'struct S { int error; } contract C() { int n; function f(int v) { this.n = v; } }'],
  ])('%s', (_l, src) => {
    expect(compileString(src).contractName).toBe('C');
  });

  it('still parses the deploy/selfdestruct function modifiers in modifier position', () => {
    expect(compileString('contract C() { int n; function f() deploy { this.n = 1; } }').contractName).toBe('C');
  });
});

describe('FinalRequire relaxation', () => {
  it('allows a non-final require to gate the path (require not last)', () => {
    const a = compileString('contract C() { mapping(int=>int) m; function f(int k) { require(k > 0); delete m[k]; } }');
    expect(a.contractName).toBe('C');
  });

  it('still errors (by default) on a void path with no verification', () => {
    expect(() => compileString('contract C() { function f(int i) pure { if (i <= 100) { revert("x"); } } }'))
      .toThrow(/require\(\) statement|FinalRequire/i);
  });

  it('downgrades the no-verification error to a warning under solidityImportCompat', () => {
    const a = compileString(
      'contract C() { function f(int i) pure { if (i <= 100) { revert("x"); } } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });
});

describe('BCH crypto types + number units usable as identifiers (lexer split)', () => {
  it.each([
    ['var named sig', 'contract C(){ int n; function f() { int sig = 5; this.n = sig; } }'],
    ['var named bits', 'contract C(){ int n; function f() { int bits = 3; this.n = bits; } }'],
    ['param named pubkey', 'contract C(){ int n; function f(int pubkey) { this.n = pubkey; } }'],
    ['var named datasig', 'contract C(){ int n; function f() { int datasig = 7; this.n = datasig; } }'],
  ])('%s', (_l, src) => { expect(compileString(src).contractName).toBe('C'); });

  it('still parses the crypto types + number units (no regression)', () => {
    expect(compileString('contract C(){ int n; function f(sig s, pubkey pk, datasig d, bytes32 m) { require(checkSig(s, pk)); require(checkDataSig(d, m, pk)); this.n = 5 bits; } }').contractName).toBe('C');
  });
});

describe('Low-level call options + tuple-slot modifiers + value units', () => {
  it('supports the {value:} call option on a low-level call', () => {
    const a = compileString('contract C() { int n; function f(address to, bytes data, int v) { (bool ok, bytes res) = to.call{value: v}(data); require(ok); this.n = res.length; } }');
    expect(a.contractName).toBe('C');
  });

  it('supports a data-location modifier in a tuple slot', () => {
    const a = compileString('contract C() { int n; function f(address to, bytes data) { (bool ok, bytes memory res) = to.call(data); require(ok); this.n = res.length; } }');
    expect(a.contractName).toBe('C');
  });

  it.each([
    ['ether', 'this.n = 1 ether;'],
    ['gwei', 'this.n = 2 gwei;'],
    ['wei', 'this.n = 100 wei;'],
  ])('accepts the %s value unit', (_l, body) => {
    expect(compileString(`contract C() { int n; function f() { ${body} } }`).contractName).toBe('C');
  });
});

// Foundation for the EVM-parity external-call model. See docs/external-contract-calls.md.
describe('this.categoryId introspection (contract self-category)', () => {
  it('lowers to OP_INPUTINDEX OP_UTXOTOKENCATEGORY (the active input own category)', () => {
    const a = compileString('contract C() { function f(bytes32 expected) { require(this.categoryId == expected); } }');
    expect(a.bytecode).toContain('OP_INPUTINDEX OP_UTXOTOKENCATEGORY');
  });

  it('can be stored into a state variable', () => {
    const a = compileString('contract C() { bytes category; function f() { this.category = this.categoryId; } }');
    expect(a.contractName).toBe('C');
  });

  it('reserves `categoryId` as a state-variable name (shadowed by the introspection token)', () => {
    expect(() => compileString('contract C() { int categoryId; function f() { this.categoryId = 1; } }')).toThrow();
  });
});
