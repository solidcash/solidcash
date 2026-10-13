import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// A storage-reference parameter (`T[] storage p`, `mapping(...) storage p`) has no stack value: it names the
// caller's container at a key prefix. Binding it must carry that prefix into every statement that names the
// pointer - the keyed write, push, pop, delete and `.length` - or the statement resolves against the wrong key
// path (or nothing at all).
const bytecode = (source: string): string => compileString(source, { evmCompat: true }).bytecode;

describe('storage-pointer parameter binding', () => {
  it('writes through an inherited constructor pointer at the caller key prefix', () => {
    // The base constructor writes `p[0][1]`; bound to `m[1]`, that is `m[1][0][1]`. The parameter is named
    // differently from the state variable so a name coincidence cannot stand in for the binding.
    const direct = bytecode(
      'contract C {\n'
      + '    mapping(uint => mapping(uint => uint)[]) public m;\n'
      + '    constructor() { m[1][0][1] = 2; }\n'
      + '}',
    );
    const bound = bytecode(
      'abstract contract A {\n'
      + '    constructor (mapping(uint => uint)[] storage p) { p[0][1] = 2; }\n'
      + '}\n'
      + 'contract C is A {\n'
      + '    mapping(uint => mapping(uint => uint)[]) public m;\n'
      + '    constructor() A(m[1]) {}\n'
      + '}',
    );
    expect(bound).toBe(direct);
  });

  it('pushes, reads .length and writes element 0 of an array reached through an inherited pointer', () => {
    const artifact = compileString(
      'abstract contract A {\n'
      + '    constructor (mapping(uint => uint)[] storage p) {\n'
      + '        p.push();\n'
      + '        uint n = p.length;\n'
      + '        p[0][1] = 2;\n'
      + '    }\n'
      + '}\n'
      + 'contract C is A {\n'
      + '    mapping(uint => mapping(uint => uint)[]) public m;\n'
      + '    constructor() A(m[1]) {}\n'
      + '}',
      { evmCompat: true },
    );
    expect(artifact.contractName).toBe('C');
    // The array under the mapping key counts per mapping key.
    expect((artifact.stateLayout?.collections ?? []).map((collection) => collection.name)).toContain('m$len');
  });

  it('inlines a helper that pushes and writes through an array storage pointer into the same code', () => {
    const direct = bytecode(
      'contract C {\n'
      + '    mapping(uint=>uint)[] a;\n'
      + '    function g() public { a.push(); a[a.length - 1][42] = 7; }\n'
      + '}',
    );
    const inlined = bytecode(
      'contract C {\n'
      + '    mapping(uint=>uint)[] a;\n'
      + '    function f(mapping(uint=>uint)[] storage p) internal { p.push(); p[p.length - 1][42] = 7; }\n'
      + '    function g() public { f(a); }\n'
      + '}',
    );
    expect(inlined).toBe(direct);
  });

  it('refuses push(value) through a pointer to an array whose element is a mapping', () => {
    expect(() => compileString(
      'abstract contract A {\n'
      + '    constructor (mapping(uint => uint)[] storage p) { p.push(); }\n'
      + '}\n'
      + 'contract C is A {\n'
      + '    mapping(uint => mapping(uint => uint)[]) public m;\n'
      + '    mapping(uint => uint) map;\n'
      + '    constructor() A(m[1]) {}\n'
      + '}',
      { evmCompat: true },
    )).not.toThrow();
    expect(() => compileString(
      'contract C {\n'
      + '    mapping(uint=>uint)[] a;\n'
      + '    mapping(uint=>uint) map;\n'
      + '    function f(mapping(uint=>uint)[] storage p) internal { p.push(map); }\n'
      + '    function g() public { f(a); }\n'
      + '}',
      { evmCompat: true },
    )).toThrow(/nested mappings do not support/);
  });
});
