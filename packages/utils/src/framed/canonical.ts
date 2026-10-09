/**
 * Canonical byte encodings for arguments, results and addresses.
 *
 * Every value has exactly one byte string, so a caller's hash of what it computed and a callee's hash of what it
 * received can never differ for the same logical value:
 *
 *   - integers are minimal script numbers, `bool` is 0 or 1 as a script number;
 *   - `bytesN`, `bytes` and `string` are their raw bytes;
 *   - structs and arrays use the flattened argument encoding the compiler already emits for calls;
 *   - a user's address is its 25-byte P2PKH locking bytecode, a contract's its 35-byte P2SH32 `addrV` lock.
 *
 * A call's call data is the concatenation of each argument's minimal push, with the last parameter's push first
 * and the first parameter's push last. These are exactly the bytes between the witness block and the redeem
 * script in the callee's unlocking bytecode, and `encodeCallDataArguments` produces them from values named in
 * parameter order. A callee's compiled body reads its parameters off the stack, where the argument pushed last
 * sits on top, so the first parameter's push has to come last.
 */

import { bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import { sha256 } from '../hash.js';
import { FramedEncodingError, bytesEqual, concatBytes, encodeMinimalDataPush } from './primitives.js';

/** Length of a P2PKH locking bytecode, which is how a user's address appears. */
export const P2PKH_LOCK_LENGTH = 25;

/** Length of a P2SH32 locking bytecode, which is how a contract's address appears. */
export const CONTRACT_LOCK_LENGTH = 35;

/** Length of a dispatcher selector. */
export const SELECTOR_LENGTH = 4;

/** The distinct selector scheme, used where callers must match an alternate ABI encoding. */
export const EVM_SELECTOR_LENGTH = 4;

/** A minimal push of one value, in the one encoding the wire format allows. */
export function encodeArgumentPayload(value: Uint8Array): Uint8Array {
  if (!(value instanceof Uint8Array)) throw new FramedEncodingError('an argument must be a byte array');
  return encodeMinimalDataPush(value);
}

/** An argument list: each value's minimal push, concatenated in the order given. */
export function encodeArgumentList(values: readonly Uint8Array[]): Uint8Array {
  return concatBytes(values.map((value) => encodeArgumentPayload(value)));
}

/**
 * The argument pushes a callee's call data carries, given the values in parameter order.
 *
 * The first parameter's push lands last so it is the top of the callee's stack when its body runs, which is where
 * the body reads it.
 */
export function encodeCallDataArguments(values: readonly Uint8Array[]): Uint8Array {
  return encodeArgumentList([...values].reverse());
}

/**
 * The hash a caller records for a call and a callee recomputes for the same call: the selector followed by the
 * argument pushes.
 */
export function argsHash(selector: Uint8Array, argumentPushes: Uint8Array): Uint8Array {
  if (selector.length !== SELECTOR_LENGTH) {
    throw new FramedEncodingError(`a selector is ${SELECTOR_LENGTH} bytes: got ${selector.length}`);
  }
  return sha256(concatBytes([selector, argumentPushes]));
}

/** Restates the selector form an alternate selector scheme uses. */
export function evmSelectorBytes(selector: Uint8Array): Uint8Array {
  if (selector.length !== EVM_SELECTOR_LENGTH) {
    throw new FramedEncodingError(`a distinct selector is ${EVM_SELECTOR_LENGTH} bytes: got ${selector.length}`);
  }
  return selector;
}

/** A minimal script number, which is the canonical encoding of an integer value. */
export function encodeIntegerValue(value: bigint): Uint8Array {
  if (typeof value !== 'bigint') throw new FramedEncodingError('an integer value must be a bigint');
  return bigIntToVmNumber(value);
}

/** Reads a minimal script number back. */
export function decodeIntegerValue(encoded: Uint8Array): bigint {
  const result = vmNumberToBigInt(encoded);
  if (typeof result === 'string') throw new FramedEncodingError(`not a minimal script number: ${result}`);
  return result;
}

/** `true` and `false` are the script numbers 1 and 0. */
export function encodeBooleanValue(value: boolean): Uint8Array {
  return new Uint8Array([value ? 0x01 : 0x00]);
}

/** `bytesN`, `bytes` and `string` are their raw bytes. */
export function encodeRawValue(value: Uint8Array): Uint8Array {
  return Uint8Array.from(value);
}

/** A result list uses the same concatenated-push encoding as an argument list. */
export function encodeResultList(values: readonly Uint8Array[]): Uint8Array {
  return encodeArgumentList(values);
}

/** Checks the length of a value that must be an address in the canonical form. */
export function isAddressValue(value: Uint8Array): boolean {
  return value.length === P2PKH_LOCK_LENGTH || value.length === CONTRACT_LOCK_LENGTH;
}

/** Rejects a value that claims to be an address but has a length no address form uses. */
export function assertAddressValue(value: Uint8Array, what: string): void {
  if (!isAddressValue(value)) {
    throw new FramedEncodingError(
      `${what} is ${value.length} byte(s), and an address is either ${P2PKH_LOCK_LENGTH} (user) `
      + `or ${CONTRACT_LOCK_LENGTH} (contract)`,
    );
  }
}

/** True when two call records describe the same call: same kind, target, value and arguments. */
export function sameCallArguments(
  left: { kind: number; target: Uint8Array; value: bigint; argsHash: Uint8Array },
  right: { kind: number; target: Uint8Array; value: bigint; argsHash: Uint8Array },
): boolean {
  return left.kind === right.kind
    && left.value === right.value
    && bytesEqual(left.target, right.target)
    && bytesEqual(left.argsHash, right.argsHash);
}
