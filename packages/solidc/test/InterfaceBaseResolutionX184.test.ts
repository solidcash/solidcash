import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';
import {
  CircularInterfaceInheritanceError, InterfaceContractBaseError, SolidcDiagnosticError,
  UndefinedInterfaceError,
} from '../src/Errors.js';

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
 * FACT 2 (the repaired residual). A defined contract base now raises the structured
 * `INTERFACE_CONTRACT_BASE` diagnostic, distinct from `UndefinedInterfaceError`, and carries the declaration's
 * real root/imported source location. Mutating the base into an interface accepts; deleting it retains the
 * undefined-interface refusal, so the diagnostic cannot pass without reading the declaration kind.
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

  describe('FACT 2 (REPAIRED): a contract base is distinguished from an undefined interface', () => {
    it('publishes a stable contract-specific diagnostic at the root declaration', () => {
      const contractBase = (): unknown => compileString('contract C {} interface I is C {}', compat);
      const undefinedBase = (): unknown => compileString('contract C {} interface I is Zzz {}', compat);
      expect(contractBase).toThrow(InterfaceContractBaseError);
      expect(undefinedBase).toThrow(UndefinedInterfaceError);
      expect(contractBase).toThrow(/interface 'I' cannot inherit contract 'C'/);
      expect(undefinedBase).toThrow(/^Undefined interface 'Zzz'/);
      try {
        contractBase();
        throw new Error('expected contract-base refusal');
      } catch (error) {
        expect(error).toBeInstanceOf(SolidcDiagnosticError);
        expect(error).toMatchObject({
          code: 'INTERFACE_CONTRACT_BASE',
          context: {
            interfaceName: 'I', baseName: 'C', baseKind: 'contract',
            sourceLocation: { line: 1, column: 14 },
          },
        });
        expect((error as SolidcDiagnosticError).context).not.toHaveProperty('sourceFile');
      }
    });

    it('attributes an imported invalid declaration to the file that contains it', () => {
      const imported = 'contract C {}\ninterface I is C {}';
      const resolver = (path: string): { source: string; id: string } | undefined => (
        path === './bad.sol' ? { source: imported, id: '/deps/bad.sol' } : undefined
      );
      try {
        compileString('import "./bad.sol"; contract Root {}', {
          ...compat, rootFileId: '/root.sol', importResolver: resolver,
        });
        throw new Error('expected imported contract-base refusal');
      } catch (error) {
        expect(error).toMatchObject({
          code: 'INTERFACE_CONTRACT_BASE',
          context: {
            interfaceName: 'I', baseName: 'C', sourceFile: '/deps/bad.sol',
            sourceLocation: { line: 2, column: 0 },
          },
        });
      }
    });

    it('fails loudly if the subject is mutated away from a contract base', () => {
      const subject = 'contract C {} interface I is C {}';
      expect(() => compileString(subject, compat)).toThrow(InterfaceContractBaseError);
      expect(() => compileString(subject.replace('contract C', 'interface C'), compat)).not.toThrow();
      expect(() => compileString(subject.replace('is C', 'is Zzz'), compat)).toThrow(UndefinedInterfaceError);
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
