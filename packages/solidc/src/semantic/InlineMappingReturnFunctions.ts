import { MappingType } from '@solidcash/utils';
import {
  Node,
  SourceFileNode,
  ContractNode,
  BlockNode,
  StatementNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  AssignNode,
  IdentifierNode,
  ArrayAssignNode,
  MappingAssignNode,
  ReturnNode,
  FunctionCallNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

// A resolved reassignable-mapping-return function: the ordered side-effect statements its body performs, and the
// name of the mapping its returned pointer finally aliases.
interface Resolved { sideEffects: StatementNode[]; finalAlias: string; }

/**
 * Inlines a straight-line function that returns a `mapping storage` pointer reassigned across its body - the
 * `returns (mapping(K=>V) storage r)` idiom that a bare mapping alias (LowerMappingStorageAlias) cannot express
 * because the pointer is reassigned:
 *
 *   function f() internal returns (mapping(uint=>uint) storage r) { r = a; r[1] = 42; r = b; r[1] = 84; }
 *
 * A storage pointer has no runtime value, so the function is resolved by straight-line dataflow into its ordered
 * side effects (each `r[k] = v` bound to whichever mapping `r` aliases at that point) and the mapping its return
 * finally aliases (`b` above). At each call site the side effects are spliced in and the call replaced by that
 * final mapping, so a downstream `mapping storage m = f()` becomes a plain mapping alias LowerMappingStorageAlias
 * then resolves:
 *
 *   mapping storage m = f(); m[2] = 17;   ->   a[1]=42; b[1]=84; mapping storage m = b; m[2]=17;   ->  ...; b[2]=17;
 *
 * Runs after InlineStoragePointerCalls (multi-statement bodies are not single-return, so that pass leaves them)
 * and before LowerMappingStorageAlias. Only 0-arg straight-line bodies are resolved; anything else is left for a
 * later pass to reject.
 */
export default class InlineMappingReturnFunctions extends AstTraversal {
  private resolved = new Map<string, Resolved>();

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) {
      for (const fn of node.contract.functions) {
        const r = this.tryResolve(fn);
        if (r) this.resolved.set(fn.name, r);
      }
    }
    if (this.resolved.size === 0) return node;
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    node.functions = (this.visitList(node.functions) as FunctionDefinitionNode[])
      .filter((fn) => !this.resolved.has(fn.name)); // drop the resolved functions - fully inlined at call sites
    return node;
  }

  // Straight-line dataflow: walk the body tracking the pointer's current alias, collect its side effects, and the
  // mapping it finally aliases. Any statement that does not fit the reassignable-pointer shape aborts resolution.
  private tryResolve(fn: FunctionDefinitionNode): Resolved | undefined {
    if (fn.parameters.length > 0 || fn.returnTypes.length !== 1) return undefined;
    if (!(fn.returnTypes[0] instanceof MappingType) || !fn.body) return undefined;
    const alias = new Map<string, string>(); // pointer name -> mapping it currently aliases
    const pointers = new Set<string>();
    const sideEffects: StatementNode[] = [];
    let finalAlias: string | undefined;
    for (const stmt of fn.body.statements ?? []) {
      // `mapping storage r [= x];` - the returned pointer's declaration (a mapping-typed local is inherently a
      // storage pointer; NamedReturnTransformation injects it without an explicit `storage` modifier).
      if (stmt instanceof VariableDefinitionNode && stmt.type instanceof MappingType) {
        pointers.add(stmt.name);
        if (stmt.expression instanceof IdentifierNode) alias.set(stmt.name, stmt.expression.name);
        continue;
      }
      // `r = x;` - retarget the pointer alias.
      if (stmt instanceof AssignNode && pointers.has(stmt.identifier.name)) {
        if (!(stmt.expression instanceof IdentifierNode)) return undefined;
        alias.set(stmt.identifier.name, stmt.expression.name);
        continue;
      }
      // `r[k] = v;` (single or nested key) - a side effect on the aliased mapping.
      if (stmt instanceof ArrayAssignNode && alias.has(stmt.name)) {
        const n = new ArrayAssignNode(alias.get(stmt.name)!, this.c(stmt.index), this.c(stmt.value));
        sideEffects.push(this.at(n, stmt));
        continue;
      }
      if (stmt instanceof MappingAssignNode && alias.has(stmt.name)) {
        const n = new MappingAssignNode(alias.get(stmt.name)!, stmt.keys.map((k) => this.c(k)), this.c(stmt.expression));
        sideEffects.push(this.at(n, stmt));
        continue;
      }
      // `return r;` - the pointer's final alias is the returned mapping.
      if (stmt instanceof ReturnNode && stmt.expressions.length === 1
        && stmt.expressions[0] instanceof IdentifierNode && alias.has(stmt.expressions[0].name)) {
        finalAlias = alias.get((stmt.expressions[0] as IdentifierNode).name);
        continue;
      }
      // A statement not touching the pointer is an ordinary side effect; one that references it is unsupported.
      if (this.referencesAny(stmt, pointers)) return undefined;
      sideEffects.push(this.c(stmt));
    }
    if (!finalAlias) return undefined;
    return { sideEffects, finalAlias };
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const call = this.resolvedCall(stmt);
      // `mapping storage m = f();` -> splice f's side effects, then alias m to f's final mapping.
      if (stmt instanceof VariableDefinitionNode && call) {
        for (const se of call.sideEffects) out.push(this.c(se));
        stmt.expression = this.at(new IdentifierNode(call.finalAlias), stmt);
        out.push(stmt);
        continue;
      }
      out.push(this.visit(stmt) as StatementNode);
    }
    node.statements = out;
    return node;
  }

  // A call `f()` to a resolved function, wherever it sits in `stmt` - returns its resolution or undefined.
  private resolvedCall(stmt: StatementNode): Resolved | undefined {
    if (stmt instanceof VariableDefinitionNode && stmt.expression instanceof FunctionCallNode
      && this.resolved.has(stmt.expression.identifier.name)) {
      return this.resolved.get(stmt.expression.identifier.name);
    }
    return undefined;
  }

  private referencesAny(node: Node, names: Set<string>): boolean {
    if (node instanceof IdentifierNode && names.has(node.name)) return true;
    for (const key of Object.keys(node)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (node as any)[key];
      if (v instanceof Node && this.referencesAny(v, names)) return true;
      if (Array.isArray(v)) for (const it of v) if (it instanceof Node && this.referencesAny(it, names)) return true;
    }
    return false;
  }

  private c<T extends Node>(n: T): T { return cloneNode(n) as T; }

  private at<T extends Node>(n: T, from: Node): T { n.location = from.location; return n; }
}
