import { binToHex } from '@bitauth/libauth';
import { sha256, VALUE_CHUNK_SIZE, VALUE_HEAD_SIZE } from '@solidcash/utils';

export interface AuthenticatedValueChunk {
  commitment: string;
  lockingBytecode: Uint8Array;
  categoryId?: string;
}

/**
 * Compiler/runtime identity of one chunkable collection value.
 *
 * A collection name is not an identity: two artifacts may use the same name for
 * different types, and two keys in one mapping must never share a continuation
 * run. The collection signature and resolved storage slot are both required.
 */
export interface CollectionValueIdentity {
  categoryId: string;
  collectionSignature: string;
  slot: Uint8Array;
}

export interface CollectionValueSpend {
  txid: string;
  vout: number;
  satoshis: bigint;
  token: {
    category: string;
    amount: bigint;
    nft?: { capability: 'none' | 'mutable' | 'minting'; commitment: string };
  };
  lockingBytecode: Uint8Array;
}

/** Resolved metadata for one compiler-declared chunkable collection write. */
export interface CollectionValueWrite {
  identity: CollectionValueIdentity;
  accessIndex: number;
  collectionName: string;
  valueType: string;
  /** Deterministic entry covenant for this compiler-resolved collection identity. */
  lockingBytecode?: Uint8Array;
  value?: Uint8Array;
  outputBase?: number;
  outputCount?: number;
}

export interface CollectionValueRecord {
  identity: CollectionValueIdentity;
  chunks: readonly AuthenticatedValueChunk[];
  value?: Uint8Array;
  valueRoot?: Uint8Array;
  lockingBytecode?: Uint8Array;
  spends?: readonly CollectionValueSpend[];
  phase: 'observed' | 'committed';
}

/** Resolve write ownership from the logical group to the physical executor which consumes the hidden witness. */
export function collectionValueWritesForExecution(
  logicalWrites: readonly CollectionValueWrite[] | undefined,
  physicalWrites: readonly CollectionValueWrite[] | undefined,
): readonly CollectionValueWrite[] {
  return logicalWrites && logicalWrites.length > 0 ? logicalWrites : physicalWrites ?? [];
}

/**
 * Initial continuation geometry for active writes. Exact values contribute their exact chunk count; an unresolved
 * computed value receives one probe slot so the VM can authenticate its real value and expand the band. Visible
 * route-envelope bytes are deliberately irrelevant to collection value size.
 */
export function plannedCollectionValueChunkCount(writes: readonly CollectionValueWrite[]): number {
  return writes.reduce((total, write) => {
    if (write.value === undefined) return total + 1;
    if (write.value.length <= VALUE_HEAD_SIZE) return total;
    return total + Math.ceil((write.value.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE);
  }, 0);
}

const records = new Map<string, CollectionValueRecord>();
const stagedValues = new Map<string, {
  identity: CollectionValueIdentity;
  value: Uint8Array;
}>();

function normalizedIdentity(identity: CollectionValueIdentity): CollectionValueIdentity {
  if (!/^[0-9a-f]{64}$/i.test(identity.categoryId)) {
    throw new Error('Collection value identity requires a 32-byte category ID');
  }
  if (identity.collectionSignature.length === 0) {
    throw new Error('Collection value identity requires a collection signature');
  }
  if (identity.slot.length !== 32) {
    throw new Error('Collection value identity requires a 32-byte resolved slot');
  }
  return {
    categoryId: identity.categoryId.toLowerCase(),
    collectionSignature: identity.collectionSignature,
    slot: identity.slot.slice(),
  };
}

function identityKey(identity: CollectionValueIdentity): string {
  const normalized = normalizedIdentity(identity);
  return `${normalized.categoryId}:${normalized.collectionSignature}:${binToHex(normalized.slot)}`;
}

function valueChunkIndex(commitment: string): number | undefined {
  const hex = commitment.startsWith('0x') ? commitment.slice(2) : commitment;
  if (hex.length < 4 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return undefined;
  const index = Number.parseInt(hex.slice(0, 2), 16)
    + 256 * Number.parseInt(hex.slice(2, 4), 16);
  return index >= 0 && index < 32 ? index : undefined;
}

function isEmptyValueChunkCommitment(commitment: string): boolean {
  const hex = commitment.startsWith('0x') ? commitment.slice(2) : commitment;
  return hex.length >= 4 && /^(?:[0-9a-f]{2}|[0-9a-f]{4})0+$/i.test(hex);
}

function usableChunks(chunks: readonly AuthenticatedValueChunk[]): AuthenticatedValueChunk[] {
  return chunks.filter((chunk) => {
    const commitment = chunk.commitment.startsWith('0x')
      ? chunk.commitment.slice(2) : chunk.commitment;
    if (commitment.length < 6 || valueChunkIndex(commitment) === undefined) return false;
    return !(commitment.length >= 16 && isEmptyValueChunkCommitment(commitment));
  });
}

/** Recover one root-addressed, zero-based continuation run from an observation. */
export function coherentAuthenticatedValueChunkRun(
  chunks: readonly AuthenticatedValueChunk[],
): AuthenticatedValueChunk[] {
  const byLock = new Map<string, {
    chunks: Map<number, AuthenticatedValueChunk>;
    lastSeen: number;
  }>();
  for (const [order, chunk] of usableChunks(chunks).entries()) {
    const index = valueChunkIndex(chunk.commitment)!;
    const lock = binToHex(chunk.lockingBytecode);
    const group = byLock.get(lock) ?? { chunks: new Map(), lastSeen: order };
    group.chunks.set(index, chunk);
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

/** Prefer a newly authenticated run, including a shorter replacement version. */
export function selectObservedValueChunkRun(
  fallback: readonly AuthenticatedValueChunk[],
  observed: readonly AuthenticatedValueChunk[],
): AuthenticatedValueChunk[] {
  const current = coherentAuthenticatedValueChunkRun(observed);
  return current.length > 0 ? current : coherentAuthenticatedValueChunkRun(fallback);
}

export function getCollectionValueRecord(
  identity: CollectionValueIdentity,
): Readonly<CollectionValueRecord> | undefined {
  return records.get(identityKey(identity));
}

export function stageCollectionValue(
  identity: CollectionValueIdentity,
  value: Uint8Array,
): void {
  const normalized = normalizedIdentity(identity);
  stagedValues.set(identityKey(normalized), { identity: normalized, value: value.slice() });
}

/**
 * Commit a value whose complete representation lives in the entry commitment.
 *
 * Replacing a long value with an inline value consumes the old continuation NFTs and intentionally creates no
 * replacement run. Retaining the previous record in that case would allow a later builder to resurrect spent
 * chunks, so the empty run is itself an authoritative committed state.
 */
export function commitInlineCollectionValue(
  identity: CollectionValueIdentity,
  value: Uint8Array,
): void {
  const normalized = normalizedIdentity(identity);
  const key = identityKey(normalized);
  records.set(key, {
    identity: normalized,
    chunks: [],
    value: value.slice(),
    valueRoot: sha256(value),
    phase: 'committed',
  });
  stagedValues.delete(key);
}

/** Return an exact committed spend run only when it authenticates the requested value version. */
export function getCommittedCollectionValueSpends(
  identity: CollectionValueIdentity,
  valueRoot: Uint8Array,
): readonly CollectionValueSpend[] | undefined {
  const record = getCollectionValueRecord(identity);
  if (record?.phase !== 'committed' || record.valueRoot === undefined
    || binToHex(record.valueRoot) !== binToHex(valueRoot)) return undefined;
  const run = coherentAuthenticatedValueChunkRun(record.chunks);
  if (run.length === 0 || record.spends?.length !== run.length) return undefined;
  const spendsByIndex = new Map<number, CollectionValueSpend>();
  for (const spend of record.spends) {
    const commitment = spend.token.nft?.commitment;
    const index = commitment === undefined ? undefined : valueChunkIndex(commitment);
    if (index === undefined || spend.token.category.toLowerCase() !== identity.categoryId.toLowerCase()
      || spend.token.nft?.capability !== 'mutable') return undefined;
    const expected = run[index];
    if (!expected || expected.commitment !== commitment
      || binToHex(expected.lockingBytecode) !== binToHex(spend.lockingBytecode)) return undefined;
    spendsByIndex.set(index, spend);
  }
  const ordered = run.map((_chunk, index) => spendsByIndex.get(index));
  return ordered.every((spend) => spend !== undefined)
    ? ordered as CollectionValueSpend[] : undefined;
}

export function observeCollectionValueChunks(
  identity: CollectionValueIdentity,
  chunks: readonly AuthenticatedValueChunk[],
  observation: {
    value?: Uint8Array;
    lockingBytecode?: Uint8Array;
    spends?: readonly CollectionValueSpend[];
  } = {},
): void {
  const normalized = normalizedIdentity(identity);
  const key = identityKey(normalized);
  const previous = records.get(key);
  const observed = coherentAuthenticatedValueChunkRun(chunks);
  if (observed.length === 0) return;
  const sameRun = previous?.chunks.length === observed.length
    && observed.every((chunk, index) => {
      const prior = previous.chunks[index];
      return prior?.commitment === chunk.commitment
        && binToHex(prior.lockingBytecode) === binToHex(chunk.lockingBytecode);
    });
  const coherentLock = observed.every((chunk) => (
    binToHex(chunk.lockingBytecode) === binToHex(observed[0].lockingBytecode)
  )) ? observed[0].lockingBytecode : undefined;
  const stagedValue = stagedValues.get(key)?.value;
  const value = observation.value ?? stagedValue ?? (sameRun ? previous?.value : undefined);
  records.set(key, {
    identity: normalized,
    chunks: observed,
    value,
    valueRoot: value === undefined ? (sameRun ? previous?.valueRoot : undefined) : sha256(value),
    lockingBytecode: observation.lockingBytecode ?? coherentLock
      ?? (sameRun ? previous?.lockingBytecode : undefined),
    spends: observation.spends ?? (sameRun ? previous?.spends : undefined),
    phase: 'observed',
  });
  stagedValues.delete(key);
}

export function commitCollectionValue(
  identity: CollectionValueIdentity,
  spends?: readonly CollectionValueSpend[],
): void {
  const key = identityKey(identity);
  const current = records.get(key);
  if (!current) throw new Error('Cannot commit an unobserved collection value');
  records.set(key, { ...current, spends: spends ?? current.spends, phase: 'committed' });
}

export function clearCollectionValueRecords(filter: {
  categoryId?: string;
  collectionSignature?: string;
  slot?: Uint8Array;
} = {}): void {
  if (filter.categoryId === undefined
    && filter.collectionSignature === undefined
    && filter.slot === undefined) {
    records.clear();
    stagedValues.clear();
    return;
  }
  const category = filter.categoryId?.toLowerCase();
  const slot = filter.slot && binToHex(filter.slot);
  const matches = (record: CollectionValueRecord): boolean => (
    (category === undefined || record.identity.categoryId === category)
    && (filter.collectionSignature === undefined
      || record.identity.collectionSignature === filter.collectionSignature)
    && (slot === undefined || binToHex(record.identity.slot) === slot)
  );
  for (const [key, record] of records) if (matches(record)) records.delete(key);
  for (const [key, staged] of stagedValues) {
    if (matches({ identity: staged.identity, chunks: [], phase: 'observed' })) {
      stagedValues.delete(key);
    }
  }
}
