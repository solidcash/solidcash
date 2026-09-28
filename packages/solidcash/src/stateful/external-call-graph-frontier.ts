import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

/** Visit children appended during expansion in their parent's discovery order. */
export async function visitExpandingExternalCallGroups<T>(
  groups: T[], visit: (group: T, index: number) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < groups.length; index += 1) await visit(groups[index], index);
}

/** A static atomic transaction has no finite expansion for an external recursion. */
export function assertAcyclicExternalCallPath(
  groups: readonly Pick<ExternalCallUtxoGroup, 'categoryId' | 'functionName' | 'logicalFunctionName'>[],
  parents: readonly number[],
  parentIndex: number,
  targetCategory: string,
  targetFunction: string,
): void {
  const seen = new Set<number>();
  for (let ancestorIndex = parentIndex; ancestorIndex >= 0;
    ancestorIndex = parents[ancestorIndex] ?? -1) {
    if (seen.has(ancestorIndex)) throw new Error('External-call graph has a cyclic parent relation.');
    seen.add(ancestorIndex);
    const ancestor = groups[ancestorIndex];
    if (ancestor?.categoryId.toLowerCase() === targetCategory.toLowerCase()
      && (ancestor.logicalFunctionName ?? ancestor.functionName) === targetFunction) {
      throw new Error('Recursive external-call graph cannot be materialized.');
    }
  }
}
