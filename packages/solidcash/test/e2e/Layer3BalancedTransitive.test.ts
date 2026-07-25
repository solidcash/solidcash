import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Audit P8/P9 criterion 3: a TRANSITIVE native chain A -> B -> C composed under balanced bases. The transcript
// participant A natively calls B (an independently compiled forwarder), which itself natively calls C (a leaf).
// Both callees sit in the layout's callee slots (2 and 3), the controller shifts to base 4, and each caller
// self-preserves. The whole 6-input/6-output transaction validates on the real VM; a wrong nested callee-base
// (B pointed off C) is rejected.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

const SINK = `pragma solidcash >=0.8.0;
interface ISink { function ping(int x); }
contract Sink() is ISink { function ping(int x) { require(x >= 0); } }`;
const FWD = `pragma solidcash >=0.8.0;
interface ISink { function ping(int x); }
contract Fwd(bytes cAddr) { function relay(int v) { ISink(cAddr).ping(v); require(v >= 0); } }`;

const BLOCKS: layer3.BalancedBlock[] = [{ dataSlots: 0, events: 0 }, { dataSlots: 0, events: 0 }];

async function run(nestedCalleeBase: bigint): Promise<{ provider: any; rawTx: string }> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const gen = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = gen.categoryId;
  const c = new Contract(compileString(SINK), [], { provider });               // leaf
  const bFwd = new Contract(compileString(FWD), [c.lockingBytecode], { provider }); // forwarder -> C
  const common = {
    blocks: BLOCKS, calleeSlots: 2, invocations: [] as layer3.ExecutionInvocation[],
    controllerCategory: ctrlCat, controllerLbc: ctrlLbc, resources: [] as layer3.ExecutionResource[],
  };
  const a = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Caller', functionName: 'invoke', selfPos: 0,
    preamble: 'interface IFwd { function relay(int v); }', constructorParams: 'bytes fwdAddr',
    functionParams: 'int val', appBody: ['IFwd(fwdAddr).relay(val);'],
  })), [bFwd.lockingBytecode], { provider });
  const passive = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Passive', functionName: 'noop', selfPos: 1,
  })), [], { provider });
  const root = layer3.executionRoot([a.lockingBytecode, passive.lockingBytecode], [], [], []);
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
  const pU = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(passive.address, pU);
  const bU = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(bFwd.address, bU);
  const cU = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(c.address, cU);
  const fee = randomUtxo({ satoshis: 50000n }); await provider.addUtxo(p2.address, fee);
  // layout: 0 A, 1 passive, 2 B(callee), 3 C(callee), 4 controller, 5 fee.
  const tx = new TransactionBuilder({ provider });
  tx.addInput(aU, a.unlock.invoke(7n, 2n));     // A calls B at base 2, forwards 7
  tx.addInput(pU, passive.unlock.noop());
  tx.addInput(bU, bFwd.unlock.relay(7n, nestedCalleeBase)); // B relays 7 to C at base 3
  tx.addInput(cU, c.unlock.ping(7n));
  tx.addInput(ctrlUtxo, controller.unlock.attest());
  tx.addInput(fee, p2.unlock.spend(alicePub, sig()));
  tx.addOutput({ to: a.address, amount: aU.satoshis });    // 0 A self-preserved
  tx.addOutput({ to: p2.address, amount: 1000n });         // 1 passive neutral
  tx.addOutput({ to: bFwd.address, amount: bU.satoshis }); // 2 B self-preserved (also A's preserved callee)
  tx.addOutput({ to: c.address, amount: cU.satoshis });    // 3 C master preserved (B's callee)
  tx.addOutput({ // 4 controller preserved
    to: controller.tokenAddress, amount: ctrlUtxo.satoshis,
    token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2.address, amount: 10000n });        // 5 change
  return { provider, rawTx: raw(tx) };
}

describe('P8/P9: transitive native chain A->B->C under balanced bases', () => {
  it('POSITIVE: A natively calls B which natively calls C, all in the balanced layout', async () => {
    const { provider, rawTx } = await run(3n);
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: B pointed off the real C (nested callee-base = 1) is rejected', async () => {
    const { provider, rawTx } = await run(1n);
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow();
  });
});
