import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
import { resolveDynamicChunkInputBase } from '../../../src/stateful/StatefulContract.js';
import { resolveParticipantAbsoluteWitnesses } from '../../../src/message-bus/layout-resolver.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
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

describe('kernel local probe witness rebase', () => {
  it('rebases participant-local dynamicChunkInputBase onto the published absolute span', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const storeArtifact = compileString(`pragma solidity ^0.8.0;
      contract Store {
        string label;
        uint256 counter;
        function setLabel(string memory value) public { label = value; require(true); }
        function bump() public { counter += 1; require(true); }
      }`, KERNEL);
    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    await store.call.setLabel('alpha').send();

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface StoreApi { function bump() external; }
      contract Caller(address store) {
        function execute() public { StoreApi(store).bump(); require(true); }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [store.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );

    const callsiteId = callerArtifact.abi.find((entry) => entry.name === 'execute')!
      .externalCalls!.find((call) => call.functionName === 'bump')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const builder = await messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'execute', args: [] },
        { contract: store, functionName: 'bump', args: [], callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();

    expect(vmAccepts(builder)).toBe(true);

    const storeRouteInputIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Store'
      && input.unlocker.abiFunction.name === storeArtifact.messageBus!.route.name);
    expect(storeRouteInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[storeRouteInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('store route input has no parameters');

    const dynamicBasePosition = storeArtifact.messageBus!.route.inputs.findIndex(
      (input) => input.name === '__internal__dynamicChunkInputBase',
    );
    expect(dynamicBasePosition).toBeGreaterThanOrEqual(0);
    const publishedAbsoluteDyn = Number(routeUnlocker.params[dynamicBasePosition] as bigint);
    expect(publishedAbsoluteDyn).toBeGreaterThanOrEqual(0);

    // Aggregate absolute base must equal publishedBase + localSlot for the participant-local zero slot.
    expect(resolveDynamicChunkInputBase(0, publishedAbsoluteDyn)).toBe(BigInt(publishedAbsoluteDyn));
    // A non-zero local slot rebases by addition onto the published participant span.
    expect(resolveDynamicChunkInputBase(2, publishedAbsoluteDyn)).toBe(BigInt(publishedAbsoluteDyn + 2));

    // transaction layout authority: filled unlocker dyn base matches one resolveParticipantAbsoluteWitnesses (compose path).
    const trailingBase = storeArtifact.messageBus?.route?.blockLayout?.trailingBase;
    expect(typeof trailingBase).toBe('number');
    const expected = resolveParticipantAbsoluteWitnesses({
      participant: 0,
      publishedBase: storeRouteInputIndex,
      blockSize: Math.max(
        storeArtifact.messageBus?.route?.blockLayout?.blockSize ?? 0,
        (trailingBase as number) + 1,
      ),
      trailingBase: trailingBase as number,
      trailingCapacity: storeArtifact.messageBus?.route?.blockLayout?.trailingCapacity,
      dynChunkCount: 0,
    });
    expect(expected.dynamicChunkInputBase).toBeDefined();
    expect(BigInt(publishedAbsoluteDyn)).toBe(expected.dynamicChunkInputBase);
    expect(routeUnlocker.params[dynamicBasePosition]).toBe(expected.dynamicChunkInputBase);

    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    expect(sourceOutputs[publishedAbsoluteDyn]?.token).toMatchObject({
      category: hexToBin(storeSetup.categoryId),
      nft: { capability: 'mutable' },
    });

    // Inactive return slots stay at the negative sentinel; active ones remain absolute.
    const returnWitnessIndex = storeArtifact.messageBus!.route.inputs.findIndex(
      (input) => input.name === '__internal__returnOutputIdx',
    );
    if (returnWitnessIndex >= 0) {
      const absoluteReturn = Number(routeUnlocker.params[returnWitnessIndex] as bigint);
      expect(absoluteReturn === -1 || absoluteReturn >= storeRouteInputIndex).toBe(true);
    }
  }, 120_000);
});
