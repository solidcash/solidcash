import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const input0Verify = 'mandatory-script-verify-flag-failed (Unable to verify transaction: '
  + 'error in evaluating input index 0: Program failed an OP_VERIFY operation.)';

const raw = (builder: TransactionBuilder): string => (
  binToHex(encodeTransaction(builder.buildLibauthTransaction()))
);
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

const SINK = `pragma solidcash >=0.8.0;
interface ISink { function ping(int x); }
contract Sink() is ISink {
  function ping(int x) { require(x >= 0); }
  function other(int x) { require(x >= 0); }
}`;
const repeatedSource = (lockingBytecode: string): string => `pragma solidcash >=0.8.0;
interface ISink { function ping(int x); }
contract Repeated() {
  function invoke(int value) {
    ISink(hex"${lockingBytecode}").ping(value);
    ISink(hex"${lockingBytecode}").ping(9);
    require(value >= 0);
  }
}`;
const BLOCKS: layer3.BalancedBlock[] = [
  { dataSlots: 0, events: 0 }, { dataSlots: 0, events: 0 },
];

async function build(swapped: boolean): Promise<{ provider: any; transaction: string }> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const genesis = await (provider as any).addTokenUtxosDynamic((_category: string) => [{
    address: controller.tokenAddress,
    satoshis: 5000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  const category: string = genesis.categoryId;
  const sink = new Contract(compileString(SINK), [], { provider });
  const probe = new Contract(compileString(repeatedSource(sink.lockingBytecode)), [], { provider });
  const layout = layer3.balancedLayout(BLOCKS, 2);
  const externalCalls = layer3.deriveNativeExternalCalls({
    caller: probe, functionName: 'invoke', functionArgs: [7n],
    callerInput: layout.base(0), layout, targets: { ISink: [sink, sink] },
  });
  const common = {
    blocks: BLOCKS, calleeSlots: 2, invocations: [] as layer3.ExecutionInvocation[],
    controllerCategory: category, controllerLbc: controller.lockingBytecode,
    resources: [] as layer3.ExecutionResource[], externalCalls,
  };
  const callerArtifact = compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Caller', functionName: 'invoke', functionParams: 'int value',
    preamble: 'interface ISink { function ping(int x); }', selfPos: 0,
  }));
  const caller = new Contract(callerArtifact, [], { provider });
  const passive = new Contract(compileString(layer3.generateBalancedParticipant({
    ...common, contractName: 'Passive', functionName: 'noop', selfPos: 1,
  })), [], { provider });
  const root = layer3.executionRoot(
    [caller.lockingBytecode, passive.lockingBytecode], [], [], [], externalCalls,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const initialize = new TransactionBuilder({ provider });
  initialize.addInput(genesis.utxos[0], controller.unlock.setRoot(hexToBin(root), alicePub, signature()));
  const initializeFee = randomUtxo({ satoshis: 20000n });
  await provider.addUtxo(p2pkh.address, initializeFee);
  initialize.addInput(initializeFee, p2pkh.unlock.spend(alicePub, signature()));
  initialize.addOutput({
    to: controller.tokenAddress, amount: 5000n,
    token: { category, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  initialize.addOutput({ to: p2pkh.address, amount: 15000n });
  await provider.sendRawTransaction(raw(initialize));

  const controllerUtxo = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === root);
  const callerUtxo = randomUtxo({ satoshis: 3000n });
  const passiveUtxo = randomUtxo({ satoshis: 3000n });
  const sink0 = randomUtxo({ satoshis: 3000n });
  const sink1 = randomUtxo({ satoshis: 3000n });
  const fee = randomUtxo({ satoshis: 50000n });
  await provider.addUtxo(caller.address, callerUtxo);
  await provider.addUtxo(passive.address, passiveUtxo);
  await provider.addUtxo(sink.address, sink0);
  await provider.addUtxo(sink.address, sink1);
  await provider.addUtxo(p2pkh.address, fee);

  const tx = new TransactionBuilder({ provider });
  const callerSlot = layer3.balancedCaller(
    caller, callerUtxo, 'invoke', [7n], 0,
    { to: caller.address, amount: 3000n }, externalCalls,
  );
  tx.addInput(callerUtxo, (callerSlot.unlock as (value: layer3.BalancedLayout) => unknown)(layout) as never);
  tx.addInput(passiveUtxo, passive.unlock.noop());
  tx.addInput(sink0, sink.unlock.ping(swapped ? 9n : 7n));
  tx.addInput(sink1, sink.unlock.ping(swapped ? 7n : 9n));
  tx.addInput(controllerUtxo, controller.unlock.attest());
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({ to: caller.address, amount: 3000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: sink.address, amount: 3000n });
  tx.addOutput({ to: sink.address, amount: 3000n });
  tx.addOutput({
    to: controller.tokenAddress, amount: 5000n,
    token: { category, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx) };
}

describe('Layer-3 compiler-derived repeated native calls', () => {
  it('executes both compiler callsites in their committed physical order', async () => {
    const { provider, transaction } = await build(false);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects swapping the two repeated-call argument prefixes', async () => {
    const { provider, transaction } = await build(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(input0Verify);
  });
});
