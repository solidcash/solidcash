import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
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
