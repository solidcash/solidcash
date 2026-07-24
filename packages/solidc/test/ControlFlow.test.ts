import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Control flow: loops, break/continue, ternary, assignment-as-expression, ++/--.

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

describe('SBE-5: for-loop flexibility + prefix increment statements', () => {
  it('for-loop with omitted initializer defaults the counter to 0', () => {
    const a = compileString('contract C() { function f() { int s = 0; for (int i; i < 3; i++) { s = s + i; } require(s >= 0); } }');
    expect(a.contractName).toBe('C');
  });

  it('for-loop with an empty update clause compiles', () => {
    const a = compileString('contract C() { function f() { int s = 0; for (int i = 0; i < 3;) { s = s + i; unchecked { i = i + 1; } } require(s >= 0); } }');
    expect(a.contractName).toBe('C');
  });

  it('accepts arbitrary expressions in the update clause', () => {
    expect(compileString(
      'contract C { function f() public { for (uint i = 0; i < 3; true) { i++; } require(true); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'contract C { function tick() internal {} function f() public {'
      + ' for (uint i = 0; i < 3; tick()) { i++; } require(true); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('accepts prefix ++ and -- as statements (same effect as postfix)', () => {
    const a = compileString('contract C() { function f() { int i = 0; ++i; --i; require(i == 0); } }');
    expect(a.contractName).toBe('C');
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

describe('SBE-28: postfix ++/-- as an expression (yields the pre-mutation value)', () => {
  // `lvalue++` yields the PRE-mutation value. Single-use at statement scope: read the lvalue, hoist the increment
  // AFTER. Re-read (`a++ + a`) or in a return: hoist the increment BEFORE and reconstruct the pre-value as
  // `base -/+ 1` (uses the lvalue's own type, no temp). Sound only when the postfix is the FIRST reference to the
  // lvalue and the lvalue is not self-written; non-leftmost re-reads (`a + a++`), self-writes (`a = a++`), and
  // conditional positions (ternary/&&/||/loop) fail closed. VM values in solidcash PostfixReconstruct.test.ts.
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles a local postfix increment in an expression', () => {
    expect(cc('contract C() { function f() { int i = 0; int x = i++ * 2; require(x == 0); } }')).toBe('C');
  });

  it('compiles a mapping-entry postfix increment in abi.encode (the permit nonce pattern)', () => {
    expect(cc('contract C { mapping(address => uint256) nonces; bytes blob;'
      + ' function f(address owner) external { this.blob = abi.encode(owner, nonces[owner]++); } }')).toBe('C');
  });

  it('compiles a postfix increment in a return (reconstructs the pre-value)', () => {
    expect(cc('contract C() { int n; function f() returns (int) { int i = 0; return i++; } }')).toBe('C');
  });

  it('compiles a leftmost re-read `a++ + a` correctly (hoist increment, reconstruct pre-value = 2a+1)', () => {
    expect(cc('contract C() { function f() { int a = 5; require(a++ + a == 11); } }')).toBe('C');
  });

  it('still allows a single-use postfix (not re-read) - `int x = a++`', () => {
    expect(cc('contract C() { function f() returns (int) { int a = 5; int x = a++; return x; } }')).toBe('C');
  });

  it('fail-closes a non-leftmost re-read `a + a++` (the earlier read would see the hoisted post-value)', () => {
    expect(() => cc('contract C() { function f() { int a = 5; int x = a + a++; require(x >= 0); } }'))
      .toThrow('read before the increment');
  });

  it('fail-closes a self-write postfix `a = a++` (the outer assign races the hoisted increment)', () => {
    expect(() => cc('contract C() { function f() { int a = 5; a = a++; require(a == 5); } }'))
      .toThrow('read before the increment');
  });
});

// Prefix `++lvalue` used as an EXPRESSION yields the POST-mutation value; its increment hoists BEFORE the
// enclosing statement. Byte-identical to `lvalue = lvalue + 1; <read lvalue>`. Unlike postfix it is allowed in a
// return (the increment hoists before the return); still rejected in ternary / short-circuit / loop conditions.
describe('prefix ++/-- as an expression (yields the post-mutation value)', () => {
  it('is byte-identical to `x = x + 1; <read x>` (sound by reduction)', () => {
    const sugar = compileString('contract C { function f(uint a) external pure returns (uint) {'
      + ' uint x = a; uint y = ++x; return x + y; } }', { solidityImportCompat: true });
    const hand = compileString('contract C { function f(uint a) external pure returns (uint) {'
      + ' uint x = a; x = x + 1; uint y = x; return x + y; } }', { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(hand.bytecode);
  });
  it('compiles a prefix increment as an array-assignment rvalue', () => {
    expect(compileString('contract A { function f(uint16 input) external pure returns (uint16[3] memory arr) {'
      + ' arr[0] = input; arr[1] = ++input; arr[2] = ++input; } }', { solidityImportCompat: true })
      .contractName).toBe('A');
  });
  it('allows a prefix increment in a return (hoists before)', () => {
    expect(compileString('contract C { int n; function f() external returns (int) {'
      + ' this.n = this.n + 1; return ++this.n; } }', { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('rejects a prefix increment in a ternary branch with a clear error', () => {
    expect(() => compileString('contract C { function f(bool c) external pure returns (uint) {'
      + ' uint i = 0; return c ? ++i : i; } }', { solidityImportCompat: true }))
      .toThrow('inside a ternary');
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
