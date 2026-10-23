import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
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
  try {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
      vm.evaluate({ inputIndex, sourceOutputs, transaction }),
    ) === true);
  } catch {
    return false;
  }
};

const encodeUint = (value: bigint): Uint8Array => hexToBin(
  ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [value]).slice(2),
);

const READER = `pragma solidity ^0.8.0;
contract Reader {
  function read(uint id) public pure returns (uint) {
    return id + 11;
  }
}`;

const SINK = `pragma solidity ^0.8.0;
contract Sink {
  uint public left;
  uint public right;
  event Written(uint left, uint right);

  function write(uint nextLeft, uint nextRight) public {
    left = nextLeft;
    right = nextRight;
    emit Written(nextLeft, nextRight);
    require(true);
  }
}`;

const COORDINATOR = `pragma solidity ^0.8.0;
interface IReader { function read(uint id) external returns (uint value); }
interface ISink { function write(uint left, uint right) external; }

contract Coordinator(address left, address right, address sink) {
  uint touched;

  function apply(uint id) public {
    uint leftValue = IReader(left).read(id);
    uint rightValue = IReader(right).read(id + 1);
    ISink(sink).write(leftValue, rightValue);
    touched = leftValue + rightValue;
    require(true);
  }
}`;

describe('kernel multi-producer result composition', () => {
  it('binds two producer IDs into one sink and rejects swapped lanes', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const readerArtifact = compileString(READER, KERNEL);
    const leftBase = new Contract(readerArtifact, [], { provider });
    const leftSetup = await setupStatefulUtxos(
      provider, leftBase, readerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const leftReader = StatefulContract.withCategory(
      leftBase.withCategory(hexToBin(leftSetup.categoryId)), leftSetup.categoryId,
    );

    const rightBase = new Contract(readerArtifact, [], { provider });
    const rightSetup = await setupStatefulUtxos(
      provider, rightBase, readerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const rightReader = StatefulContract.withCategory(
      rightBase.withCategory(hexToBin(rightSetup.categoryId)), rightSetup.categoryId,
    );

    const sinkArtifact = compileString(SINK, KERNEL);
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, { left: 0n, right: 0n }, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );

    const coordinatorArtifact = compileString(COORDINATOR, KERNEL);
    expect(coordinatorArtifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(coordinatorArtifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });

    const applyAbi = coordinatorArtifact.abi.find((entry) => entry.name === 'apply')!;
    expect(applyAbi.externalCalls?.map((call) => ({
      callsiteId: call.callsiteId,
      functionName: call.functionName,
      returnTypes: call.returnTypes,
    }))).toEqual([
      { callsiteId: 0, functionName: 'read', returnTypes: ['uint256'] },
      { callsiteId: 1, functionName: 'read', returnTypes: ['uint256'] },
      { callsiteId: 2, functionName: 'write', returnTypes: undefined },
    ]);
    expect(applyAbi.externalCalls?.[2].argSources).toEqual([
      {
        kind: 'expression',
        expression: {
          kind: 'producerResult', callsiteId: 0, sourceCallsiteId: 0, resultIndex: 0, type: 'uint256',
        },
      },
      {
        kind: 'expression',
        expression: {
          kind: 'producerResult', callsiteId: 1, sourceCallsiteId: 1, resultIndex: 0, type: 'uint256',
        },
      },
    ]);
    expect(applyAbi.resultConsumers).toEqual([
      {
        consumerCallsiteId: 2, argument: 0,
        producerCallsiteId: 0, producerSourceCallsiteId: 0, resultIndex: 0,
      },
      {
        consumerCallsiteId: 2, argument: 1,
        producerCallsiteId: 1, producerSourceCallsiteId: 1, resultIndex: 0,
      },
    ]);

    const coordinatorBase = new Contract(
      coordinatorArtifact,
      [leftReader.inner.lockingBytecode, rightReader.inner.lockingBytecode, sink.inner.lockingBytecode],
      { provider },
    );
    const coordinatorSetup = await setupStatefulUtxos(
      provider, coordinatorBase, coordinatorArtifact.stateLayout!, { touched: 0n }, { saltContract: true },
    );
    const coordinator = StatefulContract.withCategory(
      coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
      { externals: { IReader: leftReader, ISink: sink } },
    );

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const leftValue = 16n;
    const rightValue = 17n;
    const leftCommitment = encodeUint(leftValue);
    const rightCommitment = encodeUint(rightValue);

    const compose = (
      sinkArgs: readonly [bigint, bigint],
      leftCallsiteId = 0,
      rightCallsiteId = 1,
      sinkCallsiteId = 2,
    ): ReturnType<typeof messageBus.compose> => messageBus.compose({
      preparedCalls: [
        { contract: coordinator, functionName: 'apply', args: [5n] },
        {
          contract: leftReader, functionName: 'read', args: [5n], callsiteId: leftCallsiteId,
          provisionalResultCommitment: leftCommitment,
        },
        {
          contract: rightReader, functionName: 'read', args: [6n], callsiteId: rightCallsiteId,
          provisionalResultCommitment: rightCommitment,
        },
        { contract: sink, functionName: 'write', args: sinkArgs, callsiteId: sinkCallsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    // Swapped sink lanes / producer callsites must fail closed before send.
    await expect(compose([rightValue, leftValue]).build()).rejects.toThrow();
    await expect(compose([leftValue, rightValue], 1, 0).build()).rejects.toThrow();

    const composition = compose([leftValue, rightValue]);
    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const state = await sink.getState();
    expect(state.left).toBe(leftValue);
    expect(state.right).toBe(rightValue);
    const coordinatorState = await coordinator.getState();
    expect(coordinatorState.touched).toBe(leftValue + rightValue);
  }, 180_000);
});
