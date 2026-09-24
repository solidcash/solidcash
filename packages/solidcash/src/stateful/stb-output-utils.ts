/**
 * phase-boundary extract: Shared STB output token/lock/commitment helpers.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binToHex } from '@bitauth/libauth';
import type { Output, UnlockableUtxo, Utxo } from '../interfaces.js';
import { addressToLockScript } from '../utils.js';

export const cloneToken = <T extends Utxo['token']>(token: T): T => (token === undefined
  ? token
  : { ...token, nft: token.nft === undefined ? undefined : { ...token.nft } } as T);

export function commitmentHexOf(value: Uint8Array | string | undefined): string {
  if (value instanceof Uint8Array) return binToHex(value);
  return value ?? '';
}

export function outputMatchesLock(
  output: { to?: Uint8Array | string } | undefined,
  lock: Uint8Array,
): boolean {
  let bytes = output?.to instanceof Uint8Array ? output.to : undefined;
  if (!bytes && typeof output?.to === 'string') {
    try {
      bytes = addressToLockScript(output.to);
    } catch {
      return false;
    }
  }
  return !!bytes
    && bytes.length === lock.length
    && bytes.every((byte, offset) => byte === lock[offset]);
}
