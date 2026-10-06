import { describe, expect, it } from 'vitest';
import { asmToScript, scriptToBytecode } from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { refusalOf } from './refused-entry.js';

/**
 * Which inline assembly refuses a framed body.
 *
 * Inline assembly is a property of the code a master carries rather than of the unit it is compiled in: a unit is
 * a file and its imports, and one contract's master holds its own bodies, the definitions they invoke, and nothing
 * else. The question used to be asked of the whole unit, so a file-level definition no body reaches — OpenZeppelin's
 * `Address` helpers, pulled in beside a token that never calls them — refused every contract in the file. It is
 * asked of this contract's own bodies and of the file-level definitions those bodies reach.
 *
 * What counts as assembly is the block the lowering leaves in place. Yul the lowering rewrites — `add`, `mstore`,
 * `mload` — becomes ordinary statements and is served like any other body; native `assembly { OP_* }`, which has no
 * Yul tree, stays a block and refuses only the body that reaches it, published beside the artifact while the
 * contract's other bodies compile.
 */

const HEAD = 'pragma solidity ^0.8.0;\n';

/** A definition that doubles its argument, so an entry can hold the call to what it returns. */
const TWICE = 'function twice(uint x) pure returns (uint) { return x * 2; }\n';

/** A file-level definition whose body is inline assembly and whose result is its own argument. */
const ASSEMBLY_DEFINITION = 'function shift(uint x) returns (uint) { '
  + 'assembly { let y := add(x, 1) mstore(0, y) } return x; }\n';

/** The same shape with native opcodes, which the lowering leaves as a block. */
const NATIVE_ASSEMBLY_DEFINITION = 'function shift(uint x) returns (uint) { '
  + 'assembly { OP_DUP OP_ADD 0x01 } return x; }\n';

const CONTRACT = 'contract AsmScope(address owner) {'
  + '   function go(uint x) { require(twice(x) == 4); require(msg.sender == owner); }'
  + ' }';

/** The same contract, with the entry calling the assembly-bearing definition instead of the arithmetic one. */
const CALLING_CONTRACT = 'contract AsmScope(address owner) {'
  + '   function go(uint x) { require(shift(x) == x); require(msg.sender == owner); }'
  + ' }';

/** An entry whose own body is inline assembly, which the master would run where it stands. */
const OWN_ASSEMBLY_CONTRACT = 'contract AsmScope(address owner) {'
  + '   function go(uint x) { assembly { let y := add(x, 1) mstore(0, y) } require(msg.sender == owner); }'
  + ' }';

/** The same entry, holding native opcodes the lowering leaves in place. */
const OWN_NATIVE_ASSEMBLY_CONTRACT = 'contract AsmScope(address owner) {'
  + '   function go(uint x) { assembly { OP_DUP OP_ADD 0x01 } require(msg.sender == owner); }'
  + ' }';

const compiling = (source: string): ReturnType<typeof compileString> =>
  compileString(source, { composition: 'framed', solidityImportCompat: true } as never);

const scriptBytes = (source: string): Uint8Array =>
  scriptToBytecode(asmToScript(compiling(source).bytecode));

/** The contract-wide refusal the shipped compile throws for a source, or a failure when it accepts it. */
function thrownRefusalOf(source: string): { code?: string; message: string } {
  try {
    compiling(source);
  } catch (error) {
    return error as { code?: string; message: string };
  }
  throw new Error('the shipped framed compiler accepted the source, so there is no refusal to record');
}

describe('a unit that carries inline assembly no body reaches', () => {
  it('leaves the compiled master byte-identical, and admits the contract it refused before', () => {
    // The definition is compiled for diagnostics and left out of this program: nothing the master dispatches can
    // reach it, so neither its body nor the lowering it needs is part of what the contract deployed.
    const carried = scriptBytes(HEAD + TWICE + ASSEMBLY_DEFINITION + CONTRACT);
    const without = scriptBytes(HEAD + TWICE + CONTRACT);
    expect(carried).toStrictEqual(without);
  });

  it('leaves the compiled master byte-identical for a native definition no body reaches', () => {
    const carried = scriptBytes(HEAD + TWICE + NATIVE_ASSEMBLY_DEFINITION + CONTRACT);
    const without = scriptBytes(HEAD + TWICE + CONTRACT);
    expect(carried).toStrictEqual(without);
  });
});

describe('inline assembly the master would run', () => {
  it('serves the body when the assembly is one the lowering rewrites', () => {
    // `add` and `mstore` are Yul the lowering turns into ordinary statements, so the body carries no assembly and
    // the contract compiles - whether the block is the entry's own or in a definition the entry reaches.
    expect(() => compiling(HEAD + ASSEMBLY_DEFINITION + CALLING_CONTRACT)).not.toThrow();
    expect(() => compiling(HEAD + OWN_ASSEMBLY_CONTRACT)).not.toThrow();
  });

  it('refuses the contract by name when the entry reaches a definition the lowering leaves', () => {
    // The definition is emitted behind no stub, so its assembly would reach every master of the contract: the
    // contract is refused rather than one of its bodies.
    const refusal = thrownRefusalOf(HEAD + NATIVE_ASSEMBLY_DEFINITION + CALLING_CONTRACT);
    expect(refusal.code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('inline assembly is not composed framed');
  });

  it('refuses by name when the entry holds it itself, and compiles the contract', () => {
    // A body's own assembly is a fact about that body: it is refused by name beside the artifact, and the contract
    // is still compiled so its other bodies keep their programs.
    const refusal = refusalOf(HEAD + OWN_NATIVE_ASSEMBLY_CONTRACT, undefined, { solidityImportCompat: true });
    expect(refusal.code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('inline assembly is not composed framed');
  });
});
