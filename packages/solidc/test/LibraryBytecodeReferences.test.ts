import { describe, it, expect } from 'vitest';
import { Op } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

// The child locking bytecode of a self-deploy is read as `OP_INPUTINDEX OP_UTXOBYTECODE`. It sits inside the
// OP_DEFINE'd body of the deploying function, whose bytes the artifact renders as one hex data push.
const SELF_DEPLOY_READ = Op.OP_INPUTINDEX.toString(16) + Op.OP_UTXOBYTECODE.toString(16);
// `test/libsolidity/syntaxTests/bytecodeReferences/library_*.sol` from the solc corpus. A library's functions are
// inlined at their call sites (or emitted as free-function subroutines), so a library helper of `A` whose body
// performs `new A()` is a self-referential deploy: the child is the SAME contract class as the one being
// compiled. Its redeem script IS the script of the input being spent, so the child's locking bytecode is read
// from that input instead of embedding a body - embedding would require the emitted script to contain a copy of
// itself, a fixed point with no solution - and `OP_ACTIVEBYTECODE` cannot serve: inside an `OP_INVOKE`d body
// (every function body is one) the invoked body becomes the active bytecode. A reference from the primary's OWN
// code is instead the circular reference solc refuses (TypeError 7813): that contract's creation code would have
// to contain itself.
describe('library bytecode references', () => {
  // library_non_called.sol: L2 is never called; only `type(L2).creationCode` names it.
  const NON_CALLED = 'library L1 { function foo() internal { new A(); } }\n'
    + 'library L2 { function foo() internal { L1.foo(); } }\n'
    + 'contract A { function f() public pure { type(L2).creationCode; } }';

  // library_public_called.sol: the same reference, but reached through a public library function.
  const PUBLIC_CALLED = 'library L1 { function foo() internal { new A(); } }\n'
    + 'library L2 { function foo() public { L1.foo(); } }\n'
    + 'contract A { function f() public { L2.foo(); } }';

  it('compiles type(L).creationCode for an internal-only library', () => {
    const artifact = compileString(NON_CALLED);
    expect(artifact.contractName).toBe('A');
    // An internal-only library has no deployed artifact, so its creation code is the empty blob.
    expect(artifact.bytecode).toContain('OP_0 OP_DROP');
  });

  it('compiles a library helper that deploys the primary contract', () => {
    const artifact = compileString(PUBLIC_CALLED);
    expect(artifact.contractName).toBe('A');
    expect(artifact.abi.map((entry) => entry.name)).toEqual(['f']);
  });

  it('takes the self-deployed child locking bytecode from the input being spent', () => {
    const artifact = compileString(PUBLIC_CALLED);
    // The child is this same contract class, so its locking bytecode is the one the spent input already carries.
    expect(artifact.debug?.bytecode).toContain(SELF_DEPLOY_READ);
    // No redeem script is built and nothing is hashed, and the active bytecode is never consulted.
    expect(artifact.bytecode).not.toContain('OP_HASH256');
    expect(artifact.bytecode).not.toContain('OP_ACTIVEBYTECODE');
  });

  it('refuses a reference from the primary contract\'s own code as circular', () => {
    // solc reports TypeError 7813 for each of these; the contract's creation code would have to contain itself.
    expect(() => compileString('contract Test { function f() public { Test x = new Test(); } }'))
      .toThrow(/CIRCULAR_CONTRACT_REFERENCE/);
    expect(() => compileString('contract C { constructor() { new C(); } }'))
      .toThrow(/CIRCULAR_CONTRACT_REFERENCE/);
    // Reached through an internal member call, which is still the contract's own code.
    expect(() => compileString('contract A { function f() public { h(); } function h() internal { new A(); } }'))
      .toThrow(/CIRCULAR_CONTRACT_REFERENCE/);
  });

  it('still embeds and hashes the body of any other deployed contract', () => {
    const artifact = compileString(
      'contract B { function g() public pure { require(1 == 1); } }\n'
      + 'contract A { function f() public { new B(); } }',
    );
    expect(artifact.contractName).toBe('A');
    expect(artifact.bytecode).toContain('OP_HASH256');
    expect(artifact.bytecode).not.toContain('OP_UTXOBYTECODE');
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
});
