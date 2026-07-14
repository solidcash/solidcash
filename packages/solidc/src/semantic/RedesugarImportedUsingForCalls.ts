import {
  ContractNode,
  FunctionCallNode,
  FunctionDefinitionNode,
  IdentifierNode,
  Node,
  SourceFileNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import { StructType, Type } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * A `using L for Struct` method call on a variable whose struct type was IMPORTED is not desugared by the
 * AstBuilder - the AstBuilder needs the receiver's struct type at PARSE time (localStructTypes / stateStructVars),
 * but an imported struct is unknown then, so `escrowIdCounter.increment()` is left as a raw namespaced
 * `escrowIdCounter.increment` FunctionCall. Now that imports are merged and placeholder types re-resolved
 * (reresolveImportedStructTypes), redo that desugar: `X.Y(args) -> L.Y(X, args)`.
 *
 * Must run PRE-SEMANTIC and before InlineStoragePointerCalls, because a using-for library method typically takes
 * a `T storage` pointer (e.g. `Counters.increment(Counter storage)`) which is inlined-and-dropped there; if the
 * call is not rewritten before then, its target no longer exists and the binding is empty. The receiver's struct
 * type must already be resolved (this runs after reresolveImportedStructTypes).
 */
export default class RedesugarImportedUsingForCalls extends AstTraversal {
  private structToLib = new Map<string, string>(); // struct type string -> library name
  private freeFnNames = new Set<string>();

  visitSourceFile(node: SourceFileNode): Node {
    const contract = node.contract;
    if (!contract) return node;
    this.freeFnNames = new Set((node.freeFunctions ?? []).map((f) => f.name));

    // Map each `using L for Struct` target (incl. library-qualified `L2.Counter`) to its library, keyed by the
    // resolved struct's type string (which is what a receiver variable's type stringifies to).
    const structMap = new Map<string, StructType>();
    for (const sd of node.structDefinitions ?? []) structMap.set(sd.name, new StructType(sd.name, sd.fields));
    for (const sd of contract.structDefinitions) structMap.set(sd.name, new StructType(sd.name, sd.fields));
    for (const d of [...(node.usingForDirectives ?? []), ...(contract.usingForDirectives ?? [])]) {
      if (!d.libraryName || !d.targetTypeName) continue;
      const dot = d.targetTypeName.lastIndexOf('.');
      const bare = dot >= 0 ? d.targetTypeName.slice(dot + 1) : d.targetTypeName;
      const st = structMap.get(d.targetTypeName) ?? structMap.get(bare);
      if (st) this.structToLib.set(st.toString(), d.libraryName);
    }
    if (this.structToLib.size === 0) return node;

    const stateVarTypes = new Map<string, Type>();
    for (const sv of contract.stateVariables) stateVarTypes.set(sv.name, sv.type);

    const fns: (FunctionDefinitionNode | undefined)[] = [
      ...contract.functions, contract.constructorDef, contract.fallbackDef, contract.receiveDef,
      ...(node.freeFunctions ?? []),
    ];
    for (const fn of fns) if (fn?.body) this.processFunction(fn, stateVarTypes);
    return node;
  }

  private processFunction(fn: FunctionDefinitionNode, base: Map<string, Type>): void {
    // Flat per-function scope (matches the AstBuilder's localStructTypes tracking): state vars, then params,
    // then every local declaration's type.
    const varTypes = new Map(base);
    for (const p of fn.parameters ?? []) varTypes.set(p.name, p.type);
    this.walk(fn.body, (n) => { if (n instanceof VariableDefinitionNode) varTypes.set(n.name, n.type); });
    this.rewrite(fn.body, varTypes);
  }

  // Rewrite `X.Y(args)` -> `L.Y(X, args)` in place where X is a struct var bound by `using L for Struct` and L
  // actually declares `L.Y`. Recurses so nested calls in the args are handled too.
  private rewrite(node: Node | undefined, varTypes: Map<string, Type>): void {
    if (!node) return;
    if (node instanceof FunctionCallNode) {
      const nm = node.identifier.name;
      const dot = nm.indexOf('.');
      if (dot > 0 && !this.freeFnNames.has(nm)) {
        const recv = nm.slice(0, dot);
        const method = nm.slice(dot + 1);
        const t = varTypes.get(recv);
        const lib = t instanceof StructType ? this.structToLib.get(t.toString()) : undefined;
        if (lib && this.freeFnNames.has(`${lib}.${method}`)) {
          const recvId = new IdentifierNode(recv);
          recvId.location = node.identifier.location;
          node.parameters = [recvId, ...node.parameters];
          node.identifier = new IdentifierNode(`${lib}.${method}`);
          node.identifier.location = node.location;
        }
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) this.rewrite(v, varTypes);
      else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) this.rewrite(it, varTypes);
    }
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
