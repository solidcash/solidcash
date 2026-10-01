/**
 * phase-boundary extract: pure value-chunk / participant-span / return-event geometry helpers
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import type { AbiFunction, Artifact, FunctionBlockLayout } from '@solidcash/utils';
import type { TransportedContinuationResourceClaim } from './ValueChunkProducerIdentity.js';

/**
 * The in-block return NFT is owned by one logical callsite. A later write fused onto the first
 * FakeToken group copies its layout; the earlier view must not read that writer's success flag.
 */
/** Structural participant/return-event shape (avoids importing late ExternalCallUtxoGroup). */
export type InBlockReturnGroup = {
  sharedGroupIndex?: number;
  returnEventInBlock?: boolean;
  fusedReturnGroupIndex?: number;
  blockLayout?: FunctionBlockLayout;
  functionName?: string;
  logicalFunctionName?: string;
  compilerRoute?: { abiFunction?: AbiFunction };
  externalContract?: { inner?: { artifact?: Artifact } };
  loopReturnCommitments?: Uint8Array[];
};

export function groupOwnsInBlockReturnEvent(
  groups: ReadonlyArray<InBlockReturnGroup>,
  groupIdx: number,
): boolean {
  const child = groups[groupIdx];
  if (!child) return false;
  const physicalIdx = child.sharedGroupIndex ?? groupIdx;
  const physical = groups[physicalIdx];
  if (!physical?.returnEventInBlock) return false;
  if (!physical.blockLayout?.slots.some((slot) => slot.kind === 'returnEvent')) return false;
  // A rolled logical call needs consecutive return slots. Its commitments can live on a shared/fused callsite
  // rather than the physical representative, so ownership must follow the stable logical owner metadata. A
  // single physical returnEvent cannot represent a multi-part result family.
  const logicalOwner = groups[child.fusedReturnGroupIndex ?? groupIdx] ?? child;
  if ((logicalOwner.loopReturnCommitments?.length ?? 0) > 1) return false;
  const writesState = (group: InBlockReturnGroup): boolean => {
    // Prefer the logical Solidity function. `__forward` is a proxy dispatcher marked
    // writesState, but the first logical callsite on that master is often a view.
    const names = [group.logicalFunctionName, group.functionName].filter(
      (name): name is string => !!name && name !== '__forward',
    );
    const abiList = (group.externalContract?.inner?.artifact?.abi as AbiFunction[] | undefined) ?? [];
    return names.some((name) => {
      const abi = abiList.find((fn) => fn.name === name)
        ?? (name === group.functionName ? group.compilerRoute?.abiFunction : undefined);
      return abi?.writesState === true;
    });
  };
  // A state-writing logical callsite owns the physical block's return slot. If a later writer is fused onto the
  // same master, earlier views keep dedicated tails so they cannot read that writer's result. A standalone view
  // has no competing writer: its physical representative owns the declared in-block slot.
  if (writesState(child)) return true;
  const hasWriter = groups.some((candidate, index) => (
    (candidate.sharedGroupIndex ?? index) === physicalIdx && writesState(candidate)
  ));
  return !hasWriter && groupIdx === physicalIdx;
}

/** Writer groups share the fused in-block identity; views keep their own group index. */
export function logicalReturnGroupIndex(
  groups: ReadonlyArray<InBlockReturnGroup>,
  groupIdx: number,
): number {
  const group = groups[groupIdx];
  if (!group) return groupIdx;
  return groupOwnsInBlockReturnEvent(groups, groupIdx)
    ? group.fusedReturnGroupIndex ?? groupIdx
    : groupIdx;
}

export type PhysicalReturnGroup = InBlockReturnGroup & {
  categoryId: string;
  functionName?: string;
  returnOutputIndex?: number;
  plannedReturnOutputIndex?: number;
  dataNftUtxos?: { length: number };
  blockInputs?: { length: number };
  loopReturnCommitments?: { length: number };
  batchPredecessorOutputs?: Array<{ outputBlockSlot: number }>;
  valueChunkOutputCount?: number;
};

export type MaterializedReturnEvent = {
  categoryId: string;
  commitment: Uint8Array;
  identity: string;
  provisional?: boolean;
};

export type ExternalCallReturnCoordinate = {
  groupIndex: number;
  part: number;
};

export function parseExternalCallReturnCoordinate(identity: string): ExternalCallReturnCoordinate | undefined {
  const match = /^external-call:(\d+)(?::(\d+))?$/.exec(identity);
  if (!match) return undefined;
  return {
    groupIndex: Number(match[1]),
    part: match[2] === undefined ? 0 : Number(match[2]),
  };
}

export type MaterializedReturnGroup = InBlockReturnGroup & {
  categoryId: string;
  precomputedReturnCommitment?: Uint8Array;
  loopReturnCommitments?: Uint8Array[];
};

/**
 * Select the one authoritative commitment for each logical tail-return coordinate.
 *
 * `external-call:N:0` is the independently evaluated logical result while
 * `external-call:N` is the result extracted from the participant probe. Both name
 * part zero; materializing both lets insertion order overwrite a canonical EVM word
 * with a provisional/minimal VM number. Read-only calls already have an authenticated
 * precomputed result (their state block is preserved), so that typed commitment wins.
 * For writers, a non-provisional probe result supersedes its provisional seed.
 */
export function selectMaterializedTailReturnEvents(
  groups: ReadonlyArray<MaterializedReturnGroup>,
  pending: ReadonlyArray<MaterializedReturnEvent>,
): MaterializedReturnEvent[] {
  const parsed = pending.map((event, order) => {
    const match = /^external-call:(\d+)(?::(\d+))?$/.exec(event.identity);
    return {
      event,
      order,
      groupIndex: match ? Number(match[1]) : undefined,
      part: match?.[2] === undefined ? 0 : Number(match[2]),
      whole: match !== null && match[2] === undefined,
    };
  });
  const selected: Array<{ event: MaterializedReturnEvent; order: number; part: number }> = parsed
    .filter((entry) => entry.groupIndex === undefined)
    .map((entry) => ({ event: entry.event, order: entry.order, part: entry.part }));

  for (const [groupIndex, group] of groups.entries()) {
    if (groupOwnsInBlockReturnEvent(groups, groupIndex)) continue;
    const candidates = parsed.filter((entry) => entry.groupIndex === groupIndex);
    // Authoritative precomputed / rolled-loop commitments must materialize even when pending was
    // cleared between seedPrecomputedReturnEvents and build (common on Marketplace publishJobPost).
    // Requiring pending candidates here dropped meceTags(tags_[i]) returns so meceCount stayed 0.
    const authoritativeParts = (group.loopReturnCommitments?.length ?? 0) > 0
      ? group.loopReturnCommitments
      : group.precomputedReturnCommitment === undefined
        ? undefined
        : [group.precomputedReturnCommitment];
    if (authoritativeParts) {
      const firstOrder = candidates.length > 0
        ? Math.min(...candidates.map((candidate) => candidate.order))
        : selected.length;
      for (const [part, commitment] of authoritativeParts.entries()) {
        selected.push({
          event: {
            categoryId: group.categoryId,
            commitment,
            identity: `external-call:${groupIndex}:${part}`,
            provisional: false,
          },
          order: firstOrder + part,
          part,
        });
      }
      continue;
    }
    if (candidates.length === 0) continue;

    const parts = [...new Set(candidates.map((candidate) => candidate.part))].sort((left, right) => left - right);
    for (const part of parts) {
      const atPart = candidates.filter((candidate) => candidate.part === part);
      const numbered = atPart.find((candidate) => !candidate.whole);
      const whole = part === 0 ? atPart.find((candidate) => candidate.whole) : undefined;
      const chosen = whole && whole.event.provisional !== true
        ? whole
        : numbered && numbered.event.provisional !== true
          ? numbered
          : whole ?? numbered;
      if (chosen) selected.push({ event: chosen.event, order: chosen.order, part });
    }
  }

  return selected
    .sort((left, right) => left.order - right.order || left.part - right.part)
    .map(({ event }) => event);
}

/**
 * After input assembly (including any minting-band rotation), map each returning
 * group onto the physical output that will actually carry its return NFT.
 *
 * In-block returns are `findMintingInputIndex(category) + returnSlot`. Appended
 * tails keep their planned indices unless they overlap a callee's physical block
 * (the transferFrom 22→26 rotate is the usual case); colliding tails are packed
 * after the last occupied participant output, proxy `__forward` first.
 */
/**
 * ERC-20 writers that co-spend FakeToken's minting UTXO and collide with the
 * publishJobEvent value-chunk band. `transfer` (timeout refund) is the same
 * occupant as `transferFrom` (escrow debit); occupancy that only names
 * transferFrom leaves the refund group's master on jobEvents and lets view-tail
 * repack overwrite a callee lock (updateJobPost input-5 @ output 20).
 */
export function isMintingBandTokenWriter(name: string | undefined): boolean {
  return name === 'transferFrom' || name === 'transfer' || name === 'approve';
}

/** Only these sit on FakeToken's minting UTXO *and* collide with jobEvents. */
export function isMintingBandSwapFunction(name: string | undefined): boolean {
  return name === 'transferFrom' || name === 'transfer';
}

export type CompilerTokenWriterGroup = {
  functionName?: string;
  logicalFunctionName?: string;
  compilerRoute?: { abiFunction?: AbiFunction };
  logicalArtifact?: Artifact;
  externalContract?: { inner?: { artifact?: Artifact } };
};

/**
 * Classify a stateful participant from compiler-published mapping effects. Two or more written entry resources
 * identify the wide writer shape which historically required the minting-band swap; a one-entry writer still
 * owns occupancy but does not require that relocation. Source names are compatibility-only when no effect list
 * was published.
 */
export function isCompilerDescribedMintingBandWriter(
  group: CompilerTokenWriterGroup,
  requireWideWriter = false,
  ownerConvention?: 'legacy-unroll' | 'kernel-row-loop',
): boolean {
  const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
  const logicalName = group.logicalFunctionName ?? group.functionName;
  const abiFunction = group.compilerRoute?.abiFunction
    ?? artifact?.abi?.find((candidate) => candidate.name === logicalName);
  if (abiFunction?.entryAccesses !== undefined) {
    const writtenEntries = abiFunction.entryAccesses.filter((access) => access.operations.includes('write'));
    return abiFunction.writesState === true
      && writtenEntries.length >= (requireWideWriter ? 2 : 1);
  }
  // Kernel artifacts publish the resource authority used by layout planning. Missing entry effects in that
  // convention mean "not described", never permission to recover legacy geometry from an ABI name.
  if (ownerConvention === 'kernel-row-loop') return false;
  if ([group.logicalArtifact, group.externalContract?.inner?.artifact]
    .some((candidateArtifact) => candidateArtifact?.messageBus?.convention === 'kernel-row-loop')) {
    return false;
  }
  const legacyName = group.functionName ?? group.logicalFunctionName ?? abiFunction?.name;
  return requireWideWriter
    ? isMintingBandSwapFunction(legacyName)
    : isMintingBandTokenWriter(legacyName);
}

/**
 * Restore an authenticated continuation run whenever transaction geometry can
 * displace it. The decision is entirely structural: the operation's source
 * name does not affect mutable-NFT conservation.
 */
export function shouldRestorePersistedContinuationInputs(parts: {
  initialWrite: boolean;
  mintingBandWriter: boolean;
  persisted: boolean;
  hasBand: boolean;
  hasCategory: boolean;
}): boolean {
  return !parts.initialWrite
    && parts.mintingBandWriter
    && parts.persisted
    && parts.hasBand
    && parts.hasCategory;
}

/** In-block extraTransfer return after the minting master (post-rotate). */
/**
 * Canonicalize a scalar writer return for the encoding its callee covenant
 * authenticates. VM booleans use `01`, native ABI booleans use the pushdata
 * opcode `51`, and Solidity ABI booleans use a 32-byte word.
 *
 * A zero provisional value for a state-writing boolean is an unset probe seed;
 * read-only boolean zero remains a legitimate `false` result.
 */
export function canonicalWriterReturnCommitment(parts: {
  pendingHex?: string;
  writesState?: boolean;
  evmBool?: boolean;
  returnsBool?: boolean;
}): string {
  const evmBool = parts.evmBool === true;
  const boolTrue = evmBool ? `${'00'.repeat(31)}01` : '51';
  const boolFalse = evmBool ? `${'00'.repeat(31)}00` : '00';
  const defaultBool = parts.writesState === true ? boolTrue : boolFalse;
  const pending = (parts.pendingHex ?? '').toLowerCase();
  if (parts.returnsBool !== true) return pending || '00';
  if (pending === '' || /^0+$/.test(pending)) return defaultBool;
  if (evmBool) {
    if (pending === boolFalse || pending === boolTrue) return pending;
    return pending === '01' || pending === '51' ? boolTrue : defaultBool;
  }
  return pending === '01' || pending === '51' ? boolTrue : defaultBool;
}

/** Authenticated return observations outrank provisional layout seeds. */
export function shouldReplaceReturnEventCommitment(
  existingProvisional: boolean | undefined,
  incomingProvisional: boolean,
): boolean {
  return existingProvisional === true || incomingProvisional === false;
}

/** True when every byte is 0x00 (empty ABI bool / unset probe seed). */
export function isAllZeroCommitment(commitment: Uint8Array | string): boolean {
  if (typeof commitment === 'string') {
    const hex = commitment.startsWith('0x') ? commitment.slice(2) : commitment;
    return hex.length > 0 && /^0+$/i.test(hex);
  }
  return commitment.length > 0 && commitment.every((byte) => byte === 0);
}

export function tokenWriterReturnIndex(
  master: number,
  blockLayout?: { blockSize?: number; slots?: ReadonlyArray<{ kind: string; offset: number }> },
  band?: { start: number; end: number },
  occupied?: ReadonlySet<number>,
): number {
  const returnSlot = blockLayout?.slots?.find((slot) => slot.kind === 'returnEvent');
  const inBlock = master + (returnSlot?.offset ?? (blockLayout?.blockSize ?? 8) - 1);
  // Persist nNew=3 at 25–27 collides with FakeToken extraTransfer at master+7.
  // Marketplace EQUALVERIFYs dest master+7 live; only slide when that dest is
  // inside the jobEvents band. Identity SCIDs on dest 31 are overwritten.
  let dest = (band && inBlock >= band.start && inBlock <= band.end) ? band.end + 1 : inBlock;
  if (occupied && dest !== inBlock) {
    while (occupied.has(dest)) dest += 1;
  }
  return dest;
}

/** Persist dests, SCID identity dests, and the live jobEvents band. */

/** Keep FakeToken relocation metadata once the minting master is already past the chunk band. */
export function shouldRetainMintingOutputSwap(
  start: number,
  chunkBase: number,
  nNew: number,
  previous?: { from: number; width: number; categoryId: string },
  categoryId?: string,
): boolean {
  if (!previous || previous.categoryId !== categoryId || start < chunkBase) return false;
  return start >= chunkBase + nNew || start === previous.from + previous.width;
}

/** Output width of the publishJobEvent / value-chunk band that FakeToken must clear. */
/**
 * Extra real signer funders so `_swapMintingOffValueChunkBand` can clear a
 * jobEvents band wider than the historical 4-wide rotate. Timeout refunds
 * need nNew=6 and only had 5 trailing P2PKH; one more unused wallet UTXO
 * (not a synthetic outpoint) lets FakeToken start at 26.
 */
/** Physical owner index → live value-chunk count (shared rows fold onto the owner). */
export function liveChunkSlotsByOwner(
  groups: ReadonlyArray<{
    sharedGroupIndex?: number;
    valueChunkOutputCount?: number;
    functionName?: string;
    logicalFunctionName?: string;
  }>,
  ownerConvention?: 'legacy-unroll' | 'kernel-row-loop',
): Map<number, number> {
  const byOwner = new Map<number, number>();
  for (const [index, group] of groups.entries()) {
    if (isCompilerDescribedMintingBandWriter(group, true, ownerConvention)) continue;
    const owner = group.sharedGroupIndex ?? index;
    const nNew = group.valueChunkOutputCount ?? 0;
    byOwner.set(owner, Math.max(byOwner.get(owner) ?? 0, nNew));
  }
  return byOwner;
}

/** Value-chunk width owned by one logical call row, including rows shared with it. */
export function liveChunkWidthForGroup(
  groups: ReadonlyArray<{
    sharedGroupIndex?: number;
    valueChunkOutputCount?: number;
    functionName?: string;
    logicalFunctionName?: string;
  }>,
  groupIndex: number,
  ownerConvention?: 'legacy-unroll' | 'kernel-row-loop',
): number {
  if (groupIndex < 0 || groupIndex >= groups.length) return 0;
  const owner = groups[groupIndex].sharedGroupIndex ?? groupIndex;
  return liveChunkSlotsByOwner(groups, ownerConvention).get(owner) ?? 0;
}

/** Complete coordinate span reserved by a participant, including output-only slots. */
export function physicalParticipantWidth(group: PhysicalReturnGroup): number {
  const layout = group.blockLayout ?? group.compilerRoute?.abiFunction?.blockLayout;
  const declaredSpan = layout?.slots.reduce(
    (width, slot) => Math.max(width, slot.offset + 1),
    0,
  ) ?? 0;
  return Math.max(
    1,
    1 + (group.dataNftUtxos?.length ?? 0),
    layout?.blockSize ?? 0,
    declaredSpan,
    group.blockInputs?.length ?? 0,
  );
}

/** Physical span after dynamic bands have resolved any in-block return destination. */
export function materializedParticipantWidth(
  group: PhysicalReturnGroup,
  master: number,
  band?: { start: number; end: number },
): number {
  const declared = physicalParticipantWidth(group);
  if (master < 0 || group.returnEventInBlock !== true
    || !group.blockLayout?.slots.some((slot) => slot.kind === 'returnEvent')) {
    return declared;
  }
  return Math.max(
    declared,
    tokenWriterReturnIndex(master, group.blockLayout, band) - master + 1,
  );
}

/** Whether a complete participant span intersects a half-open dynamic-output lane. */
export function participantSpanOverlapsLane(
  master: number,
  width: number,
  lane: { start: number; endExclusive: number },
): boolean {
  return master < lane.endExclusive && master + width > lane.start;
}

/** First independent participant whose physical block overlaps a dynamic-output band it does not own. */
export function collidingParticipantGroupIndex(
  groups: ReadonlyArray<PhysicalReturnGroup>,
  findMintingInputIndex: (categoryId: string) => number,
  band: { start: number; end: number },
  ownerConvention?: 'legacy-unroll' | 'kernel-row-loop',
): number {
  for (const [groupIdx, group] of groups.entries()) {
    if (group.sharedGroupIndex !== undefined) continue;
    if (liveChunkWidthForGroup(groups, groupIdx, ownerConvention) > 0) continue;
    const master = findMintingInputIndex(group.categoryId);
    if (master < 0) continue;
    const width = physicalParticipantWidth(group);
    if (master <= band.end && master + width > band.start) return groupIdx;
  }
  return -1;
}

export type TokenBandRepairOwnerSelection =
  | { status: 'absent' }
  | { status: 'ambiguous' }
  | { status: 'exact'; groupIndex: number; categoryId: string; masterIndex: number };

/** Select the unique compiler-laid-out participant whose physical block intersects a foreign dynamic band. */
export function selectTokenBandRepairOwner(
  groups: ReadonlyArray<PhysicalReturnGroup>,
  findMintingInputIndex: (categoryId: string) => number,
  band: { start: number; end: number } | undefined,
  ownerConvention?: 'legacy-unroll' | 'kernel-row-loop',
): TokenBandRepairOwnerSelection {
  if (!band) return { status: 'absent' };
  const owners = new Map<string, Extract<TokenBandRepairOwnerSelection, { status: 'exact' }>>();
  for (const [groupIndex, group] of groups.entries()) {
    if (group.sharedGroupIndex !== undefined
      || liveChunkWidthForGroup(groups, groupIndex, ownerConvention) > 0) continue;
    const masterIndex = findMintingInputIndex(group.categoryId);
    if (masterIndex < 0) continue;
    const width = physicalParticipantWidth(group);
    if (masterIndex > band.end || masterIndex + width <= band.start) continue;
    owners.set(`${masterIndex}:${group.categoryId.toLowerCase()}`, {
      status: 'exact', groupIndex, categoryId: group.categoryId, masterIndex,
    });
  }
  if (owners.size === 0) return { status: 'absent' };
  return owners.size === 1 ? [...owners.values()][0] : { status: 'ambiguous' };
}

/** Pads after a proxy [master, ...data] so FakeToken starts past impl+trailingBase+nNew. */
export function proxyValueChunkPadCount(parts: {
  insertBase: number;
  chunkSlots: number;
  prefixLength: number;
}): number {
  return Math.max(0, parts.insertBase + parts.chunkSlots - parts.prefixLength);
}

/** Disposable inputs required to move a fixed participant past a dynamic output band. */
export function participantRelocationExtraFunders(parts: {
  active: boolean;
  requiredShift: number;
  participantPadding: number;
}): number {
  if (!parts.active) return 0;
  return Math.max(0, parts.requiredShift) + Math.max(0, parts.participantPadding);
}

export function valueChunkBandWidth(parts: {
  minimum?: number;
  planned?: number;
  jobEventsCount?: number;
  derivedEnd?: number;
  chunkBase?: number;
}): number {
  const derivedWidth = parts.derivedEnd !== undefined && parts.chunkBase !== undefined
    ? Math.max(0, parts.derivedEnd - parts.chunkBase + 1)
    : 0;
  return Math.max(parts.minimum ?? 3, parts.planned ?? 0, parts.jobEventsCount ?? 0, derivedWidth);
}

/** Total trailing width reserved by ordered per-resource continuation bands. */
export function valueChunkBandWidthForContinuationClaims(
  claims: readonly Pick<TransportedContinuationResourceClaim, 'chunkCount'>[],
  parts: {
    minimum?: number;
    planned?: number;
    jobEventsCount?: number;
    derivedEnd?: number;
    chunkBase?: number;
  } = {},
): number {
  const claimed = claims.reduce((width, claim) => width + Math.max(0, claim.chunkCount), 0);
  return valueChunkBandWidth({ ...parts, planned: Math.max(parts.planned ?? 0, claimed) });
}

/** First output coordinate available before a reverse-indexed authenticated suffix and its terminal anchor. */
export function continuationOutputBaseBeforeSuffix(
  outputCount: number,
  authenticatedSuffixCount: number,
  minimumFixedPrefix = 0,
): number {
  if (authenticatedSuffixCount <= 0) return outputCount;
  return Math.min(outputCount, Math.max(minimumFixedPrefix, outputCount - authenticatedSuffixCount - 1));
}

/** Prefer a planner-owned continuation band; allocate before the authenticated suffix only when none exists. */
export function selectValueChunkOutputBase(parts: {
  plannedBandStart?: number;
  usesPlannedBand: boolean;
  fallbackBase: number;
}): number {
  if (parts.usesPlannedBand && parts.plannedBandStart !== undefined) return parts.plannedBandStart;
  return parts.fallbackBase;
}


/**
 * Extra occupancy for view-tail packing. Tails that already sit *before* the
 * live jobEvents band (arbitratorRegistered at 17, meceTags at 19) must stay;
 * moving them after a getEvents-populated write-count makes the next
 * updateJobPost read an empty bool (ip 8913 "arbitrator not registered").
 * Only tails that land inside the band are pushed past `band.end`.
 */
export function viewTailOccupancyCap(
  plannedTails: readonly number[],
  band?: { start: number; end: number },
): number {
  if (!band) return -1;
  return plannedTails.some((index) => index >= band.start && index <= band.end)
    ? band.end
    : -1;
}

export type ViewTailPackOptions = {
  band?: { start: number; end: number };
  /** First reserved suffix index (OP_RETURN / jobs). Tails must not land here. */
  suffixStart?: number;
  tokenWriterPresent?: boolean;
};

/**
 * Keep planned view witnesses (16/17) when a prior getEvents grew nNew and
 * packing would land on the jobEvents band or the terminal OP_RETURN. A
 * FakeToken writer still parks tails after its swapped block.
 */
export function clampViewTailPlacement(parts: {
  planned: number;
  packed: number;
  band?: { start: number; end: number };
  suffixStart?: number;
  tokenWriterPresent?: boolean;
}): number {
  const onBand = (index: number): boolean => (
    parts.band !== undefined && index >= parts.band.start && index <= parts.band.end
  );
  const onSuffix = (index: number): boolean => (
    parts.suffixStart !== undefined && index >= parts.suffixStart
  );
  const plannedSafe = parts.planned >= 0 && !onBand(parts.planned) && !onSuffix(parts.planned);
  const packedPastBand = !parts.tokenWriterPresent && parts.band !== undefined
    && parts.packed > parts.band.end;
  if (onBand(parts.packed) || onSuffix(parts.packed) || packedPastBand) {
    if (plannedSafe) return parts.planned;
    // A prior FakeToken park (29+) leaked into a view-only probe. Sit just after
    // the implementation (band.start - blockSize + 1 === impl+1).
    if (!parts.tokenWriterPresent && parts.band) return Math.max(0, parts.band.start - 4);
    return parts.packed;
  }
  if (!parts.tokenWriterPresent && parts.band && plannedSafe
    && parts.planned < parts.band.start && parts.packed > parts.band.end) {
    return parts.planned;
  }
  return parts.packed;
}

/** Occupancy width: planned write, last extracted/persisted v, and already-derived slots. */
export function liveJobEventsBandWidth(parts: {
  plannedWidth?: number;
  persistWidth?: number;
  derivedWidth?: number;
}): number {
  const observedWidth = (parts.derivedWidth ?? 0) > 0
    ? parts.derivedWidth ?? 0
    : parts.persistWidth ?? 0;
  return Math.min(32, Math.max(
    0,
    parts.plannedWidth ?? 0,
    observedWidth,
  ));
}

/**
 * Exclusive end of the `INPUTINDEX * scale - k` 1:1 preserve window used by
 * delegate epilogues (`scale = 1 + dataNftCount`). Chunks must start at or after this.
 */
export function scaledInputPreserveExclusiveEnd(inputIndex: number, scale: number): number {
  if (inputIndex < 0 || scale <= 1) return -1;
  return inputIndex * scale;
}

/** `INPUTINDEX * scale - 1`: delegate epilogue event/OTC pin (impl 5 → output 24). */
export function scaledEventOutputIndex(inputIndex: number, scale: number): number {
  const endExclusive = scaledInputPreserveExclusiveEnd(inputIndex, scale);
  return endExclusive < 0 ? -1 : endExclusive - 1;
}
