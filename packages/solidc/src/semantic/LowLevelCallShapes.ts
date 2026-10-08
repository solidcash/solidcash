import {
  BlockNode, BoolLiteralNode, BranchNode, CastNode, CollectionIterationNode, ContractNode, DoWhileNode,
  FieldAccessNode, FunctionDefinitionNode, FunctionCallNode, IdentifierNode, IntLiteralNode, LowLevelCallNode,
  LowLevelCallStatementNode, MethodCallNode, MethodCallStatementNode, Node, ParameterNode, StateAccessNode,
  SwitchNode, TernaryOpNode, TryCatchNode, UnaryOpNode, BinaryOpNode, WhileNode, type ExpressionNode,
  type ExternalCallExpression,
} from '../ast/AST.js';
import { SolidCashError } from '../Errors.js';
import { fixedForMaximum } from './FixedForLoop.js';

/**
 * X6 - stable diagnostics for unadmitted low-level call shapes.
 *
 * The admitted message-bus low-level class is exactly ONE unconditional `address.call(payload)`,
 * returning `address.call{value: amount}(payload)`, or `address.staticcall(payload)` per handler. Solidity's
 * optional `gas` hint is inert on BCH, so it may accompany an otherwise admitted value transfer. The callManifest
 * row binds mode, target, calldata, result and the value-option bit; the transfer effect separately binds the
 * recipient and amount. No other option and no occurrence count is admitted.
 *
 * Everything outside that class currently reaches the user as an INTERNAL error from a later stage, naming a
 * compiler data structure rather than the source construct:
 *
 * | source shape                                   | leaked message today                                     |
 * |------------------------------------------------|----------------------------------------------------------|
 * | `addr.call{value: v}(payload)`                 | `Block slot not found: lowLevelCall[0]`                   |
 * | `addr.call{gas: g}(payload)`                   | `Block slot not found: lowLevelCall[0]`                   |
 * | `addr.staticcall{gas: g}(payload)`             | `Block slot not found: lowLevelCall[0]`                   |
 * | `addr.call(payload)` inside a loop, void form  | `Block slot not found: lowLevelCall[0]`                   |
 * | `addr.call(payload)` inside a branch, void     | `Block slot not found: lowLevelCall[0]`                   |
 * | `addr.call(payload)` inside a loop, returning  | `Runtime graph handler '__message_bus_graph_run' requires void ...`|
 * | `addr.call(payload)` inside a branch, returning| `Runtime graph handler '__message_bus_graph_run' requires void ...`|
 *
 * This module produces one stable, named diagnostic per shape instead, against the SOURCE function and the
 * source construct, before any route synthesis renames the handler.
 *
 * NOT YET WIRED. `validateLowLevelCallShapes` has no call site: the message-bus route is synthesized entirely
 * inside `compiler.ts`, which is a single-writer collision file. The wiring is one call from
 * `compileString`/`compileFile`, immediately after the message-bus graph mode is computed and before
 * `synthesizeMessageBusRoute`.
 */

/** Stable, exact rejection for a low-level call shape the message-bus route does not admit. */
export class LowLevelCallShapeError extends SolidCashError {
  constructor(node: Node, detail: string) {
    super(node, `Message-bus low-level call shape is not admitted: ${detail}`);
  }
}

/** Where a low-level callsite sits relative to control flow. */
type CallsiteContext = 'unconditional' | 'loop' | 'conditional';

/** One low-level callsite, in whichever representation the pipeline stage uses. */
interface Callsite {
  node: Node;
  callMode: string;
  options: string[];
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

/** The call options a callsite carries, in a stable order. */
const declaredOptions = (options: { value?: unknown; gas?: unknown; salt?: unknown } | undefined): string[] =>
  (options ? (['value', 'gas', 'salt'] as const).filter((name) => options[name] !== undefined) : []);

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
 * After lowering they are all `LowLevelCall*Node`. The module accepts every form so it is wireable anywhere in
 * the pipeline, and so it is testable without one.
 *
 * The pre-lowering match is by name and single argument, so a user function literally named `call`,
 * `staticcall` or `delegatecall` taking exactly one argument would also match. That is a deliberate trade for
 * diagnosing the source construct instead of a lowered artefact, and it can only produce a rejection for a
 * shape that already fails to compile.
 */
function asCallsite(
  node: Node, context: CallsiteContext, fixedLoopOccurrences: number | undefined,
  conditionalWithinLoop: boolean, guards: readonly PathGuard[],
): Callsite | undefined {
  if (node instanceof LowLevelCallNode || node instanceof LowLevelCallStatementNode) {
    return {
      node, callMode: node.callMode, options: declaredOptions(node.callOptions), context,
      returnsResult: node instanceof LowLevelCallNode, fixedLoopOccurrences, conditionalWithinLoop, guards,
    };
  }
  if (node instanceof MethodCallNode || node instanceof MethodCallStatementNode) {
    const call = node instanceof MethodCallStatementNode ? node.call : node;
    if (!(call instanceof MethodCallNode)) return undefined;
    if (!LOW_LEVEL_METHOD_NAMES.has(call.methodName) || call.parameters.length !== 1) return undefined;
    return {
      node, callMode: call.methodName, options: declaredOptions(call.callOptions), context,
      returnsResult: node instanceof MethodCallNode, fixedLoopOccurrences, conditionalWithinLoop, guards,
    };
  }
  if (node instanceof FunctionCallNode && node.parameters.length === 1) {
    const dot = node.identifier.name.lastIndexOf('.');
    const method = dot < 0 ? '' : node.identifier.name.slice(dot + 1);
    if (!LOW_LEVEL_METHOD_NAMES.has(method)) return undefined;
    return {
      node, callMode: method, options: [], context, returnsResult: true,
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

/**
 * Reject every low-level call shape the message-bus route does not admit, in one pass over one function.
 *
 * `delegatecall` is deliberately NOT checked here: it is a delegate participant edge with its own class
 * enumeration and its own authority argument, not a callManifest-bound low-level row.
 */
export function validateFunctionLowLevelCallShapes(fn: FunctionDefinitionNode): void {
  const found: Callsite[] = [];
  collectLowLevelCalls(fn.body, 'unconditional', found);
  const rows = found.filter((entry) => entry.callMode !== 'delegatecall');
  if (rows.length === 0) return;

  for (const {
    node, callMode, options, context, returnsResult, fixedLoopOccurrences, conditionalWithinLoop,
  } of rows) {
    const admittedValue = callMode === 'call' && options.includes('value')
      && options.every((option) => option === 'value' || option === 'gas');
    if (options.length > 0 && !admittedValue) {
      throw new LowLevelCallShapeError(
        node,
        `function '${fn.name}' issues a low-level '${callMode}' carrying the call option(s) `
        + `${options.map((name) => `'${name}'`).join(', ')}. A callManifest row binds mode, target, calldata and `
        + 'result, and has no field for a call option, so the option would execute unbound. Move the option out '
        + 'of the message-bus handler, or use a typed interface call whose transfer is a block slot',
      );
    }
    if (context === 'loop') {
      if (fixedLoopOccurrences === 0) {
        throw new LowLevelCallShapeError(
          node, `function '${fn.name}' issues a low-level '${callMode}' inside a literal loop with zero `
          + 'occurrences. A graph edge must publish at least one reached row',
        );
      }
      if (fixedLoopOccurrences !== undefined && fixedLoopOccurrences > 24) {
        throw new LowLevelCallShapeError(
          node, `function '${fn.name}' issues a low-level '${callMode}' inside a literal loop with `
          + `${fixedLoopOccurrences} occurrences, exceeding the callManifest v1 limit of 24`,
        );
      }
      const admittedLiteralLoop = returnsResult && options.length === 0
        && fixedLoopOccurrences !== undefined && fixedLoopOccurrences > 0
        && !conditionalWithinLoop && (callMode === 'call' || callMode === 'staticcall');
      if (admittedLiteralLoop) continue;
      throw new LowLevelCallShapeError(
        node,
        `function '${fn.name}' issues a low-level '${callMode}' inside a loop. A low-level row proves ONE `
        + 'decoded payload and publishes no occurrence bound, so an iterated callsite would be expanded as '
        + 'exactly one row whatever its runtime trip count. Hoist the call out of the loop, or use a typed '
        + 'interface call in a compiler-bounded pointer-table loop',
      );
    }
    if (context === 'conditional') {
      // A value-only call is settled by the independently bound satoshi-transfer effect. Its EVM success tuple
      // is true exactly when that required output exists, so it does not need an opaque callee row merely to
      // model the recipient's fallback execution (BCH executes the recipient only when that output is spent).
      if (admittedValue) continue;
      throw new LowLevelCallShapeError(
        node,
        `function '${fn.name}' issues a low-level '${callMode}' inside a branch. A callManifest row is either `
        + 'present or absent for the whole handler, so a conditionally reached callsite has no row that means '
        + '"not taken". Make the callsite unconditional, or split the branch into two handlers',
      );
    }
  }

  if (rows.length > 1) {
    throw new LowLevelCallShapeError(
      rows[1].node,
      `function '${fn.name}' issues ${rows.length} low-level calls. The admitted class is exactly one per `
      + 'handler, because one opaque result cannot be bound to more than one consumer callsite',
    );
  }
}

/**
 * Reject every unadmitted low-level call shape in a contract compiled for the message-bus route.
 *
 * Call this only when the message-bus graph mode is on: the direct (non-graph) route compiles call options and
 * iterated low-level calls today, and this function must not change that.
 */
export function validateLowLevelCallShapes(contract: ContractNode): void {
  for (const fn of contract.functions) {
    if (fn.isAbstract) continue;
    validateFunctionLowLevelCallShapes(fn);
  }
}
