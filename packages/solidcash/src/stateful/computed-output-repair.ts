import { binToHex, hexToBin } from '@bitauth/libauth';
import { isScidIdentityCommitment } from './logical-identity.js';
import { isEmptyValueEntryCommitment } from './SortedList.js';

/**
 * Whether a probe-observed NFT output may replace the builder's current commitment.
 * Event NFTs use capability `none` and can exceed the 40/128-byte relay default when the
 * mock provider advertises a higher `maximumNftCommitmentBytes`.
 */
export function isRepairableNftOutput(
  capability: string | undefined,
  commitmentBytes: number,
  maxCommitmentBytes: number,
): boolean {
  if (capability !== 'mutable' && capability !== 'none') return false;
  return commitmentBytes >= 3 && commitmentBytes <= maxCommitmentBytes;
}

/** Four-byte `SCID` tag on an empty none-cap p2sh32. Not a v1 identity (`SCID` + version + lock). */
export function isScidPlaceholderCommitment(commitment: string | Uint8Array | undefined): boolean {
  if (commitment === undefined) return false;
  const hex = typeof commitment === 'string' ? commitment : binToHex(commitment);
  return hex.toLowerCase() === '53434944';
}

export type RepairedNftApply = 'skip' | 'apply-lock-and-commit' | 'apply-commit';

/**
 * Send-time OTC / OUTPUTBYTECODE repair: write the covenant's authenticated
 * commitment onto the output. Mutable value-chunks/entries keep the previous
 * 128-byte collapse guard. None-cap event slots may only replace empty or the
 * four-byte SCID stub — never a real `SCID` v1 identity.
 */
export function canApplyRepairedNftCommitment(args: {
  capability: string | undefined;
  currentCommitmentHex: string;
  proposed: Uint8Array;
  hasLockingBytecode: boolean;
}): RepairedNftApply {
  const { capability, currentCommitmentHex, proposed, hasLockingBytecode } = args;
  if (capability !== 'mutable' && capability !== 'none') return 'skip';
  if (isScidIdentityCommitment(currentCommitmentHex) || isScidIdentityCommitment(proposed)) {
    return 'skip';
  }
  if (proposed.length < 3 || proposed.length > 128) return 'skip';
  const proposedHex = binToHex(proposed);
  if (capability === 'mutable') {
    const currentLen = currentCommitmentHex.length === 0 ? 0 : hexToBin(currentCommitmentHex).length;
    if (isEmptyValueEntryCommitment(proposed) && currentLen > 128) return 'skip';
    if (hasLockingBytecode) return 'apply-lock-and-commit';
    if (proposed.length >= 32 && proposedHex !== currentCommitmentHex) return 'apply-commit';
    return 'skip';
  }
  const currentEmpty = currentCommitmentHex === ''
    || /^(00)+$/.test(currentCommitmentHex)
    || isScidPlaceholderCommitment(currentCommitmentHex);
  if (!currentEmpty || proposedHex === currentCommitmentHex) return 'skip';
  return hasLockingBytecode ? 'apply-lock-and-commit' : 'apply-commit';
}
