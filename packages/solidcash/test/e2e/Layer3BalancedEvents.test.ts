import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Audit P10: events are NFT slots INSIDE the emitter's balanced block, not a global OP_RETURN count. B emits
// one event: its block is executor + state(minting) + event = size 3, so the event NFT lives at B's block-
// relative event slot, branded with B's committed state category (provenance), carrying the topic in its
// commitment. Exhaustiveness is structural (fixed block.events + balanced closure), so no event can be added
// or omitted - and there is no transaction-wide nulldata scan. A tampered event NFT (wrong topic) is rejected.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const num8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const TOPIC = 'deadbeef';
const DEPOSIT = layer3.methodSelector('deposit');

// A: executor only (pure caller). B: executor + state(minting) + event.
const BLOCKS: layer3.BalancedBlock[] = [{ dataSlots: 0, events: 0 }, { dataSlots: 1, events: 1 }];
const EDGES: layer3.ExecutionInvocation[] = [{ caller: 0, callee: 1, selectorHex: DEPOSIT, argsHex: binToHex(num8(5n)) }];

async function run(
  topic: string, capability: 'none' | 'mutable' | 'minting' = 'none', siphonStateValue = false,
): Promise<{ provider: any; rawTx: string }> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const gen = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = gen.categoryId;
  const p2 = new Contract(p2pkhArtifact, [alicePkh], { provider });
  // Genesis B's state NFT (MINTING, so it can mint the event NFT of the same category) at a neutral address.
  const bGen = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: p2.tokenAddress, satoshis: 4000n, token: { amount: 0n, nft: { capability: 'minting', commitment: binToHex(num8(10n)) } } },
  ]);
  const catB: string = bGen.categoryId;
  const resources: layer3.ExecutionResource[] = [{ owner: 1, categoryHex: catB }];
  const events: layer3.ExecutionEvent[] = [{ emitter: 1, topicHex: TOPIC }];
  const common = {
    blocks: BLOCKS, invocations: EDGES, controllerCategory: ctrlCat, controllerLbc: ctrlLbc, resources, events,
  };
  const a = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Caller', functionName: 'invoke', selfPos: 0,
  })), [], { provider });
  const b = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Emitter', functionName: 'run', selfPos: 1, journal: { ops: { [DEPOSIT]: 'add' } },
  })), [], { provider });
  const root = layer3.executionRoot([a.lockingBytecode, b.lockingBytecode], EDGES, events, resources);
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
  const aExec = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(a.address, aExec);
  const bExec = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(b.address, bExec);
  const bState = bGen.utxos[0];
  const evFund = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(p2.address, evFund);
  const fee = randomUtxo({ satoshis: 60000n }); await provider.addUtxo(p2.address, fee);
  // layout: base(0)=0 size1; base(1)=1 size3; controllerBase=4; feeBase=5; total 6.
  const tx = new TransactionBuilder({ provider });
  tx.addInput(aExec, a.unlock.invoke());              // 0 A executor
  tx.addInput(bExec, b.unlock.run());                 // 1 B executor
  tx.addInput(bState, p2.unlock.spend(alicePub, sig())); // 2 B state (minting)
  tx.addInput(evFund, p2.unlock.spend(alicePub, sig())); // 3 event funding
  tx.addInput(ctrlUtxo, controller.unlock.attest());  // 4 controller
  tx.addInput(fee, p2.unlock.spend(alicePub, sig())); // 5 fee
  tx.addOutput({ to: p2.address, amount: 1000n });    // 0 A executor paired
  tx.addOutput({ to: p2.address, amount: 1000n });    // 1 B executor paired
  tx.addOutput({ // 2 B state' (minting preserved, deposit journaled 10->15)
    to: p2.tokenAddress, amount: siphonStateValue ? 1000n : bState.satoshis,
    token: { category: catB, amount: 0n, nft: { capability: 'minting', commitment: binToHex(num8(15n)) } },
  });
  tx.addOutput({ // 3 B event NFT: branded category, authenticated (locked to the emitter, none-cap, dust)
    to: b.tokenAddress, amount: 1000n,
    token: { category: catB, amount: 0n, nft: { capability, commitment: topic } },
  });
  tx.addOutput({ // 4 controller preserved
    to: controller.tokenAddress, amount: ctrlUtxo.satoshis,
    token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2.address, amount: siphonStateValue ? 13000n : 10000n }); // 5 change
  return { provider, rawTx: raw(tx) };
}

describe('P10: event NFT slots within balanced block bounds (no global OP_RETURN)', () => {
  it('POSITIVE: B emits its committed event NFT (branded + correct topic) in its own block slot', async () => {
    const { provider, rawTx } = await run(TOPIC);
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: an event NFT with the wrong topic is rejected', async () => {
    const { provider, rawTx } = await run('cafebabe');
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow();
  });

  it('AUDIT-FIXED: a minting-capability NFT in the event slot is rejected (no smuggled mint authority)', async () => {
    const { provider, rawTx } = await run(TOPIC, 'minting');
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow();
  });

  it('AUDIT-FIXED: a mutable-capability NFT in the event slot is rejected', async () => {
    const { provider, rawTx } = await run(TOPIC, 'mutable');
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow();
  });

  it('AUDIT-FIXED: siphoning satoshis from the journaled state slot into change is rejected', async () => {
    const { provider, rawTx } = await run(TOPIC, 'none', true);
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow();
  });
});
