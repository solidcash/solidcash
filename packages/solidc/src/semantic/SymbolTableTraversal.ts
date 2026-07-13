import { GLOBAL_SYMBOL_TABLE, Modifier } from '../ast/Globals.js';
import {
  ContractNode,
  ParameterNode,
  VariableDefinitionNode,
  FunctionDefinitionNode,
  IdentifierNode,
  ExpressionStatementNode,
  StatementNode,
  BlockNode,
  Node,
  FunctionCallNode,
  InstantiationNode,
  AssignNode,
  TupleAssignmentNode,
  ConsoleStatementNode,
  ConsoleParameterNode,
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
  EntryAccessInfo,
  KeySourceInfo,
  TokenContainerAccessInfo,
  FieldAccessNode,
  EventDefinitionNode,
  EmitStatementNode,
  EmitInfo,
  TransferInfo,
  TransferStatementNode,
  TokenContainerMethodStatementNode,
  BranchNode,
  DoWhileNode,
  WhileNode,
  FunctionModifier,
  ReturnNode,
  FunctionCallStatementNode,
  ConstantDefinitionNode,
  EnumDefinitionNode,
  SourceFileNode,
  ExpressionNode,
  LiteralNode,
  BinaryOpNode,
  UnaryOpNode,
  CastNode,
  NullaryOpNode,
  TernaryOpNode,
  SliceNode,
  TupleIndexOpNode,
  ArrayNode,
  ArrayAccessNode,
  ArrayPushNode,
  ArrayPopNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  ContractReferenceNode,
  TryCatchNode,
  CatchClauseNode,
  InterfaceNode,
  InterfaceStateVariableNode,
  InterfaceFunctionNode,
  InterfaceCollectionNode,
  ExternalStateAccessNode,
  ExternalMappingAccessNode,
  ExternalReadSlot,
  ExternalFunctionCallNode,
  ExternalCallSlot,
  ExternalCallArgSource,
  ExternalCallMode,
  ExternalOutputStateNode,
  ExternalOutputStateAccessNode,
  ExternalOutStateSlot,
  MethodCallNode,
  MethodCallStatementNode,
  StateVariableVisibility,
  ErrorDefinitionNode,
  RevertNode,
  RequireNode,
  AssertNode,
  AddressTransferStatementNode,
  AddressSendExpressionNode,
  HexLiteralNode,
  IntLiteralNode,
  BoolLiteralNode,
  StringLiteralNode,
  AbiEncodeWithSignatureNode,
  AbiEncodeCallNode,
  AbiEncodeNode,
  AbiEncodePackedNode,
  AbiEncodeWithSelectorNode,
  AbiDecodeNode,
  AbiDecodeAtNode,
  BytesConcatNode,
  StringConcatNode,
  NewArrayNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  CollectionIterationNode,
  CollectionIterationInfo,
  TypeIntrospectionNode,
  SwitchNode,
  UsingForDirectiveNode,
  UsingForBinding,
  StateArrayPushNode,
  StateArrayPopNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { SymbolTable, Symbol, SymbolType } from '../ast/SymbolTable.js';
import { BinaryOperator, NullaryOperator, UnaryOperator } from '../ast/Operator.js';
import { createDefaultValueExpression } from '../ast/defaults.js';
import { cloneNode } from '../ast/clone.js';
import { computeBranchOps, countBranchOps } from './branchOps.js';
import {
  FunctionRedefinitionError,
  VariableRedefinitionError,
  TupleMixedSlotsError,
  FunctionTypeNotEncodableError,
  UndefinedReferenceError,
  InvalidSymbolTypeError,
  ConstantModificationError,
  CalldataModificationError,
  UndefinedStateVariableError,
  UndefinedCollectionError,
  MappingAccessInConstructorError,
  StructRedefinitionError,
  StructFieldCountError,
  StructDuplicateFieldError,
  StructUnknownFieldError,
  EventRedefinitionError,
  UndefinedEventError,
  ErrorRedefinitionError,
  UndefinedErrorError,
  TokenContainerKeyMustBeParameterError,
  TokenContainerTransferInConstructorError,
  TokenContainerAccessInConstructorError,
  InvalidModifierCombinationError,
  DelegatecallSelfMutationError,
  InternalCallToExternalError,
  NamedArgumentError,
  NonCompileTimeExpressionError,
  TypeDefinitionRedefinitionError,
  EnumRedefinitionError,
  ContractConstructorArgCountError,
  ContractNoArgsRequiredError,
  InterfaceRedefinitionError,
  UndefinedInterfaceError,
  InterfaceComplianceError,
  CircularInterfaceInheritanceError,
  PrivateStateVariableAccessError,
  PrivateCollectionAccessError,
  UndefinedExternalStateVariableError,
  ExternalReadArgCountError,
  UndefinedInterfaceFunctionError,
  MethodCallNotSupportedError,
  DeployThenCallError,
  UsingForUndefinedLibraryError,
  UsingForUndefinedFunctionError,
  OperatorOverloadNonUDVTError,
  OperatorOverloadSignatureError,
  FunctionSelectorCollisionError,
  ImmutableStateVariableAssignmentError,
  UnknownContractTypeError,
  ContractTypeConstructorArgCountError,
  ExternalAccessOnUnconnectedError,
  AbstractFunctionInConcreteContractError,
  UnimplementedAbstractFunctionError,
  AbstractContractNotCompilableError,
  StatefulContractDeploymentError,
  DeployValueInNonStatefulError,
  InvalidTypeIntrospectionPropertyError,
  InvalidTypeForIntrospectionError,
  AbiEncodeCallUndefinedInterfaceError,
  AbiEncodeCallUndefinedFunctionError,
  AbiEncodeCallArgCountError,
} from '../Errors.js';
import {
  CompilerOptions, PrimitiveType, BytesType, Type, StructType, EnumType, AddressType, ValueType,
  computeEventSignature, computeEventSelector, computeErrorSignature, computeCollectionSignature,
  computeFunctionSignature, computeFunctionSelector, TupleType, ArrayType,
  IntType, FixedType, MappingType, FunctionType,
  FunctionBlockLayout, BlockLayoutSlot, resolveLibraries, ExternalLibrary, parseTypeStrict,
  INLINE_MAX_BLOB_LENGTH, isDynamicStorageType,
} from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth';

// Counts identifier occurrences in an expression subtree (structural children only, no definition backrefs).
class IdentifierNameCounter extends AstTraversal {
  counts: Map<string, number> = new Map();

  visitIdentifier(node: IdentifierNode): Node {
    this.counts.set(node.name, (this.counts.get(node.name) ?? 0) + 1);
    return node;
  }
}

function getMaxPushdataEncodedSizeForType(type: Type, seen: Set<string> = new Set()): number {
  if (type === PrimitiveType.BOOL) return 1;
  if (type === PrimitiveType.BIGINT) return 9;
  if (type === PrimitiveType.PUBKEY) return 34;
  if (type === PrimitiveType.SIG) return 74;
  if (type === PrimitiveType.DATASIG) return 66;
  if (type instanceof IntType) {
    const dataBytes = Math.ceil((type.bits + 1) / 8); // +1 for sign bit
    if (dataBytes <= 75) return dataBytes + 1;
    if (dataBytes <= 255) return dataBytes + 2;
    return dataBytes + 3;
  }
  if (type instanceof FixedType) {
    const dataBytes = Math.ceil((type.bits + 1) / 8);
    if (dataBytes <= 75) return dataBytes + 1;
    if (dataBytes <= 255) return dataBytes + 2;
    return dataBytes + 3;
  }
  if (type instanceof BytesType) {
    if (type.bound === undefined) return 9; // Unbounded bytes: use generic pushdata size
    const n = type.bound;
    if (n === 0) return 1;
    if (n === 1) return 2;
    if (n <= 75) return n + 1;
    if (n <= 255) return n + 2;
    return n + 3;
  }
  if (type instanceof AddressType) return 9; // Address uses pushdata encoding
  if (type instanceof ValueType) return getMaxPushdataEncodedSizeForType(type.underlyingType, seen);
  if (type instanceof StructType) {
    // A struct reaches itself only through a dynamic array / mapping (returns a bounded handle below). A direct
    // or fixed-array self / mutual reference has no finite size - reject cleanly rather than recursing forever.
    if (seen.has(type.name)) {
      throw new Error(`Recursive struct '${type.name}' has no bounded size; a struct may only reference itself `
        + 'through a dynamic array or mapping');
    }
    const next = new Set(seen).add(type.name);
    return type.fields.reduce((sum, f) => sum + getMaxPushdataEncodedSizeForType(f.type, next), 0);
  }
  if (type instanceof ArrayType && type.bound !== undefined) {
    return getMaxPushdataEncodedSizeForType(PrimitiveType.BIGINT, seen)
      + type.bound * getMaxPushdataEncodedSizeForType(type.elementType, seen);
  }
  return 9;
}

export default class SymbolTableTraversal extends AstTraversal {
  private symbolTables: SymbolTable[] = [new SymbolTable(GLOBAL_SYMBOL_TABLE)];
  private functionSignatures: Set<string> = new Set();

  // Free (file-level) function signatures are tracked separately from contract-member signatures: a contract
  // function may share a name/signature with a free function (it shadows it within the contract), which is legal
  // Solidity and must not trip FunctionRedefinitionError. Free-vs-free collisions are still caught here.
  private freeFunctionSignatures: Set<string> = new Set();
  private currentFunction: FunctionDefinitionNode;
  // Local var name -> its initializer expression, for resolving a mapping key that is a local (e.g.
  // `address lastKey = keys[keys.length-1]; m[lastKey] = v`). Populated per function before the entry pre-scan.
  private localKeyDefs: Map<string, ExpressionNode> = new Map();
  private currentContract: ContractNode;
  private expectedSymbolType: SymbolType = SymbolType.VARIABLE;
  private insideConsoleStatement: boolean = false;

  // Depth of conditionally-evaluated expression branches (ternary arms, short-circuit && / ||
  // right operand). References inside them must not become the OP_ROLL "last use": the branch may
  // be skipped at runtime, so the variable must stay on the stack (PICK) and be cleaned by cleanStack.
  private conditionalBranchDepth: number = 0;

  private conditionalRefNames: Set<string> = new Set();
  private insideConstructor: boolean = false;
  private tupleStateTempCounter: number = 0;
  private knownLibraryNames: Set<string> = new Set();
  private libraryFunctionSignatures: Map<string, string[]> = new Map();
  private libraryEventSignatures: Map<string, string[]> = new Map();
  private stateVariableMap: Map<string, StateVariableNode> = new Map();
  private collectionMap: Map<string, CollectionNode> = new Map();
  private structMap: Map<string, StructType> = new Map();
  private typeDefMap: Map<string, ValueType> = new Map();
  private enumMap: Map<string, EnumType> = new Map();
  private eventMap: Map<string, EventDefinitionNode> = new Map();
  // Events declared in a sibling/imported contract (not the target contract nor a library): a qualified
  // `emit C.E(...)` of one is recorded on the emitting contract so the artifact lists it (Solidity ABI parity).
  private siblingContractEvents: WeakSet<EventDefinitionNode> = new WeakSet();
  private errorMap: Map<string, ErrorDefinitionNode> = new Map();
  private insideBranch: boolean = false;
  private isStatefulContract: boolean = false;
  private compilerOptions: CompilerOptions;
  private nextFunctionId: number = 0;
  private functionDefinitions: Map<string, FunctionDefinitionNode[]> = new Map();
  private constantMap: Map<string, ConstantDefinitionNode> = new Map();
  private contractMap: Map<string, ContractNode> = new Map();
  private interfaceMap: Map<string, InterfaceNode> = new Map();
  // using-for: type string (or "*") -> [{methodName, fullFunctionName}]
  private usingForBindings: Map<string, Array<{ methodName: string; fullFunctionName: string }>> = new Map();
  // operator overloads: typeStr -> operatorKey -> fullFunctionName
  // operatorKey examples: '+', '-', '==', 'unary_-', 'unary_~'
  private operatorOverloads: Map<string, Map<string, string>> = new Map();

  private resolvedLibraries: Record<string, ExternalLibrary>;

  constructor(compilerOptions: CompilerOptions = {}) {
    super();
    this.compilerOptions = compilerOptions;
    // Built-in + user-supplied external libraries for this compilation. User libraries are registered
    // as callable functions in the per-compilation root table (NOT the static global, which would leak).
    this.resolvedLibraries = resolveLibraries(compilerOptions.userLibraries);
    for (const ul of compilerOptions.userLibraries ?? []) {
      this.symbolTables[0].set(Symbol.function(
        ul.name,
        parseTypeStrict(ul.abi.outputs[0].type),
        ul.abi.inputs.map((input) => parseTypeStrict(input.type)),
      ));
    }
  }

  visitSourceFile(node: SourceFileNode): Node {
    // Register imported contracts for cross-contract references
    for (const imported of node.importedContracts) {
      this.contractMap.set(imported.name, imported);
    }

    // Register built-in NftCapability enum (none=0, mutable=1, minting=2)
    const nftCapType = new EnumType('NftCapability', [
      { name: 'none', value: 0n },
      { name: 'mutable', value: 1n },
      { name: 'minting', value: 2n },
    ]);
    this.enumMap.set('NftCapability', nftCapType);
    this.symbolTables[0].set(Symbol.enumType('NftCapability', nftCapType));

    // Register file-level enums BEFORE file-level constants: a free constant may be enum-typed and initialized
    // from an enum member (`ActionChoices constant c = ActionChoices.Go;`), which is compile-time only if the
    // enum is already in enumMap.
    for (const ed of node.enumDefinitions) {
      this.registerEnum(ed);
    }

    // Register file-level constants before visiting contract
    for (const cd of node.constantDefinitions) {
      this.visitConstantDefinition(cd);
    }

    // Register file-level structs (before interfaces, so interface mapping value types resolve)
    for (const sd of node.structDefinitions) {
      if (this.structMap.has(sd.name)) {
        throw new StructRedefinitionError(sd);
      }
      const structType = new StructType(sd.name, sd.fields);
      this.structMap.set(sd.name, structType);
      this.symbolTables[0].set(Symbol.function(sd.name, structType, sd.fields.map((f) => f.type)));
    }

    // Register file-level type definitions (user-defined value types)
    for (const td of node.typeDefinitions) {
      if (this.typeDefMap.has(td.name) || this.structMap.has(td.name) || this.enumMap.has(td.name)) {
        throw new TypeDefinitionRedefinitionError(td);
      }
      this.typeDefMap.set(td.name, td.valueType);
    }

    // Register file-level errors
    for (const err of node.errorDefinitions) {
      this.registerError(err);
    }

    // Register file-level events (from library imports)
    for (const ev of node.eventDefinitions) {
      const sig = computeEventSignature(ev.name, ev.parameters.map((p) => p.type?.toString() ?? 'address'));
      ev.signature = sig;
      if (!this.eventMap.has(sig)) {
        this.eventMap.set(sig, ev);
      }
    }

    // Register events declared in sibling/imported contracts, so a qualified `emit C.E(...)` resolves (the event's
    // commitment encoding depends only on its name+params, not the declaring scope). Skip-if-exists: a same-sig
    // event in another scope is semantically identical, not a redefinition.
    for (const imported of node.importedContracts) {
      for (const ev of imported.eventDefinitions) {
        const sig = computeEventSignature(ev.name, ev.parameters.map((p) => p.type?.toString() ?? 'address'));
        ev.signature = sig;
        this.siblingContractEvents.add(ev);
        if (!this.eventMap.has(sig)) {
          this.eventMap.set(sig, ev);
        }
      }
    }

    // Register file-level interfaces (and their struct/enum/type/event definitions)
    for (const iface of node.interfaceDefinitions) {
      // Register interface-level enums
      for (const ed of iface.enumDefinitions) {
        if (!this.enumMap.has(ed.name)) {
          this.registerEnum(ed);
        }
      }
      // Register interface-level structs
      for (const sd of iface.structDefinitions) {
        if (!this.structMap.has(sd.name)) {
          const structType = new StructType(sd.name, sd.fields);
          this.structMap.set(sd.name, structType);
          this.symbolTables[0].set(Symbol.function(sd.name, structType, sd.fields.map((f) => f.type)));
        }
      }
      // Register interface-level type definitions
      for (const td of iface.typeDefinitions) {
        if (!this.typeDefMap.has(td.name)) {
          this.typeDefMap.set(td.name, td.valueType);
        }
      }
      // Register interface-level events
      for (const ev of iface.eventDefinitions) {
        const sig = computeEventSignature(ev.name, ev.parameters.map((p) => p.type?.toString() ?? 'address'));
        ev.signature = sig;
        if (!this.eventMap.has(sig)) {
          this.eventMap.set(sig, ev);
        }
      }
      if (this.interfaceMap.has(iface.name)) {
        throw new InterfaceRedefinitionError(iface);
      }
      this.interfaceMap.set(iface.name, iface);
    }

    // Synthesize InterfaceNode from each imported contract (for external call/read support). A contract used as
    // a callee is registered so `IFoo(addr).m()` / `contractVar.m()` resolve; tracked so it is NOT accepted as an
    // interface-inheritance parent (solc: "Interfaces can only inherit from other interfaces").
    const contractDerivedIface = new Set<string>();
    for (const imported of node.importedContracts) {
      if (!this.interfaceMap.has(imported.name)) {
        const synthesized = this.synthesizeInterfaceFromContract(imported);
        this.interfaceMap.set(imported.name, synthesized);
        node.interfaceDefinitions.push(synthesized);
        contractDerivedIface.add(imported.name);
      }
    }
    // The current contract can call ANOTHER instance of its OWN type (`M(addr).m()` - valid Solidity: a contract
    // invoking a sibling deployment of itself, e.g. Migrations upgrading to a new Migrations). Synthesize its
    // interface too so the external-call dispatch resolves it (a `this.m()` self-call is a separate path).
    if (node.contract && !this.interfaceMap.has(node.contract.name)) {
      const synthesized = this.synthesizeInterfaceFromContract(node.contract);
      this.interfaceMap.set(node.contract.name, synthesized);
      node.interfaceDefinitions.push(synthesized);
      contractDerivedIface.add(node.contract.name);
    }

    // Validate interface parent references (after all interfaces are registered)
    for (const iface of node.interfaceDefinitions) {
      if (contractDerivedIface.has(iface.name)) continue; // a synthesized contract stub, not a user interface
      for (const parentName of iface.parents) {
        // An interface may only inherit interfaces - a contract-derived stub is not a valid parent (solc TypeError).
        if (!this.interfaceMap.has(parentName) || contractDerivedIface.has(parentName)) {
          throw new UndefinedInterfaceError(iface, parentName);
        }
      }
      // Check for circular inheritance
      this.checkCircularInheritance(iface, new Set());
    }

    this.knownLibraryNames = new Set(node.declaredLibraryNames);
    this.libraryFunctionSignatures = node.libraryFunctionSignatures;
    this.libraryEventSignatures = node.libraryEventSignatures;

    // Pre-register free functions in global scope (so they can call each other and be called from contract)
    for (const func of node.freeFunctions) {
      const paramTypes = func.parameters.map((p) => p.type);
      const sig = computeFunctionSignature(func.name, paramTypes.map((t) => t.toString()));
      if (this.freeFunctionSignatures.has(sig)) {
        throw new FunctionRedefinitionError(func, paramTypes.map((t) => t.toString()).join(', '));
      }
      this.freeFunctionSignatures.add(sig);

      const returnType = func.returnTypes.length === 1
        ? func.returnTypes[0]
        : func.returnTypes.length > 1
          ? new TupleType(func.returnTypes)
          : PrimitiveType.VOID;

      // Only register first overload of a name in the symbol table (for identifier resolution)
      if (!this.functionDefinitions.has(func.name)) {
        this.symbolTables[0].set(Symbol.function(func.name, returnType, paramTypes));
      }

      func.functionId = this.nextFunctionId++;
      const existing = this.functionDefinitions.get(func.name) ?? [];
      existing.push(func);
      this.functionDefinitions.set(func.name, existing);
    }

    // Visit free function bodies
    for (const func of node.freeFunctions) {
      this.visitFunctionDefinition(func);
    }

    // Process file-level using-for directives (must be after free functions are registered)
    for (const ufd of node.usingForDirectives) {
      this.visitUsingForDirective(ufd);
    }

    node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    node.symbolTable = new SymbolTable(this.symbolTables[0]);
    this.symbolTables.unshift(node.symbolTable);

    // Register current contract in contractMap so type(ContractName).name works
    this.contractMap.set(node.name, node);
    this.currentContract = node;

    this.isStatefulContract = node.stateVariables.length > 0
      || node.collections.length > 0
      || node.eventDefinitions.length > 0
      || (this.compilerOptions.forceStateful ?? false)
      || node.usesBlockhash
      // Deploying a stateful child (`new T()` where T has state) IS a deploy, and the deploy covenant rides the
      // parent's block layout - so a parent that instantiates a stateful contract is itself made stateful (the
      // `deploy` modifier is implied). Recorded on the node so artifact generation also sees it as stateful.
      || (node.deploysStatefulChild = this.detectStatefulChildDeploy(node))
      // Emitting any event (including a foreign/library event) needs a state NFT for the commitment -> stateful.
      || (node.emitsEvent = this.detectEmitsEvent(node));

    node.parameters = this.visitList(node.parameters) as ParameterNode[];

    // Register contract-level enums
    for (const ed of node.enumDefinitions) {
      this.registerEnum(ed);
    }

    // Register struct definitions
    for (const sd of node.structDefinitions) {
      if (this.structMap.has(sd.name)) {
        throw new StructRedefinitionError(sd);
      }
      const structType = new StructType(sd.name, sd.fields);
      this.structMap.set(sd.name, structType);
      // Register as a function symbol so Identifier(Score) in FunctionCallExpression resolves
      this.symbolTables[0].set(Symbol.function(sd.name, structType, sd.fields.map((f) => f.type)));
    }

    // Register user-defined value type definitions
    for (const td of node.typeDefinitions) {
      if (this.typeDefMap.has(td.name) || this.structMap.has(td.name) || this.enumMap.has(td.name)) {
        throw new TypeDefinitionRedefinitionError(td);
      }
      this.typeDefMap.set(td.name, td.valueType);
    }

    // Register event definitions (keyed by full signature to allow overloading). The redefinition check is
    // within-contract only: a same-sig event registered by a sibling/library scope is not a redefinition.
    const localEventSigs = new Set<string>();
    for (const ev of node.eventDefinitions) {
      const sig = computeEventSignature(ev.name, ev.parameters.map((p) => p.type?.toString() ?? 'address'));
      ev.signature = sig;
      if (localEventSigs.has(sig)) {
        throw new EventRedefinitionError(ev);
      }
      localEventSigs.add(sig);
      if (!this.eventMap.has(sig)) {
        this.eventMap.set(sig, ev);
      }
    }

    // Register error definitions (keyed by full signature to allow overloading)
    for (const err of node.errorDefinitions) {
      this.registerError(err);
    }

    // Register contract-level constants
    for (const cd of node.constantDefinitions) {
      this.visitConstantDefinition(cd);
    }

    // Process contract-level using-for directives
    for (const ufd of node.usingForDirectives) {
      this.visitUsingForDirective(ufd);
    }

    // Register state variables with bin-packing layout computation
    const commitmentLimit = this.compilerOptions.commitmentLimit ?? 128;
    let nftIndex = 0;
    let fieldIndex = 0;
    let currentNftUsed = 0;

    node.stateVariables.forEach((sv) => {
      if (this.symbolTables[0].get(sv.name)) {
        throw new VariableRedefinitionError(new ParameterNode(sv.type, sv.name));
      }

      // Validate contract-typed state variables. A name unknown at parse time may resolve to an enum or
      // struct now that imports are merged (e.g. an imported `enum Status` / `struct Todo`); re-type the
      // state var to the real value type rather than leaving it as a contract address handle.
      if (sv.contractTypeName) {
        if (this.enumMap.has(sv.contractTypeName)) {
          sv.type = this.enumMap.get(sv.contractTypeName)!;
          sv.contractTypeName = undefined;
        } else if (this.structMap.has(sv.contractTypeName)) {
          sv.type = this.structMap.get(sv.contractTypeName)!;
          sv.contractTypeName = undefined;
        } else if (!this.contractMap.has(sv.contractTypeName) && !this.interfaceMap.has(sv.contractTypeName)) {
          throw new UnknownContractTypeError(sv, sv.contractTypeName);
        }
      }

      // Dynamic-storage vars (string / unbounded bytes, chunk-packed fixed-width arrays) store only a uint32
      // length header (A$len) in the data NFT; the value lives in chunk UTXOs, so reserve the uint32 footprint.
      // string/bytes detected by type; a chunk-packed array arrives with sv.isDynamic set by the AstBuilder.
      // See docs/dynamic-storage.md, arrays.md.
      let maxSize = getMaxPushdataEncodedSizeForType(sv.type);
      if (isDynamicStorageType(sv.type)) sv.isDynamic = true;
      if (sv.isDynamic) {
        maxSize = getMaxPushdataEncodedSizeForType(new IntType(false, 32)); // A$len: uint32 -> 6 bytes
      }

      if (sv.visibility === StateVariableVisibility.EXTERNAL) {
        // External variables always get their own dedicated NFT
        if (currentNftUsed > 0) {
          nftIndex++;
          fieldIndex = 0;
          currentNftUsed = 0;
        }
        sv.nftIndex = nftIndex;
        sv.fieldIndex = 0;
        nftIndex++;
        fieldIndex = 0;
        currentNftUsed = 0;
      } else if (sv.type instanceof StructType) {
        // Struct must be placed last in its NFT.
        // If it doesn't fit in the current NFT, start a new one.
        if (currentNftUsed + maxSize > commitmentLimit && currentNftUsed > 0) {
          nftIndex++;
          fieldIndex = 0;
          currentNftUsed = 0;
        }
        sv.nftIndex = nftIndex;
        sv.fieldIndex = fieldIndex++;
        currentNftUsed += maxSize;
        // Force next non-struct var to go to a new NFT since struct must be last
        nftIndex++;
        fieldIndex = 0;
        currentNftUsed = 0;
      } else if (sv.isPacked && sv.type instanceof ArrayType) {
        // Packed arrays are stored as a single blob in a data NFT.
        // Unbounded arrays always get their own NFT since size is unknown.
        if (!(sv.type as ArrayType).bound) {
          if (currentNftUsed > 0) {
            nftIndex++;
            fieldIndex = 0;
            currentNftUsed = 0;
          }
          sv.nftIndex = nftIndex;
          sv.fieldIndex = fieldIndex++;
          // Force next var to a new NFT since unbounded array size is unknown
          nftIndex++;
          fieldIndex = 0;
          currentNftUsed = 0;
        } else {
          // Bounded packed array: use estimate for bin-packing, but must be last in NFT
          if (currentNftUsed + maxSize > commitmentLimit && currentNftUsed > 0) {
            nftIndex++;
            fieldIndex = 0;
            currentNftUsed = 0;
          }
          sv.nftIndex = nftIndex;
          sv.fieldIndex = fieldIndex++;
          currentNftUsed += maxSize;
          // Force next var to a new NFT since packed array must be last
          nftIndex++;
          fieldIndex = 0;
          currentNftUsed = 0;
        }
      } else {
        if (currentNftUsed + maxSize > commitmentLimit && currentNftUsed > 0) {
          nftIndex++;
          fieldIndex = 0;
          currentNftUsed = 0;
        }
        sv.nftIndex = nftIndex;
        sv.fieldIndex = fieldIndex++;
        currentNftUsed += maxSize;
      }

      const symbol = Symbol.stateVariable(sv);
      // Mark as referenced so state variables are exempt from unused-variable checking
      symbol.references.push({ name: sv.name } as IdentifierNode);
      this.symbolTables[0].set(symbol);
      this.stateVariableMap.set(sv.name, sv);
    });

    // Register collections (mappings)
    for (const coll of node.collections) {
      if (this.symbolTables[0].get(coll.name) || this.stateVariableMap.has(coll.name)) {
        throw new VariableRedefinitionError(new ParameterNode(coll.type, coll.name));
      }
      this.collectionMap.set(coll.name, coll);
    }

    // Pre-register all user-defined functions (before visiting bodies)
    for (const func of node.functions) {
      this.validateModifiers(func, node);

      // An entry point may take/return an EXTERNAL function pointer (an (address, selector) value). A self-call
      // (`this.f(this.g, ..)`) routes to the internal OP_INVOKE path, so the pointer stays on the stack and the
      // existing runtime address+selector call-through applies. An INTERNAL function pointer has no
      // cross-contract representation, so it stays rejected on an entry point - solc rejects it too.
      if (func.isEntryPoint) {
        for (const p of func.parameters) {
          if (p.type instanceof FunctionType && !p.type.isExternal) {
            throw new FunctionTypeNotEncodableError(p, 'parameters of an external/public function');
          }
        }
        if (func.returnTypes.some((t) => t instanceof FunctionType && !(t as FunctionType).isExternal)) {
          throw new FunctionTypeNotEncodableError(func, 'return values of an external/public function');
        }
      }

      const paramTypes = func.parameters.map((p) => p.type);
      const sig = computeFunctionSignature(func.name, paramTypes.map((t) => t.toString()));
      // A contract function may shadow a same-signature FREE function under Solidity-compat (legal Solidity);
      // native solidcash keeps the strict check (the free/contract collision is an error there).
      const collidesFree = !this.compilerOptions.solidityImportCompat && this.freeFunctionSignatures.has(sig);
      if (this.functionSignatures.has(sig) || collidesFree) {
        throw new FunctionRedefinitionError(func, paramTypes.map((t) => t.toString()).join(', '));
      }
      this.functionSignatures.add(sig);

      const visibility = func.visibility;
      if (visibility === 'internal' || visibility === 'private' || visibility === 'public') {
        // Register for identifier resolution (function pointers), first overload only. Skip if the name is
        // already taken by a constructor param / state var, so a bare identifier still resolves to that
        // variable (the function stays callable via functionDefinitions). Matters now that the default
        // visibility is public: an entry point sharing a name with a param must not shadow it.
        if (!this.functionDefinitions.has(func.name) && !this.symbolTables[0].get(func.name)) {
          const returnType = func.returnTypes.length === 1
            ? func.returnTypes[0]
            : func.returnTypes.length > 1
              ? new TupleType(func.returnTypes)
              : PrimitiveType.VOID;
          this.symbolTables[0].set(Symbol.function(func.name, returnType, paramTypes));
        }

        // Assign OP_DEFINE function ID
        func.functionId = this.nextFunctionId++;
      } else if (visibility === 'external') {
        // An external function is NOT registered as an identifier symbol (its name is not usable internally),
        // but it still gets an OP_DEFINE id so a `this.f()` self-call can invoke it as a subroutine.
        func.functionId = this.nextFunctionId++;
      }
      const existing = this.functionDefinitions.get(func.name) ?? [];
      existing.push(func);
      this.functionDefinitions.set(func.name, existing);
    }

    // The fallback is internally invokable via the self low-level-call lowering (`address(this).call(data)`
    // with a raw payload routes to it, like the EVM's raw-calldata path). Register it like an external
    // function: an OP_DEFINE id + a functionDefinitions entry (its reserved __fallback name cannot collide).
    if (node.fallbackDef) {
      node.fallbackDef.functionId = this.nextFunctionId++;
      this.functionDefinitions.set(node.fallbackDef.name, [node.fallbackDef]);
    }

    // Function pointers in state are positional functionIds, safe only while the bytecode is immutable.
    // An upgrade (rewrites own code) or delegate (swappable logic) contract would remap them - reject.
    const mutatesCode = node.functions.some((f) =>
      f.modifiers.includes(FunctionModifier.UPGRADE) || f.modifiers.includes(FunctionModifier.DELEGATE));
    if (mutatesCode) {
      const stateTypes = [
        ...node.stateVariables.map((sv) => sv.type),
        ...node.collections.map((c) => c.type),
      ];
      for (const t of stateTypes) {
        if (typeReferencesFunctionPointer(t)) {
          throw new FunctionTypeNotEncodableError(
            node, 'persistent state of an upgrade/delegate contract (functionIds would remap)',
          );
        }
      }
    }

    // Validate abstract functions: concrete contracts must not have abstract functions
    if (!node.isAbstract) {
      for (const func of node.functions) {
        if (func.isAbstract) {
          if (func.inheritedFrom) {
            throw new UnimplementedAbstractFunctionError(node, func.name, func.inheritedFrom);
          } else {
            throw new AbstractFunctionInConcreteContractError(node, func.name);
          }
        }
      }
    }

    // Compute 4-byte hash selectors for entry-point functions
    const selectorMap = new Map<string, FunctionDefinitionNode>();
    for (const func of node.functions) {
      if (!func.isEntryPoint || func.isAbstract) continue;
      const paramTypes = func.parameters.map((p) => p.type.toString());
      const sig = computeFunctionSignature(func.name, paramTypes);
      const selector = computeFunctionSelector(sig);
      const selectorHex = binToHex(selector);

      const collision = selectorMap.get(selectorHex);
      if (collision) {
        throw new FunctionSelectorCollisionError(func, collision, selectorHex);
      }
      selectorMap.set(selectorHex, func);
      func.functionSelector = selector;
    }

    // Assign selector to constructor if it participates in dispatch
    if (node.constructorDef) {
      const paramTypes = node.constructorDef.parameters.map((p) => p.type.toString());
      const sig = computeFunctionSignature('constructor', paramTypes);
      const selector = computeFunctionSelector(sig);
      const selectorHex = binToHex(selector);
      const collision = selectorMap.get(selectorHex);
      if (collision) throw new FunctionSelectorCollisionError(node.constructorDef, collision, selectorHex);
      selectorMap.set(selectorHex, node.constructorDef);
      node.constructorDef.functionSelector = selector;
    }

    // Compute selectors for fallback/receive
    if (node.fallbackDef) {
      const sig = computeFunctionSignature('__fallback', []);
      const selector = computeFunctionSelector(sig);
      const selectorHex = binToHex(selector);
      const collision = selectorMap.get(selectorHex);
      if (collision) throw new FunctionSelectorCollisionError(node.fallbackDef, collision, selectorHex);
      selectorMap.set(selectorHex, node.fallbackDef);
      node.fallbackDef.functionSelector = selector;
    }

    if (node.receiveDef) {
      const sig = computeFunctionSignature('__receive', []);
      const selector = computeFunctionSelector(sig);
      const selectorHex = binToHex(selector);
      const collision = selectorMap.get(selectorHex);
      if (collision) throw new FunctionSelectorCollisionError(node.receiveDef, collision, selectorHex);
      selectorMap.set(selectorHex, node.receiveDef);
      node.receiveDef.functionSelector = selector;
    }

    // Check interface compliance
    for (const ifaceName of node.implements) {
      const iface = this.interfaceMap.get(ifaceName);
      if (!iface) {
        throw new UndefinedInterfaceError(node, ifaceName);
      }
      // Collect all functions including inherited ones
      const allFunctions = this.getAllInterfaceFunctions(iface);
      for (const ifaceFunc of allFunctions) {
        const overloads = this.functionDefinitions.get(ifaceFunc.name) ?? [];
        // At least one overload must match the signature...
        const hasMatch = overloads.some((func) => {
          if (func.parameters.length !== ifaceFunc.parameters.length) return false;
          for (let i = 0; i < func.parameters.length; i++) {
            if (func.parameters[i].type.toString() !== ifaceFunc.parameters[i].type.toString()) return false;
          }
          if (func.returnTypes.length !== ifaceFunc.returnTypes.length) return false;
          for (let i = 0; i < func.returnTypes.length; i++) {
            if (func.returnTypes[i].toString() !== ifaceFunc.returnTypes[i].toString()) return false;
          }
          return true;
        });
        // ...or a `public`/`external` state var or mapping satisfies it via its auto-generated getter
        // (Solidity: `uint public totalSupply` implements `totalSupply()`, `mapping(address=>uint) public
        // balanceOf` implements `balanceOf(address)`).
        if (!hasMatch && !this.publicStateVarSatisfiesGetter(ifaceFunc)) {
          const paramSig = ifaceFunc.parameters.map((p) => p.type.toString()).join(', ');
          throw new InterfaceComplianceError(
            node,
            `Contract '${node.name}' does not implement function '${ifaceFunc.name}(${paramSig})' required by interface '${ifaceName}'`,
          );
        }
      }

      // Check state variable compliance
      const allStateVars = this.getAllInterfaceStateVariables(iface);
      for (const ifaceVar of allStateVars) {
        const contractVar = this.stateVariableMap.get(ifaceVar.name);
        if (!contractVar) {
          throw new InterfaceComplianceError(
            node,
            `Contract '${node.name}' does not declare state variable '${ifaceVar.name}' required by interface '${ifaceName}'`,
          );
        }
        // Type must match exactly
        if (contractVar.type.toString() !== ifaceVar.type.toString()) {
          throw new InterfaceComplianceError(
            node,
            `State variable '${ifaceVar.name}' in contract '${node.name}' has type '${contractVar.type.toString()}' but interface '${ifaceName}' requires type '${ifaceVar.type.toString()}'`,
          );
        }
        // Visibility compliance: external in interface requires external in contract;
        // public in interface accepts public or external
        if (ifaceVar.visibility === StateVariableVisibility.EXTERNAL) {
          if (contractVar.visibility !== StateVariableVisibility.EXTERNAL) {
            throw new InterfaceComplianceError(
              node,
              `State variable '${ifaceVar.name}' in contract '${node.name}' must be 'external' as required by interface '${ifaceName}'`,
            );
          }
        } else {
          // public in interface: accept public or external
          if (contractVar.visibility !== StateVariableVisibility.PUBLIC
            && contractVar.visibility !== StateVariableVisibility.EXTERNAL) {
            throw new InterfaceComplianceError(
              node,
              `State variable '${ifaceVar.name}' in contract '${node.name}' must be 'public' or 'external' as required by interface '${ifaceName}'`,
            );
          }
        }
      }

      // Check collection compliance
      const allCollections = this.getAllInterfaceCollections(iface);
      for (const ifaceColl of allCollections) {
        const contractColl = this.collectionMap.get(ifaceColl.name);
        if (!contractColl) {
          throw new InterfaceComplianceError(
            node,
            `Contract '${node.name}' does not declare collection '${ifaceColl.name}' required by interface '${ifaceName}'`,
          );
        }
        if (contractColl.type.toString() !== ifaceColl.type.toString()) {
          throw new InterfaceComplianceError(
            node,
            `Collection '${ifaceColl.name}' in contract '${node.name}' has type '${contractColl.type.toString()}' but interface '${ifaceName}' requires type '${ifaceColl.type.toString()}'`,
          );
        }
      }
    }

    if (node.constructorDef) {
      this.insideConstructor = true;
      node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
      this.insideConstructor = false;
    }

    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];

    if (node.fallbackDef) {
      const loc = node.fallbackDef.location ? ` at line ${node.fallbackDef.location.start.line}` : '';
      console.log(`Warning: fallback() is a Solidity compatibility feature${loc}. Its usage on BCH is discouraged as BCH does not use the same contract call model.`);
      node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    }
    if (node.receiveDef) {
      const loc = node.receiveDef.location ? ` at line ${node.receiveDef.location.start.line}` : '';
      console.log(`Warning: receive() is a Solidity compatibility feature${loc}. Its usage on BCH is discouraged as BCH does not use the same contract call model.`);
      node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    }

    this.decideLibraryInlining(node);

    const unusedSymbols = node.symbolTable.unusedSymbols();
    for (const unused of unusedSymbols) {
      // Solidity only warns on unused vars/params and never fails the compile; match that.
      const uloc = unused.definition?.location ? ` at line ${unused.definition.location.start.line}` : '';
      console.log(`Warning: unused variable '${unused.name}'${uloc}.`);
    }

    this.symbolTables.shift();
    return node;
  }

  visitParameter(node: ParameterNode): Node {
    if (node.name.startsWith('__internal__')) {
      throw new Error(`Identifier '${node.name}' uses reserved prefix '__internal__'`);
    }
    const existing = this.symbolTables[0].get(node.name);
    // A param / local / named return may shadow an OUTER-scope symbol: a state variable (the param wins in the
    // function scope; the state var stays reachable via `this.name`) or a FUNCTION - e.g. a named return with
    // the same name as its function, `function max(..) returns (int max)`, which is legal Solidity. Both live at
    // contract/library level, so this never masks a genuine same-scope param/local collision. Native solidcash
    // keeps the strict check.
    const shadowsOuter = this.compilerOptions.solidityImportCompat
      && (existing?.symbolType === SymbolType.STATE_VARIABLE || existing?.symbolType === SymbolType.FUNCTION);
    if (existing && !shadowsOuter) {
      throw new VariableRedefinitionError(node);
    }

    this.symbolTables[0].set(Symbol.variable(node));
    return node;
  }

  visitConstantDefinition(node: ConstantDefinitionNode): Node {
    if (this.symbolTables[0].get(node.name)) {
      throw new VariableRedefinitionError(node);
    }

    // Validate that the expression is a compile-time constant
    if (!isCompileTimeExpression(node.expression, this.constantMap, this.enumMap)) {
      throw new NonCompileTimeExpressionError(node);
    }

    // Resolve identifiers within the constant expression (e.g., references to other constants)
    node.expression = this.resolveConstantExpressionIdentifiers(node.expression);

    const symbol = Symbol.constant(node);
    // Mark as referenced so constants are exempt from unused-variable checking
    symbol.references.push({ name: node.name } as IdentifierNode);
    this.symbolTables[0].set(symbol);
    this.constantMap.set(node.name, node);

    return node;
  }

  private resolveConstantExpressionIdentifiers(expr: ExpressionNode): ExpressionNode {
    if (expr instanceof IdentifierNode) {
      const definition = this.symbolTables[0].get(expr.name);
      if (definition) {
        expr.definition = definition;
        definition.references.push(expr);
      }
    } else if (expr instanceof BinaryOpNode) {
      expr.left = this.resolveConstantExpressionIdentifiers(expr.left);
      expr.right = this.resolveConstantExpressionIdentifiers(expr.right);
    } else if (expr instanceof UnaryOpNode) {
      expr.expression = this.resolveConstantExpressionIdentifiers(expr.expression);
    } else if (expr instanceof CastNode) {
      expr.expression = this.resolveConstantExpressionIdentifiers(expr.expression);
    } else if (expr instanceof ArrayNode) {
      expr.elements = expr.elements.map((e) => this.resolveConstantExpressionIdentifiers(e));
    } else if (expr instanceof BytesConcatNode || expr instanceof StringConcatNode) {
      expr.parameters = expr.parameters.map((e) => this.resolveConstantExpressionIdentifiers(e));
    } else if (expr instanceof FieldAccessNode) {
      // A library/namespaced constant `L.X` -> rewrite to the compound identifier `L.X` so type-checking sees the
      // constant, not a struct-field access on L (which errors "struct has no field X").
      if (expr.expression instanceof IdentifierNode) {
        const compoundName = `${expr.expression.name}.${expr.name}`;
        const definition = this.symbolTables[0].get(compoundName);
        if (definition && this.constantMap.has(compoundName)) {
          const id = new IdentifierNode(compoundName);
          id.location = expr.location;
          id.definition = definition;
          definition.references.push(id);
          return id;
        }
      }
      // Otherwise resolve the base of an enum member access `E.B` (E is an enum symbol) so type-checking sees the
      // base's EnumType and treats `E.B` as a member, not a struct field.
      expr.expression = this.resolveConstantExpressionIdentifiers(expr.expression);
    }
    return expr;
  }

  private deployResultLocals = new Map<string, InstantiationNode>(); // locals = `new C(...)` in the current fn

  // True if any function of `node` instantiates a stateful contract (`new T()` where T has state / collections).
  // Such a parent is made stateful to host the (implied) deploy covenant. Pure AST scan (siblings are already in
  // contractMap from visitSourceFile), only recursing into Node children so a recursive Type cannot loop it.
  private detectStatefulChildDeploy(node: ContractNode): boolean {
    const seen = new Set<Node>();
    let found = false;
    const walk = (n: Node): void => {
      if (found || seen.has(n)) return;
      seen.add(n);
      if (n instanceof InstantiationNode) {
        const child = this.contractMap.get(n.identifier?.name);
        if (child && (child.stateVariables.length > 0 || child.collections.length > 0)) { found = true; return; }
      }
      for (const val of Object.values(n as unknown as Record<string, unknown>)) {
        if (found) return;
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const x of val) if (x instanceof Node) walk(x);
      }
    };
    for (const fn of node.functions) if (fn.body) walk(fn.body);
    return found;
  }

  // A contract that emits ANY event (including a foreign/library event it does not itself declare) needs a state
  // NFT to carry the event commitment, so emitting - like declaring an event - forces the contract stateful.
  private detectEmitsEvent(node: ContractNode): boolean {
    const seen = new Set<Node>();
    let found = false;
    const walk = (n: Node): void => {
      if (found || seen.has(n)) return;
      seen.add(n);
      if (n instanceof EmitStatementNode) { found = true; return; }
      for (const val of Object.values(n as unknown as Record<string, unknown>)) {
        if (found) return;
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const x of val) if (x instanceof Node) walk(x);
      }
    };
    const allFns = [node.constructorDef, node.fallbackDef, node.receiveDef, ...node.functions];
    for (const fn of allFns) if (fn?.body) walk(fn.body);
    return found;
  }

  // A child function is FOLDABLE into its deploy (genesis becomes its post-call state) iff it is a pure
  // (state, args) -> state transition: no external calls, no nested deploys, no contract-instantiation. (tx.*
  // / events / msg.sender exclusion is tightened when the fold codegen consumes this; for now the diagnostic
  // is best-effort.) Pure AST scan so it does not depend on traversal order.
  private isDeployFoldable(fn: FunctionDefinitionNode, visited: Set<Node> = new Set()): boolean {
    const walk = (node: Node): boolean => {
      if (visited.has(node)) return true;
      visited.add(node);
      if (node instanceof ExternalFunctionCallNode || node instanceof InstantiationNode) return false;
      for (const value of Object.values(node)) {
        if (value instanceof Node) {
          if (!walk(value)) return false;
        } else if (Array.isArray(value)) {
          for (const item of value) if (item instanceof Node && !walk(item)) return false;
        }
      }
      return true;
    };
    return fn.body ? walk(fn.body) : true;
  }

  // Fold one expression into a parent-context genesis expression, or null if not foldable. The child starts
  // at default (zero) state, so a `this.<field>` read resolves to the field's value WRITTEN EARLIER in foo
  // (fieldExprs) or its type default. Identifiers resolve to a forwarded arg or an earlier local (subs).
  // Allowed node shapes: literals, those identifiers/state-reads, and pure arithmetic/comparison/bitwise/
  // cast/ternary. Anything else (calls, control flow, unknown identifiers) is unfoldable. Mutates `expr`.
  private foldGenesisExpr(
    expr: ExpressionNode, subs: Map<string, ExpressionNode>, fieldExprs: Map<string, ExpressionNode>,
    fieldType: (name: string) => Type | undefined,
  ): ExpressionNode | null {
    if (expr instanceof LiteralNode) return expr;
    if (expr instanceof IdentifierNode) {
      const sub = subs.get(expr.name);
      if (sub) return cloneNode(sub); // forwarded arg or earlier local
      // A not-yet-analyzed child body reads state as a BARE identifier (the StateAccess rewrite happens
      // in the child's own pass): resolve it like a state read when it names a child field.
      const prior = fieldExprs.get(expr.name);
      if (prior) return cloneNode(prior);
      const t = fieldType(expr.name);
      return t ? createDefaultValueExpression(t, expr.location!) : null; // unknown name -> not foldable
    }
    if (expr instanceof StateAccessNode) {
      const prior = fieldExprs.get(expr.name);
      if (prior) return cloneNode(prior);
      const t = fieldType(expr.name);
      return t ? createDefaultValueExpression(t, expr.location!) : null; // fresh read = type default
    }
    if (expr instanceof BinaryOpNode) {
      const l = this.foldGenesisExpr(expr.left, subs, fieldExprs, fieldType);
      const r = this.foldGenesisExpr(expr.right, subs, fieldExprs, fieldType);
      if (!l || !r) return null;
      expr.left = l; expr.right = r;
      return expr;
    }
    if (expr instanceof UnaryOpNode) {
      const e = this.foldGenesisExpr(expr.expression, subs, fieldExprs, fieldType);
      if (!e) return null;
      expr.expression = e;
      return expr;
    }
    if (expr instanceof CastNode) {
      const e = this.foldGenesisExpr(expr.expression, subs, fieldExprs, fieldType);
      if (!e) return null;
      expr.expression = e;
      return expr;
    }
    if (expr instanceof TernaryOpNode) {
      const c = this.foldGenesisExpr(expr.condition, subs, fieldExprs, fieldType);
      const t = this.foldGenesisExpr(expr.ifTrue, subs, fieldExprs, fieldType);
      const f = this.foldGenesisExpr(expr.ifFalse, subs, fieldExprs, fieldType);
      if (!c || !t || !f) return null;
      expr.condition = c; expr.ifTrue = t; expr.ifFalse = f;
      return expr;
    }
    // Index into a folded array value (`return m_s[i]` where m_s's genesis is a forwarded array arg):
    // both the array and the index fold to parent-context expressions, so the access does too.
    if (expr instanceof ArrayAccessNode) {
      const a = this.foldGenesisExpr(expr.array as ExpressionNode, subs, fieldExprs, fieldType);
      const idx = this.foldGenesisExpr(expr.index as ExpressionNode, subs, fieldExprs, fieldType);
      if (!a || !idx) return null;
      expr.array = a; expr.index = idx;
      return expr;
    }
    return null;
  }

  // Fold a straight-line statement list (`T local = expr;` / `this.field = expr;` / optional trailing
  // require / optional trailing single-value return) against parent-context substitutions. `fieldExprs`
  // carries fields already set (the ctor's genesis when folding a post-deploy call) and is mutated with
  // this list's writes. Returns false when any statement is outside the foldable subset.
  private foldStatementList(
    statements: StatementNode[], subs: Map<string, ExpressionNode>,
    fieldExprs: Map<string, ExpressionNode>, fieldType: (name: string) => Type | undefined,
  ): false | { returnValue?: ExpressionNode, wrote: boolean } {
    let returnValue: ExpressionNode | undefined;
    let wrote = false;
    for (let i = 0; i < statements.length; i += 1) {
      const stmt = statements[i];
      const isLast = i === statements.length - 1;
      if (stmt instanceof VariableDefinitionNode) {
        if (!stmt.expression) return false; // uninitialized local
        const folded = this.foldGenesisExpr(cloneNode(stmt.expression), subs, fieldExprs, fieldType);
        if (!folded) return false;
        subs.set(stmt.name, folded); // inline this local into later expressions
      } else if (stmt instanceof StateAssignNode) {
        const folded = this.foldGenesisExpr(cloneNode(stmt.expression), subs, fieldExprs, fieldType);
        if (!folded) return false;
        fieldExprs.set(stmt.name, folded);
        wrote = true;
      } else if (stmt instanceof AssignNode && stmt.identifier instanceof IdentifierNode) {
        // A not-yet-analyzed child body writes state as a BARE assign (the StateAssign rewrite happens in
        // the child's own pass): a local reassign updates subs, a child-field name is a state write.
        const folded = this.foldGenesisExpr(cloneNode(stmt.expression), subs, fieldExprs, fieldType);
        if (!folded) return false;
        if (subs.has(stmt.identifier.name)) {
          subs.set(stmt.identifier.name, folded);
        } else if (fieldType(stmt.identifier.name)) {
          fieldExprs.set(stmt.identifier.name, folded);
          wrote = true;
        } else {
          return false;
        }
      } else if (stmt instanceof RequireNode) {
        // requires are not enforced at deploy (documented fold semantics), wherever they appear
      } else if (isLast && stmt instanceof ReturnNode && stmt.expressions.length === 1) {
        const folded = this.foldGenesisExpr(cloneNode(stmt.expressions[0]), subs, fieldExprs, fieldType);
        if (!folded) return false;
        returnValue = folded;
      } else {
        return false; // only straight-line local/field assignments (+ trailing require/return) fold
      }
    }
    return { returnValue, wrote };
  }

  // Folded genesis/return expressions embed CLONES of parent-context identifiers that the roll analysis
  // never visited; the originals must stay on the stack (PICK-only) or the clones' codegen reads a
  // vanished slot. Registered in conditionalRefNames so a LATER source use cannot re-mark the name as
  // roll-eligible (clones may be emitted after it). Leftovers are dropped by the epilogue cleanup.
  private protectFoldedExprVars(exprs: Iterable<ExpressionNode | undefined>): void {
    if (!this.currentFunction) return;
    const counter = new IdentifierNameCounter();
    for (const e of exprs) if (e) counter.visit(e);
    for (const name of counter.counts.keys()) {
      this.currentFunction.opRolls.delete(name);
      this.conditionalRefNames.add(name);
    }
  }

  // Fold the child constructor's writes into the deploy genesis, so the covenant verifies the TRUE initial
  // state instead of type defaults. All-or-nothing: an unfoldable ctor (control flow, msg.sender, external
  // reads, ...) leaves the default-genesis behavior unchanged. Runs once per `new C(...)` site.
  private tryFoldChildConstructor(deployNode: InstantiationNode): void {
    const contract = deployNode.referencedContract;
    const ctor = contract?.constructorDef;
    const statements = (ctor?.body as BlockNode | undefined)?.statements ?? [];
    if (!contract || !ctor || statements.length === 0) return;
    const fieldType = (name: string): Type | undefined => contract.stateVariables
      .find((sv) => sv.name === name)?.type;
    const subs = new Map<string, ExpressionNode>();
    const declared = ctor.parameters
      .filter((p) => !p.name.startsWith('__internal__') && !p.name.startsWith('__ctorread_'));
    declared.forEach((p, i) => { if (i < deployNode.parameters.length) subs.set(p.name, deployNode.parameters[i] as ExpressionNode); });
    const fieldExprs = new Map<string, ExpressionNode>();
    const res = this.foldStatementList(statements, subs, fieldExprs, fieldType);
    if (!res) {
      deployNode.ctorFoldFailed = true; // genesis of ctor-written fields is unknown to later folds
      return;
    }
    if (fieldExprs.size === 0) return;
    const init = deployNode.foldedStateInit ?? new Map<string, ExpressionNode>();
    for (const [k, v] of fieldExprs) init.set(k, v);
    deployNode.foldedStateInit = init;
    this.protectFoldedExprVars(init.values());
  }

  // Try to fold a same-tx `deployLocal.foo(args)` into the deploy genesis. Handles a foo whose body is a
  // straight-line sequence of `T local = expr;` and `this.field = expr;` assignments (plus an optional
  // trailing require, not enforced at deploy), where each expr folds (foldGenesisExpr). Records, per child
  // field, its final genesis expression in the parent's context, so the deploy covenant computes the value
  // instead of using the default. Returns false (caller errors) for anything else.
  private tryFoldDeployCall(
    deployNode: InstantiationNode, foo: FunctionDefinitionNode, parentArgs: ExpressionNode[],
  ): false | { returnValue?: ExpressionNode } {
    const statements = (foo.body as BlockNode | undefined)?.statements ?? [];
    if (statements.length === 0) return false;
    // An unfolded ctor means the genesis of fields it may have written is unknown: a read miss must fail
    // the fold (returning the type default would bake a wrong value into the covenant).
    const fieldType = (name: string): Type | undefined => (deployNode.ctorFoldFailed
      ? undefined
      : deployNode.referencedContract?.stateVariables.find((sv) => sv.name === name)?.type);
    const subs = new Map<string, ExpressionNode>(); // forwarded args + earlier locals -> parent-context expr
    foo.parameters.forEach((p, i) => { if (i < parentArgs.length) subs.set(p.name, parentArgs[i]); });
    // Seed with the genesis so far (ctor fold + earlier folded calls): a `this.field` read inside foo must
    // see the TRUE current value, not the type default.
    const fieldExprs = new Map<string, ExpressionNode>(deployNode.foldedStateInit ?? []);
    const res = this.foldStatementList(statements, subs, fieldExprs, fieldType);
    if (!res) return false;
    if (!res.wrote && !res.returnValue) return false; // neither a state transition nor a value
    if (res.wrote) {
      const init = deployNode.foldedStateInit ?? new Map<string, ExpressionNode>();
      for (const [k, v] of fieldExprs) init.set(k, v); // a later folded call overrides an earlier one
      deployNode.foldedStateInit = init;
      this.protectFoldedExprVars(init.values());
    }
    if (res.returnValue) this.protectFoldedExprVars([res.returnValue]);
    return { returnValue: res.returnValue };
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    this.currentFunction = node;
    this.deployResultLocals = new Map(); // reset per function body
    this.conditionalBranchDepth = 0;
    this.conditionalRefNames = new Set();

    node.symbolTable = new SymbolTable(this.symbolTables[0]);
    this.symbolTables.unshift(node.symbolTable);

    // Abstract functions have no body - skip body analysis
    if (node.isAbstract) {
      node.parameters = this.visitList(node.parameters) as ParameterNode[];
      this.symbolTables.shift();
      return node;
    }

    node.parameters = this.visitList(node.parameters) as ParameterNode[];
    node.body = this.visit(node.body);

    // msg.sender pre-scan: inject synthetic _msgSenderCategory parameter
    {
      const usesMsgSender = this.collectMsgSenderUsage(node.body);
      if (usesMsgSender) {
        node.usesMsgSender = true;
        const categoryParam = new ParameterNode(new BytesType(32), '__internal__msgSenderCategory');
        categoryParam.location = node.location;
        node.parameters.push(categoryParam);
        this.symbolTables[0].set(Symbol.variable(categoryParam));
        const sym = this.symbolTables[0].get('__internal__msgSenderCategory');
        if (sym) sym.references.push({ name: '__internal__msgSenderCategory' } as IdentifierNode);
        this.pushToStack(categoryParam);
      }
    }

    // blockhash(n): inject the hidden co-spend input-index param (flagged by SynthesizeBlockOracle). The read
    // codegen reads input[this] rather than the last input, so it survives cross-contract composition; the
    // SDK fills it by locating the C_oracle co-spend.
    if (node.usesBlockhash) {
      const idxParam = new ParameterNode(PrimitiveType.BIGINT, '__internal__blockhashInputIndex');
      idxParam.location = node.location;
      node.parameters.push(idxParam);
      this.symbolTables[0].set(Symbol.variable(idxParam));
      const sym = this.symbolTables[0].get('__internal__blockhashInputIndex');
      if (sym) sym.references.push({ name: '__internal__blockhashInputIndex' } as IdentifierNode);
      this.pushToStack(idxParam);
    }

    // External-library pre-scan: record which libraries the function calls and how many times, so codegen
    // loads each one's blob (side-car or inline) and the inline decision has call counts.
    const libraryCallCounts = this.countLibraryCalls(node.body);
    if (libraryCallCounts.size > 0) {
      node.usedLibraries = [...libraryCallCounts.keys()];
      node.libraryCallCounts = libraryCallCounts;
    }

    // Entry slot pre-scan: collect unique (collection, keyParam) pairs and assign slot indices
    if (this.collectionMap.size > 0) {
      this.collectLocalKeyDefs(node.body);
      const entryAccessMap = new Map<string, EntryAccessInfo>();
      this.collectEntryAccesses(node.body, entryAccessMap);

      if (entryAccessMap.size > 0) {
        // Assign slot indices with written entries (write / read-write / delete) before pure-read entries. A
        // pure-read slot at a LOWER index than a written slot desyncs the covenant vs the SDK: an absent read-only
        // entry emits no output-commitment verification, so the derivation's positional commitment extraction
        // (i-th commitment -> slot i) misassigns the written entry's commitment. Ordering writes first keeps the
        // written slots dense from index 0, matching extraction. Stable within each group (access order preserved).
        const infos = [...entryAccessMap.values()];
        const isWritten = (info: EntryAccessInfo): boolean => info.operations.includes('write')
          || info.operations.includes('delete');
        // A constant key only helps a pure READ (locate a non-arg entry to co-spend). A write/delete bakes the key
        // via the covenant + VM-probes the exact commitment (sign-byte-correct); resolving it SDK-side would mis-
        // encode high-bit uint256 keys. Downgrade constant->expression on any written access to keep that path.
        for (const info of infos) {
          if (!isWritten(info)) continue;
          info.keySources = info.keySources.map((ks) => (ks.kind === 'constant'
            ? { kind: 'expression' as const, canonical: ks.canonical } : ks));
        }
        const ordered = [...infos.filter(isWritten), ...infos.filter((i) => !isWritten(i))];
        let slotIndex = 0;
        for (const info of ordered) info.slotIndex = slotIndex++;

        node.entryAccesses = ordered;

        // Propagate slot indices to individual mapping nodes (looks up the shared info by key)
        this.assignEntrySlotIndices(node.body, entryAccessMap);

        this.detectAliasConditionalWrites(node.body, ordered);
      }
    }

    // Collection iteration pre-scan: collect all CollectionIterationNode instances and inject count params
    if (this.collectionMap.size > 0) {
      const collectionIterations: CollectionIterationInfo[] = [];
      this.collectCollectionIterations(node.body, collectionIterations);

      if (collectionIterations.length > 0) {
        node.collectionIterations = collectionIterations;

        for (let i = 0; i < collectionIterations.length; i++) {
          collectionIterations[i].iterationIndex = i;

          const countParam = new ParameterNode(PrimitiveType.BIGINT, `__internal__collectionIterCount_${i}`);
          countParam.location = node.location;
          node.parameters.push(countParam);
          this.symbolTables[0].set(Symbol.variable(countParam));
          const sym = this.symbolTables[0].get(`__internal__collectionIterCount_${i}`);
          if (sym) sym.references.push({ name: `__internal__collectionIterCount_${i}` } as IdentifierNode);
          this.pushToStack(countParam);
        }
      }
    }

    // External reads pre-scan: collect all external state/collection reads and assign slot indices
    {
      const externalReadMap = new Map<string, ExternalReadSlot>();
      this.collectExternalReads(node.body, externalReadMap);

      if (externalReadMap.size > 0) {
        let slotIndex = 0;
        for (const slot of externalReadMap.values()) {
          slot.slotIndex = slotIndex++;
        }
        node.externalReads = [...externalReadMap.values()];

        // Propagate slot indices to individual external read nodes
        this.assignExternalReadSlotIndices(node.body, externalReadMap);


      }
    }

    // External calls pre-scan: collect all external function call results and assign slot indices
    {
      const externalCallSlots: ExternalCallSlot[] = [];
      this.collectExternalCalls(node.body, externalCallSlots);

      if (externalCallSlots.length > 0) {
        // Assign slotIndex, computedOffset, and returnSlotIndex per slot
        let slotIndex = 0;
        let runningOffset = 0;
        let returnSlotIndex = 0;
        for (const slot of externalCallSlots) {
          slot.slotIndex = slotIndex++;
          slot.computedOffset = runningOffset;
          if (slot.hasReturnValues) {
            slot.returnSlotIndex = returnSlotIndex++;
          }
          // Next slot starts after this slot's master (1) + its data NFTs
          runningOffset += 1 + slot.requiredDataNftIndices.length;
        }
        node.externalCalls = externalCallSlots;

        // External-call address locals must survive to the epilogue: emitExternalCallVerification reads
        // slot.addressParam off the stack after the body, so a regular body use (e.g. `address(car).balance`
        // alongside `car.method()`) must not OP_ROLL-consume it. Same rationale as the token-container key params.
        for (const slot of externalCallSlots) {
          if (slot.addressParam && !slot.addressIsMsgSender) {
            node.opRolls.delete(slot.addressParam);
          }
        }

        // Propagate slot indices to individual external call nodes
        this.assignExternalCallSlotIndices(node.body, externalCallSlots, { idx: 0 });

        // _externalCallInputBase: kept as runtime param because in mutual calling (A<->B),
        // B's external call target may be at a position BEFORE B's master.
        const inputBaseParam = new ParameterNode(PrimitiveType.BIGINT, '__internal__externalCallInputBase');
        inputBaseParam.location = node.location;
        node.parameters.push(inputBaseParam);
        this.symbolTables[0].set(Symbol.variable(inputBaseParam));
        const inputBaseSymbol = this.symbolTables[0].get('__internal__externalCallInputBase');
        if (inputBaseSymbol) {
          inputBaseSymbol.references.push({ name: '__internal__externalCallInputBase' } as IdentifierNode);
        }
        this.pushToStack(inputBaseParam);

        // Inject per-slot selector parameters (only for slots that need selector verification). A varying-method
        // array dispatch table (selectorArrayVar) verifies each element against its ON-CHAIN selector array, so
        // it needs no witness param and no baked compile-time selector - exclude it here.
        const slotsNeedingSelector = externalCallSlots.filter((s) => s.needsSelectorVerification && !s.selectorArrayVar);
        const slotCount = node.externalCalls.length;
        for (let i = 0; i < slotCount; i++) {
          if (!externalCallSlots[i].needsSelectorVerification || externalCallSlots[i].selectorArrayVar) continue;
          const slot = externalCallSlots[i];
          // MD1: for a regular call (not a varying-method pointer) the target function is fixed at compile time,
          // so bake its selector as a constant the covenant checks against - a spender must not be able to point
          // the co-spend at a different method via the selector witness. Varying-method pointers keep the runtime
          // selector (bound to `cond`).
          if (!slot.runtimeSelector) {
            const iface = this.interfaceMap.get(slot.interfaceName);
            const ifaceFunc = iface && this.getAllInterfaceFunctions(iface).find((f) => f.name === slot.functionName);
            if (ifaceFunc) {
              const sig = computeFunctionSignature(slot.functionName, ifaceFunc.parameters.map((p) => p.type.toString()));
              slot.compileTimeSelector = computeFunctionSelector(sig);
            }
          }
          // Backward compat: single slot uses '__internal__externalCallSelector', multiple use indexed names
          const selectorName = slotsNeedingSelector.length === 1
            ? '__internal__externalCallSelector'
            : `__internal__externalCallSelector${i}`;
          const selectorParam = new ParameterNode(new BytesType(4), selectorName);
          selectorParam.location = node.location;
          node.parameters.push(selectorParam);
          this.symbolTables[0].set(Symbol.variable(selectorParam));
          const selectorSymbol = this.symbolTables[0].get(selectorName);
          if (selectorSymbol) {
            selectorSymbol.references.push({ name: selectorName } as IdentifierNode);
          }
          this.pushToStack(selectorParam);
        }

        // Per-call absolute master-input-index param the SDK fills from the real callee layout it co-spends.
        // Needed for: (a) foreign fn-ptr calls (callee data-NFT count unknown at compile time); (b) EVERY slot
        // in a MULTI-call function - a prior call's callee data-NFT count (from a possibly under-declared
        // interface) can shift this slot's fixed block offset, so the runtime index makes the covenant read the
        // right co-spent callee regardless. Single-call functions keep the fixed offset (0, always correct).
        // Loop slots (array-element dispatch) compute a per-iteration index and are excluded. A function that
        // contains ANY loop slot keeps the fixed offset for its non-loop slots too (the SDK expands a loop slot
        // into N co-spend groups, so a runtime per-slot fill cannot be aligned 1:1); the multi-call runtime
        // index applies only to loop-free functions, counting non-loop slots.
        const hasLoopSlot = externalCallSlots.some((s) => s.loopArrayVar || s.inlineLoopDispatch);
        const nonLoopSlotCount = externalCallSlots
          .filter((s) => !s.loopArrayVar && !s.inlineLoopDispatch).length;
        for (let i = 0; i < slotCount; i++) {
          const slot = externalCallSlots[i];
          if (slot.loopArrayVar || slot.inlineLoopDispatch) {
            // A received-value fn-ptr ARRAY loop (fnPtrCall): the callee layouts are unknown at compile time,
            // so the loop reads each element's callee master input index from ONE SDK-filled witness list
            // (framed ints), each identity-verified against arr[i] - the list analogue of extcallMasterIdx.
            if (slot.loopArrayVar && slot.fnPtrCall) {
              const listName = `__internal__extcallIdxList${slot.slotIndex}`;
              const listParam = new ParameterNode(new BytesType(), listName);
              listParam.location = node.location;
              node.parameters.push(listParam);
              this.symbolTables[0].set(Symbol.variable(listParam));
              const listSymbol = this.symbolTables[0].get(listName);
              if (listSymbol) listSymbol.references.push({ name: listName } as IdentifierNode);
              this.pushToStack(listParam);
            }
            continue;
          }
          if (!slot.fnPtrCall && (hasLoopSlot || nonLoopSlotCount <= 1)) continue;
          const idxName = `__internal__extcallMasterIdx${slot.slotIndex}`;
          const idxParam = new ParameterNode(PrimitiveType.BIGINT, idxName);
          idxParam.location = node.location;
          node.parameters.push(idxParam);
          this.symbolTables[0].set(Symbol.variable(idxParam));
          const idxSymbol = this.symbolTables[0].get(idxName);
          if (idxSymbol) idxSymbol.references.push({ name: idxName } as IdentifierNode);
          this.pushToStack(idxParam);
        }
      }
    }

    // External outState reads pre-scan: collect all output state reads and assign slot indices
    {
      const externalOutStateMap = new Map<string, ExternalOutStateSlot>();
      this.collectExternalOutStateReads(node.body, externalOutStateMap);

      if (externalOutStateMap.size > 0) {
        let slotIndex = 0;
        for (const slot of externalOutStateMap.values()) {
          slot.slotIndex = slotIndex++;
        }

        // Detect overlap with external call slots: if an outState read targets the
        // same interface+addressParam as an external call, share the call's UTXO group
        let allShared = true;
        if (node.externalCalls && node.externalCalls.length > 0) {
          for (const osSlot of externalOutStateMap.values()) {
            const matchingCallSlot = node.externalCalls.find(
              (cs) => cs.interfaceName === osSlot.interfaceName
                && cs.addressParam === osSlot.addressParam,
            );
            if (matchingCallSlot) {
              osSlot.sharedWithCallSlotIndex = matchingCallSlot.slotIndex;
            } else {
              allShared = false;
            }
          }
        } else {
          allShared = false;
        }

        node.externalOutStateReads = [...externalOutStateMap.values()];

        // Propagate slot indices to individual outState access nodes
        this.assignExternalOutStateSlotIndices(node.body, externalOutStateMap);

        // Only inject _externalOutStateInputBase if not ALL outState reads are shared with calls
        if (!allShared) {
          const inputBaseParam = new ParameterNode(PrimitiveType.BIGINT, '__internal__externalOutStateInputBase');
          inputBaseParam.location = node.location;
          node.parameters.push(inputBaseParam);
          this.symbolTables[0].set(Symbol.variable(inputBaseParam));
          const inputBaseSymbol = this.symbolTables[0].get('__internal__externalOutStateInputBase');
          if (inputBaseSymbol) {
            inputBaseSymbol.references.push({ name: '__internal__externalOutStateInputBase' } as IdentifierNode);
          }
          this.pushToStack(inputBaseParam);
        }
      }
    }

    // B-side: inject _returnOutputIdx for functions with return types that are entry points
    if (node.returnTypes.length > 0 && node.isEntryPoint) {
      const returnOutputIdxParam = new ParameterNode(PrimitiveType.BIGINT, '__internal__returnOutputIdx');
      returnOutputIdxParam.location = node.location;
      node.parameters.push(returnOutputIdxParam);
      this.symbolTables[0].set(Symbol.variable(returnOutputIdxParam));
      const returnOutputIdxSymbol = this.symbolTables[0].get('__internal__returnOutputIdx');
      if (returnOutputIdxSymbol) {
        returnOutputIdxSymbol.references.push({ name: '__internal__returnOutputIdx' } as IdentifierNode);
      }
      this.pushToStack(returnOutputIdxParam);
    }

    // A-side: inject per-slot _externalReturnOutputIdx for functions that make external calls with return values
    if (node.externalCalls) {
      const returningSlots = node.externalCalls.filter((ec) => ec.hasReturnValues);
      for (const slot of returningSlots) {
        // Backward compat: single returning slot uses '__internal__externalReturnOutputIdx', multiple use indexed names
        const paramName = returningSlots.length === 1
          ? '__internal__externalReturnOutputIdx'
          : `__internal__externalReturnOutputIdx${slot.returnSlotIndex}`;
        const returnOutputIdxParam = new ParameterNode(PrimitiveType.BIGINT, paramName);
        returnOutputIdxParam.location = node.location;
        node.parameters.push(returnOutputIdxParam);
        this.symbolTables[0].set(Symbol.variable(returnOutputIdxParam));
        const returnOutputIdxSymbol = this.symbolTables[0].get(paramName);
        if (returnOutputIdxSymbol) {
          returnOutputIdxSymbol.references.push({ name: paramName } as IdentifierNode);
        }
        this.pushToStack(returnOutputIdxParam);
      }
    }

    // Token container access pre-scan: collect all token container accesses and assign slot indices
    if (this.isStatefulContract) {
      const tokenContainerAccessMap = new Map<string, TokenContainerAccessInfo>();
      this.collectTokenContainerAccesses(node.body, tokenContainerAccessMap);

      if (tokenContainerAccessMap.size > 0) {
        let slotIndex = 0;
        for (const info of tokenContainerAccessMap.values()) {
          info.slotIndex = slotIndex++;
        }
        node.tokenContainerAccesses = [...tokenContainerAccessMap.values()];

        // Propagate slot indices to individual nodes
        this.assignTokenContainerSlotIndices(node.body, tokenContainerAccessMap);

        // Prevent OP_ROLL optimization for token container key parameters:
        // The code generator needs these params on the stack during
        // covenant verification (after the function body), so they
        // must not be consumed by OP_ROLL during the body.
        for (const info of tokenContainerAccessMap.values()) {
          node.opRolls.delete(info.keyParam);
        }

      }
    }

    // Transfer statement pre-scan: collect all transfer statements and assign sequential indices
    {
      const transferInfos: TransferInfo[] = [];
      this.collectTransferStatements(node.body, transferInfos);

      if (transferInfos.length > 0) {
        // Stateful: transfers occupy block-layout output slots (input-index relative). Stateless (no state):
        // no block, so transfer outputs are verified at absolute indices [0, N) and the value comes from the
        // input being spent (no satoshi container). Record them either way; the codegen branches on layout.
        node.transferInfos = transferInfos;
      }
    }

    // Token container transfer pre-scan: assign sequential transfer indices (handles branches)
    if (node.tokenContainerAccesses && node.tokenContainerAccesses.some((da) => da.operations.includes('transfer') || da.operations.includes('transferNft'))) {
      this.collectTokenContainerTransferStatements(node.body, { counter: 0 });
    }


    // Emit statement pre-scan: collect all emit statements and assign sequential indices
    if (this.eventMap.size > 0) {
      const emitInfos: EmitInfo[] = [];
      this.collectEmitStatements(node.body, emitInfos, 0);

      if (emitInfos.length > 0) {
        // Update emitIndex for each collected emit
        emitInfos.forEach((info, idx) => { info.emitIndex = idx; });
        node.emitInfos = emitInfos;

      }
    }


    // Low-level call pre-scan: count LowLevelCallNode/LowLevelCallStatementNode and inject _callInputIndex parameters
    {
      const lowLevelCallCount = this.countLowLevelCalls(node.body);
      if (lowLevelCallCount > 0) {
        // Initialize lowLevelCalls array with placeholders BEFORE assigning indices
        node.lowLevelCalls = [];
        for (let i = 0; i < lowLevelCallCount; i++) {
          node.lowLevelCalls.push({ callMode: 'call' }); // placeholder, updated during assignment
        }

        // Assign sequential callIndex to each low-level call node (updates callMode in array)
        this.assignLowLevelCallIndices(node.body, { counter: 0 });

        // Inject _callInputIndex parameter(s) - only for non-stateful contracts.
        // Stateful contracts use block layout offsets instead.
        // Skip delegatecall (proxy doesn't verify delegate's calldata).
        if (this.isStatefulContract) {
          // Block layout provides the offset - no _callInputIndex needed
        } else for (let i = 0; i < lowLevelCallCount; i++) {
          if (node.lowLevelCalls![i].callMode === 'delegatecall') continue;
          const paramName = lowLevelCallCount === 1 ? '__internal__callInputIndex' : `__internal__callInputIndex${i}`;
          const param = new ParameterNode(PrimitiveType.BIGINT, paramName);
          param.location = node.location;
          node.parameters.push(param);
          this.symbolTables[0].set(Symbol.variable(param));
          const sym = this.symbolTables[0].get(paramName);
          if (sym) sym.references.push({ name: paramName } as IdentifierNode);
          this.pushToStack(param);
        }
      }
    }

    // delegate + delegatecall is invalid: if a delegate function contains delegatecall calls,
    // the functionHasDelegatecall codegen path skips all state covenant checks AND
    // emitDelegateSelfPreservation, leaving the contract unprotected.
    if (node.modifiers.includes(FunctionModifier.DELEGATE)
      && node.lowLevelCalls?.some((llc) => llc.callMode === 'delegatecall')) {
      throw new InvalidModifierCombinationError(node, "'delegate' functions cannot contain delegatecall calls");
    }

    // C1/piece-3: a delegatecall FORCES + PINS its delegate co-spend. Inject a witness for the delegate's input
    // index; codegen verifies OP_UTXOBYTECODE[idx] == impl so the delegate is required, not optional. Emitted
    // only when impl is NOT the classic P2PKH-placeholder literal (a real delegate is a P2SH covenant); a P2PKH
    // impl keeps the C1 warning path (a P2PKH UTXO authorizes nothing, so pinning it would be unsound anyway).
    if (this.hasExplicitDelegatecall(node.body) && !this.delegatecallTargetsP2pkhLiteral(node.body)) {
      node.pinsDelegateCoSpend = true;
      const idxParam = new ParameterNode(PrimitiveType.BIGINT, '__internal__delegateInputIndex');
      idxParam.location = node.location;
      node.parameters.push(idxParam);
      this.symbolTables[0].set(Symbol.variable(idxParam));
      const s = this.symbolTables[0].get('__internal__delegateInputIndex');
      if (s) s.references.push({ name: '__internal__delegateInputIndex' } as IdentifierNode);
      this.pushToStack(idxParam);
    }

    // C1/B: a delegatecall function skips its own state covenant (emitAutoCovenantVerification is gated
    // !functionHasDelegatecall) and defers ALL state writes to the co-spent delegate, so any self state-write in
    // it is unauthorized. Reject it - the delegate must own every proxy write. (Library-call sugar is excluded;
    // its writes ARE the delegate mechanism.)
    if (this.hasExplicitDelegatecall(node.body) && this.hasStateWrite(node.body)) {
      throw new DelegatecallSelfMutationError(node, node.name);
    }

    // C1: a delegatecall against a P2PKH-placeholder impl is NOT pinned (pinsDelegateCoSpend is false), so the
    // proxy cannot force the delegate to be co-spent - ANY spender then co-spends the state NFT and rewrites
    // proxy state arbitrarily. Warn unless the function is pinned (a covenant impl, where the co-spend is forced
    // - see piece 3) or already signature-gated. Library-call sugar is excluded (its own layout/brand guards).
    if (this.hasExplicitDelegatecall(node.body) && !node.pinsDelegateCoSpend && !this.hasSignatureGuard(node.body)) {
      const line = node.location?.start?.line ? ` (line ${node.location.start.line})` : '';
      console.log(
        `Warning: function '${node.name}'${line} issues delegatecall against a non-covenant (P2PKH) impl, so the `
        + 'delegate co-spend cannot be pinned and ANY spender can rewrite proxy state arbitrarily (SECURITY-AUDIT '
        + 'C1). Use the delegate contract\'s real (covenant) address so the co-spend is forced, or gate this '
        + 'function with a signature check. See packages/solidc/docs/delegatecall-security.md.',
      );
    }



    // Inject _proxyMasterIndex for delegate functions
    if (node.modifiers.includes(FunctionModifier.DELEGATE)) {
      const param = new ParameterNode(PrimitiveType.BIGINT, '__internal__proxyMasterIndex');
      param.location = node.location;
      node.parameters.push(param);
      this.symbolTables[0].set(Symbol.variable(param));
      const sym = this.symbolTables[0].get('__internal__proxyMasterIndex');
      if (sym) sym.references.push({ name: '__internal__proxyMasterIndex' } as IdentifierNode);
      this.pushToStack(param);
    }

    // Compute 1:1 block layout for stateful entry-point functions.
    if (this.isStatefulContract && node.isEntryPoint) {
      node.blockLayout = this.computeBlockLayout(node);
    }

    // Prevent OP_ROLL optimization for split/merge count parameters:
    // The code generator needs these params on the stack during covenant verification.
    if (node.splitCountParam) {
      node.opRolls.delete(node.splitCountParam);
    }
    if (node.mergeCountParam) {
      node.opRolls.delete(node.mergeCountParam);
    }

    // Post-body validation for restricted modifiers (unsafe(1), unsafe(2), split, merge)
    // These modifiers forbid state writes, entries, events, transfers, containers, external calls, deploy
    const isRestrictedUnsafe = node.modifiers.includes(FunctionModifier.UNSAFE)
      && (node.unsafeTier === 1 || node.unsafeTier === 2);
    const isSplit = node.modifiers.includes(FunctionModifier.SPLIT);
    const isMerge = node.modifiers.includes(FunctionModifier.MERGE);
    if (isRestrictedUnsafe || isSplit || isMerge) {
      const modLabel = isSplit ? "'split'" : isMerge ? "'merge'" : `'unsafe(${node.unsafeTier})'`;
      const hasStateWrites = this.bodyContainsStateWrites(node.body);
      if (hasStateWrites) {
        throw new InvalidModifierCombinationError(node, `${modLabel} functions cannot write state`);
      }
      if (node.entryAccesses && node.entryAccesses.length > 0) {
        throw new InvalidModifierCombinationError(node, `${modLabel} functions cannot access entries`);
      }
      if (node.emitInfos && node.emitInfos.length > 0) {
        throw new InvalidModifierCombinationError(node, `${modLabel} functions cannot emit events`);
      }
      if (node.transferInfos && node.transferInfos.length > 0) {
        throw new InvalidModifierCombinationError(node, `${modLabel} functions cannot use transfers`);
      }
      if (node.tokenContainerAccesses && node.tokenContainerAccesses.length > 0) {
        throw new InvalidModifierCombinationError(node, `${modLabel} functions cannot access token containers`);
      }
      if (node.externalCalls && node.externalCalls.length > 0) {
        throw new InvalidModifierCombinationError(node, `${modLabel} functions cannot make external calls`);
      }
      if (node.externalReads && node.externalReads.length > 0) {
        throw new InvalidModifierCombinationError(node, `${modLabel} functions cannot make external reads`);
      }
      if (node.deployTargets && node.deployTargets.length > 0) {
        throw new InvalidModifierCombinationError(node, `${modLabel} functions cannot deploy contracts`);
      }
      if (node.externalOutStateReads && node.externalOutStateReads.length > 0) {
        throw new InvalidModifierCombinationError(node, `${modLabel} functions cannot read external output state`);
      }
    }

    const unusedSymbols = node.symbolTable.unusedSymbols();
    for (const unused of unusedSymbols) {
      // Solidity only warns on unused vars/params and never fails the compile; match that.
      const uloc = unused.definition?.location ? ` at line ${unused.definition.location.start.line}` : '';
      console.log(`Warning: unused variable '${unused.name}'${uloc}.`);
    }

    this.symbolTables.shift();
    return node;
  }

  private collectTransferStatements(node: Node, transferInfos: TransferInfo[]): void {
    if (node instanceof TransferStatementNode || node instanceof AddressTransferStatementNode) {
      const transferIndex = transferInfos.length;
      node.transferIndex = transferIndex;
      transferInfos.push({ transferIndex });
      return;
    }
    if (node instanceof AddressSendExpressionNode) {
      const transferIndex = transferInfos.length;
      node.transferIndex = transferIndex;
      transferInfos.push({ transferIndex });
      return;
    }
    // {value: X} call option on low-level call statement
    if (node instanceof LowLevelCallStatementNode && node.callOptions?.value) {
      node.valueTransferIndex = transferInfos.length;
      transferInfos.push({ transferIndex: node.valueTransferIndex });
      // Don't return - child expressions may contain transfers too
    }
    // {value: X} call option on MethodCallStatementNode (pre-transformation)
    if (node instanceof MethodCallStatementNode && node.call.callOptions?.value) {
      node.call.valueTransferIndex = transferInfos.length;
      transferInfos.push({ transferIndex: node.call.valueTransferIndex });
    }
    // For branches: walk the longer branch to create entries, shorter to assign indices
    if (node instanceof BranchNode && node.branchOps && node.branchOps.transferCount > 0) {
      const startIndex = transferInfos.length;
      const ifIsLonger = node.branchOps.ifTransferCount >= node.branchOps.transferCount - node.branchOps.ifTransferCount;
      if (ifIsLonger || !node.elseBlock) {
        this.collectTransferStatements(node.ifBlock, transferInfos);
        if (node.elseBlock) {
          this.assignTransferIndices(node.elseBlock, startIndex);
        }
      } else {
        this.collectTransferStatements(node.elseBlock!, transferInfos);
        this.assignTransferIndices(node.ifBlock, startIndex);
      }
      return;
    }
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.collectTransferStatements(stmt, transferInfos);
      }
    }
    if ('body' in node && (node as any).body) {
      this.collectTransferStatements((node as any).body, transferInfos);
    }
    if ('block' in node && (node as any).block) {
      this.collectTransferStatements((node as any).block, transferInfos);
    }
    // Scan expressions for AddressSendExpressionNode and InstantiationNode with value
    if (node instanceof VariableDefinitionNode) {
      if (node.expression) this.collectTransferStatements(node.expression, transferInfos);
    }
    // Contract deployment with {value}: new Contract{value: x}(args)
    if (node instanceof InstantiationNode && node.callOptions?.value
        && this.contractMap.has(node.identifier.name)) {
      const transferIndex = transferInfos.length;
      node.transferIndex = transferIndex;
      transferInfos.push({ transferIndex });
      return;
    }
  }

  /**
   * Assign transfer indices to the shorter branch, reusing the same
   * starting index as the longer branch.
   */
  private assignTransferIndices(node: Node, startIndex: number): number {
    if (node instanceof TransferStatementNode || node instanceof AddressTransferStatementNode) {
      node.transferIndex = startIndex;
      return startIndex + 1;
    }
    if (node instanceof AddressSendExpressionNode) {
      node.transferIndex = startIndex;
      return startIndex + 1;
    }
    if (node instanceof LowLevelCallStatementNode && node.callOptions?.value) {
      node.valueTransferIndex = startIndex;
      return startIndex + 1;
    }
    if (node instanceof MethodCallStatementNode && node.call.callOptions?.value) {
      node.call.valueTransferIndex = startIndex;
      return startIndex + 1;
    }
    if (node instanceof InstantiationNode && node.callOptions?.value
        && this.contractMap.has(node.identifier.name)) {
      node.transferIndex = startIndex;
      return startIndex + 1;
    }
    if (node instanceof BranchNode && node.branchOps && node.branchOps.transferCount > 0) {
      const localStart = startIndex;
      startIndex = this.assignTransferIndices(node.ifBlock, startIndex);
      if (node.elseBlock) {
        this.assignTransferIndices(node.elseBlock, localStart);
      }
      return startIndex;
    }
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        startIndex = this.assignTransferIndices(stmt, startIndex);
      }
    }
    if ('body' in node && (node as any).body) {
      startIndex = this.assignTransferIndices((node as any).body, startIndex);
    }
    if ('block' in node && (node as any).block) {
      startIndex = this.assignTransferIndices((node as any).block, startIndex);
    }
    return startIndex;
  }

  private collectEmitStatements(node: Node, emitInfos: EmitInfo[], emitIndex: number): number {
    if (node instanceof EmitStatementNode) {
      // Use linked definition if resolved, otherwise use candidates for worst-case chunk count
      const eventDef = node.eventDefinition;
      const candidates = node.eventCandidates;
      if (eventDef || (candidates && candidates.length > 0)) {
        let chunkCount: number;
        let eventSignature: string;
        if (eventDef) {
          const maxSize = eventDef.parameters.reduce(
            (sum, p) => sum + getMaxPushdataEncodedSizeForType(p.type), 0,
          );
          chunkCount = maxSize > 128 ? Math.ceil(maxSize / 128) : 1;
          eventSignature = eventDef.signature;
        } else {
          // Use max chunk count across all candidates (resolution deferred to TypeCheck)
          chunkCount = Math.max(...candidates!.map((c) => {
            const maxSize = c.parameters.reduce(
              (sum, p) => sum + getMaxPushdataEncodedSizeForType(p.type), 0,
            );
            return maxSize > 128 ? Math.ceil(maxSize / 128) : 1;
          }));
          eventSignature = ''; // will be resolved after TypeCheck
        }
        node.emitIndex = emitIndex;
        emitInfos.push({ eventName: node.eventName, eventSignature, emitIndex, chunkCount });
        return emitIndex + chunkCount;
      }
    }
    // For branches: walk the longer branch to create entries, shorter to assign indices
    if (node instanceof BranchNode && node.branchOps && node.branchOps.emitCount > 0) {
      const startIndex = emitIndex;
      const ifIsLonger = node.branchOps.ifEmitCount >= node.branchOps.emitCount - node.branchOps.ifEmitCount;
      if (ifIsLonger || !node.elseBlock) {
        emitIndex = this.collectEmitStatements(node.ifBlock, emitInfos, emitIndex);
        if (node.elseBlock) {
          this.assignEmitIndices(node.elseBlock, startIndex);
        }
      } else {
        emitIndex = this.collectEmitStatements(node.elseBlock!, emitInfos, emitIndex);
        this.assignEmitIndices(node.ifBlock, startIndex);
      }
      return emitIndex;
    }
    // try/catch: only the try block is compiled (a failed co-spent call/deploy aborts the whole tx, so the catch
    // is unreachable and codegen ignores it - see branchOps / collectEmitIndices). Allocate slots for its emits.
    if (node instanceof TryCatchNode) {
      return this.collectEmitStatements(node.tryBlock, emitInfos, emitIndex);
    }
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        emitIndex = this.collectEmitStatements(stmt, emitInfos, emitIndex);
      }
    }
    if ('body' in node && (node as any).body) {
      emitIndex = this.collectEmitStatements((node as any).body, emitInfos, emitIndex);
    }
    if ('block' in node && (node as any).block) {
      emitIndex = this.collectEmitStatements((node as any).block, emitInfos, emitIndex);
    }
    return emitIndex;
  }

  /**
   * Assign emit indices to the else-block of a branch, reusing the same
   * starting index as the if-block.
   */
  private assignEmitIndices(node: Node, startIndex: number): number {
    if (node instanceof EmitStatementNode) {
      node.emitIndex = startIndex;
      return startIndex + 1;
    }
    if (node instanceof BranchNode && node.branchOps && node.branchOps.emitCount > 0) {
      const localStart = startIndex;
      startIndex = this.assignEmitIndices(node.ifBlock, startIndex);
      if (node.elseBlock) {
        this.assignEmitIndices(node.elseBlock, localStart);
      }
      return startIndex;
    }
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        startIndex = this.assignEmitIndices(stmt, startIndex);
      }
    }
    if ('body' in node && (node as any).body) {
      startIndex = this.assignEmitIndices((node as any).body, startIndex);
    }
    if ('block' in node && (node as any).block) {
      startIndex = this.assignEmitIndices((node as any).block, startIndex);
    }
    return startIndex;
  }

  /**
   * Pre-assign sequential transfer indices to TokenContainerMethodStatementNode nodes.
   * Handles branches by assigning the same indices to both arms.
   */
  private collectTokenContainerTransferStatements(node: Node, state: { counter: number }): void {
    if (node instanceof TokenContainerMethodStatementNode) {
      node.transferIndex = state.counter++;
      return;
    }
    if (node instanceof BranchNode && node.branchOps && node.branchOps.tokenContainerTransferCount > 0) {
      const startIndex = state.counter;
      const ifIsLonger = node.branchOps.ifTokenContainerTransferCount
        >= node.branchOps.tokenContainerTransferCount - node.branchOps.ifTokenContainerTransferCount;
      if (ifIsLonger || !node.elseBlock) {
        this.collectTokenContainerTransferStatements(node.ifBlock, state);
        if (node.elseBlock) {
          const elseState = { counter: startIndex };
          this.collectTokenContainerTransferStatements(node.elseBlock, elseState);
        }
      } else {
        this.collectTokenContainerTransferStatements(node.elseBlock!, state);
        const ifState = { counter: startIndex };
        this.collectTokenContainerTransferStatements(node.ifBlock, ifState);
      }
      return;
    }
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.collectTokenContainerTransferStatements(stmt, state);
      }
    }
    if ('body' in node && (node as any).body) {
      this.collectTokenContainerTransferStatements((node as any).body, state);
    }
    if ('block' in node && (node as any).block) {
      this.collectTokenContainerTransferStatements((node as any).block, state);
    }
  }

  /**
   * Count the total number of low-level call nodes (LowLevelCallNode + LowLevelCallStatementNode)
   * in the function body.
   */
  private countLowLevelCalls(node: Node): number {
    let count = 0;
    if (node instanceof LowLevelCallNode || node instanceof LowLevelCallStatementNode) {
      return 1;
    }
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        count += this.countLowLevelCalls(stmt);
      }
    }
    if ('body' in node && (node as any).body) {
      count += this.countLowLevelCalls((node as any).body);
    }
    if ('block' in node && (node as any).block) {
      count += this.countLowLevelCalls((node as any).block);
    }
    // Handle expression-level LowLevelCallNode in variable definitions, tuple assignments, etc.
    if (node instanceof VariableDefinitionNode) {
      if (node.expression) count += this.countLowLevelCalls(node.expression);
    }
    if (node instanceof TupleAssignmentNode) {
      if (node.tupleExpressions) {
        for (const e of node.tupleExpressions) count += this.countLowLevelCalls(e);
      } else {
        count += this.countLowLevelCalls(node.tuple);
      }
    }
    if (node instanceof BranchNode) {
      count += this.countLowLevelCalls(node.ifBlock);
      if (node.elseBlock) count += this.countLowLevelCalls(node.elseBlock);
    }
    return count;
  }

  /**
   * Assign sequential callIndex to each LowLevelCallNode / LowLevelCallStatementNode,
   * and update the function's lowLevelCalls metadata with the actual callMode.
   */
  private assignLowLevelCallIndices(node: Node, state: { counter: number }): void {
    if (node instanceof LowLevelCallNode || node instanceof LowLevelCallStatementNode) {
      node.callIndex = state.counter;
      if (this.currentFunction.lowLevelCalls) {
        // Resolve the data expression to a parameter index when possible.
        // This lets the SDK know which function argument is the payload so it
        // can prepend it to the target's unlocking bytecode for P2SH32 targets.
        let dataParamIndex: number | undefined;
        if (node.data instanceof IdentifierNode) {
          const visibleParams = this.currentFunction.parameters
            .filter((p) => !p.name.startsWith('__internal__'));
          dataParamIndex = visibleParams.findIndex((p) => p.name === (node.data as IdentifierNode).name);
          if (dataParamIndex === -1) dataParamIndex = undefined;
        }
        this.currentFunction.lowLevelCalls[state.counter] = {
          callMode: node.callMode,
          ...(dataParamIndex !== undefined && { dataParamIndex }),
        };
      }
      state.counter++;
      return;
    }
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.assignLowLevelCallIndices(stmt, state);
      }
    }
    if ('body' in node && (node as any).body) {
      this.assignLowLevelCallIndices((node as any).body, state);
    }
    if ('block' in node && (node as any).block) {
      this.assignLowLevelCallIndices((node as any).block, state);
    }
    if (node instanceof VariableDefinitionNode) {
      if (node.expression) this.assignLowLevelCallIndices(node.expression, state);
    }
    if (node instanceof TupleAssignmentNode) {
      if (node.tupleExpressions) {
        for (const e of node.tupleExpressions) this.assignLowLevelCallIndices(e, state);
      } else {
        this.assignLowLevelCallIndices(node.tuple, state);
      }
    }
    if (node instanceof BranchNode) {
      this.assignLowLevelCallIndices(node.ifBlock, state);
      if (node.elseBlock) this.assignLowLevelCallIndices(node.elseBlock, state);
    }
  }

  private validateModifiers(node: FunctionDefinitionNode, contract: ContractNode): void {
    const mods = node.modifiers;
    if (mods.length === 0) return;

    // Check for duplicate modifiers
    const seen = new Set<FunctionModifier>();
    for (const mod of mods) {
      if (seen.has(mod)) {
        throw new InvalidModifierCombinationError(node, `duplicate modifier '${mod}'`);
      }
      seen.add(mod);
    }

    // virtual is a no-op: all inherited functions are implicitly virtual in SolidCash
    if (mods.includes(FunctionModifier.VIRTUAL)) {
      const loc = node.location ? ` at line ${node.location.start.line}` : '';
      console.log(`Warning: 'virtual' function modifier is a no-op in SolidCash${loc}. All inherited functions are implicitly virtual.`);
    }

    // At most one visibility modifier
    const visibilityMods = mods.filter((m) => [
      FunctionModifier.INTERNAL, FunctionModifier.EXTERNAL,
      FunctionModifier.PUBLIC, FunctionModifier.PRIVATE,
    ].includes(m));
    if (visibilityMods.length > 1) {
      throw new InvalidModifierCombinationError(node, 'at most one visibility modifier allowed');
    }

    // pure and view are mutually exclusive
    if (mods.includes(FunctionModifier.PURE) && mods.includes(FunctionModifier.VIEW)) {
      throw new InvalidModifierCombinationError(node, "'pure' and 'view' are mutually exclusive");
    }

    // unsafe + pure is invalid
    if (mods.includes(FunctionModifier.UNSAFE) && mods.includes(FunctionModifier.PURE)) {
      throw new InvalidModifierCombinationError(node, "'unsafe' and 'pure' are mutually exclusive");
    }

    // unsafe + view is invalid
    if (mods.includes(FunctionModifier.UNSAFE) && mods.includes(FunctionModifier.VIEW)) {
      throw new InvalidModifierCombinationError(node, "'unsafe' and 'view' are mutually exclusive");
    }

    // unsafe is only meaningful in stateful contracts
    const isStatefulContract = contract.stateVariables.length > 0
      || contract.collections.length > 0
      || contract.eventDefinitions.length > 0
      || contract.usesBlockhash
      || (this.compilerOptions.forceStateful ?? false);
    if (mods.includes(FunctionModifier.UNSAFE) && !isStatefulContract) {
      throw new InvalidModifierCombinationError(node, "'unsafe' is only valid in stateful contracts");
    }

    // Validate unsafe tier
    if (mods.includes(FunctionModifier.UNSAFE)) {
      const tier = node.unsafeTier ?? 0;
      if (tier !== 0 && tier !== 1 && tier !== 2) {
        throw new InvalidModifierCombinationError(node, `invalid unsafe tier '${tier}': must be 0, 1, or 2`);
      }
      const loc = node.location ? ` at ${node.location.start.line}:${node.location.start.column}` : '';
      if (tier === 0) {
        console.log(
          `Warning: 'unsafe' modifier on function '${node.name}'${loc} disables ALL covenant protections, `
          + 'including minting NFT uniqueness and state write verification. '
          + 'The minting NFT can be stolen or duplicated, permanently bricking the contract. '
          + 'State variables can be set to arbitrary values by anyone who can satisfy the require() guards. '
          + 'A logic error could lead to total loss of funds and contract ownership. '
          + 'Consider unsafe(1) to preserve master NFT and minting uniqueness.',
        );
      } else {
        console.log(
          `Warning: 'unsafe(${tier})' modifier on function '${node.name}'${loc} disables some covenant protections. `
          + `Tier ${tier} preserves: master NFT, minting uniqueness${tier >= 2 ? ', value' : ''}. `
          + 'State writes, entries, events, transfers, containers, external calls, and deploy are forbidden.',
        );
      }
    }

    // upgrade is only meaningful in stateful contracts
    if (mods.includes(FunctionModifier.UPGRADE) && !isStatefulContract) {
      throw new InvalidModifierCombinationError(node, "'upgrade' is only valid in stateful contracts");
    }

    // upgrade + unsafe is invalid (upgrade relaxes bytecode check only; unsafe skips all checks)
    if (mods.includes(FunctionModifier.UPGRADE) && mods.includes(FunctionModifier.UNSAFE)) {
      throw new InvalidModifierCombinationError(node, "'upgrade' and 'unsafe' are mutually exclusive");
    }

    // upgrade + pure is invalid (upgrade is inherently state-changing)
    if (mods.includes(FunctionModifier.UPGRADE) && mods.includes(FunctionModifier.PURE)) {
      throw new InvalidModifierCombinationError(node, "'upgrade' and 'pure' are mutually exclusive");
    }

    // upgrade + view is invalid
    if (mods.includes(FunctionModifier.UPGRADE) && mods.includes(FunctionModifier.VIEW)) {
      throw new InvalidModifierCombinationError(node, "'upgrade' and 'view' are mutually exclusive");
    }

    // upgrade + internal/private is invalid (upgrade must be externally callable)
    if (mods.includes(FunctionModifier.UPGRADE) && mods.includes(FunctionModifier.INTERNAL)) {
      throw new InvalidModifierCombinationError(node, "'upgrade' functions must be externally callable");
    }
    if (mods.includes(FunctionModifier.UPGRADE) && mods.includes(FunctionModifier.PRIVATE)) {
      throw new InvalidModifierCombinationError(node, "'upgrade' functions must be externally callable");
    }

    // deploy is only meaningful in stateful contracts
    if (mods.includes(FunctionModifier.DEPLOY) && !isStatefulContract) {
      throw new InvalidModifierCombinationError(node, "'deploy' is only valid in stateful contracts");
    }

    // deploy + unsafe is invalid (deploy needs covenant checks for factory preservation)
    if (mods.includes(FunctionModifier.DEPLOY) && mods.includes(FunctionModifier.UNSAFE)) {
      throw new InvalidModifierCombinationError(node, "'deploy' and 'unsafe' are mutually exclusive");
    }

    // deploy + pure is invalid (deploy is inherently state-changing)
    if (mods.includes(FunctionModifier.DEPLOY) && mods.includes(FunctionModifier.PURE)) {
      throw new InvalidModifierCombinationError(node, "'deploy' and 'pure' are mutually exclusive");
    }

    // deploy + view is invalid
    if (mods.includes(FunctionModifier.DEPLOY) && mods.includes(FunctionModifier.VIEW)) {
      throw new InvalidModifierCombinationError(node, "'deploy' and 'view' are mutually exclusive");
    }

    // deploy + internal/private is invalid (deploy must be externally callable)
    if (mods.includes(FunctionModifier.DEPLOY) && mods.includes(FunctionModifier.INTERNAL)) {
      throw new InvalidModifierCombinationError(node, "'deploy' functions must be externally callable");
    }
    if (mods.includes(FunctionModifier.DEPLOY) && mods.includes(FunctionModifier.PRIVATE)) {
      throw new InvalidModifierCombinationError(node, "'deploy' functions must be externally callable");
    }

    // deploy + upgrade is invalid (separate concerns)
    if (mods.includes(FunctionModifier.DEPLOY) && mods.includes(FunctionModifier.UPGRADE)) {
      throw new InvalidModifierCombinationError(node, "'deploy' and 'upgrade' are mutually exclusive");
    }

    // selfdestruct is only meaningful in stateful contracts
    if (mods.includes(FunctionModifier.SELFDESTRUCT) && !isStatefulContract) {
      throw new InvalidModifierCombinationError(node, "'selfdestruct' is only valid in stateful contracts");
    }

    // selfdestruct + unsafe is invalid (selfdestruct already skips all covenant checks)
    if (mods.includes(FunctionModifier.SELFDESTRUCT) && mods.includes(FunctionModifier.UNSAFE)) {
      throw new InvalidModifierCombinationError(node, "'selfdestruct' and 'unsafe' are mutually exclusive");
    }

    // selfdestruct + pure is invalid (destruction is inherently state-changing)
    if (mods.includes(FunctionModifier.SELFDESTRUCT) && mods.includes(FunctionModifier.PURE)) {
      throw new InvalidModifierCombinationError(node, "'selfdestruct' and 'pure' are mutually exclusive");
    }

    // selfdestruct + view is invalid
    if (mods.includes(FunctionModifier.SELFDESTRUCT) && mods.includes(FunctionModifier.VIEW)) {
      throw new InvalidModifierCombinationError(node, "'selfdestruct' and 'view' are mutually exclusive");
    }

    // selfdestruct + internal/private is invalid (must be externally callable)
    if (mods.includes(FunctionModifier.SELFDESTRUCT) && mods.includes(FunctionModifier.INTERNAL)) {
      throw new InvalidModifierCombinationError(node, "'selfdestruct' functions must be externally callable");
    }
    if (mods.includes(FunctionModifier.SELFDESTRUCT) && mods.includes(FunctionModifier.PRIVATE)) {
      throw new InvalidModifierCombinationError(node, "'selfdestruct' functions must be externally callable");
    }

    // selfdestruct + upgrade is invalid (incompatible intent: one destroys, other migrates)
    if (mods.includes(FunctionModifier.SELFDESTRUCT) && mods.includes(FunctionModifier.UPGRADE)) {
      throw new InvalidModifierCombinationError(node, "'selfdestruct' and 'upgrade' are mutually exclusive");
    }

    // selfdestruct + deploy is invalid
    if (mods.includes(FunctionModifier.SELFDESTRUCT) && mods.includes(FunctionModifier.DEPLOY)) {
      throw new InvalidModifierCombinationError(node, "'selfdestruct' and 'deploy' are mutually exclusive");
    }

    // delegate is only meaningful in stateful contracts
    if (mods.includes(FunctionModifier.DELEGATE) && !isStatefulContract) {
      throw new InvalidModifierCombinationError(node, "'delegate' is only valid in stateful contracts");
    }

    // delegate + unsafe is invalid (unsafe skips covenants, delegate needs them)
    if (mods.includes(FunctionModifier.DELEGATE) && mods.includes(FunctionModifier.UNSAFE)) {
      throw new InvalidModifierCombinationError(node, "'delegate' and 'unsafe' are mutually exclusive");
    }

    // delegate + upgrade is invalid (upgrade changes own LBC, not proxy's)
    if (mods.includes(FunctionModifier.DELEGATE) && mods.includes(FunctionModifier.UPGRADE)) {
      throw new InvalidModifierCombinationError(node, "'delegate' and 'upgrade' are mutually exclusive");
    }

    // delegate + selfdestruct is invalid
    if (mods.includes(FunctionModifier.DELEGATE) && mods.includes(FunctionModifier.SELFDESTRUCT)) {
      throw new InvalidModifierCombinationError(node, "'delegate' and 'selfdestruct' are mutually exclusive");
    }

    // delegate + deploy is invalid
    if (mods.includes(FunctionModifier.DELEGATE) && mods.includes(FunctionModifier.DEPLOY)) {
      throw new InvalidModifierCombinationError(node, "'delegate' and 'deploy' are mutually exclusive");
    }

    // delegate + internal/private is invalid (must be externally callable)
    if (mods.includes(FunctionModifier.DELEGATE) && mods.includes(FunctionModifier.INTERNAL)) {
      throw new InvalidModifierCombinationError(node, "'delegate' functions must be externally callable");
    }
    if (mods.includes(FunctionModifier.DELEGATE) && mods.includes(FunctionModifier.PRIVATE)) {
      throw new InvalidModifierCombinationError(node, "'delegate' functions must be externally callable");
    }

    // delegate + pure is invalid (delegate is inherently state-changing)
    if (mods.includes(FunctionModifier.DELEGATE) && mods.includes(FunctionModifier.PURE)) {
      throw new InvalidModifierCombinationError(node, "'delegate' and 'pure' are mutually exclusive");
    }

    // delegate + view is invalid (delegate modifies proxy state)
    if (mods.includes(FunctionModifier.DELEGATE) && mods.includes(FunctionModifier.VIEW)) {
      throw new InvalidModifierCombinationError(node, "'delegate' and 'view' are mutually exclusive");
    }

    // internal/private + payable is invalid
    const visibility = node.visibility;
    if ((visibility === 'internal' || visibility === 'private') && mods.includes(FunctionModifier.PAYABLE)) {
      throw new InvalidModifierCombinationError(node, `'${visibility}' functions cannot be 'payable'`);
    }

    // pure + payable is invalid
    if (mods.includes(FunctionModifier.PURE) && mods.includes(FunctionModifier.PAYABLE)) {
      throw new InvalidModifierCombinationError(node, "'pure' functions cannot be 'payable'");
    }

    // split is only meaningful in stateful contracts
    if (mods.includes(FunctionModifier.SPLIT) && !isStatefulContract) {
      throw new InvalidModifierCombinationError(node, "'split' is only valid in stateful contracts");
    }

    // split + merge is invalid
    if (mods.includes(FunctionModifier.SPLIT) && mods.includes(FunctionModifier.MERGE)) {
      throw new InvalidModifierCombinationError(node, "'split' and 'merge' are mutually exclusive");
    }

    // split forbidden combinations
    if (mods.includes(FunctionModifier.SPLIT)) {
      if (mods.includes(FunctionModifier.UNSAFE)) {
        throw new InvalidModifierCombinationError(node, "'split' and 'unsafe' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.UPGRADE)) {
        throw new InvalidModifierCombinationError(node, "'split' and 'upgrade' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.SELFDESTRUCT)) {
        throw new InvalidModifierCombinationError(node, "'split' and 'selfdestruct' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.DEPLOY)) {
        throw new InvalidModifierCombinationError(node, "'split' and 'deploy' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.DELEGATE)) {
        throw new InvalidModifierCombinationError(node, "'split' and 'delegate' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.PURE)) {
        throw new InvalidModifierCombinationError(node, "'split' and 'pure' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.VIEW)) {
        throw new InvalidModifierCombinationError(node, "'split' and 'view' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.INTERNAL)) {
        throw new InvalidModifierCombinationError(node, "'split' functions must be externally callable");
      }
      if (mods.includes(FunctionModifier.PRIVATE)) {
        throw new InvalidModifierCombinationError(node, "'split' functions must be externally callable");
      }
    }

    // merge is only meaningful in stateful contracts
    if (mods.includes(FunctionModifier.MERGE) && !isStatefulContract) {
      throw new InvalidModifierCombinationError(node, "'merge' is only valid in stateful contracts");
    }

    // merge forbidden combinations
    if (mods.includes(FunctionModifier.MERGE)) {
      if (mods.includes(FunctionModifier.UNSAFE)) {
        throw new InvalidModifierCombinationError(node, "'merge' and 'unsafe' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.UPGRADE)) {
        throw new InvalidModifierCombinationError(node, "'merge' and 'upgrade' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.SELFDESTRUCT)) {
        throw new InvalidModifierCombinationError(node, "'merge' and 'selfdestruct' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.DEPLOY)) {
        throw new InvalidModifierCombinationError(node, "'merge' and 'deploy' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.DELEGATE)) {
        throw new InvalidModifierCombinationError(node, "'merge' and 'delegate' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.PURE)) {
        throw new InvalidModifierCombinationError(node, "'merge' and 'pure' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.VIEW)) {
        throw new InvalidModifierCombinationError(node, "'merge' and 'view' are mutually exclusive");
      }
      if (mods.includes(FunctionModifier.INTERNAL)) {
        throw new InvalidModifierCombinationError(node, "'merge' functions must be externally callable");
      }
      if (mods.includes(FunctionModifier.PRIVATE)) {
        throw new InvalidModifierCombinationError(node, "'merge' functions must be externally callable");
      }
    }

    // Validate split(paramName): referenced parameter must be int
    if (node.splitCountParam) {
      const param = node.parameters.find((p) => p.name === node.splitCountParam);
      if (!param) {
        throw new InvalidModifierCombinationError(node, `split parameter '${node.splitCountParam}' is not a function parameter`);
      }
      if (param.type !== PrimitiveType.BIGINT && !(param.type instanceof IntType)) {
        throw new InvalidModifierCombinationError(node, `split parameter '${node.splitCountParam}' must be an integer type`);
      }
    }

    // Validate merge(paramName): referenced parameter must be int
    if (node.mergeCountParam) {
      const param = node.parameters.find((p) => p.name === node.mergeCountParam);
      if (!param) {
        throw new InvalidModifierCombinationError(node, `merge parameter '${node.mergeCountParam}' is not a function parameter`);
      }
      if (param.type !== PrimitiveType.BIGINT && !(param.type instanceof IntType)) {
        throw new InvalidModifierCombinationError(node, `merge parameter '${node.mergeCountParam}' must be an integer type`);
      }
    }
  }

  private pushToStack(param: ParameterNode): void {
    // Track for opRolls in the current function
    const idNode = new IdentifierNode(param.name);
    idNode.location = param.location;
    this.currentFunction.opRolls.set(param.name, idNode);
  }

  private bodyContainsStateWrites(node: Node): boolean {
    if (node instanceof StateAssignNode) return true;
    if (node instanceof MappingAssignNode) return true;
    if (node instanceof MappingFieldAssignNode) return true;
    if (node instanceof MappingDeleteNode) return true;
    if (node instanceof DeleteStateNode) return true;

    // Walk child nodes
    for (const value of Object.values(node)) {
      if (value instanceof Node) {
        if (this.bodyContainsStateWrites(value)) return true;
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (item instanceof Node && this.bodyContainsStateWrites(item)) return true;
        }
      }
    }
    return false;
  }

  private collectMsgSenderUsage(node: Node, visited: Set<Node> = new Set()): boolean {
    if (visited.has(node)) return false;
    visited.add(node);

    if (node instanceof NullaryOpNode && node.operator === NullaryOperator.MSG_SENDER) {
      return true;
    }

    // Walk all own properties and recurse into any Node or Node[] values
    for (const value of Object.values(node)) {
      if (value instanceof Node) {
        if (this.collectMsgSenderUsage(value, visited)) return true;
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (item instanceof Node && this.collectMsgSenderUsage(item, visited)) return true;
        }
      }
    }
    return false;
  }

  // Decide contract-wide which external libraries are inlined into the contract bytecode (vs a side-car):
  // inlineLibraries[name] forces it on/off; otherwise auto-inline a single-call library with a blob within
  // INLINE_MAX_BLOB_LENGTH. Annotates each using function's inlinedLibraries for codegen + the artifact.
  private decideLibraryInlining(contract: ContractNode): void {
    const fns = [contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions]
      .filter((f): f is FunctionDefinitionNode => !!f);
    const totals = new Map<string, number>();
    for (const fn of fns) {
      for (const [name, n] of fn.libraryCallCounts ?? []) totals.set(name, (totals.get(name) ?? 0) + n);
    }
    for (const [name, total] of totals) {
      const override = this.compilerOptions.inlineLibraries?.[name];
      const inline = override !== undefined
        ? override
        : !this.compilerOptions.disableAutoInline
          && total === 1 && this.resolvedLibraries[name].blob.length <= INLINE_MAX_BLOB_LENGTH;
      if (!inline) continue;
      for (const fn of fns) {
        if (fn.usedLibraries?.includes(name)) (fn.inlinedLibraries ??= []).push(name);
      }
    }
  }

  private countLibraryCalls(
    node: Node, counts: Map<string, number> = new Map(), visited: Set<Node> = new Set(),
  ): Map<string, number> {
    if (visited.has(node)) return counts;
    visited.add(node);

    if (node instanceof FunctionCallNode && node.identifier.name in this.resolvedLibraries) {
      counts.set(node.identifier.name, (counts.get(node.identifier.name) ?? 0) + 1);
    }

    for (const value of Object.values(node)) {
      if (value instanceof Node) {
        this.countLibraryCalls(value, counts, visited);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (item instanceof Node) this.countLibraryCalls(item, counts, visited);
        }
      }
    }
    return counts;
  }

  private collectCollectionIterations(node: Node, iterations: CollectionIterationInfo[]): void {
    if (node instanceof CollectionIterationNode) {
      const coll = this.collectionMap.get(node.collectionName);
      if (!coll) return;
      const collSig = computeCollectionSignature(coll.name, coll.type.toString());
      const idx = iterations.length;
      node.collectionIterationIndex = idx;
      iterations.push({
        collection: coll.name,
        collectionSignature: collSig,
        mode: node.mode,
        iterationIndex: idx,
      });
      // Recurse into body - nested iterations get their own indices
      this.collectCollectionIterations(node.body, iterations);
      return;
    }
    if (node instanceof BlockNode && node.statements) {
      for (const stmt of node.statements) {
        this.collectCollectionIterations(stmt, iterations);
      }
      return;
    }
    if (node instanceof BranchNode) {
      this.collectCollectionIterations(node.ifBlock, iterations);
      if (node.elseBlock) this.collectCollectionIterations(node.elseBlock, iterations);
      return;
    }
    if (node instanceof DoWhileNode) {
      this.collectCollectionIterations(node.block, iterations);
      return;
    }
    if (node instanceof WhileNode) {
      this.collectCollectionIterations(node.block, iterations);
      return;
    }
    if (node instanceof TryCatchNode) {
      this.collectCollectionIterations(node.tryBlock, iterations);
      for (const clause of node.catchClauses) {
        this.collectCollectionIterations(clause.block, iterations);
      }
    }
  }

  private collectEntryAccesses(node: Node, map: Map<string, EntryAccessInfo>): void {
    // FieldAccessNode wraps an inner expression - recurse into it
    if (node instanceof FieldAccessNode) {
      this.collectEntryAccesses(node.expression, map);
      return;
    }

    if (node instanceof MappingAccessNode && node.collection) {
      // Constructor mapping reads are genesis reads (default value, no input entry NFT). They are NOT entry
      // accesses: no slot, no input/output. Codegen emits the type default directly.
      if (this.insideConstructor) return;
      const { keyParams, keySources } = this.getMappingKeyDescriptors(node.keys);
      const slotKey = `${node.collection.name}:${keyParams.join(':')}`;
      const existing = map.get(slotKey);
      if (existing) {
        if (!existing.operations.includes('read')) existing.operations.push('read');
      } else {
        const collSig = computeCollectionSignature(node.collection.name, node.collection.type.toString());
        map.set(slotKey, {
          collection: node.collection.name, collectionSignature: collSig,
          keyParams, keySources, operations: ['read'], slotIndex: -1,
        });
      }
      return; // MappingAccessNode has no children to recurse into
    }

    if (node instanceof MappingAssignNode && node.collection) {
      const { keyParams, keySources } = this.getMappingKeyDescriptors(node.keys);
      const slotKey = `${node.collection.name}:${keyParams.join(':')}`;
      const existing = map.get(slotKey);
      // `map[k].push(v)` / `.pop()` are read-modify-writes of the entry's array: the SDK must CO-SPEND the existing
      // entry (read its current array) before appending/dropping - a bare 'write' would overwrite it.
      const rmw = node.arrayPush || node.arrayPop;
      if (existing) {
        if (!existing.operations.includes('write')) existing.operations.push('write');
        if (rmw && !existing.operations.includes('read')) existing.operations.push('read');
      } else {
        const collSig = computeCollectionSignature(node.collection.name, node.collection.type.toString());
        map.set(slotKey, {
          collection: node.collection.name, collectionSignature: collSig,
          keyParams, keySources, operations: rmw ? ['read', 'write'] : ['write'], slotIndex: -1,
        });
      }
      // Recurse into the value expression (may contain nested mapping accesses)
      this.collectEntryAccesses(node.expression, map);
      return;
    }

    if (node instanceof MappingFieldAssignNode && node.collection) {
      const { keyParams, keySources } = this.getMappingKeyDescriptors(node.keys);
      const slotKey = `${node.collection.name}:${keyParams.join(':')}`;
      const existing = map.get(slotKey);
      if (existing) {
        if (!existing.operations.includes('read')) existing.operations.push('read');
        if (!existing.operations.includes('write')) existing.operations.push('write');
      } else {
        const collSig = computeCollectionSignature(node.collection.name, node.collection.type.toString());
        map.set(slotKey, {
          collection: node.collection.name, collectionSignature: collSig,
          keyParams, keySources, operations: ['read', 'write'], slotIndex: -1,
        });
      }
      this.collectEntryAccesses(node.expression, map);
      return;
    }

    if (node instanceof MappingDeleteNode && node.collection) {
      const { keyParams, keySources } = this.getMappingKeyDescriptors(node.keys);
      const slotKey = `${node.collection.name}:${keyParams.join(':')}`;
      const existing = map.get(slotKey);
      if (existing) {
        if (!existing.operations.includes('delete')) existing.operations.push('delete');
      } else {
        const collSig = computeCollectionSignature(node.collection.name, node.collection.type.toString());
        map.set(slotKey, {
          collection: node.collection.name, collectionSignature: collSig,
          keyParams, keySources, operations: ['delete'], slotIndex: -1,
        });
      }
      return; // MappingDeleteNode has no children to recurse into
    }

    // Generic recursion into child nodes
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.collectEntryAccesses(stmt, map);
      }
    }
    if ('expression' in node && (node as any).expression instanceof Node) {
      this.collectEntryAccesses((node as any).expression, map);
    }
    if ('expressions' in node && Array.isArray((node as any).expressions)) {
      for (const e of (node as any).expressions) {
        if (e instanceof Node) this.collectEntryAccesses(e, map);
      }
    }
    if ('left' in node && (node as any).left instanceof Node) {
      this.collectEntryAccesses((node as any).left, map);
    }
    if ('right' in node && (node as any).right instanceof Node) {
      this.collectEntryAccesses((node as any).right, map);
    }
    if ('arguments' in node && Array.isArray((node as any).arguments)) {
      for (const arg of (node as any).arguments) {
        if (arg instanceof Node) this.collectEntryAccesses(arg, map);
      }
    }
    // MethodCallNode: recurse into object and parameters (for using-for patterns
    // like this.balances[key].sub(value) where the mapping access is inside .object)
    if ('object' in node && (node as any).object instanceof Node) {
      this.collectEntryAccesses((node as any).object, map);
    }
    if ('parameters' in node && Array.isArray((node as any).parameters)) {
      for (const param of (node as any).parameters) {
        if (param instanceof Node) this.collectEntryAccesses(param, map);
      }
    }
    if ('condition' in node && (node as any).condition instanceof Node) {
      this.collectEntryAccesses((node as any).condition, map);
    }
    if ('ifTrue' in node && (node as any).ifTrue instanceof Node) {
      this.collectEntryAccesses((node as any).ifTrue, map);
    }
    if ('ifFalse' in node && (node as any).ifFalse instanceof Node) {
      this.collectEntryAccesses((node as any).ifFalse, map);
    }
    if ('args' in node && Array.isArray((node as any).args)) {
      for (const a of (node as any).args) {
        if (a instanceof Node) this.collectEntryAccesses(a, map);
      }
    }
    if ('value' in node && (node as any).value instanceof Node) {
      this.collectEntryAccesses((node as any).value, map);
    }
    // Index/slice bases so a mapping-entry element read `m[k][i]` / `m[k].f[i]` / `m[k][a:b]` collects the
    // inner `m[k]` entry access (TupleIndexOp.tuple, ArrayAccess.array/index, Slice.element/start/end).
    if ('tuple' in node && (node as any).tuple instanceof Node) this.collectEntryAccesses((node as any).tuple, map);
    if ('array' in node && (node as any).array instanceof Node) this.collectEntryAccesses((node as any).array, map);
    if ('index' in node && (node as any).index instanceof Node) this.collectEntryAccesses((node as any).index, map);
    if ('element' in node && (node as any).element instanceof Node) this.collectEntryAccesses((node as any).element, map);
    if ('start' in node && (node as any).start instanceof Node) this.collectEntryAccesses((node as any).start, map);
    if ('end' in node && (node as any).end instanceof Node) this.collectEntryAccesses((node as any).end, map);
    if ('selector' in node && (node as any).selector instanceof Node) {
      this.collectEntryAccesses((node as any).selector, map);
    }
    if ('signature' in node && (node as any).signature instanceof Node) {
      this.collectEntryAccesses((node as any).signature, map);
    }
    if ('ifBlock' in node) this.collectEntryAccesses((node as any).ifBlock, map);
    if ('elseBlock' in node && (node as any).elseBlock) this.collectEntryAccesses((node as any).elseBlock, map);
    if ('block' in node && (node as any).block) this.collectEntryAccesses((node as any).block, map);
    if ('body' in node && (node as any).body) this.collectEntryAccesses((node as any).body, map);
    if ('cases' in node && Array.isArray((node as any).cases)) {
      for (const c of (node as any).cases) { if (c instanceof Node) this.collectEntryAccesses(c, map); }
    }
    if ('defaultCase' in node && (node as any).defaultCase instanceof Node) {
      this.collectEntryAccesses((node as any).defaultCase, map);
    }
  }

  private assignEntrySlotIndices(node: Node, map: Map<string, EntryAccessInfo>): void {
    if (node instanceof FieldAccessNode) {
      this.assignEntrySlotIndices(node.expression, map);
      return;
    }

    if (node instanceof MappingAccessNode && node.collection) {
      const { keyParams } = this.getMappingKeyDescriptors(node.keys);
      const slotKey = `${node.collection.name}:${keyParams.join(':')}`;
      const info = map.get(slotKey);
      if (info) node.entrySlotIndex = info.slotIndex;
      return;
    }

    if (node instanceof MappingAssignNode && node.collection) {
      const { keyParams } = this.getMappingKeyDescriptors(node.keys);
      const slotKey = `${node.collection.name}:${keyParams.join(':')}`;
      const info = map.get(slotKey);
      if (info) node.entrySlotIndex = info.slotIndex;
      this.assignEntrySlotIndices(node.expression, map);
      return;
    }

    if (node instanceof MappingFieldAssignNode && node.collection) {
      const { keyParams } = this.getMappingKeyDescriptors(node.keys);
      const slotKey = `${node.collection.name}:${keyParams.join(':')}`;
      const info = map.get(slotKey);
      if (info) node.entrySlotIndex = info.slotIndex;
      this.assignEntrySlotIndices(node.expression, map);
      return;
    }

    if (node instanceof MappingDeleteNode && node.collection) {
      const { keyParams } = this.getMappingKeyDescriptors(node.keys);
      const slotKey = `${node.collection.name}:${keyParams.join(':')}`;
      const info = map.get(slotKey);
      if (info) node.entrySlotIndex = info.slotIndex;
      return;
    }

    // Generic recursion (same as collectEntryAccesses)
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.assignEntrySlotIndices(stmt, map);
      }
    }
    if ('expression' in node && (node as any).expression instanceof Node) {
      this.assignEntrySlotIndices((node as any).expression, map);
    }
    if ('expressions' in node && Array.isArray((node as any).expressions)) {
      for (const e of (node as any).expressions) {
        if (e instanceof Node) this.assignEntrySlotIndices(e, map);
      }
    }
    if ('left' in node && (node as any).left instanceof Node) {
      this.assignEntrySlotIndices((node as any).left, map);
    }
    if ('right' in node && (node as any).right instanceof Node) {
      this.assignEntrySlotIndices((node as any).right, map);
    }
    if ('arguments' in node && Array.isArray((node as any).arguments)) {
      for (const arg of (node as any).arguments) {
        if (arg instanceof Node) this.assignEntrySlotIndices(arg, map);
      }
    }
    if ('object' in node && (node as any).object instanceof Node) {
      this.assignEntrySlotIndices((node as any).object, map);
    }
    if ('parameters' in node && Array.isArray((node as any).parameters)) {
      for (const param of (node as any).parameters) {
        if (param instanceof Node) this.assignEntrySlotIndices(param, map);
      }
    }
    if ('condition' in node && (node as any).condition instanceof Node) {
      this.assignEntrySlotIndices((node as any).condition, map);
    }
    if ('ifTrue' in node && (node as any).ifTrue instanceof Node) {
      this.assignEntrySlotIndices((node as any).ifTrue, map);
    }
    if ('ifFalse' in node && (node as any).ifFalse instanceof Node) {
      this.assignEntrySlotIndices((node as any).ifFalse, map);
    }
    if ('args' in node && Array.isArray((node as any).args)) {
      for (const a of (node as any).args) {
        if (a instanceof Node) this.assignEntrySlotIndices(a, map);
      }
    }
    if ('value' in node && (node as any).value instanceof Node) {
      this.assignEntrySlotIndices((node as any).value, map);
    }
    // Index/slice bases (mirror collectEntryAccesses) so `m[k][i]` etc. assign the inner `m[k]` slot.
    if ('tuple' in node && (node as any).tuple instanceof Node) this.assignEntrySlotIndices((node as any).tuple, map);
    if ('array' in node && (node as any).array instanceof Node) this.assignEntrySlotIndices((node as any).array, map);
    if ('index' in node && (node as any).index instanceof Node) this.assignEntrySlotIndices((node as any).index, map);
    if ('element' in node && (node as any).element instanceof Node) this.assignEntrySlotIndices((node as any).element, map);
    if ('start' in node && (node as any).start instanceof Node) this.assignEntrySlotIndices((node as any).start, map);
    if ('end' in node && (node as any).end instanceof Node) this.assignEntrySlotIndices((node as any).end, map);
    if ('selector' in node && (node as any).selector instanceof Node) {
      this.assignEntrySlotIndices((node as any).selector, map);
    }
    if ('signature' in node && (node as any).signature instanceof Node) {
      this.assignEntrySlotIndices((node as any).signature, map);
    }
    if ('ifBlock' in node) this.assignEntrySlotIndices((node as any).ifBlock, map);
    if ('elseBlock' in node && (node as any).elseBlock) this.assignEntrySlotIndices((node as any).elseBlock, map);
    if ('block' in node && (node as any).block) this.assignEntrySlotIndices((node as any).block, map);
    if ('body' in node && (node as any).body) this.assignEntrySlotIndices((node as any).body, map);
    if ('cases' in node && Array.isArray((node as any).cases)) {
      for (const c of (node as any).cases) { if (c instanceof Node) this.assignEntrySlotIndices(c, map); }
    }
    if ('defaultCase' in node && (node as any).defaultCase instanceof Node) {
      this.assignEntrySlotIndices((node as any).defaultCase, map);
    }
  }

  private collectTokenContainerAccesses(node: Node, map: Map<string, TokenContainerAccessInfo>): void {
    if (node instanceof FieldAccessNode && node.expression instanceof MappingAccessNode
        && node.expression.isTokenContainerAccess) {
      const keyExpr = node.expression.keys[0];
      if (keyExpr instanceof IdentifierNode) {
        const slotKey = keyExpr.name;
        const existing = map.get(slotKey);
        if (existing) {
          if (!existing.operations.includes('read')) existing.operations.push('read');
        } else {
          map.set(slotKey, { keyParam: keyExpr.name, operations: ['read'], slotIndex: -1, transferCount: 0, transferNftCount: 0 });
        }
      }
      return;
    }

    if (node instanceof MappingAccessNode && node.isTokenContainerAccess) {
      const keyExpr = node.keys[0];
      if (keyExpr instanceof IdentifierNode) {
        const slotKey = keyExpr.name;
        const existing = map.get(slotKey);
        if (existing) {
          if (!existing.operations.includes('read')) existing.operations.push('read');
        } else {
          map.set(slotKey, { keyParam: keyExpr.name, operations: ['read'], slotIndex: -1, transferCount: 0, transferNftCount: 0 });
        }
      }
      return;
    }

    if (node instanceof TokenContainerMethodStatementNode) {
      const keyExpr = node.tokenContainerKeyExpression;
      if (keyExpr instanceof IdentifierNode) {
        const slotKey = keyExpr.name;
        const op = node.methodName as 'transfer' | 'transferNft';
        const existing = map.get(slotKey);
        if (existing) {
          if (!existing.operations.includes(op)) existing.operations.push(op);
          if (op === 'transfer') existing.transferCount++;
          else if (op === 'transferNft') existing.transferNftCount++;
        } else {
          map.set(slotKey, {
            keyParam: keyExpr.name, operations: [op], slotIndex: -1,
            transferCount: op === 'transfer' ? 1 : 0,
            transferNftCount: op === 'transferNft' ? 1 : 0,
          });
        }
      }
      return;
    }

    // Generic recursion
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.collectTokenContainerAccesses(stmt, map);
      }
    }
    if ('expression' in node && (node as any).expression instanceof Node) {
      this.collectTokenContainerAccesses((node as any).expression, map);
    }
    if ('left' in node && (node as any).left instanceof Node) {
      this.collectTokenContainerAccesses((node as any).left, map);
    }
    if ('right' in node && (node as any).right instanceof Node) {
      this.collectTokenContainerAccesses((node as any).right, map);
    }
    if ('condition' in node && (node as any).condition instanceof Node) {
      this.collectTokenContainerAccesses((node as any).condition, map);
    }
    if ('ifTrue' in node && (node as any).ifTrue instanceof Node) {
      this.collectTokenContainerAccesses((node as any).ifTrue, map);
    }
    if ('ifFalse' in node && (node as any).ifFalse instanceof Node) {
      this.collectTokenContainerAccesses((node as any).ifFalse, map);
    }
    if ('args' in node && Array.isArray((node as any).args)) {
      for (const a of (node as any).args) {
        if (a instanceof Node) this.collectTokenContainerAccesses(a, map);
      }
    }
    if ('value' in node && (node as any).value instanceof Node) {
      this.collectTokenContainerAccesses((node as any).value, map);
    }
    if ('selector' in node && (node as any).selector instanceof Node) {
      this.collectTokenContainerAccesses((node as any).selector, map);
    }
    if ('signature' in node && (node as any).signature instanceof Node) {
      this.collectTokenContainerAccesses((node as any).signature, map);
    }
    if ('ifBlock' in node) this.collectTokenContainerAccesses((node as any).ifBlock, map);
    if ('elseBlock' in node && (node as any).elseBlock) this.collectTokenContainerAccesses((node as any).elseBlock, map);
    if ('block' in node && (node as any).block) this.collectTokenContainerAccesses((node as any).block, map);
    if ('body' in node && (node as any).body) this.collectTokenContainerAccesses((node as any).body, map);
    if ('cases' in node && Array.isArray((node as any).cases)) {
      for (const c of (node as any).cases) { if (c instanceof Node) this.collectTokenContainerAccesses(c, map); }
    }
    if ('defaultCase' in node && (node as any).defaultCase instanceof Node) {
      this.collectTokenContainerAccesses((node as any).defaultCase, map);
    }
    if ('object' in node && (node as any).object instanceof Node) {
      this.collectTokenContainerAccesses((node as any).object, map);
    }
    if ('parameters' in node && Array.isArray((node as any).parameters)) {
      for (const param of (node as any).parameters) {
        if (param instanceof Node) this.collectTokenContainerAccesses(param, map);
      }
    }
  }

  private assignTokenContainerSlotIndices(node: Node, map: Map<string, TokenContainerAccessInfo>): void {
    if (node instanceof FieldAccessNode && node.expression instanceof MappingAccessNode
        && node.expression.isTokenContainerAccess) {
      const keyExpr = node.expression.keys[0];
      if (keyExpr instanceof IdentifierNode) {
        const info = map.get(keyExpr.name);
        if (info) node.expression.tokenContainerSlotIndex = info.slotIndex;
      }
      return;
    }

    if (node instanceof MappingAccessNode && node.isTokenContainerAccess) {
      const keyExpr = node.keys[0];
      if (keyExpr instanceof IdentifierNode) {
        const info = map.get(keyExpr.name);
        if (info) node.tokenContainerSlotIndex = info.slotIndex;
      }
      return;
    }

    if (node instanceof TokenContainerMethodStatementNode) {
      const keyExpr = node.tokenContainerKeyExpression;
      if (keyExpr instanceof IdentifierNode) {
        const info = map.get(keyExpr.name);
        if (info) node.tokenContainerSlotIndex = info.slotIndex;
      }
      return;
    }

    // Generic recursion
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.assignTokenContainerSlotIndices(stmt, map);
      }
    }
    if ('expression' in node && (node as any).expression instanceof Node) {
      this.assignTokenContainerSlotIndices((node as any).expression, map);
    }
    if ('left' in node && (node as any).left instanceof Node) {
      this.assignTokenContainerSlotIndices((node as any).left, map);
    }
    if ('right' in node && (node as any).right instanceof Node) {
      this.assignTokenContainerSlotIndices((node as any).right, map);
    }
    if ('condition' in node && (node as any).condition instanceof Node) {
      this.assignTokenContainerSlotIndices((node as any).condition, map);
    }
    if ('ifTrue' in node && (node as any).ifTrue instanceof Node) {
      this.assignTokenContainerSlotIndices((node as any).ifTrue, map);
    }
    if ('ifFalse' in node && (node as any).ifFalse instanceof Node) {
      this.assignTokenContainerSlotIndices((node as any).ifFalse, map);
    }
    if ('args' in node && Array.isArray((node as any).args)) {
      for (const a of (node as any).args) {
        if (a instanceof Node) this.assignTokenContainerSlotIndices(a, map);
      }
    }
    if ('value' in node && (node as any).value instanceof Node) {
      this.assignTokenContainerSlotIndices((node as any).value, map);
    }
    if ('selector' in node && (node as any).selector instanceof Node) {
      this.assignTokenContainerSlotIndices((node as any).selector, map);
    }
    if ('signature' in node && (node as any).signature instanceof Node) {
      this.assignTokenContainerSlotIndices((node as any).signature, map);
    }
    if ('ifBlock' in node) this.assignTokenContainerSlotIndices((node as any).ifBlock, map);
    if ('elseBlock' in node && (node as any).elseBlock) this.assignTokenContainerSlotIndices((node as any).elseBlock, map);
    if ('block' in node && (node as any).block) this.assignTokenContainerSlotIndices((node as any).block, map);
    if ('body' in node && (node as any).body) this.assignTokenContainerSlotIndices((node as any).body, map);
    if ('cases' in node && Array.isArray((node as any).cases)) {
      for (const c of (node as any).cases) { if (c instanceof Node) this.assignTokenContainerSlotIndices(c, map); }
    }
    if ('defaultCase' in node && (node as any).defaultCase instanceof Node) {
      this.assignTokenContainerSlotIndices((node as any).defaultCase, map);
    }
    if ('object' in node && (node as any).object instanceof Node) {
      this.assignTokenContainerSlotIndices((node as any).object, map);
    }
    if ('parameters' in node && Array.isArray((node as any).parameters)) {
      for (const param of (node as any).parameters) {
        if (param instanceof Node) this.assignTokenContainerSlotIndices(param, map);
      }
    }
  }

  private collectExternalReads(node: Node, map: Map<string, ExternalReadSlot>): void {
    if (node instanceof ExternalStateAccessNode && node.readInfo) {
      const key = `${node.readInfo.interfaceName}:data:${node.readInfo.nftIndex}`;
      if (!map.has(key)) {
        const addressParam = node.addressExpression instanceof IdentifierNode
          ? node.addressExpression.name : undefined;
        map.set(key, {
          interfaceName: node.readInfo.interfaceName,
          kind: 'data',
          nftIndex: node.readInfo.nftIndex,
          addressParam,
          slotIndex: -1,
        });
      }
      return;
    }

    if (node instanceof ExternalMappingAccessNode && node.readInfo) {
      const key = `${node.readInfo.interfaceName}:entry:${node.readInfo.collectionSignature}`;
      if (!map.has(key)) {
        const addressParam = node.addressExpression instanceof IdentifierNode
          ? node.addressExpression.name : undefined;
        map.set(key, {
          interfaceName: node.readInfo.interfaceName,
          kind: 'entry',
          collectionName: node.readInfo.collectionName,
          collectionSignature: node.readInfo.collectionSignature,
          addressParam,
          slotIndex: -1,
        });
      }
      return;
    }

    // Generic recursion
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.collectExternalReads(stmt, map);
      }
    }
    if ('expression' in node && (node as any).expression instanceof Node) {
      this.collectExternalReads((node as any).expression, map);
    }
    if ('tuple' in node && (node as any).tuple instanceof Node) {
      this.collectExternalReads((node as any).tuple, map);
    }
    if ('tupleExpressions' in node && Array.isArray((node as any).tupleExpressions)) {
      for (const e of (node as any).tupleExpressions) { if (e instanceof Node) this.collectExternalReads(e, map); }
    }
    if ('addressExpression' in node && (node as any).addressExpression instanceof Node) {
      this.collectExternalReads((node as any).addressExpression, map);
    }
    if ('left' in node && (node as any).left instanceof Node) {
      this.collectExternalReads((node as any).left, map);
    }
    if ('right' in node && (node as any).right instanceof Node) {
      this.collectExternalReads((node as any).right, map);
    }
    if ('keys' in node && Array.isArray((node as any).keys)) {
      for (const k of (node as any).keys) {
        if (k instanceof Node) this.collectExternalReads(k, map);
      }
    }
    if ('condition' in node && (node as any).condition instanceof Node) {
      this.collectExternalReads((node as any).condition, map);
    }
    if ('ifTrue' in node && (node as any).ifTrue instanceof Node) {
      this.collectExternalReads((node as any).ifTrue, map);
    }
    if ('ifFalse' in node && (node as any).ifFalse instanceof Node) {
      this.collectExternalReads((node as any).ifFalse, map);
    }
    if ('args' in node && Array.isArray((node as any).args)) {
      for (const a of (node as any).args) {
        if (a instanceof Node) this.collectExternalReads(a, map);
      }
    }
    if ('value' in node && (node as any).value instanceof Node) {
      this.collectExternalReads((node as any).value, map);
    }
    if ('selector' in node && (node as any).selector instanceof Node) {
      this.collectExternalReads((node as any).selector, map);
    }
    if ('signature' in node && (node as any).signature instanceof Node) {
      this.collectExternalReads((node as any).signature, map);
    }
    if ('ifBlock' in node) this.collectExternalReads((node as any).ifBlock, map);
    if ('elseBlock' in node && (node as any).elseBlock) this.collectExternalReads((node as any).elseBlock, map);
    if ('block' in node && (node as any).block) this.collectExternalReads((node as any).block, map);
    if ('body' in node && (node as any).body) this.collectExternalReads((node as any).body, map);
    if ('cases' in node && Array.isArray((node as any).cases)) {
      for (const c of (node as any).cases) { if (c instanceof Node) this.collectExternalReads(c, map); }
    }
    if ('defaultCase' in node && (node as any).defaultCase instanceof Node) {
      this.collectExternalReads((node as any).defaultCase, map);
    }
    if ('object' in node && (node as any).object instanceof Node) {
      this.collectExternalReads((node as any).object, map);
    }
    if ('parameters' in node && Array.isArray((node as any).parameters)) {
      for (const param of (node as any).parameters) {
        if (param instanceof Node) this.collectExternalReads(param, map);
      }
    }
  }

  private assignExternalReadSlotIndices(node: Node, map: Map<string, ExternalReadSlot>): void {
    if (node instanceof ExternalStateAccessNode && node.readInfo) {
      const key = `${node.readInfo.interfaceName}:data:${node.readInfo.nftIndex}`;
      const slot = map.get(key);
      if (slot) node.readInfo.externalReadSlotIndex = slot.slotIndex;
      return;
    }

    if (node instanceof ExternalMappingAccessNode && node.readInfo) {
      const key = `${node.readInfo.interfaceName}:entry:${node.readInfo.collectionSignature}`;
      const slot = map.get(key);
      if (slot) node.readInfo.externalReadSlotIndex = slot.slotIndex;
      return;
    }

    // Generic recursion
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.assignExternalReadSlotIndices(stmt, map);
      }
    }
    if ('expression' in node && (node as any).expression instanceof Node) {
      this.assignExternalReadSlotIndices((node as any).expression, map);
    }
    if ('tuple' in node && (node as any).tuple instanceof Node) {
      this.assignExternalReadSlotIndices((node as any).tuple, map);
    }
    if ('tupleExpressions' in node && Array.isArray((node as any).tupleExpressions)) {
      for (const e of (node as any).tupleExpressions) { if (e instanceof Node) this.assignExternalReadSlotIndices(e, map); }
    }
    if ('addressExpression' in node && (node as any).addressExpression instanceof Node) {
      this.assignExternalReadSlotIndices((node as any).addressExpression, map);
    }
    if ('left' in node && (node as any).left instanceof Node) {
      this.assignExternalReadSlotIndices((node as any).left, map);
    }
    if ('right' in node && (node as any).right instanceof Node) {
      this.assignExternalReadSlotIndices((node as any).right, map);
    }
    if ('keys' in node && Array.isArray((node as any).keys)) {
      for (const k of (node as any).keys) {
        if (k instanceof Node) this.assignExternalReadSlotIndices(k, map);
      }
    }
    if ('condition' in node && (node as any).condition instanceof Node) {
      this.assignExternalReadSlotIndices((node as any).condition, map);
    }
    if ('ifTrue' in node && (node as any).ifTrue instanceof Node) {
      this.assignExternalReadSlotIndices((node as any).ifTrue, map);
    }
    if ('ifFalse' in node && (node as any).ifFalse instanceof Node) {
      this.assignExternalReadSlotIndices((node as any).ifFalse, map);
    }
    if ('args' in node && Array.isArray((node as any).args)) {
      for (const a of (node as any).args) {
        if (a instanceof Node) this.assignExternalReadSlotIndices(a, map);
      }
    }
    if ('value' in node && (node as any).value instanceof Node) {
      this.assignExternalReadSlotIndices((node as any).value, map);
    }
    if ('selector' in node && (node as any).selector instanceof Node) {
      this.assignExternalReadSlotIndices((node as any).selector, map);
    }
    if ('signature' in node && (node as any).signature instanceof Node) {
      this.assignExternalReadSlotIndices((node as any).signature, map);
    }
    if ('ifBlock' in node) this.assignExternalReadSlotIndices((node as any).ifBlock, map);
    if ('elseBlock' in node && (node as any).elseBlock) this.assignExternalReadSlotIndices((node as any).elseBlock, map);
    if ('block' in node && (node as any).block) this.assignExternalReadSlotIndices((node as any).block, map);
    if ('body' in node && (node as any).body) this.assignExternalReadSlotIndices((node as any).body, map);
    if ('cases' in node && Array.isArray((node as any).cases)) {
      for (const c of (node as any).cases) { if (c instanceof Node) this.assignExternalReadSlotIndices(c, map); }
    }
    if ('defaultCase' in node && (node as any).defaultCase instanceof Node) {
      this.assignExternalReadSlotIndices((node as any).defaultCase, map);
    }
    if ('object' in node && (node as any).object instanceof Node) {
      this.assignExternalReadSlotIndices((node as any).object, map);
    }
    if ('parameters' in node && Array.isArray((node as any).parameters)) {
      for (const param of (node as any).parameters) {
        if (param instanceof Node) this.assignExternalReadSlotIndices(param, map);
      }
    }
  }

  private collectExternalCalls(node: Node, slots: ExternalCallSlot[]): void {
    if (node instanceof ExternalFunctionCallNode && node.callInfo && !node.foldedIntoDeploy) {
      // Each call site gets its own slot (no de-duplication)
      const addressParam = node.addressExpression instanceof IdentifierNode
        ? node.addressExpression.name : undefined;
      // A `__extaddr_<var>` address local is the synthesized read of an interface-typed state var (see
      // SynthesizeExternalAddressLocals); record the underlying state var so the SDK resolves it from state.
      const addressStateVar = addressParam?.startsWith('__extaddr_')
        ? addressParam.slice('__extaddr_'.length) : undefined;
      // Array-element target `IFoo(arr[i]).m()` (typically inside a `for` over the array): record the state
      // array. The SDK co-spends every element as a callee and the epilogue loop-verifies each; addressParam
      // stays undefined (the address is per-element, not a single param). State-array element access is a
      // MappingAccessNode (the flattened state-array model); a real mapping reaches the same branch and is
      // rejected later in emitArrayExternalCallLoop ("must be a state array"). Local arrays use ArrayAccessNode.
      let loopArrayVar: string | undefined;
      if (!addressParam) {
        const ae = node.addressExpression;
        if (ae instanceof MappingAccessNode) loopArrayVar = ae.name;
        else if (ae instanceof ArrayAccessNode && ae.array instanceof IdentifierNode) loopArrayVar = ae.array.name;
      }
      // `IFoo(msg.sender).m()`: the callee is the tx-derived msg.sender input (verified against emitMsgSender).
      const addressIsMsgSender = node.addressExpression instanceof NullaryOpNode
        && node.addressExpression.operator === NullaryOperator.MSG_SENDER;
      // Address-literal target `IFoo(0x..).m()`: the expected address is a code-baked constant the covenant
      // pushes (NOT a caller input). A 20-byte ETH literal is not a 35-byte BCH locking bytecode -> the
      // identity check is un-satisfiable in production (fails closed); a genuine locking-bytecode literal is
      // callable. Only a real HexLiteralNode qualifies (a codegenError placeholder does not). Conservative:
      // any unrecognised address shape leaves all sources unset so emitExternalCallVerification still throws.
      const addressLiteral = node.addressExpression instanceof HexLiteralNode
        && !node.addressExpression.codegenError
        ? binToHex(node.addressExpression.value) : undefined;
      // Determine if selector verification is needed: only when the callee interface
      // has >1 callable function AND mode is REGULAR (call/staticcall skip selectors)
      const callMode = node.callInfo.callMode;
      let needsSelectorVerification = false;
      if (!callMode || callMode === ExternalCallMode.REGULAR) {
        const calleeFns = this.getCalleeFunctions(node.callInfo.interfaceName);
        if (calleeFns) needsSelectorVerification = calleeFns.length > 1;
      }
      // A same-address varying-method pointer always needs selector verification (the covenant binds the
      // co-spent method to the runtime selector, even if the callee has only these two functions).
      if (node.runtimeSelector) needsSelectorVerification = true;
      // A varying-method array dispatch table needs per-element selector verification: the loop reads each
      // element's on-chain selector from the parallel selector array and binds the co-spent method to it.
      if (node.selectorArrayVar) needsSelectorVerification = true;

      // Callee data NFT count (for computedOffset + commitment preservation). Interface: from its computed
      // layout; contract callee: from its state vars' nftIndex. A wrong count fails loudly at the dispatch's
      // address EQUALVERIFY (it reads the wrong input), so this is fail-safe, not silently unsound.
      const callIface = this.interfaceMap.get(node.callInfo.interfaceName);
      let dataNftIndices: number[] = [];
      if (callIface) {
        const layout = this.computeInterfaceStateLayout(callIface);
        if (layout.length > 0) {
          const dataNftCount = Math.max(...layout.map((v) => v.nftIndex)) + 1;
          dataNftIndices = Array.from({ length: dataNftCount }, (_, i) => i);
        }
      } else {
        const calleeContract = this.contractMap.get(node.callInfo.interfaceName);
        if (calleeContract && calleeContract.stateVariables.length > 0) {
          const dataNftCount = Math.max(...calleeContract.stateVariables.map((sv) => sv.nftIndex ?? 0)) + 1;
          dataNftIndices = Array.from({ length: dataNftCount }, (_, i) => i);
        }
      }

      // Classify arg sources: map each call-site parameter to its origin
      const argSources: ExternalCallArgSource[] = [];
      const userVisibleParams = this.currentFunction?.parameters.filter(
        (p) => !p.name.startsWith('__internal__'),
      ) ?? [];
      for (const param of node.parameters) {
        if (param instanceof IdentifierNode && param.definition) {
          const defNode = param.definition.definition;
          if (defNode instanceof ParameterNode) {
            const funcIdx = userVisibleParams.indexOf(defNode);
            if (funcIdx >= 0) {
              argSources.push({ kind: 'forward', paramIndex: funcIdx });
              continue;
            }
            const ctorIdx = this.currentContract?.parameters.indexOf(defNode);
            if (ctorIdx !== undefined && ctorIdx >= 0) {
              argSources.push({ kind: 'constructorArg', paramName: defNode.name });
              continue;
            }
          }
        }
        if (param instanceof IntLiteralNode) {
          argSources.push({ kind: 'literal', value: param.value.toString(), type: 'bigint' });
          continue;
        }
        if (param instanceof BoolLiteralNode) {
          argSources.push({ kind: 'literal', value: param.value.toString(), type: 'bool' });
          continue;
        }
        if (param instanceof StringLiteralNode) {
          argSources.push({ kind: 'literal', value: param.value, type: 'string' });
          continue;
        }
        if (param instanceof HexLiteralNode) {
          argSources.push({
            kind: 'literal',
            value: [...param.value].map((b) => b.toString(16).padStart(2, '0')).join(''),
            type: `bytes${param.value.byteLength}`,
          });
          continue;
        }
        argSources.push({ kind: 'expression' });
      }

      slots.push({
        interfaceName: node.callInfo.interfaceName,
        functionName: node.callInfo.functionName,
        addressParam,
        addressStateVar,
        loopArrayVar,
        ...(node.selectorArrayVar && { selectorArrayVar: node.selectorArrayVar }),
        ...(addressLiteral && { addressLiteral }),
        ...(addressIsMsgSender && { addressIsMsgSender: true }),
        slotIndex: -1,
        requiredDataNftIndices: dataNftIndices,
        computedOffset: 0,
        needsSelectorVerification,
        // A foreign fn-ptr call (synthesized `__FnPtr_` interface): the callee master input index is a per-call
        // runtime param the SDK fills, not a fixed block offset (the callee's layout is unknown at compile time).
        ...(node.callInfo.interfaceName.startsWith('__FnPtr_') && { fnPtrCall: true }),
        ...(node.runtimeSelector && { runtimeSelector: node.runtimeSelector }),
        ...(node.opaqueReturn && { opaqueReturn: true }),
        ...(callMode && callMode !== ExternalCallMode.REGULAR && { callMode }),
        ...(node.callInfo.hasReturnValues && {
          hasReturnValues: true,
          returnTypes: node.callInfo.returnTypes,
          returnEventSignature: node.callInfo.returnEventSignature,
        }),
        ...(argSources.length > 0 && { argSources }),
      });
      return;
    }

    // Generic recursion
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.collectExternalCalls(stmt, slots);
      }
    }
    if ('expression' in node && (node as any).expression instanceof Node) {
      this.collectExternalCalls((node as any).expression, slots);
    }
    // FunctionCallStatementNode holds its internal call in `call`; its args may contain external calls
    // (e.g. `_update(token0.balanceOf(this), ...)`). Must mirror assignExternalCallSlotIndices exactly.
    if ('call' in node && (node as any).call instanceof Node) {
      this.collectExternalCalls((node as any).call, slots);
    }
    // ReturnNode holds its values in `expressions` (plural): `return (...) / token.balanceOf(this);`.
    if ('expressions' in node && Array.isArray((node as any).expressions)) {
      for (const e of (node as any).expressions) if (e instanceof Node) this.collectExternalCalls(e, slots);
    }
    if ('tuple' in node && (node as any).tuple instanceof Node) {
      this.collectExternalCalls((node as any).tuple, slots);
    }
    if ('tupleExpressions' in node && Array.isArray((node as any).tupleExpressions)) {
      for (const e of (node as any).tupleExpressions) { if (e instanceof Node) this.collectExternalCalls(e, slots); }
    }
    if ('addressExpression' in node && (node as any).addressExpression instanceof Node) {
      this.collectExternalCalls((node as any).addressExpression, slots);
    }
    if ('left' in node && (node as any).left instanceof Node) {
      this.collectExternalCalls((node as any).left, slots);
    }
    if ('right' in node && (node as any).right instanceof Node) {
      this.collectExternalCalls((node as any).right, slots);
    }
    if ('condition' in node && (node as any).condition instanceof Node) {
      this.collectExternalCalls((node as any).condition, slots);
    }
    if ('ifTrue' in node && (node as any).ifTrue instanceof Node) {
      this.collectExternalCalls((node as any).ifTrue, slots);
    }
    if ('ifFalse' in node && (node as any).ifFalse instanceof Node) {
      this.collectExternalCalls((node as any).ifFalse, slots);
    }
    if ('args' in node && Array.isArray((node as any).args)) {
      for (const a of (node as any).args) {
        if (a instanceof Node) this.collectExternalCalls(a, slots);
      }
    }
    if ('value' in node && (node as any).value instanceof Node) {
      this.collectExternalCalls((node as any).value, slots);
    }
    if ('selector' in node && (node as any).selector instanceof Node) {
      this.collectExternalCalls((node as any).selector, slots);
    }
    if ('signature' in node && (node as any).signature instanceof Node) {
      this.collectExternalCalls((node as any).signature, slots);
    }
    if ('ifBlock' in node) this.collectExternalCalls((node as any).ifBlock, slots);
    if ('elseBlock' in node && (node as any).elseBlock) this.collectExternalCalls((node as any).elseBlock, slots);
    if ('block' in node && (node as any).block) this.collectExternalCalls((node as any).block, slots);
    if ('body' in node && (node as any).body) this.collectExternalCalls((node as any).body, slots);
    if ('cases' in node && Array.isArray((node as any).cases)) {
      for (const c of (node as any).cases) { if (c instanceof Node) this.collectExternalCalls(c, slots); }
    }
    if ('defaultCase' in node && (node as any).defaultCase instanceof Node) {
      this.collectExternalCalls((node as any).defaultCase, slots);
    }
    if ('object' in node && (node as any).object instanceof Node) {
      this.collectExternalCalls((node as any).object, slots);
    }
    if ('parameters' in node && Array.isArray((node as any).parameters)) {
      for (const param of (node as any).parameters) {
        if (param instanceof Node) this.collectExternalCalls(param, slots);
      }
    }
  }

  private assignExternalCallSlotIndices(node: Node, slots: ExternalCallSlot[], counter: { idx: number }): void {
    if (node instanceof ExternalFunctionCallNode && node.callInfo) {
      // Each call site was collected in traversal order, so the counter matches
      const slot = slots[counter.idx];
      if (slot) {
        node.callInfo.externalCallSlotIndex = slot.slotIndex;
        if (slot.returnSlotIndex !== undefined) {
          node.callInfo.returnSlotIndex = slot.returnSlotIndex;
        }
      }
      counter.idx++;
      return;
    }

    // Generic recursion (same traversal order as collectExternalCalls)
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.assignExternalCallSlotIndices(stmt, slots, counter);
      }
    }
    if ('expression' in node && (node as any).expression instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).expression, slots, counter);
    }
    // FunctionCallStatementNode holds its internal call in `call` (mirror collectExternalCalls exactly).
    if ('call' in node && (node as any).call instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).call, slots, counter);
    }
    // ReturnNode holds its values in `expressions` (plural) (mirror collectExternalCalls exactly).
    if ('expressions' in node && Array.isArray((node as any).expressions)) {
      for (const e of (node as any).expressions) {
        if (e instanceof Node) this.assignExternalCallSlotIndices(e, slots, counter);
      }
    }
    if ('tuple' in node && (node as any).tuple instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).tuple, slots, counter);
    }
    if ('tupleExpressions' in node && Array.isArray((node as any).tupleExpressions)) {
      for (const e of (node as any).tupleExpressions) {
        if (e instanceof Node) this.assignExternalCallSlotIndices(e, slots, counter);
      }
    }
    if ('callNode' in node && (node as any).callNode instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).callNode, slots, counter);
    }
    if ('addressExpression' in node && (node as any).addressExpression instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).addressExpression, slots, counter);
    }
    if ('left' in node && (node as any).left instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).left, slots, counter);
    }
    if ('right' in node && (node as any).right instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).right, slots, counter);
    }
    if ('condition' in node && (node as any).condition instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).condition, slots, counter);
    }
    if ('ifTrue' in node && (node as any).ifTrue instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).ifTrue, slots, counter);
    }
    if ('ifFalse' in node && (node as any).ifFalse instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).ifFalse, slots, counter);
    }
    if ('args' in node && Array.isArray((node as any).args)) {
      for (const a of (node as any).args) {
        if (a instanceof Node) this.assignExternalCallSlotIndices(a, slots, counter);
      }
    }
    if ('value' in node && (node as any).value instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).value, slots, counter);
    }
    if ('selector' in node && (node as any).selector instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).selector, slots, counter);
    }
    if ('signature' in node && (node as any).signature instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).signature, slots, counter);
    }
    if ('ifBlock' in node) this.assignExternalCallSlotIndices((node as any).ifBlock, slots, counter);
    if ('elseBlock' in node && (node as any).elseBlock) this.assignExternalCallSlotIndices((node as any).elseBlock, slots, counter);
    if ('block' in node && (node as any).block) this.assignExternalCallSlotIndices((node as any).block, slots, counter);
    if ('body' in node && (node as any).body) this.assignExternalCallSlotIndices((node as any).body, slots, counter);
    if ('cases' in node && Array.isArray((node as any).cases)) {
      for (const c of (node as any).cases) { if (c instanceof Node) this.assignExternalCallSlotIndices(c, slots, counter); }
    }
    if ('defaultCase' in node && (node as any).defaultCase instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).defaultCase, slots, counter);
    }
    if ('object' in node && (node as any).object instanceof Node) {
      this.assignExternalCallSlotIndices((node as any).object, slots, counter);
    }
    if ('parameters' in node && Array.isArray((node as any).parameters)) {
      for (const param of (node as any).parameters) {
        if (param instanceof Node) this.assignExternalCallSlotIndices(param, slots, counter);
      }
    }
  }

  private collectExternalOutStateReads(node: Node, map: Map<string, ExternalOutStateSlot>): void {
    if (node instanceof ExternalOutputStateAccessNode && node.accessInfo) {
      const key = `${node.accessInfo.interfaceName}:outState:${node.accessInfo.nftIndex}`;
      const existing = map.get(key);
      if (existing) {
        if (!existing.requiredDataNftIndices.includes(node.accessInfo.nftIndex)) {
          existing.requiredDataNftIndices.push(node.accessInfo.nftIndex);
          existing.requiredDataNftIndices.sort((a, b) => a - b);
        }
      } else {
        const addressParam = node.outStateNode.addressExpression instanceof IdentifierNode
          ? node.outStateNode.addressExpression.name : undefined;
        map.set(key, {
          interfaceName: node.accessInfo.interfaceName,
          addressParam,
          slotIndex: -1,
          requiredDataNftIndices: [node.accessInfo.nftIndex],
        });
      }
      return;
    }

    // Generic recursion
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.collectExternalOutStateReads(stmt, map);
      }
    }
    if ('expression' in node && (node as any).expression instanceof Node) {
      this.collectExternalOutStateReads((node as any).expression, map);
    }
    if ('tuple' in node && (node as any).tuple instanceof Node) {
      this.collectExternalOutStateReads((node as any).tuple, map);
    }
    if ('tupleExpressions' in node && Array.isArray((node as any).tupleExpressions)) {
      for (const e of (node as any).tupleExpressions) { if (e instanceof Node) this.collectExternalOutStateReads(e, map); }
    }
    if ('outStateNode' in node && (node as any).outStateNode instanceof Node) {
      this.collectExternalOutStateReads((node as any).outStateNode, map);
    }
    if ('addressExpression' in node && (node as any).addressExpression instanceof Node) {
      this.collectExternalOutStateReads((node as any).addressExpression, map);
    }
    if ('left' in node && (node as any).left instanceof Node) {
      this.collectExternalOutStateReads((node as any).left, map);
    }
    if ('right' in node && (node as any).right instanceof Node) {
      this.collectExternalOutStateReads((node as any).right, map);
    }
    if ('ifBlock' in node) this.collectExternalOutStateReads((node as any).ifBlock, map);
    if ('elseBlock' in node && (node as any).elseBlock) this.collectExternalOutStateReads((node as any).elseBlock, map);
    if ('block' in node && (node as any).block) this.collectExternalOutStateReads((node as any).block, map);
    if ('body' in node && (node as any).body) this.collectExternalOutStateReads((node as any).body, map);
    if ('cases' in node && Array.isArray((node as any).cases)) {
      for (const c of (node as any).cases) { if (c instanceof Node) this.collectExternalOutStateReads(c, map); }
    }
    if ('defaultCase' in node && (node as any).defaultCase instanceof Node) {
      this.collectExternalOutStateReads((node as any).defaultCase, map);
    }
    if ('object' in node && (node as any).object instanceof Node) {
      this.collectExternalOutStateReads((node as any).object, map);
    }
    if ('parameters' in node && Array.isArray((node as any).parameters)) {
      for (const param of (node as any).parameters) {
        if (param instanceof Node) this.collectExternalOutStateReads(param, map);
      }
    }
  }

  private assignExternalOutStateSlotIndices(node: Node, map: Map<string, ExternalOutStateSlot>): void {
    if (node instanceof ExternalOutputStateAccessNode && node.accessInfo) {
      const key = `${node.accessInfo.interfaceName}:outState:${node.accessInfo.nftIndex}`;
      const slot = map.get(key);
      if (slot) node.accessInfo.externalOutStateSlotIndex = slot.slotIndex;
      return;
    }

    // Generic recursion
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.assignExternalOutStateSlotIndices(stmt, map);
      }
    }
    if ('expression' in node && (node as any).expression instanceof Node) {
      this.assignExternalOutStateSlotIndices((node as any).expression, map);
    }
    if ('tuple' in node && (node as any).tuple instanceof Node) {
      this.assignExternalOutStateSlotIndices((node as any).tuple, map);
    }
    if ('tupleExpressions' in node && Array.isArray((node as any).tupleExpressions)) {
      for (const e of (node as any).tupleExpressions) {
        if (e instanceof Node) this.assignExternalOutStateSlotIndices(e, map);
      }
    }
    if ('outStateNode' in node && (node as any).outStateNode instanceof Node) {
      this.assignExternalOutStateSlotIndices((node as any).outStateNode, map);
    }
    if ('addressExpression' in node && (node as any).addressExpression instanceof Node) {
      this.assignExternalOutStateSlotIndices((node as any).addressExpression, map);
    }
    if ('left' in node && (node as any).left instanceof Node) {
      this.assignExternalOutStateSlotIndices((node as any).left, map);
    }
    if ('right' in node && (node as any).right instanceof Node) {
      this.assignExternalOutStateSlotIndices((node as any).right, map);
    }
    if ('ifBlock' in node) this.assignExternalOutStateSlotIndices((node as any).ifBlock, map);
    if ('elseBlock' in node && (node as any).elseBlock) this.assignExternalOutStateSlotIndices((node as any).elseBlock, map);
    if ('block' in node && (node as any).block) this.assignExternalOutStateSlotIndices((node as any).block, map);
    if ('body' in node && (node as any).body) this.assignExternalOutStateSlotIndices((node as any).body, map);
    if ('cases' in node && Array.isArray((node as any).cases)) {
      for (const c of (node as any).cases) { if (c instanceof Node) this.assignExternalOutStateSlotIndices(c, map); }
    }
    if ('defaultCase' in node && (node as any).defaultCase instanceof Node) {
      this.assignExternalOutStateSlotIndices((node as any).defaultCase, map);
    }
    if ('object' in node && (node as any).object instanceof Node) {
      this.assignExternalOutStateSlotIndices((node as any).object, map);
    }
    if ('parameters' in node && Array.isArray((node as any).parameters)) {
      for (const param of (node as any).parameters) {
        if (param instanceof Node) this.assignExternalOutStateSlotIndices(param, map);
      }
    }
  }

  // C1/piece-3: is the delegatecall's target a compile-time P2PKH-address literal (the classic placeholder)? A
  // real delegate is a P2SH covenant; a P2PKH target authorizes nothing, so keep the C1 warning rather than pin
  // an unsound target. Resolves `impl` through a local `address impl = address(0x..)` initializer.
  private delegatecallTargetsP2pkhLiteral(body: Node | undefined): boolean {
    const call = this.findDelegatecallNode(body);
    if (!call) return false;
    const bytes = this.resolveConstAddressBytes(call.targetExpression, body);
    return bytes !== undefined && bytes.length === 25
      && bytes[0] === 0x76 && bytes[1] === 0xa9 && bytes[2] === 0x14
      && bytes[23] === 0x88 && bytes[24] === 0xac;
  }

  private findDelegatecallNode(
    node: Node | undefined, seen: Set<Node> = new Set(),
  ): LowLevelCallNode | LowLevelCallStatementNode | undefined {
    if (!node || seen.has(node)) return undefined;
    seen.add(node);
    if ((node instanceof LowLevelCallNode || node instanceof LowLevelCallStatementNode)
      && node.callMode === 'delegatecall'
      && !(node instanceof LowLevelCallStatementNode && node.synthesizedFromLibraryCall)) {
      return node;
    }
    for (const v of Object.values(node)) {
      if (v instanceof Node) { const r = this.findDelegatecallNode(v, seen); if (r) return r; } else if (Array.isArray(v)) {
        for (const e of v) if (e instanceof Node) { const r = this.findDelegatecallNode(e, seen); if (r) return r; }
      }
    }
    return undefined;
  }

  // Resolve an address expression to its constant bytes, if statically known: a `bytesN`/hex literal, an
  // `address(0x..)` cast of one, or a local declared as `address x = <const>`.
  private resolveConstAddressBytes(expr: ExpressionNode | undefined, body: Node | undefined): Uint8Array | undefined {
    if (!expr) return undefined;
    if (expr instanceof HexLiteralNode) return expr.value;
    if (expr instanceof CastNode) return this.resolveConstAddressBytes(expr.expression, body);
    if (expr instanceof IdentifierNode) {
      const def = this.findLocalInit(body, expr.name);
      if (def) return this.resolveConstAddressBytes(def, body);
    }
    return undefined;
  }

  private findLocalInit(node: Node | undefined, name: string, seen: Set<Node> = new Set()): ExpressionNode | undefined {
    if (!node || seen.has(node)) return undefined;
    seen.add(node);
    if (node instanceof VariableDefinitionNode && node.name === name && node.expression) return node.expression;
    for (const v of Object.values(node)) {
      if (v instanceof Node) { const r = this.findLocalInit(v, name, seen); if (r) return r; } else if (Array.isArray(v)) {
        for (const e of v) if (e instanceof Node) { const r = this.findLocalInit(e, name, seen); if (r) return r; }
      }
    }
    return undefined;
  }

  // C1/B: does this subtree write contract state (state-var / mapping / state-array assign or delete)? A
  // delegatecall function must not, since it skips its own state authorization. Cycle-safe (seen set).
  private hasStateWrite(node: Node | undefined, seen: Set<Node> = new Set()): boolean {
    if (!node || seen.has(node)) return false;
    seen.add(node);
    if (node instanceof StateAssignNode || node instanceof MappingAssignNode
      || node instanceof StateArrayAssignNode || node instanceof MappingFieldAssignNode
      || node instanceof DeleteStateNode || node instanceof MappingDeleteNode
      || node instanceof StateArrayPushNode || node instanceof StateArrayPopNode
      || node instanceof StateArrayDeleteNode) {
      return true;
    }
    for (const v of Object.values(node)) {
      if (v instanceof Node) { if (this.hasStateWrite(v, seen)) return true; } else if (Array.isArray(v)) {
        for (const e of v) if (e instanceof Node && this.hasStateWrite(e, seen)) return true;
      }
    }
    return false;
  }

  // C1 helpers: detect a user-written delegatecall (excluding library-call sugar) and a signature-based access
  // guard. Recurse into AST children only; a `seen` set breaks cycles from resolved-symbol back-references
  // (e.g. FunctionCallNode.resolvedFunction on a recursive call).
  private hasExplicitDelegatecall(node: Node | undefined, seen: Set<Node> = new Set()): boolean {
    if (!node || seen.has(node)) return false;
    seen.add(node);
    if ((node instanceof LowLevelCallNode || node instanceof LowLevelCallStatementNode)
      && node.callMode === 'delegatecall'
      && !(node instanceof LowLevelCallStatementNode && node.synthesizedFromLibraryCall)) {
      return true;
    }
    for (const v of Object.values(node)) {
      if (v instanceof Node) { if (this.hasExplicitDelegatecall(v, seen)) return true; } else if (Array.isArray(v)) {
        for (const e of v) if (e instanceof Node && this.hasExplicitDelegatecall(e, seen)) return true;
      }
    }
    return false;
  }

  private hasSignatureGuard(node: Node | undefined, seen: Set<Node> = new Set()): boolean {
    if (!node || seen.has(node)) return false;
    seen.add(node);
    if (node instanceof FunctionCallNode
      && (node.identifier.name === 'checkSig' || node.identifier.name === 'checkMultiSig'
        || node.identifier.name === 'checkDataSig')) {
      return true;
    }
    for (const v of Object.values(node)) {
      if (v instanceof Node) { if (this.hasSignatureGuard(v, seen)) return true; } else if (Array.isArray(v)) {
        for (const e of v) if (e instanceof Node && this.hasSignatureGuard(e, seen)) return true;
      }
    }
    return false;
  }

  private canonicalizeExpression(node: ExpressionNode): string {
    if (node instanceof IdentifierNode) {
      return `id:${node.name}`;
    }
    if (node instanceof StateAccessNode) {
      return `state:${node.name}`;
    }
    if (node instanceof LiteralNode) {
      return `lit:${node.toString()}`;
    }
    if (node instanceof FunctionCallNode) {
      const args = node.parameters.map((p) => this.canonicalizeExpression(p)).join(',');
      return `call:${node.identifier.name}(${args})`;
    }
    if (node instanceof BinaryOpNode) {
      return `binop:${node.operator}(${this.canonicalizeExpression(node.left)},${this.canonicalizeExpression(node.right)})`;
    }
    if (node instanceof UnaryOpNode) {
      return `unop:${node.operator}(${this.canonicalizeExpression(node.expression)})`;
    }
    if (node instanceof CastNode) {
      return `cast:${node.type.toString()}(${this.canonicalizeExpression(node.expression)})`;
    }
    if (node instanceof NullaryOpNode) {
      return `nullop:${node.operator}`;
    }
    if (node instanceof TernaryOpNode) {
      return `ternary(${this.canonicalizeExpression(node.condition)},${this.canonicalizeExpression(node.ifTrue)},${this.canonicalizeExpression(node.ifFalse)})`;
    }
    if (node instanceof SliceNode) {
      return `slice(${this.canonicalizeExpression(node.element)},${this.canonicalizeExpression(node.start)},${this.canonicalizeExpression(node.end)})`;
    }
    if (node instanceof TupleIndexOpNode) {
      return `tidx(${this.canonicalizeExpression(node.tuple)},${node.index})`;
    }
    if (node instanceof ArrayAccessNode) {
      return `arridx(${this.canonicalizeExpression(node.array)},${this.canonicalizeExpression(node.index)})`;
    }
    if (node instanceof MappingAccessNode) {
      const keys = node.keys.map((k) => this.canonicalizeExpression(k)).join(',');
      return `map:${node.name}(${keys})`;
    }
    if (node instanceof InstantiationNode) {
      const args = node.parameters.map((p) => this.canonicalizeExpression(p)).join(',');
      return `new:${node.identifier.name}(${args})`;
    }
    // Composite-key idioms (struct/contract field, method calls, hashing over abi.encode*, bytes/string concat).
    // Each MUST fold its operands in so two source-distinct keys never share a canonical string (finding C4).
    if (node instanceof FieldAccessNode) {
      return `field:${node.name}(${this.canonicalizeExpression(node.expression)})`;
    }
    if (node instanceof MethodCallNode) {
      const args = node.parameters.map((p) => this.canonicalizeExpression(p)).join(',');
      return `method:${node.methodName}(${this.canonicalizeExpression(node.object)};${args})`;
    }
    if (node instanceof AbiEncodeNode) {
      return `abienc(${node.parameters.map((p) => this.canonicalizeExpression(p)).join(',')})`;
    }
    if (node instanceof AbiEncodePackedNode) {
      return `abiencpacked(${node.parameters.map((p) => this.canonicalizeExpression(p)).join(',')})`;
    }
    if (node instanceof AbiEncodeWithSelectorNode) {
      const args = node.parameters.map((p) => this.canonicalizeExpression(p)).join(',');
      return `abiencsel(${this.canonicalizeExpression(node.selector)};${args})`;
    }
    if (node instanceof AbiEncodeWithSignatureNode) {
      const args = node.parameters.map((p) => this.canonicalizeExpression(p)).join(',');
      return `abiencsig(${this.canonicalizeExpression(node.signature)};${args})`;
    }
    if (node instanceof AbiEncodeCallNode) {
      const args = node.parameters.map((p) => this.canonicalizeExpression(p)).join(',');
      return `abienccall:${node.interfaceName}.${node.functionName}(${args})`;
    }
    if (node instanceof BytesConcatNode) {
      return `bytescat(${node.parameters.map((p) => this.canonicalizeExpression(p)).join(',')})`;
    }
    if (node instanceof StringConcatNode) {
      return `strcat(${node.parameters.map((p) => this.canonicalizeExpression(p)).join(',')})`;
    }
    if (node instanceof ArrayNode) {
      return `arr(${node.elements.map((e) => this.canonicalizeExpression(e)).join(',')})`;
    }
    if (node instanceof NewArrayNode) {
      return `newarr:${node.elementType.toString()}(${this.canonicalizeExpression(node.size)})`;
    }
    // Generic structural fallback for every other expression type. Must remain operand-injective: silently
    // collapsing two distinct keys into one entry slot is the C4 state-write mis-targeting bug.
    return this.canonicalizeGeneric(node);
  }

  // Structural, operand-injective canonicalization for any expression not given an explicit case above. Recurses
  // into every child expression and folds primitive discriminants (names, operators, indices) into the string,
  // while skipping source locations, cached types and derived byte blobs that don't distinguish two source keys.
  // Hard-rejects a node that yields no operand content rather than risk a silent slot collapse (finding C4).
  private canonicalizeGeneric(node: ExpressionNode): string {
    const parts: string[] = [];
    for (const key of Object.keys(node).sort()) {
      if (key === 'location' || key === 'type') continue; // never identity-bearing for a key expression
      const enc = this.canonicalizeValue((node as any)[key]);
      if (enc !== '') parts.push(`${key}=${enc}`);
    }
    if (parts.length === 0) {
      throw new Error(
        `Cannot canonicalize mapping key of type '${node.constructor.name}': no distinguishing operands found. `
        + 'This key form is not supported as a mapping key; distinct keys could collapse to one storage slot.',
      );
    }
    return `${node.constructor.name}{${parts.join(',')}}`;
  }

  private canonicalizeValue(val: unknown): string {
    if (val instanceof ExpressionNode) return this.canonicalizeExpression(val);
    if (Array.isArray(val)) return `[${val.map((v) => this.canonicalizeValue(v)).join(',')}]`;
    const t = typeof val;
    if (t === 'string' || t === 'number' || t === 'bigint' || t === 'boolean') return String(val);
    return ''; // objects (location, Type, cached bytes, symbols): not identity-bearing for a key here
  }

  // A compile-time-constant uint mapping key (the OZ StorageSlot idiom `uint256(SLOT)` with a bytes32 constant
  // SLOT, or any `uint(<const>)`) folds to a fixed value the SDK matches the entry by - without it, a non-arg key
  // can't be located on a read. `uint(bytesN)` reinterprets the bytes as a little-endian script number; a numeric
  // constant folds directly. Returns the value, or undefined if not a resolvable constant uint key.
  private tryEvalConstantUintKey(key: ExpressionNode): bigint | undefined {
    if (!(key instanceof CastNode) || !(key.type instanceof IntType) || key.type.signed) return undefined;
    return this.evalConstantOperand(key.expression);
  }

  private evalConstantOperand(expr: ExpressionNode): bigint | undefined {
    if (expr instanceof IntLiteralNode) return expr.value;
    if (expr instanceof HexLiteralNode) {
      let v = 0n;
      for (let i = expr.value.length - 1; i >= 0; i--) v = (v << 8n) | BigInt(expr.value[i]); // little-endian
      return v;
    }
    if (expr instanceof IdentifierNode) {
      const cd = this.constantMap.get(expr.name);
      if (cd?.expression) return this.evalConstantOperand(cd.expression);
    }
    return undefined;
  }

  private classifyKeySource(key: ExpressionNode): KeySourceInfo {
    const constVal = this.tryEvalConstantUintKey(key);
    if (constVal !== undefined) {
      return { kind: 'constant', constantValue: constVal.toString(), canonical: `const:${constVal.toString()}` };
    }
    // A bare integer-literal key (`m[0]`): a fixed value the SDK matches the entry by directly - the
    // 'expression' placeholder route cannot locate an existing entry on a pure read (no arg to derive from).
    if (key instanceof IntLiteralNode) {
      return { kind: 'constant', constantValue: key.value.toString(), canonical: `const:${key.value.toString()}` };
    }
    if (key instanceof IdentifierNode) {
      if (this.currentFunction.parameters.some((p) => p.name === key.name)) {
        return { kind: 'param', paramName: key.name, canonical: `id:${key.name}` };
      }
      // An int-constant identifier key resolves the same way (params take precedence above).
      const cd = this.constantMap.get(key.name);
      if (cd?.expression instanceof IntLiteralNode) {
        const v = (cd.expression as IntLiteralNode).value.toString();
        return { kind: 'constant', constantValue: v, canonical: `const:${v}` };
      }
      // A local whose initializer is `arr[arr.length-1]` (IterableMapping's `lastKey`): resolvable from state.
      const def = this.localKeyDefs.get(key.name);
      const arrName = def && this.matchStateArrayLast(def);
      if (arrName) return { kind: 'stateArrayLast', stateArrayName: arrName, canonical: `lastof:${arrName}` };
      return { kind: 'expression', canonical: `id:${key.name}` };
    }
    if (key instanceof StateAccessNode) {
      return { kind: 'state', stateVarName: key.name, canonical: `state:${key.name}` };
    }
    // Inline `arr[arr.length-1]` used directly as a key.
    const arrName = this.matchStateArrayLast(key);
    if (arrName) return { kind: 'stateArrayLast', stateArrayName: arrName, canonical: `lastof:${arrName}` };
    return { kind: 'expression', canonical: this.canonicalizeExpression(key) };
  }

  // Collect simple `T local = <expr>;` initializers in the function body so a mapping key that is a local can be
  // resolved back to its initializer (see classifyKeySource). Shallow: a re-declared name keeps the first def.
  private collectLocalKeyDefs(node: Node | undefined): void {
    this.localKeyDefs = new Map();
    const walk = (n: Node | undefined): void => {
      if (!n) return;
      if (n instanceof VariableDefinitionNode && n.expression && !this.localKeyDefs.has(n.name)) {
        this.localKeyDefs.set(n.name, n.expression);
      }
      for (const k of Object.keys(n)) {
        if (k === 'type' || k === 'symbolTable' || k === 'location' || k === 'resolvedFunction') continue;
        const v = (n as unknown as Record<string, unknown>)[k];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) walk(it);
      }
    };
    walk(node);
  }

  // Returns the state array name A if `expr` is exactly `A[A.length - 1]` (a state array's last element), else
  // undefined. The SDK resolves this to the array's last element (a runtime-computed but state-derivable key).
  // Pre-semantic shape: `this.A[...]` is a MappingAccessNode (array-vs-mapping resolved later), `this.A.length`
  // is a UnaryOp(SIZE) over a StateAccess(A).
  private matchStateArrayLast(expr: ExpressionNode): string | undefined {
    if (!(expr instanceof MappingAccessNode) || expr.keys.length !== 1) return undefined;
    const arrName = expr.name;
    const idx = expr.keys[0];
    if (!(idx instanceof BinaryOpNode) || idx.operator !== BinaryOperator.MINUS) return undefined;
    if (!(idx.right instanceof IntLiteralNode) || idx.right.value !== 1n) return undefined;
    const len = idx.left;
    if (!(len instanceof UnaryOpNode) || len.operator !== UnaryOperator.SIZE) return undefined;
    if (!(len.expression instanceof StateAccessNode) || len.expression.name !== arrName) return undefined;
    return arrName;
  }

  // Mark each WRITE slot that is followed (in source order) by a DELETE of a DIFFERENT key on the SAME
  // collection (swap-remove's `m[a]=v; delete m[b]`). When a and b alias at runtime the write is redundant
  // (the delete wins) and the one entry NFT can't back both slots; the covenant then gates the write off and
  // the SDK funds it. Records the aliasing delete slot's index on the write slot's EntryAccessInfo.
  private detectAliasConditionalWrites(body: Node, ordered: EntryAccessInfo[]): void {
    const bySlotKey = new Map<string, EntryAccessInfo>();
    for (const info of ordered) bySlotKey.set(`${info.collection}:${info.keyParams.join(':')}`, info);
    const writeOrder = new Map<string, number>();
    const deleteOrder = new Map<string, number>();
    let order = 0;
    const scan = (n: Node | undefined): void => {
      if (!n) return;
      if (n instanceof MappingAssignNode && n.collection) {
        const { keyParams } = this.getMappingKeyDescriptors(n.keys);
        writeOrder.set(`${n.collection.name}:${keyParams.join(':')}`, order++);
      } else if (n instanceof MappingDeleteNode && n.collection) {
        const { keyParams } = this.getMappingKeyDescriptors(n.keys);
        deleteOrder.set(`${n.collection.name}:${keyParams.join(':')}`, order++);
      }
      for (const k of Object.keys(n)) {
        if (k === 'type' || k === 'symbolTable' || k === 'location' || k === 'resolvedFunction') continue;
        const v = (n as unknown as Record<string, unknown>)[k];
        if (v instanceof Node) scan(v);
        else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) scan(it);
      }
    };
    scan(body);

    for (const [wKey, wInfo] of bySlotKey) {
      if (!wInfo.operations.includes('write')) continue;
      const wOrder = writeOrder.get(wKey);
      if (wOrder === undefined) continue;
      for (const [dKey, dInfo] of bySlotKey) {
        if (dKey === wKey || dInfo.collection !== wInfo.collection || !dInfo.operations.includes('delete')) continue;
        const dOrder = deleteOrder.get(dKey);
        if (dOrder !== undefined && dOrder > wOrder) { wInfo.aliasCondDeleteSlot = dInfo.slotIndex; break; }
      }
    }
  }

  private getMappingKeyDescriptors(keys: ExpressionNode[]): { keyParams: string[]; keySources: KeySourceInfo[] } {
    const keyParams: string[] = [];
    const keySources: KeySourceInfo[] = [];
    for (const keyExpr of keys) {
      const source = this.classifyKeySource(keyExpr);
      keySources.push(source);
      keyParams.push(source.kind === 'param' ? source.paramName! : source.canonical);
    }
    return { keyParams, keySources };
  }

  visitBlock(node: BlockNode): Node {
    node.symbolTable = new SymbolTable(this.symbolTables[0]);
    this.symbolTables.unshift(node.symbolTable);

    node.statements = this.visitOptionalList(node.statements) as StatementNode[];
    // Splice desugar-produced statement groups (blocks without their own scope - e.g. the self low-level
    // call lowering) into this list, so a trailing ReturnNode stays visible to the may-return analyses.
    // Empty scopeless blocks (dropped statements, e.g. a bare enum-type ref) stay as placeholders - a body
    // whose only statement was dropped must not become empty (the empty-function check would reject it).
    node.statements = node.statements.flatMap(
      (s) => (s instanceof BlockNode && !s.scoped && !s.symbolTable && s.statements && s.statements.length > 0
        ? s.statements : [s]),
    );

    const unusedSymbols = node.symbolTable.unusedSymbols();
    for (const unused of unusedSymbols) {
      // Solidity only warns on unused vars/params and never fails the compile; match that.
      const uloc = unused.definition?.location ? ` at line ${unused.definition.location.start.line}` : '';
      console.log(`Warning: unused variable '${unused.name}'${uloc}.`);
    }

    this.symbolTables.shift();
    return node;
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    const existing = this.symbolTables[0].get(node.name);
    if (existing) {
      // Sequential `for (uint i ...)` loops reuse `i`: the for desugars to a flattened `{ init; while }`, so
      // the second init re-declares a name still in scope. Allow it only when both the old and new bindings
      // are loop variables (the prior loop is dead and its body already resolved in-order); set() overwrites.
      const existingDef = existing.definition as VariableDefinitionNode | undefined;
      const loopReuse = node.isLoopVariable && existingDef?.isLoopVariable;
      // A local may shadow an OUTER-scope function or state variable (both declared at contract/library level) -
      // e.g. a named return with the same name as its function, `function max(..) returns (int max)`, legal in
      // Solidity. set() below adds it to the inner scope, so the shadow resolves correctly. Shadowing an outer
      // LOCAL that is still live is NOT accepted: codegen slots locals by name, so a live shadow would reuse the
      // outer's slot and miscompile - a clean rejection is sound; disjoint sibling scopes reuse names fine.
      const shadowsOuter = this.compilerOptions.solidityImportCompat
        && (existing.symbolType === SymbolType.FUNCTION || existing.symbolType === SymbolType.STATE_VARIABLE);
      if (!loopReuse && !shadowsOuter) {
        throw new VariableRedefinitionError(node);
      }
    }

    if (node.expression) node.expression = this.visit(node.expression);

    // A local bound to `new C(...)` holds a contract this tx will CREATE as an output; it can never be
    // co-spent as an input in this same tx, so calling a method on it later is rejected (see the two
    // external-call sites below). Tracked per function body.
    if (node.expression instanceof InstantiationNode && node.expression.referencedContract) {
      this.deployResultLocals.set(node.name, node.expression);
    }

    this.symbolTables[0].set(Symbol.variable(node));
    // A synthesized binding allowed to be unused (e.g. a desugared for..of loop var): self-reference it so
    // the unused-variable check passes, matching collection iteration's loop variable.
    if (node.allowUnused) {
      const sym = this.symbolTables[0].get(node.name);
      if (sym) sym.references.push({ name: node.name } as IdentifierNode);
    }

    return node;
  }

  // Read-only enforcement, shared by every write path (assign, compound, element, push/pop, delete):
  // a top-level `constant`, a `constant`-modified binding, or a `calldata` binding cannot be written.
  // isReassign = a whole-variable `x = y` rebind (vs a DATA write: `x[i]=v`, `x.push()`, `delete x`, field write).
  // A calldata binding is read-only DATA, but rebinding the local pointer to another calldata value is allowed in
  // Solidity (`x = y; x[i]` reads y[i]) - it reduces to a value-copy of y into x. Only data writes are rejected.
  private checkReadOnlyModification(sym: Symbol, isReassign = false): void {
    if (sym.symbolType === SymbolType.CONSTANT) {
      throw new ConstantModificationError(sym.definition as ConstantDefinitionNode);
    }
    // Both VariableDefinitionNode (locals) and ParameterNode (params) expose `.modifier`.
    const v = sym.definition as VariableDefinitionNode;
    v?.modifier?.forEach((modifier) => {
      if (modifier === Modifier.CONSTANT) {
        throw new ConstantModificationError(v);
      }
      if (modifier === Modifier.CALLDATA) {
        // A whole `x = y` rebind is allowed ONLY for a calldata ARRAY: it rebinds the local pointer to y (reduces
        // to a value-copy). NOT structs - a calldata struct field write `s.a = v` desugars to a whole `s = S(..)`
        // rebuild, so allowing struct reassigns would silently permit writes into a read-only calldata struct.
        // Value-typed calldata (`int calldata`), compound (`x += 1` -> `x = x+1`), and element/field writes reject.
        const t = (sym.definition as { type?: Type })?.type;
        const isRefRebind = isReassign && t instanceof ArrayType;
        if (!isRefRebind) {
          throw new CalldataModificationError(v as VariableDefinitionNode | ParameterNode);
        }
      }
    });
  }

  visitAssign(node: AssignNode): Node {
    const sym = this.symbolTables[0].get(node.identifier.name);

    // Whole fixed-array copy `data2 = data1` between two fixed STATE arrays whose whole-array types are not
    // implicitly castable - the element types differ (`bytes2[N] = bytes1[N]`, cast per element) and/or the
    // lengths differ (`uint[40] = uint[20]`, copy the shared prefix then zero-fill the target's leftover, as
    // Solidity does). Desugar to element-wise writes over the compile-time bounds. Same-element same-length
    // copies stay whole (a normal assign); int widening is already implicitly castable.
    if (node.expression instanceof IdentifierNode) {
      const tgt = this.stateVariableMap.get(node.identifier.name)?.type;
      const src = this.stateVariableMap.get(node.expression.name)?.type;
      const sameElem = tgt instanceof ArrayType && src instanceof ArrayType
        && tgt.elementType.toString() === src.elementType.toString();
      const bytesWiden = tgt instanceof ArrayType && src instanceof ArrayType
        && tgt.elementType instanceof BytesType && src.elementType instanceof BytesType;
      if (tgt instanceof ArrayType && src instanceof ArrayType && tgt.bound !== undefined && src.bound !== undefined
        && (tgt.bound !== src.bound || !sameElem) && (sameElem || bytesWiden)) {
        const srcName = node.expression.name;
        const stmts: StatementNode[] = [];
        const lit = (i: number): IntLiteralNode => { const n = new IntLiteralNode(BigInt(i)); n.location = node.location; return n; };
        const copyN = Math.min(tgt.bound, src.bound);
        for (let i = 0; i < copyN; i++) {
          const srcId = new IdentifierNode(srcName); srcId.location = node.location;
          const read = new ArrayAccessNode(srcId, lit(i)); read.location = node.location;
          const rhs = sameElem ? read : new CastNode(tgt.elementType, read, false);
          rhs.location = node.location;
          const assign = new ArrayAssignNode(node.identifier.name, lit(i), rhs); assign.location = node.location;
          stmts.push(assign);
        }
        // Zero-fill the target's leftover elements (Solidity clears the tail on a shorter-source copy).
        for (let i = copyN; i < tgt.bound; i++) {
          const zero = createDefaultValueExpression(tgt.elementType, node.location!);
          const assign = new ArrayAssignNode(node.identifier.name, lit(i), zero); assign.location = node.location;
          stmts.push(assign);
        }
        const block = new BlockNode(stmts);
        block.location = node.location;
        return this.visit(block);
      }
    }

    // Bare write to a state variable `x = ...` (no shadowing local): route to a state assignment.
    if (sym?.symbolType === SymbolType.STATE_VARIABLE) {
      const stateNode = new StateAssignNode(node.identifier.name, node.expression);
      stateNode.location = node.location;
      stateNode.fromModifier = node.fromModifier; // preserve inlined-modifier origin for the private-var check
      return this.visit(stateNode);
    }

    // Whole-array copy into a fixed-size state array `arr = src` (no shadowing local, `src` an array
    // identifier) -> element-wise `arr[i] = src[i]` over the compile-time bound. Solidity supports whole
    // fixed-array assignment; solidcash writes state-array elements individually, so desugar it.
    if (!sym && node.expression instanceof IdentifierNode) {
      const coll = this.collectionMap.get(node.identifier.name);
      if (coll && coll.type instanceof ArrayType && coll.type.bound !== undefined) {
        const srcName = node.expression.name;
        const srcLoc = node.expression.location;
        const stmts: StatementNode[] = [];
        for (let i = 0; i < coll.type.bound; i++) {
          const srcId = new IdentifierNode(srcName);
          srcId.location = srcLoc;
          const readIdx = new IntLiteralNode(BigInt(i));
          readIdx.location = node.location;
          const rhsElem = new ArrayAccessNode(srcId, readIdx);
          rhsElem.location = node.location;
          const writeIdx = new IntLiteralNode(BigInt(i));
          writeIdx.location = node.location;
          const assign = new MappingAssignNode(node.identifier.name, [writeIdx], rhsElem);
          assign.location = node.location;
          stmts.push(assign);
        }
        const block = new BlockNode(stmts);
        block.location = node.location;
        return this.visit(block);
      }
    }

    if (sym) {
      this.checkReadOnlyModification(sym, true); // whole `x = y` rebind: allowed for calldata (pointer rebind)
    }

    super.visitAssign(node);
    // Reassignment of a deploy-result local (`d = new D();` again): later folded calls must bind to the
    // NEW deploy node - earlier folds correctly stay on the old one.
    if (node.expression instanceof InstantiationNode && node.expression.referencedContract) {
      this.deployResultLocals.set(node.identifier.name, node.expression);
    }
    return node;
  }

  // True when `name` is a state mapping/collection or a dense-indexable state array (packed or chunk-packed):
  // the bare-indexable state targets.
  private isStateCollectionName(name: string): boolean {
    if (this.collectionMap.has(name)) return true;
    const sv = this.stateVariableMap.get(name);
    return !!(sv && (sv.isPacked || sv.isDynamic) && sv.type instanceof ArrayType);
  }

  // Flatten a bare index chain `a[k1][k2]...` into its base expression and keys (base-first order).
  private flattenArrayAccess(node: ArrayAccessNode): { base: ExpressionNode; keys: ExpressionNode[] } {
    const keys: ExpressionNode[] = [];
    let cur: ExpressionNode = node;
    while (cur instanceof ArrayAccessNode) {
      keys.unshift(cur.index);
      cur = cur.array;
    }
    return { base: cur, keys };
  }

  visitTupleIndexOp(node: TupleIndexOpNode): Node {
    // `stateVar[numLit]` parses as a tuple index (grammar `expression '[' NumberLiteral ']'`), but a state
    // variable is never a tuple: route it through the array/mapping access path like `stateVar[k]`.
    if (node.tuple instanceof IdentifierNode
      && (this.isStateCollectionName(node.tuple.name)
        || this.symbolTables[0].get(node.tuple.name)?.symbolType === SymbolType.STATE_VARIABLE)) {
      const idx = new IntLiteralNode(BigInt(node.index));
      idx.location = node.location;
      const access = new ArrayAccessNode(node.tuple, idx);
      access.location = node.location;
      return this.visit(access);
    }
    return super.visitTupleIndexOp(node);
  }

  visitArrayAccess(node: ArrayAccessNode): Node {
    // Bare state read `m[k]` / `m[k1][k2]` (no shadowing local): resolve as `this.m[...]`. Build one
    // MappingAccessNode with all keys and let visitMappingAccess do the multi-key/packed-array resolution.
    const flat = this.flattenArrayAccess(node);
    if (flat.base instanceof IdentifierNode
      && this.isStateCollectionName(flat.base.name)
      && !this.isShadowedByLocal(flat.base.name)) {
      const mapNode = new MappingAccessNode(flat.base.name, flat.keys);
      mapNode.location = node.location;
      return this.visit(mapNode);
    }

    node.array = this.visit(node.array);
    node.index = this.visit(node.index);

    // If the array is an ExternalMappingAccessNode, append the key
    if (node.array instanceof ExternalMappingAccessNode) {
      const extNode = node.array;
      extNode.keys.push(node.index);
      // If all keys have been collected, set the type to the innermost value type
      if (extNode.readInfo && extNode.keys.length === extNode.readInfo.keyTypes.length) {
        extNode.type = extNode.readInfo.valueType;
      }
      return extNode;
    }

    return node;
  }

  visitArrayPush(node: ArrayPushNode): Node {
    const sym = this.symbolTables[0].get(node.name);
    if (!sym) {
      throw new UndefinedReferenceError({ name: node.name, location: node.location } as IdentifierNode);
    }
    this.checkReadOnlyModification(sym);
    if (sym.type instanceof ArrayType) {
      node.arrayType = sym.type;
    }
    // No-arg `arr.push()` default: build it here (replacing the int-0 placeholder) so a struct default resolves
    // via struct-constructor resolution, mirroring visitStateArrayPush. Also covers a push a loop-cache pass
    // rewrote onto a local array (CacheDynamicArrayInLoop), keeping while-grow `while (..) arr.push();` working.
    if (node.noArg && node.arrayType) {
      node.value = createDefaultValueExpression(node.arrayType.elementType, node.location!);
    }
    sym.references.push({ name: node.name } as IdentifierNode);
    this.currentFunction.opRolls.set(node.name, { name: node.name, location: node.location } as IdentifierNode);
    node.value = this.visit(node.value);
    return node;
  }

  visitArrayPop(node: ArrayPopNode): Node {
    const sym = this.symbolTables[0].get(node.name);
    if (!sym) {
      throw new UndefinedReferenceError({ name: node.name, location: node.location } as IdentifierNode);
    }
    this.checkReadOnlyModification(sym);
    if (sym.type instanceof ArrayType) {
      node.arrayType = sym.type;
    }
    sym.references.push({ name: node.name } as IdentifierNode);
    this.currentFunction.opRolls.set(node.name, { name: node.name, location: node.location } as IdentifierNode);
    return node;
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    // Bare write to a state mapping/array element `m[k] = ...` (no shadowing local): route to the matching
    // `this.m[k] = ...` path (packed state arrays use StateArrayAssignNode, mappings MappingAssignNode).
    if (this.isStateCollectionName(node.name) && !this.isShadowedByLocal(node.name)) {
      const sv = this.stateVariableMap.get(node.name);
      const stateNode = (sv?.isPacked || sv?.isDynamic) && sv?.type instanceof ArrayType
        ? new StateArrayAssignNode(node.name, node.index, node.value)
        : new MappingAssignNode(node.name, [node.index], node.value);
      stateNode.location = node.location;
      return this.visit(stateNode);
    }

    const sym = this.symbolTables[0].get(node.name);
    if (!sym) {
      throw new UndefinedReferenceError({ name: node.name, location: node.location } as IdentifierNode);
    }
    this.checkReadOnlyModification(sym);
    if (sym.type instanceof ArrayType) {
      node.arrayType = sym.type;
    }
    sym.references.push({ name: node.name } as IdentifierNode);
    this.currentFunction.opRolls.set(node.name, { name: node.name, location: node.location } as IdentifierNode);
    node.index = this.visit(node.index);
    node.value = this.visit(node.value);
    return node;
  }

  visitArrayDelete(node: ArrayDeleteNode): Node {
    const sym = this.symbolTables[0].get(node.name);
    if (!sym) {
      throw new UndefinedReferenceError({ name: node.name, location: node.location } as IdentifierNode);
    }
    this.checkReadOnlyModification(sym);
    if (sym.type instanceof ArrayType) {
      node.arrayType = sym.type;
    }
    sym.references.push({ name: node.name } as IdentifierNode);
    this.currentFunction.opRolls.set(node.name, { name: node.name, location: node.location } as IdentifierNode);
    node.index = this.visit(node.index);
    return node;
  }

  // Codegen emits a slice as split(end)-then-split(start), so it visits END before START. The final-use
  // (roll) analysis must traverse in that same order: a variable shared by both bounds would otherwise be
  // marked last-used at the END bound, get rolled there (codegen visits it first), and be gone when the
  // START bound reads it. Side-effectful bounds are hoisted to statement level by the postfix desugar, so
  // analysis order here does not change evaluation semantics.
  visitSlice(node: SliceNode): Node {
    node.element = this.visit(node.element);
    node.end = this.visit(node.end);
    node.start = this.visit(node.start);
    return node;
  }

  // A bare type reference as an expression statement (`A.Foo;`, `Arst.Foo;` after qualifier stripping) is
  // a Solidity no-op: the enum type name resolves as a valueless CONSTANT symbol that codegen cannot
  // materialize. Drop the statement.
  visitExpressionStatement(node: ExpressionStatementNode): Node {
    node.expression = this.visit(node.expression) as ExpressionNode;
    if (node.expression instanceof IdentifierNode) {
      const def = node.expression.definition;
      if (def !== undefined && def.symbolType === SymbolType.CONSTANT
        && def.definition === undefined && def.type instanceof EnumType) {
        const empty = new BlockNode([]);
        empty.location = node.location;
        return empty;
      }
    }
    return node;
  }

  // `(x, y) = <rhs>` where some target is a STATE variable: tuple codegen writes stack slots, which state
  // vars do not have. Rewrite to the hand-written form - capture the RHS into fresh temps, then assign each
  // target sequentially (visitAssign routes state targets to StateAssign). Temps keep swaps clobber-safe.
  // Struct/array/mapping targets keep their storage-pointer rebinding semantics and are left alone.
  private desugarStateTupleAssignment(node: TupleAssignmentNode): Node | undefined {
    if (node.elements.length === 0 || !node.elements.every((e) => e.existing && e.name)) return undefined;
    if (node.tupleExpressions && node.tupleExpressions.length !== node.elements.length) return undefined;
    const syms = node.elements.map((e) => this.symbolTables[0].get(e.name!));
    if (!syms.every((s) => s?.type)) return undefined;
    if (!syms.some((s) => s!.symbolType === SymbolType.STATE_VARIABLE)) return undefined;
    const plainScalar = (t: Type): boolean => !(t instanceof StructType)
      && !(t instanceof ArrayType) && !(t instanceof MappingType) && !(t instanceof TupleType);
    if (!syms.every((s) => plainScalar(s!.type!))) return undefined;

    const stmts: StatementNode[] = [];
    const tmpNames = node.elements.map(() => `__tuple_state_${this.tupleStateTempCounter++}`);
    if (node.tupleExpressions) {
      node.tupleExpressions.forEach((expr, i) => {
        const def = new VariableDefinitionNode(syms[i]!.type!, [], tmpNames[i], expr);
        def.location = node.location;
        stmts.push(def);
      });
    } else {
      // Single tuple-valued RHS (e.g. a multi-return call): destructure into temp declarations first.
      const decl = new TupleAssignmentNode(
        node.elements.map((_, i) => ({ name: tmpNames[i], type: syms[i]!.type! })),
        node.tuple, node.parenthesised,
      );
      decl.location = node.location;
      stmts.push(decl);
    }
    node.elements.forEach((e, i) => {
      const target = new IdentifierNode(e.name!);
      target.location = node.location;
      const value = new IdentifierNode(tmpNames[i]);
      value.location = node.location;
      const assign = new AssignNode(target, value);
      assign.location = node.location;
      stmts.push(assign);
    });
    const block = new BlockNode(stmts);
    block.location = node.location;
    return this.visit(block);
  }

  visitTupleAssignment(node: TupleAssignmentNode): Node {
    const stateDesugar = this.desugarStateTupleAssignment(node);
    if (stateDesugar) return stateDesugar;

    // Disallow mixing new declarations with existing-lvalue slots in one tuple assignment.
    const hasDeclaration = node.elements.some((e) => !e.skip && !e.existing);
    const hasExisting = node.elements.some((e) => e.existing);
    if (hasDeclaration && hasExisting) {
      throw new TupleMixedSlotsError(node);
    }

    node.elements.forEach((variable, i) => {
      if (variable.skip) return; // empty slot: value is dropped, no variable declared
      if (variable.existing) {
        // Existing lvalue: must already be declared; resolve to validate (codegen rolls into its slot).
        const sym = this.symbolTables[0].get(variable.name!);
        if (!sym) {
          throw new UndefinedReferenceError({ name: variable.name!, location: node.location } as IdentifierNode);
        }
        variable.type = sym.type; // record the declared type for the type-check assignability pass
        return;
      }
      const initializer = node.tupleExpressions ? node.tupleExpressions[i] : node.tuple;
      const definition = new VariableDefinitionNode(variable.type!, [], variable.name!, initializer);
      definition.location = node.location;

      if (this.symbolTables[0].get(variable.name!)) {
        throw new VariableRedefinitionError(definition);
      }
      this.symbolTables[0].set(Symbol.variable(definition));
    });

    if (node.tupleExpressions) {
      node.tupleExpressions = node.tupleExpressions.map((e) => this.visit(e) as ExpressionNode);
    } else {
      node.tuple = this.visit(node.tuple);
    }

    // Existing-lvalue targets are written here, so their slots must survive: drop them from opRolls so
    // their RHS/prior reads PICK instead of ROLL (mirrors how visitAssign protects an assigned var).
    node.elements.forEach((variable) => {
      if (variable.existing) this.currentFunction.opRolls.delete(variable.name!);
    });
    return node;
  }

  // Reorder named call arguments f({b:2,a:1}) into the function's declared parameter order.
  private reorderNamedCallArgs(func: FunctionDefinitionNode, node: FunctionCallNode): ExpressionNode[] {
    const fieldNames = node.fieldNames!;
    // Synthetic __internal__ params (e.g. returnOutputIdx on a public returning fn) are appended during
    // semantic analysis and never named at the call site; reorder only the user params - TypeCheck's
    // forwardInternalReturnOutputIdx appends the synthetic values to the now-positional call.
    const userParams = func.parameters.filter((p) => !p.name.startsWith('__internal__'));
    const paramNames = userParams.map((p) => p.name);
    const seen = new Set<string>();
    for (const name of fieldNames) {
      if (seen.has(name)) throw new NamedArgumentError(node, `Duplicate named argument '${name}'`);
      seen.add(name);
      if (!paramNames.includes(name)) {
        throw new NamedArgumentError(node, `Unknown named argument '${name}' for function '${func.name}'`);
      }
    }
    // using-for desugar: `recv.f({named})` arrives as `L.f(recv, named...)` - the receiver is positional,
    // fieldNames name only the tail. Keep args[0], reorder the tail against the params minus the receiver.
    if (fieldNames.length === paramNames.length - 1 && node.parameters.length === paramNames.length) {
      const tailParams = userParams.slice(1);
      return [
        node.parameters[0] as ExpressionNode,
        ...tailParams.map((p) => node.parameters[1 + fieldNames.indexOf(p.name)] as ExpressionNode),
      ];
    }
    if (fieldNames.length !== paramNames.length) {
      throw new NamedArgumentError(
        node,
        `Function '${func.name}' expects ${paramNames.length} arguments but got ${fieldNames.length}`,
      );
    }
    return userParams.map((p) => node.parameters[fieldNames.indexOf(p.name)] as ExpressionNode);
  }

  // Reorder named method args obj.f({b:2,a:1}) into the callee's declared parameter order.
  private reorderNamedArgsByParams(
    fieldNames: string[], params: { name: string }[], args: ExpressionNode[], node: Node, calleeLabel: string,
  ): ExpressionNode[] {
    const paramNames = params.map((p) => p.name);
    const seen = new Set<string>();
    for (const name of fieldNames) {
      if (seen.has(name)) throw new NamedArgumentError(node, `Duplicate named argument '${name}'`);
      seen.add(name);
      if (!paramNames.includes(name)) {
        throw new NamedArgumentError(node, `Unknown named argument '${name}' for ${calleeLabel}`);
      }
    }
    if (fieldNames.length !== paramNames.length) {
      throw new NamedArgumentError(node, `${calleeLabel} expects ${paramNames.length} arguments but got ${fieldNames.length}`);
    }
    return params.map((p) => args[fieldNames.indexOf(p.name)]);
  }

  // Inside a library function `Lib.f`, an unqualified call to a sibling library function (`b(..)`) resolves to
  // `Lib.b` (library functions are stored as namespaced free functions). Rewrites the identifier in place.
  private qualifyLibrarySiblingCall(identifier: IdentifierNode): void {
    const fnName = this.currentFunction?.name;
    if (fnName && fnName.includes('.') && !identifier.name.includes('.')) {
      const qualified = `${fnName.split('.')[0]}.${identifier.name}`;
      if (this.functionDefinitions.has(qualified)) identifier.name = qualified;
    }
  }

  // Inside a library function `Lib.f`, an unqualified reference to a sibling library constant (`A`) resolves to
  // `Lib.A` (library constants are stored namespaced). Only rewrites when no in-scope name shadows it, so a
  // local/param named `A` still wins (Solidity scoping). A library lowered to a contract (direct compile of a
  // library file) keeps bare function names, so qualify by the contract's library name there instead.
  private qualifyLibrarySiblingConstant(identifier: IdentifierNode): void {
    const fnName = this.currentFunction?.name;
    const libPrefix = fnName?.includes('.')
      ? fnName.split('.')[0]
      : (this.currentContract?.isLibraryContract ? this.currentContract.name : undefined);
    if (libPrefix && !identifier.name.includes('.') && !this.symbolTables[0].get(identifier.name)) {
      const qualified = `${libPrefix}.${identifier.name}`;
      if (this.symbolTables[0].get(qualified)) identifier.name = qualified;
    }
  }

  // visitUserFunctionCall/visitIndirectFunctionCall evaluate OP_INVOKE args in REVERSE order (first param
  // pushed last, on top), while this analysis marks final uses left-to-right. A variable referenced more than
  // once within one call's argument list would get its roll placed on a use codegen evaluates FIRST
  // (`g(v, v)`: the roll lands on arg1, codegen visits arg1 first and rolls v away, then arg0 reads a vanished
  // slot). Keep such variables PICK-only - the epilogue stack cleanup drops the leftover - which is sound
  // under either evaluation order. Single-arg lists are safe (reversal only reorders BETWEEN args).
  private protectDuplicateCallArgVars(parameters: ExpressionNode[]): void {
    if (!this.currentFunction || parameters.length < 2) return;
    const counter = new IdentifierNameCounter();
    for (const p of parameters) counter.visit(p);
    for (const [name, count] of counter.counts) {
      if (count >= 2) this.currentFunction.opRolls.delete(name);
    }
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    this.qualifyLibrarySiblingCall(node.identifier);
    // Check if this is an address method call: dest.send(amount), dest.connect(category),
    // dest.call(data), dest.staticcall(data)
    const callName = node.identifier.name;
    if (callName.includes('.')) {
      const [varName, methodName] = callName.split('.');
      const symbol = this.symbolTables[0]?.get(varName);
      if (symbol) {
        if (methodName === 'send' && node.parameters.length === 1) {
          const addrIdentifier = new IdentifierNode(varName);
          addrIdentifier.location = node.identifier.location;
          const visitedAddr = this.visit(addrIdentifier);
          const amount = this.visit(node.parameters[0]);
          const sendNode = new AddressSendExpressionNode(visitedAddr, amount);
          sendNode.location = node.location;
          return sendNode;
        }
        // EVM-parity expression-form low-level call: `(bool, bytes) = addr.call(payload)` co-spends the callee
        // and returns its REAL integrity-bound return (identity + return-event), where `payload` is built with
        // abi.encodeWithSignature/Selector. The statement form `addr.call(payload);` stays fire-and-forget
        // (LowLevelCallStatementNode, built in AstBuilder); the co-spend is supplied via .withExternalCall().
        if (methodName === 'call' && node.parameters.length === 1) {
          const addrId = new IdentifierNode(varName);
          addrId.location = node.identifier.location;
          const addressExpr = this.visit(addrId) as ExpressionNode;
          const varType = addressExpr.type
            ?? (addressExpr instanceof IdentifierNode ? addressExpr.definition?.type : undefined)
            ?? this.stateVariableMap.get(varName)?.type;
          if (varType instanceof AddressType) {
            const payloadExpr = this.visit(node.parameters[0]) as ExpressionNode;
            const callNode = new ExternalFunctionCallNode('__raw__', addressExpr, '__raw__', [payloadExpr]);
            callNode.opaqueReturn = true;
            callNode.type = new TupleType([PrimitiveType.BOOL, new BytesType()]);
            callNode.callInfo = {
              interfaceName: '__raw__',
              functionName: '__raw__',
              externalCallSlotIndex: -1,
              hasReturnValues: true,
              returnTypes: [new BytesType()],
              returnEventSignature: '_Return___raw__(bytes)',
              callMode: ExternalCallMode.REGULAR,
            };
            callNode.location = node.location;
            return callNode;
          }
        }

        // Low-level staticcall/delegatecall (and `call` on a non-address target) on a variable.
        if ((methodName === 'call' || methodName === 'staticcall' || methodName === 'delegatecall') && node.parameters.length === 1) {
          const addrIdentifier = new IdentifierNode(varName);
          addrIdentifier.location = node.identifier.location;
          const visitedAddr = this.visit(addrIdentifier) as ExpressionNode;
          const data = this.visit(node.parameters[0]) as ExpressionNode;
          const callNode = new LowLevelCallNode(visitedAddr, data, methodName);
          callNode.location = node.location;
          return callNode;
        }

        // Interface-typed variable: `token.transferFrom(a, b, c)` where `token` is an `IERC20`-typed
        // state var / param / local. Route to the same external-call path as `IERC20(addr).method(..)`,
        // with the address expression being the variable's value (its stored locking bytecode).
        {
          const varIdentifier = new IdentifierNode(varName);
          varIdentifier.location = node.identifier.location;
          const visitedVar = this.visit(varIdentifier) as ExpressionNode;
          // Resolve the declared type from a param/local symbol or a state variable (a bare state var
          // resolves to a state-access node whose .type is only set later, so consult the state-var map).
          const varType = visitedVar.type
            ?? (visitedVar instanceof IdentifierNode ? visitedVar.definition?.type : undefined)
            ?? this.stateVariableMap.get(varName)?.type;
          const calleeName = varType instanceof AddressType ? varType.interfaceName : undefined;
          const calleeFns = calleeName ? this.getCalleeFunctions(calleeName) : undefined;
          if (calleeName && calleeFns) {
            const ifaceFunc = calleeFns.find((f) => f.name === methodName);
            if (ifaceFunc) {
              if (node.fieldNames) {
                node.parameters = this.reorderNamedArgsByParams(
                  node.fieldNames, ifaceFunc.parameters, node.parameters, node, `'${calleeName}.${ifaceFunc.name}'`,
                );
                node.fieldNames = undefined;
              }
              const parameters = this.visitList(node.parameters) as ExpressionNode[];
              if (this.deployResultLocals.has(varName)) {
                const deployNode = this.deployResultLocals.get(varName)!;
                // ifaceFunc is a signature-only view; the real body lives on the referenced contract.
                const realFoo = deployNode.referencedContract?.functions.find((f) => f.name === methodName);
                const foldRes = realFoo ? this.tryFoldDeployCall(deployNode, realFoo, parameters) : false;
                if (!foldRes) {
                  throw new DeployThenCallError(node, varName, methodName, calleeName,
                    realFoo ? this.isDeployFoldable(realFoo) : false);
                }
                // A value-returning folded call IS its genesis expression in the parent's context
                // (`r = c.m_x()` on a fresh deploy reads the value the deploy covenant verifies).
                if (foldRes.returnValue) {
                  foldRes.returnValue.location = node.location;
                  return foldRes.returnValue;
                }
                // Folded into the deploy genesis: an inert external-call node (skipped by collection + codegen).
                const inert = new ExternalFunctionCallNode(calleeName, visitedVar, methodName, parameters);
                inert.callInfo = { interfaceName: calleeName, functionName: methodName, externalCallSlotIndex: -1 };
                inert.foldedIntoDeploy = true;
                inert.location = node.location;
                return inert;
              }
              // `foo.bar(args)` parses as a namespaced function call, which carries no `{value:}` call
              // options (those arrive via the MethodCall path), so none are threaded here.
              const callNode = new ExternalFunctionCallNode(calleeName, visitedVar, methodName, parameters);
              callNode.callInfo = {
                interfaceName: calleeName,
                functionName: methodName,
                externalCallSlotIndex: -1,
              };
              if (ifaceFunc.returnTypes.length > 0) {
                callNode.type = ifaceFunc.returnTypes.length === 1
                  ? ifaceFunc.returnTypes[0]
                  : new TupleType(ifaceFunc.returnTypes);
                callNode.callInfo.hasReturnValues = true;
                callNode.callInfo.returnTypes = ifaceFunc.returnTypes;
                callNode.callInfo.returnEventSignature = `_Return_${ifaceFunc.name}(${ifaceFunc.returnTypes.map((t) => t.toString()).join(',')})`;
              }
              callNode.location = node.location;
              return callNode;
            }
          }
        }

        // Try using-for resolution: a.doubleIt() -> doubleIt(a) or SafeMath.add(a, ...)
        if (this.usingForBindings.size > 0) {
          // Visit the variable to get its type
          const varIdentifier = new IdentifierNode(varName);
          varIdentifier.location = node.identifier.location;
          const visitedVar = this.visit(varIdentifier) as ExpressionNode;
          // A bare state var resolves to a StateAccessNode whose .type is only set in TypeCheck, so consult
          // the state-var map (mirrors the interface-method path above). Without this, `stateVar.method()`
          // using-for calls fall through to the namespaced-function path and throw an undefined-symbol error.
          const objectType = visitedVar.type
            ?? (visitedVar instanceof IdentifierNode ? visitedVar.definition?.type : undefined)
            ?? this.stateVariableMap.get(varName)?.type;

          if (objectType) {
            const typeStr = objectType.toString();
            const candidates = [
              ...(this.usingForBindings.get(typeStr) ?? []),
              ...(this.usingForBindings.get('*') ?? []),
            ];
            const match = candidates.find((c) => c.methodName === methodName);
            if (match) {
              const funcOverloads = this.functionDefinitions.get(match.fullFunctionName);
              if (funcOverloads && funcOverloads.length > 0) {
                const funcIdentifier = new IdentifierNode(match.fullFunctionName);
                funcIdentifier.location = node.identifier.location;
                const funcCall = new FunctionCallNode(funcIdentifier, [visitedVar, ...node.parameters]);
                funcCall.location = node.location;
                if (funcOverloads.length === 1) {
                  funcCall.resolvedFunction = funcOverloads[0];
                }
                this.expectedSymbolType = SymbolType.FUNCTION;
                funcCall.identifier = this.visit(funcCall.identifier) as IdentifierNode;
                this.expectedSymbolType = SymbolType.VARIABLE;
                funcCall.parameters = funcCall.parameters.map((p, i) => (i === 0 ? p : this.visit(p) as ExpressionNode));
                this.protectDuplicateCallArgVars(funcCall.parameters as ExpressionNode[]);
                return funcCall;
              }
            }
          }
        }
      }
    }

    // Check if this is a value type wrap: Price(x) -> CastNode(ValueType, x)
    const valueType = this.typeDefMap.get(node.identifier.name);
    if (valueType) {
      if (node.parameters.length !== 1) {
        throw new StructFieldCountError(node, 1, node.parameters.length);
      }
      node.parameters = this.visitList(node.parameters);
      const castNode = new CastNode(valueType, node.parameters[0], false);
      castNode.location = node.location;
      return castNode;
    }

    // Library-qualified struct constructor (`Pairing.G1Point(x, y)`): struct types register bare; when the
    // post-dot name is a known struct and the prefix is not a value symbol, resolve the bare constructor.
    if (node.identifier.name.includes('.')) {
      const bare = node.identifier.name.slice(node.identifier.name.lastIndexOf('.') + 1);
      const prefix = node.identifier.name.split('.')[0];
      if (this.structMap.has(bare) && !this.symbolTables[0].get(prefix)
        && !this.functionDefinitions.has(node.identifier.name)) {
        node.identifier.name = bare;
      }
    }
    // Check if this is a struct constructor call
    const structType = this.structMap.get(node.identifier.name);
    if (structType) {
      if (node.fieldNames) {
        // Named-field struct initialization: validate and reorder
        const seen = new Set<string>();
        for (const name of node.fieldNames) {
          if (seen.has(name)) throw new StructDuplicateFieldError(node, structType.name, name);
          seen.add(name);
        }
        for (const name of node.fieldNames) {
          if (!structType.fields.find((f) => f.name === name)) {
            throw new StructUnknownFieldError(node, structType.name, name);
          }
        }

        // Reorder parameters to match struct field definition order,
        // inserting default values for omitted fields
        const reordered = structType.fields.map((field) => {
          const idx = node.fieldNames!.indexOf(field.name);
          if (idx >= 0) return node.parameters[idx];
          return this.createDefaultExpression(field.type, node);
        });
        node.parameters = reordered;
        node.fieldNames = undefined;
      } else {
        // Positional: validate argument count
        if (node.parameters.length !== structType.fields.length) {
          throw new StructFieldCountError(node, structType.fields.length, node.parameters.length);
        }
      }
    }

    // Check if this is a contract/interface type constructor used as an address value: MarketplaceV1(addr)
    if (!structType) {
      const isContractType = this.contractMap.has(node.identifier.name)
        || this.interfaceMap.has(node.identifier.name);
      if (isContractType) {
        if (node.parameters.length !== 1) {
          throw new ContractTypeConstructorArgCountError(node, node.identifier.name);
        }
        node.parameters = this.visitList(node.parameters);
        // Name(addr) -> address handle (the address IS the locking bytecode). Tag the handle with the
        // interface name so `IFoo(addr).bar(..)` and `IFoo x = IFoo(addr); x.bar(..)` route to externals.
        const ifaceTag = this.interfaceMap.has(node.identifier.name) ? node.identifier.name : undefined;
        const castNode = new CastNode(new AddressType(false, ifaceTag), node.parameters[0], false);
        castNode.location = node.location;
        return castNode;
      }
    }

    // Check if this is a user-defined function call
    const overloads = this.functionDefinitions.get(node.identifier.name);
    if (overloads && overloads.length > 0) {
      if (node.fieldNames) {
        // Named call arguments f({a:1,b:2}): reorder to the function's parameter order. Overload
        // resolution depends on positional types, so named args require a single (non-overloaded) target.
        if (overloads.length > 1) {
          throw new NamedArgumentError(node, `Named arguments are not supported for overloaded function '${node.identifier.name}'`);
        }
        node.parameters = this.reorderNamedCallArgs(overloads[0], node);
        node.fieldNames = undefined;
      }
      if (overloads.length === 1) {
        node.resolvedFunction = overloads[0];
        if (overloads[0].visibility === 'external' && !overloads[0].isFreeFunction && !node.fromThisCall) {
          throw new InternalCallToExternalError(node);
        }
      }
      // Multiple overloads: defer resolution to TypeCheckTraversal
    }

    // Indirect call through a function-typed variable: resolve the callee as a variable, not a function.
    const calleeSym = this.symbolTables[0].get(node.identifier.name);
    const isIndirect = !this.functionDefinitions.has(node.identifier.name) && calleeSym?.type instanceof FunctionType;

    this.expectedSymbolType = isIndirect ? SymbolType.VARIABLE : SymbolType.FUNCTION;
    // A `this.f()` self-call to an external function is resolved via functionDefinitions above (resolvedFunction
    // is set); external functions are not identifier symbols, so skip the identifier resolution that would fail.
    if (!(node.fromThisCall && node.resolvedFunction?.visibility === 'external')) {
      node.identifier = this.visit(node.identifier) as IdentifierNode;
    }
    this.expectedSymbolType = SymbolType.VARIABLE;
    node.parameters = this.visitList(node.parameters);
    if ((overloads && overloads.length > 0) || isIndirect) {
      this.protectDuplicateCallArgVars(node.parameters as ExpressionNode[]);
    }
    return node;
  }

  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    // A statement call with no callee identifier (e.g. `c.f()` on a contract-typed state variable holding a
    // deployed contract - the stored-contract-call cluster) is not a resolvable named call; reject cleanly
    // instead of crashing on the missing identifier.
    if (!node.call.identifier) {
      throw new MethodCallNotSupportedError(node);
    }
    // A library sibling called in statement position (void call, return unused) needs qualifying too - the
    // qualifier is otherwise only wired into the expression-form visitor, so `_throwError(x);` inside `L.f`
    // stayed unresolved (only `x = sibling(..)` / `return sibling(..)` resolved).
    this.qualifyLibrarySiblingCall(node.call.identifier);
    // Check if this is an address method call: dest.transfer(amount)
    const callName = node.call.identifier.name;
    if (callName.includes('.')) {
      const [varName, methodName] = callName.split('.');
      if (methodName === 'transfer' && node.call.parameters.length === 1) {
        // Look up the variable as a potential address
        const symbol = this.symbolTables[0]?.get(varName);
        if (symbol) {
          const addrIdentifier = new IdentifierNode(varName);
          addrIdentifier.location = node.call.identifier.location;
          const visitedAddr = this.visit(addrIdentifier);
          const amount = this.visit(node.call.parameters[0]);
          const transferNode = new AddressTransferStatementNode(visitedAddr, amount);
          transferNode.location = node.location;
          return transferNode;
        }
      }
    }

    // Indirect call statement through a function-typed variable: defer to the function-call visitor.
    const calleeSym = this.symbolTables[0].get(callName);
    if (!this.functionDefinitions.has(callName) && calleeSym?.type instanceof FunctionType) {
      node.call = this.visit(node.call) as FunctionCallNode;
      return node;
    }

    // Statement-form external call on an interface-typed variable: `token.transfer(to, amt);`. Resolve via
    // the function-call visitor, then wrap the external call as a statement (result discarded). Expression
    // forms (`x = token.method(..)`, `require(token.method(..))`) already route through visitFunctionCall.
    if (callName.includes('.') && !this.functionDefinitions.has(callName)) {
      const [varName] = callName.split('.');
      const varType = this.symbolTables[0]?.get(varName)?.type ?? this.stateVariableMap.get(varName)?.type;
      if (varType instanceof AddressType && varType.interfaceName && this.interfaceMap.has(varType.interfaceName)) {
        const resolved = this.visit(node.call);
        if (resolved instanceof ExternalFunctionCallNode) {
          const wrapper = new MethodCallStatementNode(
            new MethodCallNode(new IdentifierNode(varName), callName.split('.')[1], []),
          );
          wrapper.expression = resolved;
          wrapper.location = node.location;
          return wrapper;
        }
        // A value-returning deploy-fold resolves the call to a plain expression; as a statement the value
        // is computed and dropped.
        if (!(resolved instanceof FunctionCallNode)) {
          const stmt = new ExpressionStatementNode(resolved as ExpressionNode);
          stmt.location = node.location;
          return stmt;
        }
        node.call = resolved;
        return node;
      }
    }

    // Function call statements are only valid for user-defined functions
    const overloads = this.functionDefinitions.get(callName);
    if (!overloads || overloads.length === 0) {
      throw new UndefinedReferenceError(node.call.identifier);
    }
    const anyCallable = overloads.some((f) => f.visibility !== 'external' || f.isFreeFunction);
    if (!anyCallable && !node.call.fromThisCall) {
      throw new InternalCallToExternalError(node);
    }
    if (overloads.length === 1) {
      node.call.resolvedFunction = overloads[0];
    }
    node.call = this.visit(node.call) as FunctionCallNode;
    return node;
  }

  visitReturn(node: ReturnNode): Node {
    node.expressions = this.visitList(node.expressions);
    return node;
  }

  visitNullaryOp(node: NullaryOpNode): Node {
    if (node.operator === NullaryOperator.MSG_SENDER || node.operator === NullaryOperator.TX_ORIGIN) {
      const loc = node.location ? ` at line ${node.location.start.line}` : '';
      console.log(
        `Warning: '${node.operator}' used${loc}. On BCH, prefer checking signatures (checkSig/checkMultiSig)`
        + ' for authentication and authorization, as sender identification is less reliable than on account-based chains.',
      );
    }
    return node;
  }

  visitInstantiation(node: InstantiationNode): Node {
    const contractName = node.identifier.name;
    const contract = this.contractMap.get(contractName);

    if (contract) {
      // Contract deployment mode
      node.referencedContract = contract;

      if (contract.isAbstract) {
        throw new AbstractContractNotCompilableError(contract.name);
      }

      const isStatefulTarget = contract.stateVariables.length > 0 || contract.collections.length > 0;
      let isInDeployFunction = this.currentFunction?.modifiers?.includes(FunctionModifier.DEPLOY) ?? false;

      // Infer the `deploy` modifier: instantiating a stateful contract (`new T()` mints the child's genesis)
      // IS deploying it, so the keyword is optional. The deploy covenant rides the parent's block layout, so
      // inference only applies inside a STATEFUL contract's function; a non-stateful parent (or a `new T()`
      // with no enclosing function, e.g. a state-var initializer) cannot host a deploy and still errors.
      if (isStatefulTarget && !isInDeployFunction) {
        if (this.currentFunction && this.isStatefulContract) {
          if (!this.currentFunction.modifiers.includes(FunctionModifier.DEPLOY)) {
            this.currentFunction.modifiers.push(FunctionModifier.DEPLOY);
          }
          isInDeployFunction = true;
        } else {
          throw new StatefulContractDeploymentError(node, contract.name);
        }
      }

      if (node.callOptions?.value && !this.isStatefulContract) {
        throw new DeployValueInNonStatefulError(node, contract.name);
      }

      // Solidity `constructor(args)` puts the deploy params on constructorDef, not the (solidcash) contract-
      // level parameters; use whichever carries them. Synthetic __internal__ params (a child's own semantic
      // pass appends them onto the SHARED ctor node, e.g. for a ctor msg.sender read) are never call-site
      // arguments - count declared params only.
      const expectedCtorParams = (contract.parameters.length > 0
        ? contract.parameters : (contract.constructorDef?.parameters ?? []))
        .filter((p) => !p.name.startsWith('__internal__') && !p.name.startsWith('__ctorread_'));
      if (node.parameters.length !== expectedCtorParams.length) {
        throw new ContractConstructorArgCountError(node, contract.name, expectedCtorParams.length, node.parameters.length);
      }

      // If deploying a stateful contract, store deployment metadata
      if (isStatefulTarget && isInDeployFunction) {
        node.isStatefulDeploy = true;
        node.deployedStateVars = [...contract.stateVariables];
        node.deployedDataNftCount = contract.stateVariables.length > 0
          ? Math.max(...contract.stateVariables.map((sv) => sv.nftIndex)) + 1
          : 0;
      }

      node.parameters = this.visitList(node.parameters);

      // Fold the child ctor's writes into the genesis: the deploy covenant otherwise verifies TYPE
      // DEFAULTS, diverging from a ctor that initializes fields from its args. Also seeds later
      // deploy-then-call folds so their `this.field` reads see the true genesis value.
      this.tryFoldChildConstructor(node);

      if (node.callOptions?.value) {
        node.callOptions.value = this.visit(node.callOptions.value) as ExpressionNode;
      }
      // Salt (EVM create2): honored - baked as an outermost `<salt> OP_DROP` address segment in codegen,
      // COMPOSED with the category self-pin for a stateful target (`<salt> OP_DROP | <cat self-pin> | base`,
      // exactly as the SDK's Contract layers it), so `new T{salt}(...)` yields a deterministic,
      // salt-distinguished p2sh address.
      if (node.callOptions?.salt) {
        node.callOptions.salt = this.visit(node.callOptions.salt) as ExpressionNode;
      }

      return node;
    }

    // Built-in class instantiation (LockingBytecodeP2PKH, etc.)
    this.expectedSymbolType = SymbolType.CLASS;
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    this.expectedSymbolType = SymbolType.VARIABLE;
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  // When we enter a console statement,
  visitConsoleStatement(node: ConsoleStatementNode): Node {
    this.insideConsoleStatement = true;
    node.parameters = this.visitList(node.parameters) as ConsoleParameterNode[];
    this.insideConsoleStatement = false;

    return node;
  }

  visitCollection(node: CollectionNode): Node {
    return node;
  }

  visitMappingAccess(node: MappingAccessNode): Node {
    // Token containers still cannot be read at genesis (no input container exists yet).
    if (this.insideConstructor && node.name === 'tokens' && this.isStatefulContract) {
      throw new TokenContainerAccessInConstructorError(node);
    }
    // Mapping/collection READS in the constructor are allowed: at genesis there are no input entry NFTs, so
    // every read resolves to the type default (empty mapping) via the emitSlotExistsCheck ELSE branch. This
    // supports read-before-write of an uninitialized element, e.g. the MultiSig uniqueness pattern
    // `require(!this.isOwner[a]); this.isOwner[a] = true;`. (Writes already worked; deletes stay blocked.)

    // Check if this is a packed or chunk-packed state array access (this.scores[index]). Both store a
    // `pushdata(count)++elems` blob (inline for packed, reassembled from chunks for dynamic), so element
    // access shares one codegen path; the read-blob primitive branches on isDynamic internally.
    const packedSv = this.stateVariableMap.get(node.name);
    if (packedSv && (packedSv.isPacked || packedSv.isDynamic) && packedSv.type instanceof ArrayType) {
      node.isPackedStateArrayAccess = true;
      node.packedStateVariable = packedSv;
      node.keys = this.visitList(node.keys);
      // The first key indexes the packed/dynamic array; extra keys drill into a fixed-inner array element
      // (`uint256[N][]`: a[i] is the row uint256[N], a[i][j] the scalar).
      let resultType: Type = (packedSv.type as ArrayType).elementType;
      for (let k = 1; k < node.keys.length; k++) {
        if (!(resultType instanceof ArrayType)) {
          throw new Error(`Too many index expressions for '${node.name}' at line ${node.location?.start.line}`);
        }
        resultType = resultType.elementType;
      }
      node.type = resultType;
      return node;
    }

    // Check if this is a token container access (this.tokens[category])
    if (node.name === 'tokens' && this.isStatefulContract && !this.collectionMap.has('tokens')) {
      node.isTokenContainerAccess = true;
      node.keys = this.visitList(node.keys);

      // Validate key is a function parameter
      for (const key of node.keys) {
        if (!(key instanceof IdentifierNode)
          || !this.currentFunction.parameters.some((p) => p.name === (key as IdentifierNode).name)) {
          throw new TokenContainerKeyMustBeParameterError(node);
        }
      }

      return node;
    }

    const coll = this.collectionMap.get(node.name);
    if (!coll) {
      throw new UndefinedCollectionError(node);
    }
    if (coll.visibility === StateVariableVisibility.PRIVATE && coll.inheritedFrom
      && this.currentFunction.inheritedFrom !== coll.inheritedFrom) {
      throw new PrivateCollectionAccessError(node, coll.name, coll.inheritedFrom);
    }
    node.collection = coll;
    // In the constructor, a mapping read resolves to the type default (genesis is empty - no input entries).
    // Flag it so codegen emits the default directly; it is not collected as an entry access (no slot / output).
    if (this.insideConstructor) {
      node.isGenesisRead = true;
    }
    // Detect array element access: extra key beyond mapping dimensions when value is ArrayType
    const allKeyTypes = coll.allKeyTypes;
    if (node.keys.length === allKeyTypes.length + 1 && coll.innermostValueType instanceof ArrayType) {
      node.arrayIndex = node.keys.pop()!;
    }
    node.keys = this.visitList(node.keys);
    if (node.arrayIndex) {
      node.arrayIndex = this.visit(node.arrayIndex);
    }

    return node;
  }

  visitMappingAssign(node: MappingAssignNode): Node {
    const coll = this.collectionMap.get(node.name);
    if (!coll) {
      throw new UndefinedCollectionError(node);
    }
    if (coll.visibility === StateVariableVisibility.PRIVATE && coll.inheritedFrom
      && this.currentFunction.inheritedFrom !== coll.inheritedFrom) {
      throw new PrivateCollectionAccessError(node, coll.name, coll.inheritedFrom);
    }
    if (coll.immutable && !this.insideConstructor) {
      throw new ImmutableStateVariableAssignmentError(node, coll.name);
    }
    node.collection = coll;
    // Detect array element assign: extra key beyond mapping dimensions when value is ArrayType
    const allKeyTypes = coll.allKeyTypes;
    if (node.keys.length === allKeyTypes.length + 1 && coll.innermostValueType instanceof ArrayType) {
      node.arrayIndex = node.keys.pop()!;
    }
    node.keys = this.visitList(node.keys);
    if (node.arrayIndex) {
      node.arrayIndex = this.visit(node.arrayIndex);
    }
    node.expression = this.visit(node.expression);

    return node;
  }

  visitMappingFieldAssign(node: MappingFieldAssignNode): Node {
    const coll = this.collectionMap.get(node.name);
    if (!coll) {
      throw new UndefinedCollectionError(node);
    }
    if (coll.visibility === StateVariableVisibility.PRIVATE && coll.inheritedFrom
      && this.currentFunction.inheritedFrom !== coll.inheritedFrom) {
      throw new PrivateCollectionAccessError(node, coll.name, coll.inheritedFrom);
    }
    if (coll.immutable && !this.insideConstructor) {
      throw new ImmutableStateVariableAssignmentError(node, coll.name);
    }
    node.collection = coll;
    node.keys = this.visitList(node.keys);
    node.expression = this.visit(node.expression);

    return node;
  }

  visitMappingDelete(node: MappingDeleteNode): Node {
    if (this.insideConstructor) {
      throw new MappingAccessInConstructorError(node);
    }
    const coll = this.collectionMap.get(node.name);
    if (!coll) {
      throw new UndefinedCollectionError(node);
    }
    if (coll.visibility === StateVariableVisibility.PRIVATE && coll.inheritedFrom
      && this.currentFunction.inheritedFrom !== coll.inheritedFrom) {
      throw new PrivateCollectionAccessError(node, coll.name, coll.inheritedFrom);
    }
    if (coll.immutable) {
      throw new ImmutableStateVariableAssignmentError(node, coll.name);
    }
    node.collection = coll;
    node.keys = this.visitList(node.keys);

    return node;
  }

  visitTokenContainerMethodStatement(node: TokenContainerMethodStatementNode): Node {
    if (this.insideConstructor) {
      throw new TokenContainerTransferInConstructorError(node);
    }
    node.tokenContainerKeyExpression = this.visit(node.tokenContainerKeyExpression);
    node.args = this.visitList(node.args);

    // Validate key is a function parameter
    const keyExpr = node.tokenContainerKeyExpression;
    if (!(keyExpr instanceof IdentifierNode)
      || !this.currentFunction.parameters.some((p) => p.name === keyExpr.name)) {
      throw new TokenContainerKeyMustBeParameterError(node);
    }

    return node;
  }

  visitTransferStatement(node: TransferStatementNode): Node {
    node.lockingBytecode = this.visit(node.lockingBytecode);
    node.amount = this.visit(node.amount);
    return node;
  }

  visitEmitStatement(node: EmitStatementNode): Node {
    // Find all events matching by name
    const candidates = [...this.eventMap.values()].filter((ev) => ev.name === node.eventName);
    if (candidates.length === 0) {
      throw new UndefinedEventError(node);
    }
    if (node.fieldNames) {
      // Named-arg emit `emit E({b: y, a: x})`: pick the event whose params match the names and reorder.
      const match = candidates.find((ev) => ev.parameters.length === node.fieldNames!.length
        && ev.parameters.every((p) => node.fieldNames!.includes(p.name)));
      if (!match) {
        throw new NamedArgumentError(
          node, `No event '${node.eventName}' matches named arguments {${node.fieldNames.join(', ')}}`,
        );
      }
      node.args = match.parameters.map((p) => node.args[node.fieldNames!.indexOf(p.name)]);
      node.eventDefinition = match;
      node.fieldNames = undefined;
    } else if (candidates.length === 1) {
      node.eventDefinition = candidates[0];
    } else {
      // Multiple overloads: defer resolution to TypeCheckTraversal
      node.eventCandidates = candidates;
    }

    // Record any emitted event declared in a sibling contract so the artifact lists it (library events already
    // reach the artifact via file-level eventDefinitions; the contract's own events are listed directly).
    if (this.currentContract) {
      for (const ev of node.eventDefinition ? [node.eventDefinition] : (node.eventCandidates ?? [])) {
        if (this.siblingContractEvents.has(ev)
          && !this.currentContract.emittedForeignEvents.some((e) => e.signature === ev.signature)) {
          this.currentContract.emittedForeignEvents.push(ev);
        }
      }
    }

    node.args = this.visitList(node.args);
    return node;
  }

  visitBranch(node: BranchNode): Node {
    const prev = this.insideBranch;
    this.insideBranch = true;
    const result = super.visitBranch(node);
    this.insideBranch = prev;

    // Post-visit: record restricted operations per branch (pre-allocated before the condition) - shared with
    // EarlyReturnTransformation, which recomputes this after nesting a `return;`/`revert` guard's following
    // statements into the else block.
    const ops = computeBranchOps(node.ifBlock, node.elseBlock);
    if (ops) node.branchOps = ops;

    return result;
  }

  visitSwitch(node: SwitchNode): Node {
    const prev = this.insideBranch;
    this.insideBranch = true;
    const result = super.visitSwitch(node);
    this.insideBranch = prev;

    // Collect ops from all cases and default
    const allCounts = node.cases.map((c) => countBranchOps(c.body));
    if (node.defaultCase) {
      allCounts.push(countBranchOps(node.defaultCase));
    }

    const hasOps = allCounts.some((c) => c.transfers > 0 || c.emits > 0 || c.tokenContainerTransfers > 0
      || c.stateWriteKeys.size > 0 || c.mappingWriteSlots.size > 0 || c.mappingDeleteSlots.size > 0);

    if (hasOps) {
      const stateWriteKeys = new Set<string>();
      const mappingWriteSlots = new Set<number>();
      const mappingDeleteSlots = new Set<number>();
      for (const c of allCounts) {
        for (const k of c.stateWriteKeys) stateWriteKeys.add(k);
        for (const s of c.mappingWriteSlots) mappingWriteSlots.add(s);
        for (const s of c.mappingDeleteSlots) mappingDeleteSlots.add(s);
      }

      node.switchOps = {
        stateWriteKeys,
        mappingWriteSlots,
        mappingDeleteSlots,
        transferCount: Math.max(...allCounts.map((c) => c.transfers)),
        minTransferCount: Math.min(...allCounts.map((c) => c.transfers)),
        emitCount: Math.max(...allCounts.map((c) => c.emits)),
        minEmitCount: Math.min(...allCounts.map((c) => c.emits)),
        tokenContainerTransferCount: Math.max(...allCounts.map((c) => c.tokenContainerTransfers)),
        minTokenContainerTransferCount: Math.min(...allCounts.map((c) => c.tokenContainerTransfers)),
      };
    }

    return result;
  }

  visitDoWhile(node: DoWhileNode): Node {
    return super.visitDoWhile(node);
  }

  visitWhile(node: WhileNode): Node {
    return super.visitWhile(node);
  }

  visitCollectionIteration(node: CollectionIterationNode): Node {
    const coll = this.collectionMap.get(node.collectionName);
    if (!coll) throw new UndefinedCollectionError(node);
    node.collection = coll;

    // Enter new scope for loop variables
    const scopeTable = new SymbolTable(this.symbolTables[0]);
    this.symbolTables.unshift(scopeTable);

    if (node.keyName && node.keyType) {
      const keyParam = new ParameterNode(node.keyType, node.keyName);
      keyParam.location = node.location;
      scopeTable.set(Symbol.variable(keyParam));
      const keySym = scopeTable.get(node.keyName);
      if (keySym) keySym.references.push({ name: node.keyName } as IdentifierNode);
    }

    if (node.valueName && node.valueType) {
      const valueParam = new ParameterNode(node.valueType, node.valueName);
      valueParam.location = node.location;
      scopeTable.set(Symbol.variable(valueParam));
      const valSym = scopeTable.get(node.valueName);
      if (valSym) valSym.references.push({ name: node.valueName } as IdentifierNode);
    }

    node.body = this.visit(node.body) as BlockNode;

    this.symbolTables.shift();
    return node;
  }

  visitTryCatch(node: TryCatchNode): Node {
    const line = node.location?.start?.line;
    const loc = line ? ` at line ${line}` : '';
    console.log(`Warning: try/catch is a no-op in SolidCash${loc}. Catch blocks are dead code because BCH VM script failures are always fatal.`);

    // Visit expression first
    node.expression = this.visit(node.expression);

    // Manually handle try block visitation so we can register return parameters
    // BEFORE visiting the block's statements (they may reference return params)
    node.tryBlock.symbolTable = new SymbolTable(this.symbolTables[0]);
    this.symbolTables.unshift(node.tryBlock.symbolTable);

    // Register return parameters in the try block's scope before visiting statements
    if (node.returnParameters && node.returnParameters.length > 0) {
      for (const param of node.returnParameters) {
        const sym = Symbol.variable(param);
        // Mark as referenced to avoid unused-variable errors (dead code)
        sym.references.push({ name: param.name } as IdentifierNode);
        node.tryBlock.symbolTable.set(sym);
      }
    }

    node.tryBlock.statements = this.visitOptionalList(node.tryBlock.statements) as StatementNode[];

    const unusedSymbols = node.tryBlock.symbolTable.unusedSymbols();
    for (const unused of unusedSymbols) {
      // Solidity only warns on unused vars/params and never fails the compile; match that.
      const uloc = unused.definition?.location ? ` at line ${unused.definition.location.start.line}` : '';
      console.log(`Warning: unused variable '${unused.name}'${uloc}.`);
    }

    this.symbolTables.shift();

    // Visit catch clauses
    node.catchClauses = this.visitList(node.catchClauses) as CatchClauseNode[];
    return node;
  }

  visitCatchClause(node: CatchClauseNode): Node {
    // The catch param (`catch Error(string reason)` / `catch (bytes reason)`) must be registered BEFORE the
    // block's statements are visited (they reference it, e.g. `emit Log(reason)`) - visiting first left it
    // undefined. Register in a fresh block scope, then visit the statements. Marked referenced (dead code).
    if (node.parameters && node.parameters.length > 0 && node.block.statements) {
      node.block.symbolTable = new SymbolTable(this.symbolTables[0]);
      this.symbolTables.unshift(node.block.symbolTable);
      for (const param of node.parameters) {
        const sym = Symbol.variable(param);
        sym.references.push({ name: param.name } as IdentifierNode);
        node.block.symbolTable.set(sym);
      }
      node.block.statements = this.visitOptionalList(node.block.statements) as StatementNode[];
      this.symbolTables.shift();
      return node;
    }

    node.block = this.visit(node.block) as BlockNode;
    return node;
  }

  visitStateAccess(node: StateAccessNode): Node {
    // this.outState is a built-in property, not a state variable
    if (node.name === 'outState') {
      return node;
    }
    // this.balance is a built-in property when no state variable named 'balance' exists
    if (node.name === 'balance' && !this.stateVariableMap.has('balance')) {
      return node;
    }
    const sv = this.stateVariableMap.get(node.name);
    if (!sv) {
      // `this.f` where f is one of the contract's functions (not a state var): a self-targeted external
      // function pointer. On BCH a self external-call is a direct call to the own function, so resolve it to a
      // self function-reference (the internal functionId + OP_INVOKE path); typed external via isExternalSelfRef.
      const overloads = this.functionDefinitions.get(node.name);
      if (overloads && overloads.length === 1) {
        const id = new IdentifierNode(node.name);
        id.location = node.location;
        id.functionReference = overloads[0];
        id.isExternalSelfRef = true;
        return id;
      }
      throw new UndefinedStateVariableError(node);
    }
    if (sv.visibility === StateVariableVisibility.PRIVATE && sv.inheritedFrom
      && this.currentFunction.inheritedFrom !== sv.inheritedFrom
      && node.fromModifier !== sv.inheritedFrom) {
      throw new PrivateStateVariableAccessError(node, sv.name, sv.inheritedFrom);
    }
    node.stateVariable = sv;
    return node;
  }

  visitStateAssign(node: StateAssignNode): Node {
    const sv = this.stateVariableMap.get(node.name);
    if (!sv) {
      throw new UndefinedStateVariableError(node);
    }
    if (sv.visibility === StateVariableVisibility.PRIVATE && sv.inheritedFrom
      && this.currentFunction.inheritedFrom !== sv.inheritedFrom
      && node.fromModifier !== sv.inheritedFrom) {
      throw new PrivateStateVariableAccessError(node, sv.name, sv.inheritedFrom);
    }
    if (sv.immutable && !this.insideConstructor) {
      throw new ImmutableStateVariableAssignmentError(node, sv.name);
    }
    node.stateVariable = sv;
    node.expression = this.visit(node.expression);
    return node;
  }

  visitDeleteLocal(node: DeleteLocalNode): Node {
    // Bare `delete x` on a state variable (no shadowing local): route to a state delete, mirroring the bare
    // state-var write in visitAssign. Otherwise DeleteLocal treats `x` as a stack local - which silently defines
    // a wrong local at top level, and crashes ("variable does not exist on the stack") once nested in a branch.
    const sym = this.symbolTables[0].get(node.identifier.name);
    if (sym?.symbolType === SymbolType.STATE_VARIABLE) {
      const stateNode = new DeleteStateNode(node.identifier.name);
      stateNode.location = node.location;
      return this.visit(stateNode);
    }
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    return node;
  }

  visitDeleteState(node: DeleteStateNode): Node {
    const sv = this.stateVariableMap.get(node.name);
    if (!sv) {
      throw new UndefinedStateVariableError(node);
    }
    if (sv.visibility === StateVariableVisibility.PRIVATE && sv.inheritedFrom
      && this.currentFunction.inheritedFrom !== sv.inheritedFrom
      && node.fromModifier !== sv.inheritedFrom) {
      throw new PrivateStateVariableAccessError(node, sv.name, sv.inheritedFrom);
    }
    if (sv.immutable && !this.insideConstructor) {
      throw new ImmutableStateVariableAssignmentError(node, sv.name);
    }
    node.stateVariable = sv;
    return node;
  }

  visitStateArrayPush(node: StateArrayPushNode): Node {
    const sv = this.stateVariableMap.get(node.name);
    if (!sv || !(sv.isPacked || sv.isDynamic) || !(sv.type instanceof ArrayType)) {
      throw new UndefinedStateVariableError(node);
    }
    if (sv.immutable && !this.insideConstructor) {
      throw new ImmutableStateVariableAssignmentError(node, sv.name);
    }
    node.stateVariable = sv;
    // No-arg `arr.push()` appends the element type's default. Build it here (replacing the int-0 placeholder the
    // AST builder inserts), not in TypeCheck, so a struct default `Data(...)` passes through struct-constructor
    // resolution below; created post-SymbolTable it would stay an unresolved call and type as undefined. Reduces
    // to the hand-written `arr.push(Data(...))`.
    if (node.noArg && sv.type instanceof ArrayType) {
      node.value = createDefaultValueExpression(sv.type.elementType, node.location!);
    }
    node.value = this.visit(node.value);
    return node;
  }

  visitStateArrayPop(node: StateArrayPopNode): Node {
    const sv = this.stateVariableMap.get(node.name);
    if (!sv || !(sv.isPacked || sv.isDynamic) || !(sv.type instanceof ArrayType)) {
      throw new UndefinedStateVariableError(node);
    }
    if (sv.immutable && !this.insideConstructor) {
      throw new ImmutableStateVariableAssignmentError(node, sv.name);
    }
    node.stateVariable = sv;
    return node;
  }

  visitStateArrayAssign(node: StateArrayAssignNode): Node {
    const sv = this.stateVariableMap.get(node.name);
    if (!sv || !(sv.isPacked || sv.isDynamic) || !(sv.type instanceof ArrayType)) {
      throw new UndefinedStateVariableError(node);
    }
    if (sv.immutable && !this.insideConstructor) {
      throw new ImmutableStateVariableAssignmentError(node, sv.name);
    }
    node.stateVariable = sv;
    node.index = this.visit(node.index);
    node.value = this.visit(node.value);
    return node;
  }

  visitStateArrayDelete(node: StateArrayDeleteNode): Node {
    const sv = this.stateVariableMap.get(node.name);
    if (!sv || !(sv.isPacked || sv.isDynamic) || !(sv.type instanceof ArrayType)) {
      throw new UndefinedStateVariableError(node);
    }
    if (sv.immutable && !this.insideConstructor) {
      throw new ImmutableStateVariableAssignmentError(node, sv.name);
    }
    node.stateVariable = sv;
    node.index = this.visit(node.index);
    return node;
  }

  /**
   * Synthesize an InterfaceNode from a ContractNode, including only externally-visible members.
   */
  private synthesizeInterfaceFromContract(contract: ContractNode): InterfaceNode {
    const stateVars = contract.stateVariables
      .filter((sv) => sv.visibility === StateVariableVisibility.PUBLIC
        || sv.visibility === StateVariableVisibility.EXTERNAL)
      .map((sv) => new InterfaceStateVariableNode(
        sv.type,
        sv.name,
        sv.visibility as StateVariableVisibility.PUBLIC | StateVariableVisibility.EXTERNAL,
      ));

    const collections = contract.collections
      .filter((c) => c.visibility === StateVariableVisibility.PUBLIC
        || c.visibility === StateVariableVisibility.EXTERNAL)
      .map((c) => new InterfaceCollectionNode(
        c.type,
        c.name,
        c.visibility as StateVariableVisibility.PUBLIC | StateVariableVisibility.EXTERNAL,
      ));

    const functions = contract.functions
      .filter((fn) => fn.isEntryPoint)
      .map((fn) => new InterfaceFunctionNode(
        fn.name,
        fn.parameters.map((p) => new ParameterNode(p.type, p.name)),
        fn.returnTypes,
      ));

    const iface = new InterfaceNode(contract.name, stateVars, collections, functions);
    iface.parents = [];
    return iface;
  }

  visitAbiEncodeWithSignature(node: AbiEncodeWithSignatureNode): Node {
    node.signature = this.visit(node.signature) as ExpressionNode;
    if (node.signature instanceof StringLiteralNode) {
      node.computedSelector = computeFunctionSelector(node.signature.value);
    }
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitAbiEncodeCall(node: AbiEncodeCallNode): Node {
    // `abi.encodeCall(this.method, (args))` targets a function of the current contract, not an interface.
    if (node.interfaceName === 'this') {
      const fn = this.currentContract?.functions.find((f) => f.name === node.functionName);
      if (!fn) {
        throw new AbiEncodeCallUndefinedFunctionError(node, 'this', node.functionName);
      }
      if (node.parameters.length !== fn.parameters.length) {
        throw new AbiEncodeCallArgCountError(node, fn.parameters.length, node.parameters.length);
      }
      const selfParamTypes = fn.parameters.map((p) => p.type.toString());
      node.computedSelector = computeFunctionSelector(computeFunctionSignature(node.functionName, selfParamTypes));
      node.resolvedParamTypes = fn.parameters.map((p) => p.type);
      node.parameters = this.visitList(node.parameters);
      return node;
    }

    const iface = this.interfaceMap.get(node.interfaceName);
    if (!iface) {
      throw new AbiEncodeCallUndefinedInterfaceError(node, node.interfaceName);
    }

    const allFunctions = this.getAllInterfaceFunctions(iface);
    const ifaceFunc = allFunctions.find((f) => f.name === node.functionName);
    if (!ifaceFunc) {
      throw new AbiEncodeCallUndefinedFunctionError(node, node.interfaceName, node.functionName);
    }

    if (node.parameters.length !== ifaceFunc.parameters.length) {
      throw new AbiEncodeCallArgCountError(node, ifaceFunc.parameters.length, node.parameters.length);
    }

    const paramTypes = ifaceFunc.parameters.map((p) => p.type.toString());
    const signature = computeFunctionSignature(node.functionName, paramTypes);
    node.computedSelector = computeFunctionSelector(signature);
    node.resolvedParamTypes = ifaceFunc.parameters.map((p) => p.type);

    node.parameters = this.visitList(node.parameters);
    return node;
  }

  /**
   * Recursively collect all functions from an interface, including inherited ones.
   * Deduplicates by function name + parameter signature (child overrides parent).
   */
  private getAllInterfaceFunctions(iface: InterfaceNode): InterfaceFunctionNode[] {
    const funcMap = new Map<string, InterfaceFunctionNode>();

    // First, collect functions from parent interfaces (in order)
    for (const parentName of iface.parents) {
      const parent = this.interfaceMap.get(parentName);
      if (!parent) continue; // Already validated during registration
      const parentFuncs = this.getAllInterfaceFunctions(parent);
      for (const func of parentFuncs) {
        const sig = `${func.name}(${func.parameters.map((p) => p.type.toString()).join(',')})`;
        funcMap.set(sig, func);
      }
    }

    // Then, add/override with the interface's own functions
    for (const func of iface.functions) {
      const sig = `${func.name}(${func.parameters.map((p) => p.type.toString()).join(',')})`;
      funcMap.set(sig, func);
    }

    return [...funcMap.values()];
  }

  // A `public`/`external` state var or mapping auto-generates a getter (Solidity), which satisfies an interface
  // getter function: `T x` -> `x() returns (T)`; `mapping(K1 => .. => V) m` -> `m(K1, ..) returns (V)`.
  private publicStateVarSatisfiesGetter(ifaceFunc: InterfaceFunctionNode): boolean {
    if (ifaceFunc.returnTypes.length !== 1) return false;
    const ret = ifaceFunc.returnTypes[0].toString();
    const isPublic = (v: StateVariableVisibility): boolean =>
      v === StateVariableVisibility.PUBLIC || v === StateVariableVisibility.EXTERNAL;
    const sv = this.stateVariableMap.get(ifaceFunc.name);
    if (sv && isPublic(sv.visibility) && ifaceFunc.parameters.length === 0 && sv.type.toString() === ret) {
      return true;
    }
    const coll = this.collectionMap.get(ifaceFunc.name);
    if (coll && isPublic(coll.visibility) && coll.type instanceof MappingType) {
      const keys: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let t: any = coll.type;
      while (t instanceof MappingType) { keys.push(t.keyType.toString()); t = t.valueType; }
      if (keys.length === ifaceFunc.parameters.length
        && keys.every((k, i) => k === ifaceFunc.parameters[i].type.toString())
        && t.toString() === ret) {
        return true;
      }
    }
    return false;
  }

  // Callable functions for an external-call target name: an interface's functions, or - treating a contract
  // as its own interface - a contract's functions. The callee's own covenant arbiters which are callable, so
  // exposing all is safe. Returns undefined if the name is neither an interface nor a contract.
  private getCalleeFunctions(name: string): (InterfaceFunctionNode | FunctionDefinitionNode)[] | undefined {
    const iface = this.interfaceMap.get(name);
    if (iface) return this.getAllInterfaceFunctions(iface);
    const contract = this.contractMap.get(name);
    if (contract) return contract.functions;
    return undefined;
  }

  /**
   * Recursively collect all state variables from an interface, including inherited ones.
   * Deduplicates by variable name (child overrides parent).
   */
  private getAllInterfaceStateVariables(iface: InterfaceNode): InterfaceStateVariableNode[] {
    const varMap = new Map<string, InterfaceStateVariableNode>();

    // First, collect state variables from parent interfaces (in order)
    for (const parentName of iface.parents) {
      const parent = this.interfaceMap.get(parentName);
      if (!parent) continue; // Already validated during registration
      const parentVars = this.getAllInterfaceStateVariables(parent);
      for (const sv of parentVars) {
        varMap.set(sv.name, sv);
      }
    }

    // Then, add/override with the interface's own state variables
    for (const sv of iface.stateVariables) {
      varMap.set(sv.name, sv);
    }

    return [...varMap.values()];
  }

  /**
   * Recursively collect all collections from an interface, including inherited ones.
   */
  private getAllInterfaceCollections(iface: InterfaceNode): InterfaceCollectionNode[] {
    const collMap = new Map<string, InterfaceCollectionNode>();

    for (const parentName of iface.parents) {
      const parent = this.interfaceMap.get(parentName);
      if (!parent) continue;
      const parentColls = this.getAllInterfaceCollections(parent);
      for (const coll of parentColls) {
        collMap.set(coll.name, coll);
      }
    }

    for (const coll of iface.collections) {
      collMap.set(coll.name, coll);
    }

    return [...collMap.values()];
  }

  /**
   * Compute the state variable layout for an interface using the same bin-packing
   * algorithm as the contract's layout (ensures deterministic match).
   */
  private computeInterfaceStateLayout(iface: InterfaceNode): {
    name: string; type: Type; nftIndex: number; fieldIndex: number;
    visibility: StateVariableVisibility.PUBLIC | StateVariableVisibility.EXTERNAL;
  }[] {
    type IfaceVarLayout = {
      name: string; type: Type; nftIndex: number; fieldIndex: number;
      visibility: StateVariableVisibility.PUBLIC | StateVariableVisibility.EXTERNAL;
    };
    const allVars = this.getAllInterfaceStateVariables(iface);
    const commitmentLimit = this.compilerOptions.commitmentLimit ?? 128;
    const result: IfaceVarLayout[] = [];
    let nftIndex = 0;
    let fieldIndex = 0;
    let currentNftUsed = 0;

    for (const sv of allVars) {
      // Mirror the main bin-packing: dynamic-storage vars reserve only the uint32 length-header
      // footprint (A$len), so external-read nftIndex computation stays consistent with the real layout.
      let maxSize = getMaxPushdataEncodedSizeForType(sv.type);
      if (isDynamicStorageType(sv.type)) {
        maxSize = getMaxPushdataEncodedSizeForType(new IntType(false, 32));
      }

      if (sv.visibility === StateVariableVisibility.EXTERNAL) {
        if (currentNftUsed > 0) {
          nftIndex++;
          fieldIndex = 0;
          currentNftUsed = 0;
        }
        result.push({ name: sv.name, type: sv.type, nftIndex, fieldIndex: 0, visibility: sv.visibility });
        nftIndex++;
        fieldIndex = 0;
        currentNftUsed = 0;
      } else if (sv.type instanceof StructType) {
        if (currentNftUsed + maxSize > commitmentLimit && currentNftUsed > 0) {
          nftIndex++;
          fieldIndex = 0;
          currentNftUsed = 0;
        }
        result.push({ name: sv.name, type: sv.type, nftIndex, fieldIndex, visibility: sv.visibility });
        fieldIndex++;
        currentNftUsed += maxSize;
        nftIndex++;
        fieldIndex = 0;
        currentNftUsed = 0;
      } else {
        if (currentNftUsed + maxSize > commitmentLimit && currentNftUsed > 0) {
          nftIndex++;
          fieldIndex = 0;
          currentNftUsed = 0;
        }
        result.push({ name: sv.name, type: sv.type, nftIndex, fieldIndex, visibility: sv.visibility });
        fieldIndex++;
        currentNftUsed += maxSize;
      }
    }

    return result;
  }

  /**
   * Check for circular interface inheritance using DFS.
   */
  private checkCircularInheritance(iface: InterfaceNode, visited: Set<string>): void {
    if (visited.has(iface.name)) {
      throw new CircularInterfaceInheritanceError(iface);
    }
    visited.add(iface.name);
    for (const parentName of iface.parents) {
      const parent = this.interfaceMap.get(parentName);
      if (parent) {
        this.checkCircularInheritance(parent, new Set(visited));
      }
    }
  }

  private registerError(err: ErrorDefinitionNode): void {
    const sig = computeErrorSignature(err.name, err.parameters.map((p) => p.type.toString()));
    err.signature = sig;
    if (this.errorMap.has(sig)) {
      throw new ErrorRedefinitionError(err);
    }
    this.errorMap.set(sig, err);
  }

  visitRequire(node: RequireNode): Node {
    node.expression = this.visit(node.expression);
    if (node.errorName) {
      // require(cond, CustomError(args)): resolve the error like a revert.
      const candidates = [...this.errorMap.values()].filter((e) => e.name === node.errorName);
      if (candidates.length === 0) {
        throw new UndefinedErrorError(node);
      }
      if (candidates.length === 1) {
        node.errorDefinition = candidates[0];
      }
      node.args = this.visitList(node.args);
    }
    return node;
  }

  visitRevert(node: RevertNode): Node {
    if (node.errorName) {
      // Look up error by name
      const candidates = [...this.errorMap.values()].filter((e) => e.name === node.errorName);
      if (candidates.length === 0) {
        throw new UndefinedErrorError(node);
      }
      if (node.fieldNames) {
        // Named-arg revert `revert E({b: y, a: x})`: pick the error whose params match the names and reorder.
        const match = candidates.find((e) => e.parameters.length === node.fieldNames!.length
          && e.parameters.every((p) => node.fieldNames!.includes(p.name)));
        if (!match) {
          throw new NamedArgumentError(
            node, `No error '${node.errorName}' matches named arguments {${node.fieldNames.join(', ')}}`,
          );
        }
        node.args = match.parameters.map((p) => node.args[node.fieldNames!.indexOf(p.name)]);
        node.errorDefinition = match;
        node.fieldNames = undefined;
      } else if (candidates.length === 1) {
        node.errorDefinition = candidates[0];
      }
      // Multiple overloads: defer to TypeCheckTraversal

      const line = node.location?.start?.line;
      const loc = line ? ` at line ${line}` : '';
      console.log(`Warning: revert with custom error is a no-op in SolidCash${loc}. Error arguments are type-checked but not evaluated; the script simply fails unconditionally.`);
    }

    node.args = this.visitList(node.args);
    return node;
  }

  visitAssert(node: AssertNode): Node {
    node.expression = this.visit(node.expression);
    return node;
  }

  private registerEnum(ed: EnumDefinitionNode): void {
    if (this.enumMap.has(ed.name)) {
      throw new EnumRedefinitionError(ed);
    }
    const enumType = new EnumType(ed.name, ed.members);
    this.enumMap.set(ed.name, enumType);
    // Register as a CONSTANT symbol so Identifier("Color") resolves but doesn't track stack usage
    this.symbolTables[0].set(Symbol.enumType(ed.name, enumType));
  }

  // A name is shadowed by a local/parameter when the nearest scope entry is a plain variable.
  private isShadowedByLocal(name: string): boolean {
    return this.symbolTables[0].get(name)?.symbolType === SymbolType.VARIABLE;
  }

  visitIdentifier(node: IdentifierNode): Node {
    this.qualifyLibrarySiblingConstant(node);
    const definition = this.symbolTables[0].get(node.name);
    if (!definition) {
      throw new UndefinedReferenceError(node);
    }

    // Bare reference to a state variable with no shadowing local: resolve as `this.<name>` (Solidity reads
    // state vars by name; an inner-scope local shadows them via the scope chain checked above).
    if (definition.symbolType === SymbolType.STATE_VARIABLE) {
      const stateNode = new StateAccessNode(node.name);
      stateNode.location = node.location;
      stateNode.fromModifier = node.fromModifier; // preserve inlined-modifier origin for the private-var check
      return this.visit(stateNode);
    }

    // Function name used as a value (function pointer): resolve to its definition. Must be a single
    // (non-overloaded) function; codegen pushes its integer functionId. Inlined, so no opRolls slot.
    if (definition.symbolType === SymbolType.FUNCTION && this.expectedSymbolType === SymbolType.VARIABLE) {
      const overloads = this.functionDefinitions.get(node.name) ?? [];
      if (overloads.length !== 1) {
        throw new InvalidSymbolTypeError(node, this.expectedSymbolType);
      }
      node.definition = definition;
      node.functionReference = overloads[0];
      definition.references.push(node);
      return node;
    }

    // Allow constants where variables are expected
    if (definition.symbolType !== this.expectedSymbolType
        && !(definition.symbolType === SymbolType.CONSTANT && this.expectedSymbolType === SymbolType.VARIABLE)) {
      throw new InvalidSymbolTypeError(node, this.expectedSymbolType);
    }

    node.definition = definition;
    node.definition.references.push(node);

    // Keep track of final use of variables for code generation (excluding console statements)
    // Constants are inlined, so they don't need stack tracking
    if (!this.insideConsoleStatement && definition.symbolType !== SymbolType.CONSTANT) {
      if (this.conditionalBranchDepth > 0) {
        // Used inside a conditionally-skipped branch: never roll-eligible (stays on the stack).
        this.conditionalRefNames.add(node.name);
        this.currentFunction.opRolls.delete(node.name);
      } else if (!this.conditionalRefNames.has(node.name)) {
        this.currentFunction.opRolls.set(node.name, node);
      }
    }

    return node;
  }

  // Whether a local is assigned again (beyond its initializer) anywhere in the current function body. Keeps the
  // `fun.selector` fold sound: only a never-reassigned function pointer folds to a compile-time selector.
  private localIsReassigned(name: string): boolean {
    let found = false;
    const walk = (n: Node | undefined): void => {
      if (!n || found) return;
      if (n instanceof AssignNode && n.identifier?.name === name) { found = true; return; }
      for (const [k, v] of Object.entries(n)) {
        if (k === 'type' || k === 'symbolTable' || k === 'location' || k === 'definition' || k === 'references') continue;
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) walk(it);
      }
    };
    walk(this.currentFunction?.body);
    return found;
  }

  visitFieldAccess(node: FieldAccessNode): Node {
    // `this.<fn>.selector` -> the function's 4-byte selector (bytes4). `this.<fn>` parses as a state access;
    // intercept before it resolves (it is a function, not a state var) and fold to the precomputed selector.
    if (node.expression instanceof StateAccessNode && node.name === 'selector') {
      const fn = this.functionDefinitions.get(node.expression.name)?.[0];
      if (fn?.functionSelector) {
        const lit = new HexLiteralNode(fn.functionSelector);
        lit.location = node.location;
        return lit;
      }
    }

    // `this.<fn>.address` -> the contract's own address (the fn is hosted by this contract), i.e. `address(this)`
    // = the locking bytecode of the input being spent. Byte-identical to a hand-written `address(this)`.
    if (node.expression instanceof StateAccessNode && node.name === 'address'
      && this.functionDefinitions.has(node.expression.name)) {
      const idx = new NullaryOpNode(NullaryOperator.INPUT_INDEX);
      idx.location = node.location;
      const lb = new UnaryOpNode(UnaryOperator.INPUT_LOCKING_BYTECODE, idx);
      lb.location = node.location;
      const cast = new CastNode(new AddressType(false), lb, false);
      cast.location = node.location;
      return cast;
    }

    // Bare `<fn>.selector` -> the own/inherited function's 4-byte selector (mirrors `this.<fn>.selector`).
    if (node.name === 'selector' && node.expression instanceof IdentifierNode) {
      const fn = this.functionDefinitions.get(node.expression.name)?.[0];
      if (fn?.functionSelector) {
        const lit = new HexLiteralNode(fn.functionSelector);
        lit.location = node.location;
        return lit;
      }
    }

    // `fun.selector` where `fun` is a function-typed LOCAL initialized from a function reference (`this.f` / a bare
    // own function) and NEVER reassigned: fold to that function's selector, like `this.f.selector`. A reassigned
    // pointer would need a runtime selector (a solidcash function value is a functionId, not an (addr, selector)
    // pair) - leave those to the normal path (they error), so this stays sound.
    if (node.name === 'selector' && node.expression instanceof IdentifierNode) {
      const def = this.symbolTables[0].get(node.expression.name)?.definition;
      if (def instanceof VariableDefinitionNode && def.type instanceof FunctionType
        && def.expression instanceof IdentifierNode && def.expression.functionReference?.functionSelector
        && !this.localIsReassigned(node.expression.name)) {
        const lit = new HexLiteralNode(def.expression.functionReference.functionSelector);
        lit.location = node.location;
        return lit;
      }
    }

    // `(cond ? A : B).selector` where A and B are each a function reference (`this.f` state access or a bare own
    // function): fold to `cond ? A.selector : B.selector` - a runtime choice between two compile-time selectors.
    if (node.name === 'selector' && node.expression instanceof TernaryOpNode) {
      const branchSelector = (e: Node): Uint8Array | undefined => {
        if (e instanceof StateAccessNode) return this.functionDefinitions.get(e.name)?.[0]?.functionSelector;
        if (e instanceof IdentifierNode) return this.functionDefinitions.get(e.name)?.[0]?.functionSelector;
        return undefined;
      };
      const selT = branchSelector(node.expression.ifTrue);
      const selF = branchSelector(node.expression.ifFalse);
      if (selT && selF) {
        const litT = new HexLiteralNode(selT);
        const litF = new HexLiteralNode(selF);
        litT.location = node.location;
        litF.location = node.location;
        const tern = new TernaryOpNode(this.visit(node.expression.condition) as ExpressionNode, litT, litF);
        tern.location = node.location;
        return tern;
      }
    }

    // `Interface.method.selector` / `Contract.method.selector` -> the method's 4-byte selector (bytes4), computed
    // from its signature. Mirrors `this.<fn>.selector` for own functions. Also handles a contract- or interface-
    // typed variable `v.method.selector` (v's declared type names the contract/interface).
    if (node.name === 'selector' && node.expression instanceof FieldAccessNode
      && node.expression.expression instanceof IdentifierNode) {
      const fa = node.expression;
      const baseName = (fa.expression as IdentifierNode).name;
      const params = (name: string): ParameterNode[] | undefined => {
        const im = this.interfaceMap.get(name)?.functions.find((f) => f.name === fa.name);
        if (im) return im.parameters;
        return this.contractMap.get(name)?.functions.find((f) => f.name === fa.name)?.parameters;
      };
      // A contract/interface-typed variable carries its type name in AddressType.interfaceName (toString is
      // just 'address'); look it up in the scope chain, then the state vars.
      let varType: Type | undefined;
      for (let i = this.symbolTables.length - 1; i >= 0 && !varType; i -= 1) varType = this.symbolTables[i]?.get(baseName)?.type;
      varType = varType ?? this.stateVariableMap.get(baseName)?.type;
      const varContract = varType instanceof AddressType ? varType.interfaceName : undefined;
      const methodParams = params(baseName) ?? (varContract ? params(varContract) : undefined);
      if (methodParams) {
        const sig = computeFunctionSignature(fa.name, methodParams.map((p) => p.type.toString()));
        const lit = new HexLiteralNode(computeFunctionSelector(sig));
        lit.location = node.location;
        return lit;
      }
      // `L.f.selector` for a library function: computed from the parse-time declared signature (recorded in
      // AstBuilder), which also covers functions later inlined away (storage-pointer fns leave no
      // functionDefinitions entry).
      const libSig = this.libraryFunctionSignatures.get(`${baseName}.${fa.name}`);
      if (libSig) {
        const sig = computeFunctionSignature(fa.name, libSig);
        const lit = new HexLiteralNode(computeFunctionSelector(sig));
        lit.location = node.location;
        return lit;
      }
    }

    // `Q.E.selector` (library/contract/interface-qualified EVENT) and bare `E.selector`: the 32-byte event
    // selector = sha256 of the signature (the platform analog of Solidity's topic hash; signature-injective).
    // Function selectors above take precedence - this only fires when no function matched.
    if (node.name === 'selector') {
      const eventSelectorLit = (evName: string, paramTypes?: string[]): HexLiteralNode | undefined => {
        if (!paramTypes) return undefined;
        const lit = new HexLiteralNode(computeEventSelector(computeEventSignature(evName, paramTypes)));
        lit.location = node.location;
        lit.type = new BytesType(32);
        return lit;
      };
      if (node.expression instanceof FieldAccessNode && node.expression.expression instanceof IdentifierNode) {
        const q = node.expression.expression.name;
        const evName = node.expression.name;
        const fromLib = eventSelectorLit(evName, this.libraryEventSignatures.get(`${q}.${evName}`));
        if (fromLib) return fromLib;
        const holder = this.contractMap.get(q) ?? this.interfaceMap.get(q);
        const ev = holder?.eventDefinitions?.find((e) => e.name === evName);
        if (ev) {
          const fromHolder = eventSelectorLit(evName, ev.parameters.map((p) => p.type.toString()));
          if (fromHolder) return fromHolder;
        }
      }
      if ((node.expression instanceof IdentifierNode || node.expression instanceof StateAccessNode)
        && !this.functionDefinitions.has(node.expression.name)) {
        // Own + inherited events live merged on the contract node (available even during state-var
        // initializers, before eventMap - which is keyed by signature - fills).
        const bareName = node.expression.name;
        const ev = this.currentContract?.eventDefinitions?.find((e) => e.name === bareName)
          ?? [...this.eventMap.values()].find((e) => e.name === bareName);
        if (ev) {
          const fromEvent = eventSelectorLit(ev.name, ev.parameters.map((p) => p.type.toString()));
          if (fromEvent) return fromEvent;
        }
      }
    }

    // Namespaced library function used as a VALUE (`ptr = L.f`): rewrite to the flat registered name so the
    // function-pointer path resolves it (single overload -> functionReference; codegen pushes its functionId).
    if (node.expression instanceof IdentifierNode && this.expectedSymbolType === SymbolType.VARIABLE) {
      const compoundName = `${node.expression.name}.${node.name}`;
      if (this.functionDefinitions.has(compoundName)) {
        const identifier = new IdentifierNode(compoundName);
        identifier.location = node.location;
        return this.visit(identifier);
      }
      // `C.f` with C the current contract: an own function used as a value, same as bare `f`. External
      // functions are not identifier symbols (self external refs route via this.f), so only internal ones.
      const ownFn = node.expression.name === this.currentContract?.name
        ? this.functionDefinitions.get(node.name)?.[0] : undefined;
      if (ownFn && ownFn.visibility !== 'external') {
        const identifier = new IdentifierNode(node.name);
        identifier.location = node.location;
        return this.visit(identifier);
      }
    }

    // Detect namespaced constant access (e.g. SafeMath.MAX_SAFE from a library)
    if (node.expression instanceof IdentifierNode) {
      const compoundName = `${node.expression.name}.${node.name}`;
      const constant = this.constantMap.get(compoundName);
      if (constant) {
        const identifier = new IdentifierNode(compoundName);
        identifier.location = node.location;
        const definition = this.symbolTables[0].get(compoundName);
        if (definition) {
          identifier.definition = definition;
          definition.references.push(identifier);
        }
        return identifier;
      }
    }

    // Contract-qualified constant `C.X` / `Base.X`: inheritance is flattened before this pass, so an inherited
    // constant already lives in the current contract's scope under its bare name (with inheritedFrom = the
    // defining base). Resolve `Q.X` -> bare `X` only when Q is the current contract (X own or inherited) or Q is
    // the base X was inherited from - an unrelated `Other.X` is a different X, not in scope (stays unresolved).
    if (node.expression instanceof IdentifierNode && this.constantMap.has(node.name)) {
      const qualifier = node.expression.name;
      const constDef = this.constantMap.get(node.name)!;
      if (qualifier === this.currentContract?.name || constDef.inheritedFrom === qualifier) {
        const identifier = new IdentifierNode(node.name);
        identifier.location = node.location;
        const definition = this.symbolTables[0].get(node.name);
        if (definition) {
          identifier.definition = definition;
          definition.references.push(identifier);
        }
        return identifier;
      }
    }

    // Detect cross-contract references: ContractB.lockingBytecode
    if (node.expression instanceof IdentifierNode && node.name === 'lockingBytecode') {
      const contract = this.contractMap.get(node.expression.name);
      if (contract) {
        if (contract.parameters.length > 0) {
          throw new ContractNoArgsRequiredError(node, contract.name);
        }
        const ref = new ContractReferenceNode(contract.name, contract, [], 'lockingBytecode');
        ref.location = node.location;
        return ref;
      }
    }

    // Detect cross-contract references: ContractB(args).lockingBytecode
    if (node.expression instanceof FunctionCallNode && node.name === 'lockingBytecode') {
      const contract = this.contractMap.get(node.expression.identifier.name);
      if (contract) {
        if (node.expression.parameters.length !== contract.parameters.length) {
          throw new ContractConstructorArgCountError(
            node, contract.name, contract.parameters.length, node.expression.parameters.length,
          );
        }
        // Visit the constructor args for symbol resolution
        const args = this.visitList(node.expression.parameters) as ExpressionNode[];
        const ref = new ContractReferenceNode(contract.name, contract, args, 'lockingBytecode');
        ref.location = node.location;
        return ref;
      }
    }

    // Detect outState accessor: ICounter(addr).outState
    if (node.expression instanceof FunctionCallNode && node.name === 'outState') {
      const iface = this.interfaceMap.get(node.expression.identifier.name);
      if (iface) {
        const paramCount = node.expression.parameters.length;
        if (paramCount !== 1) {
          throw new ExternalReadArgCountError(node, iface.name, paramCount);
        }
        const firstArg = node.expression.parameters[0];
        if (isEmptyBytesLiteral(firstArg)) {
          throw new ExternalAccessOnUnconnectedError(node, iface.name, 'outState');
        }
        const addressExpr = this.visit(firstArg) as ExpressionNode;
        const outStateNode = new ExternalOutputStateNode(iface.name, addressExpr);
        outStateNode.location = node.location;
        return outStateNode;
      }
    }

    // If the expression is a FieldAccessNode named 'outState', visit it first so it can be
    // transformed into an ExternalOutputStateNode before we check for outState field access.
    if (node.expression instanceof FieldAccessNode && node.expression.name === 'outState') {
      node.expression = this.visit(node.expression) as ExpressionNode;
    }

    // Detect outState field access: ExternalOutputStateNode.counter -> ExternalOutputStateAccessNode
    if (node.expression instanceof ExternalOutputStateNode) {
      const iface = this.interfaceMap.get(node.expression.interfaceName);
      if (!iface) {
        throw new UndefinedExternalStateVariableError(node, node.expression.interfaceName, node.name);
      }

      const allVars = this.getAllInterfaceStateVariables(iface);
      const ifaceVar = allVars.find((v) => v.name === node.name);
      if (!ifaceVar) {
        throw new UndefinedExternalStateVariableError(node, node.expression.interfaceName, node.name);
      }

      const layout = this.computeInterfaceStateLayout(iface);
      const varLayout = layout.find((l) => l.name === node.name)!;
      const calleeMultiNft = layout.some((l) => l.nftIndex >= 1);
      const fieldsInNft = layout
        .filter((l) => l.nftIndex === varLayout.nftIndex)
        .sort((a, b) => a.fieldIndex - b.fieldIndex)
        .map((l) => ({ type: l.type, fieldIndex: l.fieldIndex }));

      const accessNode = new ExternalOutputStateAccessNode(node.expression, node.name);
      accessNode.type = ifaceVar.type;
      accessNode.accessInfo = {
        interfaceName: node.expression.interfaceName,
        stateVarName: node.name,
        stateVarType: ifaceVar.type,
        nftIndex: varLayout.nftIndex,
        fieldIndex: varLayout.fieldIndex,
        fieldsInNft,
        externalOutStateSlotIndex: -1, // assigned later by pre-scan
        calleeMultiNft,
      };
      accessNode.location = node.location;
      return accessNode;
    }

    // Detect external state reads: ICounter(addr).stateVar
    if (node.expression instanceof FunctionCallNode) {
      const iface = this.interfaceMap.get(node.expression.identifier.name);
      if (iface) {
        const paramCount = node.expression.parameters.length;
        if (paramCount !== 1) {
          throw new ExternalReadArgCountError(node, iface.name, paramCount);
        }

        const firstArg = node.expression.parameters[0];

        // Unconnected mode: Name(0x) - only address-like properties allowed
        if (isEmptyBytesLiteral(firstArg)) {
          throw new ExternalAccessOnUnconnectedError(node, iface.name, node.name);
        }

        // Visit the address expression for symbol resolution
        const addressExpr = this.visit(firstArg) as ExpressionNode;

        // Check if it's a state variable read
        const allVars = this.getAllInterfaceStateVariables(iface);
        const ifaceVar = allVars.find((v) => v.name === node.name);
        if (ifaceVar) {
          const layout = this.computeInterfaceStateLayout(iface);
          const varLayout = layout.find((l) => l.name === node.name)!;
          // A callee that spans >1 data NFT tags each commitment with its nftIndex; the read verifies it
          // (a substituted sibling NFT carries a different tag and fails), making multi-NFT reads sound.
          const calleeMultiNft = layout.some((l) => l.nftIndex >= 1);
          const fieldsInNft = layout
            .filter((l) => l.nftIndex === varLayout.nftIndex)
            .sort((a, b) => a.fieldIndex - b.fieldIndex)
            .map((l) => ({ type: l.type, fieldIndex: l.fieldIndex }));

          const extNode = new ExternalStateAccessNode(iface.name, addressExpr, node.name);
          extNode.type = ifaceVar.type;
          extNode.readInfo = {
            interfaceName: iface.name,
            stateVarName: node.name,
            stateVarType: ifaceVar.type,
            nftIndex: varLayout.nftIndex,
            fieldIndex: varLayout.fieldIndex,
            fieldsInNft,
            externalReadSlotIndex: -1, // assigned later by pre-scan
            calleeMultiNft,
          };
          extNode.location = node.location;
          return extNode;
        }

        // Check if it's a collection read (returns ExternalMappingAccessNode with empty keys)
        const allCollections = this.getAllInterfaceCollections(iface);
        const ifaceColl = allCollections.find((c) => c.name === node.name);
        if (ifaceColl) {
          const collSig = computeCollectionSignature(ifaceColl.name, ifaceColl.type.toString());
          const extNode = new ExternalMappingAccessNode(iface.name, addressExpr, node.name, []);
          extNode.readInfo = {
            interfaceName: iface.name,
            collectionName: node.name,
            collectionSignature: collSig,
            keyTypes: ifaceColl.allKeyTypes,
            valueType: ifaceColl.innermostValueType,
            externalReadSlotIndex: -1,
          };
          extNode.type = ifaceColl.type;
          extNode.location = node.location;
          return extNode;
        }

        // Neither a state variable nor a collection on this interface
        throw new UndefinedExternalStateVariableError(node, iface.name, node.name);
      }
    }

    // Default: delegate to parent
    return super.visitFieldAccess(node);
  }

  visitTypeIntrospection(node: TypeIntrospectionNode): Node {
    const typeText = node.typeArgText;

    // Try resolving as an enum
    const enumType = this.enumMap.get(typeText);
    if (enumType) {
      node.resolvedType = enumType;
      if (node.property !== 'min' && node.property !== 'max') {
        throw new InvalidTypeIntrospectionPropertyError(node, typeText, node.property, ['min', 'max']);
      }
      return node;
    }

    // An imported contract is also registered as a synthesized interface, so disambiguate by property:
    // interfaceId -> the interface; name/creationCode/runtimeCode -> the contract.
    const iface = this.interfaceMap.get(typeText);
    const contract = this.contractMap.get(typeText);
    if (iface && (node.property === 'interfaceId' || !contract)) {
      node.interfaceNode = iface;
      if (node.property !== 'interfaceId') {
        throw new InvalidTypeIntrospectionPropertyError(node, typeText, node.property, ['interfaceId']);
      }
      // Pre-compute interfaceId: XOR of all function selectors
      const allFunctions = this.getAllInterfaceFunctions(iface);
      const interfaceId = new Uint8Array(4);
      for (const func of allFunctions) {
        const paramTypes = func.parameters.map((p) => p.type.toString());
        const sig = computeFunctionSignature(func.name, paramTypes);
        const selector = computeFunctionSelector(sig);
        for (let i = 0; i < 4; i++) {
          interfaceId[i] ^= selector[i];
        }
      }
      node.precomputedBytes = interfaceId;
      return node;
    }

    // Try resolving as a contract
    if (contract) {
      node.contractName = contract.name;
      // creationCode/runtimeCode return the child's compiled redeem script (BCH has no separate
      // creation vs runtime code); collected for compilation and emitted as bytes by codegen.
      if (node.property !== 'name' && node.property !== 'creationCode' && node.property !== 'runtimeCode') {
        throw new InvalidTypeIntrospectionPropertyError(
          node, typeText, node.property, ['name', 'creationCode', 'runtimeCode'],
        );
      }
      // On BCH the deployed redeem script is `pushdata(ctorArgs) || bodyBytecode` (constructor args PREPENDED),
      // whereas Solidity's `abi.encodePacked(creationCode, abi.encode(args))` APPENDS them. So for a contract
      // with constructor parameters, a `create2` over that appended bytecode will NOT reproduce the address of
      // a `new X(args)` deploy. Warn once so ported factory code does not silently compute a wrong address.
      const ctorParamCount = contract.constructorDef
        ? contract.constructorDef.parameters.length : contract.parameters.length;
      if ((node.property === 'creationCode' || node.property === 'runtimeCode') && ctorParamCount > 0) {
        const cloc = node.location ? ` at line ${node.location.start.line}` : '';
        console.log(`Warning: type(${contract.name}).${node.property}${cloc} does not include constructor `
          + 'arguments. On BCH the deploy redeem script prepends (not appends) constructor args, so '
          + `create2 over abi.encodePacked(${node.property}, abi.encode(args)) will not match a `
          + `new ${contract.name}(args) address; use new ${contract.name}(args) for a correct deterministic address.`);
      }
      return node;
    }

    // Try resolving as a built-in numeric type (IntType, FixedType)
    const resolved = this.resolveNumericType(typeText);
    if (resolved) {
      node.resolvedType = resolved;
      if (node.property !== 'min' && node.property !== 'max') {
        throw new InvalidTypeIntrospectionPropertyError(node, typeText, node.property, ['min', 'max']);
      }
      return node;
    }

    throw new InvalidTypeForIntrospectionError(node, typeText);
  }

  private resolveNumericType(typeText: string): IntType | FixedType | undefined {
    // Under Solidity-compat, bare `uint`/`int` alias uint256/int256 (so `type(uint).max` works like
    // `type(uint256).max`). Native solidcash requires the explicit width (int is the unbounded VM integer).
    if (this.compilerOptions.solidityImportCompat) {
      if (typeText === 'uint') return new IntType(false, 256);
      if (typeText === 'int') return new IntType(true, 256);
    }
    // Bounded integer: int8, uint256, etc.
    const intMatch = typeText.match(/^(u?int)(\d+)$/);
    if (intMatch) {
      const signed = intMatch[1] === 'int';
      const bits = parseInt(intMatch[2], 10);
      if (IntType.isValidBitWidth(bits)) {
        return new IntType(signed, bits);
      }
    }

    // Fixed-point: fixed128x18, ufixed64x8, etc.
    if (typeText === 'fixed') return new FixedType(true, 128, 18);
    if (typeText === 'ufixed') return new FixedType(false, 128, 18);
    const fixedMatch = typeText.match(/^(u?fixed)(\d+)x(\d+)$/);
    if (fixedMatch) {
      const signed = fixedMatch[1] === 'fixed';
      const bits = parseInt(fixedMatch[2], 10);
      const decimals = parseInt(fixedMatch[3], 10);
      if (FixedType.isValidBitWidth(bits) && FixedType.isValidDecimals(decimals)) {
        return new FixedType(signed, bits, decimals);
      }
    }

    return undefined;
  }

  override visitUsingForDirective(node: UsingForDirectiveNode): Node {
    // Key bindings by the resolved type string so they match the lookup (which uses the value's resolved
    // type.toString()). e.g. `using ... for int` keys under 'int256' now that `int` resolves to int256.
    // Struct/enum/contract names aren't parseable here, so fall back to the raw name (which matches too).
    let typeKey = node.isWildcard ? '*' : (node.targetTypeName ?? '*');
    if (!node.isWildcard && node.targetTypeName) {
      try { typeKey = parseTypeStrict(node.targetTypeName).toString(); } catch { /* keep raw name */ }
    }

    if (node.libraryName) {
      // Form 1: using LibName for Type - find all functions starting with "LibName."
      const prefix = `${node.libraryName}.`;
      const found = [...this.functionDefinitions.keys()].filter((k) => k.startsWith(prefix));
      if (found.length === 0) {
        // A KNOWN library with no registrable functions is a no-op binding, not an error: the library may
        // be empty (`library L {}`) or all its functions inlined away (storage-pointer fns cannot stand
        // alone as subroutines). Only an unknown name is a genuine undefined reference.
        if (this.knownLibraryNames.has(node.libraryName)) return node;
        throw new UsingForUndefinedLibraryError(node, node.libraryName);
      }
      const bindings = this.usingForBindings.get(typeKey) ?? [];
      for (const fullName of found) {
        const methodName = fullName.substring(prefix.length);
        bindings.push({ methodName, fullFunctionName: fullName });
      }
      this.usingForBindings.set(typeKey, bindings);
    } else if (node.functionBindings) {
      // Form 2: using {func1, LibName.func2, func3 as +} for Type - specific functions
      const bindings = this.usingForBindings.get(typeKey) ?? [];
      for (const binding of node.functionBindings) {
        const funcRef = binding.funcName;
        const overloads = this.functionDefinitions.get(funcRef);
        if (!overloads || overloads.length === 0) {
          throw new UsingForUndefinedFunctionError(node, funcRef);
        }

        if (binding.operator) {
          // Operator overload binding - validate and register
          this.registerOperatorOverload(node, typeKey, binding, overloads[0]);
        } else {
          // Regular method binding
          const methodName = funcRef.includes('.') ? funcRef.split('.').pop()! : funcRef;
          bindings.push({ methodName, fullFunctionName: funcRef });
        }
      }
      this.usingForBindings.set(typeKey, bindings);
    }
    return node;
  }

  private registerOperatorOverload(
    node: UsingForDirectiveNode,
    typeKey: string,
    binding: UsingForBinding,
    func: FunctionDefinitionNode,
  ): void {
    const operator = binding.operator!;
    const funcName = binding.funcName;

    // Operator overloading is only allowed on UDVTs
    const targetType = this.typeDefMap.get(typeKey);
    if (!targetType) {
      throw new OperatorOverloadNonUDVTError(node, operator, typeKey);
    }

    const params = func.parameters.filter((p) => !p.name.startsWith('__internal__'));
    const isUnary = params.length === 1;
    const isBinary = params.length === 2;

    // Only '-' and '~' can be unary
    if (isUnary && operator !== '-' && operator !== '~') {
      throw new OperatorOverloadSignatureError(node, funcName,
        `unary operator '${operator}' is not supported, only '-' and '~' can be unary`);
    }

    if (!isUnary && !isBinary) {
      throw new OperatorOverloadSignatureError(node, funcName,
        `expected 1 (unary) or 2 (binary) parameters, got ${params.length}`);
    }

    // All params must be the target UDVT type
    for (const param of params) {
      if (!(param.type instanceof ValueType) || param.type.toString() !== typeKey) {
        throw new OperatorOverloadSignatureError(node, funcName,
          `parameter '${param.name}' must be of type '${typeKey}', got '${param.type}'`);
      }
    }

    // Validate return type
    const comparisonOps = ['==', '!=', '<', '<=', '>', '>='];
    const returnType = func.returnTypes[0];
    if (comparisonOps.includes(operator)) {
      if (returnType !== PrimitiveType.BOOL) {
        throw new OperatorOverloadSignatureError(node, funcName,
          `comparison operator '${operator}' must return 'bool', got '${returnType}'`);
      }
    } else {
      if (!(returnType instanceof ValueType) || returnType.toString() !== typeKey) {
        throw new OperatorOverloadSignatureError(node, funcName,
          `arithmetic/bitwise operator '${operator}' must return '${typeKey}', got '${returnType}'`);
      }
    }

    // Determine operator key (distinguish unary from binary for '-' and '~')
    const opKey = isUnary ? `unary_${operator}` : operator;

    // Store in operatorOverloads map
    let overloads = this.operatorOverloads.get(typeKey);
    if (!overloads) {
      overloads = new Map();
      this.operatorOverloads.set(typeKey, overloads);
    }
    overloads.set(opKey, funcName);
  }

  override visitBinaryOp(node: BinaryOpNode): Node {
    node.left = this.visit(node.left) as ExpressionNode;
    // Short-circuit && / || only conditionally evaluate the right operand.
    const shortCircuit = node.operator === BinaryOperator.AND || node.operator === BinaryOperator.OR;
    if (shortCircuit) this.conditionalBranchDepth += 1;
    node.right = this.visit(node.right) as ExpressionNode;
    if (shortCircuit) this.conditionalBranchDepth -= 1;

    if (this.operatorOverloads.size === 0) return node;

    const leftType = this.getExpressionType(node.left);
    if (leftType instanceof ValueType) {
      const overloads = this.operatorOverloads.get(leftType.toString());
      const funcName = overloads?.get(node.operator);
      if (funcName) {
        return this.createOperatorFunctionCall(funcName, [node.left, node.right], node);
      }
    }
    return node;
  }

  override visitTernaryOp(node: TernaryOpNode): Node {
    // Only the condition is always evaluated; the two arms are conditionally skipped.
    node.condition = this.visit(node.condition) as ExpressionNode;
    this.conditionalBranchDepth += 1;
    node.ifTrue = this.visit(node.ifTrue) as ExpressionNode;
    node.ifFalse = this.visit(node.ifFalse) as ExpressionNode;
    this.conditionalBranchDepth -= 1;
    return node;
  }

  override visitUnaryOp(node: UnaryOpNode): Node {
    node.expression = this.visit(node.expression) as ExpressionNode;

    if (this.operatorOverloads.size === 0) return node;

    const exprType = this.getExpressionType(node.expression);
    if (exprType instanceof ValueType) {
      const overloads = this.operatorOverloads.get(exprType.toString());
      let opKey: string | undefined;
      if (node.operator === UnaryOperator.NEGATE) opKey = 'unary_-';
      if (node.operator === UnaryOperator.INVERT) opKey = 'unary_~';
      const funcName = opKey ? overloads?.get(opKey) : undefined;
      if (funcName) {
        return this.createOperatorFunctionCall(funcName, [node.expression], node);
      }
    }
    return node;
  }

  private getExpressionType(expr: ExpressionNode): Type | undefined {
    if (expr.type) return expr.type;
    if (expr instanceof IdentifierNode) return expr.definition?.type;
    if (expr instanceof FunctionCallNode && expr.resolvedFunction) {
      return expr.resolvedFunction.returnTypes?.[0];
    }
    return undefined;
  }

  private createOperatorFunctionCall(
    funcName: string,
    args: ExpressionNode[],
    originalNode: Node,
  ): FunctionCallNode {
    const identifier = new IdentifierNode(funcName);
    identifier.location = originalNode.location;
    const funcCall = new FunctionCallNode(identifier, args);
    funcCall.location = originalNode.location;

    const overloads = this.functionDefinitions.get(funcName);
    if (overloads && overloads.length === 1) {
      funcCall.resolvedFunction = overloads[0];
    }

    // Resolve identifier in symbol table
    this.expectedSymbolType = SymbolType.FUNCTION;
    funcCall.identifier = this.visit(funcCall.identifier) as IdentifierNode;
    this.expectedSymbolType = SymbolType.VARIABLE;

    // The operands were already visited (and roll-marked) by the operator visitor; the rewritten call
    // evaluates them as reversed OP_INVOKE args, so duplicate operand vars need the same PICK-only guard.
    this.protectDuplicateCallArgVars(args);

    return funcCall;
  }

  private tryResolveUsingFor(node: MethodCallNode): Node | undefined {
    // Get the object's type
    let objectType = node.object.type
      ?? (node.object instanceof IdentifierNode ? node.object.definition?.type : undefined);
    // For chained calls (e.g. a.mul(b).div(c)), infer from resolved function's return type.
    if (!objectType && node.object instanceof FunctionCallNode && node.object.resolvedFunction) {
      objectType = node.object.resolvedFunction.returnTypes[0];
    }
    // For this.collection[key].method(), infer from collection's value type.
    if (!objectType && node.object instanceof MappingAccessNode && node.object.collection) {
      const col = node.object.collection;
      objectType = col.type instanceof MappingType ? col.type.valueType
        : col.type instanceof ArrayType ? col.type.elementType : undefined;
    }
    // For this.stateVar.method(), infer from state variable type.
    if (!objectType && node.object instanceof StateAccessNode && node.object.stateVariable) {
      objectType = node.object.stateVariable.type;
    }
    // For chained calls (e.g. a.mul(b).div(c)), the inner FunctionCallNode
    // may not have its type set yet. Infer from the resolved function's return type.
    if (!objectType && node.object instanceof FunctionCallNode && node.object.resolvedFunction) {
      objectType = node.object.resolvedFunction.returnTypes[0];
    }
    // For this.collection[key].method(), the MappingAccessNode type isn't set until
    // type checking. Infer from the collection's innermost value type.
    if (!objectType && node.object instanceof MappingAccessNode && node.object.collection) {
      const col = node.object.collection;
      objectType = col.type instanceof MappingType ? col.type.valueType
        : col.type instanceof ArrayType ? col.type.elementType : undefined;
    }
    // For this.stateVar.method(), infer type from the state variable definition.
    if (!objectType && node.object instanceof StateAccessNode && node.object.stateVariable) {
      objectType = node.object.stateVariable.type;
    }
    // A builtin-call receiver (e.g. `keccak256(x).toEthSignedMessageHash()`) has no resolvedFunction (builtins are
    // not user functions) and no .type yet (set in TypeCheck); read the global function's declared return type.
    if (!objectType && node.object instanceof FunctionCallNode) {
      const sym = GLOBAL_SYMBOL_TABLE.get(node.object.identifier.name);
      if (sym?.symbolType === SymbolType.FUNCTION) objectType = sym.type;
    }

    // Try exact type match first, then wildcard. A computed receiver (an arithmetic expression `(a-b).mul(c)`,
    // or an overloaded library call `x.mul(a).add(b)` whose result overload is not yet resolved) has no known
    // type here, but a wildcard `using L for *` binding still applies - fall back to the wildcard set. The
    // funcCall's first arg is the receiver expression, whose type TypeCheck validates against the library param.
    const candidates = objectType
      ? [...(this.usingForBindings.get(objectType.toString()) ?? []), ...(this.usingForBindings.get('*') ?? [])]
      : [...(this.usingForBindings.get('*') ?? [])];

    const match = candidates.find((c) => c.methodName === node.methodName);
    if (!match) return undefined;

    // Look up the function
    const overloads = this.functionDefinitions.get(match.fullFunctionName);
    if (!overloads || overloads.length === 0) return undefined;

    // Create FunctionCallNode: methodName(obj, ...params) -> FullName(obj, ...params)
    const identifier = new IdentifierNode(match.fullFunctionName);
    identifier.location = node.location;
    const funcCall = new FunctionCallNode(identifier, [node.object, ...node.parameters]);
    funcCall.location = node.location;

    // Resolve the function (single overload case)
    if (overloads.length === 1) {
      funcCall.resolvedFunction = overloads[0];
    }

    // Resolve identifier in symbol table
    this.expectedSymbolType = SymbolType.FUNCTION;
    funcCall.identifier = this.visit(funcCall.identifier) as IdentifierNode;
    this.expectedSymbolType = SymbolType.VARIABLE;

    // Visit the parameters (object was already visited, but params may not be)
    funcCall.parameters = funcCall.parameters.map((p, i) => (i === 0 ? p : this.visit(p) as ExpressionNode));

    return funcCall;
  }

  // Resolve an address-typed low-level-call receiver's type during the symbol-table pass (expression types
  // are not on nodes yet). Recurses through identifiers, msg.sender/tx.origin, array/mapping index
  // (element/value type), tuple index, and struct field access, so `structVar.field`, `arr[i]`,
  // `arr[i].field`, `map[k].to` all resolve (e.g. MultiSigWallet's `transactions[i].to`).
  private resolveLowLevelReceiverType(expr: Node): Type | undefined {
    if (expr instanceof IdentifierNode) {
      for (let i = this.symbolTables.length - 1; i >= 0; i -= 1) {
        const t = this.symbolTables[i]?.get(expr.name)?.type;
        if (t) return t;
      }
      return this.stateVariableMap.get(expr.name)?.type;
    }
    if (expr instanceof NullaryOpNode
      && (expr.operator === NullaryOperator.MSG_SENDER || expr.operator === NullaryOperator.TX_ORIGIN)) {
      return new AddressType();
    }
    if (expr instanceof MappingAccessNode) {
      let base: Type | undefined;
      for (let i = this.symbolTables.length - 1; i >= 0 && !base; i -= 1) base = this.symbolTables[i]?.get(expr.name)?.type;
      base = base ?? this.stateVariableMap.get(expr.name)?.type;
      return base instanceof ArrayType ? base.elementType : base instanceof MappingType ? base.valueType : undefined;
    }
    if (expr instanceof ArrayAccessNode) {
      const base = this.resolveLowLevelReceiverType(expr.array);
      return base instanceof ArrayType ? base.elementType : base instanceof MappingType ? base.valueType : undefined;
    }
    if (expr instanceof TupleIndexOpNode) {
      const base = this.resolveLowLevelReceiverType(expr.tuple);
      return base instanceof ArrayType ? base.elementType : undefined;
    }
    if (expr instanceof FieldAccessNode) {
      const base = this.resolveLowLevelReceiverType(expr.expression);
      return base instanceof StructType ? base.fields.find((f) => f.name === expr.name)?.type : undefined;
    }
    return (expr as ExpressionNode).type;
  }

  visitMethodCall(node: MethodCallNode): Node {
    // Detect low-level call: IFoo(cat).bar.call(args) or .staticcall(args)
    // Pattern: MethodCallNode(object=FieldAccessNode(expr=FunctionCallNode), methodName="call"|"staticcall")
    if (
      node.object instanceof FieldAccessNode
      && node.object.expression instanceof FunctionCallNode
      && (node.methodName === 'call' || node.methodName === 'staticcall' || node.methodName === 'delegatecall')
    ) {
      const fieldAccess = node.object;
      const funcCallNode = fieldAccess.expression as FunctionCallNode;
      const functionName = fieldAccess.name;
      const iface = this.interfaceMap.get(funcCallNode.identifier.name);
      if (iface) {
        const paramCount = funcCallNode.parameters.length;
        if (paramCount !== 1) {
          throw new ExternalReadArgCountError(node, iface.name, paramCount);
        }

        const firstArg = funcCallNode.parameters[0];

        if (isEmptyBytesLiteral(firstArg)) {
          throw new ExternalAccessOnUnconnectedError(node, iface.name, functionName);
        }

        const addressExpr = this.visit(firstArg) as ExpressionNode;

        // Validate: interface has function with the field access name
        const allFunctions = this.getAllInterfaceFunctions(iface);
        const ifaceFunc = allFunctions.find((f) => f.name === functionName);
        if (!ifaceFunc) {
          throw new UndefinedInterfaceFunctionError(node, iface.name, functionName);
        }

        if (node.fieldNames) {
          node.parameters = this.reorderNamedArgsByParams(
            node.fieldNames, ifaceFunc.parameters, node.parameters, node, `'${iface.name}.${ifaceFunc.name}'`,
          );
          node.fieldNames = undefined;
        }

        // Visit call parameters
        const parameters = this.visitList(node.parameters) as ExpressionNode[];

        const callMode = node.methodName === 'call'
          ? ExternalCallMode.CALL
          : node.methodName === 'delegatecall'
            ? ExternalCallMode.DELEGATECALL
            : ExternalCallMode.STATICCALL;

        // Create ExternalFunctionCallNode with callMode
        const callNode = new ExternalFunctionCallNode(
          iface.name, addressExpr, functionName, parameters,
        );
        callNode.callMode = callMode;
        callNode.callOptions = node.callOptions;
        callNode.valueTransferIndex = node.valueTransferIndex;
        if (callNode.callOptions?.value) {
          callNode.callOptions.value = this.visit(callNode.callOptions.value) as ExpressionNode;
        }
        if (callNode.callOptions?.gas) callNode.callOptions.gas = this.visit(callNode.callOptions.gas) as ExpressionNode;
        callNode.callInfo = {
          interfaceName: iface.name,
          functionName,
          externalCallSlotIndex: -1,
          callMode,
        };

        // If the interface function has return types, this is a value-producing expression
        if (ifaceFunc.returnTypes.length > 0) {
          if (ifaceFunc.returnTypes.length === 1) {
            callNode.type = ifaceFunc.returnTypes[0];
          } else {
            callNode.type = new TupleType(ifaceFunc.returnTypes);
          }
          callNode.callInfo.hasReturnValues = true;
          callNode.callInfo.returnTypes = ifaceFunc.returnTypes;
          callNode.callInfo.returnEventSignature = `_Return_${ifaceFunc.name}(${ifaceFunc.returnTypes.map((t) => t.toString()).join(',')})`;
        }

        callNode.location = node.location;
        return callNode;
      }
    }

    // Low-level call on interface/contract instance: IFoo(cat).call(data) or Counter().call(data)
    if (
      (node.methodName === 'call' || node.methodName === 'staticcall' || node.methodName === 'delegatecall')
      && node.object instanceof FunctionCallNode
      && (this.interfaceMap.has(node.object.identifier.name) || this.contractMap.has(node.object.identifier.name))
    ) {
      const data = node.parameters.length === 1
        ? this.visit(node.parameters[0]) as ExpressionNode : node.parameters[0];
      const callNode = new LowLevelCallNode(node.object, data, node.methodName);
      callNode.callOptions = node.callOptions;
      callNode.valueTransferIndex = node.valueTransferIndex;
      if (callNode.callOptions?.value) callNode.callOptions.value = this.visit(callNode.callOptions.value) as ExpressionNode;
      if (callNode.callOptions?.gas) callNode.callOptions.gas = this.visit(callNode.callOptions.gas) as ExpressionNode;
      callNode.location = node.location;
      return callNode;
    }

    // Check if the object is an interface instantiation BEFORE visiting it,
    // because visiting a FunctionCallNode with an interface name would fail
    // (interfaces are not in the symbol table as regular functions).
    if (node.object instanceof FunctionCallNode) {
      const iface = this.interfaceMap.get(node.object.identifier.name);
      if (iface) {
        const paramCount = node.object.parameters.length;
        if (paramCount !== 1) {
          throw new ExternalReadArgCountError(node, iface.name, paramCount);
        }

        const firstArg = node.object.parameters[0];

        // Unconnected mode: Name(0x) - cannot call methods
        if (isEmptyBytesLiteral(firstArg)) {
          throw new ExternalAccessOnUnconnectedError(node, iface.name, node.methodName);
        }

        // Visit the address expression for symbol resolution
        const addressExpr = this.visit(firstArg) as ExpressionNode;

        // Validate: interface has function with this name
        const allFunctions = this.getAllInterfaceFunctions(iface);
        const ifaceFunc = allFunctions.find((f) => f.name === node.methodName);
        if (!ifaceFunc) {
          throw new UndefinedInterfaceFunctionError(node, iface.name, node.methodName);
        }

        if (node.fieldNames) {
          node.parameters = this.reorderNamedArgsByParams(
            node.fieldNames, ifaceFunc.parameters, node.parameters, node, `'${iface.name}.${ifaceFunc.name}'`,
          );
          node.fieldNames = undefined;
        }

        // Visit method parameters
        const parameters = this.visitList(node.parameters) as ExpressionNode[];

        // Create ExternalFunctionCallNode
        const callNode = new ExternalFunctionCallNode(
          iface.name, addressExpr, node.methodName, parameters,
        );
        callNode.callOptions = node.callOptions;
        callNode.valueTransferIndex = node.valueTransferIndex;
        // Same-address varying-method pointer (`f = cond ? IC(a).x : IC(a).y; v = f(args)`): carry the runtime
        // selector so the covenant binds the co-spent method to `cond` (else it falls back to this method's
        // compile-time selector and only the TRUE branch's co-spend verifies). Value-producing external calls
        // reach this path, not the 7037 statement path.
        if (node.runtimeSelector) callNode.runtimeSelector = this.visit(node.runtimeSelector) as ExpressionNode;
        if (node.selectorArrayVar) callNode.selectorArrayVar = node.selectorArrayVar;
        if (callNode.callOptions?.value) {
          callNode.callOptions.value = this.visit(callNode.callOptions.value) as ExpressionNode;
        }
        if (callNode.callOptions?.gas) callNode.callOptions.gas = this.visit(callNode.callOptions.gas) as ExpressionNode;
        callNode.callInfo = {
          interfaceName: iface.name,
          functionName: node.methodName,
          externalCallSlotIndex: -1, // assigned later by pre-scan
        };

        // If the interface function has return types, this is a value-producing expression
        if (ifaceFunc.returnTypes.length > 0) {
          if (ifaceFunc.returnTypes.length === 1) {
            callNode.type = ifaceFunc.returnTypes[0];
          } else {
            callNode.type = new TupleType(ifaceFunc.returnTypes);
          }
          callNode.callInfo.hasReturnValues = true;
          callNode.callInfo.returnTypes = ifaceFunc.returnTypes;
          callNode.callInfo.returnEventSignature = `_Return_${ifaceFunc.name}(${ifaceFunc.returnTypes.map((t) => t.toString()).join(',')})`;
        }

        callNode.location = node.location;
        return callNode;
      }
    }

    // Low-level call on address variable: addr.call{value:}(data), addr.staticcall(data), etc. The no-option
    // form parses as a namespaced functionCall (handled in visitFunctionCall); the call-option form reaches
    // here as a MethodCall.
    if (node.methodName === 'call' || node.methodName === 'staticcall' || node.methodName === 'delegatecall') {
      const objName = node.object instanceof IdentifierNode ? node.object.name : undefined;
      node.object = this.visit(node.object);
      // node.object.type isn't assigned yet in this pass: resolve a bare identifier from the local symbol
      // table or the state-var map, and treat msg.sender / tx.origin (NullaryOps typed `address`) as addresses.
      const isAddressNullary = node.object instanceof NullaryOpNode
        && (node.object.operator === NullaryOperator.MSG_SENDER || node.object.operator === NullaryOperator.TX_ORIGIN);
      // node.object.type isn't assigned yet in this pass. Resolve the receiver's type structurally so a
      // complex address target dispatches: a bare identifier, msg.sender/tx.origin, an `arr[i]`/`map[k]`
      // element (MultiCall `targets[i].staticcall(data[i])`), or a struct field - possibly nested, e.g.
      // MultiSigWallet's `transactions[i].to` (the storage-pointer local `t` inlines to `transactions[i]`).
      let objType = node.object.type
        ?? (objName ? this.symbolTables[0].get(objName)?.type ?? this.stateVariableMap.get(objName)?.type : undefined)
        ?? (isAddressNullary ? new AddressType() : undefined)
        ?? this.resolveLowLevelReceiverType(node.object);
      if (objType instanceof AddressType) {
        const data = node.parameters.length === 1
          ? this.visit(node.parameters[0]) as ExpressionNode : node.parameters[0];
        // EVM-parity sound low-level call: `(bool, bytes) = addr.call/staticcall(payload)` co-spends the callee
        // and returns its REAL integrity-bound return (identity + return-event); staticcall is the read-only
        // variant (preserves the callee's commitments). The `{value:}`/`{gas:}` forms keep the existing weak
        // path for now (value-transfer handling), and delegatecall self-verifies via _proxyMasterIndex.
        if ((node.methodName === 'call' || node.methodName === 'staticcall') && !node.callOptions) {
          const mode = node.methodName === 'staticcall' ? ExternalCallMode.STATICCALL : ExternalCallMode.REGULAR;
          const callNode = new ExternalFunctionCallNode('__raw__', node.object as ExpressionNode, '__raw__', [data]);
          callNode.opaqueReturn = true;
          callNode.type = new TupleType([PrimitiveType.BOOL, new BytesType()]);
          callNode.callInfo = {
            interfaceName: '__raw__',
            functionName: '__raw__',
            externalCallSlotIndex: -1,
            hasReturnValues: true,
            returnTypes: [new BytesType()],
            returnEventSignature: '_Return___raw__(bytes)',
            callMode: mode,
          };
          callNode.location = node.location;
          return callNode;
        }
        const callNode = new LowLevelCallNode(node.object, data, node.methodName);
        callNode.callOptions = node.callOptions;
        callNode.valueTransferIndex = node.valueTransferIndex;
        if (callNode.callOptions?.value) {
          callNode.callOptions.value = this.visit(callNode.callOptions.value) as ExpressionNode;
        }
        if (callNode.callOptions?.gas) callNode.callOptions.gas = this.visit(callNode.callOptions.gas) as ExpressionNode;
        callNode.location = node.location;
        return callNode;
      }
    }

    // `var.method{value:}(..)`: `var` is an interface/contract-typed identifier (a function/constructor param,
    // or a synthesized __extaddr_ local for a state-var target). The no-option form is a namespaced
    // FunctionCall (handled in visitFunctionCall); the call-option form arrives here. Route to external call.
    if (node.object instanceof IdentifierNode) {
      const varName = node.object.name;
      const varIdentifier = new IdentifierNode(varName);
      varIdentifier.location = node.object.location;
      const visitedVar = this.visit(varIdentifier) as ExpressionNode;
      const varType = visitedVar.type
        ?? (visitedVar instanceof IdentifierNode ? visitedVar.definition?.type : undefined)
        ?? this.stateVariableMap.get(varName)?.type;
      const calleeName = varType instanceof AddressType ? varType.interfaceName : undefined;
      const calleeFns = calleeName ? this.getCalleeFunctions(calleeName) : undefined;
      const ifaceFunc = calleeFns?.find((f) => f.name === node.methodName);
      if (calleeName && ifaceFunc) {
        if (this.deployResultLocals.has(varName)) {
          // The `{value:}` call-option form is not folded in v1 (always a separate tx). Resolve the real
          // body from the referenced contract for an accurate foldability hint.
          const realFoo = this.deployResultLocals.get(varName)!.referencedContract?.functions
            .find((f) => f.name === node.methodName);
          throw new DeployThenCallError(node, varName, node.methodName, calleeName,
            realFoo ? this.isDeployFoldable(realFoo) : false);
        }
        if (node.fieldNames) {
          node.parameters = this.reorderNamedArgsByParams(
            node.fieldNames, ifaceFunc.parameters, node.parameters, node, `'${calleeName}.${ifaceFunc.name}'`,
          );
          node.fieldNames = undefined;
        }
        const parameters = this.visitList(node.parameters) as ExpressionNode[];
        const callNode = new ExternalFunctionCallNode(calleeName, visitedVar, node.methodName, parameters);
        callNode.callOptions = node.callOptions;
        callNode.valueTransferIndex = node.valueTransferIndex;
        // Same-address varying-method pointer: carry + resolve the runtime selector (`cond ? a.selector :
        // b.selector`, folds to a runtime bytes4). The covenant binds the co-spent method to it (see codegen).
        if (node.runtimeSelector) callNode.runtimeSelector = this.visit(node.runtimeSelector) as ExpressionNode;
        if (node.selectorArrayVar) callNode.selectorArrayVar = node.selectorArrayVar;
        if (callNode.callOptions?.value) {
          callNode.callOptions.value = this.visit(callNode.callOptions.value) as ExpressionNode;
        }
        if (callNode.callOptions?.gas) callNode.callOptions.gas = this.visit(callNode.callOptions.gas) as ExpressionNode;
        callNode.callInfo = {
          interfaceName: calleeName,
          functionName: node.methodName,
          externalCallSlotIndex: -1,
        };
        if (ifaceFunc.returnTypes.length > 0) {
          callNode.type = ifaceFunc.returnTypes.length === 1
            ? ifaceFunc.returnTypes[0] : new TupleType(ifaceFunc.returnTypes);
          callNode.callInfo.hasReturnValues = true;
          callNode.callInfo.returnTypes = ifaceFunc.returnTypes;
          callNode.callInfo.returnEventSignature = `_Return_${ifaceFunc.name}(${ifaceFunc.returnTypes.map((t) => t.toString()).join(',')})`;
        }
        callNode.location = node.location;
        return callNode;
      }
    }

    // A method call on a contract-typed STATE-ARRAY element `arr[i].m()` reduces to `IElem(arr[i]).m()`: the
    // element's declared contract type supplies the interface, and the co-spent target address is the element
    // expression itself - the exact address `IFoo(arr[i])` already captures (docs/array-external-calls.md, the
    // loopArrayVar machinery). Struct-field / nested-state receivers (`s.field.m()`) need a computed-state read
    // and are a separate follow-up (extcall-target-pinning.md SS7).
    if (node.object instanceof MappingAccessNode || node.object instanceof ArrayAccessNode
      || node.object instanceof TupleIndexOpNode) {
      const recvType = this.resolveLowLevelReceiverType(node.object);
      const calleeName = recvType instanceof AddressType ? recvType.interfaceName : undefined;
      const ifaceFunc = calleeName ? this.getCalleeFunctions(calleeName)?.find((f) => f.name === node.methodName) : undefined;
      if (calleeName && ifaceFunc) {
        if (node.fieldNames) {
          node.parameters = this.reorderNamedArgsByParams(
            node.fieldNames, ifaceFunc.parameters, node.parameters, node, `'${calleeName}.${ifaceFunc.name}'`,
          );
          node.fieldNames = undefined;
        }
        const addressExpr = this.visit(node.object) as ExpressionNode;
        const parameters = this.visitList(node.parameters) as ExpressionNode[];
        const callNode = new ExternalFunctionCallNode(calleeName, addressExpr, node.methodName, parameters);
        callNode.callOptions = node.callOptions;
        callNode.valueTransferIndex = node.valueTransferIndex;
        if (callNode.callOptions?.value) callNode.callOptions.value = this.visit(callNode.callOptions.value) as ExpressionNode;
        if (callNode.callOptions?.gas) callNode.callOptions.gas = this.visit(callNode.callOptions.gas) as ExpressionNode;
        callNode.callInfo = { interfaceName: calleeName, functionName: node.methodName, externalCallSlotIndex: -1 };
        if (ifaceFunc.returnTypes.length > 0) {
          callNode.type = ifaceFunc.returnTypes.length === 1
            ? ifaceFunc.returnTypes[0] : new TupleType(ifaceFunc.returnTypes);
          callNode.callInfo.hasReturnValues = true;
          callNode.callInfo.returnTypes = ifaceFunc.returnTypes;
          callNode.callInfo.returnEventSignature = `_Return_${ifaceFunc.name}(${ifaceFunc.returnTypes.map((t) => t.toString()).join(',')})`;
        }
        callNode.location = node.location;
        return callNode;
      }
    }

    // Not an interface method call - visit the object and try using-for resolution
    if (!node.object.type) node.object = this.visit(node.object);

    // Try using-for bindings before giving up
    if (this.usingForBindings.size > 0) {
      const resolved = this.tryResolveUsingFor(node);
      if (resolved) return resolved;
    }

    throw new MethodCallNotSupportedError(node);
  }

  override visitMethodCallStatement(node: MethodCallStatementNode): Node {
    // Visit the method call - may resolve to FunctionCallNode via using-for
    const result = this.visit(node.call);
    if (result instanceof FunctionCallNode) {
      // Transform MethodCallStatement -> FunctionCallStatement
      const stmt = new FunctionCallStatementNode(result);
      stmt.location = node.location;
      return stmt;
    }
    // Normal path: external call or low-level call
    node.expression = result as ExpressionNode;
    return node;
  }

  visitLowLevelCall(node: LowLevelCallNode): Node {
    const loc = node.location ? ` at line ${node.location.start.line}` : '';
    console.log(`Warning: Low-level .${node.callMode}() used${loc}. Low-level calls bypass type safety and contract verification. Consider using typed interface calls instead.`);
    // Visit targetExpression for symbol resolution unless it's an interface/contract FunctionCallNode
    if (!(node.targetExpression instanceof FunctionCallNode
      && (this.interfaceMap.has(node.targetExpression.identifier.name)
        || this.contractMap.has(node.targetExpression.identifier.name)))) {
      node.targetExpression = this.visit(node.targetExpression) as ExpressionNode;
    }
    node.data = this.visit(node.data) as ExpressionNode;
    if (node.callOptions?.value) node.callOptions.value = this.visit(node.callOptions.value) as ExpressionNode;
    if (node.callOptions?.gas) node.callOptions.gas = this.visit(node.callOptions.gas) as ExpressionNode;
    return node;
  }

  visitLowLevelCallStatement(node: LowLevelCallStatementNode): Node {
    const loc = node.location ? ` at line ${node.location.start.line}` : '';
    if (!node.synthesizedFromLibraryCall) {
      console.log(`Warning: Low-level .${node.callMode}() used${loc}. Low-level calls bypass type safety and contract verification. Consider using typed interface calls instead.`);
    }
    // Visit targetExpression for symbol resolution unless it's an interface/contract FunctionCallNode
    if (!(node.targetExpression instanceof FunctionCallNode
      && (this.interfaceMap.has(node.targetExpression.identifier.name)
        || this.contractMap.has(node.targetExpression.identifier.name)))) {
      node.targetExpression = this.visit(node.targetExpression) as ExpressionNode;
    }
    node.data = this.visit(node.data) as ExpressionNode;
    if (node.callOptions?.value) node.callOptions.value = this.visit(node.callOptions.value) as ExpressionNode;
    if (node.callOptions?.gas) node.callOptions.gas = this.visit(node.callOptions.gas) as ExpressionNode;
    return node;
  }

  private createDefaultExpression(type: Type, contextNode: Node): ExpressionNode {
    return createDefaultValueExpression(type, contextNode.location);
  }

  /**
   * Compute the 1:1 block layout for a stateful function.
   * Slot ordering must match the SDK's StatefulTransactionBuilder.build() output ordering.
   */
  private computeBlockLayout(node: FunctionDefinitionNode): FunctionBlockLayout {
    const slots: BlockLayoutSlot[] = [];
    let offset = 0;

    // Master
    slots.push({ kind: 'master', offset: offset++ });

    // Data NFTs (requiredNftIndices not set yet - use all from state layout)
    const contract = this.currentContract!;
    const stateVars = contract.stateVariables ?? [];
    const maxNftIndex = stateVars.length > 0
      ? Math.max(...stateVars.map((sv) => sv.nftIndex ?? 0)) + 1 : 0;
    const nftIndices = node.requiredNftIndices
      ?? Array.from({ length: maxNftIndex }, (_, i) => i);
    for (const nftIdx of nftIndices) {
      slots.push({ kind: 'dataNft', offset: offset++, nftIndex: nftIdx });
    }

    // External reads
    if (node.externalReads) {
      for (let i = 0; i < node.externalReads.length; i++) {
        slots.push({ kind: 'readOnlyDataNft', offset: offset++, slotIndex: i });
      }
    }

    // blockhash(n): each distinct identifier-arg read rides its OWN consecutive (n->hash) oracle co-spend -
    // a read-only, self-preserving 1:1 input/output slot. The SDK fills __internal__blockhashInputIndex with
    // the FIRST slot's absolute index (master input index + offset); codegen reads input[base + read-ordinal].
    if (node.usesBlockhash) {
      const bhSlots = Math.max(1, node.blockhashSlotCount ?? 0);
      for (let i = 0; i < bhSlots; i++) slots.push({ kind: 'blockhashOracle', offset: offset++ });
    }

    // Reserve offset space for outState groups (between reads and entries)
    if (node.externalOutStateReads) {
      for (const slot of node.externalOutStateReads) {
        if (slot.sharedWithCallSlotIndex !== undefined) continue;
        offset += 1 + slot.requiredDataNftIndices.length;
      }
    }
    // Reserve offset space for external call groups
    if (node.externalCalls) {
      for (const slot of node.externalCalls) {
        offset += 1 + slot.requiredDataNftIndices.length;
      }
    }

    // Entries
    if (node.entryAccesses) {
      for (let i = 0; i < node.entryAccesses.length; i++) {
        slots.push({ kind: 'entry', offset: offset++, slotIndex: i });
      }
    }

    // Satoshi container (if function has transfers)
    if (node.transferInfos && node.transferInfos.length > 0) {
      slots.push({ kind: 'satoshiContainer', offset: offset++ });
    }

    // Token containers (input+output - placed before output-only slots so input
    // indices match output indices without gaps)
    if (node.tokenContainerAccesses) {
      for (let i = 0; i < node.tokenContainerAccesses.length; i++) {
        slots.push({ kind: 'tokenContainer', offset: offset++, slotIndex: i });
      }
    }

    // Transfers (output-only)
    if (node.transferInfos) {
      for (let i = 0; i < node.transferInfos.length; i++) {
        slots.push({ kind: 'transfer', offset: offset++, slotIndex: i });
      }
    }

    // TC transfers (output-only - one slot per transfer/transferNft operation)
    if (node.tokenContainerAccesses) {
      let tcTransferIdx = 0;
      for (const tca of node.tokenContainerAccesses) {
        const opCount = tca.transferCount + tca.transferNftCount;
        for (let j = 0; j < opCount; j++) {
          slots.push({ kind: 'tcTransfer', offset: offset++, slotIndex: tcTransferIdx++ });
        }
      }
    }

    // Events (output-only)
    if (node.emitInfos) {
      for (let i = 0; i < node.emitInfos.length; i++) {
        slots.push({ kind: 'event', offset: offset++, slotIndex: i });
      }
    }

    // Return event (output-only)
    if (node.returnTypes.length > 0) {
      slots.push({ kind: 'returnEvent', offset: offset++ });
    }

    // Low-level call slots (one per non-delegatecall call)
    if (node.lowLevelCalls) {
      for (let i = 0; i < node.lowLevelCalls.length; i++) {
        if (node.lowLevelCalls[i].callMode === 'delegatecall') continue;
        slots.push({ kind: 'lowLevelCall', offset: offset++, slotIndex: i });
      }
    }

    // Deploy slots (deploy modifier functions have a genesis input per child deploy site)
    // Note: deployTargets isn't populated yet at this stage - check modifier instead
    if (node.modifiers.includes(FunctionModifier.DEPLOY)) {
      const deploySites = this.countDeploySites(node.body);
      for (let i = 0; i < Math.max(1, deploySites); i++) {
        slots.push({ kind: 'deploy', offset: offset++, slotIndex: i });
      }
    }

    return { blockSize: offset, slots };
  }

  // Number of `new C(...)` sites in a function body (each needs its own genesis funding input/slot).
  // Does not descend into referencedContract (a backref to the whole child AST).
  private countDeploySites(body: Node | undefined): number {
    if (!body) return 0;
    let count = 0;
    const seen = new WeakSet<object>();
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) { for (const it of n) walk(it); return; }
      if (!(n instanceof Node) || seen.has(n)) return;
      seen.add(n);
      if (n instanceof InstantiationNode && n.referencedContract) count += 1;
      for (const [key, value] of Object.entries(n)) {
        if (key === 'referencedContract' || key === 'definition' || key === 'symbolTable') continue;
        walk(value);
      }
    };
    walk(body);
    return count;
  }
}

function isEmptyBytesLiteral(expr: ExpressionNode): boolean {
  return expr instanceof HexLiteralNode && expr.value.byteLength === 0;
}

function isCompileTimeExpression(
  expr: ExpressionNode,
  constantMap: Map<string, ConstantDefinitionNode>,
  enumMap: Map<string, EnumType>,
): boolean {
  if (expr instanceof LiteralNode) return true;
  if (expr instanceof BinaryOpNode) {
    return isCompileTimeExpression(expr.left, constantMap, enumMap)
      && isCompileTimeExpression(expr.right, constantMap, enumMap);
  }
  if (expr instanceof UnaryOpNode) {
    return isCompileTimeExpression(expr.expression, constantMap, enumMap);
  }
  if (expr instanceof CastNode) {
    return isCompileTimeExpression(expr.expression, constantMap, enumMap);
  }
  if (expr instanceof ArrayNode) {
    return expr.elements.every((e) => isCompileTimeExpression(e, constantMap, enumMap));
  }
  if (expr instanceof BytesConcatNode || expr instanceof StringConcatNode) {
    // `bytes.concat`/`string.concat` is a pure concatenation of its args, so it is compile-time when they all are.
    return expr.parameters.every((e) => isCompileTimeExpression(e, constantMap, enumMap));
  }
  if (expr instanceof IdentifierNode) {
    // Allow references to other already-registered constants
    return constantMap.has(expr.name);
  }
  if (expr instanceof FieldAccessNode && expr.expression instanceof IdentifierNode) {
    // Allow namespaced constant references (e.g. SafeMath.MAX_SAFE) and enum members (E.B): an enum member is a
    // compile-time integer ordinal.
    const compoundName = `${expr.expression.name}.${expr.name}`;
    if (constantMap.has(compoundName)) return true;
    const en = enumMap.get(expr.expression.name);
    return !!en && en.members.some((mm) => mm.name === expr.name);
  }
  // Metatype introspection `type(X).creationCode/runtimeCode/name/interfaceId/min/max` is a compile-time constant.
  if (expr instanceof TypeIntrospectionNode) return true;
  // abi.encode* / abi.decode* are pure functions of their args - compile-time when every value arg is. Codegen
  // inlines the constant's initializer at each use site (visitIdentifier), so the existing abi codegen runs there.
  if (expr instanceof AbiEncodeNode || expr instanceof AbiEncodePackedNode || expr instanceof AbiEncodeCallNode) {
    return expr.parameters.every((e) => isCompileTimeExpression(e, constantMap, enumMap));
  }
  if (expr instanceof AbiEncodeWithSelectorNode) {
    return isCompileTimeExpression(expr.selector, constantMap, enumMap)
      && expr.parameters.every((e) => isCompileTimeExpression(e, constantMap, enumMap));
  }
  if (expr instanceof AbiEncodeWithSignatureNode) {
    return isCompileTimeExpression(expr.signature, constantMap, enumMap)
      && expr.parameters.every((e) => isCompileTimeExpression(e, constantMap, enumMap));
  }
  if (expr instanceof AbiDecodeNode || expr instanceof AbiDecodeAtNode) {
    return isCompileTimeExpression(expr.data, constantMap, enumMap);
  }
  return false;
}

// True if `type` is, or transitively contains, a function-pointer type (mapping value, array element,
// or struct field).
function typeReferencesFunctionPointer(type: Type): boolean {
  if (type instanceof FunctionType) return true;
  if (type instanceof MappingType) return typeReferencesFunctionPointer(type.valueType);
  if (type instanceof ArrayType) return typeReferencesFunctionPointer(type.elementType);
  if (type instanceof StructType) return type.fields.some((f) => typeReferencesFunctionPointer(f.type));
  return false;
}
