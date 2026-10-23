import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { resolveParticipantAbsoluteWitnesses } from '../../../src/message-bus/layout-resolver.js';
import { decodeLayoutCoordinate } from '../../../src/message-bus/layout-sentinels.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
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

describe('kernel nested return-slot coordinates', () => {
  it('keeps participant blocks local while return witnesses use absolute output indices', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const leafArtifact = compileString(`pragma solidity ^0.8.0;
      contract Leaf {
        function read(uint256 value) public pure returns (uint256) { return value + 7; }
      }`, KERNEL);
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, {}, { saltContract: true },
    );
    const leaf = StatefulContract.withCategory(
      leafBase.withCategory(hexToBin(leafSetup.categoryId)), leafSetup.categoryId,
    );

    const rootArtifact = compileString(`pragma solidity ^0.8.0;
      interface Reader { function read(uint256 value) external view returns (uint256); }
      contract Root(address leaf) {
        function read(uint256 value) public view returns (uint256) {
          return Reader(leaf).read(value);
        }
      }`, KERNEL);
    const rootBase = new Contract(rootArtifact, [leaf.inner.lockingBytecode], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );

    for (const artifact of [rootArtifact, leafArtifact]) {
      const bus = artifact.messageBus!;
      const layout = bus.route.blockLayout!;
      // The route commits its complete result vector to one output-only return slot; per-row return slots are
      // deliberately not reserved, because they would pad every returning route with inert outputs. The block is
      // therefore the master slot plus that single return slot, and both stay local to this participant.
      expect(layout.slots).toEqual([
        { kind: 'master', offset: 0 },
        { kind: 'returnEvent', offset: 1 },
      ]);
      expect(layout.blockSize).toBe(layout.slots.length);
    }

    const callsiteId = rootArtifact.abi.find((entry) => entry.name === 'read')!
      .externalCalls!.find((call) => call.functionName === 'read')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const builder = await messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'read', args: [3n] },
        { contract: leaf, functionName: 'read', args: [3n], callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();

    const transaction = builder.buildLibauthTransaction();
    const participants = [
      { artifact: rootArtifact, categoryId: rootSetup.categoryId },
      { artifact: leafArtifact, categoryId: leafSetup.categoryId },
    ];
    for (const { artifact, categoryId } of participants) {
      const routeInputIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
        && input.unlocker.contract.artifact.contractName === artifact.contractName
        && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
      expect(routeInputIndex).toBeGreaterThanOrEqual(0);
      const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
      if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no parameters');
      const returnWitnessIndex = artifact.messageBus!.route.inputs.findIndex(
        (input) => input.name === '__internal__returnOutputIdx',
      );
      expect(returnWitnessIndex).toBeGreaterThanOrEqual(0);
      const absoluteReturnOutputIndex = routeInputIndex + 1;
      expect(routeUnlocker.params[returnWitnessIndex]).toBe(BigInt(absoluteReturnOutputIndex));
      expect(transaction.outputs[absoluteReturnOutputIndex].token).toMatchObject({
        category: hexToBin(categoryId),
        nft: { capability: 'none' },
      });
    }

    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
  }, 120_000);

  it('binds a nested route dynamic-read union to its physical chunk inputs', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const storeArtifact = compileString(`pragma solidity ^0.8.0;
      contract Store {
        string label;
        uint256 counter;
        function setLabel(string memory value) public { label = value; require(true); }
        function bump() public { counter += 1; require(true); }
        function readLabel() public view returns (string memory) { return label; }
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

    const routeInputIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Store'
      && input.unlocker.abiFunction.name === storeArtifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no parameters');
    const dynamicBasePosition = storeArtifact.messageBus!.route.inputs.findIndex(
      (input) => input.name === '__internal__dynamicChunkInputBase',
    );
    expect(dynamicBasePosition).toBeGreaterThanOrEqual(0);
    expect(typeof routeUnlocker.params[dynamicBasePosition]).toBe('bigint');
    const layout = storeArtifact.messageBus!.route.blockLayout!;
    const expected = resolveParticipantAbsoluteWitnesses({
      participant: 0,
      publishedBase: routeInputIndex,
      blockSize: layout.blockSize,
      trailingBase: layout.trailingBase!,
      trailingCapacity: layout.trailingCapacity,
      dynChunkCount: 1,
    });
    const dynamicBase = Number(expected.dynamicChunkInputBase);
    expect(decodeLayoutCoordinate(routeUnlocker.params[dynamicBasePosition] as bigint)).toEqual({
      kind: 'inactive', preservedIndex: dynamicBase,
    });
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    expect(sourceOutputs[dynamicBase]?.token).toMatchObject({
      category: hexToBin(storeSetup.categoryId),
      nft: { capability: 'mutable' },
    });
  }, 120_000);
});
