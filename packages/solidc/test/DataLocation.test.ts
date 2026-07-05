import { describe, it, expect, vi } from 'vitest';
import { compileString } from '../src/index.js';

// Data-location parity: calldata read-only enforcement.

describe('calldata read-only enforcement (Solidity data-location parity)', () => {
  const compiles = (body: string): string => compileString(`contract C() { ${body} }`).contractName;
  const REASON = /read-only 'calldata'/;

  it('rejects a direct write to a calldata parameter', () => {
    expect(() => compiles('function f(int calldata x) { x = 5; require(true); }')).toThrow(REASON);
  });

  it('rejects a compound write to a calldata parameter', () => {
    expect(() => compiles('function f(int calldata x) { x += 1; require(true); }')).toThrow(REASON);
  });

  it('rejects writing a calldata array element', () => {
    expect(() => compiles('function f(int[] calldata xs) { xs[0] = 5; require(true); }')).toThrow(REASON);
  });

  it('allows reading a calldata parameter', () => {
    expect(compiles('function f(int calldata x) { require(x > 0); }')).toBe('C');
  });

  it('allows copying calldata into a plain variable and mutating the copy', () => {
    expect(compiles('function f(int calldata x) { int y = x; y = 5; require(y == 5); }')).toBe('C');
  });

  it('keeps memory parameters mutable (memory is the default, not read-only)', () => {
    expect(compiles('function f(int memory x) { x = 5; require(x == 5); }')).toBe('C');
  });

  it('no longer warns that memory / calldata are no-ops', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString('contract C() { function f(bytes memory a, int calldata b)'
      + ' { require(b > 0); require(a.length > 0); } }');
    const noop = spy.mock.calls.some((c) => String(c[0]).includes('data location modifier is a no-op'));
    spy.mockRestore();
    expect(noop).toBe(false);
  });
});
