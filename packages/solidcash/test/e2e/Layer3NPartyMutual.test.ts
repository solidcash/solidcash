import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin, sha256 } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Full-implementation phase 4 (audit L3-1 FULL): sound N-party MUTUAL authentication. Participants are bound
// to ONE canonical transcript ATTESTED by a co-spent CONTROLLER NFT (unique mint-once category baked into the
// covenant) whose commitment is sha256(ordered participant locking bytecodes). Each participant reconstructs
// the root from the co-spent set and requires it == the controller's attestation. This closes the disjoint /
// injected residual the canonical-blob binding alone could not: an extra participant fails membership or its
// reconstructed root mismatches the one controller's one attestation.
const CONTROLLER_CATEGORY = 'c04c3342314354524c4c3342314354524c4c3342314354524c4c334231435401';

const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

async function setup(n: number): Promise<any> {
  const provider = createTestProvider();
  const artifact = compileString(layer3.generateControllerBoundCovenant(n, CONTROLLER_CATEGORY), {
    forceStateful: true, experimentalHiddenBatch: true, experimentalLayer3BindingSpike: true,
  });
  const route = artifact.hiddenBatch!.route;
  const sel = hexToBin(artifact.hiddenBatch!.selector);
  const handler = artifact.hiddenBatch!.handlers.find((h: any) => h.name === '__layer3_bind')!;
  const participants: any[] = [];
  for (let i = 0; i < n; i += 1) {
    const inner = new Contract(artifact, [], { provider });
    const s = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    const contract = inner.withCategory(hexToBin(s.categoryId));
    participants.push({ contract, master: s.masterUtxo, categoryId: s.categoryId });
  }
  const ordered = layer3.sortParticipants(participants);
  // Controller attests the canonical set: commitment = sha256(concat ordered participant locking bytecodes).
  const rootPre = ordered.reduce((acc: Uint8Array, p: any) => {
    const lbc = hexToBin(p.contract.lockingBytecode);
    const out = new Uint8Array(acc.length + lbc.length); out.set(acc, 0); out.set(lbc, acc.length); return out;
  }, new Uint8Array(0));
  const root = binToHex(sha256.hash(rootPre));
  const p2 = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const controller = randomUtxo({
    satoshis: 2000n,
    token: { category: CONTROLLER_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  await provider.addUtxo(p2.address, controller);
  return { provider, route, sel, handler, participants, ordered, p2, controller, root, artifact };
}

function buildTx(s: any, ordered: any[], controllerIdx: number, controllerUtxo: any): TransactionBuilder {
  const n = ordered.length;
  const blob = layer3.encodeTranscriptBlob(s.handler.selector, layer3.controllerParticipantArgs(n, controllerIdx));
  const builder = new TransactionBuilder({ provider: s.provider });
  for (const p of ordered) builder.addInput(p.master, p.contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  builder.addInput(controllerUtxo, s.p2.unlock.spend(alicePub, new SignatureTemplate(alicePriv))); // controller at index n
  return builder;
}

function addTails(s: any, builder: TransactionBuilder, ordered: any[], controllerUtxo: any): void {
  for (const p of ordered) {
    builder.addOutput({
      to: p.contract.tokenAddress, amount: p.master.satoshis,
      token: { category: p.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  // controller recreation at output index n (preserved in place)
  builder.addOutput({
    to: s.p2.tokenAddress, amount: controllerUtxo.satoshis,
    token: { category: CONTROLLER_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: s.root } },
  });
}

describe('layer-3 sound N-party mutual authentication (controller-attested canonical transcript)', () => {
  it('POSITIVE: a controller-attested 2-party binding is accepted', async () => {
    const s = await setup(2);
    const builder = buildTx(s, s.ordered, 2, s.controller); // participants 0,1; controller input 2
    const fee = randomUtxo({ satoshis: 50000n });
    await s.provider.addUtxo(s.p2.address, fee);
    builder.addInput(fee, s.p2.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
    addTails(s, builder, s.ordered, s.controller);
    builder.addOutput({ to: s.ordered[0].contract.address, amount: 12000n });
    await expect(s.provider.sendRawTransaction(raw(builder))).resolves.toBeTypeOf('string');
  });

  it('POSITIVE: a controller-attested 3-party binding is accepted', async () => {
    const s = await setup(3);
    const builder = buildTx(s, s.ordered, 3, s.controller); // participants 0,1,2; controller input 3
    const fee = randomUtxo({ satoshis: 50000n });
    await s.provider.addUtxo(s.p2.address, fee);
    builder.addInput(fee, s.p2.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
    addTails(s, builder, s.ordered, s.controller);
    builder.addOutput({ to: s.ordered[0].contract.address, amount: 12000n });
    await expect(s.provider.sendRawTransaction(raw(builder))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a wrong controller root (attesting a different set) is rejected', async () => {
    const s = await setup(2);
    // Re-mint the controller with a garbage root that does not match the co-spent participant set.
    const bad = randomUtxo({
      satoshis: 2000n,
      token: { category: CONTROLLER_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: 'deadbeef'.repeat(8) } },
    });
    await s.provider.addUtxo(s.p2.address, bad);
    s.root = 'deadbeef'.repeat(8); // so the recreation matches the (bad) input; the covenant still recomputes and rejects
    const builder = buildTx(s, s.ordered, 2, bad);
    const fee = randomUtxo({ satoshis: 50000n });
    await s.provider.addUtxo(s.p2.address, fee);
    builder.addInput(fee, s.p2.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
    addTails(s, builder, s.ordered, bad);
    builder.addOutput({ to: s.ordered[0].contract.address, amount: 12000n });
    await expect(s.provider.sendRawTransaction(raw(builder))).rejects.toThrow();
  });

  it('HOSTILE: an INJECTED extra participant (not in the controller attestation) is rejected', async () => {
    const s = await setup(2);
    // Add a third participant of the same covenant, co-spent, but NOT in the controller's attested root.
    const extra = new Contract(s.artifact, [], { provider: s.provider });
    const es = await setupStatefulUtxos(s.provider, extra, s.artifact.stateLayout!, {});
    const ec = extra.withCategory(hexToBin(es.categoryId));
    const extraP = { contract: ec, master: es.masterUtxo, categoryId: es.categoryId };
    // Blob still names 2 participants (0,1); the extra is co-spent as an additional input naming itself.
    const builder = buildTx(s, s.ordered, 2, s.controller);
    // Inject the extra participant input with a blob that names it as participant 0 of a [extra] view.
    const extraBlob = layer3.encodeTranscriptBlob(s.handler.selector, layer3.controllerParticipantArgs(2, 2));
    builder.addInput(extraP.master, extraP.contract.createCompilerRouteUnlocker(s.route, s.sel)(extraBlob));
    const fee = randomUtxo({ satoshis: 50000n });
    await s.provider.addUtxo(s.p2.address, fee);
    builder.addInput(fee, s.p2.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
    addTails(s, builder, s.ordered, s.controller);
    builder.addOutput({
      to: extraP.contract.tokenAddress, amount: extraP.master.satoshis,
      token: { category: extraP.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    builder.addOutput({ to: s.ordered[0].contract.address, amount: 12000n });
    await expect(s.provider.sendRawTransaction(raw(builder))).rejects.toThrow();
  });

  it('R1 CLOSED: siphoning satoshis from the controller output is rejected', async () => {
    const s = await setup(2);
    const builder = buildTx(s, s.ordered, 2, s.controller);
    const fee = randomUtxo({ satoshis: 50000n });
    await s.provider.addUtxo(s.p2.address, fee);
    builder.addInput(fee, s.p2.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
    addTails(s, builder, s.ordered, s.controller);
    builder.outputs[2].amount = 1n; // reduce controller output 2000 -> 1; covenant now preserves value
    builder.addOutput({ to: s.ordered[0].contract.address, amount: 13999n });
    await expect(s.provider.sendRawTransaction(raw(builder))).rejects.toThrow();
  });
});
