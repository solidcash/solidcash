import { binToHex } from '@bitauth/libauth';
import { BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX } from '@solidcash/utils';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import { addressToLockScript } from '../utils.js';
import { canOwnTransportedContinuationSlot, type ComputedValueChunkSpanClaim } from './compose-recipes.js';

export interface TransportedContinuationOutput {
  offset: number;
  categoryId: string;
  commitment: string;
  lockingBytecode: Uint8Array;
  resourceIdentity: string;
}

export type MaterializedContinuationClaim = ComputedValueChunkSpanClaim & {
  categoryId?: string;
  commitment?: string;
  lockingBytecode?: Uint8Array;
};

/** A provisional token output may be replaced only when its local claim describes that exact physical part. */
function attributesLocalOutput(
  claims: readonly MaterializedContinuationClaim[],
  chunk: Omit<TransportedContinuationOutput, 'offset'>,
  partIndex: number,
  output: Output,
): boolean {
  const token = output.token;
  if (!token?.nft || claims.length === 0) return false;
  const lock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
  const actualCategory = token.category.toLowerCase();
  const actualCommitment = token.nft.commitment.toLowerCase();
  const actualLock = binToHex(lock);
  let complete = false;
  for (const claim of claims) {
    if (claim.resourceIdentity !== chunk.resourceIdentity
      || claim.resourcePart !== `chunk:${partIndex}`
      || (claim.categoryId !== undefined && claim.categoryId.toLowerCase() !== actualCategory)
      || (claim.commitment !== undefined && claim.commitment.toLowerCase() !== actualCommitment)
      || (claim.lockingBytecode !== undefined && binToHex(claim.lockingBytecode) !== actualLock)) return false;
    if (claim.categoryId !== undefined && claim.commitment !== undefined
      && claim.lockingBytecode !== undefined) complete = true;
  }
  return complete;
}

/** Find the latest contiguous trailing band not already owned by a local continuation or other output. */
export function selectTransportedContinuationSlots(
  builder: { inputs: readonly UnlockableUtxo[]; outputs: readonly Output[] },
  trailingOffsets: readonly number[],
  chunks: readonly Omit<TransportedContinuationOutput, 'offset'>[],
  locallyMaterialized: readonly MaterializedContinuationClaim[],
  participantBase: number,
): number[] | undefined {
  if (chunks.length === 0) return [];
  const localOwners = new Map<number, MaterializedContinuationClaim[]>();
  for (const claim of locallyMaterialized) {
    const offset = claim.offset - participantBase;
    const claims = localOwners.get(offset) ?? [];
    claims.push(claim);
    localOwners.set(offset, claims);
  }
  for (let start = trailingOffsets.length - chunks.length; start >= 0; start -= 1) {
    const band = trailingOffsets.slice(start, start + chunks.length);
    if (band.some((offset, index) => index > 0 && offset !== band[index - 1]! + 1)) continue;
    const usable = band.every((offset, index) => {
      const chunk = chunks[index]!;
      if (!canOwnTransportedContinuationSlot(builder.inputs[offset], chunk)) return false;
      const claims = localOwners.get(offset) ?? [];
      const output = builder.outputs[offset];
      if (output === undefined) return false;
      const lock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
      if (output.token === undefined) {
        // A planned local claim can name the slot before any token is materialized there. The physical
        // OP_TRUE pad is vacant; only another resource or chunk part can reserve it against this write.
        return binToHex(lock) === '51'
          && (builder.inputs[offset]?.token === undefined || claims.length > 0)
          && claims.every((claim) => (
          claim.resourceIdentity === chunk.resourceIdentity && claim.resourcePart === `chunk:${index}`
        ));
      }
      return output.token.category.toLowerCase() === chunk.categoryId.toLowerCase()
        && output.token.amount === 0n
        && output.token.nft?.capability === 'mutable'
        && binToHex(lock) === binToHex(chunk.lockingBytecode)
        && (attributesLocalOutput(claims, chunk, index, output)
          || (claims.length === 0 && builder.inputs[offset]?.token === undefined
            && output.token.nft.commitment.toLowerCase() === chunk.commitment.toLowerCase()))
        && (builder.inputs[offset]?.token === undefined
          || output.token.nft.commitment.toLowerCase() === chunk.commitment.toLowerCase());
    });
    if (usable) return band;
  }
  return undefined;
}

/** Reuse each fully authenticated local run before allocating the remaining resources around it. */
export function selectTransportedContinuationResourceSlots(
  builder: { inputs: readonly UnlockableUtxo[]; outputs: readonly Output[] },
  trailingOffsets: readonly number[],
  resources: readonly { chunks: readonly Omit<TransportedContinuationOutput, 'offset'>[] }[],
  locallyMaterialized: readonly MaterializedContinuationClaim[],
  participantBase: number,
): number[][] | undefined {
  const reserved = new Set(trailingOffsets);
  const claimsByOffset = new Map<number, MaterializedContinuationClaim[]>();
  for (const claim of locallyMaterialized) {
    const offset = claim.offset - participantBase;
    const claims = claimsByOffset.get(offset) ?? [];
    claims.push(claim);
    claimsByOffset.set(offset, claims);
  }
  const exactLocalChunk = (offset: number, chunk: Omit<TransportedContinuationOutput, 'offset'>,
    index: number): boolean => {
    const input = builder.inputs[offset];
    const output = builder.outputs[offset];
    // An already-materialized, compiler-attributed output needs no replacement authority from its input.
    // In particular, an ordinary non-dummy input can fund an exact local output without being a writable pad.
    // A token-bearing predecessor still has to prove the same mutable category and canonical chunk index.
    if (!reserved.has(offset) || !input
      || (input.token !== undefined && !canOwnTransportedContinuationSlot(input, chunk))
      || output?.token?.category.toLowerCase() !== chunk.categoryId.toLowerCase()
      || output.token.amount !== 0n || output.token.nft?.capability !== 'mutable'
      || output.token.nft.commitment.toLowerCase() !== chunk.commitment.toLowerCase()) return false;
    const lock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
    if (binToHex(lock) !== binToHex(chunk.lockingBytecode)) return false;
    const claims = claimsByOffset.get(offset) ?? [];
    return attributesLocalOutput(claims, chunk, index, output);
  };
  if (resources.some(({ chunks }) => chunks.length === 0
    || chunks.some((chunk) => chunk.resourceIdentity !== chunks[0]!.resourceIdentity))) return undefined;
  let ambiguousExistingRun = false;
  const selected: (number[] | undefined)[] = resources.map(({ chunks }) => {
    const starts = trailingOffsets.filter((offset) => chunks.every((chunk, index) => (
      exactLocalChunk(offset + index, chunk, index)
    )));
    if (starts.length > 1) ambiguousExistingRun = true;
    return starts.length === 1 ? chunks.map((_, index) => starts[0]! + index) : undefined;
  });
  if (ambiguousExistingRun) return undefined;
  for (let index = resources.length - 1; index >= 0; index -= 1) {
    if (selected[index] !== undefined) continue;
    const upper = selected.slice(index + 1).flatMap((band) => band === undefined ? [] : [band[0]!])
      .reduce((minimum, offset) => Math.min(minimum, offset), Infinity);
    const lower = selected.slice(0, index).flatMap((band) => band === undefined
      ? [] : [band[band.length - 1]! + 1]).reduce((maximum, offset) => Math.max(maximum, offset), 0);
    const occupied = selected.flatMap((band, resourceIndex) => (band ?? []).map((offset, partIndex) => ({
      offset: participantBase + offset,
      resourceIdentity: resources[resourceIndex]!.chunks[0]!.resourceIdentity,
      resourcePart: `chunk:${partIndex}`,
    })));
    const band = selectTransportedContinuationSlots(builder,
      trailingOffsets.filter((offset) => offset >= lower && offset < upper),
      resources[index]!.chunks, [...locallyMaterialized, ...occupied], participantBase);
    if (!band) return undefined;
    selected[index] = band;
  }
  let previousEnd = -1;
  for (const band of selected) {
    if (!band || band.length === 0 || band[0]! < previousEnd
      || band.some((offset, index) => index > 0 && offset !== band[index - 1]! + 1)) return undefined;
    previousEnd = band[band.length - 1]! + 1;
  }
  return selected as number[][];
}

/** Graph-authorized transport replaces provisional geometry only for the exact resources it materializes. */
export function transportedContinuationSpanClaims(
  provisional: readonly ComputedValueChunkSpanClaim[],
  transported: readonly ComputedValueChunkSpanClaim[],
): ComputedValueChunkSpanClaim[] {
  const resources = new Set(transported.map((claim) => claim.resourceIdentity));
  resources.delete(undefined);
  return [...provisional.filter((claim) => !resources.has(claim.resourceIdentity)), ...transported];
}

/** Materialize authenticated graph productions in their compiler-reserved local trailing slots. */
export function materializeTransportedContinuations(
  builder: { inputs: readonly UnlockableUtxo[]; outputs: Output[] },
  trailingOffsets: readonly number[],
  chunks: readonly TransportedContinuationOutput[],
  locallyMaterialized: readonly MaterializedContinuationClaim[] = [],
  participantBase = 0,
): void {
  const reserved = new Set(trailingOffsets);
  const destinations = new Set(chunks.map((chunk) => chunk.offset));
  const identity = (category: string, lock: Uint8Array, commitment: string): string =>
    JSON.stringify([category.toLowerCase(), binToHex(lock), commitment.toLowerCase()]);
  const publishedByResource = new Map<string, Set<string>>();
  for (const chunk of chunks) {
    const published = publishedByResource.get(chunk.resourceIdentity) ?? new Set<string>();
    published.add(identity(chunk.categoryId, chunk.lockingBytecode, chunk.commitment));
    publishedByResource.set(chunk.resourceIdentity, published);
  }
  const claimsByOffset = new Map<number, MaterializedContinuationClaim[]>();
  for (const claim of locallyMaterialized) {
    const offset = claim.offset - participantBase;
    const claims = claimsByOffset.get(offset) ?? [];
    claims.push(claim);
    claimsByOffset.set(offset, claims);
  }
  const nextChunkIndex = new Map<string, number>();
  const adopted = new Set<number>();
  for (const chunk of chunks) {
    if (!reserved.has(chunk.offset)) {
      throw new Error('messageBus: transported continuation output does not own a balanced trailing slot');
    }
    const index = nextChunkIndex.get(chunk.resourceIdentity) ?? 0;
    nextChunkIndex.set(chunk.resourceIdentity, index + 1);
    const input = builder.inputs[chunk.offset];
    const output = builder.outputs[chunk.offset];
    const lock = output?.to instanceof Uint8Array
      ? output.to : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
    const actual = output?.token && lock
      ? identity(output.token.category, lock, output.token.nft?.commitment ?? '') : undefined;
    const expected = identity(chunk.categoryId, chunk.lockingBytecode, chunk.commitment);
    const claims = claimsByOffset.get(chunk.offset) ?? [];
    const attributedOutput = output !== undefined
      && output.token?.category.toLowerCase() === chunk.categoryId.toLowerCase()
      && output.token.amount === 0n && output.token.nft?.capability === 'mutable'
      && lock !== undefined && binToHex(lock) === binToHex(chunk.lockingBytecode)
      && attributesLocalOutput(claims, chunk, index, output);
    // Reapplying the same exact output on a balanced dummy input is a no-op, not a replacement. Its
    // physical category/lock/commitment already equal the authenticated graph production.
    const exactUnclaimedOutput = input?.token === undefined && claims.length === 0
      && canOwnTransportedContinuationSlot(input, chunk)
      && output?.token?.category.toLowerCase() === chunk.categoryId.toLowerCase()
      && output.token.amount === 0n && output.token.nft?.capability === 'mutable'
      && actual === expected;
    const exactClaimedOutput = input !== undefined
      && (input.token === undefined || canOwnTransportedContinuationSlot(input, chunk))
      && attributedOutput && actual === expected;
    const plannedVacantOutput = output?.token === undefined && binToHex(lock ?? Uint8Array.of()) === '51'
      && claims.length > 0 && claims.every((claim) => (
        claim.resourceIdentity === chunk.resourceIdentity && claim.resourcePart === `chunk:${index}`
      ));
    if (exactClaimedOutput || exactUnclaimedOutput) {
      adopted.add(chunk.offset);
      continue;
    }
    if (!canOwnTransportedContinuationSlot(input, chunk)) {
      throw new Error('messageBus: transported continuation output does not own a balanced trailing slot');
    }
    if (input?.token !== undefined && !plannedVacantOutput) {
      throw new Error('messageBus: transported continuation cannot overwrite a token-bearing local output');
    }
    if (output?.token !== undefined && !attributedOutput) {
      throw new Error('messageBus: transported continuation cannot overwrite an unattributed local output');
    }
    if (output?.token === undefined && (binToHex(lock ?? Uint8Array.of()) !== '51'
      || claims.some((claim) => claim.resourceIdentity !== chunk.resourceIdentity
        || claim.resourcePart !== `chunk:${index}`))) {
      throw new Error('messageBus: transported continuation cannot overwrite a claimed local output');
    }
  }
  // Replacing a provisional same-resource claim does not make a different physical output disappear. Only
  // exact copies of a transported chunk on disposable dummy inputs can be returned to padding below. A prior
  // output with another commitment/root would otherwise survive beside the graph-authorized final root while
  // its claim is removed from the compacted geometry.
  for (const [offset, claims] of claimsByOffset) {
    if (destinations.has(offset) || !claims.some((claim) => (
      claim.resourceIdentity !== undefined && publishedByResource.has(claim.resourceIdentity)
    ))) continue;
    const output = builder.outputs[offset];
    // A stale compiler span can overlap a predecessor or other token output in the balanced
    // block. Only a mutable, amount-zero NFT can be a materialized value-chunk continuation.
    if (!output?.token || output.token.amount !== 0n
      || output.token.nft?.capability !== 'mutable') continue;
    const lock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
    const actual = identity(output.token.category, lock, output.token.nft?.commitment ?? '');
    const matchingClaims = claims.filter((claim) => (
      claim.categoryId !== undefined && claim.lockingBytecode !== undefined
      && claim.commitment !== undefined
      && identity(claim.categoryId, claim.lockingBytecode, claim.commitment) === actual
    ));
    if (matchingClaims.length === 0) {
      throw new Error('messageBus: transported continuation has an unattributed local output');
    }
    const matchingResources = new Set(matchingClaims.map((claim) => claim.resourceIdentity));
    if (matchingResources.size !== 1) {
      throw new Error('messageBus: transported continuation has ambiguous local output ownership');
    }
    const resource = matchingClaims[0]!.resourceIdentity;
    if (resource === undefined) {
      throw new Error('messageBus: transported continuation has an unidentified local output owner');
    }
    if (!publishedByResource.has(resource)) continue;
    const input = builder.inputs[offset];
    if (!publishedByResource.get(resource)!.has(actual) || !reserved.has(offset)
      || !input || input.token !== undefined
      || binToHex(input.unlocker.generateLockingBytecode()) !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX
      || output.token.amount !== 0n || output.token.nft?.capability !== 'mutable') {
      throw new Error('messageBus: transported continuation leaves a distinct local output for the same resource');
    }
  }
  for (const chunk of chunks) {
    if (adopted.has(chunk.offset)) continue;
    builder.outputs[chunk.offset] = {
      to: chunk.lockingBytecode,
      amount: builder.inputs[chunk.offset]!.satoshis,
      token: {
        category: chunk.categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: chunk.commitment },
      },
    };
  }
  // An isolated builder may already have appended this exact root before the graph reserved its final band.
  // Publishing it again leaves two identity-scan matches per chunk. Move those provisional outputs back to
  // balanced padding, without compacting coordinates or touching another resource, predecessor, or owner.
  const published = new Set(chunks.map((chunk) => identity(
    chunk.categoryId, chunk.lockingBytecode, chunk.commitment,
  )));
  for (const offset of reserved) {
    if (destinations.has(offset)) continue;
    const input = builder.inputs[offset];
    const output = builder.outputs[offset];
    if (!input || input.token !== undefined
      || binToHex(input.unlocker.generateLockingBytecode()) !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX
      || output?.token?.amount !== 0n || output.token.nft?.capability !== 'mutable') continue;
    const lock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
    if (!published.has(identity(output.token.category, lock, output.token.nft.commitment))) continue;
    builder.outputs[offset] = { to: Uint8Array.of(0x51), amount: input.satoshis };
  }
}
