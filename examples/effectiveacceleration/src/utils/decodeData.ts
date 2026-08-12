import { toUtf8String, hexlify, getAddress, toBigInt, ZeroAddress } from "ethers";

// local decode utils
export const decodeString = (ptr: {bytes: Uint8Array, index: number}): string => {
  const length = ptr.bytes[ptr.index];
  ptr.index += 2;
  const result = toUtf8String(ptr.bytes.slice(ptr.index, ptr.index + length));
  ptr.index += length;

  return result;
}

export const decodeBytes = (ptr: {bytes: Uint8Array, index: number}): string => {
  const length = ptr.bytes[ptr.index];
  ptr.index += 2;
  const result = hexlify(ptr.bytes.slice(ptr.index, ptr.index + length));
  ptr.index += length;

  return result;
}

export const decodeStringArray = (ptr: {bytes: Uint8Array, index: number}): string[] => {
  const length = ptr.bytes[ptr.index];
  ptr.index += 2;
  const result: string[] = [];
  for (let i = 0; i < length; i++) {
    const str = decodeString(ptr);
    result.push(str);
  }

  return result;
}

export const decodeAddressArray = (ptr: {bytes: Uint8Array, index: number}): string[] => {
  const length = ptr.bytes[ptr.index];
  ptr.index += 2;
  const result: string[] = [];
  for (let i = 0; i < length; i++) {
    const address = getAddress(hexlify(ptr.bytes.slice(ptr.index, ptr.index + 20)));
    ptr.index += 21;
    result.push(address);
  }

  return result;
}

export const decodeBytes32 = (ptr: {bytes: Uint8Array, index: number}): string => {
  const result = hexlify(ptr.bytes.slice(ptr.index, ptr.index + 32));
  ptr.index += 32;

  return result;
}

export const decodeBool = (ptr: {bytes: Uint8Array, index: number}): boolean => {
  const result = ptr.bytes[ptr.index] === 1;
  ptr.index++;

  return result;
}

export const decodeAddress = (ptr: {bytes: Uint8Array, index: number}): string => {
  if (ptr.bytes[ptr.index] === 0 && ptr.bytes.length - ptr.index < 24) {
    ptr.index++;
    return ZeroAddress;
  }
  if (ptr.bytes.length - ptr.index < 20) {
    // uint160(address(0)) is the minimal zero VM number and therefore contributes no payload bytes; only the
    // following packed field remains.
    return ZeroAddress;
  }
  const result = getAddress(hexlify(ptr.bytes.slice(ptr.index, ptr.index + 20)));
  // These event schemas cast addresses to uint160 before packing. SolidCash's unsigned VM-number width retains
  // one trailing sign byte, so consume 21 while exposing the first 20 account bytes.
  ptr.index += 21;

  return result;
}

export const decodeUint256 = (ptr: {bytes: Uint8Array, index: number}): bigint => {
  const result = toBigInt(Uint8Array.from(ptr.bytes.slice(ptr.index, ptr.index + 32)).reverse());
  ptr.index += 32;

  return result;
}

export const decodeUint32 = (ptr: {bytes: Uint8Array, index: number}): number => {
  const result = new DataView(
    ptr.bytes.buffer, ptr.bytes.byteOffset + ptr.index, 4,
  ).getUint32(0, true);
  ptr.index += 5;

  return result;
}

export const decodeUint16 = (ptr: {bytes: Uint8Array, index: number}): number => {
  const result = new DataView(
    ptr.bytes.buffer, ptr.bytes.byteOffset + ptr.index, 4,
  ).getUint32(0, true);
  // The source assignment widens maxTime into the uint32 state field before the event reads it.
  ptr.index += 4;

  return result;
}
