import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin, sha256 } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Re-audit R7: a REAL, mint-once controller with EXACT identity, replacing the mock-fabricated P2PKH NFT.
// The controller is a covenant (generateControllerCovenant): the deployer sets the transcript root once via
// setRoot, and the transcript spend uses attest (preserves everything). It is genesised MINT-ONCE - one
// mutable NFT and NO minting NFT - so the CashToken category is fixed-supply and can never be duplicated. The
// participant covenant bakes the controller's EXACT locking bytecode (not just its category), so a forged
// controller at any other address is rejected even if it somehow carried the category.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

async function setupRealController(n: number): Promise<any> {
  const provider = createTestProvider();
  // 1. Deploy the controller covenant; its address depends only on deployerPkh (category-agnostic).
  const ctrlArt = compileString(layer3.generateControllerCovenant());
  const controller = new Contract(ctrlArt, [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  // 2. Genesis it MINT-ONCE: one mutable NFT, NO minting NFT -> category can never be re-minted.
  const genesis = await (provider as any).addTokenUtxosDynamic((_cat: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = genesis.categoryId;
  // 3. Participant covenant bakes the controller category AND exact lbc.
  const artifact = compileString(layer3.generateControllerBoundCovenant(n, ctrlCat, ctrlLbc), {
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
  let rootPre = new Uint8Array(0);
  for (const p of ordered) {
    const lbc = hexToBin(p.contract.lockingBytecode);
    const out = new Uint8Array(rootPre.length + lbc.length); out.set(rootPre); out.set(lbc, rootPre.length); rootPre = out;
  }
  const root = binToHex(sha256.hash(rootPre));
  // 4. setRoot: the deployer authorizes the controller's commitment := root (once).
  const setB = new TransactionBuilder({ provider });
  setB.addInput(genesis.utxos[0], controller.unlock.setRoot(hexToBin(root), alicePub, sig()));
  const p2 = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const setFee = randomUtxo({ satoshis: 20000n }); await provider.addUtxo(p2.address, setFee);
  setB.addInput(setFee, p2.unlock.spend(alicePub, sig()));
  setB.addOutput({
    to: controller.tokenAddress, amount: genesis.utxos[0].satoshis,
    token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  setB.addOutput({ to: p2.address, amount: 15000n });
  await provider.sendRawTransaction(raw(setB));
  const ctrlUtxo = (await provider.getUtxos(controller.tokenAddress))
    .find((u: any) => u.token?.nft?.commitment === root);
  return { provider, route, sel, handler, ordered, root, controller, ctrlCat, ctrlLbc, ctrlUtxo, p2, artifact };
}

async function buildTranscript(s: any, controllerUtxo: any, controllerUnlocker: any): Promise<TransactionBuilder> {
  const n = s.ordered.length;
  const blob = layer3.encodeTranscriptBlob(s.handler.selector, layer3.controllerParticipantArgs(n, n));
  const b = new TransactionBuilder({ provider: s.provider });
  for (const p of s.ordered) b.addInput(p.master, p.contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  b.addInput(controllerUtxo, controllerUnlocker); // controller at input n
  const fee = randomUtxo({ satoshis: 50000n });
  await s.provider.addUtxo(s.p2.address, fee);
  b.addInput(fee, s.p2.unlock.spend(alicePub, sig()));
  for (const p of s.ordered) {
    b.addOutput({
      to: p.contract.tokenAddress, amount: p.master.satoshis,
      token: { category: p.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  b.addOutput({ // controller recreation at output n, preserved
    to: s.controller.tokenAddress, amount: controllerUtxo.satoshis,
    token: { category: s.ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: s.root } },
  });
  b.addOutput({ to: s.ordered[0].contract.address, amount: 12000n });
  return b;
}

describe('R7: real mint-once controller genesis + exact identity', () => {
  it('POSITIVE: genesis (mint-once) -> setRoot -> attest transcript accepted', async () => {
    const s = await setupRealController(2);
    const b = await buildTranscript(s, s.ctrlUtxo, s.controller.unlock.attest());
    await expect(s.provider.sendRawTransaction(raw(b))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a forged controller at a WRONG address (right category) is rejected by the exact-lbc check', async () => {
    const s = await setupRealController(2);
    // Fabricate a same-category NFT at a P2PKH address (impossible on a real node - category is mint-once -
    // but the mock allows it, exercising the covenant's exact-lbc defense).
    const forged = randomUtxo({
      satoshis: 5000n,
      token: { category: s.ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: s.root } },
    });
    await s.provider.addUtxo(s.p2.address, forged);
    const n = s.ordered.length;
    const blob = layer3.encodeTranscriptBlob(s.handler.selector, layer3.controllerParticipantArgs(n, n));
    const b = new TransactionBuilder({ provider: s.provider });
    for (const p of s.ordered) b.addInput(p.master, p.contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
    b.addInput(forged, s.p2.unlock.spend(alicePub, sig())); // forged controller at a P2PKH (wrong lbc)
    const fee = randomUtxo({ satoshis: 50000n }); await s.provider.addUtxo(s.p2.address, fee);
    b.addInput(fee, s.p2.unlock.spend(alicePub, sig()));
    for (const p of s.ordered) {
      b.addOutput({
        to: p.contract.tokenAddress, amount: p.master.satoshis,
        token: { category: p.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
    }
    b.addOutput({
      to: s.p2.tokenAddress, amount: forged.satoshis,
      token: { category: s.ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: s.root } },
    });
    b.addOutput({ to: s.ordered[0].contract.address, amount: 12000n });
    await expect(s.provider.sendRawTransaction(raw(b))).rejects.toThrow();
  });
});
