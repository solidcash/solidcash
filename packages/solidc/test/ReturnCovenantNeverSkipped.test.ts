import { describe, expect, it } from 'vitest';
import type { AbiEncodePackedNode, Node } from '../src/ast/AST.js';
import { SolidcDiagnosticError } from '../src/Errors.js';
import GenerateTargetTraversal from '../src/generation/GenerateTargetTraversal.js';
import { compileString } from './direct-compile.js';

/**
 * A returning entry binds its result through its return witness and, when it settles a call record (D50), its call
 * digest. A body that consumed one of them, through a `return` operand that left no value (the empty encodings
 * e0d7cd3f2 fixed), compiled with no record and no return carrier once the witness went. It is refused.
 */

type Artifact = ReturnType<typeof compileString>;

/** Compiles with a zero-argument `abi.encodePacked()` leaving no value, as it did before e0d7cd3f2. */
function compileValueless(source: string): Artifact {
  const visit = GenerateTargetTraversal.prototype.visitAbiEncodePacked;
  GenerateTargetTraversal.prototype.visitAbiEncodePacked = function valueless(
    this: GenerateTargetTraversal, node: AbiEncodePackedNode,
  ): Node {
    return node.parameters.length === 0 ? node : visit.call(this, node);
  };
  try {
    return compileString(source, { evmCompat: true });
  } finally {
    GenerateTargetTraversal.prototype.visitAbiEncodePacked = visit;
  }
}

function diagnostic(run: () => unknown): SolidcDiagnosticError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(SolidcDiagnosticError);
    return error as SolidcDiagnosticError;
  }
  throw new Error('expected a diagnostic');
}

function expectRecordPin(artifact: Artifact, name: string): void {
  const fn = artifact.abi.find((entry) => entry.name === name);
  expect(fn?.inputs.map((input) => input.name), name).toContain('__internal__returnOutputIdx');
  expect(fn?.callRecord, name).toBe(true);
}

describe('a returning entry never skips its return covenant', () => {
  it('refuses a body that consumed its return witness', () => {
    const error = diagnostic(() => compileValueless('contract C { function pair() public pure'
      + ' returns (bytes memory, bytes memory) { return (abi.encodePacked(), abi.encodePacked()); } }'));
    expect(error.code).toBe('RETURN_RESULT_UNBOUND');
    expect(error.context).toMatchObject({ function: 'pair', consumed: '__internal__returnOutputIdx' });
  });

  it('refuses a body that consumed its call digest', () => {
    const error = diagnostic(() => compileValueless('contract C { function one() public pure'
      + ' returns (bytes memory) { return abi.encodePacked(); } }'));
    expect(error.code).toBe('RETURN_RESULT_UNBOUND');
    expect(error.context).toMatchObject({ function: 'one', consumed: '__internal__callDigest' });
  });

  it('pins the record of honest returning entries and none for a void one', () => {
    const native = compileString('contract Honest() {'
      + ' function add(int a, int b) returns (int) { return a + b; }'
      + ' function pick(bool c, int a, int b) returns (int) { if (c) { return a; } return b; }'
      + ' function twice(int a) returns (int) { return a * 2; }'
      + ' function outer(int a) returns (int, bytes) { return (twice(a) + 1, abi.encodePacked(a)); } }');
    for (const name of ['add', 'pick', 'twice', 'outer']) expectRecordPin(native, name);
    // The digest preimage leads with the ordinal (0) and the entry's own selector.
    const add = native.abi.find((entry) => entry.name === 'add')!;
    expect(native.bytecode).toContain(`0000${add.selector}`);

    const store = compileString('contract Store { uint256 x;'
      + ' function get() public view returns (uint256) { return x; }'
      + ' function set(uint256 v) public { x = v; } }', { evmCompat: true });
    expectRecordPin(store, 'get');
    expect(store.abi.find((entry) => entry.name === 'set')?.callRecord).toBeUndefined();
  });
});
