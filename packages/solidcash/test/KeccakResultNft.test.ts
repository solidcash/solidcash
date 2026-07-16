import { describe, it, expect } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { compileString } from 'solidc';
import { keccakComputeLockingBytecode, KECCAK256_SHARED_SALT } from '@solidcash/utils';
import { Contract, TransactionBuilder, MockNetworkProvider } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';

const K = new Uint8Array(32).fill(0xbb); // side-car own NFT category
const evm = (b: Uint8Array): Uint8Array => keccak_256(b);

const SINGLE = compileString('contract C { function f(bytes x, bytes32 e) public pure { require(keccak256(x) == e); } }');
const MULTI = compileString(`contract C2 {
  function f(bytes a, bytes b, bytes32 ea, bytes32 eb) public pure {
    require(keccak256(a) == ea);
    require(keccak256(b) == eb);
  }
}`);

// Deploy `count` distinct compute side-car UTXOs (mutable NFTs of category K) at the shared address.
async function deploySidecars(provider: MockNetworkProvider, count: number): Promise<void> {
  const lock = binToHex(keccakComputeLockingBytecode(KECCAK256_SHARED_SALT));
  for (let i = 0; i < count; i++) {
    await provider.addUtxo(lock, {
      txid: (10 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
      token: { category: binToHex(K), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
  }
}

describe('keccak256 result-NFT model (compiler + SDK + VM)', () => {
  it('compiles a single keccak256(param) to the compute model by default (no blob)', () => {
    const lib = SINGLE.externalLibraries?.find((l) => l.name === 'keccak256');
    expect(lib?.resultNft).toBe(true);
    expect(SINGLE.abi.find((f) => f.name === 'f')?.keccakPreimageParams).toEqual(['x']);
    expect(SINGLE.bytecode.length / 2).toBeLessThan(1200);
  });

  it('transparent send() co-spends the side-car for ANY preimage length, matching EVM (VM e2e)', async () => {
    for (const len of [0, 1, 32, 135, 136, 200, 300]) {
      const x = new Uint8Array(len).map((_, i) => (i * 7 + 1) & 0xff);
      const provider = new MockNetworkProvider();
      const contract = new Contract(SINGLE, [], { provider });
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
      await deploySidecars(provider, 1);
      const tx = await new TransactionBuilder({ provider })
        .addInputs(await contract.getUtxos(), contract.unlock.f(x, evm(x)))
        .addOutput({ to: contract.address, amount: 800_000n })
        .send();
      expect(tx.txid, `len ${len}`).toBeDefined();
    }
  });

  it('MULTI-CALL: two keccak256 calls co-spend two side-cars, each result read by slot (VM e2e)', async () => {
    const a = hexToBin('deadbeef'.repeat(8)); // 32 B
    const b = new Uint8Array(200).map((_, i) => (i + 3) & 0xff); // 2 blocks, distinct
    const provider = new MockNetworkProvider();
    const contract = new Contract(MULTI, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deploySidecars(provider, 2);
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.f(a, b, evm(a), evm(b)))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send();
    expect(tx.txid).toBeDefined();
  });

  it('MULTI-CALL rejects when a slot result is asserted wrong', async () => {
    const a = hexToBin('deadbeef'.repeat(8));
    const b = new Uint8Array(64).fill(0x22);
    const provider = new MockNetworkProvider();
    const contract = new Contract(MULTI, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deploySidecars(provider, 2);
    // eb is wrong (evm(a) instead of evm(b)) -> the second require fails
    await expect(new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.f(a, b, evm(a), evm(a)))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send()).rejects.toThrow();
  });

  it('rejects when the asserted hash e != keccak256(x)', async () => {
    const x = new Uint8Array(32).fill(0x11);
    const provider = new MockNetworkProvider();
    const contract = new Contract(SINGLE, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deploySidecars(provider, 1);
    await expect(new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.f(x, new Uint8Array(32).fill(0xff)))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send()).rejects.toThrow();
  });
});
