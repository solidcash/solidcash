import { describe, it, expect } from 'vitest';
import { compileString as compileStringRaw } from '../src/index.js';

const nonEmpty = (source: string): void => {
  const artifact = compileStringRaw(source, { evmCompat: true, enforceFinalRequire: false });
  expect(artifact.bytecode.replace(/\s+/g, '').length).toBeGreaterThan(0);
};

// `test/libsolidity/semanticTests/libraries/using_library_mappings_return.sol`: a library function returns a
// SUB-mapping storage pointer (`return m[key]`), and the caller writes through it directly
// (`Lib.choose(m, 0)[0] = 1;`). The parser hoists the call into `mapping(..) storage __mrv_N = m[key];` plus an
// indexed write on `__mrv_N`. Two things had to hold: a mapping read is typed by the ONE-LEVEL value type
// (`m[key]` is `mapping(K2=>V)`, not the leaf `V`), and the alias lowering must carry the fixed key prefix so
// every use writes `m[key][..]` rather than `m[..]`.
const CORPUS_FIXTURE = `library Lib {
    function choose(mapping(uint => mapping(uint => uint)) storage m, uint key) external returns (mapping(uint => uint) storage) {
        return m[key];
    }
}
contract Test {
    mapping(uint => mapping(uint => uint)) m;
    function f() public returns (uint, uint, uint, uint, uint, uint)
    {
        Lib.choose(m, 0)[0] = 1;
        Lib.choose(m, 0)[2] = 42;
        Lib.choose(m, 1)[0] = 23;
        Lib.choose(m, 1)[2] = 99;
        return (m[0][0], m[0][1], m[0][2], m[1][0], m[1][1], m[1][2]);
    }
}
`;

describe('mapping-storage alias to a sub-mapping returned by a helper', () => {
  it('compiles the corpus fixture with the conformance sweep options', () => {
    nonEmpty(CORPUS_FIXTURE);
  });

  it('carries the fixed key prefix into the direct indexed write', () => {
    nonEmpty('library L {\n'
      + '  function choose(mapping(uint=>mapping(uint=>uint)) storage mm, uint key) external returns (mapping(uint=>uint) storage) { return mm[key]; }\n'
      + '}\n'
      + 'contract C {\n'
      + '  mapping(uint=>mapping(uint=>uint)) m;\n'
      + '  function f() public { L.choose(m, 1)[2] = 7; }\n'
      + '  function g() public returns (uint) { return m[1][2]; }\n'
      + '}\n');
  });

  it('still compiles a whole-mapping alias (the pre-existing unkeyed path)', () => {
    nonEmpty('library L {\n'
      + '  function whole(mapping(uint=>uint) storage mm) external returns (mapping(uint=>uint) storage) { return mm; }\n'
      + '}\n'
      + 'contract C {\n'
      + '  mapping(uint=>uint) m;\n'
      + '  function f() public { L.whole(m)[3] = 5; }\n'
      + '  function g() public returns (uint) { return m[3]; }\n'
      + '}\n');
  });
});
