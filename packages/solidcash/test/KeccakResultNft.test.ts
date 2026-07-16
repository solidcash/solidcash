import { describe, it, expect } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { compileString } from 'solidc';
import {
  keccakComputeLockingBytecode, buildKeccakComputeRedeem, KECCAK256_SHARED_SALT,
} from '@solidcash/utils';
import { Contract, TransactionBuilder, MockNetworkProvider } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import type { Unlocker } from '../src/interfaces.js';

const SRC = `contract KecComp {
  function check(bytes x, bytes32 e) public pure {
    require(keccak256(x) == e);
  }
}`;

const K = new Uint8Array(32).fill(0xbb); // side-car own NFT category
const evm = (b: Uint8Array): Uint8Array => keccak_256(b);
const artifact = compileString(SRC); // NO option: compute-and-commit is the DEFAULT keccak model

// Deploy a compute side-car (mutable NFT of category K) at the branded/shared address.
async function deploySidecar(provider: MockNetworkProvider, salt: Uint8Array): Promise<void> {
  await provider.addUtxo(binToHex(keccakComputeLockingBytecode(salt)), {
    txid: '11'.repeat(32), vout: 0, satoshis: 100_000n,
    token: { category: binToHex(K), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  });
}

// Happy path via the transparent send() auto-co-spend (SHARED: a stateless contract with no token category).
async function spend(x: Uint8Array, e: Uint8Array): Promise<any> {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
  await deploySidecar(provider, KECCAK256_SHARED_SALT);
  const utxos = await contract.getUtxos();
  return new TransactionBuilder({ provider })
    .addInputs(utxos, contract.unlock.check(x, e))
    .addOutput({ to: contract.address, amount: 800_000n })
    .send(); // auto co-spends the compute side-car (reads preimage from param 'x')
}

// Adversarial: the side-car commits a WRONG hash (manually co-spent; the auto path is idempotent).
async function tamperedSpend(x: Uint8Array, wrongCommit: Uint8Array): Promise<any> {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
  await deploySidecar(provider, KECCAK256_SHARED_SALT);
  const utxos = await contract.getUtxos();
  const redeem = buildKeccakComputeRedeem(KECCAK256_SHARED_SALT);
  const lock = keccakComputeLockingBytecode(KECCAK256_SHARED_SALT);
  const pad = new Uint8Array(3000);
  const push = (d: Uint8Array): Uint8Array => (d.length <= 75 ? Uint8Array.from([d.length, ...d])
    : d.length <= 255 ? Uint8Array.from([0x4c, d.length, ...d]) : Uint8Array.from([0x4d, d.length & 0xff, (d.length >> 8) & 0xff, ...d]));
  const unlocker: Unlocker = {
    generateUnlockingBytecode: () => Uint8Array.from([...push(pad), ...push(x), ...push(redeem)]),
    generateLockingBytecode: () => lock,
  };
  const sc = (await provider.getUtxosForLockingBytecode(lock))[0];
  return new TransactionBuilder({ provider })
    .addInputs(utxos, contract.unlock.check(x, evm(x)))
    .addInput(sc, unlocker)
    .addOutput({ to: contract.address, amount: 800_000n })
    .addOutput({ to: lock, amount: sc.satoshis, token: { category: binToHex(K), amount: 0n, nft: { capability: 'mutable', commitment: binToHex(wrongCommit) } } })
    .send();
}

describe('keccak256 result-NFT model is the DEFAULT (compiler + SDK + VM)', () => {
  it('compiles keccak256 to the compute model by default (no flag), with no embedded blob', () => {
    const lib = artifact.externalLibraries?.find((l) => l.name === 'keccak256');
    expect(lib?.resultNft).toBe(true);
    const fn = artifact.abi.find((f) => f.name === 'check');
    expect(fn?.keccakCompute).toBe(true);
    expect(fn?.keccakPreimageParam).toBe('x');
    expect(artifact.bytecode.length / 2).toBeLessThan(1200); // the 2331-byte keccak blob is NOT in the contract
  });

  it('transparent send() co-spends the side-car for ANY preimage length, matching EVM (VM e2e)', async () => {
    for (const len of [0, 1, 32, 135, 136, 200, 300]) {
      const x = new Uint8Array(len).map((_, i) => (i * 7 + 1) & 0xff);
      const tx = await spend(x, evm(x));
      expect(tx.txid, `preimage length ${len}`).toBeDefined();
    }
  });

  it('rejects when the asserted hash e != keccak256(x)', async () => {
    const x = new Uint8Array(32).fill(0x11);
    await expect(spend(x, new Uint8Array(32).fill(0xff))).rejects.toThrow();
  });

  it('rejects a tampered side-car that commits the wrong hash (end-to-end integrity)', async () => {
    const x = new Uint8Array(32).fill(0x11);
    await expect(tamperedSpend(x, evm(new Uint8Array(32)))).rejects.toThrow();
  });
});
