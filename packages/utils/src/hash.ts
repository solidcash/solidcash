import { sha256 as sha256Lib, ripemd160 as ripemd160Lib, sha512 as sha512Lib } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
;

export function sha512(payload: Uint8Array): Uint8Array {
  return sha512Lib.hash(payload);
}

export function sha256(payload: Uint8Array): Uint8Array {
  return sha256Lib.hash(payload);
}

export function ripemd160(payload: Uint8Array): Uint8Array {
  return ripemd160Lib.hash(payload);
}

export function hash160(payload: Uint8Array): Uint8Array {
  return ripemd160(sha256(payload));
}

export function hash256(payload: Uint8Array): Uint8Array {
  return sha256(sha256(payload));
}

/**
 * Project a native locking bytecode (or short identity) to the 32-byte left-padded
 * solidity ABI address word used on graph-emission address lanes. Empty stays empty
 * (address(0)). Already-ABI 32-byte words pass through.
 */
export function addressToGraphEmissionBytes(lockOrIdentity: Uint8Array): Uint8Array {
  if (lockOrIdentity.length === 0) return lockOrIdentity;
  if (lockOrIdentity.length === 32) return lockOrIdentity;
  let id20: Uint8Array;
  if (lockOrIdentity.length === 20) {
    id20 = lockOrIdentity;
  } else if (lockOrIdentity.length === 23 && lockOrIdentity[0] === 0xa9) {
    id20 = lockOrIdentity.slice(2, 22);
  } else if (lockOrIdentity.length === 35 && lockOrIdentity[0] === 0xaa) {
    id20 = hash160(lockOrIdentity);
  } else if (lockOrIdentity.length >= 23) {
    id20 = lockOrIdentity.slice(3, 23);
  } else {
    id20 = hash160(lockOrIdentity);
  }
  const word = new Uint8Array(32);
  word.set(id20, 12);
  return word;
}
