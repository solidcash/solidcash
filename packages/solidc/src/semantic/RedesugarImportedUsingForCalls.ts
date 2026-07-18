import {
  ContractNode,
  FunctionCallNode,
  FunctionDefinitionNode,
  IdentifierNode,
  Node,
  ParameterNode,
  SourceFileNode,
  StatementNode,
  StructDefinitionNode,
  UsingForDirectiveNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import { AddressType, StructType, Type } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * A `using L for T` method call whose receiver type was IMPORTED is not desugared by the AstBuilder - the AstBuilder
 * needs the receiver's type at PARSE time (localStructTypes / stateStructVars), but an imported struct/library is
 * unknown then, so `escrowIdCounter.increment()` is left as a raw namespaced `escrowIdCounter.increment` FunctionCall.
 * Now that imports are merged and placeholder types re-resolved (reresolveImportedStructTypes), redo that desugar:
 * `X.Y(args) -> L.Y(X, args)`. Also handles `using L for *` on non-struct receivers (OZ ShortStrings on `string`).
 *
 * Runs in two modes:
 * - perContract=true (PRE inheritance/modifier expansion): desugar EACH contract's own functions/constructor/modifiers
 *   with ITS OWN directives (correct lexical scope). An inherited parent constructor/modifier body is thus already
 *   `L.m(recv, args)` (a real arg NODE) before flattening inlines and param-substitutes it - substitution can rewrite
 *   an arg node but not a receiver embedded in a `recv.method` call identifier string.
 * - perContract=false (POST modifier expansion): the merged primary contract, covering imported-struct receivers.
 *
 * Must run before InlineStoragePointerCalls: a using-for method often takes a `T storage` pointer (inlined-and-dropped
 * there); an un-rewritten call would lose its target. The receiver's struct type must already be resolved.
 */
export default class RedesugarImportedUsingForCalls extends AstTraversal {
  private structToLib = new Map<string, string>(); // struct type string -> library name
  private wildcardLibs: string[] = [];             // libraries bound via `using L for *`
  private freeFnNames = new Set<string>();

  constructor(private readonly perContract = false) { super(); }

  visitSourceFile(node: SourceFileNode): Node {
    const contract = node.contract;
    if (!contract) return node;
    this.freeFnNames = new Set((node.freeFunctions ?? []).map((f) => f.name));

    const fileStructs = node.structDefinitions ?? [];
    const fileDirectives = node.usingForDirectives ?? [];
    // perContract: also the parents, each scoped to its own directives. Otherwise just the (merged) primary.
    const contracts = this.perContract ? [contract, ...(node.importedContracts ?? [])] : [contract];
    for (const c of contracts) this.processContract(c, fileDirectives, fileStructs);
    // Free functions are file-level; process once with file directives only.
    this.buildBindings([], fileDirectives, fileStructs);
    if (this.structToLib.size > 0 || this.wildcardLibs.length > 0) {
      for (const fn of node.freeFunctions ?? []) if (fn?.body) this.processFunction(fn, new Map());
    }
    return node;
  }

  private processContract(contract: ContractNode, fileDirectives: UsingForDirectiveNode[],
    fileStructs: StructDefinitionNode[]): void {
    this.buildBindings(contract.structDefinitions, [...fileDirectives, ...(contract.usingForDirectives ?? [])],
      fileStructs);
    if (this.structToLib.size === 0 && this.wildcardLibs.length === 0) return;

    const stateVarTypes = new Map<string, Type>();
    for (const sv of contract.stateVariables) stateVarTypes.set(sv.name, sv.type);

    const fns: (FunctionDefinitionNode | undefined)[] = [
      ...contract.functions, contract.constructorDef, contract.fallbackDef, contract.receiveDef,
    ];
    for (const fn of fns) if (fn?.body) this.processFunction(fn, stateVarTypes);
    // Modifier bodies use `statements` (not a `body` block) - desugar in the modifier's own contract scope so the
    // binding survives when expandModifiers later inlines the body into a derived contract's function.
    for (const mod of contract.modifierDefinitions) this.processStatements(mod.statements, mod.parameters, stateVarTypes);
  }

  // Populate structToLib / wildcardLibs from the given directives, keyed off the given struct scope.
  private buildBindings(contractStructs: StructDefinitionNode[], directives: UsingForDirectiveNode[],
    fileStructs: StructDefinitionNode[]): void {
    this.structToLib = new Map();
    this.wildcardLibs = [];
    const structMap = new Map<string, StructType>();
    for (const sd of fileStructs) structMap.set(sd.name, new StructType(sd.name, sd.fields));
    for (const sd of contractStructs) structMap.set(sd.name, new StructType(sd.name, sd.fields));
    for (const d of directives) {
      if (!d.libraryName) continue;
      if (d.isWildcard) { this.wildcardLibs.push(d.libraryName); continue; }
      if (!d.targetTypeName) continue;
      const dot = d.targetTypeName.lastIndexOf('.');
      const bare = dot >= 0 ? d.targetTypeName.slice(dot + 1) : d.targetTypeName;
      const st = structMap.get(d.targetTypeName) ?? structMap.get(bare);
      if (st) this.structToLib.set(st.toString(), d.libraryName);
    }
  }

  private processFunction(fn: FunctionDefinitionNode, base: Map<string, Type>): void {
    this.processStatements(fn.body.statements ?? [], fn.parameters, base);
  }

  private processStatements(statements: StatementNode[], params: ParameterNode[] | undefined,
    base: Map<string, Type>): void {
    // Flat per-scope var types (matches the AstBuilder's localStructTypes tracking): state vars, params, then locals.
    const varTypes = new Map(base);
    for (const p of params ?? []) varTypes.set(p.name, p.type);
    for (const s of statements) this.walk(s, (n) => { if (n instanceof VariableDefinitionNode) varTypes.set(n.name, n.type); });
    for (const s of statements) this.rewrite(s, varTypes);
  }

  // Rewrite `X.Y(args)` -> `L.Y(X, args)` in place where X is a receiver bound by `using L for T` (struct) or
  // `using L for *` (wildcard, any non-interface type) and L actually declares `L.Y`. Recurses into args.
  private rewrite(node: Node | undefined, varTypes: Map<string, Type>): void {
    if (!node) return;
    if (node instanceof FunctionCallNode) {
      const nm = node.identifier.name;
      const dot = nm.indexOf('.');
      if (dot > 0 && !this.freeFnNames.has(nm)) {
        const recv = nm.slice(0, dot);
        const method = nm.slice(dot + 1);
        const t = varTypes.get(recv);
        let lib = t instanceof StructType ? this.structToLib.get(t.toString()) : undefined;
        // `using L for *` binds L's free functions as methods on ANY type. Resolve when the receiver is a known
        // non-interface local/param/state var - excluding contract/interface-typed receivers (AddressType with
        // interfaceName), whose `recv.method()` is an external call, not a using-for.
        if (!lib && t && !(t instanceof AddressType && t.interfaceName)) {
          lib = this.wildcardLibs.find((wl) => this.freeFnNames.has(`${wl}.${method}`));
        }
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
