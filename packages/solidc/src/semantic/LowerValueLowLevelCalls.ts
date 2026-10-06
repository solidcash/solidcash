import {
  AssignNode,
  BlockNode,
  BoolLiteralNode,
  ContractNode,
  ExpressionNode,
  FunctionCallNode,
  FunctionDefinitionNode,
  HexLiteralNode,
  IdentifierNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  MethodCallNode,
  Node,
  SourceFileNode,
  StatementNode,
  StringLiteralNode,
  TransferStatementNode,
  TupleAssignmentNode,
  VariableDefinitionNode,
  type CallOptions,
} from '../ast/AST.js';
import { BytesType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { hasEffectiveCallValue } from './branchOps.js';

/** A value-carrying low-level call with no payload: who it pays, and how much. */
interface ValueSend {
  readonly recipient: ExpressionNode;
  readonly value: ExpressionNode;
}

/**
 * Rewrites a value-carrying low-level call with no payload into the send it denotes, under the framed convention.
 *
 * `to.call{value: v}("")` pays `v` to `to`. A send to a P2PKH lock is a listed send the body pins at its output
 * (W2); a value for a contract is a `CALL` into its `receive()`, which the convention does not compose yet, and the
 * listed send's own P2PKH check refuses it. So the call becomes the send `this.transfer(to, v)`, and its result the
 * success an executed send has: a send that cannot pay aborts the transaction rather than returning false. A `gas`
 * option is dropped, since BCH has no gas.
 *
 * A call with a payload, an option other than `value` and `gas`, or a value that is statically zero is left as
 * written, so it keeps its own refusal.
 */
export default class LowerValueLowLevelCalls extends AstTraversal {
  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    return node;
  }

  visitContract(node: ContractNode): Node {
    for (const fn of [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef]) {
      if (fn?.body) fn.body = this.visit(fn.body) as BlockNode;
    }
    return node;
  }

  visitBlock(node: BlockNode): Node {
    node.statements = (node.statements ?? []).flatMap((statement) => {
      const visited = this.visit(statement) as StatementNode;
      return this.rewriteStatement(visited) ?? [visited];
    });
    return node;
  }

  private rewriteStatement(statement: StatementNode): StatementNode[] | undefined {
    // `to.call{value: v}("");`
    if (statement instanceof LowLevelCallStatementNode) {
      if (statement.callMode !== 'call') return undefined;
      const send = valueSendOf(statement.targetExpression, statement.data, statement.callOptions);
      return send === undefined ? undefined : [transferOf(send, statement)];
    }
    // `(bool ok, bytes data) = to.call{value: v}("");`
    if (statement instanceof TupleAssignmentNode && !statement.tupleExpressions && statement.elements.length === 2) {
      const send = matchValueCall(statement.tuple);
      if (send === undefined) return undefined;
      const results = [(): ExpressionNode => located(new BoolLiteralNode(true), statement), (): ExpressionNode => {
        const empty = located(new HexLiteralNode(new Uint8Array(0)), statement);
        empty.type = new BytesType();
        return empty;
      }];
      const lowered: StatementNode[] = [transferOf(send, statement)];
      statement.elements.forEach((element, index) => {
        if (element.skip) return;
        if (element.existing) {
          lowered.push(located(new AssignNode(located(new IdentifierNode(element.name!), statement), results[index]!()),
            statement));
          return;
        }
        lowered.push(located(new VariableDefinitionNode(element.type!, [], element.name!, results[index]!()), statement));
      });
      return lowered;
    }
    return undefined;
  }
}

/** The send a value-carrying call expression denotes, in any of the spellings a receiver parses as. */
function matchValueCall(expression: ExpressionNode | undefined): ValueSend | undefined {
  if (expression instanceof LowLevelCallNode && expression.callMode === 'call') {
    return valueSendOf(expression.targetExpression, expression.data, expression.callOptions);
  }
  if (expression instanceof MethodCallNode && expression.methodName === 'call' && expression.parameters.length === 1) {
    return valueSendOf(expression.object, expression.parameters[0]!, expression.callOptions);
  }
  // A simple identifier receiver parses as a namespaced call (`to.call{value: v}("")`).
  if (expression instanceof FunctionCallNode && expression.parameters.length === 1) {
    const name = expression.identifier.name;
    const dot = name.lastIndexOf('.');
    if (dot < 0 || name.slice(dot + 1) !== 'call' || name.slice(0, dot).includes('.')) return undefined;
    const recipient = located(new IdentifierNode(name.slice(0, dot)), expression);
    return valueSendOf(recipient, expression.parameters[0]!, expression.callOptions);
  }
  return undefined;
}

/** The send a call with these parts denotes: an effective value, no option but `value` and `gas`, no payload. */
function valueSendOf(
  recipient: ExpressionNode,
  payload: ExpressionNode,
  options: CallOptions | undefined,
): ValueSend | undefined {
  if (options === undefined || options.salt !== undefined || !hasEffectiveCallValue(options.value)) return undefined;
  const empty = (payload instanceof StringLiteralNode && payload.value.length === 0
      && (payload.solidityBytes === undefined || payload.solidityBytes.length === 0))
    || (payload instanceof HexLiteralNode && payload.value.length === 0);
  return empty ? { recipient, value: options.value } : undefined;
}

/** `this.transfer(recipient, value)`, at the call's own source location. */
function transferOf(send: ValueSend, at: Node): TransferStatementNode {
  return located(new TransferStatementNode(send.recipient, send.value), at);
}

/** A synthesized node, located where the source it replaces was. */
function located<T extends Node>(node: T, at: Node): T {
  node.location = at.location;
  return node;
}
