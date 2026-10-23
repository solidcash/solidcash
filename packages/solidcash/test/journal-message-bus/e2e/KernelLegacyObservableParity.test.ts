import { binToHex } from '@bitauth/libauth';
import { encodeEventCommitment } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import {
  StatefulContract,
  readEventsFromChain,
} from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SOURCE = `pragma solidcash ^0.14.0;
contract ObservableEffects() {
  int total;
  event Applied(int indexed key, int observedTotal, bool increased);

  function apply(int key, int amount, bool increase, int observedTotal) public {
    emit Applied(key, observedTotal, increase);
    require(true);
  }

}`;

const MIXED_RUNTIME_SOURCE = `pragma solidcash ^0.14.0;
contract MixedRuntimeEffects() {
  int total;
  mapping(int => int) values;
  event Applied(int indexed key, int observedTotal, bool increased);

  function apply(int key, int amount, bool increase, int observedTotal) public {
    if (increase) { this.total = this.total + amount; }
    else { this.total = this.total - amount; }
    this.values[key] = this.values[key] + this.total;
    emit Applied(key, observedTotal, increase);
    require(true);
  }

}`;

const STATE_SOURCE = `pragma solidcash ^0.14.0;
contract ObservableState() {
  int total;
  mapping(int => int) values;

  function apply(int key, int amount, bool increase, int ignored) public {
    if (increase) { this.total = this.total + amount; }
    else { this.total = this.total - amount; }
    this.values[key] = this.values[key] + this.total;
    require(ignored >= 0);
  }

  function check(int key, int expectedValue, int expectedTotal) public {
    require(this.values[key] == expectedValue && this.total == expectedTotal);
  }
}`;

const BASE_OPTIONS = {
  forceStateful: true,
  messageBus: true,
  maximumInputBytes: 1_000_000,
} as const;

const ROWS = [
  { function: 'apply', args: [4n, 3n, true, 8n] },
  { function: 'apply', args: [4n, 1n, false, 7n] },
  { function: 'apply', args: [4n, 2n, true, 9n] },
] as const;

describe('kernel and legacy observable parity', () => {
  it('preserves payload event effects across fresh route compiles', async () => {
    const artifacts = [
      compileString(SOURCE, { ...BASE_OPTIONS, messageBusKernel: true }),
      compileString(SOURCE, { ...BASE_OPTIONS, messageBusKernel: false }),
    ];
    expect(artifacts.map((artifact) => artifact.messageBus?.convention))
      .toEqual(['kernel-row-loop', 'legacy-unroll']);
    for (const artifact of artifacts) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply')?.eligible)
        .toBe(true);
    }

    const observations = [];
    for (const artifact of artifacts) {
      const provider = createTestProvider();
      const inner = new Contract(artifact, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, inner, artifact.stateLayout!, { total: 5n }, { saltContract: true },
      );
      const contract = StatefulContract.withCategory(inner, categoryId);
      const call = contract.batch([...ROWS]);
      const builder = await call.build();
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const vm = createVirtualMachineBch2026ForProvider(provider);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
          .toBe(true);
      }

      const event = artifact.events!.find((candidate) => candidate.name === 'Applied')!;
      const eventAddress = contract.getEventNftAddress(event.signature);
      const eventLockingBytecode = binToHex(addressToLockScript(eventAddress));
      const eventCommitments = transaction.outputs
        .filter((output) => binToHex(output.lockingBytecode) === eventLockingBytecode)
        .map((output) => binToHex(output.token!.nft!.commitment));
      const expectedEventValues: [bigint, bigint, boolean][] = [
        [4n, 8n, true],
        [4n, 7n, false],
        [4n, 9n, true],
      ];
      const expectedEventCommitments = expectedEventValues.map((values) =>
        binToHex(encodeEventCommitment(event.parameters, values, artifact.structs)));

      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
      const decodedEvents = await readEventsFromChain(
        provider, eventAddress, categoryId, event, artifact.structs,
      );
      expect(decodedEvents.map(({ values }) => [values.key, values.observedTotal, values.increased]))
        .toEqual(expectedEventValues);
      expect(eventCommitments).toEqual(expectedEventCommitments);
      observations.push({
        events: decodedEvents.map(({ values }) => [values.key, values.observedTotal, values.increased]),
      });
    }

    expect(observations[0]).toEqual(observations[1]);
  }, 180_000);

  it('preserves scalar, repeated-key mapping, and branch effects across fresh route compiles', async () => {
    const artifacts = [
      compileString(STATE_SOURCE, { ...BASE_OPTIONS, messageBusKernel: true }),
      compileString(STATE_SOURCE, { ...BASE_OPTIONS, messageBusKernel: false }),
    ];
    expect(artifacts.map((artifact) => artifact.messageBus?.convention))
      .toEqual(['kernel-row-loop', 'legacy-unroll']);

    const totals = [];
    for (const artifact of artifacts) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply')?.eligible)
        .toBe(true);
      const provider = createTestProvider();
      const inner = new Contract(artifact, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, inner, artifact.stateLayout!, { total: 5n }, { saltContract: true },
      );
      const contract = StatefulContract.withCategory(inner, categoryId);
      const call = contract.batch([...ROWS]);
      const builder = await call.build();
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const vm = createVirtualMachineBch2026ForProvider(provider);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `${artifact.messageBus?.convention} input ${inputIndex}`)
          .toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
      const state = await contract.getState();
      totals.push(state.total);
      await expect(contract.call.check(4n, 24n, 9n).send()).resolves.toBeDefined();
    }

    expect(totals).toEqual([9n, 9n]);
  }, 180_000);

  // aefb5499f admits this shape in kernel mode: the conditional writes a scalar only, and no arm settles a
  // collection or emits, so the unconditional chunkable replacement below it is not a mixed settlement.
  it('freezes mixed scalar, runtime collection, and row-effect geometry in kernel mode', () => {
    const kernel = compileString(MIXED_RUNTIME_SOURCE, { ...BASE_OPTIONS, messageBusKernel: true });
    const legacy = compileString(MIXED_RUNTIME_SOURCE, { ...BASE_OPTIONS, messageBusKernel: false });
    expect(kernel.messageBus?.handlers.find((handler) => handler.name === 'apply')).toMatchObject({
      eligible: true,
    });
    expect(legacy.messageBus?.handlers.find((handler) => handler.name === 'apply')).toMatchObject({
      eligible: true,
    });
  });
});
