/* eslint-disable @typescript-eslint/no-loop-func */
import {
  StateLayout,
  EntryAccessAbi,
  buildPushdataCommitment,
  encodeNftIndexTag,
  buildEntryCommitment,
  buildEntryCommitmentMultiKey,
  parseEntryCommitment,
  parsePushdataCommitment,
  getDefaultStateValue,
  encodePushdataValue,
  encodeEventCommitment,
  EventDefinitionAbi,
  StateValue,
  FunctionBlockLayout,
  AbiFunction,
  BlockSlotKind,
  attachDecodedAccessors,
  buildChunkCommitment,
  buildEntryNftCovenantScript,
  computeCollectionHash,
  computeCollectionSignature,
  dynamicChunkSignature,
  splitValueIntoChunks,
  splitValueIntoValueChunks,
  Artifact,
  VALUE_HEAD_SIZE,
  VALUE_CHUNK_SIZE,
  encodeChunkableValueTail,
  buildValueChunkCommitment,
  sha256 as sha256Sync,
  encodeInt,
  Op,
  blockInputOffset,
  blockInputSize,
  isOutputOnlyBlockSlot,
} from '@solidcash/utils';
import {
  binToHex, hexToBin, isHex, encodeTransaction, createVirtualMachineBch2026, utf8ToBin,
  lockingBytecodeToCashAddress, encodeDataPush,
} from '@bitauth/libauth';
import { getDustThreshold } from '@mem-cash/validation';
import {
  buildEventNftCovenantScript, computeEventNameHash, buildSidecarRedeem,
  sidecarLockingBytecode, scriptToBytecode,
} from '@solidcash/utils';
import { TransactionBuilder, TransactionBuilderOptions } from '../TransactionBuilder.js';
import {
  buildEcrecoverComputeSidecars, computeEcrecoverWitness, probeEcrecoverSplit,
} from '../ecrecover/ecrecoverComputeSidecar.js';
import { CovenantTransactionBuilder } from './CovenantTransactionBuilder.js';
import {
  addressToLockScript, scriptToLockingBytecode, generateLibauthSourceOutputs, calculateDust,
} from '../utils.js';
import type { LibauthOutput, Output, ReceiptEvent } from '../interfaces.js';
import { attachWait } from '../wait.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import { onMockNetworkProviderReset } from '../network/MockNetworkProvider.js';
import {
  assertFinalizedTransactionBytes, assertFinalizedTransactionCovenants,
  finalizedByteGateOptionsForProvider, inputSubjectsOfBuilder,
} from '../message-bus/preflight.js';
import { parseEventCommitment } from './StateReader.js';
import {
  Utxo, UnlockableUtxo, TransactionDetails, isContractUnlocker, isP2PKHUnlocker, Unlocker,
} from '../interfaces.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import {
  createDataNftUnlocker, createRelocatedDataNftUnlocker, createValueChunkUnlocker,
  getValueChunkLockingBytecode,
} from './covenant-helpers.js';
import {
  canMaterializeRepairedValueChunk,
  canApplyRepairedNftCommitment,
  followsMutableNftOutputGuard,
  isActiveVmControlBranch,
  isFixedStateRepairSlot,
  isForwardOutputOnlyRepairSlot,
  isOwnedStateRepairCoordinate,
  isRepairableNftOutput,
} from './computed-output-repair.js';
import { isScidIdentityCommitment } from './logical-identity.js';
import { encodeEntryCommitment, isEmptyValueEntryCommitment, keyToSlot } from './SortedList.js';
import { artifactUsesSolidityAbi } from './solidityAbi.js';
import {
  buildKeccakComputeSidecar, extractKeccakPreimageFromTrace,
} from '../keccak/keccakComputeSidecar.js';

const decodeVmScriptNumber = (bytes: Uint8Array): bigint => {
  let value = 0n;
  const negative = bytes.length > 0 && (bytes[bytes.length - 1] & 0x80) !== 0;
  for (let index = bytes.length - 1; index >= 0; index--) {
    const byte = index === bytes.length - 1 ? bytes[index] & 0x7f : bytes[index];
    value = (value << 8n) | BigInt(byte);
  }
  return negative ? -value : value;
};

const cloneToken = <T extends Utxo['token']>(token: T): T => (token === undefined
  ? token
  : { ...token, nft: token.nft === undefined ? undefined : { ...token.nft } } as T);

const persistedJobEventsByCategory = new Map<string, Array<{
  commitment: string; lockingBytecode: Uint8Array; categoryId?: string;
}>>();
const observedValueChunksByCollection = new Map<string, AuthenticatedValueChunk[]>();
const persistedJobEventsValues = new Map<string, Uint8Array>();
const persistedJobEventsLocks = new Map<string, Uint8Array>();
const persistedJobEventsSpends = new Map<string, Array<{
  txid: string;
  vout: number;
  satoshis: bigint;
  token: NonNullable<Utxo['token']>;
  lockingBytecode: Uint8Array;
}>>();
const persistedJobEventsRecipes = new Map<string, {
  slot: Uint8Array;
  root: Uint8Array;
  collection: string;
  categoryId: string;
}>();
const persistedValueChunkWrites = new Map<string, {
  value: Uint8Array; lockingBytecode: Uint8Array; width: number;
  recipe: { slot: Uint8Array; root: Uint8Array; collection: string; categoryId: string };
}>();
const invalidatePersistedValueChunkWrites = (categoryId: string): void => {
  const prefix = `${categoryId.toLowerCase()}:`;
  for (const key of persistedValueChunkWrites.keys()) {
    if (key.startsWith(prefix)) persistedValueChunkWrites.delete(key);
  }
};
const stagedJobEventsValues = new Map<string, Uint8Array>();
const createdDigestLocks = new Set<string>();
const persistedCreatedValues = new Map<string, Uint8Array>();
let persistedJobEventsSendReady = false;
/** Persist-v empty root. Dest-18 UPDATE HASH256es redeem(this), not sha256(Created blob). */
const EMPTY_PERSIST_ROOT = sha256Sync(new Uint8Array());

function isCreatedPersistValue(value: Uint8Array | undefined): boolean {
  if (!value || value.length === 0) return false;
  const hex = binToHex(value);
  return hex.includes('4372656174') || hex.includes('00004cb4');
}

/**
 * The in-block return NFT is owned by one logical callsite. A later write fused onto the first
 * FakeToken group copies its layout; the earlier view must not read that writer's success flag.
 */
type InBlockReturnGroup = Pick<
  ExternalCallUtxoGroup,
  'sharedGroupIndex' | 'returnEventInBlock' | 'fusedReturnGroupIndex' | 'blockLayout'
  | 'functionName' | 'logicalFunctionName' | 'compilerRoute' | 'externalContract'
>;

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

type MaterializedReturnGroup = InBlockReturnGroup & {
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
    if (candidates.length === 0) continue;

    const authoritativeParts = (group.loopReturnCommitments?.length ?? 0) > 0
      ? group.loopReturnCommitments
      : group.precomputedReturnCommitment === undefined
        ? undefined
        : [group.precomputedReturnCommitment];
    if (authoritativeParts) {
      const firstOrder = Math.min(...candidates.map((candidate) => candidate.order));
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
export function tokenWriterOccupiedDests(parts: {
  band?: { start: number; end: number };
  persistDests?: readonly number[];
  tokenMaster?: number;
  /** Persist UPDATE + FakeToken only. Initialize persist must not move first-publish dest 31. */
  reserveIdentityDests?: boolean;
  outputs?: ReadonlyArray<{ token?: { nft?: { commitment?: string } } }>;
}): Set<number> {
  const occupied = new Set<number>();
  if (parts.band) {
    for (let index = parts.band.start; index <= parts.band.end; index++) occupied.add(index);
  }
  for (const dest of parts.persistDests ?? []) {
    if (dest >= 0) occupied.add(dest);
  }
  // Identity SCIDs land on the in-block return dest (master+7) before the
  // return NFT is placed. Reserve that dest and the next three so extraTransfer
  // EQUALVERIFYs dest 35, not dest 31's SCID. First publishJobPost still
  // EQUALVERIFYs dest 31 even if initialize persist left persistDests nonempty.
  if (parts.reserveIdentityDests && parts.tokenMaster !== undefined && parts.tokenMaster >= 0) {
    const identityStart = parts.tokenMaster + 7;
    for (let index = identityStart; index < identityStart + 4; index++) occupied.add(index);
  }
  for (const [index, output] of (parts.outputs ?? []).entries()) {
    const commit = String(output?.token?.nft?.commitment ?? '').toLowerCase();
    if (commit.startsWith('53434944')) occupied.add(index);
  }
  return occupied;
}

/**
 * One occupancy identity for persist dests + extraTransfer: dest 18 persist and
 * dest 31–34 SCIDs only when persist UPDATE keeps the layout under FakeToken.
 */
export function persistAndTokenWriterOccupancy(parts: {
  persistReady: boolean;
  firstPublish: boolean;
  hasTokenWriter: boolean;
  implIndex: number;
  band?: { start: number; end: number; nNew?: number };
  tokenMaster?: number;
  outputs?: ReadonlyArray<{ token?: { nft?: { commitment?: string } } }>;
}): Set<number> {
  const keepAtLayout = shouldKeepPersistAtLayoutBase({
    persistReady: parts.persistReady,
    firstPublish: parts.firstPublish,
    layoutDestOccupiedByMintingWriter: parts.hasTokenWriter,
  });
  return tokenWriterOccupiedDests({
    band: parts.band,
    persistDests: persistUpdatePredecessorDests({
      implIndex: parts.implIndex,
      persistUpdate: parts.persistReady && !parts.firstPublish,
      keepAtLayout,
      bandStart: parts.band?.start ?? -1,
      nNew: parts.band?.nNew ?? 0,
    }),
    tokenMaster: parts.tokenMaster,
    // extraTransfer EQUALVERIFYs master+7 (dest 31). Identity SCIDs must not
    // steal that dest; the return NFT overwrites it. First-publish dest 31 is
    // the same in-block return.
    reserveIdentityDests: false,
    outputs: parts.outputs,
  });
}

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
): Map<number, number> {
  const byOwner = new Map<number, number>();
  for (const [index, group] of groups.entries()) {
    if (isMintingBandSwapFunction(group.functionName ?? group.logicalFunctionName)) continue;
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
): number {
  if (groupIndex < 0 || groupIndex >= groups.length) return 0;
  const owner = groups[groupIndex].sharedGroupIndex ?? groupIndex;
  return liveChunkSlotsByOwner(groups).get(owner) ?? 0;
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

/** First independent participant whose physical block overlaps a dynamic-output band it does not own. */
export function collidingParticipantGroupIndex(
  groups: ReadonlyArray<PhysicalReturnGroup>,
  findMintingInputIndex: (categoryId: string) => number,
  band: { start: number; end: number },
): number {
  for (const [groupIdx, group] of groups.entries()) {
    if (group.sharedGroupIndex !== undefined) continue;
    if (liveChunkWidthForGroup(groups, groupIdx) > 0) continue;
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
): TokenBandRepairOwnerSelection {
  if (!band) return { status: 'absent' };
  const owners = new Map<string, Extract<TokenBandRepairOwnerSelection, { status: 'exact' }>>();
  for (const [groupIndex, group] of groups.entries()) {
    if (group.sharedGroupIndex !== undefined || liveChunkWidthForGroup(groups, groupIndex) > 0) continue;
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

/** First output coordinate available before a reverse-indexed authenticated suffix and its terminal anchor. */
export function continuationOutputBaseBeforeSuffix(
  outputCount: number,
  authenticatedSuffixCount: number,
): number {
  if (authenticatedSuffixCount <= 0) return outputCount;
  return Math.max(0, outputCount - authenticatedSuffixCount - 1);
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

/** Find a contiguous, token-free balanced range which can carry a relocated computed-value continuation. */
export function findDisposableValueChunkOutputBase(
  outputs: readonly Output[],
  inputs: readonly Pick<UnlockableUtxo, 'token'>[],
  width: number,
  reserved: ReadonlySet<number> = new Set(),
): number | undefined {
  if (!Number.isSafeInteger(width) || width <= 0 || width > outputs.length) return undefined;
  for (let start = outputs.length - width; start >= 0; start -= 1) {
    let available = true;
    for (let offset = 0; offset < width; offset += 1) {
      const index = start + offset;
      if (reserved.has(index) || inputs[index]?.token !== undefined
        || !isDisposableAlignmentPad(outputs[index])) {
        available = false;
        break;
      }
    }
    if (available) return start;
  }
  return undefined;
}

/**
 * Exclusive output range where publishJobEvent value chunks are verified
 * (`INPUTINDEX + blockSize` for `nNew` slots). View tails, FakeToken, and
 * identity pads must not occupy this range.
 */
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

export function computePublishJobEventsBand(parts: {
  implIndex?: number;
  blockSize?: number;
  start?: number;
  plannedWidth?: number;
  jobEventsCount?: number;
  derivedIndices?: readonly number[];
  liveWidth?: number;
  /** Absent-key INSERT places chunks after the NEW node (master+blockSize+1). */
  insertShift?: number;
  /** First index after a 1:1 preserve band the covenant still checks. */
  preserveEndExclusive?: number;
}): { start: number; end: number; nNew: number } | undefined {
  const layoutStart = parts.start ?? (
    parts.implIndex !== undefined && parts.implIndex >= 0
      ? parts.implIndex + (parts.blockSize ?? 5) + (parts.insertShift ?? 0)
      : -1
  );
  const start = Math.max(layoutStart, parts.preserveEndExclusive ?? -1);
  if (start < 0) return undefined;
  const derivedInBand = (parts.derivedIndices ?? []).filter((index) => index >= start);
  const liveWidth = parts.liveWidth ?? 0;
  const nNew = liveWidth > 0
    ? liveWidth
    : valueChunkBandWidth({
      minimum: 1,
      planned: derivedInBand.length > 0
        ? Math.min(parts.plannedWidth ?? Number.POSITIVE_INFINITY, derivedInBand.length)
        : (parts.plannedWidth ?? 0),
      jobEventsCount: parts.jobEventsCount,
      derivedEnd: derivedInBand.length === 0 ? undefined : Math.max(...derivedInBand),
      chunkBase: start,
    });
  if (nNew <= 0) return undefined;
  return { start, end: start + nNew - 1, nNew };
}

type AuthenticatedValueChunk = {
  commitment: string; lockingBytecode: Uint8Array; categoryId?: string;
};

function usableAuthenticatedValueChunks(
  chunks: ReadonlyArray<AuthenticatedValueChunk>,
): AuthenticatedValueChunk[] {
  return chunks.filter((chunk) => {
    if (chunk.commitment.length < 3 || chunk.commitment === '00') return false;
    // A 12-byte 05||00… tail is a padded split, not a live continuation.
    // Keep short stubs (unit tests) and 1-byte occupancy dummies.
    return !(chunk.commitment.length >= 16 && isEmptyValueChunkCommitment(chunk.commitment));
  });
}

/** Recover one canonical, root-addressed run from a cache that may mix versions. */
function coherentAuthenticatedValueChunkRun(
  chunks: ReadonlyArray<AuthenticatedValueChunk>,
): AuthenticatedValueChunk[] {
  const byLock = new Map<string, {
    chunks: Map<number, AuthenticatedValueChunk>;
    lastSeen: number;
  }>();
  for (const [order, chunk] of usableAuthenticatedValueChunks(chunks).entries()) {
    const chunkIndex = valueChunkIndexFromCommitment(chunk.commitment);
    if (chunkIndex === undefined) continue;
    const lock = binToHex(chunk.lockingBytecode);
    const group = byLock.get(lock) ?? { chunks: new Map(), lastSeen: order };
    group.chunks.set(chunkIndex, chunk);
    group.lastSeen = order;
    byLock.set(lock, group);
  }
  let selected: AuthenticatedValueChunk[] = [];
  let selectedAt = -1;
  for (const group of byLock.values()) {
    const run: AuthenticatedValueChunk[] = [];
    for (let index = 0; group.chunks.has(index); index++) run.push(group.chunks.get(index)!);
    if (run.length > selected.length || (run.length === selected.length && group.lastSeen > selectedAt)) {
      selected = run;
      selectedAt = group.lastSeen;
    }
  }
  return selected;
}

/**
 * Prefer a newly authenticated chunk run over a fallback, even when the value
 * became shorter. An unusable observation leaves the prior run intact.
 */
export function selectObservedValueChunkRun(
  fallback: ReadonlyArray<AuthenticatedValueChunk>,
  observed: ReadonlyArray<AuthenticatedValueChunk>,
): AuthenticatedValueChunk[] {
  const current = coherentAuthenticatedValueChunkRun(observed);
  return current.length > 0 ? current : coherentAuthenticatedValueChunkRun(fallback);
}

/** Select the first usable run in explicit authority order. */
function firstUsableValueChunkRun(
  ...runs: ReadonlyArray<ReadonlyArray<AuthenticatedValueChunk>>
): AuthenticatedValueChunk[] {
  for (const run of runs) {
    const usable = coherentAuthenticatedValueChunkRun(run);
    if (usable.length > 0) return usable;
  }
  return [];
}

const MAX_PERSISTED_JOB_EVENTS_BYTES = VALUE_HEAD_SIZE + VALUE_CHUNK_SIZE * 32;

function valueChunkCountFor(value: Uint8Array): number {
  if (value.length <= VALUE_HEAD_SIZE || value.length > MAX_PERSISTED_JOB_EVENTS_BYTES) return 0;
  return Math.ceil((value.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE);
}

/** Live continuation count of the last Updated extract for `categoryId`. */
export function persistedJobEventsWidth(categoryId?: string): number {
  if (!categoryId) {
    let widest = 0;
    for (const chunks of persistedJobEventsByCategory.values()) {
      widest = Math.max(widest, coherentAuthenticatedValueChunkRun(chunks).length);
    }
    for (const value of persistedJobEventsValues.values()) {
      widest = Math.max(widest, valueChunkCountFor(value));
    }
    return Math.min(32, widest);
  }
  const fromChunks = coherentAuthenticatedValueChunkRun(
    persistedJobEventsByCategory.get(categoryId) ?? [],
  ).length;
  const fromValue = valueChunkCountFor(persistedJobEventsValues.get(categoryId) ?? new Uint8Array());
  return Math.min(32, Math.max(fromChunks, fromValue));
}

function jobEventsSlotCandidates(): Uint8Array[] {
  const slots: Uint8Array[] = [keyToSlot(new Uint8Array()), keyToSlot(Uint8Array.of(0x00))];
  for (const type of ['int', 'uint', 'uint256', 'bigint'] as const) {
    try {
      slots.push(keyToSlot(encodePushdataValue(0n, type)));
    } catch { /* type not encodable as a mapping key */ }
  }
  return slots;
}

/** Recover slot+root so the next UPDATE can spend persist chunks with a real unlocker. */
export function rememberJobEventsUnlockRecipe(categoryId: string): boolean {
  const pairs: Array<{ value: Uint8Array; lock: Uint8Array }> = [];
  const localValue = persistedJobEventsValues.get(categoryId);
  const localLock = persistedJobEventsLocks.get(categoryId);
  if (localValue && localLock) pairs.push({ value: localValue, lock: localLock });
  for (const value of persistedJobEventsValues.values()) {
    for (const lock of persistedJobEventsLocks.values()) {
      if (localValue && localLock && value === localValue && lock === localLock) continue;
      pairs.push({ value, lock });
    }
  }
  const collections = [
    'jobEvents',
    'jobEvents:mapping(uint256 => JobEventData[])',
    'jobEvents:mapping(uint256=>JobEventData[])',
  ];
  for (const { value, lock } of pairs) {
    const root = sha256Sync(value);
    for (const slot of jobEventsSlotCandidates()) {
      for (const cat of new Set([categoryId, ...persistedJobEventsLocks.keys(), ...persistedJobEventsValues.keys()])) {
        for (const collection of collections) {
          try {
            const expected = getValueChunkLockingBytecode(cat, collection, slot, root);
            if (binToHex(expected) === binToHex(lock)) {
              const recipe = { slot, root, collection, categoryId: cat };
              persistedJobEventsRecipes.set(categoryId, recipe);
              persistedJobEventsRecipes.set(cat, recipe);
              return true;
            }
          } catch { /* category, collection, or slot rejected */ }
        }
      }
    }
  }
  return false;
}

export function persistedJobEventsUnlockRecipe(categoryId: string): {
  slot: Uint8Array; root: Uint8Array; collection: string; categoryId: string;
} | undefined {
  return latestPersisted(persistedJobEventsRecipes, categoryId);
}

/**
 * Dest-15 UPDATE dest-20 lock: emitValueChunkP2sh32(master category, H(0), sha256(v)).
 * Do not use a persist unlock recipe — that recipe matches the dummy
 * `aa20||sha256(v)||87` first-publish lock, not dest 15's pin.
 */
export function persistValueChunkLock(
  categoryId: string | undefined,
  value?: Uint8Array,
  write?: ValueChunkWriteDescriptor | null,
): Uint8Array | undefined {
  if (!categoryId || !/^[0-9a-f]{64}$/i.test(categoryId) || !value || value.length === 0) {
    return undefined;
  }
  const root = sha256Sync(value);
  if (write === null) return undefined;
  if (write) {
    if (write.categoryId.toLowerCase() !== categoryId.toLowerCase()
      || !/^[0-9a-f]{64}$/i.test(write.keySlot)) return undefined;
    try {
      if (binToHex(computeCollectionHash(write.collectionSignature))
        !== write.collectionHash.toLowerCase()) return undefined;
      return getValueChunkLockingBytecode(
        categoryId, write.collectionSignature, hexToBin(write.keySlot), root,
      );
    } catch {
      return undefined;
    }
  }
  // Compatibility only for artifacts predating exact collection-write descriptors.
  const slot = keyToSlot(new Uint8Array());
  for (const collection of [
    'jobEvents',
    'jobEvents:mapping(uint256 => JobEventData[])',
    'jobEvents:mapping(uint256=>JobEventData[])',
  ]) {
    try {
      return getValueChunkLockingBytecode(categoryId, collection, slot, root);
    } catch { /* collection rejected */ }
  }
  return undefined;
}

/**
 * Stage the value this tx will write. Do not overwrite persist until send succeeds —
 * withdraw must still spend the previous digest.
 */
export function stageJobEventsValue(categoryId: string, value: Uint8Array): void {
  if (value.length <= 60 || value.length > MAX_PERSISTED_JOB_EVENTS_BYTES) return;
  stagedJobEventsValues.delete(categoryId);
  stagedJobEventsValues.set(categoryId, value);
}

/** Full last committed jobEvents blob (not a Created probe). Latest commit wins. */
export function rememberJobEventsValue(categoryId: string, value: Uint8Array): void {
  if (value.length <= 60 || value.length > MAX_PERSISTED_JOB_EVENTS_BYTES) return;
  invalidatePersistedValueChunkWrites(categoryId);
  // Planning knows the value this transaction intends to authenticate. Later
  // VM probes can still encounter a consumed predecessor, so their temporal
  // order does not make them more authoritative than the staged write.
  const authoritative = stagedJobEventsValues.get(categoryId) ?? value;
  persistedJobEventsValues.delete(categoryId);
  persistedJobEventsValues.set(categoryId, authoritative);
  if (isCreatedPersistValue(authoritative) && !persistedCreatedValues.has(categoryId)) {
    persistedCreatedValues.set(categoryId, authoritative);
  }
  rememberJobEventsUnlockRecipe(categoryId);
}

function latestPersisted<T>(map: Map<string, T>, categoryId?: string): T | undefined {
  if (categoryId && map.has(categoryId)) return map.get(categoryId);
  let latest: T | undefined;
  for (const value of map.values()) latest = value;
  return latest;
}

export function persistedJobEventsValue(categoryId: string): Uint8Array | undefined {
  return persistedJobEventsValues.get(categoryId);
}

/** Redeem p2sh32 from emitValueChunkP2sh32 / getValueChunkLockingBytecode — not aa20||sha256(v)||87. */
export function rememberJobEventsLock(categoryId: string, lock: Uint8Array): void {
  if (lock.length !== 35 || lock[0] !== 0xaa || lock[1] !== 0x20 || lock[34] !== 0x87) return;
  // Created digest (first publishJobPost persist) is the UPDATE dest-18 pin.
  // Later persist-v rematerialize must not replace it.
  if (createdDigestLocks.has(categoryId)) return;
  invalidatePersistedValueChunkWrites(categoryId);
  persistedJobEventsLocks.set(categoryId, lock);
  const value = persistedJobEventsValues.get(categoryId)
    ?? latestPersisted(persistedJobEventsValues, categoryId);
  const hex = value ? binToHex(value) : '';
  if (hex.includes('4372656174') || hex.includes('00004cb4')) {
    createdDigestLocks.add(categoryId);
  }
  rememberJobEventsUnlockRecipe(categoryId);
}

export function persistedJobEventsLock(categoryId: string): Uint8Array | undefined {
  return persistedJobEventsLocks.get(categoryId);
}

export interface ValueChunkWriteDescriptor {
  categoryId: string;
  collection: string;
  collectionSignature: string;
  collectionHash: string;
  keySlot: string;
  entryAccessSlot: number;
  routeSlot: number;
  operation: 'insert' | 'update';
  outputBase: number;
  outputCount: number;
}

const valueChunkWriteIdentity = (write: ValueChunkWriteDescriptor): string => [
  write.categoryId.toLowerCase(), write.collectionHash.toLowerCase(), write.keySlot.toLowerCase(),
].join(':');

export type ValueChunkWriteCategorySelection =
  | { status: 'absent' }
  | { status: 'exact'; categoryId: string; write: ValueChunkWriteDescriptor }
  | { status: 'ambiguous' };

/** Select one compiler-described chunkable-value resource identity; duplicate route/logical views collapse. */
export function selectValueChunkWriteCategory(
  writes: ReadonlyArray<ValueChunkWriteDescriptor>,
): ValueChunkWriteCategorySelection {
  if (writes.length === 0) return { status: 'absent' };
  const identities = new Map<string, ValueChunkWriteDescriptor>();
  for (const write of writes) {
    if (!/^[0-9a-f]{64}$/i.test(write.categoryId) || !/^[0-9a-f]{64}$/i.test(write.keySlot)) {
      return { status: 'ambiguous' };
    }
    try {
      if (binToHex(computeCollectionHash(write.collectionSignature))
        !== write.collectionHash.toLowerCase()) return { status: 'ambiguous' };
    } catch {
      return { status: 'ambiguous' };
    }
    identities.set(valueChunkWriteIdentity(write), write);
  }
  if (identities.size !== 1) return { status: 'ambiguous' };
  const write = [...identities.values()][0];
  return { status: 'exact', categoryId: write.categoryId, write };
}

/** Resolve a chunk's owner without allowing a caller/default category to contradict compiler write identity. */
export function resolveValueChunkWriteCategory(
  selection: ValueChunkWriteCategorySelection,
  claimedCategoryId: string | undefined,
  legacyDefaultCategoryId: string,
): string | undefined {
  if (selection.status === 'ambiguous') return claimedCategoryId;
  if (selection.status === 'absent') return claimedCategoryId ?? legacyDefaultCategoryId;
  if (claimedCategoryId !== undefined
    && claimedCategoryId.toLowerCase() !== selection.categoryId.toLowerCase()) return undefined;
  return selection.categoryId;
}

/** Bind an observed value and redeem lock to one exact compiler-described collection write. */
export function rememberValueChunkUnlockRecipe(
  write: ValueChunkWriteDescriptor,
  value = persistedJobEventsValues.get(write.categoryId),
  lockingBytecode = persistedJobEventsLocks.get(write.categoryId),
): boolean {
  if (!value || !lockingBytecode || !/^[0-9a-f]{64}$/i.test(write.categoryId)
    || !/^[0-9a-f]{64}$/i.test(write.keySlot)) return false;
  try {
    const computedHash = binToHex(computeCollectionHash(write.collectionSignature));
    if (computedHash !== write.collectionHash.toLowerCase()) return false;
    const slot = hexToBin(write.keySlot);
    const root = sha256Sync(value);
    const expected = getValueChunkLockingBytecode(
      write.categoryId, write.collectionSignature, slot, root,
    );
    if (binToHex(expected) !== binToHex(lockingBytecode)) return false;
    const recipe = {
      slot, root, collection: write.collectionSignature, categoryId: write.categoryId,
    };
    persistedJobEventsRecipes.set(write.categoryId, recipe);
    persistedValueChunkWrites.set(valueChunkWriteIdentity(write), {
      value,
      lockingBytecode,
      width: valueChunkCountFor(value),
      recipe,
    });
    return true;
  } catch {
    return false;
  }
}

/** Authenticate a legacy observed continuation against an exact compiler/planner write identity. */
export function persistedValueChunkWriteState(
  write: ValueChunkWriteDescriptor,
): { value: Uint8Array; lockingBytecode: Uint8Array; width: number; recipe: {
    slot: Uint8Array; root: Uint8Array; collection: string; categoryId: string;
  } } | undefined {
  const identity = valueChunkWriteIdentity(write);
  const cached = persistedValueChunkWrites.get(identity);
  if (cached) return cached;
  const value = persistedJobEventsValues.get(write.categoryId);
  const lockingBytecode = persistedJobEventsLocks.get(write.categoryId);
  if (!value || !lockingBytecode || !/^[0-9a-f]{64}$/i.test(write.categoryId)
    || !/^[0-9a-f]{64}$/i.test(write.keySlot)) return undefined;
  try {
    if (!rememberValueChunkUnlockRecipe(write, value, lockingBytecode)) return undefined;
    const slot = hexToBin(write.keySlot);
    const root = sha256Sync(value);
    const state = {
      value, lockingBytecode,
      width: persistedJobEventsWidth(write.categoryId),
      recipe: { slot, root, collection: write.collectionSignature, categoryId: write.categoryId },
    };
    persistedValueChunkWrites.set(identity, state);
    return state;
  } catch {
    return undefined;
  }
}

/** Select one authenticated persisted resource, collapsing duplicate physical/logical descriptions. */
export function selectPersistedValueChunkWrite(
  writes: ReadonlyArray<ValueChunkWriteDescriptor>,
  categoryId?: string,
): ValueChunkWriteDescriptor | undefined {
  const candidates = writes.filter((write) => write.operation === 'update'
    && (categoryId === undefined || write.categoryId === categoryId)
    && persistedValueChunkWriteState(write) !== undefined);
  const identities = new Map(candidates.map((write) => [valueChunkWriteIdentity(write), write]));
  return identities.size === 1 ? [...identities.values()][0] : undefined;
}

/**
 * UPDATE rematerialization must reuse the persist redeem lock the impl
 * EQUALVERIFYs (`getValueChunkLockingBytecode` of the Created root), not
 * `aa20||sha256(v)||87` and not a consumed UTXO's previous physical lock.
 */
export function persistUpdateRedeemLock(
  categoryId: string | undefined,
  sessionLock?: Uint8Array,
  write?: ValueChunkWriteDescriptor | null,
): Uint8Array | undefined {
  if (write === null) return undefined;
  if (write) {
    const exact = persistedValueChunkWriteState(write)?.lockingBytecode;
    if (!exact) return undefined;
    if (sessionLock && sessionLock.length === 35 && sessionLock[0] === 0xaa && sessionLock[34] === 0x87
      && binToHex(sessionLock) === binToHex(exact)) return sessionLock;
    return exact;
  }
  if (sessionLock && sessionLock.length === 35 && sessionLock[0] === 0xaa && sessionLock[34] === 0x87) {
    return sessionLock;
  }
  if (!categoryId) return undefined;
  // Compatibility only: callers which have not attached an exact value-chunk descriptor retain the legacy
  // category/name recipe. New transaction geometry must pass `write` and cannot enter this fallback.
  const recipe = persistedJobEventsUnlockRecipe(categoryId);
  if (recipe) {
    try {
      return getValueChunkLockingBytecode(categoryId, recipe.collection, recipe.slot, recipe.root);
    } catch { /* invalid recipe */ }
    try {
      return getValueChunkLockingBytecode(recipe.categoryId, recipe.collection, recipe.slot, recipe.root);
    } catch { /* invalid recipe */ }
  }
  return persistedJobEventsLock(categoryId);
}

/** True only after a successful publishJobEvent send, not compose/extract. */
export function isPersistedJobEventsReady(): boolean {
  return persistedJobEventsSendReady;
}

/**
 * After a successful publishJobEvent the next update can place continuations
 * from persist instead of burning the 64-probe budget to rediscover them.
 */
export function boundedDerivationIterations(parts: {
  defaultIterations: number;
  persistWidth: number;
  hasLoopOrChunkVars: boolean;
}): number {
  // Persist seeds known jobEvents chunks so we do not need the 64-probe discovery
  // loop. A single probe is not enough: the first evaluation still reveals other
  // write pins (proxy data-NFT reconstruction, emit blobs) that only land on the
  // next materialization.
  if (parts.persistWidth > 0) return Math.min(parts.defaultIterations, 8);
  if (parts.hasLoopOrChunkVars) return Math.max(parts.defaultIterations, 64);
  return parts.defaultIterations;
}

/**
 * Speculative chunk growth is only useful after the probe observed a mismatched output pin.
 * A source-level revert can otherwise satisfy the same coarse "no commitments learned" shape,
 * causing every rejected call on a contract with dynamic storage to allocate the full probe band.
 */
export function shouldGrowSpeculativeChunkRegion(parts: {
  commitmentProgress: number;
  hasDerivedState: boolean;
  chunkVariableCount: number;
  loopEntryVariableCount: number;
  outputVerificationMismatchObserved: boolean;
  totalRegionWidth: number;
  maximumRegionWidth: number;
  allCommitmentsArePlaceholders: boolean;
}): boolean {
  return parts.commitmentProgress === 0
    && !parts.hasDerivedState
    && parts.chunkVariableCount > 0
    && parts.loopEntryVariableCount > 0
    && parts.outputVerificationMismatchObserved
    && parts.totalRegionWidth > 0
    && parts.totalRegionWidth < parts.maximumRegionWidth
    && parts.allCommitmentsArePlaceholders;
}

/** Materialize persist/compose `v` onto the live jobEvents band. */
export function seedChunksFromPersistedValue(
  setChunk: (
    outputIndex: number,
    chunk: { commitment: string; lockingBytecode: Uint8Array; categoryId?: string },
  ) => boolean,
  bandStart: number,
  value: Uint8Array,
  lock: Uint8Array,
  categoryId?: string,
): number {
  const chunks = applyRedeemLockToChunks(
    chunksFromJobEventsValue(value, lock, categoryId),
    lock,
  );
  let placed = 0;
  for (const [offset, chunk] of chunks.entries()) {
    if (setChunk(bandStart + offset, {
      commitment: chunk.commitment,
      lockingBytecode: chunk.lockingBytecode,
      categoryId: chunk.categoryId ?? categoryId,
    })) placed += 1;
  }
  return placed;
}

/** Stamp every continuation with the same redeem lock the covenant EQUALVERIFYs. */
export function applyRedeemLockToChunks<T extends { lockingBytecode: Uint8Array }>(
  chunks: readonly T[],
  lock: Uint8Array,
): T[] {
  if (lock.length !== 35 || lock[0] !== 0xaa) return [...chunks];
  return chunks.map((chunk) => ({ ...chunk, lockingBytecode: lock }));
}

/** Synthetic chunk address used by emitSortedValueChunkPin: `aa20 || sha256(value) || 87`. */
export function p2sh32LockFromValueRoot(root: Uint8Array): Uint8Array {
  const lock = new Uint8Array(35);
  lock[0] = 0xaa;
  lock[1] = 0x20;
  lock.set(root.subarray(0, 32), 2);
  lock[34] = 0x87;
  return lock;
}

/**
 * Recover the vmap blob the chunk pin is authenticating. Prefer the stack item
 * whose sha256 is the pin address payload (post-append Updated). The pre-push
 * Created witness also hashes to a root on the stack and must not win.
 */
export function selectHashedValueForChunkPin(
  stacks: ReadonlyArray<ReadonlyArray<Uint8Array>>,
  pinLock?: Uint8Array,
  minChunks = 0,
): { value: Uint8Array; lockingBytecode: Uint8Array } | undefined {
  // Sparse probe states share immutable stack-item byte arrays. Large routed scripts can remain on the stack for
  // hundreds of observed operations; hashing each repeated reference turned one logical candidate into gigabytes
  // of duplicate SHA-256 work. Cache by identity for this extraction (items are never mutated by libauth).
  const digestCache = new WeakMap<Uint8Array, Uint8Array>();
  const hexCache = new WeakMap<Uint8Array, string>();
  const digestOf = (value: Uint8Array): Uint8Array => {
    const cached = digestCache.get(value);
    if (cached) return cached;
    const digest = sha256Sync(value);
    digestCache.set(value, digest);
    return digest;
  };
  const hexOf = (value: Uint8Array): string => {
    const cached = hexCache.get(value);
    if (cached !== undefined) return cached;
    const hex = binToHex(value);
    hexCache.set(value, hex);
    return hex;
  };
  const pinIsP2sh32 = !!pinLock
    && pinLock.length === 35 && pinLock[0] === 0xaa && pinLock[1] === 0x20 && pinLock[34] === 0x87;
  const pinDigest = pinIsP2sh32 ? binToHex(pinLock!.subarray(2, 34)) : undefined;
  if (pinDigest) {
    const seen = new Set<Uint8Array>();
    for (const stack of stacks) {
      for (const item of stack) {
        if (item.length <= 60 || seen.has(item)) continue;
        seen.add(item);
        if (hexOf(digestOf(item)) === pinDigest) {
          return { value: item, lockingBytecode: pinLock! };
        }
      }
    }
  }
  const chunkCount = (value: Uint8Array): number => (
    value.length > VALUE_HEAD_SIZE
      ? Math.ceil((value.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE)
      : 0
  );
  const lockFor = (value: Uint8Array, stack?: ReadonlyArray<Uint8Array>): Uint8Array => {
    if (pinIsP2sh32) return pinLock!;
    const digest = digestOf(value);
    const digestHex = hexOf(digest);
    return stack?.find((item) => (
      item.length === 35 && item[0] === 0xaa && item[1] === 0x20 && item[34] === 0x87
      && binToHex(item.subarray(2, 34)) === digestHex
    )) ?? p2sh32LockFromValueRoot(digest);
  };
  let best: { value: Uint8Array; lockingBytecode: Uint8Array } | undefined;
  for (const stack of stacks) {
    let value: Uint8Array | undefined;
    const stackDigests = new Set(stack.filter((item) => item.length === 32).map(hexOf));
    const seen = new Set<Uint8Array>();
    for (const item of stack) {
      if (item.length <= 60 || seen.has(item)) continue;
      seen.add(item);
      if (!stackDigests.has(hexOf(digestOf(item)))) continue;
      if (!value || item.length > value.length) value = item;
    }
    if (!value) continue;
    if (best && value.length < best.value.length) continue;
    best = { value, lockingBytecode: lockFor(value, stack) };
  }
  // The pin address is p2sh32(redeem(root)), not aa20||sha256(v)||87, so the
  // digest path above often misses. A dummy sixth slot means the covenant
  // already computed nNew>=6: take the longest blob that splits that wide,
  // even if its root is no longer sitting next to it.
  if (minChunks > 0 && (!best || chunkCount(best.value) < minChunks)) {
    let widest: Uint8Array | undefined;
    for (const stack of stacks) {
      for (const item of stack) {
        if (item.length <= 60) continue;
        if (chunkCount(item) < minChunks) continue;
        if (!widest || item.length > widest.length) widest = item;
      }
    }
    if (widest) best = { value: widest, lockingBytecode: lockFor(widest) };
  }
  return best;
}

/** Split a persisted/extracted jobEvents blob into continuation NFTs. */
export function chunksFromJobEventsValue(
  value: Uint8Array,
  lockingBytecode?: Uint8Array,
  categoryId?: string,
): AuthenticatedValueChunk[] {
  if (value.length <= VALUE_HEAD_SIZE) return [];
  const lock = lockingBytecode
    ?? persistValueChunkLock(categoryId, value)
    ?? (categoryId ? persistedJobEventsLock(categoryId) : undefined)
    ?? p2sh32LockFromValueRoot(sha256Sync(value));
  return splitValueIntoValueChunks(value).map((data, index) => ({
    commitment: buildValueChunkCommitment(index, data),
    lockingBytecode: lock,
    categoryId,
  })).filter((chunk) => chunk.commitment.length >= 3 && chunk.commitment !== '00'
    && !(chunk.commitment.length >= 16 && isEmptyValueChunkCommitment(chunk.commitment)));
}

/**
 * First index after a token writer's physical block (master+blockSize) and
 * any in-block return slot. Change relocated out of the jobEvents band must
 * insert here — splicing at the first token-free pad (often 29) shifts the
 * FakeToken return at master+7 off its witnessed index.
 */
/** uint16-le chunk index. Values >= 32 are entry/value blobs, not occupancy slots. */
export function valueChunkIndexFromCommitment(commitment: string): number | undefined {
  if (commitment.length < 4) return undefined;
  const index = Number.parseInt(commitment.slice(0, 2), 16)
    + 256 * Number.parseInt(commitment.slice(2, 4) || '00', 16);
  if (!Number.isFinite(index) || index < 0 || index >= 32) return undefined;
  return index;
}

/**
 * Persist jobEvents value-chunks: uint16-le index heads (`0000`/`0100`/`0200`)
 * or the empty-root digest (`e3b0c442…`). Data-NFT tags (`0023…`, `51…`) are not.
 */
export function isPersistValueChunkCommitment(commitment: string): boolean {
  const hex = String(commitment ?? '').toLowerCase();
  if (!hex || hex.length < 8 || hex.startsWith('53434944')) return false;
  if (hex.startsWith('e3b0c442')) return true;
  const chunkIndex = valueChunkIndexFromCommitment(hex);
  return chunkIndex !== undefined && hex.length >= 24;
}

/** Dynamic predecessor inputs begin after the participant's fixed compiler block. */
export function persistValueChunkBase(implIndex: number, blockSize = 5): number {
  if (implIndex < 0) return -1;
  return implIndex + blockSize;
}

/**
 * Persist UPDATE stays at impl+blockSize when FakeToken already occupies dest 20.
 * If dest 20–24 are still 1:1 pads (whitelist), slide past INPUTINDEX*scale.
 */
export function shouldKeepPersistAtLayoutBase(parts: {
  persistReady: boolean;
  firstPublish: boolean;
  layoutDestOccupiedByMintingWriter?: boolean;
}): boolean {
  return parts.persistReady && !parts.firstPublish && !!parts.layoutDestOccupiedByMintingWriter;
}

/** Place at most the live nNew persist predecessors; extras inflate closeJob 3→4. */
export function persistPredecessorPlaceCount(nNew: number, candidateCount: number, persistUpdate: boolean): number {
  if (nNew <= 0) return 0;
  return persistUpdate ? nNew : Math.max(nNew, candidateCount);
}

/** Keep persisted dynamic predecessors on the live trailing run. */
export function persistUpdatePredecessorDests(parts: {
  implIndex: number;
  persistUpdate: boolean;
  keepAtLayout: boolean;
  bandStart: number;
  nNew: number;
}): number[] {
  if (parts.nNew <= 0 || parts.bandStart < 0) return [];
  const layout = persistValueChunkBase(parts.implIndex, 5);
  const start = parts.persistUpdate && parts.keepAtLayout && layout >= 0
    ? Math.min(layout, parts.bandStart)
    : parts.bandStart;
  return Array.from({ length: parts.nNew }, (_, offset) => start + offset);
}

/** Persist UPDATE dests own the layout; FakeToken minting there is displaced, not skipped. */
/** After `_refreshInputs`, send must evaluate the same occupancy as derive. */
export function syncBuilderInputsFromAllInputs<T>(builderInputs: readonly T[], allInputs: readonly T[]): T[] {
  const extra = Math.max(0, builderInputs.length - allInputs.length);
  return [...allInputs, ...builderInputs.slice(allInputs.length, allInputs.length + extra)];
}

/** The empty-root predecessor leads; indexed chunks follow in chunk order. */
export function persistPredecessorRank(commitment: string): number {
  const hex = String(commitment ?? '').toLowerCase();
  if (hex.startsWith('e3b0c442')) return hex.length >= 128 ? 0 : 1;
  const chunkIndex = valueChunkIndexFromCommitment(hex);
  if (chunkIndex !== undefined) return 10 + chunkIndex;
  return 1000;
}

export function orderPersistPredecessorCandidates<T extends {
  token?: { nft?: { commitment?: string } };
}>(candidates: readonly T[], persistUpdate: boolean): T[] {
  const ordered = [...candidates];
  ordered.sort((left, right) => {
    const leftCommit = String(left.token?.nft?.commitment ?? '');
    const rightCommit = String(right.token?.nft?.commitment ?? '');
    if (persistUpdate) {
      const rankDelta = persistPredecessorRank(leftCommit) - persistPredecessorRank(rightCommit);
      if (rankDelta !== 0) return rankDelta;
    }
    return leftCommit.localeCompare(rightCommit);
  });
  return ordered;
}

/** Rank destinations in the trailing run: empty-root first, then indexed chunks. */
export function persistPredecessorWantedRank(dest: number, implIndex: number): number {
  if (implIndex < 0) return 1000;
  const base = persistValueChunkBase(implIndex, 5);
  if (dest === base) return 0;
  if (dest > base) return 9 + (dest - base);
  return 1000;
}

export function assignPersistPredecessors<T extends {
  token?: { nft?: { commitment?: string } };
}>(
  dests: readonly number[],
  candidates: readonly T[],
  implIndex: number,
  persistUpdate: boolean,
): Array<{ dest: number; candidate: T }> {
  if (!persistUpdate) {
    return dests.flatMap((dest, offset) => (
      candidates[offset] ? [{ dest, candidate: candidates[offset] }] : []
    ));
  }
  const remaining = [...candidates];
  const assigned: Array<{ dest: number; candidate: T }> = [];
  for (const dest of dests) {
    if (remaining.length === 0) break;
    const wanted = persistPredecessorWantedRank(dest, implIndex);
    let best = 0;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index++) {
      const rank = persistPredecessorRank(String(remaining[index]?.token?.nft?.commitment ?? ''));
      const delta = Math.abs(rank - wanted);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = index;
      }
    }
    assigned.push({ dest, candidate: remaining.splice(best, 1)[0] });
  }
  return assigned;
}

/** Persist UPDATE dests own the layout; FakeToken minting and persist chunks there are displaced. */
export function persistOccupantDisplaceable(parts: {
  occupantIsPad: boolean;
  persistUpdate: boolean;
  keepAtLayout: boolean;
  occupantCapability?: string;
  occupantCommitment?: string;
}): boolean {
  if (parts.occupantIsPad) return true;
  if (!(parts.persistUpdate && parts.keepAtLayout)) return false;
  if (parts.occupantCapability === 'minting') return true;
  return isPersistValueChunkCommitment(parts.occupantCommitment ?? '');
}

export function writerBlockOccupancyEnd(
  groups: ReadonlyArray<PhysicalReturnGroup>,
  findMintingInputIndex: (categoryId: string) => number,
): number {
  let end = -1;
  for (const [groupIdx, group] of groups.entries()) {
    if (group.sharedGroupIndex !== undefined) continue;
    const master = findMintingInputIndex(group.categoryId);
    if (master < 0) continue;
    const blockSize = group.blockLayout?.blockSize ?? 0;
    if (blockSize > 0) end = Math.max(end, master + blockSize);
    if (!groupOwnsInBlockReturnEvent(groups, groupIdx)) continue;
    const returnSlot = group.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
    if (returnSlot !== undefined) end = Math.max(end, master + returnSlot.offset + 1);
  }
  return end;
}

/** Insert a relocated change output after the jobEvents band and reserved writer occupancy. */
/**
 * Keep [jobs chunks][OP_RETURN] contiguous. SCIDs and token-free pads that
 * landed inside that suffix are moved in front so TXOUTPUTCOUNT-1-nNew
 * still names the first jobs chunk.
 */
export function packJobsAgainstOpReturn<T extends {
  to?: Uint8Array | string;
  token?: { nft?: { capability?: string; commitment?: string } };
}>(
  outputs: T[],
  jobsLock: Uint8Array,
  tailStart: number,
): number {
  if (jobsLock.length !== 35 || jobsLock[0] !== 0xaa) return 0;
  const wanted = binToHex(jobsLock);
  const opReturn = outputs.findIndex((output, index) => {
    if (index < tailStart) return false;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    return !!lock && lock.length === 1 && lock[0] === 0x6a;
  });
  if (opReturn < 0 || opReturn <= tailStart) return 0;
  const jobs: T[] = [];
  const displaced: T[] = [];
  for (let index = tailStart; index < opReturn; index++) {
    const output = outputs[index];
    const lock = output?.to instanceof Uint8Array ? output.to : undefined;
    const isJob = !!lock && lock.length === 35 && binToHex(lock) === wanted
      && output?.token?.nft?.capability === 'mutable';
    if (isJob) jobs.push(output);
    else displaced.push(output);
  }
  if (jobs.length === 0) return 0;
  const packed = [...displaced, ...jobs];
  for (let offset = 0; offset < packed.length; offset++) {
    outputs[tailStart + offset] = packed[offset];
  }
  return jobs.length;
}

export function relocateChangeAfterOccupancy<T extends { token?: unknown }>(
  outputs: T[],
  change: T,
  bandEnd: number,
  occupancyEnd = -1,
  suffixStart?: number,
): number {
  const limit = suffixStart ?? outputs.length;
  let insertAt = Math.max(bandEnd, occupancyEnd, 0);
  if (insertAt > limit) insertAt = limit;
  while (insertAt < limit && outputs[insertAt]?.token) insertAt += 1;
  if (insertAt > limit) insertAt = limit;
  outputs.splice(insertAt, 0, change);
  return insertAt;
}

/**
 * Write value-chunk NFTs onto `[band.start, band.start+n)`. Skips reserved
 * slots (view tails, minting) so 16/17 stay put.
 */
export function placeValueChunksOnBand(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
  }>,
  band: { start: number; nNew: number },
  chunks: ReadonlyArray<{ commitment: string; lockingBytecode: Uint8Array; categoryId?: string }>,
  reserved: ReadonlySet<number> = new Set(),
  occupancyEnd = -1,
  suffixStart?: number,
): number {
  let written = 0;
  for (const [offset, chunk] of chunks.entries()) {
    if (offset >= band.nNew) break;
    const index = band.start + offset;
    if (reserved.has(index)) continue;
    const next = {
      to: chunk.lockingBytecode,
      amount: 1200n,
      token: {
        amount: 0n,
        category: chunk.categoryId ?? '',
        nft: { capability: 'mutable' as const, commitment: chunk.commitment },
      },
    };
    while (outputs.length < index) {
      outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
    }
    const existing = outputs[index];
    if (existing && !existing.token && (existing.amount ?? 0n) > 50_000n) {
      const leftover = (existing.amount ?? 0n) - 1200n;
      relocateChangeAfterOccupancy(
        outputs, { ...existing, amount: leftover }, band.start + band.nNew, occupancyEnd, suffixStart,
      );
    }
    if (outputs.length === index) outputs.push(next);
    else outputs[index] = next;
    written += 1;
  }
  return written;
}

function isP2sh32LockScript(lock: Uint8Array | string | undefined): lock is Uint8Array {
  if (!(lock instanceof Uint8Array) || lock.length !== 35) return false;
  return lock[0] === 0xaa && lock[1] === 0x20 && lock[34] === 0x87;
}

/** Select the reconstructed P2SH32 operand opposite an introspected current output locking bytecode. */
export function selectExpectedP2sh32OutputLock(
  current: Uint8Array,
  left: Uint8Array | undefined,
  right: Uint8Array | undefined,
): Uint8Array | undefined {
  if (!left || !right) return undefined;
  const currentHex = binToHex(current);
  if (binToHex(left) === currentHex && isP2sh32LockScript(right)) return right;
  if (binToHex(right) === currentHex && isP2sh32LockScript(left)) return left;
  return undefined;
}

/**
 * Occupancy: every slot in `[band.start, band.start+nNew)` must be a jobEvents
 * continuation NFT. A shorter Created/Updated extract must not leave a P2PKH
 * hole (history nNew=6 at slot 25) — derivation overwrites the placeholder.
 */
export function fillJobEventsBandHoles(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
  }>,
  band: { start: number; nNew: number },
  sibling: { lockingBytecode: Uint8Array; categoryId?: string },
  reserved: ReadonlySet<number> = new Set(),
  suffixStart?: number,
  occupancyEnd = -1,
): number {
  if (!isP2sh32LockScript(sibling.lockingBytecode) || band.nNew <= 0) return 0;
  let filled = 0;
  const width = Math.min(band.nNew, 32);
  for (let offset = 0; offset < width; offset++) {
    const index = band.start + offset;
    if (suffixStart !== undefined && index >= suffixStart) break;
    if (reserved.has(index)) continue;
    const existing = outputs[index];
    const existingLock = existing?.to instanceof Uint8Array ? existing.to : undefined;
    if (existing?.token?.nft?.capability === 'minting') continue;
    if (existing?.token?.nft?.capability === 'mutable' && isP2sh32LockScript(existingLock)
      && !isEmptyValueChunkCommitment(String(existing.token.nft.commitment ?? ''))) continue;
    if (existing && !isOverwritableValueChunkOccupant(existing) && existing.token) continue;
    // A large token-free P2PKH in the band is change, not a pad. Relocate it
    // after the suffix so filling slot 25 does not dump leftover sats to fee.
    let placeholderAmount = existing?.amount && existing.amount > 0n ? existing.amount : 1000n;
    if (existing && !existing.token && (existing.amount ?? 0n) > 50_000n) {
      placeholderAmount = 1000n;
      const relocated = { ...existing, amount: (existing.amount ?? 0n) - placeholderAmount };
      relocateChangeAfterOccupancy(
        outputs, relocated, Math.min(outputs.length, band.start + width), occupancyEnd, suffixStart,
      );
    }
    const next = {
      to: sibling.lockingBytecode,
      amount: placeholderAmount,
      token: {
        amount: 0n,
        category: sibling.categoryId ?? existing?.token?.category ?? '',
        nft: {
          capability: 'mutable' as const,
          commitment: buildValueChunkCommitment(offset, Uint8Array.of(0)),
        },
      },
    };
    while (outputs.length < index) {
      outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
    }
    if (outputs.length === index) outputs.push(next);
    else outputs[index] = next;
    filled += 1;
  }
  return filled;
}

/** View tails / token-free pads that derived jobEvents chunks must replace. */
export function isOverwritableValueChunkOccupant(output: {
  to?: Uint8Array | string;
  token?: { nft?: { capability?: string; commitment?: Uint8Array | string } };
} | undefined): boolean {
  if (!output) return true;
  if (isViewReturnTailOutput(output)) return true;
  if (isDisposableAlignmentPad(output)) return true;
  if (!output.token) return true;
  return false;
}

/** Same K-rotate as `_swapMintingOffValueChunkBand` (at least 4, at least band overlap). */
export function mintingSwapShift(start: number, chunkBase: number, nNew: number): number {
  return Math.max(4, Math.max(1, chunkBase + nNew - start));
}

/** Slot-index prefix plus an all-zero payload — surplus empty jobEvents / value-chunk. */
export function isEmptyValueChunkCommitment(hex: string): boolean {
  const body = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (body.length < 4) return false;
  return /^(?:[0-9a-f]{2}|[0-9a-f]{4})0+$/i.test(body);
}

/** OTC EQUALVERIFY: expected is the operand that is not the observed actual commitment. */
export function expectedFromOtcEqualVerify(
  below: Uint8Array,
  top: Uint8Array,
  observedActual?: string,
): Uint8Array {
  const belowHex = binToHex(below);
  const topHex = binToHex(top);
  if (observedActual !== undefined && belowHex === observedActual && topHex !== observedActual) {
    return top;
  }
  return below;
}

/** Real covenant expected bytes win over an empty split/fill placeholder. */
export function preferChunkCommitment(existing: string | undefined, incoming: string): string {
  const incomingEmpty = !incoming || incoming === '00' || isEmptyValueChunkCommitment(incoming);
  const existingEmpty = !existing || existing === '00' || isEmptyValueChunkCommitment(existing);
  if (incomingEmpty && !existingEmpty) return existing!;
  if (existingEmpty && !incomingEmpty) return incoming;
  return incoming;
}

/**
 * Rotate FakeToken only when enough trailing funders exist to clear the
 * jobEvents band. An undersized 4-wide fallback leaves the minting master
 * on a value-chunk slot (timeout refund: output 24).
 */
export function chooseMintingSwapShift(availableFunders: number, minShift: number): number {
  if (minShift <= 0 || availableFunders < minShift) return 0;
  // Prefer the historical 4-wide rotate when the band is narrower so
  // transferFrom publishJobPost stays off jobEvents. Never go below minShift.
  const preferred = Math.max(minShift, 4);
  return availableFunders >= preferred ? preferred : minShift;
}

/**
 * Choose a relocation only after reserving every output-only slot in the moved participant.
 * The funders used to shift the token-bearing prefix cannot also balance its trailing slots.
 */
export function chooseParticipantRelocationShift(
  availableFunders: number,
  minShift: number,
  trailingSlots: number,
): number {
  return chooseMintingSwapShift(
    Math.max(0, availableFunders - Math.max(0, trailingSlots)),
    minShift,
  );
}

/** Gather already-serialized plain funders next to a block so it can rotate without growing the input list. */
export function gatherContiguousPlainFunders<T extends {
  txid: string;
  vout: number;
  token?: unknown;
  unlocker?: { generateLockingBytecode?: () => Uint8Array };
}>(
  inputs: T[],
  funderOutpoints: ReadonlySet<string>,
  insertionIndex: number,
  required: number,
): number {
  const isDisposableFunder = (candidate: T): boolean => {
    if (candidate.token) return false;
    if (funderOutpoints.has(`${candidate.txid}:${candidate.vout}`)) return true;
    const lock = candidate.unlocker?.generateLockingBytecode?.();
    // Tests and callers without unlocker metadata retain the legacy plain-input
    // behavior. Materialized covenant inputs do publish their lock and are only
    // movable when they are standard P2PKH or OP_TRUE funding cells.
    if (!lock) return true;
    if (lock.length === 1 && lock[0] === 0x51) return true;
    return lock.length === 25
      && lock[0] === 0x76 && lock[1] === 0xa9 && lock[2] === 0x14
      && lock[23] === 0x88 && lock[24] === 0xac;
  };
  let available = 0;
  while (insertionIndex + available < inputs.length
    && isDisposableFunder(inputs[insertionIndex + available])) {
    available += 1;
  }
  while (available < required) {
    const source = inputs.findLastIndex((candidate, index) => (
      index >= insertionIndex + available
      && !candidate.token
      && funderOutpoints.has(`${candidate.txid}:${candidate.vout}`)
    ));
    if (source < 0) break;
    const [funder] = inputs.splice(source, 1);
    inputs.splice(insertionIndex + available, 0, funder);
    available += 1;
  }
  return available;
}

/**
 * Last mutable p2sh32 writer that sits on a planned view-tail index, extended
 * through the contiguous collection band (jobEvents). Token-free pads and the
 * trailing jobs suffix (separated by a pad or OP_RETURN) are not included.
 */
export function lastCollidingMutableWriterIndex(
  outputs: ReadonlyArray<{
    to?: Uint8Array | string;
    token?: { nft?: { capability?: string } };
  }>,
  plannedTailIndices: ReadonlyArray<number>,
): number {
  let last = -1;
  for (const index of plannedTailIndices) {
    if (index < 0 || index >= outputs.length) continue;
    const output = outputs[index];
    if (!output || isViewReturnTailOutput(output)) continue;
    if (output.token?.nft?.capability === 'mutable') last = Math.max(last, index);
  }
  if (last < 0) return -1;
  for (let index = last + 1; index < outputs.length; index++) {
    const output = outputs[index];
    const lock = output?.to instanceof Uint8Array ? output.to : undefined;
    if (output?.token?.nft?.capability !== 'mutable') break;
    if (!lock || lock.length !== 35 || lock[0] !== 0xaa || lock[1] !== 0x20) break;
    last = index;
  }
  return last;
}

/**
 * Slots that can host OP_TRUE none-cap view tails without stealing jobEvents,
 * jobs suffix chunks, or SCID identity. Prefers existing view tails and
 * token-free OP_TRUE / P2PKH alignment pads.
 */
export function findViewTailDestinations(
  outputs: ReadonlyArray<{
    to?: Uint8Array | string;
    token?: { nft?: { capability?: string; commitment?: Uint8Array | string } };
  }>,
  count: number,
  options: { suffixStart: number; reserved?: ReadonlySet<number>; preferBefore?: number },
): number[] {
  if (count <= 0) return [];
  const reserved = options.reserved ?? new Set<number>();
  const usable = (index: number): boolean => {
    if (index < 0 || index >= options.suffixStart || reserved.has(index)) return false;
    const output = outputs[index];
    if (!output) return false;
    if (isScidIdentityCommitment(output.token?.nft?.commitment)) return false;
    if (output.token?.nft?.capability === 'mutable') return false;
    if (isViewReturnTailOutput(output)) return true;
    return isDisposableAlignmentPad(output);
  };
  const dest: number[] = [];
  const start = options.preferBefore ?? options.suffixStart;
  for (let index = start - 1; index >= 0 && dest.length < count; index--) {
    if (usable(index)) dest.unshift(index);
  }
  return dest;
}

export function assignPhysicalReturnIndices(
  groups: ReadonlyArray<PhysicalReturnGroup>,
  findMintingInputIndex: (categoryId: string) => number,
  extraOccupied = -1,
  packOptions?: ViewTailPackOptions,
): Map<number, number> {
  const assigned = new Map<number, number>();
  let occupied = extraOccupied;
  for (const [groupIdx, group] of groups.entries()) {
    if (group.sharedGroupIndex !== undefined) continue;
    const master = findMintingInputIndex(group.categoryId);
    if (master < 0) continue;
    const layoutSize = group.blockLayout?.blockSize
      ?? group.compilerRoute?.abiFunction?.blockLayout?.blockSize
      ?? 0;
    const trailingPred = (group.batchPredecessorOutputs ?? [])
      .filter((pred) => pred.outputBlockSlot >= layoutSize).length;
    const physicalWidth = physicalParticipantWidth(group);
    const physicalEnd = master + physicalWidth + trailingPred - 1;
    occupied = Math.max(occupied, physicalEnd);
  }
  for (const [groupIdx, group] of groups.entries()) {
    if (!groupOwnsInBlockReturnEvent(groups, groupIdx)) continue;
    const physical = groups[group.sharedGroupIndex ?? groupIdx];
    const master = findMintingInputIndex(physical.categoryId);
    if (master < 0) continue;
    const returnSlot = physical.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
    if (!returnSlot) continue;
    const returnIndex = tokenWriterReturnIndex(master, physical.blockLayout, packOptions?.band);
    assigned.set(groupIdx, returnIndex);
    occupied = Math.max(occupied, returnIndex);
  }
  const tailRank = (left: number, right: number): number => {
    const name = (idx: number): string => groups[idx]?.functionName ?? '';
    const proxy = (idx: number): number => (name(idx) === '__forward' ? 0 : 1);
    return proxy(left) - proxy(right) || left - right;
  };
  const tails = groups
    .map((_, idx) => idx)
    .filter((idx) => groups[idx].returnOutputIndex !== undefined && !assigned.has(idx));
  const loopWidth = (idx: number): number => Math.max(1, groups[idx].loopReturnCommitments?.length ?? 1);
  const collision = tails.some((idx) => (groups[idx].returnOutputIndex ?? -1) <= occupied);
  const needsWidth = tails.some((idx) => loopWidth(idx) > 1);
  if (collision || needsWidth) {
    let nextTail = occupied + 1;
    if (!collision) {
      const planned = tails.map((idx) => groups[idx].returnOutputIndex as number);
      if (planned.length > 0) nextTail = Math.min(...planned);
    }
    for (const groupIdx of [...tails].sort(tailRank)) {
      const planned = groups[groupIdx].plannedReturnOutputIndex
        ?? groups[groupIdx].returnOutputIndex ?? nextTail;
      const packed = nextTail;
      const placed = clampViewTailPlacement({
        planned,
        packed,
        band: packOptions?.band,
        suffixStart: packOptions?.suffixStart,
        tokenWriterPresent: packOptions?.tokenWriterPresent,
      });
      assigned.set(groupIdx, placed);
      nextTail = placed + loopWidth(groupIdx);
    }
  } else {
    let nextTail = -1;
    for (const groupIdx of [...tails].sort(tailRank)) {
      const current = groups[groupIdx].returnOutputIndex as number;
      const planned = groups[groupIdx].plannedReturnOutputIndex ?? current;
      const placed = clampViewTailPlacement({
        planned,
        packed: nextTail >= 0 ? nextTail : current,
        band: packOptions?.band,
        suffixStart: packOptions?.suffixStart,
        tokenWriterPresent: packOptions?.tokenWriterPresent,
      });
      assigned.set(groupIdx, placed);
      nextTail = placed + loopWidth(groupIdx);
    }
  }
  return assigned;
}

/** Every physical output occupied by an assigned external-call return witness. */
export function returnWitnessOutputIndices(
  groups: ReadonlyArray<PhysicalReturnGroup>,
): Set<number> {
  const reserved = new Set<number>();
  for (const [groupIdx, group] of groups.entries()) {
    const start = group.returnOutputIndex;
    if (start === undefined || start < 0) continue;
    const width = groupOwnsInBlockReturnEvent(groups, groupIdx)
      ? 1
      : Math.max(1, group.loopReturnCommitments?.length ?? 1);
    for (let offset = 0; offset < width; offset++) reserved.add(start + offset);
  }
  return reserved;
}

/**
 * Map each pending tail-return identity onto the output index `assignPhysicalReturnIndices`
 * already bound the caller to. Writer in-block slots are never used, even when
 * `master+blockSize` sits inside a wider rotated token block.
 */
export function packTailReturnPlacements(
  groups: ReadonlyArray<PhysicalReturnGroup>,
  findMintingInputIndex: (categoryId: string) => number,
  pending: ReadonlyArray<{ identity: string; categoryId: string }>,
  swapCategoryId: string,
  extraOccupied = -1,
  packOptions?: ViewTailPackOptions,
): Map<string, number> {
  const assigned = assignPhysicalReturnIndices(
    groups, findMintingInputIndex, extraOccupied, packOptions,
  );
  const inBlockIdentities = new Set<string>();
  const inBlockSlots = new Set<number>();
  for (const [groupIdx, returnIndex] of assigned) {
    if (!groupOwnsInBlockReturnEvent(groups, groupIdx)) continue;
    const group = groups[groupIdx];
    inBlockIdentities.add(`external-call:${group.fusedReturnGroupIndex ?? groupIdx}`);
    inBlockSlots.add(returnIndex);
  }
  const groupIdxOf = (identity: string): number => {
    const match = /^external-call:(\d+)/.exec(identity);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  };
  const partOf = (identity: string): number => {
    const match = /^external-call:\d+:(\d+)$/.exec(identity);
    return match ? Number(match[1]) : 0;
  };
  const placements = new Map<string, number>();
  for (const event of pending) {
    // Keep the swapped token's in-block writer on its return slot. View callsites
    // on that same category (`balanceOf`) still need their assigned tail.
    if ([...inBlockIdentities].some((identity) =>
      event.identity === identity || event.identity.startsWith(`${identity}:`))) continue;
    const groupIdx = groupIdxOf(event.identity);
    const start = assigned.get(groupIdx);
    if (start === undefined) continue;
    const outputIndex = start + partOf(event.identity);
    if (inBlockSlots.has(outputIndex)) continue;
    placements.set(event.identity, outputIndex);
  }
  return placements;
}

/** Last output index occupied by assigned in-block returns or view/loop tails. */
export function assignedTailEnd(
  groups: ReadonlyArray<PhysicalReturnGroup>,
  assigned: ReadonlyMap<number, number>,
): number {
  let end = -1;
  for (const [groupIdx, returnIndex] of assigned) {
    const width = groupOwnsInBlockReturnEvent(groups, groupIdx)
      ? 1
      : Math.max(1, groups[groupIdx].loopReturnCommitments?.length ?? 1);
    end = Math.max(end, returnIndex + width - 1);
  }
  return end;
}

/**
 * Synthetic OP_TRUE outputs (view/loop tails, empty placeholders) are never a
 * collection entry covenant. After the tail band they are valid PredOut
 * destinations even when the commitment is EVM-true `51` rather than empty.
 */
export function isPredOutReusableHole(output: {
  to?: Uint8Array | string;
  token?: { nft?: { capability?: string; commitment?: Uint8Array | string } };
} | undefined): boolean {
  if (!output) return false;
  const lock = output.to instanceof Uint8Array ? output.to : undefined;
  if (!lock || lock.length !== 1 || lock[0] !== 0x51) return false;
  return (output.token?.nft?.capability ?? 'none') === 'none';
}

/**
 * Restore sorted-batch predecessor outputs to the coordinates declared by the
 * participant's compiler plan. Return-tail packing can leave an older clone at
 * a later coordinate; move that exact clone rather than minting a duplicate.
 * An unrelated token owner is never overwritten without an authenticated clone
 * proving which output belongs at the declared coordinate.
 */
export function reassertBatchPredecessorOutputsAtDeclaredSlots(
  outputs: Output[],
  masterIndex: number,
  categoryId: string,
  predecessors: ReadonlyArray<{
    outputBlockSlot: number;
    lockingBytecode: Uint8Array;
    commitment: string;
  }>,
  replaceDeclaredOwner = false,
): number {
  if (masterIndex < 0) return 0;
  let changed = 0;
  const samePredecessor = (output: Output | undefined, predecessor: (typeof predecessors)[number]): boolean => {
    if (!output || output.token?.category !== categoryId
      || output.token.nft?.capability !== 'mutable'
      || commitmentHexOf(output.token.nft.commitment) !== predecessor.commitment.toLowerCase()) return false;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    return lock !== undefined && lock.length === predecessor.lockingBytecode.length
      && lock.every((byte, offset) => byte === predecessor.lockingBytecode[offset]);
  };
  const sameDeclaredOwner = (
    output: Output | undefined, predecessor: (typeof predecessors)[number],
  ): boolean => {
    if (!output || output.token?.category !== categoryId
      || output.token.nft?.capability !== 'mutable'
      || (!replaceDeclaredOwner
        && !/^(?:00)+$/.test(commitmentHexOf(output.token.nft.commitment)))) return false;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    return lock !== undefined && lock.length === predecessor.lockingBytecode.length
      && lock.every((byte, offset) => byte === predecessor.lockingBytecode[offset]);
  };

  for (const predecessor of predecessors) {
    if (!Number.isInteger(predecessor.outputBlockSlot) || predecessor.outputBlockSlot < 0) continue;
    const destination = masterIndex + predecessor.outputBlockSlot;
    while (destination >= outputs.length) {
      outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
    }
    if (samePredecessor(outputs[destination], predecessor)) continue;
    const source = outputs.findIndex((output, index) => (
      index !== destination && samePredecessor(output, predecessor)
    ));
    const occupant = outputs[destination];
    if (source < 0 && occupant?.token && !isPredOutReusableHole(occupant)
      && !sameDeclaredOwner(occupant, predecessor)) continue;

    const replacement = source >= 0 ? outputs[source] : {
      to: predecessor.lockingBytecode,
      amount: occupant?.amount && occupant.amount > 0n ? occupant.amount : 1000n,
      token: {
        amount: 0n,
        category: categoryId,
        nft: { capability: 'mutable' as const, commitment: predecessor.commitment },
      },
    };
    outputs[destination] = replacement;
    if (source >= 0) {
      outputs[source] = {
        to: Uint8Array.of(0x51),
        amount: replacement.amount && replacement.amount > 0n ? replacement.amount : 1000n,
      };
    }
    changed += 1;
  }
  return changed;
}

/**
 * OP_TRUE + none-cap is a view/loop return witness. Nested events and identity
 * tags must displace it, not overwrite: same-category is not enough to treat it
 * as an empty event hole (`arbitratorRegistered` and `publishJobEvent` share MD).
 */
export function isViewReturnTailOutput(output: {
  to?: Uint8Array | string;
  token?: { nft?: { capability?: string; commitment?: Uint8Array | string } };
} | undefined): boolean {
  if (!output?.token || output.token.nft?.capability !== 'none') return false;
  const lock = output.to instanceof Uint8Array
    ? output.to
    : typeof output.to === 'string' ? undefined : output.to;
  return !!lock && lock.length === 1 && lock[0] === 0x51;
}

/** Whether a mutable NFT output is duplicated exactly at another index. */
export function hasEquivalentMutableNftOutput(
  outputs: ReadonlyArray<{
    to?: Uint8Array | string;
    token?: {
      category?: string;
      nft?: { capability?: string; commitment?: Uint8Array | string };
    };
  }>,
  candidateIndex: number,
): boolean {
  const candidate = outputs[candidateIndex];
  const candidateLock = candidate?.to instanceof Uint8Array ? candidate.to : undefined;
  if (!candidateLock || candidate?.token?.nft?.capability !== 'mutable') return false;
  const candidateCommitment = commitmentHexOf(candidate.token.nft.commitment);
  return outputs.some((output, index) => {
    if (index === candidateIndex || output.token?.nft?.capability !== 'mutable') return false;
    if (output.token.category !== candidate.token?.category) return false;
    if (commitmentHexOf(output.token.nft.commitment) !== candidateCommitment) return false;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    return lock !== undefined && lock.length === candidateLock.length
      && lock.every((byte, offset) => byte === candidateLock[offset]);
  });
}

/**
 * Remove exact mutable copies that were displaced after their canonical
 * same-index output while that output was still being derived.
 */
export function stripRelocatedMutableDuplicates(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: {
      category?: string;
      nft?: { capability?: string; commitment?: Uint8Array | string };
    };
  }>,
  inputs: ReadonlyArray<{
    token?: { category?: string; nft?: { capability?: string } };
    unlocker?: { generateLockingBytecode: () => Uint8Array };
  }>,
  scanStart: number,
  protectedIndices: ReadonlySet<number> = new Set(),
): number {
  if (scanStart < 0) return 0;
  const canonicalByIdentity = new Map<string, Set<number>>();
  for (const [canonicalIndex, input] of inputs.entries()) {
    const output = outputs[canonicalIndex];
    const inputLock = input.unlocker?.generateLockingBytecode();
    const outputLock = output?.to instanceof Uint8Array ? output.to : undefined;
    if (!inputLock || !outputLock || input.token?.nft?.capability !== 'mutable'
      || output.token?.nft?.capability !== 'mutable'
      || input.token.category !== output.token.category
      || inputLock.length !== outputLock.length
      || !inputLock.every((byte, offset) => byte === outputLock[offset])) continue;
    const identity = `${output.token.category ?? ''}:${binToHex(outputLock)}:`
      + commitmentHexOf(output.token.nft.commitment);
    const canonicalIndices = canonicalByIdentity.get(identity) ?? new Set<number>();
    canonicalIndices.add(canonicalIndex);
    canonicalByIdentity.set(identity, canonicalIndices);
  }
  let stripped = 0;
  for (let index = scanStart; index < outputs.length; index++) {
    // A cold sorted-map insert has two compiler-owned outputs: the new node at
    // the fixed entry slot and the rewritten predecessor at a trailing slot.
    // During fixed-point discovery their provisional commitments can briefly
    // be identical. Both coordinates must survive so the next VM pass can
    // authenticate their distinct final commitments.
    if (protectedIndices.has(index)) continue;
    const candidate = outputs[index];
    const candidateLock = candidate?.to instanceof Uint8Array ? candidate.to : undefined;
    if (!candidateLock || candidate.token?.nft?.capability !== 'mutable') continue;
    const identity = `${candidate.token.category ?? ''}:${binToHex(candidateLock)}:`
      + commitmentHexOf(candidate.token.nft.commitment);
    const canonicalIndices = canonicalByIdentity.get(identity);
    if (canonicalIndices === undefined || canonicalIndices.has(index)) continue;
    outputs[index] = {
      to: Uint8Array.of(0x51),
      amount: candidate.amount && candidate.amount > 0n ? candidate.amount : 1000n,
    };
    stripped += 1;
  }
  return stripped;
}

/**
 * Restore explicitly read-only mutable inputs to the output coordinate authenticated by their covenant.
 *
 * Collection iteration can relocate these twins while composing later participant bands. Prefer swapping an
 * exact relocated twin back into place, preserving the displaced output and transaction width. If no twin
 * survives, synthesize one only over a disposable alignment pad; a conflicting owned output remains visible to
 * preflight rather than being silently discarded.
 */
export function reassertReadOnlyMutableOneToOnes(
  outputs: Output[],
  inputs: ReadonlyArray<Pick<UnlockableUtxo, 'txid' | 'vout'>>,
  readOnlyInputs: ReadonlyArray<UnlockableUtxo>,
): number {
  const inputIndices = new Map(inputs.map((input, index) => (
    [`${input.txid.toLowerCase()}:${input.vout}`, index]
  )));
  const matches = (output: Output | undefined, input: UnlockableUtxo, lock: Uint8Array): boolean => {
    if (!output || output.amount !== input.satoshis || output.token?.category !== input.token?.category
      || output.token?.amount !== input.token?.amount
      || output.token?.nft?.capability !== input.token?.nft?.capability
      || commitmentHexOf(output.token?.nft?.commitment)
        !== commitmentHexOf(input.token?.nft?.commitment)) return false;
    return outputMatchesLock(output, lock);
  };
  let restored = 0;
  for (const input of readOnlyInputs) {
    if (!input.unlocker || input.token?.nft?.capability !== 'mutable') continue;
    const index = inputIndices.get(`${input.txid.toLowerCase()}:${input.vout}`);
    if (index === undefined) continue;
    while (outputs.length <= index) outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
    const lock = input.unlocker.generateLockingBytecode();
    if (matches(outputs[index], input, lock)) continue;
    const relocated = outputs.findIndex((output, candidate) => (
      candidate !== index && matches(output, input, lock)
    ));
    if (relocated >= 0) {
      const displaced = outputs[index];
      outputs[index] = outputs[relocated];
      outputs[relocated] = displaced ?? { to: Uint8Array.of(0x51), amount: 1000n };
      restored += 1;
      continue;
    }
    if (!isDisposableAlignmentPad(outputs[index])) continue;
    outputs[index] = {
      to: lock,
      amount: input.satoshis,
      token: cloneToken(input.token),
    };
    restored += 1;
  }
  return restored;
}

/**
 * Reassert the redeem-script identity of a compiler-declared mutable slot while
 * retaining the commitment computed for this transaction. Slot coordinates are
 * owned by the participant layout; a later materializer may update the value,
 * but it must not replace the entry covenant which authenticates that value.
 */
export function reassertDeclaredMutableSlotLock(
  output: {
    to?: Uint8Array | string;
    token?: { category?: string; nft?: { capability?: string; commitment?: Uint8Array | string } };
  } | undefined,
  input: {
    token?: { category?: string; nft?: { capability?: string } };
    unlocker?: { generateLockingBytecode: () => Uint8Array };
  } | undefined,
): boolean {
  if (!output || !input?.unlocker
    || input.token?.nft?.capability !== 'mutable'
    || output.token?.nft?.capability !== 'mutable'
    || output.token.category !== input.token.category) return false;
  const expected = input.unlocker.generateLockingBytecode();
  const current = output.to instanceof Uint8Array ? output.to : undefined;
  if (current?.length === expected.length
    && current.every((byte, offset) => byte === expected[offset])) return false;
  output.to = expected;
  return true;
}

/**
 * Burn mutable chunks from a replaced collection once its complete authoritative
 * run has been materialized elsewhere. Dynamic chunk identity is the category
 * plus collection covenant; commitments are values within that collection.
 */
export function clearMutableCollectionOutputsOutsideAuthoritativeRun(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: {
      category?: string;
      nft?: { capability?: string; commitment?: Uint8Array | string };
    };
  }>,
  authoritativeOutputIndices: ReadonlySet<number>,
): number {
  const authoritativeCollections = new Set<string>();
  for (const index of authoritativeOutputIndices) {
    const output = outputs[index];
    const lock = output?.to instanceof Uint8Array ? output.to : undefined;
    if (!lock || output.token?.nft?.capability !== 'mutable') continue;
    authoritativeCollections.add(`${output.token.category ?? ''}:${binToHex(lock)}`);
  }
  let cleared = 0;
  for (let index = 0; index < outputs.length; index++) {
    if (authoritativeOutputIndices.has(index)) continue;
    const output = outputs[index];
    const lock = output?.to instanceof Uint8Array ? output.to : undefined;
    if (!lock || output?.token?.nft?.capability !== 'mutable') continue;
    const collection = `${output.token.category ?? ''}:${binToHex(lock)}`;
    if (!authoritativeCollections.has(collection)) continue;
    outputs[index] = {
      to: Uint8Array.of(0x51),
      amount: output.amount && output.amount > 0n ? output.amount : 1000n,
    };
    cleared += 1;
  }
  return cleared;
}

/** Token-free OP_TRUE or P2PKH pads used only to keep TXOUTPUTCOUNT aligned. */
/**
 * Same-collection empty-value placeholders (128-byte slot||next||64-zero) inflate
 * insert-loop output counts when a provisional empty node remains beside the
 * authenticated predecessor and new node. Convert extras to token-free pads
 * in place so unrelated assigned output coordinates do not move.
 *
 * `plannedCount` is required. Without it this must not guess: initialize and
 * other collection operations can also emit mixed empty and real mutables.
 */
export function stripSurplusEmptyCollectionEntries(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { nft?: { capability?: string; commitment?: Uint8Array | string } };
  }>,
  collectionLock: Uint8Array,
  plannedCount = 0,
): number {
  if (plannedCount <= 0 || collectionLock.length === 0) return 0;
  const matches: number[] = [];
  const empties: number[] = [];
  for (const [index, output] of outputs.entries()) {
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    if (!lock || lock.length !== collectionLock.length) continue;
    if (!lock.every((byte, offset) => byte === collectionLock[offset])) continue;
    if (output.token?.nft?.capability !== 'mutable') continue;
    matches.push(index);
    const commitment = output.token.nft?.commitment ?? '';
    const bytes = typeof commitment === 'string'
      ? (commitment.length === 0 ? new Uint8Array() : hexToBin(commitment))
      : commitment;
    let emptyTail = false;
    try {
      emptyTail = isEmptyValueEntryCommitment(commitment);
    } catch { /* non-hex placeholder */ }
    const hex = binToHex(bytes);
    const allZero = bytes.length > 0 && bytes.every((byte) => byte === 0);
    // Only slot-0 / all-zero leftovers. A real INSERT NEW can be e3b0c442||next||empty
    // (empty-value collection); treating that as surplus deletes the covenant's node.
    const leftoverHash = hex.startsWith('e3b0c442') && (
      bytes.length < 64
      || (bytes.length === 64 && bytes.subarray(32).every((byte) => byte === 0))
    );
    const missing = bytes.length === 0;
    if (missing || allZero || leftoverHash || (emptyTail && isSortedEntryHeadCommitment(hex))) {
      empties.push(index);
    }
  }
  if (empties.length === 0 || empties.length === matches.length) return 0;
  const surplus = Math.max(0, matches.length - plannedCount);
  if (surplus === 0) return 0;
  const toStrip = empties.slice(0, surplus);
  let stripped = 0;
  for (const index of toStrip) {
    outputs[index] = { to: Uint8Array.of(0x51), amount: 1000n };
    stripped += 1;
  }
  return stripped;
}

/** Resolve the one active chunkable dynamic-array collection written by a composed group.
 * Route rows are authoritative when present; a route-level active-write filter narrows union-shaped handlers.
 * Ambiguous metadata fails closed rather than selecting a collection by source-level name. */
type ChunkableArrayWriteGroup = {
  functionName?: string;
  logicalFunctionName?: string;
  stateLayout?: StateLayout;
  logicalArtifact?: Artifact;
  externalContract?: { inner?: { artifact?: Artifact } };
  compilerRoute?: {
    abiFunction?: AbiFunction;
    rowArguments?: readonly { handler: AbiFunction }[];
  };
  valueChunkWrites?: readonly ValueChunkWriteDescriptor[];
};

function groupChunkableArrayWriteCollections(group: ChunkableArrayWriteGroup): string[] {
  const route = group.compilerRoute;
  const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
  const directName = group.logicalFunctionName ?? group.functionName;
  const direct = artifact?.abi.find((candidate) => candidate.name === directName);
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
      if (collection?.chunkableValue === true && collection.valueType.endsWith('[]')) {
        matches.add(collection.name);
      }
    }
  }
  return [...matches];
}

export function groupChunkableArrayWriteCollection(
  group: ChunkableArrayWriteGroup,
): string | undefined {
  const matches = groupChunkableArrayWriteCollections(group);
  return matches.length === 1 ? matches[0] : undefined;
}

export function groupWritesSingleChunkableArrayCollection(group: Parameters<
  typeof groupChunkableArrayWriteCollection
>[0]): boolean {
  return groupChunkableArrayWriteCollection(group) !== undefined;
}

function groupChunkableValueWriteIdentity(group: ChunkableArrayWriteGroup): string | undefined {
  return groupChunkableArrayWriteCollection(group)
    ?? (group.valueChunkWrites?.length === 1 ? group.valueChunkWrites[0].collection : undefined);
}

/** Resolve a single physical chunkable-value writer from compiler metadata, independent of ABI names. */
export function selectChunkableValueWriteExecution(
  candidates: ReadonlyArray<{ group: ChunkableArrayWriteGroup; inputIndex: number }>,
): { inputIndex: number; abiFunction: AbiFunction; collection: string } | undefined {
  const executions = new Map<string, {
    inputIndex: number; abiFunction: AbiFunction; collection: string;
  }>();
  for (const { group, inputIndex } of candidates) {
    if (inputIndex < 0) continue;
    const collection = groupChunkableValueWriteIdentity(group);
    if (collection === undefined) continue;
    const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
    const logicalName = group.logicalFunctionName ?? group.functionName;
    const abiFunction = group.compilerRoute?.abiFunction
      ?? artifact?.abi.find((candidate) => candidate.name === logicalName);
    if (abiFunction) executions.set(`${inputIndex}:${collection}`, { inputIndex, abiFunction, collection });
  }
  if (executions.size !== 1) return undefined;
  return [...executions.values()][0];
}

/** Same-index mutable jobEvents entry UTXOs. View tails must not replace these. */
export function jobEventsEntryOneToOneIndices(
  inputs: ReadonlyArray<{
    token?: { nft?: { capability?: string } };
    unlocker?: { generateLockingBytecode: () => Uint8Array };
  }>,
  entryLock: Uint8Array | undefined,
): number[] {
  if (!entryLock || entryLock.length !== 35 || entryLock[0] !== 0xaa) return [];
  const wanted = binToHex(entryLock);
  const indices: number[] = [];
  for (const [index, input] of inputs.entries()) {
    if (input?.token?.nft?.capability !== 'mutable' || !input.unlocker) continue;
    const lock = input.unlocker.generateLockingBytecode();
    if (lock.length === 35 && binToHex(lock) === wanted) indices.push(index);
  }
  return indices;
}

export function isDisposableAlignmentPad(output: {
  to?: Uint8Array | string;
  token?: unknown;
} | undefined): boolean {
  if (!output || output.token) return false;
  const lock = output.to instanceof Uint8Array ? output.to : undefined;
  if (!lock) return false;
  if (lock.length === 1 && lock[0] === 0x51) return true;
  return lock.length === 25
    && lock[0] === 0x76 && lock[1] === 0xa9 && lock[2] === 0x14
    && lock[23] === 0x88 && lock[24] === 0xac;
}

/**
 * Recreate a nested minting master at its input index. Inserting would shift
 * assigned view tails and the jobs suffix; drop one later alignment pad so
 * those absolute indices stay put (MD minting at 15, tails 38-40, jobs 45-46).
 */
/**
 * Minting uniqueness: one minting output per minting input. Extra same-category
 * minting clones (fixture FakeToken at 27 while the master is at 28) make the
 * conservation helper leave -1 on the stack (0x81) so `0 GTE VERIFY` fails.
 */
/**
 * FakeToken.transferFrom lays out P' at master+2 and NEW at master+4 (pred+2).
 * A later same-category mapping (allowance) can occupy +4 with a different
 * collection lock; the covenant EQUALVERIFYs OUTPUTBYTECODE[+4] against P'.
 */
export function reassertTokenInsertNewLock(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { category?: string; amount?: bigint; nft?: { capability?: string; commitment?: string | Uint8Array } };
  }>,
  masterIndex: number,
  categoryId: string,
  predOffset = 2,
  newOffset = 4,
): boolean {
  const pred = outputs[masterIndex + predOffset];
  const neu = outputs[masterIndex + newOffset];
  if (!pred?.token || pred.token.category !== categoryId || pred.token.nft?.capability !== 'mutable') {
    return false;
  }
  if (!neu?.token || neu.token.category !== categoryId || neu.token.nft?.capability !== 'mutable') {
    return false;
  }
  const predLock = pred.to instanceof Uint8Array ? pred.to : undefined;
  const newLock = neu.to instanceof Uint8Array ? neu.to : undefined;
  if (!predLock || !newLock || predLock.length !== newLock.length) return false;
  if (predLock.every((byte, offset) => byte === newLock[offset])) return false;
  outputs[masterIndex + newOffset] = {
    ...neu,
    to: predLock,
  };
  return true;
}

/**
 * The covenant counts outputs at the value-chunk redeem lock and EQUALVERIFYs
 * nNew. Extra same-lock occupants past the planned band fail that pin.
 */
export function stripSurplusValueChunkLocks(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { nft?: { capability?: string } };
  }>,
  band: { start: number; nNew: number },
  chunkLock: Uint8Array,
  consumed?: Array<{
    token?: { nft?: { capability?: string } };
    unlocker?: { generateLockingBytecode: () => Uint8Array };
  }>,
): number {
  if (chunkLock.length !== 35 || chunkLock[0] !== 0xaa || band.nNew <= 0) return 0;
  const wanted = binToHex(chunkLock);
  const end = band.start + band.nNew;
  let stripped = 0;
  for (let index = 0; index < outputs.length; index++) {
    if (index >= band.start && index < end) continue;
    const lock = outputs[index]?.to instanceof Uint8Array ? outputs[index]!.to as Uint8Array : undefined;
    if (!lock || lock.length !== 35 || binToHex(lock) !== wanted) continue;
    if (outputs[index]?.token?.nft?.capability === 'minting') continue;
    // A still-spent persist predecessor is a 1:1 conservation twin, not a surplus
    // write. Destroying it leaves a mutable hole (input 20 / output OP_TRUE).
    const spent = consumed?.[index];
    const spentLock = spent?.unlocker?.generateLockingBytecode();
    if (spent?.token?.nft?.capability === 'mutable'
      && (!spentLock || (spentLock.length === 35 && binToHex(spentLock) === wanted))) {
      continue;
    }
    outputs[index] = { to: Uint8Array.of(0x51), amount: outputs[index]?.amount && outputs[index]!.amount! > 0n
      ? outputs[index]!.amount : 1000n };
    stripped += 1;
  }
  return stripped;
}

/** Recreate every consumed SCID v1 identity NFT. Prefer a same-lock pad, then a
 * token-free disposable output (not a view tail). Never skip: dropping the NFT
 * makes the next non-zero msg.sender call unsatisfiable. Do not overwrite
 * minting/mutable occupants, reserved occupancy (impl trailing / jobEvents /
 * writer returns), or append past an OP_RETURN jobs suffix. */
export function reassertScidIdentityOutputs(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { category?: string; amount?: bigint; nft?: { capability?: string; commitment?: string } };
  }>,
  inputs: Array<{
    satoshis?: bigint;
    token?: { category?: string; amount?: bigint; nft?: { capability?: string; commitment?: string } };
    unlocker?: { generateLockingBytecode: () => Uint8Array };
  }>,
  reservedIndices: ReadonlySet<number> = new Set(),
): number {
  const lockHex = (to?: Uint8Array | string): string => {
    if (!to) return '';
    return typeof to === 'string' ? binToHex(addressToLockScript(to)) : binToHex(to);
  };
  const isViewTail = (output: (typeof outputs)[number] | undefined): boolean => {
    if (!output) return false;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    return !!lock && lock.length === 1 && lock[0] === 0x51 && output.token?.nft?.capability === 'none';
  };
  const isReserved = (output: (typeof outputs)[number] | undefined, index?: number): boolean => {
    if (index !== undefined && reservedIndices.has(index)) return true;
    if (!output) return false;
    if (isViewTail(output)) return true;
    // Identity restoration may only claim token-free pads. In particular, an
    // immutable SCID restored earlier in this same loop is already an owner;
    // treating only minting/mutable NFTs as reserved lets a later identity
    // silently overwrite it.
    return output.token !== undefined;
  };
  let repaired = 0;
  for (let index = 0; index < inputs.length; index++) {
    const input = inputs[index];
    const commitment = input.token?.nft?.commitment;
    if (input.token?.nft?.capability !== 'none' || !isScidIdentityCommitment(commitment)) continue;
    const category = input.token.category;
    const lock = input.unlocker?.generateLockingBytecode();
    if (!lock) continue;
    const wanted = binToHex(lock);
    const already = outputs.some((output) => output?.token?.nft?.capability === 'none'
      && output.token.category === category
      && output.token.nft.commitment === commitment
      && lockHex(output.to) === wanted);
    if (already) continue;
    // A compiler-authenticated output-bytecode repair can reveal that an SCID was provisionally placed on a
    // coordinate owned by another covenant resource. Relocating that identity must also vacate the malformed
    // replica; otherwise token conservation sees two copies and a later conservation pass can reclaim the same
    // authenticated coordinate. Preserve the repaired locking bytecode and satoshi value while releasing only
    // the misplaced immutable token.
    for (let outputIndex = 0; outputIndex < outputs.length; outputIndex++) {
      const output = outputs[outputIndex];
      if (output?.token?.nft?.capability !== 'none'
        || output.token.category !== category
        || output.token.nft.commitment !== commitment) continue;
      outputs[outputIndex] = {
        to: output.to,
        amount: output.amount,
      };
    }
    let target = -1;
    for (let outputIndex = outputs.length - 1; outputIndex >= 0; outputIndex--) {
      const output = outputs[outputIndex];
      if (lockHex(output?.to) !== wanted) continue;
      const outputToken = output?.token;
      const replaceableIdentityPad = outputToken !== undefined
        && outputToken.category === category
        && outputToken.nft?.capability === 'none'
        && String(outputToken.nft.commitment ?? '').toLowerCase() === '53434944';
      if (isReserved(output, outputIndex) && !replaceableIdentityPad) continue;
      target = outputIndex;
      break;
    }
    if (target < 0) {
      for (let outputIndex = outputs.length - 1; outputIndex >= 0; outputIndex--) {
        if (isReserved(outputs[outputIndex], outputIndex)) continue;
        const lockBytes = outputs[outputIndex]?.to instanceof Uint8Array
          ? outputs[outputIndex]!.to as Uint8Array : undefined;
        if (lockBytes?.length === 1 && lockBytes[0] === 0x6a) continue;
        target = outputIndex;
        break;
      }
    }
    if (target < 0) {
      const suffix = outputs.findIndex((output) => {
        const lockBytes = output?.to instanceof Uint8Array ? output.to : undefined;
        return !!lockBytes && lockBytes.length === 1 && lockBytes[0] === 0x6a;
      });
      target = suffix >= 0 ? suffix : outputs.length;
      outputs.splice(target, 0, { to: lock, amount: 1000n });
    }
    const existing = outputs[target];
    if (existing && !existing.token && (existing.amount ?? 0n) > 50_000n) {
      outputs.splice(target + 1, 0, { ...existing, amount: (existing.amount ?? 0n) - 1000n });
    }
    outputs[target] = {
      to: lock,
      amount: input.satoshis ?? 1200n,
      token: {
        category,
        amount: 0n,
        nft: { capability: 'none', commitment },
      },
    };
    repaired += 1;
  }
  return repaired;
}

export function stripSurplusMintingOutputs(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { category?: string; nft?: { capability?: string } };
  }>,
  inputs: Array<{ token?: { category?: string; nft?: { capability?: string } } }>,
  mintingCategory: string,
  masterIndex: number,
): number {
  let stripped = 0;
  for (let index = 0; index < outputs.length; index++) {
    if (index === masterIndex) continue;
    const output = outputs[index];
    if (output.token?.nft?.capability !== 'minting' || output.token.category !== mintingCategory) {
      continue;
    }
    const input = inputs[index];
    if (input?.token?.nft?.capability === 'minting' && input.token.category === mintingCategory) {
      continue;
    }
    outputs[index] = { to: Uint8Array.of(0x51), amount: 1000n };
    stripped += 1;
  }
  return stripped;
}

export function shouldInsertMintingMaster(
  existing: {
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { category?: string; amount?: bigint; nft?: { capability?: string } };
  } | undefined,
  mintingCategory: string,
): boolean {
  if (!existing) return true;
  if (existing.token?.nft?.capability === 'minting' && existing.token.category === mintingCategory) {
    return false;
  }
  if (existing.token?.category === mintingCategory) return true;
  const lock = existing.to instanceof Uint8Array ? existing.to : undefined;
  return !!lock && lock.length === 1 && lock[0] === 0x51;
}

export function placeMintingMasterPreservingTail<T extends {
  to?: Uint8Array | string;
  amount?: bigint;
  token?: { category?: string; amount?: bigint; nft?: { capability?: string } };
}>(
  outputs: T[],
  masterIndex: number,
  minting: T,
  options: { blockWidth: number; tailStart: number; suffixStart: number },
): boolean {
  const mintingToken = minting.token as { category?: string; nft?: { capability?: string } } | undefined;
  const existing = outputs[masterIndex];
  if (existing?.token?.nft?.capability === 'minting'
    && existing.token.category === (mintingToken?.category ?? '')) {
    outputs[masterIndex] = minting;
    return false;
  }
  if (!shouldInsertMintingMaster(existing, mintingToken?.category ?? '')) {
    return false;
  }
  outputs.splice(masterIndex, 0, minting);
  const dropFrom = masterIndex + Math.max(1, options.blockWidth);
  const dropTo = Math.min(options.tailStart + 1, options.suffixStart);
  for (let index = dropFrom; index < dropTo && index < outputs.length; index++) {
    if (!isDisposableAlignmentPad(outputs[index])) continue;
    outputs.splice(index, 1);
    return true;
  }
  return true;
}

function commitmentHexOf(value: Uint8Array | string | undefined): string {
  if (value instanceof Uint8Array) return binToHex(value);
  return value ?? '';
}

export type MaterializedReturnExpectation = {
  groupIndex: number;
  categoryId: string;
  commitment: Uint8Array | string;
  currentIndex?: number;
  builtIndex?: number;
};

/**
 * Bind logical return witnesses to matching outputs in the materialized transaction.
 * Existing valid bindings win; unresolved returns use distinct matching outputs in
 * physical order. This makes final output content authoritative without depending
 * on contract names or provisional input/output-count symmetry.
 */
export function matchMaterializedReturnOutputs(
  outputs: ReadonlyArray<{
    to?: Uint8Array | string;
    token?: {
      category?: string;
      nft?: { capability?: string; commitment?: Uint8Array | string };
    };
  }>,
  expectations: ReadonlyArray<MaterializedReturnExpectation>,
): Map<number, number> {
  const assigned = new Map<number, number>();
  const reserved = new Set<number>();
  const matches = (index: number, expected: MaterializedReturnExpectation): boolean => {
    const output = outputs[index];
    if (!isViewReturnTailOutput(output)) return false;
    if (output.token?.category?.toLowerCase() !== expected.categoryId.toLowerCase()) return false;
    const wanted = commitmentHexOf(expected.commitment).toLowerCase() || '0101';
    return commitmentHexOf(output.token.nft?.commitment).toLowerCase() === wanted;
  };

  for (const expected of expectations) {
    const preferred = [expected.currentIndex, expected.builtIndex]
      .filter((index): index is number => index !== undefined && index >= 0);
    const index = preferred.find((candidate) => !reserved.has(candidate) && matches(candidate, expected));
    if (index === undefined) continue;
    assigned.set(expected.groupIndex, index);
    reserved.add(index);
  }

  for (const expected of expectations) {
    if (assigned.has(expected.groupIndex)) continue;
    const index = outputs.findIndex((_, candidate) => (
      !reserved.has(candidate) && matches(candidate, expected)
    ));
    if (index < 0) continue;
    assigned.set(expected.groupIndex, index);
    reserved.add(index);
  }
  return assigned;
}

/** A same-index nested mutable may overwrite a stray event, pad, or stale P. */
export function shouldOverwriteForSameIndexTwin(existing: {
  to?: Uint8Array | string;
  token?: { category?: string; nft?: { capability?: string; commitment?: Uint8Array | string } };
} | undefined, twinLock: Uint8Array, twinCategory: string, twinCommitment?: string): boolean {
  if (!existing) return true;
  const lock = existing.to instanceof Uint8Array ? existing.to : undefined;
  if (existing.token?.nft?.capability === 'mutable'
    && existing.token.category === twinCategory
    && lock
    && lock.length === twinLock.length
    && lock.every((byte, offset) => byte === twinLock[offset])) {
    if (twinCommitment === undefined) return false;
    return commitmentHexOf(existing.token.nft.commitment as Uint8Array | string | undefined)
      !== twinCommitment;
  }
  if (isDisposableAlignmentPad(existing)) return true;
  return existing.token?.nft?.capability === 'none';
}

/**
 * Write a nested mutable at its input index without splicing. Park a displaced
 * event/view on a later alignment pad so view tails and the jobs suffix stay put.
 */
const SLOT_HEX = 64;

/** True for an unfilled sorted-list HEAD (empty or 32-byte slot 0). */
export function isSortedEntryHeadCommitment(commitment: string): boolean {
  if (commitment === '' || commitment === '00') return true;
  const hex = commitment.toLowerCase();
  if (hex.replace(/0/g, '') === '') return true;
  return hex.length >= SLOT_HEX && hex.slice(0, SLOT_HEX) === '0'.repeat(SLOT_HEX);
}

/** Data-NFT pushdata tag (00/51/52/53 + payload), not a sorted-list HEAD or NEW. */
export function isDataNftIndexCommitment(commitment: string): boolean {
  const hex = commitment.toLowerCase();
  if (hex.length < 4 || isSortedEntryHeadCommitment(hex)) return false;
  return /^(00|51|52|53)/.test(hex) && !isSortedEntryNodeCommitment(hex);
}

/** True for a 32-byte slot-prefixed entry node, not a data-NFT index tag. */
export function isSortedEntryNodeCommitment(commitment: string): boolean {
  const hex = commitment.toLowerCase();
  if (hex.length < SLOT_HEX) return false;
  if (hex.startsWith('00') || hex.startsWith('51') || hex.startsWith('52') || hex.startsWith('53')) {
    return false;
  }
  return true;
}

/** P' is slot(P)||slot(NEW)||value(P). Empty-value collections are 64 bytes, not 128. */
export function synthesizePredNewCommitment(inputCommitment: string, newNodeCommitment: string): string {
  const inputHex = inputCommitment.length >= SLOT_HEX ? inputCommitment : inputCommitment.padEnd(SLOT_HEX, '0');
  const slot = hexToBin(inputHex.slice(0, SLOT_HEX).padEnd(SLOT_HEX, '0'));
  const next = hexToBin(newNodeCommitment.slice(0, SLOT_HEX).padEnd(SLOT_HEX, '0'));
  const rawValue = inputHex.length > SLOT_HEX * 2 ? hexToBin(inputHex.slice(SLOT_HEX * 2)) : new Uint8Array();
  const value = rawValue.every((byte) => byte === 0) ? new Uint8Array() : rawValue;
  return binToHex(encodeEntryCommitment(slot, next, value));
}

export type SameIndexTwinOptions = {
  tailStart: number;
  suffixStart: number;
  /** Leave these indexes for INSERT NEW / other reserved band members. */
  reservedIndexes?: readonly number[];
  /** Skip pads that still sit inside these collection locks (jobEvents, etc.). */
  skipLocks?: readonly Uint8Array[];
};

function outputMatchesLock(
  output: { to?: Uint8Array | string } | undefined,
  lock: Uint8Array,
): boolean {
  let bytes = output?.to instanceof Uint8Array ? output.to : undefined;
  if (!bytes && typeof output?.to === 'string') {
    try {
      bytes = addressToLockScript(output.to);
    } catch {
      return false;
    }
  }
  return !!bytes
    && bytes.length === lock.length
    && bytes.every((byte, offset) => byte === lock[offset]);
}

/** First alignment pad after reserved collection indexes, before view tails / jobs. */
export function nextAlignmentPadIndex<T extends {
  to?: Uint8Array | string;
  token?: unknown;
}>(
  outputs: T[],
  start: number,
  options: SameIndexTwinOptions,
  twinLock?: Uint8Array,
  twinCategory?: string,
): number {
  const reserved = new Set(options.reservedIndexes ?? []);
  const parkTo = Math.min(options.tailStart, options.suffixStart);
  for (let dest = start; dest < parkTo && dest < outputs.length; dest++) {
    if (reserved.has(dest)) continue;
    const candidate = outputs[dest];
    const candidateLock = candidate?.to instanceof Uint8Array ? candidate.to : undefined;
    if (twinLock && candidate?.token && (candidate.token as { nft?: { capability?: string }; category?: string })
      .nft?.capability === 'mutable'
      && (candidate.token as { category?: string }).category === twinCategory
      && candidateLock
      && candidateLock.length === twinLock.length
      && candidateLock.every((byte, offset) => byte === twinLock[offset])) {
      continue;
    }
    if ((options.skipLocks ?? []).some((lock) => outputMatchesLock(candidate, lock)
      && (candidate as { token?: { nft?: { capability?: string } } }).token?.nft?.capability === 'mutable')) {
      continue;
    }
    if (isDisposableAlignmentPad(candidate)) return dest;
  }
  return -1;
}

export function placeSameIndexTwin<T extends {
  to?: Uint8Array | string;
  token?: { category?: string; nft?: { capability?: string; commitment?: Uint8Array | string } };
}>(
  outputs: T[],
  index: number,
  twin: T,
  options: SameIndexTwinOptions,
): boolean {
  const twinLock = twin.to instanceof Uint8Array ? twin.to : undefined;
  const twinCategory = twin.token?.category ?? '';
  const twinCommitment = commitmentHexOf(twin.token?.nft?.commitment as Uint8Array | string | undefined);
  if (!twinLock || !shouldOverwriteForSameIndexTwin(
    outputs[index], twinLock, twinCategory, twinCommitment,
  )) {
    return false;
  }
  const occupant = outputs[index];
  const occupantLock = occupant?.to instanceof Uint8Array ? occupant.to : undefined;
  const sameLock = !!occupantLock
    && occupantLock.length === twinLock.length
    && occupantLock.every((byte, offset) => byte === twinLock[offset])
    && occupant?.token?.nft?.capability === 'mutable'
    && occupant.token.category === twinCategory;
  if (sameLock) {
    outputs[index] = twin;
    return true;
  }
  outputs[index] = twin;
  if (!occupant || isDisposableAlignmentPad(occupant)) return true;
  const dest = nextAlignmentPadIndex(outputs, index + 1, options, twinLock, twinCategory);
  if (dest >= 0) outputs[dest] = occupant;
  return true;
}

export function placeInsertNewAt<T extends {
  to?: Uint8Array | string;
  amount?: bigint;
  token?: { category?: string; nft?: { capability?: string; commitment?: Uint8Array | string } };
}>(
  outputs: T[],
  newIndex: number,
  newNode: T,
  options: SameIndexTwinOptions,
): number {
  if (newIndex >= outputs.length) return -1;
  const occupant = outputs[newIndex];
  const occupantCommit = commitmentHexOf(occupant?.token?.nft?.commitment as Uint8Array | string | undefined);
  if (occupant?.token?.nft?.capability === 'minting' || isDataNftIndexCommitment(occupantCommit)) {
    return -1;
  }
  const newLock = newNode.to instanceof Uint8Array ? newNode.to : undefined;
  if (newLock && outputMatchesLock(occupant, newLock)
    && occupant?.token?.nft?.capability === 'mutable') {
    outputs[newIndex] = newNode;
    return newIndex;
  }
  const dest = nextAlignmentPadIndex(
    outputs, newIndex, { ...options, reservedIndexes: options.reservedIndexes },
    newLock, newNode.token?.category,
  );
  outputs[newIndex] = newNode;
  if (occupant && !isDisposableAlignmentPad(occupant) && dest >= 0 && dest !== newIndex) {
    outputs[dest] = occupant;
  }
  return newIndex;
}

export function shouldDisplaceForNestedEvent(
  existing: {
    to?: Uint8Array | string;
    token?: { category?: string; nft?: { capability?: string; commitment?: Uint8Array | string } };
  } | undefined,
  eventCategoryId: string,
): boolean {
  if (!existing?.token || existing.token.nft?.capability !== 'none' || !existing.token.category) {
    return false;
  }
  if (existing.token.category !== eventCategoryId) return true;
  const commitment = String(existing.token.nft.commitment ?? '').toLowerCase();
  if (commitment.startsWith('5343494401')) return true;
  return isViewReturnTailOutput(existing);
}

/** Pads, SCID carriers, and short data-NFT clones (`0057000000`) at the emit dest. */
export function isOverwritableEmitOccupant(output?: {
  to?: Uint8Array | string;
  token?: { nft?: { capability?: string; commitment?: Uint8Array | string } };
}, options?: { consumedMutableOk?: boolean }): boolean {
  if (!output || isDisposableAlignmentPad(output) || !output.token) return true;
  if (output.token.nft?.capability === 'minting') return false;
  const commit = String(output.token.nft?.commitment ?? '');
  if (commit.startsWith('53434944') || commit.length <= 16) return true;
  // A compiler-owned event slot may replace a mutable predecessor only when the
  // caller has established that the write consumes it. Unrelated conservation
  // twins remain owners of their materialized output.
  return options?.consumedMutableOk === true
    && output.token.nft?.capability === 'mutable'
    && commit.length >= 24;
}

/** INPUTINDEX+4 must not replace a minting/mutable 1:1 occupant (MD uniqueness / data NFT). */
export function emitDestCollidesPreservedInput(input?: {
  token?: { nft?: { capability?: string } };
}): boolean {
  const capability = input?.token?.nft?.capability;
  return capability === 'minting' || capability === 'mutable';
}

export function publishJobEventOutputIndex(implIndex: number, eventOffset = 4): number {
  return implIndex < 0 ? -1 : implIndex + eventOffset;
}

/** Created JobEvent CAT (`005e19…` / `5e19…`). */
export function isCreatedJobEventCommitment(commitment: string): boolean {
  const hex = commitment.toLowerCase();
  return hex.startsWith('005e') || hex.startsWith('5e19');
}

/**
 * JobEvent dest is `INPUTINDEX + event.offset` of the executing publishJobEvent.
 * Occupancy may park Created later (dest 26); move it onto the executing dest
 * and clear the stray so uniqueness WITHIN[4,5) sees dest 22, not dest 26.
 */
export function relocateJobEventEmitToDest(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
  }>,
  dest: number,
  options?: { consumedMutableOk?: boolean; preferCreated?: boolean },
): boolean {
  if (dest < 0) return false;
  while (outputs.length <= dest) {
    outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
  }
  const destCommit = String(outputs[dest]?.token?.nft?.commitment ?? '');
  if (outputs[dest]?.token?.nft?.capability === 'none' && isJobEventEmitCommitment(destCommit)) {
    for (let index = 0; index < outputs.length; index++) {
      if (index === dest) continue;
      const other = outputs[index];
      if (other?.token?.nft?.capability !== 'none') continue;
      if (!isJobEventEmitCommitment(String(other.token?.nft?.commitment ?? ''))) continue;
      outputs[index] = { to: Uint8Array.of(0x51), amount: 1000n };
    }
    return true;
  }
  // First publish parks Created at dest 26; later updates must not steal persist.
  if (options?.preferCreated === false) return false;
  let source = -1;
  for (let index = 0; index < outputs.length; index++) {
    if (index === dest) continue;
    const other = outputs[index];
    if (other?.token?.nft?.capability !== 'none') continue;
    const commit = String(other.token?.nft?.commitment ?? '');
    if (!isCreatedJobEventCommitment(commit)) continue;
    source = index;
    break;
  }
  if (source < 0) return false;
  const occupant = outputs[dest];
  if (occupant && !isOverwritableEmitOccupant(occupant, {
    consumedMutableOk: options?.consumedMutableOk,
  })) {
    return false;
  }
  const moved = outputs[source];
  outputs[dest] = moved;
  outputs[source] = { to: Uint8Array.of(0x51), amount: 1000n };
  return true;
}

const SCID_COMMIT_PREFIX = '53434944';

/**
 * True when an output already carries a substantive immutable NFT claim.
 *
 * Layout owners use an empty/all-zero commitment while a slot is still a placeholder, and SCID commitments are
 * transport identities rather than application output claims. Any other immutable commitment is materialized and
 * must outrank a later same-index conservation repair when its coordinate is reserved by the compiler.
 */
export function isMaterializedImmutableNftOutput(output: {
  token?: { nft?: { capability?: string; commitment?: string | Uint8Array } };
} | undefined): boolean {
  if (output?.token?.nft?.capability !== 'none') return false;
  const commitment = commitmentHexOf(output.token.nft.commitment).toLowerCase();
  return commitment.length > 0
    && !/^0+$/.test(commitment)
    && !commitment.startsWith(SCID_COMMIT_PREFIX);
}

/** True when an output is a proxy-category event NFT (capability none) and not a SCID identity. */
export function isDelegateEventNftOutput(output: {
  token?: { nft?: { capability?: string; commitment?: string } };
} | undefined): boolean {
  if (output?.token?.nft?.capability !== 'none') return false;
  const commit = String(output.token?.nft?.commitment ?? '');
  return commit.length > 0 && !commit.toLowerCase().startsWith(SCID_COMMIT_PREFIX);
}

/**
 * Delegate emit verification is `OP_INPUTINDEX + event.offset` of the implementation.
 * The builder often parks that NFT in the proxy event band; move it onto dest.
 */
function lockingHexOf(output: { to?: Uint8Array | string } | undefined): string {
  if (!output?.to) return '';
  return output.to instanceof Uint8Array ? binToHex(output.to) : String(output.to);
}

export type DelegateEventClaim = {
  destination: number;
  categoryId: string;
  lockingBytecode: Uint8Array;
  commitment: string;
};

/**
 * An implementation's event epilogue admits own-category event NFTs only at its published event slots. Earlier
 * layout passes can leave an exact clone on a return/alignment witness. Keep every explicitly claimed physical
 * destination and make only unclaimed exact clones inert; unrelated events and their tokens remain untouched.
 */
export function demoteUnclaimedDelegateEventClones<T extends {
  to?: Uint8Array | string;
  token?: { category?: string; nft?: { capability?: string; commitment?: string | Uint8Array } };
}>(outputs: T[], claims: readonly DelegateEventClaim[]): number {
  const commitmentHex = (value: unknown): string => (
    value instanceof Uint8Array ? binToHex(value) : String(value ?? '').toLowerCase()
  );
  const destinationsByIdentity = new Map<string, Set<number>>();
  for (const claim of claims) {
    const identity = `${claim.categoryId}:${binToHex(claim.lockingBytecode)}:${claim.commitment.toLowerCase()}`;
    const destinations = destinationsByIdentity.get(identity) ?? new Set<number>();
    destinations.add(claim.destination);
    destinationsByIdentity.set(identity, destinations);
  }
  let demoted = 0;
  for (const [index, output] of outputs.entries()) {
    if (output.token?.nft?.capability !== 'none' || !output.token.category) continue;
    const identity = `${output.token.category}:${lockingHexOf(output)}:${commitmentHex(output.token.nft.commitment)}`;
    const destinations = destinationsByIdentity.get(identity);
    if (!destinations || destinations.has(index)) continue;
    outputs[index] = { ...output, to: Uint8Array.of(0x51) };
    demoted += 1;
  }
  return demoted;
}

export function relocateDelegateEventNftToDest(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
  }>,
  dest: number,
  expectedLocking?: Uint8Array,
): boolean {
  if (dest < 0) return false;
  while (outputs.length <= dest) {
    outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
  }
  const expectedHex = expectedLocking ? binToHex(expectedLocking) : undefined;
  const matches = (output: typeof outputs[number] | undefined): boolean => (
    isDelegateEventNftOutput(output)
    && (expectedHex === undefined || lockingHexOf(output) === expectedHex)
  );
  if (matches(outputs[dest])) return true;
  if (outputs[dest]?.token?.nft?.capability === 'minting') return false;
  let source = -1;
  for (let index = 0; index < outputs.length; index++) {
    if (index === dest) continue;
    if (!matches(outputs[index])) continue;
    source = index;
    break;
  }
  if (source < 0) return false;
  const moved = outputs[source];
  outputs[dest] = moved;
  outputs[source] = { to: Uint8Array.of(0x51), amount: 1000n };
  return true;
}

/**
 * Map visible call args onto event parameters by name (`treasuryAddress_` → `treasuryAddress`).
 * Incomplete mappings return undefined so a later emit pass can fill the slot.
 */
export function resolveNamedEventValues(
  parameters: readonly { name: string }[],
  visibleInputs: readonly { name: string }[],
  args: readonly unknown[],
): unknown[] | undefined {
  const byName = new Map<string, unknown>();
  visibleInputs.forEach((input, index) => {
    byName.set(input.name, args[index]);
    byName.set(input.name.replace(/_+$/, ''), args[index]);
  });
  const values = parameters.map((parameter) => (
    byName.has(parameter.name) ? byName.get(parameter.name) : undefined
  ));
  return values.every((value) => value !== undefined) ? values : undefined;
}

/** JobEvent.type_ from a positional tuple or named struct. */
export function jobEventTypeOf(event: unknown): number | undefined {
  const raw = Array.isArray(event)
    ? event[0]
    : event && typeof event === 'object' && !Array.isArray(event)
      ? (event as { type_?: unknown }).type_
      : undefined;
  if (typeof raw === 'bigint' || typeof raw === 'number') {
    const type = Number(raw);
    return Number.isInteger(type) && type >= 0 && type <= 16 ? type : undefined;
  }
  return undefined;
}

function jobEventFieldEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === 0 || value === 0n || value === '') return true;
  if (value instanceof Uint8Array) return value.length === 0;
  return false;
}

export function stampEmptyJobEventTimestamp(event: unknown, timestamp: bigint): unknown {
  if (timestamp <= 0n) return event;
  if (Array.isArray(event)) {
    if (!jobEventFieldEmpty(event[3])) return event;
    const next = [...event];
    next[3] = timestamp;
    return next;
  }
  if (event && typeof event === 'object') {
    const record = event as { timestamp_?: unknown };
    if (!jobEventFieldEmpty(record.timestamp_)) return event;
    return { ...record, timestamp_: timestamp };
  }
  return event;
}

/**
 * Persist UPDATE rematerialize (Created digest + persist `v`) is only for
 * empty-address JobEvents (Closed / CollateralWithdrawn). Created and
 * Whitelisted carry an address and are INSERT/dest rows — restamping persist
 * `v` there rewrites second-publish nNew and the whitelist dest.
 */
export function isWithdrawShapedJobEvent(event: unknown): boolean {
  if (jobEventTypeOf(event) === undefined) return false;
  if (Array.isArray(event)) return jobEventFieldEmpty(event[1]);
  if (event && typeof event === 'object') {
    return jobEventFieldEmpty((event as { address_?: unknown }).address_);
  }
  return false;
}

export function shouldRematerializePersistUpdate(parts: {
  persistReady: boolean;
  publishJobPost: boolean;
  event?: unknown;
  plannedInserts?: number;
}): boolean {
  if (!parts.persistReady || parts.publishJobPost) return false;
  if ((parts.plannedInserts ?? 0) > 0) return false;
  return isWithdrawShapedJobEvent(parts.event);
}

/** First-publish Created / whitelist INSERT dests must keep their own redeem lock. */
export function isInsertShapedJobEvent(event: unknown): boolean {
  const type = jobEventTypeOf(event);
  return type === 0 || type === 14 || type === 15;
}

/**
 * Persist UPDATE band slots (updateJobPost nNew=3) EQUALVERIFY the Created
 * digest redeem. First-publish INSERT dests and whitelist writes must not.
 */
export function shouldStampPersistUpdateDigestLock(parts: {
  persistReady: boolean;
  persistWidth: number;
  firstPublishInsert: boolean;
}): boolean {
  return parts.persistReady && parts.persistWidth > 0 && !parts.firstPublishInsert;
}

function isIntegerType(type: string): boolean {
  return /^(?:u?int(?:\d+)?|bigint)$/.test(type);
}

function scalarTypeKey(type: string): string | undefined {
  // Keep integer width/sign in the key so a uint256 slot word does not unique-zip onto a packed uint16.
  if (isIntegerType(type)) return type;
  if (type === 'bool') return 'bool';
  if (type === 'byte') return 'bytes1';
  if (/^bytes\d+$/.test(type)) return type;
  if (type === 'bytes' || type === 'string') return 'bytes';
  return undefined;
}

function canEncodeScalarStateValue(value: StateValue, type: string): boolean {
  try {
    encodePushdataValue(value, type);
    return true;
  } catch {
    return false;
  }
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const lex: T[][] = [];
  const permute = (prefix: T[], rest: T[]): void => {
    if (rest.length === 0) {
      lex.push(prefix);
      return;
    }
    rest.forEach((item, index) => {
      permute([...prefix, item], rest.slice(0, index).concat(rest.slice(index + 1)));
    });
  };
  permute([], items);
  // Rotations put a crossed assignment (a=z,b=x,c=y) first: shift n-1 is [last, 0, 1, ...].
  const rotations: T[][] = [];
  for (let k = 1; k <= items.length; k += 1) {
    const shift = items.length - k;
    rotations.push(items.map((_, index) => items[(index + shift) % items.length]));
  }
  const rotationKeys = new Set(rotations.map((perm) => perm.join('\0')));
  return [...rotations, ...lex.filter((perm) => !rotationKeys.has(perm.join('\0')))];
}

function fieldNameMatchesArg(fieldName: string, argName: string): boolean {
  const field = fieldName.toLowerCase();
  const arg = argName.toLowerCase();
  if (field === arg) return true;
  const stripped = arg.replace(/^(?:new|next|updated|set|from|old|prev|dest|the|init|src|tmp|val)/, '');
  return stripped.length > 0 && stripped === field;
}

function evalSimpleIntegerSource(source: string | undefined): bigint | undefined {
  if (source === undefined) return undefined;
  const literal = source.match(/^(?:lit|const):(-?[0-9]+)$/);
  if (literal) return BigInt(literal[1]);
  const binary = source.match(/^binop:([+*-])\((.*)\)$/);
  if (!binary) return undefined;
  const splitTopLevel = (s: string): [string, string] | undefined => {
    let depth = 0;
    for (let i = 0; i < s.length; i += 1) {
      if (s[i] === '(' || s[i] === '[' || s[i] === '{') depth += 1;
      else if (s[i] === ')' || s[i] === ']' || s[i] === '}') depth -= 1;
      else if (s[i] === ',' && depth === 0) return [s.slice(0, i), s.slice(i + 1)];
    }
    return undefined;
  };
  const pair = splitTopLevel(binary[2]);
  if (pair === undefined) return undefined;
  const left = evalSimpleIntegerSource(pair[0]);
  const right = evalSimpleIntegerSource(pair[1]);
  if (left === undefined || right === undefined) return undefined;
  if (binary[1] === '+') return left + right;
  if (binary[1] === '-') return left - right;
  return left * right;
}

function paramToStateValue(param: unknown, abiType: string): StateValue | undefined {
  const key = scalarTypeKey(abiType);
  if (key === undefined || param === undefined || param === null) return undefined;
  if (isIntegerType(abiType)) {
    if (typeof param === 'bigint') return param;
    if (typeof param === 'number' && Number.isInteger(param)) return BigInt(param);
    return undefined;
  }
  if (key === 'bool') {
    return typeof param === 'boolean' ? param : undefined;
  }
  if (param instanceof Uint8Array) return param;
  if (typeof param === 'string' && (abiType === 'string' || abiType === 'bytes')) return param;
  return undefined;
}

/**
 * Dest-18 UPDATE EQUALVERIFYs the jobEvents entry-NFT p2sh32: persist proxy
 * category + collection `jobEvents:mapping(uint256 => JobEventData[])`.
 * That is emitSortedEntryAddress, not a value-chunk domain lock.
 */
export function persistUpdateDigestLock(
  categoryId?: string,
  _extraCategories: readonly string[] = [],
  write?: ValueChunkWriteDescriptor | null,
): Uint8Array | undefined {
  if (!categoryId || !/^[0-9a-f]{64}$/i.test(categoryId)) return undefined;
  if (write === null) return undefined;
  try {
    if (write && write.categoryId.toLowerCase() !== categoryId.toLowerCase()) return undefined;
    const collectionHash = write
      ? computeCollectionHash(write.collectionSignature)
      // Compatibility only for artifacts predating exact collection-write descriptors.
      : computeCollectionHash(
        computeCollectionSignature('jobEvents', 'mapping(uint256 => JobEventData[])'),
      );
    if (write && binToHex(collectionHash) !== write.collectionHash.toLowerCase()) return undefined;
    return scriptToLockingBytecode(
      buildEntryNftCovenantScript(hexToBin(categoryId), collectionHash),
      'p2sh32',
    );
  } catch {
    return undefined;
  }
}

/** Dest 18 is the jobEvents entry lock; dest 19+ keep the consumed persist-v lock. */
export function persistUpdateDestLock(parts: {
  destOffset: number;
  entryLock?: Uint8Array;
  persistLock?: Uint8Array;
  inputLock?: Uint8Array;
}): Uint8Array | undefined {
  if (parts.destOffset === 0) return parts.entryLock ?? parts.persistLock ?? parts.inputLock;
  return parts.persistLock ?? parts.inputLock ?? parts.entryLock;
}

/** Close / CollateralWithdrawn (and similar) carry empty address/data/timestamp. */
export function isEmptyPayloadJobEvent(event: unknown): boolean {
  if (jobEventTypeOf(event) === undefined) return false;
  if (Array.isArray(event)) {
    return jobEventFieldEmpty(event[1]) && jobEventFieldEmpty(event[2]) && jobEventFieldEmpty(event[3]);
  }
  if (event && typeof event === 'object') {
    const record = event as { address_?: unknown; data_?: unknown; timestamp_?: unknown };
    return jobEventFieldEmpty(record.address_)
      && jobEventFieldEmpty(record.data_)
      && jobEventFieldEmpty(record.timestamp_);
  }
  return false;
}

function jobEventTimestampOf(event: unknown): bigint | undefined {
  const raw = Array.isArray(event)
    ? event[3]
    : (event && typeof event === 'object'
      ? (event as { timestamp_?: unknown }).timestamp_
      : undefined);
  if (typeof raw === 'bigint') return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) return BigInt(raw);
  return undefined;
}

/**
 * Emit blob for an empty-payload JobEvent: `00||OP_type||00 00 || timestamp`.
 * Persist last-row Closed is `0057000000`; CollateralWithdrawn with a stamp is
 * `0060000004…` — the impl EQUALVERIFYs that CAT, not the unstamped `0060000000`.
 */
export function encodeEmptyJobEventEmitCommitment(jobId: unknown, event: unknown): string | undefined {
  const type = jobEventTypeOf(event);
  if (type === undefined) return undefined;
  const addressEmpty = Array.isArray(event)
    ? jobEventFieldEmpty(event[1])
    : jobEventFieldEmpty((event as { address_?: unknown })?.address_);
  const dataEmpty = Array.isArray(event)
    ? jobEventFieldEmpty(event[2])
    : jobEventFieldEmpty((event as { data_?: unknown })?.data_);
  if (!addressEmpty || !dataEmpty) return undefined;
  const id = typeof jobId === 'bigint' || typeof jobId === 'number' ? Number(jobId) : 0;
  if (!Number.isInteger(id) || id < 0 || id > 16) return undefined;
  const idHex = id === 0 ? '00' : (id + 0x50).toString(16).padStart(2, '0');
  const typeHex = type === 0 ? '00' : (type + 0x50).toString(16).padStart(2, '0');
  const timestamp = jobEventTimestampOf(event);
  if (timestamp !== undefined && timestamp > 0n) {
    const stamped = encodeDataPush(encodeInt(timestamp));
    if (stamped.length > 0) {
      return `${idHex}${typeHex}0000${binToHex(stamped)}`;
    }
  }
  return `${idHex}${typeHex}000000`;
}

/** Same CAT the emit covenant uses: pushdata(jobId) || pushdata(event). */
export function encodeJobEventEmitCommitment(
  jobId: unknown,
  event: unknown,
  structs?: Artifact['structs'],
): string | undefined {
  try {
    const jobEnc = encodePushdataValue(jobId as StateValue, 'uint256');
    const eventEnc = encodePushdataValue(event as StateValue, 'JobEventData', structs);
    if (!(jobEnc instanceof Uint8Array) || !(eventEnc instanceof Uint8Array)) return undefined;
    const out = new Uint8Array(jobEnc.length + eventEnc.length);
    out.set(jobEnc, 0);
    out.set(eventEnc, jobEnc.length);
    return binToHex(out);
  } catch {
    return encodeEmptyJobEventEmitCommitment(jobId, event);
  }
}

/** JobEvent NFT commitment: 00||struct (005e19… / 005f19… / 0023aa20…) not a value-chunk 00||120B. */
export function isJobEventEmitCommitment(commitment: string): boolean {
  const hex = commitment.toLowerCase();
  if (hex.startsWith('53434944')) return false;
  // CollateralWithdrawn (type 16 / OP_16). Timestamp-stamped rows are longer
  // than Closed leftovers (`0057000000`) and must not share that classifier.
  if (hex.startsWith('0060') && hex.length >= 10 && hex.length <= 48) return true;
  if (hex.length < 20 || hex.length > 160) return false;
  // OP_1..OP_16 after jobId 0 covers Created (5e), Whitelisted (5f), Closed (57), …
  if (/^00(5[1-9a-f]|60)/.test(hex)) return true;
  if (hex.startsWith('5e19') || hex.startsWith('5f19')) return true;
  return hex.startsWith('0019') || hex.startsWith('0023') || hex.startsWith('00aa20');
}

/**
 * Any emit-slot commitment the covenant EQUALVERIFYs — JobEvent blobs and
 * typed events such as Initialized(uint64)=`51` or packed addresses.
 * SCID identity and empty probes are not emits.
 */
export function isLearnedEventEmitCommitment(commitment: string): boolean {
  const hex = commitment.toLowerCase();
  if (!hex || hex.startsWith('53434944') || /^(00)+$/.test(hex)) return false;
  if (isJobEventEmitCommitment(hex)) return true;
  // Script-number events (Initialized(1) → OP_1).
  if (hex.length <= 2) return hex === '01' || /^5[1-9a-f]$/.test(hex) || hex === '60';
  // Packed ABI payloads (OwnershipTransferred, ArbitratorRegistered, …).
  return hex.length >= 4 && hex.length <= 256;
}

/**
 * Decide whether an output-pin observation can repair an event NFT. A compiler-owned event coordinate is already
 * authenticated by both block layout and the implementation's `OUTPUTTOKENCOMMITMENT EQUALVERIFY`, so every
 * non-empty encoding is meaningful there — including `00` for a typed zero value. Unowned coordinates retain the
 * conservative shape filter because an all-zero value there can be an unrelated speculative placeholder.
 */
export function isAuthenticatedEventRepairCommitment(
  commitment: Uint8Array, compilerOwnedEventSlot: boolean,
): boolean {
  if (commitment.length === 0) return false;
  if (compilerOwnedEventSlot) return true;
  if (commitment.every((byte) => byte === 0)) return false;
  const hex = binToHex(commitment);
  return commitment.length > 32 || isLearnedEventEmitCommitment(hex);
}

/**
 * Make an unclaimed compiler-owned event coordinate neutral. Removing only the
 * token is insufficient: collection covenants authenticate exact output
 * cardinality by locking bytecode, so a displaced entry lock would still be
 * counted as an extra collection node.
 */
export function demoteUnclaimedConditionalEventOutput(output: {
  to?: Uint8Array | string;
  token?: {
    category?: string;
    nft?: { capability?: string; commitment?: Uint8Array | string };
  };
}, categoryId: string): boolean {
  if (output.token?.category !== categoryId) return false;
  const capability = output.token.nft?.capability;
  const raw = output.token.nft?.commitment;
  const dummyCommitment = raw instanceof Uint8Array
    ? raw.length === 0 || raw.every((byte) => byte === 0) || binToHex(raw) === '53434944'
    : (() => {
      const hex = String(raw ?? '');
      return hex === '' || /^(00)+$/.test(hex) || hex.toLowerCase() === '53434944';
    })();
  if (capability !== 'mutable' && (capability !== 'none' || !dummyCommitment)) return false;
  output.to = Uint8Array.of(Op.OP_1);
  delete output.token;
  return true;
}

function isEmptySameCategoryNoneCap(
  output: {
    token?: { category?: string; nft?: { capability?: string; commitment?: string } };
  } | undefined,
  category: string,
): boolean {
  if (output?.token?.category !== category || output.token.nft?.capability !== 'none') return false;
  const commit = String(output.token.nft.commitment ?? '');
  return commit === '' || /^0+$/.test(commit);
}

/** Last writer for publishJobEvent: impl+event.offset, and drop a cloned stub on dest+1. */
export function placePublishJobEventOutput(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
  }>,
  dest: number,
  placed: {
    to: Uint8Array;
    amount?: bigint;
    token: { amount: bigint; category: string; nft: { capability: 'none'; commitment: string } };
  },
  options?: {
    clearClonedStub?: boolean;
    refuseEmpty?: boolean;
    consumedMutableOk?: boolean;
    destInput?: { token?: { nft?: { capability?: string } } };
  },
): boolean {
  if (dest < 0) return false;
  const destinationInputCapability = options?.destInput?.token?.nft?.capability;
  if (emitDestCollidesPreservedInput(options?.destInput)
    && !(options?.consumedMutableOk === true && destinationInputCapability === 'mutable')) return false;
  const placedCommit = String(placed.token.nft.commitment ?? '');
  // Persist dest sits inside the MD minting uniqueness window. An empty or
  // short `0057000000` same-category none-cap there is minting-shaped
  // (input 14 / 0 GTE VERIFY). First publish still places an empty event NFT
  // so extract can read Created. Persist waits for a real JobEvent blob.
  if (options?.refuseEmpty === true && !isJobEventEmitCommitment(placedCommit)) {
    if (dest < outputs.length && (
      isEmptySameCategoryNoneCap(outputs[dest], placed.token.category)
      || (outputs[dest]?.token?.category === placed.token.category
        && outputs[dest]?.token?.nft?.capability === 'none'
        && String(outputs[dest]?.token?.nft?.commitment ?? '') === '0057000000')
    )) {
      outputs[dest] = { to: Uint8Array.of(0x51), amount: 1000n };
    }
    return false;
  }
  while (outputs.length <= dest) {
    outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
  }
  const current = outputs[dest];
  const commit = String(current?.token?.nft?.commitment ?? '');
  const alreadyEvent = current?.token?.nft?.capability === 'none'
    && commit.length > 20
    && !commit.startsWith('53434944')
    && (
      current.token.category === placed.token.category
      || isJobEventEmitCommitment(commit)
    );
  if (alreadyEvent) {
    // A JobEvent token parked on a P2PKH (or other) lock still fails the event-covenant
    // OUTPUTBYTECODE pin. Keep the commitment, restore the event locking bytecode.
    outputs[dest] = {
      to: placed.to,
      amount: placed.amount ?? current?.amount ?? 1200n,
      token: current!.token,
    };
  } else {
    if (current && !isOverwritableEmitOccupant(current, {
      consumedMutableOk: options?.consumedMutableOk,
    })) {
      return false;
    }
    outputs[dest] = { to: placed.to, amount: placed.amount ?? 1200n, token: placed.token };
  }
  if (options?.clearClonedStub === true) {
    const next = outputs[dest + 1];
    if (next?.token?.category === placed.token.category
      && next.token.nft?.capability !== 'none'
      && isOverwritableEmitOccupant(next)) {
      outputs[dest + 1] = { to: Uint8Array.of(0x51), amount: 1000n };
    }
  }
  // Only a JobEvent dest needs a unique sibling. Typed events
  // (OwnershipTransferred, Initialized) share the proxy category.
  if (isJobEventEmitCommitment(placedCommit)) {
    for (let index = 0; index < outputs.length; index++) {
      if (index === dest) continue;
      const other = outputs[index];
      if (other?.token?.category !== placed.token.category) continue;
      if (other.token.nft?.capability !== 'none') continue;
      if (!isJobEventEmitCommitment(String(other.token.nft?.commitment ?? ''))) continue;
      outputs[index] = { to: Uint8Array.of(0x51), amount: 1000n };
    }
  }
  return true;
}

/**
 * INSERT P' is a trailing output at the participant's runtime-resource base (+ ordinal). Negative
 * values are covenant sentinels (update / alias). A planner that still emits a
 * fixed entry offset below that base for an INSERT must not be rebased onto that
 * 1:1 preserved slot — that is the transferFrom output-30 vs output-34 pin.
 */
export function groupLayoutBlockSize(group: {
  blockLayout?: { blockSize?: number };
  compilerRoute?: { abiFunction?: { blockLayout?: { blockSize?: number } } };
}): number {
  return group.blockLayout?.blockSize
    ?? group.compilerRoute?.abiFunction?.blockLayout?.blockSize
    ?? 8;
}

/** First physical slot available to bounded runtime resources in a participant block. */
export function groupLayoutTrailingBase(group: {
  blockLayout?: { blockSize?: number; trailingBase?: number };
  compilerRoute?: { abiFunction?: { blockLayout?: { blockSize?: number; trailingBase?: number } } };
}): number {
  const layout = group.blockLayout ?? group.compilerRoute?.abiFunction?.blockLayout;
  return layout?.trailingBase ?? layout?.blockSize ?? 8;
}

/** True when an absolute output is owned by a slot of `kind` in a participant's fixed block. */
export function blockOutputOwnsSlotKind(
  outputIndex: number,
  blockBase: number,
  layout: FunctionBlockLayout | undefined,
  kind: BlockSlotKind,
): boolean {
  if (!layout || blockBase < 0 || outputIndex < blockBase) return false;
  const relative = outputIndex - blockBase;
  return layout.slots[relative]?.kind === kind
    || layout.slots.some((slot) => slot.kind === kind && slot.offset === relative);
}

/**
 * True when an absolute output is one of a participant's fixed data-NFT outputs.
 * Modern artifacts declare the exact (possibly sparse) slots. Older artifacts
 * use the original dense master+1..N convention, so only those need the count
 * fallback.
 */
export function blockOutputOwnsFixedDataNft(
  outputIndex: number,
  blockBase: number,
  layout: FunctionBlockLayout | undefined,
  dataNftCount: number,
): boolean {
  if (blockBase < 0 || outputIndex < blockBase) return false;
  const declared = layout?.slots.filter((slot) => slot.kind === 'dataNft') ?? [];
  const relative = outputIndex - blockBase;
  if (declared.length > 0) return declared.some((slot) => slot.offset === relative);
  return relative >= 1 && relative <= dataNftCount;
}

/** Resolve the first trailing predecessor from the output slot the batch planner actually materializes. */
export function materializedPredOutBase(group: {
  batchPredecessorOutputs?: Array<{ outputBlockSlot: number }>;
  blockLayout?: { blockSize?: number; trailingBase?: number };
  compilerRoute?: { abiFunction?: { blockLayout?: { blockSize?: number; trailingBase?: number } } };
}, masterIndex: number): number {
  const trailingBase = groupLayoutTrailingBase(group);
  const firstTrailingSlot = Math.min(
    ...((group.batchPredecessorOutputs ?? [])
      .map((output) => output.outputBlockSlot)
      .filter((slot) => Number.isInteger(slot) && slot >= trailingBase)),
  );
  return masterIndex + (Number.isFinite(firstTrailingSlot) ? firstTrailingSlot : trailingBase);
}

/**
 * INSERT/UPDATE P' follows the token block and the live jobEvents band.
 * If assigned view tails already occupy that slot, slide P' to after the last
 * view rather than overwriting an OP_TRUE none-cap return (input-5 leftover 01).
 */
export function predOutBaseAfterOccupancy(parts: {
  master: number;
  blockSize: number;
  jobEventsEnd?: number;
  viewTailStart?: number;
  viewTailEnd?: number;
}): number {
  const natural = parts.master + parts.blockSize;
  const afterJobEvents = (parts.jobEventsEnd ?? -1) + 1;
  let base = Math.max(natural, afterJobEvents);
  if (
    parts.viewTailStart !== undefined
    && parts.viewTailEnd !== undefined
    && parts.viewTailStart <= base
    && parts.viewTailEnd >= base
  ) {
    base = parts.viewTailEnd + 1;
  }
  return base;
}

export function resolveAbsolutePredOut(
  relative: bigint,
  masterIndex: number,
  trailingBase: number,
  relocatedBase?: number,
): bigint {
  if (relative < 0n) return relative;
  const natural = masterIndex + trailingBase;
  // A relocated base smaller than the executing master's trailing slot is the
  // proxy-minting + implementation-only base mistake (initialize PredOut 14 vs 17).
  const base = relocatedBase !== undefined && relocatedBase >= natural
    ? relocatedBase
    : natural;
  if (relative >= BigInt(base)) return relative;
  const ordinal = Number(relative) >= trailingBase ? Number(relative) - trailingBase : 0;
  return BigInt(base + ordinal);
}

const WRITER_BATCH_WITNESS = /^(?:__internal__vmapBatch(?:PredOut|Proof|Slot|Next|Rank)_\d+|__internal__vmapBatchRows_.+|__internal__vmapBatchTrailingCount)$/;

export function isWriterBatchWitnessName(name: string): boolean {
  return WRITER_BATCH_WITNESS.test(name);
}

/**
 * A view fused onto the same physical token group keeps its compilerRoute. The
 * later writer owns the INSERT/UPDATE batch plan; copy those witnesses over the
 * view's leftovers so PredOut remapping does not mint a second P'.
 */
export function inheritWriterBatchWitnesses<T>(
  target: Record<string, T> | undefined,
  writer: Record<string, T> | undefined,
): Record<string, T> {
  const next = { ...(target ?? {}) };
  for (const [name, value] of Object.entries(writer ?? {})) {
    if (isWriterBatchWitnessName(name)) next[name] = value;
  }
  return next;
}

/**
 * Promote a logical writer's complete sorted-batch plan onto the carrier that owns the physical unlocker.
 * A fused read may be the first logical callsite and therefore retain the carrier identity, but it must not
 * retain stale read-only topology witnesses after a sibling call writes the same participant.
 */
export function inheritWriterBatchPlan<T, P>(
  target: {
    internalArgs?: Record<string, T>;
    compilerRoute?: { internalArgs?: Record<string, T> };
    batchPredecessorOutputs?: P[];
  },
  writer: {
    internalArgs?: Record<string, T>;
    compilerRoute?: { internalArgs?: Record<string, T> };
    batchPredecessorOutputs?: P[];
  } | undefined,
): boolean {
  if (!writer) return false;
  let changed = false;
  if ((target.batchPredecessorOutputs?.length ?? 0) === 0
    && (writer.batchPredecessorOutputs?.length ?? 0) > 0) {
    target.batchPredecessorOutputs = writer.batchPredecessorOutputs;
    changed = true;
  }
  const writerArgs = { ...writer.compilerRoute?.internalArgs, ...writer.internalArgs };
  if (!Object.keys(writerArgs).some(isWriterBatchWitnessName)) return changed;
  target.internalArgs = inheritWriterBatchWitnesses(target.internalArgs, writerArgs);
  if (target.compilerRoute) {
    target.compilerRoute.internalArgs = inheritWriterBatchWitnesses(
      target.compilerRoute.internalArgs,
      writerArgs,
    );
  }
  return true;
}

/**
 * Own-category none-cap NFTs are event-pin candidates. Only the layout event
 * slots and the witnessed in-block return may carry that shape. Logical
 * identity carriers use the disjoint SCID envelope and are ignored here.
 */
export function constrainOwnCategoryImmutableOutputs(
  outputs: Array<{
    to?: Uint8Array | string;
    token?: {
      category?: string;
      nft?: { capability?: string; commitment?: Uint8Array | string };
    };
  }>,
  categoryId: string,
  allowedIndices: ReadonlySet<number>,
): number {
  let stripped = 0;
  for (const [index, output] of outputs.entries()) {
    if (allowedIndices.has(index)) continue;
    if (output.token?.category !== categoryId) continue;
    if (output.token.nft?.capability !== 'none') continue;
    if (isScidIdentityCommitment(output.token.nft.commitment)) continue;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    // OP_TRUE view tails are not event records once the pin uses OVER. Keep them.
    if (lock && lock.length === 1 && lock[0] === 0x51) continue;
    delete output.token;
    stripped += 1;
  }
  return stripped;
}

/**
 * Only planned INSERT PredOuts (`>= blockSize`, or the first leftover inside the
 * insert budget) relocate to P'. Extra nonnegative in-block slots stay UPDATE.
 */
export function remapInsertPredOuts(
  predOuts: ReadonlyArray<{ name: string; value: bigint }>,
  predBase: bigint,
  insertBudget: number,
  trailingBase: bigint,
): Record<string, bigint> {
  const updates: Record<string, bigint> = {};
  let trailing = 0;
  for (const { name, value } of predOuts) {
    if (value < 0n) continue;
    const plannedInsert = value >= trailingBase;
    if (plannedInsert || trailing < insertBudget) {
      updates[name] = predBase + BigInt(trailing);
      trailing += 1;
    } else {
      updates[name] = -1n;
    }
  }
  return updates;
}

export interface EntryNftInfo {
  slotIndex: number;
  collection: string;
  keyType: string;
  valueType: string;
  keyValue: bigint | boolean | Uint8Array;
  /** For nested mappings: all key types from outer to inner. */
  keyTypes?: string[];
  /** For nested mappings: all key values from outer to inner. */
  keyValues?: Array<bigint | boolean | Uint8Array>;
  exists: boolean;
  utxo?: UnlockableUtxo;
}

export interface TransferData {
  lockingBytecode: Uint8Array;
  amount: bigint;
}

export interface EventEmitData {
  eventName: string;
  eventSignature: string;
  args: Array<StateValue | string>;
}

export interface TokenContainerInfo {
  keyParam: string;
  tokenContainerSlotIndex: number;
  tokenContainerCategoryId: string;
  exists: boolean;
  utxo?: UnlockableUtxo;
}

export interface TokenContainerTransferData {
  tokenContainerCategoryId: string;
  lockingBytecode: Uint8Array;
  amount: bigint;
  insertionOrder: number;
}

export interface TokenContainerTransferNftData {
  tokenContainerCategoryId: string;
  lockingBytecode: Uint8Array;
  commitment: Uint8Array;
  capability: 'none' | 'mutable' | 'minting';
  insertionOrder: number;
}

export type RuntimeLoopTransferOutput = {
  lockingBytecode: Uint8Array;
  amount: bigint;
  kind?: 'bch' | 'token' | 'nft';
  tokenContainerCategoryId?: string;
  commitment?: Uint8Array;
  capability?: 'none' | 'mutable' | 'minting';
};

export interface ExternalCallUtxoGroup {
  categoryId: string;
  stateLayout: StateLayout;
  masterUtxo: Utxo | UnlockableUtxo;
  dataNftUtxos: UnlockableUtxo[];
  requiredDataNftIndices: number[];
  functionName: string;
  functionArgs: any[];
  externalContract: any; // StatefulContract - kept as any to avoid circular import
  /** Source-level invocation represented by this physical group. Proxy/delegate groups execute a different
   * function and argument frame, but transitive graph expansion must resolve compiler argSources against the
   * logical invocation. `address(this)` remains the physical active execution input. */
  logicalFunctionName?: string;
  logicalFunctionArgs?: any[];
  logicalContract?: any; // StatefulContract - kept as any to avoid circular import
  logicalArtifact?: Artifact;
  callMode?: 'call' | 'staticcall' | 'delegatecall';
  /** If this external callee is itself a proxy, execute/derive its state transition at this delegate group. */
  delegateCallGroupIndex?: number;
  /** The delegate implementation and its function resources are already carried in this physical proxy block. */
  delegateEmbeddedInBlock?: boolean;
  /** Reuses another group's single master/data input/output block for repeated calls to one UTXO contract. */
  sharedGroupIndex?: number;
  /** Honest SDK probe result for a read fused into another call sharing this master input. */
  precomputedReturnCommitment?: Uint8Array;
  /** Consecutive return-event commitments for a rolled loop (meceTags(tags_[i])). */
  loopReturnCommitments?: Uint8Array[];
  /** ABI output array directly populated by this loop call, as proven by compiler metadata. */
  loopResultArrayOutput?: number;
  /** Compiler-proven ceiling for this loop call, when available. */
  loopMaximumOccurrences?: number;
  /** Resolve one reached loop occurrence after the parent return proves its runtime array width. */
  resolveLoopReturnCommitment?: (occurrenceIndex: number) => Promise<Uint8Array>;
  /** Resolve the typed value for direct composition of a compiler-proven returned-array loop. */
  resolveLoopReturnValue?: (occurrenceIndex: number) => Promise<StateValue>;
  /** Return slot owned by the state-writing call fused into this physical group. */
  fusedReturnGroupIndex?: number;
  /** Absolute output index verified by this physical call's return covenant. */
  returnOutputIndex?: number;
  /** First assignPhysicalReturnIndices result; later reconcile must not move tail placement. */
  plannedReturnOutputIndex?: number;
  /** Compiler-owned hidden route used for a grouped logical invocation. */
  compilerRoute?: {
    abiFunction: AbiFunction;
    selector: Uint8Array;
    blob: Uint8Array;
    args: any[];
    /** Logical handler selectors already executed by this physical route owner. */
    logicalSelectors: string[];
    /** Decoded Solidity-visible arguments for each authenticated logical row. */
    rowArguments?: Array<{
      selector: string;
      args: any[];
      handler: AbiFunction;
      internalArgs?: Readonly<Record<string, any>>;
    }>;
    internalArgs?: Record<string, any>;
    eventSignaturesBySlot?: Array<string | undefined>;
  };
  /** ABI-named hidden witnesses resolved while assembling this callee's physical block. */
  internalArgs?: Record<string, any>;
  /** Hidden return-output ABI witness -> logical external-call group supplying that return. */
  returnWitnessGroups?: Record<string, number>;
  /** Hidden minting-input ABI witness -> category whose final master coordinate it names. */
  mintingInputWitnessCategories?: Record<string, string>;
  /** Rebuild this group's master unlocker after probe-derived hidden witnesses become available. */
  refreshInternalArgs?: (
    updates: Record<string, any>,
    options?: { shiftPredOut?: boolean },
  ) => void;
  /** Rebuild the physical unlocker after compiler-derived visible arguments change during dependency convergence. */
  refreshFunctionArgs?: (args: any[]) => void;
  /** Recompute hidden witnesses derived from a route's visible row arguments (for example, replayed array pushes). */
  refreshRouteDerivedArguments?: (
    rowArguments: readonly {
      selector: string;
      args: any[];
      handler: AbiFunction;
      internalArgs?: Readonly<Record<string, any>>;
    }[] | undefined,
    finalVisibleArgs: readonly any[],
  ) => { internalArgs: Record<string, any>; payloadBytes: number };
  /** The carrier master unlocker changed during the current dependency-convergence pass. */
  argumentsRefreshedDuringConvergence?: boolean;
  /** Re-evaluate source-level arguments against a newer authenticated caller-state snapshot. */
  refreshFromCallerState?: (
    state: Readonly<Record<string, StateValue>>,
    apply?: boolean,
  ) => boolean;
  /** Active message-bus batch blockhash reads, retained until the group's absolute input base is known. */
  graphBlockhashSelections?: Array<{
    readKey: string; slotOrdinal: number; rowArgs: any[]; handler: AbiFunction;
  }>;
  /** B's full block: entry NFTs, token containers, satoshi container, funders for output-only slots */
  blockInputs?: UnlockableUtxo[];
  /** B's function block layout (for full block ordering) */
  blockLayout?: FunctionBlockLayout;
  /** X13: B's block carries a funding input at its published returnEvent offset, so B's return-event NFT is
   * emitted at that offset instead of appended after the whole participant region. */
  returnEventInBlock?: boolean;
  /** A route's chunkable vmap WRITE pins its value chunks as outputs in the callee's TRAILING band. The value is
   * computed on-chain (`publishJobEvent` stamps `block.timestamp` before storing), so the SDK cannot build the
   * chunks off-chain the way `valueChunkMints` does for a caller-known value - the commitments are extracted
   * from the callee's derivation probe and placed here, keyed by block slot. */
  derivedTrailingOutputs?: Map<number, { commitment: string; lockingBytecode: Uint8Array }>;
  /** B's event NFT outputs (from auto-derivation of B's VM trace) */
  eventOutputs?: Array<{
    eventSignature: string; commitment: string; lockingBytecode: Uint8Array;
  } | undefined>;
  /** B's keccak256 compute side-car INPUTS (outState path: appended after dataNfts; externalCall path already
   * carries them inside blockInputs). In B's keccak-call order. */
  keccakInputs?: UnlockableUtxo[];
  /** B's keccak256 compute side-car recreation OUTPUTS (both paths), committing each computed R_i. */
  keccakRecreates?: Output[];
  /** Cross-contract callee LOOP write (docs/deferrals.md #1): SDK-computed updated commitments for B's trailing loop
   * entries, in co-spend order. The trailing entries are appended to blockInputs starting at entryLoopStart. */
  entryLoopCommitments?: string[];
  /** blockInputs index where the trailing loop entries begin (== B's blockSize). */
  entryLoopStart?: number;
  /** B's collection signature for the loop entries (for the derive-time master-index unlocker patch). */
  entryLoopCollection?: string;
  /** Sorted entry slots known at planning time to be inserts. Placeholder NEW
   * outputs let the first derivation pass reach and reveal both commitments. */
  plannedEntryInserts?: Array<{
    blockSlot: number;
    outputBlockSlot: number;
    /** Recreated predecessor commitment (P'). */
    commitment?: string;
    /** Initial NEW-node commitment; derivation may replace its value payload. */
    newCommitment?: string;
  }>;
  /** Internal handles for the placeholders above. */
  plannedEntryInsertHandles?: number[];
  /** Hidden output-index arguments stored block-relative until this group's absolute output base is known. */
  relativeOutputInternalArgs?: string[];
  /** Exact vmap predecessor recreations reserved in compiler-route trailing slots. */
  batchPredecessorOutputs?: Array<{
    outputBlockSlot: number; lockingBytecode: Uint8Array; commitment: string;
  }>;
  /** Absolute output index of the first trailing INSERT predecessor after MD tails. */
  relocatedPredOutBase?: number;
  /** Planned continuation-NFT count for a chunkable vmap write (publishJobEvent). */
  valueChunkOutputCount?: number;
  /** Absolute first continuation output selected for this composed write. */
  valueChunkOutputBase?: number;
  /** Exact computed value-chunk writes owned by this physical call. */
  valueChunkWrites?: ValueChunkWriteDescriptor[];
  /** Entry covenant bytecode for fixed sorted-batch target slots. Absent targets use balanced funder inputs,
   * whose locking bytecode must not be mirrored when the active route mints the target node. */
  batchEntryLockingBytecodes?: Map<number, Uint8Array>;
  /** Direct, unambiguous dynamic-write values derived from the callee ABI arguments. */
  dynamicStateValues?: Readonly<Record<string, StateValue>>;
  /** Dynamic chunk inputs occupying a compiler route's balanced trailing band. Write spends are rebound once the
   * physical state-owner master coordinate is known; inactive union resources remain preservation spends. */
  dynamicChunkResources?: Array<{
    blockSlot: number; name: string; type: string; write: boolean;
  }>;
}

/**
 * Select the input whose covenant emits an external-call event.
 *
 * A proxied call executes at its compiler-planned delegate group, so its event slots are relative to that
 * implementation input. Ordinary calls execute at the callee master. Function names are deliberately absent:
 * alpha-renaming either function cannot alter the transaction geometry published by `delegateCallGroupIndex`.
 */
export function selectExternalEventProbeInput(
  group: Pick<ExternalCallUtxoGroup, 'delegateCallGroupIndex'>,
  delegateInputIndex: number,
  calleeInputIndex: number,
): number {
  if (group.delegateCallGroupIndex !== undefined && delegateInputIndex >= 0) return delegateInputIndex;
  return calleeInputIndex;
}

type CompilerWriterEventCandidate = Pick<ExternalCallUtxoGroup,
  'categoryId' | 'blockLayout' | 'compilerRoute' | 'eventOutputs'>;

export type CompilerWriterEventSelection =
  | { status: 'absent' }
  | { status: 'ambiguous' }
  | {
    status: 'exact'; categoryId: string; slotOffset: number; eventSignature: string;
    eventOutput?: NonNullable<ExternalCallUtxoGroup['eventOutputs']>[number];
  };

/** Collapse physical/logical views of one compiler-described writer event; conflicting claims fail closed. */
export function selectCompilerWriterEvent(
  candidates: ReadonlyArray<CompilerWriterEventCandidate>,
): CompilerWriterEventSelection {
  const claims = new Map<string, Extract<CompilerWriterEventSelection, { status: 'exact' }>>();
  for (const candidate of candidates) {
    const fn = candidate.compilerRoute?.abiFunction;
    const layout = fn?.blockLayout ?? candidate.blockLayout;
    const slots = layout?.slots.filter((slot) => slot.kind === 'event') ?? [];
    const routedSignatures = candidate.compilerRoute?.eventSignaturesBySlot;
    for (const [ordinal, slot] of slots.entries()) {
      const declared = routedSignatures !== undefined
        ? routedSignatures[ordinal]
        : fn?.emits?.find((emit) => emit.emitIndex === ordinal)?.eventSignature;
      const observed = candidate.eventOutputs?.[ordinal];
      if (declared && observed && declared !== observed.eventSignature) return { status: 'ambiguous' };
      const eventSignature = declared ?? observed?.eventSignature;
      if (!eventSignature) continue;
      const key = `${candidate.categoryId.toLowerCase()}:${slot.offset}:${eventSignature}`;
      const prior = claims.get(key);
      if (prior?.eventOutput && observed && (
        prior.eventOutput.commitment !== observed.commitment
        || binToHex(prior.eventOutput.lockingBytecode) !== binToHex(observed.lockingBytecode)
      )) return { status: 'ambiguous' };
      claims.set(key, {
        status: 'exact', categoryId: candidate.categoryId, slotOffset: slot.offset,
        eventSignature, eventOutput: observed ?? prior?.eventOutput,
      });
    }
  }
  if (claims.size === 0) return { status: 'absent' };
  return claims.size === 1 ? [...claims.values()][0] : { status: 'ambiguous' };
}

export interface StatefulTransactionOptions extends TransactionBuilderOptions {
  masterUtxo: UnlockableUtxo;
  dataNftUtxos: UnlockableUtxo[];
  stateLayout: StateLayout;
  categoryId: string;
  requiredNftIndices?: number[];  // if absent, use all indices
  readOnlyDataNftUtxos?: UnlockableUtxo[];  // read-only data NFTs from other contracts
  blockhashCoSpendUtxos?: UnlockableUtxo[];  // (n->hash) oracle co-spends for blockhash(n) readers
  /** Optional physical ordinal within the function's blockhashOracle slots for each co-spend. Graph message-bus batch
   * routes reserve a fixed row band, so active reads are sparse and the inactive slots must remain funders. */
  blockhashCoSpendSlotOrdinals?: number[];
  keccakComputeCoSpendUtxos?: UnlockableUtxo[]; // keccak256 compute side-cars (one per call) at keccakSideCar slots
  keccakComputeCommitments?: string[];        // parallel: R_i = keccak256(preimage_i) hex, committed to recreation i
  /** Compute resources were declared by the routed delegate ABI, so their 1:1 input/output coordinates are
   * relative to the implementation master rather than the proxy state master. */
  delegateComputeResources?: boolean;
  /** Complex keccak preimages that cannot be evaluated until the complete routed transaction exists. The
   * derivation VM learns these from the implementation trace, then rebuilds the ordinary side-car input/output. */
  deferredKeccakCompute?: {
    salt: Uint8Array;
    legacy: boolean;
    preimages: Array<Uint8Array | null>;
  };
  /** Runtime recovery arguments learned from the complete routed trace before replacing probe placeholders. */
  deferredEcrecoverCompute?: {
    salt: Uint8Array;
    argBlobs: Array<Uint8Array | null>;
    /** Per recovery call, index in deferredKeccakCompute.preimages; -1 for non-EVM projections. */
    evmKeccakPreimageIndices: number[];
  };
  ecrecoverComputeCoSpendUtxos?: UnlockableUtxo[]; // recovery A/B side-cars (2 per call, flat A0,B0,A1,B1..) at slots
  ecrecoverComputeRecreates?: Output[];       // parallel recreation OUTPUTS (A commits H_A, B commits the pubkey Q)
  entryNfts?: EntryNftInfo[];
  entryAccesses?: readonly EntryAccessAbi[];
  entryNftLockingBytecodes?: Map<string, Uint8Array>; // collection name -> locking bytecode
  // Dynamic-storage vars (string / unbounded bytes): chunk NFTs created as trailing outputs.
  dynamicChunkVars?: Array<{
    name: string; type: string; lockingBytecode: Uint8Array; delegate?: boolean; delegateSuffix?: boolean;
  }>;
  // Old chunk UTXOs co-spent (destroyed) on a dynamic-storage write; not recreated as outputs.
  dynamicChunkInputs?: UnlockableUtxo[];
  // Inputs which are only destroyed and are never read by the executing contract. In a balanced layout these
  // occupy the high end of the trailing band, opposite neutral output pads, so they cannot overlap new resources.
  trailingDisposalInputs?: UnlockableUtxo[];
  // Collections written by a runtime loop (`for(i<n) m[k[i]]=v[i]`): N new entry NFTs created as trailing
  // outputs (a runtime-variable count, like dynamicChunkVars). Commitments come from auto-derivation.
  loopEntryVars?: Array<{
    collection: string; lockingBytecode: Uint8Array; categoryId?: string; delegate?: boolean; chunkable?: boolean;
  }>;
  /** Ordered event plan produced by a lowered counter-keyed mapping loop, including exact-count event peers
   * before and after it. These live after runtime mapping entries and before dynamic-storage chunks. */
  runtimeLoopEventOutputs?: Array<{
    eventSignature: string; lockingBytecode: Uint8Array; categoryId?: string; commitment?: string;
    /** Zero-based selected route row which produced this occurrence; -1 for a direct non-route call. */
    rowIndex: number;
  }>;
  /** Plain-BCH outputs produced by lowered runtime counter loops. Recipient and amount begin as probe
   * placeholders and are replaced from the covenant trace before the transaction is returned. */
  runtimeLoopTransferOutputs?: RuntimeLoopTransferOutput[];
  /** Physical row order for runtime mapping-entry, event, and BCH-transfer segments. */
  runtimeLoopTrailingSegments?: Array<
  | { kind: 'entries'; collection: string; offset: number; count: number }
  | { kind: 'events'; offset: number; count: number }
  | { kind: 'transfers'; offset: number; count: number }
  >;
  eventDefinitions?: readonly EventDefinitionAbi[];
  eventNftLockingBytecodes?: Map<string, Uint8Array>; // eventSignature -> locking bytecode
  tokenContainers?: TokenContainerInfo[];
  tokenContainerLockingBytecodes?: Map<string, Uint8Array>; // tokenContainerCategoryId -> locking bytecode
  satoshiContainerUtxo?: UnlockableUtxo;
  satoshiContainerLockingBytecode?: Uint8Array;
  externalOutStateUtxoGroups?: ExternalCallUtxoGroup[];
  externalCallUtxoGroups?: ExternalCallUtxoGroup[];
  lowLevelCallUtxoGroups?: ExternalCallUtxoGroup[];
  lowLevelCallRawInputs?: UnlockableUtxo[];
  /** Delegate implementation master/data outputs precede grafted proxy-state entry slots. */
  delegateEntriesAfterLowLevel?: boolean;
  /** Keep routed delegate dynamic chunks in the compiler's output-count-relative suffix without reordering inputs. */
  delegateDynamicChunksAtSuffix?: boolean;
  /** Extra funder pads so nested callees start after a long publishJobEvent value-chunk band. */
  delegatedValueChunkPad?: number;
  /**
   * X56. The delegate return-event output follows the implementation's own event outputs rather than its
   * master. Set only when the co-spent implementation BOTH emits and returns, which is the only case where the
   * two claim the same index.
   */
  delegateReturnEventAfterEvents?: boolean;
  /** Absolute input offset selected by the caller's encoded low-level-call index. */
  lowLevelCallInputBase?: number;
  /** The first low-level input is a compiler-route delegate implementation placed after the balanced root block. */
  compilerRouteDelegateBlock?: boolean;
  /** Preserve every compiler-published block coordinate, including inactive union-route resource slots. */
  preserveBlockLayoutWidth?: boolean;
  /** Place runtime mapping-entry outputs before newly written dynamic-storage chunks in the trailing frame. */
  loopEntriesBeforeDynamicChunks?: boolean;
  iterationEntryInputs?: UnlockableUtxo[];
  // vmap diff-key insert loop: the N bracketing predecessors, co-spent at input[blockSize+c] but NOT preserved as
  // outputs (unlike iterationEntryInputs) - they are MODIFIED to P' which is emitted via loopEntryVars. Kept separate
  // so they are not counted in the loop-entry output base.
  insertLoopPredecessorInputs?: UnlockableUtxo[];
  keccakLoopSideCars?: UnlockableUtxo[];   // dynamic keccak loop: N trailing compute side-car INPUTS at [blockSize,..)
  keccakLoopRecreates?: Output[];          // ... and their recreation OUTPUTS (R_i per iteration), parallel
  checkMinRelayFee?: boolean; // enforce fee >= feePerByte * txSize
  minRelayFeePerKb?: bigint;  // satoshis per 1000 bytes; default 1000n (1 sat/byte)
  blockLayout?: FunctionBlockLayout;
  funderUtxos?: UnlockableUtxo[];     // funder UTXOs for output-only slots
  /** Immutable SCID anchor co-spent outside every fixed participant block to authenticate a stable logical
   * call target. Runtime caller identity is always taken from the active covenant input instead. */
  logicalIdentityUtxo?: UnlockableUtxo;
  /** Immutable SCID anchors of CALLEES whose Solidity-visible address is logical, co-spent so an external-call
   * identity check can prove the logical-to-physical binding. Appended after `logicalIdentityUtxo`, outside every
   * accounted band, and recreated at the matching output position. */
  externalIdentityAnchorUtxos?: UnlockableUtxo[];
}

/** Absolute event coordinates owned by materialized external-call blocks. */
export function externalCallEventDestinations(
  groups: ReadonlyArray<Pick<ExternalCallUtxoGroup, 'sharedGroupIndex' | 'blockLayout' | 'compilerRoute'>>,
  outputBaseForGroup: (groupIndex: number) => number,
): number[] {
  const destinations: number[] = [];
  for (const [groupIndex, group] of groups.entries()) {
    // A shared logical call reuses the primary participant's physical frame;
    // counting it again can reserve unrelated coordinates from a logical-only layout.
    if (group.sharedGroupIndex !== undefined) continue;
    const base = outputBaseForGroup(groupIndex);
    if (base < 0) continue;
    const layout = group.blockLayout ?? group.compilerRoute?.abiFunction.blockLayout;
    for (const slot of layout?.slots ?? []) {
      if (slot.kind === 'event') destinations.push(base + slot.offset);
    }
  }
  return destinations;
}

export type ParticipantImmutableEventDestination = {
  categoryId: string;
  destination: number;
};

/**
 * Absolute immutable-event coordinates owned by low-level execution frames.
 *
 * A delegate implementation authenticates the physical coordinate relative to its own input, while the NFT is
 * branded with the proxy's state category. Ordinary calls use the callee's category for both roles.
 */
export function lowLevelCallImmutableEventDestinations(
  groups: ReadonlyArray<Pick<ExternalCallUtxoGroup,
  'categoryId' | 'callMode' | 'blockLayout' | 'compilerRoute'>>,
  proxyGroups: ReadonlyArray<Pick<ExternalCallUtxoGroup, 'categoryId' | 'delegateCallGroupIndex'>>,
  inputBaseForGroup: (groupIndex: number) => number,
): ParticipantImmutableEventDestination[] {
  const destinations: ParticipantImmutableEventDestination[] = [];
  for (const [groupIndex, group] of groups.entries()) {
    const base = inputBaseForGroup(groupIndex);
    if (base < 0) continue;
    const proxyGroup = group.callMode === 'delegatecall'
      ? proxyGroups.find((candidate) => candidate.delegateCallGroupIndex === groupIndex)
      : undefined;
    const categoryId = proxyGroup?.categoryId ?? group.categoryId;
    const layout = group.blockLayout ?? group.compilerRoute?.abiFunction.blockLayout;
    for (const slot of layout?.slots ?? []) {
      if (slot.kind === 'event' || slot.kind === 'returnEvent') {
        destinations.push({ categoryId, destination: base + slot.offset });
      }
    }
  }
  return destinations;
}

/**
 * A transaction builder that wraps TransactionBuilder with the stateful
 * contract input/output convention:
 * - Input 0 (at activeInputIndex): master contract UTXO with minting NFT
 * - Input 1..N: data NFT UTXOs carrying state commitments
 * - Corresponding outputs preserve locking bytecode, token category, and NFT capability
 */
export class StatefulTransactionBuilder {
  private builderOptions: TransactionBuilderOptions;
  private _checkMinRelayFee: boolean;
  private _minRelayFeePerKb: bigint;
  private _maximumFeeSatoshis?: bigint;
  private strictVmPreflight = false;
  private resultDependentArgumentRefresher?: (builder: TransactionBuilder) => boolean;
  private allInputs: UnlockableUtxo[];
  // External-library side-car UTXO, co-spent as the LAST input so the covenant's library loader can read
  // it (via OP_INPUTBYTECODE) during both auto-derivation probes and the final tx. Set by _applyOverrides.
  private sidecarUtxo?: UnlockableUtxo;
  private stateLayout: StateLayout;
  private masterUtxo: UnlockableUtxo;
  private messageBusProbeMasterVout?: number;
  private dataNftUtxos: UnlockableUtxo[];
  private categoryId: string;
  private requiredNftIndices: readonly number[];
  private stateUpdates: Map<
  string, StateValue
  > = new Map();
  private lastOptimisticPermutationCount: number = 1;

  // Exact data-NFT commitments learned from covenant traces. Parsing and rebuilding a commitment can lose
  // compiler-only dynamic length registers, so auto-derivation retains the authenticated bytes verbatim.
  private stateRawCommitments: Map<number, string> = new Map();

  private pendingOutputs: Array<{
    to: string | Uint8Array; amount: bigint; token?: Utxo['token'];
  }> = [];

  private entryNfts: EntryNftInfo[];
  private entryUpdates: Map<
  number, StateValue
  > = new Map();

  private entryDeletes: Set<number> = new Set();
  private entryNftLockingBytecodes: Map<string, Uint8Array>;
  private eventDefinitions: readonly EventDefinitionAbi[];
  private eventNftLockingBytecodes: Map<string, Uint8Array>;
  private pendingTransfers: TransferData[] = [];
  private pendingEventEmits: EventEmitData[] = [];
  private detachedEventReceipts: Array<{ eventSignature: string; commitment: string }> = [];
  private tokenContainers: TokenContainerInfo[];
  private tokenContainerLockingBytecodes: Map<string, Uint8Array>;
  private satoshiContainerUtxo?: UnlockableUtxo;
  private satoshiContainerLockingBytecode?: Uint8Array;
  private containerDepositAmount: bigint = 0n;
  private pendingTokenContainerDeposits: Map<string, bigint> = new Map();
  private pendingTokenContainerTransfers: TokenContainerTransferData[] = [];
  private pendingTokenContainerTransferNfts: TokenContainerTransferNftData[] = [];
  private tokenContainerTransferInsertionCounter = 0;
  private readOnlyDataNftUtxos: UnlockableUtxo[];
  private blockhashCoSpendUtxos: UnlockableUtxo[];
  private blockhashCoSpendSlotOrdinals?: number[];
  private keccakComputeCoSpendUtxos: UnlockableUtxo[];
  private keccakComputeCommitments: string[];
  private delegateComputeResources: boolean;
  private deferredKeccakCompute?: {
    salt: Uint8Array;
    legacy: boolean;
    preimages: Array<Uint8Array | null>;
  };
  private deferredEcrecoverCompute?: {
    salt: Uint8Array;
    argBlobs: Array<Uint8Array | null>;
    evmKeccakPreimageIndices: number[];
  };
  private ecrecoverComputeCoSpendUtxos: UnlockableUtxo[];
  private ecrecoverComputeRecreates: Output[];
  private externalOutStateUtxoGroups: ExternalCallUtxoGroup[];
  private externalCallUtxoGroups: ExternalCallUtxoGroup[];
  private lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
  private lowLevelCallRawInputs: UnlockableUtxo[];
  private delegateEntriesAfterLowLevel: boolean;
  private delegateDynamicChunksAtSuffix: boolean;
  /** Latched on first build() so first publish cannot reassert after persist becomes ready mid-send. */
  private emitReassertAllowed: boolean | undefined;
  private delegatedValueChunkPad: number;
  private mintingOutputSwap?: { from: number; width: number; categoryId: string };
  private viewTailRepackAttempted = false;
  private delegateReturnEventAfterEvents: boolean;
  private lowLevelCallInputBase?: number;
  private compilerRouteDelegateBlock: boolean;
  private preserveBlockLayoutWidth: boolean;
  private loopEntriesBeforeDynamicChunks: boolean;
  private iterationEntryInputs: UnlockableUtxo[];
  private iterationEntriesPlacedAtDelegateBase = false;
  private insertLoopPredecessorInputs: UnlockableUtxo[];
  private keccakLoopSideCars: UnlockableUtxo[];
  private keccakLoopRecreates: Output[];
  private blockLayout?: FunctionBlockLayout;
  private logicalIdentityUtxo?: UnlockableUtxo;
  private externalIdentityAnchorUtxos: UnlockableUtxo[] = [];
  funderUtxos: UnlockableUtxo[];
  private relocationFunderUtxos: UnlockableUtxo[] = [];
  private funderChangeAddress?: Uint8Array;

  private externalCallStateUpdates: Map<
  string, Map<string, StateValue>
  > = new Map(); // categoryId -> (varName -> value)

  // Exact external data-NFT commitments learned from the callee covenant. Like
  // stateRawCommitments, these retain compiler-only registers which cannot be
  // reconstructed losslessly from the source-level state value map.
  private externalCallStateRawCommitments: Map<string, Map<number, string>> = new Map();

  // Cross-contract callee (B) vmap sorted-entry outputs, derived from B's VM trace (docs/deferrals.md #1).
  // categoryId -> (B block-slot position si -> commitment hex). The external-call output loop mints B's updated
  // (or predecessor P') entry at that slot; a NEW insert node rides the trailing region below.
  private externalCallEntryOutputs: Map<string, Map<number, string>> = new Map();
  /** Physical output index -> derived entry commitment. The VM pin names this index; block-slot walk can drift. */
  private externalCallEntryOutputsByIndex: Map<number, { categoryId: string; commitment: string }> = new Map();
  // Trailing NEW entry nodes minted for a cross-contract callee INSERT (per group: address lbc + commitment hex),
  // placed right after the group's block (B's covenant mints the NEW at masterInputIndex + blockSize).
  private externalCallEntryInserts: Array<{ categoryId: string; to: Uint8Array; commitment: string }> = [];

  private pendingReturnEventOutputs: Array<{
    categoryId: string; commitment: Uint8Array; identity: string; provisional?: boolean;
  }> = [];
  /** Physical output positions from the most recent build, keyed by logical return identity. */
  private builtReturnEventOutputIndices = new Map<string, number>();

  private entryRawCommitments: Map<number, string> = new Map(); // slotIndex -> hex commitment (from auto-derivation)
  private pinnedEntrySlots: Set<number> = new Set(); // slots whose commitment is known exactly (never re-derive)
  private dynamicChunkVars: Array<{ name: string; type: string; lockingBytecode: Uint8Array }> = [];
  private dynamicChunkInputs: UnlockableUtxo[] = [];
  private trailingDisposalInputs: UnlockableUtxo[] = [];
  // varName -> ordered chunk commitments (hex) from auto-derivation; length determines chunk output count.
  private chunkRawCommitments: Map<string, string[]> = new Map();
  private loopEntryVars: Array<{
    collection: string; lockingBytecode: Uint8Array; categoryId?: string; delegate?: boolean; chunkable?: boolean;
  }> = [];
  // collection -> ordered loop entry commitments (hex) from auto-derivation; length = entry output count.
  private loopEntryCommitments: Map<string, string[]> = new Map();
  private requiredLoopEntryCounts: Map<string, number> = new Map();

  private runtimeLoopEventOutputs: Array<{
    eventSignature: string; lockingBytecode: Uint8Array; categoryId?: string; commitment: string;
    rowIndex: number;
  }> = [];
  private runtimeLoopTransferOutputs: RuntimeLoopTransferOutput[] = [];
  private runtimeLoopTrailingSegments: NonNullable<StatefulTransactionOptions['runtimeLoopTrailingSegments']> = [];

  // P5b: collections whose loop-entry (NEW) commitment is known EXACTLY (a chunkable-value insert) and must NOT be
  // re-derived from the trace - the value-chunk pin adds OP_OUTPUTTOKENCOMMITMENT calls that the loop-entry
  // extractor would otherwise read as NEW nodes. Pinned like pinEntrySlot pins a fixed entry slot.
  private pinnedLoopEntries: Set<string> = new Set();
  // P5b: unpinned same-category 0x01 value-chunk outputs (LONG sorted-mapping values). Trailing, not covenant-
  // managed - the entry stores sha256(value) and the read verifies the reassembled witness, so these need no
  // on-chain pinning. Commitments are known exactly (buildChunkCommitment) so they never enter auto-derivation.
  private valueChunkOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }> = [];

  /** Route value chunks the derivation recovered, keyed by ABSOLUTE output index. Builder-level, not per-group:
   * the covenant that pins them is probed as one group but addresses an output in ANOTHER group's block (its
   * base is the proxy master), so the placing group and the owning group are different. */
  private derivedChunkOutputs = new Map<number, {
    commitment: string; lockingBytecode: Uint8Array; categoryId?: string;
    /** The compiler received this absolute output base explicitly; never fold it into a legacy shared band. */
    fixedIndex?: boolean;
  }>();
  /** Survives probe rebuilds that drop `derivedChunkOutputs` before send(). */
  private pendingJobEventsPredecessors: UnlockableUtxo[] = [];
  private persistedJobEventsChunks: Array<{
    commitment: string; lockingBytecode: Uint8Array; categoryId?: string;
  }> = [];
  /** Last VM pin redeem lock for the jobEvents band (emitValueChunkP2sh32). */
  private jobEventsRedeemLock?: Uint8Array;
  /** Persist band must start after the executing emit dest (INPUTINDEX+4). */
  private forcedJobEventsBandStart?: number;
  /** Monotonic signal for structural growth discovered while probing dynamic output regions. */
  private dynamicLayoutRevision = 0;

  setJobEventsRedeemLock(lock: Uint8Array): this {
    if (lock.length === 35 && lock[0] === 0xaa && lock[1] === 0x20 && lock[34] === 0x87) {
      this.jobEventsRedeemLock = lock;
    }
    return this;
  }

  private lateValueChunkOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }> = [];
  // P5b (computed values): collections whose value chunks are DERIVED from the trace (the SDK has no value param to
  // build them). The covenant pins them, so their commitments come from auto-derivation like dynamicChunkVars.
  private valueChunkVars: Map<string, {
    collection: string; lockingBytecode: Uint8Array; slot?: Uint8Array;
  }> = new Map();
  private valueChunkRawCommitments: Map<string, string[]> = new Map(); // run id -> ordered chunk commitments (hex)
  private eventRawCommitments: Map<number, string> = new Map(); // emitIndex -> hex commitment (from auto-derivation)
  private pendingEventPlaceholders: Array<{ eventSignature: string; emitIndex: number }> = [];
  /** Covenant-authenticated event outputs keyed by their physical coordinate. */
  private authenticatedEventOutputs = new Map<number, Output>();
  /** Exact OUTPUTBYTECODE/EQUALVERIFY observations which remain authoritative during conservation replay. */
  private authenticatedOutputLockingBytecodes = new Map<number, Uint8Array>();

  constructor(options: StatefulTransactionOptions) {
    this.builderOptions = options;
    this._checkMinRelayFee = options.checkMinRelayFee ?? true;
    this._minRelayFeePerKb = options.minRelayFeePerKb ?? 1000n;
    this.stateLayout = options.stateLayout;
    this.masterUtxo = options.masterUtxo;
    this.dataNftUtxos = options.dataNftUtxos;
    this.categoryId = options.categoryId;
    this.readOnlyDataNftUtxos = options.readOnlyDataNftUtxos ?? [];
    this.blockhashCoSpendUtxos = options.blockhashCoSpendUtxos ?? [];
    this.blockhashCoSpendSlotOrdinals = options.blockhashCoSpendSlotOrdinals;
    this.keccakComputeCoSpendUtxos = options.keccakComputeCoSpendUtxos ?? [];
    this.keccakComputeCommitments = options.keccakComputeCommitments ?? [];
    this.delegateComputeResources = options.delegateComputeResources ?? false;
    this.deferredKeccakCompute = options.deferredKeccakCompute === undefined ? undefined : {
      salt: Uint8Array.from(options.deferredKeccakCompute.salt),
      legacy: options.deferredKeccakCompute.legacy,
      preimages: options.deferredKeccakCompute.preimages.map((preimage) => (
        preimage === null ? null : Uint8Array.from(preimage)
      )),
    };
    this.deferredEcrecoverCompute = options.deferredEcrecoverCompute === undefined ? undefined : {
      salt: Uint8Array.from(options.deferredEcrecoverCompute.salt),
      argBlobs: options.deferredEcrecoverCompute.argBlobs.map((argBlob) => (
        argBlob === null ? null : Uint8Array.from(argBlob)
      )),
      evmKeccakPreimageIndices: [...options.deferredEcrecoverCompute.evmKeccakPreimageIndices],
    };
    this.ecrecoverComputeCoSpendUtxos = options.ecrecoverComputeCoSpendUtxos ?? [];
    this.ecrecoverComputeRecreates = options.ecrecoverComputeRecreates ?? [];
    this.externalOutStateUtxoGroups = options.externalOutStateUtxoGroups ?? [];
    this.externalCallUtxoGroups = options.externalCallUtxoGroups ?? [];
    this.lowLevelCallUtxoGroups = options.lowLevelCallUtxoGroups ?? [];
    this.lowLevelCallRawInputs = options.lowLevelCallRawInputs ?? [];
    this.delegateEntriesAfterLowLevel = options.delegateEntriesAfterLowLevel ?? false;
    this.delegateDynamicChunksAtSuffix = options.delegateDynamicChunksAtSuffix ?? false;
    this.delegatedValueChunkPad = options.delegatedValueChunkPad ?? 0;
    this.delegateReturnEventAfterEvents = options.delegateReturnEventAfterEvents ?? false;
    this.lowLevelCallInputBase = options.lowLevelCallInputBase;
    this.compilerRouteDelegateBlock = options.compilerRouteDelegateBlock ?? false;
    this.preserveBlockLayoutWidth = options.preserveBlockLayoutWidth ?? false;
    this.loopEntriesBeforeDynamicChunks = options.loopEntriesBeforeDynamicChunks === true
      || (options.runtimeLoopEventOutputs?.length ?? 0) > 0
      || (options.runtimeLoopTransferOutputs?.length ?? 0) > 0;
    this.entryNfts = options.entryNfts ?? [];
    this.entryNftLockingBytecodes = options.entryNftLockingBytecodes ?? new Map();
    this.dynamicChunkVars = options.dynamicChunkVars ?? [];
    this.dynamicChunkInputs = options.dynamicChunkInputs ?? [];
    this.trailingDisposalInputs = options.trailingDisposalInputs ?? [];
    this.loopEntryVars = options.loopEntryVars ?? [];
    this.runtimeLoopEventOutputs = (options.runtimeLoopEventOutputs ?? []).map((output) => ({
      ...output,
      commitment: output.commitment ?? '',
    }));
    this.runtimeLoopTransferOutputs = (options.runtimeLoopTransferOutputs ?? []).map((output) => ({
      ...output, lockingBytecode: Uint8Array.from(output.lockingBytecode), amount: output.amount,
      ...(output.commitment && { commitment: Uint8Array.from(output.commitment) }),
    }));
    this.runtimeLoopTrailingSegments = options.runtimeLoopTrailingSegments?.map((segment) => ({ ...segment })) ?? [];
    this.eventDefinitions = options.eventDefinitions ?? [];
    this.eventNftLockingBytecodes = options.eventNftLockingBytecodes ?? new Map();
    this.tokenContainers = options.tokenContainers ?? [];
    this.tokenContainerLockingBytecodes = options.tokenContainerLockingBytecodes ?? new Map();
    this.satoshiContainerUtxo = options.satoshiContainerUtxo;
    this.satoshiContainerLockingBytecode = options.satoshiContainerLockingBytecode;
    this.iterationEntryInputs = options.iterationEntryInputs ?? [];
    this.insertLoopPredecessorInputs = options.insertLoopPredecessorInputs ?? [];
    this.keccakLoopSideCars = options.keccakLoopSideCars ?? [];
    this.keccakLoopRecreates = options.keccakLoopRecreates ?? [];
    this._maximumFeeSatoshis = options.maximumFeeSatoshis;
    this.blockLayout = options.blockLayout;
    this.funderUtxos = options.funderUtxos ?? [];
    this.logicalIdentityUtxo = options.logicalIdentityUtxo;
    this.externalIdentityAnchorUtxos = options.externalIdentityAnchorUtxos ?? [];

    // Default to all NFT indices if not specified
    this.requiredNftIndices = options.requiredNftIndices
      ?? Array.from({ length: options.stateLayout.dataNftCount }, (_, i) => i);

    // Flatten external outState inputs: [B1's master, B1's data NFTs, B1's keccak side-cars, ...] - the keccak
    // side-cars follow B's data NFTs (B's block-layout order: master < dataNft < keccakSideCar) so B's covenant
    // reads them at their slot.
    const externalOutStateInputs: UnlockableUtxo[] = [];
    for (const group of this.externalOutStateUtxoGroups) {
      externalOutStateInputs.push(group.masterUtxo as UnlockableUtxo);
      externalOutStateInputs.push(...group.dataNftUtxos);
      if (group.keccakInputs) externalOutStateInputs.push(...group.keccakInputs);
    }

    // Flatten external call inputs - use full block when available
    const externalCallInputs: UnlockableUtxo[] = [];
    for (const group of this.externalCallUtxoGroups) {
      if (group.sharedGroupIndex !== undefined) continue;
      if (group.blockInputs) {
        // Full block: master + dataNfts + entries + SC + TCs + funders (all ordered by blockLayout)
        externalCallInputs.push(...group.blockInputs);
      } else {
        // Legacy: just master + dataNfts
        externalCallInputs.push(group.masterUtxo as UnlockableUtxo);
        externalCallInputs.push(...group.dataNftUtxos);
      }
    }

    // Flatten low-level call inputs (stateful groups + raw UTXOs)
    const lowLevelCallInputs: UnlockableUtxo[] = [];
    const embeddedDelegateGroups = new Set(this.externalCallUtxoGroups.flatMap((group) => (
      group.delegateEmbeddedInBlock && group.delegateCallGroupIndex !== undefined
        ? [group.delegateCallGroupIndex] : []
    )));
    for (const [groupIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
      if (embeddedDelegateGroups.has(groupIndex)) continue;
      lowLevelCallInputs.push(group.masterUtxo as UnlockableUtxo);
      lowLevelCallInputs.push(...group.dataNftUtxos);
    }

    // Add master UTXO as first input, then data NFT UTXOs, then read-only NFTs,
    // then outState NFTs, then external call NFTs, then low-level call NFTs,
    // then entry NFTs, then token container UTXOs, then satoshi container UTXO
    const entryInputs = this.entryNfts
      .filter((e) => e.exists && e.utxo)
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((e) => e.utxo!);

    const tokenContainerInputs = this.tokenContainers
      .filter((d) => d.exists && d.utxo)
      .sort((a, b) => a.tokenContainerSlotIndex - b.tokenContainerSlotIndex)
      .map((d) => d.utxo!);

    const satoshiContainerInputs = this.satoshiContainerUtxo ? [this.satoshiContainerUtxo] : [];

    this.allInputs = this._buildInputs(
      entryInputs, tokenContainerInputs, satoshiContainerInputs,
      externalOutStateInputs, externalCallInputs,
      lowLevelCallInputs,
    );
    const debugInputAssembly = (stage: string): void => {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_INPUTS !== '1') return;
      console.error('stateful-input-assembly', {
        stage,
        count: this.allInputs.length,
        routeBlockSize: this.blockLayout?.blockSize,
        trailingCapacity: this.blockLayout?.trailingCapacity,
        preserveBlockLayoutWidth: this.preserveBlockLayoutWidth,
        compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
        lowLevelCallInputs: lowLevelCallInputs.length,
        externalIdentityAnchors: this.externalIdentityAnchorUtxos.length,
        logicalIdentityAnchor: this.logicalIdentityUtxo !== undefined,
        mutableInputs: this.allInputs.flatMap((input, index) => (
          input.token?.nft?.capability === 'mutable' ? [{
            index,
            outpoint: `${input.txid}:${input.vout}`,
            category: input.token.category.slice(0, 16),
            commitment: input.token.nft.commitment.slice(0, 24),
            lockingBytecode: binToHex(input.unlocker.generateLockingBytecode()).slice(0, 24),
          }] : []
        )),
      });
    };
    debugInputAssembly('constructed');
    this._swapMintingOffValueChunkBand();
    debugInputAssembly('minting-band-relocated');
    this._placeJobEventsPredecessorInputs(this.pendingJobEventsPredecessors);
    debugInputAssembly('predecessors-placed');
    // Callee anchors precede the caller's own: emitLogicalMsgSenderAnchorResolution resolves the caller's
    // identity from the LAST input, so that tail position must stay the caller's.
    this.allInputs.push(...this.externalIdentityAnchorUtxos);
    if (this.logicalIdentityUtxo) this.allInputs.push(this.logicalIdentityUtxo);
    debugInputAssembly('identity-anchors-appended');
  }

  /** @internal Mark an impossible-output-index master used only by atomic VM derivation probes. */
  _setMessageBusProbeMasterVout(realVout: number): void {
    this.messageBusProbeMasterVout = realVout;
  }

  /** @internal Restore the real spend before a atomic participant block leaves SDK construction. */
  _restoreMessageBusProbeMasterOutpoint(): void {
    if (this.messageBusProbeMasterVout === undefined) return;
    this.masterUtxo.vout = this.messageBusProbeMasterVout;
    this.messageBusProbeMasterVout = undefined;
  }

  /** @internal Rebind later callee arguments after an authenticated return channel converges. */
  _setResultDependentArgumentRefresher(
    refresher: (builder: TransactionBuilder) => boolean,
  ): void {
    this.resultDependentArgumentRefresher = refresher;
  }

  /** @internal Replace the caller unlocker after tail identity-anchor indices become known. */
  _setMasterUnlocker(unlocker: Unlocker): void {
    this.masterUtxo = { ...this.masterUtxo, unlocker };
    this._refreshInputs();
  }

  /** Require the fully funded and signed transaction to pass the artifact's
   * BCH VM before any network submission. Used for concrete recursive calls,
   * whose resource usage depends on runtime arguments. */
  enableStrictVmPreflight(): this {
    this.strictVmPreflight = true;
    return this;
  }

  /** Build allInputs following block layout when funders are available. */
  private _buildInputs(
    entryInputs: UnlockableUtxo[],
    tokenContainerInputs: UnlockableUtxo[],
    satoshiContainerInputs: UnlockableUtxo[],
    externalOutStateInputs: UnlockableUtxo[],
    externalCallInputs: UnlockableUtxo[],
    lowLevelCallInputs: UnlockableUtxo[],
  ): UnlockableUtxo[] {
    // When funders are provided and no external calls (which add gap outputs),
    // use offset-indexed ordering so input[offset] matches OP_INPUTINDEX + offset.
    // With external calls, the gap between readOnly and entries breaks 1:1 correspondence,
    // so we fall through to the legacy path which both inputs and outputs follow.
    const hasExternalGroups = externalOutStateInputs.length > 0 || externalCallInputs.length > 0;
    if (this.blockLayout && this.funderUtxos.length > 0
      && !this.delegateEntriesAfterLowLevel
      && (!hasExternalGroups || this.blockhashCoSpendSlotOrdinals !== undefined
        || this.compilerRouteDelegateBlock)) {
      const funderPool = [...this.funderUtxos];
      // Input coordinates are the published layout with output-only slots projected away.
      const positioned: (UnlockableUtxo | undefined)[] = new Array(blockInputSize(this.blockLayout));
      let dataNftIdx = 0, readOnlyIdx = 0, tcIdx = 0;
      let llcIdx = 0; // low-level call input index
      let bhIdx = 0; // blockhash co-spend index
      let bhOrdinal = 0;
      let kIdx = 0; // keccak256 compute side-car index
      let erIdx = 0; // ecrecover recovery-pair side-car index (flat A0,B0,A1,B1..)
      const loopAlignmentCount = this.loopEntriesBeforeDynamicChunks
        ? Math.max(0, this._trailingLoopEntryOutputCount() - this.insertLoopPredecessorInputs.length)
        : 0;
      const loopAlignmentFunders = funderPool.splice(0, loopAlignmentCount);
      // Input and output resource order intentionally differ when a sorted batch creates more entry outputs than
      // it consumes predecessor inputs. Dynamic read/write covenants address old chunks from trailingBase (after
      // collection-iteration inputs only), while the batch's additional entry nodes exist only on the output side.
      // Balance that output-only expansion after every authenticated input resource; placing these neutral funders
      // before dynamic chunks shifts a valid chunk run away from the compiler-published input coordinate.
      const trailingInputs = [
        ...this.iterationEntryInputs,
        ...this.dynamicChunkInputs,
        ...this.insertLoopPredecessorInputs,
        ...(this.loopEntriesBeforeDynamicChunks ? loopAlignmentFunders : []),
      ];
      let trailingIdx = 0;
      let trailingDisposalIdx = 0;
      const trailingDisposalOffsets = new Set(
        this.trailingDisposalInputs.length === 0 ? [] : this.blockLayout.slots
          .filter((slot) => slot.kind === 'trailing')
          .map((slot) => blockInputOffset(this.blockLayout!, slot.offset))
          .sort((left, right) => left - right)
          .slice(-this.trailingDisposalInputs.length),
      );
      // Each entry slot gets ITS OWN existing entry input (by slotIndex), or a funder if absent. Not a dense
      // pull from entryInputs: an absent lower slot must not shift a higher slot's entry into the gap (the
      // covenant reads each slot at its fixed offset).
      const entryInputBySlot = new Map<number, UnlockableUtxo>(
        this.entryNfts.filter((e) => e.exists && e.utxo).map((e) => [e.slotIndex, e.utxo!]),
      );

      for (const slot of this.blockLayout.slots) {
        if (isOutputOnlyBlockSlot(slot)) continue;
        const inputOffset = blockInputOffset(this.blockLayout, slot.offset);
        switch (slot.kind) {
          case 'master': positioned[inputOffset] = this.masterUtxo; break;
          case 'dataNft':
            if (dataNftIdx < this.dataNftUtxos.length) positioned[inputOffset] = this.dataNftUtxos[dataNftIdx++];
            break;
          case 'readOnlyDataNft':
            if (readOnlyIdx < this.readOnlyDataNftUtxos.length) {
              positioned[inputOffset] = this.readOnlyDataNftUtxos[readOnlyIdx++];
            }
            break;
          case 'blockhashOracle':
            if ((this.blockhashCoSpendSlotOrdinals?.[bhIdx] ?? bhIdx) === bhOrdinal
              && bhIdx < this.blockhashCoSpendUtxos.length) {
              positioned[inputOffset] = this.blockhashCoSpendUtxos[bhIdx++];
            } else if (this.blockhashCoSpendSlotOrdinals) {
              const f = funderPool.shift();
              if (f) positioned[inputOffset] = f;
            }
            bhOrdinal++;
            break;
          case 'keccakSideCar':
            if (kIdx < this.keccakComputeCoSpendUtxos.length) {
              positioned[inputOffset] = this.keccakComputeCoSpendUtxos[kIdx++];
            } else { const f = funderPool.shift(); if (f) positioned[inputOffset] = f; }
            break;
          case 'ecrecoverSideCar':
            if (erIdx < this.ecrecoverComputeCoSpendUtxos.length) {
              positioned[inputOffset] = this.ecrecoverComputeCoSpendUtxos[erIdx++];
            } else { const f = funderPool.shift(); if (f) positioned[inputOffset] = f; }
            break;
          case 'entry': {
            // Delegate implementation inputs may intentionally occupy the same physical input offsets as grafted
            // proxy-state output slots. The implementation is the input; the entry NFT is produced only on output.
            if (positioned[inputOffset]) break;
            const entryInput = slot.slotIndex !== undefined ? entryInputBySlot.get(slot.slotIndex) : undefined;
            if (entryInput) positioned[inputOffset] = entryInput;
            else { const f = funderPool.shift(); if (f) positioned[inputOffset] = f; }
            break;
          }
          case 'satoshiContainer':
            if (satoshiContainerInputs.length > 0) positioned[inputOffset] = satoshiContainerInputs[0];
            break;
          case 'tokenContainer':
            if (tcIdx < tokenContainerInputs.length) positioned[inputOffset] = tokenContainerInputs[tcIdx++];
            else { const f = funderPool.shift(); if (f) positioned[inputOffset] = f; }
            break;
          case 'lowLevelCall':
            if (this.compilerRouteDelegateBlock) {
              // These are logical handler call slots inside the route block. The physical delegate implementation
              // is the route owner and lives after the complete block; nested participant groups are appended next.
              const f = funderPool.shift();
              if (f) positioned[inputOffset] = f;
              break;
            }
            // Place the actual low-level call input (target master) at its block layout
            // position so the compiler's emitBlockSlotIndex reads the correct INPUTBYTECODE.
            if (llcIdx < lowLevelCallInputs.length) {
              const callOffset = this.lowLevelCallInputBase ?? inputOffset;
              if (callOffset !== inputOffset) {
                for (let offset = inputOffset; offset < callOffset; offset++) {
                  if (positioned[offset]) continue;
                  const placeholder = funderPool.shift();
                  if (placeholder) positioned[offset] = placeholder;
                }
              }
              positioned[callOffset] = lowLevelCallInputs[llcIdx++];
              if (this.delegateEntriesAfterLowLevel) {
                // A delegate's own data NFTs immediately follow its master; grafted entry slots begin after this
                // implementation block, so keep their absolute offsets instead of compacting the gap away.
                let off = callOffset + 1;
                while (llcIdx < lowLevelCallInputs.length && positioned[off] === undefined) {
                  positioned[off++] = lowLevelCallInputs[llcIdx++];
                }
              }
            } else { const f = funderPool.shift(); if (f) positioned[inputOffset] = f; }
            break;
          case 'deploy': {
            const f = funderPool.shift();
            if (f) positioned[inputOffset] = f;
            break;
          }
          case 'trailing': {
            if (trailingDisposalOffsets.has(inputOffset)) {
              positioned[inputOffset] = this.trailingDisposalInputs[trailingDisposalIdx++];
            } else if (trailingIdx < trailingInputs.length) {
              positioned[inputOffset] = trailingInputs[trailingIdx++];
            } else {
              const f = funderPool.shift();
              if (f) positioned[inputOffset] = f;
            }
            break;
          }
          default: break;
        }
      }
      if (this.blockLayout.trailingCapacity !== undefined
        && (trailingIdx !== trailingInputs.length
          || trailingDisposalIdx !== this.trailingDisposalInputs.length)) {
        throw new Error(
          'Runtime resource inputs exceed balanced trailing capacity '
          + `(${trailingInputs.length + this.trailingDisposalInputs.length} `
          + `> ${this.blockLayout.trailingCapacity ?? 0})`,
        );
      }

      // Fill the reserved gap (offsets between last readOnly and first entry/SC/TC)
      // with external outState and external call inputs
      // A compiler-route delegate executes immediately after the complete owner block, and its own nested
      // participants follow that implementation block. Placing those external participants into otherwise-empty
      // owner offsets moves them before the executing delegate, while the generated route correctly requires
      // `externalCallInputBase == OP_INPUTINDEX + blockSize`. Reserve the owner gaps with neutral funders and
      // defer the delegate's external participants until after the implementation input band.
      const deferredExternalCallInputs = this.compilerRouteDelegateBlock ? externalCallInputs : [];
      const gapInputs = [
        ...externalOutStateInputs,
        ...(this.compilerRouteDelegateBlock ? [] : externalCallInputs),
      ];
      let gapIdx = 0;
      for (let i = 0; i < positioned.length; i++) {
        if (positioned[i] === undefined && gapIdx < gapInputs.length) {
          positioned[i] = gapInputs[gapIdx++];
        }
      }
      if (this.compilerRouteDelegateBlock) {
        for (let i = 0; i < positioned.length; i++) {
          if (positioned[i] !== undefined) continue;
          const funder = funderPool.shift();
          if (funder) positioned[i] = funder;
        }
      }

      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_INPUTS === '1') {
        console.error('balanced-positioned-inputs', {
          blockSize: this.blockLayout.blockSize,
          missing: Array.from({ length: positioned.length }, (_, offset) => positioned[offset] === undefined ? [{
            offset,
            slot: this.blockLayout?.slots.find((candidate) => candidate.offset === offset),
          }] : []).flat(),
          fundersProvided: this.funderUtxos.length,
          fundersRemaining: funderPool.length,
          trailingInputs: {
            iteration: this.iterationEntryInputs.length,
            insertPredecessors: this.insertLoopPredecessorInputs.length,
            dynamicChunks: this.dynamicChunkInputs.length,
            disposals: this.trailingDisposalInputs.length,
            loopAlignmentFunders: loopAlignmentFunders.length,
            total: trailingInputs.length + this.trailingDisposalInputs.length,
            defined: trailingInputs.filter((input) => input !== undefined).length
              + this.trailingDisposalInputs.filter((input) => input !== undefined).length,
          },
          entries: this.entryNfts.map((entry) => ({
            slotIndex: entry.slotIndex, exists: entry.exists, hasUtxo: entry.utxo !== undefined,
          })),
        });
      }

      const missingOffsets = Array.from(
        { length: positioned.length },
        (_, offset) => positioned[offset] === undefined ? offset : -1,
      ).filter((offset) => offset >= 0);
      if (missingOffsets.length > 0 && this.preserveBlockLayoutWidth) {
        throw new Error(
          `Balanced block layout is missing inputs at fixed offsets ${missingOffsets.join(', ')}`,
        );
      }
      const result = this.preserveBlockLayoutWidth
        ? positioned as UnlockableUtxo[]
        : positioned.filter((input): input is UnlockableUtxo => input !== undefined);

      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_INPUTS === '1') {
        console.error('balanced-input-return-parts', {
          positioned: positioned.length,
          result: result.length,
          compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
          lowLevelCallInputs: lowLevelCallInputs.length,
          gapOverflow: gapInputs.length - gapIdx,
          lowLevelCallRawInputs: this.lowLevelCallRawInputs.length,
          trailingOverflow: trailingInputs.length - trailingIdx,
          disposalOverflow: this.trailingDisposalInputs.length - trailingDisposalIdx,
          fundersRemaining: funderPool.length,
        });
      }

      return [
        ...result,
        // A compiler-route delegate owns the balanced block and must be the first participant after it.
        ...(this.compilerRouteDelegateBlock ? lowLevelCallInputs : []),
        // Any overflow gap inputs that didn't fit
        ...gapInputs.slice(gapIdx),
        // Nested calls owned by the compiler-route delegate begin after its implementation block.
        ...deferredExternalCallInputs,
        // Remaining low-level call inputs not already positioned in block layout slots
        ...(this.compilerRouteDelegateBlock ? [] : lowLevelCallInputs.slice(llcIdx)), ...this.lowLevelCallRawInputs,
        // Legacy balanced layouts predate reserved trailing regions. Preserve their established dynamic
        // resource run immediately after the fixed block; only a layout declaring trailingCapacity consumes
        // these inputs positionally above.
        ...trailingInputs.slice(trailingIdx),
        ...this.trailingDisposalInputs.slice(trailingDisposalIdx),
        // Leftover funders not consumed by block layout slots (fee-only inputs)
        ...funderPool,
      ];
    }

    // Legacy ordering - funders go at the end (past all covenant inputs).
    // Delegate bytecode requires the implementation master to immediately follow the proxy master/data region.
    // Its nested external callees are ordinary co-spends, but must be ordered after that implementation band.
    if (this.delegateEntriesAfterLowLevel) {
      const associatedDelegates = new Set(this.externalCallUtxoGroups
        .map((group) => group.delegateCallGroupIndex)
        .filter((index): index is number => index !== undefined));
      const withUnlocker = (input: UnlockableUtxo | Utxo | undefined): UnlockableUtxo[] => (
        input && 'unlocker' in input && input.unlocker ? [input as UnlockableUtxo] : []
      );
      const groupInputs = (group: ExternalCallUtxoGroup): UnlockableUtxo[] => {
        const master = group.masterUtxo as UnlockableUtxo | undefined;
        const inputs = group.blockInputs ?? (master ? [master, ...group.dataNftUtxos] : []);
        return inputs.flatMap((input) => {
          if (master && input
            && input.txid.toLowerCase() === master.txid.toLowerCase() && input.vout === master.vout) {
            return withUnlocker(master);
          }
          return withUnlocker(input);
        });
      };
      const delegateInputs = (index: number): UnlockableUtxo[] => {
        const group = this.lowLevelCallUtxoGroups[index];
        if (!group) return [];
        const master = group.masterUtxo as UnlockableUtxo | undefined;
        const inputs = group.blockInputs ?? (master ? [master, ...group.dataNftUtxos] : []);
        return inputs.flatMap((input) => {
          if (!input) return [];
          if (master && input.txid.toLowerCase() === master.txid.toLowerCase() && input.vout === master.vout) {
            return master.unlocker ? [master] : [];
          }
          return 'unlocker' in input && input.unlocker ? [input as UnlockableUtxo] : [];
        });
      };
      const nestedInputs: UnlockableUtxo[] = [];
      for (const group of this.externalCallUtxoGroups) {
        if (group.sharedGroupIndex !== undefined) continue;
        nestedInputs.push(...groupInputs(group));
        if (group.delegateCallGroupIndex !== undefined && !group.delegateEmbeddedInBlock) {
          nestedInputs.push(...delegateInputs(group.delegateCallGroupIndex));
        }
      }
      const prefix = [
        this.masterUtxo, ...this.dataNftUtxos,
        ...this.lowLevelCallUtxoGroups.flatMap((group, index) => associatedDelegates.has(index)
          ? [] : [group.masterUtxo as UnlockableUtxo, ...group.dataNftUtxos]),
        ...this.lowLevelCallRawInputs,
        ...this.readOnlyDataNftUtxos, ...this.blockhashCoSpendUtxos,
        ...this.keccakComputeCoSpendUtxos, ...this.keccakLoopSideCars, ...this.ecrecoverComputeCoSpendUtxos,
        ...externalOutStateInputs, ...entryInputs,
      ];
      // A delegate's trailing storage is addressed from implementationInput + blockSize. Output-only fixed slots
      // (most commonly an event) still need corresponding funder INPUTS before that trailing region. The legacy
      // order previously appended every funder after dynamic chunks, placing an old chunk one index too low on the
      // second read-modify-write. Consume only the funders needed to complete the fixed implementation block here;
      // leave fee/change funders at the tail.
      const routeDelegateIndex = this.lowLevelCallUtxoGroups.findIndex((group, index) =>
        group.callMode === 'delegatecall' && !associatedDelegates.has(index));
      const routeDelegate = routeDelegateIndex >= 0 ? this.lowLevelCallUtxoGroups[routeDelegateIndex] : undefined;
      const routeDelegateInputIndex = routeDelegate?.masterUtxo
        ? prefix.findIndex((input) => input.txid.toLowerCase() === routeDelegate.masterUtxo!.txid.toLowerCase()
          && input.vout === routeDelegate.masterUtxo!.vout)
        : -1;
      const delegateAbiFunction = routeDelegate?.compilerRoute?.abiFunction
        ?? routeDelegate?.externalContract?.inner.artifact.abi.find(
          (fn: AbiFunction) => fn.name === routeDelegate.functionName,
        );
      const delegateLayout = delegateAbiFunction?.blockLayout;
      const trailingBase = delegateLayout?.trailingBase ?? delegateLayout?.blockSize
        ?? this.blockLayout?.trailingBase ?? this.blockLayout?.blockSize;
      const expectedDynamicIndex = routeDelegateInputIndex >= 0 && trailingBase !== undefined
        ? routeDelegateInputIndex + trailingBase
        : prefix.length;
      const delegatedLoopOutputCount = this._delegateLoopEntryVars().reduce(
        (sum, variable) => sum + (this.loopEntryCommitments.get(variable.collection) ?? []).length,
        0,
      );
      const delegatedLoopInputCount = this.iterationEntryInputs.length
        + this.dynamicChunkInputs.length + this.trailingDisposalInputs.length
        + this.insertLoopPredecessorInputs.length;
      // A sorted INSERT consumes one predecessor but emits both the rewritten predecessor and the new node.
      // That output-only expansion must be balanced before nested participant blocks, otherwise every callee
      // input is one position earlier than its output and its self-preservation covenant reads the prior slot.
      // Read-only dynamic chunks are 1:1 (same count on both sides) and must not cancel the INSERT surplus.
      // Commitments are often empty at first _buildInputs; a `set`/`+` predecessor still mints P'+NEW.
      const insertOutputFloor = this.insertLoopPredecessorInputs.length * 2;
      const delegatedLoopOutputSurplus = Math.max(
        0, Math.max(delegatedLoopOutputCount, insertOutputFloor) - this.insertLoopPredecessorInputs.length,
      );
      // Alignment pads belong BEFORE the trailing band so input[impl+trailingBase] is the first
      // X151 run (read-only chunks, then write-path predecessors). Surplus pads belong AFTER that
      // band: P' is an extra output, and nested callees must stay paired with their outputs.
      const alignmentPaddingCount = Math.min(
        this.funderUtxos.length,
        Math.max(0, expectedDynamicIndex - prefix.length),
      );
      const surplusPaddingCount = Math.min(
        Math.max(0, this.funderUtxos.length - alignmentPaddingCount),
        delegatedLoopOutputSurplus + this.delegatedValueChunkPad,
      );
      const fixedPaddingCount = alignmentPaddingCount + surplusPaddingCount;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_INPUTS === '1') {
        console.error('delegate-trailing-input-geometry', {
          routeDelegateIndex, routeDelegateInputIndex, delegateBlockSize: delegateLayout?.blockSize,
          builderBlockSize: this.blockLayout?.blockSize, trailingBase, prefix: prefix.length,
          expectedDynamicIndex, alignmentPaddingCount, surplusPaddingCount, fixedPaddingCount,
          dynamicChunks: this.dynamicChunkInputs.length,
          disposals: this.trailingDisposalInputs.length,
          delegatedLoopOutputCount, delegatedLoopInputCount, delegatedLoopOutputSurplus,
          counts: {
            data: this.dataNftUtxos.length,
            lowLevel: this.lowLevelCallUtxoGroups.length,
            raw: this.lowLevelCallRawInputs.length,
            readOnly: this.readOnlyDataNftUtxos.length,
            externalOutState: externalOutStateInputs.length,
            entry: entryInputs.length,
            iteration: this.iterationEntryInputs.length,
            predecessors: this.insertLoopPredecessorInputs.length,
            nested: nestedInputs.length,
            funders: this.funderUtxos.length,
          },
        });
      }
      return [
        ...prefix,
        ...this.funderUtxos.slice(0, alignmentPaddingCount),
        // X151: read-only dynamic chunks first, then RMW old write chunks at the same
        // impl+trailingBase band (closeJob reads jobs[i] from input 10), then predecessors.
        ...this.iterationEntryInputs, ...this.dynamicChunkInputs, ...this.trailingDisposalInputs,
        ...this.insertLoopPredecessorInputs,
        ...this.funderUtxos.slice(alignmentPaddingCount, fixedPaddingCount),
        ...nestedInputs,
        ...tokenContainerInputs, ...satoshiContainerInputs,
        ...this.funderUtxos.slice(fixedPaddingCount),
      ];
    }
    // When the function also reads a dynamic-storage array (iterationEntryInputs = chunk run),
    // the covenant reads those chunks at blockSize+i, so they must sit immediately after the
    // block with nothing between. Loop external-call callees therefore go AFTER the chunk run
    // (their base is computed as blockSize+chunkCount), not in the pre-entry external-call slot.
    if (this.iterationEntryInputs.length > 0 && externalCallInputs.length > 0) {
      return [
        this.masterUtxo, ...this.dataNftUtxos, ...this.readOnlyDataNftUtxos, ...this.blockhashCoSpendUtxos,
        ...this.keccakComputeCoSpendUtxos, ...this.keccakLoopSideCars, ...this.ecrecoverComputeCoSpendUtxos,
        ...externalOutStateInputs,
        ...lowLevelCallInputs, ...this.lowLevelCallRawInputs,
        ...entryInputs, ...this.iterationEntryInputs, ...this.insertLoopPredecessorInputs,
        ...externalCallInputs,
        ...this.dynamicChunkInputs, ...this.trailingDisposalInputs,
        ...tokenContainerInputs, ...satoshiContainerInputs,
        ...this.funderUtxos,
      ];
    }
    return [
      this.masterUtxo, ...this.dataNftUtxos, ...this.readOnlyDataNftUtxos, ...this.blockhashCoSpendUtxos,
      ...this.keccakComputeCoSpendUtxos, ...this.keccakLoopSideCars, ...this.ecrecoverComputeCoSpendUtxos,
      ...externalOutStateInputs, ...externalCallInputs,
      ...lowLevelCallInputs, ...this.lowLevelCallRawInputs,
      ...entryInputs, ...this.iterationEntryInputs, ...this.insertLoopPredecessorInputs,
      ...this.dynamicChunkInputs, ...this.trailingDisposalInputs,
      ...tokenContainerInputs, ...satoshiContainerInputs,
      ...this.funderUtxos,
    ];
  }

  /**
   * Compute the minimum fee in satoshis for a transaction of the given byte size.
   * Converts minRelayFeePerKb to a per-byte rate with a floor of 1 sat/byte,
   * matching the ceiling-division formula used by BCHN / mem-cash.
   */
  private computeMinFee(txSizeBytes: bigint): bigint {
    // Ceiling division: ceil(feePerKb * size / 1000)
    // When feePerKb / 1000 rounds to 0 (e.g. feePerKb < 1000), enforce at least 1 sat/byte.
    const feePerByte = this._minRelayFeePerKb >= 1000n
      ? (this._minRelayFeePerKb + 999n) / 1000n   // ceiling division
      : 1n;                                        // floor: at least 1 sat/byte
    return feePerByte * txSizeBytes;
  }

  /** Pad outputs up to `index`. Prefer the same-index funder input so a token-group
   * swap (22-25 ↔ 26-29) does not insert extra OP_TRUE slots and raise TXOUTPUTCOUNT. */
  private _padOutputsToIndex(builder: TransactionBuilder, index: number): void {
    while (builder.outputs.length < index) {
      const occupant = this.allInputs[builder.outputs.length];
      if (occupant && !occupant.token && occupant.unlocker) {
        builder.addOutput({
          to: occupant.unlocker.generateLockingBytecode(),
          amount: occupant.satoshis,
        });
      } else {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      }
    }
  }

  /** Set the change address for funder excess (returned after fee deduction). */
  setFunderChangeAddress(address: Uint8Array): void {
    this.funderChangeAddress = address;
  }

  /** Absolute input index of the minting master for `categoryId`, or -1. */
  findMintingInputIndex(categoryId: string): number {
    return this.allInputs.findIndex((input) =>
      input.token?.category === categoryId && input.token?.nft?.capability === 'minting');
  }

  getAssembledInputCount(): number {
    return this.allInputs.length;
  }

  /** Collection entry lock next to the jobEvents band (not the value-chunk redeem). */
  entryLockNearJobEventsBand(): Uint8Array | undefined {
    const band = this.getPublishJobEventsBand();
    const chunkLock = this.jobEventsRedeemLock;
    const chunkHex = chunkLock ? binToHex(chunkLock) : '';
    const prefer = band ? [band.start - 1, band.start - 2, band.start] : [];
    for (const index of prefer) {
      const input = this.allInputs[index];
      if (!input?.token || input.token.nft?.capability !== 'mutable') continue;
      if (!('unlocker' in input) || !input.unlocker) continue;
      const lock = input.unlocker.generateLockingBytecode();
      if (lock.length === 35 && lock[0] === 0xaa && binToHex(lock) !== chunkHex) return lock;
    }
    for (const input of this.allInputs) {
      if (!input?.token || input.token.nft?.capability !== 'mutable') continue;
      if (!('unlocker' in input) || !input.unlocker) continue;
      const lock = input.unlocker.generateLockingBytecode();
      if (lock.length === 35 && lock[0] === 0xaa && binToHex(lock) !== chunkHex) return lock;
    }
    return undefined;
  }

  rememberJobEventsChunks(
    categoryId: string,
    chunks: ReadonlyArray<{ commitment: string; lockingBytecode: Uint8Array; categoryId?: string }>,
  ): void {
    const next = selectObservedValueChunkRun(
      persistedJobEventsByCategory.get(categoryId) ?? this.persistedJobEventsChunks,
      chunks,
    );
    if (next.length === 0) return;
    this.persistedJobEventsChunks = next;
    persistedJobEventsByCategory.set(categoryId, next);
  }

  /** Retain a VM-authenticated computed-value run across probe/final participant builder instances. */
  rememberObservedValueChunks(
    categoryId: string,
    collection: string,
    chunks: ReadonlyArray<AuthenticatedValueChunk>,
  ): void {
    const key = `${categoryId.toLowerCase()}:${collection}`;
    const next = selectObservedValueChunkRun(observedValueChunksByCollection.get(key) ?? [], chunks);
    if (next.length > 0) observedValueChunksByCollection.set(key, next);
  }

  static clearPersistedJobEvents(categoryId?: string): void {
    if (categoryId) {
      persistedJobEventsByCategory.delete(categoryId);
      persistedJobEventsValues.delete(categoryId);
      persistedJobEventsLocks.delete(categoryId);
      persistedJobEventsSpends.delete(categoryId);
      persistedJobEventsRecipes.delete(categoryId);
      for (const key of persistedValueChunkWrites.keys()) {
        if (key.startsWith(`${categoryId.toLowerCase()}:`)) persistedValueChunkWrites.delete(key);
      }
      stagedJobEventsValues.delete(categoryId);
      createdDigestLocks.delete(categoryId);
      persistedCreatedValues.delete(categoryId);
      const prefix = `${categoryId.toLowerCase()}:`;
      for (const key of observedValueChunksByCollection.keys()) {
        if (key.startsWith(prefix)) observedValueChunksByCollection.delete(key);
      }
    } else {
      persistedJobEventsByCategory.clear();
      persistedJobEventsValues.clear();
      persistedJobEventsLocks.clear();
      persistedJobEventsSpends.clear();
      persistedJobEventsRecipes.clear();
      persistedValueChunkWrites.clear();
      stagedJobEventsValues.clear();
      createdDigestLocks.clear();
      persistedCreatedValues.clear();
      observedValueChunksByCollection.clear();
    }
    persistedJobEventsSendReady = false;
  }

  private _rootIsPublishJobPost(): boolean {
    return this.lowLevelCallUtxoGroups.some((group) => group.functionName === 'publishJobPost')
      || this.externalCallUtxoGroups.some((group) =>
        (group.functionName ?? group.logicalFunctionName) === 'publishJobPost');
  }

  /** Persist UPDATE rematerialize only for empty-address dest, never INSERT/whitelist dest. */
  private _shouldRematerializePersistUpdate(): boolean {
    const plannedInserts = Math.max(
      0,
      ...this.externalCallUtxoGroups.map((group) => group.plannedEntryInserts?.length ?? 0),
      ...this.lowLevelCallUtxoGroups.map((group) => group.plannedEntryInserts?.length ?? 0),
    );
    for (const group of [...this.lowLevelCallUtxoGroups, ...this.externalCallUtxoGroups]) {
      const names = [group.logicalFunctionName, group.functionName, group.compilerRoute?.abiFunction?.name];
      if (!names.includes('publishJobEvent')) continue;
      const event = (group.logicalFunctionArgs ?? group.functionArgs)?.[1];
      if (shouldRematerializePersistUpdate({
        persistReady: isPersistedJobEventsReady(),
        publishJobPost: this._rootIsPublishJobPost(),
        event,
        plannedInserts,
      })) return true;
    }
    return false;
  }

  private _isFirstPublishJobEventsInsert(): boolean {
    if (this._rootIsPublishJobPost()) return true;
    const plannedInserts = Math.max(
      0,
      ...this.externalCallUtxoGroups.map((group) => group.plannedEntryInserts?.length ?? 0),
      ...this.lowLevelCallUtxoGroups.map((group) => group.plannedEntryInserts?.length ?? 0),
    );
    if (plannedInserts > 0) return true;
    for (const group of [...this.lowLevelCallUtxoGroups, ...this.externalCallUtxoGroups]) {
      const names = [group.logicalFunctionName, group.functionName, group.compilerRoute?.abiFunction?.name];
      if (!names.includes('publishJobEvent')) continue;
      const event = (group.logicalFunctionArgs ?? group.functionArgs)?.[1];
      if (isInsertShapedJobEvent(event)) return true;
    }
    return false;
  }

  private _shouldStampPersistUpdateDigestLock(): boolean {
    const categoryId = this._persistJobEventsTokenCategory();
    return shouldStampPersistUpdateDigestLock({
      persistReady: isPersistedJobEventsReady(),
      persistWidth: categoryId ? persistedJobEventsWidth(categoryId) : persistedJobEventsWidth(),
      firstPublishInsert: this._isFirstPublishJobEventsInsert(),
    });
  }

  /** Every delegate `INPUTINDEX*scale-k` 1:1 window (Marketplace impl 5 → 21–24). */
  private _scaledPreserveRanges(): Array<{ start: number; endExclusive: number }> {
    const ranges: Array<{ start: number; endExclusive: number }> = [];
    for (const [llcIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
      if (group.callMode !== 'delegatecall') continue;
      const impl = this.getLowLevelCallMasterInputIndex(llcIndex);
      if (impl < 0) continue;
      const dataNfts = (group.compilerRoute?.abiFunction?.blockLayout?.slots
        ?? group.blockLayout?.slots ?? []).filter((slot) => slot.kind === 'dataNft').length;
      const scale = Math.max(2, 1 + (dataNfts || 4));
      const endExclusive = scaledInputPreserveExclusiveEnd(impl, scale);
      if (endExclusive < 0) continue;
      ranges.push({ start: endExclusive - scale + 1, endExclusive });
    }
    return ranges;
  }

  /** Restore 1:1 on the executing impl's INPUTINDEX*scale-k window after other writers. */
  private _reassertScaledPreserveOneToOnes(builder: TransactionBuilder): void {
    if (!isPersistedJobEventsReady() || this._rootIsPublishJobPost()) return;
    const emitDests = new Set(this._emitDestinationIndices());
    const emitDest = this._scaledEmitOutputIndex(builder.outputs.length);
    if (emitDest !== undefined) emitDests.add(emitDest);
    const persistBand = this.getPublishJobEventsBand();
    const returnWitnesses = returnWitnessOutputIndices(this.externalCallUtxoGroups);
    for (const group of this.externalCallUtxoGroups) {
      if (!isMintingBandSwapFunction(
        group.functionName ?? group.compilerRoute?.abiFunction.name ?? group.logicalFunctionName,
      )) continue;
      const master = this.findMintingInputIndex(group.categoryId);
      if (master >= 0) {
        returnWitnesses.add(tokenWriterReturnIndex(master, group.blockLayout, persistBand));
      }
    }
    const restore = (start: number, endExclusive: number): void => {
      for (let index = start; index < endExclusive; index++) {
        if (emitDests.has(index)) continue;
        if (returnWitnesses.has(index)) continue;
        if (persistBand && index >= persistBand.start && index <= persistBand.end) continue;
        const input = this.allInputs[index];
        if (!input || !('unlocker' in input) || !input.unlocker || input.token) continue;
        builder.outputs[index] = {
          to: input.unlocker.generateLockingBytecode(),
          amount: input.satoshis,
        };
      }
    };
    const entry = this._entryScaledPreserveRange();
    if (entry) restore(entry.start, entry.endExclusive);
    for (const [index, input] of this.allInputs.entries()) {
      if (input?.token?.nft?.capability !== 'minting') continue;
      const endExclusive = scaledInputPreserveExclusiveEnd(index, 5);
      if (endExclusive <= 0 || endExclusive > builder.outputs.length + 5) continue;
      restore(endExclusive - 4, endExclusive - 1);
    }
  }

  /** One physical executor for the active chunkable array write. Duplicate logical rows collapse by input. */
  private _chunkableValueWriteExecution(): {
    inputIndex: number; abiFunction: AbiFunction; collection: string;
  } | undefined {
    return selectChunkableValueWriteExecution([
      ...this.lowLevelCallUtxoGroups.map((group, index) => ({
        group, inputIndex: this.getLowLevelCallMasterInputIndex(index),
      })),
      ...this.externalCallUtxoGroups.flatMap((group, index) => (
        // A delegated logical group is represented by its implementation executor above.
        group.delegateCallGroupIndex === undefined ? [{
          group, inputIndex: this.getExternalCallMasterInputIndex(index),
        }] : []
      )),
    ]);
  }

  private _hasChunkableValueWriteMetadata(): boolean {
    return [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups].some((group) =>
      (group.valueChunkWrites?.length ?? 0) > 0
      || groupChunkableArrayWriteCollections(group).length > 0);
  }

  /** Physical/logical group views of the one compiler-described chunkable-value writer. */
  private _chunkableValueWriteGroups(): {
    external?: ExternalCallUtxoGroup; externalIndex: number;
    lowLevel?: ExternalCallUtxoGroup; lowLevelIndex: number;
  } {
    const structural = this._chunkableValueWriteExecution();
    if (structural) {
      const lowLevelIndex = this.lowLevelCallUtxoGroups.findIndex((group, index) => (
        this.getLowLevelCallMasterInputIndex(index) === structural.inputIndex
        && groupChunkableValueWriteIdentity(group) === structural.collection
      ));
      const externalIndex = this.externalCallUtxoGroups.findIndex((group, index) => (
        group.delegateCallGroupIndex === undefined
        && this.getExternalCallMasterInputIndex(index) === structural.inputIndex
        && groupChunkableValueWriteIdentity(group) === structural.collection
      ));
      return {
        external: externalIndex >= 0 ? this.externalCallUtxoGroups[externalIndex] : undefined,
        externalIndex,
        lowLevel: lowLevelIndex >= 0 ? this.lowLevelCallUtxoGroups[lowLevelIndex] : undefined,
        lowLevelIndex,
      };
    }
    if (this._hasChunkableValueWriteMetadata()) {
      return { externalIndex: -1, lowLevelIndex: -1 };
    }
    // Compatibility only for plans predating compiler-authored valueChunkWrites.
    const externalIndex = this.externalCallUtxoGroups.findIndex((group) =>
      (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent');
    const lowLevelIndex = this.lowLevelCallUtxoGroups.findIndex((group) =>
      group.functionName === 'publishJobEvent');
    return {
      external: externalIndex >= 0 ? this.externalCallUtxoGroups[externalIndex] : undefined,
      externalIndex,
      lowLevel: lowLevelIndex >= 0 ? this.lowLevelCallUtxoGroups[lowLevelIndex] : undefined,
      lowLevelIndex,
    };
  }

  private _chunkableValueWriteAbi(): AbiFunction | undefined {
    const structural = this._chunkableValueWriteExecution();
    if (structural) return structural.abiFunction;
    // Compatibility only for artifacts predating chunkable collection/write metadata.
    for (const group of [...this.lowLevelCallUtxoGroups, ...this.externalCallUtxoGroups]) {
      const abi = (group.externalContract?.inner?.artifact?.abi ?? []) as AbiFunction[];
      const fromAbi = abi.find((fn) => fn.name === 'publishJobEvent');
      if (fromAbi) return fromAbi;
      const routed = group.compilerRoute?.abiFunction;
      if (routed?.name === 'publishJobEvent') return routed;
    }
    return undefined;
  }

  /** The input that actually evaluates publishJobEvent (`OP_INPUTINDEX`). */
  getPublishJobEventInputIndex(): number {
    return this._chunkableValueWriteInputIndex();
  }

  /** The physical executor for the active compiler-described chunkable-value write. */
  getChunkableValueWriteInputIndex(): number {
    return this._chunkableValueWriteInputIndex();
  }

  isRootPublishJobPost(): boolean {
    return this._rootIsPublishJobPost();
  }

  private _persistDigestCategories(): string[] {
    const cats: string[] = [];
    const push = (value?: string): void => {
      if (value && !cats.includes(value)) cats.push(value);
    };
    push(this._jobEventsPublishCategory());
    push(this._persistJobEventsTokenCategory());
    for (const group of [...this.lowLevelCallUtxoGroups, ...this.externalCallUtxoGroups]) {
      push(group.categoryId);
    }
    return cats;
  }

  hasMintingBandTokenWriter(): boolean {
    return this.externalCallUtxoGroups.some((group) =>
      isMintingBandSwapFunction(group.functionName ?? group.compilerRoute?.abiFunction.name
        ?? group.logicalFunctionName))
      || this.mintingOutputSwap !== undefined;
  }

  tokenWriterOccupancy(
    tokenMaster: number,
    outputs?: ReadonlyArray<{ token?: { nft?: { commitment?: string } } }>,
  ): Set<number> {
    return persistAndTokenWriterOccupancy({
      persistReady: isPersistedJobEventsReady(),
      firstPublish: this._rootIsPublishJobPost(),
      hasTokenWriter: this.hasMintingBandTokenWriter(),
      implIndex: this._chunkableValueWriteInputIndex(),
      band: this.getPublishJobEventsBand(),
      tokenMaster,
      outputs,
    });
  }

  /** The input that actually evaluates publishJobEvent (`OP_INPUTINDEX`). */
  private _chunkableValueWriteInputIndex(): number {
    const structural = this._chunkableValueWriteExecution();
    if (structural) return structural.inputIndex;
    // Dest is INPUTINDEX+4 of the earliest executing publishJobEvent. Occupied
    // dests are displaced; do not relocate dest because persist sits at +4. Compatibility only: old artifacts
    // without chunkable-write metadata still identify this executor by their historical ABI function name.
    const candidates: number[] = [];
    for (const [index, input] of this.allInputs.entries()) {
      const name = (input as { unlocker?: { abiFunction?: { name?: string } } })
        .unlocker?.abiFunction?.name ?? '';
      if (name === 'publishJobEvent' || name.includes('publishJobEvent')) candidates.push(index);
    }
    for (const [llcIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
      const names = [group.logicalFunctionName, group.functionName, group.compilerRoute?.abiFunction?.name];
      if (!names.some((name) => name === 'publishJobEvent' || String(name ?? '').includes('publishJobEvent'))) {
        continue;
      }
      const master = this.getLowLevelCallMasterInputIndex(llcIndex);
      if (master >= 0) candidates.push(master);
    }
    if (candidates.length > 0) return Math.min(...candidates);
    return -1;
  }

  /** publishJobEvent emit is implementation-relative (`INPUTINDEX + event.offset`). */
  private _scaledEmitOutputIndex(outputCount: number): number | undefined {
    // First publish already fills Created in the callee walk at layout dest.
    if (!isPersistedJobEventsReady() || this._rootIsPublishJobPost()) return undefined;
    const impl = this._chunkableValueWriteInputIndex();
    // No executing publishJobEvent: do not invent dest as preserve-range-1
    // (that clobbered registerArbitrator dest 7 after persist became ready).
    if (impl < 0) return undefined;
    const offset = this._chunkableValueWriteAbi()?.blockLayout?.slots
      .find((slot) => slot.kind === 'event')?.offset ?? 4;
    const dest = publishJobEventOutputIndex(impl, offset);
    if (dest >= 0 && (outputCount <= 0 || dest < outputCount)) return dest;
    return undefined;
  }

  /** Event dests that scaled 1:1 must not restore as tokenless P2PKH pads. */
  private _emitDestinationIndices(): number[] {
    // `blockLayout` is the builder's effective physical layout. It can be a
    // compiler-selected message-bus route rather than the public entry ABI,
    // so its root event frame is authoritative even when the executing
    // delegate implementation declares no events of its own.
    const dests = (this.blockLayout?.slots ?? [])
      .filter((slot) => slot.kind === 'event')
      .map((slot) => slot.offset);
    const scaled = this._scaledEmitOutputIndex(this.allInputs.length);
    if (scaled !== undefined && scaled >= 0) dests.push(scaled);
    dests.push(...externalCallEventDestinations(
      this.externalCallUtxoGroups,
      (groupIndex) => this.getExternalCallOutputBase(groupIndex),
    ));
    for (const [llcIndex, llc] of this.lowLevelCallUtxoGroups.entries()) {
      if (llc.callMode !== 'delegatecall') continue;
      const impl = this.getLowLevelCallMasterInputIndex(llcIndex);
      if (impl < 0) continue;
      const fn = llc.compilerRoute?.abiFunction
        ?? llc.externalContract?.inner?.artifact.abi.find((candidate: AbiFunction) => candidate.name === llc.functionName);
      for (const slot of fn?.blockLayout?.slots ?? []) {
        if (slot.kind === 'event') dests.push(impl + slot.offset);
      }
    }
    // Runtime-loop events live in the trailing journal rather than fixed `blockLayout` slots. They are still
    // compiler-owned event destinations: leaving them out lets the generic empty-immutable repair relabel their
    // probe commitments as `SCID`, preventing event derivation (and every interleaved effect after the event).
    for (let index = 0; index < this.runtimeLoopEventOutputs.length; index += 1) {
      dests.push(this.getRuntimeLoopEventOutputIndex(index));
    }
    return dests;
  }

  /** JobEvents band uses the executing Marketplace impl window, not nested MD. */
  private _entryScaledPreserveRange(): { start: number; endExclusive: number } | undefined {
    const ranges = this._scaledPreserveRanges();
    if (ranges.length === 0) return undefined;
    return ranges.reduce((earliest, range) =>
      (earliest.start < range.start ? earliest : range));
  }

  /** Impl blocks, jobEvents band (and the INPUTINDEX+4 trailing write), writer returns. */
  private _scidReservedIndices(outputCount = this.allInputs.length): Set<number> {
    const reserved = new Set(this._emitDestinationIndices());
    for (const index of this.authenticatedOutputLockingBytecodes.keys()) reserved.add(index);
    const band = this.getPublishJobEventsBand();
    if (band) {
      reserved.add(Math.max(0, band.start - 1));
      for (let index = band.start; index <= band.end; index++) reserved.add(index);
    }
    const eventSlot = this._entryScaledPreserveRange();
    if (eventSlot && isPersistedJobEventsReady() && !this._rootIsPublishJobPost()) {
      reserved.add(eventSlot.endExclusive - 1);
    }
    for (const [llcIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
      if (group.callMode !== 'delegatecall') continue;
      const impl = this.getLowLevelCallMasterInputIndex(llcIndex);
      if (impl < 0) continue;
      const blockSize = group.compilerRoute?.abiFunction?.blockLayout?.blockSize
        ?? group.blockLayout?.blockSize
        ?? 5;
      for (let offset = 0; offset < blockSize; offset++) reserved.add(impl + offset);
    }
    const occupancyEnd = writerBlockOccupancyEnd(
      this.externalCallUtxoGroups,
      (categoryId) => this.findMintingInputIndex(categoryId),
    );
    for (let index = 0; index < occupancyEnd; index++) {
      const input = this.allInputs[index];
      if (input?.token?.nft?.capability === 'minting' || input?.token?.nft?.capability === 'mutable') {
        reserved.add(index);
      }
    }
    for (const range of this._scaledPreserveRanges()) {
      for (let index = range.start; index < range.endExclusive; index++) reserved.add(index);
    }
    for (const group of this.externalCallUtxoGroups) {
      if (!isMintingBandSwapFunction(
        group.functionName ?? group.compilerRoute?.abiFunction.name ?? group.logicalFunctionName,
      )) continue;
      const master = this.findMintingInputIndex(group.categoryId);
      if (master >= 0) reserved.add(tokenWriterReturnIndex(master, group.blockLayout, band));
    }
    const jobsCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    if (jobsCount > 0) {
      const suffixStart = Math.max(0, outputCount - jobsCount - 1);
      for (let index = suffixStart; index < outputCount; index++) reserved.add(index);
    }
    return reserved;
  }

  viewTailPackOptions(suffixStart?: number): ViewTailPackOptions {
    return {
      band: this.getPublishJobEventsBand(),
      // Input and output counts are independent once return witnesses, computed
      // outputs, and suffix sidecars are materialized. Only enforce a suffix
      // boundary when the caller derived it from an actual output layout.
      suffixStart,
      tokenWriterPresent: this.externalCallUtxoGroups.some((group) =>
        isMintingBandSwapFunction(group.functionName ?? group.compilerRoute?.abiFunction.name
          ?? group.logicalFunctionName)),
    };
  }

  /**
   * Live publishJobEvent value-chunk band (`impl + blockSize` for `nNew` slots).
   * Occupancy, view tails, and FakeToken rotation all share this range.
   */
  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined {
    const selected = this._chunkableValueWriteGroups();
    const publishLlcIndex = selected.lowLevelIndex;
    const publishExternalIndex = selected.externalIndex;
    const publishExternal = selected.external;
    if (publishLlcIndex < 0 && !publishExternal) return undefined;
    const publishFn = publishLlcIndex >= 0
      ? (this.lowLevelCallUtxoGroups[publishLlcIndex].compilerRoute?.abiFunction
        ?? this.lowLevelCallUtxoGroups[publishLlcIndex].externalContract?.inner.artifact.abi
          .find((fn: { name: string }) => fn.name === 'publishJobEvent'))
      : publishExternal?.compilerRoute?.abiFunction
        ?? publishExternal?.blockLayout
        ?? undefined;
    const publishBlockSize = (publishFn as AbiFunction | undefined)?.blockLayout?.blockSize
      ?? publishExternal?.blockLayout?.blockSize
      ?? 5;
    // A delegate implementation can be the executing verifier even when the
    // state-owning proxy master sits earlier. Include both structural bases;
    // the later verifier base is the first safe continuation coordinate.
    const bases: number[] = [];
    if (publishLlcIndex >= 0) {
      const master = this.getLowLevelCallMasterInputIndex(publishLlcIndex);
      if (master >= 0) bases.push(master + publishBlockSize);
    }
    if (publishExternal?.categoryId) {
      const master = this.findMintingInputIndex(publishExternal.categoryId);
      if (master >= 0) {
        bases.push(master + (publishExternal.blockLayout?.blockSize ?? publishBlockSize));
      }
    }
    for (const [llcIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
      if (group.callMode !== 'delegatecall') continue;
      const impl = this.getLowLevelCallMasterInputIndex(llcIndex);
      if (impl < 0) continue;
      const blockSize = group.compilerRoute?.abiFunction?.blockLayout?.blockSize
        ?? group.blockLayout?.blockSize
        ?? publishBlockSize;
      bases.push(impl + blockSize);
    }
    const plannedWidth = Math.max(
      0,
      liveChunkWidthForGroup(this.externalCallUtxoGroups, publishExternalIndex),
      ...(publishLlcIndex >= 0
        ? [this.lowLevelCallUtxoGroups[publishLlcIndex].valueChunkOutputCount ?? 0]
        : []),
    );
    const activeCollection = groupChunkableArrayWriteCollection(
      publishLlcIndex >= 0
        ? this.lowLevelCallUtxoGroups[publishLlcIndex]
        : publishExternal as ExternalCallUtxoGroup,
    ) ?? 'jobEvents';
    const jobEventsCount = [...new Set(
      this.getLoopEntryCommitments(activeCollection)
        .filter((commitment) => !isEmptyValueChunkCommitment(commitment)),
    )].length;
    const publishCategory = this._jobEventsPublishCategory();
    const persistWidth = isPersistedJobEventsReady() && !this._rootIsPublishJobPost()
      ? persistedJobEventsWidth(publishCategory) : 0;
    const plannedInserts = Math.max(
      0,
      ...(publishExternal?.plannedEntryInserts?.length !== undefined
        ? [publishExternal.plannedEntryInserts.length] : []),
      ...(publishLlcIndex >= 0
        ? [this.lowLevelCallUtxoGroups[publishLlcIndex].plannedEntryInserts?.length ?? 0]
        : []),
    );
    const insertShift = persistWidth > 0 ? 0
      : (plannedInserts > 0 || jobEventsCount === 0 ? 1 : 0);
    // Persist dest is INPUTINDEX+event.offset of the executing publishJobEvent.
    // The value-chunk band is impl+blockSize. If those disagree, dest can land
    // on a persist predecessor (output 20/21) and mutable conservation fails.
    if (persistWidth > 0) {
      const emitImpl = this._chunkableValueWriteInputIndex();
      const emitOffset = (publishFn as AbiFunction | undefined)?.blockLayout?.slots
        .find((slot) => slot.kind === 'event')?.offset ?? 4;
      if (emitImpl >= 0) bases.push(emitImpl + emitOffset + 1);
    }
    const layoutStart = bases.length > 0 ? Math.max(...bases) + insertShift : undefined;
    const forcedStart = this.forcedJobEventsBandStart;
    const publishImpl = this._chunkableValueWriteInputIndex();
    const tokenWriter = this.externalCallUtxoGroups.find((group) =>
      isMintingBandSwapFunction(group.functionName ?? group.compilerRoute?.abiFunction.name
        ?? group.logicalFunctionName));
    const tokenMaster = tokenWriter?.categoryId
      ? this.findMintingInputIndex(tokenWriter.categoryId) : -1;
    const keepAtLayout = shouldKeepPersistAtLayoutBase({
      persistReady: isPersistedJobEventsReady(),
      firstPublish: this._rootIsPublishJobPost(),
      layoutDestOccupiedByMintingWriter: tokenMaster >= 0 || this.mintingOutputSwap !== undefined,
    });
    const layoutDest = persistValueChunkBase(publishImpl, publishBlockSize);
    // Persist UPDATE + FakeToken on dest 20: keep persist at dest 20 and swap
    // FakeToken after dest+nNew. Whitelist pads keep the dest-25 slide.
    const preserveEndExclusive = keepAtLayout
      ? -1
      : (isPersistedJobEventsReady() && !this._rootIsPublishJobPost()
        ? (this._entryScaledPreserveRange()?.endExclusive ?? -1)
        : -1);
    const forcedLayoutStart = keepAtLayout && layoutDest >= 0 ? layoutDest : undefined;
    let derivedWidth = 0;
    if (layoutStart !== undefined) {
      while (this.derivedChunkOutputs.has(layoutStart + derivedWidth)) derivedWidth += 1;
    }
    // Live covenant nNew (extracted/persisted v) wins over a short compose plan
    // so the missing continuation (first post slot 25) is reserved. Persist is
    // cleared on deploy, so a prior test's Created extract cannot inflate this.
    return computePublishJobEventsBand({
      start: forcedLayoutStart ?? layoutStart,
      preserveEndExclusive: Math.max(preserveEndExclusive, forcedStart ?? -1),
      plannedWidth,
      jobEventsCount,
      liveWidth: liveJobEventsBandWidth({ plannedWidth, persistWidth, derivedWidth }),
    });
  }

  /** @deprecated Compatibility name for callers predating compiler-described chunkable writes. */
  getPublishJobEventsBand(): { start: number; end: number; nNew: number } | undefined {
    return this.getChunkableValueWriteBand();
  }

  /** Grow the selected chunkable writer's continuation width. */
  bumpChunkableValueWriteWidth(nNew: number): boolean {
    if (nNew <= 0) return false;
    let changed = false;
    const structural = this._chunkableValueWriteExecution();
    const structuralGroups = structural === undefined ? [] : [
      ...this.externalCallUtxoGroups.filter((group, index) => (
        group.delegateCallGroupIndex === undefined
        && this.getExternalCallMasterInputIndex(index) === structural.inputIndex
        && groupChunkableValueWriteIdentity(group) === structural.collection
      )),
      ...this.lowLevelCallUtxoGroups.filter((group, index) => (
        this.getLowLevelCallMasterInputIndex(index) === structural.inputIndex
        && groupChunkableValueWriteIdentity(group) === structural.collection
      )),
    ];
    const groups = structuralGroups.length > 0 ? structuralGroups : [
      ...this.externalCallUtxoGroups.filter((group) =>
        (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent'),
      ...this.lowLevelCallUtxoGroups.filter((group) => group.functionName === 'publishJobEvent'),
    ];
    for (const group of groups) {
      const next = Math.max(group.valueChunkOutputCount ?? 0, nNew);
      if (next !== group.valueChunkOutputCount) {
        group.valueChunkOutputCount = next;
        changed = true;
      }
    }
    if (changed) this.dynamicLayoutRevision += 1;
    return changed;
  }

  /** @deprecated Compatibility name for callers predating compiler-described chunkable writes. */
  bumpPublishJobEventsWidth(nNew: number): boolean {
    return this.bumpChunkableValueWriteWidth(nNew);
  }

  /** @internal Snapshot to detect when a VM probe discovers wider transaction geometry. */
  getDynamicLayoutRevision(): number {
    return this.dynamicLayoutRevision;
  }

  /** Move a participant block off a compiler-owned dynamic-output band without changing existing order. */
  private _swapMintingOffValueChunkBand(): void {
    const band = this.getPublishJobEventsBand();
    if (!band) return;
    const collisionIndex = collidingParticipantGroupIndex(
      this.externalCallUtxoGroups,
      (categoryId) => this.findMintingInputIndex(categoryId),
      band,
    );
    const tokenGroup = collisionIndex >= 0
      ? this.externalCallUtxoGroups[collisionIndex]
      : undefined;
    if (!tokenGroup?.categoryId) return;
    const previousSwap = this.mintingOutputSwap;
    const start = this.findMintingInputIndex(tokenGroup.categoryId);
    if (start < 0) { this.mintingOutputSwap = undefined; return; }
    const { start: jobEventsStart, nNew } = band;
    const persistUpdate = isPersistedJobEventsReady() && !this._rootIsPublishJobPost();
    const keepAtLayout = shouldKeepPersistAtLayoutBase({
      persistReady: persistUpdate,
      firstPublish: this._rootIsPublishJobPost(),
      layoutDestOccupiedByMintingWriter: this.hasMintingBandTokenWriter(),
    });
    const persistDests = persistUpdatePredecessorDests({
      implIndex: this._chunkableValueWriteInputIndex(),
      persistUpdate,
      keepAtLayout,
      bandStart: jobEventsStart,
      nNew,
    });
    const persistStart = persistDests[0] ?? jobEventsStart;
    const persistEndExclusive = persistDests.length > 0
      ? persistDests[persistDests.length - 1] + 1 : jobEventsStart;
    const chunkBase = keepAtLayout && persistStart >= 0
      ? Math.min(jobEventsStart, persistStart) : jobEventsStart;
    const plannedWidth = nNew;
    const bandEnd = Math.max(band.end + 1, persistEndExclusive);
    // Count the full consecutive token run (master + data + existing entries).
    // A band-limited width of 1 tries to swap the minting NFT with the data NFT
    // and aborts, leaving minting on chunk slot 22 so jobs derive 0 of 2.
    // A same-size swap of all 5 tokens lands the master at 27 and breaks the
    // known-good return at 33. Rotate K funders from *after* the token run
    // in front of it so the run stays consecutive and the master clears the
    // chunk band (K=4 → start 22 becomes master 26).
    let tokenWidth = 0;
    while (start + tokenWidth < this.allInputs.length
      && this.allInputs[start + tokenWidth]?.token?.category === tokenGroup.categoryId
      && this.allInputs[start + tokenWidth]?.token?.nft) {
      tokenWidth += 1;
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
      console.error('minting-swap-band', {
        chunkBase, jobEventsStart, bandEnd, start, tokenWidth, plannedWidth, nNew,
        inBand: start < bandEnd && start + tokenWidth > jobEventsStart,
      });
    }
    if (start >= bandEnd || start + tokenWidth <= jobEventsStart) {
      // Probe builds reuse `allInputs`. Once the first pass rotates this token block, the next pass sees the
      // already-correct master and must retain the relocation metadata so output materialization still
      // places view tails. Exact `from+width` is too brittle: a later 2-wide shift (26→28) would drop
      // the flag, skip tail placement, and compact `meceTags` onto `arbitratorRegistered`.
      if (shouldRetainMintingOutputSwap(start, chunkBase, nNew, previousSwap, tokenGroup.categoryId)) {
        this._placeJobEventsPredecessorInputs(this.pendingJobEventsPredecessors);
        return;
      }
      this.mintingOutputSwap = undefined;
      this._placeJobEventsPredecessorInputs(this.pendingJobEventsPredecessors);
      return;
    }
    this.mintingOutputSwap = undefined;
    if (tokenWidth === 0) return;
    const fullMinShift = Math.max(1, bandEnd - start);
    const relocationPool = [...this.funderUtxos, ...this.relocationFunderUtxos];
    const funderOutpoints = new Set(relocationPool.map((funder) => `${funder.txid}:${funder.vout}`));
    const promoteRelocationFunder = (funder: UnlockableUtxo): void => {
      const key = `${funder.txid}:${funder.vout}`;
      if (!this.funderUtxos.some((candidate) => `${candidate.txid}:${candidate.vout}` === key)) {
        this.funderUtxos.push(funder);
      }
      this.relocationFunderUtxos = this.relocationFunderUtxos.filter(
        (candidate) => `${candidate.txid}:${candidate.vout}` !== key,
      );
    };
    const preferredShift = Math.max(fullMinShift, 4);
    const prospectiveWidth = materializedParticipantWidth(
      tokenGroup,
      start + preferredShift,
      band,
    );
    const trailingSlots = Math.max(0, prospectiveWidth - tokenWidth);
    const preferredCapacity = preferredShift + trailingSlots;
    let availableFunders = gatherContiguousPlainFunders(
      this.allInputs, funderOutpoints, start + tokenWidth, preferredCapacity,
    );
    if (availableFunders < preferredCapacity) {
      const inUse = new Set(this.allInputs.map((input) => `${input.txid}:${input.vout}`));
      for (const funder of relocationPool) {
        if (availableFunders >= preferredCapacity) break;
        const key = `${funder.txid}:${funder.vout}`;
        if (inUse.has(key)) continue;
        this.allInputs.splice(start + tokenWidth + availableFunders, 0, funder);
        promoteRelocationFunder(funder);
        inUse.add(key);
        availableFunders += 1;
      }
    }
    const minShift = fullMinShift;
    const shift = chooseParticipantRelocationShift(availableFunders, minShift, trailingSlots);
    if (shift === 0) return;
    const tokenBlock = this.allInputs.slice(start, start + tokenWidth);
    const funderBlock = this.allInputs.slice(start + tokenWidth, start + tokenWidth + shift);
    this.allInputs.splice(start, tokenWidth + shift, ...funderBlock, ...tokenBlock);
    this.mintingOutputSwap = { from: start, width: shift, categoryId: tokenGroup.categoryId };
    this._placeJobEventsPredecessorInputs(this.pendingJobEventsPredecessors);
    const newMaster = this.findMintingInputIndex(tokenGroup.categoryId);
    if (newMaster < 0) return;
    // Sparse blocks still own their output-only coordinates. Keep later
    // participants out of those slots by filling the remainder with already
    // serialized funding inputs (or unused real funders as a last resort).
    let reservedTrailing = gatherContiguousPlainFunders(
      this.allInputs, funderOutpoints, newMaster + tokenWidth, trailingSlots,
    );
    if (reservedTrailing < trailingSlots) {
      const inUse = new Set(this.allInputs.map((input) => `${input.txid}:${input.vout}`));
      for (const funder of relocationPool) {
        if (reservedTrailing >= trailingSlots) break;
        const key = `${funder.txid}:${funder.vout}`;
        if (inUse.has(key)) continue;
        this.allInputs.splice(newMaster + tokenWidth + reservedTrailing, 0, funder);
        promoteRelocationFunder(funder);
        inUse.add(key);
        reservedTrailing += 1;
      }
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
      console.error('minting-swap-reserved-span', {
        newMaster,
        tokenWidth,
        trailingSlots,
        reservedTrailing,
        blockSize: tokenGroup.blockLayout?.blockSize,
        returnEventInBlock: tokenGroup.returnEventInBlock,
        returnOffset: tokenGroup.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent')?.offset,
        band,
      });
    }
    tokenGroup.dataNftUtxos = tokenGroup.dataNftUtxos.map((utxo) => ({
      ...utxo,
      unlocker: createDataNftUnlocker(tokenGroup.externalContract.inner, newMaster, tokenGroup.categoryId),
    }));
    for (const nft of tokenGroup.dataNftUtxos) {
      const inputIndex = this.allInputs.findIndex((input) =>
        input.txid.toLowerCase() === nft.txid.toLowerCase() && input.vout === nft.vout);
      if (inputIndex >= 0) this.allInputs[inputIndex] = nft;
    }
  }

  private _jobEventsPublishCategory(): string | undefined {
    const selection = this._valueChunkWriteCategorySelection();
    if (selection.status === 'exact') return selection.categoryId;
    if (selection.status !== 'absent') return undefined;
    const selected = this._chunkableValueWriteGroups();
    const categories = new Set([selected.external?.categoryId, selected.lowLevel?.categoryId]
      .filter((category): category is string => category !== undefined));
    return categories.size === 1 ? [...categories][0] : undefined;
  }

  private _valueChunkWriteCategorySelection(): ValueChunkWriteCategorySelection {
    const writes = [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]
      .flatMap((group) => group.valueChunkWrites ?? []);
    return selectValueChunkWriteCategory(writes);
  }

  /** Persist chunks are proxy-category; the LLC master is the impl minting category. */
  private _persistJobEventsTokenCategory(): string | undefined {
    const selection = this._valueChunkWriteCategorySelection();
    if (selection.status === 'exact') return selection.categoryId;
    if (selection.status !== 'absent') return undefined;
    const selected = this._chunkableValueWriteGroups();
    const selectedCategories = new Set([selected.external?.categoryId, selected.lowLevel?.categoryId]
      .filter((category): category is string => category !== undefined));
    if (this._hasChunkableValueWriteMetadata()) {
      return selectedCategories.size === 1 ? [...selectedCategories][0] : undefined;
    }
    // Compatibility only for artifacts/plans predating compiler-authored valueChunkWrites.
    const impl = this.lowLevelCallUtxoGroups.find((group) => group.functionName === 'publishJobEvent')?.categoryId;
    for (const categoryId of persistedJobEventsLocks.keys()) {
      if (categoryId && categoryId !== impl) return categoryId;
    }
    for (const categoryId of persistedJobEventsRecipes.keys()) {
      if (categoryId && categoryId !== impl) return categoryId;
    }
    return this._jobEventsPublishCategory();
  }

  /** ExtraTransfer swap parks p2pkh funders on the jobEvents band. Put predecessor chunks back. */
  private _placeJobEventsPredecessorInputs(extras: UnlockableUtxo[] = []): void {
    // A compiler-published balanced block is a complete ownership map. Legacy persistence recovery infers
    // destinations from cached input shape, so applying it after fixed-width assembly can replace a declared
    // route slot with an unrelated resource. Compiler routes must receive every live/disposal input through the
    // ordinary builder options and leave the materialized block immutable.
    if (this.preserveBlockLayoutWidth || this.compilerRouteDelegateBlock
      || this.blockLayout?.trailingCapacity !== undefined) return;
    const band = this.getPublishJobEventsBand();
    if (!band) return;
    const categoryId = this._jobEventsPublishCategory();
    const persistUpdate = isPersistedJobEventsReady() && !this._rootIsPublishJobPost();
    const persistCategory = persistUpdate
      ? (this._persistJobEventsTokenCategory() ?? categoryId) : categoryId;
    const persistLock = (persistCategory ? persistedJobEventsLocks.get(persistCategory) : undefined)
      ?? (categoryId ? persistedJobEventsLocks.get(categoryId) : undefined);
    const persistHex = persistLock ? binToHex(persistLock) : '';
    const candidates: UnlockableUtxo[] = [];
    const seen = new Set<string>();
    const consider = (input: UnlockableUtxo | undefined, fromPersistExtras = false): void => {
      if (!input?.token?.nft || input.token.nft.capability !== 'mutable' || !input.unlocker) return;
      const key = `${input.txid}:${input.vout}`;
      if (seen.has(key)) return;
      const lock = input.unlocker.generateLockingBytecode();
      if (lock.length !== 35 || lock[0] !== 0xaa) return;
      const commitment = String(input.token.nft.commitment ?? '');
      // Continuation NFTs are unambiguously indexed by their uint16 prefix. A sorted-map entry may share the
      // category and even the same P2SH32 family, but its commitment begins with the 32-byte key slot instead.
      if (valueChunkIndexFromCommitment(commitment) === undefined) return;
      const sameLock = persistHex !== '' && binToHex(lock) === persistHex;
      // Category and commitment shape do not identify a resource covenant. Entry NFTs and value-chunk NFTs
      // intentionally share both, so accepting either as a substitute can move a fixed entry proof out of its
      // compiler-declared input slot. Locally discovered candidates must match the authenticated redeem-script
      // identity; explicitly fetched candidates were already checked against that identity by their caller.
      if (!fromPersistExtras && !sameLock) return;
      seen.add(key);
      candidates.push(input);
    };
    for (const extra of extras) consider(extra, true);
    for (const input of this.allInputs) consider(input);
    if (persistUpdate) {
      for (const info of this.entryNfts) {
        if (!info.exists || !info.utxo) continue;
        if (!/jobEvents/i.test(info.collection ?? '')) continue;
        consider(info.utxo);
      }
    }
    const ordered = orderPersistPredecessorCandidates(candidates, persistUpdate);
    candidates.length = 0;
    candidates.push(...ordered);
    const needed = persistPredecessorPlaceCount(band.nNew, candidates.length, persistUpdate);
    const keepAtLayout = shouldKeepPersistAtLayoutBase({
      persistReady: persistUpdate,
      firstPublish: this._rootIsPublishJobPost(),
      layoutDestOccupiedByMintingWriter: this.hasMintingBandTokenWriter(),
    });
    const dests = persistUpdatePredecessorDests({
      implIndex: this._chunkableValueWriteInputIndex(),
      persistUpdate,
      keepAtLayout,
      bandStart: band.start,
      nNew: needed,
    });
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_OCCUPANCY === '1') {
      const dest18 = this.allInputs[18];
      console.error('persist-place-occupancy', {
        persistUpdate,
        keepAtLayout,
        persistReady: isPersistedJobEventsReady(),
        firstPublish: this._rootIsPublishJobPost(),
        hasTokenWriter: this.hasMintingBandTokenWriter(),
        impl: this._chunkableValueWriteInputIndex(),
        band,
        dests,
        dest18cap: dest18?.token?.nft?.capability ?? 'plain',
        dest18cat: dest18?.token?.category?.slice(0, 16),
        dest18commit: String(dest18?.token?.nft?.commitment ?? '').slice(0, 16),
      });
    }
    const placements = assignPersistPredecessors(
      dests, candidates, this._chunkableValueWriteInputIndex(), persistUpdate,
    );
    for (const { dest, candidate: wanted } of placements) {
      if (dest < 0 || dest >= this.allInputs.length) continue;
      const occupant = this.allInputs[dest];
      const occupantLock = occupant && 'unlocker' in occupant && occupant.unlocker
        ? occupant.unlocker.generateLockingBytecode() : undefined;
      const occupantIsPad = !occupant?.token
        || (!!occupantLock && occupantLock.length === 25 && occupantLock[0] === 0x76)
        || (!!occupantLock && occupantLock.length === 1 && occupantLock[0] === 0x51);
      const already = this.allInputs.findIndex((input) =>
        input?.txid === wanted.txid && input.vout === wanted.vout);
      if (already === dest) continue;
      if (!persistOccupantDisplaceable({
        occupantIsPad,
        persistUpdate,
        keepAtLayout,
        occupantCapability: occupant?.token?.nft?.capability,
        occupantCommitment: occupant?.token?.nft?.commitment,
      })) continue;
      if (already >= 0) {
        const displaced = this.allInputs[dest];
        this.allInputs[dest] = this.allInputs[already];
        this.allInputs[already] = displaced;
        continue;
      }
      const displaced = this.allInputs[dest];
      this.allInputs[dest] = wanted;
      if (!displaced) continue;
      let parked = false;
      for (let index = band.end + 1; index < this.allInputs.length; index++) {
        if (this.allInputs[index]?.token) continue;
        this.allInputs[index] = displaced;
        parked = true;
        break;
      }
      if (!parked) {
        for (let index = this.allInputs.length - 1; index > band.end; index--) {
          if (this.allInputs[index]?.token) continue;
          this.allInputs[index] = displaced;
          parked = true;
          break;
        }
      }
    }
  }

  /**
   * After extraTransfer, persist predecessors are often missing from `allInputs`.
   * Fetch the last successful jobEvents spends and pin them on the live band.
   */
  async ensurePersistedJobEventsInputs(): Promise<void> {
    const tokenWriterPresent = this.externalCallUtxoGroups.some((group) =>
      isMintingBandSwapFunction(group.functionName ?? group.compilerRoute?.abiFunction.name
        ?? group.logicalFunctionName));
    const band = this.getPublishJobEventsBand();
    const categoryId = this._persistJobEventsTokenCategory() ?? this._jobEventsPublishCategory();
    if (!shouldRestorePersistedContinuationInputs({
      initialWrite: this._rootIsPublishJobPost(),
      mintingBandWriter: tokenWriterPresent,
      persisted: isPersistedJobEventsReady(),
      hasBand: band !== undefined,
      hasCategory: categoryId !== undefined,
    })) return;
    // Keep the concrete values narrowed for the resource-loading code below.
    if (!band || !categoryId) return;
    const persistLock = persistedJobEventsLocks.get(categoryId)
      ?? latestPersisted(persistedJobEventsLocks, categoryId);
    const persistValue = persistedJobEventsValues.get(categoryId)
      ?? latestPersisted(persistedJobEventsValues, categoryId);
    const spends = persistedJobEventsSpends.get(categoryId)
      ?? latestPersisted(persistedJobEventsSpends, categoryId)
      ?? [];
    const extras: UnlockableUtxo[] = [];
    const selectedWriter = this._chunkableValueWriteGroups();
    const publish = selectedWriter.external ?? selectedWriter.lowLevel;
    const contract = publish?.externalContract?.inner;
    const write = this._persistedValueChunkWrite(categoryId);
    if (persistValue && persistLock) {
      if (write) rememberValueChunkUnlockRecipe(write, persistValue, persistLock);
      else if (write === undefined) rememberJobEventsUnlockRecipe(categoryId);
    }
    const recipe = write === null
      ? undefined
      : (write ? persistedValueChunkWriteState(write)?.recipe : persistedJobEventsUnlockRecipe(categoryId));
    const unlockCategory = recipe?.categoryId ?? categoryId;
    const unlockMaster = this.findMintingInputIndex(unlockCategory);
    const unlocker = contract && unlockMaster >= 0 && recipe
      ? createValueChunkUnlocker(
        contract, unlockMaster, unlockCategory, recipe.collection, recipe.slot, recipe.root,
      )
      : undefined;
    const unlockerLock = unlocker?.generateLockingBytecode();
    if (unlocker) {
      for (const spend of spends) {
        const spendLock = spend.lockingBytecode;
        // An unlocker and its source locking bytecode are one cryptographic identity. Never pair a cached
        // outpoint with a recipe for another P2SH script: changing only generateLockingBytecode makes the source
        // output look plausible but guarantees a redeem-script hash failure at consensus validation.
        if (!unlockerLock || binToHex(spendLock) !== binToHex(unlockerLock)) continue;
        extras.push({
          txid: spend.txid,
          vout: spend.vout,
          satoshis: spend.satoshis,
          token: spend.token,
          unlocker,
        });
      }
    }
    if (extras.length === 0 && unlocker && unlockerLock && this.builderOptions.provider) {
      try {
        const encoded = lockingBytecodeToCashAddress({
          bytecode: unlockerLock,
          prefix: this.builderOptions.provider.network === 'mainnet' ? 'bitcoincash' : 'bchtest',
          tokenSupport: true,
        });
        const address = typeof encoded === 'string' ? encoded : undefined;
        if (address) {
          const fetched = await this.builderOptions.provider.getUtxos(address);
          for (const utxo of fetched.filter((item) => item.token?.category === unlockCategory
            && item.token?.nft?.capability === 'mutable')) {
            extras.push({ ...utxo, unlocker });
          }
        }
      } catch { /* persist fetch is best-effort */ }
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
      console.error('jobevents-persist-inputs', {
        categoryId,
        band,
        persistValue: persistValue?.length ?? 0,
        persistLock: persistLock ? binToHex(persistLock).slice(0, 20) : '',
        recipe: recipe ? binToHex(recipe.slot).slice(0, 16) : '',
        spends: spends.length,
        extras: extras.length,
        unlockCategory: unlockCategory.slice(0, 16),
        unlockMaster,
        hasContract: !!contract,
      });
    }
    this.pendingJobEventsPredecessors = extras;
    this._placeJobEventsPredecessorInputs(extras);
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1' && band) {
      console.error('jobevents-band-inputs', {
        start: band.start,
        slots: Array.from({ length: band.nNew }, (_, offset) => {
          const input = this.allInputs[band.start + offset];
          const lock = input && 'unlocker' in input && input.unlocker
            ? binToHex(input.unlocker.generateLockingBytecode()).slice(0, 20) : '';
          return {
            index: band.start + offset,
            lock,
            cap: input?.token?.nft?.capability ?? 'plain',
            cat: String(input?.token?.category ?? '').slice(0, 8),
            commit: String(input?.token?.nft?.commitment ?? '').slice(0, 16),
          };
        }),
      });
    }
  }

  /**
   * After the 4-wide swap, conditional entry slots whose blockInputs were funders
   * emit as P2PKH. FakeToken.transferFrom then reads master+4 (output 30) as a
   * pred-out/entry and fails GTE on an empty token category. Re-fill those holes
   * with same-category mutable placeholders so derivation can reveal the commitment.
   */
  private _fillSwappedTokenEntryHoles(builder: TransactionBuilder): void {
    if (!this.mintingOutputSwap) return;
    const master = this.findMintingInputIndex(this.mintingOutputSwap.categoryId);
    if (master < 0) return;
    const tokenGroup = this.externalCallUtxoGroups.find((group) =>
      group.categoryId === this.mintingOutputSwap?.categoryId && group.sharedGroupIndex === undefined);
    if (!tokenGroup?.blockLayout) return;
    const sibling = builder.outputs.slice(master, master + tokenGroup.blockLayout.blockSize).find((output) =>
      output.token?.category === tokenGroup.categoryId && output.token.nft?.capability === 'mutable');
    const siblingLock = sibling?.to instanceof Uint8Array
      ? sibling.to
      : sibling?.to !== undefined ? addressToLockScript(sibling.to) : Uint8Array.of(0x51);
    for (const slot of tokenGroup.blockLayout.slots) {
      if (slot.kind !== 'entry') continue;
      const index = master + slot.offset;
      const existing = builder.outputs[index];
      if (existing?.token?.category === tokenGroup.categoryId) continue;
      const derived = this.externalCallEntryOutputs.get(tokenGroup.categoryId)?.get(slot.offset);
      const usedCommits = new Set(
        builder.outputs
          .filter((output) => output.token?.category === tokenGroup.categoryId
            && output.token.nft?.capability === 'mutable')
          .map((output) => String(output.token?.nft?.commitment ?? '')),
      );
      const unusedInput = this.allInputs.find((input) =>
        input.token?.category === tokenGroup.categoryId
        && input.token.nft?.capability === 'mutable'
        && !usedCommits.has(String(input.token.nft.commitment ?? '')));
      const lock = this._externalEntryLockingBytecode(tokenGroup, slot)
        ?? tokenGroup.batchEntryLockingBytecodes?.get(slot.offset)
        ?? (unusedInput && 'unlocker' in unusedInput && unusedInput.unlocker
          ? unusedInput.unlocker.generateLockingBytecode()
          : siblingLock);
      builder.outputs[index] = {
        to: lock,
        amount: unusedInput?.satoshis ?? 1000n,
        token: {
          amount: 0n,
          category: tokenGroup.categoryId,
          nft: {
            capability: 'mutable',
            commitment: derived
              ?? unusedInput?.token?.nft?.commitment
              ?? '00'.repeat(128),
          },
        },
      };
    }
    for (const slot of tokenGroup.blockLayout.slots) {
      if (slot.kind !== 'event') continue;
      const index = master + slot.offset;
      const existing = builder.outputs[index];
      const commit = String(existing?.token?.nft?.commitment ?? '');
      if (existing?.token?.category !== tokenGroup.categoryId) continue;
      if (existing.token.nft?.capability !== 'none') continue;
      if (commit !== '' && !/^0+$/.test(commit)) continue;
      builder.outputs[index] = {
        ...existing,
        token: {
          amount: 0n,
          category: tokenGroup.categoryId,
          nft: { capability: 'none', commitment: '' },
        },
      };
    }
  }

  /**
   * Construct an external entry slot's covenant from compiler metadata. Balanced composition can place an
   * unrelated participant or funder in an output-only entry position; its unlocker is therefore not a safe
   * source for the output locking bytecode. The collection signature and owning category define the lock.
   */
  private _externalEntryLockingBytecode(
    group: ExternalCallUtxoGroup,
    slot: FunctionBlockLayout['slots'][number],
  ): Uint8Array | undefined {
    if (slot.kind !== 'entry') return undefined;
    const artifacts = [group.logicalArtifact, group.externalContract?.inner?.artifact]
      .filter((artifact, index, all): artifact is Artifact => artifact !== undefined
        && all.indexOf(artifact) === index);
    const functionNames = new Set([
      group.logicalFunctionName,
      group.functionName,
    ].filter((name): name is string => name !== undefined));
    const routedFunction = group.compilerRoute?.abiFunction;
    const abiFunctions = [
      routedFunction && functionNames.has(routedFunction.name) ? routedFunction : undefined,
      ...artifacts.flatMap((artifact) => (artifact.abi as readonly AbiFunction[])
        .filter((candidate) => functionNames.has(candidate.name))),
    ].filter((candidate): candidate is AbiFunction => candidate !== undefined);
    const entryAccess = abiFunctions
      .map((candidate) => candidate.entryAccesses?.find((access, denseIndex) =>
        (access.slotIndex ?? denseIndex) === (slot.slotIndex ?? 0)))
      .find((candidate) => candidate !== undefined);
    const collections = [group.stateLayout, ...artifacts.map((artifact) => artifact.stateLayout)]
      .flatMap((layout) => layout?.collections ?? [])
      .filter((collection, index, all) => all.findIndex((candidate) => (
        candidate.signature === collection.signature
      )) === index);
    const collection = entryAccess
      ? collections.find((candidate) => candidate.name === entryAccess.collection
        || candidate.signature === entryAccess.collection)
      // Interface artifacts can omit implementation entry-access metadata. A state layout with exactly one
      // collection still identifies an entry slot without ambiguity; refuse to guess when several exist.
      : collections.length === 1 ? collections[0] : undefined;
    return collection?.signature ? scriptToLockingBytecode(
      buildEntryNftCovenantScript(
        hexToBin(group.categoryId), computeCollectionHash(collection.signature),
      ),
      group.logicalContract?.inner?.addressType
        ?? group.externalContract?.inner?.addressType
        ?? 'p2sh32',
    ) : undefined;
  }

  /** Resolve the participant whose compiler layout owns a fixed external-call output coordinate. */
  private _declaredExternalOutputSlotOwner(outputIndex: number): {
    categoryId: string;
    groupIndex: number;
    group: ExternalCallUtxoGroup;
    slot: FunctionBlockLayout['slots'][number];
  } | undefined {
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined) continue;
      const layout = group.blockLayout ?? group.compilerRoute?.abiFunction?.blockLayout;
      if (!layout) continue;
      const base = this.getExternalCallOutputBase(groupIndex);
      const slot = layout.slots.find((candidate) => base + candidate.offset === outputIndex);
      if (slot) return { categoryId: group.categoryId, groupIndex, group, slot };
    }
    return undefined;
  }

  /** Keep participant event/return NFTs inside the coordinates admitted by their compiler layout. */
  private _constrainParticipantImmutableOutputs(builder: TransactionBuilder): void {
    const allowedByCategory = new Map<string, Set<number>>();
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined || !group.categoryId) continue;
      const layout = group.blockLayout ?? group.compilerRoute?.abiFunction?.blockLayout;
      if (!layout) continue;
      let master = this.findMintingInputIndex(group.categoryId);
      if (master < 0) master = this.getExternalCallMasterInputIndex(groupIndex);
      if (master < 0) continue;
      const allowed = allowedByCategory.get(group.categoryId) ?? new Set<number>();
      for (const slot of layout.slots) {
        if (slot.kind === 'event' || slot.kind === 'returnEvent') allowed.add(master + slot.offset);
      }
      allowedByCategory.set(group.categoryId, allowed);
    }
    for (const claim of lowLevelCallImmutableEventDestinations(
      this.lowLevelCallUtxoGroups,
      this.externalCallUtxoGroups,
      (groupIndex) => this.getLowLevelCallMasterInputIndex(groupIndex),
    )) {
      const allowed = allowedByCategory.get(claim.categoryId) ?? new Set<number>();
      allowed.add(claim.destination);
      allowedByCategory.set(claim.categoryId, allowed);
    }
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (!group.categoryId || !groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, groupIndex)) continue;
      const placed = group.plannedReturnOutputIndex ?? group.returnOutputIndex;
      if (placed === undefined) continue;
      const allowed = allowedByCategory.get(group.categoryId) ?? new Set<number>();
      allowed.add(placed);
      allowedByCategory.set(group.categoryId, allowed);
    }
    for (const [categoryId, allowed] of allowedByCategory) {
      constrainOwnCategoryImmutableOutputs(builder.outputs, categoryId, allowed);
    }
  }

  /**
   * A relocated token writer can leave exact mutable block copies in the funder cells immediately after its
   * fixed block. Those cells are not sorted-batch predecessor outputs: their corresponding inputs are plain
   * funders, and retaining the copies makes the writer's address-cardinality covenant count the same entry
   * twice. Restore only plain-input cells whose token shape exactly duplicates an output in the fixed block.
   */
  private _restoreSwappedTokenFunderSlots(builder: TransactionBuilder): void {
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined || !group.categoryId) continue;
      let master = this.findMintingInputIndex(group.categoryId);
      if (master < 0) master = this.getExternalCallMasterInputIndex(groupIndex);
      const blockSize = group.blockLayout?.blockSize;
      if (master < 0 || !blockSize) continue;
      const blockEnd = master + blockSize;
      const signature = (output: Output | undefined): string | undefined => {
        const token = output?.token;
        if (!output || !token || token.category !== group.categoryId
          || token.nft?.capability !== 'mutable') return undefined;
        const lock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
        return `${binToHex(lock)}:${String(token.nft.commitment ?? '')}`;
      };
      const fixed = new Set(builder.outputs.slice(master, blockEnd).map(signature).filter(
        (value): value is string => value !== undefined,
      ));
      if (fixed.size === 0) continue;
      for (let index = blockEnd; index < Math.min(builder.outputs.length, this.allInputs.length); index++) {
        const input = this.allInputs[index];
        if (!input || input.token || !('unlocker' in input) || !input.unlocker) continue;
        const duplicate = signature(builder.outputs[index]);
        if (!duplicate || !fixed.has(duplicate)) continue;
        builder.outputs[index] = {
          to: input.unlocker.generateLockingBytecode(),
          amount: input.satoshis,
        };
      }
    }
  }

  /** Re-materialize conditional writer events learned from the covenant trace after block reconstruction. */
  private _applyLearnedWriterEvents(builder: TransactionBuilder): void {
    for (const group of this.externalCallUtxoGroups) {
      if (group.sharedGroupIndex !== undefined || !group.categoryId || !group.blockLayout) continue;
      let master = this.findMintingInputIndex(group.categoryId);
      if (master < 0) master = this.getExternalCallMasterInputIndex(
        this.externalCallUtxoGroups.indexOf(group),
      );
      if (master < 0) continue;
      let eventOrdinal = 0;
      for (const slot of group.blockLayout.slots) {
        if (slot.kind !== 'event') continue;
        const learned = group.eventOutputs?.[eventOrdinal];
        const outputIndex = master + slot.offset;
        eventOrdinal += 1;
        const debugEnv = (globalThis as {
          process?: { env?: Record<string, string> };
        }).process?.env;
        const debugEventIndex = debugEnv?.SOLIDC_DEBUG_EVENT_INDEX === undefined
          ? undefined : Number.parseInt(debugEnv.SOLIDC_DEBUG_EVENT_INDEX, 10);
        if (debugEnv?.SOLIDC_DEBUG_PARTICIPANT_EVENTS === '1'
          && (debugEventIndex === undefined || debugEventIndex === outputIndex)) {
          console.error('participant-event-slot', JSON.stringify({
            group: group.logicalFunctionName ?? group.functionName,
            categoryId: group.categoryId.slice(0, 16),
            master,
            offset: slot.offset,
            outputIndex,
            conditional: slot.conditional,
            blockSize: groupLayoutBlockSize(group),
            relocatedPredOutBase: group.relocatedPredOutBase,
            batchPredecessorOutputs: group.batchPredecessorOutputs,
            predOutArgs: Object.fromEntries(Object.entries({
              ...group.compilerRoute?.internalArgs,
              ...group.internalArgs,
            }).filter(([name]) => /^__internal__vmapBatchPredOut_\d+$/.test(name))
              .map(([name, value]) => [name, String(value)])),
            learned: learned ? {
              eventSignature: learned.eventSignature,
              commitment: String(learned.commitment).slice(0, 32),
            } : undefined,
            before: builder.outputs[master + slot.offset]?.token ? {
              category: builder.outputs[master + slot.offset]!.token!.category.slice(0, 16),
              capability: builder.outputs[master + slot.offset]!.token!.nft?.capability,
              commitment: String(
                builder.outputs[master + slot.offset]!.token!.nft?.commitment ?? '',
              ).slice(0, 32),
            } : undefined,
          }));
        }
        const commitment = String(learned?.commitment ?? '');
        if (!learned || commitment === '' || /^(00)+$/.test(commitment)) continue;
        if (builder.outputs[outputIndex]?.token?.nft?.capability === 'minting') continue;
        builder.outputs[outputIndex] = {
          to: learned.lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: group.categoryId,
            nft: { capability: 'none', commitment },
          },
        };
      }
    }
  }

  /** Reapply exact event observations after provisional carrier caches. */
  private _reassertAuthenticatedEventOutputs(builder: TransactionBuilder): void {
    for (const [outputIndex, authenticated] of this.authenticatedEventOutputs) {
      // Physical minting lineage is input-owned and must be resolved by layout,
      // not silently replaced by an output-only event claim.
      if (builder.outputs[outputIndex]?.token?.nft?.capability === 'minting') continue;
      builder.outputs[outputIndex] = {
        ...authenticated,
        to: authenticated.to instanceof Uint8Array ? authenticated.to.slice() : authenticated.to,
        token: cloneToken(authenticated.token),
      };
    }
  }

  /** Unclaimed conditional event slots must be neutral in both token and locking-bytecode namespaces. */
  private _clearUnclaimedConditionalEventSlots(builder: TransactionBuilder): void {
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined) continue;
      let master = this.findMintingInputIndex(group.categoryId);
      if (master < 0) master = this.getExternalCallMasterInputIndex(groupIndex);
      if (master < 0 || !group.blockLayout) continue;
      let eventOrdinal = 0;
      for (const slot of group.blockLayout.slots) {
        if (slot.kind !== 'event') continue;
        const learned = group.eventOutputs?.[eventOrdinal];
        eventOrdinal += 1;
        if (slot.conditional !== true) continue;
        const learnedCommit = String(learned?.commitment ?? '');
        // `SCID` marks an empty message-bus identity carrier; it is not evidence that a conditional event was
        // emitted. Generic route-event discovery can echo that provisional marker into `eventOutputs`, so treat
        // it as unresolved and restore the compiler-owned coordinate to a neutral output.
        const learnedIsDummy = learnedCommit === '' || /^(00)+$/.test(learnedCommit)
          || learnedCommit.toLowerCase() === '53434944';
        if (learned && !learnedIsDummy) continue;
        const existing = builder.outputs[master + slot.offset];
        if (!existing) continue;
        demoteUnclaimedConditionalEventOutput(existing, group.categoryId);
      }
    }
  }

  /**
   * Empty-commitment own-category P2SH32 immutables are message-bus auth carriers.
   * The event pin's empty-commitment skip `DUP`s the zero-amount bool (output 0/1)
   * instead of `j`, so a true empty carrier is still treated as a serialized event.
   * Prefix `SCID` so the disjoint-identity check excludes them. Do not touch OP_TRUE
   * return witnesses (`51`) or any nonempty commitment.
   */
  /**
   * Cross-call return witnesses are OP_TRUE + none-cap. A later unmatched-mutable
   * clone can overwrite that slot as mutable, and the callee's OUTPUTTOKENCATEGORY
   * SPLIT-32 leftover check then refuses the 0x01 capability byte.
   */
  private _ensureOpTrueReturnWitnessesAreImmutable(builder: TransactionBuilder): void {
    const returnKeys = new Set(
      this.pendingReturnEventOutputs.map((event) =>
        `${event.categoryId}:${binToHex(event.commitment)}`),
    );
    const returnCategories = new Set(
      this.pendingReturnEventOutputs.map((event) => event.categoryId),
    );
    for (const output of builder.outputs) {
      if (output.token?.nft?.capability !== 'mutable') continue;
      const lock = output.to instanceof Uint8Array
        ? output.to
        : output.to !== undefined ? addressToLockScript(output.to) : undefined;
      if (!lock || lock.length !== 1 || lock[0] !== 0x51) continue;
      const category = output.token.category;
      const commitment = String(output.token.nft.commitment ?? '');
      const isReturn = returnKeys.has(`${category}:${commitment}`)
        || (returnCategories.has(category)
          && category !== this.mintingOutputSwap?.categoryId
          && (commitment === '51' || commitment === '00' || commitment.startsWith('09')));
      if (!isReturn) continue;
      output.token = {
        ...output.token,
        amount: 0n,
        nft: { capability: 'none', commitment },
      };
    }
  }

  private _tagEmptyP2sh32ImmutablesAsScid(builder: TransactionBuilder): void {
    const eventDests = new Set(this._emitDestinationIndices());
    for (const [index, output] of builder.outputs.entries()) {
      if (eventDests.has(index)) continue;
      if (output.token?.nft?.capability !== 'none') continue;
      const raw = output.token.nft.commitment;
      const empty = raw === undefined || raw === null || String(raw) === '';
      if (!empty) continue;
      const lock = output.to instanceof Uint8Array
        ? output.to
        : addressToLockScript(output.to);
      if (lock.length < 2 || lock[0] !== 0xaa || lock[1] !== 0x20) continue;
      output.token = {
        ...output.token,
        nft: { capability: 'none', commitment: '53434944' },
      };
    }
  }

  /**
   * After the 4-wide minting swap, FakeToken's 8-slot occupies 26-33. Tail return
   * witnesses are packed at master+blockSize (34). A same-index funder pad there
   * makes updateJobPost's first OUTPUTTOKENCOMMITMENT/SPLIT-1 see an empty item.
   * Swap that hole with the next non-token none-cap event so TXOUTPUTCOUNT stays put.
   */
  /**
   * Routed proxy groups emit an OP_TRUE spacer at their sequential slot. The
   * minting UTXO must still be recreated at INPUTINDEX. Insert it there and drop
   * one later P2PKH/OP_TRUE pad so view tails and the jobs suffix do not move.
   */
  private _reassertNestedMintingMasters(builder: TransactionBuilder): void {
    const jobsCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    const suffixStart = builder.outputs.length - jobsCount - (jobsCount > 0 ? 1 : 0);
    const tailStart = this.pendingReturnEventOutputs.length > 0
      ? Math.min(
        ...[...packTailReturnPlacements(
          this.externalCallUtxoGroups,
          (categoryId) => this.findMintingInputIndex(categoryId),
          this.pendingReturnEventOutputs,
          this.mintingOutputSwap?.categoryId ?? '',
        ).values()],
        Number.POSITIVE_INFINITY,
      )
      : suffixStart;
    const seen = new Set<string>();
    for (const [groupIdx, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined || !group.categoryId || seen.has(group.categoryId)) continue;
      seen.add(group.categoryId);
      const master = this.findMintingInputIndex(group.categoryId);
      if (master < 0) continue;
      const mintingInput = this.allInputs[master];
      if (!mintingInput?.token || mintingInput.token.nft?.capability !== 'minting') continue;
      if (!('unlocker' in mintingInput) || !mintingInput.unlocker) continue;
      const blockWidth = 1 + (group.dataNftUtxos?.length
        ?? group.requiredDataNftIndices?.length ?? 0);
      const minting = {
        to: mintingInput.unlocker.generateLockingBytecode(),
        amount: mintingInput.satoshis,
        token: cloneToken(mintingInput.token),
      };
      placeMintingMasterPreservingTail(builder.outputs, master, minting, {
        blockWidth,
        tailStart: Number.isFinite(tailStart) ? tailStart : suffixStart,
        suffixStart,
      });
    }
  }

  /** Drop leftover empty-value entry placeholders that share a live collection lock. */
  private _stripSurplusEmptyCollectionEntries(builder: TransactionBuilder): void {
    const activeGroups = [
      ...this.externalCallUtxoGroups,
      ...this.lowLevelCallUtxoGroups,
    ];
    const groupCollections = activeGroups.map(groupChunkableArrayWriteCollections);
    if (groupCollections.some((collections) => collections.length > 1)) return;
    const selectedCollections = new Set(groupCollections.flat());
    for (const variable of this.loopEntryVars) {
      const collection = this.stateLayout.collections?.find((candidate) => (
        candidate.name === variable.collection || candidate.signature === variable.collection
      ));
      if (variable.chunkable === true && collection?.chunkableValue === true
        && collection.valueType.endsWith('[]')) selectedCollections.add(collection.name);
    }
    // Several active chunkable array writers can own different locks and widths. Until each run is tied to its
    // compiler-published collection identity, selecting among them would be heuristic.
    if (selectedCollections.size !== 1) return;
    const [selectedCollection] = selectedCollections;
    const selectedLayoutCollection = this.stateLayout.collections?.find((candidate) => (
      candidate.name === selectedCollection || candidate.signature === selectedCollection
    ));
    const plannedByLock = new Map<string, { lock: Uint8Array; planned: number }>();
    const remember = (lock: Uint8Array, planned: number): void => {
      if (lock.length === 0 || planned <= 0) return;
      const key = binToHex(lock);
      const existing = plannedByLock.get(key);
      plannedByLock.set(key, { lock, planned: Math.max(existing?.planned ?? 0, planned) });
    };
    for (const variable of this.loopEntryVars) {
      if (variable.collection !== selectedCollection
        && variable.collection !== selectedLayoutCollection?.signature) continue;
      const required = this.getRequiredLoopEntryCount(variable.collection);
      const materialized = this.getLoopEntryCommitments(variable.collection).length;
      // Both counts are compiler/planner-owned. With neither, the exact physical width is unknown and this
      // cleanup must leave every output untouched.
      remember(variable.lockingBytecode, required > 0 ? required : materialized);
    }
    for (const { lock, planned } of plannedByLock.values()) {
      stripSurplusEmptyCollectionEntries(builder.outputs, lock, planned);
    }
  }

  /** Reassert each planned sorted-entry INSERT at the compiler-advertised predecessor and NEW coordinates. */
  private _reassertNestedSameIndexMutables(builder: TransactionBuilder): void {
    const plannedInsertByPredecessor = new Map<number, {
      outputIndex: number; commitment?: string; newCommitment?: string;
    }>();
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined) continue;
      const base = this.getExternalCallMasterInputIndex(groupIndex);
      for (const insert of group.plannedEntryInserts ?? []) {
        plannedInsertByPredecessor.set(base + insert.blockSlot, {
          outputIndex: base + insert.outputBlockSlot,
          commitment: insert.commitment,
          newCommitment: insert.newCommitment,
        });
      }
    }
    for (const [groupIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
      const base = this.getLowLevelCallMasterInputIndex(groupIndex);
      for (const insert of group.plannedEntryInserts ?? []) {
        plannedInsertByPredecessor.set(base + insert.blockSlot, {
          outputIndex: base + insert.outputBlockSlot,
          commitment: insert.commitment,
          newCommitment: insert.newCommitment,
        });
      }
    }
    const nestedCategories = new Set(
      this.externalCallUtxoGroups.map((group) => group.categoryId).filter((id): id is string => !!id),
    );
    const jobsCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    const suffixStart = builder.outputs.length - jobsCount - (jobsCount > 0 ? 1 : 0);
    const tailStart = this.pendingReturnEventOutputs.length > 0
      ? Math.min(
        ...[...packTailReturnPlacements(
          this.externalCallUtxoGroups,
          (categoryId) => this.findMintingInputIndex(categoryId),
          this.pendingReturnEventOutputs,
          this.mintingOutputSwap?.categoryId ?? '',
        ).values()],
        Number.POSITIVE_INFINITY,
      )
      : suffixStart;
    for (let index = 0; index < this.allInputs.length; index++) {
      const plannedInsert = plannedInsertByPredecessor.get(index);
      if (!plannedInsert) continue;
      const input = this.allInputs[index];
      const category = input.token?.category;
      if (!category || input.token?.nft?.capability !== 'mutable' || !nestedCategories.has(category)) {
        continue;
      }
      if (!('unlocker' in input) || !input.unlocker) continue;
      const twinLock = input.unlocker.generateLockingBytecode();
      const commitHex = (value: Uint8Array | string | undefined): string => {
        if (value instanceof Uint8Array) return binToHex(value);
        return value ?? '';
      };
      const inputCommit = commitHex(input.token?.nft?.commitment as Uint8Array | string | undefined);
      if (isDataNftIndexCommitment(inputCommit)) continue;
      if (!isSortedEntryHeadCommitment(inputCommit)) continue;
      let predNewIndex = -1;
      let newSlot = '';
      for (let later = index + 1; later < builder.outputs.length; later++) {
        const output = builder.outputs[later];
        const lock = output.to instanceof Uint8Array ? output.to : undefined;
        if (!lock || lock.length !== twinLock.length) continue;
        if (!lock.every((byte, offset) => byte === twinLock[offset])) continue;
        if (output.token?.category !== category || output.token?.nft?.capability !== 'mutable') continue;
        const commit = commitHex(output.token.nft?.commitment as Uint8Array | string | undefined);
        if (commit === '' || commit === inputCommit) continue;
        const slot = (inputCommit.padEnd(SLOT_HEX, '0').slice(0, SLOT_HEX) || '0'.repeat(SLOT_HEX)).toLowerCase();
        if (commit.toLowerCase().startsWith(slot) && commit.length > SLOT_HEX) {
          predNewIndex = later;
          newSlot = commit.slice(SLOT_HEX, SLOT_HEX * 2);
          break;
        }
        if (newSlot === '' && isSortedEntryNodeCommitment(commit)) {
          newSlot = commit.slice(0, SLOT_HEX);
        }
      }
      const twinToken = cloneToken(input.token);
      if (twinToken.nft && newSlot) {
        const currentNew = builder.outputs[index];
        const currentNewCommitment = commitHex(
          currentNew?.token?.nft?.commitment as Uint8Array | string | undefined,
        );
        const plannedNewSlot = plannedInsert.newCommitment?.slice(0, SLOT_HEX) ?? newSlot;
        const currentIsMaterializedNew = currentNew?.token?.category === category
          && currentNew.token.nft?.capability === 'mutable'
          && currentNewCommitment.startsWith(plannedNewSlot);
        twinToken.nft = {
          ...twinToken.nft,
          commitment: currentIsMaterializedNew
            ? currentNewCommitment
            : plannedInsert.newCommitment ?? newSlot,
        };
      }
      const existing = builder.outputs[index];
      const existingLock = existing?.to instanceof Uint8Array ? existing.to : undefined;
      const sameLockMutable = !!existingLock
        && existingLock.length === twinLock.length
        && existingLock.every((byte, offset) => byte === twinLock[offset])
        && existing?.token?.nft?.capability === 'mutable'
        && existing.token.category === category;
      // Without a NEW slot there is no P' to apply. Leave a derived same-lock
      // occupant alone; only displace events/pads onto the input index.
      if (!newSlot && sameLockMutable) continue;
      const twin = {
        to: twinLock,
        amount: input.satoshis,
        token: twinToken,
      };
      const skipLocks: Uint8Array[] = [];
      for (const variable of this.loopEntryVars) {
        if (variable.collection === 'jobEvents' && variable.lockingBytecode.length > 0) {
          skipLocks.push(variable.lockingBytecode);
        }
      }
      for (const output of builder.outputs) {
        const lock = output.to instanceof Uint8Array ? output.to : undefined;
        if (!lock || lock.length !== 35 || lock[0] !== 0xaa) continue;
        if (output.token?.nft?.capability !== 'mutable') continue;
        const raw = output.token.nft?.commitment as Uint8Array | string | undefined;
        const hex = raw instanceof Uint8Array ? binToHex(raw) : (raw ?? '');
        if (hex.toLowerCase().includes('437265617465') || hex.toLowerCase().includes('57686974656c697374')) {
          skipLocks.push(lock);
        }
      }
      const reservedNew = plannedInsert.outputIndex;
      const twinOptions = {
        tailStart: Number.isFinite(tailStart) ? tailStart : suffixStart,
        suffixStart,
        reservedIndexes: [reservedNew],
        skipLocks,
      };
      if (!placeSameIndexTwin(builder.outputs, index, twin, twinOptions)) continue;
      if (newSlot) {
        placeInsertNewAt(builder.outputs, reservedNew, {
          to: twinLock,
          amount: 1200n,
          token: {
            amount: 0n,
            category,
            nft: {
              capability: 'mutable',
              commitment: plannedInsert.commitment ?? synthesizePredNewCommitment(inputCommit, newSlot),
            },
          },
        }, twinOptions);
      }
      if (predNewIndex >= 0 && predNewIndex !== index && predNewIndex !== reservedNew) {
        builder.outputs[predNewIndex] = { to: Uint8Array.of(0x51), amount: 1000n };
      }
      // INSERT is P'+NEW. A leftover empty HEAD clone at an earlier index
      // makes emitVerifyChunkUtxoCount see 3 vs expected 2.
      stripSurplusEmptyCollectionEntries(builder.outputs, twinLock, 2);
      for (let earlier = 0; earlier < index; earlier++) {
        const leftover = builder.outputs[earlier];
        if (!outputMatchesLock(leftover, twinLock)) continue;
        if (leftover.token?.nft?.capability !== 'mutable') continue;
        const leftoverCommit = commitHex(leftover.token.nft?.commitment as Uint8Array | string | undefined);
        if (!isSortedEntryHeadCommitment(leftoverCommit) && leftoverCommit.replace(/^0+/, '') !== '') {
          continue;
        }
        builder.outputs[earlier] = { to: Uint8Array.of(0x51), amount: 1000n };
      }
    }
  }

  /**
   * Recreate every participant's fixed data-NFT state at the coordinate authenticated by its input outpoint.
   * Later entry/event/tail materializers can temporarily occupy those coordinates, but fixed state retains
   * structural ownership. Derive commitments from the owner's layout and updates; commitment bytes are opaque
   * state, so neither ownership nor preservation may depend on application-specific prefixes.
   */
  private _reassertFixedStateOutputs(builder: TransactionBuilder): void {
    type FixedStateOwner = {
      categoryId: string;
      stateLayout: StateLayout;
      dataNftUtxos: readonly UnlockableUtxo[];
      requiredDataNftIndices: readonly number[];
      rawCommitments: ReadonlyMap<number, string>;
      updates?: ReadonlyMap<string, StateValue>;
      preserveUntouched: boolean;
    };
    const groupOwner = (group: ExternalCallUtxoGroup): FixedStateOwner => ({
      categoryId: group.categoryId,
      stateLayout: group.stateLayout,
      dataNftUtxos: group.dataNftUtxos,
      requiredDataNftIndices: group.requiredDataNftIndices,
      rawCommitments: this.externalCallStateRawCommitments.get(group.categoryId) ?? new Map(),
      updates: this.externalCallStateUpdates.get(group.categoryId),
      // Static/delegate implementation state is not written by the logical call; preserving its exact bytes is
      // both cheaper and avoids rebuilding compiler-owned registers which are intentionally absent from the ABI.
      preserveUntouched: true,
    });
    const owners: FixedStateOwner[] = [{
      categoryId: this.categoryId,
      stateLayout: this.stateLayout,
      dataNftUtxos: this.dataNftUtxos,
      requiredDataNftIndices: this.requiredNftIndices,
      rawCommitments: this.stateRawCommitments,
      updates: this.stateUpdates,
      // Mirror build(): the active participant's complete state is rebuilt after applying direct updates.
      preserveUntouched: false,
    }];
    owners.push(...this.externalOutStateUtxoGroups.map(groupOwner));
    owners.push(...this.externalCallUtxoGroups
      .filter((group) => group.sharedGroupIndex === undefined)
      .map(groupOwner));
    owners.push(...this.lowLevelCallUtxoGroups.map(groupOwner));

    const seenOutpoints = new Set<string>();
    for (const owner of owners) {
      const currentState: Record<string, StateValue> = {};
      for (const [ordinal, nftIndex] of owner.requiredDataNftIndices.entries()) {
        const commitment = owner.dataNftUtxos[ordinal]?.token?.nft?.commitment;
        if (!commitment) continue;
        Object.assign(currentState, parsePushdataCommitment(commitment, owner.stateLayout, nftIndex));
      }
      for (const [name, value] of owner.updates ?? []) currentState[name] = value;
      const updatedNames = new Set(owner.updates?.keys() ?? []);

      for (const [ordinal, nftUtxo] of owner.dataNftUtxos.entries()) {
        const outpoint = `${nftUtxo.txid.toLowerCase()}:${nftUtxo.vout}`;
        if (seenOutpoints.has(outpoint)) continue;
        seenOutpoints.add(outpoint);
        const inputIndex = this.allInputs.findIndex((input) => (
          input.txid.toLowerCase() === nftUtxo.txid.toLowerCase() && input.vout === nftUtxo.vout
        ));
        if (inputIndex < 0) continue;
        const input = this.allInputs[inputIndex];
        if (!('unlocker' in input) || !input.unlocker || !input.token?.nft) continue;
        const nftIndex = owner.requiredDataNftIndices[ordinal];
        if (nftIndex === undefined) continue;
        const inputCommitment = input.token.nft.commitment;
        const nftVariables = owner.stateLayout.variables.filter((variable) => variable.nftIndex === nftIndex);
        const hasUpdate = nftVariables.some((variable) => updatedNames.has(variable.name));
        const exactCommitment = owner.rawCommitments.get(nftIndex);
        const commitment = exactCommitment
          ?? (owner.preserveUntouched && !hasUpdate && inputCommitment
            ? inputCommitment
            : buildPushdataCommitment(
              owner.stateLayout,
              currentState,
              nftIndex,
              this.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
            ));
        builder.outputs[inputIndex] = {
          to: input.unlocker.generateLockingBytecode(),
          amount: input.satoshis,
          token: {
            amount: input.token.amount ?? 0n,
            category: owner.categoryId,
            nft: { capability: input.token.nft.capability, commitment },
          },
        };
      }
    }
  }

  /**
   * Reassert the chunkable writer's compiler-owned event coordinate after occupancy repairs.
   * Older artifacts without write metadata retain their historical event reconstruction below.
   */
  private _reassertNestedEmitEvents(builder: TransactionBuilder): void {
    const selectedWriter = this._chunkableValueWriteGroups();
    const proxyGroup = selectedWriter.external;
    const llcIndex = selectedWriter.lowLevelIndex;
    const llcGroup = selectedWriter.lowLevel;
    const eventSelection = selectCompilerWriterEvent(
      [proxyGroup, llcGroup].filter((group): group is ExternalCallUtxoGroup => group !== undefined),
    );
    if (eventSelection.status === 'ambiguous') return;
    const legacyEventFallback = eventSelection.status === 'absent'
      && !this._hasChunkableValueWriteMetadata();
    if (eventSelection.status === 'absent' && !legacyEventFallback) return;
    const publishFn = this._chunkableValueWriteAbi();
    const eventOffset = eventSelection.status === 'exact'
      ? eventSelection.slotOffset
      : publishFn?.blockLayout?.slots.find((slot) => slot.kind === 'event')?.offset ?? 4;
    const impl = this._chunkableValueWriteInputIndex();
    const dest = eventSelection.status === 'exact'
      ? (impl < 0 ? -1 : impl + eventOffset)
      : this._scaledEmitOutputIndex(builder.outputs.length)
        ?? publishJobEventOutputIndex(impl, eventOffset);
    const persistEmitEarly = this._shouldRematerializePersistUpdate();
    if (dest < 0 || (impl >= 0 && dest <= impl)) {
      if (!legacyEventFallback) return;
      const fallback = publishJobEventOutputIndex(impl, eventOffset);
      if (fallback >= 0) {
        relocateJobEventEmitToDest(builder.outputs, fallback, {
          consumedMutableOk: persistEmitEarly,
          preferCreated: this._rootIsPublishJobPost(),
        });
      }
      return;
    }
    const categoryId = eventSelection.status === 'exact'
      ? eventSelection.categoryId : this._jobEventsPublishCategory();
    const emitInfo = eventSelection.status === 'exact'
      ? { eventSignature: eventSelection.eventSignature }
      : publishFn?.emits?.[0];
    const derived = eventSelection.status === 'exact'
      ? eventSelection.eventOutput
      : proxyGroup?.eventOutputs?.[0]
        ?? llcGroup?.eventOutputs?.[0];
    const debugEventIndex = Number.parseInt(
      (globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_EVENT_INDEX ?? '',
      10,
    );
    if (debugEventIndex === dest) {
      console.error('stateful-nested-event-owner', {
        impl,
        dest,
        categoryId,
        selectedExternalGroup: proxyGroup && {
          index: this.externalCallUtxoGroups.indexOf(proxyGroup),
          categoryId: proxyGroup.categoryId,
          functionName: proxyGroup.functionName,
          logicalFunctionName: proxyGroup.logicalFunctionName,
          delegateCallGroupIndex: proxyGroup.delegateCallGroupIndex,
          route: proxyGroup.compilerRoute?.abiFunction.name,
        },
        selectedLowLevelGroup: llcIndex >= 0 ? {
          index: llcIndex,
          categoryId: this.lowLevelCallUtxoGroups[llcIndex].categoryId,
          functionName: this.lowLevelCallUtxoGroups[llcIndex].functionName,
          logicalFunctionName: this.lowLevelCallUtxoGroups[llcIndex].logicalFunctionName,
          route: this.lowLevelCallUtxoGroups[llcIndex].compilerRoute?.abiFunction.name,
        } : undefined,
        selectedWriterViews: [proxyGroup, llcGroup].filter((group) => group !== undefined).map((group) => ({
          categoryId: group.categoryId,
          functionName: group.functionName,
          logicalFunctionName: group.logicalFunctionName,
          delegateCallGroupIndex: group.delegateCallGroupIndex,
          sharedGroupIndex: group.sharedGroupIndex,
          route: group.compilerRoute?.abiFunction.name,
        })),
      });
    }
    if (!categoryId) return;
    const minting = this.findMintingInputIndex(categoryId);
    if (minting >= 0 && dest === minting) return;
    const addressType = proxyGroup?.externalContract?.inner?.addressType
      ?? (llcIndex >= 0 ? this.lowLevelCallUtxoGroups[llcIndex].externalContract?.inner?.addressType : undefined)
      ?? 'p2sh32';
    const emitSignature = emitInfo?.eventSignature
      ?? (legacyEventFallback ? 'JobEvent(uint256,JobEventData)' : undefined);
    if (!emitSignature) return;
    const lockingBytecode = derived?.lockingBytecode ?? scriptToLockingBytecode(
      buildEventNftCovenantScript(hexToBin(categoryId), computeEventNameHash(emitSignature)), addressType,
    );
    let constructedCommit: string | undefined;
    if (legacyEventFallback) {
      const visibleArgs = proxyGroup?.logicalFunctionArgs ?? proxyGroup?.functionArgs
        ?? (llcIndex >= 0
          ? this.lowLevelCallUtxoGroups[llcIndex].logicalFunctionArgs
            ?? this.lowLevelCallUtxoGroups[llcIndex].functionArgs
          : undefined);
      const structs = proxyGroup?.externalContract?.inner?.artifact?.structs
        ?? (llcIndex >= 0
          ? this.lowLevelCallUtxoGroups[llcIndex].externalContract?.inner?.artifact?.structs
          : undefined);
      const now = BigInt((this.builderOptions.provider as { getBlockTime?: () => number })
        .getBlockTime?.() ?? 0);
      const eventType = visibleArgs && visibleArgs.length >= 2
        ? jobEventTypeOf(visibleArgs[1]) : undefined;
      const emptyAddressEvent = eventType !== undefined
        && (Array.isArray(visibleArgs![1])
          ? jobEventFieldEmpty(visibleArgs![1][1])
          : jobEventFieldEmpty((visibleArgs![1] as { address_?: unknown }).address_));
      // Compatibility for the historical timestamped event encoding, before traces published exact outputs.
      const stampWithdraw = emptyAddressEvent && eventType === 16 && now > 0n;
      const emitEvent = stampWithdraw
        ? stampEmptyJobEventTimestamp(visibleArgs![1], now)
        : visibleArgs?.[1];
      constructedCommit = emptyAddressEvent && emitEvent !== undefined
        ? encodeJobEventEmitCommitment(visibleArgs![0], emitEvent, structs)
        : undefined;
    }
    const eventCommitment = constructedCommit ?? derived?.commitment;
    if (!legacyEventFallback && !eventCommitment) return;
    const persistEmit = this._shouldRematerializePersistUpdate();
    const placed = placePublishJobEventOutput(builder.outputs, dest, {
      to: lockingBytecode,
      amount: 1200n,
      token: {
        amount: 0n,
        category: categoryId,
        nft: { capability: 'none', commitment: eventCommitment ?? '' },
      },
    }, {
      clearClonedStub: legacyEventFallback && persistEmit,
      refuseEmpty: legacyEventFallback && persistEmit && !constructedCommit,
      consumedMutableOk: legacyEventFallback && persistEmit,
      destInput: this.allInputs[dest],
    });
    if (!placed && !legacyEventFallback) return;
    if (persistEmit && dest >= 0) {
      this.forcedJobEventsBandStart = dest + 1;
      this._placeJobEventsPredecessorInputs(this.pendingJobEventsPredecessors);
      this._materializeJobEventsBand(builder);
      this._reassertPersistedJobEventsOneToOnes(builder, dest);
    }
    const executingDest = legacyEventFallback && dest >= 0
      ? dest
      : legacyEventFallback
        ? publishJobEventOutputIndex(this._chunkableValueWriteInputIndex(), eventOffset)
        : -1;
    if (legacyEventFallback && executingDest >= 0) {
      relocateJobEventEmitToDest(builder.outputs, executingDest, {
        consumedMutableOk: persistEmit,
        preferCreated: this._rootIsPublishJobPost(),
      });
    }
  }

  /**
   * Implementation emit verification is `OP_INPUTINDEX + event.offset`. Move a
   * parked VersionChanged / Paused NFT from the proxy event band onto that dest.
   */
  private _reassertDelegateImplEvents(builder: TransactionBuilder): void {
    const claims: DelegateEventClaim[] = [];
    const commitmentHex = (value: unknown): string => (
      value instanceof Uint8Array ? binToHex(value) : String(value ?? '').toLowerCase()
    );
    for (const [groupIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
      if (group.callMode !== 'delegatecall') continue;
      const fn = group.compilerRoute?.abiFunction
        ?? (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
          .find((candidate) => candidate.name === (group.logicalFunctionName ?? group.functionName));
      const implIndex = this.getLowLevelCallMasterInputIndex(groupIndex);
      if (implIndex < 0) continue;
      const proxyGroup = this.externalCallUtxoGroups.find((candidate) => (
        candidate.delegateCallGroupIndex === groupIndex
      ));
      const eventSlots = fn?.blockLayout?.slots.filter((slot) => slot.kind === 'event') ?? [];
      for (const [eventOrdinal, eventSlot] of eventSlots.entries()) {
        const emitInfo = fn?.emits?.[eventOrdinal];
        if (!emitInfo) continue;
        const dest = implIndex + eventSlot.offset;
        const existing = builder.outputs[dest];
        // Delegate bytecode executes against its associated proxy's storage/category. Output contents are not
        // ownership evidence: a none-cap OP_TRUE return witness can legitimately occupy another delegate's same
        // relative slot. Inferring the category from that occupant promotes the witness into a duplicate event,
        // which the implementation's event-uniqueness epilogue correctly rejects.
        const executionCategory = proxyGroup?.categoryId;
        // Top-level proxy calls already project their event frame through the builder's own block layout. This
        // repair is only for a nested execution category; otherwise reserved union slots could activate
        // inactive initialization ordinals.
        if (!executionCategory || executionCategory === this.categoryId) continue;
        const locking = scriptToLockingBytecode(
          buildEventNftCovenantScript(
            hexToBin(executionCategory), computeEventNameHash(emitInfo.eventSignature),
          ),
          group.externalContract.inner.addressType,
        );
        const learned = group.eventOutputs?.[eventOrdinal] ?? proxyGroup?.eventOutputs?.[eventOrdinal];
        const existingCommitment = commitmentHex(existing?.token?.nft?.commitment);
        const physicalEventIsMaterialized = existing?.token?.category === executionCategory
          && existing.token.nft?.capability === 'none'
          && existingCommitment !== '' && !/^0+$/.test(existingCommitment)
          && !isScidIdentityCommitment(existingCommitment);
        // The exact physical slot belongs to this transaction and outranks cached derivation output, which can
        // describe an earlier invocation of a repeated route. The cache is only a fallback when the slot has not
        // yet been materialized.
        let commitment = physicalEventIsMaterialized
          ? existingCommitment : (learned ? commitmentHex(learned.commitment) : undefined);
        if (!commitment || /^0*$/.test(commitment) || isScidIdentityCommitment(commitment)) continue;
        while (builder.outputs.length <= dest) {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
        }
        if (builder.outputs[dest]?.token?.nft?.capability === 'minting') continue;
        builder.outputs[dest] = {
          to: locking,
          amount: 1200n,
          token: {
            amount: 0n,
            category: executionCategory,
            nft: { capability: 'none', commitment },
          },
        };
        claims.push({
          destination: dest,
          categoryId: executionCategory,
          lockingBytecode: locking,
          commitment,
        });
      }
    }
    demoteUnclaimedDelegateEventClones(builder.outputs, claims);
  }

  /** Persist UPDATE predecessors are mutable value-chunks, not data-NFT twins. */
  private _reassertPersistedJobEventsOneToOnes(builder: TransactionBuilder, emitDest: number): void {
    // A compiler-owned delegate route assigns every physical output in its balanced block. Legacy
    // persistence recovery infers ownership from input shape and cached collection state, so it must
    // never rewrite those declared outputs. Any required predecessor or value-chunk recreation is
    // represented by the route's entry/chunk slots and handled by their ordinary materializers.
    if (this.compilerRouteDelegateBlock || this.preserveBlockLayoutWidth) return;
    const eventDestinations = new Set(this._emitDestinationIndices());
    if (emitDest >= 0) eventDestinations.add(emitDest);
    const destCategory = emitDest >= 0 && builder.outputs[emitDest]?.token?.category
      ? String(builder.outputs[emitDest]!.token!.category)
      : this._jobEventsPublishCategory();
    const categoryId = destCategory ?? this._jobEventsPublishCategory();
    const persistLockCategory = this._persistJobEventsTokenCategory() ?? categoryId;
    const persistLock = (persistLockCategory ? persistedJobEventsLock(persistLockCategory) : undefined)
      ?? this.jobEventsRedeemLock;
    const replayCategories = new Set([categoryId, persistLockCategory].filter(
      (candidate): candidate is string => candidate !== undefined,
    ));
    const persistDests = new Set(persistUpdatePredecessorDests({
      implIndex: this._chunkableValueWriteInputIndex(),
      persistUpdate: isPersistedJobEventsReady() && !this._rootIsPublishJobPost(),
      keepAtLayout: shouldKeepPersistAtLayoutBase({
        persistReady: isPersistedJobEventsReady(),
        firstPublish: this._rootIsPublishJobPost(),
        layoutDestOccupiedByMintingWriter: this.hasMintingBandTokenWriter(),
      }),
      bandStart: this.getPublishJobEventsBand()?.start ?? -1,
      nNew: this.getPublishJobEventsBand()?.nNew ?? 0,
    }));
    const persistRecipeLock = persistUpdateDigestLock(
      this._persistJobEventsTokenCategory() ?? categoryId,
      this._persistDigestCategories(),
      this._persistedValueChunkWrite(this._persistJobEventsTokenCategory() ?? categoryId),
    );
    for (const [index, input] of this.allInputs.entries()) {
      const commit = String(input?.token?.nft?.commitment ?? '');
      const persistShaped = commit.length >= 64 && !isDataNftIndexCommitment(commit);
      // Compiler event slots and mutable-input conservation are independent layout owners. Once an event slot is
      // materially populated, a late conservation pass cannot infer ownership from the same-index input and replace
      // it. Empty/zero/SCID placeholders remain available so persistence can still fill genuinely vacant slots.
      if (eventDestinations.has(index)
        && isMaterializedImmutableNftOutput(builder.outputs[index])) continue;
      if (index === emitDest && !persistShaped) continue;
      if (input?.token?.nft?.capability !== 'mutable') continue;
      const declaredOwner = this._declaredExternalOutputSlotOwner(index);
      // Physical input padding is not output ownership. A balanced participant can use a foreign mutable UTXO
      // as the funding/input occupant of a compiler-declared slot; the participant's layout and category still
      // own the corresponding output. Conservation passes must not replay that occupant across the boundary.
      if (declaredOwner) {
        if (!replayCategories.has(declaredOwner.categoryId)) continue;
        const declaredLock = declaredOwner.slot.kind === 'entry'
          ? this._externalEntryLockingBytecode(declaredOwner.group, declaredOwner.slot)
          : undefined;
        const inputLock = input.unlocker?.generateLockingBytecode();
        const inputOwnsSlot = declaredOwner.categoryId === input.token.category
          && (declaredLock === undefined || (inputLock !== undefined
            && declaredLock.length === inputLock.length
            && declaredLock.every((byte, offset) => byte === inputLock[offset])));
        if (!inputOwnsSlot) continue;
      }
      const liveBand = this.getPublishJobEventsBand();
      // An UPDATE can deliberately place an old predecessor input at the same
      // coordinate as the new value's chunk 0. The predecessor still
      // authorizes the spend, but its one-to-one recreation must not replace
      // the newly authenticated chunk (whose root-addressed lock changed). The
      // live band is the layout authority; derivation caches can be cleared or
      // re-keyed by a later participant repair without vacating that band.
      if (liveBand && index >= liveBand.start && index <= liveBand.end) continue;
      const chunk0Dest = persistValueChunkBase(this._chunkableValueWriteInputIndex(), 5);
      const forceChunk0 = index === chunk0Dest
        && !this._rootIsPublishJobPost()
        && isPersistValueChunkCommitment(commit);
      if ((persistRecipeLock && persistDests.has(index) && !this._rootIsPublishJobPost())
        || forceChunk0) {
        const existing = builder.outputs[index];
        if ((existing?.token?.nft?.capability === 'mutable'
          && (existing.token.category === input.token?.category
            || isPersistValueChunkCommitment(commit)))
          || forceChunk0) {
          const persistCat = this._persistJobEventsTokenCategory() ?? input.token?.category ?? categoryId;
          const persistValue = latestPersisted(stagedJobEventsValues)
            ?? latestPersisted(persistedJobEventsValues)
            ?? (persistCat ? persistedJobEventsValue(persistCat) : undefined);
          const destOffset = [...persistDests].sort((left, right) => left - right).indexOf(index);
          const inputLock = input.unlocker?.generateLockingBytecode();
          const publishCategory = this._jobEventsPublishCategory();
          const inputCategory = input.token?.category ?? persistCat;
          const persistVLock = persistValueChunkLock(
            publishCategory, persistValue, this._persistedValueChunkWrite(publishCategory),
          )
            ?? persistValueChunkLock(
              persistLockCategory, persistValue,
              this._persistedValueChunkWrite(persistLockCategory),
            )
            ?? persistValueChunkLock(
              inputCategory, persistValue, this._persistedValueChunkWrite(inputCategory),
            )
            ?? persistLock;
          const destLock = index === chunk0Dest
            ? (persistVLock ?? persistLock)
            : persistUpdateDestLock({
              destOffset,
              entryLock: persistRecipeLock,
              persistLock: persistVLock,
              inputLock: inputLock && inputLock.length === 35 && inputLock[0] === 0xaa
                ? inputLock : undefined,
            });
          const persistChunks = persistValue
            ? chunksFromJobEventsValue(persistValue, destLock ?? persistRecipeLock, persistCat) : [];
          // The entry carries the same authenticated chunkable-value header as every sorted mapping:
          // len4 || root32 || head28 for a long value. Continuations stay uint16-le value chunks.
          const persistChunk = destOffset === 0 && persistValue
            ? {
              commitment: binToHex(encodeEntryCommitment(
                keyToSlot(new Uint8Array()),
                new Uint8Array(32),
                encodeChunkableValueTail(persistValue),
              )),
            }
            : (destOffset > 0 ? persistChunks[destOffset - 1] : undefined);
          const existingLock = existing?.to instanceof Uint8Array ? existing.to : undefined;
          const nextCommit = persistChunk?.commitment ?? existing?.token?.nft?.commitment
            ?? input.token?.nft?.commitment;
          const nextLock = destLock ?? persistRecipeLock;
          if (nextLock && (!existingLock || binToHex(existingLock) !== binToHex(nextLock)
            || String(existing?.token?.nft?.commitment ?? '') !== String(nextCommit ?? ''))) {
            const baseToken = existing?.token ?? input.token;
            builder.outputs[index] = {
              to: nextLock,
              amount: existing?.amount ?? input.satoshis,
              token: persistChunk && baseToken
                ? {
                  ...cloneToken(baseToken),
                  nft: { capability: 'mutable', commitment: persistChunk.commitment },
                }
                : baseToken,
            };
          }

          continue;
        }
      }
      const sameCategory = !!categoryId && input.token?.category === categoryId;
      if (!sameCategory && !persistShaped) continue;
      const predecessor = this.pendingJobEventsPredecessors.find((candidate) =>
        candidate.txid === input.txid && candidate.vout === input.vout);
      const digestCategory = input.token?.category ?? categoryId;
      const digestLock = persistUpdateRedeemLock(
        digestCategory, this.jobEventsRedeemLock, this._persistedValueChunkWrite(digestCategory),
      );
      const chunkIndex = valueChunkIndexFromCommitment(commit);
      // Only long persist jobEvents chunks (Created `00004cb4…` / continuations).
      // Short `0000…` data-NFT heads (jobs, users) must keep their own lock.
      const isPersistValueChunk = chunkIndex !== undefined
        && commit.length >= 24
        && (sameCategory || persistShaped);
      const rematerialize = this._shouldRematerializePersistUpdate();
      const stampDigest = this._shouldStampPersistUpdateDigestLock();
      const band = this.getPublishJobEventsBand();
      const inWriteBand = !!band && index >= band.start && index <= band.end;
      // INSERT / whitelist must not restamp persist `v` onto dest. UPDATE
      // dest-18 persist EQUALVERIFYs the Created-digest lock even when the
      // live band starts at dest 20.
      if (isPersistValueChunk && inWriteBand && !rematerialize && !stampDigest) continue;
      const recipeLock = stampDigest
        ? persistUpdateDigestLock(
          this._persistJobEventsTokenCategory() ?? input.token?.category ?? categoryId,
          this._persistDigestCategories(),
          this._persistedValueChunkWrite(
            this._persistJobEventsTokenCategory() ?? input.token?.category ?? categoryId,
          ),
        )
        : persistRecipeLock;
      const lock = ((persistDests.has(index) && persistRecipeLock)
        || (isPersistValueChunk && ((rematerialize && digestLock) || recipeLock)))
        ? (persistRecipeLock ?? recipeLock ?? digestLock)
        : ((('unlocker' in input && input.unlocker)
          ? input.unlocker.generateLockingBytecode()
          : undefined)
          ?? predecessor?.unlocker?.generateLockingBytecode()
          ?? persistLock);
      if (!lock || lock.length !== 35 || lock[0] !== 0xaa) continue;
      const persistValue = isPersistValueChunk && rematerialize
        ? persistedJobEventsValue(input.token?.category ?? categoryId ?? '')
        : undefined;
      const persistChunk = persistValue && chunkIndex !== undefined
        ? chunksFromJobEventsValue(persistValue, lock, input.token?.category)[chunkIndex]
        : undefined;
      const token = persistChunk
        ? {
          ...cloneToken(input.token),
          nft: { capability: 'mutable' as const, commitment: persistChunk.commitment },
        }
        : cloneToken(input.token);
      const existing = builder.outputs[index];
      const existingLock = existing?.to instanceof Uint8Array ? existing.to : undefined;
      const missingTwin = !existing?.token
        || existing.token.category !== input.token?.category
        || existing.token.nft?.capability !== 'mutable';
      const lockChanged = existingLock !== undefined && binToHex(existingLock) !== binToHex(lock);
      const commitChanged = persistChunk !== undefined
        && String(existing?.token?.nft?.commitment ?? '') !== persistChunk.commitment;
      if (!missingTwin && !lockChanged && !commitChanged) continue;
      builder.outputs[index] = {
        to: lock,
        amount: input.satoshis,
        token,
      };
    }
  }

  /** Restore planned delegate loop commitments at their compiler-owned coordinates without shifting later rows. */
  private _reassertDelegateLoopEntries(builder: TransactionBuilder): void {
    const delegateLoopVars = this._delegateLoopEntryVars();
    if (delegateLoopVars.length === 0) return;
    const delegateFunction = (group: ExternalCallUtxoGroup): AbiFunction | undefined => (
      group.compilerRoute?.abiFunction
      ?? (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
        .find((candidate) => candidate.name === group.functionName)
    );
    const delegateGroupIndex = this.lowLevelCallUtxoGroups.findIndex((group) => group.callMode === 'delegatecall'
      && (delegateFunction(group)?.sortedUpsertLoopInfo?.length ?? 0) > 0);
    const delegateGroup = delegateGroupIndex < 0 ? undefined : this.lowLevelCallUtxoGroups[delegateGroupIndex];
    const delegateAbiFunction = delegateGroup === undefined ? undefined : delegateFunction(delegateGroup);
    const delegateMaster = delegateGroup?.masterUtxo as UnlockableUtxo | undefined;
    const delegateOutputIndex = delegateMaster ? builder.outputs.findIndex((output) => (
      binToHex(typeof output.to === 'string' ? addressToLockScript(output.to) : output.to)
        === binToHex(delegateMaster.unlocker.generateLockingBytecode())
      && output.token?.category === delegateMaster.token?.category
    )) : -1;
    const delegateBase = delegateOutputIndex >= 0 ? delegateOutputIndex
      : this.blockLayout?.slots.find((slot) => slot.kind === 'lowLevelCall')?.offset;
    let outputIndex = this.compilerRouteDelegateBlock
      ? this.getLoopEntryOutputBase()
      : delegateBase !== undefined
        ? delegateBase + (delegateAbiFunction?.blockLayout?.blockSize ?? 1)
        : this.getLoopEntryOutputBase();
    if (!this.compilerRouteDelegateBlock) {
      outputIndex += this.iterationEntryInputs.length + this.dynamicChunkInputs.length
        + this.trailingDisposalInputs.length;
    }
    for (const lv of delegateLoopVars) {
      for (const commitment of this.loopEntryCommitments.get(lv.collection) ?? []) {
        if (commitment === '' || commitment === '00') continue;
        while (outputIndex >= builder.outputs.length) {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
        }
        const occupant = builder.outputs[outputIndex];
        const occupantCommit = String(occupant?.token?.nft?.commitment ?? '');
        if (occupantCommit.toLowerCase() === commitment.toLowerCase()
          && occupant?.token?.category === lv.categoryId) {
          outputIndex += 1;
          continue;
        }
        const entryOutput = {
          to: lv.lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: lv.categoryId!,
            nft: { capability: 'mutable' as const, commitment },
          },
        };
        entryOutput.amount = this._loopEntryTransitionSatoshis(lv, commitment)
          ?? BigInt(Math.max(1200, calculateDust(entryOutput)));
        builder.outputs[outputIndex] = entryOutput;
        outputIndex += 1;
      }
    }
  }

  /**
   * View tails are OP_TRUE + none-cap return NFTs. Token-swap placement already
   * parks them after FakeToken; without a swap, jobEvents mutables still occupy
   * the first planned tail slots. Write the pending views after that writer band
   * and leave collection/jobs coordinates unmoved.
   */
  private _writeViewTailsAfterWriterOccupancy(
    builder: TransactionBuilder,
    returnOutputRefs?: Map<string, Output>,
  ): void {
    const tailReturns = this.tailReturnEventOutputs();
    if (tailReturns.length === 0) return;
    const jobsCountForPack = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    const packOptions: ViewTailPackOptions = {
      band: this.getPublishJobEventsBand(),
      suffixStart: jobsCountForPack > 0
        ? builder.outputs.length - jobsCountForPack - 1
        : Math.max(0, this.allInputs.length - 1),
      tokenWriterPresent: this.externalCallUtxoGroups.some((group) =>
        isMintingBandSwapFunction(group.functionName ?? group.compilerRoute?.abiFunction.name)),
    };
    const planned = packTailReturnPlacements(
      this.externalCallUtxoGroups,
      (categoryId) => this.findMintingInputIndex(categoryId),
      tailReturns,
      '',
      -1,
      packOptions,
    );
    const plannedIndices = [...planned.values()];
    const derivedHit = plannedIndices.some((index) => this.derivedChunkOutputs.has(index));
    const derivedEnd = derivedHit
      ? [...this.derivedChunkOutputs.keys()].reduce((max, index) => Math.max(max, index), -1)
      : -1;
    const writerEnd = Math.max(
      lastCollidingMutableWriterIndex(builder.outputs, plannedIndices),
      derivedEnd,
    );
    const jobsCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    const suffixStart = jobsCount > 0
      ? builder.outputs.length - jobsCount - 1
      : builder.outputs.length;
    const reserved = new Set<number>();
    for (const [index, input] of this.allInputs.entries()) {
      const cap = input.token?.nft?.capability;
      if (cap === 'minting' || cap === 'mutable') reserved.add(index);
    }
    for (const index of this.derivedChunkOutputs.keys()) reserved.add(index);
    const padDestinations = writerEnd >= 0
      ? findViewTailDestinations(builder.outputs, tailReturns.length, {
        suffixStart, reserved, preferBefore: writerEnd,
      })
      : [];
    const placements = new Map(planned);
    if (padDestinations.length === tailReturns.length) {
      const orderedIdentities = tailReturns.map((event) => event.identity);
      for (const [offset, identity] of orderedIdentities.entries()) {
        const plannedIndex = planned.get(identity) ?? padDestinations[offset];
        placements.set(identity, clampViewTailPlacement({
          planned: plannedIndex,
          packed: padDestinations[offset],
          band: packOptions.band,
          suffixStart: packOptions.suffixStart,
          tokenWriterPresent: packOptions.tokenWriterPresent,
        }));
      }
    } else if (writerEnd >= 0) {
      const packed = packTailReturnPlacements(
        this.externalCallUtxoGroups,
        (categoryId) => this.findMintingInputIndex(categoryId),
        tailReturns,
        '',
        writerEnd,
        packOptions,
      );
      for (const [identity, index] of packed) placements.set(identity, index);
    }
    const placementRank = (event: (typeof tailReturns)[number]): number => (
      placements.get(event.identity)
        ?? placements.get(`${event.identity}:0`)
        ?? Number.MAX_SAFE_INTEGER
    );
    const orderedTails = tailReturns
      .map((event, index) => ({ event, index }))
      .sort((left, right) => placementRank(left.event) - placementRank(right.event) || left.index - right.index);
    const writerReturnSlots = new Set<number>();
    for (const [groupIdx, group] of this.externalCallUtxoGroups.entries()) {
      if (!groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, groupIdx)) continue;
      const physical = this.externalCallUtxoGroups[group.sharedGroupIndex ?? groupIdx];
      const master = this.findMintingInputIndex(physical.categoryId);
      const returnSlot = physical.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
      if (master >= 0 && returnSlot) writerReturnSlots.add(master + returnSlot.offset);
      const placed = group.plannedReturnOutputIndex ?? group.returnOutputIndex;
      if (placed !== undefined) writerReturnSlots.add(placed);
    }
    for (const index of this._declaredMutableEntrySlotIndices()) writerReturnSlots.add(index);
    for (const { event } of orderedTails) {
      const outputIndex = placementRank(event);
      if (outputIndex === Number.MAX_SAFE_INTEGER || outputIndex >= suffixStart) continue;
      if (writerReturnSlots.has(outputIndex)) continue;
      const occupant = builder.outputs[outputIndex];
      if (occupant?.token?.nft?.capability === 'mutable') continue;
      if (isScidIdentityCommitment(occupant?.token?.nft?.commitment)) continue;
      while (outputIndex >= builder.outputs.length) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
      }
      const rawCommitment = binToHex(event.commitment);
      const commitment = rawCommitment === '' ? '0101' : rawCommitment;
      const output: Output = {
        to: Uint8Array.of(0x51),
        amount: 800n,
        token: {
          amount: 0n,
          category: event.categoryId,
          nft: { capability: 'none', commitment },
        },
      };
      builder.outputs[outputIndex] = output;
      returnOutputRefs?.set(event.identity, output);
      const match = /^external-call:(\d+)/.exec(event.identity);
      if (match) {
        const group = this.externalCallUtxoGroups[Number(match[1])];
        if (group && !groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, Number(match[1]))) {
          group.returnOutputIndex = outputIndex;
        }
      }
    }
    this._vacateViewTailsFromJobEventsBand(builder);
    this._restoreDeclaredMutableEntrySlots(builder);
    this._reassertInBlockWriterReturns(builder);
  }

  /**
   * The in-block FakeToken return is OP_TRUE + none-cap at master+returnSlot.
   * JobEvents change-relocation used to splice a leftover p2sh32 onto that
   * index (3-wide band → output 31). Restore the witnessed return without
   * shifting later view tails: swap with a disposable pad after occupancy.
   */
  private _reassertInBlockWriterReturns(builder: TransactionBuilder): void {
    const occupancyEnd = writerBlockOccupancyEnd(
      this.externalCallUtxoGroups,
      (categoryId) => this.findMintingInputIndex(categoryId),
    );
    for (const [groupIdx, group] of this.externalCallUtxoGroups.entries()) {
      if (!groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, groupIdx)) continue;
      const physical = this.externalCallUtxoGroups[group.sharedGroupIndex ?? groupIdx];
      const master = this.findMintingInputIndex(physical.categoryId);
      const returnSlot = physical.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
      if (master < 0 || returnSlot === undefined) continue;
      const band = this.getPublishJobEventsBand();
      const outputIndex = tokenWriterReturnIndex(
        master, physical.blockLayout, band,
        this.tokenWriterOccupancy(master, builder.outputs),
      );
      this._bindWriterReturnWitness(groupIdx, outputIndex, builder);
      const occupant = builder.outputs[outputIndex];
      const identity = `external-call:${group.fusedReturnGroupIndex ?? groupIdx}`;
      const pending = this.pendingReturnEventOutputs.find((event) =>
        event.identity === identity || event.identity === `${identity}:0`);
      const writerAbi = physical.compilerRoute?.abiFunction
        ?? (physical.externalContract?.inner?.artifact?.abi as AbiFunction[] | undefined)
          ?.find((fn) => fn.name === (physical.functionName ?? physical.logicalFunctionName));
      const commitment = canonicalWriterReturnCommitment({
        pendingHex: pending && pending.commitment.length > 0
          ? binToHex(pending.commitment)
          : String(occupant?.token?.nft?.commitment ?? ''),
        writesState: writerAbi?.writesState === true,
        evmBool: artifactUsesSolidityAbi(physical.externalContract?.inner?.artifact ?? {}),
        returnsBool: writerAbi?.outputs?.length === 1 && writerAbi.outputs[0].type === 'bool',
      });
      if (isViewReturnTailOutput({
        to: occupant?.to instanceof Uint8Array ? occupant.to : undefined,
        token: occupant?.token,
      }) && occupant?.token?.category === physical.categoryId
        && String(occupant.token?.nft?.commitment ?? '').toLowerCase() === commitment) {
        continue;
      }
      const returnOutput: Output = {
        to: Uint8Array.of(0x51),
        amount: 800n,
        token: {
          amount: 0n,
          category: physical.categoryId,
          nft: { capability: 'none', commitment },
        },
      };
      if (occupant && !isDisposableAlignmentPad({
        to: occupant.to instanceof Uint8Array ? occupant.to : undefined,
        token: occupant.token,
      }) && !isViewReturnTailOutput({
        to: occupant.to instanceof Uint8Array ? occupant.to : undefined,
        token: occupant.token,
      }) && !hasEquivalentMutableNftOutput(builder.outputs, outputIndex)) {
        let dest = Math.max(occupancyEnd, outputIndex + 1);
        while (dest < builder.outputs.length && builder.outputs[dest]?.token) dest += 1;
        if (dest < builder.outputs.length && isDisposableAlignmentPad({
          to: builder.outputs[dest]?.to instanceof Uint8Array
            ? builder.outputs[dest]!.to as Uint8Array : undefined,
          token: builder.outputs[dest]?.token,
        })) {
          builder.outputs[dest] = occupant;
        } else {
          relocateChangeAfterOccupancy(builder.outputs, occupant, dest, occupancyEnd);
        }
      }
      while (outputIndex >= builder.outputs.length) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
      }
      builder.outputs[outputIndex] = returnOutput;
      group.returnOutputIndex = outputIndex;
    }
  }

  /**
   * Keep the unlocking witnesses and the materialized return output on one coordinate.
   * Input assembly can relocate a token block after the caller first encoded its
   * return index; refresh every exact carrier of that logical writer without moving
   * unrelated view returns which merely share the same physical token group.
   */
  private _bindWriterReturnWitness(
    writerGroupIndex: number,
    outputIndex: number,
    builder: TransactionBuilder,
  ): void {
    const writer = this.externalCallUtxoGroups[writerGroupIndex];
    if (!writer) return;
    const physicalIndex = writer.sharedGroupIndex ?? writerGroupIndex;
    const physical = this.externalCallUtxoGroups[physicalIndex];
    if (!physical) return;
    const changed = writer.returnOutputIndex !== outputIndex
      || physical.returnOutputIndex !== outputIndex;
    if (!changed) return;

    writer.returnOutputIndex = outputIndex;
    physical.returnOutputIndex = outputIndex;
    physical.refreshInternalArgs?.(
      { __internal__returnOutputIdx: BigInt(outputIndex) },
      { shiftPredOut: false },
    );

    const witnessOwners = new Set([physicalIndex, writerGroupIndex]);
    const carriers = [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups];
    for (const carrier of carriers) {
      if (!carrier.returnWitnessGroups || !carrier.refreshInternalArgs) continue;
      const updates: Record<string, bigint> = {};
      for (const [name, owner] of Object.entries(carrier.returnWitnessGroups)) {
        if (!witnessOwners.has(owner)) continue;
        if (carrier.internalArgs?.[name] === BigInt(outputIndex)) continue;
        updates[name] = BigInt(outputIndex);
      }
      if (Object.keys(updates).length > 0) carrier.refreshInternalArgs(updates, { shiftPredOut: false });
    }

    // refreshInternalArgs replaces group-owned UTXO objects. Mirror those replacements into the already
    // flattened input list, then update this build's TransactionBuilder in place.
    for (const carrier of new Set([physical, ...carriers])) {
      const master = carrier.masterUtxo as UnlockableUtxo | undefined;
      if (!master?.unlocker) continue;
      const index = this.allInputs.findIndex((input) => input.txid.toLowerCase() === master.txid.toLowerCase()
        && input.vout === master.vout);
      if (index >= 0) this.allInputs[index] = master;
    }
    this._syncBuilderUnlockers(builder);
  }

  /** Compiler-declared entries preserve input/output coordinates one-to-one. */
  private _declaredMutableEntrySlots(): Array<{ outputIndex: number; inputIndex: number }> {
    const slots = new Set<number>();
    const addLayout = (
      masterIndex: number,
      layout: FunctionBlockLayout | undefined,
      ownerCategoryId: string | undefined,
      expectedLockForSlot?: (slot: FunctionBlockLayout['slots'][number]) => Uint8Array | undefined,
    ): void => {
      if (masterIndex < 0 || !layout) return;
      for (const slot of layout.slots) {
        if (slot.kind !== 'entry') continue;
        const index = masterIndex + slot.offset;
        const input = this.allInputs[index];
        const expectedLock = expectedLockForSlot?.(slot);
        const inputLock = input?.unlocker?.generateLockingBytecode();
        if (input?.token?.nft?.capability === 'mutable' && input.unlocker
          && (ownerCategoryId === undefined || input.token.category === ownerCategoryId)
          && (expectedLock === undefined || (inputLock !== undefined
            && expectedLock.length === inputLock.length
            && expectedLock.every((byte, offset) => byte === inputLock[offset])))) {
          slots.add(index);
        }
      }
    };
    const rootIndex = this.allInputs.findIndex((input) => input.txid.toLowerCase() === this.masterUtxo.txid.toLowerCase()
      && input.vout === this.masterUtxo.vout);
    addLayout(rootIndex, this.blockLayout, this.categoryId);
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined) continue;
      addLayout(
        this.getExternalCallOutputBase(groupIndex),
        group.blockLayout ?? group.compilerRoute?.abiFunction?.blockLayout,
        group.categoryId,
        (slot) => this._externalEntryLockingBytecode(group, slot),
      );
    }
    for (const [groupIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
      const fn = group.compilerRoute?.abiFunction
        ?? group.externalContract?.inner?.artifact.abi.find((candidate: AbiFunction) =>
          candidate.name === (group.logicalFunctionName ?? group.functionName));
      const proxyOwner = this.externalCallUtxoGroups.find((candidate) => (
        candidate.delegateCallGroupIndex === groupIndex
      ));
      addLayout(
        this.getLowLevelCallMasterInputIndex(groupIndex),
        fn?.blockLayout ?? group.blockLayout,
        proxyOwner?.categoryId ?? group.categoryId,
      );
    }
    return [...slots]
      .sort((left, right) => left - right)
      .map((index) => ({ outputIndex: index, inputIndex: index }));
  }

  private _declaredMutableEntrySlotIndices(): number[] {
    return this._declaredMutableEntrySlots().map(({ outputIndex }) => outputIndex);
  }

  /** Output-only collection coordinates which duplicate cleanup must not reclaim while they are provisional. */
  private _compilerOwnedTrailingEntryOutputIndices(): Set<number> {
    const indices = new Set<number>();
    const add = (base: number, group: ExternalCallUtxoGroup): void => {
      if (base < 0) return;
      for (const planned of group.plannedEntryInserts ?? []) {
        if (planned.outputBlockSlot >= 0) indices.add(base + planned.outputBlockSlot);
      }
      for (const predecessor of group.batchPredecessorOutputs ?? []) {
        if (predecessor.outputBlockSlot >= 0) indices.add(base + predecessor.outputBlockSlot);
      }
    };
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined || group.delegateCallGroupIndex !== undefined) continue;
      add(this.getExternalCallOutputBase(groupIndex), group);
    }
    return indices;
  }

  /** Restore compiler-declared entry ownership after output-only materializers. */
  private _restoreDeclaredMutableEntrySlots(builder: TransactionBuilder): void {
    const occupancyEnd = writerBlockOccupancyEnd(
      this.externalCallUtxoGroups,
      (categoryId) => this.findMintingInputIndex(categoryId),
    );
    const entrySlots = this._declaredMutableEntrySlots();
    const entryIndices = entrySlots.map(({ outputIndex }) => outputIndex);
    for (const { outputIndex: index, inputIndex } of entrySlots) {
      const output = builder.outputs[index];
      const input = this.allInputs[inputIndex];
      if (reassertDeclaredMutableSlotLock(output, input)) continue;
      const lockBytes = output?.to instanceof Uint8Array ? output.to : undefined;
      const opTrue = !!lockBytes && lockBytes.length === 1 && lockBytes[0] === 0x51;
      if (!opTrue && !isViewReturnTailOutput(output)) continue;
      if (!input || !('unlocker' in input) || !input.unlocker || !input.token) continue;
      let dest = Math.max(occupancyEnd, index + 1);
      while (dest < builder.outputs.length && (
        builder.outputs[dest]?.token || entryIndices.includes(dest)
      )) dest += 1;
      if (dest < builder.outputs.length && isDisposableAlignmentPad({
        to: builder.outputs[dest]?.to instanceof Uint8Array
          ? builder.outputs[dest]!.to as Uint8Array : undefined,
        token: builder.outputs[dest]?.token,
      })) {
        builder.outputs[dest] = output;
      }
      builder.outputs[index] = {
        to: input.unlocker.generateLockingBytecode(),
        amount: input.satoshis,
        token: cloneToken(input.token),
      };
    }
  }

  /** Remove superseded collection chunks when a delegate owns the complete replacement suffix. */
  private _clearSupersededDelegateDynamicCollectionOutputs(builder: TransactionBuilder): void {
    if (!this.delegateDynamicChunksAtSuffix) return;
    const replacementCount = this._dynamicChunkOutputCount();
    if (replacementCount === 0) return;
    const suffixStart = builder.outputs.length - replacementCount - 1;
    if (suffixStart < 0) return;
    const authoritative = new Set<number>();
    for (let offset = 0; offset < replacementCount; offset++) authoritative.add(suffixStart + offset);
    const cleared = clearMutableCollectionOutputsOutsideAuthoritativeRun(
      builder.outputs, authoritative,
    );
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_CHUNK_GEOM === '1') {
      const authoritativeLocks = new Set([...authoritative].flatMap((index) => {
        const lock = builder.outputs[index]?.to;
        return lock instanceof Uint8Array ? [binToHex(lock)] : [];
      }));
      console.error('delegate-dynamic-dedup', {
        replacementCount,
        suffixStart,
        outputCount: builder.outputs.length,
        cleared,
        candidates: builder.outputs.flatMap((output, index) => {
          const lock = output?.to;
          if (!(lock instanceof Uint8Array)
            || !authoritativeLocks.has(binToHex(lock))
            || output.token?.nft?.capability !== 'mutable') return [];
          const commitment = commitmentHexOf(output.token.nft.commitment);
          return [{
            index,
            authoritative: authoritative.has(index),
            category: output.token.category,
            commitment: commitment.slice(0, 32),
            commitmentBytes: commitment.length / 2,
          }];
        }),
      });
    }
  }

  private _vacateViewTailsFromJobEventsBand(builder: TransactionBuilder): void {
    const band = this.getPublishJobEventsBand();
    if (!band) return;
    let vacated = false;
    for (let index = band.start; index <= band.end; index++) {
      const output = builder.outputs[index];
      if (!isViewReturnTailOutput(output)) continue;
      const input = this.allInputs[index];
      if (input && 'unlocker' in input && input.unlocker && input.token) {
        builder.outputs[index] = {
          to: input.unlocker.generateLockingBytecode(),
          amount: input.satoshis,
          token: cloneToken(input.token),
        };
      } else {
        const lock = input && 'unlocker' in input && input.unlocker
          ? input.unlocker.generateLockingBytecode()
          : Uint8Array.of(0x51);
        builder.outputs[index] = { to: lock, amount: input?.satoshis ?? 1000n };
      }
      vacated = true;
    }
    if (vacated) this._applyDerivedValueChunks(builder);
  }

  private _placeTailReturnAfterSwappedTokenBlock(
    builder: TransactionBuilder,
    returnOutputRefs?: Map<string, Output>,
  ): void {
    const swapCategoryId = this.mintingOutputSwap?.categoryId
      ?? this.externalCallUtxoGroups.find((group) =>
        group.sharedGroupIndex === undefined
        && isMintingBandSwapFunction(group.functionName ?? group.compilerRoute?.abiFunction.name))?.categoryId;
    if (!swapCategoryId) {
      this._writeViewTailsAfterWriterOccupancy(builder, returnOutputRefs);
      this._reassertInBlockWriterReturns(builder);
      return;
    }
    const master = this.findMintingInputIndex(swapCategoryId);
    if (master < 0) {
      this._writeViewTailsAfterWriterOccupancy(builder, returnOutputRefs);
      this._reassertInBlockWriterReturns(builder);
      return;
    }
    const tokenGroupIndex = this.externalCallUtxoGroups.findIndex((group) =>
      group.categoryId === swapCategoryId && group.sharedGroupIndex === undefined);
    const tokenGroup = tokenGroupIndex >= 0 ? this.externalCallUtxoGroups[tokenGroupIndex] : undefined;
    const tokenWriter = this.externalCallUtxoGroups.find((group, index) =>
      (group.sharedGroupIndex ?? index) === tokenGroupIndex
      && ((group.batchPredecessorOutputs?.length ?? 0) > 0
        || Object.entries({ ...group.compilerRoute?.internalArgs, ...group.internalArgs })
          .some(([name]) => isWriterBatchWitnessName(name)))) ?? tokenGroup;
    if (tokenGroup) inheritWriterBatchPlan(tokenGroup, tokenWriter);
    const after = master + (tokenGroup?.blockLayout?.blockSize ?? 8);
    const jobsCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    const tailReturns = this.tailReturnEventOutputs();
    const placements = packTailReturnPlacements(
      this.externalCallUtxoGroups,
      (categoryId) => this.findMintingInputIndex(categoryId),
      tailReturns,
      swapCategoryId,
      this.getPublishJobEventsBand()?.end ?? -1,
      this.viewTailPackOptions(jobsCount > 0
        ? builder.outputs.length - jobsCount - 1
        : builder.outputs.length),
    );
    const writerSlots = new Set<number>();
    const returnSlot = tokenGroup?.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
    if (returnSlot) writerSlots.add(master + returnSlot.offset);
    for (const index of this._declaredMutableEntrySlotIndices()) writerSlots.add(index);
    for (const [groupIdx, group] of this.externalCallUtxoGroups.entries()) {
      if (!groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, groupIdx)) continue;
      const placed = group.plannedReturnOutputIndex ?? group.returnOutputIndex;
      if (placed !== undefined) writerSlots.add(placed);
    }
    const writerEnd = writerSlots.size > 0 ? Math.max(...writerSlots) : after - 1;
    const assignedTailStart = [...placements.values()].reduce(
      (min, index) => Math.min(min, index),
      Number.POSITIVE_INFINITY,
    );
    const trailingPredCount = (tokenGroup?.batchPredecessorOutputs ?? [])
      .filter((pred) => pred.outputBlockSlot >= (tokenGroup?.blockLayout?.blockSize ?? 8)).length;
    // Keep INSERT P' on master+blockSize. Packing view tails onto that slot overwrites the
    // collection lockscript and transferFrom then EQUALVERIFYs OP_TRUE against the entry P2SH32.
    const predBandEnd = after + trailingPredCount;
    const tailStart = Number.isFinite(assignedTailStart)
      ? Math.max(predBandEnd, writerEnd + 1, assignedTailStart)
      : Math.max(predBandEnd, writerEnd + 1);
    if (tailReturns.length > 0) {
      let lastTail = tailStart - 1;
      // Compact from tailStart (after the swapped token block) but visit pending
      // identities in assigned-placement order so a loop's i=1 slot is not the
      // next logical callsite. Raw assigned ranks can still be the pre-swap
      // 30/31 band; writing there lands inside FakeToken.
      const placementRank = (event: (typeof tailReturns)[number]): number => (
        placements.get(event.identity)
          ?? placements.get(`${event.identity}:0`)
          ?? Number.MAX_SAFE_INTEGER
      );
      const orderedTails = tailReturns
        .map((event, index) => ({ event, index }))
        .sort((left, right) => placementRank(left.event) - placementRank(right.event) || left.index - right.index);
      for (const [offset, { event }] of orderedTails.entries()) {
        let placedIndex = placementRank(event) !== Number.MAX_SAFE_INTEGER
          ? placementRank(event)
          : tailStart + offset;
        if (placedIndex < 0 || writerSlots.has(placedIndex) || placedIndex < tailStart) {
          placedIndex = tailStart + offset;
          while (writerSlots.has(placedIndex)) placedIndex += 1;
        }
        if (placedIndex < 0) continue;
        while (placedIndex >= builder.outputs.length) {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
        }
        const rawCommitment = binToHex(event.commitment);
        const commitment = rawCommitment === '' ? '0101' : rawCommitment;
        const output: Output = {
          to: Uint8Array.of(0x51),
          amount: 800n,
          token: {
            amount: 0n,
            category: event.categoryId,
            nft: { capability: 'none', commitment },
          },
        };
        builder.outputs[placedIndex] = output;
        returnOutputRefs?.set(event.identity, output);
        lastTail = placedIndex;
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
        console.error('tail-place-band', {
          master, after, writerEnd, tailStart, lastTail,
          predDest: Math.max(tokenGroup?.relocatedPredOutBase ?? 0, lastTail + 1),
          relocatedPredOutBase: tokenGroup?.relocatedPredOutBase,
          written: orderedTails.map(({ event }, offset) => ({
            identity: event.identity,
            index: placementRank(event) !== Number.MAX_SAFE_INTEGER
              ? placementRank(event) : tailStart + offset,
            commitment: binToHex(event.commitment),
          })),
        });
      }
      // INSERT P' occupies master+blockSize. View tails start after that band, so
      // do not replay predecessors past lastTail — that cloned P' at 38 and made
      // transferFrom's collection count expect 4 while the scan saw 3.
      const blockSize = tokenGroup?.blockLayout?.blockSize ?? 8;
      const predDestBase = Math.max(
        tokenGroup?.relocatedPredOutBase ?? after,
        lastTail + 1,
      );
      let predOrdinal = 0;
      for (const pred of tokenGroup?.batchPredecessorOutputs ?? []) {
        if (pred.outputBlockSlot < blockSize) continue;
        const predDest = predDestBase + predOrdinal;
        predOrdinal += 1;
        while (predDest >= builder.outputs.length) {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
        }
        const occupant = builder.outputs[predDest];
        if (isViewReturnTailOutput({
          to: occupant?.to instanceof Uint8Array ? occupant.to : undefined,
          token: occupant?.token,
        })) continue;
        const isHole = !occupant || !occupant.token || isPredOutReusableHole({
          to: occupant.to instanceof Uint8Array ? occupant.to : undefined,
          token: occupant.token,
        });
        if (!isHole) continue;
        builder.outputs[predDest] = {
          to: pred.lockingBytecode,
          amount: 1000n,
          token: {
            amount: 0n,
            category: tokenGroup!.categoryId,
            nft: { capability: 'mutable', commitment: pred.commitment },
          },
        };
      }
      this._restoreDeclaredMutableEntrySlots(builder);
      this._reassertInBlockWriterReturns(builder);
      return;
    }
    const hole = builder.outputs[after];
    if (hole?.token?.nft?.capability === 'none' && (hole.token.nft.commitment?.length ?? 0) > 2) {
      this._restoreDeclaredMutableEntrySlots(builder);
      this._reassertInBlockWriterReturns(builder);
      return;
    }
    const suffixLen = (this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0) + 1;
    const last = builder.outputs.length - suffixLen;
    const category = this._jobEventsPublishCategory()
      ?? builder.outputs.slice(after + 1, last).find((output) =>
        output.token?.nft?.capability === 'none'
        && output.token.category !== swapCategoryId)?.token?.category;
    if (!category) {
      this._restoreDeclaredMutableEntrySlots(builder);
      this._reassertInBlockWriterReturns(builder);
      return;
    }
    builder.outputs[after] = {
      to: Uint8Array.of(0x51),
      amount: 800n,
      token: {
        amount: 0n,
        category,
        nft: { capability: 'none', commitment: '0101' },
      },
    };
    this._vacateViewTailsFromJobEventsBand(builder);
    this._restoreDeclaredMutableEntrySlots(builder);
    this._reassertInBlockWriterReturns(builder);
  }

  /**
   * @internal Re-run input assembly after a co-spent group's unlocker was replaced post-construction. The
   * identity-anchor witness can only be filled once the built input positions exist, so the delegate master that
   * carries it is re-created after this builder assembled its inputs.
   */
  _refreshInputs(): void {
    this.setFunderUtxos(this.funderUtxos);
  }

  /** Replace one deferred keccak batch member and rebuild its ordinary compute side-car in place. */
  private rebuildDeferredKeccakPreimage(callIndex: number, preimage: Uint8Array): boolean {
    const deferred = this.deferredKeccakCompute;
    if (!deferred || callIndex < 0 || callIndex >= deferred.preimages.length) return false;
    const previous = deferred.preimages[callIndex];
    if (previous !== null && binToHex(previous) === binToHex(preimage)) return false;
    deferred.preimages[callIndex] = Uint8Array.from(preimage);

    const batchIndex = deferred.legacy ? callIndex : Math.floor(callIndex / 3);
    const batchStart = deferred.legacy ? batchIndex : batchIndex * 3;
    const batchWidth = deferred.legacy ? 1 : Math.min(3, deferred.preimages.length - batchStart);
    const batchPreimages = deferred.preimages.slice(batchStart, batchStart + batchWidth)
      .map((member) => member ?? new Uint8Array());
    const sidecar = this.keccakComputeCoSpendUtxos[batchIndex];
    if (!sidecar) return false;
    const rebuilt = buildKeccakComputeSidecar(
      deferred.legacy ? batchPreimages[0] : batchPreimages,
      deferred.salt,
      sidecar,
      true,
      deferred.legacy,
    );
    this.keccakComputeCoSpendUtxos[batchIndex] = { ...sidecar, unlocker: rebuilt.unlocker };
    this.keccakComputeCommitments[batchIndex] = binToHex(rebuilt.commitment);
    this._refreshInputs();
    return true;
  }

  /**
   * Learn one complex keccak preimage from the complete routed execution trace. Direct calls resolve these with
   * a small isolated probe, but a delegate implementation can depend on authenticated proxy state and nested
   * return channels which exist only in the final transaction. The compiler's call-ordinal marker identifies the
   * logical call even when nested hashes execute inner-to-outer.
   */
  resolveDeferredKeccakPreimage(trace: unknown[], inputBase = 0): boolean {
    const deferred = this.deferredKeccakCompute;
    if (!deferred || !deferred.preimages.some((preimage) => preimage === null)) return false;
    const debug = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_KECCAK_DERIVE === '1';
    const firstSidecar = this.keccakComputeCoSpendUtxos[0];
    if (!firstSidecar) return false;
    const localBase = this.allInputs.findIndex((input) => (
      input.txid.toLowerCase() === firstSidecar.txid.toLowerCase() && input.vout === firstSidecar.vout
    ));
    if (localBase < 0) return false;
    const base = inputBase + localBase;

    let learned: { callIndex: number; preimage: Uint8Array };
    try {
      learned = extractKeccakPreimageFromTrace(
        trace, base, deferred.preimages.length, this.keccakComputeCoSpendUtxos.length,
      );
    } catch (error) {
      if (debug) console.error('deferred-keccak-extract-miss', {
        base,
        calls: deferred.preimages.length,
        sidecars: this.keccakComputeCoSpendUtxos.length,
        error: error instanceof Error ? error.message : String(error),
        reads: trace.flatMap((raw) => {
          const step = raw as {
            ip?: number; stack?: Uint8Array[]; instructions?: Array<{ opcode?: number }>;
            controlStack?: unknown[];
          };
          if (step.controlStack?.some((condition) => condition === false)
            || step.instructions?.[step.ip ?? -1]?.opcode !== 0xca
            || !step.stack || step.stack.length < 2) return [];
          const top = step.stack.length - 1;
          return [{
            ip: step.ip,
            index: Number(decodeVmScriptNumber(step.stack[top])),
            marker: step.stack.length >= 3 ? Number(decodeVmScriptNumber(step.stack[top - 1])) : undefined,
            argumentBytes: step.stack.length >= 3 ? step.stack[top - 2].length : step.stack[top - 1].length,
            argument: binToHex(step.stack[step.stack.length >= 3 ? top - 2 : top - 1]).slice(0, 80),
          }];
        }),
      });
      return false;
    }
    if (!this.rebuildDeferredKeccakPreimage(learned.callIndex, learned.preimage)) return false;
    const batchIndex = deferred.legacy ? learned.callIndex : Math.floor(learned.callIndex / 3);
    if (debug) console.error('deferred-keccak-learned', {
      base,
      callIndex: learned.callIndex,
      batchIndex,
      preimageBytes: learned.preimage.length,
      preimage: binToHex(learned.preimage),
      resolved: deferred.preimages.map((preimage) => preimage === null ? null : binToHex(preimage)),
      commitment: this.keccakComputeCommitments[batchIndex],
    });
    return true;
  }

  hasUnresolvedDeferredKeccakPreimages(): boolean {
    return this.deferredKeccakCompute?.preimages.some((preimage) => preimage === null) === true;
  }

  /**
   * Learn one computed ecrecover (hash,v,r,s) blob from the complete execution trace. A transitive helper exposes
   * the 97-byte blob immediately below its recovery-A input index at OP_INPUTBYTECODE; matching the actual A UTXO
   * position avoids confusing ordinary calldata or keccak reads. Rebuilding one pair advances nested execution
   * deterministically, so the derivation loop repeats until every placeholder is gone.
   */
  resolveDeferredEcrecoverArgument(trace: unknown[], inputBase = 0): boolean {
    const deferred = this.deferredEcrecoverCompute;
    if (!deferred || !deferred.argBlobs.some((argBlob) => argBlob === null)) return false;
    const unresolvedAIndices = new Map<number, number>();
    for (let callIndex = 0; callIndex < deferred.argBlobs.length; callIndex++) {
      if (deferred.argBlobs[callIndex] !== null) continue;
      const sidecarA = this.ecrecoverComputeCoSpendUtxos[2 * callIndex];
      if (!sidecarA) continue;
      const inputIndex = this.allInputs.findIndex((input) => (
        input.txid.toLowerCase() === sidecarA.txid.toLowerCase() && input.vout === sidecarA.vout
      ));
      if (inputIndex >= 0) unresolvedAIndices.set(inputBase + inputIndex, callIndex);
    }
    if (unresolvedAIndices.size === 0) return false;

    let learned: { callIndex: number; argBlob: Uint8Array } | undefined;
    for (const raw of trace) {
      const state = raw as {
        ip?: number; stack?: Uint8Array[]; instructions?: Array<{ opcode?: number }>;
        controlStack?: unknown[];
      };
      if (state.controlStack?.some((condition) => condition === false)
        || state.instructions?.[state.ip ?? -1]?.opcode !== Op.OP_INPUTBYTECODE
        || !state.stack || state.stack.length < 2) continue;
      const inputIndex = Number(decodeVmScriptNumber(state.stack[state.stack.length - 1]));
      const callIndex = unresolvedAIndices.get(inputIndex);
      const argBlob = state.stack[state.stack.length - 2];
      if (callIndex === undefined || argBlob.length !== 97) continue;
      learned = { callIndex, argBlob: Uint8Array.from(argBlob) };
      break;
    }
    if (!learned) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process
        ?.env?.SOLIDC_DEBUG_ECRECOVER_DERIVE === '1') {
        console.error('deferred-ecrecover-no-argument', {
          unresolvedAIndices: [...unresolvedAIndices.entries()],
          inputCount: this.allInputs.length,
          inputBytecodeReads: trace.flatMap((raw) => {
            const state = raw as {
              ip?: number; stack?: Uint8Array[]; instructions?: Array<{ opcode?: number }>;
            };
            if (state.instructions?.[state.ip ?? -1]?.opcode !== Op.OP_INPUTBYTECODE || !state.stack) return [];
            return [{
              index: state.stack.length > 0
                ? Number(decodeVmScriptNumber(state.stack[state.stack.length - 1])) : undefined,
              belowBytes: state.stack.at(-2)?.length,
              below: state.stack.at(-2) ? binToHex(state.stack.at(-2)!) : undefined,
              stackBytes: state.stack.slice(-5).map((item) => item.length),
            }];
          }).slice(-24),
        });
      }
      return false;
    }

    const { callIndex, argBlob } = learned;
    const sidecarA = this.ecrecoverComputeCoSpendUtxos[2 * callIndex];
    const sidecarB = this.ecrecoverComputeCoSpendUtxos[2 * callIndex + 1];
    if (!sidecarA || !sidecarB) return false;
    try {
      const witness = computeEcrecoverWitness(
        argBlob.slice(0, 32), argBlob[32], argBlob.slice(33, 65), argBlob.slice(65, 97),
      );
      const chunkA = probeEcrecoverSplit(witness, deferred.salt, sidecarA, sidecarB);
      const rebuilt = buildEcrecoverComputeSidecars(witness, chunkA, deferred.salt, sidecarA, sidecarB);
      this.ecrecoverComputeCoSpendUtxos[2 * callIndex] = { ...sidecarA, unlocker: rebuilt.unlockerA };
      this.ecrecoverComputeCoSpendUtxos[2 * callIndex + 1] = { ...sidecarB, unlocker: rebuilt.unlockerB };
      this.ecrecoverComputeRecreates[2 * callIndex] = rebuilt.recreateA;
      this.ecrecoverComputeRecreates[2 * callIndex + 1] = rebuilt.recreateB;
      deferred.argBlobs[callIndex] = argBlob;
      const evmPreimageIndex = deferred.evmKeccakPreimageIndices[callIndex] ?? -1;
      if (evmPreimageIndex >= 0) {
        this.rebuildDeferredKeccakPreimage(evmPreimageIndex, witness.uncompressedPubkey);
      }
      this._refreshInputs();
      if ((globalThis as { process?: { env?: Record<string, string> } }).process
        ?.env?.SOLIDC_DEBUG_ECRECOVER_DERIVE === '1') {
        console.error('deferred-ecrecover-learned', {
          callIndex, inputIndices: [...unresolvedAIndices.keys()], argument: binToHex(argBlob),
        });
      }
      return true;
    } catch (error) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process
        ?.env?.SOLIDC_DEBUG_ECRECOVER_DERIVE === '1') {
        console.error('deferred-ecrecover-invalid-argument', {
          callIndex, argument: binToHex(argBlob), error: error instanceof Error ? error.message : String(error),
        });
      }
      return false;
    }
  }

  hasUnresolvedDeferredEcrecoverArguments(): boolean {
    return this.deferredEcrecoverCompute?.argBlobs.some((argBlob) => argBlob === null) === true;
  }

  setFunderUtxos(funders: UnlockableUtxo[]): void {
    this.funderUtxos = funders;
    // Rebuild allInputs with new funders
    const entryInputs = this.entryNfts
      .filter((e) => e.exists && e.utxo)
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((e) => e.utxo!);
    const tokenContainerInputs = this.tokenContainers
      .filter((d) => d.exists && d.utxo)
      .sort((a, b) => a.tokenContainerSlotIndex - b.tokenContainerSlotIndex)
      .map((d) => d.utxo!);
    const satoshiContainerInputs = this.satoshiContainerUtxo ? [this.satoshiContainerUtxo] : [];
    const externalOutStateInputs: UnlockableUtxo[] = [];
    for (const g of this.externalOutStateUtxoGroups) {
      externalOutStateInputs.push(g.masterUtxo as UnlockableUtxo, ...g.dataNftUtxos);
    }
    const externalCallInputs: UnlockableUtxo[] = [];
    for (const g of this.externalCallUtxoGroups) {
      if (g.sharedGroupIndex !== undefined) continue;
      if (g.blockInputs) {
        externalCallInputs.push(...g.blockInputs);
      } else {
        externalCallInputs.push(g.masterUtxo as UnlockableUtxo, ...g.dataNftUtxos);
      }
    }
    const lowLevelCallInputs: UnlockableUtxo[] = [];
    const embeddedDelegateGroups = new Set(this.externalCallUtxoGroups.flatMap((group) => (
      group.delegateEmbeddedInBlock && group.delegateCallGroupIndex !== undefined
        ? [group.delegateCallGroupIndex] : []
    )));
    for (const [groupIndex, g] of this.lowLevelCallUtxoGroups.entries()) {
      if (embeddedDelegateGroups.has(groupIndex)) continue;
      lowLevelCallInputs.push(g.masterUtxo as UnlockableUtxo, ...g.dataNftUtxos);
    }
    this.allInputs = this._buildInputs(
      entryInputs, tokenContainerInputs, satoshiContainerInputs,
      externalOutStateInputs, externalCallInputs, lowLevelCallInputs,
    );
    const debugInputAssembly = (stage: string): void => {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_INPUTS !== '1') return;
      console.error('stateful-input-assembly', {
        stage,
        count: this.allInputs.length,
        routeBlockSize: this.blockLayout?.blockSize,
        trailingCapacity: this.blockLayout?.trailingCapacity,
        preserveBlockLayoutWidth: this.preserveBlockLayoutWidth,
        compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
        lowLevelCallInputs: lowLevelCallInputs.length,
        externalIdentityAnchors: this.externalIdentityAnchorUtxos.length,
        logicalIdentityAnchor: this.logicalIdentityUtxo !== undefined,
        mutableInputs: this.allInputs.flatMap((input, index) => (
          input.token?.nft?.capability === 'mutable' ? [{
            index,
            outpoint: `${input.txid}:${input.vout}`,
            category: input.token.category.slice(0, 16),
            commitment: input.token.nft.commitment.slice(0, 24),
            lockingBytecode: binToHex(input.unlocker.generateLockingBytecode()).slice(0, 24),
          }] : []
        )),
      });
    };
    debugInputAssembly('refreshed');
    this._swapMintingOffValueChunkBand();
    debugInputAssembly('refresh-minting-band-relocated');
    this._placeJobEventsPredecessorInputs(this.pendingJobEventsPredecessors);
    debugInputAssembly('refresh-predecessors-placed');
    // Callee anchors precede the caller's own: emitLogicalMsgSenderAnchorResolution resolves the caller's
    // identity from the LAST input, so that tail position must stay the caller's.
    this.allInputs.push(...this.externalIdentityAnchorUtxos);
    if (this.logicalIdentityUtxo) this.allInputs.push(this.logicalIdentityUtxo);
    debugInputAssembly('refresh-identity-anchors-appended');
  }

  /** Keep async-planned disposable inputs out of layout until a dynamic band actually needs them. */
  setRelocationFunderUtxos(funders: UnlockableUtxo[]): void {
    this.relocationFunderUtxos = [...funders];
  }

  /**
   * Guess scalar NFT output state before the first VM probe.
   *
   * Unique-typed ABI arguments are assigned onto unique-typed state fields; leftover integer fields are
   * incremented by 1. The guess is only a candidate: a faithful probe still has to accept the transaction,
   * and a mismatch falls back to the existing extract-and-reprobe loop.
   */
  getOptimisticPermutationCount(): number {
    return this.lastOptimisticPermutationCount;
  }

  clearOptimisticScalarWrites(): void {
    this.stateUpdates.clear();
  }

  seedOptimisticScalarWrites(permutationIndex: number = 0): boolean {
    this.lastOptimisticPermutationCount = 1;
    if (this.stateUpdates.size > 0 || this.stateRawCommitments.size > 0) return false;
    if (!isContractUnlocker(this.masterUtxo.unlocker)) return false;
    const { abiFunction, params } = this.masterUtxo.unlocker;
    if (abiFunction.writesState === false) return false;
    if (abiFunction.entryAccesses && abiFunction.entryAccesses.length > 0) return false;
    const modifiers = abiFunction.modifiers ?? [];
    if (modifiers.includes('view') || modifiers.includes('pure')) return false;

    const visibleInputs = abiFunction.inputs.filter((input) => !input.name.startsWith('__internal__'));
    const fields = this.stateLayout.variables.filter((variable) => !variable.dynamic
      && !variable.name.includes('$')
      && scalarTypeKey(variable.type) !== undefined);
    if (fields.length === 0) return false;

    const currentState: Record<string, StateValue> = {};
    for (let i = 0; i < this.requiredNftIndices.length; i += 1) {
      const nftUtxo = this.dataNftUtxos[i];
      if (!nftUtxo?.token?.nft?.commitment) continue;
      Object.assign(
        currentState,
        parsePushdataCommitment(nftUtxo.token.nft.commitment, this.stateLayout, this.requiredNftIndices[i]),
      );
    }

    const assigned = new Set<string>();
    const usedArgs = new Set<number>();
    const tryAssign = (fieldName: string, argIndex: number): void => {
      if (assigned.has(fieldName) || usedArgs.has(argIndex)) return;
      if (argIndex < 0 || argIndex >= params.length || argIndex >= visibleInputs.length) return;
      const field = fields.find((candidate) => candidate.name === fieldName);
      if (!field) return;
      const value = paramToStateValue(params[argIndex], visibleInputs[argIndex].type);
      if (value === undefined) return;
      if (!canEncodeScalarStateValue(value, field.type)) return;
      this.setState(fieldName, value);
      assigned.add(fieldName);
      usedArgs.add(argIndex);
    };

    const fieldKeys = fields.map((field) => scalarTypeKey(field.type)!);
    const argKeys = visibleInputs.map((input) => scalarTypeKey(input.type));
    visibleInputs.forEach((input, argIndex) => {
      const field = fields.find((candidate) => fieldNameMatchesArg(candidate.name, input.name));
      if (!field || scalarTypeKey(field.type) !== argKeys[argIndex]) return;
      tryAssign(field.name, argIndex);
    });
    const permGroups: Array<{ fields: typeof fields; argIndexes: number[] }> = [];
    for (const key of new Set(fieldKeys)) {
      const matchingFields = fields.filter((field, index) => fieldKeys[index] === key && !assigned.has(field.name));
      const matchingArgs = visibleInputs
        .map((input, index) => ({ input, index }))
        .filter(({ index }) => argKeys[index] === key && !usedArgs.has(index));
      if (matchingFields.length === 1 && matchingArgs.length === 1) {
        tryAssign(matchingFields[0].name, matchingArgs[0].index);
      } else if (matchingFields.length === matchingArgs.length && matchingFields.length > 3) {
        matchingFields.forEach((field, offset) => tryAssign(field.name, matchingArgs[offset].index));
      } else if (matchingFields.length === matchingArgs.length && matchingFields.length >= 2) {
        permGroups.push({ fields: matchingFields, argIndexes: matchingArgs.map((entry) => entry.index) });
      }
    }
    const groupPerms = permGroups.map((group) => permutations(group.argIndexes));
    let permutationCount = groupPerms.reduce((acc, perms) => acc * perms.length, 1);
    if (permutationCount > 8) permutationCount = 1;
    this.lastOptimisticPermutationCount = permutationCount;
    let remaining = ((permutationIndex % permutationCount) + permutationCount) % permutationCount;
    permGroups.forEach((group, groupIndex) => {
      const perms = groupPerms[groupIndex];
      const pick = permutationCount === 1 ? perms[0] : perms[remaining % perms.length];
      remaining = Math.floor(remaining / perms.length);
      group.fields.forEach((field, offset) => tryAssign(field.name, pick[offset]));
    });

    const decrement = /(?:dec|sub|minus|reduce|spend)/i.test(abiFunction.name);
    const zero = /(?:reset|clear|zero)/i.test(abiFunction.name);
    const enable = /(?:enable|arm|activate|start)/i.test(abiFunction.name);
    const disable = /(?:disable|disarm|deactivate|stop)/i.test(abiFunction.name);
    const twice = /(?:double|twice)/i.test(abiFunction.name);
    const leftoverInts = fields.filter((field) => !assigned.has(field.name) && isIntegerType(field.type));
    const leftoverBools = fields.filter((field) => !assigned.has(field.name) && field.type === 'bool');
    const unusedIntArgs = visibleInputs
      .map((input, index) => ({ input, index }))
      .filter(({ input, index }) => !usedArgs.has(index) && isIntegerType(input.type));
    // A leftover increment is only a good first-probe guess for a single unassigned counter. Blindly
    // +1-ing every leftover packed field (or zipping a uint256 slot word onto a uint16) aborts
    // derivation when encodePushdataValue rejects the out-of-range value.
    const applyLeftoverInts = zero || decrement || twice
      || (leftoverInts.length === 1 && unusedIntArgs.length === 0);
    const applyLeftoverBools = enable || disable || zero || leftoverBools.length === 1;
    if (applyLeftoverInts) {
      for (const field of leftoverInts) {
        const current = currentState[field.name];
        if (typeof current !== 'bigint') continue;
        const nextInt = zero ? 0n : twice ? current * 2n : current + (decrement ? -1n : 1n);
        if (!canEncodeScalarStateValue(nextInt, field.type)) continue;
        this.setState(field.name, nextInt);
        assigned.add(field.name);
      }
    }
    if (applyLeftoverBools) {
      for (const field of leftoverBools) {
        const current = currentState[field.name];
        if (typeof current !== 'boolean') continue;
        this.setState(field.name, enable ? true : (disable || zero) ? false : !current);
        assigned.add(field.name);
      }
    }

    return assigned.size > 0;
  }

  /**
   * Seed fixed-size array element writes whose ABI valueSource is a compile-time integer.
   * Mapping (vmap) writes use native slot||next||value commitments and must not go through setEntry.
   */
  seedOptimisticArrayElementWrites(): boolean {
    if (this.entryUpdates.size > 0) return false;
    if (!isContractUnlocker(this.masterUtxo.unlocker)) return false;
    const { abiFunction } = this.masterUtxo.unlocker;
    const accesses = abiFunction.entryAccesses ?? [];
    if (accesses.length === 0) return false;
    let seeded = false;
    for (let slotIndex = 0; slotIndex < accesses.length; slotIndex += 1) {
      const access = accesses[slotIndex];
      if (!access.operations.includes('write') || access.operations.includes('delete')) continue;
      const collection = this.stateLayout.collections?.find((candidate) => candidate.name === access.collection);
      if (collection === undefined || collection.kind !== 'array') continue;
      const valueType = collection.valueType ?? collection.elementType ?? 'int';
      const entryDelta = access.valueSource?.match(/^binop:([+-])\(entry,lit:(-?[0-9]+)\)$/);
      let value: bigint | undefined;
      if (entryDelta) {
        let current = 0n;
        const nft = this.entryNfts.find((entry) => entry.slotIndex === slotIndex);
        const commitment = nft?.exists ? nft.utxo?.token?.nft?.commitment : undefined;
        if (commitment) {
          try {
            const parsed = parseEntryCommitment(commitment, collection.keyType ?? 'bigint', valueType);
            if (typeof parsed.value === 'bigint') current = parsed.value;
          } catch {
            current = 0n;
          }
        }
        const delta = BigInt(entryDelta[2]);
        value = entryDelta[1] === '-' ? current - delta : current + delta;
      } else if (!access.operations.includes('read')) {
        value = evalSimpleIntegerSource(access.valueSource);
      }
      if (value === undefined || !canEncodeScalarStateValue(value, valueType)) continue;
      this.setEntry(slotIndex, value);
      seeded = true;
    }
    return seeded;
  }

  /**
   * Set a state variable to a new value.
   */
  setState(
    name: string,
    value: StateValue,
  ): this {
    const variable = this.stateLayout.variables.find((v) => v.name === name);
    if (!variable) {
      // Allow a dynamic var's hidden length key "<name>$len" (the data-NFT register field).
      if (name.endsWith('$len')) {
        const base = name.slice(0, -4);
        const dynamicVariable = this.stateLayout.variables.find((v) => v.name === base && v.dynamic);
        if (dynamicVariable) {
          this.stateRawCommitments.delete(dynamicVariable.nftIndex);
          this.stateUpdates.set(name, value);
          return this;
        }
      }
      throw new Error(`Unknown state variable: ${name}`);
    }
    this.stateRawCommitments.delete(variable.nftIndex);
    this.stateUpdates.set(name, value);
    return this;
  }

  setStateRawCommitment(nftIndex: number, commitment: string): this {
    this.stateRawCommitments.set(nftIndex, commitment);
    return this;
  }

  /**
   * Set a state variable on an external call's output.
   */
  setExternalCallState(
    categoryId: string,
    name: string,
    value: StateValue,
  ): this {
    let updates = this.externalCallStateUpdates.get(categoryId);
    if (!updates) {
      updates = new Map();
      this.externalCallStateUpdates.set(categoryId, updates);
    }
    updates.set(name, value);
    // A caller changing an override after derivation invalidates the exact
    // commitment previously authenticated for that participant.
    const group = this.externalCallUtxoGroups.find((candidate) => candidate.categoryId === categoryId);
    const nftIndex = group?.stateLayout.variables.find((variable) => variable.name === name)?.nftIndex;
    if (nftIndex !== undefined) this.externalCallStateRawCommitments.get(categoryId)?.delete(nftIndex);
    return this;
  }

  /** B's vmap sorted-entry output at its block-slot position (commitment from B's VM trace). docs/deferrals.md #1. */
  setExternalCallEntryOutput(categoryId: string, blockSlot: number, commitmentHex: string): boolean {
    let m = this.externalCallEntryOutputs.get(categoryId);
    if (!m) { m = new Map(); this.externalCallEntryOutputs.set(categoryId, m); }
    if (m.get(blockSlot) === commitmentHex) return false;
    m.set(blockSlot, commitmentHex);
    return true;
  }

  private _externalDataNftOwner(
    outputIndex: number,
    categoryId: string,
  ): { groupIndex: number; nftIndex: number } | undefined {
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined || group.categoryId !== categoryId) continue;
      const blockBase = this.getExternalCallOutputBase(groupIndex);
      if (!blockOutputOwnsFixedDataNft(
        outputIndex, blockBase, group.blockLayout, group.dataNftUtxos.length,
      )) continue;
      const relative = outputIndex - blockBase;
      const declared = group.blockLayout?.slots.filter((slot) => slot.kind === 'dataNft') ?? [];
      const declaredSlot = declared.find((slot) => slot.offset === relative);
      const ordinal = declared.length > 0 ? declared.indexOf(declaredSlot!) : relative - 1;
      const nftIndex = declaredSlot?.nftIndex ?? group.requiredDataNftIndices[ordinal];
      if (nftIndex !== undefined) return { groupIndex, nftIndex };
    }
    return undefined;
  }

  private _isFixedExternalDataNftOutput(outputIndex: number, categoryId: string): boolean {
    return this._externalDataNftOwner(outputIndex, categoryId) !== undefined;
  }

  private _setRootStateRawCommitmentAt(
    outputIndex: number,
    categoryId: string,
    commitmentHex: string,
  ): boolean {
    if (categoryId !== this.categoryId) return false;
    // build() emits the root master followed by required data NFTs in this
    // order, independent of any later balanced participant blocks.
    const requiredOrdinal = outputIndex - 1;
    const nftIndex = this.requiredNftIndices[requiredOrdinal];
    if (requiredOrdinal < 0 || nftIndex === undefined) return false;
    this.stateRawCommitments.set(nftIndex, commitmentHex);
    return true;
  }

  private _setExternalCallStateRawCommitmentAt(
    outputIndex: number,
    categoryId: string,
    commitmentHex: string,
  ): boolean {
    const owner = this._externalDataNftOwner(outputIndex, categoryId);
    if (!owner) return false;
    let byNft = this.externalCallStateRawCommitments.get(categoryId);
    if (!byNft) {
      byNft = new Map();
      this.externalCallStateRawCommitments.set(categoryId, byNft);
    }
    if (byNft.get(owner.nftIndex) !== commitmentHex) byNft.set(owner.nftIndex, commitmentHex);
    return true;
  }

  setExternalCallEntryOutputAt(outputIndex: number, categoryId: string, commitmentHex: string): boolean {
    if (commitmentHex.length < 128 || /^0+$/.test(commitmentHex)) return false;
    if (this._isFixedExternalDataNftOutput(outputIndex, categoryId)) return false;
    let declaredSlot = false;
    let entryOwned = false;
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined || group.categoryId !== categoryId || !group.blockLayout) continue;
      const blockBase = this.getExternalCallOutputBase(groupIndex);
      const relative = outputIndex - blockBase;
      const slot = group.blockLayout.slots[relative]
        ?? group.blockLayout.slots.find((candidate) => candidate.offset === relative);
      if (!slot) continue;
      declaredSlot = true;
      if (slot.kind === 'entry') entryOwned = true;
    }
    // Commitment traces cover data NFTs, events, and entries. Only a declared entry slot may enter this cache;
    // otherwise a later rebuild can replay an entry-shaped value over fixed participant state. Coordinates after
    // every fixed block remain valid: dynamic loop entries and INSERT nodes are intentionally trailing outputs.
    if (declaredSlot && !entryOwned) return false;
    const previous = this.externalCallEntryOutputsByIndex.get(outputIndex);
    if (previous?.commitment === commitmentHex && previous.categoryId === categoryId) return false;
    // A later all-zero / short extract must not replace a real predecessor (H('') UPDATE).
    if (previous && previous.commitment.length >= 128 && !/^0+$/.test(previous.commitment)
      && commitmentHex.length < previous.commitment.length) return false;
    this.externalCallEntryOutputsByIndex.set(outputIndex, { categoryId, commitment: commitmentHex });
    return true;
  }

  private _applyDerivedEntryOutputs(builder: TransactionBuilder): void {
    for (const [outputIndex, placed] of this.externalCallEntryOutputsByIndex) {
      const existing = builder.outputs[outputIndex];
      if (!existing?.token?.nft || existing.token.nft.capability !== 'mutable') continue;
      // Output geometry can change after a trace was cached. Re-check ownership
      // at replay time so an old dynamic coordinate cannot overwrite fixed state.
      if (this._isFixedExternalDataNftOutput(
        outputIndex, existing.token.category ?? placed.categoryId,
      )) {
        this.externalCallEntryOutputsByIndex.delete(outputIndex);
        continue;
      }
      builder.outputs[outputIndex] = {
        to: existing.to,
        amount: existing.amount,
        token: {
          amount: existing.token.amount ?? 0n,
          category: existing.token.category ?? placed.categoryId,
          nft: { capability: 'mutable', commitment: placed.commitment },
        },
      };
    }
  }

  getExternalCallEntryOutput(categoryId: string, blockSlot: number): string | undefined {
    return this.externalCallEntryOutputs.get(categoryId)?.get(blockSlot);
  }

  /**
   * Rebind write-path entry NFT unlockers of `categoryId` to `masterInputIndex`.
   * Nested publishJobEvent keeps jobEvents outside the proxy block (impl+3), so
   * a blockInputs-only patch leaves that co-spend authorized against input 0.
   */
  rebindCategoryEntryUnlockers(
    categoryId: string,
    rebind: (current: UnlockableUtxo) => Unlocker | undefined,
  ): void {
    const visit = (input: UnlockableUtxo | undefined): void => {
      if (!input?.token || input.token.category !== categoryId) return;
      if (input.token.nft?.capability !== 'mutable' || !input.unlocker) return;
      const name = (input.unlocker as { contract?: { artifact?: { contractName?: string } } })
        .contract?.artifact?.contractName;
      if (!name?.startsWith('EntryNft_')) return;
      const next = rebind(input);
      if (next) input.unlocker = next;
    };
    for (const input of this.allInputs) visit(input);
    for (const group of this.externalCallUtxoGroups) {
      for (const input of group.blockInputs ?? []) visit(input);
    }
    for (const input of this.iterationEntryInputs) visit(input);
    for (const info of this.entryNfts) {
      if (info.utxo) visit(info.utxo);
    }
  }

  /** A trailing NEW entry node for a cross-contract callee INSERT (minted after B's block). Returns its handle. */
  addExternalCallEntryInsert(categoryId: string, to: Uint8Array, commitmentHex: string): number {
    return this.externalCallEntryInserts.push({ categoryId, to, commitment: commitmentHex }) - 1;
  }

  /** Replace a trailing NEW node's commitment (the placeholder set for the 2nd-pass probe). */
  setExternalCallEntryInsertCommitment(handle: number, commitmentHex: string): this {
    if (this.externalCallEntryInserts[handle]) this.externalCallEntryInserts[handle].commitment = commitmentHex;
    return this;
  }

  /** Drop a trailing NEW node placeholder (the write turned out to be an UPDATE, not an INSERT). */
  removeExternalCallEntryInsert(handle: number): this {
    if (this.externalCallEntryInserts[handle]) this.externalCallEntryInserts[handle] = { categoryId: '', to: new Uint8Array(), commitment: '' };
    return this;
  }

  /**
   * Set an entry NFT value by slot index.
   */
  setEntry(
    slotIndex: number,
    value: StateValue,
  ): this {
    this.entryUpdates.set(slotIndex, value);
    return this;
  }

  /**
   * Mark an entry NFT for deletion by slot index.
   */
  deleteEntry(slotIndex: number): this {
    this.entryDeletes.add(slotIndex);
    return this;
  }

  // Whether this entry slot is only conditionally active (a delete/write inside an if/else branch). Such a slot's
  // presence in the output depends on the taken branch, so it must not be unconditionally deleted from the layout.
  isEntrySlotConditional(slotIndex: number): boolean {
    return this.blockLayout?.slots.some(
      (s) => s.kind === 'entry' && s.slotIndex === slotIndex && s.conditional,
    ) ?? false;
  }

  /** Exact pre-state commitment for an occupied entry slot, if this call co-spends one. */
  getExistingEntryCommitment(slotIndex: number): string | undefined {
    const entry = this.entryNfts.find((candidate) => candidate.slotIndex === slotIndex);
    return entry?.exists ? entry.utxo?.token?.nft?.commitment : undefined;
  }

  /**
   * Add a transfer output (plain BCH, no tokens).
   */
  addTransfer(lockingBytecode: Uint8Array, amount: bigint): this {
    if (amount <= 0n) {
      throw new Error('Transfer amount must be positive');
    }
    this.pendingTransfers.push({ lockingBytecode, amount });
    return this;
  }

  /** @internal Add a compiler-derived balanced transfer slot. A Solidity `call{value: 0}` still authenticates
   * its fixed output coordinate, so VM derivation may legitimately recover zero even though the public transfer
   * API rejects non-positive user payments. */
  _addDerivedTransfer(lockingBytecode: Uint8Array, amount: bigint): this {
    if (amount < 0n) throw new Error('Derived transfer amount must not be negative');
    this.pendingTransfers.push({ lockingBytecode, amount });
    return this;
  }

  /**
   * Add a token container transfer output (fungible tokens from a token container).
   */
  addTokenContainerTransfer(
    tokenContainerCategoryId: string, lockingBytecode: Uint8Array, amount: bigint, outputSlot?: number,
  ): this {
    if (amount <= 0n) {
      throw new Error('Token container transfer amount must be positive');
    }
    const insertionOrder = outputSlot ?? this.tokenContainerTransferInsertionCounter;
    this.pendingTokenContainerTransfers.push({
      tokenContainerCategoryId, lockingBytecode, amount,
      insertionOrder,
    });
    this.tokenContainerTransferInsertionCounter = Math.max(
      this.tokenContainerTransferInsertionCounter, insertionOrder + 1,
    );
    return this;
  }

  clearTokenContainerDeposits(): this {
    this.pendingTokenContainerDeposits.clear();
    return this;
  }

  addTokenContainerDeposit(tokenContainerCategoryId: string, amount: bigint): this {
    if (amount <= 0n) throw new Error('Token container deposit amount must be positive');
    const prior = this.pendingTokenContainerDeposits.get(tokenContainerCategoryId) ?? 0n;
    this.pendingTokenContainerDeposits.set(tokenContainerCategoryId, prior + amount);
    return this;
  }

  /**
   * Add a token container transferNft output (NFT with explicit commitment and capability).
   */
  addTokenContainerTransferNft(
    tokenContainerCategoryId: string,
    lockingBytecode: Uint8Array,
    commitment: Uint8Array,
    capability: 'none' | 'mutable' | 'minting',
    outputSlot?: number,
  ): this {
    const insertionOrder = outputSlot ?? this.tokenContainerTransferInsertionCounter;
    this.pendingTokenContainerTransferNfts.push({
      tokenContainerCategoryId, lockingBytecode, commitment, capability,
      insertionOrder,
    });
    this.tokenContainerTransferInsertionCounter = Math.max(
      this.tokenContainerTransferInsertionCounter, insertionOrder + 1,
    );
    return this;
  }

  /**
   * Set the deposit amount to add to the satoshi container balance.
   * Used by payable functions that receive sats into the container (positive msg.value).
   */
  setContainerDepositAmount(amount: bigint): this {
    this.containerDepositAmount = amount;
    return this;
  }

  /**
   * Get the current deposit amount.
   */
  getContainerDepositAmount(): bigint {
    return this.containerDepositAmount;
  }

  /**
   * Clear all pending satoshi transfers (used when replacing auto-derived with user overrides).
   */
  clearTransfers(): this {
    this.pendingTransfers = [];
    return this;
  }

  /**
   * Clear all pending token container FT transfers.
   */
  clearTokenContainerTransfers(): this {
    this.pendingTokenContainerTransfers = [];
    this.tokenContainerTransferInsertionCounter = this.pendingTokenContainerTransferNfts.reduce(
      (next, transfer) => Math.max(next, transfer.insertionOrder + 1), 0,
    );
    return this;
  }

  /**
   * Clear all pending token container NFT transfers.
   */
  clearTokenContainerTransferNfts(): this {
    this.pendingTokenContainerTransferNfts = [];
    this.tokenContainerTransferInsertionCounter = this.pendingTokenContainerTransfers.reduce(
      (next, transfer) => Math.max(next, transfer.insertionOrder + 1), 0,
    );
    return this;
  }

  /**
   * Emit an event with the given arguments.
   * Event NFT outputs are added in build() after entry NFT outputs.
   *
   * @param eventNameOrSignature - Event name (if unambiguous) or full signature e.g. "Transfer(pubkey,int)".
   */
  emitEvent(eventNameOrSignature: string, ...args: EventEmitData['args']): this {
    const eventSignature = this.resolveEventSignature(eventNameOrSignature);
    const eventDef = this.eventDefinitions.find((e) => e.signature === eventSignature);
    this.pendingEventEmits.push({ eventName: eventDef!.name, eventSignature, args });
    return this;
  }

  /** Append a compatibility event after every covenant-positioned output (e.g. an inherited internal emit). */
  emitDetachedEvent(eventNameOrSignature: string, ...args: EventEmitData['args']): this {
    const eventSignature = this.resolveEventSignature(eventNameOrSignature);
    const eventDef = this.eventDefinitions.find((e) => e.signature === eventSignature)!;
    const encodedParts = eventDef.parameters.map((parameter, i) => {
      let value = args[i];
      if (typeof value === 'string') {
        if (parameter.type === 'string') value = new TextEncoder().encode(value);
        else if (parameter.type === 'address' && value.includes(':')) value = addressToLockScript(value);
        else if (parameter.type === 'address' && /^(0x)?0*$/i.test(value)) value = new Uint8Array(0);
        else if (parameter.type === 'address' && /^0x[0-9a-fA-F]*$/.test(value)) value = hexToBin(value.slice(2));
        else if (isHex(value)) value = hexToBin(value);
        else throw new Error(`Invalid event argument at index ${i}: expected a hex string, got '${value}'`);
      }
      return encodePushdataValue(value, parameter.type, this.stateLayout.structs);
    });
    const commitment = new Uint8Array(encodedParts.reduce((sum, part) => sum + part.length, 0));
    let cursor = 0;
    for (const part of encodedParts) { commitment.set(part, cursor); cursor += part.length; }
    this.detachedEventReceipts.push({ eventSignature, commitment: binToHex(commitment) });
    return this;
  }

  registerDetachedEvent(definition: EventDefinitionAbi, lockingBytecode: Uint8Array): this {
    if (!this.eventDefinitions.some((event) => event.signature === definition.signature)) {
      this.eventDefinitions = [...this.eventDefinitions, definition];
    }
    this.eventNftLockingBytecodes.set(definition.signature, lockingBytecode);
    return this;
  }

  private resolveEventSignature(eventNameOrSignature: string): string {
    if (eventNameOrSignature.includes('(')) {
      const match = this.eventDefinitions.find((e) => e.signature === eventNameOrSignature);
      if (!match) throw new Error(`Unknown event signature: ${eventNameOrSignature}`);
      return match.signature;
    }
    const matches = this.eventDefinitions.filter((e) => e.name === eventNameOrSignature);
    if (matches.length === 0) throw new Error(`Unknown event: ${eventNameOrSignature}`);
    if (matches.length > 1) {
      throw new Error(
        `Ambiguous event name '${eventNameOrSignature}', use full signature: ${matches.map((m) => m.signature).join(', ')}`,
      );
    }
    return matches[0].signature;
  }

  /**
   * Add an additional output to the transaction.
   * These outputs are buffered and appended after master + data NFT + entry NFT outputs in build().
   *
   * @throws Error if attempting to create a minting NFT of this contract's category,
   * which would violate the on-chain minting NFT uniqueness check.
   */
  addOutput(output: { to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }): this {
    if (output.token?.category === this.categoryId) {
      throw new Error(
        'Cannot create additional token outputs of this category in a stateful transaction. '
        + 'Token outputs for this category are managed by the covenant system.',
      );
    }
    this.pendingOutputs.push(output);
    return this;
  }

  /**
   * P5b: buffer an unpinned same-category value-chunk output (a LONG sorted-mapping value's persisted chunk).
   * Unlike addOutput, this permits the contract's own category: value chunks are 0x01 mutable NFTs the vmap write
   * covenant tolerates (no total-output bound; minting uniqueness counts only 0x02; C3 skipped for entry access).
   * They are materialized trailing (after dynamic chunks / loop entries) with their commitment fixed, so the
   * auto-derivation never sees them. Soundness is by the entry's stored sha256(value), verified on read.
   */
  setDerivedChunkOutput(
    outputIndex: number, chunk: {
      commitment: string; lockingBytecode: Uint8Array; categoryId?: string; fixedIndex?: boolean;
    },
  ): boolean {
    // A probe-supplied category is already bound to its physical group. Only the formerly unsafe missing case
    // needs global write-identity resolution; descriptor ambiguity refuses to invent a caller-owned default.
    const resolvedCategoryId = chunk.categoryId ?? resolveValueChunkWriteCategory(
      this._valueChunkWriteCategorySelection(), undefined, this.categoryId,
    );
    if (!resolvedCategoryId) return false;
    const ownedChunk = { ...chunk, categoryId: resolvedCategoryId };
    const valueChunkPin = chunk.lockingBytecode.length === 35
      && chunk.lockingBytecode[0] === 0xaa && chunk.lockingBytecode[1] === 0x20
      && chunk.lockingBytecode[34] === 0x87
      && chunk.commitment.length >= 3 && chunk.commitment.length <= 256;
    // A chunk-shaped delegate body also contains INPUTINDEX OUTPUTBYTECODE self-preservation.
    // Never let a false pin replace an implementation minting NFT or a data-NFT occupant.
    // A real value-chunk pin (P2SH32 + uint16||data) must still win: publishJobEvent
    // UPDATE reuses the previous digest's input indexes (20-22) with a new address.
    if (!valueChunkPin) {
      const occupant = this.allInputs[outputIndex];
      if (occupant?.token?.nft?.capability === 'minting') return false;
      for (const [llcIndex, llc] of this.lowLevelCallUtxoGroups.entries()) {
        if (llc.callMode !== 'delegatecall') continue;
        if (this.getLowLevelCallMasterInputIndex(llcIndex) === outputIndex) return false;
      }
    }
    const existing = this.derivedChunkOutputs.get(outputIndex);
    if (existing?.commitment === ownedChunk.commitment
      && binToHex(existing.lockingBytecode) === binToHex(ownedChunk.lockingBytecode)
      && existing.categoryId === ownedChunk.categoryId
      && existing.fixedIndex === ownedChunk.fixedIndex) return false;
    const kept = preferChunkCommitment(existing?.commitment, ownedChunk.commitment);
    if (existing && kept === existing.commitment && kept !== ownedChunk.commitment) return false;
    this.derivedChunkOutputs.set(outputIndex, !existing || kept === ownedChunk.commitment
      ? { ...ownedChunk, commitment: kept }
      : existing);
    if (!ownedChunk.fixedIndex && valueChunkPin && ownedChunk.commitment.length >= 3
      && ownedChunk.commitment !== '00' && !isEmptyValueChunkCommitment(ownedChunk.commitment)) {
      const categoryId = ownedChunk.categoryId;
      this.rememberJobEventsChunks(categoryId, [
        ...this.derivedChunkOutputs.values(),
      ].filter((entry) => (entry.categoryId ?? this.categoryId) === categoryId
        && entry.commitment.length >= 3
        && entry.commitment !== '00'
        && !isEmptyValueChunkCommitment(entry.commitment)));
    }
    return true;
  }

  getDerivedChunkOutputs(): ReadonlyMap<number, {
    commitment: string; lockingBytecode: Uint8Array; categoryId?: string; fixedIndex?: boolean;
  }> {
    return this.derivedChunkOutputs;
  }

  /**
   * Place persist/compose jobEvents chunks before the first VM probe so
   * updateJobPost does not spend the 64-iteration budget rediscovering v.
   */
  seedPersistedJobEventsBand(): number {
    if (!this._shouldRematerializePersistUpdate()) return 0;
    const band = this.getPublishJobEventsBand();
    if (!band) return 0;
    const categoryId = this._jobEventsPublishCategory();
    const value = categoryId ? persistedJobEventsValue(categoryId) : undefined;
    const lock = persistUpdateRedeemLock(
      categoryId, this.jobEventsRedeemLock, this._persistedValueChunkWrite(categoryId),
    )
      ?? this.jobEventsRedeemLock
      ?? (categoryId ? persistedJobEventsLock(categoryId) : undefined);
    if (!value || !lock) return 0;
    if (this.bumpPublishJobEventsWidth(valueChunkCountFor(value))) this._refreshInputs();
    const live = this.getPublishJobEventsBand() ?? band;
    return seedChunksFromPersistedValue(
      (outputIndex, chunk) => this.setDerivedChunkOutput(outputIndex, chunk),
      live.start,
      value,
      lock,
      categoryId,
    );
  }

  addValueChunkOutput(output: { to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }): this {
    this.valueChunkOutputs.push(output);
    return this;
  }

  /**
   * Runtime-loop value chunks occupy the region immediately before one terminal suffix output. The builder
   * guarantees that suffix is either the required external-library sidecar recreation or a zero-value OP_RETURN
   * anchor, and inserts fee change before this region.
   */
  addLateValueChunkOutput(output: { to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }): this {
    this.lateValueChunkOutputs.push(output);
    return this;
  }

  /**
   * Write recovered value-chunk pins onto `builder`. A long UPDATE changes sha256(value)
   * and therefore the chunk P2SH32; same-index recreation of the previous digest must not
   * survive. Returns whether any output changed.
   */
  private _applyDerivedValueChunks(builder: TransactionBuilder): boolean {
    const band = this.getPublishJobEventsBand();
    const repairOwner = selectTokenBandRepairOwner(
      this.externalCallUtxoGroups,
      (categoryId) => this.findMintingInputIndex(categoryId),
      band,
    );
    const tokenWriterPresent = repairOwner.status !== 'absent'
      || this.mintingOutputSwap !== undefined;
    if (band && !tokenWriterPresent && this.derivedChunkOutputs.size > 0) {
      const keys = [...this.derivedChunkOutputs.entries()]
        .filter(([, chunk]) => !chunk.fixedIndex)
        .map(([index]) => index)
        .sort((left, right) => left - right);
      const offBand = keys.some((index) => index < band.start || index > band.end);
      if (offBand) {
        const chunks = keys.map((index) => this.derivedChunkOutputs.get(index)!);
        for (const index of keys) this.derivedChunkOutputs.delete(index);
        for (const [offset, chunk] of chunks.entries()) {
          if (offset >= band.nNew) break;
          this.derivedChunkOutputs.set(band.start + offset, chunk);
        }
      }
    }
    const protectedMasters = new Set<number>();
    for (const [llcIndex, llc] of this.lowLevelCallUtxoGroups.entries()) {
      if (llc.callMode !== 'delegatecall') continue;
      const implIndex = this.getLowLevelCallMasterInputIndex(llcIndex);
      if (implIndex >= 0) protectedMasters.add(implIndex);
    }
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.delegateCallGroupIndex === undefined) continue;
      const masterIndex = this.getExternalCallMasterInputIndex(groupIndex);
      if (masterIndex >= 0) protectedMasters.add(masterIndex);
    }
    const tokenWriterCategory = this.mintingOutputSwap?.categoryId
      ?? (repairOwner.status === 'exact' ? repairOwner.categoryId : undefined);
    for (const [index, input] of this.allInputs.entries()) {
      if (input?.token?.nft?.capability === 'minting') protectedMasters.add(index);
      if (tokenWriterCategory && input?.token?.category === tokenWriterCategory) {
        protectedMasters.add(index);
      }
    }
    let changed = false;
    for (const outputIndex of [...this.derivedChunkOutputs.keys()].sort((left, right) => left - right)) {
      const chunk = this.derivedChunkOutputs.get(outputIndex);
      if (!chunk) continue;
      // Only the caller's own suffix chunks are skipped here. Compiler-described nested chunks are normalized
      // to their writer category when learned, so an absent category can never silently become the caller.
      if (this.delegateDynamicChunksAtSuffix && chunk.categoryId === this.categoryId) continue;
      if (protectedMasters.has(outputIndex)) continue;
      const existing = builder.outputs[outputIndex];
      if (existing) {
        // A minting 1:1 recreation is not an old value-chunk digest. Every
        // P2SH32 used to match `existingIsChunkAddress`, so a participant minting
        // lock could be replaced by a value chunk.
        if (existing.token?.nft?.capability === 'minting') continue;
        const commitHex = String(existing.token?.nft?.commitment ?? '');
        const commitBytes = commitHex.length / 2;
        const existingLock = existing.to instanceof Uint8Array
          ? existing.to
          : existing.to !== undefined ? addressToLockScript(existing.to) : undefined;
        const existingIsChunkAddress = !!existingLock
          && existingLock.length === 35
          && existingLock[0] === 0xaa && existingLock[1] === 0x20
          && existingLock[34] === 0x87;
        // Old digest chunks carry uint16||data up to 128 bytes (VALUE_CHUNK_SIZE+2).
        // A 64-byte cutoff left e607 occupants in place against recovered cc56 pins.
        const valueChunkOccupant = existing.token?.nft?.capability === 'mutable'
          && commitBytes >= 3 && commitBytes <= 128
          && (existingIsChunkAddress || !existing.token?.nft?.commitment);
        const emptyOccupant = !existing.token?.nft || commitHex === '' || commitHex === '00';
        const oldDigestOccupant = existingIsChunkAddress
          && binToHex(existingLock!) !== binToHex(chunk.lockingBytecode);
        const funderOccupant = !existing.token;
        const viewTailOccupant = isOverwritableValueChunkOccupant(existing);
        if (!valueChunkOccupant && !emptyOccupant && !oldDigestOccupant
          && !funderOccupant && !viewTailOccupant) continue;
      }
      while (builder.outputs.length < outputIndex) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      }
      const next = {
        to: chunk.lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: chunk.categoryId ?? this.categoryId,
          nft: { capability: 'mutable' as const, commitment: chunk.commitment },
        },
      };
      next.amount = BigInt(Math.max(1200, calculateDust(next)));
      const existingLock = existing?.to instanceof Uint8Array
        ? existing.to
        : existing?.to !== undefined ? addressToLockScript(existing.to) : undefined;
      const same = existing !== undefined
        && existingLock !== undefined
        && binToHex(existingLock) === binToHex(chunk.lockingBytecode)
        && existing.token?.nft?.commitment === chunk.commitment
        && existing.token?.category === next.token.category;
      if (same) continue;
      if (builder.outputs.length === outputIndex) builder.addOutput(next);
      else builder.outputs[outputIndex] = next;
      changed = true;
    }
    return changed;
  }

  /**
   * Final state/resource preservation can legitimately reclaim a provisional continuation coordinate. Move only
   * compiler-derived, self-describing runs, and only into token-free balanced slots; fixed pins remain immovable.
   */
  private _relocateCollidingDerivedValueChunkRuns(builder: TransactionBuilder): boolean {
    type DerivedChunk = {
      commitment: string; lockingBytecode: Uint8Array; categoryId?: string; fixedIndex?: boolean;
    };
    const outputMatches = (index: number, chunk: DerivedChunk): boolean => {
      const output = builder.outputs[index];
      const lock = output?.to instanceof Uint8Array
        ? output.to : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
      return lock !== undefined
        && binToHex(lock) === binToHex(chunk.lockingBytecode)
        && output.token?.category === (chunk.categoryId ?? this.categoryId)
        && output.token?.nft?.capability === 'mutable'
        && output.token.nft.commitment === chunk.commitment;
    };
    const groups = new Map<string, Array<{ index: number; chunkIndex: number; chunk: DerivedChunk }>>();
    for (const [index, chunk] of this.derivedChunkOutputs) {
      const chunkIndex = valueChunkIndexFromCommitment(chunk.commitment);
      if (chunk.fixedIndex || chunkIndex === undefined || !isP2sh32LockScript(chunk.lockingBytecode)) continue;
      const key = `${chunk.categoryId ?? this.categoryId}:${binToHex(chunk.lockingBytecode)}`;
      const group = groups.get(key) ?? [];
      group.push({ index, chunkIndex, chunk });
      groups.set(key, group);
    }
    let changed = false;
    const changedCarriers = new Set<ExternalCallUtxoGroup>();
    const reserved = new Set<number>([...this.derivedChunkOutputs.entries()].flatMap(([index, chunk]) => (
      chunk.fixedIndex ? [index] : []
    )));
    for (const group of groups.values()) {
      group.sort((left, right) => left.chunkIndex - right.chunkIndex);
      if (group.length === 0 || group.some((entry, offset) => entry.chunkIndex !== offset)) continue;
      const materialized = group.every((entry) => outputMatches(entry.index, entry.chunk));
      if (materialized) {
        for (const entry of group) reserved.add(entry.index);
        continue;
      }
      const base = findDisposableValueChunkOutputBase(builder.outputs, this.allInputs, group.length, reserved);
      if (base === undefined) continue;
      const oldBase = group[0].index;
      for (const entry of group) this.derivedChunkOutputs.delete(entry.index);
      for (const [offset, entry] of group.entries()) {
        const index = base + offset;
        const next = {
          to: entry.chunk.lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: entry.chunk.categoryId ?? this.categoryId,
            nft: { capability: 'mutable' as const, commitment: entry.chunk.commitment },
          },
        };
        next.amount = BigInt(Math.max(1200, calculateDust(next)));
        builder.outputs[index] = next;
        this.derivedChunkOutputs.set(index, { ...entry.chunk, fixedIndex: true });
        reserved.add(index);
      }
      for (const carrier of [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]) {
        if (carrier.valueChunkOutputBase !== oldBase) continue;
        carrier.valueChunkOutputBase = base;
        carrier.internalArgs = {
          ...carrier.internalArgs,
          __internal__valueChunkOutputBase: BigInt(base),
        };
        carrier.refreshInternalArgs?.(
          { __internal__valueChunkOutputBase: BigInt(base) },
          { shiftPredOut: false },
        );
        changedCarriers.add(carrier);
      }
      changed = true;
    }
    if (changedCarriers.size > 0) this._syncRefreshedCarrierMasters(builder, changedCarriers);
    return changed;
  }

  /**
   * Enforce the cardinality of each authenticated, contiguous value-chunk run.
   * Late state/preservation materializers can replay a predecessor outside the
   * derived run after its first cleanup. The compiler counts outputs by redeem
   * lock, so even an exact duplicate at an unowned coordinate is observable.
   */
  private _stripSurplusDerivedValueChunkLocks(builder: TransactionBuilder): number {
    const runs = new Map<string, { lockingBytecode: Uint8Array; indices: number[] }>();
    for (const [outputIndex, chunk] of this.derivedChunkOutputs) {
      if (!isP2sh32LockScript(chunk.lockingBytecode)
        || valueChunkIndexFromCommitment(chunk.commitment) === undefined) continue;
      const lockHex = binToHex(chunk.lockingBytecode);
      const run = runs.get(lockHex) ?? { lockingBytecode: chunk.lockingBytecode, indices: [] };
      run.indices.push(outputIndex);
      runs.set(lockHex, run);
    }
    let stripped = 0;
    for (const run of runs.values()) {
      run.indices.sort((left, right) => left - right);
      const start = run.indices[0];
      if (start === undefined || run.indices.some((index, offset) => index !== start + offset)) continue;
      stripped += stripSurplusValueChunkLocks(
        builder.outputs,
        { start, nNew: run.indices.length },
        run.lockingBytecode,
        this.allInputs,
      );
    }
    return stripped;
  }

  /**
   * Last writer on the view-only path: put publishJobEvent value chunks at
   * impl+trailingBase. Leaves view tails (16/17) and minting masters alone.
   */
  private _materializeJobEventsBand(builder: TransactionBuilder): void {
    const band = this.getPublishJobEventsBand();
    const repairOwner = selectTokenBandRepairOwner(
      this.externalCallUtxoGroups,
      (categoryId) => this.findMintingInputIndex(categoryId),
      band,
    );
    const tokenWriterPresent = repairOwner.status !== 'absent'
      || this.mintingOutputSwap !== undefined;
    // A compiler-described participant already owns this physical band. Rewriting its 1:1 outputs is unsound;
    // ambiguity is likewise a refusal, never permission to choose the first source-level handler.
    if (tokenWriterPresent) return;
    if (!band) return;
    const categoryId = this._jobEventsPublishCategory();
    const fromDerived = [...this.derivedChunkOutputs.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, chunk]) => chunk)
      .filter((chunk) => !chunk.fixedIndex && chunk.lockingBytecode.length === 35
        && chunk.commitment.length >= 3 && chunk.commitment !== '00');
    const derivedOwnerCategory = coherentAuthenticatedValueChunkRun(fromDerived)[0]?.categoryId;
    const stateOwnerCategory = derivedOwnerCategory
      ?? this._persistJobEventsTokenCategory()
      ?? categoryId;
    if (fromDerived.length > 0 && stateOwnerCategory) {
      this.rememberJobEventsChunks(stateOwnerCategory, fromDerived);
    }
    const rematerialize = this._shouldRematerializePersistUpdate();
    const stagedValue = (stateOwnerCategory ? stagedJobEventsValues.get(stateOwnerCategory) : undefined)
      ?? (categoryId ? stagedJobEventsValues.get(categoryId) : undefined);
    const fromStaged = stagedValue
      ? chunksFromJobEventsValue(stagedValue, undefined, stateOwnerCategory)
      : [];
    const persistedValue = rematerialize
      ? ((stateOwnerCategory ? persistedJobEventsValue(stateOwnerCategory) : undefined)
        ?? (categoryId ? persistedJobEventsValue(categoryId) : undefined))
      : undefined;
    const fromValue = persistedValue
      ? chunksFromJobEventsValue(persistedValue, undefined, stateOwnerCategory)
      : [];
    const persistChunks = rematerialize
      ? (this.persistedJobEventsChunks.length > 0
        ? this.persistedJobEventsChunks
        : (stateOwnerCategory
          ? persistedJobEventsByCategory.get(stateOwnerCategory) ?? [] : []))
      : [];
    // VM-observed chunks carry the exact root-addressed locking bytecode. A staged value can reconstruct
    // commitments, but without its collection/slot recipe it cannot authoritatively reconstruct the lock.
    // Keep the observed run atomic rather than allowing a guessed staged lock to replace its identity.
    const observed = selectObservedValueChunkRun(fromStaged, fromDerived);
    const source = rematerialize
      ? firstUsableValueChunkRun(observed, fromValue, persistChunks)
      : observed;
    const seen = new Set<string>();
    const chunks: Array<{ commitment: string; lockingBytecode: Uint8Array; categoryId?: string }> = [];
    for (const chunk of [...source].reverse()) {
      if (seen.has(chunk.commitment)) continue;
      seen.add(chunk.commitment);
      chunks.unshift(chunk);
    }
    chunks.sort((left, right) => {
      const leftIndex = Number.parseInt(left.commitment.slice(0, 2), 16)
        + 256 * Number.parseInt(left.commitment.slice(2, 4) || '00', 16);
      const rightIndex = Number.parseInt(right.commitment.slice(0, 2), 16)
        + 256 * Number.parseInt(right.commitment.slice(2, 4) || '00', 16);
      return leftIndex - rightIndex;
    });
    if (chunks.length === 0) {
      for (const { id, lockingBytecode } of this.getValueChunkVars()) {
        if (lockingBytecode.length !== 35 || lockingBytecode[0] !== 0xaa || lockingBytecode[1] !== 0x20) {
          continue;
        }
        for (const commitment of this.getValueChunkRawCommitments(id)) {
          if (!commitment || commitment === '00') continue;
          chunks.push({ commitment, lockingBytecode, categoryId: stateOwnerCategory ?? this.categoryId });
        }
      }
    }
    if (chunks.length === 0) return;
    // Never grow past the planned write: a longer Created extract (4) on a
    // first post (nNew=2) hung derivation. Fill only up to planned nNew so
    // history (5 of 6) still gets a continuation at slot 25.
    const liveBand = { start: band.start, nNew: band.nNew };
    const previousDerived = new Map(this.derivedChunkOutputs);
    for (const [index, chunk] of previousDerived) {
      if (!chunk.fixedIndex) this.derivedChunkOutputs.delete(index);
    }
    for (const [offset, chunk] of chunks.entries()) {
      const index = liveBand.start + offset;
      const prior = previousDerived.get(index);
      const commitment = preferChunkCommitment(prior?.commitment, chunk.commitment);
      this.derivedChunkOutputs.set(index, {
        ...chunk,
        commitment,
        categoryId: stateOwnerCategory ?? chunk.categoryId ?? prior?.categoryId,
      });
    }
    const liveEnd = liveBand.start + liveBand.nNew - 1;
    for (const [index, prior] of previousDerived) {
      if (prior.fixedIndex) continue;
      if (index < liveBand.start || index > liveEnd) continue;
      if (this.derivedChunkOutputs.has(index)) continue;
      if (isEmptyValueChunkCommitment(prior.commitment) || prior.commitment === '00') continue;
      if (binToHex(prior.lockingBytecode) !== binToHex(chunks[0].lockingBytecode)) continue;
      this.derivedChunkOutputs.set(index, prior);
    }
    const reserved = new Set<number>();
    for (const [index, input] of this.allInputs.entries()) {
      if (input.token?.nft?.capability === 'minting') reserved.add(index);
    }
    for (const [index, group] of this.externalCallUtxoGroups.entries()) {
      if (groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, index)) continue;
      const tail = group.returnOutputIndex ?? group.plannedReturnOutputIndex;
      if (tail !== undefined && tail < liveBand.start) reserved.add(tail);
    }
    const stampDigest = this._shouldStampPersistUpdateDigestLock();
    const persistTokenCategory = stateOwnerCategory;
    const recipeLock = stampDigest
      ? persistUpdateDigestLock(
        persistTokenCategory,
        this._persistDigestCategories(),
        this._persistedValueChunkWrite(persistTokenCategory),
      )
      : undefined;
    const redeemLock = chunks[0]?.lockingBytecode
      ?? recipeLock
      ?? this.jobEventsRedeemLock
      ?? (stateOwnerCategory ? persistedJobEventsLock(stateOwnerCategory) : undefined);
    const placed = applyRedeemLockToChunks(
      [...this.derivedChunkOutputs.entries()]
        .filter(([index]) => index >= liveBand.start && index <= liveEnd)
        .sort(([left], [right]) => left - right)
        .map(([, chunk]) => ({
          ...chunk,
          categoryId: stateOwnerCategory ?? chunk.categoryId,
        })),
      redeemLock ?? new Uint8Array(),
    );
    const occupancyEnd = writerBlockOccupancyEnd(
      this.externalCallUtxoGroups,
      (categoryId) => this.findMintingInputIndex(categoryId),
    );
    const opReturnAt = builder.outputs.findIndex((output, index) => (
      index >= liveBand.start
      && output.to instanceof Uint8Array
      && output.to.length === 1
      && output.to[0] === 0x6a
    ));
    const jobsCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    const suffixStart = opReturnAt >= 0
      ? Math.min(opReturnAt, builder.outputs.length - jobsCount - (jobsCount > 0 ? 1 : 0))
      : builder.outputs.length - jobsCount - (jobsCount > 0 ? 1 : 0);
    placeValueChunksOnBand(builder.outputs, liveBand, placed, reserved, occupancyEnd, suffixStart);
    fillJobEventsBandHoles(builder.outputs, liveBand, {
      lockingBytecode: placed[0].lockingBytecode,
      categoryId: placed[0].categoryId ?? stateOwnerCategory,
    }, reserved, suffixStart, occupancyEnd);
    this._applyDerivedValueChunks(builder);
    const liveLock = placed[0].lockingBytecode;
    stripSurplusValueChunkLocks(builder.outputs, liveBand, liveLock, this.allInputs);
  }

  /**
   * Send-time: size the jobEvents band to the live extracted/persisted nNew and
   * place every continuation, including when transferFrom skipped materialize.
   * Minting 1:1s stay reserved.
   */
  private _ensureLiveJobEventsBand(builder: TransactionBuilder): void {
    const band = this.getPublishJobEventsBand();
    if (!band) return;
    const categoryId = this._jobEventsPublishCategory();
    const fromDerived = [...this.derivedChunkOutputs.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, chunk]) => chunk)
      .filter((chunk) => !chunk.fixedIndex && chunk.lockingBytecode.length === 35
        && chunk.commitment.length >= 3 && chunk.commitment !== '00');
    const derivedOwnerCategory = coherentAuthenticatedValueChunkRun(fromDerived)[0]?.categoryId;
    const persistTokenCategory = derivedOwnerCategory
      ?? this._persistJobEventsTokenCategory()
      ?? categoryId;
    const persistDigestLock = this._shouldStampPersistUpdateDigestLock()
      ? persistUpdateDigestLock(
        persistTokenCategory,
        this._persistDigestCategories(),
        this._persistedValueChunkWrite(persistTokenCategory),
      )
      : (this._shouldRematerializePersistUpdate()
        ? persistUpdateRedeemLock(
          persistTokenCategory, this.jobEventsRedeemLock,
          this._persistedValueChunkWrite(persistTokenCategory),
        )
        : undefined);
    const stagedValue = (categoryId ? stagedJobEventsValues.get(categoryId) : undefined)
      ?? (persistTokenCategory ? stagedJobEventsValues.get(persistTokenCategory) : undefined);
    const persistValue = stagedValue
      ?? (persistTokenCategory ? persistedJobEventsValue(persistTokenCategory) : undefined)
      ?? latestPersisted(persistedJobEventsValues);
    const publishCategory = this._jobEventsPublishCategory();
    const persistVLock = persistValueChunkLock(
      persistTokenCategory, persistValue, this._persistedValueChunkWrite(persistTokenCategory),
    )
      ?? persistValueChunkLock(
        publishCategory, persistValue, this._persistedValueChunkWrite(publishCategory),
      );

    const redeemLock = persistVLock
      ?? persistDigestLock
      ?? this.jobEventsRedeemLock
      ?? (categoryId ? persistedJobEventsLock(categoryId) : undefined);
    const persistedValue = this._shouldRematerializePersistUpdate()
      ? ((persistTokenCategory ? persistedJobEventsValue(persistTokenCategory) : undefined)
        ?? (categoryId ? persistedJobEventsValue(categoryId) : undefined))
      : undefined;
    const fromValue = persistedValue
      ? chunksFromJobEventsValue(persistedValue, redeemLock, persistTokenCategory)
      : [];
    const fromStaged = stagedValue
      ? chunksFromJobEventsValue(stagedValue, redeemLock, persistTokenCategory)
      : [];
    const observed = selectObservedValueChunkRun(fromStaged, fromDerived);
    const source = this._shouldRematerializePersistUpdate()
      ? firstUsableValueChunkRun(observed, fromValue)
      : observed;
    const lockCounts = new Map<string, { lock: Uint8Array; n: number }>();
    for (let index = band.start; index < band.start + Math.max(band.nNew, 8); index++) {
      const lock = builder.outputs[index]?.to;
      if (!(lock instanceof Uint8Array) || lock.length !== 35 || lock[0] !== 0xaa) continue;
      const key = binToHex(lock);
      lockCounts.set(key, { lock, n: (lockCounts.get(key)?.n ?? 0) + 1 });
    }
    let dominant: Uint8Array | undefined;
    let dominantCount = 0;
    for (const value of lockCounts.values()) {
      if (value.n > dominantCount) {
        dominant = value.lock;
        dominantCount = value.n;
      }
    }
    const siblingLock = source[0]?.lockingBytecode
      ?? persistDigestLock
      ?? dominant
      ?? redeemLock
      ?? fromDerived[0]?.lockingBytecode;
    if (!siblingLock || siblingLock.length !== 35) return;
    const persistWidth = categoryId ? persistedJobEventsWidth(categoryId) : 0;
    const liveN = liveJobEventsBandWidth({
      plannedWidth: band.nNew,
      persistWidth,
      derivedWidth: source.length,
    });
    // Dominant lock count can include a leftover probe slot (output 25). The
    // covenant EQUALVERIFYs nNew from v; extra same-lock outputs fail. Grow
    // only from extracted/persisted width, then strip the rest.
    const liveBand = { start: band.start, nNew: Math.max(band.nNew, liveN, 1) };
    const reserved = new Set<number>();
    for (const [index, input] of this.allInputs.entries()) {
      if (input.token?.nft?.capability === 'minting') reserved.add(index);
    }
    const occupancyEnd = writerBlockOccupancyEnd(
      this.externalCallUtxoGroups,
      (categoryId) => this.findMintingInputIndex(categoryId),
    );
    const jobsCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    const suffixStart = builder.outputs.length - jobsCount - (jobsCount > 0 ? 1 : 0);
    placeValueChunksOnBand(builder.outputs, liveBand, applyRedeemLockToChunks(
      source.map((chunk) => ({
        ...chunk,
        lockingBytecode: siblingLock,
        categoryId: persistTokenCategory ?? chunk.categoryId,
      })),
      siblingLock,
    ), reserved, occupancyEnd, suffixStart);
    fillJobEventsBandHoles(builder.outputs, liveBand, {
      lockingBytecode: siblingLock,
      categoryId: persistTokenCategory ?? source[0]?.categoryId,
    }, reserved, suffixStart, occupancyEnd);
    stripSurplusValueChunkLocks(builder.outputs, liveBand, siblingLock, this.allInputs);
    this._packJobsSuffix(builder);
    this._applyDerivedEntryOutputs(builder);
    this._reassertInBlockWriterReturns(builder);
  }

  private _packJobsSuffix(builder: TransactionBuilder): void {
    const band = this.getPublishJobEventsBand();
    const tailStart = band ? band.end + 1 : 0;
    const chunkHex = this.jobEventsRedeemLock ? binToHex(this.jobEventsRedeemLock) : '';
    let jobsLock: Uint8Array | undefined;
    for (let index = builder.outputs.length - 1; index >= tailStart; index--) {
      const lock = builder.outputs[index]?.to instanceof Uint8Array
        ? builder.outputs[index]!.to as Uint8Array : undefined;
      if (!lock || lock.length !== 35 || lock[0] !== 0xaa) continue;
      if (chunkHex && binToHex(lock) === chunkHex) continue;
      if (builder.outputs[index]?.token?.nft?.capability !== 'mutable') continue;
      jobsLock = lock;
      break;
    }
    if (jobsLock) packJobsAgainstOpReturn(builder.outputs, jobsLock, tailStart);
  }

  /**
   * Successful publishJobEvent writes must seed persist even when derivation
   * never failed (the extract-on-fail path never ran). The next UPDATE uses
   * persistWidth to drop insertShift so chunks stay at impl+blockSize.
   */
  private _persistPlacedJobEventsBand(builder: TransactionBuilder, txid?: string): void {
    const band = this.getPublishJobEventsBand();
    if (!band) return;
    const categoryId = this._jobEventsPublishCategory();
    if (!categoryId) return;
    const liveLocks = new Map<string, { lock: Uint8Array; n: number }>();
    for (let index = band.start; index <= band.end; index++) {
      const output = builder.outputs[index];
      const lock = output?.to instanceof Uint8Array ? output.to : undefined;
      if (!lock || lock.length !== 35 || lock[0] !== 0xaa) continue;
      if (output?.token?.nft?.capability !== 'mutable') continue;
      const key = binToHex(lock);
      liveLocks.set(key, { lock, n: (liveLocks.get(key)?.n ?? 0) + 1 });
    }
    let liveLock: Uint8Array | undefined;
    let liveCount = 0;
    for (const value of liveLocks.values()) {
      if (value.n > liveCount) {
        liveLock = value.lock;
        liveCount = value.n;
      }
    }
    const redeemLock = liveLock ?? this.jobEventsRedeemLock ?? persistedJobEventsLock(categoryId);
    const chunks: AuthenticatedValueChunk[] = [];
    const spends: Array<{
      txid: string;
      vout: number;
      satoshis: bigint;
      token: NonNullable<Utxo['token']>;
      lockingBytecode: Uint8Array;
    }> = [];
    for (let index = band.start; index <= band.end; index++) {
      const output = builder.outputs[index];
      const lock = output?.to instanceof Uint8Array ? output.to : undefined;
      const commitment = String(output?.token?.nft?.commitment ?? '');
      if (!lock || lock.length !== 35 || lock[0] !== 0xaa) continue;
      if (output?.token?.nft?.capability !== 'mutable') continue;
      if (commitment.length < 3 || commitment === '00' || isEmptyValueChunkCommitment(commitment)) continue;
      if (redeemLock && binToHex(lock) !== binToHex(redeemLock)) continue;
      chunks.push({
        commitment,
        lockingBytecode: lock,
        categoryId: output.token?.category ?? categoryId,
      });
      if ((commitment.startsWith('00004cb4') || commitment.includes('4372656174'))
        && !createdDigestLocks.has(output.token?.category ?? categoryId)) {
        const persistCat = output.token?.category ?? categoryId;
        persistedJobEventsLocks.set(persistCat, lock);
        createdDigestLocks.add(persistCat);
      }
      if (txid && output.token) {
        spends.push({
          txid,
          vout: index,
          satoshis: output.amount,
          token: output.token,
          lockingBytecode: lock,
        });
      }
    }
    if (chunks.length === 0) return;
    this.rememberJobEventsChunks(categoryId, chunks);
    if (redeemLock) rememberJobEventsLock(categoryId, redeemLock);
    else if (chunks[0]) rememberJobEventsLock(categoryId, chunks[0].lockingBytecode);
    if (spends.length > 0) persistedJobEventsSpends.set(categoryId, spends);
    const staged = stagedJobEventsValues.get(categoryId)
      ?? latestPersisted(stagedJobEventsValues, categoryId);
    if (staged) {
      rememberJobEventsValue(categoryId, staged);
      for (const otherId of stagedJobEventsValues.keys()) rememberJobEventsValue(otherId, staged);
    }
    rememberJobEventsUnlockRecipe(categoryId);
    if (persistedJobEventsValues.size > 0) {
      for (const otherId of persistedJobEventsValues.keys()) rememberJobEventsUnlockRecipe(otherId);
    }
    stagedJobEventsValues.delete(categoryId);
    persistedJobEventsSendReady = true;
  }

  /**
   * Rebase absolute output coordinates when a final, non-covenant output is inserted before the
   * authenticated suffix. Reverse-indexed suffix checks remain valid after the insertion, but composed
   * continuation writers can also receive an absolute `__internal__valueChunkOutputBase` witness. Keep the
   * recovered-output cache and every carrier of that witness aligned with the shifted physical outputs.
   *
   * This is intentionally separate from probe-only suffix insertions: derivation adds a temporary remainder
   * to an ephemeral builder and must not advance persistent coordinates on every probe iteration.
   */
  private _rebindLateValueSuffixAfterInsertion(builder: TransactionBuilder, insertAt: number): void {
    const debugChangeRebind = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_CHANGE_REBIND === '1';
    if (debugChangeRebind) {
      console.error('change-rebind-before', {
        insertAt,
        outputCount: builder.outputs.length,
        derived: [...this.derivedChunkOutputs.entries()].map(([index, chunk]) => ({
          index, categoryId: chunk.categoryId?.slice(0, 8), fixedIndex: chunk.fixedIndex,
        })),
        bases: [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups].flatMap(
          (carrier) => carrier.valueChunkOutputBase === undefined ? [] : [{
            functionName: carrier.logicalFunctionName ?? carrier.functionName,
            base: carrier.valueChunkOutputBase,
          }],
        ),
      });
    }
    const shiftIndexMap = <T>(values: Map<number, T>): Map<number, T> => new Map(
      [...values.entries()].map(([index, value]) => [index >= insertAt ? index + 1 : index, value]),
    );
    this.derivedChunkOutputs = shiftIndexMap(this.derivedChunkOutputs);
    this.externalCallEntryOutputsByIndex = shiftIndexMap(this.externalCallEntryOutputsByIndex);
    this.builtReturnEventOutputIndices = new Map(
      [...this.builtReturnEventOutputIndices.entries()].map(([identity, index]) => [
        identity, index >= insertAt ? index + 1 : index,
      ]),
    );

    const changedCarriers = new Set<ExternalCallUtxoGroup>();
    for (const carrier of [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]) {
      const currentBase = carrier.valueChunkOutputBase;
      if (currentBase === undefined || currentBase < insertAt) continue;
      const nextBase = currentBase + 1;
      carrier.valueChunkOutputBase = nextBase;
      carrier.internalArgs = {
        ...carrier.internalArgs,
        __internal__valueChunkOutputBase: BigInt(nextBase),
      };
      carrier.refreshInternalArgs?.(
        { __internal__valueChunkOutputBase: BigInt(nextBase) },
        { shiftPredOut: false },
      );
      changedCarriers.add(carrier);
    }
    if (changedCarriers.size > 0) this._syncRefreshedCarrierMasters(builder, changedCarriers);
    if (debugChangeRebind) {
      console.error('change-rebind-after', {
        derived: [...this.derivedChunkOutputs.keys()],
        bases: [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups].flatMap(
          (carrier) => carrier.valueChunkOutputBase === undefined ? [] : [{
            functionName: carrier.logicalFunctionName ?? carrier.functionName,
            base: carrier.valueChunkOutputBase,
          }],
        ),
      });
    }
  }

  /**
   * Rebind an absolute continuation witness when a participant-owned output is materialized after the route
   * probe selected its append coordinate. The continuation itself is self-describing: a contiguous run of
   * mutable P2SH32 outputs in the participant category, with uint16-le indices 0..n-1. Only search forward from
   * the authenticated provisional base, so an older chunk run cannot be mistaken for the new write.
   */
  private _reconcileMaterializedValueChunkWitnesses(builder: TransactionBuilder): boolean {
    const carriers = [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups];
    const occupiedBases = new Set(carriers.flatMap((carrier) => (
      carrier.valueChunkOutputBase === undefined ? [] : [carrier.valueChunkOutputBase]
    )));
    const changedCarriers = new Set<ExternalCallUtxoGroup>();
    const expectedRuns = new Map<ExternalCallUtxoGroup, AuthenticatedValueChunk[] | undefined>();
    const outputCategoryIds = new Map<ExternalCallUtxoGroup, string>();
    for (const [carrierIndex, carrier] of carriers.entries()) {
      const lowLevelIndex = carrierIndex - this.externalCallUtxoGroups.length;
      const delegatedProxy = lowLevelIndex < 0 ? undefined : this.externalCallUtxoGroups.find(
        (group) => group.delegateCallGroupIndex === lowLevelIndex,
      );
      const outputCategoryId = carrier.callMode === 'delegatecall'
        ? delegatedProxy?.categoryId ?? this.categoryId
        : carrier.categoryId;
      outputCategoryIds.set(carrier, outputCategoryId);

      // The derived pin at the provisional coordinate remains authoritative even if a later state materializer
      // legitimately replaced that output. Its root-addressed lock distinguishes this computed-value run from a
      // dynamic-state run, whose commitments also begin with little-endian indices 0, 1, ... .
      const provisional = carrier.valueChunkOutputBase;
      const provisionalChunk = provisional === undefined
        ? undefined : this.derivedChunkOutputs.get(provisional);
      let expected = provisionalChunk
        && (provisionalChunk.categoryId ?? this.categoryId) === outputCategoryId
        ? coherentAuthenticatedValueChunkRun([...this.derivedChunkOutputs.entries()]
          .filter(([, chunk]) => (chunk.categoryId ?? this.categoryId) === outputCategoryId
            && binToHex(chunk.lockingBytecode) === binToHex(provisionalChunk.lockingBytecode))
          .sort(([left], [right]) => left - right)
          .map(([, chunk]) => chunk))
        : [];

      if (expected.length === 0) {
        const abiFunction = carrier.compilerRoute?.abiFunction
          ?? (carrier.externalContract?.inner.artifact.abi as readonly AbiFunction[] | undefined)
            ?.find((candidate) => candidate.name === carrier.functionName);
        const observedRuns = (abiFunction?.entryAccesses ?? []).flatMap((access) => {
          if (!access.operations.includes('write')) return [];
          const collection = carrier.stateLayout.collections?.find((candidate) => (
            candidate.name === access.collection || candidate.signature === access.collection
          ));
          if (collection?.chunkableValue !== true || !collection.valueType.endsWith('[]')) return [];
          const run = coherentAuthenticatedValueChunkRun(observedValueChunksByCollection.get(
            `${outputCategoryId.toLowerCase()}:${access.collection}`,
          ) ?? []);
          return run.length > 0 ? [run] : [];
        });
        const uniqueRuns = new Map(observedRuns.map((run) => [
          run.map((chunk) => `${binToHex(chunk.lockingBytecode)}:${chunk.commitment}`).join('|'), run,
        ]));
        if (uniqueRuns.size === 1) expected = [...uniqueRuns.values()][0];
      }
      expectedRuns.set(carrier, expected.length > 0 ? expected : undefined);
    }
    const runIdentity = (carrier: ExternalCallUtxoGroup): string | undefined => {
      const expected = expectedRuns.get(carrier);
      if (!expected) return undefined;
      return `${outputCategoryIds.get(carrier)}:${expected
        .map((chunk) => `${binToHex(chunk.lockingBytecode)}:${chunk.commitment}`).join('|')}`;
    };
    const isRun = (carrier: ExternalCallUtxoGroup, start: number): boolean => {
      const expected = expectedRuns.get(carrier);
      const count = expected?.length ?? carrier.valueChunkOutputCount ?? 1;
      if (count <= 0) return false;
      let runLock: string | undefined;
      for (let offset = 0; offset < count; offset += 1) {
        const output = builder.outputs[start + offset];
        const token = output?.token;
        const nft = token?.nft;
        const lock = output?.to instanceof Uint8Array
          ? output.to : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
        if (!isP2sh32LockScript(lock)
          || token?.category !== outputCategoryIds.get(carrier)
          || nft?.capability !== 'mutable'
          || valueChunkIndexFromCommitment(nft.commitment) !== offset) return false;
        const lockHex = binToHex(lock);
        const expectedChunk = expected?.[offset];
        if (expectedChunk && (lockHex !== binToHex(expectedChunk.lockingBytecode)
          || nft.commitment !== expectedChunk.commitment)) return false;
        if (runLock !== undefined && lockHex !== runLock) return false;
        runLock = lockHex;
      }
      return true;
    };

    for (const carrier of carriers) {
      const currentBase = carrier.valueChunkOutputBase;
      if (currentBase === undefined || isRun(carrier, currentBase)) continue;
      let materializedBase = -1;
      for (let candidate = currentBase + 1; candidate < builder.outputs.length; candidate += 1) {
        if (occupiedBases.has(candidate) || !isRun(carrier, candidate)) continue;
        materializedBase = candidate;
        break;
      }
      if (materializedBase < 0) continue;
      occupiedBases.delete(currentBase);
      occupiedBases.add(materializedBase);
      const identity = runIdentity(carrier);
      // Proxy and delegate records can carry the same physical witness. Rebind only aliases proven to describe
      // this exact authenticated run; unrelated writers that happened to share a provisional coordinate remain
      // independent and will resolve against their own root lock.
      const aliases = identity === undefined ? [carrier] : carriers.filter((candidate) => (
        candidate.valueChunkOutputBase === currentBase && runIdentity(candidate) === identity
      ));
      for (const alias of aliases) {
        alias.valueChunkOutputBase = materializedBase;
        alias.internalArgs = {
          ...alias.internalArgs,
          __internal__valueChunkOutputBase: BigInt(materializedBase),
        };
        alias.refreshInternalArgs?.(
          { __internal__valueChunkOutputBase: BigInt(materializedBase) },
          { shiftPredOut: false },
        );
        changedCarriers.add(alias);
      }
    }
    if (changedCarriers.size === 0) return false;
    this._syncRefreshedCarrierMasters(builder, changedCarriers);
    return true;
  }

  /**
   * Bind compiler-owned continuation witnesses after every output in an isolated composition block has been
   * materialized. Graph routes can represent several logical calls with one low-level carrier, so discovery is
   * based on ABI/state-layout metadata and the self-describing output run rather than a source function name.
   * @internal
   */
  bindMaterializedValueChunkWitnesses(builder: TransactionBuilder, coordinateBase = 0): boolean {
    const carriers = [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups];
    const changedCarriers = new Set<ExternalCallUtxoGroup>();
    const occupiedBases = new Set<number>();

    for (const [carrierIndex, carrier] of carriers.entries()) {
      const abiFunction = carrier.compilerRoute?.abiFunction
        ?? (carrier.externalContract?.inner.artifact.abi as readonly AbiFunction[] | undefined)
          ?.find((candidate) => candidate.name === carrier.functionName);
      if (!abiFunction?.inputs.some((input) => input.name === '__internal__valueChunkOutputBase')) continue;
      const activeFunctions = carrier.compilerRoute?.abiFunction === abiFunction
        && (carrier.compilerRoute.rowArguments?.length ?? 0) > 0
        ? carrier.compilerRoute.rowArguments!.map((row) => row.handler)
        : [abiFunction];
      const activeWriteCollections = (abiFunction as AbiFunction & {
        messageBusActiveWriteCollections?: readonly string[];
      }).messageBusActiveWriteCollections;
      const chunkableCollections = [...new Set(activeFunctions.flatMap((activeFunction) => (
        activeFunction.entryAccesses ?? []
      ).flatMap((access) => {
        if (!access.operations.includes('write')
          || (activeWriteCollections !== undefined
            && !activeWriteCollections.includes(access.collection))) return [];
        const collection = carrier.stateLayout.collections?.find((candidate) => (
          candidate.name === access.collection || candidate.signature === access.collection
        ));
        return collection?.chunkableValue === true && collection.valueType.endsWith('[]')
          ? [access.collection] : [];
      })))];
      if (chunkableCollections.length === 0) continue;

      const lowLevelIndex = carrierIndex - this.externalCallUtxoGroups.length;
      const delegatedProxy = lowLevelIndex < 0 ? undefined : this.externalCallUtxoGroups.find(
        (group) => group.delegateCallGroupIndex === lowLevelIndex,
      );
      const outputCategoryId = carrier.callMode === 'delegatecall'
        ? delegatedProxy?.categoryId ?? this.categoryId
        : carrier.categoryId;
      let selectedStart = -1;
      const provisionalBase = carrier.valueChunkOutputBase;
      let preferredLocalBase = provisionalBase === undefined || provisionalBase < 0
        ? undefined
        : provisionalBase >= coordinateBase ? provisionalBase - coordinateBase : provisionalBase;
      let candidateStarts = [...this.derivedChunkOutputs.entries()]
        .filter(([, chunk]) => (chunk.categoryId ?? this.categoryId) === outputCategoryId
          && valueChunkIndexFromCommitment(chunk.commitment) === 0)
        .map(([start]) => start)
        .sort((left, right) => left - right);
      if (candidateStarts.length === 0) {
        const observedRuns = chunkableCollections.flatMap((collection) => {
          const run = coherentAuthenticatedValueChunkRun(observedValueChunksByCollection.get(
            `${outputCategoryId.toLowerCase()}:${collection}`,
          ) ?? []);
          return run.length > 0 ? [run] : [];
        });
        const uniqueRuns = new Map(observedRuns.map((run) => [
          run.map((chunk) => `${binToHex(chunk.lockingBytecode)}:${chunk.commitment}`).join('|'), run,
        ]));
        const matchesAt = (run: readonly AuthenticatedValueChunk[], start: number): boolean => (
          run.every((chunk, offset) => {
            const output = builder.outputs[start + offset];
            const lock = output?.to instanceof Uint8Array
              ? output.to : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
            return lock !== undefined
              && binToHex(lock) === binToHex(chunk.lockingBytecode)
              && output.token?.category === outputCategoryId
              && output.token?.nft?.capability === 'mutable'
              && output.token.nft.commitment === chunk.commitment;
          })
        );
        const materializedRuns = [...uniqueRuns.values()].flatMap((run) => builder.outputs.flatMap(
          (_, start) => matchesAt(run, start) ? [{ run, start }] : [],
        ));
        const preferredRun = preferredLocalBase === undefined ? undefined : materializedRuns.find(
          ({ start }) => start === preferredLocalBase,
        );
        const selectedRun = preferredRun
          ?? (materializedRuns.length === 1 ? materializedRuns[0] : undefined);
        const soleObservedRun = uniqueRuns.size === 1 ? [...uniqueRuns.values()][0] : undefined;
        const run = selectedRun?.run ?? soleObservedRun;
        if (run) {
          const reserved = new Set(this.derivedChunkOutputs.keys());
          let base: number | undefined;
          if (selectedRun) {
            base = selectedRun.start;
          } else {
            base = findDisposableValueChunkOutputBase(builder.outputs, this.allInputs, run.length, reserved);
          }
          if (base !== undefined) {
            for (const [offset, chunk] of run.entries()) {
              const index = base + offset;
              const next = {
                to: chunk.lockingBytecode,
                amount: 1200n,
                token: {
                  amount: 0n,
                  category: outputCategoryId,
                  nft: { capability: 'mutable' as const, commitment: chunk.commitment },
                },
              };
              next.amount = BigInt(Math.max(1200, calculateDust(next)));
              builder.outputs[index] = next;
              this.derivedChunkOutputs.set(index, {
                ...chunk, categoryId: outputCategoryId, fixedIndex: true,
              });
            }
            carrier.valueChunkOutputBase = base;
            preferredLocalBase = base;
            candidateStarts = [base];
          }
        }
      }
      const eligibleStarts = preferredLocalBase !== undefined
        ? candidateStarts.filter((start) => start === preferredLocalBase)
        : candidateStarts.length === 1 ? candidateStarts : [];
      for (const start of eligibleStarts) {
        const firstExpected = this.derivedChunkOutputs.get(start)!;
        const runLock = binToHex(firstExpected.lockingBytecode);
        let expectedWidth = 0;
        while (start + expectedWidth < builder.outputs.length) {
          const expected = this.derivedChunkOutputs.get(start + expectedWidth);
          if (!expected || (expected.categoryId ?? this.categoryId) !== outputCategoryId
            || binToHex(expected.lockingBytecode) !== runLock
            || valueChunkIndexFromCommitment(expected.commitment) !== expectedWidth) break;
          expectedWidth += 1;
        }
        let width = 0;
        while (width < expectedWidth) {
          const expected = this.derivedChunkOutputs.get(start + width);
          if (!expected) break;
          const output = builder.outputs[start + width];
          const lock = output?.to instanceof Uint8Array
            ? output.to : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
          if (!isP2sh32LockScript(lock)
            || binToHex(lock) !== runLock
            || output.token?.category !== outputCategoryId
            || output.token.nft?.capability !== 'mutable'
            || output.token.nft.commitment !== expected.commitment) break;
          width += 1;
        }
        if (expectedWidth === 0 || width !== expectedWidth) continue;
        const absoluteStart = coordinateBase + start;
        if (!occupiedBases.has(absoluteStart)) selectedStart = start;
      }
      if (selectedStart < 0) continue;
      const absoluteStart = coordinateBase + selectedStart;
      occupiedBases.add(absoluteStart);
      if (carrier.valueChunkOutputBase === absoluteStart) continue;
      carrier.valueChunkOutputBase = absoluteStart;
      carrier.internalArgs = {
        ...carrier.internalArgs,
        __internal__valueChunkOutputBase: BigInt(absoluteStart),
      };
      carrier.refreshInternalArgs?.(
        { __internal__valueChunkOutputBase: BigInt(absoluteStart) },
        { shiftPredOut: false },
      );
      changedCarriers.add(carrier);
    }
    if (changedCarriers.size === 0) return false;
    this._syncRefreshedCarrierMasters(builder, changedCarriers);
    return true;
  }

  /** Insert a non-covenant output before the authenticated [late chunks][terminal suffix] region. */
  insertBeforeLateValueSuffix(
    builder: TransactionBuilder,
    output: Output,
    options: { rebindAbsoluteWitnesses?: boolean } = {},
  ): void {
    const delegateDynamicCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    const authenticatedSuffixCount = delegateDynamicCount + this.lateValueChunkOutputs.length;
    if (authenticatedSuffixCount === 0) {
      builder.addOutput(output);
      return;
    }
    const insertAt = continuationOutputBaseBeforeSuffix(
      builder.outputs.length,
      authenticatedSuffixCount,
    );
    builder.outputs.splice(insertAt, 0, output);
    if (options.rebindAbsoluteWitnesses) {
      this._rebindLateValueSuffixAfterInsertion(builder, insertAt);
    }
  }

  /** Absolute append coordinate which preserves any reverse-indexed output suffix. */
  getContinuationOutputBase(builder: TransactionBuilder): number {
    const delegateDynamicCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    return continuationOutputBaseBeforeSuffix(
      builder.outputs.length,
      delegateDynamicCount + this.lateValueChunkOutputs.length,
    );
  }

  /** Pin a collection's loop-entry (NEW) commitment as known-exactly, so auto-derivation skips re-deriving it. */
  pinLoopEntry(collection: string): this {
    this.pinnedLoopEntries.add(collection);
    return this;
  }

  /** Whether a collection's loop-entry (NEW) commitment is pinned (injected exactly, not trace-derived). */
  isLoopEntryPinned(collection: string): boolean {
    return this.pinnedLoopEntries.has(collection);
  }

  /** Register a collection whose value chunks are DERIVED from the trace (computed value, no direct param). */
  registerValueChunkVar(
    collection: string, lockingBytecode: Uint8Array, id = collection, slot?: Uint8Array,
  ): this {
    this.valueChunkVars.set(id, { collection, lockingBytecode, ...(slot && { slot }) });
    return this;
  }

  setValueChunkLockingBytecode(id: string, lockingBytecode: Uint8Array): this {
    const value = this.valueChunkVars.get(id);
    if (!value) throw new Error(`value chunk run not registered: ${id}`);
    this.valueChunkVars.set(id, { ...value, lockingBytecode });
    return this;
  }

  getValueChunkVars(): Array<{
    id: string; collection: string; lockingBytecode: Uint8Array; slot?: Uint8Array;
  }> {
    return [...this.valueChunkVars.entries()].map(([id, value]) => ({ id, ...value }));
  }

  setValueChunkRawCommitments(id: string, commitments: string[]): this {
    this.valueChunkRawCommitments.set(id, commitments);
    return this;
  }

  getValueChunkRawCommitments(id: string): string[] {
    return this.valueChunkRawCommitments.get(id) ?? [];
  }

  /** Output index where value chunks begin: after the block, dynamic chunks, and loop-entry (NEW) outputs. */
  getValueChunkOutputBase(): number {
    if (this.delegateEntriesAfterLowLevel) {
      return this.getLoopEntryOutputBase() + this._loopEntryOutputCount();
    }
    let base = this.getChunkOutputBase();
    for (const dv of this.dynamicChunkVars) base += (this.chunkRawCommitments.get(dv.name) ?? []).length;
    if (!this.loopEntriesBeforeDynamicChunks) {
      base += this._trailingLoopEntryOutputCount();
    }
    return base;
  }

  /**
   * Build and finalize the transaction, creating data NFT outputs with updated commitments.
   */
  /**
   * Set a return event output for a cross-contract call.
   */
  /**
   * Publish already-known view / loop return commitments so the first `build()` has the
   * same tail occupancy the covenants will read. Derivation used to install these only
   * after transfer probes, so `idx0` named a hole and `meceTags` width never existed.
   */
  seedPrecomputedReturnEvents(
    returning: ReadonlyArray<{ hasReturnValues?: boolean } | undefined> = [],
  ): this {
    const initialized = new Set<number>();
    for (const [groupIdx, group] of this.externalCallUtxoGroups.entries()) {
      const returns = returning[groupIdx]?.hasReturnValues === true
        || group.precomputedReturnCommitment !== undefined
        || (group.loopReturnCommitments?.length ?? 0) > 0;
      if (!returns) continue;
      const physicalGroupIdx = group.sharedGroupIndex ?? groupIdx;
      if (initialized.has(physicalGroupIdx)) continue;
      initialized.add(physicalGroupIdx);
      const family = this.externalCallUtxoGroups
        .map((candidate, candidateIdx) => ({ candidate, candidateIdx }))
        .filter(({ candidate, candidateIdx }) => (
          (candidate.sharedGroupIndex ?? candidateIdx) === physicalGroupIdx
          && (returning[candidateIdx]?.hasReturnValues === true
            || candidate.precomputedReturnCommitment !== undefined
            || (candidate.loopReturnCommitments?.length ?? 0) > 0)
        ));
      const physical = this.externalCallUtxoGroups[physicalGroupIdx];
      const complete = family.every(({ candidate }) => candidate.precomputedReturnCommitment !== undefined);
      const fallback = physical.precomputedReturnCommitment ?? new Uint8Array([0]);
      for (const { candidate, candidateIdx } of family) {
        const parts = candidate.loopReturnCommitments?.length
          ? candidate.loopReturnCommitments
          : [candidate.precomputedReturnCommitment ?? fallback];
        for (const [partIndex, part] of parts.entries()) {
          this.setReturnEventOutput(
            physical.categoryId,
            part,
            `external-call:${candidateIdx}:${partIndex}`,
            candidate.precomputedReturnCommitment === undefined
              && !(candidate.loopReturnCommitments?.length),
          );
        }
      }
      if (!complete) {
        const fused = physical.fusedReturnGroupIndex ?? family.at(-1)?.candidateIdx ?? physicalGroupIdx;
        this.setReturnEventOutput(physical.categoryId, fallback, `external-call:${fused}`, true);
      }
    }
    return this;
  }

  setReturnEventOutput(
    categoryId: string, commitment: Uint8Array, identity = categoryId, provisional = false,
  ): this {
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_FAILURE_RING === '1') {
      console.error('set-return-event-output', {
        identity, categoryId, commitment: binToHex(commitment),
      });
    }
    // A contract may be called more than once in one composed transaction.
    // Category identifies the token; identity identifies the call/return slot.
    const existing = this.pendingReturnEventOutputs.findIndex((r) => r.identity === identity);
    if (existing >= 0) {
      if (!shouldReplaceReturnEventCommitment(
        this.pendingReturnEventOutputs[existing].provisional,
        provisional,
      )) {
        return this;
      }
      this.pendingReturnEventOutputs[existing] = { categoryId, commitment, identity, provisional };
    } else {
      this.pendingReturnEventOutputs.push({ categoryId, commitment, identity, provisional });
    }
    // `external-call:N` and `external-call:N:0` are aliases for the first physical return part. Precomputed
    // seeding intentionally creates the numbered form before a participant probe can authenticate the whole-call
    // form. Keep an already-present counterpart synchronized once either alias becomes non-provisional, otherwise
    // in-block materialization can select the older provisional value simply because it was inserted first.
    if (!provisional) {
      const whole = /^external-call:(\d+)$/.exec(identity);
      const numbered = /^external-call:(\d+):0$/.exec(identity);
      const alias = whole ? `${identity}:0` : numbered ? `external-call:${numbered[1]}` : undefined;
      const aliasIndex = alias === undefined
        ? -1 : this.pendingReturnEventOutputs.findIndex((event) => event.identity === alias);
      if (aliasIndex >= 0) {
        if (shouldReplaceReturnEventCommitment(
          this.pendingReturnEventOutputs[aliasIndex].provisional,
          false,
        )) {
          this.pendingReturnEventOutputs[aliasIndex] = {
            categoryId, commitment, identity: alias!, provisional: false,
          };
        }
      }
    }
    return this;
  }

  /** Debug/derivation snapshot of pending return events without exposing mutable builder state. */
  getReturnEventOutputs(): ReadonlyArray<Readonly<{
    categoryId: string; commitment: Uint8Array; identity: string; provisional?: boolean;
  }>> {
    return this.pendingReturnEventOutputs.map((event) => ({
      ...event, commitment: event.commitment.slice(),
    }));
  }

  /** Physical output index recorded by the most recent build for a logical return identity. */
  getBuiltReturnEventOutputIndex(identity: string): number {
    return this.builtReturnEventOutputIndices.get(identity)
      ?? this.builtReturnEventOutputIndices.get(`${identity}:0`)
      ?? -1;
  }

  /** Physical output index recorded by the most recent build for an external-call group's first return. */
  getBuiltExternalCallReturnEventOutputIndex(groupIdx: number): number {
    const group = this.externalCallUtxoGroups[groupIdx];
    if (group && this.isInBlockReturnEventGroup(groupIdx)) {
      const physical = this.externalCallUtxoGroups[group.sharedGroupIndex ?? groupIdx];
      const offset = physical?.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent')?.offset;
      const master = this.findMintingInputIndex(physical.categoryId);
      if (master >= 0 && offset !== undefined) return master + offset;
    }
    const identity = `external-call:${groupIdx}`;
    if (this.isInBlockReturnEventGroup(groupIdx)) {
      return this.builtReturnEventOutputIndices.get(identity)
        ?? this.builtReturnEventOutputIndices.get(`${identity}:0`)
        ?? -1;
    }
    return this.builtReturnEventOutputIndices.get(`${identity}:0`)
      ?? this.builtReturnEventOutputIndices.get(identity)
      ?? -1;
  }

  /**
   * Remove all pending return event outputs (used before re-populating with derived values).
   */
  clearReturnEventOutputs(): this {
    this.pendingReturnEventOutputs = [];
    return this;
  }

  /**
   * Set a raw entry NFT commitment by slot index (from auto-derivation).
   */
  setEntryRawCommitment(slotIndex: number, commitment: string): this {
    if (!Number.isInteger(slotIndex) || slotIndex < 0) {
      throw new Error(`Invalid slot index ${slotIndex}: must be a non-negative integer`);
    }
    if (!/^([0-9a-f]{2})*$/i.test(commitment)) {
      throw new Error(`Invalid hex string for entry raw commitment at slot ${slotIndex}`);
    }
    this.entryRawCommitments.set(slotIndex, commitment);
    return this;
  }

  /** Mark an entry slot's commitment as known exactly (injected), so auto-derivation must not re-derive it. */
  pinEntrySlot(slotIndex: number): this { this.pinnedEntrySlots.add(slotIndex); return this; }

  /** Whether slot's commitment was pinned via pinEntrySlot (auto-derivation should skip it). */
  isEntrySlotPinned(slotIndex: number): boolean { return this.pinnedEntrySlots.has(slotIndex); }

  /**
   * Set the ordered chunk commitments for a dynamic-storage var (from auto-derivation). The number of
   * commitments determines how many trailing chunk NFT outputs are created.
   */
  setChunkRawCommitments(varName: string, commitments: string[]): this {
    this.chunkRawCommitments.set(varName, commitments);
    return this;
  }

  getDynamicChunkVars(): Array<{
    name: string; type: string; lockingBytecode: Uint8Array; delegate?: boolean; delegateSuffix?: boolean;
  }> {
    return this.dynamicChunkVars;
  }

  getChunkRawCommitments(varName: string): string[] {
    return this.chunkRawCommitments.get(varName) ?? [];
  }

  /**
   * Output index where chunk NFTs begin: the block-layout blockSize (chunks are trailing outputs at
   * OP_INPUTINDEX + blockSize + i, matching the dynamic-write covenant). Falls back to the computed
   * trailing position when no block layout is present.
   */
  getChunkOutputBase(): number {
    // New write chunks come AFTER the preserved iteration-entry outputs (read-only co-spent chunks /
    // collection-iter entries), which occupy [blockSize, blockSize+count) to match their input indices.
    let base = this.blockLayout?.trailingBase
      ?? this.blockLayout?.blockSize
      ?? this.getEventOutputBase() + this.getEventOutputCount();
    // blockSize reserves the returnEvent slot, but an ordinary plain send compacts it. Runtime loop effects are
    // different: their authenticated trailing indices begin after the complete fixed block, so they keep the
    // inactive slot and the padding pass below materializes it before the effect stream.
    const hasReturnEventSlot = this.blockLayout?.slots.some((s) => s.kind === 'returnEvent') ?? false;
    if (this.blockLayout?.trailingBase === undefined
      && hasReturnEventSlot && this.pendingReturnEventOutputs.length === 0
      && this.runtimeLoopEventOutputs.length === 0 && this.runtimeLoopTransferOutputs.length === 0) base -= 1;
    // build() preserves low-level-call UTXOs before the trailing dynamic region.
    // Delegate bytecode likewise anchors trailing storage after its own co-spent
    // implementation block rather than overlapping that block's outputs.
    const lowLevelCallOutputCount = this.compilerRouteDelegateBlock
      ? 0
      : this.blockLayout?.slots.some((slot) => slot.kind === 'lowLevelCall')
      ? 0
      : this.lowLevelCallUtxoGroups.reduce(
        (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
      ) + this.lowLevelCallRawInputs.length;
    // External call blocks and their tail return events are emitted before local dynamic chunks, but they are
    // outside this function's blockLayout. Include their physical span so trace extraction observes the same
    // output indices that the compiler's dynamic-write covenant verifies.
    const externalCallOutputCount = this.externalCallUtxoGroups.reduce((sum, group) => {
      if (group.sharedGroupIndex !== undefined) return sum;
      return sum + (group.blockInputs?.length ?? 1 + group.dataNftUtxos.length);
    }, 0);
    const externalReturnOutputCount = this.tailReturnEventOutputs()
      .filter((returnEvent) => returnEvent.categoryId !== this.categoryId).length;
    const trailingBase = base + externalCallOutputCount + externalReturnOutputCount
      + lowLevelCallOutputCount + this.iterationEntryInputs.length;
    if (this.delegateEntriesAfterLowLevel) {
      // Delegate-only loop entries are appended after the caller's reserved trailing block. They must not move
      // the caller's dynamic-chunk base into that delegate suffix; only local loop entries precede local chunks.
      return trailingBase + this._trailingLoopEntryOutputCount() + this._valueChunkOutputCount()
        + this.pendingOutputs.length;
    }
    return trailingBase
      + (this.loopEntriesBeforeDynamicChunks ? this._trailingLoopEntryOutputCount() : 0)
      + this.runtimeLoopEventOutputs.length
      + this.runtimeLoopTransferOutputs.length;
  }

  private _dynamicChunkOutputCount(): number {
    if (this.delegateDynamicChunksAtSuffix) {
      const recovered = [...this.derivedChunkOutputs.values()].filter((chunk) =>
        (chunk.categoryId ?? this.categoryId) === this.categoryId);
      if (recovered.length > 0) return recovered.length;
    }
    let n = 0;
    for (const dv of this.dynamicChunkVars) n += (this.chunkRawCommitments.get(dv.name) ?? []).length;
    return n;
  }

  private _valueChunkOutputCount(): number {
    return this.valueChunkOutputs.length
      + [...this.valueChunkRawCommitments.values()].reduce((sum, commitments) => sum + commitments.length, 0);
  }

  /** First output occupied by the ordered runtime-loop event family. */
  getRuntimeLoopEventOutputBase(): number {
    if (this.runtimeLoopTrailingSegments.length > 0 && this.runtimeLoopEventOutputs.length > 0) {
      return this.getRuntimeLoopEventOutputIndex(0);
    }
    return this.getChunkOutputBase() - this.runtimeLoopTransferOutputs.length
      - this.runtimeLoopEventOutputs.length;
  }

  getRuntimeLoopEventOutputIndex(eventIndex: number): number {
    if (this.runtimeLoopTrailingSegments.length === 0) {
      return this.getChunkOutputBase() - this.runtimeLoopTransferOutputs.length
        - this.runtimeLoopEventOutputs.length + eventIndex;
    }
    let physical = this.getChunkOutputBase()
      - this._trailingLoopEntryOutputCount() - this.runtimeLoopEventOutputs.length
      - this.runtimeLoopTransferOutputs.length;
    for (const segment of this.runtimeLoopTrailingSegments) {
      if (segment.kind === 'events'
        && eventIndex >= segment.offset && eventIndex < segment.offset + segment.count) {
        return physical + eventIndex - segment.offset;
      }
      physical += segment.count;
    }
    throw new Error(`Runtime loop event ${eventIndex} is missing from the trailing segment plan`);
  }

  getRuntimeLoopTransferOutputIndex(transferIndex: number): number {
    if (this.runtimeLoopTrailingSegments.length === 0) {
      return this.getChunkOutputBase() - this.runtimeLoopTransferOutputs.length + transferIndex;
    }
    let physical = this.getChunkOutputBase()
      - this._trailingLoopEntryOutputCount() - this.runtimeLoopEventOutputs.length
      - this.runtimeLoopTransferOutputs.length;
    for (const segment of this.runtimeLoopTrailingSegments) {
      if (segment.kind === 'transfers'
        && transferIndex >= segment.offset && transferIndex < segment.offset + segment.count) {
        return physical + transferIndex - segment.offset;
      }
      physical += segment.count;
    }
    throw new Error(`Runtime loop transfer ${transferIndex} is missing from the trailing segment plan`);
  }

  getRuntimeLoopTransferOutputs(): ReadonlyArray<RuntimeLoopTransferOutput> {
    return this.runtimeLoopTransferOutputs;
  }

  setRuntimeLoopTransferOutput(index: number, lockingBytecode: Uint8Array, amount: bigint): this {
    if (!Number.isInteger(index) || index < 0 || index >= this.runtimeLoopTransferOutputs.length) {
      throw new Error(`Invalid runtime loop transfer index ${index}`);
    }
    if (amount < 0n) throw new Error('Derived runtime loop transfer amount must not be negative');
    this.runtimeLoopTransferOutputs[index] = {
      ...this.runtimeLoopTransferOutputs[index], lockingBytecode: Uint8Array.from(lockingBytecode), amount,
    };
    return this;
  }

  setRuntimeLoopNftTransferOutput(
    index: number,
    lockingBytecode: Uint8Array,
    commitment: Uint8Array,
    capability: 'none' | 'mutable' | 'minting',
  ): this {
    if (!Number.isInteger(index) || index < 0 || index >= this.runtimeLoopTransferOutputs.length) {
      throw new Error(`Invalid runtime loop NFT transfer index ${index}`);
    }
    if (this.runtimeLoopTransferOutputs[index].kind !== 'nft') {
      throw new Error(`Runtime loop transfer ${index} is not an NFT transfer`);
    }
    this.runtimeLoopTransferOutputs[index] = {
      ...this.runtimeLoopTransferOutputs[index],
      lockingBytecode: Uint8Array.from(lockingBytecode),
      commitment: Uint8Array.from(commitment),
      capability,
      amount: 0n,
    };
    return this;
  }

  getRuntimeLoopEventOutputs(): ReadonlyArray<{
    eventSignature: string; lockingBytecode: Uint8Array; categoryId?: string; commitment: string;
    rowIndex: number;
  }> {
    return this.runtimeLoopEventOutputs;
  }

  setRuntimeLoopEventRawCommitment(index: number, commitment: string): this {
    if (!Number.isInteger(index) || index < 0 || index >= this.runtimeLoopEventOutputs.length) {
      throw new Error(`Invalid runtime loop event index ${index}`);
    }
    if (!/^([0-9a-f]{2})*$/i.test(commitment)) {
      throw new Error(`Invalid hex string for runtime loop event ${index}`);
    }
    this.runtimeLoopEventOutputs[index].commitment = commitment;
    return this;
  }

  getLoopEntryVars(): Array<{
    collection: string; lockingBytecode: Uint8Array; categoryId?: string; delegate?: boolean; chunkable?: boolean;
  }> {
    return this.loopEntryVars;
  }

  getLoopEntryCommitments(collection: string): string[] {
    return this.loopEntryCommitments.get(collection) ?? [];
  }

  /** Whether the compiler published source-row ownership for this collection's runtime trailing outputs. */
  hasRuntimeLoopEntrySegments(collection: string): boolean {
    return this.runtimeLoopTrailingSegments.some((segment) =>
      segment.kind === 'entries' && segment.collection === collection && segment.count > 0);
  }

  setLoopEntryLockingBytecode(collection: string, lockingBytecode: Uint8Array): this {
    const variable = this.loopEntryVars.find((candidate) => candidate.collection === collection);
    if (!variable) throw new Error(`loop entry collection not registered: ${collection}`);
    variable.lockingBytecode = lockingBytecode;
    return this;
  }

  /**
   * Set the ordered entry commitments for a loop mapping write (from auto-derivation). The number of commitments
   * determines how many trailing entry NFT outputs are created (the runtime iteration count N).
   */
  setLoopEntryCommitments(collection: string, commitments: string[]): this {
    const required = this.requiredLoopEntryCounts.get(collection);
    this.loopEntryCommitments.set(collection, required === undefined ? commitments : Array.from(
      { length: required }, (_, index) => commitments[index] ?? '00',
    ));
    return this;
  }

  requireLoopEntryCount(collection: string, count: number): this {
    this.requiredLoopEntryCounts.set(collection, count);
    const existing = this.loopEntryCommitments.get(collection);
    if (existing) {
      this.loopEntryCommitments.set(collection, Array.from(
        { length: count }, (_, index) => existing[index] ?? '00',
      ));
    }
    return this;
  }

  getRequiredLoopEntryCount(collection: string): number {
    return this.requiredLoopEntryCounts.get(collection) ?? 0;
  }

  private _loopEntryOutputCount(): number {
    let n = 0;
    for (const lv of this.loopEntryVars) n += (this.loopEntryCommitments.get(lv.collection) ?? []).length;
    return n;
  }

  /** Runtime mapping entries physically owned by this builder's balanced trailing frame. */
  private _trailingLoopEntryVars(): typeof this.loopEntryVars {
    return this.loopEntryVars.filter((variable) => (
      (variable.categoryId === undefined || variable.categoryId === this.categoryId)
      // Legacy delegates own a transaction suffix outside the caller's block. A compiler-routed delegate instead
      // executes against the authenticated participant owner, so its resources belong to that participant's frame.
      && (variable.delegate !== true || this.compilerRouteDelegateBlock)
    ));
  }

  private _trailingLoopEntryOutputCount(): number {
    let n = 0;
    for (const lv of this._trailingLoopEntryVars()) {
      n += (this.loopEntryCommitments.get(lv.collection) ?? []).length;
    }
    return n;
  }

  private _delegateLoopEntryVars(): typeof this.loopEntryVars {
    return this.loopEntryVars.filter((lv) => lv.delegate === true);
  }

  /**
   * A runtime mapping loop emits both recreations (an UPDATE or re-pointed predecessor P') and genuinely new
   * entries through the same trailing commitment list. Match recreations by their authenticated entry slot and
   * covenant address so they retain the consumed NFT's satoshis; only NEW entries should be funded at dust.
   */
  private _loopEntryTransitionSatoshis(
    variable: (typeof this.loopEntryVars)[number], commitment: string,
  ): bigint | undefined {
    const outputCommitment = commitment.toLowerCase();
    if (outputCommitment.length < 64) return undefined;
    const categoryId = variable.categoryId ?? this.categoryId;
    const lockingBytecode = binToHex(variable.lockingBytecode);
    const input = this.insertLoopPredecessorInputs.find((candidate) => {
      const inputCommitment = commitmentHexOf(candidate.token?.nft?.commitment).toLowerCase();
      return candidate.token?.category === categoryId
        && candidate.token.nft?.capability === 'mutable'
        && inputCommitment.length >= 64
        && inputCommitment.slice(0, 64) === outputCommitment.slice(0, 64)
        && binToHex(candidate.unlocker.generateLockingBytecode()) === lockingBytecode;
    });
    return input?.satoshis;
  }

  /**
   * Output index where loop entry NFTs begin. They share the trailing region with dynamic chunks (mutually
   * exclusive in a given function by construction), placed after any chunk outputs. A compiler-routed delegate
   * executes against its authenticated participant owner, so its loop entries remain inside that owner's declared
   * trailing region; the `delegate` marker selects token ownership, not a transaction-suffix placement policy.
   */
  getLoopEntryOutputBase(): number {
    if (this.loopEntriesBeforeDynamicChunks) {
      if (this.runtimeLoopTrailingSegments.length > 0) {
        return this.getChunkOutputBase()
          - this._trailingLoopEntryOutputCount() - this.runtimeLoopEventOutputs.length
          - this.runtimeLoopTransferOutputs.length;
      }
      return this.getRuntimeLoopEventOutputBase() - this._trailingLoopEntryOutputCount();
    }
    if (this.delegateEntriesAfterLowLevel) {
      return this.getChunkOutputBase() - this.pendingOutputs.length
        - this._valueChunkOutputCount() - this._loopEntryOutputCount();
    }
    return this.getChunkOutputBase() + this._dynamicChunkOutputCount();
  }

  /**
   * Set a raw event NFT commitment by emit index (from auto-derivation).
   */
  setEventRawCommitment(emitIndex: number, commitment: string): this {
    if (!Number.isInteger(emitIndex) || emitIndex < 0) {
      throw new Error(`Invalid emit index ${emitIndex}: must be a non-negative integer`);
    }
    if (!/^([0-9a-f]{2})*$/i.test(commitment)) {
      throw new Error(`Invalid hex string for event raw commitment at emit index ${emitIndex}`);
    }
    this.eventRawCommitments.set(emitIndex, commitment);
    return this;
  }

  /**
   * Add an event placeholder for probe transactions (empty commitment).
   */
  addEventPlaceholder(eventSignature: string, emitIndex: number): this {
    this.pendingEventPlaceholders.push({ eventSignature, emitIndex });
    return this;
  }

  /**
   * Set the maximum fee in satoshis for the transaction.
   */
  setMaximumFeeSatoshis(maxFee: bigint): void {
    this._maximumFeeSatoshis = maxFee;
  }

  /**
   * Get the master input index for an external outState group.
   */
  getExternalOutStateMasterInputIndex(groupIdx: number): number {
    let base = 1 + this.dataNftUtxos.length + this.readOnlyDataNftUtxos.length + this.blockhashCoSpendUtxos.length
      + this.keccakComputeCoSpendUtxos.length + this.ecrecoverComputeCoSpendUtxos.length;
    for (let i = 0; i < groupIdx; i++) {
      base += 1 + this.externalOutStateUtxoGroups[i].dataNftUtxos.length
        + (this.externalOutStateUtxoGroups[i].keccakInputs?.length ?? 0);
    }
    return base;
  }

  /**
   * Get the output index where outState group's master NFT output starts.
   */
  getExternalOutStateOutputBase(groupIdx: number): number {
    let base = 1 + this.requiredNftIndices.length + this.readOnlyDataNftUtxos.length + this.blockhashCoSpendUtxos.length
      + this.keccakComputeCoSpendUtxos.length + this.ecrecoverComputeCoSpendUtxos.length;
    for (let i = 0; i < groupIdx; i++) {
      base += 1 + this.externalOutStateUtxoGroups[i].dataNftUtxos.length
        + (this.externalOutStateUtxoGroups[i].keccakInputs?.length ?? 0);
    }
    return base;
  }

  /**
   * Get the master input index for an external call group.
   */
  /**
   * Absolute input index of a co-spent callee identity anchor, by its position in the anchor band. Resolved from
   * the materialized input list rather than reconstructed from band widths: the anchors are appended last, after
   * every layout-driven band, so only the built ordering is authoritative.
   */
  getIdentityAnchorInputIndex(anchorIdx: number): number {
    const anchor = this.externalIdentityAnchorUtxos[anchorIdx];
    if (!anchor) return -1;
    return this.allInputs.findIndex((input) => input !== undefined
      && input.txid === anchor.txid && input.vout === anchor.vout);
  }

  getExternalCallMasterInputIndex(groupIdx: number): number {
    // Resolve an already-positioned master directly. This is authoritative for
    // delegate graphs, where implementation bands are interleaved with nested
    // callees and cannot be reconstructed from dense resource counts.
    const master = this.externalCallUtxoGroups[groupIdx]?.masterUtxo;
    const found = master && this.allInputs.findIndex((input) => input.txid === master.txid
      && input.vout === master.vout);
    if (found !== undefined && found >= 0) return found;
    let base = 1 + this.dataNftUtxos.length + this.readOnlyDataNftUtxos.length + this.blockhashCoSpendUtxos.length
      + this.keccakComputeCoSpendUtxos.length + this.ecrecoverComputeCoSpendUtxos.length;
    // Skip outState inputs
    for (const g of this.externalOutStateUtxoGroups) {
      base += 1 + g.dataNftUtxos.length + (g.keccakInputs?.length ?? 0);
    }
    // Loop external-call case: the read array's chunk run is co-spent BEFORE the callees (see _buildInputs),
    // so callee inputs are shifted by the chunk count. Zero when no dynamic-array read is co-spent.
    base += this.iterationEntryInputs.length;
    for (let i = 0; i < groupIdx; i++) {
      const g = this.externalCallUtxoGroups[i];
      base += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
    }
    return base;
  }

  /**
   * Get the output index where external call group's master NFT output starts.
   * Output layout: master(1) + A's dataNfts + A's readOnlyNfts + preceding groups' (1+dataNfts).
   */
  getExternalCallOutputBase(groupIdx: number): number {
    const requested = this.externalCallUtxoGroups[groupIdx];
    if (requested?.sharedGroupIndex !== undefined) groupIdx = requested.sharedGroupIndex;
    const physical = this.externalCallUtxoGroups[groupIdx];
    if (physical?.blockLayout) {
      // build() pads a full participant block up to its physical master-input coordinate. Return/event/state
      // derivation must address that same output coordinate; the dense resource-count formula below can be one
      // or more slots earlier when routed delegate/identity bands exist only on the input side.
      const aligned = this.getExternalCallMasterInputIndex(groupIdx);
      if (aligned >= 0) return aligned;
    }
    let base = 1 + this.requiredNftIndices.length + this.readOnlyDataNftUtxos.length + this.blockhashCoSpendUtxos.length
      + this.keccakComputeCoSpendUtxos.length + this.ecrecoverComputeCoSpendUtxos.length;
    // Skip outState outputs
    for (const g of this.externalOutStateUtxoGroups) {
      base += 1 + g.dataNftUtxos.length + (g.keccakInputs?.length ?? 0);
    }
    // Loop external-call case: the read array's chunk preservation outputs precede the callee outputs
    // (see build()), shifting them by the chunk count. Zero when no dynamic-array read is co-spent.
    base += this.iterationEntryInputs.length;
    const associatedDelegates = new Set(this.externalCallUtxoGroups
      .map((group) => group.delegateCallGroupIndex)
      .filter((index): index is number => index !== undefined));
    if (this.delegateEntriesAfterLowLevel) {
      base += this.pendingReturnEventOutputs.filter((r) => r.categoryId === this.categoryId).length;
      this.lowLevelCallUtxoGroups.forEach((group, index) => {
        if (group.callMode === 'delegatecall' && !associatedDelegates.has(index)) {
          base += 1 + group.dataNftUtxos.length;
        }
      });
    }
    for (let i = 0; i < groupIdx; i++) {
      const g = this.externalCallUtxoGroups[i];
      if (g.sharedGroupIndex !== undefined) continue;
      // Use full block size when available
      base += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
      // A proxied participant's implementation output follows that participant block in both the legacy and
      // compiler-route layouts. Compiler routes move the implementation INPUT into a leading band, but their
      // outputs remain interleaved; omitting it makes every later participant output base one slot too low.
      if (g.delegateCallGroupIndex !== undefined && !g.delegateEmbeddedInBlock) {
        const delegate = this.lowLevelCallUtxoGroups[g.delegateCallGroupIndex];
        if (delegate?.callMode === 'delegatecall') base += 1 + delegate.dataNftUtxos.length;
      }
    }
    return base;
  }

  /**
   * Get the master input index for a low-level call group.
   */
  getLowLevelCallUtxoGroups(): readonly ExternalCallUtxoGroup[] {
    return this.lowLevelCallUtxoGroups;
  }

  getExternalCallUtxoGroups(): readonly ExternalCallUtxoGroup[] {
    return this.externalCallUtxoGroups;
  }

  /** Exact active persisted continuation; null means compiler metadata was present but ambiguous/hostile. */
  private _persistedValueChunkWrite(categoryId?: string): ValueChunkWriteDescriptor | null | undefined {
    const writes = [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]
      .flatMap((group) => group.valueChunkWrites ?? [])
      .filter((write) => categoryId === undefined || write.categoryId === categoryId);
    if (writes.length === 0) return undefined;
    return selectPersistedValueChunkWrite(writes, categoryId) ?? null;
  }

  getLowLevelCallMasterInputIndex(groupIdx: number): number {
    const target = this.lowLevelCallUtxoGroups[groupIdx]?.masterUtxo;
    if (target) {
      const exact = this.allInputs.findIndex((input) => input?.txid.toLowerCase() === target.txid.toLowerCase()
        && input.vout === target.vout);
      if (exact >= 0) return exact;
    }
    if (this.lowLevelCallInputBase !== undefined) {
      let positionedBase = this.lowLevelCallInputBase;
      for (let i = 0; i < groupIdx; i++) {
        positionedBase += 1 + this.lowLevelCallUtxoGroups[i].dataNftUtxos.length;
      }
      return positionedBase;
    }
    let base = 1 + this.dataNftUtxos.length + this.readOnlyDataNftUtxos.length + this.blockhashCoSpendUtxos.length
      + this.keccakComputeCoSpendUtxos.length + this.ecrecoverComputeCoSpendUtxos.length;
    // Skip outState inputs
    for (const g of this.externalOutStateUtxoGroups) {
      base += 1 + g.dataNftUtxos.length + (g.keccakInputs?.length ?? 0);
    }
    // Skip external call inputs (use full block size when available)
    for (const g of this.externalCallUtxoGroups) {
      base += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
    }
    // Skip the main block's output-only funder inputs (event/transfer): they sit inside the proxy block,
    // before the low-level call inputs. A delegatecall'd impl that emits events reserves such slots here.
    for (const s of this.blockLayout?.slots ?? []) {
      if (s.kind === 'event' || s.kind === 'transfer' || s.kind === 'tcTransfer'
        || (s.kind === 'entry' && !this.delegateEntriesAfterLowLevel)) base += 1;
    }
    // Skip preceding low-level call groups
    for (let i = 0; i < groupIdx; i++) {
      base += 1 + this.lowLevelCallUtxoGroups[i].dataNftUtxos.length;
    }
    return base;
  }

  /**
   * Build and finalize the transaction, creating data NFT outputs with updated commitments.
   * This method is idempotent - each call creates a fresh TransactionBuilder.
   */
  /**
   * Configure the external-library side-car UTXO to co-spend (appended as the last input by build()).
   * blob = the library script; salt = the contract's token category (branded) or zero (shared). Must be
   * called before auto-derivation so the derivation probes include the side-car.
   */
  setSidecar(utxo: Utxo, blob: Uint8Array, salt: Uint8Array): void {
    const redeem = buildSidecarRedeem(blob, salt);
    const lock = sidecarLockingBytecode(blob, salt);
    this.sidecarUtxo = {
      ...utxo,
      unlocker: {
        generateUnlockingBytecode: () => scriptToBytecode([redeem]),
        generateLockingBytecode: () => lock,
      },
    };
  }

  /** Optional nLocktime for the final tx, e.g. the block.* freshness `require(tx.time >= number)`. */
  locktimeOverride?: number;

  setLocktime(locktime: number): this {
    this.locktimeOverride = locktime;
    return this;
  }

  addInput(utxo: Utxo, unlocker: Unlocker): this {
    const already = this.allInputs.some((input) => input.txid === utxo.txid && input.vout === utxo.vout);
    if (!already) this.allInputs.push({ ...utxo, unlocker });
    return this;
  }

  build(): TransactionBuilder {
    const buildTimingEnabled = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_BUILDER_TIMING === '1';
    const buildStartedAt = Date.now();
    let buildLastTimingAt = buildStartedAt;
    const buildTiming = (stage: string, builder?: TransactionBuilder): void => {
      if (!buildTimingEnabled) return;
      const now = Date.now();
      console.error('stb-build-timing', {
        stage,
        deltaMs: now - buildLastTimingAt,
        totalMs: now - buildStartedAt,
        inputs: builder?.inputs.length ?? this.allInputs.length,
        outputs: builder?.outputs.length,
        heapMb: Math.round(((globalThis as { process?: { memoryUsage?: () => { heapUsed: number } } })
          .process?.memoryUsage?.().heapUsed ?? 0) / 1_048_576),
      });
      buildLastTimingAt = now;
    };
    buildTiming('start');
    if (this.emitReassertAllowed === undefined) {
      this.emitReassertAllowed = isPersistedJobEventsReady() && !this._rootIsPublishJobPost();
    }
    this.builtReturnEventOutputIndices.clear();
    const returnOutputRefs = new Map<string, Output>();
    const addReturnOutput = (builder: TransactionBuilder, identity: string, output: Output): void => {
      // Return commitments are variable-width. The historical 800-satoshi value clears dust for
      // ordinary scalar results, but larger ABI frames can require more while remaining below the
      // compiler's 1,200-satoshi event-slot ceiling. Derive the floor from the serialized output
      // rather than assuming every return channel has the same width.
      output.amount = BigInt(Math.max(Number(output.amount), calculateDust(output)));
      builder.addOutput(output);
      returnOutputRefs.set(identity, output);
    };
    // Allow implicit NFT burn when entries are being deleted
    // Apply max fee override if set (user-specified via withMaxFee takes precedence)
    // CovenantTransactionBuilder skips the inner fee check - it can't understand
    // covenant-managed outputs. The STB performs its own fee check in send().
    const baseOpts = this._maximumFeeSatoshis !== undefined
      ? { ...this.builderOptions, maximumFeeSatoshis: this._maximumFeeSatoshis }
      : { ...this.builderOptions };
    // Dynamic-storage writes consume old chunk NFTs (mint/burn to match the new value), entry deletes burn
    // entries, and loop mapping writes mint new entry NFTs from the master - all intended implicit mint/burns.
    const opts = (this.entryDeletes.size > 0 || this.dynamicChunkInputs.length > 0
      || this.trailingDisposalInputs.length > 0
      || this.dynamicChunkVars.length > 0 || this.loopEntryVars.length > 0
      // transferNft may change an NFT's capability/commitment, which the generic transaction builder models as
      // a burn plus mint. The token-container covenant (and, in graph mode, the callManifest settlement row)
      // authenticates the exact transition, so the generic identity-preservation heuristic must not pre-empt
      // the derivation probe before those checks execute.
      || this.pendingTokenContainerTransferNfts.length > 0
      // Nested MarketplaceData event/SCID immutables can sit in the probe before their outputs are
      // derived. Allow the probe to proceed; the callee covenant still authenticates recreation.
      || this.externalCallUtxoGroups.length > 0 || this.lowLevelCallUtxoGroups.length > 0)
      ? { ...baseOpts, allowImplicitNftBurn: true }
      : baseOpts;
    // Compiler-route delegate inputs can live in a leading implementation band while their recreations follow
    // all external participant blocks and derived INSERT outputs. Patch the shared unlockers before inputs are
    // registered, using the exact output ordering this build method emits.
    const relocatedDelegateOutputBases = new Map<number, { value: number }>();
    if (this.delegateEntriesAfterLowLevel || this.compilerRouteDelegateBlock) {
      const associated = new Set(this.externalCallUtxoGroups
        .map((group) => group.delegateCallGroupIndex)
        .filter((index): index is number => index !== undefined));
      let outputCursor = this.compilerRouteDelegateBlock && this.blockLayout
        ? this.blockLayout.blockSize
        : 1 + this.requiredNftIndices.length + this.readOnlyDataNftUtxos.length
          + this.blockhashCoSpendUtxos.length + this.keccakComputeCoSpendUtxos.length
          + this.ecrecoverComputeCoSpendUtxos.length + this.iterationEntryInputs.length
          + this.externalOutStateUtxoGroups.reduce(
            (sum, group) => sum + 1 + group.dataNftUtxos.length + (group.keccakInputs?.length ?? 0), 0,
          );
      const patchDelegate = (groupIndex: number, outputBase: number): number => {
        const group = this.lowLevelCallUtxoGroups[groupIndex];
        if (!group || group.callMode !== 'delegatecall') return outputBase;
        const masterInputIndex = this.getLowLevelCallMasterInputIndex(groupIndex);
        const outputBaseRef = relocatedDelegateOutputBases.get(groupIndex) ?? { value: outputBase };
        relocatedDelegateOutputBases.set(groupIndex, outputBaseRef);
        group.dataNftUtxos.forEach((nftUtxo, nftIndex) => {
          const relocated = createRelocatedDataNftUnlocker(
            group.externalContract.inner,
            masterInputIndex,
            outputBase + 1 + nftIndex,
            group.categoryId,
          );
          nftUtxo.unlocker = {
            ...relocated,
            generateUnlockingBytecode: (options) => createRelocatedDataNftUnlocker(
              group.externalContract.inner,
              masterInputIndex,
              outputBaseRef.value + 1 + nftIndex,
              group.categoryId,
            ).generateUnlockingBytecode(options),
          };
        });
        return outputBase + 1 + group.dataNftUtxos.length;
      };
      this.lowLevelCallUtxoGroups.forEach((group, groupIndex) => {
        if (group.callMode === 'delegatecall' && !associated.has(groupIndex)) {
          outputCursor = patchDelegate(groupIndex, outputCursor);
        }
      });
      this.externalCallUtxoGroups.forEach((group) => {
        if (group.sharedGroupIndex !== undefined) return;
        outputCursor += group.blockInputs?.length ?? 1 + group.dataNftUtxos.length;
        outputCursor += this.externalCallEntryInserts.filter((insert, handle) => (
          insert.categoryId === group.categoryId && insert.commitment !== ''
          && !group.plannedEntryInsertHandles?.includes(handle)
        )).length;
        if (group.delegateCallGroupIndex !== undefined) {
          outputCursor = patchDelegate(group.delegateCallGroupIndex, outputCursor);
        }
        this.externalCallUtxoGroups.forEach((shared) => {
          if (shared.sharedGroupIndex === this.externalCallUtxoGroups.indexOf(group)
            && shared.delegateCallGroupIndex !== undefined) {
            outputCursor = patchDelegate(shared.delegateCallGroupIndex, outputCursor);
          }
        });
      });
    }
    buildTiming('delegate-output-bases');
    const builder = new CovenantTransactionBuilder(opts);
    let debugOutputFingerprint: string | undefined;
    const debugAtomicOutputStage = (stage: string): void => {
      buildTiming(stage, builder);
      const debugOutputIndexRaw = (globalThis as {
        process?: { env?: Record<string, string> };
      }).process?.env?.SOLIDC_DEBUG_OUTPUT_INDEX;
      const debugOutputIndex = debugOutputIndexRaw === undefined
        ? undefined : Number.parseInt(debugOutputIndexRaw, 10);
      const debugOutputCategory = (globalThis as {
        process?: { env?: Record<string, string> };
      }).process?.env?.SOLIDC_DEBUG_OUTPUT_CATEGORY?.toLowerCase();
      if (debugOutputIndex !== undefined && Number.isInteger(debugOutputIndex) && debugOutputIndex >= 0
        && (!debugOutputCategory || this.categoryId.toLowerCase().startsWith(debugOutputCategory))) {
        const output = builder.outputs[debugOutputIndex];
        const fingerprint = output === undefined ? 'missing' : JSON.stringify({
          amount: String(output.amount),
          lock: output.to instanceof Uint8Array ? binToHex(output.to) : output.to,
          category: output.token?.category,
          tokenAmount: String(output.token?.amount ?? 0n),
          capability: output.token?.nft?.capability,
          commitment: output.token?.nft?.commitment,
        });
        if (fingerprint !== debugOutputFingerprint) {
          console.error('stateful-output-transition', JSON.stringify({
            stage,
            index: debugOutputIndex,
            rootCategory: this.categoryId.slice(0, 16),
            output: fingerprint === 'missing' ? undefined : JSON.parse(fingerprint),
          }));
          debugOutputFingerprint = fingerprint;
        }
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_RETURN_LAYOUT === '1' && (this.blockLayout?.blockSize ?? 0) > 100 && stage === 'final') {
        const returnSlot = this.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
        const output = returnSlot ? builder.outputs[returnSlot.offset] : undefined;
        console.error('atomic-stateful-return-stage', JSON.stringify({
          stage,
          returnSlot,
          output: output && {
            lock: output.to instanceof Uint8Array ? binToHex(output.to) : output.to,
            category: output.token?.category,
            capability: output.token?.nft?.capability,
            commitment: output.token?.nft?.commitment,
          },
          pending: this.pendingReturnEventOutputs.map((event) => ({
            identity: event.identity,
            category: event.categoryId,
            commitment: binToHex(event.commitment),
          })),
        }));
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1' && (this.blockLayout?.blockSize ?? 0) > 100) {
        console.error('atomic-stateful-output-stage', stage, builder.outputs.length);
        const sidecars = this.blockLayout?.slots.filter((slot) =>
          slot.kind === 'keccakSideCar' || slot.kind === 'ecrecoverSideCar') ?? [];
        if (sidecars.length > 0) {
          console.error('atomic-stateful-sidecar-stage', stage, sidecars.map((slot) => {
            const input = this.allInputs[slot.offset];
            const output = builder.outputs[slot.offset];
            return {
              slot,
              inputLock: input?.unlocker ? binToHex(input.unlocker.generateLockingBytecode()) : undefined,
              inputCategory: input?.token?.category,
              outputLock: output?.to instanceof Uint8Array ? binToHex(output.to) : output?.to,
              outputCategory: output?.token?.category,
            };
          }));
        }
      }
    };
    const debugOwnMutableOutputs = (stage: string): void => {
      buildTiming(stage, builder);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_FAILURE_RING !== '1') return;
      console.error('builder-own-mutable-outputs', {
        stage,
        outputs: builder.outputs.map((output, index) => ({ output, index }))
          .filter(({ output }) => (output.token?.category === this.categoryId
            || this.loopEntryVars.some((value) => value.categoryId === output.token?.category))
            && output.token?.nft?.capability === 'mutable')
          .map(({ output, index }) => ({
            index,
            lockingBytecode: typeof output.to === 'string' ? output.to : binToHex(output.to),
            commitment: output.token?.nft?.commitment,
          })),
      });
    };
    // X56. Delegate return events held back until after the implementation's own event outputs. Empty unless
    // `delegateReturnEventAfterEvents` is set, i.e. unless the co-spent implementation emits AND returns.
    let deferredDelegateReturnEvents: Array<{
      categoryId: string; commitment: Uint8Array; identity: string; provisional?: boolean;
    }> = [];
    if (this.locktimeOverride !== undefined) builder.locktime = this.locktimeOverride;
    const seenInputs = new Map<string, number>();
    for (let index = 0; index < this.allInputs.length; index++) {
      const input = this.allInputs[index];
      const id = `${input.txid.toLowerCase()}:${input.vout}`;
      const first = seenInputs.get(id);
      if (first !== undefined) {
        const roles = (candidate: UnlockableUtxo): string[] => {
          const out: string[] = [];
          const matches = (utxo: Utxo | undefined): boolean => !!utxo
            && utxo.txid.toLowerCase() === candidate.txid.toLowerCase() && utxo.vout === candidate.vout;
          if (matches(this.masterUtxo)) out.push('master');
          this.dataNftUtxos.forEach((utxo, i) => { if (matches(utxo)) out.push(`dataNft:${i}`); });
          this.readOnlyDataNftUtxos.forEach((utxo, i) => {
            if (matches(utxo)) out.push(`readOnlyDataNft:${i}`);
          });
          this.blockhashCoSpendUtxos.forEach((utxo, i) => {
            if (matches(utxo)) out.push(`blockhash:${i}`);
          });
          this.keccakComputeCoSpendUtxos.forEach((utxo, i) => {
            if (matches(utxo)) out.push(`keccak:${i}`);
          });
          this.keccakLoopSideCars.forEach((utxo, i) => {
            if (matches(utxo)) out.push(`keccakLoop:${i}`);
          });
          this.ecrecoverComputeCoSpendUtxos.forEach((utxo, i) => {
            if (matches(utxo)) out.push(`ecrecover:${i}`);
          });
          this.iterationEntryInputs.forEach((utxo, i) => {
            if (matches(utxo)) out.push(`iterationEntry:${i}`);
          });
          this.insertLoopPredecessorInputs.forEach((utxo, i) => {
            if (matches(utxo)) out.push(`insertPredecessor:${i}`);
          });
          this.dynamicChunkInputs.forEach((utxo, i) => {
            if (matches(utxo)) out.push(`dynamicChunk:${i}`);
          });
          this.trailingDisposalInputs.forEach((utxo, i) => {
            if (matches(utxo)) out.push(`trailingDisposal:${i}`);
          });
          this.externalOutStateUtxoGroups.forEach((group, groupIndex) => {
            if (matches(group.masterUtxo)) out.push(`outState:${groupIndex}:master`);
            group.dataNftUtxos.forEach((utxo, nftIndex) => {
              if (matches(utxo)) out.push(`outState:${groupIndex}:dataNft:${nftIndex}`);
            });
            group.blockInputs?.forEach((utxo, slot) => {
              if (matches(utxo)) out.push(`outState:${groupIndex}:block:${slot}`);
            });
          });
          this.externalCallUtxoGroups.forEach((group, groupIndex) => {
            if (matches(group.masterUtxo)) out.push(`external:${groupIndex}:master`);
            group.dataNftUtxos.forEach((utxo, nftIndex) => {
              if (matches(utxo)) out.push(`external:${groupIndex}:dataNft:${nftIndex}`);
            });
            group.blockInputs?.forEach((utxo, slot) => {
              if (matches(utxo)) out.push(`external:${groupIndex}:block:${slot}`);
            });
          });
          this.lowLevelCallUtxoGroups.forEach((group, groupIndex) => {
            if (matches(group.masterUtxo)) out.push(`lowLevel:${groupIndex}:master`);
            group.dataNftUtxos.forEach((utxo, nftIndex) => {
              if (matches(utxo)) out.push(`lowLevel:${groupIndex}:dataNft:${nftIndex}`);
            });
            group.blockInputs?.forEach((utxo, slot) => {
              if (matches(utxo)) out.push(`lowLevel:${groupIndex}:block:${slot}`);
            });
          });
          this.lowLevelCallRawInputs.forEach((utxo, i) => {
            if (matches(utxo)) out.push(`lowLevelRaw:${i}`);
          });
          this.funderUtxos.forEach((utxo, i) => { if (matches(utxo)) out.push(`funder:${i}`); });
          this.entryNfts.forEach((entry, i) => { if (matches(entry.utxo)) out.push(`entry:${i}`); });
          this.tokenContainers.forEach((container, i) => {
            if (matches(container.utxo)) out.push(`tokenContainer:${i}`);
          });
          if (matches(this.satoshiContainerUtxo)) out.push('satoshiContainer');
          this.externalIdentityAnchorUtxos.forEach((utxo, i) => {
            if (matches(utxo)) out.push(`externalIdentityAnchor:${i}`);
          });
          if (matches(this.logicalIdentityUtxo)) out.push('logicalIdentityAnchor');
          return out;
        };
        throw new Error(
          `Duplicate stateful input ${id} at ${first}/${index}; roles `
          + `${roles(this.allInputs[first]).join(',') || 'other'} / ${roles(input).join(',') || 'other'}`
          + (() => {
            const matchingEntries = this.entryNfts.filter((entry) => entry.utxo
              && `${entry.utxo.txid.toLowerCase()}:${entry.utxo.vout}` === id).map((entry) => ({
              slotIndex: entry.slotIndex,
              collection: entry.collection,
              exists: entry.exists,
              key: entry.keyValue instanceof Uint8Array ? binToHex(entry.keyValue) : String(entry.keyValue),
              keys: entry.keyValues?.map((value) => value instanceof Uint8Array ? binToHex(value) : String(value)),
              commitment: entry.utxo?.token?.nft?.commitment,
            }));
            return matchingEntries.length === 0 ? '' : `; entries ${JSON.stringify(matchingEntries)}`;
          })(),
        );
      }
      seenInputs.set(id, index);
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
      const missingUnlockers = this.allInputs.map((input, index) => ({ input, index }))
        .filter(({ input }) => !('unlocker' in input) || input.unlocker === undefined);
      if (missingUnlockers.length > 0) {
        console.error('stateful-inputs-missing-unlockers', missingUnlockers.map(({ input, index }) => {
          const same = (candidate: Utxo | undefined): boolean => candidate?.txid === input.txid
            && candidate.vout === input.vout;
          const roles: string[] = [];
          this.externalCallUtxoGroups.forEach((group, groupIndex) => {
            if (same(group.masterUtxo)) roles.push(`external:${groupIndex}:master`);
            group.blockInputs?.forEach((candidate, slot) => {
              if (same(candidate)) roles.push(`external:${groupIndex}:block:${slot}`);
            });
          });
          this.lowLevelCallUtxoGroups.forEach((group, groupIndex) => {
            if (same(group.masterUtxo)) roles.push(`lowLevel:${groupIndex}:master`);
          });
          return {
            index, outpoint: `${input.txid}:${input.vout}`, category: input.token?.category, roles,
          };
        }));
      }
    }
    const missingUnlockers = this.allInputs
      .map((input, index) => ({ input, index }))
      .filter(({ input }) => !input || !('unlocker' in input) || input.unlocker === undefined);
    if (missingUnlockers.length > 0) {
      throw new Error(
        'Stateful input(s) missing unlocker at '
        + missingUnlockers.map(({ input, index }) => (
          `${index}:${input?.token?.category ?? 'plain'}:${input?.txid?.slice(0, 8) ?? '?'}`
        )).join(', '),
      );
    }
    builder.addInputs(this.allInputs);
    // Co-spend the external-library side-car as the LAST input (the covenant's library loader reads it via
    // OP_INPUTBYTECODE of the last input). Present in derivation probes and the final tx alike.
    if (this.sidecarUtxo) builder.addInputs([this.sidecarUtxo]);
    buildTiming('inputs-registered', builder);

    // Read current state from the provided data NFT commitments
    const currentState: Record<
    string, StateValue
    > = {};
    for (let i = 0; i < this.requiredNftIndices.length; i++) {
      const nftIdx = this.requiredNftIndices[i];
      const nftUtxo = this.dataNftUtxos[i];
      if (nftUtxo?.token?.nft?.commitment) {
        const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, this.stateLayout, nftIdx);
        for (const [key, value] of Object.entries(parsed)) {
          currentState[key] = value;
        }
      }
    }

    // Apply state updates
    for (const [name, value] of this.stateUpdates) {
      currentState[name] = value;
    }

    // Create master UTXO output (preserving locking bytecode and token)
    builder.addOutput({
      to: this.masterUtxo.unlocker.generateLockingBytecode(),
      amount: this.masterUtxo.satoshis,
      token: this.masterUtxo.token,
    });

    // Create data NFT outputs with updated commitments (only for required NFTs)
    for (let i = 0; i < this.requiredNftIndices.length; i++) {
      const nftIdx = this.requiredNftIndices[i];
      const nftUtxo = this.dataNftUtxos[i];

      const commitment = this.stateRawCommitments.get(nftIdx) ?? buildPushdataCommitment(
        this.stateLayout, currentState, nftIdx, this.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
      );

      builder.addOutput({
        to: nftUtxo.unlocker.generateLockingBytecode(),
        amount: nftUtxo.satoshis,
        token: {
          amount: nftUtxo.token?.amount ?? 0n,
          category: this.categoryId,
          nft: {
            capability: nftUtxo.token?.nft?.capability ?? 'mutable',
            commitment,
          },
        },
      });
    }

    // Create read-only data NFT outputs (commitment preserved unchanged)
    for (const roUtxo of this.readOnlyDataNftUtxos) {
      builder.addOutput({
        to: roUtxo.unlocker.generateLockingBytecode(),
        amount: roUtxo.satoshis,
        token: roUtxo.token,
      });
    }

    const ownsFrontComputeResources = !this.delegateComputeResources || this.compilerRouteDelegateBlock;
    const blockhashOutput = (index: number): Output | undefined => {
      const bhUtxo = this.blockhashCoSpendUtxos[index];
      return bhUtxo ? {
        to: bhUtxo.unlocker.generateLockingBytecode(),
        amount: bhUtxo.satoshis,
        token: bhUtxo.token,
      } : undefined;
    };
    const keccakOutput = (index: number): Output | undefined => {
      const kUtxo = this.keccakComputeCoSpendUtxos[index];
      return kUtxo ? {
        to: kUtxo.unlocker.generateLockingBytecode(),
        amount: kUtxo.satoshis,
        token: {
          category: kUtxo.token?.category ?? this.categoryId,
          amount: kUtxo.token?.amount ?? 0n,
          nft: { capability: 'mutable' as const, commitment: this.keccakComputeCommitments[index] ?? '' },
        },
      } : undefined;
    };
    if (this.preserveBlockLayoutWidth && this.blockLayout && ownsFrontComputeResources) {
      const blockhashOrdinals = this.blockhashCoSpendSlotOrdinals
        ?? this.blockhashCoSpendUtxos.map((_utxo, index) => index);
      const fixedComputeSlots = this.blockLayout.slots.filter((slot) => (
        slot.kind === 'blockhashOracle' || slot.kind === 'keccakSideCar' || slot.kind === 'ecrecoverSideCar'
      )).sort((left, right) => left.offset - right.offset);
      let blockhashOrdinal = 0;
      for (const slot of fixedComputeSlots) {
        while (builder.outputs.length < slot.offset) {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
        }
        let output: Output | undefined;
        if (slot.kind === 'blockhashOracle') {
          const activeIndex = blockhashOrdinals.indexOf(blockhashOrdinal++);
          output = activeIndex >= 0 ? blockhashOutput(activeIndex) : undefined;
        } else if (slot.kind === 'keccakSideCar') {
          output = keccakOutput(slot.slotIndex ?? 0);
        } else {
          output = this.ecrecoverComputeRecreates[slot.slotIndex ?? 0];
        }
        builder.addOutput(output ?? { to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      }
    } else {
      // Legacy layouts emit their active compute resources densely; they do not publish inactive coordinates.
      for (let index = 0; index < this.blockhashCoSpendUtxos.length; index++) {
        builder.addOutput(blockhashOutput(index)!);
      }
      if (ownsFrontComputeResources) {
        for (let index = 0; index < this.keccakComputeCoSpendUtxos.length; index++) {
          builder.addOutput(keccakOutput(index)!);
        }
      }
    }

    // Dynamic keccak loop: recreate the N trailing side-cars, each with its iteration result R_i. In the MVP
    // layout (no other front-region slots) these sit at [blockSize, blockSize+N) - right after the data NFTs.
    for (const rec of this.keccakLoopRecreates) builder.addOutput(rec);

    // ecrecover recovery-pair recreations (right after the keccak side-cars, matching the ecrecoverSideCar slots):
    // A commits H_A (the A->B binding hash), B commits the recovered pubkey Q. Built by buildEcrecoverComputeSidecars.
    if (ownsFrontComputeResources && !this.preserveBlockLayoutWidth) {
      for (const rec of this.ecrecoverComputeRecreates) builder.addOutput(rec);
    }

    // Create external outState outputs (same pattern as external call preservation)
    for (const group of this.externalOutStateUtxoGroups) {
      // B's master output: preserved unchanged
      const bMaster = group.masterUtxo as UnlockableUtxo;
      builder.addOutput({
        to: bMaster.unlocker.generateLockingBytecode(),
        amount: bMaster.satoshis,
        token: bMaster.token,
      });

      // B's data NFT outputs with state updates
      const bStateUpdates = this.externalCallStateUpdates.get(group.categoryId);
      const bCurrentState: Record<
      string, StateValue
      > = {};

      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftIdx = group.requiredDataNftIndices[i];
        const nftUtxo = group.dataNftUtxos[i];
        if (nftUtxo?.token?.nft?.commitment) {
          const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, group.stateLayout, nftIdx);
          for (const [key, value] of Object.entries(parsed)) {
            bCurrentState[key] = value;
          }
        }
      }

      if (bStateUpdates) {
        for (const [name, value] of bStateUpdates) {
          bCurrentState[name] = value;
        }
      }

      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftIdx = group.requiredDataNftIndices[i];
        const nftUtxo = group.dataNftUtxos[i];
        const nftVars = group.stateLayout.variables.filter((variable) => variable.nftIndex === nftIdx);
        const nftIsImmutable = nftVars.length > 0 && nftVars.every((variable) => variable.immutable);
        const inputCommitment = nftUtxo.token?.nft?.commitment;
        const commitment = this.externalCallStateRawCommitments.get(group.categoryId)?.get(nftIdx)
          ?? (nftIsImmutable && inputCommitment
            ? inputCommitment
            : buildPushdataCommitment(
            group.stateLayout, bCurrentState, nftIdx,
            this.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
            ));

        builder.addOutput({
          to: nftUtxo.unlocker.generateLockingBytecode(),
          amount: nftUtxo.satoshis,
          token: {
            amount: nftUtxo.token?.amount ?? 0n,
            category: group.categoryId,
            nft: {
              capability: nftUtxo.token?.nft?.capability ?? 'mutable',
              commitment,
            },
          },
        });
      }

      // B's keccak256 side-car recreations (after B's data NFT outputs, matching the input order).
      for (const rec of group.keccakRecreates ?? []) builder.addOutput(rec);
    }

    // Loop external-call case: the read array's chunk run is co-spent BEFORE the callees (input order
    // master..chunk..callees), and the covenant verifies callee output==input by index, so the chunk
    // preservation outputs must precede the callee outputs here too. Emit them now; the trailing
    // iteration-entry block below skips itself when this fired.
    // Delegate trailing storage lives at implementationInput+trailingBase. Emitting read-only chunks
    // before the implementation band would occupy the impl master output (marketplace jobs at output 5).
    // Read-only chunks must not precede a co-spent implementation: that implementation
    // self-preserves at OP_INPUTINDEX, so jobs-at-output-5 overwrites the impl master.
    const loopChunkBeforeCallees = this.iterationEntryInputs.length > 0
      && this.externalCallUtxoGroups.length > 0
      && !this.delegateDynamicChunksAtSuffix
      && !this.lowLevelCallUtxoGroups.some((group) => group.callMode === 'delegatecall');
    if (loopChunkBeforeCallees) {
      for (const iterUtxo of this.iterationEntryInputs) {
        builder.addOutput({
          to: iterUtxo.unlocker.generateLockingBytecode(),
          amount: iterUtxo.satoshis,
          token: {
            amount: iterUtxo.token?.amount ?? 0n,
            category: this.categoryId,
            nft: { capability: 'mutable', commitment: iterUtxo.token?.nft?.commitment ?? '' },
          },
        });
      }
    }
    buildTiming('root-and-front-outputs', builder);

    // A delegate implementation must occupy the same absolute output index as its input: its covenant binds
    // that input directly after the proxy master/data region and self-preserves at OP_INPUTINDEX. Nested callees
    // invoked by the implementation follow this preservation band.
    const associatedDelegateOutputs = new Set(this.externalCallUtxoGroups
      .map((group) => group.delegateCallGroupIndex)
      .filter((index): index is number => index !== undefined));
    let delegateTransferSlotsConsumed = 0;
    const appendDelegateGroupOutputs = (groupIndex: number): void => {
      const group = this.lowLevelCallUtxoGroups[groupIndex];
      if (!group || group.callMode !== 'delegatecall') return;
      const bMaster = group.masterUtxo as UnlockableUtxo;
      builder.addOutput({
        to: bMaster.unlocker.generateLockingBytecode(), amount: bMaster.satoshis, token: bMaster.token,
      });
      for (const nftUtxo of group.dataNftUtxos) {
        builder.addOutput({
          to: nftUtxo.unlocker.generateLockingBytecode(), amount: nftUtxo.satoshis, token: nftUtxo.token,
        });
      }
      const delegateFn = group.compilerRoute?.abiFunction
        ?? (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
          .find((candidate) => candidate.name === group.functionName);
      const occupied = 1 + group.dataNftUtxos.length;
      const lastTransferOffset = delegateFn?.blockLayout?.slots
        .filter((slot) => slot.kind === 'transfer')
        .reduce((max, slot) => Math.max(max, slot.offset), -1) ?? -1;
      // A compiler-route delegate's side-cars are slots of the proxy-owned balanced route and were recreated at
      // those route offsets above. Only legacy delegate geometry places compute resources after the executor.
      const lastComputeOffset = this.delegateComputeResources && !this.compilerRouteDelegateBlock
        ? delegateFn?.blockLayout?.slots
          .filter((slot) => slot.kind === 'keccakSideCar' || slot.kind === 'ecrecoverSideCar')
          .reduce((max, slot) => Math.max(max, slot.offset), -1) ?? -1
        : -1;
      const lastImplementationResourceOffset = Math.max(lastTransferOffset, lastComputeOffset);
      for (let offset = occupied; offset <= lastImplementationResourceOffset; offset += 1) {
        const slot = delegateFn?.blockLayout?.slots.find((candidate) => candidate.offset === offset);
        if (this.delegateComputeResources && slot?.kind === 'keccakSideCar') {
          const sidecarIndex = slot.slotIndex ?? 0;
          const sidecar = this.keccakComputeCoSpendUtxos[sidecarIndex];
          builder.addOutput(sidecar ? {
            to: sidecar.unlocker.generateLockingBytecode(),
            amount: sidecar.satoshis,
            token: {
              category: sidecar.token?.category ?? this.categoryId,
              amount: sidecar.token?.amount ?? 0n,
              nft: {
                capability: 'mutable',
                commitment: this.keccakComputeCommitments[sidecarIndex] ?? '',
              },
            },
          } : { to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
          continue;
        }
        if (this.delegateComputeResources && slot?.kind === 'ecrecoverSideCar') {
          builder.addOutput(this.ecrecoverComputeRecreates[slot.slotIndex ?? 0]
            ?? { to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
          continue;
        }
        if (slot?.kind === 'transfer') {
          const transfer = this.pendingTransfers[delegateTransferSlotsConsumed++];
          builder.addOutput(!transfer || transfer.lockingBytecode.length === 0
            ? { to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS }
            : { to: transfer.lockingBytecode, amount: transfer.amount });
          continue;
        }
        // Other output-only implementation slots are populated by their specialized derivation paths. Reserve
        // their physical coordinates here so a following participant cannot collapse the balanced block.
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      }
    };
    const appendDelegateLoopEntries = (): void => {
      const delegateLoopVars = this._delegateLoopEntryVars();
      if (delegateLoopVars.length === 0) return;
      const delegateFunction = (group: ExternalCallUtxoGroup): AbiFunction | undefined => (
        group.compilerRoute?.abiFunction
        ?? (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
          .find((candidate) => candidate.name === group.functionName)
      );
      const delegateGroupIndex = this.lowLevelCallUtxoGroups.findIndex((group) => group.callMode === 'delegatecall'
        && (delegateFunction(group)?.sortedUpsertLoopInfo?.length ?? 0) > 0);
      const delegateGroup = delegateGroupIndex < 0 ? undefined : this.lowLevelCallUtxoGroups[delegateGroupIndex];
      const delegateAbiFunction = delegateGroup === undefined ? undefined : delegateFunction(delegateGroup);
      const delegateMaster = delegateGroup?.masterUtxo as UnlockableUtxo | undefined;
      const delegateOutputIndex = delegateMaster ? builder.outputs.findIndex((output) => (
        binToHex(typeof output.to === 'string' ? addressToLockScript(output.to) : output.to)
          === binToHex(delegateMaster.unlocker.generateLockingBytecode())
        && output.token?.category === delegateMaster.token?.category
      )) : -1;
      const delegateBase = delegateOutputIndex >= 0 ? delegateOutputIndex
        : this.blockLayout?.slots.find((slot) => slot.kind === 'lowLevelCall')?.offset;
      let outputIndex = delegateBase !== undefined
        ? delegateBase + (delegateAbiFunction?.blockLayout?.blockSize ?? 1)
        : this.getLoopEntryOutputBase();
      // The implementation's block can contain output-only slots (most commonly its return-event slot). The
      // preservation helper above emits only master + data NFTs, so materialize any intervening balanced slots
      // before inserting the trailing loop band. Otherwise Array.splice clamps an absolute index beyond the end,
      // shifting every loop and nested-call output left by the number of omitted block slots.
      while (builder.outputs.length < outputIndex) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      }
      // Read-only jobs/dynamic chunks self-preserve at OP_INPUTINDEX, so they occupy
      // impl+trailingBase before P'/NEW. The upsert output index adds ceil(A$len/120)
      // for that same run (updateJobWhitelist: jobs at 10-11, whitelist at 12).
      if (this.iterationEntryInputs.length > 0) {
        for (const iterUtxo of this.iterationEntryInputs) {
          const chunkOutput = {
            to: iterUtxo.unlocker.generateLockingBytecode(),
            amount: iterUtxo.satoshis,
            token: {
              amount: iterUtxo.token?.amount ?? 0n,
              category: this.categoryId,
              nft: {
                capability: 'mutable' as const,
                commitment: iterUtxo.token?.nft?.commitment ?? '',
              },
            },
          };
          builder.outputs.splice(outputIndex++, 0, chunkOutput);
        }
        this.iterationEntriesPlacedAtDelegateBase = true;
      }
      // RMW write chunks (publishJobPost jobs.push) occupy this input band but
      // recreate at the suffix. Reserve the same output indexes so P'/NEW sit
      // on the predecessor, not on the burned chunk slots.
      if (this.dynamicChunkInputs.length > 0 || this.trailingDisposalInputs.length > 0) {
        outputIndex += this.dynamicChunkInputs.length + this.trailingDisposalInputs.length;
        while (builder.outputs.length < outputIndex) {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
        }
      }
      for (const lv of delegateLoopVars) {
        const emittedByExternalInsert = this.externalCallEntryInserts.some((insert) => (
          insert.commitment !== ''
          && insert.categoryId === lv.categoryId
          && insert.to.length === lv.lockingBytecode.length
          && insert.to.every((byte, index) => byte === lv.lockingBytecode[index])
        ));
        if (emittedByExternalInsert) continue;
        for (const commitment of this.loopEntryCommitments.get(lv.collection) ?? []) {
          const entryOutput = {
            to: lv.lockingBytecode,
            amount: 1200n,
            token: {
              amount: 0n,
              category: lv.categoryId!,
              nft: { capability: 'mutable' as const, commitment },
            },
          };
          entryOutput.amount = this._loopEntryTransitionSatoshis(lv, commitment)
            ?? BigInt(Math.max(1200, calculateDust(entryOutput)));
          // Earlier composed participant/identity outputs may already have been materialized. The implementation
          // covenant owns an absolute master-relative loop coordinate, so insert at that coordinate rather than
          // appending after whichever caller outputs happened to be built first.
          builder.outputs.splice(outputIndex++, 0, entryOutput);
        }
      }
    };
    if (this.delegateEntriesAfterLowLevel) {
      this.lowLevelCallUtxoGroups.forEach((_group, groupIndex) => {
        if (!associatedDelegateOutputs.has(groupIndex)) appendDelegateGroupOutputs(groupIndex);
      });
      const proxyReturnEvents = this.pendingReturnEventOutputs
        .filter((returnEvent) => returnEvent.categoryId === this.categoryId);
      if (this.delegateReturnEventAfterEvents) {
        deferredDelegateReturnEvents.push(...proxyReturnEvents);
      } else {
        for (const returnEvent of proxyReturnEvents) {
          addReturnOutput(builder, returnEvent.identity, {
            to: new Uint8Array([0x51]), amount: 800n,
            token: {
              amount: 0n, category: returnEvent.categoryId,
              nft: { capability: 'none', commitment: binToHex(returnEvent.commitment) },
            },
          });
        }
      }
      // The implementation owns this runtime-loop region: its covenant addresses it at
      // implementationInput + implementationBlockSize. Keep it adjacent to the implementation band even when
      // the same delegate also places dynamic-storage chunks in the reverse-indexed transaction suffix.
      appendDelegateLoopEntries();
    }

    // Create external call outputs (B's master preserved + B's data NFTs with updated state)
    const embeddedEntrySlots = new Set<number>();
    for (let groupIndex = 0; groupIndex < this.externalCallUtxoGroups.length; groupIndex++) {
      const group = this.externalCallUtxoGroups[groupIndex];
      if (group.sharedGroupIndex !== undefined) continue;
      if (group.blockLayout) {
        // Physical master after the 4-wide input swap (typically 26). Emitting the
        // 8-slot token block there puts the return event at master+7 (33) so
        // updateJobPost's OUTPUTTOKENCATEGORY/SPLIT-32 sees a 32-byte category.
        const masterInputIndex = this.getExternalCallMasterInputIndex(groupIndex);
        if (masterInputIndex >= 0) this._padOutputsToIndex(builder, masterInputIndex);
      }
      const groupOutputStart = builder.outputs.length;
      // B's master output: preserved unchanged
      const bMaster = group.masterUtxo as UnlockableUtxo;
      if (group.compilerRoute && group.delegateCallGroupIndex !== undefined) {
        // A routed delegate's proxy master is displaced from its packed physical block. Slot zero is only a
        // balanced spacer; the master covenant requires the real minting NFT to be recreated at INPUTINDEX.
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      } else {
        builder.addOutput({
          to: bMaster.unlocker.generateLockingBytecode(),
          amount: bMaster.satoshis,
          token: bMaster.token,
        });
      }

      // Plain .staticcall / .delegatecall groups preserve exact input commitments. A compiler-routed
      // proxy group still owns a balanced output block (entries, events, and its return slot), even
      // when its implementation is invoked with delegatecall, so it must continue through the full
      // block materialization below.
      if (!group.compilerRoute
        && (group.callMode === 'staticcall' || group.callMode === 'delegatecall')) {
        for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
          const nftUtxo = group.dataNftUtxos[i];
          builder.addOutput({
            to: nftUtxo.unlocker.generateLockingBytecode(),
            amount: nftUtxo.satoshis,
            token: nftUtxo.token,
          });
        }
        continue;
      }

      // B's data NFT outputs with state updates (regular and .call modes)
      const bStateUpdates = this.externalCallStateUpdates.get(group.categoryId);
      const bCurrentState: Record<
      string, StateValue
      > = {};

      // Read current state from B's data NFTs
      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftIdx = group.requiredDataNftIndices[i];
        const nftUtxo = group.dataNftUtxos[i];
        if (nftUtxo?.token?.nft?.commitment) {
          const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, group.stateLayout, nftIdx);
          for (const [key, value] of Object.entries(parsed)) {
            bCurrentState[key] = value;
          }
        }
      }

      // Apply B's state overrides
      if (bStateUpdates) {
        for (const [name, value] of bStateUpdates) {
          bCurrentState[name] = value;
        }
      }

      const externalDynamicChunks: Output[] = [];
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
        console.error('external-dynamic-plan', {
          categoryId: group.categoryId,
          functionName: group.functionName,
          compilerRoute: group.compilerRoute?.abiFunction.name,
          logicalSelectors: group.compilerRoute?.logicalSelectors,
          blockInputs: group.blockInputs?.length,
          blockSize: group.blockLayout?.blockSize,
          trailingBase: group.blockLayout?.trailingBase,
          sharedGroupIndex: group.sharedGroupIndex,
          dynamicStateValues: Object.keys(group.dynamicStateValues ?? {}),
          stateUpdates: [...(bStateUpdates?.keys() ?? [])],
        });
      }
      for (const variable of group.stateLayout.variables) {
        if (!variable.dynamic) continue;
        const value = group.dynamicStateValues?.[variable.name]
          ?? bStateUpdates?.get(variable.name);
        if (value === undefined) continue;
        const raw = typeof value === 'string' ? utf8ToBin(value)
          : value instanceof Uint8Array ? value : undefined;
        if (!raw) {
          throw new Error(
            `External dynamic state '${variable.name}' requires a canonical bytes/string value`,
          );
        }
        const collectionHash = computeCollectionHash(
          dynamicChunkSignature(variable.name, variable.type),
        );
        const lockingBytecode = scriptToLockingBytecode(
          buildEntryNftCovenantScript(hexToBin(group.categoryId), collectionHash),
          group.externalContract?.inner?.addressType ?? 'p2sh32',
        );
        for (const [index, chunk] of splitValueIntoChunks(raw).entries()) {
          const output: Output = {
            to: lockingBytecode,
            amount: 1200n,
            token: {
              amount: 0n,
              category: group.categoryId,
              nft: {
                capability: 'mutable',
                commitment: buildChunkCommitment(index, chunk),
              },
            },
          };
          output.amount = BigInt(Math.max(1200, calculateDust(output)));
          externalDynamicChunks.push(output);
        }
      }

      const displacedRouteStateOutputs: Output[] = [];
      const updatedStateNames = new Set(bStateUpdates?.keys() ?? []);
      // Create B's data NFT outputs with updated commitments
      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftIdx = group.requiredDataNftIndices[i];
        const nftUtxo = group.dataNftUtxos[i];
        // Rebuilding an untouched NFT from parsed defaults is not an identity
        // (MarketplaceData nft 1 is only immutable `__blockOracleOwner` and
        // collapsed from 70 bytes to a 35-byte empty pubkey). The callee then
        // EQUALVERIFYs UTXO vs OUTPUT commitment.
        const nftVars = group.stateLayout.variables.filter((variable) => variable.nftIndex === nftIdx);
        const nftIsImmutable = nftVars.length > 0 && nftVars.every((variable) => variable.immutable);
        const nftHasUpdate = !nftIsImmutable && nftVars.some((variable) => updatedStateNames.has(variable.name));
        const inputCommitment = nftUtxo.token?.nft?.commitment;
        const commitment = this.externalCallStateRawCommitments.get(group.categoryId)?.get(nftIdx)
          ?? (nftHasUpdate || !inputCommitment
            ? buildPushdataCommitment(
            group.stateLayout, bCurrentState, nftIdx,
            this.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
            )
            : inputCommitment);

        const stateOutput: Output = {
          to: nftUtxo.unlocker.generateLockingBytecode(),
          amount: nftUtxo.satoshis,
          token: {
            amount: nftUtxo.token?.amount ?? 0n,
            category: group.categoryId,
            nft: {
              capability: nftUtxo.token?.nft?.capability ?? 'mutable',
              commitment,
            },
          },
        };
        if (group.compilerRoute && group.delegateCallGroupIndex !== undefined) {
          displacedRouteStateOutputs.push(stateOutput);
          builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
        } else {
          builder.addOutput(stateOutput);
        }
      }

      // Full block: output B's remaining slots (entries, SC, TCs, transfers, events, etc.)
      if (group.blockInputs && group.blockLayout) {
        if (externalDynamicChunks.length > (group.blockLayout.trailingCapacity ?? 0)) {
          throw new Error(
            'External dynamic state exceeds balanced trailing capacity '
            + `(${externalDynamicChunks.length} > ${group.blockLayout.trailingCapacity ?? 0})`,
          );
        }
        // The blockInputs already include master + dataNfts at positions 0..D.
        // The remaining positions (D+1..) need corresponding outputs.
        const dataNftEnd = 1 + group.requiredDataNftIndices.length;
        let eventIdx = 0;
        let keccakIdx = 0;
        let externalDynamicChunkIdx = 0;
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_INPUTS === '1') {
          // eslint-disable-next-line no-console
          console.error(`[blockInputs g${groupIndex}] n=${group.blockInputs.length} `
            + `slots=${group.blockLayout.slots.length} :: ${group.blockInputs.slice(0, 24)
              .map((bi, k) => `${k}:${group.blockLayout!.slots[k]?.kind ?? '-'}`
                + `/${bi.token?.nft?.commitment ? 'NFT' : 'plain'}`).join(' ')}`);
          console.error('[block-output-metadata]', {
            groupIndex,
            categoryId: group.categoryId,
            blockSize: group.blockLayout.blockSize,
            trailingBase: group.blockLayout.trailingBase,
            plannedEntryInserts: group.plannedEntryInserts,
            batchPredecessorOutputs: group.batchPredecessorOutputs?.map((output) => ({
              outputBlockSlot: output.outputBlockSlot,
              lockingBytecode: binToHex(output.lockingBytecode),
              commitment: output.commitment.slice(0, 32),
            })),
          });
        }
        for (let si = dataNftEnd; si < group.blockInputs.length; si++) {
          const input = group.blockInputs[si];
          const slot = group.blockLayout.slots[si];
          if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_CHUNK_GEOM === '1') {
            console.error('block-loop-pos', { groupIndex, si, absOut: builder.outputs.length, kind: slot?.kind });
          }

          // Matched on the absolute index this iteration is about to fill, across every group: the pin's owning
          // group is not the group it was probed from. See deriveRouteValueChunks.
          const derivedChunk = this.derivedChunkOutputs.get(builder.outputs.length);
          const derivedOccupant = this.allInputs[builder.outputs.length];
          const suffixOwnedChunk = this.delegateDynamicChunksAtSuffix && derivedChunk
            && (derivedChunk.categoryId ?? this.categoryId) === this.categoryId;
          if (derivedChunk && !suffixOwnedChunk
            && derivedOccupant?.token?.nft?.capability !== 'minting') {
            if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
              console.error('chunk-placed', { groupIndex, si, absOut: builder.outputs.length });
            }
            builder.addOutput({
              to: derivedChunk.lockingBytecode,
              amount: 1000n,
              token: {
                amount: 0n,
                category: derivedChunk.categoryId ?? group.categoryId,
                nft: { capability: 'mutable', commitment: derivedChunk.commitment },
              },
            });
            continue;
          }
          const plannedInsertIndex = group.plannedEntryInserts
            ?.findIndex((planned) => planned.outputBlockSlot === si) ?? -1;
          const batchPredecessor = group.batchPredecessorOutputs
            ?.find((planned) => planned.outputBlockSlot === si);
          const routedDynamicResource = group.dynamicChunkResources
            ?.find((resource) => resource.blockSlot === si);

          if (routedDynamicResource && !routedDynamicResource.write) {
            builder.addOutput({
              to: input.unlocker.generateLockingBytecode(),
              amount: input.satoshis,
              token: cloneToken(input.token),
            });
            continue;
          }

          if (batchPredecessor) {
            builder.addOutput({
              to: batchPredecessor.lockingBytecode,
              amount: 1000n,
              token: {
                amount: 0n,
                category: group.categoryId,
                nft: { capability: 'mutable', commitment: batchPredecessor.commitment },
              },
            });
            continue;
          }

          if (plannedInsertIndex >= 0) {
            const plannedInsert = group.plannedEntryInserts![plannedInsertIndex];
            const handle = group.plannedEntryInsertHandles?.[plannedInsertIndex];
            const insert = handle === undefined ? undefined : this.externalCallEntryInserts[handle];
            const commitment = insert?.commitment || plannedInsert.commitment;
            const predecessor = group.blockInputs[plannedInsert.blockSlot];
            builder.addOutput(commitment && predecessor
              ? {
                to: insert?.to ?? predecessor.unlocker.generateLockingBytecode(),
                amount: 1000n,
                token: {
                  amount: 0n,
                  category: group.categoryId,
                  nft: { capability: 'mutable', commitment },
                },
              }
              : {
                to: input.unlocker.generateLockingBytecode(),
                amount: input.satoshis,
                token: cloneToken(input.token),
              });
            continue;
          }

          // Trailing cross-contract callee LOOP entry (no block-layout slot, si >= entryLoopStart): mint B's
          // SDK-computed updated commitment. B's covenant pins output[master+blockSize+counter] == coSlot|coNext|newVal,
          // so a wrong commitment reverts (never silent-wrong).
          if (group.entryLoopStart !== undefined && si >= group.entryLoopStart) {
            const commit = group.entryLoopCommitments?.[si - group.entryLoopStart];
            builder.addOutput(commit !== undefined
              ? {
                to: input.unlocker.generateLockingBytecode(),
                amount: input.satoshis,
                token: {
                  amount: input.token?.amount ?? 0n,
                  category: group.categoryId,
                  nft: { capability: input.token?.nft?.capability ?? 'mutable', commitment: commit },
                },
              }
              : { to: input.unlocker.generateLockingBytecode(), amount: input.satoshis, token: cloneToken(input.token) });
            continue;
          }

          // keccak256 side-car slots: recreate with the computed result R_i (from the group's keccakRecreates).
          if (slot?.kind === 'keccakSideCar') {
            const rec = group.keccakRecreates?.[keccakIdx++];
            builder.addOutput(rec ?? {
              to: input.unlocker.generateLockingBytecode(), amount: input.satoshis, token: cloneToken(input.token),
            });
            continue;
          }

          // vmap sorted-entry slot for a cross-contract callee WRITE (docs/deferrals.md #1): mint B's updated entry
          // (UPDATE) or its re-pointed predecessor P' (INSERT) with the commitment derived from B's VM trace. A
          // read-only entry (or an absent-key funder placeholder) has no stored commitment -> mirror the input.
          if (slot?.kind === 'entry') {
            const bEntryOut = this.externalCallEntryOutputs.get(group.categoryId)?.get(si);
            const embeddedEntry = this.entryNfts.find((entry) => entry.utxo !== undefined
              && entry.utxo.txid.toLowerCase() === input.txid.toLowerCase()
              && entry.utxo.vout === input.vout);
            const embeddedCommitment = embeddedEntry === undefined
              ? undefined : this.entryRawCommitments.get(embeddedEntry.slotIndex);
            const entryLockingBytecode = this._externalEntryLockingBytecode(group, slot)
              ?? group.batchEntryLockingBytecodes?.get(si)
              ?? input.unlocker.generateLockingBytecode();
            if (['SOLIDC_DEBUG_ROUTE_CONCISE', 'SOLIDC_DEBUG_FAILURE_RING'].some((name) =>
              (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[name] === '1')
              && group.compilerRoute && si < 12) {
              console.error('builder-route-entry-output', {
                groupIndex, si, absoluteOutput: builder.outputs.length,
                callMode: group.callMode, hasCommitment: bEntryOut !== undefined,
                hasLockingBytecode: group.batchEntryLockingBytecodes?.has(si) ?? false,
                embeddedEntrySlot: embeddedEntry?.slotIndex,
                hasEmbeddedCommitment: embeddedCommitment !== undefined,
                inputOutpoint: `${input.txid}:${input.vout}`,
                inputCommitment: input.token?.nft?.commitment,
                localEntries: this.entryNfts.map((entry) => ({
                  slot: entry.slotIndex,
                  outpoint: entry.utxo ? `${entry.utxo.txid}:${entry.utxo.vout}` : undefined,
                })),
                insertPredecessors: this.insertLoopPredecessorInputs.map((entry) =>
                  `${entry.txid}:${entry.vout}`),
              });
            }
            if (embeddedEntry !== undefined && embeddedCommitment !== undefined) {
              embeddedEntrySlots.add(embeddedEntry.slotIndex);
              builder.addOutput({
                to: entryLockingBytecode,
                amount: input.satoshis,
                token: {
                  amount: input.token?.amount ?? 0n,
                  category: this.categoryId,
                  nft: {
                    capability: input.token?.nft?.capability ?? 'mutable',
                    commitment: embeddedCommitment,
                  },
                },
              });
              continue;
            }
            if (bEntryOut !== undefined) {
              builder.addOutput({
                to: entryLockingBytecode,
                amount: input.satoshis,
                token: {
                  amount: input.token?.amount ?? 0n,
                  category: group.categoryId,
                  nft: { capability: input.token?.nft?.capability ?? 'mutable', commitment: bEntryOut },
                },
              });
              continue;
            }
            // After the 4-wide minting swap, a missing conditional entry is a funder in
            // blockInputs. Cloning that P2PKH leaves output master+offset empty of tokens
            // (updateJobPost: slot 2 / output 30) and FakeToken dies on pred-out GTE.
            if (!input.token && (this.mintingOutputSwap?.categoryId === group.categoryId
              || group.batchEntryLockingBytecodes?.has(si))) {
              const sibling = builder.outputs.slice(groupOutputStart).find((output) =>
                output.token?.category === group.categoryId && output.token.nft?.capability === 'mutable');
              const siblingLock = sibling?.to instanceof Uint8Array
                ? sibling.to
                : sibling?.to !== undefined ? addressToLockScript(sibling.to) : undefined;
              builder.addOutput({
                to: entryLockingBytecode ?? siblingLock ?? Uint8Array.of(0x51),
                amount: BigInt(Math.max(1000, Number(input.satoshis))),
                token: {
                  amount: 0n,
                  category: group.categoryId,
                  nft: { capability: 'mutable', commitment: '00'.repeat(128) },
                },
              });
              continue;
            }
            builder.addOutput({
              to: input.unlocker.generateLockingBytecode(),
              amount: input.satoshis,
              token: cloneToken(input.token),
            });
            continue;
          }

          if (slot?.kind === 'trailing' && externalDynamicChunkIdx < externalDynamicChunks.length) {
            const output = externalDynamicChunks[externalDynamicChunkIdx++];
            builder.addOutput(output);
            continue;
          }

          // X13: B's return event belongs to B's OWN block slot, paired with the funding input the block now
          // carries at the same offset. The commitment comes from B's VM trace (setReturnEventOutput).
          if (slot?.kind === 'returnEvent'
            && ['SOLIDC_DEBUG_ROUTE_CONCISE', 'SOLIDC_DEBUG_FAILURE_RING'].some((name) =>
              (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[name] === '1')) {
            console.error('builder-route-return-output', {
              groupIndex, si, absoluteOutput: builder.outputs.length,
              returnEventInBlock: group.returnEventInBlock,
              fusedReturnGroupIndex: group.fusedReturnGroupIndex,
              pendingIdentities: this.pendingReturnEventOutputs.map((event) => ({
                identity: event.identity,
                categoryId: event.categoryId,
                commitmentLength: event.commitment.length,
                commitment: binToHex(event.commitment.slice(0, 24)),
              })),
            });
          }
          if (slot?.kind === 'returnEvent' && group.returnEventInBlock) {
            const returnIdentity = `external-call:${group.fusedReturnGroupIndex ?? groupIndex}`;
            const exact = this.pendingReturnEventOutputs.find((r) => r.identity === returnIdentity);
            const first = this.pendingReturnEventOutputs.find((r) => r.identity === `${returnIdentity}:0`);
            // A fused writer's exact return starts as a zero seed. Until its covenant reaches the return check,
            // keep the independently precomputed logical result in that physical slot so the shared route can
            // advance. Once authenticated (including a legitimate `false`), the exact result wins.
            const re = exact?.provisional && first?.commitment.some((byte) => byte !== 0)
              ? first : exact ?? first;
            const writerAbi = group.compilerRoute?.abiFunction
              ?? (group.externalContract?.inner?.artifact?.abi as AbiFunction[] | undefined)
                ?.find((fn) => fn.name === group.functionName);
            const writerReturnsBool = writerAbi?.outputs?.length === 1 && writerAbi.outputs[0].type === 'bool';
            const evmBool = artifactUsesSolidityAbi(group.externalContract?.inner?.artifact ?? {});
            // State-writing bools (transferFrom) default to success. Views (arbitratorRegistered)
            // default to false so a missing precompute cannot admit an unregistered party.
            // A fused zero seed is unset, not false — SafeERC20 abi.decode(00) fails VERIFY.
            const returnCommitment = canonicalWriterReturnCommitment({
              pendingHex: re && re.commitment.length > 0 ? binToHex(re.commitment) : '',
              writesState: writerAbi?.writesState === true,
              evmBool,
              returnsBool: writerReturnsBool,
            });
            const identity = re?.identity ?? returnIdentity;
            addReturnOutput(builder, identity, {
              to: new Uint8Array([0x51]),
              amount: BALANCED_SLOT_SATOSHIS,
              token: {
                amount: 0n,
                category: group.categoryId,
                nft: { capability: 'none', commitment: returnCommitment },
              },
            });
            continue;
          }

          // Event slots: use auto-derived event NFT output or placeholder
          if (slot?.kind === 'event') {
            const eo = group.eventOutputs?.[eventIdx];
            const debugEventIndexRaw = (globalThis as {
              process?: { env?: Record<string, string> };
            }).process?.env?.SOLIDC_DEBUG_EVENT_INDEX;
            const debugEventIndex = debugEventIndexRaw === undefined
              ? undefined : Number.parseInt(debugEventIndexRaw, 10);
            if (debugEventIndex === builder.outputs.length) {
              console.error('participant-event-materialization', JSON.stringify({
                groupIndex,
                physicalFunction: group.functionName,
                logicalFunction: group.logicalFunctionName,
                routeFunction: group.compilerRoute?.abiFunction.name,
                contract: group.externalContract?.inner?.artifact?.contractName,
                logicalContract: group.logicalContract?.inner?.artifact?.contractName,
                categoryId: group.categoryId,
                masterInput: this.getExternalCallMasterInputIndex(groupIndex),
                outputBase: this.getExternalCallOutputBase(groupIndex),
                slot,
                eventIdx,
                learnedSignature: eo?.eventSignature,
                learnedCommitment: eo?.commitment,
              }));
            }
            if (eo && eo.commitment !== '' && !/^0+$/.test(eo.commitment)) {
              // Use auto-derived commitment
              builder.addOutput({
                to: eo.lockingBytecode,
                amount: 1200n,
                token: {
                  amount: 0n,
                  category: group.categoryId,
                  nft: { capability: 'none', commitment: eo.commitment },
                },
              });
            } else if (group.compilerRoute
              && !['transferFrom', 'transfer'].includes(group.functionName)
              && !['transferFrom', 'transfer'].includes(group.compilerRoute.abiFunction.name)) {
              // A message-bus route reserves the union of every handler's event slots. Slots not reached by
              // this dispatch are ordinary balanced funding slots and the route covenant binds them by
              // preservation. Mirroring the input also works as the active-slot probe: its empty commitment
              // lets the trace expose the expected event blob, after which `eventOutputs` replaces this slot.
              builder.addOutput({
                to: input.unlocker.generateLockingBytecode(),
                amount: input.satoshis,
                token: cloneToken(input.token),
              });
            } else {
              // Placeholder: create event NFT with empty commitment so B's VM can
              // find the output structure. The iterative derivation will fill it in.
              const bArt = group.externalContract?.inner?.artifact ?? group.externalContract?.artifact;
              const bAbiFunc = bArt?.abi?.find((f: any) => f.name === group.functionName);
              const bEmits: Array<{ eventSignature: string }> = bAbiFunc?.emits ?? [];
              if (eventIdx < bEmits.length) {
                const emitInfo = bEmits[eventIdx];
                const eventNameHash = computeEventNameHash(emitInfo.eventSignature);
                const covenantScript = buildEventNftCovenantScript(
                  hexToBin(group.categoryId), eventNameHash,
                );
                const lockingBytecode = scriptToLockingBytecode(
                  covenantScript, group.externalContract?.inner?.addressType ?? 'p2sh32',
                );
                builder.addOutput({
                  to: lockingBytecode,
                  amount: 1200n,
                  token: {
                    amount: 0n,
                    category: group.categoryId,
                    nft: { capability: 'none', commitment: '' },
                  },
                });
              } else {
                // Fallback pass-through
                builder.addOutput({
                  to: input.unlocker.generateLockingBytecode(),
                  amount: input.satoshis,
                  token: cloneToken(input.token),
                });
              }
            }
            eventIdx++;
          } else {
            // Pass-through: output mirrors input (preserve locking bytecode, value, token)
            builder.addOutput({
              to: input.unlocker.generateLockingBytecode(),
              amount: input.satoshis,
              token: cloneToken(input.token),
            });
          }
        }
      } else {
        // Legacy/unbalanced external calls place their runtime chunk run immediately after the fixed
        // master+data group. The callee covenant derives the same master-relative base.
        for (const output of externalDynamicChunks) builder.addOutput(output);
      }
      // Trailing NEW entry nodes for a cross-contract callee INSERT (docs/deferrals.md #1): B's covenant mints the
      // NEW at masterInputIndex + blockSize, right after B's block. Placed here in group order (skip cleared handles).
      for (const ins of this.externalCallEntryInserts) {
        if (ins.categoryId !== group.categoryId || ins.commitment === '') continue;
        const handle = this.externalCallEntryInserts.indexOf(ins);
        if (group.plannedEntryInsertHandles?.includes(handle)) continue;
        builder.addOutput({
          to: ins.to,
          amount: 1000n,
          token: { amount: 0n, category: group.categoryId, nft: { capability: 'mutable', commitment: ins.commitment } },
        });
      }
      if (group.delegateCallGroupIndex !== undefined) {
        if (!group.delegateEmbeddedInBlock) appendDelegateGroupOutputs(group.delegateCallGroupIndex);
        if (group.compilerRoute) {
          // Preserve the displaced proxy master immediately after its associated implementation band, which
          // is the same absolute coordinate as the proxy-master input in the routed input layout.
          builder.addOutput({
            to: bMaster.unlocker.generateLockingBytecode(), amount: bMaster.satoshis, token: bMaster.token,
          });
          for (const stateOutput of displacedRouteStateOutputs) builder.addOutput(stateOutput);
        }
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_FAILURE_RING === '1') {
        console.error('builder-route-group-output-range', {
          groupIndex,
          functionName: group.functionName,
          contract: group.externalContract?.inner?.artifact.contractName,
          categoryId: group.categoryId,
          start: groupOutputStart,
          end: builder.outputs.length,
        });
      }
    }
    debugOwnMutableOutputs('after-external-groups');

    // A delegate facet is preserved at its absolute input index, and the block layout now reserves that index
    // immediately after the proxy's master/data-NFT region - the position the delegate covenant derives with
    // `OP_INPUTINDEX - (1 + dataNftCount)`. Emit the facet preservation output there FIRST, then the proxy's
    // return channel, so the output side matches the reserved input side instead of claiming its slot.
    if (this.delegateEntriesAfterLowLevel) {
      // X56. The return channel follows the implementation's OWN output-only slots, not the facet master
      // directly. An implementation that also emits resolves its event at `implInput + 1` - the position this
      // used to hand the return event - and computeBlockLayout always orders events before the returnEvent, so
      // deferring the return channel past the event outputs is what makes the two agree. `deferred` is empty
      // for every implementation without an event slot, so a plain returning delegate keeps this exact index.
      // A full external-call block has already emitted its return event at the block's returnEvent slot. Only
      // legacy/transitive tail returns belong beside the delegated implementation; appending an in-block return
      // a second time shifts the implementation preservation output and invalidates its covenant frame.
      const externalReturnEvents = this.tailReturnEventOutputs()
        .filter((r) => r.categoryId !== this.categoryId);
      if (this.delegateReturnEventAfterEvents) deferredDelegateReturnEvents.push(...externalReturnEvents);
      for (const re of (this.delegateReturnEventAfterEvents ? [] : externalReturnEvents)) {
        addReturnOutput(builder, re.identity, {
          to: new Uint8Array([0x51]),
          amount: 800n,
          token: {
            amount: 0n,
            category: re.categoryId,
            nft: { capability: 'none', commitment: binToHex(re.commitment) },
          },
        });
      }
    }

    // Create entry NFT outputs (written/preserved entries, excluding deleted ones). Entry outputs occupy
    // consecutive block-layout offsets; the covenant reads each existing/written slot's output at its FIXED
    // offset. A slot that produces no output (soft-delete of an ABSENT key, or an alias-skipped write) would
    // shift a later real output down and desync that fixed read, so emit a plain placeholder output for any
    // skipped slot below the fill threshold (see entryPlaceholderFillThreshold).
    const sortedEntries = [...this.entryNfts].sort((a, b) => a.slotIndex - b.slotIndex);
    const fillThreshold = this.entryPlaceholderFillThreshold();
    for (const entry of sortedEntries) {
      if (embeddedEntrySlots.has(entry.slotIndex)) continue;
      if (this.entryDeletes.has(entry.slotIndex)) {
        if (entry.slotIndex < fillThreshold) {
          // Position-holding placeholder: neutral OP_TRUE, outside the collection address namespace. The covenant
          // existence-gates this absent slot away, so it is never verified; using the entry address here would
          // incorrectly increase vmap's exact collection-output cardinality.
          builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
        }
        continue;
      }

      const value = this.entryUpdates.get(entry.slotIndex);
      const rawCommitment = this.entryRawCommitments.get(entry.slotIndex);

      // Priority: manual setEntry() > auto-derived raw commitment > UTXO preservation > default
      let commitment: string;
      const isMultiKey = entry.keyTypes && entry.keyValues && entry.keyTypes.length > 1;
      const structs = this.stateLayout.structs;
      if (value !== undefined) {
        if (isMultiKey) {
          commitment = buildEntryCommitmentMultiKey(
            entry.keyValues!, entry.keyTypes!, value, entry.valueType, structs,
          );
        } else {
          commitment = buildEntryCommitment(entry.keyValue, entry.keyType, value, entry.valueType, structs);
        }
      } else if (rawCommitment !== undefined) {
        commitment = rawCommitment;
      } else if (entry.exists && entry.utxo?.token?.nft?.commitment) {
        // Preserve current commitment unchanged
        commitment = entry.utxo.token.nft.commitment;
      } else {
        // New entry without explicit value - use type default
        const defaultValue = getDefaultStateValue(entry.valueType, structs);
        if (isMultiKey) {
          commitment = buildEntryCommitmentMultiKey(
            entry.keyValues!, entry.keyTypes!, defaultValue, entry.valueType, structs,
          );
        } else {
          commitment = buildEntryCommitment(entry.keyValue, entry.keyType, defaultValue, entry.valueType, structs);
        }
      }

      // Entry NFT output uses the per-collection entry covenant's locking bytecode
      const lockingBytecode = entry.exists && entry.utxo
        ? entry.utxo.unlocker.generateLockingBytecode()
        : this.entryNftLockingBytecodes.get(entry.collection);

      if (!lockingBytecode) {
        throw new Error('Cannot determine locking bytecode for entry NFT output');
      }

      builder.addOutput({
        to: lockingBytecode,
        amount: entry.utxo?.satoshis ?? 1200n,
        token: {
          amount: 0n,
          category: this.categoryId,
          nft: {
            capability: 'mutable',
            commitment,
          },
        },
      });
    }

    // Create satoshi container preservation output (after entries, before transfers)
    // Skip when fully drained (all satoshis transferred out)
    if (this.satoshiContainerUtxo) {
      const totalTransferAmount = this.pendingTransfers
        .filter((t) => t.lockingBytecode.length > 0)
        .reduce((sum, t) => sum + t.amount, 0n)
        + this.runtimeLoopTransferOutputs
          .filter((transfer) => (transfer.kind ?? 'bch') === 'bch')
          .reduce((sum, transfer) => sum + transfer.amount, 0n);
      if (totalTransferAmount > this.satoshiContainerUtxo.satoshis + this.containerDepositAmount) {
        throw new Error(
          `Total transfer amount (${totalTransferAmount}) exceeds satoshi container balance `
          + `(${this.satoshiContainerUtxo.satoshis}${this.containerDepositAmount > 0n ? ` + ${this.containerDepositAmount} deposit` : ''})`,
        );
      }

      const remainingAmount = this.satoshiContainerUtxo.satoshis - totalTransferAmount + this.containerDepositAmount;
      const satoshiContainerLockingBytecode = this.satoshiContainerLockingBytecode
        ?? this.satoshiContainerUtxo.unlocker.generateLockingBytecode();
      // Exact dust threshold for the satoshi-container output (token-aware; plain P2SH32 => 576).
      const DUST_MINIMUM = getDustThreshold({ lockingBytecode: satoshiContainerLockingBytecode });
      if (remainingAmount > 0n && remainingAmount < DUST_MINIMUM) {
        throw new Error(
          `Satoshi container remaining balance (${remainingAmount}) is below dust threshold (${DUST_MINIMUM}). `
          + 'Either transfer all satoshis (fully drain) or leave at least the dust minimum.',
        );
      }
      if (remainingAmount >= DUST_MINIMUM) {
        builder.addOutput({
          to: satoshiContainerLockingBytecode,
          amount: remainingAmount,
        });
      } else {
        // Drained: insert a 0-satoshi OP_RETURN placeholder to maintain block layout
        // output positions. The compiler's covenant verification detects the mismatched
        // locking bytecode and treats this slot as drained.
        builder.addOutput({ to: Uint8Array.from([0x6a]), amount: 0n });
      }
    }

    // Create token container preservation outputs (before transfers/tcTransfers/events
    // so that input-bearing tokenContainer slots are contiguous and match blockLayout offsets).
    // Skip drained containers (all FTs transferred + NFT transferred if present)
    for (const container of this.tokenContainers.sort((a, b) => a.tokenContainerSlotIndex - b.tokenContainerSlotIndex)) {
      if (!container.exists || !container.utxo) continue;
      if (this.isTokenContainerDrained(container.tokenContainerCategoryId)) {
        // Drained: insert a 0-satoshi OP_RETURN placeholder to maintain block layout
        // output positions. The compiler's covenant verification detects the absence of
        // tokens at this output and skips preservation checks.
        builder.addOutput({ to: Uint8Array.from([0x6a]), amount: 0n });
        continue;
      }

      const lockingBytecode = this.tokenContainerLockingBytecodes.get(container.tokenContainerCategoryId)
        ?? container.utxo.unlocker.generateLockingBytecode();

      // Compute remaining FT amount after transfers
      const transferredFtAmount = this.pendingTokenContainerTransfers
        .filter((s) => s.tokenContainerCategoryId === container.tokenContainerCategoryId)
        .reduce((sum, s) => sum + s.amount, 0n)
        + this.runtimeLoopTransferOutputs
          .filter((transfer) => transfer.kind === 'token'
            && transfer.tokenContainerCategoryId === container.tokenContainerCategoryId)
          .reduce((sum, transfer) => sum + transfer.amount, 0n);

      const inputFtAmount = container.utxo.token?.amount ?? 0n;
      if (transferredFtAmount > inputFtAmount) {
        throw new Error(
          `Total fungible token transfer amount (${transferredFtAmount}) exceeds token container balance (${inputFtAmount}) for category ${container.tokenContainerCategoryId}`,
        );
      }

      const depositedFtAmount = this.pendingTokenContainerDeposits
        .get(container.tokenContainerCategoryId) ?? 0n;
      const remainingFtAmount = inputFtAmount - transferredFtAmount + depositedFtAmount;

      // Check if NFT was transferred out
      const nftWasTransferred = this.pendingTokenContainerTransferNfts.some(
        (s) => s.tokenContainerCategoryId === container.tokenContainerCategoryId,
      ) || this.runtimeLoopTransferOutputs.some((transfer) => transfer.kind === 'nft'
        && transfer.tokenContainerCategoryId === container.tokenContainerCategoryId);

      builder.addOutput({
        to: lockingBytecode,
        amount: container.utxo.satoshis,
        token: {
          amount: remainingFtAmount,
          category: container.tokenContainerCategoryId,
          // Preserve NFT if it wasn't transferred, strip it if it was
          ...(!nftWasTransferred && container.utxo.token?.nft && {
            nft: container.utxo.token.nft,
          }),
        },
      });
    }

    // Create transfer outputs (plain BCH, no tokens). A graph route reserves a fixed per-row transfer frame;
    // inactive sites remain OP_TRUE outputs so later participant blocks cannot slide into the gaps.
    const reservedTransferSlots = this.blockLayout?.slots.filter((slot) => slot.kind === 'transfer').length
      ?? this.pendingTransfers.length;
    for (let transferSlot = delegateTransferSlotsConsumed;
      transferSlot < reservedTransferSlots; transferSlot += 1) {
      const transfer = this.pendingTransfers[transferSlot];
      if (!transfer || transfer.lockingBytecode.length === 0) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      } else {
        builder.addOutput({
          to: transfer.lockingBytecode,
          amount: transfer.amount,
        });
      }
    }

    // Create token container transfer outputs (FT and NFT interleaved in source-code order)
    // The compiler assigns sequential transfer indices in source order, so the SDK must
    // produce outputs in the same order to match covenant verification expectations.
    const allTcTransfers: Array<{ type: 'ft'; data: TokenContainerTransferData } | { type: 'nft'; data: TokenContainerTransferNftData }> = [
      ...this.pendingTokenContainerTransfers.map((d) => ({ type: 'ft' as const, data: d })),
      ...this.pendingTokenContainerTransferNfts.map((d) => ({ type: 'nft' as const, data: d })),
    ];
    allTcTransfers.sort((a, b) => a.data.insertionOrder - b.data.insertionOrder);
    const tcTransferBySlot = new Map(allTcTransfers.map((entry) => [entry.data.insertionOrder, entry]));

    const reservedTokenTransferSlots = this.blockLayout?.slots.filter((slot) => slot.kind === 'tcTransfer').length
      ?? allTcTransfers.length;
    for (let transferSlot = 0; transferSlot < reservedTokenTransferSlots; transferSlot += 1) {
      const entry = tcTransferBySlot.get(transferSlot);
      if (!entry) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
        continue;
      }
      if (entry.type === 'ft') {
        builder.addOutput({
          to: entry.data.lockingBytecode,
          amount: 1200n,
          token: {
            amount: entry.data.amount,
            category: entry.data.tokenContainerCategoryId,
          },
        });
      } else {
        builder.addOutput({
          to: entry.data.lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: entry.data.tokenContainerCategoryId,
            nft: {
              capability: entry.data.capability,
              commitment: binToHex(entry.data.commitment),
            },
          },
        });
      }
    }

    // Create event NFT outputs - merge raw commitments, manual emits, and placeholders
    const eventOutputEntries: Array<{ eventSignature: string; commitment: string }> = [];

    // Manual emitEvent() calls (existing encoding logic)
    for (let ei = 0; ei < this.pendingEventEmits.length; ei++) {
      const eventEmit = this.pendingEventEmits[ei];
      const eventDef = this.eventDefinitions.find((e) => e.signature === eventEmit.eventSignature);
      if (!eventDef) {
        throw new Error(`Unknown event: ${eventEmit.eventSignature}`);
      }

      const encodedParts: Uint8Array[] = [];
      for (let i = 0; i < eventDef.parameters.length; i++) {
        let value = eventEmit.args[i];
        const type = eventDef.parameters[i].type;
        if (typeof value === 'string') {
          if (type === 'string') {
            value = new TextEncoder().encode(value);
          } else if (type === 'address' && value.includes(':')) {
            value = addressToLockScript(value);
          } else if (type === 'address' && /^(0x)?0*$/i.test(value)) {
            value = new Uint8Array(0);
          } else if (type === 'address' && /^0x[0-9a-fA-F]*$/.test(value)) {
            value = hexToBin(value.slice(2));
          } else if (/^0x[0-9a-fA-F]*$/.test(value)) {
            // SDK callers commonly supply pubkeys, hashes, and fixed bytes in ethers-style `0x` form. `isHex`
            // intentionally accepts canonical bare hex only, so normalize the transport prefix before encoding
            // event arguments rather than rejecting an otherwise valid bytes value.
            value = hexToBin(value.slice(2));
          } else if (!isHex(value)) {
            throw new Error(`Invalid event argument at index ${i}: expected a hex string, got '${value}'`);
          } else {
            value = hexToBin(value);
          }
        }
        encodedParts.push(encodePushdataValue(value, type, this.stateLayout.structs));
      }

      const totalLength = encodedParts.reduce((sum, p) => sum + p.length, 0);
      const commitmentBytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of encodedParts) {
        commitmentBytes.set(part, offset);
        offset += part.length;
      }

      eventOutputEntries[ei] = { eventSignature: eventEmit.eventSignature, commitment: binToHex(commitmentBytes) };
    }

    // Placeholders and raw commitments (from auto-derivation)
    for (const placeholder of this.pendingEventPlaceholders) {
      const idx = placeholder.emitIndex;
      if (eventOutputEntries[idx]) continue; // manual emitEvent() takes precedence
      const rawCommitment = this.eventRawCommitments.get(idx);
      eventOutputEntries[idx] = {
        eventSignature: placeholder.eventSignature,
        commitment: rawCommitment ?? '',
      };
    }

    const reservedEventSlots = this.blockLayout?.slots.filter((slot) => slot.kind === 'event').length
      ?? eventOutputEntries.length;
    for (let eventSlot = 0; eventSlot < reservedEventSlots; eventSlot += 1) {
      const eo = eventOutputEntries[eventSlot];
      if (!eo) {
        // A graph route reserves a fixed event frame. Keep every inactive site as a balanced plain output so a
        // later participant cannot slide into the gap; the route covenant separately excludes an own-category
        // NFT here, and the atomic callManifest lists only active immutable event outputs.
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
        continue;
      }
      const lockingBytecode = this.eventNftLockingBytecodes.get(eo.eventSignature);
      if (!lockingBytecode) {
        throw new Error(`No locking bytecode provided for event: ${eo.eventSignature}`);
      }

      builder.addOutput({
        to: lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: this.categoryId,
          nft: {
            capability: 'none',
            commitment: eo.commitment,
          },
        },
      });
    }

    // X56. The delegate return channel, deferred from the facet-preservation block above so the co-spent
    // implementation's own event outputs keep the position its covenant resolves for them.
    for (const re of deferredDelegateReturnEvents) {
      addReturnOutput(builder, re.identity, {
        to: new Uint8Array([0x51]),
        amount: 800n,
        token: {
          amount: 0n,
          category: re.categoryId,
          nft: { capability: 'none', commitment: binToHex(re.commitment) },
        },
      });
    }

    // Create return event outputs (from cross-contract calls with return values). X13: a callee whose full block
    // carries a returnEvent slot already emitted its own return event inside that block above.
    for (const re of (this.delegateEntriesAfterLowLevel ? [] : this.tailReturnEventOutputs())) {
      addReturnOutput(builder, re.identity, {
        to: new Uint8Array([0x51]), // OP_TRUE
        amount: 800n,
        token: {
          amount: 0n,
          category: re.categoryId,
          nft: { capability: 'none', commitment: binToHex(re.commitment) },
        },
      });
    }
    if (!this.delegateEntriesAfterLowLevel
      && (this.blockLayout?.trailingCapacity ?? 0) > 0
      && this.blockLayout?.slots.some((slot) => slot.kind === 'returnEvent')
      && this.pendingReturnEventOutputs.length === 0) {
      // A balanced block cannot collapse an inactive return slot: doing so
      // shifts the bounded trailing region one position left.
      builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
    }

    // Create low-level call outputs (after A's block slots, matching block layout ordering)
    for (const [groupIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
      // A delegate associated with an external proxy group was already emitted immediately after that proxy's
      // fixed block by appendDelegateGroupOutputs. Emitting it again here mints a second implementation master
      // output from one input and is rejected by the implementation's minting-NFT conservation covenant.
      if (associatedDelegateOutputs.has(groupIndex)) continue;
      if (this.delegateEntriesAfterLowLevel && group.callMode === 'delegatecall') continue;
      // A compiler-owned route's complete balanced block (including dynamic resources) precedes its physical
      // implementation. Recreate that executor only after the trailing band has been filled below.
      if (this.compilerRouteDelegateBlock && group.callMode === 'delegatecall') continue;
      const bMaster = group.masterUtxo as UnlockableUtxo;
      builder.addOutput({
        to: bMaster.unlocker.generateLockingBytecode(),
        amount: bMaster.satoshis,
        token: bMaster.token,
      });

      if (group.callMode === 'staticcall' || group.callMode === 'delegatecall') {
        for (const nftUtxo of group.dataNftUtxos) {
          builder.addOutput({
            to: nftUtxo.unlocker.generateLockingBytecode(),
            amount: nftUtxo.satoshis,
            token: nftUtxo.token,
          });
        }
        continue;
      }

      const bStateUpdates = this.externalCallStateUpdates.get(group.categoryId);
      const bCurrentState: Record<string, StateValue> = {};
      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftIdx = group.requiredDataNftIndices[i];
        const nftUtxo = group.dataNftUtxos[i];
        if (nftUtxo?.token?.nft?.commitment) {
          const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, group.stateLayout, nftIdx);
          for (const [key, value] of Object.entries(parsed)) {
            bCurrentState[key] = value;
          }
        }
      }
      if (bStateUpdates) {
        for (const [name, value] of bStateUpdates) {
          bCurrentState[name] = value;
        }
      }
      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftIdx = group.requiredDataNftIndices[i];
        const nftUtxo = group.dataNftUtxos[i];
        const nftVars = group.stateLayout.variables.filter((variable) => variable.nftIndex === nftIdx);
        const nftIsImmutable = nftVars.length > 0 && nftVars.every((variable) => variable.immutable);
        const inputCommitment = nftUtxo.token?.nft?.commitment;
        const commitment = this.externalCallStateRawCommitments.get(group.categoryId)?.get(nftIdx)
          ?? (nftIsImmutable && inputCommitment
            ? inputCommitment
            : buildPushdataCommitment(
            group.stateLayout, bCurrentState, nftIdx,
            this.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
            ));
        builder.addOutput({
          to: nftUtxo.unlocker.generateLockingBytecode(),
          amount: nftUtxo.satoshis,
          token: {
            amount: nftUtxo.token?.amount ?? 0n,
            category: group.categoryId,
            nft: {
              capability: nftUtxo.token?.nft?.capability ?? 'mutable',
              commitment,
            },
          },
        });
      }
    }

    // Low-level call raw UTXO outputs (preserved unchanged)
    for (const rawUtxo of this.lowLevelCallRawInputs) {
      builder.addOutput({
        to: rawUtxo.unlocker.generateLockingBytecode(),
        amount: rawUtxo.satoshis,
        token: rawUtxo.token,
      });
    }

    // Iteration entry outputs (read-only co-spent chunks / collection-iter entries) come FIRST in the trailing
    // region, preserved at their input index [blockSize, blockSize+count) (the chunk covenant pins
    // output==input). New chunk outputs follow, after getChunkOutputBase() (which includes this count).
    // Skipped when already emitted before the callee outputs (loop external-call case).
    // A balanced block can reserve fixed slots that are absent from this concrete call. Runtime trailing
    // resources still begin at the compiler-owned trailingBase; pad those unused fixed slots BEFORE emitting
    // iteration entries/chunks/loop entries. Padding after the resources shifts every physical output below the
    // index verified by the covenant (for example, computed base 228 while chunks were emitted at 204).
    if (this.blockLayout) {
      const resourceBases: number[] = [];
      if (this.iterationEntryInputs.length > 0 || this.dynamicChunkVars.length > 0) {
        resourceBases.push(this.getChunkOutputBase() - this.iterationEntryInputs.length
          - (this.loopEntriesBeforeDynamicChunks ? this._trailingLoopEntryOutputCount() : 0)
          - this.runtimeLoopEventOutputs.length - this.runtimeLoopTransferOutputs.length);
      }
      if (this._trailingLoopEntryVars().length > 0) resourceBases.push(this.getLoopEntryOutputBase());
      if (this.runtimeLoopEventOutputs.length > 0) {
        resourceBases.push(this.getRuntimeLoopEventOutputBase());
      }
      if (this.runtimeLoopTransferOutputs.length > 0) {
        resourceBases.push(this.getRuntimeLoopTransferOutputIndex(0));
      }
      if (this.valueChunkOutputs.length > 0 || this.valueChunkVars.size > 0) {
        resourceBases.push(this.getValueChunkOutputBase());
      }
      const firstResourceBase = resourceBases.length > 0 ? Math.min(...resourceBases) : undefined;
      while (firstResourceBase !== undefined && builder.outputs.length < firstResourceBase) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
      }
    }
    for (const iterUtxo of (
      loopChunkBeforeCallees || this.iterationEntriesPlacedAtDelegateBase
        ? [] : this.iterationEntryInputs
    )) {
      builder.addOutput({
        to: iterUtxo.unlocker.generateLockingBytecode(),
        amount: iterUtxo.satoshis,
        token: {
          amount: iterUtxo.token?.amount ?? 0n,
          category: this.categoryId,
          nft: {
            capability: 'mutable',
            commitment: iterUtxo.token?.nft?.commitment ?? '',
          },
        },
      });
    }

    const appendLoopEntry = (
      lv: (typeof this.loopEntryVars)[number], commitment: string,
    ): void => {
      const entryOutput = {
        to: lv.lockingBytecode, amount: 1200n,
        token: { amount: 0n, category: lv.categoryId ?? this.categoryId,
          nft: { capability: 'mutable' as const, commitment } },
      };
      entryOutput.amount = this._loopEntryTransitionSatoshis(lv, commitment)
        ?? BigInt(Math.max(1200, calculateDust(entryOutput)));
      builder.addOutput(entryOutput);
    };
    const appendRuntimeLoopEvent = (eventIndex: number): void => {
      const event = this.runtimeLoopEventOutputs[eventIndex];
      if (!event) throw new Error(`Runtime loop event segment references missing event ${eventIndex}`);
      builder.addOutput({
        to: event.lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: event.categoryId ?? this.categoryId,
          nft: { capability: 'none', commitment: event.commitment },
        },
      });
    };
    const appendRuntimeLoopTransfer = (transferIndex: number): void => {
      const transfer = this.runtimeLoopTransferOutputs[transferIndex];
      if (!transfer) throw new Error(`Runtime loop transfer segment references missing transfer ${transferIndex}`);
      if (transfer.kind === 'token' || transfer.kind === 'nft') {
        if (!transfer.tokenContainerCategoryId) {
          throw new Error(`Runtime loop token transfer ${transferIndex} has no token category`);
        }
        builder.addOutput({
          to: transfer.lockingBytecode,
          amount: 1200n,
          token: {
            amount: transfer.kind === 'nft' ? 0n : transfer.amount,
            category: transfer.tokenContainerCategoryId,
            ...(transfer.kind === 'nft' && {
              nft: {
                capability: transfer.capability ?? 'none',
                commitment: binToHex(transfer.commitment ?? new Uint8Array()),
              },
            }),
          },
        });
      } else {
        builder.addOutput({ to: transfer.lockingBytecode, amount: transfer.amount });
      }
    };
    if (this.runtimeLoopTrailingSegments.length > 0) {
      const variables = new Map(this._trailingLoopEntryVars().map((variable) => [variable.collection, variable]));
      // Fixed-batch predecessor rewrites occupy the leading trailing coordinates, before the source-ordered
      // runtime row stream. They share `loopEntryCommitments` with runtime mapping outputs but deliberately have
      // no runtime segment: a segment describes a source-row occurrence, while these outputs authenticate the
      // fixed entry transition surrounding that row. Previously, entering segmented mode omitted every such
      // collection and let the first runtime output occupy its advertised PredOut coordinate.
      const segmentedCollections = new Set(this.runtimeLoopTrailingSegments.flatMap((segment) => (
        segment.kind === 'entries' ? [segment.collection] : []
      )));
      for (const variable of this._trailingLoopEntryVars()) {
        if (segmentedCollections.has(variable.collection)) continue;
        for (const commitment of this.loopEntryCommitments.get(variable.collection) ?? []) {
          appendLoopEntry(variable, commitment);
        }
      }
      for (const segment of this.runtimeLoopTrailingSegments) {
        if (segment.kind === 'events') {
          for (let index = 0; index < segment.count; index++) {
            appendRuntimeLoopEvent(segment.offset + index);
          }
          continue;
        }
        if (segment.kind === 'transfers') {
          for (let index = 0; index < segment.count; index++) {
            appendRuntimeLoopTransfer(segment.offset + index);
          }
          continue;
        }
        const variable = variables.get(segment.collection);
        if (!variable) throw new Error(`Runtime loop segment references unknown collection '${segment.collection}'`);
        const commitments = this.loopEntryCommitments.get(segment.collection) ?? [];
        for (let index = 0; index < segment.count; index++) {
          const commitment = commitments[segment.offset + index];
          if (commitment === undefined) {
            throw new Error(
              `Runtime loop segment for '${segment.collection}' exceeds its commitment plan `
              + `(${segment.offset + segment.count} > ${commitments.length}; `
              + `required=${this.getRequiredLoopEntryCount(segment.collection)})`,
            );
          }
          appendLoopEntry(variable, commitment);
        }
      }
    } else {
      if (this.loopEntriesBeforeDynamicChunks || this.delegateEntriesAfterLowLevel) {
        for (const lv of this._trailingLoopEntryVars()) {
          for (const commitment of this.loopEntryCommitments.get(lv.collection) ?? []) {
            appendLoopEntry(lv, commitment);
          }
        }
      }

      // Runtime-loop events and their fixed peers are source-ordered records, independent of the permutation used
      // to settle mapping keys. Their exact count is known from the event plan, while commitments are learned
      // progressively from the covenant trace.
      for (let eventIndex = 0; eventIndex < this.runtimeLoopEventOutputs.length; eventIndex++) {
        appendRuntimeLoopEvent(eventIndex);
      }
      for (let transferIndex = 0; transferIndex < this.runtimeLoopTransferOutputs.length; transferIndex++) {
        appendRuntimeLoopTransfer(transferIndex);
      }
    }

    const appendValueChunks = (): void => {
      for (const vco of this.valueChunkOutputs) {
        const chunkOutput = { ...vco };
        chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
        builder.addOutput(chunkOutput);
      }
      for (const { id, lockingBytecode } of this.getValueChunkVars()) {
        for (const commitment of this.valueChunkRawCommitments.get(id) ?? []) {
          const chunkOutput = {
            to: lockingBytecode, amount: 1200n,
            token: { amount: 0n, category: this.categoryId,
              nft: { capability: 'mutable' as const, commitment } },
          };
          chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
          builder.addOutput(chunkOutput);
        }
      }
    };
    if (this.delegateEntriesAfterLowLevel) appendValueChunks();

    const appendDynamicChunks = (): void => {
      if (this.delegateDynamicChunksAtSuffix) {
        const recovered = [...this.derivedChunkOutputs.entries()]
          .filter(([, chunk]) => (chunk.categoryId ?? this.categoryId) === this.categoryId)
          .sort(([left], [right]) => left - right);
        if (recovered.length > 0) {
          for (const [, chunk] of recovered) {
            const chunkOutput = {
              to: chunk.lockingBytecode,
              amount: 1200n,
              token: {
                amount: 0n,
                category: chunk.categoryId ?? this.categoryId,
                nft: { capability: 'mutable' as const, commitment: chunk.commitment },
              },
            };
            chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
            builder.addOutput(chunkOutput);
          }
          return;
        }
      }
      for (const dv of this.dynamicChunkVars) {
        const commitments = this.chunkRawCommitments.get(dv.name) ?? [];
        const debugChunkLayout = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_CHUNK_LAYOUT === '1';
        const computedBase = this.getChunkOutputBase();
        if (debugChunkLayout && commitments.length > 0 && builder.outputs.length !== computedBase) {
          console.error('dynamic-chunk-layout-mismatch', {
            name: dv.name, outputBase: builder.outputs.length, computedBase, count: commitments.length,
          });
        }
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1' && commitments.length > 0) {
          console.error('append-dynamic-chunks', {
            name: dv.name,
            lockingBytecode: binToHex(dv.lockingBytecode),
            outputBase: builder.outputs.length,
            computedBase,
            baseParts: {
              layoutTrailingBase: this.blockLayout?.trailingBase,
              layoutBlockSize: this.blockLayout?.blockSize,
              externalCallOutputs: this.externalCallUtxoGroups.map((group) => ({
                shared: group.sharedGroupIndex,
                blockInputs: group.blockInputs?.length,
                fallback: 1 + group.dataNftUtxos.length,
              })),
              externalReturns: this.tailReturnEventOutputs()
                .filter((returnEvent) => returnEvent.categoryId !== this.categoryId).length,
              lowLevelGroups: this.lowLevelCallUtxoGroups.map((group) => 1 + group.dataNftUtxos.length),
              lowLevelRaw: this.lowLevelCallRawInputs.length,
              iterationEntries: this.iterationEntryInputs.length,
              loopEntries: this._loopEntryOutputCount(),
              valueChunks: this._valueChunkOutputCount(),
              pendingOutputs: this.pendingOutputs.length,
              identityAnchors: this.externalIdentityAnchorUtxos.length + (this.logicalIdentityUtxo ? 1 : 0),
            },
            count: commitments.length,
          });
        }
        for (const commitment of commitments) {
          const chunkOutput = {
            to: dv.lockingBytecode,
            amount: 1200n,
            token: {
              amount: 0n,
              category: this.categoryId,
              nft: { capability: 'mutable' as const, commitment },
            },
          };
          chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
          builder.addOutput(chunkOutput);
        }
      }
    };
    if (!this.delegateEntriesAfterLowLevel && !this.delegateDynamicChunksAtSuffix) appendDynamicChunks();

    // Loop mapping-write entry outputs (trailing, after any chunks). One new mutable entry NFT per loop iteration;
    // commitments (key_enc||value_enc) come from auto-derivation (the covenant builds them on-chain per iteration).
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_FAILURE_RING === '1') {
      console.error('builder-loop-entry-vars', this.loopEntryVars.map((value) => ({
        collection: value.collection,
        categoryId: value.categoryId,
        delegate: value.delegate,
        commitments: this.loopEntryCommitments.get(value.collection),
      })));
    }
    for (const lv of (this.loopEntriesBeforeDynamicChunks || this.delegateEntriesAfterLowLevel
      ? [] : this._trailingLoopEntryVars())) {
      const commitments = this.loopEntryCommitments.get(lv.collection) ?? [];
      for (const commitment of commitments) {
        const entryOutput = {
          to: lv.lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: lv.categoryId ?? this.categoryId,
            nft: { capability: 'mutable' as const, commitment },
          },
        };
        entryOutput.amount = this._loopEntryTransitionSatoshis(lv, commitment)
          ?? BigInt(Math.max(1200, calculateDust(entryOutput)));
        builder.addOutput(entryOutput);
      }
    }
    debugOwnMutableOutputs('after-loop-entries');

    // P5b value chunks (Design D), placed AFTER every covenant-managed output (entries, dynamic chunks, loop-entry
    // NEW nodes). DIRECT values are injected exactly
    // (valueChunkOutputs); COMPUTED values are trace-derived (valueChunkVars, commitments filled by auto-derivation).
    if (!this.delegateEntriesAfterLowLevel) appendValueChunks();

    const trailingCapacity = this.blockLayout?.trailingCapacity ?? 0;
    if (trailingCapacity > 0) {
      const trailingOutputCounts = {
        iterationEntries: this.iterationEntryInputs.length,
        dynamicChunks: this._dynamicChunkOutputCount(),
        loopEntries: this._trailingLoopEntryOutputCount(),
        runtimeLoopEvents: this.runtimeLoopEventOutputs.length,
        runtimeLoopTransfers: this.runtimeLoopTransferOutputs.length,
        literalValueChunks: this.valueChunkOutputs.length,
        derivedValueChunks: [...this.getValueChunkVars()].reduce(
          (sum, value) => sum + (this.valueChunkRawCommitments.get(value.id) ?? []).length,
          0,
        ),
      };
      const trailingOutputCount = Object.values(trailingOutputCounts).reduce((sum, count) => sum + count, 0);
      if (trailingOutputCount > trailingCapacity) {
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_TRAILING_CAPACITY === '1') {
          console.error('balanced-trailing-capacity', JSON.stringify({
            capacity: trailingCapacity,
            counts: trailingOutputCounts,
            loopEntries: this.loopEntryVars.map((value) => ({
              collection: value.collection,
              delegate: value.delegate,
              commitments: this.loopEntryCommitments.get(value.collection)?.length ?? 0,
            })),
            valueChunks: [...this.getValueChunkVars()].map((value) => ({
              id: value.id,
              collection: value.collection,
              commitments: (this.valueChunkRawCommitments.get(value.id) ?? []).map((commitment) => ({
                bytes: commitment.length / 2,
                head: commitment.slice(0, 20),
              })),
            })),
          }));
        }
        throw new Error(
          'Runtime resource outputs exceed balanced trailing capacity '
          + `(${trailingOutputCount} > ${trailingCapacity})`,
        );
      }
      for (let i = trailingOutputCount; i < trailingCapacity; i++) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
      }
    }
    debugAtomicOutputStage('balanced-trailing-frame');

    if (this.compilerRouteDelegateBlock) {
      this.lowLevelCallUtxoGroups.forEach((group, groupIndex) => {
        if (group.callMode === 'delegatecall' && !associatedDelegateOutputs.has(groupIndex)) {
          appendDelegateGroupOutputs(groupIndex);
        }
      });
    }
    debugAtomicOutputStage('compiler-delegate-executor');

    // Append any extra outputs buffered via addOutput()
    for (const output of this.pendingOutputs) {
      builder.addOutput(output);
    }
    debugOwnMutableOutputs('after-pending-outputs');
    // A callee's identity anchor is permissionless to spend, so consuming it without recreating it would destroy
    // that contract's logical identity. Recreate each one verbatim, mirroring the input ordering.
    for (const anchor of this.externalIdentityAnchorUtxos) {
      builder.addOutput({
        to: anchor.unlocker.generateLockingBytecode(),
        amount: anchor.satoshis,
        token: anchor.token,
      });
    }
    // Nested callee mapping INSERTs (MarketplaceData publishJobEvent) are not the
    // implementation's own delegated loop and must not sit in the impl trailing
    // band. Emit them after callee identity so the callee proxy's mutable-NFT
    // conservation sees P'/NEW (input EntryNft otherwise has no matching output).
    for (const lv of this.loopEntryVars) {
      if (lv.delegate === true) continue;
      if (lv.categoryId === undefined || lv.categoryId === this.categoryId) continue;
      for (const commitment of this.loopEntryCommitments.get(lv.collection) ?? []) {
        const entryOutput = {
          to: lv.lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: lv.categoryId,
            nft: { capability: 'mutable' as const, commitment },
          },
        };
        entryOutput.amount = this._loopEntryTransitionSatoshis(lv, commitment)
          ?? BigInt(Math.max(1200, calculateDust(entryOutput)));
        builder.addOutput(entryOutput);
      }
    }
    // A compiler route can settle a nested delegate's runtime mapping loop alongside the root's own dynamic
    // storage. Its covenant addresses NEW after callee identity preservation but before the caller's own logical
    // identity anchor. The distinct token category is the ownership boundary that keeps these outputs out of the
    // root's reserved trailing capacity.
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_CHUNK_SCAN === '1'
      && this._delegateLoopEntryVars().length > 0) {
      console.error('append-delegate-loop-entries', {
        physicalBase: builder.outputs.length,
        computedBase: this.getLoopEntryOutputBase(),
        outputCountBefore: builder.outputs.length,
        pendingOutputs: this.pendingOutputs.length,
        externalIdentityAnchors: this.externalIdentityAnchorUtxos.length,
        logicalIdentityAnchor: !!this.logicalIdentityUtxo,
        chunkBase: this.getChunkOutputBase(),
        trailingCapacity: this.blockLayout?.trailingCapacity,
      });
    }
    if (this.logicalIdentityUtxo) {
      builder.addOutput({
        to: this.logicalIdentityUtxo.unlocker.generateLockingBytecode(),
        amount: this.logicalIdentityUtxo.satoshis,
        token: this.logicalIdentityUtxo.token,
      });
    }
    debugAtomicOutputStage('identity-anchors');

    // Nested callee entry NFTs can sit outside that callee's published block (MarketplaceData
    // publishJobEvent predecessor at input 20 while the MD group occupies 14-17). Recreate any
    // still-unmatched nested-category mutable input at its input index so the callee proxy's
    // mutable-NFT conservation and the entry covenant both see a same-index twin.
    const nestedCategories = new Set(
      this.externalCallUtxoGroups.map((group) => group.categoryId).filter((id): id is string => !!id),
    );
    for (let index = 0; index < this.allInputs.length; index++) {
      const input = this.allInputs[index];
      const category = input.token?.category;
      if (!category || input.token?.nft?.capability !== 'mutable' || !nestedCategories.has(category)) continue;
      const existing = builder.outputs[index];
      if (!('unlocker' in input) || !input.unlocker) continue;
      if (existing?.token?.category === category && existing.token.nft?.capability === 'mutable') {
        // Only replace an unfilled 128-byte empty-value placeholder. H(0) is
        // sha256(''), so a real UPDATE of key 0 also starts with e3b0c442.
        const outHex = existing.token.nft?.commitment ?? '';
        if (!isEmptyValueEntryCommitment(outHex)) continue;
        builder.outputs[index] = {
          to: input.unlocker.generateLockingBytecode(),
          amount: input.satoshis,
          token: cloneToken(input.token),
        };
        continue;
      }
      const existingLock = existing
        ? (existing.to instanceof Uint8Array ? existing.to : addressToLockScript(existing.to))
        : undefined;
      // A return-event witness is OP_TRUE + none-cap. Splicing a mutable twin here
      // leaves the covenant's witnessed index on the clone (amount/capability fail).
      if (existingLock?.length === 1 && existingLock[0] === 0x51) continue;
      builder.outputs.splice(index, 0, {
        to: input.unlocker.generateLockingBytecode(),
        amount: input.satoshis,
        token: cloneToken(input.token),
      });
    }
    debugAtomicOutputStage('nested-mutable-recreation');

    // Nested publishJobEvent emits at implInput+event.offset (delegate output-only
    // slots are implementation-relative). Identity anchors that landed on that
    // coordinate are re-appended after the event so the event pin keeps its index.
    const displacedDelegateIdentities: Array<{
      to: Uint8Array; amount: bigint; token: NonNullable<Output['token']>;
    }> = [];
    for (const [llcIndex, llc] of this.lowLevelCallUtxoGroups.entries()) {
      // Compiler-owned delegate routes materialize every declared event and entry inside their balanced frame.
      // The legacy nested-delegate repair below is only for layouts without that physical ownership boundary.
      if (this.compilerRouteDelegateBlock) continue;
      if (llc.callMode !== 'delegatecall') continue;
      const implIndex = this.getLowLevelCallMasterInputIndex(llcIndex);
      if (implIndex < 0) continue;
      const proxyGroup = this.externalCallUtxoGroups.find(
        (group) => group.delegateCallGroupIndex === llcIndex,
      );
      const fn = llc.compilerRoute?.abiFunction
        ?? proxyGroup?.compilerRoute?.abiFunction
        ?? llc.externalContract?.inner.artifact.abi.find((candidate: AbiFunction) => candidate.name === llc.functionName)
        ?? proxyGroup?.externalContract?.inner.artifact.abi.find(
          (candidate: AbiFunction) => candidate.name === (llc.functionName ?? proxyGroup.functionName),
        );
      const eventSlots = (fn?.blockLayout?.slots ?? []).filter((slot: { kind: string; offset: number }) => slot.kind === 'event');
      if (eventSlots.length === 0 || (fn?.emits?.length ?? 0) === 0) continue;
      // initialize (and other full-block delegates) already emit events inside the
      // proxy group's block walk. Only fill slots the walk never visits — e.g.
      // publishJobEvent's event at impl+4 while the MD proxy occupies 3 slots.
      const walkedWidth = proxyGroup?.blockInputs?.length
        ?? (1 + (proxyGroup?.requiredDataNftIndices.length ?? 0));
      const emits = fn?.emits ?? [];
      // Emits are authenticated by the proxy/CREATE category, not the
      // implementation minting UTXO (dest 16 lock pin: aa20ef32 vs impl aa20599f).
      const proxyMinting = this.allInputs.find((input) =>
        input.token?.nft?.capability === 'minting'
        && !!input.token.category
        && input.token.category !== llc.categoryId);
      const categoryId = proxyGroup?.categoryId
        ?? this.externalCallUtxoGroups.find((group) =>
          (group.functionName === llc.functionName || group.logicalFunctionName === llc.functionName)
          && !!group.categoryId)?.categoryId
        ?? proxyMinting?.token?.category
        ?? llc.categoryId;
      if (!categoryId) continue;
      const addressType = proxyGroup?.externalContract?.inner?.addressType
        ?? llc.externalContract?.inner?.addressType ?? 'p2sh32';
      for (let eventIndex = 0; eventIndex < eventSlots.length; eventIndex++) {
        const namedImpl = this._chunkableValueWriteInputIndex();
        const outputIndex = namedImpl >= 0
          ? publishJobEventOutputIndex(namedImpl, eventSlots[eventIndex].offset)
          : implIndex + eventSlots[eventIndex].offset;
        const occupant = builder.outputs[outputIndex];
        const occupantNeedsEvent = isOverwritableEmitOccupant(occupant)
          || String(occupant?.token?.nft?.commitment ?? '').startsWith('53434944');
        // Full-block walks already own in-range slots that hold a real emit.
        // SCID / pad occupants still need dest fill (Initialized dest 16).
        if (namedImpl < 0 && eventSlots[eventIndex].offset < walkedWidth && !occupantNeedsEvent) {
          continue;
        }
        const derived = proxyGroup?.eventOutputs?.[eventIndex];
        const emitInfo = emits[eventIndex];
        const lockingBytecode = derived?.lockingBytecode
          ?? (emitInfo
            ? scriptToLockingBytecode(
              buildEventNftCovenantScript(
                hexToBin(categoryId), computeEventNameHash(emitInfo.eventSignature),
              ),
              addressType,
            )
            : undefined);
        if (!lockingBytecode) continue;
        const existing = builder.outputs[outputIndex];
        if (existing?.token?.nft?.capability === 'minting') continue;
        const persistEmit = this._shouldRematerializePersistUpdate();
        if (existing?.token?.nft?.capability === 'mutable'
          && (existing.token.nft.commitment?.length ?? 0) > 2
          && !isOverwritableEmitOccupant(existing, { consumedMutableOk: persistEmit })) {
          continue;
        }
        const visibleArgs = proxyGroup?.logicalFunctionArgs ?? proxyGroup?.functionArgs
          ?? llc.logicalFunctionArgs ?? llc.functionArgs;
        const now = BigInt((this.builderOptions.provider as { getBlockTime?: () => number })
          .getBlockTime?.() ?? 0);
        const eventType = visibleArgs && visibleArgs.length >= 2
          ? jobEventTypeOf(visibleArgs[1]) : undefined;
        const emptyAddressEvent = eventType !== undefined
          && (Array.isArray(visibleArgs![1])
            ? jobEventFieldEmpty(visibleArgs![1][1])
            : jobEventFieldEmpty((visibleArgs![1] as { address_?: unknown }).address_));
        const stampWithdraw = emptyAddressEvent && eventType === 16 && now > 0n;
        const emitEvent = stampWithdraw
          ? stampEmptyJobEventTimestamp(visibleArgs![1], now)
          : visibleArgs?.[1];
        const constructedCommit = emptyAddressEvent && emitEvent !== undefined
          ? encodeJobEventEmitCommitment(
            visibleArgs![0],
            emitEvent,
            (proxyGroup ?? llc).externalContract?.inner?.artifact?.structs,
          )
          : undefined;
        const learnedCommit = String(derived?.commitment ?? '');
        // Initialized(uint64) is OP_1 (`51`); JobEvent classifiers reject it.
        const typedCommit = emitInfo?.eventName === 'Initialized'
          || emitInfo?.eventSignature?.startsWith('Initialized(')
          ? '51'
          : '';
        const derivedCommit = constructedCommit
          ?? (isLearnedEventEmitCommitment(learnedCommit) ? learnedCommit : typedCommit);
        if (!isJobEventEmitCommitment(derivedCommit)) {
          placePublishJobEventOutput(builder.outputs, outputIndex, {
            to: lockingBytecode,
            amount: 1200n,
            token: {
              amount: 0n,
              category: categoryId,
              nft: { capability: 'none', commitment: derivedCommit },
            },
          }, {
            refuseEmpty: persistEmit && !constructedCommit,
            consumedMutableOk: persistEmit,
            destInput: this.allInputs[outputIndex],
          });
          continue;
        }
        if (shouldDisplaceForNestedEvent(existing, categoryId) && existing?.token) {
          // Nested events share the callee category with view-return tails and SCID-v1
          // identity anchors. Overwriting either destroys the witness the caller PICKs.
          displacedDelegateIdentities.push({
            to: existing.to instanceof Uint8Array ? existing.to : addressToLockScript(existing.to),
            amount: existing.amount,
            token: existing.token,
          });
        }
        while (builder.outputs.length < outputIndex) {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
        }
        const placed = {
          to: lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: categoryId,
            nft: { capability: 'none' as const, commitment: derivedCommit },
          },
        };
        placed.amount = BigInt(Math.max(1200, calculateDust(placed)));
        placePublishJobEventOutput(builder.outputs, outputIndex, placed, {
          consumedMutableOk: persistEmit,
          destInput: this.allInputs[outputIndex],
        });
      }

      const entrySlots = (fn?.blockLayout?.slots ?? []).filter(
        (slot: { kind: string; offset: number }) => slot.kind === 'entry',
      );
      for (const slot of entrySlots) {
        if (slot.offset < walkedWidth) continue;
        const outputIndex = implIndex + slot.offset;
        const commitment = this.getExternalCallEntryOutput(categoryId, slot.offset);
        if (!commitment) continue;
        const existing = builder.outputs[outputIndex];
        if (existing?.token?.nft?.capability === 'minting') continue;
        const occupant = this.allInputs[outputIndex];
        const lockingBytecode = occupant && 'unlocker' in occupant && occupant.unlocker
          ? occupant.unlocker.generateLockingBytecode()
          : existing?.to instanceof Uint8Array
            ? existing.to
            : undefined;
        if (!lockingBytecode) continue;
        while (builder.outputs.length < outputIndex) {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
        }
        const placed = {
          to: lockingBytecode,
          amount: occupant?.satoshis ?? 1200n,
          token: {
            amount: 0n,
            category: categoryId,
            nft: { capability: 'mutable' as const, commitment },
          },
        };
        placed.amount = BigInt(Math.max(Number(placed.amount), calculateDust(placed)));
        if (builder.outputs.length === outputIndex) builder.addOutput(placed);
        else builder.outputs[outputIndex] = placed;
      }
    }
    debugAtomicOutputStage('delegate-events-and-entries');

    // Nested publishJobEvent pins value chunks at the covenant's trailing base
    // (proxy/master + blockSize), which is below impl+blockSize when the
    // implementation sits after the proxy block. Materialize every recovered
    // pin; extractRouteChunkPin already rejected non-chunk OUTPUTBYTECODE checks.
    for (const [llcIndex, llc] of this.lowLevelCallUtxoGroups.entries()) {
      // The balanced compiler route owns its trailing dynamic-resource frame. Replaying the legacy absolute
      // delegate placement would duplicate those chunks beyond the route block.
      if (this.compilerRouteDelegateBlock) continue;
      if (llc.callMode !== 'delegatecall') continue;
      const implIndex = this.getLowLevelCallMasterInputIndex(llcIndex);
      if (implIndex < 0) continue;
      const proxyGroupIndex = this.externalCallUtxoGroups.findIndex(
        (group) => group.delegateCallGroupIndex === llcIndex,
      );
      const masterIndex = proxyGroupIndex >= 0
        ? this.getExternalCallMasterInputIndex(proxyGroupIndex)
        : implIndex;
      const fn = llc.compilerRoute?.abiFunction
        ?? llc.externalContract?.inner.artifact.abi.find((candidate: AbiFunction) => candidate.name === llc.functionName);
      const blockSize = fn?.blockLayout?.blockSize ?? 1;
      // Executing impl verifies chunks at INPUTINDEX+trailingBase (15+5=20).
      // min(impl, proxy)+blockSize is 17 and overwrites meceTags.
      const chunkBase = this.getPublishJobEventsBand()?.start
        ?? Math.max(implIndex + blockSize, masterIndex + blockSize);
      const derivedIndexes = [...this.derivedChunkOutputs.keys()]
        .filter((outputIndex) => {
          if (outputIndex < Math.min(chunkBase, masterIndex + 1)) return false;
          const chunk = this.derivedChunkOutputs.get(outputIndex);
          return !this.delegateDynamicChunksAtSuffix
            || (chunk?.categoryId ?? this.categoryId) !== this.categoryId;
        })
        .sort((left, right) => left - right);

      for (const outputIndex of derivedIndexes) {
        const chunk = this.derivedChunkOutputs.get(outputIndex);
        if (!chunk) continue;
        const existing = builder.outputs[outputIndex];
        const existingLock = existing?.to instanceof Uint8Array
          ? existing.to
          : existing?.to !== undefined ? addressToLockScript(existing.to) : undefined;
        const existingIsChunkAddress = !!existingLock
          && existingLock.length === 35
          && existingLock[0] === 0xaa && existingLock[1] === 0x20
          && existingLock[34] === 0x87;
        if (existing?.token?.nft?.capability === 'minting'
          && (!existingIsChunkAddress || binToHex(existingLock!) === binToHex(chunk.lockingBytecode))) {
          continue;
        }
        const chunkCategory = chunk.categoryId ?? this.categoryId;
        // Trailing slots at impl+blockSize are this write's value chunks. A long UPDATE
        // changes sha256(value) and therefore the chunk P2SH32; the previous digest's
        // chunks must be replaced rather than preserved as same-category mutables.
        while (builder.outputs.length < outputIndex) {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
        }
        const placed = {
          to: chunk.lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: chunk.categoryId ?? this.categoryId,
            nft: { capability: 'mutable' as const, commitment: chunk.commitment },
          },
        };
        placed.amount = BigInt(Math.max(1200, calculateDust(placed)));
        if (builder.outputs.length === outputIndex) builder.addOutput(placed);
        else builder.outputs[outputIndex] = placed;
      }
    }
    debugAtomicOutputStage('delegate-derived-chunk-placement');
    this._applyDerivedValueChunks(builder);
    debugAtomicOutputStage('derived-value-chunk-placement');
    for (const identity of displacedDelegateIdentities) {
      builder.addOutput(identity);
    }
    debugAtomicOutputStage('displaced-delegate-identities');
    for (let index = 0; index < Math.min(this.allInputs.length, builder.outputs.length); index++) {
      const input = this.allInputs[index];
      const output = builder.outputs[index];
      if (!input?.token?.category || !nestedCategories.has(input.token.category)) continue;
      if (input.token.nft?.capability !== 'mutable' || output?.token?.nft?.capability !== 'mutable') continue;
      if (output.token?.category !== input.token.category) continue;
      const outHex = output.token.nft?.commitment ?? '';
      if (!isEmptyValueEntryCommitment(outHex)) continue;
      if (!('unlocker' in input) || !input.unlocker) continue;
      builder.outputs[index] = {
        to: input.unlocker.generateLockingBytecode(),
        amount: input.satoshis,
        token: cloneToken(input.token),
      };
    }

    const commitmentBytes = (commitment: string | Uint8Array | undefined): Uint8Array => {
      if (!commitment) return new Uint8Array();
      return typeof commitment === 'string' ? hexToBin(commitment) : commitment;
    };
    const isEmptyPubkeyDefault = (bytes: Uint8Array): boolean => bytes.length === 35
      && bytes[1] === 0x21 && bytes.slice(2).every((byte) => byte === 0);
    // Rebuild of an immutable-only data NFT is not an identity. Restore the
    // co-spent input commitment so the callee's UTXO==OUTPUT pin succeeds.
    for (const group of this.externalCallUtxoGroups) {
      if (!group.categoryId || !group.stateLayout) continue;
      for (const nftIdx of group.requiredDataNftIndices) {
        const nftVars = group.stateLayout.variables.filter((variable) => variable.nftIndex === nftIdx);
        const taggedImmutable = nftVars.length > 0 && nftVars.every((variable) => variable.immutable);
        const tag = encodeNftIndexTag(nftIdx);
        const source = this.allInputs.find((input) => {
          if (input.token?.category !== group.categoryId || input.token.nft?.capability !== 'mutable') return false;
          const bytes = commitmentBytes(input.token.nft?.commitment);
          return bytes.length >= tag.length && tag.every((byte, at) => bytes[at] === byte);
        });
        if (!source?.token) continue;
        const sourceBytes = commitmentBytes(source.token.nft?.commitment);
        for (const output of builder.outputs) {
          if (output.token?.category !== group.categoryId || output.token.nft?.capability !== 'mutable') continue;
          const outBytes = commitmentBytes(output.token.nft?.commitment);
          if (outBytes.length < tag.length || !tag.every((byte, at) => outBytes[at] === byte)) continue;
          if (outBytes.length === sourceBytes.length && binToHex(outBytes) === binToHex(sourceBytes)) continue;
          const emptyPubkeyDefault = outBytes.length === 35 && outBytes[1] === 0x21
            && outBytes.slice(2).every((byte) => byte === 0);
          if (!taggedImmutable && !emptyPubkeyDefault) continue;
          output.token = cloneToken(source.token);
        }
      }
    }
    for (let index = 0; index < Math.min(this.allInputs.length, builder.outputs.length); index++) {
      const input = this.allInputs[index];
      const output = builder.outputs[index];
      const category = input.token?.category;
      if (!category || !nestedCategories.has(category)) continue;
      if (input.token?.nft?.capability !== 'mutable' || output.token?.nft?.capability !== 'mutable') continue;
      if (output.token?.category !== category) continue;
      const inBytes = commitmentBytes(input.token.nft?.commitment);
      const outBytes = commitmentBytes(output.token.nft?.commitment);
      const emptyPubkeyDefault = outBytes.length === 35 && outBytes[1] === 0x21
        && outBytes.slice(2).every((byte) => byte === 0);
      if (emptyPubkeyDefault && inBytes.length > outBytes.length) {
        output.token = cloneToken(input.token);
      }
    }
    debugAtomicOutputStage('nested-state-restoration');

    if (this.delegateEntriesAfterLowLevel || this.delegateDynamicChunksAtSuffix) appendDynamicChunks();
    debugAtomicOutputStage('deferred-dynamic-chunks');

    for (const vco of this.lateValueChunkOutputs) {
      const chunkOutput = { ...vco };
      chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
      builder.addOutput(chunkOutput);
    }

    // Reverse-suffix chunk indexing requires exactly ONE output after the late chunk region in every build,
    // including covenant-only probes and direct build() calls. A sidecar must be last for its self-preservation
    // covenant; otherwise use a zero-value OP_RETURN anchor. send() inserts any fee change BEFORE this suffix.
    const hasAuthenticatedChunkSuffix = this.lateValueChunkOutputs.length > 0
      || (this.delegateDynamicChunksAtSuffix && this._dynamicChunkOutputCount() > 0);
    if (hasAuthenticatedChunkSuffix) {
      if (this.sidecarUtxo) {
        builder.addOutput({
          to: this.sidecarUtxo.unlocker.generateLockingBytecode(),
          amount: this.sidecarUtxo.satoshis,
        });
      } else {
        builder.addOutput({ to: new Uint8Array([0x6a]), amount: 0n }); // OP_RETURN suffix anchor
      }
    }
    if (this.mintingOutputSwap) {
      this._fillSwappedTokenEntryHoles(builder);
    }
    // Absolute continuation-output witnesses are already bound at this point. Keep the remaining layout
    // append-only: deleting an earlier alignment cell would shift every later fixed-index value-chunk run into
    // the authenticated suffix. A harmless balanced pad is preferable to invalidating those coordinates.
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_CHUNK_SCAN === '1'
      && this.dynamicChunkVars.length > 0) {
      console.error('authenticated-chunk-suffix', {
        delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
        dynamicCount: this._dynamicChunkOutputCount(),
        lateCount: this.lateValueChunkOutputs.length,
        hasAuthenticatedChunkSuffix,
        outputCount: builder.outputs.length,
      });
    }
    // The final unused funder input of a bounded balanced layout remains after
    // the owner block; the outer transaction builder pairs it with change.

    // Last write: recovered chunk pins beat every later same-index recreation of the
    // previous digest (nested mutable mirror, empty-entry restore, dynamic suffix).
    this._applyDerivedValueChunks(builder);
    if (this.mintingOutputSwap) this._fillSwappedTokenEntryHoles(builder);
    this._applyDerivedEntryOutputs(builder);
    this._constrainParticipantImmutableOutputs(builder);
    this._restoreSwappedTokenFunderSlots(builder);
    debugAtomicOutputStage('derived-output-repairs');
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_CHUNK_SCAN === '1' && this.externalCallEntryOutputsByIndex.size > 0) {
      console.error('derived-entry-outputs', [...this.externalCallEntryOutputsByIndex.entries()].map(
        ([index, placed]) => ({
          index,
          placed: placed.commitment.slice(0, 24),
          actual: String(builder.outputs[index]?.token?.nft?.commitment ?? '').slice(0, 24),
          cat: builder.outputs[index]?.token?.category?.slice(0, 8),
        }),
      ));
    }
    if (this.mintingOutputSwap && (globalThis as { process?: { env?: Record<string, string> } }).process
      ?.env?.SOLIDC_DEBUG_CHUNK_SCAN === '1') {
      console.error('swap-output-count', {
        swap: this.mintingOutputSwap,
        outputs: builder.outputs.length,
        inputs: this.allInputs.length,
        tail: builder.outputs.slice(28).map((output, offset) => ({
          i: 28 + offset,
          cat: output.token?.category?.slice(0, 8)
            ?? (output.to instanceof Uint8Array ? binToHex(output.to).slice(0, 8) : 'addr'),
          cap: output.token?.nft?.capability ?? '-',
        })),
      });
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_CHUNK_SCAN === '1') {
      const dumpIndex = (index: number): Record<string, unknown> => {
        const output = builder.outputs[index];
        const lock = output?.to instanceof Uint8Array
          ? output.to
          : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
        return {
          index,
          lock: lock ? binToHex(lock).slice(0, 16) : undefined,
          cap: output?.token?.nft?.capability,
          commit: String(output?.token?.nft?.commitment ?? '').slice(0, 16),
          derived: this.derivedChunkOutputs.has(index)
            ? binToHex(this.derivedChunkOutputs.get(index)!.lockingBytecode).slice(0, 16)
            : undefined,
        };
      };
      console.error('derived-chunk-final', {
        pins: [...this.derivedChunkOutputs.entries()].map(([index, chunk]) => ({
          index, lock: binToHex(chunk.lockingBytecode).slice(0, 16), commit: chunk.commitment.slice(0, 16),
        })),
        outputs: [18, 19, 20, 21, 22, 23].map(dumpIndex),
      });
    }

    // Output materialization is authoritative: shared/compiler-routed groups can expand into balanced blocks
    // whose physical width is not known from their logical call record. Resolve each delegate's preservation
    // coordinate now; the input unlocker closures above read these references when the final transaction encodes.
    for (const [groupIndex, outputBaseRef] of relocatedDelegateOutputBases) {
      const group = this.lowLevelCallUtxoGroups[groupIndex];
      const master = group?.masterUtxo as UnlockableUtxo | undefined;
      if (!group || !master) continue;
      const masterLock = binToHex(master.unlocker.generateLockingBytecode());
      const masterCommitment = master.token?.nft?.commitment ?? '';
      const resolved = builder.outputs.findIndex((output) => (
        output.to instanceof Uint8Array && binToHex(output.to) === masterLock
        && output.amount === master.satoshis
        && output.token?.category === master.token?.category
        && (output.token?.nft?.commitment ?? '') === masterCommitment
      ));
      if (resolved >= 0) outputBaseRef.value = resolved;
    }

    this._tagEmptyP2sh32ImmutablesAsScid(builder);
    this._ensureOpTrueReturnWitnessesAreImmutable(builder);
    this._reassertDelegateLoopEntries(builder);
    this._reassertNestedMintingMasters(builder);
    this._stripSurplusEmptyCollectionEntries(builder);
    this._reassertNestedSameIndexMutables(builder);
    this._reassertFixedStateOutputs(builder);
    this._reassertNestedEmitEvents(builder);
    this._reassertDelegateImplEvents(builder);
    this._reassertMintingOneToOne(builder);
    this._reassertTokenInsertNewLocks(builder);
    reassertScidIdentityOutputs(
      builder.outputs, this.allInputs, this._scidReservedIndices(builder.outputs.length),
    );
    this._reassertNestedEmitEvents(builder);
    this._reassertDelegateImplEvents(builder);
    if (isPersistedJobEventsReady()) this._packJobsSuffix(builder);
    debugAtomicOutputStage('conservation-repairs');
    const chunkBand = this.getPublishJobEventsBand();
    const publishCategory = this._jobEventsPublishCategory();
    const chunkLock = this.jobEventsRedeemLock
      ?? (publishCategory ? persistedJobEventsLock(publishCategory) : undefined);
    if (chunkBand && chunkLock) {
      stripSurplusValueChunkLocks(builder.outputs, chunkBand, chunkLock, this.allInputs);
    }
    // Rebind before placing tails so planned 20-21 still names the jobEvents pins.
    if (!this.viewTailRepackAttempted && this._repackViewTailsAfterMaterialization(builder)) {
      this.viewTailRepackAttempted = true;
      this._refreshInputs();
      return this.build();
    }
    // After compact/SCID/derived writers: re-assert view tails at assigned indices so
    // a dropped pad cannot slide meceTags onto arbitratorRegistered (ip 565637).
    this._placeTailReturnAfterSwappedTokenBlock(builder, returnOutputRefs);
    this._materializeJobEventsBand(builder);
    this._reassertScaledPreserveOneToOnes(builder);
    this._reassertNestedEmitEvents(builder);
    this._reassertDelegateImplEvents(builder);
    if (isPersistedJobEventsReady()) {
      this._reassertPersistedJobEventsOneToOnes(
        builder, this._scaledEmitOutputIndex(builder.outputs.length) ?? -1,
      );
    }
    this._reassertMintingOneToOne(builder);
    this._reassertFixedStateOutputs(builder);
    this._relocateCollidingDerivedValueChunkRuns(builder);
    for (const [identity, output] of returnOutputRefs) {
      const index = builder.outputs.indexOf(output);
      if (index >= 0) this.builtReturnEventOutputIndices.set(identity, index);
    }
    // Dynamic bands can relocate participant inputs and return outputs during
    // derivation, before send() reaches its final fixed-point pass. Rebind the
    // materialized coordinates now so the next VM probe never mixes the new
    // layout with witnesses from the preceding build.
    this._reconcileMaterializedInputWitnesses(builder);
    this._reconcileMaterializedPredOutWitnesses(builder);
    this._reconcileMaterializedReturnWitnesses(builder);
    debugAtomicOutputStage('final');
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1' && (this.blockLayout?.blockSize ?? 0) > 100) {
      console.error('atomic-stateful-output-components', {
        blockSize: this.blockLayout?.blockSize,
        outputCount: builder.outputs.length,
        inputCount: this.allInputs.length,
        entries: this.entryNfts.length,
        entryDeletes: this.entryDeletes.size,
        events: this.blockLayout?.slots.filter((slot) => slot.kind === 'event').length ?? 0,
        trailingCapacity: this.blockLayout?.trailingCapacity ?? 0,
        pendingOutputs: this.pendingOutputs.length,
        externalIdentityAnchors: this.externalIdentityAnchorUtxos.length,
        logicalIdentityAnchor: this.logicalIdentityUtxo !== undefined,
        externalGroups: this.externalCallUtxoGroups.length,
        lowLevelGroups: this.lowLevelCallUtxoGroups.length,
        funders: this.funderUtxos.length,
        dynamicChunks: this._dynamicChunkOutputCount(),
        valueChunks: this.valueChunkOutputs.length,
        lateValueChunks: this.lateValueChunkOutputs.length,
        delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
        compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
        delegateEntriesAfterLowLevel: this.delegateEntriesAfterLowLevel,
      });
    }
    return builder;
  }

  /**
   * JobEvents occupancy is only final after the first materialization. If planned
   * view-tail witnesses still name a mutable collection slot, pack them after that
   * band and refresh unlockers for one rematerialize. Does not move jobs suffix.
   */
  private _repackViewTailsAfterMaterialization(builder: TransactionBuilder): boolean {
    const planned = this.externalCallUtxoGroups
      .map((group, index) => (
        group.returnOutputIndex !== undefined
          && !groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, index)
          ? group.returnOutputIndex : -1
      ))
      .filter((index) => index >= 0);
    const tokenWriterPresent = this.externalCallUtxoGroups.some((group) => {
      const name = group.functionName ?? group.compilerRoute?.abiFunction.name;
      if (!isMintingBandTokenWriter(name)) return false;
      return this.findMintingInputIndex(group.categoryId) >= 0;
    });
    // FakeToken already parks view tails after its swapped block. Do not steal
    // early pads or rewrite those witnesses.
    if (tokenWriterPresent) return false;
    const derivedHit = planned.some((index) => this.derivedChunkOutputs.has(index));
    const derivedEnd = derivedHit
      ? [...this.derivedChunkOutputs.keys()].reduce((max, index) => Math.max(max, index), -1)
      : -1;
    const writerEnd = Math.max(
      lastCollidingMutableWriterIndex(builder.outputs, planned),
      viewTailOccupancyCap(planned, this.getPublishJobEventsBand()),
      derivedEnd,
    );
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
      console.error('view-tail-repack', {
        planned,
        writerEnd,
        occupants: planned.map((index) => ({
          index,
          lock: builder.outputs[index]?.to instanceof Uint8Array
            ? binToHex(builder.outputs[index].to as Uint8Array).slice(0, 16)
            : String(builder.outputs[index]?.to ?? '').slice(0, 16),
          cap: builder.outputs[index]?.token?.nft?.capability,
          commit: String(builder.outputs[index]?.token?.nft?.commitment ?? '').slice(0, 24),
        })),
      });
    }
    if (writerEnd < 0) return false;
    const jobsCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    const suffixStart = jobsCount > 0
      ? builder.outputs.length - jobsCount - 1
      : builder.outputs.length;
    const reserved = new Set<number>();
    for (const [index, input] of this.allInputs.entries()) {
      const cap = input.token?.nft?.capability;
      if (cap === 'minting' || cap === 'mutable') reserved.add(index);
    }
    for (const index of this.derivedChunkOutputs.keys()) reserved.add(index);
    const viewGroups = this.externalCallUtxoGroups
      .map((group, index) => ({ group, index }))
      .filter(({ group, index }) => group.returnOutputIndex !== undefined
        && !groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, index));
    const padDestinations = findViewTailDestinations(
      builder.outputs, viewGroups.length, { suffixStart, reserved, preferBefore: writerEnd },
    );
    const reassigned = new Map<number, number>();
    if (padDestinations.length === viewGroups.length) {
      const packOptions = this.viewTailPackOptions(suffixStart);
      for (const [offset, { index, group }] of viewGroups.entries()) {
        reassigned.set(index, clampViewTailPlacement({
          planned: group.returnOutputIndex ?? padDestinations[offset],
          packed: padDestinations[offset],
          band: packOptions.band,
          suffixStart: packOptions.suffixStart,
          tokenWriterPresent: packOptions.tokenWriterPresent,
        }));
      }
    } else {
      const packed = assignPhysicalReturnIndices(
        this.externalCallUtxoGroups,
        (categoryId) => this.findMintingInputIndex(categoryId),
        writerEnd,
        this.viewTailPackOptions(suffixStart),
      );
      for (const [groupIdx, returnIndex] of packed) reassigned.set(groupIdx, returnIndex);
    }
    let changed = false;
    for (const [groupIdx, returnIndex] of reassigned) {
      const group = this.externalCallUtxoGroups[groupIdx];
      if (!group || group.returnOutputIndex === returnIndex) continue;
      group.returnOutputIndex = returnIndex;
      changed = true;
    }
    if (!changed) return false;
    for (const carrier of [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]) {
      if (!carrier.returnWitnessGroups || !carrier.refreshInternalArgs) continue;
      const updates: Record<string, bigint> = {};
      for (const [name, groupIdx] of Object.entries(carrier.returnWitnessGroups)) {
        const returnIndex = reassigned.get(groupIdx);
        if (returnIndex === undefined) continue;
        if (carrier.internalArgs?.[name] === BigInt(returnIndex)) continue;
        updates[name] = BigInt(returnIndex);
      }
      if (Object.keys(updates).length === 0) continue;
      carrier.refreshInternalArgs(updates);
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
      console.error('view-tail-repack-applied', {
        assigned: [...reassigned],
        groups: this.externalCallUtxoGroups.map((group, index) => ({
          index,
          fn: group.logicalFunctionName ?? group.functionName,
          returnOutputIndex: group.returnOutputIndex,
        })),
      });
    }
    this._syncBuilderUnlockers(builder);
    return true;
  }

  /** Copy refreshed unlockers onto an already-materialized TransactionBuilder. */
  private _syncBuilderUnlockers(builder: TransactionBuilder): void {
    const next = syncBuilderInputsFromAllInputs(builder.inputs, this.allInputs);
    builder.inputs.splice(0, builder.inputs.length, ...next);
  }

  /** Mirror refreshed carrier masters into both the flattened and materialized input lists. */
  private _syncRefreshedCarrierMasters(
    builder: TransactionBuilder,
    carriers: Iterable<ExternalCallUtxoGroup>,
  ): void {
    for (const carrier of carriers) {
      const master = carrier.masterUtxo as UnlockableUtxo | undefined;
      if (!master?.unlocker) continue;
      const inputIndex = this.allInputs.findIndex((input) => (
        input.txid.toLowerCase() === master.txid.toLowerCase() && input.vout === master.vout
      ));
      if (inputIndex >= 0) this.allInputs[inputIndex] = master;
    }
    this._syncBuilderUnlockers(builder);
  }

  /** Rebind each participant data-NFT covenant to its master in the final physical input order. */
  private _reconcileMaterializedDataNftUnlockers(builder: TransactionBuilder): boolean {
    let changed = false;
    const groups = [
      ...this.externalCallUtxoGroups.filter((group) => group.sharedGroupIndex === undefined),
      ...this.lowLevelCallUtxoGroups,
    ];
    for (const group of groups) {
      const master = group.masterUtxo as UnlockableUtxo | undefined;
      if (!master) continue;
      const masterInputIndex = this.allInputs.findIndex((input) => (
        input.txid.toLowerCase() === master.txid.toLowerCase() && input.vout === master.vout
      ));
      if (masterInputIndex < 0) continue;
      group.dataNftUtxos = group.dataNftUtxos.map((dataNft) => {
        if (!isContractUnlocker(dataNft.unlocker)) return dataNft;
        const flagIndex = dataNft.unlocker.abiFunction.inputs.findIndex((input) => input.name === 'flag');
        const masterIndex = dataNft.unlocker.abiFunction.inputs
          .findIndex((input) => input.name === 'masterInputIndex');
        const flag = flagIndex < 0 ? undefined : dataNft.unlocker.params[flagIndex];
        const priorMaster = masterIndex < 0 ? undefined : dataNft.unlocker.params[masterIndex];
        if ((flag !== 1n && flag !== 3n) || priorMaster === BigInt(masterInputIndex)) return dataNft;
        const outputIndexParam = dataNft.unlocker.abiFunction.inputs
          .findIndex((input) => input.name === 'outputIndex');
        const outputIndex = outputIndexParam < 0 ? undefined : dataNft.unlocker.params[outputIndexParam];
        const unlocker = flag === 3n && typeof outputIndex === 'bigint'
          ? createRelocatedDataNftUnlocker(
            group.externalContract.inner, masterInputIndex, Number(outputIndex), group.categoryId,
          )
          : createDataNftUnlocker(group.externalContract.inner, masterInputIndex, group.categoryId);
        const rebound = { ...dataNft, unlocker } as UnlockableUtxo;
        const matches = (candidate: Utxo | undefined): boolean => candidate !== undefined
          && candidate.txid.toLowerCase() === dataNft.txid.toLowerCase() && candidate.vout === dataNft.vout;
        const flatIndex = this.allInputs.findIndex(matches);
        if (flatIndex >= 0) this.allInputs[flatIndex] = rebound;
        const builtIndex = builder.inputs.findIndex(matches);
        if (builtIndex >= 0) builder.inputs[builtIndex] = rebound;
        if (group.blockInputs) {
          const blockIndex = group.blockInputs.findIndex(matches);
          if (blockIndex >= 0) group.blockInputs[blockIndex] = rebound;
        }
        changed = true;
        return rebound;
      });
    }
    return changed;
  }

  /** Rebind hidden callee-master arguments from the final physical input order. */
  private _reconcileMaterializedInputWitnesses(builder: TransactionBuilder): boolean {
    const dataNftsChanged = this._reconcileMaterializedDataNftUnlockers(builder);
    const changedCarriers = new Set<ExternalCallUtxoGroup>();
    for (const carrier of [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]) {
      if (!carrier.mintingInputWitnessCategories || !carrier.refreshInternalArgs) continue;
      const updates: Record<string, bigint> = {};
      for (const [name, categoryId] of Object.entries(carrier.mintingInputWitnessCategories)) {
        const inputIndex = this.findMintingInputIndex(categoryId);
        if (inputIndex < 0 || carrier.internalArgs?.[name] === BigInt(inputIndex)) continue;
        updates[name] = BigInt(inputIndex);
      }
      if (Object.keys(updates).length === 0) continue;
      carrier.refreshInternalArgs(updates, { shiftPredOut: false });
      carrier.internalArgs = { ...carrier.internalArgs, ...updates };
      changedCarriers.add(carrier);
    }
    if (changedCarriers.size === 0) return dataNftsChanged;
    this._syncRefreshedCarrierMasters(builder, changedCarriers);
    return true;
  }

  /** Rebase absolute predecessor-output witnesses from each participant's final physical master coordinate. */
  private _reconcileMaterializedPredOutWitnesses(builder: TransactionBuilder): boolean {
    const changedCarriers = new Set<ExternalCallUtxoGroup>();
    for (const carrier of [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]) {
      if (!carrier.refreshInternalArgs) continue;
      const predOutArgs = Object.entries({
        ...carrier.compilerRoute?.internalArgs,
        ...carrier.internalArgs,
      }).filter(([name, value]) => /^__internal__vmapBatchPredOut_\d+$/.test(name)
        && typeof value === 'bigint' && value >= 0n);
      if ((carrier.batchPredecessorOutputs?.length ?? 0) === 0 && predOutArgs.length === 0) continue;
      const master = carrier.masterUtxo as UnlockableUtxo | undefined;
      if (!master) continue;
      const masterIndex = this.allInputs.findIndex((input) => (
        input.txid.toLowerCase() === master.txid.toLowerCase() && input.vout === master.vout
      ));
      if (masterIndex < 0) continue;
      const nextBase = materializedPredOutBase(carrier, masterIndex);
      if (carrier.relocatedPredOutBase === nextBase) continue;
      carrier.relocatedPredOutBase = nextBase;
      carrier.refreshInternalArgs({}, { shiftPredOut: false });
      changedCarriers.add(carrier);
    }
    if (changedCarriers.size === 0) return false;
    this._syncRefreshedCarrierMasters(builder, changedCarriers);
    return true;
  }

  /** Reconcile materialized predecessor outputs with the same final physical masters as their witnesses. */
  private _reassertMaterializedBatchPredecessorOutputs(builder: TransactionBuilder): boolean {
    let changed = 0;
    const carriers = [
      ...this.externalCallUtxoGroups.map((carrier) => ({ carrier, directParticipant: true })),
      ...this.lowLevelCallUtxoGroups.map((carrier) => ({ carrier, directParticipant: false })),
    ];
    for (const { carrier, directParticipant } of carriers) {
      if (!carrier.categoryId) continue;
      const master = carrier.masterUtxo as UnlockableUtxo | undefined;
      if (!master) continue;
      const masterIndex = this.allInputs.findIndex((input) => (
        input.txid.toLowerCase() === master.txid.toLowerCase() && input.vout === master.vout
      ));
      // Direct participant INSERTs place NEW at the fixed entry slot and P' at the declared trailing slot.
      // A delegate's compiler uses its co-spent fixed slot for P' and the trailing slot for NEW, so its planned
      // insertion must remain trace-derived and must not use this direct-participant reassertion.
      const plannedPredecessors = (directParticipant && carrier.delegateCallGroupIndex === undefined
        ? carrier.plannedEntryInserts ?? [] : [])
        .flatMap((planned) => {
        const input = carrier.blockInputs?.[planned.blockSlot];
        if (!input?.unlocker || planned.outputBlockSlot < 0 || planned.commitment === undefined) return [];
        return [{
          outputBlockSlot: planned.outputBlockSlot,
          lockingBytecode: input.unlocker.generateLockingBytecode(),
          commitment: planned.commitment,
        }];
        });
      if ((carrier.batchPredecessorOutputs?.length ?? 0) > 0) {
        changed += reassertBatchPredecessorOutputsAtDeclaredSlots(
          builder.outputs,
          masterIndex,
          carrier.categoryId,
          carrier.batchPredecessorOutputs!,
        );
      }
      if (plannedPredecessors.length > 0) {
        changed += reassertBatchPredecessorOutputsAtDeclaredSlots(
          builder.outputs,
          masterIndex,
          carrier.categoryId,
          plannedPredecessors,
          true,
        );
      }
    }
    return changed > 0;
  }

  /** Rebind return-index arguments after every output owner has materialized. */
  private _reconcileMaterializedReturnWitnesses(builder: TransactionBuilder): boolean {
    const resolved = new Map<number, number>();
    const tailExpectations: MaterializedReturnExpectation[] = [];
    for (const [groupIdx, group] of this.externalCallUtxoGroups.entries()) {
      if (groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, groupIdx)) {
        // A writer block can grow after the compiler layout is emitted (for
        // example, a materialized predecessor slot). Prefer the already-bound
        // coordinate when final output content proves it; the static
        // master+returnSlot fallback can then be one position early.
        const matchesWriterReturn = (index: number): boolean => {
          const output = builder.outputs[index];
          return index >= 0
            && isViewReturnTailOutput(output)
            && output.token?.category.toLowerCase() === group.categoryId.toLowerCase();
        };
        const actual = [
          group.returnOutputIndex,
          this.getBuiltExternalCallReturnEventOutputIndex(groupIdx),
        ].find((index): index is number => index !== undefined && matchesWriterReturn(index));
        if (actual !== undefined) resolved.set(groupIdx, actual);
        continue;
      }
      const identityIndices = new Set([
        groupIdx,
        logicalReturnGroupIndex(this.externalCallUtxoGroups, groupIdx),
        group.fusedReturnGroupIndex,
      ].filter((index): index is number => index !== undefined));
      const pending = this.pendingReturnEventOutputs.find((event) => [...identityIndices].some((index) => (
        event.identity === `external-call:${index}`
          || event.identity === `external-call:${index}:0`
      )));
      const commitment = pending?.commitment
        ?? group.precomputedReturnCommitment
        ?? group.loopReturnCommitments?.[0];
      if (commitment === undefined) continue;
      tailExpectations.push({
        groupIndex: groupIdx,
        categoryId: pending?.categoryId ?? group.categoryId,
        commitment,
        currentIndex: group.returnOutputIndex,
        builtIndex: this.getBuiltExternalCallReturnEventOutputIndex(groupIdx),
      });
    }
    for (const [groupIdx, outputIndex] of matchMaterializedReturnOutputs(
      builder.outputs, tailExpectations,
    )) resolved.set(groupIdx, outputIndex);

    let changed = false;
    for (const [groupIdx, outputIndex] of resolved) {
      const group = this.externalCallUtxoGroups[groupIdx];
      if (!group || group.returnOutputIndex === outputIndex) continue;
      group.returnOutputIndex = outputIndex;
      changed = true;
    }
    const changedCarriers = new Set<ExternalCallUtxoGroup>();
    for (const carrier of [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]) {
      if (!carrier.returnWitnessGroups || !carrier.refreshInternalArgs) continue;
      const updates: Record<string, bigint> = {};
      for (const [name, groupIdx] of Object.entries(carrier.returnWitnessGroups)) {
        const outputIndex = resolved.get(groupIdx);
        if (outputIndex === undefined || carrier.internalArgs?.[name] === BigInt(outputIndex)) continue;
        updates[name] = BigInt(outputIndex);
      }
      if (Object.keys(updates).length === 0) continue;
      carrier.refreshInternalArgs(updates, { shiftPredOut: false });
      changedCarriers.add(carrier);
      changed = true;
    }
    if (!changed) return false;

    // refreshInternalArgs replaces the carrier's master UTXO object. Preserve
    // physical input order and update only the matching final input unlocker.
    this._syncRefreshedCarrierMasters(builder, changedCarriers);
    return true;
  }

  /**
   * transferFrom INSERT is P' at master+2 and NEW at master+4. Occupancy can leave
   * the allowance collection on +4; put P''s lock back without shifting tails.
   */
  private _reassertTokenInsertNewLocks(builder: TransactionBuilder): void {
    for (const group of this.externalCallUtxoGroups) {
      if (group.sharedGroupIndex !== undefined) continue;
      if (!group.categoryId || (group.functionName !== 'transferFrom' && group.logicalFunctionName !== 'transferFrom')) {
        continue;
      }
      const master = this.findMintingInputIndex(group.categoryId);
      if (master < 0) continue;
      reassertTokenInsertNewLock(builder.outputs, master, group.categoryId);
    }
  }

  /**
   * Minting inputs are 1:1. Token-container spend checks
   * OUTPUTVALUE/AMOUNT >= UTXOVALUE/AMOUNT at INPUTINDEX; a dust-sized
   * duplicate minting at that index fails FakeToken.transferFrom.
   */
  private _reassertMintingOneToOne(builder: TransactionBuilder): void {
    for (let index = 0; index < this.allInputs.length; index++) {
      const input = this.allInputs[index];
      if (!input?.token || input.token.nft?.capability !== 'minting') continue;
      if (!('unlocker' in input) || !input.unlocker) continue;
      builder.outputs[index] = {
        to: input.unlocker.generateLockingBytecode(),
        amount: input.satoshis,
        token: cloneToken(input.token),
      };
      stripSurplusMintingOutputs(
        builder.outputs,
        this.allInputs,
        input.token.category ?? '',
        index,
      );
    }
  }

  /**
   * Check if the satoshi container is fully drained (all satoshis transferred out).
   */
  isSatoshiContainerDrained(): boolean {
    if (!this.satoshiContainerUtxo) return false;
    const total = this.pendingTransfers
      .filter((t) => t.lockingBytecode.length > 0)
      .reduce((sum, t) => sum + t.amount, 0n)
      + this.runtimeLoopTransferOutputs
        .filter((transfer) => (transfer.kind ?? 'bch') === 'bch')
        .reduce((sum, transfer) => sum + transfer.amount, 0n);
    return total >= this.satoshiContainerUtxo.satoshis + this.containerDepositAmount;
  }

  /**
   * Check if a token container is fully drained (all FTs transferred + NFT transferred if present).
   */
  isTokenContainerDrained(categoryId: string): boolean {
    const container = this.tokenContainers.find((c) => c.tokenContainerCategoryId === categoryId);
    if (!container?.exists || !container?.utxo) return false;
    const ftTransferred = this.pendingTokenContainerTransfers
      .filter((t) => t.tokenContainerCategoryId === categoryId)
      .reduce((sum, t) => sum + t.amount, 0n)
      + this.runtimeLoopTransferOutputs
        .filter((transfer) => transfer.kind === 'token'
          && transfer.tokenContainerCategoryId === categoryId)
        .reduce((sum, transfer) => sum + transfer.amount, 0n);
    const nftTransferred = this.pendingTokenContainerTransferNfts
      .some((t) => t.tokenContainerCategoryId === categoryId)
      || this.runtimeLoopTransferOutputs.some((transfer) => transfer.kind === 'nft'
        && transfer.tokenContainerCategoryId === categoryId);
    const inputFt = container.utxo.token?.amount ?? 0n;
    if (ftTransferred > inputFt) {
      throw new Error(
        `Total fungible token transfer amount (${ftTransferred}) `
        + `exceeds token container balance (${inputFt}) `
        + `for category ${categoryId}`,
      );
    }
    const hasNft = !!container.utxo.token?.nft;
    return (inputFt - ftTransferred === 0n) && (!hasNft || nftTransferred);
  }

  /**
   * Get the bitmask of token container output flags (which slots have outputs).
   * Slots with drained containers have bit = 0.
   */
  getTokenContainerOutputFlags(): bigint {
    let flags = 0n;
    for (const container of this.tokenContainers) {
      if (container.exists && container.utxo
        && !this.isTokenContainerDrained(container.tokenContainerCategoryId)) {
        flags |= 1n << BigInt(container.tokenContainerSlotIndex);
      }
    }
    return flags;
  }

  /** Get the list of token container infos (for drain detection). */
  getEntryNftInfos(): readonly EntryNftInfo[] {
    return this.entryNfts;
  }

  getTokenContainerInfos(): readonly TokenContainerInfo[] {
    return this.tokenContainers;
  }

  /**
   * Compute the output index where entry NFT outputs start.
   */
  getEntryOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('entry', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    const masterOutputCount = 1;
    const dataNftOutputCount = this.requiredNftIndices.length;
    const readOnlyOutputCount = this.readOnlyDataNftUtxos.length;
    const blockhashOutputCount = this.blockhashCoSpendUtxos.length;
    const keccakOutputCount = this.keccakComputeCoSpendUtxos.length;
    const ecrecoverOutputCount = this.ecrecoverComputeCoSpendUtxos.length;
    const outStateOutputCount = this.externalOutStateUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length + (g.keccakInputs?.length ?? 0), 0,
    );
    const externalCallOutputCount = this.externalCallUtxoGroups.reduce(
      (sum, g) => (g.blockInputs ? sum + g.blockInputs.length : sum + 1 + g.dataNftUtxos.length), 0,
    );
    // A direct delegate is preserved before the proxy-owned entry band (see build()). Its implementation
    // master/data outputs therefore shift the physical entry indices even though they are not part of the
    // proxy forwarder's block layout. Delegates associated with an external group are emitted with that group
    // later and have already been counted above.
    const associatedDelegates = new Set(this.externalCallUtxoGroups
      .map((group) => group.delegateCallGroupIndex)
      .filter((index): index is number => index !== undefined));
    const leadingDelegateOutputCount = this.delegateEntriesAfterLowLevel
      ? this.lowLevelCallUtxoGroups.reduce((sum, group, index) => (
        group.callMode === 'delegatecall' && !associatedDelegates.has(index)
          ? sum + 1 + group.dataNftUtxos.length : sum
      ), 0) + (this.delegateReturnEventAfterEvents ? 0 : this.pendingReturnEventOutputs
        .filter((returnEvent) => returnEvent.categoryId === this.categoryId).length)
      : 0;
    // When a dynamic-array read coexists with external calls, build() emits the read chunks' preservation
    // outputs BEFORE the callee outputs (loopChunkBeforeCallees), so everything downstream of the entries
    // (transfers, events, RETURN events - this is the chain root they all build on) shifts by the chunk
    // count. Without external calls the iteration entries trail the block instead (no shift). Must match
    // the witness-side formula in StatefulContract (returnEventOutputBase counts iterationEntryInputs).
    const chunkBeforeCalleeCount = this.externalCallUtxoGroups.length > 0 ? this.iterationEntryInputs.length : 0;
    // Low-level call outputs are now AFTER entries/SC/TCs/transfers/events (matching block layout)
    return masterOutputCount + dataNftOutputCount + readOnlyOutputCount + blockhashOutputCount + keccakOutputCount
      + ecrecoverOutputCount + outStateOutputCount + externalCallOutputCount + chunkBeforeCalleeCount
      + leadingDelegateOutputCount;
  }

  /**
   * The entry-slot index of each entry NFT output, in output order (matches the build() output loop:
   * non-deleted entries sorted by slotIndex). Output at getEntryOutputBase()+k belongs to slot [k].
   * Lets the derivation map an extracted commitment back to its slot by output index (robust to write
   * order and to read-only slots that emit no commitment check).
   */
  getEntryOutputSlotOrder(): number[] {
    // Must mirror build()'s entry-output emission exactly: a real output per non-deleted slot, plus a
    // position-holding placeholder for each deleted slot below the fill threshold. The derivation maps a
    // commitment at output offset O to slotOrder[O - entryOutputBase]; placeholders carry no commitment, so
    // they just occupy a position and are never looked up.
    const sorted = [...this.entryNfts].sort((a, b) => a.slotIndex - b.slotIndex);
    const fillThreshold = this.entryPlaceholderFillThreshold();
    const order: number[] = [];
    for (const e of sorted) {
      if (!this.entryDeletes.has(e.slotIndex) || e.slotIndex < fillThreshold) order.push(e.slotIndex);
    }
    return order;
  }

  // The slotIndex below which a skipped (deleted/funded) entry slot needs a placeholder output. Normally the
  // last real entry output; but when a trailing output (a dynamic chunk write, or a post-entry block-layout
  // slot) sits past the entry region, the whole region must be occupied so that trailing output lands at its
  // fixed offset - so fill through the last entry slot.
  private entryPlaceholderFillThreshold(): number {
    const sorted = [...this.entryNfts].sort((a, b) => a.slotIndex - b.slotIndex);
    if (sorted.length === 0) return -1;
    if (this.hasPostEntryOutput()) return sorted[sorted.length - 1].slotIndex + 1;
    let lastRealSlotIndex = -1;
    for (const e of sorted) if (!this.entryDeletes.has(e.slotIndex)) lastRealSlotIndex = e.slotIndex;
    return lastRealSlotIndex;
  }

  private hasPostEntryOutput(): boolean {
    if (this.dynamicChunkVars.length > 0) return true;
    if (this.loopEntryVars.length > 0) return true;
    if (!this.blockLayout) return false;
    const entryOffsets = this.blockLayout.slots.filter((s) => s.kind === 'entry').map((s) => s.offset);
    if (entryOffsets.length === 0) return false;
    const maxEntry = Math.max(...entryOffsets);
    return this.blockLayout.slots.some((s) => s.offset > maxEntry);
  }

  /**
   * Look up a block-layout offset for a given slot kind and optional slotIndex.
   * Returns `undefined` when no block layout is available or the slot is not found.
   */
  private getBlockSlotOffset(kind: BlockSlotKind, slotIndex?: number): number | undefined {
    if (!this.blockLayout) return undefined;
    const slot = this.blockLayout.slots.find(
      (s) => s.kind === kind && (slotIndex === undefined || s.slotIndex === slotIndex),
    );
    return slot?.offset;
  }

  /**
   * Compute the output index where token container preservation outputs start.
   * Token containers now come before output-only slots (transfers, tcTransfers, events)
   * so that input-bearing slots are contiguous and match blockLayout offsets.
   */
  getTokenContainerOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('tokenContainer', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    const entryNftOutputCount = this.entryNfts
      .filter((e) => !this.entryDeletes.has(e.slotIndex))
      .length;
    const satoshiContainerOutputCount = this.satoshiContainerUtxo ? 1 : 0;
    return this.getEntryOutputBase()
      + entryNftOutputCount + satoshiContainerOutputCount;
  }

  getTransferOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('transfer', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    const containerSlots = this.tokenContainers.filter(
      (d) => d.exists && d.utxo,
    ).length;
    const loopReturnWidth = this.externalCallUtxoGroups.reduce((sum, group, idx) => {
      if (this.isInBlockReturnEventGroup(idx)) return sum;
      if (group.returnOutputIndex === undefined) return sum;
      return sum + Math.max(0, (group.loopReturnCommitments?.length ?? 1) - 1);
    }, 0);
    return this.getTokenContainerOutputBase() + containerSlots + loopReturnWidth;
  }

  /**
   * Compute the output index where token container transfer outputs start.
   */
  getTokenContainerTransferOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('tcTransfer', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    const activeTransfers = this.pendingTransfers.filter((t) => t.lockingBytecode.length > 0).length;
    return this.getTransferOutputBase() + activeTransfers;
  }

  /**
   * Compute the output index where event NFT outputs start.
   */
  getEventOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('event', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    return this.getTokenContainerTransferOutputBase()
      + this.pendingTokenContainerTransfers.length
      + this.pendingTokenContainerTransferNfts.length;
  }

  /**
   * Compute the output index where return event outputs start.
   */
  getReturnEventOutputBase(): number {
    if (this.delegateEntriesAfterLowLevel) {
      let base = 1 + this.requiredNftIndices.length + this.readOnlyDataNftUtxos.length
        + this.blockhashCoSpendUtxos.length + this.keccakComputeCoSpendUtxos.length
        + this.ecrecoverComputeCoSpendUtxos.length;
      for (const g of this.externalOutStateUtxoGroups) {
        base += 1 + g.dataNftUtxos.length + (g.keccakInputs?.length ?? 0);
      }
      base += this.iterationEntryInputs.length;
      for (const g of this.externalCallUtxoGroups) {
        base += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
      }
      base += this.pendingReturnEventOutputs.filter((r) => r.categoryId === this.categoryId).length;
      for (const g of this.lowLevelCallUtxoGroups.filter((candidate) => candidate.callMode === 'delegatecall')) {
        base += 1 + g.dataNftUtxos.length;
      }
      return base;
    }
    const layoutOffset = this.getBlockSlotOffset('returnEvent');
    if (layoutOffset !== undefined) return layoutOffset;
    return this.getEventOutputBase() + this.getEventOutputCount();
  }

  /**
   * X13: a callee whose FULL block was assembled publishes a returnEvent slot inside that block, and the block
   * carries a paired funding input there, so its return-event NFT belongs at that slot - not appended after the
   * whole participant region. A callee without a full block (a transitive A->B->C leaf) keeps the appended tail.
   *
   * A later write fused onto the same physical master (FakeToken.approve after balanceOf) owns that slot.
   * The view callsite must keep the tail, where its precomputed pushdata already lives; sharing the writer's
   * 1-byte success flag (`0x01`) makes INT_DECODE SPLIT 1 on an empty remainder.
   */
  private isInBlockReturnEventGroup(groupIdx: number): boolean {
    return groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, groupIdx);
  }

  /** Return events that are NOT emitted inside a callee block, in emission order. */
  private tailReturnEventOutputs(): Array<{
    categoryId: string; commitment: Uint8Array; identity: string; provisional?: boolean;
  }> {
    const tail = selectMaterializedTailReturnEvents(
      this.externalCallUtxoGroups,
      this.pendingReturnEventOutputs,
    );
    const groupIdxOf = (identity: string): number => {
      const match = /^external-call:(\d+)/.exec(identity);
      return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
    };
    const proxyRank = (idx: number): number => (
      this.externalCallUtxoGroups[idx]?.functionName === '__forward' ? 0 : 1
    );
    return tail.sort((left, right) => {
      const leftIdx = groupIdxOf(left.identity);
      const rightIdx = groupIdxOf(right.identity);
      return proxyRank(leftIdx) - proxyRank(rightIdx) || leftIdx - rightIdx;
    });
  }

  /**
   * X13: the output index carrying external-call group `groupIdx`'s return-event NFT - its own block slot when the
   * callee carries a full block, otherwise its rank in the appended tail band.
   */
  getExternalCallReturnEventOutputIndex(groupIdx: number): number {
    const group = this.externalCallUtxoGroups[groupIdx];
    if (!group) return -1;
    const offset = group.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent')?.offset;
    if (this.isInBlockReturnEventGroup(groupIdx) && offset !== undefined) {
      const physical = this.externalCallUtxoGroups[group.sharedGroupIndex ?? groupIdx];
      const master = this.findMintingInputIndex(physical.categoryId);
      if (master >= 0) return master + offset;
      return this.getExternalCallOutputBase(groupIdx) + offset;
    }
    const returnIdentity = `external-call:${logicalReturnGroupIndex(this.externalCallUtxoGroups, groupIdx)}`;
    const tailOrder = this.tailReturnEventOutputs().findIndex((re) => re.identity === returnIdentity);
    return tailOrder < 0 ? -1 : this.getReturnEventOutputBase() + tailOrder;
  }

  /**
   * Count the actual number of event NFT outputs that build() will create.
   * This mirrors the merge logic in build(): manual emits fill dense indices,
   * placeholders (with optional raw commitments) fill by emitIndex, and
   * only non-null entries produce actual outputs.
   */
  private getEventOutputCount(): number {
    // Replicate the sparse array merge from build()
    const occupied = new Set<number>();

    // Manual emitEvent() calls occupy indices 0..n-1
    for (let i = 0; i < this.pendingEventEmits.length; i++) {
      occupied.add(i);
    }

    // Placeholders occupy their emitIndex (if not already taken by manual emits)
    for (const placeholder of this.pendingEventPlaceholders) {
      occupied.add(placeholder.emitIndex);
    }

    return occupied.size;
  }

  /**
   * Compute the input index of the satoshi container.
   * The satoshi container is placed after token containers in the input ordering.
   */
  getSatoshiContainerInputIndex(): number {
    const layoutOffset = this.getBlockSlotOffset('satoshiContainer');
    if (layoutOffset !== undefined) return layoutOffset;

    const masterInputCount = 1;
    const dataNftInputCount = this.dataNftUtxos.length;
    const readOnlyInputCount = this.readOnlyDataNftUtxos.length;
    const blockhashInputCount = this.blockhashCoSpendUtxos.length;
    const keccakInputCount = this.keccakComputeCoSpendUtxos.length;
    const ecrecoverInputCount = this.ecrecoverComputeCoSpendUtxos.length;
    const outStateInputCount = this.externalOutStateUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length + (g.keccakInputs?.length ?? 0), 0,
    );
    const externalCallInputCount = this.externalCallUtxoGroups.reduce(
      (sum, g) => (g.blockInputs ? sum + g.blockInputs.length : sum + 1 + g.dataNftUtxos.length), 0,
    );
    const lowLevelCallInputCount = this.lowLevelCallUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
    ) + this.lowLevelCallRawInputs.length;
    const entryInputCount = this.entryNfts.filter((e) => e.exists && e.utxo).length;
    const iterationEntryInputCount = this.iterationEntryInputs.length;
    const tokenContainerInputCount = this.tokenContainers.filter((d) => d.exists && d.utxo).length;
    return masterInputCount + dataNftInputCount + readOnlyInputCount + blockhashInputCount + keccakInputCount
      + ecrecoverInputCount + outStateInputCount + externalCallInputCount + lowLevelCallInputCount
      + entryInputCount + iterationEntryInputCount + tokenContainerInputCount;
  }

  /**
   * Compute the output index of the satoshi container preservation output.
   * The satoshi container output is placed after entries, before transfers.
   */
  getSatoshiContainerOutputIndex(): number {
    // With OP_RETURN placeholders for drained containers, the output always
    // exists at the block layout position (even when drained).
    const layoutOffset = this.getBlockSlotOffset('satoshiContainer');
    if (layoutOffset !== undefined) return layoutOffset;
    // The satoshi container output is at getTokenContainerOutputBase() - 1
    return this.getTokenContainerOutputBase() - 1;
  }

  /**
   * Compute the total number of outputs in the transaction.
   */
  private getTotalOutputCount(): number {
    const eventOutputCount = this.getEventOutputCount();
    const lowLevelCallOutputCount = this.lowLevelCallUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
    ) + this.lowLevelCallRawInputs.length;
    const iterationEntryOutputCount = this.iterationEntryInputs.length;
    // Include potential funder change output (added last in build())
    const changeOutputCount = (this.funderChangeAddress && this.funderUtxos.length > 0) ? 1 : 0;
    // X13: in-block return events are already counted inside each callee's block output span.
    return this.getEventOutputBase() + eventOutputCount
      + this.tailReturnEventOutputs().length
      + lowLevelCallOutputCount
      + this._dynamicChunkOutputCount()
      + this.runtimeLoopEventOutputs.length
      + this.runtimeLoopTransferOutputs.length
      + iterationEntryOutputCount
      + this.pendingOutputs.length
      + this.lateValueChunkOutputs.length
      + (this.lateValueChunkOutputs.length > 0 ? 1 : 0)
      + changeOutputCount;
  }

  /**
   * Build the covenant transaction without funding or broadcasting.
   * Returns the logically balanced transaction with all covenant inputs/outputs
   * and empty unlocking bytecodes on any unsigned inputs.
   *
   * The caller is responsible for:
   * 1. Adding fee funding input(s) to cover the transaction fee
   * 2. Adding a change output for excess funding
   * 3. Signing all inputs (covenant inputs already have unlocking bytecodes)
   * 4. Broadcasting the final transaction
   */
  async buildUnsigned(): Promise<{
    transaction: Uint8Array;
    sourceOutputs: LibauthOutput[];
    inputCount: number;
    covenantSize: number;
  }> {
    const covenantBuilder = this.build();
    const covenantTx = covenantBuilder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(covenantBuilder.inputs);
    const encoded = encodeTransaction(covenantTx);

    return {
      transaction: encoded,
      sourceOutputs,
      inputCount: covenantTx.inputs.length,
      covenantSize: encoded.byteLength,
    };
  }

  /**
   * On a covenant script failure, log an accurate op-level VM trace of the submitted tx. Runs the 2026 VM
   * (the one mocknet uses) so it executes the optimised subroutine bytecode the source-map debug can't track,
   * pinpointing the exact failing opcode + stack. Finds the failing input (named in the error, else scanned)
   * and prints a window of ops ending at the failure. Best-effort: the caller swallows any error here.
   */
  private _logCovenantFailureTrace(builder: TransactionBuilder, reason: string): void {
    const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
    // VM tracing re-evaluates a potentially enormous transaction and observes every opcode. Keep it opt-in:
    // expected covenant rejections are ordinary control flow in tests and applications, not a reason to spend
    // tens of seconds constructing and printing a diagnostic trace.
    if (env?.SOLIDC_DEBUG_COVENANT_TRACE !== '1'
      && env?.SOLIDC_DEBUG_PREFLIGHT !== '1'
      && env?.SOLIDC_TRACE_INPUT === undefined) return;
    const verbose = env?.SOLIDC_DEBUG_COVENANT_TRACE === '1';
    const transaction = builder.buildLibauthTransaction(true);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const named = reason.match(/input(?: index)? (\d+)/);
    const traceInput = Number(env?.SOLIDC_TRACE_INPUT);
    const candidates = Number.isInteger(traceInput)
      ? [traceInput]
      : named ? [Number(named[1])] : (verbose ? transaction.inputs.map((_u, i) => i) : []);
    if (candidates.length === 0) return;
    const relaxedConsensus = (this.builderOptions.provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000;
    if (relaxedConsensus) {
      const traceWidth = Number(env?.SOLIDC_TRACE_ITEMS ?? (verbose ? '4' : '3'));
      const traceDepth = Number(env?.SOLIDC_TRACE_RING ?? (verbose ? '520' : '20'));
      const commitmentWidth = Number(
        (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_TRACE_COMMITMENT ?? '24',
      );
      for (const idx of candidates) {
        let helper54: Array<{ opcode: number; data?: Uint8Array }> | undefined;
        let pendingInvokeId: string | undefined;
        const invokedBodies = new Map<number, Set<string>>();
        let pendingOutputBytecodeIndex: number | undefined;
        const outputBytecodeMatches: Array<{
          body: number; index: number; matches: boolean; countBefore?: string;
          left?: string; right?: string;
        }> = [];
        const ring: Array<{
          ip: number; opcode: number; depth: number; top: string[]; data?: string; bodyLen: number;
        }> = [];
        const vm = createVirtualMachineBch2026ForProvider(this.builderOptions.provider, {
          opcodes: new Set(Array.from({ length: 256 }, (_unused, opcode) => opcode)),
          beforeOperation: (unknownState) => {
            const state = unknownState as {
              ip: number; instructions: Array<{ opcode: number; data?: Uint8Array }>; stack: Uint8Array[];
            };
            const instruction = state.instructions[state.ip];
            if (instruction?.opcode === 0xaa && state.instructions.length === 23
              && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_UNICROW_PAY === '1') {
              console.error('unicrow-entry-covenant-preimage', binToHex(
                state.stack[state.stack.length - 1] ?? new Uint8Array(),
              ));
            }
            if (instruction?.opcode === Op.OP_OUTPUTBYTECODE) {
              const encodedIndex = state.stack[state.stack.length - 1];
              pendingOutputBytecodeIndex = encodedIndex === undefined ? undefined : encodedIndex.reduce(
                (value, byte, byteIndex) => value + byte * (256 ** byteIndex), 0,
              );
            } else if ((instruction?.opcode === Op.OP_EQUAL || instruction?.opcode === Op.OP_EQUALVERIFY)
              && pendingOutputBytecodeIndex !== undefined) {
              const left = state.stack[state.stack.length - 2];
              const right = state.stack[state.stack.length - 1];
              outputBytecodeMatches.push({
                body: state.instructions.length,
                index: pendingOutputBytecodeIndex,
                matches: left !== undefined && right !== undefined && left.length === right.length
                  && left.every((byte, byteIndex) => byte === right[byteIndex]),
                countBefore: state.stack[state.stack.length - 4] === undefined
                  ? undefined : binToHex(state.stack[state.stack.length - 4]),
                left: left === undefined ? undefined : binToHex(left),
                right: right === undefined ? undefined : binToHex(right),
              });
              pendingOutputBytecodeIndex = undefined;
            }
            if (state.ip === 0 && pendingInvokeId !== undefined) {
              const ids = invokedBodies.get(state.instructions.length) ?? new Set<string>();
              ids.add(pendingInvokeId);
              invokedBodies.set(state.instructions.length, ids);
              pendingInvokeId = undefined;
            }
            if (instruction?.opcode === 0x8a) {
              pendingInvokeId = binToHex(state.stack[state.stack.length - 1] ?? new Uint8Array());
            }
            if (!helper54 && state.instructions.length === 54) helper54 = state.instructions;
            ring.push({
              ip: state.ip,
              opcode: instruction?.opcode ?? 0,
              // Body length identifies the frame: a failure inside a small outlined helper is usually a defect
              // at its CALL SITE, and the frame change is what points there.
              bodyLen: state.instructions.length,
              depth: state.stack.length,
              data: instruction?.data === undefined ? undefined : binToHex(instruction.data).slice(0, 64),
              top: state.stack.slice(-traceWidth).map((item) => {
                const hex = binToHex(item);
                if (hex.length === 0) return '<empty>';
                return hex.length > 80 ? `${hex.slice(0, 80)}..` : hex;
              }),
            });
            if (ring.length > traceDepth) ring.shift();
          },
        });
        const finalState = vm.evaluate({ inputIndex: idx, sourceOutputs, transaction }) as {
          error?: string; stack?: Uint8Array[];
        };
        if (!finalState.error) continue;
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_INPUTS === '1') {
          // eslint-disable-next-line no-console
          console.error(`[srcOutputs 100-126] ${sourceOutputs.slice(100, 127)
            .map((so, k) => `${100 + k}:`
              + `${so.token
                ? `nft=${so.token.nft?.commitment ? binToHex(so.token.nft.commitment) : '(none)'}`
                : 'PLAIN'}`).join('  ')}`);
        }
        const finalStack = (finalState.stack ?? []).map((item, itemIndex) => {
          const hex = binToHex(item);
          return `    [${itemIndex}] ${hex.length > 80 ? `${hex.slice(0, 80)}..(${item.length}B)` : hex}`;
        }).join('\n');
        const failedBuilderInput = builder.inputs[idx] as UnlockableUtxo & {
          unlocker?: {
            abiFunction?: { name?: string; inputs?: readonly { name: string }[] };
            contract?: { artifact?: { contractName?: string } };
            params?: unknown[];
          };
        };
        const failedAbiInputs = failedBuilderInput.unlocker?.abiFunction?.inputs ?? [];
        const sameOutpoint = (candidate: Utxo | undefined): boolean => candidate !== undefined
          && candidate.txid.toLowerCase() === failedBuilderInput.txid.toLowerCase()
          && candidate.vout === failedBuilderInput.vout;
        const failedOwners = [
          ...(sameOutpoint(this.masterUtxo) ? [{ kind: 'root', categoryId: this.categoryId }] : []),
          ...this.externalCallUtxoGroups.flatMap((group, groupIndex) => (
            sameOutpoint(group.masterUtxo) ? [{
              kind: 'externalCall', groupIndex,
              contract: group.externalContract?.inner?.artifact?.contractName,
              functionName: group.functionName,
              logicalFunctionName: group.logicalFunctionName,
              callMode: group.callMode,
              delegateCallGroupIndex: group.delegateCallGroupIndex,
              sharedGroupIndex: group.sharedGroupIndex,
            }] : []
          )),
          ...this.lowLevelCallUtxoGroups.flatMap((group, groupIndex) => (
            sameOutpoint(group.masterUtxo) ? [{
              kind: 'lowLevelCall', groupIndex,
              contract: group.externalContract?.inner?.artifact?.contractName,
              functionName: group.functionName,
              logicalFunctionName: group.logicalFunctionName,
              callMode: group.callMode,
            }] : []
          )),
        ];
        const identityWitnesses = failedAbiInputs.flatMap((input, inputIndex) => (
          /^__internal__(?:msgSenderCategory|externalCallInputBase|externalReturnOutputIdx\d*|returnOutputIdx|extcallMasterIdx\d*|extcallAnchorIdx\d*)$/.test(input.name) ? [{
            name: input.name,
            value: String(failedBuilderInput.unlocker?.params?.[inputIndex]),
          }] : []
        ));
        const anchorInputs = this.externalIdentityAnchorUtxos.map((anchor, anchorIndex) => {
          const inputIndex = builder.inputs.findIndex((input) => input.txid.toLowerCase() === anchor.txid.toLowerCase()
            && input.vout === anchor.vout);
          const source = sourceOutputs[inputIndex];
          return {
            anchorIndex,
            inputIndex,
            lockingBytecode: source === undefined ? undefined : binToHex(source.lockingBytecode),
            category: source?.token?.category === undefined ? undefined : binToHex(source.token.category),
          };
        });
        console.error('covenant-failed-input-context', JSON.stringify({
          inputIndex: idx,
          contract: failedBuilderInput.unlocker?.contract?.artifact?.contractName,
          functionName: failedBuilderInput.unlocker?.abiFunction?.name,
          abiInputCount: failedAbiInputs.length,
          parameterCount: failedBuilderInput.unlocker?.params?.length,
          missingParameters: failedAbiInputs.flatMap((input, inputIndex) => (
            failedBuilderInput.unlocker?.params?.[inputIndex] === undefined ? [input.name] : []
          )),
          owners: failedOwners,
          identityWitnesses,
          identityAnchors: anchorInputs,
        }));
        // eslint-disable-next-line no-console
        const verboseBytecode = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_TRACE_BYTECODE === '1';
        const bytecodeDetails = verboseBytecode
          ? `\nunlocking=${binToHex(transaction.inputs[idx].unlockingBytecode)}`
            + `\nprobeUnlocking105=${binToHex(transaction.inputs[105]?.unlockingBytecode ?? new Uint8Array())}`
            + `\nprobeUnlocking106=${binToHex(transaction.inputs[106]?.unlockingBytecode ?? new Uint8Array())}`
          : '';
        const ringText = ring.map((step, stepIndex) => (
          `  ip=${step.ip} op=0x${step.opcode.toString(16).padStart(2, '0')}`
          + `${step.data === undefined ? '' : `(${step.data})`} body=${step.bodyLen} depth=${step.depth} top=[${step.top.join(' ')}]`
          + (stepIndex === ring.length - 1 ? '  <-- FAILS HERE' : '')
        )).join('\n');
        if (!verbose) {
          const lastMismatch = [...outputBytecodeMatches].reverse().find((entry) => !entry.matches);
          const failedSource = sourceOutputs[idx];
          const queriedOutput = lastMismatch === undefined ? undefined : transaction.outputs[lastMismatch.index];
          const failedLockHex = failedSource === undefined ? undefined : binToHex(failedSource.lockingBytecode);
          const failedCategoryHex = failedSource?.token?.category === undefined
            ? undefined : binToHex(failedSource.token.category);
          const peerIndices = <T extends {
            lockingBytecode: Uint8Array;
            token?: {
              category?: Uint8Array;
              nft?: { capability?: string; commitment?: Uint8Array };
            };
          }>(
            values: T[],
          ): { lock: number[]; category: Array<{
            index: number; lock: string; capability?: string; commitment?: string;
          }> } => ({
            lock: failedLockHex === undefined ? [] : values.flatMap((value, index) => (
              binToHex(value.lockingBytecode) === failedLockHex ? [index] : []
            )),
            category: failedCategoryHex === undefined ? [] : values.flatMap((value, index) => (
              value.token?.category !== undefined && binToHex(value.token.category) === failedCategoryHex
                ? [{
                  index,
                  lock: binToHex(value.lockingBytecode),
                  capability: value.token.nft?.capability,
                  commitment: value.token.nft?.commitment === undefined
                    ? undefined : binToHex(value.token.nft.commitment),
                }] : []
            )),
          });
          console.error(`[covenant VM trace] input ${idx}: ${finalState.error}\n${ringText}\n`
            + `lastLockMismatch=${JSON.stringify(lastMismatch ?? null)} `
            + `equalOk=${outputBytecodeMatches.filter((entry) => entry.matches).length}\n`
            + `failedSource=${JSON.stringify({
              lockingBytecode: failedSource === undefined ? undefined : binToHex(failedSource.lockingBytecode),
              category: failedSource?.token?.category === undefined
                ? undefined : binToHex(failedSource.token.category),
              capability: failedSource?.token?.nft?.capability,
              commitment: failedSource?.token?.nft?.commitment === undefined
                ? undefined : binToHex(failedSource.token.nft.commitment),
            })}\n`
            + `queriedOutput=${JSON.stringify({
              index: lastMismatch?.index,
              lockingBytecode: queriedOutput === undefined ? undefined : binToHex(queriedOutput.lockingBytecode),
              category: queriedOutput?.token?.category === undefined
                ? undefined : binToHex(queriedOutput.token.category),
              capability: queriedOutput?.token?.nft?.capability,
              commitment: queriedOutput?.token?.nft?.commitment === undefined
                ? undefined : binToHex(queriedOutput.token.nft.commitment),
            })}\n`
            + `failedPeers=${JSON.stringify({
              inputs: peerIndices(sourceOutputs), outputs: peerIndices(transaction.outputs),
            })}`);
        } else {
          console.error(`[covenant VM trace] input ${idx}: ${finalState.error}${bytecodeDetails}\ninvokedBodies=${JSON.stringify([...invokedBodies].map(([length, ids]) => [length, [...ids]]))}\noutputBytecodeMatches=${JSON.stringify(outputBytecodeMatches.filter((entry) => entry.matches))}\nhelper54=${helper54?.map((instruction) => instruction.data === undefined ? instruction.opcode.toString(16).padStart(2, '0') : `${instruction.opcode.toString(16).padStart(2, '0')}(${binToHex(instruction.data)})`).join(' ')}\n${ringText}\nfinal stack:\n${finalStack}\ninputs=\n${sourceOutputs.map((input, inputIndex) => (
            `  ${inputIndex}:${binToHex(input.lockingBytecode).slice(0, 80)}:${input.token?.nft?.capability ?? '-'}:`
            + `${binToHex(input.token?.category ?? new Uint8Array()).slice(0, 16)}:`
            + `${binToHex(input.token?.nft?.commitment ?? new Uint8Array()).slice(0, commitmentWidth)}`
          )).join('\n')}\noutputs=\n${transaction.outputs.map((output, outputIndex) => (
            `  ${outputIndex}:${binToHex(output.lockingBytecode).slice(0, 80)}:${output.token?.nft?.capability ?? '-'}:`
            + `${binToHex(output.token?.category ?? new Uint8Array()).slice(0, 16)}:`
            + `${binToHex(output.token?.nft?.commitment ?? new Uint8Array()).slice(0, commitmentWidth)}`
          )).join('\n')}`);
        }
        return;
      }
      return;
    }
    // X109 / X121: this path only PRINTS, so it decides nothing and is left bare deliberately. The gate above
    // is `> 10_000`, so a provider publishing limits AT 10,000 reaches this branch.
    //
    // At `@mem-cash/validation` 0.0.8 - the version this package declares - the published limits DO reach the
    // decider, so a bare VM here can trace a shape the decider judged differently. Being bare makes this
    // tracer stricter than a strict profile and looser than a relaxed one; for a diagnostic that only widens
    // or narrows what gets printed, which is why it is not worth the extra coupling. The deciding twin below
    // reads the provider. See `X109ProviderFaithfulVm.test.ts` and `X121StrictPreflightDecision.test.ts`.
    const vm = createVirtualMachineBch2026();
    for (const idx of candidates) {
      if (idx < 0 || idx >= transaction.inputs.length) continue;
      const states = vm.debug({ inputIndex: idx, sourceOutputs, transaction }) as unknown as Array<{
        ip: number; instructions?: Array<{ opcode: number }>; stack?: Uint8Array[]; error?: string;
      }>;
      const errAt = states.findIndex((s) => s.error);
      if (errAt < 0) continue;
      const lines = [`[covenant VM trace] input ${idx}: ${states[errAt].error}`];
      for (let i = Math.max(0, errAt - 12); i <= errAt; i += 1) {
        const s = states[i];
        const opcode = s.instructions?.[s.ip]?.opcode ?? 0;
        const top = (s.stack ?? []).slice(-2).map((b) => {
          const h = binToHex(b);
          return h.length > 20 ? `${h.slice(0, 20)}..` : (h || '(empty)');
        }).join(' ');
        const marker = i === errAt ? '  <-- FAILS HERE' : '';
        lines.push(`  ip=${s.ip} op=0x${opcode.toString(16).padStart(2, '0')} `
          + `depth=${(s.stack ?? []).length} top=[${top}]${marker}`);
      }
      // The failing body is often a tiny outlined helper, so the defect is at its CALL SITE, not in it. Walk
      // back to the enclosing frames (distinct instruction arrays) and show where each was executing.
      const seen: Array<{ ip: number; count: number }> = [];
      let prev = states[errAt].instructions;
      for (let i = errAt; i >= 0 && seen.length < 4; i -= 1) {
        if (states[i].instructions === prev) continue;
        prev = states[i].instructions;
        seen.push({ ip: states[i].ip, count: states[i].instructions?.length ?? 0 });
      }
      if (seen.length > 0) {
        lines.push(`  callers: ${seen.map((f) => `[count=${f.count} ip=${f.ip}]`).join(' <- ')}`);
        const caller = states.slice(0, errAt + 1).reverse()
          .find((st) => st.instructions !== states[errAt].instructions);
        if (caller) {
          const from = Math.max(0, caller.ip - 10);
          lines.push(`  callerOps: ${(caller.instructions ?? []).slice(from, caller.ip + 2)
            .map((instruction, offset) => `${from + offset}:`
              + `${(instruction as { opcode: number }).opcode.toString(16).padStart(2, '0')}`
              + `${'data' in instruction && instruction.data
                ? `<${binToHex(instruction.data as Uint8Array)}>` : ''}`).join(' ')}`);
        }
      }
      // eslint-disable-next-line no-console
      console.error(lines.join('\n'));
      return;
    }
  }

  /**
   * Recover a computed C2 value-chunk output from the failing covenant itself. Transitive routed calls can be
   * represented only as low-level groups, so their masters are not visited by StatefulContract's external-call
   * derivation loop. The chunk verifier nevertheless has the complete authenticated output on its stack before
   * OP_OUTPUTBYTECODE: [.., commitment, outputIndex, lockingBytecode, outputIndex].
   */
  private _repairComputedChunkOutput(
    builder: TransactionBuilder, inputIndex: number,
  ): {
    changed: boolean;
    passed: boolean;
    repairedOutputs: number[];
    repairDetails: Array<{
      outputIndex: number;
      field: 'commitment' | 'lockingBytecode' | 'token';
      previous: string;
      proposed: string;
    }>;
  } {
    const repairTiming = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_PREFLIGHT_TIMING === '1';
    const repairStartedAt = repairTiming ? Date.now() : 0;
    const reportRepairTiming = (stage: string): void => {
      if (repairTiming) console.error('repair-input-timing', {
        inputIndex, stage, ms: Date.now() - repairStartedAt,
      });
    };
    const transaction = builder.buildLibauthTransaction(true);
    reportRepairTiming('transaction-built');
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    reportRepairTiming('source-outputs-built');
    const repairs = new Map<number, {
      outputIndex: number; lockingBytecode?: Uint8Array; commitment: Uint8Array; categoryId?: string;
    }>();
    const lockingBytecodeRepairs = new Map<number, Uint8Array>();
    const mutableTokenShellRepairs = new Map<number, { lockingBytecode: Uint8Array; categoryId: string }>();
    const eventRepairs = new Map<number, Uint8Array>();
    const tokenEventSlots = new Map<number, { categoryId: string; groupIndex: number; eventOrdinal: number }>();
    const tokenReturnSlots = new Map<number, number>();
    const delegateEventSlots = new Map<number, {
      categoryId: string;
      groupIndex: number;
      eventOrdinal: number;
    }>();
    const fixedStateOutpoints = new Set([
      ...this.dataNftUtxos,
      ...this.readOnlyDataNftUtxos,
      ...this.externalOutStateUtxoGroups.flatMap((group) => group.dataNftUtxos),
      ...this.externalCallUtxoGroups.flatMap((group) => group.dataNftUtxos),
      ...this.lowLevelCallUtxoGroups.flatMap((group) => group.dataNftUtxos),
    ].map((utxo) => `${utxo.txid.toLowerCase()}:${utxo.vout}`));
    const fixedStateSlots = new Set(builder.inputs.map((input, index) => ({ input, index }))
      .filter(({ input, index }) => {
        const sourceToken = sourceOutputs[index]?.token;
        const outputToken = transaction.outputs[index]?.token;
        const preservesNftIdentity = sourceToken?.nft !== undefined && outputToken?.nft !== undefined
          && sourceToken.nft.capability === outputToken.nft.capability
          && binToHex(sourceToken.category) === binToHex(outputToken.category)
          && binToHex(sourceToken.nft.commitment) === binToHex(outputToken.nft.commitment);
        return isFixedStateRepairSlot({
          explicitlyOwned: fixedStateOutpoints.has(`${input.txid.toLowerCase()}:${input.vout}`),
          inputCapability: input.token?.nft?.capability,
          preservesNftIdentity,
        });
      })
      .map(({ index }) => index));
    for (const [llcIndex, llc] of this.lowLevelCallUtxoGroups.entries()) {
      if (llc.callMode !== 'delegatecall') continue;
      const impl = this.getLowLevelCallMasterInputIndex(llcIndex);
      if (impl < 0) continue;
      const fn = llc.compilerRoute?.abiFunction
        ?? llc.externalContract?.inner?.artifact.abi.find((candidate: AbiFunction) =>
          candidate.name === (llc.logicalFunctionName ?? llc.functionName));
      const proxyGroup = this.externalCallUtxoGroups.find((group) => group.delegateCallGroupIndex === llcIndex);
      const executionCategory = proxyGroup?.categoryId ?? this.categoryId;
      let eventOrdinal = 0;
      for (const slot of fn?.blockLayout?.slots ?? []) {
        const outputIndex = impl + slot.offset;
        if (slot.kind !== 'event') continue;
        if (!fixedStateSlots.has(outputIndex)) {
          delegateEventSlots.set(outputIndex, {
            categoryId: executionCategory,
            groupIndex: llcIndex,
            eventOrdinal,
          });
        }
        eventOrdinal += 1;
      }
    }
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined) continue;
      let master = this.findMintingInputIndex(group.categoryId);
      if (master < 0) master = this.getExternalCallMasterInputIndex(groupIndex);
      if (master < 0 || !group.blockLayout) continue;
      let eventOrdinal = 0;
      for (const slot of group.blockLayout.slots) {
        if (slot.kind === 'event') {
          const outputIndex = master + slot.offset;
          if (!fixedStateSlots.has(outputIndex)) {
            tokenEventSlots.set(outputIndex, {
              categoryId: group.categoryId, groupIndex, eventOrdinal,
            });
          }
          eventOrdinal += 1;
        } else if (slot.kind === 'returnEvent') {
          const outputIndex = master + slot.offset;
          if (!fixedStateSlots.has(outputIndex)) tokenReturnSlots.set(outputIndex, groupIndex);
        }
      }
    }
    reportRepairTiming('repair-slots-indexed');
    const failingCategory = builder.inputs[inputIndex]?.token?.category;
    let repairOwnerCategory = failingCategory;
    let delegateRepairOwnerCategory: string | undefined;
    const associatedCategories = new Set<string>();
    if (failingCategory) associatedCategories.add(failingCategory);
    for (const [llcIndex, llc] of this.lowLevelCallUtxoGroups.entries()) {
      if (llc.callMode !== 'delegatecall') continue;
      if (this.getLowLevelCallMasterInputIndex(llcIndex) !== inputIndex) continue;
      const proxyGroup = this.externalCallUtxoGroups.find((group) => group.delegateCallGroupIndex === llcIndex);
      // A delegate may only repair outputs belonging to the proxy whose state it executes against. Nested
      // delegates advertise that owner through their external proxy group; a top-level delegate executes against
      // this builder's root proxy. Including the implementation category alone either blocks valid root-state
      // repair or, without the same-category gate below, lets a nested implementation overwrite unrelated state.
      repairOwnerCategory = proxyGroup?.categoryId ?? this.categoryId;
      delegateRepairOwnerCategory = repairOwnerCategory;
      associatedCategories.add(repairOwnerCategory);
    }
    const pendingOutputBytecodeIndices = new WeakMap<object, { outputIndex: number; ip: number }>();
    const vm = createVirtualMachineBch2026ForProvider(this.builderOptions.provider, {
      opcodes: new Set([
        Op.OP_OUTPUTBYTECODE, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUAL, Op.OP_EQUALVERIFY,
      ]),
      beforeOperation: (unknownState) => {
        const state = unknownState as {
          ip: number;
          instructions: Array<{ opcode: number; data?: Uint8Array }>;
          stack: Uint8Array[];
          controlStack: boolean[];
        };
        // This observer wraps libauth's conditionallyEvaluate operation, so it is also invoked for instructions
        // in untaken IF branches. Those stack values are not covenant assertions and must never become repairs.
        if (!isActiveVmControlBranch(state.controlStack)) return;
        const opcode = state.instructions[state.ip]?.opcode;
        if (opcode === Op.OP_EQUAL) {
          pendingOutputBytecodeIndices.delete(state.instructions);
          return;
        }
        if (opcode === Op.OP_EQUALVERIFY && state.stack.length >= 2) {
          const pending = pendingOutputBytecodeIndices.get(state.instructions);
          pendingOutputBytecodeIndices.delete(state.instructions);
          const reconstruction = pending === undefined ? []
            : state.instructions.slice(pending.ip + 1, state.ip);
          const reconstructsP2sh32 = reconstruction.some((instruction) => instruction.opcode === Op.OP_HASH256)
            && reconstruction.some((instruction) => binToHex(instruction.data ?? new Uint8Array()) === 'aa20')
            && reconstruction.some((instruction) => binToHex(instruction.data ?? new Uint8Array()) === '87');
          const outputIndex = pending?.outputIndex;
          if (reconstructsP2sh32 && outputIndex !== undefined
            && outputIndex >= 0 && outputIndex < builder.outputs.length
            && isOwnedStateRepairCoordinate({
              inputIndex,
              outputIndex,
              delegateOwnedFixedState: fixedStateSlots.has(outputIndex)
                && delegateRepairOwnerCategory !== undefined
                && builder.outputs[outputIndex]?.token?.category === delegateRepairOwnerCategory,
            })) {
            const output = builder.outputs[outputIndex];
            const currentLock = output.to instanceof Uint8Array
              ? output.to : addressToLockScript(output.to);
            const expected = selectExpectedP2sh32OutputLock(
              currentLock,
              state.stack[state.stack.length - 2],
              state.stack[state.stack.length - 1],
            );
            if (expected) {
              if (binToHex(expected) !== binToHex(currentLock)) {
                lockingBytecodeRepairs.set(outputIndex, expected);
              }
              // A prior identity-conservation pass can leave the now-authenticated state coordinate tokenless.
              // The compiler's immediate mutable-capability guard proves that a token belongs here; seed only its
              // owner/category shell, then let later OUTPUTTOKENCOMMITMENT equality recover the exact payload.
              if (!fixedStateSlots.has(outputIndex)
                && builder.outputs[outputIndex]?.token === undefined
                && repairOwnerCategory !== undefined
                && /^[0-9a-f]{64}$/i.test(repairOwnerCategory)
                && followsMutableNftOutputGuard(state.instructions, state.ip)) {
                mutableTokenShellRepairs.set(outputIndex, {
                  lockingBytecode: expected,
                  categoryId: repairOwnerCategory,
                });
              }
            }
          }
          return;
        }
        if (state.instructions[state.ip]?.opcode === Op.OP_OUTPUTTOKENCOMMITMENT
          && state.stack.length >= 2) {
          // Only the `OTC; EQUALVERIFY` pin names an authenticated output
          // commitment. Later `OTC` operations can feed proofs and hashes;
          // treating those as writes corrupts unrelated value entries.
          const nextOpcode = state.instructions[state.ip + 1]?.opcode;
          if (nextOpcode !== 0x87 && nextOpcode !== 0x88) return;
          const outputIndex = Number(decodeVmScriptNumber(state.stack[state.stack.length - 1]));
          const commitment = state.stack[state.stack.length - 2];
          const output = outputIndex >= 0 && outputIndex < builder.outputs.length
            ? builder.outputs[outputIndex] : undefined;
          const sameCategory = output?.token?.category !== undefined
            && associatedCategories.has(output.token.category);
          const eventSlot = tokenEventSlots.get(outputIndex);
          const isReturnSlot = tokenReturnSlots.has(outputIndex);
          const fixedStateSlot = fixedStateSlots.has(outputIndex);
          // Inferred entries/chunks retain the native 128-byte structural ceiling. An exact OTC equality on
          // physical state lineage may use the larger commitment ceiling explicitly advertised by the provider.
          const maxBytes = output?.token?.nft?.capability === 'none' || fixedStateSlot
            ? (this.builderOptions.provider?.consensusLimits?.maximumNftCommitmentBytes ?? 128)
            : 128;
          const forwardOutputOnlySlot = isForwardOutputOnlyRepairSlot({
            inputIndex,
            outputIndex,
            fixedStateSlot,
          });
          const stateRepairCoordinate = isOwnedStateRepairCoordinate({
            inputIndex,
            outputIndex,
            delegateOwnedFixedState: fixedStateSlot
              && delegateRepairOwnerCategory !== undefined
              && output?.token?.category === delegateRepairOwnerCategory,
          });
          const layoutWitnessSlot = forwardOutputOnlySlot
            && (eventSlot !== undefined || isReturnSlot || delegateEventSlots.has(outputIndex));
          // Structured events are typically wider than a hash, while learned typed events can be short script
          // numbers. At an exact compiler-owned event slot, the output pin itself authenticates even a typed zero.
          const compilerOwnedEventSlot = eventSlot !== undefined || delegateEventSlots.has(outputIndex);
          const realEvent = isAuthenticatedEventRepairCommitment(commitment, compilerOwnedEventSlot);
          const realReturn = isReturnSlot && commitment.length > 0
            && !commitment.every((byte) => byte === 0);
          if (layoutWitnessSlot && !isReturnSlot && realEvent) {
            eventRepairs.set(outputIndex, commitment);
          } else if (layoutWitnessSlot && realReturn) {
            eventRepairs.set(outputIndex, commitment);
          } else if (forwardOutputOnlySlot
            && output?.token?.nft?.capability === 'none' && sameCategory
            && !isScidIdentityCommitment(output.token.nft.commitment)
            && isRepairableNftOutput('none', commitment.length, maxBytes)
            && realEvent) {
            eventRepairs.set(outputIndex, commitment);
          } else if (stateRepairCoordinate
            && sameCategory && !eventSlot && !isReturnSlot
            && !delegateEventSlots.has(outputIndex)
            && commitment.length <= maxBytes && outputIndex >= 0
            && outputIndex < builder.outputs.length
            && !isScidIdentityCommitment(output?.token?.nft?.commitment)) {
            repairs.set(outputIndex, {
              outputIndex, commitment, categoryId: output.token?.category ?? repairOwnerCategory,
            });
          }
          return;
        }
        if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTBYTECODE || state.stack.length < 2) return;
        const outputIndex = Number(decodeVmScriptNumber(state.stack[state.stack.length - 1]));
        pendingOutputBytecodeIndices.set(state.instructions, { outputIndex, ip: state.ip });
        const expectedLockingBytecode = state.stack[state.stack.length - 2];
        const nextOpcode = state.instructions[state.ip + 1]?.opcode;
        const forwardOutputOnlySlot = isForwardOutputOnlyRepairSlot({
          inputIndex,
          outputIndex,
          fixedStateSlot: fixedStateSlots.has(outputIndex),
        });
        const layoutOwnedLock = forwardOutputOnlySlot
          && (tokenEventSlots.has(outputIndex) || tokenReturnSlots.has(outputIndex)
            || delegateEventSlots.has(outputIndex));
        if (nextOpcode === 0x88 && layoutOwnedLock
          && outputIndex >= 0 && outputIndex < builder.outputs.length
          && expectedLockingBytecode.length > 0) {
          const current = builder.outputs[outputIndex];
          const currentLock = current.to instanceof Uint8Array ? current.to : addressToLockScript(current.to);
          if (binToHex(currentLock) !== binToHex(expectedLockingBytecode)) {
            const existing = lockingBytecodeRepairs.get(outputIndex);
            const expectedIsP2sh32 = expectedLockingBytecode.length === 35
              && expectedLockingBytecode[0] === 0xaa && expectedLockingBytecode[1] === 0x20
              && expectedLockingBytecode[34] === 0x87;
            const existingIsP2sh32 = existing?.length === 35 && existing[0] === 0xaa
              && existing[1] === 0x20 && existing[34] === 0x87;
            if (!existing || expectedIsP2sh32 || !existingIsP2sh32) {
              lockingBytecodeRepairs.set(outputIndex, expectedLockingBytecode);
            }
          }
        }
        if (state.stack.length < 4) return;
        const chunkShaped = state.instructions.some((instruction, at) => instruction.data?.length === 1
          && instruction.data[0] === 126 && state.instructions[at + 1]?.opcode === 0x95
          && state.instructions[at + 2]?.data?.length === 1
          && state.instructions[at + 2]?.data?.[0] === 28
          && state.instructions[at + 3]?.opcode === 0x93);
        // Outlined continuation pins use SWAP OUTPUTBYTECODE with uint16||data
        // under the address; their index-arithmetic sequence lives in the caller.
        const outlinedChunkPin = state.instructions[state.ip - 1]?.opcode === 0x7c
          && state.stack[state.stack.length - 2]?.length === 35
          && state.stack[state.stack.length - 2][0] === 0xaa
          && state.stack[state.stack.length - 2][1] === 0x20
          && state.stack[state.stack.length - 2][34] === 0x87
          && state.stack[state.stack.length - 4]?.length >= 3
          && state.stack[state.stack.length - 4]?.length <= 128;
        // Event/return destinations are compiler-owned output claims. Their P2SH32
        // locks and variable-length commitments can resemble an outlined chunk pin,
        // but a computed chunk repair must never change their capability or owner.
        if ((!chunkShaped && !outlinedChunkPin) || layoutOwnedLock) return;
        const lockingBytecode = state.stack[state.stack.length - 2];
        const commitment = state.stack[state.stack.length - 4];
        const output = outputIndex >= 0 && outputIndex < builder.outputs.length
          ? builder.outputs[outputIndex] : undefined;
        const repairCoordinate = isOwnedStateRepairCoordinate({
          inputIndex,
          outputIndex,
          delegateOwnedFixedState: fixedStateSlots.has(outputIndex)
            && delegateRepairOwnerCategory !== undefined
            && output?.token?.category === delegateRepairOwnerCategory,
        });
        if (lockingBytecode.length !== 35 || lockingBytecode[0] !== 0xaa || lockingBytecode[1] !== 0x20
          || lockingBytecode[34] !== 0x87 || commitment.length < 3 || commitment.length > 128
          || !repairCoordinate
          || outputIndex >= builder.outputs.length) return;
        repairs.set(outputIndex, {
          outputIndex, lockingBytecode, commitment,
          categoryId: builder.outputs[outputIndex]?.token?.category ?? repairOwnerCategory,
        });
      },
    });
    const finalState = vm.evaluate({ inputIndex, sourceOutputs, transaction });
    reportRepairTiming('input-evaluated');
    const passed = vm.stateSuccess(finalState) === true;
    // A successful covenant needs no repair. Stack-shape inference can observe values beneath a passing
    // OTC/EQUAL pair which are not the compared commitment; applying those speculative candidates mutates an
    // already-valid transaction and can create a convergence cycle on the next layout reassertion.
    if (passed) {
      return {
        changed: false,
        passed: true,
        repairedOutputs: [],
        repairDetails: [],
      };
    }
    let changed = false;
    const repairedOutputs: number[] = [];
    const repairDetails: Array<{
      outputIndex: number;
      field: 'commitment' | 'lockingBytecode' | 'token';
      previous: string;
      proposed: string;
    }> = [];
    for (const [outputIndex, commitment] of eventRepairs) {
      const compilerOwnedEventSlot = tokenEventSlots.has(outputIndex) || delegateEventSlots.has(outputIndex);
      if (!isAuthenticatedEventRepairCommitment(commitment, compilerOwnedEventSlot)) continue;
      const output = builder.outputs[outputIndex];
      if (!output) continue;
      if (isScidIdentityCommitment(output.token?.nft?.commitment)) continue;
      const hex = binToHex(commitment);
      const eventSlot = tokenEventSlots.get(outputIndex);
      const delegateEventSlot = delegateEventSlots.get(outputIndex);
      const category = eventSlot?.categoryId ?? delegateEventSlot?.categoryId ?? output.token?.category;
      if (!category) continue;
      if (output.token?.nft?.capability === 'none' && output.token.nft.commitment === hex) continue;
      repairDetails.push({
        outputIndex,
        field: 'commitment',
        previous: String(output.token?.nft?.commitment ?? ''),
        proposed: hex,
      });
      output.token = {
        amount: 0n,
        category,
        nft: { capability: 'none', commitment: hex },
      };
      if (eventSlot || delegateEventSlot) {
        const group = eventSlot
          ? this.externalCallUtxoGroups[eventSlot.groupIndex]
          : this.lowLevelCallUtxoGroups[delegateEventSlot!.groupIndex];
        const emits = (group.compilerRoute?.abiFunction ?? group.externalContract.inner.artifact.abi
          .find((fn: { name: string }) => fn.name === (group.logicalFunctionName ?? group.functionName)))?.emits ?? [];
        const eventOrdinal = eventSlot?.eventOrdinal ?? delegateEventSlot!.eventOrdinal;
        const emitInfo = emits[eventOrdinal];
        if (group && emitInfo) {
          const lockingBytecode = scriptToLockingBytecode(
            buildEventNftCovenantScript(
              hexToBin(category), computeEventNameHash(emitInfo.eventSignature),
            ),
            group.externalContract.inner.addressType,
          );
          const learnedEvent = {
            eventSignature: emitInfo.eventSignature,
            commitment: hex,
            lockingBytecode,
          };
          output.to = lockingBytecode;
          const remember = (carrier: ExternalCallUtxoGroup): void => {
            const eventOutputs = carrier.eventOutputs ? [...carrier.eventOutputs] : [];
            eventOutputs[eventOrdinal] = learnedEvent;
            carrier.eventOutputs = eventOutputs;
          };
          remember(group);
          if (delegateEventSlot) {
            // A delegate implementation and its proxy carrier describe the same
            // physical event slot. Final-layout replay visits both carriers, so
            // publish the authenticated observation to both rather than letting
            // one retain a stale precomputed emit value.
            const proxyCarrier = this.externalCallUtxoGroups.find((candidate) => (
              candidate.delegateCallGroupIndex === delegateEventSlot.groupIndex
            ));
            if (proxyCarrier) remember(proxyCarrier);
          }
        }
        this.authenticatedEventOutputs.set(outputIndex, {
          to: output.to instanceof Uint8Array ? output.to.slice() : output.to,
          amount: 1200n,
          token: {
            amount: 0n,
            category,
            nft: { capability: 'none', commitment: hex },
          },
        });
      }
      const returnGroupIndex = tokenReturnSlots.get(outputIndex);
      if (returnGroupIndex !== undefined
        && groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, returnGroupIndex)) {
        const returnGroup = this.externalCallUtxoGroups[returnGroupIndex];
        const identityIndex = returnGroup.fusedReturnGroupIndex ?? returnGroupIndex;
        // Both forms can be seeded for one physical part. Updating both keeps final layout reassertion from
        // restoring a provisional value after the owning covenant has authenticated the computed return.
        this.setReturnEventOutput(category, commitment, `external-call:${identityIndex}`, false);
        this.setReturnEventOutput(category, commitment, `external-call:${identityIndex}:0`, false);
      }
      changed = true;
      repairedOutputs.push(outputIndex);
    }
    for (const found of repairs.values()) {
      const output = builder.outputs[found.outputIndex];
      if (output && !output.token?.nft && found.lockingBytecode
        && canMaterializeRepairedValueChunk({
          fixedStateSlot: fixedStateSlots.has(found.outputIndex),
          currentHasToken: output.token !== undefined,
          currentLockingBytecode: output.to instanceof Uint8Array
            ? output.to : addressToLockScript(output.to),
          proposedLockingBytecode: found.lockingBytecode,
          proposedCommitment: found.commitment,
          categoryId: found.categoryId,
        })) {
        const previousLock = output.to instanceof Uint8Array
          ? output.to : addressToLockScript(output.to);
        const proposedHex = binToHex(found.commitment);
        const materialized: Output = {
          to: found.lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: found.categoryId!,
            nft: { capability: 'mutable', commitment: proposedHex },
          },
        };
        materialized.amount = BigInt(Math.max(1200, calculateDust(materialized)));
        builder.outputs[found.outputIndex] = materialized;
        this.setDerivedChunkOutput(found.outputIndex, {
          commitment: proposedHex,
          lockingBytecode: found.lockingBytecode,
          categoryId: found.categoryId,
        });
        repairDetails.push({
          outputIndex: found.outputIndex,
          field: 'lockingBytecode',
          previous: binToHex(previousLock),
          proposed: binToHex(found.lockingBytecode),
        }, {
          outputIndex: found.outputIndex,
          field: 'commitment',
          previous: '',
          proposed: proposedHex,
        });
        changed = true;
        repairedOutputs.push(found.outputIndex);
        continue;
      }
      if (output?.token?.nft) {
        const proposedHex = binToHex(found.commitment);
        const currentHex = String(output.token.nft.commitment ?? '');
        const outputLockingBytecode = output.to instanceof Uint8Array
          ? output.to : addressToLockScript(output.to);
        const authenticatedDynamicChunkSlot = this.dynamicChunkVars.some((variable) => (
          binToHex(variable.lockingBytecode) === binToHex(outputLockingBytecode)
        ));
        const action = canApplyRepairedNftCommitment({
          capability: output.token.nft.capability,
          currentCommitmentHex: currentHex,
          proposed: found.commitment,
          hasLockingBytecode: found.lockingBytecode !== undefined,
          fixedStateSlot: fixedStateSlots.has(found.outputIndex),
          authenticatedMutableSlot: authenticatedDynamicChunkSlot,
          maximumCommitmentBytes: fixedStateSlots.has(found.outputIndex)
            ? (this.builderOptions.provider?.consensusLimits?.maximumNftCommitmentBytes ?? 128)
            : 128,
        });
        if (action !== 'skip') {
          repairDetails.push({
            outputIndex: found.outputIndex,
            field: 'commitment',
            previous: currentHex,
            proposed: proposedHex,
          });
          if (action === 'apply-lock-and-commit' && found.lockingBytecode !== undefined) {
            output.to = found.lockingBytecode;
          }
          output.token.nft.commitment = proposedHex;
          if (output.token.nft.capability === 'mutable') {
            if (this._setRootStateRawCommitmentAt(
              found.outputIndex, output.token.category ?? '', proposedHex,
            )) {
              // Delegate implementations mutate the root proxy's state block.
              // Preserve the authenticated bytes just like direct root derivation.
            } else if (this._setExternalCallStateRawCommitmentAt(
              found.outputIndex, output.token.category ?? '', proposedHex,
            )) {
              // Fixed participant state is rebuilt before cache replay. Keep its
              // authenticated raw bytes in the state cache, not the entry cache.
            } else if (found.lockingBytecode !== undefined) {
              this.setDerivedChunkOutput(found.outputIndex, {
                commitment: proposedHex,
                lockingBytecode: found.lockingBytecode,
                categoryId: output.token.category,
              });
            } else {
              this.setExternalCallEntryOutputAt(
                found.outputIndex, output.token.category ?? '', proposedHex,
              );
            }
          }
          changed = true;
          repairedOutputs.push(found.outputIndex);
        }
      }
    }
    for (const [outputIndex, shell] of mutableTokenShellRepairs) {
      const output = builder.outputs[outputIndex];
      if (!output || output.token !== undefined) continue;
      const currentLock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
      const proposedCategory = `${shell.categoryId}01`;
      output.to = shell.lockingBytecode;
      output.token = {
        amount: 0n,
        category: shell.categoryId,
        nft: { capability: 'mutable', commitment: '' },
      };
      output.amount = BigInt(Math.max(1200, calculateDust(output)));
      repairDetails.push({
        outputIndex,
        field: 'token',
        previous: '',
        proposed: proposedCategory,
      });
      if (binToHex(currentLock) !== binToHex(shell.lockingBytecode)) {
        lockingBytecodeRepairs.set(outputIndex, shell.lockingBytecode);
      }
      changed = true;
      repairedOutputs.push(outputIndex);
    }
    // Apply direct OUTPUTBYTECODE/EQUALVERIFY observations last. Earlier chunk-shaped observations can refer to
    // the same coordinate while probing a placeholder branch; the enforced equality which actually failed is
    // the authoritative owner of the final locking bytecode.
    for (const [outputIndex, lockingBytecode] of lockingBytecodeRepairs) {
      const current = builder.outputs[outputIndex];
      const currentLock = current.to instanceof Uint8Array ? current.to : addressToLockScript(current.to);
      this.authenticatedOutputLockingBytecodes.set(outputIndex, lockingBytecode.slice());
      if (binToHex(currentLock) !== binToHex(lockingBytecode)) {
        repairDetails.push({
          outputIndex,
          field: 'lockingBytecode',
          previous: binToHex(currentLock),
          proposed: binToHex(lockingBytecode),
        });
        current.to = lockingBytecode;
        // Commitment and locking-bytecode pins can fail on successive VM passes. If the commitment pass first
        // authenticated an event while its coordinate was still a neutral OP_TRUE output, refresh that exact
        // observation now; otherwise final-layout replay restores the stale lock and convergence alternates
        // forever between a passing transaction and the cached placeholder.
        const authenticatedEvent = this.authenticatedEventOutputs.get(outputIndex);
        if (authenticatedEvent) authenticatedEvent.to = lockingBytecode.slice();
        changed = true;
        repairedOutputs.push(outputIndex);
      }
    }
    return {
      changed,
      passed,
      repairedOutputs,
      repairDetails,
    };
  }

  private _strictRecursiveVmPreflight(builder: TransactionBuilder): void {
    const transaction = builder.buildLibauthTransaction(true);
    // X121: read the provider's limits. Unlike the tracer above this THROWS, so it decides ACCEPT/REJECT, and
    // a bare VM here decides against a configuration the provider may not be running.
    //
    // VERSION-DEPENDENT, and the pin is `@mem-cash/validation` 0.0.8 - the version
    // `packages/solidcash/package.json` declares (`^0.0.8`, which for a 0.0.x range means exactly 0.0.8) and
    // `yarn.lock` resolves. At 0.0.8 `TxVerifierConfig.consensus` exists and MockNetworkProvider's overrides
    // reach the decider, so this factory AGREES with it on every shape measured, while a bare VM diverges in
    // BOTH directions: it accepts what the provider refuses under a strict profile (P2PKH and recursion at
    // `operationCostBudgetPerByte: 150`) and refuses what the provider accepts under the relaxed default
    // (`decrement(24)`). The first of those is the fail-open direction, which is why this is not left bare.
    //
    // At 0.0.7 the field does not exist and the overrides are silently dropped, which inverts every one of those
    // verdicts. `X121StrictPreflightDecision` asserts the installed version first so a stale tree fails with
    // that as the reason instead of six opaque assertion failures.
    //
    // `standard` is deliberately left at the factory default of `true` rather than tracked to the provider's
    // `policy.enforceDust`. Standard is the stricter regime, so this keeps the residual error fail-closed. No
    // shape was found where the two regimes give different VERDICTS, so tracking it is not known to be needed.
    // X198. ASK `stateSuccess`, NOT `state.error`. libauth defines `success(state)` as "return `state.error` if
    // there is one, otherwise refuse an empty stack or a non-truthy top item", and `createVirtualMachine` hands
    // that same function to `vm.verify` - so `stateSuccess` IS the VM's verification predicate and `state.error`
    // is only its first branch. The gap matters here because the compiler DELETES the final `require`'s
    // OP_VERIFY when the stack is shallow, so a failing final require leaves a falsy top and raises nothing.
    // The old `if (state.error)` was also a truthiness test where `!== undefined` is meant.
    //
    // Scope: this path is opt-in and default-off, and no hostile was constructed against it. The repair is
    // inferred from field semantics that WERE measured, on the sibling decider in `message-bus/preflight.ts`.
    try {
      assertFinalizedTransactionCovenants(builder, transaction);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(reason.replace(/^messageBus: BCH-2026 preflight failed at /, ''));
    }
  }

  /** Converge authenticated computed outputs against the exact transaction shape submitted to the provider. */
  private _assertConvergedFinalTransaction(
    builder: TransactionBuilder,
    afterRepairs?: () => void,
    beforeValidation?: (
      transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>,
    ) => boolean,
  ): ReturnType<TransactionBuilder['buildLibauthTransaction']> {
    let lastError: unknown;
    let repairsRemaining = 32;
    const debugRepairs = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_REPAIR_CONVERGENCE === '1';
    const debugPreflightTiming = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_PREFLIGHT_TIMING === '1';
    const failFastOnCycle = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_REPAIR_FAIL_FAST === '1';
    const previousRepairs = new Map<string, {
      inputIndex: number;
      previous: string;
      proposed: string;
    }>();
    const sameOutpoint = (left: Utxo | undefined, right: Utxo | undefined): boolean => (
      left !== undefined && right !== undefined
      && left.vout === right.vout && left.txid.toLowerCase() === right.txid.toLowerCase()
    );
    const describeInput = (inputIndex: number): unknown => {
      const input = builder.inputs[inputIndex];
      const owners: unknown[] = [];
      if (sameOutpoint(input, this.masterUtxo)) {
        owners.push({ kind: 'root', categoryId: this.categoryId });
      }
      for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
        if (!sameOutpoint(input, group.masterUtxo)) continue;
        owners.push({
          kind: 'externalCall',
          groupIndex,
          contract: group.externalContract?.inner?.artifact?.contractName,
          function: group.functionName,
          logicalFunction: group.logicalFunctionName,
          callMode: group.callMode,
          delegateCallGroupIndex: group.delegateCallGroupIndex,
          sharedGroupIndex: group.sharedGroupIndex,
        });
      }
      for (const [groupIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
        if (!sameOutpoint(input, group.masterUtxo)) continue;
        owners.push({
          kind: 'lowLevelCall',
          groupIndex,
          contract: group.externalContract?.inner?.artifact?.contractName,
          function: group.functionName,
          logicalFunction: group.logicalFunctionName,
          routeFunction: group.compilerRoute?.abiFunction.name,
          callMode: group.callMode,
        });
      }
      return {
        categoryId: input?.token?.category,
        owners,
      };
    };
    let cycleDetected = false;
    for (let sweep = 0; sweep <= 32; sweep++) {
      const transaction = builder.buildLibauthTransaction(true);
      if (beforeValidation?.(transaction)) continue;
      try {
        assertFinalizedTransactionCovenants(builder, transaction);
        return transaction;
      } catch (error) {
        lastError = error;
        const reason = error instanceof Error ? error.message : String(error);
        const failedInput = reason.match(/input(?: index)? (\d+)/)?.[1];
        if (failedInput === undefined) break;
        const inputIndex = Number(failedInput);
        let changed = false;
        while (repairsRemaining > 0) {
          const repairStartedAt = debugPreflightTiming ? Date.now() : 0;
          const result = this._repairComputedChunkOutput(builder, inputIndex);
          const reportConvergenceTiming = (stage: string): void => {
            if (debugPreflightTiming) console.error('repair-convergence-timing', {
              sweep, inputIndex, stage, ms: Date.now() - repairStartedAt,
              changed: result.changed, passed: result.passed,
              repairedOutputs: result.repairedOutputs.length,
            });
          };
          reportConvergenceTiming('repair-complete');
          if (debugRepairs) console.error('repair-convergence', JSON.stringify({
            sweep,
            inputIndex,
            repairsRemaining,
            changed: result.changed,
            passed: result.passed,
            outputs: result.repairedOutputs,
            repairs: result.repairDetails.map((repair) => ({
              ...repair,
              previous: repair.previous.slice(0, 48),
              proposed: repair.proposed.slice(0, 48),
              previousLength: repair.previous.length / 2,
              proposedLength: repair.proposed.length / 2,
              firstDifference: Array.from({ length: Math.max(repair.previous.length, repair.proposed.length) })
                .findIndex((_unused, index) => repair.previous[index] !== repair.proposed[index]),
              previousFull: repair.previous,
              proposedFull: repair.proposed,
              previousTail: repair.previous.slice(-48),
              proposedTail: repair.proposed.slice(-48),
            })),
            input: describeInput(inputIndex),
          }));
          for (const repair of result.repairDetails) {
            const coordinate = `${repair.outputIndex}:${repair.field}`;
            const prior = previousRepairs.get(coordinate);
            if (prior !== undefined
              && prior.previous === repair.proposed && prior.proposed === repair.previous) {
              if (debugRepairs) console.error('repair-cycle', {
                coordinate,
                first: { ...prior, input: describeInput(prior.inputIndex) },
                second: {
                  inputIndex,
                  previous: repair.previous,
                  proposed: repair.proposed,
                  input: describeInput(inputIndex),
                },
              });
              cycleDetected = true;
            }
            previousRepairs.set(coordinate, {
              inputIndex,
              previous: repair.previous,
              proposed: repair.proposed,
            });
          }
          if (cycleDetected && failFastOnCycle) break;
          if (!result.changed) break;
          changed = true;
          repairsRemaining -= 1;
          stripRelocatedMutableDuplicates(
            builder.outputs,
            this.allInputs,
            0,
            this._compilerOwnedTrailingEntryOutputIndices(),
          );
          reportConvergenceTiming('duplicates-stripped');
          // Computed-output recovery observes one failing participant at a time.
          // A repair for an earlier participant may therefore write through a
          // coordinate owned by a later participant's compiler-declared entry
          // slot. Reassert the complete transaction layout before evaluating the
          // next input, while retaining any newly computed commitment bytes.
          this._restoreDeclaredMutableEntrySlots(builder);
          reportConvergenceTiming('entry-slots-restored');
          // A computed-output repair may rediscover a pre-write dynamic chunk at
          // its old coordinate. The compiler-owned suffix is the complete new
          // collection, so reapply that ownership invariant after every repair.
          this._clearSupersededDelegateDynamicCollectionOutputs(builder);
          reportConvergenceTiming('delegate-collections-cleared');
          this._clearUnclaimedConditionalEventSlots(builder);
          reportConvergenceTiming('conditional-events-cleared');
          if (result.passed) break;
        }
        if (changed) {
          afterRepairs?.();
          if (this.resultDependentArgumentRefresher?.(builder)) {
            const refreshedCarriers = [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]
              .filter((carrier) => carrier.argumentsRefreshedDuringConvergence === true);
            this._syncRefreshedCarrierMasters(
              builder,
              refreshedCarriers,
            );
            for (const carrier of refreshedCarriers) {
              carrier.argumentsRefreshedDuringConvergence = false;
            }
          }
        }
        if (cycleDetected && failFastOnCycle) break;
        if (!changed) break;
      }
    }
    if (lastError !== undefined) {
      this._logCovenantFailureTrace(
        builder, lastError instanceof Error ? lastError.message : String(lastError),
      );
    }
    throw lastError;
  }

  async send(): Promise<TransactionDetails> {
    const provider = this.builderOptions.provider;
    if (!provider) {
      throw new Error('No network provider available');
    }
    const sendTimingEnabled = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_BUILDER_TIMING === '1';
    const sendStartedAt = Date.now();
    let sendLastTimingAt = sendStartedAt;
    const sendTiming = (stage: string): void => {
      if (!sendTimingEnabled) return;
      const now = Date.now();
      console.error('send-timing', {
        stage,
        deltaMs: now - sendLastTimingAt,
        totalMs: now - sendStartedAt,
      });
      sendLastTimingAt = now;
    };


    // -- Phase 1: build the covenant transaction (logic only, no fee) --
    let covenantBuilder = this.build();
    sendTiming('initial-build');
    // Production-sized covenants are cheap enough to debug eagerly, which provides useful source-mapped
    // diagnostics before submission. A relaxed mock provider may intentionally admit scripts hundreds of
    // kilobytes long; retaining every VM step for those scripts can take minutes and gigabytes of memory.
    const relaxedConsensus = (provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000;
    // Retained so a later covenant refusal can say WHY. This probe is best-effort, but the rebuild below depends
    // on what it discovers, so when it fails the transaction can be assembled from an unresolved shape and the
    // preflight then refuses it with a bare OP_VERIFY that names no cause.
    let discoveryProbeFailure: string | undefined;
    if (!relaxedConsensus) {
      try { covenantBuilder.debug(); } catch (_e) {
        if (typeof _e === 'object' && _e) {
          discoveryProbeFailure = (_e as Error).message;
          // Consensus-limit refusals cannot be repaired by the final signature and must not be swallowed as a
          // best-effort discovery failure. Fail immediately with the actionable density-reserve guidance.
          if (/exceed the operation cost density limit/.test(discoveryProbeFailure)) {
            throw new Error(
              'BCH-2026 operation-cost budget exceeded while probing the covenant, so the transaction cannot '
              + 'be built. The budget is operationCostBudgetPerByte x unlockingBytecodeLength, and for p2sh32 '
              + 'the redeem script counts toward that length, so reserving script bytes (Contract `salt`) '
              + `raises it. Probe reported: ${discoveryProbeFailure}`,
              { cause: _e },
            );
          }
          console.debug('STB debug() best-effort error:', discoveryProbeFailure);
        }
      }
    }

    // The debug probe can discover commitments and output counts for dynamic vmap inserts/chunks. Rebuild before
    // measuring and funding so the fee calculation sees the converged covenant shape rather than the smaller
    // pre-probe transaction. Otherwise a newly learned entry output is added only by the final build, leaving its
    // dust value unfunded (for example: 2400 sats in, 3600 sats out for the first mapping insertion).
    covenantBuilder = this.build();
    sendTiming('post-discovery-build');

    // -- Phase 2: measure shape -> compute fee -> fund --
    // Build the covenant-only tx to measure its byte size.
    const covenantTx = covenantBuilder.buildLibauthTransaction();
    const covenantSize = BigInt(encodeTransaction(covenantTx).byteLength);

    // Estimate the overhead of adding 1 fee input + 1 change output.
    // Fee input: 32 (txid) + 4 (vout) + 1 (scriptLen varint) + unlockingScript + 4 (sequence)
    // For P2SH32 OP_TRUE: unlocking = 2 bytes -> input overhead = 32+4+1+2+4 = 43
    // For P2PKH sig: unlocking ~ 107 bytes -> input overhead = 32+4+1+107+4 = 148
    // Change output: 8 (value) + 1 (scriptLen varint) + scriptLen
    const funderUnlockSize = this.funderUtxos.length > 0
      // A native P2PKH funder (msg.sender / tx.origin sender input) signs over the source outputs, which are not
      // assembled yet at this fee-estimation point, so use the fixed sig+pubkey size (~107 B) instead of signing.
      ? (isP2PKHUnlocker(this.funderUtxos[0].unlocker)
        ? 107
        : this.funderUtxos[0].unlocker.generateUnlockingBytecode(
          { transaction: covenantTx, sourceOutputs: [], inputIndex: 0 },
        ).length)
      : 2; // P2SH32 OP_TRUE default for mocknet
    const feeInputOverhead = 32 + 4 + 1 + funderUnlockSize + 4;
    const changeLockingSize = this.funderChangeAddress?.length ?? 35; // P2SH32 default
    const changeOutputOverhead = 8 + (changeLockingSize < 253 ? 1 : 3) + changeLockingSize;

    // With late chunks, build() already includes the terminal sidecar recreation (or OP_RETURN anchor). Without
    // late chunks, the sidecar recreation is still appended below and must be included in the estimate.
    const sidecarOutputOverhead = this.sidecarUtxo && this.lateValueChunkOutputs.length === 0 ? 50n : 0n;
    const totalEstimatedSize = covenantSize + BigInt(feeInputOverhead) + BigInt(changeOutputOverhead)
      + sidecarOutputOverhead;
    // The first pass estimates P2PKH signatures before source outputs exist. DER lengths can grow when the final
    // transaction is signed, so reserve a small byte margin rather than creating an exact-dust funder that cannot
    // cover the final one-to-few-byte serialization delta.
    const neededFee = this.computeMinFee(totalEstimatedSize + 32n);
    sendTiming('fee-measured');

    // Create a fee funder if the covenant transaction doesn't already cover
    // the minimum relay fee. Block-layout funders pass through to outputs
    // (input.satoshis -> output.amount), so any surplus they contribute is
    // incidental. A dedicated fee funder ensures the fee is always covered.
    // P2SH32 OP_TRUE funder; its change output uses the same script, so the dust threshold is exact.
    const DUMMY_LBC = new Uint8Array([
      0xaa, 0x20,
      0x95, 0x3c, 0xcf, 0xa5, 0x96, 0xa6, 0xc6, 0xd3, 0x9e, 0x59, 0x80, 0x19, 0x45, 0x39, 0x12, 0x4f,
      0xdc, 0xff, 0x11, 0x6a, 0x57, 0x14, 0x55, 0xa2, 0x12, 0xba, 0xed, 0x81, 0x1f, 0x58, 0x5e, 0xe0,
      0x87,
    ]);
    const DUMMY_UNLOCK = new Uint8Array([0x01, 0x51]);
    const DUST_MINIMUM = getDustThreshold({ lockingBytecode: DUMMY_LBC });

    // Check whether existing inputs already cover the fee
    const existingInputSats = this.allInputs.reduce((sum, inp) => sum + inp.satoshis, 0n);
    const existingOutputSats = covenantBuilder.outputs.reduce((sum, o) => sum + o.amount, 0n);
    const existingFee = existingInputSats - existingOutputSats;
    const alreadyFunded = existingFee >= neededFee;

    if (!alreadyFunded && this._checkMinRelayFee) {
      // When covenant outputs exceed covenant inputs (e.g. return event outputs
      // adding 800 sats each without corresponding inputs), the funder must cover
      // the deficit in addition to the fee and change dust.
      const outputDeficit = existingFee < 0n ? -existingFee : 0n;
      const funderSats = neededFee + DUST_MINIMUM + outputDeficit; // fee + change + deficit
      const dummyTxid = '00'.repeat(31) + 'fe';
      const dummyUtxo = { txid: dummyTxid, vout: 0, satoshis: funderSats };

      // Register with mocknet provider
      if ((provider as any).addUtxo) {
        await (provider as any).addUtxo(binToHex(DUMMY_LBC), dummyUtxo);
        const funder: UnlockableUtxo = {
          ...dummyUtxo,
          unlocker: {
            generateLockingBytecode: () => DUMMY_LBC,
            generateUnlockingBytecode: () => DUMMY_UNLOCK,
          },
        };
        this.funderUtxos.push(funder);
        this.allInputs.push(funder);
        this.funderChangeAddress = DUMMY_LBC;
      }
    }

    // -- Phase 3: rebuild with fee funder + change output, then send --
    // The funder input and change output go past the covenant's block range.
    // The compiler uses blockSize (not OP_TXOUTPUTCOUNT) for bounds checks,
    // so extra outputs don't affect covenant introspection.
    const finalBuilder = this.build();
    sendTiming('final-build');
    this._syncBuilderUnlockers(finalBuilder);
    this._clearUnclaimedConditionalEventSlots(finalBuilder);
    reassertScidIdentityOutputs(
      finalBuilder.outputs, this.allInputs, this._scidReservedIndices(finalBuilder.outputs.length),
    );
    this._reassertNestedEmitEvents(finalBuilder);
    this._reassertDelegateImplEvents(finalBuilder);
    this._placeTailReturnAfterSwappedTokenBlock(finalBuilder);
    this._materializeJobEventsBand(finalBuilder);
    this._reassertScaledPreserveOneToOnes(finalBuilder);
    this._reassertNestedEmitEvents(finalBuilder);
    this._reassertDelegateImplEvents(finalBuilder);
    if (isPersistedJobEventsReady()) {
      this._reassertPersistedJobEventsOneToOnes(
        finalBuilder, this._scaledEmitOutputIndex(finalBuilder.outputs.length) ?? -1,
      );
    }
    this._reassertDelegateImplEvents(finalBuilder);
    this._reassertMintingOneToOne(finalBuilder);
    this._reassertFixedStateOutputs(finalBuilder);
    if (isPersistedJobEventsReady()) {
      this._reassertPersistedJobEventsOneToOnes(
        finalBuilder, this._scaledEmitOutputIndex(finalBuilder.outputs.length) ?? -1,
      );
    }
    this._reassertDelegateImplEvents(finalBuilder);
    this._restoreSwappedTokenFunderSlots(finalBuilder);

    if (this.funderUtxos.length > 0) {
      // Funders supplied at construction (auto-derivation) may lack an explicit change address;
      // default change to the funder's own script so over-sized funders don't bloat the fee.
      const changeTo = this.funderChangeAddress
        ?? this.funderUtxos[0].unlocker.generateLockingBytecode();
      const funderOutpoints = new Set(this.funderUtxos.map((f) => `${f.txid}:${f.vout}`));
      const actualFunderInputs = this.allInputs.filter((input) => (
        funderOutpoints.has(`${input.txid}:${input.vout}`)
      ));
      // A configured block-layout funder can be displaced by a covenant input at the same physical offset.
      // Only inputs that are actually serialized may contribute to change; counting the configured pool would
      // create value whenever a slot is occupied by a delegate/data input.
      const funderTotal = actualFunderInputs.reduce((sum, input) => sum + input.satoshis, 0n);
      const covenantInputTotal = this.allInputs
        .filter((input) => !funderOutpoints.has(`${input.txid}:${input.vout}`))
        .reduce((sum, input) => sum + input.satoshis, 0n);
      const covenantOutputTotal = finalBuilder.outputs.reduce((sum, o) => sum + o.amount, 0n);
      const available = funderTotal - (covenantOutputTotal - covenantInputTotal);
      const changeAmount = available - neededFee;

      if (changeAmount >= DUST_MINIMUM) {
        const changeOutput = { to: changeTo, amount: changeAmount };
        // Keep [late chunks][one terminal suffix] contiguous at the end. The compiler authenticates chunk i by
        // counting backward from OP_TXOUTPUTCOUNT, so fee change must precede the entire suffix region.
        this.insertBeforeLateValueSuffix(finalBuilder, changeOutput, { rebindAbsoluteWitnesses: true });
      }
    }

    // Recreate the side-car as the LAST output (its self-preservation verifies the last output).
    // With late chunks it was already emitted by build() as their single terminal suffix.
    if (this.sidecarUtxo && this.lateValueChunkOutputs.length === 0
      && !(this.delegateDynamicChunksAtSuffix && this._dynamicChunkOutputCount() > 0)) {
      finalBuilder.addOutput({
        to: this.sidecarUtxo.unlocker.generateLockingBytecode(),
        amount: this.sidecarUtxo.satoshis,
      });
    }

    if (this.strictVmPreflight) {
      try {
        this._strictRecursiveVmPreflight(finalBuilder);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Recursive state invocation failed concrete BCH VM preflight: ${reason}`);
      }
    }

    // Rebind witnesses while planned tails still name the jobEvents band, then
    // write the OP_TRUE none-cap tails onto disposable pads.
    const reboundViews = this._repackViewTailsAfterMaterialization(finalBuilder);
    if (reboundViews) {
      this._refreshInputs();
      this._syncBuilderUnlockers(finalBuilder);
    }
    this._placeTailReturnAfterSwappedTokenBlock(finalBuilder);
    if (reboundViews) this._applyDerivedValueChunks(finalBuilder);
    this._materializeJobEventsBand(finalBuilder);
    this._ensureLiveJobEventsBand(finalBuilder);
    if (isPersistedJobEventsReady()) {
      this._reassertPersistedJobEventsOneToOnes(
        finalBuilder, this._scaledEmitOutputIndex(finalBuilder.outputs.length) ?? -1,
      );
    }
    this._reassertDelegateImplEvents(finalBuilder);
    this._reassertNestedEmitEvents(finalBuilder);
    this._reassertDelegateImplEvents(finalBuilder);
    this._reassertScaledPreserveOneToOnes(finalBuilder);
    this._reassertNestedEmitEvents(finalBuilder);
    this._reassertDelegateImplEvents(finalBuilder);
    this._reassertFixedStateOutputs(finalBuilder);
    if (isPersistedJobEventsReady()) {
      this._reassertPersistedJobEventsOneToOnes(
        finalBuilder, this._scaledEmitOutputIndex(finalBuilder.outputs.length) ?? -1,
      );
    }
    this._reassertDelegateImplEvents(finalBuilder);
    this._restoreDeclaredMutableEntrySlots(finalBuilder);
    // A complete dynamic write supersedes any old collection chunk that also
    // occupied a declared entry coordinate. Apply this after entry restoration.
    this._clearSupersededDelegateDynamicCollectionOutputs(finalBuilder);

    // Nested event/data repair can replay a mutable that was displaced while a
    // writer's return slot was still unresolved. Normalize once after every
    // authoritative materializer, immediately before covenant convergence.
    stripRelocatedMutableDuplicates(
      finalBuilder.outputs,
      this.allInputs,
      0,
      this._compilerOwnedTrailingEntryOutputIndices(),
    );

    // Materialization and computed-output repair can replace provisional
    // funder pass-through outputs with lower-valued covenant outputs. Fold the
    // exposed surplus into one existing output owned by the configured funder,
    // preserving every physical index. If none survives, create suffix-safe
    // change. Running this after every repair makes fee balance part of the same
    // fixed-point loop as authenticated output convergence.
    const rebalanceFunderSurplus = (): void => {
      if (this.funderUtxos.length === 0) return;
      const inputSats = finalBuilder.inputs.reduce((sum, input) => sum + input.satoshis, 0n);
      const outputSats = finalBuilder.outputs.reduce((sum, output) => sum + output.amount, 0n);
      const surplus = inputSats - outputSats - neededFee;
      if (surplus < DUST_MINIMUM) return;
      const changeTo = this.funderChangeAddress
        ?? this.funderUtxos[0].unlocker.generateLockingBytecode();
      const changeLock = binToHex(changeTo);
      const changeIndex = finalBuilder.outputs.findLastIndex((output) => (
        !output.token
        && output.to instanceof Uint8Array
        && binToHex(output.to) === changeLock
      ));
      if (changeIndex >= 0) {
        const current = finalBuilder.outputs[changeIndex];
        finalBuilder.outputs[changeIndex] = {
          ...current,
          amount: (current.amount ?? 0n) + surplus,
        };
      } else {
        this.insertBeforeLateValueSuffix(
          finalBuilder,
          { to: changeTo, amount: surplus },
          { rebindAbsoluteWitnesses: true },
        );
      }
    };
    // Output ownership is finalized only after the event, dynamic-state, and
    // fixed-state materializers above. Some of those repairs legitimately
    // replace provisional pads which may have carried a consumed logical
    // identity earlier in build(). Reapply the protocol-wide conservation
    // rule at this fixed-point boundary, then rebalance any value exposed by
    // selecting a different disposable output.
    const reassertFinalConservation = (): void => {
      // A trace-learned event replaces an output-only funding cell and owns
      // both its token shape and its bounded satoshi value. Re-materialize the
      // complete event output here so it cannot inherit the displaced funder's
      // value. Input-bearing owners at overlapping coordinates are restored by
      // the conservation passes below.
      this._applyLearnedWriterEvents(finalBuilder);
      this._reassertAuthenticatedEventOutputs(finalBuilder);
      this._clearUnclaimedConditionalEventSlots(finalBuilder);
      this._stripSurplusDerivedValueChunkLocks(finalBuilder);
      // Read-only iteration chunks authenticate output[INPUTINDEX] exactly. Output-only event/dynamic-band
      // materializers may relocate those twins, but they cannot consume or rewrite them.
      reassertReadOnlyMutableOneToOnes(
        finalBuilder.outputs, finalBuilder.inputs, this.iterationEntryInputs,
      );
      // Delegate-event deduplication can demote a provisional clone at the
      // same physical coordinate as a later participant's master. A consumed
      // minting NFT is an input-bearing owner of that coordinate, so it wins
      // over any output-only placeholder regardless of call topology.
      this._reassertMintingOneToOne(finalBuilder);
      reassertScidIdentityOutputs(
        finalBuilder.outputs,
        finalBuilder.inputs,
        this._scidReservedIndices(finalBuilder.outputs.length),
      );
      // In-block return slots are output-only covenant resources, so they must
      // be restored after every input-bearing owner has claimed its coordinate.
      // Doing this before balancing also lets any displaced output participate
      // in the final satoshi-conservation pass.
      this._reassertInBlockWriterReturns(finalBuilder);
      rebalanceFunderSurplus();
    };
    const reassertFinalLayout = (): void => {
      this._reconcileMaterializedValueChunkWitnesses(finalBuilder);
      this._reconcileMaterializedInputWitnesses(finalBuilder);
      this._reconcileMaterializedPredOutWitnesses(finalBuilder);
      this._reassertMaterializedBatchPredecessorOutputs(finalBuilder);
      reassertFinalConservation();
      this._reconcileMaterializedReturnWitnesses(finalBuilder);
      this._constrainParticipantImmutableOutputs(finalBuilder);
    };
    reassertFinalLayout();
    sendTiming('final-materialization');
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
      console.error('preflight-return-outputs', finalBuilder.outputs.flatMap((output, index) => (
        isViewReturnTailOutput(output) ? [{
          index,
          category: output.token?.category.slice(0, 16),
          commitment: String(output.token?.nft?.commitment ?? ''),
        }] : []
      )));
      console.error('preflight-built-return-indices', this.externalCallUtxoGroups.map((group, index) => ({
        index,
        functionName: group.logicalFunctionName ?? group.functionName,
        assigned: group.returnOutputIndex,
        built: this.getBuiltExternalCallReturnEventOutputIndex(index),
      })));
    }

    // -- Phase 4: fee finalization and exact covenant validation --
    // Fee accounting must use the inputs which produce the finalized transaction.
    // `allInputs` is the logical candidate set and can retain a funder or
    // participant displaced by fixed block assembly; counting that stale input
    // reports a fictitious surplus even though it is absent from the bytes.
    const totalInputSats = finalBuilder.inputs.reduce((sum, input) => sum + input.satoshis, 0n);
    const findChangeIndex = (requiredReduction: bigint): number | undefined => [...finalBuilder.outputs]
      .map((output, index) => ({ output, index }))
      .reverse()
      .find(({ output }) => {
        const lock = output.to instanceof Uint8Array ? output.to : undefined;
        return !!lock && lock.length === 25 && lock[0] === 0x76 && lock[1] === 0xa9
          && !output.token
          && (output.amount ?? 0n) >= requiredReduction + BigInt(calculateDust(output));
      })?.index;
    const finalizeFeeBeforeValidation = (
      transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>,
    ): boolean => {
      const totalOutputSats = transaction.outputs
        .reduce((sum, output) => sum + output.valueSatoshis, 0n);
      const fee = totalInputSats - totalOutputSats;
      const txSize = BigInt(encodeTransaction(transaction).byteLength);
      const minFee = this._checkMinRelayFee ? this.computeMinFee(txSize) : 0n;
      const requiredFee = minFee;
      if (fee >= requiredFee) return false;
      // Re-signing after a change-output adjustment can move a DER signature across a one-byte length boundary.
      // When adjustment is necessary, take a small serialization margin; transactions already at
      // the relay minimum remain untouched, including those whose only remaining change is protected dust.
      const reduction = requiredFee - fee + (this._checkMinRelayFee ? 2n : 0n);
      const changeIndex = findChangeIndex(reduction);
      if (changeIndex === undefined) {
        if (fee < 0n) {
          throw new Error(
            `Transaction outputs (${totalOutputSats} sats) exceed inputs (${totalInputSats} sats). `
            + 'This transaction is invalid. Add more funding inputs or reduce outputs.',
          );
        }
        const fpb = Number(minFee) / Number(txSize);
        throw new Error(
          `Transaction fee of ${fee} satoshis is below the minimum relay fee `
          + `(${minFee} satoshis for a ${txSize}-byte transaction at ${fpb.toFixed(1)} sat/byte). `
          + 'Add more funding inputs or reduce outputs.',
        );
      }
      const current = finalBuilder.outputs[changeIndex];
      finalBuilder.outputs[changeIndex] = { ...current, amount: (current.amount ?? 0n) - reduction };
      return true;
    };

    // Validate the exact transaction which will be serialized. Fee adjustment runs before each validation
    // attempt, including after computed-output repairs, so the successful VM receipt remains bound to the exact
    // transaction object submitted to the provider. Token conservation depends only on input/output assets.
    finalBuilder.validateTokenConservation();
    const finalizedTransaction = this._assertConvergedFinalTransaction(
      finalBuilder,
      reassertFinalLayout,
      finalizeFeeBeforeValidation,
    );
    sendTiming('covenants-converged');

    const rawTxBin = encodeTransaction(finalizedTransaction);
    const rawTx = binToHex(rawTxBin);
    sendTiming('serialized');

    const { decodeTransactionUnsafe, hash256 } = await import('@bitauth/libauth');
    const decodedTx = finalizedTransaction;
    const totalOutputSats = decodedTx.outputs.reduce((sum, output) => sum + output.valueSatoshis, 0n);
    const fee = totalInputSats - totalOutputSats;
    const txSize = BigInt(rawTxBin.byteLength);

    if (this._maximumFeeSatoshis !== undefined && fee > this._maximumFeeSatoshis) {
      throw new Error(
        `Transaction fee of ${fee} satoshis exceeds the maximum fee cap of ${this._maximumFeeSatoshis} satoshis. `
        + 'Use .withMaxFee() to increase the cap, or reduce the fee.',
      );
    }

    const MAX_FEE_SATS_PER_BYTE = 1000;
    const feePerByte = Number(fee) / Number(txSize);
    if (feePerByte > MAX_FEE_SATS_PER_BYTE) {
      throw new Error(
        `Transaction fee of ${fee} satoshis is ${feePerByte.toFixed(1)} sat/byte, `
        + `exceeding the safety cap of ${MAX_FEE_SATS_PER_BYTE} sat/byte. `
        + 'This may indicate a missing change output. Use .withMaxFee() to override.',
      );
    }

    // Byte rules LAST, immediately before the network sees the bytes, and reading the DECODED broadcast bytes
    // rather than a re-derived shape. A correctness aid, not a security boundary: it refuses at
    // witness-construction time a transaction whose bytes a node would refuse anyway, so the composer learns
    // the arithmetic here instead of reading `64: dust` off a peer. Ordered after the fee checks so a missing
    // change output still reports as a fee problem rather than as whichever relay observation is also true.
    // X158: the same input subjects as site 2, read off the builder that produced these exact bytes, so an
    // over-limit refusal names the contract rather than only an index.
    assertFinalizedTransactionBytes(decodedTx, {
      ...finalizedByteGateOptionsForProvider(provider),
      inputSubjects: inputSubjectsOfBuilder(finalBuilder),
    });
    sendTiming('bytes-validated');

    // -- Phase 5: submit --
    const debugRepairConvergence = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_REPAIR_CONVERGENCE === '1';
    const rootDynamicLocks = new Set(this.dynamicChunkVars.map((variable) => (
      binToHex(variable.lockingBytecode)
    )));
    const submittedDynamicChunks = debugRepairConvergence
      ? finalBuilder.outputs.flatMap((output, index) => {
        const commitment = String(output.token?.nft?.commitment ?? '');
        const lockingBytecode = output.to instanceof Uint8Array
          ? output.to : addressToLockScript(output.to);
        if (!rootDynamicLocks.has(binToHex(lockingBytecode))) return [];
        return [{
          index,
          lockingBytecode: binToHex(lockingBytecode),
          category: output.token?.category,
          commitment,
        }];
      }) : [];
    if (debugRepairConvergence) console.error(
      'submit-dynamic-chunks', JSON.stringify(submittedDynamicChunks),
    );
    if (debugRepairConvergence) console.error('submit-call-groups', JSON.stringify({
      external: this.externalCallUtxoGroups.map((group, index) => ({
        index,
        functionName: group.functionName,
        logicalFunctionName: group.logicalFunctionName,
        logicalFunctionArgs: group.logicalFunctionArgs,
        sharedGroupIndex: group.sharedGroupIndex,
        delegateCallGroupIndex: group.delegateCallGroupIndex,
        route: group.compilerRoute?.abiFunction.name,
        rows: group.compilerRoute?.rowArguments?.map((row) => ({
          functionName: row.handler.name,
          args: row.args,
        })),
      })),
      lowLevel: this.lowLevelCallUtxoGroups.map((group, index) => ({
        index,
        functionName: group.functionName,
        logicalFunctionName: group.logicalFunctionName,
        functionArgs: group.functionArgs,
        route: group.compilerRoute?.abiFunction.name,
        rows: group.compilerRoute?.rowArguments?.map((row) => ({
          functionName: row.handler.name,
          args: row.args,
        })),
      })),
    }, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
      const lockOf = (value: Uint8Array | string | undefined): string => {
        if (!value) return '';
        return typeof value === 'string' ? binToHex(addressToLockScript(value)) : binToHex(value);
      };
      const scidInputs = this.allInputs.map((input, index) => ({ input, index }))
        .filter(({ input }) => isScidIdentityCommitment(input.token?.nft?.commitment));
      const identityLocks = new Set(scidInputs.map(({ input }) => (
        'unlocker' in input && input.unlocker
          ? binToHex(input.unlocker.generateLockingBytecode()) : ''
      )));
      console.error('submit-outputs-8-40', finalBuilder.outputs.slice(8, 41).map((output, offset) => ({
        index: 8 + offset,
        lock: lockOf(output.to).slice(0, 20),
        cap: output.token?.nft?.capability ?? 'plain',
        commit: String(output.token?.nft?.commitment ?? '').slice(0, 24),
      })));
      console.error('submit-return-outputs', finalBuilder.outputs.flatMap((output, index) => (
        isViewReturnTailOutput(output) ? [{
          index,
          category: output.token?.category.slice(0, 16),
          commitment: String(output.token?.nft?.commitment ?? ''),
        }] : []
      )));
      console.error('submit-inputs-10-16', finalBuilder.inputs.slice(10, 17).map((input, offset) => ({
        index: 10 + offset,
        name: (input.unlocker as { abiFunction?: { name?: string } } | undefined)?.abiFunction?.name
          ?? (input.unlocker as { contract?: { artifact?: { contractName?: string } } } | undefined)
            ?.contract?.artifact?.contractName,
        cap: input.token?.nft?.capability ?? 'plain',
        commit: String(input.token?.nft?.commitment ?? '').slice(0, 24),
        lock: 'unlocker' in input && input.unlocker
          ? binToHex(input.unlocker.generateLockingBytecode()).slice(0, 20) : '',
      })));
      console.error('scid-submit', {
        scidInputs: scidInputs.map(({ input, index }) => ({
          index,
          outpoint: `${input.txid}:${input.vout}`,
          commitment: input.token?.nft?.commitment?.slice(0, 24),
          lock: 'unlocker' in input && input.unlocker
            ? binToHex(input.unlocker.generateLockingBytecode()).slice(0, 20) : '',
        })),
        identityOutputs: finalBuilder.outputs.map((output, index) => ({ output, index }))
          .filter(({ output }) => isScidIdentityCommitment(output.token?.nft?.commitment)
            || identityLocks.has(lockOf(output.to)))
          .map(({ output, index }) => ({
            index,
            lock: lockOf(output.to).slice(0, 20),
            capability: output.token?.nft?.capability ?? 'plain',
            commitment: (output.token?.nft?.commitment ?? '').slice(0, 24),
          })),
      });
    }
    let txid: string;
    try {
      txid = provider.sendPreparedTransaction
        ? await provider.sendPreparedTransaction({
          rawHex: rawTx,
          rawBytes: rawTxBin,
          transaction: decodedTx,
        })
        : await provider.sendRawTransaction(rawTx);
      sendTiming('provider-accepted');
      if (debugRepairConvergence) {
        const locks = [...new Set(submittedDynamicChunks.map((chunk) => chunk.lockingBytecode))];
        console.error('accepted-dynamic-chunks', JSON.stringify(await Promise.all(locks.map(async (lock) => ({
          lockingBytecode: lock,
          utxos: (await provider.getUtxosForLockingBytecode(hexToBin(lock))).map((utxo) => ({
            txid: utxo.txid,
            vout: utxo.vout,
            category: utxo.token?.category,
            commitment: utxo.token?.nft?.commitment,
          })),
        })))));
      }
    } catch (submitErr) {
      // On a covenant script failure, emit an accurate op-level trace of the actual submitted tx using the
      // 2026 VM (the one mocknet uses). The source-map best-effort above mis-attributes on optimised
      // subroutine bytecode; this points at the exact failing opcode + stack. Diagnostic only - rethrow as-is.
      const reason = (submitErr as Error)?.message ?? '';
      if (/script-verify|OP_[A-Z]|evaluating input/.test(reason)) {
        try {
          const lockOfFail = (value: Uint8Array | string | undefined): string => {
            if (!value) return '';
            return typeof value === 'string' ? binToHex(addressToLockScript(value)) : binToHex(value);
          };
          console.error('submit-fail-layout', {
            reason,
            outputCount: finalBuilder.outputs.length,
            jobEventsBand: this.getPublishJobEventsBand(),
            derivedEntries: [...this.externalCallEntryOutputsByIndex.entries()].map(([index, placed]) => ({
              index, cat: placed.categoryId.slice(0, 8), commit: placed.commitment.slice(0, 24),
              len: placed.commitment.length,
            })),
            calls: [
              ...this.externalCallUtxoGroups.map((group, index) => ({
                kind: 'ext',
                index,
                fn: group.logicalFunctionName ?? group.functionName,
                ret: group.returnOutputIndex,
                chunks: group.valueChunkOutputCount,
                cat: group.categoryId?.slice(0, 16),
              })),
              ...this.lowLevelCallUtxoGroups.map((group, index) => ({
                kind: 'llc',
                index,
                fn: group.functionName,
                mode: group.callMode,
                master: this.getLowLevelCallMasterInputIndex(index),
                chunks: group.valueChunkOutputCount,
                cat: group.categoryId?.slice(0, 16),
              })),
            ],
            input5: {
              name: (finalBuilder.inputs[5]?.unlocker as { abiFunction?: { name?: string } } | undefined)
                ?.abiFunction?.name,
              contract: (finalBuilder.inputs[5]?.unlocker as { contract?: { artifact?: { contractName?: string } } }
                | undefined)?.contract?.artifact?.contractName,
              category: finalBuilder.inputs[5]?.token?.category?.slice(0, 16),
            },
            around: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 33, 34, 35].map((index) => {
              const output = finalBuilder.outputs[index];
              const input = finalBuilder.inputs[index];
              return {
                index,
                inLock: input && 'unlocker' in input && input.unlocker
                  ? binToHex(input.unlocker.generateLockingBytecode()).slice(0, 20) : '',
                inCap: input?.token?.nft?.capability ?? (input ? 'plain' : 'missing'),
                inCat: String(input?.token?.category ?? '').slice(0, 16),
                lock: lockOfFail(output?.to).slice(0, 20),
                cap: output?.token?.nft?.capability ?? (output ? 'plain' : 'missing'),
                cat: String(output?.token?.category ?? '').slice(0, 16),
                commit: String(output?.token?.nft?.commitment ?? '').slice(0, 24),
                commitLen: String(output?.token?.nft?.commitment ?? '').length,
                lockMatch: input && 'unlocker' in input && input.unlocker && output?.to
                  ? binToHex(input.unlocker.generateLockingBytecode()) === lockOfFail(output.to) : false,
              };
            }),
            bandSlots: (() => {
              const band = this.getPublishJobEventsBand();
              if (!band) return [];
              return Array.from({ length: band.nNew }, (_u, offset) => {
                const index = band.start + offset;
                const output = finalBuilder.outputs[index];
                return {
                  index,
                  lock: lockOfFail(output?.to),
                  commit: String(output?.token?.nft?.commitment ?? ''),
                  cap: output?.token?.nft?.capability,
                };
              });
            })(),
            identity: {
              hasLogical: !!this.logicalIdentityUtxo,
              logicalCat: this.logicalIdentityUtxo?.token?.category?.slice(0, 16),
              logicalCap: this.logicalIdentityUtxo?.token?.nft?.capability,
              logicalCommit: String(this.logicalIdentityUtxo?.token?.nft?.commitment ?? '').slice(0, 16),
              externalAnchors: this.externalIdentityAnchorUtxos.length,
            },
            inputs: finalBuilder.inputs.map((input, index) => ({
              index,
              cap: input?.token?.nft?.capability ?? (input ? 'plain' : 'missing'),
              cat: String(input?.token?.category ?? '').slice(0, 16),
              commit: String(input?.token?.nft?.commitment ?? '').slice(0, 16),
              scid: String(input?.token?.nft?.commitment ?? '').toLowerCase().startsWith('53434944'),
            })),
            lockHits: (() => {
              const counts = new Map<string, number>();
              for (const output of finalBuilder.outputs) {
                const lock = lockOfFail(output?.to).slice(0, 20);
                if (!lock.startsWith('aa20')) continue;
                counts.set(lock, (counts.get(lock) ?? 0) + 1);
              }
              return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8);
            })(),
          });
        } catch { /* dump is best-effort */ }
        try { this._logCovenantFailureTrace(finalBuilder, reason); } catch { /* trace is best-effort */ }
      }
      throw submitErr;
    }

    const expectedTxid = binToHex(hash256(rawTxBin).reverse());
    if (txid !== expectedTxid) {
      throw new Error(
        `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
        + 'The network provider may be compromised.',
      );
    }
    this._persistPlacedJobEventsBand(finalBuilder, txid);

    const decoded = decodeTransactionUnsafe(rawTxBin);
    const details = attachWait({ ...decoded, txid, hex: rawTx } as TransactionDetails, this.builderOptions.provider);
    // ethers-v5 receipt.events: decode this tx's own event NFT outputs against the artifact event ABI so a ported
    // suite can do `(await tx.wait()).events[0].args.pair`. Runtime-computed fields (a factory's deployed-child
    // address) come from the real on-chain commitment, not the emit-time placeholder args.
    const emitted = this.decodeEmittedEvents(decoded.outputs as readonly LibauthOutput[]);
    details.events = emitted;
    details.logs = emitted;
    sendTiming('complete');
    return details;
  }

  /**
   * Decode the event NFT outputs this transaction created into ethers-v5-style receipt events. An output is an
   * event log iff its locking bytecode matches one of the event NFT addresses; its commitment is decoded against
   * that event's ABI. Outputs are scanned in vout order, so `events[0]` is the first-emitted event.
   */
  private decodeEmittedEvents(outputs: readonly LibauthOutput[]): ReceiptEvent[] {
    if (this.eventDefinitions.length === 0
      || (this.eventNftLockingBytecodes.size === 0 && this.runtimeLoopEventOutputs.length === 0)) return [];
    const sigByLbc = new Map<string, string>();
    for (const [sig, lbc] of this.eventNftLockingBytecodes) sigByLbc.set(binToHex(lbc), sig);
    for (const event of this.runtimeLoopEventOutputs) {
      sigByLbc.set(binToHex(event.lockingBytecode), event.eventSignature);
    }
    const structs = this.stateLayout.structs;
    const events: ReceiptEvent[] = [];
    for (const out of outputs) {
      const commitment = out.token?.nft?.commitment;
      if (commitment === undefined) continue;
      const sig = sigByLbc.get(binToHex(out.lockingBytecode));
      if (sig === undefined) continue;
      const eventDef = this.eventDefinitions.find((e) => e.signature === sig);
      if (!eventDef) continue;
      const commitmentHex = typeof commitment === 'string' ? commitment : binToHex(commitment);
      let named: Record<string, StateValue>;
      try {
        named = parseEventCommitment(commitmentHex, eventDef, structs);
      } catch {
        continue; // commitment did not match this event's ABI - skip (should not happen for a real event NFT)
      }
      events.push({
        event: eventDef.name, eventSignature: eventDef.signature,
        args: buildReceiptEventArgs(eventDef, named),
      });
    }
    for (const detached of this.detachedEventReceipts) {
      const eventDef = this.eventDefinitions.find((event) => event.signature === detached.eventSignature);
      if (!eventDef) continue;
      try {
        const named = parseEventCommitment(detached.commitment, eventDef, structs);
        events.push({
          event: eventDef.name,
          eventSignature: eventDef.signature,
          args: buildReceiptEventArgs(eventDef, named),
        });
      } catch { /* malformed compatibility event - omit from receipt */ }
    }
    return events;
  }
}

onMockNetworkProviderReset(() => {
  StatefulTransactionBuilder.clearPersistedJobEvents();
});

/**
 * Build an ethers-v5 `event.args`: decoded params by name (`.args.pair`), plus non-enumerable numeric indices
 * (`.args[0]`, array-like Result parity) and a `toObject()` returning a plain named copy. Non-enumerable extras
 * keep Object.keys / spread / chai deep-equal to just the named fields.
 */
function buildReceiptEventArgs(
  eventDef: EventDefinitionAbi,
  named: Record<string, StateValue>,
): Record<string, unknown> {
  // Attach .toObject()/.toArray() to any struct/array param value so `event.args.someStruct.toObject()` works,
  // matching the getState()/queryFilter boundaries.
  for (const p of eventDef.parameters) attachDecodedAccessors(named[p.name]);
  const args: Record<string, unknown> = { ...named };
  eventDef.parameters.forEach((p, i) => {
    Object.defineProperty(args, String(i), { value: named[p.name], enumerable: false, writable: true, configurable: true });
  });
  Object.defineProperty(args, 'toObject', {
    value: (): Record<string, StateValue> => ({ ...named }), enumerable: false, writable: true, configurable: true,
  });
  return args;
}
