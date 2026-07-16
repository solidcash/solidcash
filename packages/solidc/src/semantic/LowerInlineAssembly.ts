import {
  IntType, BytesType, AddressType, PrimitiveType, ValueType, Type, MappingType, StructType, ArrayType, hash256,
} from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import {
  Node, StatementNode, ExpressionNode, AssemblyStatementNode, BlockNode, VariableDefinitionNode,
  AssignNode, RequireNode, BranchNode, WhileNode, BreakNode, ContinueNode, BinaryOpNode, UnaryOpNode,
  CastNode, IdentifierNode, IntLiteralNode, BoolLiteralNode, ParameterNode, FunctionDefinitionNode,
  StateAssignNode, StateAccessNode, StateVariableNode, ContractNode, BytesConcatNode, FunctionCallNode,
  SliceNode, CollectionNode, MappingAccessNode, MappingAssignNode, HexLiteralNode, NullaryOpNode, FieldAccessNode,
  ReturnNode, TupleAssignmentNode, LowLevelCallNode, NewArrayNode, EmitStatementNode, EventDefinitionNode,
} from '../ast/AST.js';
import { BinaryOperator, UnaryOperator, NullaryOperator } from '../ast/Operator.js';
import {
  YulNode, YulBlockNode, YulStatementNode, YulExpressionNode, YulVariableDeclarationNode, YulAssignmentNode,
  YulIfNode, YulSwitchNode, YulForLoopNode, YulExpressionStatementNode, YulBreakNode, YulContinueNode,
  YulFunctionCallNode, YulFunctionDefinitionNode, YulPathNode, YulLiteralNode, YulLiteralKind,
  YulCaseNode, YulLeaveNode,
} from '../ast/YulAST.js';

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
  }
  for (const key of Object.keys(node)) {
    const val = (node as any)[key];
    if (val instanceof Node) collectVarTypes(val, out);
    else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) collectVarTypes(v, out);
  }
}

// EVM storage layout of the enclosing contract: each state var packed into a 32-byte slot in declaration
// order (Solidity rules), so sload/sstore on a slot can map to the var(s) at that slot. A single full-width
// var (the common uint256 case) stays a plain read/write; a packed slot combines/decomposes its sub-word vars.
interface SlotField { sv: StateVariableNode; bitOffset: bigint; bitWidth: bigint; }
let currentSlots = new Map<bigint, SlotField[]>();
let currentVarSlot = new Map<string, bigint>();
// Warn only once that the erc7201 Yul builtin is aliased to sha256.
let warnedErc7201Yul = false;

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
  // Bind the Yul word var from the bool success (Yul `ok` is a 0/1 word).
  const okWord = loc(new CastNode(UINT256, loc(new IdentifierNode(okTmp), src), false), src);
  const okStmt = okIsNew
    ? loc(new VariableDefinitionNode(UINT256, [], okVar, okWord), src)
    : loc(new AssignNode(loc(new IdentifierNode(okVar), src), okWord), src);
  return loc(new BlockNode([tuple, okStmt]), src);
}

// If a Yul slot argument denotes an arbitrary EVM storage slot (not a declared var), return the lowered slot
// key for __evm_storage[key]; else undefined (a declared-var slot, handled by resolveSlotFields). A plain int
// literal whose slot holds a declared var, or a declared var's `x.slot`, is NOT __evm_storage.
function evmStorageSlotKey(slotArg: YulExpressionNode): ExpressionNode | undefined {
  if (isIntLiteral(slotArg)) {
    const slotNum = BigInt(slotArg.raw);
    return currentSlots.has(slotNum) ? undefined : intLit(slotNum, slotArg);
  }
  if (slotArg instanceof YulPathNode && slotArg.members.length === 1 && slotArg.members[0] === 'slot') {
    return undefined; // `x.slot` of a declared var
  }
  return lowerValue(slotArg); // a computed slot expression (arithmetic / hash)
}

function stateVarByteWidth(sv: StateVariableNode): number {
  const t = sv.type;
  if (sv.isDynamic) return 32;
  if (t instanceof IntType) return t.bits / 8;
  if (t instanceof AddressType) return 20;
  if (t instanceof BytesType) return t.bound ?? 32;
  if (t === PrimitiveType.BOOL) return 1;
  return 32; // mapping / dynamic array/bytes: one slot (the base/length header)
}

// The byte width a value type occupies when packed in an EVM storage slot. Composites are handled by packWords.
function valueByteWidth(t: Type): number {
  if (t instanceof IntType) return t.bits / 8;
  if (t instanceof AddressType) return 20;
  if (t instanceof BytesType) return t.bound ?? 32;
  if (t === PrimitiveType.BOOL) return 1;
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
    return Math.max(1, packWords(new Array(Number(t.bound)).fill(t.elementType)));
  }
  if (t instanceof StructType) return Math.max(1, packWords(t.fields.map((f) => f.type)));
  return 0;
}

function computeStorageLayout(vars: StateVariableNode[]): void {
  currentSlots = new Map();
  currentVarSlot = new Map();
  let slot = 0n;
  let byteOff = 0;
  for (const sv of vars) {
    // A fixed struct/array (non-dynamic) occupies whole EVM slots and does not pack with neighbours; the next
    // var starts a fresh slot. Its own slots hold composite data (resolveSlotFields returns undefined for them).
    const composite = sv.isDynamic ? 0 : compositeSlotWords(sv.type);
    if (composite > 0) {
      if (byteOff > 0) { slot += 1n; byteOff = 0; }
      currentVarSlot.set(sv.name, slot);
      slot += BigInt(composite);
      continue;
    }
    const w = stateVarByteWidth(sv);
    if (byteOff + w > 32) { slot += 1n; byteOff = 0; }
    if (!currentSlots.has(slot)) currentSlots.set(slot, []);
    currentSlots.get(slot)!.push({ sv, bitOffset: BigInt(byteOff * 8), bitWidth: BigInt(w * 8) });
    currentVarSlot.set(sv.name, slot);
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
  if (fields && fields.every((f) => f.sv.type instanceof IntType)) return fields;
  return undefined;
}

function isFullWord(fields: SlotField[]): boolean {
  return fields.length === 1 && fields[0].bitOffset === 0n && fields[0].bitWidth === 256n;
}

// sload(slot): combine the slot's fields into a word, `uint256(v0) + uint256(v1)*2^off1 + ...`.
function combineSlot(fields: SlotField[], src: YulExpressionNode): ExpressionNode {
  if (isFullWord(fields)) return loc(new StateAccessNode(fields[0].sv.name), src);
  let expr: ExpressionNode | undefined;
  for (const f of fields) {
    const word = loc(new CastNode(UINT256, loc(new StateAccessNode(f.sv.name), src), false), src);
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
  if (isFullWord(fields)) return loc(new StateAssignNode(fields[0].sv.name, lowerValue(valueExpr)), src);
  const tempName = '__yul_slot';
  const stmts: StatementNode[] = [loc(new VariableDefinitionNode(UINT256, [], tempName, lowerValue(valueExpr)), src)];
  for (const f of fields) {
    let field: ExpressionNode = loc(new IdentifierNode(tempName), src);
    if (f.bitOffset > 0n) field = loc(new BinaryOpNode(field, BinaryOperator.DIV, intLit(2n ** f.bitOffset, src)), src);
    field = loc(new BinaryOpNode(field, BinaryOperator.MOD, intLit(2n ** f.bitWidth, src)), src);
    const cast = loc(new CastNode(f.sv.type, field, false), src);
    stmts.push(loc(new StateAssignNode(f.sv.name, cast), src));
  }
  return loc(new BlockNode(stmts), src);
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
const YULMEM = '__yulmem';

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

// `bytes __yulmem = <0x40 zero bytes> ++ bytes32(0x80) ++ <0x20 zero bytes>` - 128 bytes, EVM reserved layout
// with the free-memory pointer value 0x80 stored at slot 0x40, so `mload(0x40)` reads 0x80.
function yulMemInit(src: { location?: Node['location'] }): StatementNode {
  const init = loc(new BytesConcatNode([
    newBytes(intLit(0x40n, src), src),
    loc(new CastNode(BYTES32, intLit(0x80n, src), false), src),
    newBytes(intLit(0x20n, src), src),
  ]), src);
  return loc(new VariableDefinitionNode(new BytesType(), [], YULMEM, init), src);
}

// `if (__yulmem.length < <off>+word) __yulmem = bytes.concat(__yulmem, new bytes(<off>+word - __yulmem.length));`
function growTo(offName: string, word: bigint, src: YulNode): StatementNode {
  const need = (): ExpressionNode => addE(loc(new IdentifierNode(offName), src), intLit(word, src), src);
  const cond = loc(new BinaryOpNode(memLen(src), BinaryOperator.LT, need()), src);
  const pad = newBytes(loc(new BinaryOpNode(need(), BinaryOperator.MINUS, memLen(src)), src), src);
  const grow = loc(new AssignNode(yulmem(src), loc(new BytesConcatNode([yulmem(src), pad]), src)), src);
  return loc(new BranchNode(cond, loc(new BlockNode([grow]), src)), src);
}

// mstore(off, val): grow to cover off+32, then splice the 32-byte little-endian word (bytes32(val)) in place.
function runtimeMstore(offExpr: ExpressionNode, valExpr: ExpressionNode, src: YulNode): StatementNode {
  yulMemUsed = true;
  const offName = `__yoff_${yulTmpN++}`;
  const off = (): ExpressionNode => loc(new IdentifierNode(offName), src);
  const decl = loc(new VariableDefinitionNode(UINT256, [], offName, offExpr), src);
  const head = loc(new SliceNode(yulmem(src), intLit(0n, src), off()), src);
  const word = loc(new CastNode(BYTES32, valExpr, false), src);
  const tail = loc(new SliceNode(yulmem(src), addE(off(), intLit(32n, src), src), memLen(src)), src);
  const store = loc(new AssignNode(yulmem(src), loc(new BytesConcatNode([head, word, tail]), src)), src);
  return loc(new BlockNode([decl, growTo(offName, 32n, src), store]), src);
}

// mstore8(off, val): grow to cover off+1, then splice ONE byte at position off - val's low byte, which is
// bytes32(val)[0:1] under BCH's little-endian word encoding (byte 0 = the low byte, same convention runtimeMstore
// writes and runtimeMload reads). A later full-word mload straddling this write reads zeros for the unwritten
// bytes via runtimeMload's trailing zero pad.
function runtimeMstore8(offExpr: ExpressionNode, valExpr: ExpressionNode, src: YulNode): StatementNode {
  yulMemUsed = true;
  const offName = `__yoff8_${yulTmpN++}`;
  const off = (): ExpressionNode => loc(new IdentifierNode(offName), src);
  const decl = loc(new VariableDefinitionNode(UINT256, [], offName, offExpr), src);
  const head = loc(new SliceNode(yulmem(src), intLit(0n, src), off()), src);
  const word = loc(new CastNode(BYTES32, valExpr, false), src);
  const lowByte = loc(new SliceNode(word, intLit(0n, src), intLit(1n, src)), src);
  const tail = loc(new SliceNode(yulmem(src), addE(off(), intLit(1n, src), src), memLen(src)), src);
  const store = loc(new AssignNode(yulmem(src), loc(new BytesConcatNode([head, lowByte, tail]), src)), src);
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
  const pad = newBytes(loc(new BinaryOpNode(need(), BinaryOperator.MINUS, memLen(src)), src), src);
  const growAssign = loc(new AssignNode(yulmem(src), loc(new BytesConcatNode([yulmem(src), pad]), src)), src);
  const grow = loc(new BranchNode(
    loc(new BinaryOpNode(memLen(src), BinaryOperator.LT, need()), src), loc(new BlockNode([growAssign]), src),
  ), src);
  const head = loc(new SliceNode(yulmem(src), intLit(0n, src), dst()), src);
  const rdSlice = loc(new SliceNode(rd, off, addE(off, len(), src)), src);
  const tail = loc(new SliceNode(yulmem(src), need(), memLen(src)), src);
  const store = loc(new AssignNode(yulmem(src), loc(new BytesConcatNode([head, rdSlice, tail]), src)), src);
  return loc(new BlockNode([declDst, declLen, grow, store]), src);
}

// mload(off) -> uint256(bytes32(__yulmem[off : off+32])). A trailing zero word is appended before slicing so a
// read straddling the written high-water mark returns EVM-faithful zeros (e.g. a full-word mload after an mstore8
// that only grew the buffer by one byte). Yul offset expressions are pure, so lowering twice is safe.
function runtimeMload(offArg: YulExpressionNode, src: YulNode): ExpressionNode {
  yulMemUsed = true;
  const padded = loc(new BytesConcatNode([yulmem(src), newBytes(intLit(32n, src), src)]), src);
  const slice = loc(new SliceNode(padded, lowerValue(offArg), addE(lowerValue(offArg), intLit(32n, src), src)), src);
  return loc(new CastNode(UINT256, loc(new CastNode(BYTES32, slice, false), src), false), src);
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

// grow to cover an arbitrary need expression (mcopy uses this; the store form uses growTo with a named offset).
function growTo2(need: ExpressionNode, src: YulNode): StatementNode {
  const nName = `__yneed_${yulTmpN++}`;
  const n = (): ExpressionNode => loc(new IdentifierNode(nName), src);
  const decl = loc(new VariableDefinitionNode(UINT256, [], nName, need), src);
  const cond = loc(new BinaryOpNode(memLen(src), BinaryOperator.LT, n()), src);
  const pad = newBytes(loc(new BinaryOpNode(n(), BinaryOperator.MINUS, memLen(src)), src), src);
  const grow = loc(new AssignNode(yulmem(src), loc(new BytesConcatNode([yulmem(src), pad]), src)), src);
  return loc(new BlockNode([decl, loc(new BranchNode(cond, loc(new BlockNode([grow]), src)), src)]), src);
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
      const slot = currentVarSlot.get(expr.base);
      if (slot !== undefined) return intLit(slot, expr);
      throw new YulNotLowerable();
    }
    if (expr.members.length > 0) throw new YulNotLowerable(); // `.offset` / `.length` are calldata (later phase)
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
    const code = loc(new FieldAccessNode(lowerValue(args[0]), 'code'), call);
    return loc(new CastNode(UINT256, loc(new UnaryOpNode(UnaryOperator.SIZE, code), call), false), call);
  }
  // selfbalance() -> address(this).balance: the satoshis this contract controls, summed over the inputs locked to
  // its own bytecode (`this` = tx.inputs[activeInputIndex].lockingBytecode). Cast to a uint256 word. (balance(addr)
  // and address() are deliberately NOT lowered - a BCH address is variable-length locking bytecode, so an arbitrary
  // 20-byte word is not a valid address; only `this` is a genuine one.)
  if (name === 'selfbalance' && args.length === 0) {
    const thisLbc = loc(new UnaryOpNode(UnaryOperator.INPUT_LOCKING_BYTECODE,
      loc(new NullaryOpNode(NullaryOperator.INPUT_INDEX), call)), call);
    const thisAddr = loc(new CastNode(new AddressType(false), thisLbc, false), call);
    return loc(new CastNode(UINT256, loc(new FieldAccessNode(thisAddr, 'balance'), call), false), call);
  }
  if (name in ARITH_OPS && args.length === 2) {
    return loc(new BinaryOpNode(lowerValue(args[0]), ARITH_OPS[name], lowerValue(args[1])), call);
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
    throw new YulNotLowerable(); // selector region / non-aligned offset / non-int param (later phase)
  }
  // sload(slot) -> the word at that storage slot (a single var, or the combined packed sub-word vars), or the
  // synthesized __evm_storage[slot] register entry for an arbitrary (non-declared) slot.
  if (name === 'sload' && args.length === 1) {
    const fields = resolveSlotFields(args[0]);
    if (fields) return combineSlot(fields, call);
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
  // erc7201(id) - the ERC-7201 namespaced storage-slot dialect builtin. No EVM storage layout on BCH; alias it to
  // sha256(id), reusing the non-assembly erc7201() alias. Not byte-identical to Ethereum's keccak-based erc7201.
  if (name === 'erc7201' && args.length === 1) {
    if (!warnedErc7201Yul) {
      console.log('Warning: the erc7201 Yul builtin is not supported in SolidCash (no EVM storage layout); it is '
        + 'aliased to sha256(...). The result differs from Ethereum ERC-7201 and must not be relied on cross-chain.');
      warnedErc7201Yul = true;
    }
    const sha = loc(new FunctionCallNode(loc(new IdentifierNode('sha256'), call), [lowerValue(args[0])]), call);
    return loc(new CastNode(UINT256, sha, false), call); // erc7201 yields a storage-slot uint256, not bytes32
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

function lowerStatement(stmt: YulStatementNode): StatementNode {
  if (stmt instanceof YulBlockNode) return lowerBlock(stmt);

  if (stmt instanceof YulVariableDeclarationNode) {
    if (stmt.names.length !== 1) throw new YulNotLowerable(); // multi-value `let x, y := f()` (later)
    // `let buf := mload(0x40)` allocates a fresh free-memory byte buffer; track its mstore writes, emit nothing.
    // In the runtime path there is no compile-time buffer - it lowers to a real `mload(0x40)` read (the free
    // pointer stored at slot 0x40), so `buf` holds the allocation base as a runtime value.
    if (!runtimeMem && isFreeMemPtr(stmt.value)) {
      bufferWrites.set(stmt.names[0], []);
      return loc(new BlockNode([]), stmt);
    }
    // `let ok := call/staticcall/delegatecall(...)` -> a low-level call binding (reuses the external-call covenant).
    if (isLowLevelCall(stmt.value)) return lowerLowLevelCall(stmt.value, stmt.names[0], true, stmt);
    const expr = stmt.value ? lowerValue(stmt.value) : undefined;
    return loc(new VariableDefinitionNode(UINT256, [], stmt.names[0], expr), stmt);
  }

  if (stmt instanceof YulAssignmentNode) {
    if (stmt.paths.length !== 1 || stmt.paths[0].members.length > 0) throw new YulNotLowerable();
    const name = stmt.paths[0].base;
    // `ok := call/staticcall/delegatecall(...)` -> a low-level call binding onto the existing var.
    if (isLowLevelCall(stmt.value)) return lowerLowLevelCall(stmt.value, name, false, stmt);
    const target = loc(new IdentifierNode(name), stmt);
    let value = lowerValue(stmt.value);
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
    const t = currentVars.get(name);
    const isWord = t instanceof IntType && !t.signed && t.bits === 256;
    if (t instanceof ValueType) {
      value = loc(new CastNode(t.underlyingType, value, false), stmt);
      value = loc(new CastNode(t, value, false), stmt);
    } else if (t && !isWord) {
      value = loc(new CastNode(t, value, false), stmt);
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
        const fields = resolveSlotFields(e.args[0]);
        if (fields) return decomposeSlot(fields, e.args[1], e);
        const key = evmStorageSlotKey(e.args[0]);
        if (key) {
          evmStorageUsed = true;
          return loc(new MappingAssignNode(EVM_STORAGE, [key], lowerValue(e.args[1])), e);
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
      if (e.name === 'return' && e.args.length === 2 && e.args.every(isIntLiteral)) {
        const [ptr, size] = e.args.map((a) => BigInt((a as YulLiteralNode).raw));
        if (size === 32n) {
          const word = memory.get(ptr);
          if (word !== undefined) return loc(new ReturnNode([lowerValue(word)]), stmt);
        }
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
    const cond = loc(new BinaryOpNode(lowerValue(node.expression), BinaryOperator.EQ, lowerValue(c.value)), c);
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

// Inline every local Yul function whose body is self-contained (no nested def, no `leave`, calls no local fn, at
// most one return). If any definition is not, the block is left for the diagnostic to report.
function inlineLocalYulFunctions(block: YulBlockNode): YulBlockNode {
  const defs = new Map<string, YulFunctionDefinitionNode>();
  for (const s of block.statements) if (s instanceof YulFunctionDefinitionNode) defs.set(s.name, s);
  if (defs.size === 0) return block;
  const names = new Set(defs.keys());
  for (const d of defs.values()) {
    if (yulBodyUsesLocalFns(d.body, names)) return block; // recursion / nested definition / leave
  }
  block.statements = inlineYulStmts(block.statements, defs);
  return block;
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
    computeStorageLayout(node.stateVariables);
    evmStorageUsed = false;
    logEventUsed = false;
    const result = super.visitContract(node) as ContractNode;
    // Synthesize the EVM-storage register if any assembly routed a slot to it (docs/evm-storage-parity.md).
    if (evmStorageUsed && !result.collections.some((c) => c.name === EVM_STORAGE)) {
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
    currentVarSlot = new Map();
    return result;
  }

  // Track the current function's parameters so calldataload/calldatasize can resolve against them.
  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    currentParams = node.parameters;
    currentVars = new Map();
    currentVarValues = new Map();
    bufferWrites = new Map();
    functionYulMemUsed = false;
    for (const p of node.parameters) currentVars.set(p.name, p.type);
    collectVarTypes(node.body, currentVars);
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
    currentParams = [];
    currentVars = new Map();
    currentVarValues = new Map();
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
