import { Type, PrimitiveType, BytesType, MappingType, ArrayType, StructType, EnumType, ValueType, TupleType, FunctionBlockLayout, LibraryCallArg } from '@solidcash/utils';
import { TimeOp } from './Globals.js';
import AstVisitor from './AstVisitor.js';
import { BinaryOperator, NullaryOperator, UnaryOperator } from './Operator.js';
import { Location } from './Location.js';
import { YulBlockNode } from './YulAST.js';
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
  // Set by SynthesizeBlockOracle when any function reads blockhash(n). The (n->hash) oracle is branded to the
  // contract's OWN category (master-bound, per docs/block-and-transaction-properties.md s3), so a blockhash
  // reader MUST be stateful (have a master/category to co-spend + anchor the oracle against).
  usesBlockhash: boolean = false;
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
  // Validation-only provenance for inherited fallback/receive declarations.
  // These special functions historically are not copied into the flattened BCH
  // entry points, so retain only override metadata rather than cloning bodies.
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
}

export interface EntryAccessInfo {
  collection: string;
  collectionSignature: string;  // for covenant hash computation
  keyParams: string[];          // kept for backward compat
  keySources: KeySourceInfo[];  // detailed source info per key
  operations: ('read' | 'write' | 'delete')[];
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
  // A sorted (vmap) mapping WRITE of an unbounded bytes/string value from a direct function parameter. The entry
  // commitment stores only len ++ sha256(value); the SDK persists the full value as chunks (P5b) using this
  // param's runtime argument. Undefined when the value is a computed expression (chunk persistence guarded off).
  valueParam?: string;
  // Canonical whole-value expression used by the SDK when it can be evaluated off-chain (notably literals).
  valueSource?: string;
}

export interface TokenContainerAccessInfo {
  keyParam: string;           // function parameter name used as category key
  keySource?: 'param' | 'own'; // own = contract category, derived by covenant introspection
  operations: ('read' | 'transfer' | 'transferNft')[];
  slotIndex: number;
  transferCount: number;      // number of transfer() calls for this category
  transferNftCount: number;   // number of transferNft() calls for this category
}

// X29. Owner-local effect frames an message-bus batch route reserves on behalf of an effect-carrying graph emission handler
// it invokes behind OP_INVOKE. Dispatch site `s` owns `[base + s * width, base + s * width + width)` of each
// kind; the site ordinal rides to the shared subroutine as hidden context.
export interface GraphEffectFrame {
  sites: number;
  eventBase: number;
  eventWidth: number;
  transferBase: number;
  transferWidth: number;
}

export interface CustomModifierInvocation {
  name: string;
  args: ExpressionNode[];
  location: Location;
}

export class FunctionDefinitionNode extends Node implements Named {
  symbolTable?: SymbolTable;
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
  /** Compiler-owned message-bus handler mapping from its function-local entry
   * slot ordinals to the enclosing route's physical participant slots. */
  messageBusPhysicalEntrySlots?: number[];
  /** Physical route entry slots whose transition covenant is emitted by a message-bus handler subroutine. */
  messageBusHandlerManagedEntrySlots?: number[];
  tokenContainerAccesses?: TokenContainerAccessInfo[];
  externalReads?: ExternalReadSlot[];
  externalCalls?: ExternalCallSlot[];
  externalOutStateReads?: ExternalOutStateSlot[];
  emitInfos?: EmitInfo[];
  transferInfos?: TransferInfo[];
  deployTargets?: {
    contractName: string; dataNftCount: number;
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
  }[];

  lowLevelCalls?: { callMode: 'call' | 'staticcall' | 'delegatecall'; dataParamIndex?: number }[];
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
    collection: string; fixedKeyParams: string[]; varyingArrayParam: string;
    keyDecodeTupleIndex?: number; keyDecodeTupleTypes?: string[];
    predicateArrayParam?: string; predicateEquals?: string;
    valueArrayParam?: string; valueScalarParam?: string; valueConst?: string;
    valueRuntimeLocal?: string;
    valueRuntimeExpression?: boolean;
    valueArrayOffset?: string;
    mutation?: 'push' | 'pop' | 'setAt';
    mutationValueArrayParam?: string; mutationValueScalarParam?: string; mutationValueConst?: string;
    mutationIndexArrayParam?: string; mutationIndexScalarParam?: string; mutationIndexConst?: string;
    oldValuesWitnessParam?: string;
    op: '+' | '-' | 'set' | 'delete';
  }>;

  // Fixed straight-line vmap writes grouped into one atomic list transition. Slot indices refer to entryAccesses.
  sortedBatchInfo?: Array<{ collection: string; slotIndices: number[] }>;
  // Function parameters whose value feeds blockhash(n); recorded during codegen. SDK reads the arg to resolve
  // addr(n) and co-spend the (n->hash) oracle UTXO as a trailing input (mirrors dynamicReads auto-injection).
  blockhashReads?: string[];
  // Set by SynthesizeBlockOracle when the function reads blockhash(n); SymbolTable then injects the hidden
  // __internal__blockhashInputIndex param (the co-spend's input index) so the read survives composition.
  usesBlockhash?: boolean;
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
  // Release 3: helper was lowered to a value-threaded collection journal.
  collectionJournal?: boolean;
  /** Compiler-owned batch clone: journal it through the wrapper's shared entry pool even when it touches a
   * single entry, so sibling handlers over the same entry resolve to one pending value and one vmap slot. */
  forceCollectionJournalPool?: boolean;
  // Compiler-only message-bus batch physical route; dispatched on the reserved selector but
  // omitted from the source ABI.
  messageBusRoute?: boolean;
  messageBusMaximumRows?: number;
  /** Compiler-owned message-bus batch blockhash band. Each logical row owns `readWidth` consecutive oracle slots. */
  messageBusBlockhashReadWidth?: number;
  messageBusBlockhashReads?: {
    row: number; selector: string; readOrdinal: number; readKey: string; slotOffset: number;
  }[];

  messageBusEligible?: boolean;
  messageBusRejectionReason?: string;
  // Release 4 collection rows bind source argument positions to hidden
  // physical-route key witnesses. The SDK derives these from canonical rows;
  // the route compares decoded row arguments before any handler executes.
  messageBusKeyWitnesses?: {
    routeInput: string;
    inputIndex: number;
    source?: 'argument' | 'msgSender';
    perRow?: boolean;
  }[];

  /** Canonical Solidity `batch(bytes[],bool)` executed through BCH's ordered local message-bus journal. */
  nativeSelfBatchDispatcher?: boolean;

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
  usesMsgSender?: boolean;
  usesMsgValue?: boolean;
  /**
   * Compiler-owned message-bus batch clone whose one supported tail external call is verified against the authenticated
   * participant emission frame instead of performing ordinary physical-call settlement.
   */
  graphEmissionHandler?: boolean;
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
  keccakInLoop?: boolean;       // a keccak256 call is inside a loop -> runtime count exceeds the static count;
  // the SDK should foresee extra side-car strain (deploy more than the syntactic count)
  keccakLoopReads?: boolean;    // a stateful dynamic keccak loop reads N trailing side-cars (SDK progressively
  // co-spends N = runtime iteration count into the trailing region [blockSize, ..))
  ecrecoverLoopReads?: boolean; // a dynamic ecrecoverPubKey loop reads one recovery PAIR per iteration from the
  // forward region [master+1+2k]; the SDK co-spends N pairs (N = the sig-array length)
  ecrecoverCompute?: boolean;   // ecrecoverPubKey uses a co-spent recovery side-car PAIR (A+B) per call; the SDK
  // auto-co-spends them and the contract reads the recovered pubkey from B's output
  ecrecoverArgParams?: ((string | null)[])[]; // per ecrecoverPubKey call (codegen emission order): the [hash,v,r,s]
  // param names feeding it (SDK transparent co-spend); null entry = not a direct param
  ecrecoverCallCount?: number;  // number of ecrecoverPubKey calls (stateless count-relative side-car indexing)
  ecrecoverEvmCallCount?: number; // number of ecrecoverEvm calls; each ALSO co-spends a keccak side-car (over the
  // uncompressed key), appended after all recovery pairs (shifts recovery offsets by E)
  ecrecoverEvmFlags?: boolean[]; // per ecrecover call (emission order): is it the evm projection? (SDK keccak co-spend)
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

export abstract class StatementNode extends Node { }

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
    // handled by MappingAccess.arrayIndex / the nested-array RMW lowering, not as collection keys.
    if (current instanceof MappingType) {
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
  // Exact method carried by a statically known external-function-pointer value whose runtime expression is not
  // itself a direct function reference (for example `function() external f = callbacks[1]`).
  functionPointerMethodAlias?: string;
  // Original literal bytes when LowerMemoryModel rewrites a `bytes memory` declaration into a numeric pointer.
  // Yul create-address lowering still needs the compile-time blob after that representation change.
  memoryLiteralValue?: Uint8Array;

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
  deployedStateVars: StateVariableNode[] = [];
  // Deploy-then-call fold: a same-tx `a.foo(x)` on this deploy result is folded into the genesis - the
  // child is deployed in its post-foo state. Maps a child state-var name to the (parent-context) expression
  // its value should hold; the deploy covenant emits this instead of the default for that field.
  foldedStateInit?: Map<string, ExpressionNode>;
  // The child has a constructor whose writes could NOT be folded: the true genesis of unwritten fields is
  // unknown, so later call-folds must not resolve their reads to type defaults.
  ctorFoldFailed?: boolean;

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
  // Solidity before 0.8 permits unsigned negation and evaluates it modulo the
  // destination width (e.g. `d & -d` in FullMath).
  legacyWrappingNegation = false;

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
  arrayType?: ArrayType;
  fromModifier?: string; // see StateAssignNode.fromModifier (inlined-helper origin for the private-collection check)

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
  // Exact byte spelling of a Solidity-compatible ordinary string literal. `\xNN` escapes are raw bytes, so this
  // can differ from UTF-8 encoding `value` (e.g. "\xff"). Type checking uses it for bytes destinations and to
  // reject malformed UTF-8 only when the destination is actually string.
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
  calleeMultiNft: boolean; // callee spans >1 data NFT -> its commitments carry an nftIndex tag to verify
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
  /** Ordered row identity within one inferred repeated-callee message-bus batch. */
  externalBatchLogicalIndex?: number;
  callMode?: ExternalCallMode;
  callOptions?: CallOptions;
  valueTransferIndex: number = -1;
  // Set when this call on a freshly-deployed local was folded into the deploy genesis (no co-spend): the
  // node is inert - skipped by external-call collection and codegen.
  foldedIntoDeploy?: boolean;
  // EVM-parity expression-form low-level call `(bool, bytes) = addr.call(payload)`: the callee's type/function
  // are unknown at compile time, the return is read as a single opaque bytes blob, identity-bound to addr.
  opaqueReturn?: boolean;
  // Set for a same-address varying-method function pointer `f = cond ? c.a : c.b; f(args)`: the RUNTIME selector
  // expression (`cond ? c.a.selector : c.b.selector`). Codegen stashes it into a temp and the covenant asserts
  // the co-spent callee's selector == it (instead of the compile-time witness), binding the co-spent method to
  // `cond`. One co-spend, one epilogue verification (no per-branch duplicate).
  runtimeSelector?: ExpressionNode;
  // Foreign fn-ptr ARRAY dispatch table with per-element methods: the parallel `bytes4[]` state array of
  // per-element selectors; the array-call loop asserts the co-spent callee's selector == sel[i].
  selectorArrayVar?: string;

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
  kind: 'forward' | 'constructorArg' | 'literal' | 'msgSender' | 'selfAddress' | 'arrayElement' | 'expression';
  paramIndex?: number;
  indexParamIndex?: number;
  indexValue?: number;
  paramName?: string;
  value?: string;
  type?: string;
  expression?: ExternalCallExpression;
}

export interface ExternalCallExpression {
  kind: string;
  name?: string;
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
}

export interface ExternalCallSlot {
  interfaceName: string;
  functionName: string;
  addressParam?: string;
  addressStateVar?: string; // interface-typed state var holding the callee address (read from state)
  // Code-baked address literal target `IFoo(0x..).m()` (hex): the covenant pushes this constant as the
  // expected address instead of reading a param/state - caller-independent. A non-locking-bytecode literal
  // (e.g. a 20-byte ETH address) makes the identity check un-satisfiable (fails closed). Never a caller input.
  addressLiteral?: string;
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
  addressSource?: ExternalCallArgSource;
  slotIndex: number;
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
  // Same-address varying-method pointer: the RUNTIME selector expression (`cond ? a.selector : b.selector`).
  // The epilogue evaluates it and asserts the co-spent callee's selector == it, instead of the witness param.
  runtimeSelector?: ExpressionNode;
  // Foreign fn-ptr ARRAY dispatch table with per-element methods: the parallel `bytes4[]` state array holding
  // each element's selector. The array-call loop reads sel[i] and asserts the co-spent callee's selector == it,
  // instead of a single broadcast witness. Set alongside loopArrayVar for a varying-method table.
  selectorArrayVar?: string;
  callMode?: ExternalCallMode;
  argSources?: ExternalCallArgSource[];
  rawFunctionName?: string;
  rawArgSources?: ExternalCallArgSource[];
  /** Decoded arguments/types for an `abi.encodeCall` low-level payload. Compiler-internal only. */
  rawParameters?: ExpressionNode[];
  rawParameterTypes?: Type[];
  rawSelector?: Uint8Array;
  rawInterfaceName?: string;
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
    argSources?: ExternalCallArgSource[];
    opaqueReturn?: boolean;
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
  calleeMultiNft: boolean; // callee spans >1 data NFT -> its commitments carry an nftIndex tag to verify
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
  callOptions?: CallOptions;
  valueTransferIndex: number = -1; // temporary carrier for pre-scan before transformation
  fieldNames?: string[]; // set for named-arg calls obj.f({a: x}); reordered against the callee's params
  // Set by DesugarExternalFunctionPointers for a same-address varying-method pointer call: the runtime selector
  // expression (`cond ? c.a.selector : c.b.selector`); threaded to the external call node in semantic analysis.
  runtimeSelector?: ExpressionNode;
  // Set by LowerForeignFunctionPointerArrayElements for a varying-method array dispatch table: the parallel
  // `bytes4[]` state array of per-element selectors; threaded to the external call slot in semantic analysis.
  selectorArrayVar?: string;
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
  eventQualifier?: string;
  emitIndex: number = 0;
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
  // Set by Yul lowering for `return(ptr, size)`: this is an EVM halt with a raw byte region, not a Solidity
  // source-level return whose expressions must match the enclosing function's declared ABI returns.
  isYulReturn: boolean = false;
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
