import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Refinement 1 (auto-wiring): the developer no longer hand-splices executionMemberBody. They pass a spec +
// their own appBody to generateExecutionParticipant, which injects the transcript verification automatically.
// This test builds BOTH participants that way and shows they mutually authenticate under the controller root -
// same soundness as the hand-written Layer3Heterogeneous, but the transcript wiring is generated.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const INV = [{ caller: 0, callee: 1, selectorHex: 'aabbccdd' }];

describe('refinement: module auto-wiring (generateExecutionParticipant)', () => {
  it('POSITIVE: two participants generated from specs (transcript auto-injected) mutually authenticate', async () => {
    const provider = createTestProvider();
    const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
    const ctrlLbc = controller.lockingBytecode;
    const genesis = await (provider as any).addTokenUtxosDynamic((_c: string) => [
      { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
    ]);
    const ctrlCat: string = genesis.categoryId;
    // The developer writes ONLY a spec + appBody; executionMemberBody is auto-injected.
    const common = { n: 2, invocations: INV, controllerCategory: ctrlCat, controllerLbc: ctrlLbc };
    const callerSrc = layer3.generateExecutionParticipant({
      ...common, contractName: 'Caller', functionName: 'invoke', selfPos: 0,
      appBody: ['bigint x = tx.inputs[0].value + 1; require(x >= 1);'],
    });
    const calleeSrc = layer3.generateExecutionParticipant({
      ...common, contractName: 'Callee', functionName: 'serve', selfPos: 1,
      appBody: ['bigint y = tx.inputs[1].value + 2; require(y >= 2);'],
    });
    const caller = new Contract(compileString(callerSrc), [], { provider });
    const callee = new Contract(compileString(calleeSrc), [], { provider });
    expect(caller.lockingBytecode).not.toBe(callee.lockingBytecode);

    const root = layer3.executionRoot([caller.lockingBytecode, callee.lockingBytecode], INV);
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
    const bU = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(callee.address, bU);
    const fee = randomUtxo({ satoshis: 50000n }); await provider.addUtxo(p2.address, fee);
    const tx = new TransactionBuilder({ provider });
    tx.addInput(aU, caller.unlock.invoke());
    tx.addInput(bU, callee.unlock.serve());
    tx.addInput(ctrlUtxo, controller.unlock.attest());
    tx.addInput(fee, p2.unlock.spend(alicePub, sig()));
    tx.addOutput({ to: p2.address, amount: 1000n });
    tx.addOutput({ to: p2.address, amount: 1000n });
    tx.addOutput({
      to: controller.tokenAddress, amount: ctrlUtxo.satoshis,
      token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
    });
    tx.addOutput({ to: p2.address, amount: 12000n });
    await expect(provider.sendRawTransaction(raw(tx))).resolves.toBeTypeOf('string');
  });

  it('validates the spec (bad contract/function name, selfPos range)', () => {
    const base = { n: 2, invocations: INV, controllerCategory: 'ab'.repeat(32), controllerLbc: 'aa20', selfPos: 0 };
    expect(() => layer3.generateExecutionParticipant({ ...base, contractName: '1bad', functionName: 'f' })).toThrow();
    expect(() => layer3.generateExecutionParticipant({ ...base, contractName: 'Ok', functionName: '1f' })).toThrow();
    expect(() => layer3.generateExecutionParticipant({ ...base, contractName: 'Ok', functionName: 'f', selfPos: 5 })).toThrow();
  });
});
