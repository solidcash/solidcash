import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

/** Visit children appended during expansion in their parent's discovery order. */
export async function visitExpandingExternalCallGroups<T>(
  groups: T[], visit: (group: T, index: number) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < groups.length; index += 1) await visit(groups[index], index);
}

/** Keep discovery ancestry separate from carriers that later writes may retarget. */
export function snapshotExternalCallFrontier<T extends object, U>(
  groups: readonly T[], parents: readonly number[], callsites: readonly U[],
): { groups: T[]; parents: number[]; callsites: U[] } {
  return {
    groups: groups.map((group) => ({ ...group })),
    parents: [...parents],
    callsites: [...callsites],
  };
}

/** A shared physical carrier may be retargeted by a descendant without changing its logical ancestry. */
export function wouldCreateExternalCallParentCycle(
  parents: readonly number[], groupIndex: number, candidateParentIndex: number,
): boolean {
  const seen = new Set<number>();
  for (let ancestorIndex = candidateParentIndex; ancestorIndex >= 0;
    ancestorIndex = parents[ancestorIndex] ?? -1) {
    if (ancestorIndex === groupIndex) return true;
    if (seen.has(ancestorIndex)) throw new Error('External-call graph has a cyclic parent relation.');
    seen.add(ancestorIndex);
  }
  return false;
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
