import { describe, it, expect } from 'vitest';
import { binToHex, createVirtualMachineBch2026, hexToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { keccakChainCommitments } from '@solidcash/utils';
import { buildKeccakChainSidecars } from '../../src/keccak/keccakComputeSidecar.js';

const vm = createVirtualMachineBch2026();
const salt = new Uint8Array(32);
const category = new Uint8Array(32).fill(0xbb);

const preimage = new Uint8Array(600);
for (let i = 0; i < 600; i++) preimage[i] = (i * 13 + 7) & 0xff;
const digest = keccak_256(preimage);

function fakeUtxo(index: number): any {
  return {
    txid: index.toString(16).padStart(64, '0'), vout: 0, satoshis: 100000n,
    token: { category, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(new Uint8Array(0)) } },
  };
}

describe('buildKeccakChainSidecars (solidcash)', () => {
  it('chains a 600-byte preimage across 5 side-cars and the final digest matches noble', () => {
    const utxos = Array.from({ length: 5 }, (_, i) => fakeUtxo(i));
    const built = buildKeccakChainSidecars(preimage, salt, utxos, false);
    expect(built.length).toBe(5);
    // The last side-car's committed digest equals the reference keccak-256.
    expect(binToHex(built[4].commitment)).toBe(binToHex(digest));
    // Intermediate commitments are the 200-byte running state (lane24||...||lane0).
    expect(built.slice(0, 4).every((s) => s.commitment.length === 200)).toBe(true);
    expect(binToHex(built[4].commitment)).toBe(binToHex(keccakChainCommitments(preimage)[4]));
  });

  it('each built side-car recreates with the commitment the VM covenant accepts', () => {
    const utxos = Array.from({ length: 5 }, (_, i) => fakeUtxo(i));
    const built = buildKeccakChainSidecars(preimage, salt, utxos, false);
    const sourceOutputs = built.map((s) => ({
      lockingBytecode: s.unlocker.generateLockingBytecode(), valueSatoshis: 100000n,
      token: { category, amount: 0n, nft: { capability: 'mutable', commitment: new Uint8Array(0) } },
    }));
    const outputs = built.map((s) => ({
      lockingBytecode: s.recreate.to,
      valueSatoshis: s.recreate.amount,
      token: s.recreate.token
        ? { ...s.recreate.token, nft: { ...s.recreate.token.nft, commitment: hexToBin(s.recreate.token.nft!.commitment!) } }
        : undefined,
    }));
    const inputs = built.map((s, i) => ({
      outpointIndex: 0, outpointTransactionHash: hexToBin(i.toString(16).padStart(64, '0')),
      sequenceNumber: 0xffffffff, unlockingBytecode: s.unlocker.generateUnlockingBytecode(),
    }));
    const transaction = { version: 2, locktime: 0, inputs, outputs } as any;
    for (let i = 0; i < built.length; i++) {
      const st = vm.evaluate({ inputIndex: i, sourceOutputs, transaction } as any);
      expect(st.error, `side-car ${i}: ${st.error}`).toBeUndefined();
    }
  });

  it('rejects when too few side-car UTXOs are available', () => {
    expect(() => buildKeccakChainSidecars(preimage, salt, [fakeUtxo(0)], false)).toThrow(/needs 5 side-car/);
  });
});
