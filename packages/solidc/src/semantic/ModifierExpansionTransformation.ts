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

export default function expandModifiers(ast: SourceFileNode): SourceFileNode {
  const contract = ast.contract;
  const modifierMap = new Map<string, ModifierDefinitionNode>();

  // Collect and validate modifier definitions
  for (const mod of contract.modifierDefinitions) {
    if (modifierMap.has(mod.name)) {
      throw new ModifierRedefinitionError(mod);
    }

    // Validate at least one placeholder
    const placeholderCount = mod.statements.filter(
      (s) => s instanceof PlaceholderStatementNode,
    ).length;

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

    // Replace placeholder(s) with current body
    const expandedStatements: StatementNode[] = [...paramBindings];
    let placeholderInserted = false;
    for (const stmt of clonedStatements) {
      if (stmt instanceof PlaceholderStatementNode) {
        if (placeholderInserted) {
          // Deep-clone the body for each additional placeholder to avoid shared node references
          expandedStatements.push(...currentBody.map((s) => cloneNode(s)));
        } else {
          expandedStatements.push(...currentBody);
          placeholderInserted = true;
        }
      } else {
        expandedStatements.push(stmt);
      }
    }

    currentBody = expandedStatements;
  }

  // Replace the function body
  func.body = new BlockNode(currentBody);
  func.body.location = func.body.location ?? func.location;

  // Clear custom modifiers (consumed)
  func.customModifiers = [];
}
