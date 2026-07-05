import { FunctionType } from '@solidcash/utils';
import {
  Node,
  SourceFileNode,
  ContractNode,
  BlockNode,
  StatementNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  MethodCallNode,
  MethodCallStatementNode,
  FieldAccessNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * Straight-line FOREIGN external function pointers. A `function(...) external f = IFoo(addr).method` targets
 * ANOTHER contract, so `f(args)` is a cross-contract call. When f is a simple compile-time alias (assigned once
 * to a foreign interface member, then called), desugar it to the existing external-call form - sound by
 * reduction to the tested external-call covenant + SDK path:
 *
 *   function() external f = IFoo(addr).method;   f(args)   ->   IFoo(addr).method(args)
 *
 * Self pointers (`this.f`) are handled earlier as internal OP_INVOKE and never reach here (they parse as
 * StateAccess, not a FieldAccess over an interface instance). A pointer that is reassigned, stored, or passed
 * is left untouched - its external FunctionType has no value representation yet, so the type checker reports it.
 * Only the straight-line alias case fires.
 */
export default class DesugarExternalFunctionPointers extends AstTraversal {
  private aliases = new Map<string, FieldAccessNode>();

  visitSourceFile(node: SourceFileNode): Node {
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const saved = this.aliases;
    this.aliases = new Map();
    if (node.body) {
      this.collectAliases(node.body);
      node.body = this.visit(node.body) as BlockNode;
    }
    this.aliases = saved;
    return node;
  }

  // Collect single-assignment foreign external-pointer aliases (`function(...) external f = IFoo(addr).method`).
  // A name defined more than once is dropped, so it stays a normal (type-checker-rejected) pointer.
  private collectAliases(node: Node): void {
    const seen = new Set<string>();
    const walk = (n: Node): void => {
      if (n instanceof VariableDefinitionNode && n.type instanceof FunctionType && n.type.isExternal
          && n.expression instanceof FieldAccessNode) {
        if (seen.has(n.name)) this.aliases.delete(n.name);
        else { this.aliases.set(n.name, n.expression); seen.add(n.name); }
      }
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    walk(node);
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      // Drop the alias declaration itself - its calls are rewritten to the external-call form. Guard with
      // has(): an uninitialized local has expression===undefined, which must not match a non-alias name.
      if (stmt instanceof VariableDefinitionNode && this.aliases.has(stmt.name)
          && this.aliases.get(stmt.name) === stmt.expression) continue;
      // A bare `f(args);` statement wraps the call; rewrite the wrapper to a method-call statement.
      if (stmt instanceof FunctionCallStatementNode && this.callAlias(stmt.call)) {
        const mc = this.rewriteCall(stmt.call);
        const mcs = new MethodCallStatementNode(mc);
        mcs.location = stmt.location;
        out.push(mcs);
        continue;
      }
      out.push(this.visit(stmt) as StatementNode);
    }
    node.statements = out;
    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    // `f(args)` in expression position (e.g. `require(f(z) == z)`) -> IFoo(addr).method(args).
    if (this.callAlias(node)) return this.rewriteCall(node);
    return super.visitFunctionCall(node);
  }

  private callAlias(node: FunctionCallNode): FieldAccessNode | undefined {
    const id = node.identifier;
    return id instanceof IdentifierNode ? this.aliases.get(id.name) : undefined;
  }

  private rewriteCall(node: FunctionCallNode): MethodCallNode {
    const fa = this.callAlias(node)!;
    const mc = new MethodCallNode(
      cloneNode(fa.expression) as ExpressionNode,
      fa.name,
      this.visitList(node.parameters) as ExpressionNode[],
    );
    mc.location = node.location;
    return mc;
  }
}
