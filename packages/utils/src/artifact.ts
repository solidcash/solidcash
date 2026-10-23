import type { StopSiteMetadata } from './framed/stop-site.js';

export interface ResolvedImport {
  source: string;  // The source code of the imported file
  id: string;      // Canonical identifier (for dedup + nested import context)
}

export type ImportResolverFn = (importPath: string, currentFile: string) => ResolvedImport | undefined;

/** Exact ABI entry-point identity for overload-safe compiler and SDK selection. */
export interface AbiFunctionReference {
  name: string;
  /** Four-byte function selector as eight hexadecimal characters (the optional `0x` prefix is accepted). */
  selector: string;
}

/**
 * How an `address` value is materialized when it becomes bytes.
 *
 * `'hash'` is the Solidity/EVM form: an address is its 20-byte identity - the embedded payload of a standard
 * P2PKH (`76a914 <20> 88ac`) or P2SH20 (`a914 <20> 87`) lock, or `HASH160` of any other lock - so the
 * narrowing casts (`uint160(a)`, `bytes20(a)`) truncate exactly as Solidity's do.
 *
 * `'bytecode'` is the BCH form: an address is its exact locking bytecode, a variable-length script, and nothing
 * truncates. `uint160(a)` / `bytes20(a)` pass the lock through unchanged, `abi.encodePacked(<address>)` carries
 * the whole lock, and an address that crosses an interface arrives and leaves as that lock.
 *
 * A fixed-width EVM ABI *word* (`abi.encode(<address>)`) is the one surface that cannot follow `'bytecode'`: a
 * 32-byte word cannot carry a variable-length lock, so it keeps projecting the 20-byte identity and the compiler
 * warns. Omitted follows the compile mode: `'hash'` under `evmCompat`, `'bytecode'` otherwise.
 */
export type AddressForm = 'bytecode' | 'hash';

export interface CompilerOptions {
  /** Validation ceiling for private/mock networks; defaults to BCH's 10,000-byte consensus limit. */
  maximumInputBytes?: number;
  /** Skip speculative message-bus admission rungs and compile the conservative route directly. */
  optimizeForCompilationSpeed?: boolean;
  /**
   * Emit bytecode source maps on the artifact (`debug.sourceMap` and per-body maps). Default true.
   * Set false to skip encoding maps at compile time and skip decoding them when attributing VM failures.
   * Require/log instruction pointers and source line numbers are still recorded; BitAuth source comments
   * and column-accurate failing snippets are not.
   */
  sourceMap?: boolean;
  /**
   * Emit the code generator's bytecode verbatim instead of the peephole/structural optimiser's output. Default
   * true (optimise). The unoptimised script keeps a one-to-one instruction/source-map correspondence, so a VM
   * instruction pointer names the exact source line and require that produced it instead of the approximate
   * window an optimised map forces. Debugging only: scripts are larger and evaluate more opcodes, so it must not
   * be used for deployed artifacts. `SOLIDC_NO_OPTIMISE=1` selects it for a whole compile run.
   */
  optimise?: boolean;
  /** Suppress non-fatal compiler warnings while preserving errors and ordinary command output. */
  suppressWarnings?: boolean;
  /**
   * Internal. Speculative message-bus admission only needs the verifier program and eligible handler names.
   * Skip compiling ordinary entry-point bodies on that throwaway pass; the binder second pass emits them.
   */
  __cheapAdmissionCodegen?: boolean;
  /** Internal detached-verifier codegen mode; the compiler retries the compact form if this exceeds script size. */
  __detachedVerifierUnrollDeepReplace?: boolean;
  /**
   * Internal. compileFile / project compilation may memoize artifacts even when an importResolver is present.
   * compileString stays uncached unless SOLIDC_COMPILE_CACHE=1.
   */
  __artifactCache?: boolean;
  /** Internal test-only: parse the generated message-bus route as source (print-and-parse oracle). */
  __messageBusRouteParseOracle?: boolean;
  /** Internal second-pass input used to replace the in-master verifier with a pinned compact binder. */
  __messageBusVerifierProgram?: {
    verifyFunctionId: number;
    inputCount: number;
    inputs: readonly AbiInput[];
    functions: readonly { id: number; name: string; bytecode: string }[];
    /** The verifier returns an authenticated uint16 lifecycle-code suffix. */
    lifecycle?: true;
    /** @deprecated Compatibility with pre-merge split artifacts. */
    splitLifecycle?: true;
    /** The verifier reads the one canonical envelope from the root route instead of its own unlocker. */
    envelopeTransport?: 'root-route' | 'proxy-forward';
  };
  enforceFunctionParameterTypes?: boolean;
  enforceLocktimeGuard?: boolean;
  // Treat a spending path that performs no require()/verification and changes no state as a hard error
  // (FinalRequireStatementError) rather than the default warning. Such a path compiles to an
  // unconditionally-spendable script; enable this to enforce that every path is guarded (e.g. in CI).
  enforceFinalRequire?: boolean;
  // Permit compiler-detected caller-controlled delegatecall/selfdestruct authority. Defaults to false; this
  // exists only as an explicit migration/testing escape hatch for contracts that knowingly accept takeover.
  allowUnsafeOperations?: boolean;
  commitmentLimit?: number;
  /** Encode an NFT-index tag even when fixed state occupies only one data NFT. Opt-in wire-layout choice. */
  tagSingletonDataNfts?: boolean;
  // Solidity-source compatibility and EVM byte-parity mode: resolve `.sol` imports as solidcash sources,
  // accept `pragma solidity`, apply Solidity literal/type semantics, and emit EVM-faithful ABI words (32-byte
  // big-endian two's-complement) for the abi.* family.
  evmCompat?: boolean;
  /**
   * The form an `address` value takes when it becomes bytes: the exact locking bytecode (`'bytecode'`) or the
   * 20-byte Solidity identity (`'hash'`). See {@link AddressForm}. Omitted follows the mode: `'hash'` under
   * `evmCompat`, `'bytecode'` otherwise. Published on the artifact and read by the SDK, so both sides agree.
   */
  addressForm?: AddressForm;
  importResolver?: ImportResolverFn;
  rootFileId?: string;
  // Per-library inline override (keyed by library name, e.g. 'keccak256'): true = always inline the blob
  // into the contract, false = always use a side-car. Omitted = auto (inline when used once).
  inlineLibraries?: Record<string, boolean>;
  // Disable the auto-inline heuristic (small, single-call libraries inline by default). Explicit
  // inlineLibraries entries still apply.
  disableAutoInline?: boolean;
  // User-supplied external libraries (script precompiles). Each registers `name(...)` as a callable with
  // the given ABI signature, backed by the hex `code` blob. Merged with the built-in libraries.
  userLibraries?: { name: string; code: string; abi: { inputs: AbiInput[]; outputs: AbiOutput[] } }[];
  // Default true: route an eligible unbounded `T[]` state var to the dense chunk-packed backend (length header +
  // chunk UTXOs). False keeps the sparse entry-NFT collection. See packages/solidc/docs/arrays.md.
  chunkedArrays?: boolean;
  // block.chainid network constant, baked as a single byte (chainId & 0xff). Convention:
  // mainnet 0, chipnet 1, testnet4 2, regtest -1 (0xff). User-land; see docs/block-and-transaction-properties.md.
  chainId?: number;
  /**
   * Explicit production-semantics feature: capture message-bus owner onto alt-stack at DEFINE entry.
   * When omitted, resolved from SOLIDC_OWNER_ALT_ANCHOR only via the solidc env registry; included in
   * artifact/cache identity when enabled.
   */
  ownerAltAnchor?: boolean;
  /**
   * Explicit production-semantics feature: seed caller band names into the DEFINE frame model.
   * When omitted, resolved from SOLIDC_HANDLER_BAND_MODEL; included in artifact/cache identity when enabled.
   */
  handlerBandModel?: boolean;
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
  /**
   * Size optimization: reuse an already-taken entry-read local for a whole-struct write-back. Default true.
   * `false` is a measurement-only escape hatch that keeps the write-back on the CoalesceMappingEntryFieldWrites
   * re-read path, so a regression test can compare the two sizes; it must not be used for deployed artifacts.
   */
  reuseEntryLocalForWriteback?: boolean;
  // Compiler-generated atomic composition route and write-back journal. Omitted selects automatically from
  // source-level atomic call-graph edges; `true` opts out of that narrowing and requests a route for a
  // graph-free contract, still falling back to direct-only when none can be built; `false` requests direct-only
  // compilation and is rejected when semantic analysis finds a transaction shape that cannot be built without
  // one shared message bus. The resolved value is what the artifact publishes.
  messageBus?: boolean;
  /** Opt in to V5 atomic manifests with a co-spent direct-only participant and no verifier NFT. */
  messageBusDirectParticipant?: boolean;
  // Optional compile-time surface for large compatibility projects. Direct ABI entry points remain unchanged;
  // only these functions are cloned into the authenticated message-bus route. A legacy string selects every
  // overload with that name; an exact reference selects only the entry point with both that name and selector.
  // Omitted means all eligible entry points. This avoids cloning dozens of unrelated external handlers when one
  // atomic DAG needs a few.
  messageBusHandlers?: readonly (string | AbiFunctionReference)[];
  // Compile an otherwise graph-free message-bus participant with the atomic graph envelope. Leaf participants
  // still need per-row logical callers when one composed transaction reaches them from different parents.
  // Omitted preserves the compact local-caller route used by standalone batching.
  messageBusGraphContext?: boolean;
  /**
   * Authenticated physical entry-lane capacity for graph-context one-key pools and complete fixed-key tuples.
   * Defaults to 8 for one-key graph pools and 2 for fixed tuples. Explicit values raise either capacity; fixed
   * tuples retain a minimum of 2 lanes. Each extra lane adds a real entry proof and compilation/runtime cost.
   * Must be an integer in [1, 99], the v1 journal's global record ceiling (other collections share this budget).
   */
  messageBusEntryPoolCapacity?: number;
  /** Opt in to the root-route envelope carrier; omitted preserves verifier-local V1–4 transport. */
  messageBusRootEnvelope?: boolean;
  /** Opt in to the root proxy's authenticated forward payload as the canonical envelope carrier. */
  messageBusProxyForwardEnvelope?: boolean;
  /**
   * Select the message-bus calling convention (`packages/solidc/docs/message-bus-kernel.md`).
   * Omitted or `true` uses the kernel row loop. `false` is a temporary compatibility escape hatch for
   * reproducing the historical clone/unroll route. Kernel-ineligible handlers publish `KERNEL_*` reasons;
   * the resolved convention is published on `artifact.messageBus`.
   */
  messageBusKernel?: boolean;
  /**
   * Composition convention to compile for. `direct` (default) gives every entry point its own top-level function and
   * block layout. `framed` compiles each entry point as a master program that recreates itself unchanged, so one
   * contract's state settles once per transaction however many times the transaction enters it. The resolved
   * convention is published on `artifact.composition`.
   */
  composition?: 'direct' | 'framed';
  /**
   * How a split compile places code. `off` is one artifact. `size` is the state-affinity packer
   * (`state-affinity-best-fit-v2`). `func` is one framed master per ABI entry (`per-entry-v1`).
   * Omitted on {@link compileStringSplit} means `size`. A boolean is not a mode.
   */
  split?: 'off' | 'size' | 'func';
  // Limit eager/lazy proxy implementation variants in large multi-contract projects. Omitted preserves the
  // default behavior; when supplied, only matching contract names receive `delegateArtifact`.
  delegateArtifactContracts?: readonly string[];
}

/**
 * The address form a compile actually uses. One resolver for the compiler's code generation and the SDK's
 * decoding, so a value written by one side is read the same way by the other; an unset option follows the mode.
 */
export function resolveAddressForm(options: Pick<CompilerOptions, 'evmCompat' | 'addressForm'>): AddressForm {
  return options.addressForm ?? (options.evmCompat ? 'hash' : 'bytecode');
}

export interface AbiInput {
  name: string;
  type: string;
  indexed?: boolean;
  /**
   * The event-argument notation this parameter is written in. `'evm'` is the evmCompat standard notation - the
   * bytes `abi.encodePacked` produces at the type's natural width (see `decodeEvmNotationEventValue`); absent is
   * the platform pushdata frame.
   */
  notation?: 'evm';
}

export interface EmitAbi {
  eventName: string;
  eventSignature: string;
  emitIndex: number;
  /**
   * The condition a framed emit a branch guards runs under, in a call site's `condition` language; absent for one
   * the body makes wherever it reaches it. The frame lists the event's output either way: a builder decides it from
   * the frame's facts and states a skipped emit's output with the empty commitment its not-taken arm closes against.
   * `{ kind: 'unsupported' }` marks an emit whose condition those facts do not decide, learned from that close.
   */
  activation?: ExternalCallExpression;
}

/** One segment of the source-ordered runtime event plan. Exactly one repeat source is present. */
export interface RuntimeLoopEventAbi {
  permutationParam?: string;
  /** Exact bound expression when the permutation's source domain is not recoverable from its legacy name. */
  iterationBound?: ExternalCallExpression;
  repeatCount?: number;
  /** Exact do-while recurrence domain for a compiler-lowered affine loop. This is mutually exclusive with
   * permutationParam and repeatCount. Expressions may reference counterName through an `identifier` node. */
  iterationDomain?: RuntimeLoopIterationDomainAbi;
  eventSignatures: readonly string[];
  /** Replayable per-site event arguments, aligned with eventSignatures. Required for iteration domains. For a
   * permutation-backed segment, loopIndex sources encode the logical source counter independently of key order. */
  arguments?: readonly (readonly ExternalCallExpression[])[];
  /** Per-site runtime predicates, aligned with eventSignatures. Missing entries are unconditional. */
  conditions?: readonly (ExternalCallExpression | null)[];
  /** Source-order predicate which ends the loop after the current logical iteration. */
  iterationBreakCondition?: ExternalCallExpression;
  /** Function-local execution segment, shared with transfers produced by the same loop. */
  effectSequence?: number;
  /** Per-site order among all event and transfer effects in this segment. */
  effectOrder?: readonly number[];
  /**
   * Each occurrence settles as consecutive records, one per commitment-sized chunk of its payload: the head at the
   * event covenant, the rest at its continuation covenant. The record count is learned from the trace.
   */
  chunked?: true;
  /** A kernel route handler's top-level emits, settled on its runtime effect stream instead of event windows. */
  stream?: true;
}

export interface RuntimeLoopIterationDomainAbi {
  counterName: string;
  initialValue: ExternalCallExpression;
  stepValue: ExternalCallExpression;
  continueCondition: ExternalCallExpression;
  /** Compiler-proven frame ceiling. Consumers must additionally enforce their own hard resource ceiling. */
  maximumIterations: number;
}

/** Exact bounded recurrence for a pre-test loop containing one external graph callsite. */
export interface ExternalCallIterationDomainAbi {
  /** Function-local lexical loop identity; equal recurrences in separate loops are not one execution domain. */
  sourceLoopId?: number;
  counterName: string;
  initialValue: ExternalCallExpression;
  stepValue: ExternalCallExpression;
  continueCondition: ExternalCallExpression;
  /** Independent compiler ceiling; consumers must also enforce their own actual-row limit. */
  maximumIterations: number;
}

/** One repeated BCH-transfer segment produced by a runtime counter loop. */
export interface RuntimeLoopTransferAbi {
  permutationParam: string;
  /** Exact bound expression when the permutation's source domain is not recoverable from its legacy name. */
  iterationBound?: ExternalCallExpression;
  siteCount: number;
  /** Effect kind per source site. Omitted by older artifacts whose sites are all plain BCH transfers. */
  siteKinds?: readonly ('bch' | 'token' | 'nft')[];
  /** Token-container slot per source site; null for plain BCH sites. */
  tokenContainerSlots?: readonly (number | null)[];
  /** Per-site runtime predicates, aligned with the source transfer sites. */
  conditions?: readonly (ExternalCallExpression | null)[];
  /** Function-local execution segment, shared with events produced by the same loop. */
  effectSequence?: number;
  /** Per-site order among all event and transfer effects in this segment. */
  effectOrder?: readonly number[];
}

export interface TokenContainerAccessAbi {
  keyParam: string;
  /** `own`: the contract's category; `state`: the immutable `bytes32` state variable `keyStateVariable`. */
  keySource?: 'param' | 'own' | 'state';
  keyStateVariable?: string;
  operations: readonly string[];
  transferCount?: number;      // number of transfer() calls (>1 for fan-out)
  transferNftCount?: number;   // number of transferNft() calls (>1 for fan-out)
  /** The body reads the output side of the amount (`this.outState.tokens[c]`): it credits what reached the container. */
  readsOutput?: boolean;
}

/** One statically allocated token-container transfer alternative. Branch alternatives may share transferIndex;
 * exactly one condition may be true for each physical slot in a concrete invocation. */
export interface TokenContainerTransferSiteAbi {
  transferIndex: number;
  tokenContainerSlot: number;
  kind: 'token' | 'nft';
  /** Undefined is unconditional; null records a conditional predicate older tooling cannot evaluate. */
  condition?: ExternalCallExpression | null;
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

/** Versioned tuple-wide wire representation for authenticated external-call results. */
export type ExternalResultEncoding = 'evm-abi-v1' | 'compact-pushdata-v1';

/** Kinds of slots in the 1:1 block layout. */
export type BlockSlotKind =
  | 'master'
  | 'dataNft'
  | 'readOnlyDataNft'
  | 'blockhashOracle'
  | 'blockInfoOracle'
  | 'keccakSideCar'
  | 'ecrecoverSideCar'
  | 'entry'
  | 'satoshiContainer'
  | 'tokenContainer'
  | 'transfer'
  | 'tcTransfer'
  | 'event'
  /** Continuation chunk `chunk` (>= 1) of the wide emit at `slotIndex`; follows that emit's `event` slot. */
  | 'eventChunk'
  | 'returnEvent'
  | 'deploy'
  /** Child data-NFT genesis outputs that follow a `deploy` slot (factory createPair-style). */
  | 'deployDataNft'
  | 'lowLevelCall'
  /** SDK-authenticated logical contract identity which is distinct from the physical participant master. */
  | 'identityAnchor'
  /** A merge-only minting master consumed by the authenticated lifecycle tail route. */
  | 'lifecycleMaster'
  | 'trailing';

/** A single slot in the function's block layout. */
export interface BlockLayoutSlot {
  kind: BlockSlotKind;
  offset: number;           // compile-time offset from block start (= from master)
  slotIndex?: number;       // for entry/tokenContainer/transfer/event/eventChunk/tcTransfer
  chunk?: number;           // eventChunk: the payload chunk this output carries (>= 1)
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
  /** Fixed slots after the runtime-variable region. Such a block cannot compact its trailing placeholders. */
  fixedSuffix?: number;
}

/**
 * Compiler-authored geometry for one typed stateful child-creation site reached by a message-bus handler.
 *
 * This is published even while the kernel admission gate remains closed, so transaction assemblers can grow
 * against an exact, application-neutral topology rather than rediscovering `new C(...)` from contract names.
 * One genesis input supplies the category; the corresponding output run is the child master followed by its
 * mutable data NFTs.
 */
/** A pure value expression which an SDK can reproduce from a decoded handler row and authenticated pre-state. */
export type ChildDeploymentValueRecipe =
  | { kind: 'handlerInput'; inputIndex: number; resultType?: string }
  /** The graph-authenticated logical caller for this invocation row. */
  | { kind: 'logicalCaller'; resultType: 'address' }
  /** A scalar decoded from the authenticated incoming participant state commitment. */
  | { kind: 'state'; name: string; resultType: string }
  /** A typed leaf of an authenticated incoming mapping entry, with source-position key snapshots. */
  | {
    kind: 'entry';
    collection: string;
    keys: readonly ChildDeploymentValueRecipe[];
    path: readonly (string | number)[];
    resultType: string;
  }
  | { kind: 'intLiteral'; value: string; resultType: string }
  | { kind: 'boolLiteral'; value: boolean; resultType: string }
  | { kind: 'bytesLiteral'; value: string; resultType: string }
  | { kind: 'cast'; resultType: string; operand: ChildDeploymentValueRecipe }
  | { kind: 'aggregate'; resultType: string; elements: readonly ChildDeploymentValueRecipe[] }
  | { kind: 'concat'; resultType: string; operands: readonly ChildDeploymentValueRecipe[] }
  | {
    kind: 'hash';
    algorithm: 'ripemd160' | 'sha1' | 'sha256' | 'hash160' | 'hash256';
    resultType: string;
    operand: ChildDeploymentValueRecipe;
  }
  | { kind: 'unary'; operator: '!' | '-'; resultType: string; operand: ChildDeploymentValueRecipe }
  | {
    kind: 'conditional';
    resultType: string;
    condition: ChildDeploymentValueRecipe;
    ifTrue: ChildDeploymentValueRecipe;
    ifFalse: ChildDeploymentValueRecipe;
  }
  | {
    kind: 'binary';
    operator: '*' | '/' | '%' | '+' | '-' | '<' | '<=' | '>' | '>=' | '==' | '!=' | '&&' | '||';
    resultType: string;
    left: ChildDeploymentValueRecipe;
    right: ChildDeploymentValueRecipe;
  };

/** A fixed BCH transfer whose operands are reproducible from one authenticated handler row. */
export interface FixedBchTransferAbi {
  /** Physical transfer register within the handler's per-row effect frame. */
  transferIndex: number;
  /** Legacy shallow sources retained for artifact consumers which do not yet evaluate recipes. */
  recipient: ArgSource;
  amount: ArgSource;
  /** Canonical typed recipes used by kernel composition. Absence means the operand is not materializable. */
  recipientRecipe?: ChildDeploymentValueRecipe;
  amountRecipe?: ChildDeploymentValueRecipe;
  /** A stateless child address derived from compiler-pinned body bytes and pure row recipes. */
  derivedRecipient?: {
    contractName: string;
    creationBytecode: string;
    constructorInputs: readonly AbiInput[];
    constructorArgs: readonly ChildDeploymentValueRecipe[];
    salt?: ChildDeploymentValueRecipe;
  };
  callOption?: 'value';
  /** Exact source-path predicate. Null explicitly means that source reachability is not reproducible. */
  condition?: ExternalCallExpression | null;
}

/** Completely folded, constructor-only initial state for one child deployment site. */
export interface ChildDeploymentGenesisStateAbi {
  kind: 'constructor';
  fields: readonly {
    name: string;
    type: string;
    nftIndex: number;
    fieldIndex: number;
    value: ChildDeploymentValueRecipe;
  }[];
}

/** One finite entry NFT created by a fully replayable child constructor. */
export interface ChildDeploymentGenesisEntryAbi {
  collection: string;
  collectionSignature: string;
  keyType: string;
  valueType: string;
  key: ChildDeploymentValueRecipe;
  value: ChildDeploymentValueRecipe;
}

export interface ChildDeploymentSiteAbi {
  siteIndex: number;
  contractName: string;
  occurrence: 'once' | 'conditional' | 'loop' | 'recursive';
  /** Offset and width of this source occurrence inside its route row's compiler-owned deployment frame. */
  spanOffset?: number;
  spanWidth?: number;
  /** Exact pure row expression deciding whether a conditional occurrence executes. */
  activation?: ChildDeploymentValueRecipe;
  genesisInputCount: 1;
  masterOutputCount: 1;
  dataNftOutputCount: number;
  entryNftOutputCount?: number;
  totalOutputCount: number;
  categorySource: 'genesis-input-outpoint-txhash';
  constructorArgs: readonly (ChildDeploymentValueRecipe | { kind: 'expression' })[];
  salt?: { kind: 'handlerInput'; inputIndex: number } | { kind: 'literal'; value: string }
  | ChildDeploymentValueRecipe | { kind: 'expression' };
  /** BCH sent by this creation site in its separately reserved transfer slot. The recipient is always the
   * compiler-authenticated child locking bytecode and is therefore intentionally not caller-supplied metadata. */
  value?: {
    transferIndex: number;
    amount: ChildDeploymentValueRecipe | { kind: 'expression' };
  };
  /** Exact child body embedded by the parent's address computation, before category/salt pinning. */
  creationBytecode: string;
  /** Hash of the canonical child state geometry used to interpret `genesisState`. */
  childLayoutDigest?: string;
  /** Present only when the complete constructor transition was folded into pure row recipes. */
  genesisState?: ChildDeploymentGenesisStateAbi;
  /** Finite constructor-created collection entries, in canonical child-output order. */
  genesisEntries?: readonly ChildDeploymentGenesisEntryAbi[];
  /** This site's genesis includes one compiler-folded call on the freshly created child. */
  hasFoldedChildCall?: true;
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

/**
 * Exact, fail-closed recipe for collapsing a source forwarding function into an authenticated delegate
 * execution frame. Publication alone grants no message-bus admission: the kernel verifier must still bind the
 * resolved implementation and payload to the executor input while keeping state and outputs owned by the
 * participant block.
 */
export interface DelegateForwardingAbi {
  version: 1;
  callIndex: number;
  payloadInput: number;
  target: ValueProvenance;
  targetBinding:
  | { kind: 'constructorArg'; input: number; name: string }
  | { kind: 'literal'; lockingBytecode: string };
  frame: {
    stateOwner: 'participant';
    executor: 'target-input';
    calldata: 'payload-input';
    outputOwner: 'participant';
  };
  terminalRequire: true;
}

/**
 * How much a framed entry's own write grows one dynamic value's run, in elements.
 *
 * A framed body holds a dynamic value in a run of chunk records, and an append grows that run by the elements it
 * pushes. `dynamicWriteSources` states the element itself when the artifact's vocabulary can name it; this fact
 * states the count that holds when it cannot, so a consumer can still size the run.
 */
export interface DynamicWriteGrowthAbi {
  /**
   * Elements the write appends: the total for a straight-line write, or the per-turn count when the appends run in
   * a run-time loop (the total is then `elements * length` of `varyingArrayParam`).
   */
  elements: number;
  /**
   * The array parameter whose length is the enclosing loop's trip count. Present when the appends run in a loop
   * over an array the call carries, so the run grows by `elements` per element of the caller's array.
   */
  varyingArrayParam?: string;
  /**
   * True when the appends run in a run-time loop whose trip count the compiler could not pin to a call parameter.
   * `elements` is then the per-turn count and the total is the loop's own width, which a consumer cannot resolve.
   */
  looping?: boolean;
}

export interface AbiFunction {
  name: string;
  /** Proven dense slice of one mapping-backed dynamic array. Absent unless the complete source body matches. */
  mappingArrayPagination?: {
    collection: string;
    keyParams: readonly string[];
    indexParam: string;
    limitParam: string;
  };
  /** Dominating source assignment to a public struct argument before it is consumed by a state write. */
  argumentFieldUpdates?: readonly {
    parameter: string; fieldPath: readonly string[]; source: 'blockTimestamp';
  }[];
  selector?: string;  // 4-byte hex selector (e.g. "a9059cbb")
  inputs: readonly AbiInput[];
  outputs?: readonly AbiOutput[];       // return types (omitted for void functions)
  /** Tuple-wide wire representation used for typed external results. */
  resultEncoding?: ExternalResultEncoding;
  /**
   * A direct call's return carrier is the record of the call it answers: `digest || form || result`, the digest
   * over its selector and arguments, the result inline or its SHA256 (docs/wip/call-records/DESIGN.md).
   */
  callRecord?: boolean;
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
  /** Compiler-owned owner-local effect frame for an unrolled message-bus route.
   * Dispatch site `s` owns `[base + s * width, base + (s + 1) * width)` for each effect kind. */
  graphEffectFrame?: {
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
    deployBase?: number;
    deployWidth?: number;
    deployOffset?: number;
    deployInputOffset?: number;
  };
  entryAccesses?: readonly EntryAccessAbi[];
  /** Compiler proof that source-effect ordinals form one straight-line order. */
  sourceEffectOrder?: 'linear' | 'unsupported-flow';
  /** Compiler proof that the complete function body is exactly `return mapping[keys...]`, with each key a
   * direct visible parameter. SDKs may use this to answer the read without executing a derivation transaction. */
  directMappingReturn?: {
    collection: string;
    keyParams: readonly string[];
  };
  /** Exact read-only `return mapping[keys...].length` over an authenticated mapping-array entry. */
  directCollectionLengthReturn?: {
    collection: string;
    keyParams: readonly string[];
  };
  /** Compiler proof that a source read-only body, after only pure address-target captures,
   * returns one external call's result unchanged. */
  directExternalReturn?: { callsiteId: number };
  externalReads?: readonly ExternalReadAbi[];
  externalCalls?: readonly ExternalCallAbi[];
  /** Local call-result values forwarded as arguments into later external callsites. */
  resultConsumers?: readonly ExternalResultConsumerAbi[];
  externalOutStateReads?: readonly ExternalOutStateAbi[];
  emits?: readonly EmitAbi[];
  runtimeLoopEvents?: readonly RuntimeLoopEventAbi[];
  runtimeLoopTransfers?: readonly RuntimeLoopTransferAbi[];
  transferCount?: number;
  transfers?: readonly FixedBchTransferAbi[];
  deployTargets?: readonly {
    contractName: string; dataNftCount: number; entryNftCount?: number;
    // Per child constructor argument: the deploy-function parameter name it forwards (direct `new C(param)`),
    // or null for a non-trivial expression. Lets the SDK derive childConstructorArgs from the deploy args.
    constructorArgs?: readonly (string | null)[];
    // create2 salt (`new C{salt}()`): forwarded param name, hex literal, or computed (SDK needs explicit
    // childSalt). Lets the SDK build the child Contract with the salt the deploy covenant pins.
    salt?: { param: string } | { literal: string } | { computed: true };
    /** Exact child redeem-script body embedded by the factory for CREATE/CREATE2 address derivation. */
    creationBytecode?: string;
    /** The deploy covenant folds a same-transaction child call and its post-call genesis must be VM-derived. */
    hasFoldedChildCall?: boolean;
    childLayoutDigest?: string;
    genesisState?: ChildDeploymentGenesisStateAbi;
    genesisEntries?: readonly ChildDeploymentGenesisEntryAbi[];
  }[];
  tokenContainerAccesses?: readonly TokenContainerAccessAbi[];
  tokenContainerTransferSites?: readonly TokenContainerTransferSiteAbi[];
  usesMsgSender?: boolean;
  /** The function or a reachable named internal helper reads msg.data. */
  usesMsgData?: boolean;
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
    /** Source reachability of this physical callsite. Absent identifies an older artifact, never `once`. */
    occurrence?: 'once' | 'conditional' | 'loop';
    /** Exact compiler-proven ceiling (one for a branch, literal trip count for a fixed loop). */
    maximumOccurrences?: number;
    /**
     * Runtime predicate guarding this callsite, serialized from its enclosing source branches in the same
     * `ExternalCallExpression` vocabulary an external call's `condition` uses. A `conditional` row whose
     * predicate the compiler could not name publishes none: absence reads as unknown reachability, never as
     * an unconditional edge.
     */
    condition?: ExternalCallExpression;
    /**
     * Where the call's TARGET address came from. Published by every compiler that knows how to answer, with
     * `computed` as the always-available fallback, so an absent `target` identifies an artifact compiled
     * before the field existed - it is never a claim that the target is fixed. Read it with
     * `lowLevelCallTargetProvenance`, which makes that unknown leg explicit.
     */
    target?: ValueProvenance;
    /**
     * A Solidity-compat call site's target and payload, serialized as a `__raw__` call's, so the SDK can co-spend the
     * pinned callee without a `.withCall()`. Absent when the compiler could not serialize them. `targetSource` is
     * also the exact replayable target source when the compiler proves an immutable, side-effect-free recipe.
     */
    targetSource?: ArgSource;
    dataSource?: ArgSource;
  }[];
  /**
   * Compiler proof that this function is only a singular delegate frame: one unconditional low-level
   * delegatecall statement followed by `require(true)`. Consumers may replace that forwarding frame with an
   * authenticated implementation route only when they also bind the published target and payload input.
   */
  delegateForwarding?: DelegateForwardingAbi;
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
  /**
   * Exact constructor-time values for dynamic writes which the SDK can replay before genesis. Expressions are
   * published only when every control-flow arm assigns the same variable and the complete expression is
   * serializable; absence is unknown and must retain VM-probe fallback behavior.
   */
  dynamicWriteSources?: Readonly<Record<string, ExternalCallExpression>>;
  /**
   * Per-call entry writes that grow a dynamic value's run without stating the element, keyed by variable name.
   * The count lets a consumer size the run the write creates when `dynamicWriteSources` publishes no element.
   */
  dynamicWriteGrowth?: Readonly<Record<string, DynamicWriteGrowthAbi>>;
  /**
   * The order a framed frame declares the runs of chunk records its dynamic writes occupy: past every sorted
   * batch's groups, one run per written value, in state declaration order, which `dynamicWrites` (the order the
   * writes were emitted) need not follow. Published for an entry that writes several dynamic values, or one beside
   * several sorted batches; one run beside at most one batch sits past that batch's groups and publishes none.
   */
  dynamicWriteOrder?: readonly string[];
  /** Pure, single-write handler values replayable from authenticated pre-state and call inputs. */
  dynamicWriteRecipes?: Readonly<Record<string, ChildDeploymentValueRecipe>>;
  // Collections written by a runtime loop (`for(i<n) m[k[i]]=v[i]`); the SDK derives the N (key,value) pairs from
  // the VM trace and creates N trailing entry NFT outputs (a runtime-variable count, like dynamicWrites chunks).
  entryLoopWrites?: readonly string[];
  /** Exact compiler-owned collection signatures for entryLoopWrites, keyed by collection name. */
  entryLoopWriteSignatures?: Readonly<Record<string, string>>;
  // Sorted (vmap) collections written by a diff-key INSERT loop (`for(i<n) m[k[i]]=v`); the SDK co-spends N bracketing
  // predecessors and emits N (P', NEW) commitment pairs, deriving the evolving sorted list per iteration.
  sortedInsertLoops?: readonly string[];
  // Per-loop derivation metadata for the above: the fixed leading key params, the varying key array param (its
  // elements are the per-iteration last key), and the value (a param or a bool literal). Enough for the SDK to
  // compute each H(k) = keyToSlotMulti([...fixedKeys, arr[i]]) and build the co-spend/output plan off-chain.
  sortedInsertLoopInfo?: readonly SortedInsertLoopAbi[];
  sortedUpsertLoopInfo?: readonly SortedUpsertLoopAbi[];
  /**
   * Optional compiler-owned replay programs for locally constructed key vectors. These become actionable only
   * when the corresponding kernel route authenticates the replayed key/rank relation; consumers must ignore
   * an artifact carrying a descriptor without that route capability.
   */
  constructedKeyVectors?: readonly ConstructedKeyVectorV1Abi[];
  /**
   * Compiler-authored affine recursive-frame relation. It is not a kernel capability:
   * absence and presence both require the existing recursive settlement admission checks.
   */
  affineRecursiveFrames?: readonly AffineRecursiveFrameV1Abi[];
  /** Fixed straight-line vmap writes sharing one atomic linked-list transition. */
  sortedBatchInfo?: readonly { collection: string; slotIndices: readonly number[]; linear?: boolean }[];
  // Function params whose value feeds blockhash(n); the SDK reads the arg to resolve addr(n) and co-spend
  // the (n->hash) oracle UTXO as a trailing input.
  blockhashReads?: readonly string[];
  /** The body slices the block-info oracle commitment. The SDK co-spends that UTXO and fills its input index. */
  usesBlockOracle?: boolean;
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
  keccakChainReads?: boolean;   // a direct, unbounded preimage routes through the chained START/CONT/FINAL side-cars
  // in the trailing region (one per 136-byte block, FINAL last)
  keccakLoopPrecedesTrailingUser?: boolean; // a direct keccak loop runs BEFORE a runtime mapping loop in source order
  // ecrecoverPubKey uses a co-spent recovery side-car pair per call; send() co-spends 2N inputs.
  ecrecoverCompute?: boolean;
  // Per ecrecoverPubKey call (in order), its [hash, v, r, s] parameter names.
  ecrecoverArgParams?: readonly (readonly (string | null)[])[];
  ecrecoverEvmFlags?: readonly boolean[]; // also identifies calls that need a keccak side-car
  /** Closed, source-ordered compute operands, evaluated only from authenticated invocation values. */
  computeSideCarRecipes?: ComputeSideCarRecipesAbi;
  ecrecoverLoopReads?: boolean; // dynamic ecrecover loop: the SDK co-spends one recovery triple per sig-array element
}

/**
 * One compiler-authenticated runtime-journal stream which may use a route-local
 * physical protocol. A handler selector and its compact access-stream ordinal
 * are both required: a route capability must never defer unrelated handler
 * rows merely because they share the same artifact.
 */
export interface KernelEntryJournalCapabilityScopeAbi {
  /** Canonical four-byte external handler selector, lowercase hex without 0x. */
  handlerSelector: string;
  /** Stable compiler-owned ordinal in that handler's journal-access vector. */
  journalAccessStreamIndex: number;
}

/** Physical ownership selected by completed compiler descriptors for one kernel journal family. */
export type KernelJournalDispositionAbi = 'carrier' | 'eager-journal' | 'neutral';

/** One compiler-owned compact journal stream in its stable handler-local ordinal space. */
export interface KernelJournalDispositionStreamAbi {
  journalAccessStreamIndex: number;
  /** Digest of the exact completed stream descriptor used by final code generation. */
  descriptorDigest: string;
  disposition: KernelJournalDispositionAbi;
}

/** Completed-descriptor disposition for one external handler. */
export interface KernelJournalDispositionHandlerScopeAbi {
  /** Canonical four-byte external handler selector, lowercase hex without 0x. */
  selectorHex: string;
  /** Digest of the complete final-codegen descriptor family for this handler. */
  completedDescriptorDigest: string;
  mode: KernelJournalDispositionAbi;
  /** Ordered exactly as the handler's compact journal stream vector. */
  streams: readonly KernelJournalDispositionStreamAbi[];
}

/** Versioned, ordered projection of the compiler's final-codegen journal ownership decision. */
export interface KernelJournalDispositionsAbi {
  version: 1;
  handlers: readonly KernelJournalDispositionHandlerScopeAbi[];
}

export interface CollectionIterationAbi {
  collection: string;
  mode: 'entries' | 'keys' | 'values';
  iterationIndex: number;
  /** Windowed (paginated) iteration: the register state variable holding the cursor (a 32-byte slot). */
  windowCursor?: string;
  /** Windowed iteration: the maximum number of entries walked per transaction. */
  windowBound?: number;
}

export interface FunctionDebugInformation {
  requires: readonly RequireStatement[];
  sourceMap: string;
  logs: readonly LogEntry[];
}

/** Debug metadata for bytecode entered through OP_INVOKE, keyed by its script-number identifier. */
export interface InvokeDebugInformation extends FunctionDebugInformation {
  bytecode: string;
  name?: string;
}

export interface DebugInformation {
  bytecode: string; // unlike `bytecode` property above, this is a hex-encoded binary string
  /**
   * Present and `false` only when the artifact was compiled with `optimise: false`. The instruction stream is then
   * the code generator's own, so `sourceMap`, `requires` and `logs` instruction pointers are exact and a VM
   * failure can be attributed to the source construct that produced it without a correction scan.
   */
  optimise?: boolean;
  sourceMap: string; // see documentation for `generateSourceMap`
  logs: readonly LogEntry[]; // log entries generated from `console.log` statements
  requires: readonly RequireStatement[]; // messages for failing `require` statements
  functionDebug?: Record<string, FunctionDebugInformation>; // per-function debug info keyed by selector hex
  invokeDebug?: Record<string, InvokeDebugInformation>; // nested OP_INVOKE bodies keyed by function id
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
  /** Where each argument of the custom error a `revert` names sits when it fails, in declared order. */
  arguments?: readonly RevertArgumentSource[];
  /** Custom-error arguments left on the VM stack by the failing branch, in declaration order. */
  errorArgumentTypes?: string[];
}

/**
 * One argument of a failing `revert <Error>(...)`: `depth` items below the top of the stack or the bytes `push`
 * names, then through `then`, a conversion's bytecode. `{}` is an argument the compiler cannot place.
 */
export interface RevertArgumentSource {
  depth?: number;
  push?: string;
  then?: string;
}

export interface StateVariableInfo {
  name: string;
  type: string;
  nftIndex: number;
  fieldIndex: number;
  visibility?: string;  // 'external' | 'internal' | 'private' - omitted when 'public' (default)
  immutable?: boolean;  // true when variable can only be assigned in constructor - omitted when false (default)
  contractType?: string;  // contract/interface name when type is a contract reference (e.g. 'Registry')
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
  /** Solidity-compatible sorted mappings hash address keys by their 20-byte identity, not their wire spelling. */
  addressKeyEncoding?: 'identity20';
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
  /** True when this mapping uses the vmap sorted-linked-list backend (SDK drives it via SortedList). */
  sorted?: boolean;
  /** True when the value is a variable-width blob that chunks when large (P5b): unbounded bytes/string, struct,
   * dynamic array. The SDK gates chunk read-witness / write-mint / GC on this. Omitted when false. */
  chunkableValue?: boolean;
  /** True for an `enumerable mapping(...)` - the mapping may be iterated. A plain mapping is not enumerable
   * (Solidity parity). Omitted when false. */
  enumerable?: boolean;
}

/**
 * True when the artifact publishes the collection as one whose values chunk.
 *
 * A chunking collection keeps the value's four-byte byte length ahead of a node's value; any other collection holds
 * the encoded value itself where that length would sit, so bytes read there are a length only where one is written.
 */
export function collectionChunksValue(artifact: Artifact | undefined, collection: string): boolean {
  return artifact?.stateLayout?.collections
    ?.find((candidate) => candidate.name === collection)?.chunkableValue === true;
}

export interface SortedInsertLoopAbi {
  collection: string;
  fixedKeyParams: readonly string[]; // leading param keys (in order), constant across the loop
  varyingArrayParam: string;         // the array whose elements are the varying LAST key, one per iteration
  valueParam?: string;               // the value comes from this function param
  valueBool?: boolean;               // ... or is this bool literal (true -> 0x01 tail, false -> empty tail)
}

/**
 * Stable identity recipe for every access in one runtime journal stream.
 *
 * Record ordinals are necessarily runtime values: first-touch order depends on the actual keys and whether each
 * key is present. Consumers derive one identity per referenced record as
 * `(accessStreamIndex, access-program ordinal, decoded record ordinal, record role)`. The predecessor role is
 * active only when the compact access flags publish a predecessor. Settlement ownership is resolved across the
 * complete scheduled journal by choosing the last mutating access for each referenced record. This identity names
 * the access responsible for a record's final disposition; it neither promises that a physical output exists (a
 * delete can settle to absence) nor changes the journal band's global first-touch record-ordinal ordering.
 */
export interface JournalSettlementIdentityAbi {
  /** Must equal the containing stream's journalAccessStreamIndex. */
  accessStreamIndex: number;
  /** Record references are decoded in the route-owned, transaction-wide first-touch ordinal domain. */
  recordOrdinalScope?: 'global-journal';
  /** The compact access program's zero-based operation order supplies the source occurrence. */
  accessOrdinalSource: 'access-program-order';
  /**
   * Runtime record references carried by each compact access. The predecessor role is present only when the
   * canonical access flags carry predecessorRecordOrdinal; listing it here does not itself grant output ownership.
   */
  recordOrdinalSources: readonly ['target-record-ordinal', 'predecessor-record-ordinal'];
  /**
   * Stream capability, intersected with the decoded access flags: target mutates iff `access.mutates`, predecessor
   * mutates iff `access.mutates && predecessorRecordOrdinal !== undefined`; all other references are carriers.
   */
  settlementRole: 'carrier-only' | 'mutation-settlement';
  /** Rule selecting the unique settlement owner for a record referenced by several accesses. */
  settlementOwnership: 'none' | 'last-mutating-access';
  /**
   * Physical disposition phase contributed by this stream. Optional only for backward compatibility: newly
   * compiled carrier reads authenticate an existing input, while mutations authorize a resulting output.
   */
  recordDispositionSource?: 'authenticated-carrier' | 'mutation-settlement';
}

// Per-iteration vmap UPDATE loop `for(i) m[k[i]] += v[i]` (multitransfer credit to existing recipients): the SDK
// co-spends each k[i]'s existing entry at input[master+blockSize+i] and mints its updated commitment at
// output[master+blockSize+i] with value = oldValue op v[i].
export interface SortedUpsertLoopAbi {
  collection: string;
  /** Hex-encoded 20-byte hash binding this access stream to one collection covenant. */
  collectionHash: string;
  /** Stable source-order position of this stream in the selected row's compact journal-access vector. */
  journalAccessStreamIndex: number;
  /** Stable runtime record/settlement identity recipe. Optional only for backward compatibility with old artifacts. */
  settlementIdentity?: JournalSettlementIdentityAbi;
  /** Opaque compiler ordinal shared by operation streams executed within the same source loop. */
  journalExecutionGroup?: number;
  fixedKeyParams: readonly string[];
  fixedKeySources?: readonly KeySourceAbi[];
  varyingArrayParam: string;   // the array of keys (recipients), one per iteration
  /** Composite-key positions populated from the same varying element. Omitted means the final key component. */
  varyingKeyIndices?: readonly number[];
  /** Complete key-component recipes evaluated at the logical counter value before physical slot sorting. */
  varyingKeyExpressions?: readonly ExternalCallExpression[];
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
  /** The varying array contains ABI blobs; decode this tuple element to obtain each key. */
  keyDecodeTupleIndex?: number;
  keyDecodeTupleTypes?: readonly string[];
  /** Keep only iterations where predicateArrayParam[i] equals this integer value. */
  predicateArrayParam?: string;
  predicateEquals?: string;
  valueArrayParam?: string;    // the array of per-key values (amounts); absent for 'delete' (no value)
  /** Compiler-owned logical-index array used to select valueArrayParam elements without reordering the public array. */
  valueArrayIndexParam?: string;
  valueArrayOffset?: string;   // set value = valueArrayParam[i] + this signed decimal constant
  valueScalarParam?: string;   // a loop-INVARIANT param value (same for every key), e.g. `+= amount` (fixed airdrop)
  valueConst?: string;         // a loop-invariant INT LITERAL value (decimal string), e.g. `+= 100`
  /**
   * The loop stores this bool literal under every key.
   *
   * A bool literal's tail is `0x01` for true and empty for false, which are the same bytes as the int literals 1
   * and 0, so an emitter that states the value in {@link valueConst} as `1` or `0` carries exactly the same write.
   * A reader that needs the distinction reads this field when it is published and falls back to the constant.
   */
  valueBool?: boolean;
  valueRuntimeLocal?: string;
  valueRuntimeExpression?: boolean;
  /**
   * A turn reads the entry the loop writes, besides a read-modify-write's own base: a repeated key's later turn reads
   * what an earlier turn wrote, so its occurrences cannot be merged into one. Published for the direct convention.
   */
  readsWrittenEntry?: boolean;
  /**
   * The loop body runs a per-turn effect besides this write (an event, a require, another write), which the EVM
   * runs once per turn. Merging a repeated key's turns would run it one time fewer, so the SDK refuses the repeat.
   */
  siblingEffect?: boolean;
  /** Authenticated source-order trace for a mapping value which carries state between loop iterations. */
  valueTraceWitnessParam?: string;
  valueTraceLocal?: string;
  valueTraceInitial?: ExternalCallExpression;
  valueTraceUpdates?: readonly {
    condition?: ExternalCallExpression;
    expression: ExternalCallExpression;
  }[];
  valueTraceAfterUpdates?: readonly {
    condition?: ExternalCallExpression;
    expression: ExternalCallExpression;
  }[];
  /** Compiler-owned prefix-boundary trace: N+1 counts around N conditional constructed-array resizes. */
  prefixCountWitnessParam?: string;
  /** Source-order predicate which advances prefixCountWitnessParam by exactly one. */
  prefixCountCondition?: ExternalCallExpression;
  mutation?: 'push' | 'pop' | 'setAt';
  mutationValueArrayParam?: string;
  /** Compiler-owned logical indices selecting mutationValueArrayParam without reordering the public array. */
  mutationValueArrayIndexParam?: string;
  mutationValueScalarParam?: string;
  mutationValueConst?: string;
  /** Replayable source expression for a mutation value not reducible to one direct parameter/literal source. */
  mutationValueExpression?: ExternalCallExpression;
  mutationIndexArrayParam?: string;
  /** Compiler-owned logical indices selecting mutationIndexArrayParam without reordering the public array. */
  mutationIndexArrayIndexParam?: string;
  mutationIndexScalarParam?: string;
  mutationIndexConst?: string;
  /** Replayable source expression for a setAt index not reducible to one direct parameter/literal source. */
  mutationIndexExpression?: ExternalCallExpression;
  oldValuesWitnessParam?: string;
  /** Ordering/cardinality of the old-value witness; omitted means the complete logical source domain. */
  oldValuesWitnessDomain?: 'selected-source';
  /** Authenticated inverse permutation mapping compact source occurrence to physical witness rank. */
  sourceOrderIndexParam?: string;
  /** Exact physical widths of this independently sorted runtime stream. */
  inputCountParam?: string;
  outputCountParam?: string;
  /** Runtime predicate controlling whether this loop contributes any journal entries. */
  condition?: ExternalCallExpression;
  /** Predicate selecting logical counter values which actually contribute journal entries. */
  iterationCondition?: ExternalCallExpression;
  /** Predicate which terminates source-domain replay after the current iteration. */
  iterationBreakCondition?: ExternalCallExpression;
  /** Public-argument expression computing a non-affine source-loop bound. */
  iterationBound?: ExternalCallExpression;
  /** The source condition is `counter != bound`; the endpoint must be exactly reachable by the signed step. */
  iterationExactBound?: boolean;
  /** Public-argument expression computing the signed source-loop step. */
  iterationStep?: ExternalCallExpression;
  /** `read` authenticates and exactly preserves an existing counter-keyed entry. */
  op: '+' | '-' | 'set' | 'delete' | 'read';
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
  /** Compiler-proven key expression after an adjacent, unconditional mapping write. */
  postWriteExpressionLabel?: string;
  /** Authenticated mapping snapshots this key reads before the handler's first mutation. */
  preWriteMappingCollections?: readonly string[];
}

export interface EntryAccessAbi {
  /** Physical entry-slot ordinal. Differs from this array's index when runtime-loop entries were filtered out. */
  slotIndex?: number;
  collection: string;
  keyParams: string[];
  keySources?: readonly KeySourceAbi[];  // optional for backward compat with old artifacts
  operations: readonly string[];
  /** Compiler-authored mutation identities; not a control-flow reachability or terminality proof. */
  mutationEffectOrdinals?: readonly number[];
  /** Compiler proof that this entry stores a dynamic-array value in authenticated continuation chunks. */
  chunkableArrayValue?: true;
  // A write slot gated off when its key aliases the delete slot at this index (swap-remove of the last key).
  aliasCondDeleteSlot?: number;
  runtimeAliasPriorSlots?: readonly number[];
  /** Direct compose-on-alias: earlier batch writes this write may share an entry with (alias row iff equal slot). */
  composeAliasPriorSlots?: readonly number[];
  /** A direct pure sorted read that may prove its key with this earlier slot's proof input (the SDK funds its own). */
  sharedProofPriorSlot?: number;
  // A sorted (vmap) write of an unbounded bytes/string value from this function parameter. The SDK persists the
  // full value as chunks (P5b); the entry stores only len ++ sha256(value). Absent for computed-expression values.
  valueParam?: string;
  /** Canonical expression for a whole-value write when it is not a direct parameter (e.g. `lit:hello`). */
  valueSource?: string;
  /** Exact whole-value recipe for a unique, unconditional collection mutation in this handler. */
  storedValueSource?: {
    version: 1;
    execution: 'unconditional-once';
    mutationEffectOrdinal: number;
    valueType: string;
    expression: ExternalCallExpression;
  };
  /** Compiler-authenticated, typed source of the element appended by one exact chunkable-array mutation. */
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
   *
   * A framed body publishes one for a write a branch guards, which its frame lets the body skip: the predicates
   * on the write's path, read where each branch starts, in a call site's `condition` language. A builder decides it
   * from the frame's own facts and declares the write only where it runs; a skipped write keeps its node, or its
   * absent key's predecessor. `{ kind: 'unsupported' }` marks a write the frame may skip under a condition those
   * facts do not decide.
   */
  activation?: ExternalCallExpression;
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
  kind: 'forward' | 'constructorArg' | 'literal' | 'msgSender' | 'selfAddress' | 'arrayElement' | 'loopIndex'
  | 'expression';
  paramIndex?: number;     // for 'forward': index into the user-visible function args
  indexParamIndex?: number; // for 'arrayElement': optional function parameter containing the element index
  indexValue?: number;     // for 'arrayElement': fixed index, or the index at occurrence zero when indexStepValue is present
  indexStepValue?: number; // for 'arrayElement': per-occurrence index delta of a loop induction variable index
  initialValue?: string;   // for 'loopIndex': value at occurrence zero
  stepValue?: string;      // for 'loopIndex': delta per reached occurrence
  stepExpression?: ExternalCallExpression; // for 'loopIndex': runtime delta from public arguments
  counterName?: string;  // compiler-bound induction variable for nested-domain coordinate selection
  paramName?: string;      // for 'constructorArg': name of the constructor parameter
  value?: string;          // for 'literal': serialized value
  type?: string;           // for 'literal': SolidCash type string
  expression?: ExternalCallExpression;
}

export interface ExternalCallExpression {
  kind: string;
  /** Source-site identity for compiler-owned compute ordinal checks; has no replay semantics. */
  computeSourceSite?: string;
  /** Closed typed fixed-effect predicate; callers without authenticated entry context must leave it unknown. */
  fixedEffectRecipe?: ChildDeploymentValueRecipe;
  name?: string;
  /**
   * Physical producer/consumer lane within the containing function after repeated-owner collapse.
   * For `producerResult` / `externalCall`, pair with `sourceCallsiteId` when the producer was batched.
   */
  callsiteId?: number;
  /**
   * Pre-collapse source callsite of the producer. Distinct from `callsiteId` for collapsed batch rows;
   * equals `callsiteId` for ordinary (non-batched) edges. Kernel artifacts publish this whenever the
   * expression names a producer that participated in repeated-owner collapse.
   */
  sourceCallsiteId?: number;
  /** Zero-based ABI result position selected from the producer (also explicit for a sole result). */
  resultIndex?: number;
  /** Authenticated receiver expression for a returning external call. */
  target?: ExternalCallExpression;
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
  /** Parameter names for a compiler-published pure helper body. */
  parameters?: readonly string[];
  /** Bounded statement program for a compiler-published pure helper body. */
  statements?: readonly ExternalCallStatement[];
}

/**
 * Source-authored operands for compute side-cars in one physical handler invocation.
 * Entries are in the same order as the handler's reserved Keccak and recovery calls. A missing entry is never
 * permission to discover an operand from a VM trace: recipe-mode planners must leave it unresolved.
 */
export interface ComputeSideCarRecipesAbi {
  version: 1;
  keccak: readonly ExternalCallExpression[];
  ecrecover: readonly (
    | { kind: 'args4'; args: readonly [ExternalCallExpression, ExternalCallExpression,
      ExternalCallExpression, ExternalCallExpression] }
    | { kind: 'signature65'; hash: ExternalCallExpression; signature: ExternalCallExpression }
  )[];
}

/**
 * One authenticated use of an earlier graph call's result.
 *
 * `consumerCallsiteId` / `producerCallsiteId` are physical lanes. When the producer was a collapsed
 * batch row, `producerSourceCallsiteId` carries the pre-collapse source identity so result consumption
 * can address that specific source row inside the physical batch.
 */
export type ExternalResultConsumerAbi = {
  consumerCallsiteId: number;
  producerCallsiteId: number;
  /** Pre-collapse source identity of the producer when it differs from the physical lane (batched). */
  producerSourceCallsiteId?: number;
  /** Exact component selected from the producer's canonical return tuple. */
  resultIndex?: number;
} & (
  | { argument: number; condition?: never }
  | { condition: true; argument?: never }
  | { iterationDomain: true; argument?: never; condition?: never }
);

/**
 * A compiler-authored, finite proof program for a locally constructed mapping-key vector.
 *
 * This is deliberately data-only ABI metadata: consumers must evaluate it with the narrow v1 replay
 * interpreter, never by executing source text or inspecting local variable names. Omission is not a weaker
 * descriptor; it means the compiler did not prove a replay program and kernel admission must remain closed.
 */
export interface ConstructedKeyVectorV1Abi {
  version: 1;
  /** Stable ordinal within the owning handler's compact journal-access stream. */
  vectorOrdinal: number;
  /** Exact fixed-width element ABI type. */
  elementType: string;
  allocationLength: ExternalCallExpression;
  producer: {
    domain: {
      kind: 'pre-test' | 'post-test';
      start: ExternalCallExpression;
      bound: ExternalCallExpression;
      step: ExternalCallExpression;
      comparison: '<' | '<=' | '>' | '>=';
    };
    writes: readonly {
      index: ExternalCallExpression;
      value: ExternalCallExpression;
      condition?: ExternalCallExpression;
    }[];
  };
  consumer: {
    index: ExternalCallExpression;
    vectorElementComponent: number;
    keyComponentCount: number;
    fixedComponents: readonly { component: number; expression: ExternalCallExpression }[];
  };
}

/**
 * A data-only proof of the relationship between a source recursive unwind rank and the
 * mapping accesses made by that frame. It intentionally names neither source locals nor
 * state declarations: `accessOrdinal` binds it to the already-published compact journal
 * access order. A consumer must not treat this metadata as permission to change the
 * physical settlement protocol; it is preparatory evidence for a future authenticated
 * recursive-frame bridge.
 */
export interface AffineRecursiveFrameV1Abi {
  version: 1;
  phase: 'unwind';
  inductionParameterIndex: number;
  step: ExternalCallExpression;
  maximumFrames: 64;
  parameterProgressions: readonly {
    parameterIndex: number;
    direction: 'add' | 'subtract';
    step: ExternalCallExpression;
    counterSlope?: ExternalCallExpression;
  }[];
  accesses: readonly {
    accessOrdinal: number;
    operation: 'read' | 'set' | 'delete';
    key: readonly ExternalCallExpression[];
  }[];
}

export interface ExternalCallStatement {
  kind: 'variable' | 'assign' | 'arrayAssign' | 'while' | 'branch' | 'return' | 'expression' | 'block'
  | 'require';
  name?: string;
  type?: string;
  index?: ExternalCallExpression;
  expression?: ExternalCallExpression;
  condition?: ExternalCallExpression;
  statements?: readonly ExternalCallStatement[];
  elseStatements?: readonly ExternalCallStatement[];
}

/**
 * Compiler-published caller authentication for one callsite edge.
 * Do not infer the subject from proxy/delegate execution geometry; resolve the published role.
 */
export interface CallsiteCallerIdentityAbi {
  version: 1;
  /**
   * Role of the authenticated caller subject for this edge.
   * - origin: transaction-origin / root (subject empty or rootCaller; authOffset 0xffff)
   * - active: exact authenticated identity through which the calling participant entered; delegate execution
   *   resolves to its state owner rather than its executor
   * - owner: physical state-owner master of the calling participant
   * - create: CREATE / getAddress() logical identity of the calling participant
   * - proxy: proxy-facing public identity when distinct from owner
   * - executor: co-spent implementation input (rare; only when the edge literally authenticates the executor)
   */
  role: 'origin' | 'active' | 'owner' | 'create' | 'proxy' | 'executor';
  /**
   * How the covenant authenticates the subject bytes.
   * - input-bytecode: subject == lockingBytecode of caller participant input at authOffset
   * - category: subject derived from state-token category (legacy scalar msgSenderCategory path)
   * - literal: subject is compile-time constant lock bytes
   */
  auth: 'input-bytecode' | 'category' | 'literal';
  /** Participant-local input offset that authenticates the caller subject (0xffff when none). */
  authOffset: number;
  /** Optional compile-time subject lock hex when auth === 'literal'. */
  subjectLockingBytecode?: string;
}

/**
 * One compiler-authored outgoing call edge.
 *
 * Callsite identity is a four-tuple carried through discovery → composition → result consumption:
 * - **Physical callsite ID** (`callsiteId`): post-collapse co-spend / consumer lane.
 * - **Source callsite ID** (`batchInvocations[].sourceCallsiteId`): pre-collapse syntactic edge.
 * - **Batch logical index** (`batchInvocations[].logicalIndex`): ordered row inside one physical batch.
 * - **Occurrence** (`occurrence` / runtime `occurrenceIndex`): reach index of that source row.
 *
 * Non-batched calls: physical === source; logical index absent; occurrence 0 unless loop/conditional.
 * Batched calls (kernel): physical ≠ source in general; every row publishes `sourceCallsiteId` +
 * `logicalIndex`; runtime occurrence is required and monotone per `(sourceCallsiteId, logicalIndex)`.
 * Do not invent source identity from proxy/delegate/locking bytecode.
 */
export interface ExternalCallAbi {
  /** Direct unconditional zero-argument readonly aliases share one authenticated return value. */
  readonlyReturnBinding?: { version: 1; selector: string };
  /** Stable compiler-assigned physical callsite/slot identifier within the containing function. */
  callsiteId?: number;
  /** Compiler-authored function-local program point of this call effect. */
  sourceEffectOrdinal?: number;
  /** Source start of the call expression, retained for deterministic SDK derivation diagnostics. */
  sourceLocation?: { line: number; column: number };
  /** Source reachability class; loop/conditional rows require runtime occurrence proof. */
  occurrence?: 'once' | 'conditional' | 'loop';
  /** Runtime predicate guarding this callsite, serialized from its enclosing source branches. */
  condition?: ExternalCallExpression;
  /** Compiler-proven necessary `require` predicates before this call. A false guard makes the call unreachable. */
  preCallRequires?: readonly ExternalCallExpression[];
  /** Exact affine pre-test loop recurrence which reaches this callsite. Unlike `maximumOccurrences`, this
   * describes the runtime iteration domain rather than only publishing a protocol ceiling. */
  iterationDomain?: ExternalCallIterationDomainAbi;
  /** Outer-to-inner affine domains for a call inside nested pre-test loops. Consumers which cannot
   * identify every source coordinate must refuse the call rather than flattening one counter. */
  nestedIterationDomains?: readonly ExternalCallIterationDomainAbi[];
  /** ABI output array directly populated by this loop call (`result[i] = call(); return result`). */
  resultArrayOutput?: number;
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
  /**
   * Authenticated caller subject for this outgoing edge. Kernel artifacts publish this for every callsite;
   * absence is legacy and may fall back to owner@0 only outside `kernel-row-loop`.
   */
  callerIdentity?: CallsiteCallerIdentityAbi;
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
  // Foreign fn-ptr call: the SDK fills a framed master-index witness.
  fnPtrCall?: boolean;
  // A regular direct call needs a selector witness unless the callee has only one method.
  needsSelectorVerification?: boolean;
  requiredDataNftIndices: number[];
  hasReturnValues?: boolean;
  returnTypes?: readonly string[];
  /** Tuple-wide result representation expected by this compiler-authored callsite. */
  resultEncoding?: ExternalResultEncoding;
  returnEventSignature?: string;
  computedOffset?: number;
  callMode?: 'call' | 'staticcall' | 'delegatecall';
  /** Value bit emitted for this graph edge. Explicit false distinguishes new artifacts from legacy absence. */
  callValueEffect?: boolean;
  opaqueReturn?: boolean; // `(bool,bytes)=addr.call(payload)`: opaque integrity-bound return, callee unknown at compile time
  argSources?: readonly ArgSource[];
  rawFunctionName?: string; // decoded abi.encodeCall target for a low-level call
  rawSelector?: string; // decoded abi.encodeWithSelector selector when the source function name is unavailable
  rawArgSources?: readonly ArgSource[];
  batchInvocations?: readonly {
    selector: string;
    /**
     * Pre-collapse source callsite. Required on kernel-convention artifacts for every batch row;
     * absence is legacy-only and must be admitted via explicit `sourceCallsiteProvenance: 'legacy-logical'`.
     */
    sourceCallsiteId?: number;
    /** Compiler-authored program point of the source row before physical batching. */
    sourceEffectOrdinal?: number;
    /** Ordered row inside this physical batch template (0..n-1, dense). */
    logicalIndex: number;
    /** Value bit for this exact logical source row, never inherited from its physical representative. */
    callValueEffect?: boolean;
    inputs: readonly AbiInput[];
    argSources?: readonly ArgSource[];
    occurrence?: 'once' | 'conditional' | 'loop';
    condition?: ExternalCallExpression;
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
  /** Explicit index-tag encoding for singleton records; absent preserves the historical count-based format. */
  taggedDataNfts?: true;
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
 * co-spends it for any call that uses the library.
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
  // count across the contract's functions (each function co-spends its own framed side-cars)
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
    resultEncoding?: ExternalResultEncoding;
    opaque: boolean;
  }[];
  resultConsumers?: readonly ExternalResultConsumerAbi[];
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
  transfers?: readonly FixedBchTransferAbi[];
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
 * Legacy message-bus batch blob limit and default for callers without an explicit published ceiling.
 *
 * The compiler compiles each route's selected bound (`require(batchBlob.length <= N)`) and republishes it as
 * `Artifact.messageBus.maximumBlobBytes`; the SDK graph generator enforces that same bound while framing
 * participant rows. Keep this shared legacy default for old/unrolled artifacts.
 *
 * This is the historical stack-item limit, not the BCH-2026 limit. Kernel routes publish and enforce the
 * active consensus profile's larger stack-item ceiling explicitly, including in their resource budgets and
 * deployability certificates. SDK encoding always follows the artifact's published maximumBlobBytes.
 */
export const MAX_MESSAGE_BUS_BLOB_BYTES = 520;

/**
 * Consensus P2SH redeem-script ceiling (BCH `maximumBytecodeLength`).
 * deployability certificate deployability certificates compare measured artifact bytecode against this limit.
 */
export const P2SH_BYTECODE_LIMIT = 10_000;

/**
 * published resource budgets: compiler-published multi-axis worst-case budgets on `messageBus.resourceBudgets`.
 * Compose authority prefers these over SDK hardcodes; kernel fails closed when absent.
 * published semantic-derivation ceiling: `maximumSemanticDerivationPasses` replaces undocumented effect-class heuristics.
 */
export interface MessageBusResourceBudgets {
  version: 1;
  maximumRows: number;
  maximumParticipants: number;
  maximumBlobBytes: number;
  maximumDynamicChunks: number;
  maximumValueContinuationChunks: number;
  maximumJournalRecords: number;
  maximumEvents: number;
  maximumTransfers: number;
  maximumReturnCarriers: number;
  maximumExternalEdges: number;
  /** Upper bound on compose semantic discovery passes (usage = mutableClaimCount + 2). */
  maximumSemanticDerivationPasses: number;
}

/**
 * deployability certificate: deployability / budget certificate published on `messageBus.deployability`.
 * Presence is always concrete: `asserted` (within P2SH) or `over-budget`.
 * Absence of the field means legacy / unstamped (the old `"not-asserted"` ambiguity).
 */
export type DeployabilityStatus = 'asserted' | 'over-budget';

export interface DeployabilityCertificate {
  version: 1;
  status: DeployabilityStatus;
  p2shBytecodeLimit: typeof P2SH_BYTECODE_LIMIT;
  measuredBytecodeBytes: number;
  withinP2shLimit: boolean;
  /** Message-bus budget axes mirrored from the artifact when known. */
  budgets?: {
    maximumRows: number;
    maximumBlobBytes: number;
    maximumParticipants?: number;
  };
}

/** Build a concrete deployability certificate from measured redeem-script bytes. */
export function buildDeployabilityCertificate(params: {
  measuredBytecodeBytes: number;
  maximumRows?: number;
  maximumBlobBytes?: number;
  maximumParticipants?: number;
}): DeployabilityCertificate {
  const withinP2shLimit = params.measuredBytecodeBytes <= P2SH_BYTECODE_LIMIT;
  return {
    version: 1,
    status: withinP2shLimit ? 'asserted' : 'over-budget',
    p2shBytecodeLimit: P2SH_BYTECODE_LIMIT,
    measuredBytecodeBytes: params.measuredBytecodeBytes,
    withinP2shLimit,
    ...(params.maximumRows !== undefined && {
      budgets: {
        maximumRows: params.maximumRows,
        maximumBlobBytes: params.maximumBlobBytes ?? MAX_MESSAGE_BUS_BLOB_BYTES,
        ...(params.maximumParticipants !== undefined
          && { maximumParticipants: params.maximumParticipants }),
      },
    }),
  };
}

/**
 * Fail closed unless the certificate is present and `asserted` (within P2SH).
 * Over-budget and missing certificates both refuse deployability claims.
 */
export function assertDeployabilityCertificate(
  certificate: DeployabilityCertificate | undefined,
): asserts certificate is DeployabilityCertificate {
  if (certificate === undefined) {
    throw new Error('deployability: certificate missing (legacy not-asserted)');
  }
  if (certificate.version !== 1) {
    throw new Error(`deployability: unsupported certificate version ${String(certificate.version)}`);
  }
  if (!certificate.withinP2shLimit || certificate.status === 'over-budget') {
    throw new Error(
      'deployability: over P2SH budget '
        + `(${certificate.measuredBytecodeBytes} > ${certificate.p2shBytecodeLimit})`,
    );
  }
  if (certificate.status !== 'asserted') {
    throw new Error(`deployability: status '${String(certificate.status)}' is not asserted`);
  }
}

/**
 * Shared wire ABI for bounded kernel entry-journal transport. Each opaque `bytes` slot contains a canonical
 * encoded bytes[] vector. A maximum-size record is 150 bytes plus its two-byte element frame, so three records
 * stay below BCH's 520-byte item ceiling while four may not. Segment membership is ordinal-based and therefore
 * remains stable when a clean record acquires a longer dirty value tail. The 99-record limit is an explicit
 * global transport/indexing ceiling across all streams, aligned as a deliberate v1 budget with the reviewed
 * one-stream access ceiling. Finalized transactions remain subject to independent BCH size and cost limits.
 */
export const KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX = '__internal__kernelJournalRecordSegment_';
export const KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT = 3;
export const KERNEL_ENTRY_JOURNAL_MAX_RECORDS = 99;
export const KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS = Math.ceil(
  KERNEL_ENTRY_JOURNAL_MAX_RECORDS / KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT,
);

/** Shared wire constants for the atomic single-transaction message bus. */
export const ATOMIC_MESSAGE_BUS_DOMAIN_HEX = '4c33425553310000';
export const ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS = 8;
// This is a wire-format bound, not an independent production policy: finalized-byte and VM preflight are the
// authoritative network admission gates. Keeping a smaller arbitrary ceiling rejects otherwise valid graphs
// before those exact checks (and makes the limit depend on how many authenticated resource rows a contract uses).
export const ATOMIC_MESSAGE_BUS_MAX_ROWS = 0xffff;

/** Build concrete published resource budgets resource budgets from route/capability ceilings. */
export function buildMessageBusResourceBudgets(params: {
  maximumRows: number;
  maximumBlobBytes?: number;
  maximumParticipants?: number;
  /** Route trailing capacity, when known — raises dyn/value ceilings. */
  trailingCapacity?: number;
}): MessageBusResourceBudgets {
  const dynCeiling = Math.max(256, params.trailingCapacity ?? 0);
  const rowCeiling = Math.max(1, params.maximumRows);
  const journalCeiling = 256;
  const eventCeiling = Math.max(rowCeiling * 4, 32);
  const transferCeiling = Math.max(rowCeiling * 4, 32);
  const returnCeiling = Math.max(rowCeiling, 8);
  const externalEdgeCeiling = 64;
  // The compose lattice may discover one mutable claim for every independently published resource axis, then
  // requires one assembly pass and one confirmation pass. Publish that aggregate worst case rather than a
  // smaller per-axis constant: a valid graph can remain within every individual budget while their sum exceeds
  // any one axis (for example, a resource-heavy graph with 315 claims and 256 journal records).
  const semanticDerivationCeiling = dynCeiling + dynCeiling + journalCeiling
    + eventCeiling + transferCeiling + returnCeiling + externalEdgeCeiling + 2;
  return {
    version: 1,
    maximumRows: rowCeiling,
    maximumParticipants: params.maximumParticipants ?? ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS,
    maximumBlobBytes: params.maximumBlobBytes ?? MAX_MESSAGE_BUS_BLOB_BYTES,
    maximumDynamicChunks: dynCeiling,
    maximumValueContinuationChunks: dynCeiling,
    maximumJournalRecords: journalCeiling,
    maximumEvents: eventCeiling,
    maximumTransfers: transferCeiling,
    maximumReturnCarriers: returnCeiling,
    maximumExternalEdges: externalEdgeCeiling,
    maximumSemanticDerivationPasses: semanticDerivationCeiling,
  };
}

/** P2SH32(OP_TRUE) used only to balance compiler-published output-only participant slots. */
export const BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX =
  'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';

/**
 * Where a compiled master's deployment-time constants sit, so deployment can fill them in place.
 *
 * A master script reserves a zero-filled push for its state category and one for its contract address; both are only
 * known once the contract exists. The offsets are authoritative and are checked before a fill, because a wrong fill
 * would overwrite live script bytes.
 */
export interface CompositionPlaceholders {
  /** Schema version, so a script and its descriptor cannot be paired across a format change. */
  version: 1;
  /** Byte offset of the 32-byte state category slot within the script. */
  categoryOffset: number;
  /** Byte offset of the 35-byte contract address slot within the script. */
  addressOffset: number;
  /**
   * Byte offset of the 32-byte slot holding the hash of the validator program, present only when the master
   * recognises a validator.
   *
   * A master that stands alone never reads it, so a contract whose entries make no external call has no such slot and
   * the field is absent. A master that can be reached through a call has to check that the validator it points at runs
   * the expected program, and the expected program's hash is only known once the validator is deployed.
   */
  templateHashOffset?: number;
}

/**
 * One push of a helper-lock sentinel in a function-split master.
 *
 * `offset` is the push opcode. The 35-byte payload starts at `offset + 1` and is still the compile-time
 * sentinel; deployment replaces that payload with the filled P2SH32 of the named helper. The name is the
 * helper's profile key, `name(types)`.
 */
export interface InternalHelperLockSlot {
  readonly name: string;
  readonly offset: number;
}

/** One external call of a framed entry, as published: the call's index and what it targets. */
export interface PublishedCallSite {
  /**
   * The call's position in the entry's own call list, which a call site's `descriptor` names. Two exclusive arms
   * share one site `callIndex` (the record they bind) but keep their own positions here.
   */
  readonly callIndex: number;
  /** The interface the call goes through, for diagnostics and callee resolution. */
  readonly interfaceName: string;
  /** The method called, whose entry the callee runs. */
  readonly functionName: string;
  /** The address called, as hex; empty when the caller's own code computes the target, which a driver reads at the
   * call site rather than from this table. */
  readonly target: string;
  /** The callee's four-byte dispatcher selector, as hex. */
  readonly selector: string;
}

/**
 * One write of a framed entry, and the segment its records are declared in.
 *
 * Exactly one identity field is set: `record` names one of the entry's own data-NFT records by its record index,
 * `collection` names the verified mapping a batch write targets, `variable` names the dynamic value whose run
 * of chunk records the write occupies, and `turns` names a mapping write a run-time loop makes once per turn.
 */
export interface PublishedWriteSegment {
  readonly record?: number;
  readonly collection?: string;
  readonly variable?: string;
  /** For a fact with `turns`, the calls a turn makes before its write, counted from the turn's first call. */
  readonly segment: number | 'last';
  /**
   * A mapping write a run-time loop makes once per turn while the loop's own body makes calls.
   *
   * Every turn makes the same `stride` calls, the first of them at the entry's call site `site`, so turn `t`'s
   * write lands in the segment `segment` past the one `site`'s `t`-th call closes: the frame position of `site`'s
   * first call, plus `t * stride + segment`. The loop's records are one run, minted in the order the turns write
   * them and the loop's teardown flushes the last, in the segment `turns * stride` past `site`'s first call; a
   * builder declares each record from the segment that mints it on, chained turn to turn. Two loops that write one
   * collection continue one run, the second's records past the first's.
   */
  readonly turns?: PublishedWriteTurns;
  /**
   * The fields of the written dynamic value's element whose prior value the write provably copies back unchanged.
   *
   * A condition that reads one of these fields is settled by the value the frame starts with, because the write
   * neither recomputes it nor changes it. A field not named here may be changed by the write, so a condition that
   * reads it is not settled by the incoming state. Absent means the write's effect on the element's fields is not
   * known, which is the broad case: every field is treated as changeable.
   */
  readonly preservedFields?: readonly string[];
  /**
   * For a data-record write, the state variable(s) whose write rebuilt that record.
   *
   * A record holds several state variables, and writing one rebuilds the whole commitment while leaving the others
   * as they were. Naming the written variable lets a condition reading another field of the same record stay
   * settled by the incoming state. Absent means the written variables are not known, which is the broad case.
   */
  readonly writtenVariables?: readonly string[];
  /**
   * For a dynamic value's run, true when the frame addresses the run in its own segment apart from the entry's
   * verified-mapping batch: a builder declares the run in that segment alone, with no batch record kept there, so the
   * run's segment and the batch's may differ. Absent means the frame reads the run past the batch's groups, so the
   * batch and the run have to share a segment.
   */
  readonly apart?: true;
}

/** Where the turns of a run-time loop that makes calls land its mapping write: see `PublishedWriteSegment.turns`. */
export interface PublishedWriteTurns {
  /** The collection the loop writes. */
  readonly collection: string;
  /** The entry slot of the loop's write, `entryAccesses[].slotIndex`. */
  readonly slot: number;
  /** The call site each turn makes its first call at, an index of the entry's published calls. */
  readonly site: number;
  /** The calls every turn makes. */
  readonly stride: number;
}

/** One run of a framed entry's effects of one kind: see `PublishedLoopEffects`. */
export interface PublishedLoopEffectRun {
  /**
   * The effects the run makes, in source order: emit indices for events, transfer indices for sends, and each
   * keccak256 call's position among the body's calls for hashes.
   */
  readonly ids: readonly number[];
  /** The loop's recurrence for a run a loop repeats once per turn; absent for a run the body makes once. */
  readonly iterationDomain?: ExternalCallIterationDomainAbi;
}

/**
 * The effects a framed entry makes once per turn of a loop, as runs of each kind in execution order.
 *
 * The body binds each such effect where it makes it: the k-th event at the k-th event output its frame lists, the
 * k-th send at the k-th send output, and the k-th hash at the k-th side-car after its own input. A builder expands
 * each run by the turns its loop's recurrence counts against the entry's own facts. A kind the entry makes no looped
 * effect of is absent, and its count is the one the entry's ABI row fixes.
 */
export interface PublishedLoopEffects {
  readonly events?: readonly PublishedLoopEffectRun[];
  readonly sends?: readonly PublishedLoopEffectRun[];
  readonly hashes?: readonly PublishedLoopEffectRun[];
}

/** One framed entry's stop sites, plus the call facts a driver resolves a callee through. */
export interface PublishedEntryStopSites {
  /** The entry's identity, `Contract.entry()`, which a `FrameRequest.functionName` matches. */
  readonly functionName: string;
  /** One record per external call, in call order. */
  readonly calls: readonly PublishedCallSite[];
  /**
   * The segment the entry's own record write is declared in, when the entry writes one.
   *
   * The records are the frame's own: a data-NFT field, a dynamic value's record, or a verified mapping's nodes. A
   * fixed number is the count of external calls the entry makes before the write; `'last'` is the last segment the
   * run opens, which is where a write every call precedes lands and where a write to a field whose bytes the record
   * only sizes lands whatever the source order. A builder declares the write's records in that one segment; absent
   * means the entry writes no record, or writes one whose segment the source does not fix.
   */
  readonly writeSegment?: number | 'last';
  /**
   * One fact per write the entry makes, each naming the segment that write's records are declared in.
   *
   * A write a record's body makes in more than one segment is closed in each of them, so such a record publishes
   * one fact per segment, in segment order: the value between two of them is the body's to compute, and a builder
   * chains the declarations rather than stating it. The fact is published whenever every write's segment is fixed,
   * so a body whose writes do not all land in one segment still tells a builder where each of them lands. An empty
   * list is an entry that writes no record of its own; absent means a write's segment is not fixed, which the
   * builder refuses by name rather than declaring its records in a guessed segment.
   */
  readonly writeSegments?: readonly PublishedWriteSegment[];
  /**
   * For each value send of the entry, in transfer order, how many external calls the entry makes before it.
   *
   * A send to a contract is a call into its `receive()` made where the send is, so its record follows those calls
   * and the calls the earlier sends to contracts made, which a builder tells from the recipients it resolves.
   * Absent means the entry makes no send, or makes one whose place among its calls the source does not fix.
   */
  readonly sendCallsBefore?: readonly number[];
  /** The effects the entry makes once per turn of a loop, when it makes any. */
  readonly loopEffects?: PublishedLoopEffects;
  /** The sites in the order the driver reaches them, validated before publication. */
  readonly sites: StopSiteMetadata;
}

/** The stop-site table a framed artifact publishes on `composition.stopSites`: one entry per served entry. */
export interface PublishedFramedStopSites {
  readonly version: 1;
  readonly entries: readonly PublishedEntryStopSites[];
}

/**
 * A body a framed master cannot serve, published on `composition.refusedEntries` (`refusedFunctions` on a direct
 * artifact).
 *
 * The entry stays in the ABI and the dispatcher, its program fails whenever it is reached, and `reason` is the fact
 * that refuses it, so a builder reports which function is unsupported rather than a failed spend.
 */
export interface PublishedRefusedEntry {
  /** The body's identity, `Contract.entry()`; the constructor's is `Contract.__construct()`. */
  readonly functionName: string;
  readonly reason: string;
}

/** A `split(n)` or `merge(n)` function a framed master serves outside its ABI. */
export interface PublishedLifecycleEntry {
  readonly name: string;
  readonly inputs: readonly AbiInput[];
  /** The parameter that counts the masters minted or retired. */
  readonly countParameter: string;
}

/** The pool resizes a framed master serves: unlocked by `<1|2> <n> <sig>`, a retired master by `<3>`. */
export interface PublishedFramedLifecycle {
  readonly split?: PublishedLifecycleEntry;
  readonly merge?: PublishedLifecycleEntry;
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
  /** A function reads the block-info oracle commitment. The update is not an entry of this contract. */
  usesBlockOracle?: boolean;
  /** Offsets of the 35-byte oracle-lock sentinel in the published bytecode. The offset is the push opcode. */
  blockOracleLockSlots?: readonly number[];
  // Same source compiled with its proxy-implementable functions in delegate mode (state writes retargeted to a
  // co-spent proxy master). Present when the contract can serve as a proxy implementation; the SDK deploys and
  // calls this variant behind a proxy, so source never needs an explicit `delegate` modifier. One level deep.
  delegateArtifact?: Artifact;
  /** Compiler-only call graph/resource summary shared by splitting, journal
   * eligibility, diagnostics, and message-bus planning. No covenant capability
   * is implied by its presence. */
  invocationAnalysis?: InvocationAnalysisArtifact;
  /**
   * Set when the artifact was compiled for a composition convention other than the direct one. The script is then a
   * master program: an entry recreates it in place, and its frame fields come from the witness block that leads its
   * unlocking bytecode. `placeholders` names the two constants only deployment can fill.
   */
  /**
   * The direct convention's refused functions: each stays in the ABI and the dispatcher, its program fails whenever it
   * is reached, and `reason` names why, as `composition.refusedEntries` does for a framed master.
   */
  refusedFunctions?: readonly PublishedRefusedEntry[];
  composition?: {
    /** The convention the artifact was compiled for. */
    convention: 'framed';
    placeholders: CompositionPlaceholders;
    /** The stop sites a builder resumes each served entry from; absent on a master compiled before the table. */
    stopSites?: PublishedFramedStopSites;
    /** The bodies the master refuses; absent when it serves every body. */
    refusedEntries?: readonly PublishedRefusedEntry[];
    /**
     * The entries that read their own balance, as `Contract.entry()`: a builder spends every container of the
     * contract for them. Absent when no entry reads it.
     */
    balanceReaders?: readonly string[];
    /** The source's pool resizes, served beside the head (spec R2b); absent when it declares none. */
    lifecycle?: PublishedFramedLifecycle;
    /**
     * Helper-lock sentinels this master pushes. Deployment replaces each payload with that helper's filled
     * lock. Absent when the master calls no cut helper.
     */
    internalHelperLocks?: readonly InternalHelperLockSlot[];
  };
  messageBus?: {
    version: 1;
    selector: '53434231';
    /** False when this artifact carries verifier capability metadata for another co-spent executable route. */
    routeInBytecode?: boolean;
    /**
     * Resolved dispatch of the published route. `kernel-row-loop` only when compiled with
     * `messageBusKernel: true` and every dispatched handler is kernel-shaped.
     */
    convention?: 'legacy-unroll' | 'kernel-row-loop';
    /** False when every handler was refused and the published route is a non-executable stub. */
    available?: boolean;
    /**
     * Admission stamp: analysis-admitted handler names stamped after speculative admission.
     * Independent of live `handlers[].eligible` mutation — dropping the compiler stamp drops this field.
     */
    admittedHandlerIds?: readonly string[];
    /** Admission stamp: analysis-refused handler names (from attribution spans when present). */
    refusedHandlerIds?: readonly string[];
    /**
     * Admission stamp provenance: how `admittedHandlerIds` was produced.
     * - `attribution-spans` — analyzer/span authority (kernel required; non-tautological vs published)
     * - `legacy-eligibility` — non-kernel path copied published eligible ids (explicit; never silent unset)
     * `published-fallback` is retired — missing span analysis fails closed on kernel.
     */
    admissionSource?: 'attribution-spans' | 'legacy-eligibility';
    minimumRows?: number;
    maximumRows: number;
    maximumBlobBytes: number;
    /**
     * Compiler-published multi-axis worst-case resource budgets.
     * Kernel compose fails closed when this field is absent.
     */
    resourceBudgets?: MessageBusResourceBudgets;
    /**
     * Concrete deployability / budget certificate.
     * Compiler stamps from measured bytecode vs `P2SH_BYTECODE_LIMIT`.
     * `asserted` = within limit; `over-budget` = measured over limit.
     * Field absence = legacy unstamped (former `"not-asserted"` ambiguity).
     */
    deployability?: DeployabilityCertificate;
    /**
     * Explicit capability schema with absence semantics for optional kernel fields.
     * Consumers must resolve via `resolveKernelCapability` / `assertKernelCapabilityStatus`
     * rather than treating field `undefined` as legacy/unsupported/inactive/incomplete.
     */
    capabilitySchema?: import('./kernel-capability-schema.js').KernelCapabilitySchema;
    /**
     * Published KernelExecutionPlan digests committed into route bytecode.
     * Each entry's `digest` must appear as a unique SCKP push/drop marker in `artifact.bytecode`.
     * Readers must gate on `kernelPlanVersion` via `assertReadableKernelExecutionPlans`.
     */
    kernelExecutionPlans?: {
      version: 1;
      plans: readonly {
        handlerId: string;
        kernelPlanVersion: number;
        digest: string;
        handlerName?: string;
      }[];
    };
    /**
     * Token-container co-layout: non-overlapping span proof for dynamic-bytes + `tokens[category]` co-layout.
     * Present when route geometry reserves `tokenContainer` slots beside trailing dyn capacity.
     */
    tokenContainerCoLayout?: import('./token-container-co-layout.js').TokenContainerCoLayoutProof;
    /** Direct chunkable whole-entry writes. Handler-local continuation pins require the aggregate `maximumRows`
     * bound, except for the explicit subset proved to settle through the shared route cache. The covenant
     * enforces the bound; SDK encoders mirror it for deterministic preflight diagnostics. */
    fixedChunkableWritePolicy?: {
      version: 1;
      maximumRows: 1;
      selectors: readonly string[];
      /** Subset whose completed lowering shares one pending value per resource across all route rows and
       * flushes only at route exit. These selectors do not consume the handler-local occurrence bound. */
      pooledSelectors?: readonly string[];
    };
    /** Compiler-published admission and message-envelope contract for atomic composition. */
    atomicMessageBus?: {
      domain: typeof ATOMIC_MESSAGE_BUS_DOMAIN_HEX;
      /** Atomic callManifest wire versions accepted by this artifact's verifier program. */
      protocolVersions?: readonly (1 | 2 | 3 | 4 | 5)[];
      /** Physical carrier for the canonical frame authenticated by every participant binder. */
      messageEnvelope: {
        region: 'participant-verifiers';
        canonicalInput: 'final-participant-verifier';
        unlockingPush: 0;
      } | {
        region: 'root-route';
        canonicalInput: 'root-participant-master';
        unlockingPush: 1;
      } | {
        region: 'proxy-forward';
        canonicalInput: 'root-proxy-master';
        unlockingPush: 1;
      };
      maximumParticipants: typeof ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS;
      maximumRows: typeof ATOMIC_MESSAGE_BUS_MAX_ROWS;
    };
    /**
     * Versioned route-local entry-journal capabilities. These describe code executed inside the participant's
     * kernel route, rather than the atomic call-manifest wire format advertised above. A consumer must treat an
     * absent capability as unsupported; in particular, a kernel convention alone never authorizes omitting a
     * physical entry input.
     */
    kernelEntryJournal?: {
      version: 1;
      /**
       * Exact completed-descriptor ownership for every admitted handler. Presence alone grants no SDK authority:
       * carrier behavior additionally requires the released route capability and authenticated local route.
       */
      kernelJournalDispositions?: KernelJournalDispositionsAbi;
      /** Digest committed by one tagged push/drop in the executable route bytecode. */
      kernelJournalDispositionCommitment?: { version: 1; digest: string };
      capabilities?: readonly {
        /** The route creates and later consumes its reserved clean-read carrier marker (0x0511). */
        kind: 'internal-read-carrier';
        /** Version of the route-local marker, first-authentication, and final-flush protocol. */
        version: 1;
        /**
         * Exact handler/access-stream pairs to which this physical protocol applies.
         * Omission is not a wildcard: consumers must fail closed rather than
         * globally deferring all runtime journal rows in the artifact.
         */
        scopes?: readonly KernelEntryJournalCapabilityScopeAbi[];
      }[];
    };
    /** Compiler-emitted OP_INVOKE program moved into genesis-deployed verifier covenants. */
    verifierProgram?: {
      verifyFunctionId: number;
      inputCount: number;
      inputs: readonly AbiInput[];
      functions: readonly { id: number; name: string; bytecode: string }[];
      /** The verifier returns an authenticated uint16 lifecycle-code suffix. */
      lifecycle?: true;
      /** @deprecated Compatibility with pre-merge split artifacts. */
      splitLifecycle?: true;
      /** The verifier reads the one canonical envelope from the root route instead of its own unlocker. */
      envelopeTransport?: 'root-route' | 'proxy-forward';
    };
    /**
     * Published resource-fold plans: published multi-row chunkable fold plans. Compose fills leading/complete witnesses via
     * `foldChunkableResource` using this plan as authority for step kind / initial source / witness names
     * (runtime still supplies ordered row elements; rediscovery is legacy fallback when this field is absent).
     */
    resourceFoldPlans?: readonly {
      collection: string;
      collectionSignature?: string;
      initialSource: 'empty' | 'prior-commitment' | 'leading-witness';
      leadingWitness?: string;
      completeWitness?: string;
      /** Transition kind for every runtime-selected step against this collection. */
      stepKind: 'push' | 'assign' | 'update';
      /**
       * path-effect activation: compiler-published per-effect fold activations (fixed-chunkable ECE).
       * SDK instantiate fills missing step activations from this schedule.
       */
      activationSchedule?: {
        version: 1;
        effects: readonly {
          effectOrdinal: number;
          activation?: ExternalCallExpression;
        }[];
      };
    }[];
    route: AbiFunction;
    handlers: {
      name: string;
      selector: string;
      inputs: AbiInput[];
      outputs?: AbiOutput[];
      /** Tuple-wide result representation produced by this exact handler. */
      resultEncoding?: ExternalResultEncoding;
      usesMsgValue?: boolean;
      emits?: readonly EmitAbi[];
      runtimeLoopEvents?: readonly RuntimeLoopEventAbi[];
      runtimeLoopTransfers?: readonly RuntimeLoopTransferAbi[];
      tokenContainerAccesses?: readonly TokenContainerAccessAbi[];
      tokenContainerTransferSites?: readonly TokenContainerTransferSiteAbi[];
      /** Per selected handler call, the visible parameter feeding keccak256 or null for a computed preimage. */
      keccakPreimageParams?: readonly (string | null)[];
      /** Explicit for every newly compiled handler, so an inactive recovery sibling is distinguishable from
       * an older artifact which did not publish handler-local compute metadata. */
      ecrecoverCompute?: boolean;
      ecrecoverArgParams?: readonly (readonly (string | null)[])[];
      /** One entry per transitive recovery call, including `false` for native/P2PKH projections. */
      ecrecoverEvmFlags?: readonly boolean[];
      computeSideCarRecipes?: ComputeSideCarRecipesAbi;
      transfers?: readonly FixedBchTransferAbi[];
      /** Exact singular delegate-forwarding frame. Topology only; an ineligible handler remains refused. */
      delegateForwarding?: DelegateForwardingAbi;
      /** Typed child-creation sites in source execution order. Presence is topology only, not admission. */
      childDeployments?: readonly ChildDeploymentSiteAbi[];
      /**
       * path-effect activation: multi-effect path-effect schedule for this handler (state writes / events / transfers /
       * child-deploy recipes with structured activations). Beyond child-deploy-only typed effect IR child-deploy-only IR.
       */
      pathEffectSchedule?: {
        version: 1;
        effects: readonly {
          ordinal: number;
          kind: string;
          resultType: string;
          activation?: string | {
            kind: string;
            name?: string;
            inputIndex?: number;
            of?: unknown;
            left?: unknown;
            right?: unknown;
          };
        }[];
      };
      /** Compiler-authored lifecycle authority. Append-v1 preserves the existing state geometry and permits
       * only a canonical fixed-field suffix in the final existing data NFT. */
      lifecycle?: { kind: 'upgrade'; layout: 'same' | 'in-place-append-v1' };
      /** Participant-local lifecycle planning metadata. Authenticated split/merge/selfdestruct handlers may
       * consume this topology; write/effect/collection-bearing lifecycle rows remain fenced from kernel admission. */
      lifecycleTopology?: {
        version: 2;
        kind: 'split' | 'merge' | 'selfdestruct';
        coordinate: 'participant';
        /** Exact transaction-wide census for the participant's minting NFT category. */
        categoryCensus: {
          tokenCategory: 'participant';
          nftCapability: 'minting';
          inputCount: { source: 'fixed'; value: number }
          | { source: 'parameter'; parameterIndex: number; addend: number };
          outputCount: { source: 'fixed'; value: number }
          | { source: 'parameter'; parameterIndex: number; addend: number };
        };
        /**
         * Fixed master+dataNft prefix beside the minting lifecycle tail.
         * `preserve` = read-bearing split/merge; `consume` = fixed-scalar selfdestruct.
         */
        resourcePrefix?: {
          dataNftCount: number;
          mode: 'preserve' | 'consume';
          nftIndices: readonly number[];
        };
        inputSpans: readonly {
          mode: 'preserve' | 'consume';
          offset: number;
          count: { source: 'fixed'; value: number }
          | { source: 'parameter'; parameterIndex: number; addend: number };
          identity: {
            lockingBytecode: 'participant';
            tokenCategory: 'participant';
            nftCapability: 'minting';
            nftCommitment: 'preserve' | 'unconstrained';
            tokenAmount: 'preserve' | 'nondecrease' | 'unconstrained';
            satoshis: 'preserve' | 'reclaim';
          };
        }[];
        outputSpans: readonly {
          mode: 'preserve' | 'create';
          offset: number;
          count: { source: 'fixed'; value: number }
          | { source: 'parameter'; parameterIndex: number; addend: number };
          identity: {
            lockingBytecode: 'participant';
            tokenCategory: 'participant';
            nftCapability: 'minting';
            nftCommitment: 'preserve' | 'empty';
            tokenAmount: 'preserve' | 'nondecrease' | 'zero';
            satoshis: 'preserve' | 'funded';
          };
        }[];
      };
      /** The selected handler's compiler-resolved call closure can execute CHECKSIG/CHECKMULTISIG. */
      usesTransactionSignature?: boolean;
      /** Transaction-signature witnesses whose hash type is covenanted by the generated route. */
      transactionSignaturePolicy?: {
        hashType: 'all';
        parameterIndices: readonly number[];
        /** Exact OP_INVOKE body covered by signatures whose check executes in an internal/private helper. */
        coveredBytecodes?: readonly { parameterIndex: number; leafIndex: number; bytecode: string }[];
      };
      eligible: boolean;
      /** Stable index of this eligible handler in the route's eligible dispatch set; witness names use it. */
      witnessOrdinal?: number;
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
        source?: 'argument' | 'msgSender' | 'expression';
        expressionLabel?: string;
        perRow?: boolean;
        /** This key and its `_row` sibling may exchange the shared/row-local physical entry for this invocation. */
        swappable?: boolean;
        /** Opaque compiler identity shared by every component of one fixed collection-key tuple. */
        entryTupleGroup?: number;
        /** Component ordinal within the complete tuple. */
        keyComponentIndex?: number;
        /** Corresponding component in the fixed alternate physical tuple lane. */
        alternateRouteInput?: string;
        /** Fixed physical key pool, selected by complete tuple identity when entryTupleGroup is present. */
        keyPool?: readonly string[];
      }[];
      /** Route entry-slot ordinals which can be consumed by this selected handler. Used by composers to leave
       * every other union-route entry coordinate as an inactive balanced slot. */
      physicalEntrySlots?: readonly number[];
      /** Fixed physical route-slot choices aligned one-to-one with the handler's direct entry accesses. */
      physicalEntrySlotAlternatives?: readonly (readonly number[])[];
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

/** Frame kinds a function shard's master head admits. */
export type FunctionSplitFrameKind = 'ROOT' | 'CALL' | 'STATIC' | 'DELEGATE' | 'INTERNAL';

/**
 * One ABI entry's master under `split: 'func'`.
 *
 * `lock` is the P2SH32 of the published redeem script. That script still holds the category and address
 * placeholders, so genesis fills them and mints the P2SH32 of the filled program. `mastersByLock` groups
 * those filled locks. The commitment is not part of either lock.
 */
export interface FunctionSplitShard {
  /** ABI selector, 8 hex characters, no `0x` prefix. Overloads of one name differ here. */
  selector: string;
  /** Source function name. Two shards may share it when they are overloads. */
  function: string;
  acceptedFrameKinds: readonly FunctionSplitFrameKind[];
  artifact: Artifact;
  /** P2SH32 of {@link artifact}'s published redeem script, hex. */
  lock: string;
  /** Whole-spend bytes the capacity check measured: redeem script plus the spend reserve. */
  wholeSpendBytes: number;
}

/**
 * A helper master cut out of an over-cap caller.
 *
 * It has no ABI row and no selector in {@link FunctionSplitBundle.abi}. Its head admits only `INTERNAL`.
 */
export interface FunctionSplitInternalCut {
  name: string;
  artifact: Artifact;
  /** P2SH32 of the helper redeem script, hex, placeholders still empty. */
  lock: string;
  wholeSpendBytes: number;
  /** Selectors of the entries whose call record names this helper. */
  callerSelectors: readonly string[];
}

/**
 * One function's loader. The script pushes that function's code hash and selector, and the lock is the
 * P2SH32 of that script. Locks differ per function. The commitment is not an input to the lock.
 */
export interface FunctionSplitLoader {
  selector: string;
  /** `hash256` of the shard redeem script, hex. */
  codeHash: string;
  /** Loader redeem script, hex. */
  script: string;
  /** P2SH32 of {@link script}, hex. */
  lock: string;
}

/**
 * A framed per-entry split. Tooling branches on `format`; this is not a size-split bundle.
 *
 * `logical` is the monolithic framed artifact of the same source, with no executed kernel route.
 * `internalCuts` is empty unless a measured caller was over the whole-spend cap and a helper was cut.
 */
export interface FunctionSplitBundle {
  format: 'solidcash-split-v2';
  algorithm: 'per-entry-v1';
  composition: 'framed';
  logicalContractName: string;
  abi: readonly AbiFunction[];
  stateLayoutFingerprint: string;
  logical: Artifact;
  shards: readonly FunctionSplitShard[];
  internalCuts: readonly FunctionSplitInternalCut[];
  loaders: readonly FunctionSplitLoader[];
  messageBus: { available: false };
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

export function formatSplitArtifactBundle(
  bundle: SplitArtifactBundle | FunctionSplitBundle, format: 'json' | 'ts',
): string {
  if (format === 'ts') {
    const normalised = JSON.parse(JSON.stringify(bundle));
    return `export default ${stringifyAsTs(normalised)} as const;\n`;
  }
  return JSON.stringify(bundle, null, 2);
}

export function formatArtifact(artifact: Artifact, format: 'json' | 'ts'): string {
  const normalisedArtifact = JSON.parse(JSON.stringify(artifact)) as Artifact;
  if (artifact.delegateProxyStateOutputCountPinned
    || normalisedArtifact.abi?.some((fn) => fn.modifiers?.includes('delegate'))) {
    normalisedArtifact.delegateProxyStateOutputCountPinned = true;
  }
  if (format === 'ts') {
    return `export default ${stringifyAsTs(normalisedArtifact)} as const;\n`;
  }

  const compact = (globalThis as { process?: { env?: Record<string, string> } }).process
    ?.env?.SOLIDC_COMPACT_ARTIFACT === '1'
    || (typeof normalisedArtifact.debug?.bytecode === 'string'
      && normalisedArtifact.debug.bytecode.length > 400_000);
  return JSON.stringify(normalisedArtifact, null, compact ? 0 : 2);
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
