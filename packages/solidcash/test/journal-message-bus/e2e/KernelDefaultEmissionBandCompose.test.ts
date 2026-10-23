import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
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

describe('kernel default emission-band addressing', () => {
  it('keeps a non-prefix stream aligned across deep fixed-array frames before a void row', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const firstArtifact = compileString(`pragma solidity ^0.8.0;
      contract BandSourceOne {
        function derive(uint16 value) public pure returns (uint16) { return value + 2; }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const firstBase = new Contract(firstArtifact, [], { provider });
    const firstSetup = await setupStatefulUtxos(
      provider, firstBase, firstArtifact.stateLayout!, {}, { saltContract: true },
    );
    const first = StatefulContract.withCategory(
      firstBase.withCategory(hexToBin(firstSetup.categoryId)), firstSetup.categoryId,
    );

    const secondArtifact = compileString(`pragma solidity ^0.8.0;
      contract BandSourceTwo {
        function derive(uint16 value) public pure returns (uint16) { return value * 2; }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const secondBase = new Contract(secondArtifact, [], { provider });
    const secondSetup = await setupStatefulUtxos(
      provider, secondBase, secondArtifact.stateLayout!, {}, { saltContract: true },
    );
    const second = StatefulContract.withCategory(
      secondBase.withCategory(hexToBin(secondSetup.categoryId)), secondSetup.categoryId,
    );

    const thirdArtifact = compileString(`pragma solidity ^0.8.0;
      contract BandSourceThree {
        function derive(uint16 value) public pure returns (uint16) { return value + 7; }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const thirdBase = new Contract(thirdArtifact, [], { provider });
    const thirdSetup = await setupStatefulUtxos(
      provider, thirdBase, thirdArtifact.stateLayout!, {}, { saltContract: true },
    );
    const third = StatefulContract.withCategory(
      thirdBase.withCategory(hexToBin(thirdSetup.categoryId)), thirdSetup.categoryId,
    );

    const sinkArtifact = compileString(`pragma solidity ^0.8.0;
      contract BandVoidSink {
        uint16 public total;

        function record(
          uint16 first, uint16 second, uint16 third, uint16[6] memory lanes
        ) public {
          total = lanes[3] + lanes[4] + lanes[5];
          require(first == 13 && second == 62 && third == 12 && total == 174);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );

    const coordinatorArtifact = compileString(`pragma solidity ^0.8.0;
      interface IBandSourceOne { function derive(uint16 value) external view returns (uint16); }
      interface IBandSourceTwo { function derive(uint16 value) external view returns (uint16); }
      interface IBandSourceThree { function derive(uint16 value) external view returns (uint16); }
      interface IBandVoidSink {
        function record(
          uint16 first, uint16 second, uint16 third, uint16[6] memory lanes
        ) external;
      }

      contract BandCoordinator(address one, address two, address three, address sink) {
        function run(uint16 seed) public {
          uint16 ignored = seed;
          if (seed == 0) {
            ignored = IBandSourceOne(one).derive(seed);
          }
          uint16[6] memory firstLanes = [seed, seed + 1, seed + 2, seed + 3, seed + 4, seed + 5];
          uint16 first = IBandSourceOne(one).derive(firstLanes[0] + firstLanes[5]);

          uint16[6] memory secondLanes = [first, first + 1, first + 2, first + 3, first + 4, first + 5];
          uint16 second = IBandSourceTwo(two).derive(secondLanes[1] + secondLanes[4]);

          uint16[6] memory thirdLanes = [
            second, second - 1, second - 2, second - 3, second - 4, second - 5
          ];
          uint16 third = IBandSourceThree(three).derive(thirdLanes[0] - thirdLanes[5]);

          uint16[6] memory finalLanes = [
            first, second, third, first + second, second + third, first + third
          ];
          IBandVoidSink(sink).record(first, second, third, finalLanes);
          require(ignored == seed && finalLanes[3] == 75 && finalLanes[4] == 74 && finalLanes[5] == 25);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    expect(coordinatorArtifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(coordinatorArtifact.bytecode.replace(/\s+/gu, '')).toContain('OP_INVOKE');
    const runAbi = coordinatorArtifact.abi.find((entry) => entry.name === 'run')!;
    expect(runAbi.externalCalls?.map((call) => ({
      name: call.functionName,
      returns: call.returnTypes,
    }))).toEqual([
      { name: 'derive', returns: ['uint16'] },
      { name: 'derive', returns: ['uint16'] },
      { name: 'derive', returns: ['uint16'] },
      { name: 'derive', returns: ['uint16'] },
      { name: 'record', returns: undefined },
    ]);
    const coordinatorBase = new Contract(coordinatorArtifact, [
      first.inner.lockingBytecode,
      second.inner.lockingBytecode,
      third.inner.lockingBytecode,
      sink.inner.lockingBytecode,
    ], { provider });
    const coordinatorSetup = await setupStatefulUtxos(
      provider, coordinatorBase, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
    );
    const coordinator = StatefulContract.withCategory(
      coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
    );
    coordinator._registerResolvedExternal('IBandSourceOne', first);
    coordinator._registerResolvedExternal('IBandSourceTwo', second);
    coordinator._registerResolvedExternal('IBandSourceThree', third);
    coordinator._registerResolvedExternal('IBandVoidSink', sink);

    const relayArtifact = compileString(`pragma solidity ^0.8.0;
      interface IBandCoordinator { function run(uint16 seed) external; }
      contract BandRelay(address coordinator) {
        function relay(uint16 seed) public {
          IBandCoordinator(coordinator).run(seed);
          require(true);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const relayBase = new Contract(
      relayArtifact, [coordinator.inner.lockingBytecode], { provider },
    );
    const relaySetup = await setupStatefulUtxos(
      provider, relayBase, relayArtifact.stateLayout!, {}, { saltContract: true },
    );
    const relay = StatefulContract.withCategory(
      relayBase.withCategory(hexToBin(relaySetup.categoryId)), relaySetup.categoryId,
    );
    relay._registerResolvedExternal('IBandCoordinator', coordinator);

    const rootArtifact = compileString(`pragma solidity ^0.8.0;
      contract BandRoot(address implementation) {
        function execute(bytes rawPayload) public {
          implementation.delegatecall(rawPayload);
          require(true);
        }
      }`, KERNEL);
    expect(rootArtifact.messageBus?.convention).toBe('kernel-row-loop');
    // The root is a foreign-delegate proxy: its own body is the pre-auth covenant and no helper reaches the
    // two-use floor, so there is no OP_INVOKE to look for. The published delegate forwarding is what states
    // that this route executes the implementation it was given as constructor argument 0.
    expect(rootArtifact.abi.find((entry) => entry.name === 'execute')?.delegateForwarding)
      .toMatchObject({ targetBinding: { kind: 'constructorArg', input: 0, name: 'implementation' } });
    const rootBase = new Contract(rootArtifact, [relay.inner.lockingBytecode], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );

    const payload = hexToBin(relayArtifact.abi.find((entry) => entry.name === 'relay')!.selector!);
    const builder = await root.call.execute(payload).withCall(relay, 'relay', [3n]).build();
    const participants = builder.inputs.flatMap((input) => (
      'contract' in input.unlocker ? [input.unlocker.contract.artifact.contractName] : []
    ));
    for (const name of [
      'BandRelay',
      'BandCoordinator',
      'BandSourceOne',
      'BandSourceTwo',
      'BandSourceThree',
      'BandVoidSink',
    ]) {
      expect(participants.filter((participant) => participant === name), name).toHaveLength(1);
    }
    expect(vmAccepts(builder)).toBe(true);
  }, 180_000);
});
