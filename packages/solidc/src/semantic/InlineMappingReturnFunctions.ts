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
  ExpressionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

// A resolved reassignable-mapping-return call: the ordered side-effect statements its body performs (with the
// callee's params already substituted by the call's args), and the mapping its returned pointer finally aliases.
interface Resolved { sideEffects: StatementNode[]; finalAlias: string; }

/**
 * Inlines a straight-line function that returns a `mapping storage` pointer reassigned across its body - the
 * `returns (mapping(K=>V) storage r)` idiom that a bare mapping alias (LowerMappingStorageAlias) cannot express
 * because the pointer is reassigned:
 *
 *   function f() internal returns (mapping(uint=>uint) storage r) { r = a; r[1] = 42; r = b; r[1] = 84; }
 *   // or, from a library, with the two mappings passed by storage reference:
 *   function Lib.f(mapping storage a, mapping storage b) internal returns (mapping storage r) { r=a; ...; r=b; ... }
 *
 * A storage pointer has no runtime value, so the function is resolved (per call site, its params bound to the call
 * args) by straight-line dataflow into its ordered side effects - each `r[k] = v` bound to whichever mapping `r`
 * aliases at that point - and the mapping its return finally aliases. At each call site the side effects are
 * spliced in and the call replaced by that final mapping, so a downstream `mapping storage m = f()` becomes a bare
 * mapping alias LowerMappingStorageAlias then resolves:
 *
 *   mapping storage m = f(); m[2]=17;   ->   a[1]=42; b[1]=84; mapping storage m = b; m[2]=17;   ->  ...; b[2]=17;
 *
 * Runs after InlineStoragePointerCalls (multi-statement bodies are not single-return, so that pass leaves them)
 * and before LowerMappingStorageAlias. Only straight-line bodies whose args are plain mapping identifiers are
 * resolved; anything else is left for a later pass to reject.
 */
export default class InlineMappingReturnFunctions extends AstTraversal {
  private candidates = new Map<string, FunctionDefinitionNode>();

  visitSourceFile(node: SourceFileNode): Node {
    const collect = (fns: FunctionDefinitionNode[] | undefined): void => {
      for (const fn of fns ?? []) if (this.isCandidate(fn)) this.candidates.set(fn.name, fn);
    };
    if (node.contract) collect(node.contract.functions);
    collect(node.freeFunctions);
    if (this.candidates.size === 0) return node;
    node.freeFunctions = (node.freeFunctions ?? []).filter((f) => !this.candidates.has(f.name));
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    node.functions = (this.visitList(node.functions) as FunctionDefinitionNode[])
      .filter((fn) => !this.candidates.has(fn.name)); // drop the resolved functions - fully inlined at call sites
    return node;
  }

  // A mapping-returning function with a body - a potential reassignable-pointer return (single-return ones are
  // already inlined + dropped by InlineStoragePointerCalls, so only reassignable multi-statement bodies reach here).
  private isCandidate(fn: FunctionDefinitionNode): boolean {
    return fn.returnTypes.length === 1 && fn.returnTypes[0] instanceof MappingType && !!fn.body;
  }

  // Resolve a candidate at a call site: bind params to the call args (plain mapping identifiers), then walk the
  // body by straight-line dataflow. Any statement that does not fit the reassignable-pointer shape aborts.
  private resolveCall(fn: FunctionDefinitionNode, args: ExpressionNode[]): Resolved | undefined {
    if (args.length !== fn.parameters.length) return undefined;
    const paramMap = new Map<string, string>();
    for (let i = 0; i < args.length; i += 1) {
      const a = args[i];
      if (!(a instanceof IdentifierNode)) return undefined; // only mapping-identifier args carry a storage reference
      paramMap.set(fn.parameters[i].name, a.name);
    }
    const stmts = (fn.body!.statements ?? []).map((s) => this.renameParams(this.c(s), paramMap));
    const alias = new Map<string, string>(); // pointer name -> mapping it currently aliases
    const pointers = new Set<string>();
    const sideEffects: StatementNode[] = [];
    let finalAlias: string | undefined;
    for (const stmt of stmts) {
      // `mapping storage r [= x];` - the returned pointer's declaration (a mapping-typed local is a storage pointer;
      // NamedReturnTransformation injects it without an explicit `storage` modifier).
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
      sideEffects.push(stmt);
    }
    if (!finalAlias) return undefined;
    return { sideEffects, finalAlias };
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      // `mapping storage m = f(args);` -> splice f's side effects, then alias m to f's final mapping.
      if (stmt instanceof VariableDefinitionNode && stmt.expression instanceof FunctionCallNode) {
        const fn = this.candidates.get(stmt.expression.identifier.name);
        const res = fn && this.resolveCall(fn, stmt.expression.parameters);
        if (res) {
          for (const se of res.sideEffects) out.push(this.c(se));
          stmt.expression = this.at(new IdentifierNode(res.finalAlias), stmt);
          out.push(stmt);
          continue;
        }
      }
      out.push(this.visit(stmt) as StatementNode);
    }
    node.statements = out;
    return node;
  }

  // Rename callee param identifiers to the call's arg names, in place on an already-cloned node.
  private renameParams(node: Node, map: Map<string, string>): Node {
    if (node instanceof IdentifierNode && map.has(node.name)) node.name = map.get(node.name)!;
    for (const key of Object.keys(node)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (node as any)[key];
      if (v instanceof Node) this.renameParams(v, map);
      else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) this.renameParams(it, map);
    }
    return node;
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
