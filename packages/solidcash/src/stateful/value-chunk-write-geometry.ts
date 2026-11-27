import {
  valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from './value-chunk-persist.js';

type ObservedChunk = {
  offset: number;
  resourceIdentity?: string;
  resourcePart?: string;
};

/** Keep a previously derived per-resource band only when every chunk in that band was observed exactly. */
export function retainCompleteObservedValueChunkWriteGeometry(
  described: readonly ValueChunkWriteDescriptor[],
  previous: readonly ValueChunkWriteDescriptor[],
  observed: readonly ObservedChunk[],
): ValueChunkWriteDescriptor[] {
  return described.map((write) => {
    const identity = valueChunkWriteResourceIdentity(write);
    const matching = previous.filter((candidate) => valueChunkWriteResourceIdentity(candidate) === identity);
    if (matching.length !== 1) return write;
    const prior = matching[0]!;
    if (prior.collection !== write.collection || prior.collectionSignature !== write.collectionSignature
      || prior.collectionHash !== write.collectionHash || prior.keySlot !== write.keySlot
      || prior.categoryId !== write.categoryId || prior.entryAccessSlot !== write.entryAccessSlot
      || prior.routeSlot !== write.routeSlot || prior.operation !== write.operation
      || !Number.isSafeInteger(prior.outputBase) || prior.outputBase < 0
      || !Number.isSafeInteger(prior.outputCount) || prior.outputCount < 1) return write;
    const parts = observed.filter((chunk) => chunk.resourceIdentity === identity
      && /^chunk:(0|[1-9][0-9]*)$/u.test(chunk.resourcePart ?? ''));
    if (parts.length !== prior.outputCount || parts.some((chunk) => {
      const index = Number(chunk.resourcePart!.slice('chunk:'.length));
      return !Number.isSafeInteger(index) || index >= prior.outputCount
        || chunk.offset !== prior.outputBase + index;
    })) return write;
    return { ...write, outputBase: prior.outputBase, outputCount: prior.outputCount };
  });
}
