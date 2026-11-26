/**
 * phase-boundary extract: SC _createBuilder extract — refuse a prepared call tree that reaches one state
 * owner more than once.
 */

import { isDirectConventionArtifact } from './sc-expand-resolve-create-builder-external-calls.js';

/**
 * Two writes to one owner cannot both consume its one master UTXO, and collapsing them into the first call's
 * block can discard the later call's entry layout. Refuse a prepared call tree that reaches an owner twice.
 */
export function finishCreateBuilderAtomicPromotion(params: {
  preparedAtomicNodes: any[] | undefined;
  functionName: string;
}): void {
  const { preparedAtomicNodes, functionName } = params;
  if (!preparedAtomicNodes?.length) return;
  const children = new Map<number, number[]>();
  preparedAtomicNodes.forEach((node, index) => {
    if (node.parent === null) return;
    const siblings = children.get(node.parent) ?? [];
    siblings.push(index);
    children.set(node.parent, siblings);
  });
  for (const siblings of children.values()) {
    siblings.sort((left, right) => {
      const a = preparedAtomicNodes[left].callsiteId ?? Number.MAX_SAFE_INTEGER;
      const b = preparedAtomicNodes[right].callsiteId ?? Number.MAX_SAFE_INTEGER;
      return a - b || left - right;
    });
  }
  const orderedNodes: any[] = [];
  const visit = (index: number): void => {
    const node = preparedAtomicNodes[index];
    if (!node) return;
    orderedNodes.push(node);
    for (const child of children.get(index) ?? []) visit(child);
  };
  visit(0);

  const ownerInvocationCounts = new Map<string, number>();
  for (const node of orderedNodes) {
    const owner = `${node.contract.categoryId.toLowerCase()}:${node.contract.inner.lockingBytecode.toLowerCase()}`;
    ownerInvocationCounts.set(owner, (ownerInvocationCounts.get(owner) ?? 0) + 1);
  }
  if (![...ownerInvocationCounts.values()].some((count) => count > 1)) return;
  const rootNode = preparedAtomicNodes[0];
  const rootArtifact = rootNode?.executionArtifact ?? rootNode?.contract.inner.artifact;
  if (rootArtifact !== undefined && isDirectConventionArtifact(rootArtifact)) {
    throw new Error(`${rootArtifact.contractName}.${functionName}() reaches one state owner more than once `
      + 'through the calls its callees make. A direct compile runs repeated calls only through a callee\'s '
      + 'multi-call entry, for the calls a caller makes itself, and is never composed on the '
      + 'route.');
  }
  const directOnly = orderedNodes.map((node) => {
    const artifact = node.executionArtifact ?? node.contract.inner.artifact;
    return `${artifact.contractName}.${node.functionName}`;
  });
  throw new Error(
    'route: repeated-owner calls require atomic composition, but the prepared graph contains '
    + `direct-only participant${directOnly.length === 1 ? '' : 's'}: ${directOnly.join(', ')}. `
    + 'This direct/journal graph lacks the explicit V5 authority or an eligible direct-call shape.',
  );
}
