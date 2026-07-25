import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Audit P2/P3/P6/P7: the callee STATE JOURNAL. The callee EXECUTES every edge naming it as callee - reading
// its resource state, applying each edge's operation (dispatched by the edge's selector: deposit=add,
// scale=mul) with the edge's args, IN ORDER, and flushing once. So repeated calls to one physical callee
// (P2), selector-to-operation dispatch (P3), ordered dependency (P6), and processing every row (P7) are REAL
// state transitions - not hashed labels. deposit(5) then scale(2) over state 10 => (10+5)*2 = 30; the order
// matters (scale-then-deposit would be 10*2+5 = 25), and a wrong final state is rejected.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const num8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const RES_CAT = 'cc'.repeat(32);
const DEPOSIT = layer3.methodSelector('deposit');
const SCALE = layer3.methodSelector('scale');

async function run(
  edges: layer3.ExecutionInvocation[], initialState: bigint, finalState: bigint,
): Promise<{ provider: any; rawTx: string }> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const genesis = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = genesis.categoryId;
  const resources: layer3.ExecutionResource[] = [{ owner: 1, categoryHex: RES_CAT }];
  const common = { n: 2, invocations: edges, controllerCategory: ctrlCat, controllerLbc: ctrlLbc, resources };
  const a = new Contract(compileString(layer3.generateExecutionParticipant({
    ...common, contractName: 'Caller', functionName: 'invoke', selfPos: 0, appBody: ['require(tx.inputs[0].value >= 0);'],
  })), [], { provider });
  // the callee runs a JOURNAL over resource 0, dispatching deposit->add, scale->mul.
  const b = new Contract(compileString(layer3.generateExecutionParticipant({
    ...common, contractName: 'Ledger', functionName: 'apply', selfPos: 1,
    journal: { resourceIndex: 0, ops: { [DEPOSIT]: 'add', [SCALE]: 'mul' } },
  })), [], { provider });
  const root = layer3.executionRoot([a.lockingBytecode, b.lockingBytecode], edges, [], resources);
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
  const resUtxo = randomUtxo({ satoshis: 4000n, token: { category: RES_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(initialState)) } } });
  await provider.addUtxo(p2.address, resUtxo);
  const fee = randomUtxo({ satoshis: 50000n }); await provider.addUtxo(p2.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(aU, a.unlock.invoke());
  tx.addInput(bU, b.unlock.apply());
  tx.addInput(ctrlUtxo, controller.unlock.attest()); // controller at input 2
  tx.addInput(resUtxo, p2.unlock.spend(alicePub, sig())); // resource (state) at input 3
  tx.addInput(fee, p2.unlock.spend(alicePub, sig()));
  tx.addOutput({ to: p2.address, amount: 1000n }); // 0
  tx.addOutput({ to: p2.address, amount: 1000n }); // 1
  tx.addOutput({ // 2 controller
    to: controller.tokenAddress, amount: ctrlUtxo.satoshis,
    token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ // 3 = resource recreation with the JOURNALED final state
    to: p2.tokenAddress, amount: resUtxo.satoshis,
    token: { category: RES_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(finalState)) } },
  });
  tx.addOutput({ to: p2.address, amount: 10000n });
  return { provider, rawTx: raw(tx) };
}

describe('P2/P6: callee state journal (real execution of ordered edges)', () => {
  it('POSITIVE: deposit(5) then scale(2) over state 10 => 30 (executed in order)', async () => {
    const { provider, rawTx } = await run(
      [{ caller: 0, callee: 1, selectorHex: DEPOSIT, argsHex: binToHex(num8(5n)) },
        { caller: 0, callee: 1, selectorHex: SCALE, argsHex: binToHex(num8(2n)) }],
      10n, 30n,
    );
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('ORDERING: scale(2) then deposit(5) over state 10 => 25, NOT 30 (order changes the result)', async () => {
    const { provider, rawTx } = await run(
      [{ caller: 0, callee: 1, selectorHex: SCALE, argsHex: binToHex(num8(2n)) },
        { caller: 0, callee: 1, selectorHex: DEPOSIT, argsHex: binToHex(num8(5n)) }],
      10n, 25n,
    );
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a final state that is not the journaled result (29 != 30) is rejected', async () => {
    const { provider, rawTx } = await run(
      [{ caller: 0, callee: 1, selectorHex: DEPOSIT, argsHex: binToHex(num8(5n)) },
        { caller: 0, callee: 1, selectorHex: SCALE, argsHex: binToHex(num8(2n)) }],
      10n, 29n, // wrong: the journal computes 30
    );
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow();
  });
});
