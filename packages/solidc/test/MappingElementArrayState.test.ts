import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// A sparse entry-NFT collection (`mapping(K => V)[]`) has no length cell of its own: its key space is
// (index, mappingKey...), with no aggregate value to carry a count. These cover the synthesized length
// authority - the outer dimension a private scalar state var, the first inner dimension a chunk-packed count
// array - and the push/pop/delete/.length lowering built on it.
const stateVars = (artifact: ReturnType<typeof compileString>): string[] =>
  (artifact.stateLayout?.variables ?? []).map((v) => `${v.name}:${v.type}${v.dynamic ? '(dyn)' : ''}`);
const collectionKeys = (artifact: ReturnType<typeof compileString>): string[] =>
  (artifact.stateLayout?.collections ?? []).map((c) => {
    const keys = (c.keyTypes ?? (c.keyType ? [c.keyType] : [])).join('|');
    return `${c.name}:${c.kind}:${keys}`;
  });

const ONE_DIMENSION = 'contract C {\n'
  + '    mapping (uint => uint)[] a;\n'
  + '    function n1(uint key, uint value) public { a.push(); a[a.length - 1][key] = value; }\n'
  + '    function p() public { a.pop(); }\n'
  + '    function d() public returns (uint) { delete a; return a.length; }\n'
  + '}';

describe('mapping-element state arrays', () => {
  it('lowers push, pop, whole delete and .length and records one length authority', () => {
    const artifact = compileString(ONE_DIMENSION, { evmCompat: true });
    expect(artifact.contractName).toBe('C');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
    // The element key space is unchanged (index, mapping key); the outer count is the only new state.
    expect(stateVars(artifact)).toEqual(['a$len:bigint']);
    expect(collectionKeys(artifact)).toEqual(['a:array:bigint|uint256']);
  });

  it('gives each inner dimension its own count', () => {
    const artifact = compileString(
      'contract C {\n'
      + '    mapping (uint => uint)[][] a;\n'
      + '    function n1(uint key, uint value) public {\n'
      + '        a.push();\n'
      + '        mapping (uint => uint)[] storage b = a[a.length - 1];\n'
      + '        b.push();\n'
      + '        b[b.length - 1][key] = value;\n'
      + '    }\n'
      + '    function p() public { a.pop(); }\n'
      + '    function d() public returns (uint) { delete a; return a.length; }\n'
      + '}',
      { evmCompat: true },
    );
    expect(artifact.contractName).toBe('C');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
    expect(stateVars(artifact)).toEqual(['a$len:bigint', 'a$len$1:bigint[](dyn)']);
    expect(collectionKeys(artifact)).toEqual(['a:array:bigint|bigint|uint256']);
  });

  it('compiles a struct-valued mapping element array (unbounded and bounded)', () => {
    const artifact = compileString(
      'contract C {\n'
      + '    struct Y { uint a; uint b; }\n'
      + '    mapping(uint256 => Y)[] public m;\n'
      + '    mapping(uint256 => Y)[3] public n;\n'
      + '    constructor() {\n'
      + '        m.push();\n'
      + '        m.push();\n'
      + '        m[1][0].a = 1;\n'
      + '        m[1][0].b = 2;\n'
      + '        n[1][0].a = 7;\n'
      + '    }\n'
      + '}',
      { evmCompat: true },
    );
    expect(artifact.contractName).toBe('C');
    // Only the unbounded array gets an authority; the bounded `n` folds `.length` to its bound.
    expect(stateVars(artifact)).toEqual(['m$len:bigint']);
  });

  it('refuses push(value) on an array whose element is a mapping', () => {
    expect(() => compileString(
      'contract C {\n'
      + '    mapping(uint=>uint)[] array;\n'
      + '    mapping(uint=>uint) map;\n'
      + '    function f() public { array.push(); array.push(map); }\n'
      + '}',
      { evmCompat: true },
    )).toThrow(/nested mappings do not support/);
  });

  it('keeps the full key space for an array of mappings nested under a mapping key', () => {
    const artifact = compileString(
      'contract C {\n'
      + '    mapping(uint => mapping(uint => uint)[]) public m;\n'
      + '    function f() public { m[1][0][1] = 2; }\n'
      + '}',
      { evmCompat: true },
    );
    expect(artifact.contractName).toBe('C');
    // The array under the mapping key counts per mapping key in its own companion mapping.
    expect(collectionKeys(artifact)).toEqual(['m:mapping:uint256|bigint|uint256', 'm$len:mapping:uint256']);
  });
});
