import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Audit P8 auto-derivation: the SDK derives the native-call co-spend index from the balanced layout - the
// developer never writes a physical slot number. `balancedCaller` fills the caller's callee-base witness from
// layout.calleeBase(k); `buildBalancedTranscriptTx` enforces the balanced structure (exactly totalSlots slots,
// 1:1 input/output). This is the same real IContract(addr).ping(val) call as Layer3BalancedCall, but with the
// co-spend index DERIVED, not hand-supplied.
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

const SINK = `pragma solidcash >=0.8.0;
interface ISink { function ping(int x); }
contract Sink() is ISink { function ping(int x) { require(x >= 0); } }`;
const BLOCKS: layer3.BalancedBlock[] = [{ dataSlots: 0, events: 0 }, { dataSlots: 0, events: 0 }];

describe('P8: SDK auto-derives the balanced native-call co-spend', () => {
  it('POSITIVE: buildBalancedTranscriptTx + balancedCaller derive the callee-base witness from the layout', async () => {
    const provider = createTestProvider();
    const layout = layer3.balancedLayout(BLOCKS, 1); // 2 participants + 1 callee slot
    const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
    const ctrlLbc = controller.lockingBytecode;
    const gen = await (provider as any).addTokenUtxosDynamic((_c: string) => [
      { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
    ]);
    const ctrlCat: string = gen.categoryId;
    const sink = new Contract(compileString(SINK), [], { provider });
    const common = {
      blocks: BLOCKS, calleeSlots: 1, invocations: [] as layer3.ExecutionInvocation[],
      controllerCategory: ctrlCat, controllerLbc: ctrlLbc, resources: [] as layer3.ExecutionResource[],
    };
    const a = new Contract(compileString(layer3.generateBalancedParticipant({
      ...common, contractName: 'Caller', functionName: 'invoke', selfPos: 0,
      preamble: 'interface ISink { function ping(int x); }', constructorParams: 'bytes sinkAddr',
      functionParams: 'int val', appBody: ['ISink(sinkAddr).ping(val);'],
    })), [sink.lockingBytecode], { provider });
    const b = new Contract(compileString(layer3.generateBalancedParticipant({
      ...common, contractName: 'Passive', functionName: 'noop', selfPos: 1,
    })), [], { provider });
    const root = layer3.executionRoot([a.lockingBytecode, b.lockingBytecode], [], [], []);
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
    // Assemble via the SDK helper: the caller's witness is DERIVED from the layout, not hand-written.
    const slots: layer3.BalancedSlot[] = [
      layer3.balancedCaller(a, aU, 'invoke', [7n], 0, { to: a.address, amount: aU.satoshis }), // slot 0 caller
      { utxo: bU, unlock: b.unlock.noop(), output: { to: p2.address, amount: 1000n } },        // slot 1 passive
      { utxo: sinkU, unlock: sink.unlock.ping(7n), output: { to: sink.address, amount: sinkU.satoshis } }, // slot 2 callee
      { utxo: ctrlUtxo, unlock: controller.unlock.attest(), output: {
        to: controller.tokenAddress, amount: ctrlUtxo.satoshis,
        token: { category: ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
      } },                                                                                       // slot 3 controller
      { utxo: fee, unlock: p2.unlock.spend(alicePub, sig()), output: { to: p2.address, amount: 10000n } }, // slot 4 fee
    ];
    // sanity: the derived callee base is the layout's callee slot, not a magic number.
    expect(layout.calleeBase(0)).toBe(2);
    const tx = layer3.buildBalancedTranscriptTx(provider, layout, slots);
    await expect(provider.sendRawTransaction(raw(tx))).resolves.toBeTypeOf('string');
  });

  it('the assembler rejects a wrong slot count (balanced structure enforced)', () => {
    const layout = layer3.balancedLayout(BLOCKS, 1);
    expect(() => layer3.buildBalancedTranscriptTx(createTestProvider(), layout, []))
      .toThrow(/exactly 5 slots/);
  });
});
