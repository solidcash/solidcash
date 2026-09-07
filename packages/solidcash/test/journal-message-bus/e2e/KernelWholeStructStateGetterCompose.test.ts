import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  solidityImportCompat: true,
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

describe('kernel whole-struct state getter composition', () => {
  it('authenticates the exact fixed-layout state value and rejects a forged result', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sourceArtifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; bytes4 tag; uint16[2] marks; }
      contract Source {
        Record record;
        function read() public view returns (Record memory) { return this.record; }
      }`, OPTIONS);
    expect(sourceArtifact.messageBus?.handlers.find((entry) => entry.name === 'read'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Record' }] });

    const sourceBase = new Contract(sourceArtifact, [], { provider });
    const sourceSetup = await setupStatefulUtxos(provider, sourceBase, sourceArtifact.stateLayout!, {
      record: {
        value: 9n,
        detail: { code: 70n, status: 1n },
        tag: hexToBin('aabbccdd'),
        marks: [4n, 6n],
      },
    }, { saltContract: true });
    const source = StatefulContract.withCategory(
      sourceBase.withCategory(hexToBin(sourceSetup.categoryId)), sourceSetup.categoryId,
    );

    const consumerArtifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; bytes4 tag; uint16[2] marks; }
      interface Reader { function read() external returns (Record memory); }
      contract Consumer(address source) {
        function verify() public {
          Record memory record = Reader(source).read();
          require(record.value == 9 && record.detail.code == 70
            && record.detail.status == 1 && record.tag == hex"aabbccdd"
            && record.marks[0] == 4 && record.marks[1] == 6);
        }
      }`, OPTIONS);
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
      ['tuple(uint256,tuple(uint16,uint8),bytes4,uint16[2])'],
      [[9n, [70n, 1n], '0xaabbccdd', [4n, 6n]]],
    ).slice(2));
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const compose = (provisionalResultCommitment: Uint8Array): ReturnType<typeof messageBus.compose> =>
      messageBus.compose({
        preparedCalls: [
          { contract: consumer, functionName: 'verify', args: [] },
          {
            contract: source,
            functionName: 'read',
            args: [],
            callsiteId,
            provisionalResultCommitment,
          },
        ],
        funder,
        changeAddress: funder.unlocker.generateLockingBytecode(),
      });

    const built = await compose(result).build();
    expect(vmAccepts(built)).toBe(true);

    const transaction = built.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.inputs);
    const sourceRouteInput = built.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Source'
      && input.unlocker.abiFunction.name === sourceArtifact.messageBus!.route.name);
    const sourceReturnOutput = transaction.outputs.findIndex((output) => output.token?.nft?.capability === 'none'
      && binToHex(output.token.category) === sourceSetup.categoryId);
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
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: sourceRouteInput,
      sourceOutputs,
      transaction: tampered,
    }))).not.toBe(true);

    const forged = Uint8Array.from(result);
    forged[forged.length - 1] ^= 0x01;
    await expect(compose(forged).build()).rejects.toThrow(
      /prepared return commitment|BCH-2026 preflight failed/,
    );
  }, 120_000);
});
