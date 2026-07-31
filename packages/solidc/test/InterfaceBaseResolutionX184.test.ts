import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';
import { CircularInterfaceInheritanceError, UndefinedInterfaceError } from '../src/Errors.js';

/**
 * X184. AN UNDEFINED INTERFACE BASE IS SILENTLY ACCEPTED WHEN THE INTERFACE IS THE COMPILATION ROOT.
 *
 * Measured, not assumed. Two facts, pinned here so neither can drift unobserved.
 *
 * FACT 1 (the defect). `interface I is Zzz {}` with NO contract in the file COMPILES, to an ABI-only artifact
 * named `I` with empty bytecode. So does `interface I is I {}`. Add a contract to the SAME file and both are
 * refused. The differential builds the subject twice differing ONLY in whether a contract is present, so the
 * field the compiler actually reads is "is this file the declaration-artifact path", not anything about the
 * base:
 *
 *      interface I is Zzz {}                  ACCEPT   name=I  bytecode=""
 *      contract C {} interface I is Zzz {}    REFUSE   UndefinedInterfaceError
 *      interface I is I {}                    ACCEPT   name=I  bytecode=""
 *      contract C {} interface I is I {}      REFUSE   CircularInterfaceInheritanceError
 *
 * Cause: `compileResolvedAst` (compiler.ts:2052) returns `generateDeclarationArtifact(ast, code)` for a file
 * with no compilable contract, BEFORE semantic analysis runs. The whole interface-base validation block in
 * `SymbolTableTraversal.visitSourceFile` (SymbolTableTraversal.ts:594-606) is therefore unreachable on that
 * path, and it is not only the undefined-base check that is lost: the contract-as-base check and
 * `checkCircularInheritance` are in the same block. Three refusals, all skipped.
 *
 * THE FACT-1 EXPECTATIONS BELOW ASSERT THE DEFECT, NOT THE DESIRED BEHAVIOUR. They are written to go RED the
 * day resolution is hoisted ahead of the declaration-artifact return; when they do, flip each `expectAccepted`
 * to the matching `expectRefused` rather than deleting it. See the BLOCKED hunk for the design.
 *
 * FACT 2 (the mis-attribution). `contract C {} interface I is C {}`, where `C` IS defined as a contract,
 * reports `Undefined interface 'C'`. The control that removes the suspected cause - the base being a CONTRACT -
 * while holding every other field raises the IDENTICAL refusal for a base that declares nothing at all. So a
 * solc-parity guard named for "interfaces can only inherit interfaces" cannot assert that rule here: the
 * compiler never reads the field. What would restore the stronger claim is a diagnostic that names `C` as a
 * contract; there is no such diagnostic at this commit.
 */

const compat = { solidityImportCompat: true } as const;

type Outcome = { accepted: string } | { refused: string };

const outcome = (src: string): Outcome => {
  try {
    return { accepted: compileString(src, compat).contractName };
  } catch (error) {
    return { refused: (error as Error).constructor.name };
  }
};

describe('X184 interface base resolution is skipped on the declaration-artifact path', () => {
  // FACT 1. Pinned as the defect it is. Each row is a pair differing only in the presence of a contract.
  describe('FACT 1 (DEFECT): an interface that is the compilation root has its base list left unresolved', () => {
    it('accepts an undefined base at the root, and refuses the same base with a contract present', () => {
      // DEFECT: this compile should be refused. Flip to `refused: 'UndefinedInterfaceError'` when X184 lands.
      expect(outcome('interface I is Zzz {}')).toEqual({ accepted: 'I' });
      // The control: same interface, same undefined base, one contract added.
      expect(outcome('contract C {} interface I is Zzz {}')).toEqual({ refused: 'UndefinedInterfaceError' });
    });

    it('accepts a self-circular base at the root, and refuses the same base with a contract present', () => {
      // DEFECT: circular inheritance is unchecked on this path too. Flip when X184 lands.
      expect(outcome('interface I is I {}')).toEqual({ accepted: 'I' });
      expect(outcome('contract C {} interface I is I {}')).toEqual({ refused: 'CircularInterfaceInheritanceError' });
    });

    it('accepts a mutually circular base pair at the root, and refuses it with a contract present', () => {
      // DEFECT. Flip when X184 lands.
      expect(outcome('interface A is B {} interface B is A {}')).toEqual({ accepted: 'A' });
      expect(outcome('contract C {} interface A is B {} interface B is A {}'))
        .toEqual({ refused: 'CircularInterfaceInheritanceError' });
    });

    it('admits the unresolved base into a real ABI-only artifact rather than dropping the file', () => {
      // The admission is not inert: it publishes an artifact whose ABI is served to callers.
      const artifact = compileString('interface I is Zzz { function m() external; }', compat);
      expect(artifact.contractName).toBe('I');
      expect(artifact.bytecode).toBe('');
      expect(artifact.abi.map((fn) => fn.name)).toEqual(['m']);
    });

    it('is the root-ness of the interface that decides, not the compat flag', () => {
      // Holding solidityImportCompat off changes neither side, so the flag is not the discriminating field.
      expect(compileString('interface I is Zzz {}', {}).contractName).toBe('I');
      expect(() => compileString('contract C {} interface I is Zzz {}', {})).toThrow(UndefinedInterfaceError);
    });
  });

  // FACT 2. The refusal that a solc-parity guard would want to attribute to "the base is a contract" does not
  // read that field. Asserted as the weaker fact the compiler actually proves, with the gap recorded.
  describe('FACT 2 (MIS-ATTRIBUTION): the contract-base refusal does not discriminate contract from undefined', () => {
    it('raises the same error class for a defined contract base and a base that declares nothing', () => {
      const contractBase = (): unknown => compileString('contract C {} interface I is C {}', compat);
      const undefinedBase = (): unknown => compileString('contract C {} interface I is Zzz {}', compat);
      expect(contractBase).toThrow(UndefinedInterfaceError);
      expect(undefinedBase).toThrow(UndefinedInterfaceError);
      // Same phrasing on both, differing only in the echoed name: the message asserts non-resolution, and the
      // base being a contract is never named. This is the assertion a "interfaces may only inherit interfaces"
      // guard would need to invert, and it cannot at this commit.
      expect(contractBase).toThrow(/^Undefined interface 'C'/);
      expect(undefinedBase).toThrow(/^Undefined interface 'Zzz'/);
    });

    it('has no diagnostic anywhere that names the base as a contract', () => {
      let message = '';
      try { compileString('contract C {} interface I is C {}', compat); } catch (e) { message = (e as Error).message; }
      expect(message).not.toBe('');
      // Vocabulary check against the message the subject ACTUALLY produces, not a guessed phrasing. If any of
      // these begins to match, the stronger solc-parity claim has become assertable and FACT 2 should be
      // rewritten to assert it.
      expect(message).not.toMatch(/only inherit|not an interface|is a contract|contract base/i);
    });
  });

  // The positive half, so the refusals above cannot be obtained by refusing everything.
  describe('bases that do resolve as interfaces are still accepted', () => {
    it('accepts a direct and a transitive interface base', () => {
      expect(compileString('interface B { function m() external; }'
        + ' contract C is B { function m() external { require(true); } }', compat).contractName).toBe('C');
      expect(compileString('interface B { function m() external; } interface I is B {}'
        + ' contract C is I { function m() external { require(true); } }', compat).contractName).toBe('C');
    });

    it('accepts a valid interface base at the root too', () => {
      expect(compileString('interface B { function m() external; } interface I is B {}', compat).contractName)
        .toBe('B');
    });
  });
});

// Guard the guard: CircularInterfaceInheritanceError must remain a distinct class from UndefinedInterfaceError,
// or the FACT 1 pairs above would stop discriminating which check was skipped.
describe('X184 the two skipped checks are distinguishable', () => {
  it('uses distinct error classes for an undefined base and a circular base', () => {
    expect(CircularInterfaceInheritanceError).not.toBe(UndefinedInterfaceError);
    expect(() => compileString('contract C {} interface I is I {}', compat))
      .toThrow(CircularInterfaceInheritanceError);
    expect(() => compileString('contract C {} interface I is Zzz {}', compat))
      .toThrow(UndefinedInterfaceError);
  });
});
