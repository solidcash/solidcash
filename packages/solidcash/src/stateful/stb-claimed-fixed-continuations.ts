import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { computeCollectionHash, type FunctionBlockLayout } from '@solidcash/utils';
import type { Output } from '../interfaces.js';
import { addressToLockScript } from '../utils.js';
import { getValueChunkLockingBytecode } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  valueChunkIndexFromCommitment,
  valueChunkWriteResourceIdentity,
  type DerivedChunkOutputObservation,
} from './value-chunk-persist.js';
import {
  orderTransportedContinuationResourceClaims,
} from './ValueChunkProducerIdentity.js';

const tuple = (category: string, lock: Uint8Array, commitment: string): string =>
  JSON.stringify([category.toLowerCase(), binToHex(lock), commitment.toLowerCase()]);

export interface ClaimedFixedContinuationCoverage {
  readonly stagedIndices: ReadonlySet<number>;
  readonly tuples: ReadonlySet<string>;
}

/**
 * Suppress staging only for a complete transported resource that is already pinned at its authenticated
 * participant-local offsets. A fixed observation alone is provisional and cannot suppress an output.
 */
export function claimedFixedContinuationCoverage(options: {
  staged: readonly Pick<Output, 'to' | 'token'>[];
  derived: ReadonlyMap<number, DerivedChunkOutputObservation>;
  groups?: readonly ExternalCallUtxoGroup[];
  blockLayout?: FunctionBlockLayout;
}): ClaimedFixedContinuationCoverage {
  const covered = new Set<string>();
  const stagedIndices = new Set<number>();
  const trailing = new Set(options.blockLayout?.slots
    .filter((slot) => slot.kind === 'trailing').map((slot) => slot.offset) ?? []);
  if (trailing.size === 0) return { stagedIndices, tuples: covered };
  const resources = new Map<string, string>();
  const claimedOffsets = new Map<number, string>();
  const completeResources = new Set<string>();
  const carriers = (options.groups ?? []).filter((group) => group.transportedValueChunkProductions === true
    && !!group.continuationResourceClaims?.length);
  for (const group of carriers) {
    const published = group.continuationResourceClaims;
    if (!published) continue;
    const claims = orderTransportedContinuationResourceClaims(published);
    if (!claims) throw new Error('Transported carrier has conflicting fixed continuation claims.');
    for (const claim of claims) {
      const resource = claim.producerClaim.resourceIdentity;
      const serialized = JSON.stringify(claim);
      const previous = resources.get(resource);
      if (previous !== undefined) {
        if (previous !== serialized) throw new Error('Transported carrier has conflicting fixed continuation claims.');
      }
      resources.set(resource, serialized);
      for (let index = 0; index < claim.chunkCount; index += 1) {
        const offset = claim.bandOffset + index;
        const part = `${resource}\u0000chunk:${index}`;
        const prior = claimedOffsets.get(offset);
        if (prior !== undefined && prior !== part) {
          throw new Error('Transported carriers have overlapping fixed continuation claims.');
        }
        claimedOffsets.set(offset, part);
      }
      const writes = group.valueChunkWrites?.filter((write) => valueChunkWriteResourceIdentity(write) === resource)
        ?? [];
      if (writes.length === 0) continue; // An early probe may not yet have published its descriptor.
      if (writes.length !== 1) throw new Error('Transported carrier has conflicting fixed continuation writes.');
      const write = writes[0]!;
      if (write.outputCount !== claim.chunkCount || write.categoryId.toLowerCase() !== claim.owner.categoryId
        || write.collectionSignature !== claim.collectionSignature
        || write.collectionHash.toLowerCase() !== claim.collectionHash
        || write.keySlot.toLowerCase() !== claim.keySlot
        || binToHex(computeCollectionHash(write.collectionSignature)) !== claim.collectionHash) {
        throw new Error('Transported carrier has conflicting fixed continuation writes.');
      }
      const ownerContract = group.logicalContract?.inner ?? group.externalContract?.inner;
      const ownerLock = typeof ownerContract?.lockingBytecode === 'string'
        ? hexToBin(ownerContract.lockingBytecode) : undefined;
      const expectedLock = getValueChunkLockingBytecode(
        claim.owner.categoryId, write.collection, hexToBin(claim.keySlot), hexToBin(claim.digest),
        ownerLock?.length === 35 ? ownerLock : undefined,
      );
      const parts: string[] = [];
      let complete = true;
      for (let index = 0; index < claim.chunkCount; index += 1) {
        const offset = claim.bandOffset + index;
        if (!trailing.has(offset)) {
          throw new Error('Transported carrier fixed continuation lies outside its published trailing slots.');
        }
        const pin = options.derived.get(offset);
        if (!pin) {
          complete = false;
          continue;
        }
        if (pin.fixedIndex !== true || pin.semanticKind !== 'valueChunk'
          || pin.resourceIdentity !== resource || pin.resourcePart !== `chunk:${index}`
          || pin.categoryId?.toLowerCase() !== claim.owner.categoryId
          || valueChunkIndexFromCommitment(pin.commitment) !== index
          || binToHex(pin.lockingBytecode) !== binToHex(expectedLock)) {
          // During the first pre-derive build, a source-order provisional mint may still occupy this
          // authenticated lane. It cannot suppress staging, but it is not a contradictory observation
          // about this resource/part; the rebuilt frame and final composer must still establish it.
          if (pin.resourceIdentity !== resource || pin.resourcePart !== `chunk:${index}`) {
            complete = false;
            continue;
          }
          throw new Error('Transported carrier has a conflicting fixed continuation pin.');
        }
        parts.push(tuple(claim.owner.categoryId, pin.lockingBytecode, pin.commitment));
      }
      if (complete && !completeResources.has(resource)) {
        for (const part of parts) {
          if (covered.has(part)) throw new Error('Transported carrier has conflicting fixed continuation pins.');
          covered.add(part);
        }
        completeResources.add(resource);
      }
    }
  }
  // A stale relocated pin with the same resource/part is not a second production authority.
  const seenParts = new Map<string, number>();
  for (const [offset, pin] of options.derived) {
    if (pin.fixedIndex !== true || pin.semanticKind !== 'valueChunk'
      || pin.resourceIdentity === undefined || !resources.has(pin.resourceIdentity)
      || pin.resourcePart === undefined) continue;
    const key = `${pin.resourceIdentity}\u0000${pin.resourcePart}`;
    const previous = seenParts.get(key);
    if (previous !== undefined && previous !== offset) {
      throw new Error('Transported carrier has conflicting fixed continuation pins.');
    }
    seenParts.set(key, offset);
  }
  const matchedStaged = new Set<string>();
  for (const [index, output] of options.staged.entries()) {
    const token = output.token;
    if (token?.nft?.capability !== 'mutable' || token.amount !== 0n) continue;
    const lock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
    const key = tuple(token.category, lock, token.nft.commitment);
    if (!covered.has(key)) continue;
    if (matchedStaged.has(key)) {
      throw new Error('Transported carrier has conflicting duplicate staged continuations.');
    }
    matchedStaged.add(key);
    stagedIndices.add(index);
  }
  return { stagedIndices, tuples: covered };
}
