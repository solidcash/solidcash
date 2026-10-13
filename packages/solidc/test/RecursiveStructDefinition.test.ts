import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// solc refuses a struct that contains itself by value (TypeError 2046), directly or through fixed-size arrays and
// other structs; a dynamic array or a mapping ends the chain and is allowed.
const compile = (structs: string, fileLevel = ''): unknown => compileString(`
pragma solidity ^0.8.0;
${fileLevel}
contract C {
    ${structs}
    function f() public pure returns (uint256) { return 1; }
}`, { evmCompat: true });

describe('recursive struct definitions', () => {
  it.each([
    ['directly', 'struct S { uint256 a; S s; }', ''],
    ['through a fixed-size array', 'struct S { uint256 a; S[2] s; }', ''],
    ['through another struct', 'struct A { B b; } struct B { uint256 x; A[1][1] a; }', ''],
    ['at file level', '', 'struct S { uint256 a; S s; }'],
  ])('refuses one that contains itself %s', (_shape, structs, fileLevel) => {
    expect(() => compile(structs, fileLevel)).toThrow('Recursive struct definition');
  });

  it.each([
    ['through a dynamic array', 'struct S { uint256 a; S[] children; }'],
    ['through a mapping', 'struct S { uint256 a; mapping(uint256 => S) next; }'],
    ['when two structs share a third', 'struct Leaf { uint256 v; } struct A { Leaf l; } struct B { Leaf l; A a; }'],
  ])('accepts one that reaches itself only %s', (_shape, structs) => {
    expect(() => compile(structs)).not.toThrow('Recursive struct definition');
  });
});
