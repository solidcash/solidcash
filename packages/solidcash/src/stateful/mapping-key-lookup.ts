/**
 * phase-boundary extract: mapping-key slot candidates + external-call target address resolution
 * (phase-boundary extract from StatefulContract.ts).
 */

import { binToHex, binsAreEqual, bigIntToVmNumber, hexToBin, utf8ToBin } from '@bitauth/libauth';
import type { AbiFunction } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { addressToLockScript } from '../utils.js';
import { keyToSlotMulti } from './SortedList.js';
import {
  isLockingBytecode,
  p2pkhLockingBytecode,
} from './legacy-job-event-wire.js';

export function mappingKeySlotCandidates(
  keys: Array<bigint | boolean | Uint8Array | string>,
  keyTypes?: readonly string[],
  collection?: Parameters<typeof keyToSlotMulti>[1],
): Uint8Array[] {
  const options = keys.map((arg, index): Uint8Array[] => {
    const keyType = keyTypes?.[index];
    let encoded: Uint8Array;
    if (typeof arg === 'string') {
      if (keyType === 'address' && arg.includes(':')) encoded = addressToLockScript(arg);
      else if (keyType === 'address' && /^(?:[0-9a-fA-F]{2})+$/.test(arg)) encoded = hexToBin(arg);
      // 0x-hex locking bytecode (23/25/35) or other hex keys. Do not UTF-8 pack the hex text.
      else if (/^0x(?:[0-9a-fA-F]{2})+$/i.test(arg)) encoded = hexToBin(arg.slice(2));
      else if (keyType && /^(?:u?int|bigint)/.test(keyType) && /^-?\d+$/.test(arg)) {
        encoded = bigIntToVmNumber(BigInt(arg));
      } else encoded = utf8ToBin(arg);
    } else if (arg instanceof Uint8Array) encoded = arg;
    else if (typeof arg === 'bigint') encoded = bigIntToVmNumber(arg);
    else encoded = bigIntToVmNumber(arg ? 1n : 0n);

    return keyType === 'address' && encoded.length === 20
      ? [encoded, p2pkhLockingBytecode(encoded)]
      : [encoded];
  });
  const encodings = options.reduce<Uint8Array[][]>(
    (rows, candidates) => rows.flatMap((row) => candidates.map((candidate) => [...row, candidate])),
    [[]],
  );
  const seen = new Set<string>();
  return encodings.flatMap((encoding) => {
    const slot = keyToSlotMulti(encoding, collection);
    const hex = binToHex(slot);
    if (seen.has(hex)) return [];
    seen.add(hex);
    return [slot];
  });
}

export type MappingEntryLookup = {
  slot?: Uint8Array;
  key?: bigint | boolean | Uint8Array;
  keys?: Array<bigint | boolean | Uint8Array>;
};

export function mappingEntryMatchesLegacyKeys(
  entry: MappingEntryLookup,
  keys: Array<bigint | boolean | Uint8Array | string>,
): boolean {
  const entryKeys = entry.keys ?? (entry.key !== undefined ? [entry.key] : []);
  if (entryKeys.length !== keys.length) return false;
  return entryKeys.every((stored, index) => {
    const arg = keys[index];
    const supplied = typeof arg === 'string' ? new TextEncoder().encode(arg) : arg;
    if (stored instanceof Uint8Array) {
      return supplied instanceof Uint8Array && binsAreEqual(stored, supplied);
    }
    return stored === supplied;
  });
}

/** Select a mapping entry deterministically: exact spelling first, compatibility aliases only as fallback. */
export function selectMappingEntryByKeys<T extends MappingEntryLookup>(
  entries: readonly T[],
  keys: Array<bigint | boolean | Uint8Array | string>,
  keyTypes?: readonly string[],
  collection?: Parameters<typeof keyToSlotMulti>[1],
): T | undefined {
  const [exactSlot, ...aliasSlots] = mappingKeySlotCandidates(keys, keyTypes, collection);
  const exactMatches = entries.filter((entry) => entry.slot
    ? exactSlot !== undefined && binsAreEqual(entry.slot, exactSlot)
    : mappingEntryMatchesLegacyKeys(entry, keys));
  if (exactMatches.length > 1) {
    throw new Error('Authenticated mapping lookup found duplicate entries for the exact key slot.');
  }
  if (exactMatches.length === 1) return exactMatches[0];

  const aliasMatches = entries.filter((entry) => entry.slot !== undefined
    && aliasSlots.some((slot) => binsAreEqual(entry.slot!, slot)));
  if (aliasMatches.length > 1) {
    throw new Error('Authenticated mapping lookup found multiple entries for compatibility key aliases.');
  }
  return aliasMatches[0];
}


export function addressArgumentLockingBytecodeHex(value: FunctionArgument | undefined): string | undefined {
  let bytes: Uint8Array | undefined;
  if (value instanceof Uint8Array) bytes = value;
  else if (typeof value === 'string') {
    try {
      bytes = value.includes(':')
        ? addressToLockScript(value)
        : hexToBin(value.replace(/^0x/i, ''));
    } catch { return undefined; }
  }
  return bytes && isLockingBytecode(bytes) ? binToHex(bytes) : undefined;
}

export function externalCallTargetArgumentLockingBytecodeHex(
  owner: AbiFunction,
  slot: number,
  visibleArgs: readonly FunctionArgument[],
): string | undefined {
  const call = owner.externalCalls?.[slot];
  if (!call) return undefined;
  const inputs = owner.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const index = call.addressSource?.kind === 'forward'
    ? call.addressSource.paramIndex
    : call.addressParam === undefined ? undefined
      : inputs.findIndex((input) => input.name === call.addressParam);
  return index === undefined || index < 0
    ? undefined : addressArgumentLockingBytecodeHex(visibleArgs[index]);
}

/**
 * Resolve the Solidity-visible target which authenticates an external-call master. A direct parameter is only
 * one possible source: interface values are commonly loaded from authenticated contract state. Once the SDK has
 * evaluated that compiler-published source, it has exactly the same authority as a forwarded argument and may
 * select the direct physical identity proof when it already names the co-spent locking bytecode.
 */
export function externalCallTargetSourceLockingBytecodeHex(
  owner: AbiFunction,
  slot: number,
  visibleArgs: readonly FunctionArgument[],
  resolvedAddressSource?: FunctionArgument,
): string | undefined {
  return addressArgumentLockingBytecodeHex(resolvedAddressSource)
    ?? externalCallTargetArgumentLockingBytecodeHex(owner, slot, visibleArgs);
}
