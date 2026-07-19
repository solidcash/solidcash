import {
  FunctionDefinitionNode, VariableDefinitionNode, AssignNode, IdentifierNode,
  MethodCallNode, FunctionCallNode, Node,
} from '../ast/AST.js';
import { Type, AddressType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

// Hoist a BRANCH-LOCAL variable used as an interface-cast external-call target to the function-body top, so the
// co-spend can PICK it at the epilogue. UniswapV2Pair.mint:
//   if (_totalSupply == 0) { address migrator = factory.migrator(); if (msg.sender == migrator) {
//       liquidity = IMigrator(migrator).desiredLiquidity(); } }
// becomes `address migrator; if (..) { migrator = factory.migrator(); if (..) { .. } }`. The external calls stay
// exactly where they were (co-spent only when their branch runs, the already-working function-top-target shape) -
// only the DECLARATION moves up so `migrator` reaches the epilogue's emitExternalCallVerification. Was
// "Expected variable 'migrator' does not exist on the stack". SOUND by reduction: `migrator` is a single-assignment
// value from a self-pinned/param source, identical to a function-top target (extcall-target-pinning.md).
//
// Restricted to a CAST-form target `IFoo(x)` (unambiguously an external call) declared EXACTLY ONCE and NOT already
// at the function-body top - a using-for receiver (`x.add(y)`) or a multi-branch redeclaration is left untouched.
export default class HoistBranchLocalExtcallTargets extends AstTraversal {
  private walk(n: unknown, fn: (x: Node) => void): void {
    if (!n || typeof n !== 'object') return;
    if (n instanceof Node) fn(n);
    for (const k of Object.keys(n as object)) {
      if (k === 'type' || k === 'symbolTable' || k === 'location') continue;
      const v = (n as Record<string, unknown>)[k];
      if (Array.isArray(v)) v.forEach((it) => this.walk(it, fn));
      else if (v && typeof v === 'object') this.walk(v, fn);
    }
  }

  override visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (!node.body || !node.body.statements) return node;

    // 1. external-call target var names: the receiver of an interface method call `x.m()` / `IFoo(x).m()`, or of a
    // LOW-LEVEL call `x.call(data)` (a namespaced FunctionCall `x.call`, e.g. UniswapV2Pair `_safeTransfer`'s inlined
    // `__inl2_token.call(..)`). The AddressType filter below keeps only address/interface-typed receivers, so a
    // using-for receiver (`x.add(y)` where x is uint) is never hoisted.
    const lowLevel = new Set(['call', 'staticcall', 'delegatecall']);
    const targets = new Set<string>();
    this.walk(node.body, (n) => {
      if (n instanceof MethodCallNode) {
        const r = n.object;
        if (r instanceof IdentifierNode) targets.add(r.name);
        else if (r instanceof FunctionCallNode && r.parameters.length === 1 && r.parameters[0] instanceof IdentifierNode) {
          targets.add((r.parameters[0] as IdentifierNode).name);
        }
      } else if (n instanceof FunctionCallNode) {
        const nm = n.identifier.name;
        const dot = nm.lastIndexOf('.');
        if (dot > 0 && lowLevel.has(nm.slice(dot + 1)) && nm.slice(0, dot).indexOf('.') < 0) {
          targets.add(nm.slice(0, dot));
        }
      }
    });
    if (targets.size === 0) return node;

    // 2. among those: declared EXACTLY ONCE, NOT at the function-body top (nested in a branch/loop), and
    // address/interface-typed (an external-call target, not a using-for value receiver).
    const topNames = new Set(node.body.statements
      .filter((s) => s instanceof VariableDefinitionNode).map((s) => (s as VariableDefinitionNode).name));
    const declCount = new Map<string, number>();
    const declOf = new Map<string, VariableDefinitionNode>();
    this.walk(node.body, (n) => {
      if (n instanceof VariableDefinitionNode) {
        declCount.set(n.name, (declCount.get(n.name) ?? 0) + 1);
        declOf.set(n.name, n);
      }
    });
    const hoist = new Set([...targets].filter((t) => !topNames.has(t) && declCount.get(t) === 1
      && declOf.get(t)?.type instanceof AddressType));
    if (hoist.size === 0) return node;

    // 3. replace each nested `type x = init;` with `x = init;`, collecting the type for a body-top `type x;` decl.
    const hoistedTypes = new Map<string, Type>();
    const replace = (n: Node): void => {
      for (const k of Object.keys(n as object)) {
        if (k === 'type' || k === 'symbolTable' || k === 'location') continue;
        const v = (n as unknown as Record<string, unknown>)[k];
        if (Array.isArray(v)) {
          for (let i = 0; i < v.length; i += 1) {
            const it = v[i];
            if (it instanceof VariableDefinitionNode && hoist.has(it.name) && it.expression) {
              hoistedTypes.set(it.name, it.type);
              const id = new IdentifierNode(it.name);
              id.location = it.location;
              const assign = new AssignNode(id, it.expression);
              assign.location = it.location;
              v[i] = assign;
            } else if (it instanceof Node) replace(it);
          }
        } else if (v instanceof Node) replace(v);
      }
    };
    replace(node.body);
    if (hoistedTypes.size === 0) return node;

    const decls = [...hoistedTypes.entries()].map(([name, t]) => {
      const d = new VariableDefinitionNode(t, [], name);
      d.location = node.location;
      return d;
    });
    node.body.statements = [...decls, ...node.body.statements];
    return node;
  }
}
