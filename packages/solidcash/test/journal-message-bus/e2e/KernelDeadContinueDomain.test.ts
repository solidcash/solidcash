import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

describe('kernel dead counter-continue domain proof', () => {
  it('settles the full canonical domain when a non-progressing continue is unreachable', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract DeadContinueDomain() {
      mapping(int => int) values;
      function write(int n) public {
        int i = 0;
        while (i < n) {
          if (i >= n) { continue; }
          this.values[i] = i + 11;
          i = i + 1;
        }
        require(true);
      }
      function check(int key, int expected) public { require(this.values[key] == expected); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'write', args: [3n] }]);
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `input ${inputIndex}`).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (let key = 0; key < 3; key += 1) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.check(
        BigInt(key), BigInt(key + 11),
      ).send()).resolves.toBeDefined();
    }
  }, 180_000);
});
