/** Refuse a prepared call tree that reaches one state owner more than once. */

import { isDirectConventionArtifact } from './sc-expand-resolve-create-builder-external-calls.js';

/**
 * Two writes to one owner cannot both consume its one master UTXO, and collapsing them into the first call's
 * block can discard the later call's entry layout. Refuse a prepared call tree that reaches an owner twice.
 */
export function refuseRepeatedOwnerCalls(params: {
  preparedCallNodes: any[] | undefined;
  functionName: string;
}): void {
  const { preparedCallNodes, functionName } = params;
  if (!preparedCallNodes?.length) return;
  const children = new Map<number, number[]>();
  preparedCallNodes.forEach((node, index) => {
    if (node.parent === null) return;
    const siblings = children.get(node.parent) ?? [];
    siblings.push(index);
    children.set(node.parent, siblings);
  });
  for (const siblings of children.values()) {
    siblings.sort((left, right) => {
      const a = preparedCallNodes[left].callsiteId ?? Number.MAX_SAFE_INTEGER;
      const b = preparedCallNodes[right].callsiteId ?? Number.MAX_SAFE_INTEGER;
      return a - b || left - right;
    });
  }
  const orderedNodes: any[] = [];
  const visit = (index: number): void => {
    const node = preparedCallNodes[index];
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
  const rootNode = preparedCallNodes[0];
  const rootArtifact = rootNode?.executionArtifact ?? rootNode?.contract.inner.artifact;
  if (rootArtifact !== undefined && isDirectConventionArtifact(rootArtifact)) {
    throw new Error(`${rootArtifact.contractName}.${functionName}() reaches one state owner more than once `
      + 'through the calls its callees make. A direct compile runs repeated calls only through a callee\'s '
      + 'multi-call entry, for the calls a caller makes itself.');
  }
  const participants = orderedNodes.map((node) => {
    const artifact = node.executionArtifact ?? node.contract.inner.artifact;
    return `${artifact.contractName}.${node.functionName}`;
  });
  throw new Error(`${functionName}() reaches one state owner more than once through the calls its callees make `
    + `(${participants.join(', ')}): one call tree cannot spend an owner's master twice.`);
}
