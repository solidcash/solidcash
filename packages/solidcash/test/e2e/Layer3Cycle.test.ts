import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Audit P2/P6 headline: REAL A->B->A execution (not label agreement). A deposits into B; B applies it to its
// own state and EMITS its authentic post-state on the return edge; A consumes that post-state and applies it
// to A's own state. Both participants are journals with their own resource NFTs. A cannot be credited a value
// B did not actually produce: the return edge's args must equal B's flushed state (emits:[1]), so forging a
// larger credit makes B's covenant reject. deposit(5) over B=10 -> 15; A credits 15 over A=100 -> 115.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const num8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const A_CAT = 'aa'.repeat(32);
const B_CAT = 'bb'.repeat(32);
const DEPOSIT = layer3.methodSelector('deposit');
const CREDIT = layer3.methodSelector('credit');

// creditValue is what the B->A return edge carries (B's claimed post-state); aFinal is A's recreated state.
async function run(creditValue: bigint, aFinal: bigint): Promise<{ provider: any; rawTx: string }> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const genesis = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = genesis.categoryId;
  const resources: layer3.ExecutionResource[] = [{ owner: 0, categoryHex: A_CAT }, { owner: 1, categoryHex: B_CAT }];
  // edge0: A->B deposit(5). edge1: B->A credit(<B post-state>). B applies deposit, emits its state on edge1;
  // A applies credit on edge1.
  const edges: layer3.ExecutionInvocation[] = [
    { caller: 0, callee: 1, selectorHex: DEPOSIT, argsHex: binToHex(num8(5n)) },
    { caller: 1, callee: 0, selectorHex: CREDIT, argsHex: binToHex(num8(creditValue)) },
  ];
  const common = { n: 2, invocations: edges, controllerCategory: ctrlCat, controllerLbc: ctrlLbc, resources };
  const a = new Contract(compileString(layer3.generateExecutionParticipant({
    ...common, contractName: 'Payer', functionName: 'pay', selfPos: 0,
    journal: { resourceIndex: 0, ops: { [CREDIT]: 'add' } }, // A consumes B's returned credit
  })), [], { provider });
  const b = new Contract(compileString(layer3.generateExecutionParticipant({
    ...common, contractName: 'Vault', functionName: 'take', selfPos: 1,
    journal: { resourceIndex: 1, ops: { [DEPOSIT]: 'add' }, emits: [1] }, // B applies deposit, emits post-state on edge1
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
  const aState = randomUtxo({ satoshis: 4000n, token: { category: A_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(100n)) } } });
  const bState = randomUtxo({ satoshis: 4000n, token: { category: B_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(10n)) } } });
  await provider.addUtxo(p2.address, aState); await provider.addUtxo(p2.address, bState);
  const fee = randomUtxo({ satoshis: 50000n }); await provider.addUtxo(p2.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(aU, a.unlock.pay());
  tx.addInput(bU, b.unlock.take());
  tx.addInput(ctrlUtxo, controller.unlock.attest()); // controller at input 2
  tx.addInput(aState, p2.unlock.spend(alicePub, sig())); // A-state at input 3 (resource 0)
  tx.addInput(bState, p2.unlock.spend(alicePub, sig())); // B-state at input 4 (resource 1)
  tx.addInput(fee, p2.unlock.spend(alicePub, sig()));
  tx.addOutput({ to: p2.address, amount: 1000n }); // 0
  tx.addOutput({ to: p2.address, amount: 1000n }); // 1
  tx.addOutput({ // 2 controller
    to: controller.tokenAddress, amount: ctrlUtxo.satoshis,
    token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ // 3 A-state' = A credited
    to: p2.tokenAddress, amount: aState.satoshis,
    token: { category: A_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(aFinal)) } },
  });
  tx.addOutput({ // 4 B-state' = B after deposit (always 15)
    to: p2.tokenAddress, amount: bState.satoshis,
    token: { category: B_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(15n)) } },
  });
  tx.addOutput({ to: p2.address, amount: 10000n });
  return { provider, rawTx: raw(tx) };
}

describe('P2/P6: real A->B->A execution with authentic returned result', () => {
  it('POSITIVE: A deposits 5, B->15, B returns its 15, A credits to 100 -> 115', async () => {
    const { provider, rawTx } = await run(15n, 115n);
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: the return edge forging a credit B never produced (50 != 15) is rejected by B', async () => {
    const { provider, rawTx } = await run(50n, 150n); // A tries to be credited 50; B computed only 15
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow(
      'mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index 1: '
      + 'Program failed an OP_VERIFY operation.)',
    );
  });
});
