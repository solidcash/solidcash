import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, layer3, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const OPEN = 'contract Open { function spend() { require(true); } }';

async function fixture(): Promise<any> {
  const provider = createTestProvider();
  const spec: layer3.TranscriptSpec = { participants: 2, resources: [{ owner: 0 }] };
  const artifact = compileString(layer3.generateTranscriptCovenant(spec), {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalLayer3BindingSpike: true,
  });
  const salt = hexToBin(layer3.CONTROLLER_SALT_HEX);
  const participants: layer3.TranscriptParticipant[] = [];
  for (let i = 0; i < 2; i += 1) {
    const inner = new Contract(artifact, [], { provider, salt });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    participants.push({
      contract: inner.withCategory(hexToBin(setup.categoryId)),
      master: setup.masterUtxo,
      categoryId: setup.categoryId,
    });
  }
  const ordered = layer3.sortParticipants(participants);
  const openArtifact = compileString(OPEN);
  const open = new Contract(openArtifact, [], { provider });
  const state = randomUtxo({
    satoshis: 5000n,
    token: {
      category: ordered[0].categoryId,
      amount: 0n,
      nft: { capability: 'mutable', commitment: '01020304' },
    },
  });
  const fee = randomUtxo({ satoshis: 20000n });
  await provider.addUtxo(open.tokenAddress, state);
  await provider.addUtxo(open.address, fee);
  const result = layer3.buildTranscriptTransaction({
    provider,
    route: artifact.hiddenBatch!.route,
    sel: hexToBin(artifact.hiddenBatch!.selector),
    handlerSelector: artifact.hiddenBatch!.handlers.find((h: any) => h.name === '__layer3_bind')!.selector,
    participants,
    spec,
    resources: [{
      utxo: state,
      unlocker: open.unlock.spend(),
      address: open.tokenAddress,
      outputCommitment: 'deadbeef',
    }],
    fee: { utxo: fee, unlocker: open.unlock.spend() },
  });
  return { provider, result, spec, open };
}

const raw = (builder: any): string => binToHex(encodeTransaction(builder.buildLibauthTransaction()));

/**
 * X144. THIS FILE HAD NO HONEST CONTROL ANYWHERE.
 *
 * Three hostiles, three bare `rejects.toThrow()`, and nothing that ever asserted a settlement. Every one of
 * them would have stayed green if `fixture()` had stopped producing a valid transaction at all - which is the
 * "hostiles failing for the honest case's reason" shape, not a proof that any finding is CLOSED. Each test now
 * carries a guard negative control built from the same fixture and differing in exactly the attacked field,
 * and each refusal is attributed to the VM rather than to any throw.
 *
 * A fresh fixture per control on purpose: a settled control consumes its UTXOs, so reusing it would make the
 * hostile fail `bad-txns-inputs-missingorspent` instead of on its own attack.
 */
describe('layer-3 production audit probes (findings now CLOSED - fail-closed regressions)', () => {
  const VM_REFUSAL = /mandatory-script-verify-flag-failed/;

  it('L3-2 CLOSED: a non-transition resource preserves its commitment; a rewritten commitment is rejected', async () => {
    const honest = await fixture();
    await expect(honest.provider.sendRawTransaction(raw(honest.result.builder))).resolves.toBeTypeOf('string');
    const { provider, result, spec } = await fixture();
    // Honest build now preserves the input commitment (01020304); the covenant enforces it. Forge it:
    const stateOutput = layer3.transcriptLayout(spec).stateOutput(0);
    result.builder.outputs[stateOutput].token.nft.commitment = 'deadbeef';
    await expect(provider.sendRawTransaction(raw(result.builder))).rejects.toThrow(VM_REFUSAL);
  });

  it('L3-3 CLOSED: siphoning satoshis from a declared resource output is rejected', async () => {
    const honest = await fixture();
    await expect(honest.provider.sendRawTransaction(raw(honest.result.builder))).resolves.toBeTypeOf('string');
    const { provider, result, spec, open } = await fixture();
    const stateOutput = layer3.transcriptLayout(spec).stateOutput(0);
    result.builder.outputs[stateOutput].amount = 1000n;
    result.builder.addOutput({ to: open.address, amount: 4000n });
    await expect(provider.sendRawTransaction(raw(result.builder))).rejects.toThrow(VM_REFUSAL);
  });

  it('L3-1 CLOSED: three participants using two different OVERLAPPING transcripts ([A,B] vs [B,C]) is rejected', async () => {
    const provider = createTestProvider();
    const spec: layer3.TranscriptSpec = { participants: 2 };
    const artifact = compileString(layer3.generateTranscriptCovenant(spec), {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalLayer3BindingSpike: true,
    });
    const salt = hexToBin(layer3.CONTROLLER_SALT_HEX);
    const parts: any[] = [];
    for (let i = 0; i < 3; i += 1) {
      const inner = new Contract(artifact, [], { provider, salt });
      const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
      parts.push({
        contract: inner.withCategory(hexToBin(setup.categoryId)),
        master: setup.masterUtxo,
        categoryId: setup.categoryId,
      });
    }
    parts.sort((a, b) => BigInt(`0x${a.contract.lockingBytecode}`) < BigInt(`0x${b.contract.lockingBytecode}`) ? -1 : 1);
    const route = artifact.hiddenBatch!.route;
    const selector = hexToBin(artifact.hiddenBatch!.selector);
    const handlerSelector = artifact.hiddenBatch!.handlers.find((h: any) => h.name === '__layer3_bind')!.selector;
    const blob01 = layer3.encodeTranscriptBlob(handlerSelector, [0n, 0n, 1n, 1n]);
    const blob12 = layer3.encodeTranscriptBlob(handlerSelector, [1n, 1n, 2n, 2n]);
    const open = new Contract(compileString(OPEN), [], { provider });
    const build = (members: number[], blobs: string[]): TransactionBuilder => {
      const b = new TransactionBuilder({ provider });
      members.forEach((index, slot) => b.addInput(
        parts[index].master, parts[index].contract.createCompilerRouteUnlocker(route, selector)(blobs[slot]),
      ));
      return b;
    };
    const fund = async (b: TransactionBuilder, members: number[]): Promise<TransactionBuilder> => {
      const fee = randomUtxo({ satoshis: 20000n });
      await provider.addUtxo(open.address, fee);
      b.addInput(fee, open.unlock.spend());
      for (const index of members) {
        b.addOutput({
          to: parts[index].contract.tokenAddress,
          amount: parts[index].master.satoshis,
          token: { category: parts[index].categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
        });
      }
      return b;
    };

    // Input 2 carries a divergent blob; the L3-1 canonical-blob binding aborts it. Overlapping/divergent
    // views no longer co-validate. (Residual: a fully DISJOINT injected transcript with a different-structured
    // blob is not yet caught - full exhaustiveness needs a structure-independent canonical digest, see
    // layer3-production-audit.md L3-1.)
    const attacked = await fund(build([0, 1, 2], [blob01, blob01, blob12]), [0, 1, 2]);
    await expect(provider.sendRawTransaction(raw(attacked))).rejects.toThrow(VM_REFUSAL);

    // X144 guard negative control. The two participants blob01 actually names, on the same masters, the same
    // route and the same canonical blob, settle. Without this the refusal above is indistinguishable from a
    // fixture that cannot build a valid transcript at all - which is how a hostile passes for the honest
    // case's reason. It runs AFTER the attack: a refused transaction consumes nothing, but a settled one
    // spends its masters and would leave the attack reporting `bad-txns-inputs-missingorspent` instead.
    const control = await fund(build([0, 1], [blob01, blob01]), [0, 1]);
    await expect(provider.sendRawTransaction(raw(control))).resolves.toBeTypeOf('string');
  });
});
