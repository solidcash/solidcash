import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// `type(L).creationCode` on a LIBRARY, plus the dead-helper case that goes with it: a library whose functions are
// all internal is inlined at its call sites, so it has no deployed artifact - its creation code is the empty blob.
// That also means a dead helper whose body would deploy the primary contract (impossible inside the primary's own
// artifact: the child would have to embed the parent's redeem script) must not be emitted at all.
describe('library type() introspection and dead helpers', () => {
  const LIBRARY_SOURCE = 'library L1 { function foo() internal { new A(); } }\n'
    + 'library L2 { function foo() internal { L1.foo(); } }\n'
    + 'contract A { function f() public pure { type(L2).creationCode; } }';

  it('compiles type(L).creationCode for an internal-only library', () => {
    const artifact = compileString(LIBRARY_SOURCE);
    expect(artifact.contractName).toBe('A');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('compiles type(L).name and type(L).runtimeCode', () => {
    const artifact = compileString(
      'library L2 { function foo() internal {} }\n'
      + 'contract A {\n'
      + '    function f() public pure {\n'
      + '        string memory n = type(L2).name;\n'
      + '        bytes memory c = type(L2).runtimeCode;\n'
      + '        require(bytes(n).length + c.length >= 0);\n'
      + '    }\n'
      + '}',
    );
    expect(artifact.contractName).toBe('A');
  });

  it('still refuses a property a library has no analogue for', () => {
    expect(() => compileString(
      'library L2 { function foo() internal {} }\n'
      + 'contract A { function f() public pure { type(L2).interfaceId; } }',
    )).toThrow(/interfaceId/);
  });

  it('still refuses introspection of a name that is not a declared type', () => {
    expect(() => compileString(
      'contract A { function f() public pure { type(Nope).creationCode; } }',
    )).toThrow();
  });

  it('keeps a LIVE helper that deploys the primary contract refused rather than silently dropping it', () => {
    expect(() => compileString(
      'library L2 { function foo() internal { new A(); } }\n'
      + 'contract A { function f() public { L2.foo(); } }',
    )).toThrow(/Compiled bytecode for contract 'A' not available/);
  });
});
