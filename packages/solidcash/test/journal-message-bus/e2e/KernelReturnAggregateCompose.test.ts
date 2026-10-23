import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
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

describe('kernel aggregate return composition', () => {
  it('authenticates and consumes mixed nested ABI return components in the BCH VM', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sourceArtifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; }
      struct Envelope { Record record; bytes payload; }
      contract Source {
        function read() public pure returns (Record memory, uint16[2] memory, bytes memory, Envelope memory) {
          uint16[2] memory marks = [uint16(4), uint16(6)];
          return (Record(9, Detail(70, 1)), marks, hex"cafe",
            Envelope(Record(12, Detail(80, 0)), hex"abcd"));
        }
      }`, OPTIONS);
    expect(sourceArtifact.messageBus?.handlers.find((entry) => entry.name === 'read'))
      .toMatchObject({ eligible: true });
    const sourceBase = new Contract(sourceArtifact, [], { provider });
    const sourceSetup = await setupStatefulUtxos(
      provider, sourceBase, sourceArtifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      sourceBase.withCategory(hexToBin(sourceSetup.categoryId)), sourceSetup.categoryId,
    );

    const consumerArtifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; }
      struct Envelope { Record record; bytes payload; }
      interface Reader {
        function read() external returns (Record memory, uint16[2] memory, bytes memory, Envelope memory);
      }
      contract Consumer(address source) {
        function verify() public {
          (Record memory record, uint16[2] memory marks, bytes memory payload, Envelope memory envelope) =
            Reader(source).read();
          require(record.value == 9 && record.detail.code == 70 && record.detail.status == 1
            && marks[0] == 4 && marks[1] == 6 && payload == hex"cafe"
            && envelope.record.value == 12 && envelope.record.detail.code == 80
            && envelope.record.detail.status == 0 && envelope.payload == hex"abcd");
        }
      }`, OPTIONS);
    expect(consumerArtifact.messageBus?.handlers.find((entry) => entry.name === 'verify'))
      .toMatchObject({ eligible: true });
    const consumerBase = new Contract(consumerArtifact, [source.inner.lockingBytecode], { provider });
    const consumerSetup = await setupStatefulUtxos(
      provider, consumerBase, consumerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const consumer = StatefulContract.withCategory(
      consumerBase.withCategory(hexToBin(consumerSetup.categoryId)), consumerSetup.categoryId,
    );

    const callsiteId = consumerArtifact.abi.find((entry) => entry.name === 'verify')!
      .externalCalls!.find((call) => call.functionName === 'read')!.callsiteId!;
    const result = hexToBin(ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256,tuple(uint16,uint8))', 'uint16[2]', 'bytes',
        'tuple(tuple(uint256,tuple(uint16,uint8)),bytes)'],
      [[9n, [70n, 1n]], [4n, 6n], '0xcafe', [[12n, [80n, 0n]], '0xabcd']],
    ).slice(2));
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: consumer, functionName: 'verify', args: [] },
        {
          contract: source,
          functionName: 'read',
          args: [],
          callsiteId,
          provisionalResultCommitment: result,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const built = await composition.build();
    expect(vmAccepts(built)).toBe(true);

    const malformed = Uint8Array.from(result);
    malformed[(5 * 32) + 31] = 0xff;
    const malformedComposition = messageBus.compose({
      preparedCalls: [
        { contract: consumer, functionName: 'verify', args: [] },
        {
          contract: source,
          functionName: 'read',
          args: [],
          callsiteId,
          provisionalResultCommitment: malformed,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    await expect(malformedComposition.build()).rejects.toThrow(/prepared return commitment/);
  }, 120_000);
});
