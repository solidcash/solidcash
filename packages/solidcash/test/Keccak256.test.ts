import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccakSidecarLockingBytecode, KECCAK256_SHARED_SALT } from '@solidcash/utils';
import { Contract, StatefulContract, TransactionBuilder, SignatureTemplate } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, createFeeFunder, setupStatefulUtxos } from './test-util.js';
import { alicePub, alicePriv } from './fixture/vars.js';

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
    expect(artifact.externalLibraries).toHaveLength(1);
    expect(artifact.externalLibraries![0]).toMatchObject({
      name: 'keccak256', branded: false, inline: false, blobHash: expect.any(String),
      codeBegin: expect.any(Number), codeEnd: expect.any(Number),
      abi: { inputs: [{ name: 'message', type: 'bytes' }], outputs: [{ type: 'bytes32' }] },
    });
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

  // A stateful contract can opt into the SHARED (unbranded) side-car instead of a per-category one
  // (accepting cross-contract contention). The loader is branding-agnostic, so this works the same way.
  it('spends a stateful contract using the shared (unbranded) side-car', async () => {
    const provider = createTestProvider();
    const artifact = compileString(STATEFUL_SOURCE);
    // Opt this stateful contract into the shared side-car (override the auto-branding).
    artifact.externalLibraries = artifact.externalLibraries!.map(
      (l) => (l.name === 'keccak256' ? { ...l, branded: false } : l),
    );
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    // Deploy the SHARED side-car (zero salt).
    await provider.addUtxo(binToHex(keccakSidecarLockingBytecode(KECCAK256_SHARED_SALT)), randomUtxo({ satoshis: 5000n }));

    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.bump(hexToBin(VECTORS.zeros.preimage), hexToBin(VECTORS.zeros.hash)).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});

// Edge case: the spent contract (A) does NOT call keccak256 directly, but it calls an external
// contract (B) whose function does. The side-car is still co-spent (detected via the called function),
// and one side-car serves B's loader (it reads the last input, branding-agnostic).
const CALLEE_KECCAK = `
pragma solidcash >=0.8.0;
interface ICalleeK {
    public int counter;
    function bump(bytes preimage, bytes32 expected);
}
contract CalleeK() is ICalleeK {
    int counter;
    function bump(bytes preimage, bytes32 expected) {
        require(keccak256(preimage) == expected);
        this.counter = this.counter + 1;
    }
}`;

const CALLER_NO_KECCAK = `
pragma solidcash >=0.8.0;
interface ICalleeK {
    public int counter;
    function bump(bytes preimage, bytes32 expected);
}
contract CallerK(bytes32 calleeCategory) {
    int lastSeen;
    function readAfterBump(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int newVal = ICalleeK(calleeCategory).outState.counter;
        this.lastSeen = newVal;
    }
}`;

describe('keccak256 builtin (keccak in a called external function)', () => {
  it('co-spends the side-car when the spent function calls an external keccak function', async () => {
    const provider = createTestProvider();
    const calleeArtifact = compileString(CALLEE_KECCAK);
    const callerArtifact = compileString(CALLER_NO_KECCAK);
    // The caller itself does NOT use keccak256; only the callee does.
    expect(callerArtifact.externalLibraries).toBeUndefined();
    expect(calleeArtifact.externalLibraries?.[0]).toMatchObject({ name: 'keccak256', branded: true });

    const calleeContract = new Contract(calleeArtifact, [], { provider });
    const { categoryId: calleeCategory } = await setupStatefulUtxos(
      provider, calleeContract, calleeArtifact.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    // Deploy the callee's branded side-car.
    await provider.addUtxo(binToHex(keccakSidecarLockingBytecode(hexToBin(calleeCategory))), randomUtxo({ satoshis: 5000n }));

    const callerContract = new Contract(callerArtifact, [hexToBin(calleeCategory)], { provider });
    const { categoryId: callerCategory } = await setupStatefulUtxos(
      provider, callerContract, callerArtifact.stateLayout!, { lastSeen: 0n }, { saltContract: true },
    );

    const callerSc = StatefulContract.withCategory(callerContract, callerCategory);
    const calleeSc = StatefulContract.withCategory(calleeContract, calleeCategory);
    const tx = await callerSc.readAfterBump(alicePub, new SignatureTemplate(alicePriv))
      .withExternalCall(calleeSc, 'bump', [hexToBin(VECTORS.zeros.preimage), hexToBin(VECTORS.zeros.hash)])
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
