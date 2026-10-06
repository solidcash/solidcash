import { CompilerOptions } from '@solidcash/utils';
import { FunctionCallNode, FunctionDefinitionNode, Node } from '../ast/AST.js';
import { GlobalFunction } from '../ast/Globals.js';

const SKIPPED_KEYS = new Set([
  'type', 'symbolTable', 'location', 'resolvedFunction', 'functionReference', 'definition', 'referencedContract',
  'stateVariable', 'collection', 'sourceCallNode', 'sourceActivationConditions',
]);

function walk(root: Node, visit: (node: Node) => boolean): boolean {
  const seen = new Set<Node>();
  const pending: Node[] = [root];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (seen.has(node)) continue;
    seen.add(node);
    if (visit(node)) return true;
    for (const key of Object.keys(node)) {
      if (SKIPPED_KEYS.has(key)) continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (value instanceof Node) pending.push(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) pending.push(item);
    }
  }
  return false;
}

/**
 * Whether `fn` checks a transaction signature (checkSig, checkMultiSig), directly or through a function it calls.
 * Such a check covers the bytecode of the body it runs in: OP_INVOKE makes a subroutine's own body the covered
 * bytecode, while the SDK signs over the entry point's body. A checkDataSig signs a message and is unaffected.
 */
export function checksTransactionSignature(
  fn: FunctionDefinitionNode, functionsByName: ReadonlyMap<string, FunctionDefinitionNode>,
  visiting: Set<FunctionDefinitionNode> = new Set(),
): boolean {
  if (!fn.body || visiting.has(fn)) return false;
  visiting.add(fn);
  return walk(fn.body, (node) => {
    if (!(node instanceof FunctionCallNode)) return false;
    const name = node.identifier?.name;
    if (name === GlobalFunction.CHECKSIG || name === GlobalFunction.CHECKMULTISIG) return true;
    const callee = name === undefined ? undefined : functionsByName.get(name);
    return callee !== undefined && callee !== fn && checksTransactionSignature(callee, functionsByName, visiting);
  });
}

/**
 * Whether the helper inliners keep transaction-signature checks in the entry point, which is what the SDK signs.
 * A message-bus build does not: it keeps such a helper behind OP_INVOKE and publishes that body for each signature
 * its route takes. A framed artifact carries no route, so its helpers are inlined as in a direct build.
 */
export function inlinesSignatureChecks(options: CompilerOptions): boolean {
  return options.messageBus !== true || options.composition === 'framed';
}

/** The names that the given bodies call directly. */
export function namesCalledFrom(functions: readonly (FunctionDefinitionNode | undefined)[]): Set<string> {
  const names = new Set<string>();
  for (const fn of functions) {
    if (!fn?.body) continue;
    walk(fn.body, (node) => {
      if (node instanceof FunctionCallNode && node.identifier?.name !== undefined) names.add(node.identifier.name);
      return false;
    });
  }
  return names;
}
