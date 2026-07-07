import {
  FunctionDefinitionNode, Node, IdentifierNode, FunctionCallNode,
} from '../ast/AST.js';

// Constructor parameters are baked into the redeem script and land on the stack only at an entry point; an
// OP_INVOKE subroutine's stack carries only its declared args. So an internal/private helper that reads a ctor
// param - directly, or transitively by calling another such helper (which the inline passes splice into its
// body) - cannot compile as a subroutine and must inline into its caller. This computes that transitive set,
// shared by the value-returning (InlineReturningStateHelpers) and void (InlineExternalCallHelpers) inline passes.

// Pre-order walk over child Nodes (and Node arrays); skips Type/symbol-table/location fields.
function walk(node: Node | undefined, visit: (n: Node) => void): void {
  if (!node) return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
    const v = (node as unknown as Record<string, unknown>)[key];
    if (v instanceof Node) walk(v, visit);
    else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) walk(it, visit);
  }
}

// True if the function body directly references a ctor param. A same-named parameter shadows it (then the body
// reads that param). Inlining preserves semantics, so match by name liberally: a false positive inlines
// needlessly, a miss would crash codegen ("Expected variable X does not exist on the stack") in the subroutine.
function directlyReadsCtorParam(fn: FunctionDefinitionNode, ctorParamNames: Set<string>): boolean {
  const shadowed = new Set(fn.parameters.map((p) => p.name));
  let found = false;
  walk(fn.body, (n) => {
    if (found || !(n instanceof IdentifierNode)) return;
    const head = n.name.includes('.') ? n.name.slice(0, n.name.indexOf('.')) : n.name;
    if (ctorParamNames.has(head) && !shadowed.has(head)) found = true;
  });
  return found;
}

/**
 * The names of internal/private/free functions that (directly or transitively via a call to another member)
 * read a constructor parameter, and so must be inlined rather than compiled as OP_INVOKE subroutines. Entry
 * points are excluded - they are never inlined; they receive the inlined helpers.
 */
export function collectCtorParamReaders(
  functions: FunctionDefinitionNode[], ctorParamNames: Set<string>,
): Set<string> {
  if (ctorParamNames.size === 0) return new Set();
  const inlinable = functions.filter(
    (f) => f.body && (f.isFreeFunction || f.visibility === 'internal' || f.visibility === 'private'),
  );
  const readers = new Set<string>();
  for (const fn of inlinable) if (directlyReadsCtorParam(fn, ctorParamNames)) readers.add(fn.name);
  // Fixpoint: a helper that calls a member of the set will have it spliced in, so it becomes a reader too.
  let changed = true;
  while (changed) {
    changed = false;
    for (const fn of inlinable) {
      if (readers.has(fn.name)) continue;
      let callsReader = false;
      walk(fn.body, (n) => {
        if (!callsReader && n instanceof FunctionCallNode && readers.has(n.identifier.name)) callsReader = true;
      });
      if (callsReader) { readers.add(fn.name); changed = true; }
    }
  }
  return readers;
}
