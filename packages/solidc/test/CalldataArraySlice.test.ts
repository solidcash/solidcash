import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// `c[start:end]` on a calldata array lowers one of two ways: a fixed-stride element (uint256, bytes32, uint256[N],
// ..) is a scaled byte-range of the row blob, while a STATICALLY ENCODED framed element - a struct whose fields
// are all statically encoded, plain `int` - is a scan over the element frames, the same primitive the
// variable-width element read/write paths use. The type check refused every struct-element array outright
// ("Tried to call member 'slice' on unsupported type 'S[]'"), though the framed scan addresses exactly that row.
//
// Solidity's own boundary is kept: index-range access on an array with a DYNAMICALLY encoded base type is
// TypeError 2148, so `uint256[][]` and `string[]` stay refused - the corpus pins both cases
// (`semanticTests/array/slices/array_slice_calldata_to_calldata.sol` is the accepted shape;
// `syntaxTests/parsing/array_range_nested_invalid.sol` is the refused one). The VM-level proof that a framed
// slice retains the right rows is `packages/solidcash/test/e2e/CalldataStructArraySlice.test.ts`.
describe('calldata array slice c[start:end]', () => {
  const OPTS = { evmCompat: true };
  const struct = '    struct S { uint128 p1; uint256[3] a; uint32 p2; }\n';

  it('compiles the corpus fixture (struct rows and fixed-inner rows)', () => {
    const artifact = compileString('pragma abicoder v2;\n'
      + 'contract C {\n'
      + struct
      + '    function f(S[] calldata c) internal returns (S[] memory) { return c; }\n'
      + '    function g(S[] calldata c, uint256 s, uint256 e) public returns (S[] memory) { return f(c[s:e]); }\n'
      + '    function f1(uint256[3][] calldata c) internal returns (uint256[3][] memory) { return c; }\n'
      + '    function g1(uint256[3][] calldata c, uint256 s, uint256 e) public returns (uint256[3][] memory) {\n'
      + '        return f1(c[s:e]);\n'
      + '    }\n'
      + '}\n', OPTS);
    expect(artifact.abi.map((entry) => entry.name)).toEqual(expect.arrayContaining(['g', 'g1']));
    expect((artifact.debug?.bytecode ?? '').length).toBeGreaterThan(0);
  });

  it('slices a statically encoded framed element: a struct row and a plain-int element', () => {
    for (const [decl, element] of [[struct, 'S'], ['', 'int']] as const) {
      const artifact = compileString('contract C {\n' + decl
        + '    function f(' + element + '[] calldata c, uint256 s, uint256 e) external {\n'
        + '        ' + element + '[] memory sl = c[s:e];\n'
        + '        require(sl.length == e - s);\n'
        + '    }\n'
        + '}\n', OPTS);
      expect((artifact.debug?.bytecode ?? '').length).toBeGreaterThan(0);
    }
  });

  it('keeps the fixed-stride element path', () => {
    // A bounded row of fixed-width scalars is still a scaled byte-range, not a scan.
    const artifact = compileString('contract C {\n'
      + '    function f(uint256[3][] calldata c, uint256 s, uint256 e) external {\n'
      + '        uint256[3][] memory sl = c[s:e];\n'
      + '        require(sl.length == e - s);\n'
      + '    }\n'
      + '}\n', OPTS);
    expect((artifact.debug?.bytecode ?? '').length).toBeGreaterThan(0);
  });

  it('the bounds reach the lowering, so the window is not silently the whole array', () => {
    const at = (start: number, end: number): string => compileString('contract C {\n' + struct
      + '    function f(S[] calldata c) external {\n'
      + '        S[] memory sl = c[' + start + ':' + end + '];\n'
      + '        require(sl.length == ' + (end - start) + ');\n'
      + '    }\n'
      + '}\n', OPTS).bytecode;
    expect(at(0, 2)).not.toBe(at(1, 3));
    expect(at(0, 2)).not.toBe(at(0, 1));
  });

  it('still refuses a dynamically encoded element (Solidity TypeError 2148)', () => {
    // `syntaxTests/parsing/array_range_nested_invalid.sol`: an array with a dynamically encoded base type has no
    // index-range access to lower, and the element frames have no boundary the scan could stop at.
    expect(() => compileString('contract C { function f(uint256[][] calldata x) external pure {'
      + ' x[1:2]; x[:]; x[1:]; x[:2]; } }\n', OPTS))
      .toThrow(/Tried to call member 'slice' on unsupported type 'uint256\[\]\[\]'/);
    expect(() => compileString('contract C { function f(string[] calldata c, uint256 s, uint256 e) external {'
      + ' string[] memory sl = c[s:e]; require(sl.length == e - s); } }\n', OPTS))
      .toThrow(/Tried to call member 'slice' on unsupported type 'string\[\]'/);
  });

  it('still refuses a slice of a memory array and of a non-array value', () => {
    expect(() => compileString('contract C {\n' + struct
      + '    function f(S[] calldata c) external {\n'
      + '        S[] memory a = c;\n'
      + '        S[] memory b = a[0:1];\n'
      + '        require(b.length == 1);\n'
      + '    }\n'
      + '}\n', OPTS)).toThrow(/Index range access is only supported for dynamic calldata arrays/);
    expect(() => compileString('contract C {\n'
      + '    function f(uint256 x) external { uint256 y = x[0:1]; require(y == x); }\n'
      + '}\n', OPTS)).toThrow(/Index range access is only supported for dynamic calldata arrays/);
  });
});
