/*   imports.test.ts
 *
 * Tests for the import system and cross-contract references.
 * Uses compileFile since imports require file system access.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { compileFile, compileString, createMapResolver } from '../../src/index.js';
import type { ResolvedImport } from '@solidcash/utils';
import {
  CircularContractInheritanceError,
  UnresolvedImportError,
  ImportSymbolNotFoundError,
  ContractNoArgsRequiredError,
  ContractConstructorArgCountError,
  UndefinedInterfaceError,
  InterfaceComplianceError,
  CircularInterfaceInheritanceError,
  MissingOverrideError,
  InheritanceNameCollisionError,
  LibraryNotCompilableError,
  ParentInvocationArgCountError,
  UndefinedParentInvocationError,
  PrivateStateVariableAccessError,
  UndefinedExternalStateVariableError,
  ExternalReadArgCountError,
  ExternalAccessOnUnconnectedError,
  AbstractContractNotCompilableError,
  AbstractFunctionInConcreteContractError,
  UnimplementedAbstractFunctionError,
  DiamondInheritanceError,
  StatefulContractDeploymentError,
  DeployValueInNonStatefulError,
} from '../../src/Errors.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(currentDir, 'fixtures');


describe('Imports', () => {
  describe('Successful compilation', () => {
    it('should compile wildcard import', () => {
      expect(() => compileFile(path.join(fixtures, 'import_wildcard.scash'))).not.toThrow();
    });

    it('should compile selective import', () => {
      expect(() => compileFile(path.join(fixtures, 'import_selective.scash'))).not.toThrow();
    });

    it('should compile cross-contract reference without args', () => {
      const artifact = compileFile(path.join(fixtures, 'cross_contract_no_args.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Forwarder');
      expect(artifact.bytecode).toBeDefined();
    });

    it('should compile cross-contract reference with args', () => {
      const artifact = compileFile(path.join(fixtures, 'cross_contract_with_args.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Forwarder');
      expect(artifact.bytecode).toBeDefined();
    });

    it('should compile contract-typed state variable', () => {
      const artifact = compileFile(path.join(fixtures, 'contract_typed_state_var.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('ContractTypedStateVar');
      expect(artifact.bytecode).toBeDefined();
      expect(artifact.stateLayout).toBeDefined();
      expect(artifact.stateLayout!.variables[0].name).toBe('marketplace');
      expect(artifact.stateLayout!.variables[0].type).toBe('address');
      expect(artifact.stateLayout!.variables[0].contractType).toBe('TransferWithTimeout');
    });

    it('should compile npm-style import via compileFile', () => {
      const artifact = compileFile(path.join(fixtures, 'import_npm.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('NpmImporter');
      expect(artifact.bytecode).toBeDefined();
    });

    it('should resolve a bare (non-`./`) sibling import against the source directory', () => {
      const artifact = compileFile(path.join(fixtures, 'bare_import_sibling.scash'));
      expect(artifact.contractName).toBe('BareImporter');
      expect(artifact.bytecode).toBeDefined();
    });
  });

  describe('Using-for directives', () => {
    it('should compile using-for with library', () => {
      expect(() => compileFile(path.join(fixtures, 'using_for_library.scash'))).not.toThrow();
    });

    it('should compile using-for with specific functions', () => {
      expect(() => compileFile(path.join(fixtures, 'using_for_functions.scash'))).not.toThrow();
    });

    it('should compile using-for with wildcard type', () => {
      expect(() => compileFile(path.join(fixtures, 'using_for_wildcard.scash'))).not.toThrow();
    });

    it('should compile using-for at file level', () => {
      expect(() => compileFile(path.join(fixtures, 'using_for_file_level.scash'))).not.toThrow();
    });
  });

  describe('Import errors', () => {
    it('should throw UnresolvedImportError for missing file', () => {
      expect(
        () => compileFile(path.join(fixtures, 'error_unresolved_import.scash')),
      ).toThrow(UnresolvedImportError);
    });

    it('should throw ImportSymbolNotFoundError for unknown symbol', () => {
      expect(
        () => compileFile(path.join(fixtures, 'error_symbol_not_found.scash')),
      ).toThrow(ImportSymbolNotFoundError);
    });

    it('compiles a benign circular import (legal in Solidity - files import each other)', () => {
      const artifact = compileFile(path.join(fixtures, 'error_circular_a.scash'));
      expect(artifact.contractName).toBe('CircularA');
    });
  });

  describe('Cross-contract reference errors', () => {
    it('should throw ContractNoArgsRequiredError when using no-arg syntax on contract with params', () => {
      expect(
        () => compileFile(path.join(fixtures, 'error_no_args_required.scash')),
      ).toThrow(ContractNoArgsRequiredError);
    });

    it('should throw ContractConstructorArgCountError for wrong arg count', () => {
      expect(
        () => compileFile(path.join(fixtures, 'error_wrong_arg_count.scash')),
      ).toThrow(ContractConstructorArgCountError);
    });
  });

  describe('compileString with importResolver', () => {
    it('should compile with in-memory wildcard import', () => {
      const files: Record<string, string> = {
        '/lib/constants.scash': `
          int constant MAX_AMOUNT = 1000000;
          int constant MIN_AMOUNT = 546;
          contract ConstLib() {
            function validate(int amount) {
              require(amount >= MIN_AMOUNT);
              require(amount <= MAX_AMOUNT);
            }
          }
        `,
      };

      const code = `
        import "./lib/constants.scash";
        contract Spender() {
          function spend(int amount) {
            require(amount >= MIN_AMOUNT);
            require(amount <= MAX_AMOUNT);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Spender');
    });

    it('desugars a using-for method call on an IMPORTED struct-typed state var (OZ Counters pattern)', () => {
      // The struct (Counter) is imported, so unknown at parse time - the AstBuilder cannot desugar
      // `counter.increment()`; the post-import RedesugarImportedUsingForCalls pass must (else it fails as an
      // "Undefined reference to symbol counter.increment", the storage-pointer helper being inlined-and-dropped).
      const counters = 'library Counters { struct Counter { uint256 _value; }'
        + ' function increment(Counter storage c) internal { c._value += 1; }'
        + ' function current(Counter storage c) internal view returns (uint256) { return c._value; } }';
      const resolver = (importPath: string): { source: string; id: string } | undefined => (
        importPath === './Counters.sol' ? { source: counters, id: '/Counters.sol' } : undefined);
      const code = 'import "./Counters.sol";'
        + ' contract C { using Counters for Counters.Counter; Counters.Counter public counter; int n;'
        + ' function f() public { counter.increment(); this.n = int(counter.current()); } }';
      const artifact = compileString(code, {
        solidityImportCompat: true,
        importResolver: resolver,
        rootFileId: '/main.sol',
      });
      expect(artifact.contractName).toBe('C');
    });

    it('resolves an IMPORTED struct used as a mapping value and an event parameter', () => {
      // `Escrow` is imported, so at parse time `mapping(uint => Escrow)` and `event E(Escrow)` carry a named-
      // AddressType placeholder. reresolveImportedStructTypes must re-type the mapping VALUE (not just array
      // elements) and the event param objects (plain {name,type}, missed by the Node walk), else the write fails
      // as `Escrow can not be assigned to mapping value of type address`. (The Unicrow escrows map + JobEvent.)
      const types = 'struct Escrow { uint a; uint b; }';
      const resolver = (importPath: string): { source: string; id: string } | undefined => (
        importPath === './Types.sol' ? { source: types, id: '/Types.sol' } : undefined);
      const code = 'import "./Types.sol";'
        + ' contract C { mapping(uint => Escrow) escrows; event E(Escrow escrow);'
        + ' function f(uint k, Escrow memory e) public { escrows[k] = e; require(true); } }';
      const artifact = compileString(code, {
        solidityImportCompat: true, importResolver: resolver, rootFileId: '/main.sol',
      });
      expect(artifact.contractName).toBe('C');
    });

    it('imports a NAMED library from a MULTI-library file (Sablier DataTypes.sol pattern)', () => {
      // A file declaring SEVERAL libraries (Lockup, LockupDynamic, ..) sets `libraryName` to only the LAST, so
      // `import {Lockup, LockupDynamic}` must match against declaredLibraryNames. Library structs register bare
      // (`Lockup.CreateWithDurations` strips to `CreateWithDurations`), so the namespaced param types resolve.
      const dataTypes = 'struct Broker { address account; uint256 fee; }'
        + ' library Lockup { struct CreateWithDurations { address sender; uint128 amount; } }'
        + ' library LockupDynamic { struct SegmentWithDuration { uint128 amount; uint40 duration; } }';
      const resolver = (importPath: string): { source: string; id: string } | undefined => (
        importPath === './DataTypes.sol' ? { source: dataTypes, id: '/DataTypes.sol' } : undefined);
      const code = 'import {Broker, Lockup, LockupDynamic} from "./DataTypes.sol";'
        + ' contract C { function f(Lockup.CreateWithDurations memory p,'
        + ' LockupDynamic.SegmentWithDuration memory s, Broker memory b)'
        + ' public pure returns (uint128) { return p.amount + s.amount + uint128(b.fee); } }';
      const artifact = compileString(code, {
        solidityImportCompat: true, importResolver: resolver, rootFileId: '/main.sol',
      });
      expect(artifact.contractName).toBe('C');
    });

    it('rebuilds scalar+array field WRITES on an IMPORTED struct-typed local (byte-equal to same-file)', () => {
      // Escrow's type is imported, so unknown at parse - the AstBuilder mis-builds `e.split[i]=v` as a mapping-field
      // assign and `e.claimed=v` as a StateAssign that drops the field. RedesugarImportedStructFieldWrites rewrites
      // both into the read-modify-rebuild the AstBuilder emits for a same-file struct local. Result must be identical.
      const escrowStruct = 'struct Escrow { uint16[4] split; uint16 claimed; }';
      const body = 'interface IU { function getEscrow(uint256 id) external view returns (Escrow memory); }'
        + ' contract C { int n; function f(IU u, uint256 id) public {'
        + ' Escrow memory e = u.getEscrow(id); e.split[2] = 10000; e.claimed = 1;'
        + ' this.n = int(uint(e.split[2])) + int(uint(e.claimed)); } }';
      const resolver = (importPath: string): { source: string; id: string } | undefined => (
        importPath === './T.sol' ? { source: escrowStruct, id: '/T.sol' } : undefined);
      const imported = compileString(`import "./T.sol"; ${body}`, {
        solidityImportCompat: true, importResolver: resolver, rootFileId: '/main.sol',
      });
      const sameFile = compileString(`${escrowStruct} ${body}`, {
        solidityImportCompat: true, rootFileId: '/main.sol',
      });
      expect(imported.contractName).toBe('C');
      expect(imported.bytecode).toBe(sameFile.bytecode);
    });

    it('should dedup a symbol imported via both a wildcard and a named import', () => {
      const files: Record<string, string> = {
        '/lib/shapes.scash': `
          int constant MAX = 100;
          struct Point { int x; int y; }
          contract Shapes() { function ping() { require(true); } }
        `,
      };

      // `MAX` and `Point` each arrive via both imports of the same file; they must dedup, not redefine.
      const code = `
        import "./lib/shapes.scash";
        import { MAX, Point } from "./lib/shapes.scash";
        contract C() {
          int v;
          function go(int a) {
            require(a < MAX);
            this.v = a;
          }
        }
      `;

      expect(() => compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      })).not.toThrow();
    });

    it('should compile with in-memory selective import', () => {
      const files: Record<string, string> = {
        '/lib/constants.scash': `
          int constant MAX_AMOUNT = 1000000;
          int constant MIN_AMOUNT = 546;
          contract ConstLib() {
            function validate(int amount) {
              require(amount >= MIN_AMOUNT);
              require(amount <= MAX_AMOUNT);
            }
          }
        `,
      };

      const code = `
        import { MAX_AMOUNT } from "./lib/constants.scash";
        contract Spender() {
          function spend(int amount) {
            require(amount <= MAX_AMOUNT);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Spender');
    });

    it('should throw when imports exist but no resolver provided', () => {
      const code = `
        import "./lib/constants.scash";
        contract Spender() {
          function spend(int amount) {
            require(amount >= 546);
          }
        }
      `;

      expect(() => compileString(code)).toThrow('no importResolver provided');
    });

    it('should throw UnresolvedImportError when resolver returns undefined', () => {
      const code = `
        import "./nonexistent.scash";
        contract Spender() {
          function spend(int amount) {
            require(amount >= 546);
          }
        }
      `;

      const resolver = (): undefined => undefined;

      expect(() => compileString(code, {
        importResolver: resolver,
        rootFileId: '/main.scash',
      })).toThrow(UnresolvedImportError);
    });

    it('should handle nested imports (A imports B which imports C)', () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          int constant BASE_VALUE = 100;
          contract Base() {
            function check(int x) {
              require(x >= BASE_VALUE);
            }
          }
        `,
        '/lib/middle.scash': `
          import "./base.scash";
          int constant MIDDLE_VALUE = 200;
          contract Middle() {
            function check(int x) {
              require(x >= BASE_VALUE);
              require(x <= MIDDLE_VALUE);
            }
          }
        `,
      };

      const code = `
        import "./lib/middle.scash";
        contract Top() {
          function check(int x) {
            require(x >= BASE_VALUE);
            require(x <= MIDDLE_VALUE);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Top');
    });

    it('should compile with in-memory interface and implements', () => {
      const files: Record<string, string> = {
        '/lib/interfaces.scash': `
          interface IToken {
            function transfer(pubkey to, sig s, int amount);
          }
          contract InterfacePlaceholder() {
            function placeholder(int x) {
              require(x == 1);
            }
          }
        `,
      };

      const code = `
        import { IToken } from "./lib/interfaces.scash";
        contract Token() is IToken {
          function transfer(pubkey to, sig s, int amount) {
            require(amount > 0);
            require(checkSig(s, to));
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Token');
    });

    it('should deduplicate imports resolved to the same id', () => {
      let resolveCallCount = 0;
      const files: Record<string, string> = {
        '/lib/constants.scash': `
          int constant SHARED = 42;
          contract Shared() {
            function check(int x) {
              require(x == SHARED);
            }
          }
        `,
        '/lib/a.scash': `
          import { SHARED } from "./constants.scash";
          int constant A_VAL = 1;
          contract A() {
            function check(int x) {
              require(x == A_VAL);
            }
          }
        `,
        '/lib/b.scash': `
          import { SHARED } from "./constants.scash";
          int constant B_VAL = 2;
          contract B() {
            function check(int x) {
              require(x == B_VAL);
            }
          }
        `,
      };

      const baseResolver = createMapResolver(files);
      const trackingResolver = (importPath: string, currentFile: string): ResolvedImport | undefined => {
        resolveCallCount++;
        return baseResolver(importPath, currentFile);
      };

      const code = `
        import { A_VAL } from "./lib/a.scash";
        import { B_VAL } from "./lib/b.scash";
        contract Main() {
          function check(int x) {
            require(x == A_VAL);
            require(x == B_VAL);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: trackingResolver,
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Main');
      // Resolver is called 4 times: a.scash, constants.scash (from a), b.scash, constants.scash (from b)
      // But constants.scash is only parsed once - the second call returns the cached AST
      expect(resolveCallCount).toBe(4);
    });
  });

  describe('Interfaces', () => {
    it('should compile interface-only file', () => {
      expect(() => compileFile(path.join(fixtures, 'itoken.scash'))).not.toThrow();
    });

    it('should compile contract implementing interface', () => {
      const artifact = compileFile(path.join(fixtures, 'implements_ok.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Token');
    });

    it('should compile contract implementing interface with override modifier', () => {
      const artifact = compileFile(path.join(fixtures, 'implements_override.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Token');
    });

    it('should throw InterfaceComplianceError when function is missing', () => {
      expect(
        () => compileFile(path.join(fixtures, 'error_missing_function.scash')),
      ).toThrow(InterfaceComplianceError);
    });

    it('should throw InterfaceComplianceError when parameter types do not match', () => {
      expect(
        () => compileFile(path.join(fixtures, 'error_wrong_params.scash')),
      ).toThrow(InterfaceComplianceError);
    });

    it('should throw UndefinedInterfaceError when interface does not exist', () => {
      expect(
        () => compileFile(path.join(fixtures, 'error_undefined_interface.scash')),
      ).toThrow(UndefinedInterfaceError);
    });

    it('should compile inline interface (same file)', () => {
      const code = `
        interface IGreeter {
          function greet(int x);
        }
        contract Greeter() is IGreeter {
          function greet(int x) {
            require(x > 0);
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Greeter');
    });

    it('should compile contract implementing multiple interfaces', () => {
      const code = `
        interface ITransfer {
          function transfer(pubkey to, sig s, int amount);
        }
        interface IBalance {
          function balance(pubkey owner, sig s, int expected);
        }
        contract MultiImpl() is ITransfer, IBalance {
          function transfer(pubkey to, sig s, int amount) {
            require(amount > 0);
            require(checkSig(s, to));
          }
          function balance(pubkey owner, sig s, int expected) {
            require(checkSig(s, owner));
            require(expected > 0);
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('MultiImpl');
    });

    it('should compile interface with return types', () => {
      const code = `
        interface ICalc {
          function add(int a, int b) returns (int);
        }
        contract Calc() is ICalc {
          function add(int a, int b) internal returns (int) {
            return a + b;
          }
          function run(int a, int b) {
            int result = add(a, b);
            require(result > 0);
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Calc');
    });
  });

  describe('Interface inheritance', () => {
    it('should compile contract implementing an extended interface (file-based)', () => {
      const artifact = compileFile(path.join(fixtures, 'implements_extended.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('ExtToken');
    });

    it('should throw InterfaceComplianceError when inherited function is missing', () => {
      expect(
        () => compileFile(path.join(fixtures, 'error_missing_inherited.scash')),
      ).toThrow(InterfaceComplianceError);
    });

    it('should compile inline interface inheritance', () => {
      const code = `
        interface IBase {
          function foo(int x);
        }
        interface IChild is IBase {
          function bar(int y);
        }
        contract Impl() is IChild {
          function foo(int x) {
            require(x > 0);
          }
          function bar(int y) {
            require(y > 0);
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Impl');
    });

    it('should throw InterfaceComplianceError when parent interface function is missing (inline)', () => {
      const code = `
        interface IBase {
          function foo(int x);
        }
        interface IChild is IBase {
          function bar(int y);
        }
        contract Impl() is IChild {
          function bar(int y) {
            require(y > 0);
          }
        }
      `;
      expect(() => compileString(code)).toThrow(InterfaceComplianceError);
    });

    it('should compile interface with multiple parents', () => {
      const code = `
        interface IA {
          function a(int x);
        }
        interface IB {
          function b(int y);
        }
        interface IC is IA, IB {
          function c(int z);
        }
        contract Impl() is IC {
          function a(int x) {
            require(x > 0);
          }
          function b(int y) {
            require(y > 0);
          }
          function c(int z) {
            require(z > 0);
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Impl');
    });

    it('should compile transitive interface inheritance (A <- B <- C)', () => {
      const code = `
        interface IA {
          function a(int x);
        }
        interface IB is IA {
          function b(int y);
        }
        interface IC is IB {
          function c(int z);
        }
        contract Impl() is IC {
          function a(int x) {
            require(x > 0);
          }
          function b(int y) {
            require(y > 0);
          }
          function c(int z) {
            require(z > 0);
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Impl');
    });

    it('should throw InterfaceComplianceError when transitive inherited function is missing', () => {
      const code = `
        interface IA {
          function a(int x);
        }
        interface IB is IA {
          function b(int y);
        }
        interface IC is IB {
          function c(int z);
        }
        contract Impl() is IC {
          function b(int y) {
            require(y > 0);
          }
          function c(int z) {
            require(z > 0);
          }
        }
      `;
      expect(() => compileString(code)).toThrow(InterfaceComplianceError);
    });

    it('should throw UndefinedInterfaceError for undefined parent interface', () => {
      const code = `
        interface IChild is INonExistent {
          function foo(int x);
        }
        contract Impl() is IChild {
          function foo(int x) {
            require(x > 0);
          }
        }
      `;
      expect(() => compileString(code)).toThrow(UndefinedInterfaceError);
    });

    it('should throw CircularInterfaceInheritanceError for circular inheritance', () => {
      const code = `
        interface IA is IB {
          function a(int x);
        }
        interface IB is IA {
          function b(int y);
        }
        contract Impl() is IA {
          function a(int x) {
            require(x > 0);
          }
          function b(int y) {
            require(y > 0);
          }
        }
      `;
      expect(() => compileString(code)).toThrow(CircularInterfaceInheritanceError);
    });

    it('should allow child interface to override parent function signature', () => {
      const code = `
        interface IBase {
          function foo(int x);
        }
        interface IChild is IBase {
          function foo(int x);
          function bar(int y);
        }
        contract Impl() is IChild {
          function foo(int x) {
            require(x > 0);
          }
          function bar(int y) {
            require(y > 0);
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Impl');
    });

    it('should compile with in-memory imported interface inheritance', () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          interface IBase {
            function foo(int x);
          }
          contract BasePlaceholder() {
            function placeholder(int x) {
              require(x == 1);
            }
          }
        `,
        '/lib/child.scash': `
          import "./base.scash";
          interface IChild is IBase {
            function bar(int y);
          }
          contract ChildPlaceholder() {
            function placeholder(int x) {
              require(x == 1);
            }
          }
        `,
      };


      const code = `
        import { IChild } from "./lib/child.scash";
        contract Impl() is IChild {
          function foo(int x) {
            require(x > 0);
          }
          function bar(int y) {
            require(y > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Impl');
    });
  });

  describe('Contract Inheritance', () => {
    it('should compile child contract that inherits parent functions', () => {
      const artifact = compileFile(path.join(fixtures, 'child_contract.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('ChildContract');
      // Should have both child's validate and inherited check
      expect(artifact.abi.some((f) => f.name === 'validate')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'check')).toBe(true);
    });

    it('should compile child contract that overrides parent function', () => {
      const artifact = compileFile(path.join(fixtures, 'child_override.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('ChildOverride');
      expect(artifact.abi.some((f) => f.name === 'check')).toBe(true);
    });

    it('should throw MissingOverrideError when duplicate function lacks override', () => {
      expect(
        () => compileFile(path.join(fixtures, 'error_missing_override.scash')),
      ).toThrow(MissingOverrideError);
    });

    it('should compile transitive inheritance (grandparent -> parent -> child)', () => {
      const artifact = compileFile(path.join(fixtures, 'grandchild.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('GrandChild');
      // Should have all three functions
      expect(artifact.abi.some((f) => f.name === 'gpFunc')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'parentFunc')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'childFunc')).toBe(true);
    });

    it('should compile inline single inheritance', () => {
      const code = `
        contract Parent() {
          function parentFunc(int x) {
            require(x > 0);
          }
        }
      `;

      const files: Record<string, string> = {
        '/lib/parent.scash': code,
      };

      const childCode = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function childFunc(int y) {
            require(y > 0);
          }
        }
      `;


      const artifact = compileString(childCode, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Child');
      expect(artifact.abi.some((f) => f.name === 'parentFunc')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'childFunc')).toBe(true);
    });

    it('should compile multiple inheritance', () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract A() {
            function aFunc(int x) {
              require(x > 0);
            }
          }
        `,
        '/lib/b.scash': `
          contract B() {
            function bFunc(int y) {
              require(y > 0);
            }
          }
        `,
      };


      const code = `
        import "./lib/a.scash";
        import "./lib/b.scash";
        contract C() is A, B {
          function cFunc(int z) {
            require(z > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('C');
      expect(artifact.abi.some((f) => f.name === 'aFunc')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'bFunc')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'cFunc')).toBe(true);
    });

    it('should compile mixed inheritance and interfaces', () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          interface IToken {
            function transfer(pubkey to, sig s, int amount);
          }
          contract BaseContract() {
            function validate(int x) {
              require(x > 0);
            }
          }
        `,
      };


      const code = `
        import "./lib/base.scash";
        contract MyContract() is IToken, BaseContract {
          function transfer(pubkey to, sig s, int amount) {
            require(amount > 0);
            require(checkSig(s, to));
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('MyContract');
      expect(artifact.abi.some((f) => f.name === 'transfer')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'validate')).toBe(true);
    });

    it('should prepend parent constructor params to child', () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent(int maxAmount, bytes32 tokenId) {
            function check(int amount) {
              require(amount <= maxAmount);
              require(tokenId != 0x0000000000000000000000000000000000000000000000000000000000000000);
            }
          }
        `,
      };


      const code = `
        import "./lib/parent.scash";
        contract Child(int minAmount) is Parent {
          function validate(int amount) {
            require(amount >= minAmount);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Child');
      // Parent params should be prepended: maxAmount, tokenId, minAmount
      expect(artifact.constructorInputs).toHaveLength(3);
      expect(artifact.constructorInputs[0].name).toBe('maxAmount');
      expect(artifact.constructorInputs[1].name).toBe('tokenId');
      expect(artifact.constructorInputs[2].name).toBe('minAmount');
    });

    it('should throw CircularContractInheritanceError for circular contract inheritance via imports', () => {
      // Benign circular imports are now allowed; a genuine inheritance cycle across files is caught at
      // C3 linearization (not at the import level, which no longer rejects cycles).
      expect(
        () => compileFile(path.join(fixtures, 'error_circular_inherit_a.scash')),
      ).toThrow(CircularContractInheritanceError);
    });

    it('should throw CircularContractInheritanceError for circular inline inheritance', () => {
      const files: Record<string, string> = {
        '/lib/b.scash': `
          import "./a.scash";
          contract B() is A {
            function bFunc(int y) {
              require(y > 0);
            }
          }
        `,
        '/lib/a.scash': `
          import "./b.scash";
          contract A() is B {
            function aFunc(int x) {
              require(x > 0);
            }
          }
        `,
      };

      function createMapResolver2(fileMap: Record<string, string>) {
        function normalizePath(p: string): string {
          const parts = p.split('/');
          const result: string[] = [];
          for (const part of parts) {
            if (part === '.') continue;
            if (part === '..' && result.length > 0 && result[result.length - 1] !== '..') {
              result.pop();
            } else {
              result.push(part);
            }
          }
          return result.join('/');
        }

        return (importPath: string, currentFile: string): ResolvedImport | undefined => {
          const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
          let resolved = normalizePath(dir + importPath);
          if (!resolved.endsWith('.scash')) resolved += '.scash';
          const source = fileMap[resolved];
          if (source === undefined) return undefined;
          return { source, id: resolved };
        };
      }

      // Both contracts exist in separate files imported via the map resolver; the benign import cycle is
      // allowed, and the genuine inheritance cycle (A is B, B is A) is caught at C3 linearization.
      expect(
        () => compileString(`
          import "./lib/a.scash";
          contract C() is A {
            function cFunc(int z) {
              require(z > 0);
            }
          }
        `, { importResolver: createMapResolver2(files), rootFileId: '/main.scash' }),
      ).toThrow(CircularContractInheritanceError);
    });
  });

  describe('Diamond Inheritance', () => {

    it('should compile diamond inheritance (D is B, C; B is A; C is A)', () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract A() {
            function aFunc(int x) {
              require(x > 0);
            }
          }
        `,
        '/lib/b.scash': `
          import "./a.scash";
          contract B() is A {
            function bFunc(int y) {
              require(y > 0);
            }
          }
        `,
        '/lib/c.scash': `
          import "./a.scash";
          contract C() is A {
            function cFunc(int z) {
              require(z > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/b.scash";
        import "./lib/c.scash";
        contract D() is B, C {
          function dFunc(int w) {
            require(w > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('D');
      // D should have aFunc (from A, deduplicated), bFunc, cFunc, dFunc
      expect(artifact.abi.some((f) => f.name === 'aFunc')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'bFunc')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'cFunc')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'dFunc')).toBe(true);
      // aFunc should appear only once (deduplicated)
      expect(artifact.abi.filter((f) => f.name === 'aFunc')).toHaveLength(1);
    });

    it('should compile diamond with override at child level', () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract A() {
            function shared(int x) virtual {
              require(x > 0);
            }
          }
        `,
        '/lib/b.scash': `
          import "./a.scash";
          contract B() is A {
            function bOnly(int y) {
              require(y > 0);
            }
          }
        `,
        '/lib/c.scash': `
          import "./a.scash";
          contract C() is A {
            function cOnly(int z) {
              require(z > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/b.scash";
        import "./lib/c.scash";
        contract D() is B, C {
          function shared(int x) virtual override {
            require(x > 1);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('D');
      expect(artifact.abi.some((f) => f.name === 'shared')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'bOnly')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'cOnly')).toBe(true);
    });

    it('should compile diamond with state variables from common ancestor', () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract A() {
            int sharedState;
            function aFunc(int x) {
              require(x > 0);
            }
          }
        `,
        '/lib/b.scash': `
          import "./a.scash";
          contract B() is A {
            function bFunc(int y) {
              require(y > 0);
            }
          }
        `,
        '/lib/c.scash': `
          import "./a.scash";
          contract C() is A {
            function cFunc(int z) {
              require(z > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/b.scash";
        import "./lib/c.scash";
        contract D() is B, C {
          function dFunc(int w) {
            require(w > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('D');
    });

    it('should compile deep diamond (4 levels)', () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          contract Base() {
            function baseFunc(int x) {
              require(x > 0);
            }
          }
        `,
        '/lib/mid1.scash': `
          import "./base.scash";
          contract Mid1() is Base {
            function mid1Func(int y) {
              require(y > 0);
            }
          }
        `,
        '/lib/mid2.scash': `
          import "./base.scash";
          contract Mid2() is Base {
            function mid2Func(int z) {
              require(z > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/mid1.scash";
        import "./lib/mid2.scash";
        contract Leaf() is Mid1, Mid2 {
          function leafFunc(int w) {
            require(w > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Leaf');
      expect(artifact.abi.some((f) => f.name === 'baseFunc')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'mid1Func')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'mid2Func')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'leafFunc')).toBe(true);
      expect(artifact.abi.filter((f) => f.name === 'baseFunc')).toHaveLength(1);
    });

    it('should compile when one parent version dominates (B overrides shared, C inherits it unchanged)', () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract A() {
            function shared(int x) virtual {
              require(x > 0);
            }
          }
        `,
        '/lib/b.scash': `
          import "./a.scash";
          contract B() is A {
            function shared(int x) virtual override {
              require(x > 1);
            }
          }
        `,
        '/lib/c.scash': `
          import "./a.scash";
          contract C() is A {
            function cOnly(int z) {
              require(z > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/b.scash";
        import "./lib/c.scash";
        contract D() is B, C {
          function dFunc(int w) {
            require(w > 0);
          }
        }
      `;

      // B's override dominates C's unchanged inherited version from A (B is A), so no explicit
      // child override is needed - solc semantics.
      expect(
        () => compileString(code, {
          importResolver: createMapResolver(files),
          rootFileId: '/main.scash',
        }),
      ).not.toThrow();
    });

    it('should throw MissingOverrideError when both parents independently define same function', () => {
      const files: Record<string, string> = {
        '/lib/b.scash': `
          contract B() {
            function conflict(int y) {
              require(y > 0);
            }
          }
        `,
        '/lib/c.scash': `
          contract C() {
            function conflict(int z) {
              require(z > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/b.scash";
        import "./lib/c.scash";
        contract D() is B, C {
          function dFunc(int w) {
            require(w > 0);
          }
        }
      `;

      // Different origins (B vs C) -> DiamondInheritanceError
      expect(
        () => compileString(code, { importResolver: createMapResolver(files), rootFileId: '/main.scash' }),
      ).toThrow(DiamondInheritanceError);
    });

    it('should throw InheritanceNameCollisionError for non-function diamond conflict', () => {
      // Two parents define same-named state var independently (not from common ancestor)
      const files: Record<string, string> = {
        '/lib/b.scash': `
          contract B() {
            int counter;
            function bFunc(int y) {
              require(y > 0);
            }
          }
        `,
        '/lib/c.scash': `
          contract C() {
            int counter;
            function cFunc(int z) {
              require(z > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/b.scash";
        import "./lib/c.scash";
        contract D() is B, C {
          function dFunc(int w) {
            require(w > 0);
          }
        }
      `;

      expect(
        () => compileString(code, { importResolver: createMapResolver(files), rootFileId: '/main.scash' }),
      ).toThrow(InheritanceNameCollisionError);
    });

    it('should deduplicate constants from common ancestor in diamond', () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract A() {
            int constant MAX_VALUE = 1000;
            function aFunc(int x) {
              require(x <= MAX_VALUE);
            }
          }
        `,
        '/lib/b.scash': `
          import "./a.scash";
          contract B() is A {
            function bFunc(int y) {
              require(y > 0);
            }
          }
        `,
        '/lib/c.scash': `
          import "./a.scash";
          contract C() is A {
            function cFunc(int z) {
              require(z > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/b.scash";
        import "./lib/c.scash";
        contract D() is B, C {
          function dFunc(int w) {
            require(w > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('D');
    });
  });

  describe('Explicit Parent Constructor Invocation', () => {
    it('should compile child with explicit parent invocation', () => {
      const artifact = compileFile(path.join(fixtures, 'child_explicit_invocation.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('ChildExplicit');
      // Only child's param should be present (parent param substituted away)
      expect(artifact.constructorInputs).toHaveLength(1);
      expect(artifact.constructorInputs[0].name).toBe('limit');
      // Should have both functions
      expect(artifact.abi.some((f) => f.name === 'check')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'validate')).toBe(true);
    });

    it('should compile inline explicit parent invocation with expression args', () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent(int maxAmount, int minAmount) {
            function check(int amount) {
              require(amount <= maxAmount);
              require(amount >= minAmount);
            }
          }
        `,
      };


      const code = `
        import "./lib/parent.scash";
        contract Child(int limit) is Parent {
          constructor(int limit) Parent(limit * 2, limit / 2) {}
          function validate(int amount) {
            require(amount >= limit);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Child');
      // Only child's param - parent params substituted
      expect(artifact.constructorInputs).toHaveLength(1);
      expect(artifact.constructorInputs[0].name).toBe('limit');
    });

    it('should fall back to auto-prepend when no explicit invocation', () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent(int maxAmount) {
            function check(int amount) {
              require(amount <= maxAmount);
            }
          }
        `,
      };


      const code = `
        import "./lib/parent.scash";
        contract Child(int minAmount) is Parent {
          function validate(int amount) {
            require(amount >= minAmount);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      // Auto-prepend: maxAmount, minAmount
      expect(artifact.constructorInputs).toHaveLength(2);
      expect(artifact.constructorInputs[0].name).toBe('maxAmount');
      expect(artifact.constructorInputs[1].name).toBe('minAmount');
    });

    it('should throw ParentInvocationArgCountError for wrong arg count', () => {
      expect(
        () => compileFile(path.join(fixtures, 'error_wrong_invocation_arg_count.scash')),
      ).toThrow(ParentInvocationArgCountError);
    });

    it('should throw UndefinedParentInvocationError for unknown parent name', () => {
      expect(
        () => compileFile(path.join(fixtures, 'error_undefined_parent_invocation.scash')),
      ).toThrow(UndefinedParentInvocationError);
    });

    it('should linearize most-base-first sibling lists (Solidity C3 direction)', () => {
      // `is Base, Base1` with Base1 deriving Base is valid Solidity order; Python-direction C3 rejects it.
      const files: Record<string, string> = {
        '/lib/chain.scash': `
          contract Base {
            int public m_i;
            constructor(int j) {
              m_i = j;
            }
          }
          contract Base1 is Base {
            constructor(int k) Base(k) {}
          }
          contract Derived is Base, Base1 {
            constructor(int i) Base1(i) {}
          }
        `,
      };
      const code = `
        import "./lib/chain.scash";
        contract Final is Derived {
          constructor() Derived(4) {}
          function check() public {
            require(m_i == 4);
          }
        }
      `;
      expect(
        () => compileString(code, { importResolver: createMapResolver(files), rootFileId: '/main.scash' }),
      ).not.toThrow();
    });

    it('should inline a grandparent constructor invocation (ctor init chain)', () => {
      const files: Record<string, string> = {
        '/lib/chain.scash': `
          contract B {
            int public a;
            constructor(int x) {
              a = x;
            }
          }
          abstract contract C is B {
          }
        `,
      };
      const code = `
        import "./lib/chain.scash";
        contract D is C {
          constructor(int y) B(y + 1) {}
          function check(int expected) public {
            require(a == expected);
          }
        }
      `;
      const artifact = compileString(code, {
        importResolver: createMapResolver(files), rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.abi.some((f) => f.name === 'check')).toBe(true);
    });

    it('should route constructor modifier invocations to modifiers, not parent invocations', () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract A {
            constructor(int) {}
          }
        `,
      };
      const code = `
        import "./lib/a.scash";
        contract D is A {
          int public x;
          modifier m1(int v) {
            require(v >= 0);
            _;
          }
          constructor() m1(3) A(2) {
            x = 1;
          }
          function check() public {
            require(x == 1);
          }
        }
      `;
      expect(
        () => compileString(code, { importResolver: createMapResolver(files), rootFileId: '/main.scash' }),
      ).not.toThrow();
    });
  });

  describe('State Variable Visibility', () => {
    it('should compile contract with visibility modifiers on state variables', () => {
      const code = `
        contract Example() {
          public int pubVar;
          internal int intVar;
          private int privVar;
          int defaultVar;

          function read(pubkey owner, sig s) {
            require(checkSig(s, owner));
            require(this.pubVar > 0);
            require(this.intVar > 0);
            require(this.privVar > 0);
            require(this.defaultVar > 0);
          }
        }
      `;

      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Example');
    });

    it('should allow child to access public inherited state variable', () => {
      const artifact = compileFile(path.join(fixtures, 'child_access_public.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('ChildAccessPublic');
    });

    it('should allow child to access internal inherited state variable', () => {
      const artifact = compileFile(path.join(fixtures, 'child_access_internal.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('ChildAccessInternal');
    });

    it('should throw PrivateStateVariableAccessError when child accesses private inherited var', () => {
      expect(
        () => compileFile(path.join(fixtures, 'error_child_access_private.scash')),
      ).toThrow(PrivateStateVariableAccessError);
    });

    it('should allow private vars in the defining contract', () => {
      const code = `
        contract Direct() {
          private int secret;

          function read(pubkey owner, sig s) {
            require(checkSig(s, owner));
            require(this.secret > 0);
          }
        }
      `;

      const artifact = compileString(code);
      expect(artifact).toBeDefined();
    });

    it('default visibility is public (accessible from child)', () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            int defaultVar;
            function parentRead(pubkey owner, sig s) {
              require(checkSig(s, owner));
              require(this.defaultVar > 0);
            }
          }
        `,
      };


      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function childRead(pubkey owner, sig s) {
            require(checkSig(s, owner));
            require(this.defaultVar > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Child');
    });
  });

  describe('External State Variable Visibility', () => {
    it('should compile contract with external state variable', () => {
      const code = `
        contract Example() {
          external int extVar;
          int normalVar;

          function read(pubkey owner, sig s) {
            require(checkSig(s, owner));
            require(this.extVar > 0);
            require(this.normalVar > 0);
          }
        }
      `;

      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Example');
      // External var should be isolated to its own NFT
      expect(artifact.stateLayout!.variables[0].name).toBe('extVar');
      expect(artifact.stateLayout!.variables[0].nftIndex).toBe(0);
      expect(artifact.stateLayout!.variables[0].visibility).toBe('external');
      // Normal var should be on a different NFT
      expect(artifact.stateLayout!.variables[1].name).toBe('normalVar');
      expect(artifact.stateLayout!.variables[1].nftIndex).toBe(1);
      expect(artifact.stateLayout!.variables[1].visibility).toBeUndefined(); // public is default, omitted
    });

    it('should isolate multiple external vars into separate NFTs', () => {
      const code = `
        contract Example() {
          external int extA;
          external int extB;
          int normalVar;

          function read(pubkey owner, sig s) {
            require(checkSig(s, owner));
            require(this.extA > 0);
            require(this.extB > 0);
            require(this.normalVar > 0);
          }
        }
      `;

      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      // Each external var gets its own NFT
      expect(artifact.stateLayout!.variables[0].nftIndex).toBe(0); // extA
      expect(artifact.stateLayout!.variables[1].nftIndex).toBe(1); // extB
      expect(artifact.stateLayout!.variables[2].nftIndex).toBe(2); // normalVar
      expect(artifact.stateLayout!.dataNftCount).toBe(3);
    });

    it('should pack normal vars together but isolate external vars', () => {
      const code = `
        contract Example() {
          int varA;
          int varB;
          external int extVar;
          int varC;

          function read(pubkey owner, sig s) {
            require(checkSig(s, owner));
            require(this.varA > 0);
            require(this.varB > 0);
            require(this.extVar > 0);
            require(this.varC > 0);
          }
        }
      `;

      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      // varA and varB should be packed together on NFT 0
      expect(artifact.stateLayout!.variables[0].nftIndex).toBe(0); // varA
      expect(artifact.stateLayout!.variables[1].nftIndex).toBe(0); // varB
      // extVar should be isolated on NFT 1
      expect(artifact.stateLayout!.variables[2].nftIndex).toBe(1); // extVar
      expect(artifact.stateLayout!.variables[2].visibility).toBe('external');
      // varC should be on NFT 2 (after the external var)
      expect(artifact.stateLayout!.variables[3].nftIndex).toBe(2); // varC
    });
  });

  describe('Interface State Variables', () => {
    it('should compile interface with public state variable', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Counter() is ICounter {
          int counter;

          function increment(pubkey owner, sig s) {
            require(checkSig(s, owner));
            this.counter = this.counter + 1;
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Counter');
    });

    it('should compile interface with external state variable', () => {
      const code = `
        interface ICounter {
          external int counter;
          function increment(pubkey owner, sig s);
        }
        contract Counter() is ICounter {
          external int counter;

          function increment(pubkey owner, sig s) {
            require(checkSig(s, owner));
            this.counter = this.counter + 1;
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.stateLayout!.variables[0].visibility).toBe('external');
    });

    it('should allow external in contract when interface requires public', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Counter() is ICounter {
          external int counter;

          function increment(pubkey owner, sig s) {
            require(checkSig(s, owner));
            this.counter = this.counter + 1;
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
    });

    it('should throw InterfaceComplianceError when external required but public declared', () => {
      const code = `
        interface ICounter {
          external int counter;
          function increment(pubkey owner, sig s);
        }
        contract Counter() is ICounter {
          int counter;

          function increment(pubkey owner, sig s) {
            require(checkSig(s, owner));
            this.counter = this.counter + 1;
          }
        }
      `;
      expect(() => compileString(code)).toThrow(InterfaceComplianceError);
    });

    it('should throw InterfaceComplianceError when public required but internal declared', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Counter() is ICounter {
          internal int counter;

          function increment(pubkey owner, sig s) {
            require(checkSig(s, owner));
            this.counter = this.counter + 1;
          }
        }
      `;
      expect(() => compileString(code)).toThrow(InterfaceComplianceError);
    });

    it('should throw InterfaceComplianceError when state variable is missing', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Counter() is ICounter {
          function increment(pubkey owner, sig s) {
            require(checkSig(s, owner));
          }
        }
      `;
      expect(() => compileString(code)).toThrow(InterfaceComplianceError);
    });

    it('should throw InterfaceComplianceError when state variable type mismatches', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Counter() is ICounter {
          bool counter;

          function increment(pubkey owner, sig s) {
            require(checkSig(s, owner));
            require(this.counter);
          }
        }
      `;
      expect(() => compileString(code)).toThrow(InterfaceComplianceError);
    });

    it('should inherit state variables from parent interface', () => {
      const code = `
        interface IBase {
          public int baseVar;
        }
        interface IChild is IBase {
          external int childVar;
          function doSomething(pubkey owner, sig s);
        }
        contract Impl() is IChild {
          int baseVar;
          external int childVar;

          function doSomething(pubkey owner, sig s) {
            require(checkSig(s, owner));
            require(this.baseVar > 0);
            require(this.childVar > 0);
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
    });
  });

  describe('Libraries', () => {
    it('should compile contract importing library via wildcard', () => {
      const artifact = compileFile(path.join(fixtures, 'uses_library.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('UsesLibrary');
    });

    it('should compile contract importing library selectively', () => {
      const artifact = compileFile(path.join(fixtures, 'uses_library_selective.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('UsesLibrarySelective');
    });

    it('should throw LibraryNotCompilableError when compiling a library directly', () => {
      expect(
        () => compileFile(path.join(fixtures, 'math_lib.scash')),
      ).toThrow(LibraryNotCompilableError);
    });

    it('should compile with in-memory library import (namespaced)', () => {
      const files: Record<string, string> = {
        '/lib/utils.scash': `
          library Utils {
            function double(int x) returns (int) {
              return x + x;
            }
          }
        `,
      };


      const code = `
        import "./lib/utils.scash";
        contract Doubler() {
          function run(int x) {
            int result = Utils.double(x);
            require(result > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Doubler');
    });

    it('should compile with selective library import (namespaced)', () => {
      const files: Record<string, string> = {
        '/lib/utils.scash': `
          library Utils {
            function double(int x) returns (int) {
              return x + x;
            }
            function triple(int x) returns (int) {
              return x + x + x;
            }
          }
        `,
      };


      const code = `
        import { Utils } from "./lib/utils.scash";
        contract Doubler() {
          function run(int x) {
            int result = Utils.double(x);
            require(result > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Doubler');
    });

    it('should access namespaced library constants', () => {
      const files: Record<string, string> = {
        '/lib/utils.scash': `
          library MathLib {
            int constant MAX_VALUE = 1000000;
            function add(int a, int b) returns (int) {
              return a + b;
            }
          }
        `,
      };


      const code = `
        import "./lib/utils.scash";
        contract Checker() {
          function check(int x) {
            require(x <= MathLib.MAX_VALUE);
            int result = MathLib.add(x, 1);
            require(result > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Checker');
    });
  });

  describe('Cross-Contract External State Reads', () => {
    it('should compile contract reading external state variable via interface', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Reader(bytes32 counterCategory) {
          int total;
          function sync(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int val = ICounter(counterCategory).counter;
            this.total = val;
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Reader');
    });

    it('should include externalReads in the ABI function', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Reader(bytes counterAddr) {
          int total;
          function sync(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int val = ICounter(counterAddr).counter;
            this.total = val;
          }
        }
      `;
      const artifact = compileString(code);
      const syncFn = artifact.abi.find((f) => f.name === 'sync');
      expect(syncFn).toBeDefined();
      expect(syncFn!.externalReads).toBeDefined();
      expect(syncFn!.externalReads!.length).toBe(1);
      expect(syncFn!.externalReads![0].interfaceName).toBe('ICounter');
      expect(syncFn!.externalReads![0].kind).toBe('data');
      expect(syncFn!.externalReads![0].nftIndex).toBe(0);
      expect(syncFn!.externalReads![0].addressParam).toBe('counterAddr');
    });

    it('should include externalInterfaces in the artifact', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Reader(bytes32 counterCategory) {
          int total;
          function sync(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int val = ICounter(counterCategory).counter;
            this.total = val;
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact.externalInterfaces).toBeDefined();
      expect(artifact.externalInterfaces!.length).toBe(1);
      expect(artifact.externalInterfaces![0].name).toBe('ICounter');
      expect(artifact.externalInterfaces![0].stateLayout.variables.length).toBe(1);
      expect(artifact.externalInterfaces![0].stateLayout.variables[0].name).toBe('counter');
    });

    it('should compile interface with collection declaration', () => {
      const code = `
        interface IToken {
          public mapping(bytes20 => int) balances;
          function transfer(bytes20 from, bytes20 to, int amount, pubkey pk, sig s);
        }
        contract Reader(bytes32 tokenCategory) {
          int lastBalance;
          function readBalance(pubkey pk, sig s, bytes20 target) {
            require(checkSig(s, pk));
            int bal = IToken(tokenCategory).balances[target];
            this.lastBalance = bal;
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Reader');

      const readFn = artifact.abi.find((f) => f.name === 'readBalance');
      expect(readFn).toBeDefined();
      expect(readFn!.externalReads).toBeDefined();
      expect(readFn!.externalReads!.length).toBe(1);
      expect(readFn!.externalReads![0].kind).toBe('entry');
      expect(readFn!.externalReads![0].collectionName).toBe('balances');
    });

    it('should compile multiple reads from same interface (different vars, same NFT)', () => {
      const code = `
        interface ICounter {
          public int counter;
          public int total;
          function increment(pubkey owner, sig s);
        }
        contract Reader(bytes32 counterCategory) {
          int sum;
          function sync(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int c = ICounter(counterCategory).counter;
            int t = ICounter(counterCategory).total;
            this.sum = c + t;
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      const syncFn = artifact.abi.find((f) => f.name === 'sync');
      expect(syncFn).toBeDefined();
      // Both variables are on the same NFT (nftIndex 0), so only 1 external read slot
      expect(syncFn!.externalReads).toBeDefined();
      expect(syncFn!.externalReads!.length).toBe(1);
    });

    it('should compile a read of an nftIndex-0 external var', () => {
      const code = `
        interface IBigState {
          external int externalVar;
          public int normalVar;
          function doSomething(pubkey owner, sig s);
        }
        contract Reader(bytes bigStateAddr) {
          int result;
          function read(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int a = IBigState(bigStateAddr).externalVar;
            this.result = a;
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      const readFn = artifact.abi.find((f) => f.name === 'read');
      expect(readFn!.externalReads).toBeDefined();
      expect(readFn!.externalReads!.length).toBe(1);
    });

    it('should compile reads of multi-data-NFT external state (nftIndex >= 1)', () => {
      // normalVar lives on data-NFT index 1. Sound via the commitment nftIndex tag: the reader verifies
      // the co-spent NFT's tag == 1, so a substituted sibling NFT (different tag) is rejected on-chain.
      const code = `
        interface IBigState {
          external int externalVar;
          public int normalVar;
          function doSomething(pubkey owner, sig s);
        }
        contract Reader(bytes bigStateAddr) {
          int result;
          function read(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int b = IBigState(bigStateAddr).normalVar;
            this.result = b;
          }
        }
      `;
      const artifact = compileString(code);
      const readFn = artifact.abi.find((f) => f.name === 'read');
      expect(readFn!.externalReads!.length).toBe(1);
      expect(readFn!.externalReads![0].nftIndex).toBe(1);
    });

    it('should throw UndefinedExternalStateVariableError for unknown variable', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Reader(bytes32 counterCategory) {
          int total;
          function sync(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int val = ICounter(counterCategory).nonexistent;
            this.total = val;
          }
        }
      `;
      expect(() => compileString(code)).toThrow(UndefinedExternalStateVariableError);
    });

    it('should throw ExternalReadArgCountError for too many args', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Reader(bytes32 cat1, bytes32 cat2, bytes32 cat3) {
          int total;
          function sync(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int val = ICounter(cat1, cat2, cat3).counter;
            this.total = val;
          }
        }
      `;
      expect(() => compileString(code)).toThrow(ExternalReadArgCountError);
    });

    it('should compile external read with interface from parent', () => {
      const code = `
        interface IBase {
          public int baseVar;
        }
        interface IExtended is IBase {
          public int extendedVar;
          function doSomething(pubkey owner, sig s);
        }
        contract Reader(bytes32 extCategory) {
          int sum;
          function read(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int a = IExtended(extCategory).baseVar;
            int b = IExtended(extCategory).extendedVar;
            this.sum = a + b;
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      const readFn = artifact.abi.find((f) => f.name === 'read');
      expect(readFn!.externalReads).toBeDefined();
    });

    it('should compile interface collection compliance check', () => {
      const code = `
        interface IToken {
          public mapping(bytes20 => int) balances;
          function transfer(bytes20 from, bytes20 to, int amount, pubkey pk, sig s);
        }
        contract Token() is IToken {
          mapping(bytes20 => int) balances;
          function transfer(bytes20 from, bytes20 to, int amount, pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(this.balances[from] >= amount);
            this.balances[from] = this.balances[from] - amount;
            this.balances[to] = this.balances[to] + amount;
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Token');
    });
  });

  describe('External calls/reads on imported contracts', () => {
    it('should compile external state read via imported contract name', () => {
      const artifact = compileFile(path.join(fixtures, 'external_call_imported_contract.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('ExternalReader');

      const readFn = artifact.abi.find((f) => f.name === 'readBalance');
      expect(readFn).toBeDefined();
      expect(readFn!.externalReads).toBeDefined();
      expect(readFn!.externalReads!.length).toBe(1);
      expect(readFn!.externalReads![0].interfaceName).toBe('BaseContract');
      expect(readFn!.externalReads![0].kind).toBe('data');
      expect(readFn!.externalReads![0].nftIndex).toBe(0);
    });

    it('should include externalInterfaces in artifact for synthesized interface', () => {
      const artifact = compileFile(path.join(fixtures, 'external_call_imported_contract.scash'));
      expect(artifact.externalInterfaces).toBeDefined();
      expect(artifact.externalInterfaces!.length).toBe(1);
      expect(artifact.externalInterfaces![0].name).toBe('BaseContract');
      expect(artifact.externalInterfaces![0].stateLayout.variables.length).toBe(1);
      expect(artifact.externalInterfaces![0].stateLayout.variables[0].name).toBe('balance');
    });

    it('should compile external state read via imported contract using compileString', () => {
      const files: Record<string, string> = {
        '/counter.scash': `
          contract Counter() {
              int counter;

              function increment(pubkey owner, sig s) {
                  require(checkSig(s, owner));
                  this.counter = this.counter + 1;
              }
          }
        `,
      };

      const readerCode = `
        import "./counter.scash";
        contract Reader(bytes32 counterCategory) {
            int lastSeen;

            function sync(pubkey pk, sig s) {
                require(checkSig(s, pk));
                int val = Counter(counterCategory).counter;
                this.lastSeen = val;
            }
        }
      `;
      const artifact = compileString(readerCode, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Reader');

      const syncFn = artifact.abi.find((f) => f.name === 'sync');
      expect(syncFn).toBeDefined();
      expect(syncFn!.externalReads).toBeDefined();
      expect(syncFn!.externalReads!.length).toBe(1);
      expect(syncFn!.externalReads![0].interfaceName).toBe('Counter');
    });

    it('should compile outState read via imported contract name', () => {
      const files: Record<string, string> = {
        '/counter.scash': `
          contract Counter() {
              int counter;

              function increment(pubkey owner, sig s) {
                  require(checkSig(s, owner));
                  this.counter = this.counter + 1;
              }
          }
        `,
      };

      const callerCode = `
        import "./counter.scash";
        contract Caller(bytes32 counterCategory) {
            int lastSeen;

            function callIncrement(pubkey pk, sig s) {
                require(checkSig(s, pk));
                int newVal = Counter(counterCategory).outState.counter;
                this.lastSeen = newVal;
            }
        }
      `;
      const artifact = compileString(callerCode, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Caller');

      const fn = artifact.abi.find((f) => f.name === 'callIncrement');
      expect(fn).toBeDefined();
      expect(fn!.externalOutStateReads).toBeDefined();
      expect(fn!.externalOutStateReads!.length).toBe(1);
      expect(fn!.externalOutStateReads![0].interfaceName).toBe('Counter');
    });

    it('should only expose public/external state vars in synthesized interface', () => {
      const files: Record<string, string> = {
        '/private_state.scash': `
          contract PrivateState() {
              int public_var;
              private int private_var;

              function publicFn(pubkey pk, sig s) {
                  require(checkSig(s, pk));
                  this.public_var = this.public_var + 1;
              }
          }
        `,
      };

      const readerCode = `
        import "./private_state.scash";
        contract Reader(bytes32 category) {
            int result;

            function read(pubkey pk, sig s) {
                require(checkSig(s, pk));
                int val = PrivateState(category).public_var;
                this.result = val;
            }
        }
      `;
      const artifact = compileString(readerCode, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();

      // Verify synthesized interface only has public state var (private_var is excluded)
      expect(artifact.externalInterfaces).toBeDefined();
      expect(artifact.externalInterfaces!.length).toBe(1);
      expect(artifact.externalInterfaces![0].stateLayout.variables.length).toBe(1);
      expect(artifact.externalInterfaces![0].stateLayout.variables[0].name).toBe('public_var');
    });

    it('should throw for accessing private state var via imported contract', () => {
      const files: Record<string, string> = {
        '/private_state.scash': `
          contract PrivateState() {
              private int secret;

              function update(pubkey pk, sig s) {
                  require(checkSig(s, pk));
                  this.secret = this.secret + 1;
              }
          }
        `,
      };

      const readerCode = `
        import "./private_state.scash";
        contract Reader(bytes32 category) {
            int result;

            function read(pubkey pk, sig s) {
                require(checkSig(s, pk));
                int val = PrivateState(category).secret;
                this.result = val;
            }
        }
      `;
      expect(() => compileString(readerCode, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      })).toThrow(UndefinedExternalStateVariableError);
    });

    it('should prefer explicit interface over synthesized one', () => {
      const code = `
        interface Counter {
            public int counter;
            function increment(pubkey owner, sig s);
        }
        contract Reader(bytes32 counterCategory) {
            int lastSeen;

            function sync(pubkey pk, sig s) {
                require(checkSig(s, pk));
                int val = Counter(counterCategory).counter;
                this.lastSeen = val;
            }
        }
      `;
      // If explicit interface and imported contract have the same name,
      // the explicit interface should be used (no error from synthesization)
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Reader');
    });
  });

  describe('Address-based instantiation', () => {
    it('should compile external state read with an address arg', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Reader(bytes counterAddr) {
          int lastSeen;
          function sync(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int val = ICounter(counterAddr).counter;
            this.lastSeen = val;
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      const syncFn = artifact.abi.find((f) => f.name === 'sync');
      expect(syncFn).toBeDefined();
      expect(syncFn!.externalReads).toBeDefined();
      expect(syncFn!.externalReads!.length).toBe(1);
      expect(syncFn!.externalReads![0].addressParam).toBe('counterAddr');
    });

    it('should compile external function call with an address arg', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment() returns (int);
        }
        contract Caller(bytes counterAddr) {
          int lastSeen;
          function callIncrement(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int result = ICounter(counterAddr).increment();
            this.lastSeen = result;
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      const fn = artifact.abi.find((f) => f.name === 'callIncrement');
      expect(fn).toBeDefined();
      expect(fn!.externalCalls).toBeDefined();
      expect(fn!.externalCalls!.length).toBe(1);
      expect(fn!.externalCalls![0].addressParam).toBe('counterAddr');
    });

    it('should compile external outState read with an address arg', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment() returns (int);
        }
        contract Observer(bytes counterAddr) {
          int lastSeen;
          function observe(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int result = ICounter(counterAddr).increment();
            int val = ICounter(counterAddr).outState.counter;
            this.lastSeen = val + result;
          }
        }
      `;
      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      const fn = artifact.abi.find((f) => f.name === 'observe');
      expect(fn).toBeDefined();
      expect(fn!.externalOutStateReads).toBeDefined();
      expect(fn!.externalOutStateReads!.length).toBe(1);
      expect(fn!.externalOutStateReads![0].addressParam).toBe('counterAddr');
    });

    it('should throw ExternalAccessOnUnconnectedError for 0x state access', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Reader() {
          int total;
          function sync(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int val = ICounter(0x).counter;
            this.total = val;
          }
        }
      `;
      expect(() => compileString(code)).toThrow(ExternalAccessOnUnconnectedError);
    });

    it('should throw ExternalAccessOnUnconnectedError for 0x method call', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment() returns (int);
        }
        contract Caller() {
          int total;
          function callIt(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int result = ICounter(0x).increment();
            this.total = result;
          }
        }
      `;
      expect(() => compileString(code)).toThrow(ExternalAccessOnUnconnectedError);
    });

    it('should throw ExternalAccessOnUnconnectedError for 0x outState access', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Observer() {
          int total;
          function observe(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int val = ICounter(0x).outState.counter;
            this.total = val;
          }
        }
      `;
      expect(() => compileString(code)).toThrow(ExternalAccessOnUnconnectedError);
    });

    it('should throw ExternalReadArgCountError for 0 args', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Reader() {
          int total;
          function sync(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int val = ICounter().counter;
            this.total = val;
          }
        }
      `;
      expect(() => compileString(code)).toThrow(ExternalReadArgCountError);
    });

    it('should throw ExternalReadArgCountError for 3+ args', () => {
      const code = `
        interface ICounter {
          public int counter;
          function increment(pubkey owner, sig s);
        }
        contract Reader(bytes32 a, bytes32 b, bytes32 c) {
          int total;
          function sync(pubkey pk, sig s) {
            require(checkSig(s, pk));
            int val = ICounter(a, b, c).counter;
            this.total = val;
          }
        }
      `;
      expect(() => compileString(code)).toThrow(ExternalReadArgCountError);
    });
  });

  describe('Library-level enum, type, and event imports', () => {
    it('should import enum from library via wildcard', () => {
      const files: Record<string, string> = {
        '/lib/roles.scash': `
          library Roles {
            enum Role { None, Admin, Moderator, User }
          }
        `,
      };

      const code = `
        import "./lib/roles.scash";
        contract AccessControl() {
          function checkAdmin(int role, pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(role == int(Role.Admin));
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('AccessControl');
    });

    it('should import enum from library via selective import', () => {
      const files: Record<string, string> = {
        '/lib/roles.scash': `
          library Roles {
            enum Role { None, Admin, Moderator, User }
          }
        `,
      };

      const code = `
        import { Roles } from "./lib/roles.scash";
        contract AccessControl() {
          function checkAdmin(int role, pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(role == int(Role.Admin));
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('AccessControl');
    });

    it('should import event from library and emit in contract', () => {
      const files: Record<string, string> = {
        '/lib/events.scash': `
          library Events {
            event Transfer(bytes20 indexed from, bytes20 indexed to, int amount);
          }
        `,
      };

      const code = `
        import "./lib/events.scash";
        contract Token(pubkey owner) {
          int totalTransferred;
          function transfer(bytes20 to, int amount, sig s) {
            require(checkSig(s, owner));
            require(amount > 0);
            this.totalTransferred = this.totalTransferred + amount;
            emit Transfer(hash160(owner), to, amount);
          }
          function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Token');
    });

    it('should import enum from interface via selective import', () => {
      const files: Record<string, string> = {
        '/lib/imarket.scash': `
          interface IMarket {
            enum Status { Open, Closed }
            event Sold(int indexed itemId, int price);
            public int itemCount;
            function list(int price);
          }
          contract Placeholder() {
            function dummy(pubkey pk, sig s) { require(checkSig(s, pk)); }
          }
        `,
      };

      const code = `
        import { IMarket } from "./lib/imarket.scash";
        contract Market() {
          int itemCount;
          function list(int price, pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(price > 0);
            int status = int(Status.Open);
            require(status == 0);
            this.itemCount = this.itemCount + 1;
            emit Sold(this.itemCount, price);
          }
          function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Market');
    });

    it('should import enum and event from library via wildcard', () => {
      const files: Record<string, string> = {
        '/lib/defs.scash': `
          library Defs {
            enum Color { Red, Green, Blue }
            event ColorChanged(int indexed id, int color);
          }
        `,
      };

      const code = `
        import "./lib/defs.scash";
        contract Palette() {
          int currentColor;
          function setColor(int colorVal, pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(colorVal == int(Color.Red) || colorVal == int(Color.Green) || colorVal == int(Color.Blue));
            this.currentColor = colorVal;
            emit ColorChanged(0, colorVal);
          }
          function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Palette');
    });

    it('should import enum from namespace import', () => {
      const files: Record<string, string> = {
        '/lib/roles.scash': `
          library Roles {
            enum Role { None, Admin, Moderator }
          }
        `,
      };

      const code = `
        import "./lib/roles.scash" as RolesLib;
        contract AccessControl() {
          function checkModerator(int role, pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(role == int(Role.Moderator));
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('AccessControl');
    });

    it('should import enum from file-level via selective import', () => {
      const files: Record<string, string> = {
        '/lib/enums.scash': `
          enum Direction { Up, Down, Left, Right }
          contract Placeholder() {
            function dummy(pubkey pk, sig s) { require(checkSig(s, pk)); }
          }
        `,
      };

      const code = `
        import { Direction } from "./lib/enums.scash";
        contract Navigator() {
          function go(int dir, pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(dir == int(Direction.Up) || dir == int(Direction.Right));
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Navigator');
    });
  });

  describe('npm-style (non-relative) imports', () => {
    it('should resolve scoped package import', () => {
      const files: Record<string, string> = {
        '@solidcash/lib/utils.scash': `
          int constant MAX_AMOUNT = 10000;
          contract Placeholder() {
            function dummy(pubkey pk, sig s) { require(checkSig(s, pk)); }
          }
        `,
      };

      const code = `
        import "@solidcash/lib/utils.scash";
        contract Vault() {
          function withdraw(int amount, pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(amount <= MAX_AMOUNT);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Vault');
    });

    it('should resolve bare package import', () => {
      const files: Record<string, string> = {
        'mylib/helpers.scash': `
          int constant FEE = 1000;
          contract Placeholder() {
            function dummy(pubkey pk, sig s) { require(checkSig(s, pk)); }
          }
        `,
      };

      const code = `
        import "mylib/helpers.scash";
        contract PayWithFee() {
          function pay(int amount, pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(amount > FEE);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('PayWithFee');
    });

    it('should resolve nested npm import from imported file', () => {
      const files: Record<string, string> = {
        '@scope/base/constants.scash': `
          int constant BASE_FEE = 500;
          contract Placeholder() {
            function dummy(pubkey pk, sig s) { require(checkSig(s, pk)); }
          }
        `,
        '@scope/app/fees.scash': `
          import "@scope/base/constants.scash";
          contract Placeholder2() {
            function dummy(int amount, pubkey pk, sig s) {
              require(checkSig(s, pk));
              require(amount >= BASE_FEE);
            }
          }
        `,
      };

      const code = `
        import "@scope/app/fees.scash";
        contract FeeCollector() {
          function collect(int amount, pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(amount >= BASE_FEE);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('FeeCollector');
    });

    it('should throw UnresolvedImportError for missing npm package', () => {
      const code = `
        import "@nonexistent/pkg/module.scash";
        contract Test() {
          function test(pubkey pk, sig s) { require(checkSig(s, pk)); }
        }
      `;

      expect(
        () => compileString(code, { importResolver: createMapResolver({}), rootFileId: '/main.scash' }),
      ).toThrow(UnresolvedImportError);
    });

    it('should mix relative and npm-style imports', () => {
      const files: Record<string, string> = {
        '/lib/local.scash': `
          int constant LOCAL_VAL = 42;
          contract Placeholder() {
            function dummy(pubkey pk, sig s) { require(checkSig(s, pk)); }
          }
        `,
        'extlib/remote.scash': `
          int constant REMOTE_VAL = 99;
          contract Placeholder2() {
            function dummy(pubkey pk, sig s) { require(checkSig(s, pk)); }
          }
        `,
      };

      const code = `
        import "./lib/local.scash";
        import "extlib/remote.scash";
        contract Mixer() {
          function mix(int x, pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(x == LOCAL_VAL + REMOTE_VAL);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Mixer');
    });

    it('should auto-append .scash extension for npm imports', () => {
      const files: Record<string, string> = {
        'mylib/utils.scash': `
          int constant UTIL_VAL = 7;
          contract Placeholder() {
            function dummy(pubkey pk, sig s) { require(checkSig(s, pk)); }
          }
        `,
      };

      const code = `
        import "mylib/utils";
        contract User() {
          function use(pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(UTIL_VAL == 7);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('User');
    });
  });

  describe('Abstract Contracts', () => {
    it('should throw AbstractContractNotCompilableError when compiling an abstract contract directly', () => {
      const code = `
        abstract contract Base() {
          function foo(int x);
        }
      `;

      expect(
        () => compileString(code, { rootFileId: '/main.scash' }),
      ).toThrow(AbstractContractNotCompilableError);
    });

    it('should throw AbstractFunctionInConcreteContractError for bodyless function in concrete contract', () => {
      const code = `
        contract Foo() {
          function bar(int x);
          function baz(int y) {
            require(y > 0);
          }
        }
      `;

      expect(
        () => compileString(code, { rootFileId: '/main.scash' }),
      ).toThrow(AbstractFunctionInConcreteContractError);
    });

    it('should compile concrete contract inheriting from abstract contract', () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          abstract contract Base() {
            function foo(int x);
          }
        `,
      };

      const code = `
        import "./lib/base.scash";
        contract Child() is Base {
          function foo(int x) override {
            require(x > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Child');
      expect(artifact.abi.some((f) => f.name === 'foo')).toBe(true);
    });

    it('should throw UnimplementedAbstractFunctionError when concrete contract does not implement abstract function', () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          abstract contract Base() {
            function foo(int x);
          }
        `,
      };

      const code = `
        import "./lib/base.scash";
        contract Child() is Base {
          function bar(int y) {
            require(y > 0);
          }
        }
      `;

      expect(
        () => compileString(code, {
          importResolver: createMapResolver(files),
          rootFileId: '/main.scash',
        }),
      ).toThrow(UnimplementedAbstractFunctionError);
    });

    it('should compile abstract chain: A abstract -> B abstract -> C concrete', () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          abstract contract A() {
            function foo(int x);
          }
        `,
        '/lib/b.scash': `
          import "./a.scash";
          abstract contract B() is A {
            function bar(int y);
          }
        `,
      };

      const code = `
        import "./lib/b.scash";
        contract C() is B {
          function foo(int x) override {
            require(x > 0);
          }
          function bar(int y) override {
            require(y > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('C');
      expect(artifact.abi.some((f) => f.name === 'foo')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'bar')).toBe(true);
    });

    it('should compile abstract contract with mix of concrete and abstract functions', () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          abstract contract Base() {
            function abstractFn(int x);
            function concreteFn(int y) {
              require(y > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/base.scash";
        contract Child() is Base {
          function abstractFn(int x) override {
            require(x > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Child');
      expect(artifact.abi.some((f) => f.name === 'abstractFn')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'concreteFn')).toBe(true);
    });

    it('should compile abstract contract with state variables inherited by concrete child', () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          abstract contract Base() {
            int counter;
            function increment();
          }
        `,
      };

      const code = `
        import "./lib/base.scash";
        contract Child() is Base {
          function increment() override {
            this.counter = this.counter + 1;
            require(this.counter > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.stateLayout?.variables).toHaveLength(1);
      expect(artifact.stateLayout!.variables[0].name).toBe('counter');
    });

    it('should compile abstract contract with return types on abstract function', () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          abstract contract Base() {
            function getValue(int x) internal returns (int);
            function check(int x) {
              int v = getValue(x);
              require(v > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/base.scash";
        contract Child() is Base {
          function getValue(int x) internal override returns (int) {
            return x * 2;
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Child');
    });
  });

  describe('Diamond Inheritance Fixes', () => {
    it('should throw DiamondInheritanceError when both parents override same ancestor function', () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract A() {
            function shared(int x) virtual {
              require(x > 0);
            }
          }
        `,
        '/lib/b.scash': `
          import "./a.scash";
          contract B() is A {
            function shared(int x) virtual override {
              require(x > 1);
            }
          }
        `,
        '/lib/c.scash': `
          import "./a.scash";
          contract C() is A {
            function shared(int x) virtual override {
              require(x > 2);
            }
          }
        `,
      };

      const code = `
        import "./lib/b.scash";
        import "./lib/c.scash";
        contract D() is B, C {
          function dFunc(int w) {
            require(w > 0);
          }
        }
      `;

      expect(
        () => compileString(code, {
          importResolver: createMapResolver(files),
          rootFileId: '/main.scash',
        }),
      ).toThrow(DiamondInheritanceError);
    });

    it('should compile when child explicitly overrides diamond conflict', () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract A() {
            function shared(int x) virtual {
              require(x > 0);
            }
          }
        `,
        '/lib/b.scash': `
          import "./a.scash";
          contract B() is A {
            function shared(int x) virtual override {
              require(x > 1);
            }
          }
        `,
        '/lib/c.scash': `
          import "./a.scash";
          contract C() is A {
            function shared(int x) virtual override {
              require(x > 2);
            }
          }
        `,
      };

      const code = `
        import "./lib/b.scash";
        import "./lib/c.scash";
        contract D() is B, C {
          function shared(int x) virtual override {
            require(x > 3);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('D');
      expect(artifact.abi.some((f) => f.name === 'shared')).toBe(true);
    });

    it('should preserve state variable ordering through multi-level inheritance', () => {
      const files: Record<string, string> = {
        '/lib/grandparent.scash': `
          contract GrandParent() {
            int sv1;
            int sv2;
            function gpFunc(int x) {
              this.sv1 = x;
              this.sv2 = x + 1;
              require(this.sv1 > 0);
            }
          }
        `,
        '/lib/parent.scash': `
          import "./grandparent.scash";
          contract Parent() is GrandParent {
            int sv3;
            function pFunc(int x) {
              this.sv3 = x;
              require(this.sv3 > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          int sv4;
          function cFunc(int x) {
            this.sv4 = x;
            require(this.sv4 > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      const vars = artifact.stateLayout!.variables;
      expect(vars).toHaveLength(4);
      expect(vars[0].name).toBe('sv1');
      expect(vars[1].name).toBe('sv2');
      expect(vars[2].name).toBe('sv3');
      expect(vars[3].name).toBe('sv4');
    });

    it('should preserve constant ordering through multi-level inheritance', () => {
      const files: Record<string, string> = {
        '/lib/grandparent.scash': `
          contract GrandParent() {
            int constant C1 = 10;
            int constant C2 = 20;
            function gpFunc(int x) {
              require(x <= C1 + C2);
            }
          }
        `,
        '/lib/parent.scash': `
          import "./grandparent.scash";
          contract Parent() is GrandParent {
            int constant C3 = 30;
            function pFunc(int x) {
              require(x <= C3);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          int constant C4 = 40;
          function cFunc(int x) {
            require(x <= C4);
          }
        }
      `;

      // Should compile without error - ordering should be C1, C2, C3, C4
      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
    });

    it('should require explicit override when one parent overrides and the other passes through', () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract A() {
            function shared(int x) virtual {
              require(x > 0);
            }
          }
        `,
        '/lib/b.scash': `
          import "./a.scash";
          contract B() is A {
            function shared(int x) virtual override {
              require(x > 1);
            }
          }
        `,
        '/lib/c.scash': `
          import "./a.scash";
          contract C() is A {
            function cOnly(int z) {
              require(z > 0);
            }
          }
        `,
      };

      // D inherits B (which overrides shared) and C (which passes through shared from A)
      // Since B's override is inherited (not D's own), D should explicitly override
      const code = `
        import "./lib/b.scash";
        import "./lib/c.scash";
        contract D() is B, C {
          function shared(int x) virtual override {
            require(x > 2);
          }
          function dFunc(int w) {
            require(w > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('D');
      expect(artifact.abi.some((f) => f.name === 'shared')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'cOnly')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'dFunc')).toBe(true);
    });

    it('should inherit type definitions through inheritance chain', () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            type Amount is int;
            function check(int x) {
              require(x > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function validate(int y) {
            require(y > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Child');
    });
  });

  describe('Contract Deployment (new Contract(...))', () => {
    it('should compile new Contract(args) - bytecode-only deployment', () => {
      const artifact = compileFile(path.join(fixtures, 'deploy_bytecode_only.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('DeployBytecodeOnly');
      expect(artifact.bytecode).toBeDefined();
    });

    it('should compile new Contract() - zero-arg deployment', () => {
      const artifact = compileFile(path.join(fixtures, 'deploy_no_args_target.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('DeployNoArgsTarget');
      expect(artifact.bytecode).toBeDefined();
    });

    it('should compile new Contract{salt: salt}(args) - salted deployment', () => {
      const artifact = compileFile(path.join(fixtures, 'deploy_with_salt.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('DeployWithSalt');
      expect(artifact.bytecode).toBeDefined();
    });

    it('should compile new Contract{value: amount}(args) - value transfer deployment in stateful contract', () => {
      const artifact = compileFile(path.join(fixtures, 'deploy_with_value.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('DeployWithValue');
      expect(artifact.bytecode).toBeDefined();
    });

    it('should compile deployment with both value and salt via inline code', () => {
      const files: Record<string, string> = {
        '/target.scash': `
          contract Target(bytes20 pkh) {
            function spend(pubkey pk, sig s) {
              require(hash160(pk) == pkh);
              require(checkSig(s, pk));
            }
          }
        `,
      };

      const code = `
        import "./target.scash";
        contract Deployer() {
          int count;
          function run(pubkey pk, sig s, bytes20 targetPkh, bytes salt, int amount) {
            require(checkSig(s, pk));
            bytes lbc = new Target{value: amount, salt: salt}(targetPkh);
            require(tx.outputs[0].lockingBytecode == lbc);
            this.count = this.count + 1;
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Deployer');
    });

    it('should throw AbstractContractNotCompilableError when deploying abstract contract', () => {
      expect(() => {
        compileFile(path.join(fixtures, 'error_deploy_abstract.scash'));
      }).toThrow(AbstractContractNotCompilableError);
    });

    it('deploying a stateful contract in a function implies the deploy (parent is made stateful)', () => {
      // `new BaseContract(100)` in a plain function no longer errors: instantiating a stateful child IS a
      // deploy, so the parent is made stateful to host it (the `deploy` modifier is implied).
      const artifact = compileFile(path.join(fixtures, 'error_deploy_stateful.scash'));
      expect(artifact.contractName).toBe('ErrorDeployStateful');
    });

    it('should throw DeployValueInNonStatefulError when using {value} in non-stateful contract', () => {
      expect(() => {
        compileFile(path.join(fixtures, 'error_deploy_value_non_stateful.scash'));
      }).toThrow(DeployValueInNonStatefulError);
    });

    it('should throw ContractConstructorArgCountError for wrong arg count', () => {
      const files: Record<string, string> = {
        '/target.scash': `
          contract Target(bytes20 pkh) {
            function spend(pubkey pk, sig s) {
              require(hash160(pk) == pkh);
              require(checkSig(s, pk));
            }
          }
        `,
      };

      const code = `
        import "./target.scash";
        contract WrongArgs() {
          function test(pubkey pk, sig s) {
            require(checkSig(s, pk));
            bytes lbc = new Target();
          }
        }
      `;

      expect(() => {
        compileString(code, {
          importResolver: createMapResolver(files),
          rootFileId: '/main.scash',
        });
      }).toThrow(ContractConstructorArgCountError);
    });

    it('should compute locking bytecode as bytes type', () => {
      const files: Record<string, string> = {
        '/target.scash': `
          contract Target(bytes20 pkh) {
            function spend(pubkey pk, sig s) {
              require(hash160(pk) == pkh);
              require(checkSig(s, pk));
            }
          }
        `,
      };

      const code = `
        import "./target.scash";
        contract BytecodeUser() {
          function test(pubkey pk, sig s, bytes20 targetPkh) {
            require(checkSig(s, pk));
            bytes lbc = new Target(targetPkh);
            // Can compare with other bytes
            require(lbc == tx.outputs[0].lockingBytecode);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('BytecodeUser');
    });

    it('should compile stateful contract deployment in deploy function', () => {
      const artifact = compileFile(path.join(fixtures, 'deploy_stateful_factory.scash'));
      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('DeployStatefulFactory');

      const deployFn = artifact.abi.find((f) => f.name === 'deployChild');
      expect(deployFn).toBeDefined();
      expect(deployFn!.deployTargets).toBeDefined();
      expect(deployFn!.deployTargets).toHaveLength(1);
      expect(deployFn!.deployTargets![0].contractName).toBe('DeployStatefulTarget');
      expect(deployFn!.deployTargets![0].dataNftCount).toBe(1);
    });

    it('honors salt for create2 deployment (baked as a <salt> OP_DROP address segment, not a no-op)', () => {
      // salt is no longer ignored: `new T{salt}(...)` bakes a deterministic, salt-distinguished p2sh address
      // (composed with the category self-pin for stateful targets). Parity with the SDK Contract salt is
      // covered by the create2 e2e in ContractDeployment.test.ts.
      const artifact = compileFile(path.join(fixtures, 'deploy_with_salt.scash'));
      expect(artifact).toBeDefined();
      const run = artifact.abi.find((f) => f.name === 'run');
      expect(run).toBeDefined();
    });
  });

  describe('constants-only pure library (gnosis Math shape)', () => {
    // `uint public constant` parses as a state variable; it must not make the library look state-touching
    // (auto-delegate + pure is invalid) and must be importable + usable via `using L for *`.
    it('compiles the library standalone (no delegate marking, sibling constant resolves)', () => {
      const artifact = compileFile(path.join(fixtures, 'pure_library_constants.sol'), { solidityImportCompat: true });
      expect(artifact.contractName).toBe('PureMath');
    });

    it('compiles a consumer using the imported library and its namespaced constant', () => {
      const artifact = compileFile(path.join(fixtures, 'pure_library_consumer.sol'), { solidityImportCompat: true });
      expect(artifact.contractName).toBe('PureLibConsumer');
    });
  });

  describe('using-for on a known library with no registrable functions', () => {
    it('accepts an empty library as a no-op binding', () => {
      const src = 'library L {}\ncontract C { using L for *; function f() public pure { require(true); } }';
      expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
    });

    it('still rejects an unknown library name', () => {
      const src = 'contract C { using Nope for *; function f() public pure { require(true); } }';
      expect(() => compileString(src, { solidityImportCompat: true })).toThrow(/Nope/);
    });
  });
});
