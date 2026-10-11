// Contract-level semantics on both VMs: super chains, linearization, virtual dispatch, modifiers, libraries, free
// functions, overloads, internal function pointers, enums and recursion. Each source declares `C` with `f`.
import { describe, it } from 'vitest';
import { assertConformant, contractCase } from './harness.js';

const run = (
  label: string, source: string, params: string, retType: string, args: readonly unknown[],
): Promise<void> => assertConformant(contractCase({ label, source, params, retType, args }));

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
