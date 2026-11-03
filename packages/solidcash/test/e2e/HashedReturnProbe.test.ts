import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { encodeEvmInvocationResult } from '../../src/stateful/evm-abi-result.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createMessageBusSemanticTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { setupStatefulUtxos } from '../test-util.js';
import { callRecordCommitment, callRecordDigest } from '../../src/stateful/call-record.js';

describe('authenticated hashed return probes', () => {
  it.each([true, false])('derives a five-word EVM fixed-array result (fast compilation: %s)', async (fast) => {
    const provider = createMessageBusSemanticTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract ArrayProducer {
        function shortResult(uint16[4] calldata input) external pure returns (uint16[4] memory) {
          return input;
        }
        function project(uint16[5] calldata input) external pure returns (uint16[5] memory) {
          uint16[5] memory result;
          for (uint i = 0; i < 5; i++) result[i] = input[i] + 1;
          return result;
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
      evmCompat: true, optimizeForCompilationSpeed: fast,
      maximumInputBytes: 1_000_000, suppressWarnings: true,
    });
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
    const contract = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    await expect(contract.call.shortResult([1n, 2n, 3n, 4n]).staticCall()).resolves.toEqual([1n, 2n, 3n, 4n]);
    await expect(contract.call.project([1n, 2n, 3n, 4n, 5n]).staticCall()).resolves.toEqual([2n, 3n, 4n, 5n, 6n]);
    const builder = await contract.call.project([1n, 2n, 3n, 4n, 5n]).emitReturn().build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const expected = encodeEvmInvocationResult([[2n, 3n, 4n, 5n, 6n]], ['uint16[5]']);
    // Since call records (D50, docs/wip/call-records/DESIGN.md) a return carrier commits to the call it answers: the
    // call's 31-byte digest, a form byte, and the result. The five-word EVM result (160 bytes) is wider than the
    // inline form takes, so the record carries form 0x02 and the result's SHA256; probes still recover the raw bytes
    // from the preimage they recorded.
    const projectAbi = artifact.abi.find((entry) => entry.name === 'project')!;
    const callDigest = callRecordDigest(projectAbi, [[1n, 2n, 3n, 4n, 5n]], { structs: artifact.structs });
    expect(callDigest).toBeDefined();
    const record = callRecordCommitment(expected, callDigest!);
    expect(record).toHaveLength(31 + 1 + 32);
    expect(record[31]).toBe(0x02);
    const output = transaction.outputs.find((candidate) => candidate.token?.nft
      && binToHex(candidate.token.nft.commitment) === binToHex(record));
    expect(output).toBeDefined();
    // The published record verifies, and the covenant refuses a record whose call digest or result hash is altered.
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction }))).toBe(true);
    const commitment = output!.token!.nft!.commitment;
    for (const byte of [0, 32]) {
      commitment[byte] ^= 1;
      expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction })), `byte ${byte}`).not.toBe(true);
      commitment[byte] ^= 1;
    }
  });
});
