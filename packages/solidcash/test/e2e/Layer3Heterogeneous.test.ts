import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Re-audit R3/R5: bind INDEPENDENTLY COMPILED, HETEROGENEOUS participant covenants (different app code, not
// clones of one artifact) to their projections of the controller-attested EXECUTION root. Two different
// contracts - a caller and a callee with distinct logic - each embed the reusable executionMemberBody snippet
// and mutually authenticate: each reads both participants' locking bytecodes at their fixed positions,
// recomputes sha256(domain || lbcs || edges), and requires the co-spent controller to commit exactly that.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const INV = [{ caller: 0, callee: 1, selectorHex: 'aabbccdd' }];

async function setup(): Promise<any> {
  const provider = createTestProvider();
  // Controller (R7): real, mint-once, exact identity.
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const genesis = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = genesis.categoryId;
  // Two DIFFERENT compiled participants, each embedding the member snippet + its own distinct logic.
  const member = (self: number): string => layer3.executionMemberBody(2, self, INV, ctrlCat, ctrlLbc).join('\n    ');
  const callerSrc = `pragma solidcash >=0.8.0;
contract Caller() {
  function invoke() {
    ${member(0)}
    bigint a = tx.inputs[0].value * 2; require(a >= 0);
  }
}`;
  const calleeSrc = `pragma solidcash >=0.8.0;
contract Callee() {
  function serve() {
    ${member(1)}
    bigint b = tx.inputs[1].value * 3; require(b >= 0);
  }
}`;
  const caller = new Contract(compileString(callerSrc), [], { provider });
  const callee = new Contract(compileString(calleeSrc), [], { provider });
  expect(caller.lockingBytecode).not.toBe(callee.lockingBytecode); // genuinely different compiled code
  const root = layer3.executionRoot([caller.lockingBytecode, callee.lockingBytecode], INV);
  // setRoot on the controller.
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
  return { provider, controller, ctrlCat, ctrlUtxo, root, caller, callee, p2 };
}

async function buildTranscript(s: any, callerPos = 0, calleePos = 1): Promise<TransactionBuilder> {
  const callerUtxo = randomUtxo({ satoshis: 3000n }); await s.provider.addUtxo(s.caller.address, callerUtxo);
  const calleeUtxo = randomUtxo({ satoshis: 3000n }); await s.provider.addUtxo(s.callee.address, calleeUtxo);
  const fee = randomUtxo({ satoshis: 50000n }); await s.provider.addUtxo(s.p2.address, fee);
  const b = new TransactionBuilder({ provider: s.provider });
  const inputs = [] as any[];
  inputs[callerPos] = { utxo: callerUtxo, un: s.caller.unlock.invoke() };
  inputs[calleePos] = { utxo: calleeUtxo, un: s.callee.unlock.serve() };
  b.addInput(inputs[0].utxo, inputs[0].un); // participant at input 0
  b.addInput(inputs[1].utxo, inputs[1].un); // participant at input 1
  b.addInput(s.ctrlUtxo, s.controller.unlock.attest()); // controller at input 2
  b.addInput(fee, s.p2.unlock.spend(alicePub, sig()));
  b.addOutput({ to: s.p2.address, amount: 1000n }); // output 0
  b.addOutput({ to: s.p2.address, amount: 1000n }); // output 1
  b.addOutput({ // controller recreation at output 2 (preserved)
    to: s.controller.tokenAddress, amount: s.ctrlUtxo.satoshis,
    token: { category: s.ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: s.root } },
  });
  b.addOutput({ to: s.p2.address, amount: 12000n }); // output 3 change
  return b;
}

describe('R3/R5: heterogeneous participants under one execution root', () => {
  it('POSITIVE: two DIFFERENT compiled contracts mutually authenticate under the controller execution root', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(raw(await buildTranscript(s)))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: swapping the participants to the wrong positions is rejected', async () => {
    const s = await setup();
    // caller at input 1, callee at input 0: each participant's self-position check (and the position-bound
    // root) fails.
    await expect(s.provider.sendRawTransaction(raw(await buildTranscript(s, 1, 0))))
      .rejects.toThrow(/error in evaluating input index 0: Program failed an OP_VERIFY operation/);
  });
});
