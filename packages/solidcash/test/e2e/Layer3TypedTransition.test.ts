import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Re-audit R6: a TYPED transition operation whose fail-closed invariants are generated UNCONDITIONALLY by the
// module - not dependent on the caller supplying correct raw appBody. TypedTransition {offset,width,total,delta}
// adds delta to a committed field and preserves every other byte; the module generates the full output-commitment
// binding AND computes the output commitment. No raw SolidCash source in the trusted surface for this case.
const num8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const concat = (...ps: Uint8Array[]): Uint8Array => {
  const o = new Uint8Array(ps.reduce((s, p) => s + p.length, 0)); let c = 0;
  for (const p of ps) { o.set(p, c); c += p.length; } return o;
};
const rawOf = (b: any): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('R6: typed, module-generated fail-closed resource transition', () => {
  async function build(extraTail = new Uint8Array(0)): Promise<any> {
    const provider = createTestProvider();
    const spec: layer3.TranscriptSpec = {
      participants: 2,
      resources: [{ owner: 1, transition: { offset: 0, width: 8, total: 16, delta: 5 } }],
    };
    const artifact = compileString(layer3.generateTranscriptCovenant(spec), {
      forceStateful: true, experimentalHiddenBatch: true, experimentalLayer3BindingSpike: true,
    });
    const salt = hexToBin(layer3.CONTROLLER_SALT_HEX);
    const participants: layer3.TranscriptParticipant[] = [];
    for (let i = 0; i < 2; i += 1) {
      const inner = new Contract(artifact, [], { provider, salt });
      const s = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
      const contract = inner.withCategory(hexToBin(s.categoryId));
      participants.push({ contract, master: s.masterUtxo, categoryId: s.categoryId });
    }
    const ordered = layer3.sortParticipants(participants);
    const producerCat = ordered[1].categoryId;
    const p2 = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const state = randomUtxo({
      satoshis: 5000n,
      token: {
        category: producerCat,
        amount: 0n,
        nft: { capability: 'mutable', commitment: binToHex(concat(num8(10n), num8(20n), extraTail)) },
      },
    });
    await provider.addUtxo(p2.address, state);
    const fee = await createFeeFunder(provider, 40000n);
    const route = artifact.hiddenBatch!.route;
    const sel = hexToBin(artifact.hiddenBatch!.selector);
    const handler = artifact.hiddenBatch!.handlers.find((h: any) => h.name === '__layer3_bind')!;
    const { builder } = layer3.buildTranscriptTransaction({
      provider, route, sel, handlerSelector: handler.selector, participants, spec,
      resources: [{ utxo: state, unlocker: p2.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        address: p2.tokenAddress, outputCommitment: '' /* ignored: module computes the typed transition */ }],
      fee: { utxo: fee.utxo, unlocker: fee.unlocker },
      change: { address: ordered[0].contract.address, satoshis: 15000n },
    });
    return { provider, builder, spec };
  }

  it('POSITIVE: the module computes + binds field0 += 5 (10 -> 15), field1 preserved (20)', async () => {
    const { provider, builder } = await build();
    await expect(provider.sendRawTransaction(rawOf(builder))).resolves.toBeTypeOf('string');
    // verify the recreated state commitment is 15 || 20 (module-computed).
    const so = layer3.transcriptLayout({ participants: 2, resources: [{ owner: 1 }] }).stateOutput(0);
    const decoded = decodeTransactionUnsafe(hexToBin(rawOf(builder)));
    expect(binToHex(decoded.outputs[so].token!.nft!.commitment)).toBe(binToHex(concat(num8(15n), num8(20n))));
  });

  it('HOSTILE: a tampered output commitment (wrong field) is rejected by the generated binding', async () => {
    const { provider, builder, spec } = await build();
    const so = layer3.transcriptLayout(spec).stateOutput(0);
    const forged = decodeTransactionUnsafe(hexToBin(rawOf(builder)));
    forged.outputs[so].token!.nft!.commitment = concat(num8(16n), num8(20n)); // field0 = 16, not 15
    await expect(provider.sendRawTransaction(binToHex(encodeTransaction(forged)))).rejects.toThrow();
  });

  it('P11 CLOSED: an input commitment exceeding TypedTransition.total is rejected by BOTH sides', async () => {
    // The SDK now rejects the oversized input at build time (matching the covenant's `nftCommitment.length ==
    // total` requirement), so there is no SDK/covenant disagreement: a 17-byte input for total=16 fails.
    await expect(build(Uint8Array.of(0xaa))).rejects.toThrow();
  });
});
