/**
 * Domain-separated canonical binary fingerprints.
 *
 * Identity digests must not be raw `JSON.stringify` hashes: key order is unstable across
 * engines for some shapes, and distinct digest purposes must not collide. Every fingerprint
 * starts with an explicit domain tag, then length-prefixed named fields, then SHA-256.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import { sha256 } from './hash.js';

/** Journal-disposition manifest digest domain. */
export const FINGERPRINT_DOMAIN_JOURNAL_DISPOSITION = 'solidcash.kernel-journal-disposition.v1';

/** Worklist / graph artifact execution-identity domain. */
export const FINGERPRINT_DOMAIN_ARTIFACT_EXECUTION = 'solidcash.artifact-execution-identity.v1';

export type FingerprintField = {
  name: string;
  value: Uint8Array | string;
};

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Encode one named field: u16 nameLen | name | u32 valueLen | value. */
export function encodeFingerprintField(name: string, value: Uint8Array | string): Uint8Array {
  const nameBytes = utf8ToBin(name);
  const valueBytes = typeof value === 'string' ? utf8ToBin(value) : value;
  if (nameBytes.length > 0xffff) {
    throw new Error('domain-fingerprint: field name too long');
  }
  if (valueBytes.length > 0xffffffff) {
    throw new Error('domain-fingerprint: field value too long');
  }
  const out = new Uint8Array(2 + nameBytes.length + 4 + valueBytes.length);
  out[0] = (nameBytes.length >> 8) & 0xff;
  out[1] = nameBytes.length & 0xff;
  out.set(nameBytes, 2);
  const vo = 2 + nameBytes.length;
  out[vo] = (valueBytes.length >>> 24) & 0xff;
  out[vo + 1] = (valueBytes.length >>> 16) & 0xff;
  out[vo + 2] = (valueBytes.length >>> 8) & 0xff;
  out[vo + 3] = valueBytes.length & 0xff;
  out.set(valueBytes, vo + 4);
  return out;
}

/**
 * Domain-separated SHA-256 fingerprint over ordered named fields.
 * Changing the domain or any field name/value changes the digest.
 */
export function domainSeparatedFingerprint(
  domain: string,
  fields: readonly FingerprintField[],
): string {
  if (domain.length === 0) {
    throw new Error('domain-fingerprint: domain must be non-empty');
  }
  const parts = [
    encodeFingerprintField('domain', domain),
    ...fields.map((field) => encodeFingerprintField(field.name, field.value)),
  ];
  return binToHex(sha256(concatBytes(parts)));
}

/** Recursively sort object keys for stable nested publication encoding. */
export function canonicalJsonValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => canonicalJsonValue(entry));
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = canonicalJsonValue(record[key]);
  }
  return sorted;
}

/** Stable UTF-8 JSON for nested identity slices (keys sorted recursively). */
export function canonicalJsonBytes(value: unknown): Uint8Array {
  return utf8ToBin(JSON.stringify(canonicalJsonValue(value)));
}

/**
 * Artifact execution identity for graph/worklist planning.
 * Domain-separated over bytecode, fingerprint, ABI selectors, messageBus, and stateLayout.
 */
export function artifactExecutionIdentityFingerprint(artifact: {
  contractName?: string;
  bytecode?: string;
  fingerprint?: string;
  abi?: unknown;
  messageBus?: unknown;
  stateLayout?: unknown;
}): string {
  return domainSeparatedFingerprint(FINGERPRINT_DOMAIN_ARTIFACT_EXECUTION, [
    { name: 'contractName', value: artifact.contractName ?? '' },
    { name: 'bytecode', value: artifact.bytecode ?? '' },
    { name: 'fingerprint', value: artifact.fingerprint ?? '' },
    { name: 'abi', value: canonicalJsonBytes(artifact.abi ?? []) },
    { name: 'messageBus', value: canonicalJsonBytes(artifact.messageBus ?? null) },
    { name: 'stateLayout', value: canonicalJsonBytes(artifact.stateLayout ?? null) },
  ]);
}
