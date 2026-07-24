import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Re-audit R2: the controller commits a canonical, domain-separated EXECUTION root over the participant set
// AND the ordered invocation edges (caller -> callee.selector) - not just addresses. Every participant
// recomputes sha256(domain || lbcs || edges) from the co-spent set + the baked edges and requires it ==
// the controller's attestation. A controller committing only the address set (no execution), or a different
// call graph, is rejected - the root binds WHAT executes, not just WHO participates.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const INVOCATIONS = [{ caller: 0, callee: 1, selectorHex: 'aabbccdd' }];

async function setup(rootFor: (lbcs: string[]) => string): Promise<any> {
  const provider = createTestProvider();
  const ctrlArt = compileString(layer3.generateControllerCovenant());
  const controller = new Contract(ctrlArt, [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const genesis = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = genesis.categoryId;
  const artifact = compileString(layer3.generateExecutionBoundCovenant(2, INVOCATIONS, ctrlCat, ctrlLbc), {
    forceStateful: true, experimentalHiddenBatch: true, experimentalLayer3BindingSpike: true,
  });
  const route = artifact.hiddenBatch!.route;
  const sel = hexToBin(artifact.hiddenBatch!.selector);
  const handler = artifact.hiddenBatch!.handlers.find((h: any) => h.name === '__layer3_bind')!;
  const participants: any[] = [];
  for (let i = 0; i < 2; i += 1) {
    const inner = new Contract(artifact, [], { provider });
    const s = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    const contract = inner.withCategory(hexToBin(s.categoryId));
    participants.push({ contract, master: s.masterUtxo, categoryId: s.categoryId });
  }
  const ordered = layer3.sortParticipants(participants);
  const orderedLbcs = ordered.map((p: any) => p.contract.lockingBytecode);
  const root = rootFor(orderedLbcs); // what the deployer commits (may be honest or forged)
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
  return { provider, route, sel, handler, ordered, root, controller, ctrlCat, ctrlUtxo, p2 };
}

async function transcript(s: any): Promise<string> {
  const blob = layer3.encodeTranscriptBlob(s.handler.selector, layer3.controllerParticipantArgs(2, 2));
  const b = new TransactionBuilder({ provider: s.provider });
  for (const p of s.ordered) b.addInput(p.master, p.contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  b.addInput(s.ctrlUtxo, s.controller.unlock.attest());
  const fee = randomUtxo({ satoshis: 50000n }); await s.provider.addUtxo(s.p2.address, fee);
  b.addInput(fee, s.p2.unlock.spend(alicePub, sig()));
  for (const p of s.ordered) {
    b.addOutput({
      to: p.contract.tokenAddress, amount: p.master.satoshis,
      token: { category: p.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  b.addOutput({
    to: s.controller.tokenAddress, amount: s.ctrlUtxo.satoshis,
    token: { category: s.ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: s.root } },
  });
  b.addOutput({ to: s.ordered[0].contract.address, amount: 12000n });
  return raw(b);
}

describe('R2: canonical execution transcript root (call graph, not just addresses)', () => {
  it('POSITIVE: controller commits the EXECUTION root; transcript accepted', async () => {
    const s = await setup((lbcs) => layer3.executionRoot(lbcs, INVOCATIONS));
    await expect(s.provider.sendRawTransaction(await transcript(s))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a controller committing only the participant-SET root (no execution) is rejected', async () => {
    const s = await setup((lbcs) => layer3.participantSetRoot(lbcs)); // addresses only, no call graph
    await expect(s.provider.sendRawTransaction(await transcript(s))).rejects.toThrow();
  });

  it('HOSTILE: a controller committing a DIFFERENT call graph (wrong selector) is rejected', async () => {
    const s = await setup((lbcs) => layer3.executionRoot(lbcs, [{ caller: 0, callee: 1, selectorHex: '99999999' }]));
    await expect(s.provider.sendRawTransaction(await transcript(s))).rejects.toThrow();
  });
});
