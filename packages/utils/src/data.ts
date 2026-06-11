import {
  bigIntToVmNumber,
  utf8ToBin,
  binToUtf8,
  vmNumberToBigInt,
  isVmNumberError,
  stackItemIsTruthy,
  padMinimallyEncodedVmNumber,
} from '@bitauth/libauth';

export function encodeBool(bool: boolean): Uint8Array {
  return bool ? encodeInt(1n) : encodeInt(0n);
}

export function decodeBool(encodedBool: Uint8Array): boolean {
  return stackItemIsTruthy(encodedBool);
}

export function encodeInt(int: bigint): Uint8Array {
  return bigIntToVmNumber(int);
}

export function encodeIntAsFixedBytes(int: bigint, byteLength: number): Uint8Array {
  const minimal = encodeInt(int);
  if (minimal.length > byteLength) throw new Error('value exceeds the requested byteLength');
  return padMinimallyEncodedVmNumber(minimal, byteLength);
}

export function decodeInt(encodedInt: Uint8Array, maxLength: number = 10000): bigint {
  const options = { maximumVmNumberByteLength: maxLength };
  const result = vmNumberToBigInt(encodedInt, options);

  if (isVmNumberError(result)) {
    throw new Error(result);
  }

  return result;
}

export function encodeString(str: string): Uint8Array {
  return utf8ToBin(str);
}

export function decodeString(encodedString: Uint8Array): string {
  return binToUtf8(encodedString);
}

export function placeholder(size: number): Uint8Array {
  return new Uint8Array(size).fill(0);
}
