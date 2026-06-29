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
  const names = ctx.Identifier_list().map((t) => t.getText());
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

// Deferred feature: parsed for a clean diagnostic only; params/returns are not split out here.
function buildYulFunctionDefinition(ctx: YulFunctionDefinitionContext): YulFunctionDefinitionNode {
  const ids = ctx.Identifier_list().map((t) => t.getText());
  return loc(new YulFunctionDefinitionNode(ids[0] ?? '', [], [], buildYulBlock(ctx.yulBlock())), ctx);
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
  const ids = ctx.Identifier_list().map((t) => t.getText());
  return loc(new YulPathNode(ids[0], ids.slice(1)), ctx);
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
