import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Refinement 2 (replay policy): a ONE-SHOT controller. generateOneShotControllerCovenant's attest CONSUMES
// the controller (no output may recreate its category); because the category is mint-once, after the single
// execution it has zero tokens forever and the same execution root can NEVER be re-attested. Participants use
// executionMemberBody(..., oneShot: true), which skips controller preservation (the replay policy lives in
// the controller). Reusable-vs-one-shot is thus an explicit deployer choice, answering the reviewer question.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const INV = [{ caller: 0, callee: 1, selectorHex: 'aabbccdd' }];
const nonTruthyFailure = [
  'error in evaluating input index 2:',
  'Unsuccessful evaluation: completed with a non-truthy value on top of the stack',
].join(' ');

async function setup(): Promise<any> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateOneShotControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const genesis = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = genesis.categoryId;
  const member = (self: number): string =>
    layer3.executionMemberBody(2, self, INV, ctrlCat, ctrlLbc, undefined, true).join('\n    ');
  const a = new Contract(compileString(`pragma solidcash >=0.8.0;\ncontract A_() { function f() {\n    ${member(0)}\n  } }`), [], { provider });
  const b = new Contract(compileString(`pragma solidcash >=0.8.0;\ncontract B_() { function g() {\n    ${member(1)}\n  } }`), [], { provider });
  const root = layer3.executionRoot([a.lockingBytecode, b.lockingBytecode], INV);
  const p2 = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const setB = new TransactionBuilder({ provider });
  setB.addInput(genesis.utxos[0], controller.unlock.setRoot(hexToBin(root), alicePub, sig()));
  const setFee = randomUtxo({ satoshis: 20000n }); await provider.addUtxo(p2.address, setFee);
  setB.addInput(setFee, p2.unlock.spend(alicePub, sig()));
  setB.addOutput({
    to: controller.tokenAddress, amount: genesis.utxos[0].satoshis,
    token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  setB.addOutput({ to: p2.address, amount: 15000n });
  await provider.sendRawTransaction(raw(setB));
  const ctrlUtxo = (await provider.getUtxos(controller.tokenAddress)).find((u: any) => u.token?.nft?.commitment === root);
  return { provider, controller, ctrlCat, ctrlUtxo, root, a, b, p2 };
}

async function transcript(s: any, ctrlUtxo: any): Promise<TransactionBuilder> {
  const aU = randomUtxo({ satoshis: 3000n }); await s.provider.addUtxo(s.a.address, aU);
  const bU = randomUtxo({ satoshis: 3000n }); await s.provider.addUtxo(s.b.address, bU);
  const fee = randomUtxo({ satoshis: 50000n }); await s.provider.addUtxo(s.p2.address, fee);
  // The one-shot controller is intentionally BURNED (consumed, never recreated) - the replay policy.
  const tx = new TransactionBuilder({ provider: s.provider, allowImplicitNftBurn: true });
  tx.addInput(aU, s.a.unlock.f());
  tx.addInput(bU, s.b.unlock.g());
  tx.addInput(ctrlUtxo, s.controller.unlock.attest()); // controller at input 2, CONSUMED (not recreated)
  tx.addInput(fee, s.p2.unlock.spend(alicePub, sig()));
  tx.addOutput({ to: s.p2.address, amount: 1000n }); // 0
  tx.addOutput({ to: s.p2.address, amount: 1000n }); // 1 - NO controller recreation anywhere (one-shot burn)
  tx.addOutput({ to: s.p2.address, amount: 12000n }); // change
  return tx;
}

describe('refinement: one-shot controller replay policy', () => {
  it('POSITIVE: the one-shot transcript runs once (controller consumed, not recreated)', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(raw(await transcript(s, s.ctrlUtxo)))).resolves.toBeTypeOf('string');
    // the controller category now has zero tokens (burned).
    expect((await s.provider.getUtxos(s.controller.tokenAddress)).length).toBe(0);
  });

  it('HOSTILE: replaying with the same (now-consumed) controller is rejected', async () => {
    const s = await setup();
    // Guard negative control: the FIRST run of the identical transcript must be accepted, so the replay's
    // refusal is attributable to the controller having been consumed and not to the fixture.
    await expect(s.provider.sendRawTransaction(raw(await transcript(s, s.ctrlUtxo))))
      .resolves.toBeTypeOf('string');
    // Re-run against the same controller UTXO - it no longer exists (burned, mint-once). X144: was a bare
    // `rejects.toThrow()`; a censused run showed it catches `bad-txns-inputs-missingorspent`, which is the
    // right cause, but the bare form also passed on a script failure or an SDK build error.
    await expect(s.provider.sendRawTransaction(raw(await transcript(s, s.ctrlUtxo))))
      .rejects.toThrow(/bad-txns-inputs-missingorspent/);
  });

  it('HOSTILE: recreating the controller in a one-shot transcript is rejected by attest', async () => {
    const s = await setup();
    const tx = await transcript(s, s.ctrlUtxo);
    // Forge a controller recreation output - the one-shot attest scans outputs and rejects any recreation.
    tx.addOutput({
      to: s.controller.tokenAddress, amount: s.ctrlUtxo.satoshis,
      token: { category: s.ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: s.root } },
    });
    await expect(s.provider.sendRawTransaction(raw(tx))).rejects.toThrow(nonTruthyFailure);
  });
});
