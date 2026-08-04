import {
  Node,
  SourceFileNode,
  ContractNode,
  StateVariableNode,
  FunctionDefinitionNode,
  BlockNode,
  StatementNode,
  AssignNode,
  StateAssignNode,
  FunctionCallStatementNode,
  FunctionCallNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import { FunctionType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * A gratuitous INTERNAL function-pointer state-var alias: `function(..) internal .. ev; ev = f; ... ev(args)` where
 * ev is assigned exactly ONE contract function `f` and every other use is a call. Eliminate it - rewrite `ev(args)`
 * to `f(args)`, drop the `ev = f` writes, and remove the ev state var. `ev(args)` and `f(args)` are the same
 * internal call (ev holds f's functionId), so this is a semantics-preserving cleanup.
 *
 * Motivating case: store_function.sol's `ev = eval; return ev(x);`. A higher-order internal fn-ptr type
 * (`function(function(..) external ..) internal ..`) whose external-fn-ptr parameter would otherwise mismatch
 * eval's lowered `(address, bytes4)` signature at `ev = eval`; removing the alias sidesteps the type entirely and
 * lets `eval(x)` beta-reduce (InlineForeignFunctionPointerReturns). Runs FIRST, before any fn-ptr pass.
 */
export default class EliminateInternalFnPtrAlias extends AstTraversal {
  private functionNames = new Set<string>();
  private eliminated = new Map<string, string>(); // ev name -> the function f it aliases
  private contractName = '';

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.contractName = node.name;
    this.functionNames = new Set(node.functions.map((f) => f.name));
    const internalFnPtrVars = node.stateVariables.filter(
      (sv) => sv.type instanceof FunctionType && !(sv.type as FunctionType).isExternal,
    );
    if (internalFnPtrVars.length === 0) return node;

    const bodies = [node.constructorDef, ...node.functions, node.fallbackDef, node.receiveDef]
      .filter((f): f is FunctionDefinitionNode => !!f?.body);

    this.eliminated = new Map();
    for (const sv of internalFnPtrVars) {
      const f = this.classify(sv.name, bodies);
      if (f) this.eliminated.set(sv.name, f);
    }
    if (this.eliminated.size === 0) return node;

    node.stateVariables = node.stateVariables.filter((sv) => !this.eliminated.has(sv.name));
    for (const fn of bodies) fn.body = this.rewriteBlock(fn.body!);
    return node;
  }

  // ev is aliasable iff EVERY assignment is `ev = <a contract function>` (all the same function f) and every other
  // use of ev is a call `ev(args)`. Returns f, or undefined.
  private classify(name: string, bodies: FunctionDefinitionNode[]): string | undefined {
    let target: string | undefined;
    let ok = true;
    const refFns = new Set<string>(); // functions that reference ev (assign or call)
    for (const fn of bodies) {
      let refsHere = false;
      const walk = (n: Node): void => {
        if (this.aliasWriteName(n) === name) {
          refsHere = true;
          // `ev = <expr>` (bare or `this.`): must assign a single contract function.
          const rhs = (n as AssignNode | StateAssignNode).expression;
          if (rhs instanceof IdentifierNode && this.functionNames.has(rhs.name)) {
            if (target === undefined) target = rhs.name;
            else if (target !== rhs.name) ok = false;
          } else ok = false;
          return; // don't visit the LHS identifier (not a bare read); the RHS is a leaf function name
        }
        if (n instanceof FunctionCallNode && n.identifier instanceof IdentifierNode
          && this.callName(n.identifier.name) === name) {
          refsHere = true;
          n.parameters.forEach(walk); // a call `ev(args)` is fine; recurse only into the args
          return;
        }
        if (n instanceof IdentifierNode && n.name === name) { refsHere = true; ok = false; return; } // ev escapes
        for (const key of Object.keys(n)) {
          if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
          const v = (n as unknown as Record<string, unknown>)[key];
          if (v instanceof Node) walk(v);
          else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) walk(it);
        }
      };
      walk(fn.body!);
      if (refsHere) refFns.add(fn.name);
    }
    // Eliminate only a GRATUITOUS same-function alias (assigned + called in ONE function): a var referenced in
    // 2+ functions is a genuine persistent internal fn-ptr (set in one tx, called in another) - leave it.
    if (refFns.size > 1) return undefined;
    return ok && target ? target : undefined;
  }

  // The LHS var name of an `ev = ...` write (AssignNode `.identifier.name` or StateAssignNode `.name`), else undefined.
  private aliasWriteName(n: Node): string | undefined {
    if (n instanceof StateAssignNode) return n.name;
    if (n instanceof AssignNode && n.identifier instanceof IdentifierNode) return n.identifier.name;
    return undefined;
  }

  private rewriteBlock(block: BlockNode): BlockNode {
    const out: StatementNode[] = [];
    for (const stmt of block.statements ?? []) {
      // Drop `ev = f;` writes (bare or `this.`).
      const w = this.aliasWriteName(stmt);
      if (w !== undefined && this.eliminated.has(w)) continue;
      out.push(this.rewrite(stmt) as StatementNode);
    }
    block.statements = out;
    return block;
  }

  private rewrite(node: Node): Node {
    if (node instanceof BlockNode) return this.rewriteBlock(node);
    if (node instanceof FunctionCallStatementNode) { node.call = this.rewrite(node.call) as FunctionCallNode; return node; }
    if (node instanceof FunctionCallNode && node.identifier instanceof IdentifierNode
      && this.eliminated.has(this.callName(node.identifier.name))) {
      const f = new IdentifierNode(this.eliminated.get(this.callName(node.identifier.name))!); f.location = node.location;
      const fc = new FunctionCallNode(f, node.parameters.map((p) => this.rewrite(p) as ExpressionNode));
      fc.location = node.location;
      return fc;
    }
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) (node as unknown as Record<string, unknown>)[key] = this.rewrite(v);
      else if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) if (v[i] instanceof Node) v[i] = this.rewrite(v[i]);
      }
    }
    return node;
  }

  private callName(name: string): string {
    const prefix = `${this.contractName}.`;
    return name.startsWith(prefix) ? name.slice(prefix.length) : name;
  }
}
