import { Node } from './AST.js';
import { YulNode } from './YulAST.js';

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
  // Preserve INTRA-node aliasing of a MethodCallStatementNode's `.call` and `.expression`: post-first-traversal they
  // are the SAME object (visitMethodCallStatement sets `.expression = visit(.call)`, and visitors mutate in place).
  // Cloning them independently desyncs a later target rewrite (SynthesizeExternalAddressLocals rewrites `.expression`
  // while SymbolTableTraversal re-derives from the stale `.call`), losing an interface-cast co-spend target. Re-alias
  // the clone's `.expression` to its `.call` so both stay one object (the clone still shares nothing with the original).
  const n = node as unknown as { call?: unknown; expression?: unknown };
  if (n.call instanceof Node && n.call === n.expression) {
    (clone as { expression?: unknown }).expression = (clone as { call?: unknown }).call;
  }
  return clone;
}

function cloneValue(value: unknown): unknown {
  if (value instanceof Node) return cloneNode(value);
  // AssemblyStatementNode owns a parallel Yul AST whose nodes do not inherit from the high-level Node class.
  // Treat it as an AST subtree too: inheritance/helper cloning followed by an in-place Yul rename must not mutate
  // the source contract's assembly (LowerMemoryModel otherwise renamed both copies but materialized a buffer in
  // only one, leaving the other with an undefined __memb_* reference).
  if (value instanceof YulNode) {
    const clone = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>;
    for (const [key, child] of Object.entries(value)) clone[key] = cloneValue(child);
    return clone;
  }
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
