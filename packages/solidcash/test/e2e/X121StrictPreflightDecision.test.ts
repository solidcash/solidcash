import { binToHex, createVirtualMachineBch2026 } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, MockNetworkProvider, StatefulContract, TransactionBuilder,
} from '../../src/index.js';
import { MOCK_CONSENSUS_LIMITS } from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X121 - resolves the X109 contradiction and DECIDES `_strictRecursiveVmPreflight` and `debugging.ts`.
 *
 * THE CONTRADICTION. Two measurements were said to be mutually exclusive:
 *   (A) applying `createVirtualMachineBch2026ForProvider(provider)` at `_strictRecursiveVmPreflight` refuses a
 *       `recursiveStateHandler` send at `operationCostBudgetPerByte: 150` that the provider still accepts;
 *   (B) the provider DOES enforce that budget, refusing a P2PKH spend at 150 x 167 = 25,050.
 *
 * (B) IS THE WRONG ONE, and the difference is not a provider profile - it is an attribution. The string
 * `Maximum operation cost: 25050 (density control length: 167)` is emitted by
 * `createVirtualMachineBch2026ForProvider`, which X109 row 2 also called on the same spend; it was read off the
 * faithful VM and attributed to `sendRawTransaction`. The submit path never produced it. `@mem-cash/validation`
 * @0.0.7 `TxVerifierConfig` has no `consensus` field and `createTxVerifier` never reads one - its
 * `createVmFacade(version, standard)` calls `createVirtualMachineBch2026(standard)` with libauth's stock
 * `ConsensusBch2026`. MockNetworkProvider's `consensus: overrides` object (built at `MockNetworkProvider.ts:80`)
 * is discarded; the `as ... & { consensus: ... }` cast at the call site is what hides that from the compiler.
 * X109 row 2 was RED at the commit that introduced it, in both of its dimensions.
 *
 * (A) reproduces exactly, and row 3 below pins it on the recursion shape it named.
 *
 * THE DECISION: do NOT apply the repair, at either site. The reason is not (A) - a preflight stricter than a
 * non-enforcing mock is only an annoyance. The reason is the DEFAULT profile. `MOCK_CONSENSUS_LIMITS` publishes
 * limits orders of magnitude ABOVE real consensus (10,000,000 operation cost per byte, 1,000,000-byte stack
 * items, 1,000,000-byte inputs), while the decider it feeds evaluates at libauth's stock 800 per byte. So
 * reading the published limits makes the preflight LOOSER than the network on the profile every caller gets
 * without configuring anything. Row 4 measures a recursion the current bare VM refuses, the provider-faithful VM
 * accepts, and the provider then refuses at broadcast: a fail-closed gate turned into an accept path.
 *
 * DIRECTION OF ERROR. Status quo (bare `createVirtualMachineBch2026()`, standard regime, stock consensus) errs
 * toward REJECTING: standard mode is uniformly stricter than consensus mode (hash iteration priced at 192 vs 64,
 * allowance 0.5 vs 3.5 per byte, plus the standard-only SigChecks and bytecode-length ceilings). The repair errs
 * toward ACCEPTING. Rejecting what the network accepts is an annoyance; accepting what the network rejects moves
 * the failure from build time to broadcast time, which is the direction that must not be taken.
 *
 * REGIME CONFOUND, CONTROLLED. MockNetworkProvider builds its verifier with `standard: policy.enforceDust`, so a
 * dust-disabled profile decides in the CONSENSUS regime while every bare caller evaluates in the STANDARD one.
 * Row 2 varies ONLY `enforceDust` and gets identical verdicts. The divergence is real but it explains nothing
 * here: at a fixed budget the two regimes differ by ~0.03% of the operation cost on this shape and flip no
 * verdict, and the mock never applies the published budget in either regime.
 *
 * SCOPE OF "NOTHING REACHES THE DECIDER". Row 7 adds `maximumInputBytes`: the default profile publishes
 * 1,000,000 and the decider refuses a 12,003-byte unlocking script quoting its own 10,000. So the premise
 * behind the `relaxedConsensus` gate at `StatefulTransactionBuilder.ts:2625` and `:2733` - that a relaxed mock
 * "may intentionally admit scripts hundreds of kilobytes long" - is false. That gate only selects a diagnostic
 * (skip `debug()`, use the observer tracer), so it costs diagnostics rather than soundness, and it is left
 * alone here: retuning it is a separate row, not this decision.
 */

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

/** BCH-2026 `densityControlBaseLength`. `maximumOperationCost = floor(density * operationCostBudgetPerByte)`. */
const DENSITY_BASE = 41;
/** libauth's stock `ConsensusBch2026.operationCostBudgetPerByte`. What the mem-cash decider actually applies. */
const STOCK_BUDGET_PER_BYTE = 800;

/**
 * Pull the ceiling and the density-control length out of a density refusal and prove the ceiling IS
 * `budgetPerByte x density`. Pinning the product rather than a literal is what makes this a measurement of the
 * value in force: it cannot pass against some unrelated ceiling, and it is immune to the per-run salt that
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
  const evaluate = (vm as { evaluate: (p: unknown) => { error?: string } }).evaluate;
  for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
    const { error } = evaluate.call(vm, { inputIndex, sourceOutputs, transaction });
    if (error) return `input ${inputIndex}: ${error}`;
  }
  return undefined;
};

const unlockingBytecodeLength = (builder: TransactionBuilder, inputIndex: number): number => (
  builder.buildLibauthTransaction(true).inputs[inputIndex].unlockingBytecode.length
);

async function recursionContract(provider: MockNetworkProvider): Promise<StatefulContract> {
  const artifact = compileString(SELF, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
  );
  return StatefulContract.withCategory(contract, categoryId);
}

/**
 * Run the real `.send()` and capture the exact builder `_strictRecursiveVmPreflight` is handed. The patch
 * DELEGATES to the original, so the gate under test still decides; capturing is the only way to evaluate the
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
    await (sc as unknown as Record<string, (a: bigint) => { send: () => Promise<unknown> }>)
      .decrement(argument).send();
    return { builder, error: undefined };
  } catch (error) {
    return { builder, error: (error as Error).message };
  } finally {
    proto._strictRecursiveVmPreflight = original;
  }
}

const costProfile = (operationCostBudgetPerByte: number, enforceDust: boolean): MockNetworkProvider => (
  new MockNetworkProvider({
    consensusLimits: { ...MOCK_CONSENSUS_LIMITS, operationCostBudgetPerByte }, policy: { enforceDust },
  })
);

describe('X121 - the strict recursive preflight must not read the provider limits', () => {
  it('1. the published operation cost budget never reaches the decider (falsifies X109 row 2)', async () => {
    // ONE provider, ONE transaction, both verdicts. Nothing can silently differ between them.
    const provider = costProfile(150, false);
    const sc = await recursionContract(provider);
    const { builder, error } = await sendCapturingPreflightInput(sc, 3n);
    expect(builder).toBeDefined();
    // The status quo gate accepted it, so the bytes did reach the provider - and the provider took them.
    expect(error).toBeUndefined();

    // A VM that DOES apply the published 150 refuses these exact bytes, and its ceiling is 150 x density.
    const faithful = evaluateAll(createVirtualMachineBch2026ForProvider(provider), builder!)!;
    expect(faithful).toMatch(/exceed the operation cost density limit/);
    const density = assertDensityCeiling(faithful, 150);
    // Guard on the arithmetic itself: the density length is the published-limit input, not a coincidence.
    expect(density).toBe(DENSITY_BASE + unlockingBytecodeLength(builder!, 0));
  });

  it('2. the decider ignores the published budget in BOTH regimes (regime confound controlled)', async () => {
    // enforceDust false -> mem-cash evaluates in the CONSENSUS regime; true -> STANDARD. Only that field differs.
    for (const enforceDust of [false, true]) {
      const provider = costProfile(150, enforceDust);
      expect(provider.policy.enforceDust).toBe(enforceDust);
      expect(provider.consensusLimits.operationCostBudgetPerByte).toBe(150);
      const sc = await recursionContract(provider);
      const { builder, error } = await sendCapturingPreflightInput(sc, 3n);
      expect(error, `regime enforceDust=${enforceDust} refused the send`).toBeUndefined();
      // GUARD: the accept is not because the bytes are innocuous - a VM applying the published 150 refuses them.
      const faithful = evaluateAll(createVirtualMachineBch2026ForProvider(provider), builder!)!;
      assertDensityCeiling(faithful, 150);
    }
  });

  it('3. GUARD: relaxing only the attacked field makes the faithful VM accept the same shape', async () => {
    // Differs from row 1 in `operationCostBudgetPerByte` alone. Without this, row 1 could be passing because the
    // faithful factory refuses this recursion under any profile.
    const provider = costProfile(800, false);
    const sc = await recursionContract(provider);
    const { builder, error } = await sendCapturingPreflightInput(sc, 3n);
    expect(error).toBeUndefined();
    expect(evaluateAll(createVirtualMachineBch2026ForProvider(provider), builder!)).toBeUndefined();
    expect(evaluateAll(createVirtualMachineBch2026(), builder!)).toBeUndefined();
  });

  it('4. THE DECISION: on the DEFAULT profile the repair would accept what the provider refuses', async () => {
    // Nothing is configured here. This is what every MockNetworkProvider caller gets.
    const provider = new MockNetworkProvider();
    expect(provider.consensusLimits.operationCostBudgetPerByte).toBe(10_000_000);
    const sc = await recursionContract(provider);
    const { builder, error } = await sendCapturingPreflightInput(sc, 24n);
    expect(builder).toBeDefined();

    // Status quo: the bare VM refuses, at libauth's stock 800 per byte, and `send()` never broadcasts.
    expect(error).toMatch(/Recursive state invocation failed concrete BCH VM preflight: input 0:/);
    expect(error).toMatch(/exceed the operation cost density limit/);
    assertDensityCeiling(error!, STOCK_BUDGET_PER_BYTE);
    const bare = evaluateAll(createVirtualMachineBch2026(), builder!)!;
    assertDensityCeiling(bare, STOCK_BUDGET_PER_BYTE);

    // The proposed repair ACCEPTS the very same bytes, because the provider publishes 10,000,000 per byte.
    expect(evaluateAll(createVirtualMachineBch2026ForProvider(provider), builder!)).toBeUndefined();

    // And the provider REFUSES them. Its own refusal names a ceiling of 800 x density - the stock value, not
    // the 10,000,000 it publishes. That is the decider stating, in its own message, which value is in force.
    let submitError: string | undefined;
    try { await provider.sendRawTransaction(builder!.build()); } catch (e) { submitError = (e as Error).message; }
    expect(submitError, 'the provider accepted the tx the bare preflight refused').toBeDefined();
    expect(submitError).toMatch(/mandatory-script-verify-flag-failed/);
    assertDensityCeiling(submitError!, STOCK_BUDGET_PER_BYTE);
  });

  it('4b. GUARD: a smaller recursion on the same DEFAULT profile settles everywhere', async () => {
    // Differs from row 4 only in the recursion depth, so row 4 cannot be passing because this shape or this
    // profile refuses everything.
    const provider = new MockNetworkProvider();
    const sc = await recursionContract(provider);
    const { builder, error } = await sendCapturingPreflightInput(sc, 3n);
    expect(error).toBeUndefined();
    expect(evaluateAll(createVirtualMachineBch2026(), builder!)).toBeUndefined();
    expect(evaluateAll(createVirtualMachineBch2026ForProvider(provider), builder!)).toBeUndefined();
  });

  it('5. the repair is a no-op for every live provider, so it buys nothing there', async () => {
    // Only MockNetworkProvider sets `consensusLimits`; Electrum/regtest/FullStack/BitcoinRpc leave it undefined,
    // and with no limits and no observer the factory returns libauth's own VM. Measured on the row-4 shape,
    // which is where the mock-relaxed VM diverges - so this is not a vacuous agreement.
    const provider = new MockNetworkProvider();
    const sc = await recursionContract(provider);
    const { builder } = await sendCapturingPreflightInput(sc, 24n);
    const bare = evaluateAll(createVirtualMachineBch2026(), builder!);
    expect(bare).toMatch(/exceed the operation cost density limit/);
    expect(evaluateAll(createVirtualMachineBch2026ForProvider(undefined), builder!)).toBe(bare);
    expect(evaluateAll(createVirtualMachineBch2026ForProvider({} as never), builder!)).toBe(bare);
    // Same shape, mock limits read: diverges. This is the field that makes the two calls differ.
    expect(evaluateAll(createVirtualMachineBch2026ForProvider(provider), builder!)).toBeUndefined();
  });

  it('6. debugging.ts: the .build() gate refuses an over-budget recursion the provider also refuses', async () => {
    // `StatefulContract._preflightRecursiveBuilder` calls `builder.debug()` and RETHROWS, so `debugging.ts`'s
    // bare `createVirtualMachineBch2026()` decides ACCEPT/REJECT for `.build()`. Same depth as row 4, whose
    // bytes the provider refuses - so this gate is currently ALIGNED with the decider and must stay bare.
    const provider = new MockNetworkProvider();
    const sc = await recursionContract(provider);
    await expect((sc as unknown as Record<string, (a: bigint) => { build: () => Promise<unknown> }>)
      .decrement(24n).build()).rejects.toThrow(
      /Recursive state invocation 'decrement' does not fit or fails its concrete BCH VM preflight/,
    );
  });

  it('6b. GUARD: the same .build() gate admits a within-budget recursion on the same profile', async () => {
    const provider = new MockNetworkProvider();
    const sc = await recursionContract(provider);
    await expect((sc as unknown as Record<string, (a: bigint) => { build: () => Promise<unknown> }>)
      .decrement(3n).build()).resolves.toBeDefined();
  });

  it('7. maximumInputBytes is fiction too: the decider holds the stock 10,000-byte ceiling', async () => {
    // The `relaxedConsensus` gate at StatefulTransactionBuilder.ts:2625 and :2733 assumes a relaxed mock "may
    // intentionally admit scripts hundreds of kilobytes long". It cannot: the decider names its own ceiling.
    const provider = new MockNetworkProvider();
    expect(provider.consensusLimits.maximumInputBytes).toBe(1_000_000);
    const submit = async (pushBytes: number): Promise<string> => {
      const locking = new Uint8Array([0x51]); // OP_TRUE
      const lockingHex = binToHex(locking);
      const utxo = randomUtxo({ satoshis: 2_000_000n });
      await provider.addUtxo(lockingHex, utxo);
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
    // 12,003 bytes: refused, and the refusal quotes the stock 10,000 rather than the published 1,000,000.
    expect(await submit(12_000)).toMatch(
      /Maximum bytecode length: 10000 bytes\. Unlocking bytecode length: 12003 bytes\./,
    );
    // GUARD: the identical script shape 2,040 bytes shorter is NOT refused for length - it fails on this
    // synthetic script's own leftover stack item. So the ceiling above is length-specific, not a blanket refusal.
    const shorter = await submit(9_960);
    expect(shorter).not.toMatch(/maximum bytecode length/i);
    expect(shorter).toMatch(/unexpected number of items on the stack/);
  });
});
