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
function tagModifierStateAccess(nodes: (Node | undefined)[], definingContract: string): void {
  for (const n of nodes) {
    if (!n) continue;
    // Pre-semantic a state read/write is an Identifier / Assign; SymbolTable later rewrites it to a
    // State{Access,Assign,Delete}Node and copies fromModifier across. Tag both forms.
    if (n instanceof StateAccessNode || n instanceof StateAssignNode || n instanceof DeleteStateNode
      || n instanceof AssignNode || n instanceof IdentifierNode) {
      if (n.fromModifier === undefined) n.fromModifier = definingContract;
    }
    for (const [key, value] of Object.entries(n)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location' || key === 'stateVariable') continue;
      if (value instanceof Node) tagModifierStateAccess([value], definingContract);
      else if (Array.isArray(value)) tagModifierStateAccess(value.filter((v) => v instanceof Node), definingContract);
    }
  }
}

function renameParamRefs(nodes: Node[], oldNames: string[], newNames: string[]): void {
  const nameMap = new Map(oldNames.map((o, i) => [o, newNames[i]]));
  function walk(node: Node): void {
    if (node instanceof IdentifierNode && nameMap.has(node.name)) {
      node.name = nameMap.get(node.name)!;
    }
    for (const [, value] of Object.entries(node)) {
      if (value instanceof Node) walk(value);
      if (Array.isArray(value)) {
        for (const item of value) { if (item instanceof Node) walk(item); }
      }
    }
  }
  for (const n of nodes) walk(n);
}

// Count `_;` placeholders in a statement list, recursing into if/else branches + loop bodies (a placeholder
// may live inside a conditional, e.g. a proxy's `ifAdmin` modifier).
function countPlaceholdersDeep(stmts: StatementNode[]): number {
  let n = 0;
  for (const s of stmts) {
    if (s instanceof PlaceholderStatementNode) { n += 1; continue; }
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
