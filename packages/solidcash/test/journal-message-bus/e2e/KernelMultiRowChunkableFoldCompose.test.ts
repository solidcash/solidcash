import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('kernel multi-row chunkable fold compose', () => {
  it('admits and settles two selected pushes with leading+complete fold witnesses', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Journal() {
        mapping(int => int[]) events;
        function pushOne(int key, int value) public {
          this.events[key].push(value);
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.resourceFoldPlans).toEqual(
      expect.arrayContaining([expect.objectContaining({ collection: 'events', stepKind: 'push' })]),
    );
    expect(artifact.messageBus?.handlers?.find((h) => h.name === 'pushOne'))
      .toMatchObject({ eligible: true });
    // fold-plan authority publishes fold complete + layout witness ABI slots. Unlocker absolutes vs one
    // resolveTransactionLayout are asserted on the compose path in KernelComposeLayoutWitnesses
    // (this batch Journal has valueChunk/PredOut slots but no dyn band — do not dyn-gate here).
    expect(artifact.messageBus!.route.inputs.some((i) => i.name === '__internal__valueChunkOutputBase'))
      .toBe(true);
    expect(artifact.messageBus!.route.inputs.some((i) => /^__internal__vmapBatchPredOut_\d+$/.test(i.name)))
      .toBe(true);
    expect(artifact.messageBus!.route.inputs.some((i) => i.name.startsWith('__internal__completePushValue_')))
      .toBe(true);

    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const journal = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );

    await expect(journal.call.pushOne(1n, 1n).send()).resolves.toBeDefined();

    const call = journal.batch([
      { function: 'pushOne', args: [1n, 10n] },
      { function: 'pushOne', args: [1n, 20n] },
    ]);
    const builder = await call.build();

    const routeIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeIndex).toBeGreaterThanOrEqual(0);
    const unlocker = builder.inputs[routeIndex]!.unlocker;
    if (!('params' in unlocker) || !('abiFunction' in unlocker)) {
      throw new Error('route unlocker missing params');
    }

    const leadingIndex = unlocker.abiFunction.inputs.findIndex((input: { name: string }) =>
      input.name.startsWith('__internal__leadingPushValue_'));
    expect(leadingIndex).toBeGreaterThanOrEqual(0);
    const leading = unlocker.params[leadingIndex];
    expect(leading instanceof Uint8Array).toBe(true);
    expect((leading as Uint8Array).length).toBeGreaterThan(0);

    const completeIndex = unlocker.abiFunction.inputs.findIndex((input: { name: string }) =>
      input.name.startsWith('__internal__completePushValue_'));
    expect(completeIndex).toBeGreaterThanOrEqual(0);
    const complete = unlocker.params[completeIndex];
    expect(complete instanceof Uint8Array).toBe(true);
    expect((complete as Uint8Array).length).toBeGreaterThanOrEqual((leading as Uint8Array).length);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const result = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      expect(vm.stateSuccess(result)).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);
});
