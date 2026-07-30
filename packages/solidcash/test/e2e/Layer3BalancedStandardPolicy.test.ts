import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { dustOutputs, formatDustOutputs } from './layer3-semantic-profile.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Audit P13: a committed, reproducible standard-policy gate that runs in ordinary CI (no node reconfiguration).
// It builds the balanced transcript transactions and asserts each satisfies BCH mainnet STANDARD-RELAY limits,
// so a policy regression is caught deterministically. Actual mempool acceptance under a standard-policy node
// is separately covered by test/regtest/standard-policy-harness.sh.
//
// R3-6, AND READ THIS BEFORE QUOTING THE FILE'S TITLE. Both named limits were pre-May-2026 and both are now
// the real ones, which makes the two ceilings LOOSE for this shape rather than binding: this transcript's
// widest unlocking script is roughly a seventh of 10,000 and its widest commitment a quarter of 128, both
// printed by the run. So the ceiling assertions alone cannot fail on any shape this file builds, and a gate
// that cannot fail is not a gate. What carries the row instead is stated where it is asserted: the co-spent
// half INSPECTS something (it inspected nothing at all for four rounds), the covenant witnesses really are in
// the measured population, BCHN's own dust rule is evaluated on the serialized bytes, and the two worst
// readings are pinned against a growth band so a regression is caught by a figure rather than by a ceiling
// nothing approaches.
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const num8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
// THE REAL BCH-2026 LIMITS. `input-unlocking-bytes` is 10,000 - `layer3-production-envelope-r1.ts` carries it
// with the measurement, X49 having accepted a 6,035-byte scriptSig on BCHN v29, so the legacy 1,650-byte
// standard limit is gone and the standard and consensus ceilings coincide. `maximumNftCommitmentBytes` is 128
// in May 2026, and `layer3-semantic-profile.ts` lists it as the one knob it does NOT relax. The figures this
// file used to publish as "what mainnet requires" were 6.1x and 3.2x too strict.
const MAX_UNLOCKING = 10_000;
const MAX_COMMITMENT = 128;
// Growth band, so the row fails on a REGRESSION rather than only on a ceiling this shape is nowhere near.
// Both are generous multiples of the reading printed by the run, not the reading itself: the point is to catch
// a shape that has grown by an order of magnitude, not to go red on ordinary covenant churn.
const UNLOCKING_GROWTH_BAND = 4_000;
const COMMITMENT_GROWTH_BAND = 64;
const A_CAT = 'a1'.repeat(32);
const B_CAT = 'b2'.repeat(32);
const DEPOSIT = layer3.methodSelector('deposit');
const CREDIT = layer3.methodSelector('credit');

interface BuiltJournalTx {
  inputs: any[];
  outputs: any[];
  /**
   * The outputs this transaction SPENDS, which is where a co-spent NFT commitment actually lives.
   *
   * R3-6. `buildLibauthTransaction()` maps an input to exactly four fields - `outpointIndex`,
   * `outpointTransactionHash`, `sequenceNumber`, `unlockingBytecode` - so a libauth input has no `token` field
   * at all. The commitment test read `input.token?.nft?.commitment` behind an `if (c)` and therefore skipped
   * every input on every run: the co-spent half of a test titled "every co-spent/created NFT commitment" had
   * never executed. The spent outputs are the correct subject and they carry the tokens.
   */
  sourceOutputs: any[];
}

async function buildJournalTx(): Promise<BuiltJournalTx> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const gen = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = gen.categoryId;
  const blocks: layer3.BalancedBlock[] = [{ dataSlots: 1, events: 0 }, { dataSlots: 1, events: 0 }];
  const resources: layer3.ExecutionResource[] = [{ owner: 0, categoryHex: A_CAT }, { owner: 1, categoryHex: B_CAT }];
  const edges: layer3.ExecutionInvocation[] = [
    { caller: 0, callee: 1, selectorHex: DEPOSIT, argsHex: binToHex(num8(5n)) },
    { caller: 1, callee: 0, selectorHex: CREDIT, argsHex: binToHex(num8(15n)) },
  ];
  const common = { blocks, invocations: edges, controllerCategory: ctrlCat, controllerLbc: ctrlLbc, resources };
  const a = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Payer', functionName: 'pay', selfPos: 0, journal: { ops: { [CREDIT]: 'add' } },
  })), [], { provider });
  const b = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Vault', functionName: 'take', selfPos: 1, journal: { ops: { [DEPOSIT]: 'add' }, emits: [1] },
  })), [], { provider });
  const root = layer3.executionRoot([a.lockingBytecode, b.lockingBytecode], edges, [], resources);
  const p2 = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const setB = new TransactionBuilder({ provider });
  setB.addInput(gen.utxos[0], controller.unlock.setRoot(hexToBin(root), alicePub, sig()));
  const setFee = randomUtxo({ satoshis: 20000n }); await provider.addUtxo(p2.address, setFee);
  setB.addInput(setFee, p2.unlock.spend(alicePub, sig()));
  setB.addOutput({
    to: controller.tokenAddress, amount: gen.utxos[0].satoshis,
    token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  setB.addOutput({ to: p2.address, amount: 15000n });
  await provider.sendRawTransaction(binToHex((await import('@bitauth/libauth')).encodeTransaction(setB.buildLibauthTransaction())));
  const ctrlUtxo = (await provider.getUtxos(controller.tokenAddress)).find((u: any) => u.token?.nft?.commitment === root);
  const aExec = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(a.address, aExec);
  const bExec = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(b.address, bExec);
  const aState = randomUtxo({ satoshis: 4000n, token: { category: A_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(100n)) } } });
  const bState = randomUtxo({ satoshis: 4000n, token: { category: B_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(10n)) } } });
  await provider.addUtxo(p2.address, aState); await provider.addUtxo(p2.address, bState);
  const fee = randomUtxo({ satoshis: 60000n }); await provider.addUtxo(p2.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(aExec, a.unlock.pay());
  tx.addInput(aState, p2.unlock.spend(alicePub, sig()));
  tx.addInput(bExec, b.unlock.take());
  tx.addInput(bState, p2.unlock.spend(alicePub, sig()));
  tx.addInput(ctrlUtxo, controller.unlock.attest());
  tx.addInput(fee, p2.unlock.spend(alicePub, sig()));
  tx.addOutput({ to: p2.address, amount: 1000n });
  tx.addOutput({ to: p2.tokenAddress, amount: aState.satoshis, token: { category: A_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(115n)) } } });
  tx.addOutput({ to: p2.address, amount: 1000n });
  tx.addOutput({ to: p2.tokenAddress, amount: bState.satoshis, token: { category: B_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(15n)) } } });
  tx.addOutput({ to: controller.tokenAddress, amount: ctrlUtxo.satoshis, token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } } });
  tx.addOutput({ to: p2.address, amount: 10000n });
  const built = tx.buildLibauthTransaction();
  return {
    inputs: built.inputs,
    outputs: built.outputs,
    sourceOutputs: generateLibauthSourceOutputs(tx.inputs as never),
  };
}

/** Every NFT commitment on one side of the transaction, empty ones included, with where it came from. */
function commitmentsOf(side: string, ios: readonly any[]): { side: string; index: number; bytes: number }[] {
  return ios.flatMap((io, index) => (io.token?.nft === undefined
    ? []
    : [{ side, index, bytes: (io.token.nft.commitment as Uint8Array).length }]));
}

describe('P13: balanced transcript transactions satisfy standard relay policy (committed CI gate)', () => {
  it('every input unlocking script is within the real 10,000-byte per-input limit', async () => {
    const { inputs } = await buildJournalTx();
    const lengths = inputs.map((input) => input.unlockingBytecode.length);
    const worst = Math.max(...lengths);
    console.log(`[P13] unlocking scripts, bytes: ${lengths.join(', ')}`);
    console.log(`[P13] worst unlocking ${worst} B of ${MAX_UNLOCKING} `
      + `(${(worst * 100 / MAX_UNLOCKING).toFixed(1)}% of the limit)`);
    // LIVENESS. `buildLibauthTransaction` initialises every `unlockingBytecode` to an empty array and fills it
    // in before returning; a shape that stopped being filled in would satisfy the ceiling with zeros.
    expect(lengths, 'the built transaction carries no input').not.toEqual([]);
    expect(Math.min(...lengths), 'an input carries an EMPTY unlocking script').toBeGreaterThan(0);
    // And the COVENANT witnesses are in the measured population, not only the p2pkh spends. A p2pkh unlocker
    // is about 100 bytes; the three layer-3 routes push whole redeem scripts, so the worst reading has to be
    // far above that or the measurement is of the funding inputs alone.
    expect(worst, 'no input pushes a covenant redeem script, so the widest witness is not in this reading')
      .toBeGreaterThan(500);
    for (const length of lengths) expect(length).toBeLessThanOrEqual(MAX_UNLOCKING);
    // The growth band, which is what can actually go red on this shape.
    expect(worst, `the widest unlocking script grew past ${UNLOCKING_GROWTH_BAND} B; re-measure and re-pin`)
      .toBeLessThanOrEqual(UNLOCKING_GROWTH_BAND);
  });

  it('every co-spent/created NFT commitment is within the real 128-byte consensus limit', async () => {
    const { sourceOutputs, outputs } = await buildJournalTx();
    const cospent = commitmentsOf('co-spent', sourceOutputs);
    const created = commitmentsOf('created', outputs);
    const all = [...cospent, ...created];
    console.log(`[P13] commitments inspected: ${all.length} `
      + `(${cospent.length} co-spent, ${created.length} created)`);
    for (const row of all) console.log(`[P13]   ${row.side} ${row.index}: ${row.bytes} B`);
    // LIVENESS, ON BOTH HALVES SEPARATELY. This is the assertion R3-6 is about: the co-spent count was zero on
    // every run for four rounds because a libauth input has no `token` field, and a `for` loop over an empty
    // set asserts nothing. Either half going empty now fails the row instead of passing it.
    expect(cospent.length, 'the co-spent half inspected NOTHING - the R3-6 vacuity is back').toBeGreaterThan(0);
    expect(created.length, 'the created half inspected nothing').toBeGreaterThan(0);
    const worst = Math.max(...all.map((row) => row.bytes));
    console.log(`[P13] worst commitment ${worst} B of ${MAX_COMMITMENT} `
      + `(${(worst * 100 / MAX_COMMITMENT).toFixed(1)}% of the limit)`);
    for (const row of all) {
      expect(row.bytes, `${row.side} ${row.index} exceeds the commitment limit`)
        .toBeLessThanOrEqual(MAX_COMMITMENT);
    }
    expect(worst, `the widest commitment grew past ${COMMITMENT_GROWTH_BAND} B; re-measure and re-pin`)
      .toBeLessThanOrEqual(COMMITMENT_GROWTH_BAND);
  });

  it('no output is dust by BCHN\'s own rule, evaluated on the serialized bytes', async () => {
    const { outputs } = await buildJournalTx();
    const tokenBearing = outputs.filter((output) => output.token !== undefined);
    console.log(`[P13] outputs ${outputs.length}, token-bearing ${tokenBearing.length}`);
    expect(tokenBearing, 'the built transaction carries no token output').not.toEqual([]);
    // BCHN's rule rather than a hand-picked 800-satoshi floor, and over EVERY output rather than only the
    // token-bearing ones: `dustOutputs` charges 3 x (the output's own serialized length + 148) at the default
    // dust relay fee, which is the figure the node computes. A provider policy setting cannot mask it.
    const dust = dustOutputs({ outputs } as never);
    console.log(`[P13] dust by BCHN's rule: ${formatDustOutputs(dust)}`);
    expect(dust, formatDustOutputs(dust)).toEqual([]);
    for (const output of tokenBearing) expect(output.valueSatoshis).toBeGreaterThanOrEqual(800n);
  });
});
