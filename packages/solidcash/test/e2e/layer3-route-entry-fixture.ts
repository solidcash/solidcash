import { binToHex } from '@bitauth/libauth';
import { encodeEntryCommitment, slotValueToBytes } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import {
  createEntryNftUnlocker, getEntryNftAddress,
} from '../../src/stateful/covenant-helpers.js';
import type { Contract, TransactionBuilder } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';

interface EntryAccess { collection: string }
interface RouteWithEntries { entryAccesses?: EntryAccess[] }

/**
 * Stage the authenticated empty-collection head required by every entry slot published by a route.
 * The returned array follows `route.entryAccesses`, which is the compiler's authoritative entry-slot order.
 */
export async function stageEmptyRouteEntries(
  provider: { addUtxo(address: string, utxo: Utxo): Promise<Utxo> },
  participant: Contract,
  categoryId: string,
  route: RouteWithEntries,
): Promise<Utxo[]> {
  const zero = slotValueToBytes(0n);
  const emptyHead = binToHex(encodeEntryCommitment(zero, zero));
  return Promise.all((route.entryAccesses ?? []).map(({ collection }) => {
    const address = getEntryNftAddress(participant, categoryId, collection);
    return provider.addUtxo(address, randomUtxo({
      satoshis: 10_000n,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'mutable', commitment: emptyHead },
      },
    }));
  }));
}

/** Add one compiler-published entry slot, preserving its authenticated commitment unchanged. */
export function addRouteEntrySlot(
  tx: TransactionBuilder,
  participant: Contract,
  categoryId: string,
  route: RouteWithEntries,
  staged: readonly Utxo[],
  index: number,
): void {
  const access = route.entryAccesses?.[index];
  const utxo = staged[index];
  if (access === undefined || utxo === undefined) {
    throw new Error(`route entry slot ${index} was not staged from entryAccesses`);
  }
  const address = getEntryNftAddress(participant, categoryId, access.collection);
  tx.addInput(utxo, createEntryNftUnlocker(participant, 0, categoryId, access.collection));
  tx.addOutput({
    to: address,
    amount: utxo.satoshis,
    token: {
      category: categoryId,
      amount: 0n,
      nft: { capability: 'mutable', commitment: utxo.token!.nft!.commitment },
    },
  });
}
