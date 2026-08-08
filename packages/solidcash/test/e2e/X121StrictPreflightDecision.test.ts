import { readFileSync } from 'fs';
import { binToHex, createVirtualMachineBch2026 } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { describe, expect, it } from 'vitest';
import {
  Contract, MockNetworkProvider, SignatureTemplate, StatefulContract, TransactionBuilder,
} from '../../src/index.js';
import { MOCK_CONSENSUS_LIMITS, MOCK_RELAXED_OPERATION_COST } from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X121 - `_strictRecursiveVmPreflight` MUST read the provider's limits, and `debugging.ts` should too.
 *
 * EVERY BEHAVIOURAL CLAIM HERE IS PINNED TO `@mem-cash/validation` 0.0.8, and row 0 asserts that version
 * before anything else runs. That is not ceremony: the answer inverts across a patch release of a test-only
 * dependency.
 *
 * - 0.0.8 `dist/types.d.ts:29` declares `consensus?: ConsensusOverrides` ("Private/test-network consensus
 *   overrides") and `dist/verifier.js` references `consensus` 28 times, so MockNetworkProvider's overrides
 *   (built at `MockNetworkProvider.ts:80-98`) reach the decider.
 * - 0.0.7 has neither the field nor any read of it. The overrides are silently dropped, the decider runs
 *   libauth's stock `ConsensusBch2026`, and every verdict below inverts.
 *
 * `packages/solidcash/package.json` declares `^0.0.8`, which for a `0.0.x` range means EXACTLY 0.0.8, and
 * `yarn.lock` resolves 0.0.8. So 0.0.8 is the only sanctioned version - yet installed trees in this repo have
 * been observed at BOTH, with 0.0.7 not even satisfying the declared range. A gate whose correctness flips on
 * a patch version the manifest already pins is fragile whichever answer is right; row 0 exists so a stale tree
 * fails naming that, instead of scattering opaque assertion failures.
 *
 * MEASURED AT 0.0.8. `createVirtualMachineBch2026ForProvider(provider)` agrees with the decider on every shape
 * tried: P2PKH and `decrement(3)` at `operationCostBudgetPerByte` 150 and 800, `maximumStackItemBytes: 8`,
 * `decrement(24)`/`(40)` on the relaxed default, in both dust regimes. A bare `createVirtualMachineBch2026()`
 * diverges in BOTH directions:
 *
 * - FAIL-OPEN under a strict profile: it accepts a P2PKH spend (row 1) and a `decrement(3)` (row 2) that the
 *   decider refuses at 150 x density.
 * - FAIL-CLOSED under the relaxed default: it refuses `decrement(24)`/`(40)` at the stock 800 x density that
 *   the decider accepts (row 4).
 *
 * The fail-open direction is the one that must not stand, so the repair is applied at
 * `_strictRecursiveVmPreflight`. Consequence reported rather than hidden: `decrement(24)` is NEWLY BUILDABLE on
 * the default profile. That is the gate ceasing to refuse what the network accepts, not a new witness path -
 * the covenant scripts and the state derivation are untouched, and the decider still verifies every input.
 *
 * TWO EARLIER CONCLUSIONS ARE RETRACTED, both measured against a stale 0.0.7 tree:
 *
 * - "The decider ignores the published limits, so the bare VM is the faithful one." False at 0.0.8. The reading
 *   of 0.0.7 was accurate; generalising it to this repo was not.
 * - "`maximumInputBytes` is fiction, so the `relaxedConsensus` gate rests on a false premise." Also false at
 *   0.0.8 - row 5 shows a 12,003-byte script clearing the published 1,000,000 instead of tripping a stock
 *   10,000. The gate's premise holds and that criticism is withdrawn.
 *
 * Measurement A - a `recursiveStateHandler` that settles at base and is refused once the limits are read - is
 * FALSIFIED at 0.0.8 by row 2: `forProvider` refuses `decrement(3)` at `operationCostBudgetPerByte: 150`, and
 * so does the decider, byte-identically. It held only at 0.0.7, where nothing enforced the budget.
 *
 * THE REPAIR IS FAIL-OPEN IF THIS TREE IS EVER AT 0.0.7, measured both ways. At 0.0.7 the decider applies the
 * stock 800 and REFUSES `decrement(24)`/`(40)`, while the repaired preflight reads the published 10,000,000 and
 * admits them - a broadcast-time failure that used to be a build-time one. Row 0 is the only thing standing
 * between that and silence, and a failing test is not a runtime guard. A runtime assertion in
 * `MockNetworkProvider`'s constructor - that the installed `@mem-cash/validation` honours `consensus` - would
 * make the SDK itself fail closed; that file is outside this worker's lease and it is filed as a follow-up.
 *
 * REGIME. MockNetworkProvider passes `standard: policy.enforceDust` to mem-cash, so a dust-disabled profile
 * decides in the CONSENSUS regime while this factory defaults to STANDARD. Rows 2 and 2b vary only that field
 * and no VERDICT moves; the decider's message text always matches the consensus-regime evaluation because
 * mem-cash reclassifies script errors through a second consensus VM. `standard` is left at the factory default
 * of `true` because it is the stricter regime, NOT because the two were shown equivalent - no shape was found
 * where their verdicts differ, and none is claimed.
 */

const MEM_CASH_VALIDATION_VERSION: string = JSON.parse(readFileSync(
  new URL('../../../../node_modules/@mem-cash/validation/package.json', import.meta.url), 'utf8',
)).version;

const SELF = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function decrement(int i) {
    this.x = this.x - i;
    if (i > 1) { decrement(i - 1); }
    require(i > 0);
  }
  function chk(int e) { require(this.x == e); }
}`;

const UNBOUNDED = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function recurse() {
    this.x = this.x + 1;
    recurse();
    require(this.x > 0);
  }
}`;

/** BCH-2026 `densityControlBaseLength`. `maximumOperationCost = floor(density * operationCostBudgetPerByte)`. */
const DENSITY_BASE = 41;
/** libauth's stock `ConsensusBch2026.operationCostBudgetPerByte`, i.e. what a BARE VM applies. */
const STOCK_BUDGET_PER_BYTE = 800;

/**
 * Pull the ceiling and density-control length out of a density refusal and prove the ceiling IS
 * `budgetPerByte x density`. Pinning the product rather than a literal is what makes this a measurement of the
 * value in force: it cannot pass against an unrelated ceiling, and it survives the per-run contract salt that
 * shifts the unlocking script by a byte.
 */
const assertDensityCeiling = (message: string, budgetPerByte: number): number => {
  const match = message.match(/Maximum operation cost: (\d+) \(density control length: (\d+)\)/);
  expect(match, `no density refusal in: ${message}`).not.toBeNull();
  const [ceiling, density] = [Number(match![1]), Number(match![2])];
  expect(ceiling).toBe(budgetPerByte * density);
  return density;
};

const evaluateAll = (vm: unknown, builder: TransactionBuilder): string | undefined => {
  const transaction = builder.buildLibauthTransaction(true);
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const { evaluate } = vm as { evaluate: (p: unknown) => { error?: string } };
  for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
    const { error } = evaluate.call(vm, { inputIndex, sourceOutputs, transaction });
    if (error) return `input ${inputIndex}: ${error}`;
  }
  return undefined;
};

const unlockingBytecodeLength = (builder: TransactionBuilder, inputIndex: number): number => (
  builder.buildLibauthTransaction(true).inputs[inputIndex].unlockingBytecode.length
);

const costProfile = (operationCostBudgetPerByte: number, enforceDust: boolean): MockNetworkProvider => (
  new MockNetworkProvider({
    consensusLimits: { ...MOCK_CONSENSUS_LIMITS, operationCostBudgetPerByte }, policy: { enforceDust },
  })
);

async function recursionContract(provider: MockNetworkProvider, source = SELF): Promise<StatefulContract> {
  const artifact = compileString(source, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
  );
  return StatefulContract.withCategory(contract, categoryId);
}

type Recursor = Record<string, (...a: bigint[]) => {
  send: () => Promise<{ txid: string }>; build: () => Promise<unknown>;
}>;

/**
 * Run the real `.send()` and capture the exact builder `_strictRecursiveVmPreflight` is handed. The patch
 * DELEGATES to the original, so the gate under test still decides; capturing is the only way to evaluate
 * candidate VMs against the same fully funded and signed bytes the deciding site sees.
 */
async function sendCapturingPreflightInput(
  sc: StatefulContract, argument: bigint,
): Promise<{ builder: TransactionBuilder | undefined; error: string | undefined }> {
  const proto = StatefulTransactionBuilder.prototype as unknown as Record<string, unknown>;
  const original = proto._strictRecursiveVmPreflight as (b: TransactionBuilder) => void;
  let builder: TransactionBuilder | undefined;
  proto._strictRecursiveVmPreflight = function capture(this: unknown, b: TransactionBuilder): void {
    builder = b;
    original.call(this, b);
  };
  try {
    await (sc as unknown as Recursor).decrement(argument).send();
    return { builder, error: undefined };
  } catch (error) {
    return { builder, error: (error as Error).message };
  } finally {
    proto._strictRecursiveVmPreflight = original;
  }
}

async function p2pkhSpend(provider: MockNetworkProvider): Promise<TransactionBuilder> {
  const contract = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const utxo = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(contract.address, utxo);
  const builder = new TransactionBuilder({ provider });
  builder.addInput(utxo, contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
  builder.addOutput({ to: contract.address, amount: 15_000n });
  return builder;
}

describe('X121 - the strict recursive preflight must read the provider limits (@mem-cash/validation 0.0.8)', () => {
  it('0. VERSION GATE: the installed decider is 0.0.8, which every row below is pinned to', () => {
    // If this fails, nothing else in this file means what it says. 0.0.7 drops the overrides entirely and
    // inverts every verdict here, and it does not satisfy the `^0.0.8` this package declares.
    expect(
      MEM_CASH_VALIDATION_VERSION,
      `@mem-cash/validation ${MEM_CASH_VALIDATION_VERSION} is installed. This file pins 0.0.8 - the version `
      + 'packages/solidcash/package.json declares (^0.0.8 means exactly 0.0.8 for a 0.0.x range) and yarn.lock '
      + 'resolves. At 0.0.7 TxVerifierConfig has no `consensus` field, MockNetworkProvider consensusLimits are '
      + 'silently dropped, and the preflight decision this file makes is inverted. Reinstall the workspace '
      + 'rather than relaxing a row.',
    ).toBe('0.0.8');
  });

  it('1. FAIL-OPEN on P2PKH: the bare VM accepts what the decider refuses at 150 x density', async () => {
    // One provider, one transaction, both verdicts - nothing can silently differ between them.
    const provider = costProfile(150, false);
    const builder = await p2pkhSpend(provider);

    expect(evaluateAll(createVirtualMachineBch2026(), builder)).toBeUndefined();
    const faithful = evaluateAll(createVirtualMachineBch2026ForProvider(provider), builder)!;
    const density = assertDensityCeiling(faithful, 150);
    expect(density).toBe(DENSITY_BASE + unlockingBytecodeLength(builder, 0));

    let submitError: string | undefined;
    try { await provider.sendRawTransaction(builder.build()); } catch (e) { submitError = (e as Error).message; }
    expect(submitError, 'the decider accepted a spend over its published budget').toBeDefined();
    expect(submitError).toMatch(/mandatory-script-verify-flag-failed/);
    expect(assertDensityCeiling(submitError!, 150)).toBe(density);
  });

  it('1b. GUARD: relaxing only the budget makes all three agree on accept', async () => {
    // Differs from row 1 in `operationCostBudgetPerByte` alone, so row 1 cannot be passing because this spend
    // fails under any profile.
    const provider = costProfile(800, false);
    const builder = await p2pkhSpend(provider);
    expect(evaluateAll(createVirtualMachineBch2026(), builder)).toBeUndefined();
    expect(evaluateAll(createVirtualMachineBch2026ForProvider(provider), builder)).toBeUndefined();
    await expect(provider.sendRawTransaction(builder.build())).resolves.toBeTypeOf('string');
  });

  it('2. FAIL-OPEN on recursion: Measurement A falsified, gate and decider both refuse', async () => {
    // Measurement A's exact shape and profile: a `recursiveStateHandler` at `operationCostBudgetPerByte: 150`.
    // It was reported to SETTLE while the repair refused it. At 0.0.8 the decider refuses it too.
    const provider = costProfile(150, false);
    const sc = await recursionContract(provider);
    const { builder, error } = await sendCapturingPreflightInput(sc, 3n);
    expect(builder).toBeDefined();

    // The repaired gate refuses, quoting the published 150 x density.
    expect(error).toMatch(/Recursive state invocation failed concrete BCH VM preflight: input 0:/);
    const density = assertDensityCeiling(error!, 150);
    expect(density).toBe(DENSITY_BASE + unlockingBytecodeLength(builder!, 0));

    // A bare VM would have ACCEPTED these exact bytes. That is the fail-open the repair closes.
    expect(evaluateAll(createVirtualMachineBch2026(), builder!)).toBeUndefined();

    // And the decider refuses them at the same published 150 x density. Nothing was broadcast, so submitting
    // the captured bytes exercises the identical transaction.
    let submitError: string | undefined;
    try { await provider.sendRawTransaction(builder!.build()); } catch (e) { submitError = (e as Error).message; }
    expect(submitError, 'the decider accepted what the repaired gate refused').toBeDefined();
    expect(submitError).toMatch(/mandatory-script-verify-flag-failed/);
    expect(assertDensityCeiling(submitError!, 150)).toBe(density);
  });

  it('2b. the same refusal holds with dust ON, so the regime is not what produces it', async () => {
    // enforceDust true -> mem-cash decides in the STANDARD regime; row 2 decided in CONSENSUS. Only that field
    // differs between the two providers.
    const provider = costProfile(150, true);
    expect(provider.policy.enforceDust).toBe(true);
    const sc = await recursionContract(provider);
    const { builder, error } = await sendCapturingPreflightInput(sc, 3n);
    const density = assertDensityCeiling(error!, 150);
    let submitError: string | undefined;
    try { await provider.sendRawTransaction(builder!.build()); } catch (e) { submitError = (e as Error).message; }
    expect(submitError).toBeDefined();
    expect(assertDensityCeiling(submitError!, 150)).toBe(density);
  });

  it('3. GUARD: relaxing only the attacked field makes gate and decider both accept the recursion', async () => {
    // Differs from row 2 in `operationCostBudgetPerByte` alone.
    const provider = costProfile(800, false);
    const sc = await recursionContract(provider);
    const { builder, error } = await sendCapturingPreflightInput(sc, 3n);
    expect(error).toBeUndefined();
    expect(evaluateAll(createVirtualMachineBch2026ForProvider(provider), builder!)).toBeUndefined();
    expect(evaluateAll(createVirtualMachineBch2026(), builder!)).toBeUndefined();
  });

  it('4. the bare VM was also FAIL-CLOSED: it refused a depth the decider accepts', async () => {
    // The relaxed DEFAULT profile - what every unconfigured caller gets. A bare VM applies the stock 800 per
    // byte and refuses; the provider publishes 10,000,000 and accepts. NEWLY BUILDABLE after the repair.
    //
    // DEPTH BAND, measured (unlocking script 684 B, density 725, stock ceiling 580,000, 3 trials each):
    //   depth 12, 20 -> bare ACCEPTS, decider accepts (below the ceiling)
    //   depth 24, 28, 40 -> bare REFUSES by 22, 14, 22, decider ACCEPTS   <- the divergence this row pins
    //   depth 80 -> bare refuses by 38 and the decider refuses too (its own limits finally bite)
    // The overshoot is always a handful of units because the refusal fires on the first operation past the
    // ceiling; that is inherent, not a fragile choice of depth. What IS fragile is the 20 -> 24 boundary: a
    // codegen change that shifts per-operation cost moves it, and this row would flip. If it ever does, read
    // the band above rather than relaxing the assertion.
    // Asked for the relaxed budget by way of the DEFAULT profile until the default became the real 800 (see
    // MOCK_CONSENSUS_LIMITS). What this row pins is bare-VM-versus-decider divergence at a PUBLISHED relaxed
    // budget, which is unchanged; it just has to name the budget now instead of inheriting it.
    const provider = costProfile(MOCK_RELAXED_OPERATION_COST, true);
    expect(provider.consensusLimits.operationCostBudgetPerByte).toBe(MOCK_RELAXED_OPERATION_COST);
    const sc = await recursionContract(provider);
    const { builder, error } = await sendCapturingPreflightInput(sc, 24n);
    expect(error, 'the repaired gate should no longer refuse this depth').toBeUndefined();
    expect(builder).toBeDefined();

    // The bare VM refuses these exact bytes at the stock 800 x density.
    const bare = evaluateAll(createVirtualMachineBch2026(), builder!)!;
    expect(bare).toMatch(/exceed the operation cost density limit/);
    assertDensityCeiling(bare, STOCK_BUDGET_PER_BYTE);
    // The provider-faithful VM accepts them, and so did the decider - the send above settled.
    expect(evaluateAll(createVirtualMachineBch2026ForProvider(provider), builder!)).toBeUndefined();
  });

  it('4b. GUARD: a smaller recursion on the same DEFAULT profile settles under both VMs', async () => {
    // Differs from row 4 only in depth, so row 4 cannot be passing because this profile refuses everything.
    const provider = new MockNetworkProvider();
    const sc = await recursionContract(provider);
    const { builder, error } = await sendCapturingPreflightInput(sc, 3n);
    expect(error).toBeUndefined();
    expect(evaluateAll(createVirtualMachineBch2026(), builder!)).toBeUndefined();
    expect(evaluateAll(createVirtualMachineBch2026ForProvider(provider), builder!)).toBeUndefined();
  });

  it('5. maximumInputBytes reaches the decider too: 12,003 bytes clears a published 1,000,000', async () => {
    // Retracts the earlier 0.0.7-derived claim that this field is fiction and that the `relaxedConsensus` gate
    // at StatefulTransactionBuilder.ts:2625/2733 rests on a false premise. At 0.0.8 the premise holds.
    const provider = new MockNetworkProvider();
    expect(provider.consensusLimits.maximumInputBytes).toBe(1_000_000);
    const submit = async (pushBytes: number): Promise<string> => {
      const locking = new Uint8Array([0x51]); // OP_TRUE
      const utxo = randomUtxo({ satoshis: 2_000_000n });
      await provider.addUtxo(binToHex(locking), utxo);
      const unlock = new Uint8Array(3 + pushBytes);
      unlock[0] = 0x4d; // OP_PUSHDATA2, the minimal encoding at these sizes
      new DataView(unlock.buffer).setUint16(1, pushBytes, true);
      const builder = new TransactionBuilder({ provider });
      builder.addInput(utxo, {
        generateUnlockingBytecode: () => unlock, generateLockingBytecode: () => locking,
      } as never);
      builder.addOutput({
        to: new Contract(p2pkhArtifact, [alicePkh], { provider }).address, amount: 500_000n,
      });
      try { await provider.sendRawTransaction(builder.build()); return 'ACCEPT'; } catch (e) { return (e as Error).message; }
    };
    // Well past the stock 10,000 and NOT refused for length: it reaches script evaluation and fails on this
    // synthetic script's own leftover stack item.
    const oversized = await submit(12_000);
    expect(oversized).not.toMatch(/maximum bytecode length/i);
    expect(oversized).toMatch(/unexpected number of items on the stack/);
    // GUARD: the identical shape below the stock ceiling fails the same way, so the row above is not passing
    // because 12,003 bytes trips something unrelated.
    expect(await submit(9_960)).toMatch(/unexpected number of items on the stack/);
  });

  it('6. the debugging.ts fail-open is CLOSED (X130): .build() reads the limits too', async () => {
    // INVERTED WHEN X130 LANDED. This pinned a KNOWN GAP rather than correct behaviour, and it was the only
    // test that noticed the closure - the throw census over 8,026 calls found exactly one newly-refused row,
    // and it was this one. `_preflightRecursiveBuilder` calls `builder.debug()` and rethrows, so this VM
    // DECIDES for `.build()`; it now reads the provider through `LibauthTemplate` -> `debugTemplate` ->
    // `createProgram`, both halves landed together so an optional parameter nobody supplies could not read as
    // provider-aware while behaving bare.
    // 140 rather than the 150 the other rows use: the budget is calibrated against this shape's operation
    // cost, and helper ids drawn from the single-byte pool shortened the recursive body enough that 150 no
    // longer refuses it. See X130 row 1, which pins the same shape at the same budget.
    const provider = costProfile(140, false);
    let buildError: string | undefined;
    try {
      await (await recursionContract(provider) as unknown as Recursor).decrement(3n).build();
    } catch (error) { buildError = (error as Error).message; }
    expect(buildError, '.build() still admits a shape the decider refuses').toBeDefined();
    // Pinned as budget x density, never as a literal, so it measures the PUBLISHED value.
    assertDensityCeiling(buildError!, 140);
    // And the decider refuses the same shape, measured on the funded bytes rather than inherited from row 2.
    const { error } = await sendCapturingPreflightInput(await recursionContract(provider), 3n);
    assertDensityCeiling(error!, 140);
  });

  it('6b. GUARD: the .build() gate still refuses a structurally unbounded recursion', async () => {
    // The bare debug VM remains a real gate for the structural case, so row 6 is a limits gap rather than a
    // claim that `.build()` checks nothing.
    const provider = new MockNetworkProvider();
    const artifact = compileString(UNBOUNDED, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect((sc as unknown as Recursor).recurse().build())
      .rejects.toThrow(/does not fit or fails its concrete BCH VM preflight/);
  });
});
