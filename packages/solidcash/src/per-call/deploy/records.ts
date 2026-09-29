/**
 * A per-call deployment's state records: where they sit, how they are spent, and how they are found.
 *
 * A data-NFT record is minted at the data-NFT covenant the contract's category derives, the same lock the direct
 * convention's data NFTs sit at: a P2SH32 of `buildDataNftCovenantScript(category)`. It carries the contract's
 * category with a mutable NFT whose commitment is the state the constructor's frame computed. Because the lock is
 * derived from the category, a reader can both recompute the address and enumerate the category; the classification
 * below reads a category's live UTXOs, so it finds the records whichever way the caller reached it.
 *
 * The recorded state is the shipped encoding: each commitment parses with `parsePushdataCommitment` at its
 * data-NFT index, so a caller reads the same values the constructor wrote, through the same decoder the direct
 * path uses.
 */

import { hexToBin } from '@bitauth/libauth';
import {
  buildDataNftCovenantScript,
  buildEntryNftCovenantScript,
  buildSatoshiContainerCovenantScript,
  bytesToHex,
  computeCollectionHash,
  dynamicChunkSignature,
  isMultiDataNftLayout,
  parsePushdataCommitment,
  scriptToBytecode,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import { encodeFunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { getDataNftLockingBytecode } from '../../stateful/covenant-helpers.js';
import { createUnlockingBytecode, scriptToAddress, scriptToLockingBytecode } from '../../utils.js';

/** Raised when a per-call deployment's records cannot be read. */
export class PerCallRecordError extends Error {
  public readonly name = 'PerCallRecordError';

  public constructor(message: string) {
    super(message);
  }
}

/**
 * The lock a per-call state record sits at: the data-NFT covenant the contract's category derives.
 *
 * A genesis mints every data NFT at this lock, and a composition spends and recreates the record at it, so the
 * record's input and output carry the same lock. The covenant pins the record's own category and capability, so a
 * UTXO at this lock holding the contract's mutable token is a genuine record.
 */
export function stateRecordLockingBytecode(categoryId: string): Uint8Array {
  return getDataNftLockingBytecode(categoryId);
}

/**
 * The lock a per-call contract's satoshi containers sit at: the direct convention's container covenant for the
 * contract's category. Their value is the contract's balance (spec 4b).
 */
export function satoshiContainerLockingBytecode(categoryId: string): Uint8Array {
  return scriptToLockingBytecode(buildSatoshiContainerCovenantScript(hexToBin(categoryId)), 'p2sh32');
}

/**
 * The unlocking a satoshi container carries on its master path: the minting NFT at `masterInputIndex` authorizes
 * the spend, and that master's own checks account for the value.
 */
export function satoshiContainerUnlockingBytecode(categoryId: string, masterInputIndex: number): Uint8Array {
  const bytecode = scriptToBytecode(buildSatoshiContainerCovenantScript(hexToBin(categoryId)));
  const args = [1n, BigInt(masterInputIndex)].map((value) => encodeFunctionArgument(value, 'bigint') as Uint8Array);
  return createUnlockingBytecode('p2sh32', bytecode, args);
}

/** The contract's satoshi containers: the tokenless UTXOs at its container lock, which hold its balance. */
export async function readSatoshiContainers(provider: NetworkProvider, categoryId: string): Promise<readonly Utxo[]> {
  const address = scriptToAddress(
    buildSatoshiContainerCovenantScript(hexToBin(categoryId)), provider.network, 'p2sh32', true,
  );
  return (await provider.getUtxos(address)).filter((utxo) => utxo.token === undefined);
}

/**
 * The lock a mapping node sits at: the entry-NFT covenant the collection's signature derives.
 *
 * A genesis mints a mapping's head sentinel and every node the constructor's write creates at this lock, and a
 * composition spends and recreates each node at it, so the node's covenant pins the collection.
 */
export function entryRecordLockingBytecode(categoryId: string, collectionSignature: string): Uint8Array {
  const covenant = buildEntryNftCovenantScript(hexToBin(categoryId), computeCollectionHash(collectionSignature));
  return scriptToLockingBytecode(covenant, 'p2sh32');
}

/**
 * The lock and read-only unlocking of a mapping node a read only reads.
 *
 * The entry covenant's read-only path (`flag = 0`) needs no master and preserves the node's bytecode, category,
 * commitment, FT amount and satoshis, so a read spends the node and recreates it unchanged.
 */
export function entryRecordReadUnlock(categoryId: string, collectionSignature: string): {
  readonly lockingBytecode: Uint8Array;
  readonly unlockingBytecode: Uint8Array;
} {
  const covenant = buildEntryNftCovenantScript(hexToBin(categoryId), computeCollectionHash(collectionSignature));
  const flag = encodeFunctionArgument(0n, 'bigint') as Uint8Array;
  return {
    lockingBytecode: scriptToLockingBytecode(covenant, 'p2sh32'),
    unlockingBytecode: createUnlockingBytecode('p2sh32', scriptToBytecode(covenant), [flag, flag]),
  };
}

/**
 * The lock a dynamic value's chunk sits at: the entry-NFT covenant the value's chunk signature derives.
 *
 * A `string`, `bytes` or dynamic array is not held in the data NFT that declares it; the bytes live in a run of
 * chunks, and each chunk is an entry NFT of the value's own collection. The signature is the compiler's canonical
 * one for the variable and its type, so the lock is the same one the emitted body rebuilds at run time.
 */
export function chunkRecordLockingBytecode(categoryId: string, variable: string, type: string): Uint8Array {
  const covenant = buildEntryNftCovenantScript(
    hexToBin(categoryId), computeCollectionHash(dynamicChunkSignature(variable, type)),
  );
  return scriptToLockingBytecode(covenant, 'p2sh32');
}

/**
 * The unlocking a per-call state record carries: the data-NFT covenant's `<masterInputIndex> <flag>` shape.
 *
 * `flag = 1` is the covenant's write path, which authorizes the spend by the minting NFT of `categoryId` at
 * `masterInputIndex`; a composition passes the index its own master sits at. `flag = 0` is the read-only path,
 * which needs no master and preserves the record's commitment, for a record a segment only reads.
 */
export function stateRecordUnlockingBytecode(
  categoryId: string,
  masterInputIndex: number,
  flag: 0 | 1,
): Uint8Array {
  const bytecode = scriptToBytecode(buildDataNftCovenantScript(hexToBin(categoryId)));
  const args = [BigInt(flag), BigInt(masterInputIndex)]
    .map((value) => encodeFunctionArgument(value, 'bigint') as Uint8Array);
  return createUnlockingBytecode('p2sh32', bytecode, args);
}

/** What a category's live UTXOs are, classified the way a per-call deployment mints them. */
export interface PerCallDeploymentSet {
  /** The master pool: UTXOs carrying the category's minting NFT. */
  readonly masters: readonly Utxo[];
  /** The validator pool: mutable NFTs with no commitment, recreated by every composition. */
  readonly validators: readonly Utxo[];
  /** The state records: one per data NFT, in data-NFT order, each carrying a parseable commitment. */
  readonly records: readonly Utxo[];
  /**
   * The dynamic value chunks: mutable NFTs at a chunkable variable's own collection covenant.
   *
   * A `string`, `bytes` or dynamic array is held in a run of chunk UTXOs rather than in its data NFT, and the
   * constructor's frame mints the chunks its write produced. They are neither records nor validators: a record's
   * commitment parses at a data-NFT index and a validator carries no commitment at all.
   */
  readonly chunks: readonly Utxo[];
  /**
   * The collection nodes: mutable NFTs carrying a commitment that is not a data-NFT record's.
   *
   * A sorted collection is a chain of node UTXOs — the empty list's head sentinel and, once an entry writes it, the
   * nodes it creates — each at its collection's entry covenant. They are not validators: a validator carries an
   * empty commitment, which is what every composition recreates it with.
   */
  readonly collectionNodes: readonly Utxo[];
  /**
   * The collection nodes of each sorted collection the layout publishes, keyed by collection name.
   *
   * A contract that keeps several mappings holds every collection's nodes at the same category, and a frame that
   * writes one collection has to declare exactly that collection's nodes: the nodes of another collection carry
   * unrelated slots, so telling them apart needs each collection's own entry covenant lock. A node whose lock no
   * published collection derives appears only in `collectionNodes`.
   */
  readonly nodesByCollection: ReadonlyMap<string, readonly Utxo[]>;
}

/** The lock hex of every chunkable variable's chunk covenant, keyed for classifying a deployment's UTXOs. */
function chunkLocks(categoryId: string, layout: StateLayout): ReadonlySet<string> {
  const locks = new Set<string>();
  for (const variable of layout.variables) {
    if (variable.dynamic !== true) continue;
    locks.add(bytesToHex(chunkRecordLockingBytecode(categoryId, variable.name, variable.type)));
  }
  return locks;
}

/**
 * Every live UTXO of a category, or `undefined` when the provider cannot enumerate by category.
 *
 * A provider that lists by category reaches every pool in one call: the master pool, the validator pool and the
 * records, wherever the records' own lock sits.
 */
async function utxosOfCategory(
  provider: NetworkProvider,
  categoryId: string,
): Promise<readonly Utxo[] | undefined> {
  if (typeof provider.getUtxosByTokenCategory !== 'function') return undefined;
  return provider.getUtxosByTokenCategory(categoryId);
}

/** The data-NFT index a commitment parses at, or `undefined` when it is not a data-NFT commitment. */
function nftIndexOf(commitment: string, layout: StateLayout): number | undefined {
  if (commitment.length === 0) return undefined;
  for (let nftIndex = 0; nftIndex < layout.dataNftCount; nftIndex += 1) {
    try {
      parsePushdataCommitment(commitment, layout, nftIndex);
      return nftIndex;
    } catch {
      // Not this index; try the next.
    }
  }
  return undefined;
}

/**
 * Classifies a category's live UTXOs into the pools and records a per-call deployment mints.
 *
 * A minting NFT is a master, a mutable NFT with an empty commitment is a validator, a mutable NFT whose commitment
 * parses as the layout's pushdata encoding is a record at that data-NFT index, and any other mutable NFT is a
 * collection node. Records come back in data-NFT order (the tag order a multi-NFT layout carries, otherwise by
 * outpoint), so index `i` is genuinely register `i`.
 */
export function classifyPerCallDeployment(
  utxos: readonly Utxo[],
  layout: StateLayout,
): PerCallDeploymentSet {
  const masters: Utxo[] = [];
  const validators: Utxo[] = [];
  const chunks: Utxo[] = [];
  const collectionNodes: Utxo[] = [];
  const nodesByCollection = new Map<string, Utxo[]>();
  const tagged: Array<{ utxo: Utxo; nftIndex: number }> = [];
  const locksByCategory = new Map<string, ReadonlySet<string>>();
  const collectionLocksByCategory = new Map<string, ReadonlyMap<string, string>>();
  /** The collection name each of a category's entry covenant locks derives, keyed by the lock hex. */
  const collectionLocksFor = (categoryId: string): ReadonlyMap<string, string> => {
    let found = collectionLocksByCategory.get(categoryId);
    if (found === undefined) {
      const locks = new Map<string, string>();
      for (const collection of layout.collections ?? []) {
        locks.set(bytesToHex(entryRecordLockingBytecode(categoryId, collection.signature)), collection.name);
      }
      found = locks;
      collectionLocksByCategory.set(categoryId, locks);
    }
    return found;
  };
  for (const utxo of utxos) {
    const nft = utxo.token?.nft;
    if (nft === undefined) continue;
    if (nft.capability === 'minting') {
      masters.push(utxo);
      continue;
    }
    if (nft.capability !== 'mutable') continue;
    const index = nftIndexOf(nft.commitment, layout);
    if (index !== undefined) tagged.push({ utxo, nftIndex: index });
    else if (nft.commitment === '') validators.push(utxo);
    else {
      const categoryId = utxo.token?.category;
      const lockingBytecode = (utxo as { readonly lockingBytecode?: Uint8Array }).lockingBytecode;
      let locks = categoryId === undefined ? undefined : locksByCategory.get(categoryId);
      if (categoryId !== undefined && locks === undefined) {
        locks = chunkLocks(categoryId, layout);
        locksByCategory.set(categoryId, locks);
      }
      const isChunk = locks !== undefined && lockingBytecode !== undefined
        && locks.has(bytesToHex(lockingBytecode));
      if (isChunk) chunks.push(utxo);
      else {
        // The node's own covenant tells which collection it belongs to; a lock no collection derives is unfiled.
        const collection = categoryId === undefined || lockingBytecode === undefined
          ? undefined
          : collectionLocksFor(categoryId).get(bytesToHex(lockingBytecode));
        if (collection !== undefined) {
          nodesByCollection.set(collection, [...(nodesByCollection.get(collection) ?? []), utxo]);
        }
        collectionNodes.push(utxo);
      }
    }
  }
  masters.sort((left, right) => left.vout - right.vout);
  validators.sort((left, right) => left.vout - right.vout);
  chunks.sort((left, right) => left.vout - right.vout);
  collectionNodes.sort((left, right) => left.vout - right.vout);
  for (const nodes of nodesByCollection.values()) nodes.sort((left, right) => left.vout - right.vout);
  tagged.sort((left, right) => (isMultiDataNftLayout(layout)
    ? left.nftIndex - right.nftIndex
    : left.utxo.vout - right.utxo.vout));
  return {
    masters, validators, chunks, records: tagged.map((entry) => entry.utxo), collectionNodes, nodesByCollection,
  };
}

/**
 * Reads a deployed per-call contract's pools and records from the chain, by category.
 *
 * Refuses rather than guessing when the provider cannot enumerate a category, since classifying the pools needs
 * every live UTXO of the category to tell a master from a validator from a record.
 */
export async function readPerCallDeployment(
  provider: NetworkProvider,
  categoryId: string,
  layout: StateLayout,
): Promise<PerCallDeploymentSet> {
  const utxos = await utxosOfCategory(provider, categoryId);
  if (utxos === undefined) {
    throw new PerCallRecordError(
      `the provider cannot enumerate UTXOs by category ${categoryId}, which is how the master pool, the validator `
      + 'pool and the records are told apart',
    );
  }
  return classifyPerCallDeployment(utxos, layout);
}

/** The decoded state a per-call deployment's records hold, keyed by variable name. */
export interface PerCallState {
  /** The state values of each data NFT, in data-NFT order. */
  readonly byNft: readonly Record<string, StateValue>[];
  /** The records the values were read from, in data-NFT order. */
  readonly records: readonly Utxo[];
}

/**
 * Reads and decodes a per-call deployment's state through the shipped pushdata decoder.
 *
 * Refuses when a record for a data-NFT index is missing, because a state read that guessed at a missing register
 * would report a default where the contract has a value.
 */
export async function readPerCallState(
  provider: NetworkProvider,
  categoryId: string,
  layout: StateLayout,
): Promise<PerCallState> {
  const deployment = await readPerCallDeployment(provider, categoryId, layout);
  const byNft: Array<Record<string, StateValue>> = [];
  for (let nftIndex = 0; nftIndex < layout.dataNftCount; nftIndex += 1) {
    const record = deployment.records[nftIndex];
    const commitment = record?.token?.nft?.commitment;
    if (record === undefined || commitment === undefined) {
      throw new PerCallRecordError(
        `category ${categoryId} has no data-NFT record at index ${nftIndex} (found ${deployment.records.length})`,
      );
    }
    byNft.push(parsePushdataCommitment(commitment, layout, nftIndex));
  }
  return { byNft, records: deployment.records };
}
