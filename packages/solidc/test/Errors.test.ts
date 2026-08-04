import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// Custom errors and revert (qualified/named-arg, unnamed params).

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

// Custom error parameters may be unnamed in Solidity (`error Bad(uint256)`), like event params.
describe('unnamed custom error parameters', () => {
  it('compiles `error Bad(uint256)` and reverts with it', () => {
    const a = compileString(
      'contract C { error Bad(uint256); function f(uint256 x) public pure { if (x == 0) revert Bad(x); require(true); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });

  it('accepts array-typed error parameters (named and unnamed)', () => {
    expect(compileString('contract C { error E(uint[] a, uint[1] b); function f() { require(false); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString('contract C { error E(uint[], uint[1]); function f() { require(false); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});
