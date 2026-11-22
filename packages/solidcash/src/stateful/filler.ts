import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  FILLER_SATOSHIS, buildFillerCovenantScript, fillerLockingBytecode, scriptToBytecode,
} from '@solidcash/utils';
import type { Output, Unlocker } from '../interfaces.js';

const FILLER_LOCK_HEX = binToHex(fillerLockingBytecode());

/** The relative lock of a filler, in blocks: its input needs at least this nSequence. */
export const FILLER_SEQUENCE = 144;

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

/**
 * Unlocks a filler output. The script needs no signature: the unlocking bytecode only pushes the redeem script.
 * Add the input with `{ sequence: FILLER_SEQUENCE }` once the filler has 144 confirmations.
 */
export function fillerUnlocker(): Unlocker {
  return {
    generateLockingBytecode: () => fillerLockingBytecode(),
    generateUnlockingBytecode: () => scriptToBytecode([scriptToBytecode(buildFillerCovenantScript())]),
  };
}
