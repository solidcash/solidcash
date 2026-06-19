import { describe, it, expect } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import {
  BUILTIN_LIBRARIES,
  buildSidecarRedeem,
  sidecarLockingBytecode,
  sidecarCodeRange,
  pushPrefixLength,
  buildKeccakSidecarRedeem,
  keccakSidecarLockingBytecode,
  KECCAK256_SHARED_SALT,
  KECCAK256_LIBRARY_BLOB,
  KECCAK256_LIBRARY_BLOB_HASH,
  KECCAK256_LIBRARY_BLOB_LENGTH,
  KECCAK256_LIBRARY_ID,
  scriptToBytecode,
} from '../src/index.js';

describe('external library registry', () => {
  const keccak = BUILTIN_LIBRARIES.keccak256;
  const salt = new Uint8Array(32).fill(7);

  it('registers keccak256 with the canonical blob, hash, id, and abi', () => {
    expect(keccak.name).toBe('keccak256');
    expect(binToHex(keccak.blob)).toBe(KECCAK256_LIBRARY_BLOB);
    expect(binToHex(keccak.blobHash)).toBe(KECCAK256_LIBRARY_BLOB_HASH);
    expect(keccak.functionId).toBe(KECCAK256_LIBRARY_ID);
    expect(keccak.abi).toEqual({ inputs: [{ name: 'message', type: 'bytes' }], outputs: [{ type: 'bytes32' }] });
  });

  it('the generic side-car builder matches the keccak-specific one byte-for-byte', () => {
    expect(binToHex(buildSidecarRedeem(keccak.blob, salt))).toBe(binToHex(buildKeccakSidecarRedeem(salt)));
    expect(binToHex(sidecarLockingBytecode(keccak.blob, salt)))
      .toBe(binToHex(keccakSidecarLockingBytecode(salt)));
  });

  it('sidecarCodeRange locates the blob within the side-car input bytecode', () => {
    const redeem = buildSidecarRedeem(keccak.blob, KECCAK256_SHARED_SALT);
    const inputBytecode = scriptToBytecode([redeem]); // the revealed P2SH redeem = PUSHDATA(redeem)
    const { codeBegin, codeEnd } = sidecarCodeRange(keccak.blob);
    expect(codeEnd - codeBegin).toBe(KECCAK256_LIBRARY_BLOB_LENGTH);
    expect(binToHex(inputBytecode.slice(codeBegin, codeEnd))).toBe(KECCAK256_LIBRARY_BLOB);
  });

  it('pushPrefixLength matches BCH minimal push encoding', () => {
    expect(pushPrefixLength(1)).toBe(1);
    expect(pushPrefixLength(75)).toBe(1);
    expect(pushPrefixLength(76)).toBe(2);
    expect(pushPrefixLength(255)).toBe(2);
    expect(pushPrefixLength(256)).toBe(3);
    expect(pushPrefixLength(65535)).toBe(3);
    expect(pushPrefixLength(65536)).toBe(5);
  });
});
