import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import {
  Contract,
  SignatureTemplate,
  type TransactionBuilder,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';
import { assertAuthenticatingVmEvidence } from '../vm-evidence.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';

const source = `pragma solidcash >=0.8.0;
contract FixedIteration() {
  bigint total;
  bigint[2] values;
  function set0(bigint value) public { this.values[0] = value; require(value >= 0); }
  function set1(bigint value) public { this.values[1] = value; require(value >= 0); }
  function sum() public {
    bigint result = 0;
    for (bigint value of this.values) { result = result + value; }
    this.total = result;
    require(result >= 0);
  }
  function check(bigint expected) public { require(this.total == expected); }
}`;

describe('bounded fixed-array collection iteration on the message bus route', () => {
  const build = async (): Promise<{
    builder: TransactionBuilder; call: any; inner: Contract; categoryId: string; routeName: string;
  }> => {
    const provider = createTestProvider();
    const artifact = compileString(source, { forceStateful: true, messageBus: true });
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true, physicalEntrySlots: [0, 1] });
    expect(artifact.messageBus?.route.entryAccesses?.map((access) =>
      access.keySources[0].kind === 'constant' ? access.keySources[0].constantValue : undefined))
      .toEqual(['0', '1']);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    let contract = StatefulContract.withCategory(inner, categoryId);
    await contract.set0(11n).send();
    contract = StatefulContract.withCategory(inner, categoryId);
    await contract.set1(31n).send();
    contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'sum', args: [] }]);
    const builder = await call.build();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fee = randomUtxo({ satoshis: 10_000n });
    await provider.addUtxo(p2pkh.address, fee);
    builder.addInput(fee, p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
    builder.addOutput({ to: p2pkh.address, amount: 8_000n });
    builder.addOutput({ to: p2pkh.address, amount: 1_000n });
    assertAuthenticatingVmEvidence(builder);
    return { builder, call, inner, categoryId, routeName: artifact.messageBus!.route.name };
  };

  const routeVmAccepts = (builder: TransactionBuilder, routeName: string): boolean => {
    const routeInput = builder.inputs.findIndex((input) =>
      input.unlocker?.abiFunction.name === routeName);
    expect(routeInput).toBeGreaterThanOrEqual(0);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    return vm.stateSuccess(vm.evaluate({
      inputIndex: routeInput,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: builder.buildLibauthTransaction(),
    })) === true;
  };

  it('settles the compiler-fixed two-entry iteration under BCH-2026', async () => {
    const { call, inner, categoryId } = await build();
    const settled = await call.send();
    expect(settled).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.check(42n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      hex: expect.stringMatching(/.+/),
    });
  }, 180_000);

  it('refuses reordered fixed entry identities at input 0', async () => {
    const { builder, routeName } = await build();
    [builder.inputs[2], builder.inputs[3]] = [builder.inputs[3], builder.inputs[2]];
    expect(routeVmAccepts(builder, routeName)).toBe(false);
  }, 180_000);

  it('refuses a missing fixed entry replaced by another block slot at input 0', async () => {
    const { builder, routeName } = await build();
    builder.inputs[2] = builder.inputs[1];
    expect(routeVmAccepts(builder, routeName)).toBe(false);
  }, 180_000);

  it('refuses an injected entry inside the fixed segment at input 0', async () => {
    const { builder, routeName } = await build();
    builder.inputs.splice(3, 0, builder.inputs[2]);
    builder.outputs.push(builder.outputs[builder.outputs.length - 1]);
    (builder as any).options.allowImplicitNftBurn = true;
    expect(routeVmAccepts(builder, routeName)).toBe(false);
  }, 180_000);
});
