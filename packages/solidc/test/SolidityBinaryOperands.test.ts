import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// solc TypeError 2271 in a `.sol` unit: reference values of one kind do not compare, a shift amount is unsigned and
// literal arithmetic is exact within 4096 bits. Native SolidCash sources keep their wider operators.
const sol = (body: string): unknown => compileString(`pragma solidity ^0.8.0;
contract C {
    struct S { uint256 a; }
    bytes b1;
    bytes b2;
    S s1;
    S s2;
    ${body}
}`, { evmCompat: true, rootFileId: '/main.sol' });

describe('binary operands in a .sol unit', () => {
  it.each([
    ['bytes compared with ==', 'function f() public view returns (bool) { return b1 == b2; }', 'bytes and bytes.'],
    ['bytes compared with !=', 'function f() public view returns (bool) { return b1 != b2; }', 'bytes and bytes.'],
    ['structs compared with ==', 'function f() public view returns (bool) { return s1 == s2; }', 'cannot be applied'],
    ['a signed shift amount', 'function f(int256 a, int256 n) public pure returns (int256) { return a >> n; }',
      'int256 and int256.'],
    ['a fractional literal exponent', 'function f() public pure returns (uint256) { return 2 ** (1 / 2); }',
      'cannot be applied'],
    ['a fractional exponent on a variable', 'function f(int256 a) public pure returns (int256) { return a ** (1 / 2); }',
      'Exponent is fractional.'],
    ['an exponent past 256 bits', 'function f(int256 a) public pure returns (int256) { return a ** 1E100; }',
      'Exponent too large.'],
    ['a literal past 4096 bits', 'function f() public pure returns (int256) { return (1 << 4095) * (1 << 4095); }',
      'Precision of rational constants is limited to 4096 bits.'],
  ])('refuses %s', (_shape, body, message) => {
    expect(() => sol(body)).toThrow(message);
  });

  it('accepts what Solidity defines', () => {
    expect(() => sol(`function f(bytes32 h, address a, uint8 x, uint256 y) public view returns (bool) {
        return h == keccak256(b1) && a == msg.sender && (x << 2) > 0 && (y >> x) > 0 && 2 ** 255 > 0;
    }`)).not.toThrow();
  });

  it('keeps native bytes equality and signed shift amounts', () => {
    expect(() => compileString(`contract N() {
    function f(bytes a, bytes b, int n) { require(a == b); require((int(1) << n) > 0); }
}`)).not.toThrow();
  });
});
