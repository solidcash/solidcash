import { binToHex } from '@bitauth/libauth';
import { SplitStateFootprint } from '@solidcash/utils';
import {
  ContractNode, FunctionCallNode, FunctionDefinitionNode, IndirectCallNode, Node,
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
): Set<string> {
  const closure = new Set<string>();
  const pending = [fn.name];
  while (pending.length > 0) {
    const name = pending.pop()!;
    if (closure.has(name)) continue;
    closure.add(name);
    for (const candidate of byName.get(name) ?? []) {
      for (const called of directCallNames(candidate)) if (byName.has(called)) pending.push(called);
    }
  }
  return closure;
}

export function analyseFunctionFootprint(
  fn: FunctionDefinitionNode,
  byName: Map<string, FunctionDefinitionNode[]>,
): SplitStateFootprint {
  const reads = new Set<string>();
  const writes = new Set<string>();
  const effects = new Set<string>();
  const result = { unknown: false };
  for (const name of collectNamedFunctionClosure(fn, byName)) {
    for (const candidate of byName.get(name) ?? []) {
      walkInvocationAst(candidate.body, (node) => {
        const kind = node.constructor.name;
        const shaped = node as unknown as { name?: string; keys?: Node[] };
        const resourceName = shaped.name;
        const collectionResource = resourceName
          ? collectionResourceName(resourceName, shaped.keys) : undefined;
        if (kind === 'StateAccessNode' && resourceName) reads.add(`state:${resourceName}`);
        else if (/^(MappingAccess|ArrayAccess|StateArrayAccess)/.test(kind) && collectionResource) {
          reads.add(collectionResource);
        } else if (/^(StateAssign|DeleteState)/.test(kind) && resourceName) {
          writes.add(`state:${resourceName}`);
        } else if (/^(MappingAssign|MappingFieldAssign|MappingDelete|StateArray(Push|Pop|Assign|Delete))/
          .test(kind) && collectionResource) {
          writes.add(collectionResource);
        } else if (kind === 'EmitStatementNode') effects.add('events');
        else if (kind.includes('Transfer') || kind === 'AddressSendExpressionNode') effects.add('value');
        else if (kind.includes('ExternalFunctionCall') || kind === 'LowLevelCallNode') {
          effects.add('external-call');
        } else if (node instanceof IndirectCallNode) result.unknown = true;
      });
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
 * preflight, splitting, and later hidden-batch eligibility. */
export function analyseContractInvocations(contract: ContractNode): InvocationAnalysis {
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
  for (const fn of functions) {
    const out = new Set<number>();
    walkInvocationAst(fn.body, (node) => {
      if (!(node instanceof FunctionCallNode)) return;
      const id = node.resolvedFunction?.functionId;
      if (id !== undefined && byId.has(id)) out.add(id);
    });
    calls.set(fn.functionId!, out);
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
      footprint: analyseFunctionFootprint(fn, byName),
    };
  }).sort((a, b) => a.id - b.id);
  return { functions: summaries, components };
}
