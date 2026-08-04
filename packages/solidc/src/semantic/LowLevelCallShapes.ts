import {
  BlockNode, BranchNode, CollectionIterationNode, ContractNode, DoWhileNode, FunctionDefinitionNode,
  FunctionCallNode, LowLevelCallNode, LowLevelCallStatementNode, MethodCallNode, MethodCallStatementNode, Node,
  SwitchNode, TernaryOpNode, TryCatchNode, WhileNode,
} from '../ast/AST.js';
import { SolidCashError } from '../Errors.js';
import { fixedForMaximum } from './FixedForLoop.js';

/**
 * X6 - stable diagnostics for unadmitted low-level call shapes.
 *
 * The admitted message-bus low-level class is exactly ONE unconditional `address.call(payload)`,
 * returning `address.call{value: amount}(payload)`, or `address.staticcall(payload)` per handler. The callManifest row
 * binds mode, target, calldata, result and the value-option bit; the transfer effect separately binds the
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
  conditionalWithinLoop: boolean,
): Callsite | undefined {
  if (node instanceof LowLevelCallNode || node instanceof LowLevelCallStatementNode) {
    return {
      node, callMode: node.callMode, options: declaredOptions(node.callOptions), context,
      returnsResult: node instanceof LowLevelCallNode, fixedLoopOccurrences, conditionalWithinLoop,
    };
  }
  if (node instanceof MethodCallNode || node instanceof MethodCallStatementNode) {
    const call = node instanceof MethodCallStatementNode ? node.call : node;
    if (!(call instanceof MethodCallNode)) return undefined;
    if (!LOW_LEVEL_METHOD_NAMES.has(call.methodName) || call.parameters.length !== 1) return undefined;
    return {
      node, callMode: call.methodName, options: declaredOptions(call.callOptions), context,
      returnsResult: node instanceof MethodCallNode, fixedLoopOccurrences, conditionalWithinLoop,
    };
  }
  if (node instanceof FunctionCallNode && node.parameters.length === 1) {
    const dot = node.identifier.name.lastIndexOf('.');
    const method = dot < 0 ? '' : node.identifier.name.slice(dot + 1);
    if (!LOW_LEVEL_METHOD_NAMES.has(method)) return undefined;
    return {
      node, callMode: method, options: [], context, returnsResult: true,
      fixedLoopOccurrences, conditionalWithinLoop,
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
): void {
  if (!(value instanceof Node) || seen.has(value)) return;
  seen.add(value);

  let inner = context;
  if (isInstanceOfAny(value, LOOP_NODES)) inner = 'loop';
  else if (context !== 'loop' && isInstanceOfAny(value, CONDITIONAL_NODES)) inner = 'conditional';

  const callsite = asCallsite(value, context, fixedLoopOccurrences, conditionalWithinLoop);
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
          conditionalWithinLoop || context === 'conditional',
        );
      } else {
        collectLowLevelCalls(
          statement, context, found, seen, fixedLoopOccurrences, conditionalWithinLoop,
        );
      }
    }
    return;
  }

  for (const child of Object.values(value)) {
    const nestedConditional = conditionalWithinLoop
      || (context === 'loop' && isInstanceOfAny(value, CONDITIONAL_NODES));
    if (child instanceof Node) {
      collectLowLevelCalls(child, inner, found, seen, fixedLoopOccurrences, nestedConditional);
    } else if (Array.isArray(child)) {
      for (const item of child) {
        collectLowLevelCalls(item, inner, found, seen, fixedLoopOccurrences, nestedConditional);
      }
    }
  }
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
    const admittedValue = node instanceof MethodCallNode
      && callMode === 'call' && options.length === 1 && options[0] === 'value';
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
