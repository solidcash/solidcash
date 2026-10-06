import { FunctionCallNode, FunctionDefinitionNode, Node, NullaryOpNode } from '../ast/AST.js';
import { NullaryOperator } from '../ast/Operator.js';

const MESSAGE_FIELDS: ReadonlySet<string> = new Set([
  NullaryOperator.MSG_SENDER, NullaryOperator.MSG_VALUE, NullaryOperator.MSG_SIG, NullaryOperator.MSG_DATA,
]);

/**
 * Whether `fn`, or a function it calls by name, reads a field of its own message.
 *
 * `this.f()` is a message call: its `msg.sender` is the contract and its value, data and signature are the call's
 * own. Inlining that call reads the caller's instead, so a call site the framed convention inlines must not be
 * one whose callee reads them.
 */
export function readsMessageField(
  fn: FunctionDefinitionNode,
  lookup: (name: string) => FunctionDefinitionNode | undefined,
  nodesOf: (fn: FunctionDefinitionNode) => readonly Node[],
  seen: Set<FunctionDefinitionNode> = new Set(),
): boolean {
  if (seen.has(fn)) return false;
  seen.add(fn);
  for (const node of nodesOf(fn)) {
    if (node instanceof NullaryOpNode && MESSAGE_FIELDS.has(node.operator)) return true;
    if (!(node instanceof FunctionCallNode) || node.fromThisCall || node.identifier === undefined) continue;
    const callee = lookup(node.identifier.name);
    if (callee !== undefined && readsMessageField(callee, lookup, nodesOf, seen)) return true;
  }
  return false;
}
