import {
  Ast, FunctionDefinitionNode, FunctionModifier, Node, ContractNode,
  LowLevelCallNode, LowLevelCallStatementNode,
  TransferStatementNode, AddressTransferStatementNode, TokenContainerMethodStatementNode,
} from '../ast/AST.js';
import { containsStatefulOperation } from './EnsureFinalRequireTraversal.js';

/**
 * Marks the functions that CAN act as a proxy implementation with FunctionModifier.DELEGATE, so `delegate` is
 * never written in source (Solidity has no such keyword: an implementation contract is an ordinary contract,
 * and the proxy decides at runtime).
 *
 * On BCH the mode cannot be decided at runtime - a delegate function writes a CO-SPENT proxy's state instead of
 * its own, which is different locking bytecode. So the compiler emits the contract twice: the standalone
 * artifact, and (when this pass marks anything) a delegate variant carried as artifact.delegateArtifact. The
 * SDK picks the variant when the contract is used behind a proxy. See docs/delegate-modifier-drop-evaluation.md.
 *
 * Mirrors the auto-marking already done for state-touching `library` declarations in AstBuilder.
 */

// Modifiers that make delegate mode meaningless or unsound. These were hard errors in combination with an
// explicit `delegate` (InvalidModifierCombinationError); as an inference rule they simply skip the function.
const INELIGIBLE_MODIFIERS = [
  FunctionModifier.PURE, FunctionModifier.VIEW, FunctionModifier.INTERNAL, FunctionModifier.PRIVATE,
  FunctionModifier.UNSAFE, FunctionModifier.UPGRADE, FunctionModifier.DEPLOY, FunctionModifier.SELFDESTRUCT,
  FunctionModifier.SPLIT, FunctionModifier.MERGE, FunctionModifier.DELEGATE,
];

function walk(node: Node | undefined, seen: Set<Node>, hit: (n: Node) => boolean): boolean {
  if (!node || seen.has(node)) return false;
  seen.add(node);
  if (hit(node)) return true;
  for (const v of Object.values(node)) {
    if (v instanceof Node) {
      if (walk(v, seen, hit)) return true;
    } else if (Array.isArray(v)) {
      for (const e of v) if (e instanceof Node && walk(e, seen, hit)) return true;
    }
  }
  return false;
}

/**
 * A function only benefits from delegate mode if it touches state the proxy owns - that is what gets delegated.
 * Uses the shared definition (state writes, emits, low-level calls); an emit is included because the event NFT
 * lands in the PROXY's block, so it does need retargeting.
 *
 * Typed external calls are deliberately NOT counted. They cannot be seen here anyway (ExternalFunctionCallNode
 * is built inside SymbolTableTraversal, which runs after this pass), and they do not need to be: an external
 * call mutates the CALLEE's state, never the proxy's, so it has nothing to delegate.
 */
function touchesProxyState(fn: FunctionDefinitionNode): boolean {
  return containsStatefulOperation(fn.body?.statements);
}

function bodyHasUnsupportedOperation(fn: FunctionDefinitionNode): boolean {
  return walk(fn.body, new Set(), (n) => n instanceof TransferStatementNode
    || n instanceof AddressTransferStatementNode
    || n instanceof TokenContainerMethodStatementNode);
}

/** Every name mentioned anywhere in the body, used to find the internal helpers a function reaches. */
function referencedNames(fn: FunctionDefinitionNode): Set<string> {
  const names = new Set<string>();
  walk(fn.body, new Set(), (n) => {
    const candidate = n as unknown as { name?: unknown; methodName?: unknown; identifier?: { name?: unknown } };
    if (typeof candidate.name === 'string') names.add(candidate.name);
    if (typeof candidate.methodName === 'string') names.add(candidate.methodName);
    if (typeof candidate.identifier?.name === 'string') names.add(candidate.identifier.name);
    return false; // visit everything; never short-circuit
  });
  return names;
}

/**
 * Value transfers and token-container operations do not execute in delegate mode: the delegate input fails its
 * covenant (OP_VERIFY). This is a pre-existing limitation of the delegate codegen, reproducible with the
 * hand-written `delegate` modifier, and it poisons the whole function - a state write PLUS a transfer fails too.
 * Disqualify them so the failure is `asDelegate()` throwing at build time rather than an opaque script failure
 * at broadcast. Revisit when delegate-mode value preservation is fixed.
 *
 * Follows internal helpers transitively: an entry point whose own body is clean still cannot run in delegate
 * mode if a helper it calls transfers. Name matching is deliberately coarse (a name that merely collides with a
 * function walks one extra body); an over-match only costs a delegate build, an under-match ships a broken one.
 */
function hasUnsupportedDelegateOperation(
  fn: FunctionDefinitionNode, callables: readonly FunctionDefinitionNode[],
): boolean {
  const visited = new Set<FunctionDefinitionNode>();
  const queue: FunctionDefinitionNode[] = [fn];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (bodyHasUnsupportedOperation(current)) return true;
    const names = referencedNames(current);
    for (const callee of callables) {
      if (!visited.has(callee) && names.has(callee.name)) queue.push(callee);
    }
  }
  return false;
}

/** A delegate function may not itself issue a delegatecall: that path skips every state covenant. */
function hasDelegatecall(fn: FunctionDefinitionNode): boolean {
  return walk(fn.body, new Set(), (n) => (
    n instanceof LowLevelCallNode || n instanceof LowLevelCallStatementNode
  ) && n.callMode === 'delegatecall'
    && !(n instanceof LowLevelCallStatementNode && n.synthesizedFromLibraryCall));
}

export function isDelegateEligible(
  fn: FunctionDefinitionNode, callables: readonly FunctionDefinitionNode[] = [],
): boolean {
  if (!fn.isEntryPoint || fn.isFreeFunction) return false;
  // A delegate impl is reached through the proxy's own fallback dispatch, never through its own.
  if (fn.isFallback || fn.isReceive) return false;
  if (fn.modifiers.some((m) => INELIGIBLE_MODIFIERS.includes(m))) return false;
  // Note: touchesProxyState looks at this body only. Missing a helper-only state write just means no delegate
  // build (fail closed); missing a helper-only transfer would ship a broken one, so THAT check follows calls.
  if (!touchesProxyState(fn)) return false;
  if (hasUnsupportedDelegateOperation(fn, callables)) return false;
  if (hasDelegatecall(fn)) return false;
  return true;
}

function isStateful(contract: ContractNode, forceStateful: boolean): boolean {
  return contract.stateVariables.length > 0 || contract.collections.length > 0
    || contract.eventDefinitions.length > 0 || contract.usesBlockhash || forceStateful;
}

/**
 * Push DELEGATE onto every eligible function of the primary contract. Returns the number marked; 0 means this
 * contract cannot serve as a proxy implementation and no delegate variant should be compiled for it.
 */
export default function autoMarkDelegateFunctions(ast: Ast, forceStateful = false): number {
  const contract = ast.contract;
  if (!contract || !isStateful(contract, forceStateful)) return 0;

  // Contract methods plus file-level free functions: either can host a helper that transfers.
  const callables = [...contract.functions, ...(ast.freeFunctions ?? [])];

  let marked = 0;
  for (const fn of contract.functions) {
    if (!isDelegateEligible(fn, callables)) continue;
    fn.modifiers.push(FunctionModifier.DELEGATE);
    marked += 1;
  }
  return marked;
}
