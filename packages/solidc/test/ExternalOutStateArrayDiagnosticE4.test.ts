import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const probe = (declaration: string, expression: string, params = ''): string => `
pragma solidcash >=0.8.0;
interface I { public ${declaration} values; }
contract R(bytes target) {
  function observe(${params}) public { require(${expression} >= 0); }
}`;

describe('E4 external outState collection diagnostics', () => {
  it('admits nested mapping metadata', () => {
    expect(() => compileString(probe(
      'mapping(bytes20 => mapping(bytes20 => int))',
      'I(target).outState.values[a][b]', 'bytes20 a, bytes20 b',
    ), { forceStateful: true })).not.toThrow();
  });

  it.each([
    ['dynamic array', 'int[]', 'I(target).outState.values[0]'],
    ['fixed array', 'int[2]', 'I(target).outState.values[0]'],
  ])('%s fails with a named, positioned v1 boundary', (_name, declaration, expression) => {
    let error: Error | undefined;
    try { compileString(probe(declaration, expression), { forceStateful: true }); } catch (caught) {
      error = caught as Error;
    }
    expect(error?.name).toBe('UnsupportedExternalOutStateCollectionError');
    expect(error?.message).toMatch(/External outState collection 'I\.values' .* at Line 5, Column 38/);
  });
});
