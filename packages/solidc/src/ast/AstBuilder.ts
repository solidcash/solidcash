import { ParseTree, ParseTreeVisitor, ParserRuleContext } from 'antlr4';
import { hexToBin } from '@bitauth/libauth';
import { parseType, MappingType, ArrayType, StructType, IntType, FixedType, Type, AddressType, ValueType, BytesType, PrimitiveType, EnumType, isChunkPackableElementType } from '@solidcash/utils';
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
  ParameterContext,
  PlaceholderStatementContext,
  AssignmentExpressionContext,
  ExpressionContext,
  IfStatementContext,
  FunctionCallContext,
  CastContext,
  LiteralContext,
  SourceFileContext,
  BlockContext,
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
  StructDefinitionContext,
  EventDefinitionContext,
  EmitStatementContext,
  ForStatementContext,
  ForInitContext,
  ForConditionContext,
  ForUpdateContext,
  FunctionModifierContext,
  ReturnStatementContext,
  ExpressionStatementContext,
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
} from '../grammar/SolidCashParser.js';
// Value imports (not type-only): needed for `instanceof` when detecting a tuple-valued ternary.
import { TernaryOpContext, TupleExpressionContext } from '../grammar/SolidCashParser.js';
// Imported as values (not `import type`) for runtime `instanceof` in extractLvalue / visitExpressionStatement.
import {
  ParenthesisedContext, ArrayAccessContext, FieldAccessContext, MappingAccessContext,
  StateAccessContext, IdentifierContext, PostfixOpContext, PrefixOpContext, TupleIndexOpContext,
  FunctionCallExpressionContext, MethodCallContext, MethodCallNamedContext,
} from '../grammar/SolidCashParser.js';
import SolidCashVisitor from '../grammar/SolidCashVisitor.js';
import { Location } from './Location.js';
import { buildYulBlock } from './YulAstBuilder.js';
import { isBchAsmBlock } from './YulAST.js';
import AstTraversal from './AstTraversal.js';
import {
  Modifier,
  NumberUnit,
  TimeOp,
} from './Globals.js';
import { getPragmaName, PragmaName, getVersionOpFromCtx } from './Pragma.js';
import { version } from '../index.js';
import { ParseError, StateVariableNameCollisionError, UnsupportedTypeError, VersionError } from '../Errors.js';

const RESERVED_STATE_NAMES = ['age', 'activeInputIndex', 'activeBytecode', 'categoryId', 'tokens'];

// Compound-assignment operators desugared to `target <binop> rhs`.
const COMPOUND_OPS: Record<string, BinaryOperator> = {
  '+=': BinaryOperator.PLUS, '++': BinaryOperator.PLUS,
  '-=': BinaryOperator.MINUS, '--': BinaryOperator.MINUS,
  '*=': BinaryOperator.MUL, '/=': BinaryOperator.DIV, '%=': BinaryOperator.MOD,
  '&=': BinaryOperator.BIT_AND, '|=': BinaryOperator.BIT_OR, '^=': BinaryOperator.BIT_XOR,
  '<<=': BinaryOperator.SHIFT_LEFT, '>>=': BinaryOperator.SHIFT_RIGHT,
};

// One ordered segment of an lvalue chain: a `.member` (or `.value`), or an `[index]` key. The interleaved order
// is preserved (alternating chains like `m[i].arr[j]` depend on it). The key is a THUNK producing a FRESH key
// node per call (read + write nodes must not share instances) - re-visiting a key context (lvPart / ArrayAccess)
// or building a literal (a NumberLiteral index parses as TupleIndexOp, not a wrapped expression). Built from the
// lvPart grammar list or reconstructed from a parsed LHS expression; consumed by buildLvalueAssign.
interface LvSeg {
  member?: string;
  key?: () => ExpressionNode;
}

export default class AstBuilder
  extends ParseTreeVisitor<Node>
  implements SolidCashVisitor<Node> {
  private structMap: Map<string, StructType> = new Map();
  private enumMap: Map<string, EnumType> = new Map();
  // Library names, so a library-namespaced enum access `L.E.Member` can strip the `L.` to the bare enum.
  private libraryNames: Set<string> = new Set();

  // Contract + interface names, so a contract/interface-namespaced TYPE access `C.T.unwrap` / `I.Enum.Member`
  // strips the `C.`/`I.` to the bare (globally-registered) type, like the library case.
  private contractInterfaceNames: Set<string> = new Set();
  private typeDefMap: Map<string, ValueType> = new Map();
  private pendingParentInvocations: ParentInvocation[] = [];
  private packedStateArrayNames: Set<string> = new Set();
  // Unbounded `bytes` state vars, for desugaring `.push`/`.pop` to a whole-value concat / slice reassignment.
  private bytesStateVarNames: Set<string> = new Set();
  // Chunk-packed/packed state struct arrays -> element StructType, for desugaring element-field writes
  // (`arr[i].field = v`) to a whole-element rebuild (`arr[i] = T(arr[i].f0, .., v, ..)`).
  private packedStructArrayElems: Map<string, StructType> = new Map();
  // State struct variables -> StructType, for desugaring field-chain writes (`this.d.x = v`) to a rebuild.
  private stateStructVars: Map<string, StructType> = new Map();
  // All state variable names, so a tuple assignment to state vars `(x, y) = (a, b)` desugars to state assigns.
  private stateVarNames: Set<string> = new Set();
  // State array variables -> ArrayType, so `using L for T[]` desugars `arr.method(args)` to `L.method(arr, args)`.
  private stateArrayVarTypes: Map<string, ArrayType> = new Map();
  // State mapping variables -> MappingType, so `using L for mapping(K=>V)` desugars `m.method(args)` to
  // `L.method(m, args)` (m becomes a mapping-storage param, inlined at the call site).
  private mappingStateVarTypes: Map<string, MappingType> = new Map();
  // Contract-level param names (`contract C(int x)`), so a constructor with a parent invocation drops only the
  // params that MIRROR contract params (native pattern), keeping its own declared params (Solidity pattern).
  private contractParamNames: Set<string> = new Set();
  // Storage-pointer locals: `T storage x = container[k];` makes `x` a compile-time alias for access path
  // `container[k]`; reads/writes of `x` are rewritten to that path. Per-function (cleared at each entry).
  private storageAliases: Map<string, { container: string; keys: ExpressionNode[]; access: ExpressionNode }> =
    new Map();

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
  // Local unbounded `bytes` vars, to desugar an element write `d[i] = v` to a slice+concat rebuild. Per-function.
  private localBytesVars: Set<string> = new Set();

  // Local/param vars (name -> using-for type key) for NON-struct types (enum/address/contract/string/bytes/int),
  // so a `using L for T` method call `x.method(args)` -> `L.method(x, args)` resolves for any receiver type
  // (structs go through localStructTypes). Per-function.
  private localSimpleTypeKeys: Map<string, string> = new Map();

  // Warn only once that erc7201(...) is aliased to sha256 (no EVM storage layout on BCH).
  private warnedErc7201 = false;

  private forOfArrayCounter = 0; // uniquifies the temp locals of a desugared `for..of` over a state array

  private tupleTernaryCounter = 0; // uniquifies the hoisted condition temp of a desugared tuple ternary

  // Integer-literal constants (`int constant N = 3;`), so a const can be used as an array dimension `T[N]`.
  // Populated by a pre-scan of constant definitions before any types are built (see scanConstantDimensions).
  private constantIntValues: Map<string, number> = new Map();
  // Counter for synthesized temp locals used to desugar nested lvalue writes (`s.arr[i] = v`, `m[i].arr[j] = v`).
  private nestedLvalueCounter = 0;
  // Function name -> its return struct type (for functions returning a struct, e.g. the OZ StorageSlot factory
  // `getAddressSlot(bytes32) returns (AddressSlot storage)`), so an inline `Lib.f(slot).value = v` write can
  // desugar to a typed temp local. Populated as functions are built (callee declared before the caller).
  private functionReturnStructs: Map<string, StructType> = new Map();
  // State mapping name -> its resolved value struct type, for desugaring `m[i].arr[j] = v` (mapping -> struct ->
  // array-field element). Populated per contract from the mapping collections; empty for non-struct mappings.
  private stateMappingValueStruct: Map<string, StructType> = new Map();
  // True while visiting a library's own state-variable declarations. A `public constant` in a library is left
  // as-is (it feeds the library's shared-state/delegate machinery); only CONTRACT-level `public constant` is
  // rerouted to a baked constant (see visitStateVariableDeclaration).
  private inLibraryDecl = false;

  constructor(private tree: ParseTree, private solidityImportCompat = false, private chunkedArrays = true) {
    super();
  }

  defaultResult(): Node {
    return new BoolLiteralNode(false);
  }

  build(): Node {
    return this.visit(this.tree);
  }

  visitSourceFile(ctx: SourceFileContext): SourceFileNode {
    ctx.pragmaDirective_list().forEach((pragma) => {
      this.processPragma(pragma);
    });

    // File-level integer constants usable as array dimensions in file-level definitions and in contracts below.
    this.scanConstantDimensions(ctx.constantDefinition_list());

    const imports = ctx.importDirective_list().map(
      (i) => this.visit(i) as ImportNode,
    );

    // Enums before constants: a file-level enum-typed constant (`E constant c = E.M;`) resolves its declared
    // type via resolveType -> enumMap, so the enum must be registered first.
    const enumDefinitions = ctx.enumDefinition_list().map(
      (e) => this.visitEnumDefinition(e),
    );

    // File-level struct definitions (must be registered before interfaces for type resolution)
    const structDefinitions: StructDefinitionNode[] = [];
    this.registerStructDefinitions(ctx.structDefinition_list(), structDefinitions);

    // File-level type definitions (user-defined value types)
    const typeDefinitions: TypeDefinitionNode[] = [];
    for (const tdCtx of ctx.typeDefinition_list()) {
      const td = this.visitTypeDefinition(tdCtx);
      typeDefinitions.push(td);
    }

    // Constants after enums/structs/typeDefs: a file-level constant may be typed by / initialized from one of them
    // (`T constant g = T.wrap(true)`). Array-dimension constants are already pre-scanned (scanConstantDimensions).
    const constantDefinitions = ctx.constantDefinition_list().map(
      (c) => this.visitConstantDefinition(c),
    );

    const usingForDirectives = ctx.usingForDirective_list().map(
      (u) => this.visit(u) as UsingForDirectiveNode,
    );

    const errorDefinitions = ctx.errorDefinition_list().map(
      (e) => this.visitErrorDefinition(e),
    );

    const interfaceDefinitions = ctx.interfaceDefinition_list().map(
      (i) => this.visitInterfaceDefinition(i),
    );

    const freeFunctions = ctx.freeFunctionDefinition_list().map(
      (f) => this.visitFreeFunctionDefinition(f),
    );

    // Process all library definitions (there may be multiple before the contract)
    const allLibDefs = ctx.libraryDefinition_list();
    const allLibEventDefs: EventDefinitionNode[] = [];
    for (const libCtx of allLibDefs) {
      const libName = libCtx.Identifier().getText();
      this.libraryNames.add(libName);

      // Library enum definitions
      for (const edCtx of libCtx.enumDefinition_list()) {
        enumDefinitions.push(this.visitEnumDefinition(edCtx));
      }

      // Library struct definitions
      this.registerStructDefinitions(libCtx.structDefinition_list(), structDefinitions);

      // Library type definitions
      for (const tdCtx of libCtx.typeDefinition_list()) {
        const td = this.visitTypeDefinition(tdCtx);
        typeDefinitions.push(td);
      }

      // Library event definitions (accumulated across all libraries)
      for (const evCtx of libCtx.eventDefinition_list()) {
        allLibEventDefs.push(this.visitEventDefinition(evCtx));
      }

      // Library error definitions (accumulated to file level)
      for (const erCtx of libCtx.errorDefinition_list()) {
        errorDefinitions.push(this.visitErrorDefinition(erCtx));
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
      const libHasState = libCtx.stateVariableDeclaration_list().length > 0;
      const libFunctions = libCtx.freeFunctionDefinition_list().map(
        (f) => {
          const func = this.visitFreeFunctionDefinition(f);
          func.name = `${libName}.${func.name}`;
          if (libHasState) {
            const deployed = func.modifiers.includes(FunctionModifier.PUBLIC)
              || func.modifiers.includes(FunctionModifier.EXTERNAL);
            if (deployed && !func.modifiers.includes(FunctionModifier.DELEGATE)) {
              func.modifiers.push(FunctionModifier.DELEGATE);
            }
          }
          return func;
        },
      );
      freeFunctions.push(...libFunctions);
    }

    // File-level event declarations (Solidity 0.8.22+ allows events at file scope). Accumulated with library
    // events into SourceFileNode.eventDefinitions, which the symbol table registers globally so `emit E()` resolves.
    for (const evCtx of ctx.eventDefinition_list()) {
      allLibEventDefs.push(this.visitEventDefinition(evCtx));
    }

    const contractCtxs = ctx.contractDefinition_list();

    // Collect contract + interface names before visiting bodies, so a namespaced type access inside a body
    // (`C.T.unwrap`, `I.Enum.Member`) can strip the qualifier to the bare type.
    for (const cc of contractCtxs) this.contractInterfaceNames.add(cc.Identifier().getText());
    for (const idef of interfaceDefinitions) this.contractInterfaceNames.add(idef.name);

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
      node.libraryName = libName;
      node.location = Location.fromCtx(ctx);

      // Lower the primary library to a stateless contract when it has explicitly public/external functions, so
      // it can be compiled directly into an artifact (docs/library-contracts.md Phase 2). Functions without an
      // explicit public/external modifier become internal inline helpers (the inline-only library is preserved:
      // an all-unmarked library has no entry point and stays non-compilable).
      if (lastLib) {
        // A delegate library declares the shared state layout it operates on as state vars (the EVM proxy/impl
        // storage-declaration pattern); carry them into the lowered contract so `delegate` functions resolve
        // `this.field` against that layout (docs/library-contracts.md "3b design").
        this.inLibraryDecl = true;
        const libDecls = lastLib.stateVariableDeclaration_list()
          .map((sv) => this.visitStateVariableDeclaration(sv));
        this.inLibraryDecl = false;
        const libStateVars = libDecls.filter((d): d is StateVariableNode => d instanceof StateVariableNode);
        const libCollections = libDecls.filter((d): d is CollectionNode => d instanceof CollectionNode);
        const hasSharedState = libStateVars.length > 0 || libCollections.length > 0;
        const libFns = lastLib.freeFunctionDefinition_list().map((f) => {
          const fn = this.visitFreeFunctionDefinition(f);
          fn.isFreeFunction = false;
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
        if (libFns.some((f) => f.isEntryPoint)) {
          const libContract = new ContractNode(
            libName, [], [], [], [], libStateVars, libCollections, undefined, libFns,
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
    sourceFileNode.importedContracts.push(...contracts.slice(0, -1));
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
    // solidityImportCompat: accept `pragma solidity <any>` and skip the version check (Solidity sources
    // pin old versions like =0.5.17 that the live compiler can't satisfy).
    if (this.solidityImportCompat) return;

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

    // Strip any -beta tags
    const actualVersion = version.replace(/-.*/g, '');

    ctx.pragmaValue().versionConstraint_list().forEach((constraint) => {
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
    const name = ctx.Identifier().getText();
    // Resolve integer-literal constants up front so a const can be used as an array dimension `T[N]` anywhere
    // in the contract body (state vars, params, locals, struct fields), regardless of declaration order.
    this.scanConstantDimensions(ctx.constantDefinition_list());
    this.scanConstantStateVars(ctx.stateVariableDeclaration_list());
    const specs = ctx.inheritanceSpecifier_list();
    const implementsList = specs.map((s) => s.Identifier().getText());
    // Inheritance-list constructor args (`is X("a")`) -> parent invocations, same as a constructor-level X("a").
    const inheritanceInvocations: ParentInvocation[] = specs
      .filter((s) => s.expressionList() !== null)
      .map((s) => ({
        parentName: s.Identifier().getText(),
        args: s.expressionList()!.expression_list().map((e) => this.visit(e) as ExpressionNode),
        location: Location.fromCtx(s),
      }));
    const parameters = ctx.parameterList()
      ? ctx.parameterList()!.parameter_list().map((p) => this.visit(p) as ParameterNode)
      : [];

    // Collect enum definitions
    const enumDefinitions = ctx.enumDefinition_list().map(
      (e) => this.visitEnumDefinition(e),
    );

    // Collect struct definitions first (they must be available for type resolution)
    const structDefinitions: StructDefinitionNode[] = [];
    this.registerStructDefinitions(ctx.structDefinition_list(), structDefinitions);

    // Collect type definitions (user-defined value types)
    const typeDefinitions: TypeDefinitionNode[] = [];
    for (const tdCtx of ctx.typeDefinition_list()) {
      const td = this.visitTypeDefinition(tdCtx);
      typeDefinitions.push(td);
    }

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
      if (u.libraryName && u.targetTypeName) {
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
    // chunk-packed array field - into per-field state elements namespaced `<var>__<field>`.
    this.mappingStructStateVars = new Map();
    const expandedStateVars: StateVariableNode[] = [];
    for (const sv of stateVariables) {
      if (sv.type instanceof StructType && this.structNeedsFieldFlattening(sv.type)) {
        this.mappingStructStateVars.set(sv.name, sv.type);
        for (const field of sv.type.fields) {
          const flat = this.buildFlattenedStructField(field.type, `${sv.name}__${field.name}`, sv.location);
          if (flat instanceof CollectionNode) collections.push(flat);
          else expandedStateVars.push(flat);
        }
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
    for (const col of collections) {
      const valStruct = col.type instanceof MappingType ? this.structFromType(col.type.valueType) : undefined;
      if (col.type instanceof MappingType && valStruct && this.structNeedsFieldFlattening(valStruct)) {
        this.mappingStructValueVars.set(col.name, valStruct);
        for (const field of valStruct.fields) {
          const flatType = new MappingType(col.type.keyType, field.type, col.type.keyName);
          const flat = new CollectionNode(flatType, `${col.name}__${field.name}`);
          flat.location = col.location;
          expandedCollections.push(flat);
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
    this.stateArrayVarTypes = new Map(
      stateVariables
        .filter((sv) => sv.type instanceof ArrayType)
        .map((sv) => [sv.name, sv.type as ArrayType]),
    );
    this.mappingStateVarTypes = new Map(
      collections
        .filter((c) => c.type instanceof MappingType)
        .map((c) => [c.name, c.type as MappingType]),
    );
    // Unbounded `bytes` state vars support `.push(b)` / `.pop()` (Solidity dynamic byte array). These desugar
    // to a whole-value concat / slice reassignment (a bytes blob has no per-element prefix), reusing the tested
    // bytes concat + split codegen rather than the length-prefixed array-element path.
    this.bytesStateVarNames = new Set(
      stateVariables
        .filter((sv) => sv.type instanceof BytesType && (sv.type as BytesType).bound === undefined)
        .map((sv) => sv.name),
    );

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

    // Collect abstract function definitions (bodyless functions in abstract contracts)
    const abstractFunctions = ctx.abstractFunctionDefinition_list().map(
      (f) => this.visitAbstractFunctionDefinition(f),
    );

    // Merge and sort by source position so function order matches source code
    const functions = [...concreteFunctions, ...abstractFunctions]
      .sort((a, b) => (a.location?.start.line ?? 0) - (b.location?.start.line ?? 0));

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
      .map((sv) => {
        const assign = new StateAssignNode(sv.name, sv.initializer!);
        assign.location = sv.location;
        sv.initializer = undefined;
        return assign;
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

    // Lower each `transient` state var into a zero-init local in every function that references it: the value
    // resets to 0 at the start of each spend (matching transient's zero-at-tx-start semantics) and never
    // persists. One spend = one execution, so cross-call transient state is N/A on BCH - warned per var.
    if (transientStateVars.length > 0) {
      const allFns = [constructorDef, ...functions, fallbackDef, receiveDef]
        .filter((f): f is FunctionDefinitionNode => !!f);
      for (const tv of transientStateVars) {
        const at = tv.location ? ` (line ${tv.location.start.line})` : '';
        console.log(`Warning: transient state variable '${tv.name}'${at} has no UTXO analogue; SolidCash lowers `
          + 'it to a transaction-local (zero at the start of each spend). It does not persist across spends, and '
          + 'cross-call transient state is impossible on BCH (one spend = one execution).');
        for (const fn of allFns) {
          if (fn.body && new IdentifierReferenceFinder(tv.name).has(fn.body)) {
            const local = new VariableDefinitionNode(tv.type, [], tv.name);
            local.allowUnused = true;
            local.location = tv.location;
            fn.body.statements = [local, ...(fn.body.statements ?? [])];
          }
        }
      }
    }

    const contract = new ContractNode(
      name, parameters, structDefinitions, eventDefinitions, constantDefinitions,
      stateVariables, collections, constructorDef, functions,
    );
    contract.enumDefinitions = enumDefinitions;
    contract.typeDefinitions = typeDefinitions;
    contract.errorDefinitions = errorDefinitions;
    contract.usingForDirectives = usingForDirectives;
    contract.modifierDefinitions = modifierDefinitions;
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
    this.localStructTypes = new Map();
    this.localBytesVars = new Set();
    this.localSimpleTypeKeys = new Map();
    this.localStructArrayTypes = new Map();
    const statements = this.flattenStatements(ctx.statement_list().map((s) => this.visit(s) as StatementNode));
    const block = new BlockNode(statements);
    block.location = Location.fromCtx(ctx);

    // Parse parent invocations
    const piCtxList = ctx.parentInvocation_list();
    if (piCtxList && piCtxList.length > 0) {
      this.pendingParentInvocations = piCtxList.map(
        (piCtx: ParentInvocationContext): ParentInvocation => ({
          parentName: piCtx.Identifier().getText(),
          args: piCtx.expressionList().expression_list().map((e) => this.visit(e) as ExpressionNode),
          location: Location.fromCtx(piCtx),
        }),
      );
      // Native pattern: the constructor's params MIRROR the contract-level params (already in scope) - drop
      // those to avoid VariableRedefinitionError; the body reads the contract params. Solidity pattern:
      // `constructor(uint256 _x) Base(_x)` declares its OWN params with no contract-level equivalent - keep
      // those so the parent-invocation args and the body resolve.
      const ownParams = ctx.parameterList().parameter_list()
        .map((p) => this.visit(p) as ParameterNode)
        .filter((p) => !this.contractParamNames.has(p.name));
      const functionDefinition = new FunctionDefinitionNode('__construct', ownParams, block);
      functionDefinition.location = Location.fromCtx(ctx);
      return functionDefinition;
    }

    const parameters = ctx.parameterList().parameter_list().map((p) => this.visit(p) as ParameterNode);
    const functionDefinition = new FunctionDefinitionNode('__construct', parameters, block);
    functionDefinition.location = Location.fromCtx(ctx);
    return functionDefinition;
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
          name: m.Identifier().getText(),
          args: m.expressionList()
            ? m.expressionList()!.expression_list().map((e) => this.visit(e) as ExpressionNode)
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
    // 'external payable' are both required in the grammar
    node.modifiers = [FunctionModifier.EXTERNAL, FunctionModifier.PAYABLE];
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitFunctionDefinition(ctx: FunctionDefinitionContext): FunctionDefinitionNode {
    this.storageAliases = new Map();
    this.localStructTypes = new Map();
    this.localBytesVars = new Set();
    this.localSimpleTypeKeys = new Map();
    this.localStructArrayTypes = new Map();
    const name = ctx.anyIdentifier().getText();
    const parameters = ctx.parameterList().parameter_list().map((p) => this.visit(p) as ParameterNode);
    // Struct-typed params (incl. `storage` struct pointers) participate in struct-field-write desugaring,
    // so `d.x = v` in a library/helper body rebuilds the struct as for a local.
    for (const p of parameters) {
      if (p.type instanceof StructType) this.localStructTypes.set(p.name, p.type);
      if (p.type instanceof BytesType && p.type.bound === undefined) this.localBytesVars.add(p.name);
      { const k = this.usingForTypeKey(p.type); if (k) this.localSimpleTypeKeys.set(p.name, k); }
    }
    const structPtrParams = this.registerStructPointerParams(parameters);
    const statements = this.flattenStatements(ctx.statement_list().map((s) => this.visit(s) as StatementNode));
    for (const nm of structPtrParams) this.mappingStructStateVars.delete(nm);
    const block = new BlockNode(statements);
    block.location = Location.fromCtx(ctx);

    const functionDefinition = new FunctionDefinitionNode(name, parameters, block);
    functionDefinition.location = Location.fromCtx(ctx);

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
            name: m.Identifier().getText(),
            args: m.expressionList()
              ? m.expressionList()!.expression_list().map((e) => this.visit(e) as ExpressionNode)
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
    // Record a struct-returning function (for inline storage-pointer writes `Lib.f(slot).value = v`).
    if (functionDefinition.returnTypes?.length === 1 && functionDefinition.returnTypes[0] instanceof StructType) {
      this.functionReturnStructs.set(name, functionDefinition.returnTypes[0]);
    }

    // `selfdestruct(addr)` in the body implies the selfdestruct modifier (collapse all state UTXOs, no
    // recreation). The destination is enforced in codegen (visitSelfdestructStatement pins tx.outputs[0] to
    // addr); the SDK's selfdestructTo() routes the freed balance to addr at output 0.
    if (functionDefinition.body.statements!.some((s) => s instanceof SelfdestructStatementNode)
      && !functionDefinition.modifiers.includes(FunctionModifier.SELFDESTRUCT)) {
      functionDefinition.modifiers.push(FunctionModifier.SELFDESTRUCT);
    }

    return functionDefinition;
  }

  visitAbstractFunctionDefinition(ctx: AbstractFunctionDefinitionContext): FunctionDefinitionNode {
    const name = ctx.anyIdentifier().getText();
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

    // Parse custom modifier invocations (split/merge are handled specially)
    const customModCtxs = ctx.customModifierInvocation_list();
    if (customModCtxs && customModCtxs.length > 0) {
      functionDefinition.customModifiers = customModCtxs
        .filter((m) => !this.tryParseSplitMergeModifier(m, functionDefinition))
        .map(
          (m: CustomModifierInvocationContext): CustomModifierInvocation => ({
            name: m.Identifier().getText(),
            args: m.expressionList()
              ? m.expressionList()!.expression_list().map((e) => this.visit(e) as ExpressionNode)
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
    for (const p of parameters) {
      if (p.modifier.includes(Modifier.STORAGE) && p.type instanceof StructType
        && p.type.fields.some((f) => f.type instanceof MappingType)) {
        this.mappingStructStateVars.set(p.name, p.type);
        registered.push(p.name);
      }
    }
    return registered;
  }

  visitFreeFunctionDefinition(ctx: FreeFunctionDefinitionContext): FunctionDefinitionNode {
    this.storageAliases = new Map();
    this.localStructTypes = new Map();
    this.localBytesVars = new Set();
    this.localSimpleTypeKeys = new Map();
    this.localStructArrayTypes = new Map();
    const name = ctx.anyIdentifier().getText();
    const parameters = ctx.parameterList().parameter_list().map((p) => this.visit(p) as ParameterNode);
    // Struct-typed params (incl. `storage` struct pointers) participate in struct-field-write desugaring.
    for (const p of parameters) {
      if (p.type instanceof StructType) this.localStructTypes.set(p.name, p.type);
      if (p.type instanceof BytesType && p.type.bound === undefined) this.localBytesVars.add(p.name);
      { const k = this.usingForTypeKey(p.type); if (k) this.localSimpleTypeKeys.set(p.name, k); }
    }
    const structPtrParams = this.registerStructPointerParams(parameters);
    const statements = this.flattenStatements(ctx.statement_list().map((s) => this.visit(s) as StatementNode));
    for (const nm of structPtrParams) this.mappingStructStateVars.delete(nm);
    const block = new BlockNode(statements);
    block.location = Location.fromCtx(ctx);

    const functionDefinition = new FunctionDefinitionNode(name, parameters, block);
    functionDefinition.location = Location.fromCtx(ctx);
    functionDefinition.isFreeFunction = true;

    // Parse function modifiers (visibility etc.). Library/free functions carry visibility so a library can be
    // classified into inline (internal/private) vs deployable (public/external) functions - see
    // docs/library-contracts.md (Phase 1). Inert for existing free functions, which declare no modifiers.
    const modifierContexts = ctx.functionModifier_list();
    if (modifierContexts && modifierContexts.length > 0) {
      this.parseFunctionModifiers(modifierContexts, functionDefinition);
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
    this.localStructTypes = new Map();
    this.localBytesVars = new Set();
    this.localSimpleTypeKeys = new Map();
    this.localStructArrayTypes = new Map();
    const name = ctx.Identifier().getText();
    const parameters = ctx.parameterList()
      ? ctx.parameterList()!.parameter_list().map((p) => this.visit(p) as ParameterNode)
      : [];
    const statements = ctx.modifierStatement_list().map((s) => {
      if (s.placeholderStatement()) {
        const placeholder = new PlaceholderStatementNode();
        placeholder.location = Location.fromCtx(s.placeholderStatement()!);
        return placeholder;
      }
      return this.visit(s.statement()!) as StatementNode;
    });
    const node = new ModifierDefinitionNode(name, parameters, statements);
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
    const name = ctx.Identifier().getText();
    if (name !== 'split' && name !== 'merge') return false;

    const exprList = ctx.expressionList();
    if (!exprList) return false;
    const exprs = exprList.expression_list();
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
    const placeholder = new PlaceholderStatementNode();
    placeholder.location = Location.fromCtx(ctx);
    return placeholder;
  }

  visitVariableDefinition(ctx: VariableDefinitionContext): StatementNode {
    let type: Type;
    if (ctx.arrayType()) {
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
    // An omitted initializer (`int x;`) leaves expression undefined; codegen emits the type's zero value.
    const expression = ctx.expression() ? this.visit(ctx.expression()) : undefined;

    // `T storage x = arr.push();`: Solidity's no-arg push returns a reference to the freshly-appended element.
    // Desugar to capturing the pre-push length (the new element's index), pushing a default element, and
    // aliasing `x` -> `arr[__idx]` - every read/write of `x` then rewrites to the real array element (reusing
    // the storage-pointer alias machinery + array push). The captured index stays valid across later pushes.
    if (ctx.DotPush() && expression instanceof IdentifierNode) {
      const arrName = expression.name;
      const loc = Location.fromCtx(ctx);
      const stamp = <T extends { location?: Location }>(n: T): T => { n.location = loc; return n; };
      const ident = (nm: string): IdentifierNode => stamp(new IdentifierNode(nm));
      const uid = this.nestedLvalueCounter++;
      const idxName = `__pushPtr_i_${uid}`;
      const defName = `__pushPtr_def_${uid}`;
      // uint __idx = arr.length;  (pre-push length = the appended element's index)
      const idxDef = stamp(new VariableDefinitionNode(
        PrimitiveType.BIGINT, [], idxName, stamp(new UnaryOpNode(UnaryOperator.SIZE, ident(arrName)))));
      idxDef.allowUnused = true;
      // T __def;  (uninitialized -> the element type's zero value, pushed as the new element)
      const defDef = stamp(new VariableDefinitionNode(type, [], defName, undefined));
      defDef.allowUnused = true;
      const push = this.buildArrayPush(arrName, false, [], undefined, ident(defName), false, ctx);
      // alias x -> arr[__idx]  (same shape as `T storage x = arr[k]`; not a real local, so not tracked as one)
      const access = stamp(new ArrayAccessNode(ident(arrName), ident(idxName)));
      this.storageAliases.set(name, { container: arrName, keys: [ident(idxName)], access });
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
    }

    // Track local struct-typed vars so `s.field = v` can desugar to a struct rebuild (visitAssignmentStatement).
    if (type instanceof StructType) this.localStructTypes.set(name, type);
    // Track local struct-array vars (`S[] memory m`) so `m[i].c[j] = v` can desugar (see buildLvalueAssign).
    if (type instanceof ArrayType && type.elementType instanceof StructType) {
      this.localStructArrayTypes.set(name, type.elementType);
    }
    // Track local unbounded bytes vars so `d[i] = v` can desugar to a slice+concat rebuild (see buildLvalueAssign).
    if (type instanceof BytesType && type.bound === undefined) this.localBytesVars.add(name);
    // Track the using-for type key of a non-struct local so `x.method(args)` under `using L for T` resolves.
    const ufKey = this.usingForTypeKey(type);
    if (ufKey) this.localSimpleTypeKeys.set(name, ufKey);

    const variableDefinition = new VariableDefinitionNode(type, modifiers, name, expression);
    variableDefinition.location = Location.fromCtx(ctx);
    return variableDefinition;
  }

  // A struct state var is flattened field-by-field when it has no single-value representation: a mapping field,
  // or a dynamic chunk-packed array field (both back their own state element; see buildFlattenedStructField).
  private structNeedsFieldFlattening(t: StructType): boolean {
    return t.fields.some((f) => f.type instanceof MappingType
      || (this.chunkedArrays && f.type instanceof ArrayType && f.type.bound === undefined
        && isChunkPackableElementType(f.type.elementType)));
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

  // Is `ctx` a `cond ? (..) : (..)` whose branches are both tuple expressions?
  private isTupleTernary(ctx: ExpressionContext | undefined): boolean {
    return ctx instanceof TernaryOpContext
      && ctx._ifTrue instanceof TupleExpressionContext
      && ctx._ifFalse instanceof TupleExpressionContext;
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

  visitTupleAssignment(ctx: TupleAssignmentContext): Node {
    const slots = ctx.tupleSlot_list();
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
            name: slot.anyIdentifier()!.getText(),
            type: at ? this.buildArrayType(at) : (this.resolveType(tn!.getText()) ?? new AddressType(false, tn!.getText())),
          };
        }
        const id = slot.anyIdentifier();
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
    const parenthesised = ctx.getText().startsWith('(');
    // `(a, b) = (e1, e2)` parses N RHS expressions; the other forms parse one tuple-valued expression.
    const exprs = ctx.expression_list();
    // Tuple ternary RHS `(a, b) = cond ? (..) : (..)`: hoist cond, then an N-value assignment of per-element
    // ternaries. Returned as a block so flattenStatements splices the temp + assignment at the same scope.
    if (exprs.length === 1 && this.isTupleTernary(exprs[0])) {
      const { tempDecl, values } = this.desugarTupleTernary(exprs[0] as TernaryOpContext);
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
    const tupleAssignment = exprs.length > 1
      ? new TupleAssignmentNode(elements, undefined as unknown as ExpressionNode, parenthesised,
        exprs.map((e) => this.visit(e) as ExpressionNode))
      : new TupleAssignmentNode(elements, this.visit(exprs[0]) as ExpressionNode, parenthesised);
    tupleAssignment.location = Location.fromCtx(ctx);
    return tupleAssignment;
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

  // Builds an AssignNode from a `=`, `+=`, `-=`, `++` or `--` form, rewriting compound
  // and increment forms as: identifier (+|-) rhs
  private buildCompoundAssign(
    identifierText: string,
    identifierLocation: Location,
    op: string,
    expressionCtx: ExpressionContext | null,
    location: Location,
  ): AssignNode {
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
    } else if (rm && rm.Identifier()) {
      // require(cond, CustomError(args)) - reverts with the custom error if cond is false
      errorName = rm.Identifier().getText();
      args = rm.expressionList().expression_list().map((e) => this.visit(e) as ExpressionNode);
    }
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

  visitForStatement(ctx: ForStatementContext): BlockNode {
    const initCtx = ctx.forInit() as ForInitContext;
    const condCtx = ctx.forCondition() as ForConditionContext;
    const updateCtx = ctx.forUpdate() as ForUpdateContext;

    // Build init. Three forms: a declaration (`uint i = 0`), a bare assignment reusing an outer variable
    // (`i = 0`), or empty (`for (; ...)`). Only the declaration form introduces a loop variable.
    let initNode: StatementNode | undefined;
    if (initCtx.typeName()) {
      const initType = this.resolveType(initCtx.typeName().getText());
      const initModifiers = initCtx.modifier_list().map((m) => m.getText());
      const initName = initCtx.Identifier().getText();
      // Initializer is optional (`for (uint i; ...)`); default an omitted one to 0.
      let initExpr: ExpressionNode;
      if (initCtx.expression()) {
        initExpr = this.visit(initCtx.expression()) as ExpressionNode;
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
        initCtx.expression(),
        Location.fromCtx(initCtx),
      );
    }
    // else: empty init (`for (; ...)`) - no statement.

    // Update clause is optional (`for (...; ...; )`); when present it becomes the trailing body statement.
    const updateNode = updateCtx
      ? this.buildCompoundAssign(
        updateCtx.Identifier().getText(),
        Location.fromToken(updateCtx.Identifier().symbol),
        updateCtx._op.text,
        updateCtx.expression(),
        Location.fromCtx(updateCtx),
      )
      : undefined;

    // Build condition
    const condition = this.visit(condCtx.expression());

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
    const block = buildYulBlock(ctx.yulBlock());
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
    const node = new CatchClauseNode(block, errorName, parameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitBlock(ctx: BlockContext): BlockNode {
    const statements = this.flattenStatements(ctx.statement_list().map((s) => this.visit(s) as StatementNode));
    const block = new BlockNode(statements);
    block.location = Location.fromCtx(ctx);
    return block;
  }

  visitParenthesised(ctx: ParenthesisedContext): ExpressionNode {
    return this.visit(ctx.expression());
  }

  visitCast(ctx: CastContext): CastNode {
    const rawType = ctx.typeCast().getText();

    // Handle payable() cast - produces AddressType(payable=true) or ConnectedAddressType(payable=true)
    if (rawType === 'payable') {
      const expression = this.visit(ctx._castable);
      // The actual payable type is determined during type checking
      const type = new AddressType(true);
      const cast = new CastNode(type, expression, false);
      cast.location = Location.fromCtx(ctx);
      return cast;
    }

    // Handle address() cast
    if (rawType === 'address') {
      const expression = this.visit(ctx._castable);
      const type = new AddressType(false);
      const cast = new CastNode(type, expression, false);
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
    cast.location = Location.fromCtx(ctx);
    return cast;
  }

  visitFunctionCallExpression(ctx: FunctionCallExpressionContext): ExpressionNode {
    return this.visit(ctx.functionCall()) as ExpressionNode;
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
      : identifiers[0].getText();
    const identifier = new IdentifierNode(name);
    identifier.location = Location.fromToken(identifiers[0].symbol);
    const parameters = ctx.expressionList().expression_list().map((e) => this.visit(e));

    // using-for: `recv.method(args)` where recv is a struct var bound to a library -> `Library.method(recv, args)`.
    if (identifiers.length > 1 && this.usingForLibraries.size > 0) {
      const recvName = identifiers[0].getText();
      const recvStruct = this.localStructTypes.get(recvName) ?? this.stateStructVars.get(recvName)
        ?? this.mappingStructStateVars.get(recvName);
      const simpleKey = this.localSimpleTypeKeys.get(recvName);
      const libName = (recvStruct && this.usingForLibraries.get(recvStruct.name))
        ?? this.usingForArrayLibrary(recvName)
        ?? this.usingForMappingLibrary(recvName)
        ?? (simpleKey !== undefined ? this.usingForLibraries.get(simpleKey) : undefined);
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

    // `erc7201(id)` (Solidity's ERC-7201 namespaced storage-slot hash) has no EVM storage layout on BCH; alias it
    // to sha256(id) with a warning (like keccak256). Not byte-identical to Ethereum's keccak-based erc7201 - sound
    // only for internal, same-contract slot derivation, never cross-chain.
    if (identifiers.length === 1 && name === 'erc7201' && parameters.length === 1) {
      if (!this.warnedErc7201) {
        console.log('Warning: erc7201(...) is not supported in SolidCash (no EVM storage layout); it is aliased to '
          + 'sha256(...). The result differs from Ethereum ERC-7201 and must not be relied on cross-chain.');
        this.warnedErc7201 = true;
      }
      const sha = new IdentifierNode('sha256');
      sha.location = identifier.location;
      const call = new FunctionCallNode(sha, [parameters[0] as ExpressionNode]);
      call.location = Location.fromCtx(ctx);
      // ERC-7201 yields a storage-slot uint256 (not the raw bytes32 hash); return uint256(sha256(id)) so
      // it composes in the uint256 contexts the spec uses (arithmetic, comparison, slot number).
      const cast = new CastNode(parseType('uint256'), call, false);
      cast.location = Location.fromCtx(ctx);
      return cast;
    }

    // `Color(i)` where Color is an enum is an int -> enum cast, not a function call. Also `L.Color(i)` /
    // `Contract.Color(i)` - a library/contract/interface-qualified enum cast (enums register under their bare name).
    const enumType = identifiers.length === 1
      ? this.enumMap.get(name)
      : (identifiers.length === 2
        && (this.libraryNames.has(identifiers[0].getText()) || this.contractInterfaceNames.has(identifiers[0].getText()))
        ? this.enumMap.get(identifiers[1].getText()) : undefined);
    if (enumType && parameters.length === 1) {
      const cast = new CastNode(enumType, parameters[0] as ExpressionNode, false);
      cast.location = Location.fromCtx(ctx);
      return cast;
    }

    // `uint(x)` is the uint256 alias used as a cast. The typeCast grammar only covers bounded `uintN`, so bare
    // `uint` reaches here as a call; rewrite it to a cast (Solidity's `uint` == `uint256`).
    if (identifiers.length === 1 && name === 'uint' && parameters.length === 1) {
      const cast = new CastNode(parseType('uint'), parameters[0] as ExpressionNode, false);
      cast.location = Location.fromCtx(ctx);
      return cast;
    }

    // UDVT `Duration.wrap(x)` / `Duration.unwrap(x)`. A user-defined value type is identity at runtime over its
    // underlying type, so wrap/unwrap are casts: unwrap -> the underlying type; wrap -> the underlying then the
    // UDVT (wrap takes the underlying type, so a literal arg is first cast to it). The typeDefMap check
    // distinguishes this from a library method named wrap/unwrap (e.g. `LibClock.wrap(d, t)`).
    if (identifiers.length === 2 && parameters.length === 1) {
      const udvt = this.typeDefMap.get(identifiers[0].getText());
      const method = identifiers[1].getText();
      if (udvt && (method === 'wrap' || method === 'unwrap')) {
        const arg = parameters[0] as ExpressionNode;
        if (method === 'unwrap') {
          const cast = new CastNode(udvt.underlyingType, arg, false);
          cast.location = Location.fromCtx(ctx);
          return cast;
        }
        const toUnderlying = new CastNode(udvt.underlyingType, arg, false);
        toUnderlying.location = Location.fromCtx(ctx);
        const cast = new CastNode(udvt, toUnderlying, false);
        cast.location = Location.fromCtx(ctx);
        return cast;
      }
    }

    const functionCall = new FunctionCallNode(identifier, parameters);
    functionCall.location = Location.fromCtx(ctx);
    return functionCall;
  }

  visitInstantiation(ctx: InstantiationContext): InstantiationNode {
    const identifier = new IdentifierNode(ctx.Identifier().getText());
    identifier.location = Location.fromToken(ctx.Identifier().symbol);
    const parameters = ctx.expressionList().expression_list().map((e) => this.visit(e));
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
    const parameters = ctx.expressionList().expression_list().map((e: ExpressionContext) => this.visit(e));
    const instantiation = new InstantiationNode(identifier, parameters);
    instantiation.location = Location.fromCtx(ctx);
    instantiation.callOptions = this.parseCallOptions(ctx.callOptions());
    return instantiation;
  }

  visitNewArray(ctx: any): NewArrayNode {
    // `new T[]...[](n)` allocates the OUTER dynamic array; each extra `[]` makes the element itself an array.
    // e.g. `new uint256[][](2)` -> a 2-element array whose element type is `uint256[]`.
    const dims = (ctx.getText().match(/\[\]/g) ?? ['[]']).length;
    let elementType = this.resolveType(ctx.typeName().getText());
    for (let i = 1; i < dims; i++) elementType = new ArrayType(elementType);
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
    // A runtime length has no BCH analogue (no dynamic buffer allocation). Defer the error to codegen via a
    // placeholder so a NON-primary contract using it does not fail the whole file (only a compiled use errors).
    const placeholder = new HexLiteralNode(new Uint8Array(0));
    placeholder.type = new BytesType();
    placeholder.codegenError = 'new bytes(n) with a non-constant length has no BCH analogue (no dynamic buffer '
      + 'allocation); use a fixed bytesN or build the value from known parts.';
    placeholder.location = Location.fromCtx(ctx);
    return placeholder;
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
    slice.location = loc;
    return slice;
  }

  visitNullaryOp(ctx: NullaryOpContext): NullaryOpNode {
    const operator = ctx.getText() as NullaryOperator;
    const nullaryOp = new NullaryOpNode(operator);
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
    const expression = this.visit(ctx.expression());
    // Fold `-<int literal>` to a negative literal. The lexer no longer emits signed literals (a leading `-` made
    // `i-1` tokenize as `i` `-1`), so negation is a parser-level unary op - but `-1` must stay a compile-time
    // constant so negative array indices / shift counts / etc. are still caught. `x - 1` keeps a BinaryOp.
    if (operator === UnaryOperator.NEGATE && expression instanceof IntLiteralNode) {
      const negated = new IntLiteralNode(-expression.value);
      negated.location = Location.fromCtx(ctx);
      return negated;
    }
    const unaryOp = new UnaryOpNode(operator, expression);
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
    const condition = this.visit(ctx._condition);
    const ifTrue = this.visit(ctx._ifTrue);
    const ifFalse = this.visit(ctx._ifFalse);
    const ternary = new TernaryOpNode(condition, ifTrue, ifFalse);
    ternary.location = Location.fromCtx(ctx);
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

    if (ctx.UnicodeLiteral()) {
      return this.createUnicodeLiteral(ctx);
    }

    if (ctx.HexStringLiteral()) {
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

  createIntLiteral(ctx: LiteralContext): IntLiteralNode {
    const numberCtx = ctx.numberLiteral();
    const numberString = numberCtx.NumberLiteral().getText();
    // Units split into time (NumberUnit) and BCH value (BchUnit) tokens; both resolve via the NumberUnit map.
    const numberUnit = (numberCtx.NumberUnit() ?? numberCtx.BchUnit())?.getText();
    const numberValue = parseNumberString(numberString) * BigInt(numberUnit ? NumberUnit[numberUnit.toUpperCase()] : 1);
    const intLiteral = new IntLiteralNode(numberValue);
    intLiteral.location = Location.fromCtx(ctx);
    return intLiteral;
  }

  createDecimalLiteral(ctx: LiteralContext): DecimalLiteralNode | IntLiteralNode {
    const decCtx = ctx.decimalLiteral();
    const text = decCtx.DecimalLiteral().getText();
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
    const node = new DecimalLiteralNode(text);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  createStringLiteral(ctx: LiteralContext | RequireMessageContext): StringLiteralNode {
    const location = Location.fromCtx(ctx);
    // Handle multi-part string literals ("foo" "bar" -> "foobar")
    const stringTokens = 'StringLiteral_list' in ctx ? ctx.StringLiteral_list() : [ctx.StringLiteral()];
    const parts: string[] = [];
    let quote = '"';
    for (const token of stringTokens) {
      const rawString = token.getText();
      quote = rawString.substring(0, 1);
      const inner = rawString.substring(1, rawString.length - 1);
      parts.push(this.processEscapes(inner, location));
    }
    const stringValue = parts.join('');
    const stringLiteral = new StringLiteralNode(stringValue, quote);
    stringLiteral.location = location;
    return stringLiteral;
  }

  createUnicodeLiteral(ctx: LiteralContext): StringLiteralNode {
    const rawText = ctx.UnicodeLiteral().getText();
    // rawText is like: unicode"..." or unicode'...'
    const quoteChar = rawText.charAt(7); // char after "unicode"
    const inner = rawText.substring(8, rawText.length - 1);
    const stringValue = this.processEscapes(inner, Location.fromCtx(ctx));
    const stringLiteral = new StringLiteralNode(stringValue, quoteChar);
    stringLiteral.location = Location.fromCtx(ctx);
    return stringLiteral;
  }

  createHexStringLiteral(ctx: LiteralContext): HexLiteralNode {
    const raw = ctx.HexStringLiteral().getText();
    // raw is like: hex"deadbeef" or hex'deadbeef'
    const hexContent = raw.substring(4, raw.length - 1).replace(/_/g, '');
    if (hexContent.length % 2 !== 0) {
      throw new ParseError('Hex string must have even number of hex digits', Location.fromCtx(ctx));
    }
    const hexLiteral = new HexLiteralNode(hexToBin(hexContent));
    hexLiteral.location = Location.fromCtx(ctx);
    return hexLiteral;
  }

  private processEscapes(raw: string, location?: Location): string {
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '\\' && i + 1 < raw.length) {
        const next = raw[i + 1];
        switch (next) {
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
    const hexContent = hexString.substring(2);
    if (hexContent.length % 2 !== 0) {
      const loc = Location.fromCtx(ctx);
      const line = loc.start ? ` at line ${loc.start.line}` : '';
      console.log(
        `Warning: hex literal '${hexString}'${line} has an odd number of digits. `
        + 'The last nibble will be silently dropped. Use an even number of hex digits.',
      );
    }
    const hexValue = hexToBin(hexContent);
    const hexLiteral = new HexLiteralNode(hexValue);
    hexLiteral.location = Location.fromCtx(ctx);
    return hexLiteral;
  }

  visitStateVariableDeclaration(
    ctx: StateVariableDeclarationContext,
  ): StateVariableNode | CollectionNode | ConstantDefinitionNode {
    const name = ctx.Identifier().getText();

    if (name.startsWith('__internal__')) {
      throw new StateVariableNameCollisionError(name, Location.fromCtx(ctx));
    }
    // Under solidityImportCompat a ported Solidity state var may shadow a solidcash introspection built-in
    // (age/tokens/categoryId/activeInputIndex/activeBytecode); native keeps the guard so `this.tokens[...]`
    // etc. stay unambiguous.
    if (RESERVED_STATE_NAMES.includes(name) && !this.solidityImportCompat) {
      throw new StateVariableNameCollisionError(name, Location.fromCtx(ctx));
    }

    // Parse visibility modifier (leading position or from collectionModifier)
    let visibility = StateVariableVisibility.PUBLIC;
    const visCtx = ctx.stateVariableVisibility();
    if (visCtx) {
      visibility = visCtx.getText() as StateVariableVisibility;
    }

    // Parse modifiers from modifier_list (simple state vars) or collectionModifier_list (mappings/arrays)
    const plainModifiers = ctx.modifier_list?.() ?? [];
    const collectionModifiers = (ctx as any).collectionModifier_list?.() ?? [];
    const allModTexts: string[] = plainModifiers.map((m: any) => m.getText());
    for (const cm of collectionModifiers) {
      const modChild = cm.modifier?.();
      if (modChild) { allModTexts.push(modChild.getText()); continue; }
      const visChild = cm.stateVariableVisibility?.();
      if (visChild) { visibility = visChild.getText() as StateVariableVisibility; }
    }
    const isImmutable = allModTexts.includes('immutable');

    // A `constant` state var (`uint public constant ONE = 5`) parses as a state variable because the dedicated
    // constantDefinition rule has no visibility slot. It is a compile-time constant, not stored state - route it
    // to the constant path so it is baked into the bytecode, not placed in the state NFT (and does not make a
    // library look state-touching). Constants are value-typed, so only the scalar form applies.
    const scalarTypeCtx = ctx.typeName();
    const constExpr = ctx.expression?.();
    if (allModTexts.includes('constant') && scalarTypeCtx && constExpr && !this.inLibraryDecl) {
      const cnode = new ConstantDefinitionNode(
        this.resolveType(scalarTypeCtx.getText()), name, this.visit(constExpr) as ExpressionNode,
      );
      cnode.location = Location.fromCtx(ctx);
      return cnode;
    }

    // Check if this is a mapping type declaration
    const mappingTypeCtx = ctx.mappingType();
    if (mappingTypeCtx) {
      const mappingType = this.buildMappingType(mappingTypeCtx);
      const node = new CollectionNode(mappingType, name);
      node.visibility = visibility;
      node.immutable = isImmutable;
      node.location = Location.fromCtx(ctx);
      return node;
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
        node.immutable = isImmutable;
        node.location = Location.fromCtx(ctx);
        return node;
      }

      // Chunk-packed array (behind chunkedArrays, default on): an unbounded `T[]` with a chunk-packable element
      // type becomes a dense chunk-backed dynamic state variable (uint32 length header + chunk UTXOs), reusing
      // the string/bytes machinery. Struct/nested-array elements and bounded arrays keep the collection model.
      // See docs/arrays.md.
      if (this.chunkedArrays && arrayT.bound === undefined && isChunkPackableElementType(arrayT.elementType)) {
        const node = new StateVariableNode(arrayT, name);
        node.isDynamic = true;
        node.visibility = visibility;
        node.immutable = isImmutable;
        node.location = Location.fromCtx(ctx);
        return node;
      }

      // Solidity-import compat: a BOUNDED value-type array T[N] is contiguous packed storage in Solidity. Model
      // it as a packed state-var blob (not an entry-NFT collection) so a fixed address[N]/uint[N] reads as one
      // field - this backs array-element external calls IFoo(arr[i]).m() over a fixed token set (StableSwap) and
      // whole-array reads. Native (non-compat) keeps the collection model. See docs/arrays.md.
      if (this.solidityImportCompat && arrayT.bound !== undefined && isChunkPackableElementType(arrayT.elementType)) {
        const node = new StateVariableNode(arrayT, name);
        node.isPacked = true;
        node.visibility = visibility;
        node.immutable = isImmutable;
        node.location = Location.fromCtx(ctx);
        return node;
      }

      // Non-packed array: store as entry NFTs (collection)
      const node = new CollectionNode(arrayT, name);
      node.visibility = visibility;
      node.immutable = isImmutable;
      node.location = Location.fromCtx(ctx);
      return node;
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
    const node = new StateVariableNode(type, name);
    if (contractTypeName) node.contractTypeName = contractTypeName;
    node.visibility = visibility;
    node.immutable = isImmutable;
    node.isTransient = allModTexts.includes('transient'); // lowered to a per-function local in visitContract
    const initCtx = ctx.expression?.();
    if (initCtx) node.initializer = this.visit(initCtx) as ExpressionNode;
    node.location = Location.fromCtx(ctx);
    return node;
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
    op: string, valueCtx: ExpressionContext | undefined, loc: Location,
  ): StatementNode {
    const members = segs.filter((s) => s.member !== undefined).map((s) => s.member!);
    const keyFns = segs.filter((s) => s.key !== undefined).map((s) => s.key!);
    const hasMember = members.length > 0;
    const fieldName = hasMember ? members[0] : undefined;
    const isIncDec = op === '++' || op === '--';

    // Bare local scalar `x op= v` / `x++` (no `this.`, no index/member): a plain local assignment. (The old
    // assignmentStatement grammar required an lvPart for the bare-Identifier form, so this fell to assignStatement;
    // left-factored, it now arrives here.) An unqualified name that is actually a state var / collection is
    // resolved downstream by semantic analysis, same as assignStatement's AssignNode.
    if (!isThis && segs.length === 0) {
      return this.buildCompoundAssign(rawName, nameLoc, op, valueCtx ?? null, loc);
    }

    // Bytes var element write `data[i] op= v` (state OR local/memory) -> reassign the whole blob with byte i
    // replaced: `data = data[0:i] ++ (data[i] op v) ++ data[i+1:]` (plain `=` uses v directly). Reuses the bytes
    // slice/concat codegen (like .push/.pop). ++/-- excluded (isIncDec) - byte inc/dec is not a Solidity form.
    if (!isThis && !isIncDec && !hasMember && keyFns.length === 1 && valueCtx
      && (this.bytesStateVarNames.has(rawName) || this.localBytesVars.has(rawName))) {
      const isState = this.bytesStateVarNames.has(rawName);
      return this.desugarBytesElementWrite(
        rawName, keyFns[0], this.visit(valueCtx) as ExpressionNode, loc, isState, op);
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
        const value = op === '=' ? this.visit(valueCtx!) as ExpressionNode : this.compoundRhs(read(), op, valueCtx, loc);
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
          const vf = this.structFromType(field.type.valueType)?.fields.find((f) => f.name === members[1]);
          if (vf && !(vf.type instanceof MappingType) && !(vf.type instanceof ArrayType)) {
            const value = op === '='
              ? this.visit(valueCtx!) as ExpressionNode
              : this.compoundRhs((() => {
                const acc = new MappingAccessNode(flatName, flatKeys());
                acc.location = nameLoc;
                const fa = new FieldAccessNode(acc, members[1]);
                fa.location = loc;
                return fa;
              })(), op, valueCtx, loc);
            const assign = new MappingFieldAssignNode(flatName, flatKeys(), members[1], value);
            assign.location = loc;
            return assign;
          }
        }
        if (members.length === 1) {
          const value = op === '='
            ? this.visit(valueCtx!) as ExpressionNode
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
        const value = op === '='
          ? this.visit(valueCtx!) as ExpressionNode
          : this.compoundRhs((() => {
            const a = new ArrayAccessNode(new IdentifierNode(flatName), key());
            a.location = nameLoc;
            return a;
          })(), op, valueCtx, loc);
        const assign = new StateArrayAssignNode(flatName, key(), value);
        assign.location = loc;
        return assign;
      }
    }

    // Mapping-bearing struct SCALAR/bytes field write `<var>.<field> op= v` (no key) -> the flattened state var
    // `<var>__<field>` (reads already resolve this way at visitFieldAccess). Mapping/array fields (with a key)
    // are handled above; nested field chains fall through to the rebuild path below.
    if (!isThis && !isIncDec && fieldName && members.length === 1 && keyFns.length === 0
      && this.mappingStructStateVars.has(rawName)) {
      const field = this.mappingStructStateVars.get(rawName)!.fields.find((f) => f.name === fieldName);
      if (field && !(field.type instanceof MappingType) && !(field.type instanceof ArrayType)) {
        const flatName = `${rawName}__${fieldName}`;
        const value = op === '='
          ? this.visit(valueCtx!) as ExpressionNode
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

    // Local struct ARRAY-field element write `s.arr[i] op= v` (member then index): struct fields have no in-place
    // element write, so read-modify-rebuild via buildLocalStructArrayFieldWrite.
    if (!isThis && !isIncDec && fieldName && members.length === 1 && keyFns.length === 1
      && segs.length === 2 && segs[0].member !== undefined && this.localStructTypes.has(rawName)) {
      const field = this.localStructTypes.get(rawName)!.fields.find((f) => f.name === fieldName);
      if (field && field.type instanceof ArrayType) {
        return this.buildLocalStructArrayFieldWrite(rawName, fieldName, field.type,
          () => keyFns[0](), op, valueCtx, loc);
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
          () => keyFns[1](), op, valueCtx, loc);
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
          () => keyFns[1](), op, valueCtx, loc);
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
          ? this.visit(valueCtx!) as ExpressionNode
          : this.compoundRhs(chainRead, op, valueCtx, loc)));
      if (rebuilt) return rebuilt;
    }

    // Storage-pointer write: `alias.field op= v` (or `alias[k]... op= v`) -> rewrite to the aliased container
    // access `container[aliasKeys, ...indexKeys]`. The alias is always an unambiguous state location.
    const alias = !isThis ? this.storageAliases.get(rawName) : undefined;
    const name = alias ? alias.container : rawName;
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
      const newValue = op === '='
        ? this.visit(valueCtx!) as ExpressionNode
        : this.compoundRhs(fieldRead(fieldName!), op, valueCtx, loc);
      const ctorId = new IdentifierNode(structArrayElem.name);
      ctorId.location = nameLoc;
      const ctor = new FunctionCallNode(
        ctorId,
        structArrayElem.fields.map((f) => (f.name === fieldName ? newValue : fieldRead(f.name))),
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

    const value = op === '='
      ? this.visit(valueCtx!) as ExpressionNode
      : this.compoundRhs(buildRead(), op, valueCtx, loc);

    let node: StatementNode;
    if (keys.length === 0) {
      node = new StateAssignNode(name, value);
    } else if (hasMember) {
      node = new MappingFieldAssignNode(name, keys, fieldName!, value);
    } else if (bareElement) {
      node = new ArrayAssignNode(name, keys[0], value);
    } else if (keys.length === 1 && this.packedStateArrayNames.has(name)) {
      node = new StateArrayAssignNode(name, keys[0], value);
    } else {
      node = new MappingAssignNode(name, keys, value);
    }
    node.location = loc;
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



  visitDeleteLocal(ctx: DeleteLocalContext): DeleteLocalNode {
    const identifier = new IdentifierNode(ctx.Identifier().getText());
    identifier.location = Location.fromToken(ctx.Identifier().symbol);
    const node = new DeleteLocalNode(identifier);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // `delete base.f1..fn;` (delete a struct field) - reset it to the field type's default via the same
  // struct-rebuild path as `base.f1..fn = <default>`. base is a local or state struct variable.
  visitDeleteMember(ctx: any): StatementNode {
    const baseIdent = ctx.Identifier_list()[0];
    const rawName = baseIdent.getText();
    const nameLoc = Location.fromToken(baseIdent.symbol);
    const members: string[] = ctx.Identifier_list().slice(1).map((id: { getText(): string }) => id.getText());
    const loc = Location.fromCtx(ctx);
    const isThis = ctx.getText().startsWith('deletethis.');
    const rebuilt = this.buildStructFieldRebuild(rawName, nameLoc, members, isThis, loc,
      (_chainRead, fieldType) => createDefaultValueExpression(fieldType, loc));
    if (rebuilt) return rebuilt;
    throw new UnsupportedTypeError({ location: loc } as any);
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
    // Rebuild `structExpr` (struct type t) with `structExpr.chain` replaced by finalValue.
    const rebuild = (structExpr: ExpressionNode, t: StructType, chain: string[], finalValue: ExpressionNode):
    ExpressionNode => {
      const [head, ...rest] = chain;
      const newField = rest.length === 0
        ? finalValue
        : rebuild(fieldAccess(cloneNode(structExpr), head), this.resolveFieldStruct(t, head)!, rest, finalValue);
      const ctorId = new IdentifierNode(t.name);
      ctorId.location = nameLoc;
      const ctor = new FunctionCallNode(
        ctorId,
        t.fields.map((f) => (f.name === head ? newField : fieldAccess(cloneNode(structExpr), f.name))),
      );
      ctor.location = loc;
      return ctor;
    };
    let chainRead = baseRead();
    for (const m of members) chainRead = fieldAccess(chainRead, m);
    const finalStruct = chainTypes[chainTypes.length - 1];
    const finalFieldType = finalStruct.fields.find((f) => f.name === members[members.length - 1])!.type;
    const rebuilt = rebuild(baseRead(), baseStructT, members, finalValueFn(chainRead, finalFieldType));
    const assign: StatementNode = useState
      ? new StateAssignNode(rawName, rebuilt)
      : new AssignNode(baseRead() as IdentifierNode, rebuilt); // local: baseRead() is an IdentifierNode
    assign.location = loc;
    return assign;
  }

  // Desugar an array-field element write on a LOCAL struct var (`sv.field[idx] op= v`) into a read-modify-rebuild
  // block: `T tmp = sv.field; tmp[idx] = value; sv.field = tmp;`. `structVarName` must be registered in
  // localStructTypes. Returned as a block so flattenStatements splices the three statements at the call scope.
  private buildLocalStructArrayFieldWrite(
    structVarName: string, fieldName: string, arrayFieldType: Type, indexVisit: () => ExpressionNode,
    op: string, valueCtx: ExpressionContext | undefined, loc: Location,
  ): BlockNode {
    const idAt = (n: string): IdentifierNode => { const i = new IdentifierNode(n); i.location = loc; return i; };
    const tmpName = `__nlv_${this.nestedLvalueCounter++}`;
    const sField = new FieldAccessNode(idAt(structVarName), fieldName);
    sField.location = loc;
    const decl = new VariableDefinitionNode(arrayFieldType, [], tmpName, sField);
    decl.location = loc;
    const value = op === '='
      ? this.visit(valueCtx!) as ExpressionNode
      : this.compoundRhs((() => {
        const r = new ArrayAccessNode(idAt(tmpName), indexVisit());
        r.location = loc;
        return r;
      })(), op, valueCtx, loc);
    const elemAssign = new ArrayAssignNode(tmpName, indexVisit(), value);
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
    // Resolve (not just parseType) so a user enum / value-type key resolves; an unknown name (a contract type)
    // defaults to an address handle, matching function params. parseType alone left these undefined -> crash.
    const keyText = ctx.typeName(0).getText();
    const keyType = this.resolveType(keyText) ?? new AddressType(false, keyText);
    const identifiers = ctx.Identifier_list();

    const nestedMappingCtx = ctx.mappingType();
    if (nestedMappingCtx) {
      const valueType = this.buildMappingType(nestedMappingCtx);
      const keyName = identifiers.length > 0 ? identifiers[0].getText() : undefined;
      return new MappingType(keyType, valueType, keyName);
    }
    const arrayTypeCtx = ctx.arrayType();
    if (arrayTypeCtx) {
      const keyName = identifiers.length > 0 ? identifiers[0].getText() : undefined;
      const valueName = identifiers.length > 1 ? identifiers[1].getText() : undefined;
      return new MappingType(keyType, this.buildArrayType(arrayTypeCtx), keyName, valueName);
    }
    const valueType = this.resolveType(ctx.typeName(1).getText());
    const keyName = identifiers.length > 0 ? identifiers[0].getText() : undefined;
    const valueName = identifiers.length > 1 ? identifiers[1].getText() : undefined;
    return new MappingType(keyType, valueType, keyName, valueName);
  }

  private buildArrayType(ctx: ArrayTypeContext): ArrayType {
    let elementType: Type;
    if (ctx.arrayType()) {
      elementType = this.buildArrayType(ctx.arrayType());
    } else {
      // Mirror the scalar path (visitStateVariableDeclaration): an unresolved name (e.g. an imported struct
      // not yet merged, or an interface) becomes a named AddressType placeholder rather than `undefined`, so
      // routing sees a chunk-packable element and a post-import pass (reresolveImportedTypes) can resolve it.
      const elemName = ctx.typeName().getText();
      elementType = this.resolveType(elemName) ?? new AddressType(false, elemName);
    }
    const bound = this.resolveArrayBound(ctx);
    return new ArrayType(elementType, bound);
  }

  // Resolve an array dimension `[N]` to a number: a numeric literal directly, or a named integer constant
  // (`int constant N = 3; T[N]`) via the pre-scanned constant map. Unbounded `[]` -> undefined.
  private resolveArrayBound(ctx: ArrayTypeContext): number | undefined {
    const numberLiteral = ctx.NumberLiteral();
    if (numberLiteral) return parseInt(numberLiteral.getText(), 10);
    const identifier = ctx.Identifier();
    if (identifier) {
      const name = identifier.getText();
      const value = this.constantIntValues.get(name);
      if (value === undefined) {
        throw new ParseError(
          `Array dimension '${name}' must be a compile-time integer constant`, Location.fromCtx(ctx),
        );
      }
      // A zero / out-of-range constant is caught downstream by the existing InvalidArrayBoundError check, the
      // same path a numeric-literal bound takes - so the Solidity zero-length rule is enforced uniformly.
      return value;
    }
    return undefined; // unbounded `[]`
  }

  // Pre-scan: record plain integer-literal constants so they can be used as array dimensions `T[N]`. Computed
  // or non-integer constants are not recorded; using one as a dimension is a clear ParseError in resolveArrayBound.
  private scanConstantDimensions(ctxs: ConstantDefinitionContext[]): void {
    for (const c of ctxs) {
      const text = c.expression().getText().replace(/_/g, '');
      if (/^[0-9]+$/.test(text)) {
        this.constantIntValues.set(c.Identifier().getText(), parseInt(text, 10));
      }
    }
  }

  // A `constant` STATE VARIABLE with an integer-literal init (e.g. `uint256 private constant N = 3;`) is
  // parsed as a stateVariableDeclaration (not a constantDefinition) when it carries a visibility modifier;
  // record those too so they work as array dimensions `T[N]`.
  private scanConstantStateVars(ctxs: StateVariableDeclarationContext[]): void {
    for (const c of ctxs) {
      const mods = (c.modifier_list?.() ?? []).map((m: { getText(): string }) => m.getText());
      const expr = c.expression?.();
      const id = c.Identifier?.();
      if (!mods.includes('constant') || !expr || !id) continue;
      const text = expr.getText().replace(/_/g, '');
      if (/^[0-9]+$/.test(text)) {
        this.constantIntValues.set(id.getText(), parseInt(text, 10));
      }
    }
  }

  // Register a list of struct definitions: pre-register every struct NAME (empty) FIRST so field-type
  // resolution can see forward and self / mutually recursive references (`struct S{T[] x;} struct T{...}`,
  // `struct R{R[] c;}`), then resolve each struct's fields into the pre-registered type in place (same object,
  // so references already handed out observe the filled fields).
  private registerStructDefinitions(ctxList: StructDefinitionContext[], out: StructDefinitionNode[]): void {
    for (const sdCtx of ctxList) {
      const name = sdCtx.Identifier().getText();
      this.structMap.set(name, new StructType(name, []));
    }
    for (const sdCtx of ctxList) {
      const sd = this.visitStructDefinition(sdCtx);
      out.push(sd);
      this.structMap.get(sd.name)!.fields = sd.fields;
    }
  }

  visitStructDefinition(ctx: StructDefinitionContext): StructDefinitionNode {
    const structName = ctx.Identifier().getText();
    const fields = ctx.structField_list().map((fieldCtx) => ({
      name: fieldCtx.anyIdentifier().getText(),
      // A field may be a plain typeName, an arrayType (`int[]`, `bytes20[3]`, `T[]`), or a mapping (flattened to
      // per-field state vars when the struct is used as a state variable). An array field goes through
      // buildArrayType so a struct/enum element type (`T[]`) resolves, not just primitives.
      type: fieldCtx.mappingType()
        ? this.buildMappingType(fieldCtx.mappingType()!)
        : fieldCtx.arrayType()
          ? this.buildArrayType(fieldCtx.arrayType()!)
          : this.resolveType(fieldCtx.typeName()!.getText()),
    }));
    const node = new StructDefinitionNode(structName, fields);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitEnumDefinition(ctx: EnumDefinitionContext): EnumDefinitionNode {
    const name = ctx.Identifier().getText();
    const members: { name: string; value: bigint }[] = [];
    let nextValue = 0n;
    for (const memberCtx of ctx.enumMember_list()) {
      const memberName = memberCtx.Identifier().getText();
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
    const name = ctx.Identifier().getText();
    const underlyingType = this.resolveType(ctx.typeName().getText());
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
    const isGlobal = ctx.getText().includes('global');
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
      name, stateVariables, collections, functions, structDefs, enumDefs, typeDefs, eventDefs,
    );
    node.parents = parentNames;
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
    const name = ctx.Identifier().getText();
    const parameters = ctx.parameterList().parameter_list().map((p) => this.visit(p) as ParameterNode);

    let returnTypes: Type[] = [];
    const returnTypeCtx = ctx.returnType();
    if (returnTypeCtx) {
      returnTypes = returnTypeCtx.returnParam_list().map((p) => this.returnParamType(p));
    }

    const node = new InterfaceFunctionNode(name, parameters, returnTypes);
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

    // Solidity `block.timestamp` -> BCH `tx.locktime` (the spend's nLocktime time bound) under import-compat.
    if (this.solidityImportCompat && expression instanceof IdentifierNode
      && expression.name === 'block' && fieldName === 'timestamp') {
      const locktime = new NullaryOpNode(NullaryOperator.LOCKTIME);
      locktime.location = Location.fromCtx(ctx);
      return locktime;
    }

    // Storage-pointer read: `alias.field` -> `container[keys].field` (clone the access path per use site).
    if (expression instanceof IdentifierNode && this.storageAliases.has(expression.name)) {
      expression = cloneNode(this.storageAliases.get(expression.name)!.access);
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
    const typeText = ctx.typeName().getText();
    const property = ctx.Identifier().getText();
    const node = new TypeIntrospectionNode(typeText, property);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  private parseCallOptions(ctx: CallOptionsContext | undefined): CallOptions | undefined {
    if (!ctx) return undefined;
    const options: CallOptions = {};
    for (const opt of ctx.callOption_list()) {
      const name = opt.Identifier().getText();
      const expr = this.visit(opt.expression()) as ExpressionNode;
      if (name === 'value') {
        options.value = expr;
      } else if (name === 'salt') {
        options.salt = expr;
      } else if (name === 'gas') {
        options.gas = expr;
        const line = opt.start ? ` at line ${opt.start.line}` : '';
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

  visitMethodCall(ctx: MethodCallContext): ExpressionNode {
    const object = this.visit(ctx.expression());
    const methodName = ctx.Identifier().getText();
    const parameters = ctx.expressionList().expression_list().map((e) => this.visit(e));
    const callOpts = this.parseCallOptions(ctx.callOptions());

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

    // `this.f(args)`: an external self-call to the contract's OWN function `f`. On BCH the covenant IS the
    // contract, so resolve it to a direct call to `f` (a subroutine). Solidity's external-self-call semantics
    // (fresh calldata, `msg.sender` = the contract) do not apply here.
    if (ctx.expression().getText() === 'this') {
      const line = `:${Location.fromCtx(ctx).start.line}`;
      // `{value:..}` / `{gas:..}` call options are EVM message-call semantics; a self-call is a direct subroutine
      // on BCH, so they are inert and dropped (like the other EVM shims).
      const optNote = callOpts ? ' ({value}/{gas} call options are inert on a self-call and ignored)' : '';
      console.log(`Warning: 'this.${methodName}(...)'${line} is an external self-call in Solidity; on BCH it is a `
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
        ?? (simpleKey !== undefined ? this.usingForLibraries.get(simpleKey) : undefined);
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
    const node = new MethodCallNode(object, methodName, parameters);
    node.fieldNames = namedArgs.map((na) => na.Identifier().getText());
    node.callOptions = this.parseCallOptions(ctx.callOptions());
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // Flatten BlockNode statements into the parent list (used for for-loop desugaring)
  private flattenStatements(statements: StatementNode[]): StatementNode[] {
    return statements.flatMap((s) => (s instanceof BlockNode && s.statements) ? s.statements : [s]);
  }

  private resolveType(typeText: string): Type {
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
    this.validateBoundedIntType(typeText);
    this.validateFixedType(typeText);
    return parseType(typeText);
  }

  // Resolve a return parameter's type (a plain type, or an array type like `uint256[] memory`).
  private returnParamType(p: ReturnParamContext): Type {
    if (p.arrayType()) return this.buildArrayType(p.arrayType()!);
    if (p.mappingType()) return this.buildMappingType(p.mappingType()!);
    return this.resolveType(p.typeName()!.getText()) ?? new AddressType(false);
  }

  // Populate returnTypes and (optionally) returnNames from a `returns (...)` clause.
  private applyReturnType(fn: FunctionDefinitionNode, ctx: ReturnTypeContext): void {
    const params = ctx.returnParam_list();
    fn.returnTypes = params.map((p) => this.returnParamType(p));
    const named = params.filter((p) => p.anyIdentifier() !== null);
    // Solidity allows a mix of named and unnamed return values (always on, the default). Synthesize a name for
    // each unnamed slot so all are named (a named return may be returned implicitly; an explicit `return (...)`
    // overrides).
    if (named.length > 0) {
      fn.returnNames = params.map((p, i) => (p.anyIdentifier() ? p.anyIdentifier()!.getText() : `__ret_${i}`));
    }
    // Warn about no-op data-location modifiers
    for (const p of params) {
      for (const mod of p.modifier_list()) {
        const text = mod.getText();
        if (text === Modifier.MEMORY || text === Modifier.CALLDATA) {
          const loc = Location.fromCtx(mod);
          const line = loc ? ` at line ${loc.start.line}` : '';
          console.log(`Warning: '${text}' data location modifier is a no-op in SolidCash${line}. All data lives on-stack in the BCH VM.`);
        }
      }
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
    const parameters = ctx.expressionList().expression_list().map((e) => this.visit(e));
    const node = new AbiEncodeNode(parameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitAbiEncodePacked(ctx: AbiEncodePackedContext): AbiEncodePackedNode {
    const parameters = ctx.expressionList().expression_list().map((e) => this.visit(e));
    const node = new AbiEncodePackedNode(parameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitAbiEncodeWithSelector(ctx: AbiEncodeWithSelectorContext): AbiEncodeWithSelectorNode {
    const exprs = ctx.expressionList().expression_list().map((e) => this.visit(e));
    const node = new AbiEncodeWithSelectorNode(exprs[0], exprs.slice(1));
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitAbiEncodeWithSignature(ctx: AbiEncodeWithSignatureContext): AbiEncodeWithSignatureNode {
    const exprs = ctx.expressionList().expression_list().map((e) => this.visit(e));
    const node = new AbiEncodeWithSignatureNode(exprs[0], exprs.slice(1));
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitAbiEncodeCall(ctx: AbiEncodeCallContext): AbiEncodeCallNode {
    const ids = ctx.Identifier_list();
    // `this.method` -> only one Identifier (`this` is a keyword token); interfaceName sentinel 'this'
    // resolves to a function of the current contract in SymbolTableTraversal.
    const interfaceName = ids.length === 1 ? 'this' : ids[0].getText();
    const functionName = ids.length === 1 ? ids[0].getText() : ids[1].getText();
    const params = ctx.expressionList().expression_list()?.map((e) => this.visit(e)) ?? [];
    const node = new AbiEncodeCallNode(interfaceName, functionName, params);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitBytesConcat(ctx: BytesConcatContext): BytesConcatNode {
    const parameters = ctx.expressionList().expression_list().map((e) => this.visit(e));
    const node = new BytesConcatNode(parameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitStringConcat(ctx: StringConcatContext): StringConcatNode {
    const parameters = ctx.expressionList().expression_list().map((e) => this.visit(e));
    const node = new StringConcatNode(parameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitAbiDecode(ctx: AbiDecodeContext): AbiDecodeNode {
    const data = this.visit(ctx.expression());
    const schema = ctx.typeList().typeListItem_list().map((t) => {
      const text = t.getText();
      const ty = parseType(text) ?? this.resolveType(text);
      if (!ty) throw new Error(`Unsupported type '${text}' in abi.decode`);
      return ty;
    });
    const node = new AbiDecodeNode(data, schema);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitAbiDecodeAt(ctx: AbiDecodeAtContext): AbiDecodeAtNode {
    const data = this.visit(ctx.expression());
    const schema = ctx.typeList().typeListItem_list().map((t) => {
      const text = t.getText();
      const ty = parseType(text) ?? this.resolveType(text);
      if (!ty) throw new Error(`Unsupported type '${text}' in abi.decode`);
      return ty;
    });
    const index = parseInt(ctx.NumberLiteral().getText(), 10);
    const node = new AbiDecodeAtNode(data, schema, index);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitEventDefinition(ctx: EventDefinitionContext): EventDefinitionNode {
    const eventName = ctx.Identifier().getText();
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
      const idCtx = paramCtx.Identifier();
      return {
        name: idCtx ? idCtx.getText() : `__unnamed${i}`,
        type,
        ...(indexed && { indexed: true }),
      };
    });
    const isAnonymous = ctx.children?.some((c) => c.getText() === 'anonymous') === true;
    const node = new EventDefinitionNode(eventName, parameters);
    node.isAnonymous = isAnonymous;
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitErrorDefinition(ctx: ErrorDefinitionContext): ErrorDefinitionNode {
    const errorName = ctx.Identifier().getText();
    const parameters = ctx.errorParameter_list().map((paramCtx, i) => ({
      // The name is optional in Solidity (`error Bad(uint256)`); synthesize one for an unnamed param.
      name: paramCtx.Identifier() ? paramCtx.Identifier().getText() : `__unnamed${i}`,
      type: paramCtx.typeName()
        ? this.resolveType(paramCtx.typeName().getText())
        : this.buildArrayType(paramCtx.arrayType()!),
    }));
    const node = new ErrorDefinitionNode(errorName, parameters);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitSelfdestructStatement(ctx: SelfdestructStatementContext): SelfdestructStatementNode {
    const recipient = this.visit(ctx.expression()) as ExpressionNode;
    const node = new SelfdestructStatementNode(recipient);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  visitRevertStatement(ctx: RevertStatementContext): RevertNode {
    let node: RevertNode;
    const identifiers = ctx.Identifier_list();
    if (identifiers.length > 0) {
      // revert CustomError(args) or qualified revert Lib.CustomError(args): the error resolves by its bare
      // name, so take the last identifier.
      const errorName = identifiers[identifiers.length - 1].getText();
      if (!ctx.expressionList()) {
        // Named-arg form: revert E({a: x, b: y})
        const namedArgs = ctx.namedArg_list();
        const args = namedArgs.map((na) => this.visit(na.expression()) as ExpressionNode);
        node = new RevertNode(errorName, args);
        node.fieldNames = namedArgs.map((na) => na.Identifier().getText());
      } else {
        const args = ctx.expressionList().expression_list().map((e) => this.visit(e) as ExpressionNode);
        node = new RevertNode(errorName, args);
      }
    } else if (ctx.StringLiteral()) {
      // revert("message");
      const rawString = ctx.StringLiteral().getText();
      const message = rawString.substring(1, rawString.length - 1);
      node = new RevertNode(undefined, [], this.processEscapes(message, Location.fromCtx(ctx)));
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
    const type = this.resolveType(ctx.typeName().getText());
    const name = ctx.Identifier().getText();
    const expression = this.visit(ctx.expression());
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
      const args = ctx.expressionList().expression_list().map((e) => this.visit(e) as ExpressionNode);
      node = new EmitStatementNode(eventName, args);
    }
    node.location = Location.fromCtx(ctx);
    return node;
  }



  visitReturnStatement(ctx: ReturnStatementContext): Node {
    const exprCtxs = ctx.expression_list();
    // Tuple ternary return `return cond ? (..) : (..)`: hoist cond, then a tuple return of per-element ternaries.
    if (exprCtxs.length === 1 && this.isTupleTernary(exprCtxs[0])) {
      const { tempDecl, values } = this.desugarTupleTernary(exprCtxs[0] as TernaryOpContext);
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
    const expressions = exprCtxs.map((e) => this.visit(e) as ExpressionNode);
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

  // Inline storage-pointer write `Lib.f(args).field... op= v` (OpenZeppelin StorageSlot): a call sits at the base
  // of the lvalue chain, which extractLvalue cannot represent, so desugar to `RetStruct __t = Lib.f(args);
  // __t.field... op= v;`. Returns undefined when the LHS is not a `.field` chain over a `Lib.f(args)` call.
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
    if (ids.length !== 2 || !fc.expressionList()) return undefined; // must be a namespaced `Lib.f(args)`
    const fnName = ids[1].getText();
    const retStruct = this.functionReturnStructs.get(fnName);
    if (!retStruct) {
      throw new ParseError(
        `Cannot resolve the storage-pointer factory '${fnName}' for an inline '.value' write; `
        + 'assign it to a `T storage` local first, then write its member.', loc,
      );
    }
    const tmpName = `__nlv_${this.nestedLvalueCounter++}`;
    const fnId = new IdentifierNode(`${ids[0].getText()}.${fnName}`); fnId.location = loc;
    const factoryCall = new FunctionCallNode(fnId, fc.expressionList().expression_list().map((e) => this.visit(e) as ExpressionNode));
    factoryCall.location = loc;
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

  // `receiver.push(value)` on an array / mapping-entry / struct-field / bytes state var, reconstructed from the
  // parsed receiver (rawName, isThis, keyFns = mapping index keys, member = struct array-field). Unifies the old
  // bare arrayPushStatement and this-prefixed stateArrayPushStatement dispatch (a name is exactly one of
  // mapping-entry / bytes / struct-field / plain array, so the branch order is irrelevant).
  private buildArrayPush(
    rawName: string, isThis: boolean, keyFns: Array<() => ExpressionNode>, member: string | undefined,
    value: ExpressionNode, noArg: boolean, ctx: ParserRuleContext,
  ): StatementNode {
    const loc = Location.fromCtx(ctx);
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

  // `receiver.pop()` - mirror of buildArrayPush.
  private buildArrayPop(
    rawName: string, isThis: boolean, keyFns: Array<() => ExpressionNode>, member: string | undefined,
    ctx: ParserRuleContext,
  ): StatementNode {
    const loc = Location.fromCtx(ctx);
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
  ): { rawName: string; isThis: boolean; nameLoc: Location; segs: LvSeg[] } | null {
    const segs: LvSeg[] = [];
    let cur: ExpressionContext = ctx;
    for (;;) {
      if (cur instanceof ParenthesisedContext) {
        cur = cur.expression();
      } else if (cur instanceof ArrayAccessContext) {
        const keyCtx = cur.expression(1);
        segs.unshift({ key: () => this.visit(keyCtx) as ExpressionNode });
        cur = cur.expression(0);
      } else if (cur instanceof TupleIndexOpContext) {
        // `arr[0]` with a NumberLiteral index parses as TupleIndexOp (not a wrapped expression); the index is a
        // literal token, so build a fresh IntLiteralNode for the key rather than re-visiting a context.
        const numTok = cur.NumberLiteral();
        const keyLoc = Location.fromToken(numTok.symbol);
        segs.unshift({ key: () => { const n = new IntLiteralNode(BigInt(numTok.getText())); n.location = keyLoc; return n; } });
        cur = cur.expression();
      } else if (cur instanceof FieldAccessContext) {
        const mn = cur.memberName();
        const member = mn.Identifier() ? mn.Identifier().getText() : (mn.getText() === '.value' ? 'value' : null);
        if (member === null) return null; // a non-field member (.length, .lockingBytecode, ...) is not an lvalue
        segs.unshift({ member });
        cur = cur.expression();
      } else if (cur instanceof MappingAccessContext) {
        cur.expression_list().slice().reverse().forEach((e) => segs.unshift({ key: () => this.visit(e) as ExpressionNode }));
        return { rawName: cur.Identifier().getText(), isThis: true, nameLoc: Location.fromToken(cur.Identifier().symbol), segs };
      } else if (cur instanceof StateAccessContext) {
        return { rawName: cur.Identifier().getText(), isThis: true, nameLoc: Location.fromToken(cur.Identifier().symbol), segs };
      } else if (cur instanceof IdentifierContext) {
        return { rawName: cur.anyIdentifier().getText(), isThis: false, nameLoc: Location.fromCtx(cur), segs };
      } else {
        return null;
      }
    }
  }

  visitExpressionStatement(ctx: ExpressionStatementContext): StatementNode {
    const lhsCtx = ctx.expression(0);
    // Assignment `lvalue op= value` (left-factored): reconstruct the lvalue segments from the parsed LHS and
    // delegate to the shared builder (the same one the lvPart assignmentStatement path uses).
    if (ctx._op) {
      // Storage-pointer inline write `Lib.f(args).field op= v` (a call in the lvalue chain, which extractLvalue
      // cannot represent): desugar to a `T storage` local first.
      const sp = this.buildStoragePointerWrite(lhsCtx, ctx._op.text, ctx.expression(1), Location.fromCtx(ctx));
      if (sp) return sp;
      const mrv = this.buildMappingReturnIndexedWrite(lhsCtx, ctx._op.text, ctx.expression(1), Location.fromCtx(ctx));
      if (mrv) return mrv;
      const lv = this.extractLvalue(lhsCtx);
      if (!lv) throw new ParseError('Invalid assignment target', Location.fromCtx(lhsCtx));
      return this.buildLvalueAssign(
        lv.rawName, lv.isThis, lv.nameLoc, lv.segs, ctx._op.text, ctx.expression(1), Location.fromCtx(ctx),
      );
    }
    // `receiver.push(v)` / `.pop()` / `.delete(v)` tails: reconstruct the receiver (rawName, isThis, mapping keys,
    // struct array-field member) from the parsed LHS and dispatch to the array/mapping builder.
    if (ctx.DotPush() || ctx.DotPop() || ctx.DotDelete()) {
      const lv = this.extractLvalue(lhsCtx);
      if (!lv) throw new ParseError('Invalid .push/.pop/.delete target', Location.fromCtx(lhsCtx));
      const members = lv.segs.filter((s) => s.member !== undefined).map((s) => s.member!);
      const keyFns = lv.segs.filter((s) => s.key !== undefined).map((s) => s.key!);
      const member = members.length === 1 && keyFns.length === 0 ? members[0] : undefined;
      // Only plain (`arr`), single struct-field (`s.xs`), or indexed (`m[k]`) receivers are valid targets - the
      // same shapes the old rules parsed; a mixed/nested chain (`s.a.b`, `s.xs[k]`) was a parse error, keep it so.
      if (members.length > 0 && member === undefined) {
        throw new ParseError('Unsupported .push/.pop/.delete receiver', Location.fromCtx(lhsCtx));
      }
      if (ctx.DotPush()) {
        // Solidity `arr.push() = value` appends the element type's default then writes it - equivalent to
        // `arr.push(value)` (the value expression is the second `expression` child, present only for this form).
        const assignVal = ctx.expression(1);
        if (assignVal) {
          return this.buildArrayPush(lv.rawName, lv.isThis, keyFns, member, this.visit(assignVal) as ExpressionNode, false, ctx);
        }
        const argCtx = ctx.pushArgument();
        const noArg = argCtx === null;
        const value = noArg ? this.noArgPushPlaceholder(ctx) : this.visit(argCtx.expression()) as ExpressionNode;
        return this.buildArrayPush(lv.rawName, lv.isThis, keyFns, member, value, noArg, ctx);
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
      const llArgs = fc.expressionList()?.expression_list();
      if ((llMethod === 'call' || llMethod === 'staticcall' || llMethod === 'delegatecall') && llArgs?.length === 1) {
        const args = llArgs;
        const target = new IdentifierNode(ids[0].getText());
        target.location = Location.fromToken(ids[0].symbol);
        const node = new LowLevelCallStatementNode(target, this.visit(args[0]) as ExpressionNode, llMethod);
        node.location = Location.fromCtx(lhsCtx); return node;
      }
      return wrap(this.visit(lhsCtx) as ExpressionNode);
    }
    if (lhsCtx instanceof MethodCallNamedContext) {
      return wrap(this.visit(lhsCtx) as ExpressionNode);
    }
    const ctx = lhsCtx as MethodCallContext;
    const method = ctx.Identifier().getText();
    const recvCtx = ctx.expression();
    const loc = Location.fromCtx(ctx);
    const argCtxs = ctx.expressionList().expression_list();
    // Low-level `.call`/`.staticcall`/`.delegatecall(payload)` takes exactly one arg. A same-named method with a
    // different arity (e.g. `IFoo(c).increment.call()` - an interface method reached via a field access) is not a
    // low-level call and falls through to the generic method-call wrap below.
    if ((method === 'call' || method === 'staticcall' || method === 'delegatecall') && argCtxs.length === 1) {
      const node = new LowLevelCallStatementNode(this.visit(recvCtx) as ExpressionNode, this.visit(argCtxs[0]) as ExpressionNode, method);
      node.callOptions = this.parseCallOptions(ctx.callOptions()); node.location = loc; return node;
    }
    if (recvCtx instanceof MappingAccessContext && recvCtx.Identifier().getText() === 'tokens') {
      if (method !== 'transfer' && method !== 'transferNft') {
        throw new ParseError(`Unknown token container method '${method}', expected 'transfer' or 'transferNft'`, loc);
      }
      const keyExpr = this.visit(recvCtx.expression_list()[0]) as ExpressionNode;
      const args = argCtxs.map((e) => this.visit(e) as ExpressionNode);
      if (method === 'transfer' && args.length !== 2) throw new ParseError('this.tokens[...].transfer() expects 2 arguments (to, amount)', loc);
      if (method === 'transferNft' && args.length !== 3) throw new ParseError('this.tokens[...].transferNft() expects 3 arguments (to, commitment, capability)', loc);
      const node = new TokenContainerMethodStatementNode(keyExpr, method, args); node.location = loc; return node;
    }
    if (method === 'transfer') {
      if (recvCtx.getText() === 'this') {
        if (argCtxs.length !== 2) throw new ParseError('this.transfer() expects 2 arguments (lockingBytecode, amount)', loc);
        const node = new TransferStatementNode(this.visit(argCtxs[0]) as ExpressionNode, this.visit(argCtxs[1]) as ExpressionNode);
        node.location = loc; return node;
      }
      if (argCtxs.length === 1 && ctx.callOptions() === null) {
        const node = new AddressTransferStatementNode(this.visit(recvCtx) as ExpressionNode, this.visit(argCtxs[0]) as ExpressionNode);
        node.location = loc; return node;
      }
    }
    return wrap(this.visit(lhsCtx) as ExpressionNode);
  }

  visitPrefixIncDecStatement(ctx: PrefixIncDecStatementContext): StatementNode {
    // `++x;` / `--x;` at statement scope is exactly `x += 1` / `x -= 1`; reuse the lvalue reconstruction + builder.
    const lv = this.extractLvalue(ctx.expression());
    if (!lv) throw new ParseError('Invalid increment/decrement target', Location.fromCtx(ctx.expression()));
    return this.buildLvalueAssign(lv.rawName, lv.isThis, lv.nameLoc, lv.segs, ctx._op.text, undefined, Location.fromCtx(ctx));
  }



  visitArrayAccess(ctx: ArrayAccessContext): ArrayAccessNode {
    const array = this.visit(ctx.expression(0));
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
  // 'address', 'string', 'bytes'/'bytesN', 'uintN'/'intN'. Mirrors the usingForLibraries keying (bare type name).
  // Structs are resolved via localStructTypes, so they are intentionally not returned here.
  private usingForTypeKey(type: Type): string | undefined {
    if (type instanceof EnumType) return type.name;
    if (type instanceof ValueType) return type.name;
    if (type instanceof AddressType) return type.interfaceName ?? 'address';
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
  ): StatementNode {
    const stamp = <T extends { location?: Location }>(n: T): T => { n.location = loc; return n; };
    const read = (): ExpressionNode => stamp(isState ? new StateAccessNode(name) : new IdentifierNode(name));
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
    return isState
      ? stamp(new StateAssignNode(name, cat2))
      : stamp(new AssignNode(stamp(new IdentifierNode(name)), cat2));
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
  private desugarBytesPush(name: string, value: ExpressionNode | undefined, ctx: ParserRuleContext): StateAssignNode {
    let appended = value;
    if (appended === undefined) {
      appended = new HexLiteralNode(new Uint8Array(1)); // no-arg push() appends a single 0x00 byte
      appended.location = Location.fromCtx(ctx);
    }
    const read = new StateAccessNode(name);
    read.location = Location.fromCtx(ctx);
    const concat = new BinaryOpNode(read, BinaryOperator.PLUS, appended);
    concat.location = Location.fromCtx(ctx);
    const node = new StateAssignNode(name, concat);
    node.location = Location.fromCtx(ctx);
    return node;
  }

  // For safety reasons, we throw an error when the "default" visitChildren is called. *All* nodes
  // must have a custom visit method, so that we can be sure that we've covered all cases.
  visitChildren(): Node {
    throw new Error('Safety Warning: Unhandled node in AST builder');
  }
}

const parseNumberString = (numberString: string): bigint => {
  const cleanedNumberString = numberString.replace(/_/g, '');

  const isScientificNotation = /[eE]/.test(cleanedNumberString);
  if (!isScientificNotation) return BigInt(cleanedNumberString);

  const [coefficient, exponent] = cleanedNumberString.split(/[eE]/);
  return BigInt(coefficient) * BigInt(10) ** BigInt(exponent);
};

// Returns whether an AST subtree references a given identifier name. Used to lower `transient` state vars into
// per-function locals only in the functions that actually use them (avoids dead locals / name collisions).
class IdentifierReferenceFinder extends AstTraversal {
  private found = false;

  constructor(private targetName: string) { super(); }

  has(node: Node): boolean {
    this.found = false;
    this.visit(node);
    return this.found;
  }

  visitIdentifier(node: IdentifierNode): Node {
    if (node.name === this.targetName) this.found = true;
    return node;
  }
}
