import { ParseTree, ParseTreeVisitor, ParserRuleContext } from 'antlr4';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { parseType, MappingType, ArrayType, StructType, IntType, FixedType, FunctionType, Type, AddressType, ValueType, BytesType, PrimitiveType, EnumType, implicitlyCastable, isChunkPackableElementType, computeErc7201SlotNumber } from '@solidcash/utils';
import semver from 'semver';
import {
  Node,
  SourceFileNode,
  ContractNode,
  ParameterNode,
  VariableDefinitionNode,
  FunctionDefinitionNode,
  AssignNode,
  AssignmentExpressionNode,
  IdentifierNode,
  BranchNode,
  CastNode,
  FunctionCallNode,
  IndirectCallNode,
  UnaryOpNode,
  BinaryOpNode,
  BoolLiteralNode,
  IntLiteralNode,
  DecimalLiteralNode,
  HexLiteralNode,
  StringLiteralNode,
  ExpressionNode,
  StatementNode,
  LiteralNode,
  BlockNode,
  TimeOpNode,
  ArrayNode,
  ArrayAccessNode,
  ArrayPushNode,
  ArrayPopNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  StateArrayPushNode,
  StateArrayPopNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  NewArrayNode,
  TupleIndexOpNode,
  RequireNode,
  InstantiationNode,
  TupleAssignmentNode,
  NullaryOpNode,
  ConsoleStatementNode,
  ConsoleParameterNode,
  SliceNode,
  DoWhileNode,
  WhileNode,
  AssemblyStatementNode,
  StateVariableNode,
  StateAccessNode,
  StateAssignNode,
  CollectionNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingFieldAssignNode,
  DeleteLocalNode,
  DeleteStateNode,
  MappingDeleteNode,
  AbiEncodeNode,
  AbiEncodePackedNode,
  AbiEncodeWithSelectorNode,
  AbiEncodeWithSignatureNode,
  AbiEncodeCallNode,
  BytesConcatNode,
  StringConcatNode,
  AbiDecodeNode,
  AbiDecodeAtNode,
  StructDefinitionNode,
  FieldAccessNode,
  EventDefinitionNode,
  EmitStatementNode,
  TransferStatementNode,
  SelfdestructStatementNode,
  TokenContainerMethodStatementNode,
  FunctionModifier,
  ReturnNode,
  FunctionCallStatementNode,
  ExpressionStatementNode,
  ConstantDefinitionNode,
  EnumDefinitionNode,
  TypeDefinitionNode,
  ModifierDefinitionNode,
  PlaceholderStatementNode,
  CustomModifierInvocation,
  TernaryOpNode,
  BreakNode,
  ContinueNode,
  TryCatchNode,
  CatchClauseNode,
  ImportNode,
  InterfaceNode,
  InterfaceStateVariableNode,
  InterfaceFunctionNode,
  InterfaceCollectionNode,
  ParentInvocation,
  StateVariableVisibility,
  ErrorDefinitionNode,
  RevertNode,
  AssertNode,
  MethodCallNode,
  MethodCallStatementNode,
  AddressTransferStatementNode,
  AddressSendExpressionNode,
  LowLevelCallStatementNode,
  CallOptions,
  CollectionIterationNode,
  CollectionIterationMode,
  TypeIntrospectionNode,
  UncheckedNode,
  SwitchNode,
  SwitchCaseNode,
  UsingForDirectiveNode,
  UsingForBinding,
} from './AST.js';
import { cloneNode } from './clone.js';
import { createDefaultValueExpression } from './defaults.js';
import { UnaryOperator, BinaryOperator, NullaryOperator } from './Operator.js';
import type {
  ContractDefinitionContext,
  ConstructorDefinitionContext,
  FunctionDefinitionContext,
  VariableDefinitionContext,
  TupleAssignmentContext,
  TupleSlotContext,
  ParameterContext,
  PlaceholderStatementContext,
  IfStatementContext,
  FunctionCallContext,
  LiteralContext,
  SourceFileContext,
  BlockContext,
  BlockStatementContext,
  TimeOpStatementContext,
  ArrayContext,
  UnaryOpContext,
  BinaryOpContext,
  LiteralExpressionContext,
  RequireStatementContext,
  PragmaDirectiveContext,
  InstantiationContext,
  NullaryOpContext,
  UnaryIntrospectionOpContext,
  ConsoleStatementContext,
  ConsoleParameterContext,
  StatementContext,
  RequireMessageContext,
  SliceContext,
  IndexRangeSliceContext,
  DoWhileStatementContext,
  LoopStatementContext,
  StateVariableDeclarationContext,
  ThisExprContext,
  DeleteLocalContext,
  DeleteStateContext,
  DeleteMappingEntryContext,
  DeleteIndexedContext,
  AbiEncodeContext,
  AbiEncodePackedContext,
  AbiEncodeWithSelectorContext,
  AbiEncodeWithSignatureContext,
  AbiEncodeCallContext,
  BytesConcatContext,
  StringConcatContext,
  AbiDecodeContext,
  AbiDecodeAtContext,
  MappingTypeContext,
  ArrayTypeContext,
  EventDefinitionContext,
  EmitStatementContext,
  ForStatementContext,
  ForInitContext,
  ForConditionContext,
  ForUpdateContext,
  FunctionModifierContext,
  ReturnStatementContext,
  ExpressionStatementContext,
  BareAbiFunctionReferenceStatementContext,
  PrimitiveTypeReferenceStatementContext,
  PrefixIncDecStatementContext,
  ConstantDefinitionContext,
  FreeFunctionDefinitionContext,
  ModifierDefinitionContext,
  CustomModifierInvocationContext,
  EnumDefinitionContext,
  TypeDefinitionContext,
  WhileStatementContext,
  AssemblyStatementContext,
  BreakStatementContext,
  ContinueStatementContext,
  WildcardImportContext,
  NamespaceImportContext,
  SelectiveImportContext,
  InterfaceDefinitionContext,
  InterfaceStateVariableContext,
  InterfaceCollectionContext,
  InterfaceFunctionContext,
  LibraryDefinitionContext,
  ParentInvocationContext,
  TryCatchStatementContext,
  CatchClauseContext,
  ErrorDefinitionContext,
  RevertStatementContext,
  AssertStatementContext,
  SelfdestructStatementContext,
  CallOptionsContext,
  OutStateMappingFieldAccessContext,
  ReturnTypeContext,
  ReturnParamContext,
  FallbackDefinitionContext,
  ReceiveDefinitionContext,
  AbstractFunctionDefinitionContext,
  ForOfEntriesStatementContext,
  ForInStatementContext,
  ForOfStatementContext,
  TypeIntrospectionContext,
  UncheckedStatementContext,
  SwitchStatementContext,
  SwitchCaseContext,
  UsingLibraryForContext,
  UsingFunctionsForContext,
  AssignChainContext,
  CallArgumentContext,
  ExpressionListContext,
} from '../grammar/SolidCashParser.js';
// Value imports (not type-only): needed for `instanceof` when detecting a tuple-valued ternary.
import { TernaryOpContext, TupleExpressionContext } from '../grammar/SolidCashParser.js';
// Imported as values (not `import type`) for runtime `instanceof` in extractLvalue / visitExpressionStatement.
import {
  ParenthesisedContext, ArrayAccessContext, FieldAccessContext, MappingAccessContext,
  AnyIdentifierContext, ExpressionContext, CastContext, AssignmentExpressionContext,
  StateAccessContext, IdentifierContext, PostfixOpContext, PrefixOpContext, TupleIndexOpContext,
  FunctionCallExpressionContext, MethodCallContext, MethodCallNamedContext, LegacyCallOptionCallContext,
  FunctionTypeContext, StructDefinitionContext,
} from '../grammar/SolidCashParser.js';
import SolidCashVisitor from '../grammar/SolidCashVisitor.js';
import { Location, withSourceFile } from './Location.js';
import { buildYulBlock } from './YulAstBuilder.js';
import { findReservedYulIdentifier, isBchAsmBlock } from './YulAST.js';
import {
  Modifier,
  NumberUnit,
  TimeOp,
} from './Globals.js';
import { getPragmaName, PragmaName, getVersionOpFromCtx } from './Pragma.js';
import { version } from '../index.js';
import {
  InvalidArrayBoundError, InvalidDataLocationError, ParseError, StateVariableNameCollisionError,
  TernaryTypeMismatchError,
  UnsupportedTypeError, VersionError,
} from '../Errors.js';

// Compound-assignment operators desugared to `target <binop> rhs`.
const COMPOUND_OPS: Record<string, BinaryOperator> = {
  '+=': BinaryOperator.PLUS, '++': BinaryOperator.PLUS,
  '-=': BinaryOperator.MINUS, '--': BinaryOperator.MINUS,
  '*=': BinaryOperator.MUL, '/=': BinaryOperator.DIV, '%=': BinaryOperator.MOD,
  '&=': BinaryOperator.BIT_AND, '|=': BinaryOperator.BIT_OR, '^=': BinaryOperator.BIT_XOR,
  '<<=': BinaryOperator.SHIFT_LEFT, '>>=': BinaryOperator.SHIFT_RIGHT,
};

// One ordered segment of an lvalue chain: a `.member` (or `.value`), or an `[index]` key. Interleaved order is
// preserved (alternating chains like `m[i].arr[j]` depend on it). The key is a THUNK yielding a FRESH node per
// call (read + write nodes must not share instances). Consumed by buildLvalueAssign.
interface LvSeg {
  member?: string;
  key?: () => ExpressionNode;
}

// Fixed-point (`fixed`/`ufixed` types, decimal literals like `1.5`) is NOT implemented in Solidity (solc emits
// "UnimplementedFeatureError 1834: Fixed point types not implemented"). solidcash implements it as a decimal-scaled
// integer (value * 10^N), so the behaviour differs from standard Solidity - warn once so a port does not assume
// solc-parity. Module-level (not a class field) so the AstBuilder class shape stays put - a subtle V8 stack-frame
// shift there tips the deep compiler-inlining recursion of recursive functions over the stack limit.
let warnedFixedPoint = false;
function warnFixedPointOnce(): void {
  if (warnedFixedPoint) return;
  warnedFixedPoint = true;
  console.log('Warning: fixed-point (fixed/ufixed types, decimal literals) is not implemented in Solidity '
    + '(solc: "Fixed point types not implemented"); solidcash compiles it with its own decimal-scaled-integer '
    + 'implementation, which differs - do not assume cross-compiler parity.');
}

export default class AstBuilder
  extends ParseTreeVisitor<Node>
  implements SolidCashVisitor<Node> {
  private parsingModifierBody = false;
  private structMap: Map<string, StructType> = new Map();
  private enumMap: Map<string, EnumType> = new Map();
  // Keep interface/library enum identities qualified when another scope declares the same short enum name.
  private qualifiedEnumMap: Map<string, EnumType> = new Map();
  // Library names, so a library-namespaced enum access `L.E.Member` can strip the `L.` to the bare enum.
  private libraryNames: Set<string> = new Set();
  private sourceHasImports = false;
  private parsingLibraryFunction = false;
  private parsingFreeFunctionBody = false;

  // Contract + interface names, so a contract/interface-namespaced TYPE access `C.T.unwrap` / `I.Enum.Member`
  // strips the `C.`/`I.` to the bare (globally-registered) type, like the library case.
  private contractInterfaceNames: Set<string> = new Set();
  private typeDefMap: Map<string, ValueType> = new Map();
  private pendingParentInvocations: ParentInvocation[] = [];
  private packedStateArrayNames: Set<string> = new Set();
  // Unbounded `bytes` state vars, for desugaring `.push`/`.pop` to a whole-value concat / slice reassignment.
  private bytesStateVarNames: Set<string> = new Set();
  // String state vars may be mutated only through Solidity's explicit writable `bytes(s)` view.
  private stateStringVarNames: Set<string> = new Set();
  // Chunk-packed/packed state struct arrays -> element StructType, for desugaring element-field writes
  // (`arr[i].field = v`) to a whole-element rebuild (`arr[i] = T(arr[i].f0, .., v, ..)`).
  private packedStructArrayElems: Map<string, StructType> = new Map();
  // State struct variables -> StructType, for desugaring field-chain writes (`this.d.x = v`) to a rebuild.
  private stateStructVars: Map<string, StructType> = new Map();
  // All state variable names, so a tuple assignment to state vars `(x, y) = (a, b)` desugars to state assigns.
  private stateVarNames: Set<string> = new Set();
  private stateVarTypes: Map<string, Type> = new Map();
  private transientStateVarNames: Set<string> = new Set();
  // State array variables -> ArrayType, so `using L for T[]` desugars `arr.method(args)` to `L.method(arr, args)`.
  private stateArrayVarTypes: Map<string, ArrayType> = new Map();
  // Entry-NFT state arrays that are represented as CollectionNode rather than packed/chunked StateVariableNode.
  private stateCollectionArrayTypes: Map<string, ArrayType> = new Map();
  // State mapping variables -> MappingType, so `using L for mapping(K=>V)` desugars `m.method(args)` to
  // `L.method(m, args)` (m becomes a mapping-storage param, inlined at the call site).
  private mappingStateVarTypes: Map<string, MappingType> = new Map();
  // Scalar/simple state variables -> using-for type key. LocalSimpleTypeKeys is function-scoped and therefore
  // does not contain state variables; keep their keys contract-wide so `stateString.helper()` is desugared before
  // storage-pointer library helpers are inlined and removed.
  private stateSimpleTypeKeys: Map<string, string> = new Map();
  private stateInterfaceReceivers: Set<string> = new Set();
  // Contract-level param names (`contract C(int x)`), so a constructor with a parent invocation drops only the
  // params that MIRROR contract params (native pattern), keeping its own declared params (Solidity pattern).
  private contractParamNames: Set<string> = new Set();
  // Method names declared by the contract currently being built. Solidity members shadow same-spelled
  // SolidCash conveniences (`this.transfer(...)`), while the convenience remains available when no method exists.
  private currentContractFunctionNames: Set<string> = new Set();
  private currentContractName?: string;
  private currentContractBaseNames = new Set<string>();
  // Names which are declarations, but cannot denote a Solidity type. Unknown names still become named-address
  // placeholders so imported contracts/interfaces can be resolved later; known functions/errors/modifiers must
  // instead produce Solidity's "Name has to refer to a user-defined type" error in a type position.
  private sourceNonTypeNames = new Set<string>();
  private nonTypeNames = new Set<string>();
  private fileErrorNames = new Set<string>();
  // Straight-line aliases from external function-pointer variables to a declared self method. Used by
  // abi.encodeCall(pointer, tuple), whose selector is statically known for these direct Solidity assignments.
  private selfExternalFunctionAliases: Map<string, string> = new Map();
  // Statically assigned local function-pointer array elements (`callbacks[0] = this.f`). Used by
  // abi.encodeCall(callbacks[0], ..) and aliases initialized from a known element.
  private indexedExternalFunctionAliases: Map<string, string> = new Map();
  // External-pointer helpers whose exact body returns a declared self method.
  private selfExternalFunctionReturnAliases: Map<string, string> = new Map();
  // Storage-pointer locals: `T storage x = container[k];` makes `x` a compile-time alias for access path
  // `container[k]`; reads/writes of `x` are rewritten to that path. Per-function (cleared at each entry).
  private storageAliases: Map<string, { container: string; keys: ExpressionNode[]; access: ExpressionNode }> =
    new Map();

  // Source-level types of storage-reference parameters and locals. Kept separately from storageAliases because
  // alias lowering may erase a declaration before the semantic type checker can validate a later rebind.
  private storageReferenceTypes: Map<string, Type> = new Map();

  // State vars of a mapping-bearing struct type, flattened to per-field `<var>__<field>` collections/state
  // vars; reads of `<var>.<field>` are rewritten to the flattened name (visitFieldAccess).
  private mappingStructStateVars: Map<string, StructType> = new Map();

  // State mappings `mapping(K => Struct)` whose value struct itself bears a mapping/dynamic field. Flattened by
  // prepending the outer key: `providers[k].data[k2]` -> `providers__data[k][k2]` (a nested state mapping).
  // Maps the mapping name to its value struct; reads/writes of `<var>[k].<field>` route to the flattened name.
  private mappingStructValueVars: Map<string, StructType> = new Map();

  // `using L for T`: bare struct type name -> library, so `d.method(args)` on a T-typed struct var desugars
  // to `L.method(d, args)`.
  private usingForLibraries: Map<string, string> = new Map();

  // Local struct-typed vars, to desugar member assignment `s.field = v` (no direct codegen) into a struct
  // rebuild `s = S(.., v, ..)`. Per-function, like storageAliases.
  private localStructTypes: Map<string, StructType> = new Map();
  // Local struct-ARRAY vars (`S[] memory m`) -> element struct type, to desugar an interleaved element array-field
  // write `m[i].c[j] = v` (whole-element read-modify-write). Per-function, like localStructTypes.
  private localStructArrayTypes: Map<string, StructType> = new Map();
  // All local array values. Under Solidity compatibility these are memory/calldata values unless the name is
  // also a compile-time storage alias, and therefore cannot use storage-only push/pop methods.
  private localArrayVarTypes: Map<string, ArrayType> = new Map();
  private expiredLoopVariableNames = new Set<string>();
  // Local unbounded `bytes` vars, to desugar an element write `d[i] = v` to a slice+concat rebuild. Per-function.
  private localBytesVars: Set<string> = new Set();

  // Local/param vars (name -> using-for type key) for NON-struct types (enum/address/contract/string/bytes/int),
  // so a `using L for T` method call `x.method(args)` -> `L.method(x, args)` resolves for any receiver type
  // (structs go through localStructTypes). Per-function.
  private localSimpleTypeKeys: Map<string, string> = new Map();

  // Subset of localSimpleTypeKeys whose type is an interface/named-contract (AddressType with interfaceName).
  // Their `recv.method()` is AMBIGUOUS (interface method = external call, or library method), so the AstBuilder does
  // NOT rewrite them - RedesugarImportedUsingForCalls does, checking the library's declared names. Per-function.
  private localInterfaceReceivers: Set<string> = new Set();

  private forOfArrayCounter = 0; // uniquifies the temp locals of a desugared `for..of` over a state array

  private tupleTernaryCounter = 0; // uniquifies the hoisted condition temp of a desugared tuple ternary

  // Integer-literal constants (`int constant N = 3;`), so a const can be used as an array dimension `T[N]`.
  // Populated by a pre-scan of constant definitions before any types are built (see scanConstantDimensions).
  private constantIntValues: Map<string, number> = new Map();
  // String constants used by compile-time builtins such as `erc7201(CONST)`. These are also pre-scanned because
  // the builtin result may itself be used while constructing an array type.
  private constantStringValues: Map<string, string> = new Map();
  // Declared file-level constants, used for parse-time validation of builtins whose argument category is stricter
  // than the general SolidCash bytes/string assignability rules (currently erc7201 requires Solidity `string`).
  private constantTypes: Map<string, Type> = new Map();
  // Counter for synthesized temp locals used to desugar nested lvalue writes (`s.arr[i] = v`, `m[i].arr[j] = v`).
  private nestedLvalueCounter = 0;
  private pushArgumentCounter = 0;
  // Function name -> its return struct type (for functions returning a struct, e.g. the OZ StorageSlot factory
  // `getAddressSlot(bytes32) returns (AddressSlot storage)`), so an inline `Lib.f(slot).value = v` write can
  // desugar to a typed temp local. Populated as functions are built (callee declared before the caller).
  private functionReturnStructs: Map<string, StructType> = new Map();
  // Zero-argument storage helpers whose result can be used as a writable alias. `prefix` is limited to direct
  // array pushes (no locals/control flow), and `keys` identifies a returned array element such as `rows[2]`.
  private simpleStorageReturnAliases: Map<string, {
    name: string; type: Type; keys: ExpressionNode[]; prefix: StatementNode[];
  }> = new Map();

  private pendingStorageReturnPushes: Map<string, Array<{
    block: BlockNode; value: ExpressionNode | undefined; noArg: boolean; ctx: ParserRuleContext;
  }>> = new Map();

  // True while building the body of a function/constructor/modifier with NO return values, so `return f();`
  // (Solidity's void tail form) can desugar to `f(); return;`. undefined = unknown scope (do not desugar).
  private currentFnIsVoid: boolean | undefined = undefined;
  // State mapping name -> its resolved value struct type, for desugaring `m[i].arr[j] = v` (mapping -> struct ->
  // array-field element). Populated per contract from the mapping collections; empty for non-struct mappings.
  private stateMappingValueStruct: Map<string, StructType> = new Map();
  // True while visiting a library's own state-variable declarations. A `public constant` in a library is left
  // as-is (it feeds the library's shared-state/delegate machinery); only CONTRACT-level `public constant` is
  // rerouted to a baked constant (see visitStateVariableDeclaration).
  private inLibraryDecl = false;

  constructor(
    private tree: ParseTree,
    private solidityImportCompat = false,
    private chunkedArrays = true,
    private sourceCode = '',
    private importedFileId?: string,
  ) {
    super();
  }

  /** ` at line N` for a parse-time diagnostic, naming the imported file when this is not the root file. */
  private diagLine(line: number | undefined): string {
    if (line === undefined) return '';
    return this.importedFileId ? ` at line ${line} of imported "${this.importedFileId}"` : ` at line ${line}`;
  }

  defaultResult(): Node {
    return new BoolLiteralNode(false);
  }

  build(): Node {
    // X107. This builder handles ONE file, so stamp its id onto every Location the parse builds. That carries the
    // answer to a diagnostic raised anywhere downstream - after the merge, after cloning, after re-parenting -
    // where `importedFileId` itself is long out of scope. No-op for the root file (id undefined).
    return withSourceFile(this.importedFileId, () => this.visit(this.tree));
  }

  private usesLegacySolidityNow(): boolean {
    return /pragma\s+solidity\s+(?:[<>=~^]+\s*)?0\.[0-6](?:\.|\s|;)/.test(this.sourceCode);
  }

  private usesLegacySolidityDefaultFunctionVisibility(): boolean {
    // Unversioned sources retain SolidCash's native implicit-public shorthand. Once a source explicitly selects
    // Solidity, follow its version boundary: visibility became mandatory in Solidity 0.5.
    return !/pragma\s+solidity\b/.test(this.sourceCode)
      || /pragma\s+solidity\s+(?:\^|~|=)?\s*0\.[0-4](?:\.|\s|;)/.test(this.sourceCode);
  }

  private validateFunctionTypeModifiers(root: ParseTree): void {
    const structNames = new Set<string>();
    const collectStructNames = (tree: ParseTree): void => {
      if (tree instanceof StructDefinitionContext) {
        structNames.add(tree.anyIdentifier().getText());
      }
      for (const child of (tree as ParseTree & { children?: ParseTree[] }).children ?? []) {
        collectStructNames(child);
      }
    };
    collectStructNames(root);
    const visit = (tree: ParseTree): void => {
      if (tree instanceof FunctionTypeContext) {
        const children = (tree as ParseTree & { children?: ParseTree[] }).children ?? [];
        const modifiers = children
          .map((child) => child.getText())
          .filter((text) => ['pure', 'view', 'payable', 'internal', 'external'].includes(text));
        const visibility = modifiers.filter((modifier) => modifier === 'internal' || modifier === 'external');
        const mutability = modifiers.filter((modifier) =>
          modifier === 'pure' || modifier === 'view' || modifier === 'payable');
        const duplicateMutability = mutability.find((modifier, index) => mutability.indexOf(modifier) !== index);
        if (duplicateMutability) {
          throw new ParseError(
            `Function type modifier '${duplicateMutability}' specified more than once`,
            Location.fromCtx(tree),
          );
        }
        let parent = tree.parentCtx;
        let stateVariableContext = false;
        while (parent) {
          if (parent.constructor.name === 'StateVariableDeclarationContext') {
            stateVariableContext = true;
            break;
          }
          parent = parent.parentCtx;
        }
        // The compatibility grammar greedily includes a state variable's trailing visibility in functionType:
        // `function() internal internal f` is type visibility + variable visibility and is valid Solidity.
        const visibilityLimit = stateVariableContext ? 2 : 1;
        if (visibility.length > visibilityLimit) {
          throw new ParseError(
            `Function type has multiple visibility modifiers (${visibility.join(', ')})`,
            Location.fromCtx(tree),
          );
        }
        if (mutability.length > 1) {
          throw new ParseError(
            `Function type has multiple state mutability modifiers (${mutability.join(', ')})`,
            Location.fromCtx(tree),
          );
        }
        if (visibility.includes('external')) {
          const params = [
            ...tree.functionTypeParameter_list(),
            ...tree.functionTypeReturnParameter_list(),
          ];
          for (const param of params) {
            const typeText = param.typeName()?.getText();
            const isReference = param.mappingType() !== null || param.arrayType() !== null
              || typeText === 'string' || typeText === 'bytes'
              || (typeText !== undefined && structNames.has(typeText));
            if (!isReference) continue;
            const location = param.dataLocation()?.getText();
            if (param.mappingType() !== null || location === undefined || location === 'storage') {
              throw new ParseError(
                'External function type reference parameters and returns require memory or calldata',
                Location.fromCtx(param),
              );
            }
          }
        }
      }
      const children = (tree as ParseTree & { children?: ParseTree[] }).children ?? [];
      for (const child of children) visit(child);
    };
    visit(root);
  }

  visitSourceFile(ctx: SourceFileContext): SourceFileNode {
    if (this.solidityImportCompat) this.validateFunctionTypeModifiers(ctx);
    if (this.solidityImportCompat) {
      for (const match of this.sourceCode.matchAll(/^\s*\/\/\s*SPDX-License-Identifier:\s*(.*)$/gmi)) {
        if (/[^\x20-\x7e]/.test(match[1])) {
          throw new ParseError('Invalid SPDX license identifier', Location.fromCtx(ctx));
        }
      }
      const declared = new Map<string, string>();
      const register = (name: string, kind: string, locationCtx: ParserRuleContext): void => {
        const previous = declared.get(name);
        // Functions and events each have their own overload sets. Every other repetition, including a collision
        // between the two overloadable kinds, occupies the same Solidity source-unit declaration namespace.
        if (previous !== undefined && (previous !== kind || (kind !== 'function' && kind !== 'event'))) {
          throw new ParseError(`Identifier '${name}' is already declared`, Location.fromCtx(locationCtx));
        }
        declared.set(name, kind);
      };
      for (const item of ctx.enumDefinition_list()) {
        register(item.anyIdentifier().getText(), 'enum', item);
      }
      for (const item of ctx.structDefinition_list()) {
        register(item.anyIdentifier().getText(), 'struct', item);
      }
      for (const item of ctx.typeDefinition_list()) {
        register(item.anyIdentifier().getText(), 'type', item);
      }
      for (const item of ctx.constantDefinition_list()) {
        register(item.anyIdentifier().getText(), 'constant', item);
      }
      for (const item of ctx.errorDefinition_list()) {
        register(item.anyIdentifier().getText(), 'error', item);
      }
      for (const item of ctx.eventDefinition_list()) {
        register(item.anyIdentifier()?.getText() ?? item._eventSpecialName.text, 'event', item);
      }
      for (const item of ctx.freeFunctionDefinition_list()) {
        register(item.functionName().getText(), 'function', item);
      }
      for (const item of ctx.interfaceDefinition_list()) {
        register(item.Identifier(0).getText(), 'interface', item);
      }
      for (const item of ctx.libraryDefinition_list()) {
        register(item.Identifier().getText(), 'library', item);
      }
      for (const item of ctx.contractDefinition_list()) {
        register(item.anyIdentifier().getText(), 'contract', item);
      }
    }
    this.sourceNonTypeNames = new Set([
      ...ctx.errorDefinition_list().map((error) => error.anyIdentifier().getText()),
      ...ctx.freeFunctionDefinition_list().map((fn) => fn.functionName().getText()),
    ]);
    this.nonTypeNames = new Set(this.sourceNonTypeNames);
    let seenNonPragma = false;
    const pragmaChildren = new Set(ctx.pragmaDirective_list());
    for (const child of ctx.children ?? []) {
      if (pragmaChildren.has(child as PragmaDirectiveContext)) {
        if (seenNonPragma && child.getText() === 'pragmaexperimentalsolidity;') {
          throw new ParseError(
            'Experimental pragma "solidity" can only be set at the beginning of the source unit',
            Location.fromCtx(child as PragmaDirectiveContext),
          );
        }
      } else if (child.getText() !== '<EOF>') {
        seenNonPragma = true;
      }
    }
    let selectedAbiCoder: { version: 'v1' | 'v2'; legacy: boolean } | undefined;
    const experimentalFeatures = new Set<string>();
    for (const pragma of ctx.pragmaDirective_list()) {
      const text = pragma.getText();
      if (this.solidityImportCompat && text.startsWith('pragmaexperimental')) {
        const feature = text.slice('pragmaexperimental'.length, -1);
        const supported = new Set(['ABIEncoderV2', 'SMTChecker', 'solidity', '__test']);
        if (!supported.has(feature)) {
          throw new ParseError(
            feature.length === 0
              ? 'Experimental feature name is missing'
              : `Unsupported experimental feature name '${feature}'`,
            Location.fromCtx(pragma),
          );
        }
        if (experimentalFeatures.has(feature)) {
          throw new ParseError(`Duplicate experimental feature name '${feature}'`, Location.fromCtx(pragma));
        }
        if ((feature === 'solidity' || feature === '__test')
          && [...experimentalFeatures].some((seen) => seen === 'solidity' || seen === '__test')) {
          throw new ParseError('Only one experimental language mode can be selected', Location.fromCtx(pragma));
        }
        experimentalFeatures.add(feature);
      }
      let selection: 'v1' | 'v2' | undefined;
      let legacy = false;
      if (text === 'pragmaexperimentalABIEncoderV2;') {
        selection = 'v2';
        legacy = true;
      } else if (text.startsWith('pragmaabicoder')) {
        const match = text.match(/^pragmaabicoder"?((?:v1|v2))"?;$/);
        if (!match) {
          throw new ParseError(
            'Expected either "pragma abicoder v1" or "pragma abicoder v2"',
            Location.fromCtx(pragma),
          );
        }
        selection = match[1] as 'v1' | 'v2';
      }
      if (selection) {
        if (selectedAbiCoder) {
          // Solidity accepts the deprecated ABIEncoderV2 spelling after an explicit v2 selection, but an explicit
          // abicoder directive after the legacy spelling is a duplicate selection and remains an error.
          const toleratedLegacyConfirmation = selectedAbiCoder.version === 'v2'
            && !selectedAbiCoder.legacy && selection === 'v2' && legacy;
          if (!toleratedLegacyConfirmation) {
            throw new ParseError(
              'ABI coder has already been selected for this source unit', Location.fromCtx(pragma),
            );
          }
        } else {
          selectedAbiCoder = { version: selection, legacy };
        }
      }
    }
    ctx.pragmaDirective_list().forEach((pragma) => {
      this.processPragma(pragma);
    });

    // File-level constants usable while building types in file-level definitions and contracts below.
    this.scanConstantStrings(ctx.constantDefinition_list());
    this.scanConstantDimensions(ctx.constantDefinition_list());

    const imports = ctx.importDirective_list().map(
      (i) => this.visit(i) as ImportNode,
    );
    this.sourceHasImports = imports.length > 0;

    // Enums before constants: a file-level enum-typed constant (`E constant c = E.M;`) resolves its declared
    // type via resolveType -> enumMap, so the enum must be registered first.
    const enumDefinitions = ctx.enumDefinition_list().map(
      (e) => this.visitEnumDefinition(e),
    );

    // File-level struct definitions (must be registered before interfaces for type resolution). Register the
    // NAMES first, then UDVTs, then build fields - so a struct field can forward-reference a later UDVT.
    const structDefinitions: StructDefinitionNode[] = [];
    this.registerStructNames(ctx.structDefinition_list());

    // File-level type definitions (user-defined value types). UDVTs wrap primitives only, so they never depend
    // on a struct - safe to register before struct fields are resolved.
    const typeDefinitions: TypeDefinitionNode[] = [];
    for (const tdCtx of ctx.typeDefinition_list()) {
      const td = this.visitTypeDefinition(tdCtx);
      typeDefinitions.push(td);
    }

    this.buildStructFields(ctx.structDefinition_list(), structDefinitions);

    // Constants after enums/structs/typeDefs: a file-level constant may be typed by / initialized from one of them
    // (`T constant g = T.wrap(true)`). Array-dimension constants are already pre-scanned (scanConstantDimensions).
    const constantDefinitions = ctx.constantDefinition_list().map(
      (c) => this.visitConstantDefinition(c),
    );

    // `using L for T` may precede L's declaration, so make every source-local library name available before
    // validating file-level directives.
    for (const library of ctx.libraryDefinition_list()) {
      this.libraryNames.add(library.Identifier().getText());
    }
    const fileUsingForDirectives = ctx.usingForDirective_list().map(
      (u) => this.visit(u) as UsingForDirectiveNode,
    );
    const usingForDirectives = [...fileUsingForDirectives];

    const errorDefinitions = ctx.errorDefinition_list().map(
      (e) => this.visitErrorDefinition(e),
    );
    this.fileErrorNames = new Set(errorDefinitions.map((definition) => definition.name));

    // Collect contract + interface names before visiting library bodies. A library may use a qualified type from
    // an interface or contract declared elsewhere in the same source unit (`returns (I.Direction)` and
    // `I.Direction.Right`), and reachable library helpers must resolve that qualifier just like contract bodies.
    for (const cc of ctx.contractDefinition_list()) this.contractInterfaceNames.add(cc.anyIdentifier().getText());
    for (const ic of ctx.interfaceDefinition_list()) this.contractInterfaceNames.add(ic.Identifier(0).getText());

    const interfaceDefinitions = ctx.interfaceDefinition_list().map(
      (i) => this.visitInterfaceDefinition(i),
    );
    for (const iface of interfaceDefinitions) {
      for (const definition of iface.enumDefinitions) {
        this.qualifiedEnumMap.set(
          `${iface.name}.${definition.name}`,
          new EnumType(definition.name, definition.members),
        );
      }
    }

    const freeFunctions = ctx.freeFunctionDefinition_list().map(
      (f) => this.visitFreeFunctionDefinition(f),
    );
    if (this.solidityImportCompat) {
      const fileErrorNames = new Set<string>();
      for (const error of errorDefinitions) {
        if (fileErrorNames.has(error.name)) {
          throw new ParseError(`Identifier '${error.name}' is already declared`, error.location!);
        }
        fileErrorNames.add(error.name);
      }
      for (const fn of freeFunctions) {
        if (fileErrorNames.has(fn.name)) {
          throw new ParseError(`Identifier '${fn.name}' is already declared`, fn.location!);
        }
      }
    }

    // Process all library definitions (there may be multiple before the contract)
    const allLibDefs = ctx.libraryDefinition_list();
    const allLibEventDefs: EventDefinitionNode[] = [];
    const declaredLibraryNames: string[] = [];
    const libraryFunctionSignatures: Map<string, string[]> = new Map();
    const libraryEventSignatures: Map<string, string[]> = new Map();
    const libraryAnonymousEvents: Set<string> = new Set();
    const libraryErrorSignatures: Map<string, string[]> = new Map();
    const libraryErrorDefinitions: Set<ErrorDefinitionNode> = new Set();
    const libraryModifierDefinitions: ModifierDefinitionNode[] = [];
    for (const libCtx of allLibDefs) {
      const libName = libCtx.Identifier().getText();
      this.libraryNames.add(libName);

      // Library enum definitions
      for (const edCtx of libCtx.enumDefinition_list()) {
        const definition = this.visitEnumDefinition(edCtx);
        definition.inheritedFrom = libName;
        this.qualifiedEnumMap.set(
          `${libName}.${definition.name}`,
          new EnumType(definition.name, definition.members),
        );
        enumDefinitions.push(definition);
      }

      // Library struct definitions
      this.registerStructDefinitions(libCtx.structDefinition_list(), structDefinitions);

      // Library type definitions
      for (const tdCtx of libCtx.typeDefinition_list()) {
        const td = this.visitTypeDefinition(tdCtx);
        typeDefinitions.push(td);
      }

      // Library event definitions (accumulated across all libraries). Qualified signatures are recorded
      // for `L.E.selector` folds (bare-name registration collides across libraries).
      for (const evCtx of libCtx.eventDefinition_list()) {
        const ev = this.visitEventDefinition(evCtx);
        libraryEventSignatures.set(`${libName}.${ev.name}`, ev.parameters.map((pm) => pm.type.toString()));
        if (ev.isAnonymous) libraryAnonymousEvents.add(`${libName}.${ev.name}`);
        allLibEventDefs.push(ev);
      }

      // Library error definitions (accumulated to file level)
      for (const erCtx of libCtx.errorDefinition_list()) {
        const error = this.visitErrorDefinition(erCtx);
        libraryErrorSignatures.set(
          `${libName}.${error.name}`,
          error.parameters.map((parameter) => parameter.type.toString()),
        );
        libraryErrorDefinitions.add(error);
        errorDefinitions.push(error);
      }

      // Library-level `using L for T` directives (e.g. OZ SafeERC20's `using Address for address`) govern the
      // library's own functions, which become free functions; lift them to file scope so their member-call
      // bindings register and `address(x).functionCall(d)` inside a library function resolves.
      for (const uCtx of libCtx.usingForDirective_list()) {
        const directive = this.visit(uCtx) as UsingForDirectiveNode;
        directive.declaringLibraryName = libName;
        usingForDirectives.push(directive);
      }

      declaredLibraryNames.push(libName);

      const localModifierNames = new Set<string>();
      for (const modCtx of libCtx.modifierDefinition_list()) {
        if (modCtx.getText().includes('virtual')) {
          throw new ParseError('Modifiers in a library cannot be virtual', Location.fromCtx(modCtx));
        }
        if (modCtx.getText().endsWith(';')) {
          throw new ParseError('A library modifier must have an implementation', Location.fromCtx(modCtx));
        }
        const mod = this.visitModifierDefinition(modCtx);
        localModifierNames.add(mod.name);
        mod.name = `${libName}.${mod.name}`;
        mod.inheritedFrom = libName;
        libraryModifierDefinitions.push(mod);
      }

      // Library constants get namespaced names (e.g. SafeMath.MAX_VALUE)
      const libConstants = libCtx.constantDefinition_list().map(
        (c) => {
          const cd = this.visitConstantDefinition(c);
          cd.name = `${libName}.${cd.name}`;
          return cd;
        },
      );
      constantDefinitions.push(...libConstants);

      // Library functions get namespaced names (e.g. SafeMath.add). A state-touching library's public/external
      // functions are auto-marked `delegate` (Solidity has no `delegate` keyword) so a consumer that imports the
      // library can route `L.f()` to a delegatecall. Mirrors the root-compilation auto-delegate in the
      // library-only branch below. See docs/library-contracts.md (3b, `L.f()` sugar).
      // `uint public constant ONE = ..` parses as a state variable (the constantDefinition rule has no
      // visibility slot) but is a compile-time constant: it must not make the library look state-touching,
      // or a constants-only pure library (gnosis Math) gets delegate+pure marked and cannot compile.
      const libSvCtxs = libCtx.stateVariableDeclaration_list();
      const isConstDecl = (sv: StateVariableDeclarationContext): boolean => (sv.modifier_list?.() ?? [])
        .some((m) => m.getText() === 'constant');
      const libHasState = libSvCtxs.some((sv) => !isConstDecl(sv));
      // Pure library (constants only): bake those constants as namespaced constants (Math.ONE) - nothing
      // feeds the delegate machinery. A state-touching library keeps them in its shared-state layout.
      if (!libHasState) {
        for (const sv of libSvCtxs) {
          const cd = this.visitStateVariableDeclaration(sv);
          if (cd instanceof ConstantDefinitionNode) {
            cd.name = `${libName}.${cd.name}`;
            constantDefinitions.push(cd);
          }
        }
      }
      const libFunctions = libCtx.freeFunctionDefinition_list().map(
        (f) => {
          this.parsingLibraryFunction = true;
          let func: FunctionDefinitionNode;
          try {
            func = this.visitFreeFunctionDefinition(f);
          } finally {
            this.parsingLibraryFunction = false;
          }
          func.isLibraryFunction = true;
          func.name = `${libName}.${func.name}`;
          for (const invocation of func.customModifiers) {
            if (localModifierNames.has(invocation.name)) invocation.name = `${libName}.${invocation.name}`;
          }
          if (libHasState) {
            const deployed = func.modifiers.includes(FunctionModifier.PUBLIC)
              || func.modifiers.includes(FunctionModifier.EXTERNAL);
            if (deployed && !func.modifiers.includes(FunctionModifier.DELEGATE)) {
              func.modifiers.push(FunctionModifier.DELEGATE);
            }
          }
          // Record the declared signature at parse time: `L.f.selector` must fold even when f is later
          // inlined away (storage-pointer fns are removed from freeFunctions).
          libraryFunctionSignatures.set(func.name, func.parameters.map((p) => p.type.toString()));
          return func;
        },
      );
      freeFunctions.push(...libFunctions);
    }

    // Definitions-only source units return before semantic passes, so validate explicit file-level bindings here
    // while every free and qualified library function declaration is still present. Solidity does not overload-
    // resolve a `using {f}` reference from its target type: the referenced name itself must denote exactly one
    // user-defined function.
    if (this.solidityImportCompat) {
      const functionCounts = new Map<string, number>();
      const functionSignatures = new Set<string>();
      for (const fn of freeFunctions) {
        functionCounts.set(fn.name, (functionCounts.get(fn.name) ?? 0) + 1);
        const parameterTypes = fn.parameters
          .map((parameter) => parameter.type.toString().replace(/address payable/g, 'address'))
          .join(',');
        const signature = `${fn.name}(${parameterTypes})`;
        if (functionSignatures.has(signature)) {
          throw new ParseError(
            `Redefinition of function '${signature}'`,
            fn.location,
          );
        }
        functionSignatures.add(signature);
      }
      for (const directive of usingForDirectives) {
        for (const binding of directive.functionBindings ?? []) {
          if (functionCounts.get(binding.funcName) !== 1) {
            throw new ParseError(
              `Identifier '${binding.funcName}' in 'using for' directive is not a function name or not unique`,
              directive.location,
            );
          }
        }
      }
      for (const directive of fileUsingForDirectives) {
        if (directive.isWildcard) {
          throw new ParseError(
            "The type has to be specified explicitly at file level (cannot use '*')",
            directive.location,
          );
        }
      }

      // A specifically attached function must accept the directive target as its first argument. Validate this
      // before unused free helpers and their directives can be pruned from the compatibility pipeline.
      for (const directive of usingForDirectives) {
        if (!directive.functionBindings || directive.isWildcard || !directive.targetTypeName) continue;
        const targetType = this.resolveType(directive.targetTypeName);
        for (const binding of directive.functionBindings) {
          const fn = freeFunctions.find((candidate) => candidate.name === binding.funcName)!;
          const firstParameter = fn.parameters.find((parameter) => !parameter.name.startsWith('__internal__'));
          if (!firstParameter) {
            throw new ParseError(
              `The function '${binding.funcName}' does not have any parameters and cannot be attached to a type`,
              directive.location,
            );
          }
          if (!binding.operator && targetType && !implicitlyCastable(targetType, firstParameter.type)) {
            throw new ParseError(
              `The function '${binding.funcName}' cannot be attached to '${directive.targetTypeName}' `
              + `because it cannot be implicitly converted to '${firstParameter.type}'`,
              directive.location,
            );
          }
        }
      }

      // Validate operator aliases while their source declarations are still intact. Several compatibility
      // lowerings inline and then remove free helpers/directives before SymbolTableTraversal, so relying only on
      // its equivalent checks would allow malformed or duplicate Solidity operator definitions to disappear.
      const valueTypeNames = new Set(typeDefinitions.map((definition) => definition.name));
      const operatorDefinitions = new Map<string, string>();
      const comparisonOperators = new Set(['==', '!=', '<', '<=', '>', '>=']);
      for (const directive of usingForDirectives) {
        for (const binding of directive.functionBindings ?? []) {
          const operator = binding.operator;
          if (!operator) continue;
          if (!directive.isGlobal) {
            throw new ParseError(
              "Operators can only be defined in a file-level global 'using for' directive",
              directive.location,
            );
          }
          const targetName = directive.targetTypeName;
          if (!targetName || !valueTypeNames.has(targetName)) {
            throw new ParseError(
              'Operators can only be implemented for user-defined value types',
              directive.location,
            );
          }
          const fn = freeFunctions.find((candidate) => candidate.name === binding.funcName)!;
          const params = fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
          const unary = params.length === 1;
          const requiredArity = operator === '~' ? 1 : operator === '-' ? undefined : 2;
          if ((requiredArity !== undefined && params.length !== requiredArity)
            || (operator === '-' && params.length !== 1 && params.length !== 2)) {
            throw new ParseError(
              `Wrong parameters in operator definition '${binding.funcName}'`,
              directive.location,
            );
          }
          if (!fn.isFreeFunction || !fn.modifiers.includes(FunctionModifier.PURE)) {
            throw new ParseError(
              'Only pure free functions can be used to define operators',
              directive.location,
            );
          }
          if (params.some((parameter) =>
            !(parameter.type instanceof ValueType) || parameter.type.name !== targetName)) {
            throw new ParseError(
              `Wrong parameters in operator definition '${binding.funcName}'`,
              directive.location,
            );
          }
          const expectedBoolean = comparisonOperators.has(operator);
          const validReturn = fn.returnTypes.length === 1
            && (expectedBoolean
              ? fn.returnTypes[0] === PrimitiveType.BOOL
              : fn.returnTypes[0] instanceof ValueType && fn.returnTypes[0].name === targetName);
          if (!validReturn) {
            throw new ParseError(
              `Wrong return parameters in operator definition '${binding.funcName}'`,
              directive.location,
            );
          }
          const key = `${targetName}/${operator}/${unary ? 1 : 2}`;
          const existingDefinition = operatorDefinitions.get(key);
          if (existingDefinition && existingDefinition !== binding.funcName) {
            throw new ParseError(
              `User-defined operator '${operator}' already has a definition for '${targetName}' `
              + '(more than one definition is not allowed)',
              directive.location,
            );
          }
          operatorDefinitions.set(key, binding.funcName);
        }
      }

      // Preserve source-level mutability diagnostics before operator/free-function inlining can erase the
      // external call. An interface-typed constant receiver (`I constant X = ...; X.viewFn()`) retains its
      // interface tag on the constant's AddressType.
      const constantInterfaces = new Map(
        constantDefinitions.flatMap((constant) =>
          constant.type instanceof AddressType && constant.type.interfaceName
            ? [[constant.name, constant.type.interfaceName] as const] : []),
      );
      const interfacesByName = new Map(interfaceDefinitions.map((iface) => [iface.name, iface]));
      const freeFunctionNames = new Set(freeFunctions.map((functionDefinition) => functionDefinition.name));
      const freeFunctionOverloads = new Map<string, FunctionDefinitionNode[]>();
      for (const functionDefinition of freeFunctions) {
        const overloads = freeFunctionOverloads.get(functionDefinition.name) ?? [];
        overloads.push(functionDefinition);
        freeFunctionOverloads.set(functionDefinition.name, overloads);
      }
      for (const fn of freeFunctions) {
        const storageParameters = new Set(
          fn.parameters
            .filter((parameter) => parameter.modifier.includes(Modifier.STORAGE))
            .map((parameter) => parameter.name),
        );
        const walk = (node: Node | undefined): void => {
          if (!node) return;
          const mutatedName = node instanceof AssignNode ? node.identifier.name
            : node instanceof ArrayAssignNode || node instanceof ArrayPushNode
              || node instanceof ArrayPopNode || node instanceof ArrayDeleteNode
              || node instanceof MappingAssignNode || node instanceof MappingFieldAssignNode
              || node instanceof MappingDeleteNode
              ? node.name
              : node instanceof DeleteLocalNode ? node.identifier.name : undefined;
          if (fn.modifiers.includes(FunctionModifier.PURE)
            && mutatedName !== undefined && storageParameters.has(mutatedName)) {
            throw new ParseError(
              `pure function '${fn.name}' cannot modify storage parameter '${mutatedName}'`,
              node.location,
            );
          }
          if (node instanceof FunctionCallNode) {
            const overloads = freeFunctionOverloads.get(node.identifier.name) ?? [];
            if (overloads.length > 1 && node.parameters.every((parameter) => parameter instanceof IntLiteralNode)) {
              const matches = overloads.filter((candidate) =>
                candidate.parameters.length === node.parameters.length
                && candidate.parameters.every((parameter, index) =>
                  parameter.type instanceof IntType
                  && (node.parameters[index] as IntLiteralNode).value >= parameter.type.minValue
                  && (node.parameters[index] as IntLiteralNode).value <= parameter.type.maxValue));
              if (matches.length > 1) {
                throw new ParseError(
                  `No unique declaration found for overloaded function '${node.identifier.name}'`,
                  node.location,
                );
              }
            }
            if (node.callOptions && freeFunctionNames.has(node.identifier.name)) {
              throw new ParseError(
                'Function call options can only be set on external function calls or contract creations',
                node.location,
              );
            }
            if (fn.modifiers.includes(FunctionModifier.PURE) && node.identifier.name.includes('.')) {
              const [receiver, method] = node.identifier.name.split('.');
              const iface = interfacesByName.get(constantInterfaces.get(receiver) ?? '');
              const target = iface?.functions.find((candidate) => candidate.name === method);
              if (target && target.stateMutability !== 'pure') {
                throw new ParseError(
                  `pure function '${fn.name}' cannot call '${target.stateMutability}' external function '${iface!.name}.${method}'`,
                  node.location,
                );
              }
            }
          }
          for (const [key, value] of Object.entries(node)) {
            if (key === 'location' || key === 'type' || key === 'symbolTable') continue;
            if (value instanceof Node) walk(value);
            else if (Array.isArray(value)) {
              for (const item of value) if (item instanceof Node) walk(item);
            }
          }
        };
        walk(fn.body);
      }
    }

    // File-level event declarations (Solidity 0.8.22+ allows events at file scope). Accumulated with library
    // events into SourceFileNode.eventDefinitions, which the symbol table registers globally so `emit E()` resolves.
    const fileEventSignatures = new Set<string>();
    for (const evCtx of ctx.eventDefinition_list()) {
      const event = this.visitEventDefinition(evCtx);
      const signature = `${event.name}(${event.parameters.map((parameter) => parameter.type.toString()).join(',')})`;
      if (this.solidityImportCompat && fileEventSignatures.has(signature)) {
        throw new ParseError(`Event '${event.name}' with the same parameter types is already declared`, event.location!);
      }
      fileEventSignatures.add(signature);
      allLibEventDefs.push(event);
    }

    const contractCtxs = ctx.contractDefinition_list();

    // No contract definition (library-only, or interface/type-only file): return a definitions-only node,
    // existing only to be imported.
    if (contractCtxs.length === 0) {
      const lastLib = allLibDefs[allLibDefs.length - 1];
      const libName = lastLib
        ? lastLib.Identifier().getText()
        : (interfaceDefinitions[0]?.name ?? 'definitions');
      const placeholder = new ContractNode(libName, [], [], [], [], [], [], undefined, []);
      placeholder.location = lastLib ? Location.fromCtx(lastLib) : Location.fromCtx(ctx);
      const node = new SourceFileNode(
        placeholder, constantDefinitions, enumDefinitions, structDefinitions, typeDefinitions,
        errorDefinitions, allLibEventDefs, interfaceDefinitions, freeFunctions, imports, usingForDirectives,
      );
      node.isLibrary = true;
      node.solidityLegacyNow = this.usesLegacySolidityNow();
      node.libraryName = libName;
      node.declaredLibraryNames = declaredLibraryNames;
      node.libraryFunctionSignatures = libraryFunctionSignatures;
      node.libraryEventSignatures = libraryEventSignatures;
      node.libraryAnonymousEvents = libraryAnonymousEvents;
      node.libraryErrorSignatures = libraryErrorSignatures;
      node.libraryErrorDefinitions = libraryErrorDefinitions;
      node.libraryModifierDefinitions = libraryModifierDefinitions;
      node.abiCoderVersion = selectedAbiCoder?.version;
      node.location = Location.fromCtx(ctx);

      // Lower the primary library to a stateless contract when it has explicitly public/external functions, so
      // it can be compiled directly into an artifact (docs/library-contracts.md Phase 2). Functions without an
      // explicit public/external modifier become internal inline helpers (the inline-only library is preserved:
      // an all-unmarked library has no entry point and stays non-compilable).
      if (lastLib) {
        // A delegate library declares the shared state layout it operates on as state vars (the EVM proxy/impl
        // storage-declaration pattern); carry them into the lowered contract so `delegate` functions resolve
        // `this.field` against that layout (docs/library-contracts.md "3b design").
        // A constants-only pure library has no shared state: its `public constant` decls were already baked
        // as namespaced constants above, so the lowered contract carries no layout and no delegate marking.
        const svCtxs = lastLib.stateVariableDeclaration_list();
        const pureLib = svCtxs.every((sv) => (sv.modifier_list?.() ?? []).some((m) => m.getText() === 'constant'));
        this.inLibraryDecl = true;
        const libDecls = pureLib ? [] : svCtxs.map((sv) => this.visitStateVariableDeclaration(sv));
        this.inLibraryDecl = false;
        const libStateVars = libDecls.filter((d): d is StateVariableNode => d instanceof StateVariableNode);
        const libCollections = libDecls.filter((d): d is CollectionNode => d instanceof CollectionNode);
        const hasSharedState = libStateVars.length > 0 || libCollections.length > 0;
        const libFns = lastLib.freeFunctionDefinition_list().map((f) => {
          this.parsingLibraryFunction = true;
          let fn: FunctionDefinitionNode;
          try {
            fn = this.visitFreeFunctionDefinition(f);
          } finally {
            this.parsingLibraryFunction = false;
          }
          fn.isLibraryFunction = true;
          fn.isFreeFunction = false;
          const localNames = new Set(lastLib.modifierDefinition_list().map((m) => m.Identifier().getText()));
          for (const invocation of fn.customModifiers) {
            if (localNames.has(invocation.name)) invocation.name = `${libName}.${invocation.name}`;
          }
          const deployed = fn.modifiers.includes(FunctionModifier.PUBLIC)
            || fn.modifiers.includes(FunctionModifier.EXTERNAL);
          if (!deployed && !fn.modifiers.includes(FunctionModifier.INTERNAL)
            && !fn.modifiers.includes(FunctionModifier.PRIVATE)) {
            fn.modifiers.push(FunctionModifier.INTERNAL);
          }
          // Solidity has no `delegate` keyword - a library's public functions are delegatecalled implicitly.
          // For a state-touching library (one that declares a shared state layout) auto-mark its public/external
          // functions `delegate`, so ported Solidity source needs no SolidCash-specific keyword.
          if (deployed && hasSharedState && !fn.modifiers.includes(FunctionModifier.DELEGATE)) {
            fn.modifiers.push(FunctionModifier.DELEGATE);
          }
          return fn;
        });
        // A public library function whose ABI includes a generic `storage` pointer is delegate-only in Solidity:
        // its concrete layout comes from the caller. It remains in freeFunctions for import/inlining, but cannot
        // be emitted as a standalone BCH entry point without inventing a caller layout. Exclude it from the
        // lowered executable library; if no entry points remain, compile the source as an ABI-only declaration.
        const executableLibFns = libFns.filter((f) => !f.isEntryPoint
          || !f.parameters.some((p) => p.modifier.includes(Modifier.STORAGE)));
        if (executableLibFns.some((f) => f.isEntryPoint)) {
          const libContract = new ContractNode(
            libName, [], [], [], [], libStateVars, libCollections, undefined, executableLibFns,
          );
          libContract.location = Location.fromCtx(lastLib);
          libContract.isLibraryContract = true;
          node.libraryContract = libContract;
        }
      }

      return node;
    }

    // Multiple top-level contracts per file (common in Solidity): compile the last as the primary; the
    // earlier ones become available contracts (for inheritance / cross-references), like imports.
    const contracts = contractCtxs.map((c) => this.visit(c) as ContractNode);
    const contract = contracts[contracts.length - 1];
    const sourceFileNode = new SourceFileNode(
      contract, constantDefinitions, enumDefinitions, structDefinitions, typeDefinitions,
      errorDefinitions, allLibEventDefs, interfaceDefinitions, freeFunctions, imports, usingForDirectives,
    );
    sourceFileNode.solidityLegacyNow = this.usesLegacySolidityNow();
    sourceFileNode.importedContracts.push(...contracts.slice(0, -1));
    sourceFileNode.declaredLibraryNames = declaredLibraryNames;
    sourceFileNode.libraryFunctionSignatures = libraryFunctionSignatures;
    sourceFileNode.libraryEventSignatures = libraryEventSignatures;
    sourceFileNode.libraryAnonymousEvents = libraryAnonymousEvents;
    sourceFileNode.libraryErrorSignatures = libraryErrorSignatures;
    sourceFileNode.libraryErrorDefinitions = libraryErrorDefinitions;
    sourceFileNode.libraryModifierDefinitions = libraryModifierDefinitions;
    sourceFileNode.abiCoderVersion = selectedAbiCoder?.version;
    sourceFileNode.location = Location.fromCtx(ctx);
    return sourceFileNode;
  }

  visitWildcardImport(ctx: WildcardImportContext): ImportNode {
    const rawPath = ctx.StringLiteral().getText();
    const importPath = rawPath.substring(1, rawPath.length - 1);
    const node = new ImportNode(importPath, 'wildcard');
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitNamespaceImport(ctx: NamespaceImportContext): ImportNode {
    const rawPath = ctx.StringLiteral().getText();
    const importPath = rawPath.substring(1, rawPath.length - 1);
    const alias = ctx.Identifier().getText();
    const node = new ImportNode(importPath, 'namespace', alias);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitSelectiveImport(ctx: SelectiveImportContext): ImportNode {
    const fromKeyword = ctx.Identifier().getText();
    if (fromKeyword !== 'from') {
      throw new ParseError(
        `Expected 'from' keyword, got '${fromKeyword}'`,
        Location.fromCtx(ctx),
      );
    }
    const rawPath = ctx.StringLiteral().getText();
    const importPath = rawPath.substring(1, rawPath.length - 1);
    const bindings = ctx.importBinding_list().map((b) => {
      const identifiers = b.Identifier_list();
      return {
        name: identifiers[0].getText(),
        alias: identifiers.length > 1 ? identifiers[1].getText() : undefined,
      };
    });
    const node = new ImportNode(importPath, 'selective', undefined, bindings);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  processPragma(ctx: PragmaDirectiveContext): void {
    const alternatives = ctx.pragmaValue()?.versionAlternative_list() ?? [];
    const constraints = alternatives.flatMap((alternative) => alternative.versionConstraint_list());

    // solc permits bare decimal integers as version components, but stores each component in a uint32.
    // Preserve that syntax check even though compatibility mode otherwise ignores Solidity's requested range.
    if (ctx.pragmaName()?.getText() === 'solidity') {
      for (const constraint of constraints) {
        const integer = constraint.NumberLiteral()?.getText().replaceAll('_', '');
        if (integer !== undefined && BigInt(integer) > 0xffff_ffffn) {
          throw new ParseError('Invalid Solidity version pragma: integer component exceeds uint32', Location.fromCtx(ctx));
        }
      }
      // Adjacent constraints form an intersection only for comparison operators. A second caret/tilde/exact
      // range (e.g. `^0^1`) is malformed rather than a conjunction.
      for (const alternative of alternatives) {
        const terms = alternative.versionConstraint_list();
        if (!alternative.getText().includes('-') && terms.length > 1 && terms.some((term) => {
          const op = term.versionOperator()?.getText();
          return op === undefined || op === '^' || op === '~' || op === '=';
        })) {
          throw new ParseError('Invalid Solidity version pragma conjunction', Location.fromCtx(ctx));
        }
      }
    }

    // solidityImportCompat: accept `pragma solidity <any>` and known EVM compiler switches, but retain
    // Solidity's rejection of misspelled/unknown pragma names.
    if (this.solidityImportCompat) {
      if (!ctx.pragmaName()) {
        const name = ctx.Identifier(0)?.getText();
        if (name !== 'abicoder' && name !== 'experimental') {
          throw new ParseError(`Unknown pragma '${name}'`, Location.fromCtx(ctx));
        }
      }
      return;
    }

    // The tolerant grammar alt parses `pragma <ident> ...;` without a pragmaName. Allow the known EVM no-op
    // directives (abicoder / experimental); reject any other bare-identifier pragma as unsupported/typo'd.
    if (!ctx.pragmaName()) {
      const name = ctx.Identifier(0)?.getText();
      if (name === 'abicoder' || name === 'experimental') return;
      throw new ParseError(
        `Unsupported pragma '${name}'. Only 'solidcash' is supported; `
        + 'enable solidityImportCompat to accept \'solidity\'.',
        Location.fromCtx(ctx),
      );
    }

    const pragmaName = getPragmaName(ctx.pragmaName().getText());
    if (pragmaName !== PragmaName.SOLIDCASH) {
      throw new ParseError(
        `Unsupported pragma '${ctx.pragmaName().getText()}'. Only 'solidcash' is supported; `
        + 'enable solidityImportCompat to accept \'solidity\'.',
        Location.fromCtx(ctx),
      );
    }
    if (ctx.pragmaValue().getText().includes('||') || ctx.pragmaValue().getText().includes('-')) {
      throw new ParseError(
        'SolidCash version pragmas do not support disjunctions or hyphen ranges',
        Location.fromCtx(ctx),
      );
    }
    if (constraints.some((constraint) => constraint.NumberLiteral() !== null)) {
      throw new ParseError(
        'SolidCash version pragmas require a dotted semantic version',
        Location.fromCtx(ctx),
      );
    }

    // Strip any -beta tags
    const actualVersion = version.replace(/-.*/g, '');

    constraints.forEach((constraint) => {
      const op = getVersionOpFromCtx(constraint.versionOperator());
      // The version may be a full X.Y.Z (VersionLiteral) or a 2-part (DecimalLiteral, e.g. 0.0).
      const versionToken = constraint.VersionLiteral() ?? constraint.DecimalLiteral();
      const versionConstraint = `${op}${versionToken?.getText() ?? ''}`;
      if (!semver.satisfies(actualVersion, versionConstraint)) {
        throw new VersionError(actualVersion, versionConstraint);
      }
    });
  }

  // The contract body permits declarations in any order, so singletons (constructor, fallback, receive)
  // parse as lists; enforce at-most-one here.
  private atMostOne<T>(list: T[], label: string, ctx: ContractDefinitionContext): T | undefined {
    if (list.length > 1) {
      throw new ParseError(`A contract may have at most one ${label}`, Location.fromCtx(ctx));
    }
    return list[0];
  }

  visitContractDefinition(ctx: ContractDefinitionContext): ContractNode {
    this.pendingStorageReturnPushes = new Map();
    const name = ctx.anyIdentifier().getText();
    if (this.solidityImportCompat) {
      const declared = new Map<string, string>();
      const register = (declName: string, kind: string, locationCtx: ParserRuleContext): void => {
        const previous = declared.get(declName);
        if (previous !== undefined && (previous !== kind
          || (kind !== 'function' && kind !== 'event' && kind !== 'modifier'))) {
          throw new ParseError(`Identifier '${declName}' is already declared`, Location.fromCtx(locationCtx));
        }
        declared.set(declName, kind);
      };
      for (const item of ctx.stateVariableDeclaration_list()) {
        register(item.anyIdentifier().getText(), 'variable', item);
      }
      for (const item of ctx.constantDefinition_list()) {
        register(item.anyIdentifier().getText(), 'variable', item);
      }
      for (const item of ctx.eventDefinition_list()) {
        register(item.anyIdentifier()?.getText() ?? item._eventSpecialName.text, 'event', item);
      }
      for (const item of ctx.modifierDefinition_list()) {
        register(item.Identifier().getText(), 'modifier', item);
      }
      for (const item of ctx.functionDefinition_list()) {
        register(item.functionName().getText(), 'function', item);
      }
      for (const item of ctx.abstractFunctionDefinition_list()) {
        register(item.functionName().getText(), 'function', item);
      }
    }
    this.currentContractName = name;
    this.currentContractFunctionNames = new Set([
      ...ctx.functionDefinition_list().map((f) => f.functionName().getText()),
      ...ctx.abstractFunctionDefinition_list().map((f) => f.functionName().getText()),
    ]);
    this.nonTypeNames = new Set([
      ...this.sourceNonTypeNames,
      ...this.currentContractFunctionNames,
      ...ctx.errorDefinition_list().map((error) => error.anyIdentifier().getText()),
      ...ctx.modifierDefinition_list().map((modifier) => modifier.Identifier().getText()),
    ]);
    this.selfExternalFunctionReturnAliases = new Map();
    // Resolve constants up front so they can be used while constructing types anywhere in the contract body.
    this.scanConstantStrings(ctx.constantDefinition_list());
    this.scanConstantDimensions(ctx.constantDefinition_list());
    this.scanConstantStateVars(ctx.stateVariableDeclaration_list());
    const specs = ctx.inheritanceSpecifier_list();
    const implementsList = specs.map((s) => s.Identifier().getText());
    this.currentContractBaseNames = new Set(implementsList);
    // Inheritance-list constructor args (`is X("a")`) -> parent invocations, same as a constructor-level X("a").
    const inheritanceInvocations: ParentInvocation[] = specs
      .filter((s) => s.expressionList() !== null)
      .map((s) => ({
        parentName: s.Identifier().getText(),
        args: this.buildCallArguments(s.expressionList()!),
        location: Location.fromCtx(s),
      }));
    // Collect enum definitions
    const enumDefinitions = ctx.enumDefinition_list().map(
      (e) => this.visitEnumDefinition(e),
    );

    // Register user-defined value types before struct fields: a struct may contain `T` or `T[]` even when the
    // `type T is ...` declaration appears later in source. UDVT underlyings are elementary, so they do not
    // depend on struct registration.
    const typeDefinitions: TypeDefinitionNode[] = [];
    for (const tdCtx of ctx.typeDefinition_list()) {
      const td = this.visitTypeDefinition(tdCtx);
      typeDefinitions.push(td);
    }

    // Collect struct definitions after enums/typedefs (all field types must already be resolvable).
    const structDefinitions: StructDefinitionNode[] = [];
    this.registerStructDefinitions(ctx.structDefinition_list(), structDefinitions);

    // Contract-level constructor parameters are built AFTER enums/structs/typedefs register so a struct/enum/
    // UDVT-typed parameter (`contract C(Point p)`) resolves to its real type - Solidity parity, a struct is a
    // valid constructor arg. In the header position the type name resolved to an address stub -> (non-struct).
    const parameters = ctx.parameterList()
      ? ctx.parameterList()!.parameter_list().map((p) => this.visit(p) as ParameterNode)
      : [];

    // Collect event definitions
    const eventDefinitions: EventDefinitionNode[] = [];
    for (const evCtx of ctx.eventDefinition_list()) {
      const ev = this.visitEventDefinition(evCtx);
      eventDefinitions.push(ev);
    }

    // Collect error definitions
    const errorDefinitions = ctx.errorDefinition_list().map(
      (e) => this.visitErrorDefinition(e),
    );

    // Collect constant definitions
    const constantDefinitions = ctx.constantDefinition_list().map(
      (c) => this.visitConstantDefinition(c),
    );

    // Collect using-for directives
    const usingForDirectives = ctx.usingForDirective_list().map(
      (u) => this.visit(u) as UsingForDirectiveNode,
    );

    // Map each `using L for T` target struct type (bare name) to its library, for method-call desugaring.
    this.usingForLibraries = new Map();
    for (const u of usingForDirectives) {
      if (u.libraryName && u.isWildcard) {
        this.usingForLibraries.set('*', u.libraryName);
      } else if (u.libraryName && u.targetTypeName) {
        const t = u.targetTypeName;
        this.usingForLibraries.set(t.includes('.') ? t.slice(t.lastIndexOf('.') + 1) : t, u.libraryName);
      }
    }

    // Visit state variable declarations and separate into state variables vs collections
    let stateVariables: StateVariableNode[] = [];
    const collections: CollectionNode[] = [];
    for (const svCtx of ctx.stateVariableDeclaration_list()) {
      const visited = this.visit(svCtx);
      if (visited instanceof CollectionNode) {
        collections.push(visited);
      } else if (visited instanceof ConstantDefinitionNode) {
        constantDefinitions.push(visited); // `<vis> constant X` is a baked constant, not stored state
      } else {
        stateVariables.push(visited as StateVariableNode);
      }
    }

    // Flatten state vars of a struct with no single-value representation - a mapping field, or a dynamic
    // chunk-packed array field - into per-field state elements namespaced `<var>__<field>`. RECURSIVE: a
    // struct-typed field that itself needs flattening expands into its own leaves (`str__nstr__nestedValue`);
    // each intermediate registers in mappingStructStateVars so reads chain through visitFieldAccess and
    // writes collapse their leading members (see buildLvalueAssign).
    this.mappingStructStateVars = new Map();
    const expandedStateVars: StateVariableNode[] = [];
    const flattenedPublicStructGetters: {
      name: string;
      type: StructType;
      visibility: StateVariableVisibility;
    }[] = [];
    const flattenInto = (prefix: string, t: StructType, location: Location | undefined, seen: Set<StructType>): void => {
      if (seen.has(t)) return; // struct-field cycle (invalid Solidity) - refuse to expand infinitely
      this.mappingStructStateVars.set(prefix, t);
      for (const field of t.fields) {
        const flattenedName = `${prefix}__${field.name}`;
        if (field.type instanceof StructType && this.structNeedsFieldFlattening(field.type)) {
          flattenInto(flattenedName, field.type, location, new Set([...seen, t]));
          continue;
        }
        const flat = this.buildFlattenedStructField(field.type, flattenedName, location);
        if (flat instanceof CollectionNode) collections.push(flat);
        else expandedStateVars.push(flat);
      }
    };
    for (const sv of stateVariables) {
      if (sv.type instanceof StructType && this.structNeedsFieldFlattening(sv.type)) {
        if (sv.visibility === StateVariableVisibility.PUBLIC
          || sv.visibility === StateVariableVisibility.EXTERNAL) {
          flattenedPublicStructGetters.push({
            name: sv.name,
            type: sv.type,
            visibility: sv.visibility,
          });
        }
        flattenInto(sv.name, sv.type, sv.location, new Set());
      } else {
        expandedStateVars.push(sv);
      }
    }
    stateVariables = expandedStateVars;

    // Flatten single-key state mappings whose value struct itself bears a mapping/dynamic field (no single-value
    // representation): `mapping(K => Outer)` -> one flattened collection per Outer field, keyed by the outer key
    // prepended: `providers__data : mapping(K => <Outer.data type>)`. `providers[k].data[k2]` then routes to the
    // nested state mapping `providers__data[k][k2]`.
    this.mappingStructValueVars = new Map();
    const expandedCollections: CollectionNode[] = [];
    const innermostMappingStruct = (type: MappingType): StructType | undefined => {
      let value: Type = type.valueType;
      while (value instanceof MappingType) value = value.valueType;
      return this.structFromType(value);
    };
    const replaceInnermostMappingValue = (type: MappingType, value: Type): MappingType => new MappingType(
      type.keyType,
      type.valueType instanceof MappingType ? replaceInnermostMappingValue(type.valueType, value) : value,
      type.keyName,
      type.valueName,
    );
    // A recursive mapping field (`mapping(K => Self)`, including mutual recursion through another struct)
    // has no finite whole-state expansion. Keep the scalar leaves reached before the cycle and omit only the
    // mapping edge that revisits a struct already on this collection's expansion path.
    const pendingCollections = collections.map((collection) => ({
      collection,
      structPath: new Set<StructType>(),
    }));
    while (pendingCollections.length > 0) {
      const { collection: col, structPath } = pendingCollections.shift()!;
      const valStruct = col.type instanceof MappingType ? innermostMappingStruct(col.type) : undefined;
      if (col.type instanceof MappingType && valStruct && this.structNeedsFieldFlattening(valStruct)) {
        this.mappingStructValueVars.set(col.name, valStruct);
        const nextPath = new Set(structPath);
        nextPath.add(valStruct);
        for (const field of valStruct.fields) {
          const nestedStruct = field.type instanceof MappingType
            ? innermostMappingStruct(field.type) : undefined;
          if (nestedStruct && nextPath.has(nestedStruct)) continue;
          const flatType = replaceInnermostMappingValue(col.type, field.type);
          const flat = new CollectionNode(flatType, `${col.name}__${field.name}`);
          flat.location = col.location;
          pendingCollections.push({ collection: flat, structPath: nextPath });
        }
      } else {
        expandedCollections.push(col);
      }
    }
    collections.length = 0;
    collections.push(...expandedCollections);

    // Record state mappings whose value is a struct, so `m[i].arr[j] = v` can desugar (read the struct into a
    // temp, write the array-field element, write it back). Covers plain `mapping(K => S)` and the flattened
    // mapping-in-struct fields `X__field` (their value structs). Resolves a placeholder (defined-later) value.
    this.stateMappingValueStruct = new Map();
    for (const col of collections) {
      if (!(col.type instanceof MappingType)) continue;
      const st = this.structFromType(col.type.valueType);
      if (st) this.stateMappingValueStruct.set(col.name, st);
    }

    // `transient` state vars (EIP-1153) have no UTXO analog (BCH has no transaction-scoped contract storage,
    // and one spend = one function execution with no cross-call). They lower to a per-function zero-init local,
    // so drop them from the persisted state here; the injection happens after functions are built (below).
    const transientStateVars = stateVariables.filter((sv) => sv.isTransient);
    this.transientStateVarNames = new Set(transientStateVars.map((sv) => sv.name));
    stateVariables = stateVariables.filter((sv) => !sv.isTransient);

    // Track dense-indexable state array names for routing this.arr[i], this.arr.push/pop, this.arr.delete(i):
    // both packed (inline blob) and chunk-packed (dynamic) arrays share the same `pushdata(count)++elems`
    // element codegen.
    this.packedStateArrayNames = new Set(
      stateVariables
        .filter((sv) => sv.isPacked || (sv.isDynamic && sv.type instanceof ArrayType))
        .map((sv) => sv.name),
    );
    this.packedStructArrayElems = new Map(
      stateVariables
        .filter((sv) => (sv.isPacked || sv.isDynamic) && sv.type instanceof ArrayType
          && (sv.type as ArrayType).elementType instanceof StructType)
        .map((sv) => [sv.name, (sv.type as ArrayType).elementType as StructType]),
    );
    this.stateStructVars = new Map(
      stateVariables
        .filter((sv) => sv.type instanceof StructType)
        .map((sv) => [sv.name, sv.type as StructType]),
    );
    this.stateVarNames = new Set(stateVariables.map((sv) => sv.name));
    this.stateVarTypes = new Map(stateVariables.map((sv) => [sv.name, sv.type]));
    this.stateArrayVarTypes = new Map(
      stateVariables
        .filter((sv) => sv.type instanceof ArrayType)
        .map((sv) => [sv.name, sv.type as ArrayType]),
    );
    this.stateCollectionArrayTypes = new Map(
      collections
        .filter((collection) => collection.type instanceof ArrayType)
        .map((collection) => [collection.name, collection.type as ArrayType]),
    );
    this.mappingStateVarTypes = new Map(
      collections
        .filter((c) => c.type instanceof MappingType)
        .map((c) => [c.name, c.type as MappingType]),
    );
    this.stateSimpleTypeKeys = new Map();
    this.stateInterfaceReceivers = new Set();
    for (const stateVariable of stateVariables) {
      const key = this.usingForTypeKey(stateVariable.type);
      if (key) this.stateSimpleTypeKeys.set(stateVariable.name, key);
      if (stateVariable.type instanceof AddressType && stateVariable.type.interfaceName) {
        this.stateInterfaceReceivers.add(stateVariable.name);
      }
    }
    // Unbounded `bytes` state vars support `.push(b)` / `.pop()` (Solidity dynamic byte array). These desugar
    // to a whole-value concat / slice reassignment (a bytes blob has no per-element prefix), reusing the tested
    // bytes concat + split codegen rather than the length-prefixed array-element path.
    this.bytesStateVarNames = new Set(
      stateVariables
        .filter((sv) => sv.type instanceof BytesType && (sv.type as BytesType).bound === undefined)
        .map((sv) => sv.name),
    );
    this.stateStringVarNames = new Set(
      stateVariables.filter((sv) => sv.type === PrimitiveType.STRING).map((sv) => sv.name),
    );

    // Function bodies may call a struct-storage factory declared later in the contract
    // (`factory(args).field = value`). Predeclare those return structs before visiting any body so inline
    // storage-pointer writes are source-order independent.
    for (const functionCtx of ctx.functionDefinition_list()) {
      const returnParams = functionCtx.returnType()?.returnParam_list() ?? [];
      if (returnParams.length !== 1) continue;
      const returnType = this.returnParamType(returnParams[0]);
      if (returnType instanceof StructType) {
        this.functionReturnStructs.set(functionCtx.functionName().getText(), returnType);
      }
    }

    // Collect modifier definitions
    const modifierDefinitions = ctx.modifierDefinition_list().map(
      (m) => this.visitModifierDefinition(m),
    );

    // Extract optional constructor (parsed as a list since the body allows any declaration order).
    const constructorCtx = this.atMostOne(ctx.constructorDefinition_list(), 'constructor', ctx);
    let constructorDef: FunctionDefinitionNode | undefined;
    if (constructorCtx) {
      this.contractParamNames = new Set(parameters.map((p) => p.name));
      constructorDef = this.visitConstructorDefinition(constructorCtx);
    }

    const concreteFunctions = ctx.functionDefinition_list().map((f) => this.visit(f) as FunctionDefinitionNode);
    const unresolvedStoragePush = this.pendingStorageReturnPushes.entries().next();
    if (!unresolvedStoragePush.done) {
      const [, pending] = unresolvedStoragePush.value;
      throw new ParseError('Invalid .push/.pop/.delete target', pending[0].block.location!);
    }

    // Collect abstract function definitions (bodyless functions in abstract contracts)
    const abstractFunctions = ctx.abstractFunctionDefinition_list().map(
      (f) => this.visitAbstractFunctionDefinition(f),
    );

    // Merge and sort by source position so function order matches source code
    const functions = [...concreteFunctions, ...abstractFunctions]
      .sort((a, b) => (a.location?.start.line ?? 0) - (b.location?.start.line ?? 0));
    if (this.solidityImportCompat) {
      const oldStyleConstructor = functions.find((fn) => fn.name === name);
      if (oldStyleConstructor) {
        throw new ParseError(
          `Function '${oldStyleConstructor.name}' cannot have the same name as its contract`,
          oldStyleConstructor.location!,
        );
      }
    }

    // Extract optional fallback/receive
    const fallbackCtx = this.atMostOne(ctx.fallbackDefinition_list(), 'fallback function', ctx);
    let fallbackDef: FunctionDefinitionNode | undefined;
    if (fallbackCtx) {
      fallbackDef = this.visitFallbackDefinition(fallbackCtx);
    }

    const receiveCtx = this.atMostOne(ctx.receiveDefinition_list(), 'receive function', ctx);
    let receiveDef: FunctionDefinitionNode | undefined;
    if (receiveCtx) {
      receiveDef = this.visitReceiveDefinition(receiveCtx);
    }

    // Lower inline state-variable initializers `T x = expr;` into constructor assignments `this.x = expr;`,
    // run at deploy before the user's constructor body. Create a `__construct` if none exists.
    const initStatements: StatementNode[] = stateVariables
      .filter((sv) => sv.initializer)
      .flatMap((sv) => {
        const markInitializerContext = (node: Node): void => {
          if (node instanceof NullaryOpNode && node.operator === NullaryOperator.MSG_VALUE) {
            node.fromStateInitializer = true;
          }
          for (const value of Object.values(node)) {
            if (value instanceof Node) markInitializerContext(value);
            else if (Array.isArray(value)) {
              for (const item of value) if (item instanceof Node) markInitializerContext(item);
            }
          }
        };
        markInitializerContext(sv.initializer!);
        const assign = new StateAssignNode(sv.name, sv.initializer!);
        assign.location = sv.location;
        sv.initializer = undefined;
        const statements = [...sv.initializerPrelude, assign];
        sv.initializerPrelude = [];
        return statements;
      });
    if (initStatements.length > 0) {
      if (constructorDef) {
        constructorDef.body.statements = [...initStatements, ...(constructorDef.body.statements ?? [])];
      } else {
        const block = new BlockNode(initStatements);
        block.location = Location.fromCtx(ctx);
        constructorDef = new FunctionDefinitionNode('__construct', [], block);
        constructorDef.location = Location.fromCtx(ctx);
      }
    }

    // `transient` state vars lower to a per-function zero-init local (reset to 0 at the start of each spend,
    // never persisted). The lowering is deferred to LowerTransientStateVars (a pre-semantic pass) so it runs
    // AFTER inheritance flattening - a transient var declared in a base must be lowered into the derived
    // contract's functions too. Just record them on the node here.

    const contract = new ContractNode(
      name, parameters, structDefinitions, eventDefinitions, constantDefinitions,
      stateVariables, collections, constructorDef, functions,
    );
    contract.enumDefinitions = enumDefinitions;
    contract.typeDefinitions = typeDefinitions;
    contract.errorDefinitions = errorDefinitions;
    contract.usingForDirectives = usingForDirectives;
    contract.modifierDefinitions = modifierDefinitions;
    contract.transientStateVars = transientStateVars;
    contract.flattenedPublicStructGetters = flattenedPublicStructGetters;
    contract.fallbackDef = fallbackDef;
    contract.receiveDef = receiveDef;
    contract.isAbstract = ctx.children?.some((c) => c.getText() === 'abstract') === true;
    contract.implements = implementsList;
    contract.parentInvocations = [...inheritanceInvocations, ...this.pendingParentInvocations];
    this.pendingParentInvocations = [];
    contract.location = Location.fromCtx(ctx);
    return contract;
  }

  visitConstructorDefinition(ctx: ConstructorDefinitionContext): FunctionDefinitionNode {
    this.storageAliases = new Map();
    this.storageReferenceTypes = new Map();
    this.localStructTypes = new Map();
    this.localBytesVars = new Set();
    this.localSimpleTypeKeys = new Map();
    this.localInterfaceReceivers = new Set();
    this.localStructArrayTypes = new Map();
    this.localArrayVarTypes = new Map();
    this.expiredLoopVariableNames = new Set();
    const parameters = ctx.parameterList().parameter_list().map((p) => this.visit(p) as ParameterNode);
    for (const p of parameters) {
      if (p.type instanceof StructType) this.localStructTypes.set(p.name, p.type);
      if (p.type instanceof ArrayType) this.localArrayVarTypes.set(p.name, p.type);
      if (p.type instanceof BytesType && p.type.bound === undefined) this.localBytesVars.add(p.name);
      if (p.modifier.includes(Modifier.STORAGE)) this.storageReferenceTypes.set(p.name, p.type);
      this.recordUsingForReceiver(p.name, p.type);
    }
    const structPtrParams = this.registerStructPointerParams(parameters);
    const statements = this.flattenStatements(ctx.statement_list().map((s) => this.visit(s) as StatementNode));
    for (const name of structPtrParams) this.mappingStructStateVars.delete(name);
    const block = new BlockNode(statements);
    block.location = Location.fromCtx(ctx);

    // Parse parent invocations
    const piCtxList = ctx.parentInvocation_list();
    if (piCtxList && piCtxList.length > 0) {
      this.pendingParentInvocations = piCtxList.map(
        (piCtx: ParentInvocationContext): ParentInvocation => ({
          parentName: piCtx.Identifier().getText(),
          args: this.buildCallArguments(piCtx.expressionList()!),
          location: Location.fromCtx(piCtx),
        }),
      );
      // Native pattern: the constructor's params MIRROR the contract-level params (already in scope) - drop
      // those to avoid VariableRedefinitionError; the body reads the contract params. Solidity pattern:
      // `constructor(uint256 _x) Base(_x)` declares its OWN params with no contract-level equivalent - keep
      // those so the parent-invocation args and the body resolve.
      const ownParams = parameters.filter((p) => !this.contractParamNames.has(p.name));
      const functionDefinition = new FunctionDefinitionNode('__construct', ownParams, block);
      functionDefinition.location = Location.fromCtx(ctx);
      this.applyConstructorModifiers(ctx, functionDefinition);
      return functionDefinition;
    }

    const functionDefinition = new FunctionDefinitionNode('__construct', parameters, block);
    functionDefinition.location = Location.fromCtx(ctx);
    this.applyConstructorModifiers(ctx, functionDefinition);
    return functionDefinition;
  }

  private applyConstructorModifiers(ctx: ConstructorDefinitionContext, node: FunctionDefinitionNode): void {
    const supported = new Set(['public', 'internal', 'external', 'payable']);
    for (const child of ctx.children ?? []) {
      const text = child.getText();
      if (supported.has(text)) node.modifiers.push(text as FunctionModifier);
    }
    node.customModifiers = ctx.customModifierInvocation_list().map(
      (modifier: CustomModifierInvocationContext): CustomModifierInvocation => ({
        name: this.customModifierName(modifier),
        args: modifier.expressionList() ? this.buildCallArguments(modifier.expressionList()!) : [],
        location: Location.fromCtx(modifier),
      }),
    );
  }

  visitFallbackDefinition(ctx: FallbackDefinitionContext): FunctionDefinitionNode {
    const statements = this.flattenStatements(ctx.statement_list().map((s) => this.visit(s) as StatementNode));
    const block = new BlockNode(statements);
    block.location = Location.fromCtx(ctx);
    const parameters = ctx.parameterList().parameter_list().map((p) => this.visit(p) as ParameterNode);
    const node = new FunctionDefinitionNode('__fallback', parameters, block);
    node.isFallback = true;
    node.location = Location.fromCtx(ctx);

    // 'external' is always present in the grammar, parse optional fallback modifiers (payable, virtual, override)
    const modifiers: FunctionModifier[] = [FunctionModifier.EXTERNAL];
    const fallbackModCtxs = ctx.fallbackModifier_list();
    if (fallbackModCtxs && fallbackModCtxs.length > 0) {
      modifiers.push(...fallbackModCtxs.map(
        (m) => (m.overrideSpecifier() ? FunctionModifier.OVERRIDE : m.getText() as FunctionModifier),
      ));
    }
    node.modifiers = modifiers;

    // Parse custom modifier invocations
    const customModCtxs = ctx.customModifierInvocation_list();
    if (customModCtxs && customModCtxs.length > 0) {
      node.customModifiers = customModCtxs.map(
        (m: CustomModifierInvocationContext): CustomModifierInvocation => ({
          name: this.customModifierName(m),
          args: m.expressionList()
            ? this.buildCallArguments(m.expressionList()!)
            : [],
          location: Location.fromCtx(m),
        }),
      );
    }

    // A Solidity fallback may declare a return type (`fallback(bytes) external returns (bytes)`, the forwarding
    // proxy form). Lowered like a normal returning function; the body's `return` provides the value.
    const returnTypeCtx = ctx.returnType();
    if (returnTypeCtx) this.applyReturnType(node, returnTypeCtx);

    return node;
  }

  visitReceiveDefinition(ctx: ReceiveDefinitionContext): FunctionDefinitionNode {
    const statements = this.flattenStatements(ctx.statement_list().map((s) => this.visit(s) as StatementNode));
    const block = new BlockNode(statements);
    block.location = Location.fromCtx(ctx);
    const node = new FunctionDefinitionNode('__receive', [], block);
    node.isReceive = true;
    // 'external payable' are both required in the grammar; retain virtual/override
    // so inheritance validation treats receive like an ordinary function.
    node.modifiers = [FunctionModifier.EXTERNAL, FunctionModifier.PAYABLE];
    const modifierContexts = ctx.receiveModifier_list();
    if (modifierContexts && modifierContexts.length > 0) {
      node.modifiers.push(...modifierContexts.map(
        (modifier) => (modifier.overrideSpecifier()
          ? FunctionModifier.OVERRIDE : modifier.getText() as FunctionModifier),
      ));
    }
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitFunctionDefinition(ctx: FunctionDefinitionContext): FunctionDefinitionNode {
    this.selfExternalFunctionAliases = new Map();
    this.indexedExternalFunctionAliases = new Map();
    this.storageAliases = new Map();
    this.storageReferenceTypes = new Map();
    this.localStructTypes = new Map();
    this.localBytesVars = new Set();
    this.localSimpleTypeKeys = new Map();
    this.localInterfaceReceivers = new Set();
    this.localStructArrayTypes = new Map();
    this.localArrayVarTypes = new Map();
    this.expiredLoopVariableNames = new Set();
    const name = ctx.functionName().getText();
    const parameters = ctx.parameterList().parameter_list().map((p) => this.visit(p) as ParameterNode);
    // Struct-typed params (incl. `storage` struct pointers) participate in struct-field-write desugaring,
    // so `d.x = v` in a library/helper body rebuilds the struct as for a local.
    for (const p of parameters) {
      if (p.type instanceof StructType) this.localStructTypes.set(p.name, p.type);
      if (p.type instanceof ArrayType) this.localArrayVarTypes.set(p.name, p.type);
      if (p.type instanceof BytesType && p.type.bound === undefined) this.localBytesVars.add(p.name);
      if (p.modifier.includes(Modifier.STORAGE)) this.storageReferenceTypes.set(p.name, p.type);
      this.recordUsingForReceiver(p.name, p.type);
    }
    const structPtrParams = this.registerStructPointerParams(parameters);
    this.registerNamedReturnLocals(ctx.returnType());
    const rtCtx = ctx.returnType();
    this.currentFnIsVoid = !rtCtx || rtCtx.returnParam_list().length === 0;
    const statements = this.flattenStatements(ctx.statement_list().map((s) => this.visit(s) as StatementNode));
    this.currentFnIsVoid = undefined;
    for (const nm of structPtrParams) this.mappingStructStateVars.delete(nm);
    const block = new BlockNode(statements);
    block.location = Location.fromCtx(ctx);

    const functionDefinition = new FunctionDefinitionNode(name, parameters, block);
    functionDefinition.location = Location.fromCtx(ctx);
    functionDefinition.storagePointerAliases = Object.fromEntries(
      [...this.storageAliases].flatMap(([aliasName, alias]) =>
        alias.keys.length === 0 && alias.access instanceof IdentifierNode
          ? [[aliasName, alias.container] as const] : []),
    );
    functionDefinition.selfExternalFunctionAliases = Object.fromEntries(this.selfExternalFunctionAliases);

    // Parse function modifiers
    const modifierContexts = ctx.functionModifier_list();
    if (modifierContexts && modifierContexts.length > 0) {
      this.parseFunctionModifiers(modifierContexts, functionDefinition);
    }
    // Parse custom modifier invocations (split/merge are handled specially)
    const customModCtxs = ctx.customModifierInvocation_list();
    if (customModCtxs && customModCtxs.length > 0) {
      functionDefinition.customModifiers = customModCtxs
        .filter((m) => !this.tryParseSplitMergeModifier(m, functionDefinition))
        .map(
          (m: CustomModifierInvocationContext): CustomModifierInvocation => ({
            name: this.customModifierName(m),
            args: m.expressionList()
              ? this.buildCallArguments(m.expressionList()!)
              : [],
            location: Location.fromCtx(m),
          }),
        );
    }

    // Parse return types
    const returnTypeCtx = ctx.returnType();
    if (returnTypeCtx) {
      this.applyReturnType(functionDefinition, returnTypeCtx);
    }
    if (functionDefinition.returnTypes.length === 1
      && functionDefinition.returnTypes[0] instanceof FunctionType
      && functionDefinition.returnTypes[0].isExternal
      && (functionDefinition.body.statements?.length ?? 0) > 0) {
      const statement = functionDefinition.body.statements![functionDefinition.body.statements!.length - 1];
      const returned = statement instanceof ReturnNode && statement.expressions.length === 1
        ? statement.expressions[0] : undefined;
      if (returned instanceof StateAccessNode && this.currentContractFunctionNames.has(returned.name)) {
        this.selfExternalFunctionReturnAliases.set(name, returned.name);
        functionDefinition.returnedSelfFunctionName = returned.name;
      } else if (statement instanceof AssignNode
        && functionDefinition.returnNames?.includes(statement.identifier.name)
        && statement.expression instanceof StateAccessNode
        && this.currentContractFunctionNames.has(statement.expression.name)) {
        // Named-return form: `returns (function() external p) { p = this.f; }`.
        this.selfExternalFunctionReturnAliases.set(name, statement.expression.name);
        functionDefinition.returnedSelfFunctionName = statement.expression.name;
      }
    }
    // Record a struct-returning function (for inline storage-pointer writes `Lib.f(slot).value = v`).
    if (functionDefinition.returnTypes?.length === 1 && functionDefinition.returnTypes[0] instanceof StructType) {
      this.functionReturnStructs.set(name, functionDefinition.returnTypes[0]);
    }
    if (parameters.length === 0 && functionDefinition.returnTypes.length === 1
      && functionDefinition.returnModifiers?.[0]?.includes(Modifier.STORAGE)) {
      const bodyStatements = functionDefinition.body.statements ?? [];
      const tail = bodyStatements[bodyStatements.length - 1];
      const returned = tail instanceof ReturnNode && tail.expressions.length === 1 ? tail.expressions[0] : undefined;
      let targetName = returned instanceof IdentifierNode ? returned.name
        : returned instanceof StateAccessNode ? returned.name : undefined;
      let keys: ExpressionNode[] = [];
      if (returned instanceof MappingAccessNode) {
        targetName = returned.name;
        keys = returned.keys;
      } else if (returned instanceof ArrayAccessNode && returned.array instanceof IdentifierNode) {
        targetName = returned.array.name;
        keys = [returned.index];
      } else if (returned instanceof TupleIndexOpNode && returned.tuple instanceof IdentifierNode) {
        targetName = returned.tuple.name;
        const key = new IntLiteralNode(BigInt(returned.index));
        key.location = returned.location;
        keys = [key];
      }
      const prefix = statements.slice(0, -1);
      const safePrefix = prefix.every((statement) =>
        statement instanceof ArrayPushNode
        || statement instanceof StateArrayPushNode
        || (statement instanceof MappingAssignNode && statement.arrayPush));
      if (targetName && this.stateVarNames.has(targetName) && safePrefix) {
        const alias = {
          name: targetName,
          type: functionDefinition.returnTypes[0],
          keys: keys.map((key) => cloneNode(key) as ExpressionNode),
          prefix: prefix.map((statement) => cloneNode(statement) as StatementNode),
        };
        this.simpleStorageReturnAliases.set(name, alias);
        for (const pending of this.pendingStorageReturnPushes.get(name) ?? []) {
          pending.block.statements = this.buildStorageAliasPushStatements(
            alias, pending.value, pending.noArg, pending.ctx,
          );
        }
        this.pendingStorageReturnPushes.delete(name);
      }
    }

    // `selfdestruct(addr)` in the body implies the selfdestruct modifier (collapse all state UTXOs, no
    // recreation). The destination is enforced in codegen (visitSelfdestructStatement pins tx.outputs[0] to
    // addr); the SDK's selfdestructTo() routes the freed balance to addr at output 0.
    if (functionDefinition.body.statements!.some((s) => s instanceof SelfdestructStatementNode)
      && !functionDefinition.modifiers.includes(FunctionModifier.SELFDESTRUCT)) {
      functionDefinition.modifiers.push(FunctionModifier.SELFDESTRUCT);
      functionDefinition.impliedSelfdestruct = true;
    }

    return functionDefinition;
  }

  visitAbstractFunctionDefinition(ctx: AbstractFunctionDefinitionContext): FunctionDefinitionNode {
    const name = ctx.functionName().getText();
    const parameters = ctx.parameterList().parameter_list().map((p) => this.visit(p) as ParameterNode);

    // Abstract functions have no body - create an empty block
    const block = new BlockNode([]);
    block.location = Location.fromCtx(ctx);

    const functionDefinition = new FunctionDefinitionNode(name, parameters, block);
    functionDefinition.isAbstract = true;
    functionDefinition.location = Location.fromCtx(ctx);

    // Parse function modifiers
    const modifierContexts = ctx.functionModifier_list();
    if (modifierContexts && modifierContexts.length > 0) {
      this.parseFunctionModifiers(modifierContexts, functionDefinition);
    }
    if (this.solidityImportCompat
      && !functionDefinition.modifiers.includes(FunctionModifier.VIRTUAL)) {
      throw new ParseError(
        'Functions without implementation must be marked virtual',
        functionDefinition.location,
      );
    }

    // Parse custom modifier invocations (split/merge are handled specially)
    const customModCtxs = ctx.customModifierInvocation_list();
    if (customModCtxs && customModCtxs.length > 0) {
      if (this.solidityImportCompat) {
        throw new ParseError(
          'Functions without implementation cannot have modifiers',
          Location.fromCtx(customModCtxs[0]),
        );
      }
      functionDefinition.customModifiers = customModCtxs
        .filter((m) => !this.tryParseSplitMergeModifier(m, functionDefinition))
        .map(
          (m: CustomModifierInvocationContext): CustomModifierInvocation => ({
            name: this.customModifierName(m),
            args: m.expressionList()
              ? this.buildCallArguments(m.expressionList()!)
              : [],
            location: Location.fromCtx(m),
          }),
        );
    }

    // Parse return types
    const returnTypeCtx = ctx.returnType();
    if (returnTypeCtx) {
      this.applyReturnType(functionDefinition, returnTypeCtx);
    }

    return functionDefinition;
  }

  // A `storage` pointer to a mapping-bearing struct aliases the caller's flattened state struct. Register each
  // such param like a state var (returning the names to unregister after the body) so `map.field[k]` in the body
  // flattens to the `map__field` collection through the SAME path (2309 write / 2872 read) the caller's state
  // struct uses - identical entry-slot layout. InlineStoragePointerCalls renames `map__field` -> `<arg>__field`
  // at the call site and drops the function.
  private registerStructPointerParams(parameters: ParameterNode[]): string[] {
    const registered: string[] = [];
    const register = (prefix: string, type: StructType, seen: Set<StructType>): void => {
      if (seen.has(type)) return;
      this.mappingStructStateVars.set(prefix, type);
      registered.push(prefix);
      for (const field of type.fields) {
        if (field.type instanceof StructType && this.structNeedsFieldFlattening(field.type)) {
          register(`${prefix}__${field.name}`, field.type, new Set([...seen, type]));
        }
      }
    };
    for (const p of parameters) {
      if (p.modifier.includes(Modifier.STORAGE) && p.type instanceof StructType
        && this.structNeedsFieldFlattening(p.type)) {
        register(p.name, p.type, new Set());
      }
    }
    return registered;
  }

  visitFreeFunctionDefinition(ctx: FreeFunctionDefinitionContext): FunctionDefinitionNode {
    this.selfExternalFunctionAliases = new Map();
    this.indexedExternalFunctionAliases = new Map();
    this.storageAliases = new Map();
    this.storageReferenceTypes = new Map();
    this.localStructTypes = new Map();
    this.localBytesVars = new Set();
    this.localSimpleTypeKeys = new Map();
    this.localInterfaceReceivers = new Set();
    this.localStructArrayTypes = new Map();
    this.localArrayVarTypes = new Map();
    this.expiredLoopVariableNames = new Set();
    const name = ctx.functionName().getText();
    const parameters = ctx.parameterList().parameter_list().map((p) => this.visit(p) as ParameterNode);
    // Struct-typed params (incl. `storage` struct pointers) participate in struct-field-write desugaring.
    for (const p of parameters) {
      if (p.type instanceof StructType) this.localStructTypes.set(p.name, p.type);
      if (p.type instanceof ArrayType) this.localArrayVarTypes.set(p.name, p.type);
      if (p.type instanceof BytesType && p.type.bound === undefined) this.localBytesVars.add(p.name);
      if (p.modifier.includes(Modifier.STORAGE)) this.storageReferenceTypes.set(p.name, p.type);
      this.recordUsingForReceiver(p.name, p.type);
    }
    const structPtrParams = this.registerStructPointerParams(parameters);
    this.registerNamedReturnLocals(ctx.returnType());
    const rtCtx = ctx.returnType();
    this.currentFnIsVoid = !rtCtx || rtCtx.returnParam_list().length === 0;
    const previousParsingFreeFunctionBody = this.parsingFreeFunctionBody;
    this.parsingFreeFunctionBody = !this.parsingLibraryFunction;
    let statements: StatementNode[];
    try {
      statements = this.flattenStatements(ctx.statement_list().map((s) => this.visit(s) as StatementNode));
    } finally {
      this.parsingFreeFunctionBody = previousParsingFreeFunctionBody;
    }
    this.currentFnIsVoid = undefined;
    for (const nm of structPtrParams) this.mappingStructStateVars.delete(nm);
    const block = new BlockNode(statements);
    block.location = Location.fromCtx(ctx);

    const functionDefinition = new FunctionDefinitionNode(name, parameters, block);
    functionDefinition.location = Location.fromCtx(ctx);
    functionDefinition.isFreeFunction = true;
    functionDefinition.storagePointerAliases = Object.fromEntries(
      [...this.storageAliases].flatMap(([aliasName, alias]) =>
        alias.keys.length === 0 && alias.access instanceof IdentifierNode
          ? [[aliasName, alias.container] as const] : []),
    );

    // Parse function modifiers (visibility etc.). Library/free functions carry visibility so a library can be
    // classified into inline (internal/private) vs deployable (public/external) functions - see
    // docs/library-contracts.md (Phase 1). Inert for existing free functions, which declare no modifiers.
    const modifierContexts = ctx.functionModifier_list();
    if (modifierContexts && modifierContexts.length > 0) {
      this.parseFunctionModifiers(modifierContexts, functionDefinition);
      if (!this.parsingLibraryFunction) {
        const forbidden = functionDefinition.modifiers.find((m) => [
          FunctionModifier.PUBLIC, FunctionModifier.EXTERNAL, FunctionModifier.PRIVATE,
          FunctionModifier.PAYABLE, FunctionModifier.VIRTUAL, FunctionModifier.OVERRIDE,
        ].includes(m));
        if (forbidden) {
          throw new ParseError(`Free functions cannot have '${forbidden}'`, Location.fromCtx(modifierContexts[0]));
        }
      }
    }

    const customModCtxs = ctx.customModifierInvocation_list();
    if (customModCtxs && customModCtxs.length > 0) {
      if (!this.parsingLibraryFunction) {
        throw new ParseError('Custom modifiers are not allowed on free functions', Location.fromCtx(customModCtxs[0]));
      }
      functionDefinition.customModifiers = customModCtxs
        .filter((m) => !this.tryParseSplitMergeModifier(m, functionDefinition))
        .map((m): CustomModifierInvocation => ({
          name: this.customModifierName(m),
          args: m.expressionList() ? this.buildCallArguments(m.expressionList()!) : [],
          location: Location.fromCtx(m),
        }));
    }

    // Parse return types
    const returnTypeCtx = ctx.returnType();
    if (returnTypeCtx) {
      this.applyReturnType(functionDefinition, returnTypeCtx);
    }
    // Record a struct-returning free/library function (the OZ StorageSlot factory is a library function).
    if (functionDefinition.returnTypes?.length === 1 && functionDefinition.returnTypes[0] instanceof StructType) {
      this.functionReturnStructs.set(functionDefinition.name, functionDefinition.returnTypes[0]);
    }

    return functionDefinition;
  }

  visitModifierDefinition(ctx: ModifierDefinitionContext): ModifierDefinitionNode {
    this.storageAliases = new Map();
    this.storageReferenceTypes = new Map();
    this.localStructTypes = new Map();
    this.localBytesVars = new Set();
    this.localSimpleTypeKeys = new Map();
    this.localInterfaceReceivers = new Set();
    this.localStructArrayTypes = new Map();
    this.localArrayVarTypes = new Map();
    this.expiredLoopVariableNames = new Set();
    const name = ctx.Identifier().getText();
    const parameters = ctx.parameterList()
      ? ctx.parameterList()!.parameter_list().map((p) => this.visit(p) as ParameterNode)
      : [];
    for (const p of parameters) {
      if (p.type instanceof StructType) this.localStructTypes.set(p.name, p.type);
      if (p.type instanceof ArrayType) this.localArrayVarTypes.set(p.name, p.type);
      if (p.type instanceof BytesType && p.type.bound === undefined) this.localBytesVars.add(p.name);
      if (p.modifier.includes(Modifier.STORAGE)) this.storageReferenceTypes.set(p.name, p.type);
      this.recordUsingForReceiver(p.name, p.type);
    }
    const structPtrParams = this.registerStructPointerParams(parameters);
    const statements = ctx.modifierStatement_list().map((s) => {
      if (s.placeholderStatement()) {
        const placeholder = new PlaceholderStatementNode();
        placeholder.location = Location.fromCtx(s.placeholderStatement()!);
        return placeholder;
      }
      this.parsingModifierBody = true;
      try {
        return this.visit(s.statement()!) as StatementNode;
      } finally {
        this.parsingModifierBody = false;
      }
    });
    for (const nm of structPtrParams) this.mappingStructStateVars.delete(nm);
    const node = new ModifierDefinitionNode(name, parameters, statements);
    node.isAbstract = ctx.getText().endsWith(';');
    node.isVirtual = (ctx.children ?? []).some((c) => c.getText() === 'virtual');
    const overrideSpec = ctx.overrideSpecifier_list()[0];
    node.isOverride = overrideSpec !== undefined;
    node.overrideBases = overrideSpec?.Identifier_list().map((id) => id.getText()) ?? [];
    node.location = Location.fromCtx(ctx);
    return node;
  }

  private parseFunctionModifiers(
    modifierContexts: FunctionModifierContext[],
    functionDefinition: FunctionDefinitionNode,
  ): void {
    for (const m of modifierContexts) {
      const unsafeCtx = m.unsafeModifier();
      if (unsafeCtx) {
        functionDefinition.modifiers.push(FunctionModifier.UNSAFE);
        const tierToken = unsafeCtx.NumberLiteral();
        functionDefinition.unsafeTier = tierToken ? parseInt(tierToken.getText(), 10) : 0;
        continue;
      }
      const overrideCtx = m.overrideSpecifier();
      if (overrideCtx) {
        functionDefinition.modifiers.push(FunctionModifier.OVERRIDE);
        functionDefinition.overrideBases = overrideCtx.Identifier_list().map((id) => id.getText());
        continue;
      }
      functionDefinition.modifiers.push(m.getText() as FunctionModifier);
    }
    // Private functions are not inherited, so Solidity does not permit them to participate in virtual dispatch.
    // Check during declaration construction so abstract functions (which have no traversable body) are covered.
    if (functionDefinition.modifiers.includes(FunctionModifier.PRIVATE)
      && functionDefinition.modifiers.includes(FunctionModifier.VIRTUAL)) {
      throw new ParseError(
        "'private' functions cannot be 'virtual'",
        functionDefinition.location,
      );
    }
    if (this.parsingLibraryFunction
      && functionDefinition.modifiers.includes(FunctionModifier.VIRTUAL)) {
      throw new ParseError(
        "Library functions cannot be 'virtual'",
        functionDefinition.location,
      );
    }
  }

  /**
   * Check if a custom modifier invocation is actually a split/merge modifier.
   * split(paramName) and merge(paramName) use the custom modifier syntax but
   * are handled specially - they set splitCountParam/mergeCountParam on the function.
   * Returns true if the invocation was consumed as split/merge.
   */
  private tryParseSplitMergeModifier(
    ctx: CustomModifierInvocationContext,
    functionDefinition: FunctionDefinitionNode,
  ): boolean {
    const name = this.customModifierName(ctx);
    if (name !== 'split' && name !== 'merge') return false;

    const exprList = ctx.expressionList();
    if (!exprList) return false;
    const exprs = exprList.callArgument_list();
    if (exprs.length !== 1) return false;

    // The argument must be a single identifier (parameter name)
    const argText = exprs[0].getText();

    if (name === 'split') {
      functionDefinition.modifiers.push(FunctionModifier.SPLIT);
      functionDefinition.splitCountParam = argText;
    } else {
      functionDefinition.modifiers.push(FunctionModifier.MERGE);
      functionDefinition.mergeCountParam = argText;
    }
    return true;
  }

  private customModifierName(ctx: CustomModifierInvocationContext): string {
    return ctx.Identifier_list().map((id) => id.getText()).join('.');
  }

  visitParameter(ctx: ParameterContext): ParameterNode {
    let type: Type;
    if (ctx.arrayType()) {
      type = this.buildArrayType(ctx.arrayType()!);
    } else if (ctx.mappingType()) {
      // `mapping(...) storage` parameter: a storage-pointer reference (inlined away pre-semantic).
      type = this.buildMappingType(ctx.mappingType()!);
    } else {
      // Unknown (contract/interface) type name falls back to address (validated later in semantic analysis);
      // the name is kept on the handle so an interface-typed param (`IERC20 token`) routes `token.method(..)`.
      const tn = ctx.typeName().getText();
      type = this.resolveType(tn) ?? new AddressType(false, tn);
    }
    const modifiers = ctx.modifier_list().map((m) => m.getText());
    if (this.solidityImportCompat) {
      const invalid = modifiers.find((modifier) => modifier === Modifier.CONSTANT
        || modifier === Modifier.IMMUTABLE);
      if (invalid) {
        throw new ParseError(
          invalid === Modifier.CONSTANT
            ? 'The "constant" keyword can only be used for state variables or variables at file level'
            : 'The "immutable" keyword can only be used for state variables',
          Location.fromCtx(ctx),
        );
      }
    }
    // Unnamed parameters (common in interface signatures, e.g. `transfer(address, uint256)`) get a synthetic
    // location-unique name; they cannot be referenced in a body.
    const loc = Location.fromCtx(ctx);
    const name = ctx.anyIdentifier()?.getText() ?? `__unnamed_${loc?.start.line ?? 0}_${loc?.start.column ?? 0}`;
    const parameter = new ParameterNode(type, name, modifiers);
    parameter.location = loc;
    return parameter;
  }

  visitStatement(ctx: StatementContext): StatementNode {
    // Statement nodes only have a single child, so we can just visit that child
    return this.visit(ctx.getChild(0));
  }

  // The modifier placeholder `_;` - allowed anywhere a statement is (e.g. inside an if/else branch, as in a
  // proxy's `ifAdmin` modifier); modifier expansion still rejects it outside a modifier body.
  visitPlaceholderStatement(ctx: PlaceholderStatementContext): StatementNode {
    if (!this.parsingModifierBody) {
      const noOp = new BlockNode([]);
      noOp.location = Location.fromCtx(ctx);
      return noOp;
    }
    const placeholder = new PlaceholderStatementNode();
    placeholder.location = Location.fromCtx(ctx);
    return placeholder;
  }

  visitBareCallOptionsStatement(ctx: any): StatementNode {
    // Although applying options without calling is a no-op, Solidity still validates option spelling and
    // duplicates. Parse them before discarding the resulting function reference.
    this.parseCallOptions(ctx.callOptions());
    const trailingMember = ctx.callOptionsFunctionMember?.()?.getText();
    if (trailingMember && trailingMember !== '.address' && trailingMember !== '.selector') {
      throw new ParseError(
        `Function value after call options has no member '${trailingMember.slice(1)}'`,
        Location.fromCtx(ctx.callOptionsFunctionMember()),
      );
    }
    const noOp = new BlockNode([]);
    noOp.location = Location.fromCtx(ctx);
    return noOp;
  }

  visitBareNewWithOptionsStatement(ctx: any): StatementNode {
    this.parseCallOptions(ctx.callOptions());
    const noOp = new BlockNode([]);
    noOp.location = Location.fromCtx(ctx);
    return noOp;
  }

  visitParenthesizedArrayPopStatement(ctx: any): StatementNode {
    const name = ctx.Identifier().getText();
    const isThis = ctx.getText().startsWith('(this.');
    return this.buildArrayPop(name, isThis, [], undefined, ctx);
  }

  visitVariableDefinition(ctx: VariableDefinitionContext): StatementNode {
    let type: Type;
    const functionArrayCtx = (ctx as any).functionArrayType?.();
    if (functionArrayCtx) {
      type = this.resolveType(functionArrayCtx.getText())!;
    } else if (ctx.arrayType()) {
      type = this.buildArrayType(ctx.arrayType()!);
    } else if (ctx.mappingType()) {
      // `mapping(...) storage p = m;` - a storage-pointer alias to a state mapping (like a mapping param).
      type = this.buildMappingType(ctx.mappingType()!);
    } else {
      // Keep an unknown (contract/interface) type name on the address handle so a local interface-typed
      // var (`IERC20 token = IERC20(addr)`) can route `token.method(..)` to an external call.
      const tn = ctx.typeName().getText();
      type = this.resolveType(tn) ?? new AddressType(false, tn);
    }
    const modifiers = ctx.modifier_list().map((modifier) => modifier.getText());
    const name = ctx.anyIdentifier().getText();
    if (this.solidityImportCompat && modifiers.includes('constant')) {
      throw new ParseError(
        'The "constant" keyword is not allowed on local variables',
        Location.fromCtx(ctx),
      );
    }
    if (this.solidityImportCompat && modifiers.includes('transient')) {
      throw new ParseError(
        'Transient data location is only valid on state variables',
        Location.fromCtx(ctx),
      );
    }

    // `uint x = y = 3;` - the initializer is an assignment chain: run the chain first, then initialize from
    // the first target's value (re-read after its write).
    if (ctx._iop) {
      const loc = Location.fromCtx(ctx);
      const initCtx = ctx.expression()!;
      const { links, valueCtx } = this.unrollAssignChain(initCtx, ctx._iop.text, ctx.assignChain()!);
      const stmts = this.buildAssignChainStatements(links, valueCtx, loc);
      const varDef = this.finishVariableDefinition(ctx, type, modifiers, name, this.visit(initCtx) as ExpressionNode);
      const block = new BlockNode([...stmts, varDef]);
      block.location = loc;
      return block;
    }
    // `uint x = cond ? y = 3 : 6;` - declare with the type default, then if/else: each arm runs its branch's
    // assignments and assigns the branch value to x.
    const initExprCtx = ctx.expression();
    if (initExprCtx instanceof TernaryOpContext && (initExprCtx._tOp || initExprCtx._fOp)) {
      const loc = Location.fromCtx(ctx);
      const decl = this.finishVariableDefinition(ctx, type, modifiers, name, undefined);
      const branch = this.buildTernaryAssignBranch(initExprCtx, (vctx) => {
        const target = new IdentifierNode(name);
        target.location = loc;
        const assign = new AssignNode(target, this.visit(vctx) as ExpressionNode);
        assign.location = loc;
        return assign;
      }, loc);
      const block = new BlockNode([decl, branch]);
      block.location = loc;
      return block;
    }

    // Whole read of a flattened struct state var / flattened-value mapping entry as a NON-storage struct
    // initializer (`S memory x = s;` / `= m[k];`): assemble the value from its leaves.
    if (initExprCtx && type instanceof StructType && !modifiers.includes(Modifier.STORAGE)) {
      const assembled = this.maybeAssembleFlattenedRead(initExprCtx, Location.fromCtx(ctx));
      if (assembled) return this.finishVariableDefinition(ctx, type, modifiers, name, assembled);
    }

    // An omitted initializer (`int x;`) leaves expression undefined; codegen emits the type's zero value.
    const expression = ctx.expression() ? this.visit(ctx.expression()) : undefined;
    if (modifiers.includes(Modifier.STORAGE)) {
      if (expression && !ctx.DotPush()) this.validateStorageReferenceBinding(name, type, expression);
      this.storageReferenceTypes.set(name, type);
    }
    let functionPointerMethodAlias: string | undefined;
    if (type instanceof FunctionType && type.isExternal && expression instanceof StateAccessNode
      && this.currentContractFunctionNames.has(expression.name)) {
      this.selfExternalFunctionAliases.set(name, expression.name);
      functionPointerMethodAlias = expression.name;
    } else if (type instanceof FunctionType && type.isExternal && initExprCtx) {
      const indexedMethod = this.indexedExternalFunctionAliases.get(initExprCtx.getText());
      if (indexedMethod) {
        this.selfExternalFunctionAliases.set(name, indexedMethod);
        functionPointerMethodAlias = indexedMethod;
      }
    }
    const containsMapping = (t: Type): boolean => t instanceof MappingType
      || (t instanceof ArrayType && containsMapping(t.elementType));
    if (!expression && modifiers.includes(Modifier.STORAGE) && containsMapping(type)) {
      throw new ParseError(
        `Storage pointer '${name}' containing a mapping must be initialized`,
        Location.fromCtx(ctx),
      );
    }

    // `T storage x = arr.push();`: Solidity's no-arg push returns a reference to the freshly-appended element.
    // Desugar to capturing the pre-push length (the new element's index), pushing a default element, and
    // aliasing `x` -> `arr[__idx]` - every read/write of `x` then rewrites to the real array element (reusing
    // the storage-pointer alias machinery + array push). The captured index stays valid across later pushes.
    if (ctx.DotPush() && expression instanceof IdentifierNode) {
      const arrName = expression.name;
      const loc = Location.fromCtx(ctx);
      const stamp = <T extends { location?: Location }>(n: T): T => { n.location = loc; return n; };
      const ident = (nm: string): IdentifierNode => stamp(new IdentifierNode(nm));
      if (!modifiers.includes(Modifier.STORAGE)) {
        // A value declaration copies the freshly-created default element rather than aliasing it. The local's
        // ordinary uninitialized value is exactly that default, so use the same value for the append and retain
        // the declared name (`uint y = arr.push();` -> `uint y; arr.push(y);`).
        const valueDef = this.finishVariableDefinition(ctx, type, modifiers, name, undefined);
        const valuePush = this.buildArrayPush(arrName, false, [], undefined, ident(name), false, ctx);
        return stamp(new BlockNode([valueDef, valuePush]));
      }
      const uid = this.nestedLvalueCounter++;
      const idxName = `__pushPtr_i_${uid}`;
      const defName = `__pushPtr_def_${uid}`;
      // uint __idx = arr.length;  (pre-push length = the appended element's index)
      const idxDef = stamp(new VariableDefinitionNode(
        this.solidityImportCompat ? new IntType(false, 256) : PrimitiveType.BIGINT,
        [], idxName, stamp(new UnaryOpNode(UnaryOperator.SIZE, ident(arrName)))));
      idxDef.allowUnused = true;
      // alias x -> arr[__idx]  (same shape as `T storage x = arr[k]`; not a real local, so not tracked as one)
      const access = stamp(new ArrayAccessNode(ident(arrName), ident(idxName)));
      this.storageAliases.set(name, { container: arrName, keys: [ident(idxName)], access });
      // `uint[] storage p = c.push();` (2D): an array-typed element has no scalar __def local encoding -
      // append the inner default via the no-arg push path instead.
      if (type instanceof ArrayType) {
        const push = this.buildArrayPush(arrName, false, [], undefined, this.noArgPushPlaceholder(ctx), true, ctx);
        return stamp(new BlockNode([idxDef, push]));
      }
      // T __def;  (uninitialized -> the element type's zero value, pushed as the new element)
      const defDef = stamp(new VariableDefinitionNode(type, [], defName, undefined));
      defDef.allowUnused = true;
      const push = this.buildArrayPush(arrName, false, [], undefined, ident(defName), false, ctx);
      return stamp(new BlockNode([idxDef, defDef, push]));
    }

    // Storage pointer: `T storage x = container[k];` aliases `x` to the access path. Record the alias and
    // drop the declaration (no runtime value); reads/writes of `x` are rewritten to `container[k]`.
    if (modifiers.includes(Modifier.STORAGE) && expression) {
      const path = this.extractStorageAccessPath(expression as ExpressionNode);
      if (path) {
        this.storageAliases.set(name, { ...path, access: expression as ExpressionNode });
        const dropped = new BlockNode([]);
        dropped.location = Location.fromCtx(ctx);
        return dropped;
      }
      // `mapping(...) storage p = m;`: a whole-mapping alias to a bare state-mapping identifier (no keys).
      // `p[k]...` rewrites to `m[k]...` (empty alias keys), and passing `p` substitutes `m` - mirrors the
      // storage-pointer parameter, without a call. The declaration carries no runtime value, so drop it.
      if (type instanceof MappingType && expression instanceof IdentifierNode) {
        this.storageAliases.set(name, { container: expression.name, keys: [], access: expression });
        const dropped = new BlockNode([]);
        dropped.location = Location.fromCtx(ctx);
        return dropped;
      }
      // Whole dynamic-array / bytes storage aliases (`T[] storage p = a`, `bytes storage p = b`) carry only
      // the compile-time container identity. Drop the phantom local and route later push/pop/index operations
      // through the original state container, like whole mapping aliases above.
      if ((type instanceof ArrayType || (type instanceof BytesType && type.bound === undefined))
        && expression instanceof IdentifierNode
        && (this.stateVarNames.has(expression.name) || this.bytesStateVarNames.has(expression.name))) {
        this.storageAliases.set(name, { container: expression.name, keys: [], access: expression });
        // Keep the declaration: unlike mappings, array/bytes storage pointers may be observed in assembly via
        // `.slot`/`.offset`. The alias metadata is used only to route parsed high-level operations such as the
        // tuple `.push()` target; later lowering retains the pointer view where required.
      }
      // `S storage sLocal = s;` where s is a struct STATE var (flattened or not): a whole-var alias. Reads and
      // writes of `sLocal`/`sLocal.f` substitute `s` and route through s's own state paths (flattened leaves,
      // or a non-flattened partial-struct rebuild) - NOT a local copy, which would silently drop writes to s.
      if (type instanceof StructType && expression instanceof IdentifierNode
        && (this.mappingStructStateVars.has(expression.name) || this.stateVarNames.has(expression.name))) {
        this.storageAliases.set(name, { container: expression.name, keys: [], access: expression });
        const dropped = new BlockNode([]);
        dropped.location = Location.fromCtx(ctx);
        return dropped;
      }
    }

    const variable = this.finishVariableDefinition(ctx, type, modifiers, name, expression as ExpressionNode | undefined);
    variable.functionPointerMethodAlias = functionPointerMethodAlias;
    return variable;
  }

  private validateStorageReferenceBinding(name: string, targetType: Type, source: ExpressionNode): void {
    if (source instanceof StringLiteralNode) {
      throw new InvalidDataLocationError(source,
        `cannot bind storage pointer '${name}' from a literal value`);
    }
    if (!(source instanceof IdentifierNode)) return;
    const sourceType = this.storageReferenceTypes.get(source.name)
      ?? this.stateArrayVarTypes.get(source.name)
      ?? this.stateCollectionArrayTypes.get(source.name)
      ?? this.mappingStateVarTypes.get(source.name)
      ?? this.stateStructVars.get(source.name)
      ?? this.mappingStructStateVars.get(source.name);
    if (!sourceType && (this.localArrayVarTypes.has(source.name)
      || this.localStructTypes.has(source.name) || this.localBytesVars.has(source.name))) {
      throw new InvalidDataLocationError(source,
        `cannot bind storage pointer '${name}' from memory reference '${source.name}'`);
    }
    if (sourceType && sourceType.toString() !== targetType.toString()) {
      throw new InvalidDataLocationError(source,
        `storage pointer '${name}' of type '${targetType}' cannot bind '${source.name}' of type '${sourceType}'`);
    }
  }

  // Local-type tracking + node construction shared by every variableDefinition path (plain, chain-init,
  // ternary-assign-init).
  private finishVariableDefinition(
    ctx: VariableDefinitionContext, type: Type, modifiers: string[], name: string,
    expression: ExpressionNode | undefined,
  ): VariableDefinitionNode {
    this.expiredLoopVariableNames.delete(name);
    // Track local struct-typed vars so `s.field = v` can desugar to a struct rebuild (visitAssignmentStatement).
    if (type instanceof StructType) this.localStructTypes.set(name, type);
    // Track local struct-array vars (`S[] memory m`) so `m[i].c[j] = v` can desugar (see buildLvalueAssign).
    if (type instanceof ArrayType && type.elementType instanceof StructType) {
      this.localStructArrayTypes.set(name, type.elementType);
    }
    if (type instanceof ArrayType) this.localArrayVarTypes.set(name, type);
    // Track local unbounded bytes vars so `d[i] = v` can desugar to a slice+concat rebuild (see buildLvalueAssign).
    if (type instanceof BytesType && type.bound === undefined) this.localBytesVars.add(name);
    // Track the using-for type key of a non-struct local so `x.method(args)` under `using L for T` resolves.
    this.recordUsingForReceiver(name, type);

    const variableDefinition = new VariableDefinitionNode(type, modifiers, name, expression);
    variableDefinition.location = Location.fromCtx(ctx);
    return variableDefinition;
  }

  // A struct state var is flattened field-by-field when it has no single-value representation: a mapping field,
  // or a dynamic chunk-packed array field (both back their own state element; see buildFlattenedStructField).
  // Recursive: a struct-typed field whose own type lacks a single-value representation forces flattening too
  // (its leaves nest as `outer__inner__leaf`). Cycle-safe (struct-field cycles are invalid Solidity anyway).
  private structNeedsFieldFlattening(t: StructType, seen: Set<StructType> = new Set()): boolean {
    if (seen.has(t)) return false;
    seen.add(t);
    return t.fields.some((f) => f.type instanceof MappingType
      || (this.chunkedArrays && f.type instanceof ArrayType && f.type.bound === undefined
        && isChunkPackableElementType(f.type.elementType))
      || (f.type instanceof StructType && this.structNeedsFieldFlattening(f.type, seen)));
  }

  // Build the flattened state node for one field of a flattened struct: mapping -> collection, a dynamic
  // chunk-packable array -> dynamic state var, other array -> collection, value type -> state var.
  private buildFlattenedStructField(
    fieldType: Type, flatName: string, location: Location | undefined,
  ): StateVariableNode | CollectionNode {
    let node: StateVariableNode | CollectionNode;
    if (fieldType instanceof MappingType) {
      node = new CollectionNode(fieldType, flatName);
    } else if (fieldType instanceof ArrayType) {
      if (this.chunkedArrays && fieldType.bound === undefined && isChunkPackableElementType(fieldType.elementType)) {
        const sv = new StateVariableNode(fieldType, flatName);
        sv.isDynamic = true;
        node = sv;
      } else {
        node = new CollectionNode(fieldType, flatName);
      }
    } else {
      node = new StateVariableNode(fieldType, flatName);
    }
    if (location) node.location = location;
    return node;
  }

  // Extract { container, keys } from a storage-location expression: `this.m[k]` (MappingAccess) or a bare
  // `m[k]` / `m[a][b]` (nested ArrayAccess on an identifier base). Returns undefined for anything else.
  private extractStorageAccessPath(
    expr: ExpressionNode,
  ): { container: string; keys: ExpressionNode[] } | undefined {
    if (expr instanceof MappingAccessNode) {
      return { container: expr.name, keys: [...expr.keys] };
    }
    if (expr instanceof ArrayAccessNode || expr instanceof TupleIndexOpNode) {
      // `m[numLit]` parses as a tuple index (grammar) but a bare-identifier base is a container access;
      // unwrap a mixed ArrayAccess/TupleIndex chain down to the base identifier.
      const keys: ExpressionNode[] = [];
      let cur: ExpressionNode = expr;
      while (cur instanceof ArrayAccessNode || cur instanceof TupleIndexOpNode) {
        if (cur instanceof ArrayAccessNode) {
          keys.unshift(cur.index);
          cur = cur.array;
        } else {
          const idx = new IntLiteralNode(BigInt(cur.index));
          idx.location = cur.location;
          keys.unshift(idx);
          cur = cur.tuple;
        }
      }
      if (cur instanceof IdentifierNode) return { container: cur.name, keys };
    }
    return undefined;
  }

  // A tuple expression `(a, b, ...)` is only meaningful as a ternary branch in a tuple assignment or return;
  // anywhere else it is a misuse (e.g. `int x = (1, 2)`), reported here.
  visitTupleExpression(ctx: TupleExpressionContext): Node {
    throw new ParseError(
      'A tuple expression is only valid as a ternary branch in a tuple assignment or return, '
      + 'e.g. `(a, b) = cond ? (x, y) : (p, q);`',
      Location.fromCtx(ctx),
    );
  }

  // Return the tuple-valued ternary under any redundant parenthesis wrappers. Solidity permits
  // `((effect() ? (a, b) : (c, d)));`; treating only a directly exposed TernaryOpContext made its tuple
  // branches fall through to the generic "tuple expression is invalid here" diagnostic.
  private tupleTernary(ctx: ExpressionContext | undefined): TernaryOpContext | undefined {
    let current = ctx;
    while (current instanceof ParenthesisedContext) current = current.expression();
    return current instanceof TernaryOpContext
      && current._ifTrue instanceof TupleExpressionContext
      && current._ifFalse instanceof TupleExpressionContext
      ? current
      : undefined;
  }

  // Desugar `cond ? (A0, A1, ..) : (B0, B1, ..)`: hoist `cond` into a bool temp (evaluated exactly once, per
  // Solidity ternary semantics) and produce a per-element ternary `__t ? Ai : Bi`. The existing scalar-ternary
  // type-check then validates each component's common type, matching Solidity's conditional rule.
  private desugarTupleTernary(ctx: TernaryOpContext): { tempDecl: VariableDefinitionNode; values: ExpressionNode[] } {
    const trueElems = (ctx._ifTrue as TupleExpressionContext).expression_list();
    const falseElems = (ctx._ifFalse as TupleExpressionContext).expression_list();
    if (trueElems.length !== falseElems.length) {
      throw new ParseError(
        `Tuple ternary branches have different arities (${trueElems.length} vs ${falseElems.length})`,
        Location.fromCtx(ctx),
      );
    }
    const name = `__tcond_${this.tupleTernaryCounter++}`;
    const tempDecl = new VariableDefinitionNode(
      PrimitiveType.BOOL, [], name, this.visit(ctx._condition) as ExpressionNode,
    );
    tempDecl.location = Location.fromCtx(ctx);
    const values = trueElems.map((te, i) => {
      const condRef = new IdentifierNode(name);
      condRef.location = Location.fromCtx(ctx);
      const ternary = new TernaryOpNode(
        condRef, this.visit(te) as ExpressionNode, this.visit(falseElems[i]) as ExpressionNode,
      );
      ternary.location = Location.fromCtx(ctx);
      return ternary;
    });
    return { tempDecl, values };
  }

  // A tuple slot carrying an index/member lvalue chain (`x[0]`, `s.e`, `s.a[0]`) - not a bare name, a
  // declaration, or an empty slot.
  private isComplexTupleSlot(slot: TupleSlotContext): boolean {
    if (slot.typeName() || slot.arrayType()) return false;
    // `tx` is also the prefix of introspection tokens in the grammar. In a user-declared storage alias such as
    // `(tx.executed,) = addr.call(...)`, generated-parser accessors may expose only one anyIdentifier even though
    // the slot text still carries a member chain. The punctuation is unambiguous after declaration slots were
    // excluded above, so retain it as the fallback signal for an existing complex lvalue.
    return slot.anyIdentifier_list().length > 1 || slot.expression_list().length > 0
      || slot.getText().includes('.') || slot.getText().includes('[');
  }

  private isEmptyTupleSlot(slot: TupleSlotContext): boolean {
    return !slot.typeName() && !slot.arrayType() && slot.anyIdentifier_list().length === 0;
  }

  // Reconstruct the lvalue segments (`.member` / `[key]`) of a complex tuple slot from its ordered children,
  // so `s.a[0]` and `s[0].a` are distinguished (a bare identifier list would lose the order).
  private buildTupleSlotSegs(slot: TupleSlotContext): LvSeg[] {
    const segs: LvSeg[] = [];
    let seenBase = false;
    for (const child of slot.children ?? []) {
      if (child instanceof AnyIdentifierContext) {
        if (!seenBase) { seenBase = true; continue; } // the base identifier
        segs.push({ member: child.getText() });
      } else if (child instanceof ExpressionContext) {
        const keyCtx = child;
        segs.push({ key: () => this.visit(keyCtx) as ExpressionNode });
      }
      // separators ('[', ']', '.') are TerminalNodes - ignored
    }
    return segs;
  }

  // Desugar `(lv0, .., lvN) = (e0, .., eN)` where some target is an index/member lvalue. Solidity evaluates the
  // whole RHS before assigning; direct sequential assignment matches that iff no RHS reads a target's base
  // variable (a later read could otherwise see a value an earlier write clobbered). When that alias-safety
  // does not hold - or the RHS is a single tuple-valued expression, or a declaration is mixed in - return null
  // and let the caller fall through (the general path rejects the unsupported shape as before).
  private desugarComplexTupleAssignment(ctx: TupleAssignmentContext, slots: TupleSlotContext[]): Node | null {
    const exprs = ctx.expression_list();
    if (exprs.length !== slots.length) return null; // only the per-slot RHS form
    const loc = Location.fromCtx(ctx);
    const bases: string[] = [];
    for (const s of slots) {
      if (this.isEmptyTupleSlot(s)) continue;
      if (s.typeName() || s.arrayType()) return null; // a declaration cannot mix with existing-lvalue targets
      bases.push(s.anyIdentifier(0)!.getText());
    }
    const aliasSafe = exprs.every((e) => {
      const text = e.getText();
      return bases.every((b) => !new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text));
    });
    if (!aliasSafe) return null;
    const stmts: StatementNode[] = [];
    slots.forEach((slot, i) => {
      const eCtx = exprs[i];
      if (this.isEmptyTupleSlot(slot)) {
        // Skipped slot: evaluate the RHS for its side effects, drop the value.
        const es = new ExpressionStatementNode(this.visit(eCtx) as ExpressionNode);
        es.location = loc;
        stmts.push(es);
        return;
      }
      const base = slot.anyIdentifier(0)!;
      if (/^[A-Za-z_$][A-Za-z0-9_$]*\.push\(\)$/.test(slot.getText())) {
        const alias = this.storageAliases.get(base.getText());
        const target = alias?.keys.length === 0 ? alias.container : base.getText();
        stmts.push(this.buildTuplePushTarget(target, eCtx, slot));
        return;
      }
      const segs = this.buildTupleSlotSegs(slot);
      stmts.push(this.buildLvalueAssign(base.getText(), false, Location.fromCtx(base), segs, '=', eCtx, loc));
    });
    const block = new BlockNode(stmts);
    block.location = loc;
    return block;
  }

  // `(m[k].f, , x) = <single tuple-valued RHS>` (e.g. a multi-return call, incl. a low-level `addr.call(..)`):
  // destructure the RHS into typed temps (preserving skip slots), then per-slot complex-lvalue writes. Sibling of
  // desugarComplexTupleAssignment, which only handles the per-slot `(a,b)=(e1,e2)` form. MultiSigWallet's
  // `(transaction.executed,) = transaction.destination.call{value:..}(transaction.data)`. Bails (null) if any
  // captured slot is a bare simple lvalue (left to other paths) or its type is not parse-time resolvable.
  private desugarComplexTupleSingleRhs(ctx: TupleAssignmentContext, slots: TupleSlotContext[]): Node | null {
    const exprs = ctx.expression_list();
    if (exprs.length !== 1) return null; // only a single tuple-valued RHS
    for (const s of slots) {
      if (this.isEmptyTupleSlot(s)) continue;
      if (s.typeName() || s.arrayType()) return null; // a declaration slot - not this path
      if (!this.isComplexTupleSlot(s)) return null; // a bare simple existing lvalue - leave to other paths
    }
    const lowLevelCallTuple = /\.call(?:\{|\()/.test(exprs[0].getText());
    const slotTypes = slots.map((s, i) => {
      if (this.isEmptyTupleSlot(s)) return undefined;
      const resolved = this.resolveTupleSlotType(s);
      // Imported-base storage aliases can be syntactically known before inheritance resolution supplies their
      // struct definition. A low-level call's ABI tuple is nevertheless fixed as `(bool, bytes)`, so its complex
      // lvalue targets can be safely typed and desugared without guessing the eventual inherited struct layout.
      if (!resolved && lowLevelCallTuple) {
        if (i === 0) return PrimitiveType.BOOL;
        if (i === 1) return new BytesType();
      }
      return resolved;
    });
    if (slots.some((s, i) => !this.isEmptyTupleSlot(s) && !slotTypes[i])) return null;

    const loc = Location.fromCtx(ctx);
    const tmpNames = slots.map(() => `__ctup_${this.nestedLvalueCounter++}`);
    const declElements = slots.map((s, i) => (this.isEmptyTupleSlot(s)
      ? { skip: true } : { name: tmpNames[i], type: slotTypes[i]! }));
    const decl = new TupleAssignmentNode(declElements, this.visit(exprs[0]) as ExpressionNode, true);
    decl.location = loc;
    const stmts: StatementNode[] = [decl];
    slots.forEach((slot, i) => {
      if (this.isEmptyTupleSlot(slot)) return;
      const base = slot.anyIdentifier(0)!;
      let rawName = base.getText();
      let segs = this.buildTupleSlotSegs(slot);
      // Expand an indexed storage-pointer base (`T storage t = coll[k]; t.f`): buildLvalueAssign only substitutes
      // whole-var (keys-0) aliases, so route through the container + prepend the alias index (`coll[k].f`).
      const alias = this.storageAliases.get(rawName);
      if (alias && alias.keys.length > 0) {
        rawName = alias.container;
        segs = [...alias.keys.map((k) => ({ key: () => cloneNode(k) as ExpressionNode })), ...segs];
      }
      const value = new IdentifierNode(tmpNames[i]);
      value.location = loc;
      stmts.push(this.buildLvalueAssign(rawName, false, Location.fromCtx(base), segs, '=', undefined, loc, value));
    });
    const block = new BlockNode(stmts);
    block.location = loc;
    return block;
  }

  // The declared TYPE of a complex tuple slot's lvalue (`m[k].field`, `s.a.b`, `arr[i].field`), for typing the
  // synthesized destructure temp. Handles a mapping/array/struct base (including a storage-pointer alias to one)
  // + a member chain; returns undefined for anything not resolvable at parse time (caller falls through).
  private resolveTupleSlotType(slot: TupleSlotContext): Type | undefined {
    const base = slot.anyIdentifier(0)?.getText();
    if (!base) return undefined;
    const segs = this.buildTupleSlotSegs(slot);
    let structT: StructType | undefined;
    let memberStart = 0;
    const alias = this.storageAliases.get(base);
    if (alias) {
      // `T storage p = coll[k]; p.field` - the alias already includes the index, so segs are all members.
      structT = this.mappingStructValueVars.get(alias.container) ?? this.stateMappingValueStruct.get(alias.container)
        ?? this.packedStructArrayElems.get(alias.container) ?? this.localStructArrayTypes.get(alias.container)
        ?? this.stateStructVars.get(alias.container) ?? this.localStructTypes.get(alias.container);
    } else if (segs[0]?.key !== undefined) {
      // `coll[k].field` - a leading index into a mapping/array; step to the element/value struct.
      structT = this.mappingStructValueVars.get(base) ?? this.packedStructArrayElems.get(base)
        ?? this.localStructArrayTypes.get(base) ?? this.stateMappingValueStruct.get(base);
      memberStart = 1;
    } else {
      structT = this.stateStructVars.get(base) ?? this.localStructTypes.get(base); // `s.field`
    }
    if (!structT) return undefined;
    let cur: Type = structT;
    for (let i = memberStart; i < segs.length; i += 1) {
      const m = segs[i].member;
      if (m === undefined || !(cur instanceof StructType)) return undefined; // nested index / non-struct step
      const fields: { name: string; type: Type }[] = cur.fields;
      const field = fields.find((f) => f.name === m);
      if (!field) return undefined;
      cur = field.type;
    }
    // A plain scalar only: a struct/array/mapping tuple target keeps its own storage-pointer rebind semantics.
    if (cur instanceof StructType || cur instanceof ArrayType || cur instanceof MappingType) return undefined;
    return cur;
  }

  visitTupleAssignment(ctx: TupleAssignmentContext): Node {
    // Parenthesised single declaration `(uint a) = expr;` (solc one-element tuple decl): behaves exactly like
    // `uint a = expr;`. Detected by a direct anyIdentifier child (only the two single-decl alts have one).
    if (ctx.getText().startsWith('(') && ctx.tupleSlot_list().length === 0 && ctx.anyIdentifier()) {
      const at = ctx.arrayType();
      const type = at
        ? this.buildArrayType(at)
        : (this.resolveType(ctx.typeName(0)!.getText()) ?? new AddressType(false, ctx.typeName(0)!.getText()));
      const name = ctx.anyIdentifier()!.getText();
      const modifiers = ctx.modifier_list().map((m) => m.getText());
      if (type instanceof StructType) this.localStructTypes.set(name, type);
      if (type instanceof ArrayType && type.elementType instanceof StructType) {
        this.localStructArrayTypes.set(name, type.elementType);
      }
      if (type instanceof BytesType && type.bound === undefined) this.localBytesVars.add(name);
      this.recordUsingForReceiver(name, type);
      const def = new VariableDefinitionNode(type, modifiers, name, this.visit(ctx.expression(0)!) as ExpressionNode);
      def.location = Location.fromCtx(ctx);
      return def;
    }
    const slots = ctx.tupleSlot_list();
    const tupleExprs = ctx.expression_list();
    // A whole mapping/struct storage pointer has no runtime tuple value. Rebind any such existing targets at
    // parse time and emit the remaining value assignments. Snapshot aliases first: Solidity evaluates every
    // RHS before assignment, so `(aPtr, bPtr) = (bPtr, aPtr)` must actually swap the references.
    if (slots.length > 0 && tupleExprs.length === slots.length) {
      const rebound = new Set<number>();
      const aliasesBefore = new Map(this.storageAliases);
      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i];
        if (this.isComplexTupleSlot(slot) || slot.typeName() || slot.arrayType()) continue;
        const target = slot.anyIdentifier(0)?.getText();
        const rhsName = tupleExprs[i].getText();
        const alias = target ? aliasesBefore.get(target) : undefined;
        if (!target || alias?.keys.length !== 0 || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(rhsName)) continue;
        const rhsAlias = aliasesBefore.get(rhsName);
        const targetIsMapping = this.mappingStateVarTypes.has(alias.container);
        const targetIsStruct = this.stateStructVars.has(alias.container);
        const rhsIsMatchingState = (targetIsMapping && this.mappingStateVarTypes.has(rhsName))
          || (targetIsStruct && this.stateStructVars.has(rhsName));
        const rhsAliasMatches = rhsAlias?.keys.length === 0
          && ((targetIsMapping && this.mappingStateVarTypes.has(rhsAlias.container))
            || (targetIsStruct && this.stateStructVars.has(rhsAlias.container)));
        if (!rhsIsMatchingState && !rhsAliasMatches) continue;
        if (rhsAliasMatches) {
          this.storageAliases.set(target, {
            container: rhsAlias.container,
            keys: [],
            access: cloneNode(rhsAlias.access) as ExpressionNode,
          });
        } else {
          const rhs = new IdentifierNode(rhsName);
          rhs.location = Location.fromCtx(tupleExprs[i]);
          this.storageAliases.set(target, { container: rhsName, keys: [], access: rhs });
        }
        rebound.add(i);
      }
      if (rebound.size > 0) {
        const remaining = slots.map((_slot, i) => i).filter((i) => !rebound.has(i));
        const loc = Location.fromCtx(ctx);
        if (remaining.length === 0) {
          const dropped = new BlockNode([]);
          dropped.location = loc;
          return dropped;
        }
        if (remaining.length === 1) {
          const i = remaining[0];
          const slot = slots[i];
          const id = slot.anyIdentifier(0);
          if (id && !slot.typeName() && !slot.arrayType() && !this.isComplexTupleSlot(slot)) {
            return this.buildLvalueAssign(
              id.getText(), false, Location.fromCtx(id), [], '=', tupleExprs[i], loc,
            );
          }
        }
        const keptElements = remaining.map((i) => {
          const slot = slots[i];
          const tn = slot.typeName();
          const at = slot.arrayType();
          if (tn || at) {
            return {
              name: slot.anyIdentifier(0)!.getText(),
              type: at ? this.buildArrayType(at)
                : (this.resolveType(tn!.getText()) ?? new AddressType(false, tn!.getText())),
            };
          }
          const id = slot.anyIdentifier(0);
          return id ? { name: id.getText(), existing: true } : { skip: true };
        });
        const kept = new TupleAssignmentNode(
          keptElements,
          undefined as unknown as ExpressionNode,
          true,
          remaining.map((i) => this.visit(tupleExprs[i]) as ExpressionNode),
        );
        kept.location = loc;
        return kept;
      }
    }
    // Complex-lvalue targets `(x[0], s.e) = (a, b)` (an index/member chain in a slot): desugar to per-slot
    // writes. Only the per-slot parenthesised RHS form, and only when alias-safe, is handled here.
    if (slots.length > 0 && slots.some((s) => this.isComplexTupleSlot(s))) {
      const desugared = this.desugarComplexTupleAssignment(ctx, slots);
      if (desugared) return desugared;
      const single = this.desugarComplexTupleSingleRhs(ctx, slots);
      if (single) return single;
    }
    let elements: { name?: string, type?: Type, skip?: boolean, existing?: boolean }[];
    if (slots.length > 0) {
      // Parenthesised form: a declaration `type name`, a bare `name` (existing lvalue), or an empty slot.
      elements = slots.map((slot) => {
        const tn = slot.typeName();
        const at = slot.arrayType();
        // Unknown (contract/interface) type name -> keep it on the address handle, so a tuple-destructured
        // interface var (`(IERC20 a, ..) = ..`) routes `a.method(..)` to an external call (as locals/params do).
        if (tn || at) {
          return {
            name: slot.anyIdentifier(0)!.getText(),
            type: at ? this.buildArrayType(at) : (this.resolveType(tn!.getText()) ?? new AddressType(false, tn!.getText())),
          };
        }
        const id = slot.anyIdentifier(0);
        if (id) return { name: id.getText(), existing: true };
        return { skip: true };
      });
    } else {
      // Unparenthesised declaration form: type a, type b = expr;
      const names = ctx.Identifier_list();
      const types = ctx.typeName_list();
      elements = names.map((name, i) => ({
        name: name.getText(),
        type: this.resolveType(types[i].getText()) ?? new AddressType(false, types[i].getText()),
      }));
    }
    // A skipped outer slot may correspond to a nested tuple value: `(a,) = (4, (8,16,32))`. The VM tuple
    // representation is flat, so expand that one skip to one skip per nested leaf. This preserves left-to-right
    // evaluation (including side effects in discarded leaves) and lets codegen drop the correct number of values.
    // Non-skipped nested values still require a shape-matching nested LHS and are handled by nestedTupleAssignment.
    let effectiveExprs = tupleExprs;
    if (slots.length > 0 && tupleExprs.length === elements.length) {
      const flattenDiscarded = (e: ExpressionContext): ExpressionContext[] => {
        let current = e;
        while (current instanceof ParenthesisedContext) current = current.expression();
        if (!(current instanceof TupleExpressionContext)) return [e];
        return current.expression_list().flatMap((part) => flattenDiscarded(part));
      };
      const expandedElements: typeof elements = [];
      const expandedExprs: ExpressionContext[] = [];
      elements.forEach((element, i) => {
        const leaves = element.skip ? flattenDiscarded(tupleExprs[i]) : [tupleExprs[i]];
        leaves.forEach((leaf) => {
          expandedElements.push(element.skip ? { skip: true } : element);
          expandedExprs.push(leaf);
        });
      });
      elements = expandedElements;
      effectiveExprs = expandedExprs;
    }
    const parenthesised = ctx.getText().startsWith('(');
    // `(a, b) = (e1, e2)` parses N RHS expressions; the other forms parse one tuple-valued expression.
    let exprs = effectiveExprs;
    // Redundant wrappers can make an explicit tuple RHS arrive as one expression:
    // `(,, a) = (((1, 3, ((2)))))`. Peel only parentheses, then expose the tuple's own components so the
    // ordinary parallel tuple-assignment path applies. Calls returning tuples remain a single expression.
    if (exprs.length === 1) {
      let explicitTuple = exprs[0];
      while (explicitTuple instanceof ParenthesisedContext) explicitTuple = explicitTuple.expression();
      if (explicitTuple instanceof TupleExpressionContext) exprs = explicitTuple.expression_list();
    }
    // Tuple ternary RHS `(a, b) = cond ? (..) : (..)`: hoist cond, then an N-value assignment of per-element
    // ternaries. Returned as a block so flattenStatements splices the temp + assignment at the same scope.
    const tupleTernary = exprs.length === 1 ? this.tupleTernary(exprs[0]) : undefined;
    if (tupleTernary) {
      const { tempDecl, values } = this.desugarTupleTernary(tupleTernary);
      const tupleAssign = new TupleAssignmentNode(
        elements, undefined as unknown as ExpressionNode, parenthesised, values,
      );
      tupleAssign.location = Location.fromCtx(ctx);
      const block = new BlockNode([tempDecl, tupleAssign]);
      block.location = Location.fromCtx(ctx);
      return block;
    }
    // `(x, y) = (a, b)` where every target is a state variable: the tuple codegen assigns into stack slots,
    // which state vars do not have. Desugar to sequential state assigns - clobber-safe because a state read
    // always reads the input commitment, so a swap `(x, y) = (y, x)` still exchanges correctly.
    if (exprs.length > 1
      && elements.every((e) => e.existing && e.name !== undefined && this.stateVarNames.has(e.name))) {
      const stmts: StatementNode[] = elements.map((e, i) => {
        const sa = new StateAssignNode(e.name!, this.visit(exprs[i]) as ExpressionNode);
        sa.location = Location.fromCtx(ctx);
        return sa;
      });
      const block = new BlockNode(stmts);
      block.location = Location.fromCtx(ctx);
      return block;
    }
    // `(x, y) = f()` where f returns a tuple: capture the complete RHS before writing state, just as the
    // per-component form above does. Leaving this on TupleAssignmentNode makes codegen look for stack-local
    // slots named x/y, so constructor probes can appear green only under a sparse trace and fail on the full VM.
    if (exprs.length === 1
      && elements.every((e) => e.existing && e.name !== undefined && this.stateVarNames.has(e.name))) {
      const types = elements.map((e) => this.stateVarTypes.get(e.name!));
      if (types.every((type): type is Type => type !== undefined)) {
        const loc = Location.fromCtx(ctx);
        const tempNames = elements.map(() => `__state_tuple_${this.nestedLvalueCounter++}`);
        const capture = new TupleAssignmentNode(
          tempNames.map((name, i) => ({ name, type: types[i] })),
          this.visit(exprs[0]) as ExpressionNode,
          true,
        );
        capture.location = loc;
        const writes = elements.map((element, i) => {
          const value = new IdentifierNode(tempNames[i]);
          value.location = loc;
          const assign = new StateAssignNode(element.name!, value);
          assign.location = loc;
          return assign;
        });
        const block = new BlockNode([capture, ...writes]);
        block.location = loc;
        return block;
      }
    }
    const tupleAssignment = exprs.length > 1
      ? new TupleAssignmentNode(elements, undefined as unknown as ExpressionNode, parenthesised,
        exprs.map((e) => this.visit(e) as ExpressionNode))
      : new TupleAssignmentNode(elements, this.visit(exprs[0]) as ExpressionNode, parenthesised);
    tupleAssignment.location = Location.fromCtx(ctx);
    return tupleAssignment;
  }

  visitNestedTupleAssignment(ctx: any): Node {
    type Pattern = { name: string; push?: boolean } | Pattern[] | undefined;
    const parsePattern = (patternCtx: any): Pattern[] => {
      const slots: Pattern[] = [undefined];
      let index = 0;
      for (const child of patternCtx.children ?? []) {
        const text = child.getText?.();
        if (text === '(' || text === ')') continue;
        if (text === ',') { index += 1; slots[index] = undefined; continue; }
        if (child.constructor?.name === 'NestedTuplePatternItemContext') {
          const nested = child.nestedTuplePattern?.();
          if (nested) slots[index] = parsePattern(nested);
          else {
            const name = child.anyIdentifier?.(0)?.getText();
            if (!name) throw new ParseError('Unsupported nested tuple assignment target', Location.fromCtx(child));
            slots[index] = { name, push: /\.push\(\)$/.test(child.getText()) };
          }
        }
      }
      return slots;
    };
    const rhsParts = (expr: ExpressionContext): ExpressionContext[] | undefined => {
      let current = expr;
      while (current instanceof ParenthesisedContext) current = current.expression();
      return current instanceof TupleExpressionContext ? current.expression_list() : undefined;
    };
    const elements: { name?: string; existing?: boolean; skip?: boolean }[] = [];
    const values: ExpressionNode[] = [];
    const pushes: StatementNode[] = [];
    const walk = (pattern: Pattern, value: ExpressionContext): void => {
      if (pattern === undefined) return;
      if (!Array.isArray(pattern)) {
        if (pattern.push) {
          const alias = this.storageAliases.get(pattern.name);
          const target = alias?.keys.length === 0 ? alias.container : pattern.name;
          pushes.push(this.buildTuplePushTarget(target, value, value));
          return;
        }
        elements.push({ name: pattern.name, existing: true });
        values.push(this.visit(value) as ExpressionNode);
        return;
      }
      // A one-item parenthesized pattern is a redundant wrapper, not an ABI/value tuple layer.
      if (pattern.length === 1) {
        if (pattern[0] !== undefined) walk(pattern[0], value);
        return;
      }
      const parts = rhsParts(value);
      if (!parts || parts.length < pattern.length) {
        throw new ParseError('Nested tuple assignment shape does not match its value', Location.fromCtx(value));
      }
      pattern.forEach((slot, i) => {
        if (slot !== undefined) walk(slot, parts[i]);
      });
    };
    const pattern = parsePattern(ctx.nestedTuplePattern());
    walk(pattern, ctx.expression());
    const loc = Location.fromCtx(ctx);
    if (pushes.length > 0 && elements.length === 0) {
      const block = new BlockNode(pushes);
      block.location = loc;
      return block;
    }
    const node = new TupleAssignmentNode(elements, undefined as unknown as ExpressionNode, true, values);
    node.location = loc;
    if (pushes.length === 0) return node;
    const block = new BlockNode([node, ...pushes]);
    block.location = loc;
    return block;
  }

  // `(x op= rhs)` as an expression: build the desugared assignment, wrap it so codegen yields x's new value.
  visitAssignmentExpression(ctx: AssignmentExpressionContext): AssignmentExpressionNode {
    const assign = this.buildCompoundAssign(
      ctx.Identifier().getText(),
      Location.fromToken(ctx.Identifier().symbol),
      ctx._op.text,
      ctx.expression(),
      Location.fromCtx(ctx),
    );
    const node = new AssignmentExpressionNode(assign);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // Function-call arguments. Each is an expression, optionally an assignment `x = v` (Solidity's assignment-as-
  // argument, BentoBox `_calculateDomainSeparator(DOMAIN_SEPARATOR_CHAIN_ID = chainId)`) wrapped in an
  // AssignmentExpressionNode - DesugarAssignmentArguments later hoists it to `x = v;` before the call statement.
  private buildCallArguments(ctx: ExpressionListContext): ExpressionNode[] {
    return ctx.callArgument_list().map((a) => this.buildCallArgument(a));
  }

  private buildCallArgument(ctx: CallArgumentContext): ExpressionNode {
    if (ctx._pushBase) {
      const name = ctx._pushBase.text;
      const arrayType = this.stateArrayVarTypes.get(name);
      if (!arrayType) {
        throw new ParseError(`Cannot use .push() as a value on unknown state array '${name}'`, Location.fromCtx(ctx));
      }
      const loc = Location.fromCtx(ctx);
      const indexName = `__pusharg_${this.pushArgumentCounter++}`;
      const base = new IdentifierNode(name); base.location = loc;
      const size = new UnaryOpNode(UnaryOperator.SIZE, base); size.location = loc;
      const indexDecl = new VariableDefinitionNode(PrimitiveType.BIGINT, [], indexName, size);
      indexDecl.location = loc;
      const push = this.buildArrayPush(
        name, false, [], undefined, this.noArgPushPlaceholder(ctx), true, ctx,
      );
      const readBase = new IdentifierNode(name); readBase.location = loc;
      const index = new IdentifierNode(indexName); index.location = loc;
      const result = new ArrayAccessNode(readBase, index); result.location = loc;
      // The assignment slot is never visited: DesugarPostfixExpressions consumes prelude/result first.
      const inert = new AssignNode(new IdentifierNode(indexName), result);
      inert.location = loc;
      const bridge = new AssignmentExpressionNode(inert);
      bridge.prelude = [indexDecl, push];
      bridge.result = result;
      bridge.location = loc;
      return bridge;
    }
    let expr = this.visit(ctx.expression()) as ExpressionNode;
    if (!ctx._aop) {
      // A storage-pointer alias has no runtime local symbol. Member/index uses are rewritten by their visitors,
      // but a bare alias passed to an internal helper (`g(s)`) reaches us as an IdentifierNode. Substitute the
      // captured storage access here so call inlining sees the same concrete lvalue as `g(array[i])`.
      if (expr instanceof IdentifierNode && this.storageAliases.has(expr.name)) {
        expr = cloneNode(this.storageAliases.get(expr.name)!.access) as ExpressionNode;
      }
      return expr;
    }
    // Assignment-as-argument: a simple identifier, or a contract-qualified state variable (`C.x = value`) used
    // by Solidity base-constructor initializers. The qualifier is compile-time scope information; the flattened
    // covenant writes the inherited state slot by its bare name. A chained value remains unsupported here.
    const chain = ctx.assignChain()!;
    const qualifiedState = expr instanceof FieldAccessNode
      && expr.expression instanceof IdentifierNode
      ? expr.name
      : undefined;
    const targetName = expr instanceof IdentifierNode ? expr.name : qualifiedState;
    if (!targetName || chain._op) {
      throw new ParseError(
        'assignment-as-argument is only supported for an identifier or contract-qualified state variable',
        Location.fromCtx(ctx),
      );
    }
    const assign = this.buildCompoundAssign(
      targetName, expr.location!, ctx._aop.text, chain.expression(), Location.fromCtx(ctx),
    );
    const node = new AssignmentExpressionNode(assign);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // Builds an AssignNode from a `=`, `+=`, `-=`, `++` or `--` form, rewriting compound
  // and increment forms as: identifier (+|-) rhs
  private buildCompoundAssign(
    identifierText: string,
    identifierLocation: Location,
    op: string,
    expressionCtx: ExpressionContext | null,
    location: Location,
  ): AssignNode {
    if (this.solidityImportCompat && this.expiredLoopVariableNames.has(identifierText)) {
      throw new ParseError(`Undeclared identifier '${identifierText}'`, identifierLocation);
    }
    const identifier = new IdentifierNode(identifierText);
    identifier.location = identifierLocation;

    let rhs: ExpressionNode;
    if (op === '=') {
      rhs = this.visit(expressionCtx!) as ExpressionNode;
    } else {
      const left = new IdentifierNode(identifierText);
      left.location = identifierLocation;
      const binaryOperator = COMPOUND_OPS[op];
      const right = (op === '++' || op === '--')
        ? new IntLiteralNode(1n)
        : this.visit(expressionCtx!) as ExpressionNode;
      right.location = (op === '++' || op === '--') ? location : right.location;
      const binaryOp = new BinaryOpNode(left, binaryOperator, right);
      binaryOp.location = location;
      rhs = binaryOp;
    }

    const assign = new AssignNode(identifier, rhs);
    assign.location = location;
    return assign;
  }

  // RHS of a (possibly compound) state assignment: `=` uses the expression directly; `+=` etc. desugar to
  // `<read> <binop> <expression>`, where `read` is the read-expression node for the assignment target.
  private compoundRhs(
    read: ExpressionNode, op: string, expressionCtx: ExpressionContext | undefined, location: Location,
  ): ExpressionNode {
    // `++` / `--` have no RHS expression: desugar to `read +/- 1` (COMPOUND_OPS maps ++ -> PLUS, -- -> MINUS).
    let rhs: ExpressionNode;
    if (op === '++' || op === '--') {
      rhs = new IntLiteralNode(1n);
      rhs.location = location;
    } else {
      rhs = this.visit(expressionCtx!) as ExpressionNode;
      if (op === '=') return rhs;
    }
    const binaryOp = new BinaryOpNode(read, COMPOUND_OPS[op], rhs);
    binaryOp.location = location;
    return binaryOp;
  }

  visitTimeOpStatement(ctx: TimeOpStatementContext): TimeOpNode {
    const expression = this.visit(ctx.expression());
    const rm = ctx.requireMessage();
    const message = rm && rm.StringLiteral() ? this.createStringLiteral(rm).value : undefined;
    const timeOp = new TimeOpNode(ctx.TxVar().getText() as TimeOp, expression, message);
    timeOp.location = Location.fromCtx(ctx);

    return timeOp;
  }

  visitRequireStatement(ctx: RequireStatementContext): RequireNode {
    const expression = this.visit(ctx.expression());
    const rm = ctx.requireMessage();
    let message: string | undefined;
    let errorName: string | undefined;
    let args: ExpressionNode[] = [];
    if (rm && rm.StringLiteral()) {
      message = this.createStringLiteral(rm).value;
    } else if (rm && rm.Identifier() && rm.expressionList()) {
      // require(cond, CustomError(args)) - reverts with the custom error if cond is false
      errorName = rm.Identifier().getText();
      args = this.buildCallArguments(rm.expressionList()!);
    }
    // else: require(cond, <any other expression>) - a dynamic string message (a variable, member access, function
    // call, ternary, string.concat, ...). Solidity treats require as a plain function taking `string memory`; BCH
    // has no dynamic on-chain reason string, so the message is dropped and the require still reverts on false
    // (same as revert(expression)). The condition still fully covers correctness.
    const require = new RequireNode(expression, message, errorName, args);
    require.location = Location.fromCtx(ctx);
    return require;
  }

  visitIfStatement(ctx: IfStatementContext): BranchNode {
    const condition = this.visit(ctx.expression());
    const ifBlock = this.visit(ctx._ifBlock) as StatementNode;
    const elseBlock = ctx._elseBlock && this.visit(ctx._elseBlock) as StatementNode;
    const branch = new BranchNode(condition, ifBlock, elseBlock);
    branch.location = Location.fromCtx(ctx);
    return branch;
  }

  visitLoopStatement(ctx: LoopStatementContext): StatementNode {
    if (ctx.doWhileStatement()) {
      return this.visit(ctx.doWhileStatement()) as DoWhileNode;
    }
    if (ctx.whileStatement()) {
      return this.visit(ctx.whileStatement()) as WhileNode;
    }
    if (ctx.forOfEntriesStatement()) {
      return this.visit(ctx.forOfEntriesStatement()) as CollectionIterationNode;
    }
    if (ctx.forInStatement()) {
      return this.visit(ctx.forInStatement()) as CollectionIterationNode;
    }
    if (ctx.forOfStatement()) {
      return this.visit(ctx.forOfStatement()) as StatementNode;
    }
    return this.visit(ctx.forStatement()) as BlockNode;
  }

  visitForOfEntriesStatement(ctx: ForOfEntriesStatementContext): CollectionIterationNode {
    const keyType = this.resolveType(ctx.typeName(0).getText());
    const keyName = ctx.Identifier(0).getText();
    const valueType = this.resolveType(ctx.typeName(1).getText());
    const valueName = ctx.Identifier(1).getText();
    const collectionName = ctx.Identifier(2).getText();
    const body = this.visit(ctx.block()) as BlockNode;
    const node = new CollectionIterationNode(
      CollectionIterationMode.ENTRIES, collectionName,
      keyType, keyName, valueType, valueName, body,
    );
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitForInStatement(ctx: ForInStatementContext): CollectionIterationNode {
    const keyType = this.resolveType(ctx.typeName().getText());
    const keyName = ctx.Identifier(0).getText();
    const collectionName = ctx.Identifier(1).getText();
    const body = this.visit(ctx.block()) as BlockNode;
    const node = new CollectionIterationNode(
      CollectionIterationMode.KEYS, collectionName,
      keyType, keyName, undefined, undefined, body,
    );
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitForOfStatement(ctx: ForOfStatementContext): CollectionIterationNode | BlockNode {
    const valueType = this.resolveType(ctx.typeName().getText());
    const valueName = ctx.Identifier(0).getText();
    const collectionName = ctx.Identifier(1).getText();
    const body = this.visit(ctx.block()) as BlockNode;

    // Dense state arrays (packed inline or chunk-packed) are state variables, not collections. Desugar
    // `for (T x of this.a)` into an index loop over a once-cached local so the body reuses ordinary local
    // array indexing: { T[] tmp = this.a; int i = 0; while (i < tmp.length) { T x = tmp[i]; <body>; i++; } }
    if (this.packedStateArrayNames.has(collectionName)) {
      return this.desugarForOfArray(valueType, valueName, collectionName, body, Location.fromCtx(ctx));
    }

    const node = new CollectionIterationNode(
      CollectionIterationMode.VALUES, collectionName,
      undefined, undefined, valueType, valueName, body,
    );
    node.location = Location.fromCtx(ctx);
    return node;
  }

  private desugarForOfArray(
    valueType: Type,
    valueName: string,
    arrayName: string,
    body: BlockNode,
    loc: Location,
  ): BlockNode {
    const uid = this.forOfArrayCounter++;
    const tmpName = `__forOf_arr_${uid}`;
    const idxName = `__forOf_i_${uid}`;
    const ident = (name: string): IdentifierNode => { const n = new IdentifierNode(name); n.location = loc; return n; };
    const stamp = <T extends { location?: Location }>(n: T): T => { n.location = loc; return n; };

    // T[] tmp = this.a;  (one reassembly for chunk-packed; inline read for packed)
    const cacheDef = stamp(new VariableDefinitionNode(
      new ArrayType(valueType), [], tmpName, stamp(new StateAccessNode(arrayName)),
    ));
    // int i = 0;
    const idxDef = stamp(new VariableDefinitionNode(PrimitiveType.BIGINT, [], idxName, stamp(new IntLiteralNode(0n))));
    // T x = tmp[i];  (loop var may go unused, like a collection-iteration loop variable)
    const elemDef = stamp(new VariableDefinitionNode(
      valueType, [], valueName, stamp(new ArrayAccessNode(ident(tmpName), ident(idxName))),
    ));
    elemDef.allowUnused = true;
    // i = i + 1;
    const update = stamp(new AssignNode(
      ident(idxName), stamp(new BinaryOpNode(ident(idxName), BinaryOperator.PLUS, stamp(new IntLiteralNode(1n)))),
    ));
    // while (i < tmp.length) { x = tmp[i]; <body>; i++; }
    const loopBody = stamp(new BlockNode([elemDef, ...(body.statements ?? []), update]));
    const cond = stamp(new BinaryOpNode(
      ident(idxName), BinaryOperator.LT, stamp(new UnaryOpNode(UnaryOperator.SIZE, ident(tmpName))),
    ));
    const whileNode = stamp(new WhileNode(cond, loopBody));
    whileNode.forLoopUpdateCount = 1; // the trailing i++ still runs on `continue`

    return stamp(new BlockNode([cacheDef, idxDef, whileNode]));
  }

  // Build a tuple destructure (`(uint x, uint y) = (0, 1)` / `(x, y) = f()`) used in a for-loop init or update,
  // mirroring the parenthesised tupleAssignment slot handling.
  private buildForTupleAssign(
    slots: TupleSlotContext[], exprs: ExpressionContext[], loc: Location,
  ): TupleAssignmentNode {
    const elements = slots.map((slot) => {
      const tn = slot.typeName(); const at = slot.arrayType();
      if (tn || at) {
        return {
          name: slot.anyIdentifier(0)!.getText(),
          type: at ? this.buildArrayType(at) : (this.resolveType(tn!.getText()) ?? new AddressType(false, tn!.getText())),
        };
      }
      const id = slot.anyIdentifier(0);
      return id ? { name: id.getText(), existing: true } : { skip: true };
    });
    const node = exprs.length > 1
      ? new TupleAssignmentNode(elements, Object.assign(new IntLiteralNode(0n), { location: loc }),
        true, exprs.map((e) => this.visit(e) as ExpressionNode))
      : new TupleAssignmentNode(elements, this.visit(exprs[0]) as ExpressionNode, true);
    node.location = loc;
    return node;
  }

  visitForStatement(ctx: ForStatementContext): BlockNode {
    const initCtx = ctx.forInit() as ForInitContext;
    const condCtx = ctx.forCondition() as ForConditionContext;
    const updateCtx = ctx.forUpdate() as ForUpdateContext;
    const declaredLoopNames = new Set<string>();
    if (initCtx.typeName()) declaredLoopNames.add(initCtx.Identifier().getText());
    for (const slot of initCtx.tupleSlot_list()) {
      if ((slot.typeName() || slot.arrayType()) && slot.anyIdentifier(0)) {
        declaredLoopNames.add(slot.anyIdentifier(0)!.getText());
      }
    }
    const hasKnownBinding = (name: string): boolean =>
      this.localSimpleTypeKeys.has(name)
      || this.localStructTypes.has(name)
      || this.localArrayVarTypes.has(name)
      || this.localBytesVars.has(name)
      || this.stateVarNames.has(name)
      || this.transientStateVarNames.has(name)
      || this.stateArrayVarTypes.has(name)
      || this.stateMappingValueStruct.has(name);
    const shadowedOuterLoopNames = new Set([...declaredLoopNames].filter(hasKnownBinding));
    for (const name of declaredLoopNames) this.expiredLoopVariableNames.delete(name);

    // Build init. Three forms: a declaration (`uint i = 0`), a bare assignment reusing an outer variable
    // (`i = 0`), or empty (`for (; ...)`). Only the declaration form introduces a loop variable.
    let initNode: StatementNode | undefined;
    if (initCtx.typeName()) {
      const initType = this.resolveType(initCtx.typeName().getText());
      const initModifiers = initCtx.modifier_list().map((m) => m.getText());
      const initName = initCtx.Identifier().getText();
      // Initializer is optional (`for (uint i; ...)`); default an omitted one to 0.
      let initExpr: ExpressionNode;
      if (initCtx.expression(0)) {
        initExpr = this.visit(initCtx.expression(0)) as ExpressionNode;
      } else {
        initExpr = new IntLiteralNode(0n);
        initExpr.location = Location.fromCtx(initCtx);
      }
      const varDef = new VariableDefinitionNode(initType, initModifiers, initName, initExpr);
      varDef.location = Location.fromCtx(initCtx);
      // The loop variable is block-scoped in Solidity; the for desugars to a flattened `{ init; while }`, so
      // mark it so a sequential loop reusing the same name can re-declare it (it overwrites the dead prior one;
      // identifier resolution is in-order, so each loop body already resolved against its own declaration).
      varDef.isLoopVariable = true;
      initNode = varDef;
    } else if (initCtx._op) {
      // Bare assignment init: `i = 0` reuses a variable declared in an enclosing scope.
      initNode = this.buildCompoundAssign(
        initCtx.Identifier().getText(),
        Location.fromToken(initCtx.Identifier().symbol),
        initCtx._op.text,
        initCtx.expression(0),
        Location.fromCtx(initCtx),
      );
    } else if (initCtx.tupleSlot_list().length > 0) {
      // Tuple destructure init: `(uint x, uint y) = (0, 1)` - declare/assign loop-scoped vars (mirrors the
      // parenthesised tupleAssignment slot handling; the loop desugars to `{ init; while }` so the vars scope right).
      initNode = this.buildForTupleAssign(initCtx.tupleSlot_list(), initCtx.expression_list(), Location.fromCtx(initCtx));
    }
    // else: empty init (`for (; ...)`) - no statement.

    // Update clause is optional (`for (...; ...; )`); when present it becomes the trailing body statement. It can
    // be a scalar assignment/inc-dec or a tuple destructure `(x, y) = (a, b)`.
    let updateNode: StatementNode | undefined;
    if (updateCtx && updateCtx.tupleSlot_list().length > 0) {
      updateNode = this.buildForTupleAssign(
        updateCtx.tupleSlot_list(), updateCtx.expression_list(), Location.fromCtx(updateCtx),
      );
    } else if (updateCtx) {
      if (updateCtx._op) {
        const updateName = updateCtx.Identifier().getText();
        const knownUpdateName = declaredLoopNames.has(updateName) || hasKnownBinding(updateName);
        if (this.solidityImportCompat && !knownUpdateName) {
          throw new ParseError(`Undeclared identifier '${updateName}'`, Location.fromCtx(updateCtx));
        }
        updateNode = this.buildCompoundAssign(
          updateName,
          Location.fromToken(updateCtx.Identifier().symbol),
          updateCtx._op.text,
          updateCtx.expression(0),
          Location.fromCtx(updateCtx),
        );
      } else if (updateCtx.expression(0)) {
        const expressionCtx = updateCtx.expression(0);
        if (expressionCtx instanceof FunctionCallExpressionContext || expressionCtx instanceof MethodCallContext
          || expressionCtx instanceof MethodCallNamedContext) {
          updateNode = this.buildCallStatement(expressionCtx);
        } else {
          updateNode = new ExpressionStatementNode(this.visit(expressionCtx) as ExpressionNode);
          updateNode.location = Location.fromCtx(updateCtx);
        }
      }
    }

    // Build condition. An omitted condition (`for (init; ; update)`) is an implicit `true` (Solidity infinite
    // loop, terminated by a break inside the body).
    const condition = condCtx.expression()
      ? this.visit(condCtx.expression())
      : Object.assign(new BoolLiteralNode(true), { location: Location.fromCtx(condCtx) });

    // Build body block, appending update as last statement when present
    const bodyBlock = this.visit(ctx.block()) as BlockNode;
    const bodyStatements = updateNode
      ? [...(bodyBlock.statements ?? []), updateNode]
      : [...(bodyBlock.statements ?? [])];
    const loopBlock = new BlockNode(bodyStatements);
    loopBlock.location = bodyBlock.location;

    // while (cond) { body; update } - pre-checks the condition so zero iterations are correct.
    // forLoopUpdateCount marks the trailing update so `continue` still runs it.
    const whileNode = new WhileNode(condition, loopBlock);
    whileNode.forLoopUpdateCount = updateNode ? 1 : 0;
    whileNode.location = Location.fromCtx(ctx);

    // Wrap: { init; while (cond) { body; update; } } - init omitted for an empty `for (; ...)`.
    const outerBlock = new BlockNode(initNode ? [initNode, whileNode] : [whileNode]);
    outerBlock.location = Location.fromCtx(ctx);
    for (const name of declaredLoopNames) {
      if (!shadowedOuterLoopNames.has(name)) this.expiredLoopVariableNames.add(name);
    }
    return outerBlock;
  }

  visitDoWhileStatement(ctx: DoWhileStatementContext): DoWhileNode {
    const condition = this.visit(ctx.expression());
    const block = this.visit(ctx.block()) as StatementNode;
    const doWhile = new DoWhileNode(condition, block);
    doWhile.location = Location.fromCtx(ctx);
    return doWhile;
  }

  visitWhileStatement(ctx: WhileStatementContext): WhileNode {
    const condition = this.visit(ctx.expression());
    const block = this.visit(ctx.block()) as BlockNode;
    const whileNode = new WhileNode(condition, block);
    whileNode.location = Location.fromCtx(ctx);
    return whileNode;
  }

  visitAssemblyStatement(ctx: AssemblyStatementContext): AssemblyStatementNode {
    if (this.solidityImportCompat && /^assembly["']/.test(ctx.getText())) {
      const dialect = ctx.StringLiteral_list()[0].getText().slice(1, -1);
      if (dialect !== 'evmasm') {
        throw new ParseError(`Only "evmasm" assembly is supported, not "${dialect}"`, Location.fromCtx(ctx));
      }
    }
    if (this.solidityImportCompat) {
      const optionList = ctx.getText().match(/\((.*)\)\{/s)?.[1] ?? '';
      const memorySafeCount = [...optionList.matchAll(/["']memory-safe["']/g)].length;
      if (memorySafeCount > 1) {
        throw new ParseError('Inline assembly marked memory-safe multiple times', Location.fromCtx(ctx));
      }
    }
    const block = buildYulBlock(ctx.yulBlock());
    if (this.solidityImportCompat) {
      const reserved = findReservedYulIdentifier(block);
      if (reserved) {
        throw new ParseError(
          `The identifier '${reserved.name}' is reserved and can not be used`,
          reserved.node.location,
        );
      }
    }
    if (isBchAsmBlock(block)) {
      // Native BCH-ASM: reconstruct the space-separated opcode body for asmToScript.
      const body = ctx.yulBlock().yulStatement_list().map((s) => s.getText()).join(' ');
      const node = new AssemblyStatementNode(body);
      node.location = Location.fromCtx(ctx);
      return node;
    }
    // Solidity inline assembly (Yul): keep the parsed sub-tree for diagnostics/codegen.
    const node = new AssemblyStatementNode('');
    node.yulBlock = block;
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitUncheckedStatement(ctx: UncheckedStatementContext): UncheckedNode {
    if (this.solidityImportCompat) {
      let parent = ctx.parentCtx;
      let containingBlock: ParserRuleContext | undefined;
      while (parent) {
        if (parent.constructor.name === 'UncheckedStatementContext') {
          throw new ParseError('Unchecked blocks cannot be nested', Location.fromCtx(ctx));
        }
        if (parent.constructor.name === 'BlockContext') {
          containingBlock = parent;
          break;
        }
        parent = parent.parentCtx;
      }
      // `block` also accepts one unbraced statement for control-flow bodies. Solidity permits `unchecked`
      // only as a statement inside a regular `{ ... }` block, never as that direct body.
      if (containingBlock && !containingBlock.getText().startsWith('{')) {
        throw new ParseError(
          'Unchecked blocks can only be used inside regular blocks',
          Location.fromCtx(ctx),
        );
      }
      const containsPlaceholder = (tree: ParseTree): boolean => {
        if (tree.constructor.name === 'PlaceholderStatementContext') return true;
        const children = (tree as ParseTree & { children?: ParseTree[] }).children ?? [];
        return children.some(containsPlaceholder);
      };
      if (containsPlaceholder(ctx)) {
        throw new ParseError(
          'Modifier placeholders cannot be used inside unchecked blocks',
          Location.fromCtx(ctx),
        );
      }
    }
    const statements = ctx.statement_list().map((s) => this.visit(s) as StatementNode);
    const block = new BlockNode(statements);
    block.location = Location.fromCtx(ctx);
    const node = new UncheckedNode(block);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitSwitchStatement(ctx: SwitchStatementContext): SwitchNode {
    const expression = this.visit(ctx.expression()) as ExpressionNode;
    const cases = ctx.switchCase_list().map((c: SwitchCaseContext) => {
      const value = this.visit(c.expression()) as ExpressionNode;
      const statements = c.statement_list().map((s) => this.visit(s) as StatementNode);
      const body = new BlockNode(statements);
      body.location = Location.fromCtx(c);
      const caseNode = new SwitchCaseNode(value, body);
      caseNode.location = Location.fromCtx(c);
      return caseNode;
    });

    let defaultCase: BlockNode | undefined;
    const defaultCtx = ctx.switchDefault();
    if (defaultCtx) {
      const defaultStatements = defaultCtx.statement_list().map((s) => this.visit(s) as StatementNode);
      defaultCase = new BlockNode(defaultStatements);
      defaultCase.location = Location.fromCtx(defaultCtx);
    }

    const node = new SwitchNode(expression, cases, defaultCase);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitBreakStatement(ctx: BreakStatementContext): BreakNode {
    const node = new BreakNode();
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitContinueStatement(ctx: ContinueStatementContext): ContinueNode {
    const node = new ContinueNode();
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitTryCatchStatement(ctx: TryCatchStatementContext): TryCatchNode {
    const expression = this.visit(ctx.expression());
    const tryBlock = this.visit(ctx.block()) as BlockNode;
    const catchClauses = ctx.catchClause_list().map((c) => this.visitCatchClause(c));

    // Parse optional returns clause
    let returnParameters: ParameterNode[] | undefined;
    const returnsCtx = ctx.tryReturns();
    if (returnsCtx) {
      returnParameters = returnsCtx.parameter_list().map((p) => this.visit(p) as ParameterNode);
      if (this.solidityImportCompat && returnParameters.length === 0) {
        throw new ParseError('Try returns clause requires at least one parameter', Location.fromCtx(returnsCtx));
      }
    }

    if (this.solidityImportCompat) {
      const seen = new Set<string>();
      for (const clause of catchClauses) {
        const kind = clause.errorName ?? 'low-level';
        if (clause.errorName && clause.errorName !== 'Error' && clause.errorName !== 'Panic') {
          throw new ParseError(
            `Invalid catch clause name '${clause.errorName}'; expected Error, Panic, or an unnamed catch`,
            clause.location,
          );
        }
        if (seen.has(kind)) {
          throw new ParseError(`Try statement already has a ${kind} catch clause`, clause.location);
        }
        seen.add(kind);

        const parameters = clause.parameters ?? [];
        const parameter = parameters[0];
        const isMemory = parameter?.modifier.includes(Modifier.MEMORY) ?? false;
        if (kind === 'Error' && (parameters.length !== 1
          || parameter.type !== PrimitiveType.STRING || !isMemory)) {
          throw new ParseError('Expected catch Error(string memory ...)', clause.location);
        }
        if (kind === 'Panic' && (parameters.length !== 1 || !(parameter.type instanceof IntType)
          || parameter.type.signed || parameter.type.bits !== 256)) {
          throw new ParseError('Expected catch Panic(uint256 ...)', clause.location);
        }
        if (kind === 'low-level' && clause.parameters && (parameters.length !== 1
          || !(parameter.type instanceof BytesType) || parameter.type.bound !== undefined || !isMemory)) {
          throw new ParseError('Expected catch (bytes memory ...) or catch { ... }', clause.location);
        }
      }
    }

    const node = new TryCatchNode(expression, tryBlock, catchClauses, returnParameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitCatchClause(ctx: CatchClauseContext): CatchClauseNode {
    const block = this.visit(ctx.block()) as BlockNode;
    const errorName = ctx.Identifier()?.getText();
    const parameters = ctx.parameter_list().length > 0
      ? ctx.parameter_list().map((p) => this.visit(p) as ParameterNode)
      : undefined;
    if (this.solidityImportCompat && !errorName && !parameters && ctx.getText().startsWith('catch(')) {
      throw new ParseError('Catch parameter list cannot be empty', Location.fromCtx(ctx));
    }
    const node = new CatchClauseNode(block, errorName, parameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitBlock(ctx: BlockContext): BlockNode {
    const statements = this.flattenStatements(ctx.statement_list().map((s) => this.visit(s) as StatementNode));
    if (this.solidityImportCompat && !ctx.getText().startsWith('{')
      && statements.length === 1 && statements[0] instanceof VariableDefinitionNode) {
      throw new ParseError('Variable declarations can only be used inside blocks', statements[0].location);
    }
    const block = new BlockNode(statements);
    block.location = Location.fromCtx(ctx);
    return block;
  }

  // A bare `{ ... }` used as a statement (introduces a nested scope). Marked `scoped` so flattenStatements keeps
  // it intact - its nested variable scope must survive so sibling blocks may reuse a name.
  visitBlockStatement(ctx: BlockStatementContext): BlockNode {
    const statements = this.flattenStatements(ctx.statement_list().map((s) => this.visit(s) as StatementNode));
    const block = new BlockNode(statements);
    block.scoped = true;
    block.location = Location.fromCtx(ctx);
    return block;
  }

  visitParenthesised(ctx: ParenthesisedContext): ExpressionNode {
    return this.visit(ctx.expression());
  }

  visitCast(ctx: CastContext): CastNode {
    const arrayTypeCtx = (ctx as any).arrayCastType?.();
    if (arrayTypeCtx?.getText().includes('[')) {
      const cast = new CastNode(
        parseType(arrayTypeCtx.getText()),
        this.visit(ctx._castable),
        false,
      );
      cast.sourceCast = true;
      cast.location = Location.fromCtx(ctx);
      return cast;
    }
    const rawType = arrayTypeCtx.typeCast().getText();

    // Handle payable() cast - produces AddressType(payable=true) or ConnectedAddressType(payable=true)
    if (rawType === 'payable') {
      const expression = this.visit(ctx._castable);
      // The actual payable type is determined during type checking
      const type = new AddressType(true);
      const cast = new CastNode(type, expression, false);
      cast.sourceCast = true;
      cast.location = Location.fromCtx(ctx);
      return cast;
    }

    // Handle address() cast
    if (rawType === 'address') {
      const expression = this.visit(ctx._castable);
      const type = new AddressType(false);
      const cast = new CastNode(type, expression, false);
      cast.sourceCast = true;
      cast.location = Location.fromCtx(ctx);
      return cast;
    }

    const cleanType = rawType.replace('unsafe_', '');
    this.validateBoundedIntType(cleanType);
    this.validateFixedType(cleanType);
    const type = parseType(cleanType);
    const isUnsafe = rawType.startsWith('unsafe_');
    const expression = this.visit(ctx._castable);
    const cast = new CastNode(type, expression, isUnsafe);
    cast.sourceCast = true;
    cast.location = Location.fromCtx(ctx);
    return cast;
  }

  visitFunctionCallExpression(ctx: FunctionCallExpressionContext): ExpressionNode {
    return this.visit(ctx.functionCall()) as ExpressionNode;
  }

  // `<base>[i](args)`: call a function pointer stored in an array element (`arr[i]()`, `s[0](x)`). The callee is
  // the element access `base[i]`; lowered to an indirect OP_INVOKE on its function-pointer value. A plain-name or
  // `a.b` callee stays a normal functionCall/MethodCall - only an indexed callee reaches here.
  visitIndexedFunctionCall(ctx: any): ExpressionNode {
    const base = this.visit(ctx._base) as ExpressionNode;
    const index = this.visit(ctx._index) as ExpressionNode;
    const callee = new ArrayAccessNode(base, index);
    callee.location = Location.fromCtx(ctx);
    const args = this.buildCallArguments(ctx.expressionList());
    const node = new IndirectCallNode(callee, args);
    node.callOptions = this.parseCallOptions(ctx.callOptions());
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitCallOptionsMember(ctx: any): ExpressionNode {
    this.parseCallOptions(ctx.callOptions());
    const member = ctx.memberName().getText().slice(1);
    if (member !== 'address' && member !== 'selector') {
      throw new ParseError(`Function values have no member '${member}'`, Location.fromCtx(ctx.memberName()));
    }
    const receiver = ctx.expression().getText() === 'this'
      ? new StateAccessNode(ctx.Identifier().getText())
      : new FieldAccessNode(
        this.visit(ctx.expression()) as ExpressionNode,
        ctx.Identifier().getText(),
      );
    receiver.location = Location.fromCtx(ctx);
    const node = new FieldAccessNode(receiver, member);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // `(<callee>)(args)`: call the value of a parenthesised non-simple callee (a ternary picking a function pointer,
  // etc.). Same indirect dispatch as an indexed callee.
  visitParenthesizedFunctionCall(ctx: any): ExpressionNode {
    const callee = this.visit(ctx.expression()) as ExpressionNode;
    const args = this.buildCallArguments(ctx.expressionList());
    // Parentheses do not turn an ordinary member call into a function-pointer call: `((d.f))(args)` has the
    // same lookup and dispatch semantics as `d.f(args)`. Keep `super.f` on its established indirect/self
    // resolution path, where the inheritance pass has the context needed to select the base implementation.
    if (callee instanceof FieldAccessNode
      && !(callee.expression instanceof IdentifierNode && callee.expression.name === 'super')) {
      return this.buildMethodCall(ctx, callee.expression, callee.name, args, undefined, false);
    }
    const node = new IndirectCallNode(callee, args);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitChainedFunctionCall(ctx: any): ExpressionNode {
    let callee = this.visit(ctx.functionCall()) as ExpressionNode;
    for (const argsCtx of ctx.expressionList_list()) {
      const node = new IndirectCallNode(callee, this.buildCallArguments(argsCtx));
      node.location = Location.fromCtx(ctx);
      callee = node;
    }
    return callee;
  }

  visitChainedMethodCall(ctx: any): ExpressionNode {
    const lists = ctx.expressionList_list();
    let callee = this.buildMethodCall(
      ctx,
      this.visit(ctx.expression()) as ExpressionNode,
      ctx.Identifier().getText(),
      this.buildCallArguments(lists[0]),
      this.parseCallOptions(ctx.callOptions()),
      ctx.expression().getText() === 'this',
    );
    for (const argsCtx of lists.slice(1)) {
      const node = new IndirectCallNode(callee, this.buildCallArguments(argsCtx));
      node.location = Location.fromCtx(ctx);
      callee = node;
    }
    return callee;
  }

  visitFunctionCall(ctx: FunctionCallContext): ExpressionNode {
    const identifiers = ctx.Identifier_list();

    // Named-arg struct initialization: Person({name: "Alice", age: 30}) or Person({})
    // The named-arg alternative has no expressionList, so check for that
    if (!ctx.expressionList()) {
      // A library-namespaced call `L.f({named})` keeps its qualified name (mirrors the positional form below);
      // a bare `Person({named})` uses the single identifier.
      const name = identifiers.length > 1
        ? `${identifiers[0].getText()}.${identifiers[1].getText()}`
        : identifiers[0].getText();
      if (this.solidityImportCompat && /,\}\)$/.test(ctx.getText())) {
        throw new ParseError('Unexpected trailing comma in named arguments', Location.fromCtx(ctx));
      }
      const directUdvt = identifiers.length === 1 ? this.typeDefMap.get(name) : undefined;
      const qualifiedUdvt = identifiers.length === 2
        ? this.typeDefMap.get(identifiers[0].getText()) : undefined;
      const udvtMethod = identifiers.length === 2 ? identifiers[1].getText() : undefined;
      if (this.solidityImportCompat && directUdvt) {
        throw new ParseError(
          `Explicit type conversion to '${directUdvt.name}' is not allowed; use '${directUdvt.name}.wrap(...)'`,
          Location.fromCtx(ctx),
        );
      }
      if (this.solidityImportCompat && qualifiedUdvt
        && (udvtMethod === 'wrap' || udvtMethod === 'unwrap')) {
        throw new ParseError(
          `Named arguments are not valid for '${qualifiedUdvt.name}.${udvtMethod}'`,
          Location.fromCtx(ctx),
        );
      }
      if (this.solidityImportCompat && this.fileErrorNames.has(name)) {
        throw new ParseError(
          `Error '${name}' can only be used with a revert statement or as a require error`,
          Location.fromCtx(ctx),
        );
      }
      const identifier = new IdentifierNode(name);
      identifier.location = Location.fromToken(identifiers[0].symbol);
      const namedArgs = ctx.namedArg_list();
      const fieldNames = namedArgs.map((na) => na.Identifier().getText());
      const parameters = namedArgs.map((na) => this.visit(na.expression()) as ExpressionNode);
      const functionCall = new FunctionCallNode(identifier, parameters);
      functionCall.fieldNames = fieldNames;
      functionCall.location = Location.fromCtx(ctx);
      return functionCall;
    }

    const name = identifiers.length > 1
      ? `${identifiers[0].getText()}.${identifiers[1].getText()}`
      : identifiers[0]?.getText() ?? ctx.start.text;
    if (this.solidityImportCompat && this.fileErrorNames.has(name)) {
      throw new ParseError(
        `Error '${name}' can only be used with a revert statement or as a require error`,
        Location.fromCtx(ctx),
      );
    }
    const identifier = new IdentifierNode(name);
    identifier.location = Location.fromToken(identifiers[0]?.symbol ?? ctx.start);
    const parameters = this.buildCallArguments(ctx.expressionList()!);
    const directUdvt = identifiers.length === 1 ? this.typeDefMap.get(name) : undefined;
    if (this.solidityImportCompat && directUdvt) {
      if (parameters.length !== 1) {
        throw new ParseError(
          `Exactly one argument expected for explicit conversion to '${directUdvt.name}'`,
          Location.fromCtx(ctx),
        );
      }
      const cast = new CastNode(directUdvt, parameters[0], false);
      cast.sourceCast = true;
      cast.location = Location.fromCtx(ctx);
      return cast;
    }

    // using-for: `recv.method(args)` where recv is a struct var bound to a library -> `Library.method(recv, args)`.
    if (identifiers.length > 1 && this.usingForLibraries.size > 0) {
      const recvName = identifiers[0].getText();
      const recvStruct = this.localStructTypes.get(recvName) ?? this.stateStructVars.get(recvName)
        ?? this.mappingStructStateVars.get(recvName);
      const simpleKey = this.localSimpleTypeKeys.get(recvName);
      const libName = (recvStruct && this.usingForLibraries.get(recvStruct.name))
        ?? this.usingForArrayLibrary(recvName)
        ?? this.usingForMappingLibrary(recvName)
        ?? this.usingForSimpleLibrary(recvName, simpleKey);
      if (libName) {
        const libId = new IdentifierNode(`${libName}.${identifiers[1].getText()}`);
        libId.location = identifier.location;
        const recv = new IdentifierNode(recvName);
        recv.location = Location.fromToken(identifiers[0].symbol);
        const call = new FunctionCallNode(libId, [recv, ...(parameters as ExpressionNode[])]);
        call.location = Location.fromCtx(ctx);
        return call;
      }
    }

    // `erc7201(id)` (ERC-7201 / EIP-7201 namespaced storage slot): fold to the SPEC-CONFORMANT slot,
    // keccak256(abi.encode(uint256(keccak256(id)) - 1)) & ~bytes32(uint256(0xff)), as a uint256 - byte-identical to
    // Ethereum. Literal ids fold at parse time; runtime string/bytes expressions lower to the specification's
    // hash/arithmetic expression (Solidity accepts calldata, memory, storage, concat, ternary, and pure-call ids).
    if (identifiers.length === 1 && name === 'erc7201' && parameters.length === 1) {
      if (this.solidityImportCompat && ctx.callOptions()) {
        throw new ParseError(
          'Function call options can only be set on external function calls or contract creations',
          Location.fromCtx(ctx),
        );
      }
      let arg = parameters[0];
      if (arg instanceof IdentifierNode) {
        const constantValue = this.constantStringValues.get(arg.name);
        if (constantValue !== undefined) {
          const resolved = new StringLiteralNode(constantValue, '"');
          resolved.location = arg.location;
          arg = resolved;
        }
      }
      if (arg instanceof StringLiteralNode) {
        const lit = new IntLiteralNode(computeErc7201SlotNumber(arg.value));
        lit.location = Location.fromCtx(ctx);
        // Type it as the uint256 slot number (arithmetic/comparison/slot contexts the spec uses).
        const cast = new CastNode(parseType('uint256'), lit, false);
        cast.location = Location.fromCtx(ctx);
        return cast;
      }
      if (arg instanceof IntLiteralNode) {
        throw new ParseError('erc7201(...) expects a string namespace id', Location.fromCtx(ctx));
      }
      if (arg instanceof HexLiteralNode) {
        try {
          new TextDecoder('utf-8', { fatal: true }).decode(arg.value);
        } catch {
          throw new ParseError('erc7201(...) expects a valid UTF-8 string namespace id', Location.fromCtx(ctx));
        }
      }
      if (arg instanceof IdentifierNode && this.constantTypes.get(arg.name) instanceof BytesType) {
        throw new ParseError('erc7201(...) expects a string namespace id, not bytes', Location.fromCtx(ctx));
      }
      const loc = Location.fromCtx(ctx);
      const at = <T extends Node>(node: T): T => { node.location = loc; return node; };
      const uint256 = parseType('uint256');
      const bytes32 = new BytesType(32);
      const callKeccak = (value: ExpressionNode): FunctionCallNode =>
        at(new FunctionCallNode(at(new IdentifierNode('keccak256')), [value]));
      const innerHash = callKeccak(at(new CastNode(new BytesType(), arg, false)));
      const innerNumber = at(new CastNode(uint256, innerHash, false));
      const decremented = at(new BinaryOpNode(innerNumber, BinaryOperator.MINUS, at(new IntLiteralNode(1n))));
      const encodedWord = at(new CastNode(bytes32, decremented, false));
      const encoded = at(new BytesConcatNode([encodedWord]));
      const outerHash = callKeccak(encoded);
      const lowByteMask = at(new UnaryOpNode(
        UnaryOperator.INVERT,
        at(new CastNode(bytes32, at(new CastNode(uint256, at(new IntLiteralNode(0xffn)), false)), false)),
      ));
      return at(new CastNode(
        uint256,
        at(new BinaryOpNode(outerHash, BinaryOperator.BIT_AND, lowByteMask)),
        false,
      ));
    }

    // `Color(i)` where Color is an enum is an int -> enum cast, not a function call. Also `L.Color(i)` /
    // `Contract.Color(i)` - a library/contract/interface-qualified enum cast (enums register under their bare name).
    const enumType = identifiers.length === 1
      ? this.enumMap.get(name)
      : (identifiers.length === 2
        && (this.libraryNames.has(identifiers[0].getText()) || this.contractInterfaceNames.has(identifiers[0].getText()))
        ? (this.qualifiedEnumMap.get(name) ?? this.enumMap.get(identifiers[1].getText())) : undefined);
    if (enumType && parameters.length === 1) {
      const cast = new CastNode(enumType, parameters[0] as ExpressionNode, false);
      cast.sourceCast = true;
      const sourceText = ctx.expressionList()!.getText();
      const sourceEnumName = sourceText.match(
        /^\((?:[A-Za-z_$][\w$]*\.)*([A-Za-z_$][\w$]*)\.[A-Za-z_$][\w$]*\)$/,
      )?.[1];
      const sourceEnum = sourceEnumName ? this.enumMap.get(sourceEnumName) : undefined;
      if (sourceEnum && sourceEnum.name !== enumType.name) {
        throw new ParseError(
          `Explicit type conversion is not allowed from enum '${sourceEnum.name}' to enum '${enumType.name}'`,
          Location.fromCtx(ctx),
        );
      }
      cast.location = Location.fromCtx(ctx);
      return cast;
    }

    // `uint(x)` is the uint256 alias used as a cast. The typeCast grammar only covers bounded `uintN`, so bare
    // `uint` reaches here as a call; rewrite it to a cast (Solidity's `uint` == `uint256`).
    if (identifiers.length === 1 && name === 'uint' && parameters.length === 1) {
      const cast = new CastNode(parseType('uint'), parameters[0] as ExpressionNode, false);
      cast.sourceCast = true;
      cast.location = Location.fromCtx(ctx);
      return cast;
    }

    // UDVT `Duration.wrap(x)` / `Duration.unwrap(x)`. A user-defined value type is identity at runtime over its
    // underlying type, so wrap/unwrap are casts: unwrap -> the underlying type; wrap -> the underlying then the
    // UDVT (wrap takes the underlying type, so a literal arg is first cast to it). The typeDefMap check
    // distinguishes this from a library method named wrap/unwrap (e.g. `LibClock.wrap(d, t)`).
    if (identifiers.length === 2) {
      const udvt = this.typeDefMap.get(identifiers[0].getText());
      const method = identifiers[1].getText();
      if (udvt && (method === 'wrap' || method === 'unwrap')) {
        if (parameters.length !== 1) {
          throw new ParseError(
            `Wrong argument count for '${udvt.name}.${method}': ${parameters.length} given but expected 1`,
            Location.fromCtx(ctx),
          );
        }
        const arg = parameters[0] as ExpressionNode;
        if (method === 'unwrap') {
          const cast = new CastNode(udvt.underlyingType, arg, false);
          cast.sourceCast = this.solidityImportCompat;
          if (this.solidityImportCompat) cast.sourceUdvtUnwrap = udvt;
          cast.location = Location.fromCtx(ctx);
          return cast;
        }
        const toUnderlying = new CastNode(udvt.underlyingType, arg, false);
        toUnderlying.sourceCast = this.solidityImportCompat;
        toUnderlying.location = Location.fromCtx(ctx);
        const cast = new CastNode(udvt, toUnderlying, false);
        cast.sourceCast = this.solidityImportCompat;
        cast.location = Location.fromCtx(ctx);
        return cast;
      }
    }

    const functionCall = new FunctionCallNode(identifier, parameters);
    functionCall.callOptions = this.parseCallOptions(ctx.callOptions());
    functionCall.location = Location.fromCtx(ctx);
    return functionCall;
  }

  visitInstantiation(ctx: InstantiationContext): InstantiationNode {
    const identifier = new IdentifierNode(ctx.Identifier().getText());
    identifier.location = Location.fromToken(ctx.Identifier().symbol);
    const parameters = this.buildCallArguments(ctx.expressionList()!);
    const instantiation = new InstantiationNode(identifier, parameters);
    instantiation.location = Location.fromCtx(ctx);
    if (ctx.callOptions()) {
      instantiation.callOptions = this.parseCallOptions(ctx.callOptions());
    }
    return instantiation;
  }

  // Parenthesized instantiation with options `(new C){value:.., salt:..}(args)` (Solidity's create/create2 form).
  // Same InstantiationNode as `new C{opts}(args)`; the parens are required by Solidity when options are present.
  visitInstantiationWithOptions(ctx: any): InstantiationNode {
    const identifier = new IdentifierNode(ctx.Identifier().getText());
    identifier.location = Location.fromToken(ctx.Identifier().symbol);
    const parameters = this.buildCallArguments(ctx.expressionList()!);
    const instantiation = new InstantiationNode(identifier, parameters);
    instantiation.location = Location.fromCtx(ctx);
    instantiation.callOptions = this.parseCallOptions(ctx.callOptions());
    return instantiation;
  }

  visitNewArray(ctx: any): NewArrayNode {
    // `new T[]...[](n)` allocates the OUTER (last) dimension, which must be dynamic; earlier bracket groups
    // read left-to-right like the type form and may carry a fixed size: `new uint[4][](n)` = n elements of
    // type uint[4], `new uint256[][](2)` = 2 elements of type uint256[].
    // An unresolved element name (a contract type like `new C[](n)`) becomes a named AddressType placeholder - a
    // contract handle is an address on BCH - mirroring the scalar/array type paths, so `C[]` types as address[]
    // rather than undefined[].
    const elemName = ctx.typeName().getText();
    if (this.solidityImportCompat && this.libraryNames.has(elemName)) {
      throw new ParseError(`Invalid use of library name '${elemName}' as an array element type`, Location.fromCtx(ctx));
    }
    let elementType = this.resolveType(elemName) ?? new AddressType(false, elemName);
    // Bracket sizes in source order (undefined = dynamic), read from the token children between the type
    // name and the size parenthesis (the size expression itself may contain brackets, so no text regex).
    const sizes: Array<number | undefined> = [];
    const children: any[] = ctx.children ?? [];
    for (let i = 2; i < children.length; i += 1) {
      const text = children[i].getText?.();
      if (text === '(') break;
      if (text === '[') {
        const next = children[i + 1]?.getText?.();
        sizes.push(next === ']' ? undefined : Number(next));
      }
    }
    if (sizes[sizes.length - 1] !== undefined) {
      throw new ParseError('The outer dimension of a new array expression must be dynamic', Location.fromCtx(ctx));
    }
    for (const bound of sizes.slice(0, -1)) elementType = new ArrayType(elementType, bound);
    const size = this.visit(ctx.expression()) as ExpressionNode;
    const node = new NewArrayNode(elementType, size);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // `new bytes(n)`: a zero-filled dynamic byte buffer. A constant length folds to an n-zero-byte literal;
  // a dynamic length would need runtime buffer allocation (no BCH analogue) - error clearly.
  visitNewDynamicBytes(ctx: any): ExpressionNode {
    const size = this.visit(ctx.expression()) as ExpressionNode;
    if (size instanceof IntLiteralNode && size.value >= 0n) {
      const lit = new HexLiteralNode(new Uint8Array(Number(size.value)));
      lit.type = new BytesType();
      lit.location = Location.fromCtx(ctx);
      return lit;
    }
    // A runtime length: emit n zero bytes via `0 n OP_NUM2BIN` (a raw-bytes NewArrayNode). Matches Solidity's
    // `new bytes(n)` and is the malloc growth primitive for the experimental memory model.
    const arr = new NewArrayNode(new BytesType(1), size);
    arr.rawBytes = true;
    arr.type = new BytesType();
    arr.location = Location.fromCtx(ctx);
    return arr;
  }

  // `new string(n)` - a dynamic string of n bytes (UTF-8), i.e. n zero bytes typed as string. Only `string` is a
  // valid dynamic-allocation primitive; any other `new <primitive>(...)` is a placeholder error deferred to codegen.
  visitNewDynamicString(ctx: any): ExpressionNode {
    const size = this.visit(ctx.expression()) as ExpressionNode;
    const isString = ctx.PrimitiveType().getText() === 'string';
    if (isString && size instanceof IntLiteralNode && size.value >= 0n) {
      const lit = new HexLiteralNode(new Uint8Array(Number(size.value)));
      lit.type = PrimitiveType.STRING;
      lit.location = Location.fromCtx(ctx);
      return lit;
    }
    const placeholder = new HexLiteralNode(new Uint8Array(0));
    placeholder.type = isString ? PrimitiveType.STRING : new BytesType();
    placeholder.codegenError = isString
      ? 'new string(n) with a non-constant length has no BCH analogue (no dynamic buffer allocation)'
      : `new ${ctx.PrimitiveType().getText()}(...) is not a valid dynamic allocation`;
    placeholder.location = Location.fromCtx(ctx);
    return placeholder;
  }

  visitTupleIndexOp(ctx: TupleIndexOpContext): TupleIndexOpNode {
    const tuple = this.visit(ctx.expression());
    if (this.solidityImportCompat && tuple instanceof IdentifierNode && this.libraryNames.has(tuple.name)) {
      throw new ParseError(
        `Index access is not available for library type '${tuple.name}'`,
        Location.fromCtx(ctx),
      );
    }
    const exactIndex = BigInt(ctx._index.text.replaceAll('_', ''));
    if (this.solidityImportCompat && exactIndex >= (1n << 256n)) {
      throw new ParseError('Index expression cannot be represented as an unsigned integer', Location.fromCtx(ctx));
    }
    const index = parseInt(ctx._index.text, 10);
    const tupleIndexOp = new TupleIndexOpNode(tuple, index);
    tupleIndexOp.location = Location.fromCtx(ctx);
    return tupleIndexOp;
  }

  visitSlice(ctx: SliceContext): SliceNode {
    const element = this.visit(ctx._element);
    const start = this.visit(ctx._start);
    const end = this.visit(ctx._end);
    const slice = new SliceNode(element, start, end);
    slice.location = Location.fromCtx(ctx);
    return slice;
  }

  // `x[a:b]` index-range syntax desugars to the same SliceNode as `x.slice(a, b)`.
  visitIndexRangeSlice(ctx: IndexRangeSliceContext): SliceNode {
    const loc = Location.fromCtx(ctx);
    const element = this.visit(ctx._element) as ExpressionNode;
    // Omitted bounds default to 0 (start) and the element's length (end): `a[:2]`, `a[2:]`, `a[:]`.
    const start = ctx._start
      ? this.visit(ctx._start) as ExpressionNode
      : Object.assign(new IntLiteralNode(0n), { location: loc });
    const end = ctx._end
      ? this.visit(ctx._end) as ExpressionNode
      : Object.assign(new UnaryOpNode(UnaryOperator.SIZE, this.visit(ctx._element) as ExpressionNode), { location: loc });
    const slice = new SliceNode(element, start, end);
    slice.isSolidityIndexRange = this.solidityImportCompat;
    slice.location = loc;
    return slice;
  }

  visitNullaryOp(ctx: NullaryOpContext): NullaryOpNode {
    const operator = ctx.getText() as NullaryOperator;
    const nullaryOp = new NullaryOpNode(operator);
    if (this.solidityImportCompat && this.usesLegacySolidityNow()
      && (operator === NullaryOperator.MSG_SENDER || operator === NullaryOperator.TX_ORIGIN)) {
      nullaryOp.legacyPayableAddress = true;
    }
    nullaryOp.location = Location.fromCtx(ctx);
    return nullaryOp;
  }

  visitUnaryIntrospectionOp(ctx: UnaryIntrospectionOpContext): UnaryOpNode {
    const operator = `${ctx._scope.text}[i]${ctx._op.text}` as UnaryOperator;
    const expression = this.visit(ctx.expression());
    const unaryOp = new UnaryOpNode(operator, expression);
    unaryOp.location = Location.fromCtx(ctx);
    return unaryOp;
  }

  visitUnaryOp(ctx: UnaryOpContext): UnaryOpNode | IntLiteralNode {
    const operator = ctx._op.text as UnaryOperator;
    let expression = this.visit(ctx.expression());
    // `.length`/`.reverse()` on an element storage-pointer alias must inspect the aliased collection, not a
    // nonexistent runtime local. Scalar unary operators are intentionally left alone.
    if ((operator === UnaryOperator.SIZE || operator === UnaryOperator.REVERSE)
      && expression instanceof IdentifierNode && this.storageAliases.has(expression.name)) {
      expression = cloneNode(this.storageAliases.get(expression.name)!.access) as ExpressionNode;
    }
    // Fold `-<int literal>` to a negative literal. The lexer no longer emits signed literals (a leading `-` made
    // `i-1` tokenize as `i` `-1`), so negation is a parser-level unary op - but `-1` must stay a compile-time
    // constant so negative array indices / shift counts / etc. are still caught. `x - 1` keeps a BinaryOp.
    if (operator === UnaryOperator.NEGATE && expression instanceof IntLiteralNode) {
      const negated = new IntLiteralNode(-expression.value);
      negated.location = Location.fromCtx(ctx);
      return negated;
    }
    const unaryOp = new UnaryOpNode(operator, expression);
    unaryOp.legacyWrappingNegation = this.solidityImportCompat
      && this.usesLegacySolidityNow() && operator === UnaryOperator.NEGATE;
    unaryOp.location = Location.fromCtx(ctx);
    return unaryOp;
  }

  // Postfix `lvalue++` / `lvalue--` as an EXPRESSION (e.g. `abi.encode(.., nonces[owner]++, ..)`). Represented
  // as a UnaryOpNode with a postfix operator; DesugarPostfixExpressions lowers it to a hoisted read + increment.
  visitPostfixOp(ctx: PostfixOpContext): UnaryOpNode {
    const operator = ctx._op.text === '++' ? UnaryOperator.POSTFIX_INCREMENT : UnaryOperator.POSTFIX_DECREMENT;
    const operand = this.visit(ctx.expression());
    const node = new UnaryOpNode(operator, operand);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitPrefixOp(ctx: PrefixOpContext): UnaryOpNode {
    const operator = ctx._op.text === '++' ? UnaryOperator.PREFIX_INCREMENT : UnaryOperator.PREFIX_DECREMENT;
    const operand = this.visit(ctx.expression());
    const node = new UnaryOpNode(operator, operand);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitBinaryOp(ctx: BinaryOpContext): BinaryOpNode {
    const left = this.visit(ctx._left);
    const operator = ctx._op.text as BinaryOperator;
    const right = this.visit(ctx._right);
    const binaryOp = new BinaryOpNode(left, operator, right);
    binaryOp.location = Location.fromCtx(ctx);
    return binaryOp;
  }

  visitTernaryOp(ctx: TernaryOpContext): TernaryOpNode {
    // Branch assignment tails are desugared where the ternary's value has a home (statement scope, an
    // initializer, or an assignment value); anywhere else there is no statement to hoist the writes into.
    if (ctx._tOp || ctx._fOp) {
      throw new ParseError(
        'Assignment in a ternary branch is only supported at statement scope, as an initializer, or as an assignment value',
        Location.fromCtx(ctx),
      );
    }
    const condition = this.visit(ctx._condition);
    const ifTrue = this.visit(ctx._ifTrue);
    const ifFalse = this.visit(ctx._ifFalse);
    const ternary = new TernaryOpNode(condition, ifTrue, ifFalse);
    ternary.location = Location.fromCtx(ctx);
    if (!this.solidityImportCompat
      && ((ifTrue instanceof IntLiteralNode && ifFalse instanceof HexLiteralNode)
        || (ifFalse instanceof IntLiteralNode && ifTrue instanceof HexLiteralNode))) {
      throw new TernaryTypeMismatchError(ternary);
    }
    return ternary;
  }

  visitArray(ctx: ArrayContext): ArrayNode {
    const elements = ctx.expression_list().map((e) => this.visit(e));
    const array = new ArrayNode(elements);
    array.location = Location.fromCtx(ctx);
    return array;
  }

  visitIdentifier(ctx: IdentifierContext): IdentifierNode {
    const identifier = new IdentifierNode(ctx.anyIdentifier().getText());
    identifier.location = Location.fromCtx(ctx);
    if (this.solidityImportCompat && this.expiredLoopVariableNames.has(identifier.name)) {
      throw new ParseError(`Undeclared identifier '${identifier.name}'`, identifier.location);
    }
    // Whole-container storage alias (`mapping(...) storage p = m;`): a read of `p` resolves to the aliased
    // container identifier `m`, so `p[k]`, `f(p)`, `return p`, etc. operate on the real mapping. Only bare
    // identifier-to-identifier aliases substitute here; element/field aliases (access is an index/field path)
    // stay per-context (visitFieldAccess / buildLvalueAssign), which the read-side identifier form never hits.
    const alias = this.storageAliases.get(identifier.name);
    if (alias && alias.access instanceof IdentifierNode) {
      const sub = cloneNode(alias.access) as IdentifierNode;
      sub.location = identifier.location;
      return sub;
    }
    return identifier;
  }

  visitLiteralExpression(ctx: LiteralExpressionContext): LiteralNode {
    return this.createLiteral(ctx.literal());
  }

  createLiteral(ctx: LiteralContext): LiteralNode {
    if (ctx.BooleanLiteral()) {
      return this.createBooleanLiteral(ctx);
    }

    if (ctx.numberLiteral()) {
      return this.createIntLiteral(ctx);
    }

    if (ctx.decimalLiteral()) {
      return this.createDecimalLiteral(ctx);
    }

    if (ctx.StringLiteral_list().length > 0) {
      return this.createStringLiteral(ctx);
    }

    if (ctx.UnicodeLiteral_list().length > 0) {
      return this.createUnicodeLiteral(ctx);
    }

    if (ctx.HexStringLiteral_list().length > 0) {
      return this.createHexStringLiteral(ctx);
    }

    if (ctx.DateLiteral()) {
      return this.createDateLiteral(ctx);
    }

    if (ctx.HexLiteral()) {
      return this.createHexLiteral(ctx);
    }

    throw new Error(); // Should not happen
  }

  createBooleanLiteral(ctx: LiteralContext): BoolLiteralNode {
    const boolString = ctx.BooleanLiteral().getText();
    const boolValue = boolString === 'true';
    const booleanLiteral = new BoolLiteralNode(boolValue);
    booleanLiteral.location = Location.fromCtx(ctx);
    return booleanLiteral;
  }

  createIntLiteral(ctx: LiteralContext): IntLiteralNode | DecimalLiteralNode {
    const numberCtx = ctx.numberLiteral();
    const numberToken = numberCtx.NumberLiteral();
    const numberString = numberToken.getText();
    // Units split into time (NumberUnit) and BCH value (BchUnit) tokens; both resolve via the NumberUnit map.
    const unitToken = numberCtx.NumberUnit() ?? numberCtx.BchUnit();
    const numberUnit = unitToken?.getText();
    if (this.solidityImportCompat) {
      const digits = numberString.replaceAll('_', '').split(/[eE]/, 1)[0];
      if (/^0[0-9]/.test(digits)) {
        throw new ParseError('Octal numbers not allowed', Location.fromCtx(ctx));
      }
      if (unitToken && unitToken.symbol.start === numberToken.symbol.stop + 1) {
        throw new ParseError('Identifier-start is not allowed at end of a number', Location.fromCtx(ctx));
      }
      if (numberUnit === 'finney') {
        throw new ParseError('Expected \';\' but got identifier \'finney\'', Location.fromCtx(ctx));
      }
    }
    const parsed = parseNumberString(numberString);
    if (parsed === undefined) {
      // A scientific literal without a decimal point (`500e-3`) is tokenized as NumberLiteral. Solidity keeps
      // such a value as an exact rational constant, so preserve its normalized decimal form instead of rejecting
      // it merely because this individual literal is fractional. Constant-expression type checking can then fold
      // an enclosing integral expression such as `2**256 * 500e-3`.
      const match = numberString.replaceAll('_', '').match(/^(\d+)[eE]([+-]?\d+)$/);
      if (match) {
        const digits = match[1];
        const shift = Number(match[2]);
        if (shift < 0 && this.solidityImportCompat) {
          const padded = digits.padStart(-shift + 1, '0');
          const cut = padded.length + shift;
          const node = new DecimalLiteralNode(`${padded.slice(0, cut)}.${padded.slice(cut)}`);
          node.location = Location.fromCtx(ctx);
          return node;
        }
      }
      throw new ParseError(`Invalid scientific-notation literal '${numberString}'`, Location.fromCtx(ctx));
    }
    const numberValue = parsed * BigInt(numberUnit ? NumberUnit[numberUnit.toUpperCase()] : 1);
    const intLiteral = new IntLiteralNode(numberValue);
    intLiteral.location = Location.fromCtx(ctx);
    return intLiteral;
  }

  createDecimalLiteral(ctx: LiteralContext): DecimalLiteralNode | IntLiteralNode {
    const decCtx = ctx.decimalLiteral();
    const decimalToken = decCtx.DecimalLiteral();
    let text = decimalToken.getText();
    const decimalUnitToken = decCtx.NumberUnit?.() ?? decCtx.BchUnit?.();
    if (this.solidityImportCompat && decimalUnitToken) {
      if (decimalUnitToken.symbol.start === decimalToken.symbol.stop + 1) {
        throw new ParseError('Identifier-start is not allowed at end of a number', Location.fromCtx(ctx));
      }
      if (decimalUnitToken.getText() === 'finney') {
        throw new ParseError('Expected \';\' but got identifier \'finney\'', Location.fromCtx(ctx));
      }
    }
    // Scientific decimal (2.5e3, 1.5e-1): fold the exponent by shifting the point. An integral result with
    // no unit becomes a plain int literal; otherwise the normalized decimal flows into the unit/fixed paths.
    if (/[eE]/.test(text)) {
      const [mantissa, expStr] = text.replace(/_/g, '').split(/[eE]/);
      const [ip, fp = ''] = mantissa.split('.');
      const digits = BigInt((ip || '0') + fp);
      const shift = BigInt(expStr) - BigInt(fp.length);
      if (shift >= 0n) {
        text = (digits * 10n ** shift).toString();
      } else {
        const padded = digits.toString().padStart(Number(-shift) + 1, '0');
        const cut = padded.length + Number(shift);
        text = `${padded.slice(0, cut)}.${padded.slice(cut)}`;
      }
      if (!text.includes('.') && !(decCtx.NumberUnit?.() ?? decCtx.BchUnit?.())) {
        const intNode = new IntLiteralNode(BigInt(text));
        intNode.location = Location.fromCtx(ctx);
        return intNode;
      }
    }
    // A value unit after a decimal (`0.2 ether`, `1.5 gwei`) folds `decimal * unit` to an integer literal when
    // the product is exact - the same units the integer form (createIntLiteral) already accepts.
    const unit = (decCtx.NumberUnit?.() ?? decCtx.BchUnit?.())?.getText();
    if (unit) {
      const mult = BigInt(NumberUnit[unit.toUpperCase()]);
      const [intPart, fracPart = ''] = text.replace(/_/g, '').split('.');
      const scaled = BigInt((intPart || '0') + fracPart); // "0.2" -> 2
      const denom = 10n ** BigInt(fracPart.length); // 10^(#frac digits)
      if ((scaled * mult) % denom === 0n) {
        const intNode = new IntLiteralNode((scaled * mult) / denom);
        intNode.location = Location.fromCtx(ctx);
        return intNode;
      }
    }
    warnFixedPointOnce();
    const node = new DecimalLiteralNode(text);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  createStringLiteral(ctx: LiteralContext | RequireMessageContext): StringLiteralNode {
    const location = Location.fromCtx(ctx);
    // Handle multi-part string literals ("foo" "bar" -> "foobar")
    const stringTokens = 'StringLiteral_list' in ctx ? ctx.StringLiteral_list() : [ctx.StringLiteral()];
    const parts: string[] = [];
    const solidityByteParts: Uint8Array[] = [];
    let quote = '"';
    for (const token of stringTokens) {
      const rawString = token.getText();
      quote = rawString.substring(0, 1);
      const inner = rawString.substring(1, rawString.length - 1);
      if (this.solidityImportCompat) {
        solidityByteParts.push(this.solidityStringLiteralBytes(inner, location));
      }
      parts.push(this.processEscapes(inner, location));
    }
    const stringValue = parts.join('');
    const stringLiteral = new StringLiteralNode(stringValue, quote);
    if (this.solidityImportCompat) {
      stringLiteral.solidityBytes = Uint8Array.from(solidityByteParts.flatMap((bytes) => [...bytes]));
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(stringLiteral.solidityBytes);
      } catch {
        stringLiteral.solidityInvalidUtf8 = true;
        stringLiteral.type = new BytesType(stringLiteral.solidityBytes.length);
      }
    }
    stringLiteral.location = location;
    return stringLiteral;
  }

  createUnicodeLiteral(ctx: LiteralContext): StringLiteralNode {
    const location = Location.fromCtx(ctx);
    let quoteChar = '"';
    const stringValue = ctx.UnicodeLiteral_list().map((token) => {
      const rawText = token.getText();
      // rawText is like: unicode"..." or unicode'...'
      quoteChar = rawText.charAt(7); // char after "unicode"
      const inner = rawText.substring(8, rawText.length - 1);
      if (this.solidityImportCompat && inner.includes('\ufffd')) {
        throw new ParseError('String literal contains an invalid UTF-8 sequence', location);
      }
      return this.processEscapes(inner, location);
    }).join('');
    const stringLiteral = new StringLiteralNode(stringValue, quoteChar);
    stringLiteral.location = location;
    return stringLiteral;
  }

  createHexStringLiteral(ctx: LiteralContext): HexLiteralNode {
    const hexContent = ctx.HexStringLiteral_list().map((token) => {
      const raw = token.getText();
      // raw is like: hex"deadbeef" or hex'deadbeef'
      const content = raw.substring(4, raw.length - 1);
      if (this.solidityImportCompat) {
        let nibbleCount = 0;
        for (let i = 0; i < content.length; i++) {
          if (/[0-9a-fA-F]/.test(content[i])) {
            nibbleCount++;
          } else if (content[i] === '_' && (
            nibbleCount % 2 !== 0
            || !/[0-9a-fA-F]/.test(content[i - 1] ?? '')
            || !/[0-9a-fA-F]/.test(content[i + 1] ?? '')
          )) {
            throw new ParseError('Invalid use of hex string separator', Location.fromCtx(ctx));
          }
        }
      }
      return content.replace(/_/g, '');
    }).join('');
    if (hexContent.length % 2 !== 0) {
      throw new ParseError('Hex string must have even number of hex digits', Location.fromCtx(ctx));
    }
    const hexLiteral = new HexLiteralNode(hexToBin(hexContent));
    hexLiteral.isHexStringLiteral = true;
    hexLiteral.location = Location.fromCtx(ctx);
    return hexLiteral;
  }

  private solidityStringLiteralBytes(raw: string, location: Location): Uint8Array {
    if ([...raw].some((char) => char.codePointAt(0)! > 0x7f)) {
      throw new ParseError(
        'Invalid character in string; use a unicode-prefixed string literal for Unicode text',
        location,
      );
    }
    const bytes: number[] = [];
    const simpleEscapes: Record<string, number> = {
      n: 0x0a, r: 0x0d, t: 0x09, '\\': 0x5c, '\'': 0x27, '"': 0x22,
    };
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] !== '\\') {
        bytes.push(raw.charCodeAt(i));
        continue;
      }
      const next = raw[i + 1];
      if (next === 'x' && /^[0-9a-fA-F]{2}$/.test(raw.slice(i + 2, i + 4))) {
        bytes.push(parseInt(raw.slice(i + 2, i + 4), 16));
        i += 3;
      } else if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6))) {
        bytes.push(...new TextEncoder().encode(String.fromCodePoint(parseInt(raw.slice(i + 2, i + 6), 16))));
        i += 5;
      } else if (next === '\n') {
        i++;
      } else if (next === '\r') {
        i += raw[i + 2] === '\n' ? 2 : 1;
      } else if (next in simpleEscapes) {
        bytes.push(simpleEscapes[next]);
        i++;
      } else {
        // processEscapes provides the existing, more specific diagnostic for malformed/unknown escapes.
        this.processEscapes(raw, location);
        throw new ParseError('Invalid string escape sequence', location);
      }
    }
    return Uint8Array.from(bytes);
  }

  private processEscapes(raw: string, location?: Location): string {
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '\\' && i + 1 < raw.length) {
        const next = raw[i + 1];
        switch (next) {
          case '\n': i++; break;
          case '\r':
            i += raw[i + 2] === '\n' ? 2 : 1;
            break;
          case 'n': result += '\n'; i++; break;
          case 'r': result += '\r'; i++; break;
          case 't': result += '\t'; i++; break;
          case '\\': result += '\\'; i++; break;
          case '\'': result += '\''; i++; break;
          case '"': result += '"'; i++; break;
          case 'x': {
            if (i + 3 < raw.length) {
              const hex = raw.substring(i + 2, i + 4);
              if (/^[0-9a-fA-F]{2}$/.test(hex)) {
                result += String.fromCharCode(parseInt(hex, 16));
                i += 3;
                break;
              }
            }
            throw new ParseError('Invalid hex escape sequence', location);
          }
          case 'u': {
            if (i + 5 < raw.length) {
              const hex = raw.substring(i + 2, i + 6);
              if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                result += String.fromCodePoint(parseInt(hex, 16));
                i += 5;
                break;
              }
            }
            throw new ParseError('Invalid unicode escape sequence', location);
          }
          default:
            throw new ParseError(`Unknown escape sequence: \\${next}`, location);
        }
      } else {
        result += raw[i];
      }
    }
    return result;
  }

  createDateLiteral(ctx: LiteralContext): IntLiteralNode {
    const rawString = ctx.DateLiteral().getText();
    const stringValue = rawString.substring(6, rawString.length - 2).trim();

    if (!/^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(stringValue)) {
      throw new ParseError('Date should be in format `YYYY-MM-DDThh:mm:ss`', Location.fromCtx(ctx));
    }

    const timestamp = Math.round(Date.parse(stringValue) / 1000);

    if (Number.isNaN(timestamp)) {
      throw new ParseError(`Incorrectly formatted date "${stringValue}"`, Location.fromCtx(ctx));
    }

    const intLiteral = new IntLiteralNode(BigInt(timestamp));
    intLiteral.location = Location.fromCtx(ctx);
    return intLiteral;
  }

  createHexLiteral(ctx: LiteralContext): HexLiteralNode {
    const hexString = ctx.HexLiteral().getText();
    const hexContent = hexString.substring(2).replaceAll('_', '');
    if (this.solidityImportCompat && !hexString.includes('_')) {
      const hasHexLetter = /[a-fA-F]/.test(hexContent);
      const hasMixedCase = /[a-f]/.test(hexContent) && /[A-F]/.test(hexContent);
      if ((hexContent.length === 39 || hexContent.length === 41) && hasMixedCase) {
        throw new ParseError(
          `Address-like literal must contain exactly 40 hex digits, not ${hexContent.length}`,
          Location.fromCtx(ctx),
        );
      }
      if (hexContent.length === 40 && hasHexLetter) {
        const lower = hexContent.toLowerCase();
        const checksumHash = binToHex(keccak_256(new TextEncoder().encode(lower)));
        const checksummed = [...lower].map((char, index) =>
          /[a-f]/.test(char) && parseInt(checksumHash[index], 16) >= 8 ? char.toUpperCase() : char).join('');
        if (hexContent !== checksummed) {
          throw new ParseError(
            `Address-like literal has an invalid checksum; expected 0x${checksummed}`,
            Location.fromCtx(ctx),
          );
        }
      }
    }
    if (hexContent.length % 2 !== 0) {
      const loc = Location.fromCtx(ctx);
      const line = this.diagLine(loc.start?.line);
      // Correct the message to match the actual behaviour: the trailing nibble is ZERO-EXTENDED into a full byte
      // (0xabc -> 0xab0c), not dropped. Kept as a warning (not an error) since existing contracts rely on it.
      console.log(
        `Warning: hex literal '${hexString}'${line} has an odd number of digits; its last nibble will be `
        + `zero-extended into a full byte (0x${hexContent} -> 0x${binToHex(hexToBin(hexContent))}). `
        + 'Use an even number of hex digits.',
      );
    }
    const hexValue = hexToBin(hexContent);
    const hexLiteral = new HexLiteralNode(hexValue);
    // A bare `0x` is the empty byte sequence. JavaScript's BigInt parser rejects
    // the spelling even though the language parser accepts it, so only attach a
    // numeric interpretation when at least one digit is present.
    hexLiteral.numericValue = hexContent.length === 0
      ? undefined
      : BigInt(`0x${hexContent.replace(/_/g, '')}`);
    hexLiteral.sourceHexDigits = hexContent.length;
    hexLiteral.location = Location.fromCtx(ctx);
    return hexLiteral;
  }

  visitStateVariableDeclaration(
    ctx: StateVariableDeclarationContext,
  ): StateVariableNode | CollectionNode | ConstantDefinitionNode {
    const name = ctx.anyIdentifier().getText();

    if (name.startsWith('__internal__')) {
      throw new StateVariableNameCollisionError(name, Location.fromCtx(ctx));
    }
    // A state var may shadow a solidcash introspection built-in (age/tokens/categoryId/activeInputIndex/
    // activeBytecode) - the state var wins in scope (Solidity-like); naming one after a built-in just makes that
    // built-in inaccessible in the contract. (Default; was gated behind solidityImportCompat.)

    // Parse visibility modifier (leading position or from collectionModifier)
    let visibility = StateVariableVisibility.PUBLIC;
    let visibilityExplicit = false;
    const visCtx = ctx.stateVariableVisibility();
    if (visCtx) {
      if (this.solidityImportCompat && visCtx.getText() === 'external') {
        throw new ParseError('State variables cannot have external visibility', Location.fromCtx(visCtx));
      }
      visibility = visCtx.getText() as StateVariableVisibility;
      visibilityExplicit = true;
    }

    // Parse modifiers from modifier_list (simple state vars) or collectionModifier_list (mappings/arrays)
    const plainModifiers = ctx.modifier_list?.() ?? [];
    const collectionModifiers = (ctx as any).collectionModifier_list?.() ?? [];
    const allModTexts: string[] = plainModifiers.map((m: any) => m.getText());
    for (const cm of collectionModifiers) {
      const modChild = cm.modifier?.();
      if (modChild) { allModTexts.push(modChild.getText()); continue; }
      const visChild = cm.stateVariableVisibility?.();
      if (visChild) {
        if (this.solidityImportCompat && visChild.getText() === 'external') {
          throw new ParseError('State variables cannot have external visibility', Location.fromCtx(visChild));
        }
        visibility = visChild.getText() as StateVariableVisibility;
        visibilityExplicit = true;
      }
    }
    if (this.solidityImportCompat) {
      const mutability = allModTexts.filter((modifier) => modifier === 'constant' || modifier === 'immutable');
      if (mutability.length > 1) {
        throw new ParseError(
          `State variable mutability specified more than once (${mutability.join(', ')})`,
          Location.fromCtx(ctx),
        );
      }
    }
    const isImmutable = allModTexts.includes('immutable');
    const isConstant = allModTexts.includes('constant');
    const overrideSpec = [
      ...((ctx as any).overrideSpecifier_list?.() ?? []),
      ...plainModifiers.map((m: any) => m.overrideSpecifier?.()),
      ...collectionModifiers.map((m: any) =>
        m.overrideSpecifier?.() ?? m.modifier?.()?.overrideSpecifier?.()),
    ].find(Boolean);
    const overrideBases = overrideSpec
      ? overrideSpec.Identifier_list().map((id: any) => id.getText()) as string[]
      : [];
    const markOverride = <T extends StateVariableNode | CollectionNode>(node: T): T => {
      node.isOverride = overrideSpec !== undefined;
      node.overrideBases = overrideBases;
      return node;
    };
    const isTransient = allModTexts.includes('transient');
    const explicitStateLocation = allModTexts.find((modifier) =>
      modifier === 'storage' || modifier === 'memory' || modifier === 'calldata');
    if (this.solidityImportCompat && explicitStateLocation) {
      throw new ParseError(
        explicitStateLocation === 'storage'
          ? 'State variables are implicitly storage and cannot specify the storage data location'
          : `State variables cannot specify the '${explicitStateLocation}' data location`,
        Location.fromCtx(ctx),
      );
    }
    if (this.solidityImportCompat && isTransient
      && (allModTexts.includes('constant') || allModTexts.includes('immutable'))) {
      throw new ParseError(
        'Transient cannot be used with constant or immutable state variables',
        Location.fromCtx(ctx),
      );
    }
    if (this.solidityImportCompat && isTransient && ctx.expression?.()) {
      throw new ParseError(
        'Initialization of transient state variables is not supported',
        Location.fromCtx(ctx),
      );
    }
    if (this.solidityImportCompat && isTransient && (ctx.mappingType() || ctx.arrayType())) {
      throw new ParseError(
        'Transient data location is only supported for value types',
        Location.fromCtx(ctx),
      );
    }
    if (this.solidityImportCompat && isImmutable && (ctx.mappingType() || ctx.arrayType())) {
      throw new ParseError(
        'Immutable variables cannot have a non-value type',
        Location.fromCtx(ctx),
      );
    }
    if (this.solidityImportCompat && isConstant && !ctx.expression?.()) {
      throw new ParseError('Uninitialized constant variable', Location.fromCtx(ctx));
    }
    if (this.solidityImportCompat && isConstant && (ctx.mappingType() || ctx.arrayType())) {
      throw new ParseError(
        'Only constants of value type and byte array type are implemented',
        Location.fromCtx(ctx),
      );
    }
    if (this.solidityImportCompat && isConstant && ctx.typeName()) {
      const constantTypeText = ctx.typeName().getText();
      const resolvedConstantType = this.resolveType(constantTypeText);
      if (resolvedConstantType instanceof StructType || this.structMap.has(constantTypeText)) {
        throw new ParseError(
          'Only constants of value type and byte array type are implemented',
          Location.fromCtx(ctx),
        );
      }
    }

    // A `constant` state var (`uint public constant ONE = 5`) parses as a state variable because the dedicated
    // constantDefinition rule has no visibility slot. It is a compile-time constant, not stored state - route it
    // to the constant path so it is baked into the bytecode, not placed in the state NFT (and does not make a
    // library look state-touching). Constants are value-typed, so only the scalar form applies.
    const scalarTypeCtx = ctx.typeName();
    const constExpr = ctx.expression?.();
    if (isConstant && scalarTypeCtx && constExpr && !this.inLibraryDecl) {
      // An unresolved type name is an interface/contract type -> a tagged address handle (as every other
      // declaration site does), so `IERC20 constant U = IERC20(0)` type-checks against an address value.
      const cType = this.resolveType(scalarTypeCtx.getText()) ?? new AddressType(false, scalarTypeCtx.getText());
      const constantExpression = this.visit(constExpr) as ExpressionNode;
      if (this.solidityImportCompat) this.validateConstantZeroDivisors(constantExpression, ctx);
      const cnode = new ConstantDefinitionNode(cType, name, constantExpression);
      cnode.visibility = visibility;
      cnode.location = Location.fromCtx(ctx);
      return cnode;
    }

    // Check if this is a mapping type declaration
    const mappingTypeCtx = ctx.mappingType();
    if (mappingTypeCtx) {
      const mappingType = this.buildMappingType(mappingTypeCtx);
      const node = new CollectionNode(mappingType, name);
      node.visibility = visibility;
      node.visibilityExplicit = visibilityExplicit;
      node.immutable = isImmutable;
      // `enumerable mapping(...)`: an `enumerable` terminal before the mapping type (the mapping NAME comes after,
      // so this does not false-positive on a mapping named `enumerable`). Marks the mapping as iterable.
      const children = (ctx as unknown as { children?: { getText?: () => string }[] }).children ?? [];
      const mapPos = children.indexOf(mappingTypeCtx as unknown as { getText?: () => string });
      node.enumerable = mapPos > 0 && children.slice(0, mapPos).some((c) => c.getText?.() === 'enumerable');
      node.location = Location.fromCtx(ctx);
      return markOverride(node);
    }

    // Check if this is an array type declaration
    const arrayTypeCtx = ctx.arrayType();
    if (arrayTypeCtx) {
      const arrayT = this.buildArrayType(arrayTypeCtx);
      const isPacked = allModTexts.includes('packed');

      if (isPacked) {
        // Packed array: store as a single blob in a data NFT (state variable)
        const node = new StateVariableNode(arrayT, name);
        node.isPacked = true;
        node.visibility = visibility;
        node.visibilityExplicit = visibilityExplicit;
        node.immutable = isImmutable;
        node.location = Location.fromCtx(ctx);
        return markOverride(node);
      }

      // Chunk-packed array (behind chunkedArrays, default on): an unbounded `T[]` with a chunk-packable element
      // type becomes a dense chunk-backed dynamic state variable (uint32 length header + chunk UTXOs), reusing
      // the string/bytes machinery. Struct/nested-array elements and bounded arrays keep the collection model.
      // See docs/arrays.md.
      if (this.chunkedArrays && arrayT.bound === undefined && isChunkPackableElementType(arrayT.elementType)) {
        const node = new StateVariableNode(arrayT, name);
        node.isDynamic = true;
        node.visibility = visibility;
        node.visibilityExplicit = visibilityExplicit;
        node.immutable = isImmutable;
        node.location = Location.fromCtx(ctx);
        return markOverride(node);
      }

      // Solidity-import compat: a BOUNDED value-type array T[N] is contiguous packed storage in Solidity. Model
      // it as a packed state-var blob (not an entry-NFT collection) so a fixed address[N]/uint[N] reads as one
      // field - this backs `arr.length`, whole-array copy/reads, and array-element external calls IFoo(arr[i]).m()
      // over a fixed token set (StableSwap). Native (non-compat) keeps the collection model, which has no bare
      // array reference / `.length`; kept gated because switching to it REMOVES those features. See docs/arrays.md.
      if (this.solidityImportCompat && arrayT.bound !== undefined && isChunkPackableElementType(arrayT.elementType)) {
        const node = new StateVariableNode(arrayT, name);
        node.isPacked = true;
        node.visibility = visibility;
        node.visibilityExplicit = visibilityExplicit;
        node.immutable = isImmutable;
        node.location = Location.fromCtx(ctx);
        return markOverride(node);
      }

      // Non-packed array: store as entry NFTs (collection)
      const node = new CollectionNode(arrayT, name);
      node.visibility = visibility;
      node.visibilityExplicit = visibilityExplicit;
      node.immutable = isImmutable;
      node.location = Location.fromCtx(ctx);
      return markOverride(node);
    }

    const typeText = ctx.typeName().getText();
    let type = this.resolveType(typeText);
    let contractTypeName: string | undefined;
    if (!type) {
      // Unknown type - treat as contract/interface reference (validated in SymbolTableTraversal). Tag the
      // address handle with the name so `IERC20 token; token.transferFrom(..)` routes to an external call.
      type = new AddressType(false, typeText);
      contractTypeName = typeText;
    }
    if (this.solidityImportCompat && isImmutable
      && (type instanceof StructType || (type instanceof FunctionType && type.isExternal) || type instanceof MappingType
        || type instanceof ArrayType || type === PrimitiveType.STRING
        || (type instanceof BytesType && type.bound === undefined))) {
      throw new ParseError(
        type instanceof FunctionType
          ? 'Immutable variables of external function type are not supported'
          : 'Immutable variables cannot have a non-value type',
        Location.fromCtx(ctx),
      );
    }
    if (this.solidityImportCompat && isTransient
      && (type instanceof StructType || type instanceof MappingType || type instanceof ArrayType
        || (type instanceof BytesType && type.bound === undefined) || type === PrimitiveType.STRING)) {
      throw new ParseError(
        'Transient data location is only supported for value types',
        Location.fromCtx(ctx),
      );
    }
    if (this.solidityImportCompat && type instanceof FunctionType) {
      const functionModifierText = (): string => {
        const open = typeText.indexOf('(');
        let depth = 0;
        for (let i = open; i < typeText.length; i++) {
          if (typeText[i] === '(') depth += 1;
          else if (typeText[i] === ')' && --depth === 0) {
            const returnsAt = typeText.indexOf('returns(', i + 1);
            return typeText.slice(i + 1, returnsAt < 0 ? undefined : returnsAt);
          }
        }
        return '';
      };
      const containsInternalFunction = (candidate: Type): boolean =>
        candidate instanceof FunctionType
          && (!candidate.isExternal
            || candidate.parameterTypes.some(containsInternalFunction)
            || candidate.returnTypes.some(containsInternalFunction));
      if (functionModifierText().includes('payable') && !type.isExternal) {
        throw new ParseError('Only external function types can be payable', Location.fromCtx(ctx));
      }
      if (type.isExternal
        && [...type.parameterTypes, ...type.returnTypes].some(containsInternalFunction)) {
        throw new ParseError('Internal function types cannot be used inside an external function type',
          Location.fromCtx(ctx));
      }
      if (visibilityExplicit
        && (visibility === StateVariableVisibility.PUBLIC || visibility === StateVariableVisibility.EXTERNAL)
        && !type.isExternal) {
        throw new ParseError('Internal function types cannot be exposed by public state variables',
          Location.fromCtx(ctx));
      }
    }
    const node = new StateVariableNode(type, name);
    if (contractTypeName) node.contractTypeName = contractTypeName;
    node.visibility = visibility;
    node.visibilityExplicit = visibilityExplicit;
    node.immutable = isImmutable;
    node.isTransient = isTransient; // lowered to a per-function local in visitContract
    const initCtx = ctx.expression?.();
    if (initCtx) {
      let qualifiedInitializerRead: StateAccessNode | undefined;
      if ((ctx as any)._sop) {
        const loc = Location.fromCtx(ctx);
        const { links, valueCtx } = this.unrollAssignChain(
          initCtx, (ctx as any)._sop.text, (ctx as any).assignChain(),
        );
        node.initializerPrelude = this.buildAssignChainStatements(links, valueCtx, loc);
        const outerTarget = this.extractLvalue(initCtx);
        if (outerTarget && !outerTarget.isThis && outerTarget.segs.length === 1
          && outerTarget.segs[0].member
          && (outerTarget.rawName === this.currentContractName
            || this.currentContractBaseNames.has(outerTarget.rawName))) {
          qualifiedInitializerRead = new StateAccessNode(outerTarget.segs[0].member);
          qualifiedInitializerRead.location = loc;
        }
      }
      node.initializer = qualifiedInitializerRead ?? this.visit(initCtx) as ExpressionNode;
    }
    node.location = Location.fromCtx(ctx);
    return markOverride(node);
  }

  visitStateAccess(ctx: StateAccessContext): StateAccessNode {
    const name = ctx.Identifier().getText();
    const node = new StateAccessNode(name);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // Solidity `this` (e.g. address(this)): the contract's address is the locking script of the UTXO being
  // spent, i.e. tx.inputs[this.activeInputIndex].lockingBytecode (OP_INPUTINDEX OP_UTXOBYTECODE).
  visitThisExpr(ctx: ThisExprContext): UnaryOpNode {
    if (this.solidityImportCompat && this.parsingFreeFunctionBody) {
      throw new ParseError(
        "'this' is not available in a file-level free function",
        Location.fromCtx(ctx),
      );
    }
    const index = new NullaryOpNode(NullaryOperator.INPUT_INDEX);
    index.location = Location.fromCtx(ctx);
    const node = new UnaryOpNode(UnaryOperator.INPUT_LOCKING_BYTECODE, index);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // The struct type holding each field of a chain ([T0, T1, .., T(n-1)]), or undefined if `chain` is not a
  // valid struct field path from `t0` (each non-final field must itself be a struct). Used to gate the
  // field-chain rebuild desugar.
  private chainStructTypes(t0: StructType, chain: string[]): StructType[] | undefined {
    const types: StructType[] = [];
    let cur: StructType | undefined = t0;
    for (let i = 0; i < chain.length; i++) {
      if (!cur || !cur.fields.some((x) => x.name === chain[i])) return undefined;
      types.push(cur);
      if (i < chain.length - 1) cur = this.resolveFieldStruct(cur, chain[i]);
    }
    return types;
  }

  // The StructType of field `field` in struct `t`, resolving a placeholder (unresolved-name) field type via the
  // struct registry.
  private resolveFieldStruct(t: StructType, field: string): StructType | undefined {
    const ft = t.fields.find((x) => x.name === field)?.type;
    if (ft instanceof StructType) return ft;
    if (ft instanceof AddressType && ft.interfaceName) return this.structMap.get(ft.interfaceName);
    return undefined;
  }

  // Resolve a type to its StructType (directly, or via an interface-name placeholder for a defined-later struct).
  private structFromType(t: Type): StructType | undefined {
    if (t instanceof StructType) return t;
    if (t instanceof AddressType && t.interfaceName) return this.structMap.get(t.interfaceName);
    return undefined;
  }

  // Unified lvalue assignment: `this.x`, `this.m[k]`, `this.m[k].f`, `m[k]`, `m[k].f`, `m[k1][k2]` (with any
  // compound op). The lvalue shape selects the assignment node; semantic analysis routes state vs local. A
  // numKeys-0 lvalue is always `this.<scalar>` (the bare-scalar form lives in assignStatement).
  // Build the assignment / compound-assign / inc-dec statement for an lvalue described by (rawName, isThis, segs)
  // - the interleaved member/index chain - with operator `op` and value expression `valueCtx`. Driven by
  // visitExpressionStatement / visitPrefixIncDecStatement, which reconstruct the segments from the parsed LHS
  // expression (extractLvalue). The per-kind flat lists (members/keyFns) and interleaved segs are derived here.
  private buildLvalueAssign(
    rawName: string, isThis: boolean, nameLoc: Location, segs: LvSeg[],
    op: string, valueCtx: ExpressionContext | undefined, loc: Location, valueNode?: ExpressionNode,
  ): StatementNode {
    const qualifiedBaseAccess = !isThis && this.currentContractBaseNames.has(rawName);
    // Solidity permits the current contract type as a qualifier for a state variable (`C.x = value`). Strip the
    // qualifier before lvalue classification; otherwise the generic member fallback mistakes `C` for a mapping.
    if (!isThis && (rawName === this.currentContractName || this.currentContractBaseNames.has(rawName))
      && segs[0]?.member) {
      rawName = segs[0].member;
      segs = segs.slice(1);
    }
    // Recursively-flattened struct state: collapse leading members that descend through flattened struct
    // fields into the name (`str.nstr.nestedValue` -> rawName `str__nstr`, member `nestedValue`), so the
    // one-level flattened-write paths below apply unchanged at any depth.
    if (!isThis) {
      while (segs.length > 1 && segs[0].member !== undefined && this.mappingStructStateVars.has(rawName)) {
        // `segs` is replaced only after this synchronous lookup completes; the callback never escapes the loop.
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        const field = this.mappingStructStateVars.get(rawName)!.fields.find((f) => f.name === segs[0].member);
        if (!field || !(field.type instanceof StructType) || !this.structNeedsFieldFlattening(field.type)) break;
        rawName = `${rawName}__${segs[0].member}`;
        segs = segs.slice(1);
      }
    }
    // Rebinding a whole-mapping storage pointer changes the compile-time access path for following statements;
    // the pointer itself has no runtime representation. Do this before substituting indexed uses so
    // `mapping(...) storage p = a; p = b; p[k] = v` routes the final write to b.
    if (!isThis && segs.length === 0 && op === '=' && this.storageAliases.has(rawName) && valueCtx) {
      const alias = this.storageAliases.get(rawName)!;
      const rhs = valueNode ?? this.visit(valueCtx) as ExpressionNode;
      this.validateStorageReferenceBinding(rawName, this.storageReferenceTypes.get(rawName)!, rhs);
      if (alias.keys.length === 0 && rhs instanceof IdentifierNode && this.mappingStateVarTypes.has(rhs.name)) {
        this.storageAliases.set(rawName, { container: rhs.name, keys: [], access: rhs });
        const dropped = new BlockNode([]);
        dropped.location = loc;
        return dropped;
      }
    }

    // Whole-var storage alias to a struct STATE var (`S storage sL = s; sL.f = v` / `sL = ..`):
    // substitute the container so the write routes through s's own state paths - matching the direct bare form,
    // NOT a local copy that would silently drop the write. Flattened structs then use their normal leaf routing.
    if (!isThis) {
      const alias = this.storageAliases.get(rawName);
      if (alias && alias.keys.length === 0
        && (this.stateVarNames.has(alias.container) || this.mappingStructStateVars.has(alias.container))) {
        rawName = alias.container;
      }
    }

    const members = segs.filter((s) => s.member !== undefined).map((s) => s.member!);
    const keyFns = segs.filter((s) => s.key !== undefined).map((s) => s.key!);
    const hasMember = members.length > 0;
    const fieldName = hasMember ? members[0] : undefined;
    const isIncDec = op === '++' || op === '--';

    // Whole assign to a flattened struct STATE var (`s = S(..)` / `s = m[k]` / `s = otherStateStruct`): the var
    // has no single-value slot, so decompose into per-field state writes `s__f = <value.f>` (mirror of the
    // whole-entry write). Restricted to a DIRECT state var - a reassigned whole-var storage alias
    // (`S storage sLocal = s; sLocal = m[k]`) does not lower correctly here, so it is left to fail rather than
    // miscompile. Falls through (returns null) when the value is not a resolvable whole-struct value.
    if (!isThis && segs.length === 0 && op === '=' && valueCtx && !this.storageAliases.has(rawName)) {
      const t = this.mappingStructStateVars.get(rawName);
      if (t) {
        const rhs = this.extractLvalue(valueCtx);
        if (rhs && !rhs.isThis && rhs.segs.length === 0
          && this.mappingStructStateVars.get(rhs.rawName) === t) {
          const statements: StatementNode[] = [];
          for (const field of t.fields) {
            if (field.type instanceof MappingType) continue;
            const dstName = `${rawName}__${field.name}`;
            const srcName = `${rhs.rawName}__${field.name}`;
            if (field.type instanceof ArrayType && field.type.bound !== undefined) {
              for (let index = 0; index < field.type.bound; index += 1) {
                const dstKey = new IntLiteralNode(BigInt(index)); dstKey.location = loc;
                const srcKey = new IntLiteralNode(BigInt(index)); srcKey.location = loc;
                const read = new MappingAccessNode(srcName, [srcKey]); read.location = loc;
                const write = new MappingAssignNode(dstName, [dstKey], read); write.location = loc;
                statements.push(write);
              }
            } else {
              const read = new StateAccessNode(srcName); read.location = loc;
              const write = new StateAssignNode(dstName, read); write.location = loc;
              statements.push(write);
            }
          }
          const block = new BlockNode(statements);
          block.location = loc;
          return block;
        }
        const decomposed = this.decomposeStructCtorToStateWrites(rawName, t, valueCtx, loc);
        if (decomposed) return decomposed;
      }
    }

    // Bare local scalar `x op= v` / `x++` (no `this.`, no index/member): a plain local assignment. (The old
    // assignmentStatement grammar required an lvPart for the bare-Identifier form, so this fell to assignStatement;
    // left-factored, it now arrives here.) An unqualified name that is actually a state var / collection is
    // resolved downstream by semantic analysis, same as assignStatement's AssignNode.
    if (!isThis && segs.length === 0) {
      const assign = this.buildCompoundAssign(rawName, nameLoc, op, valueCtx ?? null, loc);
      if (qualifiedBaseAccess && assign instanceof AssignNode) assign.qualifiedBaseAccess = true;
      return assign;
    }

    // Bytes var element write `data[i] op= v` (state OR local/memory) -> reassign the whole blob with byte i
    // replaced: `data = data[0:i] ++ (data[i] op v) ++ data[i+1:]` (plain `=` uses v directly). Reuses the bytes
    // slice/concat codegen (like .push/.pop). ++/-- excluded (isIncDec) - byte inc/dec is not a Solidity form.
    if (!isThis && !isIncDec && !hasMember && keyFns.length === 1 && valueCtx
      && (this.bytesStateVarNames.has(rawName) || this.localBytesVars.has(rawName))) {
      const isState = this.bytesStateVarNames.has(rawName);
      // A LOCAL bytes plain `=` element write stays a raw ArrayAssignNode: LowerMemoryModel lowers it to a single-
      // byte splice when the buffer is a __yulmem pointer, and DesugarLocalBytesElementWrite value-copies (the
      // whole-blob rebuild) the ones that fall back. State bytes and compound ops keep the rebuild directly.
      if (!isState && op === '=') {
        const aa = new ArrayAssignNode(rawName, keyFns[0](), this.visit(valueCtx) as ExpressionNode);
        aa.location = loc;
        return aa;
      }
      return this.desugarBytesElementWrite(
        rawName, keyFns[0], this.visit(valueCtx) as ExpressionNode, loc, isState, op);
    }

    // Whole-ENTRY write with a struct-CONSTRUCTOR value (`m[k] = S({b:.., a:.., u:..})` / `m[k] = S(b, a, u)`):
    // decompose into per-field entry writes, each field's value taken from the matching constructor argument
    // (by name for the `{..}` form, by position otherwise). Mapping fields have no constructor value (skipped).
    if (!isThis && !isIncDec && !hasMember && keyFns.length > 0 && valueCtx && op === '='
      && this.mappingStructValueVars.has(rawName)) {
      const valStruct = this.mappingStructValueVars.get(rawName)!;
      const decomposed = this.decomposeStructCtorToEntryWrites(rawName, valStruct, keyFns, valueCtx, loc);
      if (decomposed) return decomposed;
    }

    // Whole-ENTRY write of a flattened-value mapping (`m[0] = s;`): decompose into per-field entry writes
    // `m__f[keys] = <value.f>`. The value must be another flattened struct state var (directly or through a
    // whole-var storage alias) or a plain local struct; mapping fields keep the entry's own (no value form).
    // One level only - the collection flatten expands direct fields.
    if (!isThis && !isIncDec && !hasMember && keyFns.length > 0 && valueCtx && op === '='
      && this.mappingStructValueVars.has(rawName)) {
      const valStruct = this.mappingStructValueVars.get(rawName)!;
      const vlv = this.extractLvalue(valueCtx);
      if (vlv && !vlv.isThis && vlv.segs.length === 0
        && !valStruct.fields.some((f) => f.type instanceof StructType && this.structNeedsFieldFlattening(f.type))) {
        let vName = vlv.rawName;
        const alias = this.storageAliases.get(vName);
        if (alias && alias.keys.length === 0) vName = alias.container;
        const isFlattenedState = this.mappingStructStateVars.has(vName);
        const isLocalStruct = !isFlattenedState && this.localStructTypes.has(vName);
        if (isFlattenedState || isLocalStruct) {
          const stmts: StatementNode[] = [];
          for (const f of valStruct.fields) {
            if (f.type instanceof MappingType) continue;
            let value: ExpressionNode;
            if (isFlattenedState) {
              value = new IdentifierNode(`${vName}__${f.name}`);
              value.location = loc;
            } else {
              const base = new IdentifierNode(vName);
              base.location = loc;
              value = new FieldAccessNode(base, f.name);
              value.location = loc;
            }
            const assign = new MappingAssignNode(`${rawName}__${f.name}`, keyFns.map((k) => k()), value);
            assign.location = loc;
            stmts.push(assign);
          }
          const block = new BlockNode(stmts);
          block.location = loc;
          return block;
        }
      }
    }

    // Mapping-of-flattened-struct write: `providers[k].data[k2] op= v` / `providers[k].data[k2].valid op= v` /
    // `providers[k].scalar op= v` -> the flattened nested state mapping `providers__<field>` with all keys and a
    // trailing scalar field. All the index keys index the flattened nested mapping (outer key + field-mapping key).
    if (!isThis && !isIncDec && fieldName && this.mappingStructValueVars.has(rawName)
      && this.mappingStructValueVars.get(rawName)!.fields.some((f) => f.name === fieldName)) {
      const flatName = `${rawName}__${fieldName}`;
      const trailing = members.slice(1); // field chain into the flattened mapping's value struct
      const keys = (): ExpressionNode[] => keyFns.map((fn) => fn());
      if (trailing.length <= 1) {
        const read = (): ExpressionNode => {
          const acc = new MappingAccessNode(flatName, keys());
          acc.location = nameLoc;
          if (trailing.length === 0) return acc;
          const fa = new FieldAccessNode(acc, trailing[0]);
          fa.location = loc;
          return fa;
        };
        const value = op === '=' ? (valueNode ?? this.visit(valueCtx!) as ExpressionNode)
          : this.compoundRhs(read(), op, valueCtx, loc);
        const assign = trailing.length === 0
          ? new MappingAssignNode(flatName, keys(), value)
          : new MappingFieldAssignNode(flatName, keys(), trailing[0], value);
        assign.location = loc;
        return assign;
      }
    }

    // Mapping-bearing struct field write: `<var>.<field>[k...] op= v` -> write the flattened state collection
    // `<var>__<field>` (it is a state mapping). Handles `=` and compound ops.
    if (!isThis && !isIncDec && fieldName && keyFns.length > 0 && this.mappingStructStateVars.has(rawName)) {
      const field = this.mappingStructStateVars.get(rawName)!.fields.find((f) => f.name === fieldName);
      if (field && field.type instanceof MappingType) {
        const flatName = `${rawName}__${fieldName}`;
        const flatKeys = (): ExpressionNode[] => keyFns.map((fn) => fn());
        // Trailing scalar member into the mapping value struct: `o.data[k].valid op= v` -> a field write on the
        // flattened mapping (same shape as `m[k].field op= v`). Depth-1 scalar field of the value struct only.
        if (members.length === 2) {
          const valueStruct = this.structFromType(field.type.valueType);
          const vf = valueStruct?.fields.find((f) => f.name === members[1]);
          if (vf && !(vf.type instanceof MappingType) && !(vf.type instanceof ArrayType)) {
            const value = op === '='
              ? (valueNode ?? this.visit(valueCtx!) as ExpressionNode)
              : this.compoundRhs((() => {
                const acc = new MappingAccessNode(flatName, flatKeys());
                acc.location = nameLoc;
                const fa = new FieldAccessNode(acc, members[1]);
                fa.location = loc;
                return fa;
              })(), op, valueCtx, loc);
            // A mapping whose value struct is itself flattened has no aggregate entry at `flatName`; route its
            // scalar member to the concrete per-field collection (`flatName__member`).
            const assign = valueStruct && this.structNeedsFieldFlattening(valueStruct)
              ? new MappingAssignNode(`${flatName}__${members[1]}`, flatKeys(), value)
              : new MappingFieldAssignNode(flatName, flatKeys(), members[1], value);
            assign.location = loc;
            return assign;
          }
        }
        if (members.length === 1) {
          const value = op === '='
            ? (valueNode ?? this.visit(valueCtx!) as ExpressionNode)
            : this.compoundRhs((() => {
              const m = new MappingAccessNode(flatName, flatKeys());
              m.location = nameLoc;
              return m;
            })(), op, valueCtx, loc);
          const assign = new MappingAssignNode(flatName, flatKeys(), value);
          assign.location = loc;
          return assign;
        }
      }
      if (field && field.type instanceof ArrayType && keyFns.length === 1) {
        const flatName = `${rawName}__${fieldName}`;
        const key = (): ExpressionNode => keyFns[0]();
        const elementStruct = field.type.elementType instanceof StructType ? field.type.elementType : undefined;
        const selected = (): ArrayAccessNode => {
          const id = new IdentifierNode(flatName); id.location = nameLoc;
          const a = new ArrayAccessNode(id, key()); a.location = nameLoc; return a;
        };
        let value: ExpressionNode;
        if (elementStruct && members.length === 2
          && elementStruct.fields.some((f) => f.name === members[1])) {
          const leafRead = new FieldAccessNode(selected(), members[1]); leafRead.location = loc;
          const leafValue = op === '='
            ? (valueNode ?? this.visit(valueCtx!) as ExpressionNode)
            : this.compoundRhs(leafRead, op, valueCtx, loc);
          const ctorId = new IdentifierNode(elementStruct.name); ctorId.location = nameLoc;
          value = new FunctionCallNode(ctorId, elementStruct.fields.map((f) => {
            if (f.name === members[1]) return leafValue;
            const read = new FieldAccessNode(selected(), f.name); read.location = loc; return read;
          }));
          value.location = loc;
        } else {
          value = op === '='
            ? (valueNode ?? this.visit(valueCtx!) as ExpressionNode)
            : this.compoundRhs(selected(), op, valueCtx, loc);
        }
        const isChunkDynamic = this.chunkedArrays && field.type.bound === undefined
          && isChunkPackableElementType(field.type.elementType);
        const assign = isChunkDynamic
          ? new StateArrayAssignNode(flatName, key(), value)
          : new MappingAssignNode(flatName, [key()], value);
        assign.location = loc;
        return assign;
      }
    }

    // Mapping-bearing struct SCALAR/bytes field write `<var>.<field> op= v` (no key) -> the flattened state var
    // `<var>__<field>` (reads already resolve this way at visitFieldAccess). Mapping/array fields (with a key)
    // are handled above; nested field chains fall through to the rebuild path below.
    if (!isThis && fieldName && members.length === 1 && keyFns.length === 0
      && this.mappingStructStateVars.has(rawName)) {
      const field = this.mappingStructStateVars.get(rawName)!.fields.find((f) => f.name === fieldName);
      // A fixed-array leaf is represented as one collection entry per index. Decompose a whole array literal
      // assignment into those same writes rather than looking for a nonexistent aggregate state slot.
      if (field?.type instanceof ArrayType && field.type.bound !== undefined && op === '=') {
        const rhs = valueNode ?? this.visit(valueCtx!) as ExpressionNode;
        if (rhs instanceof ArrayNode && rhs.elements.length === field.type.bound) {
          const flatName = `${rawName}__${fieldName}`;
          const statements = rhs.elements.map((element, index) => {
            const key = new IntLiteralNode(BigInt(index)); key.location = loc;
            const assign = new MappingAssignNode(flatName, [key], element);
            assign.location = loc;
            return assign;
          });
          const block = new BlockNode(statements);
          block.location = loc;
          return block;
        }
      }
      // A flattened-struct field has no single state element; a whole-subtree assign must not route to the
      // scalar path (it falls through to the rebuild path's diagnostics). A chunk-dynamic ARRAY leaf is a
      // whole state var of its own, so a whole-field assign (`s.a = arr;`) routes here too; collection-model
      // array leaves stay excluded.
      const isChunkDynArrayLeaf = field?.type instanceof ArrayType && this.chunkedArrays
        && field.type.bound === undefined && isChunkPackableElementType(field.type.elementType);
      if (field && !(field.type instanceof MappingType)
        && (!(field.type instanceof ArrayType) || isChunkDynArrayLeaf)
        && !(field.type instanceof StructType && this.structNeedsFieldFlattening(field.type))) {
        const flatName = `${rawName}__${fieldName}`;
        const value = op === '='
          ? (valueNode ?? this.visit(valueCtx!) as ExpressionNode)
          : this.compoundRhs((() => {
            const a = new StateAccessNode(flatName);
            a.location = nameLoc;
            return a;
          })(), op, valueCtx, loc);
        const assign = new StateAssignNode(flatName, value);
        assign.location = loc;
        return assign;
      }
    }

    // Local struct ARRAY-field element write `s.arr[i] op= v` / nested `s.arr[i][j] op= v` (member then index/es):
    // struct fields have no in-place element write, so read-modify-rebuild via buildLocalStructArrayFieldWrite.
    // A multi-index write lowers the temp element write to a MappingAssign (DesugarNestedArrayWrite handles it).
    if (!isThis && fieldName && members.length === 1 && keyFns.length >= 1
      && segs.length === keyFns.length + 1 && segs[0].member !== undefined && this.localStructTypes.has(rawName)) {
      const field = this.localStructTypes.get(rawName)!.fields.find((f) => f.name === fieldName);
      if (field && field.type instanceof ArrayType) {
        return this.buildLocalStructArrayFieldWrite(rawName, fieldName, field.type,
          keyFns, op, valueCtx, loc, valueNode);
      }
    }

    // STATE-struct ARRAY-field element write `m_x.a[i] op= v`: a whole-value struct state var has no in-place
    // element write - read the struct into a temp, write the element on the temp, write the struct back:
    // `X __t = m_x; __t.a[i] = v; m_x = __t;` (mirrors the mapping-entry roundtrip below).
    if (!isThis && !isIncDec && fieldName && members.length === 1 && keyFns.length === 1
      && segs.length === 2 && segs[0].member !== undefined
      && !this.localStructTypes.has(rawName) && this.stateStructVars.has(rawName)) {
      const structT = this.stateStructVars.get(rawName)!;
      const field = structT.fields.find((f) => f.name === fieldName);
      if (field && field.type instanceof ArrayType) {
        const idAt = (n: string): IdentifierNode => { const i = new IdentifierNode(n); i.location = loc; return i; };
        const tmpName = `__nlv_${this.nestedLvalueCounter++}`;
        const stateRead = new StateAccessNode(rawName);
        stateRead.location = nameLoc;
        const decl = new VariableDefinitionNode(structT, [], tmpName, stateRead);
        decl.location = loc;
        this.localStructTypes.set(tmpName, structT); // so the array-field write helper resolves the temp's type
        const inner = this.buildLocalStructArrayFieldWrite(tmpName, fieldName, field.type,
          [() => keyFns[0]()], op, valueCtx, loc, valueNode);
        const back = new StateAssignNode(rawName, idAt(tmpName));
        back.location = loc;
        const block = new BlockNode([decl, ...(inner.statements ?? []), back]);
        block.location = loc;
        return block;
      }
    }

    // State mapping -> struct -> array-field element write `m[i].arr[j] op= v` (index, member, index): the mapping
    // value struct has no in-place element write, so read the entry struct into a temp, write the array element
    // (the local-struct desugar above, on the temp), and write the struct back: `S t = m[i]; t.arr[j] = v; m[i] = t`.
    if (!isThis && !isIncDec && fieldName && members.length === 1 && keyFns.length === 2
      && segs.length === 3 && segs[0].key !== undefined && segs[1].member !== undefined
      && segs[2].key !== undefined && this.stateMappingValueStruct.has(rawName)) {
      const structT = this.stateMappingValueStruct.get(rawName)!;
      const field = structT.fields.find((f) => f.name === fieldName);
      if (field && field.type instanceof ArrayType) {
        const idAt = (n: string): IdentifierNode => { const i = new IdentifierNode(n); i.location = loc; return i; };
        const tmpName = `__nlv_${this.nestedLvalueCounter++}`;
        const mapKey = (): ExpressionNode => keyFns[0]();
        const mapRead = new MappingAccessNode(rawName, [mapKey()]);
        mapRead.location = nameLoc;
        const decl = new VariableDefinitionNode(structT, [], tmpName, mapRead);
        decl.location = loc;
        this.localStructTypes.set(tmpName, structT); // so the array-field write helper resolves the temp's type
        const inner = this.buildLocalStructArrayFieldWrite(tmpName, fieldName, field.type,
          [() => keyFns[1]()], op, valueCtx, loc, valueNode);
        const back = new MappingAssignNode(rawName, [mapKey()], idAt(tmpName));
        back.location = loc;
        const block = new BlockNode([decl, ...(inner.statements ?? []), back]);
        block.location = loc;
        return block;
      }
    }

    // Struct-ARRAY -> array-field element write `X[i].c[j] op= v` (index, member, index) where X is a state or
    // local struct array and c is an array field. Struct-array elements have no in-place field-array write, so
    // mirror the mapping case: read the element struct into a temp, write the array element on the temp, write
    // the whole element back - `S t = X[i]; t.c[j] = v; X[i] = t;` (bare-element read/write resolve state-or-local).
    if (!isThis && !isIncDec && fieldName && members.length === 1 && keyFns.length === 2
      && segs.length === 3 && segs[0].key !== undefined && segs[1].member !== undefined && segs[2].key !== undefined) {
      const stateElem = this.stateArrayVarTypes.get(rawName)?.elementType;
      const structT = stateElem instanceof StructType ? stateElem : this.localStructArrayTypes.get(rawName);
      const field = structT?.fields.find((f) => f.name === fieldName);
      if (structT && field && field.type instanceof ArrayType) {
        const idAt = (n: string): IdentifierNode => { const i = new IdentifierNode(n); i.location = loc; return i; };
        const tmpName = `__nlv_${this.nestedLvalueCounter++}`;
        const elemRead = new ArrayAccessNode(idAt(rawName), keyFns[0]());
        elemRead.location = nameLoc;
        const decl = new VariableDefinitionNode(structT, [], tmpName, elemRead);
        decl.location = loc;
        this.localStructTypes.set(tmpName, structT); // so the array-field write helper resolves the temp's type
        const inner = this.buildLocalStructArrayFieldWrite(tmpName, fieldName, field.type,
          [() => keyFns[1]()], op, valueCtx, loc, valueNode);
        const back = new ArrayAssignNode(rawName, keyFns[0](), idAt(tmpName));
        back.location = loc;
        const block = new BlockNode([decl, ...(inner.statements ?? []), back]);
        block.location = loc;
        return block;
      }
    }

    // Struct field-chain write `<base>.f1.f2...fn op= v` where base is a local or state struct variable (no
    // index, no alias). Struct fields have no in-place write codegen, so rebuild the base value from the
    // innermost field outward and assign it back: `base = T(base.g0, .., (g==f1 ? <rebuilt f1> : base.g), ..)`.
    // Recurses for nested chains (`b.a.x = v`, `this.d.a.x = v`).
    // Struct field-chain write `<base>.f1..fn op= v` (no index/alias): rebuild the base with the field replaced
    // and assign it back (struct fields have no in-place write codegen). See buildStructFieldRebuild.
    if (keyFns.length === 0) {
      const rebuilt = this.buildStructFieldRebuild(rawName, nameLoc, members, isThis, loc,
        (chainRead) => (op === '='
          ? (valueNode ?? this.visit(valueCtx!) as ExpressionNode)
          : this.compoundRhs(chainRead, op, valueCtx, loc)));
      if (rebuilt) return rebuilt;
    }

    // Storage-pointer write: `alias.field op= v` (or `alias[k]... op= v`) -> rewrite to the aliased container
    // access `container[aliasKeys, ...indexKeys]`. The alias is always an unambiguous state location.
    const alias = !isThis ? this.storageAliases.get(rawName) : undefined;
    const name = alias ? alias.container : rawName;

    // Storage-pointer alias to a mapping-value struct, ARRAY-field element write: `p.arr[j] op= v` where
    // `T storage p = m[k]` (e.g. Unicrow's `escrow.split[WHO] = v` on `Escrow storage escrow = escrows[id]`).
    // The trailing `[j]` indexes the array FIELD, not the mapping, so route it through the mapping-value-struct
    // roundtrip (read entry into a temp, write the element, write back) like the direct `m[k].arr[j]` form -
    // NOT the alias key-merge below (which would treat `j` as a second mapping key).
    if (!isThis && !isIncDec && alias && fieldName && members.length === 1 && keyFns.length === 1
      && segs.length === 2 && segs[0].member !== undefined && segs[1].key !== undefined
      && this.stateMappingValueStruct.has(alias.container) && alias.keys.length === 1) {
      const structT = this.stateMappingValueStruct.get(alias.container)!;
      const field = structT.fields.find((f) => f.name === fieldName);
      if (field && field.type instanceof ArrayType) {
        const idAt = (n: string): IdentifierNode => { const i = new IdentifierNode(n); i.location = loc; return i; };
        const tmpName = `__nlv_${this.nestedLvalueCounter++}`;
        const mapKey = (): ExpressionNode => cloneNode(alias.keys[0]) as ExpressionNode;
        const mapRead = new MappingAccessNode(alias.container, [mapKey()]);
        mapRead.location = nameLoc;
        const decl = new VariableDefinitionNode(structT, [], tmpName, mapRead);
        decl.location = loc;
        this.localStructTypes.set(tmpName, structT); // so the array-field write helper resolves the temp's type
        const inner = this.buildLocalStructArrayFieldWrite(tmpName, fieldName, field.type,
          [() => keyFns[0]()], op, valueCtx, loc, valueNode);
        const back = new MappingAssignNode(alias.container, [mapKey()], idAt(tmpName));
        back.location = loc;
        const block = new BlockNode([decl, ...(inner.statements ?? []), back]);
        block.location = loc;
        return block;
      }
    }

    // Build the key list fresh each call (read + assign nodes must not share key node instances).
    const buildKeys = (): ExpressionNode[] => {
      const idxKeys = keyFns.map((fn) => fn());
      return alias ? [...alias.keys.map((k) => cloneNode(k)), ...idxKeys] : idxKeys;
    };
    const keys = buildKeys();

    // Element-field write on a chunk-packed/packed struct state array: `arr[i].field op= v` (directly or via a
    // storage-pointer alias). Chunk-packed arrays have no in-place element-field write, so rebuild the whole
    // element: `arr[i] = T(arr[i].f0, .., new, ..)`, reusing the element read + whole-element assign.
    const structArrayElem = hasMember && keys.length === 1 ? this.packedStructArrayElems.get(name) : undefined;
    if (structArrayElem && structArrayElem.fields.some((f) => f.name === fieldName)) {
      const fieldRead = (field: string): ExpressionNode => {
        const baseId = new IdentifierNode(name);
        baseId.location = nameLoc;
        const acc = new ArrayAccessNode(baseId, buildKeys()[0]);
        acc.location = nameLoc;
        const fa = new FieldAccessNode(acc, field);
        fa.location = loc;
        return fa;
      };
      // A nested-field write (`arr[i].roles.creator = v`, members = [roles, creator]) reads/writes the LEAF; the
      // value placed at the `roles` position must be the REBUILT nested struct, not the raw leaf value.
      const leafRead = (): ExpressionNode => {
        let r = fieldRead(members[0]);
        for (const m of members.slice(1)) {
          const fa = new FieldAccessNode(r, m);
          fa.location = loc;
          r = fa;
        }
        return r;
      };
      const rawValue = op === '='
        ? (valueNode ?? this.visit(valueCtx!) as ExpressionNode)
        : this.compoundRhs(leafRead(), op, valueCtx, loc);
      const headStruct = members.length > 1 ? this.resolveFieldStruct(structArrayElem, fieldName!) : undefined;
      const fieldValue = headStruct
        ? this.rebuildStructWithChain(fieldRead(fieldName!), headStruct, members.slice(1), rawValue, nameLoc, loc)
        : rawValue;
      const ctorId = new IdentifierNode(structArrayElem.name);
      ctorId.location = nameLoc;
      const ctor = new FunctionCallNode(
        ctorId,
        structArrayElem.fields.map((f) => (f.name === fieldName ? fieldValue : fieldRead(f.name))),
      );
      ctor.location = loc;
      const assign = new StateArrayAssignNode(name, buildKeys()[0], ctor);
      assign.location = loc;
      return assign;
    }

    // A bare single-key element resolves to state-or-local in semantic analysis (ArrayAccess/ArrayAssign); a
    // `this.`-prefixed or alias element is unambiguously a state collection (MappingAccess/MappingAssign).
    const bareElement = !alias && keys.length === 1 && !hasMember && !isThis;

    // Read-expression node matching the lvalue (for a compound op), built with fresh key instances so it does
    // not alias the keys used by the assignment node.
    const buildRead = (): ExpressionNode => {
      if (keys.length === 0) {
        const r = new StateAccessNode(name);
        r.location = nameLoc;
        return r;
      }
      const readKeys = buildKeys();
      if (bareElement) {
        const baseId = new IdentifierNode(name);
        baseId.location = nameLoc;
        const r = new ArrayAccessNode(baseId, readKeys[0]);
        r.location = nameLoc;
        return r;
      }
      const m = new MappingAccessNode(name, readKeys);
      m.location = nameLoc;
      if (!hasMember) return m;
      const f = new FieldAccessNode(m, fieldName!);
      f.location = loc;
      return f;
    };

    // Struct-field write through an array-valued mapping entry: `m[k][i].field op= v`. MappingAssign already
    // supports an `arrayIndex`; rebuild the selected struct element and write it back at that index. Keeping the
    // mapping keys separate from the array index also lets the entry-operation coalescer combine this with an
    // immediately preceding `m[k].push(...)` (as in `m[k].push().a = v` followed by another field write).
    let mappingValue: Type | undefined = this.mappingStateVarTypes.get(name);
    let mappingKeyCount = 0;
    while (mappingValue instanceof MappingType) {
      mappingKeyCount += 1;
      mappingValue = mappingValue.valueType;
    }
    const mappingArrayStruct = mappingValue instanceof ArrayType && mappingValue.elementType instanceof StructType
      ? mappingValue.elementType : undefined;
    // Array-field element write through a struct element of an array-valued mapping:
    // `m[k1][k2][i].items[j] op= v`. Keep the mapping keys and outer struct-array index separate, read that
    // struct into a local, apply the established local struct-array-field RMW, then write the rebuilt struct back
    // to the same mapping-array element. Without this roundtrip both i and j were left in MappingFieldAssign.keys
    // and later (incorrectly) type-checked as additional mapping keys.
    if (!isIncDec && hasMember && members.length === 1 && mappingArrayStruct
      && keys.length === mappingKeyCount + 2) {
      const field = mappingArrayStruct.fields.find((candidate) => candidate.name === fieldName);
      if (field?.type instanceof ArrayType) {
        const idAt = (n: string): IdentifierNode => {
          const identifier = new IdentifierNode(n);
          identifier.location = loc;
          return identifier;
        };
        const tmpName = `__nlv_${this.nestedLvalueCounter++}`;
        const freshKeys = (): ExpressionNode[] => buildKeys();
        const mapKeys = (): ExpressionNode[] => freshKeys().slice(0, mappingKeyCount);
        const outerIndex = (): ExpressionNode => freshKeys()[mappingKeyCount];
        const fieldIndex = (): ExpressionNode => freshKeys()[mappingKeyCount + 1];
        const read = new MappingAccessNode(name, mapKeys());
        read.arrayIndex = outerIndex();
        read.location = nameLoc;
        const decl = new VariableDefinitionNode(mappingArrayStruct, [], tmpName, read);
        decl.location = loc;
        this.localStructTypes.set(tmpName, mappingArrayStruct);
        const inner = this.buildLocalStructArrayFieldWrite(
          tmpName, fieldName!, field.type, [fieldIndex], op, valueCtx, loc, valueNode,
        );
        const back = new MappingAssignNode(name, mapKeys(), idAt(tmpName));
        back.arrayIndex = outerIndex();
        back.location = loc;
        const block = new BlockNode([decl, ...(inner.statements ?? []), back]);
        block.location = loc;
        return block;
      }
    }
    if (hasMember && mappingArrayStruct && keys.length === mappingKeyCount + 1
      && mappingArrayStruct.fields.some((field) => field.name === fieldName)) {
      const mapKeys = buildKeys().slice(0, mappingKeyCount);
      const arrayIndex = buildKeys()[mappingKeyCount];
      const elementRead = (): MappingAccessNode => {
        const read = new MappingAccessNode(name, buildKeys().slice(0, mappingKeyCount));
        read.arrayIndex = buildKeys()[mappingKeyCount];
        read.location = nameLoc;
        return read;
      };
      const fieldRead = (field: string): ExpressionNode => {
        const read = new FieldAccessNode(elementRead(), field);
        read.location = loc;
        return read;
      };
      const rawValue = op === '='
        ? (valueNode ?? this.visit(valueCtx!) as ExpressionNode)
        : this.compoundRhs(fieldRead(fieldName!), op, valueCtx, loc);
      const headStruct = members.length > 1 ? this.resolveFieldStruct(mappingArrayStruct, fieldName!) : undefined;
      const fieldValue = headStruct
        ? this.rebuildStructWithChain(
          fieldRead(fieldName!), headStruct, members.slice(1), rawValue, nameLoc, loc,
        )
        : rawValue;
      const ctorId = new IdentifierNode(mappingArrayStruct.name);
      ctorId.location = nameLoc;
      const ctor = new FunctionCallNode(
        ctorId,
        mappingArrayStruct.fields.map((field) => field.name === fieldName ? fieldValue : fieldRead(field.name)),
      );
      ctor.location = loc;
      const assign = new MappingAssignNode(name, mapKeys, ctor);
      assign.arrayIndex = arrayIndex;
      assign.location = loc;
      return assign;
    }

    const value = op === '='
      ? (valueNode ?? this.visit(valueCtx!) as ExpressionNode)
      : this.compoundRhs(buildRead(), op, valueCtx, loc);

    let node: StatementNode;
    if (keys.length === 0 && hasMember) {
      // `x.field = v` whose struct type was unknown at parse (imported struct local): buildStructFieldRebuild
      // could not fire above. Preserve the field (and any deeper member chain) in a MappingFieldAssign so
      // RedesugarImportedStructFieldWrites can rebuild it post-merge; a plain StateAssign would drop the field.
      node = new MappingFieldAssignNode(name, keys, fieldName!, value);
      if (members.length > 1) (node as MappingFieldAssignNode).trailingMembers = members.slice(1);
    } else if (keys.length === 0) {
      node = new StateAssignNode(name, value);
    } else if (hasMember) {
      node = new MappingFieldAssignNode(name, keys, fieldName!, value);
      if (members.length > 1) (node as MappingFieldAssignNode).trailingMembers = members.slice(1);
    } else if (bareElement) {
      node = new ArrayAssignNode(name, keys[0], value);
    } else if (keys.length === 1 && this.packedStateArrayNames.has(name)) {
      node = new StateArrayAssignNode(name, keys[0], value);
    } else {
      node = new MappingAssignNode(name, keys, value);
    }
    node.location = loc;
    if (qualifiedBaseAccess && node instanceof StateAssignNode) node.qualifiedBaseAccess = true;
    return node;
  }

  // Inline storage-pointer write `Lib.f(args).field op= v` (OZ StorageSlot). Desugar to the local-pointer form
  // `RetStruct __t = Lib.f(args); __t.field op= v;` (a block spliced by flattenStatements), which
  // LowerStorageSlotPointers then lowers to the __evm_storage register. Needs Lib.f's return struct type.

  visitMappingAccess(ctx: MappingAccessContext): MappingAccessNode {
    const name = ctx.Identifier().getText();
    const keys = ctx.expression_list().map((e) => this.visit(e));
    const node = new MappingAccessNode(name, keys);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitOutStateMappingFieldAccess(ctx: OutStateMappingFieldAccessContext): FieldAccessNode {
    const outStateName = ctx.Identifier(0).getText();
    if (outStateName !== 'outState') {
      throw new ParseError(
        `Unexpected 'this.${outStateName}.${ctx.Identifier(1).getText()}[...]', did you mean 'this.outState.tokens[...]'?`,
        Location.fromCtx(ctx),
      );
    }

    const containerName = ctx.Identifier(1).getText();
    if (containerName !== 'tokens') {
      throw new ParseError(
        `Unknown outState collection 'this.outState.${containerName}[...]', did you mean 'this.outState.tokens[...]'?`,
        Location.fromCtx(ctx),
      );
    }

    const keyExpression = this.visit(ctx.expression()) as ExpressionNode;
    const mappingNode = new MappingAccessNode(containerName, [keyExpression]);
    mappingNode.isTokenContainerAccess = true;
    mappingNode.isOutStateTokenContainerAccess = true;
    mappingNode.location = Location.fromCtx(ctx);

    const memberCtx = ctx.memberName();
    const fieldName = memberCtx.Identifier()
      ? memberCtx.Identifier().getText()
      : memberCtx.getText().slice(1); // strip leading '.'

    const node = new FieldAccessNode(mappingNode, fieldName);
    node.location = Location.fromCtx(ctx);
    return node;
  }



  // `delete a.push()` keeps the append and resets the returned fresh storage slot. Since a no-argument push
  // already initializes that slot to its default, the delete itself is a no-op. The nested form follows the
  // same rule at both levels, while retaining the outer element index needed for the inner append.
  visitDeletePush(ctx: any): StatementNode {
    const loc = Location.fromCtx(ctx);
    const name = ctx.Identifier().getText();
    const arrayType = this.stateArrayVarTypes.get(name);
    if (!(arrayType instanceof ArrayType)) {
      throw new ParseError('delete of .push() requires a state-array receiver', loc);
    }
    if (!ctx._second) {
      return this.buildArrayPush(
        name, false, [], undefined, createDefaultValueExpression(arrayType.elementType, loc), true, ctx,
      );
    }
    if (!(arrayType.elementType instanceof ArrayType)) {
      throw new ParseError('nested delete of .push() requires a two-dimensional state array', loc);
    }
    const stamp = <T extends { location?: Location }>(node: T): T => { node.location = loc; return node; };
    const indexName = `__delete_push_i_${this.nestedLvalueCounter++}`;
    const id = (): IdentifierNode => stamp(new IdentifierNode(indexName));
    const index = stamp(new VariableDefinitionNode(
      PrimitiveType.BIGINT, [], indexName, stamp(new UnaryOpNode(
        UnaryOperator.SIZE, stamp(new IdentifierNode(name)),
      )),
    ));
    index.allowUnused = true;
    const outer = this.buildArrayPush(
      name, false, [], undefined, createDefaultValueExpression(arrayType.elementType, loc), true, ctx,
    );
    const inner = this.buildArrayPush(
      name, false, [(): ExpressionNode => id()], undefined,
      createDefaultValueExpression(arrayType.elementType.elementType, loc), true, ctx,
    );
    return stamp(new BlockNode([index, outer, inner]));
  }

  visitDeleteLocal(ctx: DeleteLocalContext): StatementNode {
    const name = ctx.Identifier().getText();
    // `delete s` on a flattened struct state var: reset every VALUE leaf to its default. Mapping leaves
    // persist (Solidity: delete does not touch mappings inside structs); array leaves are skipped too
    // (collection-model deletes have their own statement forms).
    const flatStruct = this.mappingStructStateVars.get(name);
    if (flatStruct) {
      const loc = Location.fromCtx(ctx);
      const stmts: StatementNode[] = [];
      const collect = (prefix: string, t: StructType, seen: Set<StructType>): void => {
        if (seen.has(t)) return;
        for (const field of t.fields) {
          const leaf = `${prefix}__${field.name}`;
          if (field.type instanceof MappingType) continue;
          if (field.type instanceof ArrayType) {
            const isChunkDynamic = this.chunkedArrays && field.type.bound === undefined
              && isChunkPackableElementType(field.type.elementType);
            if (isChunkDynamic) {
              const d = new DeleteStateNode(leaf);
              d.location = loc;
              stmts.push(d);
            } else if (field.type.bound !== undefined) {
              // Fixed-array leaves use the collection backend. Their finite index set can be reset exactly;
              // unlike a mapping, Solidity `delete structValue` must clear every fixed-array element.
              for (let i = 0; i < field.type.bound; i += 1) {
                const key = new IntLiteralNode(BigInt(i)); key.location = loc;
                const value = createDefaultValueExpression(field.type.elementType, loc);
                const reset = new MappingAssignNode(leaf, [key], value);
                reset.location = loc;
                stmts.push(reset);
              }
            }
            continue;
          }
          if (field.type instanceof StructType && this.structNeedsFieldFlattening(field.type)) {
            collect(leaf, field.type, new Set([...seen, t]));
            continue;
          }
          const d = new DeleteStateNode(leaf);
          d.location = loc;
          stmts.push(d);
        }
      };
      collect(name, flatStruct, new Set());
      const block = new BlockNode(stmts);
      block.location = loc;
      return block;
    }
    const identifier = new IdentifierNode(name);
    identifier.location = Location.fromToken(ctx.Identifier().symbol);
    const node = new DeleteLocalNode(identifier);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitDeleteParenthesized(ctx: any): StatementNode {
    const loc = Location.fromCtx(ctx);
    let target = ctx.expression() as ExpressionContext;
    while (target instanceof ParenthesisedContext) target = target.expression();
    if (target instanceof IdentifierContext) {
      const identifier = new IdentifierNode(target.anyIdentifier().getText());
      identifier.location = Location.fromCtx(target);
      const node = new DeleteLocalNode(identifier);
      node.location = loc;
      return node;
    }
    if (target instanceof StateAccessContext) {
      const node = new DeleteStateNode(target.Identifier().getText());
      node.location = loc;
      return node;
    }
    // Deleting an element of a freshly-created expression (e.g. `delete ([""][0])`) has no observable write,
    // but Solidity still evaluates the receiver/index. Preserve that evaluation as a discarded expression.
    const node = new ExpressionStatementNode(this.visit(target) as ExpressionNode);
    node.location = loc;
    return node;
  }

  // `delete base.f1..fn;` (delete a struct field) - reset it to the field type's default via the same
  // struct-rebuild path as `base.f1..fn = <default>`. base is a local or state struct variable.
  visitDeleteMember(ctx: any): StatementNode {
    const baseIdent = ctx.Identifier_list()[0];
    let rawName = baseIdent.getText();
    const nameLoc = Location.fromToken(baseIdent.symbol);
    const members: string[] = ctx.Identifier_list().slice(1).map((id: { getText(): string }) => id.getText());
    const loc = Location.fromCtx(ctx);
    let isThis = ctx.getText().startsWith('deletethis.');
    if (!isThis && rawName === this.currentContractName && members.length === 1) {
      const node = new DeleteStateNode(members[0]);
      node.location = loc;
      return node;
    }
    // `delete x.f` where x is a whole-var storage alias to a NON-flattened struct state var: route to the
    // container (matches the field-write substitution in buildLvalueAssign - the alias is not a local copy).
    const alias = this.storageAliases.get(rawName);
    if (!isThis && alias && alias.keys.length === 0 && this.stateVarNames.has(alias.container)
      && !this.mappingStructStateVars.has(alias.container)) {
      rawName = alias.container;
    }
    // A flattened state-struct array leaf is a collection of its own (`s.x` -> `s__x`), not a scalar field that
    // can be rebuilt into the parent struct value. Route member deletion through the same reset used by whole
    // flattened-struct deletion: clear a chunked dynamic leaf, or reset every finite fixed-array element.
    const flatStruct = this.mappingStructStateVars.get(rawName);
    if (!isThis && flatStruct && members.length > 0) {
      let fieldType: Type | undefined = flatStruct;
      for (const member of members) {
        if (!(fieldType instanceof StructType)) { fieldType = undefined; break; }
        fieldType = fieldType.fields.find((field) => field.name === member)?.type;
      }
      if (fieldType instanceof ArrayType) {
        const leaf = `${rawName}__${members.join('__')}`;
        const isChunkDynamic = this.chunkedArrays && fieldType.bound === undefined
          && isChunkPackableElementType(fieldType.elementType);
        if (isChunkDynamic) {
          const node = new DeleteStateNode(leaf);
          node.location = loc;
          return node;
        }
        if (fieldType.bound !== undefined) {
          const resets: StatementNode[] = [];
          for (let i = 0; i < fieldType.bound; i += 1) {
            const key = new IntLiteralNode(BigInt(i)); key.location = loc;
            const reset = new MappingAssignNode(
              leaf, [key], createDefaultValueExpression(fieldType.elementType, loc),
            );
            reset.location = loc;
            resets.push(reset);
          }
          const block = new BlockNode(resets);
          block.location = loc;
          return block;
        }
      }
    }
    const rebuilt = this.buildStructFieldRebuild(rawName, nameLoc, members, isThis, loc,
      (_chainRead, fieldType) => createDefaultValueExpression(fieldType, loc));
    if (rebuilt) return rebuilt;
    throw new UnsupportedTypeError({ location: loc } as any);
  }

  // Rebuild `structExpr` (of struct type `t`) with its nested field at `chain` (a field-name chain) replaced by
  // `finalValue`, producing a `T(f0, .., newField, ..)` constructor that reads the other fields from `structExpr`.
  // Recurses so `s.a.b = v` reconstructs BOTH levels (`T(.., A(.., v, ..), ..)`). Shared by the struct-var field
  // rebuild and the packed struct-array element write (`arr[i].a.b = v`).
  private rebuildStructWithChain(
    structExpr: ExpressionNode, t: StructType, chain: string[], finalValue: ExpressionNode,
    nameLoc: Location, loc: Location,
  ): ExpressionNode {
    const fieldAccess = (expr: ExpressionNode, field: string): ExpressionNode => {
      const fa = new FieldAccessNode(expr, field);
      fa.location = loc;
      return fa;
    };
    const [head, ...rest] = chain;
    const newField = rest.length === 0
      ? finalValue
      : this.rebuildStructWithChain(
        fieldAccess(cloneNode(structExpr) as ExpressionNode, head), this.resolveFieldStruct(t, head)!,
        rest, finalValue, nameLoc, loc,
      );
    const ctorId = new IdentifierNode(t.name);
    ctorId.location = nameLoc;
    const ctor = new FunctionCallNode(
      ctorId,
      t.fields.map((f) => (f.name === head ? newField : fieldAccess(cloneNode(structExpr) as ExpressionNode, f.name))),
    );
    ctor.location = loc;
    return ctor;
  }

  // Rebuild a struct's value with the field at `members` (a field-name chain) replaced by `finalValueFn`'s
  // result, and assign it back (struct fields have no in-place write codegen). base is a local/state struct
  // variable; returns undefined when it is not a matching struct field chain (caller falls through). Shared by
  // the struct-field assignment path and `delete base.field`.
  private buildStructFieldRebuild(
    rawName: string, nameLoc: Location, members: string[], isThis: boolean, loc: Location,
    finalValueFn: (chainRead: ExpressionNode, finalFieldType: Type) => ExpressionNode,
  ): StatementNode | undefined {
    // A bare `s.field` where `s` is a state struct var (not shadowed by a local) is the Solidity form of
    // `this.s.field`; bare state reads already resolve this way, so treat the write as a state field write.
    const bareStateStruct = !isThis && !this.localStructTypes.has(rawName) && this.stateStructVars.has(rawName);
    const useState = isThis || bareStateStruct;
    const baseStructT = (members.length >= 1 && !this.storageAliases.has(rawName))
      ? (useState ? this.stateStructVars.get(rawName) : this.localStructTypes.get(rawName))
      : undefined;
    const chainTypes = baseStructT ? this.chainStructTypes(baseStructT, members) : undefined;
    if (!baseStructT || !chainTypes) return undefined;

    const baseRead = (): ExpressionNode => {
      const r: ExpressionNode = useState ? new StateAccessNode(rawName) : new IdentifierNode(rawName);
      r.location = nameLoc;
      return r;
    };
    const fieldAccess = (expr: ExpressionNode, field: string): ExpressionNode => {
      const fa = new FieldAccessNode(expr, field);
      fa.location = loc;
      return fa;
    };
    let chainRead = baseRead();
    for (const m of members) chainRead = fieldAccess(chainRead, m);
    const finalStruct = chainTypes[chainTypes.length - 1];
    const finalFieldType = finalStruct.fields.find((f) => f.name === members[members.length - 1])!.type;
    const rebuilt = this.rebuildStructWithChain(
      baseRead(), baseStructT, members, finalValueFn(chainRead, finalFieldType), nameLoc, loc,
    );
    const assign: StatementNode = useState
      ? new StateAssignNode(rawName, rebuilt)
      : new AssignNode(baseRead() as IdentifierNode, rebuilt); // local: baseRead() is an IdentifierNode
    if (assign instanceof AssignNode) assign.isReferenceDataWrite = true;
    assign.location = loc;
    return assign;
  }

  // Desugar an array-field element write on a LOCAL struct var (`sv.field[idx] op= v`) into a read-modify-rebuild
  // block: `T tmp = sv.field; tmp[idx] = value; sv.field = tmp;`. `structVarName` must be registered in
  // localStructTypes. Returned as a block so flattenStatements splices the three statements at the call scope.
  private buildLocalStructArrayFieldWrite(
    structVarName: string, fieldName: string, arrayFieldType: Type, indexVisits: Array<() => ExpressionNode>,
    op: string, valueCtx: ExpressionContext | undefined, loc: Location, valueNode?: ExpressionNode,
  ): BlockNode {
    const idAt = (n: string): IdentifierNode => { const i = new IdentifierNode(n); i.location = loc; return i; };
    const tmpName = `__nlv_${this.nestedLvalueCounter++}`;
    const sField = new FieldAccessNode(idAt(structVarName), fieldName);
    sField.location = loc;
    const decl = new VariableDefinitionNode(arrayFieldType, [], tmpName, sField);
    decl.location = loc;
    // Nested element access `tmp[k0]..[kn]` (one level per key), for both the compound-op read and the write.
    const access = (): ExpressionNode => {
      let acc: ExpressionNode = idAt(tmpName);
      for (const iv of indexVisits) { acc = new ArrayAccessNode(acc, iv()); acc.location = loc; }
      return acc;
    };
    const value = op === '='
      ? (valueNode ?? this.visit(valueCtx!) as ExpressionNode)
      : this.compoundRhs(access(), op, valueCtx, loc);
    // Single index -> a plain local element write; multi index -> a MappingAssign the nested-array write desugar
    // (DesugarNestedArrayWrite) lowers to a read-modify-write over `tmp`.
    const elemAssign: StatementNode = indexVisits.length === 1
      ? new ArrayAssignNode(tmpName, indexVisits[0](), value)
      : new MappingAssignNode(tmpName, indexVisits.map((iv) => iv()), value);
    elemAssign.location = loc;
    const rebuild = this.buildStructFieldRebuild(structVarName, loc, [fieldName], false, loc, () => idAt(tmpName))!;
    const block = new BlockNode([decl, elemAssign, rebuild]);
    block.location = loc;
    return block;
  }

  visitDeleteState(ctx: DeleteStateContext): DeleteStateNode {
    const node = new DeleteStateNode(ctx.Identifier().getText());
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitDeleteMappingEntry(ctx: DeleteMappingEntryContext): MappingDeleteNode {
    const name = ctx.Identifier().getText();
    const keys = ctx.expression_list().map((e) => this.visit(e));
    const node = new MappingDeleteNode(name, keys);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitDeleteDeepMemberEntry(ctx: any): MappingDeleteNode {
    const name = ctx.Identifier_list().map((id: any) => id.getText()).join('__');
    const keys = ctx.expression_list().map((e: any) => this.visit(e)) as ExpressionNode[];
    const node = new MappingDeleteNode(name, keys);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // Bare indexed delete `delete m[k];` / `delete arr[i];` (no `this.`); resolved to state in semantics.
  visitDeleteIndexed(ctx: DeleteIndexedContext): StatementNode {
    const name = ctx.Identifier().getText();
    const keys = ctx.expression_list().map((e) => this.visit(e));
    // `delete data[i]` on an unbounded bytes var sets byte i to its default 0x00 (keeping length) - reuse the
    // bytes element-write desugar with a zero byte. State or local, selected like the assignment path.
    if ((this.bytesStateVarNames.has(name) || this.localBytesVars.has(name)) && keys.length === 1) {
      const isState = this.bytesStateVarNames.has(name);
      const zero = new HexLiteralNode(new Uint8Array(1));
      zero.location = Location.fromCtx(ctx);
      const indexFn = (): ExpressionNode => this.visit(ctx.expression_list()[0]) as ExpressionNode;
      return this.desugarBytesElementWrite(name, indexFn, zero, Location.fromCtx(ctx), isState, '=');
    }
    if (this.packedStateArrayNames.has(name) && keys.length === 1) {
      const node = new StateArrayDeleteNode(name, keys[0]);
      node.location = Location.fromCtx(ctx);
      return node;
    }
    const node = new MappingDeleteNode(name, keys);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // `delete X.field[keys]` - delete a struct-field mapping entry. The field mapping is the flattened state
  // collection `X__field` (same as the struct-field mapping write, ~visitAssignmentStatement), so a plain
  // MappingDelete on it removes the entry (Solidity delete on a mapping element).
  visitDeleteMemberEntry(ctx: any): MappingDeleteNode {
    const ids = ctx.Identifier_list();
    const keys = ctx.expression_list().map((e: any) => this.visit(e)) as ExpressionNode[];
    const node = new MappingDeleteNode(`${ids[0].getText()}__${ids[1].getText()}`, keys);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  private buildMappingType(ctx: MappingTypeContext): MappingType {
    if (this.solidityImportCompat && /^mapping\(addresspayable=>/.test(ctx.getText())) {
      throw new ParseError(
        'Mapping key type must be "address", not "address payable"',
        Location.fromCtx(ctx),
      );
    }
    // Resolve (not just parseType) so a user enum / value-type key resolves; an unknown name (a contract type)
    // defaults to an address handle, matching function params. parseType alone left these undefined -> crash.
    const keyText = ctx.typeName(0).getText();
    const keyType = this.resolveType(keyText) ?? new AddressType(false, keyText);
    const identifiers = ctx.anyIdentifier_list();

    const nestedMappingCtx = ctx.mappingType();
    if (nestedMappingCtx) {
      const valueType = this.buildMappingType(nestedMappingCtx);
      const keyName = identifiers.length > 0 ? identifiers[0].getText() : undefined;
      const valueName = identifiers.length > 1 ? identifiers[1].getText() : undefined;
      const mapping = new MappingType(keyType, valueType, keyName, valueName);
      this.validateMappingNames(mapping, ctx);
      return mapping;
    }
    const arrayTypeCtx = ctx.arrayType();
    if (arrayTypeCtx) {
      const keyName = identifiers.length > 0 ? identifiers[0].getText() : undefined;
      const valueName = identifiers.length > 1 ? identifiers[1].getText() : undefined;
      const mapping = new MappingType(keyType, this.buildArrayType(arrayTypeCtx), keyName, valueName);
      this.validateMappingNames(mapping, ctx);
      return mapping;
    }
    // An unknown value-type name that is a contract/interface defaults to an address handle rather than
    // resolving to `undefined` (which trips UnsupportedMappingValueTypeError) - `mapping(K => IFoo)` stores an
    // address, matching how a contract/interface param is typed. A LIBRARY name stays unresolved so it is
    // rejected (solc: "Invalid use of a library name"; libraries are not storable value types).
    const valueText = ctx.typeName(1).getText();
    const valueType = this.resolveType(valueText)
      ?? (this.libraryNames.has(valueText) ? undefined : new AddressType(false, valueText));
    const keyName = identifiers.length > 0 ? identifiers[0].getText() : undefined;
    const valueName = identifiers.length > 1 ? identifiers[1].getText() : undefined;
    const mapping = new MappingType(keyType, valueType, keyName, valueName);
    this.validateMappingNames(mapping, ctx);
    return mapping;
  }

  private validateMappingNames(mapping: MappingType, ctx: MappingTypeContext): void {
    const seen = new Set<string>();
    const walk = (m: MappingType): void => {
      for (const name of [m.keyName, m.valueName]) {
        if (!name) continue;
        if (seen.has(name)) {
          throw new ParseError(`Conflicting parameter name '${name}' in mapping`, Location.fromCtx(ctx));
        }
        seen.add(name);
      }
      if (m.valueType instanceof MappingType) walk(m.valueType);
    };
    walk(mapping);
  }

  private buildArrayType(ctx: ArrayTypeContext): ArrayType {
    let elementType: Type;
    if (ctx.arrayType()) {
      elementType = this.buildArrayType(ctx.arrayType());
    } else if (ctx.mappingType()) {
      elementType = this.buildMappingType(ctx.mappingType());
    } else {
      // Mirror the scalar path (visitStateVariableDeclaration): an unresolved name (e.g. an imported struct
      // not yet merged, or an interface) becomes a named AddressType placeholder rather than `undefined`, so
      // routing sees a chunk-packable element and a post-import pass (reresolveImportedTypes) can resolve it.
      const elemName = ((ctx as any).functionType?.() ?? ctx.typeName()).getText();
      if (this.solidityImportCompat && this.libraryNames.has(elemName)) {
        throw new ParseError(
          `Invalid use of library name '${elemName}' as an array element type`,
          Location.fromCtx(ctx),
        );
      }
      elementType = this.resolveType(elemName) ?? new AddressType(false, elemName);
    }
    const bound = this.resolveArrayBound(ctx);
    return new ArrayType(elementType, bound);
  }

  // Resolve an array dimension `[expr]` to a number. The dimension is a compile-time-constant expression: a
  // numeric/hex literal, a named integer constant (`int constant N = 3; T[N]`), or arithmetic over those
  // (`T[2**10]`, `T[2**10 + 3]`, `T[N * 2]`). Unbounded `[]` -> undefined.
  private resolveArrayBound(ctx: ArrayTypeContext): number | undefined {
    const exprCtx = ctx.expression();
    if (!exprCtx) return undefined; // unbounded `[]`
    const node = this.visit(exprCtx) as ExpressionNode;
    const value = this.evalConstIntNode(node);
    if (value === undefined) {
      throw new ParseError(
        `Array dimension '${exprCtx.getText()}' must be a compile-time integer constant`, Location.fromCtx(ctx),
      );
    }
    // Validate at type construction rather than only on CollectionNode: compatibility lowering represents many
    // fixed value-type arrays as StateVariableNode, and zero/uint256-overflow dimensions must be rejected in every
    // declaration context before that representation choice is made.
    if (value <= 0n) {
      const invalid = new IntLiteralNode(value);
      invalid.location = Location.fromCtx(ctx);
      throw new InvalidArrayBoundError(invalid);
    }
    if (value >= (1n << 256n)) {
      throw new ParseError('Array length too large, maximum is 2**256 - 1', Location.fromCtx(ctx));
    }
    return Number(value);
  }

  // Compile-time integer evaluation of an expression node used as an array dimension. Returns undefined for
  // anything that is not a constant integer (a runtime value, an unresolved name, an unsupported operator).
  private evalConstIntNode(node: ExpressionNode): bigint | undefined {
    if (node instanceof IntLiteralNode) return node.value;
    if (node instanceof HexLiteralNode) {
      let v = 0n;
      for (let i = node.value.length - 1; i >= 0; i--) v = (v << 8n) | BigInt(node.value[i]); // little-endian
      return v;
    }
    if (node instanceof IdentifierNode) {
      const known = this.constantIntValues.get(node.name);
      return known === undefined ? undefined : BigInt(known);
    }
    if (node instanceof CastNode) return this.evalConstIntNode(node.expression); // e.g. uint256(N)
    if (node instanceof UnaryOpNode) {
      const inner = this.evalConstIntNode(node.expression);
      if (inner === undefined) return undefined;
      if (node.operator === UnaryOperator.NEGATE) return -inner;
      if (node.operator === UnaryOperator.INVERT) return ~inner;
      return undefined;
    }
    if (node instanceof BinaryOpNode) {
      const l = this.evalConstIntNode(node.left);
      const r = this.evalConstIntNode(node.right);
      if (l === undefined || r === undefined) return undefined;
      switch (node.operator) {
        case BinaryOperator.PLUS: return l + r;
        case BinaryOperator.MINUS: return l - r;
        case BinaryOperator.MUL: return l * r;
        case BinaryOperator.DIV: return r === 0n ? undefined : l / r;
        case BinaryOperator.MOD: return r === 0n ? undefined : l % r;
        case BinaryOperator.POW: return r < 0n ? undefined : l ** r;
        case BinaryOperator.SHIFT_LEFT: return r < 0n ? undefined : l << r;
        case BinaryOperator.SHIFT_RIGHT: return r < 0n ? undefined : l >> r;
        case BinaryOperator.BIT_AND: return l & r;
        case BinaryOperator.BIT_OR: return l | r;
        case BinaryOperator.BIT_XOR: return l ^ r;
        default: return undefined;
      }
    }
    return undefined;
  }

  private validateConstantZeroDivisors(node: ExpressionNode, ctx: ParserRuleContext): void {
    if (node instanceof BinaryOpNode
      && (node.operator === BinaryOperator.DIV || node.operator === BinaryOperator.MOD)
      && this.evalConstIntNode(node.right) === 0n) {
      throw new ParseError(
        node.operator === BinaryOperator.DIV ? 'Division by zero' : 'Modulo zero',
        Location.fromCtx(ctx),
      );
    }
    if (node instanceof FunctionCallNode
      && (node.identifier.name === 'addmod' || node.identifier.name === 'mulmod')
      && node.parameters.length === 3 && this.evalConstIntNode(node.parameters[2]) === 0n) {
      throw new ParseError('Arithmetic modulo zero', Location.fromCtx(ctx));
    }
    for (const value of Object.values(node)) {
      if (value instanceof ExpressionNode) this.validateConstantZeroDivisors(value, ctx);
      else if (Array.isArray(value)) {
        for (const item of value) {
          if (item instanceof ExpressionNode) this.validateConstantZeroDivisors(item, ctx);
        }
      }
    }
  }

  // Pre-scan: record integer constants so they can be used as array dimensions `T[N]`. The init may be a
  // literal, a parenthesised/arithmetic compile-time expression (`(2)`, `(2 + 1) / 1`), or reference an
  // earlier such constant; anything not a compile-time integer is skipped (a clear ParseError at use in
  // resolveArrayBound). Repeated to a fixpoint so a constant referencing a LATER one still resolves.
  private scanConstantStrings(ctxs: ConstantDefinitionContext[]): void {
    const entries = ctxs
      .filter((c) => c.typeName().getText() === 'string')
      .map((c) => ({ name: c.anyIdentifier().getText(), exprCtx: c.expression() }));
    let progress = true;
    while (progress) {
      progress = false;
      for (const { name, exprCtx } of entries) {
        if (this.constantStringValues.has(name)) continue;
        let expression: ExpressionNode | undefined;
        try { expression = this.visit(exprCtx) as ExpressionNode; } catch { expression = undefined; }
        const value = expression instanceof StringLiteralNode
          ? expression.value
          : expression instanceof IdentifierNode ? this.constantStringValues.get(expression.name) : undefined;
        if (value !== undefined) {
          this.constantStringValues.set(name, value);
          progress = true;
        }
      }
    }
  }

  private scanConstantDimensions(ctxs: ConstantDefinitionContext[]): void {
    this.scanConstantsToFixpoint(ctxs
      .filter((c) => AstBuilder.isIntTypeName(c.typeName().getText()))
      .map((c) => ({ name: c.anyIdentifier().getText(), exprCtx: c.expression() })));
  }

  // A `constant` STATE VARIABLE with an integer init (e.g. `uint256 private constant N = 3;`) is parsed as a
  // stateVariableDeclaration (not a constantDefinition) when it carries a visibility modifier; record those too.
  private scanConstantStateVars(ctxs: StateVariableDeclarationContext[]): void {
    const entries: { name: string; exprCtx: ExpressionContext }[] = [];
    for (const c of ctxs) {
      const mods = (c.modifier_list?.() ?? []).map((m: { getText(): string }) => m.getText());
      const expr = c.expression?.();
      const id = c.anyIdentifier?.();
      if (mods.includes('constant') && expr && id && AstBuilder.isIntTypeName(c.typeName().getText())) {
        entries.push({ name: id.getText(), exprCtx: expr });
      }
    }
    this.scanConstantsToFixpoint(entries);
  }

  // A declared type is an integer type (`int`, `uint`, `intN`, `uintN`) - only such constants are usable as an
  // array dimension. Keeps a `bytes`/`bool`/`address` constant (whose value may evaluate to an int) out.
  private static isIntTypeName(typeName: string): boolean {
    return /^u?int(\d+)?$/.test(typeName);
  }

  // Evaluate each constant's init to a compile-time integer (visiting the expr, then evalConstIntNode over the
  // constants recorded so far), iterating until no new constant resolves - so declaration order does not matter.
  private scanConstantsToFixpoint(entries: { name: string; exprCtx: ExpressionContext }[]): void {
    let progress = true;
    while (progress) {
      progress = false;
      for (const { name, exprCtx } of entries) {
        if (this.constantIntValues.has(name)) continue;
        let value: bigint | undefined;
        try { value = this.evalConstIntNode(this.visit(exprCtx) as ExpressionNode); } catch { value = undefined; }
        if (value !== undefined) {
          this.constantIntValues.set(name, Number(value));
          progress = true;
        }
      }
    }
  }

  // Register a list of struct definitions: pre-register every struct NAME (empty) FIRST so field-type
  // resolution can see forward and self / mutually recursive references (`struct S{T[] x;} struct T{...}`,
  // `struct R{R[] c;}`), then resolve each struct's fields into the pre-registered type in place (same object,
  // so references already handed out observe the filled fields).
  private registerStructDefinitions(ctxList: StructDefinitionContext[], out: StructDefinitionNode[]): void {
    this.registerStructNames(ctxList);
    this.buildStructFields(ctxList, out);
  }

  // Register struct NAMES (empty placeholders) so a struct's fields can forward-reference a struct declared
  // later. Split from buildStructFields so a caller can register UDVT names in between, letting a field type
  // resolve a user-defined value type declared after the struct (`struct S { U u; } type U is address;`).
  private registerStructNames(ctxList: StructDefinitionContext[]): void {
    for (const sdCtx of ctxList) {
      const name = sdCtx.anyIdentifier().getText();
      this.structMap.set(name, new StructType(name, []));
    }
  }

  private buildStructFields(ctxList: StructDefinitionContext[], out: StructDefinitionNode[]): void {
    for (const sdCtx of ctxList) {
      const sd = this.visitStructDefinition(sdCtx);
      out.push(sd);
      this.structMap.get(sd.name)!.fields = sd.fields;
    }
  }

  visitStructDefinition(ctx: StructDefinitionContext): StructDefinitionNode {
    const structName = ctx.anyIdentifier().getText();
    if (this.solidityImportCompat) {
      const fieldNames = new Set<string>();
      for (const field of ctx.structField_list()) {
        const name = field.anyIdentifier().getText();
        if (fieldNames.has(name)) {
          throw new ParseError(`Identifier '${name}' is already declared`, Location.fromCtx(field));
        }
        fieldNames.add(name);
      }
    }
    const fields = ctx.structField_list().map((fieldCtx) => ({
      name: fieldCtx.anyIdentifier().getText(),
      // A field may be a plain typeName, an arrayType (`int[]`, `bytes20[3]`, `T[]`), or a mapping (flattened to
      // per-field state vars when the struct is used as a state variable). An array field goes through
      // buildArrayType so a struct/enum element type (`T[]`) resolves, not just primitives.
      type: fieldCtx.mappingType()
        ? this.buildMappingType(fieldCtx.mappingType()!)
        : fieldCtx.arrayType()
          ? this.buildArrayType(fieldCtx.arrayType()!)
          // A scalar field whose type is a contract/interface name (`C y`) becomes a named AddressType
          // placeholder (it stores the callee's address), mirroring array fields (buildArrayType) and state
          // vars. An unknown name stays a placeholder too - a genuine typo fails at use, not definition.
          : (this.resolveType(fieldCtx.typeName()!.getText())
            ?? new AddressType(false, fieldCtx.typeName()!.getText())),
    }));
    const node = new StructDefinitionNode(structName, fields);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitEnumDefinition(ctx: EnumDefinitionContext): EnumDefinitionNode {
    const name = ctx.anyIdentifier().getText();
    if (this.solidityImportCompat && /,\}$/.test(ctx.getText())) {
      throw new ParseError('Expected enum member after trailing comma', Location.fromCtx(ctx));
    }
    if (this.solidityImportCompat && ctx.enumMember_list().length > 256) {
      throw new ParseError('Enum with more than 256 members is not allowed', Location.fromCtx(ctx));
    }
    const members: { name: string; value: bigint }[] = [];
    const memberNames = new Set<string>();
    let nextValue = 0n;
    for (const memberCtx of ctx.enumMember_list()) {
      const memberName = memberCtx.anyIdentifier().getText();
      if (this.solidityImportCompat && memberNames.has(memberName)) {
        throw new ParseError(`Identifier '${memberName}' is already declared`, Location.fromCtx(memberCtx));
      }
      memberNames.add(memberName);
      if (memberCtx.NumberLiteral()) {
        nextValue = BigInt(memberCtx.NumberLiteral().getText());
      }
      members.push({ name: memberName, value: nextValue });
      nextValue += 1n;
    }
    const node = new EnumDefinitionNode(name, members);
    node.location = Location.fromCtx(ctx);
    // Register so the enum name resolves as a type (params, locals, returns, struct fields).
    this.enumMap.set(name, new EnumType(name, members));
    return node;
  }

  visitTypeDefinition(ctx: TypeDefinitionContext): TypeDefinitionNode {
    const name = ctx.anyIdentifier().getText();
    const underlyingType = this.resolveType(ctx.typeName().getText());
    if (this.solidityImportCompat
      && ((underlyingType instanceof BytesType && underlyingType.bound === undefined)
        || underlyingType === PrimitiveType.STRING)) {
      throw new ParseError(
        `The underlying type of the user defined value type '${name}' is not a value type`,
        Location.fromCtx(ctx),
      );
    }
    // Validate that the underlying type is suitable for a UDVT (must be a VM-primitive type). Address is
    // bytes-backed (a locking bytecode), so `type MyAddr is address;` wraps it like any other primitive.
    const isValidUnderlying = underlyingType instanceof BytesType
      || underlyingType instanceof IntType
      || underlyingType instanceof FixedType
      || underlyingType instanceof AddressType
      || (typeof underlyingType === 'string' && Object.values(PrimitiveType).includes(underlyingType as PrimitiveType));
    if (!isValidUnderlying) {
      throw new Error(
        `Type definition '${name}' has unsupported underlying type '${underlyingType}'. `
        + 'User-defined value types can only wrap primitive types (int, bytes, bool, string, pubkey, sig, datasig) '
        + 'or bounded int/fixed types.',
      );
    }
    const valueType = new ValueType(name, underlyingType as any);
    this.typeDefMap.set(name, valueType);
    const node = new TypeDefinitionNode(name, valueType);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitUsingLibraryFor(ctx: UsingLibraryForContext): UsingForDirectiveNode {
    const libraryName = ctx.Identifier().getText();
    const typeNameCtx = ctx.typeName();
    const arrayTypeCtx = ctx.arrayType();
    const mappingTypeCtx = ctx.mappingType();
    const isWildcard = !typeNameCtx && !arrayTypeCtx && !mappingTypeCtx;
    // An array (`using Array for uint256[]`) or mapping (`using L for mapping(uint=>uint)`) target keys on the
    // canonical type string so an array/mapping-typed receiver matches; a plain type keys on its source text
    // (struct names etc.) as before.
    const targetTypeName = isWildcard ? undefined
      : arrayTypeCtx ? this.buildArrayType(arrayTypeCtx).toString()
        : mappingTypeCtx ? this.buildMappingType(mappingTypeCtx).toString()
          : typeNameCtx!.getText();
    if (this.solidityImportCompat && !this.libraryNames.has(libraryName) && !this.sourceHasImports) {
      throw new ParseError(`Identifier '${libraryName}' is not a library name`, Location.fromCtx(ctx));
    }
    if (this.solidityImportCompat && targetTypeName && this.libraryNames.has(targetTypeName)) {
      throw new ParseError('Invalid use of a library name as a using-for target type', Location.fromCtx(ctx));
    }
    const isGlobal = ctx.getText().includes('global');
    if (this.solidityImportCompat && isGlobal
      && (!targetTypeName || !this.typeDefMap.has(targetTypeName))) {
      throw new ParseError('Can only use "global" with user-defined value types', Location.fromCtx(ctx));
    }
    const node = new UsingForDirectiveNode(libraryName, undefined, targetTypeName, isWildcard, isGlobal);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitUsingFunctionsFor(ctx: UsingFunctionsForContext): UsingForDirectiveNode {
    const bindings: UsingForBinding[] = ctx.usingFunctionBinding_list().map((b) => {
      const ids = b.Identifier_list();
      const funcName = ids.length === 2 ? `${ids[0].getText()}.${ids[1].getText()}` : ids[0].getText();
      const opCtx = b.userDefinableOperator();
      const operator = opCtx ? opCtx.getText() : undefined;
      return { funcName, operator };
    });
    const typeNameCtx = ctx.typeName();
    const arrayTypeCtx = ctx.arrayType();
    const isWildcard = !typeNameCtx && !arrayTypeCtx;
    const targetTypeName = isWildcard ? undefined
      : arrayTypeCtx ? this.buildArrayType(arrayTypeCtx).toString()
        : typeNameCtx!.getText();
    const isGlobal = ctx.getText().includes('global');
    if (this.solidityImportCompat && isGlobal
      && (!targetTypeName || !this.typeDefMap.has(targetTypeName))) {
      throw new ParseError('Can only use "global" with user-defined value types', Location.fromCtx(ctx));
    }
    if (this.solidityImportCompat && isWildcard) {
      throw new ParseError(
        'The type has to be specified explicitly when attaching specific functions',
        Location.fromCtx(ctx),
      );
    }
    const node = new UsingForDirectiveNode(undefined, bindings, targetTypeName, isWildcard, isGlobal);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitLibraryDefinition(_ctx: LibraryDefinitionContext): Node {
    // Library definitions are handled inline in visitSourceFile
    // This method should not be called directly
    throw new Error('visitLibraryDefinition should be handled by visitSourceFile');
  }

  visitInterfaceDefinition(ctx: InterfaceDefinitionContext): InterfaceNode {
    const identifiers = ctx.Identifier_list();
    const name = identifiers[0].getText();
    const parentNames = identifiers.slice(1).map((id) => id.getText());
    const invalidOperatorDirective = this.solidityImportCompat
      ? ctx.usingForDirective_list().find((directiveContext) => {
        const directive = this.visit(directiveContext) as UsingForDirectiveNode;
        return directive.functionBindings?.some((binding) => binding.operator) ?? false;
      })
      : undefined;
    if (invalidOperatorDirective) {
      throw new ParseError(
        'Operators can only be defined in a file-level global "using for" directive',
        Location.fromCtx(invalidOperatorDirective),
      );
    }

    // Interface-level enum definitions
    const enumDefs = ctx.enumDefinition_list().map((e) => this.visitEnumDefinition(e));

    // Interface-level struct definitions (must be registered before collection type resolution)
    const structDefs: StructDefinitionNode[] = [];
    this.registerStructDefinitions(ctx.structDefinition_list(), structDefs);

    // Interface-level type definitions
    const typeDefs: TypeDefinitionNode[] = [];
    for (const tdCtx of ctx.typeDefinition_list()) {
      const td = this.visitTypeDefinition(tdCtx);
      typeDefs.push(td);
    }

    // Interface-level event definitions
    const eventDefs = ctx.eventDefinition_list().map((evCtx) => this.visitEventDefinition(evCtx));

    // Interface-level error definitions (OZ v5 declares custom errors in interfaces like IERC20Errors)
    const errorDefs = ctx.errorDefinition_list().map((erCtx) => this.visitErrorDefinition(erCtx));

    const stateVariables = ctx.interfaceStateVariable_list().map(
      (sv) => this.visitInterfaceStateVariable(sv),
    );
    const collections = ctx.interfaceCollection_list().map(
      (c) => this.visitInterfaceCollection(c),
    );
    const functions = ctx.interfaceFunction_list().map(
      (f) => this.visitInterfaceFunction(f),
    );
    const node = new InterfaceNode(
      name, stateVariables, collections, functions, structDefs, enumDefs, typeDefs, eventDefs, errorDefs,
    );
    node.parents = parentNames;
    node.hasFallback = ctx.interfaceFallbackDefinition_list().length > 0;
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitInterfaceCollection(ctx: InterfaceCollectionContext): InterfaceCollectionNode {
    const visCtx = ctx.interfaceStateVariableVisibility();
    const visibility = visCtx.getText() as StateVariableVisibility.PUBLIC | StateVariableVisibility.EXTERNAL;
    const name = ctx.Identifier().getText();

    let type: MappingType | ArrayType;
    if (ctx.mappingType()) {
      type = this.buildMappingType(ctx.mappingType()!);
    } else {
      type = this.buildArrayType(ctx.arrayType()!);
    }

    const node = new InterfaceCollectionNode(type, name, visibility);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitInterfaceStateVariable(ctx: InterfaceStateVariableContext): InterfaceStateVariableNode {
    const visCtx = ctx.interfaceStateVariableVisibility();
    const visibility = visCtx.getText() as StateVariableVisibility.PUBLIC | StateVariableVisibility.EXTERNAL;
    const type = this.resolveType(ctx.typeName().getText());
    const name = ctx.Identifier().getText();
    const node = new InterfaceStateVariableNode(type, name, visibility);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitInterfaceFunction(ctx: InterfaceFunctionContext): InterfaceFunctionNode {
    const name = ctx.functionName().getText();
    const parameters = ctx.parameterList().parameter_list().map((p) => this.visit(p) as ParameterNode);

    let returnTypes: Type[] = [];
    const returnTypeCtx = ctx.returnType();
    if (returnTypeCtx) {
      returnTypes = returnTypeCtx.returnParam_list().map((p) => this.returnParamType(p));
    }

    const modifierTexts = ctx.functionModifier_list().map((modifier) => modifier.getText());
    if (this.solidityImportCompat && !modifierTexts.includes('external')) {
      throw new ParseError(
        'Functions in interfaces must be declared external',
        Location.fromCtx(ctx),
      );
    }
    const stateMutability = modifierTexts.includes('pure') ? 'pure'
      : modifierTexts.includes('view') ? 'view'
        : modifierTexts.includes('payable') ? 'payable' : 'nonpayable';
    const node = new InterfaceFunctionNode(name, parameters, returnTypes, stateMutability);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitFieldAccess(ctx: FieldAccessContext): ExpressionNode {
    let expression = this.visit(ctx.expression());
    const memberCtx = ctx.memberName();
    // memberName can be '.' Identifier or a dotted token like '.value'
    const fieldName = memberCtx.Identifier()
      ? memberCtx.Identifier().getText()
      : memberCtx.getText().slice(1); // strip leading '.'

    // Storage-pointer read: `alias.field` -> `container[keys].field` (clone the access path per use site).
    if (expression instanceof IdentifierNode && this.storageAliases.has(expression.name)) {
      expression = cloneNode(this.storageAliases.get(expression.name)!.access);
    }

    // The current contract name may qualify its own state (`C.a`, including `C.a[i]` and `C.a.length`).
    // This is a scope qualifier, not a struct/member base; reduce it to the ordinary bare state read.
    if (expression instanceof IdentifierNode && expression.name === this.currentContractName
      && this.stateVarNames.has(fieldName)) {
      const state = new IdentifierNode(fieldName);
      state.location = Location.fromCtx(ctx);
      return state;
    }

    // Mapping-bearing struct state var: `<var>.<field>` resolves to the flattened state element `<var>__<field>`.
    if (expression instanceof IdentifierNode && this.mappingStructStateVars.has(expression.name)
      && this.mappingStructStateVars.get(expression.name)!.fields.some((f) => f.name === fieldName)) {
      const flat = new IdentifierNode(`${expression.name}__${fieldName}`);
      flat.location = Location.fromCtx(ctx);
      return flat;
    }

    // Mapping-of-flattened-struct read: `providers[k].<field>` -> `providers__<field>[k]` (prepend the outer
    // key(s) into the flattened nested state mapping). Enables `providers[k].data[k2]...`.
    const msvPath = this.extractStorageAccessPath(expression);
    if (msvPath && this.mappingStructValueVars.has(msvPath.container)
      && this.mappingStructValueVars.get(msvPath.container)!.fields.some((f) => f.name === fieldName)) {
      let acc: ExpressionNode = new IdentifierNode(`${msvPath.container}__${fieldName}`);
      acc.location = Location.fromCtx(ctx);
      for (const k of msvPath.keys) {
        const next = new ArrayAccessNode(acc, cloneNode(k));
        next.location = Location.fromCtx(ctx);
        acc = next;
      }
      return acc;
    }

    // Preserve scoped enum qualification. Erasing `I.`/`L.` would silently bind `Q.E.Member` to whichever bare
    // enum named `E` happened to be registered last.
    if (expression instanceof IdentifierNode
      && this.qualifiedEnumMap.has(`${expression.name}.${fieldName}`)) {
      const qualified = new IdentifierNode(`${expression.name}.${fieldName}`);
      qualified.location = Location.fromCtx(ctx);
      return qualified;
    }

    // Namespaced TYPE access `Q.T` where Q is a library / contract / interface and T is a globally-registered
    // enum / UDVT / struct -> the bare type, so `Q.T.Member` / `Q.T.wrap` / `Q.T`-as-type behave like the
    // unqualified type (types are registered under their bare name, so this is a pure requalification).
    if (expression instanceof IdentifierNode
      && (this.libraryNames.has(expression.name) || this.contractInterfaceNames.has(expression.name))
      && (this.enumMap.has(fieldName) || this.typeDefMap.has(fieldName) || this.structMap.has(fieldName))) {
      const bare = new IdentifierNode(fieldName);
      bare.location = Location.fromCtx(ctx);
      return bare;
    }
    const node = new FieldAccessNode(expression, fieldName);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitTypeIntrospection(ctx: TypeIntrospectionContext): TypeIntrospectionNode {
    const typeText = ctx.typeIntrospectionBase().typeName().getText();
    const property = ctx.Identifier().getText();
    const node = new TypeIntrospectionNode(typeText, property);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitBareTypeExpressionStatement(ctx: any): BlockNode {
    const typeText = ctx.typeName().getText();
    if (this.structMap.has(typeText)) {
      throw new ParseError(
        `Invalid struct type '${typeText}' for type() introspection`,
        Location.fromCtx(ctx),
      );
    }
    const node = new BlockNode([]);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  private parseCallOptions(ctx: CallOptionsContext | undefined): CallOptions | undefined {
    if (!ctx) return undefined;
    const options: CallOptions = {};
    const seen = new Set<string>();
    for (const opt of ctx.callOption_list()) {
      const name = opt.Identifier().getText();
      if (seen.has(name)) {
        throw new ParseError(`Duplicate call option '${name}'`, Location.fromCtx(opt));
      }
      seen.add(name);
      const expr = this.visit(opt.expression()) as ExpressionNode;
      if (name === 'value') {
        options.value = expr;
      } else if (name === 'salt') {
        options.salt = expr;
      } else if (name === 'gas') {
        options.gas = expr;
        const line = this.diagLine(opt.start?.line);
        console.log(`Warning: 'gas' call option is a no-op in SolidCash${line}. BCH does not use gas metering.`);
      } else {
        throw new ParseError(
          `Unknown call option '${name}'. Only 'value', 'salt', and 'gas' are supported`,
          Location.fromCtx(opt),
        );
      }
    }
    return (options.value || options.gas || options.salt) ? options : undefined;
  }

  // Legacy 0.6.x low-level-call option syntax `target.call.value(v)(data)` / `.call.gas(g)(data)`. Desugar to the
  // modern `target.call{value:v}(data)` shape (a MethodCall carrying callOptions) that SymbolTable already lowers.
  visitLegacyCallOptionCall(ctx: LegacyCallOptionCallContext): ExpressionNode {
    const object = this.visit(ctx.expression(0));
    const methodName = ctx.Identifier(0).getText();
    // `.value` lexes as the DotValue token (no second Identifier); `.gas` (and any other) is `'.' Identifier`.
    const optName = ctx.Identifier_list().length === 2 ? ctx.Identifier(1).getText() : 'value';
    if (methodName !== 'call' && methodName !== 'staticcall' && methodName !== 'delegatecall') {
      throw new ParseError(
        `Legacy call-option syntax '.${methodName}.${optName}(..)(..)' is only valid on call/staticcall/delegatecall`,
        Location.fromCtx(ctx),
      );
    }
    const optExpr = this.visit(ctx.expression(1)) as ExpressionNode;
    const callOpts: CallOptions = {};
    if (optName === 'value') {
      callOpts.value = optExpr;
    } else if (optName === 'gas') {
      callOpts.gas = optExpr;
      const line = this.diagLine(ctx.start?.line);
      console.log(`Warning: 'gas' call option is a no-op in SolidCash${line}. BCH does not use gas metering.`);
    } else {
      throw new ParseError(
        `Unknown legacy call option '.${optName}(..)'. Only 'value' and 'gas' are supported`,
        Location.fromCtx(ctx),
      );
    }
    if (callOpts.value && (methodName === 'staticcall' || methodName === 'delegatecall')) {
      throw new ParseError(
        `Cannot set call option 'value' for ${methodName}`,
        Location.fromCtx(ctx),
      );
    }
    const parameters = this.buildCallArguments(ctx.expressionList()!) as ExpressionNode[];
    const node = new MethodCallNode(object, methodName, parameters);
    node.callOptions = callOpts;
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitMethodCall(ctx: MethodCallContext): ExpressionNode {
    const object = this.visit(ctx.expression());
    const methodName = ctx.anyIdentifier()?.getText()
      ?? (ctx.getText().includes('.value') ? 'value' : 'length');
    const parameters = this.buildCallArguments(ctx.expressionList()!);
    const callOpts = this.parseCallOptions(ctx.callOptions());
    return this.buildMethodCall(
      ctx, object, methodName, parameters, callOpts, ctx.expression().getText() === 'this',
    );
  }

  private buildMethodCall(
    ctx: ParserRuleContext,
    object: ExpressionNode,
    methodName: string,
    parameters: ExpressionNode[],
    callOpts: CallOptions | undefined,
    isThisReceiver: boolean,
  ): ExpressionNode {
    if (callOpts?.value && (methodName === 'staticcall' || methodName === 'delegatecall')) {
      throw new ParseError(
        `Cannot set call option 'value' for ${methodName}`,
        Location.fromCtx(ctx),
      );
    }
    // UDVT wrap/unwrap reached as a method call: `C.T.unwrap(x)` strips (visitFieldAccess) to object = bare `T`,
    // an IdentifierNode naming a UDVT, so it arrives here instead of the 2-identifier FunctionCall form. Emit
    // the same identity cast (unwrap -> underlying; wrap -> underlying then the UDVT). typeDefMap distinguishes it.
    if (object instanceof IdentifierNode && parameters.length === 1
      && (methodName === 'wrap' || methodName === 'unwrap')) {
      const udvt = this.typeDefMap.get(object.name);
      if (udvt) {
        const arg = parameters[0] as ExpressionNode;
        const toUnderlying = new CastNode(udvt.underlyingType, arg, false);
        toUnderlying.location = Location.fromCtx(ctx);
        if (methodName === 'unwrap') return toUnderlying;
        const cast = new CastNode(udvt, toUnderlying, false);
        cast.location = Location.fromCtx(ctx);
        return cast;
      }
    }

    // .send(amount) on an address produces AddressSendExpressionNode
    if (methodName === 'send' && parameters.length === 1) {
      if (callOpts?.value) {
        throw new ParseError(
          "'{value}' call option is not applicable to '.send()' - the amount is already specified as the argument",
          Location.fromCtx(ctx),
        );
      }
      const node = new AddressSendExpressionNode(object, parameters[0]);
      node.location = Location.fromCtx(ctx);
      return node;
    }

    // `this.f(args)` / `Base(this).f(args)`: an external self-call to the contract's OWN function `f`. A cast to
    // a base/interface still performs virtual dispatch in Solidity, so the most-derived implementation is the
    // same direct function selected by `this.f`. On BCH the covenant IS the
    // contract, so resolve it to a direct call to `f` (a subroutine). Solidity's external-self-call semantics
    // (fresh calldata, `msg.sender` = the contract) do not apply here.
    const selfCastReceiver = object instanceof FunctionCallNode && object.parameters.length === 1
      && this.contractInterfaceNames.has(object.identifier.name)
      && this.currentContractFunctionNames.has(methodName)
      && object.parameters[0] instanceof UnaryOpNode
      && object.parameters[0].operator === UnaryOperator.INPUT_LOCKING_BYTECODE;
    if (isThisReceiver || selfCastReceiver) {
      const line = `:${Location.fromCtx(ctx).start.line}`;
      // `{value:..}` / `{gas:..}` call options are EVM message-call semantics; a self-call is a direct subroutine
      // on BCH, so they are inert and dropped (like the other EVM shims).
      const optNote = callOpts ? ' ({value}/{gas} call options are inert on a self-call and ignored)' : '';
      const spelling = selfCastReceiver ? `${object.identifier.name}(this).${methodName}` : `this.${methodName}`;
      console.log(`Warning: '${spelling}(...)'${line} is an external self-call in Solidity; on BCH it is a `
        + `direct internal call to '${methodName}' (no separate calldata, msg.sender is not re-set to self)${optNote}.`);
      const id = new IdentifierNode(methodName);
      id.location = Location.fromCtx(ctx);
      const call = new FunctionCallNode(id, parameters as ExpressionNode[]);
      call.fromThisCall = true;
      call.location = Location.fromCtx(ctx);
      return call;
    }

    // using-for: `recv.method(args)` where recv is a struct var bound to a library -> `Library.method(recv, args)`.
    if (this.usingForLibraries.size > 0) {
      const recvName = object instanceof IdentifierNode ? object.name
        : object instanceof StateAccessNode ? object.name : undefined;
      const recvStruct = recvName !== undefined
        ? (this.localStructTypes.get(recvName) ?? this.stateStructVars.get(recvName)
          ?? this.mappingStructStateVars.get(recvName))
        : undefined;
      const simpleKey = recvName !== undefined ? this.localSimpleTypeKeys.get(recvName) : undefined;
      const libName = (recvStruct && this.usingForLibraries.get(recvStruct.name))
        ?? (recvName !== undefined ? this.usingForArrayLibrary(recvName) : undefined)
        ?? this.usingForSimpleLibrary(recvName, simpleKey);
      if (libName) {
        const id = new IdentifierNode(`${libName}.${methodName}`);
        id.location = Location.fromCtx(ctx);
        const call = new FunctionCallNode(id, [object, ...parameters]);
        call.location = Location.fromCtx(ctx);
        return call;
      }
    }

    const node = new MethodCallNode(object, methodName, parameters);
    node.callOptions = callOpts;
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // Named-arg method call: obj.f({a: x, b: y}). Args are reordered against the callee's params in semantic analysis.
  visitMethodCallNamed(ctx: MethodCallNamedContext): ExpressionNode {
    if (this.solidityImportCompat && /,\}\)$/.test(ctx.getText())) {
      throw new ParseError('Unexpected trailing comma in named arguments', Location.fromCtx(ctx));
    }
    const object = this.visit(ctx.expression());
    const methodName = ctx.Identifier().getText();
    const namedArgs = ctx.namedArg_list();
    const parameters = namedArgs.map((na) => this.visit(na.expression()) as ExpressionNode);
    // `L.f({named})` where L is a library -> a namespaced library function call `L.f(...)` (matches the positional
    // `L.f(a, b)`, which parses as a FunctionCall). Otherwise it stays a method call on the receiver.
    if (object instanceof IdentifierNode && this.libraryNames.has(object.name)) {
      const id = new IdentifierNode(`${object.name}.${methodName}`);
      id.location = Location.fromCtx(ctx);
      const call = new FunctionCallNode(id, parameters);
      call.fieldNames = namedArgs.map((na) => na.Identifier().getText());
      call.location = Location.fromCtx(ctx);
      return call;
    }
    // using-for: `recv.method({named})` where recv's type is bound to a library -> `Library.method(recv,
    // named...)`. The receiver stays POSITIONAL (fieldNames name only the tail); resolution and the inline
    // passes reorder the tail against the callee's params minus the receiver.
    if (object instanceof IdentifierNode && this.usingForLibraries.size > 0) {
      const recvName = object.name;
      const recvStruct = this.localStructTypes.get(recvName) ?? this.stateStructVars.get(recvName)
        ?? this.mappingStructStateVars.get(recvName);
      const simpleKey = this.localSimpleTypeKeys.get(recvName);
      const libName = (recvStruct && this.usingForLibraries.get(recvStruct.name))
        ?? this.usingForArrayLibrary(recvName)
        ?? this.usingForMappingLibrary(recvName)
        ?? this.usingForSimpleLibrary(recvName, simpleKey);
      if (libName) {
        const libId = new IdentifierNode(`${libName}.${methodName}`);
        libId.location = Location.fromCtx(ctx);
        const call = new FunctionCallNode(libId, [object, ...parameters]);
        call.fieldNames = namedArgs.map((na) => na.Identifier().getText());
        call.location = Location.fromCtx(ctx);
        return call;
      }
    }
    const node = new MethodCallNode(object, methodName, parameters);
    node.fieldNames = namedArgs.map((na) => na.Identifier().getText());
    node.callOptions = this.parseCallOptions(ctx.callOptions());
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // Flatten BlockNode statements into the parent list (used for for-loop desugaring)
  private flattenStatements(statements: StatementNode[]): StatementNode[] {
    return statements.flatMap(
      (s) => (s instanceof BlockNode && s.statements && !s.scoped) ? s.statements : [s],
    );
  }

  private resolveType(typeText: string): Type {
    // Function-type parameter names are retained by the compatibility grammar inside typeName.getText(), where
    // whitespace is absent (`function(bytes6 _name,uint _shift)` -> `function(bytes6_name,uint_shift)`).
    // Separate underscore-prefixed names from bounded primitive members before the shared type parser sees them;
    // otherwise `bytes6_name` is mistaken for a malformed bytes bound and throws before optional-name recovery.
    if (typeText.startsWith('function(')) {
      typeText = typeText.replace(
        /\b(bytes(?:[1-9][0-9]*)|u?int(?:[0-9]+)?|u?fixed(?:[0-9]+x[0-9]+)?)_[A-Za-z_$][A-Za-z0-9_$]*(?=[,)])/g,
        '$1',
      );
    }
    // Handle 'addresspayable' from grammar (two tokens concatenated without space)
    if (typeText === 'addresspayable') return new AddressType(true);
    if (typeText === 'address') return new AddressType(false);
    // Library-qualified type (Solidity `Library.Type`): library types are registered bare, so resolve post-dot.
    if (typeText.includes('.')) {
      const bare = typeText.slice(typeText.lastIndexOf('.') + 1);
      const qualified = this.structMap.get(bare) ?? this.enumMap.get(bare) ?? this.typeDefMap.get(bare);
      if (qualified) return qualified;
    }
    const structType = this.structMap.get(typeText);
    if (structType) return structType;
    const enumType = this.enumMap.get(typeText);
    if (enumType) return enumType;
    const valueType = this.typeDefMap.get(typeText);
    if (valueType) return valueType;
    if (this.solidityImportCompat && this.nonTypeNames.has(typeText)) {
      throw new ParseError('Name has to refer to a user-defined type');
    }
    this.validateBoundedIntType(typeText);
    this.validateFixedType(typeText);
    return parseType(typeText);
  }

  // Named struct-typed returns participate in struct-field-write desugaring (`s.x = v` on a named return
  // rebuilds the struct like a local, before NamedReturnTransformation declares it); same registration for
  // unbounded-bytes named returns (element writes). Runs BEFORE the body build - applyReturnType later only
  // attaches the metadata to the node.
  private registerNamedReturnLocals(ctx: ReturnTypeContext | null): void {
    if (!ctx) return;
    for (const p of ctx.returnParam_list()) {
      const nm = p.anyIdentifier()?.getText();
      if (!nm) continue;
      const t = this.returnParamType(p);
      if (t instanceof StructType) this.localStructTypes.set(nm, t);
      if (t instanceof BytesType && t.bound === undefined) this.localBytesVars.add(nm);
      this.recordUsingForReceiver(nm, t);
    }
  }

  // Resolve a return parameter's type (a plain type, or an array type like `uint256[] memory`).
  private returnParamType(p: ReturnParamContext): Type {
    if (p.arrayType()) return this.buildArrayType(p.arrayType()!);
    if (p.mappingType()) return this.buildMappingType(p.mappingType()!);
    // Keep the unresolved type NAME on the placeholder (like param/state-var types do), so an imported struct
    // return `returns (Escrow memory)` re-resolves to the real struct once imports merge (reresolveImportedStructTypes).
    const tn = p.typeName()!.getText();
    return this.resolveType(tn) ?? new AddressType(false, tn);
  }

  // Populate returnTypes and (optionally) returnNames from a `returns (...)` clause.
  private applyReturnType(fn: FunctionDefinitionNode, ctx: ReturnTypeContext): void {
    const params = ctx.returnParam_list();
    if (this.solidityImportCompat) {
      for (const param of params) {
        const modifiers = param.modifier_list().map((modifier) => modifier.getText());
        const invalid = modifiers.find((modifier) => modifier === Modifier.CONSTANT
          || modifier === Modifier.IMMUTABLE);
        if (invalid) {
          throw new ParseError(
            invalid === Modifier.CONSTANT
              ? 'The "constant" keyword can only be used for state variables or variables at file level'
              : 'The "immutable" keyword can only be used for state variables',
            Location.fromCtx(param),
          );
        }
      }
    }
    fn.returnTypes = params.map((p) => this.returnParamType(p));
    fn.returnModifiers = params.map((p) => p.modifier_list().map((m) => m.getText()));
    const named = params.filter((p) => p.anyIdentifier() !== null);
    // Solidity allows a mix of named and unnamed return values (always on, the default). Synthesize a name for
    // each unnamed slot so all are named (a named return may be returned implicitly; an explicit `return (...)`
    // overrides).
    if (named.length > 0) {
      fn.returnNames = params.map((p, i) => (p.anyIdentifier() ? p.anyIdentifier()!.getText() : `__ret_${i}`));
    }
  }

  private validateBoundedIntType(typeText: string): void {
    const intMatch = typeText.match(/^(u?int)(\d+)$/);
    if (intMatch) {
      const bits = parseInt(intMatch[2], 10);
      if (!IntType.isValidBitWidth(bits)) {
        throw new ParseError(
          `Invalid bounded integer type '${typeText}': bit width must be a multiple of 8, between 8 and 256`,
        );
      }
    }
  }

  private validateFixedType(typeText: string): void {
    if (/^u?fixed(\d+x\d+)?$/.test(typeText)) warnFixedPointOnce();
    const fixedMatch = typeText.match(/^(u?fixed)(\d+)x(\d+)$/);
    if (fixedMatch) {
      const bits = parseInt(fixedMatch[2], 10);
      const decimals = parseInt(fixedMatch[3], 10);
      if (!FixedType.isValidBitWidth(bits)) {
        throw new ParseError(
          `Invalid fixed-point type '${typeText}': bit width must be a multiple of 8, between 8 and 256`,
        );
      }
      if (!FixedType.isValidDecimals(decimals)) {
        throw new ParseError(
          `Invalid fixed-point type '${typeText}': decimal places must be between 0 and 80`,
        );
      }
    }
  }

  visitConsoleStatement(ctx: ConsoleStatementContext): ConsoleStatementNode {
    const parameters = ctx.consoleParameterList()
      .consoleParameter_list()
      .map((p) => this.visit(p) as ConsoleParameterNode);

    const node = new ConsoleStatementNode(parameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitConsoleParameter(ctx: ConsoleParameterContext): ConsoleParameterNode {
    const node = ctx.literal() ? this.createLiteral(ctx.literal()) : new IdentifierNode(ctx.Identifier().getText());
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitAbiEncode(ctx: AbiEncodeContext): AbiEncodeNode {
    const parameters = this.buildCallArguments(ctx.expressionList()!);
    const node = new AbiEncodeNode(parameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitAbiEncodePacked(ctx: AbiEncodePackedContext): AbiEncodePackedNode {
    const parameters = this.buildCallArguments(ctx.expressionList()!);
    const node = new AbiEncodePackedNode(parameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitAbiEncodeWithSelector(ctx: AbiEncodeWithSelectorContext): AbiEncodeWithSelectorNode {
    const exprs = this.buildCallArguments(ctx.expressionList()!);
    const node = new AbiEncodeWithSelectorNode(exprs[0], exprs.slice(1));
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitAbiEncodeWithSignature(ctx: AbiEncodeWithSignatureContext): AbiEncodeWithSignatureNode {
    const exprs = this.buildCallArguments(ctx.expressionList()!);
    const node = new AbiEncodeWithSignatureNode(exprs[0], exprs.slice(1));
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitAbiEncodeCall(ctx: AbiEncodeCallContext): AbiEncodeCallNode {
    const targetText = ctx.getText().slice('abi.encodeCall('.length).split(',')[0];
    let interfaceName: string;
    let functionName: string;
    const indexedMethod = this.indexedExternalFunctionAliases.get(targetText);
    if (indexedMethod) {
      interfaceName = 'this';
      functionName = indexedMethod;
    } else if (targetText.includes('.')) {
      [interfaceName, functionName] = targetText.split('.');
    } else {
      const helperName = targetText.endsWith('()') ? targetText.slice(0, -2) : undefined;
      const aliasedMethod = helperName
        ? this.selfExternalFunctionReturnAliases.get(helperName)
        : this.selfExternalFunctionAliases.get(targetText);
      if (!aliasedMethod) {
        throw new ParseError(
          `abi.encodeCall function pointer '${targetText}' must resolve directly to this.<method>`,
          Location.fromCtx(ctx),
        );
      }
      interfaceName = 'this';
      functionName = aliasedMethod;
    }
    const argsCtx = ctx.abiEncodeCallArguments();
    const argExpression = argsCtx.expression();
    let params: ExpressionNode[];
    if (argsCtx._aop) {
      const target = argsCtx._target;
      const assign = this.buildCompoundAssign(
        target.text,
        Location.fromToken(target),
        argsCtx._aop.text,
        argExpression!,
        Location.fromCtx(argsCtx),
      );
      const assignment = new AssignmentExpressionNode(assign);
      assignment.location = Location.fromCtx(argsCtx);
      params = [assignment];
    } else {
      params = !argExpression
        ? []
        : argExpression instanceof TupleExpressionContext
          ? argExpression.expression_list().map((e) => this.visit(e) as ExpressionNode)
          : [this.visit(argExpression) as ExpressionNode];
    }
    const node = new AbiEncodeCallNode(interfaceName, functionName, params);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitBytesConcat(ctx: BytesConcatContext): BytesConcatNode {
    const parameters = this.buildCallArguments(ctx.expressionList()!);
    const node = new BytesConcatNode(parameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitStringConcat(ctx: StringConcatContext): StringConcatNode {
    const parameters = this.buildCallArguments(ctx.expressionList()!);
    const node = new StringConcatNode(parameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // Resolve one abi.decode type-list item. parseType handles primitives + arrays; a contract-type element
  // (`C[]`) parses to an array with an UNDEFINED element (parseType does not know user contracts), so replace an
  // undefined array element with a named AddressType placeholder - a contract handle is an address on BCH, so
  // `C[]` decodes as address[], matching a `C[]` return/variable type.
  private resolveAbiDecodeType(text: string): Type {
    // Solidity accepts redundant *unitary tuple* parentheses in ABI type lists (`((uint))`, `(uint)[2]`).
    // They do not add an ABI tuple layer: peel each balanced one-item wrapper while retaining array suffixes.
    for (;;) {
      if (!text.startsWith('(')) break;
      let depth = 0;
      let close = -1;
      for (let i = 0; i < text.length; i += 1) {
        if (text[i] === '(') depth += 1;
        else if (text[i] === ')' && --depth === 0) { close = i; break; }
      }
      if (close < 0 || !/^(?:\[[^\]]*\])*$/.test(text.slice(close + 1))) break;
      text = text.slice(1, close) + text.slice(close + 1);
    }
    const ty = parseType(text) ?? this.resolveType(text);
    // An interface/contract-typed decode item (`abi.decode(data, (IERC20))`, BentoBox/Kashi) has no primitive or
    // struct type - a contract/interface handle is an address on BCH, so decode it as an address (matching the `C[]`
    // array-element default below and the function/event-param convention `resolveType(t) ?? AddressType`). Covers
    // a KNOWN interface/contract name, or an uppercase-initial simple identifier (an imported interface not in this
    // file's registry - a malformed int/fixed type has already thrown in resolveType via validateBounded*).
    if (!ty && (this.contractInterfaceNames.has(text) || /^[A-Z][A-Za-z0-9_$]*$/.test(text))) {
      return new AddressType(false, text);
    }
    if (!ty) throw new Error(`Unsupported type '${text}' in abi.decode`);
    const elemName = text.replace(/(\[\])+$/, '');
    const fixup = (t: Type): Type => {
      if (t instanceof ArrayType) {
        // preserve the bound: a fixed-size array (uint256[3]) must stay bounded, not collapse to a dynamic array
        return new ArrayType(
          t.elementType === undefined ? new AddressType(false, elemName) : fixup(t.elementType),
          t.bound,
        );
      }
      return t;
    };
    return fixup(ty);
  }

  visitAbiDecode(ctx: AbiDecodeContext): AbiDecodeNode {
    const data = this.visit(ctx.expression());
    const schema = ctx.typeList().typeListItem_list().map((t) => this.resolveAbiDecodeType(t.getText()));
    const node = new AbiDecodeNode(data, schema);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitAbiDecodeAt(ctx: AbiDecodeAtContext): AbiDecodeAtNode {
    const data = this.visit(ctx.expression());
    const schema = ctx.typeList().typeListItem_list().map((t) => this.resolveAbiDecodeType(t.getText()));
    const index = parseInt(ctx.NumberLiteral().getText(), 10);
    const node = new AbiDecodeAtNode(data, schema, index);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitEventDefinition(ctx: EventDefinitionContext): EventDefinitionNode {
    const eventName = ctx.anyIdentifier()?.getText() ?? ctx._eventSpecialName.text;
    const parameters = ctx.eventParameter_list().map((paramCtx, i) => {
      const indexed = paramCtx.children?.some((c) => c.getText() === 'indexed') === true;
      const tn = paramCtx.typeName();
      // An event parameter may be a plain type or an array type (`int[]`, `bytes20[3]`). An unknown type name is
      // a contract reference (address on BCH) - default it, as function params do, so it is never undefined.
      const type = tn
        ? (this.resolveType(tn.getText()) ?? new AddressType(false, tn.getText()))
        : this.buildArrayType(paramCtx.arrayType()!);
      // The name is optional in Solidity (`event Deploy(address)`); the signature uses types only, so a
      // synthetic name for an unnamed param is internal-only.
      const idCtx = paramCtx.anyIdentifier();
      return {
        name: idCtx ? idCtx.getText() : `__unnamed${i}`,
        type,
        ...(indexed && { indexed: true }),
      };
    });
    const isAnonymous = ctx.children?.some((c) => c.getText() === 'anonymous') === true;
    const indexedCount = parameters.filter((parameter) => parameter.indexed).length;
    const maxIndexed = isAnonymous ? 4 : 3;
    if (this.solidityImportCompat && indexedCount > maxIndexed) {
      throw new ParseError(
        `More than ${maxIndexed} indexed arguments for ${isAnonymous ? 'anonymous ' : ''}event`,
        Location.fromCtx(ctx),
      );
    }
    const node = new EventDefinitionNode(eventName, parameters);
    node.isAnonymous = isAnonymous;
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitErrorDefinition(ctx: ErrorDefinitionContext): ErrorDefinitionNode {
    const errorName = ctx.anyIdentifier().getText();
    if (this.solidityImportCompat && (errorName === 'Error' || errorName === 'Panic')) {
      throw new ParseError(
        'The built-in errors "Error" and "Panic" cannot be re-defined',
        Location.fromCtx(ctx),
      );
    }
    const parameters = ctx.errorParameter_list().map((paramCtx, i) => ({
      // The name is optional in Solidity (`error Bad(uint256)`); synthesize one for an unnamed param.
      name: paramCtx.anyIdentifier() ? paramCtx.anyIdentifier()!.getText() : `__unnamed${i}`,
      type: paramCtx.typeName()
        ? this.resolveType(paramCtx.typeName().getText())
        : this.buildArrayType(paramCtx.arrayType()!),
    }));
    if (this.solidityImportCompat && parameters.some((parameter) =>
      !this.isValidSolidityErrorParameter(parameter.type))) {
      throw new ParseError(
        'Internal or recursive type is not allowed as error parameter type',
        Location.fromCtx(ctx),
      );
    }
    const node = new ErrorDefinitionNode(errorName, parameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  private isValidSolidityErrorParameter(type: Type | undefined, activeStructs = new Set<string>()): boolean {
    if (!type) return false;
    if (type instanceof FunctionType) return type.isExternal;
    if (type instanceof MappingType) return false;
    if (type instanceof ArrayType) return this.isValidSolidityErrorParameter(type.elementType, activeStructs);
    if (type instanceof StructType) {
      if (activeStructs.has(type.name)) return false;
      const nested = new Set(activeStructs).add(type.name);
      return (type.fields ?? []).every((field) => this.isValidSolidityErrorParameter(field.type, nested));
    }
    return true;
  }

  visitSelfdestructStatement(ctx: SelfdestructStatementContext): SelfdestructStatementNode {
    const recipient = this.visit(ctx.expression()) as ExpressionNode;
    const node = new SelfdestructStatementNode(recipient);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitRevertStatement(ctx: RevertStatementContext): RevertNode {
    let node: RevertNode;
    // Grammar: `revert anyIdentifier ('.' Identifier)?`. Qualified `revert Lib.Error(..)` -> trailing Identifier
    // is the bare error name; unqualified -> the anyIdentifier (which may be a soft keyword like `error`).
    const anyId = ctx.anyIdentifier();
    if (anyId) {
      const errorName = ctx.Identifier() ? ctx.Identifier()!.getText() : anyId.getText();
      if (!ctx.expressionList()) {
        // Named-arg form: revert E({a: x, b: y})
        const namedArgs = ctx.namedArg_list();
        const args = namedArgs.map((na) => this.visit(na.expression()) as ExpressionNode);
        node = new RevertNode(errorName, args);
        node.fieldNames = namedArgs.map((na) => na.Identifier().getText());
      } else {
        const args = this.buildCallArguments(ctx.expressionList()!);
        node = new RevertNode(errorName, args);
      }
      if (ctx.Identifier()) node.errorQualifier = anyId.getText();
    } else if (ctx.expression()) {
      // revert("message") or revert(reasonExpr). BCH has no on-chain revert reason: a string literal keeps its
      // message as compile-time metadata; a dynamic reason (e.g. OZ `revert(errorMessage)`) drops to an
      // unconditional failure, same as revert().
      const reason = this.visit(ctx.expression()) as ExpressionNode;
      node = reason instanceof StringLiteralNode
        ? new RevertNode(undefined, [], reason.value)
        : new RevertNode();
    } else {
      // revert();
      node = new RevertNode();
    }
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitAssertStatement(ctx: AssertStatementContext): AssertNode {
    const expression = this.visit(ctx.expression()) as ExpressionNode;
    const node = new AssertNode(expression);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitConstantDefinition(ctx: ConstantDefinitionContext): ConstantDefinitionNode {
    // An unresolved type name is an interface/contract type -> a tagged address handle (as every other declaration
    // site does), so `IERC20 constant U = IERC20(0)` type-checks against an address value.
    const typeText = ctx.typeName().getText();
    const resolvedType = this.resolveType(typeText);
    if (this.solidityImportCompat && (resolvedType instanceof StructType || this.structMap.has(typeText))) {
      throw new ParseError(
        'Only constants of value type and byte array type are implemented',
        Location.fromCtx(ctx),
      );
    }
    const type = resolvedType ?? new AddressType(false, typeText);
    const name = ctx.anyIdentifier().getText();
    this.constantTypes.set(name, type);
    const expression = this.visit(ctx.expression()) as ExpressionNode;
    if (this.solidityImportCompat) this.validateConstantZeroDivisors(expression, ctx);
    const node = new ConstantDefinitionNode(type, name, expression);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitEmitStatement(ctx: EmitStatementContext): EmitStatementNode {
    // Qualified emit `emit I.E(...)`: the event resolves by its bare name, so take the last identifier.
    const identifiers = ctx.Identifier_list();
    const eventName = identifiers[identifiers.length - 1].getText();
    let node: EmitStatementNode;
    if (!ctx.expressionList()) {
      // Named-arg form: emit E({a: x, b: y})
      const namedArgs = ctx.namedArg_list();
      const args = namedArgs.map((na) => this.visit(na.expression()) as ExpressionNode);
      node = new EmitStatementNode(eventName, args);
      node.fieldNames = namedArgs.map((na) => na.Identifier().getText());
    } else {
      const args = this.buildCallArguments(ctx.expressionList()!);
      node = new EmitStatementNode(eventName, args);
    }
    if (identifiers.length > 1) {
      node.eventQualifier = identifiers.slice(0, -1).map((identifier) => identifier.getText()).join('.');
    }
    node.location = Location.fromCtx(ctx);
    return node;
  }



  visitReturnStatement(ctx: ReturnStatementContext): Node {
    // `return arr.push();`: no-arg push appends the element default and yields a reference to that fresh element.
    // Returning it copies the default value, so lower to `arr.push(default); return default`. This avoids a
    // transient storage-reference expression while preserving the append side effect.
    const pushBase = (ctx as any)._pushBase;
    if (pushBase) {
      const name = pushBase.text as string;
      const arrayType = this.stateArrayVarTypes.get(name);
      if (!arrayType) {
        throw new ParseError(`Cannot return .push() from unknown state array '${name}'`, Location.fromCtx(ctx));
      }
      const loc = Location.fromCtx(ctx);
      const value = createDefaultValueExpression(arrayType.elementType, loc);
      const push = this.buildArrayPush(name, false, [], undefined, cloneNode(value) as ExpressionNode, false, ctx);
      const ret = new ReturnNode([value]);
      ret.location = loc;
      const block = new BlockNode([push, ret]);
      block.location = loc;
      return block;
    }
    // `return lvalue op= value;` (incl. chains): run the assignments, then return the first target's value.
    if (ctx._rop) {
      const loc = Location.fromCtx(ctx);
      const first = ctx.expression(0);
      const { links, valueCtx } = this.unrollAssignChain(first, ctx._rop.text, ctx.assignChain()!);
      const stmts = this.buildAssignChainStatements(links, valueCtx, loc);
      const returnNode = new ReturnNode([this.visit(first) as ExpressionNode]);
      returnNode.location = loc;
      const block = new BlockNode([...stmts, returnNode]);
      block.location = loc;
      return block;
    }
    const exprCtxs = ctx.expression_list();
    // Tuple ternary return `return cond ? (..) : (..)`: hoist cond, then a tuple return of per-element ternaries.
    const tupleTernary = exprCtxs.length === 1 ? this.tupleTernary(exprCtxs[0]) : undefined;
    if (tupleTernary) {
      const { tempDecl, values } = this.desugarTupleTernary(tupleTernary);
      const returnNode = new ReturnNode(values);
      returnNode.location = Location.fromCtx(ctx);
      const block = new BlockNode([tempDecl, returnNode]);
      block.location = Location.fromCtx(ctx);
      return block;
    }
    // `return (a, b)` parses the tuple as one TupleExpression (the `return expression` alt outranks the
    // dedicated return-tuple form); unpack it back into a tuple return.
    if (exprCtxs.length === 1 && exprCtxs[0] instanceof TupleExpressionContext) {
      const returnNode = new ReturnNode(exprCtxs[0].expression_list().map((e) => this.visit(e) as ExpressionNode));
      returnNode.location = Location.fromCtx(ctx);
      return returnNode;
    }
    // A whole read of a flattened struct / flattened-value entry as a return value assembles from leaves.
    const expressions = exprCtxs.map(
      (e) => this.maybeAssembleFlattenedRead(e, Location.fromCtx(ctx)) ?? this.visit(e) as ExpressionNode,
    );
    // `abi.encodeCall(helper(), args)` where helper deterministically returns `this.method`: execute helper once
    // for its side effects, discard its pointer value, then encode with the statically established method
    // selector. This preserves helpers such as `getPointer()` that update state before returning the pointer.
    const encodeCallText = exprCtxs.length === 1 && exprCtxs[0].getText().startsWith('abi.encodeCall(')
      ? exprCtxs[0].getText() : undefined;
    const pointerHelper = encodeCallText
      ? /^abi\.encodeCall\(([A-Za-z_$][A-Za-z0-9_$]*)\(\),/.exec(encodeCallText)?.[1]
      : undefined;
    if (pointerHelper && this.selfExternalFunctionReturnAliases.has(pointerHelper)) {
      const loc = Location.fromCtx(ctx);
      const identifier = new IdentifierNode(pointerHelper);
      identifier.location = loc;
      const call = new FunctionCallNode(identifier, []);
      call.location = loc;
      const callStatement = new FunctionCallStatementNode(call);
      callStatement.location = loc;
      const returnNode = new ReturnNode(expressions);
      returnNode.location = loc;
      const block = new BlockNode([callStatement, returnNode]);
      block.location = loc;
      return block;
    }
    // `return f();` inside a VOID function is Solidity's tail form (f is itself void): lower to `f(); return;` so
    // the call is a statement (its callee reference is counted for reachability and it resolves in statement
    // position). OZ/COMP `delegate` returns `_delegate(..)`. A single call expression only.
    if (this.currentFnIsVoid && expressions.length === 1
      && (expressions[0] instanceof FunctionCallNode || expressions[0] instanceof MethodCallNode)) {
      const loc = Location.fromCtx(ctx);
      const call = expressions[0];
      const callStmt = call instanceof FunctionCallNode
        ? new FunctionCallStatementNode(call) : new MethodCallStatementNode(call as MethodCallNode);
      callStmt.location = loc;
      const bareReturn = new ReturnNode([]);
      bareReturn.location = loc;
      const block = new BlockNode([callStmt, bareReturn]);
      block.location = loc;
      return block;
    }
    const returnNode = new ReturnNode(expressions);
    returnNode.location = Location.fromCtx(ctx);
    return returnNode;
  }

  // `using L for T[]`: the library bound to a state array receiver's type, for desugaring `arr.method(args)`
  // -> `L.method(arr, args)`. undefined when the receiver isn't an array bound via using-for.
  private usingForArrayLibrary(recvName: string): string | undefined {
    const arrType = this.stateArrayVarTypes.get(recvName);
    return arrType ? this.usingForLibraries.get(arrType.toString()) : undefined;
  }

  private usingForMappingLibrary(recvName: string): string | undefined {
    const mapType = this.mappingStateVarTypes.get(recvName);
    return mapType ? this.usingForLibraries.get(mapType.toString()) : undefined;
  }

  // Record a receiver's using-for type key (and, for an interface/named-contract receiver, its interface-receiver
  // flag) so `x.method(args)` under `using L for T` resolves.
  private recordUsingForReceiver(name: string, type: Type): void {
    const k = this.usingForTypeKey(type);
    if (!k) return;
    this.localSimpleTypeKeys.set(name, k);
    if (type instanceof AddressType && type.interfaceName) this.localInterfaceReceivers.add(name);
  }

  // The library bound to a simple-typed (non-struct/array/mapping) receiver's type key. An INTERFACE-typed receiver
  // (`using SafeERC20 for IERC20; IERC20 t; t.balanceOf()/t.safeTransfer()`) is AMBIGUOUS - the method may be an
  // interface method (external call) or a library method - so return undefined and let RedesugarImportedUsingForCalls
  // rewrite it (it checks the library's declared free-fn names and leaves interface methods as external calls). A
  // non-interface receiver (uint256 under SafeMath, a UDVT) has no such ambiguity, so bind here as before.
  private usingForSimpleLibrary(recvName: string | undefined, simpleKey: string | undefined): string | undefined {
    const key = simpleKey ?? (recvName !== undefined ? this.stateSimpleTypeKeys.get(recvName) : undefined);
    if (key === undefined) return undefined;
    if (recvName !== undefined
      && (this.localInterfaceReceivers.has(recvName) || this.stateInterfaceReceivers.has(recvName))) return undefined;
    return this.usingForLibraries.get(key) ?? this.usingForLibraries.get('*');
  }

  // Inline storage-pointer write `f(args).field... op= v` / `Lib.f(args).field... op= v` (OpenZeppelin
  // StorageSlot): a call sits at the base
  // of the lvalue chain, which extractLvalue cannot represent, so desugar to `RetStruct __t = Lib.f(args);
  // __t.field... op= v;`. Returns undefined when the LHS is not a `.field` chain over a resolvable function call.
  private buildStoragePointerWrite(
    lhsCtx: ExpressionContext, op: string, valueCtx: ExpressionContext, loc: Location,
  ): StatementNode | undefined {
    const members: string[] = [];
    let cur: ExpressionContext = lhsCtx;
    while (cur instanceof FieldAccessContext) {
      const mn = cur.memberName();
      const member = mn.Identifier() ? mn.Identifier().getText() : (mn.getText() === '.value' ? 'value' : null);
      if (member === null) return undefined;
      members.unshift(member);
      cur = cur.expression();
    }
    if (members.length === 0 || !(cur instanceof FunctionCallExpressionContext)) return undefined;
    const fc = cur.functionCall();
    const ids = fc.Identifier_list();
    if ((ids.length !== 1 && ids.length !== 2) || !fc.expressionList()) return undefined;
    const fnName = ids[ids.length - 1].getText();
    const tmpName = `__nlv_${this.nestedLvalueCounter++}`;
    const fnId = new IdentifierNode(ids.map((id) => id.getText()).join('.')); fnId.location = loc;
    const factoryCall = new FunctionCallNode(fnId, this.buildCallArguments(fc.expressionList()!));
    factoryCall.location = loc;
    const retStruct = this.functionReturnStructs.get(fnName);
    if (!retStruct) {
      // Imported factory (OZ StorageSlot.getStringSlot lives in another file): the return struct is unknown at
      // per-file parse time. DEFER the single-member `.value` write to LowerStorageSlotPointers (post-merge, where
      // the factory - and whether it is the slot-alias / raw-slot shape - is known) via a placeholder-typed local
      // + a `__t.<field> = v` MappingFieldAssign it resolves. A compound op or a deeper chain still can't be
      // desugared without the struct, so keep the clear "assign to a `T storage` local first" guidance there.
      if (members.length !== 1 || op !== '=') {
        throw new ParseError(
          `Cannot resolve the storage-pointer factory '${fnName}' for an inline '.${members.join('.')}' write; `
          + 'assign it to a `T storage` local first, then write its member.', loc,
        );
      }
      const decl = new VariableDefinitionNode(new AddressType(false, `__slotptr_${fnName}`), [], tmpName, factoryCall);
      decl.location = loc;
      const write = new MappingFieldAssignNode(tmpName, [], members[0], this.visit(valueCtx) as ExpressionNode);
      write.location = loc;
      const block = new BlockNode([decl, write]); block.location = loc;
      return block;
    }
    const decl = new VariableDefinitionNode(retStruct, [], tmpName, factoryCall); decl.location = loc;
    this.localStructTypes.set(tmpName, retStruct);
    const rebuilt = this.buildStructFieldRebuild(tmpName, loc, members, false, loc,
      (chainRead) => (op === '=' ? this.visit(valueCtx) as ExpressionNode : this.compoundRhs(chainRead, op, valueCtx, loc)))!;
    const block = new BlockNode([decl, rebuilt]); block.location = loc;
    return block;
  }

  // `f()[k] = v` where f() returns a reassigned `mapping storage` pointer: extractLvalue cannot represent a call
  // base, so desugar to a storage-pointer local `mapping storage __t = f(); __t[k] = v;` (InlineMappingReturnFunctions
  // resolves f into its side effects + final mapping, LowerMappingStorageAlias then resolves the alias). The
  // placeholder mapping type never reaches type-checking - the local is dropped once aliased. Plain-call base with a
  // single index key and `=` only; anything else falls through to the ordinary lvalue path.
  private buildMappingReturnIndexedWrite(
    lhsCtx: ExpressionContext, op: string, valueCtx: ExpressionContext, loc: Location,
  ): StatementNode | undefined {
    if (op !== '=') return undefined;
    const keys: Array<() => ExpressionNode> = [];
    let cur: ExpressionContext = lhsCtx;
    for (;;) {
      if (cur instanceof ParenthesisedContext) { cur = cur.expression(); } else if (cur instanceof ArrayAccessContext) {
        const k = cur.expression(1); keys.unshift(() => this.visit(k) as ExpressionNode); cur = cur.expression(0);
      } else if (cur instanceof TupleIndexOpContext) {
        const numTok = cur.NumberLiteral(); const kl = Location.fromToken(numTok.symbol);
        keys.unshift(() => { const n = new IntLiteralNode(BigInt(numTok.getText())); n.location = kl; return n; });
        cur = cur.expression();
      } else break;
    }
    if (keys.length !== 1 || !(cur instanceof FunctionCallExpressionContext)) return undefined;
    if (cur.functionCall().Identifier_list().length > 2) return undefined; // plain `f(...)` or namespaced `L.f(...)`
    const callNode = this.visit(cur) as ExpressionNode;
    if (!(callNode instanceof FunctionCallNode)) return undefined;
    const tmpName = `__mrv_${this.nestedLvalueCounter++}`;
    const placeholder = new MappingType(PrimitiveType.BIGINT, PrimitiveType.BIGINT);
    const decl = new VariableDefinitionNode(placeholder, [Modifier.STORAGE], tmpName, callNode); decl.location = loc;
    const write = new ArrayAssignNode(tmpName, keys[0](), this.visit(valueCtx) as ExpressionNode); write.location = loc;
    const block = new BlockNode([decl, write]); block.location = loc;
    return block;
  }

  private buildStorageAliasPushStatements(
    alias: { name: string; type: Type; keys: ExpressionNode[]; prefix: StatementNode[] },
    value: ExpressionNode | undefined,
    noArg: boolean,
    ctx: ParserRuleContext,
  ): StatementNode[] {
    let push: StatementNode;
    if (alias.type instanceof BytesType && alias.type.bound === undefined) {
      push = this.desugarBytesPush(alias.name, value, ctx);
    } else if (alias.type instanceof ArrayType) {
      push = this.buildArrayPush(
        alias.name, true,
        alias.keys.map((key) => () => cloneNode(key) as ExpressionNode), undefined,
        value ?? createDefaultValueExpression(alias.type.elementType, Location.fromCtx(ctx)),
        noArg, ctx,
      );
    } else {
      throw new ParseError('Invalid .push/.pop/.delete target', Location.fromCtx(ctx));
    }
    return [...alias.prefix.map((statement) => cloneNode(statement) as StatementNode), push];
  }

  // `receiver.push(value)` on an array / mapping-entry / struct-field / bytes state var, reconstructed from the
  // parsed receiver (rawName, isThis, keyFns = mapping index keys, member = struct array-field). Unifies the old
  // bare arrayPushStatement and this-prefixed stateArrayPushStatement dispatch (a name is exactly one of
  // mapping-entry / bytes / struct-field / plain array, so the branch order is irrelevant).
  private buildArrayPush(
    rawName: string, isThis: boolean, keyFns: Array<() => ExpressionNode>, member: string | undefined,
    value: ExpressionNode, noArg: boolean, ctx: ParserRuleContext,
  ): StatementNode {
    const loc = Location.fromCtx(ctx);
    if (!member && keyFns.length === 0) this.validateArrayLengthMutation(rawName, isThis, ctx);
    if (!member && keyFns.length >= 1) {
      const node = new MappingAssignNode(rawName, keyFns.map((fn) => fn()), value);
      node.arrayPush = true; node.noArg = noArg; node.location = loc; return node;
    }
    if (!member && this.bytesStateVarNames.has(rawName)) {
      return this.desugarBytesPush(rawName, noArg ? undefined : value, ctx);
    }
    if (member) {
      const node = new StateArrayPushNode(`${rawName}__${member}`, value);
      node.noArg = noArg; node.location = loc; return node;
    }
    const node = (isThis || this.packedStateArrayNames.has(rawName))
      ? new StateArrayPushNode(rawName, value)
      : new ArrayPushNode(rawName, value);
    node.noArg = noArg; node.location = loc; return node;
  }

  // In `(a.push(), ...) = (v, ...)`, the assignment context converts `v` to the pushed element type before
  // appending. The ordinary method-call path gets that context during call typing; this tuple-target desugaring
  // happens earlier, so make the conversion explicit here.
  private buildTuplePushTarget(
    name: string, valueCtx: ExpressionContext, ctx: ParserRuleContext,
  ): StatementNode {
    let value = this.visit(valueCtx) as ExpressionNode;
    const targetType = this.bytesStateVarNames.has(name)
      ? new BytesType(1)
      : this.stateArrayVarTypes.get(name)?.elementType;
    if (targetType) {
      const cast = new CastNode(targetType, value, false);
      cast.location = Location.fromCtx(valueCtx);
      value = cast;
    }
    return this.buildArrayPush(name, false, [], undefined, value, false, ctx);
  }

  // `receiver.pop()` - mirror of buildArrayPush.
  private buildArrayPop(
    rawName: string, isThis: boolean, keyFns: Array<() => ExpressionNode>, member: string | undefined,
    ctx: ParserRuleContext,
  ): StatementNode {
    const loc = Location.fromCtx(ctx);
    if (!member && keyFns.length === 0) this.validateArrayLengthMutation(rawName, isThis, ctx);
    if (!member && keyFns.length >= 1) {
      const placeholder = new IntLiteralNode(0n); placeholder.location = loc;
      const node = new MappingAssignNode(rawName, keyFns.map((fn) => fn()), placeholder);
      node.arrayPop = true; node.location = loc; return node;
    }
    if (!member && this.bytesStateVarNames.has(rawName)) return this.desugarBytesPop(rawName, ctx);
    if (member) { const node = new StateArrayPopNode(`${rawName}__${member}`); node.location = loc; return node; }
    const node = (isThis || this.packedStateArrayNames.has(rawName))
      ? new StateArrayPopNode(rawName) : new ArrayPopNode(rawName);
    node.location = loc; return node;
  }

  private validateArrayLengthMutation(rawName: string, isThis: boolean, ctx: ParserRuleContext): void {
    if (!this.solidityImportCompat) return;
    const alias = !isThis ? this.storageAliases.get(rawName) : undefined;
    const storageName = alias?.container ?? rawName;
    const storageType = this.stateArrayVarTypes.get(storageName)
      ?? this.stateCollectionArrayTypes.get(storageName);
    const isStorage = isThis || alias !== undefined || storageType !== undefined;
    if (!isStorage && this.localArrayVarTypes.has(rawName) && !this.storageReferenceTypes.has(rawName)) {
      throw new ParseError(
        'Array push/pop is only available for dynamic arrays in storage',
        Location.fromCtx(ctx),
      );
    }
    if (isStorage && storageType?.bound !== undefined) {
      throw new ParseError(
        'Array push/pop is not available for fixed-size storage arrays',
        Location.fromCtx(ctx),
      );
    }
  }

  // `receiver.delete(arg)`: bare local `arr.delete(i)` -> ArrayDeleteNode; `this.X[k...].delete(v)` -> the key
  // chain is the receiver's bracket keys followed by the delete arg (packed state array -> StateArrayDelete).
  private buildDelete(
    rawName: string, isThis: boolean, keyFns: Array<() => ExpressionNode>, arg: ExpressionNode, ctx: ParserRuleContext,
  ): StatementNode {
    const loc = Location.fromCtx(ctx);
    if (!isThis && keyFns.length === 0) { const node = new ArrayDeleteNode(rawName, arg); node.location = loc; return node; }
    const keys = [...keyFns.map((fn) => fn()), arg];
    if (this.packedStateArrayNames.has(rawName) && keys.length === 1) {
      const node = new StateArrayDeleteNode(rawName, keys[0]); node.location = loc; return node;
    }
    const node = new MappingDeleteNode(rawName, keys); node.location = loc; return node;
  }

  // Reconstruct an lvalue chain (rawName, isThis, ordered segments) from a parsed LHS expression, so the
  // left-factored `expression op= expression` assignment reuses buildLvalueAssign (which the lvPart grammar path
  // also feeds). Walks outside-in, prepending each segment; returns null for a non-lvalue (call, cast, literal).
  private extractLvalue(
    ctx: ExpressionContext,
  ): { rawName: string; isThis: boolean; nameLoc: Location; segs: LvSeg[]; bytesCast?: boolean } | null {
    const segs: LvSeg[] = [];
    let cur: ExpressionContext = ctx;
    let bytesCast = false;
    for (;;) {
      if (cur instanceof ParenthesisedContext) {
        cur = cur.expression();
      } else if (cur instanceof CastContext
        && cur.arrayCastType().typeCast().getText() === 'bytes' && !bytesCast) {
        // Solidity permits a writable bytes view over a storage string (`bytes(s).push(v)`,
        // `bytes(s)[i] = v`). Keep the cast marker so only that exact storage-backed form is
        // accepted; arbitrary casts remain non-lvalues.
        bytesCast = true;
        cur = cur._castable;
      } else if (cur instanceof ArrayAccessContext) {
        const keyCtx = cur.expression(1);
        segs.unshift({ key: () => this.visit(keyCtx) as ExpressionNode });
        cur = cur.expression(0);
      } else if (cur instanceof TupleIndexOpContext) {
        // `arr[0]` with a NumberLiteral index parses as TupleIndexOp (not a wrapped expression); the index is a
        // literal token, so build a fresh IntLiteralNode for the key rather than re-visiting a context.
        const numTok = cur.NumberLiteral();
        const keyLoc = Location.fromToken(numTok.symbol);
        segs.unshift({
          key: () => {
            const n = new IntLiteralNode(BigInt(numTok.getText()));
            n.location = keyLoc;
            return n;
          },
        });
        cur = cur.expression();
      } else if (cur instanceof FieldAccessContext) {
        const mn = cur.memberName();
        const member = mn.Identifier() ? mn.Identifier().getText()
          : (mn.getText() === '.value' || mn.getText() === '.error' ? mn.getText().slice(1) : null);
        if (member === null) return null; // a non-field member (.length, .lockingBytecode, ...) is not an lvalue
        segs.unshift({ member });
        cur = cur.expression();
      } else if (cur instanceof MappingAccessContext) {
        cur.expression_list().slice().reverse()
          .forEach((e) => segs.unshift({ key: () => this.visit(e) as ExpressionNode }));
        return {
          rawName: cur.Identifier().getText(), isThis: true,
          nameLoc: Location.fromToken(cur.Identifier().symbol), segs,
        };
      } else if (cur instanceof StateAccessContext) {
        return {
          rawName: cur.Identifier().getText(), isThis: true,
          nameLoc: Location.fromToken(cur.Identifier().symbol), segs, bytesCast,
        };
      } else if (cur instanceof IdentifierContext) {
        return { rawName: cur.anyIdentifier().getText(), isThis: false, nameLoc: Location.fromCtx(cur), segs, bytesCast };
      } else {
        return null;
      }
    }
  }

  // One assignment statement `lhs op= value`: the storage-pointer / mapping-return special forms, then the
  // generic lvalue path. Shared by the plain statement, chain, return-assign and decl-init-assign desugars.
  private buildAssignStatement(
    lhsCtx: ExpressionContext, op: string, valueCtx: ExpressionContext, loc: Location,
  ): StatementNode {
    // `(p = other)[k] = value` where p is a mapping-storage local: the parenthesized assignment expression
    // rebinds the storage pointer and yields that same pointer for the indexed write. Perform the compile-time
    // rebind first, then route the element write through the newly recorded alias.
    if (lhsCtx instanceof ArrayAccessContext || lhsCtx instanceof TupleIndexOpContext) {
      let base = lhsCtx instanceof ArrayAccessContext ? lhsCtx.expression(0) : lhsCtx.expression();
      while (base instanceof ParenthesisedContext) base = base.expression();
      if (base instanceof AssignmentExpressionContext && base._op.text === '='
        && this.storageAliases.has(base.Identifier().getText())) {
        const name = base.Identifier().getText();
        const nameLoc = Location.fromToken(base.Identifier().symbol);
        const rebind = this.buildLvalueAssign(name, false, nameLoc, [], '=', base.expression(), loc);
        const key = lhsCtx instanceof ArrayAccessContext
          ? (): ExpressionNode => this.visit(lhsCtx.expression(1)) as ExpressionNode
          : (): ExpressionNode => {
            const token = lhsCtx.NumberLiteral().symbol;
            const literal = new IntLiteralNode(BigInt(token.text ?? '0'));
            literal.location = Location.fromToken(token);
            return literal;
          };
        const write = this.buildLvalueAssign(
          name, false, nameLoc, [{ key }],
          op, valueCtx, loc,
        );
        const block = new BlockNode([rebind, write]);
        block.location = loc;
        return block;
      }
    }
    // Storage-pointer inline write `Lib.f(args).field op= v` (a call in the lvalue chain, which extractLvalue
    // cannot represent): desugar to a `T storage` local first.
    const sp = this.buildStoragePointerWrite(lhsCtx, op, valueCtx, loc);
    if (sp) return sp;
    const mrv = this.buildMappingReturnIndexedWrite(lhsCtx, op, valueCtx, loc);
    if (mrv) return mrv;
    const lv = this.extractLvalue(lhsCtx);
    if (!lv) throw new ParseError('Invalid assignment target', Location.fromCtx(lhsCtx));
    if (lv.bytesCast && !lv.isThis && lv.segs.length === 1 && lv.segs[0].key
      && this.stateStringVarNames.has(lv.rawName)) {
      return this.desugarBytesElementWrite(
        lv.rawName, lv.segs[0].key, this.visit(valueCtx) as ExpressionNode, loc, true, op, true,
      );
    }
    return this.buildLvalueAssign(lv.rawName, lv.isThis, lv.nameLoc, lv.segs, op, valueCtx, loc);
  }

  // Unroll a right-recursive assignChain `lhs0 op0 (lhs1 op1 (... value))` into its links and final value.
  private unrollAssignChain(
    firstLhs: ExpressionContext, firstOp: string, chain: AssignChainContext,
  ): { links: Array<{ lhsCtx: ExpressionContext; op: string }>; valueCtx: ExpressionContext } {
    const links = [{ lhsCtx: firstLhs, op: firstOp }];
    let cur = chain;
    while (cur._op) {
      links.push({ lhsCtx: cur.expression(), op: cur._op.text });
      cur = cur.assignChain()!;
    }
    return { links, valueCtx: cur.expression() };
  }

  // Desugar an assignment chain right-to-left: the last link takes the chain value, each earlier link reads its
  // successor's target back (a re-read after the write yields the assigned value - value-type semantics).
  private buildAssignChainStatements(
    links: Array<{ lhsCtx: ExpressionContext; op: string }>, valueCtx: ExpressionContext, loc: Location,
  ): StatementNode[] {
    const stmts: StatementNode[] = [];
    for (let i = links.length - 1; i >= 0; i -= 1) {
      const v = i === links.length - 1 ? valueCtx : links[i + 1].lhsCtx;
      stmts.push(this.buildAssignStatement(links[i].lhsCtx, links[i].op, v, loc));
    }
    return stmts;
  }

  // Core desugar for a ternary carrying branch assignment tails (`cond ? a = v : b`): `if (cond) {A} else {B}`.
  // Each arm runs its branch's assignments; `consume` (when given) then receives the branch's value expression
  // (the assigned target, re-read after its write, or the plain branch expression) to finish the arm.
  private buildTernaryAssignBranch(
    ctx: TernaryOpContext, consume: ((valueCtx: ExpressionContext) => StatementNode) | undefined, loc: Location,
  ): StatementNode {
    const arm = (
      exprCtx: ExpressionContext, opText: string | undefined, chain: AssignChainContext | undefined,
    ): BlockNode => {
      const stmts: StatementNode[] = [];
      if (opText && chain) {
        const { links, valueCtx } = this.unrollAssignChain(exprCtx, opText, chain);
        stmts.push(...this.buildAssignChainStatements(links, valueCtx, loc));
      }
      if (consume) stmts.push(consume(exprCtx));
      const b = new BlockNode(stmts);
      b.location = loc;
      return b;
    };
    const condition = this.visit(ctx._condition) as ExpressionNode;
    const branch = new BranchNode(
      condition,
      arm(ctx._ifTrue, ctx._tOp?.text, ctx._tVal),
      arm(ctx._ifFalse, ctx._fOp?.text, ctx._fVal),
    );
    branch.location = loc;
    return branch;
  }

  // `x op= cond ? a = v : b` - when the assigned value is a ternary with branch assignments, distribute the
  // outer assignment into both arms (each arm assigns its branch value). Returns undefined when not that shape.
  private maybeDesugarTernaryAssignValue(
    valueCtx: ExpressionContext, link: { lhsCtx: ExpressionContext; op: string }, loc: Location,
  ): StatementNode | undefined {
    if (!(valueCtx instanceof TernaryOpContext) || (!valueCtx._tOp && !valueCtx._fOp)) return undefined;
    return this.buildTernaryAssignBranch(
      valueCtx, (vctx) => this.buildAssignStatement(link.lhsCtx, link.op, vctx, loc), loc,
    );
  }

  // Whether every leaf of a flattened struct is materializable as a VALUE (no mapping anywhere): only such
  // structs may be read whole (Solidity: mapping-carrying structs have no memory form).
  private flattenedStructIsValueReadable(t: StructType, seen: Set<StructType> = new Set()): boolean {
    if (seen.has(t)) return false;
    seen.add(t);
    return t.fields.every((f) => !(f.type instanceof MappingType)
      && (!(f.type instanceof StructType) || !this.structNeedsFieldFlattening(f.type)
        || this.flattenedStructIsValueReadable(f.type, seen)));
  }

  // Assemble a WHOLE-STRUCT VALUE from a flattened struct's leaves: a struct-constructor call whose args are
  // the per-field leaf reads produced by `leaf(fieldName, fieldType)`. Nested flattened struct fields recurse.
  private assembleFlattenedStructValue(
    t: StructType, loc: Location, leaf: (fieldName: string, fieldType: Type) => ExpressionNode,
  ): ExpressionNode {
    const args = t.fields.map((f) => {
      if (f.type instanceof StructType && this.structNeedsFieldFlattening(f.type)) {
        return this.assembleFlattenedStructValue(f.type, loc, (nm, ft) => leaf(`${f.name}__${nm}`, ft));
      }
      return leaf(f.name, f.type);
    });
    const id = new IdentifierNode(t.name);
    id.location = loc;
    const call = new FunctionCallNode(id, args);
    call.location = loc;
    return call;
  }

  // A whole read of a flattened struct STATE VAR (`S memory x = s;` / `return s;`): ctor of its leaf reads.
  private assembleFlattenedStateRead(varName: string, loc: Location): ExpressionNode | undefined {
    const t = this.mappingStructStateVars.get(varName);
    if (!t || !this.flattenedStructIsValueReadable(t)) return undefined;
    return this.assembleFlattenedStructValue(t, loc, (nm) => {
      const r = new IdentifierNode(`${varName}__${nm}`);
      r.location = loc;
      return r;
    });
  }

  // A whole read of a flattened-value mapping ENTRY (`return m[0];` / `S memory x = m[k];`): ctor of the
  // per-field entry reads `m__f[keys]`. One level only - the collection flatten expands direct fields.
  private assembleFlattenedEntryRead(
    mapName: string, keyFns: Array<() => ExpressionNode>, loc: Location,
  ): ExpressionNode | undefined {
    const t = this.mappingStructValueVars.get(mapName);
    if (!t || !this.flattenedStructIsValueReadable(t)) return undefined;
    if (t.fields.some((f) => f.type instanceof StructType && this.structNeedsFieldFlattening(f.type))) {
      return undefined;
    }
    return this.assembleFlattenedStructValue(t, loc, (nm) => {
      const acc = new MappingAccessNode(`${mapName}__${nm}`, keyFns.map((k) => k()));
      acc.location = loc;
      return acc;
    });
  }

  // Detect a whole-read source CONTEXT: a bare identifier naming a flattened struct state var (through a
  // whole-var storage alias), or `m[k]` on a flattened-value mapping. Returns the assembled value or undefined.
  private maybeAssembleFlattenedRead(ctx: ExpressionContext, loc: Location): ExpressionNode | undefined {
    const lv = this.extractLvalue(ctx);
    if (!lv || lv.isThis) return undefined;
    let name = lv.rawName;
    const alias = this.storageAliases.get(name);
    if (alias && alias.keys.length === 0 && lv.segs.length === 0) name = alias.container;
    if (lv.segs.length === 0) return this.assembleFlattenedStateRead(name, loc);
    if (lv.segs.every((s) => s.key !== undefined) && this.mappingStructValueVars.has(name)) {
      return this.assembleFlattenedEntryRead(name, lv.segs.map((s) => s.key!), loc);
    }
    return undefined;
  }

  // Resolve a whole-struct VALUE source for a flattened struct target of type `t`: a struct constructor
  // `S({..})` / `S(..)`, or a whole read (`m[k]` / a flattened state-struct var) assembled into the same
  // constructor shape. Returns the constructor node (its args, in field order for the positional/assembled
  // forms, or named via fieldNames) or undefined when it is neither (leave the caller's other paths to handle).
  private resolveWholeStructValue(
    valueCtx: ExpressionContext, t: StructType, loc: Location,
  ): FunctionCallNode | undefined {
    if (t.fields.some((f) => f.type instanceof StructType && this.structNeedsFieldFlattening(f.type))) {
      return undefined; // nested-flattened struct: fields do not decompose one level
    }
    const direct = this.visit(valueCtx) as ExpressionNode;
    if (direct instanceof FunctionCallNode && direct.identifier.name === t.name) return direct;
    const assembled = this.maybeAssembleFlattenedRead(valueCtx, loc);
    if (assembled instanceof FunctionCallNode && assembled.identifier.name === t.name) return assembled;
    return undefined;
  }

  // The constructor argument for field `fname` (index `i`): by name for the `S({..})` form, else positional.
  private structCtorArg(ctor: FunctionCallNode, fname: string, i: number): ExpressionNode | undefined {
    if (ctor.fieldNames) {
      const idx = ctor.fieldNames.indexOf(fname);
      return idx >= 0 ? ctor.parameters[idx] : undefined;
    }
    return ctor.parameters[i];
  }

  // `m[keys] = <whole struct value>`: per-field entry writes `m__f[keys] = <value.f>` (mapping fields skipped).
  private decomposeStructCtorToEntryWrites(
    mapName: string, t: StructType, keyFns: Array<() => ExpressionNode>, valueCtx: ExpressionContext, loc: Location,
  ): Node | undefined {
    const ctor = this.resolveWholeStructValue(valueCtx, t, loc);
    if (!ctor) return undefined;
    const stmts: StatementNode[] = [];
    t.fields.forEach((f, i) => {
      if (f.type instanceof MappingType) return;
      const value = this.structCtorArg(ctor, f.name, i);
      if (!value) return;
      const assign = new MappingAssignNode(`${mapName}__${f.name}`, keyFns.map((k) => k()), value);
      assign.location = loc;
      stmts.push(assign);
    });
    const block = new BlockNode(stmts);
    block.location = loc;
    return block;
  }

  // `s = <whole struct value>` for a flattened struct STATE var: per-field state writes `s__f = <value.f>`.
  private decomposeStructCtorToStateWrites(
    varName: string, t: StructType, valueCtx: ExpressionContext, loc: Location,
  ): Node | undefined {
    const ctor = this.resolveWholeStructValue(valueCtx, t, loc);
    if (!ctor) return undefined;
    const stmts: StatementNode[] = [];
    t.fields.forEach((f, i) => {
      if (f.type instanceof MappingType) return;
      const value = this.structCtorArg(ctor, f.name, i);
      if (!value) return;
      const assign = new StateAssignNode(`${varName}__${f.name}`, value);
      assign.location = loc;
      stmts.push(assign);
    });
    const block = new BlockNode(stmts);
    block.location = loc;
    return block;
  }

  // All `.push` statement forms. Single pushes keep their original construction; chained forms desugar via
  // the pre-push length capture pattern (the fresh element's index stays valid while it is written):
  //   `c.push().push(v);`     -> uint __i = c.length; c.push(); c[__i].push(v);
  //   `c.push().push() = v;`  -> same with v as the nested value
  //   `b.push() = b.push();`  -> uint __r = b.length; b.push(); b.push(b[__r]);
  // A receiver aliased by `T[] storage p = c.push();` routes to the aliased container element.
  private buildPushStatement(
    ctx: ExpressionStatementContext,
    lv: { rawName: string; isThis: boolean; nameLoc: Location; segs: LvSeg[]; bytesCast?: boolean },
    keyFns: Array<() => ExpressionNode>, member: string | undefined,
  ): StatementNode {
    const loc = Location.fromCtx(ctx);
    const stamp = <T extends { location?: Location }>(n: T): T => { n.location = loc; return n; };
    const ident = (nm: string): IdentifierNode => stamp(new IdentifierNode(nm));

    // Storage-pointer receiver (`uint[] storage p = c.push(); p.push(v);`): substitute the aliased element.
    let { rawName, isThis } = lv;
    let effKeyFns = keyFns;
    if (!isThis) {
      const alias = this.storageAliases.get(rawName);
      if (alias) {
        rawName = alias.container;
        effKeyFns = [
          ...alias.keys.map((aliasKey) =>
            (): ExpressionNode => cloneNode(aliasKey) as ExpressionNode),
          ...keyFns,
        ];
      }
    }

    const assignVal = ctx.expression(1);
    const hasSecond = !!ctx._second;
    const hasThird = !!ctx._third;
    const hasRhsPush = !!ctx._rhsPush;

    // `s.items.push() = t.items.push()` evaluates the RHS push first, then assigns its freshly-defaulted value
    // into the fresh LHS slot. For no-argument pushes that assignment cannot change either value, so two ordered
    // pushes are exact. Accept flattened struct-field receivers here; the general value-carrying chain below
    // still handles plain arrays and retains its index/read-back machinery.
    if (!hasSecond && hasRhsPush && !ctx._rhsPush2 && member !== undefined && effKeyFns.length === 0 && assignVal) {
      const rhsLv = this.extractLvalue(assignVal);
      if (rhsLv && !rhsLv.isThis) {
        while (rhsLv.segs.length > 1 && rhsLv.segs[0].member !== undefined
          && this.mappingStructStateVars.has(rhsLv.rawName)) {
          const field = this.mappingStructStateVars.get(rhsLv.rawName)!
            .fields.find((candidate) => candidate.name === rhsLv.segs[0].member);
          if (!field || !(field.type instanceof StructType) || !this.structNeedsFieldFlattening(field.type)) break;
          rhsLv.rawName = `${rhsLv.rawName}__${rhsLv.segs[0].member}`;
          rhsLv.segs = rhsLv.segs.slice(1);
        }
        const rhsMembers = rhsLv.segs.filter((segment) => segment.member !== undefined);
        const rhsKeys = rhsLv.segs.filter((segment) => segment.key !== undefined);
        if (rhsMembers.length === 1 && rhsKeys.length === 0) {
          const rhsPush = this.buildArrayPush(
            rhsLv.rawName, false, [], rhsMembers[0].member,
            this.noArgPushPlaceholder(ctx), true, ctx,
          );
          const lhsPush = this.buildArrayPush(
            rawName, isThis, effKeyFns, member, this.noArgPushPlaceholder(ctx), true, ctx,
          );
          return stamp(new BlockNode([rhsPush, lhsPush]));
        }
      }
    }

    if (lv.bytesCast && effKeyFns.length === 0 && member === undefined
      && this.stateStringVarNames.has(rawName) && !hasSecond && !hasRhsPush) {
      const argCtx = ctx.pushArgument();
      const value = argCtx === null ? undefined : this.visit(argCtx.expression()) as ExpressionNode;
      return this.desugarBytesPush(rawName, value, ctx, true);
    }

    if (ctx._pushField) {
      // The no-arg push returns a reference to a zero-initialized new element. For a struct-field assignment,
      // construct that final element directly: `rows.push().x = v` is one `rows.push(S(v, 0, ...))`. Besides
      // avoiding a redundant write, this is essential for mapping-entry arrays: an entry write is not visible to
      // a later read in the same transaction, so push-then-read-modify-write would observe stale input state.
      const arrayType = this.resolvePushReceiverArrayType(lv);
      if (!(arrayType?.elementType instanceof StructType)) {
        throw new ParseError('.push().field assignment requires an array of structs', loc);
      }
      const field = ctx._pushField.getText();
      if (!arrayType.elementType.fields.some((candidate) => candidate.name === field)) {
        throw new ParseError(`Struct '${arrayType.elementType.name}' has no field '${field}'`, loc);
      }
      const assigned = this.visit(ctx.expression(1)!) as ExpressionNode;
      const value = stamp(new FunctionCallNode(
        ident(arrayType.elementType.name),
        arrayType.elementType.fields.map((candidate) => candidate.name === field
          ? assigned
          : createDefaultValueExpression(candidate.type, loc)),
      ));
      return this.buildArrayPush(
        rawName, isThis, effKeyFns, member, value, false, ctx,
      );
    }

    if (!hasSecond && !hasRhsPush) {
      // Solidity `arr.push() = value` appends the element type's default then writes it - equivalent to
      // `arr.push(value)` (the value expression is the second `expression` child, present only for this form).
      if (assignVal) {
        let value = this.visit(assignVal) as ExpressionNode;
        const pushAssignOp = ctx._pushAssignOp?.text;
        if (pushAssignOp && pushAssignOp !== '=') {
          const arrayType = this.resolvePushReceiverArrayType(lv);
          if (!arrayType) throw new ParseError('Compound assignment to .push() requires an array receiver', loc);
          value = stamp(new BinaryOpNode(
            createDefaultValueExpression(arrayType.elementType, loc),
            pushAssignOp.slice(0, -1) as BinaryOperator,
            value,
          ));
        }
        return this.buildArrayPush(rawName, isThis, effKeyFns, member, value, false, ctx);
      }
      const argCtx = ctx.pushArgument();
      const noArg = argCtx === null;
      const value = noArg ? this.noArgPushPlaceholder(ctx) : this.visit(argCtx.expression()) as ExpressionNode;
      return this.buildArrayPush(rawName, isThis, effKeyFns, member, value, noArg, ctx);
    }

    // Chained forms: plain state-array receivers only (no member/keys - the nested push carries the index).
    if (member !== undefined || effKeyFns.length > 0 || isThis) {
      throw new ParseError('Chained .push() is only supported on a plain array variable', Location.fromCtx(ctx));
    }
    const stmts: StatementNode[] = [];

    // Resolve the pushed value: `= expr`, `= arr2.push()` (append a default to arr2 and read it back),
    // a final `.push(arg)`, or the no-arg default.
    let valueExpr: ExpressionNode;
    let noArgNested = false;
    if (assignVal) {
      if (hasRhsPush) {
        const rhsLv = this.extractLvalue(assignVal);
        if (!rhsLv || rhsLv.isThis || rhsLv.segs.length !== 0) {
          throw new ParseError('A value-side .push() is only supported on a plain array variable', Location.fromCtx(ctx));
        }
        const rIdxName = `__pushChain_r_${this.nestedLvalueCounter++}`;
        const rIdxDef = stamp(new VariableDefinitionNode(
          PrimitiveType.BIGINT, [], rIdxName, stamp(new UnaryOpNode(UnaryOperator.SIZE, ident(rhsLv.rawName)))));
        rIdxDef.allowUnused = true;
        stmts.push(rIdxDef);
        stmts.push(this.buildArrayPush(rhsLv.rawName, false, [], undefined, this.noArgPushPlaceholder(ctx), true, ctx));
        if (ctx._rhsPush2) {
          // 2-deep value side (`... = b.push().push();`): append a default to the fresh inner array too;
          // that inner array was empty, so the appended element sits at index 0.
          stmts.push(this.buildArrayPush(
            rhsLv.rawName, false, [(): ExpressionNode => ident(rIdxName)], undefined,
            this.noArgPushPlaceholder(ctx), true, ctx,
          ));
          const zero = stamp(new IntLiteralNode(0n));
          valueExpr = stamp(new ArrayAccessNode(
            stamp(new ArrayAccessNode(ident(rhsLv.rawName), ident(rIdxName))), zero,
          ));
        } else {
          valueExpr = stamp(new ArrayAccessNode(ident(rhsLv.rawName), ident(rIdxName)));
        }
      } else {
        valueExpr = this.visit(assignVal) as ExpressionNode;
      }
    } else {
      const argCtx = ctx.pushArgument();
      if (argCtx) {
        valueExpr = this.visit(argCtx.expression()) as ExpressionNode;
      } else {
        valueExpr = this.noArgPushPlaceholder(ctx);
        noArgNested = true;
      }
    }

    // `bytes[] c; c.push().push() = b` mutates a freshly-created empty inner bytes value, so the complete
    // result is known before the outer append: `c.push(bytes(b))`. Avoid emitting a nested mapping write against
    // packed state-array `c` (it has no collection backend). A no-arg inner push appends exactly one zero byte.
    const rootType = this.resolvePushReceiverArrayType(lv);
    if (hasSecond && !hasThird && rootType?.elementType instanceof BytesType
      && rootType.elementType.bound === undefined && !hasRhsPush) {
      let innerValue = valueExpr;
      if (noArgNested) {
        innerValue = stamp(new HexLiteralNode(new Uint8Array([0])));
      }
      const bytesValue = stamp(new CastNode(new BytesType(), innerValue, false));
      return this.buildArrayPush(rawName, false, [], undefined, bytesValue, false, ctx);
    }

    if (hasSecond) {
      // 2/3-deep: append a default inner array, then push the value (or another default array) onto it.
      const iName = `__pushChain_i_${this.nestedLvalueCounter++}`;
      const iDef = stamp(new VariableDefinitionNode(
        PrimitiveType.BIGINT, [], iName, stamp(new UnaryOpNode(UnaryOperator.SIZE, ident(rawName)))));
      iDef.allowUnused = true;
      stmts.push(iDef);
      stmts.push(this.buildArrayPush(rawName, false, [], undefined, this.noArgPushPlaceholder(ctx), true, ctx));
      if (hasThird) {
        const nestedRootType = this.resolvePushReceiverArrayType(lv);
        const secondType = nestedRootType?.elementType;
        const thirdType = secondType instanceof ArrayType ? secondType.elementType : undefined;
        if (!(secondType instanceof ArrayType) || !(thirdType instanceof ArrayType)) {
          throw new ParseError('Three chained .push() calls require a three-dimensional array', loc);
        }
        stmts.push(this.buildArrayPush(
          rawName, false, [(): ExpressionNode => ident(iName)], undefined,
          createDefaultValueExpression(thirdType, loc), false, ctx,
        ));
        stmts.push(this.buildArrayPush(
          rawName, false,
          [(): ExpressionNode => ident(iName), (): ExpressionNode => stamp(new IntLiteralNode(0n))],
          undefined, noArgNested ? createDefaultValueExpression(thirdType.elementType, loc) : valueExpr, false, ctx,
        ));
      } else {
        stmts.push(this.buildArrayPush(
          rawName, false, [(): ExpressionNode => ident(iName)], undefined, valueExpr, noArgNested, ctx,
        ));
      }
    } else {
      // 1-deep with a value-side push: `b.push() = b.push();`.
      stmts.push(this.buildArrayPush(rawName, false, [], undefined, valueExpr, false, ctx));
    }
    return stamp(new BlockNode(stmts));
  }

  // Resolve the array type of an indexed struct-field receiver (`data[i].d`, `s1.arr[i]`) by walking the lvalue
  // segments from the container's declared type: an index key steps into an array element / mapping value, a
  // member steps into a struct field. Returns the receiver's ArrayType, or undefined if any step is unresolved.
  private resolvePushReceiverArrayType(
    lv: { rawName: string; segs: LvSeg[] },
  ): ArrayType | undefined {
    let cur: Type | undefined = this.stateArrayVarTypes.get(lv.rawName)
      ?? this.stateStructVars.get(lv.rawName)
      ?? this.localStructTypes.get(lv.rawName)
      ?? this.mappingStructStateVars.get(lv.rawName) // flattened struct state var (`s1.arr[i]`)
      ?? this.mappingStateVarTypes.get(lv.rawName);
    // Flattened mapping-of-struct (`m[k].d`): a leading key steps through the mapping to the value struct.
    if (!cur && this.mappingStructValueVars.has(lv.rawName)) {
      cur = new MappingType(PrimitiveType.BIGINT, this.mappingStructValueVars.get(lv.rawName)!);
    }
    if (!cur) return undefined;
    for (const seg of lv.segs) {
      if (seg.member !== undefined) {
        if (!(cur instanceof StructType)) return undefined;
        cur = cur.fields.find((f) => f.name === seg.member)?.type;
      } else {
        if (cur instanceof ArrayType) cur = cur.elementType;
        else if (cur instanceof MappingType) cur = cur.valueType;
        else return undefined;
      }
      if (!cur) return undefined;
    }
    return cur instanceof ArrayType ? cur : undefined;
  }

  // `<receiver>.push(v)` / `.pop()` where <receiver> is an indexed struct-field array (`data[i].d`, `s1.arr[i]`):
  // read the whole array into a temp, push/pop on the temp, write the whole array back. The read is the visited
  // receiver expression; the write-back reuses buildLvalueAssign with the temp as the value node (so packed and
  // non-packed element paths lower correctly). Returns undefined when the receiver type or write-back is unsupported.
  private buildIndexedFieldArrayPushPop(
    ctx: ExpressionStatementContext, lhsCtx: ExpressionContext,
    lv: { rawName: string; isThis: boolean; nameLoc: Location; segs: LvSeg[] }, isPop: boolean,
    pushValue?: ExpressionNode,
  ): StatementNode | undefined {
    if (lv.isThis) return undefined; // `this.`-qualified indexed field push is not a parsed shape
    // `m[k].d.push(v)` on a mapping whose value struct has a dynamic array field: the field flattens to the
    // standalone mapping `m__d`, so emit the native entry append `m__d[k].push(v)`. A read-modify-write would
    // re-read the stale entry (a mapping entry's write is not visible to a later read in the same tx), so multiple
    // pushes in one tx would not accumulate. Only the mapping-of-struct receiver needs this; array/struct
    // receivers accumulate correctly under the whole-array rewrite below.
    const mappingFieldPush = this.tryMappingStructFieldPush(ctx, lv, isPop);
    if (mappingFieldPush) return mappingFieldPush;
    const arrType = this.resolvePushReceiverArrayType(lv);
    if (!arrType) return undefined;
    const loc = Location.fromCtx(ctx);
    const idAt = (n: string): IdentifierNode => { const i = new IdentifierNode(n); i.location = loc; return i; };
    const tmpName = `__pf_${this.nestedLvalueCounter++}`;
    const readExpr = this.visit(lhsCtx) as ExpressionNode; // whole-array read of the receiver
    const decl = new VariableDefinitionNode(arrType, [], tmpName, readExpr);
    decl.location = loc;
    let op: StatementNode;
    if (isPop) {
      op = this.buildArrayPop(tmpName, false, [], undefined, ctx);
    } else {
      const argCtx = ctx.pushArgument();
      const noArg = pushValue === undefined && argCtx === null;
      const value = pushValue ?? (noArg
        ? this.noArgPushPlaceholder(ctx)
        : this.visit(argCtx!.expression()) as ExpressionNode);
      op = this.buildArrayPush(tmpName, false, [], undefined, value, noArg, ctx);
    }
    const back = this.buildLvalueAssign(lv.rawName, false, lv.nameLoc, lv.segs, '=', undefined, loc, idAt(tmpName));
    const block = new BlockNode([decl, op, back]);
    block.location = loc;
    return block;
  }

  // `m[k].d.push(v)` / `.pop()` where m is a mapping-of-struct and d is a dynamic array field of the value struct:
  // the field flattens to the standalone mapping `m__d`, so route to the native entry append/pop on `m__d[k]`.
  private tryMappingStructFieldPush(
    ctx: ExpressionStatementContext, lv: { rawName: string; segs: LvSeg[] }, isPop: boolean,
  ): StatementNode | undefined {
    if (lv.segs.length !== 2) return undefined;
    const keySeg = lv.segs.find((s) => s.key !== undefined);
    const memSeg = lv.segs.find((s) => s.member !== undefined);
    if (!keySeg || !memSeg) return undefined;
    const valStruct = this.mappingStructValueVars.get(lv.rawName);
    if (!valStruct) return undefined;
    const field = valStruct.fields.find((f) => f.name === memSeg.member);
    if (!field || !(field.type instanceof ArrayType)) return undefined;
    const flatName = `${lv.rawName}__${memSeg.member}`;
    const keyFns = [keySeg.key!];
    if (isPop) return this.buildArrayPop(flatName, false, keyFns, undefined, ctx);
    const argCtx = ctx.pushArgument();
    const noArg = argCtx === null;
    const value = noArg ? this.noArgPushPlaceholder(ctx) : this.visit(argCtx!.expression()) as ExpressionNode;
    return this.buildArrayPush(flatName, false, keyFns, undefined, value, noArg, ctx);
  }

  visitExpressionStatement(ctx: ExpressionStatementContext): StatementNode {
    const lhsCtx = ctx.expression(0);
    // A discarded tuple expression evaluates each ordinary component. Builtin function references inside it
    // (`(abi.encode, "")`) are values with no runtime representation and contribute no evaluation.
    let discardedTupleCtx: ExpressionContext = lhsCtx;
    while (discardedTupleCtx instanceof ParenthesisedContext) {
      discardedTupleCtx = discardedTupleCtx.expression();
    }
    if (discardedTupleCtx instanceof TupleExpressionContext) {
      const loc = Location.fromCtx(ctx);
      const statements = discardedTupleCtx.expression_list()
        .filter((component) => !component.getText().startsWith('abi.') && component.getText() !== 'assert')
        .map((component) => {
          const statement = new ExpressionStatementNode(this.visit(component) as ExpressionNode);
          statement.location = loc;
          return statement;
        });
      const block = new BlockNode(statements);
      block.location = loc;
      return block;
    }
    // A tuple conditional at statement scope evaluates its condition once and the selected tuple components,
    // then discards them. Reuse the per-component ternary lowering; the zero-component case retains only the
    // condition temp declaration, so even `effect() ? () : ();` still evaluates effect().
    const tupleTernary = this.tupleTernary(lhsCtx);
    if (tupleTernary) {
      const loc = Location.fromCtx(ctx);
      const { tempDecl, values } = this.desugarTupleTernary(tupleTernary);
      const statements: StatementNode[] = [tempDecl, ...values.map((value) => {
        const statement = new ExpressionStatementNode(value);
        statement.location = loc;
        return statement;
      })];
      const block = new BlockNode(statements);
      block.location = loc;
      return block;
    }
    // A known struct type used as a discarded expression (`S;` / `S[7];`) is a Solidity no-op. Resolve it here
    // against the actual struct registry rather than accepting every identifier syntactically as a possible type.
    const tupleBase = lhsCtx instanceof TupleIndexOpContext ? lhsCtx.expression() : undefined;
    const discardedStructType = lhsCtx instanceof IdentifierContext
      ? lhsCtx.anyIdentifier().getText()
      : tupleBase instanceof IdentifierContext
        ? tupleBase.anyIdentifier().getText()
        : undefined;
    if (discardedStructType && (this.structMap.has(discardedStructType) || discardedStructType === 'uint')) {
      if (lhsCtx instanceof TupleIndexOpContext
        && BigInt(lhsCtx.NumberLiteral().getText().replaceAll('_', '')) >= 1n << 256n) {
        throw new ParseError('Type-expression array bound does not fit uint256', Location.fromCtx(lhsCtx));
      }
      const node = new BlockNode([]);
      node.location = Location.fromCtx(ctx);
      return node;
    }
    // `data.push;` / `data.pop;` / `data.delete;` merely reference an array member function and discard it.
    // Solidity emits no runtime operation, so preserve that behavior with an empty statement block.
    if (ctx._bareMember) {
      const node = new BlockNode([]);
      node.location = Location.fromCtx(ctx);
      return node;
    }
    // Assignment `lvalue op= value` (left-factored): reconstruct the lvalue segments from the parsed LHS and
    // delegate to the shared builder (the same one the lvPart assignmentStatement path uses). The value side is
    // an assignChain, so `a = b = c;` desugars to sequential right-to-left assignments.
    if (ctx._op) {
      const loc = Location.fromCtx(ctx);
      const { links, valueCtx } = this.unrollAssignChain(lhsCtx, ctx._op.text, ctx.assignChain()!);
      if (links.length === 1) {
        const directSelfMethod = /^this\.([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(valueCtx.getText())?.[1];
        const indexedTarget = /^([A-Za-z_$][A-Za-z0-9_$]*)\[(\d+)\]$/.exec(lhsCtx.getText());
        const assignedMethod = /\.([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(valueCtx.getText())?.[1];
        if (ctx._op.text === '=' && indexedTarget && assignedMethod) {
          this.indexedExternalFunctionAliases.set(
            `${indexedTarget[1]}[${BigInt(indexedTarget[2]).toString()}]`,
            assignedMethod,
          );
        }
        if (ctx._op.text === '=' && lhsCtx instanceof IdentifierContext && directSelfMethod
          && this.currentContractFunctionNames.has(directSelfMethod)) {
          this.selfExternalFunctionAliases.set(lhsCtx.anyIdentifier().getText(), directSelfMethod);
        }
        // `x op= cond ? a = v : b` - distribute the outer assignment into the ternary's arms.
        const t = this.maybeDesugarTernaryAssignValue(valueCtx, links[0], loc);
        if (t) return t;
        return this.buildAssignStatement(lhsCtx, ctx._op.text, valueCtx, loc);
      }
      const block = new BlockNode(this.buildAssignChainStatements(links, valueCtx, loc));
      block.location = loc;
      return block;
    }
    // `cond ? a = v : b = v;` - branch assignments at statement scope desugar to if/else.
    if (lhsCtx instanceof TernaryOpContext && (lhsCtx._tOp || lhsCtx._fOp)) {
      return this.buildTernaryAssignBranch(lhsCtx, undefined, Location.fromCtx(ctx));
    }
    // `receiver.push(v)` / `.pop()` / `.delete(v)` tails: reconstruct the receiver (rawName, isThis, mapping keys,
    // struct array-field member) from the parsed LHS and dispatch to the array/mapping builder.
    if (ctx.DotPush_list().length > 0 || ctx.DotPop() || ctx.DotDelete()) {
      // `getStorageBytes().push(v)` for a zero-arg, side-effect-free helper that returns one direct state
      // variable by storage reference. The helper is a compile-time alias, so mutate its known target directly.
      if (ctx.DotPush_list().length === 1 && lhsCtx instanceof FunctionCallExpressionContext) {
        const fc = lhsCtx.functionCall();
        const ids = fc.Identifier_list();
        const args = fc.expressionList()?.callArgument_list() ?? [];
        const functionName = ids.length === 1 && args.length === 0 ? ids[0].getText() : undefined;
        const alias = functionName ? this.simpleStorageReturnAliases.get(functionName) : undefined;
        if (alias) {
          const argCtx = ctx.pushArgument();
          const value = argCtx === null ? undefined : this.visit(argCtx.expression()) as ExpressionNode;
          const block = new BlockNode(this.buildStorageAliasPushStatements(alias, value, argCtx === null, ctx));
          block.location = Location.fromCtx(ctx);
          return block;
        }
        if (functionName && this.currentContractFunctionNames.has(functionName)) {
          const argCtx = ctx.pushArgument();
          const value = argCtx === null ? undefined : this.visit(argCtx.expression()) as ExpressionNode;
          const block = new BlockNode([]);
          block.location = Location.fromCtx(ctx);
          const pending = { block, value, noArg: argCtx === null, ctx };
          const list = this.pendingStorageReturnPushes.get(functionName) ?? [];
          list.push(pending);
          this.pendingStorageReturnPushes.set(functionName, list);
          return block;
        }
      }
      // `++arr.push()` / `--arr.push()`: no-arg push first appends the element default, then prefix mutation
      // updates the returned storage reference. For a plain dynamic-array receiver this is exactly one push of
      // `default(T) +/- 1` (and preserves bounded-int checked arithmetic through the normal binary-op path).
      if (ctx.DotPush_list().length === 1 && lhsCtx instanceof PrefixOpContext
        && (lhsCtx._op.text === '++' || lhsCtx._op.text === '--') && ctx.pushArgument() === null) {
        const pushLv = this.extractLvalue(lhsCtx.expression());
        if (pushLv) {
          const arrayType = this.resolvePushReceiverArrayType(pushLv);
          if (arrayType) {
            const loc = Location.fromCtx(ctx);
            const one = new IntLiteralNode(1n); one.location = loc;
            let value: ExpressionNode;
            if (lhsCtx._op.text === '++') {
              // The numeric default is zero, so `++default(T)` is exactly T(1).
              value = new CastNode(arrayType.elementType, one, false);
              value.location = loc;
            } else {
              const zero = createDefaultValueExpression(arrayType.elementType, loc);
              value = new BinaryOpNode(zero, BinaryOperator.MINUS, one);
              value.location = loc;
            }
            if (pushLv.segs.length === 0) {
              return this.buildArrayPush(
                pushLv.rawName, pushLv.isThis, [], undefined, value, false, ctx,
              );
            }
            const members = pushLv.segs.filter((seg) => seg.member !== undefined);
            const keys = pushLv.segs.filter((seg) => seg.key !== undefined);
            if (members.length === 1 && keys.length >= 1) {
              const rmw = this.buildIndexedFieldArrayPushPop(
                ctx, lhsCtx.expression(), pushLv, false, value,
              );
              if (rmw) return rmw;
            }
          }
        }
      }
      const lv = this.extractLvalue(lhsCtx);
      if (!lv) throw new ParseError('Invalid .push/.pop/.delete target', Location.fromCtx(lhsCtx));
      // `C.a.push()/pop()` uses the current contract type as a state qualifier. Strip it before receiver
      // classification just as buildLvalueAssign already does for `C.a[i] = value`.
      if (!lv.isThis && lv.rawName === this.currentContractName && lv.segs[0]?.member
        && this.stateVarNames.has(lv.segs[0].member)) {
        lv.rawName = lv.segs[0].member;
        lv.segs = lv.segs.slice(1);
      }
      // Collapse leading members that descend through flattened struct fields into the name (same as
      // buildLvalueAssign), so `t.s.b.push()` -> receiver `t__s` + member `b` (a single struct-array-field push).
      if (!lv.isThis) {
        while (lv.segs.length > 1 && lv.segs[0].member !== undefined && this.mappingStructStateVars.has(lv.rawName)) {
          const field = this.mappingStructStateVars.get(lv.rawName)!.fields.find((f) => f.name === lv.segs[0].member);
          if (!field || !(field.type instanceof StructType) || !this.structNeedsFieldFlattening(field.type)) break;
          lv.rawName = `${lv.rawName}__${lv.segs[0].member}`;
          lv.segs = lv.segs.slice(1);
        }
        // An array-valued field of a flattened state struct is itself stored under `<struct>__<field>`.
        // Preserve the following element index/member chain so `t.rows[i].items.push(v)` reaches the existing
        // indexed struct-field read/modify/write lowering as receiver `t__rows[i].items`.
        if (lv.segs.length > 2 && lv.segs[0].member !== undefined && lv.segs[1].key !== undefined) {
          const owner = this.mappingStructStateVars.get(lv.rawName) ?? this.stateStructVars.get(lv.rawName);
          const field = owner?.fields.find((candidate) => candidate.name === lv.segs[0].member);
          if (field?.type instanceof ArrayType && field.type.elementType instanceof StructType) {
            lv.rawName = `${lv.rawName}__${lv.segs[0].member}`;
            lv.segs = lv.segs.slice(1);
          }
        }
      }
      const members = lv.segs.filter((s) => s.member !== undefined).map((s) => s.member!);
      const keyFns = lv.segs.filter((s) => s.key !== undefined).map((s) => s.key!);
      const member = members.length === 1 && keyFns.length === 0 ? members[0] : undefined;
      // Indexed struct-field array push/pop (`data[i].d.push(v)`, `s1.arr[i].push()`): a receiver mixing an index
      // key and a struct field. Struct-array elements / struct fields have no in-place inner-array push, so
      // read-modify-write via a temp: `T[] __pf = <receiver>; __pf.push(v); <receiver> = __pf;` - reusing the
      // whole-array read and the whole-array write-back (both already lower). Only when the receiver type resolves.
      if (members.length >= 1 && keyFns.length >= 1 && (ctx.DotPush_list().length > 0 || ctx.DotPop())) {
        const rmw = this.buildIndexedFieldArrayPushPop(ctx, lhsCtx, lv, !!ctx.DotPop());
        if (rmw) return rmw;
      }
      // Only plain (`arr`), single struct-field (`s.xs`), or indexed (`m[k]`) receivers are valid targets - the
      // same shapes the old rules parsed; a mixed/nested chain (`s.a.b`, `s.xs[k]`) was a parse error, keep it so.
      if (members.length > 0 && member === undefined) {
        throw new ParseError('Unsupported .push/.pop/.delete receiver', Location.fromCtx(lhsCtx));
      }
      // A fixed array has no native push/pop member, so an attached library method with either name wins:
      // `using L for uint[2]; input.push()` means `L.push(input)`, not the dynamic-array builtin. These spellings
      // use dedicated grammar tokens and therefore bypass buildMethodCall's normal using-for resolution.
      const receiverTypeKey = !lv.isThis && keyFns.length === 0 && member === undefined
        ? this.localSimpleTypeKeys.get(lv.rawName) : undefined;
      const fixedArrayLibrary = receiverTypeKey && /\[[1-9][0-9]*\]$/.test(receiverTypeKey)
        ? this.usingForLibraries.get(receiverTypeKey) : undefined;
      if (fixedArrayLibrary && (ctx.DotPush_list().length > 0 || ctx.DotPop())) {
        const receiver = new IdentifierNode(lv.rawName);
        receiver.location = Location.fromCtx(lhsCtx);
        const method = ctx.DotPop() ? 'pop' : 'push';
        const args: ExpressionNode[] = [receiver];
        const pushArg = ctx.DotPush_list().length > 0 ? ctx.pushArgument() : undefined;
        if (pushArg?.expression()) args.push(this.visit(pushArg.expression()) as ExpressionNode);
        const id = new IdentifierNode(`${fixedArrayLibrary}.${method}`);
        id.location = Location.fromCtx(ctx);
        const call = new FunctionCallNode(id, args);
        call.location = Location.fromCtx(ctx);
        const statement = new FunctionCallStatementNode(call);
        statement.location = Location.fromCtx(ctx);
        return statement;
      }
      if (ctx.DotPush_list().length > 0) {
        return this.buildPushStatement(ctx, lv, keyFns, member);
      }
      if (ctx.DotPop()) return this.buildArrayPop(lv.rawName, lv.isThis, keyFns, member, ctx);
      const arg = this.visit(ctx.expression(1)) as ExpressionNode;
      return this.buildDelete(lv.rawName, lv.isThis, keyFns, arg, ctx);
    }
    // Bare `lvalue++;` / `lvalue--;`: the value is discarded, so it is exactly `lvalue += 1` / `-= 1`. Route
    // through buildLvalueAssign (handles every lvalue shape); expression-position postfix (`y = x++`) is left
    // for DesugarPostfixExpressions.
    if (lhsCtx instanceof PostfixOpContext) {
      const lv = this.extractLvalue(lhsCtx.expression());
      if (!lv) {
        // The operand is not an lvalue (a chained `x++++;`, `f()++;`, etc.) - not a valid increment target.
        throw new ParseError('Invalid increment/decrement target', Location.fromCtx(lhsCtx));
      }
      return this.buildLvalueAssign(
        lv.rawName, lv.isThis, lv.nameLoc, lv.segs, lhsCtx._op.text, undefined, Location.fromCtx(ctx),
      );
    }
    // A call used as a statement (`f(args);`, `x.f(args);`, `x.call(data);`, `this.transfer(a,b);`, ...): route
    // to the right call-statement node (the folded functionCall/addressMethod/transfer/tokenContainer forms).
    if (lhsCtx instanceof FunctionCallExpressionContext || lhsCtx instanceof MethodCallContext
      || lhsCtx instanceof MethodCallNamedContext) {
      return this.buildCallStatement(lhsCtx);
    }
    // Otherwise a bare expression, computed and dropped: a pure value or a side-effect-free access.
    const expression = this.visit(lhsCtx) as ExpressionNode;
    const node = new ExpressionStatementNode(expression);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitBareAbiFunctionReferenceStatement(ctx: BareAbiFunctionReferenceStatementContext): BlockNode {
    const node = new BlockNode([]);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitBareAbiReferenceExpression(ctx: any): Node {
    throw new ParseError(
      'A builtin function reference is only supported as a discarded expression',
      Location.fromCtx(ctx),
    );
  }

  visitPrimitiveTypeReferenceStatement(ctx: PrimitiveTypeReferenceStatementContext): BlockNode {
    for (const exprCtx of ctx.expression_list()) {
      const value = this.evalConstIntNode(this.visit(exprCtx) as ExpressionNode);
      if (value === undefined) {
        throw new ParseError(
          `Type-expression array bound '${exprCtx.getText()}' must be a compile-time integer constant`,
          Location.fromCtx(exprCtx),
        );
      }
      if (value <= 0n || value >= 1n << 256n) {
        throw new ParseError(
          `Type-expression array bound '${exprCtx.getText()}' must be positive and fit uint256`,
          Location.fromCtx(exprCtx),
        );
      }
    }
    const node = new BlockNode([]);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitUserDefinedArrayTypeReferenceStatement(ctx: any): StatementNode {
    const name = ctx.Identifier().getText();
    const dimensions = ctx.expression_list() as ExpressionContext[];
    if (!this.structMap.has(name) && !this.enumMap.has(name) && !this.typeDefMap.has(name)) {
      throw new ParseError(`Unknown user-defined array type '${name}'`, Location.fromCtx(ctx));
    }
    for (const dimension of dimensions) {
      const value = this.evalConstIntNode(this.visit(dimension) as ExpressionNode);
      if (value === undefined) {
        throw new ParseError(
          `Type-expression array bound '${dimension.getText()}' must be a compile-time integer constant`,
          Location.fromCtx(dimension),
        );
      }
      if (value <= 0n || value >= 1n << 256n) {
        throw new ParseError(
          `Type-expression array bound '${dimension.getText()}' must be positive and fit uint256`,
          Location.fromCtx(dimension),
        );
      }
    }
    const block = new BlockNode([]);
    block.location = Location.fromCtx(ctx);
    return block;
  }

  // Build the statement for a call-shaped bare expression. Statement-only forms (low-level `.call`/`.staticcall`/
  // `.delegatecall`, satoshi `addr.transfer(v)`, `this.transfer(a,b)`, `this.tokens[c].transfer(...)`) are matched
  // before visiting (the expression visitor would mis-handle `this.transfer` as a self-call); everything else is
  // visited and wrapped by node kind (FunctionCall / MethodCall -> the matching statement node; a dropped value
  // like `.send`'s bool -> ExpressionStatement).
  private buildCallStatement(lhsCtx: ExpressionContext): StatementNode {
    const wrap = (n: ExpressionNode): StatementNode => {
      const s = n instanceof FunctionCallNode ? new FunctionCallStatementNode(n)
        : n instanceof MethodCallNode ? new MethodCallStatementNode(n)
          : new ExpressionStatementNode(n);
      s.location = Location.fromCtx(lhsCtx);
      return s;
    };
    // `a.call(d)` / `a.staticcall(d)` / `a.delegatecall(d)` on a simple identifier parse as a namespaced
    // FunctionCall (`a.call`), not a MethodCall, so match the low-level routing here too (no call options - the
    // `a.call{value:}(d)` form is a MethodCall, handled below).
    if (lhsCtx instanceof FunctionCallExpressionContext) {
      const fc = lhsCtx.functionCall();
      const ids = fc.Identifier_list();
      const llMethod = ids.length === 2 ? ids[1].getText() : undefined;
      const llArgs = fc.expressionList()?.callArgument_list();
      if ((llMethod === 'call' || llMethod === 'staticcall' || llMethod === 'delegatecall') && llArgs?.length === 1) {
        const args = llArgs;
        const target = new IdentifierNode(ids[0].getText());
        target.location = Location.fromToken(ids[0].symbol);
        const node = new LowLevelCallStatementNode(target, this.visit(args[0].expression()) as ExpressionNode, llMethod);
        node.location = Location.fromCtx(lhsCtx); return node;
      }
      // A struct constructor used as a statement (`S(1, 2);`) computes a value and discards it; it is not a
      // user-function call. Route it through ExpressionStatement so semantic struct-constructor resolution runs.
      if (ids.length === 1 && this.structMap.has(ids[0].getText())) {
        const node = new ExpressionStatementNode(this.visit(lhsCtx) as ExpressionNode);
        node.location = Location.fromCtx(lhsCtx);
        return node;
      }
      return wrap(this.visit(lhsCtx) as ExpressionNode);
    }
    if (lhsCtx instanceof MethodCallNamedContext) {
      return wrap(this.visit(lhsCtx) as ExpressionNode);
    }
    const ctx = lhsCtx as MethodCallContext;
    const method = ctx.anyIdentifier()?.getText()
      ?? (ctx.getText().includes('.value') ? 'value' : 'length');
    const recvCtx = ctx.expression();
    const loc = Location.fromCtx(ctx);
    const callArgs = this.buildCallArguments(ctx.expressionList());
    // Low-level `.call`/`.staticcall`/`.delegatecall(payload)` takes exactly one arg. A same-named method with a
    // different arity (e.g. `IFoo(c).increment.call()` - an interface method reached via a field access) is not a
    // low-level call and falls through to the generic method-call wrap below.
    if ((method === 'call' || method === 'staticcall' || method === 'delegatecall') && callArgs.length === 1) {
      const node = new LowLevelCallStatementNode(this.visit(recvCtx) as ExpressionNode, callArgs[0], method);
      node.callOptions = this.parseCallOptions(ctx.callOptions());
      if (node.callOptions?.value && (method === 'staticcall' || method === 'delegatecall')) {
        throw new ParseError(`Cannot set call option 'value' for ${method}`, loc);
      }
      node.location = loc;
      return node;
    }
    if (recvCtx instanceof MappingAccessContext && recvCtx.Identifier().getText() === 'tokens') {
      if (method !== 'transfer' && method !== 'transferNft') {
        throw new ParseError(`Unknown token container method '${method}', expected 'transfer' or 'transferNft'`, loc);
      }
      const keyExpr = this.visit(recvCtx.expression_list()[0]) as ExpressionNode;
      const args = callArgs;
      if (method === 'transfer' && args.length !== 2) throw new ParseError('this.tokens[...].transfer() expects 2 arguments (to, amount)', loc);
      if (method === 'transferNft' && args.length !== 3) throw new ParseError('this.tokens[...].transferNft() expects 3 arguments (to, commitment, capability)', loc);
      const node = new TokenContainerMethodStatementNode(keyExpr, method, args); node.location = loc; return node;
    }
    if (method === 'transfer') {
      if (recvCtx.getText() === 'this' && !this.currentContractFunctionNames.has(method)) {
        if (callArgs.length !== 2) {
          throw new ParseError('this.transfer() expects 2 arguments (lockingBytecode, amount)', loc);
        }
        const node = new TransferStatementNode(callArgs[0], callArgs[1]);
        node.location = loc; return node;
      }
      if (recvCtx.getText() !== 'this' && callArgs.length === 1 && ctx.callOptions() === null) {
        const node = new AddressTransferStatementNode(this.visit(recvCtx) as ExpressionNode, callArgs[0]);
        node.location = loc; return node;
      }
    }
    return wrap(this.visit(lhsCtx) as ExpressionNode);
  }

  visitPrefixIncDecStatement(ctx: PrefixIncDecStatementContext): StatementNode {
    // `++x;` / `--x;` at statement scope is exactly `x += 1` / `x -= 1`; reuse the lvalue reconstruction + builder.
    const lv = this.extractLvalue(ctx.expression());
    if (!lv) throw new ParseError('Invalid increment/decrement target', Location.fromCtx(ctx.expression()));
    return this.buildLvalueAssign(
      lv.rawName, lv.isThis, lv.nameLoc, lv.segs, ctx._op.text, undefined, Location.fromCtx(ctx),
    );
  }



  visitArrayAccess(ctx: ArrayAccessContext): ArrayAccessNode {
    let array = this.visit(ctx.expression(0));
    // Element storage pointer: `T[] storage p = outer[i]; p[j]` reads through the recorded access path.
    // Whole-container aliases are already substituted by visitIdentifier; element aliases deliberately are
    // not, because their replacement is an ArrayAccess rather than an Identifier.
    if (array instanceof IdentifierNode && this.storageAliases.has(array.name)) {
      array = cloneNode(this.storageAliases.get(array.name)!.access) as ExpressionNode;
    }
    const index = this.visit(ctx.expression(1));
    const node = new ArrayAccessNode(array, index);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // Placeholder value for a no-arg `push()`; the type checker replaces it with the element type's default.
  private noArgPushPlaceholder(ctx: ParserRuleContext): ExpressionNode {
    const placeholder = new IntLiteralNode(0n);
    placeholder.location = Location.fromCtx(ctx);
    return placeholder;
  }

  // `bytes b; b.pop()` desugars to `b = b[0 : b.length - 1]` (drop the last byte). Popping an empty bytes slices
  // to end -1, which fails at runtime - matching Solidity's revert-on-empty-pop.
  // The `using L for <key>` key a receiver of this type matches: enum / UDVT name, a contract interface name or
  // 'address', array, 'string', 'bytes'/'bytesN', 'uintN'/'intN'. Mirrors usingForLibraries keying.
  // Structs are resolved via localStructTypes, so they are intentionally not returned here.
  private usingForTypeKey(type: Type): string | undefined {
    if (type instanceof EnumType) return type.name;
    if (type instanceof ValueType) return type.name;
    if (type instanceof AddressType) return type.interfaceName ?? 'address';
    if (type instanceof ArrayType) return type.toString();
    if (type === PrimitiveType.STRING) return 'string';
    if (type instanceof BytesType) return type.bound === undefined ? 'bytes' : `bytes${type.bound}`;
    if (type instanceof IntType) return `${type.signed ? 'int' : 'uint'}${type.bits}`;
    return undefined;
  }

  // `data[i] op= v` on an unbounded bytes var -> `data = data[0:i] ++ (data[i] op v) ++ data[i+1:size(data)]`
  // (plain `=` uses v directly). Works for a state var (StateAccess/StateAssign) or a local/memory var
  // (Identifier/Assign), selected by `isState`.
  private desugarBytesElementWrite(
    name: string, indexFn: () => ExpressionNode, value: ExpressionNode, loc: Location, isState: boolean, op: string,
    stringView = false,
  ): StatementNode {
    const stamp = <T extends { location?: Location }>(n: T): T => { n.location = loc; return n; };
    const read = (): ExpressionNode => {
      const base = stamp(isState ? new StateAccessNode(name) : new IdentifierNode(name));
      return stringView ? stamp(new CastNode(new BytesType(), base, false)) : base;
    };
    const len = stamp(new UnaryOpNode(UnaryOperator.SIZE, read()));
    const iPlus1 = stamp(new BinaryOpNode(indexFn(), BinaryOperator.PLUS, stamp(new IntLiteralNode(1n))));
    const prefix = stamp(new SliceNode(read(), stamp(new IntLiteralNode(0n)), indexFn()));
    const suffix = stamp(new SliceNode(read(), iPlus1, len));
    // Compound `op=`: the new byte is the old byte `data[i]` combined with v under the base operator.
    const newByte = op === '='
      ? value
      : stamp(new BinaryOpNode(stamp(new ArrayAccessNode(read(), indexFn())), COMPOUND_OPS[op], value));
    const cat1 = stamp(new BinaryOpNode(prefix, BinaryOperator.PLUS, newByte));
    const cat2 = stamp(new BinaryOpNode(cat1, BinaryOperator.PLUS, suffix));
    if (isState) {
      const result = stringView ? stamp(new CastNode(PrimitiveType.STRING, cat2, false)) : cat2;
      return stamp(new StateAssignNode(name, result));
    }
    const assign = stamp(new AssignNode(stamp(new IdentifierNode(name)), cat2));
    assign.isReferenceDataWrite = true;
    return assign;
  }

  private desugarBytesPop(name: string, ctx: ParserRuleContext): StateAssignNode {
    const loc = Location.fromCtx(ctx);
    const stamp = <T extends { location?: Location }>(n: T): T => { n.location = loc; return n; };
    const len = stamp(new UnaryOpNode(UnaryOperator.SIZE, stamp(new StateAccessNode(name))));
    const end = stamp(new BinaryOpNode(len, BinaryOperator.MINUS, stamp(new IntLiteralNode(1n))));
    const slice = stamp(new SliceNode(stamp(new StateAccessNode(name)), stamp(new IntLiteralNode(0n)), end));
    return stamp(new StateAssignNode(name, slice));
  }

  // `bytes b; b.push(v)` desugars to `b = b + v` (append). No-arg push appends one zero byte. A bytes blob has
  // no per-element length prefix, so a concat is the whole-value append - reuses the tested bytes + codegen.
  private desugarBytesPush(
    name: string, value: ExpressionNode | undefined, ctx: ParserRuleContext, stringView = false,
  ): StateAssignNode {
    let appended = value;
    if (appended === undefined) {
      appended = new HexLiteralNode(new Uint8Array(1)); // no-arg push() appends a single 0x00 byte
      appended.location = Location.fromCtx(ctx);
    } else if (stringView) {
      const byte = new CastNode(new BytesType(1), appended, false);
      byte.location = Location.fromCtx(ctx);
      appended = byte;
    }
    let read: ExpressionNode = new StateAccessNode(name);
    read.location = Location.fromCtx(ctx);
    if (stringView) {
      read = new CastNode(new BytesType(), read, false);
      read.location = Location.fromCtx(ctx);
    }
    const concat = new BinaryOpNode(read, BinaryOperator.PLUS, appended);
    concat.location = Location.fromCtx(ctx);
    let result: ExpressionNode = concat;
    if (stringView) {
      result = new CastNode(PrimitiveType.STRING, concat, false);
      result.location = Location.fromCtx(ctx);
    }
    const node = new StateAssignNode(name, result);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // For safety reasons, we throw an error when the "default" visitChildren is called. *All* nodes
  // must have a custom visit method, so that we can be sure that we've covered all cases.
  visitChildren(): Node {
    throw new Error('Safety Warning: Unhandled node in AST builder');
  }
}

// Returns undefined for a non-integral value (a negative exponent that does not divide out, e.g. 1e-3).
const parseNumberString = (numberString: string): bigint | undefined => {
  const cleanedNumberString = numberString.replace(/_/g, '');

  const isScientificNotation = /[eE]/.test(cleanedNumberString);
  if (!isScientificNotation) return BigInt(cleanedNumberString);

  const [coefficient, exponent] = cleanedNumberString.split(/[eE]/);
  const exp = BigInt(exponent);
  if (exp >= 0n) return BigInt(coefficient) * 10n ** exp;
  // Negative exponent (200e-2 == 2): only integral results are ints (solc parity for int contexts).
  const divisor = 10n ** -exp;
  const mantissa = BigInt(coefficient);
  if (mantissa % divisor !== 0n) return undefined;
  return mantissa / divisor;
};
