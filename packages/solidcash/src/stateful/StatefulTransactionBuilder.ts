/* eslint-disable @typescript-eslint/no-loop-func */
import {
  StateLayout,
  EntryAccessAbi,
  buildPushdataCommitment,
  encodeNftIndexTag,
  buildEntryCommitment,
  buildEntryCommitmentMultiKey,
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
  buildValueChunkCommitment,
  sha256 as sha256Sync,
  encodeInt,
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
import { CovenantTransactionBuilder } from './CovenantTransactionBuilder.js';
import {
  addressToLockScript, scriptToLockingBytecode, generateLibauthSourceOutputs, calculateDust,
} from '../utils.js';
import type { LibauthOutput, Output, ReceiptEvent } from '../interfaces.js';
import { attachWait } from '../wait.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import { onMockNetworkProviderReset } from '../network/MockNetworkProvider.js';
import {
  assertFinalizedTransactionBytes, assertFinalizedTransactionCovenants, inputSubjectsOfBuilder,
} from '../message-bus/preflight.js';
import { parseEventCommitment } from './StateReader.js';
import {
  Utxo, UnlockableUtxo, TransactionDetails, isP2PKHUnlocker, Unlocker,
} from '../interfaces.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import {
  createDataNftUnlocker, createRelocatedDataNftUnlocker, createValueChunkUnlocker,
  getValueChunkLockingBytecode,
} from './covenant-helpers.js';
import { canApplyRepairedNftCommitment, isRepairableNftOutput } from './computed-output-repair.js';
import { isScidIdentityCommitment } from './logical-identity.js';
import { encodeEntryCommitment, isEmptyValueEntryCommitment, keyToSlot } from './SortedList.js';
import { artifactUsesSolidityAbi } from './solidityAbi.js';

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

// Finalized-input probes are synchronous and a provider's consensus profile is immutable for its lifetime.
// Rebuilding libauth's complete BCH-2026 instruction set for every conditional token participant is pure work;
// reuse the configured VM exactly as the state-derivation probe path does.
const finalizedInputVmCache = new WeakMap<NonNullable<TransactionBuilderOptions['provider']>,
ReturnType<typeof createVirtualMachineBch2026ForProvider>>();

function finalizedInputVm(provider: NonNullable<TransactionBuilderOptions['provider']>):
ReturnType<typeof createVirtualMachineBch2026ForProvider> {
  const cached = finalizedInputVmCache.get(provider);
  if (cached) return cached;
  const vm = createVirtualMachineBch2026ForProvider(provider);
  finalizedInputVmCache.set(provider, vm);
  return vm;
}

const persistedJobEventsByCategory = new Map<string, Array<{
  commitment: string; lockingBytecode: Uint8Array; categoryId?: string;
}>>();
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
  // Every state-writing logical callsite shares the in-block return NFT. Views
  // (arbitratorRegistered, userRegistered, balanceOf) keep dedicated tails.
  return writesState(child);
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
  blockInputs?: { length: number };
  loopReturnCommitments?: { length: number };
  batchPredecessorOutputs?: Array<{ outputBlockSlot: number }>;
  valueChunkOutputCount?: number;
};

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

/** In-block extraTransfer return after the minting master (post-rotate). */
/**
 * State-writing bools (transferFrom / extraTransfer) default to ABI true.
 * A fused zero seed (`00` / 32-byte zeros) is unset, not a legitimate false.
 */
export function tokenWriterReturnCommitment(parts: {
  pendingHex?: string;
  writesState?: boolean;
  evmBool?: boolean;
  returnsBool?: boolean;
}): string {
  const evmBool = parts.evmBool === true;
  const boolTrue = evmBool ? `${'00'.repeat(31)}01` : '01';
  const boolFalse = evmBool ? `${'00'.repeat(31)}00` : '00';
  const defaultBool = parts.writesState === true ? boolTrue : boolFalse;
  const pending = (parts.pendingHex ?? '').toLowerCase();
  if (parts.returnsBool === false) return pending || defaultBool;
  if (pending === '' || /^0+$/.test(pending)) return defaultBool;
  const isBool = evmBool
    ? pending === boolFalse || pending === boolTrue
    : pending === '00' || pending === '01' || pending === '51';
  return isBool ? pending : defaultBool;
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

/** Pads after a proxy [master, ...data] so FakeToken starts past impl+trailingBase+nNew. */
export function proxyValueChunkPadCount(parts: {
  insertBase: number;
  chunkSlots: number;
  prefixLength: number;
}): number {
  return Math.max(0, parts.insertBase + parts.chunkSlots - parts.prefixLength);
}

export function mintingSwapExtraFunders(parts: {
  hasTokenWriter: boolean;
  hasPublishJobEvent: boolean;
  predictedBandWidth: number;
  minShift?: number;
}): number {
  if (!parts.hasTokenWriter || !parts.hasPublishJobEvent) return 0;
  // A persist UPDATE parks chunks at INPUTINDEX*scale (25). The minting
  // block must rotate that far; unused wallet UTXOs are spliced after it.
  return Math.max(0, parts.predictedBandWidth - 4, parts.minShift ?? 0);
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
  return Math.min(32, Math.max(
    0,
    parts.plannedWidth ?? 0,
    parts.persistWidth ?? 0,
    parts.derivedWidth ?? 0,
  ));
}

/** Persist UPDATE EQUALVERIFYs dest 16-18. persistWidth after updateJobPost is 5. */
export function persistUpdatePersistVWidth(): number {
  return 3;
}

/**
 * Persist UPDATE dests EQUALVERIFY the previous persist width (closeJob 3).
 * Extracted Closed/Updated blobs are dest 15 emit — do not grow dest 16+ to 5.
 */
export function persistUpdateBandWidth(parts: {
  persistReady: boolean;
  persistWidth: number;
  plannedWidth?: number;
  derivedWidth?: number;
}): number {
  if (parts.persistReady && parts.persistWidth > 0) {
    return Math.min(32, parts.persistWidth);
  }
  return liveJobEventsBandWidth(parts);
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

/** Persist UPDATE value-chunks start at impl+blockSize, never dest 0/1 or entry/emit. */
export function persistJobEventsBandFloor(implIndex: number, persistReady: boolean): number {
  if (!persistReady) return -1;
  const trailing = persistValueChunkBase(implIndex, 5, false);
  return trailing >= 0 ? trailing : 2;
}

/** Proxy minting (0) and data-NFT (1) 1:1 slots. Persist chunks must not land here. */
export function isProxyPreserveOutputIndex(index: number): boolean {
  return index === 0 || index === 1;
}

/**
 * Move off-band derived persist chunks onto the live band by uint16-le index.
 * Dest 1 with chunk `0100…` is persist chunk 1, not dest 1 — sequential remapping
 * would put it at `band.start` and overwrite the proxy data NFT.
 */
export function remapDerivedChunkDests<T extends { commitment?: string }>(
  derived: ReadonlyMap<number, T>,
  band: { start: number; nNew: number },
  persistFloor = -1,
): Map<number, T> {
  const next = new Map<number, T>();
  const offBand: T[] = [];
  const bandEnd = band.start + band.nNew - 1;
  const floor = persistFloor >= 0 ? persistFloor : 2;
  for (const [dest, chunk] of [...derived.entries()].sort(([left], [right]) => left - right)) {
    const chunkIndex = valueChunkIndexFromCommitment(chunk.commitment ?? '');
    const falseDest = isProxyPreserveOutputIndex(dest)
      || dest < floor
      || (chunkIndex !== undefined && dest === chunkIndex && dest < band.start);
    if (falseDest) {
      if (chunkIndex !== undefined && chunkIndex < band.nNew && !next.has(band.start + chunkIndex)) {
        next.set(band.start + chunkIndex, chunk);
      }
      continue;
    }
    if (dest >= band.start && dest <= bandEnd) {
      next.set(dest, chunk);
    } else {
      offBand.push(chunk);
    }
  }
  let offset = 0;
  for (const chunk of offBand) {
    const chunkIndex = valueChunkIndexFromCommitment(chunk.commitment ?? '');
    if (chunkIndex !== undefined && chunkIndex < band.nNew) {
      if (!next.has(band.start + chunkIndex)) next.set(band.start + chunkIndex, chunk);
      continue;
    }
    while (offset < band.nNew && next.has(band.start + offset)) offset += 1;
    if (offset >= band.nNew) break;
    next.set(band.start + offset, chunk);
    offset += 1;
  }
  return next;
}

/** publishJobEvent data-NFT dests: INPUTINDEX+1 and INPUTINDEX+2. Never dest 0/1. */
export function publishJobEventDataNftDests(implIndex: number, dataNftCount = 2): number[] {
  if (implIndex < 0 || dataNftCount <= 0) return [];
  return Array.from({ length: dataNftCount }, (_, offset) => implIndex + 1 + offset)
    .filter((dest) => dest >= 2 && dest !== implIndex);
}

/**
 * Data-NFT inputs that belong at impl+1 / impl+2. Prefer ones already there;
 * otherwise take the callee category, never dest 0/1.
 */
export function selectPublishJobEventDataNftSources(
  inputs: ReadonlyArray<{
    token?: { category?: string; nft?: { capability?: string; commitment?: string } };
  }>,
  implIndex: number,
  categoryId?: string,
): number[] {
  const dests = publishJobEventDataNftDests(implIndex);
  if (dests.length === 0) return [];
  const isSource = (index: number): boolean => {
    if (isProxyPreserveOutputIndex(index) || index === implIndex) return false;
    const input = inputs[index];
    if (!input?.token) return false;
    const cap = input.token.nft?.capability;
    if (cap !== 'mutable' && cap !== 'none') return false;
    if (categoryId && input.token.category !== categoryId) return false;
    const commit = String(input.token.nft?.commitment ?? '');
    if (commit.toLowerCase().startsWith('53434944')) return false;
    return isDataNftIndexCommitment(commit);
  };
  if (dests.every((dest) => isSource(dest))) return dests;
  const adjacent = dests.map((_, offset) => implIndex - dests.length + offset);
  if (adjacent.every((index) => index >= 2 && index !== implIndex && isSource(index))) {
    return adjacent;
  }
  if (categoryId) {
    const unfiltered = selectPublishJobEventDataNftSources(inputs, implIndex);
    if (unfiltered.length === dests.length) return unfiltered;
  }
  return [];
}

/** Swap data-NFT UTXOs onto dest impl+1 / impl+2. Returns the dests that moved. */
export function assignPublishJobEventDataNftInputs<T>(
  inputs: T[],
  implIndex: number,
  sources: readonly number[],
): number[] {
  const dests = publishJobEventDataNftDests(implIndex);
  const moved: number[] = [];
  for (let offset = 0; offset < dests.length && offset < sources.length; offset++) {
    const dest = dests[offset];
    const source = sources[offset];
    if (source === dest || source < 0 || dest < 0) continue;
    if (source >= inputs.length || dest >= inputs.length) continue;
    const destInput = inputs[dest];
    inputs[dest] = { ...(inputs[source] as object) } as T;
    inputs[source] = destInput !== undefined ? { ...(destInput as object) } as T : inputs[source];
    moved.push(dest);
  }
  return moved;
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
  /** Persist UPDATE floor: entry dest, or dest 2 when impl is unknown. */
  persistFloor?: number;
}): { start: number; end: number; nNew: number } | undefined {
  const layoutStart = parts.start ?? (
    parts.implIndex !== undefined && parts.implIndex >= 0
      ? parts.implIndex + (parts.blockSize ?? 5) + (parts.insertShift ?? 0)
      : -1
  );
  const start = Math.max(
    layoutStart,
    parts.preserveEndExclusive ?? -1,
    parts.persistFloor ?? -1,
  );
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

type JobEventsChunk = {
  commitment: string; lockingBytecode: Uint8Array; categoryId?: string;
};

/** Keep the longest recovered run (Updated > Created). Same length prefers the later digest. */
export function selectLatestJobEventsChunks(
  existing: ReadonlyArray<JobEventsChunk>,
  incoming: ReadonlyArray<JobEventsChunk>,
): JobEventsChunk[] {
  const usable = (chunk: JobEventsChunk): boolean => {
    if (chunk.commitment.length < 3 || chunk.commitment === '00') return false;
    // A 12-byte 05||00… tail is a padded split, not a live continuation.
    // Keep short stubs (unit tests) and 1-byte occupancy dummies.
    return !(chunk.commitment.length >= 16 && isEmptyValueChunkCommitment(chunk.commitment));
  };
  const real = incoming.filter(usable);
  const prior = existing.filter(usable);
  if (real.length === 0) return [...prior];
  if (real.length < prior.length) return [...prior];
  return [...real];
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
      widest = Math.max(widest, selectLatestJobEventsChunks([], chunks).length);
    }
    for (const value of persistedJobEventsValues.values()) {
      widest = Math.max(widest, valueChunkCountFor(value));
    }
    return Math.min(32, widest);
  }
  const fromChunks = selectLatestJobEventsChunks([], persistedJobEventsByCategory.get(categoryId) ?? []).length;
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
  return firstPersisted(persistedJobEventsRecipes, categoryId);
}

/**
 * Dest-15 UPDATE dest-20 lock: emitValueChunkP2sh32(master category, H(0), sha256(v)).
 * Do not use a persist unlock recipe — that recipe matches the dummy
 * `aa20||sha256(v)||87` first-publish lock, not dest 15's pin.
 */
export function persistValueChunkLock(
  categoryId: string | undefined,
  value?: Uint8Array,
): Uint8Array | undefined {
  if (!categoryId || !/^[0-9a-f]{64}$/i.test(categoryId) || !value || value.length === 0) {
    return undefined;
  }
  const root = sha256Sync(value);
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
  const previous = stagedJobEventsValues.get(categoryId);
  if (!previous || value.length >= previous.length) stagedJobEventsValues.set(categoryId, value);
}

/** Full last committed jobEvents blob (not a Created probe). Longer wins. */
export function rememberJobEventsValue(categoryId: string, value: Uint8Array): void {
  if (value.length <= 60 || value.length > MAX_PERSISTED_JOB_EVENTS_BYTES) return;
  const previous = persistedJobEventsValues.get(categoryId);
  if (!previous || value.length >= previous.length) persistedJobEventsValues.set(categoryId, value);
  if (isCreatedPersistValue(value) && !persistedCreatedValues.has(categoryId)) {
    persistedCreatedValues.set(categoryId, value);
  }
  rememberJobEventsUnlockRecipe(categoryId);
}

function firstPersisted<T>(map: Map<string, T>, categoryId?: string): T | undefined {
  if (categoryId && map.has(categoryId)) return map.get(categoryId);
  let best: T | undefined;
  for (const value of map.values()) {
    if (best === undefined) best = value;
    if (value instanceof Uint8Array && best instanceof Uint8Array && value.length > best.length) {
      best = value;
    }
  }
  return best;
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
  persistedJobEventsLocks.set(categoryId, lock);
  const value = persistedJobEventsValues.get(categoryId)
    ?? firstPersisted(persistedJobEventsValues, categoryId);
  const hex = value ? binToHex(value) : '';
  if (hex.includes('4372656174') || hex.includes('00004cb4')) {
    createdDigestLocks.add(categoryId);
  }
  rememberJobEventsUnlockRecipe(categoryId);
}

export function persistedJobEventsLock(categoryId: string): Uint8Array | undefined {
  return persistedJobEventsLocks.get(categoryId);
}

/**
 * UPDATE rematerialization must reuse the persist redeem lock the impl
 * EQUALVERIFYs (`getValueChunkLockingBytecode` of the Created root), not
 * `aa20||sha256(v)||87` and not a consumed UTXO's previous physical lock.
 */
export function persistUpdateRedeemLock(
  categoryId: string | undefined,
  sessionLock?: Uint8Array,
): Uint8Array | undefined {
  if (sessionLock && sessionLock.length === 35 && sessionLock[0] === 0xaa && sessionLock[34] === 0x87) {
    return sessionLock;
  }
  if (!categoryId) return undefined;
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
  const pinIsP2sh32 = !!pinLock
    && pinLock.length === 35 && pinLock[0] === 0xaa && pinLock[1] === 0x20 && pinLock[34] === 0x87;
  const pinDigest = pinIsP2sh32 ? binToHex(pinLock!.subarray(2, 34)) : undefined;
  if (pinDigest) {
    for (const stack of stacks) {
      for (const item of stack) {
        if (item.length <= 60) continue;
        if (binToHex(sha256Sync(item)) === pinDigest) {
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
    const digestHex = binToHex(sha256Sync(value));
    return stack?.find((item) => (
      item.length === 35 && item[0] === 0xaa && item[1] === 0x20 && item[34] === 0x87
      && binToHex(item.subarray(2, 34)) === digestHex
    )) ?? p2sh32LockFromValueRoot(sha256Sync(value));
  };
  let best: { value: Uint8Array; lockingBytecode: Uint8Array } | undefined;
  for (const stack of stacks) {
    let value: Uint8Array | undefined;
    for (const item of stack) {
      if (item.length <= 60) continue;
      const digest = sha256Sync(item);
      if (!stack.some((candidate) => candidate.length === 32 && binToHex(candidate) === binToHex(digest))) {
        continue;
      }
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
): JobEventsChunk[] {
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

/** Rebuild persist `v` from uint16-le value-chunk outputs when staged memory is empty. */
export function recoverPersistValueFromOutputs(
  outputs: ReadonlyArray<{ token?: { nft?: { commitment?: string } } }>,
  dests: readonly number[],
): Uint8Array | undefined {
  const parts: Array<Uint8Array | undefined> = [];
  for (const dest of dests) {
    const hex = String(outputs[dest]?.token?.nft?.commitment ?? '');
    const chunkIndex = valueChunkIndexFromCommitment(hex);
    if (chunkIndex === undefined || hex.length < 8) continue;
    parts[chunkIndex] = hexToBin(hex.slice(4));
  }
  if (parts.length === 0 || parts.some((part) => part === undefined)) return undefined;
  const total = parts.reduce((sum, part) => sum + (part?.length ?? 0), 0);
  if (total === 0) return undefined;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part as Uint8Array, offset);
    offset += (part as Uint8Array).length;
  }
  return out;
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

/**
 * Compiler persist dest: first-publish uses impl+blockSize (20).
 * Persist UPDATE with a token writer pins impl+entry (15+3=18).
 */
export function persistValueChunkBase(implIndex: number, blockSize = 5, persistUpdate = false): number {
  if (implIndex < 0) return -1;
  return persistUpdate ? implIndex + Math.min(3, blockSize) : implIndex + blockSize;
}

/** Persist digest lock dests: impl+3 (entry) and impl+blockSize (trailing / dest 19). */
export function persistDigestLockDests(implIndex: number, blockSize = 5): number[] {
  if (implIndex < 0) return [];
  return [...new Set([
    persistValueChunkBase(implIndex, blockSize, true),
    persistValueChunkBase(implIndex, blockSize, false),
  ].filter((dest) => dest >= 0))];
}

/** Persist-v OUTPUTBYTECODE dests: trailing + live band, never entry or emit dest. */
export function persistChunkOutputDests(parts: {
  implIndex: number;
  bandStart: number;
  bandEnd: number;
  persistWidth?: number;
}): number[] {
  const entryDest = persistValueChunkBase(parts.implIndex, 5, true);
  const eventDest = entryDest >= 0 ? entryDest + 1 : -1;
  const dests = new Set<number>();
  const trailing = persistValueChunkBase(parts.implIndex, 5, false);
  if (trailing >= 0) dests.add(trailing);
  if (parts.bandStart >= 0 && parts.bandEnd >= parts.bandStart) {
    for (let index = parts.bandStart; index <= parts.bandEnd; index++) dests.add(index);
  }
  dests.delete(entryDest);
  dests.delete(eventDest);
  const floor = persistJobEventsBandFloor(parts.implIndex, true);
  const maxDest = parts.persistWidth && parts.persistWidth > 0 && parts.bandStart >= 0
    ? parts.bandStart + parts.persistWidth - 1
    : Number.POSITIVE_INFINITY;
  return [...dests]
    .filter((dest) => dest >= 2 && (floor < 0 || dest >= floor) && dest <= maxDest)
    .sort((left, right) => left - right);
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

/**
 * Persist UPDATE pins UTXOBYTECODE at impl+3 (dest 16 when publishJobEvent is
 * input 13) even when the live output band starts at dest 20. Predecessors
 * must occupy those dests after every `_buildInputs` rebuild. Entry dest is
 * first so a single persist UTXO lands on the UTXOBYTECODE pin, not impl+5.
 */
export function persistUpdatePredecessorDests(parts: {
  implIndex: number;
  persistUpdate: boolean;
  keepAtLayout: boolean;
  bandStart: number;
  nNew: number;
}): number[] {
  if (parts.nNew <= 0 || parts.bandStart < 0) return [];
  if (parts.persistUpdate && parts.implIndex < 0) return [];
  const layout = persistValueChunkBase(parts.implIndex, 5, true);
  const start = parts.persistUpdate && parts.keepAtLayout && layout >= 0
    ? Math.min(layout, parts.bandStart)
    : parts.bandStart;
  const dests = Array.from({ length: parts.nNew }, (_, offset) => start + offset);
  if (parts.persistUpdate && parts.implIndex >= 0) {
    const entryDest = persistValueChunkBase(parts.implIndex, 5, true);
    const trailingDest = persistValueChunkBase(parts.implIndex, 5, false);
    // INPUTINDEX+blockSize keeps a persist-chunk dest when the band slid.
    if (trailingDest >= 0 && !dests.includes(trailingDest)) dests.push(trailingDest);
    // Layout entry is INPUTINDEX+3. UTXOBYTECODE(INPUTINDEX+3) reads this lock.
    if (entryDest >= 0 && !dests.includes(entryDest)) dests.unshift(entryDest);
    if (entryDest >= 0) {
      dests.splice(dests.indexOf(entryDest), 1);
      dests.unshift(entryDest);
    }
    // INPUTINDEX+4 is the JobEvent emit dest. Persist chunks must not land there.
    const eventDest = entryDest >= 0 ? entryDest + 1 : -1;
    if (eventDest >= 0) {
      const eventIndex = dests.indexOf(eventDest);
      if (eventIndex >= 0) dests.splice(eventIndex, 1);
    }
    // A wrong band start (dest 1) must not steal proxy data-NFT dests.
    if (entryDest >= 0) {
      return dests.filter((dest) => dest === entryDest || dest === trailingDest || dest >= entryDest);
    }
  }
  return dests;
}

/**
 * First-publish keeps the earliest candidate (LLC fallback can sit before the
 * named unlocker). Persist-ready type-14/15 dests must use the named
 * `publishJobEvent` unlocker (`OP_INPUTINDEX`), not min(LLC master).
 */
export function selectPublishJobEventInputIndex(parts: {
  namedUnlockers: readonly number[];
  llcMasters: readonly number[];
  implMintingInputs?: readonly number[];
  persistReady: boolean;
  firstPublish: boolean;
}): number {
  const named = [...new Set(parts.namedUnlockers.filter((index) => index >= 0))];
  const masters = [...new Set(parts.llcMasters.filter((index) => index >= 0))];
  const minting = [...new Set((parts.implMintingInputs ?? []).filter((index) => index >= 0))];
  const executing = named.length > 0 ? named : minting;
  const all = executing.length > 0 ? executing : masters;
  if (all.length === 0) return -1;
  // Persist-ready dests are INPUTINDEX-relative to the executing unlocker
  // (later nested publishJobEvent), not the earliest LLC fallback.
  if (parts.persistReady && !parts.firstPublish) return Math.max(...all);
  return Math.min(...[...named, ...masters, ...minting].filter((index) => index >= 0));
}

/** Persist UPDATE dests own the layout; FakeToken minting there is displaced, not skipped. */
/** After `_refreshInputs`, send must evaluate the same occupancy as derive. */
export function syncBuilderInputsFromAllInputs<T>(builderInputs: readonly T[], allInputs: readonly T[]): T[] {
  const extra = Math.max(0, builderInputs.length - allInputs.length);
  return [...allInputs, ...builderInputs.slice(allInputs.length, allInputs.length + extra)];
}

/**
 * Persist UPDATE dest 18 is jobEvents[0] (H(0) entry). Created value-chunks
 * (`0000`/`0100`/…) follow in chunk-index order. First-publish stays lex.
 */
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

/** Dest 18 is the H(0) entry; dest 20 is persist chunk 0 (`0000`). Dest 19 is chunk 1. */
export function persistPredecessorWantedRank(dest: number, implIndex: number): number {
  if (implIndex < 0) return 1000;
  const entryDest = persistValueChunkBase(implIndex, 5, true);
  const chunk0Dest = persistValueChunkBase(implIndex, 5, false);
  if (dest === entryDest) return 0;
  if (dest === chunk0Dest) return 10;
  if (dest > entryDest && dest < chunk0Dest) return 11 + (dest - entryDest - 1);
  if (dest > chunk0Dest) return 11 + (dest - chunk0Dest);
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
    const returnSlot = group.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
    const layoutSize = group.blockLayout?.blockSize
      ?? group.compilerRoute?.abiFunction?.blockLayout?.blockSize
      ?? 0;
    const trailingPred = (group.batchPredecessorOutputs ?? [])
      .filter((pred) => pred.outputBlockSlot >= layoutSize).length;
    const physicalEnd = master + Math.max(
      layoutSize,
      group.blockInputs?.length ?? 0,
      (returnSlot?.offset ?? -1) + 1,
    ) + trailingPred - 1;
    if (physicalEnd >= master) occupied = Math.max(occupied, physicalEnd);
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

/** Token-free OP_TRUE or P2PKH pads used only to keep TXOUTPUTCOUNT aligned. */
/**
 * Same-collection empty-value placeholders (128-byte slot||next||64-zero) inflate
 * insert-loop output counts (jobEvents teardown: expected P'+NEW=2, leftover
 * e3b0c442 placeholder makes the scan 3). Convert extras to token-free pads
 * in place so view tails and the jobs suffix do not move.
 *
 * `plannedCount` is required. Without it this must not guess: initialize and
 * FakeToken.transfer also emit mixed empty+real mutables, and stripping those
 * breaks deploy / token-amount decoding.
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

/** True when a composed group is the Solidity publishJobEvent write, not a proxy `__forward`. */
export function groupWritesPublishedJobEvents(group: {
  functionName?: string;
  logicalFunctionName?: string;
  compilerRoute?: { abiFunction?: { name?: string; entryLoopWrites?: readonly string[] } };
}): boolean {
  const names = [
    group.logicalFunctionName,
    group.compilerRoute?.abiFunction?.name,
    group.functionName,
  ].filter((name): name is string => !!name && name !== '__forward');
  return names.includes('publishJobEvent');
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
    const capability = output.token?.nft?.capability;
    return capability === 'minting' || capability === 'mutable';
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
    let target = -1;
    for (let outputIndex = outputs.length - 1; outputIndex >= 0; outputIndex--) {
      const output = outputs[outputIndex];
      if (lockHex(output?.to) !== wanted) continue;
      if (isReserved(output, outputIndex)) continue;
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

/**
 * Updated persist may overwrite a co-spent SCID on dest 19 (chunk 3) when the
 * live band includes that dest. Closed replay keeps dest 19-20 as SCIDs so
 * persist-v dests stay 16-18 (3 vs 5).
 */
export function persistChunkMayOverwriteScid(parts: {
  dest: number;
  band?: { start: number; end: number };
  replayWidth: number;
  incomingCommitment?: string;
}): boolean {
  if (parts.replayWidth > 0) return false;
  if (!parts.band || parts.dest < parts.band.start || parts.dest > parts.band.end) return false;
  const commit = parts.incomingCommitment ?? '';
  return isPersistValueChunkCommitment(commit) && !isEmptyValueChunkCommitment(commit);
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

/**
 * Same-index P' is at the predecessor input. INSERT NEW is pinned two slots
 * later (the hole events otherwise occupy). Move the node there in place.
 */
export const INSERT_NEW_OUTPUT_OFFSET = 2;

export function placeInsertNewAt<T extends {
  to?: Uint8Array | string;
  amount?: bigint;
  token?: { category?: string; nft?: { capability?: string; commitment?: Uint8Array | string } };
}>(
  outputs: T[],
  predIndex: number,
  newNode: T,
  options: SameIndexTwinOptions,
): number {
  const newIndex = predIndex + INSERT_NEW_OUTPUT_OFFSET;
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
}, options?: { persistCloneOk?: boolean }): boolean {
  if (!output || isDisposableAlignmentPad(output) || !output.token) return true;
  if (output.token.nft?.capability === 'minting') return false;
  const commit = String(output.token.nft?.commitment ?? '');
  if (commit.startsWith('53434944') || commit.length <= 16) return true;
  // INSERT dest (Created / Whitelisted) may displace a persist-v clone at dest.
  // Persist UPDATE dest must not steal a conservation twin.
  return options?.persistCloneOk === true
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

/** True when this output is the executing publishJobEvent dest (`INPUTINDEX + event.offset`). */
export function isPublishJobEventEmitDest(
  outputIndex: number,
  implIndex: number,
  eventOffset = 4,
): boolean {
  const dest = publishJobEventOutputIndex(implIndex, eventOffset);
  return dest >= 0 && outputIndex === dest;
}

/**
 * A 1:1 P2PKH funder at INPUTINDEX+4 keeps the JobEvent commitment but the
 * wrong lock. Restore the event covenant without moving the blob.
 */
export function repairJobEventDestLock(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
  }>,
  dest: number,
  locking: Uint8Array,
  force = false,
): boolean {
  if (dest < 0 || dest >= outputs.length) return false;
  const existing = outputs[dest];
  const commit = String(existing?.token?.nft?.commitment ?? '');
  if (!isJobEventEmitCommitment(commit) && !isCreatedJobEventCommitment(commit)) return false;
  let current = existing?.to instanceof Uint8Array ? existing.to : undefined;
  if (!current && typeof existing?.to === 'string') {
    try { current = addressToLockScript(existing.to); } catch { current = undefined; }
    if (!current && /^[0-9a-f]+$/i.test(existing.to) && existing.to.length % 2 === 0) {
      try { current = hexToBin(existing.to); } catch { current = undefined; }
    }
  }
  if (current && current.length === locking.length
    && current.every((byte, index) => byte === locking[index])) {
    return true;
  }
  // Only vacate a 1:1 P2PKH funder unless persist-ready dest 17 must take the
  // emit-authenticating proxy covenant over an impl-minting p2sh32.
  if (!force && (!current || current.length !== 25 || current[0] !== 0x76 || current[1] !== 0xa9 || current[2] !== 0x14)) {
    return false;
  }
  outputs[dest] = {
    to: locking,
    amount: existing?.amount && existing.amount >= 1200n ? existing.amount : 1200n,
    token: existing?.token,
  };
  return true;
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
  options?: { persistCloneOk?: boolean; preferCreated?: boolean },
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
  if (occupant && !isOverwritableEmitOccupant(occupant, { persistCloneOk: options?.persistCloneOk })) {
    return false;
  }
  const moved = outputs[source];
  outputs[dest] = moved;
  outputs[source] = { to: Uint8Array.of(0x51), amount: 1000n };
  return true;
}

const SCID_COMMIT_PREFIX = '53434944';

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

/** Closed / CollateralWithdrawn replay previous persist v; Updated writes a new blob. */
export function isPersistReplayJobEvent(event: unknown): boolean {
  const type = jobEventTypeOf(event);
  return type === 7 || type === 16;
}

/** Extra dests with the entry digest lock (dest 14 + dest 19) fail NUMEQUALVERIFY 1. */
export function surplusPersistDigestDests(parts: {
  entryDest: number;
  persistDests: readonly number[];
  destLocks: ReadonlyArray<{ dest: number; lock: string }>;
  digestLock: string;
}): number[] {
  if (parts.entryDest < 0 || !parts.digestLock) return [];
  return parts.destLocks
    .filter((row) => row.lock.startsWith(parts.digestLock)
      && row.dest !== parts.entryDest
      && !parts.persistDests.includes(row.dest))
    .map((row) => row.dest);
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

/**
 * Dest-18 UPDATE EQUALVERIFYs the jobEvents entry-NFT p2sh32: persist proxy
 * category + collection `jobEvents:mapping(uint256 => JobEventData[])`.
 * That is emitSortedEntryAddress, not a value-chunk domain lock.
 */
/** jobEvents[0] entry: H(0)||zeros||persistHead. Dest-16 EQUALVERIFYs this, not persist-v. */
export function persistUpdateEntryCommitment(persistValue: Uint8Array | undefined): string | undefined {
  if (!persistValue || persistValue.length === 0) return undefined;
  return binToHex(encodeEntryCommitment(
    keyToSlot(new Uint8Array()),
    new Uint8Array(32),
    persistValue.slice(0, Math.min(VALUE_HEAD_SIZE, persistValue.length)),
  ));
}

/** Last-writer: dest 16/19 OUTPUTBYTECODE must be the persist digest lock, not a 1:1 P2PKH. */
export function pinPersistDigestLock(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
  }>,
  dest: number,
  locking: Uint8Array,
): boolean {
  if (dest < 0 || dest >= outputs.length) return false;
  const existing = outputs[dest];
  if (existing?.token?.nft?.capability === 'minting') return false;
  outputs[dest] = {
    to: locking,
    amount: existing?.amount && existing.amount >= 1200n ? existing.amount : 1200n,
    token: existing?.token,
  };
  return true;
}

const persistLockHex = (lock: Uint8Array | undefined): string => (
  lock && lock.length === 35 && lock[0] === 0xaa ? binToHex(lock) : ''
);

/**
 * UTXOBYTECODE(dest) reads `inputs[dest].unlocker`. Swap a persist-digest
 * predecessor onto that dest (new object so sourceOutputCache misses). Do not
 * wrap a tokenless P2PKH pad: that input would then fail to unlock.
 */
export function pinPersistDigestInput<T extends {
  token?: { nft?: { capability?: string; commitment?: string } };
  unlocker?: {
    generateLockingBytecode: () => Uint8Array;
    generateUnlockingBytecode: (context: Parameters<Unlocker['generateUnlockingBytecode']>[0]) => Uint8Array;
  };
}>(
  inputs: T[],
  dest: number,
  locking: Uint8Array,
): boolean {
  if (dest < 0 || dest >= inputs.length || locking.length !== 35) return false;
  const expected = binToHex(locking);
  const destInput = inputs[dest];
  if (destInput?.token?.nft?.capability === 'minting') return false;
  const destAlreadyPinned = persistLockHex(destInput?.unlocker?.generateLockingBytecode()) === expected
    && !!destInput?.token;
  if (destAlreadyPinned) return false;
  let source = -1;
  let sourceRank = Number.POSITIVE_INFINITY;
  for (let index = 0; index < inputs.length; index++) {
    if (index === dest) continue;
    const input = inputs[index];
    if (input?.token?.nft?.capability === 'minting' || !input?.unlocker) continue;
    const lockHex = persistLockHex(input.unlocker.generateLockingBytecode());
    const rank = persistPredecessorRank(String(input.token?.nft?.commitment ?? ''));
    const matchesLock = lockHex === expected;
    const persistShaped = rank < 1000;
    if (!matchesLock && !persistShaped) continue;
    const score = matchesLock ? rank : rank + 100;
    if (score < sourceRank) {
      sourceRank = score;
      source = index;
    }
  }
  if (source >= 0) {
    const sourceInput = inputs[source];
    const inner = sourceInput.unlocker;
    inputs[dest] = inner && persistLockHex(inner.generateLockingBytecode()) !== expected
      ? {
        ...sourceInput,
        unlocker: {
          generateLockingBytecode: () => locking,
          generateUnlockingBytecode: (context) => inner.generateUnlockingBytecode(context),
        },
      }
      : { ...sourceInput };
    inputs[source] = destInput !== undefined ? { ...destInput } : sourceInput;
    return true;
  }
  if (!destInput?.token || !destInput.unlocker) return false;
  const inner = destInput.unlocker;
  inputs[dest] = {
    ...destInput,
    unlocker: {
      generateLockingBytecode: () => locking,
      generateUnlockingBytecode: (context) => inner.generateUnlockingBytecode(context),
    },
  };
  return true;
}

export function persistUpdateDigestLock(
  categoryId?: string,
  _extraCategories: readonly string[] = [],
): Uint8Array | undefined {
  if (!categoryId || !/^[0-9a-f]{64}$/i.test(categoryId)) return undefined;
  try {
    const collectionHash = computeCollectionHash(
      computeCollectionSignature('jobEvents', 'mapping(uint256 => JobEventData[])'),
    );
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
    persistCloneOk?: boolean;
    destInput?: { token?: { nft?: { capability?: string } } };
  },
): boolean {
  if (dest < 0) return false;
  if (!options?.persistCloneOk && emitDestCollidesPreservedInput(options?.destInput)) return false;
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
    if (current && !isOverwritableEmitOccupant(current, { persistCloneOk: options?.persistCloneOk })) {
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
 * INSERT P' is a trailing output at `master+blockSize` (+ ordinal). Negative
 * values are covenant sentinels (update / alias). A planner that still emits a
 * fixed entry offset (< blockSize) for an INSERT must not be rebased onto that
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
  blockSize: number,
  relocatedBase?: number,
): bigint {
  if (relative < 0n) return relative;
  const natural = masterIndex + blockSize;
  // A relocated base smaller than the executing master's trailing slot is the
  // proxy-minting + impl-only-blockSize mistake (initialize PredOut 14 vs 17).
  const base = relocatedBase !== undefined && relocatedBase >= natural
    ? relocatedBase
    : natural;
  if (relative >= BigInt(base)) return relative;
  const ordinal = Number(relative) >= blockSize ? Number(relative) - blockSize : 0;
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
 * Own-category none-cap NFTs are event-pin candidates. Only the layout event
 * slots and the witnessed in-block return may carry that shape. Extra tails
 * (FakeToken category on output 38 after a 22→26 swap) fail WITHIN [eventLo, eventHi).
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
  blockSize: bigint,
): Record<string, bigint> {
  const updates: Record<string, bigint> = {};
  let trailing = 0;
  for (const { name, value } of predOuts) {
    if (value < 0n) continue;
    const plannedInsert = value >= blockSize;
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
   * logical invocation and logical `address(this)` instead. */
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
    rowArguments?: Array<{ selector: string; args: any[]; handler: AbiFunction }>;
    internalArgs?: Record<string, any>;
    eventSignaturesBySlot?: Array<string | undefined>;
  };
  /** ABI-named hidden witnesses resolved while assembling this callee's physical block. */
  internalArgs?: Record<string, any>;
  /** Hidden return-output ABI witness -> logical external-call group supplying that return. */
  returnWitnessGroups?: Record<string, number>;
  /** Rebuild this group's master unlocker after probe-derived hidden witnesses become available. */
  refreshInternalArgs?: (
    updates: Record<string, any>,
    options?: { shiftPredOut?: boolean },
  ) => void;
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
  plannedEntryInserts?: Array<{ blockSlot: number; outputBlockSlot: number; commitment?: string }>;
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
  /** Entry covenant bytecode for fixed sorted-batch target slots. Absent targets use balanced funder inputs,
   * whose locking bytecode must not be mirrored when the active route mints the target node. */
  batchEntryLockingBytecodes?: Map<number, Uint8Array>;
  /** Direct, unambiguous dynamic-write values derived from the callee ABI arguments. */
  dynamicStateValues?: Readonly<Record<string, StateValue>>;
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
  // Collections written by a runtime loop (`for(i<n) m[k[i]]=v[i]`): N new entry NFTs created as trailing
  // outputs (a runtime-variable count, like dynamicChunkVars). Commitments come from auto-derivation.
  loopEntryVars?: Array<{
    collection: string; lockingBytecode: Uint8Array; categoryId?: string; delegate?: boolean; chunkable?: boolean;
  }>;
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
  batchEntriesBeforeDynamicChunks?: boolean;
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
  /** Immutable SCID anchor co-spent outside every fixed participant block so callees can authenticate the
   * Solidity-visible logical caller address. */
  logicalIdentityUtxo?: UnlockableUtxo;
  /** Immutable SCID anchors of CALLEES whose Solidity-visible address is logical, co-spent so an external-call
   * identity check can prove the logical-to-physical binding. Appended after `logicalIdentityUtxo`, outside every
   * accounted band, and recreated at the matching output position. */
  externalIdentityAnchorUtxos?: UnlockableUtxo[];
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
  private batchEntriesBeforeDynamicChunks: boolean;
  private iterationEntryInputs: UnlockableUtxo[];
  private iterationEntriesPlacedAtDelegateBase = false;
  private insertLoopPredecessorInputs: UnlockableUtxo[];
  private keccakLoopSideCars: UnlockableUtxo[];
  private keccakLoopRecreates: Output[];
  private blockLayout?: FunctionBlockLayout;
  private logicalIdentityUtxo?: UnlockableUtxo;
  private externalIdentityAnchorUtxos: UnlockableUtxo[] = [];
  funderUtxos: UnlockableUtxo[];
  private funderChangeAddress?: Uint8Array;

  private externalCallStateUpdates: Map<
  string, Map<string, StateValue>
  > = new Map(); // categoryId -> (varName -> value)

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
  // varName -> ordered chunk commitments (hex) from auto-derivation; length determines chunk output count.
  private chunkRawCommitments: Map<string, string[]> = new Map();
  private loopEntryVars: Array<{
    collection: string; lockingBytecode: Uint8Array; categoryId?: string; delegate?: boolean; chunkable?: boolean;
  }> = [];
  // collection -> ordered loop entry commitments (hex) from auto-derivation; length = entry output count.
  private loopEntryCommitments: Map<string, string[]> = new Map();
  private requiredLoopEntryCounts: Map<string, number> = new Map();
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

  setJobEventsRedeemLock(lock: Uint8Array): this {
    if (lock.length === 35 && lock[0] === 0xaa && lock[1] === 0x20 && lock[34] === 0x87) {
      this.jobEventsRedeemLock = lock;
    }
    return this;
  }

  private lateValueChunkOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }> = [];
  // P5b (computed values): collections whose value chunks are DERIVED from the trace (the SDK has no value param to
  // build them). The covenant pins them, so their commitments come from auto-derivation like dynamicChunkVars.
  private valueChunkVars: Map<string, Uint8Array> = new Map(); // collection -> chunk-address locking bytecode
  private valueChunkRawCommitments: Map<string, string[]> = new Map(); // collection -> ordered chunk commitments (hex)
  private eventRawCommitments: Map<number, string> = new Map(); // emitIndex -> hex commitment (from auto-derivation)
  private pendingEventPlaceholders: Array<{ eventSignature: string; emitIndex: number }> = [];

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
    this.batchEntriesBeforeDynamicChunks = options.batchEntriesBeforeDynamicChunks ?? false;
    this.entryNfts = options.entryNfts ?? [];
    this.entryNftLockingBytecodes = options.entryNftLockingBytecodes ?? new Map();
    this.dynamicChunkVars = options.dynamicChunkVars ?? [];
    this.dynamicChunkInputs = options.dynamicChunkInputs ?? [];
    this.loopEntryVars = options.loopEntryVars ?? [];
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
    for (const group of this.lowLevelCallUtxoGroups) {
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
    this._swapMintingOffValueChunkBand();
    this._placeJobEventsPredecessorInputs(this.pendingJobEventsPredecessors);
    // Callee anchors precede the caller's own: emitLogicalMsgSenderAnchorResolution resolves the caller's
    // identity from the LAST input, so that tail position must stay the caller's.
    this.allInputs.push(...this.externalIdentityAnchorUtxos);
    if (this.logicalIdentityUtxo) this.allInputs.push(this.logicalIdentityUtxo);
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
      // Position-indexed array: each element goes at its slot.offset
      const positioned: (UnlockableUtxo | undefined)[] = new Array(this.blockLayout.blockSize);
      let dataNftIdx = 0, readOnlyIdx = 0, tcIdx = 0;
      let llcIdx = 0; // low-level call input index
      let bhIdx = 0; // blockhash co-spend index
      let bhOrdinal = 0;
      let kIdx = 0; // keccak256 compute side-car index
      let erIdx = 0; // ecrecover recovery-pair side-car index (flat A0,B0,A1,B1..)
      const trailingInputs = [
        ...this.iterationEntryInputs,
        ...this.insertLoopPredecessorInputs,
        ...this.dynamicChunkInputs,
      ];
      let trailingIdx = 0;
      // Each entry slot gets ITS OWN existing entry input (by slotIndex), or a funder if absent. Not a dense
      // pull from entryInputs: an absent lower slot must not shift a higher slot's entry into the gap (the
      // covenant reads each slot at its fixed offset).
      const entryInputBySlot = new Map<number, UnlockableUtxo>(
        this.entryNfts.filter((e) => e.exists && e.utxo).map((e) => [e.slotIndex, e.utxo!]),
      );

      for (const slot of this.blockLayout.slots) {
        switch (slot.kind) {
          case 'master': positioned[slot.offset] = this.masterUtxo; break;
          case 'dataNft':
            if (dataNftIdx < this.dataNftUtxos.length) positioned[slot.offset] = this.dataNftUtxos[dataNftIdx++];
            break;
          case 'readOnlyDataNft':
            if (readOnlyIdx < this.readOnlyDataNftUtxos.length) {
              positioned[slot.offset] = this.readOnlyDataNftUtxos[readOnlyIdx++];
            }
            break;
          case 'blockhashOracle':
            if ((this.blockhashCoSpendSlotOrdinals?.[bhIdx] ?? bhIdx) === bhOrdinal
              && bhIdx < this.blockhashCoSpendUtxos.length) {
              positioned[slot.offset] = this.blockhashCoSpendUtxos[bhIdx++];
            } else if (this.blockhashCoSpendSlotOrdinals) {
              const f = funderPool.shift();
              if (f) positioned[slot.offset] = f;
            }
            bhOrdinal++;
            break;
          case 'keccakSideCar':
            if (kIdx < this.keccakComputeCoSpendUtxos.length) {
              positioned[slot.offset] = this.keccakComputeCoSpendUtxos[kIdx++];
            }
            break;
          case 'ecrecoverSideCar':
            if (erIdx < this.ecrecoverComputeCoSpendUtxos.length) {
              positioned[slot.offset] = this.ecrecoverComputeCoSpendUtxos[erIdx++];
            }
            break;
          case 'entry': {
            // Delegate implementation inputs may intentionally occupy the same physical input offsets as grafted
            // proxy-state output slots. The implementation is the input; the entry NFT is produced only on output.
            if (positioned[slot.offset]) break;
            const entryInput = slot.slotIndex !== undefined ? entryInputBySlot.get(slot.slotIndex) : undefined;
            if (entryInput) positioned[slot.offset] = entryInput;
            else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
            break;
          }
          case 'satoshiContainer':
            if (satoshiContainerInputs.length > 0) positioned[slot.offset] = satoshiContainerInputs[0];
            break;
          case 'tokenContainer':
            if (tcIdx < tokenContainerInputs.length) positioned[slot.offset] = tokenContainerInputs[tcIdx++];
            else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
            break;
          case 'lowLevelCall':
            if (this.compilerRouteDelegateBlock) {
              // These are logical handler call slots inside the route block. The physical delegate implementation
              // is the route owner and lives after the complete block; nested participant groups are appended next.
              const f = funderPool.shift();
              if (f) positioned[slot.offset] = f;
              break;
            }
            // Place the actual low-level call input (target master) at its block layout
            // position so the compiler's emitBlockSlotIndex reads the correct INPUTBYTECODE.
            if (llcIdx < lowLevelCallInputs.length) {
              const callOffset = this.lowLevelCallInputBase ?? slot.offset;
              if (callOffset !== slot.offset) {
                for (let offset = slot.offset; offset < callOffset; offset++) {
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
            } else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
            break;
          case 'transfer': case 'tcTransfer': case 'event': case 'returnEvent':
          case 'deploy': {
            const f = funderPool.shift();
            if (f) positioned[slot.offset] = f;
            break;
          }
          case 'trailing': {
            if (trailingIdx < trailingInputs.length) {
              positioned[slot.offset] = trailingInputs[trailingIdx++];
            } else {
              const f = funderPool.shift();
              if (f) positioned[slot.offset] = f;
            }
            break;
          }
          default: break;
        }
      }
      if (this.blockLayout.trailingCapacity !== undefined
        && trailingIdx !== trailingInputs.length) {
        throw new Error(
          'Runtime resource inputs exceed balanced trailing capacity '
          + `(${trailingInputs.length} > ${this.blockLayout.trailingCapacity ?? 0})`,
        );
      }

      // Fill the reserved gap (offsets between last readOnly and first entry/SC/TC)
      // with external outState and external call inputs
      const gapInputs = [...externalOutStateInputs, ...externalCallInputs];
      let gapIdx = 0;
      for (let i = 0; i < positioned.length; i++) {
        if (positioned[i] === undefined && gapIdx < gapInputs.length) {
          positioned[i] = gapInputs[gapIdx++];
        }
      }

      // Compact: filter out any remaining undefined slots
      const result = positioned.filter((x): x is UnlockableUtxo => x !== undefined);

      return [
        ...result,
        // A compiler-route delegate owns the balanced block and must be the first participant after it.
        ...(this.compilerRouteDelegateBlock ? lowLevelCallInputs : []),
        // Any overflow gap inputs that didn't fit
        ...gapInputs.slice(gapIdx),
        // Remaining low-level call inputs not already positioned in block layout slots
        ...(this.compilerRouteDelegateBlock ? [] : lowLevelCallInputs.slice(llcIdx)), ...this.lowLevelCallRawInputs,
        // Legacy balanced layouts predate reserved trailing regions. Preserve their established dynamic
        // resource run immediately after the fixed block; only a layout declaring trailingCapacity consumes
        // these inputs positionally above.
        ...trailingInputs.slice(trailingIdx),
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
        + this.dynamicChunkInputs.length + this.insertLoopPredecessorInputs.length;
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
        ...this.iterationEntryInputs, ...this.dynamicChunkInputs, ...this.insertLoopPredecessorInputs,
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
        ...this.dynamicChunkInputs,
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
      ...this.dynamicChunkInputs,
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
    const next = selectLatestJobEventsChunks(
      persistedJobEventsByCategory.get(categoryId) ?? this.persistedJobEventsChunks,
      chunks,
    );
    if (next.length === 0) return;
    this.persistedJobEventsChunks = next;
    persistedJobEventsByCategory.set(categoryId, next);
  }

  static clearPersistedJobEvents(categoryId?: string): void {
    if (categoryId) {
      persistedJobEventsByCategory.delete(categoryId);
      persistedJobEventsValues.delete(categoryId);
      persistedJobEventsLocks.delete(categoryId);
      persistedJobEventsSpends.delete(categoryId);
      persistedJobEventsRecipes.delete(categoryId);
      stagedJobEventsValues.delete(categoryId);
      createdDigestLocks.delete(categoryId);
      persistedCreatedValues.delete(categoryId);
    } else {
      persistedJobEventsByCategory.clear();
      persistedJobEventsValues.clear();
      persistedJobEventsLocks.clear();
      persistedJobEventsSpends.clear();
      persistedJobEventsRecipes.clear();
      stagedJobEventsValues.clear();
      createdDigestLocks.clear();
      persistedCreatedValues.clear();
    }
    persistedJobEventsSendReady = false;
  }

  private _rootIsPublishJobPost(): boolean {
    return this.lowLevelCallUtxoGroups.some((group) => group.functionName === 'publishJobPost')
      || this.externalCallUtxoGroups.some((group) =>
        (group.functionName ?? group.logicalFunctionName) === 'publishJobPost');
  }

  /** Closed/CollateralWithdrawn replay previous persist v (nNew=3), not dest 15 emit. */
  private _shouldReplayPreviousPersist(): boolean {
    if (!this._shouldRematerializePersistUpdate()) return false;
    for (const group of [...this.lowLevelCallUtxoGroups, ...this.externalCallUtxoGroups]) {
      const names = [group.logicalFunctionName, group.functionName, group.compilerRoute?.abiFunction?.name];
      if (!names.includes('publishJobEvent')) continue;
      const event = (group.logicalFunctionArgs ?? group.functionArgs)?.[1];
      if (isPersistReplayJobEvent(event)) return true;
    }
    return false;
  }

  private _persistReplayWidth(): number {
    if (!this._shouldReplayPreviousPersist()) return 0;
    return persistUpdatePersistVWidth();
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
    const tokenReturns = new Set<number>();
    for (const group of this.externalCallUtxoGroups) {
      if (!isMintingBandSwapFunction(
        group.functionName ?? group.compilerRoute?.abiFunction.name ?? group.logicalFunctionName,
      )) continue;
      if (group.returnOutputIndex !== undefined && group.returnOutputIndex >= 0) {
        tokenReturns.add(group.returnOutputIndex);
      }
      const master = this.findMintingInputIndex(group.categoryId);
      if (master >= 0) {
        tokenReturns.add(tokenWriterReturnIndex(master, group.blockLayout, persistBand));
      }
    }
    const digestDests = new Set(persistDigestLockDests(this._executingPublishJobEventInputIndex(builder)));
    const dataNftDests = new Set(publishJobEventDataNftDests(this._executingPublishJobEventInputIndex(builder)));
    const restore = (start: number, endExclusive: number): void => {
      for (let index = start; index < endExclusive; index++) {
        if (emitDests.has(index)) continue;
        if (digestDests.has(index)) continue;
        if (dataNftDests.has(index)) continue;
        if (tokenReturns.has(index)) continue;
        if (persistBand && index >= persistBand.start && index <= persistBand.end) continue;
        const occupantCommit = String(builder.outputs[index]?.token?.nft?.commitment ?? '');
        if (isJobEventEmitCommitment(occupantCommit)) continue;
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

  private _publishJobEventAbi(): AbiFunction | undefined {
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
    return this._publishJobEventInputIndex();
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
      implIndex: this._publishJobEventInputIndex(),
      band: this.getPublishJobEventsBand(),
      tokenMaster,
      outputs,
    });
  }

  /** Prefer the builder input that evaluates publishJobEvent (`OP_INPUTINDEX`). */
  private _executingPublishJobEventInputIndex(builder?: TransactionBuilder): number {
    const inputs = builder?.inputs ?? this.allInputs;
    for (let index = inputs.length - 1; index >= 0; index--) {
      const name = (inputs[index]?.unlocker as { abiFunction?: { name?: string } } | undefined)
        ?.abiFunction?.name ?? '';
      if (name === 'publishJobEvent') return index;
    }
    return this._publishJobEventInputIndex();
  }

  /** The input that actually evaluates publishJobEvent (`OP_INPUTINDEX`). */
  private _publishJobEventInputIndex(): number {
    const namedUnlockers: number[] = [];
    for (const [index, input] of this.allInputs.entries()) {
      const name = (input as { unlocker?: { abiFunction?: { name?: string } } })
        .unlocker?.abiFunction?.name ?? '';
      if (name === 'publishJobEvent' || name.includes('publishJobEvent')) namedUnlockers.push(index);
    }
    const llcMasters: number[] = [];
    const implMintingInputs: number[] = [];
    const publishCategories = new Set<string>();
    for (const [llcIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
      const names = [group.logicalFunctionName, group.functionName, group.compilerRoute?.abiFunction?.name];
      if (!names.some((name) => name === 'publishJobEvent' || String(name ?? '').includes('publishJobEvent'))) {
        continue;
      }
      if (group.categoryId) publishCategories.add(group.categoryId);
      const master = this.getLowLevelCallMasterInputIndex(llcIndex);
      if (master >= 0) llcMasters.push(master);
    }
    for (const group of this.externalCallUtxoGroups) {
      const names = [group.logicalFunctionName, group.functionName, group.compilerRoute?.abiFunction?.name];
      if (!names.some((name) => name === 'publishJobEvent' || String(name ?? '').includes('publishJobEvent'))) {
        continue;
      }
      if (group.categoryId) publishCategories.add(group.categoryId);
    }
    for (const [index, input] of this.allInputs.entries()) {
      if (!input?.token?.category || !publishCategories.has(input.token.category)) continue;
      if (input.token.nft?.capability === 'minting') implMintingInputs.push(index);
    }
    return selectPublishJobEventInputIndex({
      namedUnlockers,
      llcMasters,
      implMintingInputs,
      persistReady: isPersistedJobEventsReady(),
      firstPublish: this._rootIsPublishJobPost(),
    });
  }

  /** publishJobEvent emit is implementation-relative (`INPUTINDEX + event.offset`). */
  private _scaledEmitOutputIndex(outputCount: number): number | undefined {
    // First publish already fills Created in the callee walk at layout dest.
    if (!isPersistedJobEventsReady() || this._rootIsPublishJobPost()) return undefined;
    const impl = this._publishJobEventInputIndex();
    // No executing publishJobEvent: do not invent dest as preserve-range-1
    // (that clobbered registerArbitrator dest 7 after persist became ready).
    if (impl < 0) return undefined;
    const offset = this._publishJobEventAbi()?.blockLayout?.slots
      .find((slot) => slot.kind === 'event')?.offset ?? 4;
    const dest = publishJobEventOutputIndex(impl, offset);
    if (dest >= 0 && (outputCount <= 0 || dest < outputCount)) return dest;
    return undefined;
  }

  /** Event dests that scaled 1:1 must not restore as tokenless P2PKH pads. */
  private _emitDestinationIndices(): number[] {
    const dests: number[] = [];
    const scaled = this._scaledEmitOutputIndex(this.allInputs.length);
    if (scaled !== undefined && scaled >= 0) dests.push(scaled);
    const publishImpl = this._publishJobEventInputIndex();
    const publishDest = publishJobEventOutputIndex(
      publishImpl,
      this._publishJobEventAbi()?.blockLayout?.slots.find((slot) => slot.kind === 'event')?.offset ?? 4,
    );
    if (publishDest >= 0) dests.push(publishDest);
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
    const reserved = new Set<number>();
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
      suffixStart: suffixStart ?? Math.max(0, this.allInputs.length - 1),
      tokenWriterPresent: this.externalCallUtxoGroups.some((group) =>
        isMintingBandSwapFunction(group.functionName ?? group.compilerRoute?.abiFunction.name
          ?? group.logicalFunctionName)),
    };
  }

  /**
   * Live publishJobEvent value-chunk band (`impl + blockSize` for `nNew` slots).
   * Occupancy, view tails, and FakeToken rotation all share this range.
   */
  getPublishJobEventsBand(): { start: number; end: number; nNew: number } | undefined {
    const publishLlcIndex = this.lowLevelCallUtxoGroups.findIndex((group) =>
      group.functionName === 'publishJobEvent');
    const publishExternal = this.externalCallUtxoGroups.find((group) =>
      (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent');
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
    // The executing verifier is the entry delegate (MarketplaceV1 impl), which
    // pins chunks at INPUTINDEX+trailingBase. MD's proxy master sits earlier
    // (input 12 vs impl 15); using that base leaves view tails on impl+5.
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
      ...this.externalCallUtxoGroups.map((group) => group.valueChunkOutputCount ?? 0),
      ...this.lowLevelCallUtxoGroups.map((group) => group.valueChunkOutputCount ?? 0),
      ...liveChunkSlotsByOwner(this.externalCallUtxoGroups).values(),
    );
    const jobEventsCount = [...new Set(
      this.getLoopEntryCommitments('jobEvents')
        .filter((commitment) => !isEmptyValueChunkCommitment(commitment)),
    )].length;
    const publishCategory = publishExternal?.categoryId
      ?? (publishLlcIndex >= 0 ? this.lowLevelCallUtxoGroups[publishLlcIndex].categoryId : undefined);
    const persistWidth = isPersistedJobEventsReady() && !this._rootIsPublishJobPost()
      ? persistedJobEventsWidth(publishCategory) : 0;
    const plannedInserts = Math.max(
      0,
      ...(publishExternal?.plannedEntryInserts?.length !== undefined
        ? [publishExternal.plannedEntryInserts.length] : []),
      ...this.lowLevelCallUtxoGroups
        .filter((group) => group.functionName === 'publishJobEvent')
        .map((group) => group.plannedEntryInserts?.length ?? 0),
    );
    const insertShift = persistWidth > 0 ? 0
      : (plannedInserts > 0 || jobEventsCount === 0 ? 1 : 0);
    // Persist dest is INPUTINDEX+event.offset of the executing publishJobEvent.
    // The value-chunk band is impl+blockSize. If those disagree, dest can land
    // on a persist predecessor (output 20/21) and mutable conservation fails.
    if (persistWidth > 0) {
      const emitImpl = this._publishJobEventInputIndex();
      const emitOffset = (publishFn as AbiFunction | undefined)?.blockLayout?.slots
        .find((slot) => slot.kind === 'event')?.offset ?? 4;
      if (emitImpl >= 0) bases.push(emitImpl + emitOffset + 1);
    }
    const layoutStart = bases.length > 0 ? Math.max(...bases) + insertShift : undefined;
    const forcedStart = this.forcedJobEventsBandStart;
    const publishImpl = this._publishJobEventInputIndex();
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
    const layoutDest = persistValueChunkBase(publishImpl, publishBlockSize, keepAtLayout);
    // Persist UPDATE + FakeToken on dest 20: keep persist at dest 20 and swap
    // FakeToken after dest+nNew. Whitelist pads keep the dest-25 slide.
    const preserveEndExclusive = keepAtLayout
      ? -1
      : (isPersistedJobEventsReady() && !this._rootIsPublishJobPost()
        ? (this._entryScaledPreserveRange()?.endExclusive ?? -1)
        : -1);
    const forcedLayoutStart = keepAtLayout && layoutDest >= 0 ? layoutDest : undefined;
    const derivedWidth = layoutStart === undefined ? 0
      : [...this.derivedChunkOutputs.keys()].filter((index) => index >= layoutStart).length;
    // Live covenant nNew (extracted/persisted v) wins over a short compose plan
    // so the missing continuation (first post slot 25) is reserved. Persist is
    // cleared on deploy, so a prior test's Created extract cannot inflate this.
    const persistReady = isPersistedJobEventsReady() && !this._rootIsPublishJobPost();
    const executingImpl = this._executingPublishJobEventInputIndex();
    const persistFloor = persistJobEventsBandFloor(executingImpl, persistReady);
    if (persistReady && persistFloor >= 0
      && (forcedLayoutStart ?? layoutStart) === undefined
      && executingImpl < 0) {
      return undefined;
    }
    return computePublishJobEventsBand({
      start: forcedLayoutStart ?? layoutStart,
      preserveEndExclusive: Math.max(preserveEndExclusive, forcedStart ?? -1),
      persistFloor,
      plannedWidth,
      jobEventsCount,
      liveWidth: liveJobEventsBandWidth({ plannedWidth, persistWidth, derivedWidth }),
    });
  }

  /** Grow publishJobEvent `valueChunkOutputCount` to the extracted continuation width. */
  bumpPublishJobEventsWidth(nNew: number): void {
    if (nNew <= 0) return;
    for (const group of this.externalCallUtxoGroups) {
      if ((group.functionName ?? group.logicalFunctionName) !== 'publishJobEvent') continue;
      group.valueChunkOutputCount = Math.max(group.valueChunkOutputCount ?? 0, nNew);
    }
    for (const group of this.lowLevelCallUtxoGroups) {
      if (group.functionName !== 'publishJobEvent') continue;
      group.valueChunkOutputCount = Math.max(group.valueChunkOutputCount ?? 0, nNew);
    }
  }

  /**
   * Same-count swap: move a transferFrom/transfer minting block off publishJobEvent
   * value-chunk slots (typically 22-25 ↔ 26-29). TXOUTPUTCOUNT and jobs suffix stay put.
   */
  private _swapMintingOffValueChunkBand(): void {
    const tokenGroup = this.externalCallUtxoGroups.find((group) =>
      group.sharedGroupIndex === undefined
      && isMintingBandSwapFunction(group.functionName ?? group.compilerRoute?.abiFunction.name));
    if (!tokenGroup?.categoryId) return;
    const previousSwap = this.mintingOutputSwap;
    const start = this.findMintingInputIndex(tokenGroup.categoryId);
    if (start < 0) { this.mintingOutputSwap = undefined; return; }
    const band = this.getPublishJobEventsBand();
    if (!band) return;
    const { start: jobEventsStart, nNew } = band;
    const persistUpdate = isPersistedJobEventsReady() && !this._rootIsPublishJobPost();
    const keepAtLayout = shouldKeepPersistAtLayoutBase({
      persistReady: persistUpdate,
      firstPublish: this._rootIsPublishJobPost(),
      layoutDestOccupiedByMintingWriter: this.hasMintingBandTokenWriter(),
    });
    const persistDests = persistUpdatePredecessorDests({
      implIndex: this._publishJobEventInputIndex(),
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
    let availableFunders = 0;
    while (start + tokenWidth + availableFunders < this.allInputs.length
      && this.allInputs[start + tokenWidth + availableFunders]
      && !this.allInputs[start + tokenWidth + availableFunders].token) {
      availableFunders += 1;
    }
    const fullMinShift = Math.max(1, bandEnd - start);
    if (availableFunders < fullMinShift) {
      const inUse = new Set(this.allInputs.map((input) => `${input.txid}:${input.vout}`));
      for (const funder of this.funderUtxos) {
        if (availableFunders >= fullMinShift) break;
        const key = `${funder.txid}:${funder.vout}`;
        if (inUse.has(key)) continue;
        this.allInputs.splice(start + tokenWidth + availableFunders, 0, funder);
        inUse.add(key);
        availableFunders += 1;
      }
    }
    const minShift = fullMinShift;
    const shift = chooseMintingSwapShift(availableFunders, minShift);
    if (shift === 0) return;
    const tokenBlock = this.allInputs.slice(start, start + tokenWidth);
    const funderBlock = this.allInputs.slice(start + tokenWidth, start + tokenWidth + shift);
    this.allInputs.splice(start, tokenWidth + shift, ...funderBlock, ...tokenBlock);
    this.mintingOutputSwap = { from: start, width: shift, categoryId: tokenGroup.categoryId };
    this._placeJobEventsPredecessorInputs(this.pendingJobEventsPredecessors);
    const newMaster = this.findMintingInputIndex(tokenGroup.categoryId);
    if (newMaster < 0) return;
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
    return this.externalCallUtxoGroups.find((group) =>
      (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent')?.categoryId
      ?? this.lowLevelCallUtxoGroups.find((group) => group.functionName === 'publishJobEvent')?.categoryId;
  }

  /** Persist chunks are proxy-category; the LLC master is the impl minting category. */
  private _persistJobEventsTokenCategory(): string | undefined {
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
      const sameLock = persistHex !== '' && binToHex(lock) === persistHex;
      const commitment = String(input.token.nft.commitment ?? '');
      const sameCategory = !!persistCategory && input.token.category === persistCategory
        && (persistUpdate
          ? isPersistValueChunkCommitment(commitment)
          : /^(00|01|02|03|04|05)/.test(commitment));
      if (!fromPersistExtras && !sameLock && !sameCategory) return;
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
    const impl = this._executingPublishJobEventInputIndex();
    const dests = persistUpdatePredecessorDests({
      implIndex: impl,
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
        impl,
        band,
        dests,
        dest18cap: dest18?.token?.nft?.capability ?? 'plain',
        dest18cat: dest18?.token?.category?.slice(0, 16),
        dest18commit: String(dest18?.token?.nft?.commitment ?? '').slice(0, 16),
      });
    }
    const placements = assignPersistPredecessors(
      dests, candidates, impl, persistUpdate,
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
    if (persistUpdate) {
      const recipeLock = persistUpdateDigestLock(
        persistCategory ?? this.allInputs[dests[0]]?.token?.category,
        this._persistDigestCategories(),
      ) ?? persistLock;
      const entryDest = persistValueChunkBase(impl, 5, true);
      const digestDests = new Set([
        dests[0],
        entryDest,
      ].filter((dest): dest is number => dest !== undefined && dest >= 0));
      for (const dest of digestDests) {
        const input = this.allInputs[dest];
        if (!recipeLock || recipeLock.length !== 35 || !input?.token || !input.unlocker) continue;
        const current = input.unlocker.generateLockingBytecode();
        if (current.length === 35 && binToHex(current) === binToHex(recipeLock)) continue;
        const inner = input.unlocker;
        this.allInputs[dest] = {
          ...input,
          unlocker: {
            generateLockingBytecode: () => recipeLock,
            generateUnlockingBytecode: (context) => inner.generateUnlockingBytecode(context),
          },
        };
      }
      if (recipeLock && recipeLock.length === 35) {
        for (const dest of digestDests) pinPersistDigestInput(this.allInputs, dest, recipeLock);
      }
    }
  }

  /**
   * After extraTransfer, persist predecessors are often missing from `allInputs`.
   * Fetch the last successful jobEvents spends and pin them on the live band.
   */
  async ensurePersistedJobEventsInputs(): Promise<void> {
    if (this._rootIsPublishJobPost()) return;
    const tokenWriterPresent = this.externalCallUtxoGroups.some((group) =>
      isMintingBandSwapFunction(group.functionName ?? group.compilerRoute?.abiFunction.name
        ?? group.logicalFunctionName));
    if (!tokenWriterPresent) return;
    const writerNames = new Set([
      ...this.lowLevelCallUtxoGroups.map((group) => group.functionName),
      ...this.externalCallUtxoGroups.map((group) => group.logicalFunctionName ?? group.functionName),
    ]);
    if (!writerNames.has('withdrawCollateral') && !writerNames.has('updateJobPost')) return;
    const band = this.getPublishJobEventsBand();
    const categoryId = this._persistJobEventsTokenCategory() ?? this._jobEventsPublishCategory();
    if (!band || !categoryId || !isPersistedJobEventsReady()) return;
    const persistLock = persistedJobEventsLocks.get(categoryId)
      ?? firstPersisted(persistedJobEventsLocks, categoryId);
    const persistValue = persistedJobEventsValues.get(categoryId)
      ?? firstPersisted(persistedJobEventsValues, categoryId);
    const spends = persistedJobEventsSpends.get(categoryId)
      ?? firstPersisted(persistedJobEventsSpends, categoryId)
      ?? [];
    const extras: UnlockableUtxo[] = [];
    const publish = this.externalCallUtxoGroups.find((group) =>
      (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent')
      ?? this.lowLevelCallUtxoGroups.find((group) => group.functionName === 'publishJobEvent');
    const contract = publish?.externalContract?.inner;
    if (persistValue && persistLock) rememberJobEventsUnlockRecipe(categoryId);
    const recipe = persistedJobEventsUnlockRecipe(categoryId);
    const unlockCategory = recipe?.categoryId ?? categoryId;
    const unlockMaster = this.findMintingInputIndex(unlockCategory);
    const unlocker = contract && unlockMaster >= 0 && recipe
      ? createValueChunkUnlocker(
        contract, unlockMaster, unlockCategory, recipe.collection, recipe.slot, recipe.root,
      )
      : undefined;
    if (unlocker) {
      for (const spend of spends) {
        const spendLock = spend.lockingBytecode;
        extras.push({
          txid: spend.txid,
          vout: spend.vout,
          satoshis: spend.satoshis,
          token: spend.token,
          unlocker: spendLock && spendLock.length === 35
            ? {
              generateLockingBytecode: () => spendLock,
              generateUnlockingBytecode: (context) => unlocker.generateUnlockingBytecode(context),
            }
            : unlocker,
        });
      }
    }
    if (extras.length === 0 && unlocker && persistLock && this.builderOptions.provider) {
      try {
        const encoded = lockingBytecodeToCashAddress({
          bytecode: persistLock,
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
      const lock = tokenGroup.batchEntryLockingBytecodes?.get(slot.offset)
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
   * After the minting-band swap, extra FakeToken none-cap tails sit past the
   * event/return slots. transferFrom's event pin then WITHIN-fails at ip 2439.
   */
  private _constrainSwappedTokenImmutableOutputs(builder: TransactionBuilder): void {
    if (!this.mintingOutputSwap) return;
    const master = this.findMintingInputIndex(this.mintingOutputSwap.categoryId);
    if (master < 0) return;
    const tokenGroup = this.externalCallUtxoGroups.find((group) =>
      group.categoryId === this.mintingOutputSwap?.categoryId && group.sharedGroupIndex === undefined);
    const layout = tokenGroup?.blockLayout;
    if (!layout) return;
    const allowed = new Set<number>();
    for (const slot of layout.slots) {
      if (slot.kind === 'event' || slot.kind === 'returnEvent') allowed.add(master + slot.offset);
    }
    for (const [groupIdx, group] of this.externalCallUtxoGroups.entries()) {
      if ((group.sharedGroupIndex ?? groupIdx) !== this.externalCallUtxoGroups.indexOf(tokenGroup!)) continue;
      if (!groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, groupIdx)) continue;
      const placed = group.plannedReturnOutputIndex ?? group.returnOutputIndex;
      if (placed !== undefined) allowed.add(placed);
    }
    constrainOwnCategoryImmutableOutputs(builder.outputs, this.mintingOutputSwap.categoryId, allowed);
  }

  /** Inactive Approval/Transfer slots must carry an empty commitment (SIZE==0). */
  private _clearDummyTokenEventCommitments(builder: TransactionBuilder): void {
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined) continue;
      const name = group.functionName ?? group.compilerRoute?.abiFunction.name;
      if (name !== 'transferFrom' && name !== 'transfer' && name !== 'approve') continue;
      let master = this.findMintingInputIndex(group.categoryId);
      if (master < 0) master = this.getExternalCallMasterInputIndex(groupIndex);
      if (master < 0 || !group.blockLayout) continue;
      let eventOrdinal = 0;
      for (const slot of group.blockLayout.slots) {
        if (slot.kind !== 'event') continue;
        const learned = group.eventOutputs?.[eventOrdinal];
        eventOrdinal += 1;
        const learnedCommit = String(learned?.commitment ?? '');
        // `SCID` marks an empty message-bus identity carrier; it is not evidence that a conditional token event
        // was emitted. The generic empty-carrier pass can temporarily tag an inactive Approval/Transfer slot and
        // route-event discovery can then echo that marker into `eventOutputs`. Treat it as unresolved so the
        // token function observes the required SIZE==0 at this physical slot.
        const learnedIsDummy = learnedCommit === '' || /^(00)+$/.test(learnedCommit)
          || learnedCommit.toLowerCase() === '53434944';
        if (learned && !learnedIsDummy) continue;
        const existing = builder.outputs[master + slot.offset];
        if (!existing?.token || existing.token.nft?.capability !== 'none') continue;
        const raw: unknown = existing.token.nft.commitment;
        const isDummy = raw instanceof Uint8Array
          ? raw.length === 0 || raw.every((byte) => byte === 0) || binToHex(raw) === '53434944'
          : (() => {
            const hex = String(raw ?? '');
            return hex === '' || /^(00)+$/.test(hex) || hex.toLowerCase() === '53434944';
          })();
        if (!isDummy) continue;
        // Token-free: OUTPUTTOKENCOMMITMENT size is 0. An empty-commitment
        // NFT can still serialize as 32 zero bytes and fail the not-taken pin.
        delete existing.token;
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
    const writesJobEvents = this.externalCallUtxoGroups.some(groupWritesPublishedJobEvents)
      || this.lowLevelCallUtxoGroups.some(groupWritesPublishedJobEvents)
      || this.loopEntryVars.some((variable) => variable.collection === 'jobEvents');
    if (!writesJobEvents) return;
    const plannedByLock = new Map<string, { lock: Uint8Array; planned: number }>();
    const remember = (lock: Uint8Array, planned: number): void => {
      if (lock.length === 0 || planned <= 0) return;
      const key = binToHex(lock);
      const existing = plannedByLock.get(key);
      plannedByLock.set(key, { lock, planned: Math.max(existing?.planned ?? 0, planned) });
    };
    for (const variable of this.loopEntryVars) {
      if (variable.collection !== 'jobEvents' && variable.chunkable !== true) continue;
      const required = this.getRequiredLoopEntryCount(variable.collection);
      remember(variable.lockingBytecode, required > 0 ? required : 2);
    }
    // Nested MarketplaceData jobEvents often live on the data-NFT category while the
    // executing group is the implementation minting category. Key by lockscript, and
    // only the collection whose values carry a JobEvent payload — never every p2sh32
    // (users/arbitrator inserts also mix empty+real mutables).
    if (writesJobEvents) {
      const byLock = new Map<string, { lock: Uint8Array; commitments: string[] }>();
      for (const output of builder.outputs) {
        const lock = output.to instanceof Uint8Array ? output.to : undefined;
        if (!lock || lock.length !== 35 || lock[0] !== 0xaa || lock[1] !== 0x20) continue;
        if (output.token?.nft?.capability !== 'mutable') continue;
        const key = binToHex(lock);
        const raw = output.token.nft?.commitment as Uint8Array | string | undefined;
        const commitment = raw instanceof Uint8Array ? binToHex(raw) : (raw ?? '');
        const group = byLock.get(key) ?? { lock, commitments: [] };
        group.commitments.push(commitment);
        byLock.set(key, group);
      }
      for (const { lock, commitments } of byLock.values()) {
        const eventPayload = commitments.some((commitment) => {
          const hex = commitment.toLowerCase();
          return hex.includes('437265617465') || hex.includes('57686974656c697374');
        });
        if (eventPayload) remember(lock, 2);
      }
    }
    for (const { lock, planned } of plannedByLock.values()) {
      stripSurplusEmptyCollectionEntries(builder.outputs, lock, planned);
    }
  }

  /**
   * Nested mutable inputs (MarketplaceData collection UTXOs sitting past the impl
   * master) must reappear at their input index. publishJobEvent's event NFT can
   * land on that coordinate (fixture arb+whitelist: output 21). Overwrite in place
   * and park the event on a later pad so tails 38-40 and the jobs suffix stay put.
   */
  private _reassertNestedSameIndexMutables(builder: TransactionBuilder): void {
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
        twinToken.nft = {
          ...twinToken.nft,
          commitment: predNewIndex >= 0
            ? (builder.outputs[predNewIndex].token?.nft?.commitment ?? twinToken.nft.commitment)
            : synthesizePredNewCommitment(inputCommit, newSlot),
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
      const reservedNew = index + INSERT_NEW_OUTPUT_OFFSET;
      const twinOptions = {
        tailStart: Number.isFinite(tailStart) ? tailStart : suffixStart,
        suffixStart,
        reservedIndexes: [reservedNew],
        skipLocks,
      };
      if (!placeSameIndexTwin(builder.outputs, index, twin, twinOptions)) continue;
      let newSource = -1;
      let newCommit = newSlot;
      for (let later = index + 1; later < builder.outputs.length; later++) {
        if (later === reservedNew) continue;
        const output = builder.outputs[later];
        if (!outputMatchesLock(output, twinLock)) continue;
        if (output.token?.category !== category || output.token?.nft?.capability !== 'mutable') continue;
        const commit = commitHex(output.token.nft?.commitment as Uint8Array | string | undefined);
        if (isSortedEntryNodeCommitment(commit)) {
          newSource = later;
          newCommit = commit;
          break;
        }
      }
      if (newSlot) {
        placeInsertNewAt(builder.outputs, index, {
          to: twinLock,
          amount: 1200n,
          token: {
            amount: 0n,
            category,
            nft: { capability: 'mutable', commitment: newCommit },
          },
        }, twinOptions);
        if (newSource >= 0 && newSource !== reservedNew) {
          builder.outputs[newSource] = { to: Uint8Array.of(0x51), amount: 1000n };
        }
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
   * Data NFTs are 1:1 at INPUTINDEX. Occupancy (INSERT NEW at pred+2, leftover
   * pads) can copy NFT 0's commitment onto NFT 1 (output 17 = 0023aa20 vs 5121).
   */
  private _reassertNestedDataNftTwins(builder: TransactionBuilder): void {
    const nestedCategories = new Set(
      this.externalCallUtxoGroups.map((group) => group.categoryId).filter((id): id is string => !!id),
    );
    for (let index = 0; index < this.allInputs.length; index++) {
      const input = this.allInputs[index];
      const category = input.token?.category;
      if (!category || !nestedCategories.has(category)) continue;
      if (input.token?.nft?.capability !== 'mutable') continue;
      if (!('unlocker' in input) || !input.unlocker) continue;
      const inputCommit = typeof input.token.nft?.commitment === 'string'
        ? input.token.nft.commitment
        : input.token.nft?.commitment
          ? binToHex(input.token.nft.commitment as Uint8Array)
          : '';
      if (!isDataNftIndexCommitment(inputCommit)) continue;
      const existing = builder.outputs[index];
      const existingCommit = existing?.token?.nft?.commitment;
      const existingHex = typeof existingCommit === 'string'
        ? existingCommit
        : existingCommit ? binToHex(existingCommit as Uint8Array) : '';
      if (existingHex.toLowerCase() === inputCommit.toLowerCase()
        && existing?.token?.category === category
        && existing.token.nft?.capability === 'mutable') {
        continue;
      }
      builder.outputs[index] = {
        to: input.unlocker.generateLockingBytecode(),
        amount: input.satoshis,
        token: cloneToken(input.token),
      };
    }
  }

  /** Keep `__internal__valueChunkOutputBase` on the live persist band, not a stale entry dest. */
  private _refreshPublishJobEventsChunkBase(builder?: TransactionBuilder): void {
    const start = this.getPublishJobEventsBand()?.start;
    if (start === undefined || start < 0) return;
    let changed = false;
    for (const group of [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]) {
      if ((group.functionName ?? group.logicalFunctionName) !== 'publishJobEvent') continue;
      const current = group.internalArgs?.__internal__valueChunkOutputBase;
      if (current === BigInt(start) || current === start) continue;
      group.refreshInternalArgs?.({ __internal__valueChunkOutputBase: BigInt(start) });
      changed = true;
    }
    if (!changed) return;
    this._refreshInputs();
    if (builder) this._syncBuilderUnlockers(builder);
  }

  /**
   * Do not clone dest 9–10 MarketplaceData data-NFTs onto dest impl+1/impl+2.
   * publishJobEvent counts outputs with that lock and NUMEQUALVERIFYs 2; a
   * clone makes dest 9,10,12,13 all match (4 vs 2). Dest 8 1:1 also requires
   * dest 9–10 to stay on their own inputs. Dest 12–13 keep 1:1 with theirs.
   */
  private _reassertPublishJobEventDataNftOneToOnes(_builder: TransactionBuilder): void {
    return;
  }

  /** Dest 0/1 are the executing proxy's minting + data NFT. Persist must not keep a foreign lock there. */
  private _reassertProxyPreserveOneToOnes(builder: TransactionBuilder): void {
    if (!isPersistedJobEventsReady() || this._rootIsPublishJobPost()) return;
    for (const index of [0, 1]) {
      const input = this.allInputs[index];
      if (!input?.token || !('unlocker' in input) || !input.unlocker) continue;
      const inputCommit = String(input.token.nft?.commitment ?? '');
      if (index === 1 && !isDataNftIndexCommitment(inputCommit)) continue;
      if (index === 0 && input.token.nft?.capability !== 'minting') continue;
      const existing = builder.outputs[index];
      const existingLock = existing?.to instanceof Uint8Array
        ? existing.to
        : existing?.to !== undefined ? addressToLockScript(existing.to) : undefined;
      const existingCommit = String(existing?.token?.nft?.commitment ?? '');
      const persistOccupant = isPersistValueChunkCommitment(existingCommit)
        || (existingLock !== undefined && existingLock.length === 35
          && existingLock[0] === 0xaa && existingLock[1] === 0x20 && existingLock[34] === 0x87
          && isPersistValueChunkCommitment(existingCommit));
      const inputLock = input.unlocker.generateLockingBytecode();
      const sameLock = existingLock !== undefined && binToHex(existingLock) === binToHex(inputLock);
      if (sameLock && !persistOccupant) continue;
      if (!persistOccupant && existing?.token?.category === input.token.category
        && isDataNftIndexCommitment(existingCommit)) {
        if (sameLock) continue;
        builder.outputs[index] = {
          to: inputLock,
          amount: existing?.amount ?? input.satoshis,
          token: existing.token,
        };
        continue;
      }
      builder.outputs[index] = {
        to: inputLock,
        amount: input.satoshis,
        token: cloneToken(input.token),
      };
    }
  }

  /**
   * publishJobEvent's event slot is impl+offset. Occupancy parks SCID/short
   * data-NFT clones there; the emit pin still names that coordinate.
   */
  private _reassertNestedEmitEvents(builder: TransactionBuilder): void {
    const publishFn = this._publishJobEventAbi();
    const eventOffset = publishFn?.blockLayout?.slots.find((slot) => slot.kind === 'event')?.offset ?? 4;
    const proxyGroup = this.externalCallUtxoGroups.find((candidate) => {
      const candidateNames = [
        candidate.logicalFunctionName, candidate.functionName, candidate.compilerRoute?.abiFunction?.name,
      ];
      return candidateNames.includes('publishJobEvent');
    });
    const llcIndex = this.lowLevelCallUtxoGroups.findIndex((group) => {
      const names = [group.logicalFunctionName, group.functionName, group.compilerRoute?.abiFunction?.name];
      return names.includes('publishJobEvent');
    });
    const impl = this._executingPublishJobEventInputIndex(builder);
    const dest = impl >= 0
      ? publishJobEventOutputIndex(impl, eventOffset)
      : this._scaledEmitOutputIndex(builder.outputs.length)
        ?? -1;
    const persistEmitEarly = this._shouldRematerializePersistUpdate();
    if (dest < 0 || (impl >= 0 && dest <= impl)) {
      const fallback = publishJobEventOutputIndex(impl, eventOffset);
      if (fallback >= 0) {
        relocateJobEventEmitToDest(builder.outputs, fallback, {
          persistCloneOk: !persistEmitEarly,
          preferCreated: this._rootIsPublishJobPost(),
        });
      }
      return;
    }
    const categoryId = this._persistJobEventsTokenCategory()
      ?? proxyGroup?.categoryId
      ?? (llcIndex >= 0 ? this.lowLevelCallUtxoGroups[llcIndex].categoryId : undefined);
    const emitInfo = publishFn?.emits?.[0];
    const derived = proxyGroup?.eventOutputs?.[0]
      ?? (llcIndex >= 0 ? this.lowLevelCallUtxoGroups[llcIndex].eventOutputs?.[0] : undefined);
    if (!categoryId) return;
    const minting = this.findMintingInputIndex(categoryId);
    if (minting >= 0 && dest === minting) return;
    const addressType = proxyGroup?.externalContract?.inner?.addressType
      ?? (llcIndex >= 0 ? this.lowLevelCallUtxoGroups[llcIndex].externalContract?.inner?.addressType : undefined)
      ?? 'p2sh32';
    const emitSignature = emitInfo?.eventSignature ?? 'JobEvent(uint256,JobEventData)';
    const lockingBytecode = scriptToLockingBytecode(
      buildEventNftCovenantScript(hexToBin(categoryId), computeEventNameHash(emitSignature)),
      addressType,
    );
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
    // Closed (7) dest stays `0057000000` — the MD data-NFT pin EQUALVERIFYs that.
    // CollateralWithdrawn (16) dest is `0060000004||time` — the impl emit pin.
    const stampWithdraw = emptyAddressEvent && eventType === 16 && now > 0n;
    const emitEvent = stampWithdraw
      ? stampEmptyJobEventTimestamp(visibleArgs![1], now)
      : visibleArgs?.[1];
    const persistReadyInsert = (jobEventTypeOf(emitEvent) === 14 || jobEventTypeOf(emitEvent) === 15)
      && isPersistedJobEventsReady() && !this._rootIsPublishJobPost();
    const constructedCommit = emitEvent !== undefined && (emptyAddressEvent || persistReadyInsert)
      ? encodeJobEventEmitCommitment(visibleArgs![0], emitEvent, structs)
      : undefined;
    const persistEmit = this._shouldRematerializePersistUpdate();
    const persistReady = isPersistedJobEventsReady() && !this._rootIsPublishJobPost();
    placePublishJobEventOutput(builder.outputs, dest, {
      to: lockingBytecode,
      amount: 1200n,
      token: {
        amount: 0n,
        category: categoryId,
        nft: { capability: 'none', commitment: constructedCommit ?? derived?.commitment ?? '' },
      },
    }, {
      clearClonedStub: persistEmit,
      refuseEmpty: persistEmit && !constructedCommit,
      persistCloneOk: !persistEmit,
      destInput: this.allInputs[dest],
    });
    if (persistReady && dest >= 0) {
      this.forcedJobEventsBandStart = dest + 1;
      this._placeJobEventsPredecessorInputs(this.pendingJobEventsPredecessors);
      this._materializeJobEventsBand(builder);
      this._reassertPersistedJobEventsOneToOnes(builder, dest);
    }
    const executingDest = dest >= 0
      ? dest
      : publishJobEventOutputIndex(this._publishJobEventInputIndex(), eventOffset);
    if (executingDest >= 0) {
      relocateJobEventEmitToDest(builder.outputs, executingDest, {
        persistCloneOk: !persistEmit,
        preferCreated: this._rootIsPublishJobPost(),
      });
      const placedOut = builder.outputs[executingDest];
      const placedCommit = String(placedOut?.token?.nft?.commitment ?? '');
      if (isJobEventEmitCommitment(placedCommit) || isCreatedJobEventCommitment(placedCommit)) {
        builder.outputs[executingDest] = {
          to: lockingBytecode,
          amount: placedOut?.amount && placedOut.amount >= 1200n ? placedOut.amount : 1200n,
          token: placedOut?.token,
        };
      }
    }
    this._repairPublishJobEventDestLocks(builder);
  }

  /** Persist-ready entry dest is INPUTINDEX+3 (`aa204736` + H(0)||zeros||persistHead). */
  private _repairPublishJobEventEntryDest(builder: TransactionBuilder): void {
    if (!isPersistedJobEventsReady() || this._rootIsPublishJobPost()) return;
    const impl = this._executingPublishJobEventInputIndex(builder);
    if (impl < 0) return;
    const dest = persistValueChunkBase(impl, 5, true);
    if (dest < 0 || dest >= builder.outputs.length) return;
    const categoryId = this._persistJobEventsTokenCategory()
      ?? this._jobEventsPublishCategory()
      ?? builder.outputs[dest]?.token?.category;
    const locking = persistUpdateDigestLock(categoryId, this._persistDigestCategories());
    if (!locking || locking.length !== 35) return;
    const persistDests = persistUpdatePredecessorDests({
      implIndex: impl,
      persistUpdate: true,
      keepAtLayout: shouldKeepPersistAtLayoutBase({
        persistReady: true,
        firstPublish: false,
        layoutDestOccupiedByMintingWriter: this.hasMintingBandTokenWriter(),
      }),
      bandStart: this.getPublishJobEventsBand()?.start ?? dest + 2,
      nNew: this.getPublishJobEventsBand()?.nNew ?? 2,
    });
    const persistValue = firstPersisted(stagedJobEventsValues)
      ?? firstPersisted(persistedJobEventsValues)
      ?? (categoryId ? persistedJobEventsValue(categoryId) : undefined)
      ?? recoverPersistValueFromOutputs(builder.outputs, persistDests);
    const extracted = this.externalCallEntryOutputsByIndex.get(dest)?.commitment;
    const entryCommit = (extracted
      && extracted.toLowerCase().startsWith('e3b0c442')
      && extracted.length >= 256 ? extracted : undefined)
      ?? persistUpdateEntryCommitment(persistValue);
    const existing = builder.outputs[dest];
    const existingToken = existing?.token;
    const inputToken = this.allInputs[dest]?.token;
    // UTXOBYTECODE dest spends the persist entry NFT. Keep that UTXO's category
    // (ee643a16), not the persist-v proxy category, or the entry covenant fails.
    const baseToken = (inputToken?.nft?.capability === 'mutable' ? cloneToken(inputToken) : undefined)
      ?? (existingToken?.category === categoryId ? existingToken : undefined)
      ?? (inputToken?.category === categoryId ? cloneToken(inputToken) : undefined)
      ?? existingToken
      ?? (categoryId
        ? { amount: 0n, category: categoryId, nft: { capability: 'mutable' as const, commitment: '' } }
        : undefined);
    const nextCommit = entryCommit ?? String(baseToken?.nft?.commitment ?? '');
    builder.outputs[dest] = {
      to: locking,
      amount: existing?.amount && existing.amount >= 1200n ? existing.amount : 1200n,
      token: baseToken
        ? {
          amount: baseToken.amount ?? 0n,
          category: baseToken.category ?? categoryId,
          nft: { capability: 'mutable', commitment: nextCommit },
        }
        : existingToken,
    };
  }

  /** Persist-ready emit dest is INPUTINDEX+4 with the proxy/CREATE event covenant. */
  private _repairPublishJobEventEmitDest(builder: TransactionBuilder): void {
    if (!isPersistedJobEventsReady() || this._rootIsPublishJobPost()) return;
    const impl = this._executingPublishJobEventInputIndex(builder);
    const offset = this._publishJobEventAbi()?.blockLayout?.slots
      .find((slot) => slot.kind === 'event')?.offset ?? 4;
    const dest = publishJobEventOutputIndex(impl, offset);
    if (dest < 0 || dest >= builder.outputs.length) return;
    const implCategory = this.lowLevelCallUtxoGroups.find((group) =>
      group.functionName === 'publishJobEvent')?.categoryId;
    const categoryId = this._persistJobEventsTokenCategory()
      ?? this.externalCallUtxoGroups.find((group) =>
        (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent')?.categoryId
      ?? this.allInputs.find((input) =>
        input.token?.nft?.capability === 'minting'
        && !!input.token.category
        && input.token.category !== implCategory)?.token?.category
      ?? this._jobEventsPublishCategory();
    if (!categoryId || !/^[0-9a-f]{64}$/i.test(categoryId)) return;
    const addressType = this.lowLevelCallUtxoGroups.find((group) =>
      group.functionName === 'publishJobEvent' || group.logicalFunctionName === 'publishJobEvent')
      ?.externalContract?.inner?.addressType ?? 'p2sh32';
    const locking = scriptToLockingBytecode(
      buildEventNftCovenantScript(hexToBin(categoryId), computeEventNameHash('JobEvent(uint256,JobEventData)')),
      addressType,
    );
    const existing = builder.outputs[dest];
    const commit = String(existing?.token?.nft?.commitment ?? '');
    if (!isJobEventEmitCommitment(commit) && !isCreatedJobEventCommitment(commit)) return;
    repairJobEventDestLock(builder.outputs, dest, locking, true);
  }

  /** Drop a 1:1 P2PKH preserve that landed on a JobEvent dest. */
  private _repairPublishJobEventDestLocks(builder: TransactionBuilder): void {
    const dests = new Set(this._emitDestinationIndices());
    const impl = this._executingPublishJobEventInputIndex(builder);
    const offset = this._publishJobEventAbi()?.blockLayout?.slots
      .find((slot) => slot.kind === 'event')?.offset ?? 4;
    dests.add(publishJobEventOutputIndex(impl, offset));
    for (const [llcIndex, llc] of this.lowLevelCallUtxoGroups.entries()) {
      if (llc.callMode !== 'delegatecall') continue;
      const master = this.getLowLevelCallMasterInputIndex(llcIndex);
      if (master < 0) continue;
      const fn = llc.compilerRoute?.abiFunction
        ?? llc.externalContract?.inner?.artifact.abi.find((candidate: AbiFunction) => candidate.name === llc.functionName);
      for (const slot of fn?.blockLayout?.slots ?? []) {
        if (slot.kind === 'event') dests.add(master + slot.offset);
      }
    }
    for (let index = 0; index < builder.outputs.length; index++) {
      const commit = String(builder.outputs[index]?.token?.nft?.commitment ?? '');
      if (isJobEventEmitCommitment(commit) || isCreatedJobEventCommitment(commit)) dests.add(index);
    }
    const addressType = this.lowLevelCallUtxoGroups.find((group) =>
      group.functionName === 'publishJobEvent' || group.logicalFunctionName === 'publishJobEvent')
      ?.externalContract?.inner?.addressType
      ?? 'p2sh32';
    const registered = this.eventNftLockingBytecodes.get('JobEvent(uint256,JobEventData)');
    for (const dest of dests) {
      if (dest < 0) continue;
      const existing = builder.outputs[dest];
      const categoryId = existing?.token?.category
        ?? this._jobEventsPublishCategory()
        ?? this.categoryId;
      const locking = registered
        ?? (categoryId && /^[0-9a-f]{64}$/i.test(categoryId)
          ? scriptToLockingBytecode(
            buildEventNftCovenantScript(hexToBin(categoryId), computeEventNameHash('JobEvent(uint256,JobEventData)')),
            addressType,
          )
          : undefined);
      if (!locking) continue;
      repairJobEventDestLock(builder.outputs, dest, locking);
    }
    this._pinPersistDigestInputLocks(builder);
    this._repairPublishJobEventEntryDest(builder);
    this._repairPublishJobEventEmitDest(builder);
    this._repairPersistTrailingDest(builder);
    this._pinPersistDigestLocks(builder);
  }

  /** Last writer before preflight: dest 16 lock is persist digest, not a 1:1 P2PKH pad. */
  private _pinPersistDigestLocks(builder: TransactionBuilder): void {
    if (!isPersistedJobEventsReady() || this._rootIsPublishJobPost()) return;
    this._pinPersistDigestInputLocks(builder);
    const locking = this._persistDigestLocking();
    if (!locking) return;
    const impl = this._executingPublishJobEventInputIndex(builder);
    const dests = new Set<number>();
    const entryDest = persistValueChunkBase(impl, 5, true);
    if (entryDest >= 0) dests.add(entryDest);
    for (const dest of dests) pinPersistDigestLock(builder.outputs, dest, locking);
    this._pinPersistChunkLocks(builder);
  }

  /** Dest 18 OUTPUTBYTECODE is the persist-v redeem lock, not the entry digest. */
  private _persistChunkLocking(): Uint8Array | undefined {
    const categoryId = this._persistJobEventsTokenCategory() ?? this._jobEventsPublishCategory();
    const persistValue = firstPersisted(stagedJobEventsValues)
      ?? firstPersisted(persistedJobEventsValues)
      ?? (categoryId ? persistedJobEventsValue(categoryId) : undefined);
    return persistUpdateRedeemLock(categoryId, this.jobEventsRedeemLock)
      ?? persistValueChunkLock(categoryId, persistValue)
      ?? this.jobEventsRedeemLock;
  }

  private _pinPersistChunkLocks(builder: TransactionBuilder): void {
    if (!isPersistedJobEventsReady() || this._rootIsPublishJobPost()) return;
    const locking = this._persistChunkLocking();
    if (!locking || locking.length !== 35) return;
    const impl = this._executingPublishJobEventInputIndex(builder);
    const band = this.getPublishJobEventsBand();
    const persistWidth = this._persistReplayWidth();
    const persistDests = persistChunkOutputDests({
      implIndex: impl,
      bandStart: band?.start ?? -1,
      bandEnd: band?.end ?? -1,
      persistWidth: persistWidth > 0 ? persistWidth : undefined,
    });
    for (const dest of persistDests) {
      const inputCommit = String(this.allInputs[dest]?.token?.nft?.commitment ?? '');
      if (isDataNftIndexCommitment(inputCommit) && !isPersistValueChunkCommitment(inputCommit)) continue;
      pinPersistDigestLock(builder.outputs, dest, locking);
    }
    this._stripSurplusPersistDigestLocks(builder, persistDests);
  }

  /** Dest 14 is the only digest dest; dest 19 as a second digest fails 1 vs 2. */
  private _stripSurplusPersistDigestLocks(builder: TransactionBuilder, persistDests: readonly number[]): void {
    const digest = this._persistDigestLocking();
    const impl = this._executingPublishJobEventInputIndex(builder);
    const entryDest = persistValueChunkBase(impl, 5, true);
    if (!digest || entryDest < 0) return;
    const digestHex = binToHex(digest);
    const destLocks = builder.outputs.map((output, dest) => ({
      dest,
      lock: output?.to instanceof Uint8Array ? binToHex(output.to) : '',
    }));
    for (const dest of surplusPersistDigestDests({
      entryDest, persistDests, destLocks, digestLock: digestHex,
    })) {
      const existing = builder.outputs[dest];
      const amount = existing?.amount && existing.amount >= 1200n && existing.amount < 10_000n
        ? existing.amount
        : 1200n;
      builder.outputs[dest] = { to: Uint8Array.of(0x51), amount };
    }
  }

  /**
   * OP_UTXOBYTECODE(INPUTINDEX+3) reads `builder.inputs[dest]`, not outputs.
   * Swap the persist-digest predecessor onto dest 16 before sourceOutputs.
   * Only the entry dest is pinned here so dest 18 wrap cannot keep the only
   * persist UTXO off the UTXOBYTECODE pin.
   */
  private _pinPersistDigestInputLocks(builder: TransactionBuilder): void {
    if (!isPersistedJobEventsReady() || this._rootIsPublishJobPost()) return;
    const locking = this._persistDigestLocking();
    if (!locking) return;
    const impl = this._executingPublishJobEventInputIndex(builder);
    const entryDest = persistValueChunkBase(impl, 5, true);
    const dests = new Set<number>();
    if (entryDest >= 0) dests.add(entryDest);
    for (const dest of dests) pinPersistDigestInput(this.allInputs, dest, locking);
    this._syncBuilderUnlockers(builder);
  }

  private _persistDigestLocking(): Uint8Array | undefined {
    const cats = this._persistDigestCategories();
    const preferred = this._persistJobEventsTokenCategory() ?? this._jobEventsPublishCategory();
    const locking = persistUpdateDigestLock(preferred, cats);
    if (locking && locking.length === 35) return locking;
    for (const categoryId of cats) {
      const next = persistUpdateDigestLock(categoryId);
      if (next && next.length === 35) return next;
    }
    return undefined;
  }

  private _pinPersistDigestLocksOnTransaction(transaction: {
    outputs: Array<{ lockingBytecode: Uint8Array; valueSatoshis: bigint }>;
  }): void {
    if (!isPersistedJobEventsReady() || this._rootIsPublishJobPost()) return;
    const digest = this._persistDigestLocking();
    const impl = this._executingPublishJobEventInputIndex();
    const entryDest = persistValueChunkBase(impl, 5, true);
    if (digest) {
      const dests = new Set<number>();
      if (entryDest >= 0) dests.add(entryDest);
      for (const dest of dests) {
        if (dest < 0 || dest >= transaction.outputs.length) continue;
        transaction.outputs[dest].lockingBytecode = digest;
      }
    }
    const chunk = this._persistChunkLocking();
    const band = this.getPublishJobEventsBand();
    const persistWidth = this._persistReplayWidth();
    if (chunk && chunk.length === 35) {
      for (const dest of persistChunkOutputDests({
        implIndex: impl,
        bandStart: band?.start ?? -1,
        bandEnd: band?.end ?? -1,
        persistWidth: persistWidth > 0 ? persistWidth : undefined,
      })) {
        if (dest >= 0 && dest < transaction.outputs.length) {
          transaction.outputs[dest].lockingBytecode = chunk;
        }
      }
    }
  }

  /**
   * Input 14 EQUALVERIFYs UTXOBYTECODE(INPUTINDEX+5) against the persist
   * digest lock. Dest 19 must be that lock plus a persist chunk, not a pad.
   * Only the executing impl is a trailing base — a persist-entry UTXO also
   * unlocks as publishJobEvent and would stamp dest 19 as a second digest.
   */
  private _repairPersistTrailingDest(builder: TransactionBuilder): void {
    if (!isPersistedJobEventsReady() || this._rootIsPublishJobPost()) return;
    const impls = new Set<number>();
    const executing = this._executingPublishJobEventInputIndex(builder);
    if (executing >= 0) impls.add(executing);
    const categoryId = this._persistJobEventsTokenCategory()
      ?? this._jobEventsPublishCategory();
    const persistValue = firstPersisted(stagedJobEventsValues)
      ?? firstPersisted(persistedJobEventsValues)
      ?? (categoryId ? persistedJobEventsValue(categoryId) : undefined)
      ?? recoverPersistValueFromOutputs(
        builder.outputs,
        persistDigestLockDests(executing).concat(
          this.getPublishJobEventsBand()
            ? Array.from(
              { length: this.getPublishJobEventsBand()!.nNew },
              (_, offset) => this.getPublishJobEventsBand()!.start + offset,
            )
            : [],
        ),
      );
    const locking = persistUpdateRedeemLock(categoryId, this.jobEventsRedeemLock)
      ?? persistValueChunkLock(categoryId, persistValue)
      ?? this.jobEventsRedeemLock;
    if (!locking || locking.length !== 35 || !categoryId) return;
    const chunks = persistValue
      ? chunksFromJobEventsValue(persistValue, locking, categoryId) : [];
    const dests = new Set<number>();
    for (const impl of impls) dests.add(persistValueChunkBase(impl, 5, false));
    for (const dest of dests) {
      if (dest < 0 || dest >= builder.outputs.length) continue;
      const existing = builder.outputs[dest];
      if (existing?.token?.nft?.capability === 'minting') continue;
      const existingCommit = String(existing?.token?.nft?.commitment ?? '');
      const chunkCommit = chunks[0]?.commitment
        ?? persistUpdateEntryCommitment(persistValue)
        ?? (isPersistValueChunkCommitment(existingCommit) ? existingCommit : undefined);
      if (!chunkCommit) continue;
      builder.outputs[dest] = {
        to: locking,
        amount: existing?.amount && existing.amount >= 1200n ? existing.amount : 1200n,
        token: {
          amount: 0n,
          category: existing?.token?.category ?? categoryId,
          nft: { capability: 'mutable', commitment: chunkCommit },
        },
      };
    }
  }

  /**
   * Implementation emit verification is `OP_INPUTINDEX + event.offset`. Move a
   * parked VersionChanged / Paused NFT from the proxy event band onto that dest.
   */
  private _reassertDelegateImplEvents(builder: TransactionBuilder): void {
    for (const group of this.lowLevelCallUtxoGroups) {
      if (group.callMode !== 'delegatecall') continue;
      const fn = group.compilerRoute?.abiFunction
        ?? (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
          .find((candidate) => candidate.name === (group.logicalFunctionName ?? group.functionName));
      const eventOffset = fn?.blockLayout?.slots.find((slot) => slot.kind === 'event')?.offset;
      if (eventOffset === undefined) continue;
      const master = group.masterUtxo as UnlockableUtxo | undefined;
      if (!master) continue;
      const masterLock = binToHex(master.unlocker.generateLockingBytecode());
      const implIndex = this.allInputs.findIndex((input) => (
        input && 'unlocker' in input
        && binToHex(input.unlocker.generateLockingBytecode()) === masterLock
        && input.token?.category === master.token?.category
      ));
      if (implIndex < 0) continue;
      const dest = implIndex + eventOffset;
      const emitInfo = fn?.emits?.[0];
      if (!emitInfo || emitInfo.eventName === 'JobEvent' || emitInfo.eventSignature?.startsWith('JobEvent(')) {
        continue;
      }
      const artifact = group.externalContract.inner.artifact;
      const eventDef = (artifact.events ?? []).find((event: EventDefinitionAbi) => (
        event.signature === emitInfo.eventSignature
      ));
      const locking = this.eventNftLockingBytecodes.get(emitInfo.eventSignature);
      if (!eventDef || !locking) continue;
      if (relocateDelegateEventNftToDest(builder.outputs, dest, locking)) continue;
      const args = group.logicalFunctionArgs ?? group.functionArgs ?? [];
      const visibleInputs = (fn?.inputs ?? []).filter((input) => !input.name.startsWith('__internal__'));
      const values = resolveNamedEventValues(eventDef.parameters, visibleInputs, args);
      if (!values) continue;
      let commitment: Uint8Array;
      try {
        commitment = encodeEventCommitment(
          eventDef.parameters, values as StateValue[], artifact.structs,
        );
      } catch {
        continue;
      }
      while (builder.outputs.length <= dest) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
      }
      if (builder.outputs[dest]?.token?.nft?.capability === 'minting') continue;
      builder.outputs[dest] = {
        to: locking,
        amount: 1200n,
        token: {
          amount: 0n,
          category: this.categoryId,
          nft: { capability: 'none', commitment: binToHex(commitment) },
        },
      };
    }
  }

  /** Persist UPDATE predecessors are mutable value-chunks, not data-NFT twins. */
  private _reassertPersistedJobEventsOneToOnes(builder: TransactionBuilder, emitDest: number): void {
    const destCategory = emitDest >= 0 && builder.outputs[emitDest]?.token?.category
      ? String(builder.outputs[emitDest]!.token!.category)
      : this._jobEventsPublishCategory();
    const categoryId = destCategory ?? this._jobEventsPublishCategory();
    const persistLockCategory = this._persistJobEventsTokenCategory() ?? categoryId;
    const persistLock = (persistLockCategory ? persistedJobEventsLock(persistLockCategory) : undefined)
      ?? this.jobEventsRedeemLock;
    const persistImpl = this._executingPublishJobEventInputIndex(builder);
    const persistDests = new Set(persistUpdatePredecessorDests({
      implIndex: persistImpl,
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
    );
    for (const [index, input] of this.allInputs.entries()) {
      const commit = String(input?.token?.nft?.commitment ?? '');
      const persistShaped = commit.length >= 64 && !isDataNftIndexCommitment(commit);
      if (index === emitDest && !persistShaped) continue;
      if (input?.token?.nft?.capability !== 'mutable') continue;
      const chunk0Dest = persistValueChunkBase(persistImpl, 5, false);
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
          const persistValue = firstPersisted(stagedJobEventsValues)
            ?? firstPersisted(persistedJobEventsValues)
            ?? (persistCat ? persistedJobEventsValue(persistCat) : undefined)
            ?? recoverPersistValueFromOutputs(builder.outputs, [...persistDests]);
          const destOffset = [...persistDests].sort((left, right) => left - right).indexOf(index);
          const inputLock = input.unlocker?.generateLockingBytecode();
          const persistVLock = persistValueChunkLock(this._jobEventsPublishCategory(), persistValue)
            ?? persistValueChunkLock(persistLockCategory, persistValue)
            ?? persistValueChunkLock(input.token?.category ?? persistCat, persistValue)
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
          // Dest 18 is the jobEvents[0] entry: slot||next||valueHead. Continuations
          // stay uint16-le value-chunks. H(0) is sha256('') with the high bit cleared.
          const persistChunk = destOffset === 0 && persistValue
            ? {
              commitment: binToHex(encodeEntryCommitment(
                keyToSlot(new Uint8Array()),
                new Uint8Array(32),
                persistValue.slice(0, Math.min(VALUE_HEAD_SIZE, persistValue.length)),
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
      const digestLock = persistUpdateRedeemLock(input.token?.category ?? categoryId, this.jobEventsRedeemLock);
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

  /**
   * Later participant/FT/SCID writers can overwrite impl+blockSize P'/NEW. Put the
   * planned whitelist (or other delegate upsert) commitments back without splicing
   * so assigned view tails stay put.
   */
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
    let outputIndex = delegateBase !== undefined
      ? delegateBase + (delegateAbiFunction?.blockLayout?.blockSize ?? 1)
      : this.getLoopEntryOutputBase();
    outputIndex += this.iterationEntryInputs.length + this.dynamicChunkInputs.length;
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
        entryOutput.amount = BigInt(Math.max(1200, calculateDust(entryOutput)));
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
    const tailReturns = this.pendingReturnEventOutputs.filter((event) => {
      for (const [groupIdx, group] of this.externalCallUtxoGroups.entries()) {
        if (!groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, groupIdx)) continue;
        const identity = `external-call:${group.fusedReturnGroupIndex ?? groupIdx}`;
        if (event.identity === identity || event.identity.startsWith(`${identity}:`)) return false;
      }
      return true;
    });
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
    for (const index of jobEventsEntryOneToOneIndices(
      this.allInputs, this.entryLockNearJobEventsBand(),
    )) writerReturnSlots.add(index);
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
    this._restoreJobEventsEntryOneToOnes(builder);
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
      const occupant = builder.outputs[outputIndex];
      const identity = `external-call:${group.fusedReturnGroupIndex ?? groupIdx}`;
      const pending = this.pendingReturnEventOutputs.find((event) =>
        event.identity === identity || event.identity === `${identity}:0`);
      const writerAbi = physical.compilerRoute?.abiFunction
        ?? (physical.externalContract?.inner?.artifact?.abi as AbiFunction[] | undefined)
          ?.find((fn) => fn.name === (physical.functionName ?? physical.logicalFunctionName));
      const commitment = tokenWriterReturnCommitment({
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
      })) {
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
   * View tails may be planned at impl+trailingBase before jobEvents derive.
   * Those remnants must not survive as OP_TRUE on the executing pin; restore
   * 1:1 / a token-free pad and let derived chunks win.
   */
  /** Undo OP_TRUE parked on a same-index jobEvents entry (closeJob+transfer). */
  private _restoreJobEventsEntryOneToOnes(builder: TransactionBuilder): void {
    const entryLock = this.entryLockNearJobEventsBand();
    const occupancyEnd = writerBlockOccupancyEnd(
      this.externalCallUtxoGroups,
      (categoryId) => this.findMintingInputIndex(categoryId),
    );
    let entryIndices = jobEventsEntryOneToOneIndices(this.allInputs, entryLock);
    if (entryIndices.length === 0) {
      entryIndices = this.allInputs.flatMap((input, index) => {
        if (input?.token?.nft?.capability !== 'mutable' || !('unlocker' in input) || !input.unlocker) {
          return [];
        }
        const lock = input.unlocker.generateLockingBytecode();
        return lock.length === 35 && lock[0] === 0xaa ? [index] : [];
      });
    }
    for (const index of entryIndices) {
      const output = builder.outputs[index];
      const lockBytes = output?.to instanceof Uint8Array ? output.to : undefined;
      const opTrue = !!lockBytes && lockBytes.length === 1 && lockBytes[0] === 0x51;
      if (!opTrue && !isViewReturnTailOutput(output)) continue;
      const input = this.allInputs[index];
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
      && (group.batchPredecessorOutputs?.length ?? 0) > 0) ?? tokenGroup;
    if (tokenGroup && tokenWriter?.batchPredecessorOutputs
      && (tokenGroup.batchPredecessorOutputs?.length ?? 0) === 0) {
      tokenGroup.batchPredecessorOutputs = tokenWriter.batchPredecessorOutputs;
    }
    const after = master + (tokenGroup?.blockLayout?.blockSize ?? 8);
    const jobsCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    const placements = packTailReturnPlacements(
      this.externalCallUtxoGroups,
      (categoryId) => this.findMintingInputIndex(categoryId),
      this.pendingReturnEventOutputs,
      swapCategoryId,
      this.getPublishJobEventsBand()?.end ?? -1,
      this.viewTailPackOptions(jobsCount > 0
        ? builder.outputs.length - jobsCount - 1
        : builder.outputs.length),
    );
    const tailReturns = this.pendingReturnEventOutputs.filter((event) =>
      event.categoryId !== swapCategoryId);
    const writerSlots = new Set<number>();
    const returnSlot = tokenGroup?.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
    if (returnSlot) writerSlots.add(master + returnSlot.offset);
    for (const index of jobEventsEntryOneToOneIndices(
      this.allInputs, this.entryLockNearJobEventsBand(),
    )) writerSlots.add(index);
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
      this._restoreJobEventsEntryOneToOnes(builder);
      this._reassertInBlockWriterReturns(builder);
      return;
    }
    const hole = builder.outputs[after];
    if (hole?.token?.nft?.capability === 'none' && (hole.token.nft.commitment?.length ?? 0) > 2) {
      this._restoreJobEventsEntryOneToOnes(builder);
      this._reassertInBlockWriterReturns(builder);
      return;
    }
    const suffixLen = (this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0) + 1;
    const last = builder.outputs.length - suffixLen;
    const category = this.lowLevelCallUtxoGroups.find((group) => group.functionName === 'publishJobEvent')
      ?.categoryId
      ?? builder.outputs.slice(after + 1, last).find((output) =>
        output.token?.nft?.capability === 'none'
        && output.token.category !== swapCategoryId)?.token?.category;
    if (!category) {
      this._restoreJobEventsEntryOneToOnes(builder);
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
    this._restoreJobEventsEntryOneToOnes(builder);
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
    for (const g of this.lowLevelCallUtxoGroups) {
      lowLevelCallInputs.push(g.masterUtxo as UnlockableUtxo, ...g.dataNftUtxos);
    }
    this.allInputs = this._buildInputs(
      entryInputs, tokenContainerInputs, satoshiContainerInputs,
      externalOutStateInputs, externalCallInputs, lowLevelCallInputs,
    );
    this._swapMintingOffValueChunkBand();
    this._placeJobEventsPredecessorInputs(this.pendingJobEventsPredecessors);
    // Callee anchors precede the caller's own: emitLogicalMsgSenderAnchorResolution resolves the caller's
    // identity from the LAST input, so that tail position must stay the caller's.
    this.allInputs.push(...this.externalIdentityAnchorUtxos);
    if (this.logicalIdentityUtxo) this.allInputs.push(this.logicalIdentityUtxo);
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

  setExternalCallEntryOutputAt(outputIndex: number, categoryId: string, commitmentHex: string): boolean {
    if (isProxyPreserveOutputIndex(outputIndex)) return false;
    const occupantCommit = String(this.allInputs[outputIndex]?.token?.nft?.commitment ?? '');
    if (isDataNftIndexCommitment(occupantCommit) && !isPersistValueChunkCommitment(occupantCommit)) {
      return false;
    }
    if (commitmentHex.length < 128 || /^0+$/.test(commitmentHex)) return false;
    const previous = this.externalCallEntryOutputsByIndex.get(outputIndex);
    if (previous?.commitment === commitmentHex && previous.categoryId === categoryId) return false;
    // A later all-zero / short extract must not replace a real predecessor (H('') UPDATE).
    if (previous && previous.commitment.length >= 128 && !/^0+$/.test(previous.commitment)
      && commitmentHex.length < previous.commitment.length) return false;
    this.externalCallEntryOutputsByIndex.set(outputIndex, { categoryId, commitment: commitmentHex });
    return true;
  }

  private _applyDerivedEntryOutputs(builder: TransactionBuilder): void {
    const entryDest = persistValueChunkBase(this._executingPublishJobEventInputIndex(builder), 5, true);
    for (const [outputIndex, placed] of this.externalCallEntryOutputsByIndex) {
      if (isProxyPreserveOutputIndex(outputIndex)) continue;
      const occupantCommit = String(this.allInputs[outputIndex]?.token?.nft?.commitment ?? '');
      if (isDataNftIndexCommitment(occupantCommit) && !isPersistValueChunkCommitment(occupantCommit)) {
        continue;
      }
      while (builder.outputs.length <= outputIndex) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
      }
      const existing = builder.outputs[outputIndex];
      if (existing?.token?.nft?.capability === 'minting') continue;
      const persistEntry = outputIndex === entryDest
        && placed.commitment.toLowerCase().startsWith('e3b0c442')
        && placed.commitment.length >= 256;
      if (!persistEntry && (!existing?.token?.nft || existing.token.nft.capability !== 'mutable')) continue;
      const locking = persistEntry
        ? (persistUpdateDigestLock(placed.categoryId, this._persistDigestCategories())
          ?? (existing?.to instanceof Uint8Array ? existing.to : undefined))
        : existing.to;
      if (!locking) continue;
      builder.outputs[outputIndex] = {
        to: locking,
        amount: persistEntry && existing?.amount && existing.amount >= 1200n
          ? existing.amount
          : (existing?.amount ?? 1200n),
        token: {
          amount: existing?.token?.amount ?? 0n,
          category: existing?.token?.category ?? placed.categoryId,
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
  addTokenContainerTransfer(tokenContainerCategoryId: string, lockingBytecode: Uint8Array, amount: bigint): this {
    if (amount <= 0n) {
      throw new Error('Token container transfer amount must be positive');
    }
    this.pendingTokenContainerTransfers.push({
      tokenContainerCategoryId, lockingBytecode, amount,
      insertionOrder: this.tokenContainerTransferInsertionCounter++,
    });
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
  ): this {
    this.pendingTokenContainerTransferNfts.push({
      tokenContainerCategoryId, lockingBytecode, commitment, capability,
      insertionOrder: this.tokenContainerTransferInsertionCounter++,
    });
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
    this.tokenContainerTransferInsertionCounter = this.pendingTokenContainerTransferNfts.length;
    return this;
  }

  /**
   * Clear all pending token container NFT transfers.
   */
  clearTokenContainerTransferNfts(): this {
    this.pendingTokenContainerTransferNfts = [];
    this.tokenContainerTransferInsertionCounter = this.pendingTokenContainerTransfers.length;
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
    outputIndex: number, chunk: { commitment: string; lockingBytecode: Uint8Array; categoryId?: string },
  ): boolean {
    if (isProxyPreserveOutputIndex(outputIndex)) return false;
    const occupantCommit = String(this.allInputs[outputIndex]?.token?.nft?.commitment ?? '');
    if (isDataNftIndexCommitment(occupantCommit) && !isPersistValueChunkCommitment(occupantCommit)
      && !persistChunkMayOverwriteScid({
        dest: outputIndex,
        band: this.getPublishJobEventsBand(),
        replayWidth: this._persistReplayWidth(),
        incomingCommitment: chunk.commitment,
      })) {
      return false;
    }
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
    if (existing?.commitment === chunk.commitment
      && binToHex(existing.lockingBytecode) === binToHex(chunk.lockingBytecode)
      && existing.categoryId === chunk.categoryId) return false;
    const kept = preferChunkCommitment(existing?.commitment, chunk.commitment);
    if (existing && kept === existing.commitment && kept !== chunk.commitment) return false;
    this.derivedChunkOutputs.set(outputIndex, !existing || kept === chunk.commitment
      ? { ...chunk, commitment: kept }
      : existing);
    if (valueChunkPin && chunk.commitment.length >= 3 && chunk.commitment !== '00'
      && !isEmptyValueChunkCommitment(chunk.commitment)) {
      const categoryId = chunk.categoryId ?? this.categoryId;
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
    commitment: string; lockingBytecode: Uint8Array; categoryId?: string;
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
    const publish = this.externalCallUtxoGroups.find((group) =>
      (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent')
      ?? this.lowLevelCallUtxoGroups.find((group) => group.functionName === 'publishJobEvent');
    const categoryId = publish?.categoryId;
    const value = categoryId ? persistedJobEventsValue(categoryId) : undefined;
    const lock = persistUpdateRedeemLock(categoryId, this.jobEventsRedeemLock)
      ?? this.jobEventsRedeemLock
      ?? (categoryId ? persistedJobEventsLock(categoryId) : undefined);
    if (!value || !lock) return 0;
    this.bumpPublishJobEventsWidth(valueChunkCountFor(value));
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
    const tokenWriterPresent = this.externalCallUtxoGroups.some((group) =>
      isMintingBandSwapFunction(group.functionName ?? group.compilerRoute?.abiFunction.name));
    if (band && !tokenWriterPresent && this.derivedChunkOutputs.size > 0) {
      const persistReady = isPersistedJobEventsReady() && !this._rootIsPublishJobPost();
      const remapped = remapDerivedChunkDests(
        this.derivedChunkOutputs,
        band,
        persistJobEventsBandFloor(this._executingPublishJobEventInputIndex(), persistReady),
      );
      this.derivedChunkOutputs.clear();
      for (const [index, chunk] of remapped) this.derivedChunkOutputs.set(index, chunk);
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
      ?? this.externalCallUtxoGroups.find((group) =>
        group.sharedGroupIndex === undefined
        && isMintingBandSwapFunction(group.functionName ?? group.compilerRoute?.abiFunction.name))
        ?.categoryId;
    for (const [index, input] of this.allInputs.entries()) {
      if (input?.token?.nft?.capability === 'minting') protectedMasters.add(index);
      if (tokenWriterCategory && input?.token?.category === tokenWriterCategory) {
        protectedMasters.add(index);
      }
      const inputCommit = String(input?.token?.nft?.commitment ?? '');
      if (isDataNftIndexCommitment(inputCommit) && !isPersistValueChunkCommitment(inputCommit)
        && !persistChunkMayOverwriteScid({
          dest: index,
          band: this.getPublishJobEventsBand(),
          replayWidth: this._persistReplayWidth(),
          incomingCommitment: this.derivedChunkOutputs.get(index)?.commitment,
        })) {
        protectedMasters.add(index);
      }
    }
    let changed = false;
    for (const outputIndex of [...this.derivedChunkOutputs.keys()].sort((left, right) => left - right)) {
      const chunk = this.derivedChunkOutputs.get(outputIndex);
      if (!chunk) continue;
      if (isProxyPreserveOutputIndex(outputIndex)) continue;
      // Only the caller's own suffix chunks are skipped here. Nested
      // publishJobEvent pins often omit categoryId; treating them as
      // `this.categoryId` dropped the 20-25 jobEvents run on the view-only path.
      if (this.delegateDynamicChunksAtSuffix && chunk.categoryId === this.categoryId) continue;
      if (protectedMasters.has(outputIndex)) continue;
      const existing = builder.outputs[outputIndex];
      if (existing) {
        // A minting 1:1 recreation is not an old value-chunk digest. Every
        // P2SH32 used to match `existingIsChunkAddress`, so FakeToken's minting
        // lock was replaced by jobEvents (timeout refund output 24).
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
   * Last writer on the view-only path: put publishJobEvent value chunks at
   * impl+trailingBase. Leaves view tails (16/17) and minting masters alone.
   */
  private _materializeJobEventsBand(builder: TransactionBuilder): void {
    const tokenWriterPresent = this.externalCallUtxoGroups.some((group) =>
      isMintingBandSwapFunction(group.functionName ?? group.compilerRoute?.abiFunction.name
        ?? group.logicalFunctionName));
    // transferFrom/transfer already own the minting-band occupancy path.
    // Materializing jobEvents over those 1:1s hangs derivation.
    if (tokenWriterPresent) return;
    const band = this.getPublishJobEventsBand();
    if (!band) return;
    const publish = this.externalCallUtxoGroups.find((group) =>
      (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent')
      ?? this.lowLevelCallUtxoGroups.find((group) => group.functionName === 'publishJobEvent');
    const categoryId = publish?.categoryId;
    const fromDerived = [...this.derivedChunkOutputs.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, chunk]) => chunk)
      .filter((chunk) => chunk.lockingBytecode.length === 35
        && chunk.commitment.length >= 3 && chunk.commitment !== '00');
    if (fromDerived.length > 0 && categoryId) {
      this.rememberJobEventsChunks(categoryId, fromDerived);
    }
    const rematerialize = this._shouldRematerializePersistUpdate();
    const persistedValue = rematerialize && categoryId
      ? persistedJobEventsValue(categoryId) : undefined;
    const fromValue = persistedValue
      ? chunksFromJobEventsValue(persistedValue, undefined, categoryId)
      : [];
    const persistChunks = rematerialize
      ? (this.persistedJobEventsChunks.length > 0
        ? this.persistedJobEventsChunks
        : (categoryId ? persistedJobEventsByCategory.get(categoryId) ?? [] : []))
      : [];
    const source = rematerialize
      ? selectLatestJobEventsChunks(selectLatestJobEventsChunks(fromDerived, fromValue), persistChunks)
      : fromDerived;
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
      for (const { collection, lockingBytecode } of this.getValueChunkVars()) {
        if (lockingBytecode.length !== 35 || lockingBytecode[0] !== 0xaa || lockingBytecode[1] !== 0x20) {
          continue;
        }
        for (const commitment of this.getValueChunkRawCommitments(collection)) {
          if (!commitment || commitment === '00') continue;
          chunks.push({ commitment, lockingBytecode, categoryId: categoryId ?? this.categoryId });
        }
      }
    }
    if (chunks.length === 0) return;
    // Never grow past the planned write: a longer Created extract (4) on a
    // first post (nNew=2) hung derivation. Fill only up to planned nNew so
    // history (5 of 6) still gets a continuation at slot 25.
    const liveBand = { start: band.start, nNew: band.nNew };
    const previousDerived = new Map(this.derivedChunkOutputs);
    this.derivedChunkOutputs.clear();
    for (const [offset, chunk] of chunks.entries()) {
      const index = liveBand.start + offset;
      const prior = previousDerived.get(index);
      const commitment = preferChunkCommitment(prior?.commitment, chunk.commitment);
      this.derivedChunkOutputs.set(index, {
        ...(commitment === prior?.commitment && prior ? prior : chunk),
        commitment,
        categoryId: chunk.categoryId ?? prior?.categoryId ?? categoryId,
      });
    }
    const liveEnd = liveBand.start + liveBand.nNew - 1;
    for (const [index, prior] of previousDerived) {
      if (index < liveBand.start || index > liveEnd) continue;
      if (this.derivedChunkOutputs.has(index)) continue;
      if (isEmptyValueChunkCommitment(prior.commitment) || prior.commitment === '00') continue;
      this.derivedChunkOutputs.set(index, prior);
    }
    const reserved = new Set<number>([0, 1]);
    const replayWidth = this._persistReplayWidth();
    for (const [index, input] of this.allInputs.entries()) {
      if (input.token?.nft?.capability === 'minting') reserved.add(index);
      const inputCommit = String(input.token?.nft?.commitment ?? '');
      if (isDataNftIndexCommitment(inputCommit) && !isPersistValueChunkCommitment(inputCommit)
        && !persistChunkMayOverwriteScid({
          dest: index,
          band: { start: liveBand.start, end: liveEnd },
          replayWidth,
          incomingCommitment: this.derivedChunkOutputs.get(index)?.commitment,
        })) {
        reserved.add(index);
      }
    }
    for (const [index, group] of this.externalCallUtxoGroups.entries()) {
      if (groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, index)) continue;
      const tail = group.returnOutputIndex ?? group.plannedReturnOutputIndex;
      if (tail !== undefined && tail < liveBand.start) reserved.add(tail);
    }
    const stampDigest = this._shouldStampPersistUpdateDigestLock();
    const persistTokenCategory = this._persistJobEventsTokenCategory() ?? categoryId;
    const recipeLock = stampDigest
      ? persistUpdateDigestLock(persistTokenCategory, this._persistDigestCategories())
      : undefined;
    const redeemLock = recipeLock
      ?? this.jobEventsRedeemLock
      ?? (categoryId ? persistedJobEventsLock(categoryId) : undefined);
    const placed = applyRedeemLockToChunks(
      [...this.derivedChunkOutputs.entries()]
        .filter(([index]) => index >= liveBand.start && index <= liveEnd)
        .sort(([left], [right]) => left - right)
        .map(([, chunk]) => ({
          ...chunk,
          categoryId: chunk.categoryId ?? categoryId,
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
      categoryId: placed[0].categoryId ?? categoryId,
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
    const publish = this.externalCallUtxoGroups.find((group) =>
      (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent')
      ?? this.lowLevelCallUtxoGroups.find((group) => group.functionName === 'publishJobEvent');
    const categoryId = publish?.categoryId;
    const persistTokenCategory = this._persistJobEventsTokenCategory() ?? categoryId;
    const persistDigestLock = this._shouldStampPersistUpdateDigestLock()
      ? persistUpdateDigestLock(persistTokenCategory, this._persistDigestCategories())
      : (this._shouldRematerializePersistUpdate()
        ? persistUpdateRedeemLock(persistTokenCategory, this.jobEventsRedeemLock)
        : undefined);
    const persistValue = firstPersisted(stagedJobEventsValues)
      ?? (persistTokenCategory ? persistedJobEventsValue(persistTokenCategory) : undefined)
      ?? firstPersisted(persistedJobEventsValues);
    const persistVLock = persistValueChunkLock(this._jobEventsPublishCategory(), persistValue)
      ?? persistValueChunkLock(persistTokenCategory, persistValue);

    const redeemLock = persistVLock
      ?? persistDigestLock
      ?? this.jobEventsRedeemLock
      ?? (categoryId ? persistedJobEventsLock(categoryId) : undefined);
    const fromDerived = [...this.derivedChunkOutputs.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, chunk]) => chunk)
      .filter((chunk) => chunk.lockingBytecode.length === 35
        && chunk.commitment.length >= 3 && chunk.commitment !== '00');
    const replay = this._shouldReplayPreviousPersist();
    const persistedValue = replay
      ? ((categoryId ? persistedJobEventsValue(categoryId) : undefined)
        ?? firstPersisted(persistedJobEventsValues))
      : undefined;
    const fromValue = persistedValue
      ? chunksFromJobEventsValue(persistedValue, redeemLock, categoryId)
      : [];
    // Closed replays previous persist. Updated prefers the new derived blob
    // (same-length selectLatest would otherwise keep the empty dest-17 stub).
    const source = replay && fromValue.length > 0
      ? fromValue
      : (this._shouldRematerializePersistUpdate()
        ? selectLatestJobEventsChunks(fromValue, fromDerived)
        : fromDerived);
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
    const siblingLock = persistDigestLock
      ?? dominant
      ?? redeemLock
      ?? source[0]?.lockingBytecode
      ?? fromDerived[0]?.lockingBytecode;
    if (!siblingLock || siblingLock.length !== 35) return;
    const persistWidth = this._persistReplayWidth();
    const liveN = persistUpdateBandWidth({
      persistReady: persistWidth > 0,
      persistWidth,
      plannedWidth: band.nNew,
      derivedWidth: source.length,
    });
    // Dominant lock count can include a leftover probe slot (output 25). The
    // covenant EQUALVERIFYs nNew from v; extra same-lock outputs fail. Closed
    // replay stays at dest 16-18. Updated (amounts) keeps dest 16-19.
    const liveBand = {
      start: band.start,
      nNew: persistWidth > 0 ? persistWidth : Math.max(band.nNew, liveN, 1),
    };
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
        categoryId: chunk.categoryId ?? categoryId,
      })),
      siblingLock,
    ), reserved, occupancyEnd, suffixStart);
    fillJobEventsBandHoles(builder.outputs, liveBand, {
      lockingBytecode: siblingLock,
      categoryId: categoryId ?? source[0]?.categoryId,
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
    const publish = this.externalCallUtxoGroups.find((group) =>
      (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent')
      ?? this.lowLevelCallUtxoGroups.find((group) => group.functionName === 'publishJobEvent');
    const categoryId = publish?.categoryId;
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
    const chunks: JobEventsChunk[] = [];
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
      ?? firstPersisted(stagedJobEventsValues, categoryId);
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

  /** Insert a non-covenant output before the authenticated [late chunks][terminal suffix] region. */
  insertBeforeLateValueSuffix(builder: TransactionBuilder, output: Output): void {
    const delegateDynamicCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    const authenticatedSuffixCount = delegateDynamicCount + this.lateValueChunkOutputs.length;
    if (authenticatedSuffixCount === 0) {
      builder.addOutput(output);
      return;
    }
    const suffixLength = authenticatedSuffixCount + 1;
    builder.outputs.splice(builder.outputs.length - suffixLength, 0, output);
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
  registerValueChunkVar(collection: string, lockingBytecode: Uint8Array): this {
    this.valueChunkVars.set(collection, lockingBytecode);
    return this;
  }

  setValueChunkLockingBytecode(collection: string, lockingBytecode: Uint8Array): this {
    if (!this.valueChunkVars.has(collection)) throw new Error(`value chunk collection not registered: ${collection}`);
    this.valueChunkVars.set(collection, lockingBytecode);
    return this;
  }

  getValueChunkVars(): Array<{ collection: string; lockingBytecode: Uint8Array }> {
    return [...this.valueChunkVars.entries()].map(([collection, lockingBytecode]) => ({ collection, lockingBytecode }));
  }

  setValueChunkRawCommitments(collection: string, commitments: string[]): this {
    this.valueChunkRawCommitments.set(collection, commitments);
    return this;
  }

  getValueChunkRawCommitments(collection: string): string[] {
    return this.valueChunkRawCommitments.get(collection) ?? [];
  }

  /** Output index where value chunks begin: after the block, dynamic chunks, and loop-entry (NEW) outputs. */
  getValueChunkOutputBase(): number {
    if (this.delegateEntriesAfterLowLevel) {
      return this.getLoopEntryOutputBase() + this._loopEntryOutputCount();
    }
    let base = this.getChunkOutputBase();
    for (const dv of this.dynamicChunkVars) base += (this.chunkRawCommitments.get(dv.name) ?? []).length;
    if (!this.batchEntriesBeforeDynamicChunks) {
      for (const lv of this.loopEntryVars) base += (this.loopEntryCommitments.get(lv.collection) ?? []).length;
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
      const previous = this.pendingReturnEventOutputs[existing].commitment;
      // A fused FakeToken write can extract a lone VM-number `0x01` after a view already
      // published pushdata (`0x51` / framed uint). INT_DECODE of `0x01` SPLITs empty.
      if (previous.length > commitment.length && commitment.length <= 1) {
        return this;
      }
      this.pendingReturnEventOutputs[existing] = { categoryId, commitment, identity, provisional };
    } else {
      this.pendingReturnEventOutputs.push({ categoryId, commitment, identity, provisional });
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
    // blockSize reserves the returnEvent slot, but a plain send does NOT materialize it (only .emitReturn(), which
    // populates pendingReturnEventOutputs), so the trailing chunks sit one output lower. Match the covenant's
    // runtime returnOutputIdx<0 adjustment in emitDynamicWriteVerification.
    const hasReturnEventSlot = this.blockLayout?.slots.some((s) => s.kind === 'returnEvent') ?? false;
    if (this.blockLayout?.trailingBase === undefined
      && hasReturnEventSlot && this.pendingReturnEventOutputs.length === 0) base -= 1;
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
      return trailingBase + this._localLoopEntryOutputCount() + this._valueChunkOutputCount()
        + this.pendingOutputs.length;
    }
    return trailingBase + (this.batchEntriesBeforeDynamicChunks ? this._localLoopEntryOutputCount() : 0);
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

  getLoopEntryVars(): Array<{
    collection: string; lockingBytecode: Uint8Array; categoryId?: string; delegate?: boolean; chunkable?: boolean;
  }> {
    return this.loopEntryVars;
  }

  getLoopEntryCommitments(collection: string): string[] {
    return this.loopEntryCommitments.get(collection) ?? [];
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
    this.loopEntryCommitments.set(collection, required === undefined ? commitments : commitments.slice(0, required));
    return this;
  }

  requireLoopEntryCount(collection: string, count: number): this {
    this.requiredLoopEntryCounts.set(collection, count);
    const existing = this.loopEntryCommitments.get(collection);
    if (existing && existing.length > count) this.loopEntryCommitments.set(collection, existing.slice(0, count));
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

  private _localLoopEntryOutputCount(): number {
    let n = 0;
    for (const lv of this.loopEntryVars) {
      if (lv.delegate === true) continue;
      n += (this.loopEntryCommitments.get(lv.collection) ?? []).length;
    }
    return n;
  }

  private _delegateLoopEntryVars(): typeof this.loopEntryVars {
    return this.loopEntryVars.filter((lv) => lv.delegate === true);
  }

  /**
   * Output index where loop entry NFTs begin. They share the trailing region with dynamic chunks (mutually
   * exclusive in a given function by construction), placed after any chunk outputs.
   */
  getLoopEntryOutputBase(): number {
    if (this._delegateLoopEntryVars().length === this.loopEntryVars.length
      && this.loopEntryVars.length > 0 && (this.blockLayout?.trailingCapacity ?? 0) > 0) {
      return this.getChunkOutputBase() + (this.blockLayout?.trailingCapacity ?? 0) + this.pendingOutputs.length
        + this.externalIdentityAnchorUtxos.length;
    }
    if (this.batchEntriesBeforeDynamicChunks) return this.getChunkOutputBase() - this._localLoopEntryOutputCount();
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
    if (this.emitReassertAllowed === undefined) {
      this.emitReassertAllowed = isPersistedJobEventsReady() && !this._rootIsPublishJobPost();
    }
    this.builtReturnEventOutputIndices.clear();
    const returnOutputRefs = new Map<string, Output>();
    const addReturnOutput = (builder: TransactionBuilder, identity: string, output: Output): void => {
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
    const builder = new CovenantTransactionBuilder(opts);
    const debugOwnMutableOutputs = (stage: string): void => {
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
          this.iterationEntryInputs.forEach((utxo, i) => {
            if (matches(utxo)) out.push(`iterationEntry:${i}`);
          });
          this.externalCallUtxoGroups.forEach((group, groupIndex) => {
            if (matches(group.masterUtxo)) out.push(`external:${groupIndex}:master`);
            group.dataNftUtxos.forEach((utxo, nftIndex) => {
              if (matches(utxo)) out.push(`external:${groupIndex}:dataNft:${nftIndex}`);
            });
          });
          this.lowLevelCallUtxoGroups.forEach((group, groupIndex) => {
            if (matches(group.masterUtxo)) out.push(`lowLevel:${groupIndex}:master`);
            group.dataNftUtxos.forEach((utxo, nftIndex) => {
              if (matches(utxo)) out.push(`lowLevel:${groupIndex}:dataNft:${nftIndex}`);
            });
          });
          this.funderUtxos.forEach((utxo, i) => { if (matches(utxo)) out.push(`funder:${i}`); });
          this.entryNfts.forEach((entry, i) => { if (matches(entry.utxo)) out.push(`entry:${i}`); });
          return out;
        };
        throw new Error(
          `Duplicate stateful input ${id} at ${first}/${index}; roles `
          + `${roles(this.allInputs[first]).join(',') || 'other'} / ${roles(input).join(',') || 'other'}`,
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

    // Create blockhash (n->hash) oracle outputs (self-preserving recreate; mirrors the readOnlyDataNft slot).
    for (const bhUtxo of this.blockhashCoSpendUtxos) {
      builder.addOutput({
        to: bhUtxo.unlocker.generateLockingBytecode(),
        amount: bhUtxo.satoshis,
        token: bhUtxo.token,
      });
    }

    // Create keccak256 compute side-car outputs (right after blockhash, matching the keccakSideCar slots): each
    // recreation carries this call's computed result R_i = keccak256(preimage_i) in a mutable NFT commitment.
    this.keccakComputeCoSpendUtxos.forEach((kUtxo, i) => {
      builder.addOutput({
        to: kUtxo.unlocker.generateLockingBytecode(),
        amount: kUtxo.satoshis,
        token: {
          category: kUtxo.token?.category ?? this.categoryId,
          amount: kUtxo.token?.amount ?? 0n,
          nft: { capability: 'mutable', commitment: this.keccakComputeCommitments[i] ?? '' },
        },
      });
    });

    // Dynamic keccak loop: recreate the N trailing side-cars, each with its iteration result R_i. In the MVP
    // layout (no other front-region slots) these sit at [blockSize, blockSize+N) - right after the data NFTs.
    for (const rec of this.keccakLoopRecreates) builder.addOutput(rec);

    // ecrecover recovery-pair recreations (right after the keccak side-cars, matching the ecrecoverSideCar slots):
    // A commits H_A (the A->B binding hash), B commits the recovered pubkey Q. Built by buildEcrecoverComputeSidecars.
    for (const rec of this.ecrecoverComputeRecreates) builder.addOutput(rec);

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
        const commitment = nftIsImmutable && inputCommitment
          ? inputCommitment
          : buildPushdataCommitment(
            group.stateLayout, bCurrentState, nftIdx,
            this.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
          );

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
      for (let offset = occupied; offset <= lastTransferOffset; offset += 1) {
        const slot = delegateFn?.blockLayout?.slots.find((candidate) => candidate.offset === offset);
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
      if (this.dynamicChunkInputs.length > 0) {
        outputIndex += this.dynamicChunkInputs.length;
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
          entryOutput.amount = BigInt(Math.max(1200, calculateDust(entryOutput)));
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
        const commitment = nftHasUpdate || !inputCommitment
          ? buildPushdataCommitment(
            group.stateLayout, bCurrentState, nftIdx,
            this.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
          )
          : inputCommitment;

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
            const handle = group.plannedEntryInsertHandles?.[plannedInsertIndex];
            const insert = handle === undefined ? undefined : this.externalCallEntryInserts[handle];
            builder.addOutput(insert && insert.commitment !== ''
              ? {
                to: insert.to,
                amount: 1000n,
                token: {
                  amount: 0n,
                  category: group.categoryId,
                  nft: { capability: 'mutable', commitment: insert.commitment },
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
            if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_APPROVE_ENTRY === '1' && group.functionName === 'approve') {
              console.error('builder-approve-entry-output', {
                groupIndex, si, absoluteOutput: builder.outputs.length,
                hasCommitment: bEntryOut !== undefined,
                commitment: bEntryOut,
              });
            }
            const embeddedEntry = this.entryNfts.find((entry) => entry.utxo !== undefined
              && entry.utxo.txid.toLowerCase() === input.txid.toLowerCase()
              && entry.utxo.vout === input.vout);
            const embeddedCommitment = embeddedEntry === undefined
              ? undefined : this.entryRawCommitments.get(embeddedEntry.slotIndex);
            const entryLockingBytecode = group.batchEntryLockingBytecodes?.get(si)
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
                to: group.batchEntryLockingBytecodes?.get(si) ?? siblingLock ?? Uint8Array.of(0x51),
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
            const returnCommitment = tokenWriterReturnCommitment({
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
              && !['transferFrom', 'transfer'].includes(group.compilerRoute.abiFunction.name)
              && !isPublishJobEventEmitDest(
                builder.outputs.length,
                this._publishJobEventInputIndex(),
                this._publishJobEventAbi()?.blockLayout?.slots
                  .find((eventSlot) => eventSlot.kind === 'event')?.offset ?? 4,
              )
              && !(group.functionName === 'publishJobEvent'
                || group.logicalFunctionName === 'publishJobEvent'
                || group.compilerRoute.abiFunction.name === 'publishJobEvent')) {
              // A message-bus route reserves the union of every handler's event slots. Slots not reached by
              // this dispatch are ordinary balanced funding slots and the route covenant binds them by
              // preservation. Do not 1:1-mirror a P2PKH funder onto the executing publishJobEvent dest
              // (`INPUTINDEX + event.offset`) — that lock fails the event OUTPUTBYTECODE pin.
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
        .reduce((sum, t) => sum + t.amount, 0n);
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
        .reduce((sum, s) => sum + s.amount, 0n);

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
      );

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

    const reservedTokenTransferSlots = this.blockLayout?.slots.filter((slot) => slot.kind === 'tcTransfer').length
      ?? allTcTransfers.length;
    for (let transferSlot = 0; transferSlot < reservedTokenTransferSlots; transferSlot += 1) {
      const entry = allTcTransfers[transferSlot];
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
        const commitment = nftIsImmutable && inputCommitment
          ? inputCommitment
          : buildPushdataCommitment(
            group.stateLayout, bCurrentState, nftIdx,
            this.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
          );
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
          - (this.batchEntriesBeforeDynamicChunks ? this._localLoopEntryOutputCount() : 0));
      }
      if (this.loopEntryVars.length > 0) resourceBases.push(this.getLoopEntryOutputBase());
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

    if (this.batchEntriesBeforeDynamicChunks || this.delegateEntriesAfterLowLevel) {
      for (const lv of this.loopEntryVars.filter((value) =>
        value.delegate !== true
          && (value.categoryId === undefined || value.categoryId === this.categoryId))) {
        for (const commitment of this.loopEntryCommitments.get(lv.collection) ?? []) {
          const entryOutput = {
            to: lv.lockingBytecode, amount: 1200n,
            token: { amount: 0n, category: lv.categoryId ?? this.categoryId,
              nft: { capability: 'mutable' as const, commitment } },
          };
          entryOutput.amount = BigInt(Math.max(1200, calculateDust(entryOutput)));
          builder.addOutput(entryOutput);
        }
      }
    }

    const appendValueChunks = (): void => {
      for (const vco of this.valueChunkOutputs) {
        const chunkOutput = { ...vco };
        chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
        builder.addOutput(chunkOutput);
      }
      for (const { collection, lockingBytecode } of this.getValueChunkVars()) {
        for (const commitment of this.valueChunkRawCommitments.get(collection) ?? []) {
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
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1' && commitments.length > 0) {
          console.error('append-dynamic-chunks', {
            name: dv.name,
            lockingBytecode: binToHex(dv.lockingBytecode),
            outputBase: builder.outputs.length,
            computedBase: this.getChunkOutputBase(),
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
    for (const lv of (this.batchEntriesBeforeDynamicChunks || this.delegateEntriesAfterLowLevel
      ? [] : this.loopEntryVars.filter((value) =>
        value.delegate !== true
          && (value.categoryId === undefined || value.categoryId === this.categoryId)))) {
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
        entryOutput.amount = BigInt(Math.max(1200, calculateDust(entryOutput)));
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
      const trailingOutputCount = this.iterationEntryInputs.length
        + this._dynamicChunkOutputCount()
        + this._localLoopEntryOutputCount()
        + this.valueChunkOutputs.length
        + [...this.getValueChunkVars()].reduce(
          (sum, value) => sum + (this.valueChunkRawCommitments.get(value.collection) ?? []).length,
          0,
        );
      if (trailingOutputCount > trailingCapacity) {
        throw new Error(
          'Runtime resource outputs exceed balanced trailing capacity '
          + `(${trailingOutputCount} > ${trailingCapacity})`,
        );
      }
      for (let i = trailingOutputCount; i < trailingCapacity; i++) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
      }
    }

    if (this.compilerRouteDelegateBlock) {
      this.lowLevelCallUtxoGroups.forEach((group, groupIndex) => {
        if (group.callMode === 'delegatecall' && !associatedDelegateOutputs.has(groupIndex)) {
          appendDelegateGroupOutputs(groupIndex);
        }
      });
    }

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
        entryOutput.amount = BigInt(Math.max(1200, calculateDust(entryOutput)));
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

    // Nested publishJobEvent emits at implInput+event.offset (delegate output-only
    // slots are implementation-relative). Identity anchors that landed on that
    // coordinate are re-appended after the event so the event pin keeps its index.
    const displacedDelegateIdentities: Array<{
      to: Uint8Array; amount: bigint; token: NonNullable<Output['token']>;
    }> = [];
    for (const [llcIndex, llc] of this.lowLevelCallUtxoGroups.entries()) {
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
        const namedImpl = this._executingPublishJobEventInputIndex(builder);
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
          && !isOverwritableEmitOccupant(existing, { persistCloneOk: !persistEmit })) {
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
        const persistReadyInsert = (jobEventTypeOf(emitEvent) === 14 || jobEventTypeOf(emitEvent) === 15)
          && isPersistedJobEventsReady() && !this._rootIsPublishJobPost();
        const constructedCommit = emitEvent !== undefined && (emptyAddressEvent || persistReadyInsert)
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
            persistCloneOk: !persistEmit,
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
          persistCloneOk: !persistEmit,
          destInput: this.allInputs[outputIndex],
        });
      }

      const entrySlots = (fn?.blockLayout?.slots ?? []).filter(
        (slot: { kind: string; offset: number }) => slot.kind === 'entry',
      );
      for (const slot of entrySlots) {
        if (slot.offset < walkedWidth) continue;
        const namedImpl = this._executingPublishJobEventInputIndex(builder);
        const outputIndex = namedImpl >= 0 && (fn?.name === 'publishJobEvent' || llc.functionName === 'publishJobEvent')
          ? namedImpl + slot.offset
          : implIndex + slot.offset;
        const commitment = this.getExternalCallEntryOutput(categoryId, slot.offset);
        if (!commitment) continue;
        const existing = builder.outputs[outputIndex];
        if (existing?.token?.nft?.capability === 'minting') continue;
        const occupant = this.allInputs[outputIndex];
        const entryLock = persistUpdateDigestLock(
          this._persistJobEventsTokenCategory() ?? this._jobEventsPublishCategory() ?? categoryId,
          this._persistDigestCategories(),
        );
        const lockingBytecode = (entryLock && entryLock.length === 35 ? entryLock : undefined)
          ?? (occupant && 'unlocker' in occupant && occupant.unlocker
            ? occupant.unlocker.generateLockingBytecode()
            : existing?.to instanceof Uint8Array
              ? existing.to
              : undefined);
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

    // Nested publishJobEvent pins value chunks at the covenant's trailing base
    // (proxy/master + blockSize), which is below impl+blockSize when the
    // implementation sits after the proxy block. Materialize every recovered
    // pin; extractRouteChunkPin already rejected non-chunk OUTPUTBYTECODE checks.
    for (const [llcIndex, llc] of this.lowLevelCallUtxoGroups.entries()) {
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
    this._applyDerivedValueChunks(builder);
    for (const identity of displacedDelegateIdentities) {
      builder.addOutput(identity);
    }
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

    if (this.delegateEntriesAfterLowLevel || this.delegateDynamicChunksAtSuffix) appendDynamicChunks();

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
    if (this.mintingOutputSwap && this.delegateDynamicChunksAtSuffix) {
      const jobsCount = this._dynamicChunkOutputCount();
      const extra = builder.outputs.length - (this.allInputs.length + jobsCount + 3);
      // Three non-chunk tail outputs are part of the routed layout. Only surplus beyond that baseline is
      // disposable; compacting when `extra <= 3` removes an alignment pad from the participant band and shifts
      // every nested state recreation away from its input index.
      const disposableExtra = Math.max(0, extra - 3);
      if (jobsCount > 0 && disposableExtra > 0) {
        const suffixLen = jobsCount + 1;
        let dropped = 0;
        const tokenBlockEnd = this.mintingOutputSwap.from + this.mintingOutputSwap.width
          + (this.externalCallUtxoGroups.find((group) =>
            group.categoryId === this.mintingOutputSwap?.categoryId
            && group.sharedGroupIndex === undefined)?.blockLayout?.blockSize ?? 8);
        for (let index = builder.outputs.length - suffixLen - 1;
          index >= 0 && dropped < Math.min(disposableExtra, 1); index--) {
          if (index >= this.mintingOutputSwap.from + this.mintingOutputSwap.width && index < tokenBlockEnd) {
            continue;
          }
          const output = builder.outputs[index];
          const lock = output?.to instanceof Uint8Array ? output.to : undefined;
          const isTruePad = !!lock && lock.length === 1 && lock[0] === 0x51 && !output?.token;
          const commitment = output?.token?.nft?.commitment;
          const isBareZero = String(commitment ?? '').toLowerCase() === '00';
          // A routed raw call can provision both its conditional and opaque-return placeholder at the same
          // OP_TRUE tail coordinate. Only the one-byte zero placeholder is disposable. Same-category immutable
          // outputs in general are NOT duplicates: return witnesses, events, and SCID identity anchors all share
          // that shape and must survive this suffix compaction.
          const isDupNone = !!lock && lock.length === 1 && lock[0] === 0x51 && isBareZero
            && output?.token?.nft?.capability === 'none';
          if (!isTruePad && !isDupNone) continue;
          builder.outputs.splice(index, 1);
          dropped += 1;
        }
      }
    }
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
    this._constrainSwappedTokenImmutableOutputs(builder);
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
    this._reassertNestedDataNftTwins(builder);
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
    const chunkBand = this.getPublishJobEventsBand();
    const chunkLock = this.jobEventsRedeemLock
      ?? (this.externalCallUtxoGroups.find((group) =>
        (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent')?.categoryId
        ? persistedJobEventsLock(this.externalCallUtxoGroups.find((group) =>
          (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent')!.categoryId!)
        : undefined);
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
    this._reassertNestedDataNftTwins(builder);
    for (const [identity, output] of returnOutputRefs) {
      const index = builder.outputs.indexOf(output);
      if (index >= 0) this.builtReturnEventOutputIndices.set(identity, index);
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
      .reduce((sum, t) => sum + t.amount, 0n);
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
      .reduce((sum, t) => sum + t.amount, 0n);
    const nftTransferred = this.pendingTokenContainerTransferNfts
      .some((t) => t.tokenContainerCategoryId === categoryId);
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
    const inBlock = new Set<string>();
    for (let i = 0; i < this.externalCallUtxoGroups.length; i += 1) {
      if (this.isInBlockReturnEventGroup(i)) {
        const group = this.externalCallUtxoGroups[i];
        inBlock.add(`external-call:${group.fusedReturnGroupIndex ?? i}`);
      }
    }
    const tail = this.pendingReturnEventOutputs.filter((re) => ![...inBlock].some((identity) =>
      re.identity === identity || re.identity.startsWith(`${identity}:`)));
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
    const verbose = env?.SOLIDC_DEBUG_COVENANT_TRACE === '1';
    this._pinPersistDigestLocks(builder);
    this._pinPersistDigestInputLocks(builder);
    const transaction = builder.buildLibauthTransaction(true);
    this._pinPersistDigestLocksOnTransaction(transaction);
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
        const sha256Inputs: string[] = [];
        const outputBytecodeMatches: Array<{
          body: number; index: number; matches: boolean; countBefore?: string;
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
            if (instruction?.opcode === 0xa8) {
              const hashed = state.stack[state.stack.length - 1];
              if (hashed && hashed.length >= 60) sha256Inputs.push(binToHex(hashed));
            }
            if (instruction?.opcode === 0xcd) {
              const encodedIndex = state.stack[state.stack.length - 1];
              pendingOutputBytecodeIndex = encodedIndex === undefined ? undefined : encodedIndex.reduce(
                (value, byte, byteIndex) => value + byte * (256 ** byteIndex), 0,
              );
            } else if (instruction?.opcode === 0x87 && pendingOutputBytecodeIndex !== undefined) {
              const left = state.stack[state.stack.length - 2];
              const right = state.stack[state.stack.length - 1];
              outputBytecodeMatches.push({
                body: state.instructions.length,
                index: pendingOutputBytecodeIndex,
                matches: left !== undefined && right !== undefined && left.length === right.length
                  && left.every((byte, byteIndex) => byte === right[byteIndex]),
                countBefore: state.stack[state.stack.length - 4] === undefined
                  ? undefined : binToHex(state.stack[state.stack.length - 4]),
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
          const dest1In = this.allInputs[1];
          const dest1Out = transaction.outputs[1];
          const dest1Builder = builder.outputs[1];
          const band = this.getPublishJobEventsBand();
          const wantLock = 'aa20a7055a14';
          const destLocks = transaction.outputs.map((output, dest) => ({
            dest,
            lock: binToHex(output.lockingBytecode).slice(0, 20),
            commit: binToHex(output.token?.nft?.commitment ?? new Uint8Array()).slice(0, 16),
            hit: binToHex(output.lockingBytecode).startsWith(wantLock),
          }));
          console.error(`[covenant VM trace] input ${idx}: ${finalState.error}\n${ringText}\n`
            + `lastLockMismatch=${JSON.stringify(lastMismatch ?? null)} `
            + `equalOk=${outputBytecodeMatches.filter((entry) => entry.matches).length}\n`
            + `band=${JSON.stringify(band)} persistReady=${isPersistedJobEventsReady()}`
            + ` impl=${this._executingPublishJobEventInputIndex()}\n`
            + `nftSrc=${JSON.stringify({
              categoryId: this.externalCallUtxoGroups.find((group) =>
                (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent')?.categoryId
                ?? this.lowLevelCallUtxoGroups.find((group) => group.functionName === 'publishJobEvent')
                  ?.categoryId,
              sources: selectPublishJobEventDataNftSources(
                this.allInputs, this._executingPublishJobEventInputIndex(),
                this.externalCallUtxoGroups.find((group) =>
                  (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent')?.categoryId
                  ?? this.lowLevelCallUtxoGroups.find((group) => group.functionName === 'publishJobEvent')
                    ?.categoryId,
              ),
              dests: publishJobEventDataNftDests(this._executingPublishJobEventInputIndex()),
              ins: [9, 10, 11, 12, 13].map((index) => ({
                index,
                cap: this.allInputs[index]?.token?.nft?.capability ?? '-',
                commit: String(this.allInputs[index]?.token?.nft?.commitment ?? '').slice(0, 16),
                cat: String(this.allInputs[index]?.token?.category ?? '').slice(0, 16),
              })),
            })}\n`
            + `dest1-in=${dest1In?.unlocker ? binToHex(dest1In.unlocker.generateLockingBytecode()).slice(0, 20) : 'none'}`
            + `:cap=${dest1In?.token?.nft?.capability ?? '-'}`
            + `:commit=${String(dest1In?.token?.nft?.commitment ?? '').slice(0, 24)}\n`
            + `dest1-tx=${dest1Out ? binToHex(dest1Out.lockingBytecode).slice(0, 20) : 'none'}`
            + `:commit=${binToHex(dest1Out?.token?.nft?.commitment ?? new Uint8Array()).slice(0, 24)}\n`
            + `dest1-b=${dest1Builder?.to instanceof Uint8Array ? binToHex(dest1Builder.to).slice(0, 20) : String(dest1Builder?.to ?? 'none').slice(0, 20)}`
            + `:commit=${String(dest1Builder?.token?.nft?.commitment ?? '').slice(0, 24)}\n`
            + `wantLockDests=${JSON.stringify(destLocks.filter((row) => row.hit))}\n`
            + `obc=${JSON.stringify(outputBytecodeMatches)}\n`
            + `in11=${(builder.inputs[idx] as { unlocker?: { abiFunction?: { name?: string } } } | undefined)
              ?.unlocker?.abiFunction?.name ?? '?'}\n`
            + `chunkBaseArgs=${JSON.stringify([...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]
              .filter((group) => (group.functionName ?? group.logicalFunctionName) === 'publishJobEvent')
              .map((group) => ({
                fn: group.functionName ?? group.logicalFunctionName,
                internal: String(group.internalArgs?.__internal__valueChunkOutputBase ?? ''),
                route: String(group.compilerRoute?.internalArgs?.__internal__valueChunkOutputBase ?? ''),
              })))}\n`
            + `dests=${JSON.stringify(destLocks.slice(0, 22))}`);
          if (idx === 15) {
            console.error('dest15-sha256-count', sha256Inputs.length);
            console.error('dest15-sha256-lens', sha256Inputs.map((hex) => hex.length / 2).join(','));
            console.error('dest15-sha256-heads', sha256Inputs.map((hex) => hex.slice(0, 32)).join('|'));
            console.error('dest15-sha256-0', sha256Inputs[0] ?? '');
          }
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
  private _repairComputedChunkOutput(builder: TransactionBuilder, inputIndex: number): boolean {
    const derivedChanged = this._applyDerivedValueChunks(builder);
    const transaction = builder.buildLibauthTransaction(true);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    let repair: { outputIndex: number; lockingBytecode?: Uint8Array; commitment: Uint8Array } | undefined;
    const eventRepairs = new Map<number, Uint8Array>();
    const tokenEventSlots = new Map<number, { categoryId: string; groupIndex: number; eventOrdinal: number }>();
    const tokenReturnSlots = new Set<number>();
    const delegateEventSlots = new Set<number>();
    for (const [llcIndex, llc] of this.lowLevelCallUtxoGroups.entries()) {
      if (llc.callMode !== 'delegatecall') continue;
      const impl = this.getLowLevelCallMasterInputIndex(llcIndex);
      if (impl < 0) continue;
      const fn = llc.compilerRoute?.abiFunction
        ?? llc.externalContract?.inner?.artifact.abi.find((candidate: AbiFunction) => candidate.name === llc.functionName);
      for (const slot of fn?.blockLayout?.slots ?? []) {
        if (slot.kind === 'event') delegateEventSlots.add(impl + slot.offset);
      }
    }
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined) continue;
      const name = group.functionName ?? group.compilerRoute?.abiFunction.name;
      if (name !== 'transferFrom' && name !== 'transfer' && name !== 'approve') continue;
      let master = this.findMintingInputIndex(group.categoryId);
      if (master < 0) master = this.getExternalCallMasterInputIndex(groupIndex);
      if (master < 0 || !group.blockLayout) continue;
      let eventOrdinal = 0;
      for (const slot of group.blockLayout.slots) {
        if (slot.kind === 'event') {
          tokenEventSlots.set(master + slot.offset, {
            categoryId: group.categoryId, groupIndex, eventOrdinal,
          });
          eventOrdinal += 1;
        } else if (slot.kind === 'returnEvent') {
          tokenReturnSlots.add(master + slot.offset);
        }
      }
    }
    const failingCategory = builder.inputs[inputIndex]?.token?.category;
    const associatedCategories = new Set<string>();
    if (failingCategory) associatedCategories.add(failingCategory);
    for (const [llcIndex, llc] of this.lowLevelCallUtxoGroups.entries()) {
      if (llc.callMode !== 'delegatecall') continue;
      if (this.getLowLevelCallMasterInputIndex(llcIndex) !== inputIndex) continue;
      const proxyGroup = this.externalCallUtxoGroups.find((group) => group.delegateCallGroupIndex === llcIndex);
      if (proxyGroup?.categoryId) associatedCategories.add(proxyGroup.categoryId);
    }
    const vm = createVirtualMachineBch2026ForProvider(this.builderOptions.provider, {
      opcodes: new Set(Array.from({ length: 256 }, (_unused, opcode) => opcode)),
      beforeOperation: (unknownState) => {
        const state = unknownState as {
          ip: number; instructions: Array<{ opcode: number; data?: Uint8Array }>; stack: Uint8Array[];
        };
        if (state.instructions[state.ip]?.opcode === 0xd2 && state.stack.length >= 2) {
          // Only the `OTC; EQUALVERIFY` pin names the authenticated output
          // commitment. Later `OTC` in the same script feed entry proofs and
          // hashes; treating those as writes poisons publishJobPost entries.
          const nextOpcode = state.instructions[state.ip + 1]?.opcode;
          if (nextOpcode !== 0x87 && nextOpcode !== 0x88) return;
          const outputIndex = Number(decodeVmScriptNumber(state.stack[state.stack.length - 1]));
          const commitment = state.stack[state.stack.length - 2];
          const output = outputIndex >= 0 && outputIndex < builder.outputs.length
            ? builder.outputs[outputIndex] : undefined;
          const sameCategory = output?.token?.category !== undefined
            && associatedCategories.has(output.token.category);
          const maxBytes = output?.token?.nft?.capability === 'none'
            ? (this.builderOptions.provider?.consensusLimits?.maximumNftCommitmentBytes ?? 128)
            : 128;
          const eventSlot = tokenEventSlots.get(outputIndex);
          const isReturnSlot = tokenReturnSlots.has(outputIndex);
          // Real Approval/Transfer blobs carry addresses (23/25/35) plus amount.
          // 32-byte all-zero placeholders must not refill Approval at master+5.
          // Typed events (Initialized=`51`) are short script-numbers at dest slots.
          const commitHex = binToHex(commitment);
          const realEvent = commitment.length > 0 && !commitment.every((byte) => byte === 0)
            && (commitment.length > 32 || isLearnedEventEmitCommitment(commitHex));
          const realReturn = isReturnSlot && commitment.length > 0
            && !commitment.every((byte) => byte === 0);
          if ((eventSlot || delegateEventSlots.has(outputIndex)) && realEvent) {
            eventRepairs.set(outputIndex, commitment);
          } else if (realReturn) {
            eventRepairs.set(outputIndex, commitment);
          } else if (output?.token?.nft?.capability === 'none' && sameCategory
            && !isScidIdentityCommitment(output.token.nft.commitment)
            && isRepairableNftOutput('none', commitment.length, maxBytes)
            && realEvent) {
            eventRepairs.set(outputIndex, commitment);
          } else if (!eventSlot && !isReturnSlot && commitment.length <= 128 && outputIndex >= 0
            && outputIndex < builder.outputs.length
            && !isScidIdentityCommitment(output?.token?.nft?.commitment)) {
            repair = { outputIndex, commitment };
          }
          return;
        }
        if (state.instructions[state.ip]?.opcode !== 0xcd || state.stack.length < 4) return;
        const chunkShaped = state.instructions.some((instruction, at) => instruction.data?.length === 1
          && instruction.data[0] === 126 && state.instructions[at + 1]?.opcode === 0x95
          && state.instructions[at + 2]?.data?.length === 1
          && state.instructions[at + 2]?.data?.[0] === 28
          && state.instructions[at + 3]?.opcode === 0x93);
        // publishJobEvent outlines the pin as SWAP OUTPUTBYTECODE with uint16||data
        // under the address; the 126/DIV/28/ADD sequence is not in this frame.
        const outlinedChunkPin = state.instructions[state.ip - 1]?.opcode === 0x7c
          && state.stack[state.stack.length - 2]?.length === 35
          && state.stack[state.stack.length - 2][0] === 0xaa
          && state.stack[state.stack.length - 2][1] === 0x20
          && state.stack[state.stack.length - 2][34] === 0x87
          && state.stack[state.stack.length - 4]?.length >= 3
          && state.stack[state.stack.length - 4]?.length <= 128;
        if (!chunkShaped && !outlinedChunkPin) return;
        const lockingBytecode = state.stack[state.stack.length - 2];
        const commitment = state.stack[state.stack.length - 4];
        const outputIndex = Number(decodeVmScriptNumber(state.stack[state.stack.length - 1]));
        if (lockingBytecode.length !== 35 || lockingBytecode[0] !== 0xaa || lockingBytecode[1] !== 0x20
          || lockingBytecode[34] !== 0x87 || commitment.length < 3 || commitment.length > 128
          || outputIndex < 0 || outputIndex >= builder.outputs.length) return;
        repair = { outputIndex, lockingBytecode, commitment };
      },
    });
    vm.evaluate({ inputIndex, sourceOutputs, transaction });
    let changed = false;
    for (const [outputIndex, commitment] of eventRepairs) {
      if (commitment.length === 0 || commitment.every((byte) => byte === 0)) continue;
      const output = builder.outputs[outputIndex];
      if (!output) continue;
      if (isScidIdentityCommitment(output.token?.nft?.commitment)) continue;
      const hex = binToHex(commitment);
      const eventSlot = tokenEventSlots.get(outputIndex);
      const category = eventSlot?.categoryId ?? output.token?.category;
      if (!category) continue;
      if (output.token?.nft?.capability === 'none' && output.token.nft.commitment === hex) continue;
      output.token = {
        amount: 0n,
        category,
        nft: { capability: 'none', commitment: hex },
      };
      if (eventSlot) {
        const group = this.externalCallUtxoGroups[eventSlot.groupIndex];
        const emits = (group.compilerRoute?.abiFunction ?? group.externalContract.inner.artifact.abi
          .find((fn: { name: string }) => fn.name === group.functionName))?.emits ?? [];
        const emitInfo = emits[eventSlot.eventOrdinal];
        if (group && emitInfo) {
          const eventOutputs = group.eventOutputs ? [...group.eventOutputs] : [];
          eventOutputs[eventSlot.eventOrdinal] = {
            eventSignature: emitInfo.eventSignature,
            commitment: hex,
            lockingBytecode: output.to instanceof Uint8Array
              ? output.to : addressToLockScript(output.to),
          };
          group.eventOutputs = eventOutputs;
        }
      }
      changed = true;
    }
    if (repair) {
      const found = repair;
      const output = builder.outputs[found.outputIndex];
      if (output?.token?.nft) {
        const proposedHex = binToHex(found.commitment);
        const currentHex = String(output.token.nft.commitment ?? '');
        const action = canApplyRepairedNftCommitment({
          capability: output.token.nft.capability,
          currentCommitmentHex: currentHex,
          proposed: found.commitment,
          hasLockingBytecode: found.lockingBytecode !== undefined,
        });
        if (action !== 'skip') {
          if (action === 'apply-lock-and-commit' && found.lockingBytecode !== undefined) {
            output.to = found.lockingBytecode;
          }
          output.token.nft.commitment = proposedHex;
          if (output.token.nft.capability === 'mutable') {
            this.setExternalCallEntryOutputAt(
              found.outputIndex, output.token.category ?? '', proposedHex,
            );
          }
          changed = true;
        }
      }
    }
    return changed || derivedChanged;
  }

  /** Evaluate one known repairable participant without rescanning every independent input in the composition. */
  private _inputPassesCovenant(builder: TransactionBuilder, inputIndex: number): boolean {
    const transaction = builder.buildLibauthTransaction(true);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = finalizedInputVm(this.builderOptions.provider);
    return vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
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

  async send(): Promise<TransactionDetails> {
    const provider = this.builderOptions.provider;
    if (!provider) {
      throw new Error('No network provider available');
    }


    // -- Phase 1: build the covenant transaction (logic only, no fee) --
    let covenantBuilder = this.build();
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
    const neededFee = this.computeMinFee(totalEstimatedSize);

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
    this._syncBuilderUnlockers(finalBuilder);
    this._clearDummyTokenEventCommitments(finalBuilder);
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined) continue;
      const name = group.functionName ?? group.compilerRoute?.abiFunction.name;
      if (name !== 'transferFrom' && name !== 'transfer' && name !== 'approve') continue;
      let master = this.findMintingInputIndex(group.categoryId);
      if (master < 0) master = this.getExternalCallMasterInputIndex(groupIndex);
      if (master >= 0) {
        // One trace can expose only the first mismatching conditional event/chunk pin. Converge this known
        // repairable input directly before the authoritative provider check; otherwise the general preflight
        // must re-evaluate every composed input once per newly exposed pin.
        for (let pass = 0; pass <= 32; pass++) {
          if (this._inputPassesCovenant(finalBuilder, master)) break;
          const changed = this._repairComputedChunkOutput(finalBuilder, master);
          if (!changed) break;
          this._clearDummyTokenEventCommitments(finalBuilder);
        }
      }
    }
    this._clearDummyTokenEventCommitments(finalBuilder);
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
    this._reassertMintingOneToOne(finalBuilder);
    this._reassertNestedDataNftTwins(finalBuilder);
    if (isPersistedJobEventsReady()) {
      this._reassertPersistedJobEventsOneToOnes(
        finalBuilder, this._scaledEmitOutputIndex(finalBuilder.outputs.length) ?? -1,
      );
    }

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
        this.insertBeforeLateValueSuffix(finalBuilder, changeOutput);
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

    // X210. The ordinary stateful submit path must verify the exact fully funded transaction too. A provider
    // may advertise that its unmodified submit path performs authoritative full validation (the in-memory
    // mem-cash provider does); in that case, running the same configured VM here first only evaluates every
    // input twice. The capability turns itself off when that submit method is patched or overridden, preserving
    // this SDK gate for hostile-provider and failure-injection paths.
    const providerValidatesFinalizedTransaction = (provider as typeof provider & {
      canValidateFinalizedTransaction?: () => boolean;
    }).canValidateFinalizedTransaction?.() === true;
    // This gate is deliberately non-absorbing: unlike debug(), it never catches an objection, and stateSuccess
    // includes completed scripts with a falsy top item as well as raised VM errors.
    const needsJobEventsRepair = this.getPublishJobEventsBand() !== undefined;
    if (!this.strictVmPreflight && (!providerValidatesFinalizedTransaction || needsJobEventsRepair)) {
      let preflightError: unknown;
      for (let pass = 0; pass <= 32; pass++) {
        this._refreshPublishJobEventsChunkBase(finalBuilder);
        this._repairPublishJobEventDestLocks(finalBuilder);
        this._pinPersistDigestLocks(finalBuilder);
        this._pinPersistDigestInputLocks(finalBuilder);
        this._reassertPublishJobEventDataNftOneToOnes(finalBuilder);
        this._reassertProxyPreserveOneToOnes(finalBuilder);
        try {
          const transaction = finalBuilder.buildLibauthTransaction(true);
          this._pinPersistDigestLocksOnTransaction(transaction);
          assertFinalizedTransactionCovenants(finalBuilder, transaction);
          preflightError = undefined;
          break;
        } catch (error) {
          preflightError = error;
          const reason = error instanceof Error ? error.message : String(error);
          const failedInput = reason.match(/input(?: index)? (\d+)/)?.[1];
          if (failedInput === undefined
            || !this._repairComputedChunkOutput(finalBuilder, Number(failedInput))) break;
          this._clearDummyTokenEventCommitments(finalBuilder);
          this._reassertNestedEmitEvents(finalBuilder);
          this._reassertDelegateImplEvents(finalBuilder);
          this._placeTailReturnAfterSwappedTokenBlock(finalBuilder);
          this._materializeJobEventsBand(finalBuilder);
          this._reassertScaledPreserveOneToOnes(finalBuilder);
          this._reassertNestedEmitEvents(finalBuilder);
          this._reassertDelegateImplEvents(finalBuilder);
          this._reassertMintingOneToOne(finalBuilder);
          this._reassertNestedDataNftTwins(finalBuilder);
          if (isPersistedJobEventsReady()) {
            this._reassertPersistedJobEventsOneToOnes(
              finalBuilder, this._scaledEmitOutputIndex(finalBuilder.outputs.length) ?? -1,
            );
          }
          this._reassertNestedEmitEvents(finalBuilder);
        }
      }
      if (preflightError !== undefined) {
        const error = preflightError;
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_PREFLIGHT === '1') {
          console.error('final-preflight-inputs', finalBuilder.inputs.map((input, index) => ({
            index,
            name: (input.unlocker as { abiFunction?: { name?: string } } | undefined)?.abiFunction?.name,
            selector: (input.unlocker as { abiFunction?: { selector?: string } } | undefined)?.abiFunction?.selector,
            unlockingBytes: finalBuilder.buildLibauthTransaction(true).inputs[index]?.unlockingBytecode.length,
            lockingBytes: input.unlocker?.generateLockingBytecode().length,
            category: input.token?.category,
          })));
          console.error('final-preflight-outputs', finalBuilder.outputs.map((output, index) => ({
            index,
            amount: output.amount,
            category: output.token?.category,
            commitment: output.token?.nft?.commitment,
            lockingBytecode: typeof output.to === 'string'
              ? output.to.slice(0, 80) : binToHex(output.to).slice(0, 80),
          })));
          console.error('final-preflight-groups', this.lowLevelCallUtxoGroups.map((group, index) => ({
            index,
            functionName: group.functionName,
            blockLayout: group.blockLayout,
            routeEvents: group.compilerRoute?.eventSignaturesBySlot,
            eventOutputs: group.eventOutputs?.map((output) => output && ({
              signature: output.eventSignature,
              commitment: output.commitment,
            })),
          })));
        }
        this._logCovenantFailureTrace(finalBuilder, error instanceof Error ? error.message : String(error));
        // Attribution only. The refusal stands and is re-raised UNCHANGED: callers match this message exactly,
        // including anchored patterns, so the explanation rides on `cause` rather than being appended to it.
        if (discoveryProbeFailure !== undefined && error instanceof Error && error.cause === undefined) {
          error.cause = new Error(
            'A covenant discovery probe failed earlier in this send, so any commitments or output counts it '
            + 'would have discovered were unavailable when the transaction was assembled. That is a known cause '
            + 'of this refusal for shapes needing dynamic chunk or entry discovery. The probe reported: '
            + discoveryProbeFailure,
          );
        }
        throw error;
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
    this._reassertNestedEmitEvents(finalBuilder);
    this._reassertDelegateImplEvents(finalBuilder);
    this._reassertScaledPreserveOneToOnes(finalBuilder);
    this._reassertNestedEmitEvents(finalBuilder);
    this._reassertDelegateImplEvents(finalBuilder);
    this._reassertNestedDataNftTwins(finalBuilder);
    if (isPersistedJobEventsReady()) {
      this._reassertPersistedJobEventsOneToOnes(
        finalBuilder, this._scaledEmitOutputIndex(finalBuilder.outputs.length) ?? -1,
      );
    }
    this._refreshPublishJobEventsChunkBase(finalBuilder);
    this._repairPublishJobEventDestLocks(finalBuilder);
    this._pinPersistDigestLocks(finalBuilder);
    this._reassertPublishJobEventDataNftOneToOnes(finalBuilder);
    this._reassertProxyPreserveOneToOnes(finalBuilder);

    let rawTx = finalBuilder.build();

    // -- Phase 4: fee sanity checks --
    const { decodeTransactionUnsafe, hash256 } = await import('@bitauth/libauth');
    const totalInputSats = this.allInputs.reduce((sum, inp) => sum + inp.satoshis, 0n)
      + (this.sidecarUtxo?.satoshis ?? 0n); // side-car input is added by build(), not in allInputs
    let rawTxBin = hexToBin(rawTx);
    let decodedTx = decodeTransactionUnsafe(rawTxBin);
    let totalOutputSats = (decodedTx as { outputs: Array<{ valueSatoshis: bigint }> }).outputs
      .reduce((sum, out) => sum + out.valueSatoshis, 0n);
    let fee = totalInputSats - totalOutputSats;

    if (fee < 0n) {
      throw new Error(
        `Transaction outputs (${totalOutputSats} sats) exceed inputs (${totalInputSats} sats). `
        + 'This transaction is invalid. Add more funding inputs or reduce outputs.',
      );
    }

    let txSize = BigInt(encodeTransaction(decodedTx).byteLength);
    const minFee = this.computeMinFee(txSize);
    if (this._checkMinRelayFee && fee < minFee) {
      const shortfall = minFee - fee;
      const changeIndex = [...finalBuilder.outputs].map((output, index) => ({ output, index }))
        .reverse()
        .find(({ output }) => {
          const lock = output.to instanceof Uint8Array ? output.to : undefined;
          return !!lock && lock.length === 25 && lock[0] === 0x76 && lock[1] === 0xa9
            && !output.token && (output.amount ?? 0n) > shortfall + 1000n;
        })?.index;
      if (changeIndex === undefined) {
        const fpb = Number(minFee) / Number(txSize);
        throw new Error(
          `Transaction fee of ${fee} satoshis is below the minimum relay fee `
          + `(${minFee} satoshis for a ${txSize}-byte transaction at ${fpb.toFixed(1)} sat/byte). `
          + 'Add more funding inputs or reduce outputs.',
        );
      }
      const current = finalBuilder.outputs[changeIndex];
      finalBuilder.outputs[changeIndex] = { ...current, amount: (current.amount ?? 0n) - shortfall };
      this._repairPublishJobEventDestLocks(finalBuilder);
      this._pinPersistDigestLocks(finalBuilder);
      rawTx = finalBuilder.build();
      rawTxBin = hexToBin(rawTx);
      decodedTx = decodeTransactionUnsafe(rawTxBin);
      totalOutputSats = (decodedTx as { outputs: Array<{ valueSatoshis: bigint }> }).outputs
        .reduce((sum, out) => sum + out.valueSatoshis, 0n);
      fee = totalInputSats - totalOutputSats;
      txSize = BigInt(encodeTransaction(decodedTx).byteLength);
    }

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
      inputSubjects: inputSubjectsOfBuilder(finalBuilder),
      consensusLimits: provider.consensusLimits,
      // A provider that explicitly widens the transaction-size consensus profile is also the authority that
      // will receive these bytes. This is the mock/miner-direct profile: do not apply the production peer-relay
      // ceiling on top of its advertised limit. Live providers publish no override and remain policy-gated.
      allowNonRelayable: (provider.consensusLimits?.maximumTransactionBytes ?? 100_000) > 100_000,
    });

    // -- Phase 5: submit --
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
      txid = await provider.sendRawTransaction(rawTx);
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
    return details;
  }

  /**
   * Decode the event NFT outputs this transaction created into ethers-v5-style receipt events. An output is an
   * event log iff its locking bytecode matches one of the event NFT addresses; its commitment is decoded against
   * that event's ABI. Outputs are scanned in vout order, so `events[0]` is the first-emitted event.
   */
  private decodeEmittedEvents(outputs: readonly LibauthOutput[]): ReceiptEvent[] {
    if (this.eventDefinitions.length === 0 || this.eventNftLockingBytecodes.size === 0) return [];
    const sigByLbc = new Map<string, string>();
    for (const [sig, lbc] of this.eventNftLockingBytecodes) sigByLbc.set(binToHex(lbc), sig);
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
