/**
 * BCMR publication outputs (CHIP-BCMR, "Metadata Registry Publication Outputs").
 *
 * A publication is `OP_RETURN <'BCMR'> <sha256(registry)> [<uri> ...]`. A transaction's first output with that prefix
 * is its only publication, and relay policy caps the data-carrier bytes of one transaction at 223, so the builder
 * refuses a URI list that does not fit.
 */

import { utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { sha256 } from '@solidcash/utils';
import type { Output } from '../interfaces.js';

/** Raised when metadata cannot be published as asked. */
export class BcmrError extends Error {
  public readonly name = 'BcmrError';

  public constructor(message: string) {
    super(message);
  }
}

/** `OP_RETURN <'BCMR'>`, the locking bytecode prefix every publication output starts with. */
export const BCMR_PUBLICATION_PREFIX = Uint8Array.of(0x6a, 0x04, 0x42, 0x43, 0x4d, 0x52);

/** Relay policy's cap on the data-carrier bytes of one transaction (libauth `maximumDataCarrierBytes`). */
export const MAXIMUM_DATA_CARRIER_BYTES = 223;

const OP_RETURN = 0x6a;

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** True when `lockingBytecode` is a data carrier, which relay policy counts against the 223-byte cap. */
export function isDataCarrier(lockingBytecode: Uint8Array): boolean {
  return lockingBytecode.length > 0 && lockingBytecode[0] === OP_RETURN;
}

/** True when `lockingBytecode` starts with the publication prefix. */
export function isPublicationBytecode(lockingBytecode: Uint8Array): boolean {
  return lockingBytecode.length >= BCMR_PUBLICATION_PREFIX.length
    && BCMR_PUBLICATION_PREFIX.every((byte, index) => lockingBytecode[index] === byte);
}

/** The bytes relay policy counts for a data-carrier output: its locking bytecode and its length prefix. */
export function dataCarrierBytes(lockingBytecode: Uint8Array): number {
  return isDataCarrier(lockingBytecode) ? lockingBytecode.length + 1 : 0;
}

/** How a URI is pushed: an HTTPS URI loses its protocol, which clients assume; every other URI is pushed whole. */
export function encodePublicationUri(uri: string): string {
  if (uri.length === 0) throw new BcmrError('a publication URI is empty');
  return /^https:\/\//i.test(uri) ? uri.slice('https://'.length) : uri;
}

/** The locking bytecode of a publication of `hash`, offering each URI in order. */
export function publicationBytecode(hash: Uint8Array, uris: readonly string[]): Uint8Array {
  if (hash.length !== 32) throw new BcmrError(`a registry hash is 32 bytes, got ${hash.length}`);
  return concat([
    Uint8Array.of(OP_RETURN),
    encodeDataPush(utf8ToBin('BCMR')),
    encodeDataPush(hash),
    ...uris.map((uri) => encodeDataPush(utf8ToBin(encodePublicationUri(uri)))),
  ]);
}

/**
 * The publication output for `hash`, refused when it would take the transaction's data-carrier bytes past the relay
 * cap together with `otherDataCarrierBytes` (another data carrier in the same transaction).
 */
export function publicationOutput(hash: Uint8Array, uris: readonly string[], otherDataCarrierBytes = 0): Output {
  const bytecode = publicationBytecode(hash, uris);
  const total = dataCarrierBytes(bytecode) + otherDataCarrierBytes;
  if (total > MAXIMUM_DATA_CARRIER_BYTES) {
    throw new BcmrError(
      `the publication takes ${total} data-carrier bytes, over the ${MAXIMUM_DATA_CARRIER_BYTES}-byte relay cap: `
      + 'offer fewer or shorter URIs',
    );
  }
  return { to: bytecode, amount: 0n };
}

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

function base32(bytes: Uint8Array): string {
  let buffer = 0;
  let bits = 0;
  let out = '';
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32[(buffer >> bits) & 31];
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += BASE32[(buffer << (5 - bits)) & 31];
  return out;
}

/**
 * The CIDv1 of `content` stored as one raw IPFS block (`bafkrei...`): version 1, the raw codec and a SHA-256
 * multihash. It is the CID an IPFS node gives a file of one block added with raw leaves, and its digest is the same
 * SHA-256 a publication carries.
 */
export function ipfsCidV1Raw(content: Uint8Array): string {
  return `b${base32(concat([Uint8Array.of(0x01, 0x55, 0x12, 0x20), sha256(content)]))}`;
}
