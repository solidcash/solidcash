import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// Inline initializers of array state variables lower into the constructor, ahead of its body, for every storage
// model. An entry-collection array takes an array literal or `new T[](n)`; any other initializer is refused.
const hasConstructor = (artifact: ReturnType<typeof compileString>): boolean =>
  artifact.abi.some((entry) => entry.name === '__construct');

describe('array state variable initializers', () => {
  it('lower packed and chunk-packed initializers into a constructor', () => {
    for (const decl of ['uint[] a = [uint(1), 2];', 'uint[] a = new uint[](3);', 'uint[2] a = [uint(1), 2];']) {
      const artifact = compileString(
        `contract C {\n  ${decl}\n  function f(uint e) public { require(a[1] == e); }\n}`, { evmCompat: true },
      );
      expect(hasConstructor(artifact), decl).toBe(true);
    }
  });

  it('writes an entry-collection literal element by element', () => {
    const artifact = compileString('contract C {\n  uint[3] b = [uint(4), 5, 6];\n'
      + '  function f(uint e) { require(b[2] == e); }\n}');
    expect(hasConstructor(artifact)).toBe(true);
  });

  it('refuses an entry-collection initializer it cannot express', () => {
    expect(() => compileString('contract C {\n  uint[3] c;\n  uint[3] b = c;\n'
      + '  function f(uint e) { require(b[2] == e); }\n}'))
      .toThrow(/Initializer of array state variable 'b' is not supported by its entry-collection storage/);
  });
});
