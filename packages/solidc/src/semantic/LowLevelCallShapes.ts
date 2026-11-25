import {
  BlockNode, BoolLiteralNode, BranchNode, CastNode, CollectionIterationNode, DoWhileNode,
  FieldAccessNode, FunctionDefinitionNode, FunctionCallNode, IdentifierNode, IntLiteralNode, LowLevelCallNode,
  LowLevelCallStatementNode, MethodCallNode, MethodCallStatementNode, Node, ParameterNode, StateAccessNode,
  SwitchNode, TernaryOpNode, TryCatchNode, UnaryOpNode, BinaryOpNode, WhileNode, type ExpressionNode,
  type ExternalCallExpression,
} from '../ast/AST.js';
import { fixedForMaximum } from './FixedForLoop.js';

// The low-level callsites of a function (`call`, `staticcall`, `delegatecall`) and their occurrence facts.

/** Where a low-level callsite sits relative to control flow. */
type CallsiteContext = 'unconditional' | 'loop' | 'conditional';

/** One low-level callsite, in whichever representation the pipeline stage uses. */
interface Callsite {
  callMode: string;
  context: CallsiteContext;
  returnsResult: boolean;
  fixedLoopOccurrences?: number;
  conditionalWithinLoop: boolean;
  /** Lexical predicates that must hold for this callsite to be reached, outermost first. */
  guards: readonly PathGuard[];
}

/** A source predicate which must hold (`negated` false) or not hold (`negated` true) to reach a callsite. */
interface PathGuard {
  expression: ExpressionNode;
  negated: boolean;
}

/**
 * Compiler-authored occurrence facts required to allocate one authenticated low-level execution frame.
 *
 * `condition` is the serialized conjunction of the callsite's lexical predicates, in the same
 * `ExternalCallExpression` vocabulary external calls publish. It is present only for a `conditional`
 * callsite whose every predicate serializes; an unsupported predicate leaves it absent, which reads as
 * unknown and is never an unconditional frame.
 */
export interface LowLevelCallsiteShape {
  callMode: string;
  occurrence: 'once' | 'conditional' | 'loop';
  /** Exact literal loop cardinality when the source proves one; absent is never an unboundedness proof. */
  maximumOccurrences?: number;
  returnsResult: boolean;
  conditionalWithinLoop: boolean;
  condition?: ExternalCallExpression;
}

const LOW_LEVEL_METHOD_NAMES = new Set(['call', 'staticcall', 'delegatecall']);
const LOOP_NODES = [WhileNode, DoWhileNode, CollectionIterationNode];
const CONDITIONAL_NODES = [BranchNode, SwitchNode, TryCatchNode, TernaryOpNode];

const isInstanceOfAny = (node: Node, classes: { new (...args: never[]): Node }[]): boolean =>
  classes.some((candidate) => node instanceof candidate);

/**
 * Serialize one guard expression into the shared `ExternalCallExpression` vocabulary. A forwarded parameter
 * becomes `{ kind: 'source', source: { kind: 'forward', paramIndex } }` against the VISIBLE parameters, which is
 * the same source the SDK already evaluates for external-call argument recipes. Any form this does not name
 * returns `undefined`, so the caller publishes no condition and the consumer must treat reachability as unknown.
 */
const serializeGuardExpression = (
  expression: ExpressionNode, visibleParameters: readonly ParameterNode[],
): ExternalCallExpression | undefined => {
  if (expression instanceof IntLiteralNode) {
    return { kind: 'literal', type: 'bigint', value: expression.value.toString() };
  }
  if (expression instanceof BoolLiteralNode) return { kind: 'literal', type: 'bool', value: expression.value };
  if (expression instanceof IdentifierNode) {
    const paramIndex = visibleParameters.findIndex((parameter) => parameter.name === expression.name);
    return paramIndex >= 0 ? { kind: 'source', source: { kind: 'forward', paramIndex } } : undefined;
  }
  if (expression instanceof StateAccessNode) return { kind: 'state', name: expression.name };
  if (expression instanceof CastNode) {
    const inner = serializeGuardExpression(expression.expression, visibleParameters);
    return inner && { kind: 'cast', type: expression.type.toString(), expression: inner };
  }
  if (expression instanceof UnaryOpNode) {
    const inner = serializeGuardExpression(expression.expression, visibleParameters);
    return inner && { kind: 'unary', operator: expression.operator, expression: inner };
  }
  if (expression instanceof BinaryOpNode) {
    const left = serializeGuardExpression(expression.left, visibleParameters);
    const right = serializeGuardExpression(expression.right, visibleParameters);
    return left && right && { kind: 'binary', operator: expression.operator, left, right };
  }
  if (expression instanceof TernaryOpNode) {
    const condition = serializeGuardExpression(expression.condition, visibleParameters);
    const ifTrue = serializeGuardExpression(expression.ifTrue, visibleParameters);
    const ifFalse = serializeGuardExpression(expression.ifFalse, visibleParameters);
    return condition && ifTrue && ifFalse && { kind: 'ternary', condition, ifTrue, ifFalse };
  }
  if (expression instanceof FieldAccessNode) {
    const inner = serializeGuardExpression(expression.expression, visibleParameters);
    return inner && { kind: 'field', name: expression.name, expression: inner };
  }
  return undefined;
};

const AND_EXPRESSION = '&&';

/** Serialize the conjunction of a callsite's lexical predicates, or `undefined` if any predicate cannot be named. */
const serializeGuards = (
  guards: readonly PathGuard[], visibleParameters: readonly ParameterNode[],
): ExternalCallExpression | undefined => {
  const serialized: ExternalCallExpression[] = [];
  for (const guard of guards) {
    const inner = serializeGuardExpression(guard.expression, visibleParameters);
    if (inner === undefined) return undefined;
    serialized.push(guard.negated ? { kind: 'unary', operator: '!', expression: inner } : inner);
  }
  if (serialized.length === 0) return undefined;
  return serialized.reduce((left, right) => (
    { kind: 'binary', operator: AND_EXPRESSION, left, right }
  ));
};

/**
 * Recognize a low-level callsite in EVERY representation the pipeline uses.
 *
 * The parser produces three different nodes for the same source construct, so all three are matched:
 *
 * - `addr.call(payload);` (statement)                  -> `LowLevelCallStatementNode`
 * - `(ok, r) = addr.call(payload);`                    -> `FunctionCallNode` with the dotted name `addr.call`
 * - `(ok, r) = addr.call{value: v}(payload);`          -> `MethodCallNode` named `call`, carrying `callOptions`
 *
 * After lowering they are all `LowLevelCall*Node`. The pre-lowering match is by name and single argument, so a
 * user function literally named `call`, `staticcall` or `delegatecall` taking exactly one argument also matches.
 */
function asCallsite(
  node: Node, context: CallsiteContext, fixedLoopOccurrences: number | undefined,
  conditionalWithinLoop: boolean, guards: readonly PathGuard[],
): Callsite | undefined {
  if (node instanceof LowLevelCallNode || node instanceof LowLevelCallStatementNode) {
    return {
      callMode: node.callMode, context,
      returnsResult: node instanceof LowLevelCallNode, fixedLoopOccurrences, conditionalWithinLoop, guards,
    };
  }
  if (node instanceof MethodCallNode || node instanceof MethodCallStatementNode) {
    const call = node instanceof MethodCallStatementNode ? node.call : node;
    if (!(call instanceof MethodCallNode)) return undefined;
    if (!LOW_LEVEL_METHOD_NAMES.has(call.methodName) || call.parameters.length !== 1) return undefined;
    return {
      callMode: call.methodName, context,
      returnsResult: node instanceof MethodCallNode, fixedLoopOccurrences, conditionalWithinLoop, guards,
    };
  }
  if (node instanceof FunctionCallNode && node.parameters.length === 1) {
    const dot = node.identifier.name.lastIndexOf('.');
    const method = dot < 0 ? '' : node.identifier.name.slice(dot + 1);
    if (!LOW_LEVEL_METHOD_NAMES.has(method)) return undefined;
    return {
      callMode: method, context, returnsResult: true,
      fixedLoopOccurrences, conditionalWithinLoop, guards,
    };
  }
  return undefined;
}

/**
 * Walk a function body, reporting each low-level callsite with the innermost control-flow context that reached
 * it. A loop wins over a branch: an iterated callsite is unbounded whether or not it is also conditional.
 */
function collectLowLevelCalls(
  value: unknown,
  context: CallsiteContext,
  found: Callsite[],
  seen: Set<object> = new Set(),
  fixedLoopOccurrences?: number,
  conditionalWithinLoop = false,
  guards: readonly PathGuard[] = [],
): void {
  if (!(value instanceof Node) || seen.has(value)) return;
  seen.add(value);

  let inner = context;
  if (isInstanceOfAny(value, LOOP_NODES)) inner = 'loop';
  else if (context !== 'loop' && isInstanceOfAny(value, CONDITIONAL_NODES)) inner = 'conditional';

  const callsite = asCallsite(value, context, fixedLoopOccurrences, conditionalWithinLoop, guards);
  if (callsite) found.push(callsite);

  // A source `for` is represented as adjacent initializer + WhileNode. Pair them here so only this canonical
  // literal form can carry an exact occurrence count into the shape decision.
  if (value instanceof BlockNode) {
    const statements = value.statements ?? [];
    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      if (statement instanceof WhileNode) {
        const exact = fixedForMaximum(statements[index - 1], statement);
        collectLowLevelCalls(
          statement, 'loop', found, seen, exact,
          conditionalWithinLoop || context === 'conditional', guards,
        );
      } else {
        collectLowLevelCalls(
          statement, context, found, seen, fixedLoopOccurrences, conditionalWithinLoop, guards,
        );
      }
    }
    return;
  }

  // A control-flow predicate is evaluated whenever its enclosing statement is reached; only the selected arms
  // are conditional. Propagating the arm context into the predicate turns a producer used to choose the branch
  // into an optional callsite, which prevents later consumers from naming its authenticated result precisely.
  const armContext: CallsiteContext = context === 'loop' ? 'loop' : 'conditional';
  const armWithinLoop = conditionalWithinLoop || context === 'loop';
  if (value instanceof BranchNode) {
    collectLowLevelCalls(value.condition, context, found, seen, fixedLoopOccurrences, conditionalWithinLoop, guards);
    collectLowLevelCalls(value.ifBlock, armContext, found, seen, fixedLoopOccurrences, armWithinLoop,
      [...guards, { expression: value.condition, negated: false }]);
    if (value.elseBlock) {
      collectLowLevelCalls(value.elseBlock, armContext, found, seen, fixedLoopOccurrences, armWithinLoop,
        [...guards, { expression: value.condition, negated: true }]);
    }
    return;
  }
  if (value instanceof TernaryOpNode) {
    collectLowLevelCalls(value.condition, context, found, seen, fixedLoopOccurrences, conditionalWithinLoop, guards);
    collectLowLevelCalls(value.ifTrue, armContext, found, seen, fixedLoopOccurrences, armWithinLoop,
      [...guards, { expression: value.condition, negated: false }]);
    collectLowLevelCalls(value.ifFalse, armContext, found, seen, fixedLoopOccurrences, armWithinLoop,
      [...guards, { expression: value.condition, negated: true }]);
    return;
  }
  if (value instanceof SwitchNode) {
    collectLowLevelCalls(value.expression, context, found, seen, fixedLoopOccurrences, conditionalWithinLoop, guards);
    for (const candidate of value.cases) {
      collectLowLevelCalls(candidate.value, armContext, found, seen, fixedLoopOccurrences, armWithinLoop, guards);
      collectLowLevelCalls(candidate.body, armContext, found, seen, fixedLoopOccurrences, armWithinLoop, guards);
    }
    if (value.defaultCase) {
      collectLowLevelCalls(value.defaultCase, armContext, found, seen, fixedLoopOccurrences, armWithinLoop, guards);
    }
    return;
  }
  if (value instanceof TryCatchNode) {
    collectLowLevelCalls(value.expression, context, found, seen, fixedLoopOccurrences, conditionalWithinLoop, guards);
    collectLowLevelCalls(value.tryBlock, armContext, found, seen, fixedLoopOccurrences, armWithinLoop, guards);
    for (const clause of value.catchClauses) {
      collectLowLevelCalls(clause.block, armContext, found, seen, fixedLoopOccurrences, armWithinLoop, guards);
    }
    return;
  }

  for (const child of Object.values(value)) {
    const nestedConditional = conditionalWithinLoop
      || (context === 'loop' && isInstanceOfAny(value, CONDITIONAL_NODES));
    if (child instanceof Node) {
      collectLowLevelCalls(child, inner, found, seen, fixedLoopOccurrences, nestedConditional, guards);
    } else if (Array.isArray(child)) {
      for (const item of child) {
        collectLowLevelCalls(item, inner, found, seen, fixedLoopOccurrences, nestedConditional, guards);
      }
    }
  }
}

/**
 * Describe every low-level callsite in the same deterministic source order used by semantic slot allocation.
 *
 * This is metadata, not admission: consumers must still reject conditional and unbounded delegate frames until
 * the manifest has an explicit activation/cardinality encoding. Publishing the distinction prevents those
 * shapes from being mistaken for a singular frame merely because all three previously serialized identically.
 */
export function describeFunctionLowLevelCallsites(fn: FunctionDefinitionNode): readonly LowLevelCallsiteShape[] {
  const found: Callsite[] = [];
  collectLowLevelCalls(fn.body, 'unconditional', found);
  const visibleParameters = fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  return found.map((call) => {
    const condition = call.context === 'conditional' ? serializeGuards(call.guards, visibleParameters) : undefined;
    return {
      callMode: call.callMode,
      occurrence: call.context === 'unconditional' ? 'once' : call.context,
      ...(call.context === 'conditional' ? { maximumOccurrences: 1 }
        : call.fixedLoopOccurrences === undefined ? {}
          : { maximumOccurrences: call.fixedLoopOccurrences }),
      returnsResult: call.returnsResult,
      conditionalWithinLoop: call.conditionalWithinLoop,
      ...(condition !== undefined && { condition }),
    };
  });
}
