import { describe, it, expect, vi } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '../src/index.js';

// Compiler features surfaced by porting Solidity (Sablier) to SolidCash.
// See packages/solidc/docs/solidity-import-compat.md.

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

  it('tolerates no-op EVM pragmas (`abicoder`, `experimental`) as no-ops', () => {
    const abicoder = 'pragma solidity ^0.8.0;\npragma abicoder v2;\ncontract C() { function f() { require(true); } }';
    expect(compileString(abicoder, { solidityImportCompat: true }).contractName).toBe('C');
    const experimental = 'pragma experimental ABIEncoderV2;\npragma solidity ^0.8.0;\n'
      + 'contract C() { function f() { require(true); } }';
    expect(compileString(experimental, { solidityImportCompat: true }).contractName).toBe('C');
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

describe('transient state variables (EIP-1153 porting)', () => {
  const layout = (body: string): { variables: { name: string }[] } | undefined =>
    compileString(`pragma solidity ^0.8.24;\n${body}`, { solidityImportCompat: true }).stateLayout;

  it('excludes a transient var from the persisted state layout (only `n` is stored)', () => {
    const sl = layout('contract C() { uint256 n; uint256 transient scratch;'
      + ' function bump() { scratch = 5; this.n = this.n + scratch; } }');
    expect(sl?.variables.map((v) => v.name)).toEqual(['n']);
  });

  it('a transient-only contract stays stateless (no data NFT, zero state overhead)', () => {
    // The read-before-write guard also proves the lowered local is zero-init each spend.
    expect(layout('contract C() { uint256 transient locked;'
      + ' function enter() { require(locked == 0); locked = 1; require(locked == 1); } }')).toBeUndefined();
  });

  it('lowers a transient var to a usable zero-init local (read + write)', () => {
    const art = compileString('pragma solidity ^0.8.24;\ncontract C() { uint256 transient tmp;'
      + ' function f(uint256 x) { tmp = x; require(tmp == x); } }', { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });

  it('works in native mode too (transient is not gated on solidityImportCompat)', () => {
    const art = compileString('contract C() { uint256 transient tmp;'
      + ' function f(uint256 x) { tmp = x; require(tmp == x); } }');
    expect(art.contractName).toBe('C');
  });

  it('warns once per transient var that it has no UTXO analogue', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString('pragma solidity ^0.8.24;\ncontract C() { uint256 transient a; uint256 transient b;'
      + ' function f() { a = 1; b = 2; require(a == 1); } }', { solidityImportCompat: true });
    const w = spy.mock.calls.filter((c) => String(c[0]).includes('has no UTXO analogue'));
    spy.mockRestore();
    expect(w.length).toBe(2);
  });

  it('does not inject the transient local into functions that never reference it', () => {
    // `ignoresIt` never touches scratch; compilation must still succeed and persist only `n`.
    const sl = layout('contract C() { uint256 n; uint256 transient scratch;'
      + ' function usesIt() { scratch = 3; this.n = scratch; }'
      + ' function ignoresIt() { this.n = 7; } }');
    expect(sl?.variables.map((v) => v.name)).toEqual(['n']);
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

describe('ecrecover (verify-with-pubkey; no native recovery on BCH)', () => {
  it('3-arg ecrecover(hash, sig, pubKey) emits OP_CHECKDATASIG + the P2PKH build', () => {
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(bytes32 h, datasig s, pubkey pk) {'
      + ' address r = ecrecover(h, s, pk); require(r != 0x); } }').debug.bytecode));
    expect(asm).toContain('OP_CHECKDATASIG');
    expect(asm).toContain('OP_HASH160');                 // hash160(pubKey) for the P2PKH script
    expect(asm).toContain('76a914');                     // P2PKH prefix
    expect(asm).toContain('88ac');                       // P2PKH suffix
  });

  it('4-arg Solidity ecrecover(hash, v, r, s) compiles (no error), warns, and is inert (drops args -> 0x)', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const artifact = compileString(
      'contract C() { function f(bytes32 h, int v, bytes32 r, bytes32 s) {'
      + ' address a = ecrecover(h, v, r, s); require(a == 0x); } }');
    expect(artifact.contractName).toBe('C');             // accepted, not a compile error
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    expect(asm).toContain('OP_2DROP');                   // the (hash, v, r, s) args are dropped
    expect(asm).not.toContain('OP_CHECKDATASIG');        // no verification - inert
    expect(warn.mock.calls.some((c) => String(c[0]).includes('ecrecover(hash, v, r, s)'))).toBe(true);
    warn.mockRestore();
  });
});

describe('uint160(address) / bytes20(address) Solidity-compat narrowing casts', () => {
  it('bytes20(address) narrows to the embedded 20-byte hash (skips the P2PKH frame) and warns', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(address a, bytes20 e) { require(bytes20(a) == e); } }').debug.bytecode));
    expect(asm).toContain('OP_3 OP_SPLIT OP_NIP'); // skip the 0x76a914 prefix, then take 20 / drop 88ac
    expect(asm).not.toContain('OP_BIN2NUM');        // bytes20, not int
    expect(warn.mock.calls.some((c) => String(c[0]).includes('narrows a variable-length BCH address'))).toBe(true);
    warn.mockRestore();
  });

  it('uint160(address) narrows then OP_BIN2NUM to a non-negative int', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(address a, int e) { require(uint160(a) == e); } }').debug.bytecode));
    expect(asm).toContain('OP_3 OP_SPLIT OP_NIP');
    expect(asm).toContain('OP_BIN2NUM');
    warn.mockRestore();
  });

  it('bytes(address) keeps the full locking bytecode (only bytes20/int narrow)', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(address a, bytes e) { require(bytes(a) == e); } }').debug.bytecode));
    expect(asm).not.toContain('OP_3 OP_SPLIT OP_NIP');
    expect(warn.mock.calls.some((c) => String(c[0]).includes('narrows a variable-length BCH address'))).toBe(false);
    warn.mockRestore();
  });

  it('address(bytes20) / address(uint160) warn (a BCH address is variable-length, not a 20-byte hash)', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString('contract C() { function f(bytes20 b) { address x = address(b); require(x == x); } }');
    compileString('contract C() { function f(int i) { address x = address(uint160(i)); require(x == x); } }');
    const fired = warn.mock.calls.filter((c) => String(c[0]).includes('does not yield a valid'));
    expect(fired.length).toBe(2);
    warn.mockRestore();
  });

  it('address(bytes) (a full locking bytecode) does NOT warn', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString('contract C() { function f(bytes b) { address x = address(b); require(x == x); } }');
    expect(warn.mock.calls.some((c) => String(c[0]).includes('does not yield a valid'))).toBe(false);
    warn.mockRestore();
  });
});

describe('++ / -- on state-variable and element lvalues (common Solidity idiom)', () => {
  it('compiles postfix ++/-- on state vars, mapping elements, and array elements', () => {
    for (const body of [
      'int n; function f() { this.n++; }',
      'int n; function f() { this.n--; }',
      'mapping(int => int) m; function f(int k) { this.m[k]++; }',
      'mapping(int => int) m; function f(int k) { this.m[k]--; }',
      'int[] a; function f(int i) { this.a[i]++; }',
    ]) {
      expect(compileString(`contract C() { ${body} }`).contractName).toBe('C');
    }
  });

  it('state ++/-- desugars byte-identically to += 1 / -= 1', () => {
    expect(compileString('contract C() { int n; function f() { this.n++; } }').debug.bytecode)
      .toBe(compileString('contract C() { int n; function f() { this.n += 1; } }').debug.bytecode);
    expect(compileString('contract C() { int n; function f() { this.n--; } }').debug.bytecode)
      .toBe(compileString('contract C() { int n; function f() { this.n -= 1; } }').debug.bytecode);
  });

  it('accepts pre-increment/decrement in a for-loop update (for (; ; ++i) / (--i))', () => {
    expect(compileString('contract C() { function f() { int t = 0; for (int i = 0; i < 3; ++i) { t = t + i; } require(t == 3); } }')
      .contractName).toBe('C');
    expect(compileString('contract C() { function f() { int t = 0; for (int i = 3; i > 0; --i) { t = t + i; } require(t == 6); } }')
      .contractName).toBe('C');
  });

  it('still parses a bare local ++ (unchanged)', () => {
    expect(compileString('contract C() { int n; function f() { int i = 0; i++; this.n = i; } }').contractName)
      .toBe('C');
  });
});

describe('empty void functions synthesize a no-op body (Solidity porting: receive/fallback/payable)', () => {
  it('compiles empty receive(), payable, and plain void functions under solidityImportCompat', () => {
    for (const body of [
      'function inc() public { n++; } receive() external payable {}',
      'function deposit() public payable {} function inc() public { n++; }',
      'function f() public {} function inc() public { n++; }',
      'function inc() public { n++; } fallback() external payable {}',
    ]) {
      const src = `pragma solidity ^0.8.0; contract C { int n; ${body} }`;
      expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
    }
  });

  it('still rejects an empty function in native mode (the guard is preserved)', () => {
    expect(() => compileString('contract C() { int n; function f() {} }'))
      .toThrow(/contains no statements/);
  });
});

describe('calldata read-only enforcement (Solidity data-location parity)', () => {
  const compiles = (body: string): string => compileString(`contract C() { ${body} }`).contractName;
  const REASON = /read-only 'calldata'/;

  it('rejects a direct write to a calldata parameter', () => {
    expect(() => compiles('function f(int calldata x) { x = 5; require(true); }')).toThrow(REASON);
  });

  it('rejects a compound write to a calldata parameter', () => {
    expect(() => compiles('function f(int calldata x) { x += 1; require(true); }')).toThrow(REASON);
  });

  it('rejects writing a calldata array element', () => {
    expect(() => compiles('function f(int[] calldata xs) { xs[0] = 5; require(true); }')).toThrow(REASON);
  });

  it('allows reading a calldata parameter', () => {
    expect(compiles('function f(int calldata x) { require(x > 0); }')).toBe('C');
  });

  it('allows copying calldata into a plain variable and mutating the copy', () => {
    expect(compiles('function f(int calldata x) { int y = x; y = 5; require(y == 5); }')).toBe('C');
  });

  it('keeps memory parameters mutable (memory is the default, not read-only)', () => {
    expect(compiles('function f(int memory x) { x = 5; require(x == 5); }')).toBe('C');
  });

  it('no longer warns that memory / calldata are no-ops', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString('contract C() { function f(bytes memory a, int calldata b)'
      + ' { require(b > 0); require(a.length > 0); } }');
    const noop = spy.mock.calls.some((c) => String(c[0]).includes('data location modifier is a no-op'));
    spy.mockRestore();
    expect(noop).toBe(false);
  });
});

describe('const array dimensions T[N] (Solidity parity)', () => {
  const c = (src: string): string => compileString(src).contractName;

  it('resolves a named integer constant as a state-var array dimension', () => {
    expect(c('contract C() { int constant N = 3; int[N] xs; address[N] a;'
      + ' function f() { require(true); } }')).toBe('C');
  });

  it('resolves a const dimension in a local and a parameter', () => {
    expect(c('contract C() { int constant N = 3;'
      + ' function f(int[N] p) returns (int) { int[N] y = [1,2,3]; return y[0] + p[0]; } }')).toBe('C');
  });

  it('still accepts literal and unbounded dimensions', () => {
    expect(c('contract C() { int[3] a; int[] b; function f() { require(true); } }')).toBe('C');
  });

  it('rejects an unknown identifier as a dimension', () => {
    expect(() => c('contract C() { int[NOPE] xs; function f() { require(true); } }'))
      .toThrow(/compile-time integer constant/);
  });

  it('rejects a non-integer constant as a dimension', () => {
    expect(() => c('contract C() { bytes constant S = 0x00; int[S] xs; function f() { require(true); } }'))
      .toThrow(/compile-time integer constant/);
  });

  it('rejects a zero-valued const dimension (Solidity zero-length rule, via the existing bound check)', () => {
    expect(() => c('contract C() { int constant Z = 0; int[Z] xs; function f() { require(true); } }'))
      .toThrow(/positive integer/i);
  });

  it('compiles byte-identically to the equivalent literal dimension (no new runtime surface)', () => {
    // A const dim resolves to the same ArrayType as the literal, so bytecode + state layout converge - the
    // feature is parse-time only and its runtime is covered by existing fixed-array e2e tests.
    const withConst = compileString('contract C() { int constant N = 3; int[N] xs;'
      + ' function g(int i, int v) { this.xs[i] = v; } }');
    const withLiteral = compileString('contract C() { int[3] xs;'
      + ' function g(int i, int v) { this.xs[i] = v; } }');
    expect(withConst.bytecode).toBe(withLiteral.bytecode);
    expect(withConst.stateLayout).toEqual(withLiteral.stateLayout);
  });
});

describe('tuple ternary cond ? (a, b) : (c, d) (Solidity parity)', () => {
  const c = (src: string): string => compileString(src).contractName;

  it('compiles a tuple destructure from a ternary', () => {
    expect(c('contract C() { function f(bool b) returns (int)'
      + ' { (int x, int y) = b ? (1, 2) : (3, 4); return x + y; } }')).toBe('C');
  });

  it('compiles the 4-element CSAMM/CPAMM swap-direction pattern', () => {
    expect(c('contract C() { function f(bool b, int t0, int t1) returns (int)'
      + ' { (int a, int bb, int c2, int d) = b ? (t0, t1, 1, 2) : (t1, t0, 2, 1); return a + bb + c2 + d; } }')).toBe('C');
  });

  it('compiles a tuple-ternary return', () => {
    expect(c('contract C() { function f(bool b) returns (int, int) { return b ? (1, 2) : (3, 4); } }')).toBe('C');
  });

  it('compiles into existing (non-declaration) tuple slots', () => {
    expect(c('contract C() { function f(bool b) returns (int)'
      + ' { int x; int y; (x, y) = b ? (1, 2) : (3, 4); return x + y; } }')).toBe('C');
  });

  it('still parses a normal tuple return and scalar ternary', () => {
    expect(c('contract C() { function f(int a, int b) returns (int, int) { return (a / b, a % b); } }')).toBe('C');
    expect(c('contract C() { function f(bool b) returns (int) { return b ? 1 : 2; } }')).toBe('C');
  });

  it('rejects a bare tuple expression (only valid as a ternary branch)', () => {
    expect(() => c('contract C() { function f() returns (int) { int x = (1, 2); return x; } }'))
      .toThrow(/tuple expression is only valid/i);
  });

  it('rejects branches of different arity', () => {
    expect(() => c('contract C() { function f(bool b) returns (int)'
      + ' { (int x, int y) = b ? (1, 2, 3) : (4, 5); return x; } }')).toThrow(/different arities/i);
  });
});

describe('using for (library method-call desugar)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const lib = 'pragma solidity ^0.8.0; library L { struct Data { uint256 x; }'
    + ' function getX(L.Data storage d) internal view returns (uint256) { return d.x; }'
    + ' function setX(L.Data storage d, uint256 v) internal { d.x = v; } }';

  it('desugars a read method d.getX() to L.getX(d)', () => {
    expect(cc(`${lib} contract C { using L for L.Data; L.Data d;`
      + ' function f() public returns (uint256) { return d.getX(); } }')).toBe('C');
  });

  it('desugars a write method d.setX(v) to L.setX(d, v)', () => {
    expect(cc(`${lib} contract C { using L for L.Data; L.Data d; function f(uint256 v) public { d.setX(v); } }`)).toBe('C');
  });

  it('keeps the explicit qualified library call working', () => {
    expect(cc(`${lib} contract C { L.Data d; function f(uint256 v) public { L.setX(d, v); } }`)).toBe('C');
  });

  it('resolves a using-for method chained on a builtin call (keccak256(x).toEth().rec(s))', () => {
    // The receiver keccak256(x) is a builtin FunctionCallNode with no resolvedFunction/type at symbol-table time;
    // its return type comes from the global symbol table. This is the OZ ECDSA `hash.toEthSignedMessageHash()
    // .recover(sig)` shape (BiDirectionalPaymentChannel).
    const e = 'pragma solidity ^0.8.0; library E { function toEth(bytes32 h) internal pure returns (bytes32) { return h; }'
      + ' function rec(bytes32 h, bytes memory s) internal pure returns (address) { return address(0); } }';
    expect(cc(`${e} contract C { using E for bytes32;`
      + ' function f(bytes memory x, bytes memory s) public pure returns (address) { return keccak256(x).toEth().rec(s); } }'))
      .toBe('C');
  });
});

describe('internal helpers that read a state entry (inlined, not subroutined)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('inlines a void private helper with a compound mapping write (_mint pattern)', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { mapping(address => uint256) bal; uint256 totalSupply;'
      + ' function _mint(address to, uint256 amt) private { bal[to] += amt; totalSupply += amt; }'
      + ' function mint(address to, uint256 amt) external { _mint(to, amt); require(true); } }')).toBe('C');
  });

  it('inlines a void private helper that reads a mapping then writes', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { mapping(address => uint256) bal;'
      + ' function _m(address k, uint256 v) private { uint256 old = bal[k]; bal[k] = old + v; }'
      + ' function f(address k, uint256 v) external { _m(k, v); require(true); } }')).toBe('C');
  });

  it('leaves a simple-write private helper (no entry read) compiling as before', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { mapping(address => uint256) bal;'
      + ' function _set(address k, uint256 v) private { bal[k] = v; }'
      + ' function f(address k, uint256 v) external { _set(k, v); require(true); } }')).toBe('C');
  });

  it('inlines an entry-reading helper called from the CONSTRUCTOR (the _mint-in-ctor pattern)', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { mapping(address => uint256) bal; uint256 total;'
      + ' function _mint(address to, uint256 amt) private { bal[to] += amt; total += amt; }'
      + ' constructor() { _mint(msg.sender, 100); } function f() external { require(true); } }')).toBe('C');
  });

  it('inlines an inherited entry-reading helper called from a child constructor', () => {
    expect(cc('pragma solidity ^0.8.0; contract Base { mapping(address => uint256) bal;'
      + ' constructor(uint256 x) {} function _mint(address to, uint256 amt) internal { bal[to] += amt; } }'
      + ' contract C is Base { constructor() Base(1) { _mint(msg.sender, 100); } function f() external { require(true); } }')).toBe('C');
  });
});

describe('public state vars satisfy interface getter compliance (ERC20 pattern)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('a public state var / mapping satisfies an interface getter function', () => {
    expect(cc('interface IERC20 { function totalSupply() external view returns (uint256);'
      + ' function balanceOf(address a) external view returns (uint256);'
      + ' function allowance(address o, address s) external view returns (uint256); }'
      + ' contract C is IERC20 { uint256 public totalSupply; mapping(address => uint256) public balanceOf;'
      + ' mapping(address => mapping(address => uint256)) public allowance; function f() external { require(true); } }')).toBe('C');
  });

  it('still rejects a genuinely missing interface function', () => {
    expect(() => cc('interface I { function foo(uint256 x) external returns (uint256); }'
      + ' contract C is I { uint256 public bar; function f() external { require(true); } }')).toThrow();
  });
});

describe('SBE-22: declaration-only files compile under solidityImportCompat (solc parity)', () => {
  // solc emits an ABI + empty bytecode for a file with no executable contract (a standalone interface, a
  // file-level enum/struct, or an inline-only library). Mirror that under the flag; native solidcash keeps the
  // LibraryNotCompilableError guard.
  it('compiles a standalone interface to its ABI with empty bytecode', () => {
    const a = compileString(
      'interface IERC20 { function transfer(address to, uint256 amt) external returns (bool);'
      + ' function balanceOf(address who) external view returns (uint256); }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('IERC20');
    expect(a.bytecode).toBe('');
    expect(a.abi.map((f) => f.name).sort()).toEqual(['balanceOf', 'transfer']);
    expect(a.isLibrary).toBe(true);
  });

  it('compiles a file-level enum declaration (carries the enum)', () => {
    const a = compileString('enum Status { Pending, Shipped, Accepted }', { solidityImportCompat: true });
    expect(a.bytecode).toBe('');
    expect(a.enums?.[0]?.name).toBe('Status');
    expect(a.enums?.[0]?.members.map((m) => m.name)).toEqual(['Pending', 'Shipped', 'Accepted']);
  });

  it('compiles a file-level struct declaration', () => {
    const a = compileString('struct Todo { string text; bool done; }', { solidityImportCompat: true });
    expect(a.bytecode).toBe('');
    expect(a.abi).toHaveLength(0);
  });

  it('still throws LibraryNotCompilableError without the flag (native guard preserved)', () => {
    expect(() => compileString('interface IERC20 { function transfer(address to, uint256 amt) external; }'))
      .toThrow('libraries do not produce artifacts');
  });
});

describe('SBE-23: using-for on an array type (`using Lib for T[]`)', () => {
  // Solidity allows binding a library to an array type; `arr.method(args)` desugars to `Lib.method(arr, args)`.
  // Grammar accepts an arrayType target; the desugar matches a state-array receiver by its ArrayType string.
  it('desugars arr.method() on a state array bound via using-for', () => {
    const a = compileString(
      'library Array { function remove(uint256[] storage arr, uint256 i) public {'
      + ' require(arr.length > 0); arr[i] = arr[arr.length - 1]; arr.pop(); } }'
      + ' contract C { using Array for uint256[]; uint256[] public arr;'
      + ' function f() public { arr.push(1); arr.remove(0); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });

  it('does not affect a struct-type using-for binding', () => {
    const a = compileString(
      'library Math { function dbl(uint256 x) internal pure returns (uint256) { return x * 2; } }'
      + ' contract C { int n; function f(uint256 x) public { this.n = int(Math.dbl(x)); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-24: named returns of address/pubkey/sig zero-init correctly', () => {
  // A named return desugars to a local pre-initialized to the type's default. address/pubkey/sig/datasig have
  // no int-0 default, so the prior explicit-0 init tripped AssignTypeError. Uninitialized declarations zero-init
  // via the delete path for every type, so the desugar now uses that.
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('compiles a named address return assigned from a mapping read (ERC721 ownerOf shape)', () => {
    expect(cc('contract C { mapping(uint256 => address) _ownerOf;'
      + ' function ownerOf(uint256 id) external view returns (address owner) {'
      + ' owner = _ownerOf[id]; require(owner != address(0)); } }')).toBe('C');
  });

  it('compiles a named address return from a parameter', () => {
    expect(cc('contract C { int n; function f(address a) external returns (address owner) { owner = a; this.n = 1; } }'))
      .toBe('C');
  });

  it('compiles a named pubkey return', () => {
    expect(cc('contract C { int n; function f(pubkey p) external returns (pubkey k) { k = p; this.n = 1; } }'))
      .toBe('C');
  });
});

describe('SBE-27: block.chainid is uint256 (Solidity parity)', () => {
  it('assigns block.chainid to a uint256 state variable (with the flag)', () => {
    expect(compileString(
      'contract C { uint256 id; function f() external { this.id = block.chainid; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('is uint256 even without the flag (the value stays a minimal 1-byte number)', () => {
    expect(compileString('contract C { uint256 id; function f() external { this.id = block.chainid; } }')
      .contractName).toBe('C');
  });
});

describe('SBE-28: postfix ++/-- as an expression (yields the pre-mutation value)', () => {
  // `lvalue++` used as an expression (e.g. the EIP-2612 `nonces[owner]++`) desugars to a read of the old value
  // plus a hoisted `lvalue = lvalue +/- 1`. Supported at statement scope, on locals / state vars / mapping
  // entries; rejected (clean error) in return / ternary / short-circuit / loop-condition positions.
  it('compiles a local postfix increment in an expression', () => {
    expect(compileString('contract C() { function f() { int i = 0; int x = i++ * 2; require(x == 0); } }')
      .contractName).toBe('C');
  });

  it('compiles a mapping-entry postfix increment in abi.encode (the permit nonce pattern)', () => {
    expect(compileString(
      'contract C { mapping(address => uint256) nonces; bytes blob;'
      + ' function f(address owner) external { this.blob = abi.encode(owner, nonces[owner]++); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('rejects a postfix increment in a return position with a clear error', () => {
    expect(() => compileString('contract C() { int n; function f() returns (int) { int i = 0; return i++; } }'))
      .toThrow('only supported at statement scope');
  });
});

describe('SBE-25: msg.sender category forwarded across internal calls', () => {
  // A function using msg.sender gets a synthetic `bytes32 __internal__msgSenderCategory` param. A positional
  // internal call to such a function must forward the caller's own category (msg.sender is identical across an
  // internal call), otherwise the call is short an argument -> InvalidParameterTypeError. Unblocks ERC721
  // (safeTransferFrom -> transferFrom) and WETH (fallback -> deposit -> _mint(msg.sender, ..)).
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('forwards the synthetic category on an internal call to a msg.sender-using function', () => {
    expect(cc('contract C { mapping(uint256 => address) o;'
      + ' function inner(address from, uint256 id) public { require(msg.sender == o[id]); o[id] = from; }'
      + ' function outer(address from, uint256 id) external { require(msg.sender != address(0)); inner(from, id); } }'))
      .toBe('C');
  });

  it('compiles the ERC721 safeTransferFrom -> transferFrom shape', () => {
    expect(cc('contract C { mapping(uint256 => address) _ownerOf; mapping(address => uint256) _balanceOf;'
      + ' function transferFrom(address from, address to, uint256 id) public {'
      + ' require(from == _ownerOf[id]); require(msg.sender == from); _balanceOf[from]--; _balanceOf[to]++; _ownerOf[id] = to; }'
      + ' function safeTransferFrom(address from, address to, uint256 id) external { transferFrom(from, to, id); } }'))
      .toBe('C');
  });
});

describe('Library sibling calls and UDVT wrap/unwrap', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('a library function resolves an unqualified call to a sibling library function', () => {
    expect(cc('library L { function a(int x) internal returns (int) { return b(x) + 1; }'
      + ' function b(int x) internal returns (int) { return x * 2; } }'
      + ' contract C { using L for int; function f(int x) { require(x.a() == x * 2 + 1); } }')).toBe('C');
  });

  it('a library function resolves a private sibling called in statement position (void call)', () => {
    // Regression: the sibling qualifier was only wired into the expression-form call visitor, so a void
    // sibling call (return unused, e.g. OZ ECDSA `recover` calling `_throwError(err);`) stayed unresolved.
    expect(cc('library L { function a(int x) internal returns (int) { check(x); return x; }'
      + ' function check(int x) private { require(x >= 0); } }'
      + ' contract C { function f(int x) { require(L.a(x) == x); } }')).toBe('C');
  });

  it('UDVT wrap/unwrap are identity casts to/from the underlying type', () => {
    expect(cc('type D is uint64; contract C { function f(uint64 x, uint64 e) {'
      + ' D d = D.wrap(x); require(D.unwrap(d) == e); } }')).toBe('C');
  });

  it('a UDVT wrap/unwrap name does not capture a library method of the same name', () => {
    expect(cc('type D is uint64; library Lib { function wrap(uint64 a, uint64 bb) internal returns (uint64)'
      + ' { return a + bb; } } contract C { using Lib for uint64;'
      + ' function f(uint64 x) { require(Lib.wrap(x, 1) == x + 1); } }')).toBe('C');
  });
});

describe('A contract-level `constant` works as an array dimension', () => {
  it('accepts `uint256 private constant N = 3; T[N]` (a constant with a visibility modifier)', () => {
    // A `constant` state var carrying a visibility modifier parses as a stateVariableDeclaration, not a
    // constantDefinition; it must still be usable as an array bound `T[N]`.
    const a = compileString('contract C { uint256 private constant N = 3; int[N] xs;'
      + ' function f() { this.xs[0] = 1; require(this.xs[0] == 1); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('Tuple forwarding and whole fixed-array assignment', () => {
  it('forwards a tuple-returning call directly in a return statement', () => {
    // `return g()` where g returns (int, int) forwards the tuple's components (Solidity tuple forwarding),
    // not a single ((int, int)) value.
    const a = compileString('contract C { function g() private pure returns (int, int) { return (1, 2); }'
      + ' function h() private pure returns (int, int) { return g(); }'
      + ' function f() { (int a, int b) = h(); require(a == 1 && b == 2); } }');
    expect(a.contractName).toBe('C');
  });

  it('assigns a whole fixed-size array to a state array element-wise', () => {
    const a = compileString('contract C { int[2] xs;'
      + ' function f(int[2] memory _xs) { xs = _xs; require(this.xs[0] == _xs[0]); } }');
    expect(a.contractName).toBe('C');
  });
});

// The integer literal 0 (and only 0) implicitly converts to any bytesN (all-zero bytes) - a common idiom
// (`bytes32 constant SLOT = 0`, EVM storage slot 0). Non-zero int literals still error, matching Solidity.
describe('integer literal 0 coerces to bytesN', () => {
  it('accepts `bytes32 = 0` as local, state-assign, and constant; rejects non-zero', () => {
    const a = compileString(
      'contract C { bytes32 constant S = 0; function f() public pure returns (bytes32 x) {'
      + ' bytes20 y = 0; x = 0; require(x == S); require(y == bytes20(0)); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
    expect(() => compileString('contract C { function f() public pure returns (bytes32 r) { r = 5; } }',
      { solidityImportCompat: true })).toThrow(/can not be assigned/);
  });
});

// The modifier placeholder `_;` may live inside an if/else branch (or loop body), not only at the modifier
// body top level - the OZ `ifAdmin` proxy pattern. Grammar allows it anywhere a statement is; modifier
// expansion counts + replaces it recursively.
describe('`_;` modifier placeholder inside a conditional', () => {
  it('expands `_;` nested in an if/else branch', () => {
    const a = compileString(
      'contract C { int x; modifier ifZero() { if (this.x == 0) { _; } else { require(false); } }'
      + ' function f() ifZero { this.x = 1; } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });
});

// The literal-0 -> bytesN coercion applies at every assignment site (not just var-defs): state var, mapping
// value, array element, function/event args, and return - matching Solidity's `0` -> bytesN convertibility.
describe('literal 0 -> bytesN at all assignment sites', () => {
  it('coerces 0 in state/mapping/array/arg/return/emit positions', () => {
    const a = compileString(
      'contract C { bytes32 s; bytes32[3] arr; mapping(uint256 => bytes32) m; event E(bytes32 t);'
      + ' function g(bytes32 x) internal pure {}'
      + ' function f(uint256 k) public returns (bytes32) { this.s = 0; this.arr[0] = 0; this.m[k] = 0;'
      + ' g(0); emit E(0); return 0; } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });
});

// Custom error parameters may be unnamed in Solidity (`error Bad(uint256)`), like event params.
describe('unnamed custom error parameters', () => {
  it('compiles `error Bad(uint256)` and reverts with it', () => {
    const a = compileString(
      'contract C { error Bad(uint256); function f(uint256 x) public pure { if (x == 0) revert Bad(x); require(true); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });
});

// Function-type params may carry pure/view mutability (`function(uint256) pure returns (uint256)`); and
// `new bytes(n)` with a constant length folds to an n-zero-byte buffer (dynamic length has no BCH analogue).
describe('function-type mutability + new bytes(constant)', () => {
  it('parses a pure/view function-type parameter', () => {
    const a = compileString(
      'contract C { function h(function(uint256) view returns (uint256) g) internal pure {}'
      + ' function f() public pure returns (uint256) { return 1; } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });

  it('folds new bytes(3) to a 3-zero-byte buffer', () => {
    const a = compileString(
      'contract C { function f() public pure returns (uint256) { bytes memory b = new bytes(3); return b.length; } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });
});

describe('function modifier / custom-modifier interleaving (Solidity allows any order)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts a custom modifier invocation BEFORE visibility (function f() M(1) public {})', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { modifier M(uint i){_;}'
      + ' function f() M(1) public { require(true); } }')).toBe('C');
  });
  it('accepts multiple custom modifiers interleaved with visibility/mutability', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { modifier A{_;} modifier B{_;}'
      + ' function f() A public B view { require(true); } }')).toBe('C');
  });
  it('still accepts the visibility-first order', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { modifier M(uint i){_;}'
      + ' function f() public M(1) { require(true); } }')).toBe('C');
  });
});

// A Solidity for-loop init may be a declaration (`uint i = 0`), a bare assignment reusing an outer
// variable (`i = 0`), or empty (`for (; ...)`). The grammar previously only accepted a declaration.
describe('for-loop init: bare-assignment and empty forms', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts a bare-assignment init reusing an outer variable', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { function f() public pure returns (uint) {'
      + ' uint i; uint s = 0; for (i = 0; i < 5; i++) { s = s + i; } return s; } }')).toBe('C');
  });
  it('accepts an empty init', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { function f() public pure returns (uint) {'
      + ' uint i = 0; uint s = 0; for (; i < 5; i++) { s = s + i; } return s; } }')).toBe('C');
  });
  it('still accepts a declaration init', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { function f() public pure returns (uint) {'
      + ' uint s = 0; for (uint i = 0; i < 5; i++) { s = s + i; } return s; } }')).toBe('C');
  });
});

// Solidity library bodies allow declarations in any order; the grammar previously fixed the order
// (enums, then structs, then ...), rejecting a struct declared after a constant.
describe('library body: any declaration order', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts a struct declared after a constant', () => {
    expect(cc('library L { uint constant A = 1; struct S { uint x; }'
      + ' function f(uint y) internal pure returns (uint) { return y + 1; } }'
      + ' contract C { function g() public pure returns (uint) { return L.f(2); } }')).toBe('C');
  });
});

// A receive() must stay external + payable, but Solidity allows virtual/override interleaved in any order.
describe('receive(): virtual/override interleaved with external payable', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts `receive() external virtual payable`', () => {
    expect(cc('contract C { uint bal; receive() external virtual payable { bal = 1; }'
      + ' function f() public { require(true); } }')).toBe('C');
  });
  it('still rejects a receive() missing payable', () => {
    expect(() => compileString('contract C { receive() external { } function f() public { require(true); } }',
      { solidityImportCompat: true })).toThrow();
  });
});

// A Solidity forwarding-proxy fallback declares a return type: `fallback(bytes) external payable returns (bytes)`.
// Lowers like the already-supported fallback-with-params plus a returns clause; the body forwards via the same
// opaque-data low-level call model as MultiSigWallet (`target.call{value}(data)`), which is covenant-sound.
describe('fallback with input + return type (forwarding proxy)', () => {
  const SRC = 'contract C { address immutable target; constructor(address _t) { target = _t; }'
    + ' fallback(bytes calldata data) external payable returns (bytes memory) {'
    + ' (bool ok, bytes memory res) = target.call{value: msg.value}(data); require(ok); return res; } }';
  it('parses and compiles a fallback with a bytes return type', () => {
    expect(compileString(SRC, { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('captures the forward as a low-level call (sound forwarding covenant)', () => {
    const fb = compileString(SRC, { solidityImportCompat: true }).abi.find((f) => f.name === '__fallback');
    expect(fb?.isFallback).toBe(true);
    expect(fb?.lowLevelCalls?.[0]?.callMode).toBe('call');
  });
  it('still accepts a fallback with params but no return type (no regression)', () => {
    expect(compileString('contract C { int n; fallback(bytes calldata data) external payable {'
      + ' (bool ok, bytes memory res) = msg.sender.call{value: msg.value}(data); require(ok); this.n = res.length; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

// A public state variable may carry `override` (its auto-getter overrides a base getter). EVM inheritance
// is a no-op in SolidCash, so `override` is accepted and ignored.
describe('state variable override specifier', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts `uint256 public override x`', () => {
    expect(cc('contract C { uint256 public override x; function f() public { x = 1; require(true); } }')).toBe('C');
  });
  it('accepts override on a public array state variable', () => {
    expect(cc('contract C { uint256[] public override xs; function f() public { require(true); } }')).toBe('C');
  });
});

// A library-level constant is in scope inside the library's own functions (unqualified), like a sibling
// function call. A local/param of the same name still shadows it (Solidity scoping).
describe('library constant scope inside library functions', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves an unqualified sibling library constant', () => {
    expect(cc('library L { uint constant A = 5;'
      + ' function f(uint y) internal pure returns (uint) { return y + A; } }'
      + ' contract C { function g() public pure returns (uint) { return L.f(2); } }')).toBe('C');
  });
  it('lets a local shadow the library constant', () => {
    expect(cc('library L { uint constant A = 5;'
      + ' function f() internal pure returns (uint) { uint A = 9; return A; } }'
      + ' contract C { function g() public pure returns (uint) { return L.f(); } }')).toBe('C');
  });
  it('lets a parameter shadow the library constant', () => {
    expect(cc('library L { uint constant A = 5;'
      + ' function f(uint A) internal pure returns (uint) { return A; } }'
      + ' contract C { function g() public pure returns (uint) { return L.f(7); } }')).toBe('C');
  });
});

// An unnamed-return function that already returns on every path (a terminal if/else whose branches both
// return) must NOT get a synthesized fall-through `return <defaults>` - that default is dead code and, for
// address/enum returns, was typed (int, int), producing a spurious return-type mismatch (OZ ECDSA pattern).
describe('unnamed-return fall-through: no dead default when all paths return', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles an (address, enum) return ending in if/else where both branches return', () => {
    expect(cc('contract C { enum E { A, B }'
      + ' function f(uint x) internal pure returns (address, E) {'
      + ' if (x == 0) { return (address(0), E.B); } else { return (address(0), E.A); } }'
      + ' function g() public pure { (address a, E e) = f(1); require(a == address(0)); } }')).toBe('C');
  });
  it('still synthesizes a default for a genuine fall-through (no return on some path)', () => {
    // A body that does not return on all paths still gets the fall-through default (uint defaults to 0).
    expect(cc('contract C { function f(uint x) internal pure returns (uint r) { if (x > 0) { r = x; } }'
      + ' function g() public pure { require(f(0) == 0); } }')).toBe('C');
  });
  it('synthesizes a type-correct default for a genuine fall-through returning address', () => {
    // The unnamed-return default for address is address(0) (a cast), not int 0 (which does not type-check).
    expect(cc('contract C { function f(uint x) internal pure returns (address) { if (x > 0) { return address(uint160(1)); } }'
      + ' function g() public pure { require(f(0) == address(0)); } }')).toBe('C');
  });
  it('synthesizes a type-correct default for a genuine fall-through returning an enum', () => {
    expect(cc('contract C { enum E { A, B } function f(uint x) internal pure returns (E) { if (x > 0) { return E.B; } }'
      + ' function g() public pure { require(f(0) == E.A); } }')).toBe('C');
  });
});

// A named return may share the name of its own function - `function max(..) returns (int max)` - which is
// legal Solidity (the named return shadows the function name within the body). A local may shadow an outer
// function or state variable in general (both are contract/library-level, never a same-scope collision).
describe('local / named return may shadow an outer function or state var', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts a named return with the same name as its function', () => {
    expect(cc('contract C { function max(int x) public pure returns (int max) { max = x; }'
      + ' function f() public pure returns (int) { return max(3); } }')).toBe('C');
  });
  it('accepts a local shadowing a function name', () => {
    expect(cc('contract C { function helper() internal pure returns (uint) { return 1; }'
      + ' function f() public pure returns (uint) { uint helper = 5; return helper; } }')).toBe('C');
  });
});

// A `public constant` at contract level parses as a state variable (constantDefinition has no visibility slot),
// but it is a compile-time constant and must be baked, not stored in the state NFT.
describe('public constant is baked, not stored as state', () => {
  const compile = (src: string): ReturnType<typeof compileString> =>
    compileString(src, { solidityImportCompat: true });
  it('does not put a public constant in the state layout', () => {
    const a = compile('contract C { uint256 public constant ONE = 5;'
      + ' function f() public pure returns (uint256) { return ONE; } }');
    // A contract with only a `public constant` (no real state) is not stateful at all.
    const stateNames = (a.stateLayout?.variables ?? []).map((v) => v.name);
    expect(stateNames).not.toContain('ONE');
  });
  it('accepts the modifier order `uint constant public X` too', () => {
    const a = compile('contract C { uint256 constant public TWO = 2;'
      + ' function f() public pure returns (uint256) { return TWO; } }');
    expect((a.stateLayout?.variables ?? []).map((v) => v.name)).not.toContain('TWO');
  });
});

// A value unit (wei/gwei/ether) after a decimal literal (`0.2 ether`) folds to an integer, the same units the
// integer form (`1 ether`) already accepts. Common in ported Solidity.
describe('decimal literal with a value unit (0.2 ether)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts and folds `0.2 ether` to its integer value', () => {
    expect(cc('contract C { function f() public pure returns (bool) {'
      + ' require(0.2 ether == 200000000000000000); return true; } }')).toBe('C');
  });
  it('accepts `1.5 gwei`', () => {
    expect(cc('contract C { function f() public pure returns (bool) {'
      + ' require(1.5 gwei == 1500000000); return true; } }')).toBe('C');
  });
});

// Unspaced subtraction of a number literal (`i-1`, `a[i-1]`, `i-2*3`) was lexed as `i` `-1` (a signed literal),
// so it failed to parse. A leading minus is no longer part of a number literal; negation is a unary operator.
describe('unspaced subtraction of a number literal (i-1)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('parses `i-1`', () => {
    expect(cc('contract C { function f(uint i) public pure returns (uint) { return i-1; } }')).toBe('C');
  });
  it('parses `a[i-1]` (subtraction in an index)', () => {
    expect(cc('contract C { function f(uint[] memory a, uint i) public pure returns (uint) {'
      + ' return a[i-1]; } }')).toBe('C');
  });
  it('parses `i-2*3`', () => {
    expect(cc('contract C { function f(uint i) public pure returns (uint) { uint x = i-2*3; return x; } }'))
      .toBe('C');
  });
  it('still folds `-1` to a negative literal', () => {
    expect(cc('contract C { function f() public pure returns (int) { require(-1 < 0); return -1; } }')).toBe('C');
  });
  it('still rejects a constant negative array index', () => {
    expect(() => compileString('contract C { function f() public pure { uint[3] memory a; uint v = a[-1];'
      + ' require(v == 0); } }', { solidityImportCompat: true })).toThrow();
  });
});
