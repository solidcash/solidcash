import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const SOURCE = `pragma solidcash ^0.13.0;
contract KernelSameIterSelection() {
  mapping(int => int) left;
  mapping(int => int) right;
  function choose(int n, bool pickRight) public {
    for (int i = 0; i < n; i = i + 1) {
      if (pickRight) {
        this.right[i] = i + 1;
      } else {
        this.left[i] = i + 1;
      }
    }
    require(true);
  }
  function checkLeft(int key, int expected) public { require(this.left[key] == expected); }
  function checkRight(int key, int expected) public { require(this.right[key] == expected); }
  function missingLeft(int key) public { require(this.left[key] == 0); }
  function missingRight(int key) public { require(this.right[key] == 0); }
}`;

describe('kernel same-iteration bool selection under composition', () => {
  it.each([false, true])('settles pickRight=%s for n>=2', async (pickRight) => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'choose'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'choose')?.sortedUpsertLoopInfo?.length)
      .toBeGreaterThanOrEqual(2);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.call.choose(2n, pickRight);
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `input ${inputIndex}`).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const updated = StatefulContract.withCategory(inner, categoryId);
    for (const key of [0n, 1n]) {
      if (pickRight) {
        await expect(updated.call.checkRight(key, key + 1n).send()).resolves.toBeDefined();
      } else {
        await expect(updated.call.checkLeft(key, key + 1n).send()).resolves.toBeDefined();
      }
    }
  }, 300_000);
});
