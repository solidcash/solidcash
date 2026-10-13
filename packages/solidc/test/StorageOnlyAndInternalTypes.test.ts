import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

const compile = (source: string): unknown => compileString(`pragma solidity ^0.8.0;\n${source}`, { evmCompat: true });

// solc TypeError 4061: a struct holding a (nested) mapping only lives in storage.
describe('mapping-holding structs outside storage', () => {
  it('refuses a memory local whose struct holds a mapping', () => {
    expect(() => compile(`contract C {
    struct S { uint8 a; mapping(uint256 => uint256) b; }
    S s;
    function f() public { S memory x; }
}`)).toThrow("mapping-containing locals must have 'storage' location");
  });

  it('refuses one whose mapping sits behind recursive struct arrays', () => {
    expect(() => compile(`contract C {
    struct S { T[] t; }
    struct T { U[] u; }
    struct U { S[] s; mapping(uint256 => S) m; }
    function f() public { S memory x; }
}`)).toThrow("mapping-containing locals must have 'storage' location");
  });

  it('accepts a storage pointer to such a struct', () => {
    expect(() => compile(`contract C {
    struct S { uint256 a; mapping(uint256 => uint256) b; }
    S s;
    function f() public view returns (uint256) { S storage x = s; return x.a; }
}`)).not.toThrow();
  });
});

// solc TypeError 4103: a public or external library function cannot take or return an internal function.
describe('internal function types in public library functions', () => {
  it.each([
    ['a memory array', 'function f(function(uint256) internal returns (uint256)[] memory x) public {}'],
    ['a storage array', 'function f(function(uint256) internal returns (uint256)[] storage x) public {}'],
    ['a struct field', 'struct S { function() internal g; } function f(S storage s) public {}'],
  ])('refuses one inside %s', (_shape, members) => {
    expect(() => compile(`library L { ${members} }`)).toThrow('Internal type is not allowed for public or external');
  });

  it('accepts an internal library function and a public one over a struct with mappings', () => {
    expect(() => compile(`library L {
    struct M { address[] keys; mapping(address => uint256) values; }
    function apply(function(uint256) internal pure returns (uint256) g, uint256 x) internal pure returns (uint256) {
        return g(x);
    }
    function get(M storage m, address k) public view returns (uint256) { return m.values[k]; }
}`)).not.toThrow('Internal type is not allowed');
  });
});
