import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Libraries: using-for, sibling calls, UDVT, declaration order, errors/constants.

describe('error declarations inside libraries', () => {
  it('accepts an `error` declared in a library body', () => {
    const a = compileString(`
      library Errors { error InsufficientBalance(int available, int required); function id(int x) returns (int) { return x; } }
      contract C() { int n; function go() { this.n = 1; } }`);
    expect(a.contractName).toBe('C');
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

// using-for on a mapping type (`using L for mapping(K=>V)`): `m.method(args)` desugars to `L.method(m, args)`,
// the mapping receiver becoming a storage-pointer param. A VALUE-returning storage-pointer function is inlined
// in expression position (it has no standalone value representation) - the call is replaced by its substituted
// return expression. Matches the array (SBE-23) path, keyed on the canonical MappingType string.
describe('using-for on a mapping type (`using L for mapping(K=>V)`)', () => {
  const LIB = 'library L { function at(mapping(uint256=>uint256) storage a, uint256 i) internal view'
    + ' returns (uint256) { return a[i]; } }';
  const UF = `${LIB} contract C { using L for mapping(uint256=>uint256); mapping(uint256=>uint256) mp;`;
  it('desugars m.at(k) on a state mapping and inlines the value-returning helper', () => {
    const a = compileString(`${UF} function f(uint256 k) public returns (uint256) { mp[42]=36; return mp.at(k); } }`,
      { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });
  it('is byte-identical to the explicit L.at(mp, k) call (desugar + inline are sound)', () => {
    const sugar = compileString(`${UF} function f(uint256 k) public returns (uint256) { mp[42]=36; return mp.at(k); } }`,
      { solidityImportCompat: true });
    const explicit = compileString(`${LIB} contract C { mapping(uint256=>uint256) mp;`
      + ' function f(uint256 k) public returns (uint256) { mp[42]=36; return L.at(mp, k); } }', { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(explicit.bytecode);
  });
});

// A value-returning function with a single `return <expr>` body and a storage-pointer param is inlined in
// expression position (a storage param has no standalone value). `at(mp, k)` -> `mp[k]`, byte-identical.
describe('value-returning storage-pointer function inlining', () => {
  it('inlines at(mp, k) { return a[i]; } to a direct mapping read (byte-identical)', () => {
    const pre = 'contract C { mapping(uint256=>uint256) mp;';
    const inlined = compileString(`${pre} function at(mapping(uint256=>uint256) storage a, uint256 i) internal`
      + ' returns (uint256) { return a[i]; }'
      + ' function f(uint256 k) external returns (uint256) { mp[5]=9; return at(mp, k); } }', { solidityImportCompat: true });
    const direct = compileString(`${pre} function f(uint256 k) external returns (uint256) { mp[5]=9; return mp[k]; } }`,
      { solidityImportCompat: true });
    expect(inlined.bytecode).toBe(direct.bytecode);
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
