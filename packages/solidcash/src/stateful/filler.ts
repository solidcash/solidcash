import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { FILLER_SATOSHIS, fillerLockingBytecode } from '@solidcash/utils';
import type { Output } from '../interfaces.js';

const FILLER_LOCK_HEX = binToHex(fillerLockingBytecode());

/**
 * The output a coin leaves at its index when nothing succeeds it there (a drained container, a kept change index,
 * the reverse-indexed suffix separator). Anyone may sweep it after 144 blocks, as an event NFT.
 */
export function fillerOutput(): Output {
  return { to: fillerLockingBytecode(), amount: FILLER_SATOSHIS };
}

/** True when `to` is the filler lock, as bytes or hex. */
export function isFillerLockingBytecode(to?: Uint8Array | string): boolean {
  if (to instanceof Uint8Array) return to.length === 35 && binToHex(to) === FILLER_LOCK_HEX;
  if (typeof to === 'string') {
    const hex = to.startsWith('0x') ? to.slice(2) : to;
    return hex.toLowerCase() === FILLER_LOCK_HEX;
  }
  return false;
}
