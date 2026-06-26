import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
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
    expect(ev?.signature).toBe('Moved(address,int256)');
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
  it('accepts `uint` as an alias for uint256', () => {
    const a = compileString('contract C() { bigint n; function f(uint x) { this.n = x; } }');
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
    expect(a.events?.find((e) => e.name === 'Moved')?.signature).toBe('Moved(address,int256)');
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
    ['local uint256 -> bigint', 'contract C() { bigint n; function f() { uint256 y = 3; this.n = y; } }'],
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

// solidity-by-example porting bench. See packages/solidc/docs/solidity-by-example-bench.md.
describe('SBE-1: break/continue when the branch is the last loop statement', () => {
  it('compiles a for-loop whose final statement is if(){break} (loop/Loop.sol pattern)', () => {
    const a = compileString(`
      contract C() {
        function f() {
          int sum = 0;
          for (int i = 0; i < 10; i = i + 1) {
            if (i == 3) { continue; }
            if (i == 5) { break; }
            sum = sum + i;
          }
          require(sum >= 0);
        }
      }`);
    expect(a.contractName).toBe('C');
  });

  it('compiles a bare if(){break} as the only loop statement', () => {
    const a = compileString(`
      contract C() {
        function f(int n) {
          for (int i = 0; i < n; i = i + 1) {
            if (i == 5) { break; }
          }
          require(true);
        }
      }`);
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-2: bytesN -> bytesM cast (truncate / widen)', () => {
  it('compiles bytes4(keccak256(...)) function-selector truncation', () => {
    const a = compileString(`
      contract C() {
        function f(string s) {
          bytes4 sel = bytes4(keccak256(bytes(s)));
          require(sel.length == 4);
        }
      }`);
    expect(a.contractName).toBe('C');
  });

  it('shrinking a bounded bytes truncates the leftmost bytes (OP_SPLIT OP_DROP)', () => {
    const a = compileString('contract C() { function f() { bytes2 a = 0x1234; bytes1 b = bytes1(a); require(b.length == 1); } }');
    expect(a.bytecode).toContain('OP_SPLIT OP_DROP');
  });

  it('widening a bounded bytes right-pads with zero bytes (OP_CAT)', () => {
    const a = compileString('contract C() { function f() { bytes1 a = 0x12; bytes4 b = bytes4(a); require(b.length == 4); } }');
    expect(a.bytecode).toContain('OP_CAT');
  });
});

describe('SBE-3: unused vars/params warn but never fail (Solidity-style)', () => {
  it('compiles imported Solidity with unused vars/params', () => {
    const a = compileString(`pragma solidity ^0.8.26;
      contract C {
        function f(uint256 used, uint256 unusedParam) public pure returns (uint256) {
          uint256 unusedLocal = 7;
          return used;
        }
      }`, { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });
  it('also accepts an unused param in a native SolidCash contract (no flag, warn-only)', () => {
    const a = compileString('contract C() { function f(sig s, pubkey pk, int unused) { require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-4: function-less contracts compile (state-publishing, unspendable)', () => {
  it('a truly-empty contract compiles to an unspendable OP_RETURN script', () => {
    const a = compileString('contract Foo() {}');
    expect(a.bytecode).toBe('OP_0 OP_VERIFY');
  });

  it('a modifier-only contract compiles to OP_RETURN', () => {
    const a = compileString('contract Guard() { modifier noReentrant() { _; } }');
    expect(a.bytecode).toBe('OP_0 OP_VERIFY');
  });

  it('a storage-only Solidity contract compiles under solidityImportCompat', () => {
    const a = compileString(`pragma solidity ^0.8.26;
      contract HelloWorld { string public greet = "Hello World!"; }`, { solidityImportCompat: true });
    expect(a.contractName).toBe('HelloWorld');
  });
});

describe('SBE-5: for-loop flexibility + prefix increment statements', () => {
  it('for-loop with omitted initializer defaults the counter to 0', () => {
    const a = compileString('contract C() { function f() { int s = 0; for (int i; i < 3; i++) { s = s + i; } require(s >= 0); } }');
    expect(a.contractName).toBe('C');
  });

  it('for-loop with an empty update clause compiles', () => {
    const a = compileString('contract C() { function f() { int s = 0; for (int i = 0; i < 3;) { s = s + i; unchecked { i = i + 1; } } require(s >= 0); } }');
    expect(a.contractName).toBe('C');
  });

  it('accepts prefix ++ and -- as statements (same effect as postfix)', () => {
    const a = compileString('contract C() { function f() { int i = 0; ++i; --i; require(i == 0); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-6: external calls on interface-typed variables (EVM parity)', () => {
  const IFACE = 'interface IERC20 { function transferFrom(address f, address t, int a) external returns (bool); }';
  it('routes a method call on an interface-typed state var to an external call', () => {
    const a = compileString(`${IFACE}
      contract C(IERC20 token) {
        function f(address from, address to, sig s, pubkey pk) {
          bool ok = token.transferFrom(from, to, 5);
          require(checkSig(s, pk));
        }
      }`);
    expect(a.contractName).toBe('C');
  });
  it('routes a method call on an interface-typed local (IFoo x = IFoo(addr))', () => {
    const a = compileString(`interface IFoo { function bar(int x) external returns (int); }
      contract C() {
        function f(address a, sig s, pubkey pk) { IFoo foo = IFoo(a); int r = foo.bar(5); require(checkSig(s, pk)); }
      }`);
    expect(a.contractName).toBe('C');
  });
  it('routes a method call on an interface-typed parameter', () => {
    const a = compileString(`interface IFoo { function bar(int x) external returns (int); }
      contract C() { function f(IFoo foo, sig s, pubkey pk) { int r = foo.bar(5); require(checkSig(s, pk)); } }`);
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-7: ether-send via low-level call{value:}', () => {
  it('addr.call{value:}(data) on an address variable', () => {
    const a = compileString('contract C() { function f(address dst, sig s, pubkey pk) { (bool ok, bytes d) = dst.call{value: 100}(0x); require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
  it('msg.sender.call{value:}(data)', () => {
    const a = compileString('contract C() { function f(sig s, pubkey pk) { (bool ok, bytes d) = msg.sender.call{value: 100}(0x); require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-8: satoshi transfer requires a stateful contract (clean error, no crash)', () => {
  it('rejects address.transfer() in a stateless contract with a clear error', () => {
    expect(() => compileString('contract C() { function f(address payable dst, sig s, pubkey pk) { dst.transfer(100); require(checkSig(s, pk)); } }'))
      .toThrow(/require a stateful contract/);
  });
  it('rejects address.send() in a stateless contract', () => {
    expect(() => compileString('contract C() { function f(address payable dst, sig s, pubkey pk) { bool ok = dst.send(100); require(checkSig(s, pk)); } }'))
      .toThrow(/require a stateful contract/);
  });
  it('still allows address.transfer() in a stateful contract', () => {
    const a = compileString('contract C() { int n; function f(address payable dst, sig s, pubkey pk) { dst.transfer(100); this.n = 1; require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-9: imported enum/struct types + hex-literal-as-int + implicit named return', () => {
  it('resolves an enum-typed state var imported from another file', () => {
    const resolver = (p: string): { source: string; id: string } | undefined => (p.includes('Decl')
      ? { source: 'enum Status { Pending, Shipped }', id: 'Decl' } : undefined);
    const a = compileString('pragma solidity ^0.8.26;\nimport "./Decl.sol";\ncontract Enum { Status public status; }',
      { solidityImportCompat: true, importResolver: resolver });
    expect(a.contractName).toBe('Enum');
  });

  it('treats a hex number literal as a big-endian int when compared with an int (compat)', () => {
    const a = compileString('pragma solidity ^0.8.26;\ncontract C { function f(uint256 x) external pure returns (bool) { return x >= 0x100000000000000000000000000000000; } }',
      { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });

  it('keeps int-vs-hex-literal a type error in native SolidCash (no flag)', () => {
    expect(() => compileString('contract C() { function f() { require(tx.version == 0x02); } }')).toThrow();
  });

  it('returns named returns implicitly when there is no explicit return', () => {
    const a = compileString('contract C() { function f(int x, sig s, pubkey pk) returns (int r) { r = x + 1; require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-10: storage-pointer locals + block.timestamp + stmt-form interface calls', () => {
  it('aliases a mapping-struct storage pointer for read and write', () => {
    const a = compileString(`contract C() {
      struct S { int a; bool b; }
      mapping(int => S) m;
      function f(int k, int v) { S storage s = m[k]; require(s.a >= 0); s.a += v; s.b = true; }
    }`);
    expect(a.contractName).toBe('C');
  });

  it('aliases a struct-array storage pointer', () => {
    const a = compileString(`contract C() {
      struct T { bigint x; bool done; }
      T[] arr;
      function f(int i) { T storage t = arr[i]; require(!t.done); t.x = 5; }
    }`);
    expect(a.contractName).toBe('C');
  });

  it('maps block.timestamp to tx.locktime under solidityImportCompat', () => {
    const a = compileString(`pragma solidity ^0.8.26;
      contract C { uint256 t; function f(uint256 startAt) external { require(startAt >= block.timestamp); t = startAt; } }`,
    { solidityImportCompat: true });
    expect(a.bytecode).toContain('OP_TXLOCKTIME');
  });

  it('routes a statement-form interface call on a constructor-param var (2-arg .transfer is not satoshi send)', () => {
    const a = compileString(`interface IERC20 { function transfer(address t, uint256 a) external returns (bool); }
      contract C(IERC20 token) { uint256 n; function f(address to, uint256 amt) external { token.transfer(to, amt); n = 1; } }`,
    { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-11: local struct member assignment (desugars to a struct rebuild)', () => {
  it('assigns a field of a local struct', () => {
    const a = compileString('contract C() { struct S { int a; bool b; } int n; function f(int v) { S memory s; s.a = v; this.n = s.a; } }');
    expect(a.contractName).toBe('C');
  });
  it('supports compound assignment on a local struct field', () => {
    const a = compileString('contract C() { struct S { int a; bool b; } int n; function f(int v) { S memory s = S(1, false); s.a += v; this.n = s.a; } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-12: single-type abi.decode unwraps to the element type (not a 1-tuple)', () => {
  it('uses a single-type decode in a boolean expression', () => {
    const a = compileString(
      'contract C() { int n; function f(bytes data, bool a) { if (a || abi.decode(data, (bool))) { this.n = 1; } } }',
    );
    expect(a.contractName).toBe('C');
  });
  it('assigns a single-type decode directly', () => {
    const a = compileString('contract C() { bool z; function f(bytes data) { this.z = abi.decode(data, (bool)); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-13: void external-call helpers are inlined at internal call sites (SafeERC20 pattern)', () => {
  const IFACE = 'interface IERC20 { function transferFrom(address f, address t, int a) external returns (bool); }';
  it('inlines a helper called twice; each inline collects its own external call', () => {
    const a = compileString(`${IFACE}
      contract C(IERC20 token1, IERC20 token2) {
        int n;
        function _safe(IERC20 t, address f, address r, int v) {
          bool sent = t.transferFrom(f, r, v); require(sent);
        }
        function go(address f, address r, sig s, pubkey pk) {
          require(checkSig(s, pk));
          _safe(token1, f, r, 5);
          _safe(token2, r, f, 7);
          this.n = 1;
        }
      }`);
    // Two internal calls -> two inlined transferFrom external calls in `go` (the helper's `sent` local is
    // alpha-renamed per inline, so the two copies do not collide).
    const go = a.abi.find((f) => f.name === 'go');
    expect(go?.externalCalls?.length).toBe(2);
    expect(go?.externalCalls?.every((c) => c.functionName === 'transferFrom')).toBe(true);
  });
});

describe('SBE-14: bare state-array push/pop (Solidity idiom) routes to state, like this.arr.push', () => {
  const src = (op: string): string =>
    `contract C() { uint256[] arr; function f(uint256 x, sig s, pubkey pk) { require(checkSig(s, pk)); ${op}; } }`;
  it('bare arr.push(x) compiles identically to this.arr.push(x)', () => {
    expect(compileString(src('arr.push(x)'), { solidityImportCompat: true }).bytecode)
      .toBe(compileString(src('this.arr.push(x)'), { solidityImportCompat: true }).bytecode);
  });
  it('bare arr.pop() compiles identically to this.arr.pop()', () => {
    expect(compileString(src('arr.pop()'), { solidityImportCompat: true }).bytecode)
      .toBe(compileString(src('this.arr.pop()'), { solidityImportCompat: true }).bytecode);
  });
});

describe('SBE-15: empty-body returning function + named-arg call to a returning function', () => {
  it('an empty-body function with return types compiles (Solidity returns defaults) under compat', () => {
    const a = compileString(
      'contract X() { function f(uint256 x) public pure returns (uint256) {} function g() external pure returns (uint256) { return f(1); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('X');
  });
  it('still rejects an empty-body returning function in native mode (footgun guard)', () => {
    expect(() => compileString(
      'contract X() { int n; function ok() { this.n = 1; } function f(uint256 x) returns (uint256) {} }',
    )).toThrow(/contains no statements/);
  });
  it('forwards the synthetic returnOutputIdx for a named-arg call to a public returning function', () => {
    const a = compileString(
      'contract X() { function f(uint256 x, uint256 y) public pure returns (uint256) { return x + y; }'
      + ' function g() external pure returns (uint256) { return f({y: 2, x: 1}); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('X');
  });
});

describe('SBE-16: assignment-as-expression `(x op= rhs)` yields the new value', () => {
  it('compiles a compound assignment in a while condition (most-significant-bit loop)', () => {
    const a = compileString(
      'contract C() { int n; function f(uint256 x, sig s, pubkey pk) { require(checkSig(s, pk));'
      + ' uint256 i = 0; while ((x >>= 1) > 0) { i = i + 1; } this.n = int(i); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });
  it('compiles a simple assignment used as an expression `(y = expr)`', () => {
    const a = compileString(
      'contract C() { int n; function f(uint256 x, sig s, pubkey pk) { require(checkSig(s, pk));'
      + ' uint256 y = 0; if ((y = x + 1) > 5) { this.n = int(y); } else { this.n = 0; } } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });
  it('does not regress a normal parenthesized expression', () => {
    const a = compileString(
      'contract C() { int n; function f(int x, sig s, pubkey pk) { require(checkSig(s, pk)); this.n = (x + 1) * 2; } }',
    );
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-17: this.<fn>.selector resolves to the function selector (bytes4)', () => {
  it('uses this.fn.selector in abi.encodeWithSelector (own function)', () => {
    const a = compileString(
      'contract C() { function test(uint256 i) external pure returns (uint256) { return i; }'
      + ' function getData(uint256 i) external pure returns (bytes) { return abi.encodeWithSelector(this.test.selector, i); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-18: parent-constructor args (inheritance-list + constructor-level) inline the parent ctor body', () => {
  const BASES = 'contract X { string nm; constructor(string _n) { nm = _n; } }'
    + ' contract Y { string tt; constructor(string _t) { tt = _t; } }';
  it('inheritance-list args: contract B is X("a"), Y("b")', () => {
    expect(compileString(`${BASES} contract B is X("a"), Y("b") {}`, { solidityImportCompat: true }).contractName)
      .toBe('B');
  });
  it('constructor-level args: constructor() X("a") Y("b")', () => {
    expect(compileString(`${BASES} contract E is X, Y { constructor() X("a") Y("b") {} }`,
      { solidityImportCompat: true }).contractName).toBe('E');
  });
  it('inlines + substitutes the parent ctor body (a wrong-typed arg is a type error)', () => {
    expect(() => compileString(
      'contract Base { int b; constructor(int _x) { b = _x; } } contract C is Base { constructor() Base("oops") {} }',
      { solidityImportCompat: true })).toThrow();
  });
  it('checks the parent ctor arg count against the parent constructor params', () => {
    expect(() => compileString(
      'contract Base { int b; constructor(int _x) { b = _x; } } contract C is Base { constructor() Base(1, 2) {} }',
      { solidityImportCompat: true })).toThrow(/expects 1/);
  });
});

describe('SBE-19: Interface.method.selector / Contract.method.selector resolve to the 4-byte selector', () => {
  it('uses Interface.method.selector in abi.encodeWithSelector', () => {
    expect(compileString(
      'interface IFoo { function bar(address a, uint256 b) external; }'
      + ' contract C { function f(address to, uint256 amt) external pure returns (bytes) {'
      + ' return abi.encodeWithSelector(IFoo.bar.selector, to, amt); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('resolves a sibling contract method selector (Contract.method.selector)', () => {
    expect(compileString(
      'contract Other { function ping(uint256 x) external {} }'
      + ' contract C { function f(uint256 x) external pure returns (bytes) {'
      + ' return abi.encodeWithSelector(Other.ping.selector, x); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('SBE-20: selfdestruct(addr) implies the selfdestruct modifier and pins output 0 to addr', () => {
  const AUTH = 'contract C(pubkey admin) { int counter;'
    + ' function kill(sig s, address to) { require(checkSig(s, admin)); selfdestruct(to); } }';

  it('implies the selfdestruct modifier in the ABI', () => {
    const artifact = compileString(AUTH);
    const kill = artifact.abi.find((f) => f.name === 'kill');
    expect(kill?.modifiers).toContain('selfdestruct');
  });

  it('pins output 0 to addr (OP_OUTPUTBYTECODE) and pins the value (single-output check)', () => {
    const stmt = bytecodeToAsm(hexToBin(compileString(AUTH).debug.bytecode));
    const modOnly = bytecodeToAsm(hexToBin(compileString(
      'contract C(pubkey admin) { int counter;'
      + ' function kill(sig s) selfdestruct { require(checkSig(s, admin)); } }',
    ).debug.bytecode));
    // Address pin: outputs[0].lockingBytecode == addr (statement-specific; absent from the modifier-only form).
    expect(stmt).toContain('OP_OUTPUTBYTECODE');
    expect(modOnly).not.toContain('OP_OUTPUTBYTECODE');
    // Value pin: exactly one output, so the freed value can only land at addr (or miner fee), never siphoned.
    expect(stmt).toContain('OP_TXOUTPUTCOUNT OP_1 OP_NUMEQUALVERIFY');
  });

  it('rejects an unauthenticated selfdestruct (the final require guard is mandatory)', () => {
    expect(() => compileString(
      'contract C(pubkey admin) { int counter; function kill(address to) { selfdestruct(to); } }',
    )).toThrow();
  });
});
