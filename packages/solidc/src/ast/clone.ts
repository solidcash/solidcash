import { Node } from './AST.js';

/**
 * Deep-clone an AST node: child Nodes (and Node arrays) recursively; Maps shallow-copied; class instances (types,
 * locations) by reference. Plain objects that carry Nodes - a call's `{value, gas, salt}` options, a tuple slot
 * `{name, type}` - are cloned too, so a clone never shares a Node with the original: an in-place rename on a
 * shared Node would stomp another clone's rename. Used where the same subtree must appear in more than one
 * position (e.g. storage-pointer aliasing, helper inlining).
 */
export function cloneNode<T extends Node>(node: T): T {
  const clone = Object.create(Object.getPrototypeOf(node));
  for (const [key, value] of Object.entries(node)) {
    clone[key] = cloneValue(value);
  }
  return clone;
}

function cloneValue(value: unknown): unknown {
  if (value instanceof Node) return cloneNode(value);
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value instanceof Map) return new Map(value);
  // Only plain objects (constructor === Object) are cloned; class instances (Type, Location) stay shared - they
  // are not mutated by the rename passes and cloning them would strip their prototype.
  if (value && typeof value === 'object' && (value as object).constructor === Object) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) obj[k] = cloneValue(v);
    return obj;
  }
  return value;
}
