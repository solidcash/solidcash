import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { sha256 } from '@solidcash/utils';
import { SignatureTemplate, getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';

// ecrecover(hash, sig, pubKey) verifies a BCH data signature and returns the signer's P2PKH locking bytecode
// (an address) on success, or the zero address 0x on an empty signature. See docs/ecrecover.md.
// Compiled with { forceStateful: true } so each test can deploy + call directly (`await sc.check(...)`).
const SOURCE = `pragma solidcash >=0.8.0;
contract Ecrecover() {
  function check(bytes32 h, datasig s, pubkey pk, bytes expected) {
    require(ecrecover(h, s, pk) == expected);
  }
}`;
const artifact = compileString(SOURCE, { forceStateful: true });

// OP_CHECKDATASIG verifies over sha256(message), so the signer signs sha256(hash) (Schnorr, the default).
const dataSig = (priv: Uint8Array, hash: Uint8Array): Uint8Array =>
  new SignatureTemplate(priv).signMessageHash(sha256(hash));

const p2pkhLockingBytecode = (pkh: Uint8Array): Uint8Array => hexToBin(`76a914${binToHex(pkh)}88ac`);

describe('ecrecover (runtime)', () => {
  const hash = hexToBin('22'.repeat(32));

  it('valid signature -> the signer P2PKH locking bytecode', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    const sig = dataSig(alicePriv, hash);
    const expected = p2pkhLockingBytecode(alicePkh); // hash160(alicePub) == alicePkh
    const tx = await sc.check(hash, sig, alicePub, expected);
    expect(tx.txid).toBeDefined();
  });

  it('empty signature -> the zero address 0x', async () => {
    // CHECKDATASIG returns false for an empty signature (no NULLFAIL), so ecrecover yields 0x.
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    const tx = await sc.check(hash, new Uint8Array(0), alicePub, new Uint8Array(0));
    expect(tx.txid).toBeDefined();
  });

  it('valid signature does not match a different expected address', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    const sig = dataSig(alicePriv, hash);
    const wrongExpected = p2pkhLockingBytecode(new Uint8Array(20)); // zeros, not alice
    await expect(sc.check(hash, sig, alicePub, wrongExpected)).rejects.toThrow();
  });

  it('non-empty wrong signature -> NULLFAIL aborts the script', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    const wrongSig = dataSig(alicePriv, hexToBin('33'.repeat(32))); // valid 64-byte sig, wrong message
    const expected = p2pkhLockingBytecode(alicePkh);
    await expect(sc.check(hash, wrongSig, alicePub, expected)).rejects.toThrow();
  });
});
