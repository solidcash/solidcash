import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { alicePkh } from '../../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

describe('kernel route for a fixed-size locally constructed mapping-key array', () => {
  it('updates a seeded nested entry through direct and helper-owned unrolled keys on the BCH VM', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract C {
      mapping(int => mapping(bytes20 => int)) w;
      function seed(int id, bytes20 key) public { w[id][key] = 0; require(true); }
      function update(int id, bytes20 key) public {
        bytes20[] memory keys = new bytes20[](1);
        keys[0] = key;
        for (int i = 0; i < keys.length; i++) w[id][keys[i]] = 1;
        require(true);
      }
      function writeHelper(int id, bytes20[] enabled, bytes20[] disabled) internal {
        for (int i = 0; i < enabled.length; i++) w[id][enabled[i]] = 1;
        for (int i = 0; i < disabled.length; i++) w[id][disabled[i]] = 2;
      }
      function updateHelper(int id, bytes20 key) public {
        bytes20[] memory keys = new bytes20[](1);
        keys[0] = key;
        writeHelper(id, new bytes20[](0), keys);
        require(true);
      }
      function check(int id, bytes20 key, int expected) public { require(w[id][key] == expected); }
    }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      maximumInputBytes: 1_000_000, suppressWarnings: true,
    });
    for (const name of ['update', 'updateHelper']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
    }
    const base = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, {
      saltContract: true,
    });
    const contract = StatefulContract.withCategory(base, categoryId);
    await contract.call.seed(3n, alicePkh).send();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (const [name, expected] of [['update', 1n], ['updateHelper', 2n]] as const) {
      const call = contract.batch([{ function: name, args: [3n, alicePkh] }]);
      const builder = await call.build();
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `${name} input ${inputIndex}`)
          .toBe(true);
      }
      await expect(call.send()).resolves.toBeDefined();
      await expect(contract.call.check(3n, alicePkh, expected).send()).resolves.toBeDefined();
    }
  }, 120_000);
});
