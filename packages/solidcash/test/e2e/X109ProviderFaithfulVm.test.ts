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
 * The row: `StatefulTransactionBuilder.ts` `_logCovenantFailureTrace` (:2668) and
 * `_strictRecursiveVmPreflight` (:2712) build a bare `createVirtualMachineBch2026()`. The first is reached
 * whenever `(provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000` is false, so a provider
 * publishing limits AT 10,000 lands there; the second has no gate at all and builds the bare VM for every
 * provider. The proposed repair was `createVirtualMachineBch2026ForProvider(provider)` at both.
 *
 * MEASURED ANSWER: do not apply it. The decision and its evidence live in
 * `X121StrictPreflightDecision.test.ts`, which measures the recursion path this file could not settle.
 *
 * TWO WRONG TURNS ARE RECORDED HERE, both instructive.
 *
 * (1) This file first argued from a grep - zero hits for `config.consensus` in `@mem-cash/validation` - that
 *     the published limits are "rules nothing enforces". Right conclusion, inadequate evidence.
 *
 * (2) It then "falsified" that, claiming the submit path refuses both a strict `maximumStackItemBytes` and a
 *     strict `operationCostBudgetPerByte`, the latter at exactly 150 x 167 = 25,050. THAT WAS THE REAL ERROR,
 *     and it was RED at the commit that introduced it, in both dimensions. The 25,050 string is emitted by
 *     `createVirtualMachineBch2026ForProvider`, which the same row also called on the same spend; it was read
 *     off the faithful VM and attributed to `sendRawTransaction`. Row 2 below now measures the submit path
 *     ACCEPTING both, which is what it always did.
 *
 * THE MECHANISM, now established rather than grepped: `@mem-cash/validation` @0.0.7 `TxVerifierConfig` has no
 * `consensus` field, and `createTxVerifier` never reads one - `createVmFacade(version, standard)` calls
 * `createVirtualMachineBch2026(standard)` with libauth's stock `ConsensusBch2026`. The overrides object built
 * at `MockNetworkProvider.ts:80-98` is discarded; the
 * `as Parameters<typeof createTxVerifier>[0] & { consensus: ... }` cast at :106 is what hides that from the
 * compiler. The `ConsensusCommon` patch at :264-271 reaches only libauth's COMMON checked-push helper, which
 * the CashToken introspection operations use - not the generic data-push path, so a 65-byte signature push
 * still settles under `maximumStackItemBytes: 8`.
 *
 * Consequence for the repair: for MockNetworkProvider the BARE VM is the faithful one and
 * `createVirtualMachineBch2026ForProvider` is the unfaithful one, in whichever direction the profile points.
 * On the DEFAULT profile it points at ACCEPT, which is the unsound direction. See X121 row 4.
 *
 * Rows 1 and 3 are unchanged and still stand: they compare the two FACTORIES, not the decider. Row 3 is row
 * 1's guard negative control, differing ONLY in `maximumStackItemBytes`.
 *
 * NOT claimed: that the regime (`standard`) is decisive. MockNetworkProvider builds its verifier with
 * `standard: policy.enforceDust`, so a dust-disabled profile decides in the consensus regime while both bare
 * callers evaluate in the standard one. X121 row 2 varies only that field and gets identical verdicts, so the
 * divergence is real but explains nothing here.
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

describe('X109 - the decider applies NONE of the published limits, so the bare VM is the faithful one', () => {
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

  it('2. the decider does NOT enforce the published limits, in either dimension', async () => {
    // maximumStackItemBytes: NOT enforced. A 65-byte signature push settles under a published limit of 8.
    const strictItem = new MockNetworkProvider({
      consensusLimits: limits(8), policy: { enforceDust: false },
    });
    const itemSpend = await buildP2pkhSpend(strictItem);
    await expect(strictItem.sendRawTransaction(itemSpend.build())).resolves.toBeTypeOf('string');
    // GUARD for that accept: the bytes DO violate the published limit - a VM applying it refuses them, naming
    // the published 8 and the offending 65. So the accept is the decider ignoring the field, not innocuous bytes.
    expect(evaluateInput0(createVirtualMachineBch2026ForProvider(strictItem), itemSpend))
      .toMatch(/Maximum stack item length: 8 bytes\. Item length: 65 bytes/);

    // operationCostBudgetPerByte: also NOT enforced. This is the field X109's previous row 2 claimed as its
    // strongest evidence, quoting 150 x 167 = 25,050 - a string the FAITHFUL VM emits, asserted below, and
    // which the submit path never produced.
    const strictCost = new MockNetworkProvider({
      consensusLimits: { ...limits(10_000), operationCostBudgetPerByte: 150 },
      policy: { enforceDust: false },
    });
    const costSpend = await buildP2pkhSpend(strictCost);
    await expect(strictCost.sendRawTransaction(costSpend.build())).resolves.toBeTypeOf('string');
    expect(evaluateInput0(createVirtualMachineBch2026ForProvider(strictCost), costSpend))
      .toMatch(/Maximum operation cost: 25050 \(density control length: 167\)/);
  });

  it('2b. GUARD: the same two spends also settle when the attacked limit is relaxed', async () => {
    // Each provider differs from its row-2 twin in exactly one field. Row 2 accepts and so does this, which is
    // the point: the submit verdict does not move when the field moves, in either direction.
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

  it('2c. the same two accepts hold with dust ON, so the regime is not what lets them through', async () => {
    // MockNetworkProvider passes `standard: policy.enforceDust` to mem-cash, so this pair decides in the
    // STANDARD regime while row 2's pair decides in the CONSENSUS one. Only that field differs.
    const strictItem = new MockNetworkProvider({
      consensusLimits: limits(8), policy: { enforceDust: true },
    });
    await expect(strictItem.sendRawTransaction((await buildP2pkhSpend(strictItem)).build()))
      .resolves.toBeTypeOf('string');
    const strictCost = new MockNetworkProvider({
      consensusLimits: { ...limits(10_000), operationCostBudgetPerByte: 150 },
      policy: { enforceDust: true },
    });
    await expect(strictCost.sendRawTransaction((await buildP2pkhSpend(strictCost)).build()))
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
