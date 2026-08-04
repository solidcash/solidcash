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
  AssertNode,
  TimeOpNode,
  StateAssignNode,
  MappingAssignNode,
  MappingFieldAssignNode,
  MappingDeleteNode,
  MappingAccessNode,
  StateAccessNode,
  IntLiteralNode,
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
  CollectionNode,
  StateVariableVisibility,
  ExpressionStatementNode,
  PlaceholderStatementNode,
  AssignmentExpressionNode,
  ParentInvocation,
} from '../ast/AST.js';
import { ArrayType, IntType, MappingType, StructType, Type } from '@solidcash/utils';
import {
  CircularContractInheritanceError,
  C3LinearizationError,
  NonVirtualOverrideError,
  OverrideMutabilityError,
  AbstractOverrideOfImplementedError,
  OverrideBaseListError,
  DuplicateOverrideBaseError,
  OverrideNothingError,
  GetterOverrideMismatchError,
  MissingOverrideBasesError,
  InvalidModifierOverrideError,
  DiamondInheritanceError,
  InheritanceNameCollisionError,
  MissingOverrideError,
  ModifierStyleBaseConstructorError,
  ParentInvocationArgCountError,
  UndefinedParentInvocationError,
  DuplicateParentInvocationError,
  InvalidDataLocationError,
  IntLiteralOutOfRangeError,
  InvalidBaseConstructorArgumentError,
  InvalidBaseFunctionCallError,
} from '../Errors.js';
import AstTraversal from '../ast/AstTraversal.js';
import { Modifier } from '../ast/Globals.js';
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
  const byName = new Map<string, ContractNode[]>(); // state-var name -> hierarchy members declaring it
  for (const c of ancestors) {
    for (const sv of c.stateVariables as StateVariableNode[]) {
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
      // Only the private declaration is scope-inaccessible and safe to mangle. A collision between two
      // non-private declarations remains a genuine inheritance error.
      if (sv.visibility !== StateVariableVisibility.PRIVATE) continue;
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

export default function expandInheritance(ast: SourceFileNode, solidityImportCompat = false): SourceFileNode {
  // Build a map of available contracts from importedContracts
  const contractMap = new Map<string, ContractNode>();
  for (const c of ast.importedContracts) {
    contractMap.set(c.name, c);
  }
  // The primary contract itself must be resolvable as a parent: when compileFileMulti compiles a BASE contract
  // (e.g. OZ ERC20) as the primary, a DERIVED sibling (SushiToken `is ERC20(..)`) rides in importedContracts and is
  // flattened below (line ~187); its parent invocation of the primary would otherwise be unresolvable. A contract
  // is never its own ancestor, so this cannot introduce a self-merge (guarded by the `expanding` set regardless).
  if (!contractMap.has(ast.contract.name)) contractMap.set(ast.contract.name, ast.contract);

  // Expansion clears each contract's `implements`; snapshot the original hierarchy so linearizations
  // computed after a sibling expansion (memoized) still see the full parent lists.
  const originalImplements = new Map<string, string[]>();
  originalImplements.set(ast.contract.name, [...ast.contract.implements]);
  for (const c of ast.importedContracts) {
    if (!originalImplements.has(c.name)) originalImplements.set(c.name, [...c.implements]);
  }

  const expanded = new Set<string>();
  const interfaceMap = new Map(ast.interfaceDefinitions.map((iface) => [iface.name, iface]));
  if (solidityImportCompat) {
    // Public-getter override validation below normally runs while concrete parents are flattened. A contract
    // whose bases are all interfaces takes the no-parent fast path, however, so an incomplete
    // `override(IA)` could previously omit a parallel `IB` provider. Resolve the effective interface providers
    // directly from the original source hierarchy before any contract's `implements` list is mutated.
    const interfaceAncestors = (contract: ContractNode): Set<string> => {
      const result = new Set<string>();
      const pending = [...contract.implements];
      const seenContracts = new Set<string>();
      while (pending.length > 0) {
        const name = pending.pop()!;
        const parentContract = contractMap.get(name);
        if (parentContract) {
          if (seenContracts.has(name)) continue;
          seenContracts.add(name);
          pending.push(...(originalImplements.get(name) ?? parentContract.implements));
          continue;
        }
        const iface = interfaceMap.get(name);
        if (!iface || result.has(name)) continue;
        result.add(name);
        pending.push(...iface.parents);
      }
      return result;
    };
    const isInterfaceAncestor = (ancestor: string, descendant: string): boolean => {
      const pending = [...(interfaceMap.get(descendant)?.parents ?? [])];
      const seen = new Set<string>();
      while (pending.length > 0) {
        const name = pending.pop()!;
        if (name === ancestor) return true;
        if (seen.has(name)) continue;
        seen.add(name);
        pending.push(...(interfaceMap.get(name)?.parents ?? []));
      }
      return false;
    };

    for (const contract of [ast.contract, ...ast.importedContracts]) {
      const ancestors = interfaceAncestors(contract);
      for (const declaration of [...contract.stateVariables, ...contract.collections].filter(
        (candidate) => candidate.inheritedFrom === undefined && candidate.isOverride,
      )) {
        const shape = publicGetterShape(declaration);
        if (!shape) continue;
        const providers = [...ancestors].filter((name) =>
          interfaceMap.get(name)?.functions.some((fn) =>
            fn.name === declaration.name
            && fn.parameters.map((parameter) => parameter.type.toString()).join(',') === shape.parameters.join(',')
            && fn.returnTypes.length === 1
            && fn.returnTypes[0].toString() === shape.returnType))
          .filter((provider, _index, all) => !all.some((other) =>
            other !== provider && isInterfaceAncestor(provider, other)));
        if (providers.length > 1
          && providers.some((provider) => !declaration.overrideBases.includes(provider))) {
          throw new MissingOverrideBasesError(declaration, declaration.name, providers);
        }
      }
    }
  }
  if (solidityImportCompat) {
    const fileErrorNames = new Set(ast.errorDefinitions.map((definition) => definition.name));
    const fileEventNames = new Set(ast.eventDefinitions.map((definition) => definition.name));
    const declarationReference = (argument: ExpressionNode, contract: ContractNode): string | undefined => {
      if (argument instanceof IdentifierNode) {
        const name = argument.name;
        if (fileErrorNames.has(name) || fileEventNames.has(name)
          || contract.errorDefinitions.some((definition) => definition.name === name)
          || contract.eventDefinitions.some((definition) => definition.name === name)) {
          return name;
        }
      }
      if (argument instanceof FieldAccessNode && argument.expression instanceof IdentifierNode) {
        const holder = contractMap.get(argument.expression.name) ?? interfaceMap.get(argument.expression.name);
        if (holder?.errorDefinitions.some((definition) => definition.name === argument.name)
          || holder?.eventDefinitions.some((definition) => definition.name === argument.name)) {
          return `${argument.expression.name}.${argument.name}`;
        }
      }
      return undefined;
    };
    for (const contract of [ast.contract, ...ast.importedContracts]) {
      const invalid = contract.parentInvocations.find((invocation) =>
        interfaceMap.has(invocation.parentName) && invocation.args.length > 0);
      if (invalid) {
        throw new ParentInvocationArgCountError(contract, invalid.parentName, 0, invalid.args.length);
      }
      for (const invocation of contract.parentInvocations) {
        const parent = contractMap.get(invocation.parentName);
        if (!parent) continue;
        const parameters = effectiveConstructorParams(parent);
        for (let index = 0; index < Math.min(parameters.length, invocation.args.length); index++) {
          const argument = invocation.args[index];
          const parameterType = parameters[index].type;
          const reference = declarationReference(argument, contract);
          if (reference) throw new InvalidBaseConstructorArgumentError(argument, reference);
          if (argument instanceof IntLiteralNode && parameterType instanceof IntType
            && (argument.value < parameterType.minValue || argument.value > parameterType.maxValue)) {
            throw new IntLiteralOutOfRangeError(
              argument,
              argument.value,
              parameterType.toString(),
              parameterType.minValue,
              parameterType.maxValue,
            );
          }
        }
      }
    }
  }
  const interfaceBases = (direct: string[]): Set<string> => {
    const result = new Set<string>();
    const pending = [...direct];
    while (pending.length > 0) {
      const name = pending.pop()!;
      if (result.has(name)) continue;
      result.add(name);
      pending.push(...(interfaceMap.get(name)?.parents ?? []));
    }
    return result;
  };

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
      expandContract(imported, contractMap, expanded, new Set(), originalImplements, solidityImportCompat);
      resolveSuperAndBaseCalls(imported, importedLinearization, interfaceBases(imported.implements));
    }
  }

  // A root contract still needs override validation. A bare `override` cannot override anything, while an
  // explicit list (notably `override(LibraryName)`) is handled by the normal base-list resolver below.
  if (ast.contract.implements.length === 0) {
    if (solidityImportCompat && ast.contract.parentInvocations.length > 0) {
      const modifierNames = new Set(ast.contract.modifierDefinitions.map((modifier) => modifier.name));
      for (const invocation of ast.contract.parentInvocations) {
        if (!modifierNames.has(invocation.parentName)) {
          throw new UndefinedParentInvocationError(ast.contract, invocation.parentName);
        }
        if (ast.contract.constructorDef) {
          ast.contract.constructorDef.customModifiers.push({
            name: invocation.parentName,
            args: invocation.args,
            location: invocation.location,
          });
        }
      }
      ast.contract.parentInvocations = [];
    }
    const bareOverrides: Array<{ node: Node; name: string }> = [
      ...ast.contract.functions
        .filter((fn) => fn.modifiers.includes(FunctionModifier.OVERRIDE) && fn.overrideBases.length === 0)
        .map((fn) => ({ node: fn as Node, name: fn.name })),
      ...[...ast.contract.stateVariables, ...ast.contract.collections]
        .filter((declaration) => declaration.isOverride && declaration.overrideBases.length === 0)
        .map((declaration) => ({ node: declaration as Node, name: declaration.name })),
      ...ast.contract.modifierDefinitions
        .filter((modifier) => modifier.isOverride && modifier.overrideBases.length === 0)
        .map((modifier) => ({ node: modifier as Node, name: modifier.name })),
      ...[ast.contract.fallbackDef, ast.contract.receiveDef]
        .filter((fn): fn is FunctionDefinitionNode =>
          fn !== undefined && fn.modifiers.includes(FunctionModifier.OVERRIDE) && fn.overrideBases.length === 0)
        .map((fn) => ({ node: fn as Node, name: fn.isFallback ? 'fallback' : 'receive' })),
    ];
    if (bareOverrides.length > 0) {
      throw new OverrideNothingError(bareOverrides[0].node, bareOverrides[0].name);
    }
    resolveSuperAndBaseCalls(ast.contract, [], new Set());
    return ast;
  }

  // Origin-mangle any private state var declared in >1 ancestor before flattening (Solidity allows same-name
  // private vars across ancestors; the flatten would otherwise collide). See mangleCollidingPrivateVars.
  mangleCollidingPrivateVars(primaryLinearization, contractMap, ast.contract);

  expandContract(ast.contract, contractMap, expanded, new Set(), originalImplements, solidityImportCompat);

  resolveSuperAndBaseCalls(ast.contract, primaryLinearization, interfaceBases(ast.contract.implements));

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

// Validate calls while original base declarations still retain their visibility and abstractness. Flattening
// preserves implemented overrides as internal helpers, which must not make an external or abstract function
// callable through `super` / `Base`.
function validateBaseFunctionCalls(
  contract: ContractNode,
  linearization: string[],
  contractMap: Map<string, ContractNode>,
): void {
  const indexOf = new Map(linearization.map((name, index) => [name, index]));
  const ownFunctions = (name: string): FunctionDefinitionNode[] => {
    const owner = name === contract.name ? contract : contractMap.get(name);
    if (!owner) return [];
    return owner.functions.filter((fn) =>
      (fn.definingContract ?? fn.inheritedFrom ?? owner.name) === owner.name);
  };
  const resolve = (
    definingContract: string,
    qualifiedName: string,
    arity: number,
  ): FunctionDefinitionNode | undefined => {
    const dot = qualifiedName.indexOf('.');
    if (dot < 0) return undefined;
    const namespace = qualifiedName.slice(0, dot);
    const target = qualifiedName.slice(dot + 1);
    if (namespace === 'super') {
      const start = indexOf.get(definingContract);
      if (start === undefined) return undefined;
      let abstractFallback: FunctionDefinitionNode | undefined;
      for (let index = start + 1; index < linearization.length; index += 1) {
        const declaration = ownFunctions(linearization[index])
          .find((fn) => fn.name === target && fn.parameters.length === arity);
        if (!declaration) continue;
        // Solidity's super dispatch follows the next implemented function in the C3 order; an abstract
        // declaration in an intermediate base does not block a concrete implementation behind it.
        if (!declaration.isAbstract) return declaration;
        abstractFallback ??= declaration;
      }
      return abstractFallback;
    }
    if (!indexOf.has(namespace)) return undefined;
    return ownFunctions(namespace).find((fn) => fn.name === target && fn.parameters.length === arity);
  };

  const visitBody = (body: BlockNode | undefined): void => {
    if (body) new BaseFunctionCallValidator(contract.name, resolve).visit(body);
  };
  for (const fn of contract.functions.filter((candidate) => !candidate.inheritedFrom)) visitBody(fn.body);
  for (const special of [contract.constructorDef, contract.fallbackDef, contract.receiveDef]) {
    visitBody(special?.body);
  }
  for (const modifier of contract.modifierDefinitions.filter((candidate) => !candidate.inheritedFrom)) {
    const body = new BlockNode(modifier.statements);
    body.location = modifier.location;
    visitBody(body);
  }
}

class BaseFunctionCallValidator extends AstTraversal {
  constructor(
    private readonly definingContract: string,
    private readonly resolve: (
      definingContract: string, qualifiedName: string, arity: number,
    ) => FunctionDefinitionNode | undefined,
  ) {
    super();
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    const declaration = this.resolve(this.definingContract, node.identifier.name, node.parameters.length);
    if (declaration?.visibility === 'external') {
      throw new InvalidBaseFunctionCallError(node, 'external');
    }
    if (declaration?.isAbstract) {
      throw new InvalidBaseFunctionCallError(node, 'unimplemented');
    }
    return super.visitFunctionCall(node);
  }

  visitBlock(node: BlockNode): Node {
    node.statements = (node.statements ?? []).map((statement) =>
      statement instanceof PlaceholderStatementNode ? statement : this.visit(statement) as StatementNode);
    return node;
  }
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
  solidityImportCompat = false,
): void {
  if (expanding.has(contract.name)) {
    throw new CircularContractInheritanceError(contract);
  }

  // Solidity requires each contract in an explicit override list to occur exactly once. Validate source
  // declarations before inheritance merging: a repeated base must not disappear when declarations are cloned
  // or deduplicated during flattening.
  for (const declaration of [
    ...contract.functions,
    ...contract.stateVariables,
    ...contract.collections,
  ]) {
    const seen = new Set<string>();
    for (const base of declaration.overrideBases) {
      if (seen.has(base)) {
        throw new DuplicateOverrideBaseError(declaration, declaration.name, base);
      }
      seen.add(base);
    }
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

  const stampModifierQualifiers = (qualifiers: string[]): void => {
    const functions = [
      ...contract.functions,
      contract.constructorDef,
      contract.fallbackDef,
      contract.receiveDef,
    ].filter((f): f is FunctionDefinitionNode => f !== undefined);
    for (const fn of functions) {
      if (!fn.allowedModifierQualifiers) fn.allowedModifierQualifiers = qualifiers;
    }
  };

  if (parentNames.length === 0) {
    stampModifierQualifiers([contract.name]);
    return;
  }

  // `m(args)` and `Base(args)` are grammatically identical in the constructor list, so modifier
  // invocations parse into parentInvocations - reroute those to the constructor's custom modifiers.
  // Invocations naming INDIRECT ancestors (grandparent ctor args) are kept for constructor inlining.
  const linearization = computeLinearization(contract, contractMap, originalImplements);
  stampModifierQualifiers([...new Set([contract.name, ...linearization])]);
  validateBaseFunctionCalls(contract, linearization, contractMap);
  const ancestorSet = new Set(linearization);
  const bareBaseInvocation = contract.constructorDef?.customModifiers.find(
    (invocation) => ancestorSet.has(invocation.name),
  );
  if (solidityImportCompat && bareBaseInvocation) {
    throw new ModifierStyleBaseConstructorError(contract.constructorDef!, bareBaseInvocation.name);
  }

  // Modifiers do not overload in Solidity. Validate the derived source declarations against every original
  // ancestor before flattening silently replaces same-name definitions.
  for (const modifier of contract.modifierDefinitions.filter(
    (candidate) => candidate.inheritedFrom === undefined && !candidate.name.includes('.'),
  )) {
    const candidates = linearization.filter((ancestorName) => ancestorName !== contract.name).flatMap((ancestorName) => {
      const ancestor = contractMap.get(ancestorName);
      return (ancestor?.modifierDefinitions ?? [])
        .filter((candidate) => !candidate.name.includes('.') && candidate.name === modifier.name)
        .map((candidate) => ({ candidate, origin: candidate.inheritedFrom ?? ancestorName }));
    }).filter(({ origin }, index, all) =>
      all.findIndex((item) => item.origin === origin) === index);

    if (candidates.length === 0) {
      if (modifier.isOverride) {
        throw new InvalidModifierOverrideError(modifier, modifier.name, 'override specified but no base declares it');
      }
      continue;
    }
    if (!modifier.isOverride) {
      throw new InvalidModifierOverrideError(modifier, modifier.name, "missing 'override' specifier");
    }

    const childSignature = modifier.parameters.map((parameter) => parameter.type.toString()).join(',');
    for (const { candidate, origin } of candidates) {
      const parentSignature = candidate.parameters.map((parameter) => parameter.type.toString()).join(',');
      if (childSignature !== parentSignature) {
        throw new InvalidModifierOverrideError(modifier, modifier.name, `signature differs from '${origin}'`);
      }
      if (!candidate.isVirtual) {
        throw new NonVirtualOverrideError(modifier, modifier.name, origin);
      }
    }
    for (const base of modifier.overrideBases) {
      if (!candidates.some(({ origin }) => origin === base)) {
        throw new OverrideBaseListError(modifier, modifier.name, base);
      }
    }
  }

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

  // A base constructor may receive arguments at most once across the whole
  // inheritance graph. The linearization deduplicates shared ancestors, so
  // count the source declarations from each distinct contract: this catches
  // both `D is Base, Mid` plus `Mid is Base(args)`, and sibling bases which
  // independently invoke the same ancestor constructor.
  const constructorArgumentProviders = new Map<string, string>();
  for (const providerName of [contract.name, ...linearization]) {
    const provider = providerName === contract.name ? contract : contractMap.get(providerName);
    if (!provider) continue;
    for (const invocation of provider.parentInvocations) {
      if (!ancestorSet.has(invocation.parentName)) continue;
      const previous = constructorArgumentProviders.get(invocation.parentName);
      if (previous && previous !== providerName) {
        throw new DuplicateParentInvocationError(contract, invocation.parentName);
      }
      constructorArgumentProviders.set(invocation.parentName, providerName);
    }
  }

  // Solidity evaluates assignment expressions in base-constructor arguments before entering the base
  // constructor (`is Base(D.x = 3)`). Pull the write out as a constructor prelude and substitute a read of the
  // assigned slot as the argument value. This also prevents the general expression type checker from treating
  // the state assignment like a local-stack AssignmentExpressionNode.
  for (const pi of contract.parentInvocations) {
    const prelude: StatementNode[] = [];
    pi.args = pi.args.map((arg) => {
      if (!(arg instanceof AssignmentExpressionNode)) return arg;
      prelude.push(arg.assign);
      const value = new IdentifierNode(arg.assign.identifier.name);
      value.location = arg.location;
      return value;
    });
    if (prelude.length > 0) pi.argumentPrelude = prelude;
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

  // Validate source public-getter overrides against the original concrete hierarchy before flattening. A public
  // declaration overrides only the function with its generated getter ABI shape; unrelated overloads remain
  // independent. Interface-only matches are validated later by the interface traversal, so absence is conclusive
  // here only when the concrete hierarchy has no interface bases.
  const hierarchyHasInterfaces = linearization.some((ancestorName) =>
    (originalImplements?.get(ancestorName) ?? contractMap.get(ancestorName)?.implements ?? [])
      .some((baseName) => !contractMap.has(baseName)));
  for (const declaration of [...contract.stateVariables, ...contract.collections].filter(
    (candidate) => candidate.inheritedFrom === undefined
      && (candidate.visibility === StateVariableVisibility.PUBLIC
        || candidate.visibility === StateVariableVisibility.EXTERNAL),
  )) {
    const shape = publicGetterShape(declaration);
    if (!shape) continue;
    const candidates = linearization
      .filter((ancestorName) => ancestorName !== contract.name)
      .flatMap((ancestorName) => (contractMap.get(ancestorName)?.functions ?? [])
        .filter((fn) => fn.inheritedFrom === undefined && fn.name === declaration.name)
        .map((fn) => ({ fn, origin: ancestorName })));
    const parameterMatches = candidates.filter(({ fn }) =>
      fn.parameters.map((parameter) => parameter.type.toString()).join(',')
        === shape.parameters.join(','));
    const matches = parameterMatches.filter(({ fn }) =>
      fn.returnTypes.length === 1 && fn.returnTypes[0].toString() === shape.returnType);

    if (!declaration.isOverride) {
      if (matches.length > 0) {
        throw new MissingOverrideError(contract, declaration.name, matches[0].origin);
      }
      continue;
    }
    if (matches.length === 0 && candidates.length > 0 && !hierarchyHasInterfaces) {
      if (parameterMatches.length > 0) {
        throw new GetterOverrideMismatchError(declaration, declaration.name);
      }
      throw new OverrideNothingError(declaration, declaration.name);
    }

    const providers = [...new Set(matches.map(({ origin }) => origin))]
      .filter((origin, _index, all) => !all.some((other) =>
        other !== origin && isAncestor(origin, other)));
    if (providers.length > 1
      && providers.some((provider) => !declaration.overrideBases.includes(provider))) {
      throw new MissingOverrideBasesError(declaration, declaration.name, providers);
    }
  }

  // A function override list names providers of this exact overload, not merely arbitrary ancestors. When more
  // than one undominated concrete base provides the signature, every provider must be listed explicitly.
  for (const fn of contract.functions.filter((candidate) =>
    candidate.inheritedFrom === undefined && candidate.modifiers.includes(FunctionModifier.OVERRIDE))) {
    const signature = functionSignature(fn);
    const candidates = linearization
      .filter((ancestorName) => ancestorName !== contract.name)
      .flatMap((ancestorName) => (contractMap.get(ancestorName)?.functions ?? [])
        .filter((candidate) => candidate.inheritedFrom === undefined
          && functionSignature(candidate) === signature)
        .map(() => ancestorName));
    const providers = [...new Set(candidates)]
      .filter((origin, _index, all) => !all.some((other) =>
        other !== origin && isAncestor(origin, other)));

    for (const base of fn.overrideBases) {
      if (contractMap.has(base) && !candidates.includes(base)) {
        throw new OverrideBaseListError(fn, fn.name, base);
      }
    }
    if (providers.length > 1
      && providers.some((provider) => !fn.overrideBases.includes(provider))) {
      throw new MissingOverrideBasesError(fn, fn.name, providers);
    }
  }

  // fallback and receive occupy distinct override slots. Validate the source declaration against the original
  // ancestry before flattening: a receive declaration in a base must not make `fallback() override` appear
  // meaningful (and vice versa) merely because the contract has some inherited special function.
  for (const [special, key, label] of [
    [contract.fallbackDef, 'fallbackDef', 'fallback'],
    [contract.receiveDef, 'receiveDef', 'receive'],
  ] as const) {
    if (!special?.modifiers.includes(FunctionModifier.OVERRIDE)) continue;
    const hasMatchingBase = linearization.some((ancestorName) =>
      ancestorName !== contract.name && !!contractMap.get(ancestorName)?.[key]);
    if (!hasMatchingBase) throw new OverrideNothingError(special, label);
  }

  // Resolve the effective concrete origin of each signature as seen through every DIRECT base. Two direct bases
  // exposing distinct origins are ambiguous even when one direct base descends from the other (`C is A, B` with
  // `B` overriding `A.f`). A true diamond which merely carries the same unchanged origin through both branches
  // remains unambiguous.
  const effectiveOrigins = (
    baseName: string,
    signature: string,
    seen: Set<string> = new Set(),
  ): string[] => {
    if (seen.has(baseName)) return [];
    seen.add(baseName);
    const base = contractMap.get(baseName);
    if (!base) return [];
    const own = base.functions.filter((fn) =>
      fn.inheritedFrom === undefined && fn.visibility !== 'private' && functionSignature(fn) === signature);
    if (own.length > 0) return [baseName];
    return [...new Set(
      (originalImplements?.get(baseName) ?? base.implements)
        .filter((parentName) => contractMap.has(parentName))
        .flatMap((parentName) => effectiveOrigins(parentName, signature, new Set(seen))),
    )];
  };
  const inheritedSignatures = new Set(
    linearization.filter((name) => name !== contract.name)
      .flatMap((name) => (contractMap.get(name)?.functions ?? [])
        .filter((fn) => fn.inheritedFrom === undefined && fn.visibility !== 'private')
        .map(functionSignature)),
  );
  for (const signature of inheritedSignatures) {
    const rawOrigins = [...new Set(parentNames.flatMap((parentName) =>
      effectiveOrigins(parentName, signature)))];
    const origins = rawOrigins.filter((origin) => {
      const declaration = contractMap.get(origin)?.functions.find((fn) =>
        fn.inheritedFrom === undefined && functionSignature(fn) === signature);
      return !declaration?.isAbstract || !rawOrigins.some((other) =>
        other !== origin && isAncestor(origin, other));
    });
    if (origins.length < 2) continue;
    const explicitFunction = contract.functions.some((fn) =>
      fn.inheritedFrom === undefined
      && fn.modifiers.includes(FunctionModifier.OVERRIDE)
      && functionSignature(fn) === signature);
    const explicitGetter = [...contract.stateVariables, ...contract.collections].some((declaration) => {
      if (declaration.inheritedFrom !== undefined || !declaration.isOverride) return false;
      const shape = publicGetterShape(declaration);
      return shape !== undefined
        && `${declaration.name}(${shape.parameters.join(',')})` === signature;
    });
    if (!explicitFunction && !explicitGetter) {
      const functionName = signature.slice(0, signature.indexOf('('));
      throw new DiamondInheritanceError(contract, 'Function', functionName, origins[0], origins[1]);
    }
  }

  // Merge parents left-to-right
  for (const parentName of parentNames) {
    const parent = contractMap.get(parentName)!;

    // Recursively expand parent first (if it has its own parents)
    if (!expanded.has(parentName) && parent.implements.length > 0) {
      expandContract(parent, contractMap, expanded, new Set(expanding), originalImplements, solidityImportCompat);
    }

    // Carry the parent's interface bases up: after expansion `parent.implements` holds only interfaces, and this
    // contract now transitively implements them too. A flattened `override(IInterface)` (OZ ERC20Permit.nonces
    // `override(IERC20Permit, Nonces)`) must still find the interface after the parent contract is merged away.
    for (const iface of parent.implements) {
      if (!remainingImplements.includes(iface)) remainingImplements.push(iface);
    }

    mergeParent(contract, parent, isAncestor, solidityImportCompat);
  }

  if (solidityImportCompat) validateEffectiveDeclarationNamespace(contract);

  inlineParentConstructors(contract, parentNames, contractMap, linearization);

  expanding.delete(contract.name);
  expanded.add(contract.name);

  // Remove parent contract names from implements (leaving only interface names)
  contract.implements = remainingImplements;
}

// After inheritance is flattened, Solidity's effective contract scope still has one declaration namespace across
// variables, functions, events, and modifiers. Same-kind overloads are handled by their individual merge logic;
// a name which survives in two DIFFERENT kinds is an illegal cross-kind inheritance collision. Private ancestor
// members are not visible in the derived scope and therefore do not participate.
function validateEffectiveDeclarationNamespace(contract: ContractNode): void {
  const declared = new Map<string, { kind: string; origin: string }>();
  // Public state declarations can explicitly implement an inherited virtual/abstract getter while other overloads
  // of that function name remain inherited. Mapping-to-struct getters need later tuple-shape synthesis before their
  // signature can be compared, so defer these pairs to the existing public-getter override validator.
  const deferredGetterOverrides = new Set(
    [...contract.stateVariables, ...contract.collections]
      .filter((variable) => variable.isOverride && variable.inheritedFrom === undefined
        && contract.functions.some((fn) => fn.name === variable.name && fn.inheritedFrom))
      .map((variable) => variable.name),
  );
  const ownVariableNames = new Set(
    [...contract.stateVariables, ...contract.collections]
      .filter((variable) => variable.inheritedFrom === undefined)
      .map((variable) => variable.name),
  );
  const register = (
    item: { name: string; inheritedFrom?: string },
    kind: string,
    inheritedPrivate = false,
  ): void => {
    if (item.name.includes('.') || item.name.startsWith('__base_') || inheritedPrivate) return;
    const origin = item.inheritedFrom ?? contract.name;
    const previous = declared.get(item.name);
    if (previous && previous.kind !== kind) {
      throw new InheritanceNameCollisionError(contract, 'Declaration', item.name, origin);
    }
    if (!previous) declared.set(item.name, { kind, origin });
  };

  for (const variable of [...contract.stateVariables, ...contract.transientStateVars]) {
    register(
      variable,
      'variable',
      variable.inheritedFrom !== undefined && variable.visibility === StateVariableVisibility.PRIVATE,
    );
  }
  for (const collection of contract.collections) {
    register(
      collection,
      'variable',
      collection.inheritedFrom !== undefined && collection.visibility === StateVariableVisibility.PRIVATE,
    );
  }
  for (const fn of contract.functions) {
    if (fn.inheritedFrom && (deferredGetterOverrides.has(fn.name)
      || (ownVariableNames.has(fn.name) && fn.visibility === 'internal'))) continue;
    register(
      fn,
      'function',
      fn.inheritedFrom !== undefined && fn.visibility === 'private',
    );
  }
  for (const event of contract.eventDefinitions) register(event, 'event');
  for (const modifier of contract.modifierDefinitions) register(modifier, 'modifier');
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
  let baseArgumentBindingIndex = 0;
  const hasArgumentSideEffects = (expression: ExpressionNode): boolean => {
    let found = false;
    const walk = (node: Node): void => {
      if (node instanceof FunctionCallNode || node instanceof LowLevelCallNode
        || node instanceof InstantiationNode || node instanceof AssignmentExpressionNode) {
        found = true;
        return;
      }
      for (const value of Object.values(node)) {
        if (value instanceof Node) walk(value);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
      }
    };
    walk(expression);
    return found;
  };

  const bindInvocationArgs = (
    invocation: ParentInvocation,
    parameters: ParameterNode[],
    ownerName: string,
  ): ExpressionNode[] => {
    parentStmts.push(...(invocation.argumentPrelude ?? []));
    return invocation.args.map((argument, index) => {
      // A storage parameter aliases the original lvalue; materializing it as a value local would lose its mapping
      // entry path (and storage argument evaluation itself has no runtime side effect).
      if (parameters[index].modifier.includes('storage')) return cloneNode(argument);
      if (!hasArgumentSideEffects(argument)) return cloneNode(argument);
      const name = `__basearg_${ownerName}_${index}_${baseArgumentBindingIndex++}`;
      const binding = new VariableDefinitionNode(parameters[index].type, [], name, cloneNode(argument));
      // Base arguments are evaluated even when the base constructor never reads its parameter.
      binding.allowUnused = true;
      binding.location = argument.location;
      parentStmts.push(binding);
      const reference = new IdentifierNode(name);
      reference.location = argument.location;
      return reference;
    });
  };

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
    if (!ancestor) continue;
    if (!ancestor.constructorDef && invocation.args.length === 0 && !invocation.argumentPrelude?.length) continue;
    const ctorParams = effectiveConstructorParams(ancestor);
    if (ctorParams.length === 0) continue; // parameterless: chain-inlined already
    const chainInvoked = linearization.some((name) => name !== contract.name
      && (contractMap.get(name)?.parentInvocations ?? []).some((pi) => pi.parentName === ancestorName));
    if (chainInvoked) continue;
    if (invocation.args.length !== ctorParams.length) {
      throw new ParentInvocationArgCountError(contract, ancestorName, ctorParams.length, invocation.args.length);
    }
    const evaluatedArgs = bindInvocationArgs(invocation, ctorParams, ancestorName);
    const clonedCtor = ancestor.constructorDef ? cloneNode(ancestor.constructorDef) : undefined;
    if (clonedCtor) {
      substituteInFunction(clonedCtor, new Map(ctorParams.map((p, i) => [p.name, evaluatedArgs[i]])));
    }
    // The ancestor constructor (incl. inlined state-var initializers) legitimately touches the ancestor's OWN
    // private state; tag its accesses so the flattened child does not trip the private-access check.
    if (clonedCtor) tagModifierStateAccess(clonedCtor.body.statements ?? [], ancestorName);
    parentStmts.push(...(clonedCtor?.body.statements ?? []));
  }

  // Solidity evaluates/runs sibling base constructors from right to left (`is A, B, C` -> C, B, A).
  for (const parentName of [...parentNames].reverse()) {
    const invocation = contract.parentInvocations.find((pi) => pi.parentName === parentName);
    const parent = contractMap.get(parentName)!;
    if (!parent.constructorDef && !invocation?.args.length && !invocation?.argumentPrelude?.length) continue;
    const ctorParams = effectiveConstructorParams(parent);
    // MD4: a parent constructor runs even without an explicit `is Parent(args)` invocation - Solidity's implicit
    // base-constructor call - otherwise guard-relevant init (e.g. owner = ...) silently stays at the zero default.
    // Without an invocation we can only run a PARAMETERLESS parent ctor (a parameterized one needs explicit args,
    // which Solidity requires); skip a parameterized, un-invoked parent as before.
    if (!invocation && ctorParams.length > 0) continue;
    const clonedCtor = parent.constructorDef ? cloneNode(parent.constructorDef) : undefined;
    const evaluatedArgs = invocation ? bindInvocationArgs(invocation, ctorParams, parentName) : [];
    if (invocation && clonedCtor) {
      substituteInFunction(clonedCtor, new Map(ctorParams.map((p, i) => [p.name, evaluatedArgs[i]])));
    }
    if (clonedCtor) tagModifierStateAccess(clonedCtor.body.statements ?? [], parentName);
    parentStmts.push(...(clonedCtor?.body.statements ?? []));
  }
  if (parentStmts.length === 0) return;

  if (!contract.constructorDef) {
    const body = new BlockNode([]);
    body.location = contract.location;
    contract.constructorDef = new FunctionDefinitionNode('__construct', [], body);
    contract.constructorDef.location = contract.location;
  }
  contract.constructorDef.body.statements = [...parentStmts, ...(contract.constructorDef.body.statements ?? [])];
  contract.constructorDef.constructorPreludeLength += parentStmts.length;
}

/**
 * Merge a parent contract's definitions into a child contract.
 */
function mergeParent(
  child: ContractNode,
  parent: ContractNode,
  isAncestor?: (ancestor: string, descendant: string) => boolean,
  solidityImportCompat = false,
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
  } else if (solidityImportCompat && !child.isAbstract
    && parent.parameters.length === 0 && ctorParams.length > 0
    && !child.implements.some((other) =>
      other !== parent.name && isAncestor?.(parent.name, other))) {
    // Native SolidCash contracts inherit contract-level constructor parameters. Solidity-style constructor
    // parameters must be supplied explicitly unless the derived contract remains abstract or another direct
    // base descends from (and therefore constructs) this base.
    throw new ParentInvocationArgCountError(child, parent.name, ctorParams.length, 0);
  }

  // 1. Merge functions (with optional substitution)
  mergeFunctions(child, parent, subs, isAncestor);
  mergeSpecialFunction(child, parent, 'fallbackDef', 'fallback');
  mergeSpecialFunction(child, parent, 'receiveDef', 'receive');

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

  // 12. Merge `using L for T` directives. A parent FUNCTION inherited into the child (OZ ERC20 `_mint` with
  // `_totalSupply.add(..)` under `using SafeMath for uint256`) needs its library binding to resolve once its body
  // is merged/inlined into the child. Strict Solidity scopes the directive to the declaring contract only (a
  // derived contract's OWN new code cannot use it - library_inherited.sol is a solc TypeError), so a contract-wide
  // merge is PERMISSIVE: it never rejects valid Solidity and never miscompiles (`x.method()` -> `L.method(x)` is the
  // same sugar the parent would apply), it only additionally accepts child code solc would reject - the right
  // trade-off for a porting compiler. Dedup by (library, target, wildcard) so a re-declared binding is not doubled.
  const seenUsingFor = new Set(
    (child.usingForDirectives ?? []).map((d) => `${d.libraryName}|${d.targetTypeName}|${d.isWildcard}`),
  );
  for (const d of parent.usingForDirectives ?? []) {
    const key = `${d.libraryName}|${d.targetTypeName}|${d.isWildcard}`;
    if (seenUsingFor.has(key)) continue;
    seenUsingFor.add(key);
    (child.usingForDirectives ??= []).push(d);
  }
}

function mergeSpecialFunction(
  child: ContractNode,
  parent: ContractNode,
  key: 'fallbackDef' | 'receiveDef',
  label: string,
): void {
  const parentFunction = parent[key];
  const inherited = parent.inheritedSpecialFunctions[label as 'fallback' | 'receive'];
  if (!parentFunction && !inherited) return;
  const origin = parentFunction?.inheritedFrom ?? inherited?.origin ?? parent.name;
  const isVirtual = parentFunction
    ? parentFunction.modifiers.includes(FunctionModifier.VIRTUAL)
    : inherited!.isVirtual;
  const childFunction = child[key];
  if (!childFunction) {
    child.inheritedSpecialFunctions[label as 'fallback' | 'receive'] = { origin, isVirtual };
    return;
  }
  if (!childFunction.modifiers.includes(FunctionModifier.OVERRIDE)) {
    throw new MissingOverrideError(child, label, parent.name);
  }
  if (!isVirtual) {
    throw new NonVirtualOverrideError(childFunction, label, origin);
  }
  if (parentFunction) validateOverrideMutability(childFunction, parentFunction);
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

function publicGetterShape(
  declaration: StateVariableNode | CollectionNode,
): { parameters: string[]; returnType: string } | undefined {
  if (declaration instanceof StateVariableNode) {
    if (declaration.type instanceof StructType
      || declaration.type instanceof MappingType
      || declaration.type instanceof ArrayType) return undefined;
    return { parameters: [], returnType: declaration.type.toString() };
  }

  const parameters: string[] = [];
  let terminal: Type = declaration.type;
  while (terminal instanceof MappingType || terminal instanceof ArrayType) {
    if (terminal instanceof MappingType) {
      parameters.push(terminal.keyType.toString());
      terminal = terminal.valueType;
    } else {
      parameters.push(new IntType(false, 256).toString());
      terminal = terminal.elementType;
    }
  }
  // Solidity flattens public struct getter returns into a tuple. Leave those to the existing synthesized-getter
  // machinery rather than treating the inline struct type as its ABI return shape.
  if (terminal instanceof StructType) return undefined;
  return { parameters, returnType: terminal.toString() };
}

function declaredDataLocation(modifiers: string[]): string | undefined {
  return modifiers.find((modifier) =>
    modifier === Modifier.MEMORY || modifier === Modifier.CALLDATA || modifier === Modifier.STORAGE);
}

// Data location is not part of an external ABI signature, so an external declaration may be implemented by a
// public function using memory. For every non-external base function Solidity requires locations to remain
// identical across an override, even though SolidCash erases the locations after validating the declaration.
function validateOverrideDataLocations(child: FunctionDefinitionNode, parent: FunctionDefinitionNode): void {
  if (parent.visibility === 'external') return;
  const childLocations = [
    ...child.parameters.map((parameter) => declaredDataLocation(parameter.modifier)),
    ...child.returnTypes.map((_type, i) => declaredDataLocation(child.returnModifiers[i] ?? [])),
  ];
  const parentLocations = [
    ...parent.parameters.map((parameter) => declaredDataLocation(parameter.modifier)),
    ...parent.returnTypes.map((_type, i) => declaredDataLocation(parent.returnModifiers[i] ?? [])),
  ];
  if (childLocations.length === parentLocations.length
      && childLocations.some((location, i) => location !== parentLocations[i])) {
    throw new InvalidDataLocationError(
      child,
      `data locations must match overridden non-external function '${parent.name}'`,
    );
  }
}

function functionMutability(fn: FunctionDefinitionNode): 'payable' | 'nonpayable' | 'view' | 'pure' {
  if (fn.modifiers.includes(FunctionModifier.PAYABLE)) return 'payable';
  if (fn.modifiers.includes(FunctionModifier.PURE)) return 'pure';
  if (fn.modifiers.includes(FunctionModifier.VIEW)) return 'view';
  return 'nonpayable';
}

function validateOverrideMutability(child: FunctionDefinitionNode, parent: FunctionDefinitionNode): void {
  const parentMutability = functionMutability(parent);
  const childMutability = functionMutability(child);
  if (parentMutability === childMutability) return;
  const strictness = new Map<string, number>([
    ['nonpayable', 0],
    ['view', 1],
    ['pure', 2],
  ]);
  // Payable may only override payable. For every other base, Solidity permits an equal or more restrictive
  // override: nonpayable -> view -> pure.
  if (parentMutability !== 'payable' && childMutability !== 'payable'
    && strictness.get(childMutability)! >= strictness.get(parentMutability)!) return;
  throw new OverrideMutabilityError(child, parentMutability, childMutability);
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
    // A public state variable may explicitly override a zero-argument virtual function with its generated getter.
    // Getter synthesis runs after inheritance expansion, so recognize the source declaration here and suppress
    // the inherited bodies that its getter replaces.
    const variableOverride = [...child.stateVariables, ...child.collections]
      .find((declaration) => declaration.name === parentFunc.name && declaration.isOverride);
    if (!existingFunc && variableOverride) {
      const parentOrigin = parentFunc.inheritedFrom ?? parent.name;
      const getterType = variableOverride instanceof StateVariableNode
        ? variableOverride.type
        : variableOverride.type;
      const declaredParams = parentFunc.parameters.filter((p) => !p.name.startsWith('__internal__'));
      const matchesGetter = declaredParams.length === 0 && parentFunc.returnTypes.length === 1
        && parentFunc.returnTypes[0].toString() === getterType.toString();
      if (matchesGetter) {
        if (parentFunc.visibility !== 'external') {
          throw new Error(
            `Public state variable '${variableOverride.name}' can only override an external function`,
          );
        }
        if (parentFunc.modifiers.includes(FunctionModifier.PURE)) {
          throw new Error(
            `Public state getter '${variableOverride.name}' is view and cannot override pure function `
            + `'${parentOrigin}.${parentFunc.name}'`,
          );
        }
        if (!parentFunc.isAbstract && !parentFunc.modifiers.includes(FunctionModifier.VIRTUAL)) {
          throw new NonVirtualOverrideError(variableOverride, parentFunc.name, parentOrigin);
        }
        if (variableOverride.overrideBases.length > 0
          && !variableOverride.overrideBases.includes(parentOrigin)
          && !variableOverride.overrideBases.includes(parent.name)) {
          throw new OverrideBaseListError(variableOverride, variableOverride.name, parentOrigin);
        }
        continue;
      }
    }

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
        if (existingFunc.isAbstract && !parentFunc.isAbstract) {
          throw new AbstractOverrideOfImplementedError(
            existingFunc,
            parentFunc.name,
            parentFunc.inheritedFrom ?? parent.name,
          );
        }
        // Meaningful virtual: a parent function must be virtual (or abstract) to be overridable.
        if (!parentFunc.isAbstract && !parentFunc.modifiers.includes(FunctionModifier.VIRTUAL)) {
          throw new NonVirtualOverrideError(existingFunc, parentFunc.name, parentFunc.inheritedFrom ?? parent.name);
        }
        validateOverrideMutability(existingFunc, parentFunc);
        validateOverrideDataLocations(existingFunc, parentFunc);
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
  const parameterSignature = (f: FunctionDefinitionNode): string =>
    f.parameters.map((parameter) => String(parameter.type)).join(',');
  if (child.functions.some((f) =>
    f.name === mangled && parameterSignature(f) === parameterSignature(parentFunc))) return; // diamond duplicate

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
function resolveSuperAndBaseCalls(
  contract: ContractNode, linearization: string[], inheritedInterfaces: Set<string> = new Set(),
): void {
  const ancestors = new Set(linearization);
  const indexOf = new Map(linearization.map((name, i) => [name, i]));
  const references = new Map<string, Set<string>>(); // function name -> preserved impls it calls

  // Validate explicit `override(A, B)` base lists: each named base must be a base of this contract. The base's
  // declaration may be abstract (no super impl to resolve), so only ancestry is checked; an INTERFACE base
  // (still in `implements` after expansion) is accepted the same way.
  for (const fn of contract.functions) {
    for (const base of fn.overrideBases) {
      if (inheritedInterfaces.has(base)) continue; // direct or transitive interface: no super impl
      if (!ancestors.has(base)) {
        throw new OverrideBaseListError(fn, fn.name, base);
      }
    }
  }
  for (const declaration of [...contract.stateVariables, ...contract.collections]) {
    if (!declaration.isOverride) continue;
    for (const base of declaration.overrideBases) {
      if (inheritedInterfaces.has(base) || ancestors.has(base)) continue;
      throw new OverrideBaseListError(declaration, declaration.name, base);
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
  const isDiscardedBaseReference = (name: string): boolean => {
    const dot = name.indexOf('.');
    if (dot < 0) return false;
    const namespace = name.slice(0, dot);
    const target = name.slice(dot + 1);
    return namespace !== 'super' && ancestors.has(namespace)
      && superImplFor(contract, namespace, target) !== undefined;
  };

  for (const fn of contract.functions) {
    const definingContract = fn.definingContract ?? fn.inheritedFrom ?? contract.name;
    const used = new Set<string>();
    new SuperCallRewriter(makeResolve(definingContract, used), isDiscardedBaseReference).visit(fn.body);
    references.set(fn.name, used);
  }

  // The constructor / fallback / receive can also contain super/Base calls (`constructor() { .. super.f() .. }`);
  // they are entry points defined by the current contract, so rewrite them and treat the preserved impls they call
  // as reachability roots.
  const entryRoots = new Set<string>();
  for (const special of [contract.constructorDef, contract.fallbackDef, contract.receiveDef]) {
    if (!special?.body) continue;
    new SuperCallRewriter(makeResolve(contract.name, entryRoots), isDiscardedBaseReference).visit(special.body);
  }
  // Modifier bodies are expanded only after inheritance flattening. Resolve their super/Base calls now while
  // the linearization and preserved implementations are still available, and conservatively retain any base
  // body referenced by a modifier (an unused modifier is harmless dead code; a used one must remain callable).
  for (const modifier of contract.modifierDefinitions) {
    const body = new BlockNode(modifier.statements);
    body.location = modifier.location;
    const definingContract = modifier.inheritedFrom ?? contract.name;
    new SuperCallRewriter(makeResolve(definingContract, entryRoots), isDiscardedBaseReference).visit(body);
    modifier.statements = body.statements ?? [];
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
  constructor(
    private readonly resolve: (callName: string) => string | undefined,
    private readonly isDiscardedBaseReference: (name: string) => boolean,
  ) {
    super();
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    const target = this.resolve(node.identifier.name);
    if (target) node.identifier.name = target;
    return super.visitFunctionCall(node);
  }

  visitBlock(node: BlockNode): Node {
    node.statements = (node.statements ?? []).map((statement) =>
      statement instanceof PlaceholderStatementNode ? statement : this.visit(statement) as StatementNode);
    return node;
  }

  visitFieldAccess(node: FieldAccessNode): Node {
    if (node.expression instanceof IdentifierNode) {
      const target = this.resolve(`${node.expression.name}.${node.name}`);
      if (target) {
        const identifier = new IdentifierNode(target);
        identifier.location = node.location;
        return identifier;
      }
    }
    return super.visitFieldAccess(node);
  }

  visitExpressionStatement(node: ExpressionStatementNode): Node {
    if (node.expression instanceof FieldAccessNode && node.expression.expression instanceof IdentifierNode
      && this.isDiscardedBaseReference(`${node.expression.expression.name}.${node.expression.name}`)) {
      const empty = new BlockNode([]);
      empty.location = node.location;
      return empty;
    }
    return super.visitExpressionStatement(node);
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
      // parent's for unqualified lookup (most-derived wins). Preserve the parent under its qualified name so
      // an explicit `A.m` invocation can still select that exact base implementation.
      if (overridable && !childOrigin) {
        const origin = parentItem.inheritedFrom ?? parent.name;
        const qualified = cloneNode(parentItem as unknown as Node) as unknown as {
          name: string; inheritedFrom?: string;
        };
        qualified.name = `${origin}.${parentItem.name}`;
        qualified.inheritedFrom = origin;
        if (!childMap.has(qualified.name)) {
          toInsert.push(qualified as unknown as Node);
          childMap.set(qualified.name, qualified);
        }
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
        if (present) {
          if (key === 'eventDefinitions') child.hasDuplicateInheritedEventSignature = true;
          continue;
        }
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

    // Every inherited modifier is also addressable through the contract that originally declared it (`A.m`).
    // Carry the alias through further inheritance; diamond duplicates are removed by the normal origin check.
    if (key === 'modifierDefinitions' && !parentItem.name.includes('.')) {
      const origin = parentItem.inheritedFrom ?? parent.name;
      const qualified = cloneNode(cloned as unknown as Node) as unknown as {
        name: string; inheritedFrom?: string;
      };
      qualified.name = `${origin}.${parentItem.name}`;
      qualified.inheritedFrom = origin;
      if (!childMap.has(qualified.name)) {
        toInsert.push(qualified as unknown as Node);
        childMap.set(qualified.name, qualified);
      }
    }
  }

  // Prepend all parent items at once to preserve their original order
  if (toInsert.length > 0) {
    (child[key] as Node[]).unshift(...toInsert);
  }
}

// ---- Expression substitution ----

function flattenedIndexedSubstitution(
  name: string,
  subs: Map<string, ExpressionNode>,
): { name: string; keys: ExpressionNode[] } | undefined {
  const separator = name.indexOf('__');
  if (separator <= 0) return undefined;
  const replacement = subs.get(name.slice(0, separator));
  const suffix = name.slice(separator);
  if (replacement instanceof MappingAccessNode) {
    return {
      name: `${replacement.name}${suffix}`,
      keys: replacement.keys.map((key) => cloneNode(key)),
    };
  }
  if (replacement instanceof ArrayAccessNode && replacement.array instanceof IdentifierNode) {
    return {
      name: `${replacement.array.name}${suffix}`,
      keys: [cloneNode(replacement.index)],
    };
  }
  // Before semantic typing, `data[1]` in a parent-constructor invocation can be represented as tuple-index
  // syntax. A bare identifier receiver is still the indexed mapping/array storage path at this stage.
  if (replacement instanceof TupleIndexOpNode && replacement.tuple instanceof IdentifierNode) {
    const key = new IntLiteralNode(BigInt(replacement.index));
    key.location = replacement.location;
    return {
      name: `${replacement.tuple.name}${suffix}`,
      keys: [key],
    };
  }
  return undefined;
}

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
    const callee = subs.get(expr.identifier.name);
    if (callee instanceof IdentifierNode) expr.identifier = cloneNode(callee);
    else if (callee instanceof FieldAccessNode && callee.expression instanceof IdentifierNode) {
      const qualified = new IdentifierNode(`${callee.expression.name}.${callee.name}`);
      qualified.location = callee.location;
      expr.identifier = qualified;
    }
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
    const flattened = flattenedIndexedSubstitution(expr.name, subs);
    if (flattened) {
      expr.name = flattened.name;
      expr.keys = [...flattened.keys, ...expr.keys];
    }
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

  if (stmt instanceof AssertNode) {
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
    const flattened = flattenedIndexedSubstitution(stmt.name, subs);
    if (flattened) {
      stmt.name = flattened.name;
      stmt.keys = [...flattened.keys, ...stmt.keys];
    }
    stmt.keys = stmt.keys.map((k) => substituteInExpression(k, subs));
    stmt.expression = substituteInExpression(stmt.expression, subs);
    return stmt;
  }

  if (stmt instanceof MappingFieldAssignNode) {
    const flattened = flattenedIndexedSubstitution(stmt.name, subs);
    if (flattened) {
      stmt.name = flattened.name;
      stmt.keys = [...flattened.keys, ...stmt.keys];
    }
    stmt.keys = stmt.keys.map((k) => substituteInExpression(k, subs));
    stmt.expression = substituteInExpression(stmt.expression, subs);
    return stmt;
  }

  if (stmt instanceof MappingDeleteNode) {
    const flattened = flattenedIndexedSubstitution(stmt.name, subs);
    if (flattened) {
      stmt.name = flattened.name;
      stmt.keys = [...flattened.keys, ...stmt.keys];
    }
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
    const callee = subs.get(stmt.call.identifier.name);
    if (callee instanceof IdentifierNode) stmt.call.identifier = cloneNode(callee);
    else if (callee instanceof FieldAccessNode && callee.expression instanceof IdentifierNode) {
      const qualified = new IdentifierNode(`${callee.expression.name}.${callee.name}`);
      qualified.location = callee.location;
      stmt.call.identifier = qualified;
    }
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
