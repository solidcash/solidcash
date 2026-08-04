import {
  Node,
  SourceFileNode,
  ModifierDefinitionNode,
  PlaceholderStatementNode,
  StatementNode,
  VariableDefinitionNode,
  ExpressionNode,
  FunctionDefinitionNode,
  BlockNode,
  IdentifierNode,
  StateAccessNode,
  StateAssignNode,
  DeleteStateNode,
  AssignNode,
  FieldAccessNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingFieldAssignNode,
  MappingDeleteNode,
  ArrayAssignNode,
  AssemblyStatementNode,
  TupleAssignmentNode,
  ReturnNode,
} from '../ast/AST.js';
import {
  YulNode,
  YulBlockNode,
  YulVariableDeclarationNode,
  YulAssignmentNode,
  YulIfNode,
  YulSwitchNode,
  YulForLoopNode,
  YulFunctionDefinitionNode,
  YulExpressionStatementNode,
  YulFunctionCallNode,
  YulPathNode,
} from '../ast/YulAST.js';
import {
  ModifierRedefinitionError,
  UndefinedModifierError,
  ModifierPlaceholderError,
} from '../Errors.js';

function cloneNode<T extends Node>(node: T): T {
  const clone = Object.create(Object.getPrototypeOf(node));
  for (const [key, value] of Object.entries(node)) {
    if (value instanceof Node) {
      clone[key] = cloneNode(value);
    } else if (value instanceof YulNode) {
      clone[key] = cloneYulNode(value);
    } else if (Array.isArray(value)) {
      clone[key] = value.map((item) => {
        if (item instanceof Node) return cloneNode(item);
        // TupleAssignmentNode elements are plain metadata objects rather than Nodes. They carry declaration
        // names that modifier alpha-renaming mutates, so sharing them would mutate the modifier template and
        // every later application.
        if (item && typeof item === 'object' && Object.getPrototypeOf(item) === Object.prototype) return { ...item };
        return item;
      });
    } else if (value instanceof Map) {
      clone[key] = new Map(value);
    } else {
      clone[key] = value;
    }
  }
  return clone;
}

function cloneYulNode<T extends YulNode>(node: T): T {
  const clone = Object.create(Object.getPrototypeOf(node));
  for (const [key, value] of Object.entries(node)) {
    if (value instanceof YulNode) clone[key] = cloneYulNode(value);
    else if (Array.isArray(value)) {
      clone[key] = value.map((item) => (item instanceof YulNode ? cloneYulNode(item) : item));
    } else clone[key] = value;
  }
  return clone;
}

// Yul can refer directly to high-level locals and parameters. Modifier expansion renames those bindings, so
// rewrite the matching outer references too, while preserving names introduced by Yul's own lexical scopes.
function renameYulOuterRefs(block: YulBlockNode, nameMap: Map<string, string>, inherited = new Set<string>()): void {
  const scope = new Set(inherited);
  const expression = (node: YulNode, bound: Set<string>): void => {
    if (node instanceof YulPathNode) {
      if (!bound.has(node.base) && nameMap.has(node.base)) node.base = nameMap.get(node.base)!;
      return;
    }
    if (node instanceof YulFunctionCallNode) {
      node.args.forEach((arg) => expression(arg, bound));
    }
  };
  const nested = (child: YulBlockNode, bound = scope): void => renameYulOuterRefs(child, nameMap, bound);
  for (const statement of block.statements) {
    if (statement instanceof YulVariableDeclarationNode) {
      if (statement.value) expression(statement.value, scope);
      statement.names.forEach((name) => scope.add(name));
    } else if (statement instanceof YulAssignmentNode) {
      statement.paths.forEach((path) => expression(path, scope));
      expression(statement.value, scope);
    } else if (statement instanceof YulExpressionStatementNode) expression(statement.expression, scope);
    else if (statement instanceof YulIfNode) {
      expression(statement.condition, scope);
      nested(statement.body);
    } else if (statement instanceof YulSwitchNode) {
      expression(statement.expression, scope);
      statement.cases.forEach((item) => nested(item.body));
      if (statement.defaultBody) nested(statement.defaultBody);
    } else if (statement instanceof YulForLoopNode) {
      const loopScope = new Set(scope);
      renameYulOuterRefs(statement.pre, nameMap, loopScope);
      expression(statement.condition, loopScope);
      renameYulOuterRefs(statement.post, nameMap, loopScope);
      renameYulOuterRefs(statement.body, nameMap, loopScope);
    } else if (statement instanceof YulFunctionDefinitionNode) {
      nested(statement.body, new Set([...scope, ...statement.params, ...statement.returns]));
    } else if (statement instanceof YulBlockNode) nested(statement);
  }
}

// Recursively tag every state access in a modifier's own body with its defining contract (fromModifier). Stops
// at nested placeholder expansions naturally: the caller body is spliced in AFTER this runs, so it stays untagged.
// Exported for the inline passes: an inlined INHERITED helper's state accesses keep their private-access
// legitimacy the same way an inlined modifier body's do.
export function tagModifierStateAccess(nodes: (Node | undefined)[], definingContract: string): void {
  for (const n of nodes) {
    if (!n) continue;
    // Pre-semantic a state read/write is an Identifier / Assign; SymbolTable later rewrites it to a
    // State{Access,Assign,Delete}Node and copies fromModifier across. Tag both forms. A COLLECTION access
    // (mapping/array element) is a Mapping{Access,Assign,FieldAssign,Delete} or a pre-semantic ArrayAssign
    // (`m[k]=v` before it resolves to a state mapping); tag those too so the private-collection check knows the
    // access originated in the defining contract's own method (the inlined-C2-helper case, e.g. ERC20 _update).
    if (n instanceof StateAccessNode || n instanceof StateAssignNode || n instanceof DeleteStateNode
      || n instanceof AssignNode || n instanceof IdentifierNode
      || n instanceof MappingAccessNode || n instanceof MappingAssignNode
      || n instanceof MappingFieldAssignNode || n instanceof MappingDeleteNode || n instanceof ArrayAssignNode
      || n instanceof ReturnNode) {
      if (n.fromModifier === undefined) n.fromModifier = definingContract;
    }
    for (const [key, value] of Object.entries(n)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location' || key === 'stateVariable') continue;
      if (value instanceof Node) tagModifierStateAccess([value], definingContract);
      else if (Array.isArray(value)) tagModifierStateAccess(value.filter((v) => v instanceof Node), definingContract);
    }
  }
}

// Rename every reference to a renamed variable: identifier reads AND name-keyed lvalue targets - `s[i] = v`
// (ArrayAssign), `s[i].f = v` (MappingFieldAssign on a local struct-array), `delete s[i]` (MappingDelete). A
// state var / member access (State{Access,Assign,Delete}, FieldAccess) never carries a local/param name here, so
// its `.name` is left alone (its children are still walked). Shared by param- and local-declaration renaming.
function renameNamedRefs(nodes: Node[], nameMap: Map<string, string>): void {
  function walk(node: Node): void {
    if (node instanceof AssemblyStatementNode && node.yulBlock) {
      renameYulOuterRefs(node.yulBlock, nameMap);
    }
    if (!(node instanceof StateAccessNode || node instanceof StateAssignNode
      || node instanceof DeleteStateNode || node instanceof FieldAccessNode)) {
      const nm = (node as unknown as { name?: unknown }).name;
      if (typeof nm === 'string' && nameMap.has(nm)) (node as unknown as { name: string }).name = nameMap.get(nm)!;
    }
    for (const [, value] of Object.entries(node)) {
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) { for (const item of value) if (item instanceof Node) walk(item); }
    }
  }
  for (const n of nodes) walk(n);
}

function renameParamRefs(nodes: Node[], oldNames: string[], newNames: string[]): void {
  renameNamedRefs(nodes, new Map(oldNames.map((o, i) => [o, newNames[i]])));
}

// Collect the names of local variables DECLARED in a modifier body. Called on the cloned modifier statements
// before placeholder expansion, so it only sees the modifier's own locals, not the spliced function body.
function collectLocalDeclNames(nodes: Node[]): string[] {
  const names: string[] = [];
  function walk(node: Node): void {
    if (node instanceof VariableDefinitionNode) names.push(node.name);
    if (node instanceof TupleAssignmentNode) {
      for (const element of node.elements) {
        if (!element.skip && !element.existing && element.name) names.push(element.name);
      }
    }
    for (const [, value] of Object.entries(node)) {
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) { for (const item of value) if (item instanceof Node) walk(item); }
    }
  }
  for (const n of nodes) walk(n);
  return names;
}

// Rename local variable declarations AND their references. Unlike renameParamRefs this also rewrites the
// declaration's own `.name`, since a modifier local is declared inside the body (not injected as a binding).
function renameLocalDecls(nodes: Node[], oldNames: string[], newNames: string[]): void {
  const nameMap = new Map(oldNames.map((o, i) => [o, newNames[i]]));
  renameNamedRefs(nodes, nameMap);
  const walk = (node: Node): void => {
    if (node instanceof TupleAssignmentNode) {
      for (const element of node.elements) {
        if (!element.skip && !element.existing && element.name && nameMap.has(element.name)) {
          element.name = nameMap.get(element.name)!;
        }
      }
    }
    for (const value of Object.values(node)) {
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
    }
  };
  nodes.forEach(walk);
}

// Solidity requires every implemented modifier body to contain `_` somewhere, including in a nested branch or
// loop. An unimplemented `modifier m virtual;` is represented separately and validated at its use/contract.
function countPlaceholdersDeep(stmts: StatementNode[]): number {
  let n = 0;
  for (const s of stmts) {
    if (s instanceof PlaceholderStatementNode) { n += 1; continue; }
    if (s instanceof BlockNode) { n += countPlaceholdersDeep(s.statements ?? []); continue; }
    for (const key of Object.keys(s)) {
      const val = (s as any)[key];
      if (val instanceof BlockNode && val.statements) n += countPlaceholdersDeep(val.statements);
    }
  }
  return n;
}

export function validateModifierDefinitions(ast: SourceFileNode): void {
  const contract = ast.contract;
  const names = new Set<string>();
  for (const mod of [...contract.modifierDefinitions, ...ast.libraryModifierDefinitions]) {
    if (names.has(mod.name)) throw new ModifierRedefinitionError(mod);
    names.add(mod.name);
    if (!mod.isAbstract && countPlaceholdersDeep(mod.statements) === 0) {
      throw new ModifierPlaceholderError(mod, `Modifier '${mod.name}' must contain at least one '_' placeholder`);
    }
    if (mod.isAbstract && !mod.isVirtual) {
      throw new ModifierPlaceholderError(mod, `Unimplemented modifier '${mod.name}' must be virtual`);
    }
    // Qualified aliases exist for explicit `A.m` lookup and may point at an abstract ancestor. An unqualified
    // abstract modifier on a concrete final contract, however, has no implementation.
    if (mod.isAbstract && !contract.isAbstract && !mod.name.includes('.')) {
      throw new ModifierPlaceholderError(mod, `Contract '${contract.name}' must implement modifier '${mod.name}'`);
    }
  }
}

// Replace each `_;` (recursively, inside nested blocks) with the current function body. The first placeholder
// reuses the body nodes; each additional placeholder gets a deep clone (no shared references).
function replacePlaceholdersDeep(
  stmts: StatementNode[], body: StatementNode[], state: { inserted: boolean },
): StatementNode[] {
  const out: StatementNode[] = [];
  for (const stmt of stmts) {
    if (stmt instanceof PlaceholderStatementNode) {
      out.push(...(state.inserted ? body.map((s) => cloneNode(s)) : body));
      state.inserted = true;
      continue;
    }
    // Recurse into a statement that is itself a block (desugared for-loop wrapper / bare `{ }`); its children
    // live in `.statements`, which the BlockNode-typed-key scan below does not reach.
    if (stmt instanceof BlockNode) {
      stmt.statements = replacePlaceholdersDeep(stmt.statements ?? [], body, state);
      out.push(stmt);
      continue;
    }
    for (const key of Object.keys(stmt)) {
      const val = (stmt as any)[key];
      if (val instanceof BlockNode && val.statements) {
        val.statements = replacePlaceholdersDeep(val.statements, body, state);
      }
    }
    out.push(stmt);
  }
  return out;
}

// Outside a modifier definition, Solidity treats a bare `_;` as a no-effect expression statement (with a
// warning). Remove any placeholders left in the function's own body after modifier insertion.
function removeFunctionPlaceholdersDeep(stmts: StatementNode[]): StatementNode[] {
  return replacePlaceholdersDeep(stmts, [], { inserted: false });
}

export default function expandModifiers(ast: SourceFileNode): SourceFileNode {
  const contract = ast.contract;
  const modifierMap = new Map<string, ModifierDefinitionNode>();
  const libraryQualifiers = new Set(ast.declaredLibraryNames);

  validateModifierDefinitions(ast);

  // Collect modifier definitions
  for (const mod of [...contract.modifierDefinitions, ...ast.libraryModifierDefinitions]) {
    modifierMap.set(mod.name, mod);
  }

  // Expand modifiers on each function
  for (const func of contract.functions) {
    expandFunctionModifiers(func, modifierMap, libraryQualifiers);
    func.body.statements = removeFunctionPlaceholdersDeep(func.body.statements ?? []);
  }

  // Base constructor arguments/bodies run before the derived constructor's modifier arguments. Inheritance
  // expansion records the prepended prefix so modifier wrapping applies only to the derived constructor body.
  if (contract.constructorDef) {
    const constructor = contract.constructorDef;
    const prefixLength = constructor.constructorPreludeLength;
    const prefix = (constructor.body.statements ?? []).slice(0, prefixLength);
    constructor.body.statements = (constructor.body.statements ?? []).slice(prefixLength);
    expandFunctionModifiers(constructor, modifierMap, libraryQualifiers);
    constructor.body.statements = [...prefix, ...(constructor.body.statements ?? [])];
    constructor.customModifiers = [];
  }

  // Library functions are represented as namespaced free functions (`L.f`) until they are inlined/deployed.
  for (const func of ast.freeFunctions) {
    if (func.customModifiers.length === 0) continue;
    expandFunctionModifiers(func, modifierMap);
    func.body.statements = removeFunctionPlaceholdersDeep(func.body.statements ?? []);
  }

  // H5: fallback and receive are dispatch entry points too - the fallback is the DEFAULT branch for any
  // unmatched selector. A guard modifier on them (e.g. a transparent proxy's `ifAdmin` fallback) must be
  // expanded into its require(), not silently dropped, and an undefined modifier must still error.
  if (contract.fallbackDef) {
    expandFunctionModifiers(contract.fallbackDef, modifierMap, libraryQualifiers);
    contract.fallbackDef.body.statements = removeFunctionPlaceholdersDeep(contract.fallbackDef.body.statements ?? []);
  }
  if (contract.receiveDef) {
    expandFunctionModifiers(contract.receiveDef, modifierMap, libraryQualifiers);
    contract.receiveDef.body.statements = removeFunctionPlaceholdersDeep(contract.receiveDef.body.statements ?? []);
  }

  return ast;
}

function expandFunctionModifiers(
  func: FunctionDefinitionNode,
  modifierMap: Map<string, ModifierDefinitionNode>,
  forbiddenQualifiers: Set<string> = new Set(),
): void {
  if (func.customModifiers.length === 0) return;

  let currentBody = func.body.statements ?? [];

  // Expand right-to-left (innermost first)
  for (let i = func.customModifiers.length - 1; i >= 0; i--) {
    const invocation = func.customModifiers[i];
    const qualifier = invocation.name.includes('.') ? invocation.name.split('.')[0] : undefined;
    if (qualifier && forbiddenQualifiers.has(qualifier)) {
      throw new UndefinedModifierError(func, invocation.name);
    }
    if (qualifier && func.allowedModifierQualifiers
      && !func.allowedModifierQualifiers.includes(qualifier)) {
      throw new UndefinedModifierError(func, invocation.name);
    }
    const modDef = modifierMap.get(invocation.name);

    if (!modDef) {
      // Create a dummy node for the error location
      const dummyNode = func;
      throw new UndefinedModifierError(dummyNode, invocation.name);
    }
    if (modDef.isAbstract) {
      throw new ModifierPlaceholderError(modDef, `Cannot invoke unimplemented modifier '${invocation.name}'`);
    }

    // Clone the modifier body statements
    const clonedStatements = modDef.statements.map((s) => cloneNode(s));

    // Tag state accesses in the modifier's OWN body with the contract that defined the modifier, so the
    // private-var visibility check allows an inherited modifier to touch its own contract's private state even
    // once inlined into a derived contract. (The placeholder expands to the caller body, which stays untagged.)
    tagModifierStateAccess(
      clonedStatements,
      modDef.inheritedFrom ?? func.inheritedFrom ?? '__local_modifier__',
    );

    // Validate argument count matches parameter count
    if (invocation.args.length !== modDef.parameters.length) {
      throw new Error(
        `Modifier '${invocation.name}' expects ${modDef.parameters.length} argument(s) `
        + `but was invoked with ${invocation.args.length}.`,
      );
    }

    // Build parameter binding statements with unique names per invocation
    // to support the same modifier applied multiple times (e.g. notBlacklisted(a) notBlacklisted(b))
    const bindingNames: string[] = [];
    const paramBindings: StatementNode[] = [];
    modDef.parameters.forEach((param, idx) => {
      const arg = invocation.args[idx];
      // A storage-pointer modifier parameter aliases the caller's storage object. Reuse a simple identifier
      // argument directly, avoiding a synthetic local that would be cloned with an inlined library helper at
      // every call site (`s__0` would otherwise be redeclared twice for `s.f(); L.f(s);`).
      if (param.modifier.includes('storage') && arg instanceof IdentifierNode) {
        bindingNames.push(arg.name);
        return;
      }
      const uniqueName = `${param.name}__${i}`;
      bindingNames.push(uniqueName);
      const binding = new VariableDefinitionNode(
        param.type,
        [],
        uniqueName,
        cloneNode(arg) as ExpressionNode,
      );
      binding.location = arg.location;
      paramBindings.push(binding);
    });

    // Rename parameter references in the cloned modifier body to use unique names
    renameParamRefs(clonedStatements, modDef.parameters.map((p) => p.name),
      bindingNames);

    // Rename the modifier's OWN local variables uniquely per application. The same modifier applied more than
    // once (mod(2) mod(5) mod(x)) or a modifier local sharing a name with a function variable would otherwise
    // redeclare that name in one flat block. Runs before placeholder expansion, so the function body is untouched.
    const localNames = collectLocalDeclNames(clonedStatements);
    if (localNames.length > 0) {
      renameLocalDecls(clonedStatements, localNames, localNames.map((n) => `${n}__mod${i}`));
    }

    // Replace placeholder(s) with current body, recursing into nested blocks (if/else, loops).
    const state = { inserted: false };
    const replaced = replacePlaceholdersDeep(clonedStatements, currentBody, state);
    currentBody = [...paramBindings, ...replaced];
  }

  // Replace the function body
  func.body = new BlockNode(currentBody);
  func.body.location = func.body.location ?? func.location;

  // Clear custom modifiers (consumed)
  func.customModifiers = [];
}
