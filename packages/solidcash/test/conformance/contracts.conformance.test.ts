// Contract-level semantics on both VMs: super chains, linearization, virtual dispatch, modifiers, libraries, free
// functions, overloads, internal function pointers, enums and recursion. Each source declares `C` with `f`.
import { describe, it } from 'vitest';
import {
  assertConformant, assertStatefulConformant, contractCase, type ConformanceCase,
} from './harness.js';

const run = (
  label: string, source: string, params: string, retType: string, args: readonly unknown[],
): Promise<void> => assertConformant(contractCase({ label, source, params, retType, args }));

// A stateful `C` (data-NFT genesis); `check` is spent like a state write, so it carries no mutability.
const runStateful = (label: string, source: string, params: string, args: readonly unknown[]): Promise<void> => {
  const c: ConformanceCase = contractCase({ label, source, params, retType: 'uint256', args });
  return assertStatefulConformant({ ...c, scash: c.scash.replace(' public pure {', ' public {') });
};

describe('contracts: inheritance', () => {
  it('super chain', () => run('super', `
contract B { function g(uint256 x) internal pure virtual returns (uint256) { return x + 1; } }
contract C is B {
  function g(uint256 x) internal pure override returns (uint256) { return super.g(x) * 2; }
  function f(uint256 x) public pure returns (uint256) { return g(x); }
}`, 'uint256 x', 'uint256', [5n]));

  it('diamond follows the C3 order through super', () => run('diamond', `
contract A { function g(uint256 x) internal pure virtual returns (uint256) { return x * 10 + 1; } }
contract B is A { function g(uint256 x) internal pure virtual override returns (uint256) { return super.g(x) * 10 + 2; } }
contract D is A { function g(uint256 x) internal pure virtual override returns (uint256) { return super.g(x) * 10 + 3; } }
contract C is B, D {
  function g(uint256 x) internal pure override(B, D) returns (uint256) { return super.g(x) * 10 + 4; }
  function f(uint256 x) public pure returns (uint256) { return g(x); }
}`, 'uint256 x', 'uint256', [7n]));

  it('a base function dispatches to the override', () => run('virtual-dispatch', `
contract A {
  function h() internal pure virtual returns (uint256) { return 1; }
  function f(uint256 x) public pure returns (uint256) { return h() + x; }
}
contract C is A { function h() internal pure override returns (uint256) { return 2; } }`,
  'uint256 x', 'uint256', [10n]));

  it('an abstract base with an implemented helper', () => run('abstract', `
abstract contract A {
  function k() internal pure virtual returns (uint256);
  function twice() internal pure returns (uint256) { return k() * 2; }
}
contract C is A {
  function k() internal pure override returns (uint256) { return 21; }
  function f(uint256 x) public pure returns (uint256) { return twice() + x; }
}`, 'uint256 x', 'uint256', [0n]));
});

describe('contracts: modifiers, libraries and free functions', () => {
  it('a modifier around the body', () => run('modifier', `
contract C {
  modifier positive(uint256 a) { require(a > 0, "zero"); _; }
  function f(uint256 a) public pure positive(a) returns (uint256) { return a * 3; }
}`, 'uint256 a', 'uint256', [4n]));

  it('using-for on a value', () => run('using-for', `
library L { function sq(uint256 x) internal pure returns (uint256) { return x * x; } }
contract C {
  using L for uint256;
  function f(uint256 x) public pure returns (uint256) { return x.sq() + 1; }
}`, 'uint256 x', 'uint256', [9n]));

  it('a free function and a file-level constant', () => run('free-function', `
uint256 constant K = 7;
function twice(uint256 x) pure returns (uint256) { return 2 * x; }
contract C { function f(uint256 x) public pure returns (uint256) { return twice(x) + K; } }`,
  'uint256 x', 'uint256', [5n]));

  it('a library function writes a memory array its caller passed', () => run('library-memory-array', `
library L { function bump(uint256[] memory xs, uint256 d) internal pure { xs[1] = xs[1] + d; } }
contract C {
  using L for uint256[];
  function f(uint256 k) public pure returns (uint256) {
    uint256[] memory a = new uint256[](3);
    a[1] = 5;
    L.bump(a, k);
    a.bump(k * 10);
    return a[1] * 10 + a.length;
  }
}`, 'uint256 k', 'uint256', [2n]));

  it('a library function writes a memory struct its caller passed', () => run('library-memory-struct', `
struct P { uint256 a; uint256[] data; }
library L { function fill(P memory q, uint256 w) internal pure { q.a = w; q.data[1] = w * 2; } }
contract C {
  using L for P;
  function f(uint256 v) public pure returns (uint256) {
    P memory p = P(1, new uint256[](2));
    L.fill(p, v);
    uint256 first = p.a * 100 + p.data[1];
    p.fill(v + 1);
    return first * 10000 + p.a * 100 + p.data[1];
  }
}`, 'uint256 v', 'uint256', [3n]));

  it('overloads by arity', () => run('overload', `
contract C {
  function g(uint256 a) internal pure returns (uint256) { return a + 1; }
  function g(uint256 a, uint256 b) internal pure returns (uint256) { return a * b; }
  function f(uint256 x) public pure returns (uint256) { return g(x) + g(x, x); }
}`, 'uint256 x', 'uint256', [3n]));
});

describe('contracts: pointers, enums and recursion', () => {
  it('an internal function pointer chosen at runtime', () => run('fn-pointer', `
contract C {
  function inc(uint256 a) internal pure returns (uint256) { return a + 1; }
  function dbl(uint256 a) internal pure returns (uint256) { return a * 2; }
  function f(uint256 x) public pure returns (uint256) {
    function(uint256) internal pure returns (uint256) p = x > 5 ? dbl : inc;
    return p(x);
  }
}`, 'uint256 x', 'uint256', [7n]));

  it('enum conversions', () => run('enum', `
contract C {
  enum E { A, B, Z }
  function f(uint256 x) public pure returns (uint256) {
    E e = E(x);
    return uint256(E.Z) * 10 + (e == E.B ? 1 : 0);
  }
}`, 'uint256 x', 'uint256', [1n]));

  it('recursion', () => run('recursion', `
contract C {
  function fact(uint256 n) internal pure returns (uint256) { return n <= 1 ? 1 : n * fact(n - 1); }
  function f(uint256 n) public pure returns (uint256) { return fact(n); }
}`, 'uint256 n', 'uint256', [6n]));

  const STRUCT_RETURN = `
contract C {
  struct P { uint256 x; uint256 y; }
  function mk(uint256 a) internal pure returns (P memory) { return P(a, a * a); }
  function f(uint256 a) public pure returns (uint256) { P memory p = mk(a); return p.x + p.y; }
}`;
  it.each([false, true])('a struct returned from a helper (evmCompat %s)', (evmCompat) => assertConformant(
    contractCase({ label: 'struct-return', source: STRUCT_RETURN, params: 'uint256 a', retType: 'uint256',
      args: [4n], evmCompat })));

  it('a returned struct keeps reference semantics', () => run('struct-return-alias', `
contract C {
  struct P { uint256 x; uint256 y; }
  function mk(uint256 a) internal pure returns (P memory) { return P(a, a * a); }
  function bump(P memory q) internal pure { q.y += 1; }
  function f(uint256 a) public pure returns (uint256) {
    P memory p = mk(a);
    P memory other = p;
    other.x = 9;
    bump(p);
    return p.x * 100 + p.y;
  }
}`, 'uint256 a', 'uint256', [4n]));

  it('a struct reassigned from a helper', () => run('struct-reassign', `
contract C {
  struct P { uint256 x; uint256 y; }
  function mk(uint256 a) internal pure returns (P memory) { return P(a, a + 1); }
  function f(uint256 a) public pure returns (uint256) {
    P memory p = P(1, 2);
    p = mk(a);
    return p.x * 100 + p.y;
  }
}`, 'uint256 a', 'uint256', [4n]));
});

describe('contracts: public functions called internally', () => {
  it('a public function writes a memory array its internal caller passed', () => run('public-memory-array', `
contract C {
  function g(uint256[] memory xs, uint256 d) public pure returns (uint256) {
    xs[1] = xs[1] + d;
    return xs.length;
  }
  function f(uint256 k) public pure returns (uint256) {
    uint256[] memory a = new uint256[](3);
    a[1] = 5;
    uint256 n = g(a, k);
    return a[1] * 10 + n;
  }
}`, 'uint256 k', 'uint256', [2n]));

  // The struct entry parameter runs in evmCompat, where that ABI shape is covered; a void entry ends in a require.
  it('a public function writes a memory struct its internal caller passed', () => assertConformant(contractCase({
    label: 'public-memory-struct',
    source: `
contract C {
  struct P { uint256 a; uint256 b; }
  function h(P memory q, uint256 w) public pure { q.a = w; q.b = q.b + w * 2; require(q.b > q.a); }
  function f(uint256 v) public pure returns (uint256) {
    P memory p = P(1, 2);
    h(p, v);
    return p.a * 100 + p.b;
  }
}`,
    params: 'uint256 v',
    retType: 'uint256',
    args: [3n],
    evmCompat: true,
  })));

  // `this.g` reaches g's own entry body and copies the array; the internal call shares it.
  it('a public function called internally and through its own entry', () => assertConformant(contractCase({
    label: 'public-memory-entry',
    source: `
contract C {
  function g(uint256[] memory xs, uint256 d) public pure returns (uint256) {
    xs[0] = xs[0] + d;
    return xs[0] * 10 + xs.length;
  }
  function f(uint256 k) public view returns (uint256) {
    uint256[] memory a = new uint256[](2);
    a[0] = 7;
    uint256 r = g(a, k);
    uint256 e = this.g(a, k);
    return r * 1000000 + e * 1000 + a[0];
  }
}`,
    params: 'uint256 k',
    retType: 'uint256',
    args: [2n],
    view: true,
  })));
});

describe('contracts: interfaces and qualified state', () => {
  // ERC-165: an interface id XORs only the selectors the interface declares itself, not inherited ones. evmCompat
  // only: native selectors hash the platform signature, so a native interfaceId is not the EVM value by design.
  it('type(I).interfaceId excludes inherited functions', () => assertConformant(contractCase({
    label: 'interface-id-inherited',
    source: `
interface IBase { function supportsInterface(bytes4 id) external view returns (bool); }
interface IDerived is IBase {
  function balanceOf(uint256 owner) external view returns (uint256);
  function approve(uint256 spender, uint256 amount) external returns (bool);
}
contract C {
  function f() public pure returns (bytes4) { return type(IDerived).interfaceId; }
}`,
    params: '',
    retType: 'bytes4',
    args: [],
    evmCompat: true,
  })));

  // `C.x` names the state variable even where a return variable `x` shadows it (state starts at zero).
  it('a contract-qualified state read under a shadowing return variable', () => runStateful('qualified-state-read', `
contract C {
  uint256 x;
  function f(uint256 v) public view returns (uint256 x) {
    x = v;
    x = x * 10 + C.x;
  }
}`, 'uint256 v', [5n]));

  // `C.x = ...` and `C.x += ...` write the state variable, not the shadowing parameter `x`.
  it('a contract-qualified state write under a shadowing parameter', () => runStateful('qualified-state-write', `
contract C {
  uint256 x;
  function f(uint256 x) public returns (uint256) {
    C.x = x + 1;
    C.x += 2;
    return C.x * 100 + x;
  }
}`, 'uint256 x', [5n]));
});
