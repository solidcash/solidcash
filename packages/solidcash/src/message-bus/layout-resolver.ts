/**
 * Canonical transaction-layout resolver for message-bus composition.
 *
 * Compiler / graph / SDK historically invent absolute coordinates independently
 * (participantInputs, valueChunkOutputBase, PredOut, trailing bands). Drift such as
 * output 220↔222 or concrete slot 203 vs physical trailing 222 is the symptom.
 *
 * This module is the single place that turns symbolic band + claim inputs into absolute
 * transaction indices. Compose, preflight, and unlocker sync should *read* ResolvedLayout
 * rather than re-deriving bases.
 */

import type { FunctionBlockLayout } from '@solidcash/utils';
import {
  buildCompositionPlanFailureReport,
  formatCompositionPlanFailureReport,
} from './diagnostics.js';
import {
  decodeLayoutCoordinate,
  encodeLayoutCoordinate,
  rebaseLayoutCoordinate,
} from './layout-sentinels.js';
import {
  asAbsoluteInputIndex,
  asAbsoluteOutputIndex,
  asCollectionName,
  asLocalSlotOffset,
  asParticipantId,
  type AbsoluteInputIndex,
  type AbsoluteOutputIndex,
  type CollectionName,
  type LocalSlotOffset,
  type ParticipantId,
} from './kernel-brands.js';

/** Physical carrier kind for one state resource in a composed transaction. */
export type ResourceCarrierKind =
  | 'entry'
  | 'valueChunk'
  | 'dynamicState'
  | 'sortedBatch'
  | 'event'
  | 'return'
  | 'sidecar'
  | 'lifecycle';

/** Who owns consume / produce / slot / proof for one physical resource. */
export interface ResourceOwnershipRoles {
  /** Input that consumes the prior resource (or -1 if mint/insert). */
  consumeInput?: number;
  /** Output that produces or preserves the resource. */
  produceOutput?: number;
  /** Absolute output slot assigned by the layout resolver. */
  outputSlot?: number;
  /** Absolute input that supplies the authenticated proof (batch proof, chunk proof, …). */
  proofInput?: number;
}

/** Canonical identity for one physical resource in one resolved transaction. */
export interface ResourceIdentity {
  /** Participant index in the composed graph (accepts branded or plain for claim input). */
  participant: ParticipantId | number;
  /** Collection / stream name when applicable (e.g. jobEvents). */
  collection?: CollectionName | string;
  /** Stable collection hash when published by the compiler. */
  collectionHash?: string;
  /** Key-domain id when keys are authenticated. */
  keyDomainId?: string;
  carrier: ResourceCarrierKind;
  /** Optional effect ordinal within the handler's source-effect schedule. */
  effectOrdinal?: number;
}

/** One ownership row: identity + exclusive roles. */
export interface ResourceOwnershipClaim extends ResourceIdentity {
  roles: ResourceOwnershipRoles;
  /** When set, outputSlot occupies [outputSlot, outputSlot+rangeWidth). Default 1. */
  rangeWidth?: number;
}

/** Symbolic band published by the compiler (offsets are participant-local). */
export type SymbolicBandKind =
  | 'master'
  | 'data'
  | 'entry'
  | 'event'
  | 'return'
  | 'sidecar'
  | 'valueChunk'
  | 'dynamic'
  | 'lifecycle'
  | 'trailing';

export interface SymbolicBand {
  kind: SymbolicBandKind;
  /** First local offset of this band within the participant block. */
  localBase: number;
  /** Worst-case capacity (slots). Active claims pack contiguously from localBase. */
  capacity: number;
  /** Optional activation bit name / recipe id; absent ⇒ always active. */
  activation?: string;
}

/** Symbolic layout for one participant / executable entry. */
export interface SymbolicParticipantLayout {
  participant: number;
  contractName?: string;
  /** Compiler block layout when available (slots + trailingBase/Capacity). */
  blockLayout?: Pick<
    FunctionBlockLayout,
    'blockSize' | 'trailingBase' | 'trailingCapacity' | 'fixedSuffix' | 'slots'
  >;
  /** Ordered symbolic bands; when omitted, derived from blockLayout. */
  bands?: readonly SymbolicBand[];
}

/**
 * Runtime trailing capacity after identity-anchor / executor fixedSuffix growth.
 * Must exclude fixedSuffix so SCID identity locks are not treated as trailing chunks.
 */
export function trailingCapacityExcludingFixedSuffix(params: {
  blockSize: number;
  trailingBase?: number;
  fixedSuffix?: number;
}): number {
  const trailingBase = params.trailingBase ?? params.blockSize;
  const fixedSuffix = params.fixedSuffix ?? 0;
  return Math.max(0, params.blockSize - trailingBase - fixedSuffix);
}

/** Active value-chunk / continuation claim used when assigning absolute chunk bases. */
export interface ActiveValueChunkClaim {
  participant: number;
  collection: string;
  /** Band-local offset of the first chunk output (0 = first trailing value-chunk slot). */
  bandOffset: number;
  chunkCount: number;
  effectOrdinal?: number;
}

/** Active PredOut / insert claim: P' lives in the physical route trailing band. */
export interface ActivePredOutClaim {
  participant: number;
  /** Witness parameter name, e.g. __internal__vmapBatchPredOut_2 */
  witnessName: string;
  /**
   * Concrete callsite-local slot from the handler layout (historical bug source when used as absolute).
   * Resolver ignores this for absolute assignment when physicalOffset is known.
   */
  concreteLocalSlot?: number;
  /** Physical route trailing-band local offset where P' is materialized. */
  physicalLocalOffset: number;
}

/**
 * Preserved dynamic-state chunk run that occupies the head of the trailing band
 * (`__internal__dynamicChunkInputBase` … before entry NEWs).
 */
export interface ActiveDynamicBandClaim {
  participant: number;
  /** Total preserved dynamic chunk outputs for this participant (sum of ceil(len/120)). */
  chunkCount: number;
}

/** First mapping NEW / entry-loop write after the preserved dyn run. */
export interface ActiveEntryNewClaim {
  participant: number;
  collection?: string;
  /** Index among entry NEWs after the dyn run (0 = first NEW). */
  entryIndex?: number;
}

export interface LayoutResolverInput {
  participants: readonly SymbolicParticipantLayout[];
  valueChunkClaims?: readonly ActiveValueChunkClaim[];
  predOutClaims?: readonly ActivePredOutClaim[];
  dynamicBandClaims?: readonly ActiveDynamicBandClaim[];
  entryNewClaims?: readonly ActiveEntryNewClaim[];
  ownership?: readonly ResourceOwnershipClaim[];
  /** Non-participant inputs before the first participant master (fee/funder/…). */
  nonParticipantInputPrefix?: number;
  /** Non-participant outputs before the first participant master output. */
  nonParticipantOutputPrefix?: number;
}

export interface ResolvedParticipantLayout {
  /** Branded layout coordinates: branded participant id. */
  participant: ParticipantId;
  contractName?: string;
  /** Absolute input index of the participant master (input coordinate space). */
  inputBase: AbsoluteInputIndex;
  /**
   * Absolute output index of the participant master (output coordinate space).
   * Distinct from `inputBase` so input-addressed and output-addressed witnesses cannot be conflated.
   */
  outputBase: AbsoluteOutputIndex;
  blockSize: number;
  trailingBase?: number;
  trailingCapacity?: number;
  bands: readonly (SymbolicBand & {
    absoluteBase: AbsoluteInputIndex;
    absoluteOutputBase: AbsoluteOutputIndex;
  })[];
}

export interface ResolvedValueChunkBand {
  participant: ParticipantId;
  collection: CollectionName | string;
  /** Absolute output/input index of band[0] — the `__internal__valueChunkOutputBase` witness. */
  absoluteBase: AbsoluteOutputIndex;
  bandOffset: LocalSlotOffset | number;
  chunkCount: number;
  effectOrdinal?: number;
}

export interface ResolvedPredOut {
  participant: ParticipantId;
  witnessName: string;
  /** Absolute transaction output index the covenant must read. */
  absoluteOutput: AbsoluteOutputIndex;
  physicalLocalOffset: LocalSlotOffset | number;
}

export interface LayoutInvariantFailure {
  invariantId: string;
  participant?: number;
  resource?: string;
  expectedOutput?: number;
  actualOutput?: number;
  detail?: string;
}

export interface ResolvedDynamicBand {
  participant: ParticipantId;
  /** Absolute `__internal__dynamicChunkInputBase` (input coordinate space). */
  absoluteBase: AbsoluteInputIndex;
  /** Absolute first dyn chunk in the output coordinate space (may differ under asymmetric prefixes). */
  absoluteOutputBase: AbsoluteOutputIndex;
  chunkCount: number;
}

export interface ResolvedEntryNew {
  participant: ParticipantId;
  collection?: CollectionName | string;
  /** Absolute output index of this entry NEW. */
  absoluteOutput: AbsoluteOutputIndex;
  entryIndex: number;
}

export interface ResolvedLayout {
  participantInputs: readonly AbsoluteInputIndex[];
  /** Parallel to participantInputs: absolute output bases (output coordinate space). */
  participantOutputs: readonly AbsoluteOutputIndex[];
  participants: readonly ResolvedParticipantLayout[];
  valueChunkBands: readonly ResolvedValueChunkBand[];
  predOuts: readonly ResolvedPredOut[];
  dynamicBands: readonly ResolvedDynamicBand[];
  entryNews: readonly ResolvedEntryNew[];
  ownership: readonly ResourceOwnershipClaim[];
  totalParticipantSlots: number;
  nonParticipantInputPrefix: number;
  nonParticipantOutputPrefix: number;
  /** Format a layout mismatch for preflight / compose fail-closed paths. */
  formatInvariant(failure: LayoutInvariantFailure): string;
  /** Absolute input index for a participant-local offset (branded layout coordinates branded return). */
  absoluteInput(participant: number, localOffset: number): AbsoluteInputIndex;
  /** Absolute output index for a participant-local offset (branded layout coordinates branded return). */
  absoluteOutput(participant: number, localOffset: number): AbsoluteOutputIndex;
  /** @deprecated Use absoluteInput / absoluteOutput — kept for callers mid-migration. */
  absolute(participant: number, localOffset: number): AbsoluteInputIndex;
}

function bandsFromBlockLayout(
  blockLayout: SymbolicParticipantLayout['blockLayout'],
): SymbolicBand[] {
  if (!blockLayout) {
    return [{ kind: 'master', localBase: 0, capacity: 1 }];
  }
  const bands: SymbolicBand[] = [];
  const trailingBase = blockLayout.trailingBase;
  const trailingCapacity = blockLayout.trailingCapacity;
  if (trailingBase !== undefined && trailingCapacity !== undefined && trailingCapacity > 0) {
    if (trailingBase > 0) {
      bands.push({ kind: 'master', localBase: 0, capacity: trailingBase });
    }
    bands.push({ kind: 'trailing', localBase: trailingBase, capacity: trailingCapacity });
    const suffixStart = trailingBase + trailingCapacity;
    if (suffixStart < blockLayout.blockSize) {
      bands.push({
        kind: 'lifecycle',
        localBase: suffixStart,
        capacity: blockLayout.blockSize - suffixStart,
      });
    }
    return bands;
  }
  bands.push({ kind: 'master', localBase: 0, capacity: blockLayout.blockSize });
  return bands;
}

/**
 * Ownership alias normalize: canonicalize collection / carrier aliases before ownership identity keys.
 * Strips a leading `this.` and collapses empty/whitespace so `this.balances` and
 * `balances` share one ownership identity.
 */
export function normalizeOwnershipCollectionAlias(
  collection: string | undefined,
): string | undefined {
  if (collection === undefined) return undefined;
  const trimmed = collection.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.replace(/^this\./, '');
}

/** Ownership alias normalize: return a claim copy with collection alias normalized (other fields unchanged). */
export function normalizeOwnershipClaim(
  claim: ResourceOwnershipClaim,
): ResourceOwnershipClaim {
  const collection = normalizeOwnershipCollectionAlias(claim.collection);
  if (collection === claim.collection) return claim;
  return { ...claim, collection };
}

function ownershipIdentityKey(claim: ResourceOwnershipClaim): string {
  const normalized = normalizeOwnershipClaim(claim);
  return [
    normalized.participant,
    normalized.carrier,
    normalized.collection ?? '',
    normalized.collectionHash ?? '',
    normalized.keyDomainId ?? '',
    String(normalized.effectOrdinal ?? ''),
  ].join('|');
}

function roleCoordinateEntries(claim: ResourceOwnershipClaim): Array<{ kind: string; absolute: number }> {
  const entries: Array<{ kind: string; absolute: number }> = [];
  const { roles } = claim;
  if (roles.consumeInput !== undefined && roles.consumeInput >= 0) {
    entries.push({ kind: 'consumeInput', absolute: roles.consumeInput });
  }
  if (roles.produceOutput !== undefined && roles.produceOutput >= 0) {
    entries.push({ kind: 'produceOutput', absolute: roles.produceOutput });
  }
  if (roles.outputSlot !== undefined && roles.outputSlot >= 0) {
    entries.push({ kind: 'outputSlot', absolute: roles.outputSlot });
  }
  if (roles.proofInput !== undefined && roles.proofInput >= 0) {
    entries.push({ kind: 'proofInput', absolute: roles.proofInput });
  }
  return entries;
}

/**
 * Fail closed on:
 * - duplicate resource identities
 * - one identity receiving conflicting role coordinates
 * - two distinct resources claiming the same input/output coordinate
 * - overlapping variable-width output ranges (`roles.outputSlot` .. `outputSlot+rangeWidth-1`)
 * - claims whose coordinates fall outside the owning participant's published block
 *   (when `participantBlocks` is provided) or into a fixed-suffix band
 */
export type OwnershipParticipantBlock = {
  inputBase: number;
  /** Output-space base; defaults to inputBase when omitted (balanced 1:1). */
  outputBase?: number;
  blockSize: number;
  trailingBase?: number;
  trailingCapacity?: number;
  fixedSuffix?: number;
};

export function assertUniqueOwnership(
  claims: readonly ResourceOwnershipClaim[],
  participantBlocks?: ReadonlyMap<number, OwnershipParticipantBlock>,
): void {
  const byIdentity = new Map<string, ResourceOwnershipClaim>();
  const coordinateOwners = new Map<string, ResourceOwnershipClaim>();

  // Ownership alias normalize: normalize collection aliases once before identity / coordinate checks.
  for (const claim of claims.map(normalizeOwnershipClaim)) {
    const key = ownershipIdentityKey(claim);
    const prior = byIdentity.get(key);
    if (prior !== undefined) {
      // Same identity with different role coordinates ⇒ conflicting roles.
      const priorCoords = roleCoordinateEntries(prior);
      const nextCoords = roleCoordinateEntries(claim);
      const conflict = nextCoords.some((entry) => {
        const match = priorCoords.find((p) => p.kind === entry.kind);
        return match !== undefined && match.absolute !== entry.absolute;
      });
      throw new Error(
        formatLayoutInvariant({
          invariantId: conflict ? 'conflicting-roles' : 'duplicate-ownership',
          participant: claim.participant,
          resource: claim.collection ?? claim.carrier,
          expectedOutput: prior.roles.outputSlot ?? priorCoords[0]?.absolute ?? 0,
          actualOutput: claim.roles.outputSlot ?? nextCoords[0]?.absolute ?? 1,
          detail: `L3_LAYOUT_INVARIANT carrier=${claim.carrier} key=${key}`,
        }),
      );
    }
    byIdentity.set(key, claim);

    for (const entry of roleCoordinateEntries(claim)) {
      const coordKey = `${entry.kind}@${entry.absolute}`;
      const owner = coordinateOwners.get(coordKey);
      if (owner !== undefined && ownershipIdentityKey(owner) !== key) {
        throw new Error(
          formatLayoutInvariant({
            invariantId: 'coordinate-collision',
            participant: claim.participant,
            resource: claim.collection ?? claim.carrier,
            expectedOutput: entry.absolute,
            actualOutput: entry.absolute,
            detail: `L3_LAYOUT_INVARIANT ${entry.kind} claimed by ${owner.collection ?? owner.carrier} and ${claim.collection ?? claim.carrier}`,
          }),
        );
      }
      coordinateOwners.set(coordKey, claim);
    }

    // Variable-width range overlap on outputSlot bands.
    const rangeWidth = (claim as ResourceOwnershipClaim & { rangeWidth?: number }).rangeWidth ?? 1;
    if (claim.roles.outputSlot !== undefined && claim.roles.outputSlot >= 0 && rangeWidth > 0) {
      const start = claim.roles.outputSlot;
      const end = start + rangeWidth;
      for (const other of byIdentity.values()) {
        if (other === claim) continue;
        const otherWidth = (other as ResourceOwnershipClaim & { rangeWidth?: number }).rangeWidth ?? 1;
        if (other.roles.outputSlot === undefined || other.roles.outputSlot < 0) continue;
        const otherStart = other.roles.outputSlot;
        const otherEnd = otherStart + otherWidth;
        if (start < otherEnd && otherStart < end) {
          throw new Error(
            formatLayoutInvariant({
              invariantId: 'overlapping-range',
              participant: claim.participant,
              resource: claim.collection ?? claim.carrier,
              expectedOutput: otherStart,
              actualOutput: start,
              detail: `L3_LAYOUT_INVARIANT ranges [${start},${end}) and [${otherStart},${otherEnd}) overlap`,
            }),
          );
        }
      }
    }

    if (participantBlocks !== undefined) {
      const block = participantBlocks.get(claim.participant);
      if (block === undefined) {
        throw new Error(
          formatLayoutInvariant({
            invariantId: 'participant-boundary',
            participant: claim.participant,
            resource: claim.collection ?? claim.carrier,
            detail: 'L3_LAYOUT_INVARIANT claim references unknown participant',
          }),
        );
      }
      const outputBase = block.outputBase ?? block.inputBase;
      const inputMin = block.inputBase;
      const inputMax = block.inputBase + block.blockSize;
      const outputMin = outputBase;
      const outputMax = outputBase + block.blockSize;
      const outputSuffixStart = block.trailingBase !== undefined && block.trailingCapacity !== undefined
        ? outputBase + block.trailingBase + block.trailingCapacity
        : undefined;
      for (const entry of roleCoordinateEntries(claim)) {
        const isOutputRole = entry.kind === 'outputSlot' || entry.kind === 'produceOutput';
        const minAbs = isOutputRole ? outputMin : inputMin;
        const maxAbs = isOutputRole ? outputMax : inputMax;
        if (entry.absolute < minAbs || entry.absolute >= maxAbs) {
          throw new Error(
            formatLayoutInvariant({
              invariantId: 'participant-boundary',
              participant: claim.participant,
              resource: claim.collection ?? claim.carrier,
              expectedOutput: minAbs,
              actualOutput: entry.absolute,
              detail: `L3_LAYOUT_INVARIANT ${entry.kind} crosses participant ${isOutputRole ? 'output' : 'input'} `
                + `block [${minAbs},${maxAbs})`,
            }),
          );
        }
        if (outputSuffixStart !== undefined && entry.kind === 'outputSlot'
          && entry.absolute >= outputSuffixStart) {
          throw new Error(
            formatLayoutInvariant({
              invariantId: 'fixed-suffix-crossing',
              participant: claim.participant,
              resource: claim.collection ?? claim.carrier,
              expectedOutput: outputSuffixStart - 1,
              actualOutput: entry.absolute,
              detail: 'L3_LAYOUT_INVARIANT outputSlot lands in fixed-suffix band',
            }),
          );
        }
      }
    }
  }
}

function assertParticipantTopology(participants: readonly SymbolicParticipantLayout[]): void {
  const seen = new Set<number>();
  for (const participant of participants) {
    if (!Number.isInteger(participant.participant) || participant.participant < 0) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'participant-id-invalid',
          participant: participant.participant,
          detail: 'participant id must be a non-negative integer',
        }),
      );
    }
    if (seen.has(participant.participant)) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'duplicate-participant-id',
          participant: participant.participant,
          detail: 'transaction layout forbids duplicate participant ids',
        }),
      );
    }
    seen.add(participant.participant);
    const bands = (participant.bands && participant.bands.length > 0)
      ? participant.bands
      : bandsFromBlockLayout(participant.blockLayout);
    const occupied: Array<{ start: number; end: number; kind: string }> = [];
    for (const band of bands) {
      if (!Number.isInteger(band.localBase) || band.localBase < 0
        || !Number.isInteger(band.capacity) || band.capacity < 0) {
        throw new Error(
          formatLayoutInvariant({
            invariantId: 'band-dimension-invalid',
            participant: participant.participant,
            resource: band.kind,
            detail: `localBase=${band.localBase} capacity=${band.capacity}`,
          }),
        );
      }
      if (band.capacity === 0) continue;
      const start = band.localBase;
      const end = band.localBase + band.capacity;
      for (const prior of occupied) {
        if (start < prior.end && prior.start < end) {
          throw new Error(
            formatLayoutInvariant({
              invariantId: 'overlapping-symbolic-band',
              participant: participant.participant,
              resource: `${prior.kind}+${band.kind}`,
              expectedOutput: prior.start,
              actualOutput: start,
              detail: `bands overlap in [${Math.max(start, prior.start)}, ${Math.min(end, prior.end)})`,
            }),
          );
        }
      }
      occupied.push({ start, end, kind: band.kind });
    }
  }
}

/**
 * Fail closed when resolved claim ranges collide across kinds (value-chunk / dyn / entry / PredOut).
 */
export function assertResolvedClaimSlotExclusivity(layout: {
  valueChunkBands: readonly ResolvedValueChunkBand[];
  dynamicBands: readonly ResolvedDynamicBand[];
  entryNews: readonly ResolvedEntryNew[];
  predOuts: readonly ResolvedPredOut[];
}): void {
  const occupied = new Map<string, string>();
  const claim = (space: 'input' | 'output', absolute: number, width: number, label: string): void => {
    if (!Number.isInteger(absolute) || absolute < 0 || !Number.isInteger(width) || width < 0) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'claim-slot-invalid',
          resource: label,
          actualOutput: absolute,
          detail: `width=${width}`,
        }),
      );
    }
    for (let offset = 0; offset < width; offset += 1) {
      const key = `${space}:${absolute + offset}`;
      const prior = occupied.get(key);
      if (prior !== undefined) {
        throw new Error(
          formatLayoutInvariant({
            invariantId: 'claim-slot-collision',
            resource: label,
            expectedOutput: absolute + offset,
            actualOutput: absolute + offset,
            detail: `${prior} and ${label} both claim ${key}`,
          }),
        );
      }
      occupied.set(key, label);
    }
  };
  for (const band of layout.dynamicBands) {
    if (band.chunkCount <= 0) continue;
    // Dyn run occupies input space at absoluteBase and output space at absoluteOutputBase.
    claim('input', band.absoluteBase, band.chunkCount, `dynamic@p${band.participant}`);
    claim('output', band.absoluteOutputBase, band.chunkCount, `dynamic@p${band.participant}`);
  }
  for (const band of layout.valueChunkBands) {
    if (band.chunkCount <= 0) continue;
    claim('output', band.absoluteBase, band.chunkCount, `valueChunk:${band.collection}@p${band.participant}`);
  }
  for (const entry of layout.entryNews) {
    claim('output', entry.absoluteOutput, 1, `entryNEW:${entry.collection ?? ''}@p${entry.participant}`);
  }
  // PredOut is a reference to an existing output, not an exclusive producer claim. Multiple logical inserts in
  // one sorted batch can share the same physical P' (P -> k1 -> k2 has one rewritten P and two NEW nodes), so
  // aliases at one absolute output are valid. `predOutClaims` still validates every reference against its owning
  // participant and the ownership checks above remain exclusive for the resources which produce that output.
}

/**
 * Resolve symbolic participant layouts + active claims into one absolute coordinate table.
 * Throws if a claim references an unknown participant or lands outside the published band.
 */
export function resolveTransactionLayout(input: LayoutResolverInput): ResolvedLayout {
  const ownership = input.ownership ?? [];
  assertParticipantTopology(input.participants);

  const nonParticipantInputPrefix = input.nonParticipantInputPrefix ?? 0;
  const nonParticipantOutputPrefix = input.nonParticipantOutputPrefix ?? 0;
  if (!Number.isInteger(nonParticipantInputPrefix) || nonParticipantInputPrefix < 0
    || !Number.isInteger(nonParticipantOutputPrefix) || nonParticipantOutputPrefix < 0) {
    throw new Error(
      formatLayoutInvariant({
        invariantId: 'non-participant-prefix-invalid',
        detail: `inputPrefix=${nonParticipantInputPrefix} outputPrefix=${nonParticipantOutputPrefix}`,
      }),
    );
  }

  const participantInputs: AbsoluteInputIndex[] = [];
  const participantOutputs: AbsoluteOutputIndex[] = [];
  const resolvedParticipants: ResolvedParticipantLayout[] = [];
  // Distinct input/output cursors — balanced 1:1 layouts advance both equally, but witnesses must pick a space.
  let inputCursor = nonParticipantInputPrefix;
  let outputCursor = nonParticipantOutputPrefix;

  for (const participant of input.participants) {
    const blockSize = participant.blockLayout?.blockSize
      ?? Math.max(1, ...(participant.bands ?? []).map((band) => band.localBase + band.capacity), 1);
    if (!Number.isInteger(blockSize) || blockSize <= 0) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'block-size-invalid',
          participant: participant.participant,
          actualOutput: blockSize,
        }),
      );
    }
    const bands = (participant.bands && participant.bands.length > 0)
      ? participant.bands
      : bandsFromBlockLayout(participant.blockLayout);
    // Branded layout coordinates: brand resolved participant / absolute coordinate identities at the layout boundary.
    const brandedParticipant = asParticipantId(participant.participant);
    const brandedInputBase = asAbsoluteInputIndex(inputCursor);
    const brandedOutputBase = asAbsoluteOutputIndex(outputCursor);
    participantInputs.push(brandedInputBase);
    participantOutputs.push(brandedOutputBase);
    resolvedParticipants.push({
      participant: brandedParticipant,
      contractName: participant.contractName,
      inputBase: brandedInputBase,
      outputBase: brandedOutputBase,
      blockSize,
      trailingBase: participant.blockLayout?.trailingBase,
      trailingCapacity: participant.blockLayout?.trailingCapacity,
      bands: bands.map((band) => ({
        ...band,
        absoluteBase: asAbsoluteInputIndex(inputCursor + band.localBase),
        absoluteOutputBase: asAbsoluteOutputIndex(outputCursor + band.localBase),
      })),
    });
    inputCursor += blockSize;
    outputCursor += blockSize;
  }

  const byParticipant = new Map(resolvedParticipants.map((entry) => [entry.participant, entry]));
  const participantBlocks = new Map(resolvedParticipants.map((entry) => {
    const source = input.participants.find((p) => p.participant === entry.participant);
    return [entry.participant, {
      inputBase: entry.inputBase,
      outputBase: entry.outputBase,
      blockSize: entry.blockSize,
      trailingBase: entry.trailingBase,
      trailingCapacity: entry.trailingCapacity,
      fixedSuffix: source?.blockLayout?.fixedSuffix,
    }] as const;
  }));
  assertUniqueOwnership(ownership, participantBlocks);

  const valueChunkBands: ResolvedValueChunkBand[] = (input.valueChunkClaims ?? []).map((claim) => {
    const brandedParticipant = asParticipantId(claim.participant);
    const resolved = byParticipant.get(brandedParticipant);
    if (!resolved) {
      throw new Error(
        `layout-resolver: value-chunk claim for unknown participant ${claim.participant} `
          + `(collection=${claim.collection})`,
      );
    }
    const trailing = resolved.trailingBase;
    if (trailing === undefined) {
      throw new Error(
        `layout-resolver: participant ${claim.participant} has no trailingBase for value-chunk `
          + `'${claim.collection}'`,
      );
    }
    const local = trailing + claim.bandOffset;
    if (local < 0 || local >= resolved.blockSize) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'value-chunk-band-in-block',
          participant: claim.participant,
          resource: claim.collection,
          expectedOutput: trailing,
          actualOutput: local,
          detail: `bandOffset=${claim.bandOffset} blockSize=${resolved.blockSize}`,
        }),
      );
    }
    if (
      resolved.trailingCapacity !== undefined
      && claim.bandOffset + claim.chunkCount > resolved.trailingCapacity
    ) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'value-chunk-capacity',
          participant: claim.participant,
          resource: claim.collection,
          expectedOutput: resolved.trailingCapacity,
          actualOutput: claim.bandOffset + claim.chunkCount,
          detail: `chunkCount=${claim.chunkCount}`,
        }),
      );
    }
    return {
      participant: brandedParticipant,
      collection: asCollectionName(claim.collection),
      absoluteBase: asAbsoluteOutputIndex(resolved.outputBase + local),
      bandOffset: asLocalSlotOffset(claim.bandOffset),
      chunkCount: claim.chunkCount,
      effectOrdinal: claim.effectOrdinal,
    };
  });

  const predOuts: ResolvedPredOut[] = (input.predOutClaims ?? []).map((claim) => {
    const brandedParticipant = asParticipantId(claim.participant);
    const resolved = byParticipant.get(brandedParticipant);
    if (!resolved) {
      throw new Error(
        `layout-resolver: PredOut claim for unknown participant ${claim.participant} `
          + `(${claim.witnessName})`,
      );
    }
    if (claim.physicalLocalOffset < 0 || claim.physicalLocalOffset >= resolved.blockSize) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'pred-out-physical-offset',
          participant: claim.participant,
          resource: claim.witnessName,
          expectedOutput: resolved.trailingBase,
          actualOutput: claim.physicalLocalOffset,
          detail: `blockSize=${resolved.blockSize}`,
        }),
      );
    }
    const absoluteOutput = asAbsoluteOutputIndex(resolved.outputBase + claim.physicalLocalOffset);
    // PredOut physical-only authority: concreteLocalSlot is never authority. Any disagreement with physicalLocalOffset
    // fails closed (previously only below trailingBase). Resolved surface omits the field entirely.
    if (
      claim.concreteLocalSlot !== undefined
      && claim.concreteLocalSlot !== claim.physicalLocalOffset
    ) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'pred-out-concrete-vs-physical',
          participant: claim.participant,
          resource: claim.witnessName,
          expectedOutput: absoluteOutput,
          actualOutput: resolved.outputBase + claim.concreteLocalSlot,
          detail: 'resolver uses physicalLocalOffset; concreteLocalSlot is not authority',
        }),
      );
    }
    return {
      participant: brandedParticipant,
      witnessName: claim.witnessName,
      absoluteOutput,
      physicalLocalOffset: asLocalSlotOffset(claim.physicalLocalOffset),
    };
  });

  const dynamicBands: ResolvedDynamicBand[] = (input.dynamicBandClaims ?? []).map((claim) => {
    const brandedParticipant = asParticipantId(claim.participant);
    const resolved = byParticipant.get(brandedParticipant);
    if (!resolved) {
      throw new Error(
        `layout-resolver: dynamic-band claim for unknown participant ${claim.participant}`,
      );
    }
    const trailing = resolved.trailingBase;
    if (trailing === undefined) {
      throw new Error(
        `layout-resolver: participant ${claim.participant} has no trailingBase for dynamic band`,
      );
    }
    if (claim.chunkCount < 0) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'dynamic-band-count',
          participant: claim.participant,
          resource: 'dynamicChunkInputBase',
          expectedOutput: 0,
          actualOutput: claim.chunkCount,
        }),
      );
    }
    if (
      resolved.trailingCapacity !== undefined
      && claim.chunkCount > resolved.trailingCapacity
    ) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'dynamic-band-capacity',
          participant: claim.participant,
          resource: 'dynamicChunkInputBase',
          expectedOutput: resolved.trailingCapacity,
          actualOutput: claim.chunkCount,
        }),
      );
    }
    return {
      participant: brandedParticipant,
      // Dyn base is an INPUT-space witness (OP_UTXOBYTECODE).
      absoluteBase: asAbsoluteInputIndex(resolved.inputBase + trailing),
      // Output-space occupancy for exclusivity vs valueChunk/entry (asymmetric prefixes).
      absoluteOutputBase: asAbsoluteOutputIndex(resolved.outputBase + trailing),
      chunkCount: claim.chunkCount,
    };
  });

  const dynCountByParticipant = new Map(
    dynamicBands.map((band) => [band.participant, band.chunkCount]),
  );

  const entryNews: ResolvedEntryNew[] = (input.entryNewClaims ?? []).map((claim) => {
    const brandedParticipant = asParticipantId(claim.participant);
    const resolved = byParticipant.get(brandedParticipant);
    if (!resolved) {
      throw new Error(
        `layout-resolver: entry-NEW claim for unknown participant ${claim.participant}`,
      );
    }
    const trailing = resolved.trailingBase;
    if (trailing === undefined) {
      throw new Error(
        `layout-resolver: participant ${claim.participant} has no trailingBase for entry NEW`,
      );
    }
    const entryIndex = claim.entryIndex ?? 0;
    const dynCount = dynCountByParticipant.get(brandedParticipant) ?? 0;
    const local = trailing + dynCount + entryIndex;
    if (local < 0 || local >= resolved.blockSize) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'entry-new-in-block',
          participant: claim.participant,
          resource: claim.collection ?? 'entryNEW',
          expectedOutput: trailing + dynCount,
          actualOutput: local,
          detail: `entryIndex=${entryIndex} dynCount=${dynCount}`,
        }),
      );
    }
    return {
      participant: brandedParticipant,
      collection: claim.collection === undefined ? undefined : asCollectionName(claim.collection),
      absoluteOutput: asAbsoluteOutputIndex(resolved.outputBase + local),
      entryIndex,
    };
  });

  const absoluteInput = (participant: number, localOffset: number): AbsoluteInputIndex => {
    const resolved = byParticipant.get(asParticipantId(participant));
    if (!resolved) {
      throw new Error(`layout-resolver: unknown participant ${participant}`);
    }
    if (localOffset < 0 || localOffset >= resolved.blockSize) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'local-offset-in-block',
          participant,
          expectedOutput: resolved.blockSize,
          actualOutput: localOffset,
        }),
      );
    }
    return asAbsoluteInputIndex(resolved.inputBase + asLocalSlotOffset(localOffset));
  };
  const absoluteOutput = (participant: number, localOffset: number): AbsoluteOutputIndex => {
    const resolved = byParticipant.get(asParticipantId(participant));
    if (!resolved) {
      throw new Error(`layout-resolver: unknown participant ${participant}`);
    }
    if (localOffset < 0 || localOffset >= resolved.blockSize) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'local-offset-in-block',
          participant,
          expectedOutput: resolved.blockSize,
          actualOutput: localOffset,
        }),
      );
    }
    return asAbsoluteOutputIndex(resolved.outputBase + asLocalSlotOffset(localOffset));
  };

  const layout: ResolvedLayout = {
    participantInputs: Object.freeze([...participantInputs]),
    participantOutputs: Object.freeze([...participantOutputs]),
    participants: Object.freeze(resolvedParticipants),
    valueChunkBands: Object.freeze(valueChunkBands),
    predOuts: Object.freeze(predOuts),
    dynamicBands: Object.freeze(dynamicBands),
    entryNews: Object.freeze(entryNews),
    ownership: Object.freeze([...ownership]),
    totalParticipantSlots: inputCursor - nonParticipantInputPrefix,
    nonParticipantInputPrefix,
    nonParticipantOutputPrefix,
    formatInvariant: formatLayoutInvariant,
    absoluteInput,
    absoluteOutput,
    absolute: absoluteInput,
  };
  assertResolvedClaimSlotExclusivity(layout);
  return layout;
}

/**
 * Skeptic-grade layout failure string (layout invariant attribution attribution) + structured plan-failure structured plan-failure trailer.
 * Production layout throws and compose `layoutInvariantError` both surface the same machine trailer.
 */
export function formatLayoutInvariant(failure: LayoutInvariantFailure): string {
  const humanParts = [
    `layout-invariant ${failure.invariantId}`,
    failure.participant === undefined ? undefined : `participant ${failure.participant}`,
    failure.resource === undefined ? undefined : `resource ${failure.resource}`,
    failure.expectedOutput === undefined ? undefined : `expected output ${failure.expectedOutput}`,
    failure.actualOutput === undefined ? undefined : `actual output ${failure.actualOutput}`,
    failure.detail,
  ].filter((part): part is string => part !== undefined && part.length > 0);
  const report = buildCompositionPlanFailureReport({
    kind: 'layout-invariant',
    code: 'L3_LAYOUT_INVARIANT',
    phase: 'absoluteLayout',
    invariantId: failure.invariantId,
    participant: failure.participant,
    resource: failure.resource,
    expected: failure.expectedOutput,
    actual: failure.actualOutput,
    detail: failure.detail,
    message: humanParts.join('; '),
  });
  return formatCompositionPlanFailureReport(report);
}

/**
 * Build a PredOut claim from physical route trailing geometry.
 * Prefer this over adding concrete handler slot offsets to participant base.
 */
export function predOutClaimFromPhysicalRoute(params: {
  participant: number;
  witnessName: string;
  /** Physical route `blockLayout.trailingBase` (or measured P' local offset). */
  physicalLocalOffset: number;
  concreteLocalSlot?: number;
}): ActivePredOutClaim {
  return {
    participant: params.participant,
    witnessName: params.witnessName,
    physicalLocalOffset: params.physicalLocalOffset,
    concreteLocalSlot: params.concreteLocalSlot,
  };
}

/** Value-chunk band[0] absolute base for a participant+collection, or undefined if absent. */
export function valueChunkOutputBaseFor(
  layout: ResolvedLayout,
  participant: number,
  collection?: string,
): number | undefined {
  const bands = layout.valueChunkBands.filter((band) => band.participant === participant
    && (collection === undefined || band.collection === collection));
  if (bands.length === 0) return undefined;
  // band[0] of the ordered claims for this participant (lowest bandOffset).
  return [...bands].sort((a, b) => a.bandOffset - b.bandOffset)[0]?.absoluteBase;
}

/** Absolute `__internal__dynamicChunkInputBase` for a participant, or undefined if absent. */
export function dynamicChunkInputBaseFor(
  layout: ResolvedLayout,
  participant: number,
): number | undefined {
  return layout.dynamicBands.find((band) => band.participant === participant)?.absoluteBase;
}

/** Absolute first entry-NEW output after the preserved dyn run, or undefined if absent. */
export function entryNewOutputBaseFor(
  layout: ResolvedLayout,
  participant: number,
  collection?: string,
): number | undefined {
  const news = layout.entryNews.filter((entry) => entry.participant === participant
    && (collection === undefined || entry.collection === collection));
  if (news.length === 0) return undefined;
  return [...news].sort((a, b) => a.entryIndex - b.entryIndex)[0]?.absoluteOutput;
}

/**
 * Absolute `__internal__valueChunkOutputBase` from one resolve — the only authority STB/preflight
 * may use when published trailing geometry is known (no independent publishedBase+local invent).
 */
export function absoluteValueChunkOutputBaseFromResolve(params: {
  publishedBase: number;
  blockSize: number;
  trailingBase: number;
  trailingCapacity?: number;
  valueChunkBandOffset?: number;
  valueChunkCollection?: string;
  valueChunkCount?: number;
  participant?: number;
}): number {
  const witnesses = resolveParticipantAbsoluteWitnesses({
    participant: params.participant ?? 0,
    publishedBase: params.publishedBase,
    blockSize: params.blockSize,
    trailingBase: params.trailingBase,
    trailingCapacity: params.trailingCapacity,
    valueChunkBandOffset: params.valueChunkBandOffset ?? 0,
    valueChunkCollection: params.valueChunkCollection,
    valueChunkCount: params.valueChunkCount ?? 1,
  });
  if (witnesses.valueChunkOutputBase === undefined) {
    throw new Error('layout-resolver: valueChunkOutputBase unresolved for published trailing geometry');
  }
  return Number(witnesses.valueChunkOutputBase);
}

/**
 * Assert unlocker layout witnesses match one resolveParticipantAbsoluteWitnesses result.
 * Used by preflight / STB so coordinates cannot be independently reconstructed.
 */
export function assertUnlockerLayoutMatchesResolve(params: {
  inputs: ReadonlyArray<{ name: string }>;
  params: readonly unknown[];
  publishedBase: number;
  blockSize: number;
  trailingBase: number;
  trailingCapacity?: number;
  dynChunkCount?: number;
  valueChunkBandOffset?: number;
  valueChunkCollection?: string;
  valueChunkCount?: number;
  predOuts?: readonly {
    witnessName: string;
    physicalLocalOffset: number;
    concreteLocalSlot?: number;
  }[];
  participant?: number;
}): void {
  const expected = resolveParticipantAbsoluteWitnesses({
    participant: params.participant ?? 0,
    publishedBase: params.publishedBase,
    blockSize: params.blockSize,
    trailingBase: params.trailingBase,
    trailingCapacity: params.trailingCapacity,
    dynChunkCount: params.dynChunkCount,
    valueChunkBandOffset: params.valueChunkBandOffset,
    valueChunkCollection: params.valueChunkCollection,
    valueChunkCount: params.valueChunkCount,
    predOuts: params.predOuts,
  });
  for (const [index, input] of params.inputs.entries()) {
    const actual = params.params[index];
    if (input.name === '__internal__valueChunkOutputBase'
      && expected.valueChunkOutputBase !== undefined) {
      if (actual !== expected.valueChunkOutputBase) {
        throw new Error(
          formatLayoutInvariant({
            invariantId: 'valueChunk-resolve-mismatch',
            participant: params.participant ?? 0,
            resource: 'valueChunkOutputBase',
            expectedOutput: Number(expected.valueChunkOutputBase),
            actualOutput: typeof actual === 'bigint' ? Number(actual) : -1,
            detail: 'unlocker valueChunk must equal resolveParticipantAbsoluteWitnesses',
          }),
        );
      }
    }
    if (input.name === '__internal__dynamicChunkInputBase'
      && expected.dynamicChunkInputBase !== undefined) {
      if (actual !== expected.dynamicChunkInputBase) {
        throw new Error(
          formatLayoutInvariant({
            invariantId: 'dyn-resolve-mismatch',
            participant: params.participant ?? 0,
            resource: 'dynamicChunkInputBase',
            expectedOutput: Number(expected.dynamicChunkInputBase),
            actualOutput: typeof actual === 'bigint' ? Number(actual) : -1,
            detail: 'unlocker dyn base must equal resolveParticipantAbsoluteWitnesses',
          }),
        );
      }
    }
    const predMatch = /^__internal__(vmapBatchPredOut_\d+)$/.exec(input.name);
    if (predMatch && typeof actual === 'bigint' && actual >= 0n) {
      const want = expected.predOuts.get(input.name)
        ?? expected.predOuts.get(`__internal__${predMatch[1]}`);
      if (want !== undefined && actual !== want) {
        throw new Error(
          formatLayoutInvariant({
            invariantId: 'predOut-resolve-mismatch',
            participant: params.participant ?? 0,
            resource: input.name,
            expectedOutput: Number(want),
            actualOutput: Number(actual),
            detail: 'unlocker PredOut must equal resolveParticipantAbsoluteWitnesses',
          }),
        );
      }
    }
  }
}

/**
 * One-shot absolute witness table for a participant frame.
 *
 * When `transactionParticipants` is provided (compose production path), the participant is packed
 * inside one transaction-global `resolveTransactionLayout` — absolutes are taken from that layout
 * (no solo rebase). `publishedBase` must equal the layout's `inputBase` for the participant.
 */
export function resolveParticipantAbsoluteWitnesses(params: {
  participant: number;
  contractName?: string;
  publishedBase: number;
  blockSize: number;
  trailingBase: number;
  trailingCapacity?: number;
  /** Preserved dyn chunk count; omit when the unlocker has no dyn-base witness. */
  dynChunkCount?: number;
  /** Value-chunk offset within the trailing band (0 = first trailing value-chunk slot). */
  valueChunkBandOffset?: number;
  valueChunkCollection?: string;
  valueChunkCount?: number;
  predOuts?: readonly {
    witnessName: string;
    physicalLocalOffset: number;
    concreteLocalSlot?: number;
  }[];
  entryNews?: readonly { collection?: string; entryIndex?: number }[];
  ownership?: readonly ResourceOwnershipClaim[];
  /**
   * Full participant set for transaction-global packing (compose production authority).
   * When omitted, resolves a solo participant at base 0 then rebases by `publishedBase`.
   */
  transactionParticipants?: readonly SymbolicParticipantLayout[];
  nonParticipantInputPrefix?: number;
  nonParticipantOutputPrefix?: number;
}): {
  layout: ResolvedLayout;
  dynamicChunkInputBase?: bigint;
  entryNewOutputBase?: bigint;
  valueChunkOutputBase?: bigint;
  predOuts: ReadonlyMap<string, bigint>;
} {
  const solo: SymbolicParticipantLayout = {
    participant: params.participant,
    contractName: params.contractName,
    blockLayout: {
      blockSize: params.blockSize,
      trailingBase: params.trailingBase,
      trailingCapacity: params.trailingCapacity,
      slots: [],
    },
  };
  const participants = params.transactionParticipants ?? [solo];
  // Prefer caller-supplied ownership (compose production). Otherwise synthesize from active claims.
  let ownership: ResourceOwnershipClaim[] = [...(params.ownership ?? [])];
  if (ownership.length === 0) {
    if (params.dynChunkCount !== undefined && params.dynChunkCount > 0) {
      ownership.push({
        participant: params.participant,
        carrier: 'dynamicState',
        roles: {},
        rangeWidth: params.dynChunkCount,
      });
    }
    if (params.valueChunkBandOffset !== undefined) {
      ownership.push({
        participant: params.participant,
        carrier: 'valueChunk',
        collection: params.valueChunkCollection ?? 'valueChunk',
        roles: {},
        rangeWidth: params.valueChunkCount ?? 1,
      });
    }
    for (const pred of params.predOuts ?? []) {
      ownership.push({
        participant: params.participant,
        carrier: 'sortedBatch',
        collection: pred.witnessName,
        roles: {},
      });
    }
  }

  const layout = resolveTransactionLayout({
    participants,
    nonParticipantInputPrefix: params.nonParticipantInputPrefix,
    nonParticipantOutputPrefix: params.nonParticipantOutputPrefix,
    dynamicBandClaims: params.dynChunkCount === undefined || params.dynChunkCount <= 0
      ? undefined
      : [{
        participant: params.participant,
        chunkCount: params.dynChunkCount,
      }],
    entryNewClaims: params.entryNews?.map((entry) => ({
      participant: params.participant,
      collection: entry.collection,
      entryIndex: entry.entryIndex,
    })),
    valueChunkClaims: params.valueChunkBandOffset === undefined ? undefined : [{
      participant: params.participant,
      collection: params.valueChunkCollection ?? 'valueChunk',
      bandOffset: params.valueChunkBandOffset,
      chunkCount: params.valueChunkCount ?? 1,
    }],
    predOutClaims: params.predOuts?.map((pred) => predOutClaimFromPhysicalRoute({
      participant: params.participant,
      witnessName: pred.witnessName,
      physicalLocalOffset: pred.physicalLocalOffset,
      concreteLocalSlot: pred.concreteLocalSlot,
    })),
    ownership,
  });

  const resolvedParticipant = layout.participants.find((entry) => entry.participant === params.participant);
  if (resolvedParticipant === undefined) {
    throw new Error(`layout-resolver: participant ${params.participant} missing from resolved layout`);
  }
  if (params.transactionParticipants !== undefined
    && resolvedParticipant.inputBase !== params.publishedBase) {
    throw new Error(
      formatLayoutInvariant({
        invariantId: 'published-base-mismatch',
        participant: params.participant,
        expectedOutput: resolvedParticipant.inputBase,
        actualOutput: params.publishedBase,
        detail: 'compose publishedBase must equal transaction-global inputBase',
      }),
    );
  }

  const encodeAbs = (absolute: number): bigint => encodeLayoutCoordinate({
    kind: 'coordinate', index: absolute,
  });

  if (params.transactionParticipants === undefined) {
    // Legacy solo path: layout packed at 0; rebase into the aggregate published base.
    const rebase = (localAbsolute: number): bigint => encodeLayoutCoordinate(
      rebaseLayoutCoordinate({ kind: 'coordinate', index: localAbsolute }, params.publishedBase),
    );
    const dyn = dynamicChunkInputBaseFor(layout, params.participant);
    const entry = entryNewOutputBaseFor(layout, params.participant);
    const valueChunk = valueChunkOutputBaseFor(layout, params.participant);
    const predOuts = new Map<string, bigint>();
    for (const pred of layout.predOuts) {
      predOuts.set(pred.witnessName, rebase(pred.physicalLocalOffset));
    }
    return {
      layout,
      dynamicChunkInputBase: dyn === undefined ? undefined : rebase(dyn),
      entryNewOutputBase: entry === undefined ? undefined : rebase(entry),
      valueChunkOutputBase: valueChunk === undefined ? undefined : rebase(valueChunk),
      predOuts,
    };
  }

  // Transaction-global path: absolutes are already transaction-scoped — no arithmetic after resolve.
  const dyn = dynamicChunkInputBaseFor(layout, params.participant);
  const entry = entryNewOutputBaseFor(layout, params.participant);
  const valueChunk = valueChunkOutputBaseFor(layout, params.participant);
  const predOuts = new Map<string, bigint>();
  for (const pred of layout.predOuts) {
    if (pred.participant !== params.participant) continue;
    predOuts.set(pred.witnessName, encodeAbs(pred.absoluteOutput));
  }
  return {
    layout,
    dynamicChunkInputBase: dyn === undefined ? undefined : encodeAbs(dyn),
    entryNewOutputBase: entry === undefined ? undefined : encodeAbs(entry),
    valueChunkOutputBase: valueChunk === undefined ? undefined : encodeAbs(valueChunk),
    predOuts,
  };
}

/** One participant's layout claims for deferred multi-claim batch layout resolve deferred multi-claim batch resolve. */
export interface ComposeParticipantLayoutClaims {
  participant: number;
  contractName?: string;
  publishedBase: number;
  blockSize: number;
  trailingBase: number;
  trailingCapacity?: number;
  dynChunkCount?: number;
  valueChunkBandOffset?: number;
  valueChunkCollection?: string;
  valueChunkCount?: number;
  predOuts?: readonly {
    witnessName: string;
    physicalLocalOffset: number;
    concreteLocalSlot?: number;
  }[];
  entryNews?: readonly { collection?: string; entryIndex?: number }[];
  ownership?: readonly ResourceOwnershipClaim[];
}

export type ComposeParticipantAbsoluteWitnesses = {
  dynamicChunkInputBase?: bigint;
  entryNewOutputBase?: bigint;
  valueChunkOutputBase?: bigint;
  predOuts: ReadonlyMap<string, bigint>;
};

/**
 * Deferred multi-claim batch layout resolve: one deferred multi-claim batch resolve for every compose participant.
 * Packs `transactionParticipants` once, merges all dyn/valueChunk/PredOut/ownership claims,
 * calls `resolveTransactionLayout` once, then projects per-participant absolute witnesses.
 */
export function resolveComposeTransactionLayoutAuthority(params: {
  participants: readonly ComposeParticipantLayoutClaims[];
  transactionParticipants: readonly SymbolicParticipantLayout[];
  nonParticipantInputPrefix?: number;
  nonParticipantOutputPrefix?: number;
}): {
  layout: ResolvedLayout;
  witnessesByParticipant: ReadonlyMap<number, ComposeParticipantAbsoluteWitnesses>;
} {
  if (params.participants.length === 0) {
    throw new Error('layout-resolver: resolveComposeTransactionLayoutAuthority requires ≥1 participant claim');
  }

  const ownership: ResourceOwnershipClaim[] = [];
  const dynamicBandClaims: { participant: number; chunkCount: number }[] = [];
  const entryNewClaims: { participant: number; collection?: string; entryIndex?: number }[] = [];
  const valueChunkClaims: {
    participant: number;
    collection: string;
    bandOffset: number;
    chunkCount: number;
  }[] = [];
  const predOutClaims: ReturnType<typeof predOutClaimFromPhysicalRoute>[] = [];

  for (const claim of params.participants) {
    if (claim.ownership !== undefined && claim.ownership.length > 0) {
      ownership.push(...claim.ownership);
    } else {
      if (claim.dynChunkCount !== undefined && claim.dynChunkCount > 0) {
        ownership.push({
          participant: claim.participant,
          carrier: 'dynamicState',
          roles: {},
          rangeWidth: claim.dynChunkCount,
        });
      }
      if (claim.valueChunkBandOffset !== undefined) {
        ownership.push({
          participant: claim.participant,
          carrier: 'valueChunk',
          collection: claim.valueChunkCollection ?? 'valueChunk',
          roles: {},
          rangeWidth: claim.valueChunkCount ?? 1,
        });
      }
      for (const pred of claim.predOuts ?? []) {
        ownership.push({
          participant: claim.participant,
          carrier: 'sortedBatch',
          collection: pred.witnessName,
          roles: {},
        });
      }
    }
    // Include zero-width dyn bands so `__internal__dynamicChunkInputBase` still resolves to
    // inputBase+trailingBase (empty trailing marker). Omitting count===0 left unlockers with the
    // provisional local trailingBase and caused transaction layout authority dyn-base drift (e.g. 53 vs publishedBase+53).
    if (claim.dynChunkCount !== undefined) {
      dynamicBandClaims.push({
        participant: claim.participant,
        chunkCount: claim.dynChunkCount,
      });
    }
    for (const entry of claim.entryNews ?? []) {
      entryNewClaims.push({
        participant: claim.participant,
        collection: entry.collection,
        entryIndex: entry.entryIndex,
      });
    }
    if (claim.valueChunkBandOffset !== undefined) {
      valueChunkClaims.push({
        participant: claim.participant,
        collection: claim.valueChunkCollection ?? 'valueChunk',
        bandOffset: claim.valueChunkBandOffset,
        chunkCount: claim.valueChunkCount ?? 1,
      });
    }
    for (const pred of claim.predOuts ?? []) {
      predOutClaims.push(predOutClaimFromPhysicalRoute({
        participant: claim.participant,
        witnessName: pred.witnessName,
        physicalLocalOffset: pred.physicalLocalOffset,
        concreteLocalSlot: pred.concreteLocalSlot,
      }));
    }
  }

  const { layout, witnessesByParticipant } = resolveTransactionLayoutWitnesses({
    participants: params.transactionParticipants,
    nonParticipantInputPrefix: params.nonParticipantInputPrefix,
    nonParticipantOutputPrefix: params.nonParticipantOutputPrefix,
    dynamicBandClaims: dynamicBandClaims.length > 0 ? dynamicBandClaims : undefined,
    entryNewClaims: entryNewClaims.length > 0 ? entryNewClaims : undefined,
    valueChunkClaims: valueChunkClaims.length > 0 ? valueChunkClaims : undefined,
    predOutClaims: predOutClaims.length > 0 ? predOutClaims : undefined,
    ownership,
  });

  for (const claim of params.participants) {
    const resolved = layout.participants.find((entry) => entry.participant === claim.participant);
    if (resolved === undefined) {
      throw new Error(
        `layout-resolver: participant ${claim.participant} missing from batch-resolved layout`,
      );
    }
    if (resolved.inputBase !== claim.publishedBase) {
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'published-base-mismatch',
          participant: claim.participant,
          expectedOutput: resolved.inputBase,
          actualOutput: claim.publishedBase,
          detail: 'compose publishedBase must equal transaction-global inputBase (batch resolve)',
        }),
      );
    }
  }

  return { layout, witnessesByParticipant };
}

/**
 * Compose production entry for one participant's layout witnesses under a transaction-global pack.
 * Prefer `resolveComposeTransactionLayoutAuthority` when ≥1 participants' claims are known;
 * this single-participant entry delegates to that batch API (deferred multi-claim batch layout resolve).
 * Runs for every publishedBase including 0 (participant 0); apply may no-op when local==absolute.
 */
export function resolveComposeParticipantLayoutAuthority(params: {
  participant: number;
  contractName?: string;
  publishedBase: number;
  blockSize: number;
  trailingBase: number;
  trailingCapacity?: number;
  dynChunkCount?: number;
  valueChunkBandOffset?: number;
  valueChunkCollection?: string;
  valueChunkCount?: number;
  predOuts?: readonly {
    witnessName: string;
    physicalLocalOffset: number;
  }[];
  entryNews?: readonly { collection?: string; entryIndex?: number }[];
  transactionParticipants: readonly SymbolicParticipantLayout[];
  ownership?: readonly ResourceOwnershipClaim[];
  nonParticipantInputPrefix?: number;
  nonParticipantOutputPrefix?: number;
}): ReturnType<typeof resolveParticipantAbsoluteWitnesses> {
  const { layout, witnessesByParticipant } = resolveComposeTransactionLayoutAuthority({
    participants: [{
      participant: params.participant,
      contractName: params.contractName,
      publishedBase: params.publishedBase,
      blockSize: params.blockSize,
      trailingBase: params.trailingBase,
      trailingCapacity: params.trailingCapacity,
      dynChunkCount: params.dynChunkCount,
      valueChunkBandOffset: params.valueChunkBandOffset,
      valueChunkCollection: params.valueChunkCollection,
      valueChunkCount: params.valueChunkCount,
      predOuts: params.predOuts,
      entryNews: params.entryNews,
      ownership: params.ownership,
    }],
    transactionParticipants: params.transactionParticipants,
    nonParticipantInputPrefix: params.nonParticipantInputPrefix,
    nonParticipantOutputPrefix: params.nonParticipantOutputPrefix,
  });
  const projected = witnessesByParticipant.get(params.participant);
  if (projected === undefined) {
    throw new Error(
      `layout-resolver: participant ${params.participant} missing from batch witness projection`,
    );
  }
  return {
    layout,
    dynamicChunkInputBase: projected.dynamicChunkInputBase,
    entryNewOutputBase: projected.entryNewOutputBase,
    valueChunkOutputBase: projected.valueChunkOutputBase,
    predOuts: projected.predOuts,
  };
}

/**
 * Production entry: resolve one transaction-global layout for every participant, then project
 * per-participant absolute witnesses. Compose must prefer this over solo rebases.
 */
export function resolveTransactionLayoutWitnesses(
  input: LayoutResolverInput,
): {
  layout: ResolvedLayout;
  witnessesByParticipant: ReadonlyMap<number, {
    dynamicChunkInputBase?: bigint;
    entryNewOutputBase?: bigint;
    valueChunkOutputBase?: bigint;
    predOuts: ReadonlyMap<string, bigint>;
  }>;
} {
  const layout = resolveTransactionLayout(input);
  const encodeAbs = (absolute: number): bigint => encodeLayoutCoordinate({
    kind: 'coordinate', index: absolute,
  });
  const witnessesByParticipant = new Map<number, {
    dynamicChunkInputBase?: bigint;
    entryNewOutputBase?: bigint;
    valueChunkOutputBase?: bigint;
    predOuts: ReadonlyMap<string, bigint>;
  }>();
  for (const participant of layout.participants) {
    const dyn = dynamicChunkInputBaseFor(layout, participant.participant);
    const entry = entryNewOutputBaseFor(layout, participant.participant);
    const valueChunk = valueChunkOutputBaseFor(layout, participant.participant);
    const predOuts = new Map<string, bigint>();
    for (const pred of layout.predOuts) {
      if (pred.participant !== participant.participant) continue;
      predOuts.set(pred.witnessName, encodeAbs(pred.absoluteOutput));
    }
    witnessesByParticipant.set(participant.participant, {
      dynamicChunkInputBase: dyn === undefined ? undefined : encodeAbs(dyn),
      entryNewOutputBase: entry === undefined ? undefined : encodeAbs(entry),
      valueChunkOutputBase: valueChunk === undefined ? undefined : encodeAbs(valueChunk),
      predOuts,
    });
  }
  return { layout, witnessesByParticipant };
}

export type ParticipantAbsoluteWitnesses = ReturnType<typeof resolveParticipantAbsoluteWitnesses>;

/**
 * Write resolved absolutes into an unlocker `params` array. Compose must mutate
 * `__internal__dynamicChunkInputBase` / `__internal__valueChunkOutputBase` /
 * `__internal__vmapBatchPredOut_*` **only** through this helper so unit tests can drive the
 * shipped fill path without inventing a second oracle.
 *
 * validate-all-then-write: validate-all-then-write — stage every intended mutation first; commit only after every
 * slot validates. A late failure leaves earlier params untouched.
 */
export function applyParticipantAbsoluteWitnesses(args: {
  inputs: readonly { name: string }[];
  /** Mutated in place after full validation. */
  params: unknown[];
  witnesses: Pick<
    ParticipantAbsoluteWitnesses,
    'dynamicChunkInputBase' | 'valueChunkOutputBase' | 'predOuts'
  >;
  participant?: number;
  /** Restrict an alias update to the witness slots it actually delegates to this resolve. */
  onlyIndices?: readonly number[];
}): {
  written: Array<{ name: string; index: number; from: string; to: string }>;
} {
  const isInactiveSentinel = (value: unknown): boolean => {
    if (typeof value !== 'bigint') return false;
    const decoded = decodeLayoutCoordinate(value);
    return decoded.kind === 'absent' || decoded.kind === 'inactive';
  };

  type StagedWrite = { index: number; name: string; from: string; to: bigint };
  const staged: StagedWrite[] = [];
  const onlyIndices = args.onlyIndices === undefined ? undefined : new Set(args.onlyIndices);

  for (const [index, input] of args.inputs.entries()) {
    if (onlyIndices !== undefined && !onlyIndices.has(index)) continue;
    if (input.name === '__internal__dynamicChunkInputBase') {
      if (args.witnesses.dynamicChunkInputBase === undefined) {
        // Slot present but this frame did not claim a dyn band (inactive / absent).
        if (isInactiveSentinel(args.params[index])) continue;
        throw new Error(
          formatLayoutInvariant({
            invariantId: 'dynamic-chunk-base-unresolved',
            participant: args.participant,
            resource: 'dynamicChunkInputBase',
            detail: 'applyParticipantAbsoluteWitnesses: slot present but witness missing',
          }),
        );
      }
      const current = args.params[index];
      const next = typeof current === 'bigint' && current < -2n
        ? -args.witnesses.dynamicChunkInputBase - 3n
        : args.witnesses.dynamicChunkInputBase;
      if (args.params[index] !== next) {
        staged.push({
          index, name: 'dynamicChunkInputBase', from: String(args.params[index]), to: next,
        });
      }
      continue;
    }
    if (input.name === '__internal__valueChunkOutputBase') {
      if (args.witnesses.valueChunkOutputBase === undefined) {
        if (isInactiveSentinel(args.params[index])) continue;
        throw new Error(
          formatLayoutInvariant({
            invariantId: 'value-chunk-base-unresolved',
            participant: args.participant,
            resource: 'valueChunkOutputBase',
            detail: 'applyParticipantAbsoluteWitnesses: slot present but witness missing',
          }),
        );
      }
      const next = args.witnesses.valueChunkOutputBase;
      if (args.params[index] !== next) {
        staged.push({
          index, name: 'valueChunkOutputBase', from: String(args.params[index]), to: next,
        });
      }
      continue;
    }
    const predMatch = /^__internal__(vmapBatchPredOut_\d+)$/.exec(input.name);
    if (predMatch) {
      const shortName = predMatch[1]!;
      const absolute = args.witnesses.predOuts.get(input.name)
        ?? args.witnesses.predOuts.get(`__internal__${shortName}`);
      if (absolute === undefined) {
        // Inactive PredOut stays at its negative sentinel; only active claims must resolve.
        if (isInactiveSentinel(args.params[index])) continue;
        throw new Error(
          formatLayoutInvariant({
            invariantId: 'pred-out-unresolved',
            participant: args.participant,
            resource: shortName,
            detail: 'applyParticipantAbsoluteWitnesses: PredOut slot present but witness missing',
          }),
        );
      }
      if (args.params[index] !== absolute) {
        staged.push({
          index, name: shortName, from: String(args.params[index]), to: absolute,
        });
      }
    }
  }

  // Commit only after every slot validated — no partial writes on late failure.
  const written: Array<{ name: string; index: number; from: string; to: string }> = [];
  for (const entry of staged) {
    args.params[entry.index] = entry.to;
    written.push({
      name: entry.name, index: entry.index, from: entry.from, to: String(entry.to),
    });
  }
  return { written };
}
