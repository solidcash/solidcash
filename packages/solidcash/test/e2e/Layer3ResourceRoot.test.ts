import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Audit P5: resources are now folded into the SAME framed execution root as the heterogeneous participants
// (not the disconnected old scaffold). ExecutionResource {owner, categoryHex} is committed in the root; the
// OWNER participant verifies the co-spent resource NFT (at input n+1+k) carries the committed category. A
// resource of the wrong category (or the root committing a different resource) is rejected.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const RES_CAT = 'cc'.repeat(32);

async function run(actualResourceCat: string): Promise<{ provider: any; rawTx: string }> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const genesis = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = genesis.categoryId;
  const resources: layer3.ExecutionResource[] = [{ owner: 1, categoryHex: RES_CAT }];
  const common = { n: 2, invocations: [], controllerCategory: ctrlCat, controllerLbc: ctrlLbc, resources };
  const a = new Contract(compileString(layer3.generateExecutionParticipant({
    ...common, contractName: 'Caller', functionName: 'invoke', selfPos: 0, appBody: ['require(tx.inputs[0].value >= 0);'],
  })), [], { provider });
  const b = new Contract(compileString(layer3.generateExecutionParticipant({
    ...common, contractName: 'Owner', functionName: 'own', selfPos: 1, appBody: ['require(tx.inputs[1].value >= 0);'],
  })), [], { provider });
  const root = layer3.executionRoot([a.lockingBytecode, b.lockingBytecode], [], [], resources);
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
  const aU = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(a.address, aU);
  const bU = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(b.address, bU);
  // the co-spent resource NFT at input n+1 = 3 (its category is what the owner checks).
  const resUtxo = randomUtxo({ satoshis: 4000n, token: { category: actualResourceCat, amount: 0n, nft: { capability: 'mutable', commitment: '00' } } });
  await provider.addUtxo(p2.address, resUtxo);
  const fee = randomUtxo({ satoshis: 50000n }); await provider.addUtxo(p2.address, fee);
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(aU, a.unlock.invoke());
  tx.addInput(bU, b.unlock.own());
  tx.addInput(ctrlUtxo, controller.unlock.attest()); // controller at input 2
  tx.addInput(resUtxo, p2.unlock.spend(alicePub, sig())); // resource at input 3
  tx.addInput(fee, p2.unlock.spend(alicePub, sig()));
  tx.addOutput({ to: p2.address, amount: 1000n });
  tx.addOutput({ to: p2.address, amount: 1000n });
  tx.addOutput({
    to: controller.tokenAddress, amount: ctrlUtxo.satoshis,
    token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2.address, amount: 12000n });
  return { provider, rawTx: raw(tx) };
}

describe('P5: resources folded into the framed execution root (owner-verified)', () => {
  it('POSITIVE: the committed resource category is present at the owner-checked input', async () => {
    const { provider, rawTx } = await run(RES_CAT);
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a co-spent resource of the WRONG category is rejected by the owner', async () => {
    const { provider, rawTx } = await run('ab'.repeat(32)); // not RES_CAT
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow();
  });
});
