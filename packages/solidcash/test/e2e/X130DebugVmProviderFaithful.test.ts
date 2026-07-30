import { readFileSync } from 'fs';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, MockNetworkProvider, SignatureTemplate, StatefulContract, TransactionBuilder,
} from '../../src/index.js';
import { MOCK_CONSENSUS_LIMITS } from '../../src/network/MockNetworkProvider.js';
import { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X130 - `.build()` now decides on the provider's published limits, so it agrees with the decider.
 *
 * `debugging.ts` DECIDES: `StatefulContract._preflightRecursiveBuilder` calls `builder.debug()` and rethrows,
 * so its VM is the accept/reject gate for `.build()` on a `recursiveStateHandler`. It built a bare
 * `createVirtualMachineBch2026()`, which at `@mem-cash/validation` 0.0.8 diverges from the decider in BOTH
 * directions. X121 rows 2/4/6 measured the divergence and pinned the fail-open half as a KNOWN GAP because the
 * repair needed a hunk in `libauth-template/LibauthTemplate.ts`. Both halves are landed now, together: an
 * optional parameter nobody supplies would read as provider-aware while behaving bare.
 *
 * EVERY BEHAVIOURAL CLAIM IS PINNED TO 0.0.8 and row 0 asserts it, for the reason X121 row 0 gives: at 0.0.7
 * `TxVerifierConfig` has no `consensus` field, the published overrides are silently dropped, and every verdict
 * here inverts.
 *
 * THE TWO DIRECTIONS, both measured below on the same transaction the gate decides:
 *
 * - FAIL-OPEN, now CLOSED (row 1). `decrement(3).build()` was ADMITTED at `operationCostBudgetPerByte: 150`
 *   while the decider refuses that shape. It is now refused, quoting 150 x 687 = 103,050.
 * - FAIL-CLOSED, now OPEN (row 2). `decrement(24).build()` was REFUSED at the stock 800 x density on the
 *   relaxed DEFAULT profile, which the decider accepts. NEWLY BUILDABLE, and reported rather than hidden.
 *
 * NEWLY BUILDABLE IS NOT A NEW WITNESS PATH. Nothing about the covenant scripts, the state derivation or the
 * signatures changed; a build-time gate stopped refusing what the network it is aimed at accepts, and the
 * decider still verifies every input at submit. Row 4 is what keeps that honest: the structural refusal is
 * unchanged, so rows 1 and 2 are a limits change rather than the gate falling silent.
 *
 * NOT WIDENED FOR ANY LIVE NETWORK (row 5). Only MockNetworkProvider publishes `consensusLimits`. A provider
 * that publishes none takes `createVirtualMachineBch2026ForProvider`'s early return and gets byte-identically
 * the VM this built before - row 5 measures that by clearing the field and watching the stock 800 come back.
 *
 * NOT CLAIMED: that these are security boundaries. The SDK is an untrusted witness constructor and this gate
 * is a correctness aid. A caller who skips `.build()` is not stopped by any of it.
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

/** A profile that differs from the relaxed mock default in `operationCostBudgetPerByte` and nothing else. */
const budgetProfile = (operationCostBudgetPerByte: number): MockNetworkProvider => (
  new MockNetworkProvider({ consensusLimits: { ...MOCK_CONSENSUS_LIMITS, operationCostBudgetPerByte } })
);

type Recursor = Record<string, (...a: bigint[]) => {
  send: () => Promise<{ txid: string }>; build: () => Promise<TransactionBuilder>;
}>;

async function recursionContract(provider: MockNetworkProvider, source = SELF): Promise<StatefulContract> {
  const artifact = compileString(source, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
  );
  return StatefulContract.withCategory(contract, categoryId);
}

const buildOutcome = async (
  provider: MockNetworkProvider, depth: bigint,
): Promise<{ builder?: TransactionBuilder; error?: string }> => {
  const sc = await recursionContract(provider) as unknown as Recursor;
  try { return { builder: await sc.decrement(depth).build() }; } catch (error) {
    return { error: (error as Error).message };
  }
};

/**
 * Run the real `.send()` and capture the exact fully funded, fully signed builder the strict preflight is
 * handed. `.build()` throws before returning one on a refused shape, so this is the only way to put the
 * DECIDER in front of the same bytes the gate refused.
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

describe('X130 - the debug VM decides on the published limits (@mem-cash/validation 0.0.8)', () => {
  it('0. VERSION GATE: the installed decider is 0.0.8, which every row below is pinned to', () => {
    expect(
      MEM_CASH_VALIDATION_VERSION,
      `@mem-cash/validation ${MEM_CASH_VALIDATION_VERSION} is installed. This file pins 0.0.8 - the version `
      + 'packages/solidcash/package.json declares (^0.0.8 means exactly 0.0.8 for a 0.0.x range) and yarn.lock '
      + 'resolves. At 0.0.7 TxVerifierConfig has no `consensus` field, MockNetworkProvider consensusLimits are '
      + 'silently dropped, and every verdict below is inverted. Reinstall the workspace rather than relaxing '
      + 'a row.',
    ).toBe('0.0.8');
  });

  it('1. FAIL-OPEN CLOSED: .build() refuses depth 3 at 150 x density, and so does the decider', async () => {
    // The exact shape X121 row 6 pinned as still-admitted. `.build()` now refuses it.
    const provider = budgetProfile(150);
    const { builder, error } = await buildOutcome(provider, 3n);
    expect(builder, '.build() still admits a shape the decider refuses').toBeUndefined();
    expect(error).toMatch(/Recursive state invocation 'decrement' does not fit or fails its concrete BCH VM/);
    expect(error).toMatch(/exceed the operation cost density limit/);
    const density = assertDensityCeiling(error!, 150);

    // And the DECIDER refuses that shape at the same published 150 x density, measured on the funded bytes
    // rather than inherited from another row. Density control length is `41 + unlockingBytecodeLength`, so the
    // send path's fully signed input is a byte or two off the build path's; the BUDGET is what must agree.
    const { builder: funded, error: sendError } = await sendCapturingPreflightInput(
      await recursionContract(provider), 3n,
    );
    expect(funded).toBeDefined();
    assertDensityCeiling(sendError!, 150);
    let submitError: string | undefined;
    try { await provider.sendRawTransaction(funded!.build()); } catch (e) { submitError = (e as Error).message; }
    expect(submitError, 'the decider accepted a shape .build() refused').toBeDefined();
    expect(submitError).toMatch(/mandatory-script-verify-flag-failed/);
    assertDensityCeiling(submitError!, 150);
    expect(density).toBeGreaterThan(0);
  });

  it('1b. GUARD: raising only the attacked field makes .build() and the decider both accept depth 3', async () => {
    // Differs from row 1 in `operationCostBudgetPerByte` alone, so row 1 cannot be passing because this shape
    // fails under any profile.
    const provider = budgetProfile(800);
    const { builder, error } = await buildOutcome(provider, 3n);
    expect(error).toBeUndefined();
    expect(builder).toBeDefined();
    // And the decider accepts the same shape. `.build()` hands back an UNFUNDED, UNSIGNED builder - submitting
    // its bytes fails `min relay fee not met` on any profile - so the decider is put in front of the funded,
    // signed transaction the send path produces instead.
    const { error: sendError } = await sendCapturingPreflightInput(await recursionContract(provider), 3n);
    expect(sendError, 'the decider refused a shape .build() admitted').toBeUndefined();
  });

  it('2. NEWLY BUILDABLE: depth 24 on the relaxed DEFAULT profile, which the decider accepts', async () => {
    // The FAIL-CLOSED half. Every unconfigured caller gets this profile; a bare VM applied the stock 800 per
    // byte and refused, while the provider publishes 10,000,000 and the decider accepts.
    const provider = new MockNetworkProvider();
    expect(provider.consensusLimits.operationCostBudgetPerByte).toBe(10_000_000);
    const { builder, error } = await buildOutcome(provider, 24n);
    expect(error, '.build() still refuses a depth the decider accepts').toBeUndefined();
    expect(builder).toBeDefined();
    // The decider settles the funded, signed form of the same shape (see row 1b on why not the built bytes).
    const { error: sendError } = await sendCapturingPreflightInput(await recursionContract(provider), 24n);
    expect(sendError, 'the decider refused a depth .build() now admits').toBeUndefined();
  });

  it('2b. GUARD: lowering only the attacked field to 800 refuses depth 24 again, quoting 800 x density', async () => {
    // Differs from row 2 in `operationCostBudgetPerByte` alone. It also reproduces the pre-repair verdict
    // exactly - the stock 800 is what a bare VM applied - so row 2 is the published value being read, not the
    // gate being removed.
    const provider = budgetProfile(STOCK_BUDGET_PER_BYTE);
    const { builder, error } = await buildOutcome(provider, 24n);
    expect(builder).toBeUndefined();
    expect(error).toMatch(/exceed the operation cost density limit/);
    assertDensityCeiling(error!, STOCK_BUDGET_PER_BYTE);
  });

  it('3. SECOND DIMENSION: a published maximumStackItemBytes of 8 refuses the 65-byte signature', async () => {
    // `operationCostBudgetPerByte` is not the only field that reaches the VM now. `.send()` runs `debug()` for
    // a standard non-covenant transaction, so this is the same decision on the ordinary send path.
    const strict = new MockNetworkProvider({
      consensusLimits: { ...MOCK_CONSENSUS_LIMITS, maximumStackItemBytes: 8 }, policy: { enforceDust: false },
    });
    await expect(p2pkhSpend(strict).then((builder) => builder.send()))
      .rejects.toThrow(/Maximum stack item length: 8 bytes\. Item length: 65 bytes/);
    // The decider refuses the same bytes for the same reason, so the gate refuses no more than the node does.
    const same = await p2pkhSpend(strict);
    await expect(strict.sendRawTransaction(same.build()))
      .rejects.toThrow(/Maximum stack item length: 8 bytes\. Item length: 65 bytes/);
  });

  it('3b. GUARD: raising only maximumStackItemBytes lets the identical spend settle', async () => {
    const relaxed = new MockNetworkProvider({
      consensusLimits: { ...MOCK_CONSENSUS_LIMITS, maximumStackItemBytes: 1_000_000 },
      policy: { enforceDust: false },
    });
    await expect(p2pkhSpend(relaxed).then((builder) => builder.send())).resolves.toBeDefined();
  });

  it('4. the structural refusal is UNCHANGED, so rows 1 and 2 are a limits change not a silenced gate', async () => {
    // An unbounded recursion has no depth the published budget can admit. If this had flipped to ACCEPT, rows
    // 1 and 2 would be evidence that `.build()` stopped checking rather than that it started reading.
    const provider = new MockNetworkProvider();
    const sc = await recursionContract(provider, UNBOUNDED) as unknown as Record<string, () => {
      build: () => Promise<TransactionBuilder>;
    }>;
    await expect(sc.recurse().build())
      .rejects.toThrow(/does not fit or fails its concrete BCH VM preflight/);
  });

  it('5. NOT WIDENED for a provider that publishes no limits: the stock 800 comes straight back', async () => {
    // Every live network (Electrum, regtest, FullStack, Bitcoin RPC) publishes no `consensusLimits`, so this is
    // the behaviour they all get: `createVirtualMachineBch2026ForProvider` early-returns libauth's own factory
    // and the debug VM is byte-identical to the pre-repair one. Clearing the field on a provider that WOULD
    // have admitted depth 24 (row 2) is what isolates the published limits as the only thing that changed.
    const provider = new MockNetworkProvider();
    const sc = await recursionContract(provider) as unknown as Recursor;
    (provider as unknown as { consensusLimits: unknown }).consensusLimits = undefined;
    let error: string | undefined;
    try { await sc.decrement(24n).build(); } catch (e) { error = (e as Error).message; }
    expect(error, 'a limits-less provider must decide exactly as the bare VM did').toBeDefined();
    assertDensityCeiling(error!, STOCK_BUDGET_PER_BYTE);
  });
});
