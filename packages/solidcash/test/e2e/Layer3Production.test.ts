import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, createVirtualMachineBch2026, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Production API: build a COMPLETE authenticated transcript from a high-level SPEC via the src/layer3 module.
// The covenant is GENERATED, the layout is OWNED by the module, the blob is ENCODED, and the whole
// transaction (participant + resource inputs, all recreations, sender records, resource transitions, effect
// settlements, change) is ASSEMBLED by buildTranscriptTransaction. The application supplies only per-instance
// data (state guard + post-state commitment, settlement value). No hand-built covenant, no hand-built layout.
const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const num4 = (n: bigint): Uint8Array => Uint8Array.from({ length: 4 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

async function compileAndSetup(spec: layer3.TranscriptSpec, provider: any): Promise<any> {
  const artifact = compileString(layer3.generateTranscriptCovenant(spec), {
    forceStateful: true, experimentalHiddenBatch: true, experimentalLayer3BindingSpike: true,
  });
  const route = artifact.hiddenBatch!.route;
  const sel = hexToBin(artifact.hiddenBatch!.selector);
  const handler = artifact.hiddenBatch!.handlers.find((h: any) => h.name === '__layer3_bind')!;
  const salt = hexToBin(layer3.CONTROLLER_SALT_HEX);
  const participants: layer3.TranscriptParticipant[] = [];
  for (let i = 0; i < spec.participants; i += 1) {
    const inner = new Contract(artifact, [], { provider, salt });
    const s = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    const contract = inner.withCategory(hexToBin(s.categoryId));
    participants.push({ contract, master: s.masterUtxo, categoryId: s.categoryId });
  }
  return { route, sel, handler, participants };
}

const rawOf = (b: any): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('layer-3 production API (src/layer3) - complete transcript from a spec', () => {
  it('builds a valid A->B invocation transcript end to end', async () => {
    const provider = createTestProvider();
    const spec: layer3.TranscriptSpec = { participants: 2, invocations: [{ caller: 0, callee: 1 }] };
    const { route, sel, handler, participants } = await compileAndSetup(spec, provider);
    const fee = await createFeeFunder(provider, 30000n);
    const { builder } = layer3.buildTranscriptTransaction({
      provider, route, sel, handlerSelector: handler.selector, participants, spec,
      fee: { utxo: fee.utxo, unlocker: fee.unlocker },
      change: { address: participants[0].contract.address, satoshis: 12000n },
    });
    await expect(provider.sendRawTransaction(rawOf(builder))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a forged msg.sender in the assembled transcript is rejected', async () => {
    const provider = createTestProvider();
    const spec: layer3.TranscriptSpec = { participants: 2, invocations: [{ caller: 0, callee: 1 }] };
    const { route, sel, handler, participants } = await compileAndSetup(spec, provider);
    const fee = await createFeeFunder(provider, 30000n);
    const { builder, ordered } = layer3.buildTranscriptTransaction({
      provider, route, sel, handlerSelector: handler.selector, participants, spec,
      fee: { utxo: fee.utxo, unlocker: fee.unlocker },
      change: { address: participants[0].contract.address, satoshis: 12000n },
    });
    // Forge the msg.sender record (output 2) to name participant 1 instead of the caller (participant 0).
    const forged = decodeTransactionUnsafe(hexToBin(rawOf(builder)));
    forged.outputs[2].lockingBytecode = concat(hexToBin('6a23'), hexToBin(ordered[1].contract.lockingBytecode));
    await expect(provider.sendRawTransaction(binToHex(encodeTransaction(forged)))).rejects.toThrow();
  });

  it('builds a COMPLETE Kashi-shaped transcript (invocation + resource transition + settlement) from a spec', async () => {
    const provider = createTestProvider();
    const E = 10n; const B = 8n; const amount = 5n; const share = (amount * B) / E; // 4
    const shape: layer3.TranscriptSpec = {
      participants: 2, invocations: [{ caller: 0, callee: 1 }], resources: [{ owner: 1 }],
      effects: [{ consumer: 0, valueExpr: 'share' }],
    };
    const layout = layer3.transcriptLayout(shape);
    const si = layout.stateInput(0); const so = layout.stateOutput(0);
    // The application supplies the resource transition (Rebase) as appBody, referencing the module's layout.
    const spec: layer3.TranscriptSpec = {
      ...shape,
      appBody: [
        `bytes packed = tx.inputs[${si}].nftCommitment;`,
        'bigint elastic = int(packed.slice(0, 4));',
        'bigint base = int(packed.slice(4, 8));',
        `bigint share = 2000 + ${amount} * base / elastic;`,
        `require(tx.outputs[${so}].nftCommitment == bytes.concat(bytes4(elastic + ${amount}), bytes4(base + ${amount} * base / elastic)));`,
      ],
    };
    const { route, sel, handler, participants } = await compileAndSetup(spec, provider);

    // Sort to learn which participant is owner=1 (producer), so its state NFT carries its category.
    const ordered = layer3.sortParticipants(participants);
    const producerCat = ordered[1].categoryId;
    const p2 = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const stateUtxo = randomUtxo({
      satoshis: 5000n,
      token: { category: producerCat, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(concat(num4(E), num4(B))) } },
    });
    await provider.addUtxo(p2.address, stateUtxo);
    const fee = await createFeeFunder(provider, 40000n);

    const { builder } = layer3.buildTranscriptTransaction({
      provider, route, sel, handlerSelector: handler.selector, participants, spec,
      resources: [{
        utxo: stateUtxo, unlocker: p2.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        address: p2.tokenAddress, outputCommitment: binToHex(concat(num4(E + amount), num4(B + share))),
      }],
      effects: [2000n + share], // settlement value == 2000 + share, bound by the covenant to the consumer
      fee: { utxo: fee.utxo, unlocker: fee.unlocker },
      change: { address: ordered[0].contract.address, satoshis: 15000n },
    });
    await expect(provider.sendRawTransaction(rawOf(builder))).resolves.toBeTypeOf('string');

    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const r = createVirtualMachineBch2026().evaluate({ inputIndex: 0, sourceOutputs, transaction });
    expect('metrics' in r && !(r as any).error).toBe(true);
    expect((r as any).metrics.operationCost / (r as any).metrics.maximumOperationCost).toBeLessThan(0.4);
  });

  it('generality: a 3-participant transcript with two invocations (0->1, 1->2) is built from a spec', async () => {
    const provider = createTestProvider();
    const invocations = [{ caller: 0, callee: 1 }, { caller: 1, callee: 2 }];
    const spec: layer3.TranscriptSpec = { participants: 3, invocations };
    const { route, sel, handler, participants } = await compileAndSetup(spec, provider);
    const fee = await createFeeFunder(provider, 40000n);
    const { builder } = layer3.buildTranscriptTransaction({
      provider, route, sel, handlerSelector: handler.selector, participants, spec,
      fee: { utxo: fee.utxo, unlocker: fee.unlocker },
      change: { address: participants[0].contract.address, satoshis: 15000n },
    });
    await expect(provider.sendRawTransaction(rawOf(builder))).resolves.toBeTypeOf('string');
  });

  const TOPIC = 'a1b2c3d4e5f6070809101112131415161718192021222324252627282930313f';

  it('emits an authenticated event log (emitter identity + fixed topic) that the covenant binds', async () => {
    const provider = createTestProvider();
    const spec: layer3.TranscriptSpec = {
      participants: 2, invocations: [{ caller: 0, callee: 1 }], events: [{ emitter: 1, topicHex: TOPIC }],
    };
    const { route, sel, handler, participants } = await compileAndSetup(spec, provider);
    const fee = await createFeeFunder(provider, 30000n);
    const { builder } = layer3.buildTranscriptTransaction({
      provider, route, sel, handlerSelector: handler.selector, participants, spec,
      fee: { utxo: fee.utxo, unlocker: fee.unlocker },
      change: { address: participants[0].contract.address, satoshis: 12000n },
    });
    await expect(provider.sendRawTransaction(rawOf(builder))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a forged event topic is rejected', async () => {
    const provider = createTestProvider();
    const spec: layer3.TranscriptSpec = {
      participants: 2, invocations: [{ caller: 0, callee: 1 }], events: [{ emitter: 1, topicHex: TOPIC }],
    };
    const { route, sel, handler, participants } = await compileAndSetup(spec, provider);
    const fee = await createFeeFunder(provider, 30000n);
    const { builder } = layer3.buildTranscriptTransaction({
      provider, route, sel, handlerSelector: handler.selector, participants, spec,
      fee: { utxo: fee.utxo, unlocker: fee.unlocker },
      change: { address: participants[0].contract.address, satoshis: 12000n },
    });
    // The event record is the last output before change (n + I = 3); flip its final topic byte.
    const forged = decodeTransactionUnsafe(hexToBin(rawOf(builder)));
    const evOut = layer3.transcriptLayout(spec).eventOutput(0);
    forged.outputs[evOut].lockingBytecode[forged.outputs[evOut].lockingBytecode.length - 1] ^= 0xff;
    await expect(provider.sendRawTransaction(binToHex(encodeTransaction(forged)))).rejects.toThrow();
  });
});
