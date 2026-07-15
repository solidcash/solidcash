import {
  ContractNode, FunctionDefinitionNode, FunctionCallNode, MethodCallNode, IdentifierNode,
  NullaryOpNode, Node, SourceFileNode,
} from '../ast/AST.js';
import { NullaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Drops internal/private contract methods that BOTH read `msg.data` (transitively) AND are unreachable from any
 * entry point. Inherited OZ boilerplate ships `Context._msgData() { return msg.data; }` that most contracts never
 * call; msg.data is only reconstructible AT an entry point (the `__internal__redeemPushSize` covenant value is
 * out of reach inside an OP_DEFINE subroutine), so a DEAD `_msgData` would otherwise fail the whole compile with
 * MsgDataInSubroutineError even though it never runs.
 *
 * Scoped to the msg.data subgraph so nothing else is removed. Reachability is conservative by NAME (any call /
 * method / bare identifier keeps every method of that name) and every non-(internal|private) method is a root,
 * so a live method is never cut - a wrong prune surfaces as an undefined-reference error, never a silent
 * miscompile. Runs after inheritance + modifier expansion (so the flattened contract holds every inherited
 * method and modifier calls are already inlined into bodies), before semantic analysis.
 */
export default class PruneUnreachableMsgDataMethods extends AstTraversal {
  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) this.prune(node.contract);
    for (const ic of node.importedContracts ?? []) this.prune(ic);
    return node;
  }

  private prune(contract: ContractNode): void {
    const fns = contract.functions;
    if (fns.length === 0) return;
    const byName = new Map<string, FunctionDefinitionNode[]>();
    for (const fn of fns) { const l = byName.get(fn.name) ?? []; l.push(fn); byName.set(fn.name, l); }

    // Tainted = transitively reads msg.data. Seed with direct readers, then propagate to any method that calls a
    // tainted one (fixpoint), so a dead delegator to `_msgData` is caught too.
    const tainted = new Set<FunctionDefinitionNode>();
    for (const fn of fns) if (this.readsMsgData(fn)) tainted.add(fn);
    if (tainted.size === 0) return;
    for (let changed = true; changed;) {
      changed = false;
      for (const fn of fns) {
        if (tainted.has(fn)) continue;
        for (const name of this.referencedNames(fn.body)) {
          if ((byName.get(name) ?? []).some((c) => tainted.has(c))) { tainted.add(fn); changed = true; break; }
        }
      }
    }

    // Reachable = every non-(internal|private) method (public/external/unmarked entry points) + the constructor,
    // transitively by NAME. Anything a reached method names is kept.
    const reachable = new Set<FunctionDefinitionNode>();
    const seenName = new Set<string>();
    const queue: string[] = [];
    for (const fn of fns) if (this.isEntryPoint(fn)) { reachable.add(fn); this.collectNames(fn.body, queue); }
    if (contract.constructorDef) this.collectNames(contract.constructorDef.body, queue);
    while (queue.length > 0) {
      const name = queue.shift()!;
      if (seenName.has(name)) continue;
      seenName.add(name);
      for (const fn of byName.get(name) ?? []) {
        if (!reachable.has(fn)) { reachable.add(fn); this.collectNames(fn.body, queue); }
      }
    }

    // Prune only tainted-AND-unreachable methods (keep everything reachable OR not a msg.data reader).
    contract.functions = fns.filter((f) => reachable.has(f) || !tainted.has(f));
  }

  // Conservative: only a clearly internal/private method can be pruned; everything else is a reachable root.
  private isEntryPoint(fn: FunctionDefinitionNode): boolean {
    return fn.visibility !== 'internal' && fn.visibility !== 'private';
  }

  private readsMsgData(fn: FunctionDefinitionNode): boolean {
    let found = false;
    this.walk(fn.body, (n) => {
      if (n instanceof NullaryOpNode && n.operator === NullaryOperator.MSG_DATA) found = true;
    });
    return found;
  }

  private referencedNames(body: Node | undefined): string[] {
    const out: string[] = [];
    this.collectNames(body, out);
    return out;
  }

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
