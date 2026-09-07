import { binToHex } from '@bitauth/libauth';
import { compileStringMulti } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

describe('kernel stateless child construction', () => {
  it('executes a child-address expression without reserving a deployment span', async () => {
    const provider = createTestProvider();
    const artifacts = compileStringMulti(`contract Blueprint(int seed) {
        function check(int value) public pure { require(value == seed); }
      }
      contract Factory() {
        address latest;
        function make(int seed) public {
          Blueprint child = new Blueprint(seed);
          this.latest = address(child);
          require(true);
        }
      }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });
    const handler = artifacts.Factory.messageBus?.handlers.find((candidate) => candidate.name === 'make');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler).not.toHaveProperty('childDeployments');

    const connect = async (): Promise<StatefulContract> => {
      const inner = new Contract(artifacts.Factory, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, inner, artifacts.Factory.stateLayout!, {}, { saltContract: true },
      );
      return StatefulContract.withCategory(inner, categoryId);
    };
    const direct = await connect();
    await direct.call.make(7n).send();
    const expected = await direct.getState();
    expect(expected.latest).toBeInstanceOf(Uint8Array);

    const connected = await connect();
    const call = connected.batch([{ function: 'make', args: [7n] }]);
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }

    await call.send();
    const state = await connected.getState();
    expect(state.latest).toBeInstanceOf(Uint8Array);
    expect(binToHex(state.latest as Uint8Array)).toBe(binToHex(expected.latest as Uint8Array));
  }, 180_000);
});
