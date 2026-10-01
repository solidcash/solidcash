/**
 * phase-boundary extract: Early value-chunk pre-class helpers — legacy* band shims, occupancy/band planning,
 * selectHashedValueForChunkPin, identity-scan pin, chunksFromValue/JobEvents.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binsAreEqual, binToHex } from '@bitauth/libauth';
import {
  Op,
  StateLayout,
  StateValue,
  VALUE_CHUNK_MAX_COUNT,
  VALUE_CHUNK_SIZE,
  VALUE_HEAD_SIZE,
  buildValueChunkCommitment,
  sha256 as sha256Sync,
  splitValueIntoValueChunks,
} from '@solidcash/utils';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import {
  isDisposableAlignmentPad,
  fillJobEventsBandHoles,
  isP2sh32LockScript,
} from './value-chunk-band-helpers.js';
import { persistUpdatePredecessorDests } from './persist-predecessor-layout.js';
import {
  liveJobEventsBandWidth,
  valueChunkBandWidth,
} from './value-chunk-geometry.js';
import {
  type AuthenticatedValueChunk,
  isEmptyValueChunkCommitment,
  isPersistedJobEventsReady,
  legacyJobEventsPersistValueChunkLock,
  persistValueChunkLock,
  persistedCompatibilityValueChunkLock,
  persistedJobEventsUnlockRecipe,
  persistedJobEventsValue,
  persistedJobEventsWidth,
  rememberJobEventsLock,
  rememberJobEventsUnlockRecipe,
  rememberJobEventsValue,
  stageJobEventsValue,
  type ValueChunkWriteDescriptor,
} from './value-chunk-persist.js';

/** legacy JobEvent naming retirement: neutral legacy* wrappers for JobEvents/value-chunk helpers (fixtures tip). */
export function legacyLiveValueChunkBandWidth(
  ...args: Parameters<typeof liveJobEventsBandWidth>
): ReturnType<typeof liveJobEventsBandWidth> {
  return liveJobEventsBandWidth(...args);
}
export function legacyComputePublishValueChunkBand(
  ...args: Parameters<typeof computePublishJobEventsBand>
): ReturnType<typeof computePublishJobEventsBand> {
  return computePublishJobEventsBand(...args);
}
export function legacyFillValueChunkBandHoles(
  ...args: Parameters<typeof fillJobEventsBandHoles>
): ReturnType<typeof fillJobEventsBandHoles> {
  return fillJobEventsBandHoles(...args);
}
export function legacyPersistedValueChunkWidth(
  ...args: Parameters<typeof persistedJobEventsWidth>
): ReturnType<typeof persistedJobEventsWidth> {
  return persistedJobEventsWidth(...args);
}
export function legacyPersistedValueChunkValue(
  ...args: Parameters<typeof persistedJobEventsValue>
): ReturnType<typeof persistedJobEventsValue> {
  return persistedJobEventsValue(...args);
}
export function legacyPersistedValueChunkLock(
  ...args: Parameters<typeof persistedCompatibilityValueChunkLock>
): ReturnType<typeof persistedCompatibilityValueChunkLock> {
  return persistedCompatibilityValueChunkLock(...args);
}
export function legacyPersistedValueChunkUnlockRecipe(
  ...args: Parameters<typeof persistedJobEventsUnlockRecipe>
): ReturnType<typeof persistedJobEventsUnlockRecipe> {
  return persistedJobEventsUnlockRecipe(...args);
}
export function legacyRememberValueChunkValue(
  ...args: Parameters<typeof rememberJobEventsValue>
): ReturnType<typeof rememberJobEventsValue> {
  return rememberJobEventsValue(...args);
}
export function legacyRememberValueChunkLock(
  ...args: Parameters<typeof rememberJobEventsLock>
): ReturnType<typeof rememberJobEventsLock> {
  return rememberJobEventsLock(...args);
}
export function legacyRememberValueChunkUnlockRecipe(
  ...args: Parameters<typeof rememberJobEventsUnlockRecipe>
): ReturnType<typeof rememberJobEventsUnlockRecipe> {
  return rememberJobEventsUnlockRecipe(...args);
}
export function legacyStageValueChunkValue(
  ...args: Parameters<typeof stageJobEventsValue>
): ReturnType<typeof stageJobEventsValue> {
  return stageJobEventsValue(...args);
}
export function legacyIsPersistedValueChunkReady(
  ...args: Parameters<typeof isPersistedJobEventsReady>
): ReturnType<typeof isPersistedJobEventsReady> {
  return isPersistedJobEventsReady(...args);
}

export const decodeVmScriptNumber = (bytes: Uint8Array): bigint => {
  let value = 0n;
  const negative = bytes.length > 0 && (bytes[bytes.length - 1] & 0x80) !== 0;
  for (let index = bytes.length - 1; index >= 0; index--) {
    const byte = index === bytes.length - 1 ? bytes[index] & 0x7f : bytes[index];
    value = (value << 8n) | BigInt(byte);
  }
  return negative ? -value : value;
};

/** Resolve an SDK state-update key to the physical data-NFT variable which owns it. */
export function stateVariableForUpdateKey(
  layout: Pick<StateLayout, 'variables'>,
  name: string,
): StateLayout['variables'][number] | undefined {
  return layout.variables.find((variable) => variable.name === name
    || (variable.dynamic === true && `${variable.name}$len` === name));
}

export function stateUpdatesTouchNft(
  layout: Pick<StateLayout, 'variables'>,
  updates: ReadonlyMap<string, StateValue> | undefined,
  nftIndex: number,
): boolean {
  return [...(updates?.keys() ?? [])].some((name) =>
    stateVariableForUpdateKey(layout, name)?.nftIndex === nftIndex);
}

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
 *
 * Reverse-indexed suffix chunks (`TXOUTPUTCOUNT - 1 - nNew` with one trailer) must not grow this
 * way: widening nNew slides chunk 0 left onto non-chunk outputs (empty OUTCOMMIT → OP_SPLIT 32).
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
  /** When true, chunks sit on the reverse suffix — speculative forward growth is harmful. */
  reverseIndexedChunkSuffix?: boolean;
}): boolean {
  return parts.commitmentProgress === 0
    && !parts.hasDerivedState
    && parts.chunkVariableCount > 0
    && parts.loopEntryVariableCount > 0
    && parts.outputVerificationMismatchObserved
    && parts.totalRegionWidth > 0
    && parts.totalRegionWidth < parts.maximumRegionWidth
    && parts.allCommitmentsArePlaceholders
    && parts.reverseIndexedChunkSuffix !== true;
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
    chunksFromValue(value, { lockingBytecode: lock, categoryId }),
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
  candidateValues: ReadonlyArray<Uint8Array> = [],
  /**
   * Continuation value derived for one exact resource by the compiler-described write it belongs to.
   *
   * A handler that appends to a chunkable array computes the post-value from the authenticated pre-value plus
   * its own mutation and writes the chunks without ever leaving that post-value's `len4||root||head28` tail on
   * the stack. The read carrier's tail still authenticates the PRE-value, so tail-anchored selection pins the
   * stale pre-state. The exact resource identity (owner category, collection hash, key slot) is this
   * candidate's authentication; the pre-value stays admissible only through its own tail.
   */
  producerAuthenticatedValue?: Uint8Array,
  /** Descriptor-free compatibility may use the historical width-only recovery. */
  allowUnauthenticatedFallback = true,
  /** Exact compiler-described resource whose covenant locking bytecode is the observed pin. */
  exactWrite?: ValueChunkWriteDescriptor,
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
  const maximumCandidateBytes = VALUE_HEAD_SIZE + VALUE_CHUNK_SIZE * VALUE_CHUNK_MAX_COUNT;
  const chunkCount = (value: Uint8Array): number => (
    value.length > VALUE_HEAD_SIZE
      ? Math.ceil((value.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE)
      : 0
  );
  const exactPinLockFor = (value: Uint8Array): Uint8Array | undefined => {
    if (!exactWrite || !pinIsP2sh32) return undefined;
    const derived = persistValueChunkLock(exactWrite.categoryId, value, exactWrite);
    return derived && binsAreEqual(derived, pinLock!) ? derived : undefined;
  };
  // A compiler-described value-chunk pin commits to the covenant script, not directly to sha256(value). The
  // exact descriptor lets the trace authenticate the already-computed post-value without trusting planner or
  // application reconstruction. Preserve latest-stack chronology when the same resource has several epochs.
  if (exactWrite && pinIsP2sh32) {
    const seen = new Set<Uint8Array>();
    for (let stackIndex = stacks.length - 1; stackIndex >= 0; stackIndex -= 1) {
      const stack = stacks[stackIndex];
      for (let itemIndex = stack.length - 1; itemIndex >= 0; itemIndex -= 1) {
        const item = stack[itemIndex];
        if (item.length <= 60 || item.length > maximumCandidateBytes || seen.has(item)) continue;
        seen.add(item);
        if (minChunks > 0 && chunkCount(item) < minChunks) continue;
        const exactLock = exactPinLockFor(item);
        if (exactLock) return { value: item, lockingBytecode: exactLock };
      }
    }
  }
  if (pinDigest) {
    const seen = new Set<Uint8Array>();
    for (let stackIndex = stacks.length - 1; stackIndex >= 0; stackIndex -= 1) {
      const stack = stacks[stackIndex];
      for (let itemIndex = stack.length - 1; itemIndex >= 0; itemIndex -= 1) {
        const item = stack[itemIndex];
        if (item.length <= 60 || item.length > maximumCandidateBytes || seen.has(item)) continue;
        seen.add(item);
        if (hexOf(digestOf(item)) === pinDigest) {
          return { value: item, lockingBytecode: pinLock! };
        }
      }
    }
  }
  const lockFor = (value: Uint8Array, stack?: ReadonlyArray<Uint8Array>): Uint8Array => {
    if (pinIsP2sh32) return pinLock!;
    const digest = digestOf(value);
    const digestHex = hexOf(digest);
    return stack?.find((item) => (
      item.length === 35 && item[0] === 0xaa && item[1] === 0x20 && item[34] === 0x87
      && binToHex(item.subarray(2, 34)) === digestHex
    )) ?? p2sh32LockFromValueRoot(digest);
  };
  // Match full values to len4||root32||head28 tails still on the stack. The pin
  // address is p2sh32(redeem(root)), so sha256(value) rarely equals pinDigest.
  type AuthenticationEvidence = { stackIndex: number; itemIndex: number; expectedLength?: number };
  const tailEvidence = new Map<string, AuthenticationEvidence>();
  const digestEvidence = new Map<string, AuthenticationEvidence>();
  for (const [stackIndex, stack] of stacks.entries()) {
    for (const [itemIndex, item] of stack.entries()) {
      if (item.length === 32) digestEvidence.set(hexOf(item), { stackIndex, itemIndex });
      if (item.length !== 64) continue;
      const storedLen = item[0]! | (item[1]! << 8) | (item[2]! << 16) | (item[3]! << 24);
      if (storedLen > 60) {
        const root = hexOf(item.subarray(4, 36));
        tailEvidence.set(root, { stackIndex, itemIndex, expectedLength: storedLen });
      }
    }
  }
  const authenticationFor = (item: Uint8Array): AuthenticationEvidence | undefined => {
    const root = hexOf(digestOf(item));
    const evidence = tailEvidence.size > 0 ? tailEvidence.get(root) : digestEvidence.get(root);
    return evidence?.expectedLength !== undefined && evidence.expectedLength !== item.length
      ? undefined : evidence;
  };
  const considerCandidate = (
    item: Uint8Array,
    stack?: ReadonlyArray<Uint8Array>,
  ): { value: Uint8Array; lockingBytecode: Uint8Array } | undefined => {
    if (item.length <= 60 || item.length > maximumCandidateBytes) return undefined;
    if (minChunks > 0 && chunkCount(item) < minChunks) return undefined;
    const exactLock = exactPinLockFor(item);
    if (exactWrite && !exactLock) return undefined;
    if ((tailEvidence.size > 0 || digestEvidence.size > 0) && !authenticationFor(item)) {
      // Before a valueTail is pushed, the probe still exposes sha256(value) as a
      // bare 32-byte item. Reject planner/args blobs that do not authenticate.
      return undefined;
    }
    return { value: item, lockingBytecode: exactLock ?? lockFor(item, stack) };
  };
  // This value is bound to the exact graph occurrence and terminal mutation
  // ordinal, so it is post-state authority even when the VM still exposes only
  // that handler's authenticated pre-state tail.
  if (producerAuthenticatedValue && producerAuthenticatedValue.length > 60
    && producerAuthenticatedValue.length <= maximumCandidateBytes
    && (minChunks <= 0 || chunkCount(producerAuthenticatedValue) >= minChunks)) {
    const exactLock = exactPinLockFor(producerAuthenticatedValue);
    if (!exactWrite || exactLock) {
      return {
        value: producerAuthenticatedValue,
        lockingBytecode: exactLock ?? lockFor(producerAuthenticatedValue),
      };
    }
  }
  // Trace roots are mutation-epoch evidence, so preserve their latest observed
  // position rather than collapsing them into an unordered membership set.
  let authenticated: {
    selected: { value: Uint8Array; lockingBytecode: Uint8Array };
    evidence: AuthenticationEvidence;
  } | undefined;
  const considerAuthenticated = (item: Uint8Array, stack?: ReadonlyArray<Uint8Array>): void => {
    const selected = considerCandidate(item, stack);
    const evidence = selected && authenticationFor(item);
    if (!selected || !evidence) return;
    if (!authenticated || evidence.stackIndex > authenticated.evidence.stackIndex
      || (evidence.stackIndex === authenticated.evidence.stackIndex
        && evidence.itemIndex > authenticated.evidence.itemIndex)) {
      authenticated = { selected, evidence };
    }
  };
  candidateValues.forEach((candidate) => considerAuthenticated(candidate));
  for (const stack of stacks) {
    const seen = new Set<Uint8Array>();
    for (const item of stack) {
      if (seen.has(item)) continue;
      seen.add(item);
      considerAuthenticated(item, stack);
    }
  }
  if (authenticated) return authenticated.selected;
  if ((tailEvidence.size > 0 || digestEvidence.size > 0) && !allowUnauthenticatedFallback) {
    return undefined;
  }
  if (tailEvidence.size === 0 && digestEvidence.size === 0 && !allowUnauthenticatedFallback) {
    return undefined;
  }
  // Descriptor-free compatibility gives explicit candidates precedence when no
  // authenticator is available.
  for (const candidate of candidateValues) {
    const matched = considerCandidate(candidate);
    if (matched) return matched;
  }
  let best: { value: Uint8Array; lockingBytecode: Uint8Array } | undefined;
  // The pin address is p2sh32(redeem(root)), not aa20||sha256(v)||87, so the
  // digest path above often misses. A dummy sixth slot means the covenant
  // already computed nNew>=6: take the longest blob that splits that wide,
  // even if its root is no longer sitting next to it.
  if (allowUnauthenticatedFallback
    && minChunks > 0 && (!best || chunkCount(best.value) < minChunks)) {
    let widest: Uint8Array | undefined;
    for (const stack of stacks) {
      for (const item of stack) {
        if (item.length <= 60 || item.length > maximumCandidateBytes) continue;
        if (chunkCount(item) < minChunks) continue;
        if (!widest || item.length > widest.length) widest = item;
      }
    }
    if (widest) best = { value: widest, lockingBytecode: lockFor(widest) };
  }
  return best;
}

/**
 * Kernel `emitSortedValueChunkPin` discovers chunks by locking-bytecode identity, then
 * EQUALVERIFYs `matches == expected nNew`. Missing outputs never take the positional
 * OUTPUTBYTECODE EQUALVERIFY path, so the planner must recover the redeem lock and
 * expected width from that count mismatch.
 */
export function extractIdentityScanValueChunkPin(
  trace: ReadonlyArray<{
    ip: number;
    instructions: ReadonlyArray<{ opcode: number }>;
    stack: readonly Uint8Array[];
  }>,
): { lockingBytecode: Uint8Array; nNew: number } | undefined {
  const vmCount = (bytes: Uint8Array): number | undefined => {
    if (bytes.length === 0) return 0;
    if (bytes.length === 1 && bytes[0] > 0 && bytes[0] <= 32) return bytes[0];
    return undefined;
  };
  for (let index = trace.length - 1; index >= 0; index -= 1) {
    const state = trace[index];
    const opcode = state.instructions[state.ip]?.opcode;
    const atCountPin = opcode === Op.OP_EQUALVERIFY
      && state.instructions[state.ip - 1]?.opcode === Op.OP_DROP
      && state.instructions[state.ip + 1]?.opcode === Op.OP_2DROP;
    const afterCountPin = opcode === Op.OP_2DROP
      && state.instructions[state.ip - 1]?.opcode === Op.OP_EQUALVERIFY
      && state.instructions[state.ip - 2]?.opcode === Op.OP_DROP;
    if (!atCountPin && !afterCountPin) continue;
    if (state.stack.length < 2) continue;
    const actual = vmCount(state.stack[state.stack.length - 1]);
    const expected = vmCount(state.stack[state.stack.length - 2]);
    if (actual === undefined || expected === undefined || expected <= actual) continue;
    const lock = [...state.stack].reverse().find((item) => isP2sh32LockScript(item));
    if (!lock || !state.stack.some((item) => item.length > 60)) continue;
    return { lockingBytecode: lock, nNew: expected };
  }
  return undefined;
}

/**
 * Split a value into continuation NFTs only when the caller supplies an authenticated locking identity.
 * A compiler descriptor may derive that identity; missing or inconsistent authority fails closed.
 */
export function chunksFromValue(
  value: Uint8Array,
  authority: {
    lockingBytecode?: Uint8Array;
    write?: ValueChunkWriteDescriptor | null;
    categoryId?: string;
  },
): AuthenticatedValueChunk[] {
  if (value.length <= VALUE_HEAD_SIZE) return [];
  const categoryId = authority.categoryId ?? authority.write?.categoryId;
  const lock = authority.lockingBytecode
    ?? persistValueChunkLock(categoryId, value, authority.write);
  if (!lock) return [];
  return splitValueIntoValueChunks(value).map((data, index) => ({
    commitment: buildValueChunkCommitment(index, data),
    lockingBytecode: lock,
    categoryId,
  })).filter((chunk) => chunk.commitment.length >= 3 && chunk.commitment !== '00'
    && !(chunk.commitment.length >= 16 && isEmptyValueChunkCommitment(chunk.commitment)));
}

/** Explicit compatibility adapter for the historical descriptor-free JobEvent collection. */
export function chunksFromJobEventsValue(
  value: Uint8Array,
  lockingBytecode?: Uint8Array,
  categoryId?: string,
): AuthenticatedValueChunk[] {
  if (value.length <= VALUE_HEAD_SIZE) return [];
  const lock = lockingBytecode
    ?? legacyJobEventsPersistValueChunkLock(categoryId, value)
    ?? (categoryId ? persistedCompatibilityValueChunkLock(categoryId) : undefined)
    ?? p2sh32LockFromValueRoot(sha256Sync(value));
  return chunksFromValue(value, { lockingBytecode: lock, categoryId });
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
