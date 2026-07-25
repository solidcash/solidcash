import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Audit P13: a committed, reproducible standard-policy gate that runs in ordinary CI (no node reconfiguration).
// It builds the balanced transcript transactions and asserts each satisfies BCH mainnet STANDARD-RELAY limits,
// so a policy regression is caught deterministically. Actual mempool acceptance under a standard-policy node
// is separately covered by test/regtest/standard-policy-harness.sh.
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const num8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
// BCH standard relay policy: input unlocking script <= 1650 bytes; NFT commitment <= 40 bytes (consensus);
// token-bearing outputs carry a small dust value.
const MAX_UNLOCKING = 1650;
const MAX_COMMITMENT = 40;
const A_CAT = 'a1'.repeat(32);
const B_CAT = 'b2'.repeat(32);
const DEPOSIT = layer3.methodSelector('deposit');
const CREDIT = layer3.methodSelector('credit');

async function buildJournalTx(): Promise<{ inputs: any[]; outputs: any[] }> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const gen = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = gen.categoryId;
  const blocks: layer3.BalancedBlock[] = [{ dataSlots: 1, events: 0 }, { dataSlots: 1, events: 0 }];
  const resources: layer3.ExecutionResource[] = [{ owner: 0, categoryHex: A_CAT }, { owner: 1, categoryHex: B_CAT }];
  const edges: layer3.ExecutionInvocation[] = [
    { caller: 0, callee: 1, selectorHex: DEPOSIT, argsHex: binToHex(num8(5n)) },
    { caller: 1, callee: 0, selectorHex: CREDIT, argsHex: binToHex(num8(15n)) },
  ];
  const common = { blocks, invocations: edges, controllerCategory: ctrlCat, controllerLbc: ctrlLbc, resources };
  const a = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Payer', functionName: 'pay', selfPos: 0, journal: { ops: { [CREDIT]: 'add' } },
  })), [], { provider });
  const b = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Vault', functionName: 'take', selfPos: 1, journal: { ops: { [DEPOSIT]: 'add' }, emits: [1] },
  })), [], { provider });
  const root = layer3.executionRoot([a.lockingBytecode, b.lockingBytecode], edges, [], resources);
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
  await provider.sendRawTransaction(binToHex((await import('@bitauth/libauth')).encodeTransaction(setB.buildLibauthTransaction())));
  const ctrlUtxo = (await provider.getUtxos(controller.tokenAddress)).find((u: any) => u.token?.nft?.commitment === root);
  const aExec = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(a.address, aExec);
  const bExec = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(b.address, bExec);
  const aState = randomUtxo({ satoshis: 4000n, token: { category: A_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(100n)) } } });
  const bState = randomUtxo({ satoshis: 4000n, token: { category: B_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(10n)) } } });
  await provider.addUtxo(p2.address, aState); await provider.addUtxo(p2.address, bState);
  const fee = randomUtxo({ satoshis: 60000n }); await provider.addUtxo(p2.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(aExec, a.unlock.pay());
  tx.addInput(aState, p2.unlock.spend(alicePub, sig()));
  tx.addInput(bExec, b.unlock.take());
  tx.addInput(bState, p2.unlock.spend(alicePub, sig()));
  tx.addInput(ctrlUtxo, controller.unlock.attest());
  tx.addInput(fee, p2.unlock.spend(alicePub, sig()));
  tx.addOutput({ to: p2.address, amount: 1000n });
  tx.addOutput({ to: p2.tokenAddress, amount: aState.satoshis, token: { category: A_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(115n)) } } });
  tx.addOutput({ to: p2.address, amount: 1000n });
  tx.addOutput({ to: p2.tokenAddress, amount: bState.satoshis, token: { category: B_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(15n)) } } });
  tx.addOutput({ to: controller.tokenAddress, amount: ctrlUtxo.satoshis, token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } } });
  tx.addOutput({ to: p2.address, amount: 10000n });
  const built = tx.buildLibauthTransaction();
  return { inputs: built.inputs, outputs: built.outputs };
}

describe('P13: balanced transcript transactions satisfy standard relay policy (committed CI gate)', () => {
  it('every input unlocking script is within the 1650-byte standard limit', async () => {
    const { inputs } = await buildJournalTx();
    for (const inp of inputs) {
      expect(inp.unlockingBytecode.length).toBeLessThanOrEqual(MAX_UNLOCKING);
    }
  });

  it('every co-spent/created NFT commitment is within the 40-byte consensus limit', async () => {
    const { inputs, outputs } = await buildJournalTx();
    for (const io of [...inputs, ...outputs]) {
      const c = io.token?.nft?.commitment;
      if (c) expect(c.length).toBeLessThanOrEqual(MAX_COMMITMENT);
    }
  });

  it('every token-bearing output carries a non-zero (dust) value', async () => {
    const { outputs } = await buildJournalTx();
    for (const o of outputs) {
      if (o.token) expect(o.valueSatoshis).toBeGreaterThanOrEqual(800n);
    }
  });
});
