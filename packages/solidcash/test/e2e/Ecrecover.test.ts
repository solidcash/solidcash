import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { sha256 } from '@solidcash/utils';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, createFeeFunder } from '../test-util.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';

// ecrecover(hash, sig, pubKey) verifies a BCH data signature and returns the signer's P2PKH locking bytecode
// (an address) on success, or the zero address 0x on an empty signature. See docs/ecrecover.md.
const SOURCE = `pragma solidcash >=0.8.0;
contract Ecrecover() {
  function check(bytes32 h, datasig s, pubkey pk, bytes expected) {
    require(ecrecover(h, s, pk) == expected);
  }
}`;
const artifact = compileString(SOURCE);

// OP_CHECKDATASIG verifies over sha256(message), so the signer signs sha256(hash) (Schnorr, the default).
const dataSig = (priv: Uint8Array, hash: Uint8Array): Uint8Array =>
  new SignatureTemplate(priv).signMessageHash(sha256(hash));

const p2pkhLockingBytecode = (pkh: Uint8Array): Uint8Array => hexToBin(`76a914${binToHex(pkh)}88ac`);

async function spend(hash: Uint8Array, sig: Uint8Array, pub: Uint8Array, expected: Uint8Array): Promise<string> {
  const provider = createTestProvider();
  const contract = new Contract(artifact, [], { provider });
  const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
  const feeFunder = await createFeeFunder(provider, 20000n);
  const tx = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.check(hash, sig, pub, expected))
    .addInput(feeFunder.utxo, feeFunder.unlocker)
    .addOutput({ to: contract.address, amount: 110000n })
    .send();
  return tx.txid;
}

describe('ecrecover (runtime)', () => {
  const hash = hexToBin('22'.repeat(32));

  it('valid signature -> the signer P2PKH locking bytecode', async () => {
    const sig = dataSig(alicePriv, hash);
    const expected = p2pkhLockingBytecode(alicePkh); // hash160(alicePub) == alicePkh
    const txid = await spend(hash, sig, alicePub, expected);
    expect(txid).toBeDefined();
  });

  it('empty signature -> the zero address 0x', async () => {
    // CHECKDATASIG returns false for an empty signature (no NULLFAIL), so ecrecover yields 0x.
    const txid = await spend(hash, new Uint8Array(0), alicePub, new Uint8Array(0));
    expect(txid).toBeDefined();
  });

  it('valid signature does not match a different expected address', async () => {
    const sig = dataSig(alicePriv, hash);
    const wrongExpected = p2pkhLockingBytecode(new Uint8Array(20)); // zeros, not alice
    await expect(spend(hash, sig, alicePub, wrongExpected)).rejects.toThrow();
  });

  it('non-empty wrong signature -> NULLFAIL aborts the script', async () => {
    const wrongSig = dataSig(alicePriv, hexToBin('33'.repeat(32))); // valid 64-byte sig, wrong message
    const expected = p2pkhLockingBytecode(alicePkh);
    await expect(spend(hash, wrongSig, alicePub, expected)).rejects.toThrow();
  });
});
