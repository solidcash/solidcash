import { hexToBin, binToHex } from '@bitauth/libauth';
import {
  asmToScript,
  ArrayType,
  encodeBool,
  encodeInt,
  encodeString,
  Op,
  OpOrData,
  PrimitiveType,
  TupleType,
  Script,
  scriptToAsm,
  scriptToBytecode,
  buildDataNftCovenantScript,
  buildEntryNftCovenantScript,
  encodeNftIndexTag,
  generateSourceMap,
  FullLocationData,
  LogEntry,
  RequireStatement,
  PositionHint,
  SingleLocationData,
  StackItem,
  BytesType,
  IntType,
  FixedType,
  CompilerOptions,
  Type,
  StructType,
  computeEventNameHash,
  computeCollectionHash,
  computeCollectionSignature,
  valueChunkSignature,
  FunctionDebugInformation,
  optimiseBytecode,
  optimiseBytecodeOld,
  OPTIMISER_COMPAT_CHECK_MAX_OPS,
  AddressType,
  ValueType,
  EnumType,
  FunctionType,
  BlockLayoutSlot,
  BlockSlotKind,
  resolveLibraries,
  ExternalLibrary,
  sidecarStripOffsets,
  encodeComputedBlockhashKey,
  KECCAK256_COMPUTE_COVENANT_HASH,
  KECCAK256_COMPUTE_STATEFUL_COVENANT_HASH,
  KECCAK256_COMPUTE_STATEFUL_COVENANT,
  KECCAK256_COMPUTE_SALT_PREFIX_LENGTH,
  isChunkableValueType,
} from '@solidcash/utils';
import {
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
  BlockNode,
  TimeOpNode,
  ArrayNode,
  TupleIndexOpNode,
  RequireNode,
  SourceFileNode,
  Node,
  InstantiationNode,
  TupleAssignmentNode,
  NullaryOpNode,
  ConsoleParameterNode,
  ConsoleStatementNode,
  SliceNode,
  DoWhileNode,
  WhileNode,
  AssemblyStatementNode,
  StateAccessNode,
  StateAssignNode,
  StateVariableNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingFieldAssignNode,
  DeleteLocalNode,
  DeleteStateNode,
  MappingDeleteNode,
  EntryAccessInfo,
  TokenContainerAccessInfo,
  TokenContainerMethodStatementNode,
  AbiEncodeNode,
  AbiEncodePackedNode,
  AbiEncodeWithSelectorNode,
  AbiEncodeWithSignatureNode,
  AbiEncodeCallNode,
  BytesConcatNode,
  StringConcatNode,
  AbiDecodeNode,
  AbiDecodeAtNode,
  FieldAccessNode,
  StructDefinitionNode,
  TypeDefinitionNode,
  EventDefinitionNode,
  EmitStatementNode,
  EmitInfo,
  TransferStatementNode,
  SelfdestructStatementNode,
  TransferInfo,
  ReturnNode,
  FunctionCallStatementNode,
  ExpressionStatementNode,
  MethodCallStatementNode,
  ExpressionNode,
  ConstantDefinitionNode,
  TernaryOpNode,
  TryCatchNode,
  CatchClauseNode,
  ArrayAccessNode,
  NewArrayNode,
  ArrayPushNode,
  ArrayPopNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  ContractReferenceNode,
  ExternalStateAccessNode,
  ExternalMappingAccessNode,
  ExternalReadSlot,
  ExternalFunctionCallNode,
  ExternalCallSlot,
  ExternalCallMode,
  ExternalOutputStateNode,
  ExternalOutputStateAccessNode,
  ExternalOutStateSlot,
  MethodCallNode,
  RevertNode,
  AssertNode,
  FunctionModifier,
  AddressTransferStatementNode,
  AddressSendExpressionNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  CollectionIterationNode,
  CollectionIterationMode,
  TypeIntrospectionNode,
  UncheckedNode,
  SwitchNode,
  StateArrayPushNode,
  StateArrayPopNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { GlobalFunction, Class } from '../ast/Globals.js';
import { BinaryOperator, NullaryOperator, UnaryOperator } from '../ast/Operator.js';
import {
  compileBinaryOp,
  compileCast,
  compileGlobalFunction,
  compileNullaryOp,
  compileTimeOp,
  compileUnaryOp,
  isFixedWidthType,
  getFixedWidth,
} from './utils.js';
import { isNumericType } from '../utils.js';
import { getStackEffect } from '../asmStackEffects.js';
import {
  InvalidModifierCombinationError, MsgDataInSubroutineError, MsgSigInInternalFunctionError, EntryWriteInLoopError,
  SortedMappingCodegenPendingError,
  ChainedEntryElementReadError, ConditionalDeployError,
} from '../Errors.js';
import { analyzeInlineAssembly } from '../semantic/InlineAssemblyDiagnostics.js';

// Upper bound on the element count of a bounded array whose default value is materialized inline. A covenant
// array maps to transaction inputs/outputs, so it cannot exceed the tx input/output count (~3119 minimal outputs
// in a standard 100000-byte BCH tx). 10000 sits above that (rejects no real array) and matches the array
// safe-decode limit in @solidcash/utils (state.ts); an astronomical bound is refused rather than exhausting memory.
const MAX_MATERIALIZED_ARRAY_ELEMENTS = 10000;
// The "invalid" internal function-pointer value (Solidity's zero fn-ptr). functionIds are small sequential ints
// (from 0), so this large sentinel is never a defined id and OP_INVOKE hard-fails on it -> calling a deleted or
// uninitialized internal fn-ptr reverts, matching Solidity. See emitDefaultValue.
const INVALID_FUNCTION_POINTER_ID = 0x7fffffffn;

// Locking bytecode template fragments - correspond to libauth's
// encodeLockingBytecodeP2pkh / P2sh20 / P2sh32 but used as partial
// templates that get concatenated with dynamic hashes on the VM stack.
const P2PKH_LBC_PREFIX = hexToBin('76a914'); // OP_DUP OP_HASH160 OP_PUSHBYTES_20
const P2PKH_LBC_SUFFIX = hexToBin('88ac');   // OP_EQUALVERIFY OP_CHECKSIG
const P2SH20_LBC_PREFIX = hexToBin('a914');  // OP_HASH160 OP_PUSHBYTES_20
const P2SH20_LBC_SUFFIX = hexToBin('87');    // OP_EQUAL
const P2SH32_LBC_PREFIX = hexToBin('aa20');  // OP_HASH256 OP_PUSHBYTES_32
const P2SH32_LBC_SUFFIX = hexToBin('87');    // OP_EQUAL

/** Split a byte array on each occurrence of `delim`, returning the pieces between/around delimiters. */
function splitOnDelimiter(bytes: Uint8Array, delim: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  let start = 0;
  let i = 0;
  while (i + delim.length <= bytes.length) {
    let match = true;
    for (let j = 0; j < delim.length; j++) {
      if (bytes[i + j] !== delim[j]) { match = false; break; }
    }
    if (match) {
      out.push(bytes.slice(start, i));
      i += delim.length;
      start = i;
    } else {
      i++;
    }
  }
  out.push(bytes.slice(start));
  return out;
}

// Count `new C(...)` deploy sites in a function body (each mints a child genesis). Mirrors
// SymbolTableTraversal.countDeploySites so the codegen guard for conditional deploys agrees with the
// block-layout slot reservation. Skips the referencedContract back-reference (the whole child AST).
function countInstantiationDeploySites(body: Node | undefined): number {
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

// Survey a function's deploy sites: how many, whether any is CONDITIONAL (inside a branch/switch/loop), and the
// set of distinct child contract names. Drives the multi-site inline-deploy decision: 2+ sites with a
// conditional one need a FUNCTION-LEVEL runtime deploy counter, and (for the SDK to derive N children of one
// type + a uniform counter*stride) they must all deploy the SAME contract.
function surveyFunctionDeploys(
  body: Node | undefined,
): { count: number; hasConditional: boolean; contractNames: Set<string> } {
  const contractNames = new Set<string>();
  let count = 0;
  let hasConditional = false;
  if (!body) return { count, hasConditional, contractNames };
  const seen = new WeakSet<object>();
  const walk = (n: unknown, inCond: boolean): void => {
    if (Array.isArray(n)) { for (const it of n) walk(it, inCond); return; }
    if (!(n instanceof Node) || seen.has(n)) return;
    seen.add(n);
    if (n instanceof InstantiationNode && n.referencedContract) {
      count += 1;
      contractNames.add(n.referencedContract.name);
      if (inCond) hasConditional = true;
    }
    // for-loops desugar to while before codegen, so ForNode never appears here.
    const childCond = inCond
      || n instanceof BranchNode || n instanceof SwitchNode
      || n instanceof WhileNode || n instanceof DoWhileNode;
    for (const [key, value] of Object.entries(n)) {
      if (key === 'referencedContract' || key === 'definition' || key === 'symbolTable') continue;
      walk(value, childCond);
    }
  };
  walk(body, false);
  return { count, hasConditional, contractNames };
}

class MsgDataUsageCollector extends AstTraversal {
  found = false;

  visitNullaryOp(node: NullaryOpNode): Node {
    if (node.operator === NullaryOperator.MSG_DATA) {
      this.found = true;
    }
    return node;
  }
}

class NftIndexCollector extends AstTraversal {
  indices = new Set<number>();

  visitStateAccess(node: StateAccessNode): Node {
    if (node.stateVariable) this.indices.add(node.stateVariable.nftIndex);
    return node;
  }

  visitStateAssign(node: StateAssignNode): Node {
    if (node.stateVariable) this.indices.add(node.stateVariable.nftIndex);
    node.expression = this.visit(node.expression);
    return node;
  }

  visitDeleteState(node: DeleteStateNode): Node {
    if (node.stateVariable) this.indices.add(node.stateVariable.nftIndex);
    return node;
  }

  visitStateArrayPush(node: StateArrayPushNode): Node {
    if (node.stateVariable) this.indices.add(node.stateVariable.nftIndex);
    node.value = this.visit(node.value);
    return node;
  }

  visitStateArrayPop(node: StateArrayPopNode): Node {
    if (node.stateVariable) this.indices.add(node.stateVariable.nftIndex);
    return node;
  }

  visitStateArrayAssign(node: StateArrayAssignNode): Node {
    if (node.stateVariable) this.indices.add(node.stateVariable.nftIndex);
    node.index = this.visit(node.index);
    node.value = this.visit(node.value);
    return node;
  }

  visitStateArrayDelete(node: StateArrayDeleteNode): Node {
    if (node.stateVariable) this.indices.add(node.stateVariable.nftIndex);
    node.index = this.visit(node.index);
    return node;
  }

  visitMappingAccess(node: MappingAccessNode): Node {
    if (node.isPackedStateArrayAccess && node.packedStateVariable) {
      this.indices.add(node.packedStateVariable.nftIndex);
    }
    return super.visitMappingAccess(node);
  }
}

export default class GenerateTargetTraversalWithLocation extends AstTraversal {
  private locationData: FullLocationData = []; // detailed location data needed for sourcemap creation
  sourceMap: string;
  output: Script = [];
  stack: string[] = [];
  consoleLogs: LogEntry[] = [];
  requires: RequireStatement[] = [];
  finalStackUsage: Record<string, StackItem> = {};

  private scopeDepth = 0;
  private currentFunction: FunctionDefinitionNode;
  private constructorParameterCount: number;
  private contractUsesMsgData: boolean = false;
  // Compiler-internal subroutine registry, keyed by 2-byte id. `defined` is inherited into
  // sub-traversals; `useCount` is propagated back up.
  private subroutineDefined = new Map<bigint, boolean>();
  private subroutineUseCount = new Map<bigint, number>();

  // 2-byte subroutine IDs from 0x1000: disjoint by length from user function IDs (small ints)
  // and 4-byte selectors, so the dispatcher's 4-byte selector check keeps them unreachable.
  private static readonly INT_DECODE_SUBROUTINE_ID = 0x1000n;
  private static readonly PUSHDATA_FRAME_SUBROUTINE_ID = 0x1001n;
  private static readonly INT_ENCODE_SUBROUTINE_ID = 0x1002n;
  private static readonly MASTER_SELF_PRES_SUBROUTINE_ID = 0x1003n;
  private static readonly MINT_UNIQUENESS_SUBROUTINE_ID = 0x1004n;
  private static readonly MASTER_VALUE_PRES_SUBROUTINE_ID = 0x1005n;
  private static readonly CAT_BASE_EQ_MASTER_SUBROUTINE_ID = 0x1006n;
  private static readonly SATOSHI_LBC_SUBROUTINE_ID = 0x1007n;
  private static readonly TOKEN_LBC_SUBROUTINE_ID = 0x1008n;
  private static readonly ALL_SUBROUTINE_IDS =
    [0x1000n, 0x1001n, 0x1002n, 0x1003n, 0x1004n, 0x1005n, 0x1006n, 0x1007n, 0x1008n];

  // State-related tracking
  private stateVariables: StateVariableNode[] = [];
  private collectionCount: number = 0;
  private sortedCollections: Set<string> = new Set(); // C2 sorted (linked-list) collection names
  private sortedWrittenCollections: Set<string> = new Set(); // sorted collections written in the current function
  private dataNftCount: number = 0;
  private pendingStateWrites: Map<string, string> = new Map(); // "nftIndex:fieldIndex" -> stack name
  private hasStateAccess: boolean = false;
  private compactOffsetMap: Map<number, number> = new Map(); // nftIndex -> compact position (1-based)

  // Entry NFT tracking (mappings)
  private entrySlots: EntryAccessInfo[] = [];
  private pendingEntryWrites: Map<number, { keyStackName: string; valueStackName: string }> = new Map();
  private pendingEntryDeletes: Set<number> = new Set();
  // Depth of plain counting loops (while / do-while / for) currently being emitted. A mapping WRITE inside such
  // a loop is unsound: the entry-write model reserves ONE output slot per (mapping, key-descriptor), so a loop
  // that writes distinct runtime keys keeps only the LAST entry (silent data loss), and a read-modify-write
  // reads the stale input. Only an invariant-key write would be sound (last-write-wins), which is pointless in
  // a loop, so any mapping write here is rejected (fail closed). Collection iteration is a distinct node.
  private plainLoopDepth = 0;

  // Dynamic-storage writes (string / unbounded bytes): the value is kept on the stack until the
  // epilogue, where the chunk write loop (split + verify trailing chunk outputs) is emitted.
  private pendingDynamicWrites: Map<string, { valueStackName: string; sv: StateVariableNode }> = new Map();

  // Dynamic-write RMW value stack names (`__internal__dynwrite_value_<name>`) that emitDynamicWriteVerification
  // must KEEP on the stack (not drop) because a later array-external-call co-spend reads the array from it
  // (`poolInfo[i].lpToken.m()` in a loop that also writes poolInfo); dropped after that co-spend loop.
  private coSpendPreservedDynValues: Set<string> = new Set();

  // External read tracking
  private externalReadSlots: ExternalReadSlot[] = [];

  // External call tracking
  private externalCallSlots: ExternalCallSlot[] = [];

  // External outState tracking
  private externalOutStateSlots: ExternalOutStateSlot[] = [];

  // Transfer tracking
  private transferInfos: TransferInfo[] = [];
  private pendingTransfers: { transferIndex: number; lockingBytecodeStackName: string; amountStackName: string }[] = [];

  // Token container tracking
  private tokenContainerSlots: TokenContainerAccessInfo[] = [];
  private pendingTokenContainerTransfers: {
    transferIndex: number;
    tokenContainerSlotIndex: number;
    method: 'transfer' | 'transferNft';
    argStackNames: string[];
  }[] = [];

  private tokenContainerTransferCounter: number = 0;

  // Event tracking
  private eventDefinitions: EventDefinitionNode[] = [];
  private emitInfos: EmitInfo[] = [];
  private pendingEmits: { emitIndex: number; stackName: string; eventDef: EventDefinitionNode }[] = [];

  // Deploy tracking (stateful contract deployment)
  private pendingDeploys: {
    deployIndex: number;
    masterLbcStackName: string;
    categoryStackName: string;
    node: InstantiationNode;
  }[] = [];

  private deployCounter: number = 0;

  // Inline (conditional) deploy verification. A `new C()` inside a branch cannot use the fixed block-layout
  // deploy slot the way the epilogue does: when the branch is NOT taken there is no genesis output, and the
  // master-LBC/category the epilogue reads are never pushed (they live only on the taken path). So a branch
  // deploy is verified INLINE at the creation site instead - the checks run exactly when `new C()` runs. A
  // single conditional deploy lands at the same fixed slot as an unconditional one when it fires (deploy is
  // the trailing output region), so no runtime counter is needed yet. Straight-line deploys (scopeDepth 0)
  // keep the proven fixed epilogue (emitDeployCovenantVerification) untouched. Loop/variable-count deploys
  // (a runtime deploy counter) are a follow-up and still hit ConditionalDeployError.
  private functionDeploySiteCount: number = 0;      // count of `new C()` deploy sites in the current function
  private inlineDeployCounterName: string = '__deploy_counter'; // runtime deploys-fired-so-far (loop deploys)
  private inlineDeployActive: boolean = false;      // a loop/function deploy counter is live on the stack
  private entryLoopCounterName: string = '(loop_entry_counter)'; // entries-written-so-far (loop mapping write)
  private entryLoopAddrName: string = '(loop_entry_addr)';       // loop-invariant entry NFT P2SH32 (precomputed)
  private entryLoopActive: boolean = false;         // a loop mapping-write counter + address are live on the stack
  private sortedInsertLoopAddrName: string = '(sorted_insert_addr)';    // loop-invariant sorted entry NFT P2SH32
  private sortedInsertLoopCounterName: string = '(sorted_insert_counter)'; // chain nodes verified so far
  private sortedInsertLoopOldnextName: string = '(sorted_insert_oldnext)'; // range-splice: P.oldNext (chain terminus)
  private sortedInsertLoopExpectedName: string = '(sorted_insert_expected)'; // range-splice: next chain node's slot
  private sortedInsertLoopActive: boolean = false;  // a sorted diff-key insert loop's addr + counter are on the stack
  private sortedInsertLoopCollection: string | null = null; // the sorted collection the active insert loop writes
  // Per-iteration C2 UPDATE loop `for(i) m[k[i]] += v[i]` (multitransfer credit, EXISTING recipients): each iteration
  // co-spends k[i]'s OWN entry at input[master+blockSize+counter], verifies its slot == keyToSlot(k[i]), and mints the
  // updated entry at output[master+blockSize+counter] = slot|next|(oldValue OP v[i]). 1:1 co-spend/mint, no permutation
  // (source order = counter order), supply conserved via the shared v[] param.
  private sortedUpsertLoopAddrName: string = '(sorted_upsert_addr)';
  private sortedUpsertLoopCounterName: string = '(sorted_upsert_counter)';   // co-spends done (one input per recipient)
  private sortedUpsertLoopOutCounterName: string = '(sorted_upsert_outctr)'; // cumulative mints (update +1, insert +2)
  private sortedUpsertLoopActive: boolean = false;
  private sortedUpsertLoopCollection: string | null = null;
  private sortedUpsertLoopOp: '+' | '-' | 'set' | 'delete' = '+'; // set=absolute m[k[i]]=v[i]; delete=nullify; +/- = RMW
  // MSG.SENDER MERGE (batch-upsert a-real): a new recipient whose bracketing predecessor is the DEBITED msg.sender.
  // On the merge iteration the credit loop records the new recipient's slot here (mints only the NEW node, no trailing
  // co-spend); the debit flush (emitSortedValueUpsert, runs AFTER the loop) reads it and re-points msg.sender.nextKey.
  private sortedUpsertLoopRepointName: string = '(sorted_upsert_repoint)';
  private sortedUpsertMergeDebitSlot: number = -1; // the debit entry's FIXED block slot index (-1 = no merge possible)
  private sortedUpsertPendingRepoint: boolean = false; // a merge-capable upsert loop left a re-point register on the stack
  // CASE (b) PENDING-DEFER: a new recipient whose bracketing predecessor is ANOTHER credited recipient (not the debit).
  // Each UPDATE iteration co-spends its entry but DEFERS the mint into these registers; the NEXT iteration flushes them,
  // re-pointing the pending entry to the current key iff it lands in the pending's gap (proving it a new node right
  // after the pending). Look-behind, so no cross-index read. The teardown flushes any entry left pending.
  private sortedUpsertPendSlotName: string = '(pu_slot)'; // deferred entry slot (empty b'' = no pending)
  private sortedUpsertPendValName: string = '(pu_val)';   // deferred entry new value
  private sortedUpsertPendNextName: string = '(pu_next)'; // deferred entry nextKey (empty b'' = +inf)
  private sortedUpsertPendActive: boolean = false;        // the pending-defer registers are live on the stack
  private keccakLoopCounterName: string = '(loop_keccak_counter)'; // keccak side-cars read-so-far (dynamic keccak loop)
  private keccakLoopActive: boolean = false;        // a dynamic keccak256 loop counter is live on the stack
  private functionMultiSiteDeploy: boolean = false; // 2+ same-contract sites w/ a conditional: function counter
  // A loop `new C{value:V}()` interleaves its transfer per child; the satoshi container that sources them is
  // conserved (input <= output + counter*V) after the loop's OP_UNTIL. V must be loop-invariant (typically a
  // literal). Stashed by emitInlineDeployVerification, consumed + cleared by the loop visitor.
  private loopValueTransferNode: ExpressionNode | undefined = undefined;

  // User-defined function tracking (for OP_INVOKE)
  private userFunctionDefs: Map<string, FunctionDefinitionNode> = new Map();
  private isDefineSubTraversal: boolean = false;
  // True when the current function has a `return` nested inside a loop (the raw-return stack cleanup can't
  // handle that, so its internal-call subroutine keeps the event-blob return path - see visitReturn).
  private functionHasReturnInLoop: boolean = false;

  // Branch pre-allocation tracking
  private preAllocatedStateWrites: Set<string> = new Set(); // "nftIndex:fieldIndex"
  private preAllocatedTransfers: Set<number> = new Set();   // transferIndex
  private preAllocatedEmits: Set<number> = new Set();       // emitIndex
  private preAllocatedTokenContainerTransfers: Set<number> = new Set(); // transferIndex
  private preAllocatedEntryWrites: Set<number> = new Set(); // slotIndex
  private preAllocatedEntryDeletes: Set<number> = new Set(); // slotIndex
  // Conditional (branch/switch) delete slots lowered to an existence-gated SOFT-DELETE WRITE: the entry keeps an
  // output (stable count) that is the type default on the taken branch or the preserved input otherwise. Tracked
  // so emitEntryCovenantVerification existence-gates them and the artifact tags them for the SDK (write, not delete).
  private condDeleteSlots: Set<number> = new Set();
  // Dynamic (chunk-backed) writes whose value+A$len slots were pushed before a conditional (branch/switch) with
  // the current value, so a conditionally-taken write replaces them in place (survives the branch) - by var name.
  private preAllocatedDynamicWrites: Set<string> = new Set();

  // Nesting depth of branches whose transfers are already pre-allocated: a branch nested inside another branch's
  // arm must NOT re-pre-allocate transfer slots (the enclosing branch's max-path transferCount already covers its
  // mutually-exclusive transfers, which share slots via the semantic index). Only the outermost branch (depth 0)
  // pre-allocates; nested ones reuse those slots. Without this a nested/else-if transfer over-allocates a slot that
  // is pushed conditionally and then missing at the epilogue ("__internal__transfer_lb_N does not exist").
  private transferPreallocDepth: number = 0;

  // Conditional transfer/emit/tcTransfer indices (only active in one branch)
  private conditionalTransferIndices: Set<number> = new Set();
  private conditionalEmitIndices: Set<number> = new Set();
  private conditionalTokenContainerTransferIndices: Set<number> = new Set();

  // Low-level call tracking
  private lowLevelCallCount: number = 0;

  // Delegatecall tracking
  private functionHasDelegatecall: boolean = false;
  private currentFunctionIsDelegate: boolean = false;
  // True while generating a branded delegate library: the delegate master-validation pins the co-spent proxy
  // master's category to the library's `__brand` ctor arg (docs/library-contracts.md 3b contention).
  private currentContractIsBrandedLibrary: boolean = false;
  // True when the contract reads blockhash(n): forces it stateful (the oracle is branded to its own category).
  private currentContractUsesBlockhash: boolean = false;
  private currentContractEmitsEvent: boolean = false;

  // Unchecked block depth: when > 0, bounds checks emit wrapping instead of OP_VERIFY
  private uncheckedDepth: number = 0;

  // Constant expression map for inline substitution
  private constantExpressions: Map<string, ExpressionNode> = new Map();

  compiledBytecodes: Map<string, Uint8Array> = new Map();
  entryPointDebugInfo: Map<string, FunctionDebugInformation> = new Map();  // selector hex -> debug info
  entryPointBytecodes: Map<string, Uint8Array> = new Map(); // selector hex -> raw function body bytecode

  private resolvedLibraries: Record<string, ExternalLibrary>;

  constructor(private compilerOptions: CompilerOptions) {
    super();
    this.resolvedLibraries = resolveLibraries(compilerOptions.userLibraries);
  }

  private emit(op: OpOrData | OpOrData[], locationData: SingleLocationData): void {
    if (Array.isArray(op)) {
      op.forEach((element) => this.output.push(element as Op));
      op.forEach(() => this.locationData.push(locationData));
    } else {
      this.output.push(op);
      this.locationData.push(locationData);
    }
  }

  private pushToStack(value: string, pushToBottom?: boolean): void {
    if (pushToBottom) {
      this.stack.push(value);
    } else {
      this.stack.unshift(value);
    }
  }

  private popFromStack(count: number = 1): void {
    for (let i = 0; i < count; i += 1) {
      this.stack.shift();
    }
  }

  private removeFromStack(i: number): void {
    this.stack.splice(i, 1);
  }

  private nipFromStack(): void {
    this.stack.splice(1, 1);
  }

  private getStackIndex(value: string, canBeUndefined?: boolean): number {
    const index = this.stack.indexOf(value);

    if (index === -1 && !canBeUndefined) {
      throw new Error(`Expected variable '${value}' does not exist on the stack`);
    }

    return index;
  }

  /**
   * Get the compile-time offset for a block layout slot.
   */
  private getBlockSlotOffset(kind: BlockSlotKind, slotIndex?: number): number {
    const layout = this.currentFunction.blockLayout;
    if (!layout) throw new Error('Block layout not available');
    const slot = layout.slots.find(
      (s) => s.kind === kind && (slotIndex === undefined || s.slotIndex === slotIndex),
    );
    if (!slot) throw new Error(`Block slot not found: ${kind}${slotIndex !== undefined ? `[${slotIndex}]` : ''}`);
    return slot.offset;
  }

  /**
   * Emit opcodes to push a block slot's absolute index onto the stack.
   * Pushes 1 untracked value. Replaces the old base + offset + OP_PICK pattern.
   */
  private emitBlockSlotIndex(
    kind: BlockSlotKind, slotIndex: number | undefined, locationData: SingleLocationData,
  ): void {
    // Stateless contract (no block layout): a transfer output sits at the absolute index transferIndex in
    // [0, N) - there is no input-index-relative block to offset from.
    if (!this.currentFunction.blockLayout && kind === 'transfer') {
      this.emit(encodeInt(BigInt(slotIndex ?? 0)), locationData);
      return;
    }
    let offset = this.getBlockSlotOffset(kind, slotIndex);
    // The 'deploy' slot is read as an INPUT index (the child genesis funding input). Output-only slots
    // (transfer/tcTransfer/event/returnEvent) each take a block-layout offset but consume NO input, so they
    // must be excluded from an input-relative offset - otherwise the funding input is read one-too-high per
    // preceding output-only slot (e.g. a value-RETURNING deploy function has a returnEvent output before it).
    if (kind === 'deploy') offset -= this.countOutputOnlySlotsBefore(offset);
    this.emitMasterInputIndex(locationData);
    if (offset > 0) {
      this.emit(encodeInt(BigInt(offset)), locationData);
      this.emit(Op.OP_ADD, locationData);
    }
  }

  /** Count output-only block-layout slots (they consume no input) strictly before `offset`. */
  private countOutputOnlySlotsBefore(offset: number): number {
    const layout = this.currentFunction.blockLayout;
    if (!layout) return 0;
    const outputOnly = new Set<BlockSlotKind>(['transfer', 'tcTransfer', 'event', 'returnEvent']);
    return layout.slots.filter((s) => outputOnly.has(s.kind) && s.offset < offset).length;
  }

  /**
   * Compute the compile-time offset where external call groups start.
   * This is after A's own slots + readOnly + outState reserved space.
   */
  private getExternalCallBaseOffset(): number {
    let base = 1 + this.compactOffsetMap.size + this.externalReadSlots.length;
    for (const os of this.externalOutStateSlots) {
      if (os.sharedWithCallSlotIndex !== undefined) continue;
      base += 1 + os.requiredDataNftIndices.length;
    }
    return base;
  }

  /**
   * Emit opcodes to push the external call group's master input index.
   * Uses runtime _externalCallInputBase param because call direction (forward/backward)
   * is unknown at compile time - the callee could be before or after the caller.
   * Pushes 1 untracked value.
   */
  private emitExternalCallMasterIndex(
    computedOffset: number, locationData: SingleLocationData,
  ): void {
    const stackIdx = this.getStackIndex('__internal__externalCallInputBase');
    this.emit(encodeInt(BigInt(stackIdx)), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(encodeInt(BigInt(computedOffset)), locationData);
    this.emit(Op.OP_ADD, locationData);
  }

  /**
   * Push a slot's callee master input index. Prefers the SDK-filled per-slot runtime index param
   * (`__internal__extcallMasterIdx<slotIndex>`, present for fn-ptr calls + every slot of a multi-call
   * function) so the covenant reads the RIGHT co-spent callee even when a prior callee's data-NFT count
   * (from an under-declared interface) shifted the fixed block offset. Falls back to the compile-time
   * `externalCallInputBase + computedOffset` for single-call slots without the param. `untrackedOffset`
   * accounts for values already pushed on the real stack above the tracked stack. Pushes 1 untracked value.
   */
  private emitSlotMasterIndex(
    slot: ExternalCallSlot, locationData: SingleLocationData, untrackedOffset = 0,
  ): void {
    const idxStack = this.getStackIndex(`__internal__extcallMasterIdx${slot.slotIndex}`, true);
    if (idxStack >= 0) {
      this.emit(encodeInt(BigInt(idxStack + untrackedOffset)), locationData);
      this.emit(Op.OP_PICK, locationData);
      return;
    }
    const baseIdx = this.getStackIndex('__internal__externalCallInputBase');
    this.emit(encodeInt(BigInt(baseIdx + untrackedOffset)), locationData);
    this.emit(Op.OP_PICK, locationData);
    if (slot.computedOffset > 0) {
      this.emit(encodeInt(BigInt(slot.computedOffset)), locationData);
      this.emit(Op.OP_ADD, locationData);
    }
  }

  /** Emit introspection-based existence check for an entry or TC slot. Pushes 1 value (0 or 1). */
  private emitSlotExistsCheck(
    kind: BlockSlotKind, slotIndex: number, locationData: SingleLocationData,
  ): void {
    this.emitBlockSlotIndex(kind, slotIndex, locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.emit(Op.OP_SIZE, locationData);
    this.emit(Op.OP_NIP, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_GREATERTHAN, locationData);
  }

  private getMostRecentInstructionPointer(): number {
    // instruction pointer is the count of emitted opcodes + number of constructor data pushes (minus 1 for 0-indexing)
    return this.output.length + this.constructorParameterCount - 1;
  }

  visitSourceFile(node: SourceFileNode): Node {
    // Register file-level constants for inline substitution
    for (const cd of node.constantDefinitions) {
      this.constantExpressions.set(cd.name, cd.expression);
    }

    // Register free functions in userFunctionDefs map
    for (const f of node.freeFunctions) {
      this.userFunctionDefs.set(f.name, f);
    }

    // Emit OP_DEFINE for each free function
    for (const f of node.freeFunctions) {
      this.emitFunctionDefine(f);
    }

    node.contract = this.visit(node.contract) as ContractNode;

    // Minimally encode output by going Script -> ASM -> Script
    this.output = asmToScript(scriptToAsm(this.output));

    this.sourceMap = generateSourceMap(this.locationData);

    return node;
  }

  visitContract(node: ContractNode): Node {
    this.currentContractIsBrandedLibrary = node.isBrandedLibrary;
    this.currentContractUsesBlockhash = node.usesBlockhash;
    this.currentContractEmitsEvent = node.emitsEvent;
    node.parameters = this.visitList(node.parameters) as ParameterNode[];

    // Register contract-level constants for inline substitution
    for (const cd of node.constantDefinitions) {
      this.constantExpressions.set(cd.name, cd.expression);
    }

    // Store state variable info for code generation
    this.stateVariables = node.stateVariables;
    this.collectionCount = node.collections.length;
    // C2 sorted collections: a WRITE slot on one is handled inline (predecessor -> P' + minted NEW), so the
    // standard read-only preservation / satoshi epilogue must skip it (its output is not the co-spent input).
    this.sortedCollections = new Set(node.collections.filter((c) => c.sorted).map((c) => c.name));
    this.dataNftCount = node.stateVariables.length > 0
      ? Math.max(...node.stateVariables.map((sv) => sv.nftIndex)) + 1
      : 0;
    this.eventDefinitions = node.eventDefinitions;

    // Keep track of constructor parameter count for instructor pointer calculation
    this.constructorParameterCount = node.parameters.length;

    // Build a map of user-defined functions for OP_INVOKE
    for (const f of node.functions) {
      this.userFunctionDefs.set(f.name, f);
    }

    // Detect whether any function uses msg.data - if so, emit _redeemPushSize
    // computation at contract level (before OP_DEFINE) where OP_ACTIVEBYTECODE
    // still returns the full contract script.
    const msgDataCollector = new MsgDataUsageCollector();
    const allNodeFunctions = [
      ...node.functions,
      ...(node.constructorDef ? [node.constructorDef] : []),
      ...(node.fallbackDef ? [node.fallbackDef] : []),
      ...(node.receiveDef ? [node.receiveDef] : []),
    ];
    for (const f of allNodeFunctions) {
      msgDataCollector.visit(f);
      if (msgDataCollector.found) break;
    }
    this.contractUsesMsgData = msgDataCollector.found;

    // Also set contractUsesMsgData if fallback has a bytes parameter
    if (node.fallbackDef && node.fallbackDef.parameters.length > 0) {
      this.contractUsesMsgData = true;
    }

    if (this.contractUsesMsgData) {
      const loc: SingleLocationData = { location: node.location, positionHint: PositionHint.START };
      this.emitRedeemPushSizeComputation(loc);
      this.pushToStack('__internal__redeemPushSize');
    }

    // Inline (<=1 use) vs shared OP_DEFINE subroutine (>=2 uses) per registered subroutine,
    // chosen by a usage-count probe. Defines must precede the bodies that invoke them.
    const DECODE = GenerateTargetTraversalWithLocation.INT_DECODE_SUBROUTINE_ID;
    const FRAME = GenerateTargetTraversalWithLocation.PUSHDATA_FRAME_SUBROUTINE_ID;
    const INTENC = GenerateTargetTraversalWithLocation.INT_ENCODE_SUBROUTINE_ID;
    const loc: SingleLocationData = { location: node.location, positionHint: PositionHint.START };
    const probe = this.subroutineUseProbe(node);
    const count = (id: bigint): number => probe?.get(id) ?? 0;

    const defineIntEncode = count(INTENC) >= 2;
    // When int-encode is its own subroutine it absorbs its per-site frame, leaving only
    // bytes-branch frames for the shared frame routine.
    const frameUses = defineIntEncode ? count(FRAME) - count(INTENC) : count(FRAME);

    // Emit OP_DEFINEs before bodies, recording spans for the dead-DEFINE splice.
    const spans: Array<{ id: bigint; span: { start: number; end: number } }> = [];
    if (count(DECODE) >= 2) {
      spans.push({ id: DECODE, span: this.emitWithSpan(() => this.emitIntDecodeSubroutine(node)) });
    }
    if (frameUses >= 2) {
      spans.push({ id: FRAME, span: this.defineCapturedSubroutine(FRAME, (t) => t.emitStandardPushdataFrame(loc), loc) });
    }
    if (defineIntEncode) {
      spans.push({
        id: INTENC,
        span: this.defineCapturedSubroutine(INTENC, (t) => t.emitGenericPushdataEncode(PrimitiveType.BIGINT, loc), loc),
      });
    }
    // Master self-preservation and minting uniqueness (non-delegate); capture needs a function node.
    const MSP = GenerateTargetTraversalWithLocation.MASTER_SELF_PRES_SUBROUTINE_ID;
    const MUNIQ = GenerateTargetTraversalWithLocation.MINT_UNIQUENESS_SUBROUTINE_ID;
    const captureFn = node.functions.find((f) => f.body !== undefined);
    if (captureFn && count(MSP) >= 2) {
      spans.push({ id: MSP, span: this.defineCapturedSubroutine(MSP, (t) => t.emitMasterSelfPreservation(captureFn), loc) });
    }
    if (captureFn && count(MUNIQ) >= 2) {
      spans.push({
        id: MUNIQ,
        span: this.defineCapturedSubroutine(MUNIQ, (t) => t.emitMintingNftUniqueness(captureFn), loc),
      });
    }
    const MVAL = GenerateTargetTraversalWithLocation.MASTER_VALUE_PRES_SUBROUTINE_ID;
    if (count(MVAL) >= 2) {
      spans.push({ id: MVAL, span: this.defineCapturedSubroutine(MVAL, (t) => t.emitMasterValuePreservation(loc), loc) });
    }
    const CATEQ = GenerateTargetTraversalWithLocation.CAT_BASE_EQ_MASTER_SUBROUTINE_ID;
    if (count(CATEQ) >= 2) {
      spans.push({ id: CATEQ, span: this.defineCapturedSubroutine(CATEQ, (t) => t.emitVerifyCatBaseEqMaster(loc), loc) });
    }
    const SATLBC = GenerateTargetTraversalWithLocation.SATOSHI_LBC_SUBROUTINE_ID;
    if (count(SATLBC) >= 2) {
      spans.push({ id: SATLBC, span: this.defineCapturedSubroutine(SATLBC, (t) => t.emitSatoshiContainerLbc(loc), loc) });
    }
    const TOKLBC = GenerateTargetTraversalWithLocation.TOKEN_LBC_SUBROUTINE_ID;
    if (count(TOKLBC) >= 2) {
      spans.push({ id: TOKLBC, span: this.defineCapturedSubroutine(TOKLBC, (t) => t.emitTokenContainerLbc(loc), loc) });
    }

    this.subroutineUseCount = new Map();
    this.emitFunctionDefinesAndDispatch(node);

    // Splice dead DEFINEs (over-estimate). Later-emitted first, so earlier spans stay valid.
    for (let i = spans.length - 1; i >= 0; i -= 1) {
      if ((this.subroutineUseCount.get(spans[i].id) ?? 0) === 0) this.spliceRange(spans[i].span);
    }

    return node;
  }

  // Collect functionIds targeted by an internal call (a FunctionCallNode with a resolved contract-function
  // target). A public function only needs its internal-subroutine OP_DEFINE when it is actually invoked
  // internally; otherwise it compiles as an entry point only (like external) - so a constructor-param-using
  // entry point is not forced through the param-less subroutine path.
  private collectInvokedFunctionIds(
    node: Node, ids: Set<number> = new Set(), visited: Set<Node> = new Set(),
  ): Set<number> {
    if (visited.has(node)) return ids;
    visited.add(node);
    if (node instanceof FunctionCallNode && node.resolvedFunction?.functionId !== undefined) {
      ids.add(node.resolvedFunction.functionId);
    }
    // A function used as a value (function pointer / `this.f` self-ref) is invoked indirectly via OP_INVOKE,
    // so its internal subroutine must be OP_DEFINE'd too.
    if (node instanceof IdentifierNode && node.functionReference?.functionId !== undefined) {
      ids.add(node.functionReference.functionId);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'resolvedFunction' || key === 'functionReference') continue; // back-references
      if (value instanceof Node) this.collectInvokedFunctionIds(value, ids, visited);
      else if (Array.isArray(value)) {
        for (const item of value) if (item instanceof Node) this.collectInvokedFunctionIds(item, ids, visited);
      }
    }
    return ids;
  }

  /** Emit OP_DEFINEs for all functions plus the dispatcher (or inline a single function). */
  private emitFunctionDefinesAndDispatch(node: ContractNode): void {
    // OP_DEFINE internal/private functions (subroutine-only) + entry points actually invoked internally (via
    // `this.f` / function pointers). An entry point never called internally compiles as an entry point only, so it
    // can read constructor params (the subroutine path is param-less - only declared args are pushed). Key on
    // `!isEntryPoint`, not `visibility !== 'public'`, so external entry points (also non-'public') are not broken.
    const invoked = this.collectInvokedFunctionIds(node);
    // The fallback is a subroutine candidate too: a self low-level call (`address(this).call(data)`) lowers
    // to an internal `__fallback(data)` invocation, so it needs an internal OP_DEFINE when invoked.
    const subroutineCandidates = node.fallbackDef ? [...node.functions, node.fallbackDef] : node.functions;
    const definedFunctions = subroutineCandidates.filter((f) =>
      f.functionId !== undefined && (!f.isEntryPoint || invoked.has(f.functionId)));
    for (const f of definedFunctions) {
      this.emitFunctionDefine(f);
    }

    // Build dispatcher: only include entry-point functions (external/public) + constructor
    const entryFunctions = node.functions.filter((f) => f.isEntryPoint);
    const allFunctions = node.constructorDef
      ? [...entryFunctions, node.constructorDef]
      : entryFunctions;

    const hasFallback = !!node.fallbackDef;
    const hasReceive = !!node.receiveDef;

    const dispatchFunctions = [...allFunctions];
    if (hasFallback) dispatchFunctions.push(node.fallbackDef!);
    if (hasReceive) dispatchFunctions.push(node.receiveDef!);

    if (dispatchFunctions.length === 0) {
      // State-publishing / empty contract: no entry point, so emit OP_0 OP_VERIFY (always-fail) to make
      // the script unspendable (warned in semantic analysis). Not OP_RETURN: it has data-output semantics.
      const loc: SingleLocationData = { location: node.location, positionHint: PositionHint.START };
      this.emit(Op.OP_0, loc);
      this.emit(Op.OP_VERIFY, loc);
      return;
    }

    // A single DELEGATE function that is a proxy impl keeps the selector dispatch (does NOT inline): the proxy
    // covenant verifies the impl's calldata begins with the function selector, so a selector-less inlined impl
    // fails that check. Libraries are excluded - their own delegatecall path expects a selector-less calldata.
    const soleFnIsProxyImpl = dispatchFunctions.length === 1
      && dispatchFunctions[0].modifiers.includes(FunctionModifier.DELEGATE)
      && !node.isLibraryContract;
    if (dispatchFunctions.length === 1 && !hasFallback && !hasReceive && !soleFnIsProxyImpl) {
      const visited = this.visitList(dispatchFunctions) as FunctionDefinitionNode[];
      if (node.constructorDef) {
        node.constructorDef = visited[visited.length - 1];
      }
    } else {
      // OP_DEFINE each entry-point function with its 4-byte hash selector, then dispatch
      dispatchFunctions.forEach((f) => {
        this.emitEntryPointFunctionDefine(f, node.parameters);
      });
      this.emitDispatch(node, allFunctions, hasFallback, hasReceive);
    }
  }

  /** Emit via `emit` and return the [start, end) range it appended to the output. */
  private emitWithSpan(emit: () => void): { start: number; end: number } {
    const start = this.output.length;
    emit();
    return { start, end: this.output.length };
  }

  /** Record a subroutine-eligible site for `id`. */
  private bumpSubroutineUse(id: bigint): void {
    this.subroutineUseCount.set(id, (this.subroutineUseCount.get(id) ?? 0) + 1);
  }

  /**
   * Record a subroutine-eligible site and, when the subroutine is defined, emit its OP_INVOKE.
   * Returns true if the invoke was emitted (the caller should skip the inline body).
   */
  private invokeSubroutineIfDefined(id: bigint, locationData: SingleLocationData): boolean {
    this.bumpSubroutineUse(id);
    if (!this.subroutineDefined.get(id)) return false;
    this.emit(encodeInt(id), locationData);
    this.emit(Op.OP_INVOKE, locationData);
    return true;
  }

  /**
   * Define a subroutine whose body is produced by running `inlineEmit` on a throwaway traversal
   * (byte-identical to the inline path, with any nested subroutines inlined). Marks it defined
   * and returns the emitted span for the dead-DEFINE splice.
   */
  private defineCapturedSubroutine(
    id: bigint,
    inlineEmit: (t: GenerateTargetTraversalWithLocation) => void,
    locationData: SingleLocationData,
  ): { start: number; end: number } {
    const sub = new GenerateTargetTraversalWithLocation(this.compilerOptions);
    sub.compiledBytecodes = this.compiledBytecodes;
    inlineEmit(sub);
    const bodyBytecode = scriptToBytecode(asmToScript(scriptToAsm(sub.output)));
    const start = this.output.length;
    this.emit(bodyBytecode, locationData);
    this.emit(encodeInt(id), locationData);
    this.emit(Op.OP_DEFINE, locationData);
    this.subroutineDefined.set(id, true);
    return { start, end: this.output.length };
  }

  /** Remove a previously emitted range and shift recorded require/log IPs past it. */
  private spliceRange(span: { start: number; end: number }): void {
    const removed = span.end - span.start;
    if (removed <= 0) return;
    this.output.splice(span.start, removed);
    this.locationData.splice(span.start, removed);
    const threshold = span.start + this.constructorParameterCount - 1;
    for (const r of this.requires) {
      if (r.ip > threshold) r.ip -= removed;
    }
    for (const l of this.consoleLogs) {
      if (l.ip > threshold) l.ip -= removed;
      for (const item of l.data) {
        if (typeof item === 'object' && item.ip > threshold) item.ip -= removed;
      }
    }
  }

  /**
   * Count subroutine-eligible sites by dry-running body generation on a throwaway clone, leaving
   * real instance/AST state untouched. Returns null when no site is reachable, or a define-all
   * map on failure (conservative).
   */
  private subroutineUseProbe(node: ContractNode): Map<bigint, number> | null {
    // Subroutine sites only arise from packed state/entry reads, state/entry writes, or events.
    if (this.stateVariables.length === 0 && this.collectionCount === 0 && this.eventDefinitions.length === 0
      && !node.emitsEvent) {
      return null;
    }
    // Body gen mutates deployTargets accumulatively; snapshot/restore so the probe leaves it clean.
    const allFns = [node.constructorDef, node.fallbackDef, node.receiveDef, ...node.functions]
      .filter((f): f is FunctionDefinitionNode => f !== undefined);
    const savedDeployTargets = allFns.map((f) => f.deployTargets);
    try {
      const probe = new GenerateTargetTraversalWithLocation(this.compilerOptions);
      probe.stack = [...this.stack];
      probe.stateVariables = this.stateVariables;
      probe.collectionCount = this.collectionCount;
      probe.dataNftCount = this.dataNftCount;
      probe.eventDefinitions = this.eventDefinitions;
      probe.userFunctionDefs = this.userFunctionDefs;
      probe.constantExpressions = new Map(this.constantExpressions);
      probe.contractUsesMsgData = this.contractUsesMsgData;
      probe.constructorParameterCount = this.constructorParameterCount;
      probe.compiledBytecodes = this.compiledBytecodes;
      probe.emitFunctionDefinesAndDispatch(node);
      return probe.subroutineUseCount;
    } catch {
      return new Map(GenerateTargetTraversalWithLocation.ALL_SUBROUTINE_IDS.map((id) => [id, 2]));
    } finally {
      allFns.forEach((f, i) => { f.deployTargets = savedDeployTargets[i]; });
    }
  }

  /**
   * Emit dispatch logic for entry-point function selection.
   *
   * Without fallback/receive: simple OP_DEPTH OP_1SUB OP_ROLL OP_INVOKE.
   *
   * With receive: first check if stack depth == constructor param count
   * (meaning no selector/args were pushed), and invoke the receive function.
   *
   * With fallback: pre-check the selector against all known selectors before
   * OP_INVOKE (since OP_INVOKE hard-fails on unknown function IDs). If no
   * match, drop the unknown selector and invoke the fallback function.
   */
  private emitDispatch(
    node: ContractNode,
    knownFunctions: FunctionDefinitionNode[],
    hasFallback: boolean,
    hasReceive: boolean,
  ): void {
    const loc: SingleLocationData = { location: node.location, positionHint: PositionHint.START };

    if (!hasFallback && !hasReceive) {
      // Simple dispatch (current behavior)
      this.emit(Op.OP_DEPTH, loc);
      this.emit(Op.OP_1SUB, loc);
      this.emit(Op.OP_ROLL, loc);
      this.emitEntrySelectorSizeCheck(loc);
      this.emit(Op.OP_INVOKE, loc);
      return;
    }

    if (hasReceive) {
      // Check: OP_DEPTH == constructor_param_count (+ 1 if _redeemPushSize) -> receive()
      // When receive is called, the SDK pushes only the redeemScript (no selector, no args).
      // After P2SH eval + constructor param pushes (+ _redeemPushSize if msg.data used),
      // stack depth == expected count.
      const receiveDepth = node.parameters.length + (this.contractUsesMsgData ? 1 : 0);
      this.emit(Op.OP_DEPTH, loc);
      this.emit(encodeInt(BigInt(receiveDepth)), loc);
      this.emit(Op.OP_NUMEQUAL, loc);
      this.emit(Op.OP_IF, loc);
      this.emit(node.receiveDef!.functionSelector!, loc);
      this.emit(Op.OP_INVOKE, loc);
      this.emit(Op.OP_ELSE, loc);
    }

    // Roll selector to top
    this.emit(Op.OP_DEPTH, loc);
    this.emit(Op.OP_1SUB, loc);
    this.emit(Op.OP_ROLL, loc);

    if (hasFallback) {
      // Pre-check: does the selector match any known function?
      // Include fallback's own selector so it can be called directly.
      const allKnownSelectors = [
        ...knownFunctions.map((f) => f.functionSelector!),
        node.fallbackDef!.functionSelector!,
      ];

      // Build boolean accumulator:
      //   OP_DUP <sel1> OP_EQUAL
      //   [OP_OVER <selN> OP_EQUAL OP_BOOLOR]*
      // Stack after: [..., selector, matchBool]
      for (let i = 0; i < allKnownSelectors.length; i++) {
        this.emit(i === 0 ? Op.OP_DUP : Op.OP_OVER, loc);
        this.emit(allKnownSelectors[i], loc);
        this.emit(Op.OP_EQUAL, loc);
        if (i > 0) this.emit(Op.OP_BOOLOR, loc);
      }

      this.emit(Op.OP_IF, loc);
      this.emit(Op.OP_INVOKE, loc);   // known selector: dispatch normally
      this.emit(Op.OP_ELSE, loc);
      this.emit(Op.OP_DROP, loc);     // drop unknown selector
      this.emit(node.fallbackDef!.functionSelector!, loc);
      this.emit(Op.OP_INVOKE, loc);   // invoke fallback
      this.emit(Op.OP_ENDIF, loc);
    } else {
      // No fallback: validate 4-byte selector, then OP_INVOKE (unknown selectors hard-fail)
      this.emitEntrySelectorSizeCheck(loc);
      this.emit(Op.OP_INVOKE, loc);
    }

    if (hasReceive) {
      this.emit(Op.OP_ENDIF, loc);
    }
  }

  /**
   * Verify the entry selector is 4 bytes before OP_INVOKE, so shorter internal/subroutine IDs
   * can't be invoked from the unlocking script. Leaves the selector on the stack.
   */
  private emitEntrySelectorSizeCheck(loc: SingleLocationData): void {
    this.emit(Op.OP_SIZE, loc);
    this.emit(encodeInt(4n), loc);
    this.emit(Op.OP_NUMEQUALVERIFY, loc);
  }

  /**
   * Compile a function body to standalone bytecode and emit OP_DEFINE.
   *
   * The sub-traversal starts with an EMPTY stack. Parameters are pushed by
   * visitFunctionDefinition -> visitParameter. Since OP_PICK indices are
   * relative to the top of the stack, the compiled bytecode correctly
   * accesses the function's own params/locals regardless of the caller's
   * stack depth below.
   */
  private emitFunctionDefine(func: FunctionDefinitionNode): void {
    const locationData = { location: func.location, positionHint: PositionHint.START };

    // Create a sub-traversal to compile the function body independently
    const subTraversal = new GenerateTargetTraversalWithLocation(this.compilerOptions);

    // Copy necessary context for state-accessing functions
    subTraversal.stateVariables = this.stateVariables;
    subTraversal.collectionCount = this.collectionCount;
    subTraversal.dataNftCount = this.dataNftCount;
    subTraversal.eventDefinitions = this.eventDefinitions;
    subTraversal.constructorParameterCount = 0; // sub-traversal has no constructor params
    subTraversal.userFunctionDefs = this.userFunctionDefs;
    subTraversal.isDefineSubTraversal = true;
    subTraversal.constantExpressions = new Map(this.constantExpressions);
    // Compiled child bytecodes (for `type(C).creationCode` / `new C()` inside an extracted function body).
    subTraversal.compiledBytecodes = this.compiledBytecodes;
    subTraversal.subroutineDefined = new Map(this.subroutineDefined);

    // Start with EMPTY stack -- visitFunctionDefinition will push params
    // via visitParameter (pushToStack with pushToBottom=true)

    // Visit the function definition to generate its body bytecode
    subTraversal.currentFunction = func;
    subTraversal.visit(func);

    // Propagate subroutine-use counts so the parent's inline-vs-subroutine decision sees all uses.
    for (const [id, c] of subTraversal.subroutineUseCount) {
      this.subroutineUseCount.set(id, (this.subroutineUseCount.get(id) ?? 0) + c);
    }

    // Serialize the function body to bytecode data
    const bodyBytecode = scriptToBytecode(asmToScript(scriptToAsm(subTraversal.output)));

    // Emit: <body_bytecode> <function_id> OP_DEFINE
    this.emit(bodyBytecode, locationData);
    this.emit(encodeInt(BigInt(func.functionId!)), locationData);
    this.emit(Op.OP_DEFINE, locationData);
  }

  // OP_DEFINE the just-pushed/loaded library blob (on the data stack) so its function(s) are callable.
  // Two shapes (lib.registrar): a plain body is defined directly as functionId - already re-entrant since
  // a body that does not OP_DEFINE at top level can be OP_INVOKEd repeatedly. A REGISTRAR blob defines the
  // library function + its internal helpers when run. We assign the CALLABLE id here (the blob does not bake
  // it, so it can never collide with another library's id): push functionId, define the registrar under a
  // transient setup id (functionId + 0x1000, clear of function ids, the reserved keccak round id, and the
  // 0x1000-0x1008 subroutine registry), and OP_INVOKE it once - the registrar reads functionId and defines
  // the library function at it. Call-sites then OP_INVOKE functionId repeatedly with the helpers defined
  // exactly once (re-entrant keccak256, keccak256(keccak256(x)), etc.). Net-0 on the data stack.
  private emitLibraryRegister(lib: ExternalLibrary, loc: SingleLocationData): void {
    if (!lib.registrar) {
      this.emit(encodeInt(lib.functionId), loc);
      this.emit(Op.OP_DEFINE, loc);
      return;
    }
    const setupId = lib.functionId + 0x1000n;
    this.emit(encodeInt(lib.functionId), loc); // consumer-assigned callable id -> [blob, functionId]
    this.emit(Op.OP_SWAP, loc);                // -> [functionId, blob]
    this.emit(encodeInt(setupId), loc);
    this.emit(Op.OP_DEFINE, loc);              // define the registrar under the setup id -> [functionId]
    this.emit(encodeInt(setupId), loc);
    this.emit(Op.OP_INVOKE, loc);              // run once; registrar consumes functionId, defines the lib fn
  }

  // Inline a library: push its blob from the contract bytecode and register it (no side-car, no integrity
  // hash). Net-0 on the data stack.
  private emitInlineLibraryDefine(lib: ExternalLibrary, loc: SingleLocationData): void {
    this.emit(lib.blob, loc);
    this.emitLibraryRegister(lib, loc);
  }

  /**
   * Load an external library blob from its side-car (the last tx input's revealed P2SH redeem), verify it
   * by hash, and register it (define its function(s)). Net-zero on the data stack. Strip offsets come from
   * the blob (sidecarStripOffsets) and match the SDK's side-car redeem layout. See
   * packages/solidc/docs/external-libraries.md.
   */
  private emitExternalLibraryLoader(lib: ExternalLibrary, loc: SingleLocationData): void {
    const { outerPush, saltPrefix, selfPres, blobPush, blobLength } = sidecarStripOffsets(lib.blob);
    this.emit(Op.OP_TXINPUTCOUNT, loc);
    this.emit(Op.OP_1SUB, loc);
    this.emit(Op.OP_INPUTBYTECODE, loc);          // last input unlocking = PUSHDATA(redeem)
    const strip = (n: number, dropTop: boolean): void => {
      this.emit(encodeInt(BigInt(n)), loc);
      this.emit(Op.OP_SPLIT, loc);
      this.emit(dropTop ? Op.OP_DROP : Op.OP_NIP, loc);
    };
    strip(outerPush, false);    // drop outer push prefix -> redeem
    strip(saltPrefix, false);   // drop <salt:32> OP_DROP
    strip(selfPres, false);     // drop self-preservation
    strip(blobPush, false);     // drop blob push prefix
    strip(blobLength, true);    // split blob | suffix; drop suffix -> blob
    this.emit(Op.OP_DUP, loc);
    this.emit(Op.OP_HASH256, loc);
    this.emit(lib.blobHash, loc);                 // integrity: blob is the genuine library
    this.emit(Op.OP_EQUALVERIFY, loc);
    this.emitLibraryRegister(lib, loc);
  }

  /**
   * Emit the shared OP_DEFINE subroutine for the generic pushdata decode. Stack: [blob] ->
   * [raw_bytes, remainder]. Type-agnostic (raw bytes for all types); int callers add BIN2NUM.
   * Handles OP_0, OP_1NEGATE, OP_1-OP_16, PUSHDATA1/2, and standard pushdata (1-75).
   */
  private emitIntDecodeSubroutine(node: ContractNode): void {
    const loc: SingleLocationData = { location: node.location, positionHint: PositionHint.START };

    const body: (Op | Uint8Array)[] = [];
    const push = (op: Op | Uint8Array): void => { body.push(op); };

    // Split first byte: [blob] -> [remainder, first_byte]
    push(Op.OP_1);
    push(Op.OP_SPLIT);
    push(Op.OP_SWAP);

    // Check for OP_0 (0x00) -> push empty bytes
    push(Op.OP_DUP);
    push(new Uint8Array([0x00]));
    push(Op.OP_EQUAL);
    push(Op.OP_IF);
    push(Op.OP_DROP);
    push(Op.OP_0); // empty bytes (BIN2NUM -> 0)
    push(Op.OP_SWAP);
    push(Op.OP_ELSE);

    // Check for OP_1NEGATE (0x4f) -> push 0x81
    push(Op.OP_DUP);
    push(new Uint8Array([0x4f]));
    push(Op.OP_EQUAL);
    push(Op.OP_IF);
    push(Op.OP_DROP);
    push(new Uint8Array([0x81])); // BIN2NUM -> -1
    push(Op.OP_SWAP);
    push(Op.OP_ELSE);

    // Check for OP_1-OP_16 (0x51-0x60) -> push (N-0x50) as 1-byte
    push(Op.OP_DUP);
    push(Op.OP_BIN2NUM);
    push(Op.OP_DUP);
    push(encodeInt(0x51n));
    push(Op.OP_GREATERTHANOREQUAL);
    push(Op.OP_SWAP);
    push(encodeInt(0x60n));
    push(Op.OP_LESSTHANOREQUAL);
    push(Op.OP_BOOLAND);
    push(Op.OP_IF);
    push(Op.OP_BIN2NUM);
    push(encodeInt(0x50n));
    push(Op.OP_SUB);
    push(Op.OP_1);
    push(Op.OP_NUM2BIN); // 1-byte raw encoding (BIN2NUM -> 1..16)
    push(Op.OP_SWAP);
    push(Op.OP_ELSE);

    // Check for OP_PUSHDATA1 (0x4c) -> read 1-byte length, then data
    push(Op.OP_DUP);
    push(new Uint8Array([0x4c]));
    push(Op.OP_EQUAL);
    push(Op.OP_IF);
    push(Op.OP_DROP);
    push(Op.OP_1);
    push(Op.OP_SPLIT);
    push(Op.OP_SWAP);
    push(new Uint8Array([0x00]));
    push(Op.OP_CAT);
    push(Op.OP_BIN2NUM);
    push(Op.OP_SPLIT);
    push(Op.OP_ELSE);

    // Check for OP_PUSHDATA2 (0x4d) -> read 2-byte LE length, then data
    push(Op.OP_DUP);
    push(new Uint8Array([0x4d]));
    push(Op.OP_EQUAL);
    push(Op.OP_IF);
    push(Op.OP_DROP);
    push(Op.OP_2);
    push(Op.OP_SPLIT);
    push(Op.OP_SWAP);
    push(new Uint8Array([0x00]));
    push(Op.OP_CAT);
    push(Op.OP_BIN2NUM);
    push(Op.OP_SPLIT);
    push(Op.OP_ELSE);

    // Standard pushdata (length byte 1-75) -> read N bytes
    push(Op.OP_BIN2NUM);
    push(Op.OP_SPLIT);

    // Close all 5 IFs
    push(Op.OP_ENDIF);
    push(Op.OP_ENDIF);
    push(Op.OP_ENDIF);
    push(Op.OP_ENDIF);
    push(Op.OP_ENDIF);

    const bodyBytecode = scriptToBytecode(body as Script);
    this.emit(bodyBytecode, loc);
    this.emit(encodeInt(GenerateTargetTraversalWithLocation.INT_DECODE_SUBROUTINE_ID), loc);
    this.emit(Op.OP_DEFINE, loc);
    this.subroutineDefined.set(GenerateTargetTraversalWithLocation.INT_DECODE_SUBROUTINE_ID, true);
  }

  /**
   * Compile an entry-point function body to standalone bytecode and emit OP_DEFINE.
   *
   * Unlike emitFunctionDefine (for internal functions), entry-point functions need
   * access to constructor parameters on the stack. The sub-traversal's tracked stack
   * is pre-populated with constructor param names so the function body can reference
   * them via OP_PICK. After the body, cleanStack leaves exactly 1 truthy value for
   * P2SH validation.
   */
  private emitEntryPointFunctionDefine(
    func: FunctionDefinitionNode,
    contractParams: ParameterNode[],
  ): void {
    const locationData = { location: func.location, positionHint: PositionHint.START };

    // Create a sub-traversal to compile the function body independently
    const subTraversal = new GenerateTargetTraversalWithLocation(this.compilerOptions);

    // Copy necessary context
    subTraversal.stateVariables = this.stateVariables;
    subTraversal.collectionCount = this.collectionCount;
    subTraversal.dataNftCount = this.dataNftCount;
    subTraversal.eventDefinitions = this.eventDefinitions;
    subTraversal.constructorParameterCount = 0; // no data pushes in sub-traversal output
    subTraversal.userFunctionDefs = this.userFunctionDefs;
    subTraversal.isDefineSubTraversal = false; // full entry-point compilation (removeFinalVerify + cleanStack)
    subTraversal.constantExpressions = new Map(this.constantExpressions);
    subTraversal.compiledBytecodes = this.compiledBytecodes;
    subTraversal.subroutineDefined = new Map(this.subroutineDefined);
    subTraversal.contractUsesMsgData = this.contractUsesMsgData;

    // Pre-populate tracked stack with _redeemPushSize (if needed) and constructor param names.
    // _redeemPushSize sits on top of ctor params on the real stack (computed after ctor arg pushes).
    if (this.contractUsesMsgData) {
      subTraversal.stack.push('__internal__redeemPushSize');
    }
    for (const param of contractParams) {
      subTraversal.stack.push(param.name);
    }

    // Visit the function definition - this will:
    // 1. Push function params to tracked stack
    // 2. Run body (including covenant verification for stateful contracts)
    // 3. removeFinalVerify / cleanStack -> leaves 1 truthy value
    subTraversal.currentFunction = func;
    subTraversal.visit(func);

    // Propagate subroutine-use counts so the parent's inline-vs-subroutine decision sees all uses.
    for (const [id, c] of subTraversal.subroutineUseCount) {
      this.subroutineUseCount.set(id, (this.subroutineUseCount.get(id) ?? 0) + c);
    }

    // Normalize the output
    const normalizedOutput = asmToScript(scriptToAsm(subTraversal.output));

    // Capture debug info for this function
    // Use the sub-traversal's location data (same-class private field access)
    const normalizedLocationData = subTraversal.locationData.slice(0, normalizedOutput.length);

    // Optimize: same dual-optimizer approach as main script (compiler.ts). optimiseBytecodeOld is a compat
    // cross-check only; skip it above a size threshold where its fixpoint is prohibitively slow (huge arrays).
    const optimisationResult = optimiseBytecode(
      normalizedOutput,
      normalizedLocationData,
      [...subTraversal.consoleLogs],
      [...subTraversal.requires],
      0, // no constructor param pushes in function body bytecode
    );

    if (normalizedOutput.length <= OPTIMISER_COMPAT_CHECK_MAX_OPS) {
      const optimisedBytecodeOld = optimiseBytecodeOld(normalizedOutput);
      if (scriptToAsm(optimisedBytecodeOld) !== scriptToAsm(optimisationResult.script)) {
        throw new Error('Function body optimisation mismatch - please report this issue');
      }
    }

    const selectorHex = binToHex(func.functionSelector!);

    this.entryPointDebugInfo.set(selectorHex, {
      requires: optimisationResult.requires,
      sourceMap: generateSourceMap(optimisationResult.locationData),
      logs: optimisationResult.logs,
    });

    // Serialize and emit OP_DEFINE with 4-byte hash selector
    const bodyBytecode = scriptToBytecode(optimisationResult.script);
    this.entryPointBytecodes.set(selectorHex, bodyBytecode);
    this.emit(bodyBytecode, locationData);
    this.emit(func.functionSelector!, locationData);
    this.emit(Op.OP_DEFINE, locationData);
  }

  /**
   * Emit OP_INVOKE for calling a defined function
   */
  private emitFunctionInvoke(func: FunctionDefinitionNode, locationData: SingleLocationData): void {
    this.emit(encodeInt(BigInt(func.functionId!)), locationData);
    this.emit(Op.OP_INVOKE, locationData);
  }

  // True if `node` contains a `return` nested inside a loop. Generic tree walk (skips cross-references that
  // point outside the function body) so any container - branch, block, switch, try - is covered.
  private hasReturnInLoop(node: Node, inLoop: boolean): boolean {
    if (node instanceof ReturnNode) return inLoop;
    const nowInLoop = inLoop || node instanceof WhileNode || node instanceof DoWhileNode;
    for (const key of Object.keys(node)) {
      if (key === 'resolvedFunction' || key === 'definition' || key === 'collection') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) {
        if (this.hasReturnInLoop(v, nowInLoop)) return true;
      } else if (Array.isArray(v)) {
        for (const item of v) {
          if (item instanceof Node && this.hasReturnInLoop(item, nowInLoop)) return true;
        }
      }
    }
    return false;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    this.currentFunction = node;
    this.functionHasReturnInLoop = node.body ? this.hasReturnInLoop(node.body, false) : false;
    // Rebuilt fresh each codegen pass (this node is revisited across derivation/subroutine sub-traversals);
    // emitKeccakComputeCall pushes one entry per keccak256 call in emission order (its per-call slot index).
    if (node.keccakCompute) node.keccakPreimageParams = [];
    this.pendingStateWrites = new Map();
    this.pendingEntryWrites = new Map();
    this.pendingEntryDeletes = new Set();
    this.sortedWrittenCollections = new Set();
    this.pendingDynamicWrites = new Map();
    this.coSpendPreservedDynValues = new Set();
    this.pendingTransfers = [];
    this.transferInfos = node.transferInfos ?? [];
    this.pendingEmits = [];
    this.emitInfos = node.emitInfos ?? [];
    this.pendingDeploys = [];
    this.deployCounter = 0;
    const deploySurvey = surveyFunctionDeploys(node.body);
    this.functionDeploySiteCount = deploySurvey.count;
    // Multi-site inline deploy: 2+ deploy sites with at least one conditional (a not-fired conditional shifts
    // the trailing output layout, so fixed slots break) AND all the same child contract (uniform counter*stride
    // + one child type for the SDK to derive). Such a function uses a FUNCTION-LEVEL runtime deploy counter -
    // every deploy (straight-line, branch, loop) verifies inline against it. Heterogeneous multi-site falls
    // through to the single-site guard (ConditionalDeployError, fail closed).
    this.functionMultiSiteDeploy = deploySurvey.count > 1 && deploySurvey.hasConditional
      && deploySurvey.contractNames.size === 1;
    this.inlineDeployActive = false;
    this.preAllocatedStateWrites = new Set();
    this.preAllocatedTransfers = new Set();
    this.preAllocatedEmits = new Set();
    this.preAllocatedTokenContainerTransfers = new Set();
    this.preAllocatedEntryWrites = new Set();
    this.preAllocatedEntryDeletes = new Set();
    this.plainLoopDepth = 0;
    this.transferPreallocDepth = 0;
    this.condDeleteSlots = new Set();
    this.preAllocatedDynamicWrites = new Set();
    this.conditionalTransferIndices = new Set();
    this.conditionalEmitIndices = new Set();
    this.conditionalTokenContainerTransferIndices = new Set();
    this.tokenContainerSlots = node.tokenContainerAccesses ?? [];
    this.pendingTokenContainerTransfers = [];
    this.tokenContainerTransferCounter = 0;

    // Pre-scan the function body to collect accessed NFT indices
    const collector = new NftIndexCollector();
    collector.visit(node.body);
    const accessedNftIndices = [...collector.indices].sort((a, b) => a - b);

    // Build compact offset map: nftIndex -> compact position (1-based)
    this.compactOffsetMap = new Map();
    accessedNftIndices.forEach((nftIdx, pos) => {
      this.compactOffsetMap.set(nftIdx, pos + 1);
    });
    this.hasStateAccess = accessedNftIndices.length > 0;

    // Store required NFT indices on the node for artifact generation.
    // For stateful contracts (dataNftCount > 0), always store (even as empty [])
    // so the SDK knows the exact data NFT count and doesn't fall back to ALL.
    // For non-stateful contracts, only store when non-empty (preserves old behavior).
    // Upgrade/unsafe(0)/selfdestruct modifiers need ALL data NFTs regardless of body accesses,
    // because the modifier-injected code operates on the full set of data NFTs.
    // unsafe(1)/unsafe(2) use accessedNftIndices only (body reads allowed, writes forbidden).
    // split/merge: empty [] (no data NFTs - purely minting NFT lifecycle).
    const isSplitOrMerge = node.modifiers.includes(FunctionModifier.SPLIT)
      || node.modifiers.includes(FunctionModifier.MERGE);
    const isUnsafeTier0 = node.modifiers.includes(FunctionModifier.UNSAFE) && (node.unsafeTier ?? 0) === 0;
    const hasFullStateModifier = node.modifiers.some((m) => m === FunctionModifier.UPGRADE
      || m === FunctionModifier.SELFDESTRUCT
      || m === FunctionModifier.DELEGATE) || isUnsafeTier0;
    // Functions with delegatecall low-level calls need all data NFTs because the delegate
    // implementation may access any state on the proxy's behalf.
    const hasDelegatecall = node.lowLevelCalls?.some((lc) => lc.callMode === 'delegatecall') ?? false;
    if (isSplitOrMerge && this.dataNftCount > 0) {
      node.requiredNftIndices = [];
    } else if ((hasFullStateModifier || hasDelegatecall) && this.dataNftCount > 0) {
      node.requiredNftIndices = Array.from({ length: this.dataNftCount }, (_, i) => i);
    } else if (this.dataNftCount > 0 || accessedNftIndices.length > 0) {
      node.requiredNftIndices = accessedNftIndices;
    }

    // Recompute block layout with finalized requiredNftIndices + conditional flags
    if (this.dataNftCount >= 0 && node.isEntryPoint && node.blockLayout) {
      // Compute function-level min counts from branch nodes to detect conditional slots
      const minCounts = { transfers: node.transferInfos?.length ?? 0, emits: node.emitInfos?.length ?? 0, tcTransfers: 0 };
      const findBranchMins = (n: Node): void => {
        if (n instanceof BranchNode && n.branchOps) {
          minCounts.transfers = Math.min(minCounts.transfers, n.branchOps.minTransferCount);
          minCounts.emits = Math.min(minCounts.emits, n.branchOps.minEmitCount);
          minCounts.tcTransfers = Math.min(minCounts.tcTransfers, n.branchOps.minTokenContainerTransferCount);
        }
        if ('statements' in n && Array.isArray((n as any).statements)) {
          for (const s of (n as any).statements) findBranchMins(s);
        }
        if (n instanceof BranchNode) {
          findBranchMins(n.ifBlock);
          if (n.elseBlock) findBranchMins(n.elseBlock);
        }
      };
      findBranchMins(node.body);

      // Entry slots touched inside any if/else/switch are conditionally active (a branch-guarded write/delete may
      // or may not run). Mark them so the SDK does not statically drop a guarded delete's entry output, which
      // would wrongly delete the entry on the not-taken path. branchOps/switchOps already aggregate nested arms.
      const conditionalEntrySlots = new Set<number>();
      // A delete inside an if/else BRANCH is lowered to an existence-gated soft-delete WRITE (visitBranch +
      // preAllocateCondDeleteWrite); the SDK derives those as writes, not drops. Marked separately so switch/loop
      // conditional deletes keep the plain path.
      const softDeleteEntrySlots = new Set<number>();
      const collectCondEntries = (n: Node | undefined): void => {
        if (!n) return;
        if (n instanceof BranchNode && n.branchOps) {
          n.branchOps.mappingWriteSlots.forEach((s) => conditionalEntrySlots.add(s));
          n.branchOps.mappingDeleteSlots.forEach((s) => { conditionalEntrySlots.add(s); softDeleteEntrySlots.add(s); });
        }
        if (n instanceof SwitchNode && n.switchOps) {
          n.switchOps.mappingWriteSlots.forEach((s) => conditionalEntrySlots.add(s));
          n.switchOps.mappingDeleteSlots.forEach((s) => conditionalEntrySlots.add(s));
        }
        for (const key of Object.keys(n)) {
          // Skip type/symbol metadata and the resolvedFunction back-reference: the latter points at the callee's
          // definition, so following it would cross function boundaries (mis-attributing its conditional entries)
          // and recurse forever on a recursive/cyclic call. Each function's body is walked on its own.
          if (key === 'type' || key === 'symbolTable' || key === 'location' || key === 'resolvedFunction') continue;
          const v = (n as unknown as Record<string, unknown>)[key];
          if (v instanceof Node) collectCondEntries(v);
          else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) collectCondEntries(it);
        }
      };
      collectCondEntries(node.body);

      // Compute total tcTransfer count (same logic as computeBlockLayout - per operation)
      let totalTcTransfers = 0;
      if (node.tokenContainerAccesses) {
        for (const tca of node.tokenContainerAccesses) {
          totalTcTransfers += tca.transferCount + tca.transferNftCount;
        }
      }
      if (minCounts.tcTransfers > totalTcTransfers) minCounts.tcTransfers = totalTcTransfers;

      const slots: BlockLayoutSlot[] = [];
      let blOffset = 0;
      slots.push({ kind: 'master', offset: blOffset++ });
      for (const nftIdx of (node.requiredNftIndices ?? [])) {
        slots.push({ kind: 'dataNft', offset: blOffset++, nftIndex: nftIdx });
      }
      for (const origSlot of node.blockLayout.slots) {
        if (origSlot.kind === 'master' || origSlot.kind === 'dataNft') continue;
        let conditional: boolean | undefined;
        if (origSlot.kind === 'transfer' && origSlot.slotIndex !== undefined
          && origSlot.slotIndex >= minCounts.transfers) conditional = true;
        if (origSlot.kind === 'event' && origSlot.slotIndex !== undefined
          && origSlot.slotIndex >= minCounts.emits) conditional = true;
        if (origSlot.kind === 'tcTransfer' && origSlot.slotIndex !== undefined
          && origSlot.slotIndex >= minCounts.tcTransfers) conditional = true;
        if (origSlot.kind === 'entry' && origSlot.slotIndex !== undefined
          && conditionalEntrySlots.has(origSlot.slotIndex)) conditional = true;
        const softDelete = origSlot.kind === 'entry' && origSlot.slotIndex !== undefined
          && softDeleteEntrySlots.has(origSlot.slotIndex);
        slots.push({
          ...origSlot, offset: blOffset++, ...(conditional && { conditional }), ...(softDelete && { softDelete }),
        });
      }
      node.blockLayout = { blockSize: blOffset, slots };
    }

    // Copy entry access info from semantic analysis
    this.entrySlots = node.entryAccesses ?? [];

    // The flag bit extraction pattern uses 2^i OP_DIV, which overflows for i >= 63
    // (8-byte Script Number limit). Reject contracts that exceed this limit at compile time.
    if (this.entrySlots.length > 62) {
      throw new Error(
        `Function '${node.name}' accesses ${this.entrySlots.length} entry slots, `
        + 'but the maximum supported is 62 (flag bit extraction overflows at 63)',
      );
    }

    // Copy external read info from semantic analysis
    this.externalReadSlots = node.externalReads ?? [];

    // Copy external call info from semantic analysis
    this.externalCallSlots = node.externalCalls ?? [];

    // Copy external outState info from semantic analysis
    this.externalOutStateSlots = node.externalOutStateReads ?? [];

    // Copy low-level call count from semantic analysis
    this.lowLevelCallCount = node.lowLevelCalls?.length ?? 0;

    // Delegate tracking
    this.functionHasDelegatecall = node.lowLevelCalls?.some((c) => c.callMode === 'delegatecall') ?? false;
    this.currentFunctionIsDelegate = node.modifiers.includes(FunctionModifier.DELEGATE);

    // Fallback with bytes parameter: compute msg.data and bind it as the parameter value.
    // The parameter is NOT passed by the SDK - it's computed inline from OP_INPUTBYTECODE.
    // Entry-point compile only: as an internal subroutine (self low-level call lowering) the caller pushes
    // the payload as a declared arg, and _redeemPushSize does not exist on the subroutine's stack.
    if (node.isFallback && node.parameters.length > 0 && !this.isDefineSubTraversal
      && !node.parameters[0].name.startsWith('__internal__')) {
      const loc: SingleLocationData = { location: node.location, positionHint: PositionHint.START };
      this.emitMsgData(loc);
      this.pushToStack(node.parameters[0].name);
      // Visit remaining (synthetic) parameters normally - skip the first user parameter
      const syntheticParams = node.parameters.slice(1);
      const visited = this.visitList(syntheticParams) as ParameterNode[];
      node.parameters = [node.parameters[0], ...visited];
    } else if (this.isDefineSubTraversal) {
      // Internal subroutine (invoked by functionId via OP_INVOKE): the caller pushes only the DECLARED args,
      // so skip the synthetic entry-point-only `__internal__returnOutputIdx` param - it is unused here (raw
      // return, no return event) and would otherwise leave the declared params at the wrong stack offsets.
      // Do NOT mutate node.parameters: the entry-point define shares this node and needs the full list.
      for (const p of node.parameters) {
        if (p.name === '__internal__returnOutputIdx') continue;
        this.visit(p);
      }
    } else {
      node.parameters = this.visitList(node.parameters) as ParameterNode[];
    }

    if (this.compilerOptions.enforceFunctionParameterTypes) {
      this.enforceFunctionParameterTypes(node);
    }

    // Delegate functions: save _proxyMasterIndex to the altstack so that
    // emitMasterInputIndex can read it without depending on the main stack depth.
    // PICK copies the value, TOALTSTACK moves the copy. Net-zero on main stack.
    // Also verify the proxy has a minting NFT (is a valid stateful contract master).
    if (this.currentFunctionIsDelegate) {
      const loc: SingleLocationData = { location: node.location, positionHint: PositionHint.START };
      const idx = this.getStackIndex('__internal__proxyMasterIndex');
      this.emit(encodeInt(BigInt(idx)), loc);
      this.emit(Op.OP_PICK, loc);

      // Verify UTXO at _proxyMasterIndex has minting capability (0x02)
      // This confirms it's a legitimate stateful contract master, not an arbitrary UTXO.
      // NOTE: The delegate does not verify the proxy's category or LBC - this is by design
      // so delegates can serve multiple proxies. Delegate functions MUST include their own
      // access control (e.g., require(checkSig(...))) to prevent unauthorized callers from
      // invoking the delegate with an arbitrary minting NFT as the "proxy".
      this.emit(Op.OP_DUP, loc);
      this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
      this.emit(encodeInt(32n), loc);
      this.emit(Op.OP_SPLIT, loc);    // [idx, category_32, capability_byte]
      this.emit(Op.OP_SWAP, loc);     // [idx, capability_byte, category_32]
      if (this.currentContractIsBrandedLibrary) {
        // Branded library: pin the proxy master's category to this library's `__brand` ctor arg, so only the
        // owning consumer's master can co-spend it (rides one master's serialization). The 3 manual items above
        // the tracked stack at this point (idx, capability_byte, category_32) offset the __brand pick depth.
        const brandIdx = this.getStackIndex('__brand');
        this.emit(encodeInt(BigInt(brandIdx + 3)), loc);
        this.emit(Op.OP_PICK, loc);        // [idx, capability_byte, category_32, __brand]
        this.emit(Op.OP_EQUALVERIFY, loc); // [idx, capability_byte]  proxy category == brand
      } else {
        this.emit(Op.OP_DROP, loc);     // [idx, capability_byte]
      }
      this.emit(encodeInt(2n), loc);   // 0x02 = minting capability
      this.emit(Op.OP_EQUALVERIFY, loc); // [idx]

      // Verify the proxy preserves itself (input LBC == output LBC at _proxyMasterIndex).
      // This prevents using a non-covenant UTXO (e.g., bare P2PKH with a minting token)
      // as a fake proxy, since such UTXOs don't enforce self-preservation.
      this.emit(Op.OP_DUP, loc);              // [idx, idx]
      this.emit(Op.OP_DUP, loc);              // [idx, idx, idx]
      this.emit(Op.OP_UTXOBYTECODE, loc);     // [idx, idx, input_lbc]
      this.emit(Op.OP_SWAP, loc);             // [idx, input_lbc, idx]
      this.emit(Op.OP_OUTPUTBYTECODE, loc);   // [idx, input_lbc, output_lbc]
      this.emit(Op.OP_EQUALVERIFY, loc);      // [idx]  proxy LBC self-preservation verified

      // Verify _proxyMasterIndex != OP_INPUTINDEX (proxy must be a different input than delegate)
      // Prevents the delegate from pointing at itself, which could bypass emitDelegateSelfPreservation
      this.emit(Op.OP_DUP, loc);        // [idx, idx]
      this.emit(Op.OP_INPUTINDEX, loc);  // [idx, idx, delegateIdx]
      this.emit(Op.OP_NUMNOTEQUAL, loc); // [idx, bool]
      this.emit(Op.OP_VERIFY, loc);      // [idx]

      this.emit(Op.OP_TOALTSTACK, loc);
    }

    // Load each external library this function uses and OP_DEFINE it once, before the body. Inlined
    // libraries push their blob from the contract bytecode; the rest load it from the co-spent side-car.
    for (const libName of node.usedLibraries ?? []) {
      // Result-NFT keccak has no contract-side blob to load: the side-car computes it. Skip the loader.
      if (node.keccakCompute && libName === GlobalFunction.KECCAK256) continue;
      const loc = { location: node.location, positionHint: PositionHint.START };
      const lib = this.resolvedLibraries[libName];
      if (node.inlinedLibraries?.includes(libName)) this.emitInlineLibraryDefine(lib, loc);
      else this.emitExternalLibraryLoader(lib, loc);
    }

    // Multi-site deploy: push a FUNCTION-LEVEL runtime deploy counter (deploys-fired-so-far = 0) before the body
    // so every deploy site (straight-line, branch, loop) verifies inline against it. Inline deploys don't use
    // the epilogue, so the counter is dropped right after the body - the covenant epilogue never sees it.
    if (this.functionMultiSiteDeploy) {
      this.emit(encodeInt(0n), { location: node.location, positionHint: PositionHint.START });
      this.pushToStack(this.inlineDeployCounterName);
      this.inlineDeployActive = true;
    }

    node.body = this.visit(node.body) as BlockNode;

    // Drop the function-level deploy counter (roll it up from wherever it sits - the body is depth-balanced, so
    // it is on top, but roll by tracked index to be safe). Done before any covenant verification.
    if (this.functionMultiSiteDeploy && this.inlineDeployActive) {
      const idx = this.getStackIndex(this.inlineDeployCounterName);
      this.emit(encodeInt(BigInt(idx)), { location: node.location, positionHint: PositionHint.END });
      this.emit(Op.OP_ROLL, { location: node.location, positionHint: PositionHint.END });
      this.emit(Op.OP_DROP, { location: node.location, positionHint: PositionHint.END });
      this.removeFromStack(idx);
      this.inlineDeployActive = false;
    }

    // Internal/private functions with return types handle their own stack cleanup
    // via visitReturn. They don't need covenant verification.
    // Entry-point functions with return types DO need covenant verification
    // (they're entry points that also emit return event UTXOs).
    // The internal-call subroutine of a public function (isDefineSubTraversal) is compiled with
    // internal semantics too: it returns the value on the stack, with no return-event covenant. (Functions
    // with a return-inside-a-loop keep the entry-point/event path - see visitReturn.)
    if (node.returnTypes.length > 0
      && (!node.isEntryPoint || (this.isDefineSubTraversal && !this.functionHasReturnInLoop))) {
      return node;
    }

    // Void functions compiled for OP_DEFINE (via emitFunctionDefine) should leave
    // 0 items on the stack - unlike entry-point functions which need exactly 1 item
    // for P2SH validation. The require() statements use OP_VERIFY which already
    // consumes the boolean, so we just need to drop any remaining parameters/locals.
    if (this.isDefineSubTraversal) {
      const stackSize = this.stack.length;
      for (let i = 0; i < stackSize; i++) {
        this.emit(Op.OP_DROP, { location: node.body.location, positionHint: PositionHint.END });
        this.popFromStack();
      }
      return node;
    }

    // For functions that access state or entries, verify token categories
    const hasEntryAccess = this.entrySlots.length > 0;
    const hasEntryWrites = this.pendingEntryWrites.size > 0;
    const hasEntryDeletes = this.pendingEntryDeletes.size > 0;
    const hasTransfers = this.pendingTransfers.length > 0;
    const hasEventEmits = this.pendingEmits.length > 0;
    const hasDeploys = this.pendingDeploys.length > 0;
    const hasTokenContainerAccess = this.tokenContainerSlots.length > 0;
    const hasTokenContainerTransfers = this.pendingTokenContainerTransfers.length > 0;
    const hasExternalReads = this.externalReadSlots.length > 0;
    const hasExternalCalls = this.externalCallSlots.length > 0;
    const hasExternalOutStateReads = this.externalOutStateSlots.length > 0;
    const hasReturnEventB = node.returnTypes.length > 0 && node.isEntryPoint;
    const hasReturnEventA = (node.externalCalls ?? []).some((ec) => ec.hasReturnValues);
    const hasAnyStatefulAccess = this.hasStateAccess || hasEntryAccess || hasEventEmits
      || hasTransfers || hasDeploys || hasTokenContainerAccess || hasExternalReads || hasExternalCalls
      || hasExternalOutStateReads || hasReturnEventB || hasReturnEventA;

    // Covenant protection model:
    // Normal: full covenant checks - function accesses state/entries/events/transfers/etc.
    // Guarded: basic covenant checks - non-stateful function in stateful contract, not unsafe(0)
    // unsafe(0): zero covenant checks (current backwards-compat behavior)
    // unsafe(1): master + minting preservation only
    // unsafe(2): master + minting + value preservation
    // split/merge: dedicated covenant verification
    const isStatefulContract = this.stateVariables.length > 0
      || this.collectionCount > 0 || this.eventDefinitions.length > 0
      || this.currentContractUsesBlockhash
      || this.currentContractEmitsEvent
      || (this.compilerOptions.forceStateful ?? false);
    const isUnsafe = node.modifiers.includes(FunctionModifier.UNSAFE);
    const unsafeTier = isUnsafe ? (node.unsafeTier ?? 0) : null;
    const isUpgrade = node.modifiers.includes(FunctionModifier.UPGRADE);
    const isSelfdestruct = node.modifiers.includes(FunctionModifier.SELFDESTRUCT);
    const isSplit = node.modifiers.includes(FunctionModifier.SPLIT);
    const isMerge = node.modifiers.includes(FunctionModifier.MERGE);

    // Split/merge: dedicated covenant verification (handled in later steps)
    if (isSplit) {
      this.emitSplitCovenantVerification(node);
    } else if (isMerge) {
      this.emitMergeCovenantVerification(node);
    } else if (unsafeTier !== null && unsafeTier >= 1) {
      // Tiered unsafe: emit only the checks for this tier
      this.emitMasterSelfPreservation(node);
      this.emitMintingNftUniqueness(node);
      if (unsafeTier >= 2) {
        this.emitValuePreservation(node, false);
      }
    } else if (unsafeTier === 0) {
      // unsafe(0): no covenant checks at all (existing behavior)
    } else {
      // Normal and delegatecall paths (unchanged)

      // Delegatecall proxy: skip state covenant (delegate handles it),
      // keep master self-preservation + minting uniqueness
      if (this.functionHasDelegatecall) {
        if (this.currentFunctionIsDelegate) {
          throw new InvalidModifierCombinationError(
            node,
            `delegate function '${node.name}' cannot also issue delegatecall `
            + '(nested delegation defers state verification twice)',
          );
        }
        this.emitMasterSelfPreservation(node);
        this.emitMintingNftUniqueness(node);
        this.emitValuePreservation(node, hasTokenContainerAccess);
        // C1 full-state authority: the co-spent delegate only pins the proxy data NFTs it accesses, so an
        // un-touched proxy data NFT would otherwise be destroyable via flag=2 on this path. Conserve the count
        // of the proxy's OWN-category mutable (0x01) NFTs input==output; the delegate's writes preserve the
        // count, so this only rejects destruction/count-tampering of the proxy's state.
        this.emitOwnCategoryMutableNftConservation(node);
      } else if (hasAnyStatefulAccess) {
        // Full covenant checks
        this.emitTokenCategoryVerification(node);
      }
      if (!this.functionHasDelegatecall && hasEntryAccess) {
        this.emitEntryCategoryVerification(node);
      }
      // Data NFT covenant verification: handles both written and read-only NFTs
      // Selfdestruct functions skip output verification - data NFTs are destroyed via flag=2
      if (!this.functionHasDelegatecall && this.hasStateAccess && !isSelfdestruct) {
        this.emitAutoCovenantVerification(node);
      }
      if (!this.functionHasDelegatecall && (hasEntryWrites || hasEntryDeletes)) {
        this.emitEntryCovenantVerification(node);
      }
      // An array-external-call co-spend over a dynamically-WRITTEN state array (`poolInfo[i].lpToken.m()` in a
      // loop that also writes poolInfo, e.g. MasterChef massUpdatePools) reads the array from the write's RMW
      // value. Mark that value so emitDynamicWriteVerification keeps it on the stack (it is otherwise dropped
      // there, before the co-spend at emitExternalCallVerification runs). SOUND: only loop-invariant fields
      // (the called interface field) are read, so the post-write value's field == the pre-state one dispatched.
      if (!this.functionHasDelegatecall && hasExternalCalls && this.pendingDynamicWrites.size > 0) {
        for (const slot of this.externalCallSlots) {
          const w = slot.loopArrayVar ? this.pendingDynamicWrites.get(slot.loopArrayVar) : undefined;
          if (w) this.coSpendPreservedDynValues.add(w.valueStackName);
        }
      }
      // Dynamic-storage writes: verify trailing chunk outputs (and consume old chunk inputs).
      if (!this.functionHasDelegatecall && this.pendingDynamicWrites.size > 0) {
        this.emitDynamicWriteVerification(node);
      }
      // Read-only entry preservation: verify entries not written/deleted are preserved
      // Selfdestruct functions skip - all entries are destroyed
      if (!this.functionHasDelegatecall && hasEntryAccess && !isSelfdestruct) {
        this.emitReadOnlyEntryVerification(node);
      }
      // Conditional soft-delete entries: verified AFTER read-only preservation (derivation-order requirement).
      if (!this.functionHasDelegatecall && this.condDeleteSlots.size > 0) {
        this.emitConditionalDeleteVerification(node);
      }
      if (!this.functionHasDelegatecall && hasTransfers) {
        this.emitTransferCovenantVerification(node);
      }
      // Token container verification
      if (!this.functionHasDelegatecall && hasTokenContainerAccess) {
        this.emitTokenContainerIdentityVerification(node);
      }
      if (!this.functionHasDelegatecall && hasTokenContainerTransfers) {
        this.emitTokenContainerTransferCovenantVerification(node);
      }
      if (!this.functionHasDelegatecall && hasTokenContainerAccess) {
        this.emitTokenContainerPreservation(node);
      }
      if (!this.functionHasDelegatecall && hasExternalReads) {
        this.emitExternalReadVerification(node);
      }
      if (!this.functionHasDelegatecall && hasExternalCalls) {
        this.emitExternalCallVerification(node);
      }
      if (!this.functionHasDelegatecall && hasExternalOutStateReads) {
        this.emitExternalOutStateVerification(node);
      }
      if (!this.functionHasDelegatecall && hasEventEmits) {
        this.emitEventCovenantVerification(node);
      }
      // Deploy covenant verification: verify child master NFT + data NFT outputs
      if (!this.functionHasDelegatecall && hasDeploys) {
        this.emitDeployCovenantVerification(node);
      }
      // B-side: return event covenant verification for entry-point functions with return types
      if (!this.functionHasDelegatecall && node.returnTypes.length > 0 && node.isEntryPoint) {
        this.emitReturnEventCovenantVerification(node);
      }
      // A-side: verify return event UTXO from external function calls with return values
      if (!this.functionHasDelegatecall && node.externalCalls && node.externalCalls.some((ec) => ec.hasReturnValues)) {
        this.emitExternalReturnEventVerification(node);
      }
      // Master self-preservation + uniqueness (upgrade-aware)
      // 'upgrade' functions use emitUpgradeSelfPreservation (category+capability only, no bytecode check)
      // Delegate functions: verify proxy's state transitions + delegate's own self-preservation
      // Selfdestruct functions skip master preservation but ALWAYS verify minting uniqueness
      // to prevent minting NFT duplication during destruction
      if (!this.functionHasDelegatecall && hasAnyStatefulAccess && !isSelfdestruct) {
        if (this.currentFunctionIsDelegate) {
          this.emitMasterSelfPreservation(node);
          this.emitMintingNftUniqueness(node);
          this.emitDelegateSelfPreservation(node);
          this.emitDelegateMintingNftUniqueness(node);
        } else if (isUpgrade) {
          this.emitUpgradeSelfPreservation(node);
          this.emitMintingNftUniqueness(node);
          this.emitMasterCommitmentPreservation(node);
        } else {
          this.emitMasterSelfPreservation(node);
          this.emitMintingNftUniqueness(node);
        }
      } else if (!this.functionHasDelegatecall && hasAnyStatefulAccess && isSelfdestruct) {
        // Selfdestruct: skip master self-preservation (contract is being destroyed)
        // but enforce minting NFT uniqueness to prevent duplication
        this.emitMintingNftUniqueness(node);
      } else if (!this.functionHasDelegatecall && isStatefulContract && isSelfdestruct && !hasAnyStatefulAccess) {
        // Selfdestruct without state access: still verify minting NFT uniqueness
        // to prevent minting NFT duplication during destruction (M6 fix)
        this.emitMintingNftUniqueness(node);
      } else if (!this.functionHasDelegatecall && isStatefulContract && !isSelfdestruct) {
        // Guarded: basic covenant checks for non-stateful functions in stateful contracts
        // Includes commitment preservation to prevent state corruption via non-stateful functions
        if (this.currentFunctionIsDelegate) {
          this.emitMasterSelfPreservation(node);
          this.emitMintingNftUniqueness(node);
          this.emitMasterCommitmentPreservation(node);
          this.emitDelegateSelfPreservation(node);
        } else if (isUpgrade) {
          this.emitUpgradeSelfPreservation(node);
          this.emitMintingNftUniqueness(node);
          this.emitMasterCommitmentPreservation(node);
        } else {
          this.emitMasterSelfPreservation(node);
          this.emitMintingNftUniqueness(node);
          this.emitMasterCommitmentPreservation(node);
        }
      }
      // C3: pin the count of co-spent own-category mutable (0x01) NFTs to exactly the accessed data-NFT count,
      // so an attacker cannot additionally co-spend an un-accessed data/entry NFT to destroy or corrupt it (its
      // own sub-covenant self-authorizes on any master-spend). Skipped for functions that legitimately co-spend
      // a variable count of own-category 0x01 NFTs (entries, token containers, dynamic-storage chunks) or that
      // use a special NFT topology (deploy/selfdestruct/upgrade/split/merge/delegate); those keep per-slot
      // verification and are a documented residual. See SECURITY-AUDIT C3.
      if (!this.functionHasDelegatecall && !this.currentFunctionIsDelegate && isStatefulContract
        && !isSelfdestruct && !isUpgrade && !hasEntryAccess && !hasTokenContainerAccess
        && !hasTokenContainerTransfers && this.pendingDynamicWrites.size === 0 && !hasDeploys) {
        this.emitOwnCategoryMutableNftConservation(node);
      }
      // Value preservation: satoshi and fungible token amounts
      // Selfdestruct functions skip - all NFTs and containers are being destroyed
      if (!this.functionHasDelegatecall && hasAnyStatefulAccess && !isSelfdestruct) {
        this.emitValuePreservation(node, hasTokenContainerAccess);
      } else if (!this.functionHasDelegatecall && isStatefulContract && !isSelfdestruct) {
        this.emitValuePreservation(node, false);
      }
      // Deferred transfer cleanup: must come after emitValuePreservation
      // so conditional transfer LBC values are still available for activity checks
      if (!this.functionHasDelegatecall && hasTransfers) {
        this.emitTransferCleanup(node);
      }
    }

    // Function ending
    const hasCovenantChecks = isSplit || isMerge || (unsafeTier !== null && unsafeTier >= 1)
      || this.functionHasDelegatecall || hasAnyStatefulAccess
      || (isStatefulContract && unsafeTier !== 0 && !isSelfdestruct)
      || (isStatefulContract && isSelfdestruct);
    if (!hasCovenantChecks) {
      this.removeFinalVerifyFromFunction(node.body);
    } else {
      // Covenant verification ends with OP_VERIFY; add OP_1 for success
      this.emit(Op.OP_1, { location: node.body.location, positionHint: PositionHint.END });
      this.pushToStack('(value)');
    }
    this.cleanStack(node.body);

    return node;
  }

  removeFinalVerifyFromFunction(functionBodyNode: Node): void {
    // After EnsureFinalRequireTraversal, we know that the final opcodes are either
    // "OP_VERIFY", "OP_CHECK{LOCKTIME|SEQUENCE}VERIFY OP_DROP", "OP_ENDIF" or "OP_UNTIL"

    // Guard: empty-bodied functions (e.g. empty constructors with parent invocation)
    // have no output to process - just push OP_1 for P2SH success.
    if (this.output.length === 0) {
      this.emit(Op.OP_1, { location: functionBodyNode.location, positionHint: PositionHint.END });
      this.pushToStack('(value)');
      return;
    }

    const finalOp = this.output.pop() as Op;
    const { location, positionHint } = this.locationData.pop()!;

    // If the final op is OP_VERIFY and the stack size is less than 4 we remove it from the script
    // - We have the stack size check because it is more efficient to use 2DROP rather than NIP
    //   if >= 4 elements are left (5 including final value) (e.g. 2DROP 2DROP 1 < NIP NIP NIP NIP)
    if (finalOp === Op.OP_VERIFY && this.stack.length < 4) {
      // Since the final value is no longer popped from the stack by OP_VERIFY,
      // we add it back to the stack
      this.pushToStack('(value)');

      // Replace the location data of the final check (e.g. (x == 1)) with the location data of the
      // full require statement including the removed OP_VERIFY (e.g. require(x == 1)), because
      // the check opcode (e.g. OP_EQUAL) now represents the entire require statement (including implicit OP_VERIFY)
      this.locationData.pop();
      this.locationData.push({ location, positionHint });
    } else {
      this.emit(finalOp, { location, positionHint: PositionHint.END });

      // At this point there is no verification value left on the stack:
      //  - scoped stack is cleared inside block ended by OP_ENDIF or OP_UNTIL
      //  - OP_CHECK{LOCKTIME|SEQUENCE}VERIFY OP_DROP does not leave a verification value
      //  - OP_VERIFY does not leave a verification value
      // so we add OP_1 to the script (indicating success)
      this.emit(Op.OP_1, { location: functionBodyNode.location, positionHint: PositionHint.END });
      this.pushToStack('(value)');
    }
  }

  cleanStack(functionBodyNode: Node): void {
    // Keep final verification value, OP_NIP the other stack values
    const stackSize = this.stack.length;
    for (let i = 0; i < stackSize - 1; i += 1) {
      this.emit(Op.OP_NIP, { location: functionBodyNode.location, positionHint: PositionHint.END });
      this.nipFromStack();
    }
  }

  enforceFunctionParameterTypes(node: FunctionDefinitionNode): void {
    node.parameters.forEach((parameter) => this.enforceFunctionParameterType(parameter));
  }

  enforceFunctionParameterType(node: ParameterNode): void {
    if (!this.shouldEnforceFunctionParameterType(node)) return;

    const stackIndex = this.getStackIndex(node.name);
    this.emit(encodeInt(BigInt(stackIndex)), { location: node.location, positionHint: PositionHint.START });

    // Unwrap ValueType to get the underlying type for enforcement
    const effectiveType = node.type instanceof ValueType ? node.type.underlyingType : node.type;

    if (effectiveType === PrimitiveType.BOOL) {
      // For booleans, we take it from the stack and force-convert it to a boolean using OP_0NOTEQUAL
      this.emit(Op.OP_ROLL, { location: node.location, positionHint: PositionHint.START });
      this.emit(Op.OP_0NOTEQUAL, { location: node.location, positionHint: PositionHint.START });

      // We remove the original stack value and push the new boolean value to the top of the stack
      this.removeFromStack(stackIndex);
      this.pushToStack(node.name);
    }

    if (effectiveType instanceof BytesType && effectiveType.bound !== undefined) {
      // For bounded bytes, we copy it from the stack and *check* that it is the correct size
      this.emit(Op.OP_PICK, { location: node.location, positionHint: PositionHint.START });
      this.emit(Op.OP_SIZE, { location: node.location, positionHint: PositionHint.START });
      this.emit(encodeInt(BigInt(effectiveType.bound)), { location: node.location, positionHint: PositionHint.START });
      this.emit(Op.OP_EQUALVERIFY, { location: node.location, positionHint: PositionHint.START });
      this.emit(Op.OP_DROP, { location: node.location, positionHint: PositionHint.START });

      // We don't perform any stack operations, because these ops leave the original stack unchanged
    }

    // H6: bounded ints (uintN/intN), enums and fixed-point entry params are raw attacker-controlled VM numbers.
    // All VM compares are signed, so a `uint256` param can carry a negative value and defeat accounting guards
    // (e.g. redeem(uint256 amount): -100 <= shares is true, and shares - (-100) inflates shares). Copy the param,
    // range-check it in place, then drop the copy - the original stack value is unchanged (like bounded bytes).
    const loc = { location: node.location, positionHint: PositionHint.START };
    if (effectiveType instanceof IntType) {
      this.emit(Op.OP_PICK, loc);
      this.emitIntBoundsCheck(effectiveType, loc);
      this.emit(Op.OP_DROP, loc);
    } else if (effectiveType instanceof EnumType) {
      this.emit(Op.OP_PICK, loc);
      this.emitEnumBoundsCheck(effectiveType, loc);
      this.emit(Op.OP_DROP, loc);
    } else if (effectiveType instanceof FixedType) {
      this.emit(Op.OP_PICK, loc);
      this.emitFixedBoundsCheck(effectiveType, loc);
      this.emit(Op.OP_DROP, loc);
    }
  }

  shouldEnforceFunctionParameterType(node: ParameterNode): boolean {
    const effectiveType = node.type instanceof ValueType ? node.type.underlyingType : node.type;
    if (effectiveType === PrimitiveType.BOOL) return true;
    if (effectiveType instanceof BytesType && effectiveType.bound !== undefined) return true;
    // H6: range-check bounded ints / enums / fixed-point entry parameters.
    if (effectiveType instanceof IntType) return true;
    if (effectiveType instanceof EnumType) return true;
    if (effectiveType instanceof FixedType) return true;
    return false;
  }

  visitParameter(node: ParameterNode): Node {
    this.pushToStack(node.name, true);
    return node;
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    if (node.expression) {
      node.expression = this.visit(node.expression);
      this.popFromStack();
    } else {
      // Uninitialized declaration: emit the type's zero value (same machinery as `delete`).
      this.emitDefaultValue({ location: node.location, positionHint: PositionHint.END }, node.type);
    }
    this.pushToStack(node.name);
    return node;
  }

  // True for `(a, b) = (b, a)` where a and b are the top two stack entries: one OP_SWAP does it.
  private isTopTwoSwap(node: TupleAssignmentNode): boolean {
    if (!node.tupleExpressions || node.elements.length !== 2) return false;
    const [e0, e1] = node.elements;
    if (!e0.existing || !e1.existing) return false;
    const [r0, r1] = node.tupleExpressions;
    if (!(r0 instanceof IdentifierNode) || !(r1 instanceof IdentifierNode)) return false;
    if (r0.name !== e1.name || r1.name !== e0.name) return false;
    const d0 = this.getStackIndex(e0.name!);
    const d1 = this.getStackIndex(e1.name!);
    return (d0 === 0 && d1 === 1) || (d0 === 1 && d1 === 0);
  }

  visitTupleAssignment(node: TupleAssignmentNode): Node {
    const loc = { location: node.location, positionHint: PositionHint.END };

    // Swap fast-path: exchange the top two stack vars in place, no RHS copy.
    if (this.isTopTwoSwap(node)) {
      this.emit(Op.OP_SWAP, loc);
      return node;
    }

    // Evaluate the RHS, leaving one value per slot on the stack (rightmost slot's value on top).
    if (node.tupleExpressions) {
      node.tupleExpressions = node.tupleExpressions.map((e) => this.visit(e) as ExpressionNode);
    } else {
      node.tuple = this.visit(node.tuple);
    }

    // Existing-lvalue slots: assign each value top-down into its variable's slot; drop skipped values.
    // RHS is fully evaluated first, so swaps and self-references are clobber-safe.
    if (node.elements.some((e) => e.existing)) {
      for (let i = node.elements.length - 1; i >= 0; i -= 1) {
        const elem = node.elements[i];
        if (elem.skip) {
          this.emit(Op.OP_DROP, loc);
        } else {
          this.emitReplace(this.getStackIndex(elem.name!), node);
        }
        this.popFromStack();
      }
      return node;
    }

    // Declaration slots: name the N values in place.
    this.popFromStack(node.elements.length);
    if (!node.elements.some((e) => e.skip)) {
      for (const elem of node.elements) this.pushToStack(elem.name!);
      return node;
    }

    // Skipped slots among declarations: process top-down - declared values to the altstack, skipped
    // values dropped. FROMALTSTACK then restores the declared values in original order to name.
    let declaredCount = 0;
    for (let i = node.elements.length - 1; i >= 0; i -= 1) {
      if (node.elements[i].skip) {
        this.emit(Op.OP_DROP, loc);
      } else {
        this.emit(Op.OP_TOALTSTACK, loc);
        declaredCount += 1;
      }
    }
    for (let i = 0; i < declaredCount; i += 1) this.emit(Op.OP_FROMALTSTACK, loc);
    for (const elem of node.elements) {
      if (!elem.skip) this.pushToStack(elem.name!);
    }
    return node;
  }

  visitAssign(node: AssignNode): Node {
    node.expression = this.visit(node.expression);
    if (this.scopeDepth > 0) {
      this.emitReplace(this.getStackIndex(node.identifier.name), node);
      this.popFromStack();
    } else {
      this.popFromStack();
      this.pushToStack(node.identifier.name);
    }
    return node;
  }

  // `(x op= rhs)` as an expression: perform the assignment (updates x's slot in place), then COPY x back onto
  // the stack as the expression value. Always a copy (OP_PICK) - the var is read, not consumed (it may be used
  // again, e.g. on the next iteration of `while ((x >>= 1) > 0)`).
  visitAssignmentExpression(node: AssignmentExpressionNode): Node {
    this.visit(node.assign);
    const locationData = { location: node.location, positionHint: PositionHint.END };
    this.emit(encodeInt(BigInt(this.getStackIndex(node.assign.identifier.name))), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.pushToStack('(value)');
    return node;
  }

  visitDeleteLocal(node: DeleteLocalNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const type = node.identifier.type!;

    // Emit the default value for this type
    this.emitDefaultValue(locationData, type);
    this.pushToStack('(value)');

    // Replace the variable on the stack (same as visitAssign)
    if (this.scopeDepth > 0) {
      this.emitReplace(this.getStackIndex(node.identifier.name), node);
      this.popFromStack();
    } else {
      this.popFromStack();
      this.pushToStack(node.identifier.name);
    }

    return node;
  }

  // This algorithm can be optimised for hardcoded depths
  // See thesis for explanation
  emitReplace(index: number, node: Node): void {
    if (index <= 0) {
      throw new Error(`emitReplace: index must be >= 1, got ${index}`);
    }

    const locationData = { location: node.location, positionHint: PositionHint.END };

    this.emit(encodeInt(BigInt(index)), locationData);
    this.emit(Op.OP_ROLL, locationData);
    this.emit(Op.OP_DROP, locationData);
    for (let i = 0; i < index - 1; i += 1) {
      this.emit(Op.OP_SWAP, locationData);
      if (i < index - 2) {
        this.emit(Op.OP_TOALTSTACK, locationData);
      }
    }
    for (let i = 0; i < index - 2; i += 1) {
      this.emit(Op.OP_FROMALTSTACK, locationData);
    }
  }

  visitTimeOp(node: TimeOpNode): Node {
    // const countBefore = this.output.length;
    node.expression = this.visit(node.expression);
    this.emit(compileTimeOp(node.timeOp), { location: node.location, positionHint: PositionHint.END });

    this.requires.push({
      // We're removing 1 from the IP because the error message needs to match the OP_XXX_VERIFY, not the OP_DROP that
      // is emitted directly after
      ip: this.getMostRecentInstructionPointer() - 1,
      line: node.location.start.line,
      message: node.message,
    });

    this.popFromStack();
    return node;
  }

  visitRequire(node: RequireNode): Node {
    node.expression = this.visit(node.expression);

    this.emit(Op.OP_VERIFY, { location: node.location, positionHint: PositionHint.END });

    // Custom error args are not evaluated (no revert data on BCH); record the name for tooling.
    this.requires.push({
      ip: this.getMostRecentInstructionPointer(),
      line: node.location.start.line,
      message: node.message ?? (node.errorName ? `require failed: ${node.errorName}(...)` : undefined),
    });

    this.popFromStack();
    return node;
  }

  visitRevert(node: RevertNode): Node {
    // Emit OP_0 OP_VERIFY (unconditional failure)
    this.emit(encodeBool(false), { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(revert)');
    this.emit(Op.OP_VERIFY, { location: node.location, positionHint: PositionHint.END });

    this.requires.push({
      ip: this.getMostRecentInstructionPointer(),
      line: node.location.start.line,
      message: node.message ?? (node.errorName ? `revert ${node.errorName}(...)` : undefined),
    });

    this.popFromStack();
    return node;
  }

  visitAssert(node: AssertNode): Node {
    node.expression = this.visit(node.expression);

    this.emit(Op.OP_VERIFY, { location: node.location, positionHint: PositionHint.END });

    this.requires.push({
      ip: this.getMostRecentInstructionPointer(),
      line: node.location.start.line,
    });

    this.popFromStack();
    return node;
  }

  visitConsoleStatement(node: ConsoleStatementNode): Node {
    // We add a plus 1 to the most recent instruction pointer, because we want to log the state
    // of the stack *after* the most recent instruction has been executed
    const ip = this.getMostRecentInstructionPointer() + 1;
    const { line } = node.location.start;

    const data = node.parameters.map((parameter: ConsoleParameterNode) => {
      if (parameter instanceof IdentifierNode) {
        const symbol = parameter.definition!;

        // If the variable is not on the stack, then we add the final stack usage to the console log
        const stackIndex = this.getStackIndex(parameter.name, true);
        if (stackIndex === -1) {
          if (!this.finalStackUsage[parameter.name]) {
            throw new Error(`Expected variable '${parameter.name}' does not exist on the stack or in final stack usage`);
          }
          return this.finalStackUsage[parameter.name];
        }

        // If the variable is on the stack, we add the stack index and type to the console log
        const type = symbol.type.toString();
        return { stackIndex, type, ip };
      }

      return parameter.toString();
    });

    this.consoleLogs.push({ ip, line, data });

    return node;
  }

  visitBranch(node: BranchNode): Node {
    const ops = node.branchOps;
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // 1. PRE-ALLOCATE before condition evaluation (for branch operations)
    if (ops) {
      // State writes: push encoded current value from input commitment
      for (const key of ops.stateWriteKeys) this.preAllocateStateWrite(key, locationData);

      // Transfers: push OP_0 dummies for lockingBytecode + amount. A branch nested inside another branch's arm
      // skips this: the enclosing (outermost) branch's max-path transferCount already pre-allocated the slots its
      // mutually-exclusive transfers share (semantic index), and its min/max marked their conditionality. Re-
      // pre-allocating here would push an extra slot conditionally, missing at the epilogue.
      if (this.transferPreallocDepth === 0) {
        const transferStartIndex = this.pendingTransfers.length;
        for (let i = 0; i < ops.transferCount; i++) {
          // Find the global transfer index from transferInfos
          const globalIdx = transferStartIndex + i;
          if (!this.preAllocatedTransfers.has(globalIdx)) {
            const lbName = `__internal__transfer_lb_${globalIdx}`;
            const amtName = `__internal__transfer_amt_${globalIdx}`;
            this.emit(encodeInt(0n), locationData);
            this.pushToStack(lbName);
            this.emit(encodeInt(0n), locationData);
            this.pushToStack(amtName);
            this.pendingTransfers.push({
              transferIndex: globalIdx,
              lockingBytecodeStackName: lbName,
              amountStackName: amtName,
            });
            this.preAllocatedTransfers.add(globalIdx);
          }
          // Mark conditional indices (only active in one branch)
          if (i >= ops.minTransferCount) {
            this.conditionalTransferIndices.add(transferStartIndex + i);
          }
        }
      }

      // Emits: push OP_0 dummy for each emit blob
      const emitStartIndex = this.pendingEmits.length;
      for (let i = 0; i < ops.emitCount; i++) {
        const globalIdx = emitStartIndex + i;
        if (!this.preAllocatedEmits.has(globalIdx)) {
          const emitStackName = `__internal__emit_${globalIdx}`;
          this.emit(encodeInt(0n), locationData);
          this.pushToStack(emitStackName);
          this.preAllocatedEmits.add(globalIdx);
          // Note: pendingEmits entry will be populated when the emit is visited
        }
        // Mark conditional indices
        if (i >= ops.minEmitCount) {
          this.conditionalEmitIndices.add(emitStartIndex + i);
        }
      }

      // Token container transfers: push OP_0 dummies for category + args
      const tcTransferStartIndex = this.pendingTokenContainerTransfers.length;
      for (let i = 0; i < ops.tokenContainerTransferCount; i++) {
        const globalIdx = tcTransferStartIndex + i;
        if (!this.preAllocatedTokenContainerTransfers.has(globalIdx)) {
          const catName = `__tc_cat_${globalIdx}`;
          this.emit(encodeInt(0n), locationData);
          this.pushToStack(catName);
          // Push dummy arg slots (transferNft has to + commitment + capability, transfer has to + amount)
          const arg0Name = `__tc_arg_${globalIdx}_0`;
          this.emit(encodeInt(0n), locationData);
          this.pushToStack(arg0Name);
          const arg1Name = `__tc_arg_${globalIdx}_1`;
          this.emit(encodeInt(0n), locationData);
          this.pushToStack(arg1Name);
          const arg2Name = `__tc_arg_${globalIdx}_2`;
          this.emit(encodeInt(0n), locationData);
          this.pushToStack(arg2Name);
          this.preAllocatedTokenContainerTransfers.add(globalIdx);
          // Pre-register in pendingTokenContainerTransfers
          this.pendingTokenContainerTransfers.push({
            transferIndex: globalIdx,
            tokenContainerSlotIndex: -1, // will be updated when visited
            method: 'transfer', // will be updated when visited
            argStackNames: [catName, arg0Name, arg1Name, arg2Name],
          });
        }
        // Mark conditional indices
        if (i >= ops.minTokenContainerTransferCount) {
          this.conditionalTokenContainerTransferIndices.add(tcTransferStartIndex + i);
        }
      }

    }

    // Mapping writes: dynamically scan branch body for slot indices
    // (branchOps.mappingWriteSlots may be empty because entrySlotIndex
    // is assigned after the semantic pass's visitBranch runs)
    const mappingWriteSlots = new Set<number>();
    const mappingDeleteSlots = new Set<number>();
    this.collectMappingSlots(node.ifBlock, mappingWriteSlots, mappingDeleteSlots);
    if (node.elseBlock) this.collectMappingSlots(node.elseBlock, mappingWriteSlots, mappingDeleteSlots);

    for (const slotIndex of mappingWriteSlots) {
      if (!this.preAllocatedEntryWrites.has(slotIndex) && !this.pendingEntryWrites.has(slotIndex)) {
        const keyStackName = `__entry_key_enc_${slotIndex}`;
        const valueStackName = `__entry_value_enc_${slotIndex}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(keyStackName);
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(valueStackName);
        this.pendingEntryWrites.set(slotIndex, { keyStackName, valueStackName });
        this.preAllocatedEntryWrites.add(slotIndex);
      }
    }

    // Conditional mapping deletes -> existence-gated soft-delete writes (see preAllocateCondDeleteWrite).
    for (const slotIndex of mappingDeleteSlots) {
      this.preAllocateCondDeleteWrite(slotIndex, locationData);
    }

    // 2. Evaluate condition and branch (existing logic)
    node.condition = this.visit(node.condition);
    this.popFromStack();

    // Check if we're inside a return-type function AND a branch actually contains a return statement. Only then
    // does visitReturn modify the stack (NIPs out params), needing the save/restore tracker path below. When no
    // branch returns (`if (c) { T local; } return x;`), route through the normal path so a FALL-THROUGH branch's
    // scoped locals are dropped via removeScopedVariables - otherwise they linger in the tracker but not on the
    // not-taken path's real stack, desyncing every later stack read (a not-taken-path-only crash).
    const branchHasReturn = this.blockContainsReturn(node.ifBlock)
      || (!!node.elseBlock && this.blockContainsReturn(node.elseBlock));
    const hasReturnType = (this.currentFunction?.returnTypes?.length > 0) && branchHasReturn;

    // A branch visited inside these blocks is nested: it must not re-pre-allocate transfer slots (see
    // transferPreallocDepth). Bracket the whole if/else emission; restored before returning below.
    this.transferPreallocDepth += 1;
    this.scopeDepth += 1;
    this.emit(Op.OP_IF, { location: node.ifBlock.location, positionHint: PositionHint.START });

    if (hasReturnType) {
      // Save stack state before if-block for restoring before else-block
      const stackBeforeBranch = [...this.stack];
      node.ifBlock = this.visit(node.ifBlock);
      // Capture the stack state after if-block (may include return values)
      const stackAfterIf = [...this.stack];

      // Representative post-branch stack. When one branch aborts via revert its stack is
      // irrelevant (execution never reaches the code after the branch on that path), so the
      // other, falling-through branch is authoritative. This matters after EarlyReturnTransformation
      // nests statements following a `revert` guard into the else branch: emit/return blobs the
      // function-end covenant needs live there, not on the reverting if-block's stack. Otherwise
      // both branches converge (e.g. both return) and the if-block's stack is representative.
      let representative = stackAfterIf;
      if (node.elseBlock) {
        this.emit(Op.OP_ELSE, { location: node.elseBlock.location, positionHint: PositionHint.START });
        // Restore stack for else-block (both branches see same starting state)
        this.stack = [...stackBeforeBranch];
        node.elseBlock = this.visit(node.elseBlock);
        const stackAfterElse = [...this.stack];
        if (this.blockEndsWithRevert(node.ifBlock) && !this.blockEndsWithRevert(node.elseBlock)) {
          representative = stackAfterElse;
        }
      }

      const endLocationData = {
        location: node.elseBlock ? node.elseBlock.location : node.ifBlock.location,
        positionHint: PositionHint.END,
      };
      this.emit(Op.OP_ENDIF, endLocationData);
      this.scopeDepth -= 1;

      this.stack = [...representative];
    } else {
      // Original behavior for non-return branches
      let stackDepth = this.stack.length; // AFTER pre-allocation
      node.ifBlock = this.visit(node.ifBlock);
      this.removeScopedVariables(stackDepth, node.ifBlock);

      if (node.elseBlock) {
        this.emit(Op.OP_ELSE, { location: node.elseBlock.location, positionHint: PositionHint.START });
        stackDepth = this.stack.length;
        node.elseBlock = this.visit(node.elseBlock);
        this.removeScopedVariables(stackDepth, node.elseBlock);
      }

      const endLocationData = {
        location: node.elseBlock ? node.elseBlock.location : node.ifBlock.location,
        positionHint: PositionHint.END,
      };
      this.emit(Op.OP_ENDIF, endLocationData);
      this.scopeDepth -= 1;
    }

    this.transferPreallocDepth -= 1;
    return node;
  }

  /**
   * Whether a block's final (control-flow-relevant) statement aborts via revert, so execution
   * never falls through to code after it. A trailing if/else where both arms revert counts too.
   */
  private blockEndsWithRevert(block: BlockNode): boolean {
    const stmts = (block.statements ?? []).filter((s) => !(s instanceof ConsoleStatementNode));
    if (stmts.length === 0) return false;
    const last = stmts[stmts.length - 1];
    if (last instanceof RevertNode) return true;
    if (last instanceof BranchNode) {
      return this.blockEndsWithRevert(last.ifBlock)
        && !!last.elseBlock && this.blockEndsWithRevert(last.elseBlock);
    }
    return false;
  }

  /**
   * Whether a block contains a return statement ANYWHERE within its own control-flow structure (nested blocks,
   * if/else, loops, switch). A return NIPs the stack, so a branch containing one needs visitBranch's save/restore
   * tracker path rather than plain scoped-local cleanup. Walks ONLY statement/block structure - never expressions
   * or resolvedFunction/functionReference back-pointers (a return in a CALLED function is not this branch's, and
   * following those cycles on a recursive function). A visited guard backstops any residual cycle.
   */
  private blockContainsReturn(node: Node | undefined): boolean {
    const CONTAINER_KEYS = new Set([
      'statements', 'ifBlock', 'elseBlock', 'block', 'body', 'cases', 'defaultCase', 'call',
    ]);
    const visited = new WeakSet<Node>();
    let found = false;
    const walk = (n: Node | undefined): void => {
      if (!n || found || visited.has(n)) return;
      visited.add(n);
      if (n instanceof ReturnNode) { found = true; return; }
      for (const key of CONTAINER_KEYS) {
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) walk(it);
      }
    };
    walk(node);
    return found;
  }

  /**
   * Recursively walk a block's statements to collect mapping slot indices.
   * This is needed because entrySlotIndex is assigned after SymbolTableTraversal's
   * visitBranch runs, so branchOps.mappingWriteSlots may be incomplete.
   */
  private collectMappingSlots(
    block: BlockNode,
    writeSlots: Set<number>,
    deleteSlots: Set<number>,
  ): void {
    if (!block.statements) return;
    for (const stmt of block.statements) {
      if (stmt instanceof MappingAssignNode && stmt.entrySlotIndex >= 0) {
        writeSlots.add(stmt.entrySlotIndex);
      } else if (stmt instanceof MappingFieldAssignNode && stmt.entrySlotIndex >= 0) {
        writeSlots.add(stmt.entrySlotIndex);
      } else if (stmt instanceof MappingDeleteNode && stmt.entrySlotIndex >= 0) {
        deleteSlots.add(stmt.entrySlotIndex);
      } else if (stmt instanceof BranchNode) {
        this.collectMappingSlots(stmt.ifBlock, writeSlots, deleteSlots);
        if (stmt.elseBlock) this.collectMappingSlots(stmt.elseBlock, writeSlots, deleteSlots);
      } else if (stmt instanceof TryCatchNode) {
        this.collectMappingSlots(stmt.tryBlock, writeSlots, deleteSlots);
      } else if (stmt instanceof DoWhileNode || stmt instanceof WhileNode) {
        this.collectMappingSlots(stmt.block, writeSlots, deleteSlots);
      } else if (stmt instanceof CollectionIterationNode) {
        this.collectMappingSlots(stmt.body, writeSlots, deleteSlots);
      } else if (stmt instanceof UncheckedNode) {
        this.collectMappingSlots(stmt.block, writeSlots, deleteSlots);
      } else if (stmt instanceof SwitchNode) {
        for (const c of stmt.cases) this.collectMappingSlots(c.body, writeSlots, deleteSlots);
        if (stmt.defaultCase) this.collectMappingSlots(stmt.defaultCase, writeSlots, deleteSlots);
      }
    }
  }

  /**
   * Recursively walk a block to collect state write keys (nftIndex:fieldIndex).
   */
  private collectStateWriteKeys(block: BlockNode, keys: Set<string>): void {
    if (!block.statements) return;
    for (const stmt of block.statements) {
      if (stmt instanceof StateAssignNode && stmt.stateVariable) {
        keys.add(`${stmt.stateVariable.nftIndex}:${stmt.stateVariable.fieldIndex}`);
      } else if (stmt instanceof DeleteStateNode && stmt.stateVariable) {
        keys.add(`${stmt.stateVariable.nftIndex}:${stmt.stateVariable.fieldIndex}`);
      } else if (
        (stmt instanceof StateArrayPushNode || stmt instanceof StateArrayPopNode
          || stmt instanceof StateArrayAssignNode || stmt instanceof StateArrayDeleteNode)
        && stmt.stateVariable
      ) {
        keys.add(`${stmt.stateVariable.nftIndex}:${stmt.stateVariable.fieldIndex}`);
      } else if (stmt instanceof BranchNode) {
        this.collectStateWriteKeys(stmt.ifBlock, keys);
        if (stmt.elseBlock) this.collectStateWriteKeys(stmt.elseBlock, keys);
      } else if (stmt instanceof TryCatchNode) {
        this.collectStateWriteKeys(stmt.tryBlock, keys);
      } else if (stmt instanceof DoWhileNode || stmt instanceof WhileNode) {
        this.collectStateWriteKeys(stmt.block, keys);
      } else if (stmt instanceof CollectionIterationNode) {
        this.collectStateWriteKeys(stmt.body, keys);
      } else if (stmt instanceof UncheckedNode) {
        this.collectStateWriteKeys(stmt.block, keys);
      } else if (stmt instanceof SwitchNode) {
        for (const c of stmt.cases) this.collectStateWriteKeys(c.body, keys);
        if (stmt.defaultCase) this.collectStateWriteKeys(stmt.defaultCase, keys);
      }
    }
  }

  /**
   * Recursively walk a block to collect transfer indices.
   */
  private collectTransferIndices(block: BlockNode, indices: Set<number>): void {
    if (!block.statements) return;
    for (const stmt of block.statements) {
      if (stmt instanceof TransferStatementNode) {
        indices.add(stmt.transferIndex);
      } else if (stmt instanceof AddressTransferStatementNode) {
        indices.add(stmt.transferIndex);
      } else if (stmt instanceof BranchNode) {
        this.collectTransferIndices(stmt.ifBlock, indices);
        if (stmt.elseBlock) this.collectTransferIndices(stmt.elseBlock, indices);
      } else if (stmt instanceof TryCatchNode) {
        this.collectTransferIndices(stmt.tryBlock, indices);
      } else if (stmt instanceof DoWhileNode || stmt instanceof WhileNode) {
        this.collectTransferIndices(stmt.block, indices);
      } else if (stmt instanceof CollectionIterationNode) {
        this.collectTransferIndices(stmt.body, indices);
      } else if (stmt instanceof UncheckedNode) {
        this.collectTransferIndices(stmt.block, indices);
      } else if (stmt instanceof SwitchNode) {
        for (const c of stmt.cases) this.collectTransferIndices(c.body, indices);
        if (stmt.defaultCase) this.collectTransferIndices(stmt.defaultCase, indices);
      }
    }
  }

  /**
   * Recursively walk a block to collect emit indices.
   */
  private collectEmitIndices(block: BlockNode, indices: Set<number>): void {
    if (!block.statements) return;
    for (const stmt of block.statements) {
      if (stmt instanceof EmitStatementNode) {
        indices.add(stmt.emitIndex);
      } else if (stmt instanceof BranchNode) {
        this.collectEmitIndices(stmt.ifBlock, indices);
        if (stmt.elseBlock) this.collectEmitIndices(stmt.elseBlock, indices);
      } else if (stmt instanceof TryCatchNode) {
        this.collectEmitIndices(stmt.tryBlock, indices);
      } else if (stmt instanceof DoWhileNode || stmt instanceof WhileNode) {
        this.collectEmitIndices(stmt.block, indices);
      } else if (stmt instanceof CollectionIterationNode) {
        this.collectEmitIndices(stmt.body, indices);
      } else if (stmt instanceof UncheckedNode) {
        this.collectEmitIndices(stmt.block, indices);
      } else if (stmt instanceof SwitchNode) {
        for (const c of stmt.cases) this.collectEmitIndices(c.body, indices);
        if (stmt.defaultCase) this.collectEmitIndices(stmt.defaultCase, indices);
      }
    }
  }

  /**
   * Recursively walk a block to collect token container transfer indices.
   */
  private collectTokenContainerTransferIndices(block: BlockNode, indices: Set<number>): void {
    if (!block.statements) return;
    for (const stmt of block.statements) {
      if (stmt instanceof TokenContainerMethodStatementNode) {
        indices.add(stmt.transferIndex);
      } else if (stmt instanceof BranchNode) {
        this.collectTokenContainerTransferIndices(stmt.ifBlock, indices);
        if (stmt.elseBlock) this.collectTokenContainerTransferIndices(stmt.elseBlock, indices);
      } else if (stmt instanceof TryCatchNode) {
        this.collectTokenContainerTransferIndices(stmt.tryBlock, indices);
      } else if (stmt instanceof DoWhileNode || stmt instanceof WhileNode) {
        this.collectTokenContainerTransferIndices(stmt.block, indices);
      } else if (stmt instanceof CollectionIterationNode) {
        this.collectTokenContainerTransferIndices(stmt.body, indices);
      } else if (stmt instanceof UncheckedNode) {
        this.collectTokenContainerTransferIndices(stmt.block, indices);
      } else if (stmt instanceof SwitchNode) {
        for (const c of stmt.cases) this.collectTokenContainerTransferIndices(c.body, indices);
        if (stmt.defaultCase) this.collectTokenContainerTransferIndices(stmt.defaultCase, indices);
      }
    }
  }

  /**
   * Emit opcodes to read a state variable's current value from the input commitment,
   * decode it, and re-encode to pushdata format. Pushes 1 encoded value to the stack.
   * Used for pre-allocating state write slots in branches and loops.
   */
  private emitReadCurrentStateValueEncoded(sv: StateVariableNode, locationData: SingleLocationData): void {
    // Get fields in same NFT, sorted by fieldIndex
    const fieldsInNft = this.stateVariables
      .filter((v) => v.nftIndex === sv.nftIndex)
      .sort((a, b) => a.fieldIndex - b.fieldIndex);

    // Get NFT commitment
    this.emitMasterInputIndex(locationData);
    this.emit(encodeInt(BigInt(this.compactOffsetMap.get(sv.nftIndex)!)), locationData);
    this.emit(Op.OP_ADD, locationData);
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);

    // Track the commitment value on the stack tracker. This is needed because
    // emitPushdataEncode modifies the tracker (popFromStack + pushToStack).
    // Without this entry, it would pop a real variable (e.g. function parameters).
    this.pushToStack('__temp_state_read');

    // Verify the leading nftIndex tag == this field's NFT index (multi-data-NFT anti-substitution, H1)
    if (this.isMultiDataNft()) this.emitNftIndexTagVerify(sv.nftIndex, locationData);

    // Skip preceding fields
    for (let i = 0; i < sv.fieldIndex; i++) {
      this.emitPushdataSkip(this.physicalFieldType(fieldsInNft[i]), locationData);
    }

    // Decode this field
    const isLast = sv.fieldIndex === fieldsInNft[fieldsInNft.length - 1].fieldIndex;
    if (isLast) {
      this.emitPushdataDecodeLastField(sv.type, locationData);
    } else {
      this.emitPushdataDecode(sv.type, locationData);
      this.emit(Op.OP_DROP, locationData); // drop remainder
    }

    // Re-encode to pushdata format
    // emitPushdataEncode replaces the top tracker entry with '(value)'
    this.emitPushdataEncode(sv.type, locationData);
  }

  /**
   * Pre-allocate a dynamic (chunk-backed) state write before a conditional (branch/switch), mirroring the scalar
   * pre-allocation: read the current persisted value (tight bytes) as `__internal__dynwrite_value_<name>` and its
   * uint32 A$len as `__internal__state_write_<name>`, so a not-taken path writes the current value back unchanged
   * (a no-op that co-spends and recreates the same chunks). pendingDynamicWrites is set BEFORE the branch so the
   * write inside it reads this slot (read-modify-write) instead of re-reading, and replaces it in place.
   */
  private preAllocateDynamicWrite(sv: StateVariableNode, key: string, locationData: SingleLocationData): void {
    this.emitReadDynamicScalar(sv, locationData); // pushes '(value)' = current tight value
    const valueStackName = `__internal__dynwrite_value_${sv.name}`;
    this.popFromStack();
    this.pushToStack(valueStackName);

    this.emit(Op.OP_SIZE, locationData); // [value, size] - OP_SIZE leaves value, pushes size
    this.pushToStack('(dynlen)');
    this.emitPushdataEncode(new IntType(false, 32), locationData); // [value, len_encoded]
    this.popFromStack();
    const stateWriteStackName = `__internal__state_write_${sv.name}`;
    this.pushToStack(stateWriteStackName);
    this.pendingStateWrites.set(key, stateWriteStackName);
    this.preAllocatedStateWrites.add(key);

    this.pendingDynamicWrites.set(sv.name, { valueStackName, sv });
    this.preAllocatedDynamicWrites.add(sv.name);
    const writes = (this.currentFunction.dynamicWrites ??= []);
    if (!writes.includes(sv.name)) writes.push(sv.name);
  }

  /**
   * Pre-allocate one state-write slot before a conditional (branch/switch) or loop, so a conditionally-taken or
   * looped write reaches the function epilogue. A chunk-backed (dynamic) array/string reserves a value blob +
   * A$len (preAllocateDynamicWrite, replaced in place by the write); a scalar reserves one encoded commitment
   * field. No-op if already pre-allocated by an enclosing branch/loop.
   */
  private preAllocateStateWrite(key: string, locationData: SingleLocationData): void {
    if (this.pendingStateWrites.has(key)) return;
    const [nftIdx, fieldIdx] = key.split(':').map(Number);
    const sv = this.stateVariables.find((v) => v.nftIndex === nftIdx && v.fieldIndex === fieldIdx)!;
    if (sv.isDynamic) {
      this.preAllocateDynamicWrite(sv, key, locationData);
      return;
    }
    this.emitReadCurrentStateValueEncoded(sv, locationData);
    const stackName = `__internal__state_write_${sv.name}`;
    // emitReadCurrentStateValueEncoded leaves '(value)' on the tracker - rename it
    this.popFromStack();
    this.pushToStack(stackName);
    this.pendingStateWrites.set(key, stackName);
    this.preAllocatedStateWrites.add(key);
  }

  /**
   * Verify the satoshi container's identity: the co-spent input at the container slot is the real container
   * (LBC == expected, rebuilt from the master's category), and its output either preserves that same LBC or is a
   * full drain (0-sat OP_RETURN placeholder). The drain-guard - output value must be 0 on any LBC mismatch -
   * stops a caller from redirecting the container's remaining balance (bounded from below by value conservation)
   * to a foreign address; the container's OWN covenant does NOT protect its output on the master-spend path.
   * Shared by straight-line/conditional (emitValuePreservation) and loop (emitLoopValueContainerConservation)
   * `{value:}` deploys. Net stack/tracker effect: zero.
   */
  private emitSatoshiContainerIdentity(loc: SingleLocationData): void {
    // Build expected satoshi container P2SH32 LBC from master's category.
    this.emitMasterInputIndex(loc);
    this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_DROP, loc);
    this.pushToStack('(__scCat)');
    this.emitSatoshiContainerLbc(loc); // pops '__scCat', pushes expectedLbc
    // DUP: one copy checks the input identity, one the output identity.
    this.emit(Op.OP_DUP, loc);
    this.pushToStack('(__scLbc2)');
    // Input: UTXOBYTECODE[satoshiContainer] == expectedLbc2.
    this.emitBlockSlotIndex('satoshiContainer', undefined, loc);
    this.emit(Op.OP_UTXOBYTECODE, loc);
    this.emit(Op.OP_EQUALVERIFY, loc);
    this.popFromStack(); // remove tracked expectedLbc2
    // Output: OUTPUTBYTECODE[satoshiContainer] == expectedLbc, else require a 0-value (drain) output.
    this.emitBlockSlotIndex('satoshiContainer', undefined, loc);
    this.emit(Op.OP_OUTPUTBYTECODE, loc);
    this.emit(Op.OP_OVER, loc);
    this.emit(Op.OP_EQUAL, loc);
    this.emit(Op.OP_IF, loc);
    this.emit(Op.OP_DROP, loc);            // match: preserved, drop expectedLbc
    this.emit(Op.OP_ELSE, loc);
    this.emit(Op.OP_DROP, loc);            // drop expectedLbc
    this.emitBlockSlotIndex('satoshiContainer', undefined, loc);
    this.emit(Op.OP_OUTPUTVALUE, loc);
    this.emit(encodeInt(0n), loc);
    this.emit(Op.OP_NUMEQUALVERIFY, loc);
    this.emit(Op.OP_ENDIF, loc);
    this.popFromStack(); // remove tracked expectedLbc
  }

  /**
   * Conserve the satoshi container for a loop `new C{value:V}()`: the container is co-spent as the value source,
   * so verify containerInput <= containerOutput + counter*V (counter = children minted = transfers sent, V the
   * per-child value). Emitted after OP_UNTIL while the loop's deploy counter is still on the stack. Mirrors the
   * container check in emitValuePreservation, but with the runtime counter*V sum instead of a fixed list. The
   * container identity (input+output LBC) is verified first so the value bound can't be met by redirecting funds.
   */
  private emitLoopValueContainerConservation(loc: SingleLocationData): void {
    if (!this.loopValueTransferNode) return;
    const counterName = this.inlineDeployCounterName;
    // Container identity + drain-guard (input is the real container; output preserves it or is a 0-sat drain).
    this.emitSatoshiContainerIdentity(loc);
    // containerInput value
    this.emitBlockSlotIndex('satoshiContainer', undefined, loc);
    this.emit(Op.OP_UTXOVALUE, loc);
    this.pushToStack('(sc_in)');
    // containerOutput value
    this.emitBlockSlotIndex('satoshiContainer', undefined, loc);
    this.emit(Op.OP_OUTPUTVALUE, loc);
    this.pushToStack('(sc_out)');
    // counter * V
    this.emit(encodeInt(BigInt(this.getStackIndex(counterName))), loc);
    this.emit(Op.OP_PICK, loc);
    this.pushToStack('(value)');
    this.visit(this.loopValueTransferNode);
    this.emit(Op.OP_MUL, loc);
    this.popFromStack(2);
    this.pushToStack('(value)');
    // containerOutput + counter*V
    this.emit(Op.OP_ADD, loc);
    this.popFromStack(2);
    this.pushToStack('(value)');
    // containerInput <= containerOutput + counter*V
    this.emit(Op.OP_LESSTHANOREQUAL, loc);
    this.popFromStack(2);
    this.pushToStack('(value)');
    this.emit(Op.OP_VERIFY, loc);
    this.popFromStack();
    this.loopValueTransferNode = undefined;
  }

  /**
   * Pre-allocate a conditional (branch/switch) mapping delete as an existence-gated SOFT-DELETE WRITE. The entry
   * keeps an output whether or not the deleting branch runs (stable output count), so an absent-key not-taken path
   * never desyncs the layout. Seed key_enc = the CURRENT INPUT entry commitment and value_enc = empty, so if the
   * branch is NOT taken the covenant reconstructs key_enc CAT value_enc = the input commitment = PRESERVE; a taken
   * `delete` (visitMappingDelete) overwrites key_enc = key, value_enc = default = (key||default) = soft-delete.
   * emitEntryCovenantVerification existence-gates the slot, so an absent entry produces no output.
   */
  private preAllocateCondDeleteWrite(slotIndex: number, locationData: SingleLocationData): void {
    if (this.preAllocatedEntryWrites.has(slotIndex) || this.pendingEntryWrites.has(slotIndex)) return;
    const keyStackName = `__entry_key_enc_${slotIndex}`;
    const valueStackName = `__entry_value_enc_${slotIndex}`;
    this.emitEntryInputIndex(slotIndex, locationData, 0);
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);
    this.pushToStack(keyStackName);
    this.emit(encodeInt(0n), locationData);
    this.pushToStack(valueStackName);
    this.pendingEntryWrites.set(slotIndex, { keyStackName, valueStackName });
    this.preAllocatedEntryWrites.add(slotIndex);
    this.condDeleteSlots.add(slotIndex);
  }

  visitTryCatch(node: TryCatchNode): Node {
    // No-op: evaluate the expression, bind return parameters if present, then emit try block. The catch is dead
    // code on BCH (a script failure is always fatal), so only the try path is emitted.
    this.visit(node.expression);

    if (node.returnParameters && node.returnParameters.length > 0) {
      // `try X returns (T a, ..)`: the call left one value per return parameter; rebind them to the param names.
      for (let i = 0; i < node.returnParameters.length; i++) this.popFromStack();
      for (const param of node.returnParameters) {
        this.pushToStack(param.name);
      }
    } else {
      // No returns clause: drop the call's return values. A VOID external call (e.g. `try this.g(x)` where g
      // returns nothing) leaves nothing on the stack, so drop zero - dropping one unconditionally would remove
      // a caller stack slot (a param/local like __internal__returnOutputIdx) and corrupt the trailing covenant.
      // A void EXTERNAL call carries no `type` at all (it is only set when returnTypes is non-empty), so an
      // undefined type also pushes nothing - dropping on it consumed an unrelated slot (a pending state write,
      // an __extaddr_ address local) and broke the epilogue.
      const type = node.expression.type;
      const dropCount = type instanceof TupleType
        ? type.elements.length
        : type === undefined || type === PrimitiveType.VOID
          ? 0
          : 1;
      for (let i = 0; i < dropCount; i++) {
        this.emit(Op.OP_DROP, { location: node.location, positionHint: PositionHint.START });
        this.popFromStack();
      }
    }

    this.visit(node.tryBlock);
    return node;
  }

  visitCatchClause(_node: CatchClauseNode): Node {
    // No-op: catch blocks produce no bytecode (Bitcoin Script cannot recover from opcode failures)
    if (_node.block.statements && _node.block.statements.length > 0) {
      const line = _node.location ? ` at line ${_node.location.start.line}` : '';
      console.log(`Warning: catch clause${line} is dead code and will be ignored at runtime. Unlike Solidity, `
        + 'Bitcoin Script has no exception recovery: if the try expression fails, the whole transaction '
        + 'is invalid and the catch block never runs.');
    }
    return _node;
  }

  visitDoWhile(node: DoWhileNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // PRE-ALLOCATE: scan loop body and pre-allocate slots before OP_BEGIN

    // State writes: push encoded current value from input commitment
    const stateWriteKeys = new Set<string>();
    this.collectStateWriteKeys(node.block, stateWriteKeys);
    for (const key of stateWriteKeys) this.preAllocateStateWrite(key, locationData);

    // Transfers: push OP_0 dummies for lockingBytecode + amount
    const transferIndices = new Set<number>();
    this.collectTransferIndices(node.block, transferIndices);
    for (const idx of transferIndices) {
      if (!this.preAllocatedTransfers.has(idx)) {
        const lbName = `__internal__transfer_lb_${idx}`;
        const amtName = `__internal__transfer_amt_${idx}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(lbName);
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(amtName);
        this.pendingTransfers.push({
          transferIndex: idx,
          lockingBytecodeStackName: lbName,
          amountStackName: amtName,
        });
        this.preAllocatedTransfers.add(idx);
      }
    }

    // Emits: push OP_0 dummy for each emit blob
    const emitIndices = new Set<number>();
    this.collectEmitIndices(node.block, emitIndices);
    for (const idx of emitIndices) {
      if (!this.preAllocatedEmits.has(idx)) {
        const emitStackName = `__internal__emit_${idx}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(emitStackName);
        this.preAllocatedEmits.add(idx);
      }
    }

    // Token container transfers: push OP_0 dummies for category + args
    const tokenContainerTransferIndices = new Set<number>();
    this.collectTokenContainerTransferIndices(node.block, tokenContainerTransferIndices);
    for (const idx of tokenContainerTransferIndices) {
      if (!this.preAllocatedTokenContainerTransfers.has(idx)) {
        const catName = `__tc_cat_${idx}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(catName);
        const arg0Name = `__tc_arg_${idx}_0`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(arg0Name);
        const arg1Name = `__tc_arg_${idx}_1`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(arg1Name);
        const arg2Name = `__tc_arg_${idx}_2`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(arg2Name);
        this.preAllocatedTokenContainerTransfers.add(idx);
        this.pendingTokenContainerTransfers.push({
          transferIndex: idx,
          tokenContainerSlotIndex: -1,
          method: 'transfer',
          argStackNames: [catName, arg0Name, arg1Name, arg2Name],
        });
      }
    }

    // Mapping writes/deletes: dynamically scan loop body for slot indices
    const mappingWriteSlots = new Set<number>();
    const mappingDeleteSlots = new Set<number>();
    this.collectMappingSlots(node.block, mappingWriteSlots, mappingDeleteSlots);

    for (const slotIndex of mappingWriteSlots) {
      // Loop-write entries emit a runtime counter-indexed trailing output per iteration (emitLoopEntryWrite);
      // they have no fixed block slot, so must not be pre-allocated into the fixed-slot epilogue write path.
      if (this.entrySlots?.[slotIndex]?.inLoop) continue;
      if (!this.preAllocatedEntryWrites.has(slotIndex) && !this.pendingEntryWrites.has(slotIndex)) {
        const keyStackName = `__entry_key_enc_${slotIndex}`;
        const valueStackName = `__entry_value_enc_${slotIndex}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(keyStackName);
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(valueStackName);
        this.pendingEntryWrites.set(slotIndex, { keyStackName, valueStackName });
        this.preAllocatedEntryWrites.add(slotIndex);
      }
    }

    for (const slotIndex of mappingDeleteSlots) {
      if (!this.preAllocatedEntryDeletes.has(slotIndex)) {
        this.pendingEntryDeletes.add(slotIndex);
        this.preAllocatedEntryDeletes.add(slotIndex);
      }
    }

    // Loop deploy: push the runtime deploy counter (deploys-fired-so-far = 0) before OP_BEGIN so it persists
    // across iterations; the inline genesis verification indexes by it and increments it each iteration.
    const loopHasDeploy = countInstantiationDeploySites(node.block) > 0 && !this.inlineDeployActive;
    if (loopHasDeploy) {
      this.emit(encodeInt(0n), locationData);
      this.pushToStack(this.inlineDeployCounterName);
      this.inlineDeployActive = true;
    }

    // C2 diff-key insert loop: precompute the sorted entry NFT address + counter BEFORE OP_BEGIN (each iteration
    // co-spends the bracketing predecessor + mints one NEW node). Takes precedence over the default entry-mint loop.
    const loopHasSortedInsert = this.emitSortedInsertLoopSetup(node.block, locationData);
    // C2 per-iteration UPDATE loop `for(i) m[k[i]] += v[i]` (multitransfer credit): co-spend k[i]'s entry + mint updated.
    const loopHasSortedUpsert = !loopHasSortedInsert && this.emitSortedUpsertLoopSetup(node.block, locationData);
    // Loop mapping write: precompute the entry NFT address + a runtime counter BEFORE OP_BEGIN (see visitWhile).
    const loopHasEntryWrite = !loopHasSortedInsert && !loopHasSortedUpsert
      && this.emitLoopEntryWriteSetup(node.block, locationData);
    // Dynamic keccak loop: push a 0-based side-car counter BEFORE OP_BEGIN (trailing-region read per iteration).
    const loopHasKeccak = this.emitLoopKeccakSetup(node.block, locationData);

    // EXISTING LOOP LOGIC (with pre-allocated slots now below stackDepth)
    this.scopeDepth += 1;
    this.emit(Op.OP_BEGIN, { location: node.location, positionHint: PositionHint.START });

    const stackDepth = this.stack.length;
    this.plainLoopDepth += 1;
    node.block = this.visit(node.block);
    this.plainLoopDepth -= 1;
    this.removeScopedVariables(stackDepth, node.block);

    node.condition = this.visit(node.condition);
    this.emit(Op.OP_NOT, { location: node.location, positionHint: PositionHint.END });

    this.emit(Op.OP_UNTIL, { location: node.location, positionHint: PositionHint.END });
    this.popFromStack();

    // Conserve the satoshi container for a loop {value:} deploy (counter still on the stack), then drop the
    // runtime deploy counter now the loop is done (it lives below the per-iteration working area).
    if (loopHasDeploy) {
      this.emitLoopValueContainerConservation({ location: node.location, positionHint: PositionHint.END });
      this.emit(Op.OP_DROP, { location: node.location, positionHint: PositionHint.END });
      this.popFromStack();
      this.inlineDeployActive = false;
    }

    // Pin the entry-output count + drop the loop mapping-write temps now the loop is done.
    if (loopHasEntryWrite) {
      this.emitLoopEntryWriteTeardown({ location: node.location, positionHint: PositionHint.END });
    }
    // Pin the predecessor-input + entry-output counts, drop the sorted insert-loop temps.
    if (loopHasSortedInsert) {
      this.emitSortedInsertLoopTeardown({ location: node.location, positionHint: PositionHint.END });
    }
    // Pin the entry input/output counts (== N updates), drop the upsert-loop temps.
    if (loopHasSortedUpsert) {
      this.emitSortedUpsertLoopTeardown({ location: node.location, positionHint: PositionHint.END });
    }
    // Drop the dynamic keccak loop counter now the loop is done.
    if (loopHasKeccak) {
      this.emitLoopKeccakTeardown({ location: node.location, positionHint: PositionHint.END });
    }

    this.scopeDepth -= 1;

    return node;
  }

  visitWhile(node: WhileNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // PRE-ALLOCATE: same as visitDoWhile - scan loop body and pre-allocate slots before OP_BEGIN

    const stateWriteKeys = new Set<string>();
    this.collectStateWriteKeys(node.block, stateWriteKeys);
    for (const key of stateWriteKeys) this.preAllocateStateWrite(key, locationData);

    const transferIndices = new Set<number>();
    this.collectTransferIndices(node.block, transferIndices);
    for (const idx of transferIndices) {
      if (!this.preAllocatedTransfers.has(idx)) {
        const lbName = `__internal__transfer_lb_${idx}`;
        const amtName = `__internal__transfer_amt_${idx}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(lbName);
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(amtName);
        this.pendingTransfers.push({
          transferIndex: idx,
          lockingBytecodeStackName: lbName,
          amountStackName: amtName,
        });
        this.preAllocatedTransfers.add(idx);
      }
    }

    const emitIndices = new Set<number>();
    this.collectEmitIndices(node.block, emitIndices);
    for (const idx of emitIndices) {
      if (!this.preAllocatedEmits.has(idx)) {
        const emitStackName = `__internal__emit_${idx}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(emitStackName);
        this.preAllocatedEmits.add(idx);
      }
    }

    const tokenContainerTransferIndices = new Set<number>();
    this.collectTokenContainerTransferIndices(node.block, tokenContainerTransferIndices);
    for (const idx of tokenContainerTransferIndices) {
      if (!this.preAllocatedTokenContainerTransfers.has(idx)) {
        const catName = `__tc_cat_${idx}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(catName);
        const arg0Name = `__tc_arg_${idx}_0`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(arg0Name);
        const arg1Name = `__tc_arg_${idx}_1`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(arg1Name);
        const arg2Name = `__tc_arg_${idx}_2`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(arg2Name);
        this.preAllocatedTokenContainerTransfers.add(idx);
        this.pendingTokenContainerTransfers.push({
          transferIndex: idx,
          tokenContainerSlotIndex: -1,
          method: 'transfer',
          argStackNames: [catName, arg0Name, arg1Name, arg2Name],
        });
      }
    }

    const mappingWriteSlots = new Set<number>();
    const mappingDeleteSlots = new Set<number>();
    this.collectMappingSlots(node.block, mappingWriteSlots, mappingDeleteSlots);

    for (const slotIndex of mappingWriteSlots) {
      // Loop-write entries emit a runtime-counter-indexed trailing output per iteration (emitLoopEntryWrite); they
      // have no fixed block slot, so must not be pre-allocated into the fixed-slot epilogue write path.
      if (this.entrySlots?.[slotIndex]?.inLoop) continue;
      if (!this.preAllocatedEntryWrites.has(slotIndex) && !this.pendingEntryWrites.has(slotIndex)) {
        const keyStackName = `__entry_key_enc_${slotIndex}`;
        const valueStackName = `__entry_value_enc_${slotIndex}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(keyStackName);
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(valueStackName);
        this.pendingEntryWrites.set(slotIndex, { keyStackName, valueStackName });
        this.preAllocatedEntryWrites.add(slotIndex);
      }
    }

    for (const slotIndex of mappingDeleteSlots) {
      if (!this.preAllocatedEntryDeletes.has(slotIndex)) {
        this.pendingEntryDeletes.add(slotIndex);
        this.preAllocatedEntryDeletes.add(slotIndex);
      }
    }

    // Loop deploy: push the runtime deploy counter (deploys-fired-so-far = 0) BEFORE OP_BEGIN so it persists
    // across iterations; the inline genesis verification indexes by it and increments it each iteration.
    const loopHasDeploy = countInstantiationDeploySites(node.block) > 0 && !this.inlineDeployActive;
    if (loopHasDeploy) {
      this.emit(encodeInt(0n), locationData);
      this.pushToStack(this.inlineDeployCounterName);
      this.inlineDeployActive = true;
    }

    // C2 diff-key insert loop: precompute the sorted entry NFT address + counter BEFORE OP_BEGIN (takes precedence).
    const loopHasSortedInsert = this.emitSortedInsertLoopSetup(node.block, locationData);
    // C2 per-iteration UPDATE loop `for(i) m[k[i]] += v[i]` (multitransfer credit): co-spend k[i]'s entry + mint updated.
    const loopHasSortedUpsert = !loopHasSortedInsert && this.emitSortedUpsertLoopSetup(node.block, locationData);
    // Loop mapping write: precompute the entry NFT address + a runtime counter (entries-written-so-far) BEFORE
    // OP_BEGIN; emitLoopEntryWrite verifies + increments per iteration, the teardown pins the entry-output count.
    const loopHasEntryWrite = !loopHasSortedInsert && !loopHasSortedUpsert
      && this.emitLoopEntryWriteSetup(node.block, locationData);
    // Dynamic keccak loop: push a 0-based side-car counter BEFORE OP_BEGIN (trailing-region read per iteration).
    const loopHasKeccak = this.emitLoopKeccakSetup(node.block, locationData);

    // WHILE LOOP LOGIC
    // while(cond) { body } ->
    //   OP_BEGIN
    //     condition OP_IF body OP_0 OP_ELSE OP_1 OP_ENDIF
    //   OP_UNTIL
    this.scopeDepth += 1;
    this.emit(Op.OP_BEGIN, locationData);

    // Evaluate condition
    node.condition = this.visit(node.condition);
    this.popFromStack(); // condition consumed by OP_IF

    this.emit(Op.OP_IF, locationData);

    // If condition is true: execute body, then push 0 (continue looping)
    const stackBeforeBody = [...this.stack];
    const stackDepth = this.stack.length;
    this.plainLoopDepth += 1;
    node.block = this.visit(node.block);
    this.plainLoopDepth -= 1;
    this.removeScopedVariables(stackDepth, node.block);
    this.emit(encodeBool(false), { location: node.location, positionHint: PositionHint.END });
    this.pushToStack('(loop_continue)');

    this.emit(Op.OP_ELSE, { location: node.location, positionHint: PositionHint.END });

    // If condition is false: push 1 (exit loop)
    this.stack = [...stackBeforeBody];
    this.emit(encodeBool(true), { location: node.location, positionHint: PositionHint.END });
    this.pushToStack('(loop_exit)');

    this.emit(Op.OP_ENDIF, { location: node.location, positionHint: PositionHint.END });

    this.emit(Op.OP_UNTIL, { location: node.location, positionHint: PositionHint.END });
    this.popFromStack();

    // Conserve the satoshi container for a loop {value:} deploy (counter still on the stack), then drop the
    // runtime deploy counter now the loop is done (it lives below the per-iteration working area).
    if (loopHasDeploy) {
      this.emitLoopValueContainerConservation({ location: node.location, positionHint: PositionHint.END });
      this.emit(Op.OP_DROP, { location: node.location, positionHint: PositionHint.END });
      this.popFromStack();
      this.inlineDeployActive = false;
    }

    // Pin the entry-output count + drop the loop mapping-write temps now the loop is done.
    if (loopHasEntryWrite) {
      this.emitLoopEntryWriteTeardown({ location: node.location, positionHint: PositionHint.END });
    }
    // Pin the predecessor-input + entry-output counts, drop the sorted insert-loop temps.
    if (loopHasSortedInsert) {
      this.emitSortedInsertLoopTeardown({ location: node.location, positionHint: PositionHint.END });
    }
    // Pin the entry input/output counts (== N updates), drop the upsert-loop temps.
    if (loopHasSortedUpsert) {
      this.emitSortedUpsertLoopTeardown({ location: node.location, positionHint: PositionHint.END });
    }
    // Drop the dynamic keccak loop counter now the loop is done.
    if (loopHasKeccak) {
      this.emitLoopKeccakTeardown({ location: node.location, positionHint: PositionHint.END });
    }

    this.scopeDepth -= 1;

    return node;
  }

  visitCollectionIteration(node: CollectionIterationNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };
    const endLocationData = { location: node.location, positionHint: PositionHint.END };
    const iterIdx = node.collectionIterationIndex;
    const collection = node.collection!;
    const allKeyTypes = collection.allKeyTypes;

    // PRE-ALLOCATE: same as visitDoWhile/visitWhile - scan body for mutations
    const stateWriteKeys = new Set<string>();
    this.collectStateWriteKeys(node.body, stateWriteKeys);
    for (const key of stateWriteKeys) this.preAllocateStateWrite(key, locationData);

    const transferIndices = new Set<number>();
    this.collectTransferIndices(node.body, transferIndices);
    for (const idx of transferIndices) {
      if (!this.preAllocatedTransfers.has(idx)) {
        const lbName = `__internal__transfer_lb_${idx}`;
        const amtName = `__internal__transfer_amt_${idx}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(lbName);
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(amtName);
        this.pendingTransfers.push({
          transferIndex: idx,
          lockingBytecodeStackName: lbName,
          amountStackName: amtName,
        });
        this.preAllocatedTransfers.add(idx);
      }
    }

    const emitIndices = new Set<number>();
    this.collectEmitIndices(node.body, emitIndices);
    for (const idx of emitIndices) {
      if (!this.preAllocatedEmits.has(idx)) {
        const emitStackName = `__internal__emit_${idx}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(emitStackName);
        this.preAllocatedEmits.add(idx);
      }
    }

    const tokenContainerTransferIndices = new Set<number>();
    this.collectTokenContainerTransferIndices(node.body, tokenContainerTransferIndices);
    for (const idx of tokenContainerTransferIndices) {
      if (!this.preAllocatedTokenContainerTransfers.has(idx)) {
        const catName = `__tc_cat_${idx}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(catName);
        const arg0Name = `__tc_arg_${idx}_0`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(arg0Name);
        const arg1Name = `__tc_arg_${idx}_1`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(arg1Name);
        const arg2Name = `__tc_arg_${idx}_2`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(arg2Name);
        this.preAllocatedTokenContainerTransfers.add(idx);
        this.pendingTokenContainerTransfers.push({
          transferIndex: idx,
          tokenContainerSlotIndex: -1,
          method: 'transfer',
          argStackNames: [catName, arg0Name, arg1Name, arg2Name],
        });
      }
    }

    const mappingWriteSlots = new Set<number>();
    const mappingDeleteSlots = new Set<number>();
    this.collectMappingSlots(node.body, mappingWriteSlots, mappingDeleteSlots);
    for (const slotIndex of mappingWriteSlots) {
      if (!this.preAllocatedEntryWrites.has(slotIndex) && !this.pendingEntryWrites.has(slotIndex)) {
        const keyStackName = `__entry_key_enc_${slotIndex}`;
        const valueStackName = `__entry_value_enc_${slotIndex}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(keyStackName);
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(valueStackName);
        this.pendingEntryWrites.set(slotIndex, { keyStackName, valueStackName });
        this.preAllocatedEntryWrites.add(slotIndex);
      }
    }
    for (const slotIndex of mappingDeleteSlots) {
      if (!this.preAllocatedEntryDeletes.has(slotIndex)) {
        this.pendingEntryDeletes.add(slotIndex);
        this.preAllocatedEntryDeletes.add(slotIndex);
      }
    }

    // SORTED (enumerable) collection: trustless LINKAGE-completeness iteration (co-spend HEAD sentinel, walk
    // nextKey to the tail). VALUES exposes the value tail; KEYS/ENTRIES additionally verify each caller-supplied
    // key against the entry's slot=H(key) (the raw key is not on-chain). See emitSortedIterationLinkage.
    if (collection.sorted) {
      this.emitSortedIterationLinkage(node, iterIdx, locationData, endLocationData);
      return node;
    }

    // Push loop counter: int i = 0
    this.emit(encodeInt(0n), locationData);
    this.pushToStack('(__iter_i)');

    // LOOP: OP_BEGIN / condition / OP_IF / body + incr + OP_0 / OP_ELSE / OP_1 / OP_ENDIF / OP_UNTIL
    this.scopeDepth += 1;
    this.emit(Op.OP_BEGIN, locationData);

    // --- Condition: i < _collectionIterCount_<N> ---
    const iIdx = this.getStackIndex('(__iter_i)');
    this.emit(encodeInt(BigInt(iIdx)), locationData);
    this.emit(Op.OP_PICK, locationData);
    const countIdx = this.getStackIndex(`__internal__collectionIterCount_${iterIdx}`);
    this.emit(encodeInt(BigInt(countIdx + 1)), locationData); // +1 for picked i
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    // Note: condition ops are untracked (manual OP_PICK), so no popFromStack needed.
    // OP_IF consumes the untracked boolean result.

    this.emit(Op.OP_IF, locationData);

    // --- If true: compute input index, read commitment, decode key/value, run body ---
    const stackBeforeBody = [...this.stack];
    const stackDepth = this.stack.length;

    // Compute entry input index for iteration entry i:
    // inputIndex = OP_INPUTINDEX + entryInputBase + totalEntrySlots + sum(prior iter counts) + i
    this.emitCollectionIterInputIndex(iterIdx, locationData);
    // Stack: [..., inputIndex] (1 untracked value)

    // Read commitment from input
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);
    // Stack: [..., commitment_blob] (1 untracked)

    // Decode key(s) and/or value from commitment
    if (node.mode === CollectionIterationMode.ENTRIES) {
      // Decode all key levels, then last field is value.
      // emitPushdataDecode consumes top-of-stack blob and produces [decoded, remainder]
      // with remainder on top - so the next decode naturally consumes the remainder.
      for (let k = 0; k < allKeyTypes.length; k++) {
        this.emitPushdataDecode(allKeyTypes[k], locationData);
        // Stack: [..., key_0, ..., decoded_key_k, remainder_k]
      }
      // Stack: [..., key_0, key_1, ..., key_{N-1}, remainder]
      // We only expose the outermost key as the loop variable.
      // Drop intermediate keys if nested mapping (keep first key, drop rest).
      // Use OP_NIP to remove the item below top (preserving remainder on top).
      if (allKeyTypes.length > 1) {
        for (let k = allKeyTypes.length - 1; k > 0; k--) {
          this.emit(Op.OP_NIP, locationData); // remove key_k from below remainder
        }
      }
      // Stack: [..., key_0, remainder]
      // Remainder is already on top - decode value directly
      this.emitPushdataDecodeLastField(collection.innermostValueType, locationData);
      // Stack: [..., key_0, value]
      this.pushToStack(node.valueName!);
      this.pushToStack(node.keyName!);
      // Tracked stack: [keyName, valueName, ...]
    } else if (node.mode === CollectionIterationMode.KEYS) {
      // Decode first key only, drop remainder
      this.emitPushdataDecode(allKeyTypes[0], locationData);
      // Stack: [..., decoded_key, remainder]
      this.emit(Op.OP_NIP, locationData);
      // Stack: [..., decoded_key]
      this.pushToStack(node.keyName!);
    } else {
      // VALUES mode: skip all keys, decode value
      for (const keyType of allKeyTypes) {
        this.emitPushdataSkip(keyType, locationData);
      }
      // Stack: [..., value_blob]
      this.emitPushdataDecodeLastField(collection.innermostValueType, locationData);
      // Stack: [..., decoded_value]
      this.pushToStack(node.valueName!);
    }

    // Visit loop body
    node.body = this.visit(node.body);

    // Clean up loop variables from stack
    this.removeScopedVariables(stackDepth, node.body);

    // Increment counter: i = i + 1
    const iIdx2 = this.getStackIndex('(__iter_i)');
    this.emit(encodeInt(BigInt(iIdx2)), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_1ADD, locationData);
    this.emitReplace(this.getStackIndex('(__iter_i)') + 1, node);
    this.popFromStack(); // pop the picked+incremented value after replace

    // Continue loop (push false = 0)
    this.emit(encodeBool(false), endLocationData);
    this.pushToStack('(loop_continue)');

    this.emit(Op.OP_ELSE, endLocationData);

    // Exit loop (push true = 1)
    this.stack = [...stackBeforeBody];
    this.emit(encodeBool(true), endLocationData);
    this.pushToStack('(loop_exit)');

    this.emit(Op.OP_ENDIF, endLocationData);

    this.emit(Op.OP_UNTIL, endLocationData);
    this.popFromStack(); // pop loop result

    this.scopeDepth -= 1;

    // Clean up loop counter
    const iIdxFinal = this.getStackIndex('(__iter_i)');
    this.emit(encodeInt(BigInt(iIdxFinal)), endLocationData);
    this.emit(Op.OP_ROLL, endLocationData);
    this.emit(Op.OP_DROP, endLocationData);
    this.removeFromStack(iIdxFinal);

    return node;
  }

  // Trustless iteration over a SORTED (enumerable / C2) mapping by LINKAGE completeness. The SDK co-spends the
  // HEAD sentinel (slot 0) then the entries in ascending slot order; the covenant co-spends HEAD and walks the
  // nextKey chain to the tail (nextKey == 0), verifying per entry that (a) its input bytecode is the collection's
  // entry address (a real entry - no substitution) and (b) its slot == the previous nextKey (contiguity - a
  // skipped/omitted entry breaks the chain). Completeness is enforced with no trusted count. VALUES exposes the
  // value tail. KEYS/ENTRIES additionally consume a caller-supplied key from the injected keys blob and verify
  // keyToSlot(key) == the entry's slot (the raw key is not stored on-chain - a wrong/forged key reverts).
  private emitSortedIterationLinkage(
    node: CollectionIterationNode, iterIdx: number,
    locationData: SingleLocationData, endLocationData: SingleLocationData,
  ): void {
    const collection = node.collection!;
    const mode = node.mode;
    const needsKeys = mode !== CollectionIterationMode.VALUES; // KEYS or ENTRIES
    const needsValue = mode !== CollectionIterationMode.KEYS; // VALUES or ENTRIES
    const valueType = collection.innermostValueType;
    const valueKind = this.sortedValueKind(valueType);
    if (needsValue && valueKind === null) {
      throw new SortedMappingCodegenPendingError(node as unknown as MappingAccessNode, collection.name);
    }
    if (needsKeys && collection.allKeyTypes.length !== 1) {
      // The caller-supplied keys blob is a flat sequence of length-prefixed keys (single key per entry). A
      // composite/nested key (mapping(a => mapping(b => v))) hashes keyToSlotMulti and has no single preimage to
      // length-prefix, so it is not iterable with keys.
      throw new Error(`Iterating keys/entries of a sorted 'enumerable mapping' ('${collection.name}') supports a `
        + 'single key only (composite/nested keys have no single preimage to verify).');
    }
    const collectionHash = computeCollectionHash(computeCollectionSignature(collection.name, collection.type.toString()));
    const ZERO32 = new Uint8Array(32);

    // 1. Entry address (constant for the collection) -> tracked, reused per entry (the address pin below).
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.emit(encodeInt(32n), locationData); this.emit(Op.OP_SPLIT, locationData); this.emit(Op.OP_DROP, locationData);
    this.pushToStack('(__iter_entryaddr)');
    this.emitP2sh32FromCovenant((cat) => buildEntryNftCovenantScript(cat, collectionHash), locationData);
    this.popFromStack(); // emitP2sh32FromCovenant re-tracks the address as '(value)'; relabel it.
    this.pushToStack('(__iter_entryaddr)');

    // 2. i = 0 (input offset). HEAD is at base+0, entries at base+1..N.
    this.emit(encodeInt(0n), locationData);
    this.pushToStack('(__iter_i)');

    // 3. HEAD @ base+0: pin + split -> tracked [__ent_slot,__ent_next,__ent_value]; verify slot == 0; keep
    // nextKey as the persistent expectedNext '(__iter_next)'.
    this.emitSortedIterEntryCommitment(iterIdx, locationData);
    this.emit(encodeInt(BigInt(this.getStackIndex('(__ent_slot)'))), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(ZERO32, locationData);
    this.emit(Op.OP_EQUALVERIFY, locationData); // HEAD.slot == 0
    this.emit(encodeInt(BigInt(this.getStackIndex('(__ent_next)'))), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.pushToStack('(__iter_next)'); // expectedNext = HEAD.nextKey (persists across iterations)
    this.removeScopedEntryTemps(node);

    // i = 1 (HEAD consumed; entries start at base+1)
    this.emit(encodeInt(BigInt(this.getStackIndex('(__iter_i)'))), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_1ADD, locationData);
    this.pushToStack('(__iter_tmp)'); // track the new value so emitReplace/popFromStack reconcile at any depth
    this.emitReplace(this.getStackIndex('(__iter_i)'), node);
    this.popFromStack();

    // KEYS/ENTRIES: copy the caller-supplied keys blob to a loop-carried slot (consumed keyWidth bytes per entry).
    if (needsKeys) {
      this.emit(encodeInt(BigInt(this.getStackIndex(`__internal__collectionIterKeys_${iterIdx}`))), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(__iter_keys)');
    }

    // 4. LOOP: while expectedNext != 0 (not the tail).
    this.scopeDepth += 1;
    this.emit(Op.OP_BEGIN, locationData);
    this.emit(encodeInt(BigInt(this.getStackIndex('(__iter_next)'))), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_BIN2NUM, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_GREATERTHAN, locationData); // expectedNext > 0 (masked slots are positive)
    this.emit(Op.OP_IF, locationData);

    const stackBeforeBody = [...this.stack];
    const stackDepth = this.stack.length;

    // Read entry @ base+i -> tracked [__ent_slot,__ent_next,__ent_value].
    this.emitSortedIterEntryCommitment(iterIdx, locationData);
    // Contiguity: __ent_slot == expectedNext (omission -> mismatch -> revert).
    this.emit(encodeInt(BigInt(this.getStackIndex('(__ent_slot)'))), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(encodeInt(BigInt(this.getStackIndex('(__iter_next)') + 1)), locationData); // +1 for the picked slot
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_EQUALVERIFY, locationData);
    // expectedNext = this entry's nextKey (before the body, so it survives).
    this.emit(encodeInt(BigInt(this.getStackIndex('(__ent_next)'))), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.pushToStack('(__iter_tmp)'); // track the copy so emitReplace/popFromStack reconcile at any depth
    this.emitReplace(this.getStackIndex('(__iter_next)'), node);
    this.popFromStack();
    // KEYS/ENTRIES: consume one length-prefixed key (1-byte length ++ key bytes) from the blob, verify
    // keyToSlot(key) == this entry's slot, and expose it. A forged/wrong/omitted key hashes to a different slot ->
    // EQUALVERIFY reverts. The length prefix supports variable-width keys (int, address) as well as bytesN.
    if (needsKeys) {
      const kIdx = this.getStackIndex('(__iter_keys)');
      this.emit(encodeInt(BigInt(kIdx)), locationData); this.emit(Op.OP_ROLL, locationData); // blob -> top
      this.removeFromStack(kIdx);
      this.emit(encodeInt(1n), locationData); this.emit(Op.OP_SPLIT, locationData); // [lenByte, rest1]
      this.emit(Op.OP_SWAP, locationData); this.emit(Op.OP_BIN2NUM, locationData); // [rest1, len]
      this.emit(Op.OP_SPLIT, locationData); // [key, rest]  (split rest1 at len)
      this.pushToStack('(__ent_key)'); // deeper = key
      this.pushToStack('(__iter_keys)'); // top = rest (re-tracked for the next entry)
      this.emit(encodeInt(BigInt(this.getStackIndex('(__ent_key)'))), locationData); this.emit(Op.OP_PICK, locationData);
      this.emit(Op.OP_SHA256, locationData);
      this.emit(encodeInt(31n), locationData); this.emit(Op.OP_SPLIT, locationData);
      this.emit(new Uint8Array([0x7f]), locationData); this.emit(Op.OP_AND, locationData); this.emit(Op.OP_CAT, locationData);
      this.emit(encodeInt(BigInt(this.getStackIndex('(__ent_slot)') + 1)), locationData); this.emit(Op.OP_PICK, locationData);
      this.emit(Op.OP_EQUALVERIFY, locationData); // keyToSlot(key) == slot
    }

    // Expose loop variables. ENTRIES wants [keyName, valueName] with keyName on top (matches non-sorted).
    if (needsValue) {
      this.emit(encodeInt(BigInt(this.getStackIndex('(__ent_value)'))), locationData);
      this.emit(Op.OP_PICK, locationData);
      if (valueKind === 'int') this.emit(Op.OP_BIN2NUM, locationData);
      this.pushToStack(node.valueName!);
    }
    if (needsKeys) {
      this.emit(encodeInt(BigInt(this.getStackIndex('(__ent_key)'))), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack(node.keyName!);
    }
    this.removeScopedEntryTemps(node);

    node.body = this.visit(node.body);
    this.removeScopedVariables(stackDepth, node.body);

    // i++
    this.emit(encodeInt(BigInt(this.getStackIndex('(__iter_i)'))), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_1ADD, locationData);
    this.pushToStack('(__iter_tmp)'); // track the new value so emitReplace/popFromStack reconcile at any depth
    this.emitReplace(this.getStackIndex('(__iter_i)'), node);
    this.popFromStack();

    this.emit(encodeBool(false), endLocationData);
    this.pushToStack('(loop_continue)');
    this.emit(Op.OP_ELSE, endLocationData);
    this.stack = [...stackBeforeBody];
    this.emit(encodeBool(true), endLocationData);
    this.pushToStack('(loop_exit)');
    this.emit(Op.OP_ENDIF, endLocationData);
    this.emit(Op.OP_UNTIL, endLocationData);
    this.popFromStack();
    this.scopeDepth -= 1;

    // Clean up loop-carried slots (keys blob copy, if any, then expectedNext, i, entryAddr).
    const cleanup = needsKeys
      ? ['(__iter_keys)', '(__iter_next)', '(__iter_i)', '(__iter_entryaddr)']
      : ['(__iter_next)', '(__iter_i)', '(__iter_entryaddr)'];
    for (const name of cleanup) {
      const idx = this.getStackIndex(name);
      this.emit(encodeInt(BigInt(idx)), endLocationData);
      this.emit(Op.OP_ROLL, endLocationData);
      this.emit(Op.OP_DROP, endLocationData);
      this.removeFromStack(idx);
    }
  }

  // Read the entry NFT at input base+i (i = '(__iter_i)'), PIN it to the collection's entry address (a real
  // entry - closes substitution), and split its commitment -> tracked [__ent_slot,__ent_next,__ent_value].
  private emitSortedIterEntryCommitment(iterIdx: number, loc: SingleLocationData): void {
    this.emitCollectionIterInputIndex(iterIdx, loc); // [.., idx] (untracked)
    this.emit(Op.OP_DUP, loc);
    this.emit(Op.OP_UTXOBYTECODE, loc); // [.., idx, inbc]
    this.emit(encodeInt(BigInt(this.getStackIndex('(__iter_entryaddr)') + 2)), loc); // +2 untracked (idx, inbc)
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_EQUALVERIFY, loc); // inbc == entryAddr
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, loc); // [.., commit]
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); // [.., slot, rest]
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); // [.., slot, next, value]
    this.pushToStack('(__ent_slot)');
    this.pushToStack('(__ent_next)');
    this.pushToStack('(__ent_value)');
  }

  // Drop the per-entry commitment temps (each ROLL index is recomputed, so order is immaterial). __ent_key is
  // present only for KEYS/ENTRIES iteration.
  private removeScopedEntryTemps(node: Node): void {
    const loc = { location: node.location, positionHint: PositionHint.START };
    for (const name of ['(__ent_key)', '(__ent_value)', '(__ent_next)', '(__ent_slot)']) {
      const idx = this.getStackIndex(name, true);
      if (idx === -1) continue;
      this.emit(encodeInt(BigInt(idx)), loc);
      this.emit(Op.OP_ROLL, loc);
      this.emit(Op.OP_DROP, loc);
      this.removeFromStack(idx);
    }
  }

  /**
   * Emit opcodes to compute the input index for the i-th iteration entry NFT.
   * Pushes 1 untracked value onto the real stack.
   *
   * inputIndex = OP_INPUTINDEX + blockLayout entry offset
   *            + sum(prior _collectionIterCount_0..N-1) + i
   */
  private emitCollectionIterInputIndex(iterIdx: number, locationData: SingleLocationData): void {
    // With 1:1 block layout, iteration entries start after the fixed block
    const blockSize = this.currentFunction.blockLayout?.blockSize ?? 1;

    this.emitMasterInputIndex(locationData);
    this.emit(encodeInt(BigInt(blockSize)), locationData);
    this.emit(Op.OP_ADD, locationData);

    // Add sum of prior iteration counts (runtime values from _collectionIterCount_0..iterIdx-1)
    for (let j = 0; j < iterIdx; j++) {
      const priorCountIdx = this.getStackIndex(`__internal__collectionIterCount_${j}`);
      this.emit(encodeInt(BigInt(priorCountIdx + 1)), locationData); // +1 for accumulator on stack
      this.emit(Op.OP_PICK, locationData);
      this.emit(Op.OP_ADD, locationData);
    }

    // Add current loop counter i
    const iIdx = this.getStackIndex('(__iter_i)');
    this.emit(encodeInt(BigInt(iIdx + 1)), locationData); // +1 for accumulator on stack
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_ADD, locationData);
  }

  /**
   * Add the total collection-iteration entry count to the trailing-offset partial already on top (W4).
   * Collection-iter entries occupy [blockSize, blockSize+sum(counts)) in the trailing input/output space,
   * BEFORE dynamic-storage read/write chunks - so a dynamic read/write loop adds this sum to its base.
   * No-op when the function has no collection iterations. Assumes one untracked offset partial on top.
   */
  private emitAddCollectionIterCounts(locationData: SingleLocationData): void {
    const iterCount = this.currentFunction.collectionIterations?.length ?? 0;
    for (let j = 0; j < iterCount; j++) {
      this.emit(encodeInt(BigInt(this.getStackIndex(`__internal__collectionIterCount_${j}`) + 1)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.emit(Op.OP_ADD, locationData);
    }
  }

  visitAssemblyStatement(node: AssemblyStatementNode): Node {
    // Solidity inline assembly (Yul): not yet codegen'd. Throw a clear diagnostic (never silently ignore).
    if (node.yulBlock) {
      analyzeInlineAssembly(node);
    }

    if (node.assemblyBody.trim().length === 0) return node;

    const script = asmToScript(node.assemblyBody);
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // Mirror each element's stack effect onto the tracker so later variable refs resolve
    // correctly. Data push = 1 slot; opcode effects from the table (untrackable ones are
    // rejected in TypeCheckTraversal). Results are anonymous '(asm)' slots.
    for (const element of script) {
      this.emit(element, locationData);
      if (typeof element !== 'number') {
        this.pushToStack('(asm)');
        continue;
      }
      const effect = getStackEffect(element);
      if (effect === undefined) {
        throw new Error(`Untrackable opcode in assembly block: ${element}`);
      }
      this.popFromStack(effect.pops);
      for (let i = 0; i < effect.pushes; i += 1) this.pushToStack('(asm)');
    }

    return node;
  }

  visitUnchecked(node: UncheckedNode): Node {
    this.uncheckedDepth++;
    node.block = this.visit(node.block) as BlockNode;
    this.uncheckedDepth--;
    return node;
  }

  visitSwitch(node: SwitchNode): Node {
    const ops = node.switchOps;
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // 1. PRE-ALLOCATE (same pattern as visitBranch)
    if (ops) {
      for (const key of ops.stateWriteKeys) {
        this.preAllocateStateWrite(key, locationData);
      }

      const transferStartIndex = this.pendingTransfers.length;
      for (let i = 0; i < ops.transferCount; i++) {
        const globalIdx = transferStartIndex + i;
        if (!this.preAllocatedTransfers.has(globalIdx)) {
          const lbName = `__internal__transfer_lb_${globalIdx}`;
          const amtName = `__internal__transfer_amt_${globalIdx}`;
          this.emit(encodeInt(0n), locationData);
          this.pushToStack(lbName);
          this.emit(encodeInt(0n), locationData);
          this.pushToStack(amtName);
          this.pendingTransfers.push({
            transferIndex: globalIdx,
            lockingBytecodeStackName: lbName,
            amountStackName: amtName,
          });
          this.preAllocatedTransfers.add(globalIdx);
        }
        if (i >= ops.minTransferCount) {
          this.conditionalTransferIndices.add(transferStartIndex + i);
        }
      }

      const emitStartIndex = this.pendingEmits.length;
      for (let i = 0; i < ops.emitCount; i++) {
        const globalIdx = emitStartIndex + i;
        if (!this.preAllocatedEmits.has(globalIdx)) {
          const emitStackName = `__internal__emit_${globalIdx}`;
          this.emit(encodeInt(0n), locationData);
          this.pushToStack(emitStackName);
          this.preAllocatedEmits.add(globalIdx);
        }
        if (i >= ops.minEmitCount) {
          this.conditionalEmitIndices.add(emitStartIndex + i);
        }
      }

      const tcTransferStartIndex = this.pendingTokenContainerTransfers.length;
      for (let i = 0; i < ops.tokenContainerTransferCount; i++) {
        const globalIdx = tcTransferStartIndex + i;
        if (!this.preAllocatedTokenContainerTransfers.has(globalIdx)) {
          const catName = `__tc_cat_${globalIdx}`;
          this.emit(encodeInt(0n), locationData);
          this.pushToStack(catName);
          const arg0Name = `__tc_arg_${globalIdx}_0`;
          this.emit(encodeInt(0n), locationData);
          this.pushToStack(arg0Name);
          const arg1Name = `__tc_arg_${globalIdx}_1`;
          this.emit(encodeInt(0n), locationData);
          this.pushToStack(arg1Name);
          const arg2Name = `__tc_arg_${globalIdx}_2`;
          this.emit(encodeInt(0n), locationData);
          this.pushToStack(arg2Name);
          this.preAllocatedTokenContainerTransfers.add(globalIdx);
          this.pendingTokenContainerTransfers.push({
            transferIndex: globalIdx,
            tokenContainerSlotIndex: -1,
            method: 'transfer',
            argStackNames: [catName, arg0Name, arg1Name, arg2Name],
          });
        }
        if (i >= ops.minTokenContainerTransferCount) {
          this.conditionalTokenContainerTransferIndices.add(tcTransferStartIndex + i);
        }
      }
    }

    // Mapping writes/deletes
    const mappingWriteSlots = new Set<number>();
    const mappingDeleteSlots = new Set<number>();
    for (const c of node.cases) {
      this.collectMappingSlots(c.body, mappingWriteSlots, mappingDeleteSlots);
    }
    if (node.defaultCase) this.collectMappingSlots(node.defaultCase, mappingWriteSlots, mappingDeleteSlots);

    for (const slotIndex of mappingWriteSlots) {
      if (!this.preAllocatedEntryWrites.has(slotIndex) && !this.pendingEntryWrites.has(slotIndex)) {
        const keyStackName = `__entry_key_enc_${slotIndex}`;
        const valueStackName = `__entry_value_enc_${slotIndex}`;
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(keyStackName);
        this.emit(encodeInt(0n), locationData);
        this.pushToStack(valueStackName);
        this.pendingEntryWrites.set(slotIndex, { keyStackName, valueStackName });
        this.preAllocatedEntryWrites.add(slotIndex);
      }
    }
    // Switch-case deletes keep the plain conditional-delete path (soft-delete lowering is branch-only for now).
    for (const slotIndex of mappingDeleteSlots) {
      if (!this.preAllocatedEntryDeletes.has(slotIndex)) {
        this.pendingEntryDeletes.add(slotIndex);
        this.preAllocatedEntryDeletes.add(slotIndex);
      }
    }

    // 2. Evaluate switch expression
    node.expression = this.visit(node.expression);

    const hasReturnType = this.currentFunction?.returnTypes?.length > 0;

    if (node.cases.length === 0) {
      // No cases - just drop the switch expression and visit default if present
      this.emit(Op.OP_DROP, locationData);
      this.popFromStack();
      if (node.defaultCase) {
        this.scopeDepth += 1;
        const stackDepth = this.stack.length;
        node.defaultCase = this.visit(node.defaultCase) as BlockNode;
        this.removeScopedVariables(stackDepth, node.defaultCase);
        this.scopeDepth -= 1;
      }
      return node;
    }

    // 3. Emit cascading IF/ELSE chain
    this.scopeDepth += 1;

    if (hasReturnType) {
      const stackBeforeSwitch = [...this.stack];
      let stackAfterFirstCase: string[] | undefined;

      for (let i = 0; i < node.cases.length; i++) {
        const c = node.cases[i];
        this.emit(Op.OP_DUP, locationData);
        this.pushToStack('(switch_dup)');
        c.value = this.visit(c.value);
        this.emit(Op.OP_EQUAL, locationData);
        this.popFromStack(); // case value
        this.popFromStack(); // dup result -> bool
        this.pushToStack('(cmp_result)');
        this.popFromStack();

        this.emit(Op.OP_IF, { location: c.body.location, positionHint: PositionHint.START });

        // DROP the switch expression value
        this.emit(Op.OP_DROP, locationData);
        this.popFromStack();

        c.body = this.visit(c.body) as BlockNode;

        if (!stackAfterFirstCase) {
          stackAfterFirstCase = [...this.stack];
        }

        this.emit(Op.OP_ELSE, locationData);
        // Restore stack for next case (switch val still on stack)
        this.stack = [...stackBeforeSwitch];
      }

      // After last ELSE: drop switch val, visit default
      this.emit(Op.OP_DROP, locationData);
      this.popFromStack();

      if (node.defaultCase) {
        node.defaultCase = this.visit(node.defaultCase) as BlockNode;
      }

      // Close all ENDIFs
      for (let i = 0; i < node.cases.length; i++) {
        this.emit(Op.OP_ENDIF, { location: node.location, positionHint: PositionHint.END });
      }

      this.scopeDepth -= 1;
      if (stackAfterFirstCase) {
        this.stack = [...stackAfterFirstCase];
      }
    } else {
      for (let i = 0; i < node.cases.length; i++) {
        const c = node.cases[i];
        this.emit(Op.OP_DUP, locationData);
        this.pushToStack('(switch_dup)');
        c.value = this.visit(c.value);
        this.emit(Op.OP_EQUAL, locationData);
        this.popFromStack(); // case value
        this.popFromStack(); // dup result -> bool
        this.pushToStack('(cmp_result)');
        this.popFromStack();

        this.emit(Op.OP_IF, { location: c.body.location, positionHint: PositionHint.START });

        // DROP the switch expression value
        this.emit(Op.OP_DROP, locationData);
        this.popFromStack();

        const stackDepth = this.stack.length;
        c.body = this.visit(c.body) as BlockNode;
        this.removeScopedVariables(stackDepth, c.body);

        this.emit(Op.OP_ELSE, locationData);
        // Restore the switch expression value on the stack tracker
        // (in the ELSE branch it was NOT dropped)
        this.pushToStack('(switch_val)');
      }

      // After last ELSE: drop switch val, visit default
      this.emit(Op.OP_DROP, locationData);
      this.popFromStack();

      if (node.defaultCase) {
        const stackDepth = this.stack.length;
        node.defaultCase = this.visit(node.defaultCase) as BlockNode;
        this.removeScopedVariables(stackDepth, node.defaultCase);
      }

      // Close all ENDIFs
      for (let i = 0; i < node.cases.length; i++) {
        this.emit(Op.OP_ENDIF, { location: node.location, positionHint: PositionHint.END });
      }

      this.scopeDepth -= 1;
    }

    return node;
  }

  removeScopedVariables(depthBeforeScope: number, node: Node): void {
    const dropCount = this.stack.length - depthBeforeScope;
    for (let i = 0; i < dropCount; i += 1) {
      this.emit(Op.OP_DROP, { location: node.location, positionHint: PositionHint.END });
      this.popFromStack();
    }
  }

  visitCast(node: CastNode): Node {
    node.expression = this.visit(node.expression);

    this.emit(
      compileCast(node.expression.type as Type, node.type, node.isUnsafe),
      { location: node.location, positionHint: PositionHint.END },
    );
    this.popFromStack();
    this.pushToStack('(value)');
    // Emit bounds check for casts to bounded int types
    if (node.type instanceof IntType && !node.isUnsafe) {
      this.emitIntBoundsCheck(node.type, { location: node.location, positionHint: PositionHint.END });
    }
    // Emit bounds check for casts to fixed-point types
    if (node.type instanceof FixedType && !node.isUnsafe) {
      this.emitFixedBoundsCheck(node.type, { location: node.location, positionHint: PositionHint.END });
    }
    // Emit range check for int -> enum casts (Solidity checks the value is a valid enum member)
    if (node.type instanceof EnumType && !node.isUnsafe) {
      this.emitEnumBoundsCheck(node.type, { location: node.location, positionHint: PositionHint.END });
    }
    return node;
  }

  // Verify a value cast to an enum lies within the enum's member-value range.
  private emitEnumBoundsCheck(type: EnumType, locationData: SingleLocationData): void {
    if (this.uncheckedDepth > 0) return;
    const values = type.members.map((m) => m.value);
    const min = values.reduce((a, b) => (b < a ? b : a), values[0]);
    const max = values.reduce((a, b) => (b > a ? b : a), values[0]);
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(min), locationData);
    this.emit(Op.OP_GREATERTHANOREQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(max), locationData);
    this.emit(Op.OP_LESSTHANOREQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
  }

  // addmod(x,y,k) = (x+y)%k, mulmod(x,y,k) = (x*y)%k. Args are interleaved with the ops so the
  // sum/product is on the stack before the modulus (avoids reordering three pushed values).
  private visitAddMulMod(node: FunctionCallNode): Node {
    const loc = { location: node.location, positionHint: PositionHint.END };
    node.parameters[0] = this.visit(node.parameters[0]);
    node.parameters[1] = this.visit(node.parameters[1]);
    this.emit(node.identifier.name === GlobalFunction.ADDMOD ? Op.OP_ADD : Op.OP_MUL, loc);
    this.popFromStack(2);
    this.pushToStack('(value)');
    node.parameters[2] = this.visit(node.parameters[2]);
    this.emit(Op.OP_MOD, loc);
    this.popFromStack(2);
    this.pushToStack('(value)');
    return node;
  }

  // External library call (e.g. keccak256(x)): the library is OP_DEFINEd at the function-body prologue
  // (emitExternalLibraryLoader); each call pushes the argument and OP_INVOKEs it by the library's id.
  private visitExternalLibraryCall(node: FunctionCallNode, lib: ExternalLibrary): Node {
    const loc = { location: node.location, positionHint: PositionHint.END };
    node.parameters[0] = this.visit(node.parameters[0]);
    this.emit(encodeInt(lib.functionId), loc);
    this.emit(Op.OP_INVOKE, loc);
    this.popFromStack(1);
    this.pushToStack('(value)');
    return node;
  }

  /**
   * Result-NFT keccak256(bytes): the co-spent side-car (LAST input) ran keccak in its own budget and put the
   * 32-byte hash (EVM byte order) in its recreated NFT commitment (LAST output). This reads the side-car's
   * unlocking `<pad><preimage><PUSHDATA2(redeem)>`, generically decodes the pad + preimage (ANY length),
   * verifies the side-car IS the genuine compute covenant (hash256(covenant) == baked constant), binds the
   * hashed preimage == this call's argument, then reads the result from the last output's commitment. The
   * redeem is fixed-size (salt(32) + covenant) so its prefix/salt are stripped by constant offsets. Stack:
   * [arg(bytes)] -> [hash(bytes32)]. Matches the utils builders (keccak-compute-library.ts).
   */
  private emitKeccakComputeCall(node: FunctionCallNode): Node {
    const loc = { location: node.location, positionHint: PositionHint.END };
    const fn = this.currentFunction;
    // Slot-per-call: N keccak calls co-spend N side-cars (the last N inputs) recreated as the last N outputs.
    // Record this call's preimage param in emission order (the SDK co-spends per that order), and read this
    // call's side-car at offset (N - i) from the end. i = its emission index; for a single call offset is 1
    // (the last input/output), byte-compatibly with the single-hash case.
    const argNode = node.parameters[0];
    const paramName = argNode instanceof IdentifierNode && fn.parameters.some((p) => p.name === argNode.name)
      ? argNode.name : null;
    const i = (fn.keccakPreimageParams ??= []).length;
    fn.keccakPreimageParams.push(paramName);
    const n = Number(fn.libraryCallCounts?.get(GlobalFunction.KECCAK256) ?? 1n);
    const offset = n - i;
    // Stateful contracts read the side-car from an absolute block-layout slot (master input index + slot
    // offset, same index for the 1:1 input and output). Stateless contracts have no block layout, so they read
    // the last N in/outputs count-relative (countOp - (n-i)). Both land on this call's dedicated side-car.
    const fromEnd = (countOp: Op): void => {
      if (this.keccakLoopActive) {
        // STATEFUL dynamic loop: read THIS iteration's side-car from the trailing region
        // (masterInputIndex + blockSize + counter); same absolute index for the 1:1 input+output (the stateful
        // covenant self-preserves via OP_INPUTINDEX). The counter increments once per iteration below.
        const blockSize = fn.blockLayout?.blockSize ?? 1;
        this.emitMasterInputIndex(loc);
        this.emit(encodeInt(BigInt(blockSize)), loc);
        this.emit(Op.OP_ADD, loc);
        const cIdx = this.getStackIndex(this.keccakLoopCounterName);
        this.emit(encodeInt(BigInt(cIdx + 1)), loc); // +1 for the untracked accumulator on top
        this.emit(Op.OP_PICK, loc);
        this.emit(Op.OP_ADD, loc);
        return;
      }
      if (fn.blockLayout) { this.emitBlockSlotIndex('keccakSideCar', i, loc); return; }
      this.emit(countOp, loc);
      this.emit(encodeInt(BigInt(offset)), loc);
      this.emit(Op.OP_SUB, loc);
    };
    node.parameters[0] = this.visit(node.parameters[0]); // [.., arg]
    const raw = new BytesType();
    const dropFirst = (b: number): void => {             // split off the first b bytes, keep the remainder
      this.emit(encodeInt(BigInt(b)), loc);
      this.emit(Op.OP_SPLIT, loc);
      this.emit(Op.OP_NIP, loc);
    };
    fromEnd(Op.OP_TXINPUTCOUNT);
    this.emit(Op.OP_INPUTBYTECODE, loc);            // [arg, U]  (U = side-car unlocking, any pad/preimage size)
    this.emitGenericPushdataDecode(raw, loc);       // [arg, pad, rest]
    this.emit(Op.OP_NIP, loc);                      // [arg, rest]  (drop the budget pad)
    this.emitGenericPushdataDecode(raw, loc);       // [arg, preimage, redeempush]
    this.emit(Op.OP_TOALTSTACK, loc);               // [arg, preimage]  (stash redeempush; no keccak/loop here)
    this.emit(Op.OP_EQUALVERIFY, loc);              // bind: preimage == arg -> []  (the "master verifies the
    this.emit(Op.OP_FROMALTSTACK, loc);             //   side-car hashed OUR arg" runtime safety check)
    dropFirst(3);                                   // strip redeem PUSHDATA2 prefix -> [redeem]
    dropFirst(KECCAK256_COMPUTE_SALT_PREFIX_LENGTH); // strip OP_PUSHBYTES_32 || salt(32) -> [covenant]
    // Absolute-forward reads (block-layout slot OR dynamic loop: input idx == output idx) use the STATEFUL covenant
    // (self-preserve via OP_INPUTINDEX); the count-relative stateless single/multi call uses offset-from-end.
    const absoluteForward = fn.blockLayout != null || this.keccakLoopActive;
    if (this.keccakLoopActive) {
      // Dynamic loop: compare the covenant bytecode DIRECTLY (it is a compile-time constant) instead of hashing it.
      // Re-hashing the ~2.4KB covenant every iteration would blow the per-input hash-density budget (~5 iters); a
      // byte compare has no hashing cost, lifting the loop's practical iteration cap.
      this.emit(hexToBin(KECCAK256_COMPUTE_STATEFUL_COVENANT), loc);
    } else {
      this.emit(Op.OP_HASH256, loc);                // single/multi call: compare the 32-byte hash (tight script)
      this.emit(hexToBin(absoluteForward ? KECCAK256_COMPUTE_STATEFUL_COVENANT_HASH : KECCAK256_COMPUTE_COVENANT_HASH), loc);
    }
    this.emit(Op.OP_EQUALVERIFY, loc);              // integrity: genuine compute covenant -> []
    fromEnd(Op.OP_TXOUTPUTCOUNT);
    this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, loc);    // [hash]  (this slot's output commitment = keccak256(arg))
    this.popFromStack(1);
    this.pushToStack('(value)');
    // Dynamic keccak loop: advance the side-car counter so the next iteration reads the next trailing side-car.
    // Tracker-neutral in-place bump (same as the entry-loop counter): the OP_PICK'd value is untracked, so the
    // emitReplace +1 offset covers it and consumes it, leaving the (value) result on top for the assignment. Do
    // NOT popFromStack - that would drop the tracked (value), desyncing h's slot so the write-back is lost.
    if (this.keccakLoopActive) {
      const cIdx = this.getStackIndex(this.keccakLoopCounterName);
      this.emit(encodeInt(BigInt(cIdx)), loc);
      this.emit(Op.OP_PICK, loc);
      this.emit(Op.OP_1ADD, loc);
      this.emitReplace(this.getStackIndex(this.keccakLoopCounterName) + 1, node);
    }
    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    if (node.identifier.name === GlobalFunction.CHECKMULTISIG) {
      return this.visitMultiSig(node);
    }

    if (node.identifier.name === GlobalFunction.INT_TO_STRING) {
      return this.visitIntToString(node);
    }

    if (node.identifier.name === GlobalFunction.STRING_TO_INT) {
      return this.visitStringToInt(node);
    }

    if (node.identifier.name === GlobalFunction.ADDMOD || node.identifier.name === GlobalFunction.MULMOD) {
      return this.visitAddMulMod(node);
    }

    if (node.identifier.name === GlobalFunction.BLOBHASH) {
      // No blobs on BCH: ignore the index, return bytes32(0) (EVM returns 0 for i >= numBlobs).
      const loc = { location: node.location, positionHint: PositionHint.START };
      node.parameters[0] = this.visit(node.parameters[0]);
      this.popFromStack();
      this.emit(Op.OP_DROP, loc);
      this.emit(new Uint8Array(32), loc);
      this.pushToStack('(value)');
      return node;
    }

    if (node.identifier.name === GlobalFunction.BLOCKHASH) {
      // The (n->hash) oracle NFT is BRANDED to the contract's OWN category (master-bound, per
      // docs/block-and-transaction-properties.md s3): there is no separate oracle category and no compile-time
      // option. Read the co-spent oracle UTXO and return its hash:
      //   require(tx.time >= n); base(category(oracle)) == base(category(master)); commitment = n(4 LE)||hash,
      //   n == arg. Soundness: the oracle rides the contract's own category (only the owner mints it), so a
      //   co-spent UTXO with that category carries a genuine (n,hash); the n-check disambiguates the block.
      // blockhash forces the contract stateful (usesBlockhash), so the covenant runs on the master (category).
      const loc = { location: node.location, positionHint: PositionHint.START };
      // SDK auto-injection keys on blockhashReads: a direct-identifier n is recorded by param name (the SDK
      // reads that arg to resolve addr(n)). ANY computed n (block.number - K, arbitrary arithmetic) is recorded
      // as a per-call-site <computed:i> key with its own slot; the SDK resolves it from the auto-derivation
      // probe trace (the covenant computes n on-stack), so it is never re-derived in JS.
      const nArg = node.parameters[0];
      // Each DISTINCT n rides its OWN consecutive oracle slot. The read ordinal = its position in
      // blockhashReads (the base slot + ordinal = its co-spend input index). Computed keys use the call site's
      // stable index (SynthesizeBlockOracle), NOT a counter - codegen runs twice, so a counter would duplicate.
      const reads = (this.currentFunction.blockhashReads ??= []);
      const readKey = nArg instanceof IdentifierNode
        ? nArg.name
        : encodeComputedBlockhashKey(node.blockhashComputedIndex ?? 0);
      if (!reads.includes(readKey)) reads.push(readKey);
      const readOrdinal = reads.indexOf(readKey);
      node.parameters[0] = this.visit(node.parameters[0]); // [n]
      // The co-spend input index comes from the synthesized __internal__blockhashInputIndex param (the SDK
      // locates the oracle co-spend and fills it with the FIRST slot's index), NOT OP_TXINPUTCOUNT OP_1SUB -
      // the last input belongs to whoever the builder appended last, which breaks under cross-contract
      // composition. Depth is computed with [n] on top; the DUP/CLTV/DROP + optional ADD below are net-zero so
      // the stack is still [n] under the picked index at the OP_UTXOTOKENCATEGORY.
      const idxDepth = this.getStackIndex('__internal__blockhashInputIndex');
      this.emit([
        Op.OP_DUP, Op.OP_CHECKLOCKTIMEVERIFY, Op.OP_DROP, // require(tx.time >= n), [n]
        encodeInt(BigInt(idxDepth)), Op.OP_PICK, // base co-spend input index (composition-safe), [n, base]
      ], loc);
      if (readOrdinal > 0) this.emit([encodeInt(BigInt(readOrdinal)), Op.OP_ADD], loc); // base + ordinal -> [n, idx]
      this.emit([
        Op.OP_DUP, Op.OP_UTXOTOKENCATEGORY, // [n, idx, oracleCategory]
      ], loc);
      this.emitVerifyCatBaseEqMaster(loc); // base(oracle category) == base(contract's own category) -> [n, idx]
      this.emit([
        Op.OP_UTXOTOKENCOMMITMENT, encodeInt(4n), Op.OP_SPLIT, // [n, n4, hash32]
        Op.OP_SWAP, Op.OP_BIN2NUM, // [n, hash32, commitment.n]
        Op.OP_ROT, Op.OP_EQUALVERIFY, // commitment.n == n -> [hash32]
      ], loc);
      this.popFromStack();
      this.pushToStack('(value)');
      return node;
    }

    if (node.identifier.name === GlobalFunction.ECRECOVER) {
      return this.visitEcrecover(node);
    }

    // Result-NFT model: keccak256 is computed by a co-spent side-car and read from its NFT commitment,
    // instead of loading the blob and running it on the contract's own input budget. Decided per-function
    // in SymbolTableTraversal (node.keccakCompute): stateless single-call direct-param keccak by default.
    if (this.currentFunction?.keccakCompute && node.identifier.name === GlobalFunction.KECCAK256) {
      return this.emitKeccakComputeCall(node);
    }

    const externalLib = this.resolvedLibraries[node.identifier.name];
    if (externalLib) {
      return this.visitExternalLibraryCall(node, externalLib);
    }

    // User-defined function call via OP_INVOKE
    const targetFunc = node.resolvedFunction;
    if (targetFunc && targetFunc.functionId !== undefined) {
      return this.visitUserFunctionCall(node, targetFunc);
    }

    // Indirect call through a function-typed value (function pointer).
    if (node.identifier.type instanceof FunctionType) {
      return this.visitIndirectFunctionCall(node);
    }

    // Struct constructor: emit pushdata encode for each field + OP_CAT
    if (node.type instanceof StructType) {
      const structType = node.type;
      const locationData = { location: node.location, positionHint: PositionHint.END };

      node.parameters.forEach((param, i) => {
        param = this.visit(param);
        node.parameters[i] = param;

        // Encode each field value to pushdata format
        this.emitPushdataEncode(structType.fields[i].type, locationData);

        // CAT with previous if not the first
        if (i > 0) {
          this.emit(Op.OP_CAT, locationData);
          this.popFromStack(2);
          this.pushToStack('(value)');
        }
      });

      return node;
    }

    node.parameters = this.visitList(node.parameters);

    this.emit(
      compileGlobalFunction(node.identifier.name as GlobalFunction),
      { location: node.location, positionHint: PositionHint.END },
    );
    this.popFromStack(node.parameters.length);
    this.pushToStack('(value)');

    return node;
  }

  // ecrecover(hash, sig, pubKey): verify `sig` over `hash` against `pubKey`, then return the signer's P2PKH
  // locking bytecode (0x76a914 || hash160(pubKey) || 0x88ac) on success or the zero address 0x on an empty
  // signature. NULLFAIL means a non-empty invalid signature aborts the script. The 4-arg Solidity form
  // (hash, v, r, s) is inert: it drops its args and yields 0x (BCH cannot recover; see docs/ecrecover.md).
  visitEcrecover(node: FunctionCallNode): Node {
    const loc = { location: node.location, positionHint: PositionHint.END };
    node.parameters = this.visitList(node.parameters);

    if (node.parameters.length === 4) {
      this.emit([Op.OP_2DROP, Op.OP_2DROP, encodeInt(0n)], loc); // drop (hash, v, r, s), push zero address
      this.popFromStack(4);
      this.pushToStack('(value)');
      return node;
    }

    // 3-arg form. Stack after visitList: [hash, sig, pubKey].
    this.emit([
      Op.OP_DUP, Op.OP_HASH160, // [hash, sig, pubKey, hash160(pubKey)]
      hexToBin('76a914'), Op.OP_SWAP, Op.OP_CAT, // [.., 0x76a914 || pkh]
      hexToBin('88ac'), Op.OP_CAT, // [.., p2pkh]  (25-byte locking bytecode)
      Op.OP_TOALTSTACK, // stash p2pkh; [hash, sig, pubKey]
      Op.OP_ROT, Op.OP_SWAP, // reorder to OP_CHECKDATASIG operand order [sig, hash, pubKey]
      Op.OP_CHECKDATASIG, // [bool]
      Op.OP_FROMALTSTACK, Op.OP_SWAP, // [p2pkh, bool]
      Op.OP_IF, // valid signature: keep p2pkh
      Op.OP_ELSE, Op.OP_DROP, encodeInt(0n), // empty signature: zero address 0x
      Op.OP_ENDIF,
    ], loc);
    this.popFromStack(node.parameters.length);
    this.pushToStack('(value)');
    return node;
  }

  visitMultiSig(node: FunctionCallNode): Node {
    this.emit(encodeBool(false), { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(value)');
    node.parameters = this.visitList(node.parameters);
    this.emit(Op.OP_CHECKMULTISIG, { location: node.location, positionHint: PositionHint.END });
    const sigs = node.parameters[0] as ArrayNode;
    const pks = node.parameters[1] as ArrayNode;
    this.popFromStack(sigs.elements.length + pks.elements.length + 3);
    this.pushToStack('(value)');

    return node;
  }

  /**
   * Emit intToString(n): converts int to decimal ASCII string.
   *
   * Algorithm:
   *   if n == 0: return "0" (0x30)
   *   sign = (n < 0)
   *   if sign: n = -n
   *   result = ""  (empty bytes)
   *   while n > 0:
   *     digit = n % 10
   *     n = n / 10
   *     result = bytes1(digit + 0x30) + result  (prepend ASCII digit)
   *   if sign: result = 0x2d + result  (prepend '-')
   *   return result
   */
  visitIntToString(node: FunctionCallNode): Node {
    node.parameters = this.visitList(node.parameters);
    const L = { location: node.location, positionHint: PositionHint.END } as const;

    // Stack: [n]
    // Handle zero case
    this.emit(Op.OP_DUP, L);            // [n, n]
    this.emit(Op.OP_0NOTEQUAL, L);       // [n, n!=0]
    this.emit(Op.OP_IF, L);

    // Non-zero path
    // Check sign
    this.emit(Op.OP_DUP, L);             // [n, n]
    this.emit(encodeInt(0n), L);          // [n, n, 0]
    this.emit(Op.OP_LESSTHAN, L);         // [n, isNeg]
    this.emit(Op.OP_SWAP, L);             // [isNeg, n]
    this.emit(Op.OP_ABS, L);             // [isNeg, abs(n)]

    // Build digits: start loop with empty result
    // Stack: [isNeg, n]
    this.emit(encodeInt(0n), L);          // [isNeg, n, result=""]
    this.emit(Op.OP_SWAP, L);             // [isNeg, result, n]

    this.emit(Op.OP_BEGIN, L);
    // Loop body: Stack top is [isNeg, result, n]
    this.emit(Op.OP_DUP, L);             // [isNeg, result, n, n]
    this.emit(encodeInt(10n), L);          // [isNeg, result, n, n, 10]
    this.emit(Op.OP_MOD, L);              // [isNeg, result, n, digit]
    this.emit(encodeInt(0x30n), L);        // [isNeg, result, n, digit, 0x30]
    this.emit(Op.OP_ADD, L);              // [isNeg, result, n, ascii]
    this.emit(encodeInt(1n), L);           // [isNeg, result, n, ascii, 1]
    this.emit(Op.OP_NUM2BIN, L);          // [isNeg, result, n, char_byte]
    this.emit(Op.OP_ROT, L);              // [isNeg, n, char_byte, result]
    this.emit(Op.OP_SWAP, L);             // [isNeg, n, result, char_byte]
    // We need to prepend: result = char_byte + result
    this.emit(Op.OP_SWAP, L);             // [isNeg, n, char_byte, result]
    this.emit(Op.OP_CAT, L);              // [isNeg, n, char_byte+result]
    this.emit(Op.OP_SWAP, L);             // [isNeg, char_byte+result, n]
    this.emit(encodeInt(10n), L);          // [isNeg, result, n, 10]
    this.emit(Op.OP_DIV, L);              // [isNeg, result, n/10]
    this.emit(Op.OP_DUP, L);             // [isNeg, result, n', n']
    this.emit(Op.OP_0NOTEQUAL, L);        // [isNeg, result, n', n'!=0]
    this.emit(Op.OP_NOT, L);              // [isNeg, result, n', n'==0]
    this.emit(Op.OP_UNTIL, L);

    this.emit(Op.OP_DROP, L);             // [isNeg, result] - drop n (now 0)

    // Handle sign prefix
    this.emit(Op.OP_SWAP, L);             // [result, isNeg]
    this.emit(Op.OP_IF, L);
    this.emit(encodeString('-'), L);       // [result, "-"]
    this.emit(Op.OP_SWAP, L);             // ["-", result]
    this.emit(Op.OP_CAT, L);              // ["-"+result]
    this.emit(Op.OP_ENDIF, L);

    this.emit(Op.OP_ELSE, L);
    // Zero case: replace with "0"
    this.emit(Op.OP_DROP, L);             // [] - drop n
    this.emit(encodeString('0'), L);       // ["0"]
    this.emit(Op.OP_ENDIF, L);

    this.popFromStack(1);
    this.pushToStack('(value)');
    return node;
  }

  /**
   * Emit stringToInt(s): parses decimal ASCII string to int.
   *
   * Algorithm:
   *   if s.length == 0: fail
   *   sign = 1
   *   if s[0] == '-': sign = -1, skip first byte
   *   if s[0] == '+': skip first byte
   *   result = 0
   *   while remaining.length > 0:
   *     byte = first byte of remaining
   *     if byte < 0x30 || byte > 0x39: fail
   *     digit = byte - 0x30
   *     result = result * 10 + digit
   *   return result * sign
   */
  visitStringToInt(node: FunctionCallNode): Node {
    node.parameters = this.visitList(node.parameters);
    const L = { location: node.location, positionHint: PositionHint.END } as const;

    // Stack: [str]
    // Verify non-empty
    this.emit(Op.OP_DUP, L);
    this.emit(Op.OP_SIZE, L);
    this.emit(Op.OP_NIP, L);
    this.emit(Op.OP_0NOTEQUAL, L);
    this.emit(Op.OP_VERIFY, L);

    // Check for sign: get first byte
    this.emit(Op.OP_DUP, L);             // [str, str]
    this.emit(encodeInt(1n), L);           // [str, str, 1]
    this.emit(Op.OP_SPLIT, L);            // [str, first_byte, rest]
    this.emit(Op.OP_DROP, L);             // [str, first_byte]

    this.emit(Op.OP_DUP, L);             // [str, first_byte, first_byte]
    this.emit(encodeString('-'), L);       // [str, first_byte, first_byte, 0x2d]
    this.emit(Op.OP_EQUAL, L);            // [str, first_byte, is_minus]
    this.emit(Op.OP_IF, L);
    // Minus sign: skip first byte, push -1
    this.emit(Op.OP_DROP, L);             // [str]
    this.emit(encodeInt(1n), L);           // [str, 1]
    this.emit(Op.OP_SPLIT, L);            // [first_byte, rest_str]
    this.emit(Op.OP_NIP, L);              // [rest_str]
    this.emit(Op.OP_1NEGATE, L);          // [rest_str, -1]
    this.emit(Op.OP_ELSE, L);

    this.emit(Op.OP_DUP, L);             // [str, first_byte, first_byte]
    this.emit(encodeString('+'), L);       // [str, first_byte, first_byte, 0x2b]
    this.emit(Op.OP_EQUAL, L);            // [str, first_byte, is_plus]
    this.emit(Op.OP_IF, L);
    // Plus sign: skip first byte, push 1
    this.emit(Op.OP_DROP, L);             // [str]
    this.emit(encodeInt(1n), L);           // [str, 1]
    this.emit(Op.OP_SPLIT, L);            // [first_byte, rest_str]
    this.emit(Op.OP_NIP, L);              // [rest_str]
    this.emit(encodeInt(1n), L);           // [rest_str, 1]
    this.emit(Op.OP_ELSE, L);
    // No sign: keep string, push 1
    this.emit(Op.OP_DROP, L);             // [str]
    this.emit(encodeInt(1n), L);           // [str, 1]
    this.emit(Op.OP_ENDIF, L);
    this.emit(Op.OP_ENDIF, L);

    // Stack: [remaining_str, sign]
    this.emit(Op.OP_SWAP, L);             // [sign, remaining_str]
    this.emit(encodeInt(0n), L);           // [sign, remaining_str, result=0]
    this.emit(Op.OP_SWAP, L);             // [sign, result, remaining_str]

    // Verify remaining is non-empty (at least one digit required)
    this.emit(Op.OP_DUP, L);
    this.emit(Op.OP_SIZE, L);
    this.emit(Op.OP_NIP, L);
    this.emit(Op.OP_0NOTEQUAL, L);
    this.emit(Op.OP_VERIFY, L);

    // Loop: parse digits
    this.emit(Op.OP_BEGIN, L);
    // Stack: [sign, result, remaining_str]
    this.emit(encodeInt(1n), L);           // [sign, result, remaining_str, 1]
    this.emit(Op.OP_SPLIT, L);            // [sign, result, first_byte, rest]
    this.emit(Op.OP_SWAP, L);             // [sign, result, rest, first_byte]
    this.emit(Op.OP_BIN2NUM, L);          // [sign, result, rest, ascii_num]

    // Validate digit range: 0x30 ('0') to 0x39 ('9')
    this.emit(Op.OP_DUP, L);
    this.emit(encodeInt(0x30n), L);
    this.emit(Op.OP_GREATERTHANOREQUAL, L);
    this.emit(Op.OP_VERIFY, L);
    this.emit(Op.OP_DUP, L);
    this.emit(encodeInt(0x39n), L);
    this.emit(Op.OP_LESSTHANOREQUAL, L);
    this.emit(Op.OP_VERIFY, L);

    this.emit(encodeInt(0x30n), L);        // [sign, result, rest, ascii_num, 0x30]
    this.emit(Op.OP_SUB, L);              // [sign, result, rest, digit]
    this.emit(Op.OP_ROT, L);              // [sign, rest, digit, result]
    this.emit(encodeInt(10n), L);          // [sign, rest, digit, result, 10]
    this.emit(Op.OP_MUL, L);              // [sign, rest, digit, result*10]
    this.emit(Op.OP_ADD, L);              // [sign, rest, new_result]
    this.emit(Op.OP_SWAP, L);             // [sign, new_result, rest]

    // Check if remaining string is empty
    this.emit(Op.OP_DUP, L);
    this.emit(Op.OP_SIZE, L);
    this.emit(Op.OP_NIP, L);
    this.emit(Op.OP_0NOTEQUAL, L);
    this.emit(Op.OP_NOT, L);              // true when empty -> stop
    this.emit(Op.OP_UNTIL, L);

    this.emit(Op.OP_DROP, L);             // [sign, result] - drop empty str
    this.emit(Op.OP_SWAP, L);             // [result, sign]
    this.emit(Op.OP_MUL, L);              // [result * sign]

    this.popFromStack(1);
    this.pushToStack('(value)');
    return node;
  }

  /**
   * Handle user-defined function calls via OP_INVOKE.
   *
   * The SolidCash convention (matching the SDK's createUnlockingBytecode) is
   * that the selector is the first push (bottom of stack) and the first
   * parameter ends up on TOP. Since evaluating left-to-right pushes the last
   * arg to the top, we evaluate in REVERSE order so that arg[0] is the last
   * push (and thus on top). The dispatcher uses OP_DEPTH OP_1SUB OP_ROLL to
   * pull the selector from the bottom.
   */
  visitUserFunctionCall(node: FunctionCallNode, targetFunc: FunctionDefinitionNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // The internal-call subroutine skips the synthetic `__internal__returnOutputIdx` param during setup (unused
    // for a raw return - see visitFunctionDefinition), and a function-pointer call never pushes it. Match that:
    // don't push the returnOutputIdx arg (TypeCheck forwarded it only to satisfy the arity check), so the
    // subroutine's declared params line up on the stack. Other synthetic params (msgSenderCategory, ...) ARE
    // consumed by the subroutine, so they are still pushed.
    const skipArg = (i: number): boolean => targetFunc.parameters[i]?.name === '__internal__returnOutputIdx';

    // Evaluate arguments in REVERSE order so first param ends up on top
    // (matches the SDK's [...encodedArgs].reverse() convention)
    let pushedArgs = 0;
    for (let i = node.parameters.length - 1; i >= 0; i--) {
      if (skipArg(i)) continue;
      node.parameters[i] = this.visit(node.parameters[i]);
      pushedArgs += 1;
    }

    // Emit: <function_id> OP_INVOKE
    this.emit(encodeInt(BigInt(targetFunc.functionId!)), locationData);
    this.emit(Op.OP_INVOKE, locationData);

    // Update stack tracking: pop the pushed arguments, push return values
    this.popFromStack(pushedArgs);
    for (let i = 0; i < targetFunc.returnTypes.length; i++) {
      this.pushToStack('(value)');
    }

    return node;
  }

  // Indirect call: like visitUserFunctionCall, but the functionId comes from a function-typed value
  // (variable/parameter) evaluated onto the stack instead of a literal.
  visitIndirectFunctionCall(node: FunctionCallNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const funcType = node.identifier.type as FunctionType;

    // Evaluate arguments in REVERSE order so first param ends up on top.
    for (let i = node.parameters.length - 1; i >= 0; i--) {
      node.parameters[i] = this.visit(node.parameters[i]);
    }

    // Push the functionId value on top, then OP_INVOKE consumes it plus the args.
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    this.emit(Op.OP_INVOKE, locationData);

    this.popFromStack(node.parameters.length + 1);
    for (let i = 0; i < funcType.returnTypes.length; i++) {
      this.pushToStack('(value)');
    }

    return node;
  }

  // `<expr>(args)`: evaluate the callee expression to its integer functionId then OP_INVOKE - identical dispatch to
  // visitIndirectFunctionCall, but the pointer value comes from an arbitrary expression (e.g. `arr[i]()`).
  visitIndirectCall(node: IndirectCallNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const funcType = node.callee.type as FunctionType;
    // Evaluate arguments in REVERSE order so the first param ends up on top.
    for (let i = node.parameters.length - 1; i >= 0; i--) {
      node.parameters[i] = this.visit(node.parameters[i]);
    }
    // Push the functionId value on top (the callee evaluates to it), then OP_INVOKE consumes it plus the args.
    node.callee = this.visit(node.callee) as ExpressionNode;
    this.emit(Op.OP_INVOKE, locationData);
    this.popFromStack(node.parameters.length + 1);
    for (let i = 0; i < funcType.returnTypes.length; i++) {
      this.pushToStack('(value)');
    }
    return node;
  }

  visitReturn(node: ReturnNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // Evaluate return expressions - they will be left on the stack
    node.expressions = this.visitList(node.expressions) as ExpressionNode[];

    // For entry-point functions with return types (B-side):
    // Pushdata-encode each value and CAT into a single blob, similar to emit.
    // The blob is stashed on the tracked stack for covenant verification.
    // The internal-call subroutine (isDefineSubTraversal) instead leaves the raw value(s) on the stack like a
    // plain internal function, so an internal caller gets the return value (no return event is produced).
    // Exception: a `return` inside a loop isn't supported by the raw-return stack cleanup, so keep the
    // event-blob path for such functions (the internal-call subroutine is then unused/spliced).
    if (this.currentFunction.isEntryPoint && this.currentFunction.returnTypes.length > 0
      && (!this.isDefineSubTraversal || this.functionHasReturnInLoop)) {
      const returnTypes = this.currentFunction.returnTypes;
      for (let i = 0; i < returnTypes.length; i++) {
        this.emitPushdataEncode(returnTypes[i], locationData);
        if (i > 0) {
          // CAT with accumulated blob
          // Stack: [..., blob_so_far, encoded_value]
          this.emit(Op.OP_SWAP, locationData);
          this.emit(Op.OP_CAT, locationData);
          this.popFromStack(2);
          this.pushToStack('(value)');
        }
      }
      // Rename the top of stack to __returnBlob
      this.popFromStack();
      this.pushToStack('__internal__returnBlob');
      return node;
    }

    // For internal functions: clean up local variables below return values
    const returnCount = node.expressions.length;

    // A void `return;` has no early-exit opcode to emit. After EarlyReturnTransformation any following
    // statements are nested into the else branch, so this return sits in tail position. Emit nothing: the
    // function-end cleanStack drops the params once. Dropping the whole stack here would clean only the taken
    // branch and imbalance the sibling branches (e.g. an else-if that still reads a param). Applies to entry-
    // point void functions too: a `return;` guard nested by EarlyReturnTransformation reaches here as a tail no-op.
    if (returnCount === 0) {
      return node;
    }

    const stackSize = this.stack.length;
    const localsToRemove = stackSize - returnCount;

    for (let i = 0; i < localsToRemove; i++) {
      if (returnCount === 1) {
        this.emit(Op.OP_NIP, locationData);
        this.nipFromStack();
      } else {
        this.emit(encodeInt(BigInt(returnCount)), locationData);
        this.emit(Op.OP_ROLL, locationData);
        this.emit(Op.OP_DROP, locationData);
        this.removeFromStack(returnCount);
      }
    }

    return node;
  }

  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // Visit the inner function call
    node.call = this.visit(node.call) as FunctionCallNode;

    // Discard return values (if any). Direct calls know their target; indirect calls (function
    // pointers) get the count from the callee's function type.
    const targetFunc = node.call.resolvedFunction;
    const returnCount = targetFunc
      ? targetFunc.returnTypes.length
      : node.call.identifier.type instanceof FunctionType
        ? node.call.identifier.type.returnTypes.length
        : 0;
    for (let i = 0; i < returnCount; i++) {
      this.emit(Op.OP_DROP, locationData);
      this.popFromStack();
    }

    return node;
  }

  visitExpressionStatement(node: ExpressionStatementNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    node.expression = this.visit(node.expression) as ExpressionNode;
    // Compute the value and drop it (a bare expression statement has no effect). Drop one slot per value:
    // a tuple pushes one per element; a void expression pushes nothing.
    const type = node.expression.type;
    const dropCount = type instanceof TupleType
      ? type.elements.length
      : type === PrimitiveType.VOID
        ? 0
        : 1;
    for (let i = 0; i < dropCount; i++) {
      this.emit(Op.OP_DROP, locationData);
      this.popFromStack();
    }
    return node;
  }

  visitMethodCallStatement(node: MethodCallStatementNode): Node {
    // After semantic analysis, node.expression is the transformed ExternalFunctionCallNode.
    // Visit it (handles return value reading if applicable).
    if (node.expression) {
      this.visit(node.expression);
    } else {
      throw new Error(
        'MethodCallStatementNode.expression is null in codegen. '
        + `call.methodName=${node.call?.methodName}, `
        + `call.object=${node.call?.object?.constructor?.name}`,
      );
    }
    return node;
  }

  visitInstantiation(node: InstantiationNode): Node {
    if (node.referencedContract) {
      return this.emitContractDeployment(node);
    }

    if (node.identifier.name === Class.LOCKING_BYTECODE_P2PKH) {
      // OP_DUP OP_HASH160 OP_PUSH<20>
      this.emit(P2PKH_LBC_PREFIX, { location: node.location, positionHint: PositionHint.START });
      this.pushToStack('(value)');
      // <pkh>
      this.visit(node.parameters[0]);
      this.emit(Op.OP_CAT, { location: node.location, positionHint: PositionHint.END });
      // OP_EQUALVERIFY OP_CHECKSIG
      this.emit(P2PKH_LBC_SUFFIX, { location: node.location, positionHint: PositionHint.END });
      this.emit(Op.OP_CAT, { location: node.location, positionHint: PositionHint.END });
      this.popFromStack(2);
    } else if (node.identifier.name === Class.LOCKING_BYTECODE_P2SH20) {
      // OP_HASH160 OP_PUSH<20>
      this.emit(P2SH20_LBC_PREFIX, { location: node.location, positionHint: PositionHint.START });
      this.pushToStack('(value)');
      // <script hash>
      this.visit(node.parameters[0]);
      this.emit(Op.OP_CAT, { location: node.location, positionHint: PositionHint.END });
      // OP_EQUAL
      this.emit(P2SH20_LBC_SUFFIX, { location: node.location, positionHint: PositionHint.END });
      this.emit(Op.OP_CAT, { location: node.location, positionHint: PositionHint.END });
      this.popFromStack(2);
    } else if (node.identifier.name === Class.LOCKING_BYTECODE_P2SH32) {
      // OP_HASH256 OP_PUSH<32>
      this.emit(P2SH32_LBC_PREFIX, { location: node.location, positionHint: PositionHint.START });
      this.pushToStack('(value)');
      // <script hash>
      this.visit(node.parameters[0]);
      this.emit(Op.OP_CAT, { location: node.location, positionHint: PositionHint.END });
      // OP_EQUAL
      this.emit(P2SH32_LBC_SUFFIX, { location: node.location, positionHint: PositionHint.END });
      this.emit(Op.OP_CAT, { location: node.location, positionHint: PositionHint.END });
      this.popFromStack(2);
    } else if (node.identifier.name === Class.LOCKING_BYTECODE_NULLDATA) {
      // Total script = OP_RETURN (<VarInt> <chunk>)+
      // OP_RETURN
      this.emit(hexToBin('6a'), { location: node.location, positionHint: PositionHint.START });
      this.pushToStack('(value)');
      const { elements } = node.parameters[0] as ArrayNode;
      // <VarInt data chunk size (dynamic)>
      elements.forEach((element) => {
        this.visit(element);

        // The element comes first, then all other opcodes have PositionHint.END because they come after the element
        const elementLocationData = { location: element.location, positionHint: PositionHint.END };

        // Push the element's size (and calculate VarInt)
        this.emit(Op.OP_SIZE, elementLocationData);
        if (element instanceof HexLiteralNode) {
          // If the argument is a literal, we know its size
          if (element.value.byteLength > 75) {
            this.emit(hexToBin('4c'), elementLocationData);
            this.emit(Op.OP_SWAP, elementLocationData);
            this.emit(Op.OP_CAT, elementLocationData);
          }
        } else {
          // If the argument is not a literal, the script needs to check size
          this.emit(Op.OP_DUP, elementLocationData);
          this.emit(encodeInt(75n), elementLocationData);
          this.emit(Op.OP_GREATERTHAN, elementLocationData);
          this.emit(Op.OP_IF, elementLocationData);
          this.emit(hexToBin('4c'), elementLocationData);
          this.emit(Op.OP_SWAP, elementLocationData);
          this.emit(Op.OP_CAT, elementLocationData);
          this.emit(Op.OP_ENDIF, elementLocationData);
        }
        // Concat size and arguments
        this.emit(Op.OP_SWAP, elementLocationData);
        this.emit(Op.OP_CAT, elementLocationData);
        this.emit(Op.OP_CAT, elementLocationData);
        this.popFromStack();
      });
      this.popFromStack();
    } else {
      throw new Error(); // Should not happen
    }

    this.pushToStack('(value)');

    return node;
  }

  visitTupleIndexOp(node: TupleIndexOpNode): Node {
    node.tuple = this.visit(node.tuple);

    const locationData = { location: node.location, positionHint: PositionHint.END };

    // bytes[k] with a literal index: [b] <k> OP_SPLIT OP_NIP 1 OP_SPLIT OP_DROP -> [byte].
    if (node.tuple.type instanceof BytesType) {
      this.emit(encodeInt(BigInt(node.index)), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.popFromStack();
      this.pushToStack('(value)');
      return node;
    }

    // Handle constant-index array access (arr[5] where 5 is a NumberLiteral)
    if (node.tuple.type instanceof ArrayType) {
      const arrType = node.tuple.type;
      const elemType = arrType.elementType;
      const fixedWidth = isFixedWidthType(elemType);

      // Decode length prefix: [blob] -> [length, elements_blob]
      this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
      // Bitcoin stack: [..., length, elements_blob]
      this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, length]
      this.popFromStack(); // remove blob tracking
      this.pushToStack('(elements)');
      this.pushToStack('(length)');

      // Bounds check: push constant index, then require(index < length)
      this.emit(encodeInt(BigInt(node.index)), locationData);
      this.pushToStack('(index)');
      this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, index, length]
      this.emitBoundsCheck(locationData); // [..., elements_blob, index]
      this.popFromStack(2); // remove length and index tracking

      if (fixedWidth) {
        const width = getFixedWidth(elemType);
        const byteOffset = node.index * width;

        // O(1) access: use compile-time byte offset (drop the index from stack)
        this.emit(Op.OP_DROP, locationData); // [..., elements_blob]

        // Split at byte offset
        this.emit(encodeInt(BigInt(byteOffset)), locationData);
        this.emit(Op.OP_SPLIT, locationData); // [..., left, right]
        this.emit(Op.OP_NIP, locationData); // [..., right]
        this.popFromStack(); // remove (elements) tracking
        this.pushToStack('(value)');

        // Split off element
        this.emit(encodeInt(BigInt(width)), locationData);
        this.emit(Op.OP_SPLIT, locationData); // [..., element, rest]
        this.emit(Op.OP_DROP, locationData); // [..., element]

        this.emitDecodeElementPacked(elemType, locationData);
      } else {
        // O(n) scan: skip `index` elements
        // Tracker already has (elements) from above; add (count) for the index
        this.pushToStack('(count)');
        this.emitScanLoop(elemType, locationData);
        this.popFromStack(2); // remove (elements) and (count)
        this.pushToStack('(remaining)');

        // Decode the target element from remaining
        this.emitPushdataDecode(elemType, locationData);
        this.emit(Op.OP_SWAP, locationData);
        this.emit(Op.OP_NIP, locationData);
        this.popFromStack();
        this.pushToStack('(value)');
      }

      return node;
    }

    if (node.index === 0) {
      this.emit(Op.OP_DROP, locationData);
      this.popFromStack();
    } else if (node.index === 1) {
      this.emit(Op.OP_NIP, locationData);
      this.nipFromStack();
    }

    return node;
  }

  // element.slice(start, end) is equivalent to element.split(end)[0].split(start)[1]
  visitSlice(node: SliceNode): Node {
    const elemType = node.element.type;
    node.element = this.visit(node.element);

    const locationData = { location: node.location, positionHint: PositionHint.END };

    // Fixed-width-element array slice `arr[start:end]`: the value is `pushdata(count) ++ packed elements` (each
    // element W bytes). Strip the count prefix, byte-slice the element blob at the SCALED offsets
    // [start*W, end*W), then re-frame with the new count via emitPrependArrayCount. Sound by reduction to the
    // verified pushdata-decode / bytes-slice / prepend-count primitives.
    if (elemType instanceof ArrayType && isFixedWidthType(elemType.elementType)) {
      const width = getFixedWidth(elemType.elementType);
      // 1. strip the count prefix -> [elements_blob]
      this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_SWAP, locationData); // [elements_blob, count]
      this.popFromStack();
      this.pushToStack('(elements)');
      this.pushToStack('(count)');
      this.emit(Op.OP_DROP, locationData); // [elements_blob]
      this.popFromStack();
      // 2. drop the tail: [elements_blob[0 : end*W]]
      this.visit(node.end);
      this.emit(encodeInt(BigInt(width)), locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_MUL, locationData); // [elements_blob, end*W]
      this.popFromStack();
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      // 3. nip the head: [elements_blob[start*W : end*W]]
      this.visit(node.start);
      this.emit(encodeInt(BigInt(width)), locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_MUL, locationData); // [prefix, start*W]
      this.popFromStack();
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      // 4. re-frame with the new count (= slicedSize / W = end - start)
      this.emitPrependArrayCount(width, locationData);
      return node;
    }

    this.visit(node.end);
    this.emit(Op.OP_SPLIT, locationData);
    this.emit(Op.OP_DROP, locationData);
    this.popFromStack(2);
    this.pushToStack('(value)');

    this.visit(node.start);
    this.emit(Op.OP_SPLIT, locationData);
    this.emit(Op.OP_NIP, locationData);
    this.popFromStack(2);
    this.pushToStack('(value)');

    return node;
  }

  /** Emit short-circuit && / || : `a && b` as `a ? b : false`, `a || b` as `a ? true : b`. */
  private emitShortCircuitBoolean(node: BinaryOpNode): Node {
    const startLoc = { location: node.location, positionHint: PositionHint.START };
    const endLoc = { location: node.location, positionHint: PositionHint.END };
    node.left = this.visit(node.left);
    this.popFromStack(); // condition consumed by OP_IF
    this.emit(Op.OP_IF, startLoc);
    const snapshot = [...this.stack];
    if (node.operator === BinaryOperator.AND) {
      node.right = this.visit(node.right);
      this.emit(Op.OP_ELSE, endLoc);
      this.stack = [...snapshot];
      this.emit(encodeInt(0n), endLoc);
      this.pushToStack('(value)');
    } else {
      this.emit(encodeInt(1n), startLoc);
      this.pushToStack('(value)');
      this.emit(Op.OP_ELSE, endLoc);
      this.stack = [...snapshot];
      node.right = this.visit(node.right);
    }
    this.emit(Op.OP_ENDIF, endLoc);
    return node;
  }

  // Int on stack -> its bits/8-byte two's-complement bytes. Add 2^bits when negative, NUM2BIN to
  // bits/8+1 bytes, keep the low bits/8 (drops the sign-pad byte). Stack: one value -> one value.
  private emitToTwosComplementBytes(type: IntType, loc: SingleLocationData): void {
    const byteLen = BigInt(type.bits / 8);
    if (type.signed) {
      this.emit(Op.OP_DUP, loc);
      this.emit(encodeInt(0n), loc);
      this.emit(Op.OP_LESSTHAN, loc);
      this.emit(encodeInt(1n << BigInt(type.bits)), loc);
      this.emit(Op.OP_MUL, loc);
      this.emit(Op.OP_ADD, loc);
    }
    this.emit(encodeInt(byteLen + 1n), loc);
    this.emit(Op.OP_NUM2BIN, loc);
    this.emit(encodeInt(byteLen), loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_DROP, loc);
  }

  // Inverse of emitToTwosComplementBytes: bits/8-byte two's-complement bytes on stack -> int.
  private emitFromTwosComplementBytes(type: IntType, loc: SingleLocationData): void {
    this.emit(new Uint8Array([0x00]), loc); // sign-pad so BIN2NUM reads an unsigned value in [0, 2^bits)
    this.emit(Op.OP_CAT, loc);
    this.emit(Op.OP_BIN2NUM, loc);
    if (type.signed) {
      // Reinterpret the high bit as a sign: if u >= 2^(bits-1), u -= 2^bits.
      this.emit(Op.OP_DUP, loc);
      this.emit(encodeInt(1n << BigInt(type.bits - 1)), loc);
      this.emit(Op.OP_GREATERTHANOREQUAL, loc);
      this.emit(Op.OP_IF, loc);
      this.emit(encodeInt(1n << BigInt(type.bits)), loc);
      this.emit(Op.OP_SUB, loc);
      this.emit(Op.OP_ENDIF, loc);
    }
  }

  // Integer bitwise & | ^ : two's-complement bytes -> byte-wise op -> back to int.
  private emitIntBitwise(node: BinaryOpNode): Node {
    const type = node.type as IntType;
    const loc = { location: node.location, positionHint: PositionHint.END };
    node.left = this.visit(node.left);
    this.emitToTwosComplementBytes(type, loc);
    node.right = this.visit(node.right);
    this.emitToTwosComplementBytes(type, loc);
    const byteOp = node.operator === BinaryOperator.BIT_AND ? Op.OP_AND
      : node.operator === BinaryOperator.BIT_OR ? Op.OP_OR : Op.OP_XOR;
    this.emit(byteOp, loc);
    this.popFromStack(2);
    this.pushToStack('(value)');
    this.emitFromTwosComplementBytes(type, loc);
    return node;
  }

  // Big-endian fixed-bytes blob on stack -> unsigned number. Reverse to little-endian, sign-pad with
  // 0x00 so the high bit is not read as a sign, BIN2NUM. Stack: one value -> one value.
  private emitBytesToBigEndianNum(loc: SingleLocationData): void {
    this.emit(Op.OP_REVERSEBYTES, loc);
    this.emit(new Uint8Array([0x00]), loc);
    this.emit(Op.OP_CAT, loc);
    this.emit(Op.OP_BIN2NUM, loc);
  }

  // bytesN ordering < <= > >= : compare both operands as unsigned big-endian numbers.
  private emitBytesCompare(node: BinaryOpNode): Node {
    const loc = { location: node.location, positionHint: PositionHint.END };
    node.left = this.visit(node.left);
    this.emitBytesToBigEndianNum(loc);
    node.right = this.visit(node.right);
    this.emitBytesToBigEndianNum(loc);
    this.emit(compileBinaryOp(node.operator, true), loc);
    this.popFromStack(2);
    this.pushToStack('(value)');
    return node;
  }

  visitBinaryOp(node: BinaryOpNode): Node {
    // Short-circuit && / || (Solidity semantics): the right operand is only evaluated when needed.
    if (node.operator === BinaryOperator.AND || node.operator === BinaryOperator.OR) {
      return this.emitShortCircuitBoolean(node);
    }
    // Integer bitwise (fixed-width two's-complement) when the result is a bounded int.
    if ((node.operator === BinaryOperator.BIT_AND || node.operator === BinaryOperator.BIT_OR
      || node.operator === BinaryOperator.BIT_XOR) && node.type instanceof IntType) {
      return this.emitIntBitwise(node);
    }
    // bytesN / address ordering: compare the byte values as unsigned big-endian numbers (an address is byte
    // data, the BCH analogue of EVM's uint160 address ordering).
    if ((node.operator === BinaryOperator.LT || node.operator === BinaryOperator.LE
      || node.operator === BinaryOperator.GT || node.operator === BinaryOperator.GE)
      && (node.left.type instanceof BytesType || node.left.type instanceof AddressType)) {
      return this.emitBytesCompare(node);
    }
    node.left = this.visit(node.left);
    const bothOperandsAreNumeric = isNumericType(node.left.type) && isNumericType(node.right.type);
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // FixedType DIV: pre-scale the dividend before visiting right operand
    // Stack: [..., left_scaled], we need (left * 10^N * 10^N) / (right * 10^N) = (left/right) * 10^N
    if (node.type instanceof FixedType && node.operator === BinaryOperator.DIV) {
      this.emit(encodeInt(node.type.scaleFactor), locationData);
      this.emit(Op.OP_MUL, locationData);
    }

    node.right = this.visit(node.right);

    // Exponentiation: no BCH opcode; compile-time eval for constant operands, loop for runtime
    if (node.operator === BinaryOperator.POW) {
      // Solidity: exponent must be unsigned (non-negative). Reject negative literal exponents.
      if (node.right instanceof IntLiteralNode && node.right.value < 0n) {
        throw new Error(`Negative exponent ${node.right.value} in exponentiation at ${node.location}`);
      }
      // Check if both operands are compile-time constants
      if (node.left instanceof IntLiteralNode && node.right instanceof IntLiteralNode) {
        // Compile-time evaluation: replace stack top two with the result
        this.popFromStack(2);
        const result = node.left.value ** node.right.value;
        this.emit(encodeInt(result), locationData);
        this.pushToStack('(value)');
      } else {
        // Runtime paths: guard against negative exponents (Solidity: exponent must be unsigned)
        // Stack: [..., base, exp]
        this.emit(Op.OP_DUP, locationData);
        this.emit(encodeInt(0n), locationData);
        this.emit(Op.OP_GREATERTHANOREQUAL, locationData);
        this.emit(Op.OP_VERIFY, locationData);
        // Stack: [..., base, exp] (unchanged, DUP was consumed by VERIFY)

        if (node.left instanceof IntLiteralNode && node.left.value === 1n) {
        // Optimization: 1 ** exp -> 1 (drop both operands, push 1)
          this.emit(Op.OP_2DROP, locationData);
          this.popFromStack(2);
          this.emit(encodeInt(1n), locationData);
          this.pushToStack('(value)');
        } else if (node.left instanceof IntLiteralNode && node.left.value === 0n) {
        // Optimization: 0 ** exp -> exp == 0 ? 1 : 0
        // Runtime stack: [..., 0, exp]
          this.emit(Op.OP_SWAP, locationData);           // [..., exp, 0]
          this.emit(Op.OP_DROP, locationData);            // [..., exp]
          this.emit(encodeInt(0n), locationData);
          this.emit(Op.OP_NUMEQUAL, locationData);        // [..., exp==0]
          // exp==0 -> true(1) -> result=1; exp!=0 -> false(0) -> result=0
          this.popFromStack(2);
          this.pushToStack('(value)');
        } else if (node.left instanceof IntLiteralNode && node.left.value === 2n) {
        // Optimization: 2 ** exp -> 1 << exp (single bitshift, O(1) instead of O(n) loop)
        // Runtime stack: [..., 2, exp]
          this.emit(Op.OP_SWAP, locationData);          // [..., exp, 2]
          this.emit(Op.OP_DROP, locationData);           // [..., exp]
          this.emit(encodeInt(1n), locationData);        // [..., exp, 1]
          this.emit(Op.OP_SWAP, locationData);           // [..., 1, exp]
          this.emit(Op.OP_LSHIFTNUM, locationData);     // [..., 1 << exp]
          this.popFromStack(2);
          this.pushToStack('(value)');
        } else {
        // General runtime base^exp (exp >= 0, guarded above): result = 1; while (exp > 0) { result *= base; exp--; }
        // Loop invariant stack: [base, result, exp] (top = exp). Net effect: [base, exp] -> [result].
          this.emit(encodeInt(1n), locationData);       // [base, exp, 1]
          this.emit(Op.OP_SWAP, locationData);          // [base, 1, exp] = [base, result, exp]
          this.emit(Op.OP_BEGIN, locationData);
          this.emit(Op.OP_DUP, locationData);           // [base, result, exp, exp]
          this.emit(encodeInt(0n), locationData);
          this.emit(Op.OP_GREATERTHAN, locationData);   // [base, result, exp, exp > 0]
          this.emit(Op.OP_IF, locationData);            // exp > 0: multiply then decrement
          this.emit(encodeInt(1n), locationData);
          this.emit(Op.OP_SUB, locationData);           // [base, result, exp-1]
          this.emit(Op.OP_SWAP, locationData);          // [base, exp-1, result]
          this.emit(encodeInt(2n), locationData);
          this.emit(Op.OP_PICK, locationData);          // [base, exp-1, result, base]
          this.emit(Op.OP_MUL, locationData);           // [base, exp-1, result*base]
          this.emit(Op.OP_SWAP, locationData);          // [base, result*base, exp-1]
          this.emit(encodeInt(0n), locationData);       // push false -> continue the loop
          this.emit(Op.OP_ELSE, locationData);          // exp <= 0: done
          this.emit(encodeInt(1n), locationData);       // push true -> exit the loop
          this.emit(Op.OP_ENDIF, locationData);
          this.emit(Op.OP_UNTIL, locationData);
          this.emit(Op.OP_DROP, locationData);          // [base, result] (exp is 0)
          this.emit(Op.OP_NIP, locationData);           // [result]
          this.popFromStack(2);
          this.pushToStack('(value)');
        }
      }
    } else {
      this.emit(
        compileBinaryOp(node.operator, bothOperandsAreNumeric),
        locationData,
      );
      this.popFromStack(2);
      this.pushToStack('(value)');
    }
    if (node.operator === BinaryOperator.SPLIT) this.pushToStack('(value)');
    // Emit overflow/underflow check for bounded integer arithmetic
    if (node.type instanceof IntType) {
      this.emitIntBoundsCheck(node.type, locationData);
    }
    // FixedType scale adjustments and bounds checks
    if (node.type instanceof FixedType) {
      if (node.operator === BinaryOperator.MUL) {
        // MUL doubles the scale: (a * 10^N) * (b * 10^N) = a*b * 10^(2N)
        // Divide by scaleFactor to correct back to 10^N
        this.emit(encodeInt(node.type.scaleFactor), locationData);
        this.emit(Op.OP_DIV, locationData);
      }
      // DIV: pre-scaling was done above, before right operand
      // MOD: (a * 10^N) % (b * 10^N) = (a%b) * 10^N - no adjustment needed
      // ADD/SUB: same scale, no adjustment needed
      // Bounds check for fixed-point
      this.emitFixedBoundsCheck(node.type, locationData);
    }
    return node;
  }

  visitUnaryOp(node: UnaryOpNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // Chunk-packed FIXED-WIDTH array `.length`: count = A$len / elementWidth - cheap (no chunk reads).
    // Special-cased BEFORE visiting the expression so we don't reassemble the whole array just to read its
    // length. A variable-width array has no fixed width, so it falls through to the normal array `.length`
    // path below (reassemble the blob, decode the count prefix).
    if (node.operator === UnaryOperator.SIZE && node.expression instanceof StateAccessNode
      && node.expression.stateVariable?.isDynamic && node.expression.stateVariable.type instanceof ArrayType
      && isFixedWidthType((node.expression.stateVariable.type as ArrayType).elementType)) {
      const sv = node.expression.stateVariable;
      const width = getFixedWidth((sv.type as ArrayType).elementType);
      const pending = this.pendingDynamicWrites.get(sv.name);
      if (pending) {
        // read-after-write: the new tight blob is on the stack; count = OP_SIZE(blob) / width
        this.emit(encodeInt(BigInt(this.getStackIndex(pending.valueStackName))), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.emit(Op.OP_SIZE, locationData);
        this.emit(Op.OP_NIP, locationData);
        this.emit(encodeInt(BigInt(width)), locationData);
        this.emit(Op.OP_DIV, locationData);
        this.pushToStack('(value)');
      } else {
        // persisted: count = A$len header / width
        this.emitReadDynamicLen(sv, '(arrlen)', locationData);
        this.emit(encodeInt(BigInt(width)), locationData);
        this.emit(Op.OP_DIV, locationData);
        this.stack[this.getStackIndex('(arrlen)')] = '(value)';
      }
      return node;
    }

    node.expression = this.visit(node.expression);

    // For .length on arrays: decode the length prefix instead of using SIZE
    if (node.operator === UnaryOperator.SIZE && node.expression.type instanceof ArrayType) {
      // Stack: [..., blob]
      // Decode length prefix: [blob] -> [length, remainder]
      this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
      // Stack: [..., length, remainder]
      this.emit(Op.OP_DROP, locationData); // [..., length]
      this.popFromStack(); // remove blob tracking
      this.pushToStack('(value)');
      return node;
    }

    // Integer bitwise NOT: ~a = mask - a (mask = -1 signed, 2^bits-1 unsigned). OP_INVERT is disabled.
    if (node.operator === UnaryOperator.INVERT && node.type instanceof IntType) {
      const mask = node.type.signed ? -1n : (1n << BigInt(node.type.bits)) - 1n;
      this.emit(encodeInt(mask), locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_SUB, locationData);
      return node;
    }

    this.emit(compileUnaryOp(node.operator), locationData);
    this.popFromStack();
    this.pushToStack('(value)');

    // Emit overflow check for negation of bounded int types
    if (node.operator === UnaryOperator.NEGATE && node.type instanceof IntType) {
      this.emitIntBoundsCheck(node.type, locationData);
    }
    if (node.operator === UnaryOperator.NEGATE && node.type instanceof FixedType) {
      this.emitFixedBoundsCheck(node.type, locationData);
    }

    return node;
  }

  /**
   * Sum an introspection value over every input or output, leaving ONE accumulated number on the stack.
   * countOp = OP_TXINPUTCOUNT | OP_TXOUTPUTCOUNT; perElem consumes the index already on the stack and leaves
   * one numeric value (e.g. [OP_UTXOVALUE], or [OP_INPUTBYTECODE, OP_SIZE, OP_NIP] for the script length).
   * Net +1 on the stack; the caller tracks the single result. Loops over indices n-1..0.
   */
  private emitIntrospectionSum(countOp: Op, perElem: (Op | Uint8Array)[], loc: SingleLocationData): void {
    this.emit([
      countOp,                                  // [n]
      encodeInt(0n), Op.OP_SWAP,                // [acc=0, counter=n]
      Op.OP_BEGIN,
      Op.OP_1SUB,                               // [acc, idx]
      Op.OP_DUP,                                // [acc, idx, idx]
      ...perElem,                               // [acc, idx, value]
      Op.OP_ROT, Op.OP_ADD,                     // [idx, acc+value]
      Op.OP_SWAP,                               // [acc', counter'=idx]
      Op.OP_DUP, encodeInt(0n), Op.OP_NUMEQUAL, // [acc', counter', counter'==0]
      Op.OP_UNTIL,
      Op.OP_DROP,                               // [acc']
    ], loc);
  }

  /**
   * tx.gasprice: the transaction's realized fee rate in sat/KB - 1000 * (sum input sats - sum output sats) /
   * tx_size. tx_size is reconstructed from introspection (there is no OP_TXSIZE): header (10 = version 4 +
   * locktime 4 + two 1-byte count varints) + per input (41 = 32 outpoint txid + 4 vout + 4 sequence + 1
   * script-length varint) + unlocking length + per output (9 = 8 value + 1 script-length varint) + locking
   * length. The 1-byte script-length varint is an estimate; a >252-byte script undercounts by 2 bytes,
   * negligible for a fee rate. Entirely the current tx - no oracle, no co-spend, no state.
   */
  private emitTxGasprice(loc: SingleLocationData): void {
    // fee = sum(input sats) - sum(output sats)
    this.emitIntrospectionSum(Op.OP_TXINPUTCOUNT, [Op.OP_UTXOVALUE], loc);     // [val_in]
    this.emitIntrospectionSum(Op.OP_TXOUTPUTCOUNT, [Op.OP_OUTPUTVALUE], loc);  // [val_in, val_out]
    this.emit(Op.OP_SUB, loc);                                                 // [fee]
    // in_size = sum(unlocking script len) + 41 * nIn
    this.emitIntrospectionSum(Op.OP_TXINPUTCOUNT, [Op.OP_INPUTBYTECODE, Op.OP_SIZE, Op.OP_NIP], loc); // [fee, bc_in]
    this.emit([Op.OP_TXINPUTCOUNT, encodeInt(41n), Op.OP_MUL, Op.OP_ADD], loc);     // [fee, in_size]
    // out_size = sum(locking script len) + 9 * nOut
    // [fee, in_size, bc_out]
    this.emitIntrospectionSum(Op.OP_TXOUTPUTCOUNT, [Op.OP_OUTPUTBYTECODE, Op.OP_SIZE, Op.OP_NIP], loc);
    this.emit([Op.OP_TXOUTPUTCOUNT, encodeInt(9n), Op.OP_MUL, Op.OP_ADD], loc);     // [fee, in_size, out_size]
    // size = in_size + out_size + 10 (header)
    this.emit([Op.OP_ADD, encodeInt(10n), Op.OP_ADD], loc);                         // [fee, size]
    // gasprice = 1000 * fee / size
    this.emit([Op.OP_SWAP, encodeInt(1000n), Op.OP_MUL, Op.OP_SWAP, Op.OP_DIV], loc); // [gasprice]
  }

  visitNullaryOp(node: NullaryOpNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    switch (node.operator) {
      case NullaryOperator.MSG_SENDER:
        this.emitMsgSender(locationData);
        break;
      case NullaryOperator.MSG_VALUE:
        this.emitMsgValue(locationData);
        break;
      case NullaryOperator.MSG_SIG:
        this.emitMsgSig(locationData);
        break;
      case NullaryOperator.MSG_DATA:
        this.emitMsgData(locationData);
        break;
      case NullaryOperator.TX_ORIGIN:
        this.emitTxOrigin(locationData);
        break;
      case NullaryOperator.CHAIN_ID:
        // block.chainid is uint256 (Solidity parity). Emit the network selector as its UNSIGNED byte value
        // (`chainId & 0xff`: mainnet 0, chipnet 1, testnet4 2, regtest 255) so it is a valid non-negative
        // uint256, encoded minimally (<=2 bytes) rather than a fixed-width 32-byte value.
        this.emit(encodeInt(BigInt(this.compilerOptions.chainId ?? 0) & 0xffn), locationData);
        break;
      case NullaryOperator.BLOCK_PREVRANDAO:
        // Transaction-local randomness shim: abs(int(sha256(input[0] prevout txid))). No secure source on
        // BCH; grindable by the tx-builder (SynthesizeBlockOracle warns; see docs/block-and-transaction-properties.md). ABS
        // makes the 32-byte hash a non-negative uint so `prevrandao % N` behaves.
        this.emit([Op.OP_0, Op.OP_OUTPOINTTXHASH, Op.OP_SHA256, Op.OP_BIN2NUM, Op.OP_ABS], locationData);
        break;
      case NullaryOperator.TX_GASPRICE:
        this.emitTxGasprice(locationData);
        break;
      default:
        this.emit(compileNullaryOp(node.operator), locationData);
        break;
    }

    this.pushToStack('(value)');
    return node;
  }

  visitTernaryOp(node: TernaryOpNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // Evaluate condition
    node.condition = this.visit(node.condition);
    this.popFromStack();

    // OP_IF
    this.emit(Op.OP_IF, locationData);

    // Evaluate ifTrue branch
    const stackBeforeBranch = [...this.stack];
    node.ifTrue = this.visit(node.ifTrue);

    // OP_ELSE
    this.emit(Op.OP_ELSE, { location: node.location, positionHint: PositionHint.END });

    // Restore stack for else branch
    this.stack = [...stackBeforeBranch];
    node.ifFalse = this.visit(node.ifFalse);

    // OP_ENDIF
    this.emit(Op.OP_ENDIF, { location: node.location, positionHint: PositionHint.END });

    // Both branches leave one value on the stack
    return node;
  }

  visitArray(node: ArrayNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };

    if (node.blobEncoded) {
      const arrType = node.type as ArrayType;
      const elemType = arrType.elementType;
      const fixedWidth = isFixedWidthType(elemType);

      // Encode length prefix using abi.encode (minimal pushdata)
      this.emit(encodeInt(BigInt(node.elements.length)), locationData);
      this.pushToStack('(length)');
      this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);

      if (node.elements.length === 0) {
        // Empty array: just the length prefix (0x00 = 1 byte)
        return node;
      }

      // Encode and concatenate each element
      for (let i = 0; i < node.elements.length; i++) {
        this.visit(node.elements[i]);
        if (fixedWidth) {
          // abi.encodePacked: for bool, convert to canonical 1-byte form
          this.emitEncodeElementPacked(elemType, locationData);
        } else {
          // abi.encode: pushdata minimal encoding
          this.emitPushdataEncode(elemType, locationData);
        }
        this.emit(Op.OP_CAT, locationData);
        this.popFromStack(2);
        this.pushToStack('(value)');
      }

      return node;
    }

    // Standard array (for checkMultiSig etc.): push elements + count
    node.elements = this.visitList(node.elements);
    this.emit(encodeInt(BigInt(node.elements.length)), locationData);
    this.pushToStack('(value)');
    return node;
  }

  visitNewArray(node: NewArrayNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const elemType = node.elementType;
    const fixedWidth = isFixedWidthType(elemType);

    // `new bytes(n)` (runtime n): n zero bytes, no length prefix. `0 n OP_NUM2BIN`.
    if (node.rawBytes) {
      node.size = this.visit(node.size);       // [..., n]
      this.emit(Op.OP_0, locationData);         // [..., n, 0]
      this.emit(Op.OP_SWAP, locationData);      // [..., 0, n]
      this.emit(Op.OP_NUM2BIN, locationData);   // [..., zero_bytes]
      this.popFromStack();
      this.pushToStack('(value)');
      return node;
    }

    // Evaluate size expression - pushes n onto stack
    node.size = this.visit(node.size);
    // stack: [..., n]

    // Duplicate n: one copy for length prefix, one for element byte count
    this.emit(Op.OP_DUP, locationData);
    this.pushToStack('(n_dup)');
    // stack: [..., n, n_dup]

    // Encode the duplicate as pushdata length prefix
    this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
    // stack: [..., n, len_prefix]

    // Swap so n is on top for byte count computation
    this.emit(Op.OP_SWAP, locationData);
    // stack: [..., len_prefix, n]

    if (fixedWidth) {
      const width = getFixedWidth(elemType);
      if (width > 1) {
        // Multiply n by element width to get total byte count
        this.emit(encodeInt(BigInt(width)), locationData);
        this.emit(Op.OP_MUL, locationData);
      }
      // For width == 1 (bool, int8, bytes1): byte_count = n
    }
    // For variable-width types: each default element is 1 byte (0x00), byte_count = n

    // Create zero-filled bytes: 0 byte_count OP_NUM2BIN
    this.emit(Op.OP_0, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_NUM2BIN, locationData);
    // stack: [..., len_prefix, zero_bytes]

    // Concatenate length prefix and element data
    this.emit(Op.OP_CAT, locationData);
    this.popFromStack(2);
    this.pushToStack('(value)');
    // stack: [..., blob]

    return node;
  }

  // Encode a value to fixed-width bytes for abi.encodePacked format
  private emitEncodeElementPacked(elemType: Type, locationData: SingleLocationData): void {
    if (elemType === PrimitiveType.BOOL) {
      // Canonical 1-byte: OP_IF <1> OP_ELSE <0> OP_ENDIF <1> OP_NUM2BIN
      this.emit(Op.OP_IF, locationData);
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_ELSE, locationData);
      this.emit(encodeInt(0n), locationData);
      this.emit(Op.OP_ENDIF, locationData);
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_NUM2BIN, locationData);
      this.popFromStack();
      this.pushToStack('(value)');
    } else if (elemType instanceof IntType) {
      // Convert VM number to fixed-width sign-magnitude bytes
      this.emit(encodeInt(BigInt(elemType.byteWidth)), locationData);
      this.emit(Op.OP_NUM2BIN, locationData);
    } else if (elemType instanceof FixedType) {
      // Convert VM number to fixed-width sign-magnitude bytes
      this.emit(encodeInt(BigInt(elemType.byteWidth)), locationData);
      this.emit(Op.OP_NUM2BIN, locationData);
    } else if (elemType instanceof ArrayType && elemType.bound !== undefined) {
      // A fixed-inner row value (`pushdata(count) ++ tight elements`) stores as just the tight element blob:
      // strip the leading count prefix, so rows sit back-to-back at a fixed stride (bound * innerWidth).
      this.emitPushdataDecode(PrimitiveType.BIGINT, locationData); // [count, elements]
      this.emit(Op.OP_NIP, locationData); // [elements]
    }
    // For bytesN/pubkey: already correct width, no encoding needed
    // For structs of bounded fields: already correct width
  }

  // Decode a fixed-width element from raw bytes
  private emitDecodeElementPacked(elemType: Type, locationData: SingleLocationData): void {
    if (elemType === PrimitiveType.BOOL) {
      this.emit(Op.OP_BIN2NUM, locationData);
    } else if (elemType instanceof IntType) {
      // Convert fixed-width sign-magnitude bytes back to VM number
      this.emit(Op.OP_BIN2NUM, locationData);
    } else if (elemType instanceof FixedType) {
      // Convert fixed-width sign-magnitude bytes back to VM number
      this.emit(Op.OP_BIN2NUM, locationData);
    } else if (elemType instanceof ArrayType && elemType.bound !== undefined) {
      // A fixed-inner row is stored tight (no count prefix); reframe it into a proper array value by prepending
      // its element count, so `a[i]` behaves like a normal array (and `a[i][j]` can index into it).
      this.emitPrependArrayCount(getFixedWidth(elemType.elementType), locationData);
    }
    // For bytesN/pubkey: already in correct format
  }

  // Emit bounds check: require(index < length). Consumes length, keeps index.
  // Stack before: [..., index, length]
  // Stack after:  [..., index]
  private emitBoundsCheck(locationData: SingleLocationData): void {
    // [..., index, length]
    this.emit(Op.OP_OVER, locationData); // [..., index, length, index]
    this.emit(Op.OP_GREATERTHAN, locationData); // [..., index, (length > index)]
    this.emit(Op.OP_VERIFY, locationData); // [..., index]
  }

  // Emit overflow/underflow bounds check for bounded integer types.
  // In normal mode: require(value >= min) && require(value <= max)
  // In unchecked mode: wrap value into [min, max] using modular arithmetic
  // Stack before: [..., value]
  // Stack after:  [..., value]  (value unchanged or wrapped)
  private emitIntBoundsCheck(type: IntType, locationData: SingleLocationData): void {
    if (this.uncheckedDepth > 0) {
      this.emitIntWrap(type, locationData);
      return;
    }
    // Check: value >= min
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(type.minValue), locationData);
    this.emit(Op.OP_GREATERTHANOREQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
    // Check: value <= max
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(type.maxValue), locationData);
    this.emit(Op.OP_LESSTHANOREQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
  }

  // Emit overflow/underflow bounds check for fixed-point types (same pattern as int bounds check).
  private emitFixedBoundsCheck(type: FixedType, locationData: SingleLocationData): void {
    if (this.uncheckedDepth > 0) {
      this.emitFixedWrap(type, locationData);
      return;
    }
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(type.minValue), locationData);
    this.emit(Op.OP_GREATERTHANOREQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(type.maxValue), locationData);
    this.emit(Op.OP_LESSTHANOREQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
  }

  // Emit modular wrapping for bounded integer types (unchecked mode).
  // For unsigned: value = ((value % range) + range) % range
  // For signed: shift to unsigned, wrap, shift back
  // Stack before: [..., value]
  // Stack after:  [..., wrapped_value]
  private emitIntWrap(type: IntType, locationData: SingleLocationData): void {
    const range = 1n << BigInt(type.bits);
    if (!type.signed) {
      // Unsigned wrap: ((value % range) + range) % range
      this.emit(encodeInt(range), locationData);
      this.emit(Op.OP_MOD, locationData);
      this.emit(encodeInt(range), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(encodeInt(range), locationData);
      this.emit(Op.OP_MOD, locationData);
    } else {
      // Signed wrap: shift to unsigned domain, wrap, shift back
      const min = -(1n << BigInt(type.bits - 1));
      // value - min -> unsigned domain
      this.emit(encodeInt(min), locationData);
      this.emit(Op.OP_SUB, locationData);
      // ((shifted % range) + range) % range
      this.emit(encodeInt(range), locationData);
      this.emit(Op.OP_MOD, locationData);
      this.emit(encodeInt(range), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(encodeInt(range), locationData);
      this.emit(Op.OP_MOD, locationData);
      // shift back: + min
      this.emit(encodeInt(min), locationData);
      this.emit(Op.OP_ADD, locationData);
    }
  }

  // Emit modular wrapping for fixed-point types (unchecked mode).
  // Same wrapping logic as int types - fixed-point values are integers internally.
  private emitFixedWrap(type: FixedType, locationData: SingleLocationData): void {
    const range = 1n << BigInt(type.bits);
    if (!type.signed) {
      this.emit(encodeInt(range), locationData);
      this.emit(Op.OP_MOD, locationData);
      this.emit(encodeInt(range), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(encodeInt(range), locationData);
      this.emit(Op.OP_MOD, locationData);
    } else {
      const min = -(1n << BigInt(type.bits - 1));
      this.emit(encodeInt(min), locationData);
      this.emit(Op.OP_SUB, locationData);
      this.emit(encodeInt(range), locationData);
      this.emit(Op.OP_MOD, locationData);
      this.emit(encodeInt(range), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(encodeInt(range), locationData);
      this.emit(Op.OP_MOD, locationData);
      this.emit(encodeInt(min), locationData);
      this.emit(Op.OP_ADD, locationData);
    }
  }

  // Emit a scan loop that skips `count` variable-width elements.
  // Stack before: [..., blob, count]
  // Stack after:  [..., remaining_blob]
  private emitScanLoop(elemType: Type, locationData: SingleLocationData): void {
    // Loop: skip count elements from blob
    this.emit(Op.OP_BEGIN, locationData);
    //   Check if counter > 0
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_0NOTEQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    //     Decrement counter, skip one element
    this.emit(Op.OP_1SUB, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emitPushdataSkip(elemType, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(encodeBool(false), locationData); // continue
    this.emit(Op.OP_ELSE, locationData);
    //     Counter is 0, stop
    this.emit(encodeBool(true), locationData); // stop
    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_UNTIL, locationData);
    this.emit(Op.OP_DROP, locationData); // drop counter (0)
  }

  // Index into an array VALUE already on the stack (`pushdata(count) ++ elems`): visits `indexNode`, leaves the
  // element value. Shared by visitArrayAccess and the extra-key drill of a fixed-inner packed state array
  // (`a[i][j]`: after reading the row, index into it).
  private emitIndexIntoArrayBlob(
    elemType: Type, indexNode: ExpressionNode, locationData: SingleLocationData,
  ): ExpressionNode {
    const fixedWidth = isFixedWidthType(elemType);
    this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, length]
    this.popFromStack();
    this.pushToStack('(elements)');
    this.pushToStack('(length)');
    const visitedIndex = this.visit(indexNode) as ExpressionNode;
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, index, length]
    this.emitBoundsCheck(locationData); // [..., elements_blob, index]
    this.popFromStack(2);
    this.pushToStack('(index)');
    if (fixedWidth) {
      const width = getFixedWidth(elemType);
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_MUL, locationData); // [..., elements_blob, offset]
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData); // [..., right]
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SPLIT, locationData); // [..., element, rest]
      this.emit(Op.OP_DROP, locationData); // [..., element]
      this.emitDecodeElementPacked(elemType, locationData);
    } else {
      this.popFromStack(2);
      this.pushToStack('(elements)');
      this.pushToStack('(count)');
      this.emitScanLoop(elemType, locationData);
      this.popFromStack(2);
      this.pushToStack('(remaining)');
      this.emitPushdataDecode(elemType, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.popFromStack();
      this.pushToStack('(value)');
    }
    return visitedIndex;
  }

  visitArrayAccess(node: ArrayAccessNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // bytes[k]: extract the k-th byte. [b, k] OP_SPLIT OP_NIP 1 OP_SPLIT OP_DROP -> [byte].
    // An out-of-range index makes OP_SPLIT fail (natural bounds enforcement).
    if (node.array.type instanceof BytesType) {
      node.array = this.visit(node.array);
      node.index = this.visit(node.index);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      return node;
    }

    const arrType = node.array.type as ArrayType;
    const elemType = arrType.elementType;

    // Push array blob onto stack, then index into it (visits node.index inside the helper).
    node.array = this.visit(node.array);
    node.index = this.emitIndexIntoArrayBlob(elemType, node.index, locationData);

    return node;
  }

  visitArrayPush(node: ArrayPushNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const arrType = node.arrayType!;
    const elemType = arrType.elementType;
    const fixedWidth = isFixedWidthType(elemType);

    // Push array blob via PICK
    const stackIndex = this.getStackIndex(node.name);
    this.emit(encodeInt(BigInt(stackIndex)), { location: node.location, positionHint: PositionHint.START });
    this.emit(Op.OP_PICK, { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(arr)');

    // Decode length prefix: [blob] -> [length, elements_blob]
    this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
    // Bitcoin stack: [..., length, elements_blob]
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, length]
    this.popFromStack(); // remove arr tracking
    this.pushToStack('(elements)');
    this.pushToStack('(length)');

    // Increment length and re-encode prefix
    this.emit(Op.OP_1ADD, locationData); // [..., elements_blob, length+1]
    this.emitPushdataEncode(PrimitiveType.BIGINT, locationData); // [..., elements_blob, new_len_encoded]

    // Prepend new length to elements: swap + CAT
    this.emit(Op.OP_SWAP, locationData); // [..., new_len_encoded, elements_blob]
    this.emit(Op.OP_CAT, locationData); // [..., new_prefix ++ elements_blob]
    this.popFromStack(2);
    this.pushToStack('(value)');

    // Visit and encode the new element value
    node.value = this.visit(node.value);
    if (fixedWidth) {
      this.emitEncodeElementPacked(elemType, locationData);
    } else {
      this.emitPushdataEncode(elemType, locationData);
    }

    // Append: blob ++ encoded_value
    this.emit(Op.OP_CAT, locationData);
    this.popFromStack(2);
    this.pushToStack('(value)');

    // Store back to variable
    this.emitReplace(this.getStackIndex(node.name), node);
    this.popFromStack();

    return node;
  }

  visitArrayPop(node: ArrayPopNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const arrType = node.arrayType!;
    const elemType = arrType.elementType;
    const fixedWidth = isFixedWidthType(elemType);

    // Push array blob via PICK
    const stackIndex = this.getStackIndex(node.name);
    this.emit(encodeInt(BigInt(stackIndex)), { location: node.location, positionHint: PositionHint.START });
    this.emit(Op.OP_PICK, { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(arr)');

    // Decode length prefix: [blob] -> [length, elements_blob]
    this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, length]
    this.popFromStack();
    this.pushToStack('(elements)');
    this.pushToStack('(length)');

    // Check length > 0
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_0NOTEQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);

    // Decrement length
    this.emit(Op.OP_1SUB, locationData); // [..., elements_blob, new_length]

    if (fixedWidth) {
      const width = getFixedWidth(elemType);
      // Re-encode new length
      this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_SWAP, locationData); // [..., new_len_enc, elements_blob]
      // Trim last element
      this.emit(Op.OP_SIZE, locationData); // [..., new_len_enc, elements, size]
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SUB, locationData); // [..., new_len_enc, elements, trim_pos]
      this.emit(Op.OP_SPLIT, locationData); // [..., new_len_enc, trimmed, last_elem]
      this.emit(Op.OP_DROP, locationData); // [..., new_len_enc, trimmed]
      this.emit(Op.OP_CAT, locationData); // [..., new_blob]
      this.popFromStack(2);
      this.pushToStack('(value)');
    } else {
      // Variable-width: scan to element new_length, split there, keep prefix
      // [..., elements_blob, new_length]
      this.emit(Op.OP_TUCK, locationData); // [..., new_length, elements_blob, new_length]
      this.emit(Op.OP_OVER, locationData); // [..., new_length, elements_blob, new_length, elements_copy]
      this.emit(Op.OP_SWAP, locationData); // [..., new_length, elements_blob, elements_copy, new_length]
      // Scan loop on copy to find remaining size
      this.emitScanLoop(elemType, locationData);
      // [..., new_length, elements_blob, remaining_of_copy]
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData); // [..., new_length, elements_blob, remaining_size]
      this.emit(Op.OP_OVER, locationData);
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData); // [..., new_length, elements_blob, rem_size, total_size]
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_SUB, locationData); // [..., new_length, elements_blob, keep_size]
      this.emit(Op.OP_SPLIT, locationData); // [..., new_length, trimmed, rest]
      this.emit(Op.OP_DROP, locationData); // [..., new_length, trimmed]
      this.emit(Op.OP_SWAP, locationData); // [..., trimmed, new_length]
      this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_SWAP, locationData); // [..., new_len_enc, trimmed]
      this.emit(Op.OP_CAT, locationData); // [..., new_blob]
      this.popFromStack(2);
      this.pushToStack('(value)');
    }

    // Store back to variable
    this.emitReplace(this.getStackIndex(node.name), node);
    this.popFromStack();

    return node;
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const arrType = node.arrayType!;
    const elemType = arrType.elementType;
    const fixedWidth = isFixedWidthType(elemType);

    // Push array blob via PICK
    const stackIndex = this.getStackIndex(node.name);
    this.emit(encodeInt(BigInt(stackIndex)), { location: node.location, positionHint: PositionHint.START });
    this.emit(Op.OP_PICK, { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(arr)');

    // Decode length prefix: [blob] -> [length, elements_blob]
    this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, length]
    this.popFromStack();
    this.pushToStack('(elements)');
    this.pushToStack('(length)');

    // Visit index
    node.index = this.visit(node.index);
    // [..., elements_blob, length, index]

    // Bounds check
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, index, length]
    this.emitBoundsCheck(locationData); // [..., elements_blob, index]
    this.popFromStack(2);
    this.pushToStack('(index)');

    if (fixedWidth) {
      const width = getFixedWidth(elemType);
      // Compute byte offset
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_MUL, locationData); // [..., elements_blob, offset]
      this.popFromStack();
      this.pushToStack('(offset)');

      // Split at offset
      this.emit(Op.OP_SPLIT, locationData); // [..., left, right]
      this.popFromStack(2);
      this.pushToStack('(left)');
      this.pushToStack('(right)');

      // Split off old element
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SPLIT, locationData); // [..., left, old_elem, remainder]
      this.emit(Op.OP_NIP, locationData); // [..., left, remainder]
      this.popFromStack();
      this.pushToStack('(remainder)');

      // Encode new value
      node.value = this.visit(node.value);
      this.emitEncodeElementPacked(elemType, locationData);

      // Reassemble: left ++ new_value ++ remainder
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(elements)');
    } else {
      // Variable-width: scan to element, replace, reassemble
      // [..., elements_blob, index]
      // Duplicate elements_blob for size tracking
      this.emit(Op.OP_SWAP, locationData); // [..., index, elements_blob]
      this.emit(Op.OP_DUP, locationData); // [..., index, elements_blob, elements_copy]
      this.emit(Op.OP_ROT, locationData); // [..., elements_blob, elements_copy, index]
      // Scan copy to skip index elements
      this.emitScanLoop(elemType, locationData);
      // [..., elements_blob, remaining_of_copy]
      // remaining starts at element[index]. Get byte offset by measuring.
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData); // [..., elements_blob, remaining_size]
      this.emit(Op.OP_OVER, locationData);
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData); // [..., elements_blob, rem_size, total_size]
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_SUB, locationData); // [..., elements_blob, offset_to_elem]
      this.emit(Op.OP_SPLIT, locationData); // [..., left, elem_and_rest]
      this.popFromStack(2);
      this.pushToStack('(left)');
      this.pushToStack('(elem_and_rest)');

      // Decode and discard old element to get remainder
      this.emitPushdataSkip(elemType, locationData);
      // [..., left, remainder_after_elem]
      this.popFromStack();
      this.pushToStack('(remainder)');

      // Encode new value
      node.value = this.visit(node.value);
      this.emitPushdataEncode(elemType, locationData);

      // Reassemble: left ++ encoded_new ++ remainder
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(elements)');
    }

    // Re-encode with original length prefix (length hasn't changed)
    // We need to get the original blob's length. Since we only modified elements,
    // we can re-read the array to get the original length... but that's wasteful.
    // Alternative: save the length before the assign operation.
    // For now, re-read the old blob and extract its length prefix, then prepend.
    // Actually, simpler: we have the modified elements on stack. We need to
    // get the length back. Let's re-read the original blob for its prefix.
    const stackIdx2 = this.getStackIndex(node.name);
    this.emit(encodeInt(BigInt(stackIdx2)), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.pushToStack('(old_arr)');
    // Decode length from old arr
    this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_DROP, locationData); // drop remainder, keep length
    this.popFromStack();
    this.pushToStack('(length)');
    // Re-encode length and prepend
    this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_SWAP, locationData); // [..., len_enc, elements]
    this.emit(Op.OP_CAT, locationData); // [..., new_blob]
    this.popFromStack(2);
    this.pushToStack('(value)');

    // Store back
    this.emitReplace(this.getStackIndex(node.name), node);
    this.popFromStack();

    return node;
  }

  visitArrayDelete(node: ArrayDeleteNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const arrType = node.arrayType!;
    const elemType = arrType.elementType;
    const fixedWidth = isFixedWidthType(elemType);

    // Delete(i) = swap element[i] with element[length-1], then pop last.
    // Strategy: read last element, assign it to position i, then pop.

    // Push array blob via PICK
    const stackIndex = this.getStackIndex(node.name);
    this.emit(encodeInt(BigInt(stackIndex)), { location: node.location, positionHint: PositionHint.START });
    this.emit(Op.OP_PICK, { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(arr)');

    // Decode length: [blob] -> [length, elements_blob]
    this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, length]
    this.popFromStack();
    this.pushToStack('(elements)');
    this.pushToStack('(length)');

    // Check length > 0
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_0NOTEQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);

    // Visit index
    node.index = this.visit(node.index);
    // [..., elements_blob, length, index]

    // Bounds check: require(index < length)
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, index, length]
    this.emit(Op.OP_OVER, locationData); // [..., elements_blob, index, length, index]
    this.emit(Op.OP_GREATERTHAN, locationData); // [..., elements_blob, index, (length > index)]
    this.emit(Op.OP_VERIFY, locationData); // [..., elements_blob, index]
    this.popFromStack(3); // remove length, index tracking
    this.pushToStack('(elements)');
    this.pushToStack('(index)');

    if (fixedWidth) {
      const width = getFixedWidth(elemType);
      // [..., elements_blob, index]
      // Read last element: at offset (size - width)
      this.emit(Op.OP_OVER, locationData); // [..., elements, index, elements]
      this.emit(Op.OP_SIZE, locationData); // [..., elements, index, elements, size]
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SUB, locationData); // [..., elements, index, elements, last_offset]
      this.emit(Op.OP_SPLIT, locationData); // [..., elements, index, left, last_and_rest]
      this.emit(Op.OP_NIP, locationData); // [..., elements, index, last_and_rest]
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SPLIT, locationData); // [..., elements, index, last_elem, trailing]
      this.emit(Op.OP_DROP, locationData); // [..., elements, index, last_elem]

      // Now write last_elem to position [index], then trim last
      // Compute byte offset for index
      this.emit(Op.OP_ROT, locationData); // [..., index, last_elem, elements]
      this.emit(Op.OP_ROT, locationData); // [..., last_elem, elements, index]
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_MUL, locationData); // [..., last_elem, elements, offset]
      this.emit(Op.OP_SPLIT, locationData); // [..., last_elem, left, right]
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SPLIT, locationData); // [..., last_elem, left, old_elem, remainder]
      this.emit(Op.OP_NIP, locationData); // [..., last_elem, left, remainder]
      this.emit(Op.OP_ROT, locationData); // [..., left, remainder, last_elem]
      this.emit(Op.OP_SWAP, locationData); // [..., left, last_elem, remainder]
      this.emit(Op.OP_CAT, locationData); // [..., left, last_elem ++ remainder]
      this.emit(Op.OP_CAT, locationData); // [..., left ++ last_elem ++ remainder]

      // Trim last element (which is now a duplicate at the end)
      this.emit(Op.OP_SIZE, locationData);
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SUB, locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData); // [..., trimmed_elements]

      this.popFromStack(2);
      this.pushToStack('(elements)');
    } else {
      // Variable-width delete: more complex, use scan-based approach
      // For simplicity, implement as: read last elem, do assign at i, then pop
      // This is less optimal but reuses existing logic patterns

      // [..., elements_blob, index]
      // Save index for later
      this.emit(Op.OP_SWAP, locationData); // [..., index, elements_blob]

      // First, find and extract the last element
      // We need the length. Re-read from original blob.
      const stackIdx = this.getStackIndex(node.name);
      this.emit(encodeInt(BigInt(stackIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(old_arr)');
      this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_DROP, locationData); // drop elements remainder, keep length
      this.popFromStack();
      this.pushToStack('(length)');
      // [..., index, elements_blob, length]
      this.emit(Op.OP_1SUB, locationData); // [..., index, elements_blob, last_index]

      // Scan to last element on a copy
      this.emit(Op.OP_OVER, locationData); // [..., index, elements_blob, last_index, elements_copy]
      this.emit(Op.OP_SWAP, locationData); // [..., index, elements_blob, elements_copy, last_index]
      this.emitScanLoop(elemType, locationData);
      // [..., index, elements_blob, remaining_at_last]
      // Decode last element
      this.emitPushdataDecode(elemType, locationData);
      this.emit(Op.OP_DROP, locationData); // drop trailing remainder, keep decoded last element
      this.popFromStack();
      this.pushToStack('(last_elem)');
      // [..., index, elements_blob, last_elem]

      // Now we need to:
      // 1. Replace element[index] with last_elem in elements_blob
      // 2. Trim last element from blob
      // 3. Re-encode with decremented length

      // Get byte offset of element[index] by scanning a copy
      this.emit(Op.OP_ROT, locationData); // [..., elements_blob, last_elem, index]
      this.emit(Op.OP_ROT, locationData); // [..., last_elem, index, elements_blob]
      this.emit(Op.OP_DUP, locationData); // [..., last_elem, index, elements_blob, elements_copy]
      this.emit(Op.OP_ROT, locationData); // [..., last_elem, elements_blob, elements_copy, index]
      this.emitScanLoop(elemType, locationData);
      // [..., last_elem, elements_blob, remaining_at_index]
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData); // [..., last_elem, elements_blob, rem_size]
      this.emit(Op.OP_OVER, locationData);
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData); // [..., last_elem, elements_blob, rem_size, total_size]
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_SUB, locationData); // [..., last_elem, elements_blob, offset]
      this.emit(Op.OP_SPLIT, locationData); // [..., last_elem, left, elem_and_rest]
      this.emitPushdataSkip(elemType, locationData); // [..., last_elem, left, rest_after_elem]
      this.emit(Op.OP_ROT, locationData); // [..., left, rest_after_elem, last_elem]
      // Encode last_elem
      this.emitPushdataEncode(elemType, locationData);
      this.emit(Op.OP_SWAP, locationData); // [..., left, encoded_last, rest_after_elem]
      this.emit(Op.OP_CAT, locationData); // [..., left, encoded_last ++ rest]
      this.emit(Op.OP_CAT, locationData); // [..., rebuilt_elements_with_swap]

      // Sync tracker: the ROT/DUP/scanLoop/SIZE/NIP/SPLIT/skip/encode/CAT sequence
      // consumed intermediate values, reducing physical stack by 2 vs tracker
      this.popFromStack(3); // remove '(last_elem)'/'(value)', '(index)', '(elements)'
      this.pushToStack('(rebuilt)');

      // Now trim last element (scan to last_index = old_length - 1)
      // Read old length again
      const stackIdx2 = this.getStackIndex(node.name);
      this.emit(encodeInt(BigInt(stackIdx2)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(old_arr2)');
      this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_DROP, locationData); // drop remainder, keep decoded length
      this.popFromStack();
      this.pushToStack('(length2)');
      this.emit(Op.OP_1SUB, locationData); // new_length
      // [..., rebuilt_elements, new_length]

      // Scan copy to find trim point
      this.emit(Op.OP_TUCK, locationData); // [..., new_length, rebuilt_elements, new_length]
      this.emit(Op.OP_OVER, locationData); // [..., new_length, rebuilt_elements, new_length, rebuilt_copy]
      this.emit(Op.OP_SWAP, locationData); // [..., new_length, rebuilt_elements, rebuilt_copy, new_length]
      this.emitScanLoop(elemType, locationData);
      // [..., new_length, rebuilt_elements, remaining]
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_OVER, locationData);
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_SUB, locationData); // [..., new_length, rebuilt_elements, keep_size]
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData); // [..., new_length, trimmed_elements]
      this.emit(Op.OP_SWAP, locationData); // [..., trimmed_elements, new_length]

      this.popFromStack(2); // clean up tracking (keep 'arr')
      this.pushToStack('(elements)');
      this.pushToStack('(new_length)');
    }

    // Re-encode with new length and prepend
    if (fixedWidth) {
      // For fixed-width, we need to get new_length = old_length - 1
      const stackIdx3 = this.getStackIndex(node.name);
      this.emit(encodeInt(BigInt(stackIdx3)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(old_arr3)');
      this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_DROP, locationData); // drop remainder, keep decoded length
      this.popFromStack();
      this.pushToStack('(length3)');
      this.emit(Op.OP_1SUB, locationData);
      this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
    } else {
      // Variable-width: new_length is already on stack
      this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
    }

    // Store back
    this.emitReplace(this.getStackIndex(node.name), node);
    this.popFromStack();

    return node;
  }

  // ===== Packed State Array Operations =====
  // These operations read an array blob from the data NFT commitment,
  // perform the array manipulation, and write the modified blob back
  // as a pending state write.

  /**
   * Read the packed state array blob from state and push it onto the stack.
   * Checks pendingStateWrites first for cached values, then reads from NFT commitment.
   * Stack after: [..., array_blob]  (1 new tracked value named stackLabel)
   */
  private emitReadStateArrayBlob(
    sv: StateVariableNode,
    locationData: SingleLocationData,
    stackLabel: string,
  ): void {
    const key = `${sv.nftIndex}:${sv.fieldIndex}`;

    // Chunk-packed dynamic array: reassemble the element blob -> the same `pushdata(count)++elems` form a
    // packed array has, so the element ops below (index/push/pop) reuse the packed codegen verbatim. For a
    // fixed-width element type the stored blob is tight (count stripped), so prepend count = A$len/width; for
    // a variable-width element type the stored blob already carries its `pushdata(count)` prefix.
    if (sv.isDynamic) {
      this.emitReadDynamicScalar(sv, locationData);
      this.emitReframeDynamicArrayRead(sv, locationData);
      this.stack[0] = stackLabel;
      return;
    }

    if (this.pendingStateWrites.has(key)) {
      // Read from pre-allocated / previously written stack slot
      const stackName = this.pendingStateWrites.get(key)!;
      const stackIdx = this.getStackIndex(stackName);
      this.emit(encodeInt(BigInt(stackIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      // The picked value is pushdata-encoded - for ArrayType, emitPushdataDecodeLastField is a no-op
      this.emitPushdataDecodeLastField(sv.type, locationData);
      this.pushToStack(stackLabel);
    } else {
      // Read from NFT commitment
      const fieldsInNft = this.stateVariables
        .filter((v) => v.nftIndex === sv.nftIndex)
        .sort((a, b) => a.fieldIndex - b.fieldIndex);

      this.emitMasterInputIndex(locationData);
      this.emit(encodeInt(BigInt(this.compactOffsetMap.get(sv.nftIndex)!)), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);

      // Verify the leading nftIndex tag == this field's NFT index (multi-data-NFT anti-substitution, H1)
      if (this.isMultiDataNft()) this.emitNftIndexTagVerify(sv.nftIndex, locationData);

      // Skip preceding fields
      for (let i = 0; i < sv.fieldIndex; i++) {
        this.emitPushdataSkip(this.physicalFieldType(fieldsInNft[i]), locationData);
      }

      // Decode this field - for ArrayType as last field, this is a no-op
      const isLast = sv.fieldIndex === fieldsInNft[fieldsInNft.length - 1].fieldIndex;
      if (isLast) {
        this.emitPushdataDecodeLastField(sv.type, locationData);
      } else {
        this.emitPushdataDecode(sv.type, locationData);
        this.emit(Op.OP_DROP, locationData); // drop remainder
      }

      this.pushToStack(stackLabel);
    }
  }

  /**
   * Write the array blob on top of stack back to state.
   * Stack before: [..., new_array_blob]  (top of tracked stack is the blob)
   * Stack after: [...] (blob consumed, stored as pending state write)
   */
  private emitWriteStateArrayBlob(
    sv: StateVariableNode,
    node: Node,
    locationData: SingleLocationData,
  ): void {
    const key = `${sv.nftIndex}:${sv.fieldIndex}`;

    // Chunk-packed dynamic array: the blob on top is `pushdata(count)++elems`. For a fixed-width element type
    // store only the tight elements (count recoverable as A$len/width); for a variable-width element type
    // keep the count prefix (it cannot be recovered). The epilogue's chunk write loop handles the rest.
    if (sv.isDynamic) {
      this.emitRegisterDynamicWrite(
        sv, key, locationData, isFixedWidthType((sv.type as ArrayType).elementType), node,
      );
      return;
    }

    // Encode to pushdata format - for ArrayType this is a no-op
    this.emitPushdataEncode(sv.type, locationData);

    if (this.preAllocatedStateWrites.has(key)) {
      const stackName = `__internal__state_write_${sv.name}`;
      this.emitReplace(this.getStackIndex(stackName), node);
      this.popFromStack();
    } else {
      this.popFromStack();
      const stackName = `__internal__state_write_${sv.name}`;
      this.pushToStack(stackName);
      this.pendingStateWrites.set(key, stackName);
    }
  }

  /**
   * Register a dynamic-storage write whose value blob is on top of the tracked stack: stores the tight bytes
   * as the pending chunk value (epilogue splits it into chunk outputs) and the uint32 A$len as the data-NFT
   * field. `stripCount` drops a chunk-packed array's leading `pushdata(count)` (recoverable as
   * A$len / elementWidth). Records the write so the SDK consumes old chunks and creates new ones.
   */
  private emitRegisterDynamicWrite(
    sv: StateVariableNode,
    key: string,
    loc: SingleLocationData,
    stripCount: boolean,
    node: Node,
  ): void {
    // Pre-allocated by an enclosing conditional (branch/switch): the value + A$len slots sit below the branch
    // holding the current value, so a not-taken path writes it back unchanged. Replace both slots in place
    // (depth-neutral) rather than pushing new entries that the branch's scope cleanup would drop, and rather
    // than the coalescing drop below (which would remove the below-branch slots and unbalance the stack). A
    // second write to the same var in the branch read this slot (read-modify-write), so replacing supersedes it.
    if (this.preAllocatedDynamicWrites.has(sv.name)) {
      if (stripCount) {
        this.emitPushdataDecode(PrimitiveType.BIGINT, loc); // [count, elements]
        this.emit(Op.OP_NIP, loc); // [elements]
      }
      this.popFromStack();
      this.pushToStack('(dynwrite_newval)'); // new tight value on top
      this.emit(Op.OP_SIZE, loc); // [value, size]
      this.pushToStack('(dynlen)');
      this.emitPushdataEncode(new IntType(false, 32), loc); // [value, A$len]
      this.emitReplace(this.getStackIndex(`__internal__state_write_${sv.name}`), node);
      this.popFromStack(); // A$len stored into its slot; new value back on top
      this.emitReplace(this.getStackIndex(`__internal__dynwrite_value_${sv.name}`), node);
      this.popFromStack(); // new value stored into its slot
      return;
    }
    // W3 coalescing: if a prior write to this var is already pending (arr.push();arr.push(), idx-write +
    // pop, or a re-assignment), the new value on top supersedes it - and already incorporates the prior one
    // via read-after-write (emitReadDynamicScalar). Drop the prior pending value blob and its A$len
    // state-write (both below the new value), then re-register below as the sole pending write for this var.
    if (this.pendingDynamicWrites.has(sv.name)) {
      const prevValue = this.pendingDynamicWrites.get(sv.name)!.valueStackName;
      for (const tmp of [`__internal__state_write_${sv.name}`, prevValue]) {
        const idx = this.getStackIndex(tmp);
        this.emit(encodeInt(BigInt(idx)), loc);
        this.emit(Op.OP_ROLL, loc);
        this.emit(Op.OP_DROP, loc);
        this.removeFromStack(idx);
      }
      this.pendingDynamicWrites.delete(sv.name);
      this.pendingStateWrites.delete(key);
      this.preAllocatedStateWrites.delete(key);
    }
    if (stripCount) {
      this.emitPushdataDecode(PrimitiveType.BIGINT, loc); // [count, elements]
      this.emit(Op.OP_NIP, loc); // [elements]
    }
    const valueStackName = `__internal__dynwrite_value_${sv.name}`;
    this.popFromStack();
    this.pushToStack(valueStackName); // keep value for the epilogue chunk loop

    // Register field = uint32 byte length (A$len), kept on the stack as the pending state write.
    this.emit(Op.OP_SIZE, loc); // [value, size] - OP_SIZE leaves value, pushes size
    this.pushToStack('(dynlen)');
    this.emitPushdataEncode(new IntType(false, 32), loc); // [value, len_encoded]
    this.popFromStack();
    const stateWriteStackName = `__internal__state_write_${sv.name}`;
    this.pushToStack(stateWriteStackName);
    this.pendingStateWrites.set(key, stateWriteStackName);
    this.preAllocatedStateWrites.add(key);

    this.pendingDynamicWrites.set(sv.name, { valueStackName, sv });
    const writes = (this.currentFunction.dynamicWrites ??= []);
    if (!writes.includes(sv.name)) writes.push(sv.name);
  }

  visitStateArrayPush(node: StateArrayPushNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const sv = node.stateVariable!;
    const arrType = sv.type as ArrayType;
    const elemType = arrType.elementType;
    const fixedWidth = isFixedWidthType(elemType);

    // 1. Read array blob from state
    this.emitReadStateArrayBlob(sv, locationData, '(arr)');

    // 2. Decode length prefix: [blob] -> [length, elements_blob]
    this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, length]
    this.popFromStack(); // remove arr tracking
    this.pushToStack('(elements)');
    this.pushToStack('(length)');

    // 3. Increment length and re-encode prefix
    this.emit(Op.OP_1ADD, locationData);
    this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);

    // 4. Prepend new length to elements: swap + CAT
    this.emit(Op.OP_SWAP, locationData); // [..., new_len_encoded, elements_blob]
    this.emit(Op.OP_CAT, locationData); // [..., new_prefix ++ elements_blob]
    this.popFromStack(2);
    this.pushToStack('(value)');

    // 5. Visit and encode the new element value
    node.value = this.visit(node.value);
    if (fixedWidth) {
      this.emitEncodeElementPacked(elemType, locationData);
    } else {
      this.emitPushdataEncode(elemType, locationData);
    }

    // 6. Append: blob ++ encoded_value
    this.emit(Op.OP_CAT, locationData);
    this.popFromStack(2);
    this.pushToStack('(value)');

    // 7. Write back to state
    this.emitWriteStateArrayBlob(sv, node, locationData);

    return node;
  }

  visitStateArrayPop(node: StateArrayPopNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const sv = node.stateVariable!;
    const arrType = sv.type as ArrayType;
    const elemType = arrType.elementType;
    const fixedWidth = isFixedWidthType(elemType);

    // 1. Read array blob from state
    this.emitReadStateArrayBlob(sv, locationData, '(arr)');

    // 2. Decode length prefix: [blob] -> [length, elements_blob]
    this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, length]
    this.popFromStack();
    this.pushToStack('(elements)');
    this.pushToStack('(length)');

    // 3. Check length > 0
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_0NOTEQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);

    // 4. Decrement length
    this.emit(Op.OP_1SUB, locationData);

    if (fixedWidth) {
      const width = getFixedWidth(elemType);
      // Re-encode new length
      this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_SWAP, locationData); // [..., new_len_enc, elements_blob]
      // Trim last element
      this.emit(Op.OP_SIZE, locationData);
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SUB, locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData); // [..., new_len_enc, trimmed]
      this.emit(Op.OP_CAT, locationData); // [..., new_blob]
      this.popFromStack(2);
      this.pushToStack('(value)');
    } else {
      // Variable-width: scan to element new_length, split there, keep prefix
      this.emit(Op.OP_TUCK, locationData);
      this.emit(Op.OP_OVER, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emitScanLoop(elemType, locationData);
      // [..., new_length, elements_blob, remaining_of_copy]
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_OVER, locationData);
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_SUB, locationData); // [..., new_length, elements_blob, keep_size]
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData); // [..., new_length, trimmed]
      this.emit(Op.OP_SWAP, locationData); // [..., trimmed, new_length]
      this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_SWAP, locationData); // [..., new_len_enc, trimmed]
      this.emit(Op.OP_CAT, locationData); // [..., new_blob]
      this.popFromStack(2);
      this.pushToStack('(value)');
    }

    // 5. Write back to state
    this.emitWriteStateArrayBlob(sv, node, locationData);

    return node;
  }

  visitStateArrayAssign(node: StateArrayAssignNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const sv = node.stateVariable!;
    const arrType = sv.type as ArrayType;
    const elemType = arrType.elementType;
    const fixedWidth = isFixedWidthType(elemType);

    // 1. Read array blob from state
    this.emitReadStateArrayBlob(sv, locationData, '(arr)');

    // 2. Decode length prefix: [blob] -> [length, elements_blob]
    this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, length]
    this.popFromStack();
    this.pushToStack('(elements)');
    this.pushToStack('(length)');

    // 3. Visit index
    node.index = this.visit(node.index);
    // [..., elements_blob, length, index]

    // 4. Bounds check
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, index, length]
    this.emitBoundsCheck(locationData); // [..., elements_blob, index]
    this.popFromStack(2);
    this.pushToStack('(index)');

    if (fixedWidth) {
      const width = getFixedWidth(elemType);
      // Compute byte offset
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_MUL, locationData);
      this.popFromStack();
      this.pushToStack('(offset)');

      // Split at offset
      this.emit(Op.OP_SPLIT, locationData); // [..., left, right]
      this.popFromStack(2);
      this.pushToStack('(left)');
      this.pushToStack('(right)');

      // Split off old element
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SPLIT, locationData); // [..., left, old_elem, remainder]
      this.emit(Op.OP_NIP, locationData); // [..., left, remainder]
      this.popFromStack();
      this.pushToStack('(remainder)');

      // Encode new value
      node.value = this.visit(node.value);
      this.emitEncodeElementPacked(elemType, locationData);

      // Reassemble: left ++ new_value ++ remainder
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(elements)');
    } else {
      // Variable-width: scan to element, replace, reassemble
      this.emit(Op.OP_SWAP, locationData); // [..., index, elements_blob]
      this.emit(Op.OP_DUP, locationData); // [..., index, elements_blob, elements_copy]
      this.emit(Op.OP_ROT, locationData); // [..., elements_blob, elements_copy, index]
      this.emitScanLoop(elemType, locationData);
      // [..., elements_blob, remaining_of_copy]
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_OVER, locationData);
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_SUB, locationData); // [..., elements_blob, offset_to_elem]
      this.emit(Op.OP_SPLIT, locationData); // [..., left, elem_and_rest]
      this.popFromStack(2);
      this.pushToStack('(left)');
      this.pushToStack('(elem_and_rest)');

      // Decode and discard old element to get remainder
      this.emitPushdataSkip(elemType, locationData);
      this.popFromStack();
      this.pushToStack('(remainder)');

      // Encode new value
      node.value = this.visit(node.value);
      this.emitPushdataEncode(elemType, locationData);

      // Reassemble: left ++ encoded_new ++ remainder
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(elements)');
    }

    // Re-encode with original length prefix. We need to get the original length.
    // Re-read the state blob to extract its length prefix, then prepend.
    this.emitReadStateArrayBlob(sv, { location: node.location, positionHint: PositionHint.END }, '(old_arr)');
    this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_DROP, locationData); // drop remainder, keep length
    this.popFromStack();
    this.pushToStack('(length)');
    this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_SWAP, locationData); // [..., len_enc, elements]
    this.emit(Op.OP_CAT, locationData); // [..., new_blob]
    this.popFromStack(2);
    this.pushToStack('(value)');

    // Write back to state
    this.emitWriteStateArrayBlob(sv, node, locationData);

    return node;
  }

  visitStateArrayDelete(node: StateArrayDeleteNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const sv = node.stateVariable!;
    const arrType = sv.type as ArrayType;
    const elemType = arrType.elementType;
    const fixedWidth = isFixedWidthType(elemType);

    // Delete(i) = swap element[i] with element[length-1], then pop last.

    // 1. Read array blob from state
    this.emitReadStateArrayBlob(sv, locationData, '(arr)');

    // 2. Decode length: [blob] -> [length, elements_blob]
    this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, length]
    this.popFromStack();
    this.pushToStack('(elements)');
    this.pushToStack('(length)');

    // 3. Check length > 0
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_0NOTEQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);

    // 4. Visit index
    node.index = this.visit(node.index);
    // [..., elements_blob, length, index]

    // 5. Bounds check: require(index < length)
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, index, length]
    this.emit(Op.OP_OVER, locationData); // [..., elements_blob, index, length, index]
    this.emit(Op.OP_GREATERTHAN, locationData); // [..., elements_blob, index, (length > index)]
    this.emit(Op.OP_VERIFY, locationData); // [..., elements_blob, index]
    this.popFromStack(3); // remove length, index tracking
    this.pushToStack('(elements)');
    this.pushToStack('(index)');

    if (fixedWidth) {
      const width = getFixedWidth(elemType);
      // [..., elements_blob, index]
      // Read last element: at offset (size - width)
      this.emit(Op.OP_OVER, locationData);
      this.emit(Op.OP_SIZE, locationData);
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SUB, locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData); // [..., elements, index, last_elem]

      // Write last_elem to position [index], then trim last
      this.emit(Op.OP_ROT, locationData); // [..., index, last_elem, elements]
      this.emit(Op.OP_ROT, locationData); // [..., last_elem, elements, index]
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_MUL, locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData); // [..., last_elem, left, remainder]
      this.emit(Op.OP_ROT, locationData); // [..., left, remainder, last_elem]
      this.emit(Op.OP_SWAP, locationData); // [..., left, last_elem, remainder]
      this.emit(Op.OP_CAT, locationData); // [..., left, last_elem ++ remainder]
      this.emit(Op.OP_CAT, locationData); // [..., left ++ last_elem ++ remainder]

      // Trim last element (now a duplicate at the end)
      this.emit(Op.OP_SIZE, locationData);
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SUB, locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData); // [..., trimmed_elements]

      this.popFromStack(2);
      this.pushToStack('(elements)');
    } else {
      // Variable-width delete

      // [..., elements_blob, index]
      // Save index for later
      this.emit(Op.OP_SWAP, locationData); // [..., index, elements_blob]

      // Find and extract the last element - read length from state blob
      this.emitReadStateArrayBlob(sv, locationData, '(old_arr)');
      this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_DROP, locationData); // drop elements remainder, keep length
      this.popFromStack();
      this.pushToStack('(length)');
      // [..., index, elements_blob, length]
      this.emit(Op.OP_1SUB, locationData); // [..., index, elements_blob, last_index]

      // Scan to last element on a copy
      this.emit(Op.OP_OVER, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emitScanLoop(elemType, locationData);
      // [..., index, elements_blob, remaining_at_last]
      // Decode last element
      this.emitPushdataDecode(elemType, locationData);
      this.emit(Op.OP_DROP, locationData); // drop trailing remainder
      this.popFromStack();
      this.pushToStack('(last_elem)');
      // [..., index, elements_blob, last_elem]

      // Replace element[index] with last_elem, then trim last
      this.emit(Op.OP_ROT, locationData); // [..., elements_blob, last_elem, index]
      this.emit(Op.OP_ROT, locationData); // [..., last_elem, index, elements_blob]
      this.emit(Op.OP_DUP, locationData);
      this.emit(Op.OP_ROT, locationData); // [..., last_elem, elements_blob, elements_copy, index]
      this.emitScanLoop(elemType, locationData);
      // [..., last_elem, elements_blob, remaining_at_index]
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_OVER, locationData);
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_SUB, locationData); // [..., last_elem, elements_blob, offset]
      this.emit(Op.OP_SPLIT, locationData); // [..., last_elem, left, elem_and_rest]
      this.emitPushdataSkip(elemType, locationData); // [..., last_elem, left, rest_after_elem]
      this.emit(Op.OP_ROT, locationData); // [..., left, rest_after_elem, last_elem]
      this.emitPushdataEncode(elemType, locationData);
      this.emit(Op.OP_SWAP, locationData); // [..., left, encoded_last, rest_after_elem]
      this.emit(Op.OP_CAT, locationData);
      this.emit(Op.OP_CAT, locationData); // [..., rebuilt_elements_with_swap]

      this.popFromStack(3); // remove tracking entries
      this.pushToStack('(rebuilt)');

      // Trim last element (scan to last_index = old_length - 1)
      this.emitReadStateArrayBlob(sv, locationData, '(old_arr2)');
      this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_DROP, locationData); // drop remainder, keep decoded length
      this.popFromStack();
      this.pushToStack('(length2)');
      this.emit(Op.OP_1SUB, locationData); // new_length
      // [..., rebuilt_elements, new_length]

      // Scan copy to find trim point
      this.emit(Op.OP_TUCK, locationData);
      this.emit(Op.OP_OVER, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emitScanLoop(elemType, locationData);
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_OVER, locationData);
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_SUB, locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData); // [..., new_length, trimmed_elements]
      this.emit(Op.OP_SWAP, locationData); // [..., trimmed_elements, new_length]

      this.popFromStack(2);
      this.pushToStack('(elements)');
      this.pushToStack('(new_length)');
    }

    // Re-encode with new length and prepend
    if (fixedWidth) {
      // For fixed-width, get new_length = old_length - 1
      this.emitReadStateArrayBlob(sv, locationData, '(old_arr3)');
      this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_DROP, locationData); // drop remainder, keep decoded length
      this.popFromStack();
      this.pushToStack('(length3)');
      this.emit(Op.OP_1SUB, locationData);
      this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
    } else {
      // Variable-width: new_length is already on stack
      this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
    }

    // Write back to state
    this.emitWriteStateArrayBlob(sv, node, locationData);

    return node;
  }

  /**
   * Emit bytecode for packed state array element access: this.arr[index]
   * Reads the array blob from state, decodes length, bounds-checks, and extracts element.
   */
  private emitPackedStateArrayAccess(node: MappingAccessNode): Node {
    const sv = node.packedStateVariable!;
    const arrType = sv.type as ArrayType;
    const elemType = arrType.elementType;
    const fixedWidth = isFixedWidthType(elemType);
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // 1. Read array blob from state
    this.emitReadStateArrayBlob(sv, locationData, '(arr)');

    // 2. Decode length prefix: [blob] -> [length, elements_blob]
    this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, length]
    this.popFromStack(); // remove arr tracking
    this.pushToStack('(elements)');
    this.pushToStack('(length)');

    // 3. Visit index expression (keys[0] for packed state arrays)
    node.keys[0] = this.visit(node.keys[0]);
    // [..., elements_blob, length, index]

    // 4. Bounds check: require(index < length)
    this.emit(Op.OP_SWAP, locationData); // [..., elements_blob, index, length]
    this.emitBoundsCheck(locationData); // [..., elements_blob, index]
    this.popFromStack(2); // remove length and index tracking
    this.pushToStack('(index)');

    if (fixedWidth) {
      const width = getFixedWidth(elemType);
      // O(1) access: compute byte offset
      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_MUL, locationData); // [..., elements_blob, offset]

      this.emit(Op.OP_SPLIT, locationData); // [..., left, right]
      this.emit(Op.OP_NIP, locationData); // [..., right]
      this.popFromStack(2);
      this.pushToStack('(value)');

      this.emit(encodeInt(BigInt(width)), locationData);
      this.emit(Op.OP_SPLIT, locationData); // [..., element, rest]
      this.emit(Op.OP_DROP, locationData); // [..., element]

      this.emitDecodeElementPacked(elemType, locationData);
    } else {
      // O(n) access: scan loop to skip `index` elements
      this.popFromStack(2);
      this.pushToStack('(elements)');
      this.pushToStack('(count)');
      this.emitScanLoop(elemType, locationData);
      this.popFromStack(2);
      this.pushToStack('(remaining)');

      // Decode the target element from remaining
      this.emitPushdataDecode(elemType, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.popFromStack();
      this.pushToStack('(value)');
    }

    // Extra keys drill into a fixed-inner array element: `a[i][j]` reads the row (above) then indexes into it.
    let rowType: Type = elemType;
    for (let k = 1; k < node.keys.length; k++) {
      const rowArr = rowType as ArrayType;
      node.keys[k] = this.emitIndexIntoArrayBlob(rowArr.elementType, node.keys[k], locationData);
      rowType = rowArr.elementType;
    }

    return node;
  }

  visitConstantDefinition(node: ConstantDefinitionNode): Node {
    // No-op: constants are inlined at usage sites
    return node;
  }

  visitIdentifier(node: IdentifierNode): Node {
    // Function pointer value: push the target's integer functionId (an indirect call OP_INVOKEs it).
    if (node.functionReference) {
      this.emit(encodeInt(BigInt(node.functionReference.functionId!)),
        { location: node.location, positionHint: PositionHint.START });
      this.pushToStack('(value)');
      return node;
    }

    // Inline constant expressions instead of stack lookup
    const constExpr = this.constantExpressions.get(node.name);
    if (constExpr) {
      this.visit(constExpr);
      return node;
    }

    const stackIndex = this.getStackIndex(node.name);
    this.emit(encodeInt(BigInt(stackIndex)), { location: node.location, positionHint: PositionHint.START });

    // If the final use is inside an if-statement, we still OP_PICK it
    // We do this so that there's no difference in stack depths between execution paths
    if (this.isOpRoll(node)) {
      const symbol = node.definition!;
      this.finalStackUsage[node.name] = {
        type: symbol.type.toString(),
        stackIndex,
        ip: this.getMostRecentInstructionPointer(),
      };

      this.emit(Op.OP_ROLL, { location: node.location, positionHint: PositionHint.START });
      this.removeFromStack(stackIndex);
    } else {
      this.emit(Op.OP_PICK, { location: node.location, positionHint: PositionHint.START });
    }

    this.pushToStack('(value)');
    return node;
  }

  isOpRoll(node: IdentifierNode): boolean {
    return this.currentFunction.opRolls.get(node.name) === node && this.scopeDepth === 0;
  }

  visitBoolLiteral(node: BoolLiteralNode): Node {
    this.emit(encodeBool(node.value), { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(value)');
    return node;
  }

  visitIntLiteral(node: IntLiteralNode): Node {
    this.emit(encodeInt(node.value), { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(value)');
    return node;
  }

  visitDecimalLiteral(node: DecimalLiteralNode): Node {
    const fixedType = node.type as FixedType;
    const scaledValue = node.scaledValue(fixedType.decimals);
    this.emit(encodeInt(scaledValue), { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(value)');
    return node;
  }

  visitStringLiteral(node: StringLiteralNode): Node {
    this.emit(encodeString(node.value), { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(value)');
    return node;
  }

  visitHexLiteral(node: HexLiteralNode): Node {
    // A placeholder for an unsupported-but-valid construct (e.g. `new bytes(n)` with a runtime length) that was
    // deferred from AstBuilder so non-primary contracts do not fail the file; error now that it is being compiled.
    if (node.codegenError) throw new Error(node.codegenError);
    this.emit(node.value, { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(value)');
    return node;
  }

  // ===== Struct Support =====

  visitStructDefinition(_node: StructDefinitionNode): Node {
    return _node;
  }

  visitTypeDefinition(_node: TypeDefinitionNode): Node {
    return _node;
  }

  visitEventDefinition(_node: EventDefinitionNode): Node {
    return _node;
  }

  visitEmitStatement(node: EmitStatementNode): Node {
    const eventDef = node.eventDefinition!;
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // Visit and pushdata-encode each argument, then OP_CAT them into a single blob
    if (node.args.length === 0) {
      // Zero-arg emit: push empty bytes as the commitment blob
      this.emit(encodeInt(0n), locationData);
      this.pushToStack('(value)');
    }

    node.args.forEach((arg, i) => {
      arg = this.visit(arg);
      node.args[i] = arg;

      // Encode each argument value to pushdata format
      this.emitPushdataEncode(eventDef.parameters[i].type, locationData);

      // CAT with previous if not the first
      if (i > 0) {
        this.emit(Op.OP_CAT, locationData);
        this.popFromStack(2);
        this.pushToStack('(value)');
      }
    });

    const stackName = `__internal__emit_${node.emitIndex}`;

    if (this.preAllocatedEmits.has(node.emitIndex)) {
      // Pre-allocated path: replace the dummy slot with the computed blob
      this.emitReplace(this.getStackIndex(stackName), node);
      this.popFromStack();
      // Register in pendingEmits if not already there
      if (!this.pendingEmits.some((e) => e.emitIndex === node.emitIndex)) {
        this.pendingEmits.push({ emitIndex: node.emitIndex, stackName, eventDef });
      }
    } else {
      // Normal path (outside branches)
      this.popFromStack();
      this.pushToStack(stackName);
      this.pendingEmits.push({ emitIndex: node.emitIndex, stackName, eventDef });
    }

    return node;
  }

  // `selfdestruct(addr)`: the implied selfdestruct modifier collapses all state UTXOs (no recreation); here we
  // pin the freed balance to addr. Two checks: (1) tx.outputs[0].lockingBytecode == addr (the destination), and
  // (2) tx has exactly one output, so the collapsed value can only land at addr (or be left as miner fee) - it
  // cannot be siphoned to a second recipient. So the contract's end-of-life value reaches addr, whoever spends.
  visitSelfdestructStatement(node: SelfdestructStatementNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.END };
    // (1) Address pin: tx.outputs[0].lockingBytecode == addr
    node.recipient = this.visit(node.recipient);          // [recipient_lb]
    this.emit(encodeInt(0n), locationData);               // [recipient_lb, 0]
    this.pushToStack('(value)');
    this.emit(Op.OP_OUTPUTBYTECODE, locationData);        // [recipient_lb, output0_lb]
    this.emit(Op.OP_EQUALVERIFY, locationData);           // []
    this.popFromStack(2);
    // (2) Value pin: exactly one output, so the freed value cannot be siphoned to a second recipient.
    this.emit(Op.OP_TXOUTPUTCOUNT, locationData);         // [outputCount]
    this.pushToStack('(value)');
    this.emit(encodeInt(1n), locationData);               // [outputCount, 1]
    this.pushToStack('(value)');
    this.emit(Op.OP_NUMEQUALVERIFY, locationData);        // []
    this.popFromStack(2);
    // (3) Value floor: the tx fee (sum of input sats - the single output's sats) must be < 2000, so the
    // freed balance cannot be burned to miner fee. With (1)+(2)+(3), at least (inputs - 2000) reaches addr.
    this.emitSelfdestructFeeFloor(locationData);
    return node;
  }

  // Sum every input's satoshi value, then require (inputSum - outputs[0].value) < SELFDESTRUCT_MAX_FEE. The
  // single-output pin (visitSelfdestructStatement step 2) makes outputs[0].value the whole output sum, so this
  // bounds the actual transaction fee. Loop idiom mirrors emitDelegateSelfPreservation: accumulator + counter on
  // the stack, counter dropped on exit; the loop body is depth-balanced so it is not tracked per-op.
  private emitSelfdestructFeeFloor(locationData: SingleLocationData): void {
    this.emit(encodeInt(0n), locationData);               // inputSum = 0
    this.pushToStack('(sd_insum)');
    this.emit(Op.OP_TXINPUTCOUNT, locationData);
    this.emit(Op.OP_1SUB, locationData);                  // i = inputCount - 1
    this.pushToStack('(sd_i)');

    this.emit(Op.OP_BEGIN, locationData);
    this.emit(Op.OP_DUP, locationData);                   // [sum, i, i]
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_LESSTHAN, locationData);              // [sum, i, i<0]
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_DROP, locationData);                  // exit: drop i -> [sum]
    this.emit(encodeBool(true), locationData);
    this.emit(Op.OP_ELSE, locationData);
    this.emit(Op.OP_DUP, locationData);                   // [sum, i, i]
    this.emit(Op.OP_UTXOVALUE, locationData);             // [sum, i, value_i]
    this.emit(Op.OP_ROT, locationData);                   // [i, value_i, sum]
    this.emit(Op.OP_ADD, locationData);                   // [i, sum+value_i]
    this.emit(Op.OP_SWAP, locationData);                  // [sum', i]
    this.emit(Op.OP_1SUB, locationData);                  // [sum', i-1]
    this.emit(encodeBool(false), locationData);
    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_UNTIL, locationData);
    this.popFromStack();                                  // (sd_i) dropped on exit -> [sum]

    this.emit(encodeInt(0n), locationData);               // output index 0
    this.emit(Op.OP_OUTPUTVALUE, locationData);           // [sum, outputs[0].value]
    this.pushToStack('(value)');
    this.emit(Op.OP_SUB, locationData);                   // [fee]
    this.popFromStack();
    this.emit(encodeInt(2000n), locationData);            // SELFDESTRUCT_MAX_FEE
    this.pushToStack('(value)');
    this.emit(Op.OP_LESSTHAN, locationData);              // [fee < 2000]
    this.popFromStack();
    this.emit(Op.OP_VERIFY, locationData);
    this.popFromStack();                                  // (sd_insum)
  }

  visitTransferStatement(node: TransferStatementNode): Node {
    if (this.preAllocatedTransfers.has(node.transferIndex)) {
      // Pre-allocated path: use emitReplace to update the dummy slots
      const lbName = `__internal__transfer_lb_${node.transferIndex}`;
      const amtName = `__internal__transfer_amt_${node.transferIndex}`;

      // Visit lockingBytecode expression and replace pre-allocated slot
      node.lockingBytecode = this.visit(node.lockingBytecode);
      this.emitReplace(this.getStackIndex(lbName), node);
      this.popFromStack();

      // Visit amount expression and replace pre-allocated slot
      node.amount = this.visit(node.amount);
      this.emitReplace(this.getStackIndex(amtName), node);
      this.popFromStack();
    } else {
      // Normal path (outside branches)
      node.lockingBytecode = this.visit(node.lockingBytecode);
      this.popFromStack();
      const lbStackName = `__internal__transfer_lb_${node.transferIndex}`;
      this.pushToStack(lbStackName);

      node.amount = this.visit(node.amount);
      this.popFromStack();
      const amtStackName = `__internal__transfer_amt_${node.transferIndex}`;
      this.pushToStack(amtStackName);

      this.pendingTransfers.push({
        transferIndex: node.transferIndex,
        lockingBytecodeStackName: lbStackName,
        amountStackName: amtStackName,
      });
    }

    return node;
  }

  visitAddressTransferStatement(node: AddressTransferStatementNode): Node {
    // The address value IS the locking bytecode to send to.
    if (this.preAllocatedTransfers.has(node.transferIndex)) {
      // Pre-allocated path: use emitReplace to update the dummy slots
      const lbName = `__internal__transfer_lb_${node.transferIndex}`;
      const amtName = `__internal__transfer_amt_${node.transferIndex}`;

      // Visit address expression
      node.addressExpression = this.visit(node.addressExpression);
      this.emitReplace(this.getStackIndex(lbName), node);
      this.popFromStack();

      // Visit amount expression and replace pre-allocated slot
      node.amount = this.visit(node.amount);
      this.emitReplace(this.getStackIndex(amtName), node);
      this.popFromStack();
    } else {
      // Normal path (outside branches)
      node.addressExpression = this.visit(node.addressExpression);
      this.popFromStack();
      const lbStackName = `__internal__transfer_lb_${node.transferIndex}`;
      this.pushToStack(lbStackName);

      node.amount = this.visit(node.amount);
      this.popFromStack();
      const amtStackName = `__internal__transfer_amt_${node.transferIndex}`;
      this.pushToStack(amtStackName);

      this.pendingTransfers.push({
        transferIndex: node.transferIndex,
        lockingBytecodeStackName: lbStackName,
        amountStackName: amtStackName,
      });
    }

    return node;
  }

  visitAddressSendExpression(node: AddressSendExpressionNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // Same as AddressTransferStatement but push OP_1 (true) as the expression result.
    // The address value IS the locking bytecode to send to.
    if (this.preAllocatedTransfers.has(node.transferIndex)) {
      const lbName = `__internal__transfer_lb_${node.transferIndex}`;
      const amtName = `__internal__transfer_amt_${node.transferIndex}`;

      node.addressExpression = this.visit(node.addressExpression);
      this.emitReplace(this.getStackIndex(lbName), node);
      this.popFromStack();

      node.amount = this.visit(node.amount);
      this.emitReplace(this.getStackIndex(amtName), node);
      this.popFromStack();
    } else {
      node.addressExpression = this.visit(node.addressExpression);
      this.popFromStack();
      const lbStackName = `__internal__transfer_lb_${node.transferIndex}`;
      this.pushToStack(lbStackName);

      node.amount = this.visit(node.amount);
      this.popFromStack();
      const amtStackName = `__internal__transfer_amt_${node.transferIndex}`;
      this.pushToStack(amtStackName);

      this.pendingTransfers.push({
        transferIndex: node.transferIndex,
        lockingBytecodeStackName: lbStackName,
        amountStackName: amtStackName,
      });
    }

    // Push true as return value (BCH tx is invalid on failure, so send always "succeeds")
    this.emit(encodeBool(true), locationData);
    this.pushToStack('(value)');

    return node;
  }

  /**
   * Emit a value transfer for {value: X} call options.
   * Sends the satoshis to the callee's address (the address param IS the locking bytecode)
   * and queues a transfer output with the specified amount.
   */
  private emitValueTransfer(
    valueTransferIndex: number,
    valueExpr: ExpressionNode,
    addressParamName: string,
    locationData: SingleLocationData,
    node: Node,
  ): ExpressionNode {
    // Push the callee address (locking bytecode) to stack via OP_PICK
    const addrIdx = this.getStackIndex(addressParamName);
    this.emit(encodeInt(BigInt(addrIdx)), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.pushToStack('(__valTransferAddr)');

    if (this.preAllocatedTransfers.has(valueTransferIndex)) {
      // Pre-allocated branch path: replace dummy slots
      const lbName = `__internal__transfer_lb_${valueTransferIndex}`;
      const amtName = `__internal__transfer_amt_${valueTransferIndex}`;

      this.emitReplace(this.getStackIndex(lbName), node);
      this.popFromStack();

      const visitedValue = this.visit(valueExpr);
      this.emitReplace(this.getStackIndex(amtName), node);
      this.popFromStack();
      return visitedValue;
    }

    // Normal path: push lbc and amount to stack, queue transfer
    this.popFromStack();
    const lbStackName = `__internal__transfer_lb_${valueTransferIndex}`;
    this.pushToStack(lbStackName);

    const visitedValue = this.visit(valueExpr);
    this.popFromStack();
    const amtStackName = `__internal__transfer_amt_${valueTransferIndex}`;
    this.pushToStack(amtStackName);

    this.pendingTransfers.push({
      transferIndex: valueTransferIndex,
      lockingBytecodeStackName: lbStackName,
      amountStackName: amtStackName,
    });

    return visitedValue;
  }

  visitTokenContainerMethodStatement(node: TokenContainerMethodStatementNode): Node {
    const transferIndex = node.transferIndex; // Pre-assigned by SymbolTableTraversal

    if (this.preAllocatedTokenContainerTransfers.has(transferIndex)) {
      // Pre-allocated path: use emitReplace to update the dummy slots
      const catStackName = `__tc_cat_${transferIndex}`;

      // Visit key expression and replace pre-allocated slot
      node.tokenContainerKeyExpression = this.visit(node.tokenContainerKeyExpression);
      this.emitReplace(this.getStackIndex(catStackName), node);
      this.popFromStack();

      // Visit method arguments and replace pre-allocated slots
      for (let i = 0; i < node.args.length; i++) {
        node.args[i] = this.visit(node.args[i]);
        const argName = `__tc_arg_${transferIndex}_${i}`;
        this.emitReplace(this.getStackIndex(argName), node);
        this.popFromStack();
      }

      // Update the pre-registered pendingTokenContainerTransfer entry
      const existing = this.pendingTokenContainerTransfers.find((ds) => ds.transferIndex === transferIndex);
      if (existing) {
        existing.tokenContainerSlotIndex = node.tokenContainerSlotIndex;
        existing.method = node.methodName as 'transfer' | 'transferNft';
      }
    } else {
      // Normal path (outside branches)
      this.tokenContainerTransferCounter = Math.max(this.tokenContainerTransferCounter, transferIndex + 1);

      // Visit key expression (category)
      node.tokenContainerKeyExpression = this.visit(node.tokenContainerKeyExpression);
      this.popFromStack();
      const catStackName = `__tc_cat_${transferIndex}`;
      this.pushToStack(catStackName);

      const argStackNames: string[] = [];

      // Visit method arguments
      for (let i = 0; i < node.args.length; i++) {
        node.args[i] = this.visit(node.args[i]);
        this.popFromStack();
        const argName = `__tc_arg_${transferIndex}_${i}`;
        this.pushToStack(argName);
        argStackNames.push(argName);
      }

      this.pendingTokenContainerTransfers.push({
        transferIndex,
        tokenContainerSlotIndex: node.tokenContainerSlotIndex,
        method: node.methodName as 'transfer' | 'transferNft',
        argStackNames: [catStackName, ...argStackNames],
      });
    }

    return node;
  }

  visitFieldAccess(node: FieldAccessNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // Handle token container field access: this.tokens[cat].tokenAmount etc.
    if (node.expression instanceof MappingAccessNode && node.expression.isTokenContainerAccess) {
      return this.emitTokenContainerFieldAccess(node);
    }

    // Handle this.outState.balance - own satoshi container, summed over OUTPUTS.
    // (this.outState pushes the contract's own category; derive its satoshi container lbc.)
    if (node.name === 'balance'
        && node.expression instanceof StateAccessNode && node.expression.name === 'outState') {
      node.expression = this.visit(node.expression);
      // Stack: [category]
      this.emitSatoshiContainerLbc(locationData);
      // Stack: [container_lbc]
      this.emitBalanceLoop(true, locationData);
      // Stack: [sum]
      return node;
    }

    // Handle .balance on AddressType - loop over inputs summing matching values
    if (node.name === 'balance' && node.expression.type instanceof AddressType) {
      node.expression = this.visit(node.expression);
      // Stack: [lbc]
      this.emitBalanceLoop(false, locationData);
      // Stack: [sum]
      return node;
    }

    // Handle .codehash on AddressType - extract hash from P2SH locking bytecode
    if (node.name === 'codehash' && node.expression.type instanceof AddressType) {
      node.expression = this.visit(node.expression);
      // Stack: [lbc]
      this.emitCodehash(locationData);
      // Stack: [hash]
      return node;
    }

    // Handle .code on AddressType - extract redeem script
    if (node.name === 'code' && node.expression.type instanceof AddressType) {
      node.expression = this.visit(node.expression);
      // Stack: [lbc]
      this.emitCode(locationData);
      // Stack: [redeemScript]
      return node;
    }

    // Handle enum member access: Color.Red -> push int literal
    if (node.enumType) {
      const member = node.enumType.members.find((m) => m.name === node.name)!;
      this.emit(encodeInt(member.value), locationData);
      this.pushToStack('(value)');
      return node;
    }

    const structType = node.structType!;

    // Visit inner expression - pushes struct blob onto stack
    node.expression = this.visit(node.expression);

    // Find the target field index
    const fieldIndex = structType.fields.findIndex((f) => f.name === node.name);

    // Skip preceding fields
    for (let i = 0; i < fieldIndex; i++) {
      this.emitPushdataSkip(structType.fields[i].type, locationData);
    }

    // Decode target field
    const isLast = fieldIndex === structType.fields.length - 1;
    if (isLast) {
      this.emitPushdataDecodeLastField(structType.fields[fieldIndex].type, locationData);
    } else {
      this.emitPushdataDecode(structType.fields[fieldIndex].type, locationData);
      // Drop remainder
      this.emit(Op.OP_DROP, locationData);
    }

    // Stack: replaced the struct blob with the decoded field value
    this.popFromStack();
    this.pushToStack('(value)');

    return node;
  }

  visitTypeIntrospection(node: TypeIntrospectionNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    if (node.property === 'min') {
      if (node.resolvedType instanceof IntType) {
        this.emit(encodeInt(node.resolvedType.minValue), locationData);
      } else if (node.resolvedType instanceof FixedType) {
        this.emit(encodeInt(node.resolvedType.minValue), locationData);
      } else if (node.resolvedType instanceof EnumType) {
        const minVal = node.resolvedType.members.reduce(
          (min, m) => (m.value < min ? m.value : min), node.resolvedType.members[0].value,
        );
        this.emit(encodeInt(minVal), locationData);
      }
    } else if (node.property === 'max') {
      if (node.resolvedType instanceof IntType) {
        this.emit(encodeInt(node.resolvedType.maxValue), locationData);
      } else if (node.resolvedType instanceof FixedType) {
        this.emit(encodeInt(node.resolvedType.maxValue), locationData);
      } else if (node.resolvedType instanceof EnumType) {
        const maxVal = node.resolvedType.members.reduce(
          (max, m) => (m.value > max ? m.value : max), node.resolvedType.members[0].value,
        );
        this.emit(encodeInt(maxVal), locationData);
      }
    } else if (node.property === 'interfaceId') {
      this.emit(node.precomputedBytes!, locationData);
    } else if (node.property === 'name') {
      this.emit(encodeString(node.contractName!), locationData);
    } else if (node.property === 'creationCode' || node.property === 'runtimeCode') {
      // The child's compiled redeem script (BCH has no separate creation vs runtime code).
      const bytecode = this.compiledBytecodes.get(node.contractName!);
      if (!bytecode) {
        throw new Error(`Compiled bytecode for contract '${node.contractName}' not available`);
      }
      this.emit(bytecode, locationData);
    }

    this.pushToStack('(value)');
    return node;
  }

  visitContractReference(node: ContractReferenceNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };
    const bodyBytecode = this.compiledBytecodes.get(node.contractName);

    if (!bodyBytecode) {
      throw new Error(`Compiled bytecode for contract '${node.contractName}' not available`);
    }

    if (node.constructorArgs.length === 0) {
      // No constructor args: embed the bytecode as a constant
      this.emit(bodyBytecode, locationData);
      this.pushToStack('__contractRef');
      return node;
    }

    // Evaluate all constructor args (pushed onto stack)
    for (const arg of node.constructorArgs) {
      this.visit(arg);
    }

    // Encode first arg (top of stack) as pushdata
    this.emitPushdataEncode(node.constructorArgs[0].type!, locationData);

    // For each subsequent arg: swap to top, encode, CAT
    for (let i = 1; i < node.constructorArgs.length; i++) {
      this.emit(Op.OP_SWAP, locationData);
      this.emitPushdataEncode(node.constructorArgs[i].type!, locationData);
      this.emit(Op.OP_CAT, locationData);
    }

    // CAT with body bytecode
    this.emit(bodyBytecode, locationData);
    this.emit(Op.OP_CAT, locationData);

    // Stack management
    for (let i = 0; i < node.constructorArgs.length; i++) this.popFromStack();
    this.pushToStack('__contractRef');
    return node;
  }

  private emitContractDeployment(node: InstantiationNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };
    const contract = node.referencedContract!;
    const bodyBytecode = this.compiledBytecodes.get(contract.name);

    if (!bodyBytecode) {
      throw new Error(`Compiled bytecode for contract '${contract.name}' not available`);
    }

    // Step 1: Build redeem script on stack (same pattern as visitContractReference).
    // Only CONTRACT-LEVEL parameters (solidcash-style) are redeem-script data pushes. A Solidity-style
    // child's constructor(args) do not enter the address - the SDK instantiates it with no constructor
    // inputs, and the ctor's effect reaches the genesis via the constructor fold (foldedStateInit).
    const bakesCtorArgs = contract.parameters.length > 0;
    if (node.parameters.length === 0 || !bakesCtorArgs) {
      this.emit(bodyBytecode, locationData);
      this.pushToStack('(redeemScript)');
    } else {
      // Evaluate constructor args
      for (const arg of node.parameters) {
        this.visit(arg);
      }
      // Encode first arg as pushdata
      this.emitPushdataEncode(node.parameters[0].type!, locationData);
      // Encode and CAT subsequent args
      for (let i = 1; i < node.parameters.length; i++) {
        this.emit(Op.OP_SWAP, locationData);
        this.emitPushdataEncode(node.parameters[i].type!, locationData);
        this.emit(Op.OP_CAT, locationData);
      }
      // CAT with body bytecode
      this.emit(bodyBytecode, locationData);
      this.emit(Op.OP_CAT, locationData);
      // Stack management
      for (let i = 0; i < node.parameters.length; i++) this.popFromStack();
      this.pushToStack('(redeemScript)');
    }

    // Step 2: Category self-pin (stateful children). Prepend the same prologue the SDK bakes in Contract.ts -
    // <cat||0x02> OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_EQUALVERIFY - so a child deployed via this factory has
    // the identical self-pinned address to one instantiated directly by the SDK (create2 == SDK). The child's
    // category is the genesis input's outpoint txhash (read again in step 4 for the deploy covenant). User salt
    // is a no-op here (factory children default to self-pin only; a salted child is an SDK-side concern).
    if (node.isStatefulDeploy) {
      // Read the genesis category (mirrors step 4): verify the deploy input's vout == 0, take its txhash. For an
      // inline (branch/loop) deploy the genesis input is at the runtime counter offset, so the self-pinned child
      // ADDRESS built here must read the SAME input as the step-4 covenant verification (child k self-pins to
      // input k) - otherwise child k's computed address is pinned to the wrong category and the output check
      // fails. A straight-line deploy keeps the fixed block-layout slot.
      if (this.scopeDepth > 0) {
        const slotBase = this.getBlockSlotOffset('deploy', 0);
        const inputBase = slotBase - this.countOutputOnlySlotsBefore(slotBase);
        this.emitMasterInputIndex(locationData);
        if (inputBase > 0) {
          this.emit(encodeInt(BigInt(inputBase)), locationData);
          this.emit(Op.OP_ADD, locationData);
        }
        if (this.inlineDeployActive) {
          // one untracked value (the base input index) sits on the real stack, so PICK the counter one deeper.
          this.emit(encodeInt(BigInt(this.getStackIndex(this.inlineDeployCounterName) + 1)), locationData);
          this.emit(Op.OP_PICK, locationData);
          this.emit(Op.OP_ADD, locationData);
        }
      } else {
        this.emitBlockSlotIndex('deploy', this.deployCounter, locationData);
      }
      this.emit(Op.OP_DUP, locationData);
      this.emit(Op.OP_OUTPOINTINDEX, locationData);
      this.emit(encodeInt(0n), locationData);
      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.emit(Op.OP_OUTPOINTTXHASH, locationData); // [redeemScript, cat]
      this.pushToStack('(deploy_self_pin_cat)');
      // Build the prologue bytecode 0x21 || cat || 0x02c0ce88 = push33(cat||0x02) OP_INPUTINDEX
      // OP_UTXOTOKENCATEGORY OP_EQUALVERIFY, then prepend it to the redeem script.
      this.emit(hexToBin('21'), locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData); // [redeemScript, 0x21||cat]
      this.popFromStack();
      this.emit(hexToBin('02c0ce88'), locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_CAT, locationData); // [redeemScript, prologue]
      this.popFromStack();
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData); // [prologue||redeemScript]
      this.popFromStack();
    }

    // Step 2.5: User CREATE2 salt (stateless targets only - cleared for stateful in semantics). Bake the
    // outermost `<salt> OP_DROP` segment - identical to the SDK's Contract.ts - so `new T{salt}(...)` yields a
    // deterministic, salt-distinguished p2sh address (EVM create2). Stack: [redeem] -> [<salt-push><0x75>||redeem].
    if (node.callOptions?.salt) {
      this.visit(node.callOptions.salt); // [redeem, salt]
      this.emitPushdataEncode(node.callOptions.salt.type!, locationData); // [redeem, <push>salt]
      this.emit(new Uint8Array([0x75]), locationData); // OP_DROP byte
      this.pushToStack('(value)');
      this.emit(Op.OP_CAT, locationData); // [redeem, saltSegment]
      this.popFromStack();
      this.emit(Op.OP_SWAP, locationData); // [saltSegment, redeem]
      this.emit(Op.OP_CAT, locationData); // [saltSegment||redeem]
      this.popFromStack();
    }

    // Step 3: Compute P2SH32 locking bytecode: OP_HASH256 -> 0xaa20 || hash || 0x87
    // (matches existing P2SH32 pattern in emitContainerLbc/emitExternalCallVerification)
    this.emit(Op.OP_HASH256, locationData);
    // OP_HASH256 replaces top of stack in-place (1 in, 1 out), no tracking change needed
    this.emit(P2SH32_LBC_PREFIX, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_CAT, locationData);
    this.popFromStack(2);
    this.pushToStack('(value)');
    this.emit(P2SH32_LBC_SUFFIX, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_CAT, locationData);
    this.popFromStack(2);
    this.pushToStack('(value)');
    // Stack: [..., p2sh32_lbc]

    // Step 4: If stateful deploy, verify the child's genesis outputs.
    if (node.isStatefulDeploy) {
      // deployedDataNftCount was computed in semantic analysis from the child's nftIndex values, but a child
      // imported from another file may not have had its state packed into NFTs yet at that point (the parent's
      // `new C()` is visited before the child's bin-packing). The state-var nodes are now packed, so recompute
      // the true per-NFT count from them before any consumer (deployTarget ABI, covenant loop, deploy offset).
      if (node.deployedStateVars.length > 0) {
        node.deployedDataNftCount = Math.max(...node.deployedStateVars.map((sv) => sv.nftIndex)) + 1;
      }

      // Record deploy target on current function for ABI generation (common to the fixed + inline paths). Map
      // each child constructor argument to the deploy-function parameter it forwards (a direct `new C(param)`
      // reference), so the SDK can derive childConstructorArgs from the deploy-function args instead of
      // requiring them again; null for any non-trivial argument expression.
      if (!this.currentFunction.deployTargets) {
        this.currentFunction.deployTargets = [];
      }
      const deployFnParamNames = new Set(this.currentFunction.parameters.map((p) => p.name));
      const constructorArgs = node.parameters.map((p) => (
        p instanceof IdentifierNode && deployFnParamNames.has(p.name) ? p.name : null
      ));
      // create2 salt: record so the SDK builds the child Contract with the matching salt (the deploy covenant
      // verifies the salt-composed address). A `new C{salt: param}()` records the forwarded param name; a hex
      // literal records its value; a non-trivial expression is `{ computed: true }` (SDK needs an explicit
      // childSalt). See docs/contract-creation.md.
      const saltExpr = node.callOptions?.salt;
      let salt: { param: string } | { literal: string } | { computed: true } | undefined;
      if (saltExpr instanceof IdentifierNode && deployFnParamNames.has(saltExpr.name)) {
        salt = { param: saltExpr.name };
      } else if (saltExpr instanceof HexLiteralNode) {
        salt = { literal: binToHex(saltExpr.value) };
      } else if (saltExpr) {
        salt = { computed: true };
      }
      this.currentFunction.deployTargets.push({
        contractName: node.referencedContract!.name,
        dataNftCount: node.deployedDataNftCount,
        constructorArgs,
        ...(salt && { salt }),
      });

      // Multi-site deploy (2+ same-contract sites with a conditional): a FUNCTION-LEVEL runtime deploy counter
      // is live for the whole body, so EVERY deploy site - straight-line, branch, or loop - verifies inline
      // against it (deploys-fired-so-far indexes the genesis input/output). {value:} + deploy is a separate
      // follow-up and still fails closed.
      if (this.functionMultiSiteDeploy) {
        if (node.callOptions?.value) throw new ConditionalDeployError(node);
        this.emitInlineDeployVerification(node, locationData, true);
        return node;
      }

      // Conditional (branch) deploy: the fixed epilogue reads a master-LBC/category pushed only on the taken
      // path, and the genesis output position depends on whether the deploy fired - so verify INLINE here (runs
      // iff the branch is taken). Supported now: a SINGLE deploy site in a branch (not a loop), no {value:}
      // transfer; a single conditional deploy lands at the same fixed slot as an unconditional one when it
      // fires. Loop deploys use the runtime counter (visitWhile/visitDoWhile set it up); heterogeneous multi-
      // site / {value:} deploys raise ConditionalDeployError. Straight-line deploys keep the proven fixed epilogue.
      if (this.scopeDepth > 0) {
        const inLoop = this.plainLoopDepth > 0;
        const hasValue = !!node.callOptions?.value;
        // Supported inline cases: a SINGLE deploy site. A branch deploy may carry {value:} (the value transfer is
        // 0-or-1, handled by the conditional-transfer machinery - branchOps counts it, visitBranch pre-allocates
        // the slot). A LOOP {value:} deploy would need a variable-count transfer (loop-transfer gap) so it still
        // fails closed; a loop deploy needs its runtime counter set up before OP_BEGIN.
        if (this.functionDeploySiteCount !== 1 || (inLoop && !this.inlineDeployActive)) {
          throw new ConditionalDeployError(node);
        }
        this.emitInlineDeployVerification(node, locationData, inLoop);
        // Branch {value:}: fill the separate pre-allocated transfer slot. Loop {value:}: the transfer is
        // interleaved into each child's deploy group inside emitInlineDeployVerification (no separate slot).
        if (hasValue && !inLoop) this.emitInlineDeployValueTransfer(node, locationData);
        return node;
      }

      const deployIdx = this.deployCounter++;
      const masterLbcStackName = `__deploy_master_lbc_${deployIdx}`;
      const categoryStackName = `__deploy_category_${deployIdx}`;

      // Rename current top (p2sh32_lbc) as master LBC
      this.popFromStack();
      this.pushToStack(masterLbcStackName);

      // Get child category ID from genesis input.
      // Verify outpoint index == 0 (BCH consensus requires vout=0 for token genesis)
      // then extract the txhash as the category ID.
      this.emitBlockSlotIndex('deploy', deployIdx, locationData);
      this.emit(Op.OP_DUP, locationData);
      this.emit(Op.OP_OUTPOINTINDEX, locationData);
      this.emit(encodeInt(0n), locationData);
      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.emit(Op.OP_OUTPOINTTXHASH, locationData);
      this.pushToStack(categoryStackName);

      // Register pending deploy for covenant verification
      this.pendingDeploys.push({
        deployIndex: deployIdx,
        masterLbcStackName,
        categoryStackName,
        node,
      });

      // Copy master LBC back to top as the expression result via OP_PICK
      const lbIdx = this.getStackIndex(masterLbcStackName);
      this.emit(encodeInt(BigInt(lbIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');
    }

    // Step 5: If {value: expr} specified, register transfer output
    if (node.callOptions?.value) {
      // Rename lbc as transfer lockingBytecode
      const lbStackName = `__internal__transfer_lb_${node.transferIndex}`;
      this.popFromStack();
      this.pushToStack(lbStackName);

      // Visit amount expression and register as transfer amount
      this.visit(node.callOptions.value);
      this.popFromStack();
      const amtStackName = `__internal__transfer_amt_${node.transferIndex}`;
      this.pushToStack(amtStackName);

      this.pendingTransfers.push({
        transferIndex: node.transferIndex,
        lockingBytecodeStackName: lbStackName,
        amountStackName: amtStackName,
      });

      // Copy lbc back to top as the expression result via OP_PICK
      const lbIdx = this.getStackIndex(lbStackName);
      this.emit(encodeInt(BigInt(lbIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');
    }

    return node;
  }

  // ===== ABI Encode/Decode Support =====

  // [uint on stack] -> its 32-byte big-endian ABI word. NUM2BIN to 33 fits positive values including the
  // high-bit (>= 2^255) case; drop the sign byte, reverse to big-endian. (evmCompat)
  private emitEvmWordFromUint(loc: SingleLocationData): void {
    this.emit(encodeInt(33n), loc);
    this.emit(Op.OP_NUM2BIN, loc);
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_DROP, loc);
    this.emit(Op.OP_REVERSEBYTES, loc);
  }

  // evmCompat: encode a static value type as one 32-byte big-endian EVM ABI word. Numbers left-pad (value in
  // the low bytes, two's-complement for signed); bytesN right-pad (data in the high bytes). Tracker-neutral.
  private emitEvmAbiWord(type: Type, loc: SingleLocationData): void {
    if (type === PrimitiveType.BOOL) {
      this.emit(Op.OP_IF, loc);
      this.emit(encodeInt(1n), loc);
      this.emit(Op.OP_ELSE, loc);
      this.emit(encodeInt(0n), loc);
      this.emit(Op.OP_ENDIF, loc);
      this.emitEvmWordFromUint(loc);
    } else if (type instanceof IntType || type === PrimitiveType.BIGINT) {
      if (type instanceof IntType && type.signed) {
        // add 2^256 if negative -> the 256-bit two's-complement pattern
        this.emit(Op.OP_DUP, loc);
        this.emit(encodeInt(0n), loc);
        this.emit(Op.OP_LESSTHAN, loc);
        this.emit(encodeInt(1n << 256n), loc);
        this.emit(Op.OP_MUL, loc);
        this.emit(Op.OP_ADD, loc);
      }
      this.emitEvmWordFromUint(loc);
    } else if (type instanceof BytesType && type.bound !== undefined && type.bound <= 32) {
      const pad = 32 - type.bound;
      if (pad > 0) {
        this.emit(new Uint8Array(pad), loc); // right-pad the N data bytes to a full 32-byte word
        this.emit(Op.OP_CAT, loc);
      }
    } else {
      throw new Error(`evmCompat abi.encode: unsupported type '${type.toString()}' (Phase 1 = value types)`);
    }
    this.popFromStack();
    this.pushToStack('(value)');
  }

  // evmCompat: [bytes/string on top] -> its dynamic ABI tail = 32-byte length word ++ data right-padded to a
  // multiple of 32. The head offset that points here is emitted separately. Tracker-neutral (data -> tail).
  private emitEvmDynamicTail(loc: SingleLocationData): void {
    this.emit(Op.OP_SIZE, loc); // [data, len]
    this.emit(Op.OP_DUP, loc); // [data, len, len]
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_MOD, loc); // [data, len, len%32]
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SWAP, loc);
    this.emit(Op.OP_SUB, loc); // [data, len, 32-len%32]
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_MOD, loc); // [data, len, pad]  (pad = (32 - len%32) % 32)
    this.emit(encodeInt(0n), loc);
    this.emit(Op.OP_SWAP, loc);
    this.emit(Op.OP_NUM2BIN, loc); // [data, len, zeros(pad)]
    this.emit(Op.OP_ROT, loc); // [len, zeros, data]
    this.emit(Op.OP_SWAP, loc); // [len, data, zeros]
    this.emit(Op.OP_CAT, loc); // [len, padded]
    this.emit(Op.OP_SWAP, loc); // [padded, len]
    this.emitEvmWordFromUint(loc); // [padded, len_word]
    this.emit(Op.OP_SWAP, loc); // [len_word, padded]
    this.emit(Op.OP_CAT, loc); // [tail]
    this.popFromStack();
    this.pushToStack('(value)');
  }

  // evmCompat abi.encode: static value types (each a 32-byte word), optionally followed by ONE trailing
  // dynamic bytes/string (a 32-byte head offset + the tail). Multiple / non-trailing dynamics: not yet.
  // evmCompat: [array blob of DYNAMIC elements on top] (bytes[], string[], uint[][]) -> its ABI tail =
  // length word ++ head(N offset words) ++ tail(concat of element encodings). Runtime head/tail pack: loop state
  // [N, headAcc, tailAcc, elements]; each element is pushdata-decoded, encoded via the recursive emitEvmEncodeValue,
  // appended to tailAcc, and its offset word (32*N + size(tailAcc)) appended to headAcc. This one loop lights up
  // every recursive case through emitEvmEncodeValue. Loop-safe helpers only; single tracker reconcile at the end.
  private emitEvmDynamicArrayTail(elemType: Type, loc: SingleLocationData): void {
    this.emitPushdataDecode(PrimitiveType.BIGINT, loc); // [N, elements]
    this.emit(new Uint8Array(0), loc); // headAcc = ""
    this.emit(new Uint8Array(0), loc); // tailAcc = ""
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc); // [N, headAcc, tailAcc, elements]
    this.emit(Op.OP_BEGIN, loc);
    this.emit(Op.OP_SIZE, loc);
    this.emit(Op.OP_0NOTEQUAL, loc); // [.., elements, moreLeft]
    this.emit(Op.OP_IF, loc);
    this.emitPushdataDecode(elemType, loc); // [N, headAcc, tailAcc, value, rest]
    this.emit(Op.OP_SWAP, loc); // [.., rest, value]
    this.emitEvmEncodeValue(elemType, loc); // value -> enc: [N, headAcc, tailAcc, rest, enc]
    // offset = 32*N + size(tailAcc)
    this.emit(encodeInt(4n), loc); this.emit(Op.OP_PICK, loc); // copy N (depth 4)
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_MUL, loc);
    this.emit(encodeInt(3n), loc); this.emit(Op.OP_PICK, loc); // copy tailAcc (depth 3)
    this.emit(Op.OP_SIZE, loc); this.emit(Op.OP_NIP, loc);
    this.emit(Op.OP_ADD, loc);
    this.emitEvmWordFromUint(loc); // -> offWord
    // headAcc ++= offWord (headAcc at depth 4)
    this.emit(encodeInt(4n), loc); this.emit(Op.OP_ROLL, loc);
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_CAT, loc); // [N, tailAcc, rest, enc, headAcc']
    // tailAcc ++= enc (tailAcc at depth 3, enc at depth 2)
    this.emit(encodeInt(3n), loc); this.emit(Op.OP_ROLL, loc);
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc);
    this.emit(Op.OP_CAT, loc); // [N, rest, headAcc', tailAcc']
    // restore elements (rest) to top
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc); // [N, headAcc', tailAcc', rest]
    this.emit(encodeBool(false), loc);
    this.emit(Op.OP_ELSE, loc);
    this.emit(encodeBool(true), loc);
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_UNTIL, loc);
    // combine: [N, headAcc, tailAcc, empty] -> length word ++ headAcc ++ tailAcc
    this.emit(Op.OP_DROP, loc); // drop the emptied elements
    this.emit(Op.OP_CAT, loc); // headAcc ++ tailAcc = body
    this.emit(Op.OP_SWAP, loc); // [body, N]
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_NUM2BIN, loc); this.emit(Op.OP_REVERSEBYTES, loc); // N -> len word
    this.emit(Op.OP_SWAP, loc);
    this.emit(Op.OP_CAT, loc); // lenWord ++ body
    this.popFromStack();
    this.pushToStack('(value)');
  }

  // evmCompat: [dynamic array blob on top] -> its EVM ABI tail = 32-byte length word ++ each element as a 32-byte
  // word. The array is stored `pushdata(len) ++ contiguous fixed-width elements` at getFixedWidth stride; the loop
  // splits each element and reuses emitDecodeElementPacked + emitEvmAbiWord (the same per-element decode/word path as
  // scalars) so signed ints, bytesN and bool all encode correctly. Fixed-width value-type elements (uint256[],
  // int256[], bytes32[], bool[], ...); bigint-backed variable-width element arrays (uint[]) are separate. The tail
  // accumulator is built via a runtime OP_BEGIN..OP_UNTIL loop; tracker is reconciled once at the end (blob -> tail).
  private emitEvmArrayTail(elemType: Type, loc: SingleLocationData, packed = false): void {
    if (this.isDynamicAbiType(elemType)) {
      if (packed) throw new Error('evmCompat: abi.encodePacked of an array of dynamic elements is unsupported');
      this.emitEvmDynamicArrayTail(elemType, loc);
      return;
    }
    const w = getFixedWidth(elemType);
    this.emitPushdataDecode(PrimitiveType.BIGINT, loc); // [length, elements]
    if (packed) {
      // abi.encodePacked: element words only, no length word (elements are still padded to 32).
      this.emit(Op.OP_NIP, loc); // drop length -> [elements]
      this.emit(new Uint8Array(0), loc); // empty accumulator
      this.emit(Op.OP_SWAP, loc); // [acc, elements]
    } else {
      this.emit(Op.OP_SWAP, loc); // [elements, length]
      this.emit(encodeInt(32n), loc);
      this.emit(Op.OP_NUM2BIN, loc); // length -> 32-byte little-endian
      this.emit(Op.OP_REVERSEBYTES, loc); // -> 32-byte big-endian length word (= tail accumulator)
      this.emit(Op.OP_SWAP, loc); // [tailAcc, elements]
    }
    this.emit(Op.OP_BEGIN, loc);
    this.emit(Op.OP_SIZE, loc); // OP_SIZE keeps its input and pushes the size (no OP_DUP needed)
    this.emit(Op.OP_0NOTEQUAL, loc); // [tailAcc, elements, moreLeft]
    this.emit(Op.OP_IF, loc);
    this.emit(encodeInt(BigInt(w)), loc);
    this.emit(Op.OP_SPLIT, loc); // [tailAcc, elem(w), rest]
    this.emit(Op.OP_SWAP, loc); // [tailAcc, rest, elem]
    // Decode the fixed-width element to a VM value, then to its 32-byte EVM word. emitDecodeElementPacked is
    // pure-emit and emitEvmAbiWord is net-0 with no getStackIndex, so both are safe in the tracker-frozen loop.
    // This handles signed ints (two's-complement), bytesN (right-pad), and bool - not just unsigned.
    this.emitDecodeElementPacked(elemType, loc);
    this.emitEvmAbiWord(elemType, loc); // value -> 32-byte big-endian EVM word
    this.emit(encodeInt(2n), loc);
    this.emit(Op.OP_ROLL, loc); // [rest, word, tailAcc]
    this.emit(Op.OP_SWAP, loc);
    this.emit(Op.OP_CAT, loc); // [rest, tailAcc ++ word]
    this.emit(Op.OP_SWAP, loc); // [tailAcc', rest]
    this.emit(encodeBool(false), loc); // continue
    this.emit(Op.OP_ELSE, loc);
    this.emit(encodeBool(true), loc); // stop
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_UNTIL, loc);
    this.emit(Op.OP_DROP, loc); // drop the emptied elements blob -> [tailAcc]
    this.popFromStack();
    this.pushToStack('(value)');
  }

  // evmCompat abi.decode of a SINGLE dynamic array of fixed-width value-type elements. Input: the whole encoding
  // (offset word ++ length word ++ element words). Rebuild the SolidCash array blob = pushdata(len) ++ packed
  // fixed-width LE elements. Inverse of emitEvmArrayTail: a runtime loop converts each 32-byte big-endian element
  // word back via emitEvmWordToValue + emitEncodeElementPacked (both loop-safe). Pure-emit + one tracker reconcile.
  // [element words blob on top] -> SolidCash array blob = pushdata(len) ++ packed fixed-width LE elements. The
  // element count is recovered from the blob size (/32). A runtime loop converts each 32-byte big-endian word back
  // via emitEvmWordToValue + emitEncodeElementPacked (loop-safe). Pure-emit + one tracker reconcile (words -> blob).
  private emitEvmWordsToArray(elemType: Type, loc: SingleLocationData): void {
    this.emit(Op.OP_SIZE, loc); // [words, size]  (OP_SIZE keeps its input)
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_DIV, loc); // [words, length]  (each element is one 32-byte word)
    this.emitPushdataEncode(PrimitiveType.BIGINT, loc); // length -> pushdata prefix bytes (accumulator start)
    this.emit(Op.OP_SWAP, loc); // [acc, words]
    this.emit(Op.OP_BEGIN, loc);
    this.emit(Op.OP_SIZE, loc);
    this.emit(Op.OP_0NOTEQUAL, loc); // [acc, words, moreLeft]
    this.emit(Op.OP_IF, loc);
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc); // [acc, word, rest]
    this.emit(Op.OP_SWAP, loc); // [acc, rest, word]
    this.emitEvmWordToValue(elemType, loc); // big-endian word -> VM value
    this.emitEncodeElementPacked(elemType, loc); // value -> fixed-width LE element bytes
    this.emit(encodeInt(2n), loc);
    this.emit(Op.OP_ROLL, loc); // [rest, elemBytes, acc]
    this.emit(Op.OP_SWAP, loc);
    this.emit(Op.OP_CAT, loc); // [rest, acc ++ elemBytes]
    this.emit(Op.OP_SWAP, loc); // [acc', rest]
    this.emit(encodeBool(false), loc);
    this.emit(Op.OP_ELSE, loc);
    this.emit(encodeBool(true), loc);
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_UNTIL, loc);
    this.emit(Op.OP_DROP, loc); // drop the emptied element words -> [acc = SolidCash array blob]
    this.popFromStack();
    this.pushToStack('(value)');
  }

  // Decode one ABI element from the top of a blob, consuming its bytes: [.., tail] -> [.., next, element] where
  // element is the SolidCash-encoded value. Recursive: a bytes/string element is lengthWord ++ data ++ pad; an
  // inner value-element array (uint[][]) is lengthWord ++ M 32-byte words rebuilt into a SolidCash array blob.
  private emitEvmDecodeElement(elemType: Type, loc: SingleLocationData): void {
    if (elemType instanceof ArrayType && elemType.bound === undefined) {
      if (this.isDynamicAbiType(elemType.elementType)) {
        this.emitEvmDecodeDynElementArray(elemType.elementType, loc); // inner array of dynamic elems (bytes[][]/string[][])
        return;
      }
      this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); // [lenWord, rest]
      this.emit(Op.OP_SWAP, loc); this.emitEvmWordToValue(PrimitiveType.BIGINT, loc); // [rest, M]
      this.emit(encodeInt(32n), loc); this.emit(Op.OP_MUL, loc); // M*32
      this.emit(Op.OP_SPLIT, loc); // [innerWords, next]
      this.emit(Op.OP_SWAP, loc); this.emitEvmWordsToArray(elemType.elementType, loc); // [next, arrayBlob]
      return;
    }
    // bytes/string leaf: lengthWord ++ data ++ pad
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); // [lenWord, rest1]
    this.emit(Op.OP_SWAP, loc); this.emitEvmWordToValue(PrimitiveType.BIGINT, loc); // [rest1, len]
    this.emit(Op.OP_SPLIT, loc); // [data, rest2]
    this.emit(Op.OP_OVER, loc); this.emit(Op.OP_SIZE, loc); this.emit(Op.OP_NIP, loc); // size(data)
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_MOD, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_SUB, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_MOD, loc); // pad
    this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_NIP, loc); // skip pad: [data, next]
    this.emit(Op.OP_SWAP, loc); this.emitPushdataEncode(elemType, loc); // [next, element]
  }

  // evmCompat: decode one inner array of DYNAMIC elements (a bytes[] element inside bytes[][]) from the top of a
  // blob, consuming exactly its encoding and leaving the remainder: [.., blob] -> [.., next, innerArrayBlob].
  // Counted loop over M inner elements (inner offset head skipped; canonical sequential tail). Loop-invariant
  // [counter, tail, acc]; each iteration decodes one inner element, appends it, and decrements the counter.
  private emitEvmDecodeDynElementArray(innerElemType: Type, loc: SingleLocationData): void {
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); // [inner_lenWord, rest1]
    this.emit(Op.OP_SWAP, loc); this.emitEvmWordToValue(PrimitiveType.BIGINT, loc); // [rest1, M]
    this.emit(Op.OP_DUP, loc); this.emit(encodeInt(32n), loc); this.emit(Op.OP_MUL, loc); // [rest1, M, M*32]
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc); // [M, M32, rest1]
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_NIP, loc); // drop inner head: [M, tail]
    this.emit(Op.OP_OVER, loc); this.emitPushdataEncode(PrimitiveType.BIGINT, loc); // [M(counter), tail, acc=pushdata(M)]
    this.emit(Op.OP_BEGIN, loc);
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_0NOTEQUAL, loc); // [counter, tail, acc, more]
    this.emit(Op.OP_IF, loc);
    this.emit(Op.OP_SWAP, loc); // [counter, acc, tail]
    this.emitEvmDecodeElement(innerElemType, loc); // [counter, acc, next, element]
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc); // acc to top: [counter, next, element, acc]
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_CAT, loc); // acc ++ element: [counter, next, acc']
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc); // counter to top: [next, acc', counter]
    this.emit(encodeInt(1n), loc); this.emit(Op.OP_SUB, loc); // [next, acc', counter-1]
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc); // [acc', counter-1, next]
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc); // restore invariant: [counter-1, next, acc']
    this.emit(encodeBool(false), loc);
    this.emit(Op.OP_ELSE, loc);
    this.emit(encodeBool(true), loc);
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_UNTIL, loc);
    // [0, rest, acc] -> drop the spent counter, leaving [next=rest, innerArrayBlob=acc]
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc); // counter to top: [rest, acc, 0]
    this.emit(Op.OP_DROP, loc); // [rest, acc]
  }

  // Single top-level array of DYNAMIC leaf elements (bytes[]/string[]): the encoding is offset ++ length ++
  // head(N offsets) ++ tail(N element encodings, each length-word ++ data ++ pad). Rebuild the SolidCash blob
  // pushdata(N) ++ per-element pushdata. Sequential (canonical order): skip the head, then decode each element
  // (read its length word, take that many bytes, skip padding) and re-encode via emitPushdataEncode. Loop-safe.
  private emitEvmDynamicArrayDecode(elemType: Type, loc: SingleLocationData): void {
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_NIP, loc); // drop the offset word
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); // [lenWord, rest]
    this.emit(Op.OP_SWAP, loc); this.emitEvmWordToValue(PrimitiveType.BIGINT, loc); // [rest, N]
    this.emit(Op.OP_DUP, loc); this.emitPushdataEncode(PrimitiveType.BIGINT, loc); // [rest, N, acc=pushdata(N)]
    this.emit(encodeInt(1n), loc); this.emit(Op.OP_PICK, loc); this.emit(encodeInt(32n), loc); this.emit(Op.OP_MUL, loc);
    this.emit(encodeInt(3n), loc); this.emit(Op.OP_ROLL, loc); // rest to top: [N, acc, N32, rest]
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_NIP, loc); // drop head: [N, acc, tail]
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc); this.emit(Op.OP_DROP, loc); // drop N: [acc, tail]
    this.emit(Op.OP_BEGIN, loc);
    this.emit(Op.OP_SIZE, loc); this.emit(Op.OP_0NOTEQUAL, loc); // [acc, tail, more]
    this.emit(Op.OP_IF, loc);
    this.emitEvmDecodeElement(elemType, loc); // [acc, tail] -> [acc, next, element]
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc); // acc to top: [next, element, acc]
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_CAT, loc); // acc ++ element: [next, acc']
    this.emit(Op.OP_SWAP, loc); // [acc', next]
    this.emit(encodeBool(false), loc);
    this.emit(Op.OP_ELSE, loc);
    this.emit(encodeBool(true), loc);
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_UNTIL, loc);
    this.emit(Op.OP_DROP, loc); // drop the emptied tail -> [acc = SolidCash array blob]
    this.popFromStack();
    this.pushToStack('(value)');
  }

  // Single top-level dynamic array (offset always 32): strip the offset word and the length word, then rebuild.
  private emitEvmArrayDecode(elemType: Type, loc: SingleLocationData): void {
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_NIP, loc); // drop the offset word -> [length ++ elements]
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_NIP, loc); // drop the length word -> [element words]
    this.emitEvmWordsToArray(elemType, loc);
  }

  // Recursive ABI dynamic-ness (mirrors ethers): bytes/string and unbounded arrays are dynamic; a bounded array
  // or struct is dynamic iff any component is. Value types are static. Drives the head/tail split at every level.
  private isDynamicAbiType(t: Type): boolean {
    if (t === PrimitiveType.STRING) return true;
    if (t instanceof BytesType) return t.bound === undefined;
    if (t instanceof ArrayType) return t.bound === undefined || this.isDynamicAbiType(t.elementType);
    if (t instanceof StructType) return t.fields.some((f) => this.isDynamicAbiType(f.type));
    return false;
  }

  // ABI static (head) byte size of a STATIC type: a value type is one 32-byte word; a fixed-width struct is the
  // sum of its fields; a fixed-size array is N times its element. Used to size the head so dynamic offsets stay
  // correct when a static composite (struct/fixed-array) occupies more than one word in the head.
  private abiStaticSize(t: Type): number {
    if (t instanceof StructType) return t.fields.reduce((s, f) => s + this.abiStaticSize(f.type), 0);
    if (t instanceof ArrayType && t.bound !== undefined) return t.bound * this.abiStaticSize(t.elementType);
    return 32;
  }

  // Encode a single value (on top) to its EVM ABI bytes: the inline head bytes for a static type, or the tail
  // bytes for a dynamic type. Recursive dispatch - the one place that knows every type's encoding.
  private emitEvmEncodeValue(type: Type, loc: SingleLocationData): void {
    if (type instanceof ArrayType && type.bound === undefined) {
      this.emitEvmArrayTail(type.elementType, loc);
    } else if (type instanceof ArrayType && type.bound !== undefined && !this.isDynamicAbiType(type)) {
      // fixed-size array of static elements (uint256[3]): inline element words, no length word - the ABI static
      // encoding. packed=true skips the length word and emits each element padded to 32, which is exactly that.
      this.emitEvmArrayTail(type.elementType, loc, true);
    } else if (type === PrimitiveType.STRING || (type instanceof BytesType && type.bound === undefined)) {
      this.emitEvmDynamicTail(loc);
    } else if (type instanceof StructType) {
      if (this.isDynamicAbiType(type)) this.emitEvmStructTail(type, loc);
      else this.emitEvmStructInline(type, loc);
    } else {
      this.emitEvmAbiWord(type, loc);
    }
  }

  // evmCompat: a DYNAMIC struct (has a bytes/string/dynamic-array field) encoded as its ABI tuple = head/tail over
  // the fields. Unpack each field from the framed struct blob (pushdata per field), encode it via the recursive
  // emitEvmEncodeValue, then run the shared head/tail engine over the field blobs. The unpack uses only pure-emit /
  // net-0 helpers (no getStackIndex), so the tracker stays frozen until the resync that names the N field blobs.
  private emitEvmStructTail(type: StructType, loc: SingleLocationData): void {
    const fields = type.fields;
    const n = fields.length;
    // Phase A': unpack + encode each field, leaving blobs [b0..b(n-1)] on the stack (blobs accumulate below, the
    // remaining framed bytes ride on top; last field's remainder is empty). The tracker is kept SYNCED throughout
    // (each pushdata-decode's extra item and each OP_SWAP mirrored) so a nested dynamic-struct field's own head/tail
    // (which uses getStackIndex) resolves correct depths. Nested __abiblob slots don't collide: each level sets and
    // then nips (Phase D) its slots before an enclosing level names its own.
    const swapTop = (): void => { const s = this.stack; [s[0], s[1]] = [s[1], s[0]]; };
    fields.forEach((f, i) => {
      this.emitPushdataDecode(f.type, loc); // VM: [.., framed] -> [.., value, rest]
      this.popFromStack(); this.pushToStack('(fieldval)'); this.pushToStack('(fieldrest)'); // track the +1
      if (i < n - 1) {
        this.emit(Op.OP_SWAP, loc); swapTop(); // [.., rest, value]
        this.emitEvmEncodeValue(f.type, loc); // value -> blob (net-0, tracked)
        this.emit(Op.OP_SWAP, loc); swapTop(); // [.., blob_i, rest]
      } else {
        this.emit(Op.OP_DROP, loc); this.popFromStack(); // drop the empty remainder: [.., value]
        this.emitEvmEncodeValue(f.type, loc); // value -> blob_i
      }
    });
    // the top N tracked entries are the field blobs (b(n-1) on top ... b0 deepest); name them for the head/tail engine.
    for (let i = 0; i < n; i += 1) this.stack[n - 1 - i] = `__abiblob${i}`;
    this.emitEvmHeadTailFromBlobs(fields.map((f) => f.type), loc);
  }

  // evmCompat: fixed-width (all-static) struct value on top -> its ABI tuple encoding = each field as an inline
  // 32-byte word (no offsets, since static). The struct blob is pushdata(field_0) ++ pushdata(field_1) ++ ...
  // (construction pushdata-encodes each field). Pushdata-decode each field, emit its word, concatenate. Unrolled.
  private emitEvmStructInline(type: StructType, loc: SingleLocationData): void {
    if (this.isDynamicAbiType(type)) {
      throw new Error('evmCompat: abi.encode of a struct with dynamic fields is unsupported');
    }
    this.emit(new Uint8Array(0), loc); this.emit(Op.OP_SWAP, loc); // [acc="", blob]
    const last = type.fields.length - 1;
    type.fields.forEach((f, i) => {
      if (i < last) {
        this.emitPushdataDecode(f.type, loc); // [acc, value, rest]
        this.emit(Op.OP_SWAP, loc); // [acc, rest, value]
        this.emitEvmEncodeValue(f.type, loc); // value -> its inline encoding (recurses for nested static composites)
        this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc); // acc to top: [rest, enc, acc]
        this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_CAT, loc); // acc ++ enc: [rest, acc']
        this.emit(Op.OP_SWAP, loc); // [acc', rest]
      } else {
        this.emitPushdataDecode(f.type, loc); this.emit(Op.OP_DROP, loc); // last field, drop empty remainder: [acc, value]
        this.emitEvmEncodeValue(f.type, loc); // [acc, enc]
        this.emit(Op.OP_CAT, loc); // acc ++ enc
      }
    });
    this.popFromStack();
    this.pushToStack('(value)');
  }

  // evmCompat inverse of emitEvmStructInline: a fixed-width struct's ABI tuple blob (word(f0) ++ word(f1) ++ ...)
  // -> the SolidCash struct blob (pushdata(f0) ++ pushdata(f1) ++ ...). Split each 32-byte word, decode to a value,
  // re-encode as pushdata, concatenate. Unrolled over the fields; relative ops + getStackIndex-free helpers only.
  private emitEvmStructDecode(type: StructType, loc: SingleLocationData): void {
    this.emit(new Uint8Array(0), loc); this.emit(Op.OP_SWAP, loc); // [acc="", blob]
    type.fields.forEach((f) => {
      this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); // [acc, word, rest]
      this.emit(Op.OP_SWAP, loc); this.emitEvmWordToValue(f.type, loc); // [acc, rest, value]
      this.emitPushdataEncode(f.type, loc); // [acc, rest, pushdata]
      this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc); // acc to top: [rest, pushdata, acc]
      this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_CAT, loc); // acc ++ pushdata: [rest, acc']
      this.emit(Op.OP_SWAP, loc); // [acc', rest]
    });
    this.emit(Op.OP_DROP, loc); // drop the emptied blob -> [acc = struct blob]
    this.popFromStack();
    this.pushToStack('(value)');
  }

  // evmCompat inverse of emitEvmStructTail: a DYNAMIC struct's ABI tuple -> the framed struct blob. Strip the
  // top-level offset, decode the fields into N values via the shared offset-following decoder, then re-frame:
  // pushdata-encode each field (in order) and concatenate. The re-frame uses pure-emit ROLL/CAT + net-0
  // emitPushdataEncode (no getStackIndex), so the tracker is frozen until the final reconcile.
  private emitEvmStructDecodeDynamic(type: StructType, loc: SingleLocationData): void {
    const fields = type.fields;
    const n = fields.length;
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_NIP, loc); // strip top-level offset
    this.emitEvmAbiDecodeDynamic(fields.map((f) => f.type), loc); // [v0..v(n-1)] tracked
    // re-frame: bring each field value (deepest first) up, pushdata-encode, concatenate into the struct blob.
    fields.forEach((f, i) => {
      this.emit(encodeInt(BigInt(i === 0 ? n - 1 : n - i)), loc);
      this.emit(Op.OP_ROLL, loc); // deepest remaining value -> top
      this.emitPushdataEncode(f.type, loc);
      if (i > 0) this.emit(Op.OP_CAT, loc);
    });
    this.popFromStack(n);
    this.pushToStack('(value)');
  }

  private emitEvmAbiEncode(params: ExpressionNode[], loc: SingleLocationData): void {
    const n = params.length;
    const isDyn = (t: Type): boolean => this.isDynamicAbiType(t);
    const dynIdx = params.map((p, i) => (isDyn(p.type!) ? i : -1)).filter((i) => i >= 0);

    if (n === 0) {
      this.emit(new Uint8Array(0), loc);
      this.pushToStack('(value)');
      return;
    }
    if (dynIdx.length === 0) {
      // All static: the head is the whole encoding (each arg inline - value word or fixed-width struct's field words).
      params.forEach((param, i) => {
        params[i] = this.visit(param);
        this.emitEvmEncodeValue(params[i].type!, loc);
        if (i > 0) {
          this.emit(Op.OP_CAT, loc);
          this.popFromStack(2);
          this.pushToStack('(value)');
        }
      });
      return;
    }
    // One or more dynamic (bytes/string) args: EVM head/tail with runtime offset accumulation. Encode every
    // arg to a blob slot, build the head (static word or dynamic offset word), append the tails, then drop the
    // blob slots. A dynamic's offset is headSize plus the total size of the earlier dynamics' tails, computed
    // at runtime via tracker-tracked PICK/SIZE so it stays correct for any number of dynamics at any positions.
    // Phase A: encode each arg to a blob (static word or dynamic tail) kept as tracked slot __abiblob_i.
    for (let i = 0; i < n; i += 1) {
      params[i] = this.visit(params[i]);
      this.emitEvmEncodeValue(params[i].type!, loc);
      this.popFromStack();
      this.pushToStack(`__abiblob${i}`);
    }
    // Phases B-D: build the head, append the tails, drop the blob slots. Shared with the dynamic-struct tail.
    this.emitEvmHeadTailFromBlobs(params.map((p) => p.type!), loc);
  }

  // Head/tail assembly over N blobs already on the stack, tracked as __abiblob_0..N-1 (in order, bottom to top).
  // Builds the head (a static arg's blob inline, a dynamic arg's offset word = headSize + earlier dynamic tails),
  // appends the dynamic tails, drops the blob slots, and leaves the encoding. Shared by top-level abi.encode and
  // the dynamic-struct tail (a struct's fields packed as a tuple).
  private emitEvmHeadTailFromBlobs(types: readonly Type[], loc: SingleLocationData): void {
    const n = types.length;
    const isDyn = (t: Type): boolean => this.isDynamicAbiType(t);
    const dynIdx = types.map((t, i) => (isDyn(t) ? i : -1)).filter((i) => i >= 0);
    const headSize = types.reduce((s: number, t) => s + (isDyn(t) ? 32 : this.abiStaticSize(t)), 0);
    // Phase B: build the head on top - static arg emits its blob inline, dynamic arg emits its offset word.
    for (let i = 0; i < n; i += 1) {
      if (isDyn(types[i])) {
        const dj = dynIdx.indexOf(i);
        this.emit(encodeInt(BigInt(headSize)), loc);
        this.pushToStack('(off)');
        for (let jj = 0; jj < dj; jj += 1) {
          this.emit(encodeInt(BigInt(this.getStackIndex(`__abiblob${dynIdx[jj]}`))), loc);
          this.emit(Op.OP_PICK, loc);
          this.emit(Op.OP_SIZE, loc);
          this.emit(Op.OP_NIP, loc);
          this.pushToStack('(sz)');
          this.emit(Op.OP_ADD, loc);
          this.popFromStack(2);
          this.pushToStack('(off)');
        }
        this.emitEvmWordFromUint(loc);
      } else {
        this.emit(encodeInt(BigInt(this.getStackIndex(`__abiblob${i}`))), loc);
        this.emit(Op.OP_PICK, loc);
        this.pushToStack('(word)');
      }
      if (i === 0) {
        this.popFromStack();
        this.pushToStack('__abihead');
      } else {
        this.emit(Op.OP_CAT, loc);
        this.popFromStack(2);
        this.pushToStack('__abihead');
      }
    }
    // Phase C: append the dynamic tails, in order, after the head.
    for (let j = 0; j < dynIdx.length; j += 1) {
      this.emit(encodeInt(BigInt(this.getStackIndex(`__abiblob${dynIdx[j]}`))), loc);
      this.emit(Op.OP_PICK, loc);
      this.pushToStack('(tail)');
      this.emit(Op.OP_CAT, loc);
      this.popFromStack(2);
      this.pushToStack('__abihead');
    }
    // Phase D: drop the N blob slots left below the result.
    for (let i = 0; i < n; i += 1) {
      this.emit(Op.OP_NIP, loc);
      this.nipFromStack();
    }
    this.popFromStack();
    this.pushToStack('(value)');
  }

  // evmCompat abi.decode of an all-value-type schema: the blob is N consecutive 32-byte big-endian words.
  // Decode each in order (the last word is the remaining blob). Pure-emit; the caller tracks the net effect.
  // Dynamic types (string / unbounded bytes) are not yet supported here.
  private emitEvmAbiDecode(schema: readonly Type[], loc: SingleLocationData): void {
    for (let i = 0; i < schema.length; i += 1) {
      if (i === schema.length - 1) {
        this.emitEvmWordToValue(schema[i], loc); // the remaining blob is exactly the last 32-byte word
      } else {
        this.emit(encodeInt(32n), loc);
        this.emit(Op.OP_SPLIT, loc); // [word, remainder]
        this.emit(Op.OP_SWAP, loc); // [remainder, word]
        this.emitEvmWordToValue(schema[i], loc);
        this.emit(Op.OP_SWAP, loc); // [value, remainder]
      }
    }
  }

  // Decode one 32-byte big-endian EVM word (on top) into a SolidCash value. Inverse of emitEvmAbiWord.
  private emitEvmWordToValue(type: Type, loc: SingleLocationData): void {
    if (type === PrimitiveType.BOOL) {
      this.emit(Op.OP_REVERSEBYTES, loc);
      this.emit(Op.OP_BIN2NUM, loc); // 0x01 or empty
      return;
    }
    if (type instanceof BytesType && type.bound !== undefined && type.bound <= 32) {
      this.emit(encodeInt(BigInt(type.bound)), loc);
      this.emit(Op.OP_SPLIT, loc); // right-padded: the N data bytes are the first N of the word
      this.emit(Op.OP_DROP, loc);
      return;
    }
    if (type instanceof IntType || type === PrimitiveType.BIGINT) {
      // reverse to little-endian, force positive with a 0x00 sign byte, minimise -> unsigned value U
      this.emit(Op.OP_REVERSEBYTES, loc);
      this.emit(new Uint8Array([0]), loc);
      this.emit(Op.OP_CAT, loc);
      this.emit(Op.OP_BIN2NUM, loc);
      if (type instanceof IntType && type.signed) {
        // two's-complement: a high-bit-set U is the negative value U - 2^256
        this.emit(Op.OP_DUP, loc);
        this.emit(encodeInt(1n << 255n), loc);
        this.emit(Op.OP_GREATERTHANOREQUAL, loc);
        this.emit(Op.OP_IF, loc);
        this.emit(encodeInt(1n << 256n), loc);
        this.emit(Op.OP_SUB, loc);
        this.emit(Op.OP_ENDIF, loc);
      }
      return;
    }
    throw new Error(`evmCompat abi.decode: unsupported type '${type.toString()}' (value types only)`);
  }

  // evmCompat abi.decode for a schema containing dynamic (string/bytes) types. The head is N 32-byte words; a
  // dynamic word is a byte OFFSET into the blob where a 32-byte length precedes the data. Keeps the whole blob as
  // a base slot and follows each offset (random access), decoding any valid EVM encoding. Manages its own stack
  // tracking, ending with the N decoded values on top (blob slot removed). getStackIndex is only ever taken for
  // the blob slot; every other pick uses a known local depth, and every VM op is mirrored so that index stays exact.
  private emitEvmAbiDecodeDynamic(schema: readonly Type[], loc: SingleLocationData): void {
    const dyn = (t: Type): boolean => t === PrimitiveType.STRING || (t instanceof BytesType && t.bound === undefined);
    const isArr = (t: Type): boolean => t instanceof ArrayType && t.bound === undefined;
    // Head bytes per field: a dynamic field is one offset word; a static value/composite is its full ABI static
    // size (a fixed-array or nested static struct occupies several words in the head). Positions are cumulative.
    const headSizeOf = (t: Type): number => (dyn(t) || isArr(t) ? 32 : this.abiStaticSize(t));
    const headPos: number[] = []; let hAcc = 0;
    for (const st of schema) { headPos.push(hAcc); hAcc += headSizeOf(st); }
    this.popFromStack();
    this.pushToStack('__decblob'); // the blob, kept below the accumulating results

    for (let i = 0; i < schema.length; i += 1) {
      // field i's head bytes at its cumulative head position -> top (net +1)
      const t = schema[i];
      this.emit(encodeInt(BigInt(this.getStackIndex('__decblob'))), loc);
      this.emit(Op.OP_PICK, loc);
      if (headPos[i] > 0) {
        this.emit(encodeInt(BigInt(headPos[i])), loc);
        this.emit(Op.OP_SPLIT, loc);
        this.emit(Op.OP_NIP, loc);
      }
      this.emit(encodeInt(BigInt(headSizeOf(t))), loc);
      this.emit(Op.OP_SPLIT, loc);
      this.emit(Op.OP_DROP, loc);
      this.pushToStack('(value)');

      if (!dyn(t) && !isArr(t)) {
        // static: the head bytes are the inline encoding. A value is one word; a fixed-array / nested static struct
        // is several - reconstruct the SolidCash composite so the caller re-frames it correctly.
        if (t instanceof ArrayType && t.bound !== undefined) this.emitEvmWordsToArray(t.elementType, loc);
        else if (t instanceof StructType) this.emitEvmStructDecode(t, loc);
        else this.emitEvmWordToValue(t, loc);
        continue;
      }
      const arr = isArr(schema[i]);

      // dynamic (bytes/string) or array: the head word is a byte offset; follow it to [length][data or words].
      this.emitEvmWordToValue(PrimitiveType.BIGINT, loc); // offset (unsigned)
      // length = decode blob[offset : offset+32]
      this.emit(Op.OP_DUP, loc); this.pushToStack('(x)');
      this.emit(encodeInt(BigInt(this.getStackIndex('__decblob'))), loc);
      this.emit(Op.OP_PICK, loc); this.pushToStack('(x)');
      this.emit(Op.OP_SWAP, loc);
      this.emit(Op.OP_SPLIT, loc); // blob split at offset -> [before, blob[offset:]]
      this.emit(Op.OP_NIP, loc); this.nipFromStack();
      this.emit(encodeInt(32n), loc); this.pushToStack('(x)');
      this.emit(Op.OP_SPLIT, loc);
      this.emit(Op.OP_DROP, loc); this.popFromStack();
      this.emitEvmWordToValue(PrimitiveType.BIGINT, loc); // length
      // data = blob[offset+32 : offset+32+length]
      this.emit(encodeInt(BigInt(this.getStackIndex('__decblob'))), loc);
      this.emit(Op.OP_PICK, loc); this.pushToStack('(x)');
      this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc); this.pushToStack('(x)');
      this.emit(encodeInt(32n), loc); this.pushToStack('(x)');
      this.emit(Op.OP_ADD, loc); this.popFromStack();
      this.emit(Op.OP_SPLIT, loc); // blob split at offset+32 -> [before, blob[offset+32:]]
      this.emit(Op.OP_NIP, loc); this.nipFromStack();
      this.emit(encodeInt(1n), loc); this.emit(Op.OP_PICK, loc); this.pushToStack('(x)');
      if (arr) { // an array of `length` elements occupies length*32 bytes of 32-byte element words
        this.emit(encodeInt(32n), loc); this.pushToStack('(x)');
        this.emit(Op.OP_MUL, loc); this.popFromStack();
      }
      this.emit(Op.OP_SPLIT, loc); // take that many bytes -> [data, rest]
      this.emit(Op.OP_DROP, loc); this.popFromStack();
      this.emit(Op.OP_NIP, loc); this.nipFromStack(); // drop the length temp
      this.emit(Op.OP_NIP, loc); this.nipFromStack(); // drop the offset temp
      if (arr) this.emitEvmWordsToArray((schema[i] as ArrayType).elementType, loc); // element words -> array blob
    }

    // remove the blob slot sitting under the N results
    const blobIdx = this.getStackIndex('__decblob');
    this.emit(encodeInt(BigInt(blobIdx)), loc);
    this.emit(Op.OP_ROLL, loc);
    this.emit(Op.OP_DROP, loc);
    this.removeFromStack(blobIdx);
  }

  visitAbiEncode(node: AbiEncodeNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    if (this.compilerOptions.evmCompat) {
      this.emitEvmAbiEncode(node.parameters, locationData);
      return node;
    }

    node.parameters.forEach((param, i) => {
      param = this.visit(param);
      node.parameters[i] = param;
      this.emitPushdataEncode(param.type!, locationData);
      if (i > 0) {
        this.emit(Op.OP_CAT, locationData);
        this.popFromStack(2);
        this.pushToStack('(value)');
      }
    });

    return node;
  }

  // evmCompat: encode a value type for abi.encodePacked - NATURAL width (no 32-byte padding), big-endian,
  // two's-complement for signed; bytesN is its raw N bytes; bool is one byte.
  private emitEvmPackedValue(type: Type, loc: SingleLocationData): void {
    if (type === PrimitiveType.BOOL) {
      this.emit(Op.OP_IF, loc);
      this.emit(encodeInt(1n), loc);
      this.emit(Op.OP_ELSE, loc);
      this.emit(encodeInt(0n), loc);
      this.emit(Op.OP_ENDIF, loc);
      this.emit(encodeInt(1n), loc);
      this.emit(Op.OP_NUM2BIN, loc);
    } else if (type instanceof IntType) {
      const byteLen = BigInt(type.bits / 8);
      if (type.signed) {
        this.emit(Op.OP_DUP, loc);
        this.emit(encodeInt(0n), loc);
        this.emit(Op.OP_LESSTHAN, loc);
        this.emit(encodeInt(1n << BigInt(type.bits)), loc);
        this.emit(Op.OP_MUL, loc);
        this.emit(Op.OP_ADD, loc);
      }
      this.emit(encodeInt(byteLen + 1n), loc);
      this.emit(Op.OP_NUM2BIN, loc);
      this.emit(encodeInt(byteLen), loc);
      this.emit(Op.OP_SPLIT, loc);
      this.emit(Op.OP_DROP, loc);
      this.emit(Op.OP_REVERSEBYTES, loc);
    } else if (type instanceof BytesType && type.bound !== undefined && type.bound <= 32) {
      // bytesN: its natural N bytes, already correct - no padding, no reverse.
    } else if ((type instanceof BytesType && type.bound === undefined) || type === PrimitiveType.STRING) {
      // dynamic bytes/string: packed is the raw content (no length prefix) - the value already IS that.
      return;
    } else if (type instanceof ArrayType && type.bound === undefined) {
      // dynamic array: each element padded to a 32-byte word, no length prefix (encode-tail minus the length).
      this.emitEvmArrayTail(type.elementType, loc, true);
      return;
    } else {
      throw new Error(`evmCompat abi.encodePacked: unsupported type '${type.toString()}'`);
    }
    this.popFromStack();
    this.pushToStack('(value)');
  }

  visitAbiEncodePacked(node: AbiEncodePackedNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    node.parameters.forEach((param, i) => {
      param = this.visit(param);
      node.parameters[i] = param;

      // For packed encoding, pad numeric types to their declared byte width
      if (this.compilerOptions.evmCompat) {
        this.emitEvmPackedValue(param.type!, locationData);
      } else if (param.type === PrimitiveType.BOOL) {
        // OP_IF OP_1 OP_ELSE OP_0 OP_ENDIF [1] OP_NUM2BIN -> canonical 0x00/0x01
        this.emit(Op.OP_IF, locationData);
        this.emit(encodeInt(1n), locationData);
        this.emit(Op.OP_ELSE, locationData);
        this.emit(encodeInt(0n), locationData);
        this.emit(Op.OP_ENDIF, locationData);
        this.emit(encodeInt(1n), locationData);
        this.emit(Op.OP_NUM2BIN, locationData);
        this.popFromStack();
        this.pushToStack('(value)');
      } else if (param.type instanceof IntType) {
        // Pad VM number to declared byte width
        this.emit(encodeInt(BigInt(param.type.byteWidth)), locationData);
        this.emit(Op.OP_NUM2BIN, locationData);
      } else if (param.type instanceof FixedType) {
        // Pad VM number to declared byte width
        this.emit(encodeInt(BigInt(param.type.byteWidth)), locationData);
        this.emit(Op.OP_NUM2BIN, locationData);
      }

      // CAT with previous if not the first
      if (i > 0) {
        this.emit(Op.OP_CAT, locationData);
        this.popFromStack(2);
        this.pushToStack('(value)');
      }
    });

    return node;
  }

  private emitEncodeArgsAndCatSelector(params: ExpressionNode[], locationData: SingleLocationData): void {
    params.forEach((param, i) => {
      param = this.visit(param);
      this.emitPushdataEncode(param.type!, locationData);
      if (i > 0) {
        this.emit(Op.OP_CAT, locationData);
        this.popFromStack(2);
        this.pushToStack('(value)');
      }
    });
    if (params.length > 0) {
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
    }
  }

  visitAbiEncodeWithSelector(node: AbiEncodeWithSelectorNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };
    this.visit(node.selector);
    if (this.compilerOptions.evmCompat) {
      // EVM: the raw 4-byte selector followed by the standard encoding of the args.
      this.emitEvmAbiEncode(node.parameters, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
    } else {
      this.emitEncodeArgsAndCatSelector(node.parameters, locationData);
    }
    return node;
  }

  visitAbiEncodeWithSignature(node: AbiEncodeWithSignatureNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };
    if (this.compilerOptions.evmCompat) {
      // EVM: keccak256(sig)[:4] selector (computed in SymbolTableTraversal) ++ the standard head/tail arg encoding.
      if (!node.computedSelector) {
        throw new Error('evmCompat: abi.encodeWithSignature needs a literal signature (runtime keccak selector unsupported)');
      }
      this.emit(node.computedSelector, locationData);
      this.pushToStack('(value)');
      this.emitEvmAbiEncode(node.parameters, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      return node;
    }
    if (node.computedSelector) {
      this.emit(node.computedSelector, locationData);
      this.pushToStack('(value)');
    } else {
      this.visit(node.signature);
      this.emit(Op.OP_SHA256, locationData);
      this.popFromStack();
      this.pushToStack('(value)');
      this.emit(encodeInt(4n), locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_SPLIT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.pushToStack('(value)');
      this.emit(Op.OP_DROP, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
    }
    this.emitEncodeArgsAndCatSelector(node.parameters, locationData);
    return node;
  }

  visitAbiEncodeCall(node: AbiEncodeCallNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };
    this.emit(node.computedSelector!, locationData);
    this.pushToStack('(value)');
    if (this.compilerOptions.evmCompat) {
      // EVM: keccak256(sig)[:4] selector ++ the standard head/tail arg encoding.
      this.emitEvmAbiEncode(node.parameters, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      return node;
    }
    this.emitEncodeArgsAndCatSelector(node.parameters, locationData);
    return node;
  }

  visitBytesConcat(node: BytesConcatNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    if (node.parameters.length === 0) {
      this.emit(encodeInt(0n), locationData);
      this.pushToStack('(value)');
      return node;
    }

    node.parameters.forEach((param, i) => {
      param = this.visit(param);
      node.parameters[i] = param;
      if (i > 0) {
        this.emit(Op.OP_CAT, locationData);
        this.popFromStack(2);
        this.pushToStack('(value)');
      }
    });

    return node;
  }

  visitStringConcat(node: StringConcatNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    if (node.parameters.length === 0) {
      this.emit(encodeInt(0n), locationData);
      this.pushToStack('(value)');
      return node;
    }

    node.parameters.forEach((param, i) => {
      param = this.visit(param);
      node.parameters[i] = param;
      if (i > 0) {
        this.emit(Op.OP_CAT, locationData);
        this.popFromStack(2);
        this.pushToStack('(value)');
      }
    });

    return node;
  }

  visitAbiDecode(node: AbiDecodeNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // Visit data expression - puts encoded blob on stack
    node.data = this.visit(node.data);

    if (this.compilerOptions.evmCompat) {
      const single = node.schema[0];
      if (node.schema.length === 1 && single instanceof StructType) {
        // a single struct: fixed-width -> inline field words; dynamic -> tuple head/tail re-framed to the struct blob
        if (this.isDynamicAbiType(single)) this.emitEvmStructDecodeDynamic(single, locationData);
        else this.emitEvmStructDecode(single, locationData);
        return node;
      }
      if (node.schema.length === 1 && single instanceof ArrayType && single.bound !== undefined
        && !this.isDynamicAbiType(single)) {
        // a single fixed-size static array: the ABI is inline element words (no offset/length) -> array blob
        this.emitEvmWordsToArray(single.elementType, locationData);
        return node;
      }
      if (node.schema.length === 1 && single instanceof ArrayType && single.bound === undefined) {
        // a single top-level array (offset is always 32); rebuild the SolidCash array blob
        if (this.isDynamicAbiType(single.elementType)) this.emitEvmDynamicArrayDecode(single.elementType, locationData);
        else this.emitEvmArrayDecode(single.elementType, locationData);
        return node;
      }
      const hasDynamic = node.schema.some(
        (t) => t === PrimitiveType.STRING || (t instanceof BytesType && t.bound === undefined)
          || (t instanceof ArrayType && t.bound === undefined),
      );
      if (hasDynamic) {
        // random-access decode that follows head offsets (bytes/string/array); manages its own tracking.
        this.emitEvmAbiDecodeDynamic(node.schema, locationData);
      } else {
        // all value types: N consecutive 32-byte words; net stack effect (pop blob, push N values) tracked here.
        this.emitEvmAbiDecode(node.schema, locationData);
        this.popFromStack();
        for (let i = 0; i < node.schema.length; i++) this.pushToStack('(value)');
      }
      return node;
    }

    // For each schema type, emit decoder that extracts value and leaves remainder
    for (let i = 0; i < node.schema.length; i++) {
      const type = node.schema[i];
      const isLast = i === node.schema.length - 1;

      if (isLast) {
        // Last field: just decode, no remainder needed
        this.emitPushdataDecodeLastField(type, locationData);
      } else {
        // Not last: decode value and leave remainder on top
        this.emitPushdataDecode(type, locationData);
      }
    }

    // Stack tracking: pop data blob, push N values
    // After visiting data, we have 1 value on stack (the blob)
    // Each decode step pops 1 (remainder) and pushes 2 (value + remainder), except the last which pushes 1
    // Net: pop 1 (blob), push N values
    this.popFromStack();
    for (let i = 0; i < node.schema.length; i++) {
      this.pushToStack('(value)');
    }

    return node;
  }

  visitAbiDecodeAt(node: AbiDecodeAtNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // Visit data expression
    node.data = this.visit(node.data);

    // Skip fields before the target index
    for (let i = 0; i < node.index; i++) {
      this.emitPushdataSkip(node.schema[i], locationData);
    }

    // Decode the target field
    const isLast = node.index === node.schema.length - 1;
    if (isLast) {
      this.emitPushdataDecodeLastField(node.schema[node.index], locationData);
    } else {
      this.emitPushdataDecode(node.schema[node.index], locationData);
      // Drop remainder (top of stack); decoded value is below it
      this.emit(Op.OP_DROP, locationData);
    }

    // Stack tracking: pop 1 (blob), push 1 (value)
    this.popFromStack();
    this.pushToStack('(value)');

    return node;
  }

  // === Pushdata encode helpers ===

  /**
   * Emit minimal pushdata encoding for a value on the stack.
   * After execution: pops 1 value, pushes 1 encoded bytes value.
   */
  private emitPushdataEncode(type: Type, locationData: SingleLocationData): void {
    // A function pointer is its integer functionId on the wire: encode/decode it as an int.
    if (type instanceof FunctionType) type = PrimitiveType.BIGINT;
    // StructType: the value is already an encoded blob from construction - no-op
    if (type instanceof StructType) {
      return;
    }
    // ArrayType: the value is already an encoded blob (length prefix + elements) - no-op
    if (type instanceof ArrayType) {
      return;
    }

    if (type === PrimitiveType.BOOL) {
      // OP_IF <0x51> OP_ELSE <0x00> OP_ENDIF
      this.emit(Op.OP_IF, locationData);
      this.emit(new Uint8Array([0x51]), locationData); // OP_1 byte
      this.emit(Op.OP_ELSE, locationData);
      this.emit(new Uint8Array([0x00]), locationData); // OP_0 byte
      this.emit(Op.OP_ENDIF, locationData);
      this.popFromStack();
      this.pushToStack('(value)');
    } else if (type instanceof BytesType && type.bound !== undefined && type.bound >= 2 && type.bound <= 75) {
      // Fixed-size bytes (2-75): <N> OP_SWAP OP_CAT
      this.emit(new Uint8Array([type.bound]), locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
    } else if (type === PrimitiveType.PUBKEY) {
      // pubkey is 33 bytes: <33> OP_SWAP OP_CAT
      this.emit(new Uint8Array([33]), locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
    } else {
      // Generic pushdata encode for int, bytes, string, sig, datasig, bytes1, unbounded bytes
      this.emitGenericPushdataEncode(type, locationData);
    }
  }

  /**
   * Generic pushdata encoder for variable-size types.
   * Handles OP_0, OP_1-OP_16, OP_1NEGATE, and standard pushdata framing.
   */
  private emitGenericPushdataEncode(type: Type, locationData: SingleLocationData): void {
    // Stack: [value]
    // We need to encode the value using minimal pushdata format

    // First, handle the special cases for int-like types
    const isIntLike = type === PrimitiveType.BIGINT || type instanceof IntType
      || type instanceof FixedType || (type instanceof BytesType && type.bound === 1);

    // The int-like branch is shared via a subroutine when used >=2 times.
    if (isIntLike
      && this.invokeSubroutineIfDefined(GenerateTargetTraversalWithLocation.INT_ENCODE_SUBROUTINE_ID, locationData)) {
      this.popFromStack();
      this.pushToStack('(value)');
      return;
    }

    if (isIntLike) {
      // For int/bytes1: check for OP_0, OP_1-OP_16, OP_1NEGATE, then standard pushdata
      // DUP the value to test it
      this.emit(Op.OP_DUP, locationData);

      // Check if empty/zero: OP_0NOTEQUAL to check for boolean truthiness
      this.emit(Op.OP_SIZE, locationData);
      this.emit(encodeInt(0n), locationData);
      this.emit(Op.OP_EQUAL, locationData);

      // If size is 0 (value is 0/empty), emit OP_0 byte
      this.emit(Op.OP_IF, locationData);
      this.emit(Op.OP_DROP, locationData); // drop the dup
      this.emit(Op.OP_DROP, locationData); // drop the original
      this.emit(new Uint8Array([0x00]), locationData); // OP_0
      this.emit(Op.OP_ELSE, locationData);

      // Check size == 1
      this.emit(Op.OP_SIZE, locationData);
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_EQUAL, locationData);
      this.emit(Op.OP_IF, locationData);

      // 1-byte value: check for OP_1-OP_16 (0x01-0x10) and OP_1NEGATE (0x81)
      // DUP and check if value == 0x81 (OP_1NEGATE)
      this.emit(Op.OP_DUP, locationData);
      this.emit(new Uint8Array([0x81]), locationData);
      this.emit(Op.OP_EQUAL, locationData);
      this.emit(Op.OP_IF, locationData);
      this.emit(Op.OP_DROP, locationData); // drop dup
      this.emit(Op.OP_DROP, locationData); // drop original
      this.emit(new Uint8Array([0x4f]), locationData); // OP_1NEGATE
      this.emit(Op.OP_ELSE, locationData);

      // Check if 0x01 <= value <= 0x10 (1-16)
      // Convert to number for comparison
      this.emit(Op.OP_DUP, locationData);
      this.emit(Op.OP_BIN2NUM, locationData);
      this.emit(Op.OP_DUP, locationData);
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_GREATERTHANOREQUAL, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(encodeInt(16n), locationData);
      this.emit(Op.OP_LESSTHANOREQUAL, locationData);
      this.emit(Op.OP_BOOLAND, locationData);

      this.emit(Op.OP_IF, locationData);
      // Value is 1-16: encode as OP_1-OP_16 (0x51-0x60)
      this.emit(Op.OP_DROP, locationData); // drop dup
      this.emit(Op.OP_BIN2NUM, locationData);
      this.emit(encodeInt(0x50n), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_NUM2BIN, locationData);
      this.emit(Op.OP_ELSE, locationData);
      // Standard 1-byte pushdata: 0x01 <byte>
      this.emit(Op.OP_DROP, locationData); // drop dup
      this.emit(new Uint8Array([0x01]), locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.emit(Op.OP_ENDIF, locationData);
      this.emit(Op.OP_ENDIF, locationData);

      this.emit(Op.OP_ELSE, locationData);
      // Multi-byte value: standard pushdata
      this.emit(Op.OP_DROP, locationData); // drop dup
      this.emitStandardPushdataFrame(locationData);
      this.emit(Op.OP_ENDIF, locationData);
      this.emit(Op.OP_ENDIF, locationData);
    } else {
      // For bytes, string, sig, datasig, unbounded bytes: generic pushdata
      // DUP the value to check its size
      this.emit(Op.OP_DUP, locationData);
      this.emit(Op.OP_SIZE, locationData);
      this.emit(encodeInt(0n), locationData);
      this.emit(Op.OP_EQUAL, locationData);

      // If empty
      this.emit(Op.OP_IF, locationData);
      this.emit(Op.OP_DROP, locationData); // drop the dup
      this.emit(Op.OP_DROP, locationData); // drop the original
      this.emit(new Uint8Array([0x00]), locationData); // OP_0
      this.emit(Op.OP_ELSE, locationData);

      this.emit(Op.OP_DROP, locationData); // drop the dup
      // Standard pushdata framing
      this.emitStandardPushdataFrame(locationData);
      this.emit(Op.OP_ENDIF, locationData);
    }

    this.popFromStack();
    this.pushToStack('(value)');
  }


  /**
   * Emit standard pushdata frame: <len> <data> or OP_PUSHDATA1 <len> <data> or OP_PUSHDATA2 <len_LE> <data>
   * Assumes value is on top of stack (non-empty).
   */
  private emitStandardPushdataFrame(locationData: SingleLocationData): void {
    // Stack: [value] -> [framed_blob]. Use the shared subroutine when defined (>=2 uses).
    if (this.invokeSubroutineIfDefined(GenerateTargetTraversalWithLocation.PUSHDATA_FRAME_SUBROUTINE_ID, locationData)) {
      return;
    }

    // Get size
    this.emit(Op.OP_SIZE, locationData);
    // DUP size for comparison
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(75n), locationData);
    this.emit(Op.OP_LESSTHANOREQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    // Size <= 75: <size_byte> <data>
    this.emit(encodeInt(1n), locationData);
    this.emit(Op.OP_NUM2BIN, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_CAT, locationData);
    this.emit(Op.OP_ELSE, locationData);
    // Size > 75: check size <= 255
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(255n), locationData);
    this.emit(Op.OP_LESSTHANOREQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    // OP_PUSHDATA1 format: 0x4c <1-byte len> <data>
    // Use NUM2BIN(2) + truncate to handle sizes >= 128 (sign bit in NUM2BIN)
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_NUM2BIN, locationData);
    this.emit(encodeInt(1n), locationData);
    this.emit(Op.OP_SPLIT, locationData);
    this.emit(Op.OP_DROP, locationData);
    this.emit(new Uint8Array([0x4c]), locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_CAT, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_CAT, locationData);
    this.emit(Op.OP_ELSE, locationData);
    // OP_PUSHDATA2 format: 0x4d <2-byte len LE> <data>
    // Use NUM2BIN(3) + truncate to handle sizes >= 32768 (sign bit in NUM2BIN)
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_NUM2BIN, locationData);
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_SPLIT, locationData);
    this.emit(Op.OP_DROP, locationData);
    this.emit(new Uint8Array([0x4d]), locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_CAT, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_CAT, locationData);
    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_ENDIF, locationData);
  }


  // === Pushdata decode helpers ===

  /**
   * Decode one field from the encoded blob and leave the remainder on top.
   * Stack before: [encoded_blob]
   * Stack after: [decoded_value] [remainder]
   */
  private emitPushdataDecode(type: Type, locationData: SingleLocationData): void {
    // A function pointer is its integer functionId on the wire: encode/decode it as an int.
    if (type instanceof FunctionType) type = PrimitiveType.BIGINT;
    // StructType: extract struct bytes from blob, leaving remainder
    // Stack: [blob] -> [struct_bytes, remainder]
    if (type instanceof StructType) {
      // DUP the blob, skip struct fields on the copy to measure remainder size,
      // then compute struct size and split the original blob
      this.emit(Op.OP_DUP, locationData);              // [blob, blob_copy]
      for (const field of type.fields) {
        this.emitPushdataSkip(field.type, locationData); // [blob, remainder]
      }
      this.emit(Op.OP_SIZE, locationData);               // [blob, remainder, rem_size]
      this.emit(Op.OP_NIP, locationData);                // [blob, rem_size]
      this.emit(Op.OP_SWAP, locationData);               // [rem_size, blob]
      this.emit(Op.OP_DUP, locationData);                // [rem_size, blob, blob]
      this.emit(Op.OP_SIZE, locationData);               // [rem_size, blob, blob, blob_size]
      this.emit(Op.OP_NIP, locationData);                // [rem_size, blob, blob_size]
      this.emit(Op.OP_ROT, locationData);                // [blob, blob_size, rem_size]
      this.emit(Op.OP_SUB, locationData);                // [blob, struct_size]
      this.emit(Op.OP_SPLIT, locationData);              // [struct_bytes, remainder]
      return;
    }

    // ArrayType: extract inner array bytes from blob, leaving remainder
    // Uses same DUP-skip-measure-split pattern as StructType
    // Stack: [blob] -> [array_bytes, remainder]
    if (type instanceof ArrayType) {
      this.emit(Op.OP_DUP, locationData);              // [blob, blob_copy]
      this.emitPushdataSkip(type, locationData);        // [blob, remainder]
      this.emit(Op.OP_SIZE, locationData);               // [blob, remainder, rem_size]
      this.emit(Op.OP_NIP, locationData);                // [blob, rem_size]
      this.emit(Op.OP_SWAP, locationData);               // [rem_size, blob]
      this.emit(Op.OP_DUP, locationData);                // [rem_size, blob, blob]
      this.emit(Op.OP_SIZE, locationData);               // [rem_size, blob, blob, blob_size]
      this.emit(Op.OP_NIP, locationData);                // [rem_size, blob, blob_size]
      this.emit(Op.OP_ROT, locationData);                // [blob, blob_size, rem_size]
      this.emit(Op.OP_SUB, locationData);                // [blob, array_size]
      this.emit(Op.OP_SPLIT, locationData);              // [array_bytes, remainder]
      return;
    }

    if (type === PrimitiveType.BOOL) {
      // Bool is always 1 byte: split 1, swap, check == 0x51 for true
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(new Uint8Array([0x51]), locationData);
      this.emit(Op.OP_EQUAL, locationData);
      this.emit(Op.OP_SWAP, locationData);
    } else if (type instanceof BytesType && type.bound !== undefined && type.bound >= 2 && type.bound <= 75) {
      // Fixed-size bytes: skip 1-byte length prefix, then extract N bytes
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData); // drop length byte
      this.emit(encodeInt(BigInt(type.bound)), locationData);
      this.emit(Op.OP_SPLIT, locationData);
    } else if (type === PrimitiveType.PUBKEY) {
      // pubkey is 33 bytes: skip 1-byte length prefix, extract 33
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(encodeInt(33n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
    } else {
      // Generic: parse pushdata header to get length, then extract
      this.emitGenericPushdataDecode(type, locationData);
    }
  }

  /**
   * Decode the last field from the encoded blob. No remainder produced.
   * Stack before: [encoded_blob]
   * Stack after: [decoded_value]
   */
  private emitPushdataDecodeLastField(type: Type, locationData: SingleLocationData): void {
    // StructType: take the remainder as-is (struct is always last)
    if (type instanceof StructType) {
      return; // blob on stack is already the struct
    }
    // ArrayType: take the remainder as-is (array blob is always last)
    if (type instanceof ArrayType) {
      return; // blob on stack is already the array
    }

    if (type === PrimitiveType.BOOL) {
      // Bool: entire remaining blob should be 1 byte
      this.emit(new Uint8Array([0x51]), locationData);
      this.emit(Op.OP_EQUAL, locationData);
    } else if (type instanceof BytesType && type.bound !== undefined && type.bound >= 2 && type.bound <= 75) {
      // Skip length prefix byte, rest is the data
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData);
    } else if (type === PrimitiveType.PUBKEY) {
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData);
    } else {
      // Generic: parse pushdata header, extract value, drop remainder (should be empty)
      this.emitGenericPushdataDecode(type, locationData);
      this.emit(Op.OP_DROP, locationData); // drop remainder (empty)
    }
  }

  /**
   * Skip one field in the encoded blob.
   * Stack before: [encoded_blob]
   * Stack after: [remainder_after_field]
   */
  // Guards emitPushdataSkip against a self/mutually recursive struct type: skipping its encoding would recurse
  // forever (struct -> array field -> scan element -> same struct). Such a type has no finite inline encoding on
  // BCH's fixed-layout state, so reject cleanly instead of overflowing the stack.
  private pushdataSkipStructs: Set<StructType> = new Set();

  private emitPushdataSkip(type: Type, locationData: SingleLocationData): void {
    // StructType: skip each field individually
    if (type instanceof StructType) {
      if (this.pushdataSkipStructs.has(type)) {
        throw new Error('recursive struct types are not supported (no finite inline encoding on BCH)');
      }
      this.pushdataSkipStructs.add(type);
      for (const field of type.fields) {
        this.emitPushdataSkip(field.type, locationData);
      }
      this.pushdataSkipStructs.delete(type);
      return;
    }

    // ArrayType: decode inner array's length prefix, then skip that many inner elements
    // Stack: [blob] -> [remainder_after_inner_array]
    if (type instanceof ArrayType) {
      const innerElemType = type.elementType;
      const innerFixedWidth = isFixedWidthType(innerElemType);

      // Decode the inner array's length prefix (pushdata-encoded int)
      // Stack: [blob] -> [decoded_length, rest_after_prefix]
      this.emitGenericPushdataDecode(PrimitiveType.BIGINT, locationData);
      // Stack: [decoded_length, rest_after_prefix]
      this.emit(Op.OP_SWAP, locationData);
      // Stack: [rest_after_prefix, decoded_length]

      if (innerFixedWidth) {
        const width = getFixedWidth(innerElemType);
        // Compute total bytes to skip: length * element_width
        this.emit(encodeInt(BigInt(width)), locationData);
        this.emit(Op.OP_MUL, locationData);
        // Stack: [rest_after_prefix, total_skip_bytes]
        this.emit(Op.OP_SPLIT, locationData);
        // Stack: [skipped_data, remainder]
        this.emit(Op.OP_NIP, locationData);
        // Stack: [remainder]
      } else {
        // Variable-width inner elements: use scan loop
        // emitScanLoop expects [blob, count], we have [rest_after_prefix, decoded_length]
        this.emitScanLoop(innerElemType, locationData);
        // Stack: [remainder]
      }
      return;
    }

    if (type === PrimitiveType.BOOL) {
      // Bool is always 1 byte
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData);
    } else if (type instanceof BytesType && type.bound !== undefined && type.bound >= 2 && type.bound <= 75) {
      // Fixed-size bytes: always N+1 bytes (1 length byte + N data bytes)
      this.emit(encodeInt(BigInt(type.bound + 1)), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData);
    } else if (type === PrimitiveType.PUBKEY) {
      // pubkey: 1+33 = 34 bytes
      this.emit(encodeInt(34n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData);
    } else {
      // Generic: parse pushdata header, skip the data
      this.emitGenericPushdataSkip(type, locationData);
    }
  }

  /**
   * A contract whose fixed-size state spans more than one data NFT prepends a verifiable nftIndex tag
   * to every data-NFT commitment (so a higher-index NFT cannot be passed off as a lower one - they
   * share one covenant address). Single-data-NFT contracts carry no tag. Mirrors isMultiDataNftLayout.
   */
  private isMultiDataNft(): boolean {
    return this.stateVariables.some((v) => v.nftIndex >= 1);
  }

  /** Consume a leading nftIndex tag without checking it. Stack: [commitment] -> [fields_blob]. */
  /**
   * Verify a leading nftIndex tag == expected index, consuming it. The adversarial disambiguation for
   * external AND self reads (H1): a substituted sibling data NFT carries a different tag and fails here.
   * Stack: [commitment] -> [fields_blob].
   */
  private emitNftIndexTagVerify(nftIndex: number, locationData: SingleLocationData): void {
    this.emitGenericPushdataDecode(PrimitiveType.BIGINT, locationData); // [tagValue, remainder]
    this.emit(Op.OP_SWAP, locationData);                             // [remainder, tagValue]
    this.emit(encodeInt(BigInt(nftIndex)), locationData);            // [remainder, tagValue, n]
    this.emit(Op.OP_EQUALVERIFY, locationData);                      // [remainder]
  }

  /**
   * Generic pushdata decoder for variable-size types.
   * Stack before: [encoded_blob]
   * Stack after: [decoded_value] [remainder]
   */
  private emitGenericPushdataDecode(type: Type, locationData: SingleLocationData): void {
    this.bumpSubroutineUse(GenerateTargetTraversalWithLocation.INT_DECODE_SUBROUTINE_ID);
    const isIntLike = type === PrimitiveType.BIGINT || type instanceof IntType || type instanceof FixedType;

    // Use shared OP_DEFINE subroutine when available.
    // The subroutine returns [raw_bytes, remainder]. For int types, add BIN2NUM.
    if (this.subroutineDefined.get(GenerateTargetTraversalWithLocation.INT_DECODE_SUBROUTINE_ID)) {
      this.emit(encodeInt(GenerateTargetTraversalWithLocation.INT_DECODE_SUBROUTINE_ID), locationData);
      this.emit(Op.OP_INVOKE, locationData);
      // Subroutine returns [raw_bytes, remainder]. Convert raw to int if needed.
      if (isIntLike) {
        this.emit(Op.OP_SWAP, locationData);
        this.emit(Op.OP_BIN2NUM, locationData);
        this.emit(Op.OP_SWAP, locationData);
      }
      return;
    }

    // Inline fallback path (used when subroutine is not defined)
    // Read first byte
    this.emit(encodeInt(1n), locationData);
    this.emit(Op.OP_SPLIT, locationData);
    this.emit(Op.OP_SWAP, locationData);

    // Check for OP_0 (0x00)
    this.emit(Op.OP_DUP, locationData);
    this.emit(new Uint8Array([0x00]), locationData);
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_DROP, locationData);
    // Push zero/empty value based on type
    if (isIntLike) {
      this.emit(encodeInt(0n), locationData);
    } else {
      this.emit(encodeInt(0n), locationData); // empty bytes
    }
    this.emit(Op.OP_SWAP, locationData); // [value] [remainder]
    this.emit(Op.OP_ELSE, locationData);

    // Check for OP_1NEGATE (0x4f)
    this.emit(Op.OP_DUP, locationData);
    this.emit(new Uint8Array([0x4f]), locationData);
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_DROP, locationData);
    if (isIntLike) {
      this.emit(encodeInt(-1n), locationData);
    } else {
      this.emit(new Uint8Array([0x81]), locationData);
    }
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_ELSE, locationData);

    // Check for OP_1-OP_16 (0x51-0x60)
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_BIN2NUM, locationData);
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(0x51n), locationData);
    this.emit(Op.OP_GREATERTHANOREQUAL, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(encodeInt(0x60n), locationData);
    this.emit(Op.OP_LESSTHANOREQUAL, locationData);
    this.emit(Op.OP_BOOLAND, locationData);
    this.emit(Op.OP_IF, locationData);
    // It's OP_N: value = byte - 0x50
    if (isIntLike) {
      this.emit(Op.OP_BIN2NUM, locationData);
      this.emit(encodeInt(0x50n), locationData);
      this.emit(Op.OP_SUB, locationData);
    } else {
      this.emit(Op.OP_BIN2NUM, locationData);
      this.emit(encodeInt(0x50n), locationData);
      this.emit(Op.OP_SUB, locationData);
      this.emit(encodeInt(1n), locationData);
      this.emit(Op.OP_NUM2BIN, locationData);
    }
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_ELSE, locationData);

    // Check for OP_PUSHDATA1 (0x4c)
    this.emit(Op.OP_DUP, locationData);
    this.emit(new Uint8Array([0x4c]), locationData);
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_DROP, locationData); // drop opcode byte -> [remainder]
    // Read 1-byte length from remainder
    this.emit(encodeInt(1n), locationData);
    this.emit(Op.OP_SPLIT, locationData); // [length_byte, remaining_data]
    this.emit(Op.OP_SWAP, locationData); // [remaining_data, length_byte]
    // Append 0x00 to ensure unsigned BIN2NUM (length >= 128 has sign bit set)
    this.emit(new Uint8Array([0x00]), locationData);
    this.emit(Op.OP_CAT, locationData); // [remaining_data, length_byte + 0x00]
    this.emit(Op.OP_BIN2NUM, locationData); // convert to unsigned number
    this.emit(Op.OP_SPLIT, locationData); // [data, rest]
    if (isIntLike) {
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_BIN2NUM, locationData);
      this.emit(Op.OP_SWAP, locationData);
    }
    this.emit(Op.OP_ELSE, locationData);

    // Check for OP_PUSHDATA2 (0x4d)
    this.emit(Op.OP_DUP, locationData);
    this.emit(new Uint8Array([0x4d]), locationData);
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_DROP, locationData); // drop opcode byte -> [remainder]
    // Read 2-byte length (LE) from remainder
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_SPLIT, locationData); // [length_2bytes, remaining_data]
    this.emit(Op.OP_SWAP, locationData); // [remaining_data, length_2bytes]
    // Append 0x00 to ensure unsigned BIN2NUM (length >= 32768 has sign bit set)
    this.emit(new Uint8Array([0x00]), locationData);
    this.emit(Op.OP_CAT, locationData); // [remaining_data, length_2bytes + 0x00]
    this.emit(Op.OP_BIN2NUM, locationData); // convert to unsigned number
    this.emit(Op.OP_SPLIT, locationData); // [data, rest]
    if (isIntLike) {
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_BIN2NUM, locationData);
      this.emit(Op.OP_SWAP, locationData);
    }
    this.emit(Op.OP_ELSE, locationData);

    // Standard pushdata: first byte IS the length (1-75)
    this.emit(Op.OP_BIN2NUM, locationData); // convert length byte to number
    this.emit(Op.OP_SPLIT, locationData); // [data] [rest]
    if (isIntLike) {
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_BIN2NUM, locationData);
      this.emit(Op.OP_SWAP, locationData);
    }

    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_ENDIF, locationData);
  }

  /**
   * Generic pushdata skip for variable-size types.
   * Stack before: [encoded_blob]
   * Stack after: [remainder_after_field]
   */
  private emitGenericPushdataSkip(type: Type, locationData: SingleLocationData): void {
    // Same as decode but we drop the value instead of keeping it
    this.emitGenericPushdataDecode(type, locationData);
    this.emit(Op.OP_SWAP, locationData); // [remainder] [value]
    this.emit(Op.OP_DROP, locationData); // drop value
  }

  // ===== State Variable Support =====

  visitStateAccess(node: StateAccessNode): Node {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // this.balance - get own category, derive satoshi container lbc, loop over inputs
    if (node.name === 'balance' && !node.stateVariable) {
      // Get own category (32 bytes, strip capability flag)
      this.emitMasterInputIndex(locationData);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.pushToStack('(value)');
      // Derive satoshi container lbc from category
      this.emitSatoshiContainerLbc(locationData);
      // Loop over inputs summing matching values
      this.emitBalanceLoop(false, locationData);
      return node;
    }

    // this.outState - get own category (used as this.outState.balance, handled specially
    // in visitFieldAccess: derives the own satoshi container lbc and sums over outputs)
    if (node.name === 'outState' && !node.stateVariable) {
      // Get own category (32 bytes, strip capability flag)
      this.emitMasterInputIndex(locationData);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.pushToStack('(value)');
      return node;
    }

    const sv = node.stateVariable!;
    const key = `${sv.nftIndex}:${sv.fieldIndex}`;

    // Dynamic-storage read (string / unbounded bytes): the data-NFT field holds only the uint32 length
    // header (A$len); the persisted value lives in chunk UTXOs.
    if (sv.isDynamic) {
      this.emitReadDynamicScalar(sv, locationData);
      // Chunk-packed array: rebuild the canonical `pushdata(count)++elems` form (fixed-width prepends count
      // from A$len/width; variable-width canonicalizes an empty read to pushdata(0)). Strings/bytes: no-op.
      this.emitReframeDynamicArrayRead(sv, locationData);
      return node;
    }

    // If this state variable has been written (pre-allocated in a loop or branch),
    // read from the stack-tracked value instead of re-reading from the input commitment.
    // This is critical for loops: each iteration must see the previous iteration's
    // written value, not the original input value.
    if (this.pendingStateWrites.has(key)) {
      const stackName = this.pendingStateWrites.get(key)!;
      const stackIdx = this.getStackIndex(stackName);
      this.emit(encodeInt(BigInt(stackIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      // The picked value is pushdata-encoded - decode it
      this.emitPushdataDecodeLastField(sv.type, locationData);
      this.pushToStack('(value)');
      return node;
    }

    // Get fields in same NFT, sorted by fieldIndex
    const fieldsInNft = this.stateVariables
      .filter((v) => v.nftIndex === sv.nftIndex)
      .sort((a, b) => a.fieldIndex - b.fieldIndex);

    // 1. Get NFT commitment: masterInputIndex + <compactOffset> + OP_ADD + OP_UTXOTOKENCOMMITMENT
    this.emitMasterInputIndex(locationData);
    this.emit(encodeInt(BigInt(this.compactOffsetMap.get(sv.nftIndex)!)), locationData);
    this.emit(Op.OP_ADD, locationData);
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);

    // 1b. Verify the leading nftIndex tag == this field's NFT index (multi-data-NFT anti-substitution, H1)
    if (this.isMultiDataNft()) this.emitNftIndexTagVerify(sv.nftIndex, locationData);

    // 2. Skip preceding fields
    for (let i = 0; i < sv.fieldIndex; i++) {
      this.emitPushdataSkip(this.physicalFieldType(fieldsInNft[i]), locationData);
    }

    // 3. Decode this field
    const isLast = sv.fieldIndex === fieldsInNft.length - 1;
    if (isLast) {
      this.emitPushdataDecodeLastField(sv.type, locationData);
    } else {
      this.emitPushdataDecode(sv.type, locationData);
      // Drop the remainder (top of stack); decoded_value is below it
      this.emit(Op.OP_DROP, locationData);
    }

    this.pushToStack('(value)');
    return node;
  }

  visitStateAssign(node: StateAssignNode): Node {
    const sv = node.stateVariable!;
    const key = `${sv.nftIndex}:${sv.fieldIndex}`;
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // Dynamic-storage write (string / unbounded bytes): the data-NFT field holds uint32 A$len; the value
    // is split into chunk UTXOs verified in the epilogue. Keep the raw value on the stack until then.
    if (sv.isDynamic) {
      // 1. Evaluate expression -> raw value bytes on top, then register the chunk write. A chunk-packed
      // array's on-stack form is `pushdata(count)++elems`; strip the count only for a fixed-width element
      // type (recoverable as A$len/width) - variable-width keeps it. Strings/bytes (non-array) never strip.
      node.expression = this.visit(node.expression);
      const stripCount = sv.type instanceof ArrayType && isFixedWidthType((sv.type as ArrayType).elementType);
      this.emitRegisterDynamicWrite(sv, key, locationData, stripCount, node);
      return node;
    }

    // 1. Evaluate expression
    node.expression = this.visit(node.expression);

    // 2. Encode to pushdata format
    this.emitPushdataEncode(sv.type, locationData);

    if (this.pendingStateWrites.has(key)) {
      // The slot is already ON THE STACK (pre-allocated before a branch, OR pushed by an earlier write to this
      // same var). A re-write must REPLACE it in place - NOT push a new one. Pushing a new slot inside a
      // conditional desyncs the stack when the branch is not taken (the push never runs at runtime). Keying on
      // preAllocatedStateWrites alone missed a prior UNCONDITIONAL write (`x = a; if (c) { x = b; }`).
      const stackName = `__internal__state_write_${sv.name}`;
      this.emitReplace(this.getStackIndex(stackName), node);
      this.popFromStack(); // pop the computed value from tracker
    } else {
      // First write to this var: push it as the pending slot.
      this.popFromStack();
      const stackName = `__internal__state_write_${sv.name}`;
      this.pushToStack(stackName);
      this.pendingStateWrites.set(key, stackName);
    }

    return node;
  }

  visitDeleteState(node: DeleteStateNode): Node {
    const sv = node.stateVariable!;
    const key = `${sv.nftIndex}:${sv.fieldIndex}`;
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // 1. Emit the default value for this type
    this.emitDefaultValue(locationData, sv.type);

    // 2. Encode to pushdata format
    this.pushToStack('(value)');
    this.emitPushdataEncode(sv.type, locationData);

    // 3. Follow the same state write path as visitStateAssign: replace an already-on-stack slot in place
    // (pre-allocated OR pushed by an earlier write to this var), else push the first pending slot.
    if (this.pendingStateWrites.has(key)) {
      const stackName = `__internal__state_write_${sv.name}`;
      this.emitReplace(this.getStackIndex(stackName), node);
      this.popFromStack();
    } else {
      this.popFromStack();
      const stackName = `__internal__state_write_${sv.name}`;
      this.pushToStack(stackName);
      this.pendingStateWrites.set(key, stackName);
    }

    return node;
  }

  // ===== External State Read Support =====

  visitExternalStateAccess(node: ExternalStateAccessNode): Node {
    const info = node.readInfo!;
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // 1. Compute external input index: readOnlyDataNft block slot + slotIndex
    this.emitBlockSlotIndex('readOnlyDataNft', info.externalReadSlotIndex, locationData);

    // 2. Read commitment at that index
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);

    // 2b. Verify the nftIndex tag (multi-data-NFT callee): proves which register was co-spent, so a
    // substituted sibling NFT (different tag) is rejected.
    if (info.calleeMultiNft) this.emitNftIndexTagVerify(info.nftIndex, locationData);

    // 3. Skip preceding fields
    const fieldsInNft = info.fieldsInNft;
    for (let i = 0; i < info.fieldIndex; i++) {
      this.emitPushdataSkip(fieldsInNft[i].type, locationData);
    }

    // 4. Decode target field
    const isLast = info.fieldIndex === fieldsInNft.length - 1;
    if (isLast) {
      this.emitPushdataDecodeLastField(info.stateVarType, locationData);
    } else {
      this.emitPushdataDecode(info.stateVarType, locationData);
      this.emit(Op.OP_DROP, locationData);
    }

    this.pushToStack('(value)');
    return node;
  }

  visitExternalMappingAccess(node: ExternalMappingAccessNode): Node {
    const info = node.readInfo!;
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // 1. Check if external entry exists via introspection
    this.emitSlotExistsCheck('readOnlyDataNft', info.externalReadSlotIndex, locationData);

    // 2. OP_IF (entry exists)
    this.emit(Op.OP_IF, locationData);

    // 3. Compute entry input index
    this.emitBlockSlotIndex('readOnlyDataNft', info.externalReadSlotIndex, locationData);
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);

    // 4. Decode keys from commitment and verify they match, then extract value
    for (let i = 0; i < info.keyTypes.length; i++) {
      this.emitPushdataDecode(info.keyTypes[i], locationData);
      // Visit key expression to push expected key to stack
      node.keys[i] = this.visit(node.keys[i]);
      // Verify key matches
      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(); // pop expected key
    }

    // 5. Remaining blob is the value - decode it
    this.emitPushdataDecodeLastField(info.valueType, locationData);

    // OP_ELSE - entry doesn't exist, push default value
    this.emit(Op.OP_ELSE, locationData);
    this.emitDefaultValue(locationData, info.valueType);
    this.emit(Op.OP_ENDIF, locationData);

    this.pushToStack('(value)');
    return node;
  }

  visitExternalFunctionCall(node: ExternalFunctionCallNode): Node {
    // A call folded into a deploy genesis is inert here - its effect is emitted by the deploy covenant.
    if (node.foldedIntoDeploy) return node;
    // Do NOT visit categoryExpression or parameters here - they were resolved during
    // semantic analysis. Visiting them would cause stack operations (OP_ROLL/OP_PICK)
    // that consume constructor parameters needed later by emitExternalCallVerification.
    // The actual runtime values are accessed via synthetic parameters (_externalCallInputBase,
    // _externalReturnOutputIdx, etc.).

    const locationData = { location: node.location, positionHint: PositionHint.START };

    // Inline loop-indexed dispatch: `targets[i].call/staticcall(data[i])` over a calldata/param address array
    // whose per-element return is consumed in the loop body (MultiCall). The source for-loop is a runtime loop,
    // so this runs once per iteration with the live index. Marks the slot so both epilogues skip it.
    // The target is either a direct element `targets[i]` or a struct FIELD of a struct-array element
    // `calls[i].target` (Multicall2 `Call[] { address target; bytes callData; }`).
    const ilcAe = node.addressExpression;
    const ilcIsLoopElem = ilcAe instanceof ArrayAccessNode
      || (ilcAe instanceof FieldAccessNode && ilcAe.expression instanceof ArrayAccessNode);
    if (node.callInfo && node.opaqueReturn && ilcIsLoopElem) {
      const loopSlot = this.externalCallSlots[node.callInfo.externalCallSlotIndex];
      if (loopSlot?.loopArrayVar
          && this.currentFunction?.parameters.some((p) => p.name === loopSlot.loopArrayVar)) {
        loopSlot.inlineLoopDispatch = true;
        this.emitInlineLoopExternalCall(node, loopSlot, locationData);
        return node;
      }
    }

    // Handle {value: X} call option - emit a transfer to the callee's address
    if (node.callOptions?.value && node.valueTransferIndex >= 0 && node.callInfo) {
      const slot = this.externalCallSlots[node.callInfo.externalCallSlotIndex];
      if (slot?.addressParam) {
        node.callOptions.value = this.emitValueTransfer(
          node.valueTransferIndex, node.callOptions.value, slot.addressParam, locationData, node,
        );
      }
    }

    // If this call has return values, read them from the return event UTXO
    if (node.callInfo?.hasReturnValues && node.callInfo.returnTypes) {
      const returnTypes = node.callInfo.returnTypes;

      // Read the return event UTXO commitment at per-slot _externalReturnOutputIdx
      const returningSlotCount = this.externalCallSlots.filter((s) => s.hasReturnValues).length;
      const returnParamName = returningSlotCount === 1
        ? '__internal__externalReturnOutputIdx'
        : `__internal__externalReturnOutputIdx${node.callInfo.returnSlotIndex}`;
      const returnOutputIdxIdx = this.getStackIndex(returnParamName);
      this.emit(encodeInt(BigInt(returnOutputIdxIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);
      // Stack: [return_blob] (1 untracked)

      if (node.opaqueReturn) {
        // EVM-parity `(bool success, bytes data) = addr.call(payload)`: the whole return-event commitment is
        // `data` (opaque, no typed decode); `success` is always true (integrity failures fail the spend).
        this.emit(Op.OP_1, locationData);    // [data, true]
        this.emit(Op.OP_SWAP, locationData); // [true, data]
        this.pushToStack('(success)');
        this.pushToStack('(returnData)');
      } else {
        // Decode return values from blob
        for (let i = 0; i < returnTypes.length; i++) {
          const isLast = i === returnTypes.length - 1;
          if (isLast) {
            this.emitPushdataDecodeLastField(returnTypes[i], locationData);
          } else {
            this.emitPushdataDecode(returnTypes[i], locationData);
            // After decode, stack has: [decoded_value, remaining_blob]
            // Swap so remaining_blob is on top for next iteration
            this.emit(Op.OP_SWAP, locationData);
          }
          this.pushToStack('(value)');
        }
      }
    }

    return node;
  }

  visitExternalOutputState(_node: ExternalOutputStateNode): Node {
    // ExternalOutputStateNode is an intermediate marker; it should only
    // appear inside ExternalOutputStateAccessNode. If we reach here, it's a bug.
    throw new Error('ExternalOutputStateNode should not be visited directly');
  }

  visitExternalOutputStateAccess(node: ExternalOutputStateAccessNode): Node {
    const info = node.accessInfo!;
    const locationData = { location: node.location, positionHint: PositionHint.START };

    // Find the outState slot for this access to check sharing
    const osSlot = this.externalOutStateSlots.find(
      (s) => s.slotIndex === info.externalOutStateSlotIndex,
    );

    if (osSlot?.sharedWithCallSlotIndex !== undefined) {
      // Shared with an external call slot - read the callee's data NFT at (callee master + 1 + nftIndex).
      const callSlot = this.externalCallSlots.find(
        (cs) => cs.slotIndex === osSlot.sharedWithCallSlotIndex,
      )!;
      const idxStack = this.getStackIndex(`__internal__extcallMasterIdx${callSlot.slotIndex}`, true);
      if (idxStack >= 0) {
        // Multi-call function: use the SDK-filled runtime callee master index (offset-shift robust).
        this.emit(encodeInt(BigInt(idxStack)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.emit(encodeInt(BigInt(1 + info.nftIndex)), locationData);
        this.emit(Op.OP_ADD, locationData);
      } else {
        const ecBase = this.getExternalCallBaseOffset();
        this.emitMasterInputIndex(locationData);
        this.emit(encodeInt(BigInt(ecBase + callSlot.computedOffset + 1 + info.nftIndex)), locationData);
        this.emit(Op.OP_ADD, locationData);
      }
    } else {
      // Not shared - use runtime _externalOutStateInputBase param (direction unknown at compile time)
      let slotOffset = 0;
      for (const s of this.externalOutStateSlots) {
        if (s.sharedWithCallSlotIndex !== undefined) continue;
        if (s.slotIndex === osSlot!.slotIndex) break;
        slotOffset += 1 + s.requiredDataNftIndices.length;
      }
      const positionalIndex = osSlot!.requiredDataNftIndices.indexOf(info.nftIndex);
      const stackIdx = this.getStackIndex('__internal__externalOutStateInputBase');
      this.emit(encodeInt(BigInt(stackIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.emit(encodeInt(BigInt(slotOffset + 1 + positionalIndex)), locationData);
      this.emit(Op.OP_ADD, locationData);
    }

    // 2. Read OUTPUT commitment (post-execution state)
    this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);

    // 2b. Verify the nftIndex tag (multi-data-NFT callee) - rejects a substituted sibling NFT.
    if (info.calleeMultiNft) this.emitNftIndexTagVerify(info.nftIndex, locationData);

    // 3. Skip preceding fields
    const fieldsInNft = info.fieldsInNft;
    for (let i = 0; i < info.fieldIndex; i++) {
      this.emitPushdataSkip(fieldsInNft[i].type, locationData);
    }

    // 4. Decode target field
    const isLast = info.fieldIndex === fieldsInNft.length - 1;
    if (isLast) {
      this.emitPushdataDecodeLastField(info.stateVarType, locationData);
    } else {
      this.emitPushdataDecode(info.stateVarType, locationData);
      this.emit(Op.OP_DROP, locationData);
    }

    this.pushToStack('(value)');
    return node;
  }

  visitMethodCall(_node: MethodCallNode): Node {
    // MethodCallNode should have been transformed by semantic analysis.
    // If we reach here, it's a bug.
    throw new Error('MethodCallNode should have been transformed by semantic analysis');
  }

  // ===== Low-Level Call Support =====

  private emitLowLevelCallVerification(
    data: ExpressionNode,
    callIndex: number,
    locationData: SingleLocationData,
  ): void {
    // Visit the data expression FIRST while the tracked stack is in a known
    // state.  Visiting after pushing untracked values (inputIndex, ubcode)
    // would cause getStackIndex to return wrong positions.
    this.visit(data);
    this.popFromStack(); // untrack the data value (stays on real stack)
    // Real stack: [..., data]  (1 untracked)

    // Get call input index (1 untracked push)
    if (this.currentFunction.blockLayout) {
      this.emitBlockSlotIndex('lowLevelCall', callIndex, locationData);
    } else {
      const paramName = this.lowLevelCallCount === 1
        ? '__internal__callInputIndex' : `__internal__callInputIndex${callIndex}`;
      const paramIdx = this.getStackIndex(paramName);
      this.emit(encodeInt(BigInt(paramIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
    }
    // Real stack: [..., data, inputIdx]

    // Read target's unlocking bytecode
    this.emit(Op.OP_INPUTBYTECODE, locationData);
    // Real stack: [..., data, ubcode]

    // Verify the target's unlocking bytecode contains the payload as its
    // first pushed data value. For P2SH32 targets, the unlocking bytecode
    // is <push_len><selector><push_len><arg1>...<push_len><redeemScript>.
    // Skip the first byte (push opcode / length prefix), then compare the
    // next data_len bytes against the expected payload.
    //
    // Stack: [data, ubcode]
    this.emit(encodeInt(1n), locationData);      // [data, ubcode, 1]
    this.emit(Op.OP_SPLIT, locationData);       // [data, push_byte, ubcode_rest]
    this.emit(Op.OP_NIP, locationData);         // [data, ubcode_rest]
    this.emit(Op.OP_OVER, locationData);        // [data, ubcode_rest, data]
    this.emit(Op.OP_SIZE, locationData);        // [data, ubcode_rest, data, data_len]
    this.emit(Op.OP_NIP, locationData);         // [data, ubcode_rest, data_len]
    this.emit(Op.OP_SPLIT, locationData);       // [data, payload_bytes, remaining]
    this.emit(Op.OP_ROT, locationData);         // [payload_bytes, remaining, data]
    this.emit(Op.OP_ROT, locationData);         // [remaining, data, payload_bytes]
    this.emit(Op.OP_EQUALVERIFY, locationData); // [remaining]
  }

  visitLowLevelCall(node: LowLevelCallNode): Node {
    const locationData: SingleLocationData = { location: node.location, positionHint: PositionHint.START };

    // Handle {value: X} call option
    if (node.callOptions?.value && node.valueTransferIndex >= 0) {
      const addrParam = this.getAddressParamFromTarget(node.targetExpression);
      if (addrParam) {
        node.callOptions.value = this.emitValueTransfer(
          node.valueTransferIndex, node.callOptions.value, addrParam, locationData, node,
        );
      }
    }

    if (node.callMode === 'delegatecall') {
      // Delegatecall: proxy doesn't verify delegate's calldata - the delegate handles
      // its own verification via _proxyMasterIndex. Push dummy success/returnData.
      this.emit(Op.OP_1, locationData);           // [true]
      this.emit(encodeInt(0n), locationData);      // [true, empty]
    } else {
      this.emitLowLevelCallVerification(node.data, node.callIndex, locationData);
      // Stack: [remaining]
      this.emit(Op.OP_1, locationData);           // [remaining, true]
      this.emit(Op.OP_SWAP, locationData);        // [true, remaining]
    }
    this.pushToStack('(success)');
    this.pushToStack('(returnData)');
    return node;
  }

  visitLowLevelCallStatement(node: LowLevelCallStatementNode): Node {
    const locationData: SingleLocationData = { location: node.location, positionHint: PositionHint.START };

    // Handle {value: X} call option
    if (node.callOptions?.value && node.valueTransferIndex >= 0) {
      const addrParam = this.getAddressParamFromTarget(node.targetExpression);
      if (addrParam) {
        node.callOptions.value = this.emitValueTransfer(
          node.valueTransferIndex, node.callOptions.value, addrParam, locationData, node,
        );
      }
    }

    if (node.callMode === 'delegatecall') {
      // C1/piece-3: FORCE + PIN the delegate co-spend. The input at __internal__delegateInputIndex must have
      // locking bytecode == impl (the delegatecall target), so a real delegate is required, not optional - the
      // delegate then authorizes the proxy's state via _proxyMasterIndex. Emitted only when impl is a covenant
      // (pinsDelegateCoSpend); a P2PKH-placeholder target keeps the C1 warning path.
      if (this.currentFunction.pinsDelegateCoSpend) {
        // (a) IDENTITY: the delegate at delegateInputIndex is the contract at impl.
        this.visit(node.targetExpression);           // [impl]
        const idx = this.getStackIndex('__internal__delegateInputIndex');
        this.emit(encodeInt(BigInt(idx)), locationData);
        this.emit(Op.OP_PICK, locationData);         // [impl, delegateIdx]
        this.emit(Op.OP_UTXOBYTECODE, locationData); // [impl, delegate_utxobc]
        this.emit(Op.OP_EQUALVERIFY, locationData);  // []
        this.popFromStack();                         // untrack impl

        // (b) SELECTOR: the delegate's unlocking bytecode leads with the forwarded calldata (`input`), so a
        // co-spent-but-wrong delegate FUNCTION can't slip past the identity pin. Mirrors emitLowLevelCall-
        // Verification: skip the push-opcode byte, then compare the next |input| bytes against `input`.
        this.visit(node.data);                       // [input]
        const idx2 = this.getStackIndex('__internal__delegateInputIndex');
        this.emit(encodeInt(BigInt(idx2)), locationData);
        this.emit(Op.OP_PICK, locationData);         // [input, delegateIdx]
        this.emit(Op.OP_INPUTBYTECODE, locationData); // [input, ubcode]
        this.emit(encodeInt(1n), locationData);
        this.emit(Op.OP_SPLIT, locationData);        // [input, pushbyte, ubcode_rest]
        this.emit(Op.OP_NIP, locationData);          // [input, ubcode_rest]
        this.emit(Op.OP_OVER, locationData);         // [input, ubcode_rest, input]
        this.emit(Op.OP_SIZE, locationData);         // [input, ubcode_rest, input, input_len]
        this.emit(Op.OP_NIP, locationData);          // [input, ubcode_rest, input_len]
        this.emit(Op.OP_SPLIT, locationData);        // [input, payload, remaining]
        this.emit(Op.OP_DROP, locationData);         // [input, payload]
        this.emit(Op.OP_EQUALVERIFY, locationData);  // []
        this.popFromStack();                         // untrack input
      }
    } else {
      this.emitLowLevelCallVerification(node.data, node.callIndex, locationData);
      // Stack: [remaining] - drop it
      this.emit(Op.OP_DROP, locationData);
    }
    return node;
  }

  /** Extract the address parameter name from a low-level call's target expression. */
  private getAddressParamFromTarget(targetExpression: ExpressionNode): string | undefined {
    // Interface-based: IFoo(addr).call() -> targetExpression is FunctionCallNode, param[0] is the address
    if (targetExpression instanceof FunctionCallNode && targetExpression.parameters.length >= 1) {
      const addrExpr = targetExpression.parameters[0];
      if (addrExpr instanceof IdentifierNode) {
        return addrExpr.name;
      }
    }
    // Address-based: addr.call() -> addr is the address handle
    if (targetExpression instanceof IdentifierNode && targetExpression.type instanceof AddressType) {
      return targetExpression.name;
    }
    return undefined;
  }

  // ===== Mapping (Entry NFT) Support =====

  /**
   * The value kind a sorted mapping can store in its entry commitment tail: 'int' (a raw minimal script number,
   * OP_BIN2NUM-normalized) or 'rawbytes' (a fixed-width bytesN, stored/read verbatim). null = unsupported (bool is
   * a set, handled separately; struct/unbounded-bytes fail closed). The tail is the last commitment field, so a
   * fixed-width raw value is unambiguous and the SDK derives it from the VM trace regardless of kind.
   */
  private sortedValueKind(vt: Type): 'int' | 'rawbytes' | null {
    // bool is a 1-bit int: true stored as 0x01, false as empty (both OP_BIN2NUM-normalize to 1/0). Storing it as a
    // value (not membership-by-presence) is what lets `m[k]=false` / `delete m[k]` NULLIFY the slot - Solidity
    // `delete m[k]` == `m[k]=<default>`, an assignment to zero, never a physical removal.
    if (vt.toString() === 'bool') return 'int';
    if (vt === PrimitiveType.BIGINT || vt instanceof IntType) return 'int';
    // An enum is its ordinal integer on the wire (bounded 0..N-1); store + read it as an int value.
    if (vt instanceof EnumType) return 'int';
    if (vt instanceof BytesType && vt.bound !== undefined && vt.bound >= 1 && vt.bound <= 32) return 'rawbytes';
    // Unbounded `bytes` / `string` (P5b): the tail is `len(4 B) ++ [ inline value if <=60 | sha256(value) ]` via
    // emitChunkableValueTail/Read - inline keeps the commitment <= 128 B, the hash bounds it for a value of ANY
    // length (the full value persists in per-slot chunk NFTs, a read verifies the witness against the hash). So a
    // long value no longer fails closed. Still 'rawbytes' here (verbatim-stored kind); isChunkableValue adds the tail.
    if (vt instanceof BytesType && vt.bound === undefined) return 'rawbytes';
    if (vt === PrimitiveType.STRING || vt.toString() === 'string') return 'rawbytes';
    // address is stored verbatim as its locking bytecode in the (last) value tail - variable width is fine there.
    // Default is empty (address(0)); the SDK derives the value from the trace so it need not know the width.
    if (vt instanceof AddressType) return 'rawbytes';
    // A struct is an encoded blob (already the on-stack representation); store it verbatim in the value tail.
    if (vt instanceof StructType) return 'rawbytes';
    // An array (dynamic `T[]` or fixed `T[N]`) is an encoded blob (length prefix + elements); stored verbatim like
    // a struct. Large structs/arrays chunk (isChunkableValue), so the tail never exceeds the 128 B commitment.
    if (vt instanceof ArrayType) return 'rawbytes';
    return null;
  }

  // A C2 mapping value that can exceed the 60 B inline tail: any variable-width blob - unbounded `bytes`/`string`,
  // struct, dynamic array (isChunkableValueType). Stored as len(4B) ++ [ inline value if <=60 B | sha256(value) ];
  // a long value persists in per-slot chunk NFTs and a read verifies a witness against the hash. Fixed-width
  // (int/bool/bytesN) and small-variable (address) values never chunk (always within the 128 B commitment).
  private isChunkableValue(vt: Type): boolean {
    return isChunkableValueType(vt);
  }

  // Value v (top) -> entry tail len(4B LE) ++ [ v if size<=60 | sha256(v) ]. Tracker-neutral.
  private emitChunkableValueTail(loc: SingleLocationData): void {
    this.emit(Op.OP_SIZE, loc); // [v, len]
    this.emit(Op.OP_DUP, loc); this.emit(encodeInt(4n), loc); this.emit(Op.OP_NUM2BIN, loc); // [v, len, len4]
    this.emit(Op.OP_OVER, loc); this.emit(encodeInt(60n), loc); this.emit(Op.OP_GREATERTHAN, loc); // [v, len, len4, long]
    this.emit(Op.OP_IF, loc);
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_SHA256, loc);
    this.emit(Op.OP_ELSE, loc);
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_CAT, loc); this.emit(Op.OP_NIP, loc); this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_DROP, loc); // [tail]
  }

  // Entry tail (top) -> materialized value. Short: inline. Long: caller supplies the value as witness arg
  // __internal__valueWitness_N and the covenant verifies sha256(witness)==stored hash (forged witness fails).
  private emitChunkableValueRead(loc: SingleLocationData, slotIndex: number): void {
    this.emit(encodeInt(4n), loc); this.emit(Op.OP_SPLIT, loc); // [len4, rest]
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_BIN2NUM, loc); // [rest, len]
    this.emit(Op.OP_DUP, loc); this.emit(encodeInt(60n), loc); this.emit(Op.OP_GREATERTHAN, loc); // [rest, len, long]
    this.emit(Op.OP_IF, loc);
    this.emit(Op.OP_DROP, loc); // [hash]
    const w = `__internal__valueWitness_${slotIndex}`;
    this.emit(encodeInt(BigInt(this.getStackIndex(w) + 1)), loc); this.emit(Op.OP_PICK, loc); // +1: hash untracked
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_SHA256, loc);
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_EQUALVERIFY, loc);
    this.emit(Op.OP_NIP, loc); // [witness]
    this.emit(Op.OP_ELSE, loc);
    this.emit(Op.OP_DROP, loc); // short: [value]
    this.emit(Op.OP_ENDIF, loc);
  }

  /**
   * The C2 non-membership bracket: given stack [.., slot32, nextKey32] (nextKey on top) and the key hash Hk32 at
   * depth 2 (below slot32), verify slot < H(k) < nextKey (nextKey 0 = +infinity). Leaves the stack unchanged. This
   * is the proven absent-witness fragment (SortedMappingRead.test.ts) shared by the bool and value-typed reads.
   */
  private emitSortedAbsenceBracket(loc: SingleLocationData): void {
    this.emit(Op.OP_OVER, loc); this.emit(Op.OP_BIN2NUM, loc);
    this.emit(encodeInt(3n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc);
    this.emit(Op.OP_LESSTHAN, loc); this.emit(Op.OP_VERIFY, loc);           // slot < H(k)
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_BIN2NUM, loc); this.emit(Op.OP_DUP, loc);
    this.emit(Op.OP_0, loc); this.emit(Op.OP_NUMEQUAL, loc);
    this.emit(Op.OP_IF, loc); this.emit(Op.OP_DROP, loc);                   // +inf ok
    this.emit(Op.OP_ELSE, loc);
    this.emit(encodeInt(3n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc);
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_LESSTHAN, loc); this.emit(Op.OP_VERIFY, loc); // H(k) < nextKey
    this.emit(Op.OP_ENDIF, loc);
  }

  /**
   * Push the sorted-mapping slot Hk32 for the access `node` onto the stack (top). Single key: slot = sha256(key)
   * high-bit-masked. Composite (nested `m[a][b]...`): slot = sha256(sha256(k0)++sha256(k1)++...) masked - each key
   * is hashed independently to 32 bytes so the concatenation is unambiguous for ANY key type (int/address/bytesN),
   * mirroring the SDK's keyToSlotMulti. Matches SortedList.keyToSlot for the 1-key case. Multi-key requires plain
   * param keys (an expression key would need the untracked accumulator offset the visit can't see) - else fail closed.
   */
  private emitSortedKeyHash(
    node: MappingAccessNode | MappingAssignNode | MappingDeleteNode, slotIndex: number, loc: SingleLocationData,
  ): void {
    const numKeys = node.keys.length;
    // Accumulate H(k0)++H(k1)++... on the stack. The running accumulator is kept TRACKED as '(__skh_acc)' during
    // the loop so a PARAM key's OP_PICK offset AND an EXPRESSION key's visit (which uses getStackIndex) both count
    // past it correctly - that is what lets a nested `m[a][b]` use a computed/expression key (msg.sender, xs[i]),
    // not just bare params. The final masked hash is left UNTRACKED (the callers account for it manually / push it).
    for (let i = 0; i < numKeys; i++) {
      const keySource = this.entrySlots[slotIndex].keySources?.[i];
      if (!keySource || keySource.kind === 'param') {
        const keyParamName = keySource?.paramName ?? this.entrySlots[slotIndex].keyParams[i];
        // The accumulator is a TRACKED item for i>0, so getStackIndex already counts it - no manual +1.
        this.emit(encodeInt(BigInt(this.getStackIndex(keyParamName))), loc);
        this.emit(Op.OP_PICK, loc);
        this.pushToStack('(__skh_acc)');       // track the picked key copy (becomes / merges into the accumulator)
      } else {
        node.keys[i] = this.visit(node.keys[i]); // pushes + tracks the key value on top
      }
      this.emit(Op.OP_SHA256, loc);            // H(key_i) - the top tracked item is now H(key_i)
      if (i > 0) {
        this.emit(Op.OP_CAT, loc);             // acc(below) ++ H(key_i)(top) -> the new accumulator on top
        this.popFromStack();                   // CAT is 2->1: drop H(key_i)'s tracking; the accumulator below remains
      }
    }
    // Exactly one tracked item on top = the concatenated per-key hashes (H(k0) for a single key). Untrack it so the
    // manual composite-hash + mask below (and the caller) treat it as an untracked stack value.
    this.popFromStack();
    if (numKeys > 1) this.emit(Op.OP_SHA256, loc); // composite hash of the per-key hashes (== SDK keyToSlotMulti)
    // mask the 32-byte hash to a positive 255-bit slot (clear the last byte's high bit)
    this.emit(encodeInt(31n), loc); this.emit(Op.OP_SPLIT, loc);
    this.emit(new Uint8Array([0x7f]), loc); this.emit(Op.OP_AND, loc); this.emit(Op.OP_CAT, loc);
  }

  /**
   * Sorted-set (C2 linked-list) mapping read `m[k]`. Co-spends ONE entry at the entry block-layout slot - the SDK
   * provides the exact entry if k is present, else the bracketing predecessor. Pins the co-spent input's bytecode
   * to the collection's entry P2SH (a real entry of this collection), reads its commitment slot(32)||nextKey(32)
   * [||value], computes slot = sha256(k) with the last byte's high bit cleared, and returns: for a set
   * (mapping(K=>bool)) the real membership bit; for a value mapping (mapping(K=>int)) the value tail if present or
   * the type default if absent. Absence is proven by the bracket slot < H(k) < nextKey (nextKey 0 = +inf); there is
   * no default-on-absent branch, so omitting the entry (input bytecode won't match) reverts - closes C2.
   */
  private emitSortedSetRead(node: MappingAccessNode): Node {
    const loc = { location: node.location, positionHint: PositionHint.START };
    const collection = node.collection!;
    const valueType = collection.innermostValueType;
    const valueKind = this.sortedValueKind(valueType);
    if (valueKind === null) {
      throw new SortedMappingCodegenPendingError(node, collection.name);
    }
    const slotIndex = node.entrySlotIndex;
    // No entry slot assigned to this access (e.g. a read whose block-layout slot was never allocated) - fail closed
    // with the clean pending diagnostic rather than crashing on an undefined entrySlot.
    if (slotIndex < 0 || !this.entrySlots[slotIndex]) {
      throw new SortedMappingCodegenPendingError(node, collection.name);
    }
    const collectionHash = computeCollectionHash(this.entrySlots[slotIndex].collectionSignature);

    // 1. H(k) (composite for nested m[a][b]) computed FIRST so it sits at the bottom of the working area, giving
    // the proven [Hk32, slot32, nextKey32] layout.
    this.emitSortedKeyHash(node, slotIndex, loc);     // [Hk32]

    // 2. Entry address = base(master category) wrapped in the collection's entry covenant. Track the categoryId so
    // emitP2sh32FromCovenant's popFromStack consumes IT (not a real tracked var), then untrack the address.
    this.emitMasterInputIndex(loc);
    this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_DROP, loc); // [Hk32, categoryId]
    this.pushToStack('(sortedaddr)');
    this.emitP2sh32FromCovenant((cat) => buildEntryNftCovenantScript(cat, collectionHash), loc); // [Hk32, entryAddr]
    this.popFromStack();

    // 3. input[slot] bytecode == entryAddr (a real entry of this collection; omission -> mismatch -> revert),
    // then read its commitment -> slot32, nextKey32.
    this.emitEntryInputIndex(slotIndex, loc, 1);      // [Hk32, entryAddr, idx]
    this.emit(Op.OP_DUP, loc);                        // [Hk32, entryAddr, idx, idx]
    this.emit(Op.OP_UTXOBYTECODE, loc);               // [Hk32, entryAddr, idx, inbc]
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc); // [Hk32, entryAddr, idx, inbc, entryAddr]
    this.emit(Op.OP_EQUALVERIFY, loc);                // [Hk32, entryAddr, idx]
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_DROP, loc); // [Hk32, idx]  (drop entryAddr)
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, loc);        // [Hk32, commit]
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc);                       // [Hk32, slot32, rest]
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc);                       // [Hk32, slot32, nextKey32, value]

    // 4. value read: present (slot32 == Hk32) -> the value tail (bool/int BIN2NUM-normalized, bytesN verbatim);
    // absent (bracket proven) -> the type default. A bool set is just a mapping(K=>int-bit) here: true=0x01 present,
    // false = an entry whose value tail is empty, absent = default false. stack: [Hk32, slot32, nextKey32, value]
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc);   // copy slot32 (depth2)
    this.emit(encodeInt(4n), loc); this.emit(Op.OP_PICK, loc);   // copy Hk32 (depth4)
    this.emit(Op.OP_EQUAL, loc);                                 // [Hk32, slot32, nextKey32, value, isPresent]
    this.emit(Op.OP_IF, loc);
    this.emit(Op.OP_NIP, loc); this.emit(Op.OP_NIP, loc); this.emit(Op.OP_NIP, loc); // -> [value | tail]
    if (valueKind === 'int') this.emit(Op.OP_BIN2NUM, loc);     // normalize the int/bool tail (bytesN kept verbatim)
    else if (this.isChunkableValue(valueType)) this.emitChunkableValueRead(loc, slotIndex);
    this.emit(Op.OP_ELSE, loc);
    this.emit(Op.OP_DROP, loc);                                 // drop value -> [Hk32, slot32, nextKey32]
    this.emitSortedAbsenceBracket(loc);                         // verifies slot < H(k) < nextKey
    this.emit(Op.OP_2DROP, loc); this.emit(Op.OP_DROP, loc);    // -> []
    this.emitDefaultValue(loc, valueType);                      // absent -> default
    this.emit(Op.OP_ENDIF, loc);

    this.pushToStack('(value)');
    return node;
  }

  visitMappingAccess(node: MappingAccessNode): Node {
    // Handle token container access: this.tokens[category]
    // Don't generate code here - the FieldAccess or TokenContainerMethodStatement visitor will handle it
    if (node.isTokenContainerAccess) {
      // Visit key expression to push category bytes to stack
      node.keys[0] = this.visit(node.keys[0]);
      // The key is already on the stack as the parameter name - no extra work needed
      return node;
    }

    // A sorted (C2 linked-list) mapping read `m[k]`: co-spend one entry (exact if present, else the predecessor)
    // and return the real value (set -> membership bit; value mapping -> the value tail if present, else the type
    // default proven-absent via the bracket). No default-on-absent branch -> the omission attack is closed.
    if (node.collection?.sorted) {
      // Whole value read, or (for a chunkable array value) element read: materialize the array via the C2 read,
      // then extract element [i]. emitSortedSetRead already co-spends the proving entry and reassembles chunks.
      this.emitSortedSetRead(node);
      if (node.arrayIndex) {
        this.emitArrayElementExtract(node, { location: node.location, positionHint: PositionHint.START });
      }
      return node;
    }

    // Handle packed state array element access: this.arr[index]
    if (node.isPackedStateArrayAccess && node.packedStateVariable) {
      return this.emitPackedStateArrayAccess(node);
    }

    // Genesis read: a mapping read in the constructor. The mapping is empty at genesis (no input entry NFTs),
    // so resolve to the type default with no input read and no entry slot (excluded from entryAccesses).
    if (node.isGenesisRead) {
      const gLoc = { location: node.location, positionHint: PositionHint.START };
      this.emitDefaultValue(gLoc, node.collection!.innermostValueType);
      this.pushToStack('(value)');
      return node;
    }

    const slotIndex = node.entrySlotIndex;
    const collection = node.collection!;
    const locationData = { location: node.location, positionHint: PositionHint.START };
    const allKeyTypes = collection.allKeyTypes;

    // Read-after-write: a prior straight-line write to this exact slot (same mapping + key descriptor, so the
    // slotIndex uniquely identifies the runtime key) is already pending, so the on-chain input commitment is
    // STALE. Decode the pending (encoded) write value instead, so a later read in the same function sees the
    // update (`m[k]=m[k]+1; m[k]=m[k]+1` -> +2, not a stale +1). Restricted to a scalar whole-value read of a
    // NON-pre-allocated write: pre-allocated (conditional / loop / delete) slots hold placeholder-encoded
    // values with different semantics, and an array-element read (node.arrayIndex) needs the array machinery.
    const pendingWrite = this.pendingEntryWrites.get(slotIndex);
    if (pendingWrite && !node.arrayIndex && !this.preAllocatedEntryWrites.has(slotIndex)) {
      this.emit(encodeInt(BigInt(this.getStackIndex(pendingWrite.valueStackName))), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.emitPushdataDecodeLastField(collection.innermostValueType, locationData);
      this.pushToStack('(value)');
      return node;
    }

    // 1. Check if entry exists via introspection
    this.emitSlotExistsCheck('entry', slotIndex, locationData);

    // 2. OP_IF (entry exists) -- increment scopeDepth so visitIdentifier uses
    // OP_PICK instead of OP_ROLL for last-reference variables. This prevents
    // stack depth mismatches between the IF and ELSE branches.
    this.scopeDepth += 1;
    this.emit(Op.OP_IF, locationData);

    // 3. Compute entry input index and read commitment
    this.emitEntryInputIndex(slotIndex, locationData, 0);
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);

    // 4. Decode each key from commitment and verify it matches the expected parameter
    // Track untracked values: starts at 1 (the commitment blob)
    let untrackedCount = 1;
    for (let i = 0; i < allKeyTypes.length; i++) {
      // After emitPushdataDecode: stack has [..., decoded_key, remainder] (remainder on top)
      this.emitPushdataDecode(allKeyTypes[i], locationData);
      this.emit(Op.OP_SWAP, locationData);
      // Now: [..., remainder, decoded_key] (decoded_key on top)
      // untracked count is now +1 (remainder + decoded_key, we consumed blob but added 2)

      // Pick or compute expected key value
      const keySource = this.entrySlots[slotIndex].keySources?.[i];
      if (!keySource || keySource.kind === 'param') {
        // Existing path: pick parameter from tracked stack
        const keyParamName = keySource?.paramName ?? this.entrySlots[slotIndex].keyParams[i];
        const keyParamIdx = this.getStackIndex(keyParamName);
        // +untrackedCount for the untracked values on the real stack (+1 for the decoded_key itself)
        this.emit(encodeInt(BigInt(keyParamIdx + untrackedCount + 1)), locationData);
        this.emit(Op.OP_PICK, locationData);
      } else if (keySource.kind === 'state') {
        // State key: evaluate via visit (reads from UTXO introspection, no stack consumption)
        for (let u = 0; u < untrackedCount + 1; u++) {
          this.pushToStack(`__untracked_${u}`);
        }
        node.keys[i] = this.visit(node.keys[i]);
        for (let u = 0; u < untrackedCount + 1; u++) {
          this.removeFromStack(this.getStackIndex(`__untracked_${u}`));
        }
        this.popFromStack();
      } else {
        // Expression key (local var, state access, literal, computed): evaluate via visit.
        // scopeDepth > 0 ensures visitIdentifier uses OP_PICK (not OP_ROLL) for
        // last-reference variables, maintaining consistent stack depth with the ELSE branch.
        for (let u = 0; u < untrackedCount + 1; u++) {
          this.pushToStack(`__untracked_${u}`);
        }
        node.keys[i] = this.visit(node.keys[i]);
        for (let u = 0; u < untrackedCount + 1; u++) {
          this.removeFromStack(this.getStackIndex(`__untracked_${u}`));
        }
        this.popFromStack(); // visit pushed result as tracked -- make it untracked
      }
      // Stack: [..., remainder, decoded_key, expected_key]
      this.emit(Op.OP_EQUALVERIFY, locationData);
      // Stack: [..., remainder]
      // untrackedCount stays at 1 (just the remainder on top)
    }

    // 5. Decode value from remainder (last field)
    this.emitPushdataDecodeLastField(collection.innermostValueType, locationData);
    // Stack: [..., decoded_value] - 1 extra untracked value

    // 6. OP_ELSE (entry doesn't exist -- push default)
    this.emit(Op.OP_ELSE, locationData);
    this.emitDefaultValue(locationData, collection.innermostValueType);
    // Stack: [..., default_value] -- 1 extra untracked value

    // 7. OP_ENDIF -- both branches leave exactly 1 extra value
    this.scopeDepth -= 1;
    this.emit(Op.OP_ENDIF, locationData);

    this.pushToStack('(value)');

    // 8. If arrayIndex is set, perform array element access on the array blob
    if (node.arrayIndex) {
      this.emitArrayElementExtract(node, locationData);
    }

    return node;
  }

  /**
   * Extract element [arrayIndex] from an array blob already tracked as '(value)' on top of the stack (length prefix
   * ++ packed/pushdata elements). Consumes the blob, leaves the decoded element tracked as '(value)'. Shared by the
   * default entry-model read and the sorted C2 read (which materializes the whole array via emitSortedSetRead first).
   */
  private emitArrayElementExtract(node: MappingAccessNode, loc: SingleLocationData): void {
    const arrType = node.collection!.innermostValueType as ArrayType;
    const elemType = arrType.elementType;
    const fixedWidth = isFixedWidthType(elemType);

    // Decode length prefix: [blob] -> [length, elements_blob]
    this.emitPushdataDecode(PrimitiveType.BIGINT, loc);
    this.emit(Op.OP_SWAP, loc);
    this.popFromStack();
    this.pushToStack('(elements)');
    this.pushToStack('(length)');

    // Visit index
    node.arrayIndex = this.visit(node.arrayIndex!);

    // Bounds check
    this.emit(Op.OP_SWAP, loc);
    this.emitBoundsCheck(loc);
    this.popFromStack(2);
    this.pushToStack('(index)');

    if (fixedWidth) {
      const width = getFixedWidth(elemType);
      this.emit(encodeInt(BigInt(width)), loc);
      this.emit(Op.OP_MUL, loc);
      this.emit(Op.OP_SPLIT, loc);
      this.emit(Op.OP_NIP, loc);
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emit(encodeInt(BigInt(width)), loc);
      this.emit(Op.OP_SPLIT, loc);
      this.emit(Op.OP_DROP, loc);
      this.emitDecodeElementPacked(elemType, loc);
    } else {
      this.popFromStack(2);
      this.pushToStack('(elements)');
      this.pushToStack('(count)');
      this.emitScanLoop(elemType, loc);
      this.popFromStack(2);
      this.pushToStack('(remaining)');
      this.emitPushdataDecode(elemType, loc);
      this.emit(Op.OP_SWAP, loc);
      this.emit(Op.OP_NIP, loc);
      this.popFromStack();
      this.pushToStack('(value)');
    }
  }

  /**
   * Verify a sorted entry NFT output at the (untracked, top-of-stack) output index outIdx: bytecode == the entry
   * P2SH entryAddr (untracked, at tracker-relative depth addrDepth below the working area), category base == master
   * with mutable (0x01) capability, and commitment == field1||field2||field3 - a value entry commitment
   * slot(32)||nextKey(32)||value (field3 may be an empty value tail). Depths measured with outIdx on top. Consumes
   * outIdx; leaves the working area unchanged.
   */
  private emitVerifySortedValueOutput(
    loc: SingleLocationData, addrDepth: number, f1Depth: number, f2Depth: number, f3Depth: number,
  ): void {
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_OUTPUTBYTECODE, loc);      // [.., outIdx, outbc]
    this.emit(encodeInt(BigInt(addrDepth + 1)), loc); this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_EQUALVERIFY, loc);                                    // bytecode == entryAddr
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_OUTPUTTOKENCATEGORY, loc); // [.., outIdx, cat]
    this.emit(Op.OP_DUP, loc); this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_NIP, loc);
    this.emit(Op.OP_1, loc); this.emit(Op.OP_EQUALVERIFY, loc);           // capability mutable
    this.emitVerifyCatBaseEqMaster(loc);                                  // base == master -> [.., outIdx]
    this.emit(encodeInt(BigInt(f1Depth)), loc); this.emit(Op.OP_PICK, loc);      // f1 (baseline)
    this.emit(encodeInt(BigInt(f2Depth + 1)), loc); this.emit(Op.OP_PICK, loc);  // f2 (+1: f1 copy)
    this.emit(Op.OP_CAT, loc);                                           // f1||f2
    this.emit(encodeInt(BigInt(f3Depth + 1)), loc); this.emit(Op.OP_PICK, loc);  // f3 (+1: f1||f2 blob)
    this.emit(Op.OP_CAT, loc);                                           // f1||f2||f3
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, loc); this.emit(Op.OP_EQUALVERIFY, loc);
  }

  /**
   * Sorted (C2) value mapping WRITE `m[k] = v` for `mapping(K => int)` - an UPSERT. Co-spends ONE entry at the
   * entry slot: the exact k-entry if present (SDK planUpdate), else the bracketing predecessor (planInsert). The
   * covenant reads its commitment slot(32)||nextKey(32)||value and branches on slot == H(k):
   *   present -> UPDATE: pin the entry output = slot||nextKey||v (link preserved, value set to the RHS).
   *   absent  -> INSERT: verify slot < H(k) < nextKey; pin P' = slot||H(k)||predValue at the entry output and
   *              NEW = H(k)||nextKey||v at the trailing mint output[blockSize].
   * Both fragments are proven (SortedMappingInsertDelete.test.ts: insert splice + value update). The value tail is
   * stored raw (minimal script number); the SDK encodes it identically via bigIntToVmNumber. `emitValue` pushes the
   * (tracked) new value onto the stack - the RHS for `m[k]=v`, or the type default for `delete m[k]`.
   */
  // Design D: pin the value chunks for a LONG (>60 B) sorted-mapping value. The full value `v` is tracked on top
  // of the stack; the slot H(k) is tracked as '(__upsert_hk)'. When size(v) > 60, verify the tx creates exactly
  // ceil(size/VC) value-chunk NFT outputs - the trailing chunk region at masterInput+blockSize+isInsert (after an
  // INSERT's NEW node) - each at the collection's compile-time value-chunk P2SH with commitment slot(32) ++
  // digest(32) ++ pushdata(i) ++ pushdata(v[i*VC:]). digest = sha256(v). A read reassembles the authentic value;
  // a forged/absent/misplaced chunk fails this OP_EQUALVERIFY at write time. Stack-neutral: v is left untouched on
  // top for emitChunkableValueTail. VC=56 leaves room for slot+digest in the 128 B commitment.
  private emitSortedValueChunkPin(collectionName: string, slotIndex: number, node: Node, loc: SingleLocationData): void {
    const VC = 56; // VALUE_CHUNK_SIZE (utils/state.ts)
    const chunkHash = computeCollectionHash(valueChunkSignature(collectionName));
    const vName = this.stack[0]; // v, tracked on top

    // Guard: only chunk when size(v) > 60 (inline values <= 60 need no chunks; matches emitChunkableValueTail).
    this.emit(encodeInt(BigInt(this.getStackIndex(vName))), loc);
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_SIZE, loc); this.emit(Op.OP_NIP, loc); // size(v)
    this.emit(encodeInt(60n), loc);
    this.emit(Op.OP_GREATERTHAN, loc);
    this.emit(Op.OP_IF, loc);
    this.scopeDepth += 1;
    const outerDepth = this.stack.length;

    // isInsert = (co-spent entry's slot != H(k)): a present-key UPDATE has no NEW node (chunks at masterInput+
    // blockSize); an absent-key INSERT mints NEW at masterInput+blockSize, so the chunks sit one output later.
    this.emitEntryInputIndex(slotIndex, loc, 0);
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_DROP, loc); // coSlot
    this.pushToStack('(vc_isinsert)');
    this.emit(encodeInt(BigInt(this.getStackIndex('(__upsert_hk)'))), loc); this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_EQUAL, loc); this.emit(Op.OP_NOT, loc); // 1 if coSlot != Hk (insert)
    this.stack[0] = '(vc_isinsert)';

    // --- loop-invariant temps: digest = sha256(v), slot = Hk32, chunk address, nNew, base ---
    this.emit(encodeInt(BigInt(this.getStackIndex(vName))), loc);
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_SHA256, loc);
    this.pushToStack('(vc_digest)');

    this.emit(encodeInt(BigInt(this.getStackIndex('(__upsert_hk)'))), loc);
    this.emit(Op.OP_PICK, loc);
    this.pushToStack('(vc_slot)');

    this.emitMasterInputIndex(loc);
    this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_DROP, loc);
    this.pushToStack('(vc_chunkaddr)');
    this.emitP2sh32FromCovenant((cat) => buildEntryNftCovenantScript(cat, chunkHash), loc);
    this.stack[0] = '(vc_chunkaddr)'; // the helper renamed the top to '(value)'

    this.emit(encodeInt(BigInt(this.getStackIndex(vName))), loc);
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_SIZE, loc); this.emit(Op.OP_NIP, loc);
    this.emit(encodeInt(BigInt(VC - 1)), loc); this.emit(Op.OP_ADD, loc);
    this.emit(encodeInt(BigInt(VC)), loc); this.emit(Op.OP_DIV, loc); // nNew = ceil(size/VC)
    this.pushToStack('(vc_nnew)');

    // base = masterInput + blockSize (layout-relative, so a trailing fee-change output does not shift it - unlike
    // TXOUTPUTCOUNT-nNew). Adjust down 1 when the reserved returnEvent slot is not materialized (a plain send),
    // then +isInsert (the INSERT's NEW node precedes the chunks). Matches emitDynamicWriteVerification's family.
    const blockSize = this.currentFunction.blockLayout?.blockSize ?? 1;
    const hasReturnEventSlot = this.currentFunction.blockLayout?.slots.some((s) => s.kind === 'returnEvent') ?? false;
    this.emitMasterInputIndex(loc);
    this.emit(encodeInt(BigInt(blockSize)), loc);
    this.emit(Op.OP_ADD, loc);
    if (hasReturnEventSlot) {
      const roiIdx = this.getStackIndex('__internal__returnOutputIdx', true);
      if (roiIdx >= 0) {
        this.emit(encodeInt(BigInt(roiIdx + 1)), loc); this.emit(Op.OP_PICK, loc); // +1: base on top
        this.emit(encodeInt(0n), loc); this.emit(Op.OP_LESSTHAN, loc);
        this.emit(Op.OP_SUB, loc); // base -= (returnOutputIdx < 0 ? 1 : 0)
      }
    }
    this.emit(encodeInt(BigInt(this.getStackIndex('(vc_isinsert)') + 1)), loc); this.emit(Op.OP_PICK, loc); // +1: base on top
    this.emit(Op.OP_ADD, loc); // base += isInsert
    this.pushToStack('(vc_base)');

    this.emit(encodeInt(0n), loc);
    this.pushToStack('(vc_i)');

    // LOOP over i: verify chunk output base+i
    this.emit(Op.OP_BEGIN, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex('(vc_i)'))), loc); this.emit(Op.OP_PICK, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex('(vc_nnew)') + 1)), loc); this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_LESSTHAN, loc);
    this.emit(Op.OP_IF, loc);
    const bodySnapshot = [...this.stack];
    const bodyDepth = this.stack.length;

    // expected = slot(32) ++ digest(32) ++ pushdata(i) ++ pushdata(v[i*VC : i*VC+VC])
    this.emit(encodeInt(BigInt(this.getStackIndex('(vc_slot)'))), loc); this.emit(Op.OP_PICK, loc);
    this.pushToStack('(vc_expected)');
    this.emit(encodeInt(BigInt(this.getStackIndex('(vc_digest)'))), loc); this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_CAT, loc); // slot ++ digest
    this.stack[0] = '(vc_expected)';
    this.emit(encodeInt(BigInt(this.getStackIndex('(vc_i)'))), loc); this.emit(Op.OP_PICK, loc);
    this.pushToStack('(vc_scratch)');
    this.emitPushdataEncode(new IntType(false, 32), loc); // pushdata(i)
    this.stack[0] = '(vc_scratch)';
    this.emit(Op.OP_CAT, loc); this.popFromStack(); // (vc_expected) = slot ++ digest ++ pushdata(i)

    this.emit(encodeInt(BigInt(this.getStackIndex(vName))), loc); this.emit(Op.OP_PICK, loc);
    this.pushToStack('(vc_slice)');
    this.emit(encodeInt(BigInt(this.getStackIndex('(vc_i)'))), loc); this.emit(Op.OP_PICK, loc);
    this.emit(encodeInt(BigInt(VC)), loc); this.emit(Op.OP_MUL, loc); // start = i*VC
    this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_NIP, loc); // value[start:]
    this.emit(Op.OP_SIZE, loc); this.emit(encodeInt(BigInt(VC)), loc); this.emit(Op.OP_MIN, loc);
    this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_DROP, loc); // slice = value[start : start+min(VC, rest)]
    this.emitPushdataEncode(new BytesType(), loc); // pushdata(slice)
    this.stack[0] = '(vc_slice)';
    this.emit(Op.OP_CAT, loc); this.popFromStack(); // (vc_expected) = full expected commitment

    // outIdx = base + i
    this.emit(encodeInt(BigInt(this.getStackIndex('(vc_base)'))), loc); this.emit(Op.OP_PICK, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex('(vc_i)') + 1)), loc); this.emit(Op.OP_PICK, loc); // +1: base on top
    this.emit(Op.OP_ADD, loc);
    this.pushToStack('(vc_outidx)');
    // (a) locking bytecode == chunk address
    this.emit(Op.OP_DUP, loc);
    this.emit(Op.OP_OUTPUTBYTECODE, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex('(vc_chunkaddr)') + 1)), loc); this.emit(Op.OP_PICK, loc); // +1: outbc
    this.emit(Op.OP_EQUALVERIFY, loc);
    // (b) commitment == expected. TIGHT pattern so the SDK trace extractor reads each chunk's expected commitment.
    this.emit(encodeInt(BigInt(this.getStackIndex('(vc_expected)'))), loc); this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_SWAP, loc); // [expected, outIdx]
    this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, loc);
    this.emit(Op.OP_EQUALVERIFY, loc);
    this.popFromStack(); // (vc_outidx)

    // cleanup body temps ((vc_expected)), restore to body snapshot
    this.removeScopedVariables(bodyDepth, node);

    // increment i in place
    this.emit(encodeInt(BigInt(this.getStackIndex('(vc_i)'))), loc); this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_1ADD, loc);
    this.emitReplace(this.getStackIndex('(vc_i)') + 1, node);
    this.popFromStack();

    this.emit(encodeBool(false), loc); this.pushToStack('(vc_loop_continue)');
    this.emit(Op.OP_ELSE, loc);
    this.stack = [...bodySnapshot];
    this.emit(encodeBool(true), loc); this.pushToStack('(vc_loop_exit)');
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_UNTIL, loc);
    this.popFromStack(); // loop result

    // Orphan-bound: exactly nNew outputs carry the chunk address (no extra chunk outputs to confuse a read).
    this.emitVerifyChunkUtxoCount('(vc_nnew)', true, loc, '(vc_chunkaddr)');

    // cleanup loop-invariant temps back to the outer snapshot (top-down keeps indices valid)
    while (this.stack.length > outerDepth) { this.emit(Op.OP_DROP, loc); this.popFromStack(); }
    this.scopeDepth -= 1;
    this.emit(Op.OP_ENDIF, loc);
  }

  private emitSortedValueUpsert(node: MappingAssignNode | MappingDeleteNode, emitValue: () => void): Node {
    const loc = { location: node.location, positionHint: PositionHint.END };
    const collection = node.collection!;
    const slotIndex = node.entrySlotIndex;
    const collectionHash = computeCollectionHash(this.entrySlots[slotIndex].collectionSignature);
    const blockSize = this.currentFunction.blockLayout?.blockSize ?? 1;
    const loopWrites = (this.currentFunction.entryLoopWrites ??= []);
    if (!loopWrites.includes(collection.name)) loopWrites.push(collection.name);
    this.sortedWrittenCollections.add(collection.name);

    // MSG.SENDER MERGE: a preceding merge-capable upsert loop left a re-point register on the stack (the new
    // recipient's slot, 0 if none). This flush (the cached msg.sender DEBIT write) reads it into a tracked temp and,
    // in its UPDATE branch, re-points msg.sender.nextKey to it (leaving coNext when 0). It's at the bottom of this
    // flush's working area, so the flush's own raw offsets are unchanged; dropped at the end.
    const hasRepoint = this.sortedUpsertPendingRepoint;
    if (hasRepoint) {
      this.emit(encodeInt(BigInt(this.getStackIndex(this.sortedUpsertLoopRepointName))), loc); this.emit(Op.OP_PICK, loc);
      this.pushToStack('(__repoint)');
      this.sortedUpsertPendingRepoint = false; // this flush consumes it
    }

    // 1. H(k) FIRST (before the value), so a self-referential RMW `m[k] = m[k] + ...` with a computed/local key k
    // does not lose k: visitIdentifier ROLL-consumes the lexically-LAST use of k (the RHS read inside emitValue,
    // which is emitted first here) - hashing the write key (the lexically-first LHS use, a PICK) up front keeps k
    // alive for it. Hk is stashed as a temp and reordered onto the value below to restore the [v, Hk32] layout.
    this.emitSortedKeyHash(node, slotIndex, loc);
    this.pushToStack('(__upsert_hk)');

    // 2. New value v at the bottom of the working area - kept tracked, consumed at the end. An int is BIN2NUM-
    // normalized to a minimal number (matches SDK bigIntToVmNumber); a bytesN value is CAT'd into the tail verbatim.
    emitValue();
    if (this.sortedValueKind(collection.innermostValueType) === 'int') this.emit(Op.OP_BIN2NUM, loc);
    if (this.isChunkableValue(collection.innermostValueType)) {
      // Design D: pin the value chunks from the on-stack value BEFORE transforming it into the digest tail. This
      // works for ANY value (computed or a direct param) and rejects forged/absent chunks at write time.
      this.emitSortedValueChunkPin(collection.name, slotIndex, node, loc);
      this.emitChunkableValueTail(loc); // len4 ++ [inline|hash]
    }

    // Reorder [Hk_temp, v] -> [v, Hk32] (Hk back on top, untracked, matching the original working-area layout).
    const hkIdx = this.getStackIndex('(__upsert_hk)');
    this.emit(encodeInt(BigInt(hkIdx)), loc); this.emit(Op.OP_ROLL, loc); this.removeFromStack(hkIdx);

    // 3. entry address -> [v, Hk32, entryAddr]
    this.emitMasterInputIndex(loc); this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_DROP, loc);
    this.pushToStack('(sortedaddr)');
    this.emitP2sh32FromCovenant((cat) => buildEntryNftCovenantScript(cat, collectionHash), loc);
    this.popFromStack();

    // 4. co-spent entry input[slot]: bytecode == entryAddr, read [coSlot|coNext|coValue]
    //    -> [v, Hk32, entryAddr, coSlot32, coNext32, coValue]
    this.emitEntryInputIndex(slotIndex, loc, 2);
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_UTXOBYTECODE, loc);
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_EQUALVERIFY, loc);
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc);       // [v, Hk32, entryAddr, coSlot32, coNext32, coValue]

    // 5. branch on coSlot32 == Hk32 (present -> update; absent -> insert)
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc);         // copy coSlot32 (depth2)
    this.emit(encodeInt(5n), loc); this.emit(Op.OP_PICK, loc);         // copy Hk32 (depth4 +1)
    this.emit(Op.OP_EQUAL, loc);                                       // [.., coValue, isPresent]
    this.emit(Op.OP_IF, loc);
    // --- UPDATE: entry output == coSlot32 || effNext || v. effNext = coNext32 (link preserved) UNLESS a merge loop
    // re-points this entry: effNext = (repoint != 0) ? repoint : coNext32. The merge covenant already verified
    // coSlot < repoint < coNext, so this closes the chain msg.sender -> new node (whose NEW node the loop minted). ---
    if (hasRepoint) {
      // [.., coSlot32, coNext32, coValue] -> compute effNext on top
      this.emit(encodeInt(BigInt(this.getStackIndex('(__repoint)') + 5)), loc); this.emit(Op.OP_PICK, loc); // repoint copy
      this.emit(Op.OP_DUP, loc); this.emit(Op.OP_0, loc); this.emit(Op.OP_NUMEQUAL, loc);                  // isZero
      this.emit(Op.OP_IF, loc); this.emit(Op.OP_DROP, loc);
      this.emit(encodeInt(1n), loc); this.emit(Op.OP_PICK, loc);                                           // 0 -> use coNext32
      this.emit(Op.OP_ELSE, loc); this.emit(Op.OP_ENDIF, loc);                                             // else repoint is effNext
      this.emitEntryOutputIndex(slotIndex, loc, 7);                    // [.., coValue, effNext, outIdx]
      this.emitVerifySortedValueOutput(loc, 5, 4, 1, 7);              // addr5, coSlot32 d4, effNext d1, v d7
      this.emit(Op.OP_DROP, loc);                                     // drop effNext -> [.., coValue] (6 raw, matches INSERT)
    } else {
      this.emitEntryOutputIndex(slotIndex, loc, 6);                    // [.., coValue, outIdx]
      this.emitVerifySortedValueOutput(loc, 4, 3, 2, 6);             // addr4, coSlot32 d3, coNext32 d2, v d6
    }
    this.emit(Op.OP_ELSE, loc);
    // --- INSERT: bracket coSlot < H(k) < coNext, then P' + NEW ---
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // coSlot#
    this.emit(encodeInt(5n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // Hk#
    this.emit(Op.OP_LESSTHAN, loc); this.emit(Op.OP_VERIFY, loc);                             // coSlot < H(k)
    this.emit(encodeInt(1n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // coNext#
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_0, loc); this.emit(Op.OP_NUMEQUAL, loc);
    this.emit(Op.OP_IF, loc); this.emit(Op.OP_DROP, loc);                                     // +inf ok
    this.emit(Op.OP_ELSE, loc);
    this.emit(encodeInt(5n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // Hk# (coNext# above)
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_LESSTHAN, loc); this.emit(Op.OP_VERIFY, loc); // H(k) < coNext
    this.emit(Op.OP_ENDIF, loc);                                        // [.., coValue]
    this.emitEntryOutputIndex(slotIndex, loc, 6);                       // P' outIdx -> [.., coValue, poutIdx]
    this.emitVerifySortedValueOutput(loc, 4, 3, 5, 1);                  // P' = coSlot32 d3 || Hk32 d5 || coValue d1
    this.emitMasterInputIndex(loc); this.emit(encodeInt(BigInt(blockSize)), loc); this.emit(Op.OP_ADD, loc); // NEW outIdx
    this.emitVerifySortedValueOutput(loc, 4, 5, 2, 6);                  // NEW = Hk32 d5 || coNext32 d2 || v d6
    this.emit(Op.OP_ENDIF, loc);

    // drop coValue, coNext, coSlot, entryAddr, Hk32 (untracked), then v (tracked)
    this.emit(Op.OP_2DROP, loc); this.emit(Op.OP_2DROP, loc); this.emit(Op.OP_DROP, loc);
    this.emit(Op.OP_DROP, loc); this.popFromStack();
    if (hasRepoint) { this.emit(Op.OP_DROP, loc); this.popFromStack(); } // drop the re-point register temp
    return node;
  }

  visitMappingAssign(node: MappingAssignNode): Node {
    // A C2 (sorted linked-list) mapping write inside a DYNAMIC runtime loop (`for(i<n) m[k[i]]=v`) is a per-iteration
    // sorted INSERT: each iteration co-spends the bracketing predecessor and mints one NEW node (emitSortedInsertLoop
    // Body), the SDK derives the evolving list. Fixed-bound loops are unrolled before codegen and reach here at
    // plainLoopDepth 0. If the insert-loop was set up (value write, single varying key), emit it; else fail closed
    // (array element write / unsupported shape) - never degrade a C2 write to the omittable default-on-absent model.
    if (node.collection?.sorted && this.plainLoopDepth > 0) {
      if (this.sortedInsertLoopActive && this.sortedInsertLoopCollection === node.collection.name
        && !node.arrayIndex && !node.arrayPush && !node.arrayPop
        && this.sortedValueKind(node.collection.innermostValueType) !== null) {
        return this.emitSortedInsertLoopBody(node);
      }
      // Per-iteration UPDATE loop `for(i) m[k[i]] += v[i]` (multitransfer credit): co-spend k[i]'s existing entry.
      if (this.sortedUpsertLoopActive && this.sortedUpsertLoopCollection === node.collection.name
        && !node.arrayIndex && !node.arrayPush && !node.arrayPop) {
        return this.emitSortedUpsertLoopBody(node);
      }
      throw new SortedMappingCodegenPendingError(node, node.collection.name);
    }
    // Sorted (C2 linked-list) mapping write `m[k] = v` (or nested `m[a][b] = v`): never the omittable entry-model
    // write. Always an UPSERT (update the value if the key is present, else insert) - this is how `m[k]=false` /
    // `delete m[k]` NULLIFY a bool set (write the empty/false value tail) rather than physically removing the node,
    // matching Solidity's `delete` == assign-default. No array ops; value must be a supported sorted kind
    // (int/bool/bytesN); composite keys are hashed together (emitSortedKeyHash).
    if (node.collection?.sorted && !node.arrayIndex && !node.arrayPush && !node.arrayPop
      && this.sortedValueKind(node.collection.innermostValueType) !== null) {
      return this.emitSortedValueUpsert(node, () => { node.expression = this.visit(node.expression); });
    }
    if (node.collection?.sorted && (node.arrayIndex || node.arrayPush || node.arrayPop)
      && this.isChunkableValue(node.collection.innermostValueType)) {
      // Sorted C2 array write (`m[k][i]=v` / `m[k].push(v)` / `m[k].pop()`): RMW the whole array value through the
      // chunk-aware upsert, mirroring the struct field-write path. emitMappingArrayElementAssign in sortedRmw mode
      // materializes the current array (Phase 1), applies element/push/pop surgery (Phase 2), and leaves the modified
      // blob for emitSortedValueUpsert to chunk/store (Phase 3). push/pop CHANGE the element count, so the value can
      // flip across the inline<->chunked size boundary; the SDK derives the new chunk set from the trace.
      return this.emitSortedValueUpsert(node, () => { this.emitMappingArrayElementAssign(node, true); });
    }
    if (node.collection?.sorted) {
      throw new SortedMappingCodegenPendingError(node, node.collection.name); // unsupported sorted shape/value type
    }
    if (this.plainLoopDepth > 0 && node.entrySlotIndex >= 0) {
      // A pure-write mapping assign inside a runtime loop (`for(i<n) m[k[i]]=v[i]`) emits a runtime-counter-indexed
      // trailing entry output per iteration instead of the fixed-slot epilogue write. Marked inLoop by the pre-scan.
      if (this.entryLoopActive && this.entrySlots?.[node.entrySlotIndex]?.inLoop
        && !node.arrayIndex && !node.arrayPush && !node.arrayPop) {
        return this.emitLoopEntryWrite(node);
      }
      throw new EntryWriteInLoopError(node, node.collection?.name ?? node.name);
    }
    if (node.arrayIndex || node.arrayPush || node.arrayPop) {
      return this.emitMappingArrayElementAssign(node);
    }

    const slotIndex = node.entrySlotIndex;
    const collection = node.collection!;
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const allKeyTypes = collection.allKeyTypes;

    if (this.preAllocatedEntryWrites.has(slotIndex)) {
      // Pre-allocated path: use emitReplace to update the dummy slots
      const keyStackName = `__entry_key_enc_${slotIndex}`;
      const valueStackName = `__entry_value_enc_${slotIndex}`;

      // 1. Visit each key expression, encode to pushdata, and CAT together
      for (let i = 0; i < node.keys.length; i++) {
        node.keys[i] = this.visit(node.keys[i]);
        this.emitPushdataEncode(allKeyTypes[i], locationData);
        if (i > 0) {
          this.emit(Op.OP_CAT, locationData);
          this.popFromStack(2);
          this.pushToStack('(value)');
        }
      }
      // Replace the pre-allocated key slot
      this.emitReplace(this.getStackIndex(keyStackName), node);
      this.popFromStack();

      // 2. Visit value expression, encode to pushdata
      node.expression = this.visit(node.expression);
      this.emitPushdataEncode(collection.innermostValueType, locationData);
      // Replace the pre-allocated value slot
      this.emitReplace(this.getStackIndex(valueStackName), node);
      this.popFromStack();
    } else {
      // Normal path (outside branches)
      // 1. Visit each key expression, encode to pushdata, and CAT together
      for (let i = 0; i < node.keys.length; i++) {
        node.keys[i] = this.visit(node.keys[i]);
        this.emitPushdataEncode(allKeyTypes[i], locationData);
        if (i > 0) {
          this.emit(Op.OP_CAT, locationData);
          this.popFromStack(2);
          this.pushToStack('(value)');
        }
      }
      this.popFromStack();
      const keyStackName = `__entry_key_enc_${slotIndex}`;
      this.pushToStack(keyStackName);

      // 2. Visit value expression, encode to pushdata
      node.expression = this.visit(node.expression);
      this.emitPushdataEncode(collection.innermostValueType, locationData);
      this.popFromStack();
      const valueStackName = `__entry_value_enc_${slotIndex}`;
      this.pushToStack(valueStackName);

      // 3. Track the write
      this.pendingEntryWrites.set(slotIndex, { keyStackName, valueStackName });
    }

    return node;
  }

  // Whether an expression subtree reads the entry at `slotIndex` (a MappingAccess resolving to that slot).
  // Used to reject a chained entry-element write whose value/index reads the same entry (stale-read).
  private expressionReadsEntrySlot(node: Node | undefined, slotIndex: number): boolean {
    if (!node) return false;
    const seen = new WeakSet<Node>();
    let hit = false;
    const walk = (n: Node): void => {
      if (hit || seen.has(n)) return;
      seen.add(n);
      if (n instanceof MappingAccessNode && n.entrySlotIndex === slotIndex) { hit = true; return; }
      for (const key of Object.keys(n)) {
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) walk(e);
      }
    };
    walk(node);
    return hit;
  }

  /**
   * Handle array element assignment within a mapping value: this.scores[user][index] = value
   * Combines entry read (like visitMappingFieldAssign) + array surgery (like visitArrayAssign).
   */
  private emitMappingArrayElementAssign(node: MappingAssignNode, sortedRmw = false): Node {
    const slotIndex = node.entrySlotIndex;
    const collection = node.collection!;
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const allKeyTypes = collection.allKeyTypes;
    const arrType = collection.innermostValueType as ArrayType;
    const elemType = arrType.elementType;
    const fixedWidth = isFixedWidthType(elemType);

    // === Phase 1: Read entry commitment (array blob) ===
    // Uses the same pattern as visitMappingFieldAssign Phase 1.
    // After this phase: [array_blob] is on stack (1 untracked value)

    let untrackedCount = 1;

    if (sortedRmw) {
      // Sorted C2 RMW: materialize the current array value (reassembling chunks if chunked),
      // then fall through to the shared Phase 2 surgery. Phase 3 leaves the blob for the upsert.
      this.emitSortedSetRead(node as unknown as MappingAccessNode);
      this.popFromStack();
    } else {

      const prevValueName = `__entry_value_enc_${slotIndex}`;
      const prevKeyName = `__entry_key_enc_${slotIndex}`;
      const canChain = this.pendingEntryWrites.has(slotIndex)
        && !this.preAllocatedEntryWrites.has(slotIndex)
        && this.getStackIndex(prevValueName, true) !== -1;

      // Fail closed on a chained array-element write whose value or index READS the same entry: the flat
      // drop+re-push below consumes the pending write before the value/index is evaluated, so that read would
      // see the stale input (`m[k][0] = m[k][0] + 1; m[k][0] = m[k][0] + 1` -> 1, not 2). Read it into a local.
      if (canChain
        && (this.expressionReadsEntrySlot(node.expression, slotIndex)
          || this.expressionReadsEntrySlot(node.arrayIndex, slotIndex))) {
        throw new ChainedEntryElementReadError(node, node.collection?.name ?? node.name);
      }

      if (canChain) {
        // Chain from previous array element assignment's output.
        // Pick the already-modified value blob from the tracked stack.
        const prevValueIdx = this.getStackIndex(prevValueName);
        this.emit(encodeInt(BigInt(prevValueIdx)), locationData);
        this.emit(Op.OP_PICK, locationData);
        // 1 untracked value on stack (the copied blob)
        // Remove old key and value from the REAL stack (not just tracking) so that
        // subsequent PICK indices in array surgery and covenant verification are correct.
        this.pendingEntryWrites.delete(slotIndex);
        // Roll old key to top (accounting for 1 untracked blob) and drop it
        const oldKeyIdx = this.getStackIndex(prevKeyName);
        this.emit(encodeInt(BigInt(oldKeyIdx + 1)), locationData); // +1 for untracked blob
        this.emit(Op.OP_ROLL, locationData);
        this.emit(Op.OP_DROP, locationData);
        this.removeFromStack(this.getStackIndex(prevKeyName));
        // Roll old value to top (still 1 untracked blob) and drop it
        const oldValIdx = this.getStackIndex(prevValueName);
        this.emit(encodeInt(BigInt(oldValIdx + 1)), locationData); // +1 for untracked blob
        this.emit(Op.OP_ROLL, locationData);
        this.emit(Op.OP_DROP, locationData);
        this.removeFromStack(this.getStackIndex(prevValueName));
      } else {
        // First assignment: check if entry exists via introspection
        this.emitSlotExistsCheck('entry', slotIndex, locationData);

        this.emit(Op.OP_IF, locationData);

        this.emitEntryInputIndex(slotIndex, locationData, 0);
        this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);

        untrackedCount = 1;
        for (let i = 0; i < allKeyTypes.length; i++) {
          this.emitPushdataDecode(allKeyTypes[i], locationData);
          this.emit(Op.OP_SWAP, locationData);

          const keySource = this.entrySlots[slotIndex].keySources?.[i];
          if (!keySource || keySource.kind === 'param') {
            const keyParamName = keySource?.paramName ?? this.entrySlots[slotIndex].keyParams[i];
            const keyParamIdx = this.getStackIndex(keyParamName);
            this.emit(encodeInt(BigInt(keyParamIdx + untrackedCount + 1)), locationData);
            this.emit(Op.OP_PICK, locationData);
          } else {
            for (let u = 0; u < untrackedCount + 1; u++) {
              this.pushToStack(`__untracked_${u}`);
            }
            node.keys[i] = this.visit(node.keys[i]);
            for (let u = 0; u < untrackedCount + 1; u++) {
              this.removeFromStack(this.getStackIndex(`__untracked_${u}`));
            }
            this.popFromStack();
          }
          this.emit(Op.OP_EQUALVERIFY, locationData);
        }

        // After key verification: [value_blob] on stack (1 untracked value)
        // For ArrayType, emitPushdataDecodeLastField is a no-op - blob IS the array

        this.emit(Op.OP_ELSE, locationData);
        this.emitDefaultValue(locationData, arrType);

        this.emit(Op.OP_ENDIF, locationData);
      }
    } // end (non-sortedRmw) Phase 1 read

    // === Phase 2: Array element surgery ===
    // Stack: [array_blob] (1 untracked value)
    // Track it so we can use the stack tracker during surgery
    this.pushToStack('(arr_blob)');

    // Decode length prefix: [blob] -> [length, elements_blob]
    this.emitPushdataDecode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.popFromStack(); // remove arr_blob tracking
    this.pushToStack('(elements)');
    this.pushToStack('(arr_length)');

    // map[k].push(v) / map[k].pop(): append / drop-last surgery on the entry array, producing
    // [new_length, new_elements] for the shared re-encode below. Otherwise take the element-index surgery.
    if (node.arrayPush || node.arrayPop) {
      this.emitMappingArrayPushPopSurgery(node, elemType, fixedWidth, locationData);
    } else {
      // Save length for later re-encoding (DUP it)
      this.emit(Op.OP_DUP, locationData);
      this.pushToStack('(saved_length)');

      // Visit index.
      // At this point tracker and runtime are aligned (locals + [(elements), (arr_length),
      // (saved_length)]), so the visit's OP_PICK computes the correct depth directly.
      node.arrayIndex = this.visit(node.arrayIndex!);
      // Stack: [..., elements, arr_length, saved_length, index]

      // Bounds check: we need length on top, then index
      // Current: [..., elements, arr_length, saved_length, index]
      // Swap saved_length and index: [..., elements, arr_length, index, saved_length]
      this.emit(Op.OP_SWAP, locationData);
      this.emitBoundsCheck(locationData);
      // Stack: [..., elements, arr_length, index]
      this.popFromStack(2); // remove saved_length and index tracking from visit
      this.pushToStack('(index)');

      // Reorder [..., elements, arr_length, index] -> [..., arr_length, elements, index].
      // arr_length is kept on the stack for re-encoding the length prefix later.
      this.popFromStack(3);
      this.emit(Op.OP_ROT, locationData);   // [..., arr_length, index, elements]
      this.emit(Op.OP_SWAP, locationData);  // [..., arr_length, elements, index]
      this.pushToStack('(arr_length)');
      this.pushToStack('(elements)');
      this.pushToStack('(index)');

      if (fixedWidth) {
        const width = getFixedWidth(elemType);
        // Compute byte offset
        this.emit(encodeInt(BigInt(width)), locationData);
        this.emit(Op.OP_MUL, locationData);
        this.popFromStack();
        this.pushToStack('(offset)');

        // Split at offset: [..., arr_length, left, right]
        this.emit(Op.OP_SPLIT, locationData);
        this.popFromStack(2);
        this.pushToStack('(left)');
        this.pushToStack('(right)');

        // Split off old element
        this.emit(encodeInt(BigInt(width)), locationData);
        this.emit(Op.OP_SPLIT, locationData);
        this.emit(Op.OP_NIP, locationData); // [..., arr_length, left, remainder]
        this.popFromStack();
        this.pushToStack('(remainder)');

        // Encode new value
        node.expression = this.visit(node.expression);
        this.emitEncodeElementPacked(elemType, locationData);

        // Reassemble: left ++ new_value ++ remainder
        this.emit(Op.OP_SWAP, locationData);
        this.emit(Op.OP_CAT, locationData);
        this.popFromStack(2);
        this.pushToStack('(value)');
        this.emit(Op.OP_CAT, locationData);
        this.popFromStack(2);
        this.pushToStack('(elements)');
      } else {
        // Variable-width: scan to element, replace, reassemble
        // Stack: [..., arr_length, elements, index]
        this.popFromStack(2);
        this.pushToStack('(elements)');
        this.pushToStack('(count)');

        // Duplicate elements for size tracking
        this.emit(Op.OP_SWAP, locationData); // [..., arr_length, index, elements]
        this.emit(Op.OP_DUP, locationData); // [..., arr_length, index, elements, elements_copy]
        this.emit(Op.OP_ROT, locationData); // [..., arr_length, elements, elements_copy, index]

        this.popFromStack(2);
        this.pushToStack('(elements)');
        this.pushToStack('(count)');

        this.emitScanLoop(elemType, locationData);
        // [..., arr_length, elements, remaining_of_copy]
        this.popFromStack(2);

        // Get offset by measuring remaining size
        this.emit(Op.OP_SIZE, locationData);
        this.emit(Op.OP_NIP, locationData); // [..., arr_length, elements, remaining_size]
        this.emit(Op.OP_OVER, locationData);
        this.emit(Op.OP_SIZE, locationData);
        this.emit(Op.OP_NIP, locationData); // [..., arr_length, elements, rem_size, total_size]
        this.emit(Op.OP_SWAP, locationData);
        this.emit(Op.OP_SUB, locationData); // [..., arr_length, elements, offset_to_elem]
        this.emit(Op.OP_SPLIT, locationData); // [..., arr_length, left, elem_and_rest]

        // Skip old element
        this.pushToStack('(left)');
        this.pushToStack('(elem_and_rest)');
        this.emitPushdataSkip(elemType, locationData);
        // [..., arr_length, left, remainder]
        this.popFromStack();
        this.pushToStack('(remainder)');

        // Encode new value
        node.expression = this.visit(node.expression);
        this.emitPushdataEncode(elemType, locationData);

        // Reassemble: left ++ encoded_new ++ remainder
        this.emit(Op.OP_SWAP, locationData);
        this.emit(Op.OP_CAT, locationData);
        this.popFromStack(2);
        this.pushToStack('(value)');
        this.emit(Op.OP_CAT, locationData);
        this.popFromStack(2);
        this.pushToStack('(elements)');
      }
    } // end (element-index surgery) else-branch of the push/pop check

    // Re-encode with saved length prefix
    // Stack: [..., arr_length, modified_elements]
    this.emit(Op.OP_SWAP, locationData); // [..., modified_elements, arr_length]
    this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
    this.emit(Op.OP_SWAP, locationData); // [..., len_enc, elements]
    this.emit(Op.OP_CAT, locationData); // [..., new_array_blob]
    this.popFromStack(2);
    // The modified array blob is now on stack - it's already pushdata-encoded (ArrayType is no-op)

    if (sortedRmw) {
      // Hand the modified array blob to the enclosing emitSortedValueUpsert, which chunks/stores it.
      this.pushToStack('(value)');
      return node;
    }

    // === Phase 3: Write entry (key + value) ===
    if (this.preAllocatedEntryWrites.has(slotIndex)) {
      const keyStackName = `__entry_key_enc_${slotIndex}`;
      const valueStackName = `__entry_value_enc_${slotIndex}`;

      this.pushToStack('(value)');
      this.emitReplace(this.getStackIndex(valueStackName), node);
      this.popFromStack();

      for (let i = 0; i < node.keys.length; i++) {
        node.keys[i] = this.visit(node.keys[i]);
        this.emitPushdataEncode(allKeyTypes[i], locationData);
        if (i > 0) {
          this.emit(Op.OP_CAT, locationData);
          this.popFromStack(2);
          this.pushToStack('(value)');
        }
      }
      this.emitReplace(this.getStackIndex(keyStackName), node);
      this.popFromStack();
    } else {
      this.pushToStack(`__entry_value_enc_${slotIndex}`);

      for (let i = 0; i < node.keys.length; i++) {
        node.keys[i] = this.visit(node.keys[i]);
        this.emitPushdataEncode(allKeyTypes[i], locationData);
        if (i > 0) {
          this.emit(Op.OP_CAT, locationData);
          this.popFromStack(2);
          this.pushToStack('(value)');
        }
      }
      this.popFromStack();
      this.pushToStack(`__entry_key_enc_${slotIndex}`);

      this.pendingEntryWrites.set(slotIndex, {
        keyStackName: `__entry_key_enc_${slotIndex}`,
        valueStackName: `__entry_value_enc_${slotIndex}`,
      });
    }

    return node;
  }

  /**
   * Phase 2 surgery for `map[k].push(v)` / `map[k].pop()`. Stack in: [elements, arr_length] (2 tracked). Stack
   * out: [new_length, new_elements] (2 tracked), matching the shared re-encode. push appends an encoded element
   * and increments the length; pop (fixed-width only) drops the last element and decrements the length.
   */
  private emitMappingArrayPushPopSurgery(
    node: MappingAssignNode, elemType: Type, fixedWidth: boolean, locationData: SingleLocationData,
  ): void {
    if (node.arrayPush) {
      node.expression = this.visit(node.expression); // [elements, arr_length, value] (3 tracked)
      if (fixedWidth) this.emitEncodeElementPacked(elemType, locationData);
      else this.emitPushdataEncode(elemType, locationData); // [elements, arr_length, enc_value]
      this.emit(Op.OP_ROT, locationData);  // [arr_length, enc_value, elements]
      this.emit(Op.OP_SWAP, locationData); // [arr_length, elements, enc_value]
      this.emit(Op.OP_CAT, locationData);  // [arr_length, new_elements]
      this.popFromStack(2);
      this.pushToStack('(new_elements)'); // 3 -> 2 tracked
      this.emit(Op.OP_SWAP, locationData); // [new_elements, arr_length]
      this.emit(Op.OP_1ADD, locationData); // [new_elements, new_length]
      this.emit(Op.OP_SWAP, locationData); // [new_length, new_elements]
      return;
    }
    // pop: drop the last element. Variable-width would need a scan-to-last; fixed-width splits off the tail.
    if (!fixedWidth) throw new Error('.pop() on a variable-width mapping array element is not yet supported');
    const width = getFixedWidth(elemType);
    this.emit(Op.OP_1SUB, locationData);  // [elements, new_length]
    this.emit(Op.OP_SWAP, locationData);  // [new_length, elements]
    this.emit(Op.OP_OVER, locationData);  // [new_length, elements, new_length]
    this.pushToStack('(len_copy)');       // 2 -> 3
    this.emit(encodeInt(BigInt(width)), locationData);
    this.emit(Op.OP_MUL, locationData);   // [new_length, elements, offset]
    this.popFromStack();
    this.pushToStack('(offset)');
    this.emit(Op.OP_SPLIT, locationData); // [new_length, new_elements, last_elem]
    this.emit(Op.OP_DROP, locationData);  // [new_length, new_elements]
    this.popFromStack();                  // 3 -> 2
  }

  // A SORTED (C2) chunkable struct field write, routed as a whole-value RMW: read the current struct (materialized
  // via emitSortedSetRead, chunking-transparent), replace the field, re-store via emitSortedValueUpsert (re-chunk +
  // pin). Co-spends the entry once, like a scalar RMW `m[k] = m[k] + v`.
  private emitSortedStructFieldWrite(node: MappingFieldAssignNode): Node {
    const loc = { location: node.location, positionHint: PositionHint.END };
    const valueType = node.collection!.innermostValueType as StructType;
    const fieldIndex = valueType.fields.findIndex((f) => f.name === node.fieldName);
    const fieldType = valueType.fields[fieldIndex].type;
    return this.emitSortedValueUpsert(node as unknown as MappingAssignNode, () => {
      this.emitSortedSetRead(node as unknown as MappingAccessNode); // struct blob, tracked as '(value)'
      this.popFromStack();                                          // -> untracked working blob on top
      this.emitStructFieldSurgery(node, valueType, fieldIndex, fieldType, loc); // -> new blob (untracked)
      this.pushToStack('(value)');                                  // re-track as the value for the upsert
    });
  }

  // Replace field[fieldIndex] of the struct blob (untracked, on top) with the encoded new value from
  // node.expression. General prefix ++ new_field ++ suffix surgery (works for any field position). Leaves the new
  // struct blob untracked on top. `untracked` = working values above the tracked stack when node.expression is
  // visited (the emitSortedValueUpsert temps + prefix + suffix), so identifier reads locate their params.
  private emitStructFieldSurgery(
    node: MappingFieldAssignNode, valueType: StructType, fieldIndex: number, fieldType: Type, loc: SingleLocationData,
  ): void {
    // prefix = blob[0 : start of field]
    this.emit(Op.OP_DUP, loc);
    for (let i = 0; i < fieldIndex; i++) this.emitPushdataSkip(valueType.fields[i].type, loc);
    this.emit(Op.OP_SIZE, loc); this.emit(Op.OP_NIP, loc);            // [blob, remainder_size]
    this.emit(Op.OP_SWAP, loc);
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_SIZE, loc); this.emit(Op.OP_NIP, loc); // [remainder_size, blob, blob_size]
    this.emit(Op.OP_ROT, loc); this.emit(Op.OP_SUB, loc);             // [blob, prefix_size]
    this.emit(Op.OP_SPLIT, loc);                                      // [prefix, field_and_suffix]
    // suffix = field_and_suffix[field_size :]
    this.emit(Op.OP_DUP, loc); this.emitPushdataSkip(fieldType, loc); // [prefix, field_and_suffix, suffix]
    this.emit(Op.OP_SIZE, loc); this.emit(Op.OP_NIP, loc);            // [prefix, field_and_suffix, suffix_size]
    this.emit(Op.OP_SWAP, loc);
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_SIZE, loc); this.emit(Op.OP_NIP, loc); // [prefix, sufsz, f_and_s, fssz]
    this.emit(Op.OP_ROT, loc); this.emit(Op.OP_SUB, loc);             // [prefix, field_and_suffix, field_size]
    this.emit(Op.OP_SPLIT, loc);                                      // [prefix, old_field, suffix]
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_DROP, loc);           // [prefix, suffix]
    // new_field = encode(visit(node.expression)); 2 untracked working values (prefix, suffix) present.
    this.pushToStack('(mfa_pre)'); this.pushToStack('(mfa_suf)');
    node.expression = this.visit(node.expression);
    this.emitPushdataEncode(fieldType, loc);
    this.removeFromStack(this.getStackIndex('(mfa_suf)')); this.removeFromStack(this.getStackIndex('(mfa_pre)'));
    this.popFromStack();                                              // [prefix, suffix, new_field]
    // reassemble prefix ++ new_field ++ suffix
    this.emit(Op.OP_ROT, loc);   // [suffix, new_field, prefix]
    this.emit(Op.OP_SWAP, loc);  // [suffix, prefix, new_field]
    this.emit(Op.OP_CAT, loc);   // [suffix, prefix_new_field]
    this.emit(Op.OP_SWAP, loc);  // [prefix_new_field, suffix]
    this.emit(Op.OP_CAT, loc);   // [new_blob]
  }

  visitMappingFieldAssign(node: MappingFieldAssignNode): Node {
    if (this.plainLoopDepth > 0 && node.entrySlotIndex >= 0) {
      throw new EntryWriteInLoopError(node, node.collection?.name ?? node.name);
    }
    // A SORTED (C2) chunkable struct field write `m[k].f = v` is a whole-value RMW: the default-model path below
    // reads the key||value commitment (wrong for the slot||next||value C2 entry) and the chunkable len4 tail, so
    // route it through the chunk-aware ops - read the whole struct (materialized), replace field f, re-store
    // (re-chunk + pin). Reuses emitSortedSetRead + emitSortedValueUpsert like a scalar RMW, co-spending once.
    if (node.collection?.sorted && this.isChunkableValue(node.collection.innermostValueType)) {
      return this.emitSortedStructFieldWrite(node);
    }
    const slotIndex = node.entrySlotIndex;
    const collection = node.collection!;
    const locationData = { location: node.location, positionHint: PositionHint.END };
    const allKeyTypes = collection.allKeyTypes;
    const valueType = collection.innermostValueType as StructType;
    const fieldIndex = valueType.fields.findIndex((f) => f.name === node.fieldName);
    const fieldType = valueType.fields[fieldIndex].type;

    // === Part 1: Read entry commitment (raw struct blob) ===
    let untrackedCount = 1;

    const prevValueName = `__entry_value_enc_${slotIndex}`;
    const prevKeyName = `__entry_key_enc_${slotIndex}`;
    const canChain = this.pendingEntryWrites.has(slotIndex)
      && !this.preAllocatedEntryWrites.has(slotIndex)
      && this.getStackIndex(prevValueName, true) !== -1;
    // Chaining inside a branch/loop (scopeDepth > 0): the pending key/value were pushed below this scope's
    // base, so the flat drop+re-push relocates them above the base where removeScopedVariables discards them
    // (and conditionally mutating below-scope stack unbalances the branch). Instead update the value in place
    // via emitReplace in Part 3 - the same mechanism the pre-allocated path uses - leaving the unchanged key.
    // (A same-scope double-write is pre-allocated, not chained, so canChain + scopeDepth>0 means an outer write.)
    // Always update a chained field write in place (emitReplace in Part 3) rather than the flat drop+re-push.
    // The in-place path keeps the prior pending write on the stack while Part 2 evaluates node.expression, so
    // a read of the SAME entry inside that value sees the pending write (`m[k].x = 5; m[k].x = m[k].x + 1` ->
    // 6), consistent with the read-after-write of a scalar entry. The flat drop+re-push consumed the pending
    // value first, which made the value read the STALE input and diverge from the branch (scopeDepth>0) path.
    const chainInPlace = canChain;

    if (canChain) {
      // Chain from previous partial field assignment's output.
      // Pick the already-modified value blob from the tracked stack.
      const prevValueIdx = this.getStackIndex(prevValueName);
      this.emit(encodeInt(BigInt(prevValueIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      // 1 untracked value on stack (the copied blob)
      if (!chainInPlace) {
        // Flat case: remove old key and value from the REAL stack (not just tracking) so that
        // subsequent PICK indices in field surgery and covenant verification are correct.
        this.pendingEntryWrites.delete(slotIndex);
        // Roll old key to top (accounting for 1 untracked blob) and drop it
        const oldKeyIdx = this.getStackIndex(prevKeyName);
        this.emit(encodeInt(BigInt(oldKeyIdx + 1)), locationData); // +1 for untracked blob
        this.emit(Op.OP_ROLL, locationData);
        this.emit(Op.OP_DROP, locationData);
        this.removeFromStack(this.getStackIndex(prevKeyName));
        // Roll old value to top (still 1 untracked blob) and drop it
        const oldValIdx = this.getStackIndex(prevValueName);
        this.emit(encodeInt(BigInt(oldValIdx + 1)), locationData); // +1 for untracked blob
        this.emit(Op.OP_ROLL, locationData);
        this.emit(Op.OP_DROP, locationData);
        this.removeFromStack(this.getStackIndex(prevValueName));
      }
    } else {
      // First assignment to this slot - read from input NFT

      // 1. Check if entry exists via introspection
      this.emitSlotExistsCheck('entry', slotIndex, locationData);

      // 2. OP_IF (entry exists)
      this.emit(Op.OP_IF, locationData);

      // 3. Compute entry input index and read commitment
      this.emitEntryInputIndex(slotIndex, locationData, 0);
      this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);

      // 4. Verify keys (same as visitMappingAccess)
      untrackedCount = 1;
      for (let i = 0; i < allKeyTypes.length; i++) {
        this.emitPushdataDecode(allKeyTypes[i], locationData);
        this.emit(Op.OP_SWAP, locationData);

        const keySource = this.entrySlots[slotIndex].keySources?.[i];
        if (!keySource || keySource.kind === 'param') {
          const keyParamName = keySource?.paramName ?? this.entrySlots[slotIndex].keyParams[i];
          const keyParamIdx = this.getStackIndex(keyParamName);
          this.emit(encodeInt(BigInt(keyParamIdx + untrackedCount + 1)), locationData);
          this.emit(Op.OP_PICK, locationData);
        } else {
          for (let u = 0; u < untrackedCount + 1; u++) {
            this.pushToStack(`__untracked_${u}`);
          }
          node.keys[i] = this.visit(node.keys[i]);
          for (let u = 0; u < untrackedCount + 1; u++) {
            this.removeFromStack(this.getStackIndex(`__untracked_${u}`));
          }
          this.popFromStack();
        }
        this.emit(Op.OP_EQUALVERIFY, locationData);
      }

      // After key verification: [value_blob] on stack (1 untracked value)
      // For StructType, emitPushdataDecodeLastField is a no-op - blob IS the struct
      // So we just leave the remainder as-is (it's the raw encoded struct blob)

      // 5. OP_ELSE (entry doesn't exist - push default struct blob)
      this.emit(Op.OP_ELSE, locationData);
      this.emitDefaultValue(locationData, valueType);

      // 6. OP_ENDIF - both branches leave exactly 1 untracked value (struct blob)
      this.emit(Op.OP_ENDIF, locationData);
    }

    // === Part 2: Field surgery on the struct blob ===
    // Stack: [struct_blob] (1 untracked value)
    // Goal: replace field at fieldIndex with the new encoded value

    if (valueType.fields.length === 1) {
      // Single-field struct: drop old, encode new
      this.emit(Op.OP_DROP, locationData);
      untrackedCount = 0;

      for (let u = 0; u < untrackedCount; u++) this.pushToStack(`__untracked_mfa_${u}`);
      node.expression = this.visit(node.expression);
      this.emitPushdataEncode(fieldType, locationData);
      for (let u = 0; u < untrackedCount; u++) {
        this.removeFromStack(this.getStackIndex(`__untracked_mfa_${u}`));
      }
      this.popFromStack();
      untrackedCount = 1;
    } else if (fieldIndex === 0) {
      // First field: no prefix to preserve
      // Skip the first field to find where the suffix starts
      this.emit(Op.OP_DUP, locationData);
      this.emitPushdataSkip(fieldType, locationData);
      // Stack: [blob, suffix]
      this.emit(Op.OP_SIZE, locationData); this.emit(Op.OP_NIP, locationData);
      // Stack: [blob, suffix_size]
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_DUP, locationData); this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      // Stack: [suffix_size, blob, blob_size]
      this.emit(Op.OP_ROT, locationData);
      // Stack: [blob, blob_size, suffix_size]
      this.emit(Op.OP_SUB, locationData);
      // Stack: [blob, old_field_size]
      this.emit(Op.OP_SPLIT, locationData);
      // Stack: [old_field_enc, suffix]
      this.emit(Op.OP_SWAP, locationData); this.emit(Op.OP_DROP, locationData);
      // Stack: [suffix]
      untrackedCount = 1;

      // Visit expression with untracked adjustment
      for (let u = 0; u < untrackedCount; u++) this.pushToStack(`__untracked_mfa_${u}`);
      node.expression = this.visit(node.expression);
      this.emitPushdataEncode(fieldType, locationData);
      for (let u = 0; u < untrackedCount; u++) {
        this.removeFromStack(this.getStackIndex(`__untracked_mfa_${u}`));
      }
      this.popFromStack();
      // Stack: [suffix, new_encoded] (2 untracked)
      this.emit(Op.OP_SWAP, locationData);
      // Stack: [new_encoded, suffix]
      this.emit(Op.OP_CAT, locationData);
      // Stack: [new_blob]
      untrackedCount = 1;
    } else if (fieldIndex === valueType.fields.length - 1) {
      // Last field: no suffix to preserve
      // Skip fields 0..K-1 to find where the target field starts
      this.emit(Op.OP_DUP, locationData);
      for (let i = 0; i < fieldIndex; i++) {
        this.emitPushdataSkip(valueType.fields[i].type, locationData);
      }
      // Stack: [blob, remainder_at_last_field]
      this.emit(Op.OP_SIZE, locationData); this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_DUP, locationData); this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_ROT, locationData);
      this.emit(Op.OP_SUB, locationData);
      // Stack: [blob, prefix_size]
      this.emit(Op.OP_SPLIT, locationData);
      // Stack: [prefix, old_last_field_enc]
      this.emit(Op.OP_DROP, locationData);
      // Stack: [prefix]
      untrackedCount = 1;

      for (let u = 0; u < untrackedCount; u++) this.pushToStack(`__untracked_mfa_${u}`);
      node.expression = this.visit(node.expression);
      this.emitPushdataEncode(fieldType, locationData);
      for (let u = 0; u < untrackedCount; u++) {
        this.removeFromStack(this.getStackIndex(`__untracked_mfa_${u}`));
      }
      this.popFromStack();
      // Stack: [prefix, new_encoded] (2 untracked)
      this.emit(Op.OP_CAT, locationData);
      // Stack: [new_blob]
      untrackedCount = 1;
    } else {
      // Middle field: has both prefix and suffix
      // Step 1: Split to get prefix
      this.emit(Op.OP_DUP, locationData);
      for (let i = 0; i < fieldIndex; i++) {
        this.emitPushdataSkip(valueType.fields[i].type, locationData);
      }
      // Stack: [blob, remainder_at_field_K]
      this.emit(Op.OP_SIZE, locationData); this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_DUP, locationData); this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_ROT, locationData);
      this.emit(Op.OP_SUB, locationData);
      // Stack: [blob, prefix_size]
      this.emit(Op.OP_SPLIT, locationData);
      // Stack: [prefix, field_K_and_suffix]

      // Step 2: Skip field K to isolate suffix
      this.emit(Op.OP_DUP, locationData);
      this.emitPushdataSkip(fieldType, locationData);
      // Stack: [prefix, field_K_and_suffix, suffix]
      this.emit(Op.OP_SIZE, locationData); this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_DUP, locationData); this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(Op.OP_ROT, locationData);
      this.emit(Op.OP_SUB, locationData);
      // Stack: [prefix, field_K_and_suffix, field_K_size]
      this.emit(Op.OP_SPLIT, locationData);
      // Stack: [prefix, field_K_encoded, suffix]
      this.emit(Op.OP_SWAP, locationData); this.emit(Op.OP_DROP, locationData);
      // Stack: [prefix, suffix]
      untrackedCount = 2;

      // Visit expression
      for (let u = 0; u < untrackedCount; u++) this.pushToStack(`__untracked_mfa_${u}`);
      node.expression = this.visit(node.expression);
      this.emitPushdataEncode(fieldType, locationData);
      for (let u = 0; u < untrackedCount; u++) {
        this.removeFromStack(this.getStackIndex(`__untracked_mfa_${u}`));
      }
      this.popFromStack();
      // Stack: [prefix, suffix, new_encoded] (3 untracked)

      // Reassemble: prefix + new_encoded + suffix
      // ROT: [suffix, new_encoded, prefix]
      this.emit(Op.OP_ROT, locationData);
      // SWAP: [suffix, prefix, new_encoded]
      this.emit(Op.OP_SWAP, locationData);
      // CAT: [suffix, prefix_new_encoded]
      this.emit(Op.OP_CAT, locationData);
      // SWAP: [prefix_new_encoded, suffix]
      this.emit(Op.OP_SWAP, locationData);
      // CAT: [full_blob]
      this.emit(Op.OP_CAT, locationData);
      untrackedCount = 1;
    }

    // === Part 3: Write entry (key + value) ===
    // Stack: [modified_blob] (1 untracked value) - this IS the pushdata-encoded struct

    if (this.preAllocatedEntryWrites.has(slotIndex)) {
      // Pre-allocated path (inside branches)
      const keyStackName = `__entry_key_enc_${slotIndex}`;
      const valueStackName = `__entry_value_enc_${slotIndex}`;

      // The modified blob is already encoded - push it as the value
      this.pushToStack('(value)'); // track the blob
      this.emitReplace(this.getStackIndex(valueStackName), node);
      this.popFromStack();

      // Encode keys
      for (let i = 0; i < node.keys.length; i++) {
        node.keys[i] = this.visit(node.keys[i]);
        this.emitPushdataEncode(allKeyTypes[i], locationData);
        if (i > 0) {
          this.emit(Op.OP_CAT, locationData);
          this.popFromStack(2);
          this.pushToStack('(value)');
        }
      }
      this.emitReplace(this.getStackIndex(keyStackName), node);
      this.popFromStack();
    } else if (chainInPlace) {
      // Chained write inside a branch/loop: update the existing entry value in place (key and
      // pendingEntryWrites are unchanged - same entry, same key), so the covenant key/value survive the
      // scope's removeScopedVariables and the branch stays balanced.
      this.pushToStack('(value)');
      this.emitReplace(this.getStackIndex(prevValueName), node);
      this.popFromStack();
    } else {
      // Normal path
      // The modified blob is already encoded (struct is no-op for emitPushdataEncode)
      this.pushToStack(`__entry_value_enc_${slotIndex}`);

      // Encode keys
      for (let i = 0; i < node.keys.length; i++) {
        node.keys[i] = this.visit(node.keys[i]);
        this.emitPushdataEncode(allKeyTypes[i], locationData);
        if (i > 0) {
          this.emit(Op.OP_CAT, locationData);
          this.popFromStack(2);
          this.pushToStack('(value)');
        }
      }
      this.popFromStack();
      this.pushToStack(`__entry_key_enc_${slotIndex}`);

      this.pendingEntryWrites.set(slotIndex, {
        keyStackName: `__entry_key_enc_${slotIndex}`,
        valueStackName: `__entry_value_enc_${slotIndex}`,
      });
    }

    return node;
  }

  visitMappingDelete(node: MappingDeleteNode): Node {
    // A sorted (C2) mapping `delete m[k]` == assign the type default (Solidity semantics: delete is an assignment,
    // never a physical removal - libsolidity storageSetToZero). Route it through the upsert with value = default:
    // present -> update to 0/false/empty (nullify, node stays), absent -> insert the default. Works for bool sets
    // (delete claimed[k] writes the empty/false tail) and value mappings alike, single- or composite-key.
    if (node.collection?.sorted) {
      // Per-iteration DELETE loop `for(i) delete m[k[i]]` (batch nullify): route to the upsert loop (op=delete) - each
      // iteration co-spends k[i]'s existing entry + mints it nullified (value = default); absent keys fail closed.
      if (this.sortedUpsertLoopActive && this.sortedUpsertLoopCollection === node.collection.name) {
        return this.emitSortedUpsertLoopBody(node);
      }
      // A C2 `delete m[k]` in a DYNAMIC loop is a per-iteration sorted delete of an EVOLVING list - the same deep
      // case visitMappingAssign fails closed on. emitSortedValueUpsert co-spends the entry at a FIXED block slot, so
      // running it in a loop would pin only ONE iteration's delete and leave the rest un-covenanted (a C2 hole).
      // Fail closed (fixed-bound loops are unrolled to plainLoopDepth 0 before codegen and still work).
      if (this.plainLoopDepth > 0) {
        throw new SortedMappingCodegenPendingError(node, node.collection.name);
      }
      const vt = node.collection.innermostValueType;
      if (this.sortedValueKind(vt) !== null) {
        const dLoc = { location: node.location, positionHint: PositionHint.END };
        return this.emitSortedValueUpsert(node, () => {
          this.emitDefaultValue(dLoc, vt); this.pushToStack('(value)');
        });
      }
      throw new SortedMappingCodegenPendingError(node, node.collection.name);
    }
    if (this.plainLoopDepth > 0 && node.entrySlotIndex >= 0) {
      throw new EntryWriteInLoopError(node, node.collection?.name ?? node.name);
    }
    const slotIndex = node.entrySlotIndex;
    if (this.condDeleteSlots.has(slotIndex)) {
      // Conditional (branch/switch) delete: overwrite the pre-allocated soft-delete-write slots with (key,
      // default) so this taken branch produces output = (key||default); a not-taken branch leaves key_enc = the
      // input commitment (preserve). Mirrors visitMappingAssign's pre-allocated write path with value = default.
      const collection = node.collection!;
      const locationData = { location: node.location, positionHint: PositionHint.END };
      const allKeyTypes = collection.allKeyTypes;
      for (let i = 0; i < node.keys.length; i++) {
        node.keys[i] = this.visit(node.keys[i]);
        this.emitPushdataEncode(allKeyTypes[i], locationData);
        if (i > 0) {
          this.emit(Op.OP_CAT, locationData);
          this.popFromStack(2);
          this.pushToStack('(value)');
        }
      }
      this.emitReplace(this.getStackIndex(`__entry_key_enc_${slotIndex}`), node);
      this.popFromStack();

      this.emitDefaultValue(locationData, collection.innermostValueType);
      this.pushToStack('(value)');
      this.emitPushdataEncode(collection.innermostValueType, locationData);
      this.emitReplace(this.getStackIndex(`__entry_value_enc_${slotIndex}`), node);
      this.popFromStack();
      return node;
    }
    // Unconditional delete - covenant verification will not verify output for this slot.
    this.pendingEntryDeletes.add(slotIndex);
    return node;
  }

  /**
   * Emit opcodes to compute the entry NFT input index for a given slot.
   * Pushes 1 untracked value (the input index) onto the real stack.
   *
   * Entry input index = OP_INPUTINDEX + entryInputBase + popcount(flags bits 0..slotIndex-1)
   * where entryInputBase = 1 + compactOffsetMap.size
   *
   * @param extraStackOffset Number of untracked values already on the real stack when called
   */
  private emitEntryInputIndex(
    slotIndex: number,
    locationData: SingleLocationData,
    _extraStackOffset: number,
  ): void {
    this.emitBlockSlotIndex('entry', slotIndex, locationData);
  }

  /**
   * Emit opcodes to compute the entry NFT output index for a given slot.
   * Pushes 1 untracked value (the output index) onto the real stack.
   *
   * Output layout: written entries have compile-time positions, read-only entries
   * have flag-dependent positions.
   *
   * @param extraStackOffset Number of untracked values already on the real stack when called
   */
  private emitEntryOutputIndex(
    slotIndex: number,
    locationData: SingleLocationData,
    _extraStackOffset: number,
  ): void {
    // In 1:1 block layout, output index = input index
    this.emitBlockSlotIndex('entry', slotIndex, locationData);
  }

  /**
   * Emit a type-appropriate default value (zero/false/empty).
   * Pushes 1 value to the real stack (not tracked).
   * @param type Optional type for struct-aware default encoding.
   */
  private emitDefaultValue(locationData: SingleLocationData, type?: Type): void {
    if (type instanceof StructType) {
      // Save tracked stack: the struct encoding calls emitPushdataEncode which
      // pops/pushes on the tracked stack, but emitDefaultValue should not alter
      // the tracked stack at all (its output is untracked).
      const savedStack = [...this.stack];
      // Emit default for each struct field, pushdata-encode, and CAT together
      for (let i = 0; i < type.fields.length; i++) {
        this.emitDefaultValue(locationData, type.fields[i].type); // recursively emit default
        this.emitPushdataEncode(type.fields[i].type, locationData);
        if (i > 0) {
          this.emit(Op.OP_CAT, locationData);
        }
      }
      this.stack = savedStack; // restore - emitDefaultValue must not modify tracking
      return;
    }
    // ArrayType: emit encoded blob with length prefix + N default elements
    if (type instanceof ArrayType) {
      const savedStack = [...this.stack];
      if (type.bound !== undefined) {
        // A bounded array materializes `bound` default elements inline; an absurd bound (e.g. a ported
        // `uint[20][20][2999...]`, which solc itself rejects as "Type too large for memory") would emit an
        // astronomical script, so reject it here rather than exhaust memory building it.
        if (type.bound > MAX_MATERIALIZED_ARRAY_ELEMENTS) {
          throw new Error(`Array type is too large to materialize (${type.bound} elements); reduce the bound.`);
        }
        // Bounded: length prefix + bound default elements. Element framing must match the array literal /
        // element access model (visitArray / emitIndexIntoArrayBlob): fixed-width elements are PACKED at
        // their stride, only variable-width elements carry a pushdata frame.
        this.emit(encodeInt(BigInt(type.bound)), locationData);
        this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
        for (let i = 0; i < type.bound; i++) {
          this.emitDefaultValue(locationData, type.elementType);
          if (isFixedWidthType(type.elementType)) {
            this.emitEncodeElementPacked(type.elementType, locationData);
          } else {
            this.emitPushdataEncode(type.elementType, locationData);
          }
          this.emit(Op.OP_CAT, locationData);
        }
      } else {
        // Unbounded: empty array = just encoded int 0 (length prefix only)
        this.emit(encodeInt(0n), locationData);
        this.emitPushdataEncode(PrimitiveType.BIGINT, locationData);
      }
      this.stack = savedStack;
      return;
    }
    // For bounded bytesN (e.g. bytes4, bytes20): emit N zero bytes via OP_0 <N> OP_NUM2BIN
    if (type instanceof BytesType && type.bound !== undefined) {
      this.emit(encodeInt(0n), locationData);
      this.emit(encodeInt(BigInt(type.bound)), locationData);
      this.emit(Op.OP_NUM2BIN, locationData);
      return;
    }
    // An INTERNAL function pointer's default/zero value is the "invalid" pointer: Solidity panics when a
    // deleted or uninitialized internal fn-ptr is CALLED. functionIds are small sequential ints (assigned from
    // 0), so a large sentinel is always an unknown id and OP_INVOKE hard-fails on it - reverting the call, which
    // matches Solidity. (0 would be a VALID functionId - the first defined function - so a deleted pointer would
    // silently dispatch to it instead of reverting.) External fn-ptrs use the (address,selector) model, unchanged.
    if (type instanceof FunctionType && !type.isExternal) {
      this.emit(encodeInt(INVALID_FUNCTION_POINTER_ID), locationData);
      return;
    }
    // OP_0 pushes empty bytes which equals 0 for int, false for bool, empty for bytes
    this.emit(encodeInt(0n), locationData);
  }

  /** Verify the category on the stack shares the master's 32-byte category base. [cat] -> []. */
  private emitVerifyCatBaseEqMaster(locationData: SingleLocationData): void {
    // Shared as a subroutine for non-delegate functions; delegate (altstack proxy index) inlines.
    // Raw emit: callers manage the stack tracker.
    if (!this.currentFunctionIsDelegate && this.invokeSubroutineIfDefined(
      GenerateTargetTraversalWithLocation.CAT_BASE_EQ_MASTER_SUBROUTINE_ID, locationData)) {
      return;
    }
    this.emit(encodeInt(32n), locationData);
    this.emit(Op.OP_SPLIT, locationData);
    this.emit(Op.OP_DROP, locationData);
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.emit(encodeInt(32n), locationData);
    this.emit(Op.OP_SPLIT, locationData);
    this.emit(Op.OP_DROP, locationData);
    this.emit(Op.OP_EQUALVERIFY, locationData);
  }

  /** Emit token category verification for each accessed data NFT */
  private emitTokenCategoryVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    const sortedNftIndices = [...this.compactOffsetMap.keys()].sort((a, b) => a - b);
    for (const nftIdx of sortedNftIndices) {
      const compactOffset = this.compactOffsetMap.get(nftIdx)!;
      // data NFT category base matches master's
      this.emitMasterInputIndex(locationData);
      this.emit(encodeInt(BigInt(compactOffset)), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      this.emitVerifyCatBaseEqMaster(locationData);
    }
  }

  /** Emit auto-covenant verification for state writes */
  private emitAutoCovenantVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };

    // Group state variables by NFT index
    const nftFields = new Map<number, StateVariableNode[]>();
    for (const sv of this.stateVariables) {
      const fields = nftFields.get(sv.nftIndex) || [];
      fields.push(sv);
      nftFields.set(sv.nftIndex, fields);
    }

    // For each accessed data NFT, verify covenant properties
    for (const [nftIdx, compactOffset] of this.compactOffsetMap) {
      const fields = nftFields.get(nftIdx);
      const hasWrite = fields?.some((sv) => this.pendingStateWrites.has(`${sv.nftIndex}:${sv.fieldIndex}`));

      if (hasWrite && fields) {
        // Written NFT: reconstruct commitment from field values and verify
        const sortedFields = [...fields].sort((a, b) => a.fieldIndex - b.fieldIndex);

        let firstField = true;
        // Multi-data-NFT layouts: stamp the leading nftIndex tag, then CAT the fields onto it.
        if (this.isMultiDataNft()) {
          this.emit(encodeNftIndexTag(nftIdx), locationData);
          this.pushToStack('(value)');
          firstField = false;
        }
        for (const sv of sortedFields) {
          const key = `${sv.nftIndex}:${sv.fieldIndex}`;
          const stackName = this.pendingStateWrites.get(key);

          if (stackName) {
            // Use already-encoded value from stack
            const stackIdx = this.getStackIndex(stackName);
            this.emit(encodeInt(BigInt(stackIdx)), locationData);
            this.emit(Op.OP_PICK, locationData);
            this.pushToStack('(value)');
          } else {
            // Read from input commitment, decode, re-encode
            this.emitMasterInputIndex(locationData);
            this.emit(encodeInt(BigInt(compactOffset)), locationData);
            this.emit(Op.OP_ADD, locationData);
            this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);

            // Verify the leading nftIndex tag == the NFT index (multi-data-NFT anti-substitution, H1)
            if (this.isMultiDataNft()) this.emitNftIndexTagVerify(nftIdx, locationData);

            // Skip preceding fields
            for (let i = 0; i < sv.fieldIndex; i++) {
              this.emitPushdataSkip(this.physicalFieldType(sortedFields[i]), locationData);
            }

            // Decode this field. An unwritten dynamic var preserves its uint32 A$len header verbatim
            // (see physicalFieldType), not a value of its declared type.
            const fieldType = this.physicalFieldType(sv);
            const isLast = sv.fieldIndex === sortedFields[sortedFields.length - 1].fieldIndex;
            if (isLast) {
              this.emitPushdataDecodeLastField(fieldType, locationData);
            } else {
              this.emitPushdataDecode(fieldType, locationData);
              this.emit(Op.OP_DROP, locationData); // drop remainder (top of stack)
            }

            // Track the decoded value (produced by untracked opcodes above)
            // so that emitPushdataEncode's internal popFromStack pops the right entry
            this.pushToStack('(value)');
            // Re-encode to pushdata format (pops decoded value, pushes encoded value)
            this.emitPushdataEncode(fieldType, locationData);
          }

          // CAT with previous fields
          if (!firstField) {
            this.emit(Op.OP_CAT, locationData);
            this.popFromStack(2);
            this.pushToStack('(value)');
          }
          firstField = false;
        }

        // Verify output commitment matches reconstructed commitment
        this.emitMasterInputIndex(locationData);
        this.emit(encodeInt(BigInt(compactOffset)), locationData);
        this.emit(Op.OP_ADD, locationData);
        this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);
        this.pushToStack('(value)');

        this.emit(Op.OP_EQUALVERIFY, locationData);
        this.popFromStack(2);
      } else {
        // Read-only NFT: verify commitment preservation (input == output)
        this.emitMasterInputIndex(locationData);
        this.emit(encodeInt(BigInt(compactOffset)), locationData);
        this.emit(Op.OP_ADD, locationData);
        this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);
        this.pushToStack('(value)');

        this.emitMasterInputIndex(locationData);
        this.emit(encodeInt(BigInt(compactOffset)), locationData);
        this.emit(Op.OP_ADD, locationData);
        this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);
        this.pushToStack('(value)');

        this.emit(Op.OP_EQUALVERIFY, locationData);
        this.popFromStack(2);
      }

      // Verify output locking bytecode preserved
      this.emitMasterInputIndex(locationData);
      this.emit(encodeInt(BigInt(compactOffset)), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(Op.OP_UTXOBYTECODE, locationData);
      this.pushToStack('(value)');

      this.emitMasterInputIndex(locationData);
      this.emit(encodeInt(BigInt(compactOffset)), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      // Verify output token category preserved
      this.emitMasterInputIndex(locationData);
      this.emit(encodeInt(BigInt(compactOffset)), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      this.pushToStack('(value)');

      this.emitMasterInputIndex(locationData);
      this.emit(encodeInt(BigInt(compactOffset)), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);
    }

    // Clean up pending state write values from the stack
    for (const [, stackName] of this.pendingStateWrites) {
      const idx = this.getStackIndex(stackName);
      this.emit(encodeInt(BigInt(idx)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.removeFromStack(idx);
    }
  }

  /**
   * Emit category verification for entry NFT inputs.
   * For each entry slot, if the flag bit is set (entry exists), verify its token
   * category base matches the master's category base.
   */
  private emitEntryCategoryVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    for (let i = 0; i < this.entrySlots.length; i++) {
      // Loop-write entries are NEW (minted from master, no co-spent input entry) and have no fixed block slot.
      if (this.entrySlots[i].inLoop) continue;

      // Check if entry exists via introspection
      this.emitSlotExistsCheck('entry', i, locationData);

      // If flag is set, verify the entry input's token category
      this.emit(Op.OP_IF, locationData);

      // Compute entry input index (0 extra untracked values at IF entry)
      this.emitEntryInputIndex(i, locationData, 0);

      // Entry input category base matches master's
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      this.emitVerifyCatBaseEqMaster(locationData);

      // Verify input capability is mutable (0x01) - prevents capability downgrade attacks
      this.emitEntryInputIndex(i, locationData, 0);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(new Uint8Array([0x01]), locationData);
      this.emit(Op.OP_EQUALVERIFY, locationData);

      this.emit(Op.OP_ENDIF, locationData);
    }
  }

  /**
   * Emit one iteration of a loop mapping write `m[k[i]] = v[i]` INLINE: verify the entry NFT output at the trailing
   * runtime-counter-indexed slot (masterInputIndex + blockSize + counter) has commitment key_enc||value_enc, the
   * master's base category with mutable (0x01) capability, and the collection's entry P2SH32 locking bytecode; then
   * increment the counter in place. Precomputed loop-invariant temps (address + counter) are set up in visitWhile.
   * Modeled on emitDynamicWriteVerification's per-chunk verify (a chunk IS an entry NFT). Stack-neutral per body.
   */
  private emitLoopEntryWrite(node: MappingAssignNode): Node {
    const loc = { location: node.location, positionHint: PositionHint.END };
    const collection = node.collection!;
    const allKeyTypes = collection.allKeyTypes;
    const blockSize = this.currentFunction.blockLayout?.blockSize ?? 1;

    // --- expected commitment = key_enc CAT value_enc  (tracked '(loop_commit)') ---
    for (let i = 0; i < node.keys.length; i++) {
      node.keys[i] = this.visit(node.keys[i]);
      this.emitPushdataEncode(allKeyTypes[i], loc);
      if (i > 0) {
        this.emit(Op.OP_CAT, loc);
        this.popFromStack(2);
        this.pushToStack('(value)');
      }
    }
    node.expression = this.visit(node.expression);
    this.emitPushdataEncode(collection.innermostValueType, loc);
    this.emit(Op.OP_CAT, loc);
    this.popFromStack(2);
    this.pushToStack('(loop_commit)');

    // --- outIdx = masterInputIndex + blockSize + counter  (untracked, sits above the tracked (loop_commit)) ---
    this.emitMasterInputIndex(loc);
    this.emit(encodeInt(BigInt(blockSize)), loc);
    this.emit(Op.OP_ADD, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex(this.entryLoopCounterName) + 1)), loc); // +1: partial outIdx untracked
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_ADD, loc); // [..., (loop_commit), outIdx]

    // --- (a) locking bytecode == the loop-invariant entry address ---
    this.emit(Op.OP_DUP, loc);
    this.emit(Op.OP_OUTPUTBYTECODE, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex(this.entryLoopAddrName) + 2)), loc); // +2: outIdx, lbc untracked
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_EQUALVERIFY, loc); // [..., (loop_commit), outIdx]

    // --- (b) category base == master + mutable (0x01) ---
    this.emit(Op.OP_DUP, loc);
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, loc); // [..., outIdx, cat]
    this.emit(Op.OP_DUP, loc);
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_NIP, loc); // [..., outIdx, cat, capability]
    this.emit(new Uint8Array([0x01]), loc);
    this.emit(Op.OP_EQUALVERIFY, loc);
    this.emitVerifyCatBaseEqMaster(loc); // consumes cat -> [..., outIdx]

    // --- (c) commitment == expected. TIGHT <expected> <idx> OUTPUTTOKENCOMMITMENT EQUALVERIFY so the SDK trace
    // extractor (extractCommitmentsFromTrace) reads each iteration's key||value. ---
    this.emit(encodeInt(BigInt(this.getStackIndex('(loop_commit)') + 1)), loc); // +1: outIdx on top
    this.emit(Op.OP_PICK, loc); // [..., outIdx, expected]
    this.emit(Op.OP_SWAP, loc); // [..., expected, outIdx]
    this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, loc); // [..., expected, commitment]
    this.emit(Op.OP_EQUALVERIFY, loc); // [..., (loop_commit)]

    // drop the tracked expected commitment
    this.emit(Op.OP_DROP, loc);
    this.popFromStack();

    // --- increment counter in place (tracker-neutral: the OP_PICK value is untracked, so the +1 offset covers it
    // and emitReplace consumes it; do NOT popFromStack or the counter's tracked slot desyncs from the stack) ---
    this.emit(encodeInt(BigInt(this.getStackIndex(this.entryLoopCounterName))), loc);
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_1ADD, loc);
    this.emitReplace(this.getStackIndex(this.entryLoopCounterName) + 1, node);

    return node;
  }

  /** First entry slot index written by a runtime loop (inLoop) reachable in `node`, or -1. */
  private findLoopEntryWriteSlot(node: Node): number {
    let found = -1;
    const walk = (n: Node): void => {
      if (found >= 0 || !n) return;
      const idx = (n as unknown as { entrySlotIndex?: number }).entrySlotIndex;
      if (typeof idx === 'number' && idx >= 0 && this.entrySlots?.[idx]?.inLoop) {
        found = idx;
        return;
      }
      for (const key of Object.keys(n)) {
        if (key === 'location') continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) walk(e);
      }
    };
    walk(node);
    return found;
  }

  /**
   * Set up a loop mapping write `for(i<n) m[k[i]]=v[i]`: push the loop-invariant entry NFT P2SH32 address and a
   * runtime counter (entries-written-so-far = 0) BEFORE OP_BEGIN so both persist across iterations. Returns false
   * (no-op) when the loop body has no inLoop entry write, or when an outer loop already set one up (a function with
   * a loop entry write has exactly one entry access, so nesting cannot introduce a second address).
   */
  private emitLoopEntryWriteSetup(block: Node, loc: SingleLocationData): boolean {
    if (this.entryLoopActive) return false;
    const slot = this.findLoopEntryWriteSlot(block);
    if (slot < 0) return false;
    const collectionHash = computeCollectionHash(this.entrySlots[slot].collectionSignature);

    // Record the collection so the SDK derives the N (key,value) pairs + builds N trailing entry outputs.
    const loopWrites = (this.currentFunction.entryLoopWrites ??= []);
    if (!loopWrites.includes(this.entrySlots[slot].collection)) loopWrites.push(this.entrySlots[slot].collection);

    // Entry NFT address = base(master category) wrapped in the collection's entry covenant.
    this.emitMasterInputIndex(loc);
    this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_DROP, loc); // [..., categoryId(32B)]
    this.pushToStack(this.entryLoopAddrName);
    this.emitP2sh32FromCovenant((cat) => buildEntryNftCovenantScript(cat, collectionHash), loc);
    this.stack[0] = this.entryLoopAddrName; // helper renamed top to '(value)'

    this.emit(encodeInt(0n), loc);
    this.pushToStack(this.entryLoopCounterName);

    this.entryLoopActive = true;
    return true;
  }

  /**
   * Tear down a loop mapping write after OP_UNTIL: pin the entry-output count to the counter (no orphan/duplicate
   * entry outputs beyond the ones each iteration verified), then drop the counter and the precomputed address.
   */
  private emitLoopEntryWriteTeardown(loc: SingleLocationData): void {
    if (!this.entryLoopActive) return;

    this.emitVerifyChunkUtxoCount(this.entryLoopCounterName, true, loc, this.entryLoopAddrName);

    // Drop counter then address (top-down via getStackIndex; other temps may sit between them and the top).
    for (const name of [this.entryLoopCounterName, this.entryLoopAddrName]) {
      const idx = this.getStackIndex(name);
      this.emit(encodeInt(BigInt(idx)), loc);
      this.emit(Op.OP_ROLL, loc);
      this.emit(Op.OP_DROP, loc);
      this.removeFromStack(idx);
    }

    this.entryLoopActive = false;
  }

  /** The sorted (C2) value-write MappingAssign inside a loop body (`for(i<n) m[k[i]]=v`), or null. */
  private findSortedInsertLoopWrite(node: Node): MappingAssignNode | null {
    let found: MappingAssignNode | null = null;
    const seen = new WeakSet<object>(); // resolved-reference fields (.collection, symbols) can form cycles post-inline
    const walk = (n: Node): void => {
      if (found || !n || seen.has(n)) return;
      seen.add(n);
      // LOOP-INVARIANT value only: the range-splice body assigns EVERY new chain node the SAME value, so the value must
      // not vary per key. Two supported forms: (1) a BOOL LITERAL (`m[k[i]] = true`, whitelistWorkers) pinned to
      // 0x01/empty; (2) an 'int'-kind value read from a bare IDENTIFIER (`m[k[i]] = v`) - the SDK mints every node with
      // valueTail = encode(v arg) and the body PICKs v + EQUALVERIFYs node.value, so an invariant param verifies while a
      // reassigned / non-param identifier mints a mismatching tail and REVERTS (fail-closed). A PER-KEY value
      // (`m[k[i]] = vs[i]`, RMW `+= v`) is an ArrayAccess/binary expr - NOT matched here (the permutation of source
      // values onto the SORTED chain is unresolved) - so it falls to the clean SortedMappingCodegenPendingError.
      const vkind = n instanceof MappingAssignNode && n.collection?.sorted
        ? this.sortedValueKind(n.collection.innermostValueType) : null;
      // An identifier value must be a function PARAMETER: params are loop-invariant (set once at call entry), so the
      // SDK's minted valueTail = encode(param arg) is the same for every node and the body's PICK verifies. The loop
      // variable and other locals are NOT params -> fail closed at COMPILE here (not a compile-then-VM-revert).
      const isInvariantParamValue = n instanceof MappingAssignNode
        && n.expression instanceof IdentifierNode && vkind === 'int'
        && this.currentFunction.parameters.some((p) => p.name === (n.expression as IdentifierNode).name);
      if (n instanceof MappingAssignNode && n.collection?.sorted
        && !n.arrayIndex && !n.arrayPush && !n.arrayPop && vkind !== null
        && (n.expression instanceof BoolLiteralNode || isInvariantParamValue)) {
        found = n; return;
      }
      for (const key of Object.keys(n)) {
        // Skip resolved back-references (collection/symbol/type point into shared graphs), only walk AST tree fields.
        if (key === 'location' || key === 'collection' || key === 'symbol' || key === 'type' || found) continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) walk(e);
      }
    };
    walk(node);
    return found;
  }

  /**
   * Set up a C2 (sorted linked-list) diff-key INSERT loop `for(i<n) m[k[i]]=v`: push the loop-invariant entry NFT
   * P2SH32 address + a runtime counter (inserts-done-so-far = 0) BEFORE OP_BEGIN so both persist across iterations.
   * Each iteration co-spends the bracketing predecessor and mints one NEW node; the SDK derives the evolving list.
   * Returns false when the loop has no sorted value-write, or when an outer loop already set one up.
   */
  private emitSortedInsertLoopSetup(block: Node, loc: SingleLocationData): boolean {
    if (this.sortedInsertLoopActive) return false;
    const writeNode = this.findSortedInsertLoopWrite(block);
    if (!writeNode) return false;
    const collection = writeNode.collection!;
    const slotIndex = writeNode.entrySlotIndex;
    if (slotIndex < 0 || !this.entrySlots[slotIndex]) return false; // no slot -> fall through to the fail-close
    const collectionHash = computeCollectionHash(this.entrySlots[slotIndex].collectionSignature);

    // Record the collection so the SDK co-spends N predecessors + emits N (P', NEW) pairs (progressive list derivation).
    const loopInserts = (this.currentFunction.sortedInsertLoops ??= []);
    if (!loopInserts.includes(collection.name)) loopInserts.push(collection.name);
    this.sortedWrittenCollections.add(collection.name);

    // Off-chain derivation metadata: the leading FIXED key params + the VARYING key array (its elements are the
    // per-iteration last key, encoded as an `arridx(id:<arr>,id:<loopvar>)` keySource) + the value (a param or a bool
    // literal). Enough for the SDK to compute each H(k) = keyToSlotMulti([...fixedKeys, arr[i]]) and plan off-chain.
    const keySources = (this.entrySlots[slotIndex].keySources ?? []) as Array<{ kind: string; paramName?: string; canonical?: string }>;
    const fixedKeyParams: string[] = [];
    let varyingArrayParam: string | undefined;
    for (const src of keySources) {
      if (src.kind === 'param' && src.paramName) { fixedKeyParams.push(src.paramName); continue; }
      const m = (src.canonical ?? '').match(/^arridx\(id:(\w+),id:\w+\)$/);
      if (m) varyingArrayParam = m[1];
    }
    if (varyingArrayParam) {
      const expr = writeNode.expression;
      const info = {
        collection: collection.name, fixedKeyParams, varyingArrayParam,
        ...(expr instanceof IdentifierNode ? { valueParam: expr.name } : {}),
        ...(expr instanceof BoolLiteralNode ? { valueBool: expr.value } : {}),
      };
      const infos = (this.currentFunction.sortedInsertLoopInfo ??= []);
      if (!infos.some((x) => x.collection === info.collection)) infos.push(info);
    }

    // Entry NFT address (loop-invariant) = base(master category) wrapped in the collection's entry covenant.
    this.emitMasterInputIndex(loc);
    this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_DROP, loc);
    this.pushToStack(this.sortedInsertLoopAddrName);
    this.emitP2sh32FromCovenant((cat) => buildEntryNftCovenantScript(cat, collectionHash), loc);
    this.stack[0] = this.sortedInsertLoopAddrName; // helper renamed top to '(value)'
    // [addr]

    const blockSize = this.currentFunction.blockLayout?.blockSize ?? 1;
    const addrD = (): number => this.getStackIndex(this.sortedInsertLoopAddrName);

    // RANGE-SPLICE: co-spend the SINGLE bracketing predecessor P at input[master+blockSize]; verify bytecode==addr;
    // read [P_slot32, P_oldnext32, P_value]. All N new keys fall in P's gap; the SDK mints the sorted chain
    // P' -> k1 -> .. -> kN -> P.oldnext.
    this.emitMasterInputIndex(loc); this.emit(encodeInt(BigInt(blockSize)), loc); this.emit(Op.OP_ADD, loc); // [addr, Pidx(u)]
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_UTXOBYTECODE, loc);
    this.emit(encodeInt(BigInt(addrD() + 2)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_EQUALVERIFY, loc); // [addr, Pidx]
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); // [addr, P_slot, P_oldnext, P_value]

    // Read P' = output[master+blockSize+0]; verify bytecode==addr + category (mutable, base==master); read fields.
    this.emitMasterInputIndex(loc); this.emit(encodeInt(BigInt(blockSize)), loc); this.emit(Op.OP_ADD, loc); // [.., Poutidx(u)]
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_OUTPUTBYTECODE, loc);
    this.emit(encodeInt(BigInt(addrD() + 5)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_EQUALVERIFY, loc); // [.., Poutidx]
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_OUTPUTTOKENCATEGORY, loc);
    this.emit(Op.OP_DUP, loc); this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_NIP, loc);
    this.emit(Op.OP_1, loc); this.emit(Op.OP_EQUALVERIFY, loc);
    this.emitVerifyCatBaseEqMaster(loc); // [.., Poutidx]
    this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); // [addr, P_slot, P_oldnext, P_value, P'_slot, P'_next, P'_value]

    // P' re-points P: verify P'_slot==P_slot, P'_value==P_value, and P_slot < P'_next (first new key is inside the gap).
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc);
    this.emit(encodeInt(6n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_EQUALVERIFY, loc); // P'_slot==P_slot
    this.emit(Op.OP_DUP, loc); this.emit(encodeInt(4n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_EQUALVERIFY, loc); // P'_value==P_value
    this.emit(encodeInt(5n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc);
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc);
    this.emit(Op.OP_LESSTHAN, loc); this.emit(Op.OP_VERIFY, loc); // P_slot < P'_next

    // Reduce [.., P_slot, P_oldnext, P_value, P'_slot, P'_next, P'_value] -> [addr, P_oldnext, P'_next], then track.
    this.emit(Op.OP_DROP, loc);                                // drop P'_value
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_DROP, loc);     // drop P'_slot (P'_next stays on top)
    this.emit(encodeInt(1n), loc); this.emit(Op.OP_ROLL, loc); this.emit(Op.OP_DROP, loc); // drop P_value
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_ROLL, loc); this.emit(Op.OP_DROP, loc); // drop P_slot
    this.stack.unshift(this.sortedInsertLoopOldnextName);   // real depth1 = P_oldnext
    this.stack.unshift(this.sortedInsertLoopExpectedName);  // real depth0 = P'_next (expected first slot)

    this.emit(encodeInt(0n), loc);
    this.pushToStack(this.sortedInsertLoopCounterName);

    this.sortedInsertLoopActive = true;
    this.sortedInsertLoopCollection = collection.name;
    return true;
  }

  // Push a co-spend input / entry output index = masterInputIndex + blockSize + counter*mult + add (1 untracked on
  // top). `extraUntracked` = untracked stack items already on top when called, so the counter PICK depth is right.
  private emitSortedInsertLoopSlotIndex(mult: number, add: number, extraUntracked: number, loc: SingleLocationData): void {
    const blockSize = this.currentFunction.blockLayout?.blockSize ?? 1;
    this.emitMasterInputIndex(loc);
    this.emit(encodeInt(BigInt(blockSize)), loc); this.emit(Op.OP_ADD, loc); // master+blockSize (1 partial on top)
    this.emit(encodeInt(BigInt(this.getStackIndex(this.sortedInsertLoopCounterName) + extraUntracked + 1)), loc);
    this.emit(Op.OP_PICK, loc); // counter copy
    if (mult !== 1) { this.emit(encodeInt(BigInt(mult)), loc); this.emit(Op.OP_MUL, loc); }
    this.emit(Op.OP_ADD, loc);
    if (add !== 0) { this.emit(encodeInt(BigInt(add)), loc); this.emit(Op.OP_ADD, loc); }
  }

  /**
   * One iteration of a C2 diff-key INSERT loop. Modeled on emitSortedValueUpsert's INSERT branch (identical working-
   * area layout [v, Hk, addr, coSlot, coNext, coValue], so the same emitVerifySortedValueOutput depth args hold), but
   * co-spends the predecessor at input[master+blockSize+counter] and emits P' at output[..+2*counter] / NEW at
   * output[..+2*counter+1]. INSERT-ONLY: the bracket coSlot<Hk<coNext fails closed if the key is already present.
   */
  private emitSortedInsertLoopBody(node: MappingAssignNode): Node {
    const loc = { location: node.location, positionHint: PositionHint.END };
    const collection = node.collection!;
    const slotIndex = node.entrySlotIndex;
    // This entry is minted/co-spent inside the loop, not at a fixed block slot: exclude it from the function-epilogue
    // fixed-entry covenant + category verification (emitEntryCovenantVerification skips inLoop slots).
    if (this.entrySlots[slotIndex]) this.entrySlots[slotIndex].inLoop = true;

    const blockSize = this.currentFunction.blockLayout?.blockSize ?? 1;

    // RANGE-SPLICE body: verify the (counter)th chain node output[master+blockSize+1+counter] = slot | next | value.
    // The predecessor P was co-spent + P' verified in setup; here we walk the sorted output chain via expected_slot.
    this.emitMasterInputIndex(loc); this.emit(encodeInt(BigInt(blockSize + 1)), loc); this.emit(Op.OP_ADD, loc); // base
    this.emit(encodeInt(BigInt(this.getStackIndex(this.sortedInsertLoopCounterName) + 1)), loc);
    this.emit(Op.OP_PICK, loc); this.emit(Op.OP_ADD, loc); // [.., nodeIdx(u)]
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_OUTPUTBYTECODE, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex(this.sortedInsertLoopAddrName) + 2)), loc);
    this.emit(Op.OP_PICK, loc); this.emit(Op.OP_EQUALVERIFY, loc); // bytecode == addr
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_OUTPUTTOKENCATEGORY, loc);
    this.emit(Op.OP_DUP, loc); this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_NIP, loc);
    this.emit(Op.OP_1, loc); this.emit(Op.OP_EQUALVERIFY, loc);
    this.emitVerifyCatBaseEqMaster(loc); // [.., nodeIdx]
    this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); // [.., slot(u), next(u), value(u)]

    // slot == expected_slot (chain linkage).
    this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex(this.sortedInsertLoopExpectedName) + 4)), loc);
    this.emit(Op.OP_PICK, loc); this.emit(Op.OP_EQUALVERIFY, loc);

    // value == the loop-INVARIANT value. Bool literal -> pinned 0x01/empty. An 'int'-kind IDENTIFIER value (`= v`):
    // PICK the value variable and EQUALVERIFY node.value == it. The stored tail is the raw VM number (== the SDK's
    // encode(v arg) minted into every node), which byte-matches a PICK'd int/bool var. `+4` = the untracked items
    // above the tracked top (counter) at this point: slot, next, value, value-dup. A reassigned / non-param variable
    // mints a mismatching tail (or empty) and reverts here - sound (never a silent wrong store).
    const expr = node.expression;
    this.emit(Op.OP_DUP, loc); // [.., slot, next, value, value]
    if (expr instanceof IdentifierNode) {
      const d = this.getStackIndex(expr.name, true);
      if (d < 0) throw new SortedMappingCodegenPendingError(node, collection.name); // clean fail-close, never a crash
      this.emit(encodeInt(BigInt(d + 4)), loc);
      this.emit(Op.OP_PICK, loc);
    } else {
      this.emit(expr instanceof BoolLiteralNode && !expr.value ? new Uint8Array(0) : new Uint8Array([1]), loc);
    }
    this.emit(Op.OP_EQUALVERIFY, loc);

    // slot < next (sorted forward), unless next == 0 (the terminus +inf / P.oldnext).
    this.emit(encodeInt(1n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // next#
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_0, loc); this.emit(Op.OP_NUMEQUAL, loc);
    this.emit(Op.OP_IF, loc); this.emit(Op.OP_DROP, loc);
    this.emit(Op.OP_ELSE, loc);
    this.emit(encodeInt(3n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // slot#
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_LESSTHAN, loc); this.emit(Op.OP_VERIFY, loc); // slot < next
    this.emit(Op.OP_ENDIF, loc); // [.., slot, next, value]

    // expected_slot = next; drop value + slot.
    this.emit(Op.OP_DROP, loc); // drop value
    this.emit(Op.OP_NIP, loc);  // drop slot -> [.., next]
    this.emitReplace(this.getStackIndex(this.sortedInsertLoopExpectedName) + 1, node);

    // counter += 1.
    this.emit(encodeInt(BigInt(this.getStackIndex(this.sortedInsertLoopCounterName))), loc);
    this.emit(Op.OP_PICK, loc); this.emit(Op.OP_1ADD, loc);
    this.emitReplace(this.getStackIndex(this.sortedInsertLoopCounterName) + 1, node);
    return node;
  }

  /**
   * Tear down a RANGE-SPLICE insert loop after OP_UNTIL: verify the chain terminates at P.oldnext (expected_slot ==
   * P_oldnext), the entry-output count == counter+1 (P' + N chain nodes, no orphans) and the entry-input count == 1
   * (only P co-spent). Then drop the persistent [counter, expected, oldnext, addr].
   */
  private emitSortedInsertLoopTeardown(loc: SingleLocationData): void {
    if (!this.sortedInsertLoopActive) return;

    // expected_slot == P_oldnext (the chain's last `next` points to P's old successor).
    this.emit(encodeInt(BigInt(this.getStackIndex(this.sortedInsertLoopExpectedName))), loc); this.emit(Op.OP_PICK, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex(this.sortedInsertLoopOldnextName) + 1)), loc); this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_EQUALVERIFY, loc);

    // entry-output count == counter + 1 (P' + N chain nodes).
    this.emit(encodeInt(BigInt(this.getStackIndex(this.sortedInsertLoopCounterName))), loc);
    this.emit(Op.OP_PICK, loc); this.emit(Op.OP_1ADD, loc);
    this.pushToStack('(il_outcount)');
    this.emitVerifyChunkUtxoCount('(il_outcount)', true, loc, this.sortedInsertLoopAddrName);
    const oc = this.getStackIndex('(il_outcount)');
    this.emit(encodeInt(BigInt(oc)), loc); this.emit(Op.OP_ROLL, loc); this.emit(Op.OP_DROP, loc);
    this.removeFromStack(oc);

    // entry-input count == 1 (only the single bracketing predecessor P is co-spent at this address).
    this.emit(Op.OP_1, loc); this.pushToStack('(il_incount)');
    this.emitVerifyChunkUtxoCount('(il_incount)', false, loc, this.sortedInsertLoopAddrName);
    const ic = this.getStackIndex('(il_incount)');
    this.emit(encodeInt(BigInt(ic)), loc); this.emit(Op.OP_ROLL, loc); this.emit(Op.OP_DROP, loc);
    this.removeFromStack(ic);

    for (const name of [this.sortedInsertLoopCounterName, this.sortedInsertLoopExpectedName,
      this.sortedInsertLoopOldnextName, this.sortedInsertLoopAddrName]) {
      const idx = this.getStackIndex(name);
      this.emit(encodeInt(BigInt(idx)), loc);
      this.emit(Op.OP_ROLL, loc); this.emit(Op.OP_DROP, loc);
      this.removeFromStack(idx);
    }

    this.sortedInsertLoopActive = false;
    this.sortedInsertLoopCollection = null;
  }

  // Detect a per-iteration C2 UPDATE loop write `for(i) m[k[i]] += v[i]` (or `-= v[i]`): a MappingAssignNode on a
  // sorted int mapping whose expression is a self-read RMW (BinaryOp with left = a read of the SAME m[k], op
  // PLUS/MINUS). By GTT an INVARIANT-key RMW loop is already lifted out by CacheMappingEntryInLoop, so a sorted RMW
  // loop write that reaches here has a VARYING key (k[i]) - each iteration co-spends k[i]'s OWN existing entry.
  private findSortedUpsertLoopWrite(node: Node): MappingAssignNode | MappingDeleteNode | null {
    let found: MappingAssignNode | MappingDeleteNode | null = null;
    const seen = new WeakSet<object>();
    const walk = (n: Node): void => {
      if (found || !n || seen.has(n)) return;
      seen.add(n);
      if (n instanceof MappingAssignNode && n.collection?.sorted
        && !n.arrayIndex && !n.arrayPush && !n.arrayPop
        && this.sortedValueKind(n.collection.innermostValueType) === 'int') {
        const e = n.expression;
        // RMW credit/debit: `m[k[i]] = m[k[i]] +/- v[i]` (self-read).
        const isRmw = e instanceof BinaryOpNode
          && (e.operator === BinaryOperator.PLUS || e.operator === BinaryOperator.MINUS)
          && e.left instanceof MappingAccessNode && e.left.name === n.name;
        // Absolute per-key set: `m[k[i]] = v[i]` where v[i] is a per-iteration ARRAY element (NOT a loop-invariant
        // param - that is the range-splice SortedInsertLoopValue case). The key varying-ness is validated in setup.
        const isPerKeySet = e instanceof ArrayAccessNode && e.array instanceof IdentifierNode;
        // Absolute set to a loop-invariant INT LITERAL: `m[k[i]] = 100` (batch-set-const). A `= <param>` set goes to
        // the range-splice (SortedInsertLoopValue, tried first); a literal is not matched there, so it lands here.
        const isConstSet = e instanceof IntLiteralNode;
        if (isRmw || isPerKeySet || isConstSet) { found = n; return; }
      }
      // Per-iteration DELETE `for(i) delete m[k[i]]` (batch nullify): route through the upsert loop with op=delete
      // (UPDATE-to-default; absent keys fail closed). The key varying-ness is validated in setup (varyingArrayParam).
      if (n instanceof MappingDeleteNode && n.collection?.sorted
        && this.sortedValueKind(n.collection.innermostValueType) === 'int') {
        found = n; return;
      }
      for (const key of Object.keys(n)) {
        if (key === 'location' || key === 'collection' || key === 'symbol' || key === 'type' || found) continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) walk(e);
      }
    };
    walk(node);
    return found;
  }

  /**
   * Set up a per-iteration C2 UPDATE loop `for(i) m[k[i]] += v[i]` (multitransfer credit to EXISTING recipients):
   * push the loop-invariant entry NFT P2SH32 address + a runtime counter (updates-done = 0) BEFORE OP_BEGIN. Each
   * iteration co-spends k[i]'s OWN entry at input[master+blockSize+counter] and mints the updated entry at
   * output[master+blockSize+counter]. Records the varying key array + value array so the SDK co-spends each existing
   * entry (SortedList.find) and mints its updated commitment. Returns false when no such loop write / already active.
   */
  private emitSortedUpsertLoopSetup(block: Node, loc: SingleLocationData): boolean {
    if (this.sortedUpsertLoopActive) return false;
    const writeNode = this.findSortedUpsertLoopWrite(block);
    if (!writeNode) return false;
    const collection = writeNode.collection!;
    const slotIndex = writeNode.entrySlotIndex;
    if (slotIndex < 0 || !this.entrySlots[slotIndex]) return false;
    const collectionHash = computeCollectionHash(this.entrySlots[slotIndex].collectionSignature);

    // SDK metadata: leading FIXED key params + the VARYING key array + the per-key VALUE array + the op.
    const keySources = (this.entrySlots[slotIndex].keySources ?? []) as Array<{ kind: string; paramName?: string; canonical?: string }>;
    const fixedKeyParams: string[] = [];
    let varyingArrayParam: string | undefined;
    for (const src of keySources) {
      if (src.kind === 'param' && src.paramName) { fixedKeyParams.push(src.paramName); continue; }
      const m = (src.canonical ?? '').match(/^arridx\(id:(\w+),id:\w+\)$/);
      if (m) varyingArrayParam = m[1];
    }
    const isDelete = writeNode instanceof MappingDeleteNode;
    let op: '+' | '-' | 'set' | 'delete';
    let valueArrayParam: string | undefined;    // per-key vs[i]
    let valueScalarParam: string | undefined;   // loop-invariant param (e.g. `+= amount` fixed-amount airdrop)
    let valueConst: string | undefined;         // loop-invariant int literal (e.g. `+= 100`)
    if (isDelete) {
      op = 'delete'; // nullify to the type default; no per-key value array
    } else {
      const expr = (writeNode as MappingAssignNode).expression;
      const isRmw = expr instanceof BinaryOpNode;
      op = !isRmw ? 'set' : (expr as BinaryOpNode).operator === BinaryOperator.MINUS ? '-' : '+';
      const valueRight = isRmw ? (expr as BinaryOpNode).right : expr; // per-key value = RHS (RMW) or the whole assign
      if (valueRight instanceof ArrayAccessNode && valueRight.array instanceof IdentifierNode) {
        valueArrayParam = valueRight.array.name;                        // per-key vs[i]
      } else if (valueRight instanceof IdentifierNode
        && this.currentFunction.parameters.some((p) => p.name === (valueRight as IdentifierNode).name)) {
        valueScalarParam = valueRight.name;                            // loop-INVARIANT param (same for every key)
      } else if (valueRight instanceof IntLiteralNode) {
        valueConst = valueRight.value.toString();                      // loop-invariant int literal
      }
    }
    // 'delete' has no value; every other op needs exactly one value source. All need the varying key array.
    const hasValue = !!valueArrayParam || !!valueScalarParam || valueConst !== undefined;
    if (!varyingArrayParam || (!isDelete && !hasValue)) return false;
    this.sortedUpsertLoopOp = op;
    const infos = (this.currentFunction.sortedUpsertLoopInfo ??= []);
    if (!infos.some((x) => x.collection === collection.name)) {
      infos.push({ collection: collection.name, fixedKeyParams, varyingArrayParam,
        ...(valueArrayParam && { valueArrayParam }), ...(valueScalarParam && { valueScalarParam }),
        ...(valueConst !== undefined && { valueConst }), op });
    }
    this.sortedWrittenCollections.add(collection.name);

    // Entry NFT address (loop-invariant) = base(master category) wrapped in the collection's entry covenant.
    this.emitMasterInputIndex(loc);
    this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
    this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_DROP, loc);
    this.pushToStack(this.sortedUpsertLoopAddrName);
    this.emitP2sh32FromCovenant((cat) => buildEntryNftCovenantScript(cat, collectionHash), loc);
    this.stack[0] = this.sortedUpsertLoopAddrName;

    this.emit(encodeInt(0n), loc);
    this.pushToStack(this.sortedUpsertLoopCounterName);
    this.emit(encodeInt(0n), loc);
    this.pushToStack(this.sortedUpsertLoopOutCounterName);

    // MSG.SENDER MERGE: when EXACTLY ONE fixed (non-loop) entry of this collection coexists (the cached msg.sender
    // debit), push a re-point register (0). A new recipient landing in the debit entry's gap is then inserted by
    // re-pointing the debit's single co-spend - the credit loop records the new slot, the debit flush applies it.
    // Only for crediting ops (+ / set); a debit (-) or delete never inserts a new recipient.
    const fixedSlots = this.entrySlots
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.collection === collection.name && !s.inLoop);
    if (fixedSlots.length === 1 && (op === '+' || op === 'set')) {
      this.sortedUpsertMergeDebitSlot = fixedSlots[0].i;
      this.sortedUpsertPendingRepoint = true;
      this.emit(encodeInt(0n), loc);
      this.pushToStack(this.sortedUpsertLoopRepointName);
    } else {
      this.sortedUpsertMergeDebitSlot = -1;
      this.sortedUpsertPendingRepoint = false;
    }

    // CASE (b) pending-defer registers (crediting ops only; a debit/delete never inserts a new recipient). Init empty:
    // pu_slot = b'' (no pending), pu_val = 0, pu_next = b'' (+inf).
    if (op === '+' || op === 'set') {
      this.emit(Op.OP_0, loc); this.pushToStack(this.sortedUpsertPendSlotName);
      this.emit(Op.OP_0, loc); this.pushToStack(this.sortedUpsertPendValName);
      this.emit(Op.OP_0, loc); this.pushToStack(this.sortedUpsertPendNextName);
      this.sortedUpsertPendActive = true;
    } else {
      this.sortedUpsertPendActive = false;
    }

    this.sortedUpsertLoopActive = true;
    this.sortedUpsertLoopCollection = collection.name;
    return true;
  }

  // CASE (b) pending-defer flush: if a deferred UPDATE entry is pending (pu_slot != empty), mint it NORMALLY (no
  // re-point) = [pu_slot|pu_next|pu_val] at output[master+blockSize+outCounter], outCounter += 1, clear pu_slot.
  // Stack-neutral (U=0 in/out). Used per-iteration (flush the prior pending before processing this key) and at
  // teardown (flush the last one). The re-point variant lives inline in the body (it needs the current key Hk).
  private emitSortedFlushPendingNormal(loc: SingleLocationData): void {
    const blockSize = this.currentFunction.blockLayout?.blockSize ?? 1;
    const outCtr = this.sortedUpsertLoopOutCounterName;
    const pSlot = this.sortedUpsertPendSlotName;
    const pVal = this.sortedUpsertPendValName;
    const pNext = this.sortedUpsertPendNextName;
    // pendingValid = size(pu_slot) > 0
    this.emit(encodeInt(BigInt(this.getStackIndex(pSlot))), loc); this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_SIZE, loc); this.emit(Op.OP_NIP, loc);
    this.emit(Op.OP_0, loc); this.emit(Op.OP_GREATERTHAN, loc);
    this.emit(Op.OP_IF, loc);
    this.scopeDepth += 1;
    // outIdx = master + blockSize + outCounter (U=1)
    this.emitMasterInputIndex(loc);
    this.emit(encodeInt(BigInt(blockSize)), loc); this.emit(Op.OP_ADD, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex(outCtr) + 1)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_ADD, loc);
    // mint [pu_slot | pu_next | pu_val] (identical bytes to the deferred UPDATE's commitment)
    this.emitVerifySortedValueOutput(loc, this.getStackIndex(this.sortedUpsertLoopAddrName) + 1,
      this.getStackIndex(pSlot) + 1, this.getStackIndex(pNext) + 1, this.getStackIndex(pVal) + 1); // -> U=0
    // outCounter += 1
    this.emit(encodeInt(BigInt(this.getStackIndex(outCtr))), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_1ADD, loc);
    this.emitReplace(this.getStackIndex(outCtr) + 1, { location: loc.location } as unknown as Node);
    // clear pending (pu_slot = empty)
    this.emit(Op.OP_0, loc);
    this.emitReplace(this.getStackIndex(pSlot) + 1, { location: loc.location } as unknown as Node);
    this.scopeDepth -= 1;
    this.emit(Op.OP_ENDIF, loc);
  }

  // CASE (b) pending-defer flush WITH re-point (per-iteration, in the body where the current key Hk = '(credit_hk)' and
  // amount = '(credit_amt)' are live). If a deferred UPDATE is pending and the CURRENT key lands in its gap
  // (pu_slot < Hk < pu_next), the current key is provably a NEW node inserting right after the pending entry: mint
  // pending' = [pu_slot|Hk|pu_val] (updated AND re-pointed) + NEW = [Hk|pu_next|amt], clear the pending, and leave
  // consumed = 1 (the caller skips the current key's normal processing - it co-spends nothing, its predecessor was
  // co-spent when it was deferred). Otherwise mint the pending normally and leave consumed = 0. No pending -> 0.
  // Leaves exactly one untracked value [consumed] on top (U=1). The soundness anchor is the in-gap check against the
  // pending's REAL nextKey: an existing entry between makes pu_next = that entry and Hk < pu_next fails -> normal path.
  private emitSortedFlushPendingRepoint(node: Node, loc: SingleLocationData): void {
    const blockSize = this.currentFunction.blockLayout?.blockSize ?? 1;
    const outCtr = this.sortedUpsertLoopOutCounterName;
    const addr = this.sortedUpsertLoopAddrName;
    const pSlot = this.sortedUpsertPendSlotName;
    const pVal = this.sortedUpsertPendValName;
    const pNext = this.sortedUpsertPendNextName;
    const hk = '(credit_hk)';
    const amt = '(credit_amt)';
    // mintIdx: push output index master + blockSize + outCounter + add (u = untracked count currently above)
    const mintIdx = (add: number, u: number): void => {
      this.emitMasterInputIndex(loc);
      this.emit(encodeInt(BigInt(blockSize + add)), loc); this.emit(Op.OP_ADD, loc);
      this.emit(encodeInt(BigInt(this.getStackIndex(outCtr) + u + 1)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_ADD, loc);
    };
    // pendingValid = size(pu_slot) > 0
    this.emit(encodeInt(BigInt(this.getStackIndex(pSlot))), loc); this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_SIZE, loc); this.emit(Op.OP_NIP, loc); this.emit(Op.OP_0, loc); this.emit(Op.OP_GREATERTHAN, loc); // U=1
    this.emit(Op.OP_IF, loc);
    this.scopeDepth += 1;
    // inGap = (pu_slot < Hk) AND (pu_next == 0 OR Hk < pu_next)
    this.emit(encodeInt(BigInt(this.getStackIndex(pSlot))), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // pSlot# U=1
    this.emit(encodeInt(BigInt(this.getStackIndex(hk) + 1)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // Hk# U=2
    this.emit(Op.OP_LESSTHAN, loc); // b1 U=1
    this.emit(encodeInt(BigInt(this.getStackIndex(pNext) + 1)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // pNext# U=2
    this.emit(Op.OP_DUP, loc); this.emit(Op.OP_0, loc); this.emit(Op.OP_NUMEQUAL, loc); // isInf U=3
    this.emit(Op.OP_IF, loc); this.emit(Op.OP_DROP, loc); this.emit(Op.OP_1, loc); // +inf -> b2=1 U=2
    this.emit(Op.OP_ELSE, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex(hk) + 2)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // Hk# U=3
    this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_LESSTHAN, loc); // Hk < pNext -> b2 U=2
    this.emit(Op.OP_ENDIF, loc); // [b1, b2] U=2
    this.emit(Op.OP_BOOLAND, loc); // inGap U=1
    this.emit(Op.OP_IF, loc);
    this.scopeDepth += 1;
    // ===== RE-POINT: mint P' = [pu_slot|Hk|pu_val] + NEW = [Hk|pu_next|amt]; outCounter += 2; clear; consumed = 1 =====
    mintIdx(0, 0); // P' outIdx U=1
    this.emitVerifySortedValueOutput(loc, this.getStackIndex(addr) + 1,
      this.getStackIndex(pSlot) + 1, this.getStackIndex(hk) + 1, this.getStackIndex(pVal) + 1); // P' = pSlot|Hk|pVal -> U=0
    mintIdx(1, 0); // NEW outIdx U=1
    this.emitVerifySortedValueOutput(loc, this.getStackIndex(addr) + 1,
      this.getStackIndex(hk) + 1, this.getStackIndex(pNext) + 1, this.getStackIndex(amt) + 1); // NEW = Hk|pNext|amt -> U=0
    this.emit(encodeInt(BigInt(this.getStackIndex(outCtr))), loc); this.emit(Op.OP_PICK, loc); this.emit(encodeInt(2n), loc); this.emit(Op.OP_ADD, loc);
    this.emitReplace(this.getStackIndex(outCtr) + 1, node); // outCounter += 2 -> U=0
    this.emit(Op.OP_0, loc); this.emitReplace(this.getStackIndex(pSlot) + 1, node); // clear pending -> U=0
    this.emit(Op.OP_1, loc); // consumed = 1 (U=1)
    this.scopeDepth -= 1;
    this.emit(Op.OP_ELSE, loc);
    this.scopeDepth += 1;
    // ===== NORMAL flush: mint [pu_slot|pu_next|pu_val]; outCounter += 1; clear; consumed = 0 =====
    mintIdx(0, 0); // outIdx U=1
    this.emitVerifySortedValueOutput(loc, this.getStackIndex(addr) + 1,
      this.getStackIndex(pSlot) + 1, this.getStackIndex(pNext) + 1, this.getStackIndex(pVal) + 1); // -> U=0
    this.emit(encodeInt(BigInt(this.getStackIndex(outCtr))), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_1ADD, loc);
    this.emitReplace(this.getStackIndex(outCtr) + 1, node); // outCounter += 1 -> U=0
    this.emit(Op.OP_0, loc); this.emitReplace(this.getStackIndex(pSlot) + 1, node); // clear pending -> U=0
    this.emit(Op.OP_0, loc); // consumed = 0 (U=1)
    this.scopeDepth -= 1;
    this.emit(Op.OP_ENDIF, loc); // [consumed] U=1
    this.scopeDepth -= 1;
    this.emit(Op.OP_ELSE, loc);
    this.emit(Op.OP_0, loc); // no pending -> consumed = 0 (U=1)
    this.emit(Op.OP_ENDIF, loc); // [consumed] U=1
  }

  /**
   * One iteration of a per-iteration C2 UPSERT loop `for(i) m[k[i]] += v[i]`. Co-spend ONE input at
   * input[master+blockSize+iterCounter] (k[i]'s entry for an UPDATE, or its bracketing predecessor for an INSERT of a
   * NEW recipient), read [coSlot|coNext|coValue], and branch on coSlot == keyToSlot(k[i]):
   *   UPDATE (present): DEFER - stash coSlot|coNext|newValue in the pending registers (mint next iter / teardown).
   *   INSERT (absent): verify coSlot < Hk < coNext; mint P' = coSlot|Hk|coValue at output[..+outCounter] and
   *                    NEW = Hk|coNext|v[i] at output[..+outCounter+1]; outCounter += 2.
   * Link preserved so sortedness holds; supply conserved via the shared v[] param. The SDK detects same-predecessor
   * conflicts (two new keys in one gap / a co-spend used twice) and fails closed.
   */
  private emitSortedUpsertLoopBody(node: MappingAssignNode | MappingDeleteNode): Node {
    const loc = { location: node.location, positionHint: PositionHint.END };
    const collection = node.collection!;
    const slotIndex = node.entrySlotIndex;
    if (this.entrySlots[slotIndex]) this.entrySlots[slotIndex].inLoop = true;
    const blockSize = this.currentFunction.blockLayout?.blockSize ?? 1;
    const op = this.sortedUpsertLoopOp;
    const isMinus = op === '-';
    const iterIdx = (): number => this.getStackIndex(this.sortedUpsertLoopCounterName);
    const outIdxC = (): number => this.getStackIndex(this.sortedUpsertLoopOutCounterName);
    const addrIdx = (): number => this.getStackIndex(this.sortedUpsertLoopAddrName);
    const hkIdx = (): number => this.getStackIndex('(credit_hk)');
    const amtIdx = (): number => this.getStackIndex('(credit_amt)');
    // Emit `master + blockSize + <persistent counter> + add`, leaving an output/input index on top (U untracked above).
    const pushIdx = (counterName: string, add: number, u: number): void => {
      this.emitMasterInputIndex(loc);
      this.emit(encodeInt(BigInt(blockSize + add)), loc); this.emit(Op.OP_ADD, loc);
      this.emit(encodeInt(BigInt(this.getStackIndex(counterName) + u + 1)), loc); this.emit(Op.OP_PICK, loc);
      this.emit(Op.OP_ADD, loc);
    };

    // 1. Hk = keyToSlot(k[i]) + 2. amount = v[i] - both tracked temps. The per-key value is the BinaryOp RHS (RMW)
    // or the whole assign expression ('set'); 'delete' has no value - nullify to the type default (0/empty).
    this.emitSortedKeyHash(node, slotIndex, loc);
    this.pushToStack('(credit_hk)');
    if (op === 'delete') {
      this.emit(Op.OP_0, loc); this.pushToStack('(credit_amt)'); // default value tail (0 = empty for int)
    } else {
      const a = node as MappingAssignNode;
      if (op === 'set') { a.expression = this.visit(a.expression); }
      else { (a.expression as BinaryOpNode).right = this.visit((a.expression as BinaryOpNode).right); }
      this.stack[0] = '(credit_amt)';
    }
    // tracked: [credit_amt(0), credit_hk(1), outCounter(2), iterCounter(3), addr(4), ..]

    // NORMAL per-recipient step: co-spend k[i]'s entry (UPDATE) or its bracketing predecessor (INSERT), mint, bump
    // outCounter, and iterCounter += 1 (one trailing co-spend). Leaves [coSlot, coNext, X] U=3.
    const emitNormalStep = (): void => {
      // 3. co-spend INPUT[master+blockSize+iterCounter]: bytecode==addr, mutable + base==master, read [coSlot,coNext,coValue].
      pushIdx(this.sortedUpsertLoopCounterName, 0, 0); // [.., nodeIdx]
      this.emit(Op.OP_DUP, loc); this.emit(Op.OP_UTXOBYTECODE, loc);
      this.emit(encodeInt(BigInt(addrIdx() + 2)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_EQUALVERIFY, loc);
      this.emit(Op.OP_DUP, loc); this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
      this.emit(Op.OP_DUP, loc); this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_NIP, loc);
      this.emit(Op.OP_1, loc); this.emit(Op.OP_EQUALVERIFY, loc);
      this.emitVerifyCatBaseEqMaster(loc);
      this.emit(Op.OP_UTXOTOKENCOMMITMENT, loc);
      this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc);
      this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); // [.., coSlot(u), coNext(u), coValue(u)]  U=3

      // 4. isPresent = coSlot == Hk.
      this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc);              // coSlot copy (U=4)
      this.emit(encodeInt(BigInt(hkIdx() + 4)), loc); this.emit(Op.OP_PICK, loc); // Hk (U=5)
      this.emit(Op.OP_EQUAL, loc);                                            // [.., coSlot, coNext, coValue, isPresent] U=4
      this.emit(Op.OP_IF, loc);
      this.scopeDepth += 1;
      // ---- UPDATE: mint output[..+outCounter] = coSlot|coNext|newValue ----
      if (op === 'set' || op === 'delete') {
        this.emit(Op.OP_DROP, loc);                                          // drop coValue -> [.., coSlot, coNext] U=2
        this.emit(encodeInt(BigInt(amtIdx() + 2)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc);
      } else {                                                               // [.., coSlot, coNext, v[i]#] U=3
        this.emit(Op.OP_DUP, loc); this.emit(Op.OP_BIN2NUM, loc);            // coValue# (U=4)
        this.emit(encodeInt(BigInt(amtIdx() + 4)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc);
        this.emit(isMinus ? Op.OP_SUB : Op.OP_ADD, loc);                     // newValue# (U=4)
        this.emit(Op.OP_NIP, loc);                                           // [.., coSlot, coNext, newValue] U=3
      }
      if (this.sortedUpsertPendActive) {
        // UPDATE-DEFER (crediting loops): stash [coSlot, coNext, newValue] into the pending registers; the mint is
        // deferred to the next iteration's flush (which may re-point it) or teardown. delta = 0 (nothing minted here).
        this.emit(Op.OP_DUP, loc);                                            // newValue copy (U=4)
        this.emitReplace(this.getStackIndex(this.sortedUpsertPendValName) + 4, node);  // pu_val = newValue -> U=3
        this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc);            // coSlot copy (U=4)
        this.emitReplace(this.getStackIndex(this.sortedUpsertPendSlotName) + 4, node); // pu_slot = coSlot -> U=3
        this.emit(encodeInt(1n), loc); this.emit(Op.OP_PICK, loc);            // coNext copy (U=4)
        this.emitReplace(this.getStackIndex(this.sortedUpsertPendNextName) + 4, node); // pu_next = coNext -> U=3
        this.emit(Op.OP_0, loc);                                             // delta = 0 (U=4)
      } else {
        // ---- UPDATE (debit/delete loops): mint output[..+outCounter] = coSlot|coNext|newValue immediately ----
        pushIdx(this.sortedUpsertLoopOutCounterName, 0, 3);                   // outIdx (U=4)
        this.emitVerifySortedValueOutput(loc, addrIdx() + 4, 3, 2, 1);        // addr, coSlot, coNext, newValue
        this.emit(Op.OP_1, loc);                                             // delta = 1 (U=4)
      }
      this.emit(Op.OP_ELSE, loc);
      // ---- INSERT (absent -> NEW recipient): only for `+=`; `-=`/`delete` fail closed (branch-balanced) ----
      if (isMinus || op === 'delete') { this.emit(Op.OP_0, loc); this.emit(Op.OP_VERIFY, loc); }
      this.emit(encodeInt(2n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc);       // coSlot# (U=4)
      this.emit(encodeInt(BigInt(hkIdx() + 4)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // Hk#
      this.emit(Op.OP_LESSTHAN, loc); this.emit(Op.OP_VERIFY, loc);                                   // coSlot < Hk (U=3)
      this.emit(encodeInt(1n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc);       // coNext# (U=4)
      this.emit(Op.OP_DUP, loc); this.emit(Op.OP_0, loc); this.emit(Op.OP_NUMEQUAL, loc);
      this.emit(Op.OP_IF, loc); this.emit(Op.OP_DROP, loc);                                           // +inf -> ok (U=3)
      this.emit(Op.OP_ELSE, loc);
      this.emit(encodeInt(BigInt(hkIdx() + 4)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // Hk#
      this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_LESSTHAN, loc); this.emit(Op.OP_VERIFY, loc);       // Hk < coNext (U=3)
      this.emit(Op.OP_ENDIF, loc);                                                                    // [.., coSlot, coNext, coValue] U=3
      pushIdx(this.sortedUpsertLoopOutCounterName, 0, 3);                     // P' outIdx (U=4)
      this.emitVerifySortedValueOutput(loc, addrIdx() + 4, 3, hkIdx() + 4, 1); // P' = coSlot|Hk|coValue
      pushIdx(this.sortedUpsertLoopOutCounterName, 1, 3);                     // NEW outIdx2 (U=4)
      this.emitVerifySortedValueOutput(loc, addrIdx() + 4, hkIdx() + 4, 2, amtIdx() + 4); // NEW = Hk|coNext|v[i]
      this.emit(Op.OP_2, loc);                                               // delta = 2 (U=4)
      this.scopeDepth -= 1;
      this.emit(Op.OP_ENDIF, loc);                                          // [.., coSlot, coNext, X, delta] U=4
      // 5. outCounter += delta.
      this.emit(encodeInt(BigInt(outIdxC() + 4)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_ADD, loc);
      this.emitReplace(outIdxC() + 4, node);                                 // -> [.., coSlot, coNext, X] U=3
      // iterCounter += 1 (one trailing co-spend this iteration).
      this.emit(encodeInt(BigInt(iterIdx() + 3)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_1ADD, loc);
      this.emitReplace(iterIdx() + 4, node);                                 // -> [.., coSlot, coNext, X] U=3
    };

    // MSG.SENDER MERGE (or normal step): if the debit entry coexists (sortedUpsertMergeDebitSlot >= 0) and this NEW
    // recipient lands in the DEBIT entry's gap (dSlot < Hk < dNext, read from its REAL input - so an entry between makes
    // dNext=that and the check fails -> normal path, NO omission), insert by re-pointing the debit's single co-spend:
    // mint ONLY the NEW node here, record Hk in the re-point register (require it was 0 = at most one merge; two-in-gap
    // fails closed), NO trailing co-spend (iter += 0). The debit flush reads the register and re-points msg.sender.
    const emitMergeOrNormalDispatch = (): void => {
      if (this.sortedUpsertMergeDebitSlot >= 0) {
        this.emitEntryInputIndex(this.sortedUpsertMergeDebitSlot, loc, 0);
        this.emit(Op.OP_UTXOTOKENCOMMITMENT, loc);
        this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc);
        this.emit(encodeInt(32n), loc); this.emit(Op.OP_SPLIT, loc); this.emit(Op.OP_DROP, loc); // [.., dSlot, dNext] U=2
        // isMerge = dSlot < Hk AND (dNext == 0 OR Hk < dNext)
        this.emit(encodeInt(1n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc);   // dSlot# (U=3)
        this.emit(encodeInt(BigInt(hkIdx() + 3)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // Hk#
        this.emit(Op.OP_LESSTHAN, loc);                                                             // b1 (U=3) [dSlot,dNext,b1]
        this.emit(encodeInt(1n), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc);   // dNext# (U=4)
        this.emit(Op.OP_DUP, loc); this.emit(Op.OP_0, loc); this.emit(Op.OP_NUMEQUAL, loc);         // isInf (U=5)
        this.emit(Op.OP_IF, loc); this.emit(Op.OP_DROP, loc); this.emit(Op.OP_1, loc);              // +inf -> b2=1 (U=4)
        this.emit(Op.OP_ELSE, loc);
        this.emit(encodeInt(BigInt(hkIdx() + 4)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_BIN2NUM, loc); // Hk#
        this.emit(Op.OP_SWAP, loc); this.emit(Op.OP_LESSTHAN, loc);                                 // Hk<dNext -> b2 (U=4)
        this.emit(Op.OP_ENDIF, loc);                                                                // [dSlot,dNext,b1,b2] U=4
        this.emit(Op.OP_BOOLAND, loc);                                                              // isMerge (U=3) [dSlot,dNext,isMerge]
        this.emit(Op.OP_IF, loc);
        this.scopeDepth += 1;
        // ===== MERGE: require register == 0; mint NEW=[Hk|dNext|amt]; register = Hk; outCounter += 1 =====
        this.emit(encodeInt(BigInt(this.getStackIndex(this.sortedUpsertLoopRepointName) + 2)), loc); this.emit(Op.OP_PICK, loc);
        this.emit(Op.OP_0, loc); this.emit(Op.OP_NUMEQUAL, loc); this.emit(Op.OP_VERIFY, loc);       // register == 0 (U=2)
        pushIdx(this.sortedUpsertLoopOutCounterName, 0, 2);                     // NEW outIdx (U=3)
        this.emitVerifySortedValueOutput(loc, addrIdx() + 3, hkIdx() + 3, 1, amtIdx() + 3); // NEW = Hk|dNext|amt -> [dSlot,dNext] U=2
        this.emit(encodeInt(BigInt(hkIdx() + 2)), loc); this.emit(Op.OP_PICK, loc);                  // Hk copy (U=3)
        this.emitReplace(this.getStackIndex(this.sortedUpsertLoopRepointName) + 3, node);            // register = Hk -> U=2
        this.emit(encodeInt(BigInt(outIdxC() + 2)), loc); this.emit(Op.OP_PICK, loc); this.emit(Op.OP_1ADD, loc);
        this.emitReplace(outIdxC() + 3, node);                                 // outCounter += 1 -> [dSlot,dNext] U=2
        this.emit(Op.OP_0, loc);                                               // dummy -> [dSlot,dNext,dummy] U=3
        this.scopeDepth -= 1;
        this.emit(Op.OP_ELSE, loc);
        this.scopeDepth += 1;
        this.emit(Op.OP_DROP, loc); this.emit(Op.OP_DROP, loc);                // drop dNext, dSlot
        emitNormalStep();                                                      // -> [coSlot,coNext,X] U=3
        this.scopeDepth -= 1;
        this.emit(Op.OP_ENDIF, loc);                                          // [.., t, t, t] U=3
      } else {
        emitNormalStep();                                                      // -> [coSlot,coNext,X] U=3
      }
    };

    // CASE (b) FLUSH-WITH-REPOINT: mint the prior iteration's DEFERRED update (if any). If THIS key lands in the
    // pending's gap it is a NEW node right after the pending: re-point the pending + mint NEW here (consumed = 1),
    // and skip the current key's normal processing (it co-spent nothing). Otherwise mint the pending normally and
    // fall through to the merge/normal dispatch.
    if (this.sortedUpsertPendActive) {
      this.emitSortedFlushPendingRepoint(node, loc);                          // -> [consumed] U=1
      this.emit(Op.OP_IF, loc);
      this.scopeDepth += 1;
      this.emit(Op.OP_0, loc); this.emit(Op.OP_0, loc); this.emit(Op.OP_0, loc); // consumed: [t,t,t] U=3
      this.scopeDepth -= 1;
      this.emit(Op.OP_ELSE, loc);
      this.scopeDepth += 1;
      emitMergeOrNormalDispatch();                                            // -> [x,x,x] U=3
      this.scopeDepth -= 1;
      this.emit(Op.OP_ENDIF, loc);                                            // [x,x,x] U=3
    } else {
      emitMergeOrNormalDispatch();                                            // -> [coSlot,coNext,X] U=3
    }

    // common cleanup: drop the 3 untracked temps + [credit_amt, credit_hk].
    this.emit(Op.OP_DROP, loc); this.emit(Op.OP_DROP, loc); this.emit(Op.OP_DROP, loc);
    this.emit(Op.OP_DROP, loc); this.popFromStack(); // credit_amt
    this.emit(Op.OP_DROP, loc); this.popFromStack(); // credit_hk
    return node;
  }

  /**
   * Tear down a per-iteration C2 UPSERT loop after OP_UNTIL: pin the entry-INPUT count == iterCounter + nFixed (one
   * co-spend per recipient + the fixed debit) and the entry-OUTPUT count == outCounter + nFixed (updates mint 1,
   * inserts mint 2), so there are no orphan / extra entries. Then drop [outCounter, iterCounter, addr].
   */
  private emitSortedUpsertLoopTeardown(loc: SingleLocationData): void {
    if (!this.sortedUpsertLoopActive) return;
    // CASE (b) FLUSH: the loop's last iteration DEFERS its update's mint into the pending registers; mint it now
    // (before the count pins, which read outCounter). No key follows, so it is always a normal (non-re-pointed) flush.
    if (this.sortedUpsertPendActive) this.emitSortedFlushPendingNormal(loc);
    // The entry NFT address ALSO hosts this collection's FIXED (non-loop) entries - e.g. a full multiTransfer's
    // cached `bal[msg.sender] -= amounts[i]` debit is a fixed slot at the same address. Those are co-spent + minted
    // (verified separately at their fixed positions), so the address's total count is counter + nFixed.
    const nFixed = this.entrySlots.filter(
      (s) => s.collection === this.sortedUpsertLoopCollection && !s.inLoop,
    ).length;
    const pushExpectedCount = (counterName: string): void => {
      this.emit(encodeInt(BigInt(this.getStackIndex(counterName))), loc); this.emit(Op.OP_PICK, loc);
      if (nFixed > 0) { this.emit(encodeInt(BigInt(nFixed)), loc); this.emit(Op.OP_ADD, loc); }
    };
    // entry-input count == iterCounter + nFixed (one co-spend per recipient).
    pushExpectedCount(this.sortedUpsertLoopCounterName);
    this.pushToStack('(ul_incount)');
    this.emitVerifyChunkUtxoCount('(ul_incount)', false, loc, this.sortedUpsertLoopAddrName);
    let idx = this.getStackIndex('(ul_incount)');
    this.emit(encodeInt(BigInt(idx)), loc); this.emit(Op.OP_ROLL, loc); this.emit(Op.OP_DROP, loc);
    this.removeFromStack(idx);
    // entry-output count == outCounter + nFixed (updates mint 1, inserts mint 2 = P'+NEW).
    pushExpectedCount(this.sortedUpsertLoopOutCounterName);
    this.pushToStack('(ul_outcount)');
    this.emitVerifyChunkUtxoCount('(ul_outcount)', true, loc, this.sortedUpsertLoopAddrName);
    idx = this.getStackIndex('(ul_outcount)');
    this.emit(encodeInt(BigInt(idx)), loc); this.emit(Op.OP_ROLL, loc); this.emit(Op.OP_DROP, loc);
    this.removeFromStack(idx);

    const dropNames = [this.sortedUpsertLoopOutCounterName, this.sortedUpsertLoopCounterName, this.sortedUpsertLoopAddrName];
    if (this.sortedUpsertPendActive) {
      dropNames.unshift(this.sortedUpsertPendSlotName, this.sortedUpsertPendValName, this.sortedUpsertPendNextName);
    }
    for (const name of dropNames) {
      const i = this.getStackIndex(name);
      this.emit(encodeInt(BigInt(i)), loc); this.emit(Op.OP_ROLL, loc); this.emit(Op.OP_DROP, loc);
      this.removeFromStack(i);
    }
    this.sortedUpsertPendActive = false;
    this.sortedUpsertLoopActive = false;
    this.sortedUpsertLoopCollection = null;
  }

  // A dynamic (runtime-bound) keccak256 loop reads one compute side-car per iteration from the region right after
  // the master [master+blockSize+counter): stateful contracts use their compile-time blockSize, stateless ones
  // use blockSize 1 (master + the side-cars immediately after it, absolute-forward from OP_INPUTINDEX). Push a
  // 0-based counter before OP_BEGIN; emitKeccakComputeCall reads region[master+blockSize+counter], binds, and
  // increments it each iteration. Fires for any keccakCompute function whose loop body calls keccak256; both the
  // stateful and stateless reads use the same absolute-forward covenant (self-preserve via OP_INPUTINDEX).
  private emitLoopKeccakSetup(block: Node, loc: SingleLocationData): boolean {
    if (this.keccakLoopActive) return false;
    if (!this.currentFunction.keccakCompute) return false;
    if (!this.blockHasKeccakCall(block)) return false;
    this.currentFunction.keccakLoopReads = true; // tells the SDK to progressively co-spend N runtime side-cars
    this.emit(encodeInt(0n), loc);
    this.pushToStack(this.keccakLoopCounterName);
    this.keccakLoopActive = true;
    return true;
  }

  // Tear down a dynamic keccak loop after OP_UNTIL: drop the counter. No count-pin is needed - each iteration
  // BINDS its side-car's preimage == the running value, so extra/missing trailing side-cars fail closed (a
  // missing one aborts the read; an extra one is an independent self-preserving UTXO the master never reads).
  private emitLoopKeccakTeardown(loc: SingleLocationData): void {
    if (!this.keccakLoopActive) return;
    const idx = this.getStackIndex(this.keccakLoopCounterName);
    this.emit(encodeInt(BigInt(idx)), loc);
    this.emit(Op.OP_ROLL, loc);
    this.emit(Op.OP_DROP, loc);
    this.removeFromStack(idx);
    this.keccakLoopActive = false;
  }

  private blockHasKeccakCall(node: Node): boolean {
    if (node instanceof FunctionCallNode && node.identifier.name === GlobalFunction.KECCAK256) return true;
    for (const value of Object.values(node)) {
      if (value instanceof Node) { if (this.blockHasKeccakCall(value)) return true; }
      else if (Array.isArray(value)) {
        for (const item of value) if (item instanceof Node && this.blockHasKeccakCall(item)) return true;
      }
    }
    return false;
  }

  /**
   * Emit covenant verification for entry NFT outputs.
   * Verifies output commitments for written entries, output categories,
   * and master self-preservation (if not already done by data NFT auto-covenant).
   */
  private emitEntryCovenantVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };

    // 1. Verify output commitments for WRITTEN (non-deleted) entries
    for (const [slotIdx, writeInfo] of this.pendingEntryWrites) {
      if (this.pendingEntryDeletes.has(slotIdx) || this.condDeleteSlots.has(slotIdx)) continue;
      if (this.isAliasCondWrite(slotIdx)) continue; // gated separately below

      // Reconstruct expected commitment: key_enc OP_CAT value_enc
      const keyStackIdx = this.getStackIndex(writeInfo.keyStackName);
      this.emit(encodeInt(BigInt(keyStackIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');

      const valueStackIdx = this.getStackIndex(writeInfo.valueStackName);
      this.emit(encodeInt(BigInt(valueStackIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)'); // reconstructed commitment

      // Compute output index and get output commitment
      // extraStackOffset=0 because the reconstructed commitment is tracked
      this.emitEntryOutputIndex(slotIdx, locationData, 0);
      this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);
    }

    // 2. Verify output token category base matches master for written (non-deleted) entry outputs
    for (const [slotIdx] of this.pendingEntryWrites) {
      if (this.pendingEntryDeletes.has(slotIdx) || this.condDeleteSlots.has(slotIdx)) continue;
      if (this.isAliasCondWrite(slotIdx)) continue;

      // Output category base matches master's
      this.emitEntryOutputIndex(slotIdx, locationData, 0);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      this.emitVerifyCatBaseEqMaster(locationData);

      // Verify output capability is mutable (0x01) - prevents capability downgrade attacks
      this.emitEntryOutputIndex(slotIdx, locationData, 0);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(new Uint8Array([0x01]), locationData);
      this.emit(Op.OP_EQUALVERIFY, locationData);
    }

    // 3. Verify output locking bytecode for WRITTEN (non-deleted) entry outputs
    // Construct the expected P2SH32 locking bytecode at runtime (same pattern as event verification)
    for (const [slotIdx] of this.pendingEntryWrites) {
      if (this.pendingEntryDeletes.has(slotIdx) || this.condDeleteSlots.has(slotIdx)) continue;
      if (this.isAliasCondWrite(slotIdx)) continue;

      const entryAccess = this.entrySlots[slotIdx];
      const collectionHash = computeCollectionHash(entryAccess.collectionSignature);

      // Get master's 32-byte categoryId from input
      this.emitMasterInputIndex(locationData);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.pushToStack('(value)'); // categoryId on stack

      // Reconstruct the entry NFT P2SH32 locking bytecode from the category on the stack,
      // auto-derived from buildEntryNftCovenantScript (collectionHash baked in) so this mirror
      // can never drift from state.ts regardless of how the entry covenant evolves.
      this.emitP2sh32FromCovenant((cat) => buildEntryNftCovenantScript(cat, collectionHash), locationData);
      // Stack: [..., entry_lbc] (expected locking bytecode)

      // Get actual output locking bytecode
      this.emitEntryOutputIndex(slotIdx, locationData, 0);
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);
    }

    // 3b. Alias-conditional writes (swap-remove `m[a]=v; delete m[b]`): verify the output ONLY when this write's
    // key differs from the aliasing delete's key. When they alias (removing the last key) the write is a no-op the
    // delete supersedes, the SDK funds this slot (no output), and the gate skips reading the absent output.
    this.emitAliasConditionalWriteVerification(locationData);

    // 4. Clean up pending entry write values from the stack. Conditional soft-delete slots are verified LATER
    // (emitConditionalDeleteVerification, after read-only preservation) so their key_enc/value_enc stay for now.
    for (const [slotIdx, writeInfo] of this.pendingEntryWrites) {
      if (this.condDeleteSlots.has(slotIdx)) continue;
      const keyIdx = this.getStackIndex(writeInfo.keyStackName);
      this.emit(encodeInt(BigInt(keyIdx)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.removeFromStack(keyIdx);

      const valIdx = this.getStackIndex(writeInfo.valueStackName);
      this.emit(encodeInt(BigInt(valIdx)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.removeFromStack(valIdx);
    }
  }

  // True for a write slot marked alias-conditional (verified via a runtime key-inequality gate, not the main loops).
  private isAliasCondWrite(slotIdx: number): boolean {
    return this.entrySlots[slotIdx]?.aliasCondDeleteSlot !== undefined
      && this.pendingEntryWrites.has(slotIdx)
      && !this.pendingEntryDeletes.has(slotIdx) && !this.condDeleteSlots.has(slotIdx);
  }

  // Verify each alias-conditional write's output ONLY when its key differs from the aliasing delete's key. Both
  // key_enc values are still on the stack (the soft-delete's are cleaned up later). When the keys are equal
  // (removing the last key) the gate is false: the delete supersedes the write, the SDK funds this slot with no
  // output, and the skipped OP_IF body never reads it. Mirrors the commitment/category/bytecode checks in the
  // main loops for the single gated slot.
  private emitAliasConditionalWriteVerification(loc: SingleLocationData): void {
    for (const [slotIdx, writeInfo] of this.pendingEntryWrites) {
      if (!this.isAliasCondWrite(slotIdx)) continue;
      const aliasKeyName = `__entry_key_enc_${this.entrySlots[slotIdx].aliasCondDeleteSlot}`;
      if (this.getStackIndex(aliasKeyName) < 0) continue; // aliasing delete's key not on stack -> cannot gate

      // gate = (write key_enc != alias delete key_enc)
      this.emit(encodeInt(BigInt(this.getStackIndex(writeInfo.keyStackName))), loc);
      this.emit(Op.OP_PICK, loc);
      this.pushToStack('(aliaschk)');
      this.emit(encodeInt(BigInt(this.getStackIndex(aliasKeyName))), loc);
      this.emit(Op.OP_PICK, loc);
      this.pushToStack('(aliaschk)');
      this.emit(Op.OP_EQUAL, loc);
      this.popFromStack(2);
      this.pushToStack('(aliaschk)');
      this.emit(Op.OP_NOT, loc);
      this.emit(Op.OP_IF, loc);
      this.popFromStack();

      // (a) commitment: output[slot] == key_enc ++ value_enc
      this.emit(encodeInt(BigInt(this.getStackIndex(writeInfo.keyStackName))), loc);
      this.emit(Op.OP_PICK, loc);
      this.pushToStack('(value)');
      this.emit(encodeInt(BigInt(this.getStackIndex(writeInfo.valueStackName))), loc);
      this.emit(Op.OP_PICK, loc);
      this.pushToStack('(value)');
      this.emit(Op.OP_CAT, loc);
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emitEntryOutputIndex(slotIdx, loc, 0);
      this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, loc);
      this.pushToStack('(value)');
      this.emit(Op.OP_EQUALVERIFY, loc);
      this.popFromStack(2);

      // (b) category base == master + mutable capability
      this.emitEntryOutputIndex(slotIdx, loc, 0);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, loc);
      this.emitVerifyCatBaseEqMaster(loc);
      this.emitEntryOutputIndex(slotIdx, loc, 0);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, loc);
      this.emit(encodeInt(32n), loc);
      this.emit(Op.OP_SPLIT, loc);
      this.emit(Op.OP_NIP, loc);
      this.emit(new Uint8Array([0x01]), loc);
      this.emit(Op.OP_EQUALVERIFY, loc);

      // (c) locking bytecode == entry NFT P2SH32
      const collectionHash = computeCollectionHash(this.entrySlots[slotIdx].collectionSignature);
      this.emitMasterInputIndex(loc);
      this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
      this.emit(encodeInt(32n), loc);
      this.emit(Op.OP_SPLIT, loc);
      this.emit(Op.OP_DROP, loc);
      this.pushToStack('(value)');
      this.emitP2sh32FromCovenant((cat) => buildEntryNftCovenantScript(cat, collectionHash), loc);
      this.emitEntryOutputIndex(slotIdx, loc, 0);
      this.emit(Op.OP_OUTPUTBYTECODE, loc);
      this.pushToStack('(value)');
      this.emit(Op.OP_EQUALVERIFY, loc);
      this.popFromStack(2);

      this.emit(Op.OP_ENDIF, loc);
    }
  }

  /**
   * Verify conditional soft-delete entry slots (a branch/switch `delete m[k]` lowered to a soft-delete write).
   * EXISTENCE-GATED: an absent entry (a not-taken guard-return on an absent key) has no output. A present entry's
   * output must equal the reconstructed commitment - the input commitment (preserve) when the delete branch did
   * not run, or (key||default) when it did. Runs AFTER emitReadOnlyEntryVerification so the derivation probe
   * extracts the always-passing read-only preservations BEFORE it may fail on an un-derived soft-delete output
   * (else the extracted commitments would be off by one). Then cleans up the slots' key_enc/value_enc.
   */
  private emitConditionalDeleteVerification(node: FunctionDefinitionNode): void {
    if (this.condDeleteSlots.size === 0) return;
    const locationData = { location: node.body.location, positionHint: PositionHint.END };
    for (const slotIdx of this.condDeleteSlots) {
      const writeInfo = this.pendingEntryWrites.get(slotIdx)!;
      this.emitSlotExistsCheck('entry', slotIdx, locationData);
      this.emit(Op.OP_IF, locationData);

      // (a) output commitment == key_enc CAT value_enc
      this.emit(encodeInt(BigInt(this.getStackIndex(writeInfo.keyStackName))), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');
      this.emit(encodeInt(BigInt(this.getStackIndex(writeInfo.valueStackName))), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emitEntryOutputIndex(slotIdx, locationData, 0);
      this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      // (b) output category base == master + mutable capability
      this.emitEntryOutputIndex(slotIdx, locationData, 0);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      this.emitVerifyCatBaseEqMaster(locationData);
      this.emitEntryOutputIndex(slotIdx, locationData, 0);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(new Uint8Array([0x01]), locationData);
      this.emit(Op.OP_EQUALVERIFY, locationData);

      // (c) output locking bytecode == the entry NFT covenant
      const entryAccess = this.entrySlots[slotIdx];
      const collectionHash = computeCollectionHash(entryAccess.collectionSignature);
      this.emitMasterInputIndex(locationData);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.pushToStack('(value)');
      this.emitP2sh32FromCovenant((cat) => buildEntryNftCovenantScript(cat, collectionHash), locationData);
      this.emitEntryOutputIndex(slotIdx, locationData, 0);
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      this.emit(Op.OP_ENDIF, locationData);
    }

    // Clean up the soft-delete slots' key_enc/value_enc.
    for (const slotIdx of this.condDeleteSlots) {
      const writeInfo = this.pendingEntryWrites.get(slotIdx)!;
      const keyIdx = this.getStackIndex(writeInfo.keyStackName);
      this.emit(encodeInt(BigInt(keyIdx)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.removeFromStack(keyIdx);
      const valIdx = this.getStackIndex(writeInfo.valueStackName);
      this.emit(encodeInt(BigInt(valIdx)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.removeFromStack(valIdx);
    }
  }

  /**
   * Emit covenant verification for dynamic-storage writes (string / unbounded bytes). The value is on the
   * stack (from visitStateAssign) and the register field already holds uint32 A$len. Verify the trailing
   * chunk OUTPUTS reconstruct exactly that value:
   *   - nNew = ceil(len / CHUNK); for i in 0..nNew-1 at output (OP_INPUTINDEX + blockSize + i): verify
   *     locking bytecode == chunk address, category base == master + mutable, commitment == [i ++ data_i].
   *   - orphan-bound: exactly nNew outputs carry the chunk address (no extra/duplicate chunk outputs).
   *   - old-chunk consumption: ceil(oldLen / CHUNK) inputs carry the chunk address (every old chunk
   *     co-spent), so a shrink/replace leaves no stale chunk. Together these pin the exact chunk set.
   * See docs/dynamic-storage.md.
   */
  private emitDynamicWriteVerification(node: FunctionDefinitionNode): void {
    const loc = { location: node.body.location, positionHint: PositionHint.END };
    const blockSize = this.currentFunction.blockLayout?.blockSize ?? 1;
    const CHUNK = 120;
    // The trailing chunk output index is blockSize+i, but blockSize COUNTS the returnEvent slot, which a plain
    // send does NOT materialize (only .emitReturn(), i.e. __internal__returnOutputIdx >= 0, creates it). An
    // unmaterialized returnEvent shifts the trailing chunks down by 1, so subtract 1 at runtime when
    // returnOutputIdx < 0. The SDK's getChunkOutputBase() makes the SAME adjustment (they must agree - the SDK's
    // no-emit case is exactly returnOutputIdx = -1). Same family as the return-event x deploy fix (5a691a9a).
    const hasReturnEventSlot = this.currentFunction.blockLayout?.slots.some((s) => s.kind === 'returnEvent') ?? false;

    // A persisted read of a DIFFERENT var (one not also written) co-spends that var's chunks read-only; the
    // chunk covenant recreates them as iteration-entry outputs at their input index [blockSize, blockSize+
    // count) (output==input). So a written var's NEW chunks must start AFTER those preserved outputs. Compute
    // each foreign read's chunk count (ceil(A$len/CHUNK)) as a loop-invariant temp; the write output offset
    // adds their sum. (Reading the SAME written var is read-modify-write: consumed + recreated by the write,
    // not a preserved output, so it is excluded here - matching the SDK's iterationEntryInputs.)
    const writtenNames = node.dynamicWrites ?? [];
    const foreignReads = (node.dynamicReads ?? []).filter((r) => !writtenNames.includes(r));
    const fReadTempNames: string[] = [];
    for (let k = 0; k < foreignReads.length; k++) {
      const rsv = this.stateVariables.find((v) => v.name === foreignReads[k])!;
      this.emitReadDynamicLen(rsv, `(dyn_wfread_${k})`, loc);
      this.emit(encodeInt(BigInt(CHUNK - 1)), loc);
      this.emit(Op.OP_ADD, loc);
      this.emit(encodeInt(BigInt(CHUNK)), loc);
      this.emit(Op.OP_DIV, loc); // ceil(A$len/CHUNK); top stays tracked as (dyn_wfread_k)
      fReadTempNames.push(`(dyn_wfread_${k})`);
    }
    // Multiple distinct written dynamic vars share the trailing-OUTPUT space: var W's new chunks verify at
    // blockSize + sum(new-chunk counts of the written vars before W) + i. Process in state-var DECLARATION
    // order (this.stateVariables) - the same order the SDK emits chunk outputs (dynamicChunkVars =
    // stateLayout.variables filtered to dynamicWrites). Each var's value stays on the stack (cleanup deferred
    // to the end) so a prior var's count is ceil(size(value)/CHUNK), computed on demand.
    const declIndex = (n: string): number => this.stateVariables.findIndex((v) => v.name === n);
    const writesInDeclOrder = [...this.pendingDynamicWrites.entries()]
      .sort(([a], [b]) => declIndex(a) - declIndex(b));
    const writtenValueStackNames: string[] = [];

    for (const [name, { valueStackName, sv }] of writesInDeclOrder) {
      const chunkHash = computeCollectionHash(computeCollectionSignature(name, sv.type.toString()));
      // Multi-chunk write loop. The raw value lives on the stack (valueStackName); split it into
      // CHUNK-byte pieces and verify each as a trailing chunk output (output index blockSize+i) via the
      // tight `<expected> <idx> OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY` pattern (the SDK extractor reads
      // each expected progressively across derivation iterations). Modeled on visitCollectionIteration, so
      // the body is runtime-stack-neutral by construction.

      // --- loop-invariant temp: chunk address locking bytecode ('(dyn_chunkaddr)') ---
      this.emitMasterInputIndex(loc);
      this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
      this.emit(encodeInt(32n), loc);
      this.emit(Op.OP_SPLIT, loc);
      this.emit(Op.OP_DROP, loc); // [..., categoryId(32B)]
      this.pushToStack('(dyn_chunkaddr)');
      this.emitP2sh32FromCovenant((cat) => buildEntryNftCovenantScript(cat, chunkHash), loc);
      this.stack[0] = '(dyn_chunkaddr)'; // helper renamed top (index 0) to '(value)'

      // --- loop-invariant temp: nNew = ceil(size(value) / CHUNK) ('(dyn_nnew)') ---
      this.emit(encodeInt(BigInt(this.getStackIndex(valueStackName))), loc);
      this.emit(Op.OP_PICK, loc); // copy value
      this.pushToStack('(dyn_nnew)');
      this.emit(Op.OP_SIZE, loc); // [..., value_copy, size] (OP_SIZE leaves the value)
      this.emit(Op.OP_NIP, loc); // [..., size]
      this.emit(encodeInt(BigInt(CHUNK - 1)), loc);
      this.emit(Op.OP_ADD, loc);
      this.emit(encodeInt(BigInt(CHUNK)), loc);
      this.emit(Op.OP_DIV, loc); // nNew = (size + CHUNK-1) / CHUNK; 0 when empty

      // --- prior written-var output counts as loop-invariant temps: ceil(size(value_P)/CHUNK) per written
      // var declared before this one, so this var's chunks verify at blockSize + sum(prior counts) + i.
      // Empty for the first written var (no temps, single-write bytecode identical). ---
      const wPriorTempNames: string[] = [];
      for (let k = 0; k < writtenValueStackNames.length; k++) {
        this.emit(encodeInt(BigInt(this.getStackIndex(writtenValueStackNames[k]))), loc);
        this.emit(Op.OP_PICK, loc); // copy prior value
        this.pushToStack(`(dyn_wprior_${k})`);
        this.emit(Op.OP_SIZE, loc);
        this.emit(Op.OP_NIP, loc);
        this.emit(encodeInt(BigInt(CHUNK - 1)), loc);
        this.emit(Op.OP_ADD, loc);
        this.emit(encodeInt(BigInt(CHUNK)), loc);
        this.emit(Op.OP_DIV, loc); // ceil(size/CHUNK); top stays tracked as (dyn_wprior_k)
        wPriorTempNames.push(`(dyn_wprior_${k})`);
      }

      // --- loop counter i = 0 ('(dyn_i)') ---
      this.emit(encodeInt(0n), loc);
      this.pushToStack('(dyn_i)');

      // LOOP: OP_BEGIN / cond(i<nNew) / OP_IF / verify chunk i / incr / OP_0 / OP_ELSE / OP_1 / OP_ENDIF / OP_UNTIL
      this.scopeDepth += 1;
      this.emit(Op.OP_BEGIN, loc);

      // condition: i < nNew (untracked manual PICKs, like visitCollectionIteration; OP_IF consumes it)
      this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_i)'))), loc);
      this.emit(Op.OP_PICK, loc);
      this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_nnew)') + 1)), loc); // +1 for the picked i
      this.emit(Op.OP_PICK, loc);
      this.emit(Op.OP_LESSTHAN, loc);
      this.emit(Op.OP_IF, loc);

      const stackBeforeBody = [...this.stack];
      const stackDepth = this.stack.length;

      // --- build expected = pushdata(i) ++ pushdata(slice_i)  (tracked '(dyn_expected)') ---
      this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_i)'))), loc);
      this.emit(Op.OP_PICK, loc); // copy i
      this.pushToStack('(dyn_expected)');
      this.emitPushdataEncode(new IntType(false, 32), loc); // pushdata(i)
      this.stack[0] = '(dyn_expected)';

      // slice_i = value[i*CHUNK : i*CHUNK + min(CHUNK, size - i*CHUNK)]  (tracked '(dyn_slice)')
      this.emit(encodeInt(BigInt(this.getStackIndex(valueStackName))), loc);
      this.emit(Op.OP_PICK, loc); // copy value
      this.pushToStack('(dyn_slice)');
      this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_i)'))), loc); // (dyn_slice) already tracked, no offset
      this.emit(Op.OP_PICK, loc); // copy i
      this.emit(encodeInt(BigInt(CHUNK)), loc);
      this.emit(Op.OP_MUL, loc); // start = i*CHUNK
      this.emit(Op.OP_SPLIT, loc); // [..., left, right=value[start:]]
      this.emit(Op.OP_NIP, loc); // drop left -> [..., right]
      this.emit(Op.OP_SIZE, loc); // [..., right, size(right)]
      this.emit(encodeInt(BigInt(CHUNK)), loc);
      this.emit(Op.OP_MIN, loc); // chunkLen = min(CHUNK, size(right))
      this.emit(Op.OP_SPLIT, loc); // [..., slice, tail]
      this.emit(Op.OP_DROP, loc); // [..., slice]
      this.emitPushdataEncode(new BytesType(), loc); // pushdata(slice)
      this.stack[0] = '(dyn_slice)';
      this.emit(Op.OP_CAT, loc); // pushdata(i) ++ pushdata(slice)
      this.popFromStack(); // [..., (dyn_expected) = full expected]

      // --- verify chunk output i (untracked working values; expected is already built & tracked) ---
      // outIdx = masterInputIndex + blockSize + sum(collection-iter counts) + sum(foreign-read counts)
      //          + sum(prior written-var counts) + i
      this.emitMasterInputIndex(loc);
      this.emit(encodeInt(BigInt(blockSize)), loc);
      this.emit(Op.OP_ADD, loc);
      this.emitAddCollectionIterCounts(loc); // collection-iter entry outputs precede chunk outputs (W4)
      // Subtract 1 when the reserved returnEvent slot is NOT materialized (returnOutputIdx < 0) - it does not
      // occupy an output, so the trailing chunks sit one lower. One untracked value (the running outIdx-partial)
      // is above the tracked stack here, hence the +1 pick offset.
      const roiIdx = hasReturnEventSlot ? this.getStackIndex('__internal__returnOutputIdx', true) : -1;
      if (roiIdx >= 0) {
        this.emit(encodeInt(BigInt(roiIdx + 1)), loc);
        this.emit(Op.OP_PICK, loc);          // [..., outIdxPartial, returnOutputIdx]
        this.emit(encodeInt(0n), loc);
        this.emit(Op.OP_LESSTHAN, loc);       // [..., outIdxPartial, (returnOutputIdx < 0 ? 1 : 0)]
        this.emit(Op.OP_SUB, loc);            // [..., outIdxPartial - unmaterialized-returnEvent]
      }
      for (const ft of fReadTempNames) {
        this.emit(encodeInt(BigInt(this.getStackIndex(ft) + 1)), loc); // +1: running outIdx-partial untracked
        this.emit(Op.OP_PICK, loc);
        this.emit(Op.OP_ADD, loc);
      }
      for (const pt of wPriorTempNames) {
        this.emit(encodeInt(BigInt(this.getStackIndex(pt) + 1)), loc); // +1: running outIdx-partial untracked
        this.emit(Op.OP_PICK, loc);
        this.emit(Op.OP_ADD, loc);
      }
      this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_i)') + 1)), loc); // +1: outIdx-partial untracked
      this.emit(Op.OP_PICK, loc);
      this.emit(Op.OP_ADD, loc); // [..., outIdx]
      // (a) locking bytecode == chunk address
      this.emit(Op.OP_DUP, loc);
      this.emit(Op.OP_OUTPUTBYTECODE, loc);
      this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_chunkaddr)') + 2)), loc); // +2: outIdx, bytecode
      this.emit(Op.OP_PICK, loc);
      this.emit(Op.OP_EQUALVERIFY, loc); // [..., outIdx]
      // (b) category base == master + mutable
      this.emit(Op.OP_DUP, loc);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, loc); // [..., outIdx, cat]
      this.emit(Op.OP_DUP, loc);
      this.emit(encodeInt(32n), loc);
      this.emit(Op.OP_SPLIT, loc);
      this.emit(Op.OP_NIP, loc); // [..., outIdx, cat, capability]
      this.emit(new Uint8Array([0x01]), loc);
      this.emit(Op.OP_EQUALVERIFY, loc);
      this.emitVerifyCatBaseEqMaster(loc); // consumes cat -> [..., outIdx]
      // (c) commitment == expected. TIGHT pattern <expected> <idx> OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY
      // so the SDK trace extractor (extractCommitmentsFromTrace) reads each chunk's expected commitment.
      this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_expected)') + 1)), loc); // +1: outIdx on top
      this.emit(Op.OP_PICK, loc); // [..., outIdx, expected]
      this.emit(Op.OP_SWAP, loc); // [..., expected, outIdx]
      this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, loc); // [..., expected, commitment]
      this.emit(Op.OP_EQUALVERIFY, loc); // [..., (dyn_expected)]

      // --- clean up body-local temporaries ((dyn_expected)) back to the snapshot depth ---
      this.removeScopedVariables(stackDepth, node);

      // --- increment counter i (in place) ---
      this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_i)'))), loc);
      this.emit(Op.OP_PICK, loc);
      this.emit(Op.OP_1ADD, loc);
      this.emitReplace(this.getStackIndex('(dyn_i)') + 1, node);
      this.popFromStack(); // pop the picked+incremented value after replace

      // continue loop (push false)
      this.emit(encodeBool(false), loc);
      this.pushToStack('(dyn_loop_continue)');

      this.emit(Op.OP_ELSE, loc);
      // exit loop: reset tracker to pre-body snapshot, push true
      this.stack = [...stackBeforeBody];
      this.emit(encodeBool(true), loc);
      this.pushToStack('(dyn_loop_exit)');

      this.emit(Op.OP_ENDIF, loc);
      this.emit(Op.OP_UNTIL, loc);
      this.popFromStack(); // pop loop result
      this.scopeDepth -= 1;

      // Orphan-bound: exactly nNew outputs carry the chunk address (no extra/duplicate chunk outputs that
      // would corrupt a future read). Old-chunk consumption: all old chunks (ceil(oldLen/CHUNK)) are
      // co-spent as inputs, so a shrink/replace leaves no stale chunk behind.
      this.emitVerifyChunkUtxoCount('(dyn_nnew)', true, loc);
      this.emitDynamicOldChunkConsumption(sv, loc);

      // --- post-loop cleanup: remove loop temps (top-down keeps indices valid). The value is kept on the
      // stack (recorded below) so vars declared after this one can read its chunk count for their offset. ---
      writtenValueStackNames.push(valueStackName);
      for (const tmp of ['(dyn_i)', '(dyn_nnew)', '(dyn_chunkaddr)', ...wPriorTempNames]) {
        const idx = this.getStackIndex(tmp);
        this.emit(encodeInt(BigInt(idx)), loc);
        this.emit(Op.OP_ROLL, loc);
        this.emit(Op.OP_DROP, loc);
        this.removeFromStack(idx);
      }
    }
    // --- final cleanup: drop the deferred written-var values + the foreign-read count temps ---
    for (const tmp of [...writtenValueStackNames, ...fReadTempNames]) {
      // A value marked for an array-external-call co-spend is kept on the stack and dropped by
      // emitExternalCallVerification after the co-spend loop reads the array from it.
      if (this.coSpendPreservedDynValues.has(tmp)) continue;
      const idx = this.getStackIndex(tmp);
      this.emit(encodeInt(BigInt(idx)), loc);
      this.emit(Op.OP_ROLL, loc);
      this.emit(Op.OP_DROP, loc);
      this.removeFromStack(idx);
    }
  }

  /**
   * The physical data-NFT field type for skip/decode/encode. A dynamic var (string / unbounded bytes /
   * chunk-packed array) stores only a uint32 A$len header in the commitment, NOT a value of its declared
   * type. Using the declared type to skip/decode a dynamic field mis-parses the header (e.g. a `uint256[]`
   * would decode a phantom count*width array). Always use this.
   */
  private physicalFieldType(field: { type: Type; isDynamic?: boolean }): Type {
    return field.isDynamic ? new IntType(false, 32) : field.type;
  }

  /**
   * Push a dynamic var's current VALUE (tight bytes, no array count prefix) as '(value)'. Read-after-write
   * returns the new value still on the stack (e.g. `this.s = v; require(this.s == v)`); otherwise co-spends
   * the persisted chunks and reassembles via the read loop, recording the read so the SDK adds the chunk
   * inputs. Phase 1: the read loop uses the fixed offset blockSize+i, so it cannot coexist with a collection
   * iteration or a second distinct dynamic read (reading the same var again is fine).
   */
  private emitReadDynamicScalar(sv: StateVariableNode, loc: SingleLocationData): void {
    const pending = this.pendingDynamicWrites.get(sv.name);
    if (pending) {
      this.emit(encodeInt(BigInt(this.getStackIndex(pending.valueStackName))), loc);
      this.emit(Op.OP_PICK, loc);
      this.pushToStack('(value)');
      return;
    }
    const reads = (this.currentFunction.dynamicReads ??= []);
    if (!reads.includes(sv.name)) reads.push(sv.name);
    this.emitDynamicReadLoop(sv, loc);
  }

  /** Read a dynamic var's uint32 A$len header from its data NFT INPUT commitment; push as `trackName`. */
  private emitReadDynamicLen(sv: StateVariableNode, trackName: string, loc: SingleLocationData): void {
    const fieldsInNft = this.stateVariables
      .filter((v) => v.nftIndex === sv.nftIndex)
      .sort((a, b) => a.fieldIndex - b.fieldIndex);
    this.emitMasterInputIndex(loc);
    this.emit(encodeInt(BigInt(this.compactOffsetMap.get(sv.nftIndex)!)), loc);
    this.emit(Op.OP_ADD, loc);
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, loc);
    if (this.isMultiDataNft()) this.emitNftIndexTagVerify(sv.nftIndex, loc); // H1 anti-substitution
    for (let i = 0; i < sv.fieldIndex; i++) this.emitPushdataSkip(this.physicalFieldType(fieldsInNft[i]), loc);
    if (sv.fieldIndex === fieldsInNft[fieldsInNft.length - 1].fieldIndex) {
      this.emitPushdataDecodeLastField(new IntType(false, 32), loc);
    } else {
      this.emitPushdataDecode(new IntType(false, 32), loc);
      this.emit(Op.OP_DROP, loc);
    }
    this.pushToStack(trackName);
  }

  /**
   * Verify the number of tx inputs/outputs whose locking bytecode == '(dyn_chunkaddr)' equals the int at
   * `expectedCountName`. Output side = orphan-bound (no extra/duplicate chunk outputs); input side =
   * old-chunk consumption. Scans all inputs/outputs (mirrors emitMintingNftUniqueness).
   */
  private emitVerifyChunkUtxoCount(
    expectedCountName: string, isOutput: boolean, loc: SingleLocationData, addrName: string = '(dyn_chunkaddr)',
  ): void {
    const countOp = isOutput ? Op.OP_TXOUTPUTCOUNT : Op.OP_TXINPUTCOUNT;
    const bytecodeOp = isOutput ? Op.OP_OUTPUTBYTECODE : Op.OP_UTXOBYTECODE;

    this.emit(encodeInt(0n), loc);
    this.pushToStack('(chunk_scan_count)');
    this.emit(countOp, loc);
    this.emit(Op.OP_1SUB, loc);
    this.pushToStack('(chunk_scan_i)');

    this.scopeDepth += 1;
    this.emit(Op.OP_BEGIN, loc);
    this.emit(Op.OP_DUP, loc);
    this.emit(encodeInt(0n), loc);
    this.emit(Op.OP_LESSTHAN, loc);
    this.emit(Op.OP_IF, loc);
    this.emit(Op.OP_DROP, loc);
    this.emit(encodeBool(true), loc);
    this.emit(Op.OP_ELSE, loc);
    this.emit(Op.OP_DUP, loc); // copy index
    this.emit(bytecodeOp, loc); // utxo/output[i] locking bytecode
    this.emit(encodeInt(BigInt(this.getStackIndex(addrName) + 1)), loc); // +1: lbc untracked
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_EQUAL, loc);
    this.emit(Op.OP_IF, loc);
    this.emit(Op.OP_SWAP, loc); // bring count up, increment, swap back
    this.emit(Op.OP_1ADD, loc);
    this.emit(Op.OP_SWAP, loc);
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_1SUB, loc); // index--
    this.emit(encodeBool(false), loc);
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_UNTIL, loc);
    this.popFromStack(); // (chunk_scan_i) consumed by the exit-branch DROP
    this.scopeDepth -= 1;

    this.emit(encodeInt(BigInt(this.getStackIndex('(chunk_scan_count)'))), loc);
    this.emit(Op.OP_PICK, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex(expectedCountName) + 1)), loc); // +1: count copy
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_EQUALVERIFY, loc);

    const idx = this.getStackIndex('(chunk_scan_count)');
    this.emit(encodeInt(BigInt(idx)), loc);
    this.emit(Op.OP_ROLL, loc);
    this.emit(Op.OP_DROP, loc);
    this.removeFromStack(idx);
  }

  /** Force every old chunk to be co-spent: ceil(oldLen/CHUNK) inputs carry the chunk address. */
  private emitDynamicOldChunkConsumption(sv: StateVariableNode, loc: SingleLocationData): void {
    const CHUNK = 120;
    this.emitReadDynamicLen(sv, '(dyn_oldnnew)', loc); // oldLen
    this.emit(encodeInt(BigInt(CHUNK - 1)), loc);
    this.emit(Op.OP_ADD, loc);
    this.emit(encodeInt(BigInt(CHUNK)), loc);
    this.emit(Op.OP_DIV, loc); // (dyn_oldnnew) = ceil(oldLen/CHUNK)
    this.emitVerifyChunkUtxoCount('(dyn_oldnnew)', false, loc);
    const idx = this.getStackIndex('(dyn_oldnnew)');
    this.emit(encodeInt(BigInt(idx)), loc);
    this.emit(Op.OP_ROLL, loc);
    this.emit(Op.OP_DROP, loc);
    this.removeFromStack(idx);
  }

  // Reframe a just-read dynamic-storage value into the canonical array form the element ops expect. For a
  // fixed-width element type the stored blob is tight, so prepend count = A$len/width; for a variable-width
  // element type the count prefix is stored, so only canonicalize an empty (A$len=0) read to pushdata(0).
  // No-op for non-array dynamic vars (string / unbounded bytes keep their raw value).
  private emitReframeDynamicArrayRead(sv: StateVariableNode, loc: SingleLocationData): void {
    if (!(sv.type instanceof ArrayType)) return;
    const elemType = sv.type.elementType;
    if (isFixedWidthType(elemType)) this.emitPrependArrayCount(getFixedWidth(elemType), loc);
    else this.emitCanonicalizeEmptyArrayBlob(loc);
  }

  // If the top-of-stack blob is empty, replace it with pushdata(0) (a single 0x00 = count-0 prefix). Used on
  // the variable-width dynamic read path so an empty array decodes as count=0. Stack-neutral (leaves the blob).
  private emitCanonicalizeEmptyArrayBlob(loc: SingleLocationData): void {
    this.emit(Op.OP_SIZE, loc); // [blob, size] - size is a small number, safe to test
    this.pushToStack('(dynsz)');
    this.emit(Op.OP_0NOTEQUAL, loc);
    this.emit(Op.OP_IF, loc);
    this.popFromStack();
    this.emit(Op.OP_ELSE, loc);
    this.emit(Op.OP_DROP, loc); // drop the empty blob
    this.emit(new Uint8Array([0x00]), loc); // pushdata(count=0)
    this.emit(Op.OP_ENDIF, loc);
  }

  /**
   * Rebuild a chunk-packed array's on-stack form `pushdata(count) ++ tight_blob` from the tight element blob
   * on top of the stack (count = OP_SIZE(blob) / elementWidth). Leaves '(value)'. Inverse of the count-prefix
   * strip in the array write path. See docs/arrays.md.
   */
  private emitPrependArrayCount(width: number, loc: SingleLocationData): void {
    this.emit(Op.OP_DUP, loc); // [blob, blobcopy]
    this.pushToStack('(arrcnt)');
    this.emit(Op.OP_SIZE, loc); // [blob, blobcopy, size]
    this.emit(Op.OP_NIP, loc); // [blob, size]  '(arrcnt)' = size
    this.emit(encodeInt(BigInt(width)), loc);
    this.emit(Op.OP_DIV, loc); // [blob, count]  '(arrcnt)' = count
    this.emitPushdataEncode(PrimitiveType.BIGINT, loc); // [blob, pushdata(count)]
    this.stack[0] = '(arrcnt)';
    this.emit(Op.OP_SWAP, loc); // [pushdata(count), blob]
    [this.stack[0], this.stack[1]] = [this.stack[1], this.stack[0]];
    this.emit(Op.OP_CAT, loc); // [pushdata(count) ++ blob]
    this.popFromStack();
    this.stack[0] = '(value)';
  }

  /**
   * Read a persisted dynamic-storage var (string / unbounded bytes) on-chain. Reads the uint32 A$len header,
   * then loops over the var's co-spent chunk INPUTS (trailing, at OP_INPUTINDEX + blockSize + i), verifying
   * each is a genuine chunk (address + chunkIndex == i) and OP_CATing its data onto an accumulator;
   * truncates to A$len. Leaves '(value)'. Loop mirrors visitCollectionIteration (runtime-stack-neutral).
   * The SDK positions + preserves the chunk inputs; on-chain preservation enforcement is deferred
   * (permissionless-hardening, like the write orphan-bound). Phase 1: one dynamic read per function, no
   * coexisting collection iteration.
   */
  private emitDynamicReadLoop(sv: StateVariableNode, loc: SingleLocationData): void {
    const CHUNK = 120;
    const lenType = new IntType(false, 32);
    const chunkHash = computeCollectionHash(computeCollectionSignature(sv.name, sv.type.toString()));
    const blockSize = this.currentFunction.blockLayout?.blockSize ?? 1;
    // Persisted dynamic reads share the trailing-input space: read var R's chunks live at
    // blockSize + sum(chunk counts of the read vars before R) + i. priorNodes = those earlier read vars,
    // in the same dynamicReads order the SDK co-spends them.
    const reads = this.currentFunction.dynamicReads ?? [];
    const selfIdx = reads.indexOf(sv.name);
    const priorNodes = (selfIdx > 0 ? reads.slice(0, selfIdx) : [])
      .map((n) => this.stateVariables.find((v) => v.name === n)!);
    const fieldsInNft = this.stateVariables
      .filter((v) => v.nftIndex === sv.nftIndex)
      .sort((a, b) => a.fieldIndex - b.fieldIndex);

    // --- A$len (uint32 field) -> '(dyn_rlen)' ---
    this.emitMasterInputIndex(loc);
    this.emit(encodeInt(BigInt(this.compactOffsetMap.get(sv.nftIndex)!)), loc);
    this.emit(Op.OP_ADD, loc);
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, loc);
    if (this.isMultiDataNft()) this.emitNftIndexTagVerify(sv.nftIndex, loc); // H1 anti-substitution
    for (let i = 0; i < sv.fieldIndex; i++) this.emitPushdataSkip(this.physicalFieldType(fieldsInNft[i]), loc);
    if (sv.fieldIndex === fieldsInNft[fieldsInNft.length - 1].fieldIndex) {
      this.emitPushdataDecodeLastField(lenType, loc);
    } else {
      this.emitPushdataDecode(lenType, loc);
      this.emit(Op.OP_DROP, loc);
    }
    this.pushToStack('(dyn_rlen)');

    // --- chunk address '(dyn_rchunkaddr)' ---
    this.emitMasterInputIndex(loc);
    this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_DROP, loc);
    this.pushToStack('(dyn_rchunkaddr)');
    this.emitP2sh32FromCovenant((cat) => buildEntryNftCovenantScript(cat, chunkHash), loc);
    this.stack[0] = '(dyn_rchunkaddr)';

    // --- prior read-var chunk counts as loop-invariant temps: ceil(len_v/CHUNK) per earlier read var, so
    // this loop reads at blockSize + sum(prior counts) + i. Empty list for the first/only read (no temps,
    // bytecode identical to single-read). ---
    const priorTempNames: string[] = [];
    for (let k = 0; k < priorNodes.length; k++) {
      this.emitReadDynamicLen(priorNodes[k], `(dyn_rprior_${k})`, loc); // len_v, tracked
      this.emit(encodeInt(BigInt(CHUNK - 1)), loc);
      this.emit(Op.OP_ADD, loc);
      this.emit(encodeInt(BigInt(CHUNK)), loc);
      this.emit(Op.OP_DIV, loc); // ceil(len_v/CHUNK); top stays tracked as (dyn_rprior_k)
      priorTempNames.push(`(dyn_rprior_${k})`);
    }

    // --- count = ceil(len/CHUNK) '(dyn_rcount)', accumulator '(dyn_racc)', counter '(dyn_ri)' ---
    this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_rlen)'))), loc);
    this.emit(Op.OP_PICK, loc);
    this.pushToStack('(dyn_rcount)');
    this.emit(encodeInt(BigInt(CHUNK - 1)), loc);
    this.emit(Op.OP_ADD, loc);
    this.emit(encodeInt(BigInt(CHUNK)), loc);
    this.emit(Op.OP_DIV, loc);
    this.emit(encodeInt(0n), loc); // empty accumulator
    this.pushToStack('(dyn_racc)');
    this.emit(encodeInt(0n), loc);
    this.pushToStack('(dyn_ri)');

    // LOOP: OP_BEGIN / cond(i<count) / OP_IF / read+verify+accumulate chunk i / incr / ... / OP_UNTIL
    this.scopeDepth += 1;
    this.emit(Op.OP_BEGIN, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_ri)'))), loc);
    this.emit(Op.OP_PICK, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_rcount)') + 1)), loc);
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_LESSTHAN, loc);
    this.emit(Op.OP_IF, loc);

    const stackBeforeBody = [...this.stack];
    const stackDepth = this.stack.length;

    // inputIdx = masterInputIndex + blockSize + sum(collection-iter counts) + sum(prior read counts) + i
    this.emitMasterInputIndex(loc);
    this.emit(encodeInt(BigInt(blockSize)), loc);
    this.emit(Op.OP_ADD, loc);
    this.emitAddCollectionIterCounts(loc); // collection-iter entries precede read chunks (W4)
    for (const pt of priorTempNames) {
      this.emit(encodeInt(BigInt(this.getStackIndex(pt) + 1)), loc); // +1: running inputIdx-partial untracked
      this.emit(Op.OP_PICK, loc);
      this.emit(Op.OP_ADD, loc);
    }
    this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_ri)') + 1)), loc); // +1: inputIdx-partial untracked
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_ADD, loc);
    // (a) input bytecode == chunk address
    this.emit(Op.OP_DUP, loc);
    this.emit(Op.OP_UTXOBYTECODE, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_rchunkaddr)') + 2)), loc); // +2: inputIdx, bytecode
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_EQUALVERIFY, loc);
    // (b) category base == master + mutable
    this.emit(Op.OP_DUP, loc);
    this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
    this.emit(Op.OP_DUP, loc);
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_NIP, loc);
    this.emit(new Uint8Array([0x01]), loc);
    this.emit(Op.OP_EQUALVERIFY, loc);
    this.emitVerifyCatBaseEqMaster(loc); // consumes cat -> [..., inputIdx]
    // (c) commitment -> chunkIndex (== i) ++ chunkData
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, loc); // [..., commitment]
    this.emitPushdataDecode(lenType, loc); // [..., chunkIndex, remainder]
    this.emit(Op.OP_SWAP, loc); // [..., remainder, chunkIndex]
    this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_ri)') + 2)), loc); // +2: remainder, chunkIndex
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_EQUALVERIFY, loc); // [..., remainder]
    this.emitPushdataDecodeLastField(new BytesType(), loc); // [..., chunkData]
    // accumulator ++= chunkData (in place; emitReplace consumes the untracked result, tracker unchanged)
    this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_racc)') + 1)), loc); // +1: chunkData on top
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_SWAP, loc);
    this.emit(Op.OP_CAT, loc);
    this.emitReplace(this.getStackIndex('(dyn_racc)') + 1, this.currentFunction);

    this.removeScopedVariables(stackDepth, this.currentFunction);

    // increment i (in place)
    this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_ri)'))), loc);
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_1ADD, loc);
    this.emitReplace(this.getStackIndex('(dyn_ri)') + 1, this.currentFunction);
    this.popFromStack();

    this.emit(encodeBool(false), loc);
    this.pushToStack('(dyn_rloop_continue)');
    this.emit(Op.OP_ELSE, loc);
    this.stack = [...stackBeforeBody];
    this.emit(encodeBool(true), loc);
    this.pushToStack('(dyn_rloop_exit)');
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_UNTIL, loc);
    this.popFromStack();
    this.scopeDepth -= 1;

    // truncate accumulator to A$len (also asserts size >= A$len), in place
    this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_racc)'))), loc);
    this.emit(Op.OP_PICK, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex('(dyn_rlen)') + 1)), loc); // +1: acc copy on top
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_DROP, loc);
    this.emitReplace(this.getStackIndex('(dyn_racc)') + 1, this.currentFunction);

    // clean up temps, leaving '(dyn_racc)' (the value) on top; rename it
    for (const tmp of ['(dyn_ri)', '(dyn_rcount)', '(dyn_rchunkaddr)', '(dyn_rlen)', ...priorTempNames]) {
      const idx = this.getStackIndex(tmp);
      this.emit(encodeInt(BigInt(idx)), loc);
      this.emit(Op.OP_ROLL, loc);
      this.emit(Op.OP_DROP, loc);
      this.removeFromStack(idx);
    }
    this.stack[this.getStackIndex('(dyn_racc)')] = '(value)';
  }

  /**
   * Emit covenant verification for transfer outputs.
   * For each pending transfer:
   * 1. Verify output locking bytecode at block layout transfer offset matches expected
   * 2. Verify output value at block layout transfer offset matches expected
   * 3. Verify output has no tokens (OP_OUTPUTTOKENCATEGORY == empty)
   */
  private emitTransferCovenantVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };

    for (const transfer of this.pendingTransfers) {
      const { transferIndex, lockingBytecodeStackName, amountStackName } = transfer;
      const isConditional = this.conditionalTransferIndices.has(transferIndex);

      // For conditional transfers, check if the LBC slot is non-empty (active)
      if (isConditional) {
        const checkIdx = this.getStackIndex(lockingBytecodeStackName);
        this.emit(encodeInt(BigInt(checkIdx)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.pushToStack('(cond_check)');
        this.emit(Op.OP_IF, locationData);
        this.popFromStack();
      }

      // 1. Verify output locking bytecode
      const lbIdx = this.getStackIndex(lockingBytecodeStackName);
      this.emit(encodeInt(BigInt(lbIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');

      // Compute output index: transfer block slot + transferIndex
      this.emitBlockSlotIndex('transfer', transferIndex, locationData);
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      // 2. Verify output value
      const amtIdx = this.getStackIndex(amountStackName);
      this.emit(encodeInt(BigInt(amtIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');

      this.emitBlockSlotIndex('transfer', transferIndex, locationData);
      this.emit(Op.OP_OUTPUTVALUE, locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      // 3. Verify no tokens on transfer output (empty token category)
      this.emitBlockSlotIndex('transfer', transferIndex, locationData);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      this.pushToStack('(value)');
      this.emit(encodeInt(0n), locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      if (isConditional) {
        this.emit(Op.OP_ENDIF, locationData);
      }
    }

    // Note: cleanup deferred to emitTransferCleanup() (called after emitValuePreservation)
  }

  /**
   * Clean up pending transfer values from the stack.
   * Called after emitValuePreservation so conditional transfer LBC values
   * are still available for activity checks during value preservation.
   */
  private emitTransferCleanup(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };
    for (const transfer of this.pendingTransfers) {
      const lbIdx = this.getStackIndex(transfer.lockingBytecodeStackName);
      this.emit(encodeInt(BigInt(lbIdx)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.removeFromStack(lbIdx);

      const amtIdx = this.getStackIndex(transfer.amountStackName);
      this.emit(encodeInt(BigInt(amtIdx)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.removeFromStack(amtIdx);
    }
  }

  /**
   * Emit data NFT P2SH32 locking bytecode from category on top of stack.
   * Mirrors buildDataNftCovenantScript from state.ts.
   *
   * Stack before: [..., category(32B)]
   * Stack after:  [..., p2sh32_lbc(35B)]
   *
   * The data NFT covenant script has 4 category embeddings:
   * segment0 + 0x20 + cat + segment1 + 0x20 + cat + segment2 + 0x20 + cat + segment3 + 0x20 + cat + segment4
   */
  private emitDataNftLbc(locationData: SingleLocationData): void {
    // Auto-derived from buildDataNftCovenantScript so this mirror can never drift from state.ts.
    this.emitP2sh32FromCovenant(buildDataNftCovenantScript, locationData);
  }

  /**
   * Reconstruct a category-parameterized sub-NFT P2SH32 locking bytecode in-script from the category
   * (32B, internal order) on top of the stack. The covenant's constant bytes are auto-derived from its
   * builder by splitting on a unique 32-byte category placeholder, so the reconstruction matches the
   * off-chain covenant byte-for-byte (the "5 pairs must match" lockstep becomes mechanical).
   * Stack before: [category]; after: [p2sh32_lbc].
   */
  private emitP2sh32FromCovenant(
    buildCovenant: (categoryId: Uint8Array) => Script, locationData: SingleLocationData,
  ): void {
    const placeholder = Uint8Array.from({ length: 32 }, (_v, i) => i); // 00 01 .. 1f (display order)
    const covenant = scriptToBytecode(buildCovenant(placeholder));
    // The covenant stores the category in internal (reversed) order, pushed as 0x20 || cat.
    const delim = Uint8Array.from([0x20, ...placeholder.slice().reverse()]);
    const segments = splitOnDelimiter(covenant, delim);

    // enc = 0x20 || category (runtime), then body = seg0 ++ enc ++ seg1 ++ enc ++ ... ++ segN
    this.emit(hexToBin('20'), locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_CAT, locationData);          // [enc]
    this.emit(segments[0], locationData);        // [enc, body]
    for (let i = 1; i < segments.length; i++) {
      this.emit(Op.OP_OVER, locationData);       // [enc, body, enc]
      this.emit(Op.OP_CAT, locationData);        // [enc, body||enc]
      if (segments[i].length > 0) {
        this.emit(segments[i], locationData);    // [enc, body||enc, seg_i]
        this.emit(Op.OP_CAT, locationData);      // [enc, body||enc||seg_i]
      }
    }
    this.emit(Op.OP_NIP, locationData);          // [body] (drop enc)

    // Hash and wrap as P2SH32
    this.emit(Op.OP_HASH256, locationData);
    this.emit(P2SH32_LBC_PREFIX, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_CAT, locationData);
    this.emit(P2SH32_LBC_SUFFIX, locationData);
    this.emit(Op.OP_CAT, locationData);          // [p2sh32_lbc]

    // Stack tracking: category consumed, p2sh32_lbc produced
    this.popFromStack();
    this.pushToStack('(value)');
  }

  /**
   * Inline genesis verification for a conditional (branch) or loop deploy. Runs the same master + data-NFT
   * checks as emitDeployCovenantVerification, but INLINE at the `new C()` site (so it executes iff/each-time the
   * `new C()` runs) and reads the child master-LBC from the top of stack (freshly computed by steps 1-3) + the
   * category from the genesis input, rather than from epilogue-pushed slots.
   *
   * `useCounter` false (single branch deploy): a single conditional deploy lands at the same FIXED deploy slot
   * as an unconditional one when it fires (deploy is the trailing output region) - byte-identical to the
   * verified branch path.
   *
   * `useCounter` true (loop deploy): the deploy count is runtime-variable, so the genesis input/output indices
   * are offset by a runtime deploy counter (`this.inlineDeployCounterName`, deploys-fired-so-far): input =
   * masterInputIndex + inputBase + counter; master output = masterInputIndex + slotBase + counter*stride
   * (stride = 1 + dataNftCount); the counter is incremented after each verification. The counter is a stack var
   * initialized to 0 before the enclosing loop's OP_BEGIN and dropped after OP_UNTIL.
   */
  private emitInlineDeployVerification(
    node: InstantiationNode, locationData: SingleLocationData, useCounter = false,
  ): void {
    const slotBase = this.getBlockSlotOffset('deploy', 0);
    const inputBase = slotBase - this.countOutputOnlySlotsBefore(slotBase);
    const dataNftCount = node.deployedDataNftCount;
    // A LOOP `new C{value:}()` interleaves its value transfer as the LAST output of each child's group (there is
    // no fixed transfer slot for a runtime-variable count), so the per-child stride grows by 1.
    const loopValueTransfer = useCounter && !!node.callOptions?.value;
    const stride = 1 + dataNftCount + (loopValueTransfer ? 1 : 0);
    const counterName = this.inlineDeployCounterName;

    // Child master-LBC is on top (p2sh32 lbc from steps 1-3). Name it so PICK/cleanup find it.
    const masterLbcName = `__ideploy_lbc_${this.deployCounter}`;
    const categoryName = `__ideploy_cat_${this.deployCounter}`;
    this.deployCounter += 1;
    this.popFromStack();
    this.pushToStack(masterLbcName);

    // PICK the runtime deploy counter when exactly `untracked` extra (untracked) values sit on the real stack
    // above the tracked model - the index/arithmetic values pushed by emitMasterInputIndex + offset add.
    const pickCounter = (untracked: number): void => {
      this.emit(encodeInt(BigInt(this.getStackIndex(counterName) + untracked)), locationData);
      this.emit(Op.OP_PICK, locationData);
    };

    // Child category = the genesis funding input's txhash (its vout must be 0). Input index = masterInputIndex
    // + inputBase [+ counter].
    this.emitMasterInputIndex(locationData);
    if (inputBase > 0) {
      this.emit(encodeInt(BigInt(inputBase)), locationData);
      this.emit(Op.OP_ADD, locationData);
    }
    if (useCounter) {
      // exactly one untracked value (the base input index) is on the real stack from emitMasterInputIndex
      // [+ add], so PICK the counter one deeper.
      pickCounter(1);
      this.emit(Op.OP_ADD, locationData);
    }
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_OUTPOINTINDEX, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.emit(Op.OP_OUTPOINTTXHASH, locationData);
    this.pushToStack(categoryName);

    // Push the genesis OUTPUT index for master (extra 0) or data NFT j (extra 1+j): masterInputIndex + slotBase
    // + extra [+ counter*stride]. Pushes 1 untracked value (the caller's next emit consumes it).
    const emitOutIndex = (extra: number): void => {
      this.emitMasterInputIndex(locationData);
      const off = slotBase + extra;
      if (off > 0) {
        this.emit(encodeInt(BigInt(off)), locationData);
        this.emit(Op.OP_ADD, locationData);
      }
      if (useCounter) {
        // one untracked value (the base index) is on the real stack from the add above (or from masterInputIndex
        // when off == 0), so PICK the counter one deeper.
        pickCounter(1);
        this.emit(encodeInt(BigInt(stride)), locationData);
        this.emit(Op.OP_MUL, locationData);
        this.emit(Op.OP_ADD, locationData);
      }
    };

    // --- master NFT output: locking bytecode == child p2sh32 lbc ---
    this.emit(encodeInt(BigInt(this.getStackIndex(masterLbcName))), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.pushToStack('(value)');
    emitOutIndex(0);
    this.emit(Op.OP_OUTPUTBYTECODE, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);

    // --- master NFT output: token category == childCategory || 0x02 (minting) ---
    this.emit(encodeInt(BigInt(this.getStackIndex(categoryName))), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.pushToStack('(value)');
    this.emit(new Uint8Array([0x02]), locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_CAT, locationData);
    this.popFromStack(2);
    this.pushToStack('(value)');
    emitOutIndex(0);
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);

    // --- data NFT outputs at slotBase + 1..dataNftCount ---
    for (let nftIdx = 0; nftIdx < dataNftCount; nftIdx++) {
      const extra = 1 + nftIdx;

      // locking bytecode == data NFT p2sh32 lbc (from child category)
      this.emit(encodeInt(BigInt(this.getStackIndex(categoryName))), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');
      this.emitDataNftLbc(locationData);
      emitOutIndex(extra);
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      // token category == childCategory || 0x01 (mutable)
      this.emit(encodeInt(BigInt(this.getStackIndex(categoryName))), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');
      this.emit(new Uint8Array([0x01]), locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      emitOutIndex(extra);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      // output commitment == default state commitment for this NFT (mirrors the epilogue's inline build)
      const fieldsInNft = node.deployedStateVars
        .filter((sv) => sv.nftIndex === nftIdx)
        .sort((a, b) => a.fieldIndex - b.fieldIndex);
      const savedStack = [...this.stack];
      let firstField = true;
      if (dataNftCount > 1) {
        this.emit(encodeNftIndexTag(nftIdx), locationData);
        this.pushToStack('(value)');
        firstField = false;
      }
      for (const field of fieldsInNft) {
        const foldedExpr = node.foldedStateInit?.get(field.name);
        if (foldedExpr) {
          this.scopeDepth += 1;
          this.visit(foldedExpr);
          this.scopeDepth -= 1;
        } else {
          this.emitDefaultValue(locationData, field.type);
          this.pushToStack('(value)');
        }
        this.emitPushdataEncode(field.type, locationData);
        if (!firstField) {
          this.emit(Op.OP_CAT, locationData);
          this.popFromStack();
        }
        firstField = false;
      }
      this.stack = savedStack;
      this.pushToStack('(value)');
      emitOutIndex(extra);
      this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);
    }

    // Loop {value:}: verify the interleaved value transfer - the LAST output of this child's group (slot
    // 1 + dataNftCount): its locking bytecode == the child address, its value == the {value:} amount. The
    // satoshi container that sources it is verified conserved (input <= output + counter*value) after OP_UNTIL.
    if (loopValueTransfer) {
      const extra = 1 + dataNftCount;
      this.emit(encodeInt(BigInt(this.getStackIndex(masterLbcName))), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');
      emitOutIndex(extra);
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);
      emitOutIndex(extra);
      this.emit(Op.OP_OUTPUTVALUE, locationData);
      this.pushToStack('(value)');
      node.callOptions!.value = this.visit(node.callOptions!.value!);
      this.emit(Op.OP_NUMEQUALVERIFY, locationData);
      this.popFromStack(2);
      // Stash V so the loop visitor can conserve the satoshi container (input <= output + counter*V) after the loop.
      this.loopValueTransferNode = node.callOptions!.value;
    }

    // Loop deploy: increment the runtime deploy counter (deploys-fired-so-far) in place, so the next iteration's
    // genesis lands at the next slot. Mirrors the in-place stack-var update in visitDeleteLocal.
    if (useCounter) {
      this.emit(encodeInt(BigInt(this.getStackIndex(counterName))), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');
      this.emit(encodeInt(1n), locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_ADD, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emitReplace(this.getStackIndex(counterName), node);
      this.popFromStack();
    }

    // Cleanup: drop the category (on top); the child master-LBC beneath is the `new C()` result.
    this.emit(Op.OP_DROP, locationData);
    this.popFromStack();
    this.popFromStack();
    this.pushToStack('(value)');
  }

  /**
   * Fill the value transfer for a `new C{value: x}()` INSIDE a branch. The child master-LBC (the `new C()`
   * result) is on top; the transfer's lockingBytecode = that child address, amount = x. branchOps counts the
   * deploy as a value transfer, so visitBranch pre-allocated the transfer's lb/amount dummy slots (kept
   * conditional via the min/max path model) - fill them in place like visitTransferStatement's pre-allocated
   * path. The satoshi container that sources it is co-spent + preserved by the normal transfer epilogue. Leaves
   * the child master-LBC on top as the expression result.
   */
  private emitInlineDeployValueTransfer(node: InstantiationNode, locationData: SingleLocationData): void {
    if (!this.preAllocatedTransfers.has(node.transferIndex)) {
      // A branch {value:} deploy is always pre-allocated (branchOps counts it); guard defensively.
      throw new ConditionalDeployError(node);
    }
    const lbName = `__internal__transfer_lb_${node.transferIndex}`;
    const amtName = `__internal__transfer_amt_${node.transferIndex}`;
    // lockingBytecode = the child address (DUP the result so it stays on top for the caller).
    this.emit(Op.OP_DUP, locationData);
    this.pushToStack('(value)');
    this.emitReplace(this.getStackIndex(lbName), node);
    this.popFromStack();
    // amount = the {value:} expression.
    node.callOptions!.value = this.visit(node.callOptions!.value!);
    this.emitReplace(this.getStackIndex(amtName), node);
    this.popFromStack();
  }

  /**
   * Emit covenant verification for stateful contract deployment outputs.
   * For each pending deploy:
   * 1. Verify master NFT output: correct P2SH32 LBC, minting capability, child category
   * 2. Verify data NFT outputs: correct P2SH32 LBC, mutable capability, child category,
   *    default state commitments
   */
  private emitDeployCovenantVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };

    for (const deploy of this.pendingDeploys) {
      const { deployIndex, masterLbcStackName, categoryStackName } = deploy;
      const deployNode = deploy.node;
      const dataNftCount = deployNode.deployedDataNftCount;

      // --- a. Master NFT output at block layout deploy offset ---
      // Cumulative offset accounts for heterogeneous deploys with different dataNftCount values
      let deployOffset = 0;
      for (let i = 0; i < deployIndex; i++) {
        deployOffset += 1 + this.pendingDeploys[i].node.deployedDataNftCount;
      }

      // Verify master output locking bytecode
      const masterLbIdx = this.getStackIndex(masterLbcStackName);
      this.emit(encodeInt(BigInt(masterLbIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');

      // Compute output index from block layout deploy slot offset
      this.emitMasterInputIndex(locationData);
      this.emit(encodeInt(BigInt(this.getBlockSlotOffset('deploy', 0) + deployOffset)), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      // Verify master output token category == childCategoryId || 0x02 (minting capability)
      const catIdx = this.getStackIndex(categoryStackName);
      this.emit(encodeInt(BigInt(catIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');
      this.emit(new Uint8Array([0x02]), locationData);  // minting capability byte
      this.pushToStack('(value)');
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');

      // Get actual output token category
      this.emitMasterInputIndex(locationData);
      this.emit(encodeInt(BigInt(this.getBlockSlotOffset('deploy', 0) + deployOffset)), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      // --- b. Data NFT outputs at block layout deploy offset + 1..dataNftCount ---
      for (let nftIdx = 0; nftIdx < dataNftCount; nftIdx++) {
        const nftOutputOffset = deployOffset + 1 + nftIdx;

        // Compute data NFT P2SH32 locking bytecode from child category
        const catIdx3 = this.getStackIndex(categoryStackName);
        this.emit(encodeInt(BigInt(catIdx3)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.pushToStack('(value)');
        this.emitDataNftLbc(locationData);
        // Stack: [..., dataNftLbc]

        // Verify data NFT output locking bytecode
        this.emitMasterInputIndex(locationData);
        this.emit(encodeInt(BigInt(this.getBlockSlotOffset('deploy', 0) + nftOutputOffset)), locationData);
        this.emit(Op.OP_ADD, locationData);
        this.emit(Op.OP_OUTPUTBYTECODE, locationData);
        this.pushToStack('(value)');

        this.emit(Op.OP_EQUALVERIFY, locationData);
        this.popFromStack(2);

        // Verify data NFT token category == childCategoryId || 0x01 (mutable capability)
        const catIdx4 = this.getStackIndex(categoryStackName);
        this.emit(encodeInt(BigInt(catIdx4)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.pushToStack('(value)');
        this.emit(new Uint8Array([0x01]), locationData);  // mutable capability byte
        this.pushToStack('(value)');
        this.emit(Op.OP_CAT, locationData);
        this.popFromStack(2);
        this.pushToStack('(value)');

        this.emitMasterInputIndex(locationData);
        this.emit(encodeInt(BigInt(this.getBlockSlotOffset('deploy', 0) + nftOutputOffset)), locationData);
        this.emit(Op.OP_ADD, locationData);
        this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
        this.pushToStack('(value)');

        this.emit(Op.OP_EQUALVERIFY, locationData);
        this.popFromStack(2);

        // Verify data NFT output commitment == default state commitment for this NFT index
        // Build default commitment inline: encode default values for each state variable in this NFT
        const fieldsInNft = deployNode.deployedStateVars
          .filter((sv) => sv.nftIndex === nftIdx)
          .sort((a, b) => a.fieldIndex - b.fieldIndex);

        const savedStack = [...this.stack];
        let firstField = true;
        // Multi-data-NFT child: stamp the leading nftIndex tag so the genesis commitment matches the
        // child's own covenant (and the SDK's buildPushdataCommitment), both of which prepend + verify it
        // on every commitment. Keyed on the CHILD's NFT count, not the parent factory's (isMultiDataNft).
        if (dataNftCount > 1) {
          this.emit(encodeNftIndexTag(nftIdx), locationData);
          this.pushToStack('(value)');
          firstField = false;
        }
        for (const field of fieldsInNft) {
          // Deploy-then-call fold: a field set by a same-tx folded call takes its post-call value (the
          // parent-context arg expression) instead of the type default, so the child lands configured.
          const foldedExpr = deployNode.foldedStateInit?.get(field.name);
          if (foldedExpr) {
            // scopeDepth > 0 forces OP_PICK (a non-consuming copy) over OP_ROLL, so the param stays on
            // the stack for later fields + the savedStack restore. visit() tracks the picked value, which
            // emitPushdataEncode then consumes; keeping it tracked also makes a subsequent folded field's
            // pick depth account for this field's runtime push. The savedStack restore discards the rest.
            this.scopeDepth += 1;
            this.visit(foldedExpr);
            this.scopeDepth -= 1;
          } else {
            this.emitDefaultValue(locationData, field.type);
            // emitDefaultValue leaves its pushed value untracked; track it so a later folded field's pick
            // depth (and the nftIndex-tag CAT below) accounts for this field's runtime push. Model-only.
            this.pushToStack('(value)');
          }
          this.emitPushdataEncode(field.type, locationData);
          if (!firstField) {
            this.emit(Op.OP_CAT, locationData);
            this.popFromStack(); // CAT nets -1 on the stack; keep the model in step for later fold picks
          }
          firstField = false;
        }
        this.stack = savedStack;
        this.pushToStack('(value)');
        // Stack: [..., defaultCommitment]

        // Get actual output commitment
        this.emitMasterInputIndex(locationData);
        this.emit(encodeInt(BigInt(this.getBlockSlotOffset('deploy', 0) + nftOutputOffset)), locationData);
        this.emit(Op.OP_ADD, locationData);
        this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);
        this.pushToStack('(value)');

        this.emit(Op.OP_EQUALVERIFY, locationData);
        this.popFromStack(2);
      }
    }

    // Clean up deploy stack values
    for (const deploy of this.pendingDeploys) {
      const catIdx = this.getStackIndex(deploy.categoryStackName);
      this.emit(encodeInt(BigInt(catIdx)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.removeFromStack(catIdx);

      const lbIdx = this.getStackIndex(deploy.masterLbcStackName);
      this.emit(encodeInt(BigInt(lbIdx)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.removeFromStack(lbIdx);
    }
  }

  /**
   * Emit covenant verification for event NFT outputs.
   * For each pending emit:
   * 1. Verify output commitment matches the encoded event data
   * 2. Verify output locking bytecode is the expected event covenant P2SH32
   * 3. Verify output token category matches master's category (stripped)
   * Also emits master self-preservation if not already done by other covenant writes.
   */
  private emitEventCovenantVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };

    for (const pendingEmit of this.pendingEmits) {
      const { emitIndex, stackName, eventDef } = pendingEmit;
      const isConditionalEmit = this.conditionalEmitIndices.has(emitIndex);

      // For conditional emits, check if the blob slot is non-empty (active)
      if (isConditionalEmit) {
        const checkIdx = this.getStackIndex(stackName);
        this.emit(encodeInt(BigInt(checkIdx)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.pushToStack('(cond_check)');
        this.emit(Op.OP_IF, locationData);
        this.popFromStack();
      }

      // 1. Verify output commitment: block layout event offset OP_OUTPUTTOKENCOMMITMENT == encoded blob
      const blobIdx = this.getStackIndex(stackName);
      this.emit(encodeInt(BigInt(blobIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.pushToStack('(value)');

      // Compute output index: event block slot + emitIndex
      this.emitBlockSlotIndex('event', emitIndex, locationData);
      this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      // 2. Verify output locking bytecode is expected event covenant P2SH32
      // Build the expected covenant redeem script on-stack:
      // prefix: OP_INPUTINDEX OP_UTXOTOKENCATEGORY <32> OP_SPLIT OP_DROP
      // then push categoryId bytes (runtime from master's token category)
      // suffix: OP_EQUALVERIFY <eventNameHash> OP_DROP <144> OP_CSV OP_DROP OP_1

      // We construct the expected P2SH32 hash at runtime by getting the
      // master's category, building the full script, hashing, and wrapping in P2SH32.
      // This requires building the script bytes on-stack.

      // Get master's 32-byte categoryId from input
      this.emitMasterInputIndex(locationData);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData); // drop capability byte, keep 32-byte category
      this.pushToStack('(value)'); // categoryId on stack

      // Build the event covenant script bytes:
      // We build it as: prefix_bytes + <len><categoryId> + suffix_bytes
      // prefix = OP_INPUTINDEX(0xc0) OP_UTXOTOKENCATEGORY(0xce) <32>(0x0120) OP_SPLIT(0x7f) OP_SWAP(0x7c)
      const prefix = new Uint8Array([0xc0, 0xce, 0x01, 0x20, 0x7f, 0x7c]);

      // For the category: push <0x20 (push 32 bytes)> before the category
      const categoryPushPrefix = new Uint8Array([0x20]); // OP_PUSH32

      // suffix depends on whether the event is anonymous:
      // Named:  88 00 88 <len><hash> 75 <144> b2 75 51
      // Anon:   88 00 88 <144> b2 75 51
      let suffix: Uint8Array;
      if (eventDef.isAnonymous) {
        suffix = new Uint8Array([
          0x88, // OP_EQUALVERIFY (category)
          0x00, // OP_0 (empty = 'none' capability)
          0x88, // OP_EQUALVERIFY (capability)
          0x02, 0x90, 0x00, // push 2 bytes: 144 as Script Number
          0xb2, // OP_CHECKSEQUENCEVERIFY
          0x75, // OP_DROP
          0x51, // OP_1
        ]);
      } else {
        const eventNameHash = computeEventNameHash(eventDef.signature);
        suffix = new Uint8Array([
          0x88, // OP_EQUALVERIFY (category)
          0x00, // OP_0 (empty = 'none' capability)
          0x88, // OP_EQUALVERIFY (capability)
          0x14, // push 20 bytes
          ...eventNameHash,
          0x75, // OP_DROP
          0x02, 0x90, 0x00, // push 2 bytes: 144 as Script Number
          0xb2, // OP_CHECKSEQUENCEVERIFY
          0x75, // OP_DROP
          0x51, // OP_1
        ]);
      }

      // Build full script: prefix + categoryPushPrefix + category + suffix
      this.emit(prefix, locationData);
      this.pushToStack('(value)');
      this.emit(categoryPushPrefix, locationData);
      this.pushToStack('(value)');

      // Get the categoryId that's below on stack (at index 2 now)
      this.emit(encodeInt(2n), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.removeFromStack(2); // remove the old categoryId position
      this.pushToStack('(value)'); // OP_ROLL moves it to the top

      this.emit(Op.OP_CAT, locationData); // pushPrefix + category
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emit(Op.OP_CAT, locationData); // prefix + (pushPrefix + category)
      this.popFromStack(2);
      this.pushToStack('(value)');

      this.emit(suffix, locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_CAT, locationData); // full script
      this.popFromStack(2);
      this.pushToStack('(value)');

      // Hash to P2SH32: OP_HASH256 then wrap as 0xaa20 <hash> 0x87
      this.emit(Op.OP_HASH256, locationData);
      // Build P2SH32 locking bytecode: 0xaa20 + hash + 0x87
      this.emit(P2SH32_LBC_PREFIX, locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emit(P2SH32_LBC_SUFFIX, locationData);
      this.pushToStack('(value)');
      this.emit(Op.OP_CAT, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)'); // expected locking bytecode

      // Get actual output locking bytecode
      this.emitBlockSlotIndex('event', emitIndex, locationData);
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      // 3. Verify output token category base matches master's
      this.emitBlockSlotIndex('event', emitIndex, locationData);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      this.emitVerifyCatBaseEqMaster(locationData);

      // 4. Verify NFT capability is 'none' (no capability byte), not 'mutable' or 'minting'
      this.emitBlockSlotIndex('event', emitIndex, locationData);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData); // [category_32, empty] for 'none' capability
      this.emit(Op.OP_SWAP, locationData); // [empty, category_32]
      this.emit(Op.OP_DROP, locationData); // [empty]
      this.pushToStack('(value)');

      this.emit(encodeInt(0n), locationData); // empty = 'none' capability (no trailing byte)
      this.pushToStack('(value)');

      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      // 5. Verify FT amount is 0 (prevent FT extraction via event outputs)
      this.emitBlockSlotIndex('event', emitIndex, locationData);
      this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);
      this.pushToStack('(value)');

      this.emit(encodeInt(0n), locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      // 6. Verify output satoshi value is bounded (prevent excessive sats locked in event outputs)
      this.emitBlockSlotIndex('event', emitIndex, locationData);
      this.emit(Op.OP_OUTPUTVALUE, locationData);
      this.pushToStack('(value)');
      this.emit(encodeInt(1200n), locationData); // max 1200 sats (dust for 208-byte max event output = 1068)
      this.pushToStack('(value)');
      this.emit(Op.OP_LESSTHANOREQUAL, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emit(Op.OP_VERIFY, locationData);
      this.popFromStack();

      if (isConditionalEmit) {
        this.emit(Op.OP_ENDIF, locationData);
      }
    }

    // Clean up pending emit values from the stack
    for (const pendingEmit of this.pendingEmits) {
      const idx = this.getStackIndex(pendingEmit.stackName);
      this.emit(encodeInt(BigInt(idx)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.removeFromStack(idx);
    }
  }

  /**
   * Emit master UTXO self-preservation: verify output locking bytecode and token category
   * match the input. Called once for any function with stateful access.
   */
  /**
   * Emit verification for external read inputs.
   * For each external read slot:
   * 1. Verify token category matches the category param (strip capability)
   * 2. Verify commitment is preserved in output (read-only)
   */
  private emitExternalReadVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.location, positionHint: PositionHint.END };

    for (const slot of this.externalReadSlots) {
      // Compute input index: readOnlyDataNft block slot + slotIndex
      this.emitBlockSlotIndex('readOnlyDataNft', slot.slotIndex, locationData);
      // DUP the input index so we can use it multiple times
      this.emit(Op.OP_DUP, locationData);
      // Stack: [inputIdx, inputIdx]

      // 1. IDENTITY (master-free): the co-spent read-only sub-NFT's locking bytecode == the expected
      // sub-NFT address. The data/entry NFT self-pins its category (Stage 2), so any spendable UTXO at
      // that address carries the genuine category and thus genuine committed state - no master co-spend.
      this.emit(Op.OP_UTXOBYTECODE, locationData);     // [inputIdx, input_bytecode]
      if (!slot.addressParam) {
        throw new Error('external read target address must be a constructor/function parameter');
      }
      // +2 for the 2 untracked values on the real stack: input_bytecode and inputIdx
      const addrParamIdx = this.getStackIndex(slot.addressParam);
      this.emit(encodeInt(BigInt(addrParamIdx + 2)), locationData);
      this.emit(Op.OP_PICK, locationData);              // [inputIdx, input_bytecode, expected_addr]
      this.emit(Op.OP_EQUALVERIFY, locationData);       // [inputIdx]

      // Verify bytecode self-preservation: input bytecode == output bytecode
      // Stack: [inputIdx] (1 untracked)
      this.emit(Op.OP_DUP, locationData);              // [inputIdx, inputIdx]
      this.emit(Op.OP_UTXOBYTECODE, locationData);     // [inputIdx, input_bytecode]
      this.emit(Op.OP_OVER, locationData);              // [inputIdx, input_bytecode, inputIdx]
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);   // [inputIdx, input_bytecode, output_bytecode]
      this.emit(Op.OP_EQUALVERIFY, locationData);      // [inputIdx]

      // Verify full token category preservation: input category+capability == output category+capability
      this.emit(Op.OP_DUP, locationData);                // [inputIdx, inputIdx]
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);  // [inputIdx, input_cat_33]
      this.emit(Op.OP_OVER, locationData);                // [inputIdx, input_cat_33, inputIdx]
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData); // [inputIdx, input_cat_33, output_cat_33]
      this.emit(Op.OP_EQUALVERIFY, locationData);         // [inputIdx]

      // Verify input commitment == output commitment at same index
      this.emit(Op.OP_DUP, locationData);
      this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);
      this.emit(Op.OP_EQUALVERIFY, locationData);
    }
  }

  /**
   * Emit covenant checks for external function calls:
   * 1. Verify B's token category matches the expected category parameter
   * 2. Verify B's master locking bytecode is preserved (input == output)
   * 3. Verify B's master retains minting capability
   * 4. Verify B's function selector matches _externalCallSelector
   */
  private emitExternalCallVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // A msg.sender-target call (IFoo(msg.sender).m()) verifies the co-spent callee against the tx-derived
    // msg.sender locking bytecode. Compute it once into a tracked temp: emitMsgSender reads _msgSenderCategory
    // via the tracker, so it must run before the per-slot verification pushes its untracked working values.
    const msgSenderTemp = this.externalCallSlots.some((s) => s.addressIsMsgSender && !s.loopArrayVar)
      ? '__internal__extcall_msgsender' : undefined;
    if (msgSenderTemp) {
      this.emitMsgSender(locationData);
      this.pushToStack(msgSenderTemp);
    }

    // Same-address varying-method pointer: evaluate each slot's RUNTIME selector (`cond ? a.sel : b.sel`) into
    // a named temp here, on the clean stack (its `cond` param is on the tracked stack; no working values yet).
    // The per-slot selector check picks it (like the witness param) to bind the co-spent method to cond.
    const rtSelTemps = new Map<number, string>();
    for (const slot of this.externalCallSlots) {
      if (!slot.runtimeSelector) continue;
      this.visit(slot.runtimeSelector);
      const name = `__internal__extcall_rtsel_${slot.slotIndex}`;
      this.stack[0] = name; // rename the just-evaluated top of the tracked stack
      rtSelTemps.set(slot.slotIndex, name);
    }

    for (const slot of this.externalCallSlots) {
      // Array-element target `IFoo(arr[i]).m()`: verify EVERY co-spent callee against the array in a loop.
      if (slot.inlineLoopDispatch) continue; // handled inline per-iteration in visitExternalFunctionCall
      if (slot.loopArrayVar) {
        this.emitArrayExternalCallLoop(slot, node);
        continue;
      }
      const callMode = slot.callMode ?? ExternalCallMode.REGULAR;

      // B's master input index (per-slot runtime index when the SDK filled one - fn-ptr calls + multi-call
      // slots - else the compile-time co-spend base + offset).
      this.emitSlotMasterIndex(slot, locationData);
      // Stack: [B_master_inputIdx] (1 untracked)

      // DUP for multiple uses
      this.emit(Op.OP_DUP, locationData);
      // Stack: [B_master_inputIdx, B_master_inputIdx] (2 untracked)

      // 1. IDENTITY (ALL modes): B's master locking bytecode == the expected address.
      // B's master self-pins its category+capability (Stage 1), so a matching address means the
      // co-spent UTXO is the genuine master holding genuine state - no caller-side category check.
      this.emit(Op.OP_UTXOBYTECODE, locationData);  // [B_master_inputIdx, B_master_bytecode]
      // Source the EXPECTED address (a value the caller cannot choose - see docs/extcall-target-pinning.md):
      //   - a param / synthesized __extaddr_ state-read local -> PICK it off the stack;
      //   - a code-baked address literal -> push the constant bytes (un-satisfiable for a non-locking-bytecode
      //     value -> fails closed; never a caller input).
      // No silent fall-through: any other target shape still throws (conservative - the collect phase records
      // addressParam/addressLiteral ONLY for the recognised sound forms).
      const addrName = slot.addressIsMsgSender ? msgSenderTemp! : slot.addressParam;
      if (addrName) {
        // +2 for the 2 untracked values on the real stack: B_master_bytecode and B_master_inputIdx
        const addrParamIdx = this.getStackIndex(addrName);
        this.emit(encodeInt(BigInt(addrParamIdx + 2)), locationData);
        this.emit(Op.OP_PICK, locationData);          // [idx, B_master_bytecode, expected_addr]
      } else if (slot.addressLiteral) {
        this.emit(hexToBin(slot.addressLiteral), locationData); // [idx, B_master_bytecode, expected_addr]
      } else {
        throw new Error('external call target address must be a constructor/function parameter');
      }
      this.emit(Op.OP_EQUALVERIFY, locationData);   // [idx]
      // Stack: [B_master_inputIdx] (1 untracked)

      // .call / .delegatecall mode: minting capability verification
      // Verifying minting capability prevents substitution of event/return NFTs (which have
      // the same base category but 'none' capability) as fake call targets.
      if (callMode === ExternalCallMode.CALL || callMode === ExternalCallMode.DELEGATECALL) {
        this.emit(Op.OP_DUP, locationData);              // [idx, idx]
        this.emit(Op.OP_UTXOTOKENCATEGORY, locationData); // [idx, cat+cap]
        this.emit(encodeInt(32n), locationData);           // [idx, cat+cap, 32]
        this.emit(Op.OP_SPLIT, locationData);              // [idx, cat32, capByte]
        this.emit(Op.OP_SWAP, locationData);               // [idx, capByte, cat32]
        this.emit(Op.OP_DROP, locationData);               // [idx, capByte]
        this.emit(encodeInt(2n), locationData);             // [idx, capByte, 0x02]
        this.emit(Op.OP_EQUALVERIFY, locationData);        // [idx]  minting verified
        this.emit(Op.OP_DROP, locationData);
        continue;
      }

      // 2. Verify B's master locking bytecode is preserved: input == output (REGULAR + STATICCALL)
      this.emit(Op.OP_DUP, locationData);              // [idx, idx]
      this.emit(Op.OP_UTXOBYTECODE, locationData);     // [idx, input_bytecode]
      this.emit(Op.OP_OVER, locationData);              // [idx, input_bytecode, idx]
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);   // [idx, input_bytecode, output_bytecode]
      this.emit(Op.OP_EQUALVERIFY, locationData);      // [idx]

      // 3. Verify B's master retains full token category (base + minting capability) in output (REGULAR + STATICCALL)
      this.emit(Op.OP_DUP, locationData);                // [idx, idx]
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);  // [idx, input_cat_33]
      this.emit(Op.OP_OVER, locationData);                // [idx, input_cat_33, idx]
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData); // [idx, input_cat_33, output_cat_33]
      this.emit(Op.OP_EQUALVERIFY, locationData);         // [idx]

      // 4. Verify B's function selector (REGULAR only, skip for call/staticcall)
      if (callMode === ExternalCallMode.REGULAR && slot.needsSelectorVerification) {
        // Selector-first: the selector is always the first push in B's unlocking bytecode.
        // MINIMALDATA guarantees a 4-byte selector uses a 0x04 prefix (1 byte).
        // Same code for P2S, P2SH32, and P2SH20 - no address-type branching needed.
        // Filter must match the injection (SymbolTable) exactly: selectorArrayVar slots have NO witness param
        // (they verify against the on-chain selector array), so they must not shift the naming count here.
        const slotsNeedingSelector = this.externalCallSlots.filter(
          (s) => s.needsSelectorVerification && !s.selectorArrayVar,
        );
        const rtSel = rtSelTemps.get(slot.slotIndex);

        // Emit `[.., selector] -> [..]`: compare the 4-byte selector to the expected value (runtime temp, then
        // compile-time constant, then witness param) - each leaves [idx].
        const emitSelectorCompare = (): void => {
          if (!rtSel && slot.compileTimeSelector) {
            this.emit(slot.compileTimeSelector, locationData);
            this.emit(Op.OP_EQUALVERIFY, locationData);
          } else {
            const selectorName = rtSel
              ?? (slotsNeedingSelector.length === 1
                ? '__internal__externalCallSelector' : `__internal__externalCallSelector${slot.slotIndex}`);
            const selectorIdx = this.getStackIndex(selectorName);
            this.emit(encodeInt(BigInt(selectorIdx + 2)), locationData);
            this.emit(Op.OP_PICK, locationData);
            this.emit(Op.OP_EQUALVERIFY, locationData);
          }
        };

        if (slot.fnPtrCall) {
          // A fn-ptr callee may be SINGLE-method: its dispatcher is elided, so its unlocking has NO 4-byte
          // selector prefix (the first push is the first arg). Verify the selector ONLY when the co-spent
          // unlocking begins with a 4-byte push (0x04) - a real dispatch selector; a single-method callee is
          // pinned by the identity check alone (its one method is unambiguous). SOUND: a multi-method callee
          // ALWAYS has the 0x04 selector prefix, so the wrong method can never be co-spent (worst case a
          // single-method callee with a 4-byte first arg fails closed, never miscompiles).
          this.emit(Op.OP_DUP, locationData);            // [idx, idx]
          this.emit(Op.OP_INPUTBYTECODE, locationData);  // [idx, inputBC]
          this.emit(encodeInt(1n), locationData);
          this.emit(Op.OP_SPLIT, locationData);          // [idx, prefix(1), rest]
          this.emit(Op.OP_SWAP, locationData);           // [idx, rest, prefix]
          this.emit(encodeInt(4n), locationData);
          this.emit(Op.OP_EQUAL, locationData);          // [idx, rest, prefix==0x04]
          this.emit(Op.OP_IF, locationData);             // [idx, rest]
          this.emit(encodeInt(4n), locationData);
          this.emit(Op.OP_SPLIT, locationData);          // [idx, selector, remainder]
          this.emit(Op.OP_DROP, locationData);           // [idx, selector]
          emitSelectorCompare();                         // [idx]
          this.emit(Op.OP_ELSE, locationData);           // [idx, rest]
          this.emit(Op.OP_DROP, locationData);           // [idx]
          this.emit(Op.OP_ENDIF, locationData);          // [idx]
        } else {
          // Stack: [idx] (1 untracked)
          this.emit(Op.OP_DUP, locationData);            // [idx, idx]
          this.emit(Op.OP_INPUTBYTECODE, locationData);  // [idx, inputBC]
          this.emit(encodeInt(1n), locationData);
          this.emit(Op.OP_SPLIT, locationData);          // [idx, prefix, rest]
          this.emit(Op.OP_NIP, locationData);            // [idx, rest]
          this.emit(encodeInt(4n), locationData);
          this.emit(Op.OP_SPLIT, locationData);          // [idx, selector, remainder]
          this.emit(Op.OP_DROP, locationData);           // [idx, selector]
          emitSelectorCompare();
        }
        // Stack: [idx] (1 untracked)
      }

      // 5. Commitment preservation (STATICCALL only)
      // Verify all NFT commitments are unchanged (input == output)
      if (callMode === ExternalCallMode.STATICCALL) {
        this.emitStaticCallCommitmentPreservation(slot, locationData);
      }

      // Drop the remaining idx from the stack
      this.emit(Op.OP_DROP, locationData);
    }

    // Drop the msg.sender temp (each slot's verification is stack-neutral, so it is back on top here).
    if (msgSenderTemp) {
      this.emit(Op.OP_DROP, locationData);
      this.popFromStack();
    }

    // Drop any dynamic-write RMW values kept alive for an array-external-call co-spend over a written array
    // (emitDynamicWriteVerification skipped these; the co-spend loop above read the array from them).
    for (const vName of this.coSpendPreservedDynValues) {
      const idx = this.getStackIndex(vName);
      this.emit(encodeInt(BigInt(idx)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.removeFromStack(idx);
    }
    this.coSpendPreservedDynValues.clear();
  }

  /**
   * Verify an array-element external call `IFoo(arr[i]).m()`: every element of the state array `arr` (callee
   * addresses) is co-spent as a callee at the trailing external-call run and verified against arr[i] in a
   * loop. The source `for` loop is left as harmless iteration (its body external call emits nothing); this
   * epilogue reads the array once and loop-verifies callee[base + computedOffset + i*stride].master.LBC ==
   * arr[i] (+ master/category preservation + selector). Modeled on emitDynamicReadLoop (runtime-stack-neutral
   * OP_BEGIN/OP_UNTIL) + emitExternalCallVerification. count comes from the array (state), so no orphan-bound
   * is needed - every element is verified and the spender cannot skip or substitute one.
   */
  private emitArrayExternalCallLoop(slot: ExternalCallSlot, node: FunctionDefinitionNode): void {
    const loc = { location: node.location, positionHint: PositionHint.END };
    const sv = this.stateVariables.find((v) => v.name === slot.loopArrayVar);
    if (!sv) {
      // A loop slot whose array is a function PARAMETER is a witness/calldata address array - e.g. MultiCall's
      // `targets[i].staticcall(data[i])` returning bytes[]. That needs inline loop-indexed dispatch (co-spend +
      // per-element return-event read keyed on the live index), a separate model from this state-array epilogue
      // loop; it is not yet implemented. See docs/call-model.md section 10. Any other target (e.g. a mapping)
      // simply is not a state array.
      if (node.parameters.some((p) => p.name === slot.loopArrayVar)) {
        throw new Error(
          `per-element external calls over the calldata/parameter array '${slot.loopArrayVar}' `
          + '(dynamic dispatch, e.g. the MultiCall pattern) are not yet supported; only state arrays can back '
          + 'an array-element external call. See docs/call-model.md section 10.',
        );
      }
      throw new Error(`array external-call target '${slot.loopArrayVar}' must be a state array`);
    }
    const stride = 1 + slot.requiredDataNftIndices.length;
    const callMode = slot.callMode ?? ExternalCallMode.REGULAR;

    // --- read whole array -> blob (pushdata(count) ++ framed element LBCs); co-spends arr's chunks once ---
    this.emitReadStateArrayBlob(sv, loc, '(aec_blob)'); // [..., (aec_blob)]
    this.emitPushdataDecode(PrimitiveType.BIGINT, loc); // [count, remainder] remainder top
    this.emit(Op.OP_SWAP, loc);                          // [remainder, count] count top
    this.popFromStack();                                 // drop (aec_blob) tracking
    this.pushToStack('(aec_rem)');
    this.pushToStack('(aec_count)');

    // Varying-method dispatch table: also read the parallel `bytes[]` selector array; each iteration decodes
    // its next framed selector (exactly like an address element) and verifies it == the co-spent callee's.
    if (slot.selectorArrayVar) {
      const selSv = this.stateVariables.find((v) => v.name === slot.selectorArrayVar);
      if (!selSv) throw new Error(`selector array '${slot.selectorArrayVar}' must be a state array`);
      this.emitReadStateArrayBlob(selSv, loc, '(aec_sel_blob)'); // [..., sel_blob]
      this.emitPushdataDecode(PrimitiveType.BIGINT, loc);        // [..., selcount, sel_rem] sel_rem top
      this.emit(Op.OP_NIP, loc);                                 // drop selcount -> [..., sel_rem]
      this.popFromStack();                                       // drop (aec_sel_blob) tracking
      this.pushToStack('(aec_sel_rem)');
    }

    // Received-value pointer array (fnPtrCall): the callee layouts are unknown at compile time, so each
    // iteration reads its callee master input index from the SDK-filled witness list (framed ints) instead of
    // base + i*stride. SOUND: each index is identity-bound to arr[i] below, and a strictly-increasing check
    // keeps duplicate-address elements from aliasing one co-spent input. Copy the list; track prev index.
    if (slot.fnPtrCall) {
      const listName = `__internal__extcallIdxList${slot.slotIndex}`;
      this.emit(encodeInt(BigInt(this.getStackIndex(listName))), loc);
      this.emit(Op.OP_PICK, loc);
      this.pushToStack('(aec_idx_rem)');
      this.emit(encodeInt(-1n), loc);
      this.pushToStack('(aec_previdx)');
    }

    this.emit(encodeInt(0n), loc);
    this.pushToStack('(aec_i)');

    this.scopeDepth += 1;
    this.emit(Op.OP_BEGIN, loc);
    // cond: i < count
    this.emit(encodeInt(BigInt(this.getStackIndex('(aec_i)'))), loc);
    this.emit(Op.OP_PICK, loc);
    this.emit(encodeInt(BigInt(this.getStackIndex('(aec_count)') + 1)), loc);
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_LESSTHAN, loc);
    this.emit(Op.OP_IF, loc);

    const stackBeforeBody = [...this.stack];
    const stackDepth = this.stack.length;

    // --- decode arr[i] from (aec_rem); store the new remainder back into (aec_rem); leave elem (the callee
    // LBC, or the packed struct for a struct-field target) as the bottom untracked working value ---
    this.emit(encodeInt(BigInt(this.getStackIndex('(aec_rem)'))), loc);
    this.emit(Op.OP_PICK, loc);                          // copy remainder [..., remcopy]
    // An address array element is one pushdata-framed LBC; a struct-array element is the INLINE packed struct
    // (fields concatenated, no per-element frame). Decoding the whole struct type skips every field so the
    // remainder advances past the entire element - decoding it as bytes would stop after the first field.
    const elemDecodeType = slot.loopArrayElemStructType instanceof StructType
      ? slot.loopArrayElemStructType : new BytesType();
    this.emitPushdataDecode(elemDecodeType, loc);        // [..., elem, newrem] newrem top
    this.emitReplace(this.getStackIndex('(aec_rem)') + 2, this.currentFunction); // (aec_rem) := newrem
    // [..., elem]  (1 untracked: elem)

    // Struct-array element field target `poolInfo[i].lpToken.m()`: elem is the packed struct; decode the
    // interface-typed field (skip preceding fields, decode the target) so the identity check below runs against the
    // field value, not the whole struct - the same field extraction visitFieldAccess does, applied per iteration.
    if (slot.loopArrayElemStructType instanceof StructType) {
      const st = slot.loopArrayElemStructType;
      const fieldIndex = st.fields.findIndex((f) => f.name === slot.loopArrayElemFieldName);
      for (let fi = 0; fi < fieldIndex; fi += 1) this.emitPushdataSkip(st.fields[fi].type, loc);
      if (fieldIndex === st.fields.length - 1) {
        this.emitPushdataDecodeLastField(st.fields[fieldIndex].type, loc); // [..., field]
      } else {
        this.emitPushdataDecode(st.fields[fieldIndex].type, loc);          // [..., field, remainder]
        this.emit(Op.OP_DROP, loc);                                        // [..., field]
      }
    }

    if (slot.fnPtrCall) {
      // --- callee master idx = next framed int from the witness list; must be strictly increasing ---
      this.emit(encodeInt(BigInt(this.getStackIndex('(aec_idx_rem)') + 1)), loc); // +1: elem
      this.emit(Op.OP_PICK, loc);                        // [elem, idxrem copy]
      this.emitPushdataDecode(PrimitiveType.BIGINT, loc); // [elem, idx, newrem]
      this.emitReplace(this.getStackIndex('(aec_idx_rem)') + 3, this.currentFunction); // (aec_idx_rem):=newrem
      this.emit(Op.OP_DUP, loc);                         // [elem, idx, idx]
      this.emit(encodeInt(BigInt(this.getStackIndex('(aec_previdx)') + 3)), loc);
      this.emit(Op.OP_PICK, loc);                        // [elem, idx, idx, prev]
      this.emit(Op.OP_GREATERTHAN, loc);                 // [elem, idx, idx>prev]
      this.emit(Op.OP_VERIFY, loc);                      // [elem, idx]
      this.emit(Op.OP_DUP, loc);                         // [elem, idx, idx]
      this.emitReplace(this.getStackIndex('(aec_previdx)') + 3, this.currentFunction); // (aec_previdx):=idx
      // [elem, idx]
    } else {
      // --- callee master idx = externalCallInputBase + computedOffset + i*stride ---
      this.emit(encodeInt(BigInt(this.getStackIndex('__internal__externalCallInputBase') + 1)), loc); // +1: elem
      this.emit(Op.OP_PICK, loc);                        // [elem, base]
      if (slot.computedOffset !== 0) {
        this.emit(encodeInt(BigInt(slot.computedOffset)), loc);
        this.emit(Op.OP_ADD, loc);
      }
      this.emit(encodeInt(BigInt(this.getStackIndex('(aec_i)') + 2)), loc); // +2: elem, base-partial
      this.emit(Op.OP_PICK, loc);                        // [elem, base, i]
      if (stride !== 1) {
        this.emit(encodeInt(BigInt(stride)), loc);
        this.emit(Op.OP_MUL, loc);                       // [elem, base, i*stride]
      }
      this.emit(Op.OP_ADD, loc);                         // [elem, idx]
    }

    // 1. IDENTITY: callee master LBC == arr[i] (elem at depth 2 under [idx, callee_bc])
    this.emit(Op.OP_DUP, loc);                           // [elem, idx, idx]
    this.emit(Op.OP_UTXOBYTECODE, loc);                  // [elem, idx, callee_bc]
    this.emit(encodeInt(2n), loc);
    this.emit(Op.OP_PICK, loc);                          // [elem, idx, callee_bc, elem]
    this.emit(Op.OP_EQUALVERIFY, loc);                   // [elem, idx]

    if (callMode === ExternalCallMode.REGULAR || callMode === ExternalCallMode.STATICCALL) {
      // 2. master bytecode preservation (input == output)
      this.emit(Op.OP_DUP, loc);
      this.emit(Op.OP_UTXOBYTECODE, loc);
      this.emit(Op.OP_OVER, loc);
      this.emit(Op.OP_OUTPUTBYTECODE, loc);
      this.emit(Op.OP_EQUALVERIFY, loc);                 // [elem, idx]
      // 3. category preservation
      this.emit(Op.OP_DUP, loc);
      this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
      this.emit(Op.OP_OVER, loc);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, loc);
      this.emit(Op.OP_EQUALVERIFY, loc);                 // [elem, idx]
    }

    // 4. selector (REGULAR + needsSelectorVerification)
    if (callMode === ExternalCallMode.REGULAR && slot.needsSelectorVerification
      && slot.fnPtrCall && slot.selectorArrayVar) {
      // Received-value pointers: a SINGLE-method callee's dispatcher is elided (no 0x04 selector push), so
      // decode/advance sel[i] UNCONDITIONALLY (the remainder must never desync), then compare only when the
      // co-spent unlocking begins with a 4-byte push - same guard as the single fnPtrCall path; a multi-method
      // callee always has the prefix, so the wrong method can never be co-spent.
      this.emit(encodeInt(BigInt(this.getStackIndex('(aec_sel_rem)') + 2)), loc); // +2: elem, idx
      this.emit(Op.OP_PICK, loc);                        // [elem, idx, selrem copy]
      this.emitPushdataDecode(new BytesType(), loc);     // [elem, idx, sel_i, newrem]
      this.emitReplace(this.getStackIndex('(aec_sel_rem)') + 4, this.currentFunction); // (aec_sel_rem):=newrem
      this.emit(Op.OP_OVER, loc);                        // [elem, idx, sel_i, idx]
      this.emit(Op.OP_INPUTBYTECODE, loc);               // [elem, idx, sel_i, inBC]
      this.emit(encodeInt(1n), loc);
      this.emit(Op.OP_SPLIT, loc);                       // [elem, idx, sel_i, prefix, rest]
      this.emit(Op.OP_SWAP, loc);                        // [elem, idx, sel_i, rest, prefix]
      this.emit(encodeInt(4n), loc);
      this.emit(Op.OP_EQUAL, loc);                       // [elem, idx, sel_i, rest, prefix==0x04]
      this.emit(Op.OP_IF, loc);                          // [elem, idx, sel_i, rest]
      this.emit(encodeInt(4n), loc);
      this.emit(Op.OP_SPLIT, loc);                       // [elem, idx, sel_i, cosel, remainder]
      this.emit(Op.OP_DROP, loc);                        // [elem, idx, sel_i, cosel]
      this.emit(Op.OP_EQUALVERIFY, loc);                 // [elem, idx]
      this.emit(Op.OP_ELSE, loc);                        // [elem, idx, sel_i, rest]
      this.emit(Op.OP_DROP, loc);
      this.emit(Op.OP_DROP, loc);                        // [elem, idx]
      this.emit(Op.OP_ENDIF, loc);
    } else if (callMode === ExternalCallMode.REGULAR && slot.needsSelectorVerification) {
      this.emit(Op.OP_DUP, loc);                         // [elem, idx, idx]
      this.emit(Op.OP_INPUTBYTECODE, loc);               // [elem, idx, inBC]
      this.emit(encodeInt(1n), loc);
      this.emit(Op.OP_SPLIT, loc);
      this.emit(Op.OP_NIP, loc);                         // [elem, idx, rest]
      this.emit(encodeInt(4n), loc);
      this.emit(Op.OP_SPLIT, loc);
      this.emit(Op.OP_DROP, loc);                        // [elem, idx, co-spent selector]
      if (slot.selectorArrayVar) {
        // Per-element: decode the next framed selector sel[i] from (aec_sel_rem), advance the remainder, and
        // assert co-spent selector == sel[i] (each callee bound to its OWN on-chain selector).
        this.emit(encodeInt(BigInt(this.getStackIndex('(aec_sel_rem)') + 3)), loc); // +3: elem, idx, selector
        this.emit(Op.OP_PICK, loc);                      // copy sel remainder
        this.emitPushdataDecode(new BytesType(), loc);   // [..., sel_i, new_sel_rem]
        this.emitReplace(this.getStackIndex('(aec_sel_rem)') + 5, this.currentFunction); // (aec_sel_rem):=new_rem
        this.emit(Op.OP_EQUALVERIFY, loc);               // [elem, idx]
      } else {
        const slotsNeedingSelector = this.externalCallSlots.filter(
          (s) => s.needsSelectorVerification && !s.selectorArrayVar,
        );
        const selectorName = slotsNeedingSelector.length === 1
          ? '__internal__externalCallSelector' : `__internal__externalCallSelector${slot.slotIndex}`;
        this.emit(encodeInt(BigInt(this.getStackIndex(selectorName) + 3)), loc); // +3: elem, idx, selector
        this.emit(Op.OP_PICK, loc);
        this.emit(Op.OP_EQUALVERIFY, loc);               // [elem, idx]
      }
    }

    this.emit(Op.OP_DROP, loc);                          // drop idx -> [elem]
    this.emit(Op.OP_DROP, loc);                          // drop elem -> []
    this.removeScopedVariables(stackDepth, this.currentFunction);

    // increment i in place
    this.emit(encodeInt(BigInt(this.getStackIndex('(aec_i)'))), loc);
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_1ADD, loc);
    this.emitReplace(this.getStackIndex('(aec_i)') + 1, this.currentFunction);
    this.popFromStack();

    this.emit(encodeBool(false), loc);
    this.pushToStack('(aec_loop_continue)');
    this.emit(Op.OP_ELSE, loc);
    this.stack = [...stackBeforeBody];
    this.emit(encodeBool(true), loc);
    this.pushToStack('(aec_loop_exit)');
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_UNTIL, loc);
    this.popFromStack();
    this.scopeDepth -= 1;

    // cleanup loop temps
    const temps = ['(aec_i)', '(aec_count)', '(aec_rem)'];
    if (slot.selectorArrayVar) temps.push('(aec_sel_rem)');
    if (slot.fnPtrCall) temps.push('(aec_idx_rem)', '(aec_previdx)');
    for (const tmp of temps) {
      const idx = this.getStackIndex(tmp);
      this.emit(encodeInt(BigInt(idx)), loc);
      this.emit(Op.OP_ROLL, loc);
      this.emit(Op.OP_DROP, loc);
      this.removeFromStack(idx);
    }
  }

  /**
   * Inline loop-indexed external dispatch for `targets[i].call/staticcall(data[i])` over a calldata/parameter
   * address array whose per-element return is consumed in the loop body (the MultiCall pattern). The source
   * for-loop is a runtime OP_BEGIN/OP_UNTIL loop, so this runs once per iteration with the live index `i`:
   *   - co-spend callee master = externalCallInputBase + computedOffset + i*stride, identity-bound to targets[i]
   *     (+ master bytecode/category preservation; commitments preserved for staticcall)
   *   - read + verify the return event at externalReturnOutputIdx + i, leaving [(success)=true, (returnData)]
   *     for the tuple assignment.
   * Distinct from the fixed-slot single call (emitExternalCallVerification) and the void state-array epilogue
   * loop (emitArrayExternalCallLoop). The input index is tracked as (ilc_inidx) so the stack tracker stays
   * consistent across the picks.
   */
  private emitInlineLoopExternalCall(
    node: ExternalFunctionCallNode, slot: ExternalCallSlot, loc: SingleLocationData,
  ): void {
    const stride = 1 + slot.requiredDataNftIndices.length;
    const callMode = slot.callMode ?? ExternalCallMode.REGULAR;
    // The target is `targets[i]` (ArrayAccess) or `calls[i].target` (struct field of a struct-array element); the
    // live loop index lives on the inner ArrayAccess either way. visit(addressExpression) below extracts the address.
    const ilcArrAccess = node.addressExpression instanceof FieldAccessNode
      ? node.addressExpression.expression as ArrayAccessNode : node.addressExpression as ArrayAccessNode;
    const idxExpr = ilcArrAccess.index;

    // --- evaluate the live index i and the target address targets[i] (both tracked) ---
    this.visit(idxExpr);                  // [..., i]
    this.popFromStack(); this.pushToStack('(ilc_i)');
    this.visit(node.addressExpression);   // [..., i, addr]
    this.popFromStack(); this.pushToStack('(ilc_addr)');

    // --- callee master input index = externalCallInputBase + computedOffset + i*stride (tracked) ---
    this.emit(encodeInt(BigInt(this.getStackIndex('__internal__externalCallInputBase'))), loc);
    this.emit(Op.OP_PICK, loc);           // [..., i, addr, base]
    if (slot.computedOffset !== 0) {
      this.emit(encodeInt(BigInt(slot.computedOffset)), loc);
      this.emit(Op.OP_ADD, loc);
    }
    this.emit(encodeInt(BigInt(this.getStackIndex('(ilc_i)') + 1)), loc); // +1: untracked base
    this.emit(Op.OP_PICK, loc);           // [..., i, addr, base, i]
    if (stride !== 1) {
      this.emit(encodeInt(BigInt(stride)), loc);
      this.emit(Op.OP_MUL, loc);
    }
    this.emit(Op.OP_ADD, loc);            // [..., i, addr, inputidx]
    this.pushToStack('(ilc_inidx)');

    // 1. IDENTITY: callee master UTXO bytecode == targets[i]
    this.emit(encodeInt(BigInt(this.getStackIndex('(ilc_inidx)'))), loc);
    this.emit(Op.OP_PICK, loc);           // [..., inputidx_copy]
    this.emit(Op.OP_UTXOBYTECODE, loc);   // [..., utxobc]
    this.emit(encodeInt(BigInt(this.getStackIndex('(ilc_addr)') + 1)), loc); // +1: utxobc
    this.emit(Op.OP_PICK, loc);           // [..., utxobc, addr]
    this.emit(Op.OP_EQUALVERIFY, loc);    // [...]

    // 2-3. master bytecode + category preservation (REGULAR + STATICCALL)
    if (callMode === ExternalCallMode.REGULAR || callMode === ExternalCallMode.STATICCALL) {
      this.emitInlinePreserve(Op.OP_UTXOBYTECODE, Op.OP_OUTPUTBYTECODE, loc);
      this.emitInlinePreserve(Op.OP_UTXOTOKENCATEGORY, Op.OP_OUTPUTTOKENCATEGORY, loc);
    }
    // commitment preservation (STATICCALL only): master + data NFTs
    if (callMode === ExternalCallMode.STATICCALL) {
      this.emitInlinePreserve(Op.OP_UTXOTOKENCOMMITMENT, Op.OP_OUTPUTTOKENCOMMITMENT, loc);
      for (const nftIdx of slot.requiredDataNftIndices) {
        this.emit(encodeInt(BigInt(this.getStackIndex('(ilc_inidx)'))), loc);
        this.emit(Op.OP_PICK, loc);                          // [..., masterIdx]
        this.emit(encodeInt(BigInt(1 + nftIdx)), loc);
        this.emit(Op.OP_ADD, loc);                            // [..., dataNftIdx]
        this.emit(Op.OP_DUP, loc);
        this.emit(Op.OP_UTXOTOKENCOMMITMENT, loc);
        this.emit(Op.OP_OVER, loc);
        this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, loc);
        this.emit(Op.OP_EQUALVERIFY, loc);                   // [..., dataNftIdx]
        this.emit(Op.OP_DROP, loc);                          // [...]
      }
    }

    // --- return event: idx = externalReturnOutputIdx + i ; verify + read commitment as returnData ---
    this.emit(encodeInt(BigInt(this.getStackIndex('__internal__externalReturnOutputIdx'))), loc);
    this.emit(Op.OP_PICK, loc);           // [..., retbase]
    this.emit(encodeInt(BigInt(this.getStackIndex('(ilc_i)') + 1)), loc); // +1: retbase
    this.emit(Op.OP_PICK, loc);           // [..., retbase, i]
    this.emit(Op.OP_ADD, loc);            // [..., retidx]  (1 untracked: retidx)

    // a. return-event category == callee master category (cross-check via (ilc_inidx))
    this.emit(Op.OP_DUP, loc);            // [..., retidx, retidx]
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, loc);
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_DROP, loc);           // [..., retidx, retcat32]
    this.emit(encodeInt(BigInt(this.getStackIndex('(ilc_inidx)') + 2)), loc); // +2: retidx, retcat32
    this.emit(Op.OP_PICK, loc);           // [..., retidx, retcat32, masterIdx]
    this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_DROP, loc);           // [..., retidx, retcat32, calleecat32]
    this.emit(Op.OP_EQUALVERIFY, loc);    // [..., retidx]

    // b. capability 'none' (no trailing capability byte)
    this.emit(Op.OP_DUP, loc);
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, loc);
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_SWAP, loc);
    this.emit(Op.OP_DROP, loc);
    this.emit(encodeInt(0n), loc);
    this.emit(Op.OP_EQUALVERIFY, loc);    // [..., retidx]
    // c. FT amount 0
    this.emit(Op.OP_DUP, loc);
    this.emit(Op.OP_OUTPUTTOKENAMOUNT, loc);
    this.emit(encodeInt(0n), loc);
    this.emit(Op.OP_EQUALVERIFY, loc);
    // d. anyone-can-spend (OP_TRUE locking bytecode)
    this.emit(Op.OP_DUP, loc);
    this.emit(Op.OP_OUTPUTBYTECODE, loc);
    this.emit(hexToBin('51'), loc);
    this.emit(Op.OP_EQUALVERIFY, loc);
    // e. value bounded
    this.emit(Op.OP_DUP, loc);
    this.emit(Op.OP_OUTPUTVALUE, loc);
    this.emit(encodeInt(1200n), loc);
    this.emit(Op.OP_LESSTHANOREQUAL, loc);
    this.emit(Op.OP_VERIFY, loc);         // [..., retidx]

    // read commitment as returnData; success = true (opaque)
    this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, loc); // [..., returnData]
    this.emit(Op.OP_1, loc);                      // [..., returnData, true]
    this.emit(Op.OP_SWAP, loc);                   // [..., true, returnData]
    this.pushToStack('(success)');
    this.pushToStack('(returnData)');

    // --- cleanup the temps below the results (keep (success),(returnData) on top) ---
    for (const tmp of ['(ilc_inidx)', '(ilc_addr)', '(ilc_i)']) {
      const idx = this.getStackIndex(tmp);
      this.emit(encodeInt(BigInt(idx)), loc);
      this.emit(Op.OP_ROLL, loc);
      this.emit(Op.OP_DROP, loc);
      this.removeFromStack(idx);
    }
  }

  /** Input==output preservation for the callee master at (ilc_inidx): `<read>` UTXO op vs `<write>` output op. */
  private emitInlinePreserve(readOp: Op, writeOp: Op, loc: SingleLocationData): void {
    this.emit(encodeInt(BigInt(this.getStackIndex('(ilc_inidx)'))), loc);
    this.emit(Op.OP_PICK, loc);           // [..., masterIdx]
    this.emit(Op.OP_DUP, loc);            // [..., masterIdx, masterIdx]
    this.emit(readOp, loc);               // [..., masterIdx, inputVal]
    this.emit(Op.OP_OVER, loc);           // [..., masterIdx, inputVal, masterIdx]
    this.emit(writeOp, loc);              // [..., masterIdx, inputVal, outputVal]
    this.emit(Op.OP_EQUALVERIFY, loc);    // [..., masterIdx]
    this.emit(Op.OP_DROP, loc);           // [...]
  }

  private emitStaticCallCommitmentPreservation(
    slot: ExternalCallSlot, locationData: SingleLocationData,
  ): void {
    // Stack: [B_master_inputIdx]

    // Verify master NFT commitment: input == output
    this.emit(Op.OP_DUP, locationData);                   // [idx, idx]
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);   // [idx, input_commitment]
    this.emit(Op.OP_OVER, locationData);                   // [idx, input_commitment, idx]
    this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);  // [idx, input_commitment, output_commitment]
    this.emit(Op.OP_EQUALVERIFY, locationData);            // [idx]

    // Verify each data NFT commitment: input == output
    for (const nftIdx of slot.requiredDataNftIndices) {
      this.emit(Op.OP_DUP, locationData);                   // [idx, idx]
      this.emit(encodeInt(BigInt(1 + nftIdx)), locationData);
      this.emit(Op.OP_ADD, locationData);                    // [idx, dataNftInputIdx]
      this.emit(Op.OP_DUP, locationData);                    // [idx, dataNftInputIdx, dataNftInputIdx]
      this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);   // [idx, dataNftInputIdx, input_commitment]
      this.emit(Op.OP_SWAP, locationData);                   // [idx, input_commitment, dataNftInputIdx]
      this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);  // [idx, input_commitment, output_commitment]
      this.emit(Op.OP_EQUALVERIFY, locationData);            // [idx]
    }
  }

  private emitReturnEventCovenantVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // B-side: conditional return event UTXO verification
    // _returnOutputIdx >= 0 means cross-contract call (verify event UTXO)
    // _returnOutputIdx < 0 means standalone call (skip event UTXO)

    const returnOutputIdxIdx = this.getStackIndex('__internal__returnOutputIdx');
    this.emit(encodeInt(BigInt(returnOutputIdxIdx)), locationData);
    this.emit(Op.OP_PICK, locationData);
    // Stack: [_returnOutputIdx] (1 untracked)

    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_GREATERTHANOREQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    // Stack: [_returnOutputIdx] (1 untracked)

    // Cross-contract call: verify return event UTXO at _returnOutputIdx
    // 1. Verify commitment matches __returnBlob
    const blobIdx = this.getStackIndex('__internal__returnBlob');
    this.emit(encodeInt(BigInt(blobIdx + 1)), locationData); // +1 for untracked _returnOutputIdx
    this.emit(Op.OP_PICK, locationData);
    // Stack: [_returnOutputIdx, __returnBlob_copy] (2 untracked)

    // Read actual output commitment at _returnOutputIdx
    this.emit(Op.OP_OVER, locationData); // [_returnOutputIdx, blob, _returnOutputIdx]
    this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData); // [_returnOutputIdx, blob, actual_commitment]
    this.emit(Op.OP_EQUALVERIFY, locationData); // [_returnOutputIdx]

    // 2. Verify output token category matches master's category
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
    this.emit(encodeInt(32n), locationData);
    this.emit(Op.OP_SPLIT, locationData);
    this.emit(Op.OP_DROP, locationData);
    // Stack: [_returnOutputIdx, output_cat_stripped] (2 untracked)
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.emit(encodeInt(32n), locationData);
    this.emit(Op.OP_SPLIT, locationData);
    this.emit(Op.OP_DROP, locationData);
    this.emit(Op.OP_EQUALVERIFY, locationData);
    // Stack: [_returnOutputIdx] (1 untracked)

    // 3. Verify NFT capability is 'none' (no capability byte), not 'mutable' or 'minting'
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
    this.emit(encodeInt(32n), locationData);
    this.emit(Op.OP_SPLIT, locationData); // [idx, category_32, empty] for 'none' capability
    this.emit(Op.OP_SWAP, locationData); // [idx, empty, category_32]
    this.emit(Op.OP_DROP, locationData); // [idx, empty]
    this.emit(encodeInt(0n), locationData); // empty = 'none' capability (no trailing byte)
    this.emit(Op.OP_EQUALVERIFY, locationData);
    // Stack: [_returnOutputIdx] (1 untracked)

    // 4. Verify FT amount is 0 (prevent FT extraction via return event outputs)
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_EQUALVERIFY, locationData);
    // Stack: [_returnOutputIdx] (1 untracked)

    // 5. Verify output locking bytecode is OP_TRUE (anyone-can-spend for return events)
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_OUTPUTBYTECODE, locationData);
    this.emit(hexToBin('51'), locationData); // OP_1 (OP_TRUE)
    this.emit(Op.OP_EQUALVERIFY, locationData);
    // Stack: [_returnOutputIdx] (1 untracked)

    // 6. Verify output satoshi value is bounded (prevent excessive sats locked in return event outputs)
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_OUTPUTVALUE, locationData);
    this.emit(encodeInt(1200n), locationData); // max 1200 sats (dust for max-size return event = 966)
    this.emit(Op.OP_LESSTHANOREQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
    // Stack: [_returnOutputIdx] (1 untracked)

    this.emit(Op.OP_DROP, locationData); // drop _returnOutputIdx

    this.emit(Op.OP_ELSE, locationData);
    // Standalone call: just drop _returnOutputIdx
    this.emit(Op.OP_DROP, locationData);
    this.emit(Op.OP_ENDIF, locationData);

    // Clean up __returnBlob from tracked stack
    const cleanupIdx = this.getStackIndex('__internal__returnBlob');
    this.emit(encodeInt(BigInt(cleanupIdx)), locationData);
    this.emit(Op.OP_ROLL, locationData);
    this.emit(Op.OP_DROP, locationData);
    this.removeFromStack(cleanupIdx);
  }

  private emitExternalReturnEventVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // A-side: verify return event UTXOs from external function calls
    // For each external call with return values, verify:
    // 1. The event UTXO's token category matches B's category
    // 2. The event UTXO commitment encodes the expected return values
    // (The actual return value reading is done in visitExternalFunctionCall)

    const returningSlots = this.externalCallSlots.filter((s) => s.hasReturnValues && !s.inlineLoopDispatch);

    for (const slot of returningSlots) {
      // Determine the parameter name for this slot's return output index
      const returnParamName = returningSlots.length === 1
        ? '__internal__externalReturnOutputIdx'
        : `__internal__externalReturnOutputIdx${slot.returnSlotIndex}`;

      // Verify token category of return event UTXO
      const returnOutputIdxIdx = this.getStackIndex(returnParamName);
      this.emit(encodeInt(BigInt(returnOutputIdxIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      // Stack: [_externalReturnOutputIdx{N}] (1 untracked)

      this.emit(Op.OP_DUP, locationData);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData);
      // Stack: [_externalReturnOutputIdx{N}, output_cat_stripped] (2 untracked)

      // Compare to B's category via the co-spent callee master (per-slot runtime index or base+offset; +2 for
      // the untracked items already on the real stack).
      this.emitSlotMasterIndex(slot, locationData, 2);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.emit(Op.OP_EQUALVERIFY, locationData);
      // Stack: [_externalReturnOutputIdx{N}] (1 untracked)

      // 3. Verify NFT capability is 'none' (no capability byte), not 'mutable' or 'minting'
      this.emit(Op.OP_DUP, locationData);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData); // [idx, category_32, empty] for 'none' capability
      this.emit(Op.OP_SWAP, locationData); // [idx, empty, category_32]
      this.emit(Op.OP_DROP, locationData); // [idx, empty]
      this.emit(encodeInt(0n), locationData); // empty = 'none' capability (no trailing byte)
      this.emit(Op.OP_EQUALVERIFY, locationData);
      // Stack: [_externalReturnOutputIdx{N}] (1 untracked)

      // 4. Verify FT amount is 0 (prevent FT extraction via return event outputs)
      this.emit(Op.OP_DUP, locationData);
      this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);
      this.emit(encodeInt(0n), locationData);
      this.emit(Op.OP_EQUALVERIFY, locationData);
      // Stack: [_externalReturnOutputIdx{N}] (1 untracked)

      // 5. Verify output locking bytecode is OP_TRUE (anyone-can-spend for return events)
      this.emit(Op.OP_DUP, locationData);
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);
      this.emit(hexToBin('51'), locationData); // OP_1 (OP_TRUE)
      this.emit(Op.OP_EQUALVERIFY, locationData);
      // Stack: [_externalReturnOutputIdx{N}] (1 untracked)

      // 6. Verify output satoshi value is bounded
      this.emit(Op.OP_DUP, locationData);
      this.emit(Op.OP_OUTPUTVALUE, locationData);
      this.emit(encodeInt(1200n), locationData);
      this.emit(Op.OP_LESSTHANOREQUAL, locationData);
      this.emit(Op.OP_VERIFY, locationData);
      // Stack: [_externalReturnOutputIdx{N}] (1 untracked)

      this.emit(Op.OP_DROP, locationData);
    }

    // H2: bind the caller's return read to the genuine callee return event by enforcing UNIQUENESS. The caller
    // reads the return from a free witness index; nothing pinned it to the output the callee constrained, so an
    // attacker could mint a second (category-C, none-cap, FT-0, OP_TRUE) output with a forged commitment and
    // point the witness at it (the co-spent callee master authorizes minting category-C outputs). For a single
    // returning call there is exactly ONE such output (the callee's genuine return; regular events carry a
    // P2SH32 covenant bytecode, not OP_TRUE). Count them and require == 1 so no forged twin can exist.
    if (returningSlots.length === 1) {
      this.emitSingleReturnEventUniqueness(returningSlots[0], locationData);
    }
  }

  // H2 helper: require exactly one output matching the return-event fingerprint of `slot`'s callee category
  // (32-byte none-cap category == B, locking bytecode == OP_TRUE). Mirrors emitMintingNftUniqueness' output loop.
  private emitSingleReturnEventUniqueness(slot: ExternalCallSlot, loc: SingleLocationData): void {
    // Compute B's 32-byte category from the co-spent callee master (per-slot runtime index or base+offset).
    this.emitSlotMasterIndex(slot, loc);
    this.emit(Op.OP_UTXOTOKENCATEGORY, loc);
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc);
    this.emit(Op.OP_DROP, loc); // [B_cat32]
    this.pushToStack('(b_cat)');

    this.emit(encodeInt(0n), loc); // counter
    this.pushToStack('(re_count)');

    this.emit(Op.OP_TXOUTPUTCOUNT, loc);
    this.emit(Op.OP_1SUB, loc);
    this.pushToStack('(loop_j)');
    this.emit(Op.OP_BEGIN, loc);
    this.emit(Op.OP_DUP, loc);
    this.emit(encodeInt(0n), loc);
    this.emit(Op.OP_LESSTHAN, loc);
    this.emit(Op.OP_IF, loc);
    this.emit(Op.OP_DROP, loc);
    this.emit(encodeBool(true), loc);
    this.emit(Op.OP_ELSE, loc);
    // category match: output[j] category (32-byte none-cap) == B_cat32
    this.emit(Op.OP_DUP, loc);                 // copy j
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, loc); // outcat (32 for none-cap, 33 otherwise)
    this.emit(encodeInt(3n), loc);             // pick b_cat (outcat=0, j=1, count=2, b_cat=3)
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_EQUAL, loc);               // catMatch
    this.emit(Op.OP_IF, loc);
    // bytecode match: output[j] locking bytecode == OP_TRUE (0x51)
    this.emit(Op.OP_DUP, loc);                 // copy j
    this.emit(Op.OP_OUTPUTBYTECODE, loc);
    this.emit(hexToBin('51'), loc);
    this.emit(Op.OP_EQUAL, loc);
    this.emit(Op.OP_IF, loc);
    this.emit(Op.OP_SWAP, loc);                // [.., count, j] -> [.., j, count]
    this.emit(Op.OP_1ADD, loc);
    this.emit(Op.OP_SWAP, loc);                // [.., count+1, j]
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_1SUB, loc);                // j--
    this.emit(encodeBool(false), loc);
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_UNTIL, loc);
    this.popFromStack(); // (loop_j)

    this.emit(encodeInt(1n), loc);
    this.emit(Op.OP_NUMEQUALVERIFY, loc); // exactly one genuine return event
    this.popFromStack(); // (re_count)
    this.emit(Op.OP_DROP, loc);
    this.popFromStack(); // (b_cat)
  }

  private emitExternalOutStateVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // outState verification is a subset of external call verification:
    // - Token category verification (identity check)
    // - Master locking bytecode preservation (input == output)
    // - Minting capability retention
    // - NO selector verification (outState doesn't care which function B calls)
    // Compute per-slot offsets for non-shared outState slots (each contributes
    // 1 master + requiredDataNftIndices.length data NFTs to the input/output layout)
    let outStateRunningOffset = 0;
    const outStateSlotOffsets = new Map<number, number>();
    for (const slot of this.externalOutStateSlots) {
      if (slot.sharedWithCallSlotIndex !== undefined) continue;
      outStateSlotOffsets.set(slot.slotIndex, outStateRunningOffset);
      outStateRunningOffset += 1 + slot.requiredDataNftIndices.length;
    }

    for (const slot of this.externalOutStateSlots) {
      // Skip verification for slots shared with external calls - already verified there
      if (slot.sharedWithCallSlotIndex !== undefined) continue;

      const slotOffset = outStateSlotOffsets.get(slot.slotIndex) ?? 0;
      // Runtime _externalOutStateInputBase param (direction unknown at compile time)
      const osBaseIdx = this.getStackIndex('__internal__externalOutStateInputBase');
      this.emit(encodeInt(BigInt(osBaseIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.emit(encodeInt(BigInt(slotOffset)), locationData);
      this.emit(Op.OP_ADD, locationData);
      // Stack: [B_master_inputIdx] (1 untracked)

      this.emit(Op.OP_DUP, locationData);
      // Stack: [B_master_inputIdx, B_master_inputIdx] (2 untracked)

      // 1. IDENTITY: B's master locking bytecode == the expected address (B's master self-pins
      // its category+capability, so a matching address means the genuine master / genuine state).
      this.emit(Op.OP_UTXOBYTECODE, locationData);  // [B_master_inputIdx, B_master_bytecode]
      if (!slot.addressParam) {
        throw new Error('external outState target address must be a constructor/function parameter');
      }
      // +2 for the 2 untracked values on the real stack: B_master_bytecode and B_master_inputIdx
      const osAddrParamIdx = this.getStackIndex(slot.addressParam);
      this.emit(encodeInt(BigInt(osAddrParamIdx + 2)), locationData);
      this.emit(Op.OP_PICK, locationData);
      this.emit(Op.OP_EQUALVERIFY, locationData);
      // Stack: [B_master_inputIdx] (1 untracked)

      // 2. Verify B's master locking bytecode is preserved: input == output
      this.emit(Op.OP_DUP, locationData);
      this.emit(Op.OP_UTXOBYTECODE, locationData);
      this.emit(Op.OP_OVER, locationData);
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);
      this.emit(Op.OP_EQUALVERIFY, locationData);

      // 3. Verify B's master retains full token category (base + minting capability) in output
      this.emit(Op.OP_DUP, locationData);                // [idx, idx]
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);  // [idx, input_cat_33]
      this.emit(Op.OP_OVER, locationData);                // [idx, input_cat_33, idx]
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData); // [idx, input_cat_33, output_cat_33]
      this.emit(Op.OP_EQUALVERIFY, locationData);         // [idx]

      // Drop the remaining idx from the stack
      this.emit(Op.OP_DROP, locationData);
    }
  }

  private emitMasterSelfPreservation(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };

    // Shared as a subroutine for non-delegate functions; delegate (altstack proxy index) inlines.
    if (!this.currentFunctionIsDelegate && this.invokeSubroutineIfDefined(
      GenerateTargetTraversalWithLocation.MASTER_SELF_PRES_SUBROUTINE_ID, locationData)) {
      return;
    }

    // Verify locking bytecode (use UTXOBYTECODE, not ACTIVEBYTECODE, for P2SH compatibility)
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOBYTECODE, locationData);
    this.pushToStack('(value)');
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_OUTPUTBYTECODE, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);

    // Verify token category
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.pushToStack('(value)');
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);
  }

  /**
   * Emit commitment preservation for the master NFT.
   * Verifies UTXOTOKENCOMMITMENT[masterIdx] == OUTPUTTOKENCOMMITMENT[masterIdx].
   * Used in the guarded path, split, and merge to prevent state corruption.
   */
  private emitMasterCommitmentPreservation(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);
    this.pushToStack('(value)');
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);
  }

  /**
   * Emit master UTXO satoshi (==) and fungible-token-amount (>=) preservation. Generic and
   * stack-neutral; shared as a subroutine for non-delegate functions (delegate inlines).
   */
  private emitMasterValuePreservation(locationData: SingleLocationData): void {
    if (!this.currentFunctionIsDelegate && this.invokeSubroutineIfDefined(
      GenerateTargetTraversalWithLocation.MASTER_VALUE_PRES_SUBROUTINE_ID, locationData)) {
      return;
    }

    // Master UTXO exact satoshi preservation: inputValue == outputValue
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOVALUE, locationData);
    this.pushToStack('(value)');
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_OUTPUTVALUE, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);

    // Master UTXO fungible token amount preservation: outputAmount >= inputAmount
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENAMOUNT, locationData);
    this.pushToStack('(value)');
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_LESSTHANOREQUAL, locationData);
    this.popFromStack(2);
    this.pushToStack('(value)');
    this.emit(Op.OP_VERIFY, locationData);
    this.popFromStack();
  }

  /**
   * Emit the master input index for state access paths.
   * In delegate functions, reads _proxyMasterIndex from the altstack via FROMALTSTACK/DUP/TOALTSTACK
   * (saved at function entry) to reference the proxy's master UTXO.
   * In normal functions, uses OP_INPUTINDEX.
   */
  private emitMasterInputIndex(locationData: SingleLocationData): void {
    if (this.currentFunctionIsDelegate) {
      // Read _proxyMasterIndex from the altstack (saved at function entry).
      // FROMALTSTACK pops it, DUP copies it, TOALTSTACK restores the altstack.
      // This is stack-depth-independent, avoiding tracked/actual stack mismatches.
      this.emit(Op.OP_FROMALTSTACK, locationData);
      this.emit(Op.OP_DUP, locationData);
      this.emit(Op.OP_TOALTSTACK, locationData);
    } else {
      this.emit(Op.OP_INPUTINDEX, locationData);
    }
  }

  /**
   * Emit self-preservation for the delegate contract itself (not the proxy).
   * Verifies the delegate's own locking bytecode and value are preserved.
   * Uses OP_INPUTINDEX (not emitMasterInputIndex) because this refers to the
   * delegate's own UTXO, not the proxy's.
   */
  private emitDelegateSelfPreservation(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };

    // Verify locking bytecode: delegate's input LBC == output LBC
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_UTXOBYTECODE, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_OUTPUTBYTECODE, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);

    // Verify value: delegate's input value == output value
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_UTXOVALUE, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_OUTPUTVALUE, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);

    // Verify token category preservation: delegate's minting NFT cannot be stolen or downgraded
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);

    // Verify delegate's input token has minting capability (0x02)
    // This ensures the delegate is a properly-deployed stateful contract
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.pushToStack('(value)');
    this.emit(encodeInt(32n), locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_SPLIT, locationData);    // [category_32, capability_byte]
    this.popFromStack(2);
    this.pushToStack('(value)');
    this.pushToStack('(value)');
    this.emit(Op.OP_SWAP, locationData);     // [capability_byte, category_32]
    this.emit(Op.OP_DROP, locationData);     // [capability_byte]
    this.popFromStack(2);
    this.pushToStack('(value)');
    this.emit(encodeInt(2n), locationData);   // 0x02 = minting
    this.pushToStack('(value)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);

    // Verify NFT commitment preservation: delegate's state cannot be modified via delegatecall
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);

    // Verify fungible token amount preservation: delegate's FTs cannot be drained via delegatecall
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_UTXOTOKENAMOUNT, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_LESSTHANOREQUAL, locationData);
    this.popFromStack(2);
    this.pushToStack('(value)');
    this.emit(Op.OP_VERIFY, locationData);
    this.popFromStack();
  }

  /**
   * Verify the delegate's OWN minting NFT is not duplicated.
   * emitMintingNftUniqueness uses emitMasterInputIndex (proxy's index),
   * so this additional check verifies the delegate's own category (via OP_INPUTINDEX).
   */
  private emitDelegateMintingNftUniqueness(node: FunctionDefinitionNode): void {
    const locationData: SingleLocationData = { location: node.body.location, positionHint: PositionHint.END };

    // Get delegate's own category+capability (33 bytes: 32-byte category + 0x02 minting)
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.pushToStack('(del_cat_cap)');

    // Initialize counter = 0
    this.emit(encodeInt(0n), locationData);
    this.pushToStack('(del_mint_bal)');

    // Input loop: count minting NFTs of delegate's category
    this.emit(Op.OP_TXINPUTCOUNT, locationData);
    this.emit(Op.OP_1SUB, locationData);
    this.pushToStack('(loop_i)');

    this.emit(Op.OP_BEGIN, locationData);

    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_DROP, locationData);
    this.emit(encodeBool(true), locationData);
    this.emit(Op.OP_ELSE, locationData);

    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_1ADD, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_1SUB, locationData);
    this.emit(encodeBool(false), locationData);

    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_UNTIL, locationData);
    this.popFromStack(); // (loop_i)

    // Output loop: decrement counter for each matching output
    this.emit(Op.OP_TXOUTPUTCOUNT, locationData);
    this.emit(Op.OP_1SUB, locationData);
    this.pushToStack('(loop_j)');

    this.emit(Op.OP_BEGIN, locationData);

    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_DROP, locationData);
    this.emit(encodeBool(true), locationData);
    this.emit(Op.OP_ELSE, locationData);

    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_1SUB, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_1SUB, locationData);
    this.emit(encodeBool(false), locationData);

    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_UNTIL, locationData);
    this.popFromStack(); // (loop_j)

    // Verify balance >= 0 (no new minting NFTs of delegate's category created)
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_GREATERTHANOREQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
    this.popFromStack(); // (del_mint_bal)

    this.emit(Op.OP_DROP, locationData);
    this.popFromStack(); // (del_cat_cap)
  }

  /**
   * Emit upgrade-compatible self-preservation for the master UTXO.
   *
   * Unlike emitMasterSelfPreservation, this does NOT enforce locking bytecode
   * equality between input and output. The master output is allowed to have
   * different locking bytecode (the new contract version).
   *
   * Enforces only token category+capability preservation:
   * OP_UTXOTOKENCATEGORY returns 33 bytes (32-byte categoryId + 1-byte capability).
   * Comparing input vs output ensures both the categoryId and the minting
   * capability (0x02) are preserved - the minting NFT cannot be downgraded
   * to mutable or none.
   */
  private emitUpgradeSelfPreservation(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };

    // Verify token category + capability preservation (no bytecode check)
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.pushToStack('(value)');
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
    this.pushToStack('(value)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);
  }

  /**
   * Emit minting NFT count-preservation verification: ensure the number of
   * minting NFTs of this contract's category does not increase from inputs to
   * outputs.
   *
   * This replaces a strict uniqueness check to support multi-threading, where
   * multiple threads of the same contract (all sharing a categoryId, each with
   * its own minting NFT) participate in a single transaction.
   *
   * Algorithm:
   * 1. Count minting NFTs of this category in inputs (counter++)
   * 2. Count minting NFTs of this category in outputs (counter--)
   * 3. Verify counter >= 0 (no new minting NFTs were created)
   *
   * This allows:
   * - Multi-threading: N threads in, N threads out (count preserved)
   * - Thread merge: N threads in, M < N threads out (count decreases)
   * - Prevents unauthorized thread creation (count increase blocked)
   *
   * Category-scoped: minting NFTs of OTHER categories are unaffected.
   *
   * Stack effect: net zero (all temporaries cleaned up).
   */
  private emitMintingNftUniqueness(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };

    // Shared as a subroutine for non-delegate functions; delegate (altstack proxy index) inlines.
    if (!this.currentFunctionIsDelegate && this.invokeSubroutineIfDefined(
      GenerateTargetTraversalWithLocation.MINT_UNIQUENESS_SUBROUTINE_ID, locationData)) {
      return;
    }

    // Get this contract's category+capability (33 bytes: 32-byte category + 0x02 minting)
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.pushToStack('(this_cat_cap)');

    // Initialize counter = 0 (tracks inputMintCount - outputMintCount)
    this.emit(encodeInt(0n), locationData);
    this.pushToStack('(mint_balance)');

    // Part A - Input loop: count minting NFTs of this category
    // Stack: [..., this_cat_cap, mint_balance]
    this.emit(Op.OP_TXINPUTCOUNT, locationData);
    this.emit(Op.OP_1SUB, locationData);
    this.pushToStack('(loop_i)');

    // Stack: [..., this_cat_cap, mint_balance, i]
    this.emit(Op.OP_BEGIN, locationData);

    // If i < 0, exit loop
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    this.emit(Op.OP_IF, locationData);

    // Exit: drop i, push true
    this.emit(Op.OP_DROP, locationData);
    this.emit(encodeBool(true), locationData);

    this.emit(Op.OP_ELSE, locationData);

    // Check input[i]'s category+capability against self
    this.emit(Op.OP_DUP, locationData);                // copy i
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);  // input[i].cat+cap
    // Pick this_cat_cap: positions from top: cat_cap_i=0, i=1, bal=2, cat=3
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_PICK, locationData);                // copy this_cat_cap
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);

    // Match: increment counter (mint_balance++)
    this.emit(Op.OP_SWAP, locationData);    // [..., cat, i, bal]
    this.emit(Op.OP_1ADD, locationData);    // [..., cat, i, bal+1]
    this.emit(Op.OP_SWAP, locationData);    // [..., cat, bal+1, i]

    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_1SUB, locationData);                // i--
    this.emit(encodeBool(false), locationData);          // continue loop

    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_UNTIL, locationData);

    // After input loop: stack is [..., this_cat_cap, mint_balance]
    this.popFromStack(); // remove (loop_i)

    // Part B - Output loop: decrement counter for each matching output
    // Stack: [..., this_cat_cap, mint_balance]
    this.emit(Op.OP_TXOUTPUTCOUNT, locationData);
    this.emit(Op.OP_1SUB, locationData);
    this.pushToStack('(loop_j)');

    // Stack: [..., this_cat_cap, mint_balance, j]
    this.emit(Op.OP_BEGIN, locationData);

    // If j < 0, exit loop
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    this.emit(Op.OP_IF, locationData);

    // Exit: drop j, push true
    this.emit(Op.OP_DROP, locationData);
    this.emit(encodeBool(true), locationData);

    this.emit(Op.OP_ELSE, locationData);

    // Check output[j]'s category+capability against self
    this.emit(Op.OP_DUP, locationData);                  // copy j
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);  // output[j].cat+cap
    // Pick this_cat_cap: positions from top: cat_cap_j=0, j=1, bal=2, cat=3
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_PICK, locationData);                  // copy this_cat_cap
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);

    // Match: decrement counter (mint_balance--)
    this.emit(Op.OP_SWAP, locationData);    // [..., cat, j, bal]
    this.emit(Op.OP_1SUB, locationData);    // [..., cat, j, bal-1]
    this.emit(Op.OP_SWAP, locationData);    // [..., cat, bal-1, j]

    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_1SUB, locationData);                  // j--
    this.emit(encodeBool(false), locationData);            // continue loop

    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_UNTIL, locationData);

    // After output loop: stack is [..., this_cat_cap, mint_balance]
    this.popFromStack(); // remove (loop_j)

    // Verify mint_balance >= 0 (no new minting NFTs created)
    // Stack: [..., this_cat_cap, mint_balance]
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_GREATERTHANOREQUAL, locationData); // mint_balance >= 0
    this.emit(Op.OP_VERIFY, locationData);
    this.popFromStack(); // remove (mint_balance)

    // Clean up this_cat_cap
    this.emit(Op.OP_DROP, locationData);
    this.popFromStack(); // remove (this_cat_cap)
  }

  // C3: conserve the count of co-spent own-category MUTABLE (0x01) NFTs (data + entry NFTs) input->output. In
  // the gated (non-entry / non-dynamic / non-deploy) case the 0x01-of-C set is fixed - the master is 0x02,
  // events are 0x00 - so an honest transaction has exactly as many 0x01-of-C outputs as inputs (accessed NFTs
  // are written or preserved; un-accessed ones co-spent read-only are preserved). An attacker who additionally
  // co-spends an UN-accessed data/entry NFT and DESTROYS it (flag=2, or an output-free flag=1) - which the
  // sub-covenant self-authorizes given the master's minting NFT is present - drops the output count below the
  // input count and is rejected. Mirrors emitMintingNftUniqueness (balance = inputs - outputs), asserting == 0.
  // Residual: flag=1 corruption that re-emits a 0x01-of-C output keeps the count balanced (see SECURITY-AUDIT C3).
  private emitOwnCategoryMutableNftConservation(node: FunctionDefinitionNode): void {
    const loc = { location: node.body.location, positionHint: PositionHint.END };

    // Build this contract's category ++ mutable(0x01) capability from the master's category+minting(0x02).
    this.emitMasterInputIndex(loc);
    this.emit(Op.OP_UTXOTOKENCATEGORY, loc); // C ++ 0x02
    this.emit(encodeInt(32n), loc);
    this.emit(Op.OP_SPLIT, loc);             // [C_32, 0x02]
    this.emit(Op.OP_DROP, loc);              // [C_32]
    this.emit(Op.OP_1, loc);                 // [C_32, 0x01]
    this.emit(Op.OP_CAT, loc);               // [C ++ 0x01]
    this.pushToStack('(this_cat_mutable)');

    // balance = inputMutableCount - outputMutableCount, starts at 0
    this.emit(encodeInt(0n), loc);
    this.pushToStack('(mutable_balance)');

    // Input loop: +1 per input whose category+capability == C ++ 0x01
    this.emit(Op.OP_TXINPUTCOUNT, loc);
    this.emit(Op.OP_1SUB, loc);
    this.pushToStack('(loop_i)');
    this.emit(Op.OP_BEGIN, loc);
    this.emit(Op.OP_DUP, loc);
    this.emit(encodeInt(0n), loc);
    this.emit(Op.OP_LESSTHAN, loc);
    this.emit(Op.OP_IF, loc);
    this.emit(Op.OP_DROP, loc);
    this.emit(encodeBool(true), loc);
    this.emit(Op.OP_ELSE, loc);
    this.emit(Op.OP_DUP, loc);               // copy i
    this.emit(Op.OP_UTXOTOKENCATEGORY, loc); // input[i].cat+cap
    this.emit(encodeInt(3n), loc);           // pick this_cat_mutable (catcap=0, i=1, bal=2, this=3)
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_EQUAL, loc);
    this.emit(Op.OP_IF, loc);
    this.emit(Op.OP_SWAP, loc);              // [.., bal, i] -> [.., i, bal]
    this.emit(Op.OP_1ADD, loc);              // bal++
    this.emit(Op.OP_SWAP, loc);              // [.., bal+1, i]
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_1SUB, loc);              // i--
    this.emit(encodeBool(false), loc);
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_UNTIL, loc);
    this.popFromStack(); // (loop_i)

    // Output loop: -1 per output whose category+capability == C ++ 0x01
    this.emit(Op.OP_TXOUTPUTCOUNT, loc);
    this.emit(Op.OP_1SUB, loc);
    this.pushToStack('(loop_j)');
    this.emit(Op.OP_BEGIN, loc);
    this.emit(Op.OP_DUP, loc);
    this.emit(encodeInt(0n), loc);
    this.emit(Op.OP_LESSTHAN, loc);
    this.emit(Op.OP_IF, loc);
    this.emit(Op.OP_DROP, loc);
    this.emit(encodeBool(true), loc);
    this.emit(Op.OP_ELSE, loc);
    this.emit(Op.OP_DUP, loc);                 // copy j
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, loc); // output[j].cat+cap
    this.emit(encodeInt(3n), loc);             // pick this_cat_mutable (catcap=0, j=1, bal=2, this=3)
    this.emit(Op.OP_PICK, loc);
    this.emit(Op.OP_EQUAL, loc);
    this.emit(Op.OP_IF, loc);
    this.emit(Op.OP_SWAP, loc);              // [.., bal, j] -> [.., j, bal]
    this.emit(Op.OP_1SUB, loc);              // bal--
    this.emit(Op.OP_SWAP, loc);              // [.., bal-1, j]
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_1SUB, loc);              // j--
    this.emit(encodeBool(false), loc);
    this.emit(Op.OP_ENDIF, loc);
    this.emit(Op.OP_UNTIL, loc);
    this.popFromStack(); // (loop_j)

    // Assert balance == 0 (inputs preserved to outputs; none destroyed)
    this.emit(encodeInt(0n), loc);
    this.emit(Op.OP_NUMEQUALVERIFY, loc);
    this.popFromStack(); // (mutable_balance)
    this.emit(Op.OP_DROP, loc);
    this.popFromStack(); // (this_cat_mutable)
  }

  /**
   * Emit merge covenant verification: verifies N consumed master inputs are merged into 1.
   * Dual-path: surviving master (INPUTINDEX==0) vs consumed master (INPUTINDEX>0).
   * Transaction shape: [master_surviving, consumed_1..N, funding...] -> [master_preserved, change]
   */
  private emitMergeCovenantVerification(node: FunctionDefinitionNode): void {
    const locationData: SingleLocationData = { location: node.body.location, positionHint: PositionHint.END };

    // Dual-path dispatch based on INPUTINDEX
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_NUMEQUAL, locationData);
    this.emit(Op.OP_IF, locationData);

    // === Path A: Surviving master (INPUTINDEX == 0) ===

    // 1. Master self-preservation (LBC + category + capability)
    this.emitMasterSelfPreservation(node);

    // 2. Value preservation on master (satoshis)
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOVALUE, locationData);
    this.pushToStack('(value_in)');
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_OUTPUTVALUE, locationData);
    this.pushToStack('(value_out)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);

    // 2b. Commitment preservation on surviving master (prevents state corruption during merge)
    this.emitMasterCommitmentPreservation(node);

    // 2c. FT amount preservation on surviving master (input <= output)
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENAMOUNT, locationData);
    this.pushToStack('(ft_in)');
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);
    this.pushToStack('(ft_out)');
    this.emit(Op.OP_LESSTHANOREQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
    this.popFromStack(2);

    // 3. Get merge count N from function parameter
    const mergeIdx = this.getStackIndex(node.mergeCountParam!);
    this.emit(encodeInt(BigInt(mergeIdx)), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.pushToStack('(merge_n)');

    // Get master's base category and LBC for verification
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.pushToStack('(master_cat_cap)');

    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOBYTECODE, locationData);
    this.pushToStack('(master_lbc)');
    // Stack: [..., merge_n, master_cat_cap, master_lbc]

    // 4. Loop i = N down to 1: verify consumed inputs
    // Pick N: pos = master_lbc(0), cat_cap(1), merge_n(2)
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.pushToStack('(loop_i)');
    // Stack: [..., merge_n, master_cat_cap, master_lbc, i]

    this.emit(Op.OP_BEGIN, locationData);

    // input[i] category+capability - must be minting + same category
    this.emit(Op.OP_DUP, locationData);                 // [.., lbc, i, i]
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);   // [.., lbc, i, cat_cap_i]
    // Pick master_cat_cap (pos: cat_cap_i=0, i=1, lbc=2, cat_cap=3)
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_EQUALVERIFY, locationData);          // full 33-byte match (category + minting cap)

    // input[i] locking bytecode - must match master
    this.emit(Op.OP_DUP, locationData);                  // [.., lbc, i, i]
    this.emit(Op.OP_UTXOBYTECODE, locationData);         // [.., lbc, i, lbc_i]
    // Pick master_lbc (pos: lbc_i=0, i=1, lbc=2)
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_EQUALVERIFY, locationData);          // [.., lbc, i]

    // i-- and loop while i > 0
    this.emit(Op.OP_1SUB, locationData);
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_GREATERTHAN, locationData);
    this.emit(Op.OP_NOT, locationData); // UNTIL loops while false
    this.emit(Op.OP_UNTIL, locationData);
    // Stack: [..., merge_n, master_cat_cap, master_lbc, 0]
    this.emit(Op.OP_DROP, locationData); // drop 0
    this.popFromStack(); // remove (loop_i)

    // Clean up stack
    this.emit(Op.OP_DROP, locationData); // master_lbc
    this.popFromStack();
    this.emit(Op.OP_DROP, locationData); // master_cat_cap
    this.popFromStack();
    this.emit(Op.OP_DROP, locationData); // merge_n
    this.popFromStack();

    // 5. Verify exactly 1 minting output (only surviving master)
    this.emitMergeMintingCount(node);

    this.emit(Op.OP_ELSE, locationData);

    // === Path B: Consumed master (INPUTINDEX > 0) ===

    // Verify input[0] is a valid surviving master of same contract
    // input[0] category+capability must match ours (minting + same category)
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);    // input[0].cat_cap
    this.pushToStack('(input0_cat_cap)');
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);    // self.cat_cap
    this.pushToStack('(self_cat_cap)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);

    // input[0] LBC must match ours (same contract)
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_UTXOBYTECODE, locationData);          // input[0].lbc
    this.pushToStack('(input0_lbc)');
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_UTXOBYTECODE, locationData);           // self.lbc
    this.pushToStack('(self_lbc)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);

    // FT conservation: surviving output[0] must hold at least as many FTs as consumed input
    // (input[self].ft <= output[0].ft)
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_UTXOTOKENAMOUNT, locationData);
    this.pushToStack('(self_ft)');
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);
    this.pushToStack('(out0_ft)');
    this.emit(Op.OP_LESSTHANOREQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
    this.popFromStack(2);

    // Verify INPUTINDEX <= N (within merge range)
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.pushToStack('(input_idx)');
    // Pick merge count param from the stack
    const mergeIdxB = this.getStackIndex(node.mergeCountParam!);
    this.emit(encodeInt(BigInt(mergeIdxB)), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.pushToStack('(merge_n_b)');
    this.emit(Op.OP_LESSTHANOREQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
    this.popFromStack(2); // input_idx and merge_n_b

    this.emit(Op.OP_ENDIF, locationData);
  }

  /**
   * Verify exactly 1 minting output of this category exists (the surviving master).
   * Uses this contract's full cat+cap from INPUTINDEX for comparison.
   */
  private emitMergeMintingCount(node: FunctionDefinitionNode): void {
    const locationData: SingleLocationData = { location: node.body.location, positionHint: PositionHint.END };

    // Get this contract's cat+cap
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.pushToStack('(this_cat_cap)');

    // Count minting outputs = 0
    this.emit(encodeInt(0n), locationData);
    this.pushToStack('(mint_count)');

    // Loop all outputs
    this.emit(Op.OP_TXOUTPUTCOUNT, locationData);
    this.emit(Op.OP_1SUB, locationData);
    this.pushToStack('(loop_j)');

    this.emit(Op.OP_BEGIN, locationData);

    // If j < 0, exit
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    this.emit(Op.OP_IF, locationData);

    this.emit(Op.OP_DROP, locationData); // drop j
    this.emit(encodeBool(true), locationData);

    this.emit(Op.OP_ELSE, locationData);

    // output[j] cat+cap
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
    // Pick this_cat_cap: pos = cat_cap_j(0), j(1), count(2), cat_cap(3)
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);

    // Match: increment count
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_1ADD, locationData);
    this.emit(Op.OP_SWAP, locationData);

    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_1SUB, locationData); // j--
    this.emit(encodeBool(false), locationData);

    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_UNTIL, locationData);

    // Stack: [..., this_cat_cap, mint_count]
    this.popFromStack(); // remove (loop_j)

    // Verify mint_count == 1
    this.emit(encodeInt(1n), locationData);
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(); // remove (mint_count)

    // Clean up this_cat_cap
    this.emit(Op.OP_DROP, locationData);
    this.popFromStack();
  }

  /**
   * Emit split covenant verification: verifies the minting NFT is split into N new outputs.
   * Transaction shape: [master] -> [master_preserved, new_minting_1..N, change]
   */
  private emitSplitCovenantVerification(node: FunctionDefinitionNode): void {
    const locationData: SingleLocationData = { location: node.body.location, positionHint: PositionHint.END };

    // 1. Master self-preservation (LBC + category + capability)
    this.emitMasterSelfPreservation(node);

    // 2. Value preservation on master (satoshis)
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOVALUE, locationData);
    this.pushToStack('(master_value_in)');
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_OUTPUTVALUE, locationData);
    this.pushToStack('(master_value_out)');
    this.emit(Op.OP_EQUALVERIFY, locationData);
    this.popFromStack(2);

    // 2b. Commitment preservation on master (prevents state corruption during split)
    this.emitMasterCommitmentPreservation(node);

    // 2c. FT amount preservation on master (input <= output)
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENAMOUNT, locationData);
    this.pushToStack('(master_ft_in)');
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);
    this.pushToStack('(master_ft_out)');
    this.emit(Op.OP_LESSTHANOREQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
    this.popFromStack(2);

    // 3. Get split count N from function parameter
    const splitIdx = this.getStackIndex(node.splitCountParam!);
    this.emit(encodeInt(BigInt(splitIdx)), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.pushToStack('(split_n)');

    // Get master's base category (32 bytes, without capability byte)
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.pushToStack('(master_cat_cap)');
    this.emit(encodeInt(32n), locationData);
    this.emit(Op.OP_SPLIT, locationData);
    // Stack: [..., split_n, master_cat_32, cap_byte]
    // OP_SPLIT turned 1 item into 2; OP_DROP removes cap_byte, leaving cat_32
    // in the tracker slot originally labeled (master_cat_cap).
    this.emit(Op.OP_DROP, locationData); // drop cap byte
    // Re-label stack: [..., split_n, master_cat_32]

    // Get master's LBC
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOBYTECODE, locationData);
    this.pushToStack('(master_lbc)');
    // Stack: [..., split_n, master_cat_32, master_lbc]

    // 4. Loop i = N down to 1: verify new minting outputs
    // Pick N: positions from top: master_lbc=0, master_cat=1, split_n=2
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.pushToStack('(loop_i)');
    // Stack: [..., split_n, master_cat_32, master_lbc, i]

    this.emit(Op.OP_BEGIN, locationData);

    // output[i] category+capability
    this.emit(Op.OP_DUP, locationData);                // [.., lbc, i, i]
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData); // [.., lbc, i, cat_cap_i]
    this.emit(encodeInt(32n), locationData);
    this.emit(Op.OP_SPLIT, locationData);               // [.., lbc, i, cat_32_i, cap_i]
    // Verify minting capability (byte == 0x02)
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_EQUALVERIFY, locationData);          // [.., lbc, i, cat_32_i]
    // Verify same base category: pick master_cat_32 (pos: cat_32_i=0, i=1, lbc=2, cat=3)
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_PICK, locationData);                 // [.., lbc, i, cat_32_i, master_cat_32]
    this.emit(Op.OP_EQUALVERIFY, locationData);          // [.., lbc, i]

    // output[i] locking bytecode
    this.emit(Op.OP_DUP, locationData);                  // [.., lbc, i, i]
    this.emit(Op.OP_OUTPUTBYTECODE, locationData);       // [.., lbc, i, lbc_i]
    // Pick master_lbc (pos: lbc_i=0, i=1, lbc=2)
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_EQUALVERIFY, locationData);          // [.., lbc, i]

    // output[i] commitment must be empty (new threads start with no state)
    this.emit(Op.OP_DUP, locationData);                  // [.., lbc, i, i]
    this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData); // [.., lbc, i, commitment_i]
    this.emit(encodeInt(0n), locationData);               // [.., lbc, i, commitment_i, empty]
    this.emit(Op.OP_EQUALVERIFY, locationData);           // [.., lbc, i]

    // output[i] FT amount must be 0
    this.emit(Op.OP_DUP, locationData);                   // [.., lbc, i, i]
    this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);     // [.., lbc, i, amount_i]
    this.emit(encodeInt(0n), locationData);                // [.., lbc, i, amount_i, 0]
    this.emit(Op.OP_NUMEQUALVERIFY, locationData);        // [.., lbc, i]

    // i-- and loop while i > 0
    this.emit(Op.OP_1SUB, locationData);
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_GREATERTHAN, locationData);
    this.emit(Op.OP_NOT, locationData); // UNTIL loops while false
    this.emit(Op.OP_UNTIL, locationData);
    // Stack: [..., split_n, master_cat_32, master_lbc, 0]
    this.emit(Op.OP_DROP, locationData); // drop 0
    this.popFromStack(); // remove (loop_i)

    // 5. Verify exact minting count == N+1 (N new + 1 self)
    // Clean up master_lbc
    this.emit(Op.OP_DROP, locationData);
    this.popFromStack(); // remove (master_lbc)
    // Stack: [..., split_n, master_cat_32]

    // Now verify minting output count
    this.emitSplitMintingCount(node);
    // emitSplitMintingCount consumes master_cat_32 and split_n from stack
  }

  /**
   * Verify that the total number of minting outputs matching this category == N+1.
   * Stack before: [..., split_n, master_cat_32]
   * Stack after: [...] (both consumed, OP_VERIFY ensures count matches)
   */
  private emitSplitMintingCount(node: FunctionDefinitionNode): void {
    const locationData: SingleLocationData = { location: node.body.location, positionHint: PositionHint.END };

    // Initialize minting output count = 0
    this.emit(encodeInt(0n), locationData);
    this.pushToStack('(mint_count)');
    // Stack: [..., split_n, master_cat_32, mint_count]

    // Loop all outputs
    this.emit(Op.OP_TXOUTPUTCOUNT, locationData);
    this.emit(Op.OP_1SUB, locationData);
    this.pushToStack('(loop_j)');
    // Stack: [..., split_n, master_cat_32, mint_count, j]

    this.emit(Op.OP_BEGIN, locationData);

    // If j < 0, exit
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    this.emit(Op.OP_IF, locationData);

    this.emit(Op.OP_DROP, locationData); // drop j
    this.emit(encodeBool(true), locationData); // exit

    this.emit(Op.OP_ELSE, locationData);

    // output[j] category+capability
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
    // Check if it's a minting NFT: split at byte 32, check cap == 0x02
    this.emit(Op.OP_DUP, locationData);  // copy cat_cap for length check
    this.emit(Op.OP_SIZE, locationData);  // length of cat_cap
    this.emit(Op.OP_NIP, locationData);   // drop copy, keep size
    this.emit(encodeInt(33n), locationData);
    this.emit(Op.OP_EQUAL, locationData); // is it 33 bytes (has capability)?
    this.emit(Op.OP_IF, locationData);
    // Split and check
    this.emit(encodeInt(32n), locationData);
    this.emit(Op.OP_SPLIT, locationData);
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_EQUAL, locationData); // cap == minting?
    this.emit(Op.OP_IF, locationData);
    // Check base category matches: pick master_cat_32 (pos: cat_32=0, j=1, count=2, cat=3)
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    // Matching minting output: increment count
    this.emit(Op.OP_SWAP, locationData);    // [.., j, count]
    this.emit(Op.OP_1ADD, locationData);    // [.., j, count+1]
    this.emit(Op.OP_SWAP, locationData);    // [.., count+1, j]
    this.emit(Op.OP_ELSE, locationData);
    this.emit(Op.OP_DROP, locationData); // drop non-matching cat_32
    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_ELSE, locationData);
    this.emit(Op.OP_DROP, locationData); // drop non-minting cat_32
    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_ELSE, locationData);
    this.emit(Op.OP_DROP, locationData); // drop <33 byte cat (no capability)
    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_1SUB, locationData); // j--
    this.emit(encodeBool(false), locationData); // continue

    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_UNTIL, locationData);

    // Stack: [..., split_n, master_cat_32, mint_count]
    this.popFromStack(); // remove (loop_j)

    // Verify mint_count == split_n + 1
    // Rearrange: pick split_n (pos: count=0, cat=1, n=2)
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_PICK, locationData);
    this.emit(Op.OP_1ADD, locationData); // n+1
    this.emit(Op.OP_EQUALVERIFY, locationData); // count == n+1
    this.popFromStack(); // remove (mint_count)

    // Clean up: master_cat_32 and split_n
    this.emit(Op.OP_DROP, locationData); // master_cat_32
    this.popFromStack(); // remove master_cat_32
    this.emit(Op.OP_DROP, locationData); // split_n
    this.popFromStack(); // remove split_n
  }

  /**
   * Emit read-only entry NFT preservation: for each entry slot that is accessed
   * but not written or deleted, verify the entry NFT output preserves its commitment
   * and token category. Prevents permanent mapping entry loss during read-only access.
   */
  private emitReadOnlyEntryVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };

    for (let i = 0; i < this.entrySlots.length; i++) {
      // Skip written or deleted entries (handled by emitEntryCovenantVerification)
      if (this.pendingEntryWrites.has(i) || this.pendingEntryDeletes.has(i)) continue;
      // Loop-write entries are NEW (no input to preserve) and have no fixed block slot.
      if (this.entrySlots[i].inLoop) continue;
      // A sorted mapping WRITE co-spends an entry and rewrites it (output != input: P' on insert, k' on update),
      // so it must not be read-only-preserved; emitSortedValueUpsert handles it inline.
      if (this.sortedWrittenCollections.has(this.entrySlots[i].collection)) continue;

      // Check if entry exists via introspection
      this.emitSlotExistsCheck('entry', i, locationData);

      // If entry exists, verify preservation
      this.emit(Op.OP_IF, locationData);

      // Verify commitment: input commitment == output commitment
      this.emitEntryInputIndex(i, locationData, 0);
      // emitEntryInputIndex pushes 1 untracked value (input index)
      this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);
      // OP_UTXOTOKENCOMMITMENT pops index, pushes commitment -> 1 untracked value

      this.emitEntryOutputIndex(i, locationData, 1); // +1 for the untracked commitment
      // pushes 1 untracked value (output index) -> 2 untracked values
      this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);
      // pops index, pushes commitment -> 2 untracked values

      this.emit(Op.OP_EQUALVERIFY, locationData);
      // pops 2 -> 0 untracked values

      // Verify full token category preservation: input category+capability == output category+capability
      // Prevents capability downgrade attacks (e.g. mutable -> none, permanently freezing entry)
      this.emitEntryInputIndex(i, locationData, 0);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      // 1 untracked value (input full category)

      this.emitEntryOutputIndex(i, locationData, 1); // +1 for untracked input category
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      // 2 untracked values

      this.emit(Op.OP_EQUALVERIFY, locationData);
      // 0 untracked values

      // Verify bytecode self-preservation: input bytecode == output bytecode
      this.emitEntryInputIndex(i, locationData, 0);
      this.emit(Op.OP_UTXOBYTECODE, locationData);
      // 1 untracked value (input bytecode)
      this.emitEntryOutputIndex(i, locationData, 1); // +1 for untracked input bytecode
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);
      // 2 untracked values
      this.emit(Op.OP_EQUALVERIFY, locationData);
      // 0 untracked values

      this.emit(Op.OP_ENDIF, locationData);
    }
  }

  /**
   * Emit value preservation: verify that output satoshi values and fungible token amounts
   * are >= input values for master UTXO and all accessed data NFTs.
   * Prevents draining BCH or fungible tokens from covenant-protected UTXOs.
   */
  private emitValuePreservation(node: FunctionDefinitionNode, hasTokenContainerAccess?: boolean): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };

    this.emitMasterValuePreservation(locationData);

    // Data NFT satoshi and fungible token preservation (for all accessed NFTs)
    for (const [, compactOffset] of this.compactOffsetMap) {
      // Exact satoshi preservation: inputValue == outputValue
      this.emitMasterInputIndex(locationData);
      this.emit(encodeInt(BigInt(compactOffset)), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(Op.OP_UTXOVALUE, locationData);
      this.pushToStack('(value)');

      this.emitMasterInputIndex(locationData);
      this.emit(encodeInt(BigInt(compactOffset)), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(Op.OP_OUTPUTVALUE, locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_EQUALVERIFY, locationData);
      this.popFromStack(2);

      // Fungible token amount preservation
      this.emitMasterInputIndex(locationData);
      this.emit(encodeInt(BigInt(compactOffset)), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(Op.OP_UTXOTOKENAMOUNT, locationData);
      this.pushToStack('(value)');

      this.emitMasterInputIndex(locationData);
      this.emit(encodeInt(BigInt(compactOffset)), locationData);
      this.emit(Op.OP_ADD, locationData);
      this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);
      this.pushToStack('(value)');

      this.emit(Op.OP_LESSTHANOREQUAL, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emit(Op.OP_VERIFY, locationData);
      this.popFromStack();
    }

    // Entry NFT satoshi and fungible token preservation
    for (let i = 0; i < this.entrySlots.length; i++) {
      if (this.pendingEntryDeletes.has(i)) continue; // deleted entries have no output
      if (this.entrySlots[i].inLoop) continue; // loop-write entries are new, no input to preserve
      // sorted write: input -> P'/k', handled inline (not preserved)
      if (this.sortedWrittenCollections.has(this.entrySlots[i].collection)) continue;

      // Check if entry exists via introspection
      this.emitSlotExistsCheck('entry', i, locationData);

      this.emit(Op.OP_IF, locationData);

      // Exact satoshi preservation: input_sats == output_sats
      this.emitEntryInputIndex(i, locationData, 0);
      this.emit(Op.OP_UTXOVALUE, locationData);         // 1 untracked
      this.emitEntryOutputIndex(i, locationData, 1);
      this.emit(Op.OP_OUTPUTVALUE, locationData);        // 2 untracked
      this.emit(Op.OP_EQUALVERIFY, locationData);        // 0 untracked

      // Fungible token preservation: input_amount <= output_amount
      this.emitEntryInputIndex(i, locationData, 0);
      this.emit(Op.OP_UTXOTOKENAMOUNT, locationData);   // 1 untracked
      this.emitEntryOutputIndex(i, locationData, 1);
      this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData); // 2 untracked
      this.emit(Op.OP_LESSTHANOREQUAL, locationData);
      this.emit(Op.OP_VERIFY, locationData);             // 0 untracked

      this.emit(Op.OP_ENDIF, locationData);
    }

    // Token container satoshi preservation (only for slots with output flag set)
    if (hasTokenContainerAccess) {
      for (let i = 0; i < this.tokenContainerSlots.length; i++) {
        // Check if TC output has tokens (not drained) via output introspection
        this.emitBlockSlotIndex('tokenContainer', i, locationData);
        this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
        this.emit(Op.OP_SIZE, locationData);
        this.emit(Op.OP_NIP, locationData);
        this.emit(encodeInt(0n), locationData);
        this.emit(Op.OP_GREATERTHAN, locationData);

        this.emit(Op.OP_IF, locationData);

        // Input satoshi value
        this.emitTokenContainerInputIndex(i, locationData, 0);
        this.emit(Op.OP_UTXOVALUE, locationData);
        // 1 untracked

        // Output satoshi value
        this.emitTokenContainerOutputIndex(i, locationData, 1);
        this.emit(Op.OP_OUTPUTVALUE, locationData);
        // 2 untracked

        this.emit(Op.OP_LESSTHANOREQUAL, locationData);
        this.emit(Op.OP_VERIFY, locationData);

        this.emit(Op.OP_ENDIF, locationData);
      }
    }

    // Satoshi container identity + value preservation (only when function has transfers).
    // When pendingTransfers is empty the container is not co-spent here, so nothing to preserve; the container's
    // own covenant still gates its master/merge spends. When it IS co-spent, emitSatoshiContainerIdentity pins
    // the input to the real container and forces its output to preserve the container LBC or be a 0-sat drain -
    // the container's own covenant does NOT protect its output on the master-spend path.
    if (this.pendingTransfers.length > 0 && this.currentFunction.blockLayout) {
      this.emitSatoshiContainerIdentity(locationData);
    }

    // containerInputSats <= containerOutputSats + sum(transferValues)
    if (this.pendingTransfers.length > 0 && this.currentFunction.blockLayout) {
      // Read satoshi container input value
      this.emitBlockSlotIndex('satoshiContainer', undefined, locationData);
      this.emit(Op.OP_UTXOVALUE, locationData);
      this.pushToStack('(value)');

      // Read satoshi container output value. When drained, the SDK inserts a
      // 0-satoshi OP_RETURN placeholder, so OUTPUTVALUE naturally returns 0.
      this.emitBlockSlotIndex('satoshiContainer', undefined, locationData);
      this.emit(Op.OP_OUTPUTVALUE, locationData);
      this.pushToStack('(value)');

      // Add each transfer output's value to the container output value
      for (const transfer of this.pendingTransfers) {
        const isCondTransfer = this.conditionalTransferIndices.has(transfer.transferIndex);

        if (isCondTransfer) {
          // Check if transfer is active (non-empty LBC)
          const lbCheckIdx = this.getStackIndex(transfer.lockingBytecodeStackName);
          this.emit(encodeInt(BigInt(lbCheckIdx)), locationData);
          this.emit(Op.OP_PICK, locationData);
          this.emit(Op.OP_IF, locationData);
        }

        this.emitBlockSlotIndex('transfer', transfer.transferIndex, locationData);
        this.emit(Op.OP_OUTPUTVALUE, locationData);

        if (isCondTransfer) {
          this.emit(Op.OP_ELSE, locationData);
          this.emit(encodeInt(0n), locationData);
          this.emit(Op.OP_ENDIF, locationData);
        }

        this.emit(Op.OP_ADD, locationData);
      }

      this.emit(Op.OP_LESSTHANOREQUAL, locationData);
      this.popFromStack(2);
      this.pushToStack('(value)');
      this.emit(Op.OP_VERIFY, locationData);
      this.popFromStack();
    }
  }

  // ===== msg.sender / tx.origin Support =====

  /**
   * Emit bytecode for tx.origin: scan inputs for the first P2PKH non-token non-self input.
   *
   * A P2PKH locking bytecode is exactly 25 bytes: 76a914 <20-byte hash> 88ac
   *
   * Stack before: [...]
   * Stack after:  [..., lockingBytecode]  (the P2PKH address of the origin)
   */
  private emitTxOrigin(locationData: SingleLocationData): void {
    const p2pkhPrefix = P2PKH_LBC_PREFIX;  // 3 bytes
    const p2pkhSuffix = P2PKH_LBC_SUFFIX;  // 2 bytes

    // Push sentinel (OP_0) and counter i=0
    this.emit(Op.OP_0, locationData);          // sentinel (will be replaced by result)
    this.emit(Op.OP_0, locationData);          // i = 0

    this.emit(Op.OP_BEGIN, locationData);

    // Check: i < tx.inputs.length
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_TXINPUTCOUNT, locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    this.emit(Op.OP_IF, locationData);

    // Stack inside if: [sentinel, i]

    // Skip self: i == OP_INPUTINDEX
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_NUMEQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    // Self - skip (i++, continue)
    this.emit(Op.OP_1ADD, locationData);
    this.emit(Op.OP_0, locationData);            // continue loop
    this.emit(Op.OP_ELSE, locationData);

    // Skip token-bearing inputs: OP_UTXOTOKENCATEGORY size > 0
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.emit(Op.OP_SIZE, locationData);
    this.emit(Op.OP_NIP, locationData);
    this.emit(Op.OP_0NOTEQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    // Token-bearing - skip (i++, continue)
    this.emit(Op.OP_1ADD, locationData);
    this.emit(Op.OP_0, locationData);            // continue loop
    this.emit(Op.OP_ELSE, locationData);

    // Get locking bytecode at [i]
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_UTXOBYTECODE, locationData);
    // Stack: [sentinel, i, lbc]

    // Check size == 25
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_SIZE, locationData);
    this.emit(Op.OP_NIP, locationData);
    this.emit(encodeInt(25n), locationData);
    this.emit(Op.OP_NUMEQUAL, locationData);
    this.emit(Op.OP_IF, locationData);

    // Check prefix (first 3 bytes) == 0x76a914
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_SPLIT, locationData);        // [sentinel, i, lbc, prefix3, rest]
    this.emit(Op.OP_DROP, locationData);          // [sentinel, i, lbc, prefix3]
    this.emit(p2pkhPrefix, locationData);
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);

    // Check suffix (last 2 bytes) == 0x88ac
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(23n), locationData);
    this.emit(Op.OP_SPLIT, locationData);        // [sentinel, i, lbc, first23, last2]
    this.emit(Op.OP_NIP, locationData);           // [sentinel, i, lbc, last2]
    this.emit(p2pkhSuffix, locationData);
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);

    // MATCH: replace sentinel with lockingBytecode, exit loop
    // Stack: [sentinel, i, lbc]
    this.emit(Op.OP_ROT, locationData);           // [i, lbc, sentinel]
    this.emit(Op.OP_DROP, locationData);           // [i, lbc]
    this.emit(Op.OP_SWAP, locationData);           // [lbc, i]
    // Push tx.inputs.length to force loop exit on next iteration
    this.emit(Op.OP_TXINPUTCOUNT, locationData);   // [lbc, i, count]
    this.emit(Op.OP_NIP, locationData);             // [lbc, count]
    this.emit(Op.OP_1, locationData);               // exit loop
    this.emit(Op.OP_ELSE, locationData);

    // Suffix mismatch - drop lbc, i++, continue
    this.emit(Op.OP_DROP, locationData);           // drop lbc
    this.emit(Op.OP_1ADD, locationData);
    this.emit(Op.OP_0, locationData);              // continue loop
    this.emit(Op.OP_ENDIF, locationData);          // end suffix check

    this.emit(Op.OP_ELSE, locationData);
    // Prefix mismatch - drop lbc, i++, continue
    this.emit(Op.OP_DROP, locationData);           // drop lbc
    this.emit(Op.OP_1ADD, locationData);
    this.emit(Op.OP_0, locationData);              // continue loop
    this.emit(Op.OP_ENDIF, locationData);          // end prefix check

    this.emit(Op.OP_ELSE, locationData);
    // Size mismatch - drop lbc, i++, continue
    this.emit(Op.OP_DROP, locationData);           // drop lbc
    this.emit(Op.OP_1ADD, locationData);
    this.emit(Op.OP_0, locationData);              // continue loop
    this.emit(Op.OP_ENDIF, locationData);          // end size check

    this.emit(Op.OP_ENDIF, locationData);          // end token check
    this.emit(Op.OP_ENDIF, locationData);          // end self check

    this.emit(Op.OP_ELSE, locationData);
    // i >= count - exit loop
    this.emit(Op.OP_1, locationData);
    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_UNTIL, locationData);

    // Stack: [result, i]
    this.emit(Op.OP_DROP, locationData);           // drop i
    // Stack: [result]
    // Verify result is not sentinel (0 = OP_0 = empty bytes)
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_SIZE, locationData);
    this.emit(Op.OP_NIP, locationData);
    this.emit(Op.OP_0NOTEQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
    // Stack: [lockingBytecode]
  }

  /**
   * Emit bytecode for msg.sender: conditional dispatch based on _msgSenderCategory.
   *
   * If _msgSenderCategory is 32 zero bytes: fallback to tx.origin (direct P2PKH call).
   * If non-zero: verify an input with matching category + minting capability exists,
   * and return its lockingBytecode.
   *
   * Stack before: [...]
   * Stack after:  [..., lockingBytecode]
   */
  /**
   * Emit bytecode for msg.sig - the current function's 4-byte selector.
   * This is a compile-time constant: zero runtime cost.
   */
  private emitMsgSig(locationData: SingleLocationData): void {
    // An internal function has no selector, so msg.sig cannot be a compile-time constant here (in the EVM it
    // is the calling entry point's selector). Reject cleanly instead of emitting an undefined push.
    if (!this.currentFunction.functionSelector) {
      throw new MsgSigInInternalFunctionError(this.currentFunction);
    }
    this.emit(this.currentFunction.functionSelector, locationData);
  }

  /**
   * Emit bytecode for msg.data - the input bytecode with trailing redeem script stripped.
   * Uses _redeemPushSize (computed at contract level) to determine how many trailing
   * bytes to remove from the input bytecode.
   *
   * Stack before: [...]
   * Stack after:  [..., msgData]
   */
  private emitMsgData(locationData: SingleLocationData): void {
    // _redeemPushSize is computed once at contract level (where OP_ACTIVEBYTECODE still returns the full
    // script) and left on the entry-point stack. Inside an OP_DEFINE subroutine it is out of reach and
    // OP_ACTIVEBYTECODE would return the subroutine body, so msg.data cannot be reconstructed there.
    if (!this.stack.includes('__internal__redeemPushSize')) {
      throw new MsgDataInSubroutineError(this.currentFunction ?? { location: locationData.location } as Node);
    }
    // Get _redeemPushSize from the stack
    const pushSizeIdx = this.getStackIndex('__internal__redeemPushSize');
    this.emit(encodeInt(BigInt(pushSizeIdx)), locationData);
    this.emit(Op.OP_PICK, locationData);            // [redeemPushSize]

    // Get full input bytecode
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_INPUTBYTECODE, locationData);   // [redeemPushSize, inputBC]

    // Compute msg.data = inputBC[:len - redeemPushSize]
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_SIZE, locationData);
    this.emit(Op.OP_NIP, locationData);              // [redeemPushSize, inputBC, inputBCSize]
    this.emit(Op.OP_ROT, locationData);              // [inputBC, inputBCSize, redeemPushSize]
    this.emit(Op.OP_SUB, locationData);              // [inputBC, msgDataSize]
    this.emit(Op.OP_SPLIT, locationData);            // [msgData, redeemScriptPush]
    this.emit(Op.OP_DROP, locationData);             // [msgData]
  }

  /**
   * Emit the _redeemPushSize computation at contract level (before OP_DEFINE).
   * At this point, OP_ACTIVEBYTECODE returns the full contract script (not a function body).
   *
   * Detects P2SH vs P2S at runtime:
   * - P2SH20 UTXO output: 23 bytes (OP_HASH160 <20> OP_EQUAL)
   * - P2SH32 UTXO output: 35 bytes (OP_HASH256 <32> OP_EQUAL)
   * - P2S UTXO output: full script (>> 35 bytes for any useful contract)
   *
   * For P2SH, computes the total push size of the trailing redeem script in the input bytecode
   * (script size + MINIMALDATA prefix size). For P2S, pushes 0 (no redeem script to strip).
   */
  private emitRedeemPushSizeComputation(locationData: SingleLocationData): void {
    // Detect P2SH: UTXO output size < 36 means P2SH20 or P2SH32
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_UTXOBYTECODE, locationData);
    this.emit(Op.OP_SIZE, locationData);
    this.emit(Op.OP_NIP, locationData);              // [utxoOutputSize]
    this.emit(encodeInt(36n), locationData);
    this.emit(Op.OP_LESSTHAN, locationData);         // [isP2SH]

    this.emit(Op.OP_IF, locationData);

    // P2SH path: compute total push size of trailing redeem script
    this.emit(Op.OP_ACTIVEBYTECODE, locationData);
    this.emit(Op.OP_SIZE, locationData);
    this.emit(Op.OP_NIP, locationData);              // [redeemScriptSize]

    // Compute MINIMALDATA pushdata prefix:
    //   size <= 75  -> 1 byte prefix (direct push opcode)
    //   size <= 255 -> 2 bytes prefix (OP_PUSHDATA1 + 1 byte length)
    //   else        -> 3 bytes prefix (OP_PUSHDATA2 + 2 byte length)
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(76n), locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_1ADD, locationData);             // totalPush = size + 1
    this.emit(Op.OP_ELSE, locationData);
    this.emit(Op.OP_DUP, locationData);
    this.emit(encodeInt(256n), locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    this.emit(Op.OP_IF, locationData);
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_ADD, locationData);              // totalPush = size + 2
    this.emit(Op.OP_ELSE, locationData);
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_ADD, locationData);              // totalPush = size + 3
    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_ELSE, locationData);

    // P2S path: no redeem script to strip
    this.emit(Op.OP_0, locationData);

    this.emit(Op.OP_ENDIF, locationData);
  }

  private emitMsgSender(locationData: SingleLocationData): void {
    // Pick _msgSenderCategory from the stack
    const catIdx = this.getStackIndex('__internal__msgSenderCategory');
    this.emit(encodeInt(BigInt(catIdx)), locationData);
    this.emit(Op.OP_PICK, locationData);

    // Compare to 32 zero bytes: NUM2BIN takes [value, byteLength] (length on top), so push 0 then 32.
    this.emit(Op.OP_0, locationData);
    this.emit(encodeInt(32n), locationData);
    this.emit(Op.OP_NUM2BIN, locationData);        // 32 zero bytes
    this.emit(Op.OP_EQUAL, locationData);

    this.emit(Op.OP_IF, locationData);
    // Zero category - direct call, use tx.origin
    this.emitTxOrigin(locationData);
    this.emit(Op.OP_ELSE, locationData);
    // Non-zero category - verify minting input and return its lockingBytecode
    this.emitMsgSenderMintingVerification(locationData);
    this.emit(Op.OP_ENDIF, locationData);
  }

  /**
   * Emit bytecode for msg.value - the satoshi difference between outputs and inputs
   * belonging to this contract's satoshi container.
   *
   * msg.value = output_balance - input_balance
   *
   * Stack before: [...]
   * Stack after:  [..., value]
   */
  private emitMsgValue(locationData: SingleLocationData): void {
    // Stateless contract (no block layout / satoshi container): msg.value is just the satoshi value of the
    // contract input being spent - there is no persistent balance to diff against.
    if (!this.currentFunction.blockLayout) {
      this.emit(Op.OP_INPUTINDEX, locationData);
      this.emit(Op.OP_UTXOVALUE, locationData);
      this.pushToStack('(value)');
      return;
    }
    // Get own category (32 bytes, strip capability flag)
    this.emitMasterInputIndex(locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.emit(encodeInt(32n), locationData);
    this.emit(Op.OP_SPLIT, locationData);
    this.emit(Op.OP_DROP, locationData);
    this.pushToStack('(value)');

    // Derive satoshi container P2SH32 locking bytecode from category
    this.emitSatoshiContainerLbc(locationData);

    // Duplicate lbc for two balance loops
    this.emit(Op.OP_DUP, locationData);
    this.pushToStack('(value)');

    // Output balance loop (consumes top lbc copy)
    this.emitBalanceLoop(true, locationData);

    // Swap so lbc is on top for input balance loop
    this.emit(Op.OP_SWAP, locationData);

    // Input balance loop (consumes lbc)
    this.emitBalanceLoop(false, locationData);

    // Stack: [output_sum, input_sum]
    // OP_SUB: a b -> a-b (second-from-top minus top)
    // Result: output_sum - input_sum
    this.emit(Op.OP_SUB, locationData);

    // Clean up stack tracking: we pushed 2 extra items (category + dup),
    // emitSatoshiContainerLbc and emitBalanceLoop each do pop+push (net 0),
    // so pop 2 to leave net 0 (visitNullaryOp does the final pushToStack)
    this.popFromStack(2);
  }

  /**
   * Emit bytecode for msg.sender minting verification.
   * Scan inputs for one with matching category + minting capability (0x02),
   * and return its lockingBytecode.
   *
   * Stack before: [...]
   * Stack after:  [..., lockingBytecode]
   */
  private emitMsgSenderMintingVerification(locationData: SingleLocationData): void {
    // Pick _msgSenderCategory again (we consumed it in the comparison)
    const catIdx = this.getStackIndex('__internal__msgSenderCategory');
    this.emit(encodeInt(BigInt(catIdx)), locationData);
    this.emit(Op.OP_PICK, locationData);
    // CAT with 0x02 to build expected 33-byte category+capability
    this.emit(new Uint8Array([0x02]), locationData);
    this.emit(Op.OP_CAT, locationData);
    // Stack: [expected_33bytes]

    // Push sentinel and counter
    this.emit(Op.OP_0, locationData);              // sentinel
    this.emit(Op.OP_0, locationData);              // i = 0

    this.emit(Op.OP_BEGIN, locationData);

    // Check: i < tx.inputs.length
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_TXINPUTCOUNT, locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    this.emit(Op.OP_IF, locationData);

    // Stack: [expected, sentinel, i]
    // Skip self
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_NUMEQUAL, locationData);
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_1ADD, locationData);
    this.emit(Op.OP_0, locationData);              // continue
    this.emit(Op.OP_ELSE, locationData);

    // Get OP_UTXOTOKENCATEGORY at [i] (includes capability byte if present)
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    // Compare to expected (33-byte: category + 0x02 minting)
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_PICK, locationData);           // pick expected (deep: expected, sentinel, i, cat_i)
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);

    // MATCH: get lockingBytecode at [i], replace sentinel
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_UTXOBYTECODE, locationData);   // [expected, sentinel, i, lbc]
    this.emit(Op.OP_ROT, locationData);             // [expected, i, lbc, sentinel]
    this.emit(Op.OP_DROP, locationData);             // [expected, i, lbc]
    this.emit(Op.OP_SWAP, locationData);             // [expected, lbc, i]
    // Force loop exit
    this.emit(Op.OP_TXINPUTCOUNT, locationData);
    this.emit(Op.OP_NIP, locationData);             // [expected, lbc, count]
    this.emit(Op.OP_1, locationData);               // exit loop
    this.emit(Op.OP_ELSE, locationData);

    // No match - i++, continue
    this.emit(Op.OP_1ADD, locationData);
    this.emit(Op.OP_0, locationData);              // continue
    this.emit(Op.OP_ENDIF, locationData);          // end category match check

    this.emit(Op.OP_ENDIF, locationData);          // end self check

    this.emit(Op.OP_ELSE, locationData);
    // i >= count - exit loop
    this.emit(Op.OP_1, locationData);
    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_UNTIL, locationData);

    // Stack: [expected, result, i]
    this.emit(Op.OP_DROP, locationData);           // drop i
    this.emit(Op.OP_SWAP, locationData);           // [result, expected]
    this.emit(Op.OP_DROP, locationData);           // drop expected
    // Stack: [result]

    // Verify result is not sentinel
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_SIZE, locationData);
    this.emit(Op.OP_NIP, locationData);
    this.emit(Op.OP_0NOTEQUAL, locationData);
    this.emit(Op.OP_VERIFY, locationData);
    // Stack: [lockingBytecode]
  }

  // ===== Address Balance Loop Support =====

  /**
   * Emit a loop that sums values of inputs/outputs matching the locking bytecode on top of stack.
   *
   * Stack before: [..., target_lbc]
   * Stack after:  [..., sum]
   *
   * @param useOutputs - if true, loop over tx outputs; if false, loop over tx inputs
   */
  private emitBalanceLoop(useOutputs: boolean, locationData: SingleLocationData): void {
    const countOp = useOutputs ? Op.OP_TXOUTPUTCOUNT : Op.OP_TXINPUTCOUNT;
    const bytecodeOp = useOutputs ? Op.OP_OUTPUTBYTECODE : Op.OP_UTXOBYTECODE;
    const valueOp = useOutputs ? Op.OP_OUTPUTVALUE : Op.OP_UTXOVALUE;

    // Stack: [target_lbc]
    this.emit(Op.OP_0, locationData);          // sum = 0
    this.emit(Op.OP_0, locationData);          // i = 0

    this.emit(Op.OP_BEGIN, locationData);

    // Check: i < count
    this.emit(Op.OP_DUP, locationData);
    this.emit(countOp, locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    this.emit(Op.OP_IF, locationData);

    // Stack inside if: [target_lbc, sum, i]
    // Compare lbc at index i with target
    this.emit(Op.OP_DUP, locationData);        // dup i
    this.emit(bytecodeOp, locationData);        // get lbc at [i]
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_PICK, locationData);        // pick target_lbc (3 deep: target, sum, i, lbc_i)
    this.emit(Op.OP_EQUAL, locationData);       // compare
    this.emit(Op.OP_IF, locationData);

    // Match - add value
    this.emit(Op.OP_DUP, locationData);         // dup i
    this.emit(valueOp, locationData);            // get value at [i]
    // Stack: [target_lbc, sum, i, value_i]
    // We need: sum += value_i, preserving the stack layout [target_lbc, new_sum, i]
    // 2 OP_PICK -> [target_lbc, sum, i, value_i, sum]
    // OP_ADD -> [target_lbc, sum, i, sum+value_i]
    // 2 OP_ROLL -> [target_lbc, i, sum+value_i, old_sum]
    // OP_DROP -> [target_lbc, i, sum+value_i]
    // OP_SWAP -> [target_lbc, sum+value_i, i]
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_PICK, locationData);        // pick sum
    this.emit(Op.OP_ADD, locationData);          // sum + value_i
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_ROLL, locationData);         // roll old sum to top
    this.emit(Op.OP_DROP, locationData);          // drop old sum
    this.emit(Op.OP_SWAP, locationData);          // [target_lbc, new_sum, i]

    this.emit(Op.OP_ENDIF, locationData);       // end inner if (match check)

    // i++
    this.emit(Op.OP_1ADD, locationData);

    // Push 0 (false) to continue loop
    this.emit(Op.OP_0, locationData);

    this.emit(Op.OP_ELSE, locationData);

    // Loop done - push 1 (true) to exit
    this.emit(Op.OP_1, locationData);

    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_UNTIL, locationData);

    // Stack: [target_lbc, sum, i]
    this.emit(Op.OP_DROP, locationData);          // drop i
    this.emit(Op.OP_SWAP, locationData);           // [sum, target_lbc]
    this.emit(Op.OP_DROP, locationData);           // drop target_lbc
    // Stack: [sum]

    // Stack tracking: we consumed the target_lbc and replaced it with sum
    this.popFromStack();
    this.pushToStack('(value)');
  }

  /**
   * Extract the hash from a P2SH20 or P2SH32 locking bytecode on the stack.
   *
   * P2SH20 format: a9 14 <20-byte-hash> 87  (23 bytes total)
   * P2SH32 format: aa 20 <32-byte-hash> 87  (35 bytes total)
   *
   * Stack before: [..., lbc]
   * Stack after:  [..., hash]
   * Runtime VERIFY-fails if not P2SH20 or P2SH32.
   */
  private emitCodehash(locationData: SingleLocationData): void {
    // Stack: [lbc]
    // Validate P2SH: length must be 23 (P2SH20) or 35 (P2SH32)
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_SIZE, locationData);
    this.emit(Op.OP_NIP, locationData);           // [lbc, len]
    this.emit(Op.OP_DUP, locationData);           // [lbc, len, len]
    this.emit(encodeInt(23n), locationData);
    this.emit(Op.OP_EQUAL, locationData);          // [lbc, len, is23]
    this.emit(Op.OP_OVER, locationData);           // [lbc, len, is23, len]
    this.emit(encodeInt(35n), locationData);
    this.emit(Op.OP_EQUAL, locationData);          // [lbc, len, is23, is35]
    this.emit(Op.OP_BOOLOR, locationData);         // [lbc, len, isP2SH]
    this.emit(Op.OP_VERIFY, locationData);         // [lbc, len] - FAIL if not P2SH

    // Validate P2SH prefix byte: first byte must be a9 (P2SH20) or aa (P2SH32)
    // and suffix byte: last byte must be 87 (OP_EQUAL)
    this.emit(Op.OP_SWAP, locationData);           // [len, lbc]
    this.emit(Op.OP_DUP, locationData);            // [len, lbc, lbc]
    this.emit(Op.OP_1, locationData);
    this.emit(Op.OP_SPLIT, locationData);          // [len, lbc, firstByte, rest]
    this.emit(Op.OP_DROP, locationData);           // [len, lbc, firstByte]
    // firstByte must be a9 (0xa9=169) or aa (0xaa=170)
    this.emit(Op.OP_DUP, locationData);            // [len, lbc, firstByte, firstByte]
    this.emit(hexToBin('a9'), locationData);       // push 0xa9
    this.emit(Op.OP_EQUAL, locationData);          // [len, lbc, firstByte, isA9]
    this.emit(Op.OP_SWAP, locationData);           // [len, lbc, isA9, firstByte]
    this.emit(hexToBin('aa'), locationData);       // push 0xaa
    this.emit(Op.OP_EQUAL, locationData);          // [len, lbc, isA9, isAA]
    this.emit(Op.OP_BOOLOR, locationData);         // [len, lbc, validPrefix]
    this.emit(Op.OP_VERIFY, locationData);         // [len, lbc] - FAIL if invalid prefix

    // Validate last byte is 0x87 (OP_EQUAL)
    this.emit(Op.OP_DUP, locationData);            // [len, lbc, lbc]
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_PICK, locationData);           // [len, lbc, lbc, len]
    this.emit(Op.OP_1, locationData);
    this.emit(Op.OP_SUB, locationData);            // [len, lbc, lbc, len-1]
    this.emit(Op.OP_SPLIT, locationData);          // [len, lbc, prefix, lastByte]
    this.emit(Op.OP_NIP, locationData);            // [len, lbc, lastByte]
    this.emit(P2SH32_LBC_SUFFIX, locationData);    // push 0x87 (OP_EQUAL)
    this.emit(Op.OP_EQUALVERIFY, locationData);    // [len, lbc] - FAIL if last byte != 0x87

    // Extract: skip first 2 bytes (hashOp + pushdataByte), drop last byte (OP_EQUAL)
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_SPLIT, locationData);          // [len, prefix, hash_plus_equal]
    this.emit(Op.OP_NIP, locationData);            // [len, hash_plus_equal]
    this.emit(Op.OP_SWAP, locationData);           // [hash_plus_equal, len]
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_SUB, locationData);            // [hash_plus_equal, hash_len] (20 for p2sh20, 32 for p2sh32)
    this.emit(Op.OP_SPLIT, locationData);          // [hash, equal_byte]
    this.emit(Op.OP_DROP, locationData);           // [hash]

    // Stack tracking: consumed lbc, produced hash
    this.popFromStack();
    this.pushToStack('(value)');
  }

  /**
   * Extract the redeem script (contract bytecode) from a matching tx input.
   *
   * Fast path: if the address matches the current input's locking bytecode,
   * use OP_ACTIVEBYTECODE directly.
   *
   * Slow path: scan tx inputs, find one whose UTXO locking bytecode matches,
   * then forward-parse its unlocking bytecode to extract the last pushdata
   * element (which is the serialized redeem script).
   *
   * Stack before: [..., lbc]
   * Stack after:  [..., redeemScript]
   * Runtime VERIFY-fails if not P2SH20 or P2SH32.
   */
  private emitCode(locationData: SingleLocationData): void {
    // Stack: [lbc]
    this.emit(Op.OP_DUP, locationData);            // [lbc, lbc]

    // Validate P2SH format
    this.emit(Op.OP_DUP, locationData);            // [lbc, lbc, lbc]
    this.emit(Op.OP_SIZE, locationData);
    this.emit(Op.OP_NIP, locationData);            // [lbc, lbc, len]
    this.emit(Op.OP_DUP, locationData);            // [lbc, lbc, len, len]
    this.emit(encodeInt(23n), locationData);
    this.emit(Op.OP_EQUAL, locationData);          // [lbc, lbc, len, is23]
    this.emit(Op.OP_OVER, locationData);           // [lbc, lbc, len, is23, len]
    this.emit(encodeInt(35n), locationData);
    this.emit(Op.OP_EQUAL, locationData);          // [lbc, lbc, len, is23, is35]
    this.emit(Op.OP_BOOLOR, locationData);         // [lbc, lbc, len, isP2SH]
    this.emit(Op.OP_VERIFY, locationData);         // [lbc, lbc, len] - FAIL if not P2SH
    this.emit(Op.OP_DROP, locationData);           // [lbc, lbc]

    // Check: does this match current input's lockingBytecode?
    this.emit(Op.OP_INPUTINDEX, locationData);
    this.emit(Op.OP_UTXOBYTECODE, locationData);   // [lbc, lbc, my_lbc]
    this.emit(Op.OP_EQUAL, locationData);          // [lbc, is_self]

    this.emit(Op.OP_IF, locationData);
    // Fast path: self - use OP_ACTIVEBYTECODE
    this.emit(Op.OP_DROP, locationData);           // []
    this.emit(Op.OP_ACTIVEBYTECODE, locationData); // [redeemScript]

    this.emit(Op.OP_ELSE, locationData);
    // Slow path: scan inputs to find match, extract redeem script from unlocking bytecode
    this.emitCodeSlowPath(locationData);

    this.emit(Op.OP_ENDIF, locationData);

    // Stack tracking: consumed lbc, produced redeemScript
    this.popFromStack();
    this.pushToStack('(value)');
  }

  /**
   * Slow path for .code: scan tx inputs, find one whose UTXO locking bytecode
   * matches the target lbc on stack, then extract the last pushdata from its
   * unlocking bytecode (which is the serialized redeem script).
   *
   * Stack before: [..., lbc]
   * Stack after:  [..., redeemScript]
   */
  private emitCodeSlowPath(locationData: SingleLocationData): void {
    // Stack: [lbc]
    this.emit(Op.OP_0, locationData);              // [lbc, found=0]
    this.emit(Op.OP_0, locationData);              // [lbc, found, i=0]

    this.emit(Op.OP_BEGIN, locationData);

    // Check: i < tx.inputs.length
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_TXINPUTCOUNT, locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    this.emit(Op.OP_IF, locationData);

    // Stack: [lbc, found, i]
    this.emit(Op.OP_DUP, locationData);            // [lbc, found, i, i]
    this.emit(Op.OP_UTXOBYTECODE, locationData);   // [lbc, found, i, lbc_i]
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_PICK, locationData);           // [lbc, found, i, lbc_i, lbc]
    this.emit(Op.OP_EQUAL, locationData);          // [lbc, found, i, match?]

    this.emit(Op.OP_IF, locationData);
    // Found match - get unlocking bytecode and extract last pushdata
    // Stack: [lbc, found, i]
    this.emit(Op.OP_DUP, locationData);            // [lbc, found, i, i]
    this.emit(Op.OP_INPUTBYTECODE, locationData);  // [lbc, found, i, ub]

    // Extract last pushdata element from ub
    this.emitExtractLastPush(locationData);
    // Stack: [lbc, found, i, redeemScript]

    // Clean up: [redeemScript, found=1]
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_ROLL, locationData);           // [found, i, redeemScript, lbc]
    this.emit(Op.OP_DROP, locationData);           // [found, i, redeemScript]
    this.emit(Op.OP_ROT, locationData);            // [i, redeemScript, found]
    this.emit(Op.OP_DROP, locationData);           // [i, redeemScript]
    this.emit(Op.OP_1, locationData);              // [i, redeemScript, found=1]
    this.emit(Op.OP_SWAP, locationData);           // [i, found=1, redeemScript]
    this.emit(Op.OP_ROT, locationData);            // [found=1, redeemScript, i]
    this.emit(Op.OP_DROP, locationData);           // [found=1, redeemScript]

    // Force loop exit: push txinputcount as i, then 0 for continue signal
    this.emit(Op.OP_TXINPUTCOUNT, locationData);   // [found=1, redeemScript, count]
    this.emit(Op.OP_0, locationData);              // [found=1, redeemScript, count, 0]

    this.emit(Op.OP_ELSE, locationData);
    // No match - increment i and continue
    this.emit(Op.OP_1ADD, locationData);
    this.emit(Op.OP_0, locationData);

    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_ELSE, locationData);
    // Loop done - exit
    this.emit(Op.OP_1, locationData);

    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_UNTIL, locationData);

    // Stack: [found, result, i] or [lbc, found=0, i]
    // When found: [found=1, redeemScript, txinputcount]
    // When not found: [lbc, found=0, txinputcount]
    this.emit(Op.OP_DROP, locationData);           // drop i

    // Stack: [found, redeemScript] or [lbc, found=0]
    // Swap to get found on top, then VERIFY
    this.emit(Op.OP_SWAP, locationData);           // [redeemScript, found] or [found=0, lbc]
    this.emit(Op.OP_VERIFY, locationData);         // [redeemScript] - FAIL if no match found
  }

  /**
   * Forward-parse through a serialized script (unlocking bytecode) on the stack
   * to extract the last pushdata element (the redeem script).
   *
   * Scans byte-by-byte through the script opcodes to find the start of the last
   * push element, then extracts just its data payload (without the opcode prefix).
   *
   * Stack before: [..., ub]
   * Stack after:  [..., lastPushData]
   */
  private emitExtractLastPush(locationData: SingleLocationData): void {
    // Stack: [ub]
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_SIZE, locationData);
    this.emit(Op.OP_NIP, locationData);            // [ub, total]
    this.emit(Op.OP_0, locationData);              // [ub, total, pos=0]
    this.emit(Op.OP_DUP, locationData);            // [ub, total, pos, lastPos=0]

    this.emit(Op.OP_BEGIN, locationData);

    // Check: pos < total?
    // Stack: [ub, total, pos, lastPos]
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_PICK, locationData);           // [ub, total, pos, lastPos, total]
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_PICK, locationData);           // [ub, total, pos, lastPos, total, pos]
    this.emit(Op.OP_GREATERTHAN, locationData);    // [ub, total, pos, lastPos, total>pos]

    this.emit(Op.OP_IF, locationData);

    // pos < total: update lastPos = pos, then compute element size
    // Stack: [ub, total, pos, lastPos]
    this.emit(Op.OP_DROP, locationData);           // [ub, total, pos] - drop old lastPos
    this.emit(Op.OP_DUP, locationData);            // [ub, total, pos, newLastPos=pos]
    this.emit(Op.OP_OVER, locationData);           // [ub, total, pos, lastPos, pos]

    // Read the opcode byte at position pos from ub
    // Stack: [ub, total, pos, lastPos, pos]
    this.emit(encodeInt(4n), locationData);
    this.emit(Op.OP_PICK, locationData);           // [ub, total, pos, lastPos, pos, ub]
    this.emit(Op.OP_SWAP, locationData);           // [ub, total, pos, lastPos, ub, pos]
    this.emit(Op.OP_SPLIT, locationData);          // [ub, total, pos, lastPos, ub_before, ub_from_pos]
    this.emit(Op.OP_NIP, locationData);            // [ub, total, pos, lastPos, ub_from_pos]
    this.emit(Op.OP_1, locationData);
    this.emit(Op.OP_SPLIT, locationData);          // [ub, total, pos, lastPos, opcode_byte, ub_rest]
    this.emit(Op.OP_DROP, locationData);           // [ub, total, pos, lastPos, opcode_byte]

    // Convert opcode byte to unsigned integer using OP_0 OP_CAT OP_BIN2NUM
    // This forces unsigned interpretation by prepending a 0x00 byte (clearing sign bit)
    // e.g. 0x80 -> [0x80, 0x00] -> BIN2NUM -> 128 (not negative zero)
    this.emit(Op.OP_0, locationData);
    this.emit(Op.OP_CAT, locationData);
    this.emit(Op.OP_BIN2NUM, locationData);        // [ub, total, pos, lastPos, opcodeInt] (unsigned)

    // Compute element_size based on opcode:
    //   0x00         -> 1 (OP_0: just the opcode, pushes empty bytes)
    //   0x01-0x4b    -> 1 + opcode (direct push)
    //   0x4c (76)    -> 2 + next_byte_as_length (PUSHDATA1)
    //   0x4d (77)    -> 3 + next_2bytes_as_LE_length (PUSHDATA2)
    //   0x4e (78)    -> 5 + next_4bytes_as_LE_length (PUSHDATA4)
    //   anything else -> 1 (single-byte opcode)

    // Check: opcode == 0?
    this.emit(Op.OP_DUP, locationData);            // [ub, total, pos, lastPos, op, op]
    this.emit(Op.OP_0, locationData);
    this.emit(Op.OP_EQUAL, locationData);          // [ub, total, pos, lastPos, op, isZero]
    this.emit(Op.OP_IF, locationData);
    // OP_0: element size = 1
    this.emit(Op.OP_DROP, locationData);           // [ub, total, pos, lastPos]
    this.emit(Op.OP_1, locationData);              // [ub, total, pos, lastPos, size=1]
    this.emit(Op.OP_ELSE, locationData);

    // Check: 1 <= opcode <= 75? (direct push)
    this.emit(Op.OP_DUP, locationData);            // [ub, total, pos, lastPos, op, op]
    this.emit(encodeInt(75n), locationData);
    this.emit(Op.OP_LESSTHANOREQUAL, locationData); // [ub, total, pos, lastPos, op, isDirectPush]
    this.emit(Op.OP_IF, locationData);
    // Direct push: element size = 1 + opcode
    this.emit(Op.OP_1ADD, locationData);           // [ub, total, pos, lastPos, size=1+op]
    this.emit(Op.OP_ELSE, locationData);

    // Check: opcode == 76? (PUSHDATA1)
    this.emit(Op.OP_DUP, locationData);            // [ub, total, pos, lastPos, op, op]
    this.emit(encodeInt(76n), locationData);
    this.emit(Op.OP_EQUAL, locationData);          // [ub, total, pos, lastPos, op, isPD1]
    this.emit(Op.OP_IF, locationData);
    // PUSHDATA1: read next byte as unsigned length
    this.emit(Op.OP_DROP, locationData);           // [ub, total, pos, lastPos]
    this.emit(Op.OP_OVER, locationData);           // [ub, total, pos, lastPos, pos]
    this.emit(Op.OP_1ADD, locationData);           // [ub, total, pos, lastPos, pos+1]
    this.emit(encodeInt(4n), locationData);
    this.emit(Op.OP_PICK, locationData);           // [ub, total, pos, lastPos, pos+1, ub]
    this.emit(Op.OP_SWAP, locationData);           // [ub, total, pos, lastPos, ub, pos+1]
    this.emit(Op.OP_SPLIT, locationData);          // [ub, total, pos, lastPos, _, ub_from_pos1]
    this.emit(Op.OP_NIP, locationData);            // [ub, total, pos, lastPos, ub_from_pos1]
    this.emit(Op.OP_1, locationData);
    this.emit(Op.OP_SPLIT, locationData);          // [ub, total, pos, lastPos, len_byte, _]
    this.emit(Op.OP_DROP, locationData);           // [ub, total, pos, lastPos, len_byte]
    // Unsigned interpretation: prepend 0x00 to prevent sign-bit issue for bytes >= 0x80
    this.emit(Op.OP_0, locationData);
    this.emit(Op.OP_CAT, locationData);
    this.emit(Op.OP_BIN2NUM, locationData);        // [ub, total, pos, lastPos, dataLen] (unsigned)
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_ADD, locationData);            // [ub, total, pos, lastPos, size=2+dataLen]
    this.emit(Op.OP_ELSE, locationData);

    // Check: opcode == 77? (PUSHDATA2)
    this.emit(Op.OP_DUP, locationData);            // [ub, total, pos, lastPos, op, op]
    this.emit(encodeInt(77n), locationData);
    this.emit(Op.OP_EQUAL, locationData);          // [ub, total, pos, lastPos, op, isPD2]
    this.emit(Op.OP_IF, locationData);
    // PUSHDATA2: read next 2 bytes as unsigned LE length
    this.emit(Op.OP_DROP, locationData);           // [ub, total, pos, lastPos]
    this.emit(Op.OP_OVER, locationData);           // [ub, total, pos, lastPos, pos]
    this.emit(Op.OP_1ADD, locationData);           // [ub, total, pos, lastPos, pos+1]
    this.emit(encodeInt(4n), locationData);
    this.emit(Op.OP_PICK, locationData);           // [ub, total, pos, lastPos, pos+1, ub]
    this.emit(Op.OP_SWAP, locationData);           // [ub, total, pos, lastPos, ub, pos+1]
    this.emit(Op.OP_SPLIT, locationData);          // [ub, total, pos, lastPos, _, ub_from_pos1]
    this.emit(Op.OP_NIP, locationData);            // [ub, total, pos, lastPos, ub_from_pos1]
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_SPLIT, locationData);          // [ub, total, pos, lastPos, len_bytes, _]
    this.emit(Op.OP_DROP, locationData);           // [ub, total, pos, lastPos, len_bytes]
    // Unsigned interpretation: prepend 0x00 for sign safety
    this.emit(Op.OP_0, locationData);
    this.emit(Op.OP_CAT, locationData);
    this.emit(Op.OP_BIN2NUM, locationData);        // [ub, total, pos, lastPos, dataLen] (unsigned)
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_ADD, locationData);            // [ub, total, pos, lastPos, size=3+dataLen]
    this.emit(Op.OP_ELSE, locationData);

    // Check: opcode == 78? (PUSHDATA4)
    this.emit(Op.OP_DUP, locationData);            // [ub, total, pos, lastPos, op, op]
    this.emit(encodeInt(78n), locationData);
    this.emit(Op.OP_EQUAL, locationData);          // [ub, total, pos, lastPos, op, isPD4]
    this.emit(Op.OP_IF, locationData);
    // PUSHDATA4: read next 4 bytes as unsigned LE length
    this.emit(Op.OP_DROP, locationData);           // [ub, total, pos, lastPos]
    this.emit(Op.OP_OVER, locationData);           // [ub, total, pos, lastPos, pos]
    this.emit(Op.OP_1ADD, locationData);           // [ub, total, pos, lastPos, pos+1]
    this.emit(encodeInt(4n), locationData);
    this.emit(Op.OP_PICK, locationData);           // [ub, total, pos, lastPos, pos+1, ub]
    this.emit(Op.OP_SWAP, locationData);           // [ub, total, pos, lastPos, ub, pos+1]
    this.emit(Op.OP_SPLIT, locationData);          // [ub, total, pos, lastPos, _, ub_from_pos1]
    this.emit(Op.OP_NIP, locationData);            // [ub, total, pos, lastPos, ub_from_pos1]
    this.emit(encodeInt(4n), locationData);
    this.emit(Op.OP_SPLIT, locationData);          // [ub, total, pos, lastPos, len_bytes, _]
    this.emit(Op.OP_DROP, locationData);           // [ub, total, pos, lastPos, len_bytes]
    this.emit(Op.OP_0, locationData);
    this.emit(Op.OP_CAT, locationData);
    this.emit(Op.OP_BIN2NUM, locationData);        // [ub, total, pos, lastPos, dataLen] (unsigned)
    this.emit(encodeInt(5n), locationData);
    this.emit(Op.OP_ADD, locationData);            // [ub, total, pos, lastPos, size=5+dataLen]
    this.emit(Op.OP_ELSE, locationData);

    // Anything else: single-byte opcode, element size = 1
    this.emit(Op.OP_DROP, locationData);           // [ub, total, pos, lastPos]
    this.emit(Op.OP_1, locationData);              // [ub, total, pos, lastPos, size=1]

    this.emit(Op.OP_ENDIF, locationData);          // end PUSHDATA4 check
    this.emit(Op.OP_ENDIF, locationData);          // end PUSHDATA2 check
    this.emit(Op.OP_ENDIF, locationData);          // end PUSHDATA1 check
    this.emit(Op.OP_ENDIF, locationData);          // end direct push check
    this.emit(Op.OP_ENDIF, locationData);          // end OP_0 check

    // Stack: [ub, total, pos, lastPos, elementSize]
    // Advance pos: pos = pos + elementSize
    // Stack goal: [ub, total, newPos, lastPos]
    this.emit(Op.OP_ROT, locationData);            // [ub, total, lastPos, elementSize, pos]
    this.emit(Op.OP_ADD, locationData);            // [ub, total, lastPos, newPos]
    this.emit(Op.OP_SWAP, locationData);           // [ub, total, newPos, lastPos]

    // Continue loop
    this.emit(Op.OP_0, locationData);

    this.emit(Op.OP_ELSE, locationData);
    // pos >= total: exit loop
    this.emit(Op.OP_1, locationData);

    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_UNTIL, locationData);

    // Stack: [ub, total, pos, lastPos]
    // lastPos = start of the last element in the unlocking bytecode
    // Now extract just the data of that last element (skip its opcode/length prefix)

    // Read opcode at lastPos (unsigned)
    this.emit(Op.OP_NIP, locationData);            // [ub, total, lastPos]
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_PICK, locationData);           // [ub, total, lastPos, ub]
    this.emit(Op.OP_OVER, locationData);           // [ub, total, lastPos, ub, lastPos]
    this.emit(Op.OP_SPLIT, locationData);          // [ub, total, lastPos, _, ub_from_lp]
    this.emit(Op.OP_NIP, locationData);            // [ub, total, lastPos, ub_from_lp]
    this.emit(Op.OP_1, locationData);
    this.emit(Op.OP_SPLIT, locationData);          // [ub, total, lastPos, opByte, ub_rest]
    this.emit(Op.OP_DROP, locationData);           // [ub, total, lastPos, opByte]
    this.emit(Op.OP_0, locationData);
    this.emit(Op.OP_CAT, locationData);
    this.emit(Op.OP_BIN2NUM, locationData);        // [ub, total, lastPos, opInt] (unsigned)

    // Compute prefix size (bytes to skip before raw data):
    //   0x01-0x4b: prefix=1 (just the opcode)
    //   0x4c (76): prefix=2 (opcode + 1 length byte)
    //   0x4d (77): prefix=3 (opcode + 2 length bytes)
    //   0x4e (78): prefix=5 (opcode + 4 length bytes)
    //   anything else: prefix=1

    this.emit(Op.OP_DUP, locationData);            // [ub, total, lastPos, op, op]
    this.emit(encodeInt(76n), locationData);
    this.emit(Op.OP_EQUAL, locationData);          // [ub, total, lastPos, op, isPD1]
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_DROP, locationData);           // [ub, total, lastPos]
    this.emit(encodeInt(2n), locationData);         // [ub, total, lastPos, prefixSize=2]
    this.emit(Op.OP_ELSE, locationData);

    this.emit(Op.OP_DUP, locationData);            // [ub, total, lastPos, op, op]
    this.emit(encodeInt(77n), locationData);
    this.emit(Op.OP_EQUAL, locationData);          // [ub, total, lastPos, op, isPD2]
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_DROP, locationData);           // [ub, total, lastPos]
    this.emit(encodeInt(3n), locationData);         // [ub, total, lastPos, prefixSize=3]
    this.emit(Op.OP_ELSE, locationData);

    this.emit(Op.OP_DUP, locationData);            // [ub, total, lastPos, op, op]
    this.emit(encodeInt(78n), locationData);
    this.emit(Op.OP_EQUAL, locationData);          // [ub, total, lastPos, op, isPD4]
    this.emit(Op.OP_IF, locationData);
    this.emit(Op.OP_DROP, locationData);           // [ub, total, lastPos]
    this.emit(encodeInt(5n), locationData);         // [ub, total, lastPos, prefixSize=5]
    this.emit(Op.OP_ELSE, locationData);
    // Default: prefix=1 (direct push or other opcode)
    this.emit(Op.OP_DROP, locationData);           // [ub, total, lastPos]
    this.emit(Op.OP_1, locationData);              // [ub, total, lastPos, prefixSize=1]
    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_ENDIF, locationData);
    this.emit(Op.OP_ENDIF, locationData);

    // Stack: [ub, total, lastPos, prefixSize]
    // dataStart = lastPos + prefixSize
    this.emit(Op.OP_ADD, locationData);            // [ub, total, dataStart]

    // Extract: ub from dataStart to end
    // dataLen = total - dataStart
    this.emit(Op.OP_SWAP, locationData);           // [ub, dataStart, total]
    this.emit(Op.OP_OVER, locationData);           // [ub, dataStart, total, dataStart]
    this.emit(Op.OP_SUB, locationData);            // [ub, dataStart, dataLen]
    this.emit(Op.OP_ROT, locationData);            // [dataStart, dataLen, ub]
    this.emit(Op.OP_ROT, locationData);            // [dataLen, ub, dataStart]
    this.emit(Op.OP_SPLIT, locationData);          // [dataLen, ub_before, ub_from_dataStart]
    this.emit(Op.OP_NIP, locationData);            // [dataLen, ub_from_dataStart]
    this.emit(Op.OP_SWAP, locationData);           // [ub_from_dataStart, dataLen]
    this.emit(Op.OP_SPLIT, locationData);          // [data, remainder]
    this.emit(Op.OP_DROP, locationData);           // [data]
  }

  /**
   * Derive a P2SH32 locking bytecode from a category ID on top of the stack.
   *
   * The satoshi container covenant script structure:
   * prefix (7 bytes): 63 ce 01 20 7f 52 88
   * 20 <categoryId:32bytes>                     (33 bytes - pushdata-encoded cat)
   * middle (48 bytes):
   *   88 67 76 76 76 cd c0 c7 88 cc c0 c6 a2 69 d1 c0 ce 88
   *   d3 c0 d0 a2 69 c0 c7 c3 8c 65 76 c0 9c 64 76 c7 52 79
   *   87 91 69 68 8c 76 00 9f 66 75 75 68
   * 20 <categoryId:32bytes>                     (33 bytes - pushdata-encoded cat)
   * suffix (2 bytes): 75 51
   *
   * Stack before: [..., category]
   * Stack after:  [..., p2sh32_locking_bytecode]
   */
  private emitSatoshiContainerLbc(locationData: SingleLocationData): void {
    // Shared as a subroutine when used >=2x; replicate the inline net effect (category -> lbc).
    if (this.invokeSubroutineIfDefined(GenerateTargetTraversalWithLocation.SATOSHI_LBC_SUBROUTINE_ID, locationData)) {
      this.popFromStack();
      this.pushToStack('(value)');
      return;
    }
    const prefix = hexToBin('63ce01207f5288');   // 7 bytes
    const middle = hexToBin('8867767676cdc0c788ccc0c6a269d1c0ce88d3c0d0a269c0c7c38c6576c09c6476c75279879169688c76009f66757568'); // 48 bytes
    const suffix = hexToBin('7551');             // 2 bytes
    const pushdata32 = hexToBin('20');           // OP_PUSHBYTES_32
    const p2sh32Prefix = P2SH32_LBC_PREFIX;      // OP_HASH256 + OP_PUSHBYTES_32
    const p2sh32Suffix = P2SH32_LBC_SUFFIX;     // OP_EQUAL

    // Stack: [category]
    this.emit(Op.OP_DUP, locationData);           // [cat, cat]

    // Encode as pushdata: prepend 0x20 byte
    this.emit(pushdata32, locationData);           // [cat, cat, 0x20]
    this.emit(Op.OP_SWAP, locationData);           // [cat, 0x20, cat]
    this.emit(Op.OP_CAT, locationData);            // [cat, 0x20||cat]

    this.emit(Op.OP_DUP, locationData);            // [cat, enc, enc]

    // Build: prefix || enc
    this.emit(prefix, locationData);               // [cat, enc, enc, prefix]
    this.emit(Op.OP_SWAP, locationData);           // [cat, enc, prefix, enc]
    this.emit(Op.OP_CAT, locationData);            // [cat, enc, prefix||enc]

    // Append middle
    this.emit(middle, locationData);               // [cat, enc, prefix||enc, middle]
    this.emit(Op.OP_CAT, locationData);            // [cat, enc, prefix||enc||middle]

    // Append second enc
    this.emit(Op.OP_SWAP, locationData);           // [cat, prefix||enc||middle, enc]
    this.emit(Op.OP_CAT, locationData);            // [cat, prefix||enc||middle||enc]

    // Append suffix
    this.emit(suffix, locationData);               // [cat, full_script, suffix]
    this.emit(Op.OP_CAT, locationData);            // [cat, full_script||suffix]

    // Drop the original category, keep the script
    this.emit(Op.OP_NIP, locationData);            // [full_covenant_script]

    // Hash to get the P2SH32 hash
    this.emit(Op.OP_HASH256, locationData);        // [hash256]

    // Build P2SH32 locking bytecode: 0xaa20 || hash || 0x87
    this.emit(p2sh32Prefix, locationData);         // [hash, 0xaa20]
    this.emit(Op.OP_SWAP, locationData);           // [0xaa20, hash]
    this.emit(Op.OP_CAT, locationData);            // [0xaa20||hash]
    this.emit(p2sh32Suffix, locationData);         // [0xaa20||hash, 0x87]
    this.emit(Op.OP_CAT, locationData);            // [p2sh32_lbc]

    // Stack tracking: category was consumed and replaced with p2sh32_lbc
    this.popFromStack();
    this.pushToStack('(value)');
  }

  // ===== Token Container Support =====

  /**
   * Derive a token container P2SH32 locking bytecode from masterCat + tcCat on top of the stack.
   *
   * Stack before: [..., masterCat, tcCat]
   * Stack after:  [..., p2sh32_locking_bytecode]
   *
   * Does NOT track stack - caller must manage push/pop.
   */
  private emitTokenContainerLbc(locationData: SingleLocationData): void {
    // Shared as a subroutine when used >=2x; like the inline body, leaves stack tracking to caller.
    if (this.invokeSubroutineIfDefined(GenerateTargetTraversalWithLocation.TOKEN_LBC_SUBROUTINE_ID, locationData)) {
      return;
    }
    // Token container covenant script (must match buildTokenContainerCovenantScript in state.ts):
    // OP_IF UTXOTOKENCATEGORY <32> SPLIT OP_2 EQUALVERIFY <masterCat> EQUALVERIFY
    //   OP_ELSE DUP DUP DUP OUTPUTBYTECODE INPUTINDEX UTXOBYTECODE EQUALVERIFY
    //     OUTPUTVALUE INPUTINDEX UTXOVALUE GREATERTHANOREQUAL VERIFY
    //     OUTPUTTOKENAMOUNT INPUTINDEX UTXOTOKENAMOUNT GREATERTHANOREQUAL VERIFY
    //     OUTPUTTOKENCATEGORY INPUTINDEX UTXOTOKENCATEGORY EQUALVERIFY
    //     single-input constraint loop
    //   OP_ENDIF <tcCat> DROP OP_1
    const prefix = new Uint8Array([0x63, 0xce, 0x01, 0x20, 0x7f, 0x52, 0x88]);
    const categoryPushPrefix = new Uint8Array([0x20]);
    // mid: EQUALVERIFY ELSE DUP DUP DUP OUTPUTBYTECODE INPUTINDEX UTXOBYTECODE EQUALVERIFY
    //   OUTPUTVALUE INPUTINDEX UTXOVALUE GREATERTHANOREQUAL VERIFY
    //   OUTPUTTOKENAMOUNT INPUTINDEX UTXOTOKENAMOUNT GREATERTHANOREQUAL VERIFY
    //   OUTPUTTOKENCATEGORY INPUTINDEX UTXOTOKENCATEGORY EQUALVERIFY
    //   single-input constraint loop ENDIF
    const mid = new Uint8Array([
      0x88, 0x67, 0x76, 0x76, 0x76, 0xcd, 0xc0, 0xc7, 0x88,
      0xcc, 0xc0, 0xc6, 0xa2, 0x69,
      0xd3, 0xc0, 0xd0, 0xa2, 0x69,
      0xd1, 0xc0, 0xce, 0x88,
      // Single-input constraint: INPUTINDEX UTXOBYTECODE TXINPUTCOUNT 1SUB BEGIN
      0xc0, 0xc7, 0xc3, 0x8c, 0x65,
      // DUP INPUTINDEX NUMEQUAL NOTIF DUP UTXOBYTECODE 2 PICK EQUAL NOT VERIFY ENDIF
      0x76, 0xc0, 0x9c, 0x64, 0x76, 0xc7, 0x52, 0x79, 0x87, 0x91, 0x69, 0x68,
      // 1SUB DUP 0 LESSTHAN UNTIL DROP DROP ENDIF
      0x8c, 0x76, 0x00, 0x9f, 0x66, 0x75, 0x75, 0x68,
    ]);
    const tcCatPushPrefix = new Uint8Array([0x20]);
    const suffix = new Uint8Array([0x75, 0x51]);

    // Stack: [masterCat, tcCat]
    // Build: prefix + 0x20 + masterCat + mid + 0x20 + tcCat + suffix
    this.emit(prefix, locationData);
    this.emit(categoryPushPrefix, locationData);
    // Stack: [masterCat, tcCat, prefix, catPushPrefix]

    // Roll masterCat to top (index 3)
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_ROLL, locationData);
    // Stack: [tcCat, prefix, catPushPrefix, masterCat]
    this.emit(Op.OP_CAT, locationData); // catPushPrefix + masterCat
    this.emit(Op.OP_CAT, locationData); // prefix + catPushPrefix + masterCat
    // Stack: [tcCat, (prefix+catPushPrefix+masterCat)]

    this.emit(mid, locationData);
    this.emit(Op.OP_CAT, locationData); // ... + mid
    // Stack: [tcCat, (...+mid)]

    this.emit(tcCatPushPrefix, locationData);
    // Stack: [tcCat, (...+mid), tcCatPushPrefix]

    // Roll tcCat to top (index 2)
    this.emit(encodeInt(2n), locationData);
    this.emit(Op.OP_ROLL, locationData);
    // Stack: [(...+mid), tcCatPushPrefix, tcCat]
    this.emit(Op.OP_CAT, locationData); // tcCatPushPrefix + tcCat
    this.emit(Op.OP_CAT, locationData); // full script
    // Stack: [full_script]

    this.emit(suffix, locationData);
    this.emit(Op.OP_CAT, locationData); // full script + suffix

    // Hash to P2SH32
    this.emit(Op.OP_HASH256, locationData);
    this.emit(P2SH32_LBC_PREFIX, locationData);
    this.emit(Op.OP_SWAP, locationData);
    this.emit(Op.OP_CAT, locationData);
    this.emit(P2SH32_LBC_SUFFIX, locationData);
    this.emit(Op.OP_CAT, locationData);
    // Stack: [p2sh32_lbc]
  }

  /**
   * Emit a loop that aggregates token data across all inputs or outputs matching
   * a given token container locking bytecode and token category.
   *
   * @param field - 'tokenAmount' sums FT amounts, 'nftCount' counts NFTs
   * @param useOutputs - if true, loop over tx outputs; if false, loop over tx inputs
   *
   * Stack before: [..., target_lbc, target_category]
   * Stack after:  [..., result]
   */
  private emitTokenContainerAggregateLoop(
    field: 'tokenAmount' | 'nftCount',
    useOutputs: boolean,
    locationData: SingleLocationData,
  ): void {
    const countOp = useOutputs ? Op.OP_TXOUTPUTCOUNT : Op.OP_TXINPUTCOUNT;
    const bytecodeOp = useOutputs ? Op.OP_OUTPUTBYTECODE : Op.OP_UTXOBYTECODE;
    const tokenCategoryOp = useOutputs ? Op.OP_OUTPUTTOKENCATEGORY : Op.OP_UTXOTOKENCATEGORY;
    const tokenAmountOp = useOutputs ? Op.OP_OUTPUTTOKENAMOUNT : Op.OP_UTXOTOKENAMOUNT;

    // Stack: [target_lbc, target_cat]
    this.emit(Op.OP_0, locationData);           // sum = 0
    this.emit(Op.OP_0, locationData);           // i = 0
    // Stack: [target_lbc, target_cat, sum, i]

    this.emit(Op.OP_BEGIN, locationData);

    // Check: i < count
    this.emit(Op.OP_DUP, locationData);
    this.emit(countOp, locationData);
    this.emit(Op.OP_LESSTHAN, locationData);
    this.emit(Op.OP_IF, locationData);

    // Stack: [target_lbc, target_cat, sum, i]
    // Check lbc match
    this.emit(Op.OP_DUP, locationData);         // dup i
    this.emit(bytecodeOp, locationData);         // lbc at [i]
    this.emit(encodeInt(4n), locationData);
    this.emit(Op.OP_PICK, locationData);         // pick target_lbc (4 deep: lbc, cat, sum, i, lbc_i)
    this.emit(Op.OP_EQUAL, locationData);
    this.emit(Op.OP_IF, locationData);

    // lbc matches - check token category base (32 bytes)
    this.emit(Op.OP_DUP, locationData);         // dup i
    this.emit(tokenCategoryOp, locationData);   // tokenCategory at [i]
    // tokenCategory may be 32 bytes (no NFT) or 33 bytes (with capability byte)
    // Extract base 32 bytes
    this.emit(Op.OP_DUP, locationData);
    this.emit(Op.OP_SIZE, locationData);
    this.emit(Op.OP_NIP, locationData);         // [target_lbc, target_cat, sum, i, fullCat, catLen]
    this.emit(encodeInt(32n), locationData);
    this.emit(Op.OP_GREATERTHANOREQUAL, locationData);
    this.emit(Op.OP_IF, locationData);

    // Category is at least 32 bytes -- extract base and compare
    this.emit(encodeInt(32n), locationData);
    this.emit(Op.OP_SPLIT, locationData);       // [target_lbc, target_cat, sum, i, baseCat, remainder]
    this.emit(Op.OP_DROP, locationData);         // drop remainder
    // OP_UTXOTOKENCATEGORY/OP_OUTPUTTOKENCATEGORY returns bytes in internal
    // (reversed) order. Reverse to display order to match the parameter.
    this.emit(Op.OP_REVERSEBYTES, locationData);
    // Stack: [target_lbc, target_cat, sum, i, baseCat_display]
    this.emit(encodeInt(3n), locationData);
    this.emit(Op.OP_PICK, locationData);         // pick target_cat
    this.emit(Op.OP_EQUAL, locationData);        // compare
    this.emit(Op.OP_IF, locationData);

    // Category matches - accumulate
    if (field === 'tokenAmount') {
      // Sum FT amounts: sum += input[i].tokenAmount
      this.emit(Op.OP_DUP, locationData);       // dup i
      this.emit(tokenAmountOp, locationData);   // tokenAmount at [i]
      // Stack: [target_lbc, target_cat, sum, i, amount]
      this.emit(encodeInt(2n), locationData);
      this.emit(Op.OP_PICK, locationData);       // pick sum
      this.emit(Op.OP_ADD, locationData);        // sum + amount
      this.emit(encodeInt(2n), locationData);
      this.emit(Op.OP_ROLL, locationData);       // roll old sum
      this.emit(Op.OP_DROP, locationData);        // drop old sum
      this.emit(Op.OP_SWAP, locationData);        // [target_lbc, target_cat, new_sum, i]
    } else {
      // Count NFTs: check if this input has an NFT (tokenCategory > 32 bytes)
      this.emit(Op.OP_DUP, locationData);       // dup i
      this.emit(tokenCategoryOp, locationData); // tokenCategory at [i]
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);        // [target_lbc, target_cat, sum, i, catLen]
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_GREATERTHAN, locationData); // catLen > 32 means has NFT
      this.emit(Op.OP_IF, locationData);
      // Has NFT - increment count
      // Stack: [target_lbc, target_cat, sum, i]
      this.emit(Op.OP_SWAP, locationData);       // [target_lbc, target_cat, i, sum]
      this.emit(Op.OP_1ADD, locationData);        // sum++
      this.emit(Op.OP_SWAP, locationData);        // [target_lbc, target_cat, sum, i]
      this.emit(Op.OP_ENDIF, locationData);       // end NFT check
    }

    this.emit(Op.OP_ENDIF, locationData);       // end category match

    this.emit(Op.OP_ELSE, locationData);
    // Category too short (< 32 bytes) - drop it
    this.emit(Op.OP_DROP, locationData);         // drop fullCat
    this.emit(Op.OP_ENDIF, locationData);        // end size check

    this.emit(Op.OP_ENDIF, locationData);       // end lbc match

    // i++
    this.emit(Op.OP_1ADD, locationData);
    this.emit(Op.OP_0, locationData);           // continue loop

    this.emit(Op.OP_ELSE, locationData);
    this.emit(Op.OP_1, locationData);           // exit loop
    this.emit(Op.OP_ENDIF, locationData);

    this.emit(Op.OP_UNTIL, locationData);

    // Stack: [target_lbc, target_cat, sum, i]
    this.emit(Op.OP_DROP, locationData);         // drop i
    this.emit(Op.OP_NIP, locationData);          // drop target_cat -> [target_lbc, sum]
    this.emit(Op.OP_NIP, locationData);          // drop target_lbc -> [sum]
  }

  /**
   * Emit token container field access: this.tokens[cat].tokenAmount etc.
   *
   * For tokenAmount: aggregates across all matching inputs (sum of FT amounts).
   * For nftCount: counts NFTs across all matching inputs.
   * For tokenCategory/nftCommitment: reads from the single container input.
   * For outState variants: loops over outputs instead of inputs.
   */
  private emitTokenContainerFieldAccess(node: FieldAccessNode): Node {
    const mappingAccess = node.expression as MappingAccessNode;
    const slotIndex = mappingAccess.tokenContainerSlotIndex;
    const locationData = { location: node.location, positionHint: PositionHint.START };
    const isOutState = !!mappingAccess.isOutStateTokenContainerAccess;

    // Visit inner MappingAccess (visits the key expression, keeps param on stack)
    node.expression = this.visit(node.expression);

    if (node.name === 'tokenAmount' || node.name === 'nftCount') {
      // Aggregate mode: derive token container lbc, then loop

      // Get token container category from the key parameter
      const keyParamName = this.tokenContainerSlots[slotIndex]?.keyParam;
      if (keyParamName) {
        const keyIdx = this.getStackIndex(keyParamName);
        this.emit(encodeInt(BigInt(keyIdx)), locationData);
        this.emit(Op.OP_PICK, locationData);
        // untracked: tcCat
      }

      // Get master's 32-byte categoryId
      this.emitMasterInputIndex(locationData);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData);
      // untracked: tcCat, masterCat

      // We need: [target_lbc, target_cat] for the aggregate loop
      // DUP tcCat before deriving lbc
      // Stack: [tcCat, masterCat]
      this.emit(Op.OP_SWAP, locationData);        // [masterCat, tcCat]
      this.emit(Op.OP_DUP, locationData);         // [masterCat, tcCat, tcCat]
      this.emit(encodeInt(2n), locationData);
      this.emit(Op.OP_ROLL, locationData);        // [tcCat, tcCat, masterCat]
      this.emit(Op.OP_SWAP, locationData);        // [tcCat, masterCat, tcCat]
      // emitTokenContainerLbc expects [masterCat, tcCat] -> [p2sh32_lbc]
      // But stack is [tcCat, masterCat, tcCat]... we need [masterCat, tcCat] on top
      // Actually: [tcCat, masterCat, tcCat] - top two are [masterCat, tcCat], good!
      this.emitTokenContainerLbc(locationData);
      // Stack: [tcCat, p2sh32_lbc]
      this.emit(Op.OP_SWAP, locationData);        // [p2sh32_lbc, tcCat]

      // Now call the aggregate loop
      this.emitTokenContainerAggregateLoop(
        node.name as 'tokenAmount' | 'nftCount',
        isOutState,
        locationData,
      );

      this.pushToStack('(value)');
      return node;
    }

    // Single-UTXO read mode (tokenCategory, nftCommitment) - unchanged
    // These only apply to input-side access (not outState)

    // Check if TC exists via input introspection (funder has no tokens)
    this.emitBlockSlotIndex('tokenContainer', slotIndex, locationData);
    this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    this.emit(Op.OP_SIZE, locationData);
    this.emit(Op.OP_NIP, locationData);
    this.emit(encodeInt(0n), locationData);
    this.emit(Op.OP_GREATERTHAN, locationData);

    // OP_IF (container exists)
    this.emit(Op.OP_IF, locationData);

    // Compute token container input index
    this.emitTokenContainerInputIndex(slotIndex, locationData, 0);

    // Emit introspection opcode based on field name
    if (node.name === 'tokenCategory') {
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
    } else if (node.name === 'nftCommitment') {
      this.emit(Op.OP_UTXOTOKENCOMMITMENT, locationData);
    }

    // OP_ELSE (no container): push default
    this.emit(Op.OP_ELSE, locationData);
    this.emit(encodeInt(0n), locationData);

    // OP_ENDIF
    this.emit(Op.OP_ENDIF, locationData);

    this.pushToStack('(value)');
    return node;
  }

  /**
   * Emit opcodes to compute the token container input index for a given slot.
   * Input index = block layout tokenContainer offset
   * Pushes 1 untracked value.
   */
  private emitTokenContainerInputIndex(
    slotIndex: number, locationData: SingleLocationData, _extraStackOffset: number,
  ): void {
    this.emitBlockSlotIndex('tokenContainer', slotIndex, locationData);
  }

  /**
   * Emit opcodes to compute the token container output index for a given slot.
   * Output index = block layout tokenContainer offset (1:1)
   * Pushes 1 untracked value.
   */
  private emitTokenContainerOutputIndex(
    slotIndex: number, locationData: SingleLocationData, _extraStackOffset: number,
  ): void {
    this.emitBlockSlotIndex('tokenContainer', slotIndex, locationData);
  }

  /**
   * Verify token container identity for each accessed token container slot.
   * Reconstructs the expected container covenant script at runtime and compares P2SH32.
   */
  private emitTokenContainerIdentityVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.location, positionHint: PositionHint.START };

    for (let i = 0; i < this.tokenContainerSlots.length; i++) {
      // Check if TC exists via input introspection
      this.emitBlockSlotIndex('tokenContainer', i, locationData);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(encodeInt(0n), locationData);
      this.emit(Op.OP_GREATERTHAN, locationData);

      this.emit(Op.OP_IF, locationData);

      // Get token container category from the key parameter
      const keyParamName = this.tokenContainerSlots[i].keyParam;
      const keyIdx = this.getStackIndex(keyParamName);
      this.emit(encodeInt(BigInt(keyIdx)), locationData);
      this.emit(Op.OP_PICK, locationData);
      // 1 untracked (tcCategoryId)

      // Get master's 32-byte categoryId
      this.emitMasterInputIndex(locationData);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      this.emit(encodeInt(32n), locationData);
      this.emit(Op.OP_SPLIT, locationData);
      this.emit(Op.OP_DROP, locationData);
      // 2 untracked (tcCategoryId, masterCategoryId)

      // Build the container covenant script bytes at runtime
      // Must match buildTokenContainerCovenantScript in state.ts
      //
      // prefix (before masterCat push): OP_IF(0x63) UTXOTOKENCATEGORY(0xce) <32>(0x0120)
      //   SPLIT(0x7f) OP_2(0x52) EQUALVERIFY(0x88) + categoryPushPrefix(0x20)
      const prefix = new Uint8Array([0x63, 0xce, 0x01, 0x20, 0x7f, 0x52, 0x88]);
      const categoryPushPrefix = new Uint8Array([0x20]);

      // mid (after masterCat, before tcCat): EQUALVERIFY ELSE DUP DUP DUP OUTPUTBYTECODE INPUTINDEX
      //   UTXOBYTECODE EQUALVERIFY OUTPUTVALUE INPUTINDEX UTXOVALUE GREATERTHANOREQUAL VERIFY
      //   OUTPUTTOKENAMOUNT INPUTINDEX UTXOTOKENAMOUNT GREATERTHANOREQUAL VERIFY
      //   OUTPUTTOKENCATEGORY INPUTINDEX UTXOTOKENCATEGORY EQUALVERIFY
      //   single-input constraint loop ENDIF
      const mid = new Uint8Array([
        0x88, 0x67, 0x76, 0x76, 0x76, 0xcd, 0xc0, 0xc7, 0x88,
        0xcc, 0xc0, 0xc6, 0xa2, 0x69,
        0xd3, 0xc0, 0xd0, 0xa2, 0x69,
        0xd1, 0xc0, 0xce, 0x88,
        // Single-input constraint: INPUTINDEX UTXOBYTECODE TXINPUTCOUNT 1SUB BEGIN
        0xc0, 0xc7, 0xc3, 0x8c, 0x65,
        // DUP INPUTINDEX NUMEQUAL NOTIF DUP UTXOBYTECODE 2 PICK EQUAL NOT VERIFY ENDIF
        0x76, 0xc0, 0x9c, 0x64, 0x76, 0xc7, 0x52, 0x79, 0x87, 0x91, 0x69, 0x68,
        // 1SUB DUP 0 LESSTHAN UNTIL DROP DROP ENDIF
        0x8c, 0x76, 0x00, 0x9f, 0x66, 0x75, 0x75, 0x68,
      ]);
      const tcCatPushPrefix = new Uint8Array([0x20]);

      // suffix (after tcCat): DROP(0x75) OP_1(0x51)
      const suffix = new Uint8Array([0x75, 0x51]);

      // Build: prefix + categoryPushPrefix + masterCat + mid + tcCatPushPrefix + tcCat + suffix
      this.emit(prefix, locationData);
      this.emit(categoryPushPrefix, locationData);
      // 4 untracked (tcCat, masterCat, prefix, catPushPrefix)

      // Roll masterCat to top (it's at index 2: tcCat=3, masterCat=2, prefix=1, catPushPrefix=0)
      this.emit(encodeInt(2n), locationData);
      this.emit(Op.OP_ROLL, locationData);
      // Now: tcCat, prefix, catPushPrefix, masterCat
      this.emit(Op.OP_CAT, locationData); // catPushPrefix + masterCat
      this.emit(Op.OP_CAT, locationData); // prefix + (catPushPrefix + masterCat)
      // 2 untracked: tcCat, (prefix+catPushPrefix+masterCat)

      this.emit(mid, locationData);
      this.emit(Op.OP_CAT, locationData); // ... + mid
      // 2 untracked: tcCat, (prefix+catPushPrefix+masterCat+mid)

      this.emit(tcCatPushPrefix, locationData);
      // 3 untracked: tcCat, (...), tcCatPushPrefix

      // Roll tcCat to top (it's at index 2)
      this.emit(encodeInt(2n), locationData);
      this.emit(Op.OP_ROLL, locationData);
      // 3 untracked: (...), tcCatPushPrefix, tcCat
      this.emit(Op.OP_CAT, locationData); // tcCatPushPrefix + tcCat
      this.emit(Op.OP_CAT, locationData); // full prefix stuff + tcCatPushPrefix + tcCat
      // 1 untracked

      this.emit(suffix, locationData);
      this.emit(Op.OP_CAT, locationData); // full script
      // 1 untracked

      // Hash to P2SH32
      this.emit(Op.OP_HASH256, locationData);
      this.emit(P2SH32_LBC_PREFIX, locationData);
      this.emit(Op.OP_SWAP, locationData);
      this.emit(Op.OP_CAT, locationData);
      this.emit(P2SH32_LBC_SUFFIX, locationData);
      this.emit(Op.OP_CAT, locationData);
      // 1 untracked (expected locking bytecode)

      // Get actual container input's locking bytecode
      this.emitTokenContainerInputIndex(i, locationData, 1); // +1 for expected locking bytecode
      this.emit(Op.OP_UTXOBYTECODE, locationData);
      // 2 untracked

      this.emit(Op.OP_EQUALVERIFY, locationData);
      // 0 untracked

      this.emit(Op.OP_ENDIF, locationData);
    }
  }

  /**
   * Verify token container transfer outputs.
   * For each pending transfer/transferNft, verify the output at block layout tcTransfer offset.
   */
  private emitTokenContainerTransferCovenantVerification(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };

    for (const transfer of this.pendingTokenContainerTransfers) {
      const { transferIndex, method, argStackNames } = transfer;
      // argStackNames[0] = category, argStackNames[1] = to, argStackNames[2] = amount (for transfer)
      // argStackNames[0] = category, argStackNames[1] = to, [2] = commitment, [3] = capability (for transferNft)
      const isConditionalTc = this.conditionalTokenContainerTransferIndices.has(transferIndex);

      // For conditional TC transfers, check if the category slot is non-empty (active)
      if (isConditionalTc) {
        const checkIdx = this.getStackIndex(argStackNames[0]);
        this.emit(encodeInt(BigInt(checkIdx)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.pushToStack('(cond_check)');
        this.emit(Op.OP_IF, locationData);
        this.popFromStack();
      }

      if (method === 'transfer') {
        const toStackName = argStackNames[1];
        const amountStackName = argStackNames[2];
        const catStackName = argStackNames[0];

        // 1. Verify output locking bytecode == to
        const toIdx = this.getStackIndex(toStackName);
        this.emit(encodeInt(BigInt(toIdx)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.pushToStack('(value)');

        this.emitBlockSlotIndex('tcTransfer', transferIndex, locationData);
        this.emit(Op.OP_OUTPUTBYTECODE, locationData);
        this.pushToStack('(value)');

        this.emit(Op.OP_EQUALVERIFY, locationData);
        this.popFromStack(2);

        // 2. Verify output token amount == amount
        const amtIdx = this.getStackIndex(amountStackName);
        this.emit(encodeInt(BigInt(amtIdx)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.pushToStack('(value)');

        this.emitBlockSlotIndex('tcTransfer', transferIndex, locationData);
        this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);
        this.pushToStack('(value)');

        this.emit(Op.OP_EQUALVERIFY, locationData);
        this.popFromStack(2);

        // 3. Verify output token category == category param (exact match enforces no NFT capability byte)
        const catIdx = this.getStackIndex(catStackName);
        this.emit(encodeInt(BigInt(catIdx)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.pushToStack('(value)');

        this.emitBlockSlotIndex('tcTransfer', transferIndex, locationData);
        this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
        // OP_OUTPUTTOKENCATEGORY returns internal byte order; reverse to match display-order param
        this.emit(Op.OP_REVERSEBYTES, locationData);
        this.pushToStack('(value)');

        this.emit(Op.OP_EQUALVERIFY, locationData);
        this.popFromStack(2);
      } else {
        // transferNft(to, commitment, capability)
        // argStackNames: [0]=category, [1]=to, [2]=commitment, [3]=capability
        const toStackName = argStackNames[1];
        const commitmentStackName = argStackNames[2];
        const capabilityStackName = argStackNames[3];
        const catStackName = argStackNames[0];

        // 1. Verify output locking bytecode == to
        const toIdx = this.getStackIndex(toStackName);
        this.emit(encodeInt(BigInt(toIdx)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.pushToStack('(value)');

        this.emitBlockSlotIndex('tcTransfer', transferIndex, locationData);
        this.emit(Op.OP_OUTPUTBYTECODE, locationData);
        this.pushToStack('(value)');

        this.emit(Op.OP_EQUALVERIFY, locationData);
        this.popFromStack(2);

        // 2. Verify output NFT commitment == commitment arg
        const commitIdx = this.getStackIndex(commitmentStackName);
        this.emit(encodeInt(BigInt(commitIdx)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.pushToStack('(value)');

        this.emitBlockSlotIndex('tcTransfer', transferIndex, locationData);
        this.emit(Op.OP_OUTPUTTOKENCOMMITMENT, locationData);
        this.pushToStack('(value)');

        this.emit(Op.OP_EQUALVERIFY, locationData);
        this.popFromStack(2);

        // 3. Verify output token category matches cat + capability
        // Build expected full category: if capability==0, just cat (32 bytes);
        // otherwise cat + capability_byte (33 bytes), where capability 1=0x01 (mutable), 2=0x02 (minting)
        const capIdx = this.getStackIndex(capabilityStackName);
        this.emit(encodeInt(BigInt(capIdx)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.pushToStack('(cap_value)');

        this.emit(Op.OP_DUP, locationData);
        this.emit(encodeInt(0n), locationData);
        this.emit(Op.OP_NUMEQUAL, locationData);
        this.emit(Op.OP_IF, locationData);
        // capability == 0 (none): expected = cat_internal (32 bytes only)
        this.emit(Op.OP_DROP, locationData);     // drop capability
        const catIdx0 = this.getStackIndex(catStackName);
        this.emit(encodeInt(BigInt(catIdx0)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.emit(Op.OP_REVERSEBYTES, locationData); // display -> internal for OUTPUTTOKENCATEGORY match
        this.emit(Op.OP_ELSE, locationData);
        // capability == 1 or 2: expected = cat_internal + capability_byte
        this.emit(Op.OP_1, locationData);
        this.emit(Op.OP_NUM2BIN, locationData);  // convert int to 1-byte
        const catIdx1 = this.getStackIndex(catStackName);
        this.emit(encodeInt(BigInt(catIdx1)), locationData);
        this.emit(Op.OP_PICK, locationData);
        this.emit(Op.OP_REVERSEBYTES, locationData); // display -> internal
        this.emit(Op.OP_SWAP, locationData);
        this.emit(Op.OP_CAT, locationData);      // cat_internal + capability_byte
        this.emit(Op.OP_ENDIF, locationData);
        // Stack: [..., expected_full_category_internal]

        this.popFromStack(); // pop (cap_value) tracking -- replaced by expected category
        this.pushToStack('(expected_cat)');

        // Get actual output token category (returns internal byte order)
        this.emitBlockSlotIndex('tcTransfer', transferIndex, locationData);
        this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
        this.pushToStack('(value)');

        this.emit(Op.OP_EQUALVERIFY, locationData);
        this.popFromStack(2);

        // 4. Verify output token amount == 0 (NFT-only output, no fungible tokens)
        this.emitBlockSlotIndex('tcTransfer', transferIndex, locationData);
        this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);
        this.emit(encodeInt(0n), locationData);
        this.emit(Op.OP_NUMEQUALVERIFY, locationData);
      }

      if (isConditionalTc) {
        this.emit(Op.OP_ENDIF, locationData);
      }
    }

    // Clean up pending token container transfer values from the stack
    for (const transfer of this.pendingTokenContainerTransfers) {
      for (const stackName of transfer.argStackNames) {
        const idx = this.getStackIndex(stackName);
        this.emit(encodeInt(BigInt(idx)), locationData);
        this.emit(Op.OP_ROLL, locationData);
        this.emit(Op.OP_DROP, locationData);
        this.removeFromStack(idx);
      }
    }
  }

  /**
   * Verify token container preservation.
   * For each accessed token container slot with flag=1, verify the container output preserves
   * locking bytecode and adjusts token amounts for transfers.
   */
  private emitTokenContainerPreservation(node: FunctionDefinitionNode): void {
    const locationData = { location: node.body.location, positionHint: PositionHint.END };
    const isSelfdestruct = node.modifiers.includes(FunctionModifier.SELFDESTRUCT);

    // SECURITY: For non-selfdestruct functions, verify that containers with inputs also have outputs
    // This prevents draining attacks. Uses introspection instead of bitmask comparison.
    // to bypass preservation checks and drain the token container.
    // Only selfdestruct functions are allowed to drain containers (output flags may differ).
    // SECURITY: For non-selfdestruct, verify input TC exists -> output TC must also exist
    if (!isSelfdestruct) {
      for (let i = 0; i < this.tokenContainerSlots.length; i++) {
        // Input has tokens -> output must also have tokens
        this.emitBlockSlotIndex('tokenContainer', i, locationData);
        this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
        this.emit(Op.OP_SIZE, locationData);
        this.emit(Op.OP_NIP, locationData);
        this.emit(encodeInt(0n), locationData);
        this.emit(Op.OP_GREATERTHAN, locationData);
        this.emit(Op.OP_IF, locationData);
        this.emitBlockSlotIndex('tokenContainer', i, locationData);
        this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
        this.emit(Op.OP_SIZE, locationData);
        this.emit(Op.OP_NIP, locationData);
        this.emit(encodeInt(0n), locationData);
        this.emit(Op.OP_GREATERTHAN, locationData);
        this.emit(Op.OP_VERIFY, locationData);
        this.emit(Op.OP_ENDIF, locationData);
      }
    }

    for (let i = 0; i < this.tokenContainerSlots.length; i++) {
      // Check if TC output has tokens (not drained) via output introspection
      this.emitBlockSlotIndex('tokenContainer', i, locationData);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      this.emit(Op.OP_SIZE, locationData);
      this.emit(Op.OP_NIP, locationData);
      this.emit(encodeInt(0n), locationData);
      this.emit(Op.OP_GREATERTHAN, locationData);

      this.emit(Op.OP_IF, locationData);

      // Verify output locking bytecode == container input locking bytecode (self-preservation)
      this.emitTokenContainerInputIndex(i, locationData, 0);
      this.emit(Op.OP_UTXOBYTECODE, locationData);
      // 1 untracked (input bytecode)

      this.emitTokenContainerOutputIndex(i, locationData, 1);
      this.emit(Op.OP_OUTPUTBYTECODE, locationData);
      // 2 untracked

      this.emit(Op.OP_EQUALVERIFY, locationData);
      // 0 untracked

      // Token amount preservation: (input - sent_amounts) <= output
      this.emitTokenContainerInputIndex(i, locationData, 0);
      this.emit(Op.OP_UTXOTOKENAMOUNT, locationData);
      // 1 untracked (input_amount, will become adjusted_input)

      // Subtract transferred amounts by reading from the verified transfer outputs
      const transfersForSlot = this.pendingTokenContainerTransfers.filter(
        (s) => s.tokenContainerSlotIndex === i && s.method === 'transfer',
      );
      for (const transfer of transfersForSlot) {
        // Read the transferred amount from the verified transfer output
        this.emitBlockSlotIndex('tcTransfer', transfer.transferIndex, locationData);
        this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);
        this.emit(Op.OP_SUB, locationData);
        // still 1 untracked (adjusted_input)
      }

      this.emitTokenContainerOutputIndex(i, locationData, 1); // +1 for adjusted_input
      this.emit(Op.OP_OUTPUTTOKENAMOUNT, locationData);
      // 2 untracked (adjusted_input, output_amount)

      this.emit(Op.OP_LESSTHANOREQUAL, locationData); // adjusted_input <= output
      this.emit(Op.OP_VERIFY, locationData);
      // 0 untracked

      // Verify token category preservation
      const nftTransfersForSlot = this.pendingTokenContainerTransfers.filter(
        (s) => s.tokenContainerSlotIndex === i && s.method === 'transferNft',
      );

      this.emitTokenContainerInputIndex(i, locationData, 0);
      this.emit(Op.OP_UTXOTOKENCATEGORY, locationData);
      if (nftTransfersForSlot.length > 0) {
        // NFT was transferred out - compare only base 32-byte category
        this.emit(encodeInt(32n), locationData);
        this.emit(Op.OP_SPLIT, locationData);
        this.emit(Op.OP_DROP, locationData);
      }
      // 1 untracked

      this.emitTokenContainerOutputIndex(i, locationData, 1);
      this.emit(Op.OP_OUTPUTTOKENCATEGORY, locationData);
      if (nftTransfersForSlot.length > 0) {
        this.emit(encodeInt(32n), locationData);
        this.emit(Op.OP_SPLIT, locationData);
        this.emit(Op.OP_DROP, locationData);
      }
      // 2 untracked

      this.emit(Op.OP_EQUALVERIFY, locationData);
      // 0 untracked

      this.emit(Op.OP_ENDIF, locationData);
    }
  }
}
