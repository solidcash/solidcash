import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { SplitStateFootprint } from '@solidcash/utils';
import {
  AssignNode, BlockNode, BoolLiteralNode, BranchNode, CollectionIterationNode, ContractNode,
  DeleteLocalNode, EmitStatementNode, FunctionCallNode,
  FunctionCallStatementNode,
  FunctionDefinitionNode, IdentifierNode, IndirectCallNode, Node, TupleAssignmentNode,
  TryCatchNode, VariableDefinitionNode, WhileNode,
} from '../ast/AST.js';

export interface InvocationFunctionSummary {
  id: number;
  name: string;
  arity: number;
  entryPoint: boolean;
  calls: readonly number[];
  closure: readonly number[];
  component: number;
  recursive: boolean;
  footprint: SplitStateFootprint;
}

export interface InvocationComponentSummary {
  id: number;
  functions: readonly number[];
  recursive: boolean;
}

export interface InvocationAnalysis {
  functions: readonly InvocationFunctionSummary[];
  components: readonly InvocationComponentSummary[];
}

const contractInvocationAnalysisCache = new WeakMap<ContractNode, InvocationAnalysis>();

/** A same-signature contract member shadows a file-level function in a contract body. */
export function visibleFreeFunctionsForContract(
  contractFunctions: readonly FunctionDefinitionNode[],
  freeFunctions: readonly FunctionDefinitionNode[],
): FunctionDefinitionNode[] {
  const sourceSignature = (fn: FunctionDefinitionNode): string => `${fn.name}(${fn.parameters
    .filter((parameter) => !parameter.name.startsWith('__internal__'))
    .map((parameter) => parameter.type.toString()).join(',')})`;
  const memberSignatures = new Set(contractFunctions.map(sourceSignature));
  return freeFunctions.filter((fn) => !memberSignatures.has(sourceSignature(fn)));
}

/**
 * Solidity `address.transfer` / `.send` before symbol resolution. `this.transfer` is already a
 * TransferStatementNode at parse; the address-receiver spelling is still `to.transfer` / `to.send`.
 * IERC20 `token.transfer(to, amount)` has two arguments and is not a satoshi transfer.
 */
function isPreSemanticAddressValueTransfer(node: Node): boolean {
  const call = node instanceof FunctionCallStatementNode ? node.call
    : node instanceof FunctionCallNode ? node : undefined;
  if (!call || call.parameters.length !== 1) return false;
  const name = call.identifier.name;
  return name.endsWith('.transfer') || name.endsWith('.send');
}

export function walkInvocationAst(
  value: unknown,
  visit: (node: Node) => void,
  seen = new Set<object>(),
  options: { pruneLiteralDeadControlFlow?: boolean } = {},
): void {
  if (!(value instanceof Node) || seen.has(value)) return;
  seen.add(value);
  visit(value);
  if (value instanceof TryCatchNode) {
    // BCH script failure aborts evaluation, so catches are not executable paths. Keep every footprint and
    // admission survey aligned with code generation by walking only the operation and successful try body.
    walkInvocationAst(value.expression, visit, seen, options);
    walkInvocationAst(value.tryBlock, visit, seen, options);
    return;
  }
  if (options.pruneLiteralDeadControlFlow && value instanceof BranchNode
    && value.condition instanceof BoolLiteralNode) {
    // Auto-selection asks whether a graph edge can execute. Keep normal analysis conservative; only this
    // explicit opt-in ignores the arm that a literal condition makes unreachable.
    const active = value.condition.value ? value.ifBlock : value.elseBlock;
    if (active) walkInvocationAst(active, visit, seen, options);
    return;
  }
  if (options.pruneLiteralDeadControlFlow && value instanceof WhileNode
    && value.condition instanceof BoolLiteralNode && value.condition.value === false) {
    // Unlike do-while, a while loop with a literal-false condition executes zero body iterations.
    return;
  }
  // Node data fields are enumerable; class prototype methods are not. Iterate them directly to avoid allocating
  // an Object.entries pair array for every node in every call-graph and footprint walk.
  for (const key in value) {
    if (key === 'resolvedFunction' || key === 'functionReference' || key === 'definition'
      || key === 'symbolTable' || key === 'referencedContract' || key === 'stateVariable'
      || key === 'collection' || key === 'type' || key === 'location' || key === 'name' || key === 'functionId' || key === 'error' || key === 'opRolls' || key === 'selectorHex' || key === 'abiType') continue;
    const child = value[key as keyof Node];
    if (child instanceof Node) walkInvocationAst(child, visit, seen, options);
    else if (Array.isArray(child)) {
      for (const item of child) walkInvocationAst(item, visit, seen, options);
    }
  }
}

/**
 * Whether a member of `contract` emits an event, whatever scope declares it (contract, file level, library,
 * interface). An event declared outside the contract is absent from its eventDefinitions, yet its log is readable at
 * the same event address. The ABI `emits` metadata, once semantic analysis has set it, answers without a walk.
 */
export function emitsAnyEvent(contract: ContractNode): boolean {
  const members = [contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions];
  if (members.some((fn) => (fn?.emitInfos?.length ?? 0) > 0)) return true;
  let found = false;
  const visit = (node: Node): void => { if (node instanceof EmitStatementNode) found = true; };
  const seen = new Set<object>();
  return members.some((fn) => {
    walkInvocationAst(fn?.body, visit, seen);
    return found;
  });
}

/**
 * Signatures of the events the members of `contract` emit, from the same emit metadata and walk as `emitsAnyEvent`,
 * so a contract that emits any of them has events.
 */
export function emittedEventSignatures(contract: ContractNode): Set<string> {
  const members = [contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions];
  const signatures = new Set<string>();
  for (const info of members.flatMap((fn) => fn?.emitInfos ?? [])) {
    const signature = info.eventDefinition?.signature || info.eventSignature;
    if (signature) signatures.add(signature);
  }
  const visit = (node: Node): void => {
    if (node instanceof EmitStatementNode && node.eventDefinition) signatures.add(node.eventDefinition.signature);
  };
  const seen = new Set<object>();
  for (const fn of members) walkInvocationAst(fn?.body, visit, seen);
  return signatures;
}

/** Walk executable nodes with the names actually in scope at each source position. */
function walkScopedFootprintAst(
  value: Node | undefined,
  visit: (node: Node, locallyBound: ReadonlySet<string>) => void,
  initialNames: ReadonlySet<string>,
): void {
  const active = new Set<Node>();
  const walk = (node: Node | undefined, locallyBound: ReadonlySet<string>): void => {
    if (!node || active.has(node)) return;
    active.add(node);
    visit(node, locallyBound);
    if (node instanceof TryCatchNode) {
      walk(node.expression, locallyBound);
      const successNames = new Set(locallyBound);
      for (const parameter of node.returnParameters ?? []) successNames.add(parameter.name);
      walk(node.tryBlock, successNames);
    } else if (node instanceof BlockNode) {
      const blockNames = new Set(locallyBound);
      for (const statement of node.statements ?? []) {
        walk(statement, blockNames);
        if (statement instanceof VariableDefinitionNode) blockNames.add(statement.name);
        if (statement instanceof TupleAssignmentNode) {
          for (const element of statement.elements) {
            if (element.name !== undefined && element.type !== undefined) blockNames.add(element.name);
          }
        }
      }
    } else if (node instanceof CollectionIterationNode) {
      const iterationNames = new Set(locallyBound);
      if (node.keyName) iterationNames.add(node.keyName);
      if (node.valueName) iterationNames.add(node.valueName);
      walk(node.body, iterationNames);
    } else {
      for (const key in node) {
        if (key === 'resolvedFunction' || key === 'functionReference' || key === 'definition'
          || key === 'symbolTable' || key === 'referencedContract' || key === 'stateVariable'
          || key === 'collection' || key === 'type' || key === 'location' || key === 'name'
          || key === 'functionId' || key === 'error' || key === 'opRolls' || key === 'selectorHex'
          || key === 'abiType') continue;
        const child = node[key as keyof Node];
        if (child instanceof Node) walk(child, locallyBound);
        else if (Array.isArray(child)) {
          for (const item of child) if (item instanceof Node) walk(item, locallyBound);
        }
      }
    }
    active.delete(node);
  };
  walk(value, initialNames);
}

export function directCallNames(fn: FunctionDefinitionNode): Set<string> {
  const calls = new Set<string>();
  walkInvocationAst(fn.body, (node) => {
    // Resolved inheritance expansion can mark an explicit base-dispatch helper
    // as a this-originated call even though the generated `__base_*` body must
    // remain in the same physical shard. Names absent from `byName` are ignored
    // by closure construction, so retaining all named calls is conservative and
    // prevents facets from dropping required internal implementations.
    if (node instanceof FunctionCallNode) calls.add(node.identifier.name);
    if (node instanceof FunctionCallStatementNode) calls.add(node.call.identifier.name);
  });
  return calls;
}

export function collectNamedFunctionClosure(
  fn: FunctionDefinitionNode,
  byName: Map<string, FunctionDefinitionNode[]>,
  directCallsByFunction?: WeakMap<FunctionDefinitionNode, Set<string>>,
): Set<string> {
  const closure = new Set<string>();
  const pending = [fn.name];
  while (pending.length > 0) {
    const name = pending.pop()!;
    if (closure.has(name)) continue;
    closure.add(name);
    for (const candidate of byName.get(name) ?? []) {
      let directCalls = directCallsByFunction?.get(candidate);
      if (!directCalls) {
        directCalls = directCallNames(candidate);
        directCallsByFunction?.set(candidate, directCalls);
      }
      for (const called of directCalls) if (byName.has(called)) pending.push(called);
    }
  }
  return closure;
}

export interface FootprintAnalysisCache {
  directCalls: WeakMap<FunctionDefinitionNode, Set<string>>;
  directFootprints: WeakMap<FunctionDefinitionNode, SplitStateFootprint>;
  /** Contract scalar-state namespace used while analysing pre-semantic Solidity-compatible bare identifiers. */
  stateNames?: ReadonlySet<string>;
}

export function createFootprintAnalysisCache(stateNames?: ReadonlySet<string>): FootprintAnalysisCache {
  return {
    directCalls: new WeakMap(), directFootprints: new WeakMap(),
    ...(stateNames && { stateNames: new Set(stateNames) }),
  };
}

export function analyseFunctionFootprint(
  fn: FunctionDefinitionNode,
  byName: Map<string, FunctionDefinitionNode[]>,
  cache?: FootprintAnalysisCache,
): SplitStateFootprint {
  const reads = new Set<string>();
  const writes = new Set<string>();
  const effects = new Set<string>();
  const result = { unknown: false };
  for (const name of collectNamedFunctionClosure(fn, byName, cache?.directCalls)) {
    for (const candidate of byName.get(name) ?? []) {
      const cachedFootprint = cache?.directFootprints.get(candidate);
      if (cachedFootprint) {
        for (const read of cachedFootprint.reads) reads.add(read);
        for (const write of cachedFootprint.writes) writes.add(write);
        for (const effect of cachedFootprint.effects) effects.add(effect);
        if (cachedFootprint.unknown) result.unknown = true;
        continue;
      }
      const directReads = new Set<string>();
      const directWrites = new Set<string>();
      const directEffects = new Set<string>();
      const bareWriteTargets = new WeakSet<IdentifierNode>();
      let directUnknown = false;
      const analyseNode = (node: Node, locallyBound: ReadonlySet<string>): void => {
        // The generic walk also visits an Assign/Delete target's IdentifierNode. A plain write does not read
        // that value; compound assignments retain a separate identifier in their desugared RHS and still do.
        if (node instanceof AssignNode || node instanceof DeleteLocalNode) {
          bareWriteTargets.add(node.identifier);
        }
        const kind = node.constructor.name;
        const shaped = node as unknown as { name?: string; keys?: Node[] };
        const resourceName = shaped.name;
        const collectionResource = resourceName
          ? collectionResourceName(resourceName, shaped.keys) : undefined;
        // X26: a bare element READ `m[k]` is an ArrayAccessNode carrying `array`/`index`, never `name`/`keys`, so
        // the shaped lookup above finds no resource and the read branch below cannot fire. It is the read half of
        // the same gap X19 closed for writes, and it is NOT harmless: the bus route's collection-eligibility
        // branch is gated on this footprint, so a handler whose only collection access is a bare read published a
        // block layout with no entry slot while its covenant still addressed one - the next participant's block
        // is placed on top of the slot the route reads. Recover the collection the same way the write half does.
        const bareRead = kind === 'ArrayAccessNode'
          ? (node as unknown as { array?: Node }).array as unknown as { constructor: { name: string }; name?: string }
          : undefined;
        const bareReadName = bareRead?.constructor.name === 'IdentifierNode' ? bareRead.name : undefined;
        if (kind === 'StateAccessNode' && resourceName) directReads.add(`state:${resourceName}`);
        // Before SymbolTableTraversal, Solidity-compatible `x` and `x = value` state syntax is represented as
        // ordinary identifiers/assignments. Keep footprint admission representation-independent by recognizing
        // names from the caller-supplied contract state namespace, with the same local-shadow guard used by bare
        // collection analysis. Explicit `this.x` already arrives as StateAccess/StateAssign and needs no context.
        else if (node instanceof AssignNode && node.identifier instanceof IdentifierNode
          && cache?.stateNames?.has(node.identifier.name) && !locallyBound.has(node.identifier.name)) {
          directWrites.add(`state:${node.identifier.name}`);
        } else if (node instanceof DeleteLocalNode && cache?.stateNames?.has(node.identifier.name)
          && !locallyBound.has(node.identifier.name)) {
          directWrites.add(`state:${node.identifier.name}`);
        } else if (node instanceof IdentifierNode && !bareWriteTargets.has(node)
          && cache?.stateNames?.has(node.name)
          && !locallyBound.has(node.name)) {
          directReads.add(`state:${node.name}`);
        } else if (bareReadName !== undefined && !locallyBound.has(bareReadName)) {
          directReads.add(collectionResourceName(bareReadName, undefined));
        } else if (/^(MappingAccess|ArrayAccess|StateArrayAccess)/.test(kind) && collectionResource
          && resourceName && !locallyBound.has(resourceName)) {
          directReads.add(collectionResource);
        } else if (/^(StateAssign|DeleteState)/.test(kind) && resourceName) {
          directWrites.add(`state:${resourceName}`);
        } else if (/^(MappingAssign|MappingFieldAssign|MappingDelete|StateArray(Push|Pop|Assign|Delete))/
          .test(kind) && collectionResource && resourceName && !locallyBound.has(resourceName)) {
          directWrites.add(collectionResource);
        // X19: a BARE element write `m[k] = v` / `delete m[k]` is an ArrayAssign/ArrayDelete until symbol
        // resolution decides state-vs-local (only the `this.`-prefixed spelling is a MappingAssign from the
        // parser). This analysis runs BOTH before and after that resolution, so omitting the bare forms made one
        // spelling of the same write invisible to every pre-semantic caller - notably the message-bus route's
        // synthesis point, which then produced a route carrying a write it had reserved no entry descriptor for.
        // A name bound locally in this function is a LOCAL array element write and stays out of the footprint;
        // the same test is what symbol resolution later applies to choose MappingAssign over ArrayAssign.
        } else if (/^(ArrayAssign|ArrayDelete)/.test(kind) && collectionResource
          && resourceName && !locallyBound.has(resourceName)) {
          directWrites.add(collectionResource);
        } else if (kind === 'EmitStatementNode') directEffects.add('events');
        else if (kind.includes('Transfer') || kind === 'AddressSendExpressionNode'
          || isPreSemanticAddressValueTransfer(node)) {
          // Solidity `to.transfer(1)` / `to.send(1)` parse as `to.transfer` / `to.send` FunctionCalls until
          // SymbolTableTraversal rewrites them. Without this, the kernel route never clones the handler as a
          // satoshi-transfer effect and later inlines the rewrite into `__message_bus1` with no transfer slots.
          directEffects.add('value');
        } else if (kind.includes('ExternalFunctionCall') || kind === 'LowLevelCallNode') {
          directEffects.add('external-call');
        } else if (node instanceof IndirectCallNode) directUnknown = true;
      };
      walkScopedFootprintAst(candidate.body, analyseNode, new Set([
        ...candidate.parameters.map((parameter) => parameter.name),
        ...candidate.returnNames,
      ]));
      const directFootprint: SplitStateFootprint = {
        reads: [...directReads],
        writes: [...directWrites],
        effects: [...directEffects],
        unknown: directUnknown,
      };
      cache?.directFootprints.set(candidate, directFootprint);
      for (const read of directReads) reads.add(read);
      for (const write of directWrites) writes.add(write);
      for (const effect of directEffects) effects.add(effect);
      if (directUnknown) result.unknown = true;
    }
  }
  return {
    reads: [...reads].sort(),
    writes: [...writes].sort(),
    effects: [...effects].sort(),
    ...result,
  };
}

export function collectionResourceName(name: string, keys: Node[] | undefined): string {
  if (!keys || keys.length === 0) return `collection:${name}:*`;
  const literals = keys.map((key) => {
    const shaped = key as unknown as { value?: unknown };
    const kind = key.constructor.name;
    if (!['IntLiteralNode', 'BoolLiteralNode', 'HexLiteralNode', 'StringLiteralNode'].includes(kind)) return '*';
    const value = shaped.value;
    return value instanceof Uint8Array ? binToHex(value) : String(value);
  });
  return `collection:${name}:${literals.includes('*') ? '*' : literals.join('/')}`;
}

/** Build one deterministic resolved call graph for diagnostics, recursion
 * preflight, splitting, and later message-bus eligibility. */
export function analyseContractInvocations(contract: ContractNode): InvocationAnalysis {
  const cached = contractInvocationAnalysisCache.get(contract);
  if (cached) return cached;
  const functions = [
    ...contract.functions,
    ...(contract.fallbackDef ? [contract.fallbackDef] : []),
    ...(contract.receiveDef ? [contract.receiveDef] : []),
  ].filter((fn) => fn.functionId !== undefined);
  const byId = new Map(functions.map((fn) => [fn.functionId!, fn]));
  const byName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of functions) {
    const defs = byName.get(fn.name) ?? [];
    defs.push(fn);
    byName.set(fn.name, defs);
  }
  const calls = new Map<number, Set<number>>();
  const footprintCache: FootprintAnalysisCache = {
    directCalls: new WeakMap(), directFootprints: new WeakMap(),
  };
  for (const fn of functions) {
    const out = new Set<number>();
    const directCalls = new Set<string>();
    walkInvocationAst(fn.body, (node) => {
      if (node instanceof FunctionCallNode) {
        if (!node.fromThisCall) directCalls.add(node.identifier.name);
        const id = node.resolvedFunction?.functionId;
        if (id !== undefined && byId.has(id)) out.add(id);
      }
    });
    calls.set(fn.functionId!, out);
    footprintCache.directCalls.set(fn, directCalls);
  }

  let next = 0;
  const indices = new Map<number, number>();
  const low = new Map<number, number>();
  const stack: number[] = [];
  const onStack = new Set<number>();
  const rawComponents: number[][] = [];
  const connect = (id: number): void => {
    indices.set(id, next);
    low.set(id, next);
    next += 1;
    stack.push(id);
    onStack.add(id);
    for (const callee of calls.get(id) ?? []) {
      if (!indices.has(callee)) {
        connect(callee);
        low.set(id, Math.min(low.get(id)!, low.get(callee)!));
      } else if (onStack.has(callee)) {
        low.set(id, Math.min(low.get(id)!, indices.get(callee)!));
      }
    }
    if (low.get(id) !== indices.get(id)) return;
    const component: number[] = [];
    while (stack.length > 0) {
      const member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
      if (member === id) break;
    }
    rawComponents.push(component.sort((a, b) => a - b));
  };
  for (const id of [...byId.keys()].sort((a, b) => a - b)) if (!indices.has(id)) connect(id);
  rawComponents.sort((a, b) => a[0] - b[0]);
  const componentByFunction = new Map<number, number>();
  const components = rawComponents.map((members, id) => {
    for (const member of members) componentByFunction.set(member, id);
    return {
      id,
      functions: members,
      recursive: members.length > 1 || (calls.get(members[0])?.has(members[0]) ?? false),
    };
  });

  const closureOf = (start: number): number[] => {
    const result = new Set<number>();
    const pending = [start];
    while (pending.length > 0) {
      const id = pending.pop()!;
      if (result.has(id)) continue;
      result.add(id);
      for (const callee of calls.get(id) ?? []) pending.push(callee);
    }
    return [...result].sort((a, b) => a - b);
  };
  const summaries = functions.map((fn) => {
    const id = fn.functionId!;
    const closure = closureOf(id);
    return {
      id,
      name: fn.name,
      arity: fn.parameters.filter((p) => !p.name.startsWith('__internal__')).length,
      entryPoint: fn.isEntryPoint,
      calls: [...(calls.get(id) ?? [])].sort((a, b) => a - b),
      closure,
      component: componentByFunction.get(id)!,
      recursive: closure.some((member) => components[componentByFunction.get(member)!].recursive),
      footprint: analyseFunctionFootprint(fn, byName, footprintCache),
    };
  }).sort((a, b) => a.id - b.id);
  const analysis = { functions: summaries, components };
  contractInvocationAnalysisCache.set(contract, analysis);
  return analysis;
}
