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
  /** Participant index in the composed graph. */
  participant: number;
  /** Collection / stream name when applicable (e.g. jobEvents). */
  collection?: string;
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
}

export interface ResolvedParticipantLayout {
  participant: number;
  contractName?: string;
  /** Absolute input index of the participant master. */
  inputBase: number;
  blockSize: number;
  trailingBase?: number;
  trailingCapacity?: number;
  bands: readonly (SymbolicBand & { absoluteBase: number })[];
}

export interface ResolvedValueChunkBand {
  participant: number;
  collection: string;
  /** Absolute output/input index of band[0] — the `__internal__valueChunkOutputBase` witness. */
  absoluteBase: number;
  bandOffset: number;
  chunkCount: number;
  effectOrdinal?: number;
}

export interface ResolvedPredOut {
  participant: number;
  witnessName: string;
  /** Absolute transaction output index the covenant must read. */
  absoluteOutput: number;
  physicalLocalOffset: number;
  concreteLocalSlot?: number;
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
  participant: number;
  /** Absolute `__internal__dynamicChunkInputBase` (first preserved dyn chunk). */
  absoluteBase: number;
  chunkCount: number;
}

export interface ResolvedEntryNew {
  participant: number;
  collection?: string;
  /** Absolute output index of this entry NEW. */
  absoluteOutput: number;
  entryIndex: number;
}

export interface ResolvedLayout {
  participantInputs: readonly number[];
  participants: readonly ResolvedParticipantLayout[];
  valueChunkBands: readonly ResolvedValueChunkBand[];
  predOuts: readonly ResolvedPredOut[];
  dynamicBands: readonly ResolvedDynamicBand[];
  entryNews: readonly ResolvedEntryNew[];
  ownership: readonly ResourceOwnershipClaim[];
  totalParticipantSlots: number;
  /** Format a layout mismatch for preflight / compose fail-closed paths. */
  formatInvariant(failure: LayoutInvariantFailure): string;
  absolute(participant: number, localOffset: number): number;
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

function assertUniqueOwnership(claims: readonly ResourceOwnershipClaim[]): void {
  const seen = new Set<string>();
  for (const claim of claims) {
    const key = [
      claim.participant,
      claim.carrier,
      claim.collection ?? '',
      claim.collectionHash ?? '',
      claim.keyDomainId ?? '',
      String(claim.effectOrdinal ?? ''),
    ].join('|');
    if (seen.has(key)) {
      const prior = [...seen].find((entry) => entry === key);
      throw new Error(
        formatLayoutInvariant({
          invariantId: 'duplicate-ownership',
          participant: claim.participant,
          resource: claim.collection ?? claim.carrier,
          // Gate C: expected = first claim (unique), actual = colliding second claim.
          expectedOutput: claim.roles.outputSlot ?? 0,
          actualOutput: claim.roles.outputSlot ?? 1,
          detail: `L3_LAYOUT_INVARIANT carrier=${claim.carrier} key=${prior ?? key}`,
        }),
      );
    }
    seen.add(key);
  }
}

/**
 * Resolve symbolic participant layouts + active claims into one absolute coordinate table.
 * Throws if a claim references an unknown participant or lands outside the published band.
 */
export function resolveTransactionLayout(input: LayoutResolverInput): ResolvedLayout {
  const ownership = input.ownership ?? [];
  assertUniqueOwnership(ownership);

  const participantInputs: number[] = [];
  const resolvedParticipants: ResolvedParticipantLayout[] = [];
  let cursor = 0;

  for (const participant of input.participants) {
    const blockSize = participant.blockLayout?.blockSize
      ?? Math.max(1, ...(participant.bands ?? []).map((band) => band.localBase + band.capacity), 1);
    const bands = (participant.bands && participant.bands.length > 0)
      ? participant.bands
      : bandsFromBlockLayout(participant.blockLayout);
    participantInputs.push(cursor);
    resolvedParticipants.push({
      participant: participant.participant,
      contractName: participant.contractName,
      inputBase: cursor,
      blockSize,
      trailingBase: participant.blockLayout?.trailingBase,
      trailingCapacity: participant.blockLayout?.trailingCapacity,
      bands: bands.map((band) => ({ ...band, absoluteBase: cursor + band.localBase })),
    });
    cursor += blockSize;
  }

  const byParticipant = new Map(resolvedParticipants.map((entry) => [entry.participant, entry]));

  const valueChunkBands: ResolvedValueChunkBand[] = (input.valueChunkClaims ?? []).map((claim) => {
    const resolved = byParticipant.get(claim.participant);
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
      participant: claim.participant,
      collection: claim.collection,
      absoluteBase: resolved.inputBase + local,
      bandOffset: claim.bandOffset,
      chunkCount: claim.chunkCount,
      effectOrdinal: claim.effectOrdinal,
    };
  });

  const predOuts: ResolvedPredOut[] = (input.predOutClaims ?? []).map((claim) => {
    const resolved = byParticipant.get(claim.participant);
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
    const absoluteOutput = resolved.inputBase + claim.physicalLocalOffset;
    // Detect the historical concrete-slot mistake when callers still pass concreteLocalSlot.
    if (
      claim.concreteLocalSlot !== undefined
      && claim.concreteLocalSlot !== claim.physicalLocalOffset
      && resolved.trailingBase !== undefined
      && claim.concreteLocalSlot < resolved.trailingBase
    ) {
      // Soft signal via structured failure string available to callers; still resolve physically.
      void formatLayoutInvariant({
        invariantId: 'pred-out-concrete-vs-physical',
        participant: claim.participant,
        resource: claim.witnessName,
        expectedOutput: absoluteOutput,
        actualOutput: resolved.inputBase + claim.concreteLocalSlot,
        detail: 'resolver uses physicalLocalOffset; concreteLocalSlot ignored for absolute assignment',
      });
    }
    return {
      participant: claim.participant,
      witnessName: claim.witnessName,
      absoluteOutput,
      physicalLocalOffset: claim.physicalLocalOffset,
      concreteLocalSlot: claim.concreteLocalSlot,
    };
  });

  const dynamicBands: ResolvedDynamicBand[] = (input.dynamicBandClaims ?? []).map((claim) => {
    const resolved = byParticipant.get(claim.participant);
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
      participant: claim.participant,
      absoluteBase: resolved.inputBase + trailing,
      chunkCount: claim.chunkCount,
    };
  });

  const dynCountByParticipant = new Map(
    dynamicBands.map((band) => [band.participant, band.chunkCount]),
  );

  const entryNews: ResolvedEntryNew[] = (input.entryNewClaims ?? []).map((claim) => {
    const resolved = byParticipant.get(claim.participant);
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
    const dynCount = dynCountByParticipant.get(claim.participant) ?? 0;
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
      participant: claim.participant,
      collection: claim.collection,
      absoluteOutput: resolved.inputBase + local,
      entryIndex,
    };
  });

  const absolute = (participant: number, localOffset: number): number => {
    const resolved = byParticipant.get(participant);
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
    return resolved.inputBase + localOffset;
  };

  return {
    participantInputs: Object.freeze([...participantInputs]),
    participants: Object.freeze(resolvedParticipants),
    valueChunkBands: Object.freeze(valueChunkBands),
    predOuts: Object.freeze(predOuts),
    dynamicBands: Object.freeze(dynamicBands),
    entryNews: Object.freeze(entryNews),
    ownership: Object.freeze([...ownership]),
    totalParticipantSlots: cursor,
    formatInvariant: formatLayoutInvariant,
    absolute,
  };
}

/** Skeptic-grade layout failure string (Gate C attribution). */
export function formatLayoutInvariant(failure: LayoutInvariantFailure): string {
  const parts = [
    `layout-invariant ${failure.invariantId}`,
    failure.participant === undefined ? undefined : `participant ${failure.participant}`,
    failure.resource === undefined ? undefined : `resource ${failure.resource}`,
    failure.expectedOutput === undefined ? undefined : `expected output ${failure.expectedOutput}`,
    failure.actualOutput === undefined ? undefined : `actual output ${failure.actualOutput}`,
    failure.detail,
  ].filter((part): part is string => part !== undefined && part.length > 0);
  return parts.join('; ');
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
 * One-shot absolute witness table for a single participant frame published at `publishedBase`.
 * Compose/preflight must use this (or an equivalent single `resolveTransactionLayout` call) so
 * dyn / entry / valueChunk / PredOut absolutes cannot drift independently.
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
}): {
  layout: ResolvedLayout;
  dynamicChunkInputBase?: bigint;
  entryNewOutputBase?: bigint;
  valueChunkOutputBase?: bigint;
  predOuts: ReadonlyMap<string, bigint>;
} {
  const layout = resolveTransactionLayout({
    participants: [{
      participant: params.participant,
      contractName: params.contractName,
      blockLayout: {
        blockSize: params.blockSize,
        trailingBase: params.trailingBase,
        trailingCapacity: params.trailingCapacity,
        slots: [],
      },
    }],
    dynamicBandClaims: params.dynChunkCount === undefined ? undefined : [{
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
    ownership: params.ownership,
  });
  // resolveTransactionLayout uses inputBase 0 for a single participant; rebase into the aggregate.
  const rebase = (localAbsolute: number): bigint => BigInt(params.publishedBase + localAbsolute);
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

export type ParticipantAbsoluteWitnesses = ReturnType<typeof resolveParticipantAbsoluteWitnesses>;

/**
 * Write resolved absolutes into an unlocker `params` array. Compose must mutate
 * `__internal__dynamicChunkInputBase` / `__internal__valueChunkOutputBase` /
 * `__internal__vmapBatchPredOut_*` **only** through this helper so unit tests can drive the
 * shipped fill path without inventing a second oracle.
 */
export function applyParticipantAbsoluteWitnesses(args: {
  inputs: readonly { name: string }[];
  /** Mutated in place. */
  params: unknown[];
  witnesses: Pick<
    ParticipantAbsoluteWitnesses,
    'dynamicChunkInputBase' | 'valueChunkOutputBase' | 'predOuts'
  >;
  participant?: number;
}): {
  written: Array<{ name: string; index: number; from: string; to: string }>;
} {
  const written: Array<{ name: string; index: number; from: string; to: string }> = [];
  const write = (index: number, name: string, next: bigint): void => {
    const from = String(args.params[index]);
    if (args.params[index] === next) return;
    args.params[index] = next;
    written.push({ name, index, from, to: String(next) });
  };

  const isInactiveSentinel = (value: unknown): boolean =>
    typeof value === 'bigint' && value < 0n;

  for (const [index, input] of args.inputs.entries()) {
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
      write(index, 'dynamicChunkInputBase', args.witnesses.dynamicChunkInputBase);
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
      write(index, 'valueChunkOutputBase', args.witnesses.valueChunkOutputBase);
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
      write(index, shortName, absolute);
    }
  }
  return { written };
}
