export interface ResolvedImport {
  source: string;  // The source code of the imported file
  id: string;      // Canonical identifier (for dedup + nested import context)
}

export type ImportResolverFn = (importPath: string, currentFile: string) => ResolvedImport | undefined;

export interface CompilerOptions {
  enforceFunctionParameterTypes?: boolean;
  enforceLocktimeGuard?: boolean;
  // Treat a spending path that performs no require()/verification and changes no state as a hard error
  // (FinalRequireStatementError) rather than the default warning. Such a path compiles to an
  // unconditionally-spendable script; enable this to enforce that every path is guarded (e.g. in CI).
  enforceFinalRequire?: boolean;
  commitmentLimit?: number;
  importResolver?: ImportResolverFn;
  rootFileId?: string;
  // Per-library inline override (keyed by library name, e.g. 'keccak256'): true = always inline the blob
  // into the contract, false = always use a side-car. Omitted = auto (inline when used once).
  inlineLibraries?: Record<string, boolean>;
  // Disable the auto-inline heuristic (small, single-call libraries inline by default). Explicit
  // inlineLibraries entries still apply.
  disableAutoInline?: boolean;
  // Solidity-source compatibility: resolve `.sol` imports as solidcash sources, accept `pragma solidity`,
  // and skip the pragma version check. For porting Solidity codebases.
  solidityImportCompat?: boolean;
  // User-supplied external libraries (script precompiles). Each registers `name(...)` as a callable with
  // the given ABI signature, backed by the hex `code` blob. Merged with the built-in libraries.
  userLibraries?: { name: string; code: string; abi: { inputs: AbiInput[]; outputs: AbiOutput[] } }[];
  // Phase-2 scaffold (default false): route an unbounded fixed-width `T[]` state var to the dense
  // chunk-packed backend (uint32 length header + chunk UTXOs) instead of the sparse entry-NFT collection.
  // Will become the default for fixed-width `T[]` once the codegen/SDK land. See docs/arrays.md.
  chunkedArrays?: boolean;
  // block.chainid network constant, baked as a single byte (chainId & 0xff). Convention:
  // mainnet 0, chipnet 1, testnet4 2, regtest -1 (0xff). User-land; see docs/block-and-transaction-properties.md.
  chainId?: number;
  // Brand a delegate library: its covenant verifies the co-spent proxy master's category == the library's
  // `__brand` ctor arg, so the library is spendable only alongside its owning consumer's master (rides one
  // master's serialization, zero marginal contention). See docs/library-contracts.md (3b contention).
  brandLibrary?: boolean;
  // Compile a contract that has ZERO state variables (and no collections) as a STATEFUL contract anyway: it
  // gets an empty stateLayout `{ variables: [] }` and the master-NFT self-preservation covenant, so a pure
  // covenant check (e.g. `require(block.chainid == e)`) can be spent with the short `sc.check(e).send()` call
  // instead of a hand-rolled TransactionBuilder. No dummy state field needed. See docs/stateful-contract-sdk.md.
  forceStateful?: boolean;
  // EXPERIMENTAL: use a runtime linear-memory model (a threaded byte buffer + free pointer) for local `memory`
  // reference types (structs, dynamic arrays), where references are integer pointers and a nested lvalue write
  // (`s.ts[j].y = v`) is an address-chain + single in-place store - matching solc's memory semantics and
  // composing across multiple writes (the value-copy model does not). Off by default; see
  // docs/experimental-memory-model.md. Reversible.
  experimentalMemoryModel?: boolean;
}

export interface AbiInput {
  name: string;
  type: string;
  indexed?: boolean;
}

export interface EmitAbi {
  eventName: string;
  eventSignature: string;
  emitIndex: number;
}

export interface TokenContainerAccessAbi {
  keyParam: string;
  operations: readonly string[];
  transferCount?: number;      // number of transfer() calls (>1 for fan-out)
  transferNftCount?: number;   // number of transferNft() calls (>1 for fan-out)
}

// A positional argument to a delegate-library call (`L.f(...)`). Either a forwarded enclosing-function
// parameter (resolved from the consumer call at spend time) or a compile-time literal encoded as a string with
// its kind (the SDK reconstructs: int -> BigInt, bool -> ===\"true\", bytes -> hexToBin, string -> as-is).
export type LibraryCallArg =
  | { param: string }
  | { literal: string; kind: 'int' | 'bool' | 'bytes' | 'string' };

export interface AbiOutput {
  type: string;
}

/** Kinds of slots in the 1:1 block layout. */
export type BlockSlotKind =
  | 'master'
  | 'dataNft'
  | 'readOnlyDataNft'
  | 'blockhashOracle'
  | 'entry'
  | 'satoshiContainer'
  | 'tokenContainer'
  | 'transfer'
  | 'tcTransfer'
  | 'event'
  | 'returnEvent'
  | 'deploy'
  | 'lowLevelCall';

/** A single slot in the function's block layout. */
export interface BlockLayoutSlot {
  kind: BlockSlotKind;
  offset: number;           // compile-time offset from block start (= from master)
  slotIndex?: number;       // for entry/tokenContainer/transfer/event/tcTransfer
  nftIndex?: number;        // for dataNft/readOnlyDataNft
  conditional?: boolean;    // true if slot may be inactive (in if/else branch)
  // entry: a branch delete lowered to an existence-gated soft-delete write (SDK derives it as a write, not a drop)
  softDelete?: boolean;
}

/** 1:1 input/output block layout for a stateful function. */
export interface FunctionBlockLayout {
  blockSize: number;         // total number of slots in this contract's block
  slots: readonly BlockLayoutSlot[];
}

export interface AbiFunction {
  name: string;
  selector?: string;  // 4-byte hex selector (e.g. "a9059cbb")
  inputs: readonly AbiInput[];
  outputs?: readonly AbiOutput[];       // return types (omitted for void functions)
  modifiers?: readonly string[];        // function modifiers (omitted if default external)
  requiredNftIndices?: readonly number[];  // sorted NFT indices this function accesses (absent = all)
  entryAccesses?: readonly EntryAccessAbi[];
  externalReads?: readonly ExternalReadAbi[];
  externalCalls?: readonly ExternalCallAbi[];
  externalOutStateReads?: readonly ExternalOutStateAbi[];
  emits?: readonly EmitAbi[];
  transferCount?: number;
  deployTargets?: readonly {
    contractName: string; dataNftCount: number;
    // Per child constructor argument: the deploy-function parameter name it forwards (direct `new C(param)`),
    // or null for a non-trivial expression. Lets the SDK derive childConstructorArgs from the deploy args.
    constructorArgs?: readonly (string | null)[];
    // create2 salt (`new C{salt}()`): forwarded param name, hex literal, or computed (SDK needs explicit
    // childSalt). Lets the SDK build the child Contract with the salt the deploy covenant pins.
    salt?: { param: string } | { literal: string } | { computed: true };
  }[];
  tokenContainerAccesses?: readonly TokenContainerAccessAbi[];
  usesMsgSender?: boolean;
  unsafeTier?: number;
  splitCountParam?: string;
  mergeCountParam?: string;
  lowLevelCalls?: readonly { callMode: 'call' | 'staticcall' | 'delegatecall'; dataParamIndex?: number }[];
  // Delegate-library calls (`L.f()`); the SDK auto-wires each one's delegatecall co-spend from a registered
  // library instance (registerLibrary). `args` are positional: a forwarded enclosing-function parameter (the SDK
  // reads its value from the consumer call) or a compile-time literal. See docs/library-contracts.md (3b).
  libraryDelegateCalls?: readonly {
    library: string; functionName: string; args?: readonly LibraryCallArg[];
  }[];
  collectionIterations?: readonly CollectionIterationAbi[];
  // Persisted dynamic-storage vars read on-chain; the SDK co-spends their chunks as read-only inputs.
  dynamicReads?: readonly string[];
  // Dynamic-storage vars written on-chain; the SDK consumes their old chunks and creates the new ones.
  dynamicWrites?: readonly string[];
  // Function params whose value feeds blockhash(n); the SDK reads the arg to resolve addr(n) and co-spend
  // the (n->hash) oracle UTXO as a trailing input.
  blockhashReads?: readonly string[];
  blockLayout?: FunctionBlockLayout;
  isFallback?: boolean;
  isReceive?: boolean;
  externalLibraries?: readonly string[];  // names of external script libraries this function uses (e.g. 'keccak256')
  externalLibraryCalls?: Readonly<Record<string, number>>;  // per-library call-site count (sizes the SDK budget pad)
}

export interface CollectionIterationAbi {
  collection: string;
  mode: 'entries' | 'keys' | 'values';
  iterationIndex: number;
}

export interface FunctionDebugInformation {
  requires: readonly RequireStatement[];
  sourceMap: string;
  logs: readonly LogEntry[];
}

export interface DebugInformation {
  bytecode: string; // unlike `bytecode` property above, this is a hex-encoded binary string
  sourceMap: string; // see documentation for `generateSourceMap`
  logs: readonly LogEntry[]; // log entries generated from `console.log` statements
  requires: readonly RequireStatement[]; // messages for failing `require` statements
  functionDebug?: Record<string, FunctionDebugInformation>; // per-function debug info keyed by selector hex
}

export interface LogEntry {
  ip: number; // instruction pointer
  line: number; // line in the source code
  data: readonly LogData[]; // data to be logged
}

export interface StackItem {
  // Type of the variable
  type: string;
  // Index of the variable on the stack (at the time of the specified instruction pointer)
  stackIndex: number;
  // Instruction pointer at which we can access the logged variable
  ip: number;
  // Operations to apply to the debug state at the specified instruction pointer to make sure that the variable is
  // on the correct position on the stack. This is used when we're optimising bytecode where the logged variable is
  // an intermediate result that existed in the unoptimised bytecode, but no longer exists in the optimised bytecode.
  transformations?: string;
}

export type LogData = StackItem | string;

export interface RequireStatement {
  ip: number; // instruction pointer
  line: number; // line in the source code
  message?: string; // custom message for failing `require` statement
}

export interface StateVariableInfo {
  name: string;
  type: string;
  nftIndex: number;
  fieldIndex: number;
  visibility?: string;  // 'external' | 'internal' | 'private' - omitted when 'public' (default)
  immutable?: boolean;  // true when variable can only be assigned in constructor - omitted when false (default)
  contractType?: string;  // contract/interface name when type is a contract reference (e.g. 'MarketplaceV1')
  packed?: boolean;  // true when array is stored as packed blob in data NFT - omitted when false (default)
  // true for dynamic-storage vars (string / unbounded bytes): the data-NFT field holds a uint32 length
  // header (<name>$len) and the value lives in chunk UTXOs. Omitted when false. See dynamic-storage.md.
  dynamic?: boolean;
}

export interface CollectionInfo {
  name: string;
  signature: string;  // "balances:mapping(pubkey => int)" - unique collection key
  kind: 'mapping' | 'array';
  keyType: string;
  valueType: string;
  /** Present for nested mappings - all key types from outer to inner. */
  keyTypes?: string[];
  /** Optional name annotation for the mapping key (documentation only). */
  keyName?: string;
  /** Optional name annotation for the mapping value (documentation only). */
  valueName?: string;
  /** For nested mappings - all key names from outer to inner (documentation only). */
  keyNames?: string[];
  /** Present for arrays - the element type. */
  elementType?: string;
  /** Present for static arrays - the fixed size. */
  bound?: number;
  /** True when collection can only be assigned in constructor - omitted when false (default). */
  immutable?: boolean;
}

export interface KeySourceAbi {
  kind: 'param' | 'state' | 'expression' | 'stateArrayLast' | 'constant';
  paramName?: string;
  stateVarName?: string;
  stateArrayName?: string; // kind='stateArrayLast': `arr[arr.length-1]` - SDK resolves the array's last element
  constantValue?: string;  // kind='constant': compile-time-resolved uint key value (decimal string)
  expressionLabel?: string;
}

export interface EntryAccessAbi {
  collection: string;
  keyParams: string[];
  keySources?: readonly KeySourceAbi[];  // optional for backward compat with old artifacts
  operations: readonly string[];
  // A write slot gated off when its key aliases the delete slot at this index (swap-remove of the last key).
  aliasCondDeleteSlot?: number;
}

export interface ExternalReadAbi {
  interfaceName: string;
  kind: 'data' | 'entry';
  nftIndex?: number;
  collectionName?: string;
  collectionSignature?: string;
  addressParam?: string; // name of the constructor parameter providing the callee address (locking bytecode)
}

export interface ArgSource {
  kind: 'forward' | 'constructorArg' | 'literal' | 'expression';
  paramIndex?: number;     // for 'forward': index into the user-visible function args
  paramName?: string;      // for 'constructorArg': name of the constructor parameter
  value?: string;          // for 'literal': serialized value
  type?: string;           // for 'literal': SolidCash type string
}

export interface ExternalCallAbi {
  interfaceName: string;
  functionName: string;
  addressParam?: string;
  addressStateVar?: string; // interface-typed state var holding the callee address (read from state, not caller-provided)
  addressLiteral?: string; // code-baked literal address target IFoo(0x..).m(): covenant pushes this constant (un-seedable)
  loopArrayVar?: string; // state array of callee addresses: every element is co-spent + loop-verified (IFoo(arr[i]).m())
  addressIsMsgSender?: boolean; // target is msg.sender: the SDK co-spends the caller-designated msg.sender contract
  requiredDataNftIndices: number[];
  hasReturnValues?: boolean;
  returnTypes?: readonly string[];
  returnEventSignature?: string;
  computedOffset?: number;
  callMode?: 'call' | 'staticcall' | 'delegatecall';
  opaqueReturn?: boolean; // `(bool,bytes)=addr.call(payload)`: opaque integrity-bound return, callee unknown at compile time
  argSources?: readonly ArgSource[];
}

export interface ExternalOutStateAbi {
  interfaceName: string;
  addressParam?: string;
  requiredDataNftIndices: number[];
}

export interface ExternalInterfaceInfo {
  name: string;
  stateLayout: StateLayout;
  abi?: readonly { name: string; inputs: readonly AbiInput[]; selector?: string; usesMsgSender?: boolean }[];
}

export interface StructDefinitionInfo {
  name: string;
  fields: readonly { name: string; type: string }[];
}

export interface EventDefinitionAbi {
  name: string;
  signature: string;
  parameters: readonly AbiInput[];
  anonymous?: boolean;
}

export interface ErrorDefinitionAbi {
  name: string;
  signature: string;
  parameters: readonly AbiInput[];
}

export interface EnumDefinitionAbi {
  name: string;
  members: readonly { name: string; value: number | string }[];
}

export interface StateLayout {
  variables: readonly StateVariableInfo[];
  dataNftCount: number;
  commitmentLimit: number;
  constructorInputs?: readonly AbiInput[];
  deployReads?: readonly DeployReadHint[];
  collections?: readonly CollectionInfo[];
  mappings?: readonly CollectionInfo[];
  structs?: readonly StructDefinitionInfo[];
}

/**
 * A constructor external read hoisted to a deploy input (see docs/deploy-external-reads.md). The value is
 * resolved off-chain at deploy by reading `read` (a state var / getter) from the contract of type `contractType`
 * at the address held by constructor input `addressInput`. The SDK can auto-resolve it (resolveDeployReads) when
 * that contract's artifact is registered; otherwise the deployer supplies `input` directly.
 */
export interface DeployReadHint {
  input: string;        // synthesized constructor input to fill, e.g. '__ctorread_pool_token0_0'
  addressInput: string; // constructor input holding the target contract's address, e.g. '_pool'
  contractType: string; // the target's interface/contract type name, e.g. 'IUniswapV3Pool'
  read: string;         // the state var / getter to read from the target, e.g. 'token0'
}

/**
 * An external script library the contract loads at runtime from a co-spent side-car UTXO
 * (introspection + OP_DEFINE + OP_INVOKE). The SDK deploys the side-car once with the contract and
 * co-spends it for any call that uses the library. See keccak-poc/INTEGRATION.md.
 */
export interface ExternalLibraryAbi {
  name: string;       // the builtin resolves its library by this name (e.g. 'keccak256')
  blobHash: string;   // hash256 of the library script blob; matches the integrity check in the bytecode
  branded: boolean;   // true: side-car address salted with the contract category (per-contract); false: shared
  inline?: boolean;   // true: blob embedded in the contract redeem (no side-car); false: loaded from a side-car
  codeBegin?: number; // byte offset where the blob begins in the side-car input bytecode
  codeEnd?: number;   // ... and ends (the range the loader strips to)
  abi?: { inputs: readonly AbiInput[]; outputs: readonly AbiOutput[] };  // call signature, e.g. (bytes) -> bytes32
  code?: string;      // hex blob; present for user-supplied libraries
}

export interface Artifact {
  contractName: string;
  constructorInputs: readonly AbiInput[];
  abi: readonly AbiFunction[];
  bytecode: string;
  source: string;
  debug?: DebugInformation;
  functionBodies?: Record<string, string>; // selector hex -> hex-encoded function body bytecode
  fingerprint?: string; // SHA256 of the normalized bytecode pattern (BCH bytecode fingerprinting standard)
  stateLayout?: StateLayout;
  externalInterfaces?: readonly ExternalInterfaceInfo[];
  events?: readonly EventDefinitionAbi[];
  errors?: readonly ErrorDefinitionAbi[];
  enums?: readonly EnumDefinitionAbi[];
  externalLibraries?: readonly ExternalLibraryAbi[];  // external script libraries this contract depends on
  isLibrary?: boolean;  // compiled from a `library` (stateless contract class); see docs/library-contracts.md
  brandedLibrary?: boolean;  // delegate library branded to its consumer's category; SDK supplies the __brand arg
  usesBlockhash?: boolean;  // contract reads blockhash(n); keeper maintains the (n->hash) oracle
  compiler: {
    name: string;
    version: string;
    options?: CompilerOptions;
  }
  updatedAt: string;
}

/**
 * All artifacts produced by one compilation, keyed by declaration name - every top-level concrete contract,
 * library, and contract-less declaration (interface, etc.). Mirrors solc's Standard-JSON `contracts[name]`
 * shape. Returned by `compileStringMulti` / `compileFileMulti`. See docs/multi-contract-artifacts.md.
 */
export type ArtifactMap = Record<string, Artifact>;

export function formatArtifact(artifact: Artifact, format: 'json' | 'ts'): string {
  if (format === 'ts') {
    // We remove any undefined values to make the artifact serializable using stringifyAsTs
    const normalisedArtifact = JSON.parse(JSON.stringify(artifact));
    return `export default ${stringifyAsTs(normalisedArtifact)} as const;\n`;
  }

  return JSON.stringify(artifact, null, 2);
}

const indent = (level: number): string => '  '.repeat(level);

function stringifyAsTs(obj: any, indentationLevel: number = 1): string {
  // For strings we use JSON.stringify to handle escaping, but we want to use single quotes instead of double quotes
  // around string values inside objects, to match regular TS style
  if (typeof obj === 'string') {
    return `'${JSON.stringify(obj).replace(/'/g, "\\'").replace(/\\"/g, '"').slice(1, -1)}'`;
  }

  // Numbers and booleans are just converted to strings
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return JSON.stringify(obj);
  }

  // Arrays are recursively formatted with indentation
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const formattedItems = obj.map((item) => `${indent(indentationLevel)}${stringifyAsTs(item, indentationLevel + 1)}`);
    return `[\n${formattedItems.join(',\n')},\n${indent(indentationLevel - 1)}]`;
  }

  // Objects are recursively formatted with indentation
  if (typeof obj === 'object') {
    const entries = Object.entries(obj);

    if (entries.length === 0) return '{}';

    const formattedEntries = entries.map(([key, value]) => {
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key.replace(/'/g, "\\'")}'`;
      return `${indent(indentationLevel)}${safeKey}: ${stringifyAsTs(value, indentationLevel + 1)}`;
    });
    return `{\n${formattedEntries.join(',\n')},\n${indent(indentationLevel - 1)}}`;
  }

  throw new Error(`Unsupported type: ${typeof obj}`);
}
