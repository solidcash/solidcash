import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, layer3, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const OPEN = 'contract Open { function spend() { require(true); } }';

async function fixture() {
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

const raw = (builder: any) => binToHex(encodeTransaction(builder.buildLibauthTransaction()));

describe('layer-3 production audit probes', () => {
  it('accepts an arbitrary resource commitment when ResourceSpec has no appBody transition', async () => {
    const { provider, result } = await fixture();
    await expect(provider.sendRawTransaction(raw(result.builder))).resolves.toBeTypeOf('string');
  });

  it('accepts siphoning satoshis from a declared resource output', async () => {
    const { provider, result, spec, open } = await fixture();
    const stateOutput = layer3.transcriptLayout(spec).stateOutput(0);
    result.builder.outputs[stateOutput].amount = 1000n;
    result.builder.addOutput({ to: open.address, amount: 4000n });
    await expect(provider.sendRawTransaction(raw(result.builder))).resolves.toBeTypeOf('string');
  });

  it('accepts three participants using two different overlapping transcripts in an N=2 covenant', async () => {
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
    const builder = new TransactionBuilder({ provider });
    builder.addInput(parts[0].master, parts[0].contract.createCompilerRouteUnlocker(route, selector)(blob01));
    builder.addInput(parts[1].master, parts[1].contract.createCompilerRouteUnlocker(route, selector)(blob01));
    builder.addInput(parts[2].master, parts[2].contract.createCompilerRouteUnlocker(route, selector)(blob12));
    const open = new Contract(compileString(OPEN), [], { provider });
    const fee = randomUtxo({ satoshis: 20000n });
    await provider.addUtxo(open.address, fee);
    builder.addInput(fee, open.unlock.spend());
    for (const p of parts) {
      builder.addOutput({
        to: p.contract.tokenAddress,
        amount: p.master.satoshis,
        token: {
          category: p.categoryId,
          amount: 0n,
          nft: { capability: 'minting', commitment: '' },
        },
      });
    }
    await expect(provider.sendRawTransaction(raw(builder))).resolves.toBeTypeOf('string');
  });
});
