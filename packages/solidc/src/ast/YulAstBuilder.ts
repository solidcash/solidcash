import { ParserRuleContext } from 'antlr4';
import {
  YulBlockContext, YulStatementContext, YulNestedBlockStmtContext, YulVarDeclStmtContext,
  YulAssignStmtContext, YulIfStmtContext, YulSwitchStmtContext, YulForStmtContext,
  YulFunctionDefStmtContext, YulBreakStmtContext, YulContinueStmtContext, YulLeaveStmtContext,
  YulCallStmtContext, YulPathStmtContext, YulLiteralStmtContext, YulVariableDeclarationContext,
  YulAssignmentContext, YulIfContext, YulSwitchContext, YulCaseContext, YulForLoopContext,
  YulFunctionDefinitionContext, YulExpressionContext, YulFunctionCallContext, YulPathContext,
  YulLiteralContext,
} from '../grammar/SolidCashParser.js';
import { Location } from './Location.js';
import {
  YulBlockNode, YulStatementNode, YulVariableDeclarationNode, YulAssignmentNode, YulIfNode,
  YulSwitchNode, YulCaseNode, YulForLoopNode, YulFunctionDefinitionNode, YulBreakNode,
  YulContinueNode, YulLeaveNode, YulExpressionStatementNode, YulExpressionNode,
  YulFunctionCallNode, YulPathNode, YulLiteralNode, YulLiteralKind,
} from './YulAST.js';

function loc<T extends { location?: Location }>(node: T, ctx: ParserRuleContext): T {
  node.location = Location.fromCtx(ctx);
  return node;
}

export function buildYulBlock(ctx: YulBlockContext): YulBlockNode {
  return loc(new YulBlockNode(ctx.yulStatement_list().map(buildYulStatement)), ctx);
}

function buildYulStatement(ctx: YulStatementContext): YulStatementNode {
  if (ctx instanceof YulNestedBlockStmtContext) return buildYulBlock(ctx.yulBlock());
  if (ctx instanceof YulVarDeclStmtContext) return buildYulVariableDeclaration(ctx.yulVariableDeclaration());
  if (ctx instanceof YulAssignStmtContext) return buildYulAssignment(ctx.yulAssignment());
  if (ctx instanceof YulIfStmtContext) return buildYulIf(ctx.yulIf());
  if (ctx instanceof YulSwitchStmtContext) return buildYulSwitch(ctx.yulSwitch());
  if (ctx instanceof YulForStmtContext) return buildYulForLoop(ctx.yulForLoop());
  if (ctx instanceof YulFunctionDefStmtContext) return buildYulFunctionDefinition(ctx.yulFunctionDefinition());
  if (ctx instanceof YulBreakStmtContext) return loc(new YulBreakNode(), ctx);
  if (ctx instanceof YulContinueStmtContext) return loc(new YulContinueNode(), ctx);
  if (ctx instanceof YulLeaveStmtContext) return loc(new YulLeaveNode(), ctx);
  if (ctx instanceof YulCallStmtContext) {
    return loc(new YulExpressionStatementNode(buildYulFunctionCall(ctx.yulFunctionCall())), ctx);
  }
  if (ctx instanceof YulPathStmtContext) {
    return loc(new YulExpressionStatementNode(buildYulPath(ctx.yulPath())), ctx);
  }
  if (ctx instanceof YulLiteralStmtContext) {
    return loc(new YulExpressionStatementNode(buildYulLiteral(ctx.yulLiteral())), ctx);
  }
  throw new Error('Unknown Yul statement context');
}

function buildYulVariableDeclaration(ctx: YulVariableDeclarationContext): YulVariableDeclarationNode {
  const names = ctx.yulIdentifier_list().map((t) => t.getText());
  const valueCtx = ctx.yulExpression();
  return loc(new YulVariableDeclarationNode(names, valueCtx ? buildYulExpression(valueCtx) : undefined), ctx);
}

function buildYulAssignment(ctx: YulAssignmentContext): YulAssignmentNode {
  const paths = ctx.yulPath_list().map(buildYulPath);
  return loc(new YulAssignmentNode(paths, buildYulExpression(ctx.yulExpression())), ctx);
}

function buildYulIf(ctx: YulIfContext): YulIfNode {
  return loc(new YulIfNode(buildYulExpression(ctx.yulExpression()), buildYulBlock(ctx.yulBlock())), ctx);
}

function buildYulSwitch(ctx: YulSwitchContext): YulSwitchNode {
  const expr = buildYulExpression(ctx.yulExpression());
  const cases = ctx.yulCase_list().map(buildYulCase);
  const defaultCtx = ctx.yulDefault();
  const defaultBody = defaultCtx ? buildYulBlock(defaultCtx.yulBlock()) : undefined;
  return loc(new YulSwitchNode(expr, cases, defaultBody), ctx);
}

function buildYulCase(ctx: YulCaseContext): YulCaseNode {
  return loc(new YulCaseNode(buildYulLiteral(ctx.yulLiteral()), buildYulBlock(ctx.yulBlock())), ctx);
}

function buildYulForLoop(ctx: YulForLoopContext): YulForLoopNode {
  const blocks = ctx.yulBlock_list(); // grammar order: [pre, post, body]
  return loc(new YulForLoopNode(
    buildYulBlock(blocks[0]),
    buildYulExpression(ctx.yulExpression()),
    buildYulBlock(blocks[1]),
    buildYulBlock(blocks[2]),
  ), ctx);
}

// `function name(params) -> returns { body }`. yulIdentifier_list() flattens [name, ...params, ...returns]; split
// params from returns at the `->` token's position (the grammar has no separate accessor for either list).
function buildYulFunctionDefinition(ctx: YulFunctionDefinitionContext): YulFunctionDefinitionNode {
  const idTerminals = ctx.yulIdentifier_list();
  const name = idTerminals[0]?.getText() ?? '';
  let arrowPos = Infinity;
  for (const child of ctx.children ?? []) {
    if (child.getText() === '->') { arrowPos = (child as unknown as { symbol: { start: number } }).symbol.start; break; }
  }
  const params: string[] = [];
  const returns: string[] = [];
  for (let i = 1; i < idTerminals.length; i += 1) {
    const t = idTerminals[i];
    if (t.start.start > arrowPos) returns.push(t.getText());
    else params.push(t.getText());
  }
  return loc(new YulFunctionDefinitionNode(name, params, returns, buildYulBlock(ctx.yulBlock())), ctx);
}

function buildYulExpression(ctx: YulExpressionContext): YulExpressionNode {
  const call = ctx.yulFunctionCall();
  if (call) return buildYulFunctionCall(call);
  const path = ctx.yulPath();
  if (path) return buildYulPath(path);
  return buildYulLiteral(ctx.yulLiteral());
}

function buildYulFunctionCall(ctx: YulFunctionCallContext): YulFunctionCallNode {
  const name = ctx.yulFunctionName().getText();
  return loc(new YulFunctionCallNode(name, ctx.yulExpression_list().map(buildYulExpression)), ctx);
}

function buildYulPath(ctx: YulPathContext): YulPathNode {
  // Walk children in order so `.length` (a single DotLength token) is captured as a member alongside the
  // `.` + anyIdentifier members (`.offset`, `.slot`). Skip the bare `.` separators.
  const parts: string[] = [];
  for (const child of ctx.children ?? []) {
    const t = child.getText();
    if (t === '.') continue;
    parts.push(t === '.length' ? 'length' : t);
  }
  return loc(new YulPathNode(parts[0], parts.slice(1)), ctx);
}

function buildYulLiteral(ctx: YulLiteralContext): YulLiteralNode {
  if (ctx.NumberLiteral()) return loc(new YulLiteralNode(YulLiteralKind.NUMBER, ctx.NumberLiteral().getText()), ctx);
  if (ctx.HexLiteral()) return loc(new YulLiteralNode(YulLiteralKind.HEX, ctx.HexLiteral().getText()), ctx);
  if (ctx.HexStringLiteral()) {
    return loc(new YulLiteralNode(YulLiteralKind.HEXSTRING, ctx.HexStringLiteral().getText()), ctx);
  }
  if (ctx.StringLiteral()) return loc(new YulLiteralNode(YulLiteralKind.STRING, ctx.StringLiteral().getText()), ctx);
  return loc(new YulLiteralNode(YulLiteralKind.BOOL, ctx.BooleanLiteral().getText()), ctx);
}
