import {
  Node,
  SourceFileNode,
  ContractNode,
  FunctionDefinitionNode,
  ParameterNode,
  FunctionModifier,
  ExpressionNode,
  IdentifierNode,
  BinaryOpNode,
  UnaryOpNode,
  CastNode,
  FunctionCallNode,
  TernaryOpNode,
  ArrayNode,
  ArrayAccessNode,
  SliceNode,
  TupleIndexOpNode,
  AbiEncodeNode,
  AbiEncodePackedNode,
  AbiDecodeNode,
  AbiDecodeAtNode,
  InstantiationNode,
  FieldAccessNode,
  ContractReferenceNode,
  StatementNode,
  BlockNode,
  VariableDefinitionNode,
  AssignNode,
  BranchNode,
  DoWhileNode,
  WhileNode,
  RequireNode,
  TimeOpNode,
  StateAssignNode,
  MappingAssignNode,
  MappingFieldAssignNode,
  MappingDeleteNode,
  MappingAccessNode,
  StateAccessNode,
  EmitStatementNode,
  TransferStatementNode,
  TokenContainerMethodStatementNode,
  ReturnNode,
  FunctionCallStatementNode,
  TupleAssignmentNode,
  ArrayPushNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  TryCatchNode,
  RevertNode,
  ConstantDefinitionNode,
  SwitchNode,
  UncheckedNode,
  CollectionIterationNode,
  DeleteLocalNode,
  AbiEncodeCallNode,
  BytesConcatNode,
  StringConcatNode,
  AddressSendExpressionNode,
  LowLevelCallNode,
  TypeIntrospectionNode,
} from '../ast/AST.js';
import {
  CircularContractInheritanceError,
  C3LinearizationError,
  NonVirtualOverrideError,
  OverrideBaseListError,
  DiamondInheritanceError,
  InheritanceNameCollisionError,
  MissingOverrideError,
  ParentInvocationArgCountError,
  UndefinedParentInvocationError,
  DuplicateParentInvocationError,
} from '../Errors.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

// Internal name a parent's overridden function is preserved under, so `super.f()` / `Base.f()` can
// still reach it after the hierarchy is flattened.
function superImplName(definingContract: string, fnName: string): string {
  return `__base_${definingContract}_${fnName}`;
}


/**
 * Expand contract inheritance by merging parent contract definitions into child contracts.
 * Runs after import resolution and before modifier expansion.
 *
 * For each name in `contract.implements`, if it refers to an imported contract (not an interface),
 * the parent's definitions are merged into the child. After expansion, parent contract names
 * are removed from `contract.implements`, leaving only interface names.
 */
export default function expandInheritance(ast: SourceFileNode): SourceFileNode {
  // Build a map of available contracts from importedContracts
  const contractMap = new Map<string, ContractNode>();
  for (const c of ast.importedContracts) {
    contractMap.set(c.name, c);
  }

  // If the contract doesn't implement anything, nothing to do
  if (ast.contract.implements.length === 0) return ast;

  // Capture the linearization before expansion clears `implements` (used for super resolution).
  const linearization = computeLinearization(ast.contract, contractMap);

  const expanded = new Set<string>();
  expandContract(ast.contract, contractMap, expanded, new Set());

  resolveSuperAndBaseCalls(ast.contract, linearization);

  return ast;
}

// C3 linearization (the MRO Python/Solidity use): most-derived first, each class before its parents,
// left-to-right priority, monotonic. Equals depth-first for linear/tree hierarchies, differs only in
// diamonds. Throws if no consistent linearization exists.
function computeLinearization(contract: ContractNode, contractMap: Map<string, ContractNode>): string[] {
  const parentsOf = (name: string): string[] => {
    const implementsList = name === contract.name ? contract.implements : (contractMap.get(name)?.implements ?? []);
    return implementsList.filter((n) => contractMap.has(n));
  };

  const linearize = (name: string): string[] => {
    const parents = parentsOf(name);
    if (parents.length === 0) return [name];
    const sequences = [...parents.map((p) => linearize(p)), [...parents]];
    return [name, ...c3Merge(sequences, contract)];
  };

  return linearize(contract.name);
}

// Merge step of C3: repeatedly take the head of some sequence that appears in no sequence's tail.
function c3Merge(sequences: string[][], contract: ContractNode): string[] {
  const result: string[] = [];
  let lists = sequences.map((s) => [...s]).filter((s) => s.length > 0);
  while (lists.length > 0) {
    let head: string | undefined;
    for (const list of lists) {
      const candidate = list[0];
      if (!lists.some((other) => other.slice(1).includes(candidate))) {
        head = candidate;
        break;
      }
    }
    if (head === undefined) {
      throw new C3LinearizationError(contract);
    }
    result.push(head);
    lists = lists.map((list) => (list[0] === head ? list.slice(1) : list)).filter((s) => s.length > 0);
  }
  return result;
}

/**
 * Recursively expand a contract's inheritance chain.
 * @param contract The contract to expand
 * @param contractMap Map of available imported contracts
 * @param expanded Set of already-expanded contract names (for memoization)
 * @param expanding Set of contracts currently being expanded (for circular detection)
 */
function expandContract(
  contract: ContractNode,
  contractMap: Map<string, ContractNode>,
  expanded: Set<string>,
  expanding: Set<string>,
): void {
  if (expanding.has(contract.name)) {
    throw new CircularContractInheritanceError(contract);
  }

  // Separate parent contracts from interface names
  const parentNames: string[] = [];
  const remainingImplements: string[] = [];

  for (const name of contract.implements) {
    if (contractMap.has(name)) {
      parentNames.push(name);
    } else {
      // It's an interface name - keep it
      remainingImplements.push(name);
    }
  }

  if (parentNames.length === 0) return;

  // Validate parent invocations
  const invocationNames = new Set<string>();
  for (const pi of contract.parentInvocations) {
    if (invocationNames.has(pi.parentName)) {
      throw new DuplicateParentInvocationError(contract, pi.parentName);
    }
    invocationNames.add(pi.parentName);
    if (!parentNames.includes(pi.parentName)) {
      throw new UndefinedParentInvocationError(contract, pi.parentName);
    }
  }

  expanding.add(contract.name);

  // Merge parents left-to-right
  for (const parentName of parentNames) {
    const parent = contractMap.get(parentName)!;

    // Recursively expand parent first (if it has its own parents)
    if (!expanded.has(parentName) && parent.implements.length > 0) {
      expandContract(parent, contractMap, expanded, new Set(expanding));
    }

    mergeParent(contract, parent);
  }

  inlineParentConstructors(contract, parentNames, contractMap);

  expanding.delete(contract.name);
  expanded.add(contract.name);

  // Remove parent contract names from implements (leaving only interface names)
  contract.implements = remainingImplements;
}

/**
 * Inline parent constructor bodies into the child constructor. Solidity runs base constructors first, in the
 * order the parents are listed (`is X, Y` -> X then Y), each with the args from its matching invocation
 * (constructor-level `X(args)` or inheritance-list `is X(args)`). Parents are already expanded, so a parent's
 * own parents' ctors are already inlined into it. Only invoked parents are inlined - that path previously failed
 * the arg-count check, so this is purely additive (existing inheritance without parent-ctor-args is untouched).
 */
function inlineParentConstructors(
  contract: ContractNode,
  parentNames: string[],
  contractMap: Map<string, ContractNode>,
): void {
  const parentStmts: StatementNode[] = [];
  for (const parentName of parentNames) {
    const invocation = contract.parentInvocations.find((pi) => pi.parentName === parentName);
    if (!invocation) continue;
    const parent = contractMap.get(parentName)!;
    if (!parent.constructorDef?.body?.statements?.length) continue;
    const ctorParams = effectiveConstructorParams(parent);
    const clonedCtor = cloneNode(parent.constructorDef);
    substituteInFunction(clonedCtor, new Map(ctorParams.map((p, i) => [p.name, invocation.args[i]])));
    parentStmts.push(...(clonedCtor.body.statements ?? []));
  }
  if (parentStmts.length === 0) return;

  if (!contract.constructorDef) {
    const body = new BlockNode([]);
    body.location = contract.location;
    contract.constructorDef = new FunctionDefinitionNode('__construct', [], body);
    contract.constructorDef.location = contract.location;
  }
  contract.constructorDef.body.statements = [...parentStmts, ...(contract.constructorDef.body.statements ?? [])];
}

/**
 * Merge a parent contract's definitions into a child contract.
 */
function mergeParent(child: ContractNode, parent: ContractNode): void {
  const invocation = child.parentInvocations.find((pi) => pi.parentName === parent.name);

  // Build substitution map if explicit invocation exists. A Solidity-style parent declares its constructor
  // params in `constructor(...)` (parent.constructorDef.parameters), not the contract-level params.
  const ctorParams = effectiveConstructorParams(parent);
  let subs: Map<string, ExpressionNode> | undefined;
  if (invocation) {
    if (invocation.args.length !== ctorParams.length) {
      throw new ParentInvocationArgCountError(
        child, parent.name, ctorParams.length, invocation.args.length,
      );
    }
    subs = new Map(ctorParams.map((p, i) => [p.name, invocation.args[i]]));
  }

  // 1. Merge functions (with optional substitution)
  mergeFunctions(child, parent, subs);

  // 2. Merge constructor params only if no explicit invocation
  if (!invocation) {
    mergeConstructorParams(child, parent);
  }

  // 3. Merge state variables (with inheritedFrom tracking)
  mergeNamedList(child, parent, 'stateVariables', 'State variable');

  // 4. Merge collections (with inheritedFrom tracking)
  mergeNamedList(child, parent, 'collections', 'Collection');

  // 5. Merge constants (with optional substitution)
  mergeConstants(child, parent, subs);

  // 6. Merge enums
  mergeNamedList(child, parent, 'enumDefinitions', 'Enum');

  // 7. Merge structs
  mergeNamedList(child, parent, 'structDefinitions', 'Struct');

  // 8. Merge events
  mergeNamedList(child, parent, 'eventDefinitions', 'Event');

  // 9. Merge errors
  mergeNamedList(child, parent, 'errorDefinitions', 'Error');

  // 10. Merge modifiers
  mergeNamedList(child, parent, 'modifierDefinitions', 'Modifier');

  // 11. Merge type definitions
  mergeNamedList(child, parent, 'typeDefinitions', 'Type');
}

/**
 * Merge parent functions into child.
 * If child has a function with the same name, it must be marked `override`.
 * If a substitution map is provided, apply it to cloned parent functions.
 *
 * Diamond inheritance: if child already has a function inherited from the same
 * original ancestor, the duplicate is silently skipped. If inherited from
 * different ancestors, MissingOverrideError is thrown.
 */
function mergeFunctions(
  child: ContractNode,
  parent: ContractNode,
  subs?: Map<string, ExpressionNode>,
): void {
  const childFuncMap = new Map(child.functions.map((f) => [f.name, f]));

  for (const parentFunc of parent.functions) {
    const existingFunc = childFuncMap.get(parentFunc.name);

    if (existingFunc) {
      // Diamond detection: both inherited from the same original ancestor -> skip duplicate
      const parentOrigin = parentFunc.inheritedFrom ?? parent.name;
      const childOrigin = existingFunc.inheritedFrom;

      if (childOrigin && childOrigin === parentOrigin) {
        // Same origin ancestor - diamond duplicate, skip silently
        continue;
      }

      // Child's OWN explicit override resolves conflicts (not inherited overrides). Preserve the
      // overridden parent body under a mangled internal name so super.f()/Base.f() can still call it.
      if (!existingFunc.inheritedFrom
          && existingFunc.modifiers.includes(FunctionModifier.OVERRIDE)) {
        // Meaningful virtual: a parent function must be virtual (or abstract) to be overridable.
        if (!parentFunc.isAbstract && !parentFunc.modifiers.includes(FunctionModifier.VIRTUAL)) {
          throw new NonVirtualOverrideError(existingFunc, parentFunc.name, parentFunc.inheritedFrom ?? parent.name);
        }
        preserveOverriddenFunction(child, parentFunc, parent, subs);
        continue;
      }

      // Both sides are inherited from different ancestors -> diamond conflict
      if (existingFunc.inheritedFrom) {
        throw new DiamondInheritanceError(
          child, 'Function', parentFunc.name, existingFunc.inheritedFrom, parent.name,
        );
      }

      // Child has same-named function without override -> error
      throw new MissingOverrideError(child, parentFunc.name, parent.name);
    } else {
      // Inherit parent function (cloned to avoid shared mutable state)
      const cloned = cloneNode(parentFunc);
      if (!cloned.inheritedFrom) {
        cloned.inheritedFrom = parent.name;
      }
      if (subs) {
        substituteInFunction(cloned, subs);
      }
      child.functions.push(cloned);
      childFuncMap.set(cloned.name, cloned);
    }
  }
}

// Preserve a parent function that the child overrides, under a mangled internal name, so super.f()
// and Base.f() can still call it. Forced to internal visibility (never an entry point).
function preserveOverriddenFunction(
  child: ContractNode,
  parentFunc: FunctionDefinitionNode,
  parent: ContractNode,
  subs?: Map<string, ExpressionNode>,
): void {
  if (parentFunc.isAbstract) return; // no body to call via super/Base
  const definingContract = parentFunc.inheritedFrom ?? parent.name;
  const mangled = superImplName(definingContract, parentFunc.name);
  if (child.functions.some((f) => f.name === mangled)) return; // already preserved (diamond)

  const cloned = cloneNode(parentFunc);
  cloned.name = mangled;
  cloned.definingContract = definingContract;
  cloned.inheritedFrom = definingContract;
  cloned.modifiers = cloned.modifiers.filter((m) => m !== FunctionModifier.PUBLIC
    && m !== FunctionModifier.EXTERNAL && m !== FunctionModifier.OVERRIDE && m !== FunctionModifier.VIRTUAL);
  if (!cloned.modifiers.includes(FunctionModifier.INTERNAL)) {
    cloned.modifiers.push(FunctionModifier.INTERNAL);
  }
  if (subs) substituteInFunction(cloned, subs);
  child.functions.push(cloned);
}

// The flattened-contract function name that implements `fnName` as defined in `definingContract`:
// the preserved mangled copy if present, else the plain function when it is that contract's own.
function superImplFor(contract: ContractNode, definingContract: string, fnName: string): string | undefined {
  const mangled = superImplName(definingContract, fnName);
  if (contract.functions.some((f) => f.name === mangled)) return mangled;
  const plain = contract.functions.find((f) => f.name === fnName);
  if (plain && (plain.definingContract ?? plain.inheritedFrom ?? contract.name) === definingContract) {
    return fnName;
  }
  return undefined;
}

// Rewrite `super.f(...)`/`Base.f(...)` to the preserved parent implementations, then prune preserved
// bodies no call reaches (dead bodies may reference parent-only state and fail to compile).
function resolveSuperAndBaseCalls(contract: ContractNode, linearization: string[]): void {
  const ancestors = new Set(linearization);
  const indexOf = new Map(linearization.map((name, i) => [name, i]));
  const references = new Map<string, Set<string>>(); // function name -> preserved impls it calls

  // Validate explicit `override(A, B)` base lists: each named base must be an ancestor that declares it.
  for (const fn of contract.functions) {
    for (const base of fn.overrideBases) {
      if (!ancestors.has(base) || !superImplFor(contract, base, fn.name)) {
        throw new OverrideBaseListError(fn, fn.name, base);
      }
    }
  }

  for (const fn of contract.functions) {
    const definingContract = fn.definingContract ?? fn.inheritedFrom ?? contract.name;
    const used = new Set<string>();
    const resolve = (callName: string): string | undefined => {
      const dot = callName.indexOf('.');
      if (dot < 0) return undefined;
      const namespace = callName.slice(0, dot);
      const target = callName.slice(dot + 1);

      let impl: string | undefined;
      if (namespace === 'super') {
        const start = indexOf.get(definingContract);
        if (start === undefined) return undefined;
        for (let i = start + 1; i < linearization.length && !impl; i += 1) {
          impl = superImplFor(contract, linearization[i], target);
        }
      } else if (ancestors.has(namespace)) {
        impl = superImplFor(contract, namespace, target);
      } else {
        return undefined; // library / interface / other namespaced call - leave alone
      }

      if (impl && impl.startsWith('__base_')) used.add(impl);
      return impl;
    };
    new SuperCallRewriter(resolve).visit(fn.body);
    references.set(fn.name, used);
  }

  // Keep only preserved functions reachable from the non-preserved (real) functions.
  const reachable = new Set<string>();
  const queue = contract.functions.filter((f) => !f.name.startsWith('__base_')).map((f) => f.name);
  while (queue.length > 0) {
    const name = queue.shift()!;
    for (const impl of references.get(name) ?? []) {
      if (!reachable.has(impl)) {
        reachable.add(impl);
        queue.push(impl);
      }
    }
  }
  contract.functions = contract.functions.filter((f) => !f.name.startsWith('__base_') || reachable.has(f.name));
}

// Renames matching FunctionCallNode identifiers (super.f / Base.f -> preserved impl) in place.
class SuperCallRewriter extends AstTraversal {
  constructor(private readonly resolve: (callName: string) => string | undefined) {
    super();
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    const target = this.resolve(node.identifier.name);
    if (target) node.identifier.name = target;
    return super.visitFunctionCall(node);
  }
}

/**
 * Merge constructor params: prepend parent params to child params.
 * Skip params that already exist in the child (by name).
 */
/**
 * The params a constructor invocation must match: contract-level params (native `contract X(p)`) if any, else
 * the `constructor(p)` params (Solidity style declares them there, not on the contract).
 */
function effectiveConstructorParams(c: ContractNode): ParameterNode[] {
  return c.parameters.length > 0 ? c.parameters : (c.constructorDef?.parameters ?? []);
}

function mergeConstructorParams(child: ContractNode, parent: ContractNode): void {
  if (parent.parameters.length === 0) return;

  const childParamNames = new Set(child.parameters.map((p) => p.name));
  const newParams = parent.parameters
    .filter((p) => !childParamNames.has(p.name))
    .map((p) => cloneNode(p));

  child.parameters = [...newParams, ...child.parameters];
}

/**
 * Merge constants from parent into child, applying substitution if provided.
 * Supports diamond inheritance: constants from the same ancestor are deduplicated.
 */
function mergeConstants(
  child: ContractNode,
  parent: ContractNode,
  subs?: Map<string, ExpressionNode>,
): void {
  const parentList = parent.constantDefinitions;
  const childList = child.constantDefinitions;

  if (parentList.length === 0) return;

  const childMap = new Map(childList.map((item) => [item.name, item]));
  const toInsert: ConstantDefinitionNode[] = [];

  for (const parentItem of parentList) {
    const existingItem = childMap.get(parentItem.name);

    if (existingItem) {
      // Diamond detection: both inherited from the same original ancestor -> skip duplicate
      const parentOrigin = parentItem.inheritedFrom ?? parent.name;
      const childOrigin = existingItem.inheritedFrom;

      if (childOrigin && childOrigin === parentOrigin) {
        continue;
      }

      throw new InheritanceNameCollisionError(child, 'Constant', parentItem.name, parent.name);
    }

    const cloned = cloneNode(parentItem);
    if (!cloned.inheritedFrom) {
      cloned.inheritedFrom = parent.name;
    }
    if (subs) {
      cloned.expression = substituteInExpression(cloned.expression, subs);
    }
    toInsert.push(cloned);
    childMap.set(cloned.name, cloned);
  }

  // Prepend all parent constants at once to preserve their original order
  if (toInsert.length > 0) {
    child.constantDefinitions.unshift(...toInsert);
  }
}

type NamedArrayKey = 'stateVariables' | 'collections' | 'constantDefinitions'
| 'enumDefinitions' | 'structDefinitions' | 'eventDefinitions' | 'errorDefinitions'
| 'modifierDefinitions' | 'typeDefinitions';

/**
 * Merge a named list (state variables, collections, constants, etc.) from parent into child.
 * Errors on name collision, unless both items trace back to the same ancestor (diamond inheritance).
 * Sets `inheritedFrom` on cloned items to track origin for diamond detection and visibility.
 */
function mergeNamedList(
  child: ContractNode,
  parent: ContractNode,
  key: NamedArrayKey,
  kind: string,
): void {
  const parentList = parent[key] as { name: string; inheritedFrom?: string }[];
  const childList = child[key] as { name: string; inheritedFrom?: string }[];

  if (parentList.length === 0) return;

  const childMap = new Map(childList.map((item) => [item.name, item]));
  const toInsert: Node[] = [];

  for (const parentItem of parentList) {
    const existingItem = childMap.get(parentItem.name);

    if (existingItem) {
      // Diamond detection: both inherited from the same original ancestor -> skip duplicate
      const parentOrigin = parentItem.inheritedFrom ?? parent.name;
      const childOrigin = existingItem.inheritedFrom;

      if (childOrigin && childOrigin === parentOrigin) {
        // Same origin ancestor - diamond duplicate, skip silently
        continue;
      }

      throw new InheritanceNameCollisionError(child, kind, parentItem.name, parent.name);
    }

    // Clone and prepend parent items
    const cloned = cloneNode(parentItem as unknown as Node) as unknown as { name: string; inheritedFrom?: string };

    // Track inheritance origin for diamond detection and visibility enforcement
    if (!cloned.inheritedFrom) {
      cloned.inheritedFrom = parent.name;
    }

    toInsert.push(cloned as unknown as Node);
    childMap.set(cloned.name, cloned);
  }

  // Prepend all parent items at once to preserve their original order
  if (toInsert.length > 0) {
    (child[key] as Node[]).unshift(...toInsert);
  }
}

// ---- Expression substitution ----

/**
 * Recursively substitute IdentifierNode references in an expression tree.
 * Returns a new expression if substitution occurred, otherwise returns the original.
 */
export function substituteInExpression(
  expr: ExpressionNode,
  subs: Map<string, ExpressionNode>,
): ExpressionNode {
  if (expr instanceof IdentifierNode) {
    const replacement = subs.get(expr.name);
    if (replacement) {
      return cloneNode(replacement);
    }
    return expr;
  }

  if (expr instanceof BinaryOpNode) {
    expr.left = substituteInExpression(expr.left, subs);
    expr.right = substituteInExpression(expr.right, subs);
    return expr;
  }

  if (expr instanceof UnaryOpNode) {
    expr.expression = substituteInExpression(expr.expression, subs);
    return expr;
  }

  if (expr instanceof CastNode) {
    expr.expression = substituteInExpression(expr.expression, subs);
    return expr;
  }

  if (expr instanceof FunctionCallNode) {
    expr.parameters = expr.parameters.map((p) => substituteInExpression(p, subs));
    return expr;
  }

  if (expr instanceof TernaryOpNode) {
    expr.condition = substituteInExpression(expr.condition, subs);
    expr.ifTrue = substituteInExpression(expr.ifTrue, subs);
    expr.ifFalse = substituteInExpression(expr.ifFalse, subs);
    return expr;
  }

  if (expr instanceof ArrayNode) {
    expr.elements = expr.elements.map((e) => substituteInExpression(e, subs));
    return expr;
  }

  if (expr instanceof ArrayAccessNode) {
    expr.array = substituteInExpression(expr.array, subs);
    expr.index = substituteInExpression(expr.index, subs);
    return expr;
  }

  if (expr instanceof SliceNode) {
    expr.element = substituteInExpression(expr.element, subs);
    expr.start = substituteInExpression(expr.start, subs);
    expr.end = substituteInExpression(expr.end, subs);
    return expr;
  }

  if (expr instanceof TupleIndexOpNode) {
    expr.tuple = substituteInExpression(expr.tuple, subs);
    return expr;
  }

  if (expr instanceof AbiEncodeNode) {
    expr.parameters = expr.parameters.map((p) => substituteInExpression(p, subs));
    return expr;
  }

  if (expr instanceof AbiEncodePackedNode) {
    expr.parameters = expr.parameters.map((p) => substituteInExpression(p, subs));
    return expr;
  }

  if (expr instanceof AbiDecodeNode) {
    expr.data = substituteInExpression(expr.data, subs);
    return expr;
  }

  if (expr instanceof AbiDecodeAtNode) {
    expr.data = substituteInExpression(expr.data, subs);
    return expr;
  }

  if (expr instanceof InstantiationNode) {
    expr.parameters = expr.parameters.map((p) => substituteInExpression(p, subs));
    return expr;
  }

  if (expr instanceof FieldAccessNode) {
    expr.expression = substituteInExpression(expr.expression, subs);
    return expr;
  }

  if (expr instanceof ContractReferenceNode) {
    expr.constructorArgs = expr.constructorArgs.map((a) => substituteInExpression(a, subs));
    return expr;
  }

  if (expr instanceof StateAccessNode) {
    return expr;
  }

  if (expr instanceof MappingAccessNode) {
    expr.keys = expr.keys.map((k) => substituteInExpression(k, subs));
    return expr;
  }

  if (expr instanceof AbiEncodeCallNode) {
    expr.parameters = expr.parameters.map((p) => substituteInExpression(p, subs));
    return expr;
  }

  if (expr instanceof BytesConcatNode) {
    expr.parameters = expr.parameters.map((p) => substituteInExpression(p, subs));
    return expr;
  }

  if (expr instanceof StringConcatNode) {
    expr.parameters = expr.parameters.map((p) => substituteInExpression(p, subs));
    return expr;
  }

  if (expr instanceof AddressSendExpressionNode) {
    expr.addressExpression = substituteInExpression(expr.addressExpression, subs);
    expr.amount = substituteInExpression(expr.amount, subs);
    return expr;
  }

  if (expr instanceof LowLevelCallNode) {
    expr.targetExpression = substituteInExpression(expr.targetExpression, subs);
    expr.data = substituteInExpression(expr.data, subs);
    if (expr.callOptions?.value) {
      expr.callOptions.value = substituteInExpression(expr.callOptions.value, subs);
    }
    if (expr.callOptions?.gas) {
      expr.callOptions.gas = substituteInExpression(expr.callOptions.gas, subs);
    }
    if (expr.callOptions?.salt) {
      expr.callOptions.salt = substituteInExpression(expr.callOptions.salt, subs);
    }
    return expr;
  }

  if (expr instanceof TypeIntrospectionNode) {
    // No child expressions to substitute - typeArgText and property are strings
    return expr;
  }

  // LiteralNode, NullaryOpNode, etc. - no substitution needed
  return expr;
}

/**
 * Apply substitution to all statements in a function body.
 */
export function substituteInFunction(
  func: FunctionDefinitionNode,
  subs: Map<string, ExpressionNode>,
): void {
  substituteInBlock(func.body, subs);
}

function substituteInBlock(block: BlockNode, subs: Map<string, ExpressionNode>): void {
  if (!block.statements) return;
  block.statements = block.statements.map((stmt) => substituteInStatement(stmt, subs));
}

function substituteInStatement(
  stmt: StatementNode,
  subs: Map<string, ExpressionNode>,
): StatementNode {
  if (stmt instanceof VariableDefinitionNode) {
    if (stmt.expression) stmt.expression = substituteInExpression(stmt.expression, subs);
    return stmt;
  }

  if (stmt instanceof AssignNode) {
    stmt.expression = substituteInExpression(stmt.expression, subs);
    return stmt;
  }

  if (stmt instanceof BranchNode) {
    stmt.condition = substituteInExpression(stmt.condition, subs);
    substituteInBlock(stmt.ifBlock, subs);
    if (stmt.elseBlock) substituteInBlock(stmt.elseBlock, subs);
    return stmt;
  }

  if (stmt instanceof DoWhileNode) {
    stmt.condition = substituteInExpression(stmt.condition, subs);
    substituteInBlock(stmt.block as BlockNode, subs);
    return stmt;
  }

  if (stmt instanceof WhileNode) {
    stmt.condition = substituteInExpression(stmt.condition, subs);
    substituteInBlock(stmt.block, subs);
    return stmt;
  }

  if (stmt instanceof RequireNode) {
    stmt.expression = substituteInExpression(stmt.expression, subs);
    return stmt;
  }

  if (stmt instanceof TimeOpNode) {
    stmt.expression = substituteInExpression(stmt.expression, subs);
    return stmt;
  }

  if (stmt instanceof StateAssignNode) {
    stmt.expression = substituteInExpression(stmt.expression, subs);
    return stmt;
  }

  if (stmt instanceof MappingAssignNode) {
    stmt.keys = stmt.keys.map((k) => substituteInExpression(k, subs));
    stmt.expression = substituteInExpression(stmt.expression, subs);
    return stmt;
  }

  if (stmt instanceof MappingFieldAssignNode) {
    stmt.keys = stmt.keys.map((k) => substituteInExpression(k, subs));
    stmt.expression = substituteInExpression(stmt.expression, subs);
    return stmt;
  }

  if (stmt instanceof MappingDeleteNode) {
    stmt.keys = stmt.keys.map((k) => substituteInExpression(k, subs));
    return stmt;
  }

  if (stmt instanceof EmitStatementNode) {
    stmt.args = stmt.args.map((a) => substituteInExpression(a, subs));
    return stmt;
  }

  if (stmt instanceof TransferStatementNode) {
    stmt.lockingBytecode = substituteInExpression(stmt.lockingBytecode, subs);
    stmt.amount = substituteInExpression(stmt.amount, subs);
    return stmt;
  }

  if (stmt instanceof TokenContainerMethodStatementNode) {
    stmt.tokenContainerKeyExpression = substituteInExpression(stmt.tokenContainerKeyExpression, subs);
    stmt.args = stmt.args.map((a) => substituteInExpression(a, subs));
    return stmt;
  }

  if (stmt instanceof ReturnNode) {
    stmt.expressions = stmt.expressions.map((e) => substituteInExpression(e, subs));
    return stmt;
  }

  if (stmt instanceof RevertNode) {
    stmt.args = stmt.args.map((a) => substituteInExpression(a, subs));
    return stmt;
  }

  if (stmt instanceof FunctionCallStatementNode) {
    stmt.call.parameters = stmt.call.parameters.map((p) => substituteInExpression(p, subs));
    return stmt;
  }

  if (stmt instanceof TupleAssignmentNode) {
    if (stmt.tupleExpressions) {
      stmt.tupleExpressions = stmt.tupleExpressions.map((e) => substituteInExpression(e, subs));
    } else {
      stmt.tuple = substituteInExpression(stmt.tuple, subs);
    }
    return stmt;
  }

  if (stmt instanceof ArrayPushNode) {
    stmt.value = substituteInExpression(stmt.value, subs);
    return stmt;
  }

  if (stmt instanceof ArrayAssignNode) {
    stmt.index = substituteInExpression(stmt.index, subs);
    stmt.value = substituteInExpression(stmt.value, subs);
    return stmt;
  }

  if (stmt instanceof ArrayDeleteNode) {
    stmt.index = substituteInExpression(stmt.index, subs);
    return stmt;
  }

  if (stmt instanceof TryCatchNode) {
    stmt.expression = substituteInExpression(stmt.expression, subs);
    substituteInBlock(stmt.tryBlock, subs);
    for (const clause of stmt.catchClauses) {
      substituteInBlock(clause.block, subs);
    }
    return stmt;
  }

  if (stmt instanceof SwitchNode) {
    stmt.expression = substituteInExpression(stmt.expression, subs);
    for (const c of stmt.cases) {
      c.value = substituteInExpression(c.value, subs);
      substituteInBlock(c.body, subs);
    }
    if (stmt.defaultCase) substituteInBlock(stmt.defaultCase, subs);
    return stmt;
  }

  if (stmt instanceof UncheckedNode) {
    substituteInBlock(stmt.block, subs);
    return stmt;
  }

  if (stmt instanceof CollectionIterationNode) {
    substituteInBlock(stmt.body, subs);
    return stmt;
  }

  if (stmt instanceof DeleteLocalNode) {
    stmt.identifier = substituteInExpression(stmt.identifier, subs) as IdentifierNode;
    return stmt;
  }

  if (stmt instanceof BlockNode) {
    substituteInBlock(stmt, subs);
    return stmt;
  }

  // ArrayPopNode, AssemblyStatementNode, BreakNode, ContinueNode - nothing to substitute
  return stmt;
}
