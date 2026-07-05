import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Arrays: return types, state-array push/pop, tuple / fixed-array assignment.

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
