import { IntType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import {
  Node, StatementNode, ExpressionNode, AssemblyStatementNode, BlockNode, VariableDefinitionNode,
  AssignNode, RequireNode, BranchNode, WhileNode, BreakNode, ContinueNode, BinaryOpNode, UnaryOpNode,
  CastNode, IdentifierNode, IntLiteralNode, BoolLiteralNode, ParameterNode, FunctionDefinitionNode,
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

// Yul binary builtins -> solidc operators (value `a op b`).
const ARITH_OPS: Record<string, BinaryOperator> = {
  add: BinaryOperator.PLUS, sub: BinaryOperator.MINUS, mul: BinaryOperator.MUL,
  div: BinaryOperator.DIV, sdiv: BinaryOperator.DIV, mod: BinaryOperator.MOD, smod: BinaryOperator.MOD,
  exp: BinaryOperator.POW, and: BinaryOperator.BIT_AND, or: BinaryOperator.BIT_OR, xor: BinaryOperator.BIT_XOR,
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

// Lower a Yul expression in value position to a 256-bit-word (uint256) expression.
function lowerValue(expr: YulExpressionNode): ExpressionNode {
  if (expr instanceof YulLiteralNode) return lowerLiteral(expr);
  if (expr instanceof YulPathNode) {
    if (expr.members.length > 0) throw new YulNotLowerable(); // `.slot` / `.offset` are storage (later phase)
    return loc(new IdentifierNode(expr.base), expr);
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
  // shl(shift, value)=value*2^shift, shr/sar(shift, value)=value/2^shift. Avoids the `<<`/`>>` operators,
  // which require bigint/bytes; staying on uint256 keeps bitwise on the same value valid.
  if ((name === 'shl' || name === 'shr' || name === 'sar') && args.length === 2) {
    const value = lowerValue(args[1]);
    const pow2 = isIntLiteral(args[0])
      ? intLit(2n ** BigInt(args[0].raw), call)
      : loc(new BinaryOpNode(intLit(2n, call), BinaryOperator.POW, lowerValue(args[0])), call);
    return loc(new BinaryOpNode(value, name === 'shl' ? BinaryOperator.MUL : BinaryOperator.DIV, pow2), call);
  }
  if (name in CMP_OPS && args.length === 2) {
    return boolToWord(loc(new BinaryOpNode(lowerValue(args[0]), CMP_OPS[name], lowerValue(args[1])), call), call);
  }
  if (name === 'not' && args.length === 1) {
    return loc(new UnaryOpNode(UnaryOperator.INVERT, lowerValue(args[0])), call);
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
    const target = loc(new IdentifierNode(stmt.paths[0].base), stmt);
    return loc(new AssignNode(target, lowerValue(stmt.value)), stmt);
  }

  if (stmt instanceof YulIfNode) {
    return loc(new BranchNode(lowerCond(stmt.condition), lowerBlock(stmt.body)), stmt);
  }

  if (stmt instanceof YulSwitchNode) return lowerSwitch(stmt);
  if (stmt instanceof YulForLoopNode) return lowerForLoop(stmt);

  if (stmt instanceof YulExpressionStatementNode) {
    const e = stmt.expression;
    // The only supported bare-call statement is `revert(0, 0)` (abort with no return data).
    if (e instanceof YulFunctionCallNode && e.name === 'revert' && isZeroRevert(e)) {
      return loc(new RequireNode(loc(new BoolLiteralNode(false), stmt)), stmt);
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
  // Track the current function's parameters so calldataload/calldatasize can resolve against them.
  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    currentParams = node.parameters;
    const result = super.visitFunctionDefinition(node);
    currentParams = [];
    return result;
  }

  visitAssemblyStatement(node: AssemblyStatementNode): Node {
    if (!node.yulBlock) return node;
    try {
      return lowerBlock(node.yulBlock);
    } catch (e) {
      if (e instanceof YulNotLowerable) return node;
      throw e;
    }
  }
}
