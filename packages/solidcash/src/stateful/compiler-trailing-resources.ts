/** Fixed order of compiler-owned trailing outputs, with no gaps for empty resource families. */
export function planCompilerTrailingResources(input: {
  trailingBase: number;
  batchPredecessorCount: number;
  dynamicChunkCount: number;
  collectionValueChunkCount: number;
}): {
  batchPredecessorBase: number;
  dynamicChunkBase: number;
  collectionValueChunkBase: number;
  end: number;
} {
  const counts = [input.trailingBase, input.batchPredecessorCount, input.dynamicChunkCount,
    input.collectionValueChunkCount];
  if (counts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error('Compiler trailing resource coordinates must be non-negative safe integers');
  }
  const dynamicChunkBase = input.trailingBase + input.batchPredecessorCount;
  const collectionValueChunkBase = dynamicChunkBase + input.dynamicChunkCount;
  const end = collectionValueChunkBase + input.collectionValueChunkCount;
  if (![dynamicChunkBase, collectionValueChunkBase, end].every(Number.isSafeInteger)) {
    throw new Error('Compiler trailing resource coordinates must be non-negative safe integers');
  }
  return {
    batchPredecessorBase: input.trailingBase, dynamicChunkBase, collectionValueChunkBase, end,
  };
}

type PhysicalGroup = {
  blockLayout?: { blockSize: number; trailingBase?: number };
  sharedGroupIndex?: number;
  delegateCallGroupIndex?: number;
  delegateEmbeddedInBlock?: boolean;
  collectionValueWrites?: readonly unknown[];
  valueChunkOutputCount?: number;
};

/** Bind each collection-value write to the physical owner and executing delegate's trailing frame. */
export function collectionValuePhysicalBindings<E extends PhysicalGroup, L extends PhysicalGroup>(input: {
  externalGroups: readonly E[];
  lowLevelGroups: readonly L[];
  externalMaster: (index: number) => number;
  lowLevelMaster: (index: number) => number;
}): Array<{
  writeGroup: E; owner: E; executor: E | L;
  ownerMaster: number; executorMaster: number; start: number;
}> {
  return input.externalGroups.flatMap((writeGroup, writeIndex) => {
    if (!writeGroup.collectionValueWrites?.length) return [];
    const ownerIndex = writeGroup.sharedGroupIndex ?? writeIndex;
    const owner = input.externalGroups[ownerIndex];
    if (!owner) throw new Error(`Collection-value write has no physical owner group ${ownerIndex}`);
    const delegateIndex = owner.delegateCallGroupIndex;
    const executor = delegateIndex === undefined ? owner : input.lowLevelGroups[delegateIndex];
    if (!executor) throw new Error(`Collection-value write has no delegate executor ${delegateIndex}`);
    const ownerMaster = input.externalMaster(ownerIndex);
    const executorMaster = delegateIndex === undefined ? ownerMaster : input.lowLevelMaster(delegateIndex);
    const trailingBase = owner.delegateEmbeddedInBlock
      ? owner.blockLayout?.trailingBase : executor.blockLayout?.trailingBase;
    if (![ownerMaster, executorMaster, trailingBase].every((value) =>
      value !== undefined && Number.isSafeInteger(value) && value >= 0)) {
      throw new Error('Collection-value write has no exact physical trailing frame');
    }
    const start = (owner.delegateEmbeddedInBlock ? ownerMaster : executorMaster) + trailingBase!;
    if (!Number.isSafeInteger(start)) throw new Error('Collection-value write trailing coordinate is not exact');
    return [{ writeGroup, owner, executor, ownerMaster, executorMaster, start }];
  });
}
