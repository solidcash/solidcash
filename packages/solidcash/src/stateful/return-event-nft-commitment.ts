import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { sha256 } from '@solidcash/utils';

/** CashTokens commitments fit at most 128 bytes; keep the raw return in the pending record for decoding. */
export const returnEventNftCommitment = (raw: Uint8Array): string => (
  binToHex(raw.length > 128 ? sha256(raw) : raw)
);
