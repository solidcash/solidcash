import {
  ArrayAccessNode, ArrayAssignNode, AssignNode, BinaryOpNode, BlockNode, FunctionDefinitionNode,
  BoolLiteralNode, CastNode, HexLiteralNode, IdentifierNode, IntLiteralNode, MappingAssignNode, NewArrayNode,
  Node, TernaryOpNode, UnaryOpNode, VariableDefinitionNode, WhileNode, type ExternalCallExpression,
  type MessageBusConstructedKeyVectorProofProgram,
} from '../ast/AST.js';
import { BinaryOperator } from '../ast/Operator.js';
import { cloneNode } from '../ast/clone.js';
import { planKernelJournalStreams } from './KernelJournalStreamPlan.js';
import type { ConstructedKeyVectorV1Abi } from '@solidcash/utils';

const replayValueType = (type: string): boolean => /^(?:u?int\d*|bigint|bool|bytes(?:[1-9]|[12]\d|3[0-2]))$/.test(type);
const replayUnaryOperator = new Set(['-', '!']);
const replayBinaryOperator = new Set(['+', '-', '*', '/', '%', '==', '!=', '<', '<=', '>', '>=', '&&', '||']);
const replayIntegerType = (type: string | undefined): boolean => type !== undefined && /^(?:u?int\d*|bigint)$/.test(type);

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
  const match = { found: false };
  for (const key of node.keys) {
    walk(key, (candidate) => {
      if (candidate instanceof ArrayAccessNode && identifierName(candidate.array) === arrayName) match.found = true;
    });
  }
  return match.found;
};

/**
 * Capture source provenance before inlining or symbolic-array lowering. This is a deliberately narrow discovery
 * pass: it records only a fresh bounded vector with one canonical full producer loop and a later mapping-key
 * consumer. Admission remains unchanged until descriptor lowering can authenticate this proof program.
 */
export function captureConstructedKeyVectorProvenance(functions: readonly FunctionDefinitionNode[]): void {
  for (const fn of functions) {
    // This deliberately precedes candidate capture and route lowering. It is a private source-flow record only:
    // no artifact consumer and no admission gate may use it until a future authenticated journal protocol exists.
    planKernelJournalStreams(fn);
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

/**
 * Project the deliberately tiny, source-owned proof into the public replay ABI.
 *
 * This is intentionally not an admission pass.  The proof survives early lowering so that we can describe a
 * source vector without accepting a lowered symbolic-array recipe as evidence.  If any part of the source
 * program needs a local alias, a call, an unknown control-flow form, or an ambiguous producer/consumer, this
 * returns no descriptor.  In particular, descriptor omission must never make the existing KERNEL_LAYOUT fence
 * disappear.
 */
export function projectConstructedKeyVectorProvenance(functions: readonly FunctionDefinitionNode[]): void {
  for (const fn of functions) {
    const identity = fn.messageBusSourceFunctionIdentity;
    const proof = identity === undefined ? undefined : fn.messageBusConstructedKeyVectorProofPrograms?.get(identity);
    if (!proof || proof.version !== 1 || fn.messageBusConstructedKeyVectorDescriptors !== undefined) continue;
    const descriptors = proof.candidateVectorOrdinals.map((ordinal) => projectVector(fn, proof, ordinal));
    if (descriptors.every((descriptor): descriptor is ConstructedKeyVectorV1Abi => descriptor !== undefined)) {
      fn.messageBusConstructedKeyVectorDescriptors = descriptors;
    }
  }
}

const serializeExpression = (
  expression: Node,
  parameters: readonly string[],
  loopIndex?: string,
): ExternalCallExpression | undefined => {
  if (expression instanceof IdentifierNode) {
    if (expression.name === loopIndex) return { kind: 'source', source: { kind: 'loopIndex' } };
    const index = parameters.indexOf(expression.name);
    return index < 0 ? undefined : { kind: 'source', source: { kind: 'forward', paramIndex: index } };
  }
  if (expression instanceof IntLiteralNode) return { kind: 'literal', type: 'bigint', value: expression.value.toString() };
  if (expression instanceof BoolLiteralNode) return { kind: 'literal', type: 'bool', value: expression.value };
  if (expression instanceof HexLiteralNode) {
    return { kind: 'literal', type: expression.type?.toString() ?? `bytes${expression.value.length}`,
      value: [...expression.value].map((byte) => byte.toString(16).padStart(2, '0')).join('') };
  }
  // The v1 SDK interpreter deliberately has no general cast semantics. A cast-looking source expression may be
  // perfectly valid contract code, but it is not a fully serializable replay proof yet.
  if (expression instanceof CastNode) return undefined;
  if (expression instanceof UnaryOpNode) {
    if (!replayUnaryOperator.has(expression.operator)) return undefined;
    const inner = serializeExpression(expression.expression, parameters, loopIndex);
    return inner && { kind: 'unary', operator: expression.operator, expression: inner };
  }
  if (expression instanceof BinaryOpNode) {
    if (!replayBinaryOperator.has(expression.operator)) return undefined;
    const left = serializeExpression(expression.left, parameters, loopIndex);
    const right = serializeExpression(expression.right, parameters, loopIndex);
    return left && right && { kind: 'binary', operator: expression.operator, left, right };
  }
  if (expression instanceof TernaryOpNode) {
    const condition = serializeExpression(expression.condition, parameters, loopIndex);
    const ifTrue = serializeExpression(expression.ifTrue, parameters, loopIndex);
    const ifFalse = serializeExpression(expression.ifFalse, parameters, loopIndex);
    return condition && ifTrue && ifFalse && { kind: 'ternary', condition, ifTrue, ifFalse };
  }
  return undefined;
};

/** The source snapshot intentionally predates full expression typing, so infer only the v1 evaluator vocabulary. */
const replayExpressionType = (
  expression: Node,
  parameterTypes: ReadonlyMap<string, string>,
  loopIndex?: string,
): string | undefined => {
  if (expression instanceof IdentifierNode) {
    if (expression.name === loopIndex) return 'bigint';
    return parameterTypes.get(expression.name);
  }
  if (expression instanceof IntLiteralNode) return 'bigint';
  if (expression instanceof BoolLiteralNode) return 'bool';
  if (expression instanceof HexLiteralNode) return `bytes${expression.value.length}`;
  if (expression instanceof UnaryOpNode) {
    const inner = replayExpressionType(expression.expression, parameterTypes, loopIndex);
    return expression.operator === '!' ? (inner === 'bool' ? 'bool' : undefined)
      : expression.operator === '-' && replayIntegerType(inner) ? inner : undefined;
  }
  if (expression instanceof BinaryOpNode) {
    const left = replayExpressionType(expression.left, parameterTypes, loopIndex);
    const right = replayExpressionType(expression.right, parameterTypes, loopIndex);
    if (!left || !right) return undefined;
    if (['==', '!=', '<', '<=', '>', '>=', '&&', '||'].includes(expression.operator)) return 'bool';
    return replayIntegerType(left) && replayIntegerType(right) ? 'bigint' : undefined;
  }
  if (expression instanceof TernaryOpNode) {
    const condition = replayExpressionType(expression.condition, parameterTypes, loopIndex);
    const ifTrue = replayExpressionType(expression.ifTrue, parameterTypes, loopIndex);
    const ifFalse = replayExpressionType(expression.ifFalse, parameterTypes, loopIndex);
    return condition === 'bool' && ifTrue !== undefined && ifTrue === ifFalse ? ifTrue : undefined;
  }
  return undefined;
};

const nestedStatements = (block: BlockNode): Array<{ statement: Node; prior?: Node }> => {
  const result: Array<{ statement: Node; prior?: Node }> = [];
  const descend = (candidate: Node): void => {
    if (candidate instanceof BlockNode) {
      for (let index = 0; index < (candidate.statements?.length ?? 0); index += 1) {
        const statement = candidate.statements![index];
        result.push({ statement, prior: candidate.statements![index - 1] });
        descend(statement);
      }
      return;
    }
    for (const [key, value] of Object.entries(candidate)) {
      if (skippedLinks.has(key)) continue;
      if (value instanceof Node) descend(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) descend(item);
    }
  };
  descend(block);
  return result;
};

const arrayComponent = (expression: Node, arrayName: string): ArrayAccessNode | undefined =>
  expression instanceof ArrayAccessNode && identifierName(expression.array) === arrayName ? expression : undefined;

const projectVector = (
  fn: FunctionDefinitionNode,
  proof: MessageBusConstructedKeyVectorProofProgram,
  ordinal: number,
): ConstructedKeyVectorV1Abi | undefined => {
  const parameters = fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__')).map((parameter) => parameter.name);
  const parameterTypes = new Map(fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'))
    .map((parameter) => [parameter.name, parameter.type.toString()]));
  const allocations: Array<{ name: string; allocation: NewArrayNode }> = [];
  walk(proof.sourceProgram, (node) => {
    if (node instanceof VariableDefinitionNode && node.expression instanceof NewArrayNode) {
      allocations.push({ name: node.name, allocation: node.expression });
    }
  });
  const selected = allocations[ordinal];
  if (!selected || !replayValueType(selected.allocation.elementType.toString())) {
    return undefined;
  }
  const allocationLength = serializeExpression(selected.allocation.size, parameters);
  if (!allocationLength || !replayIntegerType(replayExpressionType(selected.allocation.size, parameterTypes))) {
    return undefined;
  }

  type Producer = { loop: WhileNode; counter: string; start: Node; write: ArrayAssignNode };
  const producers: Producer[] = [];
  const consumers: Array<{
    loop: WhileNode; counter: string; write: MappingAssignNode; component: number; access: ArrayAccessNode;
  }> = [];
  for (const { statement, prior } of nestedStatements(proof.sourceProgram)) {
    if (!(statement instanceof WhileNode)) continue;
    const condition = statement.condition;
    if (!(condition instanceof BinaryOpNode) || condition.operator !== BinaryOperator.LT) continue;
    const counter = identifierName(condition.left);
    if (!counter || identifierName(condition.right) !== identifierName(selected.allocation.size)) continue;
    if (prior instanceof VariableDefinitionNode && prior.name === counter) {
      const statements = statement.block.statements ?? [];
      if (statements.length === 2 && statements[0] instanceof ArrayAssignNode
        && statements[0].name === selected.name && identifierName(statements[0].index) === counter
        && isIncrement(statements[1], counter)) {
        producers.push({ loop: statement, counter, start: prior.expression ?? prior, write: statements[0] });
      }
    }
    const writes: MappingAssignNode[] = [];
    walk(statement.block, (node) => { if (node instanceof MappingAssignNode) writes.push(node); });
    for (const write of writes) {
      const matches = write.keys.map((key, component) => ({ component, access: arrayComponent(key, selected.name) }))
        .filter((match): match is { component: number; access: ArrayAccessNode } => match.access !== undefined);
      if (matches.length === 1) consumers.push({ loop: statement, counter, write, ...matches[0] });
    }
  }
  // One canonical source producer and one source consumer are required. Multiple compatible-looking sites are
  // not interchangeable because the ABI has no source-local occurrence selector.
  if (producers.length !== 1 || consumers.length !== 1) return undefined;
  const producer = producers[0];
  const consumer = consumers[0];
  const start = serializeExpression(producer.start, parameters);
  const value = serializeExpression(producer.write.value, parameters, producer.counter);
  const index = serializeExpression(producer.write.index, parameters, producer.counter);
  const consumerIndex = serializeExpression(consumer.access.index, parameters, consumer.counter);
  if (!start || !value || !index || !consumerIndex
    || !replayIntegerType(replayExpressionType(producer.start, parameterTypes))
    || !replayIntegerType(replayExpressionType(producer.write.index, parameterTypes, producer.counter))
    || !replayIntegerType(replayExpressionType(consumer.access.index, parameterTypes, consumer.counter))
    || !replayValueType(replayExpressionType(producer.write.value, parameterTypes, producer.counter) ?? '')) return undefined;
  const fixedComponents = consumer.write.keys.map((key, component) => ({ component, expression: key }))
    .filter(({ component }) => component !== consumer.component)
    .map(({ component, expression }) => ({
      component, expression: serializeExpression(expression, parameters, consumer.counter),
    }));
  if (!fixedComponents.every((component): component is { component: number; expression: ExternalCallExpression } =>
    component.expression !== undefined)) return undefined;
  // No local identifier may cross this boundary. This tiny type inference is deliberately independent of later
  // AST annotations, which may not exist yet on the immutable source snapshot.
  if (!consumer.write.keys.every((key, component) => component === consumer.component
    ? true : replayValueType(replayExpressionType(key, parameterTypes, consumer.counter) ?? ''))) return undefined;
  return {
    version: 1,
    vectorOrdinal: ordinal,
    elementType: selected.allocation.elementType.toString(),
    allocationLength,
    producer: {
      domain: { kind: 'pre-test', start, bound: allocationLength, step: { kind: 'literal', type: 'bigint', value: '1' }, comparison: '<' },
      writes: [{ index, value }],
    },
    consumer: {
      index: consumerIndex,
      vectorElementComponent: consumer.component,
      keyComponentCount: consumer.write.keys.length,
      fixedComponents,
    },
  };
};
