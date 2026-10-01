import {
  valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from './value-chunk-persist.js';

type ObservedChunk = {
  offset: number;
  resourceIdentity?: string;
  resourcePart?: string;
};

/** Reconcile a route's provisional scalar witness with exact, resource-owned output bands. */
export function resolveValueChunkWriteGeometry(
  writes: readonly ValueChunkWriteDescriptor[],
  transported: readonly ValueChunkWriteDescriptor[],
  observed: readonly ObservedChunk[],
): ValueChunkWriteDescriptor[] {
  const geometry = new Map<string, { base: number; count: number }>();
  const byResource = new Map<string, Map<number, number>>();
  for (const chunk of observed) {
    if (chunk.resourceIdentity === undefined) continue;
    const part = /^chunk:(0|[1-9][0-9]*)$/.exec(chunk.resourcePart ?? '');
    if (part === null) continue;
    const index = Number(part[1]);
    if (!Number.isSafeInteger(chunk.offset) || chunk.offset < 0 || !Number.isSafeInteger(index)) {
      throw new Error('Kernel value-chunk observation has invalid geometry.');
    }
    const parts = byResource.get(chunk.resourceIdentity) ?? new Map<number, number>();
    const prior = parts.get(index);
    if (prior !== undefined && prior !== chunk.offset) {
      throw new Error(`Kernel value-chunk resource '${chunk.resourceIdentity}' has conflicting output pins.`);
    }
    parts.set(index, chunk.offset);
    byResource.set(chunk.resourceIdentity, parts);
  }
  for (const [identity, parts] of byResource) {
    const base = parts.get(0);
    if (base === undefined) continue;
    const count = parts.size;
    if ([...parts].some(([index, offset]) => index >= count || offset !== base + index)) {
      throw new Error(`Kernel value-chunk resource '${identity}' has a non-contiguous output band.`);
    }
    geometry.set(identity, { base, count });
  }
  // Graph transport is authoritative for the resources it replaces: the isolated builder may still expose
  // a provisional local pin for the same resource, but composition installs the graph's final band.
  const transportedGeometry = new Map<string, { base: number; count: number }>();
  for (const write of transported) {
    const identity = valueChunkWriteResourceIdentity(write);
    const next = { base: write.outputBase, count: write.outputCount };
    if (!Number.isSafeInteger(next.base) || next.base < 0
      || !Number.isSafeInteger(next.count) || next.count < 1) {
      throw new Error(`Kernel transported value-chunk resource '${identity}' has invalid geometry.`);
    }
    const prior = transportedGeometry.get(identity);
    if (prior !== undefined && (prior.base !== next.base || prior.count !== next.count)) {
      throw new Error(`Kernel transported value-chunk resource '${identity}' has conflicting geometry.`);
    }
    transportedGeometry.set(identity, next);
    geometry.set(identity, next);
  }
  return writes.map((write) => {
    const identity = valueChunkWriteResourceIdentity(write);
    const resolved = geometry.get(identity);
    if (resolved !== undefined && !transportedGeometry.has(identity)) {
      // A progressive VM probe can expose only chunk:0 of a wider local value. A contiguous prefix is
      // not proof that the resource ends there; keep the compiler-published width authoritative.
      if (write.outputCount > resolved.count) {
        throw new Error(`Kernel value-chunk resource '${identity}' has an incomplete observed output band.`);
      }
      if (write.outputCount === 0) return write;
    }
    return resolved === undefined ? write : {
      ...write, outputBase: resolved.base, outputCount: resolved.count,
    };
  });
}
