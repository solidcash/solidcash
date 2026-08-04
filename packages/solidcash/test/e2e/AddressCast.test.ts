import { describe, it, expect } from 'vitest';
import { compileString } from '../../../solidc/src/index.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';
import { alicePkh } from '../fixture/vars.js';

// Solidity-compat narrowing casts: bytes20(address) / uint160(address) extract the embedded 20-byte hash
// (the P2PKH pubkey-hash) from a variable-length BCH address. See docs/ecrecover.md and the cast warning.
const SOURCE = `pragma solidcash >=0.8.0;
contract AddrCast() {
  function checkBytes20(address a, bytes20 expected) { require(bytes20(a) == expected); }
  function checkUint160(address a, int expected) { require(uint160(a) == expected); }
  function uint160NonNegative(address a) { require(uint160(a) >= 0); }
  function checkUint256(bytes32 b, uint256 expected) { require(uint256(b) == expected); }
}`;

const SOLIDITY_FIXED_BYTES_CASTS = `
contract FixedBytesCasts {
  function checkBytesToUint(bytes4 b4, bytes1 b1, bytes32 b32) public {
    require(uint64(uint32(b4)) == 0x61626364);
    require(uint8(b1) == 0x61);
    require(uint(b32) == 0x6162633200000000000000000000000000000000000000000000000000000000);
    require(uint16(uint32(b4)) == 0x6364);
  }
  function checkUintToBytes() public {
    require(bytes8(uint64(uint16(0x6162))) == hex"0000000000006162");
    require(bytes1(uint8(0x61)) == hex"61");
    require(bytes32(uint256(0x6162630000000000000000000000000000000000000000000000000000000000))
      == hex"6162630000000000000000000000000000000000000000000000000000000000");
    require(bytes2(uint16(uint32(0x61626364))) == hex"6364");
  }
}`;

const p2pkh = (pkh: Uint8Array): Uint8Array => hexToBin(`76a914${binToHex(pkh)}88ac`);
// uint160(address) appends a 0x00 sign byte then OP_BIN2NUM: the unsigned little-endian value of the 20-byte hash.
const leUint = (bytes: Uint8Array): bigint => {
  let v = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) v = (v << 8n) + BigInt(bytes[i]);
  return v;
};

// Compiled with { forceStateful: true } so each spend is the short `await sc.<fn>(args)` self-poke
// covenant (no dummy state, no manual UTXO gathering).
const artifact = compileString(SOURCE, { forceStateful: true });

describe('bytes20(address) / uint160(address) narrowing casts (runtime)', () => {
  const addr = p2pkh(alicePkh); // a P2PKH address whose embedded 20-byte hash is alicePkh

  it('bytes20(address) extracts the embedded P2PKH pubkey-hash', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    const txid = await sc.checkBytes20(addr, alicePkh);
    expect(txid).toBeDefined();
  });

  it('bytes20(address) does not match a different hash', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.checkBytes20(addr, new Uint8Array(20))).rejects.toThrow();
  });

  it('uint160(address) is the unsigned little-endian value of that hash', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    const txid = await sc.checkUint160(addr, leUint(alicePkh));
    expect(txid).toBeDefined();
  });

  it('uint160(address) is non-negative even when the hash high bit is set', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    const highBit = new Uint8Array(20).fill(0xff); // top bit set -> would be negative without the 0x00 fix
    const txid = await sc.uint160NonNegative(p2pkh(highBit));
    expect(txid).toBeDefined();
  });

  it('uint256(bytes32) sign-pads a top-bit-set value to a positive number', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    // 0xff at the most-significant (last, little-endian) byte -> uint256 value 0xff * 256^31, top bit set. A bare
    // BIN2NUM would read this as negative and fail the >= 0 bounds check; the cast sign-pads a 0x00.
    const highBit = hexToBin(`${'00'.repeat(31)}ff`);
    const txid = await sc.checkUint256(highBit, leUint(highBit));
    expect(txid).toBeDefined();
  });
});

describe('Solidity fixed-bytes/integer casts (runtime)', () => {
  // Exact runtime adaptations of the eight widening/narrowing fixtures below.
  // Each require checks the value from the corresponding upstream `// ----` expectation.
  // test/libsolidity/semanticTests/types/convert_fixed_bytes_to_uint_greater_size.sol
  // test/libsolidity/semanticTests/types/convert_fixed_bytes_to_uint_same_min_size.sol
  // test/libsolidity/semanticTests/types/convert_fixed_bytes_to_uint_same_type.sol
  // test/libsolidity/semanticTests/types/convert_fixed_bytes_to_uint_smaller_size.sol
  // test/libsolidity/semanticTests/types/convert_uint_to_fixed_bytes_greater_size.sol
  // test/libsolidity/semanticTests/types/convert_uint_to_fixed_bytes_same_min_size.sol
  // test/libsolidity/semanticTests/types/convert_uint_to_fixed_bytes_same_size.sol
  // test/libsolidity/semanticTests/types/convert_uint_to_fixed_bytes_smaller_size.sol
  it('matches Solidity big-endian widening and low-byte narrowing', async () => {
    const compatArtifact = compileString(SOLIDITY_FIXED_BYTES_CASTS, {
      forceStateful: true,
      solidityImportCompat: true,
    });
    const sc = await getContractFactory(compatArtifact, await fundedSigner()).deploy();
    const padded = hexToBin(`61626332${'00'.repeat(28)}`);
    await expect(sc.checkBytesToUint(hexToBin('61626364'), hexToBin('61'), padded)).resolves.toBeDefined();
    await expect(sc.checkUintToBytes()).resolves.toBeDefined();
  });
});
