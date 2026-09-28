/**
 * Finding a per-call deployment's records.
 *
 * A per-call deployment mints its records at the funder's own lock — the account that authorized the genesis —
 * not at a category-derived covenant address. Each record is a plain UTXO carrying the contract's category with a
 * mutable NFT whose commitment is the state the constructor's frame computed. Because the lock is the deployer's
 * and not derived from the category, a reader cannot compute where the records sit; what makes them findable is
 * the category itself, which an indexer can enumerate globally. The direct convention's `StateReader` instead
 * looks for data NFTs at a data-NFT covenant address that a per-call genesis never mints at, so per-call state
 * must be read through this module rather than through that address.
 *
 * The recorded state is still the shipped encoding: each commitment parses with `parsePushdataCommitment` at its
 * data-NFT index, so a caller reads the same values the constructor wrote, through the same decoder the direct
 * path uses.
 */

import {
  isMultiDataNftLayout,
  parsePushdataCommitment,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';

/** Raised when a per-call deployment's records cannot be read. */
export class PerCallRecordError extends Error {
  public readonly name = 'PerCallRecordError';

  public constructor(message: string) {
    super(message);
  }
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
 * A provider that lists by category is what makes a per-call deployment's records findable at all: the deployer's
 * lock is not derivable from the category, so a reader that only knew addresses could not find them.
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
 * Refuses rather than guessing when the provider cannot enumerate a category, since the records sit at a lock the
 * category does not derive.
 */
export async function readPerCallDeployment(
  provider: NetworkProvider,
  categoryId: string,
  layout: StateLayout,
): Promise<PerCallDeploymentSet> {
  const utxos = await utxosOfCategory(provider, categoryId);
  if (utxos === undefined) {
    throw new PerCallRecordError(
      `the provider cannot enumerate UTXOs by category, and category ${categoryId} carries the only link to the `
      + "per-call records (they sit at the deployer's lock, which the category does not derive)",
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
