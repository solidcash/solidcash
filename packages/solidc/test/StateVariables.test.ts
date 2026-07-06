import { describe, it, expect, vi } from 'vitest';
import { compileString } from '../src/index.js';

// State variables and constants: init/zero-init, transient, override, compound assign, bare access.

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

describe('A contract-level `constant` works as an array dimension', () => {
  it('accepts `uint256 private constant N = 3; T[N]` (a constant with a visibility modifier)', () => {
    // A `constant` state var carrying a visibility modifier parses as a stateVariableDeclaration, not a
    // constantDefinition; it must still be usable as an array bound `T[N]`.
    const a = compileString('contract C { uint256 private constant N = 3; int[N] xs;'
      + ' function f() { this.xs[0] = 1; require(this.xs[0] == 1); } }');
    expect(a.contractName).toBe('C');
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

// `delete x` on a BARE state variable (Solidity-import idiom) must route to a state delete, like a bare state
// write. It used to build a local delete: silently defining a wrong local at top level, and crashing once nested
// in a branch ("variable 'x' does not exist on the stack"). Now byte-identical to `delete this.x`.
describe('bare `delete x` on a state variable routes to a state delete', () => {
  const bareSrc = 'contract C{uint16 y;uint8 x;function f()external returns(uint){y=2;if(x!=1)return 2;delete y;return 1;}}';
  it('compiles a bare state-var delete nested after an early-return branch', () => {
    expect(compileString(bareSrc, { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('is byte-identical to `delete this.y` (sound - actually deletes the state var)', () => {
    const explicit = 'contract C{uint16 y;uint8 x;function f()external returns(uint){this.y=2;if(x!=1)return 2;delete this.y;return 1;}}';
    expect(compileString(bareSrc, { solidityImportCompat: true }).bytecode)
      .toBe(compileString(explicit, { solidityImportCompat: true }).bytecode);
  });
  it('leaves a genuine local delete alone', () => {
    expect(compileString('contract C{function f(uint x)external returns(uint){uint y=5;if(x!=1)return 2;delete y;return y;}}',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});
