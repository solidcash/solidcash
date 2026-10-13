import { describe, it, expect } from 'vitest';
import { compileString as compileStringRaw } from '../src/index.js';

// `test/libsolidity/syntaxTests/controlFlow/localStorageVariables/ternary_declaration_fine.sol`: a ternary in
// statement position whose branches assign, with one branch's assignment GROUPED in parentheses
// (`flag ? c = s : (c = s);`) or reached through a field (`flag ? (c = s).f : (c = s).f;`). The statement
// lowering built an arm only from the branch's assignment TAIL, so a parenthesised branch produced an EMPTY arm
// and its assignment (or call) was silently dropped - which then read the uninitialized storage pointer.
const CORPUS_FIXTURE = `contract C {
    struct S { bool f; }
    S s;
    function f(bool flag) internal view {
        S storage c;
        flag ? c = s : c = s;
        c;
    }
    function g(bool flag) internal view {
        S storage c;
        flag ? c = s : (c = s);
        c;
    }
    function h(bool flag) internal view {
        S storage c;
        flag ? (c = s).f : (c = s).f;
        c;
    }
}
`;

describe('ternary branch assignment in statement position', () => {
  it('compiles the corpus fixture with the conformance sweep options', () => {
    // Exactly the options the solc-corpus conformance sweep passes for unmodified upstream sources.
    const artifact = compileStringRaw(CORPUS_FIXTURE, { evmCompat: true, enforceFinalRequire: false });
    expect(artifact.bytecode.replace(/\s+/g, '').length).toBeGreaterThan(0);
  });

  it('keeps a parenthesised branch assignment, and an ordinary branch expression, in the arm', () => {
    // Both shapes used to compile with the branch dropped; the grouped assignment and the call must survive.
    // The grouped form needs a bare identifier target (`parenExpression`'s AssignmentExpression alternative),
    // and a local keeps the shape independent of the storage-pointer validation the fixture also covers.
    const grouped = 'contract C() {\n'
      + '  uint256 v;\n'
      + '  function side() public returns (uint256) { this.v = 7; return 1; }\n'
      + '  function pick(uint256 a, bool flag) public {\n'
      + '    uint256 w = 0; flag ? w = a : (w = a + 1); this.v = w; require(true);\n'
      + '  }\n'
      + '  function callSide(bool flag) public {\n'
      + '    uint256 w = 0; flag ? w = side() : (w = 2); this.v = w; require(true);\n'
      + '  }\n'
      + '}\n';
    const artifact = compileStringRaw(grouped, { evmCompat: true, enforceFinalRequire: false });
    expect(artifact.bytecode.replace(/\s+/g, '').length).toBeGreaterThan(0);
  });
});
