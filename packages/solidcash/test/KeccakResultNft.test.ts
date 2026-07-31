import { describe, it, expect } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { compileString } from 'solidc';
import { keccakComputeLockingBytecode, KECCAK256_SHARED_SALT } from '@solidcash/utils';
import { Contract, TransactionBuilder, MockNetworkProvider } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';

const K = new Uint8Array(32).fill(0xbb); // side-car own NFT category
const evm = (b: Uint8Array): Uint8Array => keccak_256(b);
const NON_TRUTHY_INPUT_0 = new RegExp('^mandatory-script-verify-flag-failed '
  + '\\(Unable to verify transaction: error in evaluating input index 0: '
  + 'Unsuccessful evaluation: completed with a non-truthy value on top of the stack\\. '
  + 'Top stack item: ""\\.\\)$');

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
      .send()).rejects.toThrow(NON_TRUTHY_INPUT_0);
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
      .send()).rejects.toThrow(NON_TRUTHY_INPUT_0);
  });
});

// Complex / nested keccak256 args (not a direct parameter) record `null` in keccakPreimageParams; the SDK
// resolves the real preimage via a VM debug probe of the contract input, then co-spends the side-car with it.
describe('keccak256 result-NFT model (complex / nested args via VM probe)', () => {
  const NESTED = compileString(
    'contract N { function f(bytes x, bytes32 e) public pure { require(keccak256(keccak256(x)) == e); } }',
  );
  const NESTED3 = compileString(
    'contract N3 { function f(bytes x, bytes32 e) public pure { require(keccak256(keccak256(keccak256(x))) == e); } }',
  );
  const CONCAT = compileString(
    'contract Cc { function f(bytes20 a, bytes12 b, bytes32 e) public pure { require(keccak256(abi.encodePacked(a, b)) == e); } }',
  );

  it('records null for a complex arg and stays on the compute model', () => {
    expect(NESTED.abi.find((f) => f.name === 'f')?.keccakCompute).toBe(true);
    expect(NESTED.abi.find((f) => f.name === 'f')?.keccakPreimageParams).toEqual([null, 'x']);
    expect(CONCAT.abi.find((f) => f.name === 'f')?.keccakPreimageParams).toEqual([null]);
  });

  it('NESTED keccak256(keccak256(x)): probe resolves the inner hash as the outer preimage (VM e2e)', async () => {
    const x = hexToBin('deadbeef'.repeat(8));
    const provider = new MockNetworkProvider();
    const contract = new Contract(NESTED, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deploySidecars(provider, 2);
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.f(x, evm(evm(x))))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send();
    expect(tx.txid).toBeDefined();
  });

  it('3-LEVEL nesting resolves inner-to-outer over successive probes (VM e2e)', async () => {
    const x = hexToBin('a1b2c3d4'.repeat(8));
    const provider = new MockNetworkProvider();
    const contract = new Contract(NESTED3, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deploySidecars(provider, 3);
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.f(x, evm(evm(evm(x)))))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send();
    expect(tx.txid).toBeDefined();
  });

  it('CONCAT keccak256(abi.encodePacked(a, b)): probe resolves the concatenated preimage (VM e2e)', async () => {
    const a = hexToBin('aa'.repeat(20));
    const b = hexToBin('bb'.repeat(12));
    const provider = new MockNetworkProvider();
    const contract = new Contract(CONCAT, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deploySidecars(provider, 1);
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.f(a, b, evm(Uint8Array.from([...a, ...b]))))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send();
    expect(tx.txid).toBeDefined();
  });

  // A FIXED-bound keccak256 loop (hash chain) unrolls to N syntactic calls -> N side-cars (each a complex-arg
  // call resolved by the probe). A runtime-bound loop stays flagged keccakInLoop (unsupported, fails closed).
  it('FIXED-bound keccak256 loop (hash chain x3) unrolls to 3 side-cars (VM e2e)', async () => {
    const CHAIN = compileString(
      'contract Ch { function f(bytes32 x, bytes32 e) public pure { bytes32 h = x;'
      + ' for (int i = 0; i < 3; i++) { h = keccak256(abi.encodePacked(h)); } require(h == e); } }',
    );
    expect(CHAIN.abi.find((f) => f.name === 'f')?.keccakPreimageParams).toEqual([null, null, null]);
    expect(CHAIN.externalLibraries?.find((l) => l.name === 'keccak256')?.minInstances).toBe(3);
    const x = hexToBin('11'.repeat(32));
    let h = x; for (let i = 0; i < 3; i++) h = evm(h);
    const provider = new MockNetworkProvider();
    const contract = new Contract(CHAIN, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deploySidecars(provider, 3);
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.f(x, h))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send();
    expect(tx.txid).toBeDefined();
  });
});
