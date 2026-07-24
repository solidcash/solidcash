import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, createVirtualMachineBch2026, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

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
});
