import {
  encodePushdataValue,
  KERNEL_ENTRY_JOURNAL_MAX_RECORDS,
  KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX,
  KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT,
  MAX_MESSAGE_BUS_BLOB_BYTES,
  type Artifact,
  type JournalSettlementIdentityAbi,
  type KernelEntryJournalCapabilityScopeAbi,
  type KernelJournalDispositionHandlerScopeAbi,
  type KernelJournalDispositionStreamAbi,
  type KernelJournalDispositionsAbi,
  kernelJournalDispositionCommitmentMarker,
  hasUniqueKernelJournalDispositionCommitment,
  kernelJournalDispositionManifestDigest,
} from '@solidcash/utils';
export {
  KERNEL_ENTRY_JOURNAL_MAX_RECORDS,
  KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS,
  KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX,
  KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT,
} from '@solidcash/utils';
import {
  SortedList,
  decodeEntryCommitment,
  type JournaledMutationAccess,
  type JournaledMutationPlan,
  type JournaledMutationRecord,
  type JournaledMutationResult,
  type JournaledUpsert,
} from './SortedList.js';

/** Canonical record tag, distinct from runtime event/BCH/FT/NFT effect tags 0x01..0x04. */
export const KERNEL_ENTRY_JOURNAL_TAG = 0x05;

/** Compact per-stream record-selection program consumed by a kernel row. */
export const KERNEL_ENTRY_JOURNAL_ACCESS_TAG = 0x06;

/** Entry NFT commitments are capped at 128 bytes: slot + next slot + at most 64 bytes of value tail. */
export const KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES = 64;

/** Return the stable compiler-owned input name for one zero-based journal record segment. */
export function kernelEntryJournalRecordSegmentName(segmentIndex: number): string {
  if (!Number.isSafeInteger(segmentIndex) || segmentIndex < 0) {
    throw new Error('kernel entry journal segment index must be a non-negative safe integer');
  }
  return `${KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX}${segmentIndex}`;
}

/** Parse a canonical compiler-owned segment input name, rejecting aliases such as `_00`. */
export function kernelEntryJournalRecordSegmentIndex(name: string): number | undefined {
  if (!name.startsWith(KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX)) return undefined;
  const suffix = name.slice(KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX.length);
  if (!/^(0|[1-9][0-9]*)$/.test(suffix)) {
    throw new Error(`kernel entry journal segment input '${name}' has a non-canonical index`);
  }
  const segmentIndex = Number(suffix);
  if (!Number.isSafeInteger(segmentIndex)) {
    throw new Error(`kernel entry journal segment input '${name}' exceeds the safe index range`);
  }
  return segmentIndex;
}

const COLLECTION_HASH_BYTES = 20;
const SLOT_BYTES = 32;
const HEADER_BYTES = 2 + COLLECTION_HASH_BYTES + SLOT_BYTES * 2;
const FLAG_AUTHENTICATED = 1 << 0;
const FLAG_DIRTY = 1 << 1;
const FLAG_TOMBSTONE = 1 << 2;
const FLAG_SYNTHETIC = 1 << 3;
const KNOWN_FLAGS = FLAG_AUTHENTICATED | FLAG_DIRTY | FLAG_TOMBSTONE | FLAG_SYNTHETIC;

const ACCESS_HEADER_BYTES = 2 + COLLECTION_HASH_BYTES;
const ACCESS_BYTES = 5;
const ACCESS_FLAG_PRESENT_BEFORE = 1 << 0;
const ACCESS_FLAG_PRESENT_AFTER = 1 << 1;
const ACCESS_FLAG_HAS_PREDECESSOR = 1 << 2;
const ACCESS_FLAG_MUTATES = 1 << 3;
const ACCESS_FLAG_AUTHENTICATES_TARGET = 1 << 4;
const ACCESS_FLAG_AUTHENTICATES_PREDECESSOR = 1 << 5;
/** The access participates in a transaction-local dependency and must publish/consume a dirty carrier. */
const ACCESS_FLAG_PENDING = 1 << 6;
const KNOWN_ACCESS_FLAGS = ACCESS_FLAG_PRESENT_BEFORE
  | ACCESS_FLAG_PRESENT_AFTER | ACCESS_FLAG_HAS_PREDECESSOR | ACCESS_FLAG_MUTATES
  | ACCESS_FLAG_AUTHENTICATES_TARGET | ACCESS_FLAG_AUTHENTICATES_PREDECESSOR | ACCESS_FLAG_PENDING;
const NO_PREDECESSOR = 0xffff;
/** `tag || count || N * (flags || target-u16le || predecessor-u16le)` must remain one BCH item. */
export const KERNEL_ENTRY_JOURNAL_MAX_ACCESSES = Math.floor((520 - ACCESS_HEADER_BYTES) / ACCESS_BYTES);

/**
 * Explicit protocol-wide transport/indexing ceiling across all access streams. It is aligned as a deliberate v1
 * budget with the reviewed one-stream access ceiling so permissive compiler profiles cannot create unbounded
 * hidden ABIs; several streams may collectively request more records, in which case admission fails closed at
 * this global cap. Finalized transactions remain subject to independent BCH size and cost checks.
 */
if (KERNEL_ENTRY_JOURNAL_MAX_RECORDS !== KERNEL_ENTRY_JOURNAL_MAX_ACCESSES) {
  throw new Error('kernel entry journal record and compact-access protocol caps diverged');
}

export interface KernelEntryJournalRecord {
  /** Hash of the collection signature; combined with the owner category to derive its entry covenant address. */
  collectionHash: Uint8Array;
  slot: Uint8Array;
  nextKey: Uint8Array;
  value: Uint8Array;
  /** This node was authenticated from one unique physical pre-state input. */
  authenticated: boolean;
  /** The final flush must recreate this node unless it is a tombstone. */
  dirty: boolean;
  /** The logical node has been removed; its predecessor carries the final successor link. */
  tombstone: boolean;
  /** The node was introduced by this journal and has no physical pre-state input. */
  synthetic: boolean;
}

export interface KernelEntryJournalStreamPlan {
  /** One collection-wide plan, preserving pending values and topology across row/loop stream boundaries. */
  mutationPlan: JournaledMutationPlan;
  /** Independently bounded record carriers, shared by every access stream in this collection plan. */
  encodedRecords: Uint8Array[];
  /** One compact access program for each source stream, in the same order as the input stream vector. */
  encodedAccessStreams: Uint8Array[];
}

export type KernelEntryJournalAccess = JournaledMutationAccess & {
  /** This access or an earlier producer it depends on must use the route-final carrier settlement protocol. */
  pending?: true;
};

/**
 * Value-independent operation classes used while assigning stable access ordinals. A SolidCash mapping `delete`
 * is a default-value write and therefore uses `write`; `remove` is reserved for an actual linked-list splice.
 */
export type KernelEntryJournalTopologyOperation = 'read' | 'write' | 'remove';

export interface KernelEntryJournalAccessTopologyPlan {
  /** Number of first-touch records addressed by every stream in this plan. */
  recordCount: number;
  /**
   * Truthful topology-phase carriers in the same first-touch ordinal space as the access programs. Existing
   * records are exactly clean+authenticated; absent records are exactly clean+synthetic+tombstone with no value
   * or successor. Dirty carrier forms are reserved for a future covenant-verified final-flush phase.
   */
  encodedRecords: Uint8Array[];
  /** One compact access program for each source stream. */
  encodedAccessStreams: Uint8Array[];
}

export interface KernelEntryJournalSettlementOccurrence {
  /** Selected invocation/frame owning the compiler-local stream index. */
  frameIndex: number;
  /** Compiler-published identity recipe for the containing compact access stream. */
  identity: JournalSettlementIdentityAbi;
  /** Zero-based position in that stream's compact access program. */
  accessOrdinal: number;
  /** Runtime access after collection-local ordinals have been remapped into the transaction-wide carrier space. */
  access: KernelEntryJournalAccess;
}

/**
 * Compiler-owned coordinates for one compact journal stream.
 *
 * `frameIndex` orders selected invocations, `executionGroup` orders distinct source control-flow regions within
 * that invocation, and `executionOrder` orders access sites which execute at the same source occurrence. The SDK
 * supplies only the runtime occurrence coordinates selected by the compiler-published flow recipe; array/map
 * insertion order is never part of this protocol.
 */
export interface KernelEntryJournalExecutionStream {
  frameIndex: number;
  executionGroup: number;
  executionOrder: number;
  accessStreamIndex: number;
  sourceOccurrences?: readonly number[];
}

export interface KernelEntryJournalScheduledOccurrence<T, S extends KernelEntryJournalExecutionStream> {
  stream: S;
  value: T;
  compactIndex: number;
  sourceOccurrence: number;
}

/**
 * Reconstruct the route's semantic journal execution order from compiler-owned coordinates.
 *
 * Streams in one source loop are interleaved by occurrence (`A0, B0, A1, B1`), while later execution groups and
 * later selected frames remain outside that interleave. Rejecting duplicate stream/site coordinates is important:
 * otherwise two artifact streams can describe different physical-input schedules while sorting identically.
 */
export function scheduleKernelEntryJournalOccurrences<
T,
S extends KernelEntryJournalExecutionStream,
>(
  streams: readonly S[],
  values: (stream: S) => readonly T[],
): Array<KernelEntryJournalScheduledOccurrence<T, S>> {
  const streamCoordinates = new Set<string>();
  const siteCoordinates = new Set<string>();
  const scheduled: Array<KernelEntryJournalScheduledOccurrence<T, S>> = [];
  for (const stream of streams) {
    for (const [label, coordinate] of [
      ['frame index', stream.frameIndex],
      ['execution group', stream.executionGroup],
      ['execution order', stream.executionOrder],
      ['access stream index', stream.accessStreamIndex],
    ] as const) {
      if (!Number.isSafeInteger(coordinate) || coordinate < 0) {
        throw new Error(`kernel journal ${label} must be a non-negative safe integer`);
      }
    }
    const streamCoordinate = `${stream.frameIndex}:${stream.accessStreamIndex}`;
    if (streamCoordinates.has(streamCoordinate)) {
      throw new Error(`kernel journal repeats access stream coordinate ${streamCoordinate}`);
    }
    streamCoordinates.add(streamCoordinate);
    const siteCoordinate = `${stream.frameIndex}:${stream.executionGroup}:${stream.executionOrder}`;
    if (siteCoordinates.has(siteCoordinate)) {
      throw new Error(`kernel journal repeats execution site coordinate ${siteCoordinate}`);
    }
    siteCoordinates.add(siteCoordinate);

    const streamValues = values(stream);
    if (stream.sourceOccurrences && stream.sourceOccurrences.length !== streamValues.length) {
      throw new Error(
        `kernel journal access stream ${stream.accessStreamIndex} has ${streamValues.length} accesses but `
        + `${stream.sourceOccurrences.length} source occurrences`,
      );
    }
    let priorSourceOccurrence = -1;
    streamValues.forEach((value, compactIndex) => {
      const sourceOccurrence = stream.sourceOccurrences?.[compactIndex] ?? compactIndex;
      if (!Number.isSafeInteger(sourceOccurrence) || sourceOccurrence < 0) {
        throw new Error('kernel journal source occurrence must be a non-negative safe integer');
      }
      if (sourceOccurrence <= priorSourceOccurrence) {
        throw new Error(
          `kernel journal access stream ${stream.accessStreamIndex} source occurrences are not strictly ordered`,
        );
      }
      priorSourceOccurrence = sourceOccurrence;
      scheduled.push({ stream, value, compactIndex, sourceOccurrence });
    });
  }
  return scheduled.sort((left, right) => left.stream.frameIndex - right.stream.frameIndex
    || left.stream.executionGroup - right.stream.executionGroup
    || left.sourceOccurrence - right.sourceOccurrence
    || left.stream.executionOrder - right.stream.executionOrder
    || left.compactIndex - right.compactIndex);
}

export interface KernelEntryJournalSettlementStream {
  /** Compiler-published control-flow group, already scoped to the selected invocation frame. */
  executionGroup: string;
  /** Whether this stream contains at least one operation capable of mutating the journal. */
  mutates: boolean;
  /** Stable compiler-published settlement recipe, when emitted by the artifact version. */
  identity?: JournalSettlementIdentityAbi;
}

/**
 * Enforce the compatibility boundary for transaction-wide record ordinals. Legacy artifacts remain valid for a
 * singleton mutation stream, where collection-local and global record identity cannot be confused. Once multiple
 * mutation streams share an execution group, every stream in that group must explicitly authenticate the global
 * journal ordinal domain used by scheduling and last-mutating settlement ownership.
 */
export function validateKernelEntryJournalSettlementGroups(
  streams: readonly KernelEntryJournalSettlementStream[],
): void {
  const groups = new Map<string, KernelEntryJournalSettlementStream[]>();
  for (const stream of streams) {
    const group = groups.get(stream.executionGroup) ?? [];
    group.push(stream);
    groups.set(stream.executionGroup, group);
  }
  for (const [executionGroup, group] of groups) {
    if (group.filter((stream) => stream.mutates).length < 2) continue;
    if (group.some((stream) => stream.identity?.recordOrdinalScope !== 'global-journal')) {
      throw new Error(
        `kernel journal execution group '${executionGroup}' has multiple mutation streams without authenticated `
        + 'global record ordinals',
      );
    }
  }
}

export interface KernelEntryJournalSettlementReference {
  frameIndex: number;
  accessStreamIndex: number;
  accessOrdinal: number;
  recordOrdinal: number;
  recordRole: 'target' | 'predecessor';
  settlementRole: JournalSettlementIdentityAbi['settlementRole'];
  /** Final logical disposition; absence has settlement authority but deliberately no physical NFT output. */
  settlementDisposition: 'present-output' | 'absence';
}

export interface KernelEntryJournalSettlementPlan {
  /** Every authenticated record reference, in caller-supplied execution order. */
  references: KernelEntryJournalSettlementReference[];
  /** Unique final settlement authority per mutated runtime record ordinal. */
  settlementAuthorities: ReadonlyMap<number, KernelEntryJournalSettlementReference>;
  /** Final logical disposition and provenance for every referenced record, including clean carriers. */
  recordDispositions: ReadonlyMap<number, {
    reference: KernelEntryJournalSettlementReference;
    basis: 'mutation-settlement' | 'authenticated-carrier' | 'origin-carrier';
  }>;
}

/**
 * Compiler capability required before the SDK may omit a later physical read input. The route must itself produce
 * and consume the internal clean-read marker; this value is deliberately not inferred from ordinary access flags.
 */
export interface KernelEntryJournalReadCarrierCapability {
  kind: 'internal-read-carrier';
  version: 1;
  /** Explicitly bounded route streams. Missing scopes are never interpreted as a wildcard. */
  scopes?: readonly KernelEntryJournalCapabilityScopeAbi[];
}

const isKernelEntryJournalReadCarrierScope = (
  scope: KernelEntryJournalCapabilityScopeAbi,
): boolean => /^[0-9a-f]{8}$/.test(scope.handlerSelector)
  && Number.isSafeInteger(scope.journalAccessStreamIndex)
  && scope.journalAccessStreamIndex >= 0;

const hasCanonicalKernelEntryJournalReadCarrierScopes = (
  scopes: readonly KernelEntryJournalCapabilityScopeAbi[] | undefined,
): scopes is readonly KernelEntryJournalCapabilityScopeAbi[] => {
  if (!scopes || scopes.length === 0 || !scopes.every(isKernelEntryJournalReadCarrierScope)) return false;
  return new Set(scopes.map((scope) => `${scope.handlerSelector}:${scope.journalAccessStreamIndex}`)).size
    === scopes.length;
};

/**
 * Whether an explicitly published capability covers this handler's compact journal stream.
 *
 * A capability is deliberately not artifact-global. In particular, missing or malformed
 * scopes fail closed, so an eventual carrier release cannot defer a dirty/unrelated handler
 * merely because another handler in the same route has a clean-read carrier.
 */
export function kernelEntryJournalReadCarrierCapabilityCovers(
  capability: KernelEntryJournalReadCarrierCapability | undefined,
  handlerSelector: string | undefined,
  journalAccessStreamIndex: number,
): boolean {
  if (capability?.kind !== 'internal-read-carrier' || capability.version !== 1
    || !handlerSelector || !/^[0-9a-f]{8}$/.test(handlerSelector)
    || !Number.isSafeInteger(journalAccessStreamIndex) || journalAccessStreamIndex < 0
    || !hasCanonicalKernelEntryJournalReadCarrierScopes(capability.scopes)) return false;
  return capability.scopes.some((scope) =>
    scope.handlerSelector === handlerSelector
    && scope.journalAccessStreamIndex === journalAccessStreamIndex) === true;
}

/**
 * Read the compiler's route-local clean-read carrier capability without inferring it from a kernel compilation.
 *
 * `messageBusKernel` is a code-generation preference, while this capability changes physical input/output
 * ownership. The SDK must therefore require an executable in-bytecode kernel route and an exact, versioned
 * compiler claim before it can turn a later read into a zero-input consumer. Older artifacts and legacy routes
 * deliberately return `undefined` here.
 */
export function kernelEntryJournalReadCarrierCapabilityFromArtifact(
  artifact: Pick<Artifact, 'messageBus'>,
): KernelEntryJournalReadCarrierCapability | undefined {
  const route = artifact.messageBus;
  if (route?.convention !== 'kernel-row-loop' || route.available !== true || route.routeInBytecode !== true
    || route.kernelEntryJournal?.version !== 1
    || !route.atomicMessageBus?.protocolVersions?.includes(2)) return undefined;
  const declarations = route.kernelEntryJournal.capabilities?.filter((candidate) =>
    candidate.kind === 'internal-read-carrier') ?? [];
  if (declarations.length !== 1) return undefined;
  const [capability] = declarations;
  if (capability?.version !== 1 || !hasCanonicalKernelEntryJournalReadCarrierScopes(capability.scopes)) {
    return undefined;
  }
  return {
    kind: 'internal-read-carrier', version: 1,
    scopes: capability.scopes,
  };
}

const hasExactKeys = (value: object, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

/**
 * Validate the compiler's complete, ordered journal-disposition projection.
 *
 * This metadata is not authority by itself. The returned manifest is available only beside the released carrier
 * capability on an executable kernel route; the caller must additionally bind that artifact to its locally
 * authenticated batch envelope before changing physical ownership.
 */
export function kernelJournalDispositionsFromArtifact(
  artifact: Pick<Artifact, 'abi' | 'bytecode' | 'messageBus'>,
): KernelJournalDispositionsAbi | undefined {
  const route = artifact.messageBus;
  const declaration = route?.kernelEntryJournal?.kernelJournalDispositions;
  if (declaration === undefined) return undefined;
  const capability = kernelEntryJournalReadCarrierCapabilityFromArtifact(artifact);
  if (!capability) return undefined;
  if (!declaration || typeof declaration !== 'object'
    || !hasExactKeys(declaration, ['version', 'handlers']) || declaration.version !== 1
    || !Array.isArray(declaration.handlers)) {
    throw new Error('kernel journal disposition manifest has a non-canonical envelope');
  }
  const eligibleHandlers = route!.handlers.filter((handler) => handler.eligible);
  if (declaration.handlers.length !== eligibleHandlers.length) {
    throw new Error('kernel journal disposition manifest does not cover every eligible handler exactly once');
  }
  const carrierScopes: string[] = [];
  const handlers = declaration.handlers.map((
    scope: KernelJournalDispositionHandlerScopeAbi, handlerIndex: number,
  ): KernelJournalDispositionHandlerScopeAbi => {
    if (!scope || typeof scope !== 'object'
      || !hasExactKeys(scope, ['selectorHex', 'completedDescriptorDigest', 'mode', 'streams'])
      || !/^[0-9a-f]{8}$/.test(scope.selectorHex)
      || !/^[0-9a-f]{64}$/.test(scope.completedDescriptorDigest)
      || !['carrier', 'eager-journal', 'neutral'].includes(scope.mode)
      || !Array.isArray(scope.streams)) {
      throw new Error(`kernel journal disposition handler ${handlerIndex} is non-canonical`);
    }
    const publishedHandler = eligibleHandlers[handlerIndex];
    const abiHandler = artifact.abi.find((handler) => handler.selector === scope.selectorHex);
    if (publishedHandler?.selector !== scope.selectorHex || !abiHandler) {
      throw new Error(`kernel journal disposition handler ${handlerIndex} is not the ordered eligible handler`);
    }
    const expectedOrdinals = (abiHandler.sortedUpsertLoopInfo ?? [])
      .map((info) => info.journalAccessStreamIndex);
    if (scope.streams.length !== expectedOrdinals.length) {
      throw new Error(`kernel journal disposition handler ${scope.selectorHex} has incomplete stream coverage`);
    }
    const streams = scope.streams.map((stream: KernelJournalDispositionStreamAbi, streamIndex: number) => {
      if (!stream || typeof stream !== 'object'
        || !hasExactKeys(stream, ['journalAccessStreamIndex', 'descriptorDigest', 'disposition'])
        || !Number.isSafeInteger(stream.journalAccessStreamIndex)
        || stream.journalAccessStreamIndex !== expectedOrdinals[streamIndex]
        || !/^[0-9a-f]{64}$/.test(stream.descriptorDigest)
        || stream.disposition !== scope.mode
        || stream.disposition === 'neutral') {
        throw new Error(`kernel journal disposition handler ${scope.selectorHex} has a non-canonical stream`);
      }
      if (stream.disposition === 'carrier') {
        carrierScopes.push(`${scope.selectorHex}:${stream.journalAccessStreamIndex}`);
      }
      return Object.freeze({ ...stream });
    });
    if ((scope.mode === 'neutral') !== (streams.length === 0)) {
      throw new Error(`kernel journal disposition handler ${scope.selectorHex} has an incoherent mode`);
    }
    return Object.freeze({ ...scope, streams: Object.freeze(streams) });
  });
  if (new Set(handlers.map((scope) => scope.selectorHex)).size !== handlers.length) {
    throw new Error('kernel journal disposition manifest repeats a handler selector');
  }
  const publishedCarrierScopes = capability.scopes!.map((scope) => (
    `${scope.handlerSelector}:${scope.journalAccessStreamIndex}`
  ));
  if (carrierScopes.length !== publishedCarrierScopes.length
    || carrierScopes.some((scope, index) => scope !== publishedCarrierScopes[index])) {
    throw new Error('kernel journal disposition manifest disagrees with carrier capability scopes');
  }
  const manifest = Object.freeze({ version: 1, handlers: Object.freeze(handlers) }) as KernelJournalDispositionsAbi;
  const commitment = route!.kernelEntryJournal!.kernelJournalDispositionCommitment;
  const digest = kernelJournalDispositionManifestDigest(manifest);
  const marker = kernelJournalDispositionCommitmentMarker(digest);
  if (!commitment || typeof commitment !== 'object'
    || !hasExactKeys(commitment, ['version', 'digest'])
    || commitment.version !== 1 || commitment.digest !== digest || marker === undefined) {
    throw new Error('kernel journal disposition manifest has no exact compiler commitment');
  }
  if (!hasUniqueKernelJournalDispositionCommitment(artifact.bytecode, digest)) {
    throw new Error('kernel journal disposition manifest is not uniquely committed by route bytecode');
  }
  return manifest;
}

/** One source-ordered read access after collection-local ordinals have become route-global ordinals. */
export interface KernelEntryJournalReadCarrierOccurrence {
  frameIndex: number;
  accessStreamIndex: number;
  accessOrdinal: number;
  access: KernelEntryJournalAccess;
}

/** The one physical input and final output owned by a global journal record. */
export interface KernelEntryJournalReadCarrierMaterialization {
  recordOrdinal: number;
  /**
   * The proof role used by the first physical authentication. Later accesses may
   * refer to the same physical record as the other role (a target can later be
   * a predecessor); ownership nevertheless remains per record ordinal.
   */
  recordRole: 'target' | 'predecessor';
  firstAuthenticator: KernelEntryJournalReadCarrierOccurrence;
  /** A present target and every predecessor are recreated once by the final flush. */
  finalOutput: boolean;
}

/** One source occurrence after logical carrier ownership has been resolved. */
export interface KernelEntryJournalReadCarrierPhysicalOccurrence {
  occurrence: KernelEntryJournalReadCarrierOccurrence;
  /** The global record selected by this read (target when present, predecessor when absent). */
  recordOrdinal: number;
  recordRole: 'target' | 'predecessor';
  /** True only at the unique source occurrence which co-spends the entry NFT. */
  materializesInput: boolean;
}

/** One dense final-flush output. Its order is global-record order, never source-stream order. */
export interface KernelEntryJournalReadCarrierPhysicalOutput {
  recordOrdinal: number;
  outputOrdinal: number;
}

/**
 * Accounting owned by a source stream. `outputCount` identifies output ownership only; callers must use
 * `outputs` for physical output order because the route flushes those in dense global-record order.
 */
export interface KernelEntryJournalReadCarrierStreamAccounting {
  frameIndex: number;
  accessStreamIndex: number;
  inputCount: number;
  outputCount: number;
}

/**
 * Pure boundary between logical journal topology and physical transaction construction for clean read carriers.
 * It intentionally carries no UTXO, commitment, collection name, or source identifier: those are resolved by the
 * caller only after this plan establishes authenticated global-record ownership.
 */
export interface KernelEntryJournalReadCarrierPhysicalPlan {
  occurrences: KernelEntryJournalReadCarrierPhysicalOccurrence[];
  inputs: KernelEntryJournalReadCarrierMaterialization[];
  outputs: KernelEntryJournalReadCarrierPhysicalOutput[];
  streamAccounting: KernelEntryJournalReadCarrierStreamAccounting[];
}

/** A source access after the physical carrier planner has removed any duplicate clean-read authentication. */
export interface KernelEntryJournalPhysicalSettlementOccurrence {
  /** The compiler-authenticated source coordinate. This order is also the carrier producer order. */
  occurrence: KernelEntryJournalSettlementOccurrence;
  /**
   * The compact access program the SDK must publish. This is equal to `occurrence.access` except that a later
   * clean reader of an already-owned physical record has its relevant authentication bit cleared.
   */
  access: KernelEntryJournalAccess;
  /** The source occurrence is the unique physical input owner for at least one record. */
  materializesInput: boolean;
  /** At least one access authentication bit was cleared for an internal clean-carrier consumer. */
  rewritesToZeroAuthConsumer: boolean;
}

/** One physical pre-state entry, ordered by its first source authentication rather than record ordinal. */
export interface KernelEntryJournalPhysicalSettlementInput {
  recordOrdinal: number;
  recordRole: 'target' | 'predecessor';
  firstOwner: KernelEntryJournalSettlementReference;
}

/** One dense final entry output, ordered by the authenticated global record ordinal. */
export interface KernelEntryJournalPhysicalSettlementOutput {
  recordOrdinal: number;
  outputOrdinal: number;
  finalOwner: KernelEntryJournalSettlementReference;
}

/** Per compact stream cardinalities after physical input ownership and final output authority are separated. */
export interface KernelEntryJournalPhysicalSettlementStreamAccounting {
  frameIndex: number;
  accessStreamIndex: number;
  inputCount: number;
  outputCount: number;
}

/**
 * Pure, inactive reconciliation of source-order physical inputs with global-order final settlement outputs.
 *
 * This planner deliberately does not inspect an artifact capability and does not construct any UTXOs. It gives
 * the eventual runtime activation one auditable authority for four facts which must otherwise never be inferred
 * independently: first physical authentication, zero-auth clean consumers, final record disposition, and dense
 * output rank. In particular, publishing this plan alone never authorizes the SDK to omit an input.
 */
export interface KernelEntryJournalPhysicalSettlementPlan {
  occurrences: KernelEntryJournalPhysicalSettlementOccurrence[];
  /** First physical owners in source execution order. */
  inputs: KernelEntryJournalPhysicalSettlementInput[];
  /** Final present records in dense global-record order. */
  outputs: KernelEntryJournalPhysicalSettlementOutput[];
  streamAccounting: KernelEntryJournalPhysicalSettlementStreamAccounting[];
  /**
   * The one global final-flush cursor delta. It intentionally equals `outputs.length`, rather than the sum of
   * any caller-maintained collection bands: an eventual activation must advance its physical output cursor once
   * after the dense flush and must not also add per-stream output counts.
   */
  finalOutputCursorDelta: number;
  /** The normalized settlement authority consumed to derive `outputs`. */
  settlement: KernelEntryJournalSettlementPlan;
}

/**
 * A value body produced by the final mutating authority for one dirty record.
 *
 * The producer coordinate names one compiler-authenticated access and record role. The resolver obtains its
 * global record ordinal from the settlement plan rather than reconstructing identity from a collection name,
 * source handler, or best-effort slot search. The body is the complete entry-NFT commitment
 * (`slot || nextKey || value`), not merely a value tail, so the final link and value travel together.
 */
export type KernelEntryJournalDirtyFinalBodyProducer = Pick<
KernelEntryJournalSettlementReference,
'frameIndex' | 'accessStreamIndex' | 'accessOrdinal' | 'recordRole'
>;

export interface KernelEntryJournalDirtyFinalBodyCandidate {
  /**
   * Stable compiler/runtime access identity which produced this complete body. The global record ordinal is
   * deliberately absent: the authenticated settlement plan, not the materializer, resolves this producer to a
   * record. This prevents a slot or collection scan from relabelling a provisional body as a final result.
   */
  producer: KernelEntryJournalDirtyFinalBodyProducer;
  commitment: Uint8Array;
}

/** A uniquely resolved dirty body, retained in dense final-output order. */
export interface KernelEntryJournalDirtyFinalBodyResolution {
  recordOrdinal: number;
  outputOrdinal: number;
  commitment: Uint8Array;
}

type KernelEntryJournalReadCarrierReference = {
  occurrence: KernelEntryJournalReadCarrierOccurrence;
  recordOrdinal: number;
  recordRole: 'target' | 'predecessor';
  authenticates: boolean;
  finalOutput: boolean;
};

function readCarrierReferences(
  occurrence: KernelEntryJournalReadCarrierOccurrence,
): KernelEntryJournalReadCarrierReference[] {
  const { access } = occurrence;
  if (!Number.isSafeInteger(occurrence.frameIndex) || occurrence.frameIndex < 0
    || !Number.isSafeInteger(occurrence.accessStreamIndex) || occurrence.accessStreamIndex < 0
    || !Number.isSafeInteger(occurrence.accessOrdinal) || occurrence.accessOrdinal < 0
    || access.mutates || access.pending || access.presentBefore !== access.presentAfter) {
    throw new Error('kernel read-carrier materialization accepts only ordered clean read accesses');
  }
  const references: KernelEntryJournalReadCarrierReference[] = [];
  // An absent target is the synthetic 0x0c record. It never owns a physical
  // carrier: the authenticated predecessor is the marker-bearing record.
  if (access.presentBefore || access.presentAfter) {
    requireRecordOrdinal('targetRecordOrdinal', access.targetRecordOrdinal);
    references.push({
      occurrence, recordOrdinal: access.targetRecordOrdinal, recordRole: 'target',
      authenticates: access.authenticatesTarget === true,
      finalOutput: access.presentAfter,
    });
  }
  if (access.predecessorRecordOrdinal !== undefined) {
    requireRecordOrdinal('predecessorRecordOrdinal', access.predecessorRecordOrdinal);
    references.push({
      occurrence, recordOrdinal: access.predecessorRecordOrdinal, recordRole: 'predecessor',
      authenticates: access.authenticatesPredecessor === true,
      finalOutput: true,
    });
  }
  return references;
}

/**
 * Plan physical ownership for repeated, read-only accesses after global topology is known.
 *
 * The prepass is intentionally dormant until GTT publishes `internal-read-carrier` capability and the route
 * recognizes its internally-produced marker. Without that capability, a later zero-auth access would otherwise
 * silently omit a pre-state UTXO under bytecode that still expects it. The key is the global record ordinal, not
 * collection-local offset, proof role, source names, or caller witness data. A physical record may legitimately
 * occur first as a target and later as a predecessor.
 */
export function planKernelEntryJournalReadCarrierMaterialization(
  capability: KernelEntryJournalReadCarrierCapability | undefined,
  occurrences: readonly KernelEntryJournalReadCarrierOccurrence[],
): KernelEntryJournalReadCarrierMaterialization[] {
  if (capability?.kind !== 'internal-read-carrier' || capability.version !== 1) {
    throw new Error('kernel read-carrier materialization requires compiler internal-read-carrier capability');
  }
  const references = occurrences.flatMap(readCarrierReferences);
  const byRecord = new Map<number, KernelEntryJournalReadCarrierReference[]>();
  for (const reference of references) {
    const group = byRecord.get(reference.recordOrdinal) ?? [];
    group.push(reference);
    byRecord.set(reference.recordOrdinal, group);
  }
  const materializations: KernelEntryJournalReadCarrierMaterialization[] = [];
  for (const group of byRecord.values()) {
    const authenticators = group.filter((reference) => reference.authenticates);
    if (authenticators.length !== 1) {
      throw new Error('kernel read-carrier record requires exactly one first authenticator');
    }
    const firstAuthenticator = authenticators[0]!;
    if (group[0] !== firstAuthenticator) {
      throw new Error('kernel read-carrier consumer precedes its authenticated producer');
    }
    if (group.some((reference) => reference.finalOutput !== firstAuthenticator.finalOutput)) {
      throw new Error('kernel read-carrier record changes final disposition across consumers');
    }
    materializations.push({
      recordOrdinal: firstAuthenticator.recordOrdinal,
      recordRole: firstAuthenticator.recordRole,
      firstAuthenticator: firstAuthenticator.occurrence,
      finalOutput: firstAuthenticator.finalOutput,
    });
  }
  return materializations.sort((left, right) => left.recordOrdinal - right.recordOrdinal);
}

/**
 * Rewrite only the redundant physical-authentication bits of later clean-read carrier consumers.
 *
 * Topology construction can legitimately nominate the same physical record in more than one source row. Once a
 * route has the versioned internal-carrier capability, exactly the first source occurrence may co-spend that
 * record; each later occurrence must take the no-input arm. This helper deliberately changes neither collection
 * identity, source order, record ordinal, predecessor ordinal, topology, nor mutation/pending state. It also
 * does not add an authentication bit: the first occurrence must already be the authenticated producer.
 *
 * This is a pure planning boundary, not activation. Callers still need the compiler capability, carrier-aware
 * bytecode, and matching physical input/output materialization before using the rewritten accesses in a
 * transaction.
 */
/**
 * Convert source-ordered clean-read occurrences into the complete physical ownership plan after the caller has
 * assigned global record ordinals. This is deliberately dormant until the compiler advertises the corresponding
 * internal marker capability: it does not itself authorize omitting an input.
 */
export function planKernelEntryJournalReadCarrierPhysicalPlan(
  capability: KernelEntryJournalReadCarrierCapability | undefined,
  occurrences: readonly KernelEntryJournalReadCarrierOccurrence[],
): KernelEntryJournalReadCarrierPhysicalPlan {
  const inputs = planKernelEntryJournalReadCarrierMaterialization(capability, occurrences);
  const inputByRecord = new Map(inputs.map((input) => [input.recordOrdinal, input]));
  const seenOccurrence = new Set<string>();
  const plannedOccurrences: KernelEntryJournalReadCarrierPhysicalOccurrence[] = [];
  const accounting = new Map<string, KernelEntryJournalReadCarrierStreamAccounting>();
  const streamKey = (occurrence: KernelEntryJournalReadCarrierOccurrence): string => (
    `${occurrence.frameIndex}:${occurrence.accessStreamIndex}`
  );
  for (const occurrence of occurrences) {
    const occurrenceKey = `${streamKey(occurrence)}:${occurrence.accessOrdinal}`;
    if (seenOccurrence.has(occurrenceKey)) {
      throw new Error(`kernel read-carrier physical plan repeats source occurrence ${occurrenceKey}`);
    }
    seenOccurrence.add(occurrenceKey);
    const references = readCarrierReferences(occurrence);
    // A clean read names exactly one physical carrier: its present target or its absent-proof predecessor.
    if (references.length !== 1) {
      throw new Error('kernel read-carrier physical plan requires one selected record per clean read');
    }
    const reference = references[0]!;
    const input = inputByRecord.get(reference.recordOrdinal);
    if (!input) throw new Error('kernel read-carrier physical plan lost a selected record owner');
    const materializesInput = input.firstAuthenticator === occurrence;
    plannedOccurrences.push({
      occurrence, recordOrdinal: reference.recordOrdinal, recordRole: reference.recordRole, materializesInput,
    });
    const key = streamKey(occurrence);
    const counts = accounting.get(key) ?? {
      frameIndex: occurrence.frameIndex, accessStreamIndex: occurrence.accessStreamIndex,
      inputCount: 0, outputCount: 0,
    };
    if (materializesInput) {
      counts.inputCount += 1;
      if (input.finalOutput) counts.outputCount += 1;
    }
    accounting.set(key, counts);
  }
  const outputs = inputs.filter((input) => input.finalOutput).map((input, outputOrdinal) => ({
    recordOrdinal: input.recordOrdinal, outputOrdinal,
  }));
  return {
    occurrences: plannedOccurrences,
    inputs,
    outputs,
    streamAccounting: [...accounting.values()].sort((left, right) => left.frameIndex - right.frameIndex
      || left.accessStreamIndex - right.accessStreamIndex),
  };
}

export interface KernelEntryJournalSettlementOutputSegment {
  collection: string;
  offset: number;
  count: number;
}

/**
 * One physical entry output selected by the transaction-wide settlement authority.
 *
 * `recordOrdinal` is the compiler-authenticated global carrier coordinate; `outputOrdinal` is its dense
 * materialized rank after absence records are removed. `offset` remains collection-local only for locating the
 * SDK's already-derived commitment. Keeping both coordinates prevents collection-local sorting from silently
 * becoming physical output order.
 */
export interface KernelEntryJournalSettlementOutputPlanEntry {
  recordOrdinal: number;
  outputOrdinal: number;
  collection: string;
  offset: number;
}

/**
 * One output which is still materialized by the established per-handler journal path.
 *
 * `eagerOutputOrdinal` is transaction-wide within the eager journal prefix. It is explicit rather than inferred
 * from collection order: collections may interleave in source execution order, and a later carrier settlement
 * must not move or duplicate one of these already-owned outputs.
 */
export interface KernelEntryJournalEagerOutputPlanEntry {
  eagerOutputOrdinal: number;
  collection: string;
  offset: number;
}

export type KernelEntryJournalOutputLayoutEntry = {
  /** Dense coordinate within the complete journal output band. */
  outputOrdinal: number;
  collection: string;
  offset: number;
} & (
  | { disposition: 'eager-journal'; eagerOutputOrdinal: number }
  | { disposition: 'deferred-carrier'; recordOrdinal: number; deferredOutputOrdinal: number }
);

/** Explicit `E + D` layout: eager journal outputs first, then the dense route-final carrier band. */
export interface KernelEntryJournalOutputLayoutPlan {
  outputs: KernelEntryJournalOutputLayoutEntry[];
  eagerOutputCount: number;
  deferredOutputBase: number;
  deferredOutputCount: number;
  finalOutputCursorDelta: number;
}

/**
 * Compose independently-authorized journal output families without allowing either family to infer the other's
 * cursor. This is a pure layout boundary: it grants no carrier capability and cannot suppress input materialization.
 *
 * The eager family retains source/materialization order. The deferred family retains canonical global-record
 * order. Their collection-local commitment locations must be globally disjoint, preventing an unchanged eager
 * record from also being recreated by another row's final carrier flush.
 */
export function planKernelEntryJournalOutputLayout(
  eager: readonly KernelEntryJournalEagerOutputPlanEntry[],
  deferred: readonly KernelEntryJournalSettlementOutputPlanEntry[],
): KernelEntryJournalOutputLayoutPlan {
  const locations = new Set<string>();
  const outputs: KernelEntryJournalOutputLayoutEntry[] = [];
  const validateLocation = (collection: string, offset: number): void => {
    if (!collection || !Number.isSafeInteger(offset) || offset < 0) {
      throw new Error('kernel journal output layout has an invalid physical location');
    }
    const location = `${collection}\0${offset}`;
    if (locations.has(location)) {
      throw new Error(`kernel journal output layout repeats physical location ${collection}[${offset}]`);
    }
    locations.add(location);
  };
  for (const [index, entry] of eager.entries()) {
    if (!Number.isSafeInteger(entry.eagerOutputOrdinal) || entry.eagerOutputOrdinal !== index) {
      throw new Error('kernel journal eager output ordinals must be dense and ordered');
    }
    validateLocation(entry.collection, entry.offset);
    outputs.push({
      disposition: 'eager-journal', outputOrdinal: outputs.length,
      eagerOutputOrdinal: entry.eagerOutputOrdinal, collection: entry.collection, offset: entry.offset,
    });
  }
  let priorRecordOrdinal = -1;
  for (const [index, entry] of deferred.entries()) {
    if (!Number.isSafeInteger(entry.recordOrdinal) || entry.recordOrdinal < 0
      || entry.recordOrdinal <= priorRecordOrdinal
      || !Number.isSafeInteger(entry.outputOrdinal) || entry.outputOrdinal !== index) {
      throw new Error('kernel journal deferred outputs must have ordered records and dense ordinals');
    }
    priorRecordOrdinal = entry.recordOrdinal;
    validateLocation(entry.collection, entry.offset);
    outputs.push({
      disposition: 'deferred-carrier', outputOrdinal: outputs.length,
      recordOrdinal: entry.recordOrdinal, deferredOutputOrdinal: entry.outputOrdinal,
      collection: entry.collection, offset: entry.offset,
    });
  }
  return {
    outputs,
    eagerOutputCount: eager.length,
    deferredOutputBase: eager.length,
    deferredOutputCount: deferred.length,
    finalOutputCursorDelta: outputs.length,
  };
}

/**
 * Consume compiler-published settlement recipes against concrete compact access programs.
 *
 * The compiler binds the stream and permitted record roles; runtime topology supplies the actual record ordinals.
 * Callers must provide occurrences in source execution order. Replacing the authority on each mutating reference
 * implements the published `last-mutating-access` rule without using collection iteration order, commitment-vector
 * position, or a best-effort slot scan as the semantic settlement identity.
 */
export function planKernelEntryJournalSettlementAuthority(
  occurrences: readonly KernelEntryJournalSettlementOccurrence[],
): KernelEntryJournalSettlementPlan {
  const streamRecipes = new Map<string, string>();
  const ordinalsByStream = new Map<string, Set<number>>();
  const references: KernelEntryJournalSettlementReference[] = [];
  const settlementAuthorities = new Map<number, KernelEntryJournalSettlementReference>();
  const origins = new Map<number, KernelEntryJournalSettlementReference>();
  const authenticatedCarriers = new Map<number, KernelEntryJournalSettlementReference>();
  for (const { frameIndex, identity, accessOrdinal, access } of occurrences) {
    if (!Number.isSafeInteger(frameIndex) || frameIndex < 0) {
      throw new Error('kernel journal settlement identity has an invalid frame index');
    }
    if (!Number.isSafeInteger(identity.accessStreamIndex) || identity.accessStreamIndex < 0) {
      throw new Error('kernel journal settlement identity has an invalid access stream index');
    }
    if (identity.recordOrdinalScope !== undefined && identity.recordOrdinalScope !== 'global-journal') {
      throw new Error('kernel journal settlement identity has an unsupported record ordinal scope');
    }
    if (identity.accessOrdinalSource !== 'access-program-order'
      || identity.recordOrdinalSources.length !== 2
      || identity.recordOrdinalSources[0] !== 'target-record-ordinal'
      || identity.recordOrdinalSources[1] !== 'predecessor-record-ordinal') {
      throw new Error('kernel journal settlement identity has an unsupported record recipe');
    }
    if ((identity.settlementRole === 'carrier-only') !== (identity.settlementOwnership === 'none')
      || (identity.settlementRole === 'mutation-settlement')
        !== (identity.settlementOwnership === 'last-mutating-access')) {
      throw new Error('kernel journal settlement identity has an inconsistent settlement ownership rule');
    }
    if (identity.recordDispositionSource !== undefined
      && ((identity.settlementRole === 'carrier-only'
        && identity.recordDispositionSource !== 'authenticated-carrier')
        || (identity.settlementRole === 'mutation-settlement'
          && identity.recordDispositionSource !== 'mutation-settlement'))) {
      throw new Error('kernel journal settlement identity has an inconsistent record disposition source');
    }
    const recipe = [
      identity.accessStreamIndex,
      identity.recordOrdinalScope ?? 'legacy-single-stream',
      identity.accessOrdinalSource,
      identity.recordOrdinalSources[0],
      identity.recordOrdinalSources[1],
      identity.settlementRole,
      identity.settlementOwnership,
      identity.recordDispositionSource ?? 'legacy-unspecified-disposition',
    ].join('\0');
    const scopedStream = `${frameIndex}:${identity.accessStreamIndex}`;
    const priorRecipe = streamRecipes.get(scopedStream);
    if (priorRecipe !== undefined && priorRecipe !== recipe) {
      throw new Error(`kernel journal settlement stream ${identity.accessStreamIndex} changes identity recipe`);
    }
    streamRecipes.set(scopedStream, recipe);
    if (!Number.isSafeInteger(accessOrdinal) || accessOrdinal < 0) {
      throw new Error('kernel journal settlement access ordinal must be a non-negative safe integer');
    }
    const streamOrdinals = ordinalsByStream.get(scopedStream) ?? new Set<number>();
    if (streamOrdinals.has(accessOrdinal)) {
      throw new Error(
        `kernel journal settlement stream ${identity.accessStreamIndex} repeats access ordinal ${accessOrdinal}`,
      );
    }
    if (accessOrdinal !== streamOrdinals.size) {
      throw new Error(
        `kernel journal settlement stream ${identity.accessStreamIndex} expected access ordinal `
        + `${streamOrdinals.size}, received ${accessOrdinal}`,
      );
    }
    streamOrdinals.add(accessOrdinal);
    ordinalsByStream.set(scopedStream, streamOrdinals);
    if ((identity.settlementRole === 'mutation-settlement') !== access.mutates) {
      throw new Error(
        `kernel journal settlement stream ${identity.accessStreamIndex} settlement role disagrees with its access`,
      );
    }
    const append = (recordOrdinal: number, recordRole: 'target' | 'predecessor'): void => {
      requireRecordOrdinal(`${recordRole}RecordOrdinal`, recordOrdinal);
      const reference: KernelEntryJournalSettlementReference = {
        frameIndex,
        accessStreamIndex: identity.accessStreamIndex,
        accessOrdinal,
        recordOrdinal,
        recordRole,
        settlementRole: identity.settlementRole,
        settlementDisposition: recordRole === 'predecessor' || access.presentAfter
          ? 'present-output' : 'absence',
      };
      references.push(reference);
      if (!origins.has(recordOrdinal)) origins.set(recordOrdinal, reference);
      const authenticatesRecord = recordRole === 'target'
        ? access.authenticatesTarget === true : access.authenticatesPredecessor === true;
      if (authenticatesRecord) {
        if (authenticatedCarriers.has(recordOrdinal)) {
          throw new Error(`kernel journal record ${recordOrdinal} has multiple authenticating access identities`);
        }
        authenticatedCarriers.set(recordOrdinal, reference);
      }
      const changesRecord = access.mutates && (recordRole === 'target'
        || access.presentBefore !== access.presentAfter);
      if (changesRecord) settlementAuthorities.set(recordOrdinal, reference);
    };
    append(access.targetRecordOrdinal, 'target');
    if (access.predecessorRecordOrdinal !== undefined) {
      append(access.predecessorRecordOrdinal, 'predecessor');
    }
  }
  const recordDispositions = new Map<number, {
    reference: KernelEntryJournalSettlementReference;
    basis: 'mutation-settlement' | 'authenticated-carrier' | 'origin-carrier';
  }>();
  for (const [recordOrdinal, origin] of origins) {
    const mutation = settlementAuthorities.get(recordOrdinal);
    const authenticated = authenticatedCarriers.get(recordOrdinal);
    recordDispositions.set(recordOrdinal, mutation
      ? { reference: mutation, basis: 'mutation-settlement' }
      : authenticated
        ? { reference: authenticated, basis: 'authenticated-carrier' }
        : { reference: origin, basis: 'origin-carrier' });
  }
  return { references, settlementAuthorities, recordDispositions };
}

/**
 * Resolve authenticated record dispositions into the physical contiguous settlement band. Present records are
 * emitted as a dense subsequence of global record-ordinal order, even when collections or access streams interleave.
 * An absence disposition (a deleted/tombstoned target) is settled without emitting an NFT.
 */
export function planKernelEntryJournalSettlementOutputs(
  plan: KernelEntryJournalSettlementPlan,
  resolve: (authority: KernelEntryJournalSettlementReference) => {
    collection: string; offset: number;
  },
): KernelEntryJournalSettlementOutputPlanEntry[] {
  const outputs: KernelEntryJournalSettlementOutputPlanEntry[] = [];
  const usedLocations = new Set<string>();
  const ordered = [...plan.recordDispositions.entries()]
    .sort(([left], [right]) => left - right);
  for (const [recordOrdinal, disposition] of ordered) {
    const { reference } = disposition;
    if (reference.recordOrdinal !== recordOrdinal) {
      throw new Error('kernel journal record disposition aliases a different record ordinal');
    }
    if (reference.settlementDisposition === 'absence') continue;
    const { collection, offset } = resolve(reference);
    if (!collection || !Number.isSafeInteger(offset) || offset < 0) {
      throw new Error(`kernel journal settlement record ${recordOrdinal} has an invalid physical output location`);
    }
    const locationIdentity = `${collection}\0${offset}`;
    if (usedLocations.has(locationIdentity)) {
      throw new Error(`kernel journal settlement record ${recordOrdinal} aliases a physical output location`);
    }
    usedLocations.add(locationIdentity);
    outputs.push({ recordOrdinal, outputOrdinal: outputs.length, collection, offset });
  }
  return outputs;
}

type KernelEntryJournalPhysicalReference = {
  occurrenceIndex: number;
  recordOrdinal: number;
  recordRole: 'target' | 'predecessor';
  authenticates: boolean;
  cleanCarrier: boolean;
};

/**
 * The physical planner accepts decoded access objects rather than their wire form, so retain the compact
 * program's topology invariants at this boundary.  In particular, the planner must not be usable to derive
 * an apparently valid absence settlement from an object which the compact encoder would reject.
 */
function validatePhysicalSettlementAccess(access: KernelEntryJournalAccess): void {
  requireRecordOrdinal('targetRecordOrdinal', access.targetRecordOrdinal);
  if (access.predecessorRecordOrdinal !== undefined) {
    requireRecordOrdinal('predecessorRecordOrdinal', access.predecessorRecordOrdinal);
    if (access.predecessorRecordOrdinal === access.targetRecordOrdinal) {
      throw new Error('journal target and predecessor record ordinals must differ');
    }
  }
  const requiresPredecessor = !access.presentBefore || !access.presentAfter;
  if ((access.predecessorRecordOrdinal !== undefined) !== requiresPredecessor) {
    throw new Error('journal access predecessor presence must match its topology transition');
  }
  if (!access.mutates && access.presentBefore !== access.presentAfter) {
    throw new Error('a non-mutating journal access must preserve target presence');
  }
  if (access.authenticatesTarget && !access.presentBefore) {
    throw new Error('journal access cannot authenticate an absent target');
  }
  if (access.authenticatesPredecessor && access.predecessorRecordOrdinal === undefined) {
    throw new Error('journal access cannot authenticate an absent predecessor');
  }
}

/**
 * Record ordinals name one logical node for the entire selected route.  Retain that flow identity while the
 * planner is still working on plain objects: a later target cannot invent a different pre-state for an ordinal,
 * and a node deleted earlier cannot become a predecessor.  The compact access format encodes each individual
 * transition, but only the transaction-wide planner can check this cross-stream property.
 */
function validatePhysicalSettlementFlow(
  occurrences: readonly KernelEntryJournalSettlementOccurrence[],
): void {
  const presence = new Map<number, boolean>();
  for (const occurrence of occurrences) {
    const { access } = occurrence;
    const knownTargetPresence = presence.get(access.targetRecordOrdinal);
    if (knownTargetPresence !== undefined && knownTargetPresence !== access.presentBefore) {
      throw new Error(`kernel physical settlement record ${access.targetRecordOrdinal} changes target pre-state`);
    }
    presence.set(access.targetRecordOrdinal, access.presentAfter);
    if (access.predecessorRecordOrdinal !== undefined) {
      const knownPredecessorPresence = presence.get(access.predecessorRecordOrdinal);
      if (knownPredecessorPresence === false) {
        throw new Error(
          `kernel physical settlement deleted record ${access.predecessorRecordOrdinal} cannot be a predecessor`,
        );
      }
      // A predecessor is an existing linked-list node in every valid topology transition. This also makes a
      // later target reference bind to that existing physical state rather than silently treating it synthetic.
      presence.set(access.predecessorRecordOrdinal, true);
    }
  }
}

function physicalSettlementReferences(
  occurrence: KernelEntryJournalSettlementOccurrence,
  occurrenceIndex: number,
): KernelEntryJournalPhysicalReference[] {
  const { access } = occurrence;
  const cleanCarrier = !access.mutates && !access.pending && access.presentBefore === access.presentAfter;
  const references: KernelEntryJournalPhysicalReference[] = [{
    occurrenceIndex,
    recordOrdinal: access.targetRecordOrdinal,
    recordRole: 'target',
    authenticates: access.authenticatesTarget === true,
    // An absent target is synthetic protocol state, not an entry NFT carrier. Its predecessor, if any, remains
    // the selected physical record for a clean non-membership proof.
    cleanCarrier: cleanCarrier && access.presentBefore,
  }];
  if (access.predecessorRecordOrdinal !== undefined) {
    references.push({
      occurrenceIndex,
      recordOrdinal: access.predecessorRecordOrdinal,
      recordRole: 'predecessor',
      authenticates: access.authenticatesPredecessor === true,
      cleanCarrier,
    });
  }
  return references;
}

function isSyntheticPresentRecord(
  occurrence: KernelEntryJournalSettlementOccurrence,
  reference: KernelEntryJournalPhysicalReference,
): boolean {
  // Only a mutating absent target may introduce a present record without an input. A predecessor is always an
  // existing link and a clean present target always needs a physical authenticator.
  return reference.recordRole === 'target' && occurrence.access.mutates
    && !occurrence.access.presentBefore && occurrence.access.presentAfter;
}

/**
 * Derive one complete physical settlement model from the source-ordered compact accesses.
 *
 * A topology prepass may conservatively set authentication on every clean read. A later read of an already-owned
 * clean carrier is not a second physical authority: this routine rewrites that specific flag to zero, then feeds
 * the normalized accesses into the ordinary global settlement-authority verifier. Mutating accesses are never
 * rewritten here; a repeated mutating authenticator is therefore rejected rather than silently changing protocol
 * semantics.
 */
export function planKernelEntryJournalPhysicalSettlement(
  occurrences: readonly KernelEntryJournalSettlementOccurrence[],
): KernelEntryJournalPhysicalSettlementPlan {
  const referencesByRecord = new Map<number, KernelEntryJournalPhysicalReference[]>();
  occurrences.forEach((occurrence, occurrenceIndex) => {
    validatePhysicalSettlementAccess(occurrence.access);
    const references = physicalSettlementReferences(occurrence, occurrenceIndex);
    for (const reference of references) {
      requireRecordOrdinal(`${reference.recordRole}RecordOrdinal`, reference.recordOrdinal);
      const group = referencesByRecord.get(reference.recordOrdinal) ?? [];
      group.push(reference);
      referencesByRecord.set(reference.recordOrdinal, group);
    }
  });
  validatePhysicalSettlementFlow(occurrences);

  const rewritten = occurrences.map((occurrence) => occurrence.access);
  const rewrites = new Set<number>();
  const inputReferences: KernelEntryJournalPhysicalReference[] = [];
  for (const [recordOrdinal, references] of referencesByRecord) {
    const authenticators = references.filter((reference) => reference.authenticates);
    if (authenticators.length === 0) continue;
    const firstAuthenticator = authenticators[0]!;
    if (references[0] !== firstAuthenticator) {
      throw new Error(`kernel physical settlement consumer precedes authenticated producer for record ${recordOrdinal}`);
    }
    inputReferences.push(firstAuthenticator);
    for (const duplicate of authenticators.slice(1)) {
      const occurrence = occurrences[duplicate.occurrenceIndex]!;
      if (!duplicate.cleanCarrier) {
        throw new Error(`kernel physical settlement record ${recordOrdinal} has multiple non-clean authenticators`);
      }
      const current = rewritten[duplicate.occurrenceIndex]!;
      // The public access representation uses optional literal `true` flags; omit the selected flag so the
      // compact encoder emits canonical zero rather than widening the type with a non-canonical `false`.
      if (duplicate.recordRole === 'target') {
        const { authenticatesTarget: _target, ...withoutAuthentication } = current;
        rewritten[duplicate.occurrenceIndex] = withoutAuthentication;
      } else {
        const { authenticatesPredecessor: _predecessor, ...withoutAuthentication } = current;
        rewritten[duplicate.occurrenceIndex] = withoutAuthentication;
      }
      rewrites.add(duplicate.occurrenceIndex);
    }
  }

  // A clean consumer is allowed to arrive with its flag already cleared, but only after a source-ordered owner.
  // Validate that situation explicitly, rather than allowing an unauthenticated present entry to become an output.
  for (const [recordOrdinal, references] of referencesByRecord) {
    if (references.some((reference) => reference.authenticates)) continue;
    const first = references[0]!;
    const occurrence = occurrences[first.occurrenceIndex]!;
    const isAbsentOnly = references.every((reference) => reference.recordRole === 'target'
      && !occurrences[reference.occurrenceIndex]!.access.presentAfter);
    if (!isAbsentOnly && !isSyntheticPresentRecord(occurrence, first)) {
      throw new Error(`kernel physical settlement record ${recordOrdinal} has no authenticated producer`);
    }
  }

  const normalizedOccurrences = occurrences.map((occurrence, occurrenceIndex) => ({
    ...occurrence,
    access: rewritten[occurrenceIndex]!,
  }));
  const settlement = planKernelEntryJournalSettlementAuthority(normalizedOccurrences);
  const referenceByCoordinate = new Map<string, KernelEntryJournalSettlementReference>();
  for (const reference of settlement.references) {
    referenceByCoordinate.set(
      `${reference.frameIndex}:${reference.accessStreamIndex}:${reference.accessOrdinal}:${reference.recordRole}`,
      reference,
    );
  }
  const inputs = inputReferences.map((input) => {
    const occurrence = occurrences[input.occurrenceIndex]!;
    const firstOwner = referenceByCoordinate.get(
      `${occurrence.frameIndex}:${occurrence.identity.accessStreamIndex}:${occurrence.accessOrdinal}:${input.recordRole}`,
    );
    if (!firstOwner) throw new Error('kernel physical settlement lost first input owner');
    return { recordOrdinal: input.recordOrdinal, recordRole: input.recordRole, firstOwner };
  });
  const inputCoordinates = new Set(inputs.map((input) => (
    `${input.firstOwner.frameIndex}:${input.firstOwner.accessStreamIndex}:${input.firstOwner.accessOrdinal}`
  )));
  const plannedOccurrences = normalizedOccurrences.map((occurrence, occurrenceIndex) => {
    const coordinate = `${occurrence.frameIndex}:${occurrence.identity.accessStreamIndex}:${occurrence.accessOrdinal}`;
    return {
      occurrence: occurrences[occurrenceIndex]!,
      access: occurrence.access,
      materializesInput: inputCoordinates.has(coordinate),
      rewritesToZeroAuthConsumer: rewrites.has(occurrenceIndex),
    };
  });
  const outputs: KernelEntryJournalPhysicalSettlementOutput[] = [];
  for (const [recordOrdinal, disposition] of [...settlement.recordDispositions.entries()]
    .sort(([left], [right]) => left - right)) {
    if (disposition.reference.settlementDisposition === 'absence') continue;
    const hasInput = inputs.some((input) => input.recordOrdinal === recordOrdinal);
    // A later insertion can mutate an earlier synthetic target as its predecessor. Final ownership then belongs
    // to the later predecessor reference, but physical origin still belongs to the earlier absent-to-present
    // target transition. Validate existence against the complete source-ordered record history, not finalOwner.
    const hasSyntheticProducer = referencesByRecord.get(recordOrdinal)?.some((reference) => (
      isSyntheticPresentRecord(occurrences[reference.occurrenceIndex]!, reference)
    )) === true;
    if (!hasInput && !hasSyntheticProducer) {
      throw new Error(`kernel physical settlement present record ${recordOrdinal} has no input or synthetic producer`);
    }
    outputs.push({ recordOrdinal, outputOrdinal: outputs.length, finalOwner: disposition.reference });
  }
  const accounting = new Map<string, KernelEntryJournalPhysicalSettlementStreamAccounting>();
  const account = (frameIndex: number, accessStreamIndex: number): KernelEntryJournalPhysicalSettlementStreamAccounting => {
    const key = `${frameIndex}:${accessStreamIndex}`;
    const existing = accounting.get(key);
    if (existing) return existing;
    const fresh = { frameIndex, accessStreamIndex, inputCount: 0, outputCount: 0 };
    accounting.set(key, fresh);
    return fresh;
  };
  for (const occurrence of occurrences) account(occurrence.frameIndex, occurrence.identity.accessStreamIndex);
  for (const input of inputs) account(input.firstOwner.frameIndex, input.firstOwner.accessStreamIndex).inputCount += 1;
  for (const output of outputs) account(output.finalOwner.frameIndex, output.finalOwner.accessStreamIndex).outputCount += 1;
  return {
    occurrences: plannedOccurrences,
    inputs,
    outputs,
    streamAccounting: [...accounting.values()].sort((left, right) => left.frameIndex - right.frameIndex
      || left.accessStreamIndex - right.accessStreamIndex),
    finalOutputCursorDelta: outputs.length,
    settlement,
  };
}

/**
 * Bind every dirty final authority to exactly one complete entry commitment.
 *
 * The topology/settlement planner deliberately does not manufacture dynamic value bodies.  Legacy per-handler
 * materialization, however, can leave several provisional commitments for the same slot.  Selecting "the last"
 * of those would silently reintroduce source-order materialization under the new dense final-flush protocol.  A
 * future versioned dirty-carrier transport must therefore bind each body to its producing access identity and call
 * this resolver. It fails closed for zero, duplicate, malformed, clean, tombstoned, or out-of-plan candidates.
 *
 * This helper is pure and has no capability check by design.  Capability publication remains the responsibility
 * of the caller which has verified the matching route bytecode; exporting this helper alone cannot omit an input
 * or materialize an output.
 */
export function resolveKernelEntryJournalDirtyFinalBodies(
  plan: Pick<KernelEntryJournalPhysicalSettlementPlan, 'outputs'>,
  records: readonly KernelEntryJournalRecord[],
  candidates: readonly KernelEntryJournalDirtyFinalBodyCandidate[],
): KernelEntryJournalDirtyFinalBodyResolution[] {
  const dirtyOutputs = new Map<number, KernelEntryJournalPhysicalSettlementOutput>();
  const dirtyOutputsByProducer = new Map<string, KernelEntryJournalPhysicalSettlementOutput>();
  const producerKey = (producer: KernelEntryJournalDirtyFinalBodyProducer): string => (
    `${producer.frameIndex}:${producer.accessStreamIndex}:${producer.accessOrdinal}:${producer.recordRole}`
  );
  for (const output of plan.outputs) {
    if (!Number.isSafeInteger(output.recordOrdinal) || output.recordOrdinal < 0
      || !Number.isSafeInteger(output.outputOrdinal) || output.outputOrdinal < 0) {
      throw new Error('kernel dirty final-body resolution received an invalid output coordinate');
    }
    if (dirtyOutputs.has(output.recordOrdinal)) {
      throw new Error(`kernel dirty final-body resolution has duplicate final authority for record ${output.recordOrdinal}`);
    }
    const record = records[output.recordOrdinal];
    if (!record) {
      throw new Error(`kernel dirty final-body resolution has no record ${output.recordOrdinal}`);
    }
    if (record.dirty) {
      if (record.tombstone) {
        throw new Error(`kernel dirty final-body resolution cannot recreate tombstoned record ${output.recordOrdinal}`);
      }
      dirtyOutputs.set(output.recordOrdinal, output);
      const key = producerKey(output.finalOwner);
      if (dirtyOutputsByProducer.has(key)) {
        throw new Error(`kernel dirty final-body resolution has duplicate producer identity ${key}`);
      }
      dirtyOutputsByProducer.set(key, output);
    }
  }

  const candidatesByRecord = new Map<number, KernelEntryJournalDirtyFinalBodyCandidate[]>();
  for (const candidate of candidates) {
    const { producer } = candidate;
    if (!Number.isSafeInteger(producer.frameIndex) || producer.frameIndex < 0
      || !Number.isSafeInteger(producer.accessStreamIndex) || producer.accessStreamIndex < 0
      || !Number.isSafeInteger(producer.accessOrdinal) || producer.accessOrdinal < 0
      || (producer.recordRole !== 'target' && producer.recordRole !== 'predecessor')) {
      throw new Error('kernel dirty final-body resolution received an invalid producer identity');
    }
    const output = dirtyOutputsByProducer.get(producerKey(producer));
    if (!output) {
      throw new Error(`kernel dirty final-body resolution received an unexpected producer ${producerKey(producer)}`);
    }
    const { recordOrdinal } = output;
    const record = records[recordOrdinal]!;
    // `decodeEntryCommitment` intentionally permits callers which know the commitment shape. At this protocol
    // boundary require the full fixed link prefix explicitly, then bind its slot to the authenticated record.
    if (candidate.commitment.length < SLOT_BYTES * 2
      || candidate.commitment.length > SLOT_BYTES * 2 + KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES) {
      throw new Error(`kernel dirty final-body resolution has malformed commitment for record ${recordOrdinal}`);
    }
    const body = decodeEntryCommitment(candidate.commitment);
    if (!body.slot.every((byte, index) => byte === record.slot[index])) {
      throw new Error(`kernel dirty final-body resolution commitment slot mismatches record ${recordOrdinal}`);
    }
    if (!body.nextKey.every((byte, index) => byte === record.nextKey[index])) {
      throw new Error(`kernel dirty final-body resolution commitment next key mismatches record ${recordOrdinal}`);
    }
    const group = candidatesByRecord.get(recordOrdinal) ?? [];
    group.push(candidate);
    candidatesByRecord.set(recordOrdinal, group);
  }

  return [...dirtyOutputs.entries()]
    .sort(([, left], [, right]) => left.outputOrdinal - right.outputOrdinal)
    .map(([recordOrdinal, output]) => {
      const group = candidatesByRecord.get(recordOrdinal) ?? [];
      if (group.length !== 1) {
        throw new Error(
          `kernel dirty final-body resolution requires exactly one final body for record ${recordOrdinal}; found ${group.length}`,
        );
      }
      // Return an owned copy so callers cannot mutate a post-validation body before builder materialization.
      return { recordOrdinal, outputOrdinal: output.outputOrdinal, commitment: group[0]!.commitment.slice() };
    });
}

/** Convert the canonical output plan into the compact builder ordering form without changing its order. */
export function kernelEntryJournalSettlementOutputSegments(
  outputs: readonly KernelEntryJournalSettlementOutputPlanEntry[],
): KernelEntryJournalSettlementOutputSegment[] {
  const segments: KernelEntryJournalSettlementOutputSegment[] = [];
  for (const entry of outputs) {
    const previous = segments[segments.length - 1];
    if (previous?.collection === entry.collection && previous.offset + previous.count === entry.offset) {
      previous.count += 1;
    } else {
      segments.push({ collection: entry.collection, offset: entry.offset, count: 1 });
    }
  }
  return segments;
}

/** Backward-compatible convenience wrapper for callers that have not yet retained the full output plan. */
export function planKernelEntryJournalSettlementOutputSegments(
  plan: KernelEntryJournalSettlementPlan,
  resolve: (authority: KernelEntryJournalSettlementReference) => {
    collection: string; offset: number;
  },
): KernelEntryJournalSettlementOutputSegment[] {
  return kernelEntryJournalSettlementOutputSegments(planKernelEntryJournalSettlementOutputs(plan, resolve));
}

export interface KernelEntryJournalRecordPosition {
  /** Zero-based independently-pushed carrier segment. */
  segmentIndex: number;
  /** Zero-based record position inside `segmentIndex`. */
  segmentRecordIndex: number;
}

export interface KernelEntryJournalSegmentValidationOptions {
  /** Bind an authenticated external cardinality to the complete segmented vector. */
  expectedRecordCount?: number;
  /** Route-entry witnesses must be clean; dirty records exist only after kernel execution. */
  transportOnly?: boolean;
}

function requireIdentity(name: string, value: Uint8Array, length: number): void {
  if (value.length !== length) throw new Error(`${name} must be exactly ${length} bytes`);
}

/**
 * Encode one independently bounded pending-entry record:
 * `0x05 || flags || collectionHash20 || slot32 || nextKey32 || valueTail`.
 */
export function encodeKernelEntryJournalRecord(record: KernelEntryJournalRecord): Uint8Array {
  requireIdentity('collectionHash', record.collectionHash, COLLECTION_HASH_BYTES);
  requireIdentity('slot', record.slot, SLOT_BYTES);
  requireIdentity('nextKey', record.nextKey, SLOT_BYTES);
  if (record.value.length > KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES) {
    throw new Error(`journal value tail exceeds ${KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES} bytes`);
  }
  if (record.authenticated && record.synthetic) {
    throw new Error('a journal node cannot be both authenticated and synthetic');
  }
  if (!record.authenticated && !record.synthetic) {
    throw new Error('a journal node must be either authenticated or synthetic');
  }
  if (record.synthetic && !record.dirty && !record.tombstone) {
    throw new Error('a clean synthetic journal node must be an absence tombstone');
  }
  if (record.tombstone && !record.dirty && !record.synthetic) {
    throw new Error('a clean journal tombstone must describe an unauthenticated synthetic record');
  }
  if (record.tombstone && record.value.length !== 0) {
    throw new Error('a journal tombstone cannot carry a value');
  }
  if (record.synthetic && !record.dirty && record.nextKey.some((byte) => byte !== 0)) {
    throw new Error('a clean synthetic journal tombstone must use the zero successor');
  }
  let flags = 0;
  if (record.authenticated) flags |= FLAG_AUTHENTICATED;
  if (record.dirty) flags |= FLAG_DIRTY;
  if (record.tombstone) flags |= FLAG_TOMBSTONE;
  if (record.synthetic) flags |= FLAG_SYNTHETIC;
  const encoded = new Uint8Array(HEADER_BYTES + record.value.length);
  encoded[0] = KERNEL_ENTRY_JOURNAL_TAG;
  encoded[1] = flags;
  encoded.set(record.collectionHash, 2);
  encoded.set(record.slot, 2 + COLLECTION_HASH_BYTES);
  encoded.set(record.nextKey, 2 + COLLECTION_HASH_BYTES + SLOT_BYTES);
  encoded.set(record.value, HEADER_BYTES);
  return encoded;
}

export function decodeKernelEntryJournalRecord(encoded: Uint8Array): KernelEntryJournalRecord {
  if (encoded.length < HEADER_BYTES) throw new Error('kernel entry journal record is truncated');
  if (encoded.length > HEADER_BYTES + KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES) {
    throw new Error(`journal value tail exceeds ${KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES} bytes`);
  }
  if (encoded[0] !== KERNEL_ENTRY_JOURNAL_TAG) throw new Error('invalid kernel entry journal record tag');
  const flags = encoded[1];
  if ((flags & ~KNOWN_FLAGS) !== 0) throw new Error('kernel entry journal record has unknown flags');
  const authenticated = (flags & FLAG_AUTHENTICATED) !== 0;
  const dirty = (flags & FLAG_DIRTY) !== 0;
  const tombstone = (flags & FLAG_TOMBSTONE) !== 0;
  const synthetic = (flags & FLAG_SYNTHETIC) !== 0;
  if (authenticated && synthetic) throw new Error('a journal node cannot be both authenticated and synthetic');
  if (!authenticated && !synthetic) {
    throw new Error('a journal node must be either authenticated or synthetic');
  }
  if (synthetic && !dirty && !tombstone) {
    throw new Error('a clean synthetic journal node must be an absence tombstone');
  }
  if (tombstone && !dirty && !synthetic) {
    throw new Error('a clean journal tombstone must describe an unauthenticated synthetic record');
  }
  if (tombstone && encoded.length !== HEADER_BYTES) {
    throw new Error('a journal tombstone cannot carry a value');
  }
  const nextKey = encoded.slice(2 + COLLECTION_HASH_BYTES + SLOT_BYTES, HEADER_BYTES);
  if (synthetic && !dirty && nextKey.some((byte) => byte !== 0)) {
    throw new Error('a clean synthetic journal tombstone must use the zero successor');
  }
  return {
    collectionHash: encoded.slice(2, 2 + COLLECTION_HASH_BYTES),
    slot: encoded.slice(2 + COLLECTION_HASH_BYTES, 2 + COLLECTION_HASH_BYTES + SLOT_BYTES),
    nextKey,
    value: encoded.slice(HEADER_BYTES),
    authenticated,
    dirty,
    tombstone,
    synthetic,
  };
}

/**
 * Validate the record vector accepted by the transport-only kernel route.
 *
 * Dirty records describe an in-progress state transition. They are valid only after compiler-generated route
 * execution has authenticated and transformed a clean carrier; accepting one from the caller would bypass that
 * provenance check. Transport therefore admits only clean authenticated records and clean synthetic tombstones.
 */
export function validateKernelEntryJournalTransportRecords(
  encodedRecords: readonly Uint8Array[],
): KernelEntryJournalRecord[] {
  return encodedRecords.map((encoded) => {
    const record = decodeKernelEntryJournalRecord(encoded);
    if (record.dirty) {
      throw new Error('dirty kernel entry journal records require final-flush settlement');
    }
    return record;
  });
}

function encodedKernelEntryJournalSegmentLength(segment: readonly Uint8Array[]): number {
  return encodePushdataValue([...segment], 'bytes[]').length;
}

/** Encode one canonical record vector as the opaque, independently bounded wire carrier. */
export function encodeKernelEntryJournalRecordSegment(segment: readonly Uint8Array[]): Uint8Array {
  return encodePushdataValue([...segment], 'bytes[]');
}

function requireSegmentRecordCount(recordCount: number): void {
  if (!Number.isSafeInteger(recordCount) || recordCount < 0
    || recordCount > KERNEL_ENTRY_JOURNAL_MAX_RECORDS) {
    throw new Error(
      `kernel entry journal segmented record count must not exceed ${KERNEL_ENTRY_JOURNAL_MAX_RECORDS}`,
    );
  }
}

/**
 * Map one stable global first-touch ordinal to its value-independent segmented carrier position.
 */
export function kernelEntryJournalRecordPosition(
  ordinal: number,
  recordCount: number,
): KernelEntryJournalRecordPosition {
  requireSegmentRecordCount(recordCount);
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= recordCount) {
    throw new Error('kernel entry journal global record ordinal is out of range');
  }
  return {
    segmentIndex: Math.floor(ordinal / KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT),
    segmentRecordIndex: ordinal % KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT,
  };
}

/**
 * Split a record vector without changing its global first-touch ordinal space. Every non-final segment has the
 * fixed capacity, and the final segment is non-empty. This unique partition is safe under later record mutation:
 * segment membership never depends on a record's current encoded length.
 */
export function segmentKernelEntryJournalRecords(
  encodedRecords: readonly Uint8Array[],
): Uint8Array[][] {
  requireSegmentRecordCount(encodedRecords.length);
  encodedRecords.forEach(decodeKernelEntryJournalRecord);
  const segments: Uint8Array[][] = [];
  for (let offset = 0; offset < encodedRecords.length; offset += KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT) {
    const segment = encodedRecords.slice(offset, offset + KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT)
      .map((record) => new Uint8Array(record));
    if (encodedKernelEntryJournalSegmentLength(segment) > MAX_MESSAGE_BUS_BLOB_BYTES) {
      throw new Error('kernel entry journal segment exceeds the 520-byte BCH stack-item limit');
    }
    segments.push(segment);
  }
  return segments;
}

/**
 * Validate the canonical non-empty segmented prefix and return its global-ordinal record vector. Swapped,
 * duplicated, or omitted records remain visible in that vector for the route's authenticated access-program
 * identity checks; this layer binds exact cardinality, framing, and the one permissible segment partition.
 */
export function validateKernelEntryJournalRecordSegments(
  segments: readonly (readonly Uint8Array[])[],
  options: KernelEntryJournalSegmentValidationOptions = {},
): KernelEntryJournalRecord[] {
  if (segments.some((segment) => segment.length === 0)) {
    throw new Error('kernel entry journal segments must form a non-empty prefix');
  }
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment.length > KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT
      || (index + 1 < segments.length && segment.length !== KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT)) {
      throw new Error('kernel entry journal segments use a non-canonical record partition');
    }
    if (encodedKernelEntryJournalSegmentLength(segment) > MAX_MESSAGE_BUS_BLOB_BYTES) {
      throw new Error('kernel entry journal segment exceeds the 520-byte BCH stack-item limit');
    }
  }
  const encodedRecords = segments.flatMap((segment) => [...segment]);
  requireSegmentRecordCount(encodedRecords.length);
  if (options.expectedRecordCount !== undefined) {
    requireSegmentRecordCount(options.expectedRecordCount);
    if (encodedRecords.length !== options.expectedRecordCount) {
      throw new Error('kernel entry journal segment cardinality does not match the authenticated record count');
    }
  }
  return options.transportOnly
    ? validateKernelEntryJournalTransportRecords(encodedRecords)
    : encodedRecords.map(decodeKernelEntryJournalRecord);
}

/**
 * Validate a compiler-provisioned segment slot vector. `segmentCount` is the authenticated active prefix:
 * exactly those slots are non-empty and every remaining capacity slot is the canonical empty array.
 */
export function validateKernelEntryJournalRecordSegmentSlots(
  slots: readonly (readonly Uint8Array[])[],
  segmentCount: number,
  options: KernelEntryJournalSegmentValidationOptions = {},
): KernelEntryJournalRecord[] {
  if (!Number.isSafeInteger(segmentCount) || segmentCount < 0 || segmentCount > slots.length) {
    throw new Error('kernel entry journal segment count is out of range');
  }
  for (let index = 0; index < slots.length; index += 1) {
    if ((index < segmentCount) !== (slots[index].length > 0)) {
      throw new Error('kernel entry journal segment slots must use the authenticated non-empty prefix');
    }
  }
  return validateKernelEntryJournalRecordSegments(slots.slice(0, segmentCount), options);
}

/** Encode a planner's first-touch-ordered records for one collection into the exact covenant carrier format. */
export function encodeKernelEntryJournalRecords(
  collectionHash: Uint8Array,
  records: readonly JournaledMutationRecord[],
): Uint8Array[] {
  requireIdentity('collectionHash', collectionHash, COLLECTION_HASH_BYTES);
  return records.map((record) => encodeKernelEntryJournalRecord({
    collectionHash,
    slot: record.slot,
    nextKey: record.nextKey,
    value: record.value,
    authenticated: record.authenticated,
    dirty: record.dirty,
    tombstone: record.tombstone,
    synthetic: record.synthetic,
  }));
}

/**
 * Plan all row/loop streams for one collection as one ordered transition, then split only the compact access
 * programs back at their source boundaries. Flattening before planning is essential: a later stream must observe
 * the pending value and predecessor topology produced by every earlier stream, while all streams address one
 * collection-wide first-touch record ordinal space.
 */
export function planKernelEntryJournalStreams<T>(
  list: SortedList,
  collectionHash: Uint8Array,
  streams: readonly (readonly JournaledUpsert<T>[])[],
  reduce: (current: Uint8Array | undefined, operation: T, slot: Uint8Array) => Uint8Array | undefined,
): KernelEntryJournalStreamPlan {
  const streamLengths = streams.map((stream) => stream.length);
  const mutationPlan = list.planJournaledMutations(streams.flat(), reduce);
  let accessOffset = 0;
  const encodedAccessStreams = streamLengths.map((length) => {
    const streamAccesses = mutationPlan.accesses.slice(accessOffset, accessOffset + length);
    accessOffset += length;
    return encodeKernelEntryJournalAccesses(collectionHash, streamAccesses);
  });
  return {
    mutationPlan,
    encodedRecords: encodeKernelEntryJournalRecords(collectionHash, mutationPlan.records),
    encodedAccessStreams,
  };
}

/**
 * Plan record selection before concrete values are available. This intentionally returns no record carriers:
 * placeholder values are sufficient to determine presence, predecessor topology, and first-touch ordinals, but
 * must never be confused with the final values emitted by `planKernelEntryJournalStreams`.
 */
export function planKernelEntryJournalAccessTopology(
  list: SortedList,
  collectionHash: Uint8Array,
  streams: readonly (readonly JournaledUpsert<KernelEntryJournalTopologyOperation>[])[],
): KernelEntryJournalAccessTopologyPlan {
  requireIdentity('collectionHash', collectionHash, COLLECTION_HASH_BYTES);
  const preserve = (current: Uint8Array | undefined): JournaledMutationResult => ({
    value: current,
    dirty: false,
  });
  const streamLengths = streams.map((stream) => stream.length);
  const mutationPlan = list.planJournaledMutations(
    streams.flat(),
    (current, operation) => operation === 'read' ? preserve(current)
      : operation === 'remove' ? undefined : new Uint8Array(),
  );
  let accessOffset = 0;
  return {
    recordCount: mutationPlan.records.length,
    // Topology planning intentionally does not claim final values. Existing records carry their exact authenticated
    // pre-state commitment, while absent targets are clean synthetic tombstones. The covenant may transition these
    // records in source order later; neither form can be mistaken for an already-settled dirty output.
    encodedRecords: mutationPlan.records.map((record) => {
      const original = list.find(record.slot);
      return encodeKernelEntryJournalRecord(original ? {
        collectionHash,
        slot: original.slot,
        nextKey: original.nextKey,
        value: original.value,
        authenticated: true,
        dirty: false,
        tombstone: false,
        synthetic: false,
      } : {
        collectionHash,
        slot: record.slot,
        nextKey: new Uint8Array(SLOT_BYTES),
        value: new Uint8Array(),
        authenticated: false,
        dirty: false,
        tombstone: true,
        synthetic: true,
      });
    }),
    encodedAccessStreams: streamLengths.map((length) => {
      const accesses = mutationPlan.accesses.slice(accessOffset, accessOffset + length);
      accessOffset += length;
      return encodeKernelEntryJournalAccesses(collectionHash, accesses);
    }),
  };
}

function requireRecordOrdinal(name: string, ordinal: number): void {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= NO_PREDECESSOR) {
    throw new Error(`${name} must be an unsigned 16-bit journal record ordinal below 65535`);
  }
}

/**
 * Encode one row-owned mutation stream. Record identities stay in independently bounded `0x05` items; this
 * compact program only selects their stable first-touch ordinals and states whether the operation inserts,
 * updates, deletes, or observes absence. Canonical counter streams contain at most 64 operations, while the
 * format remains valid up to the largest fixed-width program which fits one 520-byte BCH stack item.
 */
export function encodeKernelEntryJournalAccesses(
  collectionHash: Uint8Array,
  accesses: readonly KernelEntryJournalAccess[],
): Uint8Array {
  requireIdentity('collectionHash', collectionHash, COLLECTION_HASH_BYTES);
  if (accesses.length > KERNEL_ENTRY_JOURNAL_MAX_ACCESSES) {
    throw new Error(
      `kernel entry journal access stream exceeds ${KERNEL_ENTRY_JOURNAL_MAX_ACCESSES} operations`,
    );
  }
  const encoded = new Uint8Array(ACCESS_HEADER_BYTES + accesses.length * ACCESS_BYTES);
  encoded[0] = KERNEL_ENTRY_JOURNAL_ACCESS_TAG;
  encoded[1] = accesses.length;
  encoded.set(collectionHash, 2);
  accesses.forEach((access, index) => {
    requireRecordOrdinal('targetRecordOrdinal', access.targetRecordOrdinal);
    if (access.predecessorRecordOrdinal !== undefined) {
      requireRecordOrdinal('predecessorRecordOrdinal', access.predecessorRecordOrdinal);
      if (access.predecessorRecordOrdinal === access.targetRecordOrdinal) {
        throw new Error('journal target and predecessor record ordinals must differ');
      }
    }
    const requiresPredecessor = !access.presentBefore || !access.presentAfter;
    if ((access.predecessorRecordOrdinal !== undefined) !== requiresPredecessor) {
      throw new Error('journal access predecessor presence must match its topology transition');
    }
    if (!access.mutates && access.presentBefore !== access.presentAfter) {
      throw new Error('a non-mutating journal access must preserve target presence');
    }
    if (access.authenticatesPredecessor && access.predecessorRecordOrdinal === undefined) {
      throw new Error('journal access cannot authenticate an absent predecessor');
    }
    if (access.authenticatesTarget && !access.presentBefore) {
      throw new Error('journal access cannot authenticate an absent target');
    }
    let flags = 0;
    if (access.presentBefore) flags |= ACCESS_FLAG_PRESENT_BEFORE;
    if (access.presentAfter) flags |= ACCESS_FLAG_PRESENT_AFTER;
    if (access.predecessorRecordOrdinal !== undefined) flags |= ACCESS_FLAG_HAS_PREDECESSOR;
    if (access.mutates) flags |= ACCESS_FLAG_MUTATES;
    if (access.authenticatesTarget) flags |= ACCESS_FLAG_AUTHENTICATES_TARGET;
    if (access.authenticatesPredecessor) flags |= ACCESS_FLAG_AUTHENTICATES_PREDECESSOR;
    if (access.pending) flags |= ACCESS_FLAG_PENDING;
    const offset = ACCESS_HEADER_BYTES + index * ACCESS_BYTES;
    const predecessor = access.predecessorRecordOrdinal ?? NO_PREDECESSOR;
    encoded[offset] = flags;
    encoded[offset + 1] = access.targetRecordOrdinal & 0xff;
    encoded[offset + 2] = access.targetRecordOrdinal >>> 8;
    encoded[offset + 3] = predecessor & 0xff;
    encoded[offset + 4] = predecessor >>> 8;
  });
  return encoded;
}

/** Decode and canonically validate one compact row-owned mutation stream. */
export function decodeKernelEntryJournalAccesses(encoded: Uint8Array): KernelEntryJournalAccess[] {
  if (encoded.length < ACCESS_HEADER_BYTES) throw new Error('kernel entry journal access stream is truncated');
  if (encoded[0] !== KERNEL_ENTRY_JOURNAL_ACCESS_TAG) {
    throw new Error('invalid kernel entry journal access stream tag');
  }
  const count = encoded[1];
  if (count > KERNEL_ENTRY_JOURNAL_MAX_ACCESSES) {
    throw new Error(`kernel entry journal access stream exceeds ${KERNEL_ENTRY_JOURNAL_MAX_ACCESSES} operations`);
  }
  if (encoded.length !== ACCESS_HEADER_BYTES + count * ACCESS_BYTES) {
    throw new Error('kernel entry journal access stream has a non-canonical length');
  }
  return Array.from({ length: count }, (_unused, index) => {
    const offset = ACCESS_HEADER_BYTES + index * ACCESS_BYTES;
    const flags = encoded[offset];
    if ((flags & ~KNOWN_ACCESS_FLAGS) !== 0) {
      throw new Error('kernel entry journal access stream has unknown flags');
    }
    const targetRecordOrdinal = encoded[offset + 1] | (encoded[offset + 2] << 8);
    const predecessor = encoded[offset + 3] | (encoded[offset + 4] << 8);
    const hasPredecessor = (flags & ACCESS_FLAG_HAS_PREDECESSOR) !== 0;
    if (targetRecordOrdinal === NO_PREDECESSOR) {
      throw new Error('kernel entry journal access stream uses the reserved target ordinal');
    }
    if (hasPredecessor !== (predecessor !== NO_PREDECESSOR)) {
      throw new Error('kernel entry journal access stream has a non-canonical predecessor');
    }
    if (predecessor === targetRecordOrdinal) {
      throw new Error('journal target and predecessor record ordinals must differ');
    }
    const presentBefore = (flags & ACCESS_FLAG_PRESENT_BEFORE) !== 0;
    const presentAfter = (flags & ACCESS_FLAG_PRESENT_AFTER) !== 0;
    if (hasPredecessor !== (!presentBefore || !presentAfter)) {
      throw new Error('journal access predecessor presence must match its topology transition');
    }
    const mutates = (flags & ACCESS_FLAG_MUTATES) !== 0;
    if (!mutates && presentBefore !== presentAfter) {
      throw new Error('a non-mutating journal access must preserve target presence');
    }
    if ((flags & ACCESS_FLAG_AUTHENTICATES_PREDECESSOR) !== 0 && !hasPredecessor) {
      throw new Error('journal access cannot authenticate an absent predecessor');
    }
    if ((flags & ACCESS_FLAG_AUTHENTICATES_TARGET) !== 0 && !presentBefore) {
      throw new Error('journal access cannot authenticate an absent target');
    }
    return {
      targetRecordOrdinal,
      ...(hasPredecessor && { predecessorRecordOrdinal: predecessor }),
      presentBefore,
      presentAfter,
      mutates,
      ...((flags & ACCESS_FLAG_AUTHENTICATES_TARGET) !== 0 && { authenticatesTarget: true as const }),
      ...((flags & ACCESS_FLAG_AUTHENTICATES_PREDECESSOR) !== 0
        && { authenticatesPredecessor: true as const }),
      ...((flags & ACCESS_FLAG_PENDING) !== 0 && { pending: true as const }),
    };
  });
}
