import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Re-audit item 4: EMITTER EXHAUSTIVENESS. The controller execution root commits the event set, and each
// participant enforces that the tx's OP_RETURN outputs are EXACTLY the committed events - each committed
// record present, and NO unrecorded OP_RETURN. Combined with callee exhaustiveness (edges bind to
// participant positions - a call to a non-participant cannot be an edge) and unique-ownership/transition
// authority (the scaffold F1: resource category == owner), this closes item 4's exhaustiveness properties.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
/** The finalized bytes a hostile shape broadcasts, so a test can prove which decider refused it. */
const byteVerdict = (rawTx: string): layer3.FinalizedByteVerdict =>
  layer3.assessFinalizedTransactionBytes(decodeTransactionUnsafe(hexToBin(rawTx)));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const INV = [{ caller: 0, callee: 1, selectorHex: 'aabbccdd' }];
const EVENTS = [{ emitter: 0, topicHex: 'a1'.repeat(32) }];
const concat = (...ps: Uint8Array[]): Uint8Array => {
  const o = new Uint8Array(ps.reduce((s, p) => s + p.length, 0)); let c = 0;
  for (const p of ps) { o.set(p, c); c += p.length; } return o;
};

async function setup(): Promise<any> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const genesis = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = genesis.categoryId;
  const member = (self: number): string => layer3.executionMemberBody(2, self, INV, ctrlCat, ctrlLbc, EVENTS).join('\n    ');
  const a = new Contract(compileString(`pragma solidcash >=0.8.0;\ncontract A_() { function f() {\n    ${member(0)}\n  } }`), [], { provider });
  const b = new Contract(compileString(`pragma solidcash >=0.8.0;\ncontract B_() { function g() {\n    ${member(1)}\n  } }`), [], { provider });
  const root = layer3.executionRoot([a.lockingBytecode, b.lockingBytecode], INV, EVENTS);
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
  // the committed event record: 6a43 || A_lbc(35) || topic(32).
  const record = concat(hexToBin('6a43'), hexToBin(a.lockingBytecode), hexToBin(EVENTS[0].topicHex));
  return { provider, controller, ctrlCat, ctrlUtxo, root, a, b, p2, record };
}

async function build(s: any, opts: { extraOpReturn?: boolean; dropEvent?: boolean } = {}): Promise<TransactionBuilder> {
  const aU = randomUtxo({ satoshis: 3000n }); await s.provider.addUtxo(s.a.address, aU);
  const bU = randomUtxo({ satoshis: 3000n }); await s.provider.addUtxo(s.b.address, bU);
  const fee = randomUtxo({ satoshis: 50000n }); await s.provider.addUtxo(s.p2.address, fee);
  const tx = new TransactionBuilder({ provider: s.provider });
  tx.addInput(aU, s.a.unlock.f());
  tx.addInput(bU, s.b.unlock.g());
  tx.addInput(s.ctrlUtxo, s.controller.unlock.attest());
  tx.addInput(fee, s.p2.unlock.spend(alicePub, sig()));
  tx.addOutput({ to: s.p2.address, amount: 1000n }); // 0
  tx.addOutput({ to: s.p2.address, amount: 1000n }); // 1
  tx.addOutput({ // 2 controller
    to: s.controller.tokenAddress, amount: s.ctrlUtxo.satoshis,
    token: { category: s.ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: s.root } },
  });
  if (!opts.dropEvent) tx.addOutput({ to: s.record, amount: 0n }); // 3 committed event record
  // X152: 1,000 satoshis, not 500. The attack is that slot 3 is NOT the committed event record; its value is
  // incidental, and 500 sat on a 34-byte P2PKH output is below BCHN's 546-satoshi floor - so the shape was
  // refusable for dust as well, and on a gate-bearing send path a bare rejection would have stopped being the
  // covenant's. 1,000 matches outputs 0 and 1.
  else tx.addOutput({ to: s.p2.address, amount: 1000n }); // 3 non-record (event omitted)
  tx.addOutput({ to: s.p2.address, amount: 10000n }); // change
  if (opts.extraOpReturn) tx.addOutput({ to: concat(hexToBin('6a04'), hexToBin('deadbeef')), amount: 0n }); // UNRECORDED
  return tx;
}

describe('R4: emitter exhaustiveness (exactly the committed events, no extra OP_RETURN)', () => {
  it('POSITIVE: the single committed event record is present and exclusive', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(raw(await build(s)))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: an EXTRA unrecorded OP_RETURN is rejected (opret count != committed)', async () => {
    const s = await setup();
    const rawTx = raw(await build(s, { extraOpReturn: true }));
    expect(byteVerdict(rawTx).refusals).toEqual([]);
    await expect(s.provider.sendRawTransaction(rawTx))
      .rejects.toThrow(/mandatory-script-verify-flag-failed|error in evaluating input index/);
  });

  it('HOSTILE: OMITTING the committed event record is rejected', async () => {
    const s = await setup();
    // X152. With slot 3 raised to 1,000 satoshis these bytes break no byte rule, so the refusal below is the
    // exhaustiveness covenant's and nothing else. At the previous 500 it also carried `policy:output-dust`.
    const rawTx = raw(await build(s, { dropEvent: true }));
    expect(byteVerdict(rawTx).refusals).toEqual([]);
    await expect(s.provider.sendRawTransaction(rawTx))
      .rejects.toThrow(/mandatory-script-verify-flag-failed|error in evaluating input index/);
  });
});
