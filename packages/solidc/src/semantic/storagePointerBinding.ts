import { MappingType, ArrayType, type Type } from '@solidcash/utils';
import {
  ArrayAccessNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  ArrayPopNode,
  ArrayPushNode,
  BinaryOpNode,
  BlockNode,
  ContractNode,
  DeleteLocalNode,
  DeleteStateNode,
  type ExpressionNode,
  IdentifierNode,
  IntLiteralNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingDeleteNode,
  MappingFieldAssignNode,
  type Node,
  RequireNode,
  StateAccessNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  StateArrayPopNode,
  StateArrayPushNode,
  StateAssignNode,
  TupleIndexOpNode,
} from '../ast/AST.js';
import { BinaryOperator } from '../ast/Operator.js';
import { type Location } from '../ast/Location.js';
import { cloneNode } from '../ast/clone.js';
import { ParseError } from '../Errors.js';

/**
 * A storage-reference parameter bound by an inheritance invocation or an inlined call (`A(m[1])`, `f(a[i])`)
 * denotes the caller's container at a key prefix. The parent body's statements name the parameter, so they must
 * be rewritten to that container with the prefix in front of their own keys.
 */
export interface StoragePointerBinding {
  /** The substituted parameter this binding replaces; nodes are matched on this name. */
  parameter: string;
  /** The caller's collection / state array the pointer aliases. */
  name: string;
  /** The keys that select the aliased sub-container (`m[1]` -> `[1]`; `f(a)` -> `[]`). */
  keys: ExpressionNode[];
}

/** What a bound pointer's container can be, from the contract it is bound in. */
export interface StoragePointerTargets {
  /** Unbounded ARRAY collections: name -> number of array dimensions. */
  arrayDepth: Map<string, number>;
  /** Mappings whose value is an unbounded array whose element chain reaches a mapping (no entry value exists). */
  mappingValueArrays: Set<string>;
  /** Packed / chunk-packed state arrays; their own element machinery handles push/pop/length. */
  stateArrays: Set<string>;
}

/** Collect the container kinds a bound storage pointer can resolve to. */
export function storagePointerTargets(contract: ContractNode): StoragePointerTargets {
  const arrayDepth = new Map<string, number>();
  const mappingValueArrays = new Set<string>();
  for (const collection of contract.collections) {
    if (collection.type instanceof ArrayType && collection.type.bound === undefined) {
      let depth = 0;
      let current: Type = collection.type;
      while (current instanceof ArrayType) { depth += 1; current = current.elementType; }
      arrayDepth.set(collection.name, depth);
      continue;
    }
    if (collection.type instanceof MappingType) {
      let current: Type = collection.type;
      while (current instanceof MappingType) current = current.valueType;
      if (!(current instanceof ArrayType) || current.bound !== undefined) continue;
      let element: Type = current.elementType;
      while (element instanceof ArrayType) element = element.elementType;
      if (element instanceof MappingType) mappingValueArrays.add(collection.name);
    }
  }
  return {
    arrayDepth,
    mappingValueArrays,
    stateArrays: new Set(contract.stateVariables
      .filter((state) => state.isPacked || state.isDynamic)
      .map((state) => state.name)),
  };
}

/**
 * The container and key prefix a substituted storage parameter's argument introduces, when the argument is a
 * storage key path (`m[1]`, `a[i][j]`, or a bare container). Undefined for any other argument shape, so every
 * substitution that is not a storage pointer keeps its existing behaviour.
 */
export function storagePointerBindingFor(
  name: string, parameterNames: ReadonlySet<string>, subs: ReadonlyMap<string, ExpressionNode>,
): StoragePointerBinding | undefined {
  if (!parameterNames.has(name)) return undefined;
  const replacement = subs.get(name);
  if (!replacement) return undefined;
  if (replacement instanceof MappingAccessNode) {
    return {
      parameter: name,
      name: replacement.name,
      keys: replacement.keys.map((key) => cloneNode(key) as ExpressionNode),
    };
  }
  const keys: ExpressionNode[] = [];
  let current: Node = replacement;
  while (current instanceof ArrayAccessNode || current instanceof TupleIndexOpNode) {
    if (current instanceof ArrayAccessNode) {
      keys.unshift(cloneNode(current.index) as ExpressionNode);
      current = current.array;
    } else {
      const index = new IntLiteralNode(BigInt(current.index));
      index.location = current.location;
      keys.unshift(index);
      current = current.tuple;
    }
  }
  return current instanceof IdentifierNode ? { parameter: name, name: current.name, keys } : undefined;
}

/** The base name an index chain (`p`, `p[i]`, `p[i][j]`) is rooted at. */
export function pointerRootName(expr: ExpressionNode): string | undefined {
  if (expr instanceof IdentifierNode) return expr.name;
  if (expr instanceof MappingAccessNode) return expr.name;
  if (expr instanceof ArrayAccessNode) return pointerRootName(expr.array);
  if (expr instanceof TupleIndexOpNode) return pointerRootName(expr.tuple);
  return undefined;
}

/** The bound pointer's container + prefix keys, cloned for one use. */
function bindingKeys(binding: StoragePointerBinding): ExpressionNode[] {
  return binding.keys.map((key) => cloneNode(key) as ExpressionNode);
}

function stamp<T extends { location?: Location }>(node: T, location: Location | undefined): T {
  if (location) node.location = location;
  return node;
}

/**
 * The length-authority cell for the array dimension a bound pointer addresses: the outer dimension of an
 * unbounded array collection is the private scalar `<name>$len`, its first inner dimension the chunk-packed
 * count array `<name>$len$1`, and a mapping-value array counts per mapping key in the companion mapping
 * `<name>$len`. Undefined when the pointer reaches past the dimensions the model tracks.
 */
function lengthRead(
  binding: StoragePointerBinding, targets: StoragePointerTargets, location: Location | undefined,
): ExpressionNode | undefined {
  if (targets.mappingValueArrays.has(binding.name)) {
    return stamp(new MappingAccessNode(`${binding.name}$len`, bindingKeys(binding)), location);
  }
  const depth = targets.arrayDepth.get(binding.name);
  if (depth === undefined) return undefined;
  const level = binding.keys.length;
  if (level >= depth) return undefined;
  if (level === 0) return stamp(new StateAccessNode(`${binding.name}$len`), location);
  if (level === 1) {
    return stamp(
      new ArrayAccessNode(stamp(new StateAccessNode(`${binding.name}$len$1`), location), bindingKeys(binding)[0]),
      location,
    );
  }
  return undefined;
}

/** `.length` of the array a bound storage pointer aliases. */
export function buildBoundPointerLength(
  binding: StoragePointerBinding, targets: StoragePointerTargets, location: Location | undefined,
): ExpressionNode | undefined {
  return lengthRead(binding, targets, location);
}

/** `push()` on the array a bound storage pointer aliases: raise its count, and reset the pushed element's own. */
export function buildBoundPointerPush(
  binding: StoragePointerBinding, targets: StoragePointerTargets,
  noArg: boolean, location: Location | undefined,
): BlockNode | undefined {
  const read = lengthRead(binding, targets, location);
  if (!read) return undefined;
  if (!noArg) {
    // Solidity: an array whose element is a mapping has no element VALUE to append.
    throw new ParseError('Storage arrays with nested mappings do not support .push(<arg>)', location ?? undefined);
  }
  const one = stamp(new IntLiteralNode(1n), location);
  const block: Node[] = [];
  if (targets.mappingValueArrays.has(binding.name)) {
    const increment = stamp(new BinaryOpNode(read, BinaryOperator.PLUS, one), location);
    block.push(stamp(new MappingAssignNode(`${binding.name}$len`, bindingKeys(binding), increment), location));
  } else {
    const depth = targets.arrayDepth.get(binding.name)!;
    const level = binding.keys.length;
    if (level === 0) {
      // The pushed element starts as a fresh empty inner array: clear its count at the index being created,
      // reading the outer count before it is raised (a scalar read stays clean).
      if (depth > 1) {
        const index = stamp(new StateAccessNode(`${binding.name}$len`), location);
        const zero = stamp(new IntLiteralNode(0n), location);
        block.push(stamp(new StateArrayAssignNode(`${binding.name}$len$1`, index, zero), location));
      }
      const increment = stamp(
        new BinaryOpNode(stamp(new StateAccessNode(`${binding.name}$len`), location), BinaryOperator.PLUS, one),
        location,
      );
      block.push(stamp(new StateAssignNode(`${binding.name}$len`, increment), location));
    } else if (level === 1) {
      const increment = stamp(new BinaryOpNode(lengthRead(binding, targets, location)!, BinaryOperator.PLUS, one), location);
      block.push(stamp(
        new StateArrayAssignNode(`${binding.name}$len$1`, bindingKeys(binding)[0], increment), location,
      ));
    } else {
      return undefined;
    }
  }
  return stamp(new BlockNode(block as never), location);
}

/** `pop()` on the array a bound storage pointer aliases: require a non-empty dimension, then lower its count. */
export function buildBoundPointerPop(
  binding: StoragePointerBinding, targets: StoragePointerTargets, location: Location | undefined,
): BlockNode | undefined {
  const read = lengthRead(binding, targets, location);
  if (!read) return undefined;
  const zero = stamp(new IntLiteralNode(0n), location);
  const one = stamp(new IntLiteralNode(1n), location);
  const guard = stamp(new RequireNode(stamp(new BinaryOpNode(read, BinaryOperator.GT, zero), location)), location);
  const dropped = stamp(new BinaryOpNode(lengthRead(binding, targets, location)!, BinaryOperator.MINUS, one), location);
  const write = targets.mappingValueArrays.has(binding.name)
    ? stamp(new MappingAssignNode(`${binding.name}$len`, bindingKeys(binding), dropped), location)
    : binding.keys.length === 0
      ? stamp(new StateAssignNode(`${binding.name}$len`, dropped), location)
      : stamp(new StateArrayAssignNode(`${binding.name}$len$1`, bindingKeys(binding)[0], dropped), location);
  return stamp(new BlockNode([guard, write]), location);
}

/** `delete` of the array a bound storage pointer aliases: reset its count to zero (the elements stay sparse). */
export function buildBoundPointerDelete(
  binding: StoragePointerBinding, targets: StoragePointerTargets, location: Location | undefined,
): BlockNode | undefined {
  const zero = stamp(new IntLiteralNode(0n), location);
  if (targets.mappingValueArrays.has(binding.name)) {
    return stamp(new BlockNode([
      stamp(new MappingAssignNode(`${binding.name}$len`, bindingKeys(binding), zero), location),
    ]), location);
  }
  if (binding.keys.length !== 0) return undefined;
  const statements: Node[] = [stamp(new StateAssignNode(`${binding.name}$len`, zero), location)];
  if ((targets.arrayDepth.get(binding.name) ?? 1) > 1) {
    statements.push(stamp(new DeleteStateNode(`${binding.name}$len$1`), location));
  }
  return stamp(new BlockNode(statements as never), location);
}

/**
 * Rewrite one node that names a bound storage pointer into the caller's container with the prefix keys in front
 * of its own. Returns undefined when the node does not reference the pointer, so unrelated nodes are untouched.
 */
export function rewriteStoragePointerNode(
  node: Node, binding: StoragePointerBinding, targets: StoragePointerTargets,
): Node | undefined {
  const named = (node as unknown as { name?: unknown }).name;
  const name = typeof named === 'string' ? named : undefined;
  const isBound = name === binding.parameter;
  if (node instanceof ArrayAccessNode && node.array instanceof IdentifierNode && node.array.name === binding.parameter) {
    return rootedAccess(binding, node.index, node.location);
  }
  if (node instanceof TupleIndexOpNode && node.tuple instanceof IdentifierNode
    && node.tuple.name === binding.parameter) {
    const index = new IntLiteralNode(BigInt(node.index));
    index.location = node.location;
    return rootedAccess(binding, index, node.location);
  }
  if (!isBound) return undefined;
  if (node instanceof MappingAccessNode) {
    node.name = binding.name;
    node.keys = [...bindingKeys(binding), ...node.keys];
    return node;
  }
  if (node instanceof MappingAssignNode) {
    node.name = binding.name;
    node.keys = [...bindingKeys(binding), ...node.keys];
    return node;
  }
  if (node instanceof MappingFieldAssignNode) {
    node.name = binding.name;
    node.keys = [...bindingKeys(binding), ...node.keys];
    return node;
  }
  if (node instanceof MappingDeleteNode) {
    node.name = binding.name;
    node.keys = [...bindingKeys(binding), ...node.keys];
    return node;
  }
  if (node instanceof ArrayAssignNode) {
    const replacement = stamp(
      new MappingAssignNode(binding.name, [...bindingKeys(binding), node.index], node.value), node.location,
    );
    return replacement;
  }
  if (node instanceof ArrayDeleteNode) {
    const zero = stamp(new IntLiteralNode(0n), node.location);
    return stamp(new MappingAssignNode(binding.name, [...bindingKeys(binding), node.index], zero), node.location);
  }
  if (node instanceof ArrayPushNode) {
    return buildBoundPointerPush(binding, targets, node.noArg === true, node.location);
  }
  if (node instanceof ArrayPopNode) return buildBoundPointerPop(binding, targets, node.location);
  if (node instanceof DeleteLocalNode) return buildBoundPointerDelete(binding, targets, node.location);
  if (node instanceof StateArrayPushNode) {
    node.name = binding.name;
    return node;
  }
  if (node instanceof StateArrayPopNode) {
    node.name = binding.name;
    return node;
  }
  if (node instanceof StateArrayAssignNode) {
    node.name = binding.name;
    return node;
  }
  if (node instanceof StateArrayDeleteNode) {
    node.name = binding.name;
    return node;
  }
  if (node instanceof StateAssignNode) {
    node.name = binding.name;
    return node;
  }
  return undefined;
}

/** `.length` on `expr` where expr is the pointer or an index chain rooted at it. */
export function rewriteStoragePointerLength(
  expr: ExpressionNode, binding: StoragePointerBinding, targets: StoragePointerTargets,
  location: Location | undefined,
): ExpressionNode | undefined {
  const extended = (keys: ExpressionNode[]): StoragePointerBinding =>
    ({ parameter: binding.parameter, name: binding.name, keys: [...binding.keys, ...keys] });
  if (expr instanceof IdentifierNode && expr.name === binding.parameter) {
    return buildBoundPointerLength(binding, targets, location);
  }
  if (expr instanceof MappingAccessNode && expr.name === binding.parameter) {
    return buildBoundPointerLength(extended(expr.keys), targets, location);
  }
  if (expr instanceof ArrayAccessNode && expr.array instanceof IdentifierNode
    && expr.array.name === binding.parameter) {
    return buildBoundPointerLength(extended([expr.index]), targets, location);
  }
  if (expr instanceof TupleIndexOpNode && expr.tuple instanceof IdentifierNode
    && expr.tuple.name === binding.parameter) {
    const index = new IntLiteralNode(BigInt(expr.index));
    index.location = expr.location;
    return buildBoundPointerLength(extended([index]), targets, location);
  }
  return undefined;
}

/** An index chain `container[k0][k1][tail]`. */
function rootedAccess(
  binding: StoragePointerBinding, tail: ExpressionNode, location: Location | undefined,
): ExpressionNode {
  let expression: ExpressionNode = stamp(new IdentifierNode(binding.name), location);
  for (const key of [...bindingKeys(binding), clampTail(tail)]) {
    expression = stamp(new ArrayAccessNode(expression, key), location);
  }
  return expression;
}

/** A `TupleIndexOpNode` tail carries a literal index; everything else is already an expression. */
function clampTail(tail: ExpressionNode): ExpressionNode {
  return tail instanceof TupleIndexOpNode && tail.tuple instanceof IdentifierNode
    ? new IntLiteralNode(BigInt(tail.index))
    : tail;
}
