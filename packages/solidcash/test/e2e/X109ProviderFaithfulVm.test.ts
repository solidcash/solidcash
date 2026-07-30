import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import {
  Contract, MockNetworkProvider, SignatureTemplate, TransactionBuilder,
} from '../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X109 - two VM callers that discard the provider's limits, and why reading them is NOT the repair.
 *
 * The row: `StatefulTransactionBuilder.ts` `_logCovenantFailureTrace` (the row cited :2662, now :2668 after the
 * comment this measurement left at the site) and `_strictRecursiveVmPreflight` (:2691, now :2707) build a bare
 * `createVirtualMachineBch2026()`. The first is reached whenever
 * `(provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000` is false, so a provider publishing limits
 * AT 10,000 lands there; the second has no gate at all and builds the bare VM for every provider. The proposed
 * repair was `createVirtualMachineBch2026ForProvider(provider)` at both.
 *
 * MEASURED ANSWER: do not apply it - but NOT for the reason first recorded here, which was wrong and is kept
 * visible because the mistake is instructive.
 *
 * THE ORIGINAL FRAMING IS FALSIFIED, and the row is REOPENED rather than closed NO_CHANGE.
 *
 * This file first claimed the published limits are "rules nothing enforces", on the grounds that
 * `@mem-cash/validation`'s `createTxVerifier` never reads the `consensus` overrides MockNetworkProvider hands
 * it - a grep result with zero hits for `config.consensus`. The conclusion does not follow, and row 2 now
 * measures it failing in BOTH dimensions tested:
 *
 * - `maximumStackItemBytes: 8` -> the submit path REJECTS ("Maximum stack item length: 8 bytes. Item length:
 *   65 bytes"). Enforced partly via the `ConsensusCommon` patch at `MockNetworkProvider.ts:264-271`.
 * - `operationCostBudgetPerByte: 150` -> the submit path REJECTS at exactly 150 x 167 = 25,050 ("Maximum
 *   operation cost: 25050 (density control length: 167)"). Nothing patches this one; the overrides built at
 *   `MockNetworkProvider.ts:80-98` reach `createTxVerifier` and bite.
 *
 * So `createVirtualMachineBch2026ForProvider` appears FAITHFUL to the decider on both fields, which is the
 * opposite of what this file originally concluded, and it means the proposed repair may be correct.
 *
 * WHAT IS STILL UNRESOLVED, and why nothing was changed here. A separate measurement reported that applying
 * the limits at `_strictRecursiveVmPreflight` with `operationCostBudgetPerByte: 150` refuses a
 * `recursiveStateHandler` send that SETTLES at base while the provider still accepts it. If the decider
 * enforces that budget - as row 2 shows it does for a P2PKH spend - that claim and this one cannot both hold
 * for one configuration, so one of them is comparing two different provider profiles. The recursion path is
 * exactly where the risk lives and two P2PKH probes are not enough to settle it. Re-measurement is filed as
 * X121; do not apply the repair, and do not record NO_CHANGE, until that is resolved.
 *
 * Row 1 reproduces J2's divergence between the two FACTORIES independently, and that stands - it is a claim
 * about the two constructors, not about the decider. Row 3 is its guard negative control: it differs ONLY in
 * `maximumStackItemBytes`, so row 1 cannot be passing because the factory is stricter in general.
 *
 * NOT claimed: that the regime (`standard`) is decisive. MockNetworkProvider builds its verifier with
 * `standard: policy.enforceDust`, so a dust-disabled profile decides in the consensus regime while both bare
 * callers evaluate in the standard one - that divergence is real, but no shape was found where it changes an
 * outcome, so it is reported rather than repaired.
 */

const limits = (maximumStackItemBytes: number): any => ({
  maximumInputBytes: 10_000,
  maximumStackItemBytes,
  maximumTransactionBytes: 1_000_000,
  maximumNftCommitmentBytes: 128,
  operationCostBudgetPerByte: 800,
  hashDigestIterationsPerByte: 3,
});

/** One ordinary P2PKH spend: its unlocking script pushes a 33-byte key and a ~65-byte signature. */
async function buildP2pkhSpend(provider: MockNetworkProvider): Promise<TransactionBuilder> {
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const utxo = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, utxo);
  const builder = new TransactionBuilder({ provider });
  builder.addInput(utxo, p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
  builder.addOutput({ to: p2pkh.address, amount: 15_000n });
  return builder;
}

const evaluateInput0 = (
  vm: ReturnType<typeof createVirtualMachineBch2026>, builder: TransactionBuilder,
): string | undefined => (vm.evaluate({
  inputIndex: 0,
  sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
  transaction: builder.buildLibauthTransaction(),
}) as { error?: string }).error;

describe('X109 - which published limits the decider actually applies, and why the repair is a regression', () => {
  it('1. the bare VM accepts what the provider-faithful VM rejects, with the gate reading false', async () => {
    const provider = new MockNetworkProvider({
      consensusLimits: limits(8), policy: { enforceDust: false },
    });
    // The exact gate both call sites use. A provider AT 10,000 is "not relaxed", so both reach the bare VM.
    expect((provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000).toBe(false);
    const builder = await buildP2pkhSpend(provider);
    expect(evaluateInput0(createVirtualMachineBch2026(), builder)).toBeUndefined();
    expect(evaluateInput0(createVirtualMachineBch2026ForProvider(provider), builder))
      .toMatch(/exceeded the maximum stack item length/);
  });

  it('2. the decider DOES enforce the published limits, in both dimensions tested', async () => {
    // maximumStackItemBytes: enforced. This is the field row 1 attacks, so on that field the faithful factory
    // AGREES with the decider rather than being stricter than it.
    const strictItem = new MockNetworkProvider({
      consensusLimits: limits(8), policy: { enforceDust: false },
    });
    const itemSpend = await buildP2pkhSpend(strictItem);
    await expect(strictItem.sendRawTransaction(itemSpend.build()))
      .rejects.toThrow(/Maximum stack item length: 8 bytes/);

    // operationCostBudgetPerByte: also enforced, and nothing patches this one - the overrides reach
    // createTxVerifier and bite. The refusal arithmetic is exact, which is what makes this a measurement of the
    // published value rather than of some unrelated ceiling: 150 per byte x 167 density-control bytes = 25,050.
    const strictCost = new MockNetworkProvider({
      consensusLimits: { ...limits(10_000), operationCostBudgetPerByte: 150 },
      policy: { enforceDust: false },
    });
    const costSpend = await buildP2pkhSpend(strictCost);
    await expect(strictCost.sendRawTransaction(costSpend.build()))
      .rejects.toThrow(/Maximum operation cost: 25050 \(density control length: 167\)/);
    // And the faithful factory refuses it for the same reason, which is the agreement this row establishes.
    expect(evaluateInput0(createVirtualMachineBch2026ForProvider(strictCost), costSpend))
      .toMatch(/operation cost/i);
  });

  it('2b. GUARD: the same two spends settle when only the attacked limit is relaxed', async () => {
    // Without this, row 2 could be passing because these spends fail under ANY profile. Each provider below
    // differs from its row-2 twin in exactly one field.
    const okItem = new MockNetworkProvider({
      consensusLimits: limits(10_000), policy: { enforceDust: false },
    });
    await expect(okItem.sendRawTransaction((await buildP2pkhSpend(okItem)).build()))
      .resolves.toBeTypeOf('string');
    const okCost = new MockNetworkProvider({
      consensusLimits: { ...limits(10_000), operationCostBudgetPerByte: 800 },
      policy: { enforceDust: false },
    });
    await expect(okCost.sendRawTransaction((await buildP2pkhSpend(okCost)).build()))
      .resolves.toBeTypeOf('string');
  });

  it('3. guard negative control: raising only the attacked field makes the faithful VM accept', async () => {
    const provider = new MockNetworkProvider({
      consensusLimits: limits(10_000), policy: { enforceDust: false },
    });
    const builder = await buildP2pkhSpend(provider);
    expect(evaluateInput0(createVirtualMachineBch2026(), builder)).toBeUndefined();
    expect(evaluateInput0(createVirtualMachineBch2026ForProvider(provider), builder)).toBeUndefined();
  });
});
