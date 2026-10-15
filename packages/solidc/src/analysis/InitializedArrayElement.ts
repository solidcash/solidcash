import {
  ArrayAccessNode, ArrayAssignNode, ArrayDeleteNode, ArrayPopNode, ArrayPushNode, AssignNode,
  BlockNode, ExpressionNode, FunctionDefinitionNode, IdentifierNode, IntLiteralNode, NewArrayNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import { walkInvocationAst } from './InvocationAnalysis.js';

/**
 * The local a literal-index read belongs to.
 *
 * The array is that local, or the one `new T[](N)` it was copied from. Inlining a helper argument substitutes the
 * allocation into the key (`disallowed[0]` becomes `(new address[](1))[0]`), and N identifies the local when only
 * one allocation of that size exists.
 */
function arrayElementLocal(
  array: ExpressionNode, entry: FunctionDefinitionNode, copies: VariableDefinitionNode[], seen = new Set<string>(),
): string | undefined {
  if (array instanceof IdentifierNode) {
    if (seen.has(array.name)) return undefined;
    seen.add(array.name);
    let initializer: ExpressionNode | undefined;
    let definition: VariableDefinitionNode | undefined;
    let writes = false;
    walkInvocationAst(entry.body, (node) => {
      if (node instanceof VariableDefinitionNode && node.name === array.name) {
        initializer ??= node.expression;
        definition ??= node;
      }
      if (((node instanceof ArrayAssignNode || node instanceof ArrayDeleteNode
        || node instanceof ArrayPushNode || node instanceof ArrayPopNode) && node.name === array.name)
        || (node instanceof AssignNode && node.identifier.name === array.name)) writes = true;
    });
    // An inlined helper copies its argument to a fresh local after the caller filled it. Its unmodified copy
    // reads that filled value, not the zeroed allocation the caller's declaration originally made.
    if (!writes && initializer instanceof IdentifierNode && definition !== undefined) {
      copies.push(definition);
      return arrayElementLocal(initializer, entry, copies, seen);
    }
    return array.name;
  }
  if (!(array instanceof NewArrayNode) || !(array.size instanceof IntLiteralNode)) return undefined;
  const size = array.size.value;
  let name: string | undefined;
  let count = 0;
  walkInvocationAst(entry.body, (node) => {
    if (!(node instanceof VariableDefinitionNode) || !(node.expression instanceof NewArrayNode)) return;
    if (!(node.expression.size instanceof IntLiteralNode) || node.expression.size.value !== size) return;
    count += 1;
    name = node.name;
  });
  return count === 1 ? name : undefined;
}

/**
 * The one value stored at a literal index of a local array, or undefined when that store is not a single assignment.
 *
 * Any other write of the array (another index, a push, a pop, a delete, or a whole-array assign) leaves the element
 * unresolved, so the caller refuses the key rather than hashing a value the body may not still hold.
 */
export function singleLiteralElement(node: ExpressionNode, entry: FunctionDefinitionNode): ExpressionNode | undefined {
  if (!(node instanceof ArrayAccessNode) || !(node.index instanceof IntLiteralNode)) return undefined;
  const copies: VariableDefinitionNode[] = [];
  const name = arrayElementLocal(node.array, entry, copies);
  if (name === undefined) return undefined;
  const index = node.index.value;
  let value: ExpressionNode | undefined;
  let count = 0;
  let store: ArrayAssignNode | undefined;
  let otherWrite = false;
  walkInvocationAst(entry.body, (current) => {
    if (current instanceof ArrayAssignNode && current.name === name) {
      if (current.index instanceof IntLiteralNode && current.index.value === index) {
        count += 1;
        value = current.value;
        store = current;
      } else otherWrite = true;
    } else if ((current instanceof ArrayPushNode || current instanceof ArrayPopNode
      || current instanceof ArrayDeleteNode) && current.name === name) {
      otherWrite = true;
    } else if (current instanceof AssignNode && current.identifier.name === name) otherWrite = true;
  });
  if (otherWrite || count !== 1 || store === undefined) return undefined;
  // The byte vector an argument copy holds must already contain the store. A later store or a write made only
  // on another branch cannot initialize an earlier copy; require it in a preceding statement of a containing block.
  return [node, ...copies].every((copy) => {
    let dominates = false;
    walkInvocationAst(entry.body, (current) => {
      if (!(current instanceof BlockNode)) return;
      const statements = current.statements ?? [];
      const at = statements.indexOf(store!);
      if (at < 0) return;
      statements.slice(at + 1).forEach((following) => {
        walkInvocationAst(following, (child) => { if (child === copy) dominates = true; });
      });
    });
    return dominates;
  }) ? value : undefined;
}
