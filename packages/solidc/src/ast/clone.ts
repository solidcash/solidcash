import { Node } from './AST.js';

/**
 * Deep-clone an AST node. Child Nodes and arrays of Nodes are cloned recursively; Maps are shallow-copied;
 * primitives and other values are copied by reference. Used where the same subtree must appear in more than
 * one position (e.g. inheritance expansion, storage-pointer alias substitution).
 */
export function cloneNode<T extends Node>(node: T): T {
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
