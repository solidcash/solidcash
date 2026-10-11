import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// A struct field that is itself a struct holding an array has no in-place element write, at any depth: the
// array element is written through a read-modify-rebuild of the whole struct (`S __t = data; __t.d.y[i] = v;
// data = __t;`). Before this, only a ONE-level chain was handled, so `data.d.y[i] = v` fell through to the
// mapping path and failed with `UndefinedCollectionError: Undefined mapping 'data'`.
const nestedState = (body: string): string =>
  'contract C {\n'
  + '    struct R { uint[3] y; }\n'
  + '    struct S { uint a; R d; }\n'
  + '    S data;\n'
  + `    function f() public { ${body} }\n`
  + '}';

describe('array element write behind a nested struct field', () => {
  it('writes through a state struct var and keeps the struct as a single state element', () => {
    const artifact = compileString(nestedState('data.d.y[1] = 3;'));
    expect(artifact.contractName).toBe('C');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
    expect((artifact.stateLayout?.variables ?? []).map((variable) => `${variable.name}:${variable.type}`))
      .toEqual(['data:S']);
  });

  it('writes through a whole-var storage pointer to that state struct', () => {
    const artifact = compileString(nestedState('C.S storage x = data; x.d.y[1] = 3;'));
    expect(artifact.contractName).toBe('C');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('writes through a local struct var', () => {
    const artifact = compileString(
      'contract C {\n'
      + '    struct R { uint[3] y; }\n'
      + '    struct S { uint a; R d; }\n'
      + '    function f() public { S memory s; s.d.y[1] = 3; }\n'
      + '}',
    );
    expect(artifact.contractName).toBe('C');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('writes a nested array element on a flattened multi-index chain', () => {
    // Three indices on a fixed nested array field (`x.c[1][2][3]`), reached through a storage pointer.
    const artifact = compileString(
      'contract C {\n'
      + '    struct S { uint[3][3] c; }\n'
      + '    S data;\n'
      + '    function f() public { C.S storage x = data; x.c[1][2] = 9; }\n'
      + '}',
    );
    expect(artifact.contractName).toBe('C');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });
});
