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
  computeCollectionHash,
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
import { createUnlockingBytecode, scriptToLockingBytecode } from '../../utils.js';

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
 * A minting NFT is a master, a mutable NFT with an empty commitment is a validator, and a mutable NFT whose
 * commitment parses as the layout's pushdata encoding is a record at that data-NFT index. Records come back in
 * data-NFT order (the tag order a multi-NFT layout carries, otherwise by outpoint), so index `i` is genuinely
 * register `i`.
 */
export function classifyPerCallDeployment(
  utxos: readonly Utxo[],
  layout: StateLayout,
): PerCallDeploymentSet {
  const masters: Utxo[] = [];
  const validators: Utxo[] = [];
  const tagged: Array<{ utxo: Utxo; nftIndex: number }> = [];
  for (const utxo of utxos) {
    const nft = utxo.token?.nft;
    if (nft === undefined) continue;
    if (nft.capability === 'minting') {
      masters.push(utxo);
      continue;
    }
    if (nft.capability !== 'mutable') continue;
    const index = nftIndexOf(nft.commitment, layout);
    if (index === undefined) validators.push(utxo);
    else tagged.push({ utxo, nftIndex: index });
  }
  masters.sort((left, right) => left.vout - right.vout);
  validators.sort((left, right) => left.vout - right.vout);
  tagged.sort((left, right) => (isMultiDataNftLayout(layout)
    ? left.nftIndex - right.nftIndex
    : left.utxo.vout - right.utxo.vout));
  return { masters, validators, records: tagged.map((entry) => entry.utxo) };
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
