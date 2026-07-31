import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Audit P8: a balanced transcript participant makes a REAL native IContract(addr).method() call to an
// independently compiled callee, composed under the balanced layout. The callee (Sink) is co-spent in the
// layout's callee slot (after the participant blocks, before the controller); the caller forwards its arg and
// the compiler's on-chain dispatch verification checks OP_UTXOBYTECODE(callee) == addr. This proves the
// generator composes with native calls (not a no-call fixture): the native call's block sits at calleeBase,
// the controller shifts to base 3, and the whole thing is balanced (5 inputs / 5 outputs) on the real VM. A
// wrong callee-base witness (pointing off the real callee) is rejected.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

const SINK = `pragma solidcash >=0.8.0;
interface ISink { function ping(int x); }
contract Sink() is ISink {
  function ping(int x) { require(x >= 0); }
  function other(int x) { require(x >= 0); }
}`;
const CALLER_PROBE = `pragma solidcash >=0.8.0;
interface ISink { function ping(int x); }
contract CallerProbe(bytes sinkAddr) {
  function invoke(int val) { ISink(sinkAddr).ping(val); require(val >= 0); }
}`;

// A(caller) + B(passive), one native-call callee slot. base(0)=0, base(1)=1, calleeBase=2, controller=3, fee=4.
const BLOCKS: layer3.BalancedBlock[] = [{ dataSlots: 0, events: 0 }, { dataSlots: 0, events: 0 }];

async function run(
  calleeBaseWitness: bigint,
  commitment: 'honest' | 'omitted' | 'wrong-selector' | 'wrong-arg' = 'honest',
): Promise<{ provider: any; rawTx: string }> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const gen = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = gen.categoryId;
  const sink = new Contract(compileString(SINK), [], { provider });
  const callerProbe = new Contract(compileString(CALLER_PROBE), [sink.lockingBytecode], { provider });
  const layout = layer3.balancedLayout(BLOCKS, 1);
  const derived = layer3.deriveNativeExternalCalls({
    caller: callerProbe, functionName: 'invoke', functionArgs: [7n],
    callerInput: layout.base(0), layout, targets: { ISink: sink },
  });
  const externalCalls = commitment === 'omitted'
    ? ([] as unknown as layer3.DerivedExternalCallTable) : derived;
  const common = {
    blocks: BLOCKS, calleeSlots: 1, invocations: [] as layer3.ExecutionInvocation[],
    controllerCategory: ctrlCat, controllerLbc: ctrlLbc, resources: [] as layer3.ExecutionResource[], externalCalls,
  };
  const a = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Caller', functionName: 'invoke', selfPos: 0,
    preamble: 'interface ISink { function ping(int x); }', constructorParams: 'bytes sinkAddr',
    functionParams: 'int val',
  })), [sink.lockingBytecode], { provider });
  const b = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Passive', functionName: 'noop', selfPos: 1,
  })), [], { provider });
  const root = layer3.executionRoot([a.lockingBytecode, b.lockingBytecode], [], [], [], externalCalls);
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
  const bU = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(b.address, bU);
  const sinkU = randomUtxo({ satoshis: 3000n }); await provider.addUtxo(sink.address, sinkU);
  const fee = randomUtxo({ satoshis: 50000n }); await provider.addUtxo(p2.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(aU, a.unlock.invoke(7n, calleeBaseWitness)); // 0 caller (forwards 7 to the callee)
  tx.addInput(bU, b.unlock.noop());                        // 1 passive participant
  tx.addInput(sinkU, commitment === 'wrong-selector'
    ? sink.unlock.other(7n)
    : sink.unlock.ping(commitment === 'wrong-arg' ? 8n : 7n)); // 2 actual callee dispatch
  tx.addInput(ctrlUtxo, controller.unlock.attest());       // 3 controller
  tx.addInput(fee, p2.unlock.spend(alicePub, sig()));      // 4 fee
  // 0 caller self-preserved: a regular ext-call recreates the caller (lbc + value).
  tx.addOutput({ to: a.address, amount: aU.satoshis });
  tx.addOutput({ to: p2.address, amount: 1000n });         // 1 passive executor paired (one-shot)
  tx.addOutput({ to: sink.address, amount: sinkU.satoshis }); // 2 callee master preserved
  tx.addOutput({ // 3 controller preserved
    to: controller.tokenAddress, amount: ctrlUtxo.satoshis,
    token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2.address, amount: 10000n });        // 4 change
  return { provider, rawTx: raw(tx) };
}

describe('P8: native IContract call composed under the balanced layout', () => {
  const VM_REFUSAL =
    /mandatory-script-verify-flag-failed[\s\S]*evaluating input index 0: Program failed an OP_VERIFY operation/;
  it('POSITIVE: the participant natively calls the co-spent callee at the layout callee slot (base 2)', async () => {
    const { provider, rawTx } = await run(2n);
    await expect(provider.sendRawTransaction(rawTx)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a callee-base witness pointing off the real callee is rejected', async () => {
    const { provider, rawTx } = await run(1n); // input 1 is the passive participant, not the sink
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow(VM_REFUSAL);
  });

  it('HOSTILE: rejects a native call with no committed external-call row', async () => {
    await expect(run(2n, 'omitted')).rejects.toThrow('must be derived from compiler artifact metadata');
  });

  it('HOSTILE: rejects a false committed selector while dispatching ping(int)', async () => {
    const { provider, rawTx } = await run(2n, 'wrong-selector');
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow(VM_REFUSAL);
  });

  it('HOSTILE: rejects argument substitution under the correct selector', async () => {
    const { provider, rawTx } = await run(2n, 'wrong-arg');
    await expect(provider.sendRawTransaction(rawTx)).rejects.toThrow(VM_REFUSAL);
  });
});
