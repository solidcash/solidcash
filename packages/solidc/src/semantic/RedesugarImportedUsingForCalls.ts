import {
  ArrayAccessNode,
  ContractNode,
  FieldAccessNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  FunctionDefinitionNode,
  IdentifierNode,
  MappingAccessNode,
  MethodCallNode,
  MethodCallStatementNode,
  Node,
  ParameterNode,
  SourceFileNode,
  StatementNode,
  StructDefinitionNode,
  UsingForDirectiveNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import {
  AddressType, ArrayType, MappingType, StructType, Type,
} from '@solidcash/utils';
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
  private interfaceToLib = new Map<string, string>(); // interface/contract name -> library (`using SafeERC20 for IERC20`)
  private wildcardLibs: string[] = [];             // libraries bound via `using L for *`
  private freeFnNames = new Set<string>();
  private interfaceNames = new Set<string>();      // interface + imported-contract names (interface-cast receivers)

  constructor(private readonly perContract = false) { super(); }

  visitSourceFile(node: SourceFileNode): Node {
    const contract = node.contract;
    if (!contract) return node;
    this.freeFnNames = new Set((node.freeFunctions ?? []).map((f) => f.name));
    // Interface-cast receivers (`IERC20(x).safeTransfer(..)`) name an interface or an imported contract type.
    this.interfaceNames = new Set([
      ...(node.interfaceDefinitions ?? []).map((i) => i.name),
      ...(node.importedContracts ?? []).map((c) => c.name),
    ]);

    const fileStructs = node.structDefinitions ?? [];
    const fileDirectives = node.usingForDirectives ?? [];
    // perContract: also the parents, each scoped to its own directives. Otherwise just the (merged) primary.
    const contracts = this.perContract ? [contract, ...(node.importedContracts ?? [])] : [contract];
    for (const c of contracts) this.processContract(c, fileDirectives, fileStructs);
    // Free functions are file-level; process once with file directives only.
    this.buildBindings([], fileDirectives, fileStructs);
    if (this.structToLib.size > 0 || this.wildcardLibs.length > 0 || this.interfaceToLib.size > 0) {
      for (const fn of node.freeFunctions ?? []) if (fn?.body) this.processFunction(fn, new Map());
    }
    return node;
  }

  private processContract(contract: ContractNode, fileDirectives: UsingForDirectiveNode[],
    fileStructs: StructDefinitionNode[]): void {
    this.buildBindings(contract.structDefinitions, [...fileDirectives, ...(contract.usingForDirectives ?? [])],
      fileStructs);
    if (this.structToLib.size === 0 && this.wildcardLibs.length === 0 && this.interfaceToLib.size === 0) return;

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
    this.interfaceToLib = new Map();
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
      if (st) { this.structToLib.set(st.toString(), d.libraryName); continue; }
      // `using SafeERC20 for IERC20`: the target is an interface (or imported contract) type. Bound methods dispatch
      // on an interface-cast receiver `IERC20(x).method(..)`, which parses as a MethodCall (not a namespaced call).
      if (this.interfaceNames.has(d.targetTypeName) || this.interfaceNames.has(bare)) {
        this.interfaceToLib.set(bare, d.libraryName);
      }
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
    // Replace a top-level statement in place (a bare `IERC20(x).safeTransfer(..);` MethodCallStatement becomes a
    // FunctionCallStatement) - `rewrite` itself only touches CHILDREN, so the outermost statement is handled here.
    for (let i = 0; i < statements.length; i += 1) {
      statements[i] = this.rewriteInterfaceCastCall(statements[i], varTypes) as StatementNode;
      this.rewrite(statements[i], varTypes);
    }
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
        // An interface-typed receiver bound by `using L for IFace` (`IERC20 token; token.safeTransfer(..)` under
        // `using SafeERC20 for IERC20`): a using-for LIBRARY method (L declares `L.method`), NOT an interface method
        // (which stays an external call - it is not an `L.method` free fn). Rewrite pre-inlining so an external-call
        // helper like SafeERC20.safeTransfer reaches its inliner (a SymbolTable-time resolution is too late).
        if (!lib && t instanceof AddressType && t.interfaceName) {
          const l = this.interfaceToLib.get(t.interfaceName);
          if (l && this.freeFnNames.has(`${l}.${method}`)) lib = l;
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
      const rec = node as unknown as Record<string, unknown>;
      const v = rec[key];
      if (v instanceof Node) {
        const replaced = this.rewriteInterfaceCastCall(v, varTypes);
        if (replaced !== v) rec[key] = replaced;
        this.rewrite(replaced, varTypes);
      } else if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i += 1) {
          if (!(v[i] instanceof Node)) continue;
          const replaced = this.rewriteInterfaceCastCall(v[i], varTypes);
          if (replaced !== v[i]) v[i] = replaced;
          this.rewrite(replaced, varTypes);
        }
      }
    }
  }

  // `IERC20(x).safeTransfer(a, b)` (a MethodCall on an interface-cast receiver, `using SafeERC20 for IERC20`) ->
  // `SafeERC20.safeTransfer(IERC20(x), a, b)`. The cast receiver is a not-yet-resolved FunctionCall naming the
  // interface. Returns the node unchanged when it is not such a call. Runs before InlineStoragePointerCalls, like
  // the struct/wildcard rewrite, so a using-for library taking the receiver reaches its inliner.
  private rewriteInterfaceCastCall(node: Node, varTypes: Map<string, Type>): Node {
    // Statement form `IERC20(x).safeTransfer(a, b);` is a MethodCallStatement; rewrite it to a FunctionCallStatement
    // so the void-external-call inliner (which keys on FunctionCall statements) picks the library call up.
    if (node instanceof MethodCallStatementNode) {
      const call = this.rewriteMethodCastCall(node.call, varTypes);
      if (call) { const s = new FunctionCallStatementNode(call); s.location = node.location; return s; }
      return node;
    }
    if (node instanceof MethodCallNode) return this.rewriteMethodCastCall(node, varTypes) ?? node;
    return node;
  }

  // `IERC20(x).method(a, b)` (interface CAST receiver) or `pool.lpToken.method(a, b)` (interface-typed struct FIELD /
  // member receiver) -> `L.method(<receiver>, a, b)` when `using L for IERC20` and L declares `L.method`; undefined
  // otherwise. Struct-field/member receivers resolve their interface via the receiver-type chain (varTypes + structs).
  private rewriteMethodCastCall(node: MethodCallNode, varTypes: Map<string, Type>): FunctionCallNode | undefined {
    if (node.callOptions) return undefined;
    const recv = node.object;
    let ifaceName: string | undefined;
    if (recv instanceof FunctionCallNode && recv.parameters.length === 1 && this.interfaceNames.has(recv.identifier.name)) {
      ifaceName = recv.identifier.name; // `IERC20(x)` cast receiver
    } else if (recv instanceof FieldAccessNode || recv instanceof ArrayAccessNode || recv instanceof MappingAccessNode) {
      const t = this.resolveExprType(recv, varTypes); // `s.field` / `arr[i].field` etc.
      if (t instanceof AddressType && t.interfaceName) ifaceName = t.interfaceName;
    }
    if (!ifaceName) return undefined;
    const lib = this.interfaceToLib.get(ifaceName);
    if (!lib || !this.freeFnNames.has(`${lib}.${node.methodName}`)) return undefined;
    const id = new IdentifierNode(`${lib}.${node.methodName}`);
    id.location = node.location;
    const call = new FunctionCallNode(id, [recv, ...node.parameters]);
    call.location = node.location;
    return call;
  }

  // Resolve an lvalue-chain expression's type through varTypes (state vars / params / locals) + struct definitions.
  // Used to recognise an interface-typed struct-field / array-element receiver for the using-for rewrite.
  private resolveExprType(expr: Node, varTypes: Map<string, Type>): Type | undefined {
    if (expr instanceof IdentifierNode) return varTypes.get(expr.name);
    if (expr instanceof FieldAccessNode) {
      const base = this.resolveExprType(expr.expression, varTypes);
      return base instanceof StructType ? base.fields.find((f) => f.name === expr.name)?.type : undefined;
    }
    if (expr instanceof ArrayAccessNode) {
      const base = this.resolveExprType(expr.array, varTypes);
      return base instanceof ArrayType ? base.elementType : base instanceof MappingType ? base.valueType : undefined;
    }
    if (expr instanceof MappingAccessNode) {
      let t: Type | undefined = varTypes.get(expr.name);
      for (let i = 0; i < Math.max(expr.keys.length, 1) && t; i += 1) {
        t = t instanceof ArrayType ? t.elementType : t instanceof MappingType ? t.valueType : undefined;
      }
      return t;
    }
    return undefined;
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
