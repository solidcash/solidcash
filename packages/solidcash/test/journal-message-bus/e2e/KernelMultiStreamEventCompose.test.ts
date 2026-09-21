import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import { encodeEventCommitment } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { keyToSlotMulti } from '../../../src/stateful/SortedList.js';
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
contract KernelMultiStreamEvent() {
  event Tick(int indexed i);
  mapping(int => int) left;
  mapping(int => int) right;
  function writeEmit(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      left[i] = i;
      right[i] = i + 10;
      emit Tick(i);
    }
    require(true);
  }
  function checkLeft(int key, int expected) public { require(left[key] == expected); }
  function checkRight(int key, int expected) public { require(right[key] == expected); }
}`;

describe('kernel unconditional emit beside two mutation streams', () => {
  it('admits and settles emit with two int maps on one loop', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    const abi = artifact.abi.find((entry) => entry.name === 'writeEmit')!;
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'writeEmit'))
      .toMatchObject({ eligible: true });
    expect(abi.sortedUpsertLoopInfo).toHaveLength(2);
    expect(abi.runtimeLoopEvents?.length).toBeGreaterThan(0);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.call.writeEmit(2n);
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
      await expect(updated.call.checkLeft(key, key).send()).resolves.toBeDefined();
      await expect(updated.call.checkRight(key, key + 10n).send()).resolves.toBeDefined();
    }

    const event = artifact.events!.find((candidate) => candidate.name === 'Tick')!;
    const expectedCommitments = [0n, 1n].map((value) =>
      binToHex(encodeEventCommitment(event.parameters, [value], artifact.structs)));
    const eventOutputs = transaction.outputs.filter((output) => output.token?.nft?.capability === 'none');
    expect(eventOutputs.map((output) => binToHex(output.token!.nft!.commitment as Uint8Array)))
      .toEqual(expect.arrayContaining(expectedCommitments));
    expect(binToHex(keyToSlotMulti([bigIntToVmNumber(0n)]))).toMatch(/^[0-9a-f]+$/);
  }, 300_000);
});
