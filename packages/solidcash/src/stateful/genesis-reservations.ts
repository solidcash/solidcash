/**
 * Genesis-outpoint reservations.
 *
 * A token category is created by spending a genesis-eligible UTXO - one at output index 0 that the SDK can spend -
 * and a contract that creates another contract needs the child's address before its transaction exists, because that
 * address is `addrV(category)` of the category the child's genesis will mint. The caller therefore reserves the
 * UTXO whose txid will be that category. A reservation is process-local and holds the outpoint out of genesis
 * funding selection until it is released, so a later send cannot spend a coin an address was already derived from.
 */

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
