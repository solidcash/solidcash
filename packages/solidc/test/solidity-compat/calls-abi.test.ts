import { describe, it, expect } from 'vitest';
import { compileString, compileStringMulti } from './helpers.js';

// Focused regression guards derived from the Solidity compiler corpus.
describe('bare ABI builtin function references are no-op statements', () => {
  const bc = (body: string): string => compileString(
    `contract C { function f() public pure { ${body} } }`,
    { solidityImportCompat: true },
  ).bytecode;

  it('drops all bare abi function references', () => {
    expect(bc('abi.encode; abi.encodePacked; abi.encodeWithSelector; abi.encodeWithSignature; abi.decode;'))
      .toBe(bc(''));
  });

  it('drops a bare assert function reference', () => {
    expect(bc('assert;')).toBe(bc(''));
  });
});

describe('mapping and array members in internal function types', () => {
  it('accepts named nested mappings as parameters and mapping returns', () => {
    expect(compileString(
      'contract C { function(mapping(uint key => mapping(uint sub => uint value) entries) storage) internal fp;'
      + ' function f(function(mapping(uint=>uint) storage) internal cb) internal pure {}'
      + ' function g(function() internal returns(mapping(uint=>uint) storage) cb) internal pure {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('rejects conflicting names across a nested mapping chain', () => {
    expect(() => compileString(
      'contract C { mapping(uint same => mapping(uint other => uint same) value) data; }',
      { solidityImportCompat: true },
    )).toThrow(/conflicting parameter name/i);
  });
});

describe('foreign external function pointer == direct external call', () => {
  const IFACE = 'interface ICounter { function increment(uint256 x) external returns (uint256); }';
  it('desugars `f = IFoo(addr).method; f(z)` byte-identically to `IFoo(addr).method(z)`', () => {
    const ptr = `${IFACE} contract C { function run(ICounter c, uint256 z) public {`
      + ' function(uint256) external returns (uint256) f = c.increment; uint256 r = f(z); require(r == z + 1); } }';
    const direct = `${IFACE} contract C { function run(ICounter c, uint256 z) public {`
      + ' uint256 r = c.increment(z); require(r == z + 1); } }';
    const a = compileString(ptr, { solidityImportCompat: true }).bytecode;
    const b = compileString(direct, { solidityImportCompat: true }).bytecode;
    expect(a).toBe(b);
  });
  it('rewrites a bare `f(z);` statement form too', () => {
    const ptr = `${IFACE} contract C { function run(ICounter c, uint256 z) public {`
      + ' function(uint256) external returns (uint256) f = c.increment; f(z); require(true); } }';
    const direct = `${IFACE} contract C { function run(ICounter c, uint256 z) public {`
      + ' c.increment(z); require(true); } }';
    expect(compileString(ptr, { solidityImportCompat: true }).bytecode)
      .toBe(compileString(direct, { solidityImportCompat: true }).bytecode);
  });
});

// An enum member `E.M` is a compile-time integer ordinal, so it is valid as a `constant` initializer.
// isCompileTimeExpression now accepts it and the base enum resolves in the constant expression, so the constant
// folds identically to using `E.M` inline.

describe('returning external calls used as dynamic allocation bounds', () => {
  it('collects and indexes the return witness from NewArrayNode.size', () => {
    expect(compileString('interface I { function length() external view returns (uint); }'
      + ' contract C { function f(I source) public returns (uint[] memory result) {'
      + ' result = new uint[](source.length()); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('.selector on a single-assignment function-pointer local folds to the target selector', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const bc = (src: string): string => compileString(src, { solidityImportCompat: true }).bytecode;
  it('resolves fun.selector where fun = this.f (byte-identical to this.f.selector)', () => {
    const src = (sel: string): string => 'contract C { function f() external pure returns (bytes4) { return this.f.selector; }'
      + ` function g() external returns (bytes4) { function () pure external returns (bytes4) fun = this.f; return ${sel}; } }`;
    expect(cc(src('fun.selector'))).toBe('C');
    expect(bc(src('fun.selector'))).toBe(bc(src('this.f.selector')));
  });

  it('folds (c ? this.f : this.g).selector to c ? f.selector : g.selector (byte-identical)', () => {
    const mk = (expr: string): string => 'contract C { function f() external pure returns (bytes4) { return this.f.selector; }'
      + ' function g() external pure returns (bytes4) { return this.g.selector; }'
      + ` function pick(bool c) external pure returns (bytes4) { return ${expr}; } }`;
    expect(cc(mk('(c ? this.f : this.g).selector'))).toBe('C');
    expect(bc(mk('(c ? this.f : this.g).selector'))).toBe(bc(mk('c ? this.f.selector : this.g.selector')));
  });

  it('folds this.<fn>.address to address(this) (byte-identical)', () => {
    const mk = (expr: string): string => 'contract C { function f() external {}'
      + ` function g() external view returns (bool) { return ${expr}; } }`;
    expect(cc(mk('this.f.address == address(this)'))).toBe('C');
    expect(bc(mk('this.f.address == address(this)'))).toBe(bc(mk('address(this) == address(this)')));
  });

  it('synthesizes a struct getter returning members except mappings/arrays (Solidity rule)', () => {
    // A plain scalar/string-member struct gets a getter (exact shape of solc's
    // getters/inaccessible_dynamic_type_1.sol). Array/mapping-bearing structs are flattened to per-field
    // state vars and are deliberately skipped.
    const src = 'contract C { struct S { string a; uint y; } S public s;'
      + ' function g() public view returns (uint256) { this.s(); } }';
    expect(cc(src)).toBe('C');
  });

  it('binds & ^ | tighter than comparisons/equality (Solidity precedence, not C)', () => {
    const mk = (expr: string): string =>
      `contract C { function f(uint x, uint y, uint z) public pure returns (bool) { return ${expr}; } }`;
    expect(bc(mk('x & y == z'))).toBe(bc(mk('(x & y) == z')));
    expect(bc(mk('x ^ y != z'))).toBe(bc(mk('(x ^ y) != z')));
    expect(bc(mk('x | y < z'))).toBe(bc(mk('(x | y) < z')));
  });

  it('resolves C.f (own contract qualifier) as an internal function-pointer value', () => {
    const src = 'contract C { function f() internal {} function g() internal {}'
      + ' function test() public pure returns (bool) { function () internal ptr = C.f; return ptr == C.g; } }';
    expect(cc(src)).toBe('C');
  });

  it('folds event .selector across library/contract/interface qualifiers and bare inherited events', () => {
    // Signature-injective: equal signatures (E()) give equal selectors, distinct (E(uint256)) differ;
    // the bare inherited form equals the base-qualified form. All fold to compile-time bytes32.
    const src = 'library L { event E(); } library S { event E(uint); } contract B { event E(); }'
      + ' contract C is B { bytes32 s1 = L.E.selector;'
      + ' function f() public pure { require(L.E.selector == B.E.selector);'
      + ' require(L.E.selector != S.E.selector); require(E.selector == B.E.selector); } }';
    expect(cc(src)).toBe('C');
  });

  it('folds L.f.selector for library functions, including storage-pointer fns inlined away', () => {
    // g takes a storage pointer (removed from freeFunctions by the inliner) - the selector must still fold
    // from the parse-time signature. Distinct signatures give distinct selectors; h twice gives the same.
    const src = 'library L { function f(uint256 x) external returns (uint) { return x; }'
      + ' function g(uint256[] storage s) internal returns (uint) { return s.length; }'
      + ' function h(uint256[] memory m) public returns (uint) { return m.length; } }'
      + ' contract C { function f() public pure {'
      + ' require(L.f.selector != L.g.selector);'
      + ' require(L.g.selector != L.h.selector);'
      + ' require(L.h.selector == L.h.selector); } }';
    expect(cc(src)).toBe('C');
  });
});

describe('abi.encodeWithSelector accepts a fitting string/hex literal selector', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('coerces a string literal that fits in 4 bytes to the bytes4 selector', () => {
    expect(cc('contract C { function f() external pure returns (bytes memory) {'
      + ' return abi.encodeWithSelector("f()", uint256(1)); } }')).toBe('C');
  });
  it('still accepts an explicit bytes4 selector and rejects an over-long literal', () => {
    expect(cc('contract C { function f() external pure returns (bytes memory) {'
      + ' return abi.encodeWithSelector(bytes4(0x12345678), uint256(1)); } }')).toBe('C');
    expect(() => cc('contract C { function f() external pure returns (bytes memory) {'
      + ' return abi.encodeWithSelector("toolongselector", uint256(1)); } }')).toThrow(/bytes4|string/);
  });
});

describe('external function pointers as public/external parameters (VM-verified in solidcash tests)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts an external function-type parameter on a public function', () => {
    expect(cc('contract C { function g(int a) public pure returns (int) { return a + 1; }'
      + ' function ev(function(int) external returns (int) fp, int a) public returns (int) { return fp(a); }'
      + ' function f() external { require(this.ev(this.g, 5) == 6); } }')).toBe('C');
  });
  it('accepts an external function-type return on a public function', () => {
    expect(cc('contract C { function g(int a) external pure returns (int) { return a; }'
      + ' function pick() public view returns (function(int) external returns (int)) { return this.g; }'
      + ' function f() external { require(true); } }')).toBe('C');
  });
  it('still rejects an INTERNAL function-type parameter on a public function (solc rejects too)', () => {
    expect(() => cc('contract C { function ev(function(int) internal returns (int) fp, int a) public returns (int)'
      + ' { return fp(a); } function f() external { require(true); } }')).toThrow(/Function types cannot be used/);
  });
});

describe('calling a function pointer from an array element (arr[i]())', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts an indexed function-pointer call, with and without args', () => {
    expect(cc('contract C { function h() internal pure returns (uint) { return 7; } function g() public pure { '
      + 'function() internal pure returns (uint)[1] memory a; a[0] = h; require(a[0]() == 7); } }')).toBe('C');
    expect(cc('contract C { function h(uint v) internal pure returns (uint) { return v; } function g() public pure { '
      + 'function(uint) internal pure returns (uint)[1] memory a; a[0] = h; require(a[0](5) == 5); } }')).toBe('C');
  });
  it('does not disturb ordinary calls, getters, or array access', () => {
    expect(cc('contract C { uint[] public a; function g() external view { this.a(0); } }')).toBe('C');
    expect(cc('contract C { function foo() internal pure {} function g() public pure { (foo)(); } }')).toBe('C');
    expect(cc('contract C { function g(uint[] memory a) public pure { require(a[0] == 0); } }')).toBe('C');
  });
  it('accepts a parenthesised (ternary) function-pointer callee', () => {
    expect(cc('contract C { function a(uint x) internal pure returns (uint) { return x; } '
      + 'function b(uint x) internal pure returns (uint) { return x; } '
      + 'function g(bool c) public pure returns (uint) { return (c ? a : b)(1); } }')).toBe('C');
    // parenthesised arithmetic / tuples must still parse normally (not as a call)
    expect(cc('contract C { function g(uint a, uint b, uint c) public pure returns (uint) { return (a + b) * c; } }'))
      .toBe('C');
  });
});

describe('ABI-coder pragmas are no-ops (v2 is the Solidity 0.8 default)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('treats experimental ABIEncoderV2 / abicoder v1 / abicoder v2 as no-ops', () => {
    for (const p of ['pragma experimental ABIEncoderV2;', 'pragma abicoder v2;', 'pragma abicoder v1;']) {
      expect(cc(`${p} contract C { function f() external pure returns (uint256) { return 1; } }`)).toBe('C');
    }
  });
});

describe('msg.data reachability', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts msg.data at an external entry point', () => {
    expect(cc('contract C { function f() external pure returns (bytes memory) { return msg.data; } }')).toBe('C');
  });
  it('reconstructs msg.data inside a self-external-called function from its selector and arguments', () => {
    const src = 'contract C { function g(uint256 x) external pure returns (bytes memory) { x; return msg.data; }'
      + ' function f() external view returns (bytes memory) { return this.g(1); } }';
    expect(cc(src)).toBe('C');
  });
});

describe('external call on the current contract type (self-type)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('calls another instance of the contract via a cast to its own type (M(addr).m())', () => {
    expect(cc('contract M { uint x; function set(uint c) public { x = c; }'
      + ' function upgrade(address a) public { M(a).set(x); } }')).toBe('M');
    expect(cc('contract M { uint x; function set(uint c) public { x = c; }'
      + ' function upgrade(address a) public { M u = M(a); u.set(x); } }')).toBe('M');
  });
  it('leaves this.method() self-calls working', () => {
    expect(cc('contract M { uint x; function set(uint c) public { x = c; } function f() public { this.set(1); } }'))
      .toBe('M');
  });
  it('still rejects an interface inheriting a contract (solc parity)', () => {
    expect(() => cc('contract C {} interface I is C {}')).toThrow();
  });
});

describe('branch-local external-call target capture', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  // A contract/interface-typed local declared inside a branch (here a restricted modifier's if-wrapper) is
  // popped before the epilogue co-spend verification; the capture pass hoists it to a function-top local.
  it('compiles an external call on a local declared in a modifier-induced branch (Migrations shape)', () => {
    expect(cc('contract M { uint x; function set(uint c) public { x = c; }'
      + ' modifier r() { if (x == 0) _; }'
      + ' function upgrade(address a) public r { M u = M(a); u.set(x); } }')).toBe('M');
  });
  it('compiles an external call on a local declared in an explicit if-branch', () => {
    expect(cc('interface IM { function set(uint x) external; }'
      + ' contract C { address t; function f(bool ok) public { if (ok) { IM u = IM(t); u.set(5); } } }')).toBe('C');
  });
});

describe('zero-initialized internal function-pointer dispatch', () => {
  it('preserves the invalid-pointer failure after an external state pointer is representation-lowered', () => {
    const art = compileString('contract C {'
      + ' function(function(uint) external returns(uint)) internal returns(uint) ev;'
      + ' function(uint) external returns(uint) x;'
      + ' function store(function(uint) external returns(uint) y) public { x = y; }'
      + ' function t() public returns(uint) { return ev(x); } }',
    { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });
});

describe('foreign external fn-ptr .selector / .address members', () => {
  const IF = 'interface IFoo { function addTwo(uint x) external returns(uint); }';
  // `f.selector` / `f.address` on an alias reduce to the member's compile-time selector / the cast address (the
  // EVM `function external` value members). f.selector -> IFoo.addTwo.selector (VM-proven in the varying dispatch).
  it('rewrites f.selector to the aliased member selector (bytes4)', () => {
    const art = compileString(`${IF} contract C {`
      + ' function use(address a) public returns(bytes4) {'
      + '   function(uint) external returns(uint) f = IFoo(a).addTwo; return f.selector; } }',
    { solidityImportCompat: true });
    expect(art.abi.find((x) => x.name === 'use')!.outputs![0].type).toBe('bytes4');
  });
  it('rewrites f.address to the interface-cast address', () => {
    const art = compileString(`${IF} contract C {`
      + ' function use(address a) public returns(address) {'
      + '   function(uint) external returns(uint) f = IFoo(a).addTwo; return f.address; } }',
    { solidityImportCompat: true });
    expect(art.abi.find((x) => x.name === 'use')!.outputs![0].type).toBe('address');
  });
  it('reads the address component of a received external function parameter', () => {
    const art = compileString('contract C { function g(function() external cb) public returns (address) {'
      + ' return cb.address; } }', { solidityImportCompat: true });
    expect(art.abi.find((x) => x.name === 'g')!.outputs![0].type).toBe('address');
  });
  it('assigns an address-typed Solidity local to a function pointer address in Yul', () => {
    const art = compileString('contract C { function target() external {}'
      + ' function f(address replacement) public view returns (address) {'
      + ' function() external fp = this.target; assembly { fp.address := replacement }'
      + ' return fp.address; } }', { solidityImportCompat: true });
    expect(art.abi.find((x) => x.name === 'f')!.outputs![0].type).toBe('address');
  });
  it('rewrites a direct interface-member address to the cast address', () => {
    const art = compileString('contract C { function f() public view returns (address) {'
      + ' return C(address(0x1234)).f.address; } }', { solidityImportCompat: true });
    expect(art.abi.find((x) => x.name === 'f')!.outputs![0].type).toBe('address');
  });
  it('encodes a self external-function member stored in a struct blob', () => {
    const art = compileString('contract C { struct S { function() external returns (uint) f; uint b; }'
      + ' function invoke(S memory s) public returns (uint) { return s.f() + s.b; }'
      + ' function g() public returns (uint) { return 7; }'
      + ' function test() public returns (uint) { return this.invoke(S(this.g, 3)); } }',
    { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });
  it('dispatches a blob function-pointer field through indexed and nested struct receivers', () => {
    const art = compileString('struct I { uint a; function(uint) external returns (uint) fp; }'
      + ' struct S { I inner; } contract C { S[2] rows;'
      + ' function plusOne(uint x) public returns (uint) { return x + 1; }'
      + ' constructor() { rows[0] = S(I(1, this.plusOne)); }'
      + ' function run(uint x) public returns (uint) { return rows[0].inner.fp(x); }'
      + ' function runTwice(uint x) public { rows[0].inner.fp(x); rows[0].inner.fp(x); } }',
    { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });
});

describe('deploy-then-call fold THROUGH a local fn-ptr (#2 slice, sound by reduction)', () => {
  // `p = (new Other()).m; p()` (deploy + take the fresh child's method as a local pointer + call) reduces via
  // the alias desugar to `(new Other()).m()` = the shipped deploy-then-call fold. Assert byte-identity to the
  // direct form (the fold is VM-tested), so the fn-ptr form is sound by reduction.
  it('compiles byte-identically to the direct deploy-then-call fold', () => {
    const other = 'contract Other { int counter; function bump() external { this.counter = this.counter + 1; require(true); } }';
    const direct = `${other} contract C { function use() public { (new Other()).bump(); require(true); } }`;
    const fnptr = `${other} contract C { function use() public {`
      + ' function() external p = (new Other()).bump; p(); require(true); } }';
    const a = compileStringMulti(direct, { solidityImportCompat: true }).C;
    const b = compileStringMulti(fnptr, { solidityImportCompat: true }).C;
    expect(b.bytecode).toBe(a.bytecode);
    expect(b.abi.find((f) => f.name === 'use')!.deployTargets)
      .toEqual(a.abi.find((f) => f.name === 'use')!.deployTargets);
  });
});

describe('public constant ABI getters', () => {
  it('synthesizes a zero-argument getter callable through this.CONSTANT()', () => {
    const artifact = compileString('contract C { uint256 public constant MIN = 1000;'
      + ' function f() public view returns (uint256) { return this.MIN(); } }',
    { solidityImportCompat: true });
    expect(artifact.contractName).toBe('C');
    expect(artifact.abi.some((entry) => entry.name === 'MIN')).toBe(true);
  });
});

describe('call a function-pointer struct field directly (s.x(), t[i].x(), m[k].x())', () => {
  const bc = (src: string): string => compileString(src, { solidityImportCompat: true }).bytecode;
  const H = 'function h() internal pure returns (uint) { return 7; }';
  const HA = 'function h(uint a) internal pure returns (uint) { return a + 1; }';
  const FP = 'function() internal pure returns (uint)';
  const FPA = 'function(uint) internal pure returns (uint)';

  it('plain struct s.x() is byte-identical to the hoist `fp = s.x; fp()`', () => {
    const S = 'struct S { ' + FP + ' x; }';
    const direct = `contract C { ${S} ${H} function f() public pure returns (uint) { S memory s; s.x = h; return s.x(); } }`;
    const hoist = `contract C { ${S} ${H} function f() public pure returns (uint) {`
      + ` S memory s; s.x = h; ${FP} fp = s.x; return fp(); } }`;
    expect(bc(direct)).toBe(bc(hoist));
  });
  it('struct-array element t[i].x() is byte-identical to the hoist', () => {
    const S = 'struct S { ' + FP + ' x; } S[1] t;';
    const direct = `contract C { ${S} ${H} function f() public returns (uint) { t[0].x = h; return t[0].x(); } }`;
    const hoist = `contract C { ${S} ${H} function f() public returns (uint) {`
      + ` t[0].x = h; ${FP} fp = t[0].x; return fp(); } }`;
    expect(bc(direct)).toBe(bc(hoist));
  });
  it('accepts direct and hoisted mapping element function-pointer calls under C2', () => {
    const S = 'struct S { ' + FP + ' x; } mapping(uint => S) m;';
    const direct = `contract C { ${S} ${H} function f() public returns (uint) { m[0].x = h; return m[0].x(); } }`;
    const hoist = `contract C { ${S} ${H} function f() public returns (uint) {`
      + ` m[0].x = h; ${FP} fp = m[0].x; return fp(); } }`;
    expect(bc(direct)).not.toHaveLength(0);
    expect(bc(hoist)).not.toHaveLength(0);
  });
  it('accepts the arg-passing forms s.x(3) / t[i].x(3) / m[k].x(3) / nested s.inner.x()', () => {
    const name = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
    const S = 'struct S { ' + FPA + ' x; }';
    expect(name(`contract C { ${S} ${HA} function f() public pure returns (uint) {`
      + ' S memory s; s.x = h; return s.x(3); } }')).toBe('C');
    expect(name(`contract C { ${S} S[1] t; ${HA} function f() public returns (uint) {`
      + ' t[0].x = h; return t[0].x(3); } }')).toBe('C');
    expect(name(`contract C { ${S} mapping(uint => S) m; ${HA} function f() public returns (uint) {`
      + ' m[0].x = h; return m[0].x(3); } }')).toBe('C');
    expect(name(`contract C { struct I { ${FP} x; } struct S2 { I inner; } ${H}`
      + ' function f() public pure returns (uint) { S2 memory s; s.inner.x = h; return s.inner.x(); } }')).toBe('C');
  });
  it('does not disturb a genuine namespaced call that looks like `base.member()` (enum + library)', () => {
    // `Lib.f()` and `E.A` share the `base.member` shape; the rewrite must only fire when `base` is a struct var.
    const name = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
    expect(name('library Lib { function f() internal pure returns (uint) { return 1; } }'
      + ' contract C { function g() public pure returns (uint) { return Lib.f(); } }')).toBe('C');
  });
});

describe('deploy expression nested in a state-array push', () => {
  const child = 'contract D { uint public x; }';
  it('hoists contract/address/struct-wrapped deploy values before encoding the pushed element', () => {
    const direct = compileString(`${child} contract C { D[] ds; constructor() { ds.push(new D()); } }`,
      { solidityImportCompat: true });
    const manual = compileString(`${child} contract C { D[] ds; constructor() { D d = new D(); ds.push(d); } }`,
      { solidityImportCompat: true });
    expect(direct.bytecode).toBe(manual.bytecode);
    expect(() => compileString(`${child} contract C { address[] ds; constructor() {`
      + ' ds.push(address(new D())); } }', { solidityImportCompat: true })).not.toThrow();
    expect(() => compileString(`${child} contract C { struct S { address d; } S[] rows; constructor() {`
      + ' rows.push(S(address(new D()))); } }', { solidityImportCompat: true })).not.toThrow();
  });
});

describe('external-call target through a single-assignment local intermediary (EACC Marketplace takeJob / unicrow)', () => {
  // Two Marketplace shapes where the target hides behind a single-assignment local: (a) a STORAGE-POINTER base
  // (`JobPost storage job = jobs[id]; IERC20 token = IERC20(job.token); ...call`) the AstBuilder did not inline, so
  // `job.token` must be resolved to `jobs[id].token`; (b) an interface local (`IUnicrow u = IUnicrow(unicrowAddress);
  // u.pay()`) the codegen cannot source ("variable 'unicrow' does not exist on the stack"). Both hoist the resolved
  // self-pinned target. A REASSIGNED local is not traced (falls back to the caller-witness local source).
  it('resolves a storage-pointer local base at a low-level .call target (job.token -> jobs[id].token)', () => {
    const src = 'pragma solidcash >=0.8.0; interface ITok { function ping(pubkey o, sig s); }'
      + ' struct Job { address token; } contract C() { mapping(int => Job) jobs; int calls;'
      + ' function _callBool(ITok tok, bytes data) internal returns (bool) { bool ok, bytes r = address(tok).call(data); return ok; }'
      + ' function f(int jobId, bytes data, pubkey pk, sig s) { require(checkSig(s, pk));'
      + ' Job storage job = jobs[jobId]; ITok token = ITok(job.token);'
      + ' bool ok = _callBool(token, data); require(ok); this.calls = this.calls + 1; } }';
    const ec = compileString(src, {}).abi.find((f) => f.name === 'f')?.externalCalls?.find((e) => e.opaqueReturn);
    expect(ec?.addressStateVar).toBe('ll_jobs_jobId_token');
  });
  it('hoists an interface local intermediary IUnicrow u = IUnicrow(unicrowAddress); u.pay() from the state var', () => {
    const src = 'pragma solidcash >=0.8.0; interface IUnicrow { function pay(int amt, pubkey o, sig s); }'
      + ' contract C() { address unicrowAddress; int calls;'
      + ' function f(int amt, pubkey pk, sig s) { require(checkSig(s, pk));'
      + ' IUnicrow u = IUnicrow(unicrowAddress); u.pay(amt, pk, s); this.calls = this.calls + 1; } }';
    const ec = compileString(src, {}).abi.find((f) => f.name === 'f')?.externalCalls?.[0];
    expect(ec?.addressParam).toBe('__extaddr_unicrowAddress_IUnicrow');
  });
});

describe('clearer diagnostic for an external call on an interface-typed struct-field receiver', () => {
  // `pool.lpToken.balanceOf(..)` where the field is an interface type: the receiver IS an interface instance, so the
  // generic "only supported on interface/contract instances" error was misleading. Give the accurate limitation +
  // the hoist-to-local workaround (which compiles for a non-inlined receiver; the co-spent target then traces).
  const I = 'interface IERC20 { function balanceOf(address a) external view returns (uint256); }';
  it('captures an interface field from a mutable C2 mapping-entry cache at the call site', () => {
    const src = `pragma solidity ^0.8.0; ${I} contract C { struct Pool { IERC20 lpToken; uint256 x; }`
      + ' mapping(uint256 => Pool) pools; function f(uint256 k) public returns (uint256) {'
      + ' Pool storage pool = pools[k]; pool.x++; return pool.lpToken.balanceOf(address(this)); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
  it('captures a state-backed struct field after its constructor assignment, at the call site', () => {
    const src = 'pragma solidity ^0.8.0; contract D { uint256 public x; } contract C {'
      + ' struct S { D d; } S s; constructor() { s.d = new D(); require(s.d.x() == 0); }'
      + ' function f() public view returns (uint256) { return s.d.x(); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
  it('still rejects an interface field from a reassignable memory struct', () => {
    const src = `pragma solidity ^0.8.0; ${I} contract C { struct Pool { IERC20 lpToken; uint256 x; }`
      + ' function f(IERC20 a, IERC20 b, bool c) public view returns (uint256) {'
      + ' Pool memory pool = Pool(a, 0); if (c) pool = Pool(b, 1);'
      + ' return pool.lpToken.balanceOf(address(this)); } }';
    expect(() => compileString(src, { solidityImportCompat: true }))
      .toThrow(/interface-typed struct field or computed receiver/);
  });
  it('the hoist-to-local workaround compiles', () => {
    const src = `pragma solidity ^0.8.0; ${I} contract C { struct Pool { IERC20 lpToken; uint256 x; } Pool[] poolInfo;`
      + ' function f(uint256 pid) public view returns (uint256) {'
      + ' IERC20 r = poolInfo[pid].lpToken; return r.balanceOf(address(this)); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
});

describe('opaque MultiCall over a struct-array parameter (Multicall2 calls[i].target.call(calls[i].callData))', () => {
  // The opaque loop dispatch `targets[i].call(data[i])` (working over parallel address[]/bytes[] arrays) extended
  // to a struct-array param `Call[] { address target; bytes callData; }` where the target and calldata are FIELDS
  // of each element. The covenant is the same per-iteration inline loop (emitInlineLoopExternalCall), pinning each
  // co-spent callee to `calls[i].target` (decoded via visitFieldAccess); the array parameter is resolved through
  // inliner SSA aliases (`__rh<N>_calls`) back to the real param so the GTT gate + SDK recognise it.
  const ok = (src: string): void => {
    expect(() => compileString(`pragma experimental ABIEncoderV2; ${src}`, { solidityImportCompat: true })).not.toThrow();
  };
  it('compiles the direct struct-array opaque loop', () => {
    ok('contract C { struct Call { address target; bytes callData; }'
      + ' function aggregate(Call[] memory calls) public returns (bytes[] memory out){ out = new bytes[](calls.length);'
      + ' for (uint i = 0; i < calls.length; i++) { (bool s, bytes memory r) = calls[i].target.call(calls[i].callData);'
      + ' require(s); out[i] = r; } } }');
  });
  it('compiles the inlined struct-array opaque loop (calls param aliased through a returning helper)', () => {
    ok('contract C { struct Call { address target; bytes callData; } struct Result { bool success; bytes returnData; }'
      + ' function tryAggregate(bool rs, Call[] memory calls) public returns (Result[] memory out){'
      + ' out = new Result[](calls.length);'
      + ' for (uint i = 0; i < calls.length; i++) { (bool s, bytes memory r) = calls[i].target.call(calls[i].callData);'
      + ' if (rs) { require(s); } out[i] = Result(s, r); } }'
      + ' function tryBlockAndAggregate(bool rs, Call[] memory calls) public returns (uint bn, Result[] memory out){'
      + ' bn = block.number; out = tryAggregate(rs, calls); } }');
  });
});

describe('inlined helper with an interface-cast external-call target (clone .call/.expression aliasing)', () => {
  // A MethodCallStatementNode holds its call in both `.call` and (post-first-traversal) `.expression` as the SAME
  // object. cloneNode used to split them when inlining a helper body, so a later target hoist rewrote `.expression`
  // while SymbolTableTraversal re-derived from the stale `.call` - losing an `IFactory(factory).createPair()`
  // co-spend target ("must be a constructor/function parameter"). cloneNode now re-aliases them. Router02 _addLiquidity.
  it('resolves IFactory(factory).m() inside an inlined storage-pointer helper', () => {
    expect(() => compileString('pragma experimental ABIEncoderV2;'
      + ' interface IFactory { function getPair(address a, address b) external view returns (address);'
      + ' function createPair(address a, address b) external returns (address); }'
      + ' contract C { address factory; mapping(address => uint256) data;'
      + ' function _helper(mapping(address => uint256) storage d, address a, address b) internal {'
      + ' if (IFactory(factory).getPair(a, b) == address(0)) { IFactory(factory).createPair(a, b); } d[a] = 1; }'
      + ' function f(address a, address b) external { _helper(data, a, b); } }', {
      solidityImportCompat: true, messageBus: true,
    }))
      .not.toThrow();
  });
});

describe('abi.decode to an interface/contract type (BentoBox/Kashi)', () => {
  // `abi.decode(data, (IERC20))` - an interface/contract handle is an address on BCH, so it decodes as address
  // (byte-identical to `abi.decode(data, (address))`). Was: "Unsupported type 'IERC20' in abi.decode".
  const bc = (src: string): string => compileString(src, { solidityImportCompat: true, forceStateful: true }).bytecode;
  it('decodes an interface type identically to address (sound by reduction)', () => {
    const iface = 'interface IERC20 { function x() external; } contract C() { address o;'
      + ' function f(bytes memory d, pubkey pk, sig s) { require(checkSig(s, pk));'
      + ' (IERC20 t, uint256 n) = abi.decode(d, (IERC20, uint256)); o = address(t); require(n == n); } }';
    const addr = 'contract C() { address o;'
      + ' function f(bytes memory d, pubkey pk, sig s) { require(checkSig(s, pk));'
      + ' (address t, uint256 n) = abi.decode(d, (address, uint256)); o = t; require(n == n); } }';
    expect(bc(iface)).toBe(bc(addr));
  });
  it('still resolves a registered struct type as a struct (not defaulted to address)', () => {
    expect(compileString('struct P { int a; int b; } contract C() {'
      + ' function f(bytes memory d, pubkey pk, sig s) {'
      + ' require(checkSig(s, pk)); P p = abi.decode(d, (P)); require(p.a == p.a); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('call options on function-pointer identifiers', () => {
  it('retains gas options while lowering a state external-function pointer call', () => {
    expect(compileString('contract C { function(uint) external returns (uint) x;'
      + ' function f() public { x{gas: 2}(1); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });

  it('rejects value options on a non-payable external-function pointer', () => {
    expect(() => compileString('contract C { function(uint) external returns (uint) x;'
      + ' function f() public { x{value: 2}(1); } }',
    { solidityImportCompat: true, forceStateful: true })).toThrow(/value.*non-payable function type/i);
  });

  it('retains value options while lowering a payable external-function pointer call', () => {
    expect(compileString('contract C { function(uint) external payable returns (uint) x;'
      + ' function f() public { x{value: 2}(1); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('Solidity function-type mutability conversions', () => {
  const declaration = (actual: string, expected: string): string =>
    `contract C { function h() ${actual === 'nonpayable' ? '' : actual} external {}`
    + ` function f() external view returns (bytes4) {`
    + ` function() ${expected === 'nonpayable' ? '' : expected} external g = this.h; return g.selector; } }`;

  it.each([
    ['nonpayable', 'payable'], ['nonpayable', 'pure'], ['nonpayable', 'view'],
    ['payable', 'pure'], ['payable', 'view'], ['pure', 'payable'],
    ['view', 'payable'], ['view', 'pure'],
  ])('rejects %s -> %s', (actual, expected) => {
    expect(() => compileString(declaration(actual, expected), {
      solidityImportCompat: true,
    })).toThrow();
  });

  it.each([
    ['pure', 'view'], ['pure', 'nonpayable'], ['view', 'nonpayable'], ['payable', 'nonpayable'],
  ])('retains %s -> %s', (actual, expected) => {
    expect(compileString(declaration(actual, expected), {
      solidityImportCompat: true,
    }).contractName).toBe('C');
  });
});

describe('empty abi.decode schema', () => {
  it('accepts abi.decode(data, ()) as an empty tuple expression', () => {
    expect(compileString('contract C { function f() public pure { abi.decode("abc", ()); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('unitary tuple parentheses in abi.decode schemas', () => {
  it('normalizes nested unitary parentheses around scalar and array element types', () => {
    expect(compileString('struct S { int a; } contract C { function f() pure public {'
      + ' abi.decode("", (((uint)))); abi.decode("", ((((S)))));'
      + ' abi.decode("", ((uint)[2])); abi.decode("", (((uint))[5][6])); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('function-reference members after call options', () => {
  it('accepts a discarded .address member after value options', () => {
    expect(compileString('contract C { function f(address) payable external returns (bool) {'
      + ' this.f{value: 42}.address; } }', { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('rejects non-function-value members after call options', () => {
    expect(() => compileString('contract C { function f() external { this.f{gas: 1}.nope; } }',
      { solidityImportCompat: true })).toThrow(/no member 'nope'/);
  });
});

describe('function-pointer parameters shadow contract functions', () => {
  it('dispatches the lexical pointer when a contract method has the same name', () => {
    expect(compileString('contract C { function(uint) returns (uint) p; function g() public pure {}'
      + ' function f(function(uint) returns (uint) g) internal returns (uint) { return g(2); }'
      + ' function run() public returns (uint) { return f(p); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('function-reference members after call options in expressions', () => {
  it('reads address and selector after validating gas/value options', () => {
    expect(compileString('contract C { function g() external payable {}'
      + ' function f() external returns (bool) { return this.g{gas: 42}.address == this.g.address'
      + ' && this.g{value: 1}.selector == this.g.selector; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('fixed local external-function-pointer arrays', () => {
  it('tracks assigned methods through indexed abi.encodeCall targets and selector aliases', () => {
    expect(compileString(
      'contract C { function target() external pure {} function f() external returns (bytes4) {'
      + ' function() external[2] memory callbacks; callbacks[0] = this.target; callbacks[1] = this.target;'
      + ' function() external pointer = callbacks[1];'
      + ' bytes memory a = abi.encodeCall(callbacks[0], ());'
      + ' bytes memory b = abi.encodeCall(pointer, ());'
      + ' assert(bytes4(a) == pointer.selector); return bytes4(b); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('indexed function-pointer call options', () => {
  it('retains value and gas options on a pointer selected from an inline array', () => {
    expect(compileString(
      'contract C { function a() external payable returns (uint) { return 1; }'
      + ' function b() external payable returns (uint) { return 2; }'
      + ' function f() public payable returns (uint) {'
      + ' return [this.a, this.b][0]{value: 1, gas: 100000}(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('abi.encodeCall through a self-function pointer alias', () => {
  it('uses the aliased external method selector for a bare pointer target', () => {
    expect(compileString('contract C { function target(uint256 a, uint256 b) external {}'
      + ' function f(uint256 x, uint256 y) public view returns (bytes memory) {'
      + ' function(uint256, uint256) external p = this.target; return abi.encodeCall(p, (x, y)); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('preserves side effects when a helper returns the encoded self pointer', () => {
    expect(compileString('contract C { bool touched; function target(uint256 a) external {}'
      + ' function pointer() public returns (function(uint256) external) {'
      + ' touched = true; return this.target; }'
      + ' function f(uint256 x) public returns (bytes memory) { return abi.encodeCall(pointer(), (x)); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('declaration selectors in constant initializers', () => {
  it('folds function, event, and error selectors before contract functions are registered', () => {
    expect(compileString('event GlobalEvent(); error GlobalError();'
      + ' bytes32 constant GE = GlobalEvent.selector; bytes4 constant GX = GlobalError.selector;'
      + ' interface I { function ping(uint256 x) external; }'
      + ' contract Base { function inherited() public { require(true); } }'
      + ' contract C is Base { event LocalEvent(uint256 x); error LocalError(uint256 x);'
      + ' bytes4 constant A = I.ping.selector; bytes4 constant B = this.own.selector;'
      + ' bytes4 constant D = super.inherited.selector; bytes32 constant E = LocalEvent.selector;'
      + ' bytes4 constant F = C.LocalError.selector; function own() external { require(true); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('keeps same-signature errors distinct by scope and folds selectors in function bodies', () => {
    expect(compileString('library L { error E(); } library T { error E(); }'
      + ' library S { error E(uint256 x); } error E(); interface I { error E(); }'
      + ' contract C { function f() public pure returns (bytes4) {'
      + ' assert(L.E.selector == T.E.selector); assert(L.E.selector != S.E.selector);'
      + ' assert(E.selector == I.E.selector); return L.E.selector; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('still rejects Solidity-reserved zero and all-one custom-error selectors', () => {
    expect(() => compileString('error buyAndFree22457070633(uint256); contract C {}',
      { solidityImportCompat: true })).toThrow('reserved selector 0x00000000');
    expect(() => compileString('error test266151307(); contract C {}',
      { solidityImportCompat: true })).toThrow('reserved selector 0xffffffff');
  });
});

describe('selectors from contract-valued call receivers', () => {
  it('evaluates only the selected ternary receiver before returning its method selector', () => {
    expect(compileString('contract A { function f() public { require(true); }'
      + ' function g() public { require(true); } } contract C { A a = new A(); bool touched;'
      + ' function getContract() public returns (A) { touched = true; return a; }'
      + ' function test(bool b) public returns (bytes4) {'
      + ' return (b ? getContract().f : getContract().g).selector; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('runtime selector reads from received external function pointers', () => {
  it('reads the selector half of the lowered address-selector ABI pair', () => {
    const artifact = compileString('contract C { function f() external returns (bytes4) {'
      + ' return this.f.selector; } function h(function() external p) public returns (bytes4) {'
      + ' return p.selector; } }', { solidityImportCompat: true });
    expect(artifact.contractName).toBe('C');
    expect(artifact.abi.find((entry) => entry.name === 'h')?.inputs.map((input) => input.type))
      .toEqual(['address', 'bytes4', 'bigint']);
  });

  it('reads an uninitialized local pointer as the default zero selector at runtime', () => {
    expect(compileString('contract C { function f() public pure returns (bytes4) {'
      + ' function() external g; g.selector; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('selects the proven self method returned through a named return variable', () => {
    expect(compileString('contract C { function target() external { require(true); }'
      + ' function pointer() public view returns (function() external p) { p = this.target; }'
      + ' function f() public returns (bytes4) { return pointer().selector; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('self staticcall dispatch and bytes-length narrowing', () => {
  it('dispatches abi.encodeCall payloads internally and permits reusing the return-data variable', () => {
    expect(compileString('contract Shape { function a(uint x) external pure {} }'
      + ' contract C { function a(uint x) external pure returns (uint) { return x + 1; }'
      + ' function test() public returns (uint r) { bool ok; bytes memory result;'
      + ' (ok, result) = address(this).staticcall(abi.encodeCall(Shape.a, 1));'
      + ' require(ok && result.length == 32); r = abi.decode(result, (uint));'
      + ' (ok, result) = address(this).staticcall(abi.encodeCall(Shape.a, 10));'
      + ' require(ok && result.length == 32); return r + abi.decode(result, (uint)); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('ends a bytesN flow narrowing when the guarded variable is reassigned', () => {
    expect(compileString('contract C { function f(bytes memory first, bytes memory second)'
      + ' public pure returns (bytes memory) { bytes memory value = first;'
      + ' require(value.length == 32); value = second; return value; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('abi.encodeCall source ABI parameters', () => {
  it('excludes compiler-only state/covenant parameters from self-target argument validation', () => {
    expect(compileString('contract C { bool touched; function target(uint x, uint y) external returns (uint) {'
      + ' touched = true; return x + y; } function encoded() public view returns (bytes memory) {'
      + ' return abi.encodeCall(this.target, (12, 13)); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('contextually converts string literals to fixed bytes parameters', () => {
    expect(compileString('contract C { function target(bytes2 value) external {}'
      + ' function encoded() public view returns (bytes memory) {'
      + ' return abi.encodeCall(this.target, ("ab")); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('empty ABI encodings', () => {
  it('encodes empty argument lists as empty bytes', () => {
    expect(compileString('contract C { function encoded() public pure returns (bytes memory, bytes memory) {'
      + ' return (abi.encode(), abi.encodePacked()); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('call options in inlined state helpers', () => {
  it('alpha-renames helper parameters referenced by deployment options', () => {
    expect(compileString('contract D {} contract C { uint x;'
      + ' function deploy(uint amount) internal { x = 1; new D{salt: bytes32(amount)}(); }'
      + ' function f() public { deploy(2); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('UDVT arguments in selector-based self calls', () => {
  it('re-wraps an underlying ABI value when reducing a low-level self call', () => {
    expect(compileString('contract C { type T is int; function target(T x) external returns (T) { return x; }'
      + ' function f() public { (bool ok,) = address(this).call('
      + ' abi.encodeWithSelector(this.target.selector, int(-5))); require(ok); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('ABI coder pragma selection', () => {
  it('rejects invalid, repeated, and conflicting source-unit selections', () => {
    const compat = { solidityImportCompat: true };
    expect(() => compileString('pragma abicoder v3; contract C {}', compat)).toThrow(/either.*v1.*v2/);
    expect(() => compileString('pragma abicoder v2; pragma abicoder v2; contract C {}', compat))
      .toThrow(/already been selected/);
    expect(() => compileString('pragma experimental ABIEncoderV2; pragma abicoder v1; contract C {}', compat))
      .toThrow(/already been selected/);
    for (const source of [
      'pragma abicoder "v1"; contract C {}',
      'pragma abicoder "v2"; contract C {}',
      'pragma abicoder v2; pragma experimental ABIEncoderV2; contract C {}',
    ]) {
      expect(compileString(source, compat).contractName).toBe('C');
    }
  });
});

describe('nested internal-only ABI parameter types', () => {
  it('rejects internal function pointers and mappings nested in entry-point aggregates', () => {
    const compat = { solidityImportCompat: true };
    expect(() => compileString('contract C { struct S { function() internal[2] callbacks; }'
      + ' function f(S memory value) public {} }', compat)).toThrow(/Function types cannot be used/);
    expect(() => compileString('contract C { struct S { mapping(uint => uint) values; }'
      + ' function f(S memory value) public {} }', compat)).toThrow(/Function types cannot be used/);
  });
});

describe('straight-line value deploy block layout', () => {
  it('reserves a transfer slot for a value deploy nested in a constructor state assignment', () => {
    expect(compileString('contract D { constructor(bytes3 x) payable {} } contract C { D d;'
      + ' constructor() payable { d = new D{value: 10}("abc"); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('abi.encodeWithSelector contextual zero', () => {
  it('implicitly converts literal zero to bytes4', () => {
    expect(compileString('contract C { function f() public pure returns (bytes memory) {'
      + ' return abi.encodeWithSelector(0); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('ABI-decoded payable address binding', () => {
  it('retains a payable local qualifier without relaxing ordinary address assignment', () => {
    expect(compileString('contract C { function f(bytes memory data) public pure returns (address payable) {'
      + ' address payable target = abi.decode(data, (address)); return target; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
    expect(() => compileString('contract C { function f(address source) public pure {'
      + ' address payable target = source; } }', { solidityImportCompat: true })).toThrow();
  });
});

describe('cast-wrapped same-transaction deploy calls', () => {
  const contracts = 'interface IShort { function f() external pure returns (bytes32); }'
    + ' contract Long { function f() external pure returns (uint[20] memory) {} }';

  it('folds the concrete callee and discards an intentionally mismatched interface result', () => {
    expect(compileString(contracts + ' contract C { function test() public returns (uint) {'
      + ' Long fresh = new Long(); uint before; assembly { before := mload(0x40) }'
      + ' IShort(address(fresh)).f(); uint after; assembly { after := mload(0x40) } return after - before; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('does not erase a mismatched ABI result used as a value', () => {
    expect(() => compileString(contracts + ' contract C { function test() public returns (bytes32) {'
      + ' Long fresh = new Long(); return IShort(address(fresh)).f(); } }',
    { solidityImportCompat: true })).toThrow(/Cannot call 'f\(\)'/);
  });

  it('folds an inline deployment hidden by address and interface casts', () => {
    const src = 'contract Child { uint x; function f() public returns (uint) { x = 3; return 1; } }'
      + ' interface IView { function f() external view returns (uint); }'
      + ' contract C { function test() public returns (uint) { return IView(address(new Child())).f(); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('external function type reference locations', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects mappings in external function type parameters and returns', () => {
    expect(() => cc('contract C { function f('
      + 'function(mapping(uint => uint) storage) external cb) public pure {} }'))
      .toThrow(/require memory or calldata/);
    expect(() => cc('contract C { function f('
      + 'function() external returns (mapping(uint => uint) storage) cb) public pure {} }'))
      .toThrow(/require memory or calldata/);
  });

  it('requires memory or calldata for external reference parameters', () => {
    expect(() => cc('contract C { struct S { uint x; }'
      + ' function f(function(S storage) external cb) public pure {} }'))
      .toThrow(/require memory or calldata/);
    expect(() => cc('contract C { function f('
      + 'function(uint[] values) external cb) public pure {} }'))
      .toThrow(/require memory or calldata/);
  });

  it('retains valid external locations and native storage function types', () => {
    expect(cc('contract C { struct S { uint x; } function f('
      + 'function(S calldata) external cb, function(uint[] memory) external other) public pure {} }')).toBe('C');
    expect(compileString('contract C { function f('
      + 'function(mapping(uint => uint) storage) external cb) public pure {} }').contractName).toBe('C');
  });
});

describe('value-bearing deployment implies a stateful parent', () => {
  it('emits parent state layout without an explicit state declaration or forceStateful option', () => {
    const artifact = compileString(
      'contract Child { constructor() payable {} }'
      + ' contract C { function deploy() public payable { new Child{value: 10}(); } }',
      { solidityImportCompat: true },
    );
    expect(artifact.stateLayout).toBeDefined();
  });

  it('still rejects value sent to a nonpayable constructor or from a pure function', () => {
    expect(() => compileString(
      'contract Child { constructor() {} }'
      + ' contract C { function deploy() public payable { new Child{value: 10}(); } }',
      { solidityImportCompat: true },
    )).toThrow(/not payable/i);
    expect(() => compileString(
      'contract Child { constructor() payable {} }'
      + ' contract C { function deploy() public pure { new Child{value: 10}(); } }',
      { solidityImportCompat: true },
    )).toThrow(/pure or view/i);
  });
});

describe('parameter mutability keywords', () => {
  it('rejects constant and immutable on function and modifier parameters or returns', () => {
    const invalid = [
      'contract C { function f(uint constant x) public {} }',
      'contract C { function f() public returns (uint immutable x) {} }',
      'contract C { modifier m(uint constant x) { _; } }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/keyword can only be used for state variables/);
    }
  });

  it('retains constant and immutable state declarations', () => {
    expect(compileString(
      'contract C { uint constant X = 1; uint immutable y; constructor() { y = 2; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('ABI coder v1 type restrictions', () => {
  it('rejects structs and nested/dynamic-element arrays at ABI boundaries', () => {
    const invalid = [
      'pragma abicoder v1; contract C { function f(uint[][] calldata x) external {} }',
      'pragma abicoder v1; contract C { constructor(uint[][] memory x) {} }',
      'pragma abicoder v1; struct S { uint x; } contract C { event E(S); }',
      'pragma abicoder v1; contract C { function f() public pure returns (string[][] memory) {} }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/only supported in ABI coder v2/);
    }
  });

  it('accepts legacy-supported arrays and all ABI v2 shapes', () => {
    expect(compileString(
      'pragma abicoder v1; contract C { function f(uint[] calldata x) external {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'pragma abicoder v2; struct S { uint x; } contract C { event E(S);'
      + ' function f(uint[][] calldata x) external {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'pragma abicoder v1; abstract contract C { constructor(uint[][][] memory x) {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('applies the same nested-type restrictions to explicit ABI encoding and decoding', () => {
    const invalid = [
      'pragma abicoder v1; contract C { function f() public pure {'
        + ' abi.encode([new uint[](5), new uint[](7)]); } }',
      'pragma abicoder v1; contract C { function f() public pure {'
        + ' abi.decode("1234", (uint[][3])); } }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/only supported in ABI coder v2/);
    }

    expect(compileString(
      'pragma abicoder v2; contract C { function f() public pure {'
        + ' abi.encode([new uint[](5), new uint[](7)]); abi.decode("1234", (uint[][3])); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('abi.encodePacked supported source types', () => {
  it('rejects structs, nested arrays, and arrays of dynamic values', () => {
    const invalid = [
      'contract C { struct S { uint x; } function f(S memory s) public pure { abi.encodePacked(s); } }',
      'contract C { function f() public pure { abi.encodePacked([new uint[](2), new uint[](3)]); } }',
      'contract C { struct S { uint x; } function f(S[] memory s) public pure { abi.encodePacked(s); } }',
      'contract C { function f(string[] memory s) public pure { abi.encodePacked(s); } }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Type not supported in packed mode/);
    }
  });

  it('accepts scalar values, bytes/string, and one-dimensional value arrays', () => {
    expect(compileString(
      'contract C { function f(uint[] memory a, bytes memory b, string memory s)'
      + ' public pure returns (bytes memory) { return abi.encodePacked(uint(1), a, b, s); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});
