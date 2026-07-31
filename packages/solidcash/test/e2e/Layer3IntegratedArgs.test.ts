import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Audit P4 (partial): runtime argument/result values are now part of the MODULE protocol - carried in
// ExecutionInvocation {argsHex, resultHex}, framed into the canonical execution root, and exposed to the
// callee by generateExecutionParticipant as edgeArgs<j>/edgeResult<j>. The callee AUTHENTICATES the committed
// result against its own state (result == amount * rate) - no bespoke covenant. A wrong committed result is
// rejected. (Still open: binding these to an ACTUAL dispatched selector/call and a callee journal - P2/P3/P6.)
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const num8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

async function run(amount: bigint, result: bigint, rate: bigint): Promise<{ provider: any; rawTx: string }> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const genesis = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = genesis.categoryId;
  const inv: layer3.ExecutionInvocation = {
    caller: 0, callee: 1, selectorHex: layer3.methodSelector('serve'), // P3: selector == callee method
    argsHex: binToHex(num8(amount)), resultHex: binToHex(num8(result)),
  };
  const common = { n: 2, invocations: [inv], controllerCategory: ctrlCat, controllerLbc: ctrlLbc };
  const callerSrc = layer3.generateExecutionParticipant({
    ...common, contractName: 'Caller', functionName: 'invoke', selfPos: 0,
    appBody: ['require(tx.inputs[0].value >= 0);'],
  });
  // The callee AUTHENTICATES the module-committed result against its own state rate (input 1 commitment).
  const calleeSrc = layer3.generateExecutionParticipant({
    ...common, contractName: 'Callee', functionName: 'serve', selfPos: 1,
    appBody: ['bigint rate = int(tx.inputs[1].nftCommitment.slice(0, 8));', 'require(int(edgeResult0) == int(edgeArgs0) * rate);'],
  });
  const caller = new Contract(compileString(callerSrc), [], { provider });
  const callee = new Contract(compileString(calleeSrc), [], { provider });
  const root = layer3.executionRoot([caller.lockingBytecode, callee.lockingBytecode], [inv]);
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
  const aU = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(caller.address, aU);
  const stateCat = 'dd'.repeat(32);
  const bU = randomUtxo({ satoshis: 3000n, token: { category: stateCat, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(rate)) } } });
  await provider.addUtxo(callee.address, bU);
  const fee = randomUtxo({ satoshis: 50000n }); await provider.addUtxo(p2.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(aU, caller.unlock.invoke());
  tx.addInput(bU, callee.unlock.serve());
  tx.addInput(ctrlUtxo, controller.unlock.attest());
  tx.addInput(fee, p2.unlock.spend(alicePub, sig()));
  tx.addOutput({ to: p2.address, amount: 1000n });
  tx.addOutput({ // recreate the callee state NFT (no implicit burn)
    to: callee.tokenAddress, amount: bU.satoshis,
    token: { category: stateCat, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(rate)) } },
  });
  tx.addOutput({
    to: controller.tokenAddress, amount: ctrlUtxo.satoshis,
    token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2.address, amount: 12000n });
  return { provider, rawTx: raw(tx) };
}

describe('P4: module-integrated runtime args/results (callee-authenticated)', () => {
  it('POSITIVE: committed args=5, result=15 authenticated against the callee rate=3', async () => {
    const { provider, rawTx } = await run(5n, 15n, 3n);
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a committed result inconsistent with args*rate (14 != 5*3) is rejected by the callee', async () => {
    const { provider, rawTx } = await run(5n, 14n, 3n);
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow(
      'mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index 1: '
      + 'Unsuccessful evaluation: completed with a non-truthy value on top of the stack. Top stack item: "".)',
    );
  });
});
