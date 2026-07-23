import { describe, it, expect, vi } from 'vitest';
import { compileString } from '../src/index.js';

// Data-location parity: calldata read-only enforcement.

describe('calldata read-only enforcement (Solidity data-location parity)', () => {
  const compiles = (body: string): string => compileString(`contract C() { ${body} }`).contractName;
  const REASON = /read-only 'calldata'/;

  it('rejects a direct write to a calldata parameter', () => {
    expect(() => compiles('function f(int[] calldata x) { x[0] = 5; require(true); }')).toThrow(REASON);
  });

  it('rejects a compound write to a calldata parameter', () => {
    expect(() => compiles('function f(int[] calldata x) { x[0] += 1; require(true); }')).toThrow(REASON);
  });

  it('rejects writing a calldata array element', () => {
    expect(() => compiles('function f(int[] calldata xs) { xs[0] = 5; require(true); }')).toThrow(REASON);
  });

  it('allows a whole calldata ARRAY rebind (x = y rebinds the pointer, not a data write)', () => {
    expect(compiles('function f(uint256[] calldata x, uint256[] calldata y, uint256 i)'
      + ' external returns (uint256) { x = y; return x[i]; }')).toBe('C');
  });

  it('rejects a calldata STRUCT field write (calldata structs are read-only)', () => {
    expect(() => compiles('struct S { int a; } function f(S calldata s) { s.a = 4; require(true); }')).toThrow(REASON);
  });

  it('allows whole calldata struct, bytes, and string rebinds while retaining read-only data', () => {
    expect(compiles('struct S { int a; } function f(S calldata s, S calldata t) { s = t; require(s.a == t.a); }'))
      .toBe('C');
    expect(compiles('function f(bytes calldata x, bytes calldata y) { x = y; require(x.length == y.length); }'))
      .toBe('C');
    expect(compiles('function f(string calldata x, string calldata y) { x = y; require(x.length == y.length); }'))
      .toBe('C');
  });

  it('still rejects bytes element writes after distinguishing them from calldata rebinds', () => {
    expect(() => compiles('function f(bytes calldata x) { x[0] = 0x01; require(true); }')).toThrow(REASON);
  });

  it('allows reading a calldata parameter', () => {
    expect(compiles('function f(int[] calldata x) { require(x[0] > 0); }')).toBe('C');
  });

  it('allows copying calldata into a plain variable and mutating the copy', () => {
    expect(compiles('function f(int[] calldata x) { int[] memory y = x; y[0] = 5; require(y[0] == 5); }')).toBe('C');
  });

  it('keeps memory parameters mutable (memory is the default, not read-only)', () => {
    expect(compiles('function f(int[] memory x) { x[0] = 5; require(x[0] == 5); }')).toBe('C');
  });

  it('no longer warns that memory / calldata are no-ops', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString('contract C() { function f(bytes memory a, bytes calldata b)'
      + ' { require(b.length > 0); require(a.length > 0); } }');
    const noop = spy.mock.calls.some((c) => String(c[0]).includes('data location modifier is a no-op'));
    spy.mockRestore();
    expect(noop).toBe(false);
  });

  it('rejects data locations on value types', () => {
    expect(() => compiles('function f(int calldata x) { require(x > 0); }')).toThrow(/only valid for reference types/);
    expect(() => compiles('function f(address memory x) { require(x == x); }')).toThrow(/only valid for reference types/);
  });

  it('rejects calldata locals and constructor calldata parameters', () => {
    expect(() => compiles('function f(bytes memory x) { bytes calldata y = x; require(y.length > 0); }'))
      .toThrow(/local variables cannot have 'calldata'/);
    expect(() => compileString('contract C { constructor(bytes calldata y) {} }'))
      .toThrow(/constructor parameters cannot have 'calldata'/);
  });

  it('rejects storage on externally callable parameters and returns', () => {
    expect(() => compiles('function f(int[] storage x) external { require(x.length > 0); }'))
      .toThrow(/only valid on internal or private/);
    expect(() => compiles('function f() external returns (int[] storage) { }'))
      .toThrow(/only valid on internal or private/);
  });

  it('allows an internal calldata view return (OpenZeppelin Context._msgData shape)', () => {
    expect(compiles('function f(bytes calldata x) internal pure returns (bytes calldata) { return x; }'
      + ' function g(bytes calldata x) external { require(f(x).length == x.length); }')).toBe('C');
    expect(() => compiles('function f() external returns (bytes calldata) { }'))
      .toThrow(/only valid on internal or private/);
  });

  it('rejects duplicate/conflicting locations and mutability modifiers', () => {
    expect(() => compiles('function f(bytes memory calldata x) external { require(x.length > 0); }'))
      .toThrow(/multiple data locations/);
    expect(() => compiles('function f() external payable view { require(true); }'))
      .toThrow(/multiple state mutability modifiers/);
  });

  it('fails closed when an unsupported memory consumer would otherwise break an alias group', () => {
    expect(() => compiles('function opaque(uint[] memory x) internal returns (uint[] memory) { return x; }'
      + ' function f() external { uint[] memory a = new uint[](1); uint[] memory b = a;'
      + ' uint[] memory c = opaque(a); b[0] = 7; require(c.length == 1); }'))
      .toThrow(/cannot yet preserve Solidity aliasing/);
  });
});
