import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// ABI encode / decode.

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

describe('tuple destructuring with array-typed slots', () => {
  it('accepts array types in destructuring slots ((uint[] memory a, uint[] memory b) = ...)', () => {
    expect(compileString('contract C() { function f(bytes memory x) {'
      + ' (uint256[] memory a, uint256[] memory b) = abi.decode(x, (uint256[], uint256[])); require(a.length + b.length >= 0); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});
