import {
  bigIntToVmNumber, binToHex, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import {
  bytesToSlotValue, decodeEntryCommitment, keyToSlot,
} from '../../../src/stateful/SortedList.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
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

const commitmentHex = (commitment: Uint8Array | string | undefined): string => {
  if (commitment === undefined) return '';
  return typeof commitment === 'string' ? commitment.toLowerCase() : binToHex(commitment).toLowerCase();
};

describe('kernel sorted-insert PredOut under composition', () => {
  it('points PredOut at the P predecessor rewrite, not the NEW entry', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const registryArtifact = compileString(`pragma solidity ^0.8.0;
      contract Registry {
        mapping(uint256 => uint256) bal;
        function set(uint256 k, uint256 v) public { bal[k] = v; require(true); }
      }`, KERNEL);
    expect(registryArtifact.messageBus?.route.inputs.some(
      (input) => input.name === '__internal__vmapBatchPredOut_0',
    )).toBe(true);

    const registryBase = new Contract(registryArtifact, [], { provider });
    const registrySetup = await setupStatefulUtxos(
      provider, registryBase, registryArtifact.stateLayout!, {}, { saltContract: true },
    );
    const registry = StatefulContract.withCategory(
      registryBase.withCategory(hexToBin(registrySetup.categoryId)), registrySetup.categoryId,
    );

    // Seed a present entry so the cold INSERT brackets a real predecessor.
    await registry.call.set(2n, 7n).send();

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IRegistry { function set(uint256 k, uint256 v) external; }
      contract Caller(address registry) {
        function poke(uint256 k, uint256 v) public {
          IRegistry(registry).set(k, v);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [registry.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );

    const callsiteId = callerArtifact.abi.find((entry) => entry.name === 'poke')!
      .externalCalls!.find((call) => call.functionName === 'set')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'poke', args: [9n, 55n] },
        { contract: registry, functionName: 'set', args: [9n, 55n], callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const routeInputIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Registry'
      && input.unlocker.abiFunction.name === registryArtifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('registry route input has no parameters');

    const predOutWitnessIndex = registryArtifact.messageBus!.route.inputs.findIndex(
      (input) => input.name === '__internal__vmapBatchPredOut_0',
    );
    expect(predOutWitnessIndex).toBeGreaterThanOrEqual(0);
    const predOutAbsolute = Number(routeUnlocker.params[predOutWitnessIndex] as bigint);
    expect(predOutAbsolute).toBeGreaterThanOrEqual(0);

    const transaction = builder.buildLibauthTransaction();
    const predOut = transaction.outputs[predOutAbsolute];
    expect(predOut?.token?.nft?.capability).toBe('mutable');
    const predCommitment = predOut.token!.nft!.commitment;
    expect(commitmentHex(predCommitment).length).toBeGreaterThan(0);

    const seededSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(2n)));
    const insertedSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(9n)));
    const decodedPred = decodeEntryCommitment(
      typeof predCommitment === 'string' ? hexToBin(predCommitment) : predCommitment,
    );
    // PredOut names P: the predecessor rewrite keeps the seeded slot and now links to the inserted key.
    expect(bytesToSlotValue(decodedPred.slot)).toBe(seededSlot);
    expect(bytesToSlotValue(decodedPred.nextKey)).toBe(insertedSlot);

    const newEntryIndex = transaction.outputs.findIndex((output, index) => {
      if (index === predOutAbsolute) return false;
      if (output.token?.nft?.capability !== 'mutable') return false;
      try {
        const decoded = decodeEntryCommitment(
          typeof output.token.nft.commitment === 'string'
            ? hexToBin(output.token.nft.commitment)
            : output.token.nft.commitment,
        );
        return bytesToSlotValue(decoded.slot) === insertedSlot;
      } catch {
        return false;
      }
    });
    expect(newEntryIndex).toBeGreaterThanOrEqual(0);
    expect(newEntryIndex).not.toBe(predOutAbsolute);
    expect(commitmentHex(transaction.outputs[newEntryIndex].token?.nft?.commitment))
      .not.toBe(commitmentHex(predCommitment));

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 180_000);
});
