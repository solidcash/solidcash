import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';
import { CircularInterfaceInheritanceError, UndefinedInterfaceError } from '../src/Errors.js';

/**
 * X184. AN UNDEFINED INTERFACE BASE IS SILENTLY ACCEPTED WHEN THE INTERFACE IS THE COMPILATION ROOT.
 *
 * Measured, not assumed. Two facts, pinned here so neither can drift unobserved.
 *
 * FACT 1 (the repaired defect). Declaration-only files now pass through the same symbol and type validation as
 * executable files before their ABI-only artifact is emitted. The differential builds each subject twice,
 * differing ONLY in whether a contract is present, and requires the result to stay identical:
 *
 *      interface I is Zzz {}                  REFUSE   UndefinedInterfaceError
 *      contract C {} interface I is Zzz {}    REFUSE   UndefinedInterfaceError
 *      interface I is I {}                    REFUSE   CircularInterfaceInheritanceError
 *      contract C {} interface I is I {}      REFUSE   CircularInterfaceInheritanceError
 *
 * Cause was the early declaration-artifact return in `compileResolvedAst`; semantic analysis now precedes it.
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

describe('X184 interface base resolution also runs on the declaration-artifact path', () => {
  describe('FACT 1 (REPAIRED): an interface compilation root has its base list resolved', () => {
    it('refuses an undefined base with or without a contract present', () => {
      expect(outcome('interface I is Zzz {}')).toEqual({ refused: 'UndefinedInterfaceError' });
      // The control: same interface, same undefined base, one contract added.
      expect(outcome('contract C {} interface I is Zzz {}')).toEqual({ refused: 'UndefinedInterfaceError' });
    });

    it('refuses a self-circular base with or without a contract present', () => {
      expect(outcome('interface I is I {}')).toEqual({ refused: 'CircularInterfaceInheritanceError' });
      expect(outcome('contract C {} interface I is I {}')).toEqual({ refused: 'CircularInterfaceInheritanceError' });
    });

    it('refuses a mutually circular base pair with or without a contract present', () => {
      expect(outcome('interface A is B {} interface B is A {}'))
        .toEqual({ refused: 'CircularInterfaceInheritanceError' });
      expect(outcome('contract C {} interface A is B {} interface B is A {}'))
        .toEqual({ refused: 'CircularInterfaceInheritanceError' });
    });

    it('does not publish an ABI-only artifact for an unresolved base', () => {
      const withBogusBase = 'interface I is Zzz { function m() external; }';
      expect(outcome(withBogusBase)).toEqual({ refused: 'UndefinedInterfaceError' });
      expect(outcome(`contract C {} ${withBogusBase}`)).toEqual({ refused: 'UndefinedInterfaceError' });
      // Positive control: a baseless declaration still emits the same ABI-only artifact shape.
      const baseless = compileString('interface I { function m() external; }', compat);
      expect(baseless.contractName).toBe('I');
      expect(baseless.bytecode).toBe('');
      expect(baseless.abi.map((fn) => fn.name)).toEqual(['m']);
    });

    it('refuses the undefined base independently of the compat flag and root shape', () => {
      // Holding solidityImportCompat off changes neither side.
      expect(() => compileString('interface I is Zzz {}', {})).toThrow(UndefinedInterfaceError);
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
