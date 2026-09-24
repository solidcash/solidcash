import {
  bigIntToVmNumber, binToHex, hexToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, StatefulContract, messageBus, SortedList, getEntryNftAddress,
} from '../../../src/index.js';
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

const commitmentHex = (commitment: Uint8Array | string | undefined): string => {
  if (commitment === undefined) return '';
  return typeof commitment === 'string' ? commitment.toLowerCase() : binToHex(commitment).toLowerCase();
};

describe('kernel sorted-update PredOut under composition', () => {
  it('UPDATE: PredOut inactive; rewritten entry content-matches slot/next/value', async () => {
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

    // Seed the key that will be UPDATEd (present entry), plus a higher neighbor so PredOut is unambiguous.
    await registry.call.set(2n, 7n).send();
    await registry.call.set(9n, 1n).send();

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
        { contract: caller, functionName: 'poke', args: [2n, 55n] },
        { contract: registry, functionName: 'set', args: [2n, 55n], callsiteId },
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
    // Pure value UPDATE of a present key (next pointer unchanged) leaves PredOut inactive.
    // INSERT uses PredOut=P; UPDATE authenticates via exact rewritten entry content-match instead.
    expect(predOutAbsolute).toBe(-1);

    const transaction = builder.buildLibauthTransaction();
    const updatedSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(2n)));
    const neighborSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(9n)));
    const rewrittenIndex = transaction.outputs.findIndex((output) => {
      if (output.token?.nft?.capability !== 'mutable') return false;
      try {
        const decoded = decodeEntryCommitment(
          typeof output.token.nft.commitment === 'string'
            ? hexToBin(output.token.nft.commitment)
            : output.token.nft.commitment,
        );
        return bytesToSlotValue(decoded.slot) === updatedSlot
          && bytesToSlotValue(decoded.nextKey) === neighborSlot
          && vmNumberToBigInt(decoded.value, { requireMinimalEncoding: false }) === 55n;
      } catch {
        return false;
      }
    });
    expect(rewrittenIndex).toBeGreaterThanOrEqual(0);
    expect(commitmentHex(transaction.outputs[rewrittenIndex].token?.nft?.commitment).length)
      .toBeGreaterThan(0);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const ea = getEntryNftAddress(registry.inner, registrySetup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea))
      .find(keyToSlot(bigIntToVmNumber(2n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(55n);
  }, 180_000);
});
