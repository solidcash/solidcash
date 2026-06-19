import { Type, PrimitiveType, BytesType, MappingType, ArrayType, StructType, EnumType, ValueType, TupleType, FunctionBlockLayout } from '@solidcash/utils';
import { TimeOp } from './Globals.js';
import AstVisitor from './AstVisitor.js';
import { BinaryOperator, NullaryOperator, UnaryOperator } from './Operator.js';
import { Location } from './Location.js';
import { SymbolTable, Symbol } from './SymbolTable.js';
import { binToHex } from '@bitauth/libauth';

export type Ast = SourceFileNode;

export enum FunctionModifier {
  PURE = 'pure',
  VIEW = 'view',
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  PUBLIC = 'public',
  PRIVATE = 'private',
  PAYABLE = 'payable',
  OVERRIDE = 'override',
  VIRTUAL = 'virtual',
  UNSAFE = 'unsafe',
  UPGRADE = 'upgrade',
  DEPLOY = 'deploy',
  SELFDESTRUCT = 'selfdestruct',
  DELEGATE = 'delegate',
  SPLIT = 'split',
  MERGE = 'merge',
}

export enum StateVariableVisibility {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  PRIVATE = 'private',
  EXTERNAL = 'external',
}

export interface ParentInvocation {
  parentName: string;
  args: ExpressionNode[];
  location: Location;
}

export abstract class Node {
  location: Location;
  abstract accept<T>(visitor: AstVisitor<T>): T;
}

export interface Named {
  name: string;
}

export interface Typed {
  type: Type;
}

export class ConstantDefinitionNode extends Node implements Named, Typed {
  inheritedFrom?: string;

  constructor(
    public type: Type,
    public name: string,
    public expression: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitConstantDefinition(this);
  }
}

export class ImportNode extends Node {
  resolvedAst?: SourceFileNode;

  constructor(
    public path: string,
    public kind: 'wildcard' | 'namespace' | 'selective',
    public alias?: string,
    public bindings?: { name: string; alias?: string }[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitImport(this);
  }
}

export class SourceFileNode extends Node {
  importedContracts: ContractNode[] = [];
  isLibrary: boolean = false;
  libraryName?: string;

  constructor(
    public contract: ContractNode,
    public constantDefinitions: ConstantDefinitionNode[] = [],
    public enumDefinitions: EnumDefinitionNode[] = [],
    public structDefinitions: StructDefinitionNode[] = [],
    public typeDefinitions: TypeDefinitionNode[] = [],
    public errorDefinitions: ErrorDefinitionNode[] = [],
    public eventDefinitions: EventDefinitionNode[] = [],
    public interfaceDefinitions: InterfaceNode[] = [],
    public freeFunctions: FunctionDefinitionNode[] = [],
    public imports: ImportNode[] = [],
    public usingForDirectives: UsingForDirectiveNode[] = [],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitSourceFile(this);
  }
}

export class ContractNode extends Node implements Named {
  symbolTable?: SymbolTable;
  modifierDefinitions: ModifierDefinitionNode[] = [];
  enumDefinitions: EnumDefinitionNode[] = [];
  errorDefinitions: ErrorDefinitionNode[] = [];
  typeDefinitions: TypeDefinitionNode[] = [];
  usingForDirectives: UsingForDirectiveNode[] = [];
  isAbstract: boolean = false;
  implements: string[] = [];
  parentInvocations: ParentInvocation[] = [];
  fallbackDef: FunctionDefinitionNode | undefined;
  receiveDef: FunctionDefinitionNode | undefined;

  constructor(
    public name: string,
    public parameters: ParameterNode[],
    public structDefinitions: StructDefinitionNode[],
    public eventDefinitions: EventDefinitionNode[],
    public constantDefinitions: ConstantDefinitionNode[],
    public stateVariables: StateVariableNode[],
    public collections: CollectionNode[],
    public constructorDef: FunctionDefinitionNode | undefined,
    public functions: FunctionDefinitionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitContract(this);
  }
}

export interface KeySourceInfo {
  kind: 'param' | 'state' | 'expression';
  paramName?: string;      // kind='param': function parameter name
  stateVarName?: string;   // kind='state': state variable name (e.g. "admin")
  canonical: string;       // canonical string for deduplication (all kinds)
}

export interface EntryAccessInfo {
  collection: string;
  collectionSignature: string;  // for covenant hash computation
  keyParams: string[];          // kept for backward compat
  keySources: KeySourceInfo[];  // detailed source info per key
  operations: ('read' | 'write' | 'delete')[];
  slotIndex: number;
}

export interface TokenContainerAccessInfo {
  keyParam: string;           // function parameter name used as category key
  operations: ('read' | 'transfer' | 'transferNft')[];
  slotIndex: number;
  transferCount: number;      // number of transfer() calls for this category
  transferNftCount: number;   // number of transferNft() calls for this category
}

export interface CustomModifierInvocation {
  name: string;
  args: ExpressionNode[];
  location: Location;
}

export class FunctionDefinitionNode extends Node implements Named {
  symbolTable?: SymbolTable;
  opRolls: Map<string, IdentifierNode> = new Map();
  requiredNftIndices?: number[];
  entryAccesses?: EntryAccessInfo[];
  tokenContainerAccesses?: TokenContainerAccessInfo[];
  externalReads?: ExternalReadSlot[];
  externalCalls?: ExternalCallSlot[];
  externalOutStateReads?: ExternalOutStateSlot[];
  emitInfos?: EmitInfo[];
  transferInfos?: TransferInfo[];
  deployTargets?: { contractName: string; dataNftCount: number }[];
  lowLevelCalls?: { callMode: 'call' | 'staticcall' | 'delegatecall'; dataParamIndex?: number }[];
  collectionIterations?: CollectionIterationInfo[];
  modifiers: FunctionModifier[] = [];
  customModifiers: CustomModifierInvocation[] = [];
  returnTypes: Type[] = [];
  returnNames: string[] = []; // named returns (empty unless all return values are named)
  functionId?: number;
  functionSelector?: Uint8Array;  // 4-byte hash selector for entry-point functions
  isFreeFunction: boolean = false;
  isFallback: boolean = false;
  isReceive: boolean = false;
  isAbstract: boolean = false;
  inheritedFrom?: string;
  // The contract that defined this function body, set during inheritance flattening. Used to resolve
  // `super.f()` relative to the right point in the linearization.
  definingContract?: string;
  // Base contracts named in an explicit `override(A, B)` specifier (empty for a bare `override`).
  overrideBases: string[] = [];
  usesMsgSender?: boolean;
  usedLibraries?: string[];     // external libraries this function calls (e.g. ['keccak256']) -> load each
  inlinedLibraries?: string[];  // subset of usedLibraries inlined into the contract bytecode (no side-car)
  libraryCallCounts?: Map<string, number>; // per-library call-site count (drives the inline decision)
  unsafeTier?: number;          // 0, 1, or 2 (only set when UNSAFE modifier present)
  splitCountParam?: string;     // parameter name for split count
  mergeCountParam?: string;     // parameter name for merge count
  blockLayout?: FunctionBlockLayout;  // 1:1 input/output block layout (compile-time offsets)

  constructor(
    public name: string,
    public parameters: ParameterNode[],
    public body: BlockNode,
  ) {
    super();
  }

  get visibility(): 'external' | 'internal' | 'public' | 'private' {
    if (this.modifiers.includes(FunctionModifier.INTERNAL)) return 'internal';
    if (this.modifiers.includes(FunctionModifier.PUBLIC)) return 'public';
    if (this.modifiers.includes(FunctionModifier.PRIVATE)) return 'private';
    return 'external';
  }

  get isEntryPoint(): boolean {
    if (this.isFreeFunction) return false;
    if (this.isFallback || this.isReceive) return true;
    const v = this.visibility;
    return v === 'external' || v === 'public';
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitFunctionDefinition(this);
  }
}

export class ParameterNode extends Node implements Named, Typed {
  constructor(
    public type: Type,
    public name: string,
    public modifier: string[] = [],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitParameter(this);
  }
}

export class StateVariableNode extends Node implements Named, Typed {
  immutable: boolean = false;
  isPacked: boolean = false;
  contractTypeName?: string;
  nftIndex: number = 0;
  fieldIndex: number = 0;
  visibility: StateVariableVisibility = StateVariableVisibility.PUBLIC;
  inheritedFrom?: string;

  constructor(
    public type: Type,
    public name: string,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitStateVariable(this);
  }
}

export abstract class StatementNode extends Node { }

export class StateAssignNode extends StatementNode {
  stateVariable?: StateVariableNode;

  constructor(
    public name: string,
    public expression: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitStateAssign(this);
  }
}

export class CollectionNode extends Node implements Named {
  immutable: boolean = false;
  visibility: StateVariableVisibility = StateVariableVisibility.PUBLIC;
  inheritedFrom?: string;

  constructor(
    public type: MappingType | ArrayType,
    public name: string,
  ) {
    super();
  }

  get keyType(): Type {
    if (this.type instanceof ArrayType) return PrimitiveType.INT;
    return this.type.keyType;
  }

  get valueType(): Type {
    if (this.type instanceof ArrayType) return this.type.elementType;
    return this.type.valueType;
  }

  /** Recursively collect all key types from nested MappingType. */
  get allKeyTypes(): Type[] {
    if (this.type instanceof ArrayType) return [PrimitiveType.INT];
    const keys: Type[] = [];
    let current: Type = this.type;
    while (current instanceof MappingType) {
      keys.push(current.keyType);
      current = current.valueType;
    }
    return keys;
  }

  /** The leaf value type (innermost non-mapping type). */
  get innermostValueType(): Type {
    if (this.type instanceof ArrayType) return this.type.elementType;
    let current: Type = this.type;
    while (current instanceof MappingType) {
      current = current.valueType;
    }
    return current;
  }

  /** Nesting depth (1 for simple mapping, 2 for nested, etc). */
  get depth(): number {
    return this.allKeyTypes.length;
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitCollection(this);
  }
}

export class VariableDefinitionNode extends StatementNode implements Named, Typed {
  constructor(
    public type: Type,
    public modifier: string[],
    public name: string,
    public expression: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitVariableDefinition(this);
  }
}

export class TupleAssignmentNode extends StatementNode {
  constructor(
    // A `skip` element is an empty slot `(, x) = ...` whose value is dropped.
    // An `existing` element is a bare identifier `(x, y) = ...` assigned to an already-declared var.
    public elements: { name?: string, type?: Type, skip?: boolean, existing?: boolean }[],
    public tuple: ExpressionNode,
    public parenthesised: boolean = false,
    // Per-slot RHS expressions for `(x, y) = (a, b)` (swap/assign); when set, `tuple` is unused.
    public tupleExpressions?: ExpressionNode[],
  ) {
    super();
  }

  get left(): { name?: string, type?: Type, skip?: boolean, existing?: boolean } { return this.elements[0]; }
  get right(): { name?: string, type?: Type, skip?: boolean, existing?: boolean } { return this.elements[1]; }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitTupleAssignment(this);
  }
}

export class AssignNode extends StatementNode {
  constructor(
    public identifier: IdentifierNode,
    public expression: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAssign(this);
  }
}

export class TimeOpNode extends StatementNode {
  // True for the compiler-injected tx.locktime guard (no user source); see InjectLocktimeGuardTraversal.
  isGuard = false;

  constructor(
    public timeOp: TimeOp,
    public expression: ExpressionNode,
    public message?: string,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitTimeOp(this);
  }
}

export class RequireNode extends StatementNode {
  errorDefinition?: ErrorDefinitionNode;

  constructor(
    public expression: ExpressionNode,
    public message?: string,
    public errorName?: string,
    public args: ExpressionNode[] = [],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitRequire(this);
  }
}

export interface BranchOps {
  stateWriteKeys: Set<string>;       // "nftIndex:fieldIndex" union across branches
  mappingWriteSlots: Set<number>;    // slotIndex union
  mappingDeleteSlots: Set<number>;   // slotIndex union
  transferCount: number;             // max count across branches
  minTransferCount: number;          // min count across branches
  ifTransferCount: number;           // if-block's transfer count
  emitCount: number;                 // max count across branches
  minEmitCount: number;              // min count across branches
  ifEmitCount: number;               // if-block's emit count
  tokenContainerTransferCount: number;          // max count across branches
  minTokenContainerTransferCount: number;       // min count across branches
  ifTokenContainerTransferCount: number;        // if-block's TC transfer count
}

export class BranchNode extends StatementNode {
  // Populated by SymbolTableTraversal: operations that need pre-allocation
  branchOps?: BranchOps;

  constructor(
    public condition: ExpressionNode,
    public ifBlock: BlockNode,
    public elseBlock?: BlockNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitBranch(this);
  }
}

export class TryCatchNode extends StatementNode {
  constructor(
    public expression: ExpressionNode,
    public tryBlock: BlockNode,
    public catchClauses: CatchClauseNode[],
    public returnParameters?: ParameterNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitTryCatch(this);
  }
}

export class CatchClauseNode extends Node {
  constructor(
    public block: BlockNode,
    public errorName?: string,
    public parameters?: ParameterNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitCatchClause(this);
  }
}

export class DoWhileNode extends StatementNode {
  forLoopUpdateCount: number = 0;

  constructor(
    public condition: ExpressionNode,
    public block: BlockNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitDoWhile(this);
  }
}

export class WhileNode extends StatementNode {
  // Number of trailing block statements that form a desugared for-loop update (see AstBuilder.visitForStatement).
  // Used by BreakContinueTransformation so `continue` still runs the update.
  forLoopUpdateCount: number = 0;

  constructor(
    public condition: ExpressionNode,
    public block: BlockNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitWhile(this);
  }
}

export class CollectionIterationNode extends StatementNode {
  collection?: CollectionNode;
  collectionIterationIndex: number = -1;

  constructor(
    public mode: CollectionIterationMode,
    public collectionName: string,
    public keyType: Type | undefined,
    public keyName: string | undefined,
    public valueType: Type | undefined,
    public valueName: string | undefined,
    public body: BlockNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitCollectionIteration(this);
  }
}

export class AssemblyStatementNode extends StatementNode {
  constructor(
    public assemblyBody: string,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAssemblyStatement(this);
  }
}

export class UncheckedNode extends StatementNode {
  constructor(
    public block: BlockNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitUnchecked(this);
  }
}

export interface SwitchOps {
  stateWriteKeys: Set<string>;
  mappingWriteSlots: Set<number>;
  mappingDeleteSlots: Set<number>;
  transferCount: number;
  minTransferCount: number;
  emitCount: number;
  minEmitCount: number;
  tokenContainerTransferCount: number;
  minTokenContainerTransferCount: number;
}

export class SwitchCaseNode extends Node {
  constructor(
    public value: ExpressionNode,
    public body: BlockNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitSwitchCase(this);
  }
}

export class SwitchNode extends StatementNode {
  switchOps?: SwitchOps;

  constructor(
    public expression: ExpressionNode,
    public cases: SwitchCaseNode[],
    public defaultCase?: BlockNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitSwitch(this);
  }
}

export class BreakNode extends StatementNode {
  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitBreak(this);
  }
}

export class ContinueNode extends StatementNode {
  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitContinue(this);
  }
}

export class BlockNode extends StatementNode {
  symbolTable?: SymbolTable;

  constructor(
    public statements?: StatementNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitBlock(this);
  }
}

export abstract class ExpressionNode extends Node {
  type?: Type;
}

export class ContractReferenceNode extends ExpressionNode {
  compiledBytecode?: Uint8Array;

  constructor(
    public contractName: string,
    public referencedContract: ContractNode,
    public constructorArgs: ExpressionNode[],
    public field: 'lockingBytecode',
  ) {
    super();
    this.type = new BytesType();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitContractReference(this);
  }
}

export class StateAccessNode extends ExpressionNode implements Named {
  stateVariable?: StateVariableNode;

  constructor(
    public name: string,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitStateAccess(this);
  }
}

export class MappingAccessNode extends ExpressionNode implements Named {
  collection?: CollectionNode;
  entrySlotIndex: number = -1;
  isTokenContainerAccess?: boolean;
  isOutStateTokenContainerAccess?: boolean;
  isPackedStateArrayAccess?: boolean;
  packedStateVariable?: StateVariableNode;
  tokenContainerSlotIndex: number = -1;
  arrayIndex?: ExpressionNode; // Set when innermost value is ArrayType and extra key provided

  constructor(
    public name: string,
    public keys: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitMappingAccess(this);
  }
}

export class MappingAssignNode extends StatementNode implements Named {
  collection?: CollectionNode;
  entrySlotIndex: number = -1;
  arrayIndex?: ExpressionNode; // Set when innermost value is ArrayType and extra key provided

  constructor(
    public name: string,
    public keys: ExpressionNode[],
    public expression: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitMappingAssign(this);
  }
}

export class MappingFieldAssignNode extends StatementNode implements Named {
  collection?: CollectionNode;
  entrySlotIndex: number = -1;

  constructor(
    public name: string,
    public keys: ExpressionNode[],
    public fieldName: string,
    public expression: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitMappingFieldAssign(this);
  }
}

export class DeleteLocalNode extends StatementNode {
  constructor(
    public identifier: IdentifierNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitDeleteLocal(this);
  }
}

export class DeleteStateNode extends StatementNode {
  stateVariable?: StateVariableNode;

  constructor(
    public name: string,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitDeleteState(this);
  }
}

export class MappingDeleteNode extends StatementNode implements Named {
  collection?: CollectionNode;
  entrySlotIndex: number = -1;

  constructor(
    public name: string,
    public keys: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitMappingDelete(this);
  }
}

export class CastNode extends ExpressionNode implements Typed {
  constructor(
    public type: Type,
    public expression: ExpressionNode,
    public isUnsafe: boolean,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitCast(this);
  }
}

export class FunctionCallNode extends ExpressionNode {
  resolvedFunction?: FunctionDefinitionNode;
  fieldNames?: string[];

  constructor(
    public identifier: IdentifierNode,
    public parameters: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitFunctionCall(this);
  }
}

export class InstantiationNode extends ExpressionNode {
  referencedContract?: ContractNode;
  callOptions?: CallOptions;
  transferIndex: number = 0;
  isStatefulDeploy: boolean = false;
  deployedDataNftCount: number = 0;
  deployedStateVars: StateVariableNode[] = [];

  constructor(
    public identifier: IdentifierNode,
    public parameters: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitInstantiation(this);
  }
}

export class TupleIndexOpNode extends ExpressionNode {
  constructor(
    public tuple: ExpressionNode,
    public index: number,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitTupleIndexOp(this);
  }
}

export class SliceNode extends ExpressionNode {
  constructor(
    public element: ExpressionNode,
    public start: ExpressionNode,
    public end: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitSlice(this);
  }
}

export class BinaryOpNode extends ExpressionNode {
  constructor(
    public left: ExpressionNode,
    public operator: BinaryOperator,
    public right: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitBinaryOp(this);
  }
}

export class UnaryOpNode extends ExpressionNode {
  constructor(
    public operator: UnaryOperator,
    public expression: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitUnaryOp(this);
  }
}

export class NullaryOpNode extends ExpressionNode {
  constructor(
    public operator: NullaryOperator,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitNullaryOp(this);
  }
}

export class TernaryOpNode extends ExpressionNode {
  constructor(
    public condition: ExpressionNode,
    public ifTrue: ExpressionNode,
    public ifFalse: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitTernaryOp(this);
  }
}

export class ArrayNode extends ExpressionNode {
  blobEncoded: boolean = false;

  constructor(
    public elements: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitArray(this);
  }
}

export class NewArrayNode extends ExpressionNode {
  blobEncoded: boolean = true;

  constructor(
    public elementType: Type,
    public size: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitNewArray(this);
  }
}

export class ArrayAccessNode extends ExpressionNode {
  constructor(
    public array: ExpressionNode,
    public index: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitArrayAccess(this);
  }
}

export class ArrayPushNode extends StatementNode implements Named {
  arrayType?: ArrayType;

  constructor(
    public name: string,
    public value: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitArrayPush(this);
  }
}

export class ArrayPopNode extends StatementNode implements Named {
  arrayType?: ArrayType;

  constructor(
    public name: string,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitArrayPop(this);
  }
}

export class ArrayAssignNode extends StatementNode implements Named {
  arrayType?: ArrayType;

  constructor(
    public name: string,
    public index: ExpressionNode,
    public value: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitArrayAssign(this);
  }
}

export class ArrayDeleteNode extends StatementNode implements Named {
  arrayType?: ArrayType;

  constructor(
    public name: string,
    public index: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitArrayDelete(this);
  }
}

// Packed state array operations - array stored as single blob in data NFT
export class StateArrayPushNode extends StatementNode implements Named {
  stateVariable?: StateVariableNode;

  constructor(
    public name: string,
    public value: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitStateArrayPush(this);
  }
}

export class StateArrayPopNode extends StatementNode implements Named {
  stateVariable?: StateVariableNode;

  constructor(
    public name: string,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitStateArrayPop(this);
  }
}

export class StateArrayAssignNode extends StatementNode implements Named {
  stateVariable?: StateVariableNode;

  constructor(
    public name: string,
    public index: ExpressionNode,
    public value: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitStateArrayAssign(this);
  }
}

export class StateArrayDeleteNode extends StatementNode implements Named {
  stateVariable?: StateVariableNode;

  constructor(
    public name: string,
    public index: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitStateArrayDelete(this);
  }
}

export class IdentifierNode extends ExpressionNode implements Named {
  definition?: Symbol;
  // Set when this identifier names a function used as a value (a function pointer); codegen pushes
  // the target's integer functionId.
  functionReference?: FunctionDefinitionNode;

  constructor(
    public name: string,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitIdentifier(this);
  }
}

export abstract class LiteralNode<T = any> extends ExpressionNode {
  public value: T;

  toString(): string {
    return `${this.value}`;
  }
}

export class BoolLiteralNode extends LiteralNode<boolean> {
  constructor(
    public value: boolean,
  ) {
    super();
    this.type = PrimitiveType.BOOL;
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitBoolLiteral(this);
  }
}

export class IntLiteralNode extends LiteralNode<bigint> {
  constructor(
    public value: bigint,
  ) {
    super();
    this.type = PrimitiveType.INT;
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitIntLiteral(this);
  }
}

export class DecimalLiteralNode extends LiteralNode<string> {
  constructor(
    public value: string, // Preserved as string for exact decimal representation
  ) {
    super();
    // Type is inferred from context during type checking
  }

  scaledValue(decimals: number): bigint {
    const isNeg = this.value.startsWith('-');
    const abs = isNeg ? this.value.slice(1) : this.value;
    const [intPart, fracPart = ''] = abs.split('.');
    if (fracPart.length > decimals) {
      const loc = this.location ? ` at line ${this.location.start.line}` : '';
      console.log(
        `Warning: decimal literal '${this.value}'${loc} has ${fracPart.length} fractional digits `
        + `but the target type only supports ${decimals}. Truncating to ${decimals} digits.`,
      );
    }
    const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals);
    const sign = isNeg ? -1n : 1n;
    return sign * (BigInt(intPart) * 10n ** BigInt(decimals) + BigInt(paddedFrac));
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitDecimalLiteral(this);
  }
}

export class StringLiteralNode extends LiteralNode<string> {
  constructor(
    public value: string,
    public quote: string,
  ) {
    super();
    this.type = PrimitiveType.STRING;
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitStringLiteral(this);
  }
}

export class HexLiteralNode extends LiteralNode<Uint8Array> {
  constructor(
    public value: Uint8Array,
  ) {
    super();
    this.type = new BytesType(value.byteLength);
  }

  toString(): string {
    return `0x${binToHex(this.value)}`;
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitHexLiteral(this);
  }
}

export class AbiEncodeNode extends ExpressionNode {
  constructor(
    public parameters: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAbiEncode(this);
  }
}

export class AbiEncodePackedNode extends ExpressionNode {
  constructor(
    public parameters: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAbiEncodePacked(this);
  }
}

export class AbiEncodeWithSelectorNode extends ExpressionNode {
  constructor(
    public selector: ExpressionNode,
    public parameters: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAbiEncodeWithSelector(this);
  }
}

export class AbiEncodeWithSignatureNode extends ExpressionNode {
  computedSelector?: Uint8Array; // set at compile time for string literals
  constructor(
    public signature: ExpressionNode,
    public parameters: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAbiEncodeWithSignature(this);
  }
}

export class AbiEncodeCallNode extends ExpressionNode {
  computedSelector?: Uint8Array; // set during semantic analysis
  resolvedParamTypes?: Type[];   // from interface function definition
  constructor(
    public interfaceName: string,
    public functionName: string,
    public parameters: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAbiEncodeCall(this);
  }
}

export class BytesConcatNode extends ExpressionNode {
  constructor(
    public parameters: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitBytesConcat(this);
  }
}

export class StringConcatNode extends ExpressionNode {
  constructor(
    public parameters: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitStringConcat(this);
  }
}

export class AbiDecodeNode extends ExpressionNode {
  constructor(
    public data: ExpressionNode,
    public schema: Type[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAbiDecode(this);
  }
}

export class AbiDecodeAtNode extends ExpressionNode {
  constructor(
    public data: ExpressionNode,
    public schema: Type[],
    public index: number,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAbiDecodeAt(this);
  }
}

export class StructDefinitionNode extends Node implements Named {
  inheritedFrom?: string;

  constructor(
    public name: string,
    public fields: { name: string; type: Type }[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitStructDefinition(this);
  }
}

export class EnumDefinitionNode extends Node implements Named {
  inheritedFrom?: string;

  constructor(
    public name: string,
    public members: { name: string; value: bigint }[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitEnumDefinition(this);
  }
}

export class TypeDefinitionNode extends Node implements Named {
  inheritedFrom?: string;

  constructor(
    public name: string,
    public valueType: ValueType,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitTypeDefinition(this);
  }
}

export interface UsingForBinding {
  funcName: string;
  operator?: string; // e.g. '+', '-', '==', '~'
}

export class UsingForDirectiveNode extends Node {
  constructor(
    // "SafeMath" (Form 1: whole library) or undefined (Form 2: specific functions)
    public libraryName: string | undefined,
    // Form 2: [{funcName: "SafeMath.add"}, ...] or undefined (Form 1)
    public functionBindings: UsingForBinding[] | undefined,
    public targetTypeName: string | undefined,             // "int", "bytes20", etc. or undefined when wildcard
    public isWildcard: boolean,                            // true when target is *
    public isGlobal: boolean = false,                      // true when 'global' keyword is present
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitUsingForDirective(this);
  }
}

export class InterfaceFunctionNode extends Node implements Named {
  constructor(
    public name: string,
    public parameters: ParameterNode[],
    public returnTypes: Type[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitInterfaceFunction(this);
  }
}

export class InterfaceStateVariableNode extends Node implements Named, Typed {
  constructor(
    public type: Type,
    public name: string,
    public visibility: StateVariableVisibility.PUBLIC | StateVariableVisibility.EXTERNAL,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitInterfaceStateVariable(this);
  }
}

export class InterfaceCollectionNode extends Node implements Named, Typed {
  constructor(
    public type: MappingType | ArrayType,
    public name: string,
    public visibility: StateVariableVisibility.PUBLIC | StateVariableVisibility.EXTERNAL,
  ) {
    super();
  }

  get keyType(): Type {
    if (this.type instanceof ArrayType) return PrimitiveType.INT;
    return this.type.keyType;
  }

  get valueType(): Type {
    if (this.type instanceof ArrayType) return this.type.elementType;
    return this.type.valueType;
  }

  get allKeyTypes(): Type[] {
    if (this.type instanceof ArrayType) return [PrimitiveType.INT];
    const keys: Type[] = [];
    let current: Type = this.type;
    while (current instanceof MappingType) {
      keys.push(current.keyType);
      current = current.valueType;
    }
    return keys;
  }

  get innermostValueType(): Type {
    if (this.type instanceof ArrayType) return this.type.elementType;
    let current: Type = this.type;
    while (current instanceof MappingType) {
      current = current.valueType;
    }
    return current;
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitInterfaceCollection(this);
  }
}

export class InterfaceNode extends Node implements Named {
  parents: string[] = [];

  constructor(
    public name: string,
    public stateVariables: InterfaceStateVariableNode[],
    public collections: InterfaceCollectionNode[],
    public functions: InterfaceFunctionNode[],
    public structDefinitions: StructDefinitionNode[] = [],
    public enumDefinitions: EnumDefinitionNode[] = [],
    public typeDefinitions: TypeDefinitionNode[] = [],
    public eventDefinitions: EventDefinitionNode[] = [],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitInterfaceDefinition(this);
  }
}

export interface ExternalStateReadInfo {
  interfaceName: string;
  stateVarName: string;
  stateVarType: Type;
  nftIndex: number;
  fieldIndex: number;
  fieldsInNft: { type: Type; fieldIndex: number }[];
  externalReadSlotIndex: number;
}

export class ExternalStateAccessNode extends ExpressionNode {
  readInfo?: ExternalStateReadInfo;

  constructor(
    public interfaceName: string,
    public categoryExpression: ExpressionNode,
    public name: string,
    public lbcExpression?: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitExternalStateAccess(this);
  }
}

export interface ExternalCollectionReadInfo {
  interfaceName: string;
  collectionName: string;
  collectionSignature: string;
  keyTypes: Type[];
  valueType: Type;
  externalReadSlotIndex: number;
}

export class ExternalMappingAccessNode extends ExpressionNode {
  readInfo?: ExternalCollectionReadInfo;

  constructor(
    public interfaceName: string,
    public categoryExpression: ExpressionNode,
    public name: string,
    public keys: ExpressionNode[],
    public lbcExpression?: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitExternalMappingAccess(this);
  }
}

export interface ExternalReadSlot {
  interfaceName: string;
  kind: 'data' | 'entry';
  nftIndex?: number;
  collectionName?: string;
  collectionSignature?: string;
  categoryParam?: string; // name of the constructor/function parameter providing the category
  lbcParam?: string; // name of the constructor/function parameter providing the locking bytecode
  slotIndex: number;
}

export enum ExternalCallMode {
  REGULAR = 'regular',
  CALL = 'call',
  STATICCALL = 'staticcall',
  DELEGATECALL = 'delegatecall',
}

export interface ExternalFunctionCallInfo {
  interfaceName: string;
  functionName: string;
  externalCallSlotIndex: number;
  hasReturnValues?: boolean;
  returnTypes?: Type[];
  returnEventSignature?: string;
  returnSlotIndex?: number; // sequential index among slots with hasReturnValues
  callMode?: ExternalCallMode;
}

export interface CallOptions {
  value?: ExpressionNode;
  gas?: ExpressionNode;
  salt?: ExpressionNode;
}

export class ExternalFunctionCallNode extends ExpressionNode {
  callInfo?: ExternalFunctionCallInfo;
  callMode?: ExternalCallMode;
  callOptions?: CallOptions;
  valueTransferIndex: number = -1;

  constructor(
    public interfaceName: string,
    public categoryExpression: ExpressionNode,
    public functionName: string,
    public parameters: ExpressionNode[],
    public lbcExpression?: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitExternalFunctionCall(this);
  }
}

export interface ExternalCallArgSource {
  kind: 'forward' | 'constructorArg' | 'literal' | 'expression';
  paramIndex?: number;
  paramName?: string;
  value?: string;
  type?: string;
}

export interface ExternalCallSlot {
  interfaceName: string;
  functionName: string;
  categoryParam?: string;
  lbcParam?: string;
  slotIndex: number;
  requiredDataNftIndices: number[];
  hasReturnValues?: boolean;
  returnTypes?: Type[];
  returnEventSignature?: string;
  computedOffset: number;
  returnSlotIndex?: number; // sequential index among slots with hasReturnValues
  needsSelectorVerification?: boolean; // true when callee interface has >1 callable function
  callMode?: ExternalCallMode;
  argSources?: ExternalCallArgSource[];
}

export interface ExternalOutputStateAccessInfo {
  interfaceName: string;
  stateVarName: string;
  stateVarType: Type;
  nftIndex: number;
  fieldIndex: number;
  fieldsInNft: { type: Type; fieldIndex: number }[];
  externalOutStateSlotIndex: number;
}

export class ExternalOutputStateNode extends ExpressionNode {
  constructor(
    public interfaceName: string,
    public categoryExpression: ExpressionNode,
    public lbcExpression?: ExpressionNode,
  ) { super(); }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitExternalOutputState(this);
  }
}

export class ExternalOutputStateAccessNode extends ExpressionNode {
  accessInfo?: ExternalOutputStateAccessInfo;

  constructor(
    public outStateNode: ExternalOutputStateNode,
    public stateVarName: string,
  ) { super(); }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitExternalOutputStateAccess(this);
  }
}

export interface ExternalOutStateSlot {
  interfaceName: string;
  categoryParam?: string;
  lbcParam?: string;
  slotIndex: number;
  requiredDataNftIndices: number[];
  sharedWithCallSlotIndex?: number;
}

export class MethodCallNode extends ExpressionNode {
  callOptions?: CallOptions;
  valueTransferIndex: number = -1; // temporary carrier for pre-scan before transformation

  constructor(
    public object: ExpressionNode,
    public methodName: string,
    public parameters: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitMethodCall(this);
  }
}

export class EventDefinitionNode extends Node implements Named {
  signature: string = '';
  inheritedFrom?: string;
  isAnonymous: boolean = false;

  constructor(
    public name: string,
    public parameters: { name: string; type: Type; indexed?: boolean }[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitEventDefinition(this);
  }
}

export class ErrorDefinitionNode extends Node implements Named {
  signature: string = '';
  inheritedFrom?: string;

  constructor(
    public name: string,
    public parameters: { name: string; type: Type }[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitErrorDefinition(this);
  }
}

export class RevertNode extends StatementNode {
  errorDefinition?: ErrorDefinitionNode;

  constructor(
    public errorName?: string,
    public args: ExpressionNode[] = [],
    public message?: string,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitRevert(this);
  }
}

export class AssertNode extends StatementNode {
  constructor(
    public expression: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAssert(this);
  }
}

export interface EmitInfo {
  eventName: string;
  eventSignature: string;
  emitIndex: number;
  chunkCount: number;
}

export interface TransferInfo {
  transferIndex: number;
}

export enum CollectionIterationMode {
  ENTRIES = 'entries',
  KEYS = 'keys',
  VALUES = 'values',
}

export interface CollectionIterationInfo {
  collection: string;
  collectionSignature: string;
  mode: CollectionIterationMode;
  iterationIndex: number;
}

export class EmitStatementNode extends StatementNode {
  eventDefinition?: EventDefinitionNode;
  eventCandidates?: EventDefinitionNode[];
  emitIndex: number = 0;

  constructor(
    public eventName: string,
    public args: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitEmitStatement(this);
  }
}

export class TransferStatementNode extends StatementNode {
  transferIndex: number = 0;

  constructor(
    public lockingBytecode: ExpressionNode,
    public amount: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitTransferStatement(this);
  }
}

export class AddressTransferStatementNode extends StatementNode {
  transferIndex: number = 0;

  constructor(
    public addressExpression: ExpressionNode,  // payable address or connected address
    public amount: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAddressTransferStatement(this);
  }
}

export class AddressSendExpressionNode extends ExpressionNode {
  transferIndex: number = 0;

  constructor(
    public addressExpression: ExpressionNode,  // payable address or connected address
    public amount: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAddressSendExpression(this);
  }
}

export class AddressConnectNode extends ExpressionNode {
  constructor(
    public addressExpression: ExpressionNode,  // address type
    public categoryExpression: ExpressionNode,  // bytes32 category
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAddressConnect(this);
  }
}

export class FieldAccessNode extends ExpressionNode implements Named {
  structType?: StructType;
  enumType?: EnumType;

  constructor(
    public expression: ExpressionNode,
    public name: string,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitFieldAccess(this);
  }
}

export class TypeIntrospectionNode extends ExpressionNode {
  resolvedType?: Type;
  interfaceNode?: InterfaceNode;
  contractName?: string;
  precomputedBytes?: Uint8Array;

  constructor(
    public typeArgText: string,
    public property: string,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitTypeIntrospection(this);
  }
}

export class TokenContainerMethodStatementNode extends StatementNode {
  tokenContainerSlotIndex: number = 0;
  transferIndex: number = 0;

  constructor(
    public tokenContainerKeyExpression: ExpressionNode,  // the category expression
    public methodName: string,  // 'transfer' or 'transferNft'
    public args: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitTokenContainerMethodStatement(this);
  }
}

export class ReturnNode extends StatementNode {
  constructor(
    public expressions: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitReturn(this);
  }
}

export class FunctionCallStatementNode extends StatementNode {
  constructor(
    public call: FunctionCallNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitFunctionCallStatement(this);
  }
}

export class MethodCallStatementNode extends StatementNode {
  expression?: ExpressionNode; // After semantic analysis, holds the transformed ExternalFunctionCallNode

  constructor(
    public call: MethodCallNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitMethodCallStatement(this);
  }
}

export class ModifierDefinitionNode extends Node implements Named {
  inheritedFrom?: string;

  constructor(
    public name: string,
    public parameters: ParameterNode[],
    public statements: StatementNode[],
  ) {
    super();
  }

  accept<T>(_visitor: AstVisitor<T>): T {
    throw new Error('ModifierDefinitionNode should have been expanded before traversal');
  }
}

export class PlaceholderStatementNode extends StatementNode {
  accept<T>(_visitor: AstVisitor<T>): T {
    throw new Error('PlaceholderStatementNode should have been expanded before traversal');
  }
}

export class LowLevelCallNode extends ExpressionNode {
  callIndex: number = 0;  // assigned during pre-scan
  callOptions?: CallOptions;
  valueTransferIndex: number = -1;

  constructor(
    public targetExpression: ExpressionNode,  // for type-checking only, not emitted
    public data: ExpressionNode,              // calldata bytes
    public callMode: 'call' | 'staticcall' | 'delegatecall',
  ) {
    super();
    this.type = new TupleType([PrimitiveType.BOOL, new BytesType()]);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitLowLevelCall(this);
  }
}

export class LowLevelCallStatementNode extends StatementNode {
  callIndex: number = 0;
  callOptions?: CallOptions;
  valueTransferIndex: number = -1;

  constructor(
    public targetExpression: ExpressionNode,
    public data: ExpressionNode,
    public callMode: 'call' | 'staticcall' | 'delegatecall',
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitLowLevelCallStatement(this);
  }
}

export class ConsoleStatementNode extends Node {
  constructor(
    public parameters: ConsoleParameterNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitConsoleStatement(this);
  }
}

export type ConsoleParameterNode = LiteralNode | IdentifierNode;
