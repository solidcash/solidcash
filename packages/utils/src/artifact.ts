export interface ResolvedImport {
  source: string;  // The source code of the imported file
  id: string;      // Canonical identifier (for dedup + nested import context)
}

export type ImportResolverFn = (importPath: string, currentFile: string) => ResolvedImport | undefined;

export interface CompilerOptions {
  /** Validation ceiling for private/mock networks; defaults to BCH's 10,000-byte consensus limit. */
  maximumInputBytes?: number;
  /** Internal second-pass input used to replace the in-master verifier with a pinned compact binder. */
  __messageBusVerifierProgram?: {
    verifyFunctionId: number;
    inputCount: number;
    inputs: readonly AbiInput[];
    functions: readonly { id: number; name: string; bytecode: string }[];
  };
  enforceFunctionParameterTypes?: boolean;
  enforceLocktimeGuard?: boolean;
  // Treat a spending path that performs no require()/verification and changes no state as a hard error
  // (FinalRequireStatementError) rather than the default warning. Such a path compiles to an
  // unconditionally-spendable script; enable this to enforce that every path is guarded (e.g. in CI).
  enforceFinalRequire?: boolean;
  commitmentLimit?: number;
  // EVM byte-parity mode for the abi.* family (temporary gate; to be dropped once parity is green). Under
  // evmCompat, abi.encode/encodePacked emit EVM-faithful bytes: 32-byte big-endian two's-complement words.
  evmCompat?: boolean;
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
  // Solidity `ecrecover(hash, v, r, s)` alias mode (porting). Solidity's builtin has no bare-name analogue in
  // SolidCash; this maps it to a real recovery projection: 'p2pkh' = the signer's native BCH P2PKH address
  // (native cross-compilation), 'evm' = the 20-byte keccak EVM address. Omitted = `ecrecover` stays undefined.
  // See docs/ecrecover.md.
  ecrecover?: 'p2pkh' | 'evm';
  // INTERNAL. Set only on the compiler's second pass to produce artifact.delegateArtifact: auto-marks the
  // proxy-implementable functions `delegate` so source never needs the keyword (Solidity has none). Not a user
  // option; setting it yields the delegate variant as the primary artifact.
  autoDelegate?: boolean;
  // Compiler-generated atomic composition route and write-back journal. Omitted selects automatically from
  // source-level atomic call-graph edges; `true` requires a composable route (and fails instead of falling back),
  // while `false` requests direct-only compilation and is rejected when semantic analysis finds a transaction
  // shape that cannot be built without one shared message bus.
  messageBus?: boolean;
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
  | 'keccakSideCar'
  | 'ecrecoverSideCar'
  | 'entry'
  | 'satoshiContainer'
  | 'tokenContainer'
  | 'transfer'
  | 'tcTransfer'
  | 'event'
  | 'returnEvent'
  | 'deploy'
  | 'lowLevelCall'
  | 'trailing';

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
  /** First local slot of the bounded runtime-variable resource region. */
  trailingBase?: number;
  /** Number of balanced slots reserved for chunks, loop entries, and loop sidecars. */
  trailingCapacity?: number;
}

/**
 * Where a value the covenant depends on came from in the source the artifact was compiled from.
 *
 * The published TYPE of a value answers nothing about who chose it: `address t = address(target)` with
 * `target` a `bytes` parameter reaches a delegatecall as an `address`, and every admitted delegate class
 * carries a `bytes` calldata parameter, so refusing the type is not available. This is the semantic answer.
 *
 * - `constructorArg` - a contract constructor parameter. Committed into the contract's p2sh32, so it is fixed
 *   for a given address and no spender can vary it.
 * - `stateVar` - a persisted state variable. Varies only through the contract's own authorized writes.
 * - `literal` - a compile-time constant baked into the script.
 * - `parameter` - a function parameter the CALLER supplies at spend time. Nothing about it is committed.
 * - `computed` - anything else: an expression, an external read, a reassigned local, an alias chain the
 *   compiler could not follow. Unknown, never a proof of safety.
 */
export type ValueProvenanceKind = 'constructorArg' | 'parameter' | 'stateVar' | 'literal' | 'computed';

export interface ValueProvenance {
  kind: ValueProvenanceKind;
  /** Source name, present for `constructorArg` / `parameter` / `stateVar` and absent otherwise. */
  name?: string;
}

export interface AbiFunction {
  name: string;
  selector?: string;  // 4-byte hex selector (e.g. "a9059cbb")
  inputs: readonly AbiInput[];
  outputs?: readonly AbiOutput[];       // return types (omitted for void functions)
  modifiers?: readonly string[];        // function modifiers (omitted if default external)
  requiredNftIndices?: readonly number[];  // sorted NFT indices this function accesses (absent = all)
  /**
   * Stateful contracts only. X176: THIS IS NOT "the handler changes a state variable", and it is read that way.
   *
   * `false` is the compiler's PROOF of read-only: no state or entry write, transfer, emit, deploy, external
   * call, delegate, dynamic write, split/merge, or covenant-bypass modifier. That is the reading an SDK may
   * act on - it lets a getter skip the multi-pass derivation probe (output state == input state), and
   * misclassifying a writer as read-only there fails CLOSED, because the covenant rejects the mismatched
   * output state.
   *
   * `true` is only the NEGATION of that proof - "not provably read-only", which in SDK terms is "needs the
   * state machinery". An external call sets it exactly as readily as an assignment does. MEASURED: at least
   * 2 of 7 handlers classified as explicit writers write nothing at all; one publishes `true` for a body of
   * `bar.log();`. Absent means unknown or stateless and is treated as writing.
   *
   * Do not re-derive this toward "mutates": the only consumer keys on `=== false` and needs the conservative
   * direction, so a narrower flag would make it fail OPEN. Use `StatefulContract.readWritesState` to get the
   * published evidence split into own-state versus other-effect causes.
   */
  writesState?: boolean;
  /** The state-handler closure contains direct or mutual recursion. SDKs must
   * resource-preflight the concrete invocation before returning a builder. */
  recursiveStateHandler?: boolean;
  /** Compiler-owned message-bus batch graph route: a fixed per-row band of authenticated blockhash oracle inputs. */
  graphBlockhashOracle?: {
    inputBaseParameter: '__internal__blockhashInputIndex';
    rowCount: number;
    readWidth: number;
    slotCount: number;
    reads: readonly {
      row: number; selector: string; readOrdinal: number; readKey: string; slotOffset: number;
    }[];
  };
  entryAccesses?: readonly EntryAccessAbi[];
  externalReads?: readonly ExternalReadAbi[];
  externalCalls?: readonly ExternalCallAbi[];
  /** Local call-result values forwarded as arguments into later external callsites. */
  resultConsumers?: readonly {
    consumerCallsiteId: number;
    argument: number;
    producerCallsiteId: number;
  }[];
  externalOutStateReads?: readonly ExternalOutStateAbi[];
  emits?: readonly EmitAbi[];
  transferCount?: number;
  transfers?: readonly {
    transferIndex: number;
    recipient: ArgSource;
    amount: ArgSource;
    callOption?: 'value';
  }[];
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
  /**
   * The signature check that authorizes this function, described by the key it is checked against.
   *
   * `key` is the WEAKEST key of every `checkSig` / `checkDataSig` / `checkMultiSig` in the body, ordered
   * `parameter` (the caller picks it outright) < `computed` (the compiler could not say) < `stateVar` <
   * `constructorArg` < `literal`. Weakest is the sound reading: guards in different branches are alternatives,
   * so the authority a spender actually has to defeat is the cheapest one. Two guards that BOTH have to pass
   * therefore read weaker than they are - a refusal, never an admission.
   *
   * Absent means no signature check was proven, whether because the body has none or because the artifact
   * predates this field. Both readings are "unguarded"; absent is never a proof of authority. Read it with
   * `signatureGuardKeyProvenance`.
   *
   * `keyCommitment` (X51) answers the question `key` alone cannot: a `parameter` key that an unconditional
   * top-level `require(hash160(key) == <x>)` pins is only as choosable as `<x>` is, so P2PKH-shaped authority
   * publishes `{key: {parameter, pk}, keyCommitment: {constructorArg, pkh}}` and an unpinned parameter key
   * publishes no `keyCommitment` at all. Read it with `signatureGuardKeyCommitment`; absent reads back as
   * `unknown`, never as "unconstrained".
   */
  signatureGuard?: { key: ValueProvenance; keyCommitment?: ValueProvenance };
  /** True only when a required signature check dominates every delegatecall in this function. */
  signatureGuardDominatesDelegatecalls?: boolean;
  unsafeTier?: number;
  splitCountParam?: string;
  mergeCountParam?: string;
  lowLevelCalls?: readonly {
    callMode: 'call' | 'staticcall' | 'delegatecall';
    dataParamIndex?: number;
    /**
     * Where the call's TARGET address came from. Published by every compiler that knows how to answer, with
     * `computed` as the always-available fallback, so an absent `target` identifies an artifact compiled
     * before the field existed - it is never a claim that the target is fixed. Read it with
     * `lowLevelCallTargetProvenance`, which makes that unknown leg explicit.
     */
    target?: ValueProvenance;
  }[];
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
  // Collections written by a runtime loop (`for(i<n) m[k[i]]=v[i]`); the SDK derives the N (key,value) pairs from
  // the VM trace and creates N trailing entry NFT outputs (a runtime-variable count, like dynamicWrites chunks).
  entryLoopWrites?: readonly string[];
  // Sorted (C2) collections written by a diff-key INSERT loop (`for(i<n) m[k[i]]=v`); the SDK co-spends N bracketing
  // predecessors and emits N (P', NEW) commitment pairs, deriving the evolving sorted list per iteration.
  sortedInsertLoops?: readonly string[];
  // Per-loop derivation metadata for the above: the fixed leading key params, the varying key array param (its
  // elements are the per-iteration last key), and the value (a param or a bool literal). Enough for the SDK to
  // compute each H(k) = keyToSlotMulti([...fixedKeys, arr[i]]) and build the co-spend/output plan off-chain.
  sortedInsertLoopInfo?: readonly SortedInsertLoopAbi[];
  sortedUpsertLoopInfo?: readonly SortedUpsertLoopAbi[];
  /** Fixed straight-line C2 writes sharing one atomic linked-list transition. */
  sortedBatchInfo?: readonly { collection: string; slotIndices: readonly number[] }[];
  // Function params whose value feeds blockhash(n); the SDK reads the arg to resolve addr(n) and co-spend
  // the (n->hash) oracle UTXO as a trailing input.
  blockhashReads?: readonly string[];
  blockLayout?: FunctionBlockLayout;
  isFallback?: boolean;
  isReceive?: boolean;
  externalLibraries?: readonly string[];  // names of external script libraries this function uses
  externalLibraryCalls?: Readonly<Record<string, number>>;  // per-library call-site count
  // keccak256 uses the compute-and-commit side-car; send() co-spends N side-cars and fills results.
  keccakCompute?: boolean;
  keccakPreimageParams?: readonly (string | null)[]; // per keccak256 call (order): the param feeding it (send()
  // computes each R + co-spends per call)
  keccakInLoop?: boolean;       // a keccak256 call is inside a loop -> runtime count exceeds keccakPreimageParams.length;
  // deploy MORE side-cars than the static count (the loop bound is the real minimum)
  keccakLoopReads?: boolean;    // STATEFUL dynamic keccak loop: the SDK progressively co-spends N (runtime
  // iteration count) compute side-cars into the trailing region [blockSize, ..)
  // ecrecoverPubKey uses a co-spent recovery side-car pair per call; send() co-spends 2N inputs.
  ecrecoverCompute?: boolean;
  // Per ecrecoverPubKey call (in order), its [hash, v, r, s] parameter names.
  ecrecoverArgParams?: readonly (readonly (string | null)[])[];
  ecrecoverEvmFlags?: readonly boolean[]; // also identifies calls that need a keccak side-car
  ecrecoverLoopReads?: boolean; // dynamic ecrecover loop: the SDK co-spends one recovery pair per sig-array element
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
  /** True when this mapping uses the C2 sorted-linked-list backend (SDK drives it via SortedList). */
  sorted?: boolean;
  /** True when the value is a variable-width blob that chunks when large (P5b): unbounded bytes/string, struct,
   * dynamic array. The SDK gates chunk read-witness / write-mint / GC on this. Omitted when false. */
  chunkableValue?: boolean;
  /** True for an `enumerable mapping(...)` - the mapping may be iterated. A plain mapping is not enumerable
   * (Solidity parity). Omitted when false. */
  enumerable?: boolean;
}

export interface SortedInsertLoopAbi {
  collection: string;
  fixedKeyParams: readonly string[]; // leading param keys (in order), constant across the loop
  varyingArrayParam: string;         // the array whose elements are the varying LAST key, one per iteration
  valueParam?: string;               // the value comes from this function param
  valueBool?: boolean;               // ... or is this bool literal (true -> 0x01 tail, false -> empty tail)
}

// Per-iteration C2 UPDATE loop `for(i) m[k[i]] += v[i]` (multitransfer credit to existing recipients): the SDK
// co-spends each k[i]'s existing entry at input[master+blockSize+i] and mints its updated commitment at
// output[master+blockSize+i] with value = oldValue op v[i].
export interface SortedUpsertLoopAbi {
  collection: string;
  fixedKeyParams: readonly string[];
  varyingArrayParam: string;   // the array of keys (recipients), one per iteration
  valueArrayParam?: string;    // the array of per-key values (amounts); absent for 'delete' (no value)
  valueArrayOffset?: string;   // set value = valueArrayParam[i] + this signed decimal constant
  valueScalarParam?: string;   // a loop-INVARIANT param value (same for every key), e.g. `+= amount` (fixed airdrop)
  valueConst?: string;         // a loop-invariant INT LITERAL value (decimal string), e.g. `+= 100`
  mutation?: 'push' | 'pop' | 'setAt';
  mutationValueArrayParam?: string;
  mutationValueScalarParam?: string;
  mutationValueConst?: string;
  mutationIndexArrayParam?: string;
  mutationIndexScalarParam?: string;
  mutationIndexConst?: string;
  oldValuesWitnessParam?: string;
  op: '+' | '-' | 'set' | 'delete'; // '+'/'-' = RMW; 'set' = absolute m[k[i]]=v; 'delete' = nullify m[k[i]] to default
}

export interface KeySourceAbi {
  kind: 'param' | 'state' | 'expression' | 'stateArrayLast' | 'constant' | 'msgSender';
  paramName?: string;
  stateVarName?: string;
  stateArrayName?: string; // kind='stateArrayLast': `arr[arr.length-1]` - SDK resolves the array's last element
  constantValue?: string;  // kind='constant': compile-time-resolved uint key value (decimal string)
  // kind='msgSender': a msg.sender / tx.origin key; SDK resolves slot = keyToSlot(the sender's P2PKH lockscript).
  senderOp?: 'msg.sender' | 'tx.origin';
  expressionLabel?: string;
}

export interface EntryAccessAbi {
  collection: string;
  keyParams: string[];
  keySources?: readonly KeySourceAbi[];  // optional for backward compat with old artifacts
  operations: readonly string[];
  // A write slot gated off when its key aliases the delete slot at this index (swap-remove of the last key).
  aliasCondDeleteSlot?: number;
  runtimeAliasPriorSlots?: readonly number[];
  // A sorted (C2) write of an unbounded bytes/string value from this function parameter. The SDK persists the
  // full value as chunks (P5b); the entry stores only len ++ sha256(value). Absent for computed-expression values.
  valueParam?: string;
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
  kind: 'forward' | 'constructorArg' | 'literal' | 'msgSender' | 'selfAddress' | 'arrayElement' | 'expression';
  paramIndex?: number;     // for 'forward': index into the user-visible function args
  indexParamIndex?: number; // for 'arrayElement': optional function parameter containing the element index
  indexValue?: number;     // for 'arrayElement': fixed index (loop call sites commonly begin at zero)
  paramName?: string;      // for 'constructorArg': name of the constructor parameter
  value?: string;          // for 'literal': serialized value
  type?: string;           // for 'literal': SolidCash type string
  expression?: ExternalCallExpression;
}

export interface ExternalCallExpression {
  kind: string;
  name?: string;
  type?: string;
  value?: string | boolean;
  operator?: string;
  source?: ArgSource;
  expression?: ExternalCallExpression;
  left?: ExternalCallExpression;
  right?: ExternalCallExpression;
  condition?: ExternalCallExpression;
  ifTrue?: ExternalCallExpression;
  ifFalse?: ExternalCallExpression;
  args?: readonly ExternalCallExpression[];
  fields?: readonly string[];
}

export interface ExternalCallAbi {
  /** Stable compiler-assigned physical callsite/slot identifier within the containing function. */
  callsiteId?: number;
  /** Source start of the call expression, retained for deterministic SDK derivation diagnostics. */
  sourceLocation?: { line: number; column: number };
  /** Source reachability class; loop/conditional rows require runtime occurrence proof. */
  occurrence?: 'once' | 'conditional' | 'loop';
  /** Compiler-proven ceiling on reached rows. Absent means no ceiling was proven for this callsite. */
  maximumOccurrences?: number;
  /**
   * Compiler-proven FLOOR on reached rows, published only where the compiler can prove one. When it equals
   * `maximumOccurrences` the reached count is exact and a consumer that plans any other count is wrong before
   * a transaction exists. Absent means the floor is unknown: only the ceiling binds, and an under-count stays
   * fail-closed on chain rather than being rejected at plan time.
   */
  minimumOccurrences?: number;
  /**
   * Provenance of the published bound: `literal` = a compile-time trip count, `guard` = a dominating
   * `require` ceiling over a runtime trip count, `structural` = a single-reach branch. Absent when no bound
   * is published.
   */
  occurrenceBoundSource?: 'literal' | 'guard' | 'structural';
  interfaceName: string;
  functionName: string;
  addressParam?: string;
  addressStateVar?: string; // interface-typed state var holding the callee address (read from state, not caller-provided)
  addressLiteral?: string; // code-baked literal address target IFoo(0x..).m(): covenant pushes this constant (un-seedable)
  loopArrayVar?: string; // state array of callee addresses: every element is co-spent + loop-verified (IFoo(arr[i]).m())
  // varying-method dispatch table: parallel `bytes[]` state array of per-element selectors. The covenant reads
  // sel[i] from it (not a witness), so the SDK resolves each element's method from its selector + skips the witness.
  selectorArrayVar?: string;
  /** Compiler-bounded method alternatives for a varying-selector table with a declared interface. */
  possibleTargets?: readonly { functionName: string; selector: string }[];
  addressIsMsgSender?: boolean; // target is msg.sender: the SDK co-spends the caller-designated msg.sender contract
  addressSource?: ArgSource; // SDK-resolvable origin for computed/local target addresses
  // Foreign fn-ptr call: the SDK fills a per-call master-index witness.
  fnPtrCall?: boolean;
  // A regular direct call needs a selector witness unless the callee has only one method.
  needsSelectorVerification?: boolean;
  requiredDataNftIndices: number[];
  hasReturnValues?: boolean;
  returnTypes?: readonly string[];
  returnEventSignature?: string;
  computedOffset?: number;
  callMode?: 'call' | 'staticcall' | 'delegatecall';
  opaqueReturn?: boolean; // `(bool,bytes)=addr.call(payload)`: opaque integrity-bound return, callee unknown at compile time
  argSources?: readonly ArgSource[];
  rawFunctionName?: string; // decoded abi.encodeCall target for a low-level call
  rawArgSources?: readonly ArgSource[];
  batchInvocations?: readonly {
    selector: string;
    logicalIndex: number;
    inputs: readonly AbiInput[];
    argSources?: readonly ArgSource[];
  }[];
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
  blobHash?: string;  // hash256 of the library script blob; matches the integrity check (absent for resultNft:
  // the compute side-car runs a covenant, not a loaded blob)
  branded: boolean;   // true: side-car address salted with the contract category (per-contract); false: shared
  inline?: boolean;   // true: blob embedded in the contract redeem (no side-car); false: loaded from a side-car
  codeBegin?: number; // byte offset where the blob begins in the side-car input bytecode
  codeEnd?: number;   // ... and ends (the range the loader strips to)
  abi?: { inputs: readonly AbiInput[]; outputs: readonly AbiOutput[] };  // call signature, e.g. (bytes) -> bytes32
  code?: string;      // hex blob; present for user-supplied libraries
  resultNft?: boolean; // true: "compute-and-commit" model - the side-car RUNS keccak and returns the hash in
  // its NFT commitment (the contract reads it), rather than the contract running the blob
  minInstances?: number; // (resultNft) minimum side-car instances to deploy at creation: the max keccak256 call
  // count across the contract's functions (each function co-spends its own per-call side-cars)
  unbounded?: boolean;   // (resultNft) some function hashes inside a loop -> minInstances is a LOWER BOUND; the
  // real need is the loop's runtime count, so provision extra side-cars
}

export interface InvocationAnalysisFunction {
  id: number;
  name: string;
  arity: number;
  entryPoint: boolean;
  selector?: string;
  calls: readonly number[];
  closure: readonly number[];
  component: number;
  recursive: boolean;
  reads: readonly string[];
  writes: readonly string[];
  effects: readonly string[];
  unknown: boolean;
  /** ABI result schema produced by this handler, in canonical tuple order. */
  outputs?: readonly AbiOutput[];
  /** Calls whose authenticated result must be available before this handler can resume. */
  resultDependencies?: readonly {
    callsiteId: number;
    returnTypes: readonly string[];
    opaque: boolean;
  }[];
  resultConsumers?: readonly {
    consumerCallsiteId: number;
    argument: number;
    producerCallsiteId: number;
  }[];
  /**
   * True only when every external-call occurrence is statically singular. Conditional and loop callsites
   * require a runtime occurrence proof and therefore remain explicitly unbounded in this summary.
   */
  bounded: boolean;
  /** Maximum direct external invocations when `bounded` is true. */
  maximumDirectInvocations?: number;
  /** Ordered compiler-resolved external callsites used by graph expansion. */
  externalCalls?: readonly ExternalCallAbi[];
  externalOutStateReads?: readonly ExternalOutStateAbi[];
  emits?: readonly EmitAbi[];
  transferCount?: number;
  transfers?: readonly {
    transferIndex: number;
    recipient: ArgSource;
    amount: ArgSource;
    callOption?: 'value';
  }[];
  tokenContainerAccesses?: readonly TokenContainerAccessAbi[];
  dynamicReads?: readonly string[];
  dynamicWrites?: readonly string[];
  blockLayout?: FunctionBlockLayout;
}

export interface InvocationAnalysisArtifact {
  version: 1;
  /** Immutable call-manifest protocols this compiler can summarize. */
  protocolVersions: readonly number[];
  functions: readonly InvocationAnalysisFunction[];
  components: readonly {
    id: number;
    functions: readonly number[];
    recursive: boolean;
  }[];
}

/**
 * Largest message-bus batch message-bus blob any generated covenant admits, in bytes (X106).
 *
 * ONE home for a value with two enforcers. The compiler compiles this bound into every message-bus route
 * (`require(batchBlob.length <= N)`) and republishes it as `Artifact.messageBus.maximumBlobBytes`; the SDK's
 * messageBus graph generator enforces the same bound while framing each participant's message-envelope rows. Both
 * carried a bare `223` and nothing made them move together. `@solidcash/utils` is the only package both the
 * compiler and the SDK already depend on, so it is the only place the two can share a literal.
 *
 * The value is load-bearing rather than cosmetic: for a chunk-backed value crossing a handler boundary the
 * blob envelope, NOT the trailing region, is the binding constraint - an argument-carried value caps at 202
 * bytes (2 chunks) while a computed one reaches all 64 trailing slots, so the envelope binds 32x earlier than
 * the region. Silent drift between the copies would therefore move a real limit.
 */
export const MAX_MESSAGE_BUS_BLOB_BYTES = 223;

/** Shared wire constants for the atomic single-transaction message bus. */
export const ATOMIC_MESSAGE_BUS_DOMAIN_HEX = '4c33425553310000';
export const ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS = 8;
export const ATOMIC_MESSAGE_BUS_MAX_ROWS = 24;
/** P2SH32(OP_TRUE) used only to balance compiler-published output-only participant slots. */
export const BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX =
  'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';

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
  structs?: readonly StructDefinitionInfo[];  // struct field layouts for encoding struct-typed args (ABI tuple)
  externalInterfaces?: readonly ExternalInterfaceInfo[];
  events?: readonly EventDefinitionAbi[];
  errors?: readonly ErrorDefinitionAbi[];
  enums?: readonly EnumDefinitionAbi[];
  externalLibraries?: readonly ExternalLibraryAbi[];  // external script libraries this contract depends on
  isLibrary?: boolean;  // compiled from a `library` (stateless contract class); see docs/library-contracts.md
  brandedLibrary?: boolean;  // delegate library branded to its consumer's category; SDK supplies the __brand arg
  delegateOnly?: boolean; // deployed code facet: layout is for proxy offsets; genesis mints no application data
  /**
   * Every delegate entry point pins the exact number of outputs using the proxy's locking bytecode. This closes
   * duplicate proxy master/data-NFT outputs and allows a proxy to delegate mutable-NFT cardinality changes to
   * the implementation's per-storage-path covenant checks.
   */
  delegateProxyStateOutputCountPinned?: boolean;
  usesBlockhash?: boolean;  // contract reads blockhash(n); keeper maintains the (n->hash) oracle
  // Same source compiled with its proxy-implementable functions in delegate mode (state writes retargeted to a
  // co-spent proxy master). Present when the contract can serve as a proxy implementation; the SDK deploys and
  // calls this variant behind a proxy, so source never needs an explicit `delegate` modifier. One level deep.
  delegateArtifact?: Artifact;
  /** Compiler-only call graph/resource summary shared by splitting, journal
   * eligibility, diagnostics, and message-bus planning. No covenant capability
   * is implied by its presence. */
  invocationAnalysis?: InvocationAnalysisArtifact;
  messageBus?: {
    version: 1;
    selector: '53434231';
    minimumRows?: number;
    maximumRows: number;
    maximumBlobBytes: number;
    /** Compiler-published admission and message-envelope contract for atomic composition. */
    atomicMessageBus?: {
      domain: typeof ATOMIC_MESSAGE_BUS_DOMAIN_HEX;
      /** The final verifier input carries the canonical frame authenticated by every participant binder. */
      messageEnvelope: {
        region: 'participant-verifiers';
        canonicalInput: 'final-participant-verifier';
        unlockingPush: 0;
      };
      maximumParticipants: typeof ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS;
      maximumRows: typeof ATOMIC_MESSAGE_BUS_MAX_ROWS;
    };
    /** Compiler-emitted OP_INVOKE program moved into genesis-deployed verifier covenants. */
    verifierProgram?: {
      verifyFunctionId: number;
      inputCount: number;
      inputs: readonly AbiInput[];
      functions: readonly { id: number; name: string; bytecode: string }[];
    };
    route: AbiFunction;
    handlers: {
      name: string;
      selector: string;
      inputs: AbiInput[];
      outputs?: AbiOutput[];
      usesMsgValue?: boolean;
      emits?: readonly EmitAbi[];
      tokenContainerAccesses?: readonly TokenContainerAccessAbi[];
      ecrecoverArgParams?: readonly (readonly (string | null)[])[];
      transfers?: readonly {
        transferIndex: number;
        recipient: ArgSource;
        amount: ArgSource;
        callOption?: 'value';
      }[];
      eligible: boolean;
      rejectionReason?: string;
      rejectionCode?:
      | 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT'
      | 'MESSAGE_BUS_FUTURE_RESULT_DEPENDENCY'
      | 'MESSAGE_BUS_EXTERNAL_RECURSION_UNBOUNDED'
      | 'MESSAGE_BUS_DUPLICATE_SETTLEMENT_AUTHORITY'
      | 'MESSAGE_BUS_FOREIGN_INTERMEDIATE_STATE_READ'
      | 'MESSAGE_BUS_STACK_CONTEXT_UNPRESERVABLE'
      | 'MESSAGE_BUS_EFFECT_UNSUMMARIZABLE';
      rejectionContext?: {
        handlerId?: number;
        functionName: string;
        reason: string;
        sourceLocation?: { line: number; column: number };
        callChain?: readonly string[];
      };
      /** OP_INVOKE body covered by CHECKSIG when this handler is called from message-bus batch. */
      signatureBytecode?: string;
      batchKeyWitnesses?: {
        routeInput: string;
        inputIndex: number;
        source?: 'argument' | 'msgSender';
        perRow?: boolean;
      }[];
    }[];
  };
  diagnostics?: readonly {
    severity: 'warning' | 'error';
    code: string;
    message: string;
  }[];
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

export interface SplitStateFootprint {
  reads: readonly string[];
  writes: readonly string[];
  effects: readonly string[];
  unknown: boolean;
}

export interface SplitRoute {
  selector: string;
  function: string;
  target: 'root' | string;
  footprint: SplitStateFootprint;
}

export interface SplitFacetInfo {
  name: string;
  functions: readonly string[];
  brandArgument: '__brand';
  linkArgument: string;
  delegateOnly: true;
  estimatedRedeemBytes: number;
}

export interface SplitManifest {
  logicalContractName: string;
  abi: readonly AbiFunction[];
  stateLayoutFingerprint: string;
  deploymentMode: 'immutable-one-hop';
  algorithm: 'state-affinity-best-fit-v2';
  identityBinding: {
    scheme: 'solidcash-create-v1';
    owner: 'root';
    facetIdentity: 'physical-only';
  };
  routes: readonly SplitRoute[];
  facets: readonly SplitFacetInfo[];
}

/** Additive compiler result for a statically linked one-hop split contract. */
export interface SplitArtifactBundle {
  format: 'solidcash-split-v1';
  root: Artifact;
  facets: ArtifactMap;
  manifest: SplitManifest;
}

/** How a published occurrence bound reads back, with the unknown legs made explicit. */
export interface OccurrenceBound {
  kind: 'once' | 'conditional' | 'loop';
  /** Proven floor on reached rows, or undefined when the compiler proved none. */
  minimum?: number;
  /** Proven ceiling on reached rows, or undefined when the compiler proved none. */
  maximum?: number;
  /** True when floor and ceiling coincide, so exactly one count can ever be honest. */
  exact: boolean;
  source?: 'literal' | 'guard' | 'structural';
}

/**
 * Read one callsite's published occurrence bound.
 *
 * `once` is a straight-line callsite, so its count is structurally one whether or not the compiler wrote a
 * bound down. Every other class reports exactly what the artifact carries: an absent leg means the compiler
 * proved nothing there, never that any count is admissible.
 */
export function occurrenceBoundOf(call: ExternalCallAbi): OccurrenceBound {
  const kind = call.occurrence ?? 'once';
  if (kind === 'once') {
    return { kind, minimum: 1, maximum: 1, exact: true, source: call.occurrenceBoundSource ?? 'structural' };
  }
  const minimum = call.minimumOccurrences;
  const maximum = call.maximumOccurrences;
  return {
    kind,
    ...(minimum !== undefined && { minimum }),
    ...(maximum !== undefined && { maximum }),
    exact: minimum !== undefined && minimum === maximum,
    // A conditional callsite's ceiling of one is a property of the branch, not of any written-down bound, so
    // its provenance is structural even when the compiler spent no bytes saying so.
    source: call.occurrenceBoundSource ?? (kind === 'conditional' ? 'structural' : undefined),
  };
}

const boundProvenance = (bound: OccurrenceBound): string =>
  bound.source === 'literal' ? 'a compile-time trip count'
    : bound.source === 'guard' ? 'a dominating require guard'
      : bound.source === 'structural' ? 'a single-reach branch'
        : 'the compiler';

/**
 * Validate a chosen reached-occurrence count against the compiler-published bound.
 *
 * Returns undefined when the count is admitted, otherwise a precise diagnostic naming the callsite, the
 * chosen count, the bound it violates and where that bound came from. A consumer that plans a count outside
 * the published bound builds a transaction the caller covenant rejects; this turns that into a plan-time
 * error. An absent bound leg is never treated as permission - callers decide separately whether an unproven
 * ceiling is admissible at all.
 */
export function occurrenceCountViolation(call: ExternalCallAbi, count: number): string | undefined {
  const bound = occurrenceBoundOf(call);
  const where = `callsite ${call.callsiteId ?? '?'}`;
  if (!Number.isInteger(count) || count < 0) {
    return `${where} was planned with ${count} occurrences, which is not a reached-row count`;
  }
  if (bound.kind !== 'loop' && count > 1) {
    return `${where} is a ${bound.kind} callsite reached at most once, but ${count} occurrences were planned`;
  }
  if (bound.maximum !== undefined && count > bound.maximum) {
    return `${where} was planned with ${count} occurrences, above the ${bound.maximum} `
      + `proven by ${boundProvenance(bound)}`;
  }
  if (bound.minimum !== undefined && count < bound.minimum) {
    return `${where} was planned with ${count} occurrences, below the ${bound.minimum} `
      + `proven by ${boundProvenance(bound)}`
      + (bound.exact ? `; this callsite reaches exactly ${bound.minimum} rows` : '');
  }
  return undefined;
}

/**
 * A provenance as a consumer must read it, with the unpublished leg made explicit.
 *
 * `unknown` is not one of the compiler's five answers: it is what an artifact that carries no answer at all
 * has to be read as. It exists so a consumer can never spell "the field was absent" and "the compiler proved
 * the value is fixed" the same way.
 */
export type ReadValueProvenance =
  | ValueProvenance
  | { kind: 'unknown'; name?: undefined };

const UNKNOWN_PROVENANCE: ReadValueProvenance = Object.freeze({ kind: 'unknown' as const });

/**
 * Read a low-level call's published target provenance.
 *
 * Returns `unknown` when the artifact publishes none, which is every artifact compiled before the field
 * existed. A consumer must treat `unknown` exactly as it treats `parameter`: not fixed, not proven, refuse.
 */
export function lowLevelCallTargetProvenance(
  call: { target?: ValueProvenance },
): ReadValueProvenance {
  return call.target ?? UNKNOWN_PROVENANCE;
}

/**
 * Read a function's published signature-guard key provenance.
 *
 * Returns `unknown` when the artifact publishes no guard - the body has none, or the artifact predates the
 * field. Both mean the same thing to a consumer: no authority is proven here.
 */
export function signatureGuardKeyProvenance(fn: Pick<AbiFunction, 'signatureGuard'>): ReadValueProvenance {
  return fn.signatureGuard?.key ?? UNKNOWN_PROVENANCE;
}

/**
 * Read what a function's signature-guard KEY is pinned to (X51).
 *
 * `signatureGuardKeyProvenance` says where the checked key came from. A `parameter` key is not the same as an
 * uncontrolled one: `require(hash160(pk) == <x>); require(checkSig(s, pk))` lets the caller supply only the one
 * key whose hash the contract already fixed, so the authority in force is `<x>`'s, not `pk`'s. This returns
 * `<x>`'s provenance when the compiler proved such a pin over EVERY signature check in the body, folded to the
 * weakest, and `unknown` otherwise.
 *
 * `unknown` covers three different situations on purpose - no pin was proven, no signature check exists, or the
 * artifact predates the field - because a consumer must treat all three identically: nothing is proven here.
 * Pair it with an explicit allow-list of admitted kinds, so `unknown` and any kind a later compiler adds fall
 * closed rather than being admitted by omission.
 */
export function signatureGuardKeyCommitment(fn: Pick<AbiFunction, 'signatureGuard'>): ReadValueProvenance {
  return fn.signatureGuard?.keyCommitment ?? UNKNOWN_PROVENANCE;
}

/** Old artifacts and guards that do not publish control-flow evidence fail closed. */
export function signatureGuardDominatesDelegatecalls(
  fn: Pick<AbiFunction, 'signatureGuardDominatesDelegatecalls'>,
): boolean {
  return fn.signatureGuardDominatesDelegatecalls === true;
}

/**
 * Is this value fixed for a given contract address - committed into the p2sh32 or into the script itself?
 *
 * True for `constructorArg` and `literal` only. `stateVar` is fixed only relative to the contract's own
 * authorized writes, which is a different question a consumer has to answer for itself; `parameter`,
 * `computed` and `unknown` are all "a spender may vary this". Anything not on the true list is refused, so a
 * kind added by a later compiler falls closed here rather than being admitted by omission.
 */
export function isAddressCommittedProvenance(provenance: ReadValueProvenance): boolean {
  return provenance.kind === 'constructorArg' || provenance.kind === 'literal';
}

/** Human-readable provenance, for diagnostics that have to say why a value was refused. */
export function describeProvenance(provenance: ReadValueProvenance): string {
  switch (provenance.kind) {
    case 'constructorArg': return `constructor argument '${provenance.name}'`;
    case 'parameter': return `caller-supplied parameter '${provenance.name}'`;
    case 'stateVar': return `state variable '${provenance.name}'`;
    case 'literal': return 'a compile-time literal';
    case 'computed': return 'a computed expression';
    // Either the body carried nothing to describe or the artifact predates the field; a consumer must not
    // distinguish them, because both mean the artifact proves nothing here.
    default: return 'a source this artifact does not name';
  }
}

export function formatSplitArtifactBundle(bundle: SplitArtifactBundle, format: 'json' | 'ts'): string {
  if (format === 'ts') {
    const normalised = JSON.parse(JSON.stringify(bundle));
    return `export default ${stringifyAsTs(normalised)} as const;\n`;
  }
  return JSON.stringify(bundle, null, 2);
}

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
  if (obj === null) return 'null';

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
