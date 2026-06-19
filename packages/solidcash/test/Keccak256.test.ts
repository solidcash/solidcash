import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccakSidecarLockingBytecode, KECCAK256_SHARED_SALT } from '@solidcash/utils';
import { Contract, StatefulContract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, createFeeFunder, setupStatefulUtxos } from './test-util.js';

// keccak256() is backed by a pure-script side-car library co-spent at runtime (see keccak-poc/).
const SOURCE = `
contract KeccakTest() {
    function verify(bytes preimage, bytes32 expected) {
        require(keccak256(preimage) == expected);
    }
}`;

// Known EVM keccak256 vectors (hardcoded so the test needs no keccak dependency).
const VECTORS = {
  zeros: { preimage: '00'.repeat(32), hash: '290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563' },
  ones: { preimage: '11'.repeat(32), hash: 'b569321de72d0af89c2fb48a484de3fc9343f31600ae1f3e13d633cb48cbf816' },
};

const sidecarLockHex = binToHex(keccakSidecarLockingBytecode(KECCAK256_SHARED_SALT));

async function spendKeccak(preimageHex: string, expectedHex: string): Promise<string> {
  const provider = createTestProvider();
  const contract = new Contract(compileString(SOURCE), [], { provider });

  // Deploy the side-car library once, then fund the contract.
  const sidecarUtxo = await provider.addUtxo(sidecarLockHex, randomUtxo({ satoshis: 5000n }));
  const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
  const feeFunder = await createFeeFunder(provider, 20000n);

  const tx = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.verify(hexToBin(preimageHex), hexToBin(expectedHex)))
    .addInput(feeFunder.utxo, feeFunder.unlocker)
    .addOutput({ to: contract.address, amount: 110000n })
    // send() auto-co-spends the side-car (last input) + recreates it (last output)
    .send();
  return tx.txid;
}

describe('keccak256 builtin (side-car library)', () => {
  it('records the side-car dependency in the artifact', () => {
    const artifact = compileString(SOURCE);
    expect(artifact.externalLibraries).toEqual([
      { name: 'keccak256', blobHash: expect.any(String), branded: false },
    ]);
    expect(artifact.abi.find((f) => f.name === 'verify')?.externalLibraries).toEqual(['keccak256']);
  });

  it('verifies keccak256(preimage) matching the EVM hash (0x00..)', async () => {
    const txid = await spendKeccak(VECTORS.zeros.preimage, VECTORS.zeros.hash);
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifies keccak256(preimage) matching the EVM hash (0x11..)', async () => {
    const txid = await spendKeccak(VECTORS.ones.preimage, VECTORS.ones.hash);
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a wrong expected hash', async () => {
    await expect(spendKeccak(VECTORS.ones.preimage, VECTORS.zeros.hash)).rejects.toThrow();
  });
});

// A stateful contract gets a BRANDED side-car: its address is salted with the contract's token
// category, so each contract co-spends its own keccak UTXO (no cross-contract contention).
const STATEFUL_SOURCE = `
contract StatefulKeccak() {
    int counter;
    function bump(bytes preimage, bytes32 expected) {
        require(keccak256(preimage) == expected);
        this.counter = this.counter + 1;
    }
}`;

describe('keccak256 builtin (stateful contracts)', () => {
  it('marks the side-car branded for a stateful contract', () => {
    const artifact = compileString(STATEFUL_SOURCE);
    expect(artifact.externalLibraries?.[0]).toMatchObject({ name: 'keccak256', branded: true });
  });

  // The branded side-car is co-spent and threaded through auto-derivation (present in the probes and the
  // final tx). The side-car address is salted with the contract's token category.
  it('spends a stateful contract that uses keccak256 (auto-co-spends the branded side-car)', async () => {
    const provider = createTestProvider();
    const artifact = compileString(STATEFUL_SOURCE);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    // Deploy the branded side-car at the per-category address.
    await provider.addUtxo(binToHex(keccakSidecarLockingBytecode(hexToBin(categoryId))), randomUtxo({ satoshis: 5000n }));

    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.bump(hexToBin(VECTORS.zeros.preimage), hexToBin(VECTORS.zeros.hash)).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
