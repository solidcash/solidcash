import { readFileSync } from 'fs';
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
 * X109 - two VM callers that discarded the provider's limits. Reading them IS the repair; see X121.
 *
 * The row: `StatefulTransactionBuilder.ts` `_logCovenantFailureTrace` and `_strictRecursiveVmPreflight` built a
 * bare `createVirtualMachineBch2026()`. The tracer is reached whenever
 * `(provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000` is false, so a provider publishing limits
 * AT 10,000 lands there; the preflight had no gate at all and built the bare VM for every provider.
 *
 * ANSWER: apply it at the preflight, which is done. `X121StrictPreflightDecision.test.ts` carries the decision,
 * the recursion measurements, and the version pin. This file keeps only the factory-level claims.
 *
 * THIS FILE RECORDED THREE WRONG TURNS. All three are kept visible because each failed differently.
 *
 * (1) It argued from a grep - zero hits for `config.consensus` in `@mem-cash/validation` - that the published
 *     limits are "rules nothing enforces". Inadequate evidence, and version-blind.
 * (2) It then claimed the submit path enforces both a strict `maximumStackItemBytes` and a strict
 *     `operationCostBudgetPerByte`, quoting 150 x 167 = 25,050. That row was RED at the commit that introduced
 *     it, because the 25,050 string is emitted by `createVirtualMachineBch2026ForProvider` - which the same row
 *     also called on the same spend - and was attributed to `sendRawTransaction`.
 * (3) It then "settled" the row the other way by measuring `@mem-cash/validation` 0.0.7, where the overrides
 *     genuinely are dropped, and concluded the bare VM is the faithful one. THAT is the conclusion that
 *     mattered and it was wrong for this repo: `packages/solidcash/package.json` declares `^0.0.8` (exactly
 *     0.0.8 for a 0.0.x range) and `yarn.lock` resolves 0.0.8. The 0.0.7 reading was accurate; generalising it
 *     was not.
 *
 * AT 0.0.8 - the sanctioned version - `TxVerifierConfig.consensus` exists, MockNetworkProvider's overrides
 * (`MockNetworkProvider.ts:80-98`) reach the decider, and `createVirtualMachineBch2026ForProvider` agrees with
 * it on every shape measured while the bare VM diverges in both directions. Row 2 below now measures the submit
 * path REFUSING both dimensions, which is 0.0.8 behaviour and is pinned as such.
 *
 * Rows 1 and 3 are unchanged and are version-independent: they compare the two FACTORIES, not the decider.
 * Row 3 is row 1's guard negative control, differing ONLY in `maximumStackItemBytes`.
 *
 * NOT claimed: that the regime (`standard`) is decisive. MockNetworkProvider builds its verifier with
 * `standard: policy.enforceDust`, so a dust-disabled profile decides in the consensus regime while both bare
 * callers evaluate in the standard one. Row 2c varies only that field and no verdict moves, so the divergence
 * is real but explains nothing here.
 */

const MEM_CASH_VALIDATION_VERSION: string = JSON.parse(readFileSync(
  new URL('../../../../node_modules/@mem-cash/validation/package.json', import.meta.url), 'utf8',
)).version;

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

describe('X109 - the decider applies the published limits (@mem-cash/validation 0.0.8)', () => {
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

  it('2. the decider DOES enforce the published limits, in both dimensions [0.0.8]', async () => {
    // VERSION-DEPENDENT. At 0.0.7 both submits below ACCEPT, because TxVerifierConfig has no `consensus` field
    // and the overrides are dropped. X121 row 0 is the version gate; this row states which side it pins.
    expect(MEM_CASH_VALIDATION_VERSION, 'this row pins 0.0.8 behaviour').toBe('0.0.8');

    // maximumStackItemBytes: enforced. The refusal names the published 8 and the offending 65-byte signature.
    const strictItem = new MockNetworkProvider({
      consensusLimits: limits(8), policy: { enforceDust: false },
    });
    const itemSpend = await buildP2pkhSpend(strictItem);
    await expect(strictItem.sendRawTransaction(itemSpend.build()))
      .rejects.toThrow(/Maximum stack item length: 8 bytes\. Item length: 65 bytes/);
    // And the faithful factory refuses the same bytes for the same reason - the agreement this row establishes.
    expect(evaluateInput0(createVirtualMachineBch2026ForProvider(strictItem), itemSpend))
      .toMatch(/Maximum stack item length: 8 bytes\. Item length: 65 bytes/);

    // operationCostBudgetPerByte: also enforced. The arithmetic is exact, which is what makes this a
    // measurement of the published value rather than of an unrelated ceiling: 150 per byte x 167
    // density-control bytes = 25,050. Both the decider and the faithful factory quote it.
    const strictCost = new MockNetworkProvider({
      consensusLimits: { ...limits(10_000), operationCostBudgetPerByte: 150 },
      policy: { enforceDust: false },
    });
    const costSpend = await buildP2pkhSpend(strictCost);
    await expect(strictCost.sendRawTransaction(costSpend.build()))
      .rejects.toThrow(/Maximum operation cost: 25050 \(density control length: 167\)/);
    expect(evaluateInput0(createVirtualMachineBch2026ForProvider(strictCost), costSpend))
      .toMatch(/Maximum operation cost: 25050 \(density control length: 167\)/);
  });

  it('2b. GUARD: the same two spends settle when only the attacked limit is relaxed', async () => {
    // Each provider differs from its row-2 twin in exactly one field, so row 2 cannot be passing because these
    // spends fail under any profile.
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

  it('2c. the same two refusals hold with dust ON, so the regime is not what produces them', async () => {
    // MockNetworkProvider passes `standard: policy.enforceDust` to mem-cash, so this pair decides in the
    // STANDARD regime while row 2's pair decides in the CONSENSUS one. Only that field differs, and no verdict
    // moves - which is why the regime is reported as real but not decisive.
    const strictItem = new MockNetworkProvider({
      consensusLimits: limits(8), policy: { enforceDust: true },
    });
    await expect(strictItem.sendRawTransaction((await buildP2pkhSpend(strictItem)).build()))
      .rejects.toThrow(/Maximum stack item length: 8 bytes/);
    const strictCost = new MockNetworkProvider({
      consensusLimits: { ...limits(10_000), operationCostBudgetPerByte: 150 },
      policy: { enforceDust: true },
    });
    await expect(strictCost.sendRawTransaction((await buildP2pkhSpend(strictCost)).build()))
      .rejects.toThrow(/Maximum operation cost: 25050 \(density control length: 167\)/);
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
