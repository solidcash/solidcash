import { hexToBin } from '@bitauth/libauth';
import { compileString, createMapResolver } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

/**
 * Caller groups a repeated external selector the callee kernel route refuses:
 * drop the group when the callee source is a known chunkable-write shape, or
 * compose/build fail closed when an interface-only caller still advertises the batch
 * against a refused handler.
 */

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

const SINK_CHUNKED = `
  contract Sink {
    mapping(int => int[]) events;
    function append(int id, int value) external {
      events[id].push(value);
      require(value >= 0);
    }
  }
`;

const SINK_SCALAR = `
  contract Sink {
    mapping(int => int) counts;
    function bump(int id, int delta) external {
      counts[id] = counts[id] + delta;
      require(id >= 0);
    }
  }
`;

const SINK_OPAQUE = `
  contract Sink {
    int total;
    function append(int id, int value) external {
      assembly { OP_DUP OP_DROP }
      total = total + value;
      require(value >= 0);
    }
  }
`;

const repeatedCaller = (callee: string, handler: string): ReturnType<typeof compileString> =>
  compileString(`
    import "./Sink.scash";
    contract BatchCaller(address sink) {
      function run(int first, int second) public {
        Sink(sink).${handler}(0, first);
        Sink(sink).${handler}(0, second);
        require(first >= 0);
        require(second >= 0);
      }
    }
  `, {
    ...KERNEL,
    rootFileId: '/BatchCaller.scash',
    importResolver: createMapResolver({ '/Sink.scash': callee }),
  });

describe('kernel refused / unknown selector batch slot', () => {
  it('drops a known-callee chunkable-write selector from the repeated batch group', () => {
    const callerArtifact = repeatedCaller(SINK_CHUNKED, 'append');
    const run = callerArtifact.abi.find((fn) => fn.name === 'run');
    expect(run?.externalCalls).toHaveLength(2);
    expect(run?.externalCalls?.every((call) => call.batchInvocations === undefined)).toBe(true);

    // Control: an admitted scalar write still collapses into one two-row batch.
    const admitted = repeatedCaller(SINK_SCALAR, 'bump');
    const admittedRun = admitted.abi.find((fn) => fn.name === 'run');
    expect(admittedRun?.externalCalls).toHaveLength(1);
    expect(admittedRun?.externalCalls?.[0].batchInvocations).toHaveLength(2);
  });

  it('fails closed at compose/build when an interface-only caller groups a refused selector', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const sinkArtifact = compileString(SINK_OPAQUE, KERNEL);
    expect(sinkArtifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_OPAQUE_EFFECT',
      });
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );

    // Interface-only: callee route eligibility is unknown at caller compile time, so the
    // repeated selector is still grouped into one physical batch slot.
    const callerArtifact = compileString(`
      interface ISink { function append(int id, int value) external; }
      contract BatchCaller(address sink) {
        function run(int first, int second) public {
          ISink(sink).append(0, first);
          ISink(sink).append(0, second);
          require(first >= 0);
          require(second >= 0);
        }
      }
    `, KERNEL);
    const externalCall = callerArtifact.abi.find((fn) => fn.name === 'run')!
      .externalCalls!.find((call) => call.functionName === 'append')!;
    expect(externalCall.batchInvocations).toHaveLength(2);

    const callerBase = new Contract(callerArtifact, [sink.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );

    const values = [3n, 5n];
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'run', args: values },
        ...values.map((value, batchLogicalIndex) => ({
          contract: sink,
          functionName: 'append',
          args: [0n, value],
          callsiteId: externalCall.callsiteId,
          batchLogicalIndex,
          batchOccurrenceIndex: 0,
        })),
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    await expect(composition.build()).rejects.toThrow(
      /Handler 'append' is not batch eligible: KERNEL_OPAQUE_EFFECT/,
    );
  }, 120_000);
});
