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
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, evmCompat: true, suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel fixed-array literal graph-row composition', () => {
  it('does not retain literal elements while assembling a later void row', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sourceArtifact = compileString(`pragma solidity ^0.8.0;
      contract RowSource {
        function normalize(uint16[5] memory values) public pure returns (uint16[5] memory) {
          return values;
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const sourceBase = new Contract(sourceArtifact, [], { provider });
    const sourceSetup = await setupStatefulUtxos(
      provider, sourceBase, sourceArtifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      sourceBase.withCategory(hexToBin(sourceSetup.categoryId)), sourceSetup.categoryId,
    );

    const sinkArtifact = compileString(`pragma solidity ^0.8.0;
      contract RowSink {
        uint256 public accepted;
        function accept(uint16 value) public {
          require(value == 5);
          accepted = 1;
          require(true);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, { accepted: 0n }, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );

    const coordinatorArtifact = compileString(`pragma solidity ^0.8.0;
      interface IRowSource {
        function normalize(uint16[5] memory values) external returns (uint16[5] memory);
      }
      interface IRowSink { function accept(uint16 value) external; }
      contract RowCoordinator(address source, address sink) {
        function run() public returns (uint16[5] memory) {
          uint16[5] memory values = IRowSource(source).normalize(
            [uint16(1), uint16(2), uint16(3), uint16(4), uint16(5)]
          );
          IRowSink(sink).accept(values[4]);
          require(values[4] == 5);
          return values;
        }
      }`, KERNEL);
    expect(coordinatorArtifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(coordinatorArtifact.bytecode.replace(/\s+/gu, '')).toContain('OP_INVOKE');
    const coordinatorBase = new Contract(
      coordinatorArtifact, [source.inner.lockingBytecode, sink.inner.lockingBytecode], { provider },
    );
    const coordinatorSetup = await setupStatefulUtxos(
      provider, coordinatorBase, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
    );
    const coordinator = StatefulContract.withCategory(
      coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
    );

    const calls = coordinatorArtifact.abi.find((entry) => entry.name === 'run')!.externalCalls!;
    expect(calls.map((call) => call.functionName)).toEqual(['normalize', 'accept']);
    const arrayResult = hexToBin(ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint16[5]'], [[1n, 2n, 3n, 4n, 5n]],
    ).slice(2));
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        {
          contract: coordinator, functionName: 'run', args: [],
          provisionalResultCommitment: arrayResult,
        },
        {
          contract: source, functionName: 'normalize', args: [[1n, 2n, 3n, 4n, 5n]],
          callsiteId: calls[0].callsiteId!, provisionalResultCommitment: arrayResult,
        },
        {
          contract: sink, functionName: 'accept', args: [5n],
          callsiteId: calls[1].callsiteId!,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    expect(vmAccepts(await composition.build())).toBe(true);
  }, 180_000);
});
