import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
import { ArrayType, IntType, PrimitiveType, StructType } from '@solidcash/utils';
import { createDefaultValueExpression } from '../ast/defaults.js';
import {
  ArrayAccessNode, ArrayAssignNode, ArrayNode, AssemblyStatementNode, AssertNode, AssignNode, AssignmentExpressionNode,
  BinaryOpNode, BlockNode, BoolLiteralNode,
  BranchNode, CastNode, ConsoleStatementNode, ConstantDefinitionNode, ContractNode, DeleteLocalNode, DeleteStateNode,
  EmitStatementNode, ExpressionNode, ExpressionStatementNode, type ExternalCallExpression,
  ExternalFunctionCallNode, FieldAccessNode, FunctionCallNode, FunctionDefinitionNode, FunctionModifier,
  HexLiteralNode,
  IdentifierNode, IndirectCallNode, InstantiationNode, IntLiteralNode, LowLevelCallNode,
  MappingAccessNode, MappingAssignNode, MappingDeleteNode, MappingFieldAssignNode, MethodCallNode, MethodCallStatementNode,
  Node, NullaryOpNode,
  RequireNode, ReturnNode, StateAccessNode, StateAssignNode,
  StringLiteralNode, StructDefinitionNode, TernaryOpNode, TimeOpNode, TupleAssignmentNode, TupleIndexOpNode,
  UnaryOpNode, VariableDefinitionNode,
} from '../ast/AST.js';
import { NullaryOperator } from '../ast/Operator.js';

// Walk only syntax, never semantic backreferences (which also lead to other functions' mutations).
const backrefs = new Set([
  'location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable', 'referencedContract',
  'stateVariable', 'collection', 'sourceCallNode', 'type', 'callInfo',
]);
function syntaxNodes(root: Node, result = new Set<Node>()): Set<Node> {
  if (result.has(root)) return result;
  result.add(root);
  for (const [key, value] of Object.entries(root)) {
    if (backrefs.has(key)) continue;
    if (root instanceof MethodCallStatementNode && root.expression && key === 'call') continue;
    if (value instanceof Node) syntaxNodes(value, result);
    else if (Array.isArray(value)) {
      for (const item of value) if (item instanceof Node) syntaxNodes(item, result);
    }
  }
  return result;
}

/** The value a whole-entry delete stores: the same expression as writing that type's zero. */
function deletedValueExpression(node: MappingDeleteNode): ExpressionNode {
  const type = node.collection!.innermostValueType;
  if (type instanceof IntType) {
    // `uint(0)` / `int(0)`, not a bare int literal. The assign path publishes that cast.
    const literal = new IntLiteralNode(0n);
    literal.type = PrimitiveType.INT;
    literal.location = node.location;
    const cast = new CastNode(type, literal, false);
    cast.location = node.location;
    return cast;
  }
  const created = createDefaultValueExpression(type, node.location);
  created.type = type;
  return created;
}

type Bindings = Map<Node, ExternalCallExpression>;
type Environment = { locals: Bindings; state: Map<string, ExternalCallExpression | undefined> };

/**
 * Publish after external-call indexing and type checking, before backend rewrites the handler body.
 * This is deliberately a per-write proof, not a relaxation of sourceEffectOrder. Branches may compute
 * locals, but the sole whole-value mutation itself must be reached once on every successful invocation.
 * Unknown effects, aliasing memory writes, loops, and early exits before the mutation fail closed.
 */
export function publishStoredValueSources(contract: ContractNode, fileStructs: StructDefinitionNode[]): void {
  for (const fn of contract.functions) publishFunctionSources(contract, fn, fileStructs);
}

function publishFunctionSources(
  contract: ContractNode, fn: FunctionDefinitionNode, fileStructs: StructDefinitionNode[],
): void {
  if (!fn.entryAccesses?.length || fn.messageBusRoute) return;
  for (const access of fn.entryAccesses) delete access.storedValueSource;
  const nodes = [...syntaxNodes(fn.body)];
  const structs = new Map([...fileStructs, ...contract.structDefinitions].map((struct) => [struct.name, struct]));
  const readonlyHelper = (node: FunctionCallNode): boolean => node.resolvedFunction?.modifiers
    .some((modifier) => modifier === FunctionModifier.PURE || modifier === FunctionModifier.VIEW) === true;
  // Unexpanded helpers may mutate a collection or memory alias, even after the candidate write.
  const opaqueCall = nodes.some((node) => (
    (node instanceof FunctionCallNode && !structs.has(node.identifier.name) && !readonlyHelper(node))
    || (node instanceof InstantiationNode && !structs.has(node.identifier.name))
    || node instanceof MethodCallNode || node instanceof IndirectCallNode || node instanceof LowLevelCallNode
    || node instanceof ExternalFunctionCallNode && node.callMode === 'delegatecall'
    || node instanceof AssignmentExpressionNode || node instanceof AssemblyStatementNode
  ));
  if (opaqueCall) return;
  // Conservative reference-origin closure, including assignments in either branch. A read-only helper
  // cannot mutate storage, but may mutate memory parameters. Invalidate every binding sharing such an
  // argument's origins; never infer memory purity from the Solidity view/pure modifier alone.
  const origins = new Map<Node, Set<Node>>();
  const references = (node: Node): Set<Node> => new Set([...syntaxNodes(node)].flatMap((candidate) => (
    candidate instanceof IdentifierNode && candidate.definition?.definition
      ? [candidate.definition.definition] : []
  )));
  for (const node of nodes) {
    const definition = node instanceof VariableDefinitionNode ? node
      : node instanceof AssignNode ? node.identifier.definition?.definition : undefined;
    const expression = node instanceof VariableDefinitionNode || node instanceof AssignNode ? node.expression : undefined;
    if (definition && expression) {
      origins.set(definition, new Set([...(origins.get(definition) ?? []), ...references(expression)]));
    }
  }
  const closure = (roots: Set<Node>): Set<Node> => {
    const result = new Set(roots);
    for (const root of result) for (const origin of origins.get(root) ?? []) result.add(origin);
    return result;
  };
  const invalidateMemoryCalls = (statement: Node, env: Environment): void => {
    for (const node of syntaxNodes(statement)) {
      if (!(node instanceof FunctionCallNode) || !readonlyHelper(node)) continue;
      const mutated = closure(new Set(node.parameters.flatMap((argument, index) => {
        const type = node.resolvedFunction!.parameters[index]?.type;
        const referenceType = type instanceof ArrayType || type instanceof StructType
          || type?.toString() === 'bytes' || type?.toString() === 'string';
        return referenceType ? [...references(argument)] : [];
      })));
      for (const definition of env.locals.keys()) {
        if ([...closure(new Set([definition]))].some((root) => mutated.has(root))) env.locals.delete(definition);
      }
    }
  };
  for (const access of fn.entryAccesses) {
    if (!access.operations.includes('write') || access.arrayMutation
      || access.mutationEffectOrdinals?.length !== 1) continue;
    const mutations = nodes.filter((node) => (
      (node instanceof MappingAssignNode || node instanceof MappingFieldAssignNode
        || node instanceof MappingDeleteNode) && node.name === access.collection
    ));
    if (mutations.length !== 1) continue;
    const target = mutations[0];
    const deletion = target instanceof MappingDeleteNode ? target : undefined;
    const assignment = target instanceof MappingAssignNode ? target : undefined;
    if (deletion) {
      if (deletion.sourceEffectOrdinal !== access.mutationEffectOrdinals[0] || !deletion.collection) continue;
    } else if (!assignment || assignment.arrayIndex || assignment.arrayPush || assignment.arrayPop
      || assignment.sourceEffectOrdinal !== access.mutationEffectOrdinals[0] || !assignment.collection) {
      continue;
    }
    const writtenCollection = deletion?.collection ?? assignment!.collection!;
    const valueType = writtenCollection.innermostValueType.toString();
    const environment: Environment = { locals: new Map(), state: new Map() };
    fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'))
      .forEach((parameter, paramIndex) => environment.locals.set(parameter, {
        kind: 'source', type: parameter.type.toString(), source: { kind: 'forward', paramIndex },
      }));
    const typed = (expression: ExternalCallExpression, type: string): ExternalCallExpression => (
      expression.type === type ? expression : { kind: 'cast', type, expression }
    );
    const activeHelpers = new Set<FunctionDefinitionNode>();
    const serialize = (node: ExpressionNode, env: Environment): ExternalCallExpression | undefined => {
      const type = node.type?.toString();
      if (node instanceof IdentifierNode) {
        const definition = node.definition?.definition;
        if (definition instanceof ConstantDefinitionNode) {
          const value = serialize(definition.expression, env);
          return value && typed(value, definition.type.toString());
        }
        return definition ? env.locals.get(definition) : undefined;
      }
      if (node instanceof IntLiteralNode) return { kind: 'literal', type, value: node.value.toString() };
      if (node instanceof BoolLiteralNode) return { kind: 'literal', type: 'bool', value: node.value };
      if (node instanceof StringLiteralNode) return { kind: 'literal', type: 'string', value: node.value };
      if (node instanceof HexLiteralNode) return { kind: 'literal', type, value: binToHex(node.value) };
      if (node instanceof StateAccessNode) {
        return env.state.has(node.name) ? env.state.get(node.name) : { kind: 'state', name: node.name, type };
      }
      // This collection has exactly one mutation in the entire handler. Its reads before that
      // mutation therefore refer to incoming entries, with keys captured at the read's source point.
      // Other collections may already have been changed and cannot use this pre-state proof.
      if (node instanceof MappingAccessNode && node.name === access.collection && !node.arrayIndex) {
        const args = node.keys.map((key) => serialize(key, env));
        return args.every((arg): arg is ExternalCallExpression => arg !== undefined)
          ? { kind: 'entryPreValue', name: node.name, type, args } : undefined;
      }
      if (node instanceof NullaryOpNode && node.operator === NullaryOperator.BLOCK_TIMESTAMP) {
        return { kind: 'state', name: '__block_timestamp', type: type ?? 'uint256' };
      }
      if (node instanceof CastNode || node instanceof FieldAccessNode || node instanceof UnaryOpNode) {
        const expression = serialize(node.expression, env);
        if (!expression) return undefined;
        if (node instanceof CastNode) return { kind: 'cast', type, expression };
        if (node instanceof FieldAccessNode) {
          const struct = expression.kind === 'call' && expression.name ? structs.get(expression.name) : undefined;
          const fieldIndex = struct?.fields.findIndex((field) => field.name === node.name) ?? -1;
          if (fieldIndex >= 0 && expression.args?.[fieldIndex]) return expression.args[fieldIndex];
          return { kind: 'field', name: node.name, type, expression };
        }
        return { kind: 'unary', operator: node.operator, type, expression };
      }
      if (node instanceof BinaryOpNode || node instanceof ArrayAccessNode) {
        const left = serialize(node instanceof BinaryOpNode ? node.left : node.array, env);
        const right = serialize(node instanceof BinaryOpNode ? node.right : node.index, env);
        return left && right && (node instanceof BinaryOpNode
          ? { kind: 'binary', operator: node.operator, type, left, right }
          : { kind: 'arrayAccess', type, left, right });
      }
      if (node instanceof TupleIndexOpNode && node.tuple.type instanceof ArrayType) {
        const left = serialize(node.tuple, env);
        return left && { kind: 'arrayAccess', type, left,
          right: { kind: 'literal', type: 'int', value: String(node.index) } };
      }
      if (node instanceof TernaryOpNode) {
        const condition = serialize(node.condition, env);
        const ifTrue = serialize(node.ifTrue, env);
        const ifFalse = serialize(node.ifFalse, env);
        return condition && ifTrue && ifFalse && { kind: 'ternary', type, condition, ifTrue, ifFalse };
      }
      if (node instanceof ArrayNode) {
        const elementType = node.type instanceof ArrayType ? node.type.elementType.toString() : undefined;
        const args = node.elements.map((element) => {
          const value = serialize(element, env);
          return value && elementType ? typed(value, elementType) : value;
        });
        return args.every((arg): arg is ExternalCallExpression => arg !== undefined)
          ? { kind: 'array', type, args } : undefined;
      }
      if (node instanceof FunctionCallNode || node instanceof InstantiationNode) {
        const struct = structs.get(node.identifier.name);
        const helper = node instanceof FunctionCallNode ? node.resolvedFunction : undefined;
        const statement = helper?.body.statements?.length === 1 ? helper.body.statements[0] : undefined;
        if (!struct && helper?.modifiers.includes(FunctionModifier.PURE)
          && statement instanceof ReturnNode && statement.expressions.length === 1
          && helper.parameters.length === node.parameters.length && !activeHelpers.has(helper)
          && helper.parameters.every((parameter) => !(parameter.type instanceof ArrayType)
            && !(parameter.type instanceof StructType)
            && !['bytes', 'string'].includes(parameter.type.toString()))) {
          const args = node.parameters.map((parameter) => serialize(parameter, env));
          if (!args.every((arg): arg is ExternalCallExpression => arg !== undefined)) return undefined;
          const locals = new Map(helper.parameters.map((parameter, index) => (
            [parameter, typed(args[index], parameter.type.toString())] as const
          )));
          activeHelpers.add(helper);
          const result = serialize(statement.expressions[0], { locals, state: env.state });
          activeHelpers.delete(helper);
          return result && type ? typed(result, type) : result;
        }
        if (!struct || node.parameters.length !== struct.fields.length) return undefined;
        const args = node.parameters.map((parameter, index) => {
          const value = serialize(parameter, env);
          return value && typed(value, struct.fields[index].type.toString());
        });
        return args.every((arg): arg is ExternalCallExpression => arg !== undefined)
          ? { kind: 'call', name: struct.name, type: struct.name, args } : undefined;
      }
      if (node instanceof ExternalFunctionCallNode && node.callInfo?.hasReturnValues
        && node.callInfo.returnTypes?.length === 1 && node.callInfo.externalCallSlotIndex >= 0) {
        return {
          kind: 'producerResult', callsiteId: node.callInfo.externalCallSlotIndex,
          sourceCallsiteId: node.callInfo.externalCallSlotIndex, resultIndex: 0, type,
        };
      }
      return undefined;
    };
    let value: ExternalCallExpression | undefined;
    const clone = (env: Environment): Environment => ({ locals: new Map(env.locals), state: new Map(env.state) });
    const same = (a: ExternalCallExpression | undefined, b: ExternalCallExpression | undefined): boolean => (
      a === b || JSON.stringify(a) === JSON.stringify(b)
    );
    const join = (
      before: Environment, yes: Environment, no: Environment, condition?: ExternalCallExpression,
    ): void => {
      for (const key of before.locals.keys()) {
        const ifTrue = yes.locals.get(key);
        const ifFalse = no.locals.get(key);
        if (ifTrue && same(ifTrue, ifFalse)) before.locals.set(key, ifTrue);
        else if (condition && ifTrue && ifFalse && ifTrue.type === ifFalse.type) {
          before.locals.set(key, { kind: 'ternary', type: ifTrue.type, condition, ifTrue, ifFalse });
        } else before.locals.delete(key);
      }
      for (const key of new Set([...yes.state.keys(), ...no.state.keys()])) {
        const stateType = contract.stateVariables.find((state) => state.name === key)?.type.toString();
        const original = { kind: 'state', name: key, type: stateType };
        const ifTrue = yes.state.has(key) ? yes.state.get(key) : original;
        const ifFalse = no.state.has(key) ? no.state.get(key) : original;
        before.state.set(key, same(ifTrue, ifFalse) ? ifTrue
          : condition && ifTrue && ifFalse
            ? { kind: 'ternary', type: stateType, condition, ifTrue, ifFalse } : undefined);
      }
    };
    const process = (block: BlockNode, env: Environment, conditional = false): boolean => {
      for (const statement of block.statements ?? []) {
        // Branch bodies are interpreted separately; conservatively invalidate call aliases on their
        // condition as well, but do not apply an untaken body's effects to the incoming environment.
        if (!(statement instanceof BlockNode)) {
          invalidateMemoryCalls(statement instanceof BranchNode ? statement.condition : statement, env);
        }
        if (statement === target) {
          if (conditional) return false;
          const written = deletion ? deletedValueExpression(deletion) : assignment!.expression;
          value = serialize(written, env);
          return value !== undefined;
        }
        if (statement instanceof BlockNode) {
          if (!process(statement, env, conditional)) return false;
          if (value) return true;
        } else if (statement instanceof BranchNode) {
          const condition = serialize(statement.condition, env);
          const yes = clone(env);
          const no = clone(env);
          if (!process(statement.ifBlock, yes, true)
            || (statement.elseBlock && !process(statement.elseBlock, no, true))) return false;
          join(env, yes, no, condition);
        } else if (statement instanceof VariableDefinitionNode) {
          const expression = statement.expression && serialize(statement.expression, env);
          if (expression) env.locals.set(statement, typed(expression, statement.type.toString()));
        } else if (statement instanceof AssignNode) {
          if (statement.isReferenceDataWrite) return false;
          const definition = statement.identifier.definition?.definition;
          if (!definition) return false;
          const expression = serialize(statement.expression, env);
          if (expression) env.locals.set(definition, expression);
          else env.locals.delete(definition);
        } else if (statement instanceof ArrayAssignNode) {
          // At this post-lowering boundary an ArrayAssign replaces one blob-valued local. Reference
          // alias propagation has already been made explicit by the memory lowering; don't infer aliases.
          const definition = (block.symbolTable ?? fn.symbolTable)?.get(statement.name)?.definition;
          const array = definition && env.locals.get(definition);
          const arrayType = statement.arrayType;
          const index = serialize(statement.index, env);
          const replacement = serialize(statement.value, env);
          if (!definition || !array || !arrayType?.bound || !index || !replacement) return false;
          const elementType = arrayType.elementType.toString();
          let constantIndex = index;
          while (constantIndex.kind === 'cast' && constantIndex.expression) constantIndex = constantIndex.expression;
          const literalIndex = constantIndex.kind === 'literal' && typeof constantIndex.value === 'string'
            && /^\d+$/u.test(constantIndex.value) ? BigInt(constantIndex.value) : undefined;
          if (literalIndex !== undefined && literalIndex >= BigInt(arrayType.bound)) return false;
          env.locals.set(definition, {
            kind: 'array', type: arrayType.toString(),
            args: Array.from({ length: arrayType.bound }, (_, position) => {
              const at: ExternalCallExpression = { kind: 'literal', type: index.type, value: String(position) };
              const previous: ExternalCallExpression = array.kind === 'array' && array.args?.[position]
                ? array.args[position] : { kind: 'arrayAccess', type: elementType, left: array, right: at };
              if (literalIndex !== undefined) return literalIndex === BigInt(position)
                ? typed(replacement, elementType) : previous;
              return {
                kind: 'ternary', type: elementType,
                condition: { kind: 'binary', operator: '==', type: 'bool', left: index, right: at },
                ifTrue: typed(replacement, elementType),
                ifFalse: previous,
              };
            }),
          });
        } else if (statement instanceof DeleteLocalNode) {
          const definition = statement.identifier.definition?.definition;
          if (definition) env.locals.delete(definition);
        } else if (statement instanceof TupleAssignmentNode) {
          // Fresh tuple locals with unsupported values cannot affect an earlier binding. Existing tuple
          // targets lack resolved definition identities here, so do not guess through such a mutation.
          if (statement.elements.some((element) => element.existing)) return false;
        } else if (statement instanceof StateAssignNode) {
          env.state.set(statement.name, serialize(statement.expression, env));
        } else if (statement instanceof DeleteStateNode) {
          env.state.set(statement.name, undefined);
        } else if (!(statement instanceof RequireNode || statement instanceof AssertNode
          || statement instanceof EmitStatementNode || statement instanceof ConsoleStatementNode
          || statement instanceof ExpressionStatementNode || statement instanceof TimeOpNode
          || statement instanceof MethodCallStatementNode
          || statement instanceof MappingAssignNode || statement instanceof MappingFieldAssignNode
          || statement instanceof MappingDeleteNode)) return false;
      }
      return true;
    };
    if (process(fn.body, environment) && value) {
      access.storedValueSource = {
        version: 1, execution: 'unconditional-once',
        mutationEffectOrdinal: (deletion ?? assignment)!.sourceEffectOrdinal!,
        valueType, expression: { ...value, type: valueType },
      };
    }
  }
}
