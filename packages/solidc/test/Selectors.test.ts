import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// Function selectors (`.selector` -> bytes4).

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
  it('resolves a contract/interface-typed VARIABLE method selector (v.method.selector)', () => {
    expect(compileString(
      'interface IFoo { function bar(address a) external returns (bool); }'
      + ' contract C { IFoo t; function f() external returns (bytes4) { return t.bar.selector; } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('resolves a bare own/inherited function selector (fn.selector)', () => {
    expect(compileString(
      'contract B { function ext(uint256 x) external {} } contract C is B {'
      + ' function f() external returns (bytes4) { return ext.selector; } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('abi.encodeCall(this.method, (args)) targets a current-contract function', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves this.method with a multi-arg tuple', () => {
    expect(cc('contract C { function g(uint256 a, uint256 b) external {}'
      + ' function f() external pure returns (bytes memory) { return abi.encodeCall(this.g, (1, 2)); } }')).toBe('C');
  });
  it('resolves this.method with an empty tuple', () => {
    expect(cc('contract C { function g() external {}'
      + ' function f() external pure returns (bytes memory) { return abi.encodeCall(this.g, ()); } }')).toBe('C');
  });
  it('accepts a scalar expression as a unitary argument tuple', () => {
    expect(cc('contract C { function g(uint256 x) external {}'
      + ' function f(bool b) external pure returns (bytes memory) {'
      + ' return abi.encodeCall(this.g, b ? 1 : 2); } }')).toBe('C');
  });
  it('still resolves an interface target (Interface.method)', () => {
    expect(cc('interface IFoo { function bar(address a, uint256 b) external; }'
      + ' contract C { function f(address to, uint256 amt) external pure returns (bytes memory) {'
      + ' return abi.encodeCall(IFoo.bar, (to, amt)); } }')).toBe('C');
  });
  it('rejects an undefined this.method', () => {
    expect(() => cc('contract C { function g() external {}'
      + ' function f() external pure returns (bytes memory) { return abi.encodeCall(this.nope, ()); } }'))
      .toThrow(/not found/);
  });
});
