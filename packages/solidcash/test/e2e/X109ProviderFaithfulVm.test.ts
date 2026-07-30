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
 * MEASURED ANSWER: do not apply it. Its premise - that `ForProvider` reproduces "the provider's own verifier" -
 * is false for the only in-tree provider that publishes limits. `@mem-cash/validation`'s `createTxVerifier`
 * never reads the `consensus` overrides MockNetworkProvider hands it: `createVmFacade` calls libauth's
 * `createVirtualMachineBch2026(standard)` and nothing in that package references `config.consensus`. So the
 * verifier that DECIDES applies ordinary BCH-2026 limits, and a caller reading the published limits reports
 * under rules nothing enforces.
 *
 * Row 1 below reproduces J2's divergence independently. Row 2 shows the same published limit is not enforced by
 * the verifier that decides, which is what turns the proposed repair into a preflight that rejects transactions
 * the network accepts. Row 3 is the guard negative control: it differs from row 1 ONLY in
 * `maximumStackItemBytes`, so row 1 cannot be passing because the factory is stricter in general.
 *
 * SEPARATELY MEASURED, not pinned here because it needs a `recursiveStateHandler` fixture: with the published
 * limits applied at `_strictRecursiveVmPreflight` and `operationCostBudgetPerByte: 150`, a recursive send that
 * SETTLES at base is refused with "Program attempted an operation that would exceed the operation cost density
 * limit" while the provider still accepts it.
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

describe('X109 - the published limits are not the rules the verifier applies', () => {
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

  it('2. and the verifier that DECIDES accepts it too, so reading the limits would reject a valid send', async () => {
    const provider = new MockNetworkProvider({
      consensusLimits: limits(8), policy: { enforceDust: false },
    });
    const builder = await buildP2pkhSpend(provider);
    // Same 8-byte published limit, same transaction: the provider's own submission path accepts it, because
    // `createTxVerifier` never applies the `consensus` overrides it is given.
    await expect(provider.sendRawTransaction(builder.build())).resolves.toBeTypeOf('string');
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
