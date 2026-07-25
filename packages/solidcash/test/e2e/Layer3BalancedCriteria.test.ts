import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Balanced-layout acceptance criteria 5, 6, 8 (docs/balanced-block-layout-composability.md sec 9).
// - 5: a conditional active/inactive branch keeps the SAME physical block size (only requires, no slot change).
// - 6: changing the fee input amount + final change moves NO slot (the layout is fee-invariant).
// - 8: the two participant blocks are INDEPENDENTLY compiled and compose using layout indices alone.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

// Two executor-only participants; A carries a conditional so both branches keep the same 4-slot balanced shape.
const BLOCKS: layer3.BalancedBlock[] = [{ dataSlots: 0, events: 0 }, { dataSlots: 0, events: 0 }];

async function run(val: bigint, feeSats: bigint, changeSats: bigint): Promise<{ provider: any; rawTx: string }> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const gen = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = gen.categoryId;
  const common = {
    blocks: BLOCKS, invocations: [] as layer3.ExecutionInvocation[],
    controllerCategory: ctrlCat, controllerLbc: ctrlLbc, resources: [] as layer3.ExecutionResource[],
  };
  // Criterion 5: the conditional's two branches are pure requires - identical block topology on either path.
  const a = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Cond', functionName: 'act', selfPos: 0, functionParams: 'int val',
    appBody: ['if (val > 5) { require(val > 5); } else { require(val <= 5); }'],
  })), [], { provider });
  // Criterion 8: B is compiled from a SEPARATE source and composes only via the shared layout indices.
  const b = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Plain', functionName: 'noop', selfPos: 1,
  })), [], { provider });
  const root = layer3.executionRoot([a.lockingBytecode, b.lockingBytecode], [], [], []);
  const p2 = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const setB = new TransactionBuilder({ provider });
  setB.addInput(gen.utxos[0], controller.unlock.setRoot(hexToBin(root), alicePub, sig()));
  const setFee = randomUtxo({ satoshis: 20000n }); await provider.addUtxo(p2.address, setFee);
  setB.addInput(setFee, p2.unlock.spend(alicePub, sig()));
  setB.addOutput({
    to: controller.tokenAddress, amount: gen.utxos[0].satoshis,
    token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  setB.addOutput({ to: p2.address, amount: 15000n });
  await provider.sendRawTransaction(raw(setB));
  const ctrlUtxo = (await provider.getUtxos(controller.tokenAddress)).find((u: any) => u.token?.nft?.commitment === root);
  const aU = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(a.address, aU);
  const bU = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(b.address, bU);
  const fee = randomUtxo({ satoshis: feeSats }); await provider.addUtxo(p2.address, fee);
  // layout: 0 A, 1 B, 2 controller, 3 fee -> outputs 0 A neutral, 1 B neutral, 2 controller, 3 change.
  const tx = new TransactionBuilder({ provider });
  tx.addInput(aU, a.unlock.act(val));
  tx.addInput(bU, b.unlock.noop());
  tx.addInput(ctrlUtxo, controller.unlock.attest());
  tx.addInput(fee, p2.unlock.spend(alicePub, sig()));
  tx.addOutput({ to: p2.address, amount: 1000n });
  tx.addOutput({ to: p2.address, amount: 1000n });
  tx.addOutput({
    to: controller.tokenAddress, amount: ctrlUtxo.satoshis,
    token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2.address, amount: changeSats });
  return { provider, rawTx: raw(tx) };
}

describe('P9 balanced-layout acceptance criteria 5, 6, 8', () => {
  it('criterion 5: the conditional ACTIVE branch (val>5) keeps the balanced block size', async () => {
    const { provider, rawTx } = await run(10n, 50000n, 40000n);
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('criterion 5: the conditional INACTIVE branch (val<=5) keeps the identical block size', async () => {
    const { provider, rawTx } = await run(3n, 50000n, 40000n);
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('criterion 6: a different fee input + change amount moves no slot (fee-invariant)', async () => {
    const { provider, rawTx } = await run(10n, 90000n, 80000n); // bigger fee input, bigger change, same slots
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('criterion 8: independently compiled A and B compose via the shared layout (positive path)', async () => {
    const { provider, rawTx } = await run(7n, 50000n, 40000n);
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });
});
