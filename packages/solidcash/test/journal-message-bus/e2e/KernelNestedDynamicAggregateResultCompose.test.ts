import { binToHex, hexToBin } from '@bitauth/libauth';
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

const OPTIONS = {
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

describe('kernel nested dynamic aggregate result composition', () => {
  it('canonically encodes a mapping-backed struct with string[] and rejects result forgery', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sourceArtifact = compileString(`pragma solidity ^0.8.0;
      struct Record { string[] labels; }
      contract Source {
        mapping(uint256 => Record) records;
        function seed() public {
          string[] memory labels = new string[](1);
          labels[0] = "first";
          records[9] = Record(labels);
          require(true);
        }
        function read(uint256 id) public view returns (Record memory) { return records[id]; }
      }`, { ...OPTIONS, messageBusHandlers: ['read'] });
    expect(sourceArtifact.messageBus?.handlers.find((entry) => entry.name === 'read'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Record' }] });
    const sourceBase = new Contract(sourceArtifact, [], { provider });
    const sourceSetup = await setupStatefulUtxos(
      provider, sourceBase, sourceArtifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      sourceBase.withCategory(hexToBin(sourceSetup.categoryId)), sourceSetup.categoryId,
    );
    await source.call.seed().send();
    const standalone = await source.batch([{ function: 'read', args: [9n] }]).build();
    const standaloneTransaction = standalone.buildLibauthTransaction();
    const standaloneSources = generateLibauthSourceOutputs(standalone.inputs);
    const stockVm = createVirtualMachineBch2026ForProvider(undefined);
    expect(standaloneTransaction.inputs.every((_input, inputIndex) => stockVm.stateSuccess(stockVm.evaluate({
      inputIndex, sourceOutputs: standaloneSources, transaction: standaloneTransaction,
    })) === true)).toBe(true);

    const consumerArtifact = compileString(`pragma solidity ^0.8.0;
      struct Record { string[] labels; }
      interface Reader { function read(uint256 id) external returns (Record memory); }
      contract Consumer(address source) {
        function verify() public {
          Record memory record = Reader(source).read(9);
          require(record.labels.length == 1 && record.labels[0] == "first");
        }
      }`, { ...OPTIONS, messageBusHandlers: ['verify'] });
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
      ['tuple(string[])'], [[['first']]],
    ).slice(2));
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const compose = (provisionalResultCommitment: Uint8Array): ReturnType<typeof messageBus.compose> =>
      messageBus.compose({
        preparedCalls: [
          { contract: consumer, functionName: 'verify', args: [] },
          { contract: source, functionName: 'read', args: [9n], callsiteId, provisionalResultCommitment },
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
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: sourceRouteInput, sourceOutputs, transaction: tampered })))
      .not.toBe(true);

    const forged = Uint8Array.from(result);
    forged[forged.length - 1] ^= 1;
    await expect(compose(forged).build()).rejects.toThrow(
      /prepared return commitment|BCH-2026 preflight failed/,
    );
  }, 120_000);

  it('enforces the BCH-2026 ceiling on the cumulative nested-array result vector', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const chunk = 'a'.repeat(410);
    const repeatedChunk = Array.from({ length: 12 }, () => 'chunk').join(', ');
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { string[] labels; }
      contract Source {
        function read() public pure returns (Record memory) {
          string memory chunk = "${chunk}";
          string memory expanded = string.concat(${repeatedChunk});
          string[] memory labels = new string[](1);
          labels[0] = expanded;
          return Record(labels);
        }
      }`, OPTIONS);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    expect(provider.consensusLimits?.maximumStackItemBytes).toBeGreaterThan(10_000);
    const single = await source.batch([{ function: 'read', args: [] }]).build();
    expect(vmAccepts(single)).toBe(true);
    const doubled = await source.batch([
      { function: 'read', args: [] },
      { function: 'read', args: [] },
    ]).build();
    const transaction = doubled.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(doubled.inputs);
    const sourceRouteInput = doubled.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Source'
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: sourceRouteInput, sourceOutputs, transaction })))
      .not.toBe(true);
  }, 120_000);

  it('enforces the same cumulative ceiling for top-level dynamic results', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const chunk = 'b'.repeat(415);
    const repeatedChunk = Array.from({ length: 12 }, () => 'chunk').join(', ');
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Source {
        function read() public pure returns (string memory) {
          string memory chunk = "${chunk}";
          return string.concat(${repeatedChunk});
        }
      }`, OPTIONS);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    expect(provider.consensusLimits?.maximumStackItemBytes).toBeGreaterThan(10_000);
    const single = await source.batch([{ function: 'read', args: [] }]).build();
    expect(vmAccepts(single)).toBe(true);
    const doubled = await source.batch([
      { function: 'read', args: [] },
      { function: 'read', args: [] },
    ]).build();
    const transaction = doubled.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(doubled.inputs);
    const sourceRouteInput = doubled.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Source'
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: sourceRouteInput, sourceOutputs, transaction })))
      .not.toBe(true);
  }, 120_000);
});
