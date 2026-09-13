import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
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

    const localReturnBlock = {
      blockSize: 2,
      slots: [{ kind: 'master', offset: 0 }, { kind: 'returnEvent', offset: 1 }],
    };
    expect(rootArtifact.messageBus?.route.blockLayout).toMatchObject(localReturnBlock);
    expect(leafArtifact.messageBus?.route.blockLayout).toMatchObject(localReturnBlock);

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
});
