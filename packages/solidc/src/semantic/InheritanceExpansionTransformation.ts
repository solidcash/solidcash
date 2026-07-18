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
  StateVariableNode,
  StateVariableVisibility,
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
import { tagModifierStateAccess } from './ModifierExpansionTransformation.js';

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
// Rename every bare-identifier reference to `oldName` -> `newName` within a node tree. A `FieldAccessNode.name`
// (a struct member) is left alone (its `expression` is still walked); only IdentifierNode occurrences - a state-var
// read pre-semantic, or an AssignNode's `.identifier` write target - are renamed.
function renameIdentifierRefs(node: Node | undefined, oldName: string, newName: string): void {
  if (!node) return;
  const walk = (n: Node): void => {
    if (n instanceof IdentifierNode) {
      if (n.name === oldName) n.name = newName;
      return;
    }
    for (const [key, value] of Object.entries(n)) {
      if (key === 'name' && n instanceof FieldAccessNode) continue; // struct field, never the state var
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) { for (const it of value) if (it instanceof Node) walk(it); }
    }
  };
  walk(node);
}

// Solidity permits the SAME private state-var name in DIFFERENT ancestors - each is a separate, inaccessible slot
// (OZ EIP712 `_name` alongside ERC20 `_name`). SolidCash flattens every ancestor into one contract, where the
// duplicate name would collide (mergeNamedList). Origin-mangle each colliding PRIVATE var (rename its declaration +
// every reference inside its OWN declaring contract's members) BEFORE flattening, so the merge sees distinct names.
// Only private vars are mangled - they are never referenced from outside their declaring contract, so the rename is
// contained; a public/internal same-name collision is a genuine override/shadow and still errors. Operates on the
// source contracts (re-parsed per compile, so the mutation is compile-local).
function mangleCollidingPrivateVars(
  linearization: string[],
  contractMap: Map<string, ContractNode>,
  primary: ContractNode,
): void {
  const resolve = (name: string): ContractNode | undefined => (name === primary.name ? primary : contractMap.get(name));
  const ancestors = linearization.map(resolve).filter((c): c is ContractNode => Boolean(c));
  const byName = new Map<string, ContractNode[]>(); // private var name -> ancestors declaring it
  for (const c of ancestors) {
    for (const sv of c.stateVariables as StateVariableNode[]) {
      if (sv.visibility !== StateVariableVisibility.PRIVATE) continue;
      const list = byName.get(sv.name) ?? [];
      list.push(c);
      byName.set(sv.name, list);
    }
  }
  for (const [name, decls] of byName) {
    if (decls.length < 2) continue; // declared in only one ancestor - no collision
    for (const c of decls) {
      const sv = (c.stateVariables as StateVariableNode[]).find((v) => v.name === name);
      if (!sv) continue; // already mangled via a shared ancestor visited under another root
      const mangled = `${c.name}__${name}`;
      sv.name = mangled;
      const members: (Node | undefined)[] = [
        ...(c.functions ?? []), ...(c.modifierDefinitions ?? []), c.constructorDef, c.fallbackDef, c.receiveDef,
      ];
      for (const m of members) {
        // Skip a member that declares `name` as a PARAMETER - there the identifier is the param, not the state var.
        if (m && (m as FunctionDefinitionNode).parameters?.some((p) => p.name === name)) continue;
        renameIdentifierRefs(m, name, mangled);
      }
      if (sv.initializer) renameIdentifierRefs(sv.initializer, name, mangled);
    }
  }
}

export default function expandInheritance(ast: SourceFileNode): SourceFileNode {
  // Build a map of available contracts from importedContracts
  const contractMap = new Map<string, ContractNode>();
  for (const c of ast.importedContracts) {
    contractMap.set(c.name, c);
  }

  // Expansion clears each contract's `implements`; snapshot the original hierarchy so linearizations
  // computed after a sibling expansion (memoized) still see the full parent lists.
  const originalImplements = new Map<string, string[]>();
  originalImplements.set(ast.contract.name, [...ast.contract.implements]);
  for (const c of ast.importedContracts) {
    if (!originalImplements.has(c.name)) originalImplements.set(c.name, [...c.implements]);
  }

  const expanded = new Set<string>();

  // The primary contract's own ancestors (captured before expansion clears `implements`) are flattened as part
  // of the primary's expansion below; flattening one independently first would double-merge a shared diamond
  // ancestor into the primary. So compute the primary's linearization up front and skip those names.
  const primaryLinearization = ast.contract.implements.length > 0
    ? computeLinearization(ast.contract, contractMap, originalImplements) : [ast.contract.name];
  const primaryAncestors = new Set(primaryLinearization);

  // Flatten IMPORTED contracts that carry their own inheritance and are USED/instantiated independently (not a
  // primary ancestor), so `new Middle()` where `Middle is Oracle` is a complete definition with its base merged
  // in - otherwise its unresolved base surfaces later as an "undefined interface". expandContract recursively
  // expands each base first and memoizes via `expanded`, so shared bases are merged once.
  for (const imported of [...ast.importedContracts]) {
    if (imported.implements.length > 0 && !expanded.has(imported.name) && !primaryAncestors.has(imported.name)) {
      const importedLinearization = computeLinearization(imported, contractMap, originalImplements);
      mangleCollidingPrivateVars(importedLinearization, contractMap, ast.contract);
      expandContract(imported, contractMap, expanded, new Set(), originalImplements);
      resolveSuperAndBaseCalls(imported, importedLinearization);
    }
  }

  // If the primary contract doesn't implement anything, nothing more to do
  if (ast.contract.implements.length === 0) return ast;

  // Origin-mangle any private state var declared in >1 ancestor before flattening (Solidity allows same-name
  // private vars across ancestors; the flatten would otherwise collide). See mangleCollidingPrivateVars.
  mangleCollidingPrivateVars(primaryLinearization, contractMap, ast.contract);

  expandContract(ast.contract, contractMap, expanded, new Set(), originalImplements);

  resolveSuperAndBaseCalls(ast.contract, primaryLinearization);

  return ast;
}

// C3 linearization (the MRO Python/Solidity use): most-derived first, each class before its parents,
// left-to-right priority, monotonic. Equals depth-first for linear/tree hierarchies, differs only in
// diamonds. Throws if no consistent linearization exists.
function computeLinearization(
  contract: ContractNode,
  contractMap: Map<string, ContractNode>,
  originalImplements?: Map<string, string[]>,
): string[] {
  const parentsOf = (name: string): string[] => {
    const implementsList = originalImplements?.get(name)
      ?? (name === contract.name ? contract.implements : (contractMap.get(name)?.implements ?? []));
    return implementsList.filter((n) => contractMap.has(n));
  };

  const linearize = (name: string, stack: Set<string> = new Set()): string[] => {
    // Guard against circular inheritance (A is B, B is A) so the recursion throws cleanly instead of
    // overflowing the stack. Cross-file cycles reach here once circular imports are allowed.
    if (stack.has(name)) {
      throw new CircularContractInheritanceError(name === contract.name ? contract : contractMap.get(name)!);
    }
    const parents = parentsOf(name);
    if (parents.length === 0) return [name];
    const nextStack = new Set(stack).add(name);
    // Solidity lists bases most-base-first, so the C3 merge consumes the REVERSED parent list
    // (rightmost base = highest priority), unlike Python's left-to-right MRO.
    const reversed = [...parents].reverse();
    const sequences = [...reversed.map((p) => linearize(p, nextStack)), [...reversed]];
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
  originalImplements?: Map<string, string[]>,
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

  // `m(args)` and `Base(args)` are grammatically identical in the constructor list, so modifier
  // invocations parse into parentInvocations - reroute those to the constructor's custom modifiers.
  // Invocations naming INDIRECT ancestors (grandparent ctor args) are kept for constructor inlining.
  const linearization = computeLinearization(contract, contractMap, originalImplements);
  const ancestorSet = new Set(linearization);
  const modifierNames = new Set(contract.modifierDefinitions.map((m) => m.name));
  for (const ancestor of linearization) {
    for (const md of contractMap.get(ancestor)?.modifierDefinitions ?? []) modifierNames.add(md.name);
  }
  const rerouted = contract.parentInvocations
    .filter((pi) => !ancestorSet.has(pi.parentName) && modifierNames.has(pi.parentName));
  if (rerouted.length > 0 && contract.constructorDef) {
    contract.constructorDef.customModifiers = [
      ...contract.constructorDef.customModifiers,
      ...rerouted.map((pi) => ({ name: pi.parentName, args: pi.args, location: pi.location })),
    ].sort((a, b) => a.location.start.line - b.location.start.line
      || a.location.start.column - b.location.start.column);
    contract.parentInvocations = contract.parentInvocations.filter((pi) => !rerouted.includes(pi));
  }

  // Validate parent invocations
  const invocationNames = new Set<string>();
  for (const pi of contract.parentInvocations) {
    if (invocationNames.has(pi.parentName)) {
      throw new DuplicateParentInvocationError(contract, pi.parentName);
    }
    invocationNames.add(pi.parentName);
    if (!ancestorSet.has(pi.parentName)) {
      throw new UndefinedParentInvocationError(contract, pi.parentName);
    }
  }

  expanding.add(contract.name);

  // Ancestor relation over the ORIGINAL hierarchy, for diamond dominance (an override in a derived base
  // beats the overridden ancestor version - not a conflict).
  const isAncestor = (ancestor: string, descendant: string): boolean => {
    const seen = new Set<string>();
    const stack = [...(originalImplements?.get(descendant)
      ?? contractMap.get(descendant)?.implements ?? [])];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n === ancestor) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      stack.push(...(originalImplements?.get(n) ?? contractMap.get(n)?.implements ?? []));
    }
    return false;
  };

  // Merge parents left-to-right
  for (const parentName of parentNames) {
    const parent = contractMap.get(parentName)!;

    // Recursively expand parent first (if it has its own parents)
    if (!expanded.has(parentName) && parent.implements.length > 0) {
      expandContract(parent, contractMap, expanded, new Set(expanding), originalImplements);
    }

    mergeParent(contract, parent, isAncestor);
  }

  inlineParentConstructors(contract, parentNames, contractMap, linearization);

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
  linearization: string[],
): void {
  const parentStmts: StatementNode[] = [];

  // Invocations naming INDIRECT ancestors (grandparent ctor args, e.g. `contract D is C { constructor() B(5) }`)
  // inline that ancestor's (already expanded) ctor first - most-base-first among themselves - since an
  // uninvoked parameterized link drops the sub-chain from the direct-parent walk below. Chain-covered
  // ancestors are skipped: parameterless ctors auto-inline through the chain, and an intermediate
  // invocation already applied its args.
  const indirect = contract.parentInvocations.filter((pi) => !parentNames.includes(pi.parentName));
  for (const ancestorName of [...linearization].reverse()) {
    const invocation = indirect.find((pi) => pi.parentName === ancestorName);
    if (!invocation) continue;
    const ancestor = contractMap.get(ancestorName);
    if (!ancestor?.constructorDef?.body?.statements?.length) continue;
    const ctorParams = effectiveConstructorParams(ancestor);
    if (ctorParams.length === 0) continue; // parameterless: chain-inlined already
    const chainInvoked = linearization.some((name) => name !== contract.name
      && (contractMap.get(name)?.parentInvocations ?? []).some((pi) => pi.parentName === ancestorName));
    if (chainInvoked) continue;
    if (invocation.args.length !== ctorParams.length) {
      throw new ParentInvocationArgCountError(contract, ancestorName, ctorParams.length, invocation.args.length);
    }
    const clonedCtor = cloneNode(ancestor.constructorDef);
    substituteInFunction(clonedCtor, new Map(ctorParams.map((p, i) => [p.name, invocation.args[i]])));
    // The ancestor constructor (incl. inlined state-var initializers) legitimately touches the ancestor's OWN
    // private state; tag its accesses so the flattened child does not trip the private-access check.
    tagModifierStateAccess(clonedCtor.body.statements ?? [], ancestorName);
    parentStmts.push(...(clonedCtor.body.statements ?? []));
  }

  for (const parentName of parentNames) {
    const invocation = contract.parentInvocations.find((pi) => pi.parentName === parentName);
    const parent = contractMap.get(parentName)!;
    if (!parent.constructorDef?.body?.statements?.length) continue;
    const ctorParams = effectiveConstructorParams(parent);
    // MD4: a parent constructor runs even without an explicit `is Parent(args)` invocation - Solidity's implicit
    // base-constructor call - otherwise guard-relevant init (e.g. owner = ...) silently stays at the zero default.
    // Without an invocation we can only run a PARAMETERLESS parent ctor (a parameterized one needs explicit args,
    // which Solidity requires); skip a parameterized, un-invoked parent as before.
    if (!invocation && ctorParams.length > 0) continue;
    const clonedCtor = cloneNode(parent.constructorDef);
    if (invocation) {
      substituteInFunction(clonedCtor, new Map(ctorParams.map((p, i) => [p.name, invocation.args[i]])));
    }
    tagModifierStateAccess(clonedCtor.body.statements ?? [], parentName);
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
function mergeParent(
  child: ContractNode,
  parent: ContractNode,
  isAncestor?: (ancestor: string, descendant: string) => boolean,
): void {
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
  mergeFunctions(child, parent, subs, isAncestor);

  // 2. Merge constructor params only if no explicit invocation
  if (!invocation) {
    mergeConstructorParams(child, parent);
  }

  // 3. Merge state variables (with inheritedFrom tracking)
  mergeNamedList(child, parent, 'stateVariables', 'State variable');

  // 3b. Merge transient state vars (kept off `stateVariables`); prepend the parent's, skipping any the child
  // already declares by name (the derived declaration wins, like a state-variable override).
  const childTransientNames = new Set(child.transientStateVars.map((tv) => tv.name));
  const inheritedTransient = parent.transientStateVars.filter((tv) => !childTransientNames.has(tv.name));
  child.transientStateVars = [...inheritedTransient, ...child.transientStateVars];

  // 4. Merge collections (with inheritedFrom tracking)
  mergeNamedList(child, parent, 'collections', 'Collection');

  // 5. Merge constants (with optional substitution)
  mergeConstants(child, parent, subs);

  // 6. Merge enums
  mergeNamedList(child, parent, 'enumDefinitions', 'Enum');

  // 7. Merge structs
  mergeNamedList(child, parent, 'structDefinitions', 'Struct');

  // 8. Merge events. Events overload on their parameter signature, so same-name/different-signature parent
  // and child events coexist rather than colliding.
  mergeNamedList(child, parent, 'eventDefinitions', 'Event', false, true);

  // 9. Merge errors. Errors overload on signature too.
  mergeNamedList(child, parent, 'errorDefinitions', 'Error', false, true);

  // 10. Merge modifiers. Modifiers cannot overload, so a child's own same-name modifier overrides the
  // parent's (most-derived wins) rather than colliding.
  mergeNamedList(child, parent, 'modifierDefinitions', 'Modifier', true);

  // 11. Merge type definitions
  mergeNamedList(child, parent, 'typeDefinitions', 'Type');

  // NOTE: `using L for T` directives are deliberately NOT merged. Solidity does not inherit them into a derived
  // contract's own code (syntaxTests/scoping/library_inherited.sol is a solc TypeError). A parent FUNCTION that
  // uses one keeps its declaration context, but that needs per-function lexical scoping, not a contract-wide
  // merge (which would over-accept the derived contract's new code) - left as a known limit.
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
// Overload key: functions are distinguished by name AND parameter-type signature, so overloaded functions
// (same name, different parameters) are merged independently. Only same-signature functions collide - which is
// exactly what override / diamond resolution needs.
function functionSignature(f: FunctionDefinitionNode): string {
  return `${f.name}(${f.parameters.map((p) => String(p.type)).join(',')})`;
}

function mergeFunctions(
  child: ContractNode,
  parent: ContractNode,
  subs?: Map<string, ExpressionNode>,
  isAncestor?: (ancestor: string, descendant: string) => boolean,
): void {
  const childFuncMap = new Map(child.functions.map((f) => [functionSignature(f), f]));

  for (const parentFunc of parent.functions) {
    const existingFunc = childFuncMap.get(functionSignature(parentFunc));

    if (existingFunc) {
      // Diamond detection: both inherited from the same original ancestor -> skip duplicate
      const parentOrigin = parentFunc.inheritedFrom ?? parent.name;
      const childOrigin = existingFunc.inheritedFrom;

      if (childOrigin && childOrigin === parentOrigin) {
        // Same origin ancestor - diamond duplicate, skip silently
        continue;
      }

      // Related origins: the version from the more-derived contract already overrides the other -
      // it dominates without an explicit child override (solc semantics).
      if (childOrigin && isAncestor) {
        if (isAncestor(parentOrigin, childOrigin)) continue; // existing version dominates
        if (isAncestor(childOrigin, parentOrigin)) {
          const cloned = cloneNode(parentFunc);
          if (!cloned.inheritedFrom) cloned.inheritedFrom = parent.name;
          if (subs) substituteInFunction(cloned, subs);
          child.functions[child.functions.indexOf(existingFunc)] = cloned;
          childFuncMap.set(functionSignature(cloned), cloned);
          continue;
        }
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
      childFuncMap.set(functionSignature(cloned), cloned);
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

  // Validate explicit `override(A, B)` base lists: each named base must be a base of this contract. The base's
  // declaration may be abstract (no super impl to resolve), so only ancestry is checked; an INTERFACE base
  // (still in `implements` after expansion) is accepted the same way.
  for (const fn of contract.functions) {
    for (const base of fn.overrideBases) {
      if (contract.implements.includes(base)) continue; // interface base: declares the function, no super impl
      if (!ancestors.has(base)) {
        throw new OverrideBaseListError(fn, fn.name, base);
      }
    }
  }

  // Rewrite `super.f` / `Base.f` in a body against `definingContract`'s position in the linearization, recording
  // the preserved (`__base_`) impls it calls into `used`.
  const makeResolve = (definingContract: string, used: Set<string>) => (callName: string): string | undefined => {
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

  for (const fn of contract.functions) {
    const definingContract = fn.definingContract ?? fn.inheritedFrom ?? contract.name;
    const used = new Set<string>();
    new SuperCallRewriter(makeResolve(definingContract, used)).visit(fn.body);
    references.set(fn.name, used);
  }

  // The constructor / fallback / receive can also contain super/Base calls (`constructor() { .. super.f() .. }`);
  // they are entry points defined by the current contract, so rewrite them and treat the preserved impls they call
  // as reachability roots.
  const entryRoots = new Set<string>();
  for (const special of [contract.constructorDef, contract.fallbackDef, contract.receiveDef]) {
    if (!special?.body) continue;
    new SuperCallRewriter(makeResolve(contract.name, entryRoots)).visit(special.body);
  }

  // Keep only preserved functions reachable from the non-preserved (real) functions + the entry-point members.
  const reachable = new Set<string>(entryRoots);
  const queue = [
    ...contract.functions.filter((f) => !f.name.startsWith('__base_')).map((f) => f.name),
    ...entryRoots,
  ];
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
  overridable = false,
  overloadable = false,
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

      // Overridable members (modifiers) cannot overload: a child's OWN same-name definition overrides the
      // parent's (most-derived wins), so the parent's is dropped and references resolve to the child's override.
      if (overridable && !childOrigin) {
        continue;
      }

      // Overloadable members (events, errors) coexist when their parameter signatures differ. Keep the parent's
      // declaration alongside the same-name child/sibling one; skip only an exact-signature duplicate.
      if (overloadable) {
        const sigOf = (it: { name: string; parameters?: { type: unknown }[] }): string =>
          (it.parameters ?? []).map((p) => String(p.type)).join(',');
        const parentSig = sigOf(parentItem as { name: string; parameters?: { type: unknown }[] });
        const present = [...childList, ...toInsert as unknown as typeof childList].some(
          (it) => it.name === parentItem.name
            && sigOf(it as { name: string; parameters?: { type: unknown }[] }) === parentSig,
        );
        if (present) continue;
      } else {
        throw new InheritanceNameCollisionError(child, kind, parentItem.name, parent.name);
      }
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
function substituteInExpression(
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
