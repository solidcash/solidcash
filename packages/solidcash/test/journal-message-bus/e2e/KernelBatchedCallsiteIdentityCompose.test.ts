import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel batched callsite identity under composition', () => {
  it('preserves physical/source/logical/occurrence through plan and settles two collapsed rows', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const sinkArtifact = compileString(`pragma solidity ^0.8.0;
      contract BatchedIdentitySink {
        function ping(int value) public { require(value >= 0); }
      }`, { ...KERNEL, messageBusGraphContext: true });
    expect(sinkArtifact.messageBus?.convention).toBe('kernel-row-loop');

    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sinkInner = sinkBase.withCategory(hexToBin(sinkSetup.categoryId));
    const sink = StatefulContract.withCategory(sinkInner, sinkSetup.categoryId);

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IBatchedIdentitySink { function ping(int value) external; }
      contract BatchedIdentityRoot(address sink) {
        function fire(int first, int second) public {
          IBatchedIdentitySink(sink).ping(first);
          IBatchedIdentitySink(sink).ping(second);
          require(first >= 0);
          require(second >= 0);
        }
      }`, KERNEL);
    expect(callerArtifact.messageBus?.convention).toBe('kernel-row-loop');
    const fire = callerArtifact.abi.find((entry) => entry.name === 'fire')!;
    const batch = fire.externalCalls![0];
    expect(batch.callsiteId).toBe(0);
    expect(batch.batchInvocations).toEqual([
      expect.objectContaining({ sourceCallsiteId: 0, logicalIndex: 0 }),
      expect.objectContaining({ sourceCallsiteId: 1, logicalIndex: 1 }),
    ]);
    expect(batch.batchInvocations![1].sourceCallsiteId).not.toBe(batch.callsiteId);

    const planned = messageBus.deriveCompiledGraphPlan({
      root: { artifact: callerArtifact, lockingBytecode: '51' },
      function: 'fire',
      args: [7n, 9n],
      targets: {},
      target: () => ({ artifact: sinkArtifact, lockingBytecode: '52' }),
    });
    expect(planned.invocations.slice(1).map((invocation) => ({
      physical: invocation.consumerCallsiteId,
      source: invocation.sourceCallsiteId,
      logical: invocation.sourceLogicalIndex,
      occurrence: invocation.occurrenceIndex,
      provenance: invocation.sourceCallsiteProvenance,
    }))).toEqual([
      {
        physical: 0, source: 0, logical: 0, occurrence: 0, provenance: 'compiler',
      },
      {
        physical: 0, source: 1, logical: 1, occurrence: 0, provenance: 'compiler',
      },
    ]);

    const callerBase = new Contract(callerArtifact, [sinkInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      calls: [caller.call.fire(7n, 9n), sink.call.ping(7n), sink.call.ping(9n)],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 180_000);
});
