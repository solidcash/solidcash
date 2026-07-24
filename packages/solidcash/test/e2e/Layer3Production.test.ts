import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, createVirtualMachineBch2026, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const num4 = (n: bigint): Uint8Array => Uint8Array.from({ length: 4 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

// Production API: build a real authenticated transcript from a SPEC via the src/layer3 module - the covenant
// is GENERATED (not hand-written), the blob is ENCODED by the codec, and the transaction is DERIVED by the
// SDK. No per-test fixture covenant. Proves the reusable module produces a valid, VM-accepted transcript.
const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};

async function buildFromSpec(spec: layer3.TranscriptSpec, provider: any): Promise<any> {
  const source = layer3.generateTranscriptCovenant(spec);
  const artifact = compileString(source, {
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
    participants.push({ contract: inner.withCategory(hexToBin(s.categoryId)), master: s.masterUtxo, categoryId: s.categoryId });
  }
  return { artifact, route, sel, handler, participants };
}

describe('layer-3 production API (src/layer3)', () => {
  it('generates a covenant, encodes the blob, and derives a valid A->B transcript from a spec', async () => {
    const provider = createTestProvider();
    const spec: layer3.TranscriptSpec = { participants: 2, invocations: [{ caller: 0, callee: 1, senderOutput: 2 }] };
    const { route, sel, handler, participants } = await buildFromSpec(spec, provider);

    const { builder, ordered } = layer3.deriveTranscriptTransaction({
      provider, route, sel, handlerSelector: handler.selector, participants,
    });
    const fee = await createFeeFunder(provider, 30000n);
    builder.addInput(fee.utxo, fee.unlocker);
    // Application effect: deliver the caller's msg.sender to the OP_RETURN the spec named (output 2).
    builder.addOutput({ to: concat(hexToBin('6a23'), hexToBin(ordered[0].contract.lockingBytecode)), amount: 0n });
    builder.addOutput({ to: ordered[0].contract.address, amount: 2000n });

    const raw = binToHex(encodeTransaction(builder.buildLibauthTransaction()));
    await expect(provider.sendRawTransaction(raw)).resolves.toBeTypeOf('string');

    // The derived transcript runs under budget on the real VM.
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026();
    const r = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction });
    expect('metrics' in r && !(r as any).error).toBe(true);
    expect((r as any).metrics.operationCost / (r as any).metrics.maximumOperationCost).toBeLessThan(0.4);
  });

  it('HOSTILE: a forged msg.sender in the spec-derived transcript is rejected', async () => {
    const provider = createTestProvider();
    const spec: layer3.TranscriptSpec = { participants: 2, invocations: [{ caller: 0, callee: 1, senderOutput: 2 }] };
    const { route, sel, handler, participants } = await buildFromSpec(spec, provider);
    const { builder, ordered } = layer3.deriveTranscriptTransaction({
      provider, route, sel, handlerSelector: handler.selector, participants,
    });
    const fee = await createFeeFunder(provider, 30000n);
    builder.addInput(fee.utxo, fee.unlocker);
    // Forge: deliver participant 1's identity as the sender instead of the caller (participant 0).
    builder.addOutput({ to: concat(hexToBin('6a23'), hexToBin(ordered[1].contract.lockingBytecode)), amount: 0n });
    builder.addOutput({ to: ordered[0].contract.address, amount: 2000n });
    const raw = binToHex(encodeTransaction(builder.buildLibauthTransaction()));
    await expect(provider.sendRawTransaction(raw)).rejects.toThrow();
  });

  it('derives a resource-bearing transcript (Bento state transition) entirely from a spec', async () => {
    const provider = createTestProvider();
    const E = 10n; const B = 8n; const amount = 5n; const s = (amount * B) / E; // 4
    // Spec: 2 participants + a producer (participant 1) resource state NFT at input 2, with the Rebase
    // transition as appBody. The covenant generator emits binding + F1/N2 resource binding; appBody the math.
    const spec: layer3.TranscriptSpec = {
      participants: 2,
      resources: [{ owner: 1, stateInput: 2 }],
      appBody: [
        'bytes packed = tx.inputs[2].nftCommitment;',
        'bigint elastic = int(packed.slice(0, 4));',
        'bigint base = int(packed.slice(4, 8));',
        `bigint share = ${amount} * base / elastic;`,
        'require(tx.outputs[2].lockingBytecode == tx.inputs[2].lockingBytecode);',
        'require(tx.outputs[2].tokenCategory == tx.inputs[2].tokenCategory);',
        `require(tx.outputs[2].nftCommitment == bytes.concat(bytes4(elastic + ${amount}), bytes4(base + share)));`,
      ],
    };
    const { route, sel, handler, participants } = await buildFromSpec(spec, provider);
    const { builder, ordered } = layer3.deriveTranscriptTransaction({
      provider, route, sel, handlerSelector: handler.selector, participants,
    });
    // Application: the producer's (ordered[1]) owner-branded state NFT at input 2, recreated at output 2.
    const producerCat = ordered[1].categoryId;
    const p2 = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const stateUtxo = randomUtxo({
      satoshis: 5000n,
      token: { category: producerCat, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(concat(num4(E), num4(B))) } },
    });
    await provider.addUtxo(p2.address, stateUtxo);
    builder.addInput(stateUtxo, p2.unlock.spend(alicePub, new SignatureTemplate(alicePriv))); // input 2
    const fee = await createFeeFunder(provider, 30000n);
    builder.addInput(fee.utxo, fee.unlocker);
    builder.addOutput({ // output 2 = state NFT transition to (E+amount, B+share)
      to: p2.tokenAddress, amount: 5000n,
      token: { category: producerCat, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(concat(num4(E + amount), num4(B + s))) } },
    });
    builder.addOutput({ to: ordered[0].contract.address, amount: 2000n });
    const raw = binToHex(encodeTransaction(builder.buildLibauthTransaction()));
    await expect(provider.sendRawTransaction(raw)).resolves.toBeTypeOf('string');
  });
});
