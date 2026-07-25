import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Audit P9: balanced block layouts. Every participant owns a CONTIGUOUS block (executor + co-spent state
// NFTs) with equal input/output cardinality; blocks concatenate by computed bases. Here participant A's block
// is size 2 (executor + state), so B's block base is 2 (not 1) - B's executor sits at input/output 2, B's
// state at 3, the controller at 4, the fee tail at 5. Every covenant addresses its slots by BLOCK BASE, and
// the balanced closure (tx.inputs.length == tx.outputs.length == totalSlots) makes any inserted or omitted
// slot fail. The A->B->A journal still settles authentically across the shifted bases.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const num8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const A_CAT = 'a1'.repeat(32);
const B_CAT = 'b2'.repeat(32);
const DEPOSIT = layer3.methodSelector('deposit');
const CREDIT = layer3.methodSelector('credit');

// blocks: A has one state NFT (dataSlots 1), B has one state NFT (dataSlots 1). base(0)=0, base(1)=2,
// controllerBase=4, feeBase=5, totalSlots=6.
const BLOCKS: layer3.BalancedBlock[] = [{ dataSlots: 1, events: 0 }, { dataSlots: 1, events: 0 }];
const RESOURCES: layer3.ExecutionResource[] = [{ owner: 0, categoryHex: A_CAT }, { owner: 1, categoryHex: B_CAT }];
const EDGES: layer3.ExecutionInvocation[] = [
  { caller: 0, callee: 1, selectorHex: DEPOSIT, argsHex: binToHex(num8(5n)) },
  { caller: 1, callee: 0, selectorHex: CREDIT, argsHex: binToHex(num8(15n)) },
];

type Tamper = 'none' | 'extra-output' | 'wrong-final';

async function run(tamper: Tamper): Promise<{ provider: any; rawTx: string }> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const genesis = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = genesis.categoryId;
  const common = {
    blocks: BLOCKS, invocations: EDGES, controllerCategory: ctrlCat, controllerLbc: ctrlLbc, resources: RESOURCES,
  };
  const a = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Payer', functionName: 'pay', selfPos: 0, journal: { ops: { [CREDIT]: 'add' } },
  })), [], { provider });
  const b = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Vault', functionName: 'take', selfPos: 1, journal: { ops: { [DEPOSIT]: 'add' }, emits: [1] },
  })), [], { provider });
  const root = layer3.executionRoot([a.lockingBytecode, b.lockingBytecode], EDGES, [], RESOURCES);
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
  const aExec = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(a.address, aExec);
  const bExec = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(b.address, bExec);
  const aState = randomUtxo({ satoshis: 4000n, token: { category: A_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(100n)) } } });
  const bState = randomUtxo({ satoshis: 4000n, token: { category: B_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(10n)) } } });
  await provider.addUtxo(p2.address, aState); await provider.addUtxo(p2.address, bState);
  const fee = randomUtxo({ satoshis: 60000n }); await provider.addUtxo(p2.address, fee);
  const aFinal = tamper === 'wrong-final' ? 116n : 115n; // A credits B's authentic 15 onto 100 => 115
  const tx = new TransactionBuilder({ provider });
  tx.addInput(aExec, a.unlock.pay());        // 0 A executor
  tx.addInput(aState, p2.unlock.spend(alicePub, sig())); // 1 A state
  tx.addInput(bExec, b.unlock.take());       // 2 B executor
  tx.addInput(bState, p2.unlock.spend(alicePub, sig())); // 3 B state
  tx.addInput(ctrlUtxo, controller.unlock.attest());     // 4 controller
  tx.addInput(fee, p2.unlock.spend(alicePub, sig()));    // 5 fee
  tx.addOutput({ to: p2.address, amount: 1000n });       // 0 A executor paired (neutral)
  tx.addOutput({ // 1 A state' credited
    to: p2.tokenAddress, amount: aState.satoshis,
    token: { category: A_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(aFinal)) } },
  });
  tx.addOutput({ to: p2.address, amount: 1000n });       // 2 B executor paired (neutral)
  tx.addOutput({ // 3 B state' after deposit (15)
    to: p2.tokenAddress, amount: bState.satoshis,
    token: { category: B_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(15n)) } },
  });
  tx.addOutput({ // 4 controller preserved
    to: controller.tokenAddress, amount: ctrlUtxo.satoshis,
    token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2.address, amount: 10000n });      // 5 change (fee tail)
  if (tamper === 'extra-output') tx.addOutput({ to: p2.address, amount: 500n }); // shifts nothing but breaks the closure
  return { provider, rawTx: raw(tx) };
}

describe('P9: balanced block layouts (shifted bases, closure enforced)', () => {
  it('layout math: A block size 2 puts B base at 2, controller at 4, fee tail at 5', () => {
    const L = layer3.balancedLayout(BLOCKS);
    expect([L.base(0), L.base(1), L.controllerBase, L.feeBase, L.totalSlots]).toEqual([0, 2, 4, 5, 6]);
    expect(L.dataSlot(0, 0)).toBe(1);
    expect(L.dataSlot(1, 0)).toBe(3);
  });

  it('POSITIVE: the A->B->A journal settles across shifted block bases', async () => {
    const { provider, rawTx } = await run('none');
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: an extra output (breaking the balanced closure) is rejected', async () => {
    const { provider, rawTx } = await run('extra-output');
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow();
  });

  it('HOSTILE: a wrong final state (116 != 115) is rejected across the balanced layout', async () => {
    const { provider, rawTx } = await run('wrong-final');
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow();
  });
});
