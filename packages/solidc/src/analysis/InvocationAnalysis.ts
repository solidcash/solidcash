import { binToHex } from '@bitauth/libauth';
import { SplitStateFootprint } from '@solidcash/utils';
import {
  ContractNode, FunctionCallNode, FunctionDefinitionNode, IndirectCallNode, Node, TupleAssignmentNode,
  VariableDefinitionNode,
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

const RESOLVED_BACKREF_KEYS = new Set([
  'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
  'referencedContract', 'stateVariable', 'collection',
]);

export function walkInvocationAst(
  value: unknown,
  visit: (node: Node) => void,
  seen = new Set<object>(),
): void {
  if (!(value instanceof Node) || seen.has(value)) return;
  seen.add(value);
  visit(value);
  for (const [key, child] of Object.entries(value)) {
    if (RESOLVED_BACKREF_KEYS.has(key)) continue;
    if (child instanceof Node) walkInvocationAst(child, visit, seen);
    else if (Array.isArray(child)) {
      for (const item of child) walkInvocationAst(item, visit, seen);
    }
  }
}

export function directCallNames(fn: FunctionDefinitionNode): Set<string> {
  const calls = new Set<string>();
  walkInvocationAst(fn.body, (node) => {
    if (node instanceof FunctionCallNode && !node.fromThisCall) calls.add(node.identifier.name);
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

interface FootprintAnalysisCache {
  directCalls: WeakMap<FunctionDefinitionNode, Set<string>>;
  bodyNodes: WeakMap<FunctionDefinitionNode, { locallyBound: Set<string>; nodes: Node[] }>;
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
      let locallyBound: Set<string>;
      let nodes: Node[] | undefined;
      const cached = cache?.bodyNodes.get(candidate);
      if (cached) ({ locallyBound, nodes } = cached);
      else {
        if (cache) {
          locallyBound = new Set([
            ...candidate.parameters.map((parameter) => parameter.name),
            ...candidate.returnNames,
          ]);
          nodes = [];
          walkInvocationAst(candidate.body, (node) => {
            nodes!.push(node);
            if (node instanceof VariableDefinitionNode) locallyBound.add(node.name);
            if (node instanceof TupleAssignmentNode) {
              for (const element of node.elements) {
                if (element.name !== undefined && element.type !== undefined) locallyBound.add(element.name);
              }
            }
          });
          cache.bodyNodes.set(candidate, { locallyBound, nodes });
        } else {
          locallyBound = locallyBoundNames(candidate);
        }
      }
      const analyseNode = (node: Node): void => {
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
        if (kind === 'StateAccessNode' && resourceName) reads.add(`state:${resourceName}`);
        else if (bareReadName !== undefined && !locallyBound.has(bareReadName)) {
          reads.add(collectionResourceName(bareReadName, undefined));
        } else if (/^(MappingAccess|ArrayAccess|StateArrayAccess)/.test(kind) && collectionResource) {
          reads.add(collectionResource);
        } else if (/^(StateAssign|DeleteState)/.test(kind) && resourceName) {
          writes.add(`state:${resourceName}`);
        } else if (/^(MappingAssign|MappingFieldAssign|MappingDelete|StateArray(Push|Pop|Assign|Delete))/
          .test(kind) && collectionResource) {
          writes.add(collectionResource);
        // X19: a BARE element write `m[k] = v` / `delete m[k]` is an ArrayAssign/ArrayDelete until symbol
        // resolution decides state-vs-local (only the `this.`-prefixed spelling is a MappingAssign from the
        // parser). This analysis runs BOTH before and after that resolution, so omitting the bare forms made one
        // spelling of the same write invisible to every pre-semantic caller - notably the message-bus route's
        // synthesis point, which then produced a route carrying a write it had reserved no entry descriptor for.
        // A name bound locally in this function is a LOCAL array element write and stays out of the footprint;
        // the same test is what symbol resolution later applies to choose MappingAssign over ArrayAssign.
        } else if (/^(ArrayAssign|ArrayDelete)/.test(kind) && collectionResource
          && resourceName && !locallyBound.has(resourceName)) {
          writes.add(collectionResource);
        } else if (kind === 'EmitStatementNode') effects.add('events');
        else if (kind.includes('Transfer') || kind === 'AddressSendExpressionNode') effects.add('value');
        else if (kind.includes('ExternalFunctionCall') || kind === 'LowLevelCallNode') {
          effects.add('external-call');
        } else if (node instanceof IndirectCallNode) result.unknown = true;
      };
      if (nodes) {
        for (const node of nodes) analyseNode(node);
      } else {
        walkInvocationAst(candidate.body, analyseNode);
      }
    }
  }
  return {
    reads: [...reads].sort(),
    writes: [...writes].sort(),
    effects: [...effects].sort(),
    ...result,
  };
}

/**
 * Parameter and local-declaration names bound inside one function - never a contract collection.
 *
 * A NAMED RETURN (`returns (uint[] memory amounts)`) and a tuple DECLARATION (`(uint a, uint[] b) = f()`) bind
 * a local exactly as a parameter or a `var` declaration does, and symbol resolution resolves an element access
 * on either to that local. Omitting them made the bare-element branches below read `amounts[i]` in
 * UniswapV2Router02 as a collection access and publish `collection:amounts:*` for a name the contract never
 * declares; the message-bus route is gated on this footprint, so every such handler was refused
 * 'collection-helper-route-not-enabled' with no collection involved at all. Only tuple elements that DECLARE
 * (they carry a type) are bound here - an `existing` element names a variable bound at its own declaration,
 * and treating one as local would hide a genuine state write from the footprint.
 */
function locallyBoundNames(fn: FunctionDefinitionNode): Set<string> {
  const names = new Set<string>([
    ...fn.parameters.map((parameter) => parameter.name),
    ...fn.returnNames,
  ]);
  walkInvocationAst(fn.body, (node) => {
    if (node instanceof VariableDefinitionNode) names.add(node.name);
    if (node instanceof TupleAssignmentNode) {
      for (const element of node.elements) {
        if (element.name !== undefined && element.type !== undefined) names.add(element.name);
      }
    }
  });
  return names;
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
  const footprintCache: FootprintAnalysisCache = { directCalls: new WeakMap(), bodyNodes: new WeakMap() };
  for (const fn of functions) {
    const out = new Set<number>();
    const directCalls = new Set<string>();
    const locallyBound = new Set([
      ...fn.parameters.map((parameter) => parameter.name),
      ...fn.returnNames,
    ]);
    const bodyNodes: Node[] = [];
    walkInvocationAst(fn.body, (node) => {
      bodyNodes.push(node);
      if (node instanceof VariableDefinitionNode) locallyBound.add(node.name);
      if (node instanceof TupleAssignmentNode) {
        for (const element of node.elements) {
          if (element.name !== undefined && element.type !== undefined) locallyBound.add(element.name);
        }
      }
      if (node instanceof FunctionCallNode) {
        if (!node.fromThisCall) directCalls.add(node.identifier.name);
        const id = node.resolvedFunction?.functionId;
        if (id !== undefined && byId.has(id)) out.add(id);
      }
    });
    calls.set(fn.functionId!, out);
    footprintCache.directCalls.set(fn, directCalls);
    footprintCache.bodyNodes.set(fn, { locallyBound, nodes: bodyNodes });
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
