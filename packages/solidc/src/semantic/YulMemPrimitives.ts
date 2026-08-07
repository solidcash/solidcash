import { BytesType, IntType, PrimitiveType, Type, ValueType } from '@solidcash/utils';
import {
  Node,
  AssignNode,
  BinaryOpNode,
  UnaryOpNode,
  CastNode,
  SliceNode,
  BytesConcatNode,
  NewArrayNode,
  IntLiteralNode,
  IdentifierNode,
  BranchNode,
  BlockNode,
  StatementNode,
  ExpressionNode,
  FunctionCallNode,
} from '../ast/AST.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import { GlobalFunction } from '../ast/Globals.js';

// Shared lowering of the one function-scoped `__yulmem` linear-memory buffer, used by BOTH the high-level memory
// model (LowerMemoryModel) and the Yul runtime-memory lowering (LowerInlineAssembly). Both address ONE buffer with
// EVM-faithful layout (reserved region 0x00-0x7f, free-memory pointer at slot 0x40, objects from 0x80); this module
// is the single source of truth for what a word/byte store, a word load, the reserved init, and a grow lower to, so
// the two passes can no longer drift. Words are 32-byte BCH-native little-endian (bytes32(uint), low byte at index
// 0; see docs/platform-differences.md).
//
// Location stamping is deferred to the caller via the optional `src`: LowerInlineAssembly stamps every fresh node as
// it builds (pass `src`), LowerMemoryModel builds unstamped and stamps the whole subtree afterward with its outer
// `at()` (omit `src`). Either way every emitted node carries a location, which the optimizer's source-map merge
// requires. Off operands are passed as factories (`() => expr`) because each is consumed more than once (head slice
// end + tail slice start): the high-level side clones the address expression, the Yul side re-references a temp.
export const YULMEM = '__yulmem';
export const MEM_WORD = 32n;

type Src = { location?: Node['location'] } | undefined;
type OffFactory = () => ExpressionNode;

// Stamp a FRESH node's location from `src` when provided (LowerInlineAssembly convention); a no-op when omitted, so
// LowerMemoryModel's recursive outer stamp fills it in. Never called on passed-in operands (they keep their own).
function stamp<T extends { location?: Node['location'] }>(node: T, src: Src): T {
  if (src !== undefined) node.location = src.location;
  return node;
}

function intLit(value: bigint, src: Src): IntLiteralNode {
  return stamp(new IntLiteralNode(value), src);
}

function add(l: ExpressionNode, r: ExpressionNode, src: Src): ExpressionNode {
  return stamp(new BinaryOpNode(l, BinaryOperator.PLUS, r), src);
}

// Encode a numeric word in the runtime model's BCH-native little-endian order. Fixed bytes remain byte sequences
// (important when a memory string is serialized). Signed/generic integers retain their 32-byte sign-magnitude
// marker; bounded unsigned words use a 33rd sign pad for top-bit-set uint256 values, then trim that pad.
function rawWordBytes(value: ExpressionNode, src?: Src): ExpressionNode {
  if (value.type instanceof BytesType && value.type.bound === Number(MEM_WORD)) {
    return value;
  }
  const width = (value.type instanceof IntType && value.type.signed) || value.type === PrimitiveType.INT
    ? MEM_WORD : MEM_WORD + 1n;
  const wide = stamp(new FunctionCallNode(
    stamp(new IdentifierNode(GlobalFunction.TO_PADDED_BYTES), src),
    [value, intLit(width, src)],
  ), src);
  return width === MEM_WORD ? wide : stamp(new SliceNode(
    wide, intLit(0n, src), intLit(MEM_WORD, src),
  ), src);
}

// The `__yulmem` identifier.
export function memId(src?: Src): IdentifierNode {
  return stamp(new IdentifierNode(YULMEM), src);
}

// `__yulmem.length` - the current high-water mark of the buffer.
export function memLen(src?: Src): ExpressionNode {
  return stamp(new UnaryOpNode(UnaryOperator.SIZE, memId(src)), src);
}

// `new bytes(size)` - a zero-filled byte run (buffer growth / reserved padding).
export function memZeroBytes(size: ExpressionNode, src?: Src): NewArrayNode {
  const arr = stamp(new NewArrayNode(new BytesType(1), size), src);
  arr.rawBytes = true;
  arr.type = new BytesType();
  return arr;
}

// The 128-byte EVM reserved region: scratch 0x00-0x3f, the free-memory pointer value 0x80 stored at slot 0x40, and
// the zero slot 0x60-0x7f. So `mload(0x40)` reads 0x80 (the first allocation offset).
export function memReservedInit(src?: Src): BytesConcatNode {
  const init = stamp(new BytesConcatNode([
    memZeroBytes(intLit(0x40n, src), src),
    rawWordBytes(intLit(0x80n, src), src),
    memZeroBytes(intLit(0x20n, src), src),
  ]), src);
  init.type = new BytesType();
  return init;
}

// mstore(off, val): splice the 32-byte little-endian word (bytes32(val)) in place at off. Assumes the buffer already
// covers [off, off+32) - the Yul side prepends memGrowTo, the high-level side pre-grows on allocation.
export function memWordStore(off: OffFactory, val: ExpressionNode, src?: Src): AssignNode {
  const head = stamp(new SliceNode(memId(src), intLit(0n, src), off()), src);
  const word = rawWordBytes(val, src);
  const tail = stamp(new SliceNode(memId(src), add(off(), intLit(MEM_WORD, src), src), memLen(src)), src);
  return stamp(new AssignNode(memId(src), stamp(new BytesConcatNode([head, word, tail]), src)), src);
}

// mload(off) -> decodeType(bytes32(__yulmem[off : off+32])). `pad` appends a trailing zero word before slicing so a
// read straddling the written high-water mark returns zeros (the Yul side, where offsets are arbitrary); the
// high-level side reads only allocated slots so it omits the pad. `decodeType` is the element type (uint256 for a
// raw Yul word, or the array/field element type for a typed high-level read).
export function memWordLoad(off: OffFactory, opts: { pad?: boolean; decodeType: Type }, src?: Src): ExpressionNode {
  const base = opts.pad
    ? stamp(new BytesConcatNode([memId(src), memZeroBytes(intLit(MEM_WORD, src), src)]), src)
    : memId(src);
  const slice = stamp(new SliceNode(base, off(), add(off(), intLit(MEM_WORD, src), src)), src);
  const raw = stamp(new CastNode(new BytesType(), slice, false), src);
  return stamp(new CastNode(opts.decodeType, raw, false), src);
}

// mstore8(off, val): splice val's low byte in place at off. The two encodings live here (single home of the
// byte-write formula): `fullWord` (a Yul mstore8 on an arbitrary 256-bit word) takes rawWord(val)[0:1] - the low
// byte under BCH little-endian word order, valid for any word; otherwise (a high-level byte-typed value in [0,255])
// bytes1(val), which is cheaper but would OP_NUM2BIN-overflow for a value >= 256. Callers pick by domain, not
// duplicate the encoding.
export function memByteStore(off: OffFactory, val: ExpressionNode, opts: { fullWord: boolean }, src?: Src): AssignNode {
  const byteExpr = opts.fullWord
    ? stamp(new SliceNode(rawWordBytes(val, src), intLit(0n, src), intLit(1n, src)), src)
    : stamp(new CastNode(new BytesType(1), val, false), src);
  const head = stamp(new SliceNode(memId(src), intLit(0n, src), off()), src);
  const tail = stamp(new SliceNode(memId(src), add(off(), intLit(1n, src), src), memLen(src)), src);
  return stamp(new AssignNode(memId(src), stamp(new BytesConcatNode([head, byteExpr, tail]), src)), src);
}

// `if (__yulmem.length < need) __yulmem = bytes.concat(__yulmem, new bytes(need - __yulmem.length));` - grow the
// buffer to cover `need` bytes. `need` is a factory (referenced by the guard and the pad size).
export function memGrowTo(need: OffFactory, src?: Src): StatementNode {
  const cond = stamp(new BinaryOpNode(memLen(src), BinaryOperator.LT, need()), src);
  const pad = memZeroBytes(stamp(new BinaryOpNode(need(), BinaryOperator.MINUS, memLen(src)), src), src);
  const grow = stamp(new AssignNode(memId(src), stamp(new BytesConcatNode([memId(src), pad]), src)), src);
  return stamp(new BranchNode(cond, stamp(new BlockNode([grow]), src)), src);
}

// Re-exported so callers can build the element decode type inline (int element keeps its type; anything else reads
// back as a raw 256-bit word).
export function wordDecodeType(elemType: Type): Type {
  if (elemType instanceof IntType) return elemType;
  if (elemType instanceof ValueType && elemType.underlyingType instanceof IntType) return elemType.underlyingType;
  return new IntType(false, 256);
}
