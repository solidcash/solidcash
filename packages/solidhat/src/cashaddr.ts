/**
 * Minimal CashAddress (P2PKH) encoder for mock deployments.
 *
 * Mock contract addresses must be *valid* CashAddresses: suites decode them, re-encode them into event payloads and
 * compare them against signer addresses. A plausible-looking string with a broken checksum fails much later and much
 * less clearly than a missing one, so the encoding lives here rather than behind a placeholder.
 */
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

const GENERATOR = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n];

const polymod = (values: readonly number[]): bigint => {
  let checksum = 1n;
  for (const value of values) {
    const top = checksum >> 35n;
    checksum = ((checksum & 0x07ff_ffff_ffn) << 5n) ^ BigInt(value);
    for (let bit = 0; bit < 5; bit += 1) {
      if (((top >> BigInt(bit)) & 1n) === 1n) checksum ^= GENERATOR[bit];
    }
  }
  return checksum ^ 1n;
};

/** Expand the human-readable prefix the way cashaddr checksums require. */
const prefixValues = (prefix: string): number[] =>
  [...prefix].map((char) => char.charCodeAt(0) & 0x1f).concat([0]);

/** Convert 8-bit data to 5-bit groups, padded as cashaddr specifies. */
const toFiveBit = (bytes: Uint8Array): number[] => {
  const result: number[] = [];
  let accumulator = 0;
  let bits = 0;
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result.push((accumulator >> bits) & 0x1f);
    }
  }
  if (bits > 0) result.push((accumulator << (5 - bits)) & 0x1f);
  return result;
};

export type CashAddressPrefix = 'bitcoincash' | 'bchtest' | 'bchreg';

/**
 * Encode a P2PKH CashAddress.
 *
 * @param hash160 - 20-byte public key hash.
 * @param prefix - network prefix (defaults to `bchtest`, the mock/test network).
 */
export function encodeP2pkhCashAddress(hash160: Uint8Array, prefix: CashAddressPrefix = 'bchtest'): string {
  if (hash160.length !== 20) throw new Error(`P2PKH CashAddress needs a 20-byte hash, received ${hash160.length}`);
  // Version byte 0x00 = P2PKH, then the hash, then the 40-bit checksum.
  const payload = toFiveBit(Uint8Array.from([0x00, ...hash160]));
  const checksum = polymod([...prefixValues(prefix), ...payload, 0, 0, 0, 0, 0, 0, 0, 0]);
  // Eight 5-bit checksum symbols, most significant first.
  const checksumValues: number[] = [];
  for (let shift = 7; shift >= 0; shift -= 1) {
    checksumValues.push(Number((checksum >> BigInt(shift * 5)) & 0x1fn));
  }
  const body = [...payload, ...checksumValues].map((value) => CHARSET[value]).join('');
  return `${prefix}:${body}`;
}
