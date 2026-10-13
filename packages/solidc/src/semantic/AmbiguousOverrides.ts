import { ArrayType, MappingType, type Type } from '@solidcash/utils';
import {
  ContractNode, FunctionModifier, InterfaceNode, StateVariableNode, StateVariableVisibility, type ParameterNode,
} from '../ast/AST.js';
import { AmbiguousOverrideError } from '../Errors.js';

// What one contract or interface exposes under one signature: a function or a public state variable getter.
interface Callable {
  name: string;
  implemented: boolean;
  unit: string;
}

type Unit = ContractNode | InterfaceNode;

const signature = (name: string, types: Type[]): string => `${name}(${types.map(String).join(',')})`;

// A public getter's parameters: one key per mapping level and one uint256 index per array level.
function getterParams(type: Type): string[] {
  if (type instanceof MappingType) return [String(type.keyType), ...getterParams(type.valueType)];
  if (type instanceof ArrayType) return ['uint256', ...getterParams(type.elementType)];
  return [];
}

/**
 * solc refuses a contract or interface that inherits two or more callables for one signature without overriding it
 * (TypeError 6480), following its OverrideChecker: per signature, the callables the direct bases expose form an
 * override graph from the unit to an artificial top. A cut vertex settles the callables it overrides (and itself,
 * when unimplemented); two or more left is ambiguous. Units with unresolved bases or duplicate names are skipped.
 */
export function assertNoAmbiguousOverrides(units: Unit[]): void {
  const byName = new Map<string, Unit>();
  const duplicated = new Set<string>();
  for (const unit of units) {
    if (byName.has(unit.name) && byName.get(unit.name) !== unit) duplicated.add(unit.name);
    byName.set(unit.name, unit);
  }
  const bases = (unit: Unit): string[] => (unit instanceof InterfaceNode ? unit.parents : unit.implements);
  const resolvable = (unit: Unit, seen = new Set<string>()): boolean => {
    if (duplicated.has(unit.name) || seen.has(unit.name)) return !duplicated.has(unit.name);
    seen.add(unit.name);
    return bases(unit).every((name) => byName.has(name) && resolvable(byName.get(name)!, seen));
  };

  const definedCache = new Map<string, Map<string, Callable>>();
  const defined = (unit: Unit): Map<string, Callable> => {
    const cached = definedCache.get(unit.name);
    if (cached) return cached;
    const result = new Map<string, Callable>();
    const params = (parameters: ParameterNode[]): Type[] => parameters.map((parameter) => parameter.type);
    if (unit instanceof InterfaceNode) {
      for (const fn of unit.functions) {
        result.set(signature(fn.name, params(fn.parameters)),
          { name: fn.name, implemented: false, unit: unit.name });
      }
    } else {
      for (const fn of unit.functions) {
        if (fn.name.startsWith('__') || fn.modifiers.includes(FunctionModifier.PRIVATE)) continue;
        result.set(signature(fn.name, params(fn.parameters)),
          { name: fn.name, implemented: !fn.isAbstract, unit: unit.name });
      }
      for (const variable of unit.stateVariables as StateVariableNode[]) {
        if (variable.visibility !== StateVariableVisibility.PUBLIC) continue;
        result.set(`${variable.name}(${getterParams(variable.type).join(',')})`,
          { name: variable.name, implemented: true, unit: unit.name });
      }
    }
    definedCache.set(unit.name, result);
    return result;
  };

  // The callables `callable` overrides: the closest definition of its signature along each direct base.
  const closest = (unitName: string, key: string): Callable[] => {
    const unit = byName.get(unitName)!;
    const own = defined(unit).get(key);
    return own ? [own] : [...new Set(bases(unit).flatMap((base) => closest(base, key)))];
  };
  // By signature, keyword or not: an interface function is implemented without `override` since Solidity 0.8.8.
  const baseCallables = (callable: Callable, key: string): Callable[] =>
    [...new Set(bases(byName.get(callable.unit)!).flatMap((base) => closest(base, key)))];

  // solc's inheritedFunctions: each direct base's own callables, then what it inherits under other signatures.
  const inheritedCache = new Map<string, Map<string, Set<Callable>>>();
  const inherited = (unit: Unit): Map<string, Set<Callable>> => {
    const cached = inheritedCache.get(unit.name);
    if (cached) return cached;
    const result = new Map<string, Set<Callable>>();
    const add = (key: string, callable: Callable): void => {
      result.set(key, (result.get(key) ?? new Set()).add(callable));
    };
    for (const baseName of bases(unit)) {
      const base = byName.get(baseName)!;
      const own = defined(base);
      for (const [key, callable] of own) add(key, callable);
      for (const [key, callables] of inherited(base)) if (!own.has(key)) callables.forEach((c) => add(key, c));
    }
    inheritedCache.set(unit.name, result);
    return result;
  };

  for (const unit of byName.values()) {
    if (duplicated.has(unit.name) || !resolvable(unit)) continue;
    const own = defined(unit);
    for (const [key, callables] of inherited(unit)) {
      if (own.has(key) || callables.size < 2) continue;
      if (stillAmbiguous([...callables], key, baseCallables)) throw new AmbiguousOverrideError(unit, key.split('(')[0]);
    }
  }
}

// Build the undirected override graph (0 = the unit, 1 = top), find cut vertices (Tarjan) and prune as solc does.
function stillAmbiguous(
  callables: Callable[], key: string, baseCallables: (callable: Callable, key: string) => Callable[],
): boolean {
  const ids = new Map<Callable, number>();
  const nodes: Callable[] = [];
  const edges: number[][] = [[], []];
  const link = (a: number, b: number): void => { edges[a].push(b); edges[b].push(a); };
  const visit = (callable: Callable): number => {
    const known = ids.get(callable);
    if (known !== undefined) return known;
    const id = edges.length;
    ids.set(callable, id);
    nodes[id] = callable;
    edges.push([]);
    const overridden = baseCallables(callable, key);
    if (overridden.length > 0) overridden.forEach((base) => link(id, visit(base)));
    else link(id, 1);
    return id;
  };
  callables.forEach((callable) => link(0, visit(callable)));

  const depth: number[] = [];
  const low: number[] = [];
  const cut = new Set<number>();
  const dfs = (u: number, parent: number, d: number): void => {
    depth[u] = d;
    low[u] = d;
    for (const v of edges[u]) {
      if (depth[v] === undefined) {
        dfs(v, u, d + 1);
        if (low[v] >= depth[u] && parent !== -1) cut.add(u);
        low[u] = Math.min(low[u], low[v]);
      } else if (v !== parent) {
        low[u] = Math.min(low[u], depth[v]);
      }
    }
  };
  dfs(0, -1, 0);

  const remaining = new Set(callables);
  for (const id of cut) {
    const vertex = nodes[id];
    if (!vertex) continue;
    const pending = [...baseCallables(vertex, key)];
    while (pending.length > 0) {
      const base = pending.pop()!;
      remaining.delete(base);
      pending.push(...baseCallables(base, key));
    }
    if (!vertex.implemented) remaining.delete(vertex);
  }
  return remaining.size > 1;
}

