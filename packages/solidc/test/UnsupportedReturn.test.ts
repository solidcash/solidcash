import { describe, expect, it } from 'vitest';
import { UnsupportedReturnError } from '../src/Errors.js';
import { compileString } from './direct-compile.js';

/**
 * Returns no lowering can end a path at are refused by name. Code generation emits no jump for a return, so one
 * that is not lowered lets the statements after it run: these shapes compiled before and ignored the return.
 */
const SOL = 'pragma solidity ^0.8.0;';
const compile = (source: string): unknown => compileString(source, { solidityImportCompat: true, forceStateful: true });

describe('a return no lowering can end a path at', () => {
  it('refuses a return in an unchecked block inside a loop, which the loop lowering does not reach', () => {
    const source = `${SOL} contract C { uint256 public x; function f(uint256 k) public {
      for (uint256 i = 0; i < 3; i++) { unchecked { if (i == k) return; } x = x + 1; } x = x + 100; } }`;
    expect(() => compile(source)).toThrow(UnsupportedReturnError);
    expect(() => compile(source)).toThrow('Unsupported return: a return inside this loop cannot leave it');
  });

  it('refuses a return inside a collection iteration', () => {
    const source = `pragma solidcash >=0.8.0; contract C() { int total; enumerable mapping(bytes20 => int) balances;
      function f(int cap) { int sum = 0; for (int value of this.balances) { if (value > cap) { return; } sum = sum + value; }
        this.total = sum; } }`;
    expect(() => compileString(source)).toThrow('Unsupported return: a return inside this loop cannot leave it');
  });

  it('refuses a return in an unchecked block inside a loop of a body a modifier runs code after', () => {
    const source = `${SOL} contract C { uint256 public x; modifier m() { _; x = x + 5; }
      function f(uint256 k) public m { for (uint256 i = 0; i < 3; i++) { unchecked { if (i == k) return; } x = x + 1; } } }`;
    expect(() => compile(source)).toThrow(
      'Unsupported return: a return inside an unchecked block, a try or a switch in a loop cannot leave the loop',
    );
  });

  it('refuses an assembly return of raw bytes that statements would still run after', () => {
    // A word is a value of the function's result, kept for its end like any return's; raw bytes are not.
    const source = `${SOL} contract C { uint256 public x; function f(uint256 n, uint256 c) public returns (uint256) {
      assembly { if c { return(0, n) } } x = 1; return 5; } }`;
    expect(() => compile(source)).toThrow(UnsupportedReturnError);
    expect(() => compile(source)).toThrow(
      "Unsupported return: statements of 'f' after this assembly return would still run",
    );
  });

  it('refuses an assembly return inside a loop', () => {
    const source = `${SOL} contract C { uint256 public x; function f(uint256 n) public returns (uint256) {
      assembly { for { let i := 0 } lt(i, n) { i := add(i, 1) } { if eq(i, 3) { mstore(0, i) return(0, 32) } } }
      x = 1; return 5; } }`;
    expect(() => compile(source)).toThrow("Unsupported return: statements of 'f' after this return would still run");
  });

  it('refuses stop() where statements of a function with results would run after it', () => {
    // stop() halts with no data, which is no value of the results: it ends the function only at its tail.
    const source = `${SOL} contract C { uint256 public x; function f(uint256 c) public returns (uint256) {
      assembly { if c { stop() } } x = 3; return 7; } }`;
    expect(() => compile(source)).toThrow(
      "Unsupported return: statements of 'f' after this assembly return would still run",
    );
  });

  it('refuses a call to a function holding an assembly return, which would only return to its caller', () => {
    // The return halts the whole call on the EVM. A void helper is inlined, so its return is its caller's; this
    // one returns a value, and the call stays a call.
    const source = `${SOL} contract C { uint256 public x;
      function halts(uint256 a) public returns (uint256) { assembly { mstore(0, a) return(0, 32) } }
      function outer(uint256 a) public returns (uint256) { uint256 v = halts(a); x = v; return v + 1; } }`;
    expect(() => compile(source)).toThrow(UnsupportedReturnError);
    expect(() => compile(source)).toThrow("Unsupported return: statements of 'outer' after this call would still run: "
      + "the assembly return in 'halts' halts the whole call, not only 'halts'");
  });

  it('refuses a function holding an assembly return as a function value', () => {
    const source = `${SOL} contract C { uint256 public x;
      function h(uint256 c) internal returns (uint256) { assembly { if c { mstore(0, 9) return(0, 32) } } return 1; }
      function f(uint256 c) public returns (uint256) {
        function (uint256) internal returns (uint256) p = h; uint256 v = p(c); x = v; return v + 1; } }`;
    expect(() => compile(source)).toThrow('Unsupported return: statements after a call through this function value '
      + "would still run: the assembly return in 'h' halts the whole call, not only 'h'");
  });
});
