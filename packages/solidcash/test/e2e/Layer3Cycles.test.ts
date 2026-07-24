import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Re-audit R5 cycles: repeated settlement against ONE physical callee, and the smallest heterogeneous cycle
// A -> B -> A. On UTXO each input executes once, so there is no EVM-style reentrancy; a cycle is instead
// STRUCTURAL in the execution transcript - A->B->A is the edge list [A->B, B->A] committed by the controller
// root, and each participant runs once and verifies every edge it is in. Repeated 1-callee is [A->B.f,
// A->B.g] against one physical B input. Both are expressed with executionMemberBody's ordered edge list.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

async function run(invocations: any[], forgeRoot = false): Promise<{ provider: any; rawTx: string }> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const genesis = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = genesis.categoryId;
  const member = (self: number): string => layer3.executionMemberBody(2, self, invocations, ctrlCat, ctrlLbc).join('\n    ');
  const aSrc = `pragma solidcash >=0.8.0;\ncontract A_() {\n  function f() {\n    ${member(0)}\n    bigint a = tx.inputs[0].value + 1; require(a >= 1);\n  }\n}`;
  const bSrc = `pragma solidcash >=0.8.0;\ncontract B_() {\n  function g() {\n    ${member(1)}\n    bigint b = tx.inputs[1].value + 2; require(b >= 2);\n  }\n}`;
  const a = new Contract(compileString(aSrc), [], { provider });
  const b = new Contract(compileString(bSrc), [], { provider });
  const honest = layer3.executionRoot([a.lockingBytecode, b.lockingBytecode], invocations);
  const root = forgeRoot ? layer3.executionRoot([a.lockingBytecode, b.lockingBytecode], invocations.slice(0, 1)) : honest;
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
  const fee = randomUtxo({ satoshis: 50000n }); await provider.addUtxo(p2.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(aU, a.unlock.f());
  tx.addInput(bU, b.unlock.g());
  tx.addInput(ctrlUtxo, controller.unlock.attest());
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

describe('R5 cycles: repeated 1-callee settlement + heterogeneous A->B->A', () => {
  it('POSITIVE: repeated settlement against one physical callee - edges [A->B.f, A->B.g]', async () => {
    const { provider, rawTx } = await run([
      { caller: 0, callee: 1, selectorHex: '11111111' },
      { caller: 0, callee: 1, selectorHex: '22222222' },
    ]);
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('POSITIVE: heterogeneous cycle A->B->A - edges [A->B, B->A]', async () => {
    const { provider, rawTx } = await run([
      { caller: 0, callee: 1, selectorHex: '11111111' },
      { caller: 1, callee: 0, selectorHex: '22222222' },
    ]);
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a controller root missing the return edge (B->A) breaks the cycle - rejected', async () => {
    const { provider, rawTx } = await run([
      { caller: 0, callee: 1, selectorHex: '11111111' },
      { caller: 1, callee: 0, selectorHex: '22222222' },
    ], true); // controller commits only the first edge; participants recompute both -> mismatch
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow();
  });
});
