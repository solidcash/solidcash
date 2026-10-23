import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { isContractUnlocker, type ContractUnlocker } from '../../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { callRecordCommitment, callRecordDigest } from '../../../src/stateful/call-record.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
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

describe('kernel nested fixed-array return materialization', () => {
  it('materializes an intermediate stateful return after consuming a child result', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const expectKernelHandler = (artifact: ReturnType<typeof compileString>): void => {
      expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
      expect(artifact.bytecode.replace(/\s+/gu, '')).toContain('OP_INVOKE');
    };

    const producerArtifact = compileString(`pragma solidity ^0.8.0;
      contract ArrayProducer {
        function read() public pure returns (uint256[5] memory) {
          return [uint256(1), uint256(2), uint256(3), uint256(4), uint256(5)];
        }
      }`, KERNEL);
    expectKernelHandler(producerArtifact);
    const producerBase = new Contract(producerArtifact, [], { provider });
    const producerSetup = await setupStatefulUtxos(
      provider, producerBase, producerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const producer = StatefulContract.withCategory(
      producerBase.withCategory(hexToBin(producerSetup.categoryId)), producerSetup.categoryId,
    );

    const consumerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IArrayProducer { function read() external returns (uint256[5] memory); }
      contract ArrayConsumer(address producer) {
        uint256 public observations;

        function consume(uint256 key) public returns (uint256[5] memory) {
          observations = observations + 1;
          uint256[5] memory source = IArrayProducer(producer).read();
          uint256[5] memory values;
          values[0] = uint256(source[0]) + 10;
          values[1] = uint256(source[1]) + 10;
          values[2] = uint256(source[2]) + 10;
          values[3] = uint256(source[3]) + 10;
          values[4] = uint256(source[4]) + 10;
          require(values[4] == 15);
          return values;
        }
      }`, KERNEL);
    expectKernelHandler(consumerArtifact);
    const consumerBase = new Contract(
      consumerArtifact, [producer.inner.lockingBytecode], { provider },
    );
    const consumerSetup = await setupStatefulUtxos(
      provider, consumerBase, consumerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const consumer = StatefulContract.withCategory(
      consumerBase.withCategory(hexToBin(consumerSetup.categoryId)), consumerSetup.categoryId,
    );
    consumer._registerResolvedExternal('IArrayProducer', producer);

    const invokerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IArrayConsumer {
        function consume(uint256 key) external returns (uint256[5] memory);
      }
      contract ArrayInvoker(address consumer) {
        uint256 public runs;
        function run(uint256 key) public {
          uint256[5] memory values = IArrayConsumer(consumer).consume(key);
          runs = runs + 1;
          require(values[0] == 11 && values[4] == 15);
        }
      }`, KERNEL);
    const invokerBase = new Contract(
      invokerArtifact, [consumer.inner.lockingBytecode], { provider },
    );
    const invokerSetup = await setupStatefulUtxos(
      provider, invokerBase, invokerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const invoker = StatefulContract.withCategory(
      invokerBase.withCategory(hexToBin(invokerSetup.categoryId)), invokerSetup.categoryId,
    );
    invoker._registerResolvedExternal('IArrayConsumer', consumer);

    const expectedProducerResult = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256[5]'], [[1n, 2n, 3n, 4n, 5n]],
    ).slice(2);
    const expectedIntermediateResult = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256[5]'], [[11n, 12n, 13n, 14n, 15n]],
    ).slice(2);
    expect(await producer.call.read().staticCall()).toEqual([1n, 2n, 3n, 4n, 5n]);
    const builder = await invoker.call.run(7n).build();
    const transaction = builder.buildLibauthTransaction();
    const externalResultConsumedBy = (
      contractName: string,
    ): { outputIndex: number; category: string; capability: string; commitment: string } => {
      const input = builder.inputs.find((candidate) => (
        'contract' in candidate.unlocker
        && candidate.unlocker.contract.artifact.contractName === contractName
        && candidate.unlocker.abiFunction.inputs.some(
          (argument) => argument.name === '__internal__externalReturnOutputIdx',
        )
      ));
      expect(input).toBeDefined();
      if (!input || !('params' in input.unlocker)) throw new Error(`${contractName} route has no parameters`);
      const argumentIndex = input.unlocker.abiFunction.inputs.findIndex(
        (argument) => argument.name === '__internal__externalReturnOutputIdx',
      );
      expect(argumentIndex).toBeGreaterThanOrEqual(0);
      const outputIndex = Number(input.unlocker.params[argumentIndex] as bigint);
      const token = transaction.outputs[outputIndex]?.token;
      return {
        outputIndex,
        category: token?.category === undefined ? '' : binToHex(token.category),
        capability: token?.nft?.capability ?? '',
        commitment: token?.nft?.commitment === undefined ? '' : binToHex(token.nft.commitment),
      };
    };

    const producerResult = externalResultConsumedBy('ArrayConsumer');
    const intermediateResult = externalResultConsumedBy('ArrayInvoker');
    // D50: each carrier is the record of its call, digest(method, arguments) || form 2 || SHA256(result).
    const readFn = producerArtifact.abi.find((fn) => fn.name === 'read')!;
    const consumeFn = consumerArtifact.abi.find((fn) => fn.name === 'consume')!;
    const readDigest = callRecordDigest(readFn, []);
    const consumeDigest = callRecordDigest(consumeFn, consumeFn.inputs.map((input) => (input.name === 'key' ? 7n : 0n)));
    if (!readDigest || !consumeDigest) throw new Error('read and consume publish selectors');
    expect(producerResult, `producer result output ${producerResult.outputIndex}`).toMatchObject({
      category: producerSetup.categoryId,
      capability: 'none',
      commitment: binToHex(callRecordCommitment(hexToBin(expectedProducerResult), readDigest)),
    });
    expect(intermediateResult, `intermediate result output ${intermediateResult.outputIndex}`).toMatchObject({
      category: consumerSetup.categoryId,
      capability: 'none',
      commitment: binToHex(callRecordCommitment(hexToBin(expectedIntermediateResult), consumeDigest)),
    });

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const state = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      expect(vm.stateSuccess(state), `input ${inputIndex}: ${JSON.stringify({
        error: state.error,
        ip: state.ip,
        instructions: state.instructions.length,
        nearby: state.instructions.slice(Math.max(0, state.ip - 8), state.ip + 2)
          .map((instruction) => instruction.opcode),
        stack: state.stack.slice(-6).map(binToHex),
      })}`)
        .toBe(true);
    }
    const returnPreimageWitness = (contractName: string): {
      inputIndex: number;
      unlocker: ContractUnlocker;
      argumentIndex: number;
      value: Uint8Array;
    } => {
      const inputIndex = builder.inputs.findIndex((candidate) => 'contract' in candidate.unlocker
        && candidate.unlocker.contract.artifact.contractName === contractName);
      expect(inputIndex).toBeGreaterThanOrEqual(0);
      const unlocker = builder.inputs[inputIndex].unlocker;
      if (!isContractUnlocker(unlocker)) throw new Error(`${contractName} has no return witness`);
      const argumentIndex = unlocker.abiFunction.inputs.findIndex((argument) =>
        argument.name === '__internal__externalReturnPreimage');
      expect(argumentIndex).toBeGreaterThanOrEqual(0);
      const value = unlocker.params[argumentIndex];
      if (!(value instanceof Uint8Array)) throw new Error(`${contractName} return witness is not bytes`);
      return { inputIndex, unlocker, argumentIndex, value };
    };
    const producerWitness = returnPreimageWitness('ArrayConsumer');
    const intermediateWitness = returnPreimageWitness('ArrayInvoker');
    expect(binToHex(producerWitness.value)).toBe(expectedProducerResult);
    expect(binToHex(intermediateWitness.value)).toBe(expectedIntermediateResult);

    const forged = intermediateWitness.value.slice();
    forged[31] ^= 1;
    intermediateWitness.unlocker.params[intermediateWitness.argumentIndex] = forged;
    intermediateWitness.unlocker.syncEncodedArgsFromParams?.([intermediateWitness.argumentIndex]);
    const forgedTransaction = builder.buildLibauthTransaction();
    const forgedState = vm.evaluate({
      inputIndex: intermediateWitness.inputIndex,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: forgedTransaction,
    });
    expect(vm.stateSuccess(forgedState)).not.toBe(true);
    intermediateWitness.unlocker.params[intermediateWitness.argumentIndex] = intermediateWitness.value;
    intermediateWitness.unlocker.syncEncodedArgsFromParams?.([intermediateWitness.argumentIndex]);
  }, 180_000);
});
