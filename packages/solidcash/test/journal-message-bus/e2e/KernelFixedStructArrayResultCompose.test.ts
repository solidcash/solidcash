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

describe('kernel fixed array of structs result composition', () => {
  it('canonically encodes dynamic struct leaves in the BCH VM and rejects result tampering', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sourceArtifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { uint16 code; string label; }
      struct Record { uint256 value; Detail detail; bytes payload; }
      contract Source {
        function read() public pure returns (Record[2] memory) {
          Record[2] memory records;
          records[0] = Record(9, Detail(70, "first"), hex"aabbccdd");
          records[1] = Record(12, Detail(80, "second"), hex"0102030405");
          return records;
        }
      }`, OPTIONS);
    expect(sourceArtifact.messageBus?.handlers.find((entry) => entry.name === 'read'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Record[2]' }] });
    const sourceBase = new Contract(sourceArtifact, [], { provider });
    const sourceSetup = await setupStatefulUtxos(
      provider, sourceBase, sourceArtifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      sourceBase.withCategory(hexToBin(sourceSetup.categoryId)), sourceSetup.categoryId,
    );

    const consumerArtifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { uint16 code; string label; }
      struct Record { uint256 value; Detail detail; bytes payload; }
      interface Reader { function read() external returns (Record[2] memory); }
      contract Consumer(address source) {
        function verify() public {
          Record[2] memory records = Reader(source).read();
          require(records[0].value == 9 && records[0].detail.code == 70
            && records[0].detail.label == "first" && records[0].payload == hex"aabbccdd"
            && records[1].value == 12 && records[1].detail.code == 80
            && records[1].detail.label == "second" && records[1].payload == hex"0102030405");
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
      ['tuple(uint256,tuple(uint16,string),bytes)[2]'],
      [[
        [9n, [70n, 'first'], '0xaabbccdd'],
        [12n, [80n, 'second'], '0x0102030405'],
      ]],
    ).slice(2));
    expect(result.length).toBeGreaterThan(520);
    expect(result.length).toBeLessThanOrEqual(10_000);
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
    const ordinaryVm = createVirtualMachineBch2026ForProvider(undefined);
    expect(transaction.inputs.every((_input, inputIndex) => ordinaryVm.stateSuccess(
      ordinaryVm.evaluate({ inputIndex, sourceOutputs, transaction }),
    ) === true)).toBe(true);
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

  it('applies the result envelope to the cumulative multi-row return vector', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const chunk = 'ab'.repeat(410);
    const repeatedChunk = Array.from({ length: 12 }, () => 'chunk').join(', ');
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { bytes payload; }
      contract Source {
        function read() public pure returns (Record[2] memory) {
          bytes memory chunk = hex"${chunk}";
          bytes memory expanded = bytes.concat(${repeatedChunk});
          Record[2] memory records;
          records[0] = Record(expanded);
          records[1] = Record(hex"");
          return records;
        }
      }`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((entry) => entry.name === 'read'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Record[2]' }] });
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
    const built = await source.batch([
      { function: 'read', args: [] },
      { function: 'read', args: [] },
    ]).build();
    const transaction = built.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.inputs);
    const sourceRouteInput = built.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Source'
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(sourceRouteInput).toBeGreaterThanOrEqual(0);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(transaction.inputs.every((_input, inputIndex) => inputIndex === sourceRouteInput
      || vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true)).toBe(true);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: sourceRouteInput, sourceOutputs, transaction })))
      .not.toBe(true);
  }, 120_000);
});
