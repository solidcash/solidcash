import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../../src/index.js';
import {
  StatefulContract,
  getContractFactory,
  upgrades,
} from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { isContractUnlocker } from '../../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { callRecordCommitment, callRecordDigest } from '../../../src/stateful/call-record.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  messageBusGraphContext: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

describe('kernel nested dynamic return preimages', () => {
  const prove = async (label: string): Promise<void> => {
    const provider = createMessageBusCapstoneTestProvider();
    const producerArtifact = compileString(`pragma solidity ^0.8.0;
      struct Record { uint256 value; string label; }
      contract DynamicProducer {
        function read() public pure returns (Record memory) {
          return Record(7, "${label}");
        }
      }`, KERNEL);
    const producerBase = new Contract(producerArtifact, [], { provider });
    const producerSetup = await setupStatefulUtxos(
      provider, producerBase, producerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const producer = StatefulContract.withCategory(
      producerBase.withCategory(hexToBin(producerSetup.categoryId)), producerSetup.categoryId,
    );

    const consumerArtifact = compileString(`pragma solidity ^0.8.0;
      struct Record { uint256 value; string label; }
      interface IDynamicProducer { function read() external returns (Record memory); }
      contract DynamicConsumer(address producer) {
        uint256 public observed;
        function verify() public {
          Record memory record = IDynamicProducer(producer).read();
          observed = record.value;
          require(record.value == 7 && record.label == "${label}");
        }
      }`, KERNEL);
    const consumerBase = new Contract(consumerArtifact, [producer.inner.lockingBytecode], { provider });
    const consumerSetup = await setupStatefulUtxos(
      provider, consumerBase, consumerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const consumer = StatefulContract.withCategory(
      consumerBase.withCategory(hexToBin(consumerSetup.categoryId)), consumerSetup.categoryId,
    );
    consumer._registerResolvedExternal('IDynamicProducer', producer);

    const builder = await consumer.call.verify().build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const state = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      expect(vm.stateSuccess(state), `input ${inputIndex}: ${state.error ?? 'unknown error'}`).toBe(true);
    }

    const consumerInputIndex = builder.inputs.findIndex((input) => isContractUnlocker(input.unlocker)
      && input.unlocker.contract.artifact.contractName === 'DynamicConsumer'
      && input.unlocker.abiFunction.inputs.some((argument) =>
        argument.name === '__internal__externalReturnPreimage'));
    expect(consumerInputIndex).toBeGreaterThanOrEqual(0);
    const unlocker = builder.inputs[consumerInputIndex].unlocker;
    if (!isContractUnlocker(unlocker)) throw new Error('Missing dynamic consumer unlocker');
    const preimageIndex = unlocker.abiFunction.inputs.findIndex((argument) =>
      argument.name === '__internal__externalReturnPreimage');
    const outputIndexArg = unlocker.abiFunction.inputs.findIndex((argument) =>
      argument.name === '__internal__externalReturnOutputIdx');
    const preimage = unlocker.params[preimageIndex];
    if (!(preimage instanceof Uint8Array)) throw new Error('Missing dynamic return preimage');
    const expected = hexToBin(ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256,string)'], [[7n, label]],
    ).slice(2));
    expect(binToHex(preimage)).toBe(binToHex(expected));
    const returnOutputIndex = Number(unlocker.params[outputIndexArg]);
    // D50: the carrier is the record of this call, digest(read) || form 2 || SHA256(result), past 96 bytes.
    const digest = callRecordDigest(producerArtifact.abi.find((fn) => fn.name === 'read')!, []);
    if (!digest) throw new Error('read publishes no selector');
    expect(expected.length).toBeGreaterThan(96);
    expect(transaction.outputs[returnOutputIndex]?.token?.nft?.commitment)
      .toEqual(callRecordCommitment(expected, digest));

    const forged = preimage.slice();
    forged[forged.length - 1] ^= 1;
    unlocker.params[preimageIndex] = forged;
    unlocker.syncEncodedArgsFromParams?.([preimageIndex]);
    const forgedTransaction = builder.buildLibauthTransaction();
    const forgedState = vm.evaluate({
      inputIndex: consumerInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: forgedTransaction,
    });
    expect(vm.stateSuccess(forgedState)).not.toBe(true);
    unlocker.params[preimageIndex] = preimage;
    unlocker.syncEncodedArgsFromParams?.([preimageIndex]);
  };

  it('VM-proves short and long dynamic structs and rejects forged preimages', async () => {
    await prove('short');
    await prove('dynamic-result-'.repeat(16));
  }, 180_000);

  it('VM-proves an oversized dynamic return through a proxy delegate', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7a), provider);
    for (let index = 0; index < 24; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }
    const label = 'proxy-dynamic-result-'.repeat(10);
    const producerArtifact = compileString(`pragma solidity ^0.8.0;
      struct Record { uint256 value; string label; }
      contract DynamicProxyProducer {
        uint256 value;
        function initialize() public { value = 7; }
        function setValue(uint256 next) public { value = next; require(true); }
        function read() public view returns (Record memory) {
          return Record(value, "${label}");
        }
      }`, KERNEL);
    const producer = await upgrades.deployProxy(getContractFactory(producerArtifact, signer), []);
    const consumerArtifact = compileString(`pragma solidity ^0.8.0;
      struct Record { uint256 value; string label; }
      interface IDynamicProxyProducer { function read() external returns (Record memory); }
      contract ProxyDynamicConsumer {
        uint256 public observed;
        function verify(address producer) public {
          Record memory record = IDynamicProxyProducer(producer).read();
          observed = record.value;
          require(record.value == 7 && record.label == "${label}");
        }
      }`, KERNEL);
    const consumerBase = new Contract(consumerArtifact, [], { provider });
    const consumerSetup = await setupStatefulUtxos(
      provider, consumerBase, consumerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const consumer = StatefulContract.withCategory(
      consumerBase.withCategory(hexToBin(consumerSetup.categoryId)), consumerSetup.categoryId,
    );
    consumer._registerResolvedExternal('IDynamicProxyProducer', producer.proxy);

    const callsiteId = consumerArtifact.abi.find((entry) => entry.name === 'verify')
      ?.externalCalls?.find((call) => call.functionName === 'read')?.callsiteId;
    expect(callsiteId).toBeDefined();
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: consumer, functionName: 'verify', args: [producer.proxy.inner.lockingBytecode],
      }, {
        contract: producer.proxy,
        functionName: 'read',
        args: [],
        callsiteId: callsiteId!,
        targetLockingBytecode: producer.proxy.inner.lockingBytecode,
        executionArtifact: producer.implementation.inner.artifact,
        executor: producer.implementation,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const state = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      expect(vm.stateSuccess(state), `input ${inputIndex}: ${state.error ?? 'unknown error'}`).toBe(true);
    }
    const consumerInputIndex = builder.inputs.findIndex((input) => isContractUnlocker(input.unlocker)
      && input.unlocker.contract.artifact.contractName === 'ProxyDynamicConsumer'
      && input.unlocker.abiFunction.inputs.some((argument) => argument.name === '__internal__graphEmissions'));
    expect(consumerInputIndex).toBeGreaterThanOrEqual(0);
    const unlocker = builder.inputs[consumerInputIndex].unlocker;
    if (!isContractUnlocker(unlocker)) throw new Error('Missing proxy dynamic consumer unlocker');
    const emissionsIndex = unlocker.abiFunction.inputs.findIndex((argument) =>
      argument.name === '__internal__graphEmissions');
    const emissions = unlocker.params[emissionsIndex];
    if (!(emissions instanceof Uint8Array)) throw new Error('Missing proxy graph emissions');
    const expected = hexToBin(ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256,string)'], [[7n, label]],
    ).slice(2));
    expect(expected.length).toBeGreaterThan(128);
    const resultHex = binToHex(expected);
    const resultPosition = binToHex(emissions).indexOf(resultHex);
    expect(resultPosition).toBeGreaterThanOrEqual(0);

    const forged = emissions.slice();
    forged[resultPosition / 2 + expected.length - 1] ^= 1;
    unlocker.params[emissionsIndex] = forged;
    unlocker.syncEncodedArgsFromParams?.([emissionsIndex]);
    const forgedTransaction = builder.buildLibauthTransaction();
    const forgedState = vm.evaluate({
      inputIndex: consumerInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: forgedTransaction,
    });
    expect(vm.stateSuccess(forgedState)).not.toBe(true);
    unlocker.params[emissionsIndex] = emissions;
    unlocker.syncEncodedArgsFromParams?.([emissionsIndex]);

    // The same runtime target must also work through the ordinary SDK send path; explicit composition above
    // proves the VM route independently of discovery and promotion.
    await consumer.connect(signer).call.verify(producer.proxy.inner.lockingBytecode).send();
    expect((await consumer.getState()).observed).toBe(7n);
  }, 180_000);
});
