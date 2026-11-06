/**
 * A framed deployment's state records: where they sit, how they are spent, and how they are found.
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

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  VALUE_HEAD_SIZE,
  VALUE_INLINE_LIMIT,
  buildDataNftCovenantScript,
  buildEntryNftCovenantScript,
  buildSatoshiContainerCovenantScript,
  bytesToHex,
  computeCollectionHash,
  dynamicChunkSignature,
  hasDataNftIndexTags,
  parsePushdataCommitment,
  scriptToBytecode,
  validatorAddress,
  type Artifact,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { encodeFunctionArgument } from '../../Argument.js';
import { authheadLockingBytecode } from '../../bcmr/authhead.js';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { decodeEntryCommitment } from '../../stateful/SortedList.js';
import { getDataNftLockingBytecode, toTokenAwareAddress } from '../../stateful/covenant-helpers.js';
import {
  addressToLockScript, createUnlockingBytecode, scriptToAddress, scriptToLockingBytecode,
} from '../../utils.js';
import { listDeployments } from '../../stateful/deployment-registry.js';
import { mappingValueChunkLock } from '../composer/mapping-plan.js';
import { prepareFunctionSplitDeployment } from './entry-pool.js';
import { deployMaster } from './material.js';
import { functionSplitFor } from './split-registry.js';

/** Raised when a framed deployment's records cannot be read. */
export class FramedRecordError extends Error {
  public readonly name = 'FramedRecordError';

  public constructor(message: string) {
    super(message);
  }
}

/**
 * The lock a framed state record sits at: the data-NFT covenant the contract's category derives.
 *
 * A genesis mints every data NFT at this lock, and a composition spends and recreates the record at it, so the
 * record's input and output carry the same lock. The covenant pins the record's own category and capability, so a
 * UTXO at this lock holding the contract's mutable token is a genuine record.
 */
export function stateRecordLockingBytecode(categoryId: string): Uint8Array {
  return getDataNftLockingBytecode(categoryId);
}

/**
 * The lock a framed contract's satoshi containers sit at: the direct convention's container covenant for the
 * contract's category. Their value is the contract's balance (spec 4b).
 */
export function satoshiContainerLockingBytecode(categoryId: string): Uint8Array {
  return scriptToLockingBytecode(buildSatoshiContainerCovenantScript(hexToBin(categoryId)), 'p2sh32');
}

/**
 * The output a contract's run of sends follows when its frame keeps nothing: zero satoshis at
 * `OP_RETURN <the contract's container lock>`. It names the payer as a container would (spec 4b, "A send's payer"),
 * where a container cannot hold nothing and a dust one would be a gift the EVM never makes.
 */
export function drainedRunMarkerLockingBytecode(categoryId: string): Uint8Array {
  const lock = satoshiContainerLockingBytecode(categoryId);
  // Framed keeps this OP_RETURN until it retires after TRE (the user, 2026-11-03).
  return Uint8Array.from([0x6a, lock.length, ...lock]);
}

/** The output a contract's run of sends follows: the container that keeps `kept`, or the drained run's marker. */
export function runLeadOutput(
  categoryId: string, kept: bigint,
): { readonly lockingBytecode: Uint8Array; readonly valueSatoshis: bigint } {
  return kept > 0n
    ? { lockingBytecode: satoshiContainerLockingBytecode(categoryId), valueSatoshis: kept }
    : { lockingBytecode: drainedRunMarkerLockingBytecode(categoryId), valueSatoshis: 0n };
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
 * The unlocking a framed state record carries: the data-NFT covenant's `<masterInputIndex> <flag>` shape.
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

/** What a category's live UTXOs are, classified the way a framed deployment mints them. */
export interface FramedDeploymentSet {
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
  /**
   * The master pool partitioned by locking bytecode.
   *
   * The key is the locking-bytecode hex. Masters that publish no lock share the empty-string group, so a
   * monolith whose UTXOs are untagged, and a monolith whose masters share one lock, are one group. A v2
   * deployment has one group per entry lock. The commitment is not read: a minting NFT with a non-empty
   * commitment is still a master and still sits in its lock's group.
   */
  readonly mastersByLock: ReadonlyMap<string, readonly Utxo[]>;
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

/** A deployment's coins are found through a provider that indexes categories, or at the locks they derive. */
function listsByCategory(
  provider: NetworkProvider,
): provider is NetworkProvider & Required<Pick<NetworkProvider, 'getUtxosByTokenCategory'>> {
  return typeof provider.getUtxosByTokenCategory === 'function';
}

/** Whether a token's category is `categoryId`, which a caller may state in either byte order. */
function ofCategory(utxo: Utxo, categoryId: string): boolean {
  const held = utxo.token?.category.toLowerCase();
  if (held === undefined) return false;
  const wanted = categoryId.toLowerCase();
  return held === wanted || held === bytesToHex(hexToBin(wanted).reverse());
}

/**
 * The coins of `categoryId` at `locks`, each carrying the lock it was listed at.
 *
 * A lock takes anyone's coins, so a listing holds whatever was paid to it: a foreign token at a record's covenant is
 * nothing of the deployment's, and a constant-lock master's listing holds every category that shares it. Only the
 * category's own coins are returned, and a coin two locks' listings share is returned once.
 */
export async function categoryCoinsAtLocks(
  provider: NetworkProvider,
  categoryId: string,
  locks: readonly Uint8Array[],
): Promise<Utxo[]> {
  const unique = [...new Map(locks.map((lock) => [bytesToHex(lock), lock])).values()];
  const listed = await Promise.all(unique.map(async (lock) => (await provider.getUtxosForLockingBytecode(lock))
    .filter((utxo) => ofCategory(utxo, categoryId))
    .map((utxo): Utxo => ({ ...utxo, lockingBytecode: lock }))));
  return [...new Map(listed.flat().map((utxo) => [`${utxo.txid}:${utxo.vout}`, utxo])).values()];
}

/** The locks a category's record state sits at: its records and each dynamic value's chunks. */
export function framedRecordLocks(categoryId: string, layout: StateLayout): Uint8Array[] {
  return [
    ...(layout.dataNftCount > 0 ? [stateRecordLockingBytecode(categoryId)] : []),
    ...(layout.variables ?? []).filter((variable) => variable.dynamic === true)
      .map((variable) => chunkRecordLockingBytecode(categoryId, variable.name, variable.type)),
  ];
}

/** The locks all of a category's state sits at: its record state and each sorted collection's nodes. */
export function framedStateLocks(categoryId: string, layout: StateLayout): Uint8Array[] {
  return [...framedRecordLocks(categoryId, layout), ...framedCollectionLocks(categoryId, layout)];
}

/** The lock of each sorted collection the layout publishes. */
export function framedCollectionLocks(categoryId: string, layout: StateLayout): Uint8Array[] {
  return (layout.collections ?? []).map((collection) => entryRecordLockingBytecode(categoryId, collection.signature));
}

/**
 * The locks a long mapping value's continuation chunks sit at: each salted with its node's slot and its value's digest,
 * so a provider that lists by lock reaches them from the nodes `coins` hold, a value that fits its node having none.
 */
function valueChunkLocks(categoryId: string, layout: StateLayout, coins: readonly Utxo[]): Uint8Array[] {
  const locks: Uint8Array[] = [];
  for (const collection of layout.collections ?? []) {
    if (collection.chunkableValue !== true) continue;
    const lock = bytesToHex(entryRecordLockingBytecode(categoryId, collection.signature));
    for (const coin of coins) {
      const commitment = coin.token?.nft?.commitment;
      if (commitment === undefined || coin.lockingBytecode === undefined
        || bytesToHex(coin.lockingBytecode) !== lock) continue;
      let entry: ReturnType<typeof decodeEntryCommitment>;
      try {
        entry = decodeEntryCommitment(hexToBin(commitment));
      } catch {
        continue; // A collection's head sentinel holds no value.
      }
      const { slot, value: tail } = entry;
      if (tail.length < 4 + 32 + VALUE_HEAD_SIZE) continue;
      const length = new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
      if (tail.length === 4 + length && length <= VALUE_INLINE_LIMIT) continue;
      locks.push(mappingValueChunkLock(hexToBin(categoryId), collection.name, { slot, root: tail.slice(4, 4 + 32) }));
    }
  }
  return locks;
}

/**
 * A category's mapping-value chunks, the coins whose locks only its live nodes name. `nodes` are the category's coins
 * already listed; a provider that lists by category has them there.
 */
export async function framedValueChunks(
  provider: NetworkProvider, categoryId: string, layout: StateLayout, nodes: readonly Utxo[],
): Promise<Utxo[]> {
  return categoryCoinsAtLocks(provider, categoryId, valueChunkLocks(categoryId, layout, nodes));
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
 * Classifies a category's live UTXOs into the pools and records a framed deployment mints.
 *
 * A minting NFT is a master, a mutable NFT with an empty commitment is a validator, a mutable NFT at the data-NFT
 * covenant whose commitment parses as the layout's pushdata encoding is a record at that data-NFT index, and any
 * other mutable NFT is a collection node. A UTXO that carries no lock is judged by its commitment alone, except
 * that masters are also grouped by lock into `mastersByLock` (an absent lock shares one group). A minting NFT
 * with a non-empty commitment is still a master. Records come back in data-NFT order (verified index tags
 * when the layout publishes them, otherwise by outpoint), so index `i` is genuinely register `i`.
 */
export function classifyFramedDeployment(
  utxos: readonly Utxo[],
  layout: StateLayout,
): FramedDeploymentSet {
  const masters: Utxo[] = [];
  const mastersByLock = new Map<string, Utxo[]>();
  const validators: Utxo[] = [];
  const chunks: Utxo[] = [];
  const collectionNodes: Utxo[] = [];
  const nodesByCollection = new Map<string, Utxo[]>();
  const tagged: Array<{ utxo: Utxo; nftIndex: number }> = [];
  const locksByCategory = new Map<string, ReadonlySet<string>>();
  const recordLocksByCategory = new Map<string, string>();
  /** Whether a UTXO sits where a record can: a chunk or node elsewhere may carry a commitment that parses as one. */
  const atRecordLock = (categoryId: string | undefined, lockingBytecode: Uint8Array | undefined): boolean => {
    if (categoryId === undefined || lockingBytecode === undefined) return true;
    let lock = recordLocksByCategory.get(categoryId);
    if (lock === undefined) {
      lock = bytesToHex(stateRecordLockingBytecode(categoryId));
      recordLocksByCategory.set(categoryId, lock);
    }
    return bytesToHex(lockingBytecode) === lock;
  };
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
      // The group is the lock. A missing lock shares the empty key; the commitment is not a key.
      const masterLock = (utxo as { readonly lockingBytecode?: Uint8Array }).lockingBytecode;
      const key = masterLock === undefined ? '' : bytesToHex(masterLock);
      const group = mastersByLock.get(key) ?? [];
      group.push(utxo);
      mastersByLock.set(key, group);
      continue;
    }
    if (nft.capability !== 'mutable') continue;
    const categoryId = utxo.token?.category;
    const lockingBytecode = (utxo as { readonly lockingBytecode?: Uint8Array }).lockingBytecode;
    // The identity NFT at the category's authhead contract is no part of the deployment.
    if (categoryId !== undefined && lockingBytecode !== undefined
      && bytesToHex(lockingBytecode) === bytesToHex(authheadLockingBytecode(categoryId))) continue;
    const index = atRecordLock(categoryId, lockingBytecode) ? nftIndexOf(nft.commitment, layout) : undefined;
    if (index !== undefined) tagged.push({ utxo, nftIndex: index });
    else if (nft.commitment === '') validators.push(utxo);
    else {
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
  for (const group of mastersByLock.values()) group.sort((left, right) => left.vout - right.vout);
  validators.sort((left, right) => left.vout - right.vout);
  chunks.sort((left, right) => left.vout - right.vout);
  collectionNodes.sort((left, right) => left.vout - right.vout);
  for (const nodes of nodesByCollection.values()) nodes.sort((left, right) => left.vout - right.vout);
  tagged.sort((left, right) => (hasDataNftIndexTags(layout)
    ? left.nftIndex - right.nftIndex
    : left.utxo.vout - right.utxo.vout));
  return {
    masters, mastersByLock, validators, chunks, records: tagged.map((entry) => entry.utxo),
    collectionNodes, nodesByCollection,
  };
}

/**
 * Every entry lock the provider's registrations hold for a category: each shard and internal cut of the bundle its
 * genesis registered, else the program of the deployment registered for it. A category nothing registered has none.
 */
function registeredMasterLocks(
  provider: NetworkProvider, categoryId: string, validatorProgram: Uint8Array,
): Uint8Array[] {
  const category = hexToBin(categoryId);
  const split = functionSplitFor(provider, categoryId);
  if (split !== undefined) {
    const prepared = prepareFunctionSplitDeployment(split, category, validatorProgram);
    return [
      ...prepared.locks.values(),
      ...[...prepared.shardArtifacts.values()].map((artifact) => deployMaster(artifact, category, validatorProgram)
        .lockingBytecode),
    ];
  }
  const wanted = categoryId.toLowerCase();
  return listDeployments(provider).flatMap((registered) => {
    const contract = registered.contract as {
      readonly categoryId?: string;
      readonly artifact?: Artifact;
      readonly inner?: { readonly artifact?: Artifact };
      readonly proxy?: { readonly categoryId?: string };
      readonly framedProxy?: { readonly artifact?: Artifact };
    } | undefined;
    const artifact = contract?.proxy?.categoryId?.toLowerCase() === wanted
      ? contract.framedProxy?.artifact
      : contract?.categoryId?.toLowerCase() === wanted || registered.category?.toLowerCase() === wanted
        ? contract?.inner?.artifact ?? contract?.artifact
        : undefined;
    return artifact?.composition?.placeholders === undefined
      ? [] : [deployMaster(artifact, category, validatorProgram).lockingBytecode];
  });
}

/** What a read of a deployment needs when its provider lists by lock only. */
export interface FramedDeploymentReadOptions {
  /**
   * The master locks the read is for. A provider that lists by category answers with every master it holds, and
   * these change nothing. One that lists by lock is asked for these alone: an entry's lock is known before its master
   * is, and a created child's masters share their locks with every child of its creator, so a listing of them all
   * would grow with the creator's children. `withMastersAt` adds a lock a read did not name. Left out, the read lists
   * every entry lock the provider's registrations hold for the category.
   */
  readonly masterLocks?: readonly Uint8Array[];
  /** The program the category's validators are addressed by; the toolchain's own by default. */
  readonly validatorProgram?: Uint8Array;
}

/**
 * Reads a deployed framed contract's pools and records from the chain.
 *
 * Classifying the pools needs the coins of the category. A provider that indexes categories lists them in one call; on
 * one that lists by lock (an Electrum server) each pool is found at the lock it derives: the validators at the
 * category's address, the records, nodes and chunks at their covenants, and the masters at the entry locks the caller
 * names (`FramedDeploymentReadOptions.masterLocks`) or, naming none, at the locks the provider's registrations derive.
 */
export async function readFramedDeployment(
  provider: NetworkProvider,
  categoryId: string,
  layout: StateLayout,
  options: FramedDeploymentReadOptions = {},
): Promise<FramedDeploymentSet> {
  if (listsByCategory(provider)) {
    return classifyFramedDeployment(await provider.getUtxosByTokenCategory(categoryId), layout);
  }
  const validatorProgram = options.validatorProgram ?? framedValidator.buildValidatorProgram();
  const coins = await categoryCoinsAtLocks(provider, categoryId, [
    validatorAddress(hexToBin(categoryId), validatorProgram),
    ...framedStateLocks(categoryId, layout),
    ...options.masterLocks ?? registeredMasterLocks(provider, categoryId, validatorProgram),
  ]);
  return classifyFramedDeployment([...coins, ...await framedValueChunks(provider, categoryId, layout, coins)], layout);
}

/**
 * `deployment` with the masters at `locks` in its pools: on a provider that lists by lock, a read names only the
 * entry it knows of, and a frame planned later may run another entry of the category. A provider that lists by category
 * has them all already, as has a read that named the lock.
 */
export async function withMastersAt(
  provider: NetworkProvider,
  categoryId: string,
  deployment: FramedDeploymentSet,
  locks: readonly Uint8Array[],
): Promise<FramedDeploymentSet> {
  if (listsByCategory(provider)) return deployment;
  const missing = locks.filter((lock) => !deployment.mastersByLock.has(bytesToHex(lock)));
  if (missing.length === 0) return deployment;
  const found = await categoryCoinsAtLocks(provider, categoryId, missing);
  const mastersByLock = new Map(deployment.mastersByLock);
  // An empty pool is remembered too, so a lock no master sits at is listed once.
  for (const lock of missing) {
    const key = bytesToHex(lock);
    mastersByLock.set(key, found.filter((utxo) => utxo.token?.nft?.capability === 'minting'
      && bytesToHex(utxo.lockingBytecode!) === key).sort((left, right) => left.vout - right.vout));
  }
  return {
    ...deployment,
    masters: [...mastersByLock.values()].flat().sort((left, right) => left.vout - right.vout),
    mastersByLock,
  };
}

/**
 * The category of the framed contract at `address`, or undefined when no coin there derives the address.
 *
 * A framed contract's address is `addrV(category)`, so the category is proven, not read off the first token at the
 * address: an address takes anyone's coins, and a dust CashToken paid to one would otherwise name its own category.
 * A contract's validators sit there, so a live deployment always holds the coin that proves it.
 */
export async function framedCategoryAt(
  provider: NetworkProvider,
  address: string,
  validatorProgram: Uint8Array = framedValidator.buildValidatorProgram(),
): Promise<string | undefined> {
  const lock = bytesToHex(addressToLockScript(address));
  const coins = await provider.getUtxos(toTokenAwareAddress(address));
  const categories = new Set(coins.flatMap((utxo) => (utxo.token === undefined ? [] : [utxo.token.category])));
  return [...categories].find((category) => bytesToHex(validatorAddress(hexToBin(category), validatorProgram)) === lock);
}

/** The decoded state a framed deployment's records hold, keyed by variable name. */
export interface FramedState {
  /** The state values of each data NFT, in data-NFT order. */
  readonly byNft: readonly Record<string, StateValue>[];
  /** The records the values were read from, in data-NFT order. */
  readonly records: readonly Utxo[];
}

/**
 * Reads and decodes a framed deployment's state through the shipped pushdata decoder.
 *
 * Refuses when a record for a data-NFT index is missing, because a state read that guessed at a missing register
 * would report a default where the contract has a value.
 */
export async function readFramedState(
  provider: NetworkProvider,
  categoryId: string,
  layout: StateLayout,
): Promise<FramedState> {
  // A state read spends no master, so a provider that lists by lock is asked for none.
  const deployment = await readFramedDeployment(provider, categoryId, layout, { masterLocks: [] });
  const byNft: Array<Record<string, StateValue>> = [];
  for (let nftIndex = 0; nftIndex < layout.dataNftCount; nftIndex += 1) {
    const record = deployment.records[nftIndex];
    const commitment = record?.token?.nft?.commitment;
    if (record === undefined || commitment === undefined) {
      throw new FramedRecordError(
        `category ${categoryId} has no data-NFT record at index ${nftIndex} (found ${deployment.records.length})`,
      );
    }
    byNft.push(parsePushdataCommitment(commitment, layout, nftIndex));
  }
  return { byNft, records: deployment.records };
}
