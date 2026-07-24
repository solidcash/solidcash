import {
  IntType, BytesType, AddressType, PrimitiveType, ValueType, Type, MappingType, StructType, ArrayType, EnumType,
  hash256, computeErc7201SlotNumber, isFixedWidthType,
} from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import {
  Node, StatementNode, ExpressionNode, AssemblyStatementNode, BlockNode, VariableDefinitionNode,
  AssignNode, RequireNode, BranchNode, WhileNode, BreakNode, ContinueNode, BinaryOpNode, UnaryOpNode,
  CastNode, IdentifierNode, IntLiteralNode, BoolLiteralNode, ParameterNode, FunctionDefinitionNode,
  StateAssignNode, StateAccessNode, StateVariableNode, ContractNode, BytesConcatNode, FunctionCallNode,
  SliceNode, CollectionNode, MappingAccessNode, MappingAssignNode, HexLiteralNode, NullaryOpNode, FieldAccessNode,
  ReturnNode, TupleAssignmentNode, LowLevelCallNode, NewArrayNode, EmitStatementNode, EventDefinitionNode,
  InstantiationNode, TypeIntrospectionNode, ArrayAccessNode, ArrayAssignNode, ArrayNode, StateArrayPopNode,
  TernaryOpNode,
} from '../ast/AST.js';
import { BinaryOperator, UnaryOperator, NullaryOperator } from '../ast/Operator.js';
import { cloneNode } from '../ast/clone.js';
import {
  YulNode, YulBlockNode, YulStatementNode, YulExpressionNode, YulVariableDeclarationNode, YulAssignmentNode,
  YulIfNode, YulSwitchNode, YulForLoopNode, YulExpressionStatementNode, YulBreakNode, YulContinueNode,
  YulFunctionCallNode, YulFunctionDefinitionNode, YulPathNode, YulLiteralNode, YulLiteralKind,
  YulCaseNode, YulLeaveNode,
} from '../ast/YulAST.js';
import {
  YULMEM,
  memReservedInit as buildReservedInit,
  memWordStore,
  memWordLoad,
  memByteStore,
  memGrowTo,
} from './YulMemPrimitives.js';

// Thrown when a Yul construct is outside the supported codegen subset; the block is then left as-is for the
// inline-assembly diagnostic (GTT) to report. Internal to this pass.
class YulNotLowerable extends Error {}

// Yul words are unsigned 256-bit. A bounded IntType is required for integer bitwise (`&`/`|`/`^`), and works
// for arithmetic too; comparisons are cast to it so their 0/1 result is bitwise/arithmetic-usable.
const UINT256 = new IntType(false, 256);

// The enclosing function's user parameters, used for the EVM-calldata view (selector ++ abi.encode(params)).
// Set per function while lowering its body. solidc has no nested functions, so a module-level slot is safe.
let currentParams: ParameterNode[] = [];

// Declared type of every in-scope param + local of the enclosing function (name -> Type). A UDVT-typed var is
// a raw word inside assembly, so it is unwrapped when read and the assembled word is re-wrapped when written.
let currentVars = new Map<string, Type>();
// Constant hex-literal-initialized locals (`bytes memory b = hex"..."`), so Yul `create(0, add(b,0x20), n)` can
// resolve b to a compile-time bytecode blob and derive the deployed contract's p2sh32 address.
let currentVarValues = new Map<string, Uint8Array>();
// `bytes X = type(C).creationCode` locals: X -> contract name C, so a Yul `create2` over X lowers to `new C{salt}()`.
let currentCreationCodeLocals = new Map<string, string>();

// Free-memory-pointer byte buffers (`let clone := mload(0x40)`) and their ordered mstore writes, so an EIP-1167
// minimal-proxy style `create(0, clone, size)` can reconstruct the blob (const||runtime||const) and derive the
// deployed p2sh32 address at runtime. Each write records a byte offset + the mstore'd word.
let bufferWrites = new Map<string, Array<{ off: bigint; value: YulExpressionNode }>>();

// Record every local declaration's declared type (named returns are already locals here, after
// NamedReturnTransformation). Shadowing is rare; the last write wins, which is fine for assembly lowering.
function collectVarTypes(node: Node, out: Map<string, Type>): void {
  if (node instanceof VariableDefinitionNode) {
    out.set(node.name, node.type);
    if (node.expression instanceof HexLiteralNode) currentVarValues.set(node.name, node.expression.value);
    // `bytes X = type(C).creationCode` - record X -> C so a create2 over X lowers to `new C{salt}()`. Read the raw
    // type name (typeArgText); TypeIntrospectionNode.contractName is only set later (SymbolTableTraversal).
    if (node.expression instanceof TypeIntrospectionNode
      && (node.expression.property === 'creationCode' || node.expression.property === 'runtimeCode')) {
      currentCreationCodeLocals.set(node.name, node.expression.typeArgText);
    }
  }
  for (const key of Object.keys(node)) {
    const val = (node as any)[key];
    if (val instanceof Node) collectVarTypes(val, out);
    else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) collectVarTypes(v, out);
  }
}

// Record storage-pointer aliases `x -> a` for an ARRAY-typed local initialized with a bare identifier
// (`T[] storage x = a;`). Restricted to arrays: a mapping/struct storage-pointer decl is dropped by an earlier
// alias/inline pass before this one (so never seen here), and only the array pointer both survives and codegens.
// Only the direct bare-state-var shape is tracked; a reassigned pointer or one derived from an element/field is
// left out -> `.slot`/`.offset` on it falls through to YulNotLowerable (fail-closed, no wrong slot).
function collectStorageAliases(node: Node, out: Map<string, string>): void {
  if (node instanceof VariableDefinitionNode
    && node.type instanceof ArrayType
    && node.expression instanceof IdentifierNode) {
    out.set(node.name, node.expression.name);
  }
  for (const key of Object.keys(node)) {
    const val = (node as any)[key];
    if (val instanceof Node) collectStorageAliases(val, out);
    else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) collectStorageAliases(v, out);
  }
}

// The state var whose slot a `.slot`/`.offset` base denotes: the name itself if it is a state var, else the state
// var a storage-pointer local directly aliases (one level). undefined -> not a resolvable storage location.
function resolveStorageVarName(base: string): string | undefined {
  if (currentVarSlot.has(base)) return base;
  const target = currentStorageAliases.get(base);
  return target !== undefined && currentVarSlot.has(target) ? target : undefined;
}

// True if the subtree contains an inline `assembly {}` block. Checked at fn entry before the block is lowered.
function bodyHasAssembly(node: Node | undefined): boolean {
  if (!node) return false;
  if (node instanceof AssemblyStatementNode) return true;
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
    const val = (node as any)[key];
    if (val instanceof Node) { if (bodyHasAssembly(val)) return true; } else if (Array.isArray(val)) {
      for (const v of val) if (v instanceof Node && bodyHasAssembly(v)) return true;
    }
  }
  return false;
}

// EVM storage layout of the enclosing contract: each state var packed into a 32-byte slot in declaration
// order (Solidity rules), so sload/sstore on a slot can map to the var(s) at that slot. A single full-width
// var (the common uint256 case) stays a plain read/write; a packed slot combines/decomposes its sub-word vars.
interface SlotField { sv: StateVariableNode; bitOffset: bigint; bitWidth: bigint; }
let currentSlots = new Map<bigint, SlotField[]>();
let currentVarSlot = new Map<string, bigint>();
// Single slots covered by a declared state var (scalar slots - also in currentSlots - and a mapping/dyn-array's one
// slot). A fixed struct/array's whole footprint is a RANGE in compositeRanges (never materialized per-slot: a
// `uint[2e9]` would OOM). Together they stop `sload(structSlot+i)` from being mis-routed to __evm_storage: a slot
// covered by any declared var (incl. a composite sub-slot) fails closed instead - the field-level read is not
// modeled.
let occupiedSlots = new Set<bigint>();
// `sv` is the composite state var occupying the range, so a sub-slot access `sload(sv.slot + i)` can resolve to
// the struct field / array element at that relative slot (compositeSubSlot* below). undefined only for the legacy
// shape that predates carrying it (none currently).
let compositeRanges: { base: bigint; words: bigint; sv?: StateVariableNode }[] = [];

// True if a literal slot number is covered by any declared state var (scalar, collection, or a composite's range).
function slotIsDeclared(slotNum: bigint): boolean {
  return occupiedSlots.has(slotNum)
    || compositeRanges.some((r) => slotNum >= r.base && slotNum < r.base + r.words);
}
// A storage-pointer local that DIRECTLY aliases a state var (`mapping(..) storage p = m;` / `T[] storage x = a;`):
// local name -> underlying state-var name. LowerMappingStorageAlias (which inlines these) runs AFTER this pass and
// only rewrites high-level indexed uses, so an assembly `p.slot`/`p.offset` reaches here unresolved; the alias maps
// it to the underlying var's constant slot/offset.
let currentStorageAliases = new Map<string, string>();
// slot number -> declared mapping var name at that slot. Used to bridge the EVM mapping-slot assembly idiom
// (`mstore(0,k); mstore(32,p); sload/sstore(keccak256(0,64))`) to the high-level mapping m at slot p (Tier-2
// interop): the assembly access and the high-level m[k] then hit the same entry collection.
let currentMappingSlots = new Map<bigint, string>();

// The synthesized EVM-storage register name. A contract whose assembly touches a slot with NO declared var
// (an arbitrary EVM storage slot, e.g. `sstore(0, v)` with no var at slot 0, or a keccak/sha256-derived slot)
// gets a `mapping(uint256 => uint256) __evm_storage` = the 2^256 slot space; sstore/sload route to it. See
// docs/evm-storage-parity.md. Set while lowering; the mapping is synthesized in visitContract afterward.
const EVM_STORAGE = '__evm_storage';
let evmStorageUsed = false;

// The synthetic `bytes` local holding the most recent low-level call's return-event data, so a following
// returndatasize()/returndatacopy() reads it (EVM's implicit returndata buffer). Reset per assembly block.
let lastReturnData: string | undefined;
let yulCallCounter = 0;

// Map a Yul low-level call `call/staticcall/delegatecall(gas, addr, [value,] argOff, argLen, retOff, retLen)` to a
// solidc binding `(bool <ok>, bytes <retVar>) = address(addr).<mode>(data)`, reusing the external-call covenant +
// return-event NFT codegen. The addr word casts to an address (SDK resolves the co-spent target at build time via
// .withExternalCall); calldata = the mstore-built buffer at argOff, else empty. `retVar` tracks the returndata.
function isLowLevelCall(v: YulExpressionNode | undefined): v is YulFunctionCallNode {
  return v instanceof YulFunctionCallNode
    && (v.name === 'call' || v.name === 'staticcall' || v.name === 'delegatecall');
}

function lowerLowLevelCall(call: YulFunctionCallNode, okVar: string, okIsNew: boolean, src: YulStatementNode): StatementNode {
  const mode = call.name as 'call' | 'staticcall' | 'delegatecall';
  const addr = loc(new CastNode(new AddressType(false), lowerValue(call.args[1]), false), call);
  // The payload is supplied at build time via .withExternalCall (see docs/call-model.md s12); the compiler emits
  // the covenant + return-event slot with a placeholder empty calldata.
  const data = loc(new HexLiteralNode(new Uint8Array(0)), src);
  yulCallCounter += 1;
  const okTmp = `__yul_callok_${yulCallCounter}`;
  const retVar = `__yul_returndata_${yulCallCounter}`;
  lastReturnData = retVar;
  currentVars.set(retVar, new BytesType());
  // `(bool <okTmp>, bytes <retVar>) = address(addr).<mode>(data)` - both fresh so the tuple has no mixed slots.
  const llcall = loc(new LowLevelCallNode(addr, data, mode), call);
  const tuple = loc(new TupleAssignmentNode(
    [{ name: okTmp, type: PrimitiveType.BOOL }, { name: retVar, type: new BytesType() }], llcall, true,
  ), src);
  // A fresh Yul `let ok` is a uint256 word, but assigning into an existing high-level `bool success` must retain
  // the bool type. Both hold the same 0/1 VM value; only the AST target type differs.
  const targetType = currentVars.get(okVar);
  const okValue = !okIsNew && targetType === PrimitiveType.BOOL
    ? loc(new IdentifierNode(okTmp), src)
    : loc(new CastNode(UINT256, loc(new IdentifierNode(okTmp), src), false), src);
  const okStmt = okIsNew
    ? loc(new VariableDefinitionNode(UINT256, [], okVar, okValue), src)
    : loc(new AssignNode(loc(new IdentifierNode(okVar), src), okValue), src);
  return loc(new BlockNode([tuple, okStmt]), src);
}

// If a Yul slot argument denotes an arbitrary EVM storage slot (not a declared var), return the lowered slot
// key for __evm_storage[key]; else undefined (a declared-var slot, handled by resolveSlotFields). A plain int
// literal whose slot holds a declared var, or a declared var's `x.slot`, is NOT __evm_storage.
function evmStorageSlotKey(slotArg: YulExpressionNode): ExpressionNode | undefined {
  if (isIntLiteral(slotArg)) {
    const slotNum = BigInt(slotArg.raw);
    // A slot covered by ANY declared var (scalar, mapping/array base, or a composite's sub-slot) is not raw
    // __evm_storage. Composite sub-slots have no scalar-field entry, so a read there falls through to a clean
    // fail-closed error rather than silently reading __evm_storage[slot].
    return slotIsDeclared(slotNum) ? undefined : intLit(slotNum, slotArg);
  }
  if (slotArg instanceof YulPathNode && slotArg.members.length === 1 && slotArg.members[0] === 'slot') {
    return undefined; // `x.slot` of a declared var
  }
  // A computed slot expression (arithmetic / hash). A BARE keccak256/sha256 in __evm_storage-key position is NOT
  // cast to uint256 here on purpose: it appears in the sub-word-keccak + array-idiom + resize combination
  // (keccak256_optimizer_cache_bug) whose runtime-mem re-lowering MISCOMPILES; leaving the bytes32 type mismatch
  // keeps that whole block fail-closed (loud) rather than silently miscompiling. Arithmetic on a keccak (the common
  // `add(keccak,i)` computed-slot key) already casts via ARITH_OPS.
  return lowerValue(slotArg);
}

function stateVarByteWidth(sv: StateVariableNode): number {
  const t = sv.type;
  if (sv.isDynamic) return 32;
  if (t instanceof IntType) return t.bits / 8;
  if (t instanceof AddressType) return 20;
  if (t instanceof BytesType) return t.bound ?? 32;
  if (t === PrimitiveType.BOOL) return 1;
  if (t instanceof EnumType) return 1; // Solidity enums are 1 byte (<=256 members, EnumType::storageBytes == 1)
  // A UDVT (`type T is uintN`) packs by its underlying type's width, exactly like EVM (Types.cpp storageBytes
  // forwards to the underlying). Was falling through to 32 -> a UDVT var wrongly took a whole slot and never packed.
  if (t instanceof ValueType) return valueByteWidth(t.underlyingType);
  return 32; // mapping / dynamic array/bytes: one slot (the base/length header)
}

// The byte width a value type occupies when packed in an EVM storage slot. Composites are handled by packWords.
function valueByteWidth(t: Type): number {
  if (t instanceof IntType) return t.bits / 8;
  if (t instanceof AddressType) return 20;
  if (t instanceof BytesType) return t.bound ?? 32;
  if (t === PrimitiveType.BOOL) return 1;
  if (t instanceof EnumType) return 1; // Solidity enums are 1 byte
  return 32; // mapping / dynamic: one slot
}

// EVM storage packing for a list of member types (struct fields or fixed-array elements): value members pack by
// byte width within a 32-byte word; a nested struct / fixed array starts a new slot and occupies whole slots.
// Returns the number of 32-byte slots the members occupy. EVM-exact for value + nested-composite members
// (Types.cpp computeOffsets); mirrors computeStorageLayout's own packing.
function packWords(types: Type[]): number {
  let slot = 0;
  let byteOff = 0;
  for (const t of types) {
    const inner = compositeSlotWords(t);
    if (inner > 0) {
      if (byteOff > 0) { slot += 1; byteOff = 0; }
      slot += inner;
      continue;
    }
    const w = valueByteWidth(t);
    if (byteOff + w > 32) { slot += 1; byteOff = 0; }
    byteOff += w;
    if (byteOff >= 32) { slot += 1; byteOff = 0; }
  }
  return slot + (byteOff > 0 ? 1 : 0);
}

// The whole-slot footprint of a fixed-size array or struct type (>0), else 0 for a value / mapping / dynamic
// type (those pack by byte width). A fixed array T[k] and a struct occupy whole slots in EVM and never pack with
// a neighbour, so the following var starts a fresh slot - this is the D2 layout fix (was collapsed to 1 slot).
function compositeSlotWords(t: Type): number {
  if (t instanceof ArrayType && t.bound !== undefined) {
    // Compute the fixed array's whole-slot footprint ARITHMETICALLY (all elements share one type), rather than
    // materializing `bound` copies and byte-packing them - a `uint[2 gwei]` (2e9-element) declaration would OOM
    // the fill. This is the exact result packWords([T,..,T]) returns: a composite element occupies `inner` whole
    // slots each (bound*inner); a value element of width w packs floor(32/w) per slot.
    const k = Number(t.bound);
    const inner = compositeSlotWords(t.elementType);
    if (inner > 0) return Math.max(1, k * inner);
    const w = valueByteWidth(t.elementType);
    const perSlot = Math.max(1, Math.floor(32 / w));
    return Math.max(1, Math.ceil(k / perSlot));
  }
  if (t instanceof StructType) return Math.max(1, packWords(t.fields.map((f) => f.type)));
  return 0;
}

// Source ordering key for a state member (declaration order = EVM slot order). Absent location sorts last, stable.
function declPos(n: { location?: { start: { line: number; column: number } } }): number {
  return n.location ? n.location.start.line * 100000 + n.location.start.column : Number.MAX_SAFE_INTEGER;
}

// Assign each state member its EVM storage slot in DECLARATION order across both state vars and collections
// (EVM counts every member - a mapping / dynamic array takes one slot; a fixed struct/array takes its whole
// multi-word footprint; sub-word scalars pack). Collections are merged in so a mapping's slot is known (needed
// to bridge the assembly mapping-slot idiom to the high-level mapping) and so a scalar declared after a mapping
// gets its correct EVM slot. currentSlots (int-field decode) is only filled for packed scalar slots.
function computeStorageLayout(vars: StateVariableNode[], collections: CollectionNode[] = []): void {
  currentSlots = new Map();
  currentVarSlot = new Map();
  currentMappingSlots = new Map();
  occupiedSlots = new Set();
  compositeRanges = [];
  type Member = { sv: StateVariableNode } | { col: CollectionNode };
  const members: Member[] = [...vars.map((sv) => ({ sv })), ...collections.map((col) => ({ col }))];
  members.sort((a, b) => declPos('sv' in a ? a.sv : a.col) - declPos('sv' in b ? b.sv : b.col));
  let slot = 0n;
  let byteOff = 0;
  for (const m of members) {
    if ('col' in m) {
      // A mapping / dynamic array occupies exactly one whole slot and never packs with a neighbour.
      if (byteOff > 0) { slot += 1n; byteOff = 0; }
      currentVarSlot.set(m.col.name, slot);
      if (m.col.type instanceof MappingType) currentMappingSlots.set(slot, m.col.name);
      occupiedSlots.add(slot);
      slot += 1n;
      continue;
    }
    const sv = m.sv;
    // A fixed struct/array (non-dynamic) occupies whole EVM slots and does not pack; the next var starts fresh.
    const composite = sv.isDynamic ? 0 : compositeSlotWords(sv.type);
    if (composite > 0) {
      if (byteOff > 0) { slot += 1n; byteOff = 0; }
      currentVarSlot.set(sv.name, slot);
      compositeRanges.push({ base: slot, words: BigInt(composite), sv });
      slot += BigInt(composite);
      continue;
    }
    const w = stateVarByteWidth(sv);
    if (byteOff + w > 32) { slot += 1n; byteOff = 0; }
    if (!currentSlots.has(slot)) currentSlots.set(slot, []);
    currentSlots.get(slot)!.push({ sv, bitOffset: BigInt(byteOff * 8), bitWidth: BigInt(w * 8) });
    currentVarSlot.set(sv.name, slot);
    occupiedSlots.add(slot);
    byteOff += w;
    if (byteOff >= 32) { slot += 1n; byteOff = 0; }
  }
}

// Resolve a Yul slot argument (literal `sstore(0,..)` or `.slot` form `sstore(x.slot,..)`) to the int-typed
// fields of that slot. Slots holding a non-int var (address/bytes/mapping) are not handled (NotLowerable).
function resolveSlotFields(slotArg: YulExpressionNode): SlotField[] | undefined {
  let slotNum: bigint | undefined;
  if (isIntLiteral(slotArg)) {
    slotNum = BigInt(slotArg.raw);
  } else if (slotArg instanceof YulPathNode && slotArg.members.length === 1 && slotArg.members[0] === 'slot') {
    slotNum = currentVarSlot.get(slotArg.base);
  }
  if (slotNum === undefined) return undefined;
  const fields = currentSlots.get(slotNum);
  // Int fields, a UDVT wrapping an int, or a lone full-word bytes32 - the combine/decompose casts unwrap/reinterpret
  // them (bytes32<->uint256 round-trips losslessly, all 32 bytes preserved). A slot with an address, a sub-word
  // bytesN (byte-order-sensitive packing), or a UDVT-of-bytes field stays unhandled (NotLowerable).
  if (fields && fields.every((f) => isSupportedSlotField(f.sv.type))) return fields;
  return undefined;
}

// A slot field this FIXED-width int-word combine/decompose can handle: an int, a fixed bytesN (bytes1..bytes32), a
// bool / enum (1 byte), or a UDVT over an int/bytesN. int round-trips via truncation (`uintN(word)` = word mod
// 2^N). bytesN round-trips via the two's-complement trick (the same emitEvmWordFromUint uses): write = wordToBytesN
// (NUM2BIN(N+1) drop sign byte, or split for bytes32), read = prepend-0x00 then BIN2NUM (fieldAsWord). bool/enum
// round-trip through the plain uint256<->type cast (uint256(b) in {0,1}; bool(byte)=byte!=0; enum(byte) bounded).
// NB the bool/enum path applies Solidity's TYPED cleaning: a raw sstore of a dirty byte (e.g. 5 in a bool's byte)
// reads back as 1, not 5 - which matches typed field access, and real code stores 0/1 / a valid ordinal, so the
// round-trip is exact for well-defined values.
// VARIABLE-WIDTH fields fail closed here - NOT fundamentally impossible, just not this path: `address` is variable-
// length locking bytecode (25B p2pkh / 35B p2sh32, framed like `bytes` per isChunkPackableElementType), and dynamic
// `bytes`/`string` are variable too. A >32-byte value is handled elsewhere by SPILLING (fixed composites take
// consecutive slots) or CHUNKING (dynamic values); a slot field for them needs the dynamic-value slot model (an EVM
// length-slot + keccak data, or a BCH chunk), not this fixed int-word cast. (The 20 stateVarByteWidth for address is
// EVM slot-LAYOUT parity for neighbour packing, not the stored value's width.)
function isSupportedSlotField(t: Type): boolean {
  const core = t instanceof ValueType ? t.underlyingType : t;
  return core instanceof IntType
    || (core instanceof BytesType && core.bound !== undefined)
    || core === PrimitiveType.BOOL
    || core instanceof EnumType;
}

// If a Yul slot argument denotes a declared DYNAMIC ARRAY var's base slot, return the var name. EVM stores a
// dynamic array's length at its base slot, so `sload(a.slot)` reads the length - which BCH keeps in a length
// register accessible as `a.length`. Read-only: `sstore(a.slot, n)` (a resize) is not modeled. `bytes`/`string`
// excluded (their slot length encoding - short-inline vs long - differs).
function resolveDynArrayName(slotArg: YulExpressionNode): string | undefined {
  let slotNum: bigint | undefined;
  if (isIntLiteral(slotArg)) {
    slotNum = BigInt(slotArg.raw);
  } else if (slotArg instanceof YulPathNode && slotArg.members.length === 1 && slotArg.members[0] === 'slot') {
    slotNum = currentVarSlot.get(slotArg.base);
  }
  if (slotNum === undefined) return undefined;
  const fields = currentSlots.get(slotNum);
  if (fields && fields.length === 1 && fields[0].sv.isDynamic && fields[0].sv.type instanceof ArrayType) {
    return fields[0].sv.name;
  }
  return undefined;
}

// If a Yul slot argument denotes a declared dynamic array with a FIXED-WIDTH element type, return its name -
// `sstore(a.slot, n)` on it is a RESIZE (set the length to n; the packed element blob is truncated / zero-fill
// grown to n*width bytes). A variable-width element (dynamic bytes/string element, nested dynamic array) is not
// resizable this way (per-element length prefixes) - fail closed.
function resolveResizableDynArray(slotArg: YulExpressionNode): string | undefined {
  const name = resolveDynArrayName(slotArg);
  if (name === undefined) return undefined;
  const sv = [...currentSlots.values()].flat().find((f) => f.sv.name === name)?.sv;
  return sv && sv.type instanceof ArrayType && isFixedWidthType(sv.type.elementType) ? name : undefined;
}

function isFullWord(fields: SlotField[]): boolean {
  return fields.length === 1 && fields[0].bitOffset === 0n && fields[0].bitWidth === 256n;
}

// Read a slot field as a uint256 word: uint256(StateAccess), unwrapping a UDVT to its underlying int first
// (`uint256(underlying(access))`, mirroring T.unwrap = a cast to the underlying type).
function fieldAsWord(f: SlotField, src: YulExpressionNode): ExpressionNode {
  return fieldAsWordFrom(loc(new StateAccessNode(f.sv.name), src), f.sv.type, src);
}

// The reusable core of fieldAsWord: read the given access expression (a whole state var, or a struct field /
// array element of a composite) of type `fieldType` as a uint256 word. Shared by the scalar slot path and the
// composite sub-slot path so both apply the same UDVT-unwrap + bytesN unsigned-read handling.
function fieldAsWordFrom(baseAccess: ExpressionNode, fieldType: Type, src: YulExpressionNode): ExpressionNode {
  let access = baseAccess;
  const core = fieldType instanceof ValueType ? fieldType.underlyingType : fieldType;
  if (fieldType instanceof ValueType) access = loc(new CastNode(fieldType.underlyingType, access, false), src);
  if (core instanceof BytesType) {
    // Prepend a high 0x00 sign-pad byte so uint256 (BIN2NUM) reads the N little-endian bytes as an UNSIGNED value in
    // [0, 2^(8N)); a bare uint256(bytesN) would reinterpret the top bit as a sign.
    access = loc(new BytesConcatNode([access, loc(new HexLiteralNode(new Uint8Array([0])), src)]), src);
  }
  return loc(new CastNode(UINT256, access, false), src);
}

// A uint256 word -> N little-endian bytes (bytesN). N<=31: `bytes(N+1)(word)[0:N]` - NUM2BIN to N+1 bytes fits any
// value in [0, 2^(8N)) as a positive sign-magnitude number, then drop the sign-pad byte (avoids the OP_NUM2BIN
// failure of a bare bytesN(word) on a high-bit value). N==32: NUM2BIN(33) is not a valid bytesN cast, so split the
// word into two 128-bit halves (word = high*2^128 + low), encode each as 16 LE bytes via the N=16 path, and concat
// low-first (= the 32-byte little-endian word).
function wordToBytesN(word: ExpressionNode, n: number, src: YulExpressionNode): ExpressionNode {
  if (n <= 31) {
    const wide = loc(new CastNode(new BytesType(n + 1), word, false), src);
    const low = loc(new SliceNode(wide, intLit(0n, src), intLit(BigInt(n), src)), src);
    return loc(new CastNode(new BytesType(n), low, false), src);
  }
  const half = 1n << 128n;
  const lowHalf = loc(new BinaryOpNode(word, BinaryOperator.MOD, intLit(half, src)), src);
  const highHalf = loc(new BinaryOpNode(cloneNode(word) as ExpressionNode, BinaryOperator.DIV, intLit(half, src)), src);
  const concat = loc(new BytesConcatNode([wordToBytesN(lowHalf, 16, src), wordToBytesN(highHalf, 16, src)]), src);
  return loc(new CastNode(new BytesType(32), concat, false), src);
}

// Cast a uint256 word to a slot field's stored type: int = a direct cast, bytesN = wordToBytesN. A UDVT then wraps
// the core value (mirroring T.wrap).
function castWordToField(f: SlotField, wordExpr: ExpressionNode, src: YulExpressionNode): ExpressionNode {
  return castWordToFieldType(f.sv.type, wordExpr, src);
}

// The reusable core of castWordToField: cast a uint256 word to the given stored type. Shared by the scalar slot
// path and the composite sub-slot path (a struct field / array element decompose).
function castWordToFieldType(fieldType: Type, wordExpr: ExpressionNode, src: YulExpressionNode): ExpressionNode {
  const core = fieldType instanceof ValueType ? fieldType.underlyingType : fieldType;
  const coreVal = core instanceof BytesType && core.bound !== undefined
    ? wordToBytesN(wordExpr, core.bound, src)
    : loc(new CastNode(core, wordExpr, false), src);
  return fieldType instanceof ValueType ? loc(new CastNode(fieldType, coreVal, false), src) : coreVal;
}

// sload(slot): combine the slot's fields into a word, `uint256(v0) + uint256(v1)*2^off1 + ...`.
function combineSlot(fields: SlotField[], src: YulExpressionNode): ExpressionNode {
  if (isFullWord(fields) && fields[0].sv.type instanceof IntType) {
    return loc(new StateAccessNode(fields[0].sv.name), src);
  }
  let expr: ExpressionNode | undefined;
  for (const f of fields) {
    const word = fieldAsWord(f, src);
    const term = f.bitOffset === 0n
      ? word
      : loc(new BinaryOpNode(word, BinaryOperator.MUL, intLit(2n ** f.bitOffset, src)), src);
    expr = expr ? loc(new BinaryOpNode(expr, BinaryOperator.PLUS, term), src) : term;
  }
  return expr!;
}

// sstore(slot, word): decompose the word into the slot's fields, `vi = type((word / 2^offi) % 2^widthi)`.
// The word is bound to a temp so it is evaluated once.
function decomposeSlot(fields: SlotField[], valueExpr: YulExpressionNode, src: YulExpressionNode): StatementNode {
  if (isFullWord(fields) && fields[0].sv.type instanceof IntType) {
    return loc(new StateAssignNode(fields[0].sv.name, lowerValue(valueExpr)), src);
  }
  const tempName = '__yul_slot';
  const stmts: StatementNode[] = [loc(new VariableDefinitionNode(UINT256, [], tempName, lowerValue(valueExpr)), src)];
  for (const f of fields) {
    let field: ExpressionNode = loc(new IdentifierNode(tempName), src);
    if (f.bitOffset > 0n) field = loc(new BinaryOpNode(field, BinaryOperator.DIV, intLit(2n ** f.bitOffset, src)), src);
    field = loc(new BinaryOpNode(field, BinaryOperator.MOD, intLit(2n ** f.bitWidth, src)), src);
    stmts.push(loc(new StateAssignNode(f.sv.name, castWordToField(f, field, src)), src));
  }
  return loc(new BlockNode(stmts), src);
}

// ---- Composite sub-slot field access: sload/sstore on a fixed struct's / fixed array's own slots ----
// A fixed struct/array state var at base slot p occupies slots [p, p+words). Its VALUE fields/elements pack into
// those slots exactly as EVM lays them out (packWords). `sload(v.slot + i)` reads the packed word at relative
// slot i, `sstore(v.slot + i, w)` writes it. SOUND by reduction: the read combines the high-level field/element
// values into the word EVM's layout would hold; the write REBUILDS the whole composite value with the slot-i
// leaves replaced by the word's decomposed pieces (other members read back unchanged) and assigns it back in ONE
// StateAssign - a struct becomes a ctor, a fixed array an array literal, recursively (exactly the value-rebuild
// shape the AstBuilder emits for `s.f = v` / `a[i] = v`), so it flows through the proven struct/array value
// storage path, never a raw slot. Both reuse fieldAsWordFrom/castWordToFieldType (int/bytesN/UDVT + the
// two's-complement byte trick). Scope: every LEAF must be a supported fixed value type (int/bytesN/bool/enum/UDVT);
// struct + fixed-array nesting is walked recursively (a nested composite member starts a fresh slot, EVM-exact).
// An address or dynamic (bytes/string/mapping/dyn-array) field makes the WHOLE composite fail closed (undefined) -
// unsound layout (a dynamic field holds a length/pointer) or the word cast is not defined. A `path` is the
// field/index step chain from the composite base (`[{field:'inner'},{field:'a'}]`; `[{index:0},{field:'a'}]`).
type PathStep = { field: string } | { index: number };
interface CompLeaf { path: PathStep[]; type: Type; slotOffset: bigint; bitOffset: bigint; bitWidth: bigint; }

// Materialized-layout guard: a composite whose materialized leaves would exceed this fails closed (a top-level
// fixed VALUE array is NOT materialized - compositeArraySlotElems handles it arithmetically - so only a large
// array NESTED in a struct / array of structs is bounded here; those are small in practice).
const COMPOSITE_LEAF_CAP = 4096;

// Pack a sequence of members (a struct's fields or an array's elements) into EVM slots, recursively materializing
// nested struct / fixed-array members. A value member packs by byte width; a composite member starts a fresh slot
// and occupies its whole footprint (EVM Types.cpp). Fails closed on any unsupported leaf or if the leaf count
// exceeds the cap. Returns leaves (relative slots from 0) + the whole-slot footprint.
function packMembers(members: { path: PathStep[]; type: Type }[]): { leaves: CompLeaf[]; words: bigint } | undefined {
  const leaves: CompLeaf[] = [];
  let slot = 0n;
  let byteOff = 0;
  for (const m of members) {
    if (m.type instanceof StructType || (m.type instanceof ArrayType && m.type.bound !== undefined)) {
      if (byteOff > 0) { slot += 1n; byteOff = 0; }
      const sub = materializeLeaves(m.type, m.path);
      if (!sub) return undefined;
      for (const l of sub.leaves) leaves.push({ ...l, slotOffset: l.slotOffset + slot });
      if (leaves.length > COMPOSITE_LEAF_CAP) return undefined;
      slot += sub.words;
      continue;
    }
    if (!isSupportedSlotField(m.type)) return undefined;
    const w = valueByteWidth(m.type);
    if (byteOff + w > 32) { slot += 1n; byteOff = 0; }
    leaves.push({ path: m.path, type: m.type, slotOffset: slot, bitOffset: BigInt(byteOff * 8), bitWidth: BigInt(w * 8) });
    if (leaves.length > COMPOSITE_LEAF_CAP) return undefined;
    byteOff += w;
    if (byteOff >= 32) { slot += 1n; byteOff = 0; }
  }
  return { leaves, words: slot + (byteOff > 0 ? 1n : 0n) };
}

// Materialize the packed value leaves of a fixed struct / fixed array type (nested composites walked recursively).
function materializeLeaves(t: Type, basePath: PathStep[]): { leaves: CompLeaf[]; words: bigint } | undefined {
  if (t instanceof StructType) {
    return packMembers(t.fields.map((f) => ({ path: [...basePath, { field: f.name }], type: f.type })));
  }
  if (t instanceof ArrayType && t.bound !== undefined) {
    if (t.bound > BigInt(COMPOSITE_LEAF_CAP)) return undefined; // huge array: fail closed (OOM guard)
    const members: { path: PathStep[]; type: Type }[] = [];
    for (let i = 0; i < Number(t.bound); i += 1) members.push({ path: [...basePath, { index: i }], type: t.elementType });
    return packMembers(members);
  }
  return undefined;
}

// The materialized leaves of a composite STRUCT state var (its fields, incl. nested structs and fixed-array FIELDS,
// walked recursively). A top-level fixed VALUE array is NOT handled here - compositeArraySlotElems does it
// arithmetically (huge-bound-safe). A top-level fixed array OF STRUCTS is intentionally excluded: the SDK cannot
// yet auto-derive that state-var layout at all (independent of assembly), so its slot access stays fail-closed
// rather than compile to an unusable covenant. Returns the root type + leaves.
function compositeLeaves(sv: StateVariableNode): { root: Type; leaves: CompLeaf[] } | undefined {
  const t = sv.type;
  if (!(t instanceof StructType)) return undefined;
  const walked = materializeLeaves(t, []);
  return walked ? { root: t, leaves: walked.leaves } : undefined;
}

// Elements of a fixed VALUE array `T[k]` that occupy relative slot `rel`. EVM packs floor(32/w) elements per
// slot and never crosses an element over a slot boundary, so this is pure arithmetic - it never materializes all
// `k` elements, keeping a huge bound (`uint8[2e9]`) safe. undefined = not a supported fixed value array (a nested
// composite / address / dynamic / bool / enum element makes it fail closed, same gate as the struct path).
function compositeArraySlotElems(sv: StateVariableNode, rel: bigint):
{ elemType: Type; elems: { index: number; bitOffset: bigint; bitWidth: bigint }[] } | undefined {
  const t = sv.type;
  if (!(t instanceof ArrayType) || t.bound === undefined) return undefined;
  const et = t.elementType;
  if (compositeSlotWords(et) > 0 || !isSupportedSlotField(et)) return undefined;
  const w = valueByteWidth(et);
  const perSlot = Math.floor(32 / w); // w in [1,32] for value types
  if (perSlot < 1) return undefined;
  const start = rel * BigInt(perSlot);
  const elems: { index: number; bitOffset: bigint; bitWidth: bigint }[] = [];
  for (let j = 0; j < perSlot && start + BigInt(j) < t.bound; j += 1) {
    elems.push({ index: Number(start) + j, bitOffset: BigInt(j * w * 8), bitWidth: BigInt(w * 8) });
  }
  return elems.length ? { elemType: et, elems } : undefined;
}

// Resolve a Yul slot argument to a composite state var + the relative slot within it: `sv.slot` (rel 0), a bare
// literal slot inside a composite's range, or `add(sv.slot, k)` (rel k). undefined = not a composite sub-slot.
function resolveCompositeSlotAccess(slotArg: YulExpressionNode): { sv: StateVariableNode; rel: bigint } | undefined {
  let slotNum: bigint | undefined;
  if (isIntLiteral(slotArg)) {
    slotNum = BigInt(slotArg.raw);
  } else if (slotArg instanceof YulPathNode && slotArg.members.length === 1 && slotArg.members[0] === 'slot') {
    slotNum = currentVarSlot.get(slotArg.base);
  } else if (slotArg instanceof YulFunctionCallNode && slotArg.name === 'add' && slotArg.args.length === 2
    && slotArg.args[0] instanceof YulPathNode && slotArg.args[0].members.length === 1
    && slotArg.args[0].members[0] === 'slot' && isIntLiteral(slotArg.args[1])) {
    const base = currentVarSlot.get(slotArg.args[0].base);
    if (base !== undefined) slotNum = base + BigInt(slotArg.args[1].raw);
  }
  if (slotNum === undefined) return undefined;
  const r = compositeRanges.find((x) => x.sv !== undefined && slotNum! >= x.base && slotNum! < x.base + x.words);
  return r && r.sv ? { sv: r.sv, rel: slotNum - r.base } : undefined;
}

// Extract field `i`'s value from the word temp: `(temp / 2^bitOffset) % 2^bitWidth`, cast to the field type.
function decomposeWordPiece(
  tempName: string, type: Type, bitOffset: bigint, bitWidth: bigint, src: YulExpressionNode,
): ExpressionNode {
  let field: ExpressionNode = loc(new IdentifierNode(tempName), src);
  if (bitOffset > 0n) field = loc(new BinaryOpNode(field, BinaryOperator.DIV, intLit(2n ** bitOffset, src)), src);
  field = loc(new BinaryOpNode(field, BinaryOperator.MOD, intLit(2n ** bitWidth, src)), src);
  return castWordToFieldType(type, field, src);
}

// The high-level read of a (possibly nested) leaf: a FieldAccess/ArrayAccess chain on the state var, following the
// path's field/index steps (`s.inner.a`, `s.arr[1]`, `ps[0].a`).
function readLeafPath(svName: string, path: PathStep[], src: YulExpressionNode): ExpressionNode {
  let e: ExpressionNode = loc(new StateAccessNode(svName), src);
  for (const step of path) {
    e = 'field' in step
      ? loc(new FieldAccessNode(e, step.field), src)
      : loc(new ArrayAccessNode(e, intLit(BigInt(step.index), src)), src);
  }
  return e;
}

function stepEq(a: PathStep, b: PathStep): boolean {
  return 'field' in a ? ('field' in b && a.field === b.field) : (!('field' in b) && a.index === b.index);
}
function pathStartsWith(path: PathStep[], prefix: PathStep[]): boolean {
  return prefix.length <= path.length && prefix.every((p, i) => stepEq(p, path[i]));
}

// Build a member's value for a slot-`rel` rebuild: a value LEAF at slot `rel` is the word's decomposed piece, any
// other leaf is read back; a COMPOSITE member is rebuilt recursively (ctor for a struct, array literal for a fixed
// array) only when one of ITS leaves is at `rel`, else the whole member is read back unchanged. Emits only proven
// high-level AST (nested ctors + array literals + FieldAccess/ArrayAccess reads), so it flows through the normal
// value storage path.
function buildMember(
  svName: string, t: Type, path: PathStep[], rel: bigint, leaves: CompLeaf[], tempName: string, src: YulExpressionNode,
): ExpressionNode {
  const isComposite = t instanceof StructType || (t instanceof ArrayType && t.bound !== undefined);
  if (isComposite) {
    if (!leaves.some((l) => l.slotOffset === rel && pathStartsWith(l.path, path))) {
      return readLeafPath(svName, path, src); // no leaf here is at the target slot: read the whole member back
    }
    if (t instanceof StructType) {
      const args = t.fields.map((f) => buildMember(
        svName, f.type, [...path, { field: f.name }], rel, leaves, tempName, src,
      ));
      return loc(new FunctionCallNode(loc(new IdentifierNode(t.name), src), args), src);
    }
    const at = t as ArrayType;
    const els: ExpressionNode[] = [];
    for (let i = 0; i < Number(at.bound!); i += 1) {
      els.push(buildMember(svName, at.elementType, [...path, { index: i }], rel, leaves, tempName, src));
    }
    return loc(new ArrayNode(els), src);
  }
  const leaf = leaves.find((l) => l.path.length === path.length && pathStartsWith(l.path, path));
  return leaf && leaf.slotOffset === rel
    ? decomposeWordPiece(tempName, leaf.type, leaf.bitOffset, leaf.bitWidth, src)
    : readLeafPath(svName, path, src);
}

// sload(sv.slot + rel): combine the composite's value fields/elements at relative slot `rel` into a word.
function combineCompositeSlot(sv: StateVariableNode, rel: bigint, src: YulExpressionNode): ExpressionNode | undefined {
  const combine = (terms: ExpressionNode[]): ExpressionNode => terms
    .reduce((a, t) => loc(new BinaryOpNode(a, BinaryOperator.PLUS, t), src));
  const shifted = (word: ExpressionNode, bitOffset: bigint): ExpressionNode => (bitOffset === 0n
    ? word
    : loc(new BinaryOpNode(word, BinaryOperator.MUL, intLit(2n ** bitOffset, src)), src));
  const ml = compositeLeaves(sv);
  if (ml) {
    const at = ml.leaves.filter((l) => l.slotOffset === rel);
    if (at.length === 0) return undefined; // padding-only / out-of-range slot: fail closed
    return combine(at.map((l) => shifted(fieldAsWordFrom(readLeafPath(sv.name, l.path, src), l.type, src), l.bitOffset)));
  }
  const arr = compositeArraySlotElems(sv, rel);
  if (arr) {
    return combine(arr.elems.map((e) => {
      const access = loc(new ArrayAccessNode(loc(new IdentifierNode(sv.name), src), intLit(BigInt(e.index), src)), src);
      return shifted(fieldAsWordFrom(access, arr.elemType, src), e.bitOffset);
    }));
  }
  return undefined;
}

// sstore(sv.slot + rel, word): write the word's decomposed pieces into the composite's slot-`rel` leaves. A
// materialized composite (struct / array-of-composite) REBUILDS the whole value with the slot-rel leaves replaced
// (others read back) in ONE StateAssign (buildMember: nested ctors + array literals - the AstBuilder's own
// value-rebuild shape). A top-level fixed VALUE array writes each slot-rel element in place (ArrayAssign; arrays
// have per-element write codegen, no whole-value rebuild needed).
function decomposeCompositeSlot(
  sv: StateVariableNode, rel: bigint, valueExpr: YulExpressionNode, src: YulExpressionNode,
): StatementNode | undefined {
  const tempName = '__yul_slot';
  const ml = compositeLeaves(sv);
  if (ml) {
    if (!ml.leaves.some((l) => l.slotOffset === rel)) return undefined; // no leaf in this slot: fail closed
    const value = buildMember(sv.name, ml.root, [], rel, ml.leaves, tempName, src);
    return loc(new BlockNode([
      loc(new VariableDefinitionNode(UINT256, [], tempName, lowerValue(valueExpr)), src),
      loc(new StateAssignNode(sv.name, value), src),
    ]), src);
  }
  const arr = compositeArraySlotElems(sv, rel);
  if (arr) {
    const stmts: StatementNode[] = [loc(new VariableDefinitionNode(UINT256, [], tempName, lowerValue(valueExpr)), src)];
    for (const e of arr.elems) {
      const val = decomposeWordPiece(tempName, arr.elemType, e.bitOffset, e.bitWidth, src);
      stmts.push(loc(new ArrayAssignNode(sv.name, intLit(BigInt(e.index), src), val), src));
    }
    return loc(new BlockNode(stmts), src);
  }
  return undefined;
}

// Transient storage (tstore/tload) maps to a zero-initialized, function-execution-scoped local keyed by the
// constant slot. BCH has no tx-scoped contract storage and one spend = one execution, so this is compile
// parity (e.g. a reentrancy guard is inert). The key must be a literal or a bare (constant) identifier.
// Keys used while lowering one assembly block (local name -> a source node for location); declarations are
// hoisted to the block's top.
const transientKeys = new Map<string, YulExpressionNode>();

function transientLocalName(keyArg: YulExpressionNode): string | undefined {
  if (isIntLiteral(keyArg)) return `__yul_tslot_${BigInt(keyArg.raw)}`;
  if (keyArg instanceof YulPathNode && keyArg.members.length === 0) return `__yul_tslot_${keyArg.base}`;
  return undefined;
}

const BYTES32 = new BytesType(32);

// Compile-time word-addressed memory (constant byte offset -> the stored Yul value), per assembly block. This
// is not EVM linear memory: it models the common keccak/abi scratch pattern (mstore at constant offsets, then
// keccak over a constant region). The stored value is re-lowered at each read, which is correct as long as it
// is not mutated between the mstore and the read (the usual store-then-hash shape).
const memory = new Map<bigint, YulExpressionNode>();

// Let-bound mapping-slot vars: `let slot := keccak256(0,64)` recognized as m[k] at its binding (when the memory
// map is correct), so a later `sstore(slot, v)` / `sload(slot)` routes to the high-level mapping. The dead keccak
// binding is dropped (an on-chain keccak per mapping access would blow the compute budget). Reset per block.
const mappingSlotVars = new Map<string, { collection: string; keys: ExpressionNode[] }>();
// Let-bound array-element slot vars: `let pos := add(keccak256(0,32), i)` recognized as arr[i] at its binding, so a
// later `sstore(pos, v)` / `sload(pos)` routes to the element (parallel to mappingSlotVars). Reset per block.
const arrayElemSlotVars = new Map<string, { arrName: string; index: ExpressionNode }>();

// ---- P7: runtime linear-memory buffer for Yul memory the compile-time model cannot resolve ----
// When the compile-time `memory` map fails (dynamic offset, sub-word/dynamic keccak, msize, mcopy), the WHOLE
// assembly block is re-lowered with `runtimeMem = true`, routing every memory op to a self-declared `__yulmem`
// byte buffer laid out like EVM memory: reserved region 0x00-0x7f with the free-memory pointer (initial 0x80)
// stored at slot 0x40 (/Code/solidity CompilerUtils.cpp:45-52, layout_in_memory.rst). Words are 32-byte
// little-endian (BCH-native bytes32(uint) - low byte at index 0, NOT EVM big-endian; see
// docs/platform-differences.md); the buffer grows to cover each store. mload of unwritten memory is not modeled
// (real code writes before it reads); the heap is bounded by the max stack-element size (experimental-grade).
let runtimeMem = false;
let yulMemUsed = false;
// Set true when any assembly block in the current function lowered to the runtime `__yulmem` buffer. EVM memory
// is function-scoped, so one buffer is declared at the function-body top and shared across every block (a later
// block reads what an earlier one wrote); a per-block re-init would reset the free pointer to 0x80 each time.
let functionYulMemUsed = false;
let yulTmpN = 0;

// A Yul log0-log4 (EVM LOG opcodes = event emission) was lowered in the current contract: emit its topics + data
// region as an anonymous event NFT. Set while lowering; the `event __YulLog(bytes) anonymous` decl is synthesized
// in visitContract afterward. NOT diagnostics - `console.log` is a separate facility.
let logEventUsed = false;
const YUL_LOG_EVENT = '__YulLog';

const yulmem = (src: YulNode): IdentifierNode => loc(new IdentifierNode(YULMEM), src);
const memLen = (src: YulNode): ExpressionNode => loc(new UnaryOpNode(UnaryOperator.SIZE, yulmem(src)), src);
const addE = (l: ExpressionNode, r: ExpressionNode, src: YulNode): ExpressionNode =>
  loc(new BinaryOpNode(l, BinaryOperator.PLUS, r), src);
function newBytes(size: ExpressionNode, src: YulNode): NewArrayNode {
  const arr = loc(new NewArrayNode(new BytesType(1), size), src);
  arr.rawBytes = true;
  arr.type = new BytesType();
  return arr;
}

// `bytes __yulmem = <128-byte EVM reserved region>`: scratch 0x00-0x3f, the free-memory pointer value 0x80 stored at
// slot 0x40 (so `mload(0x40)` reads 0x80), zero slot 0x60-0x7f. The reserved layout is built by ./YulMemPrimitives,
// shared with the high-level memory model so both passes agree on the buffer's addressing.
function yulMemInit(src: { location?: Node['location'] }): StatementNode {
  return loc(new VariableDefinitionNode(new BytesType(), [], YULMEM, buildReservedInit(src)), src);
}

// `if (__yulmem.length < <off>+word) __yulmem = bytes.concat(__yulmem, new bytes(<off>+word - __yulmem.length));`
function growTo(offName: string, word: bigint, src: YulNode): StatementNode {
  return memGrowTo(() => addE(loc(new IdentifierNode(offName), src), intLit(word, src), src), src);
}

// mstore(off, val): grow to cover off+32, then splice the 32-byte little-endian word (bytes32(val)) in place. The
// splice lowering lives in ./YulMemPrimitives (shared with the high-level memory model).
function runtimeMstore(offExpr: ExpressionNode, valExpr: ExpressionNode, src: YulNode): StatementNode {
  yulMemUsed = true;
  const offName = `__yoff_${yulTmpN++}`;
  const off = (): ExpressionNode => loc(new IdentifierNode(offName), src);
  // Memory offsets are Yul words even when their main-AST producer is bytes32 (e.g. keccak256(...)).
  const decl = loc(new VariableDefinitionNode(
    UINT256, [], offName, loc(new CastNode(UINT256, offExpr, false), src),
  ), src);
  const store = memWordStore(off, valExpr, src);
  return loc(new BlockNode([decl, growTo(offName, 32n, src), store]), src);
}

// mstore8(off, val): grow to cover off+1, then splice ONE byte at position off - val's low byte, which is
// bytes32(val)[0:1] under BCH's little-endian word encoding (byte 0 = the low byte, same convention runtimeMstore
// writes and runtimeMload reads). A later full-word mload straddling this write reads zeros for the unwritten
// bytes via runtimeMload's trailing zero pad. The splice lowering lives in ./YulMemPrimitives.
function runtimeMstore8(offExpr: ExpressionNode, valExpr: ExpressionNode, src: YulNode): StatementNode {
  yulMemUsed = true;
  const offName = `__yoff8_${yulTmpN++}`;
  const off = (): ExpressionNode => loc(new IdentifierNode(offName), src);
  const decl = loc(new VariableDefinitionNode(
    UINT256, [], offName, loc(new CastNode(UINT256, offExpr, false), src),
  ), src);
  const store = memByteStore(off, valExpr, { fullWord: true }, src);
  return loc(new BlockNode([decl, growTo(offName, 1n, src), store]), src);
}

// returndatacopy(dst, off, len): splice the last low-level call's return data (the tracked `bytes` var) into
// __yulmem[dst : dst+len], so a later mload/return reads the copied data. The return data is captured by the
// external-call lowering as a `bytes` local (lastReturnData). No-op if no call preceded (empty return data).
function runtimeReturndatacopy(
  dstArg: YulExpressionNode, offArg: YulExpressionNode, lenArg: YulExpressionNode, src: YulNode,
): StatementNode {
  if (lastReturnData === undefined) return loc(new BlockNode([]), src);
  yulMemUsed = true;
  const dstName = `__yrdc_dst_${yulTmpN}`;
  const lenName = `__yrdc_len_${yulTmpN}`;
  yulTmpN += 1;
  const dst = (): ExpressionNode => loc(new IdentifierNode(dstName), src);
  const len = (): ExpressionNode => loc(new IdentifierNode(lenName), src);
  const need = (): ExpressionNode => addE(dst(), len(), src);
  const rd = loc(new IdentifierNode(lastReturnData), src);
  const off = lowerValue(offArg);
  const declDst = loc(new VariableDefinitionNode(UINT256, [], dstName, lowerValue(dstArg)), src);
  const declLen = loc(new VariableDefinitionNode(UINT256, [], lenName, lowerValue(lenArg)), src);
  const grow = memGrowTo(need, src);
  const head = loc(new SliceNode(yulmem(src), intLit(0n, src), dst()), src);
  const rdSlice = loc(new SliceNode(rd, off, addE(off, len(), src)), src);
  const tail = loc(new SliceNode(yulmem(src), need(), memLen(src)), src);
  const store = loc(new AssignNode(yulmem(src), loc(new BytesConcatNode([head, rdSlice, tail]), src)), src);
  return loc(new BlockNode([declDst, declLen, grow, store]), src);
}

// return(ptr, size): end execution returning __yulmem[ptr : ptr+size] as the function's bytes result. The buffer
// is zero-padded by `size` first so a return region past the written high-water reads EVM-faithful zeros. Yul
// offset/size expressions are pure, so lowering each twice is safe.
function runtimeReturn(ptrArg: YulExpressionNode, sizeArg: YulExpressionNode, src: YulNode): StatementNode {
  yulMemUsed = true;
  const ptr = (): ExpressionNode => lowerValue(ptrArg);
  const size = (): ExpressionNode => lowerValue(sizeArg);
  const padded = loc(new BytesConcatNode([yulmem(src), newBytes(size(), src)]), src);
  const slice = loc(new SliceNode(padded, ptr(), addE(ptr(), size(), src)), src);
  return loc(new ReturnNode([slice]), src);
}

// Copy srcBytes[srcOff : srcOff+len] into __yulmem[dst : dst+len], growing the buffer to cover it. Shared by
// codecopy (src = own bytecode), extcodecopy (src = addr.code) and calldatacopy (src = synthesized EVM calldata /
// a bytes calldata param). dst/srcOff/len are ALREADY-LOWERED expressions (bound to temps here, so any complexity
// is evaluated once). The source is zero-padded to srcOff+len so a copy past its end yields EVM-faithful zeros
// (returndatacopy is NOT routed here: EVM reverts, not zero-pads, past returndatasize).
function runtimeCopyInto(
  srcBytes: ExpressionNode, dstE: ExpressionNode, srcOffE: ExpressionNode, lenE: ExpressionNode, src: YulNode,
): StatementNode {
  yulMemUsed = true;
  const n = yulTmpN++;
  const dstName = `__ycpy_dst_${n}`, offName = `__ycpy_off_${n}`, lenName = `__ycpy_len_${n}`;
  const dst = (): ExpressionNode => loc(new IdentifierNode(dstName), src);
  const off = (): ExpressionNode => loc(new IdentifierNode(offName), src);
  const len = (): ExpressionNode => loc(new IdentifierNode(lenName), src);
  const need = (): ExpressionNode => addE(dst(), len(), src);
  const decls = [
    loc(new VariableDefinitionNode(UINT256, [], dstName, dstE), src),
    loc(new VariableDefinitionNode(UINT256, [], offName, srcOffE), src),
    loc(new VariableDefinitionNode(UINT256, [], lenName, lenE), src),
  ];
  const grow = memGrowTo(need, src);
  const srcPad = loc(new BytesConcatNode([srcBytes, newBytes(addE(off(), len(), src), src)]), src);
  const srcSlice = loc(new SliceNode(srcPad, off(), addE(off(), len(), src)), src);
  const head = loc(new SliceNode(yulmem(src), intLit(0n, src), dst()), src);
  const tail = loc(new SliceNode(yulmem(src), need(), memLen(src)), src);
  const store = loc(new AssignNode(yulmem(src), loc(new BytesConcatNode([head, srcSlice, tail]), src)), src);
  return loc(new BlockNode([...decls, grow, store]), src);
}

// The synthesized EVM calldata `msg.sig ++ bytes32(p0) ++ bytes32(p1) ++ ...` that calldataload/calldatasize model
// (each int param a 32-byte word at offset 4+32k, in mstore/mload's bytes32 convention so a copy then mload round-
// trips). msg.sig is entry-point-only (MsgSigInInternalFunctionError in a subroutine). A non-int param throws
// YulNotLowerable - the word model is int-only, exactly like calldataload.
function synthesizedCalldata(src: YulNode): ExpressionNode {
  const parts: ExpressionNode[] = [loc(new NullaryOpNode(NullaryOperator.MSG_SIG), src)];
  for (const p of currentParams) {
    if (!(p.type instanceof IntType)) throw new YulNotLowerable();
    parts.push(loc(new CastNode(BYTES32, loc(new IdentifierNode(p.name), src), false), src));
  }
  return parts.length === 1 ? parts[0] : loc(new BytesConcatNode(parts), src);
}

// A calldata param ABI-encoded in the TAIL (a pointer word in the head): unbounded bytes/string/array.
function isDynamicCalldataType(t: Type): boolean {
  return (t instanceof BytesType && t.bound === undefined)
    || t === PrimitiveType.STRING
    || (t instanceof ArrayType && t.bound === undefined);
}

// The 32-byte HEAD words a calldata param occupies: a dynamic param takes ONE offset word; a value one; a fixed
// array/struct is inlined as its whole word footprint. undefined = a shape we do not model (fail closed).
function calldataHeadWords(t: Type): number | undefined {
  if (isDynamicCalldataType(t)) return 1;
  if (t instanceof IntType || t instanceof AddressType || t === PrimitiveType.BOOL
    || t instanceof EnumType || t instanceof ValueType || (t instanceof BytesType && t.bound !== undefined)) return 1;
  const words = compositeSlotWords(t);
  return words > 0 ? words : undefined;
}

// The compile-time ABI calldata byte offset of a dynamic param's DATA (`x.offset`): 4 (selector) + head size + 32
// (skip x's own length word), valid when x is the FIRST dynamic param (a preceding dynamic param makes the tail
// cumulative + runtime-length-dependent -> fail closed). EVM-ABI of the Solidity signature; on BCH there is no ABI
// calldata, so this is the EVM-parity value the assembly expects.
function calldataDataOffset(name: string): bigint | undefined {
  const idx = currentParams.findIndex((p) => p.name === name);
  if (idx < 0 || !isDynamicCalldataType(currentParams[idx].type)) return undefined;
  if (currentParams.slice(0, idx).some((p) => isDynamicCalldataType(p.type))) return undefined;
  let headWords = 0;
  for (const p of currentParams) {
    const w = calldataHeadWords(p.type);
    if (w === undefined) return undefined;
    headWords += w;
  }
  return 4n + BigInt(headWords) * 32n + 32n;
}

// A calldata param's `.offset`/`.length` that is ASSIGNED in the function (`x.offset := v`) is a mutable Yul
// calldata-pointer component: modeled as a function-scoped local `__cd_<base>_<member>` (default = the compile-time
// offset / SIZE(param)), so a later read in ANY block returns the assigned value. Keyed "base.member". Populated by
// prescan in visitFunctionDefinition; read/assign consult it.
let mutableCalldataComponents = new Set<string>();
const cdComponentLocal = (base: string, member: string): string => `__cd_${base}_${member}`;

function scanYulForComponentAssigns(block: YulBlockNode, out: Set<string>): void {
  for (const s of block.statements) {
    if (s instanceof YulAssignmentNode) {
      for (const p of s.paths) {
        if (p.members.length === 1 && (p.members[0] === 'offset' || p.members[0] === 'length')) {
          out.add(`${p.base}.${p.members[0]}`);
        }
      }
    } else if (s instanceof YulIfNode) scanYulForComponentAssigns(s.body, out);
    else if (s instanceof YulForLoopNode) {
      scanYulForComponentAssigns(s.pre, out);
      scanYulForComponentAssigns(s.post, out);
      scanYulForComponentAssigns(s.body, out);
    } else if (s instanceof YulSwitchNode) {
      for (const c of s.cases) scanYulForComponentAssigns(c.body, out);
      if (s.defaultBody) scanYulForComponentAssigns(s.defaultBody, out);
    } else if (s instanceof YulBlockNode) scanYulForComponentAssigns(s, out);
  }
}

function collectMutableCalldataComponents(node: Node, out: Set<string>): void {
  if (node instanceof AssemblyStatementNode && node.yulBlock) scanYulForComponentAssigns(node.yulBlock, out);
  for (const key of Object.keys(node)) {
    const v = (node as unknown as Record<string, unknown>)[key];
    if (v instanceof Node) collectMutableCalldataComponents(v, out);
    else if (Array.isArray(v)) for (const x of v) if (x instanceof Node) collectMutableCalldataComponents(x, out);
  }
}

// `calldatacopy(_, P.offset, P.length)` where P is a bytes calldata param -> P (the copied calldata region IS the
// param's bytes). offset/length are the Yul calldata-slice accessors on the same param. Returns the param name.
function resolveCalldataParamCopy(off: YulExpressionNode, len: YulExpressionNode): string | undefined {
  const isAcc = (e: YulExpressionNode, m: string): e is YulPathNode =>
    e instanceof YulPathNode && e.members.length === 1 && e.members[0] === m;
  if (!isAcc(off, 'offset') || !isAcc(len, 'length') || off.base !== len.base) return undefined;
  const p = currentParams.find((pp) => pp.name === off.base && pp.type instanceof BytesType);
  return p?.name;
}

// mload(off) -> uint256(bytes32(__yulmem[off : off+32])). A trailing zero word is appended before slicing so a
// read straddling the written high-water mark returns EVM-faithful zeros (e.g. a full-word mload after an mstore8
// that only grew the buffer by one byte). Yul offset expressions are pure, so lowering twice is safe.
function runtimeMload(offArg: YulExpressionNode, src: YulNode): ExpressionNode {
  yulMemUsed = true;
  return memWordLoad(() => lowerValue(offArg), { pad: true, decodeType: UINT256 }, src);
}

// keccak256(p, len) -> keccak256(__yulmem[p : p+len]); len may be sub-word.
function runtimeKeccak(pArg: YulExpressionNode, lenArg: YulExpressionNode, src: YulNode): ExpressionNode {
  yulMemUsed = true;
  const slice = loc(new SliceNode(yulmem(src), lowerValue(pArg), addE(lowerValue(pArg), lowerValue(lenArg), src)), src);
  return loc(new FunctionCallNode(loc(new IdentifierNode('keccak256'), src), [slice]), src);
}

// mcopy(dst, src, len): grow to cover both regions, then splice bytes read from the CURRENT buffer at [dst,dst+len).
// The source slice is evaluated before the assignment, so overlapping copies behave like memmove.
function runtimeMcopy(dstE: ExpressionNode, srcE: ExpressionNode, lenE: ExpressionNode, src: YulNode): StatementNode {
  yulMemUsed = true;
  const d = `__ydst_${yulTmpN++}`; const s = `__ysrc_${yulTmpN++}`; const l = `__ylen_${yulTmpN++}`;
  const id = (n: string): ExpressionNode => loc(new IdentifierNode(n), src);
  const decls = [
    loc(new VariableDefinitionNode(UINT256, [], d, dstE), src),
    loc(new VariableDefinitionNode(UINT256, [], s, srcE), src),
    loc(new VariableDefinitionNode(UINT256, [], l, lenE), src),
  ];
  const growSrc = growTo2(addE(id(s), id(l), src), src);
  const growDst = growTo2(addE(id(d), id(l), src), src);
  const from = loc(new SliceNode(yulmem(src), id(s), addE(id(s), id(l), src)), src);
  const head = loc(new SliceNode(yulmem(src), intLit(0n, src), id(d)), src);
  const tail = loc(new SliceNode(yulmem(src), addE(id(d), id(l), src), memLen(src)), src);
  const store = loc(new AssignNode(yulmem(src), loc(new BytesConcatNode([head, from, tail]), src)), src);
  return loc(new BlockNode([...decls, growSrc, growDst, store]), src);
}

// grow to cover an arbitrary need expression (mcopy uses this; the store form uses growTo with a named offset). The
// need is bound to a temp once (mcopy's need re-evaluates two temps), then the grow branch is the shared memGrowTo.
function growTo2(need: ExpressionNode, src: YulNode): StatementNode {
  const nName = `__yneed_${yulTmpN++}`;
  const n = (): ExpressionNode => loc(new IdentifierNode(nName), src);
  const decl = loc(new VariableDefinitionNode(UINT256, [], nName, need), src);
  return loc(new BlockNode([decl, memGrowTo(n, src)]), src);
}

// msize() -> current buffer length (the largest word-aligned index reached by the stores above).
function runtimeMsize(src: YulNode): ExpressionNode {
  yulMemUsed = true;
  return loc(new CastNode(UINT256, memLen(src), false), src);
}

// EVM `bytes memory` layout is [length(32)][data...], so `add(ptr, off)` points at data[off-32]. Parse the
// `add(<bytesParam>, <const off>)` pointer form to { name, start=off-32 } (start = the byte offset into the value).
function parseBytesPtr(memArg: YulExpressionNode): { name: string; start: bigint } | undefined {
  if (!(memArg instanceof YulFunctionCallNode) || memArg.name !== 'add' || memArg.args.length !== 2) return undefined;
  const [base, offArg] = memArg.args;
  if (!(base instanceof YulPathNode) || base.members.length > 0 || !isIntLiteral(offArg)) return undefined;
  const param = currentParams.find((p) => p.name === base.base && p.type instanceof BytesType);
  if (!param) return undefined;
  const start = BigInt(offArg.raw) - 32n; // skip the length word
  if (start < 0n) return undefined;
  return { name: base.base, start };
}

// `mload(add(ptr, off))` reads the 32-byte word at data[off-32 : off] -> `bytes32(ptr[off-32 : off])`.
function bytesMemorySlice(memArg: YulExpressionNode): ExpressionNode | undefined {
  const ptr = parseBytesPtr(memArg);
  if (!ptr) return undefined;
  const slice = loc(
    new SliceNode(loc(new IdentifierNode(ptr.name), memArg), intLit(ptr.start, memArg), intLit(ptr.start + 32n, memArg)),
    memArg,
  );
  return loc(new CastNode(BYTES32, slice, false), memArg);
}

// keccak256(p, len): hash the constant region [p, p+len) = the words at p, p+32, ... concatenated. Each word is
// rendered as bytes32 (no-op for a bytes32 value, BCH-native little-endian for an int) before concatenation.
function lowerKeccak(call: YulFunctionCallNode): ExpressionNode {
  const [pArg, lenArg] = call.args;
  if (!isIntLiteral(pArg) || !isIntLiteral(lenArg)) throw new YulNotLowerable();
  const p = BigInt(pArg.raw);
  const len = BigInt(lenArg.raw);
  if (len <= 0n || len % 32n !== 0n) throw new YulNotLowerable();
  const words: ExpressionNode[] = [];
  for (let off = p; off < p + len; off += 32n) {
    const v = memory.get(off);
    if (v === undefined) throw new YulNotLowerable(); // region not fully covered by mstore'd words
    words.push(loc(new CastNode(BYTES32, lowerValue(v), false), call));
  }
  const concat = loc(new BytesConcatNode(words), call);
  return loc(new FunctionCallNode(loc(new IdentifierNode('keccak256'), call), [concat]), call);
}

// A Yul word that is a compile-time-constant storage slot number: an int literal, or a `<var>.slot` path.
function constSlotOf(word: YulExpressionNode): bigint | undefined {
  if (isIntLiteral(word)) return BigInt(word.raw);
  if (word instanceof YulPathNode && word.members.length === 1 && word.members[0] === 'slot') {
    return currentVarSlot.get(word.base);
  }
  return undefined;
}

// The EVM mapping-slot idiom: `mstore(0,k); mstore(32,p); ... keccak256(0,64)` derives `m[k]`'s slot for the
// mapping m declared at slot p. Recognize it and return {collection, key} so sload/sstore route to the high-level
// mapping m (Tier-2 interop: the assembly and high-level m[k] share the entry collection) instead of an anonymous
// __evm_storage entry. Requires the two-word region fully mstore'd at compile time with word[1] = a mapping slot.
function mappingSlotIdiom(slotArg: YulExpressionNode): { collection: string; keys: ExpressionNode[] } | undefined {
  if (!(slotArg instanceof YulFunctionCallNode) || slotArg.name !== 'keccak256' || slotArg.args.length !== 2) {
    return undefined;
  }
  const [pArg, lenArg] = slotArg.args;
  if (!isIntLiteral(pArg) || !isIntLiteral(lenArg) || BigInt(lenArg.raw) !== 64n) return undefined;
  const p = BigInt(pArg.raw);
  const keyWord = memory.get(p); // this level's key k
  const slotWord = memory.get(p + 32n); // the base slot: a declared mapping, or a tracked partial access m[k1..]
  if (keyWord === undefined || slotWord === undefined) return undefined;
  // NESTED: the base word is a tracked partial mapping-slot var (m[k1]) -> extend to m[k1][k]. This is the
  // `mapping(a=>mapping(b=>c))` double-keccak idiom (allowances[owner][spender]).
  if (slotWord instanceof YulPathNode && slotWord.members.length === 0) {
    const base = mappingSlotVars.get(slotWord.base);
    if (base) return { collection: base.collection, keys: [...base.keys, lowerValue(keyWord)] };
  }
  // FIRST LEVEL: the base word is a declared mapping's slot.
  const slotNum = constSlotOf(slotWord);
  if (slotNum !== undefined) {
    const collection = currentMappingSlots.get(slotNum);
    if (collection !== undefined) return { collection, keys: [lowerValue(keyWord)] };
  }
  return undefined;
}

// Resolve a sload/sstore slot arg to a high-level mapping access: the inline `keccak256(0,64)` idiom, or a
// let-bound slot var (`let slot := keccak256(0,64)`, the canonical gas-optimized form) tracked at its binding.
function resolveMappingSlot(slotArg: YulExpressionNode): { collection: string; keys: ExpressionNode[] } | undefined {
  if (slotArg instanceof YulPathNode && slotArg.members.length === 0) return mappingSlotVars.get(slotArg.base);
  return mappingSlotIdiom(slotArg);
}

// The EVM dynamic-array element-slot idiom: EVM stores a dynamic array's elements at keccak(slot), so
// `mstore(0, arr.slot); keccak256(0, 32)` is the element DATA base and `+ i` selects element i - i.e.
// `sstore(keccak256(0,32)+i, v)` == `arr[i] = v`, `sload(...)` == `arr[i]`. Recognized ONLY at len 32 (one word):
// a different keccak length is a distinct hash, NOT this array's base (the keccak256_optimizer_cache_bug case where
// keccak(0,23) must NOT alias keccak(0,32)). The array must be a declared fixed-width-element dynamic array.
function arrayDataBaseName(kecc: YulExpressionNode): string | undefined {
  if (!(kecc instanceof YulFunctionCallNode) || kecc.name !== 'keccak256' || kecc.args.length !== 2) return undefined;
  const [pArg, lenArg] = kecc.args;
  if (!isIntLiteral(pArg) || !isIntLiteral(lenArg) || BigInt(lenArg.raw) !== 32n) return undefined;
  const slotWord = memory.get(BigInt(pArg.raw));
  if (slotWord === undefined) return undefined;
  const slotNum = constSlotOf(slotWord);
  if (slotNum === undefined) return undefined;
  const fields = currentSlots.get(slotNum);
  if (fields && fields.length === 1 && fields[0].sv.isDynamic && fields[0].sv.type instanceof ArrayType
    && isFixedWidthType(fields[0].sv.type.elementType)) {
    return fields[0].sv.name;
  }
  return undefined;
}

// Resolve a slot arg to a dynamic-array element access: a let-bound var (`let pos := add(keccak256(0,32), i)`),
// `keccak256(0,32)` (element 0), or `add(keccak256(0,32), i)`.
function resolveArrayElementSlot(slotArg: YulExpressionNode): { arrName: string; index: ExpressionNode } | undefined {
  if (slotArg instanceof YulPathNode && slotArg.members.length === 0) {
    const bound = arrayElemSlotVars.get(slotArg.base);
    if (bound) return { arrName: bound.arrName, index: cloneNode(bound.index) as ExpressionNode };
  }
  const direct = arrayDataBaseName(slotArg);
  if (direct) return { arrName: direct, index: intLit(0n, slotArg) };
  if (slotArg instanceof YulFunctionCallNode && slotArg.name === 'add' && slotArg.args.length === 2) {
    const base = arrayDataBaseName(slotArg.args[0]);
    if (base) return { arrName: base, index: lowerValue(slotArg.args[1]) };
  }
  return undefined;
}

// Build the anonymous-event emit for a Yul log0-log4: `emit __YulLog(topics ++ mem[p:p+len])`. Each topic is a
// 32-byte word; the data region reuses the keccak reconstruction (constant word-concat, or a runtime __yulmem
// slice). Sets logEventUsed so visitContract synthesizes the event decl. log0 has no topics but still emits data.
function buildLogEmit(
  topics: YulExpressionNode[], pArg: YulExpressionNode, lenArg: YulExpressionNode, src: YulNode,
): StatementNode {
  logEventUsed = true;
  const parts: ExpressionNode[] = topics.map((t) => loc(new CastNode(BYTES32, lowerValue(t), false), src));
  if (!(isIntLiteral(lenArg) && BigInt(lenArg.raw) === 0n)) {
    if (runtimeMem) {
      yulMemUsed = true;
      parts.push(loc(new SliceNode(yulmem(src), lowerValue(pArg), addE(lowerValue(pArg), lowerValue(lenArg), src)), src));
    } else if (isIntLiteral(pArg) && isIntLiteral(lenArg)) {
      const p = BigInt(pArg.raw); const len = BigInt(lenArg.raw);
      if (len % 32n !== 0n) throw new YulNotLowerable(); // sub-word data -> re-lower on the runtime buffer
      for (let off = p; off < p + len; off += 32n) {
        const v = memory.get(off);
        if (v === undefined) throw new YulNotLowerable(); // region not fully mstore'd
        parts.push(loc(new CastNode(BYTES32, lowerValue(v), false), src));
      }
    } else {
      throw new YulNotLowerable(); // dynamic p/len -> retry on the runtime buffer
    }
  }
  const data = parts.length === 0 ? loc(new HexLiteralNode(new Uint8Array(0)), src)
    : parts.length === 1 ? parts[0]
      : loc(new BytesConcatNode(parts), src);
  return loc(new EmitStatementNode(YUL_LOG_EVENT, [data]), src);
}

// Yul arithmetic builtins -> solidc operators (value `a op b`).
const ARITH_OPS: Record<string, BinaryOperator> = {
  add: BinaryOperator.PLUS, sub: BinaryOperator.MINUS, mul: BinaryOperator.MUL,
  div: BinaryOperator.DIV, sdiv: BinaryOperator.DIV, mod: BinaryOperator.MOD, smod: BinaryOperator.MOD,
  exp: BinaryOperator.POW,
};
// Integer bitwise needs both operands to be a bounded int, so literal operands are cast to uint256.
const BITWISE_OPS: Record<string, BinaryOperator> = {
  and: BinaryOperator.BIT_AND, or: BinaryOperator.BIT_OR, xor: BinaryOperator.BIT_XOR,
};
// Yul comparison builtins -> solidc comparison operator (boolean result).
const CMP_OPS: Record<string, BinaryOperator> = {
  lt: BinaryOperator.LT, slt: BinaryOperator.LT, gt: BinaryOperator.GT, sgt: BinaryOperator.GT,
  eq: BinaryOperator.EQ,
};
// Nullary Yul context builtins -> the solidc global they name (the same NullaryOp the front end emits for
// `msg.*`/`tx.*`/`block.*`). Each is a plain 1:1 rename.
const NULLARY_CONTEXT: Record<string, NullaryOperator> = {
  caller: NullaryOperator.MSG_SENDER,
  callvalue: NullaryOperator.MSG_VALUE,
  origin: NullaryOperator.TX_ORIGIN,
  gasprice: NullaryOperator.TX_GASPRICE,
  chainid: NullaryOperator.CHAIN_ID,
  number: NullaryOperator.BLOCK_NUMBER,
  timestamp: NullaryOperator.BLOCK_TIMESTAMP,
  difficulty: NullaryOperator.BLOCK_DIFFICULTY,
  prevrandao: NullaryOperator.BLOCK_PREVRANDAO,
  basefee: NullaryOperator.BLOCK_BASEFEE,
  blobbasefee: NullaryOperator.BLOCK_BLOBBASEFEE,
  gaslimit: NullaryOperator.BLOCK_GASLIMIT,
  coinbase: NullaryOperator.BLOCK_COINBASE,
};
// Address-typed context builtins - in Yul these are plain 256-bit words, so wrap the solidc `address` result in
// a uint256 cast to keep it usable in the word-typed assembly context.
const ADDRESS_CONTEXT = new Set(['caller', 'origin', 'coinbase']);

// address(this): the executing contract's own address = the active input's locking bytecode as an AddressType.
function thisAddress(src: { location?: Node['location'] }): ExpressionNode {
  const lbc = loc(new UnaryOpNode(UnaryOperator.INPUT_LOCKING_BYTECODE,
    loc(new NullaryOpNode(NullaryOperator.INPUT_INDEX), src)), src);
  return loc(new CastNode(new AddressType(false), lbc, false), src);
}

// Coerce a Yul operand to an AddressType for balance/extcodesize/extcodehash: an address-typed operand (a param /
// address()) passes through; a word (literal `extcodesize(0)`, arithmetic) reinterprets its bytes as an address.
function asAddress(e: YulExpressionNode, src: YulNode): ExpressionNode {
  const v = lowerValue(e);
  const t = e instanceof YulPathNode && e.members.length === 0 ? currentVars.get(e.base) : undefined;
  return t instanceof AddressType ? v : loc(new CastNode(new AddressType(false), v, false), src);
}

function loc<T extends { location?: Node['location'] }>(node: T, src: { location?: Node['location'] }): T {
  node.location = src.location;
  return node;
}

function intLit(value: bigint, src: { location?: Node['location'] }): IntLiteralNode {
  return loc(new IntLiteralNode(value), src);
}

function isIntLiteral(e: YulExpressionNode): e is YulLiteralNode {
  return e instanceof YulLiteralNode && (e.kind === YulLiteralKind.NUMBER || e.kind === YulLiteralKind.HEX);
}

// keccak256/sha256 lower to a bytes32 value, but a Yul value is a 256-bit word; a let/assignment binding of one to
// a uint256 var needs a uint256 cast (mstore etc. keep the bytes32 - they encode differently).
function isBytes32Call(e: YulExpressionNode): boolean {
  return e instanceof YulFunctionCallNode && (e.name === 'keccak256' || e.name === 'sha256');
}

function isByteCall(e: YulExpressionNode): boolean {
  return e instanceof YulFunctionCallNode && e.name === 'byte';
}

// A high-level bytes32 local/parameter is also a Yul word when referenced from assembly. Arithmetic must use its
// uint256 interpretation, just like the direct keccak256/sha256 result above.
function isBytes32Word(e: YulExpressionNode): boolean {
  if (isBytes32Call(e)) return true;
  if (!(e instanceof YulPathNode) || e.members.length !== 0) return false;
  const t = currentVars.get(e.base);
  return t instanceof BytesType && t.bound === 32;
}

// Resolve a Yul `create` offset operand to a compile-time bytecode blob: `add(<hexLocal>, 0x20)` (EVM skips the
// bytes length word) or a bare `<hexLocal>` -> the local's hex-literal bytes. undefined if not a constant local.
function resolveConstantBytecode(offset: YulExpressionNode): Uint8Array | undefined {
  let base: string | undefined;
  if (offset instanceof YulFunctionCallNode && offset.name === 'add' && offset.args.length === 2
    && offset.args[0] instanceof YulPathNode && isIntLiteral(offset.args[1]) && BigInt(offset.args[1].raw) === 0x20n) {
    base = offset.args[0].base;
  } else if (offset instanceof YulPathNode) {
    base = offset.base;
  }
  return base ? currentVarValues.get(base) : undefined;
}

// `mload(0x40)` reads Solidity's free-memory pointer - the start of a fresh scratch buffer.
function isFreeMemPtr(v: YulExpressionNode | undefined): boolean {
  return v instanceof YulFunctionCallNode && v.name === 'mload' && v.args.length === 1
    && isIntLiteral(v.args[0]) && BigInt(v.args[0].raw) === 0x40n;
}

// Resolve a Yul memory pointer to a (buffer var, byte offset): a bare buffer var (offset 0) or `add(buf, const)`.
function resolveBufferPtr(ptr: YulExpressionNode): { buffer: string; off: bigint } | undefined {
  if (ptr instanceof YulPathNode && ptr.members.length === 0 && bufferWrites.has(ptr.base)) {
    return { buffer: ptr.base, off: 0n };
  }
  if (ptr instanceof YulFunctionCallNode && ptr.name === 'add' && ptr.args.length === 2
    && ptr.args[0] instanceof YulPathNode && bufferWrites.has(ptr.args[0].base) && isIntLiteral(ptr.args[1])) {
    return { buffer: ptr.args[0].base, off: BigInt(ptr.args[1].raw) };
  }
  return undefined;
}

// Recognize a `create` (offset, size) pair addressing the FULL content of a bytes-memory local `c` (the
// `create(v, add(c, 0x20), mload(c))` idiom, typically `c = type(D).creationCode`): offset = `add(c, 0x20)`
// skips the EVM length word, size = `mload(c)` is c's full length, same c, c a bytes local. Returns the local name.
// create2 is intentionally excluded: its EVM address folds in a salt, but a BCH p2sh32 is content-only.
function resolveWholeBytesLocal(offset: YulExpressionNode, size: YulExpressionNode): string | undefined {
  if (!(offset instanceof YulFunctionCallNode && offset.name === 'add' && offset.args.length === 2
    && offset.args[0] instanceof YulPathNode && offset.args[0].members.length === 0
    && isIntLiteral(offset.args[1]) && BigInt(offset.args[1].raw) === 0x20n)) return undefined;
  const base = offset.args[0].base;
  if (!(size instanceof YulFunctionCallNode && size.name === 'mload' && size.args.length === 1
    && size.args[0] instanceof YulPathNode && size.args[0].members.length === 0 && size.args[0].base === base)) {
    return undefined;
  }
  return currentVars.get(base) instanceof BytesType ? base : undefined;
}

// `X := add(X, N)` where X is a bytes var and N an int literal: EVM advances the memory pointer past the first N
// bytes; for a bytes value this is the slice `X[N:]`. The OZ/BoringCrypto `_getRevertMsg` idiom uses
// `add(_returnData, 0x04)` to drop the 4-byte Error(string) selector so `abi.decode(X, (string))` reads the
// message. Bounded to a same-var self-advance by a literal on a bytes local - a value slice, distinct from the
// __yulmem pointer bridge (deferred). Returns N, or undefined if the shape does not match.
function tryBytesPtrAdvance(value: YulExpressionNode, name: string): bigint | undefined {
  if (!(value instanceof YulFunctionCallNode && value.name === 'add' && value.args.length === 2)) return undefined;
  const [a, b] = value.args;
  if (!(a instanceof YulPathNode && a.members.length === 0 && a.base === name)) return undefined;
  if (!isIntLiteral(b)) return undefined;
  if (!(currentVars.get(name) instanceof BytesType)) return undefined;
  return BigInt(b.raw);
}

// The top `width` (<=32) bytes of an mstore'd 32-byte word: a constant renders big-endian and slices; a runtime
// bytesN local is left-aligned so its top N bytes ARE the value (only the exact width===N case is lowered).
function sliceWord(value: YulExpressionNode, width: number, src: { location?: Node['location'] }): ExpressionNode {
  if (isIntLiteral(value)) {
    let w = BigInt(value.raw);
    const full = new Uint8Array(32);
    for (let i = 31; i >= 0; i -= 1) { full[i] = Number(w & 0xffn); w >>= 8n; }
    return loc(new HexLiteralNode(full.slice(0, width)), src);
  }
  if (value instanceof YulPathNode && value.members.length === 0) {
    const vt = currentVars.get(value.base);
    if (vt instanceof BytesType && vt.bound === width) return loc(new IdentifierNode(value.base), src);
  }
  throw new YulNotLowerable();
}

// Reconstruct a byte buffer [0, size) from its ordered mstore writes: strictly-increasing contiguous offsets
// from 0, each write contributing bytes [off, nextOff) of its word. Returns the concatenated bytes expression.
function reconstructBuffer(buffer: string, size: bigint, src: { location?: Node['location'] }): ExpressionNode {
  const writes = [...(bufferWrites.get(buffer) ?? [])].sort((a, b) => Number(a.off - b.off));
  if (writes.length === 0 || writes[0].off !== 0n) throw new YulNotLowerable();
  const parts: ExpressionNode[] = [];
  for (let i = 0; i < writes.length; i += 1) {
    const start = writes[i].off;
    const next = i + 1 < writes.length ? writes[i + 1].off : size;
    if (next <= start || next - start > 32n) throw new YulNotLowerable(); // gap / overlap-past-word / non-contiguous
    parts.push(sliceWord(writes[i].value, Number(next - start), src));
  }
  return loc(new BytesConcatNode(parts), src);
}

// Cast a boolean expression to a uint256 0/1 word (so Yul comparisons stay usable in any position).
function boolToWord(boolExpr: ExpressionNode, src: { location?: Node['location'] }): ExpressionNode {
  return loc(new CastNode(UINT256, boolExpr, false), src);
}

// Integer bitwise/not require a bounded int; a literal or all-literal-arithmetic operand types as unbounded
// `int`, so cast every bitwise operand to uint256 (a no-op for an already-uint256 value).
function lowerBitwiseOperand(arg: YulExpressionNode): ExpressionNode {
  return loc(new CastNode(UINT256, lowerValue(arg), false), arg);
}

// Lower a Yul expression in value position to a 256-bit-word (uint256) expression.
function lowerValue(expr: YulExpressionNode): ExpressionNode {
  if (expr instanceof YulLiteralNode) return lowerLiteral(expr);
  if (expr instanceof YulPathNode) {
    // `x.slot` of a state var is its (constant) storage-slot number in the computed layout - consistent with the
    // sload/sstore slot resolution + the __evm_storage register. `.offset`/`.length` (calldata slices) stay deferred.
    if (expr.members.length === 1 && expr.members[0] === 'slot') {
      const varName = resolveStorageVarName(expr.base);
      const slot = varName !== undefined ? currentVarSlot.get(varName) : undefined;
      if (slot !== undefined) return intLit(slot, expr);
      throw new YulNotLowerable();
    }
    // `x.offset` of a state var: the byte offset within its 32-byte slot (0 for a full-slot var; the packed
    // sub-word offset otherwise). For a dynamic CALLDATA param it is the ABI byte position of the param's DATA.
    // A MUTABLE calldata component (`x.offset := v` present in the fn) reads the function-scoped local instead.
    if (expr.members.length === 1 && expr.members[0] === 'offset') {
      if (mutableCalldataComponents.has(`${expr.base}.offset`)) {
        return loc(new IdentifierNode(cdComponentLocal(expr.base, 'offset')), expr);
      }
      const varName = resolveStorageVarName(expr.base);
      const slot = varName !== undefined ? currentVarSlot.get(varName) : undefined;
      if (slot !== undefined) {
        const field = currentSlots.get(slot)?.find((f) => f.sv.name === varName);
        return intLit(field ? field.bitOffset / 8n : 0n, expr);
      }
      const off = calldataDataOffset(expr.base);
      if (off !== undefined) return intLit(off, expr);
      throw new YulNotLowerable();
    }
    // `x.length` of a bytes/array calldata param: the byte/element length of the param value (or the mutable local).
    if (expr.members.length === 1 && expr.members[0] === 'length') {
      if (mutableCalldataComponents.has(`${expr.base}.length`)) {
        return loc(new IdentifierNode(cdComponentLocal(expr.base, 'length')), expr);
      }
      const p = currentParams.find((pp) => pp.name === expr.base);
      if (p && (p.type instanceof BytesType || p.type === PrimitiveType.STRING || p.type instanceof ArrayType)) {
        return loc(new UnaryOpNode(UnaryOperator.SIZE, loc(new IdentifierNode(expr.base), expr)), expr);
      }
      throw new YulNotLowerable();
    }
    if (expr.members.length > 0) throw new YulNotLowerable(); // other member access (later phase)
    const id = loc(new IdentifierNode(expr.base), expr);
    // A UDVT-typed operand is a raw word inside assembly; unwrap it to its underlying type so arithmetic /
    // bitwise ops type-check (e.g. shl(0x40, _duration) where _duration is a `Duration` = uint64).
    const t = currentVars.get(expr.base);
    if (t instanceof ValueType) {
      return loc(new CastNode(t.underlyingType, id, false), expr);
    }
    return id;
  }
  if (expr instanceof YulFunctionCallNode) return lowerCall(expr);
  throw new YulNotLowerable();
}

// A Yul string / hex-string literal is its bytes LEFT-aligned in a 32-byte word (high bytes first).
function leftAlignedWord(bytes: number[]): bigint {
  if (bytes.length > 32) throw new YulNotLowerable(); // over one word
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v << BigInt((32 - bytes.length) * 8);
}

const WORD_MASK = (1n << 256n) - 1n;

// Fold a fully-constant Yul word expression to its bigint value (literals + or/and/xor/add/sub/mul/shl/shr over
// constants). undefined if any operand is non-constant. Used to decode a compile-time EVM byte-array slot word.
function yulConstFold(expr: YulExpressionNode): bigint | undefined {
  if (expr instanceof YulLiteralNode) {
    if (expr.kind === YulLiteralKind.NUMBER || expr.kind === YulLiteralKind.HEX) return BigInt(expr.raw) & WORD_MASK;
    if (expr.kind === YulLiteralKind.BOOL) return expr.raw === 'true' ? 1n : 0n;
    if (expr.kind === YulLiteralKind.STRING) {
      const inner = expr.raw.slice(1, -1);
      if (inner.includes('\\')) return undefined;
      const bytes = [...inner].map((c) => c.charCodeAt(0));
      if (bytes.some((b) => b > 0xff) || bytes.length > 32) return undefined;
      return leftAlignedWord(bytes);
    }
    if (expr.kind === YulLiteralKind.HEXSTRING) {
      const hex = expr.raw.replace(/^hex/, '').slice(1, -1).replace(/_/g, '');
      const bytes: number[] = [];
      for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
      return bytes.length > 32 ? undefined : leftAlignedWord(bytes);
    }
    return undefined;
  }
  if (expr instanceof YulFunctionCallNode && expr.args.length === 2) {
    const a = yulConstFold(expr.args[0]);
    const b = yulConstFold(expr.args[1]);
    if (a === undefined || b === undefined) return undefined;
    switch (expr.name) {
      case 'or': return a | b;
      case 'and': return a & b;
      case 'xor': return a ^ b;
      case 'add': return (a + b) & WORD_MASK;
      case 'sub': return (a - b) & WORD_MASK;
      case 'mul': return (a * b) & WORD_MASK;
      case 'shl': return (b << a) & WORD_MASK; // shl(shift, value)
      case 'shr': return b >> a;
      default: return undefined;
    }
  }
  return undefined;
}

// The declared dynamic bytes/string state var whose slot a Yul slot arg denotes (`b.slot` or a literal slot).
function bytesSlotVarName(slotArg: YulExpressionNode): string | undefined {
  let slotNum: bigint | undefined;
  if (isIntLiteral(slotArg)) slotNum = BigInt(slotArg.raw);
  else if (slotArg instanceof YulPathNode && slotArg.members.length === 1 && slotArg.members[0] === 'slot') {
    slotNum = currentVarSlot.get(slotArg.base);
  }
  if (slotNum === undefined) return undefined;
  const fields = currentSlots.get(slotNum);
  if (fields && fields.length === 1
    && ((fields[0].sv.type instanceof BytesType && fields[0].sv.type.bound === undefined)
      || fields[0].sv.type === PrimitiveType.STRING)) {
    return fields[0].sv.name;
  }
  return undefined;
}

// `sstore(bytesVar.slot, X)` with a COMPILE-TIME-CONSTANT X sets the bytes/string value from EVM's slot encoding:
// SHORT (X's low byte even, = 2*len, len<32) stores the data in the HIGH bytes (big-endian) -> `bytesVar = <the
// top len bytes>`; X==0 clears it. A LONG (odd low byte, data at keccak(slot)) or a RUNTIME X is NOT handled here
// (needs the keccak-data-region model) - fail closed. Returns the high-level statement, or undefined to fall through.
function bytesSlotConstWrite(varName: string, valArg: YulExpressionNode, src: YulNode): StatementNode | undefined {
  const val = yulConstFold(valArg);
  if (val === undefined) return undefined;
  if (val === 0n) return loc(new StateAssignNode(varName, loc(new HexLiteralNode(new Uint8Array(0)), src)), src);
  const lowByte = val & 0xffn;
  if (lowByte % 2n !== 0n || lowByte / 2n >= 32n) return undefined; // long / invalid: fail closed
  const len = Number(lowByte / 2n);
  const full = new Uint8Array(32);
  let w = val;
  for (let i = 31; i >= 0; i -= 1) { full[i] = Number(w & 0xffn); w >>= 8n; } // big-endian render (EVM slot order)
  return loc(new StateAssignNode(varName, loc(new HexLiteralNode(full.slice(0, len)), src)), src);
}

// `sload(bytesVar.slot)` = the EVM byte-array slot ENCODING of the current value: a SHORT value (len < 32) is the
// data left-aligned in the high bytes (big-endian) with `2*len` in the low byte; a LONG value stores `2*len+1`.
// Built with the VM-proven formula `len < 32 ? uint256(bytes32((b ++ zeros(31-len) ++ bytes1(2*len)).reverse()))
// : 2*len+1` (uint256(bytesN) is little-endian, so the big-endian data blob is reversed before the cast).
function bytesSlotLoad(varName: string, src: YulExpressionNode): ExpressionNode {
  const size = (): ExpressionNode => loc(new UnaryOpNode(UnaryOperator.SIZE, loc(new IdentifierNode(varName), src)), src);
  const twoLen = (): ExpressionNode => loc(new BinaryOpNode(size(), BinaryOperator.MUL, intLit(2n, src)), src);
  const lenByte = loc(new CastNode(new BytesType(1),
    loc(new CastNode(new IntType(false, 8), twoLen(), false), src), false), src);
  const pad = newBytes(loc(new BinaryOpNode(intLit(31n, src), BinaryOperator.MINUS, size()), src), src);
  const blob = loc(new BytesConcatNode([loc(new IdentifierNode(varName), src), pad, lenByte]), src);
  const short = loc(new CastNode(UINT256,
    loc(new CastNode(BYTES32, loc(new UnaryOpNode(UnaryOperator.REVERSE, blob), src), false), src), false), src);
  const long = loc(new BinaryOpNode(twoLen(), BinaryOperator.PLUS, intLit(1n, src)), src);
  const cond = loc(new BinaryOpNode(size(), BinaryOperator.LT, intLit(32n, src)), src);
  return loc(new TernaryOpNode(cond, short, long), src);
}

function lowerLiteral(lit: YulLiteralNode): ExpressionNode {
  switch (lit.kind) {
    case YulLiteralKind.NUMBER:
    case YulLiteralKind.HEX:
      return intLit(BigInt(lit.raw), lit);
    case YulLiteralKind.BOOL:
      return intLit(lit.raw === 'true' ? 1n : 0n, lit);
    case YulLiteralKind.STRING: {
      const inner = lit.raw.slice(1, -1); // strip the surrounding quotes
      if (inner.includes('\\')) throw new YulNotLowerable(); // escape sequences (later)
      const bytes = [...inner].map((c) => c.charCodeAt(0));
      if (bytes.some((b) => b > 0xff)) throw new YulNotLowerable(); // non-latin1 (needs UTF-8 encoding)
      return intLit(leftAlignedWord(bytes), lit);
    }
    case YulLiteralKind.HEXSTRING: {
      const hex = lit.raw.replace(/^hex/, '').slice(1, -1).replace(/_/g, ''); // strip `hex"` .. `"` and separators
      const bytes: number[] = [];
      for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
      return intLit(leftAlignedWord(bytes), lit);
    }
    default:
      throw new YulNotLowerable();
  }
}

// A Yul memory address that names a high-level struct FIELD: bare `s` (field 0) or `add(s, K)` (K a constant
// multiple of 32) where `s` is an outer memory struct with a VALUE field at index K/32. EVM lays a memory struct
// out as one 32-byte slot per field, so `mstore(add(s, 32*i), v)` == `s.field_i = v` and `mload(add(s, 32*i))`
// == `s.field_i`. Value fields only (a reference field would hold a pointer, not the value); a ref field or a
// dynamic/misaligned offset returns undefined, so the caller falls through to the buffer path unchanged
// (non-regressing). This bridges Yul assembly that treats a high-level struct as a memory pointer.
function resolveStructField(off: YulExpressionNode):
{ varName: string; struct: StructType; index: number } | undefined {
  let varName: string;
  let k = 0n;
  if (off instanceof YulPathNode && off.members.length === 0) {
    varName = off.base;
  } else if (off instanceof YulFunctionCallNode && off.name === 'add' && off.args.length === 2
    && off.args[0] instanceof YulPathNode && off.args[0].members.length === 0 && isIntLiteral(off.args[1])) {
    varName = off.args[0].base;
    k = BigInt(off.args[1].raw);
  } else {
    return undefined;
  }
  const t = currentVars.get(varName);
  if (!(t instanceof StructType) || k % 32n !== 0n) return undefined;
  const index = Number(k / 32n);
  if (index < 0 || index >= t.fields.length) return undefined;
  const fieldType = t.fields[index].type;
  if (fieldType instanceof ArrayType || fieldType instanceof StructType || fieldType instanceof MappingType) {
    return undefined; // a reference field holds a pointer, not an in-slot value
  }
  return { varName, struct: t, index };
}

// `mstore(add(s, 32*i), word)` == `s.field_i = word`: rebuild the value-copy struct with field i replaced by the
// stored word (cast to the field type), the other fields read back from `s` - the value-copy field-write form the
// AstBuilder desugar produces for `s.f = v`.
function structFieldStore(
  sf: { varName: string; struct: StructType; index: number }, word: ExpressionNode, src: YulNode,
): StatementNode {
  const args: ExpressionNode[] = sf.struct.fields.map((f, i) => {
    if (i === sf.index) return loc(new CastNode(f.type, word, false), src);
    const base = loc(new IdentifierNode(sf.varName), src);
    return loc(new FieldAccessNode(base, f.name), src);
  });
  const ctor = loc(new FunctionCallNode(loc(new IdentifierNode(sf.struct.name), src), args), src);
  return loc(new AssignNode(loc(new IdentifierNode(sf.varName), src), ctor), src);
}

function lowerCall(call: YulFunctionCallNode): ExpressionNode {
  const { name, args } = call;
  if (name in NULLARY_CONTEXT && args.length === 0) {
    const nullary = loc(new NullaryOpNode(NULLARY_CONTEXT[name]), call);
    return ADDRESS_CONTEXT.has(name) ? loc(new CastNode(UINT256, nullary, false), call) : nullary;
  }
  // returndatasize() -> the length of the last low-level call's return-event data (0 if no call preceded it).
  if (name === 'returndatasize' && args.length === 0) {
    return lastReturnData
      ? loc(new UnaryOpNode(UnaryOperator.SIZE, loc(new IdentifierNode(lastReturnData), call)), call)
      : intLit(0n, call);
  }
  // addmod(a,b,n) / mulmod(a,b,n) -> the matching solidc builtin ((a op b) mod n, full-width).
  if ((name === 'addmod' || name === 'mulmod') && args.length === 3) {
    return loc(new FunctionCallNode(loc(new IdentifierNode(name), call), args.map((a) => lowerValue(a))), call);
  }
  // signextend(i, v): sign-extend v from the low (i+1) bytes. For a constant i the branchless identity
  // `((v & mask) ^ signBit) - signBit` computes it in wrapping uint256 arithmetic (sub wraps, as EVM).
  if (name === 'signextend' && args.length === 2 && isIntLiteral(args[0])) {
    const raw = lowerValue(args[1]);
    const i = BigInt(args[0].raw);
    if (i >= 31n) return raw; // already full-width - no-op
    const v = loc(new CastNode(UINT256, raw, false), call);
    const bits = (i + 1n) * 8n;
    const u256 = (n: bigint): ExpressionNode => loc(new CastNode(UINT256, intLit(n, call), false), call);
    const masked = loc(new BinaryOpNode(v, BinaryOperator.BIT_AND, u256((1n << bits) - 1n)), call);
    const xored = loc(new BinaryOpNode(masked, BinaryOperator.BIT_XOR, u256(1n << (bits - 1n))), call);
    return loc(new BinaryOpNode(xored, BinaryOperator.MINUS, intLit(1n << (bits - 1n), call)), call);
  }
  // blockhash(n) -> solidc blockhash builtin (a bytes32; SynthesizeBlockOracle, which runs after this pass, wires
  // the n->hash oracle). Cast to a uint256 word for the assembly context.
  if (name === 'blockhash' && args.length === 1) {
    const bh = loc(new FunctionCallNode(loc(new IdentifierNode('blockhash'), call), [lowerValue(args[0])]), call);
    return loc(new CastNode(UINT256, bh, false), call);
  }
  // blobhash(i) -> 0: BCH has no blobs (EIP-4844), so - like Solidity's blobhash() builtin - it is always the
  // zero hash regardless of the index (i >= numBlobs is always true here).
  if (name === 'blobhash' && args.length === 1) {
    const zero = new IntLiteralNode(0n);
    zero.type = UINT256;
    return loc(zero, call);
  }
  // gas() -> gasleft() (a shim on BCH - there is no gas metering; see SynthesizeBlockOracle).
  if (name === 'gas' && args.length === 0) {
    return loc(new FunctionCallNode(loc(new IdentifierNode('gasleft'), call), []), call);
  }
  // codesize() -> this.activeBytecode.length (the executing contract's own script size).
  if (name === 'codesize' && args.length === 0) {
    return loc(new UnaryOpNode(UnaryOperator.SIZE, loc(new NullaryOpNode(NullaryOperator.BYTECODE), call)), call);
  }
  // extcodesize(addr) -> addr.code.length: the byte length of the script at that address (the high-level `.code`
  // member extracts it). Backs OZ Address.isContract's `addr.code.length > 0`.
  if (name === 'extcodesize' && args.length === 1) {
    const code = loc(new FieldAccessNode(asAddress(args[0], call), 'code'), call);
    return loc(new CastNode(UINT256, loc(new UnaryOpNode(UnaryOperator.SIZE, code), call), false), call);
  }
  // selfbalance() -> address(this).balance: the satoshis this contract controls, summed over the inputs locked to
  // its own bytecode (`this` = tx.inputs[activeInputIndex].lockingBytecode). Cast to a uint256 word.
  if (name === 'selfbalance' && args.length === 0) {
    return loc(new CastNode(UINT256, loc(new FieldAccessNode(thisAddress(call), 'balance'), call), false), call);
  }
  // address() -> uint256(address(this)): the executing contract's own address (its input locking bytecode).
  if (name === 'address' && args.length === 0) {
    return loc(new CastNode(UINT256, thisAddress(call), false), call);
  }
  // balance(addr) -> uint256(addr.balance): satoshis at that address, summed over matching inputs (mirrors
  // selfbalance/.balance). addr must be an address-typed operand (a param or address()); a bare 256-bit word is
  // the documented address-representation divergence, same as the other address-context builtins.
  if (name === 'balance' && args.length === 1) {
    return loc(new CastNode(UINT256, loc(new FieldAccessNode(asAddress(args[0], call), 'balance'), call), false), call);
  }
  // extcodehash(addr) -> uint256(addr.codehash): the P2SH script hash embedded in the address (BCH's contract
  // identity), the analogue of EVM's account code hash. Cast to a uint256 word for the assembly context.
  if (name === 'extcodehash' && args.length === 1) {
    return loc(new CastNode(UINT256, loc(new FieldAccessNode(asAddress(args[0], call), 'codehash'), call), false), call);
  }
  // clz(x) (EVM CLZ / EIP-7939): count leading zero bits in the 256-bit word. Constant-folded for a literal
  // operand (the only form the corpus uses); a runtime operand stays unlowerable and is named by the diagnostic.
  if (name === 'clz' && args.length === 1 && isIntLiteral(args[0])) {
    const x = BigInt(args[0].raw);
    return intLit(x === 0n ? 256n : 256n - BigInt(x.toString(2).length), call);
  }
  if (name in ARITH_OPS && args.length === 2) {
    // A bytes32-producing operand (keccak256/sha256) must be cast to uint256 for arithmetic (Yul words are 256-bit),
    // e.g. `add(keccak256(0,23), 1)` as a computed __evm_storage slot key.
    const operand = (a: YulExpressionNode): ExpressionNode => (isBytes32Word(a)
      ? loc(new CastNode(UINT256, lowerValue(a), false), call)
      : lowerValue(a));
    return loc(new BinaryOpNode(operand(args[0]), ARITH_OPS[name], operand(args[1])), call);
  }
  if (name in BITWISE_OPS && args.length === 2) {
    return loc(new BinaryOpNode(lowerBitwiseOperand(args[0]), BITWISE_OPS[name], lowerBitwiseOperand(args[1])), call);
  }
  // shl(shift, value)=value*2^shift, shr/sar(shift, value)=value/2^shift. Avoids the `<<`/`>>` operators,
  // which require bigint/bytes; staying on uint256 keeps bitwise on the same value valid.
  if ((name === 'shl' || name === 'shr' || name === 'sar') && args.length === 2) {
    // The shifted value is a 256-bit word (`value*2^shift` must not overflow a narrow operand's type, e.g.
    // shl(0x40, uint64) would truncate to 0); widen it to uint256 to match EVM word arithmetic.
    const value = loc(new CastNode(UINT256, lowerValue(args[1]), false), call);
    // shl is 256-bit TRUNCATING: bits shifted past 255 are dropped (EVM mod-2^256). With a literal shift this
    // is `(value mod 2^(256-s)) * 2^s` - masking the surviving bits first keeps the multiply within uint256 (a
    // plain value*2^s overflows the checked multiply, e.g. the shl-then-shr low-word mask in optimism LibClock).
    if (name === 'shl' && isIntLiteral(args[0])) {
      const s = BigInt(args[0].raw);
      if (s >= 256n) return intLit(0n, call);
      if (s === 0n) return value;
      const masked = loc(new BinaryOpNode(value, BinaryOperator.MOD, intLit(2n ** (256n - s), call)), call);
      return loc(new BinaryOpNode(masked, BinaryOperator.MUL, intLit(2n ** s, call)), call);
    }
    const pow2 = isIntLiteral(args[0])
      ? intLit(2n ** BigInt(args[0].raw), call)
      : loc(new BinaryOpNode(intLit(2n, call), BinaryOperator.POW, lowerValue(args[0])), call);
    return loc(new BinaryOpNode(value, name === 'shl' ? BinaryOperator.MUL : BinaryOperator.DIV, pow2), call);
  }
  if (name in CMP_OPS && args.length === 2) {
    return boolToWord(loc(new BinaryOpNode(lowerValue(args[0]), CMP_OPS[name], lowerValue(args[1])), call), call);
  }
  if (name === 'not' && args.length === 1) {
    return loc(new UnaryOpNode(UnaryOperator.INVERT, lowerBitwiseOperand(args[0])), call);
  }
  if (name === 'iszero' && args.length === 1) {
    return boolToWord(loc(new BinaryOpNode(lowerValue(args[0]), BinaryOperator.EQ, intLit(0n, call)), call), call);
  }
  // create(value, offset, size): deploy the bytecode at [offset, offset+size). Only a COMPILE-TIME-CONSTANT
  // bytecode is derivable on BCH: treat the blob as the contract's redeem script and return its p2sh32 address
  // (`0xaa20 || hash256(blob) || 0x87`), computed here. Value must be 0 (a funded deploy needs an output, not
  // lowered here); runtime-constructed bytecode stays unlowerable and hits the inline-assembly diagnostic.
  if (name === 'create' && args.length === 3) {
    const blob = resolveConstantBytecode(args[1]);
    if (blob && isIntLiteral(args[0]) && BigInt(args[0].raw) === 0n) {
      const p2sh32 = Uint8Array.from([0xaa, 0x20, ...hash256(blob), 0x87]);
      const lit = new HexLiteralNode(p2sh32);
      lit.type = new AddressType();
      return loc(lit, call);
    }
    // Runtime free-memory buffer (EIP-1167 clone: const||address||const built via mstore) -> derive the p2sh32
    // address on-stack: `0xaa20 || hash256(buffer) || 0x87`. Value must be 0 (a funded deploy needs an output).
    const bufPtr = resolveBufferPtr(args[1]);
    if (bufPtr && bufPtr.off === 0n && isIntLiteral(args[0]) && BigInt(args[0].raw) === 0n && isIntLiteral(args[2])) {
      const buffer = reconstructBuffer(bufPtr.buffer, BigInt(args[2].raw), call);
      const hashed = loc(new FunctionCallNode(loc(new IdentifierNode('hash256'), call), [buffer]), call);
      const p2sh = loc(new BytesConcatNode([
        loc(new HexLiteralNode(Uint8Array.from([0xaa, 0x20])), call), hashed,
        loc(new HexLiteralNode(Uint8Array.from([0x87])), call),
      ]), call);
      return loc(new CastNode(new AddressType(), p2sh, false), call);
    }
    // `create(0, add(c, 0x20), mload(c))` deploying the full content of a bytes local `c` (e.g. a typed
    // `type(D).creationCode`): on BCH a contract's address IS p2sh32(script), so derive it from c's runtime value
    // `0xaa20 || hash256(c) || 0x87`. Value must be 0 (a funded deploy needs an output). See docs create note.
    const codeLocal = resolveWholeBytesLocal(args[1], args[2]);
    if (codeLocal && isIntLiteral(args[0]) && BigInt(args[0].raw) === 0n) {
      const hashed = loc(new FunctionCallNode(
        loc(new IdentifierNode('hash256'), call), [loc(new IdentifierNode(codeLocal), call)],
      ), call);
      const p2sh = loc(new BytesConcatNode([
        loc(new HexLiteralNode(Uint8Array.from([0xaa, 0x20])), call), hashed,
        loc(new HexLiteralNode(Uint8Array.from([0x87])), call),
      ]), call);
      return loc(new CastNode(new AddressType(), p2sh, false), call);
    }
    throw new YulNotLowerable();
  }
  // create2(0, offset, size, salt): like `create` but the salt distinguishes clones. Bake `<salt> OP_DROP` into the
  // redeem (a 0x20 push of the 32-byte salt then OP_DROP 0x75, matching the deploy handler) and take its p2sh32, so
  // different salts yield different addresses. (A `type(C).creationCode` create2 becomes `new C{salt}()` at statement
  // level; a runtime EIP-1167 clone buffer / whole-bytes-local reaches here as an address computation - BentoBox
  // `deploy`. An EVM proxy has no functional BCH contract at that address, so a call on it fails closed.)
  if (name === 'create2' && args.length === 4 && isIntLiteral(args[0]) && BigInt(args[0].raw) === 0n) {
    const bufPtr = resolveBufferPtr(args[1]);
    const codeLocal = resolveWholeBytesLocal(args[1], args[2]);
    let content: ExpressionNode | undefined;
    if (bufPtr && bufPtr.off === 0n && isIntLiteral(args[2])) {
      content = reconstructBuffer(bufPtr.buffer, BigInt(args[2].raw), call);
    } else if (codeLocal) content = loc(new IdentifierNode(codeLocal), call);
    if (content) {
      const salt = loc(new CastNode(BYTES32, lowerValue(args[3]), false), call);
      const saltSeg = loc(new BytesConcatNode([
        loc(new HexLiteralNode(Uint8Array.from([0x20])), call), salt,
        loc(new HexLiteralNode(Uint8Array.from([0x75])), call),
      ]), call);
      const hashed = loc(new FunctionCallNode(loc(new IdentifierNode('hash256'), call),
        [loc(new BytesConcatNode([saltSeg, content]), call)]), call);
      const p2sh = loc(new BytesConcatNode([
        loc(new HexLiteralNode(Uint8Array.from([0xaa, 0x20])), call), hashed,
        loc(new HexLiteralNode(Uint8Array.from([0x87])), call),
      ]), call);
      return loc(new CastNode(new AddressType(), p2sh, false), call);
    }
    throw new YulNotLowerable();
  }
  // EVM calldata = selector(4) ++ abi-encoded args. calldataload(4+32k) is the k-th param's word;
  // calldatasize is 4 + 32*argCount. See docs/yul-inline-assembly.md "Calldata model".
  if (name === 'calldatasize' && args.length === 0) {
    return intLit(BigInt(4 + 32 * currentParams.length), call);
  }
  if (name === 'calldataload' && args.length === 1 && isIntLiteral(args[0])) {
    const p = BigInt(args[0].raw);
    if (p >= 4n && (p - 4n) % 32n === 0n) {
      const param = currentParams[Number((p - 4n) / 32n)];
      if (param && param.type instanceof IntType) return loc(new IdentifierNode(param.name), call);
    }
    // General constant offset (selector word at 0, unaligned): read the 32-byte word at p of the synthesized
    // calldata `msg.sig ++ bytes32(params)`, zero-padded past the end (EVM semantics). synthesizedCalldata throws
    // for a non-int param, so those stay unlowerable. msg.sig is entry-point-only.
    const padded = loc(new BytesConcatNode([synthesizedCalldata(call), newBytes(intLit(32n, call), call)]), call);
    const slice = loc(new SliceNode(padded, intLit(p, call), intLit(p + 32n, call)), call);
    return loc(new CastNode(UINT256, loc(new CastNode(BYTES32, slice, false), call), false), call);
  }
  // sload(slot) -> the word at that storage slot (a single var, or the combined packed sub-word vars), or the
  // synthesized __evm_storage[slot] register entry for an arbitrary (non-declared) slot.
  if (name === 'sload' && args.length === 1) {
    const mapAccess = resolveMappingSlot(args[0]);
    if (mapAccess) return loc(new MappingAccessNode(mapAccess.collection, mapAccess.keys), call);
    // sload(keccak256(0,32)+i) = arr[i], guarded: `i < arr.length ? uint256(arr[i]) : 0` (EVM reads an
    // out-of-range / deleted element as 0, not a bounds revert).
    const arrEl = resolveArrayElementSlot(args[0]);
    if (arrEl) {
      const len = loc(new UnaryOpNode(UnaryOperator.SIZE, loc(new IdentifierNode(arrEl.arrName), call)), call);
      const cond = loc(new BinaryOpNode(cloneNode(arrEl.index) as ExpressionNode, BinaryOperator.LT, len), call);
      const read = loc(new CastNode(UINT256, loc(new ArrayAccessNode(
        loc(new IdentifierNode(arrEl.arrName), call), cloneNode(arrEl.index) as ExpressionNode,
      ), call), false), call);
      return loc(new TernaryOpNode(cond, read, intLit(0n, call)), call);
    }
    const fields = resolveSlotFields(args[0]);
    if (fields) return combineSlot(fields, call);
    const arrName = resolveDynArrayName(args[0]);
    if (arrName) return loc(new UnaryOpNode(UnaryOperator.SIZE, loc(new IdentifierNode(arrName), call)), call);
    const bytesR = bytesSlotVarName(args[0]);
    if (bytesR) return bytesSlotLoad(bytesR, call);
    const comp = resolveCompositeSlotAccess(args[0]);
    if (comp) { const w = combineCompositeSlot(comp.sv, comp.rel, call); if (w) return w; }
    const key = evmStorageSlotKey(args[0]);
    if (key) { evmStorageUsed = true; return loc(new MappingAccessNode(EVM_STORAGE, [key]), call); }
    throw new YulNotLowerable();
  }
  // tload(key) -> read the transient local for that constant key.
  if (name === 'tload' && args.length === 1) {
    const local = transientLocalName(args[0]);
    if (local) {
      transientKeys.set(local, call);
      return loc(new IdentifierNode(local), call);
    }
    throw new YulNotLowerable();
  }
  // byte(n, x): the n-th byte (big-endian, 0 = most significant) of the 32-byte word x -> bytes1. Backs the
  // signature-split idiom `v := byte(0, mload(add(sig, 96)))`. Only a literal, in-range index is lowered.
  if (name === 'byte' && args.length === 2 && isIntLiteral(args[0])) {
    const n = BigInt(args[0].raw);
    if (n < 0n || n > 31n) throw new YulNotLowerable();
    // byte(n, mload(add(param, off))) needs only ONE byte (param[off-32+n]); fold to it so a full 32-byte word
    // read past the end of a short value (the v byte of a 65-byte sig reads word [64:96]) never happens.
    const inner = args[1];
    if (inner instanceof YulFunctionCallNode && inner.name === 'mload' && inner.args.length === 1) {
      const ptr = parseBytesPtr(inner.args[0]);
      if (ptr) {
        const at = ptr.start + n;
        return loc(new SliceNode(loc(new IdentifierNode(ptr.name), call), intLit(at, call), intLit(at + 1n, call)), call);
      }
    }
    const word = loc(new CastNode(BYTES32, lowerValue(args[1]), false), call);
    return loc(new SliceNode(word, intLit(n, call), intLit(n + 1n, call)), call);
  }
  // mload(p) -> the word stored at that constant offset (compile-time memory model), or a `bytes memory`
  // slice for the `mload(add(ptr, off))` parameter-reading form.
  if (name === 'mload' && args.length === 1) {
    // mload(<bytes memory var>): a bare bytes pointer reads the EVM header word = the value's byte length. (The
    // data-reading form is mload(add(ptr, off)), handled by bytesMemorySlice.) Backs OZ _revert's
    // `let size := mload(returndata)`.
    if (args[0] instanceof YulPathNode && args[0].members.length === 0) {
      const bp = currentParams.find((p) => p.name === (args[0] as YulPathNode).base && p.type instanceof BytesType);
      if (bp) {
        const len = loc(new UnaryOpNode(UnaryOperator.SIZE, loc(new IdentifierNode(bp.name), call)), call);
        return loc(new CastNode(UINT256, len, false), call);
      }
    }
    // `mload(add(s, 32*i))` on a high-level struct == `uint256(s.field_i)` (read the field's 32-byte slot).
    const sf = resolveStructField(args[0]);
    if (sf) {
      const base = loc(new IdentifierNode(sf.varName), call);
      const field = loc(new FieldAccessNode(base, sf.struct.fields[sf.index].name), call);
      return loc(new CastNode(UINT256, field, false), call);
    }
    if (runtimeMem) return runtimeMload(args[0], call);
    if (isIntLiteral(args[0])) {
      const v = memory.get(BigInt(args[0].raw));
      if (v !== undefined) return lowerValue(v);
    }
    const slice = bytesMemorySlice(args[0]);
    if (slice) return slice;
    throw new YulNotLowerable(); // uninitialized / dynamic offset
  }
  // keccak256(p, len) -> hash the memory region (runtime byte-slice, or the constant compile-time region).
  if (name === 'keccak256' && args.length === 2) {
    if (runtimeMem) return runtimeKeccak(args[0], args[1], call);
    return lowerKeccak(call);
  }
  // msize() -> the runtime buffer's high-water mark. Only meaningful in the runtime path; throwing here triggers
  // the whole-block runtime re-lowering.
  if (name === 'msize' && args.length === 0) {
    if (!runtimeMem) throw new YulNotLowerable();
    return runtimeMsize(call);
  }
  // erc7201(id) - the ERC-7201 / EIP-7201 namespaced storage-slot dialect builtin. Fold to the SPEC-CONFORMANT slot,
  // keccak256(abi.encode(uint256(keccak256(id)) - 1)) & ~bytes32(uint256(0xff)), as a uint256 (byte-identical to
  // Ethereum). The namespace id is always a string literal, so it folds at compile time.
  if (name === 'erc7201' && args.length === 1) {
    const arg = args[0];
    if (!(arg instanceof YulLiteralNode) || arg.kind !== YulLiteralKind.STRING || arg.raw.includes('\\')) {
      throw new YulNotLowerable(); // erc7201 requires a plain string-literal namespace id
    }
    const slot = loc(intLit(computeErc7201SlotNumber(arg.raw.slice(1, -1)), call), call);
    return loc(new CastNode(UINT256, slot, false), call); // erc7201 yields a storage-slot uint256, not bytes32
  }
  throw new YulNotLowerable();
}

// Lower a Yul expression in condition position (if / while) to a boolean expression.
function lowerCond(expr: YulExpressionNode): ExpressionNode {
  if (expr instanceof YulFunctionCallNode) {
    if (expr.name in CMP_OPS && expr.args.length === 2) {
      return loc(new BinaryOpNode(lowerValue(expr.args[0]), CMP_OPS[expr.name], lowerValue(expr.args[1])), expr);
    }
    if (expr.name === 'iszero' && expr.args.length === 1) {
      return loc(new BinaryOpNode(lowerValue(expr.args[0]), BinaryOperator.EQ, intLit(0n, expr)), expr);
    }
  }
  // Any other Yul value is true iff non-zero.
  return loc(new BinaryOpNode(lowerValue(expr), BinaryOperator.NE, intLit(0n, expr)), expr);
}

// `pair := create2(0, add(code, 0x20), mload(code), salt)` where `bytes code = type(C).creationCode`: deploy the
// SolidCash contract C. Lower to `new C{salt: salt}()` (an InstantiationNode) - runs pre-semantic, so the deploy
// modifier inference, self-pin covenant, salt bake and SDK deployFrom all engage downstream. The child's ctor args
// come from creationCode (none extra here); a same-tx `C(pair).initialize(..)` folds as a deploy-then-call. Value
// must be 0 (a funded deploy needs an output). Any un-recognised offset/size/type leaves it for the yul diagnostic.
function tryCreate2Instantiation(value: YulExpressionNode, src: YulNode): InstantiationNode | undefined {
  if (!(value instanceof YulFunctionCallNode) || value.name !== 'create2' || value.args.length !== 4) return undefined;
  if (!(isIntLiteral(value.args[0]) && BigInt(value.args[0].raw) === 0n)) return undefined;
  const codeLocal = resolveWholeBytesLocal(value.args[1], value.args[2]);
  if (!codeLocal) return undefined;
  const contractName = currentCreationCodeLocals.get(codeLocal);
  if (!contractName) return undefined;
  const inst = loc(new InstantiationNode(loc(new IdentifierNode(contractName), src), []), src);
  inst.callOptions = { salt: lowerValue(value.args[3]) };
  return inst;
}

function lowerStatement(stmt: YulStatementNode): StatementNode {
  if (stmt instanceof YulBlockNode) return lowerBlock(stmt);

  if (stmt instanceof YulVariableDeclarationNode) {
    // Empty `let x` / `let y, z` (no initializer): each Yul var defaults to 0.
    if (!stmt.value) {
      const defs = stmt.names.map((n) => loc(new VariableDefinitionNode(UINT256, [], n, intLit(0n, stmt)), stmt));
      return defs.length === 1 ? defs[0] : loc(new BlockNode(defs), stmt);
    }
    if (stmt.names.length !== 1) throw new YulNotLowerable(); // multi-value `let x, y := f()` (later)
    // `let pair := create2(0, add(code,0x20), mload(code), salt)` -> `address pair = new C{salt}()` (deploy). Emit
    // the InstantiationNode DIRECTLY (no CastNode wrap) so deploy-result-local registration + deploy-then-call fold
    // (SymbolTableTraversal, keyed on `expression instanceof InstantiationNode`) engage.
    const declCreate2 = tryCreate2Instantiation(stmt.value, stmt);
    if (declCreate2) {
      return loc(new VariableDefinitionNode(new AddressType(false), [], stmt.names[0], declCreate2), stmt);
    }
    // `let buf := mload(0x40)` allocates a fresh free-memory byte buffer; track its mstore writes, emit nothing.
    // In the runtime path there is no compile-time buffer - it lowers to a real `mload(0x40)` read (the free
    // pointer stored at slot 0x40), so `buf` holds the allocation base as a runtime value.
    if (!runtimeMem && isFreeMemPtr(stmt.value)) {
      bufferWrites.set(stmt.names[0], []);
      return loc(new BlockNode([]), stmt);
    }
    // `let ok := call/staticcall/delegatecall(...)` -> a low-level call binding (reuses the external-call covenant).
    if (isLowLevelCall(stmt.value)) return lowerLowLevelCall(stmt.value, stmt.names[0], true, stmt);
    // `let slot := keccak256(0,64)` mapping-slot idiom -> record m[k] for the var; drop the dead keccak binding.
    if (stmt.value) {
      const m = mappingSlotIdiom(stmt.value);
      if (m) {
        mappingSlotVars.set(stmt.names[0], m);
        currentVars.set(stmt.names[0], UINT256);
        return loc(new BlockNode([]), stmt);
      }
      // `let pos := add(keccak256(0,32), i)` array-element idiom -> record arr[i]; drop the dead keccak binding.
      const ae = resolveArrayElementSlot(stmt.value);
      if (ae) {
        arrayElemSlotVars.set(stmt.names[0], ae);
        currentVars.set(stmt.names[0], UINT256);
        return loc(new BlockNode([]), stmt);
      }
    }
    let expr = lowerValue(stmt.value);
    if (isBytes32Call(stmt.value)) expr = loc(new CastNode(UINT256, expr, false), stmt);
    return loc(new VariableDefinitionNode(UINT256, [], stmt.names[0], expr), stmt);
  }

  if (stmt instanceof YulAssignmentNode) {
    // `x.offset := v` / `x.length := v` on a mutable calldata component -> assign its function-scoped local.
    if (stmt.paths.length === 1 && stmt.paths[0].members.length === 1
      && mutableCalldataComponents.has(`${stmt.paths[0].base}.${stmt.paths[0].members[0]}`)) {
      const local = cdComponentLocal(stmt.paths[0].base, stmt.paths[0].members[0]);
      return loc(new AssignNode(loc(new IdentifierNode(local), stmt), lowerValue(stmt.value)), stmt);
    }
    if (stmt.paths.length !== 1 || stmt.paths[0].members.length > 0) throw new YulNotLowerable();
    const name = stmt.paths[0].base;
    // `pair := create2(0, add(code,0x20), mload(code), salt)` -> `pair = new C{salt}()` (deploy). Emit the
    // InstantiationNode DIRECTLY (bypass the target-type CastNode wrap below) so the deploy-result-local /
    // deploy-then-call fold machinery (keyed on `expression instanceof InstantiationNode`) engages.
    const asgCreate2 = tryCreate2Instantiation(stmt.value, stmt);
    if (asgCreate2) return loc(new AssignNode(loc(new IdentifierNode(name), stmt), asgCreate2), stmt);
    // `ok := call/staticcall/delegatecall(...)` -> a low-level call binding onto the existing var.
    if (isLowLevelCall(stmt.value)) return lowerLowLevelCall(stmt.value, name, false, stmt);
    // `slot := keccak256(0,64)` mapping-slot idiom (assignment form) -> record m[k]; drop the dead keccak binding.
    const mapSlot = mappingSlotIdiom(stmt.value);
    if (mapSlot) { mappingSlotVars.set(name, mapSlot); return loc(new BlockNode([]), stmt); }
    // `X := add(X, N)` on a bytes var -> `X = X[N:]` (value form of an EVM byte-pointer advance).
    const ptrAdv = tryBytesPtrAdvance(stmt.value, name);
    if (ptrAdv !== undefined) {
      const id = (): IdentifierNode => loc(new IdentifierNode(name), stmt);
      const len = loc(new UnaryOpNode(UnaryOperator.SIZE, id()), stmt);
      const sliced = loc(new SliceNode(id(), intLit(ptrAdv, stmt), len), stmt);
      return loc(new AssignNode(id(), sliced), stmt);
    }
    const target = loc(new IdentifierNode(name), stmt);
    let value = lowerValue(stmt.value);
    const t = currentVars.get(name);
    // An address-to-address Yul assignment copies the same locking-bytecode value. Preserve its address type
    // directly; normalizing through uint256 would make the subsequent payable-address cast invalid even though
    // no representation conversion is required (`address payable r; assembly { r := z }`).
    if (stmt.value instanceof YulPathNode && stmt.value.members.length === 0) {
      const vt = currentVars.get(stmt.value.base);
      if (vt instanceof AddressType && t instanceof AddressType && vt.payable === t.payable) {
        return loc(new AssignNode(target, value), stmt);
      }
    }
    // A plain non-word var read (address, bytesN, bool) yields a value of that type; normalize it to the uint256
    // word so the target-cast below reinterprets it uniformly (EVM `:=` copies the raw word). Complex values
    // (arith / calls) are already uint256, and mstore etc. keep the un-normalized read (they encode differently).
    if (stmt.value instanceof YulPathNode && stmt.value.members.length === 0) {
      const vt = currentVars.get(stmt.value.base);
      const vIsWord = vt instanceof IntType && !vt.signed && vt.bits === 256;
      if (vt && !vIsWord && !(vt instanceof ValueType)) value = loc(new CastNode(UINT256, value, false), stmt);
    }
    // The assembled value is a uint256 word; a target of a different type reinterprets it (EVM `:=` writes the
    // raw word). Cast to the target so the lowered assignment type-checks - except when the target IS uint256.
    const isWord = t instanceof IntType && !t.signed && t.bits === 256;
    if (t instanceof ValueType) {
      value = loc(new CastNode(t.underlyingType, value, false), stmt);
      value = loc(new CastNode(t, value, false), stmt);
    } else if (t && !isWord) {
      value = loc(new CastNode(t, value, false), stmt);
    } else if (isWord && (isBytes32Call(stmt.value) || isByteCall(stmt.value))) {
      // Hashes and byte() yield bytes-shaped main-AST values, but every Yul assignment copies a uint256 word.
      // Reinterpret them for a uint256 target (a differently typed target is handled above).
      value = loc(new CastNode(UINT256, value, false), stmt);
    }
    return loc(new AssignNode(target, value), stmt);
  }

  if (stmt instanceof YulIfNode) {
    return loc(new BranchNode(lowerCond(stmt.condition), lowerBlock(stmt.body)), stmt);
  }

  if (stmt instanceof YulSwitchNode) return lowerSwitch(stmt);
  if (stmt instanceof YulForLoopNode) return lowerForLoop(stmt);

  if (stmt instanceof YulExpressionStatementNode) {
    const e = stmt.expression;
    if (e instanceof YulFunctionCallNode) {
      // revert(ptr, size): abort. (ptr, size) point at a runtime-built memory blob - an ABI-encoded error or
      // forwarded callee returndata - so there is no compile-time reason string to carry into require()'s
      // debugger message; the abort is an unconditional require(false). (A revert with a literal reason keeps its
      // message on the high-level revert path.)
      if (e.name === 'revert' && e.args.length === 2) {
        return loc(new RequireNode(loc(new BoolLiteralNode(false), stmt)), stmt);
      }
      // invalid(): the INVALID opcode unconditionally aborts -> require(false).
      if (e.name === 'invalid' && e.args.length === 0) {
        return loc(new RequireNode(loc(new BoolLiteralNode(false), stmt)), stmt);
      }
      // stop(): halt execution successfully. A BCH function just ends; treat as a no-op (statements after a stop
      // are dead in EVM but harmless here - this is the opcode-availability-test shape).
      if (e.name === 'stop' && e.args.length === 0) return loc(new BlockNode([]), stmt);
      // sstore(slot, v): write the word to that storage slot (a single var, or decomposed into packed vars),
      // or the synthesized __evm_storage[slot] register entry for an arbitrary (non-declared) slot.
      if (e.name === 'sstore' && e.args.length === 2) {
        // A stored value is a uint256 word; keccak256/sha256 yields bytes32, so cast it (matches the let/assignment
        // binding normalization). decomposeSlot lowers args[1] itself (declared int fields; keccak there is rare).
        const storeVal = (): ExpressionNode => {
          const v = lowerValue(e.args[1]);
          return isBytes32Call(e.args[1]) ? loc(new CastNode(UINT256, v, false), e) : v;
        };
        const mapWrite = resolveMappingSlot(e.args[0]);
        if (mapWrite) {
          return loc(new MappingAssignNode(mapWrite.collection, mapWrite.keys, storeVal()), e);
        }
        // sstore(keccak256(0,32)+i, v) = arr[i] = v (the array must already be sized to cover i - EVM writes at
        // the computed element slot; the resize idiom `sstore(arr.slot, n)` sizes it first).
        const arrElW = resolveArrayElementSlot(e.args[0]);
        if (arrElW) return loc(new ArrayAssignNode(arrElW.arrName, arrElW.index, storeVal()), e);
        const fields = resolveSlotFields(e.args[0]);
        if (fields) return decomposeSlot(fields, e.args[1], e);
        const comp = resolveCompositeSlotAccess(e.args[0]);
        if (comp) { const st = decomposeCompositeSlot(comp.sv, comp.rel, e.args[1], e); if (st) return st; }
        // sstore(bytesVar.slot, constX) = set a bytes/string var from EVM's short-slot encoding (data in the high
        // bytes) / clear on 0. Compile-time-constant X only; long (keccak-data) / runtime X fail closed.
        const bytesW = bytesSlotVarName(e.args[0]);
        if (bytesW) { const st = bytesSlotConstWrite(bytesW, e.args[1], e); if (st) return st; }
        // sstore(dynArray.slot, n) = resize the fixed-width dynamic array to n elements (truncate / zero-fill grow).
        const resizeName = resolveResizableDynArray(e.args[0]);
        if (resizeName) {
          const pop = new StateArrayPopNode(resizeName);
          pop.resizeTo = lowerValue(e.args[1]);
          return loc(pop, e);
        }
        const key = evmStorageSlotKey(e.args[0]);
        if (key) {
          evmStorageUsed = true;
          return loc(new MappingAssignNode(EVM_STORAGE, [key], storeVal()), e);
        }
      }
      // tstore(key, v): write the transient local for that constant key.
      if (e.name === 'tstore' && e.args.length === 2) {
        const local = transientLocalName(e.args[0]);
        if (local) {
          transientKeys.set(local, e.args[0]);
          return loc(new AssignNode(loc(new IdentifierNode(local), stmt), lowerValue(e.args[1])), stmt);
        }
      }
      // mstore(p, v): in the runtime path, a real in-place store into `__yulmem`. Otherwise record the word in a
      // free-memory buffer (`mstore(buf/add(buf,off), v)`) or the compile-time constant-offset memory model
      // (emitting nothing, read back at create/keccak time).
      if (e.name === 'mstore' && e.args.length === 2) {
        // `mstore(add(s, 32*i), v)` on a high-level struct == `s.field_i = v` (value-copy field rebuild).
        const sf = resolveStructField(e.args[0]);
        if (sf) return structFieldStore(sf, lowerValue(e.args[1]), e);
        if (runtimeMem) return runtimeMstore(lowerValue(e.args[0]), lowerValue(e.args[1]), e);
        const bufPtr = resolveBufferPtr(e.args[0]);
        if (bufPtr) {
          bufferWrites.get(bufPtr.buffer)!.push({ off: bufPtr.off, value: e.args[1] });
          return loc(new BlockNode([]), stmt);
        }
        if (isIntLiteral(e.args[0])) {
          memory.set(BigInt(e.args[0].raw), e.args[1]);
          return loc(new BlockNode([]), stmt);
        }
      }
      // mstore8(p, v): sub-byte store -> only the runtime `__yulmem` buffer models it (splice the low byte). The
      // compile-time constant-offset map is word-granular, so throw to re-lower the whole block on the buffer.
      if (e.name === 'mstore8' && e.args.length === 2) {
        if (runtimeMem) return runtimeMstore8(lowerValue(e.args[0]), lowerValue(e.args[1]), e);
        throw new YulNotLowerable();
      }
      // mcopy(dst, src, size): the runtime path is a byte-granular memmove on `__yulmem`. The compile-time model
      // handles only constant, word-aligned, fully-mstore'd regions (word-copy in the map); anything else throws
      // and re-lowers at runtime.
      if (e.name === 'mcopy' && e.args.length === 3) {
        if (runtimeMem) {
          return runtimeMcopy(lowerValue(e.args[0]), lowerValue(e.args[1]), lowerValue(e.args[2]), e);
        }
        if (e.args.every(isIntLiteral)) {
          const [dst, src, size] = e.args.map((a) => BigInt((a as YulLiteralNode).raw));
          if (size % 32n === 0n) {
            for (let i = 0n; i < size; i += 32n) {
              const word = memory.get(src + i);
              if (word === undefined) throw new YulNotLowerable(); // source word not covered by an mstore
              memory.set(dst + i, word);
            }
            return loc(new BlockNode([]), stmt);
          }
        }
      }
      // returndatacopy(dst, off, len): in the runtime path, splice the last call's return data (the tracked
      // `bytes` var) into __yulmem[dst], so a later mload/return reads it. In the compile-time path there is no
      // buffer, so it is a no-op - fine when the data is consumed via the tracked var; a later mload of the region
      // is rejected there and re-lowers the block onto the runtime buffer, where the real copy happens.
      if (e.name === 'returndatacopy' && e.args.length === 3) {
        if (runtimeMem) return runtimeReturndatacopy(e.args[0], e.args[1], e.args[2], stmt);
        return loc(new BlockNode([]), stmt);
      }
      // pop(x): evaluate x and discard. A low-level call is evaluated for its effect; any other value is pure/read
      // in this model (discard = no-op) - but still lowered first so an unlowerable inner (extcodehash, ...) is
      // reported as the blocker rather than silently dropped.
      if (e.name === 'pop' && e.args.length === 1) {
        if (isLowLevelCall(e.args[0])) return lowerLowLevelCall(e.args[0], `__yul_popok_${yulCallCounter + 1}`, true, stmt);
        lowerValue(e.args[0]);
        return loc(new BlockNode([]), stmt);
      }
      // return(ptr, size): halt, returning mem[ptr:ptr+size]. A constant 32-byte region covered by a compile-time
      // mstore returns that single word; otherwise the runtime path slices __yulmem[ptr:ptr+size] as bytes. When
      // not yet on the runtime buffer, throw so the whole block re-lowers onto __yulmem (matches mstore8/mcopy).
      if (e.name === 'return' && e.args.length === 2) {
        if (e.args.every(isIntLiteral)) {
          const [ptr, size] = e.args.map((a) => BigInt((a as YulLiteralNode).raw));
          if (size === 32n) {
            const word = memory.get(ptr);
            if (word !== undefined) return loc(new ReturnNode([lowerValue(word)]), stmt);
          }
        }
        if (runtimeMem) return runtimeReturn(e.args[0], e.args[1], stmt);
        throw new YulNotLowerable();
      }
      // codecopy(dst, off, len): copy this contract's own bytecode into __yulmem[dst:dst+len] (own code = the
      // active input's bytecode). extcodecopy(addr, dst, off, len): the same from addr.code. Both need the runtime
      // buffer; throw to re-lower the block onto __yulmem when not yet on it.
      if (e.name === 'codecopy' && e.args.length === 3) {
        if (runtimeMem) {
          return runtimeCopyInto(loc(new NullaryOpNode(NullaryOperator.BYTECODE), e),
            lowerValue(e.args[0]), lowerValue(e.args[1]), lowerValue(e.args[2]), stmt);
        }
        throw new YulNotLowerable();
      }
      if (e.name === 'extcodecopy' && e.args.length === 4) {
        if (runtimeMem) {
          const code = loc(new FieldAccessNode(asAddress(e.args[0], e), 'code'), e);
          return runtimeCopyInto(code, lowerValue(e.args[1]), lowerValue(e.args[2]), lowerValue(e.args[3]), stmt);
        }
        throw new YulNotLowerable();
      }
      // calldatacopy(dst, srcOff, len): copy the synthesized EVM calldata (msg.sig ++ 32-byte param words, the model
      // calldataload/calldatasize use) into __yulmem[dst:dst+len]. The `calldatacopy(dst, P.offset, P.length)` form
      // for a bytes calldata param P copies P's bytes directly. Needs the runtime buffer; throw to re-lower onto it.
      if (e.name === 'calldatacopy' && e.args.length === 3) {
        if (runtimeMem) {
          const paramName = resolveCalldataParamCopy(e.args[1], e.args[2]);
          if (paramName) {
            const p = (): ExpressionNode => loc(new IdentifierNode(paramName), e);
            return runtimeCopyInto(p(), lowerValue(e.args[0]), intLit(0n, e),
              loc(new UnaryOpNode(UnaryOperator.SIZE, p()), e), stmt);
          }
          return runtimeCopyInto(synthesizedCalldata(e),
            lowerValue(e.args[0]), lowerValue(e.args[1]), lowerValue(e.args[2]), stmt);
        }
        throw new YulNotLowerable();
      }
      // log0(p,n) .. log4(p,n,t1..t4): the EVM LOG opcodes = EVENT emission (every `emit E(..)` lowers to a LOGn).
      // Wire them to SolidCash's event NFT: emit an anonymous `__YulLog(bytes)` whose data is the topics (each a
      // 32-byte word) concatenated with the data region mem[p:p+n]. log0 carries no topics but STILL emits its
      // data region - it is not a no-op. The data region reuses the keccak reconstruction (constant word-concat,
      // or a runtime `__yulmem[p:p+n]` slice).
      const logArity = ['log0', 'log1', 'log2', 'log3', 'log4'].indexOf(e.name);
      if (logArity >= 0 && e.args.length === logArity + 2) {
        return buildLogEmit(e.args.slice(2), e.args[0], e.args[1], stmt);
      }
    }
    throw new YulNotLowerable();
  }

  if (stmt instanceof YulBreakNode) return loc(new BreakNode(), stmt);
  if (stmt instanceof YulContinueNode) return loc(new ContinueNode(), stmt);

  throw new YulNotLowerable(); // leave / function definition
}

// switch e { case v { b } ... default { d } } -> if (e==v) {b} else if (e==v2) {b2} ... else {d}.
// The switch expression is re-evaluated per case (Yul switch expressions are pure value computation), which
// avoids a typed temp that would clash with the operand's signedness.
function lowerSwitch(node: YulSwitchNode): StatementNode {
  let chain: BlockNode | undefined = node.defaultBody ? lowerBlock(node.defaultBody) : undefined;
  for (let i = node.cases.length - 1; i >= 0; i--) {
    const c = node.cases[i];
    // Yul switch compares 256-bit words regardless of the high-level type of a referenced variable. Normalize
    // both sides so `bool success; assembly { switch success case 0 { ... } }` compares uint256( success ) to
    // uint256(0), rather than producing a bool-vs-int type error.
    const cond = loc(new BinaryOpNode(
      lowerBitwiseOperand(node.expression), BinaryOperator.EQ, lowerBitwiseOperand(c.value),
    ), c);
    const branch = loc(new BranchNode(cond, lowerBlock(c.body), chain), c);
    chain = loc(new BlockNode([branch]), c);
  }
  return chain ?? loc(new BlockNode([]), node);
}

// for { init } cond { post } { body } -> { init...; while (cond) { body...; post... } }
function lowerForLoop(node: YulForLoopNode): StatementNode {
  const initStmts = node.pre.statements.map(lowerStatement);
  // Loop-init declarations are block-scoped in Yul; mark them so sequential loops may re-declare the name.
  for (const s of initStmts) if (s instanceof VariableDefinitionNode) s.isLoopVariable = true;

  const postStmts = node.post.statements.map(lowerStatement);
  const bodyStmts = node.body.statements.map(lowerStatement);
  const loopBlock = loc(new BlockNode([...bodyStmts, ...postStmts]), node.body);

  const whileNode = loc(new WhileNode(lowerCond(node.condition), loopBlock), node);
  whileNode.forLoopUpdateCount = postStmts.length; // so `continue` still runs the post step

  return loc(new BlockNode([...initStmts, whileNode]), node);
}

// Deep-clone a Yul node, renaming any identifier (path base, let-declared name) found in `rn`. Function-call
// names and path members are left as-is (builtins / other functions / struct-ish members).
function yulCloneRename<T extends YulNode>(n: T, rn: Map<string, string>): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (x: YulNode): any => yulCloneRename(x, rn);
  // copy the source location so downstream loc() has a defined position for the emitted solidc nodes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const at = (x: unknown): T => { (x as any).location = (n as any).location; return x as any as T; };
  if (n instanceof YulLiteralNode) return at(new YulLiteralNode(n.kind, n.raw));
  if (n instanceof YulPathNode) return at(new YulPathNode(rn.get(n.base) ?? n.base, [...n.members]));
  if (n instanceof YulFunctionCallNode) return at(new YulFunctionCallNode(n.name, n.args.map(r)));
  if (n instanceof YulVariableDeclarationNode) return at(new YulVariableDeclarationNode(n.names.map((x) => rn.get(x) ?? x), n.value ? r(n.value) : undefined));
  if (n instanceof YulAssignmentNode) return at(new YulAssignmentNode(n.paths.map(r), r(n.value)));
  if (n instanceof YulExpressionStatementNode) return at(new YulExpressionStatementNode(r(n.expression)));
  if (n instanceof YulIfNode) return at(new YulIfNode(r(n.condition), r(n.body)));
  if (n instanceof YulSwitchNode) return at(new YulSwitchNode(r(n.expression), n.cases.map((c) => new YulCaseNode(r(c.value), r(c.body))), n.defaultBody ? r(n.defaultBody) : undefined));
  if (n instanceof YulForLoopNode) return at(new YulForLoopNode(r(n.pre), r(n.condition), r(n.post), r(n.body)));
  if (n instanceof YulBlockNode) return at(new YulBlockNode(n.statements.map(r)));
  return n; // Break / Continue / Leave: no identifiers
}

// Copy a Yul node's source location (for synthetic nodes built during inlining).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function yulAt<T extends YulNode>(n: T, src: YulNode): T { (n as any).location = (src as any).location; return n; }

// Names declared by `let` in a block (not descending into nested definitions).
function collectYulLets(block: YulBlockNode, out: string[]): void {
  for (const s of block.statements) {
    if (s instanceof YulVariableDeclarationNode) out.push(...s.names);
    else if (s instanceof YulIfNode) collectYulLets(s.body, out);
    else if (s instanceof YulForLoopNode) { collectYulLets(s.pre, out); collectYulLets(s.post, out); collectYulLets(s.body, out); }
    else if (s instanceof YulSwitchNode) { for (const c of s.cases) collectYulLets(c.body, out); if (s.defaultBody) collectYulLets(s.defaultBody, out); }
    else if (s instanceof YulBlockNode) collectYulLets(s, out);
  }
}

// A function body is inlinable only if it has no nested definition, no `leave`, and calls no local function
// (leaf - so there is no recursion/mutual recursion to resolve).
function yulBodyUsesLocalFns(node: YulNode, names: Set<string>): boolean {
  if (node instanceof YulFunctionDefinitionNode || node instanceof YulLeaveNode) return true;
  if (node instanceof YulFunctionCallNode && names.has(node.name)) return true;
  for (const key of Object.keys(node)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (node as any)[key];
    if (v instanceof YulNode && yulBodyUsesLocalFns(v, names)) return true;
    if (Array.isArray(v)) for (const it of v) if (it instanceof YulNode && yulBodyUsesLocalFns(it, names)) return true;
  }
  return false;
}

// Inline one call: bind params, declare returns, splice the freshly-renamed body. Returns the pre-statements and
// the return paths (0 for a void function, 1 for single-return, N for a multi-return `-> x, y, z`).
function inlineYulCall(
  def: YulFunctionDefinitionNode, args: YulExpressionNode[],
): { pre: YulStatementNode[]; rets: YulExpressionNode[] } {
  // Fast path: a 0-param body `r := <expr>` (no free vars) is exactly <expr> - no return-var indirection.
  if (def.params.length === 0 && def.returns.length === 1 && def.body.statements.length === 1) {
    const only = def.body.statements[0];
    if (only instanceof YulAssignmentNode && only.paths.length === 1
      && only.paths[0].base === def.returns[0] && only.paths[0].members.length === 0) {
      return { pre: [], rets: [yulCloneRename(only.value, new Map())] };
    }
  }
  yulCallCounter += 1;
  const tag = yulCallCounter;
  const rn = new Map<string, string>();
  def.params.forEach((p, i) => rn.set(p, `__yulin_${tag}_p${i}`));
  def.returns.forEach((rv, i) => rn.set(rv, `__yulin_${tag}_r${i}`));
  const lets: string[] = [];
  collectYulLets(def.body, lets);
  for (const l of lets) rn.set(l, `__yulin_${tag}_l_${l}`);
  const pre: YulStatementNode[] = [];
  def.params.forEach((p, i) => pre.push(yulAt(new YulVariableDeclarationNode([rn.get(p)!], args[i]), def.body)));
  def.returns.forEach((rv) => pre.push(yulAt(new YulVariableDeclarationNode([rn.get(rv)!]), def.body)));
  for (const s of def.body.statements) pre.push(yulCloneRename(s, rn));
  return { pre, rets: def.returns.map((rv) => yulAt(new YulPathNode(rn.get(rv)!), def.body)) };
}

// Hoist local-function calls out of an expression: append each call's inlined body to `pre`, replace the call
// with its return value.
function hoistYulCalls(e: YulExpressionNode, defs: Map<string, YulFunctionDefinitionNode>, pre: YulStatementNode[]): YulExpressionNode {
  if (e instanceof YulFunctionCallNode) {
    const args = e.args.map((a) => hoistYulCalls(a, defs, pre));
    const def = defs.get(e.name);
    if (def) {
      const inl = inlineYulCall(def, args);
      pre.push(...inl.pre);
      return inl.rets[0] ?? yulAt(new YulLiteralNode(YulLiteralKind.NUMBER, '0'), e);
    }
    return yulAt(new YulFunctionCallNode(e.name, args), e);
  }
  return e;
}

function inlineYulStmts(stmts: YulStatementNode[], defs: Map<string, YulFunctionDefinitionNode>): YulStatementNode[] {
  const out: YulStatementNode[] = [];
  const blk = (b: YulBlockNode): YulBlockNode => yulAt(new YulBlockNode(inlineYulStmts(b.statements, defs)), b);
  for (const s of stmts) {
    if (s instanceof YulFunctionDefinitionNode) continue; // drop the inlined definitions
    const pre: YulStatementNode[] = [];
    if (s instanceof YulVariableDeclarationNode) {
      // Multi-return direct call `let a, b, c := f(..)`: inline f, bind each name to a return path.
      const mdef = s.names.length > 1 && s.value instanceof YulFunctionCallNode ? defs.get(s.value.name) : undefined;
      if (mdef && mdef.returns.length === s.names.length) {
        const args = (s.value as YulFunctionCallNode).args.map((a) => hoistYulCalls(a, defs, pre));
        const inl = inlineYulCall(mdef, args);
        out.push(...pre, ...inl.pre);
        s.names.forEach((nm, i) => out.push(yulAt(new YulVariableDeclarationNode([nm], inl.rets[i]), s)));
      } else {
        const v = s.value ? hoistYulCalls(s.value, defs, pre) : undefined;
        out.push(...pre, yulAt(new YulVariableDeclarationNode(s.names, v), s));
      }
    } else if (s instanceof YulAssignmentNode) {
      // Multi-return direct call `a, b, c := f(..)`: inline f, assign each path from a return path.
      const mdef = s.paths.length > 1 && s.value instanceof YulFunctionCallNode ? defs.get(s.value.name) : undefined;
      if (mdef && mdef.returns.length === s.paths.length) {
        const args = (s.value as YulFunctionCallNode).args.map((a) => hoistYulCalls(a, defs, pre));
        const inl = inlineYulCall(mdef, args);
        out.push(...pre, ...inl.pre);
        s.paths.forEach((p, i) => out.push(yulAt(new YulAssignmentNode([p], inl.rets[i]), s)));
      } else {
        const v = hoistYulCalls(s.value, defs, pre);
        out.push(...pre, yulAt(new YulAssignmentNode(s.paths, v), s));
      }
    } else if (s instanceof YulExpressionStatementNode && s.expression instanceof YulFunctionCallNode
      && defs.has(s.expression.name)) {
      const args = s.expression.args.map((a) => hoistYulCalls(a, defs, pre)); // statement-position call: void body
      out.push(...pre, ...inlineYulCall(defs.get(s.expression.name)!, args).pre);
    } else if (s instanceof YulExpressionStatementNode) {
      out.push(...pre, yulAt(new YulExpressionStatementNode(hoistYulCalls(s.expression, defs, pre)), s));
    } else if (s instanceof YulIfNode) {
      const c = hoistYulCalls(s.condition, defs, pre);
      out.push(...pre, yulAt(new YulIfNode(c, blk(s.body)), s));
    } else if (s instanceof YulSwitchNode) {
      const e = hoistYulCalls(s.expression, defs, pre);
      out.push(...pre, yulAt(new YulSwitchNode(e, s.cases.map((c) => yulAt(new YulCaseNode(c.value, blk(c.body)), c)),
        s.defaultBody ? blk(s.defaultBody) : undefined), s));
    } else if (s instanceof YulForLoopNode) {
      out.push(yulAt(new YulForLoopNode(blk(s.pre), s.condition, blk(s.post), blk(s.body)), s));
    } else out.push(s);
  }
  return out;
}

// True if `node` (anywhere within) calls the function `name`.
function yulBodyCalls(node: YulNode, name: string): boolean {
  if (node instanceof YulFunctionCallNode && node.name === name) return true;
  for (const key of Object.keys(node)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (node as any)[key];
    if (v instanceof YulNode && yulBodyCalls(v, name)) return true;
    if (Array.isArray(v)) for (const it of v) if (it instanceof YulNode && yulBodyCalls(it, name)) return true;
  }
  return false;
}

// Inline every local Yul function whose body is self-contained (no nested def, no `leave`, calls no local fn, at
// most one return). A REACHABLE (called) definition that is not self-contained leaves the block for the diagnostic;
// an UNREACHABLE (dead) definition is dropped regardless of its body, so `function f(){ leave }` that is never
// called does not block compilation.
function inlineLocalYulFunctions(block: YulBlockNode): YulBlockNode {
  const defs = new Map<string, YulFunctionDefinitionNode>();
  for (const s of block.statements) if (s instanceof YulFunctionDefinitionNode) defs.set(s.name, s);
  if (defs.size === 0) return block;
  const names = new Set(defs.keys());
  // Reachability: called from a non-definition top-level statement, then transitively through reachable bodies.
  const reachable = new Set<string>();
  const nonDef = block.statements.filter((s) => !(s instanceof YulFunctionDefinitionNode));
  const queue: string[] = [];
  for (const nm of names) if (nonDef.some((s) => yulBodyCalls(s, nm))) { reachable.add(nm); queue.push(nm); }
  while (queue.length) {
    const body = defs.get(queue.pop()!)!.body;
    for (const nm of names) if (!reachable.has(nm) && yulBodyCalls(body, nm)) { reachable.add(nm); queue.push(nm); }
  }
  for (const nm of reachable) {
    const d = defs.get(nm)!;
    // Drop dead code after an unconditional top-level `leave` (an early return); the return vars keep the values
    // they hold at that point. A `leave` that REMAINS (nested in an if/for/switch) is not linearly truncatable and
    // still bails below.
    d.body = truncateAtLeave(d.body);
    if (yulBodyUsesLocalFns(d.body, names)) return block; // reachable + recursion / nested def / remaining leave
  }
  block.statements = inlineYulStmts(block.statements, defs);
  return block;
}

// Truncate a Yul function body at its first TOP-LEVEL `leave` (unconditional early return): everything after it is
// dead. A leave nested inside control flow is left in place (handled as un-inlinable by the caller).
function truncateAtLeave(block: YulBlockNode): YulBlockNode {
  const out: YulStatementNode[] = [];
  for (const s of block.statements) { if (s instanceof YulLeaveNode) break; out.push(s); }
  return out.length === block.statements.length ? block : yulAt(new YulBlockNode(out), block);
}

function lowerBlock(block: YulBlockNode): BlockNode {
  const out: StatementNode[] = [];
  for (const s of block.statements) {
    const lowered = lowerStatement(s);
    // Flatten a lowering-artifact block (the low-level-call binding, empty mstore no-ops) into this scope so its
    // declarations (e.g. the returndata `bytes` var) are visible to later statements; a real nested Yul block
    // (YulBlockNode) stays a scoped BlockNode.
    if (lowered instanceof BlockNode && !(s instanceof YulBlockNode)) out.push(...(lowered.statements ?? []));
    else out.push(lowered);
  }
  return loc(new BlockNode(out), block);
}

// Pre-semantic pass: lower supported Yul inline assembly to equivalent main-AST statements, reusing the
// existing codegen (stack model, control flow, type checking). Unsupported Yul is left untouched for the
// inline-assembly diagnostic. Native BCH-ASM (no yulBlock) is unaffected. See docs/yul-inline-assembly.md.
export default class LowerInlineAssembly extends AstTraversal {
  // Track the enclosing contract's state variables so sstore/sload can resolve slot numbers.
  visitContract(node: ContractNode): Node {
    computeStorageLayout(node.stateVariables, node.collections);
    // SourceFile traversal visits file-level functions before the contract. A helper such as
    // `readSlot(uint i) { assembly { r := sload(add(base(), i)) } }` can therefore request the raw-slot
    // register before we get here. Preserve that request: the helper is later inlined/called by this contract,
    // so its MappingAccess must resolve against the contract's synthesized collection too.
    const freeFunctionEvmStorageUsed = evmStorageUsed;
    evmStorageUsed = false;
    logEventUsed = false;
    const result = super.visitContract(node) as ContractNode;
    // The base traversal visits constructorDef + functions but NOT fallbackDef/receiveDef (separate contract
    // fields), so their assembly would never be lowered - visit them here so Yul in a fallback/receive lowers too.
    if (result.fallbackDef) result.fallbackDef = this.visitFunctionDefinition(result.fallbackDef) as FunctionDefinitionNode;
    if (result.receiveDef) result.receiveDef = this.visitFunctionDefinition(result.receiveDef) as FunctionDefinitionNode;
    // Synthesize the EVM-storage register if any assembly routed a slot to it (docs/evm-storage-parity.md).
    if ((freeFunctionEvmStorageUsed || evmStorageUsed)
      && !result.collections.some((c) => c.name === EVM_STORAGE)) {
      const mapping = new CollectionNode(new MappingType(UINT256, UINT256), EVM_STORAGE);
      mapping.location = node.location;
      result.collections.push(mapping);
    }
    // Synthesize the anonymous event any lowered Yul log0-log4 emits into (registered by SymbolTableTraversal,
    // which then numbers the emit + wires its event-NFT covenant like a source-level `emit`).
    if (logEventUsed && !result.eventDefinitions.some((ev) => ev.name === YUL_LOG_EVENT)) {
      const ev = new EventDefinitionNode(YUL_LOG_EVENT, [{ name: 'data', type: new BytesType(), indexed: false }]);
      ev.isAnonymous = true;
      ev.signature = `${YUL_LOG_EVENT}(bytes)`;
      ev.location = node.location;
      result.eventDefinitions.push(ev);
    }
    evmStorageUsed = false;
    logEventUsed = false;
    currentSlots = new Map();
    occupiedSlots = new Set();
    compositeRanges = [];
    currentVarSlot = new Map();
    return result;
  }

  // Track the current function's parameters so calldataload/calldatasize can resolve against them.
  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    currentParams = node.parameters;
    currentVars = new Map();
    currentVarValues = new Map();
    currentCreationCodeLocals = new Map();
    bufferWrites = new Map();
    functionYulMemUsed = false;
    mutableCalldataComponents = new Set();
    collectMutableCalldataComponents(node, mutableCalldataComponents);
    // Keep only components whose base is a dynamic CALLDATA param (a storage-pointer `.offset` is read-only and
    // must not be re-routed to a local).
    const dynCalldataParams = new Set(node.parameters.filter((p) => isDynamicCalldataType(p.type)).map((p) => p.name));
    mutableCalldataComponents = new Set(
      [...mutableCalldataComponents].filter((k) => dynCalldataParams.has(k.split('.')[0])),
    );
    for (const p of node.parameters) currentVars.set(p.name, p.type);
    collectVarTypes(node.body, currentVars);
    currentStorageAliases = new Map();
    collectStorageAliases(node.body, currentStorageAliases);
    // Record that this function had inline assembly BEFORE it is lowered away, so PruneUnreachableFreeFunctions can
    // still drop it when dead (a fully-lowerable helper like OZ Math.mulDiv leaves no residual assembly to detect).
    if (bodyHasAssembly(node.body)) node.hadInlineAssembly = true;
    const result = super.visitFunctionDefinition(node) as FunctionDefinitionNode;
    // Declare the shared runtime memory buffer once at the body top (before any block that uses it), so every
    // lowered assembly block reads/writes one function-scoped `__yulmem` - matching EVM's function-scoped memory.
    // LowerMemoryModel runs first and reuses the SAME buffer for high-level `memory` arrays/structs; if it already
    // declared __yulmem (its allocations bumped the free pointer at 0x40), reuse that decl instead of re-init'ing.
    if (functionYulMemUsed) {
      const alreadyDeclared = (result.body.statements ?? []).some(
        (s) => s instanceof VariableDefinitionNode && s.name === YULMEM,
      );
      if (!alreadyDeclared) result.body.statements = [yulMemInit(result.body), ...(result.body.statements ?? [])];
    }
    // Declare each mutable calldata component (`x.offset`/`x.length` assigned in the fn) as a function-scoped local,
    // initialized to its default (compile-time offset / SIZE(param)) at the body top so an assign in one block is
    // visible in a later block.
    if (mutableCalldataComponents.size > 0) {
      const decls: StatementNode[] = [];
      for (const key of mutableCalldataComponents) {
        const [base, member] = key.split('.');
        const local = cdComponentLocal(base, member);
        const def = member === 'offset'
          ? intLit(calldataDataOffset(base) ?? 0n, node)
          : loc(new UnaryOpNode(UnaryOperator.SIZE, loc(new IdentifierNode(base), node)), node);
        decls.push(loc(new VariableDefinitionNode(UINT256, [], local, def), node));
      }
      result.body.statements = [...decls, ...(result.body.statements ?? [])];
    }
    currentParams = [];
    currentVars = new Map();
    currentVarValues = new Map();
    currentCreationCodeLocals = new Map();
    currentStorageAliases = new Map();
    bufferWrites = new Map();
    functionYulMemUsed = false;
    return result;
  }

  // Splice a lowered assembly block that ends in `return` into the parent block so the return sits at the
  // function-body tail. Left nested, it hides the return from the terminal-return codegen, which then also emits
  // the function's trailing covenant - duplicating it. A return-terminated block has nothing after it, so its
  // lowered locals cannot collide with later statements; other assembly blocks stay nested (scoped).
  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const wasAssembly = stmt instanceof AssemblyStatementNode;
      const visited = this.visit(stmt) as StatementNode;
      const inner = visited instanceof BlockNode ? visited.statements ?? [] : undefined;
      if (wasAssembly && inner && inner.length > 0 && inner[inner.length - 1] instanceof ReturnNode) {
        out.push(...inner);
      } else {
        out.push(visited);
      }
    }
    node.statements = out;
    return node;
  }

  visitAssemblyStatement(node: AssemblyStatementNode): Node {
    if (!node.yulBlock) return node;
    // Fast path: the compile-time constant-offset memory model. If it rejects a memory op (dynamic offset, msize,
    // sub-word/dynamic keccak, mstore8, dynamic mcopy), re-lower the WHOLE block on the runtime `__yulmem` buffer -
    // all-or-nothing, so the two models never mix within a block. bufferWrites is per-function, so snapshot it and
    // restore before the retry (a partial compile-time attempt may have pushed stale buffer entries).
    const bufSnapshot = new Map(bufferWrites);
    const compiled = this.tryLowerAsm(node, false);
    if (compiled) return compiled;
    bufferWrites = new Map(bufSnapshot);
    const runtime = this.tryLowerAsm(node, true);
    if (!runtime) bufferWrites = new Map(bufSnapshot);
    return runtime ?? node;
  }

  private tryLowerAsm(node: AssemblyStatementNode, runtime: boolean): BlockNode | undefined {
    transientKeys.clear();
    memory.clear();
    mappingSlotVars.clear();
    arrayElemSlotVars.clear();
    lastReturnData = undefined;
    runtimeMem = runtime;
    yulMemUsed = false;
    try {
      const block = lowerBlock(inlineLocalYulFunctions(node.yulBlock!));
      const prefix: StatementNode[] = [];
      // The `__yulmem` buffer is function-scoped (declared once at the body top by visitFunctionDefinition), not
      // per-block, so blocks share one EVM-faithful memory. Just record that this function needs it.
      if (runtime && yulMemUsed) functionYulMemUsed = true;
      // Zero-init each transient key used in this block (tstore/tload locals stay block-scoped).
      for (const [name, src] of transientKeys) {
        prefix.push(loc(new VariableDefinitionNode(UINT256, [], name, intLit(0n, src)), src));
      }
      if (prefix.length > 0) block.statements = [...prefix, ...(block.statements ?? [])];
      return block;
    } catch (e) {
      if (e instanceof YulNotLowerable) return undefined;
      throw e;
    } finally {
      runtimeMem = false;
    }
  }
}
