import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts as vmAccepts } from './vm-accepts.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

const commitmentNonEmpty = (commitment: Uint8Array | string | undefined): boolean => {
  if (commitment === undefined) return false;
  const bytes = typeof commitment === 'string' ? hexToBin(commitment) : commitment;
  return bytes.length > 0 && !bytes.every((byte) => byte === 0);
};

describe('kernel three-hop return compose', () => {
  it('materializes non-empty return commitments across Leaf→Mid→Root', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const leafArtifact = compileString(`pragma solidity ^0.8.0;
      contract Leaf {
        function read(uint256 value) public pure returns (uint256) { return value + 1; }
      }`, KERNEL);
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, {}, { saltContract: true },
    );
    const leaf = StatefulContract.withCategory(
      leafBase.withCategory(hexToBin(leafSetup.categoryId)), leafSetup.categoryId,
    );

    const midArtifact = compileString(`pragma solidity ^0.8.0;
      interface ILeaf { function read(uint256 value) external view returns (uint256); }
      contract Mid(address leaf) {
        function read(uint256 value) public view returns (uint256) {
          return ILeaf(leaf).read(value) + 2;
        }
      }`, KERNEL);
    const midBase = new Contract(midArtifact, [leaf.inner.lockingBytecode], { provider });
    const midSetup = await setupStatefulUtxos(
      provider, midBase, midArtifact.stateLayout!, {}, { saltContract: true },
    );
    const mid = StatefulContract.withCategory(
      midBase.withCategory(hexToBin(midSetup.categoryId)), midSetup.categoryId,
    );

    const rootArtifact = compileString(`pragma solidity ^0.8.0;
      interface IMid { function read(uint256 value) external view returns (uint256); }
      contract Root(address mid) {
        function read(uint256 value) public view returns (uint256) {
          return IMid(mid).read(value) + 4;
        }
      }`, KERNEL);
    const rootBase = new Contract(rootArtifact, [mid.inner.lockingBytecode], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );

    const rootToMid = rootArtifact.abi.find((entry) => entry.name === 'read')!
      .externalCalls!.find((call) => call.functionName === 'read')!.callsiteId!;
    const midToLeaf = midArtifact.abi.find((entry) => entry.name === 'read')!
      .externalCalls!.find((call) => call.functionName === 'read')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'read', args: [3n] },
        { contract: mid, functionName: 'read', args: [3n], callsiteId: rootToMid },
        { contract: leaf, functionName: 'read', args: [3n], callsiteId: midToLeaf },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const transaction = builder.buildLibauthTransaction();
    const participants = [
      { artifact: rootArtifact, categoryId: rootSetup.categoryId, name: 'Root' },
      { artifact: midArtifact, categoryId: midSetup.categoryId, name: 'Mid' },
      { artifact: leafArtifact, categoryId: leafSetup.categoryId, name: 'Leaf' },
    ];
    for (const { artifact, categoryId, name } of participants) {
      const routeInputIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
        && input.unlocker.contract.artifact.contractName === artifact.contractName
        && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
      expect(routeInputIndex, name).toBeGreaterThanOrEqual(0);
      const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
      if (!('params' in routeUnlocker)) throw new Error(`${name} route has no parameters`);
      const returnWitnessIndex = artifact.messageBus!.route.inputs.findIndex(
        (input) => input.name === '__internal__returnOutputIdx',
      );
      expect(returnWitnessIndex, name).toBeGreaterThanOrEqual(0);
      const absoluteReturn = Number(routeUnlocker.params[returnWitnessIndex] as bigint);
      expect(absoluteReturn, name).toBeGreaterThanOrEqual(0);
      const returnOutput = transaction.outputs[absoluteReturn];
      expect(returnOutput.token).toMatchObject({
        category: hexToBin(categoryId),
        nft: { capability: 'none' },
      });
      expect(commitmentNonEmpty(returnOutput.token?.nft?.commitment), name).toBe(true);
      expect(binToHex(returnOutput.token!.nft!.commitment as Uint8Array)).not.toMatch(/^0+$/);
    }

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 180_000);
});
