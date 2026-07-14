import {
  FunctionCallNode,
  FunctionDefinitionNode,
  IdentifierNode,
  MethodCallNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  Node,
  SourceFileNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Drops free (library) functions that are BOTH unreachable from the primary contract AND (transitively)
 * perform a low-level call. Solidity/OZ libraries ship many unused helpers; an unused low-level-call helper
 * (e.g. SafeERC20.forceApprove -> _callOptionalReturnBool when the contract only uses safeTransfer) injects
 * synthetic covenant params (__internal__callInputIndex) that its dead caller cannot supply, surfacing as a
 * spurious arg-count error on code that never runs.
 *
 * Scoped to the low-level-call subgraph so nothing else is ever removed: operator overloads, math helpers, and
 * ordinary library functions have no low-level call and are always kept (no reachability false-negative can drop
 * them). Reachability is conservative by NAME - a member call `x.m(..)` keeps every free fn named `*.m`, a bare
 * identifier `f` every `*.f`, and every using-for-bound function name is a root - so a live helper is never cut.
 * Runs pre-semantic, after all synthesis passes. A library-only compilation (no contract) is left untouched.
 */
export default class PruneUnreachableFreeFunctions extends AstTraversal {
  visitSourceFile(node: SourceFileNode): Node {
    const freeFns = node.freeFunctions ?? [];
    if (freeFns.length === 0 || !node.contract) return node;

    const byName = this.indexByName(freeFns);

    // Tainted = transitively performs a low-level call. Seed with direct low-level calls, then propagate to any
    // free function that calls a tainted one (fixpoint), so a pure delegator like `forceApprove` is caught too.
    const tainted = new Set<FunctionDefinitionNode>();
    for (const fn of freeFns) if (this.hasDirectLowLevelCall(fn)) tainted.add(fn);
    for (let changed = true; changed;) {
      changed = false;
      for (const fn of freeFns) {
        if (tainted.has(fn)) continue;
        for (const name of this.referencedNames(fn.body)) {
          if ((byName.get(name) ?? []).some((c) => tainted.has(c))) { tainted.add(fn); changed = true; break; }
        }
      }
    }
    if (tainted.size === 0) return node;

    // Reachable = named anywhere in the contract, in any using-for binding, or transitively from a reached fn.
    const reachable = new Set<FunctionDefinitionNode>();
    const seenName = new Set<string>();
    const queue: string[] = [];
    this.collectNames(node.contract, queue);
    for (const d of [...(node.contract.usingForDirectives ?? []), ...(node.usingForDirectives ?? [])]) {
      for (const b of d.functionBindings ?? []) queue.push(b.funcName);
    }
    while (queue.length > 0) {
      const name = queue.shift()!;
      if (seenName.has(name)) continue;
      seenName.add(name);
      for (const fn of byName.get(name) ?? []) {
        if (!reachable.has(fn)) { reachable.add(fn); this.collectNames(fn.body, queue); }
      }
    }

    node.freeFunctions = freeFns.filter((f) => reachable.has(f) || !tainted.has(f));
    return node;
  }

  private indexByName(freeFns: FunctionDefinitionNode[]): Map<string, FunctionDefinitionNode[]> {
    const byName = new Map<string, FunctionDefinitionNode[]>();
    const index = (key: string, fn: FunctionDefinitionNode): void => {
      const list = byName.get(key) ?? [];
      list.push(fn);
      byName.set(key, list);
    };
    for (const fn of freeFns) {
      index(fn.name, fn);
      const dot = fn.name.lastIndexOf('.');
      if (dot >= 0) index(fn.name.slice(dot + 1), fn);
    }
    return byName;
  }

  // A body directly performs a low-level call: `a.call(d)` is a namespaced FunctionCall (`a.call`),
  // `a.call{value:}(d)` a MethodCall; the dedicated LowLevelCall nodes are synthesized later.
  private hasDirectLowLevelCall(fn: FunctionDefinitionNode): boolean {
    const isLL = (m: string): boolean => m === 'call' || m === 'staticcall' || m === 'delegatecall';
    let found = false;
    this.walk(fn.body, (n) => {
      if (found) return;
      if (n instanceof LowLevelCallNode || n instanceof LowLevelCallStatementNode) { found = true; return; }
      if (n instanceof FunctionCallNode) {
        const dot = n.identifier.name.lastIndexOf('.');
        if (dot > 0 && isLL(n.identifier.name.slice(dot + 1))) found = true;
      } else if (n instanceof MethodCallNode && isLL(n.methodName)) found = true;
    });
    return found;
  }

  private referencedNames(body: Node | undefined): string[] {
    const out: string[] = [];
    this.collectNames(body, out);
    return out;
  }

  // Append every call/method/identifier name in the subtree to `out`.
  private collectNames(node: Node | undefined, out: string[]): void {
    this.walk(node, (n) => {
      if (n instanceof FunctionCallNode) out.push(n.identifier.name);
      else if (n instanceof MethodCallNode) out.push(n.methodName);
      else if (n instanceof IdentifierNode) out.push(n.name);
    });
  }

  private walk(node: Node | undefined, visit: (n: Node) => void): void {
    if (!node) return;
    visit(node);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) this.walk(v, visit);
      else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) this.walk(it, visit);
    }
  }
}
