/**
 * phase-boundary extract: legacy JobEvent wire adapters + struct-argument encoding
 * (phase-boundary extract from StatefulContract.ts).
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { binToUtf8, utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import type { Artifact } from '@solidcash/utils';
import { decodePushdataValue, encodePushdataValue } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { addressToLockScript } from '../utils.js';

export function isLockingBytecode(bytes: Uint8Array): boolean {
  return (bytes.length === 35 && bytes[0] === 0xaa && bytes[1] === 0x20 && bytes[34] === 0x87)
    || (bytes.length === 23 && bytes[0] === 0xa9 && bytes[1] === 0x14 && bytes[22] === 0x87)
    || (bytes.length === 25 && bytes[0] === 0x76 && bytes[1] === 0xa9
      && bytes[2] === 0x14 && bytes[23] === 0x88 && bytes[24] === 0xac);
}


export function p2pkhLockingBytecode(pkh: Uint8Array): Uint8Array {
  const out = new Uint8Array(25);
  out[0] = 0x76; out[1] = 0xa9; out[2] = 0x14;
  out.set(pkh, 3);
  out[23] = 0x88; out[24] = 0xac;
  return out;
}


export function normalizeJobEventAddresses(
  decoded: unknown, type: string, structs: Artifact['structs'],
): typeof decoded {
  const structName = type.endsWith('[]') ? type.slice(0, -2) : type;
  const def = structs?.find((candidate) => candidate.name === structName);
  if (!def?.fields.some((field) => field.name === 'address_' && field.type === 'bytes')) return decoded;
  const rows = Array.isArray(decoded) ? decoded : [decoded];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const raw = record.address_;
    let bytes: Uint8Array | undefined;
    if (raw instanceof Uint8Array) bytes = raw;
    else if (typeof raw === 'string') {
      if (raw.includes(':')) {
        try { bytes = addressToLockScript(raw); } catch { bytes = utf8ToBin(raw); }
      } else if (raw.startsWith('0x') && raw.length % 2 === 0) bytes = hexToBin(raw.slice(2));
      else bytes = utf8ToBin(raw);
    }
    if (!bytes || bytes.length === 0) continue;
    if (!isLockingBytecode(bytes)) {
      try {
        const text = binToUtf8(bytes);
        if (text.includes(':')) bytes = addressToLockScript(text);
      } catch { /* not UTF-8 */ }
    }
    if (bytes.length === 20) bytes = p2pkhLockingBytecode(bytes);
    record.address_ = bytes;
  }
  return decoded;
}


export function encodeStructArgument(
  value: FunctionArgument, typeName: string, structs: Artifact['structs'],
  timestamp?: bigint, legacyJobEventCompatibility = false,
): Uint8Array {
  let decodedValue: FunctionArgument = value;
  if (value instanceof Uint8Array) {
    try {
      const decoded = decodePushdataValue(value, 0, typeName, structs);
      if (decoded.bytesConsumed !== value.length) return value;
      decodedValue = decoded.value as FunctionArgument;
    } catch {
      return value;
    }
  }
  const struct = structs?.find((candidate) => candidate.name === typeName);
  const canonicalValue = Array.isArray(decodedValue) && struct
    ? Object.fromEntries(struct.fields.map((field, index) => [field.name, decodedValue[index]]))
    : decodedValue;
  if (canonicalValue && typeof canonicalValue === 'object' && !Array.isArray(canonicalValue)) {
    const record = { ...(canonicalValue as Record<string, unknown>) };
    // This historical wire adapter runs only when the caller selects it. Ordinary values are derived from
    // compiler-authenticated flow and must never change because a field happens to have an application spelling.
    if (legacyJobEventCompatibility && (
      (record.timestamp_ === 0 || record.timestamp_ === 0n || record.timestamp_ === undefined)
    )) {
      record.timestamp_ = timestamp !== undefined && timestamp > 0n
        ? timestamp : BigInt(Math.floor(Date.now() / 1000));
    }
    if (legacyJobEventCompatibility) {
      normalizeJobEventAddresses(record, typeName, structs);
    }
    return encodePushdataValue(record as never, typeName, structs);
  }
  return encodePushdataValue(canonicalValue as never, typeName, structs);
}
