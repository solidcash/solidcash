import { type Type, PrimitiveType, AddressBytesType, BytesType, MappingType, ArrayType, StructType, EnumType, ValueType, TupleType, type FunctionBlockLayout, type LibraryCallArg, type JournalSettlementIdentityAbi, type ConstructedKeyVectorV1Abi, type AffineRecursiveFrameV1Abi } from '@solidcash/utils';
import type { AbiFunction } from '@solidcash/utils';
import type { ChildDeploymentValueRecipe } from '@solidcash/utils';
import { TimeOp } from './Globals.js';
import AstVisitor from './AstVisitor.js';
import { BinaryOperator, NullaryOperator, UnaryOperator } from './Operator.js';
import { Location } from './Location.js';
import { YulBlockNode } from './YulAST.js';
import { SymbolTable, Symbol } from './SymbolTable.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { emitCompilerWarning } from '../warnings.js';

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
  MIGRATE_RECORDS = 'migrateRecords',
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
  // Assignment expressions in constructor arguments execute before the base constructor call. They are
  // extracted during inheritance expansion so parameter substitution receives the assigned value expression.
  argumentPrelude?: StatementNode[];
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
  // Present when parsed from a state-variable declaration (`uint public constant X = ...`). File-level and
  // dedicated constant declarations have no externally callable visibility.
  visibility?: StateVariableVisibility;

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
  // Solidity versions before 0.7 expose the deprecated global `now` alias for block.timestamp.
  solidityLegacyNow = false;
  // Explicit source-unit ABI coder selection. Undefined means the compiler/default coder; only explicit v1
  // requires the legacy ABI type restrictions.
  abiCoderVersion?: 'v1' | 'v2';
  importedContracts: ContractNode[] = [];
  isLibrary: boolean = false;
  libraryName?: string;
  // For a library file compiled directly (not imported): the primary library lowered to a stateless contract,
  // present only when it has >=1 explicitly public/external function. compiler.ts swaps it in for ast.contract
  // so the library produces an artifact. See docs/library-contracts.md (Phase 2).
  libraryContract?: ContractNode;
  // Per imported state-touching library: its declared state-var layout (libraryName -> state vars). Set by the
  // ImportResolver; used to check a consumer's layout matches a delegate library it calls. See library-contracts.md.
  importedLibraryLayouts: Map<string, StateVariableNode[]> = new Map();
  // Names of libraries declared in this file or merged from imports. `using L for T` on a library whose
  // functions were all inlined away (storage-pointer fns) or that is empty must not read as undefined.
  declaredLibraryNames: string[] = [];
  // Declared parameter-type strings per namespaced library function ("L.f" -> ["uint256", ...]), recorded at
  // parse time so `L.f.selector` folds even for functions later inlined away (storage-pointer fns).
  libraryFunctionSignatures: Map<string, string[]> = new Map();
  // Declared parameter-type strings per namespaced library event ("L.E" -> ["uint256", ...]): library events
  // register under bare names (same-name events in different libraries collide), so `L.E.selector` folds from
  // this parse-time record instead.
  libraryEventSignatures: Map<string, string[]> = new Map();
  libraryAnonymousEvents: Set<string> = new Set();
  libraryErrorSignatures: Map<string, string[]> = new Map();
  libraryErrorDefinitions: Set<ErrorDefinitionNode> = new Set();
  // Library modifiers are namespaced (`L.onlyOwner`) and expanded on the corresponding lowered free/library
  // functions before semantic traversal. Kept on the source file so imports can merge them with library helpers.
  libraryModifierDefinitions: ModifierDefinitionNode[] = [];

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
  // `transient` state vars (EIP-1153). Kept off `stateVariables` (no persisted UTXO slot) but here so inheritance
  // can merge them; LowerTransientStateVars injects a per-function zero-init local for each after flattening.
  transientStateVars: StateVariableNode[] = [];
  // Evaluated `layout at <base>` slot (solc 0.8.29 custom storage layout). Shifts the EVM-visible slot of every
  // persistent state var (inherited ones included), not transient ones. Absent = slot 0.
  storageLayoutBase?: bigint;
  isAbstract: boolean = false;
  // Set when this contract was lowered from a `library` (docs/library-contracts.md). Surfaced as the artifact
  // `isLibrary` flag; the deployed-library codegen (self-preservation) and SDK co-spend key on it.
  isLibraryContract: boolean = false;
  // Set for a branded delegate library (compilerOptions.brandLibrary): the delegate covenant additionally
  // verifies the co-spent proxy master's category == this library's `__brand` ctor arg, so the library can be
  // spent only alongside its owning consumer's master - it rides that one master's serialization (zero marginal
  // contention). See docs/library-contracts.md (3b contention).
  isBrandedLibrary: boolean = false;
  // X12. Set for a SPLIT FACET (compileStringSplit): every entry point is a `delegate` function and the artifact
  // is published `delegateOnly`, so the SDK never co-spends or materializes the facet's OWN data NFTs. Its
  // output-only block slots are therefore one position lower per data NFT than the layout offset says. A plain
  // contract that merely HAS `delegate` functions is not delegate-only and keeps its data-NFT positions.
  isSplitFacet: boolean = false;
  // A per-entry function shard keeps the logical state declarations and must not regain them as extra
  // dispatchable getters. The logical artifact owns that surface.
  suppressSynthesizedGetters: boolean = false;
  // Set by SynthesizeBlockOracle when any function reads blockhash(n). The (n->hash) oracle is branded to the
  // contract's OWN category (master-bound, per docs/block-and-transaction-properties.md s3), so a blockhash
  // reader MUST be stateful (have a master/category to co-spend + anchor the oracle against).
  usesBlockhash: boolean = false;
  // A function reads block.number/timestamp/.... The data is a separate covenant's commitment, not this
  // contract's state, and this contract does not grow an update entry.
  usesBlockOracle: boolean = false;
  // Set by SymbolTableTraversal once block layouts are known: any entry reserves the satoshi container slot, so an
  // in-place upgrade must migrate (or drain) that container. Read by the upgrade codegen.
  keepsSatoshiContainer: boolean = false;
  // Set by SymbolTableTraversal once block layouts are known: any entry reserves a token container slot (holding a
  // foreign token category), so an in-place upgrade must migrate those containers. Read by the upgrade codegen.
  keepsTokenContainer: boolean = false;
  // Number of token-container slots the contract reserves (the maximum any single entry's block layout holds):
  // the bounded count an in-place upgrade can migrate in one transaction.
  tokenContainerCount: number = 0;
  // Set when the contract instantiates a stateful child (`new T()` where T has state): deploying it IS a deploy,
  // so this contract is made stateful to host the (implied) deploy covenant. Read by both the symbol-table pass
  // (block-layout allocation) and artifact generation (so the SDK sees a zero-state stateful contract).
  deploysStatefulChild: boolean = false;
  // Set when `new T{value: ...}` requires a parent value-transfer covenant even if neither contract has storage.
  deploysWithValue: boolean = false;
  // Set when the contract emits ANY event (including a foreign/library event it does not itself declare): the
  // event commitment rides a state NFT, so emitting forces the contract stateful. Read by the symbol-table pass
  // (statefulness) and codegen (block-layout gates).
  emitsEvent: boolean = false;
  // Events this contract emits that are declared in a sibling/imported contract (`emit C.E(...)`). Recorded so
  // artifact generation lists them (Solidity puts emitted foreign events in the emitter's ABI). Deduped by sig.
  emittedForeignEvents: EventDefinitionNode[] = [];
  // Set by inheritance expansion when two distinct inheritance branches/scopes declare the same event type
  // signature. The list itself stays deduplicated for dispatch/artifact generation; semantic validation uses this
  // marker to retain Solidity's redeclaration diagnostic.
  hasDuplicateInheritedEventSignature = false;
  implements: string[] = [];
  parentInvocations: ParentInvocation[] = [];
  fallbackDef: FunctionDefinitionNode | undefined;
  receiveDef: FunctionDefinitionNode | undefined;
  // Override provenance for inherited fallback/receive declarations (their bodies are copied into the child).
  inheritedSpecialFunctions: Partial<Record<'fallback' | 'receive', {
    origin: string;
    isVirtual: boolean;
  }>> = {};

  // Constructor external reads hoisted to deploy inputs by PromoteConstructorExternalReads. Surfaced as
  // stateLayout.deployReads so the SDK can auto-resolve them (read the target's state at deploy).
  deployReads: { input: string; addressInput: string; contractType: string; read: string }[] = [];
  // Original public struct declarations consumed by AstBuilder's per-field state flattening. Retained so the
  // Solidity-compat getter pass can reconstruct the getter ABI from `root__field` state leaves.
  flattenedPublicStructGetters: {
    name: string;
    type: StructType;
    visibility: StateVariableVisibility;
  }[] = [];

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
  kind: 'param' | 'state' | 'expression' | 'stateArrayLast' | 'constant' | 'msgSender';
  paramName?: string;      // kind='param': function parameter name
  stateVarName?: string;   // kind='state': state variable name (e.g. "admin")
  stateArrayName?: string; // kind='stateArrayLast': `arr[arr.length-1]`, the state array name (SDK resolves last elem)
  constantValue?: string;  // kind='constant': compile-time-resolved uint key value (decimal), SDK matches the entry
  // kind='msgSender': a `msg.sender` / `tx.origin` key. For a direct call both resolve to tx.origin = the first
  // native P2PKH input's lockscript, so the SDK computes slot = keyToSlot(76a914<pkh>88ac) of the sender.
  senderOp?: 'msg.sender' | 'tx.origin';
  canonical: string;       // canonical string for deduplication (all kinds)
  /** SDK-only key expression after a proven adjacent, unconditional mapping write. */
  postWriteExpressionLabel?: string;
  /** Mapping collections this key reads before any mutation in the source handler. */
  preWriteMappingCollections?: string[];
}

export interface EntryAccessInfo {
  collection: string;
  collectionSignature: string;  // for covenant hash computation
  keyParams: string[];          // kept for backward compat
  keySources: KeySourceInfo[];  // detailed source info per key
  operations: ('read' | 'write' | 'delete')[];
  /**
   * Shared function-local source-effect identities of mutations collapsed into this physical entry access.
   * This is not a reachability or terminality proof: conditional/loop occurrences require a separate schedule.
   */
  mutationEffectOrdinals?: number[];
  /** The collection stores a dynamic-array value in authenticated continuation chunks. */
  chunkableArrayValue?: true;
  slotIndex: number;
  // A pure-write mapping assign whose key varies per iteration of a RUNTIME loop (`for(i<n) m[k[i]]=v[i]`). It
  // has no fixed entry slot; the covenant emits a runtime-counter-indexed trailing entry output per iteration
  // (like the dynamic-chunk write) and the SDK derives the N (key,value) pairs. See emitLoopEntryWrite (GTT).
  inLoop?: boolean;
  // A WRITE slot on the same collection as a LATER delete of a different key (swap-remove's
  // `indexOf[lastKey]=v; delete indexOf[key]`). When the two keys alias at runtime the write is redundant
  // (the delete wins), and the single entry NFT can't be co-spent by both slots. Set to the delete slot's
  // index: the covenant gates this write off when its key == that slot's key, and the SDK funds it instead.
  aliasCondDeleteSlot?: number;
  // Message-bus runtime alias canonicalization: this conditional slot is inactive when its complete key equals
  // any earlier slot listed here; the handler invocation uses that earlier slot's journal cache instead.
  runtimeAliasPriorSlots?: number[];
  // Direct-convention compose-on-alias: earlier fixed batch writes of this collection whose key this write may share
  // at runtime. It is the alias row (predOut -2) iff its slot hash equals one of theirs; it still runs, reading the
  // entry's pending value, and the key's last write in source order pins the earliest such slot's output.
  composeAliasPriorSlots?: number[];
  // Direct-convention pure sorted read: when its own entry input holds no node of the collection, it proves its key
  // with this earlier slot's proof input (two slots needing one node). The SDK funds the read's own input.
  sharedProofPriorSlot?: number;
  // A sorted (vmap) mapping WRITE of an unbounded bytes/string value from a direct function parameter. The entry
  // commitment stores only len ++ sha256(value); the SDK persists the full value as chunks (P5b) using this
  // param's runtime argument. Undefined when the value is a computed expression (chunk persistence guarded off).
  valueParam?: string;
  // Canonical whole-value expression used by the SDK when it can be evaluated off-chain (notably literals).
  valueSource?: string;
  /** Whole-value replay and per-mutation reachability proof; does not imply linear handler control flow. */
  storedValueSource?: {
    version: 1;
    execution: 'unconditional-once';
    mutationEffectOrdinal: number;
    valueType: string;
    expression: ExternalCallExpression;
  };
  /**
   * Exact off-chain replay recipe for the element consumed by one chunkable sorted-array push. The recipe is
   * attached to the mutation's compiler-owned source-effect ordinal; omission means the push must not be
   * reconstructed from ABI type similarity.
   */
  storedElementSource?: {
    version: 1;
    mutationEffectOrdinal: number;
    elementType: string;
    expression: ExternalCallExpression;
  };
  /** Exact collection-array mutation represented by this access. */
  arrayMutation?: 'push' | 'pop' | 'indexed' | 'mixed';
  /**
   * Optional fixed entry-mutation activation recipe. Absent means the write is unconditional. When present, the
   * SDK evaluates it against authenticated row arguments and omits inactive write planning (including bands).
   * A framed write a branch guards publishes the condition it runs under (`framed/master/write-activation.ts`).
   */
  activation?: ExternalCallExpression;
}

export interface TokenContainerAccessInfo {
  keyParam: string;           // function parameter name used as category key
  // own = contract category, derived by covenant introspection; state = an immutable bytes32 state variable
  keySource?: 'param' | 'own' | 'state';
  keyStateVariable?: string;  // the immutable state variable a `state` key reads
  operations: ('read' | 'transfer' | 'transferNft')[];
  slotIndex: number;
  transferCount: number;      // number of transfer() calls for this category
  transferNftCount: number;   // number of transferNft() calls for this category
  readsOutput?: boolean;      // the body reads the output side of the amount (`this.outState.tokens[c]`)
}

// X29. Owner-local effect frames an message-bus batch route reserves on behalf of an effect-carrying graph emission handler
// it invokes behind OP_INVOKE. Dispatch site `s` owns `[base + s * width, base + s * width + width)` of each
// kind; the site ordinal rides to the shared subroutine as hidden context.
export interface GraphEffectFrame {
  sites: number;
  eventBase: number;
  eventWidth: number;
  eventOffset?: number;
  transferBase: number;
  transferWidth: number;
  transferOffset?: number;
  tokenTransferBase: number;
  tokenTransferWidth: number;
  tokenTransferOffset?: number;
  tokenNftTransfers: boolean;
  ecrecoverBase?: number;
  ecrecoverWidth?: number;
  ecrecoverOffset?: number;
  deployBase?: number;
  /** Output slots per selected row: one child master followed by its data NFTs. */
  deployWidth?: number;
  deployOffset?: number;
  /** Input-relative offset of the first row's vout-0 genesis input. */
  deployInputOffset?: number;
}

export interface CustomModifierInvocation {
  name: string;
  args: ExpressionNode[];
  location: Location;
}

/**
 * Lossless, typed source snapshot for a locally constructed mapping-key vector.
 *
 * This deliberately remains compiler-internal: a later descriptor lowering projects the replayable subset into
 * the SDK ABI. Keeping the complete source program here means that lowering/inlining cannot manufacture a
 * provenance proof after the fact. `sourceFunctionIdentity`, rather than a local variable spelling, is the
 * durable key shared by all physical route clones of the source function.
 */
export interface MessageBusConstructedKeyVectorProofProgram {
  version: 1;
  sourceFunctionIdentity: string;
  sourceFunctionSignature: string;
  sourceParameterTypes: string[];
  /** Ordinals of qualifying `new T[](n)` allocations in source preorder; never local identifiers. */
  candidateVectorOrdinals: number[];
  /** Detached typed source body, captured before symbolic-key lowering and helper inlining. */
  sourceProgram: BlockNode;
}

/**
 * Compiler-only execution coordinate.  It intentionally contains neither source spellings nor source locations:
 * statement paths give the source execution nesting and preorder gives a deterministic tie-breaker inside a
 * statement.  It is retained solely to bind a future journal witness protocol to the source program which was
 * actually analysed before lowering.
 */
export interface KernelJournalStreamExecutionCoordinate {
  readonly statementPath: readonly number[];
  readonly preorder: number;
}

/**
 * One exact locally-constructed-vector data-flow edge discovered before kernel admission.
 *
 * This is deliberately not an ABI and must never influence route selection.  In particular, it lets later
 * carrier work distinguish one allocation feeding one producer write and one mapping-key consumer from a
 * merely similar lowered array expression, without using a local variable name as an identity.
 */
export interface KernelJournalStreamPlanEdge {
  readonly allocationOrdinal: number;
  readonly allocation: KernelJournalStreamExecutionCoordinate;
  readonly producerLoop: KernelJournalStreamExecutionCoordinate;
  readonly producerWrite: KernelJournalStreamExecutionCoordinate;
  readonly consumerLoop: KernelJournalStreamExecutionCoordinate;
  readonly consumerWrite: KernelJournalStreamExecutionCoordinate;
  readonly consumerKeyComponent: number;
}

export interface KernelJournalStreamPlan {
  readonly version: 1;
  readonly edges: readonly KernelJournalStreamPlanEdge[];
}

/**
 * Immutable, compiler-private proof that source control/data flow contains one exact read-to-set carrier family.
 * Collection and parameter ordinals deliberately replace source spellings. The concrete class is frozen and is
 * therefore shared (rather than structurally recopied) by `cloneNode`, keeping one authority across route clones.
 */
export class KernelReadCarrierDiscoveryPlan {
  readonly version = 1 as const;

  constructor(
    readonly digest: string,
    readonly sourceCollectionOrdinal: number,
    readonly destinationCollectionOrdinals: readonly number[],
    readonly valueType: string,
    readonly keyArity: number,
    readonly executionCoordinate: readonly number[],
    /** Canonical JSON using parameter/counter roles, never identifiers. */
    readonly loopShape: string,
    /** Canonical JSON for the complete mapping-key tuple. */
    readonly keyShape: string,
  ) {
    Object.freeze(destinationCollectionOrdinals);
    Object.freeze(executionCoordinate);
    Object.freeze(this);
  }
}

/** Late, completed-ABI confirmation of a source-owned carrier discovery. Never serialized or used as capability. */
export class KernelReadCarrierAuthorization {
  readonly version = 1 as const;

  constructor(
    readonly digest: string,
    readonly discoveryDigest: string,
    readonly selectorHex: string,
    /** One digest per journal stream, ordered by its authenticated access-stream index. */
    readonly streamDescriptorDigests: readonly string[],
    readonly completedDescriptorDigest: string,
  ) {
    Object.freeze(streamDescriptorDigests);
    Object.freeze(this);
  }
}

/** Compiler-owned meaning of a parameter introduced while lowering a read-carrier loop. */
export type KernelReadCarrierSyntheticParameterRole =
  | 'counter-permutation'
  | 'old-values-witness';

export class FunctionDefinitionNode extends Node implements Named {
  /** Set only on compiler-synthesized helpers whose source/require maps may be rewritten by helper optimization. */
  compilerGeneratedHelper?: boolean;
  /** Exact source-level dense slice proof, captured before array/mapping lowering changes the body shape. */
  mappingArrayPagination?: NonNullable<AbiFunction['mappingArrayPagination']>;
  symbolTable?: SymbolTable;
  // Set by semantic analysis after visiting the body. Codegen can skip its more detailed deploy-site survey when
  // this is false; undefined remains the conservative value for compiler-synthesized functions created later.
  declare hasContractInstantiation?: boolean;
  // Set by EnsureFinalRequireTraversal on a direct entry point with no covenant of its own, whose early-return paths it
  // verifies. Only there does EarlyReturnTransformation seal an unguarded bare return (SEM-1).
  declare sealsUnguardedReturns?: boolean;
  opRolls: Map<string, IdentifierNode> = new Map();
  // Direct whole-state storage-pointer aliases erased by AstBuilder (`mapping storage p = m`,
  // `S storage p = s`). Retained as metadata so inline assembly can resolve p.slot/p.offset later.
  storagePointerAliases?: Record<string, string>;
  // Fixed foreign external-function aliases erased before Yul lowering. Their original member expression is
  // retained so assembly can still read the EVM `p.address` component without materializing a two-word local.
  externalPointerAliases?: Record<string, ExpressionNode>;
  // Fixed self external-function aliases retained after their source declaration is erased.
  selfExternalFunctionAliases?: Record<string, string>;
  requiredNftIndices?: number[];
  entryAccesses?: EntryAccessInfo[];
  /** Whether shared source-effect ordinals are complete for this straight-line handler. */
  sourceEffectOrder?: 'linear' | 'unsupported-flow';
  /** Compiler-owned message-bus handler mapping from its function-local entry
   * slot ordinals to the enclosing route's physical participant slots. */
  messageBusPhysicalEntrySlots?: number[];
  /** Route-slot projection for compiler-owned entry witness parameters. A lowered clone can intentionally own
   * no fixed entry slots while still forwarding the source handler's local witness ABI. */
  messageBusPhysicalEntryArgumentSlots?: number[];
  /** Fixed route-slot choices for each function-local entry. The first slot is messageBusPhysicalEntrySlots[i];
   * later slots are compiler-authenticated tuple alternatives, never maximum-row copies. */
  messageBusPhysicalEntrySlotAlternatives?: number[][];
  /** Route-wide dynamic resources which precede this outlined handler's trailing mapping entries. */
  messageBusRouteDynamicResources?: string[];
  /** Route-wide read-only chunk runs preserved before streamed effects; an empty list is authoritative. */
  messageBusRouteReadOnlyDynamicResources?: string[];
  /** Authenticated participant-master offset used by message-bus handler code generation. */
  messageBusOwnerInputOffset?: number;
  /** Kernel route whose selected upgrade rows may replace the participant master locking bytecode. */
  messageBusUpgradeRoute?: boolean;
  /**
   * Route synthesis pushed this clone's owner operand as the call's LAST argument, so at body entry it is the top
   * item (depth 0) and can be captured without depending on any frame-model position.
   */
  messageBusOwnerIsLastArgument?: boolean;
  /** Set on compiler-cloned message-bus handlers; identifies the source handler the clone was made from. */
  messageBusCloneSourceKey?: string;
  /**
   * Set on every compiler-cloned message-bus handler, whatever its name. The route owns the clone's collection
   * topology, so the clone's sorted records take the scalar path and carry no batch witnesses (ROUTE-SKIP-1).
   */
  ownRecordsScalarOnly?: boolean;
  /**
   * The message-bus route's declared input names, in push order. A route handler shares the caller's stack, so these
   * values are physically BELOW the handler's argument block; seeding them into the handler's frame model is what
   * makes a deep read address the item the runtime actually has there.
   */
  messageBusCallerBandNames?: string[];
  /**
   * This OP_DEFINE body captured its authenticated participant owner into the ALT STACK at entry.
   *
   * A DEFINE'd route handler shares the caller's stack, so the owner parameter's distance from the bottom depends
   * on what the caller leaves under the argument band - which the frame model does not know. The owner's distance
   * from the TOP is exact at entry (the caller pushes the argument vector last), so the value is read once there
   * and re-read from the alt stack, whose depth no main-stack push can shift.
   */
  messageBusOwnerAltAnchor?: boolean;
  /** The exact named-call closure can execute CHECKSIG/CHECKMULTISIG (excluding data signatures). */
  messageBusUsesTransactionSignature?: boolean;
  /** Direct scalar or one-dimensional signature-array parameters constrained to SIGHASH_ALL by the route. */
  messageBusAllOutputSignatureParameters?: number[];
  /** Exact OP_INVOKE signing body per detached root parameter and signature leaf. */
  messageBusSignatureCoveredFunctionKeys?: Record<number, Record<number, string>>;
  /** Compiler-owned row clone kept as a stable OP_INVOKE signing body on delegate routes. */
  messageBusDetachedSignatureHandler?: boolean;
  /** Stable KTS1 identity captured before journal lowering appends physical value-threading parameters. */
  messageBusSignatureIdentity?: string;
  /** Physical route entry slots whose transition covenant is emitted by a message-bus handler subroutine. */
  messageBusHandlerManagedEntrySlots?: number[];
  tokenContainerAccesses?: TokenContainerAccessInfo[];
  /** Number of statically allocated token-transfer output coordinates after branch alternatives share indices. */
  tokenContainerTransferSiteCount?: number;
  externalReads?: ExternalReadSlot[];
  externalCalls?: ExternalCallSlot[];
  externalOutStateReads?: ExternalOutStateSlot[];
  emitInfos?: EmitInfo[];
  /** Ordered fixed/repeated event segments lowered into the runtime trailing stream by a counter loop. */
  runtimeLoopEvents?: RuntimeLoopEventInfo[];
  /** Repeated BCH-transfer segments lowered into the runtime trailing stream by a counter loop. */
  runtimeLoopTransfers?: RuntimeLoopTransferInfo[];
  /** Worst-case trailing outputs across all lowered counter loops and their source-ordered fixed event peers.
   * Internal layout metadata; each loop independently admits at most 64 iterations. */
  runtimeCounterLoopOutputCapacity?: number;
  transferInfos?: TransferInfo[];
  deployTargets?: {
    contractName: string; dataNftCount: number; entryNftCount?: number;
    // Per child constructor argument: the deploy-function parameter name it forwards (a direct `new C(param)`
    // reference), or null if it is a non-trivial expression. Lets the SDK derive childConstructorArgs from the
    // deploy-function args instead of requiring them again.
    constructorArgs?: (string | null)[];
    // create2 salt (`new C{salt}()`): the forwarded param name, a hex literal, or computed (non-trivial -
    // SDK needs an explicit childSalt). Lets the SDK build the child Contract with the salt the covenant pins.
    salt?: { param: string } | { literal: string } | { computed: true };
    // Redeem-script body (hex) Instantiation embeds when computing the child P2SH address. Must match the
    // SDK's child Contract body exactly; a standalone child artifact can differ (referenced-compile size).
    creationBytecode?: string;
    // True when a same-transaction child call is folded into the authenticated child genesis.
    hasFoldedChildCall?: boolean;
    childLayoutDigest?: string;
    genesisState?: import('@solidcash/utils').ChildDeploymentGenesisStateAbi;
    genesisEntries?: readonly import('@solidcash/utils').ChildDeploymentGenesisEntryAbi[];
  }[];

  lowLevelCalls?: {
    callMode: 'call' | 'staticcall' | 'delegatecall';
    dataParamIndex?: number;
    occurrence?: 'once' | 'conditional' | 'loop';
    maximumOccurrences?: number;
    /** Serialized lexical predicates guarding a `conditional` callsite, in the external-call expression vocabulary. */
    condition?: ExternalCallExpression;
    // Solidity-compat call/staticcall sites: the target and payload as an opaque `__raw__` call serializes its
    // addressSource and payload argument, published so the SDK can co-spend the pinned callee.
    targetSource?: import('@solidcash/utils').ArgSource;
    dataSource?: import('@solidcash/utils').ArgSource;
  }[];

  // Delegate-library calls desugared from `L.f()` (SynthesizeLibraryDelegateCalls), in source order. The SDK
  // auto-wires the delegatecall co-spend from a registered library instance, so the caller need not name the
  // library function again. `args` are positional: a forwarded enclosing-function parameter or a literal; the
  // SDK resolves them and passes them to the library unlocker. See docs/library-contracts.md (3b auto-wire + args).
  libraryDelegateCalls?: { library: string; functionName: string; args: LibraryCallArg[] }[];
  collectionIterations?: CollectionIterationInfo[];
  // Dynamic-storage vars (string / unbounded bytes) read on-chain (not written here); recorded during codegen.
  // SDK co-spends their chunk UTXOs as read-only trailing inputs.
  dynamicReads?: string[];
  // Dynamic-storage vars written on-chain here; recorded during codegen. SDK consumes old chunks, creates new.
  // A function that only reads `.length` (or doesn't touch the var) must NOT appear, else its chunks are destroyed.
  dynamicWrites?: string[];
  // Collections written by a runtime loop (`for(i<n) m[k[i]]=v[i]`); recorded during codegen. SDK derives the N
  // (key,value) pairs from the VM trace and creates N trailing entry NFT outputs (emitLoopEntryWrite).
  entryLoopWrites?: string[];
  // Sorted (vmap) collections written by a diff-key INSERT loop (`for(i<n) m[k[i]]=v`); recorded during codegen. SDK
  // co-spends N bracketing predecessors + emits N (P', NEW) pairs from the evolving list (emitSortedInsertLoopBody).
  sortedInsertLoops?: string[];
  // Per-loop key/value derivation metadata (fixed key params + varying key array param + value) for the SDK.
  sortedInsertLoopInfo?: Array<{
    collection: string; fixedKeyParams: string[]; varyingArrayParam: string; valueParam?: string; valueBool?: boolean;
  }>;

  // Per-iteration vmap UPDATE loop `for(i) m[k[i]] += v[i]` (multitransfer credit to existing recipients): the SDK
  // co-spends each k[i]'s existing entry (SortedList.find) at input[master+blockSize+i] and mints its updated
  // commitment (value = oldValue op v, v for 'set', or the type default for 'delete') at output[master+blockSize+i].
  // op is '+', '-', 'set', or 'delete'. The per-iteration value v is one of: valueArrayParam (per-key vs[i]),
  // valueScalarParam (a loop-INVARIANT param, e.g. `+= amount` fixed-amount airdrop), or valueConst (an int literal).
  sortedUpsertLoopInfo?: Array<{
    collection: string; collectionHash: string; journalAccessStreamIndex: number; journalExecutionGroup: number;
    settlementIdentity: JournalSettlementIdentityAbi;
    fixedKeyParams: string[]; varyingArrayParam: string;
    fixedKeySources?: KeySourceInfo[];
    /** Composite-key positions populated from the same varying array element. Omitted for the usual final key. */
    varyingKeyIndices?: number[];
    /** Original complete key tuple, serialized for SDK reconstruction when components derive from the counter. */
    varyingKeyExpressions?: ExpressionNode[];
    /** The key recipe replays a historical constructed-array resize without an authenticated prefix identity. */
    constructedKeyReplay?: boolean;
    /** The key recipe selects among more than two branch-merged constructed-array definitions. */
    multiArmConstructedKeyReplay?: boolean;
    /** The key recipe consumes a mutable helper array whose history reads a distinct mutable array identity. */
    crossArrayKeyReplay?: boolean;
    /** The key recipe replays a forwarded array mutated by a nested helper which also returns a value. */
    nestedHelperReturnReplay?: boolean;
    /** The write predicate consumes a mutable local assigned earlier in the same logical iteration. */
    sameIterationMutableSelectionReplay?: boolean;
    keyDecodeTupleIndex?: number; keyDecodeTupleTypes?: string[];
    predicateArrayParam?: string; predicateEquals?: string;
    valueArrayParam?: string; valueScalarParam?: string; valueConst?: string;
    valueRuntimeLocal?: string;
    valueRuntimeExpression?: boolean;
    /** A turn reads the entry the loop writes (besides a read-modify-write base), so a repeated key cannot merge. */
    readsWrittenEntry?: boolean;
    /** The loop body has a per-turn effect besides this write (event, require, another write), so no repeat can merge. */
    siblingEffect?: boolean;
    /** Source-ordered values for a loop-carried expression, authenticated in the executable source loop. */
    valueTraceWitnessParam?: string;
    valueTraceLocal?: string;
    valueTraceInitial?: ExpressionNode;
    valueTraceUpdates?: Array<{ condition?: ExpressionNode; expression: ExpressionNode }>;
    valueTraceAfterUpdates?: Array<{ condition?: ExpressionNode; expression: ExpressionNode }>;
    /** Authenticated prefix-boundary counts (N+1 values) used by a constructed-array key recurrence. */
    prefixCountWitnessParam?: string;
    prefixCountCondition?: ExpressionNode;
    valueArrayOffset?: string;
    mutation?: 'push' | 'pop' | 'setAt';
    mutationValueArrayParam?: string; mutationValueScalarParam?: string; mutationValueConst?: string;
    mutationValueArrayIndexParam?: string;
    mutationValueExpression?: ExpressionNode;
    mutationIndexArrayParam?: string; mutationIndexScalarParam?: string; mutationIndexConst?: string;
    mutationIndexArrayIndexParam?: string;
    mutationIndexExpression?: ExpressionNode;
    oldValuesWitnessParam?: string;

    /** Compiler-owned exact physical widths for this independently sorted runtime stream. */
    inputCountParam?: string;
    outputCountParam?: string;

    /** Source-path predicate for a conditionally reached runtime loop. */
    condition?: ExpressionNode;
    /** Per-source-iteration predicate selecting the exact logical mapping-write domain. */
    iterationCondition?: ExpressionNode;
    /** Per-source-iteration predicate terminating the source loop after this iteration. */
    iterationBreakCondition?: ExpressionNode;
    /** Expanded public-argument expression computing a non-affine loop bound. */
    iterationBound?: ExpressionNode;
    /** The source condition is `counter != bound`, so the signed step must reach the endpoint exactly. */
    iterationExactBound?: boolean;
    iterationCounter?: {
      name: string; initialValue: bigint; stepValue: bigint; stepExpression?: ExpressionNode;
      exactBound?: boolean;
    };
    op: '+' | '-' | 'set' | 'delete' | 'read';
  }>;

  /** Source-path predicate keyed by the compiler-owned counter permutation parameter. */
  runtimeCounterLoopConditions?: Map<string, ExpressionNode>;
  /** Per-iteration selection predicate keyed by compiler-owned counter permutation parameter. */
  runtimeCounterLoopIterationConditions?: Map<string, {
    expression: ExpressionNode;
    breakCondition?: ExpressionNode;
    counter: { name: string; initialValue: bigint; stepValue: bigint; stepExpression?: ExpressionNode };
  }>;

  /** Inverse permutation for compact selected streams, keyed by their physical permutation parameter. */
  runtimeCounterLoopSourceOrderIndices?: Map<string, string>;

  /** Expanded public-argument expression which computes a non-affine counter-loop bound. */
  runtimeCounterLoopBounds?: Map<string, ExpressionNode>;
  /** Original key tuples keyed by `<permutation>\0<collection>`, before physical-loop rewriting. */
  runtimeCounterLoopKeyExpressions?: Map<string, ExpressionNode[]>;
  /** Key recipes which replay historical constructed-array resizes without authenticated prefix identities. */
  runtimeCounterLoopConstructedKeyReplays?: Set<string>;
  /** Key recipes selecting among more than two branch-merged constructed-array definitions. */
  runtimeCounterLoopMultiArmConstructedKeyReplays?: Set<string>;
  /** Key recipes fed by a mutable helper array history which reads a distinct mutable array identity. */
  runtimeCounterLoopCrossArrayKeyReplays?: Set<string>;
  /** Key recipes fed by a forwarded array mutation from a nested helper which also returns a value. */
  runtimeCounterLoopNestedHelperReturnReplays?: Set<string>;
  /** Permutation parameters whose selection predicate replays a same-iteration mutable local. */
  runtimeCounterLoopSameIterationSelectionReplays?: Set<string>;
  /** Constructed-array prefix-count trace keyed by `<permutation>\0<collection>`. */
  runtimeCounterLoopPrefixCountTraces?: Map<string, {
    witnessParam: string;
    condition: ExpressionNode;
  }>;

  /** Source counter descriptor keyed by compiler-owned permutation parameter. */
  runtimeCounterLoopCounters?: Map<string, {
    name: string; initialValue: bigint; stepValue: bigint; stepExpression?: ExpressionNode;
    exactBound?: boolean;
    /** Visible source-parameter ordinal supplying the canonical loop bound, when direct. */
    boundParameterOrdinal?: number;
  }>;

  /** Physical stream widths keyed by the compiler-owned permutation parameter. */
  runtimeCounterLoopCardinalityParams?: Map<string, { input: string; output: string }>;

  /** A locally constructed key array has a loop-carried resize/read schedule the bounded replay pass cannot
   * represent. Kernel admission refuses only this handler rather than letting later route synthesis fail. */
  messageBusUnboundedConstructedArray?: boolean;
  /** Pre-admission saw the narrow local-vector shape; final kernel admission still requires emitted provenance. */
  messageBusConstructedKeyVectorCandidate?: boolean;
  /**
   * Normalized compiler-owned vector proof programs ready for artifact publication. Raw AST provenance is never
   * serialized here: an unsupported expression leaves this absent and preserves the KERNEL_LAYOUT fence.
   */
  messageBusConstructedKeyVectorDescriptors?: readonly ConstructedKeyVectorV1Abi[];
  /** Stable source-level identity used to attach pre-lowering constructed-key proof programs. */
  messageBusSourceFunctionIdentity?: string;
  /** Source snapshots indexed exclusively by stable source-function identity. */
  messageBusConstructedKeyVectorProofPrograms?: Map<string, MessageBusConstructedKeyVectorProofProgram>;
  /** Internal pre-admission source-flow plan. Never serialized and never an admission capability. */
  messageBusKernelJournalStreamPlan?: KernelJournalStreamPlan;
  /** Immutable first-pass read-carrier discovery; source names and locations never cross into this record. */
  messageBusKernelReadCarrierDiscovery?: KernelReadCarrierDiscoveryPlan;
  /** Exact source ABI arity captured before any physical/compiler-owned operands are appended. */
  messageBusKernelReadCarrierSourceParameterCount?: number;
  /** Explicit roles for carrier operands. Authorization never infers authority from reserved-name prefixes. */
  messageBusKernelReadCarrierSyntheticParameterRoles?: Map<string, KernelReadCarrierSyntheticParameterRole>;
  /** Completed-descriptor validation of the discovery. Still compiler-private while the release gate is false. */
  messageBusKernelReadCarrierAuthorization?: KernelReadCarrierAuthorization;
  /**
   * Stable source selector carried by compiler-generated physical clones. This is compiler-private identity:
   * clone names and locations are never authorization, and the value is useful only beside the binder's exact
   * completed-descriptor scope.
   */
  messageBusKernelReadCarrierSourceSelectorHex?: string;
  /** Stable selector carried by every generated kernel handler clone for disposition authorization. */
  messageBusKernelJournalDispositionSelectorHex?: string;
  /** Exact completed-descriptor families owned by this generated aggregate route. Compiler-private. */
  messageBusKernelReadCarrierRouteScopes?: readonly {
    selectorHex: string;
    completedDescriptorDigest: string;
    streamDescriptorDigests: readonly string[];
  }[];

  /** Ordered compiler-private disposition manifest owned by this generated aggregate route. */
  messageBusKernelJournalDispositions?: readonly {
    selectorHex: string;
    completedDescriptorDigest: string;
    mode: 'carrier' | 'eager-journal' | 'neutral';
    streams: readonly {
      journalAccessStreamIndex: number;
      descriptorDigest: string;
      disposition: 'carrier' | 'eager-journal' | 'neutral';
    }[];
  }[];

  /** Digest emitted only by the authenticated aggregate route as the SCJD v1 bytecode marker. */
  messageBusKernelJournalDispositionCommitmentDigest?: string;

  /** Names-free affine recursive mapping-frame proof; metadata only, never an admission capability. */
  messageBusAffineRecursiveFrameDescriptors?: readonly AffineRecursiveFrameV1Abi[];
  /** Idempotence marker for the pre-admission constructed-array replay normalization. */
  messageBusConstructedArrayKeysNormalized?: boolean;

  // Fixed straight-line vmap writes grouped into one atomic list transition. Slot indices refer to entryAccesses.
  sortedBatchInfo?: Array<{ collection: string; slotIndices: number[]; linear?: boolean }>;
  // Function parameters whose value feeds blockhash(n); recorded during codegen. SDK reads the arg to resolve
  // addr(n) and co-spend the (n->hash) oracle UTXO as a trailing input (mirrors dynamicReads auto-injection).
  blockhashReads?: string[];
  // Set by SynthesizeBlockOracle when the function reads blockhash(n); SymbolTable then injects the hidden
  // __internal__blockhashInputIndex param (the co-spend's input index) so the read survives composition.
  usesBlockhash?: boolean;
  // Set when the body reads the block-info oracle commitment. SymbolTable injects the co-spend index.
  usesBlockOracle?: boolean;
  // Set by LowerInlineAssembly when this function's body contained an inline `assembly {}` block (before the
  // block was lowered away). PruneUnreachableFreeFunctions uses it to drop DEAD assembly helpers whose EVM
  // primitives may not codegen on BCH, even after the assembly lowered to plain ops (e.g. OZ Math.mulDiv).
  hadInlineAssembly?: boolean;
  // Parse-shape proof that a Solidity <0.8 compatibility helper implements exactly one checked bounded
  // arithmetic operation (or narrowing cast). Split-facet codegen may replace the wrapper with the native
  // SolidCash operation, whose bounds check has the same success/failure behavior.
  nativeCheckedMath?: '+' | '-' | '*' | 'cast';
  // A helper proven at parse time to return a specific `this.method` external pointer. Consumers may preserve
  // the helper call's side effects while replacing pointer metadata reads with that method's declaration data.
  returnedSelfFunctionName?: string;
  // Per-result form of returnedSelfFunctionName. An entry exists only when every reachable explicit return fixes
  // that external-function result slot to the same `this.method`; absent slots retain their ordinary ABI type.
  returnedSelfFunctionNames?: Array<string | undefined>;
  // Complete finite direct-self target set for each external-function result. Multiple entries mean source
  // control flow selects among immutable local function IDs; no foreign address or caller pointer is admitted.
  returnedSelfFunctionTargetSets?: Array<string[] | undefined>;
  // Distinct identifier-arg blockhash(n) reads in the function (counted by SynthesizeBlockOracle before
  // codegen). Each rides its OWN consecutive blockhashOracle block-layout slot; the k-th read reads
  // input[base + k]. SymbolTable allocates this many slots (min 1 when usesBlockhash).
  blockhashSlotCount?: number;
  modifiers: FunctionModifier[] = [];
  // Solidity-compat proxy implementations must compile view/pure functions with delegate layout, which removes
  // those modifiers from the physical handler. Retain the source-level read-only promise for ABI/SDK dispatch.
  sourceReadOnly?: boolean;
  customModifiers: CustomModifierInvocation[] = [];
  // Number of base-constructor evaluation/body statements prepended during inheritance expansion. Solidity runs
  // these before evaluating the derived constructor's modifier arguments.
  constructorPreludeLength = 0;
  returnTypes: Type[] = [];
  // Data-location annotations parallel to returnTypes. Retained for semantic validation and source fidelity;
  // unlike ABI types, storage/memory/calldata affect whether a source declaration is legal.
  returnModifiers: string[][] = [];
  returnNames: string[] = []; // named returns (empty unless all return values are named)
  functionId?: number;
  functionSelector?: Uint8Array;  // 4-byte hash selector for entry-point functions
  // Compiler-owned: this physical wrapper/subroutine participates in the scalar write-back journal.
  scalarJournal?: boolean;
  /** Number of compiler-owned value-threaded state context items accepted
   * and returned by this reusable handler. Excluded from the source ABI. */
  journalContextArity?: number;
  // Compiler-owned: this entry's reachable scalar-handler call graph contains
  // a direct or mutual recursion cycle and requires SDK VM preflight.
  scalarJournalRecursive?: boolean;
  /** A recursive varying-key mapping read or write which no authenticated affine stream claimed. Kernel
   * admission must retain this marker across speculative clones and refuse the generic tail-loop representation.
   * The name still says read; a write-only shape sets it too, because that loop also has no per-frame key witness. */
  unloweredVaryingRecursiveMappingRead?: boolean;
  /** An indirect internal call may reach a journal-context ABI without a statically complete target set. The
   * kernel must refuse that handler rather than invoke a context-bearing OP_DEFINE with the source-only frame. */
  kernelJournalContextUnsafeCall?: boolean;
  /** A source entry reaches an internal effect helper which closes over a contract constructor parameter.
   * External-call lowering appends a physical settlement frame to that helper, but the constructor-captured
   * value has no source-row slot from which that frame can be rebuilt. Kernel admission records this before
   * graph lowering so the handler remains a deterministic KERNEL_LAYOUT refusal rather than reaching type/codegen
   * with a source-arity helper call. */
  kernelConstructorCapturedHelperGraphEffect?: boolean;
  // Release 3: helper was lowered to a value-threaded collection journal.
  collectionJournal?: boolean;
  /** Compiler-owned batch clone: journal it through the wrapper's shared entry pool even when it touches a
   * single entry, so sibling handlers over the same entry resolve to one pending value and one vmap slot. */
  forceCollectionJournalPool?: boolean;
  /** Compiler-owned pooled helper whose independently keyed entries can each alias an earlier route row.
   * LowerCollectionJournalHelpers selects and updates those physical caches at runtime without expanding the
   * dispatcher's branches into their Cartesian product. */
  collectionJournalRuntimeAliases?: boolean;
  /** Pooled kernel key lanes chosen at one handler call. The decoded row argument is matched to these lane
   * witnesses with a linear compare, instead of cloning the handler for every combination of pools. */
  collectionJournalLinearKeyPools?: Array<{ argumentName: string; lanes: string[] }>;
  // Compiler-only message-bus batch physical route; dispatched on the reserved selector but
  // omitted from the source ABI.
  messageBusRoute?: boolean;
  /** Bound route: the participant verifier's lock, the one the route's verifier binder requires. */
  messageBusVerifierLock?: Uint8Array;
  /**
   * Bound non-graph route: the route-local 0/1 flags a selector branch sets for the records its handler may rewrite
   * inside the participant block (every one, the trailing band, or one collection's entry slots). Empty when no
   * handler claims any; absent where the C3 record pin keeps the whole block to the census.
   */
  messageBusRecordClaims?: ReadonlyArray<{ flag: string; all?: true; trailing?: true; collection?: string }>;
  /** Resolved route dispatch. Stamped at synthesis; published as `artifact.messageBus.convention`. */
  messageBusDispatch?: 'legacy-unroll' | 'kernel-row-loop';
  messageBusMaximumRows?: number;
  /** Compiler-owned message-bus batch blockhash band. Each logical row owns `readWidth` consecutive oracle slots. */
  messageBusBlockhashReadWidth?: number;
  messageBusBlockhashReads?: {
    row: number; selector: string; readOrdinal: number; readKey: string; slotOffset: number;
  }[];

  messageBusEligible?: boolean;
  messageBusRejectionReason?: string;
  /** Kernel route: this handler's emits settle as records on its runtime effect stream, not in event windows. */
  messageBusEventStream?: true;
  /** A stream emit can pass one commitment, so every record of the stream is chunked (head, then continuations). */
  messageBusEventStreamChunked?: true;
  /** Stable index of this eligible handler in the route's eligible dispatch set, the ordinal witness names use.
   * Published on the handler so the SDK never re-derives the filtered-list ordering. */
  messageBusWitnessOrdinal?: number;
  /** This source handler was included in the synthesized route dispatch. Late fences may still demote it. */
  messageBusDispatched?: boolean;
  /** This handler owns one direct chunkable whole-entry transition family (unconditional and/or bool-param
   * activated). The generated participant route authenticates that at most one row from the complete marked
   * selector family executes, so its body is the unique terminal continuation producer. This is an occurrence
   * bound, not permission to chain mutations unless completed lowering additionally proves route pooling. */
  messageBusFixedChunkableWriteMaxRows?: 1;
  /** Completed collection-journal lowering proved every access to these resources shares the route cache. */
  messageBusPooledChunkableWrite?: true;
  /** Exact mutation identity in the selector-scoped fixed-chunkable occurrence domain. */
  messageBusFixedChunkableWriteEffectOrdinal?: number;
  /** Per-resource fixed-chunkable descriptors, including optional bool-param activation recipes. */
  messageBusFixedChunkableResources?: Array<{
    collection: string;
    effectOrdinal: number;
    activation?: ExternalCallExpression;
  }>;

  /** This handler owns one direct push into a chunkable sorted mapping-array entry (unconditional and/or
   * bool-param activated with empty else). Kernel route lowering threads the typed pending array through every
   * selected OP_INVOKE row and flushes it exactly once, so repeated same-key rows compose without intermediate
   * continuation outputs. */
  messageBusPooledChunkableArrayPush?: true;
  /** Optional bool-param activation for the pooled chunkable array push (path-effect activation fold schedule publish). */
  messageBusPooledChunkableArrayPushActivation?: ExternalCallExpression;
  /** Mutation effect ordinal for the pooled chunkable array push when activation is published. */
  messageBusPooledChunkableArrayPushEffectOrdinal?: number;
  // Release 4 collection rows bind source argument positions to hidden
  // physical-route key witnesses. The SDK derives these from canonical rows;
  // the route compares decoded row arguments before any handler executes.
  messageBusKeyWitnesses?: {
    routeInput: string;
    inputIndex: number;
    source?: 'argument' | 'msgSender' | 'expression';
    expressionLabel?: string;
    perRow?: boolean;
    /** This key and its `_row` sibling may exchange the shared/row-local physical entry for this invocation. */
    swappable?: boolean;
    /** Opaque compiler identity shared by every component of one fixed collection-key tuple. */
    entryTupleGroup?: number;
    /** Component ordinal within entryTupleGroup; prevents independently mixing nested-mapping coordinates. */
    keyComponentIndex?: number;
    /** The same tuple component in the route's one fixed alternate physical lane. */
    alternateRouteInput?: string;
    /** Fixed physical key pool, selected by complete tuple identity when entryTupleGroup is present. */
    keyPool?: string[];
  }[];

  /** Canonical Solidity `batch(bytes[],bool)` executed through BCH's ordered local message-bus journal. */
  nativeSelfBatchDispatcher?: boolean;

  /** Codegen: this entry's return carrier is the record of the direct call it answers. */
  settlesCallRecord?: boolean;

  isFreeFunction: boolean = false;
  // True for a function declared inside a Solidity library, including the lowered primary-library contract
  // form. Library ABI rules uniquely permit storage-reference parameters and returns at public/external
  // visibility, so this cannot be inferred from isFreeFunction alone.
  isLibraryFunction: boolean = false;
  pinsDelegateCoSpend: boolean = false; // C1/piece-3: delegatecall pins UTXOBYTECODE[delegateInputIndex] == impl
  /**
   * C1/piece-7: the pin's delegate input index is DERIVED from this function's own block layout (the reserved
   * `lowLevelCall` slot) instead of the caller-supplied `__internal__delegateInputIndex` witness. Used by the
   * compiler-synthesized delegatecall forms - `L.f()` library sugar and split-facet forwarders - which carry no
   * witness parameter. Derivation is also the stronger source: nothing caller-supplied selects the input.
   */
  delegateIndexFromBlockSlot: boolean = false;
  // C1/piece-5: the delegatecall sits on a conditional path, so the co-spend pin is not reached on every path
  // while the state-covenant skip (!functionHasDelegatecall) is per-function. Codegen compensates with a
  // runtime "delegate reached" flag; see emitConditionalDelegateStatePreservation.
  delegatecallIsConditional: boolean = false;
  /** Compiler-owned split-root forwarder whose mutating facet owns the published return-event output. */
  splitDelegateReturnForwarder: boolean = false;
  /** Physical implementation-relative event offsets published by the selected split facet. Delegate-only data
   * NFT slots are already removed, so the root's immutable-event pin and the facet covenant name one output. */
  splitDelegateEventOffsets?: number[];
  /** Exact signatures of collections whose split facet authenticates complete input and output cardinality.
   * The root excludes only these addresses from its otherwise-strict mutable-NFT conservation. */
  splitDelegateCensusedCollectionSignatures?: string[];
  /** Block-local delegate covenants reserved by an message-bus batch graph clone/route. */
  graphDelegateSlotCount?: number;
  isFallback: boolean = false;
  isReceive: boolean = false;
  isAbstract: boolean = false;
  inheritedFrom?: string;
  // Contract names through which this function may explicitly qualify a modifier (`A.m`). Captured from the
  // function's declaring contract before inheritance flattening so a later sibling base cannot become visible.
  allowedModifierQualifiers?: string[];
  // The contract that defined this function body, set during inheritance flattening. Used to resolve
  // `super.f()` relative to the right point in the linearization.
  definingContract?: string;
  // Base contracts named in an explicit `override(A, B)` specifier (empty for a bare `override`).
  overrideBases: string[] = [];
  // Declared under a pre-0.5 Solidity pragma: overrides a base function without the (then absent) `override`.
  implicitOverride?: boolean;
  usesMsgSender?: boolean;
  /** This function or a named internal callee reads msg.data. */
  usesMsgData?: boolean;
  usesMsgValue?: boolean;
  /**
   * Compiler-owned message-bus batch clone whose one supported tail external call is verified against the authenticated
   * participant emission frame instead of performing ordinary physical-call settlement.
   */
  graphEmissionHandler?: boolean;
  /** This graph handler owns the admitted raw-call `{ value: ... }` edge. */
  graphRawCallValueEffect?: boolean;
  /** This function, or a named internal callee, reads chunk-backed dynamic state. Its first physical chunk input
   * is supplied as an authenticated transaction coordinate because compact delegate layouts need not preserve
   * the function's maximum block width. */
  usesDynamicChunkInputBase?: boolean;
  /** Per-call: the value-witness slots the body reads, recorded when the head takes over their parameters. */
  framedValueWitnessSlots?: number;
  /** Graph handler whose conditional/loop calls consume the authenticated emission vector at runtime. */
  graphRuntimeEmissionHandler?: boolean;
  /** Runtime emission vector is returned and threaded across this route's repeated local rows. */
  graphRuntimeEmissionThreaded?: boolean;
  // X29. Effect frame this graph emission handler owns in the ROUTE's block; also set on the route itself.
  // Assigned by the route's layout computation, the only place both are visible. See GraphEffectFrame.
  graphEffectFrame?: GraphEffectFrame;
  /**
   * SEC-8. Does THIS handler's subroutine settle the co-spent satoshi container?
   *
   * `graphEffectFrame` is ONE object shared by every framed handler, so its `transferWidth` is the group
   * maximum and says nothing about the handler reached at a given dispatch site. The route's not-reached
   * container preservation is skipped on the strength of a reached flag, so that flag must be written from a
   * PER-HANDLER fact - otherwise an emit-only sibling suppresses a guard it never replaces and the co-spent
   * container gets no identity check and no value check. Set only where frame membership is decided.
   */
  graphEffectSettlesTransfers?: boolean;
  usedLibraries?: string[];     // external libraries this function calls (e.g. ['keccak256']) -> load each
  inlinedLibraries?: string[];  // subset of usedLibraries inlined into the contract bytecode (no side-car)
  libraryCallCounts?: Map<string, number>; // per-library call-site count (drives the inline decision)
  keccakCompute?: boolean;      // keccak256 uses the compute-and-commit result-NFT model (side-car computes it)
  keccakPreimageParams?: (string | null)[]; // per keccak256 call (codegen emission order): the param feeding it
  // (SDK transparent co-spend); null = not a direct param
  /** Source-site keys in exactly the order emitKeccakComputeCall reserved its ordinals. Compiler-internal. */
  keccakComputeSites?: string[];
  keccakInLoop?: boolean;       // a keccak256 call is inside a loop -> runtime count exceeds the static count;
  // the SDK should foresee extra side-car strain (deploy more than the syntactic count)
  /**
   * keccakInLoop only: the emission index (emitKeccakComputeCall's `i`, pre-order) of each keccak256 call outside
   * every loop. Each reserves one unbatched fixed keccakSideCar slot with that slotIndex.
   */
  keccakFixedSlotIndices?: number[];
  keccakLoopReads?: boolean;    // a stateful dynamic keccak loop reads N trailing side-cars (SDK progressively
  // co-spends N = runtime iteration count into the trailing region [blockSize, ..))
  keccakLoopPrecedesTrailingUser?: boolean; // a direct keccak loop runs BEFORE a runtime mapping loop in source
  // order, so its side-cars occupy the front of the shared trailing band
  keccakChainReads?: boolean;   // a direct, unbounded preimage routes through the chained START/CONT/FINAL side-cars
  // in the trailing region; the SDK co-spends one side-car per 136-byte block + the FINAL digest carrier
  ecrecoverLoopReads?: boolean; // a dynamic ecrecoverPubKey loop reads one recovery TRIPLE per iteration from the
  // forward region [master+1+3k]; the SDK co-spends N triples (N = the sig-array length)
  ecrecoverCompute?: boolean;   // ecrecoverPubKey uses a co-spent recovery side-car PAIR (A+B) per call; the SDK
  // auto-co-spends them and the contract reads the recovered pubkey from B's output
  ecrecoverArgParams?: ((string | null)[])[]; // per ecrecoverPubKey call (codegen emission order): the [hash,v,r,s]
  // param names feeding it (SDK transparent co-spend); null entry = not a direct param
  ecrecoverCallCount?: number;  // number of ecrecoverPubKey calls (stateless count-relative side-car indexing)
  /** Exact number of formal recovery effects in this function's expanded named-call closure. Unlike the
   * codegen-local ecrecoverArgParams length, repeated invocations of one helper each contribute their own
   * concrete effect. Used to thread authenticated side-car coordinates through OP_INVOKE. */
  recoveryEffectCount?: number;
  ecrecoverEvmCallCount?: number; // number of ecrecoverEvm calls; each ALSO co-spends a keccak side-car (over the
  // uncompressed key), appended after all recovery pairs (shifts recovery offsets by E)
  ecrecoverEvmFlags?: boolean[]; // per ecrecover call (emission order): is it the evm projection? (SDK keccak co-spend)
  // Exact transitive recovery order for an entry point. Codegen-local ecrecoverEvmFlags is reset while emitting
  // outlined helpers, so this closure copy remains available to artifact/SDK resource planning.
  ecrecoverClosureEvmFlags?: boolean[];
  unsafeTier?: number;          // 0, 1, or 2 (only set when UNSAFE modifier present)
  impliedSelfdestruct = false;  // body-level selfdestruct(...) inferred the lifecycle modifier
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
    if (this.modifiers.includes(FunctionModifier.PRIVATE)) return 'private';
    if (this.modifiers.includes(FunctionModifier.EXTERNAL)) return 'external';
    return 'public'; // explicit `public` or no specifier -> public (default, as in Solidity)
  }

  get isEntryPoint(): boolean {
    if (this.isFreeFunction) return false;
    if (this.isFallback || this.isReceive) return true;
    // The deploy runs the constructor as its entry point whatever its visibility: `constructor () internal` only
    // marks a Solidity 0.6 contract abstract, and still needs the transaction block layout a public one gets.
    if (this.name === '__construct') return true;
    const v = this.visibility;
    return v === 'external' || v === 'public';
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitFunctionDefinition(this);
  }
}

export class ParameterNode extends Node implements Named, Typed {
  // Set for a synthesized param that is used by generated covenant code or the SDK rather than by an AST
  // reference (a delegate-library forwarded arg `L.f(x)`, or a branded library's `__brand` ctor arg). The
  // unused-variable warning must skip it.
  syntheticallyUsed = false;
  /**
   * Physical kernel-journal context copied from a callee solely to keep an internal OP_INVOKE chain's frame
   * uniform. This operand belongs to the generated route, not to the source entry point's published ABI.
   */
  kernelJournalForwardedContext = false;

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
  // Solidity `transient` (EIP-1153): a transaction-scoped state var. BCH has no transaction-scoped contract
  // storage, and one spend = one function execution (no cross-call), so it lowers to a per-function zero-init
  // local (the AstBuilder removes it from the state layout). See docs/solidity-import-compat.md.
  isTransient: boolean = false;
  // Dynamic-storage var (string / unbounded bytes): the data-NFT field holds a uint32 length header
  // (<name>$len) and the value lives in chunk UTXOs. See docs/dynamic-storage.md.
  isDynamic: boolean = false;
  // Compiler-generated security registers may require a stable, dedicated commitment without adopting the
  // user-facing `external` storage semantics.
  isolatedNft: boolean = false;
  initializer?: ExpressionNode; // inline `= expr` init, lowered into the constructor by the AstBuilder
  // Side effects of a right-associative inline initializer (`T x = y = value`). These execute immediately
  // before the outer `x = y` initialization when the declaration is lowered into the constructor.
  initializerPrelude: StatementNode[] = [];
  contractTypeName?: string;
  nftIndex: number = 0;
  fieldIndex: number = 0;
  visibility: StateVariableVisibility = StateVariableVisibility.PUBLIC;
  visibilityExplicit: boolean = false;
  inheritedFrom?: string;
  isOverride: boolean = false;
  overrideBases: string[] = [];

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

export abstract class StatementNode extends Node {
  /** Compiler-generated occurrence counter/guard; only completed route-journal lowering may discharge it. */
  messageBusFixedChunkableWriteGuard?: string;
  /** Base contract that wrote this statement when its constructor is inlined into a derived one (`super` scope). */
  baseConstructorOf?: string;
  /** A top-level statement of the read-modify-write whose keys carry this `LvalueKeyTag.unit` (BindLvalueKeyEffects). */
  lvalueKeyUnit?: number;
  /** A dropped storage-pointer declaration kept in place with its own key builds (BindLvalueKeyEffects). */
  lvalueKeyAlias?: ExpressionNode[];
}

/** One build of a read-modify-write's key: the write (`unit`), the key position (`index`) and the key's type. */
export interface LvalueKeyTag {
  unit: number;
  index: number;
  type: Type;
  /** A storage-pointer or slot-factory alias declaration's key, re-read by every use and bound at the declaration. */
  alias?: boolean;
}

/** A base constructor's own modifiers, expanded with the most-derived (virtual) modifier definitions. */
export interface PendingConstructorModifiers {
  invocations: CustomModifierInvocation[];
  location: Location;
  qualifiers?: string[];
}

export class StateAssignNode extends StatementNode {
  stateVariable?: StateVariableNode;
  qualifiedBaseAccess?: boolean;
  // Set when this access comes from an inlined modifier body: the contract that DEFINED the modifier. A private
  // var is accessible from code written in its own contract even after that code is inlined into a derived one.
  fromModifier?: string;

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

/** Whether a type chain reaches a mapping, through arrays and struct fields. A mapping has no encodable value,
 * so a mapping-bearing chain can only be addressed as a key path, never stored as one entry value. */
function chainContainsMapping(type: Type, seen: Set<string> = new Set()): boolean {
  if (type instanceof MappingType) return true;
  if (type instanceof ArrayType) return chainContainsMapping(type.elementType, seen);
  return false;
}

export class CollectionNode extends Node implements Named {
  immutable: boolean = false;
  // Verified mapping (vmap) backend: entries form a sorted list keyed by H(key), so non-existence is authenticated
  // by co-spending the bracketing predecessor. This is mandatory for every mapping.
  sorted: boolean = false;
  // `enumerable mapping(...)`: the mapping may be iterated (`for..of`/`for..in`). A plain `mapping` is NOT
  // enumerable (Solidity parity - mappings are not iterable in Solidity). Only marks intent; arrays are always
  // enumerable. See docs/evm-storage-parity.md.
  enumerable: boolean = false;
  visibility: StateVariableVisibility = StateVariableVisibility.PUBLIC;
  visibilityExplicit: boolean = false;
  inheritedFrom?: string;
  isOverride: boolean = false;
  overrideBases: string[] = [];

  constructor(
    public type: MappingType | ArrayType,
    public name: string,
  ) {
    super();
  }

  get keyType(): Type {
    if (this.type instanceof ArrayType) return PrimitiveType.BIGINT;
    return this.type.keyType;
  }

  get valueType(): Type {
    if (this.type instanceof ArrayType) return this.type.elementType;
    return this.type.valueType;
  }

  /** Recursively collect the complete key path through nested mappings and array dimensions. */
  get allKeyTypes(): Type[] {
    const keys: Type[] = [];
    let current: Type = this.type;
    // A mapping whose VALUE is an array stores that array as the entry value blob; its trailing indices are
    // handled by MappingAccess.arrayIndex / the nested-array RMW lowering, not as collection keys - unless the
    // element chain contains a mapping, which has no encodable value, and then the indices DO join the key
    // space exactly as for an array whose element is a mapping.
    if (current instanceof MappingType) {
      while (current instanceof MappingType) {
        keys.push(current.keyType);
        current = current.valueType;
      }
      while (current instanceof ArrayType && chainContainsMapping(current.elementType)) {
        keys.push(PrimitiveType.BIGINT);
        current = current.elementType;
      }
      while (current instanceof MappingType) {
        keys.push(current.keyType);
        current = current.valueType;
      }
      return keys;
    }
    // Conversely, an ARRAY whose element is a mapping has no whole mapping value to materialize. A fixed outer
    // array is represented as one sparse collection keyed by every array index and mapping key.
    while (current instanceof MappingType || current instanceof ArrayType) {
      if (current instanceof MappingType) {
        keys.push(current.keyType);
        current = current.valueType;
      } else {
        keys.push(PrimitiveType.BIGINT);
        current = current.elementType;
      }
    }
    return keys;
  }

  /** The leaf value type after every mapping key and array index. */
  get innermostValueType(): Type {
    let current: Type = this.type;
    if (current instanceof MappingType) {
      while (current instanceof MappingType) current = current.valueType;
      while (current instanceof ArrayType && chainContainsMapping(current.elementType)) current = current.elementType;
      while (current instanceof MappingType) current = current.valueType;
      return current;
    }
    while (current instanceof MappingType || current instanceof ArrayType) {
      current = current instanceof MappingType ? current.valueType : current.elementType;
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
  // Synthesized binding that may legitimately go unused (e.g. a desugared `for..of` loop var);
  // suppresses the unused-variable check.
  allowUnused?: boolean;
  // The init of a C-style `for` loop. Block-scoped in Solidity but the for desugars to a flattened
  // `{ init; while }`, so a sequential loop reusing the same name may re-declare (overwrite) it.
  isLoopVariable?: boolean;
  // Canonical arithmetic progression of a C-style for-loop variable. Published for consumers which must
  // materialize one external-call argument frame per reached loop occurrence. Undefined for non-canonical
  // updates, so metadata generation fails closed rather than guessing how a mutable local evolves.
  loopInitialValue?: bigint;
  loopStepValue?: bigint;
  /** Signed runtime step expression when the canonical update is not a literal. */
  loopStepExpression?: ExpressionNode;
  // Exact method carried by a statically known external-function-pointer value whose runtime expression is not
  // itself a direct function reference (for example `function() external f = callbacks[1]`).
  functionPointerMethodAlias?: string;
  // Original literal bytes when LowerMemoryModel rewrites a `bytes memory` declaration into a numeric pointer.
  // Yul create-address lowering still needs the compile-time blob after that representation change.
  memoryLiteralValue?: Uint8Array;
  // Return temporary produced by InlineReturningStateHelpers. Counter-loop admission uses the callee's declared
  // purity after the surface FunctionCallNode has been normalized into statements plus this SSA result, or the
  // separate proof below when the complete non-pure effect closure contains only source-ordered events.
  inlinedReturningHelperPure?: boolean;
  // A non-pure helper whose complete effect closure contains only events. Its return expression may be replayed
  // independently while the event statements retain their source-ordered runtime occurrence plan.
  inlinedReturningHelperSeparableEvent?: boolean;

  constructor(
    public type: Type,
    public modifier: string[],
    public name: string,
    // Undefined for an uninitialized declaration (`int x;`); codegen emits the type's zero value.
    public expression?: ExpressionNode,
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
  fromModifier?: string; // see StateAssignNode.fromModifier (propagated when this resolves to a state assign)
  qualifiedBaseAccess?: boolean;
  // True when AstBuilder lowered a write through a reference (for example `s.field = v` or `b[i] = v`)
  // into a whole-value assignment. This must not be confused with a user-authored calldata pointer rebind.
  isReferenceDataWrite = false;

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
  // A dynamic string message that may write state. Parse-time only: LowerRequireMessageEffects consumes it.
  messageExpression?: ExpressionNode;
  // A bare `return` sealed into `require(false)` (SEM-1). Flow walks still read it as that return.
  sealedReturn?: boolean;

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

  /**
   * Compiler-owned entry flush whose absent arm must remain physically inactive. Ordinary source branches may be
   * if-converted to an unconditional preserve/write, but doing that to a lazy journal flush creates trailing
   * resources (notably chunk NFTs) for handlers which were never selected.
   */
  preserveConditionalEntryWrites?: boolean;

  /** Replayable source guard for a compiler-owned dirty-bit flush whose condition is otherwise opaque to the ABI. */
  kernelEntryActivation?: ExternalCallExpression;

  /** IfConvertConditionalEntryOp kept this branch's one direct entry write; its access publishes the guarded value. */
  keepsGuardedEntryWrite?: boolean;

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
  // Preserves the source spelling when compatibility lowering rewrites `this.f(...)`
  // (notably a synthesized public collection getter) into a direct state read.
  fromExternalSelfCall?: boolean;

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
  /** Retains source-loop provenance across early kernel lowering and pristine binder recompilation. */
  sourceAuthoredLoop?: boolean;
  /** A fixed-loop expansion saw source break/continue/return and must stay rolled on later passes. */
  fixedUnrollForbidden: boolean = false;

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
  /** Retains source-loop provenance across early kernel lowering and pristine binder recompilation. */
  sourceAuthoredLoop?: boolean;
  /** A fixed-loop expansion saw source break/continue/return and must stay rolled on later passes. */
  fixedUnrollForbidden: boolean = false;
  /**
   * Exact source-loop ceiling proved before a lowering rewrites the canonical condition or update.
   *
   * This is compiler-owned evidence, not an admission hint: consumers may use it only as an upper bound. In
   * particular, early-exit lowering can invalidate the matching lower bound while leaving this ceiling sound.
   */
  compilerAuthenticatedMaximumIterations?: number;

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
  /** Bool local set by a lowered `break`. The iteration loop exits once it is true. */
  breakFlagName?: string;
  /** Windowed (paginated) iteration: the register state variable holding the cursor (last visited slot). */
  windowCursor?: string;
  /** Windowed iteration: the maximum number of entries walked per transaction (the page size). */
  windowBound?: number;
  /** Windowed iteration: the resolved cursor state variable (set by semantic analysis). */
  windowCursorStateVar?: StateVariableNode;

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
  // Set for Solidity inline assembly (Yul): holds the parsed Yul sub-tree, and assemblyBody is empty.
  // When absent, assemblyBody is native BCH-ASM passed to asmToScript.
  yulBlock?: YulBlockNode;

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

  // A bare `{ ... }` scope block written by the user, as opposed to a desugaring's multi-statement wrapper.
  // Scoped blocks are NOT flattened into their parent statement list, so their nested variable scope survives
  // (two sibling blocks may reuse a name; a block local may shadow nothing outside it).
  scoped?: boolean;
  // An inlined base constructor body still to be wrapped by that constructor's modifiers (modifier expansion).
  pendingConstructorModifiers?: PendingConstructorModifiers;

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
  // Preserves the source provenance of `this.f(...)` when an early inline pass replaces the call with its
  // returned expression. Try/catch validation still needs to distinguish this external self-call spelling
  // from an internal call after getter/helper inlining.
  fromExternalSelfCall?: boolean;
  // The counter-loop lowering has proved this is the same-key old-value read of a compact `+`/`-` mapping
  // transition. Its value comes from the authenticated runtime journal entry; route admission must not reserve
  // an additional fixed-key witness for the loop-local identity.
  messageBusRuntimeLoopTransitionRead?: boolean;
  // A runtime-sized local-array key reconstructed from dominating writes. LowerVMapCounterLoops may treat this
  // expression as counter-derived without broadening that rule to arbitrary source array reads.
  messageBusDeterministicArrayKey?: boolean;
  // One of several builds of a read-modify-write's key that might have a side effect (BindLvalueKeyEffects).
  lvalueKey?: LvalueKeyTag;
}

// `(x op= rhs)` used as an expression: performs the assignment to local `x` and yields its new value
// (Solidity's assignment-as-expression, e.g. `while ((n >>= 1) > 0)`). Wraps the desugared AssignNode.
export class AssignmentExpressionNode extends ExpressionNode {
  // General expression-prelude bridge used by source forms whose value requires statements first (currently
  // `f(array.push())`). DesugarPostfixExpressions consumes these before semantic analysis.
  prelude?: StatementNode[];
  result?: ExpressionNode;

  constructor(
    public assign: AssignNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAssignmentExpression(this);
  }
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
  qualifiedBaseAccess?: boolean;
  // This access was synthesized from a Yul `.slot` assignment to a named storage return. It selects a storage
  // pointer but does not load the state value, so Solidity permits it in a pure function.
  storagePointerOnly?: boolean;
  fromModifier?: string; // see StateAssignNode.fromModifier

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
  // Preserve the logical outer element type even if later journal/storage lowerings rewrite the state variable's
  // physical representation before code generation.
  packedElementType?: Type;

  tokenContainerSlotIndex: number = -1;
  arrayIndex?: ExpressionNode; // Set when innermost value is ArrayType and extra key provided
  // A mapping read in the constructor: genesis has no input entry NFTs, so it resolves to the type default
  // (empty mapping). Codegen emits the default directly (no input read, no entry slot). See visitMappingAccess.
  isGenesisRead?: boolean;
  fromModifier?: string; // see StateAssignNode.fromModifier (inlined-helper origin for the private-collection check)

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
  arrayPush?: boolean; // Set for `map[k].push(v)`: append `expression` to the entry's array value (no arrayIndex)
  arrayPop?: boolean;  // Set for `map[k].pop()`: drop the last element of the entry's array value (expression unused)
  noArg?: boolean;     // Set for `map[k].push()`: `expression` is a placeholder, replaced with the element default
  fromModifier?: string; // see StateAssignNode.fromModifier (inlined-helper origin for the private-collection check)
  keySources?: KeySourceInfo[]; // canonical sources retained for runtime-loop ABI planning
  /** SDK-only post-write keys proven from adjacent source statements before entry caching. */
  postWriteKeyExpressions?: ExpressionNode[];
  /** Collections read by this key before any source mutation. */
  preWriteMappingCollections?: string[];
  /** Function-local program point shared with external-call effects. */
  sourceEffectOrdinal?: number;
  /** Exact argument-only value of a cached final write on its replayable dirty arm. */
  kernelValueSource?: { expression: string; parameters: string[] };
  // A counter-loop general RMW (`m[i] = f(m[i], ...)`) replaces the same-entry read in `expression` with this
  // SDK-supplied value. The sorted-entry loop authenticates it against the co-spent entry (or the absent default)
  // before accepting the computed output commitment.
  messageBusRuntimeOldValueWitness?: ArrayAccessNode;
  /** The old-value witness contains only taken source-path occurrences, in source order. */
  messageBusRuntimeOldValueWitnessDomain?: 'selected-source';
  /** Source-order replay recipe for a counter-loop mapping-array mutation operand. */
  messageBusRuntimeMutationValueExpression?: ExpressionNode;
  /** Source-order replay recipe for a counter-loop mapping-array element index. */
  messageBusRuntimeMutationIndexExpression?: ExpressionNode;
  /** Set only after LowerVMapCounterLoops successfully publishes this write's authenticated journal stream. */
  messageBusJournalTransport?: { collection: string; varyingArrayParam: string };
  /** Compiler-synthesized no-op transition authenticating a counter-keyed read from another mapping. */
  messageBusRuntimeReadOnly?: boolean;
  /** Hidden source-order value vector used when physical key sorting cannot replay a loop-carried local. */
  messageBusRuntimeValueTrace?: {
    witnessParam: string;
    local: string;
    initial: ExpressionNode;
    updates: Array<{ condition?: ExpressionNode; expression: ExpressionNode }>;
    afterUpdates: Array<{ condition?: ExpressionNode; expression: ExpressionNode }>;
  };

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
  fromModifier?: string; // see StateAssignNode.fromModifier (inlined-helper origin for the private-collection check)
  // Deeper member names after `fieldName` for an imported-struct field write whose struct was unknown at parse
  // (`x[i].a.b = v` -> fieldName 'a', trailingMembers ['b']); the redesugar pass reconstructs the nested rebuild.
  trailingMembers?: string[];
  /** Function-local program point shared with external-call effects. */
  sourceEffectOrdinal?: number;

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
  fromModifier?: string; // see StateAssignNode.fromModifier

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
  fromModifier?: string; // see StateAssignNode.fromModifier (inlined-helper origin for the private-collection check)
  keySources?: KeySourceInfo[]; // canonical sources retained for runtime-loop ABI planning
  /** Function-local program point shared with external-call effects. */
  sourceEffectOrdinal?: number;

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
  // True only for a cast written by the user. Lowering passes also use
  // CastNode for EVM-word normalization and intentionally have wider rules.
  sourceCast: boolean = false;
  // Set when this identity cast came from `T.unwrap(x)`: the runtime target is
  // T's underlying type, but source validation must still require x to be T.
  sourceUdvtUnwrap?: ValueType;
  // Set by the Yul lowering on a cast to or from the raw 32-byte word a `:=` copies. An integer target is truncated
  // to its width as two's complement (the EVM cleans the word on use); under evmCompat a bytesN follows the EVM
  // word layout too (compileEvmWordCast in generation/utils.ts). Native bytesN keeps the checked conversion.
  evmWord?: boolean;
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
  /** Pre-semantic source program point copied if this call lowers to an external graph edge. */
  sourceEffectOrdinal?: number;
  /** Lexical predicates captured before helper/control-flow lowering. */
  sourceActivationConditions?: readonly { expression: ExpressionNode; negated: boolean }[];
  resolvedFunction?: FunctionDefinitionNode;
  /** A raw address transfer/send call cloned from an inline library helper. */
  inlinedLibraryEffect?: boolean;
  fieldNames?: string[];
  // Call options are retained here for calls through a function-pointer identifier, then transferred to the
  // MethodCallNode synthesized by the external-function-pointer lowering.
  callOptions?: CallOptions;
  // Candidate set retained until type checking for named calls whose overloads share the same field-name set.
  // Each candidate must be checked with arguments mapped by name, since its declaration order may differ.
  namedOverloadCandidates?: FunctionDefinitionNode[];
  // Set by SynthesizeBlockOracle on a blockhash(<computed n>) call: a stable per-function index for this call
  // site (codegen runs twice, so the key must not depend on a codegen-visit counter). Keys the read as
  // <computed:i>; the SDK resolves n from the auto-derivation probe trace.
  blockhashComputedIndex?: number;
  // Set when this call was desugared from `this.f(args)` (an external self-call). On BCH the covenant is the
  // contract itself, so calling an `external` function this way is allowed (the internal-call guard is bypassed).
  fromThisCall?: boolean;
  // A lexical function-pointer variable/parameter may shadow a same-named contract function. Symbol resolution
  // marks that exceptional call so type checking does not consult the contract-wide overload map.
  lexicalIndirectCall?: boolean;
  // X29. Dispatch-site ordinal of a call to an effect-carrying graph emission handler in the message-bus batch route body.
  // The handler is one shared OP_INVOKE subroutine, so its event / transfer OUTPUT indices cannot be compile-time
  // constants; the route pushes this ordinal as hidden context and the subroutine derives its own owner-local
  // slots from it. Assigned once during symbol-table analysis so codegen never has to re-derive walk order.
  graphEffectSite?: number;
  // Kernel row loop: the dispatch-site ordinal is the runtime `row` iterator, not a compile-time copy count.
  graphEffectSiteFromRow?: boolean;
  // Compiler-generated legacy-unroll route: every mutually exclusive handler call emitted for one logical row
  // carries that row's stable ordinal. Graph-effect planning uses it instead of counting each handler's calls
  // independently (different handler kinds in distinct rows can both be the Nth call of their kind).
  messageBusDispatchRow?: number;
  /** Stable first recovery-effect ordinal contributed by this source call within its defining function.
   * A call to a helper contributes the helper's complete formal recovery sequence at this position. */
  recoveryEffectOrdinal?: number;
  // Lowered from Yul addmod/mulmod: a zero modulus gives 0, as the EVM, instead of failing.
  yulZeroModulus?: boolean;

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

// `<expr>(args)` where the callee is an arbitrary expression evaluating to a function-pointer value (e.g.
// `arr[i]()`, `x()()`), not a plain name. Dispatched indirectly: evaluate the callee to its integer functionId
// then OP_INVOKE (the same mechanism as calling a function-pointer variable).
export class IndirectCallNode extends ExpressionNode {
  callOptions?: CallOptions;

  constructor(
    public callee: ExpressionNode,
    public parameters: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitIndirectCall(this);
  }
}

export class InstantiationNode extends ExpressionNode {
  referencedContract?: ContractNode;
  callOptions?: CallOptions;
  transferIndex: number = 0;
  isStatefulDeploy: boolean = false;
  deployedDataNftCount: number = 0;
  deployedEntryNftCount: number = 0;
  deployedStateVars: StateVariableNode[] = [];
  // Deploy-then-call fold: a same-tx `a.foo(x)` on this deploy result is folded into the genesis - the
  // child is deployed in its post-foo state. Maps a child state-var name to the (parent-context) expression
  // its value should hold; the deploy covenant emits this instead of the default for that field.
  foldedStateInit?: Map<string, ExpressionNode>;

  // Replayable constructor preconditions, rewritten into the deploying function's expression context.
  foldedConstructorPredicates?: ExpressionNode[];

  // Finite collection entries created by a child constructor. The first admitted form is a top-level,
  // fixed-size scalar array addressed by a literal index; both key and value are rewritten into the parent
  // handler's expression context so the deploy covenant and SDK can independently reproduce the entry NFT.
  foldedCollectionEntries?: Array<{
    collection: CollectionNode;
    key: ExpressionNode;
    value: ExpressionNode;
  }>;

  // Unlike constructor folding, this requires the SDK to derive the child's post-call genesis from the VM.
  hasFoldedChildCall?: boolean;
  // The child has a constructor whose writes could NOT be folded: the true genesis of unwritten fields is
  // unknown, so later call-folds must not resolve their reads to type defaults.
  ctorFoldFailed?: boolean;
  /** True only when every constructor statement is a pure straight-line local/state assignment/require and folded. */
  constructorStateFoldComplete?: boolean;
  /** Compiler-pinned child body used to independently reproduce a stateless value recipient. */
  creationBytecode?: string;

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

// Evaluate `discarded`, remove its single stack value, then evaluate and return `value`. This models Solidity
// expressions that extract compile-time metadata from a runtime value (for example `getContract().f.selector`):
// the receiver's side effects are preserved even though only the declaration selector is returned.
export class SequenceExpressionNode extends ExpressionNode {
  constructor(
    public discarded: ExpressionNode,
    public value: ExpressionNode,
  ) {
    super();
    this.type = value.type;
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitSequenceExpression(this);
  }
}

export class SliceNode extends ExpressionNode {
  // True only for Solidity's `x[a:b]` syntax in compatibility mode. The native `.slice(a, b)` member is a
  // separate SolidCash operation and intentionally does not carry Solidity's calldata-only restriction.
  isSolidityIndexRange = false;

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

// Yul builtins that codegen evaluates with EVM semantics over 256-bit words (GenerateTargetTraversal.emitYulWordOp).
export type YulWordBuiltin =
  | 'add' | 'sub' | 'mul' | 'div' | 'sdiv' | 'mod' | 'smod' | 'slt' | 'sgt' | 'sar' | 'signextend' | 'shl' | 'shr'
  | 'exp';

export class BinaryOpNode extends ExpressionNode {
  // Written in source or desugared from it: an integer literal operand takes the bounded operand's type.
  sourceArithmetic?: boolean;
  // Yul add/sub/mul are 256-bit words and wrap. Checked Solidity arithmetic does not.
  yulWrapping = false;
  // Lowered from this Yul builtin: codegen gives it EVM word semantics. The operator is the plain fallback the type
  // check keeps for a signed operand.
  yulBuiltin?: YulWordBuiltin;

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
  /** Preserves source-level `this` after lowering to active-input bytecode introspection. */
  isThisExpression = false;

  // Solidity before 0.8 permits unsigned negation and evaluates it modulo the
  // destination width (e.g. `d & -d` in FullMath).
  legacyWrappingNegation = false;

  // A compiler-built `.length` that a proof compares with int256 values. It stays bigint under evmCompat.
  compilerLength = false;

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
  // Solidity before 0.8 typed msg.sender and tx.origin as address payable.
  legacyPayableAddress = false;

  // Solidity permits msg.value in state-variable initializers even when the synthesized constructor is
  // nonpayable; preserve that source context after the initializer is lowered into a constructor assignment.
  fromStateInitializer: boolean = false;
  // Retained when a Yul context builtin is lowered to its high-level equivalent.
  // Solidity 0.6 admitted assembly chainid() inside pure functions even though a
  // source-level block.chainid read is rejected by the compatibility checker.
  fromInlineAssembly: boolean = false;

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
  // Written in source: integer literal branches give it their common mobile type (`c ? 63 : 255` is uint8).
  sourceConditional?: boolean;

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
  // A partial ascending-write fold zero-fills the missing indexes. Those holes are the int default, not
  // source stores, so a later key replay must not treat the literal as a complete vector.
  coalescedPartial: boolean = false;

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
  // `new bytes(n)` with a runtime n: emit exactly n zero bytes (no length prefix), typed `bytes`. The linear
  // memory model uses this as its malloc growth primitive; also gives source-level runtime `new bytes(n)`.
  rawBytes: boolean = false;

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
  noArg?: boolean; // Set for `arr.push()`: `value` is a placeholder, replaced with the element default at type-check

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
  /** Pre-semantic source program point copied if this lowers to a mapping mutation. */
  sourceEffectOrdinal?: number;
  arrayType?: ArrayType;
  fromModifier?: string; // see StateAssignNode.fromModifier (inlined-helper origin for the private-collection check)
  messageBusRuntimeOldValueWitness?: ArrayAccessNode;
  /** SDK-only post-write keys proven before this bare mapping assignment is lowered. */
  postWriteKeyExpressions?: ExpressionNode[];
  /** Collections read by this key before any source mutation. */
  preWriteMappingCollections?: string[];

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
  /** Pre-semantic source program point copied if this lowers to a mapping mutation. */
  sourceEffectOrdinal?: number;
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
  noArg?: boolean; // Set for `this.arr.push()`: `value` is a placeholder, replaced with the element default

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
  // When set, this is a RESIZE (`x.length = resizeTo`, the assembly `sstore(x.slot, n)` idiom) rather than a
  // single pop: the array is truncated to / zero-fill-grown to `resizeTo` elements. Fixed-width elements only.
  resizeTo?: ExpressionNode;

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
  // An element-field rebuild (`arr[i].f = v`), including several of them joined into one constructor. The join
  // can name every field, so the constructor no longer reads the element; it is still that element's rebuild.
  fieldRebuild?: boolean;

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
  // Set when this came from `this.f` / `IFoo(this).method` (a self-targeted EXTERNAL pointer). Solidity
  // types it `function(...) external`, but on BCH a self external-call is a direct call to the own function,
  // so it routes through the internal functionId + OP_INVOKE path. Drives FunctionType.isExternal in typing.
  isExternalSelfRef?: boolean;
  storagePointerOnly?: boolean;
  fromModifier?: string; // see StateAssignNode.fromModifier (propagated when this resolves to a state access)

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
    this.type = PrimitiveType.INT; // integer literal/generic; converts to any IntType or to bigint
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
      emitCompilerWarning(
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
  // Exact bytes of a Solidity-compatible string or unicode literal, `\xNN` escapes as raw bytes. `value` is their
  // UTF-8 reading when they are valid UTF-8; otherwise (e.g. "\xff") they differ, so byte consumers read this. Type
  // checking uses it for bytes destinations and to reject malformed UTF-8 only when the destination is string.
  solidityBytes?: Uint8Array;
  solidityInvalidUtf8 = false;

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
  // Exact Solidity hex-NUMBER value. Odd-nibble literals need this because their native SolidCash byte form
  // zero-extends the final nibble (`0x123` -> bytes 0x1203), while numeric context means integer 0x123.
  numericValue?: bigint;
  // Number of hexadecimal digits in a numeric `0x...` source spelling (excluding separators). Solidity permits
  // a non-zero numeric literal to cast to bytesN only when this width is exactly N bytes.
  sourceHexDigits?: number;
  // Distinguishes a source `hex"..."` literal from compiler-synthesized byte constants (e.g. a folded hash).
  isHexStringLiteral = false;
  // Set when this literal is a placeholder for an unsupported-but-valid construct (e.g. `new bytes(n)` with a
  // runtime length): it type-checks as bytes so a NON-primary contract using it does not fail the file, but
  // codegen throws this message if a compiled contract actually reaches it. See visitHexLiteral.
  codegenError?: string;

  constructor(
    public value: Uint8Array,
  ) {
    super();
    // A `0x..` literal may stand for an address literal, so it keeps the implicit conversion to address.
    this.type = new AddressBytesType(value.byteLength);
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
  /** The data comes from the compiler's own encoder, so its words are not re-validated (a split forwarder). */
  trustedEncoding?: boolean;

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
  // Set when a library-body directive is lifted to file scope for semantic registration.
  declaringLibraryName?: string;

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
    public stateMutability: 'pure' | 'view' | 'payable' | 'nonpayable' = 'nonpayable',
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
    if (this.type instanceof ArrayType) return PrimitiveType.BIGINT;
    return this.type.keyType;
  }

  get valueType(): Type {
    if (this.type instanceof ArrayType) return this.type.elementType;
    return this.type.valueType;
  }

  get allKeyTypes(): Type[] {
    if (this.type instanceof ArrayType) return [PrimitiveType.BIGINT];
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
  hasFallback: boolean = false;

  constructor(
    public name: string,
    public stateVariables: InterfaceStateVariableNode[],
    public collections: InterfaceCollectionNode[],
    public functions: InterfaceFunctionNode[],
    public structDefinitions: StructDefinitionNode[] = [],
    public enumDefinitions: EnumDefinitionNode[] = [],
    public typeDefinitions: TypeDefinitionNode[] = [],
    public eventDefinitions: EventDefinitionNode[] = [],
    public errorDefinitions: ErrorDefinitionNode[] = [],
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
  calleeMultiNft: boolean; // callee commitments carry an nftIndex tag (multi-record or explicit singleton encoding)
}

export class ExternalStateAccessNode extends ExpressionNode {
  readInfo?: ExternalStateReadInfo;

  constructor(
    public interfaceName: string,
    public addressExpression: ExpressionNode,
    public name: string,
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
  /** Read the final transaction output state rather than the co-spent input state. */
  outputState?: boolean;
  externalOutStateSlotIndex?: number;
}

export class ExternalMappingAccessNode extends ExpressionNode {
  readInfo?: ExternalCollectionReadInfo;

  constructor(
    public interfaceName: string,
    public addressExpression: ExpressionNode,
    public name: string,
    public keys: ExpressionNode[],
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
  addressParam?: string; // name of the constructor/function parameter providing the callee address (locking bytecode)
  addressStateVar?: string; // name of the interface-typed state var holding the callee address (read from state)
  slotIndex: number;
}

export enum ExternalCallMode {
  REGULAR = 'regular',
  CALL = 'call',
  STATICCALL = 'staticcall',
  DELEGATECALL = 'delegatecall',
}

/**
 * How a framed low-level call whose payload names its call statically was lowered to a typed call.
 *
 * `mode` is the low-level spelling, which fixes the frame kind: `staticcall` a static frame, `call` a message frame.
 * `fallback` is set for a payload no function of the target's interface has: the call runs the target's fallback,
 * and its call data is the payload's own selector.
 */
export interface LowLevelRoute {
  readonly mode: 'call' | 'staticcall';
  readonly fallback?: { readonly selector: Uint8Array };
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
  /** Source-level returned-array link captured before memory lowering rewrites the assignment. */
  resultArrayOutput?: number;
  /** Ordered row identity within one inferred repeated-callee message-bus batch. */
  externalBatchLogicalIndex?: number;
  /** Function-local program point shared with mapping-write effects. */
  sourceEffectOrdinal?: number;
  /** Lexical predicates which must hold before this callsite is reached, captured before helper flattening. */
  sourceActivationConditions?: readonly { expression: ExpressionNode; negated: boolean }[];
  callMode?: ExternalCallMode;
  callOptions?: CallOptions;
  valueTransferIndex: number = -1;
  // Set when this call on a freshly-deployed local was folded into the deploy genesis (no co-spend): the
  // node is inert - skipped by external-call collection and codegen.
  foldedIntoDeploy?: boolean;
  // The deploy-then-call this node stands for folds to an unconditional failure: the callee's body cannot
  // complete (it ends in a `revert` on every path), so the statement becomes that failure. Consumed by the
  // statement visitors, which replace the whole statement with a `revert`.
  foldedCallReverts?: boolean;
  // EVM-parity expression-form low-level call `(bool, bytes) = addr.call(payload)`: the callee's type/function
  // are unknown at compile time, the return is read as a single opaque bytes blob, identity-bound to addr.
  opaqueReturn?: boolean;
  // Statement-form `addr.call(payload);` authenticates the same opaque result frame so it can target either a
  // returning or void handler, but deliberately does not reconstruct `(success, data)` on the source stack.
  discardedOpaqueReturn?: boolean;
  // An empty-calldata `{value:}` call is a BCH transfer effect, not a selector-bearing graph invocation. The
  // compiler still reconstructs its Solidity `(success, data)` result, but excludes it from callsite metadata.
  rawValueTransferOnly?: boolean;
  // An option-free empty-calldata call to a constant target that cannot be a P2SH lock: solc's call to an account
  // without code, so no callee is co-spent and the result is `(true, bytes(""))`. A runtime target keeps its callee.
  noCodeTarget?: boolean;
  // Set for a same-address varying-method function pointer `f = cond ? c.a : c.b; f(args)`: the RUNTIME selector
  // expression (`cond ? c.a.selector : c.b.selector`). Codegen stashes it into a temp and the covenant asserts
  // the co-spent callee's selector == it (instead of the compile-time witness), binding the co-spent method to
  // `cond`. One co-spend, one epilogue verification (no per-branch duplicate).
  runtimeSelector?: ExpressionNode;
  // Foreign fn-ptr ARRAY dispatch table with per-element methods: the parallel `bytes4[]` state array of
  // per-element selectors; the array-call loop asserts the co-spent callee's selector == sel[i].
  selectorArrayVar?: string;
  // Set for a framed low-level call lowered to this typed call (LowerStaticLowLevelCalls).
  lowLevelRoute?: LowLevelRoute;

  constructor(
    public interfaceName: string,
    public addressExpression: ExpressionNode,
    public functionName: string,
    public parameters: ExpressionNode[],
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitExternalFunctionCall(this);
  }
}

export interface ExternalCallArgSource {
  kind: 'forward' | 'constructorArg' | 'literal' | 'msgSender' | 'selfAddress' | 'arrayElement' | 'loopIndex'
  | 'expression';
  paramIndex?: number;
  indexParamIndex?: number;
  indexValue?: number;
  indexStepValue?: number;
  initialValue?: string;
  stepValue?: string;
  stepExpression?: ExternalCallExpression;
  counterName?: string;
  paramName?: string;
  value?: string;
  type?: string;
  expression?: ExternalCallExpression;
  /** Source-level `address(this)`, distinct from physical active-input bytecode introspection. */
  logicalIdentity?: boolean;
}

export interface ExternalCallExpression {
  kind: string;
  /** Compiler-internal source identity for compute-call association; ignored by SDK expression replay. */
  computeSourceSite?: string;
  fixedEffectRecipe?: ChildDeploymentValueRecipe;
  name?: string;
  /** Physical producer/consumer lane after repeated-owner collapse. */
  callsiteId?: number;
  /** Pre-collapse source callsite; distinct from `callsiteId` for batched producers. */
  sourceCallsiteId?: number;
  /** Zero-based ABI result position selected from the producer (also explicit for a sole result). */
  resultIndex?: number;
  /** Authenticated receiver expression for a returning external call. */
  target?: ExternalCallExpression;
  type?: string;
  value?: string | boolean;
  operator?: string;
  source?: ExternalCallArgSource;
  expression?: ExternalCallExpression;
  left?: ExternalCallExpression;
  right?: ExternalCallExpression;
  condition?: ExternalCallExpression;
  ifTrue?: ExternalCallExpression;
  ifFalse?: ExternalCallExpression;
  args?: ExternalCallExpression[];
  fields?: string[];
  parameters?: string[];
  statements?: ExternalCallStatement[];
}

export interface ExternalCallStatement {
  kind: 'variable' | 'assign' | 'arrayAssign' | 'while' | 'branch' | 'return' | 'expression' | 'block'
  | 'require';
  name?: string;
  type?: string;
  index?: ExternalCallExpression;
  expression?: ExternalCallExpression;
  condition?: ExternalCallExpression;
  statements?: ExternalCallStatement[];
  elseStatements?: ExternalCallStatement[];
}

export interface ExternalCallSlot {
  interfaceName: string;
  functionName: string;
  /**
   * Authenticated caller subject for this outgoing edge. Default is the physical state-owner master; CREATE /
   * proxy / executor roles are published only when the call expression authenticates that subject.
   */
  callerIdentity?: {
    version: 1;
    role: 'origin' | 'active' | 'owner' | 'create' | 'proxy' | 'executor';
    auth: 'input-bytecode' | 'category' | 'literal';
    authOffset: number;
    subjectLockingBytecode?: string;
  };
  addressParam?: string;
  addressStateVar?: string; // interface-typed state var holding the callee address (read from state)
  // Code-baked address literal target `IFoo(0x..).m()` (hex): the covenant pushes this constant as the
  // expected address instead of reading a param/state - caller-independent. A non-locking-bytecode literal
  // (e.g. a 20-byte ETH address) makes the identity check un-satisfiable (fails closed). Never a caller input.
  addressLiteral?: string;
  // A source ternary whose condition and both same-interface address arms are unmodified function/constructor
  // parameters. The direct epilogue may re-evaluate this exact choice to authenticate the co-spent callee.
  runtimeTernaryAddress?: boolean;
  // Set when the call target is an array element `IFoo(arr[i]).m()`: the state array (of addresses) whose
  // every element is co-spent + verified as a callee in a loop (the source `for` loop is left as harmless
  // iteration; the epilogue reads the array and loop-verifies callee[base+i].master.LBC == arr[i]).
  loopArrayVar?: string;
  // Runtime-loop receiver held in a local rather than written directly as arr[i]. The array supplies iteration
  // cardinality to the SDK; this expression supplies the live index while codegen identity-checks the local.
  loopIndexExpression?: ExpressionNode;
  // Set alongside loopArrayVar when the target is an interface-typed FIELD of a struct-array element
  // (`structArr[i].field.m()`, e.g. MasterChef `poolInfo[i].lpToken.balanceOf(..)`): the epilogue decodes that
  // field from each packed struct element before the identity check (compiler-internal, not serialized). The
  // co-spend/SDK derivation is unchanged (dispatch is still on `interfaceName`); only the verified value differs.
  loopArrayElemStructType?: Type;
  loopArrayElemFieldName?: string;
  // The synthesized `__internal__loopTargets<n>` array-access identifier(s) (each a witness `.array`) when a
  // per-iteration COMPUTED target `IFoo(pairFor(.., path[i], ..)).m()` was rewritten to read a witness address[]
  // param. Usually one (the call target); a loop-body LOCAL receiver adds a second for its neutralized initializer.
  // Carried so witness-param synthesis can back-link each `.definition` to the freshly created symbol (the nodes
  // are created in the collect phase, before the param symbol exists).
  loopWitnessArrayIds?: IdentifierNode[];
  // Set when the call target is `msg.sender` (IFoo(msg.sender).m()): the callee is the tx-derived msg.sender
  // input (category-matched, or tx.origin P2PKH), verified against emitMsgSender's locking bytecode.
  addressIsMsgSender?: boolean;
  // Set when the call target is the caller's own address (`IFoo(address(this)).m()`, or `IFoo(this).m()`): the
  // callee is a master of the calling contract, and the caller's own code holds the target as its frame `self`.
  addressIsSelf?: boolean;
  addressSource?: ExternalCallArgSource;
  slotIndex: number;
  /** Function-local program point of this source call before any physical batching. */
  sourceEffectOrdinal?: number;
  requiredDataNftIndices: number[];
  hasReturnValues?: boolean;
  returnTypes?: Type[];
  returnEventSignature?: string;
  computedOffset: number;
  returnSlotIndex?: number; // sequential index among slots with hasReturnValues
  needsSelectorVerification?: boolean; // true when callee interface has >1 callable function
  // MD1: the callee function's compile-time selector, baked as a constant OP_EQUALVERIFY for a regular call so a
  // spender cannot substitute a different method of the callee via the (previously trusted) witness param.
  compileTimeSelector?: Uint8Array;
  /** Interface-proven readonly entry; used only for direct return-frame authentication. */
  readonlyReturnSelector?: Uint8Array;
  /** Set only when codegen emits the direct shared-readonly return equality check. */
  readonlyReturnBindingSelector?: Uint8Array;
  /** A returning direct call's record: the callee method's selector and declared parameter types, for its digest. */
  callRecordSelector?: Uint8Array;
  callRecordParameterTypes?: Type[];
  // Same-address varying-method pointer: the RUNTIME selector expression (`cond ? a.selector : b.selector`).
  // The epilogue evaluates it and asserts the co-spent callee's selector == it, instead of the witness param.
  runtimeSelector?: ExpressionNode;
  // Foreign fn-ptr ARRAY dispatch table with per-element methods: the parallel `bytes4[]` state array holding
  // each element's selector. The array-call loop reads sel[i] and asserts the co-spent callee's selector == it,
  // instead of a single broadcast witness. Set alongside loopArrayVar for a varying-method table.
  selectorArrayVar?: string;
  callMode?: ExternalCallMode;
  argSources?: ExternalCallArgSource[];
  /** Runtime predicate guarding this callsite, serialized from its enclosing source branches. */
  condition?: ExternalCallExpression;
  /** Necessary source `require` predicates reached before this call, evaluated at their own program points. */
  preCallRequires?: ExternalCallExpression[];
  /** ABI output array directly populated by this loop call (`result[i] = call(); return result`). */
  resultArrayOutput?: number;
  rawFunctionName?: string;
  rawArgSources?: ExternalCallArgSource[];
  /** Decoded arguments/types for an `abi.encodeCall` low-level payload. Compiler-internal only. */
  rawParameters?: ExpressionNode[];
  rawParameterTypes?: Type[];
  rawSelector?: Uint8Array;
  rawInterfaceName?: string;
  /** The source call carries an effective `{ value: ... }` transfer. Retained independently of cloned AST nodes. */
  callValueEffect?: boolean;
  opaqueReturn?: boolean; // generic dynamic dispatch: opaque bytes return, identity-bound to the witnessed address
  // Set by visitExternalFunctionCall when a loop call over a calldata/param address array with an opaque return
  // (the MultiCall pattern) is emitted INLINE per-iteration (co-spend + return read keyed on the live index).
  // Both epilogues (emitExternalCallVerification, emitExternalReturnEventVerification) skip such slots.
  inlineLoopDispatch?: boolean;
  // FOREIGN function-pointer call (synthesized `__FnPtr_` callee): the callee's block layout (data-NFT count) is
  // unknown at compile time, so the co-spend master input index is a PER-CALL runtime param the SDK fills
  // (`__internal__extcallMasterIdx<slotIndex>`) rather than `externalCallInputBase + computedOffset`. Unambiguous
  // across many fn-ptr calls (each call reads its own index). Identity + runtime selector + preservation are the
  // normal checks. See emitExternalCallVerification.
  fnPtrCall?: boolean;
  // Release 5 repeated-callee grouping: several straight-line logical calls
  // share this one physical callee block and are bound to its message-bus batch blob.
  batchInvocations?: {
    selector: Uint8Array;
    parameters: ExpressionNode[];
    parameterTypes: Type[];
    logicalIndex: number;
    /** @internal Traversal-stable source callsite used to prove producer dominance before physical batching. */
    sourceCallsiteId: number;
    /** Function-local program point retained independently of physical batch order. */
    sourceEffectOrdinal?: number;
    argSources?: ExternalCallArgSource[];
    /** Runtime cardinality of this source callsite within the grouped physical route. */
    occurrence?: 'once' | 'conditional' | 'loop';
    /** Compiler-serialized predicate guarding this logical row. */
    condition?: ExternalCallExpression;
    opaqueReturn?: boolean;
    /** The logical source call carries an effective `{ value: ... }` transfer. */
    callValueEffect?: boolean;
    returnTypes?: Type[];
    /** @internal Conditional row whose arguments are entry-frame derivable and are committed eagerly. */
    eager?: boolean;
    /** @internal Source node used to lower an eager row before the body. */
    sourceCallNode?: ExternalFunctionCallNode;
  }[];
  /** @internal Physical representative for a logical row removed by repeated-callee grouping. */
  batchRepresentative?: ExternalCallSlot;
  /** @internal Source node retained until Release 5 grouping/codegen. */
  sourceCallNode?: ExternalFunctionCallNode;
  /** @internal Callsite may be absent at runtime; its master-index witness is -1 when not reached. */
  optional?: boolean;
}

export interface ExternalOutputStateAccessInfo {
  interfaceName: string;
  stateVarName: string;
  stateVarType: Type;
  nftIndex: number;
  fieldIndex: number;
  fieldsInNft: { type: Type; fieldIndex: number }[];
  externalOutStateSlotIndex: number;
  calleeMultiNft: boolean; // callee commitments carry an nftIndex tag (multi-record or explicit singleton encoding)
  /** The data-NFT field is a uint32 length header; the value is reconstructed from owner-branded chunks. */
  dynamic: boolean;
}

export class ExternalOutputStateNode extends ExpressionNode {
  constructor(
    public interfaceName: string,
    public addressExpression: ExpressionNode,
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
  addressParam?: string;
  addressStateVar?: string; // interface-typed state var holding the callee address (read from state)
  slotIndex: number;
  requiredDataNftIndices: number[];
  sharedWithCallSlotIndex?: number;
}

export class MethodCallNode extends ExpressionNode {
  /** Source-level returned-array link copied if this resolves to an external graph call. */
  resultArrayOutput?: number;
  /** Pre-semantic source program point copied if this lowers to an external graph call. */
  sourceEffectOrdinal?: number;
  /** Lexical predicates captured before helper/control-flow lowering. */
  sourceActivationConditions?: readonly { expression: ExpressionNode; negated: boolean }[];
  callOptions?: CallOptions;
  valueTransferIndex: number = -1; // temporary carrier for pre-scan before transformation
  fieldNames?: string[]; // set for named-arg calls obj.f({a: x}); reordered against the callee's params
  // Set by DesugarExternalFunctionPointers for a same-address varying-method pointer call: the runtime selector
  // expression (`cond ? c.a.selector : c.b.selector`); threaded to the external call node in semantic analysis.
  runtimeSelector?: ExpressionNode;
  // Set by LowerForeignFunctionPointerArrayElements for a varying-method array dispatch table: the parallel
  // `bytes4[]` state array of per-element selectors; threaded to the external call slot in semantic analysis.
  selectorArrayVar?: string;
  // Set by LowerStaticLowLevelCalls for a framed low-level call it lowered to this typed call; threaded to the
  // external call node in semantic analysis.
  lowLevelRoute?: LowLevelRoute;
  // A fixed-method pointer table still broadcasts across every table element even without a selector sidecar.
  pointerTableBroadcast: boolean = false;
  // Set when InlineReturningStateHelpers copies a supported global operator implementation into an entry point.
  // SynthesizeExternalAddressLocals uses it to materialize the operator's pure helper-return receiver without
  // broadening computed-receiver acceptance for unrelated Solidity-negative fixtures.
  inlinedOperatorReceiver: boolean = false;

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
  // Set on a library event: it shares SourceFileNode.eventDefinitions with file-level events.
  declaringLibraryName?: string;
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
  errorQualifier?: string; // `D` in `revert D.E(...)`; retained for scoped declaration resolution
  fieldNames?: string[]; // set for named-arg reverts revert E({a: x}); reordered against the error's params

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
  // The definition this site resolved to. Retained because later lowering may inline or erase the emit statement
  // itself (an inherited internal helper such as OpenZeppelin's `_approve`), leaving this metadata as the only
  // surviving record that the handler really emits the event. Overload resolution replaces it in TypeCheck.
  eventDefinition?: EventDefinitionNode;
  /** The condition a framed emit a branch guards runs under (`framed/master/write-activation.ts`). */
  activation?: ExternalCallExpression;
}

export interface RuntimeLoopEventInfo {
  /** Stable per-function segment ordinal assigned by LowerVMapCounterLoops. */
  loopIndex: number;
  /** Hidden authenticated permutation whose length is the exact trip count for a repeated segment. */
  permutationParam?: string;
  /** Exact repeat count for a source-ordered event outside the loop. */
  repeatCount?: number;
  /** Exact do-while affine recurrence domain. Mutually exclusive with permutationParam and repeatCount. */
  iterationDomain?: {
    counterName: string;
    initialValue: ExternalCallExpression;
    stepValue: ExternalCallExpression;
    continueCondition: ExternalCallExpression;
    maximumIterations: number;
  };
  /** Compiler-only marker: serialize per-site arguments for this permutation-backed logical domain. */
  staticArguments?: true;
  /** Source-order predicate which ends this runtime event segment after the current logical iteration. */
  iterationBreakCondition?: ExpressionNode;
  /** Function-local execution segment shared by every runtime effect produced at this source position. */
  effectSequence?: number;
  /** Each occurrence settles as its payload's commitment-sized chunks: the head, then continuation records. */
  chunked?: true;
}

export interface RuntimeLoopTransferInfo {
  /** Stable per-function segment ordinal assigned by LowerVMapCounterLoops. */
  loopIndex: number;
  /** Hidden authenticated permutation whose length is the exact trip count for a repeated segment. */
  permutationParam: string;
  /** Function-local execution segment shared with runtime events in the same source loop. */
  effectSequence?: number;
  /** Effect kind per source site. Stored on the segment because synthetic route bodies need not retain the
   * concrete source statement nodes from which this information was first derived. */
  siteKinds?: RuntimeLoopTransferKind[];
}

export type RuntimeLoopTransferKind = 'bch' | 'token' | 'nft';

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
  /** Windowed (paginated) iteration: the register state variable holding the cursor. */
  windowCursor?: string;
  /** Windowed iteration: the maximum number of entries walked per transaction. */
  windowBound?: number;
}

export class EmitStatementNode extends StatementNode {
  eventDefinition?: EventDefinitionNode;
  eventCandidates?: EventDefinitionNode[];
  eventQualifier?: string;
  emitIndex: number = 0;
  /** Runtime event site within a lowered counter-keyed mapping loop; excluded from fixed event slots. */
  runtimeLoopEvent?: { loopIndex: number; siteIndex: number };
  /** The runtime event pushes one record per commitment-sized chunk of its payload (head, then continuations). */
  runtimeLoopEventChunked?: true;
  /** Source predicate controlling this runtime event, evaluated by the SDK to plan the exact output stream. */
  runtimeLoopEventCondition?: ExpressionNode;
  /** SDK-visible replay recipe when the executable argument itself must retain source state semantics. */
  runtimeLoopEventArguments?: ExpressionNode[];
  /** Counter progression available to runtimeLoopEventCondition as a per-occurrence value. */
  runtimeLoopEventCounter?: {
    name: string; initialValue: bigint; stepValue: bigint; stepExpression?: ExpressionNode;
  };

  /** Relative source order among all runtime effects in this repeated segment. */
  runtimeLoopEffectOrder?: number;
  fieldNames?: string[]; // set for named-arg emits emit E({a: x}); reordered against the event's params

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
  /** Fixed-effect replay proof captured before helper/value lowering rewrites this operand. */
  sourceEffectRecipeProvenanceSafe?: boolean;
  /** Runtime transfer site within a lowered counter-keyed mapping loop; excluded from fixed transfer slots. */
  runtimeLoopTransfer?: { loopIndex: number; siteIndex: number };
  /** Source predicate controlling this transfer, evaluated by the SDK to plan the exact output stream. */
  runtimeLoopTransferCondition?: ExpressionNode;
  /** Counter progression available to runtimeLoopTransferCondition as a per-occurrence value. */
  runtimeLoopTransferCounter?: {
    name: string; initialValue: bigint; stepValue: bigint; stepExpression?: ExpressionNode;
  };

  /** Relative source order among all runtime effects in this repeated segment. */
  runtimeLoopEffectOrder?: number;

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

// `selfdestruct(recipient)`: destroys the contract and forwards its value to an output with the recipient's
// locking bytecode, in the same transaction. Implies the selfdestruct modifier on the enclosing function.
export class SelfdestructStatementNode extends StatementNode {
  constructor(
    public recipient: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitSelfdestructStatement(this);
  }
}

export class AddressTransferStatementNode extends StatementNode {
  transferIndex: number = 0;
  /** Fixed-effect replay proof captured before helper/value lowering rewrites this operand. */
  sourceEffectRecipeProvenanceSafe?: boolean;
  /** The intrinsic came from an inlined library helper and already follows the ordinary BCH transfer lowering. */
  inlinedLibraryEffect: boolean = false;

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
  /** Fixed-effect replay proof captured before helper/value lowering rewrites this operand. */
  sourceEffectRecipeProvenanceSafe?: boolean;
  /** The intrinsic came from an inlined library helper and already follows the ordinary BCH transfer lowering. */
  inlinedLibraryEffect: boolean = false;

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
  // Set when the introspected name is a `library`: an inlined library has no deployed artifact, so its creation
  // code is the empty blob rather than a missing-bytecode error.
  libraryName?: string;
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
  /** Runtime counter-loop effect stream ownership for fungible-token or NFT transfer sites. */
  runtimeLoopTransfer?: { loopIndex: number; siteIndex: number };
  runtimeLoopTransferCondition?: ExpressionNode;
  runtimeLoopTransferCounter?: {
    name: string; initialValue: bigint; stepValue: bigint; stepExpression?: ExpressionNode;
  };

  runtimeLoopEffectOrder?: number;

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
  // Set by Yul lowering for `return(ptr, size)`: this is an EVM halt with a raw byte region, not a Solidity
  // source-level return whose expressions must match the enclosing function's declared ABI returns.
  isYulReturn: boolean = false;
  // With isYulReturn: the region is one word the lowering resolved at compile time, returned as that word's value
  // rather than as raw bytes.
  yulWord: boolean = false;
  // A bare `return;` in a modifier is valid regardless of the decorated function's return tuple: it exits the
  // modifier continuation while preserving the function result produced by `_`.
  fromModifier?: string;
  // A Solidity-generated public struct getter may expose an external-function member. Storage lowering
  // represents that member as bytes (selector + address), while the generated ABI retains its FunctionType.
  externalFunctionGetterBridge?: boolean;

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

// A bare expression used as a statement (`x + 1;`, `arr[i];`, `c ? a : b;`). Only side-effect-free expressions
// reach here (specific statement forms - assignment, call, push/pop, delete - are matched first). Codegen
// computes the value and drops it.
export class ExpressionStatementNode extends StatementNode {
  constructor(
    public expression: ExpressionNode,
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitExpressionStatement(this);
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
  isAbstract: boolean = false;
  isVirtual: boolean = false;
  isOverride: boolean = false;
  overrideBases: string[] = [];

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
  /** Pre-semantic source program point copied if this lowers to an external graph call. */
  sourceEffectOrdinal?: number;
  /** Lexical predicates which must hold before this callsite is reached, captured before helper flattening. */
  sourceActivationConditions?: readonly { expression: ExpressionNode; negated: boolean }[];
  callIndex: number = 0;  // assigned during pre-scan
  callOptions?: CallOptions;
  valueTransferIndex: number = -1;
  // Compiler-owned delegate expressions (currently returning split forwarders) use the authenticated
  // cross-input return-event channel rather than the raw low-level `(true, emptyBytes)` result.
  synthesizedFromLibraryCall = false;
  librarySelectorDispatched = false;

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
  /** Pre-semantic source program point copied if this lowers to an external graph call. */
  sourceEffectOrdinal?: number;
  /** Lexical predicates which must hold before this callsite is reached, captured before helper flattening. */
  sourceActivationConditions?: readonly { expression: ExpressionNode; negated: boolean }[];
  callIndex: number = 0;
  callOptions?: CallOptions;
  valueTransferIndex: number = -1;
  // Set when synthesized from `L.f()` library-call sugar (SynthesizeLibraryDelegateCalls): the user wrote a
  // typed library call, not a raw delegatecall, so suppress the low-level-call warning.
  synthesizedFromLibraryCall = false;
  // C1/piece-7: the delegate library this call targets is selector-dispatched (>= 2 public functions), so the
  // co-spend pin can also verify WHICH library function ran. A single-public-function library has no selector
  // in its unlocking script and nothing to choose, so the selector half is skipped there.
  librarySelectorDispatched = false;

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
    /** Hardhat console.sol entry point (log, logInt, logBytes32, ...). */
    public method = 'log',
  ) {
    super();
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitConsoleStatement(this);
  }
}

export type ConsoleParameterNode = LiteralNode | IdentifierNode;

/** The exact length of an array type whose bound is past Number.MAX_SAFE_INTEGER (`ArrayType.bound` rounds it). */
export const exactArrayBounds = new WeakMap<ArrayType, bigint>();

/** A bounded array type's exact length (undefined when unbounded). */
export function exactArrayLength(type: ArrayType): bigint | undefined {
  return type.bound === undefined ? undefined : exactArrayBounds.get(type) ?? BigInt(type.bound);
}
