import { IntType, BytesType, AddressType, PrimitiveType, ValueType, Type, MappingType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import {
  Node, StatementNode, ExpressionNode, AssemblyStatementNode, BlockNode, VariableDefinitionNode,
  AssignNode, RequireNode, BranchNode, WhileNode, BreakNode, ContinueNode, BinaryOpNode, UnaryOpNode,
  CastNode, IdentifierNode, IntLiteralNode, BoolLiteralNode, ParameterNode, FunctionDefinitionNode,
  StateAssignNode, StateAccessNode, StateVariableNode, ContractNode, BytesConcatNode, FunctionCallNode,
  SliceNode, CollectionNode, MappingAccessNode, MappingAssignNode,
} from '../ast/AST.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import {
  YulBlockNode, YulStatementNode, YulExpressionNode, YulVariableDeclarationNode, YulAssignmentNode,
  YulIfNode, YulSwitchNode, YulForLoopNode, YulExpressionStatementNode, YulBreakNode, YulContinueNode,
  YulFunctionCallNode, YulPathNode, YulLiteralNode, YulLiteralKind,
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

// Record every local declaration's declared type (named returns are already locals here, after
// NamedReturnTransformation). Shadowing is rare; the last write wins, which is fine for assembly lowering.
function collectVarTypes(node: Node, out: Map<string, Type>): void {
  if (node instanceof VariableDefinitionNode) out.set(node.name, node.type);
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

// The synthesized EVM-storage register name. A contract whose assembly touches a slot with NO declared var
// (an arbitrary EVM storage slot, e.g. `sstore(0, v)` with no var at slot 0, or a keccak/sha256-derived slot)
// gets a `mapping(uint256 => uint256) __evm_storage` = the 2^256 slot space; sstore/sload route to it. See
// docs/evm-storage-parity.md. Set while lowering; the mapping is synthesized in visitContract afterward.
const EVM_STORAGE = '__evm_storage';
let evmStorageUsed = false;

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
  return 32; // mapping / array / struct: occupies its own slot
}

function computeStorageLayout(vars: StateVariableNode[]): void {
  currentSlots = new Map();
  currentVarSlot = new Map();
  let slot = 0n;
  let byteOff = 0;
  for (const sv of vars) {
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

// EVM `bytes memory` layout is [length(32)][data...], so `mload(add(ptr, off))` reads the 32-byte word at
// data[off-32 : off]. For a bytes-typed parameter that lowers to a byte slice `bytes32(ptr[off-32 : off])`.
function bytesMemorySlice(memArg: YulExpressionNode): ExpressionNode | undefined {
  if (!(memArg instanceof YulFunctionCallNode) || memArg.name !== 'add' || memArg.args.length !== 2) return undefined;
  const [base, offArg] = memArg.args;
  if (!(base instanceof YulPathNode) || base.members.length > 0 || !isIntLiteral(offArg)) return undefined;
  const param = currentParams.find((p) => p.name === base.base && p.type instanceof BytesType);
  if (!param) return undefined;
  const start = BigInt(offArg.raw) - 32n; // skip the length word
  if (start < 0n) return undefined;
  const slice = loc(
    new SliceNode(loc(new IdentifierNode(base.base), memArg), intLit(start, memArg), intLit(start + 32n, memArg)),
    memArg,
  );
  return loc(new CastNode(BYTES32, slice, false), memArg);
}

// keccak256(p, len): hash the constant region [p, p+len) = the words at p, p+32, ... concatenated. Each word is
// rendered as bytes32 (no-op for a bytes32 value, big-endian for an int) before concatenation.
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
    if (expr.members.length > 0) throw new YulNotLowerable(); // `.slot` / `.offset` are storage (later phase)
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

function lowerLiteral(lit: YulLiteralNode): ExpressionNode {
  switch (lit.kind) {
    case YulLiteralKind.NUMBER:
    case YulLiteralKind.HEX:
      return intLit(BigInt(lit.raw), lit);
    case YulLiteralKind.BOOL:
      return intLit(lit.raw === 'true' ? 1n : 0n, lit);
    default:
      throw new YulNotLowerable(); // string / hex-string literals are bytes (later phase)
  }
}

function lowerCall(call: YulFunctionCallNode): ExpressionNode {
  const { name, args } = call;
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
  // mload(p) -> the word stored at that constant offset (compile-time memory model), or a `bytes memory`
  // slice for the `mload(add(ptr, off))` parameter-reading form.
  if (name === 'mload' && args.length === 1) {
    if (isIntLiteral(args[0])) {
      const v = memory.get(BigInt(args[0].raw));
      if (v !== undefined) return lowerValue(v);
    }
    const slice = bytesMemorySlice(args[0]);
    if (slice) return slice;
    throw new YulNotLowerable(); // uninitialized / dynamic offset
  }
  // keccak256(p, len) -> hash the constant memory region.
  if (name === 'keccak256' && args.length === 2) {
    return lowerKeccak(call);
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
    const expr = stmt.value ? lowerValue(stmt.value) : undefined;
    return loc(new VariableDefinitionNode(UINT256, [], stmt.names[0], expr), stmt);
  }

  if (stmt instanceof YulAssignmentNode) {
    if (stmt.paths.length !== 1 || stmt.paths[0].members.length > 0) throw new YulNotLowerable();
    const name = stmt.paths[0].base;
    const target = loc(new IdentifierNode(name), stmt);
    let value = lowerValue(stmt.value);
    // The assembled value is a 256-bit word; writing it to a narrower var truncates (EVM semantics). Cast to
    // the target's width so the assignment type-checks; a UDVT narrows to its underlying width then re-wraps.
    const t = currentVars.get(name);
    if (t instanceof ValueType) {
      value = loc(new CastNode(t.underlyingType, value, false), stmt);
      value = loc(new CastNode(t, value, false), stmt);
    } else if (t instanceof IntType && t.bits < 256) {
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
      // revert(0, 0): abort with no return data.
      if (e.name === 'revert' && isZeroRevert(e)) {
        return loc(new RequireNode(loc(new BoolLiteralNode(false), stmt)), stmt);
      }
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
      // mstore(p, v): record the word in the compile-time memory model (no emitted statement).
      if (e.name === 'mstore' && e.args.length === 2 && isIntLiteral(e.args[0])) {
        memory.set(BigInt(e.args[0].raw), e.args[1]);
        return loc(new BlockNode([]), stmt);
      }
    }
    throw new YulNotLowerable();
  }

  if (stmt instanceof YulBreakNode) return loc(new BreakNode(), stmt);
  if (stmt instanceof YulContinueNode) return loc(new ContinueNode(), stmt);

  throw new YulNotLowerable(); // leave / function definition
}

function isZeroRevert(call: YulFunctionCallNode): boolean {
  return call.args.length === 2 && call.args.every((a) => isIntLiteral(a) && BigInt(a.raw) === 0n);
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

function lowerBlock(block: YulBlockNode): BlockNode {
  return loc(new BlockNode(block.statements.map(lowerStatement)), block);
}

// Pre-semantic pass: lower supported Yul inline assembly to equivalent main-AST statements, reusing the
// existing codegen (stack model, control flow, type checking). Unsupported Yul is left untouched for the
// inline-assembly diagnostic. Native BCH-ASM (no yulBlock) is unaffected. See docs/yul-inline-assembly.md.
export default class LowerInlineAssembly extends AstTraversal {
  // Track the enclosing contract's state variables so sstore/sload can resolve slot numbers.
  visitContract(node: ContractNode): Node {
    computeStorageLayout(node.stateVariables);
    evmStorageUsed = false;
    const result = super.visitContract(node) as ContractNode;
    // Synthesize the EVM-storage register if any assembly routed a slot to it (docs/evm-storage-parity.md).
    if (evmStorageUsed && !result.collections.some((c) => c.name === EVM_STORAGE)) {
      const mapping = new CollectionNode(new MappingType(UINT256, UINT256), EVM_STORAGE);
      mapping.location = node.location;
      result.collections.push(mapping);
    }
    evmStorageUsed = false;
    currentSlots = new Map();
    currentVarSlot = new Map();
    return result;
  }

  // Track the current function's parameters so calldataload/calldatasize can resolve against them.
  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    currentParams = node.parameters;
    currentVars = new Map();
    for (const p of node.parameters) currentVars.set(p.name, p.type);
    collectVarTypes(node.body, currentVars);
    const result = super.visitFunctionDefinition(node);
    currentParams = [];
    currentVars = new Map();
    return result;
  }

  visitAssemblyStatement(node: AssemblyStatementNode): Node {
    if (!node.yulBlock) return node;
    transientKeys.clear();
    memory.clear();
    try {
      const block = lowerBlock(node.yulBlock);
      // Hoist a zero-init declaration for each transient key used (tload may precede tstore in the block).
      if (transientKeys.size > 0) {
        const decls = [...transientKeys].map(
          ([name, src]) => loc(new VariableDefinitionNode(UINT256, [], name, intLit(0n, src)), src) as StatementNode,
        );
        block.statements = [...decls, ...(block.statements ?? [])];
      }
      return block;
    } catch (e) {
      if (e instanceof YulNotLowerable) return node;
      throw e;
    }
  }
}
