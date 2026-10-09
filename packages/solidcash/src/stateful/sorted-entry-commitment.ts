/**
 * phase-boundary extract: Sorted-entry / PredOut commitment classifiers.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import { encodeEntryCommitment } from './SortedList.js';

export const SLOT_HEX = 64;

/** True for an unfilled sorted-list HEAD (empty or 32-byte slot 0). */
export function isSortedEntryHeadCommitment(commitment: string): boolean {
  if (commitment === '' || commitment === '00') return true;
  const hex = commitment.toLowerCase();
  if (hex.replace(/0/g, '') === '') return true;
  return hex.length >= SLOT_HEX && hex.slice(0, SLOT_HEX) === '0'.repeat(SLOT_HEX);
}
/** Data-NFT pushdata tag (00/51/52/53 + payload), not a sorted-list HEAD or NEW. */
export function isDataNftIndexCommitment(commitment: string): boolean {
  const hex = commitment.toLowerCase();
  if (hex.length < 4 || isSortedEntryHeadCommitment(hex)) return false;
  return /^(00|51|52|53)/.test(hex) && !isSortedEntryNodeCommitment(hex);
}
/** True for a 32-byte slot-prefixed entry node, not a data-NFT index tag. */
export function isSortedEntryNodeCommitment(commitment: string): boolean {
  const hex = commitment.toLowerCase();
  if (hex.length < SLOT_HEX) return false;
  if (hex.startsWith('00') || hex.startsWith('51') || hex.startsWith('52') || hex.startsWith('53')) {
    return false;
  }
  return true;
}
/** P' is slot(P)||slot(NEW)||value(P). Empty-value collections are 64 bytes, not 128. */
export function synthesizePredNewCommitment(inputCommitment: string, newNodeCommitment: string): string {
  const inputHex = inputCommitment.length >= SLOT_HEX ? inputCommitment : inputCommitment.padEnd(SLOT_HEX, '0');
  const slot = hexToBin(inputHex.slice(0, SLOT_HEX).padEnd(SLOT_HEX, '0'));
  const next = hexToBin(newNodeCommitment.slice(0, SLOT_HEX).padEnd(SLOT_HEX, '0'));
  const rawValue = inputHex.length > SLOT_HEX * 2 ? hexToBin(inputHex.slice(SLOT_HEX * 2)) : new Uint8Array();
  const value = rawValue.every((byte) => byte === 0) ? new Uint8Array() : rawValue;
  return binToHex(encodeEntryCommitment(slot, next, value));
}
