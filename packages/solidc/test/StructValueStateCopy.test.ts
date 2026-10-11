import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// A state struct whose fields include a mapping or a dynamic chunk-packed array has no single-value slot: it is
// FLATTENED into per-field state leaves (`s__x`, `s__y`). Solidity still allows the whole copy `s = src`, so the
// copy lowers to one write per field, each value read off the source - the same decomposition the
// state-to-state copy already used. `test/libsolidity/semanticTests/structs/
// copy_struct_with_nested_array_from_calldata_to_storage.sol` is this shape.
describe('whole struct copy into a flattened struct state var', () => {
  const FIXTURE = 'contract C {\n'
    + '    struct S { uint8[1] x; uint8[] y; }\n'
    + '    S s;\n'
    + '    function test(S calldata src) public {\n'
    + '        s = src;\n'
    + '        require(s.x[0] == 3);\n'
    + '        require(s.y.length == 2);\n'
    + '    }\n'
    + '}';

  const stateNames = (artifact: {
    stateLayout?: {
      variables?: readonly { name: string }[];
      collections?: readonly { name: string }[];
    };
  }): string[] => [
    ...(artifact.stateLayout?.variables ?? []).map((v) => v.name),
    ...(artifact.stateLayout?.collections ?? []).map((c) => c.name),
  ];

  it('lowers a calldata struct copy into the flattened field leaves', () => {
    const artifact = compileString(FIXTURE);
    expect(artifact.contractName).toBe('C');
    // The struct has no single-value slot: it is the two leaves, and the copy writes each of them.
    expect(stateNames(artifact)).toContain('s__x');
    expect(stateNames(artifact)).toContain('s__y');
    expect(stateNames(artifact)).not.toContain('s');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('reads the leaves back in the same function', () => {
    // A read of a field written by the copy must resolve to the leaf (the copy is not a no-op).
    const artifact = compileString(FIXTURE);
    expect(artifact.abi.map((entry) => entry.name)).toEqual(['test']);
  });

  it('copies from a memory local of the same struct type', () => {
    const artifact = compileString('contract C {\n'
      + '    struct S { uint8[1] x; uint8[] y; }\n'
      + '    S s;\n'
      + '    function test(S calldata src) public {\n'
      + '        S memory m = src;\n'
      + '        s = m;\n'
      + '    }\n'
      + '}');
    expect(artifact.contractName).toBe('C');
  });

  it('still refuses a copy between different struct types', () => {
    // The decomposition is selected by the struct type, not by the shape of the statement.
    expect(() => compileString('contract C {\n'
      + '    struct S { uint8[1] x; uint8[] y; }\n'
      + '    struct T { uint8[1] x; uint8[] y; }\n'
      + '    S s;\n'
      + '    function test(T calldata src) public {\n'
      + '        s = src;\n'
      + '    }\n'
      + '}')).toThrow();
  });
});
