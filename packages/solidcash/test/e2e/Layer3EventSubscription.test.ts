import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, Signer, StatefulContract, layer3, type TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract EventSubscription() {
  mapping(address => bool) public subscribers;
  address[] public subscriberList;
  function subscribe(address sender) public {
    require(!subscribers[sender]);
    subscribers[sender] = true;
    subscriberList.push(sender);
  }
}`;

describe('EventSubscription mixed collection journal', () => {
  const build = async (): Promise<{ builder: TransactionBuilder; call: any }> => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 66; index += 1) {
      await provider.addUtxo(signer.getAddress(), randomUtxo({ satoshis: 10_000n }));
    }
    const contract = StatefulContract.withCategory(inner, categoryId).connect(signer);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const call = contract.batch([{ function: 'subscribe', args: [hexToBin(p2pkh.lockingBytecode)] }]);
    const builder = await call.build();
    return { builder, call };
  };

  it('settles subscribe under BCH-2026', async () => {
    const { call } = await build();
    expect((await call.send()).txid).toBeDefined();
  }, 180_000);

  it('refuses a forged array post-state slot at input 0', async () => {
    const { builder } = await build();
    builder.outputs[1] = builder.outputs[0];
    builder.outputs.push(builder.outputs[builder.outputs.length - 1]);
    expect(() => layer3.preflightLayer3Transaction(builder)).toThrow(/input 0/);
  }, 180_000);

  it('refuses a forged mapping-entry post-state slot at input 0', async () => {
    const { builder } = await build();
    builder.outputs[2] = builder.outputs[0];
    builder.outputs.push(builder.outputs[builder.outputs.length - 1]);
    expect(() => layer3.preflightLayer3Transaction(builder)).toThrow(/input 0/);
  }, 180_000);
});
