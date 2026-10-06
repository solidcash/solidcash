import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin, sha256, utf8ToBin } from '@bitauth/libauth';
import {
  buildDataNftCovenantScript, buildPushdataCommitment, parsePushdataCommitment, scriptToBytecode, type StateLayout,
} from '@solidcash/utils';
import type { Utxo } from '../../../src/interfaces.js';
import type NetworkProvider from '../../../src/network/NetworkProvider.js';
import { mappingValueChunkLock } from '../../../src/per-call/composer/mapping-plan.js';
import {
  PerCallRecordError, classifyPerCallDeployment, readPerCallDeployment, readPerCallState,
  stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/per-call/deploy/records.js';
import { scriptToLockingBytecode } from '../../../src/utils.js';

/**
 * Classifying a per-call deployment's live UTXOs, and what makes its records findable.
 *
 * A per-call genesis mints its records at the data-NFT covenant its category derives, but a reader reaches every
 * pool the same way: by enumerating the contract's category. A master is the category's minting NFT, a validator
 * is a mutable NFT with no commitment, and a record is a mutable NFT at the data-NFT covenant whose commitment
 * decodes as the layout's state encoding. These cases pin that classification, and the refusal when a provider
 * cannot enumerate a category at all, which is what tells the three kinds apart.
 */

const LAYOUT: StateLayout = {
  variables: [{ name: 'implementation', type: 'address', nftIndex: 0, fieldIndex: 0 }],
  dataNftCount: 1,
  commitmentLimit: 128,
};

const CATEGORY = '33'.repeat(31) + 'cc';
const RECORD_COMMITMENT = buildPushdataCommitment(LAYOUT, { implementation: new Uint8Array(35).fill(0xab) }, 0);

const utxo = (vout: number, token?: Utxo['token']): Utxo =>
  ({ txid: 'aa'.repeat(31) + '55', vout, satoshis: 1200n, ...(token === undefined ? {} : { token }) });
const nft = (
  category: string, capability: 'none' | 'mutable' | 'minting', commitment: string,
): NonNullable<Utxo['token']> => ({ category, amount: 0n, nft: { capability, commitment } });

/** A provider that answers one category, and only when it is asked for it. */
function categoryProvider(utxos: readonly Utxo[]): NetworkProvider {
  return {
    getUtxos: async () => [],
    getUtxosByTokenCategory: async (categoryId: string) => (
      categoryId === CATEGORY ? [...utxos] : []
    ),
  } as unknown as NetworkProvider;
}

describe('a per-call state record\'s lock and spend', () => {
  it('derives the lock from the data-NFT covenant the category seeds', () => {
    const covenant = scriptToBytecode(buildDataNftCovenantScript(hexToBin(CATEGORY)));
    expect([...stateRecordLockingBytecode(CATEGORY)])
      .toStrictEqual([...scriptToLockingBytecode(buildDataNftCovenantScript(hexToBin(CATEGORY)), 'p2sh32')]);
    // The spend pushes the covenant as its redeem script, so the record's own lock is what the covenant hashes to.
    expect([...stateRecordUnlockingBytecode(CATEGORY, 0, 1).slice(-covenant.length)]).toStrictEqual([...covenant]);
  });
});

describe('classifying a per-call deployment by category', () => {
  it('separates the master pool, the validator pool and the state records', () => {
    const set = classifyPerCallDeployment([
      utxo(0, nft(CATEGORY, 'minting', '')),
      utxo(1, nft(CATEGORY, 'mutable', '')),
      utxo(2, nft(CATEGORY, 'mutable', RECORD_COMMITMENT)),
      utxo(3),
    ], LAYOUT);

    expect(set.masters.map((entry) => entry.vout)).toStrictEqual([0]);
    expect(set.validators.map((entry) => entry.vout)).toStrictEqual([1]);
    expect(set.records.map((entry) => entry.vout)).toStrictEqual([2]);
  });

  it('orders the records by data-NFT index, not by outpoint', () => {
    const multi: StateLayout = {
      variables: [
        { name: 'a', type: 'int256', nftIndex: 0, fieldIndex: 0 },
        { name: 'b', type: 'int256', nftIndex: 1, fieldIndex: 0 },
      ],
      dataNftCount: 2,
      commitmentLimit: 128,
    };
    const zero = buildPushdataCommitment(multi, { a: 0n }, 0);
    const one = buildPushdataCommitment(multi, { b: 0n }, 1);

    // The tags are what disambiguate the two records, so outpoint order must not decide the index.
    const set = classifyPerCallDeployment([
      utxo(9, nft(CATEGORY, 'mutable', one)),
      utxo(2, nft(CATEGORY, 'mutable', zero)),
    ], multi);

    expect(set.records.map((entry) => entry.vout)).toStrictEqual([2, 9]);
  });

  it('takes a record only at the data-NFT covenant, not a value chunk whose commitment parses as one', () => {
    const store: StateLayout = {
      variables: [
        { name: 'owner', type: 'address', nftIndex: 0, fieldIndex: 0 },
        { name: 'judge', type: 'address', nftIndex: 0, fieldIndex: 1 },
        { name: 'count', type: 'uint32', nftIndex: 0, fieldIndex: 2 },
        { name: 'total', type: 'int256', nftIndex: 1, fieldIndex: 0 },
      ],
      dataNftCount: 2,
      commitmentLimit: 128,
    };
    const key = (label: string): Uint8Array => sha256.hash(utf8ToBin(label));
    // A long mapping value's chunk: its empty push, 32-byte push and empty push parse as record 0's fields.
    const chunk = `000020${binToHex(utf8ToBin('a note long enough to be chunked'))}00`;
    expect(() => parsePushdataCommitment(chunk, store, 0)).not.toThrow();
    const at = (vout: number, lockingBytecode: Uint8Array, commitment: string): Utxo =>
      ({ ...utxo(vout, nft(CATEGORY, 'mutable', commitment)), lockingBytecode });
    const recordLock = stateRecordLockingBytecode(CATEGORY);
    const owners = { owner: key('owner').slice(0, 20), judge: key('judge').slice(0, 20), count: 3n };

    const set = classifyPerCallDeployment([
      at(4, recordLock, buildPushdataCommitment(store, owners, 0)),
      at(2, mappingValueChunkLock(hexToBin(CATEGORY), 'notes', { slot: key('notes 7'), root: key('root') }), chunk),
      at(7, recordLock, buildPushdataCommitment(store, { total: 5n }, 1)),
    ], store);

    expect(set.records.map((entry) => entry.vout)).toStrictEqual([4, 7]);
    expect(set.collectionNodes.map((entry) => entry.vout)).toStrictEqual([2]);
  });

  it('refuses when the provider cannot enumerate the category the records are found by', async () => {
    const addressOnly = { getUtxos: async () => [] } as unknown as NetworkProvider;
    await expect(readPerCallDeployment(addressOnly, CATEGORY, LAYOUT)).rejects.toBeInstanceOf(PerCallRecordError);
  });
});

describe('reading a per-call deployment\'s state by category', () => {
  it('decodes each data NFT through the shipped decoder', async () => {
    const state = await readPerCallState(categoryProvider([
      utxo(2, nft(CATEGORY, 'mutable', RECORD_COMMITMENT)),
    ]), CATEGORY, LAYOUT);

    expect(state.byNft.length).toBe(1);
    expect([...(state.byNft[0]!.implementation as Uint8Array)]).toStrictEqual([...new Uint8Array(35).fill(0xab)]);
  });

  it('refuses rather than defaulting when a record is missing', async () => {
    await expect(readPerCallState(categoryProvider([]), CATEGORY, LAYOUT)).rejects
      .toBeInstanceOf(PerCallRecordError);
  });
});
