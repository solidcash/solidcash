import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin, createVirtualMachineBch2026, decodeTransactionUnsafe } from '@bitauth/libauth';
import { keccakSidecarLockingBytecode, keccakComputeLockingBytecode, KECCAK256_SHARED_SALT } from '@solidcash/utils';
import { Contract, StatefulContract, TransactionBuilder, SignatureTemplate } from '../src/index.js';
import type { VmResourceUsage } from '../src/index.js';
import { randomUtxo, generateLibauthSourceOutputs } from '../src/utils.js';
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

  // keccak256 defaults to the compute-and-commit model: deploy the compute side-car (a mutable NFT) once;
  // send() transparently co-spends it (reads the preimage from the 'preimage' param) and commits the result.
  await provider.addUtxo(binToHex(keccakComputeLockingBytecode(KECCAK256_SHARED_SALT)),
    randomUtxo({ satoshis: 5000n, token: { category: 'bb'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } } }));
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

  // Multiple keccak256 calls in one input (a = keccak256(p1); b = keccak256(p2)) are funded end-to-end by
  // send(): the re-entrant registrar defines the round once, and the SDK sizes the compute-budget pad by
  // the keccak call count so two blocks of compute fit.
  it('send() funds two keccak256 calls in one input', async () => {
    const provider = createTestProvider();
    const source = 'contract TwoK() { function run(bytes p1, bytes p2) { require(keccak256(p1) != keccak256(p2)); } }';
    const contract = new Contract(compileString(source), [], { provider });
    await provider.addUtxo(sidecarLockHex, randomUtxo({ satoshis: 5000n }));
    const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 200000n }));
    const feeFunder = await createFeeFunder(provider, 50000n);
    const tx = await new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.run(hexToBin('11'.repeat(32)), hexToBin('22'.repeat(32))))
      .addInput(feeFunder.utxo, feeFunder.unlocker)
      .addOutput({ to: contract.address, amount: 230000n })
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  // The re-entrant keccak256 is bounded only by the SHARED per-input compute budget: each call costs ~one
  // 136-byte block (~2.26M op), and the per-input budget tops out near ~8M at the consensus bytecode limit,
  // so up to 3 keccak256(<=136-byte) calls land per input; a 4th exceeds the budget.
  it('funds up to 3 keccak256 calls per input; a 4th exceeds the compute budget', async () => {
    const sendChained = async (n: number): Promise<string> => {
      const provider = createTestProvider();
      const calls = Array(n).fill('h = keccak256(h);').join(' ');
      const source = `contract KS() { function run(bytes32 x) { bytes32 h = x; ${calls} require(h != x); } }`;
      const contract = new Contract(compileString(source), [], { provider });
      await provider.addUtxo(sidecarLockHex, randomUtxo({ satoshis: 5000n }));
      const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 300000n }));
      const feeFunder = await createFeeFunder(provider, 80000n);
      const tx = await new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.run(hexToBin('22'.repeat(32))))
        .addInput(feeFunder.utxo, feeFunder.unlocker)
        .addOutput({ to: contract.address, amount: 360000n })
        .send();
      return tx.txid;
    };
    expect(await sendChained(3)).toMatch(/^[0-9a-f]{64}$/);
    await expect(sendChained(4)).rejects.toThrow(); // 4 * ~2.26M > ~8M per-input budget
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
contract CallerK(bytes calleeAddr) {
    int lastSeen;
    function readAfterBump(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int newVal = ICalleeK(calleeAddr).outState.counter;
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
    const calleeSidecarLock = binToHex(keccakSidecarLockingBytecode(hexToBin(calleeCategory)));
    await provider.addUtxo(calleeSidecarLock, randomUtxo({ satoshis: 5000n }));

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
});

// Compute-budget bench. The side-car only DEFINES the keccak256 body; every keccak256() call is an
// OP_INVOKE that EXECUTES in the SPENDING (main) input, so the work consumes the main input's BCH-2026
// operation-cost budget (operationCostBudgetPerByte * densityControlLength).
//
// A contract that hashes a `msg` argument then chains (calls - 1) more keccak256 over the digest,
// optionally padded with padBytes of inert script (a big constant fed through native sha256) to grow
// the input's script size.
const keccakBenchSource = (calls: number, padBytes = 0): string => `
contract KeccakBench() {
    function run(bytes msg) {
        ${padBytes > 0 ? `bytes pad = 0x${'aa'.repeat(padBytes)};\n        require(sha256(pad) != msg);` : ''}
        bytes32 h = keccak256(msg);
        ${Array(Math.max(0, calls - 1)).fill('h = keccak256(h);').join('\n        ')}
        require(h != 0x${'00'.repeat(32)});
    }
}`;

const vm2026 = createVirtualMachineBch2026();

// Compile + build a spend of `source` (a contract with a run(...) function), co-spend the keccak side-car,
// and return the full-tx verification result plus the MAIN contract input's (input 0) metrics from a direct
// BCH-2026 eval. getVmResourceUsage() refuses custom unlockers (the side-car), so we evaluate input 0
// directly with full source outputs: the contract loads the keccak blob from the co-spent side-car and runs
// it in input 0.
async function evalSpend(source: string, argsHex: string[]): Promise<{
  verify: true | string; input0: VmResourceUsage; input0Error?: string;
}> {
  const provider = createTestProvider();
  // These tests measure the INLINE keccak op-cost budget on the contract input; force the inline model
  // (single-call keccak now defaults to the compute-and-commit model, which runs keccak off the contract).
  const contract = new Contract(compileString(source, { keccakResultNft: false }), [], { provider });
  await provider.addUtxo(sidecarLockHex, randomUtxo({ satoshis: 5000n }));
  const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 200000n }));
  const feeFunder = await createFeeFunder(provider, 50000n);
  const builder = new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.run(...argsHex.map(hexToBin)))
    .addInput(feeFunder.utxo, feeFunder.unlocker)
    .addOutput({ to: contract.address, amount: 240000n });
  await builder.addRequiredSidecars();

  const transaction = decodeTransactionUnsafe(hexToBin(builder.build()));
  const sourceOutputs = generateLibauthSourceOutputs((builder as unknown as { inputs: never[] }).inputs);
  const verify = vm2026.verify({ sourceOutputs, transaction });
  const state = vm2026.evaluate({ inputIndex: 0, sourceOutputs, transaction });
  return { verify, input0: state.metrics, input0Error: state.error };
}

// One keccak256 over a msgLen-byte message plus (calls - 1) chained keccak256 over the digest.
function runKeccakSpend(opts: { msgLen?: number; calls?: number; padBytes?: number }): ReturnType<typeof evalSpend> {
  return evalSpend(keccakBenchSource(opts.calls ?? 1, opts.padBytes ?? 0), ['77'.repeat(opts.msgLen ?? 32)]);
}

// Two DISTINCT keccak256 calls on different preimages (the `a = keccak256(p1); b = keccak256(p2)` form),
// padded to fund the two blocks of compute in one input.
const twoDistinctSource = (padBytes: number): string => `
contract TwoKeccak() {
    function run(bytes p1, bytes p2) {
        bytes pad = 0x${'aa'.repeat(padBytes)};
        require(sha256(pad) != p1);
        bytes32 a = keccak256(p1);
        bytes32 b = keccak256(p2);
        require(a != b);
    }
}`;

// Measured on the BCH-2026 VM (keccak256 invoked in the main input). Two independent axes:
//
//   A. Message length (blocks WITHIN one keccak256 call). keccak256 absorbs the message block-by-block
//      at ~2.26M op cost per 136-byte block (32 B -> 1 block ~2.29M; 200 B -> 2 ~4.54M; 272 B -> 3
//      ~6.78M; 408 B -> 4 exceeds budget). The per-input budget is operationCostBudgetPerByte(800) *
//      densityControlLength, which tracks the spent script size, so it caps one keccak256 at ~3 blocks
//      (~407 bytes): ~8M op at the 10,000-byte consensus bytecode limit. See keccak-poc/README.md.
//   B. Distinct CALLS are RE-ENTRANT. The library blob is a one-shot registrar that OP_DEFINEs the round
//      once (at the function prologue), so multiple keccak256 calls and keccak256(keccak256(x)) work in
//      one input: each call OP_INVOKEs the pre-defined keccak-main, never redefining. The only remaining
//      limit is the SHARED per-input budget - N calls cost ~N * 2.26M, so ~3 keccak blocks total per
//      input (one long message, or up to ~3 short-message calls), paddable up to the bytecode-size limit.
//
// Padding the contract raises the budget at ~800 per byte (a 1000-byte pad adds ~808k budget), so budget
// is paddable up to the bytecode-size limit; the binding limit is the ~3-block-per-input compute cap.
describe('keccak256 compute-budget bench (main input)', () => {
  it('one keccak256(32-byte) hashes one block at ~2.29M operation cost', async () => {
    const { verify, input0 } = await runKeccakSpend({ msgLen: 32 });
    expect(verify).toBe(true);
    expect(input0.hashDigestIterations).toBeGreaterThan(0);
    expect(input0.operationCost).toBeGreaterThan(2_000_000);
    expect(input0.operationCost).toBeLessThan(2_600_000); // a single 136-byte block
  });

  it('cost scales ~2.26M per 136-byte block; one call absorbs up to ~3 blocks (~407 bytes)', async () => {
    const oneBlock = await runKeccakSpend({ msgLen: 32 });   // 1 block
    const twoBlock = await runKeccakSpend({ msgLen: 200 });  // 2 blocks
    const threeBlock = await runKeccakSpend({ msgLen: 272 }); // 3 blocks
    const fourBlock = await runKeccakSpend({ msgLen: 408 });  // 4 blocks - over budget
    expect(twoBlock.verify).toBe(true);
    expect(threeBlock.verify).toBe(true);
    // Roughly linear per block: 2 blocks ~= 2x, 3 blocks ~= 3x the single-block cost.
    expect(twoBlock.input0.operationCost / oneBlock.input0.operationCost).toBeGreaterThan(1.8);
    expect(threeBlock.input0.operationCost / oneBlock.input0.operationCost).toBeGreaterThan(2.7);
    // A 4th block exceeds the per-input operation-cost budget -> the ~3-block cap.
    expect(fourBlock.verify).not.toBe(true);
  });

  it('the per-input budget scales with script padding (~800 op-cost per byte)', async () => {
    const minimal = await runKeccakSpend({ msgLen: 32 });
    const padded = await runKeccakSpend({ msgLen: 32, padBytes: 1000 }); // +1000 bytes of inert script
    expect(padded.verify).toBe(true);
    const budgetGain = padded.input0.maximumOperationCost - minimal.input0.maximumOperationCost;
    expect(budgetGain).toBeGreaterThan(700_000); // ~800 * 1000
  });

  it('multiple keccak256 calls in one input are re-entrant (registrar defines the round once)', async () => {
    // keccak256(keccak256(msg)): 2 invokes. With enough script budget (padding to fund 2 blocks) it
    // verifies - the old "previously-defined function identifier" redefine abort is gone.
    const nested = await runKeccakSpend({ msgLen: 32, calls: 2, padBytes: 3500 });
    expect(nested.verify).toBe(true);
    // a = keccak256(p1); b = keccak256(p2) on distinct preimages also verifies.
    const twoDistinct = await evalSpend(twoDistinctSource(3500), ['77'.repeat(32), '88'.repeat(40)]);
    expect(twoDistinct.verify).toBe(true);
    // The round is defined exactly once, so a 2nd call never aborts on redefinition (even under-budget,
    // the failure mode would be a budget overflow, not "previously-defined").
    const underBudget = await runKeccakSpend({ msgLen: 32, calls: 2 });
    expect(String(underBudget.input0Error ?? '')).not.toContain('previously-defined');
  });
});
