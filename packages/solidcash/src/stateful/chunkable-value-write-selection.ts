/**
 * phase-boundary extract: Chunkable value-write group selection / legacy permits.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  computeCollectionHash,
  type AbiFunction,
  type Artifact,
  type FunctionBlockLayout,
  type StateLayout,
} from '@solidcash/utils';
import {
  canonicalValueChunkProducerResourceClaim,
  canonicalValueChunkProducerResourceIdentity,
  canonicalValueChunkResourceOwnerIdentity,
  canonicalValueChunkStateOwner,
  type ValueChunkProducerResourceClaim,
} from './ValueChunkProducerIdentity.js';
import type { ValueChunkWriteDescriptor } from './value-chunk-persist.js';
import { valueChunkWriteResourceIdentity } from './value-chunk-persist.js';

/** Resolve the one active chunkable dynamic-value collection written by a composed group.
 * Route rows are authoritative when present; a route-level active-write filter narrows union-shaped handlers.
 * Ambiguous metadata fails closed rather than selecting a collection by source-level name. */
export type ChunkableValueWriteGroup = {
  categoryId?: string;
  functionName?: string;
  logicalFunctionName?: string;
  stateLayout?: StateLayout;
  blockLayout?: FunctionBlockLayout;
  logicalArtifact?: Artifact;
  externalContract?: { inner?: { artifact?: Artifact } };
  compilerRoute?: {
    abiFunction?: AbiFunction;
    rowArguments?: readonly { handler: AbiFunction }[];
  };
  valueChunkWrites?: readonly ValueChunkWriteDescriptor[];
  valueChunkProducerClaims?: readonly ValueChunkProducerResourceClaim[];
  valueChunkStateOwner?: { categoryId: string; lockingBytecode: string };
  delegateCallGroupIndex?: number;
  sharedGroupIndex?: number;
  callMode?: 'call' | 'staticcall' | 'delegatecall';
  /** Legacy planners can publish the concrete continuation region without publishing entry-effect metadata. */
  valueChunkOutputBase?: number;
  valueChunkOutputCount?: number;
};

/**
 * Old message-bus plans identified the chunkable writer by application ABI names because their artifacts did
 * not publish resource descriptors. Keep that migration path out of the kernel convention: once an artifact
 * declares `kernel-row-loop`, missing descriptors mean "not described", never permission to guess from names.
 */
export function permitsLegacyNamedValueChunkFallback(
  groups: ReadonlyArray<ChunkableValueWriteGroup>,
  ownerConvention?: 'legacy-unroll' | 'kernel-row-loop',
): boolean {
  if (ownerConvention === 'kernel-row-loop') return false;
  return !groups.some((group) => {
    const artifacts = [group.logicalArtifact, group.externalContract?.inner?.artifact];
    return artifacts.some((artifact) => artifact?.messageBus?.convention === 'kernel-row-loop');
  });
}

/** Permit inferred event reconstruction only for descriptor-free pre-kernel plans. */
export function permitsLegacyValueChunkEventReconstruction(
  groups: ReadonlyArray<ChunkableValueWriteGroup>,
  hasChunkableValueWriteMetadata: boolean,
  ownerConvention?: 'legacy-unroll' | 'kernel-row-loop',
): boolean {
  return !hasChunkableValueWriteMetadata
    && permitsLegacyNamedValueChunkFallback(groups, ownerConvention);
}

/** Legacy delegate event placement is unavailable once either the artifact or the active layout owns the frame. */
export function permitsLegacyDelegateEventRepair(
  groups: ReadonlyArray<ChunkableValueWriteGroup>, compilerOwnedDelegateBlock: boolean,
  ownerConvention?: 'legacy-unroll' | 'kernel-row-loop',
): boolean {
  return !compilerOwnedDelegateBlock
    && permitsLegacyNamedValueChunkFallback(groups, ownerConvention);
}

export function groupChunkableValueWriteCollections(group: ChunkableValueWriteGroup): string[] {
  const route = group.compilerRoute;
  const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
  const directName = group.logicalFunctionName ?? group.functionName;
  const direct = artifact?.abi?.find((candidate) => candidate.name === directName);
  const activeFunctions = route?.rowArguments?.length
    ? route.rowArguments.map((row) => row.handler)
    : route?.abiFunction ? [route.abiFunction] : direct ? [direct] : [];
  const activeWriteCollections = (route?.abiFunction as (AbiFunction & {
    messageBusActiveWriteCollections?: readonly string[];
  }) | undefined)?.messageBusActiveWriteCollections;
  const collections = group.stateLayout?.collections ?? artifact?.stateLayout?.collections ?? [];
  const matches = new Set<string>();
  for (const handler of activeFunctions) {
    for (const access of handler.entryAccesses ?? []) {
      const collection = collections.find((candidate) => (
        candidate.name === access.collection || candidate.signature === access.collection
      ));
      const active = activeWriteCollections === undefined || activeWriteCollections.some((candidate) => (
        candidate === access.collection || candidate === collection?.name || candidate === collection?.signature
      ));
      if (!access.operations.includes('write') || !active) continue;
      if (access.chunkableArrayValue === true || collection?.chunkableValue === true) {
        matches.add(collection?.name ?? access.collection);
      }
    }
  }
  return [...matches];
}

export function groupChunkableValueWriteCollection(
  group: ChunkableValueWriteGroup,
): string | undefined {
  const matches = groupChunkableValueWriteCollections(group);
  return matches.length === 1 ? matches[0] : undefined;
}

/** Resolve a compiler-described collection from an authenticated producer/resource claim before entry geometry
 * is materialized. This is intentionally narrower than collection capability inference: one canonical resource,
 * its exact state owner, and one matching compiler write collection must all agree. */
export function claimedChunkableValueWriteCollection(
  group: ChunkableValueWriteGroup,
): string | undefined {
  return claimedChunkableValueWriteResource(group)?.collection;
}

type ClaimedChunkableValueWriteResource = {
  collection: string;
  resourceIdentity: string;
  resourceOwnerIdentity: string;
};

/** Resolve the exact authenticated storage resource represented by a pre-geometry carrier. */
export function claimedChunkableValueWriteResource(
  group: ChunkableValueWriteGroup,
): ClaimedChunkableValueWriteResource | undefined {
  const claims = group.valueChunkProducerClaims;
  const expectedOwner = group.valueChunkStateOwner;
  if (!claims?.length || !expectedOwner) return undefined;
  const stateOwnerIdentity = canonicalValueChunkStateOwner(expectedOwner);
  if (!stateOwnerIdentity) return undefined;
  const canonicalClaims = claims.map(canonicalValueChunkProducerResourceClaim);
  if (canonicalClaims.some((claim) => claim === undefined)) return undefined;
  const resources = new Set(canonicalClaims.map((claim) => claim!.resourceIdentity));
  if (resources.size !== 1) return undefined;
  const resourceIdentity = [...resources][0];
  const [categoryId, collectionHash] = resourceIdentity.split(':');
  if (categoryId !== expectedOwner.categoryId.toLowerCase()) return undefined;
  const resourceOwnerIdentity = canonicalValueChunkResourceOwnerIdentity(resourceIdentity, expectedOwner);
  if (!resourceOwnerIdentity) return undefined;
  for (const claim of canonicalClaims) {
    if (canonicalValueChunkStateOwner(claim!.producer.stateOwner) !== stateOwnerIdentity) return undefined;
  }
  const declared = groupChunkableValueWriteCollections(group);
  const layouts = [group.stateLayout, group.logicalArtifact?.stateLayout,
    group.externalContract?.inner?.artifact?.stateLayout]
    .filter((layout): layout is StateLayout => layout !== undefined);
  const matches = new Set<string>();
  for (const name of declared) {
    for (const layout of layouts) {
      const collection = layout.collections?.find((candidate) => (
        candidate.name === name || candidate.signature === name
      ));
      if (collection && binToHex(computeCollectionHash(collection.signature)) === collectionHash) {
        matches.add(collection.name);
      }
    }
  }
  return matches.size === 1 ? {
    collection: [...matches][0],
    resourceIdentity,
    resourceOwnerIdentity,
  } : undefined;
}

export type ChunkableValueWriteResource = {
  collection: string;
  resourceIdentity?: string;
  resourceOwnerIdentity?: string;
};

export function groupChunkableValueWriteResource(
  group: ChunkableValueWriteGroup,
): ChunkableValueWriteResource | undefined {
  if ((group.valueChunkWrites?.length ?? 0) > 1) return undefined;
  if (group.valueChunkWrites?.length === 1) {
    const write = group.valueChunkWrites[0];
    const resourceIdentity = canonicalValueChunkProducerResourceIdentity(
      valueChunkWriteResourceIdentity(write),
    );
    if (!resourceIdentity) return undefined;
    // A concrete descriptor is still sufficient for direct execution selection. Exact owner/resource matching
    // across delegate aliases additionally requires a canonical transported claim below.
    const claimed = claimedChunkableValueWriteResource(group);
    if (claimed && claimed.resourceIdentity !== resourceIdentity) return undefined;
    return {
      collection: write.collection,
      resourceIdentity: claimed?.resourceIdentity ?? resourceIdentity,
      resourceOwnerIdentity: claimed?.resourceOwnerIdentity
        ?? (group.valueChunkStateOwner
          ? canonicalValueChunkResourceOwnerIdentity(resourceIdentity, group.valueChunkStateOwner) : undefined),
    };
  }
  if (groupOwnsLinearSortedBatch(group)) return undefined;
  const claimed = claimedChunkableValueWriteResource(group);
  if (claimed) return claimed;
  if (!permitsLegacyNamedValueChunkFallback([group])) return undefined;
  const collection = groupChunkableValueWriteCollection(group)
    ?? legacyPlannedChunkableValueWriteCollection(group);
  return collection === undefined ? undefined : { collection };
}

export function groupWritesSingleChunkableValueCollection(group: Parameters<
  typeof groupChunkableValueWriteCollection
>[0]): boolean {
  return groupChunkableValueWriteCollection(group) !== undefined;
}

/** @deprecated Use the value-type-general helper. */
export const groupChunkableArrayWriteCollection = groupChunkableValueWriteCollection;
/** @deprecated Use the value-type-general helper. */
export const groupWritesSingleChunkableArrayCollection = groupWritesSingleChunkableValueCollection;

export function groupDeclaredAbiFunction(group: ChunkableValueWriteGroup): AbiFunction | undefined {
  const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
  const directName = group.logicalFunctionName ?? group.functionName;
  return group.compilerRoute?.abiFunction
    ?? artifact?.abi.find((candidate: AbiFunction) => candidate.name === directName);
}

/** Linear sorted batches mint in-block vmap nodes, not a single continuation band. */
export function groupOwnsLinearSortedBatch(group: ChunkableValueWriteGroup): boolean {
  return (groupDeclaredAbiFunction(group)?.sortedBatchInfo ?? [])
    .some((batch) => batch.linear === true);
}

export function groupChunkableValueWriteIdentity(group: ChunkableValueWriteGroup): string | undefined {
  return groupChunkableValueWriteResource(group)?.collection;
}

export function sameChunkableValueWriteResource(
  expected: ChunkableValueWriteResource,
  group: ChunkableValueWriteGroup,
): boolean {
  const actual = groupChunkableValueWriteResource(group);
  if (!actual) return false;
  if (expected.resourceOwnerIdentity !== undefined || actual.resourceOwnerIdentity !== undefined) {
    return expected.resourceOwnerIdentity !== undefined
      && expected.resourceOwnerIdentity === actual.resourceOwnerIdentity;
  }
  if (expected.resourceIdentity !== undefined || actual.resourceIdentity !== undefined) {
    return expected.resourceIdentity !== undefined
      && expected.resourceIdentity === actual.resourceIdentity;
  }
  return expected.collection === actual.collection;
}

/**
 * Recover a descriptor-free legacy writer only when its already-planned transaction geometry proves the role.
 *
 * A continuation output base/count (or derived continuation output) is stronger than an application ABI name:
 * it is produced only after the planner has identified a chunked value write. The remaining checks bind that
 * region to one entry-bearing stateful function and one possible chunkable array collection. Any ambiguity is
 * deliberately left unresolved, allowing the caller to fail closed or use the historical named migration path.
 */
export function legacyPlannedChunkableValueWriteCollection(
  group: ChunkableValueWriteGroup,
): string | undefined {
  if (!Number.isSafeInteger(group.valueChunkOutputCount) || group.valueChunkOutputCount! <= 0) {
    return undefined;
  }
  if (!permitsLegacyNamedValueChunkFallback([group])) return undefined;
  const routeFunction = group.compilerRoute?.abiFunction;
  if ((routeFunction as (AbiFunction & { messageBusConvention?: string }) | undefined)
    ?.messageBusConvention === 'kernel-row-loop') return undefined;
  const artifacts = [group.logicalArtifact, group.externalContract?.inner?.artifact]
    .filter((artifact, index, all): artifact is Artifact => artifact !== undefined
      && all.indexOf(artifact) === index);
  const logicalName = group.logicalFunctionName ?? group.functionName;
  const namedFunctions = routeFunction ? [routeFunction] : artifacts.flatMap((artifact) => (
    (artifact.abi as readonly AbiFunction[]).filter((candidate) => candidate.name === logicalName)
  ));
  const identities = new Set(namedFunctions.map((candidate) => (
    `${candidate.selector ?? ''}:${candidate.inputs.map((input) => input.type).join(',')}`
  )));
  if (namedFunctions.length === 0 || identities.size !== 1) return undefined;
  if (namedFunctions.some((candidate) => (
    candidate.writesState === false
    || !candidate.inputs.some((input) => input.name === '__internal__valueChunkOutputBase')
    || !(candidate.blockLayout ?? group.blockLayout)?.slots.some((slot) => slot.kind === 'entry')
  ))) return undefined;

  const layouts = [group.stateLayout, ...artifacts.map((artifact) => artifact.stateLayout)]
    .filter((layout, index, all): layout is StateLayout => layout !== undefined
      && all.indexOf(layout) === index);
  const collectionsByLayout = layouts.map((layout) => (layout.collections ?? []).filter((collection) => (
    collection.chunkableValue === true && collection.valueType.endsWith('[]')
  )));
  if (collectionsByLayout.length === 0 || collectionsByLayout.some((collections) => collections.length !== 1)) {
    return undefined;
  }
  const collectionNames = new Set(collectionsByLayout.map(([collection]) => collection.name));
  return collectionNames.size === 1 ? collectionsByLayout[0][0].name : undefined;
}

/** Resolve a single physical chunkable-value writer from compiler metadata, independent of ABI names. */
export function selectChunkableValueWriteExecution(
  candidates: ReadonlyArray<{ group: ChunkableValueWriteGroup; inputIndex: number }>,
  options?: { allowCompilerDescribed?: boolean },
): {
    inputIndex: number; abiFunction: AbiFunction; collection: string;
    resourceIdentity?: string; resourceOwnerIdentity?: string;
  } | undefined {
  const executions = new Map<string, {
    inputIndex: number; abiFunction: AbiFunction; collection: string;
    resourceIdentity?: string; resourceOwnerIdentity?: string;
  }>();
  for (const { group, inputIndex } of candidates) {
    if (inputIndex < 0) continue;
    // Under `kernel-row-loop` the named fallback is closed, but a COMPOSED participant still needs the band: the
    // compiler describes the chunkable collection it writes, and the composed path is the only one that asks for
    // this relaxation, so ordinary direct sends keep the strict claim.
    const described = options?.allowCompilerDescribed === true
      ? groupChunkableValueWriteCollections(group)
      : [];
    const resource = groupChunkableValueWriteResource(group)
      ?? (described.length === 1 ? { collection: described[0] } : undefined);
    if (resource === undefined) continue;
    const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
    const logicalName = group.logicalFunctionName ?? group.functionName;
    const abiFunction = group.compilerRoute?.abiFunction
      ?? artifact?.abi.find((candidate: AbiFunction) => candidate.name === logicalName);
    if (abiFunction) executions.set(`${inputIndex}:${resource.resourceOwnerIdentity
      ?? resource.resourceIdentity ?? resource.collection}`, {
      inputIndex, abiFunction, ...resource,
    });
  }
  if (executions.size !== 1) return undefined;
  return [...executions.values()][0];
}
