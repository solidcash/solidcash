import { BoolLiteralNode, IdentifierNode, IntLiteralNode, Node } from './AST.js';
import { YulNode } from './YulAST.js';

/**
 * Deep-clone an AST node: child Nodes (and Node arrays) recursively; Maps shallow-copied; class instances (types,
 * locations) by reference. Plain objects that carry Nodes - a call's `{value, gas, salt}` options, a tuple slot
 * `{name, type}` - are cloned too, so a clone never shares a Node with the original: an in-place rename on a
 * shared Node would stomp another clone's rename. Used where the same subtree must appear in more than one
 * position (e.g. storage-pointer aliasing, helper inlining).
 */
export function cloneNode<T extends Node>(node: T): T {
  return cloneNodeWithMemo(node, new WeakMap<object, unknown>());
}

/** Deep-clone an AST while replacing selected nodes before their subtrees are observed or copied. */
export function cloneNodeReplacing<T extends Node>(
  node: T,
  replacer: (candidate: Node) => Node | undefined,
): T {
  return cloneNodeWithMemo(node, new WeakMap<object, unknown>(), replacer);
}

function cloneNodeWithMemo<T extends Node>(
  node: T,
  memo: WeakMap<object, unknown>,
  replacer?: (candidate: Node) => Node | undefined,
): T {
  const replacement = replacer?.(node);
  if (replacement && replacement !== node) {
    return cloneNodeWithMemo(replacement, memo) as T;
  }
  const existing = memo.get(node);
  if (existing) return existing as T;
  if (node instanceof IdentifierNode) {
    const clone = Object.create(Object.getPrototypeOf(node)) as IdentifierNode;
    memo.set(node, clone);
    clone.name = node.name;
    clone.location = node.location;
    clone.type = node.type;
    clone.definition = node.definition;
    clone.functionReference = node.functionReference;
    clone.isExternalSelfRef = node.isExternalSelfRef;
    clone.storagePointerOnly = node.storagePointerOnly;
    clone.fromModifier = node.fromModifier;
    memo.delete(node);
    return clone as unknown as T;
  }
  if (node instanceof IntLiteralNode) {
    const clone = Object.create(Object.getPrototypeOf(node)) as IntLiteralNode;
    memo.set(node, clone);
    clone.value = node.value;
    clone.location = node.location;
    clone.type = node.type;
    memo.delete(node);
    return clone as unknown as T;
  }
  if (node instanceof BoolLiteralNode) {
    const clone = Object.create(Object.getPrototypeOf(node)) as BoolLiteralNode;
    memo.set(node, clone);
    clone.value = node.value;
    clone.location = node.location;
    clone.type = node.type;
    memo.delete(node);
    return clone as unknown as T;
  }
  const clone = Object.create(Object.getPrototypeOf(node));
  memo.set(node, clone);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'resolvedFunction' || key === 'functionReference' || key === 'definition' || key === 'symbolTable' || key === 'referencedContract' || key === 'stateVariable' || key === 'collection' || key === 'type' || key === 'location') { clone[key] = value; continue; }
    clone[key] = cloneValue(value, memo, replacer);
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
  memo.delete(node);
  return clone;
}

function cloneValue(
  value: unknown,
  memo: WeakMap<object, unknown>,
  replacer?: (candidate: Node) => Node | undefined,
): unknown {
  if (value instanceof Node) return cloneNodeWithMemo(value, memo, replacer);
  // AssemblyStatementNode owns a parallel Yul AST whose nodes do not inherit from the high-level Node class.
  // Treat it as an AST subtree too: inheritance/helper cloning followed by an in-place Yul rename must not mutate
  // the source contract's assembly (LowerMemoryModel otherwise renamed both copies but materialized a buffer in
  // only one, leaving the other with an undefined __memb_* reference).
  if (value instanceof YulNode) {
    const existing = memo.get(value);
    if (existing) return existing;
    const clone = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>;
    memo.set(value, clone);
    for (const [key, child] of Object.entries(value)) clone[key] = cloneValue(child, memo, replacer);
    memo.delete(value);
    return clone;
  }
  if (Array.isArray(value)) {
    const existing = memo.get(value);
    if (existing) return existing;
    const clone: unknown[] = [];
    memo.set(value, clone);
    for (const child of value) clone.push(cloneValue(child, memo, replacer));
    memo.delete(value);
    return clone;
  }
  if (value instanceof Map) return new Map(value);
  // Only plain objects (constructor === Object) are cloned; class instances (Type, Location) stay shared - they
  // are not mutated by the rename passes and cloning them would strip their prototype.
  if (value && typeof value === 'object' && (value as object).constructor === Object) {
    const existing = memo.get(value as object);
    if (existing) return existing;
    const obj: Record<string, unknown> = {};
    memo.set(value as object, obj);
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      obj[k] = cloneValue(v, memo, replacer);
    }
    memo.delete(value as object);
    return obj;
  }
  return value;
}
