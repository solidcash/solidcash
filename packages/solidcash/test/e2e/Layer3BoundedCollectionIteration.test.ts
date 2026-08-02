import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, StatefulContract, layer3, type TransactionBuilder,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

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

describe('bounded fixed-array collection iteration on the Layer-3 route', () => {
  const build = async (): Promise<{
    builder: TransactionBuilder; call: any; inner: Contract; categoryId: string;
  }> => {
    const provider = createTestProvider();
    const artifact = compileString(source, { forceStateful: true, hiddenBatch: true });
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
    builder.addOutput({ to: p2pkh.address, amount: 9_000n });
    return { builder, call, inner, categoryId };
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
    const { builder } = await build();
    [builder.inputs[2], builder.inputs[3]] = [builder.inputs[3], builder.inputs[2]];
    expect(() => layer3.preflightLayer3Transaction(builder))
      .toThrow('BCH-2026 preflight failed at input 0: malformed SCB1 envelope; VM: Program failed an OP_VERIFY operation.');
  }, 180_000);

  it('refuses a missing fixed entry replaced by another block slot at input 0', async () => {
    const { builder } = await build();
    builder.inputs[2] = builder.inputs[1];
    expect(() => layer3.preflightLayer3Transaction(builder))
      .toThrow('BCH-2026 preflight failed at input 0: malformed SCB1 envelope; VM: Program called an OP_SPLIT');
  }, 180_000);

  it('refuses an injected entry inside the fixed segment at input 0', async () => {
    const { builder } = await build();
    builder.inputs.splice(3, 0, builder.inputs[2]);
    builder.outputs.push(builder.outputs[builder.outputs.length - 1]);
    (builder as any).options.allowImplicitNftBurn = true;
    expect(() => layer3.preflightLayer3Transaction(builder))
      .toThrow('BCH-2026 preflight failed at input 0: malformed SCB1 envelope; VM: Program failed an OP_VERIFY operation.');
  }, 180_000);
});
