import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import {
  StatefulContract,
  readEventsFromChain,
} from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

const PRODUCER = `pragma solidity ^0.8.0;
contract PairSource {
  function read(uint seed) public pure returns (uint, uint) {
    return (seed + 11, seed + 29);
  }
}`;

const SINK = `pragma solidity ^0.8.0;
contract PairSink {
  uint public left;
  uint public right;
  event Accepted(uint left, uint right);

  function accept(uint nextLeft, uint nextRight) public {
    left = nextLeft;
    right = nextRight;
    emit Accepted(nextLeft, nextRight);
    require(true);
  }
}`;

const COORDINATOR = `pragma solidity ^0.8.0;
interface IPairSource { function read(uint seed) external returns (uint, uint); }
interface IPairSink { function accept(uint left, uint right) external; }

contract PairCoordinator(address source, address sink) {
  function apply(uint seed) public {
    (uint left, uint right) = IPairSource(source).read(seed);
    IPairSink(sink).accept(left, right);
    require(true);
  }
}`;

describe('multi-result graph observable parity', () => {
  it('forwards authenticated tuple lanes with kernel and legacy observable parity', async () => {
    const kernelCoordinator = compileString(COORDINATOR, {
      ...OPTIONS,
      messageBusKernel: true,
    });
    const kernelApply = kernelCoordinator.abi.find((entry) => entry.name === 'apply')!;
    expect(kernelCoordinator.messageBus?.convention).toBe('kernel-row-loop');
    expect(kernelCoordinator.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(kernelApply.externalCalls?.map((call) => ({
      callsiteId: call.callsiteId,
      functionName: call.functionName,
      returnTypes: call.returnTypes,
    }))).toEqual([
      { callsiteId: 0, functionName: 'read', returnTypes: ['uint256', 'uint256'] },
      { callsiteId: 1, functionName: 'accept', returnTypes: undefined },
    ]);
    expect(kernelApply.externalCalls?.[1].argSources).toEqual([
      { kind: 'expression', expression: {
        kind: 'producerResult', callsiteId: 0, sourceCallsiteId: 0, resultIndex: 0,
      } },
      { kind: 'expression', expression: {
        kind: 'producerResult', callsiteId: 0, sourceCallsiteId: 0, resultIndex: 1,
      } },
    ]);
    expect(kernelApply.resultConsumers).toEqual([
      {
        consumerCallsiteId: 1, argument: 0, producerCallsiteId: 0,
        producerSourceCallsiteId: 0, resultIndex: 0,
      },
      {
        consumerCallsiteId: 1, argument: 1, producerCallsiteId: 0,
        producerSourceCallsiteId: 0, resultIndex: 1,
      },
    ]);
    const graphHandler = kernelCoordinator.invocationAnalysis?.functions.find((fn) =>
      fn.name === '__message_bus_handler_apply');
    const route = kernelCoordinator.invocationAnalysis?.functions.find((fn) => fn.name === '__message_bus1');
    expect(graphHandler).toBeDefined();
    expect(route?.calls.filter((id) => id === graphHandler!.id)).toEqual([graphHandler!.id]);

    const observations = [];
    for (const messageBusKernel of [true, false]) {
      const provider = createMessageBusCapstoneTestProvider();
      const compileOptions = { ...OPTIONS, messageBusKernel };
      const producerArtifact = compileString(PRODUCER, compileOptions);
      const sinkArtifact = compileString(SINK, compileOptions);
      const producerBase = new Contract(producerArtifact, [], { provider });
      const producerSetup = await setupStatefulUtxos(
        provider, producerBase, producerArtifact.stateLayout!, {}, { saltContract: true },
      );
      const producer = StatefulContract.withCategory(
        producerBase.withCategory(hexToBin(producerSetup.categoryId)), producerSetup.categoryId,
      );
      const sinkBase = new Contract(sinkArtifact, [], { provider });
      const sinkSetup = await setupStatefulUtxos(
        provider, sinkBase, sinkArtifact.stateLayout!, { left: 0n, right: 0n }, { saltContract: true },
      );
      const sink = StatefulContract.withCategory(
        sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
      );
      const coordinatorArtifact = compileString(COORDINATOR, compileOptions);
      expect(coordinatorArtifact.messageBus?.convention)
        .toBe(messageBusKernel ? 'kernel-row-loop' : 'legacy-unroll');
      expect(coordinatorArtifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
        .toMatchObject({ eligible: true });
      const coordinatorBase = new Contract(
        coordinatorArtifact, [producer.inner.lockingBytecode, sink.inner.lockingBytecode], { provider },
      );
      const coordinatorSetup = await setupStatefulUtxos(
        provider, coordinatorBase, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
      );
      const coordinator = StatefulContract.withCategory(
        coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
        { externals: { IPairSource: producer, IPairSink: sink } },
      );
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      const result = hexToBin(ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256'], [16n, 34n],
      ).slice(2));
      const compose = (
        sinkArgs: readonly [bigint, bigint], commitment = result,
        sourceCallsiteId = 0, sinkCallsiteId = 1,
      ): ReturnType<typeof messageBus.compose> => messageBus.compose({
        preparedCalls: [
          { contract: coordinator, functionName: 'apply', args: [5n] },
          {
            contract: producer, functionName: 'read', args: [5n], callsiteId: sourceCallsiteId,
            provisionalResultCommitment: commitment,
          },
          { contract: sink, functionName: 'accept', args: sinkArgs, callsiteId: sinkCallsiteId },
        ],
        funder,
        changeAddress: funder.unlocker.generateLockingBytecode(),
      });

      await expect(compose([34n, 16n]).build()).rejects.toThrow();
      await expect(compose([16n, 34n], result, 1, 0).build()).rejects.toThrow();
      const call = compose([16n, 34n]);
      const builder = await call.build();
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const sourceRouteInput = builder.inputs.findIndex((input) => 'contract' in input.unlocker
        && input.unlocker.contract.artifact.contractName === 'PairSource'
        && input.unlocker.abiFunction.name === producerArtifact.messageBus!.route.name);
      const sourceReturnOutput = transaction.outputs.findIndex((output) => output.token?.nft?.capability === 'none'
        && binToHex(output.token.category) === producerSetup.categoryId);
      expect(sourceRouteInput).toBeGreaterThanOrEqual(0);
      expect(sourceReturnOutput).toBeGreaterThanOrEqual(0);
      const tampered = {
        ...transaction,
        outputs: transaction.outputs.map((output, index) => index !== sourceReturnOutput ? output : ({
          ...output,
          token: { ...output.token!, nft: { ...output.token!.nft!,
            commitment: Uint8Array.from(output.token!.nft!.commitment, (byte, offset) =>
              offset === output.token!.nft!.commitment.length - 1 ? byte ^ 1 : byte) } },
        })),
      };
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex: sourceRouteInput, sourceOutputs, transaction: tampered,
      }))).not.toBe(true);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `${coordinatorArtifact.messageBus?.convention} input ${inputIndex}`).toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
      const state = await sink.getState();
      const event = sinkArtifact.events!.find((candidate) => candidate.name === 'Accepted')!;
      const decoded = await readEventsFromChain(
        provider, sink.getEventNftAddress(event.signature), sinkSetup.categoryId, event, sinkArtifact.structs,
      );
      observations.push({
        state: { left: state.left, right: state.right },
        events: decoded.map(({ values }) => [values.left, values.right]),
      });
    }
    expect(observations).toEqual([
      { state: { left: 16n, right: 34n }, events: [[16n, 34n]] },
      { state: { left: 16n, right: 34n }, events: [[16n, 34n]] },
    ]);
  }, 180_000);
});
