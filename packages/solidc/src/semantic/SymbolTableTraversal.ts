import { GLOBAL_SYMBOL_TABLE, Modifier } from '../ast/Globals.js';
import {
  ContractNode,
  ParameterNode,
  VariableDefinitionNode,
  FunctionDefinitionNode,
  IdentifierNode,
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
  computeEventSignature, computeErrorSignature, computeCollectionSignature,
  computeFunctionSignature, computeFunctionSelector, TupleType, ArrayType,
  IntType, FixedType, MappingType, FunctionType,
  FunctionBlockLayout, BlockLayoutSlot, resolveLibraries, ExternalLibrary, parseTypeStrict,
  INLINE_MAX_BLOB_LENGTH, isDynamicStorageType,
} from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth';

function getMaxPushdataEncodedSizeForType(type: Type): number {
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
  if (type instanceof ValueType) return getMaxPushdataEncodedSizeForType(type.underlyingType);
  if (type instanceof StructType) {
    return type.fields.reduce((sum, f) => sum + getMaxPushdataEncodedSizeForType(f.type), 0);
  }
  if (type instanceof ArrayType && type.bound !== undefined) {
    return getMaxPushdataEncodedSizeForType(PrimitiveType.BIGINT)
      + type.bound * getMaxPushdataEncodedSizeForType(type.elementType);
  }
  return 9;
}

export default class SymbolTableTraversal extends AstTraversal {
  private symbolTables: SymbolTable[] = [new SymbolTable(GLOBAL_SYMBOL_TABLE)];
  private functionSignatures: Set<string> = new Set();
  private currentFunction: FunctionDefinitionNode;
  private currentContract: ContractNode;
  private expectedSymbolType: SymbolType = SymbolType.VARIABLE;
  private insideConsoleStatement: boolean = false;

  // Depth of conditionally-evaluated expression branches (ternary arms, short-circuit && / ||
  // right operand). References inside them must not become the OP_ROLL "last use": the branch may
  // be skipped at runtime, so the variable must stay on the stack (PICK) and be cleaned by cleanStack.
  private conditionalBranchDepth: number = 0;

  private conditionalRefNames: Set<string> = new Set();
  private insideConstructor: boolean = false;
  private stateVariableMap: Map<string, StateVariableNode> = new Map();
  private collectionMap: Map<string, CollectionNode> = new Map();
  private structMap: Map<string, StructType> = new Map();
  private typeDefMap: Map<string, ValueType> = new Map();
  private enumMap: Map<string, EnumType> = new Map();
  private eventMap: Map<string, EventDefinitionNode> = new Map();
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

    // Register file-level constants before visiting contract
    for (const cd of node.constantDefinitions) {
      this.visitConstantDefinition(cd);
    }

    // Register built-in NftCapability enum (none=0, mutable=1, minting=2)
    const nftCapType = new EnumType('NftCapability', [
      { name: 'none', value: 0n },
      { name: 'mutable', value: 1n },
      { name: 'minting', value: 2n },
    ]);
    this.enumMap.set('NftCapability', nftCapType);
    this.symbolTables[0].set(Symbol.enumType('NftCapability', nftCapType));

    // Register file-level enums
    for (const ed of node.enumDefinitions) {
      this.registerEnum(ed);
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
      const sig = computeEventSignature(ev.name, ev.parameters.map((p) => p.type.toString()));
      ev.signature = sig;
      if (!this.eventMap.has(sig)) {
        this.eventMap.set(sig, ev);
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
        const sig = computeEventSignature(ev.name, ev.parameters.map((p) => p.type.toString()));
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

    // Synthesize InterfaceNode from each imported contract (for external call/read support)
    for (const imported of node.importedContracts) {
      if (!this.interfaceMap.has(imported.name)) {
        const synthesized = this.synthesizeInterfaceFromContract(imported);
        this.interfaceMap.set(imported.name, synthesized);
        node.interfaceDefinitions.push(synthesized);
      }
    }

    // Validate interface parent references (after all interfaces are registered)
    for (const iface of node.interfaceDefinitions) {
      for (const parentName of iface.parents) {
        if (!this.interfaceMap.has(parentName)) {
          throw new UndefinedInterfaceError(iface, parentName);
        }
      }
      // Check for circular inheritance
      this.checkCircularInheritance(iface, new Set());
    }

    // Pre-register free functions in global scope (so they can call each other and be called from contract)
    for (const func of node.freeFunctions) {
      const paramTypes = func.parameters.map((p) => p.type);
      const sig = computeFunctionSignature(func.name, paramTypes.map((t) => t.toString()));
      if (this.functionSignatures.has(sig)) {
        throw new FunctionRedefinitionError(func, paramTypes.map((t) => t.toString()).join(', '));
      }
      this.functionSignatures.add(sig);

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
      || node.eventDefinitions.length > 0;

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

    // Register event definitions (keyed by full signature to allow overloading)
    for (const ev of node.eventDefinitions) {
      const sig = computeEventSignature(ev.name, ev.parameters.map((p) => p.type.toString()));
      ev.signature = sig;
      if (this.eventMap.has(sig)) {
        throw new EventRedefinitionError(ev);
      }
      this.eventMap.set(sig, ev);
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

      // Function pointers are internal-only: an entry point can't receive one (no ABI encoding).
      if (func.isEntryPoint) {
        for (const p of func.parameters) {
          if (p.type instanceof FunctionType) {
            throw new FunctionTypeNotEncodableError(p, 'parameters of an external/public function');
          }
        }
        if (func.returnTypes.some((t) => t instanceof FunctionType)) {
          throw new FunctionTypeNotEncodableError(func, 'return values of an external/public function');
        }
      }

      const paramTypes = func.parameters.map((p) => p.type);
      const sig = computeFunctionSignature(func.name, paramTypes.map((t) => t.toString()));
      if (this.functionSignatures.has(sig)) {
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
      }
      const existing = this.functionDefinitions.get(func.name) ?? [];
      existing.push(func);
      this.functionDefinitions.set(func.name, existing);
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
    // A param may shadow a state variable (Solidity semantics: the param wins in the function scope; the state
    // var stays reachable via `this.name`) - e.g. `constructor(string name, ..) Base(name, ..)` over an
    // inherited `string name`. A collision with another param/local is a genuine redefinition. Native solidcash
    // keeps the strict check.
    const shadowsStateVar = this.compilerOptions.solidityImportCompat
      && existing?.symbolType === SymbolType.STATE_VARIABLE;
    if (existing && !shadowsStateVar) {
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
    if (!isCompileTimeExpression(node.expression, this.constantMap)) {
      throw new NonCompileTimeExpressionError(node);
    }

    // Resolve identifiers within the constant expression (e.g., references to other constants)
    this.resolveConstantExpressionIdentifiers(node.expression);

    const symbol = Symbol.constant(node);
    // Mark as referenced so constants are exempt from unused-variable checking
    symbol.references.push({ name: node.name } as IdentifierNode);
    this.symbolTables[0].set(symbol);
    this.constantMap.set(node.name, node);

    return node;
  }

  private resolveConstantExpressionIdentifiers(expr: ExpressionNode): void {
    if (expr instanceof IdentifierNode) {
      const definition = this.symbolTables[0].get(expr.name);
      if (definition) {
        expr.definition = definition;
        definition.references.push(expr);
      }
    } else if (expr instanceof BinaryOpNode) {
      this.resolveConstantExpressionIdentifiers(expr.left);
      this.resolveConstantExpressionIdentifiers(expr.right);
    } else if (expr instanceof UnaryOpNode) {
      this.resolveConstantExpressionIdentifiers(expr.expression);
    } else if (expr instanceof CastNode) {
      this.resolveConstantExpressionIdentifiers(expr.expression);
    } else if (expr instanceof ArrayNode) {
      expr.elements.forEach((e) => this.resolveConstantExpressionIdentifiers(e));
    }
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    this.currentFunction = node;
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
      const entryAccessMap = new Map<string, EntryAccessInfo>();
      this.collectEntryAccesses(node.body, entryAccessMap);

      if (entryAccessMap.size > 0) {
        // Assign sequential slot indices
        let slotIndex = 0;
        for (const info of entryAccessMap.values()) {
          info.slotIndex = slotIndex++;
        }

        node.entryAccesses = [...entryAccessMap.values()];

        // Propagate slot indices to individual mapping nodes
        this.assignEntrySlotIndices(node.body, entryAccessMap);

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

        // Inject per-slot selector parameters (only for slots that need selector verification)
        const slotsNeedingSelector = externalCallSlots.filter((s) => s.needsSelectorVerification);
        const slotCount = node.externalCalls.length;
        for (let i = 0; i < slotCount; i++) {
          if (!externalCallSlots[i].needsSelectorVerification) continue;
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
      || contract.eventDefinitions.length > 0;
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
      if (existing) {
        if (!existing.operations.includes('write')) existing.operations.push('write');
      } else {
        const collSig = computeCollectionSignature(node.collection.name, node.collection.type.toString());
        map.set(slotKey, {
          collection: node.collection.name, collectionSignature: collSig,
          keyParams, keySources, operations: ['write'], slotIndex: -1,
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
    if (node instanceof ExternalFunctionCallNode && node.callInfo) {
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
      // Determine if selector verification is needed: only when the callee interface
      // has >1 callable function AND mode is REGULAR (call/staticcall skip selectors)
      const callMode = node.callInfo.callMode;
      let needsSelectorVerification = false;
      if (!callMode || callMode === ExternalCallMode.REGULAR) {
        const calleeFns = this.getCalleeFunctions(node.callInfo.interfaceName);
        if (calleeFns) needsSelectorVerification = calleeFns.length > 1;
      }

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
        slotIndex: -1,
        requiredDataNftIndices: dataNftIndices,
        computedOffset: 0,
        needsSelectorVerification,
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
    // Fallback for any other expression type
    return `expr:${node.constructor.name}`;
  }

  private classifyKeySource(key: ExpressionNode): KeySourceInfo {
    if (key instanceof IdentifierNode) {
      if (this.currentFunction.parameters.some((p) => p.name === key.name)) {
        return { kind: 'param', paramName: key.name, canonical: `id:${key.name}` };
      }
      return { kind: 'expression', canonical: `id:${key.name}` };
    }
    if (key instanceof StateAccessNode) {
      return { kind: 'state', stateVarName: key.name, canonical: `state:${key.name}` };
    }
    return { kind: 'expression', canonical: this.canonicalizeExpression(key) };
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
      if (!(node.isLoopVariable && existingDef?.isLoopVariable)) {
        throw new VariableRedefinitionError(node);
      }
    }

    if (node.expression) node.expression = this.visit(node.expression);

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
  private checkReadOnlyModification(sym: Symbol): void {
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
        throw new CalldataModificationError(v as VariableDefinitionNode | ParameterNode);
      }
    });
  }

  visitAssign(node: AssignNode): Node {
    const sym = this.symbolTables[0].get(node.identifier.name);

    // Bare write to a state variable `x = ...` (no shadowing local): route to a state assignment.
    if (sym?.symbolType === SymbolType.STATE_VARIABLE) {
      const stateNode = new StateAssignNode(node.identifier.name, node.expression);
      stateNode.location = node.location;
      return this.visit(stateNode);
    }

    if (sym) {
      this.checkReadOnlyModification(sym);
    }

    super.visitAssign(node);
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

  visitTupleAssignment(node: TupleAssignmentNode): Node {
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
          const objectType = visitedVar.type
            ?? (visitedVar instanceof IdentifierNode ? visitedVar.definition?.type : undefined);

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
        if (overloads[0].visibility === 'external' && !overloads[0].isFreeFunction) {
          throw new InternalCallToExternalError(node);
        }
      }
      // Multiple overloads: defer resolution to TypeCheckTraversal
    }

    // Indirect call through a function-typed variable: resolve the callee as a variable, not a function.
    const calleeSym = this.symbolTables[0].get(node.identifier.name);
    const isIndirect = !this.functionDefinitions.has(node.identifier.name) && calleeSym?.type instanceof FunctionType;

    this.expectedSymbolType = isIndirect ? SymbolType.VARIABLE : SymbolType.FUNCTION;
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    this.expectedSymbolType = SymbolType.VARIABLE;
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
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
        node.call = resolved as FunctionCallNode;
        return node;
      }
    }

    // Function call statements are only valid for user-defined functions
    const overloads = this.functionDefinitions.get(callName);
    if (!overloads || overloads.length === 0) {
      throw new UndefinedReferenceError(node.call.identifier);
    }
    const anyCallable = overloads.some((f) => f.visibility !== 'external' || f.isFreeFunction);
    if (!anyCallable) {
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
      const isInDeployFunction = this.currentFunction?.modifiers?.includes(FunctionModifier.DEPLOY) ?? false;

      if (isStatefulTarget && !isInDeployFunction) {
        throw new StatefulContractDeploymentError(node, contract.name);
      }

      if (node.callOptions?.value && !this.isStatefulContract) {
        throw new DeployValueInNonStatefulError(node, contract.name);
      }

      if (node.parameters.length !== contract.parameters.length) {
        throw new ContractConstructorArgCountError(node, contract.name, contract.parameters.length, node.parameters.length);
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

      if (node.callOptions?.value) {
        node.callOptions.value = this.visit(node.callOptions.value) as ExpressionNode;
      }
      // Salt: visit for type-checking but emit warning and clear - salt is a no-op for deployments
      if (node.callOptions?.salt) {
        node.callOptions.salt = this.visit(node.callOptions.salt) as ExpressionNode;
        const line = node.location ? ` at line ${node.location.start.line}` : '';
        console.log(`Warning: 'salt' is ignored for contract deployment${line} - each deployment gets a unique category from the genesis input.`);
        node.callOptions.salt = undefined;
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
      node.type = (packedSv.type as ArrayType).elementType;
      node.keys = this.visitList(node.keys);
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

    node.args = this.visitList(node.args);
    return node;
  }

  visitBranch(node: BranchNode): Node {
    const prev = this.insideBranch;
    this.insideBranch = true;
    const result = super.visitBranch(node);
    this.insideBranch = prev;

    // Post-visit: count restricted operations in each branch and validate balance
    const ifCounts = this.countBranchOps(node.ifBlock);
    const elseCounts = node.elseBlock
      ? this.countBranchOps(node.elseBlock)
      : {
        transfers: 0, emits: 0, tokenContainerTransfers: 0,
        stateWriteKeys: new Set<string>(),
        mappingWriteSlots: new Set<number>(),
        mappingDeleteSlots: new Set<number>(),
      };

    const hasOps = ifCounts.transfers > 0 || ifCounts.emits > 0 || ifCounts.tokenContainerTransfers > 0
      || ifCounts.stateWriteKeys.size > 0 || ifCounts.mappingWriteSlots.size > 0
      || ifCounts.mappingDeleteSlots.size > 0
      || elseCounts.transfers > 0 || elseCounts.emits > 0 || elseCounts.tokenContainerTransfers > 0
      || elseCounts.stateWriteKeys.size > 0 || elseCounts.mappingWriteSlots.size > 0
      || elseCounts.mappingDeleteSlots.size > 0;

    if (hasOps) {
      // Union state write keys and mapping slots across branches
      const stateWriteKeys = new Set<string>([...ifCounts.stateWriteKeys, ...elseCounts.stateWriteKeys]);
      const mappingWriteSlots = new Set<number>([...ifCounts.mappingWriteSlots, ...elseCounts.mappingWriteSlots]);
      const mappingDeleteSlots = new Set<number>([...ifCounts.mappingDeleteSlots, ...elseCounts.mappingDeleteSlots]);

      node.branchOps = {
        stateWriteKeys,
        mappingWriteSlots,
        mappingDeleteSlots,
        transferCount: Math.max(ifCounts.transfers, elseCounts.transfers),
        minTransferCount: Math.min(ifCounts.transfers, elseCounts.transfers),
        ifTransferCount: ifCounts.transfers,
        emitCount: Math.max(ifCounts.emits, elseCounts.emits),
        minEmitCount: Math.min(ifCounts.emits, elseCounts.emits),
        ifEmitCount: ifCounts.emits,
        tokenContainerTransferCount: Math.max(ifCounts.tokenContainerTransfers, elseCounts.tokenContainerTransfers),
        minTokenContainerTransferCount: Math.min(ifCounts.tokenContainerTransfers, elseCounts.tokenContainerTransfers),
        ifTokenContainerTransferCount: ifCounts.tokenContainerTransfers,
      };
    }

    return result;
  }

  visitSwitch(node: SwitchNode): Node {
    const prev = this.insideBranch;
    this.insideBranch = true;
    const result = super.visitSwitch(node);
    this.insideBranch = prev;

    // Collect ops from all cases and default
    const allCounts = node.cases.map((c) => this.countBranchOps(c.body));
    if (node.defaultCase) {
      allCounts.push(this.countBranchOps(node.defaultCase));
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
    // If catch has parameters, register them in the block's symbol table
    // and mark as referenced (avoids unused-variable error on dead code)
    if (node.parameters && node.parameters.length > 0) {
      // Visit block first to create its symbol table
      node.block = this.visit(node.block) as BlockNode;

      // Register parameters in the block's symbol table and mark as referenced
      for (const param of node.parameters) {
        if (node.block.symbolTable) {
          const sym = Symbol.variable(param);
          sym.references.push({ name: param.name } as IdentifierNode);
          node.block.symbolTable.set(sym);
        }
      }
      return node;
    }

    node.block = this.visit(node.block) as BlockNode;
    return node;
  }

  /**
   * Count restricted operations within a block (for branch balance validation).
   */
  private countBranchOps(block: BlockNode): {
    transfers: number;
    emits: number;
    tokenContainerTransfers: number;
    stateWriteKeys: Set<string>;
    mappingWriteSlots: Set<number>;
    mappingDeleteSlots: Set<number>;
  } {
    const result = {
      transfers: 0,
      emits: 0,
      tokenContainerTransfers: 0,
      stateWriteKeys: new Set<string>(),
      mappingWriteSlots: new Set<number>(),
      mappingDeleteSlots: new Set<number>(),
    };
    this.countBranchOpsRecursive(block, result);
    return result;
  }

  private countBranchOpsRecursive(node: Node, result: {
    transfers: number;
    emits: number;
    tokenContainerTransfers: number;
    stateWriteKeys: Set<string>;
    mappingWriteSlots: Set<number>;
    mappingDeleteSlots: Set<number>;
  }): void {
    if (node instanceof TransferStatementNode || node instanceof AddressTransferStatementNode
      || node instanceof AddressSendExpressionNode) {
      result.transfers++;
      return;
    }
    // {value: X} call option creates an implicit transfer
    if (node instanceof LowLevelCallStatementNode && node.callOptions?.value) {
      result.transfers++;
      // Don't return - we still need to recurse into child nodes
    }
    if (node instanceof MethodCallStatementNode && node.call.callOptions?.value) {
      result.transfers++;
    }
    if (node instanceof EmitStatementNode) {
      result.emits++;
      return;
    }
    if (node instanceof TokenContainerMethodStatementNode) {
      result.tokenContainerTransfers++;
      return;
    }
    if (node instanceof StateAssignNode && node.stateVariable) {
      result.stateWriteKeys.add(`${node.stateVariable.nftIndex}:${node.stateVariable.fieldIndex}`);
      return;
    }
    if (node instanceof DeleteStateNode && node.stateVariable) {
      result.stateWriteKeys.add(`${node.stateVariable.nftIndex}:${node.stateVariable.fieldIndex}`);
      return;
    }
    if (node instanceof MappingAssignNode) {
      if (node.entrySlotIndex >= 0) result.mappingWriteSlots.add(node.entrySlotIndex);
      return;
    }
    if (node instanceof MappingDeleteNode) {
      if (node.entrySlotIndex >= 0) result.mappingDeleteSlots.add(node.entrySlotIndex);
      return;
    }
    if ((node instanceof StateArrayPushNode || node instanceof StateArrayPopNode
      || node instanceof StateArrayAssignNode || node instanceof StateArrayDeleteNode)
      && node.stateVariable) {
      result.stateWriteKeys.add(`${node.stateVariable.nftIndex}:${node.stateVariable.fieldIndex}`);
      return;
    }
    // For nested branches, recurse into both arms
    if (node instanceof BranchNode) {
      this.countBranchOpsRecursive(node.ifBlock, result);
      if (node.elseBlock) this.countBranchOpsRecursive(node.elseBlock, result);
      return;
    }
    // For try/catch, only recurse into try block (catch is dead code)
    if (node instanceof TryCatchNode) {
      this.countBranchOpsRecursive(node.tryBlock, result);
      return;
    }
    // For switch, recurse into all cases and default
    if (node instanceof SwitchNode) {
      for (const c of node.cases) {
        this.countBranchOpsRecursive(c.body, result);
      }
      if (node.defaultCase) this.countBranchOpsRecursive(node.defaultCase, result);
      return;
    }
    // Generic recursion
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.countBranchOpsRecursive(stmt, result);
      }
    }
    if ('body' in node && (node as any).body) {
      this.countBranchOpsRecursive((node as any).body, result);
    }
    if ('block' in node && (node as any).block) {
      this.countBranchOpsRecursive((node as any).block, result);
    }
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
      throw new UndefinedStateVariableError(node);
    }
    if (sv.visibility === StateVariableVisibility.PRIVATE && sv.inheritedFrom
      && this.currentFunction.inheritedFrom !== sv.inheritedFrom) {
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
      && this.currentFunction.inheritedFrom !== sv.inheritedFrom) {
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
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    return node;
  }

  visitDeleteState(node: DeleteStateNode): Node {
    const sv = this.stateVariableMap.get(node.name);
    if (!sv) {
      throw new UndefinedStateVariableError(node);
    }
    if (sv.visibility === StateVariableVisibility.PRIVATE && sv.inheritedFrom
      && this.currentFunction.inheritedFrom !== sv.inheritedFrom) {
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
    const definition = this.symbolTables[0].get(node.name);
    if (!definition) {
      throw new UndefinedReferenceError(node);
    }

    // Bare reference to a state variable with no shadowing local: resolve as `this.<name>` (Solidity reads
    // state vars by name; an inner-scope local shadows them via the scope chain checked above).
    if (definition.symbolType === SymbolType.STATE_VARIABLE) {
      const stateNode = new StateAccessNode(node.name);
      stateNode.location = node.location;
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

    // `Interface.method.selector` -> the interface method's 4-byte selector (bytes4), computed from its
    // signature. Mirrors `this.<fn>.selector` for own functions.
    if (node.name === 'selector' && node.expression instanceof FieldAccessNode
      && node.expression.expression instanceof IdentifierNode) {
      const fa = node.expression;
      const iface = this.interfaceMap.get((fa.expression as IdentifierNode).name);
      const method = iface?.functions.find((f) => f.name === fa.name);
      if (method) {
        const sig = computeFunctionSignature(method.name, method.parameters.map((p) => p.type.toString()));
        const lit = new HexLiteralNode(computeFunctionSelector(sig));
        lit.location = node.location;
        return lit;
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
    if (!objectType) return undefined;

    const typeStr = objectType.toString();

    // Try exact type match first, then wildcard
    const candidates = [
      ...(this.usingForBindings.get(typeStr) ?? []),
      ...(this.usingForBindings.get('*') ?? []),
    ];

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
      let objType = node.object.type
        ?? (objName ? this.symbolTables[0].get(objName)?.type ?? this.stateVariableMap.get(objName)?.type : undefined)
        ?? (isAddressNullary ? new AddressType() : undefined);
      // Complex address receiver: an `address[]` element `arr[i]` resolves to the array's element type, so a
      // runtime array-element target dispatches (e.g. MultiCall `targets[i].staticcall(data[i])`). `arr[i]`
      // parses as a TupleIndexOpNode (array-vs-tuple is type-resolved later) or an ArrayAccessNode; the base
      // array's type comes from the scope chain (usually a calldata/memory parameter) or a state var.
      const arrayBase = node.object instanceof TupleIndexOpNode ? node.object.tuple
        : node.object instanceof ArrayAccessNode ? node.object.array : undefined;
      if (!objType && arrayBase instanceof IdentifierNode) {
        let arrType: Type | undefined;
        for (let i = this.symbolTables.length - 1; i >= 0 && !arrType; i -= 1) {
          arrType = this.symbolTables[i]?.get(arrayBase.name)?.type;
        }
        arrType = arrType ?? this.stateVariableMap.get(arrayBase.name)?.type;
        if (arrType instanceof ArrayType) objType = arrType.elementType;
      }
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

    // blockhash(n): the (n->hash) oracle co-spend - a read-only, self-preserving 1:1 input/output slot. The
    // SDK fills __internal__blockhashInputIndex with this slot's absolute index (master input index + offset).
    if (node.usesBlockhash) {
      slots.push({ kind: 'blockhashOracle', offset: offset++ });
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

    // Deploy slot (deploy modifier functions have a genesis input for child category)
    // Note: deployTargets isn't populated yet at this stage - check modifier instead
    if (node.modifiers.includes(FunctionModifier.DEPLOY)) {
      slots.push({ kind: 'deploy', offset: offset++, slotIndex: 0 });
    }

    return { blockSize: offset, slots };
  }
}

function isEmptyBytesLiteral(expr: ExpressionNode): boolean {
  return expr instanceof HexLiteralNode && expr.value.byteLength === 0;
}

function isCompileTimeExpression(
  expr: ExpressionNode,
  constantMap: Map<string, ConstantDefinitionNode>,
): boolean {
  if (expr instanceof LiteralNode) return true;
  if (expr instanceof BinaryOpNode) {
    return isCompileTimeExpression(expr.left, constantMap)
      && isCompileTimeExpression(expr.right, constantMap);
  }
  if (expr instanceof UnaryOpNode) {
    return isCompileTimeExpression(expr.expression, constantMap);
  }
  if (expr instanceof CastNode) {
    return isCompileTimeExpression(expr.expression, constantMap);
  }
  if (expr instanceof ArrayNode) {
    return expr.elements.every((e) => isCompileTimeExpression(e, constantMap));
  }
  if (expr instanceof IdentifierNode) {
    // Allow references to other already-registered constants
    return constantMap.has(expr.name);
  }
  if (expr instanceof FieldAccessNode && expr.expression instanceof IdentifierNode) {
    // Allow namespaced constant references (e.g. SafeMath.MAX_SAFE)
    const compoundName = `${expr.expression.name}.${expr.name}`;
    return constantMap.has(compoundName);
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
