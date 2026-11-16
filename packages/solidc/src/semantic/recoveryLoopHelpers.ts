import {
  ContractNode, DoWhileNode, FunctionCallNode, FunctionDefinitionNode, Node, WhileNode,
} from '../ast/AST.js';
import { GlobalFunction } from '../ast/Globals.js';
import { inlineKey } from './inlineOverloadGuard.js';

const SKIPPED_KEYS = new Set([
  'type', 'symbolTable', 'location', 'resolvedFunction', 'functionReference', 'definition', 'referencedContract',
  'stateVariable', 'collection', 'sourceCallNode', 'sourceActivationConditions',
]);

const RECOVERIES = new Set<string>([
  GlobalFunction.ECRECOVER_PUBKEY, GlobalFunction.ECRECOVER_P2PKH, GlobalFunction.ECRECOVER_EVM,
]);

/** Each call in `root`, with whether a `while` or `do` loop of `root` encloses it (a `for` is a `while` by now). */
function forEachCall(root: Node, visit: (call: FunctionCallNode, inLoop: boolean) => void): void {
  const seen = new Set<Node>();
  const walk = (node: Node, loops: number): void => {
    if (seen.has(node)) return;
    seen.add(node);
    const depth = loops + (node instanceof WhileNode || node instanceof DoWhileNode ? 1 : 0);
    if (node instanceof FunctionCallNode) visit(node, depth > 0);
    for (const [key, value] of Object.entries(node)) {
      if (SKIPPED_KEYS.has(key)) continue;
      if (value instanceof Node) walk(value, depth);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item, depth);
    }
  };
  walk(root, 0);
}

/**
 * The helpers whose recoveries run inside a loop of a stateful contract's function once they are inlined: a helper
 * called in a loop, a helper called from such a helper, and a helper that holds a loop around a recovery itself.
 *
 * Behind OP_INVOKE a helper's recovery reads the one triple its call edge names, a fixed slot of the caller's block, on
 * every iteration, so iterations with other arguments cannot all be laid out. Inlined, the recovery is one the entry
 * makes in its own loop, which reads one triple per recovery after the block (`ecrecoverTrailingLoop`) and binds each
 * triple's argument blob to that iteration's (hash, v, r, s).
 *
 * A stateless contract and a framed compile keep their helpers, and so does a helper the constructor calls (a
 * constructor's loop reads no triple after its block) or one whose name and arity another overload shares. A
 * compiler-owned function (`__`: a message-bus route, its clones and handlers, the deployer's `__construct`) is neither
 * a call site nor a helper here: a route's row loop dispatches calls, and no recovery loop runs in a route.
 */
export function recoveryLoopHelpers(contract: ContractNode, freeFunctions: readonly FunctionDefinitionNode[]): Set<string> {
  const stateful = contract.stateVariables.length > 0 || contract.collections.length > 0
    || contract.eventDefinitions.length > 0;
  if (!stateful) return new Set();
  const functions = [...contract.functions, ...freeFunctions];
  const byKey = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of functions) {
    const key = inlineKey(fn.name, fn.parameters.length);
    byKey.set(key, [...(byKey.get(key) ?? []), fn]);
  }
  const targets = (call: FunctionCallNode): FunctionDefinitionNode[] => (
    byKey.get(inlineKey(call.identifier.name, call.parameters.length)) ?? []);
  const isRecovery = (call: FunctionCallNode): boolean => RECOVERIES.has(call.identifier.name)
    || (call.identifier.name === 'ecrecover' && call.parameters.length === 4 && targets(call).length === 0);

  const recovering = new Map<FunctionDefinitionNode, boolean>();
  const recovers = (fn: FunctionDefinitionNode, visiting = new Set<FunctionDefinitionNode>()): boolean => {
    const known = recovering.get(fn);
    if (known !== undefined) return known;
    if (!fn.body || visiting.has(fn)) return false;
    visiting.add(fn);
    let found = false;
    forEachCall(fn.body, (call) => {
      if (!found && (isRecovery(call) || targets(call).some((target) => target !== fn && recovers(target, visiting)))) {
        found = true;
      }
    });
    visiting.delete(fn);
    recovering.set(fn, found);
    return found;
  };

  const owned = (fn: FunctionDefinitionNode): boolean => fn.name.startsWith('__') || fn.messageBusRoute === true
    || fn.graphEmissionHandler === true;
  const constructors = [contract.constructorDef, ...contract.functions.filter((fn) => fn.name === '__construct')];
  const reached = new Set<FunctionDefinitionNode>();
  for (const fn of contract.functions) {
    if (!fn.body || owned(fn)) continue;
    forEachCall(fn.body, (call, inLoop) => {
      if (!inLoop) return;
      for (const target of targets(call)) if (target !== fn && recovers(target)) reached.add(target);
    });
  }
  // A helper that loops over a recovery itself moves that loop into its caller.
  for (const fn of functions) {
    if (!fn.body || fn.isEntryPoint || owned(fn)) continue;
    forEachCall(fn.body, (call, inLoop) => {
      if (inLoop && (isRecovery(call) || targets(call).some((target) => target !== fn && recovers(target)))) {
        reached.add(fn);
      }
    });
  }
  // The helpers an inlined one calls are called in the loop it lands in.
  const pending = [...reached];
  while (pending.length > 0) {
    const fn = pending.pop()!;
    if (!fn.body) continue;
    forEachCall(fn.body, (call) => {
      for (const target of targets(call)) {
        if (target === fn || reached.has(target) || !recovers(target)) continue;
        reached.add(target);
        pending.push(target);
      }
    });
  }
  const constructed = new Set<FunctionDefinitionNode>();
  for (const ctor of constructors) {
    if (!ctor?.body) continue;
    forEachCall(ctor.body, (call) => { for (const target of targets(call)) constructed.add(target); });
  }
  // A name two overloads of one arity share cannot be inlined by name and arity: those keep their subroutines.
  const ambiguous = (fn: FunctionDefinitionNode): boolean => (
    (byKey.get(inlineKey(fn.name, fn.parameters.length))?.length ?? 0) > 1);
  return new Set([...reached].filter((fn) => !owned(fn) && !constructed.has(fn) && !ambiguous(fn)).map((fn) => fn.name));
}
