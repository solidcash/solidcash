import { cashAddressToLockingBytecode } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { hash160 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AddressForm, ExternalResultEncoding, StructDefinitionInfo } from './artifact.js';
import { attachDecodedAccessors, parseArrayTypeString, type StateValue } from './state.js';

const decodedAddress = Symbol.for('solidcash.decoded-address-encoding');

/** Public result metadata, not an authorization or a property of arbitrary byte arrays. */
export function decodedAddressEncoding(value: unknown): ExternalResultEncoding | undefined {
  if (!(value instanceof Uint8Array)) return undefined;
  const encoding = (value as unknown as Record<symbol, unknown>)[decodedAddress];
  return encoding === 'evm-abi-v1' || encoding === 'compact-pushdata-v1' ? encoding : undefined;
}

/** Canonical Solidity identity for a value already known to have ABI type `address`. */
export function decodedSolidityAddressIdentity(bytes: Uint8Array): Uint8Array | undefined {
  if (bytes.length === 0) return new Uint8Array(20);
  if (bytes.length === 20) return bytes.slice();
  if (bytes.length === 32 && bytes.subarray(0, 12).every((byte) => byte === 0)) return bytes.slice(12);
  if (bytes.length === 25 && bytes[0] === 0x76 && bytes[1] === 0xa9 && bytes[2] === 0x14
    && bytes[23] === 0x88 && bytes[24] === 0xac) return bytes.slice(3, 23);
  if (bytes.length === 23 && bytes[0] === 0xa9 && bytes[1] === 0x14 && bytes[22] === 0x87) {
    return bytes.slice(2, 22);
  }
  if (bytes.length === 35 && bytes[0] === 0xaa && bytes[1] === 0x20 && bytes[34] === 0x87) {
    return hash160(bytes);
  }
  return undefined;
}

/**
 * Format a public typed result, including direct state reads that bypass the wire decoder. Only address
 * fields are projected; bytes/bytes32 remain exact. Copy aggregates and address leaves so cached state and
 * aliased byte fields never acquire result-only metadata. toObject/toArray retain the typed byte leaves.
 *
 * `addressForm` decides that projection: `'hash'` answers the 20-byte Solidity identity, `'bytecode'` answers the
 * exact locking bytecode the contract stored. It is the artifact's own form, so a caller reads back the same
 * address the contract wrote.
 */
export function decorateDecodedResult(
  value: StateValue,
  type: string,
  structs: readonly StructDefinitionInfo[] | undefined,
  encoding: ExternalResultEncoding,
  addressForm: AddressForm = 'hash',
): StateValue {
  if (type === 'address' || type === 'address payable') {
    let bytes = value instanceof Uint8Array ? value : undefined;
    if (typeof value === 'string') {
      if (/^0x(?:[0-9a-f]{2})*$/i.test(value)) bytes = hexToBin(value.slice(2));
      else if (value.includes(':')) {
        const decoded = cashAddressToLockingBytecode(value);
        if (typeof decoded !== 'string') bytes = decoded.bytecode;
      }
    }
    if (!bytes) return value;
    const projected = addressForm === 'hash' ? decodedSolidityAddressIdentity(bytes) : bytes.slice();
    if (!projected) throw new Error('Decoded EVM address has no canonical 20-byte identity.');
    Object.defineProperty(projected, decodedAddress, { value: encoding });
    return projected;
  }
  const array = parseArrayTypeString(type);
  if (array && Array.isArray(value)) {
    return attachDecodedAccessors(value.map((entry) => (
      decorateDecodedResult(entry, array.elementType, structs, encoding, addressForm)
    )));
  }
  const struct = structs?.find((entry) => entry.name === type);
  if (struct && value !== null && typeof value === 'object'
    && !Array.isArray(value) && !(value instanceof Uint8Array)) {
    const result = { ...value };
    for (const field of struct.fields) {
      if (Object.prototype.hasOwnProperty.call(result, field.name)) {
        result[field.name] = decorateDecodedResult(result[field.name], field.type, structs, encoding, addressForm);
      }
    }
    return attachDecodedAccessors(result);
  }
  return attachDecodedAccessors(value);
}
