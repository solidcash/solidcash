/**
 * phase-boundary extract: SC public-surface extract — getEntries collection enumeration.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { binToUtf8 } from '@bitauth/libauth/build/lib/format/utf8.js';
;
;
import { vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
;
;
;
import {
  attachDecodedAccessors,
  decodePackedEventArray,
  decodePushdataValue,
  FixedType,
  IntType,
  joinValueChunks,
  parseArrayTypeString,
  parseTypeStrict,
  parseValueChunkCommitment,
  sha256 as sha256Sync,
  VALUE_HEAD_SIZE,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import type { Contract } from '../Contract.js';
import { decodeEntryCommitment } from './SortedList.js';
import {
  getEntryNftAddress,
  getValueChunkAddress,
  resolveCollectionSignature,
} from './covenant-helpers.js';

export interface GetEntriesHost {
  readonly inner: Contract<any, any>;
  readonly categoryId: string;
}

export type CollectionEntryRow = {
  slot?: Uint8Array;
  key?: bigint | boolean | Uint8Array;
  keys?: Array<bigint | boolean | Uint8Array>;
  value: StateValue;
};

/**
 * Enumerate authenticated mutable entry NFTs for a mapping/array collection, reconstructing inline
 * and chunked values against the published collection signature.
 */
export async function getEntries(
  host: GetEntriesHost,
  collectionNameOrSignature: string,
): Promise<CollectionEntryRow[]> {
  const artifact = host.inner.artifact;
  const stateLayout = artifact.stateLayout;
  if (!stateLayout) {
    throw new Error(`Contract ${host.inner.name} is not a stateful contract`);
  }

  const collectionSignature = resolveCollectionSignature(artifact, collectionNameOrSignature);
  const collections = (stateLayout as StateLayout).collections ?? [];
  const collection = collections.find(
    (candidate: NonNullable<StateLayout['collections']>[number]) => (
      candidate.signature === collectionSignature
    ),
  );
  if (!collection) {
    throw new Error(`Unknown collection: ${collectionNameOrSignature}`);
  }

  const entryAddress = getEntryNftAddress(host.inner, host.categoryId, collectionSignature);
  const utxos = await host.inner.provider.getUtxos(entryAddress);

  const entryUtxos = utxos.filter((utxo) => (
    utxo.token
    && utxo.token.category === host.categoryId
    && utxo.token.nft
    && utxo.token.nft.capability === 'mutable'
    && utxo.token.nft.commitment.length > 0
  ));
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_COLLECTION_FETCH === '1') {
    console.error('collection-entries-read', {
      contract: artifact.contractName,
      collection: collection.name,
      categoryId: host.categoryId,
      entryAddress,
      utxos: entryUtxos.map((utxo) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        commitment: utxo.token?.nft?.commitment,
      })),
    });
  }

  const structs = stateLayout.structs;

  const entries: CollectionEntryRow[] = [];

  for (const utxo of entryUtxos) {
    try {
      const parsed = decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment));
      if (parsed.slot.every((byte) => byte === 0)) continue; // HEAD is structural, not a logical entry
      const type = collection.valueType;
      let raw = parsed.value;
      if (collection.chunkableValue && raw.length >= 4) {
        const len = raw[0] | (raw[1] << 8) | (raw[2] << 16) | (raw[3] << 24);
        if (len <= 60) {
          if (raw.length !== 4 + len) throw new RangeError('invalid inline vmap value length');
          raw = raw.slice(4);
        } else {
          if (raw.length !== 4 + 32 + VALUE_HEAD_SIZE) throw new RangeError('invalid chunked vmap value head');
          const root = raw.slice(4, 36);
          const headData = raw.slice(36);
          const chunkAddress = getValueChunkAddress(
            host.inner, host.categoryId, collection.name, parsed.slot, root,
          );
          const chunks = (await host.inner.provider.getUtxos(chunkAddress))
            .filter((chunk) => chunk.token?.category === host.categoryId
              && chunk.token?.nft?.capability === 'mutable'
              && !!chunk.token.nft.commitment)
            .map((chunk) => parseValueChunkCommitment(chunk.token!.nft!.commitment))
            .sort((a, b) => a.chunkIndex - b.chunkIndex);
          raw = joinValueChunks(headData, chunks, len);
          if (binToHex(sha256Sync(raw)) !== binToHex(root)) {
            throw new Error('vmap value chunks do not match the authenticated root');
          }
        }

      }
      let value: StateValue;
      if (collection.chunkableValue && type === 'bytes') value = raw;
      else if (collection.chunkableValue && type === 'string') value = binToUtf8(raw);
      else if (collection.chunkableValue) {
        const arrInfo = parseArrayTypeString(type);
        if (arrInfo) {
          value = raw.length === 0 ? []
            : attachDecodedAccessors(decodePackedEventArray(raw, 0, type, structs).value) as StateValue;
        } else {
          value = raw.length === 0 ? []
            : attachDecodedAccessors(decodePushdataValue(raw, 0, type, structs).value) as StateValue;
        }
      } else if (type === 'bool') value = vmNumberToBigInt(raw) !== 0n;
      else if (/^(u?int|bigint|[u]?fixed|enum)/.test(type)) {
        value = vmNumberToBigInt(raw);
        // Detect an out-of-range or negative value in a bounded int/fixed commitment, so a malicious commitment
        // cannot surface a negative `uint` mapping value in the SDK's accounting reads.
        const parsed = type.startsWith('enum') ? undefined : parseTypeStrict(type);
        if (typeof value === 'bigint'
          && (parsed instanceof IntType || parsed instanceof FixedType)
          && (value < parsed.minValue || value > parsed.maxValue)) {
          throw new Error(`getEntries: value ${value} out of range for type '${type}'`);
        }
      } else {
        try {
          value = attachDecodedAccessors(decodePushdataValue(raw, 0, type, structs).value) as StateValue;
        } catch { value = raw; }
      }
      entries.push({ slot: parsed.slot, value });
    } catch (e) {
      // Commitment doesn't parse for this collection - skip, but log for debugging
      console.warn('Warning: failed to parse entry commitment for UTXO', utxo.txid ?? 'unknown', e);
    }
  }

  return entries;
}
