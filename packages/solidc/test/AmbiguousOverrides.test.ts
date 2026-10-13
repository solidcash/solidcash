import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// solc TypeError 6480 in a `.sol` unit: a contract inheriting two or more definitions of one signature must override.
const sol = (source: string): unknown => compileString(`pragma solidity ^0.8.0;\n${source}`,
  { evmCompat: true, rootFileId: '/main.sol' });

const TRIANGLE = `contract A { function f() public pure virtual returns (uint256) { return 1; } }
contract B is A { function f() public pure virtual override returns (uint256) { return 2; } }
contract C is A, B { function g() public pure returns (uint256) { return 3; } }`;

describe('ambiguous inherited functions', () => {
  it.each([
    ['a base listed beside a contract that overrides it', TRIANGLE],
    ['an interface function beside a public state variable', `interface I { function foo() external returns (uint256); }
contract B { uint256 public foo; }
contract X is I, B { function g() public pure returns (uint256) { return 3; } }`],
    ['two interfaces declaring one function', `interface P { function t() external returns (uint256); }
interface Q { function t() external returns (uint256); }
abstract contract C is P, Q { function g() public pure returns (uint256) { return 3; } }`],
  ])('refuses %s', (_shape, source) => {
    expect(() => sol(source)).toThrow('Derived contract must override function');
  });

  it.each([
    ['an interface beside its implementation', `interface I { function foo() external view returns (uint256); }
contract Impl is I { function foo() public view virtual returns (uint256) { return 1; } }
contract C is I, Impl { function g() public pure returns (uint256) { return 3; } }`],
    ['an explicit override of both bases', `contract A { function f() public pure virtual returns (uint256) { return 1; } }
contract B is A { function f() public pure virtual override returns (uint256) { return 2; } }
contract C is A, B { function f() public pure override(A, B) returns (uint256) { return 3; } }`],
    ['a single path through an override', `contract A { function f() public pure virtual returns (uint256) { return 1; } }
contract B is A { function f() public pure virtual override returns (uint256) { return 2; } }
contract C is B { function g() public pure returns (uint256) { return 3; } }`],
  ])('accepts %s', (_shape, source) => {
    expect(() => sol(source)).not.toThrow('Derived contract must override function');
  });

  it('leaves native sources to the C3 order', () => {
    expect(() => compileString(TRIANGLE, { evmCompat: true })).not.toThrow('Derived contract must override function');
  });
});
