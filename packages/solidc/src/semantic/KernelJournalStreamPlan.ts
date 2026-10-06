import {
  ArrayAccessNode, ArrayAssignNode, AssignNode, BinaryOpNode, BlockNode, FunctionDefinitionNode, IdentifierNode,
  IntLiteralNode, MappingAssignNode, NewArrayNode, Node, VariableDefinitionNode, WhileNode,
  type KernelJournalStreamExecutionCoordinate, type KernelJournalStreamPlan,
} from '../ast/AST.js';
import { BinaryOperator } from '../ast/Operator.js';

const skippedLinks = new Set([
  'definition', 'functionReference', 'resolvedFunction', 'symbolTable', 'referencedContract',
  'stateVariable', 'collection', 'type', 'location',
]);

const identifierName = (node: Node | undefined): string | undefined =>
  node instanceof IdentifierNode ? node.name : undefined;

const isIncrement = (statement: Node | undefined, counter: string): boolean =>
  statement instanceof AssignNode
  && statement.identifier.name === counter
  && statement.expression instanceof BinaryOpNode
  && statement.expression.operator === BinaryOperator.PLUS
  && identifierName(statement.expression.left) === counter
  && statement.expression.right instanceof IntLiteralNode
  && statement.expression.right.value === 1n;

/**
 * Build a names-free execution coordinate table. Statement paths describe executable nesting; preorder is a
 * stable compiler ordinal for nodes within a statement. The resolver uses names transiently while reading the
 * source AST, but no spelling crosses this boundary into the returned plan.
 */
const coordinatesFor = (root: BlockNode): Map<Node, KernelJournalStreamExecutionCoordinate> => {
  const coordinates = new Map<Node, KernelJournalStreamExecutionCoordinate>();
  const seen = new WeakSet<object>();
  let preorder = 0;
  const visit = (node: Node, statementPath: readonly number[]): void => {
    if (seen.has(node)) return;
    seen.add(node);
    coordinates.set(node, { statementPath: [...statementPath], preorder: preorder++ });
    if (node instanceof BlockNode) {
      for (const [index, statement] of (node.statements ?? []).entries()) visit(statement, [...statementPath, index]);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (skippedLinks.has(key)) continue;
      if (value instanceof BlockNode) {
        visit(value, statementPath);
      } else if (value instanceof Node) visit(value, statementPath);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) visit(item, statementPath);
    }
  };
  visit(root, []);
  return coordinates;
};

const walk = (root: Node, visit: (node: Node) => void): void => {
  const seen = new WeakSet<object>();
  const descend = (node: Node): void => {
    if (seen.has(node)) return;
    seen.add(node);
    visit(node);
    for (const [key, value] of Object.entries(node)) {
      if (skippedLinks.has(key)) continue;
      if (value instanceof Node) descend(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) descend(item);
    }
  };
  descend(root);
};

const arrayKeyComponents = (write: MappingAssignNode, arrayName: string): number[] => {
  const result: number[] = [];
  for (const [component, key] of write.keys.entries()) {
    let found = false;
    walk(key, (candidate) => {
      if (candidate instanceof ArrayAccessNode && identifierName(candidate.array) === arrayName) found = true;
    });
    if (found) result.push(component);
  }
  return result;
};

const producerWriteFor = (loop: WhileNode, arrayName: string, allocationSize: string): ArrayAssignNode | undefined => {
  if (!(loop.condition instanceof BinaryOpNode) || loop.condition.operator !== BinaryOperator.LT
    || identifierName(loop.condition.left) === undefined
    || identifierName(loop.condition.right) !== allocationSize) return undefined;
  const counter = identifierName(loop.condition.left)!;
  const statements = loop.block.statements ?? [];
  const write = statements[0];
  return statements.length === 2 && write instanceof ArrayAssignNode && write.name === arrayName
    && identifierName(write.index) === counter && isIncrement(statements[1], counter) ? write : undefined;
};

/**
 * Collect exact source allocation -> producer-write -> mapping-key-consumer edges for later journal protocol
 * design. It is intentionally inert: ambiguous flow produces no edge, and callers must not consult it for
 * admission or emitted routes.
 */
export function planKernelJournalStreams(fn: FunctionDefinitionNode): void {
  if (!fn.body || fn.messageBusKernelJournalStreamPlan !== undefined) return;
  const coordinates = coordinatesFor(fn.body);
  const allocations: Array<{ ordinal: number; node: VariableDefinitionNode; size: string }> = [];
  let allocationOrdinal = 0;
  walk(fn.body, (node) => {
    if (!(node instanceof VariableDefinitionNode) || !(node.expression instanceof NewArrayNode)) return;
    const size = identifierName(node.expression.size);
    if (size !== undefined) allocations.push({ ordinal: allocationOrdinal, node, size });
    allocationOrdinal += 1;
  });
  const edges: KernelJournalStreamPlan['edges'][number][] = [];
  for (const allocation of allocations) {
    const producers: Array<{ loop: WhileNode; write: ArrayAssignNode }> = [];
    const consumers: Array<{ loop: WhileNode; write: MappingAssignNode; component: number }> = [];
    walk(fn.body, (node) => {
      if (node instanceof WhileNode) {
        const write = producerWriteFor(node, allocation.node.name, allocation.size);
        if (write) producers.push({ loop: node, write });
        walk(node.block, (nested) => {
          if (!(nested instanceof MappingAssignNode)) return;
          for (const component of arrayKeyComponents(nested, allocation.node.name)) {
            consumers.push({ loop: node, write: nested, component });
          }
        });
      }
    });
    // A protocol cannot safely choose among compatible-looking sites. Demand precisely one data-flow edge and
    // preserve source execution order without relying on a source-local variable identity.
    if (producers.length !== 1 || consumers.length !== 1) continue;
    const producer = producers[0];
    const consumer = consumers[0];
    const allocationCoordinate = coordinates.get(allocation.node);
    const producerLoop = coordinates.get(producer.loop);
    const producerWrite = coordinates.get(producer.write);
    const consumerLoop = coordinates.get(consumer.loop);
    const consumerWrite = coordinates.get(consumer.write);
    if (!allocationCoordinate || !producerLoop || !producerWrite || !consumerLoop || !consumerWrite
      || !(allocationCoordinate.preorder < producerWrite.preorder
        && producerWrite.preorder < consumerWrite.preorder)) continue;
    edges.push({
      allocationOrdinal: allocation.ordinal,
      allocation: allocationCoordinate,
      producerLoop,
      producerWrite,
      consumerLoop,
      consumerWrite,
      consumerKeyComponent: consumer.component,
    });
  }
  if (edges.length > 0) fn.messageBusKernelJournalStreamPlan = { version: 1, edges };
}
