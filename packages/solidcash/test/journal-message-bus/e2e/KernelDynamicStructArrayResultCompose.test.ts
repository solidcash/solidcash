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

describe('kernel dynamic arrays of struct result composition', () => {
  it('materializes a state-backed struct array from authenticated ordered chunks', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { uint256 id; string note; }
      contract Source {
        Record[] records;
        function seed(string memory first, string memory second) public {
          records.push(Record(7, first));
          records.push(Record(9, second));
          require(true);
        }
        function read() public view returns (Record[] memory) { return records; }
      }`, { ...OPTIONS, messageBusHandlers: ['read'] });
    expect(artifact.messageBus?.handlers.find((entry) => entry.name === 'read'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Record[]' }] });
    expect(artifact.abi.find((entry) => entry.name === 'read')?.dynamicReads).toEqual(['records']);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    await source.call.seed('a'.repeat(700), 'b'.repeat(700)).send();

    const built = await source.batch([{ function: 'read', args: [] }]).build();
    expect(vmAccepts(built)).toBe(true);
    const transaction = built.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.inputs);
    const routeInput = built.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const trailingBase = artifact.messageBus!.route.blockLayout!.trailingBase!;
    const firstChunk = routeInput + trailingBase;
    expect(routeInput).toBeGreaterThanOrEqual(0);
    expect(transaction.inputs.length).toBeGreaterThan(firstChunk + 1);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const rejected = (
      candidateTransaction: typeof transaction, candidateSources: typeof sourceOutputs,
    ): boolean => vm.stateSuccess(vm.evaluate({
      inputIndex: routeInput, sourceOutputs: candidateSources, transaction: candidateTransaction,
    })) !== true;

    const forgedSources = sourceOutputs.map((output) => ({
      ...output,
      lockingBytecode: output.lockingBytecode.slice(),
      token: output.token === undefined ? undefined : {
        ...output.token,
        category: output.token.category.slice(),
        nft: output.token.nft === undefined ? undefined : {
          ...output.token.nft, commitment: output.token.nft.commitment.slice(),
        },
      },
    }));
    forgedSources[firstChunk].token!.nft!.commitment[0] ^= 1;
    expect(rejected(transaction, forgedSources)).toBe(true);

    const reorderedSources = sourceOutputs.slice();
    [reorderedSources[firstChunk], reorderedSources[firstChunk + 1]] =
      [reorderedSources[firstChunk + 1], reorderedSources[firstChunk]];
    expect(rejected(transaction, reorderedSources)).toBe(true);

    const missingTransaction = {
      ...transaction,
      inputs: transaction.inputs.filter((_input, index) => index !== firstChunk),
    };
    const missingSources = sourceOutputs.filter((_output, index) => index !== firstChunk);
    expect(rejected(missingTransaction, missingSources)).toBe(true);

    // Every row reuses the same authenticated state chunks, but its canonical ABI result is appended separately.
    // The kernel's limit is cumulative over that complete result vector rather than per state read.
    const belowLimit = await source.batch(Array.from({ length: 5 }, () => ({
      function: 'read', args: [],
    }))).build();
    expect(vmAccepts(belowLimit)).toBe(true);
    const excessive = await source.batch(Array.from({ length: 6 }, () => ({
      function: 'read', args: [],
    }))).build();
    expect(vmAccepts(excessive)).toBe(false);
  }, 120_000);

  it('canonically encodes nested dynamic leaves and rejects result tampering', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sourceArtifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { string label; }
      struct Record { uint256 id; Detail detail; bytes payload; }
      contract Source {
        function read() public pure returns (Record[] memory) {
          Record[] memory records = new Record[](2);
          records[0] = Record(7, Detail("first"), hex"aabbccdd");
          records[1] = Record(9, Detail("second"), hex"010203");
          return records;
        }
      }`, OPTIONS);
    expect(sourceArtifact.messageBus?.handlers.find((entry) => entry.name === 'read'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Record[]' }] });
    const sourceBase = new Contract(sourceArtifact, [], { provider });
    const sourceSetup = await setupStatefulUtxos(
      provider, sourceBase, sourceArtifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      sourceBase.withCategory(hexToBin(sourceSetup.categoryId)), sourceSetup.categoryId,
    );

    const standalone = await source.batch([{ function: 'read', args: [] }]).build();
    const standaloneTransaction = standalone.buildLibauthTransaction();
    const standaloneSources = generateLibauthSourceOutputs(standalone.inputs);
    const stockVm = createVirtualMachineBch2026ForProvider(undefined);
    expect(standaloneTransaction.inputs.every((_input, inputIndex) => stockVm.stateSuccess(stockVm.evaluate({
      inputIndex, sourceOutputs: standaloneSources, transaction: standaloneTransaction,
    })) === true)).toBe(true);

    const consumerArtifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { string label; }
      struct Record { uint256 id; Detail detail; bytes payload; }
      interface Reader { function read() external returns (Record[] memory); }
      contract Consumer(address source) {
        function verify() public {
          Record[] memory records = Reader(source).read();
          require(records.length == 2
            && records[0].id == 7 && records[0].detail.label == "first"
            && records[0].payload == hex"aabbccdd"
            && records[1].id == 9 && records[1].detail.label == "second"
            && records[1].payload == hex"010203");
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
      ['tuple(uint256,tuple(string),bytes)[]'],
      [[
        [7n, ['first'], '0xaabbccdd'],
        [9n, ['second'], '0x010203'],
      ]],
    ).slice(2));
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const compose = (provisionalResultCommitment: Uint8Array): ReturnType<typeof messageBus.compose> =>
      messageBus.compose({
        preparedCalls: [
          { contract: consumer, functionName: 'verify', args: [] },
          { contract: source, functionName: 'read', args: [], callsiteId, provisionalResultCommitment },
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

  it('enforces the BCH-2026 ceiling on the cumulative dynamic struct-array result vector', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const chunk = 'ab'.repeat(410);
    const repeatedChunk = Array.from({ length: 12 }, () => 'chunk').join(', ');
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { bytes payload; }
      contract Source {
        function read() public pure returns (Record[] memory) {
          bytes memory chunk = hex"${chunk}";
          bytes memory expanded = bytes.concat(${repeatedChunk});
          Record[] memory records = new Record[](1);
          records[0] = Record(expanded);
          return records;
        }
      }`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((entry) => entry.name === 'read'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Record[]' }] });
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
    expect(sourceRouteInput).toBeGreaterThanOrEqual(0);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: sourceRouteInput, sourceOutputs, transaction })))
      .not.toBe(true);
  }, 120_000);
});
