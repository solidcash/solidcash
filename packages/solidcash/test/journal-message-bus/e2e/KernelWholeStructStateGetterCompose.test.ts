import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { getDynamicChunkAddress } from '../../../src/stateful/covenant-helpers.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
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

  it('reads a whole flattened dynamic struct after an earlier row mutates its sibling leaves', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sourceArtifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { string note; uint256[] marks; }
      struct Record { uint256 value; Detail detail; }
      contract Source {
        Record record;
        function mutate(uint256 field, uint256 value, string memory note, uint256 mark) public {
          if (field == 0) record.value = value;
          else if (field == 1) record.detail.note = note;
          else record.detail.marks.push(mark);
          require(true);
        }
        function read() public view returns (Record memory) { return record; }
      }`, OPTIONS);
    for (const name of ['mutate', 'read']) {
      expect(sourceArtifact.messageBus?.handlers.find((entry) => entry.name === name))
        .toMatchObject({ eligible: true });
    }
    const sourceBase = new Contract(sourceArtifact, [], { provider });
    const sourceSetup = await setupStatefulUtxos(provider, sourceBase, sourceArtifact.stateLayout!, {
      record__value: 1n,
      record__detail__note: '',
      record__detail__marks: [],
    }, { saltContract: true });
    const source = StatefulContract.withCategory(
      sourceBase.withCategory(hexToBin(sourceSetup.categoryId)), sourceSetup.categoryId,
    );

    const consumerArtifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { string note; uint256[] marks; }
      struct Record { uint256 value; Detail detail; }
      interface Store {
        function mutate(uint256 field, uint256 value, string memory note, uint256 mark) external;
        function read() external returns (Record memory);
      }
      contract Consumer(address source) {
        function verify() public {
          Store(source).mutate(0, 9, "", 0);
          Store(source).mutate(1, 0, "new", 0);
          Store(source).mutate(2, 0, "", 6);
          Record memory record = Store(source).read();
          require(record.value == 9 && record.detail.note == "new"
            && record.detail.marks.length == 1 && record.detail.marks[0] == 6);
        }
      }`, OPTIONS);
    const consumerBase = new Contract(consumerArtifact, [source.inner.lockingBytecode], { provider });
    const consumerSetup = await setupStatefulUtxos(
      provider, consumerBase, consumerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const consumer = StatefulContract.withCategory(
      consumerBase.withCategory(hexToBin(consumerSetup.categoryId)), consumerSetup.categoryId,
    );
    const expected = hexToBin(ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256,tuple(string,uint256[]))'], [[9n, ['new', [6n]]]],
    ).slice(2));
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const built = await messageBus.compose({
      preparedCalls: [
        { contract: consumer, functionName: 'verify', args: [] },
        { contract: source, functionName: 'mutate', args: [0n, 9n, '', 0n] },
        { contract: source, functionName: 'mutate', args: [1n, 0n, 'new', 0n] },
        { contract: source, functionName: 'mutate', args: [2n, 0n, '', 6n] },
        {
          contract: source, functionName: 'read', args: [],
          provisionalResultCommitment: expected,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();
    expect(vmAccepts(built)).toBe(true);
    const transaction = built.buildLibauthTransaction();
    const resultOutput = transaction.outputs.find((output) => output.token?.nft?.capability === 'none'
      && binToHex(output.token.category) === sourceSetup.categoryId);
    expect(resultOutput).toBeDefined();

    const sourceOutputs = generateLibauthSourceOutputs(built.inputs);
    const sourceRouteInput = built.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Source'
      && input.unlocker.abiFunction.name === sourceArtifact.messageBus!.route.name);
    const tampered = {
      ...transaction,
      outputs: transaction.outputs.map((output) => output !== resultOutput ? output : ({
        ...output,
        token: { ...output.token!, nft: { ...output.token!.nft!,
          commitment: Uint8Array.from(output.token!.nft!.commitment, (byte, offset) =>
            offset === output.token!.nft!.commitment.length - 1 ? byte ^ 1 : byte) } },
      })),
    };
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: sourceRouteInput, sourceOutputs, transaction: tampered })))
      .not.toBe(true);
  }, 120_000);

  it('enforces the cumulative 10KB result ceiling for whole flattened dynamic state structs', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const chunk = 'a'.repeat(410);
    const repeatedChunk = Array.from({ length: 12 }, () => 'chunk').join(', ');
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { string note; uint256[] marks; }
      contract Source {
        Record record;
        function expand() public {
          string memory chunk = "${chunk}";
          record.note = string.concat(${repeatedChunk});
          require(record.note.length > 0);
        }
        function read() public view returns (Record memory) { return record; }
      }`, OPTIONS);
    expect(artifact.abi.find((entry) => entry.name === 'read')?.dynamicReads)
      .toEqual(['record__note', 'record__marks']);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {
      record__note: '', record__marks: [],
    }, { saltContract: true });
    const source = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    await source.call.expand().send();
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

    // A standalone batch has no return-event output and therefore no exact value to pin against a changed
    // pre-state chunk. Compose a consumer to bind the complete single-row result before adversarial checks.
    const consumerArtifact = compileString(`pragma solidity ^0.8.0;
      struct Record { string note; uint256[] marks; }
      interface Reader { function read() external returns (Record memory); }
      contract Consumer(address sourceAddress) {
        function verify() public {
          Record memory value = Reader(sourceAddress).read();
          require(value.note.length == 4920 && value.marks.length == 0);
        }
      }`, OPTIONS);
    const consumerBase = new Contract(consumerArtifact, [source.inner.lockingBytecode], { provider });
    const consumerSetup = await setupStatefulUtxos(
      provider, consumerBase, consumerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const consumer = StatefulContract.withCategory(
      consumerBase.withCategory(hexToBin(consumerSetup.categoryId)), consumerSetup.categoryId,
    );
    const expected = hexToBin(ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(string,uint256[])'], [['a'.repeat(4920), []]],
    ).slice(2));
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const bound = await messageBus.compose({
      preparedCalls: [
        { contract: consumer, functionName: 'verify', args: [] },
        { contract: source, functionName: 'read', args: [], provisionalResultCommitment: expected },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();
    expect(vmAccepts(bound)).toBe(true);
    const boundTransaction = bound.buildLibauthTransaction();
    const boundSources = generateLibauthSourceOutputs(bound.inputs);
    const boundRouteInput = bound.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Source'
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const chunkLock = binToHex(addressToLockScript(getDynamicChunkAddress(
      source.inner, setup.categoryId, 'record__note', 'string',
    )));
    const chunkInputs = boundSources.flatMap((output, index) =>
      binToHex(output.lockingBytecode) === chunkLock ? [index] : []);
    expect(boundRouteInput).toBeGreaterThanOrEqual(0);
    expect(chunkInputs.length).toBeGreaterThan(1);
    const [firstChunk, secondChunk] = chunkInputs;
    const rejected = (
      candidateTransaction: typeof boundTransaction, candidateSources: typeof boundSources,
    ): boolean => vm.stateSuccess(vm.evaluate({
      inputIndex: boundRouteInput,
      sourceOutputs: candidateSources,
      transaction: candidateTransaction,
    })) !== true;

    const forgedSources = boundSources.map((output) => ({
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
    const forgedCommitment = forgedSources[firstChunk].token!.nft!.commitment;
    forgedCommitment[forgedCommitment.length - 1] ^= 1;
    expect(rejected(boundTransaction, forgedSources)).toBe(true);

    const reorderedSources = boundSources.slice();
    [reorderedSources[firstChunk], reorderedSources[secondChunk]] =
      [reorderedSources[secondChunk], reorderedSources[firstChunk]];
    expect(rejected(boundTransaction, reorderedSources)).toBe(true);

    const missingTransaction = {
      ...boundTransaction,
      inputs: boundTransaction.inputs.filter((_input, index) => index !== firstChunk),
    };
    const missingSources = boundSources.filter((_output, index) => index !== firstChunk);
    expect(rejected(missingTransaction, missingSources)).toBe(true);
  }, 120_000);
});
