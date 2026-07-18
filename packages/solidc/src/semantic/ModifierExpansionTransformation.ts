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
} from '../ast/AST.js';
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
    } else if (Array.isArray(value)) {
      clone[key] = value.map((item) => (item instanceof Node ? cloneNode(item) : item));
    } else if (value instanceof Map) {
      clone[key] = new Map(value);
    } else {
      clone[key] = value;
    }
  }
  return clone;
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
      || n instanceof MappingFieldAssignNode || n instanceof MappingDeleteNode || n instanceof ArrayAssignNode) {
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
  renameNamedRefs(nodes, new Map(oldNames.map((o, i) => [o, newNames[i]])));
}

// Count `_;` placeholders in a statement list, recursing into if/else branches + loop bodies (a placeholder
// may live inside a conditional, e.g. a proxy's `ifAdmin` modifier).
function countPlaceholdersDeep(stmts: StatementNode[]): number {
  let n = 0;
  for (const s of stmts) {
    if (s instanceof PlaceholderStatementNode) { n += 1; continue; }
    // A statement that is ITSELF a block holds its children in `.statements`, not as a BlockNode-typed key, so
    // the key scan below never reaches them. `for` desugars to a wrapper `{ init; while(cond){ body; update } }`
    // block (AstBuilder.visitForStatement), so `_` inside a for-loop lives here - recurse in.
    if (s instanceof BlockNode) { n += countPlaceholdersDeep(s.statements ?? []); continue; }
    for (const key of Object.keys(s)) {
      const val = (s as any)[key];
      if (val instanceof BlockNode && val.statements) n += countPlaceholdersDeep(val.statements);
    }
  }
  return n;
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

export default function expandModifiers(ast: SourceFileNode): SourceFileNode {
  const contract = ast.contract;
  const modifierMap = new Map<string, ModifierDefinitionNode>();

  // Collect and validate modifier definitions
  for (const mod of contract.modifierDefinitions) {
    if (modifierMap.has(mod.name)) {
      throw new ModifierRedefinitionError(mod);
    }

    // Validate at least one placeholder (recursing into if/else + loops)
    const placeholderCount = countPlaceholdersDeep(mod.statements);

    if (placeholderCount === 0) {
      throw new ModifierPlaceholderError(mod, `Modifier '${mod.name}' must contain at least one '_' placeholder`);
    }

    modifierMap.set(mod.name, mod);
  }

  // Expand modifiers on each function
  for (const func of contract.functions) {
    expandFunctionModifiers(func, modifierMap);
  }

  // H5: fallback and receive are dispatch entry points too - the fallback is the DEFAULT branch for any
  // unmatched selector. A guard modifier on them (e.g. a transparent proxy's `ifAdmin` fallback) must be
  // expanded into its require(), not silently dropped, and an undefined modifier must still error.
  if (contract.fallbackDef) expandFunctionModifiers(contract.fallbackDef, modifierMap);
  if (contract.receiveDef) expandFunctionModifiers(contract.receiveDef, modifierMap);

  return ast;
}

function expandFunctionModifiers(
  func: FunctionDefinitionNode,
  modifierMap: Map<string, ModifierDefinitionNode>,
): void {
  if (func.customModifiers.length === 0) return;

  let currentBody = func.body.statements ?? [];

  // Expand right-to-left (innermost first)
  for (let i = func.customModifiers.length - 1; i >= 0; i--) {
    const invocation = func.customModifiers[i];
    const modDef = modifierMap.get(invocation.name);

    if (!modDef) {
      // Create a dummy node for the error location
      const dummyNode = func;
      throw new UndefinedModifierError(dummyNode, invocation.name);
    }

    // Clone the modifier body statements
    const clonedStatements = modDef.statements.map((s) => cloneNode(s));

    // Tag state accesses in the modifier's OWN body with the contract that defined the modifier, so the
    // private-var visibility check allows an inherited modifier to touch its own contract's private state even
    // once inlined into a derived contract. (The placeholder expands to the caller body, which stays untagged.)
    if (modDef.inheritedFrom) tagModifierStateAccess(clonedStatements, modDef.inheritedFrom);

    // Validate argument count matches parameter count
    if (invocation.args.length !== modDef.parameters.length) {
      throw new Error(
        `Modifier '${invocation.name}' expects ${modDef.parameters.length} argument(s) `
        + `but was invoked with ${invocation.args.length}.`,
      );
    }

    // Build parameter binding statements with unique names per invocation
    // to support the same modifier applied multiple times (e.g. notBlacklisted(a) notBlacklisted(b))
    const paramBindings: StatementNode[] = modDef.parameters.map((param, idx) => {
      const arg = invocation.args[idx];
      const uniqueName = `${param.name}__${i}`;
      const binding = new VariableDefinitionNode(
        param.type,
        [],
        uniqueName,
        cloneNode(arg) as ExpressionNode,
      );
      binding.location = arg.location;
      return binding;
    });

    // Rename parameter references in the cloned modifier body to use unique names
    renameParamRefs(clonedStatements, modDef.parameters.map((p) => p.name),
      modDef.parameters.map((p, _idx) => `${p.name}__${i}`));

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
