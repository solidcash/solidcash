import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { sha256 } from '@solidcash/utils';
import { callRecordCommitment, parseCallRecord } from './call-record.js';

/**
 * A return carrier's commitment for the raw result kept in the pending record. A direct call's carrier is its
 * call record (`digest` given); a routed or framed one holds the result, or its SHA256 past 128 bytes.
 */
export const returnEventNftCommitment = (raw: Uint8Array, digest?: Uint8Array): string => {
  if (digest === undefined) return binToHex(raw.length > 128 ? sha256(raw) : raw);
  // A record whose result is not yet recovered is kept as the callee pinned it.
  const record = parseCallRecord(raw);
  if (record !== undefined && binToHex(record.digest) === binToHex(digest)) return binToHex(raw);
  return binToHex(callRecordCommitment(raw, digest));
};
