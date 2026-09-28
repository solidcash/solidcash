/**
 * Genesis-outpoint reservations.
 *
 * A token category is created by spending a genesis-eligible UTXO - one at output index 0 that the SDK can spend -
 * and a contract that creates another contract needs the child's address before its transaction exists, because that
 * address is `addrV(category)` of the category the child's genesis will mint. The caller therefore reserves the
 * UTXO whose txid will be that category. A reservation is process-local and holds the outpoint out of genesis
 * funding selection until it is released, so a later send cannot spend a coin an address was already derived from.
 */

import { onMockNetworkProviderReset } from '../network/MockNetworkProvider.js';

const reserved = new Set<string>();

/** The `txid:vout` key an outpoint is reserved by. */
export function genesisOutpointKey(txid: string, vout: number): string {
  return `${txid}:${vout}`;
}

/** True when genesis funding selection must treat this outpoint as unavailable. */
export function isReservedGenesisOutpoint(outpoint: string): boolean {
  return reserved.has(outpoint);
}

/** Hold an outpoint out of genesis funding selection. Reserving twice is a no-op. */
export function reserveGenesisOutpoint(outpoint: string): void {
  reserved.add(outpoint);
}

/** Release a reservation, so the outpoint becomes selectable again. */
export function releaseGenesisOutpoint(outpoint: string): void {
  reserved.delete(outpoint);
}

/** The reserved outpoints, for a caller that pairs a snapshot with the chain state it was taken over. */
export function snapshotGenesisReservations(): readonly string[] {
  return [...reserved];
}

/** Puts the reserved set back to a snapshot's, releasing everything reserved since it was taken. */
export function restoreGenesisReservations(outpoints: readonly string[]): void {
  reserved.clear();
  for (const outpoint of outpoints) reserved.add(outpoint);
}

/** Releases every reservation. */
export function clearGenesisReservations(): void {
  reserved.clear();
}

// A reservation names a coin's outpoint, so it is only meaningful for the chain it was made against: once the mock
// chain is rewound or wiped, the coins it held are a different chain's, and keeping them would hold a live funding
// coin out of the selection a caller is selecting from now.
onMockNetworkProviderReset(() => {
  clearGenesisReservations();
});
