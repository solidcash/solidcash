import {
  ArrayAccessNode, ArrayAssignNode, AssignNode, BinaryOpNode, BlockNode, FunctionDefinitionNode,
  IdentifierNode, IntLiteralNode, MappingAssignNode, NewArrayNode, Node, VariableDefinitionNode, WhileNode,
  MessageBusConstructedKeyVectorProofProgram,
} from '../ast/AST.js';
import { BinaryOperator } from '../ast/Operator.js';
import { cloneNode } from '../ast/clone.js';

const skippedLinks = new Set([
  'definition', 'functionReference', 'resolvedFunction', 'symbolTable', 'referencedContract',
  'stateVariable', 'collection', 'type', 'location',
]);

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

const identifierName = (node: Node | undefined): string | undefined =>
  node instanceof IdentifierNode ? node.name : undefined;

const sourceIdentityOf = (fn: FunctionDefinitionNode): string => {
  const signature = `${fn.name}(${fn.parameters
    .filter((parameter) => !parameter.name.startsWith('__internal__'))
    .map((parameter) => parameter.type.toString()).join(',')})`;
  const location = fn.location;
  const file = location?.sourceFileId ?? '<root>';
  const span = location ? `${location.start.line}:${location.start.column}-${location.end.line}:${location.end.column}` : '<synthetic>';
  return `${file}\u0000${signature}\u0000${span}`;
};

const isIncrement = (statement: Node | undefined, counter: string): boolean =>
  statement instanceof AssignNode
  && statement.identifier.name === counter
  && statement.expression instanceof BinaryOpNode
  && statement.expression.operator === BinaryOperator.PLUS
  && identifierName(statement.expression.left) === counter
  && statement.expression.right instanceof IntLiteralNode
  && statement.expression.right.value === 1n;

const isFullProducerLoop = (loop: WhileNode, arrayName: string, allocationSize: string): boolean => {
  if (!(loop.condition instanceof BinaryOpNode) || loop.condition.operator !== BinaryOperator.LT
    || identifierName(loop.condition.left) === undefined
    || identifierName(loop.condition.right) !== allocationSize) return false;
  const counter = identifierName(loop.condition.left)!;
  const statements = loop.block.statements ?? [];
  if (statements.length !== 2 || !isIncrement(statements[1], counter)) return false;
  const write = statements[0];
  return write instanceof ArrayAssignNode && write.name === arrayName
    && identifierName(write.index) === counter;
};

const isConsumerMappingWrite = (node: Node, arrayName: string): boolean => {
  if (node instanceof ArrayAssignNode) {
    let found = false;
    walk(node.index, (candidate) => {
      if (candidate instanceof ArrayAccessNode && identifierName(candidate.array) === arrayName) found = true;
    });
    return found;
  }
  if (!(node instanceof MappingAssignNode)) return false;
  let found = false;
  for (const key of node.keys) {
    walk(key, (candidate) => {
      if (candidate instanceof ArrayAccessNode && identifierName(candidate.array) === arrayName) found = true;
    });
  }
  return found;
};

/**
 * Capture source provenance before inlining or symbolic-array lowering. This is a deliberately narrow discovery
 * pass: it records only a fresh bounded vector with one canonical full producer loop and a later mapping-key
 * consumer. Admission remains unchanged until descriptor lowering can authenticate this proof program.
 */
export function captureConstructedKeyVectorProvenance(functions: readonly FunctionDefinitionNode[]): void {
  for (const fn of functions) {
    if (!fn.body || fn.messageBusConstructedKeyVectorProofPrograms?.size) continue;
    const identity = sourceIdentityOf(fn);
    fn.messageBusSourceFunctionIdentity = identity;
    const allocations: Array<{ ordinal: number; name: string; size: string }> = [];
    let allocationOrdinal = 0;
    walk(fn.body, (node) => {
      if (!(node instanceof VariableDefinitionNode) || !(node.expression instanceof NewArrayNode)) return;
      const size = identifierName(node.expression.size);
      if (size !== undefined) allocations.push({ ordinal: allocationOrdinal, name: node.name, size });
      allocationOrdinal += 1;
    });
    const candidates: number[] = [];
    for (const allocation of allocations) {
      let producer = false;
      let consumer = false;
      walk(fn.body, (node) => {
        if (node instanceof WhileNode && isFullProducerLoop(node, allocation.name, allocation.size)) producer = true;
        if (isConsumerMappingWrite(node, allocation.name)) consumer = true;
      });
      if (producer && consumer) candidates.push(allocation.ordinal);
    }
    if (candidates.length === 0) continue;
    const sourceParameterTypes = fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'))
      .map((parameter) => parameter.type.toString());
    const proof: MessageBusConstructedKeyVectorProofProgram = {
      version: 1,
      sourceFunctionIdentity: identity,
      sourceFunctionSignature: `${fn.name}(${sourceParameterTypes.join(',')})`,
      sourceParameterTypes,
      candidateVectorOrdinals: candidates,
      sourceProgram: cloneNode(fn.body),
    };
    fn.messageBusConstructedKeyVectorProofPrograms = new Map([[identity, proof]]);
    // The late admission gate intentionally still owns eligibility. This marker only avoids losing the fact that
    // an exact source proof exists while later passes replace local-array reads with symbolic expressions.
    fn.messageBusConstructedKeyVectorCandidate = true;
  }
}
