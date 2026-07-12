import {
  Node,
  SourceFileNode,
  ContractNode,
  InterfaceNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  InstantiationNode,
  StateAssignNode,
  FunctionCallNode,
  FieldAccessNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import { FunctionType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * INTERPROCEDURAL deploy fold through a trivial STORE helper - the store_function core. A freshly-deployed
 * child's method is passed to a store helper (`store(y){ this.x = y; }`) which stashes it in a fn-ptr state var,
 * and the SAME transaction then calls it:
 *
 *   Other o = new Other();
 *   store(C(o).addTwo);        // helper: this.x = <the member>   (x stays a RECEIVED fn-ptr state var)
 *   x(7);                      // must FOLD - o is fresh, a UTXO output can't be an input of its own deploy tx
 *
 * The intraprocedural fold (LowerForeignFunctionPointerVars' sameFnFold) only fires on a DIRECT
 * `this.x = C(o).m`; here x is set THROUGH the helper. This pass restores that: it detects `store(C(o).m)` (o a
 * fresh deploy local, store a trivial fn-ptr-store helper) and rewrites the same-function `x(args)` to the direct
 * `o.m(args)` the deploy fold recognises. store is NOT inlined - x remains received for its (public) entry + later
 * txs; only the same-tx call reduces to the fold form. Runs BEFORE the arg-split, so the member is still one node.
 * Straight-line: the store must precede the call and x must not be otherwise reassigned in the function.
 */
export default class InterproceduralStoreFold extends AstTraversal {
  private typeNames = new Set<string>();
  private storeHelpers = new Map<string, string>(); // helper name -> the fn-ptr state field it stores its param into

  visitSourceFile(node: SourceFileNode): Node {
    this.typeNames = new Set();
    for (const iface of node.interfaceDefinitions as InterfaceNode[]) this.typeNames.add(iface.name);
    for (const c of node.importedContracts as ContractNode[]) this.typeNames.add(c.name);
    if (node.contract) this.typeNames.add(node.contract.name);
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.storeHelpers = new Map();
    for (const fn of node.functions) {
      const field = this.classifyStoreHelper(fn);
      if (field) this.storeHelpers.set(fn.name, field);
    }
    if (this.storeHelpers.size === 0) return node;
    for (const fn of [node.constructorDef, ...node.functions, node.fallbackDef, node.receiveDef]) {
      if (fn?.body) this.rewriteBody(fn);
    }
    return node;
  }

  // A trivial fn-ptr STORE helper: exactly one external fn-ptr param `y`, whose ONLY state write is
  // `this.<field> = y`, and y is not otherwise used. Returns the stored field name.
  private classifyStoreHelper(fn: FunctionDefinitionNode): string | undefined {
    if (!fn.body || fn.returnTypes.length !== 0) return undefined;
    const fnPtr = fn.parameters.filter((p) => p.type instanceof FunctionType && (p.type as FunctionType).isExternal);
    if (fnPtr.length !== 1) return undefined;
    const y = fnPtr[0].name;
    let field: string | undefined;
    let yUses = 0;
    let otherStateWrite = false;
    this.walk(fn.body, (n) => {
      if (n instanceof IdentifierNode && n.name === y) yUses += 1;
      if (n instanceof StateAssignNode) {
        if (n.expression instanceof IdentifierNode && n.expression.name === y) field = n.name;
        else otherStateWrite = true;
      }
    });
    return field && yUses === 1 && !otherStateWrite ? field : undefined;
  }

  private rewriteBody(fn: FunctionDefinitionNode): void {
    // fresh deploy locals: `T o = new T()`.
    const deployLocals = new Set<string>();
    this.walk(fn.body, (n) => {
      if (n instanceof VariableDefinitionNode && n.expression instanceof InstantiationNode) deployLocals.add(n.name);
    });
    if (deployLocals.size === 0) return;

    // field -> (deploy local, method): from `store(C(o).m)` where store stores into `field` and o is fresh.
    const fieldAlias = new Map<string, { local: string; method: string }>();
    this.walk(fn.body, (n) => {
      if (n instanceof FunctionCallNode && n.identifier instanceof IdentifierNode) {
        const field = this.storeHelpers.get(n.identifier.name);
        if (!field) return;
        const m = n.parameters.map((a) => this.foreignMember(a)).find((mm) => mm && deployLocals.has(mm.local));
        if (m) fieldAlias.set(field, m);
      }
    });
    if (fieldAlias.size === 0) return;

    // Rewrite same-function `x(args)` (a call on an aliased field) -> `o.m(args)` (the fold form).
    this.foldFieldCalls(fn.body!, fieldAlias);
  }

  private foldFieldCalls(root: Node, fieldAlias: Map<string, { local: string; method: string }>): void {
    const rewrite = (n: Node): Node => {
      if (n instanceof FunctionCallNode && n.identifier instanceof IdentifierNode) {
        const alias = fieldAlias.get(n.identifier.name);
        if (alias) {
          const id = new IdentifierNode(`${alias.local}.${alias.method}`); id.location = n.location;
          const fc = new FunctionCallNode(id, n.parameters.map((p) => rewrite(p) as ExpressionNode));
          fc.location = n.location;
          return fc;
        }
      }
      for (const key of Object.keys(n)) {
        if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) (n as unknown as Record<string, unknown>)[key] = rewrite(v);
        else if (Array.isArray(v)) {
          for (let i = 0; i < v.length; i++) if (v[i] instanceof Node) v[i] = rewrite(v[i]);
        }
      }
      return n;
    };
    rewrite(root);
  }

  // `C(o).method` -> { local: o, method } (o an identifier, C a known type name).
  private foreignMember(expr: ExpressionNode): { local: string; method: string } | undefined {
    if (!(expr instanceof FieldAccessNode)) return undefined;
    const base = expr.expression;
    if (!(base instanceof FunctionCallNode) || !(base.identifier instanceof IdentifierNode)) return undefined;
    if (base.parameters.length !== 1 || !this.typeNames.has(base.identifier.name)) return undefined;
    const addr = base.parameters[0];
    if (!(addr instanceof IdentifierNode)) return undefined;
    return { local: addr.name, method: expr.name };
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
