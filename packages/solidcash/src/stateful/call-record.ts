/**
 * Direct call records (docs/wip/call-records/DESIGN.md). A direct callee's return carrier commits to the call it
 * answers: the call's digest, a form byte, then the result inline (form 1) or its SHA256 (form 2), whose bytes
 * the caller takes from its preimage witness. The compiler computes the same digest on both sides of the call.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  bigIntToVmNumber, vmNumberToBigInt,
} from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import { sha256, type AbiFunction, type EnumDefinitionAbi, type StructDefinitionInfo } from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';

export const CALL_RECORD_DIGEST_BYTES = 32;

/** The widest result a record carries inline, after its digest and form byte, in a 128-byte commitment. */
export const CALL_RECORD_INLINE_RESULT_BYTES = 128 - CALL_RECORD_DIGEST_BYTES - 1;

const INLINE_FORM = 0x01;
const HASHED_FORM = 0x02;

const NUMERIC_TYPE = /^(bool|bigint|u?int\d*|u?fixed(\d+x\d+)?)$/;

/** True when the record of a result this wide carries its SHA256, not its bytes. */
export function callRecordHashesResult(raw: Uint8Array): boolean {
  return raw.length > CALL_RECORD_INLINE_RESULT_BYTES;
}

/**
 * The digest of a call: SHA256 of its ordinal as two little-endian bytes, its selector, and each argument as its
 * length in two little-endian bytes and its bytes, a number minimally encoded. A signature authorizes the
 * transaction the record is part of, so it is no argument of the digest.
 */
export function callRecordDigest(
  abiFunction: Pick<AbiFunction, 'inputs' | 'selector'>, params: readonly FunctionArgument[],
  options: { readonly structs?: readonly StructDefinitionInfo[]; readonly enums?: readonly EnumDefinitionAbi[] } = {},
  ordinal = 0,
): Uint8Array | undefined {
  if (abiFunction.selector === undefined) return undefined;
  const parts: number[] = [ordinal & 0xff, (ordinal >> 8) & 0xff, ...hexToBin(abiFunction.selector)];
  for (const [index, input] of abiFunction.inputs.entries()) {
    if (input.name.startsWith('__internal__') || input.type === 'sig') continue;
    const encoded = encodeFunctionArgument(params[index] as FunctionArgument, input.type, options.structs);
    if (!(encoded instanceof Uint8Array)) return undefined;
    const numeric = NUMERIC_TYPE.test(input.type)
      || options.enums?.some((definition) => definition.name === input.type) === true;
    const bytes = numeric ? bigIntToVmNumber(vmNumberToBigInt(encoded, { requireMinimalEncoding: false }) as bigint)
      : encoded;
    parts.push(bytes.length & 0xff, (bytes.length >> 8) & 0xff, ...bytes);
  }
  return sha256(Uint8Array.from(parts));
}

/** A record's commitment: the digest, then the result inline or its SHA256. */
export function callRecordCommitment(raw: Uint8Array, digest: Uint8Array): Uint8Array {
  const field = callRecordHashesResult(raw) ? Uint8Array.of(HASHED_FORM, ...sha256(raw))
    : Uint8Array.of(INLINE_FORM, ...raw);
  return Uint8Array.of(...digest, ...field);
}

/** A record's parts, or undefined when `record` is no call record. */
export function parseCallRecord(record: Uint8Array): {
  readonly digest: Uint8Array; readonly raw?: Uint8Array; readonly hash?: Uint8Array;
} | undefined {
  if (record.length < CALL_RECORD_DIGEST_BYTES + 1) return undefined;
  const digest = record.slice(0, CALL_RECORD_DIGEST_BYTES);
  const form = record[CALL_RECORD_DIGEST_BYTES];
  const field = record.slice(CALL_RECORD_DIGEST_BYTES + 1);
  if (form === INLINE_FORM && field.length <= CALL_RECORD_INLINE_RESULT_BYTES) return { digest, raw: field };
  if (form === HASHED_FORM && field.length === 32) return { digest, hash: field };
  return undefined;
}
