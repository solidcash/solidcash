import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// solc's implicit-conversion rules (TypeError 9574 / 7407 / 9553) for what a `.sol` unit writes, where native
// SolidCash is wider. Messages are solc's.
const sol = (body: string, rootFileId = '/main.sol'): unknown => compileString(`pragma solidity ^0.8.0;
contract C {
    ${body}
}`, { evmCompat: true, rootFileId });

describe('implicit conversions in a .sol unit', () => {
  it.each([
    ['a dynamic storage array into a static one', 'uint256[10] a; uint256[] b; function f() external { a = b; }',
      'Type uint256[] storage ref is not implicitly convertible to expected type uint256[10] storage ref.'],
    ['a longer static storage array into a shorter one',
      'uint256[10] a; uint256[18] b; function f() external { a = b; }',
      'Type uint256[18] storage ref is not implicitly convertible to expected type uint256[10] storage ref.'],
    ['a memory array of another base type', 'function f(uint8[] memory x) public pure { uint256[] memory y = x; }',
      'Type uint8[] memory is not implicitly convertible to expected type uint256[] memory.'],
    ['a memory array assigned across base types',
      'function f(uint8[] memory x) public pure { uint256[] memory y; y = x; }',
      'Type uint8[] memory is not implicitly convertible to expected type uint256[] memory.'],
    ['a memory array to a storage pointer parameter',
      'function f(uint[] storage x) private {} function g(uint[] memory x) public { f(x); }',
      'Invalid implicit conversion from uint256[] memory to uint256[] storage pointer requested.'],
    ['a string literal to a calldata parameter',
      'function g(string calldata s) public {} function f() public { g("hello"); }',
      'Invalid implicit conversion from literal_string "hello" to string calldata requested.'],
    ['a hex literal to a calldata parameter',
      'function h(bytes calldata b) public {} function f() public { h(hex"01ff"); }',
      'Invalid implicit conversion from literal_string hex"01ff" to bytes calldata requested.'],
    ['a fractional literal to addmod', 'uint constant a = addmod(3, 4, 0.1);',
      'Invalid implicit conversion from rational_const 1 / 10 to uint256 requested.'],
    ['a fractional literal quotient', 'function f() public pure returns (uint) { uint x = 1 / 10; return x; }',
      'Type rational_const 1 / 10 is not implicitly convertible to expected type uint256.'],
    ['a literal past uint256', 'function f() public pure returns (uint) { uint x = 2**256; return x; }',
      'Type int_const 1157...(70 digits omitted)...9936 is not implicitly convertible to expected type uint256. '
        + 'Literal is too large to fit in uint256.'],
    ['a negative literal to an unsigned type',
      'function f() public pure returns (uint) { uint x; x = 2 - 3; return x; }',
      'Cannot implicitly convert signed literal to unsigned type.'],
    ['a function array literal of another mutability',
      'function v() internal view returns (uint) { return 1; }\n'
        + 'function f() public returns (uint) { function () internal returns (uint)[1] memory a; a = [v]; '
        + 'return a[0](); }',
      'Type function () view returns (uint256)[1] memory is not implicitly convertible to expected type '
        + 'function () returns (uint256)[1] memory.'],
  ])('refuses %s', (_shape, body, message) => {
    expect(() => sol(body)).toThrow(message);
  });

  it.each([
    ['a shorter static storage array into a longer one',
      'uint256[10] a; uint256[5] b; function f() external { a = b; }'],
    ['a memory array of the same type', 'function f(uint8[] memory x) public pure returns (uint256) '
      + '{ uint8[] memory y = x; return y.length; }'],
    ['a storage array to a storage pointer parameter', 'uint[] s; function f(uint[] storage x) internal view '
      + 'returns (uint) { return x.length; } function g() public view returns (uint) { return f(s); }'],
    ['a string literal to a memory parameter',
      'function g(string memory s) public pure {} function f() public pure { g("hello"); }'],
    ['integral literals to addmod and mulmod', 'uint constant a = addmod(3, 4, 5); uint constant b = mulmod(3, 4, 5);'],
    ['literal arithmetic that fits',
      'function f() public pure returns (uint, int8) { uint x = 10 * 10 - 1; int8 y = 100 + 27; return (x, y); }'],
    ['a function array literal of the same mutability',
      'function v() internal view returns (uint) { return 1; }\n'
        + 'function f() public view returns (uint) { function () internal view returns (uint)[1] memory a; a = [v]; '
        + 'return a[0](); }'],
  ])('accepts %s', (_shape, body) => {
    expect(() => sol(body)).not.toThrow();
  });

  it('keeps native conversions outside .sol units', () => {
    expect(() => sol('uint256[10] a; uint256[18] b; function f() external { a = b; }', '/main.scash'))
      .not.toThrow();
    expect(() => compileString('pragma solidcash ^0.14.0;\n'
      + 'contract C { function f() { uint8 x = 200 + 100; require(x == 300); } }')).not.toThrow();
  });
});
