import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../src/compiler.js';

describe('compileDeclarations', () => {
  it('fully compiles only the requested concrete contracts', () => {
    const source = `
      contract Other {
        function f() {
          require(true);
        }
      }
      contract Keep {
        function g() {
          require(true);
        }
      }
    `;
    const all = compileStringMulti(source, { messageBus: false });
    expect(Object.keys(all).sort()).toEqual(['Keep', 'Other']);

    const filtered = compileStringMulti(source, {
      messageBus: false,
      compileDeclarations: ['Keep'],
    });
    expect(Object.keys(filtered)).toEqual(['Keep']);
    expect(filtered.Keep.abi.some((fn) => fn.name === 'g')).toBe(true);
  });
});
