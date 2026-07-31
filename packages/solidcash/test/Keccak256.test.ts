import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { keccakComputeLockingBytecode, KECCAK256_SHARED_SALT } from '@solidcash/utils';
import { Contract, StatefulContract, SignatureTemplate, TransactionBuilder, MockNetworkProvider } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';
import { alicePub, alicePriv } from './fixture/vars.js';

const STATEFUL_OP_VERIFY_INPUT_0 = /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;
const NON_TRUTHY_INPUT_0 = new RegExp('^mandatory-script-verify-flag-failed '
  + '\\(Unable to verify transaction: error in evaluating input index 0: '
  + 'Unsuccessful evaluation: completed with a non-truthy value on top of the stack\\. '
  + 'Top stack item: ""\\.\\)$');

// A keccak compute side-car's OWN NFT category (distinct from any contract's category; the branded covenant
// checks the MASTER input's category, not the side-car's own).
const KECCAK_SIDECAR_CATEGORY = '77'.repeat(32);

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

describe('keccak256 builtin (side-car library)', () => {
  it('records the side-car dependency in the artifact (compute model: no inline blob fields)', () => {
    const artifact = compileString(SOURCE);
    expect(artifact.externalLibraries).toHaveLength(1);
    // keccak256 is always the compute (result-NFT) model, so the descriptor carries no inline-loader fields
    // (blobHash / codeBegin / codeEnd) - those would describe a blob the contract never loads.
    expect(artifact.externalLibraries![0]).toMatchObject({
      name: 'keccak256', branded: false, resultNft: true, minInstances: 1,
      abi: { inputs: [{ name: 'message', type: 'bytes' }], outputs: [{ type: 'bytes32' }] },
    });
    const lib = artifact.externalLibraries![0];
    expect(lib.blobHash).toBeUndefined();
    expect(lib.codeBegin).toBeUndefined();
    expect(lib.codeEnd).toBeUndefined();
    expect(artifact.abi.find((f) => f.name === 'verify')?.externalLibraries).toEqual(['keccak256']);
  });

  // Stateless keccak256 (single-call any length, multi-call slot-per-call, complex/nested args, negatives) is
  // the compute result-NFT model, exercised in KeccakResultNft.test.ts. This file keeps the cases still on the
  // INLINE model - STATEFUL contracts and keccak-in-a-called-external - pending stateful compute (block-layout
  // slot; see docs/keccak-result-nft.md section 13).
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
    // Stateful keccak is the compute model too, reading a keccakSideCar block-layout slot (branded to the
    // contract's category) rather than the last input.
    expect(artifact.abi.find((f) => f.name === 'bump')?.keccakCompute).toBe(true);
    expect(artifact.stateLayout).toBeDefined();
  });

  // Stateful compute: the branded side-car rides a keccakSideCar block-layout slot (sibling of blockhashOracle),
  // co-spent + recreated with the computed result R, and threaded through auto-derivation (present in the
  // probes and the final tx). Its address is salted with the contract's token category.
  it('spends a stateful contract that uses keccak256 (auto-co-spends the branded compute side-car)', async () => {
    const provider = createTestProvider();
    const artifact = compileString(STATEFUL_SOURCE);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    // Deploy the branded compute side-car (mutable NFT) at the per-category address.
    await provider.addUtxo(binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true)), {
      ...randomUtxo({ satoshis: 100_000n }),
      token: { category: KECCAK_SIDECAR_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });

    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.bump(hexToBin(VECTORS.zeros.preimage), hexToBin(VECTORS.zeros.hash)).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a stateful keccak256 when the asserted hash is wrong', async () => {
    const provider = createTestProvider();
    const artifact = compileString(STATEFUL_SOURCE);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    await provider.addUtxo(binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true)), {
      ...randomUtxo({ satoshis: 100_000n }),
      token: { category: KECCAK_SIDECAR_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
    const sc = StatefulContract.withCategory(contract, categoryId);
    // ones-hash asserted against the zeros preimage -> the require fails
    await expect(sc.bump(hexToBin(VECTORS.zeros.preimage), hexToBin(VECTORS.ones.hash)).send())
      .rejects.toThrow(STATEFUL_OP_VERIFY_INPUT_0);
  });

  // Complex/nested arg in a stateful contract (commit-reveal style): the preimage is not a direct parameter,
  // so auto-derivation resolves it via a VM probe of the master (positioned at the keccakSideCar slots).
  const NESTED_STATEFUL = `
  contract NestedKeccak() {
      int counter;
      function reveal(bytes secret, bytes32 expected) {
          require(keccak256(keccak256(secret)) == expected);
          this.counter = this.counter + 1;
      }
  }`;

  it('resolves a NESTED keccak256(keccak256(x)) in a stateful contract via the derivation probe (VM e2e)', async () => {
    const provider = createTestProvider();
    const artifact = compileString(NESTED_STATEFUL);
    expect(artifact.abi.find((f) => f.name === 'reveal')?.keccakPreimageParams).toEqual([null, 'secret']);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    // Two side-cars (nested = two keccak calls) at the branded stateful address.
    const lock = binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true));
    for (let i = 0; i < 2; i++) {
      await provider.addUtxo(lock, {
        txid: (40 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
        token: { category: KECCAK_SIDECAR_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const secret = hexToBin(VECTORS.zeros.preimage);
    // keccak256(keccak256(zeros)) = keccak256(VECTORS.zeros.hash)
    const inner = hexToBin(VECTORS.zeros.hash);
    const expected = keccak_256(inner);
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.reveal(secret, expected).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  // Dynamic (runtime-bound) keccak loop in a stateful contract: N side-cars read from the TRAILING region, N +
  // each iteration's preimage determined by a progressive VM probe, co-spent + recreated per iteration. The
  // contract EXTERNALLY asserts the chain result (require h == expected) so the VM itself proves each iteration
  // truly hashed the running value - a self-derived-only check would pass even if the loop miscomputed h.
  const CHAIN_STATEFUL = `
  contract HashChain() {
      bytes32 acc;
      function chain(bytes32 x, int n, bytes32 expected) {
          bytes32 h = x;
          for (int i = 0; i < n; i++) { h = keccak256(h); }
          require(h == expected);
          this.acc = h;
      }
  }`;

  it('resolves a DYNAMIC keccak256 loop (hash chain) in a stateful contract via progressive derivation (VM e2e)', async () => {
    const provider = createTestProvider();
    const artifact = compileString(CHAIN_STATEFUL);
    expect(artifact.abi.find((f) => f.name === 'chain')?.keccakLoopReads).toBe(true);
    const contract = new Contract(artifact, [], { provider });
    const seed = hexToBin(VECTORS.zeros.preimage);
    let acc = seed; for (let i = 0; i < 4; i++) acc = keccak_256(acc); // chain of 4
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { acc: seed }, { saltContract: true },
    );
    // Deploy enough branded stateful side-cars (>= the runtime iteration count).
    const lock = binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true));
    for (let i = 0; i < 6; i++) {
      await provider.addUtxo(lock, {
        txid: (50 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
        token: { category: KECCAK_SIDECAR_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.chain(seed, 4n, acc).send(); // expected = the true keccak^4(seed)
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a DYNAMIC stateful keccak loop when the asserted chain result is wrong', async () => {
    const provider = createTestProvider();
    const artifact = compileString(CHAIN_STATEFUL);
    const contract = new Contract(artifact, [], { provider });
    const seed = hexToBin(VECTORS.zeros.preimage);
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { acc: seed }, { saltContract: true },
    );
    const lock = binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true));
    for (let i = 0; i < 6; i++) {
      await provider.addUtxo(lock, {
        txid: (56 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
        token: { category: KECCAK_SIDECAR_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const sc = StatefulContract.withCategory(contract, categoryId);
    // Wrong expected (keccak^3, not ^4) -> the VM's require(h == expected) fails closed.
    let wrong = seed; for (let i = 0; i < 3; i++) wrong = keccak_256(wrong);
    await expect(sc.chain(seed, 4n, wrong).send()).rejects.toThrow(STATEFUL_OP_VERIFY_INPUT_0);
  });

  // General (non-hash-chain) dynamic loop: each iteration's preimage depends on a per-call value, so the probe
  // must read the ACTUAL arg off the trace (not assume h = keccak(h)). Also confirms the derived state commits.
  const SALTED_CHAIN = `
  contract Salted() {
      bytes32 acc;
      function run(bytes32 x, bytes32 salt, int n, bytes32 expected) {
          bytes32 h = x;
          for (int i = 0; i < n; i++) { h = keccak256(abi.encodePacked(h, salt)); }
          require(h == expected);
          this.acc = h;
      }
  }`;

  it('resolves a general (salt-dependent) dynamic keccak loop via progressive derivation (VM e2e)', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SALTED_CHAIN);
    const contract = new Contract(artifact, [], { provider });
    const seed = hexToBin('11'.repeat(32));
    const salt = hexToBin('22'.repeat(32));
    let expected = seed; // true salted chain: h = keccak(h || salt), 3 rounds
    for (let i = 0; i < 3; i++) expected = keccak_256(Uint8Array.from([...expected, ...salt]));
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { acc: seed }, { saltContract: true },
    );
    const lock = binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true));
    for (let i = 0; i < 5; i++) {
      await provider.addUtxo(lock, {
        txid: (60 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
        token: { category: KECCAK_SIDECAR_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const sc = StatefulContract.withCategory(contract, categoryId);
    // Externally asserts the true chain result, so the VM proves the SDK read each iteration's REAL preimage
    // (h_i || salt) off the trace and each iteration truly hashed the running value.
    const tx = await sc.run(seed, salt, 3n, expected).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});

// Dynamic (runtime-bound) keccak loop in a STATELESS contract (pure verifier, no state). Same absolute-forward
// mechanism as the stateful loop (side-cars at master+1+k via OP_INPUTINDEX, STATEFUL self-preserving covenant),
// but co-spent through the base TransactionBuilder: side-cars spliced right after the master input and their
// recreations at the parallel output positions, resolved by a progressive VM probe. The contract asserts the
// chain result against an EXTERNAL target, so the VM proves each iteration truly hashed the running value.
const CHAIN_STATELESS = `
contract HashChainStateless() {
    function verify(bytes32 x, int n, bytes32 target) {
        bytes32 h = x;
        for (int i = 0; i < n; i++) { h = keccak256(h); }
        require(h == target);
    }
}`;

describe('keccak256 builtin (stateless dynamic loop)', () => {
  const K = '99'.repeat(32); // side-car own NFT category
  async function deployStatelessLoopSidecars(provider: MockNetworkProvider, count: number): Promise<void> {
    const lock = binToHex(keccakComputeLockingBytecode(KECCAK256_SHARED_SALT, true)); // STATEFUL covenant, salt 0
    for (let i = 0; i < count; i++) {
      await provider.addUtxo(lock, {
        txid: (20 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
        token: { category: K, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
  }

  it('flags keccakLoopReads on the stateless loop function (no block layout)', () => {
    const artifact = compileString(CHAIN_STATELESS);
    const fn = artifact.abi.find((f) => f.name === 'verify');
    expect(fn?.keccakLoopReads).toBe(true);
    expect(fn?.keccakCompute).toBe(true);
    expect(artifact.stateLayout).toBeUndefined(); // stateless
  });

  it('resolves a stateless dynamic keccak loop for varying iteration counts (VM e2e)', async () => {
    for (const n of [1, 2, 4, 7]) {
      const provider = new MockNetworkProvider();
      const artifact = compileString(CHAIN_STATELESS);
      const contract = new Contract(artifact, [], { provider });
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
      await deployStatelessLoopSidecars(provider, n + 2); // extras: convergence stops at N regardless
      const seed = new Uint8Array(32).fill(0x11);
      let target = seed; for (let i = 0; i < n; i++) target = keccak_256(target);
      const tx = await new TransactionBuilder({ provider })
        .addInputs(await contract.getUtxos(), contract.unlock.verify(seed, BigInt(n), target))
        .addOutput({ to: contract.address, amount: 800_000n })
        .send();
      expect(tx.txid, `n=${n}`).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('rejects a stateless dynamic keccak loop when the target is wrong (fails closed)', async () => {
    const provider = new MockNetworkProvider();
    const artifact = compileString(CHAIN_STATELESS);
    const contract = new Contract(artifact, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deployStatelessLoopSidecars(provider, 6);
    const seed = new Uint8Array(32).fill(0x11);
    let wrong = seed; for (let i = 0; i < 2; i++) wrong = keccak_256(wrong); // keccak^2, ask for ^3
    await expect(new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.verify(seed, 3n, wrong))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send()).rejects.toThrow(NON_TRUTHY_INPUT_0);
  });
});

// Transitive: the spent contract (A) does NOT call keccak256 directly, but it reads/co-spends an external
// stateful contract (B) whose function hashes. B's keccak256 reads a keccakSideCar block-layout slot in B's
// OWN block, so B's compute side-car is co-spent + recreated INSIDE B's co-spend block (handled on both the
// externalCall and externalOutState paths; this test reads B.outState.counter). It uses the SHARED stateful
// side-car (salt=0): a transitive co-spend can't brand to B, since the branded covenant checks input 0 = the
// outer caller (integrity is still enforced by B's baked covenant-hash + preimage bind). See section 13 step 4.
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
contract CallerK(bytes calleeAddr) {
    int lastSeen;
    function readAfterBump(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int newVal = ICalleeK(calleeAddr).outState.counter;
        this.lastSeen = newVal;
    }
}`;

describe('keccak256 builtin (keccak in a called external function)', () => {
  it('co-spends the side-car when the spent function calls an external keccak function (transitive)', async () => {
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
    // Deploy the SHARED stateful compute side-car (salt=0): a transitive co-spend can't brand to the callee
    // (the covenant brand-checks input 0 = the outer caller), so it uses the shared side-car.
    const calleeSidecarLock = binToHex(keccakComputeLockingBytecode(new Uint8Array(32), true));
    await provider.addUtxo(calleeSidecarLock, {
      ...randomUtxo({ satoshis: 100_000n }),
      token: { category: KECCAK_SIDECAR_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });

    const calleeAddr = calleeContract.withCategory(hexToBin(calleeCategory)).lockingBytecode;
    const callerContract = new Contract(callerArtifact, [calleeAddr], { provider });
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

  // Transitive + COMPLEX/nested arg: the callee hashes keccak256(keccak256(preimage)) (outer arg is complex,
  // recorded null). The SDK probes B in isolation to resolve the outer preimage (= keccak(preimage)) before
  // co-spending B's two side-cars. Two keccak calls -> two shared side-cars.
  const CALLEE_KECCAK_NESTED = `
pragma solidcash >=0.8.0;
interface ICalleeK {
    public int counter;
    function bump(bytes preimage, bytes32 expected);
}
contract CalleeKNested() is ICalleeK {
    int counter;
    function bump(bytes preimage, bytes32 expected) {
        require(keccak256(keccak256(preimage)) == expected);
        this.counter = this.counter + 1;
    }
}`;

  it('co-spends side-cars for a transitive COMPLEX/nested keccak (probes the callee in isolation)', async () => {
    const provider = createTestProvider();
    const calleeArtifact = compileString(CALLEE_KECCAK_NESTED);
    const callerArtifact = compileString(CALLER_NO_KECCAK);
    expect(calleeArtifact.abi.find((f) => f.name === 'bump')?.keccakPreimageParams).toEqual([null, 'preimage']);

    const calleeContract = new Contract(calleeArtifact, [], { provider });
    const { categoryId: calleeCategory } = await setupStatefulUtxos(
      provider, calleeContract, calleeArtifact.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    // Two shared stateful side-cars (one per keccak call).
    const calleeSidecarLock = binToHex(keccakComputeLockingBytecode(new Uint8Array(32), true));
    for (let i = 0; i < 2; i++) {
      await provider.addUtxo(calleeSidecarLock, {
        txid: (0x90 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
        token: { category: KECCAK_SIDECAR_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const preimage = hexToBin(VECTORS.zeros.preimage);
    const expected = keccak_256(keccak_256(preimage)); // keccak(keccak(preimage))

    const calleeAddr = calleeContract.withCategory(hexToBin(calleeCategory)).lockingBytecode;
    const callerContract = new Contract(callerArtifact, [calleeAddr], { provider });
    const { categoryId: callerCategory } = await setupStatefulUtxos(
      provider, callerContract, callerArtifact.stateLayout!, { lastSeen: 0n }, { saltContract: true },
    );

    const callerSc = StatefulContract.withCategory(callerContract, callerCategory);
    const calleeSc = StatefulContract.withCategory(calleeContract, calleeCategory);
    const tx = await callerSc.readAfterBump(alicePub, new SignatureTemplate(alicePriv))
      .withExternalCall(calleeSc, 'bump', [preimage, expected])
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
