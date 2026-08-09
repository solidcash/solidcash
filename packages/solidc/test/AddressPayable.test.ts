import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

const compile = (body: string): ReturnType<typeof compileString> =>
  compileString(`contract C { ${body} }`, { solidityImportCompat: true });

describe('address payable Solidity parity', () => {
  it('tracks the pre-0.8 payable global-address types per source pragma', () => {
    expect(() => compileString('pragma solidity 0.6.12; contract C {'
      + ' function f() public view returns (address payable) { return msg.sender; }'
      + ' function g() public view returns (address payable) { return tx.origin; } }',
    { solidityImportCompat: true })).not.toThrow();
    expect(() => compileString('pragma solidity >=0.6.0 <0.8.0; contract C {'
      + ' function f() public view returns (address payable) { return msg.sender; } }',
    { solidityImportCompat: true })).not.toThrow();
    expect(() => compileString('pragma solidity ^0.8.0; contract C {'
      + ' function f() public view returns (address payable) { return msg.sender; } }',
    { solidityImportCompat: true })).toThrow();
  });

  it('allows payable to plain address, but requires an explicit conversion in the other direction', () => {
    expect(() => compile('function f(address payable p) public pure returns (address) { return p; }')).not.toThrow();
    expect(() => compile('function f(address p) public pure returns (address payable) { return p; }')).toThrow();
    expect(() => compile('function f(address p) public pure returns (address payable) { return payable(p); }'))
      .not.toThrow();
  });

  it('does not propagate scalar payability conversion through arrays', () => {
    expect(() => compile('function f(address payable[] memory p) public pure returns (address[] memory) {'
      + ' address[] memory a = p; return a; }')).toThrow();
    expect(() => compile('function f(address[] memory p) public pure returns (address payable[] memory) {'
      + ' address payable[] memory a = p; return a; }')).toThrow();
  });

  it('uses address as the canonical ABI type and selector type', () => {
    const artifact = compile('function f(address payable p) external pure returns (address payable) { return p; }');
    const fn = artifact.abi.find((entry) => entry.name === 'f')!;
    expect(fn.inputs[0].type).toBe('address');
    expect(fn.outputs?.[0].type).toBe('address');
    expect(() => compile('function f(address a) external pure {} function f(address payable a) external pure {}'))
      .toThrow();
  });

  it('requires address conversion before payable for bytes20 values', () => {
    expect(() => compile('function f(bytes20 b) external pure returns (address payable) { return payable(b); }'))
      .toThrow();
    expect(() => compile('function f(bytes20 b) external pure returns (address payable) {'
      + ' return payable(address(b)); }')).not.toThrow();
  });
});
