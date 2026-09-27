import { describe, expect, it } from 'vitest';
import { asmToScript, scriptToBytecode } from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';

/**
 * Which inline assembly refuses a per-call master.
 *
 * Inline assembly is a property of the code a master carries rather than of the unit it is compiled in: a unit is
 * a file and its imports, and one contract's master holds its own bodies, the definitions they invoke, and nothing
 * else. The question used to be asked of the whole unit, so a file-level definition no body reaches — OpenZeppelin's
 * `Address` helpers, pulled in beside a token that never calls them — refused every contract in the file. It is
 * asked of this contract's own bodies and of the file-level definitions those bodies reach, which is what these
 * cases pin: an unreached definition's assembly costs the program nothing, and assembly the program would run is
 * still refused.
 */

const HEAD = 'pragma solidity ^0.8.0;\n';

/** A definition that doubles its argument, so an entry can hold the call to what it returns. */
const TWICE = 'function twice(uint x) pure returns (uint) { return x * 2; }\n';

/** A file-level definition whose body is inline assembly and whose result is its own argument. */
const ASSEMBLY_DEFINITION = 'function shift(uint x) returns (uint) { '
  + 'assembly { let y := add(x, 1) mstore(0, y) } return x; }\n';

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

const compiling = (source: string): ReturnType<typeof compileString> =>
  compileString(source, { composition: 'per-call', solidityImportCompat: true } as never);

const scriptBytes = (source: string): Uint8Array =>
  scriptToBytecode(asmToScript(compiling(source).bytecode));

/** The refusal the shipped compile raises for a source, or a failure when it accepts it. */
function refusalOf(source: string): { code?: string; message: string } {
  try {
    compiling(source);
  } catch (error) {
    return error as { code?: string; message: string };
  }
  throw new Error('the shipped per-call compiler accepted the source, so there is no refusal to record');
}

describe('a unit that carries inline assembly no body reaches', () => {
  it('leaves the compiled master byte-identical, and admits the contract it refused before', () => {
    // The definition is compiled for diagnostics and left out of this program: nothing the master dispatches can
    // reach it, so neither its body nor the lowering it needs is part of what the contract deployed.
    const carried = scriptBytes(HEAD + TWICE + ASSEMBLY_DEFINITION + CONTRACT);
    const without = scriptBytes(HEAD + TWICE + CONTRACT);
    expect(carried).toStrictEqual(without);
  });
});

describe('inline assembly the master would run', () => {
  it('is refused by name when the entry reaches it through a definition', () => {
    // The definition is inlined into the body that calls it, so its assembly is this program's assembly.
    const refusal = refusalOf(HEAD + ASSEMBLY_DEFINITION + CALLING_CONTRACT);
    expect(refusal.code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('inline assembly is not composed per-call');
  });

  it('is refused by name when the entry holds it itself', () => {
    // A sibling contract's assembly is not this master's, but a body's own is: the head has no lowering for it.
    const refusal = refusalOf(HEAD + OWN_ASSEMBLY_CONTRACT);
    expect(refusal.code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('inline assembly is not composed per-call');
  });
});
