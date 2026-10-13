import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// solc TypeError 7676: the state variables' storage size upper bound may not reach 2^256 slots.
const compile = (source: string): unknown => compileString(`pragma solidity ^0.8.0;\n${source}`, { evmCompat: true });

describe('contract storage size', () => {
  it.each([
    ['two halves of the slot space', 'contract C { uint256[2**255] a; uint256[2**255] b; }'],
    ['a nested static array', 'contract C { uint256[2**255][2] a; }'],
    ['a struct of two halves', 'contract C { struct S { uint256[2**255] a; uint256[2**255] b; } S s; }'],
    ['halves split across a base', 'contract B { uint256[2**255] a; } contract C is B { uint256[2**255] b; }'],
  ])('refuses %s', (_shape, source) => {
    expect(() => compile(source)).toThrow('Contract requires too much storage');
  });

  it('accepts the largest array, whose length a double would round up', () => {
    expect(() => compile('contract C { uint256[2**256 - 1] x; }')).not.toThrow('Contract requires too much storage');
  });

  it('accepts half the slot space beside mappings and dynamic arrays', () => {
    expect(() => compile(`contract C {
    uint256[2**255] a;
    mapping(uint256 => uint256) m;
    uint256[] d;
    function f() public view returns (uint256) { return m[1] + d.length; }
}`)).not.toThrow('Contract requires too much storage');
  });
});
