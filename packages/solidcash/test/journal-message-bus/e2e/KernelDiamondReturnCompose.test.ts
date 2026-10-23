/**
 * Diamond return fan-in at Root.
 * Root reads Left and Right (two returning view callees) and combines their returns.
 * Shared-category Mid→Leaf dual-invoke remains a deeper residual; this cell covers return fan-in.
 */
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

describe('kernel diamond return compose', () => {
  it('materializes non-empty returns on Root fan-in of Left+Right view callees', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const mkPure = async (name: string, addend: number): Promise<{
      artifact: ReturnType<typeof compileString>;
      contract: StatefulContract;
      setup: Awaited<ReturnType<typeof setupStatefulUtxos>>;
    }> => {
      const artifact = compileString(`pragma solidity ^0.8.0;
        contract ${name} {
          function read(uint256 value) public pure returns (uint256) { return value + ${addend}; }
        }`, KERNEL);
      const base = new Contract(artifact, [], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, {}, { saltContract: true },
      );
      const contract = StatefulContract.withCategory(
        base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
      );
      return { artifact, contract, setup };
    };
    const left = await mkPure('Left', 2);
    const right = await mkPure('Right', 4);

    const rootArtifact = compileString(`pragma solidity ^0.8.0;
      interface ILeft { function read(uint256 value) external view returns (uint256); }
      interface IRight { function read(uint256 value) external view returns (uint256); }
      contract Root(address left, address right) {
        function read(uint256 value) public view returns (uint256) {
          return ILeft(left).read(value) + IRight(right).read(value);
        }
      }`, KERNEL);
    const rootBase = new Contract(
      rootArtifact,
      [left.contract.inner.lockingBytecode, right.contract.inner.lockingBytecode],
      { provider },
    );
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );

    const rootCalls = rootArtifact.abi.find((entry) => entry.name === 'read')!.externalCalls!;
    expect(rootCalls.length).toBeGreaterThanOrEqual(2);
    const rootToLeft = rootCalls[0]!.callsiteId!;
    const rootToRight = rootCalls[1]!.callsiteId!;

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'read', args: [3n] },
        { contract: left.contract, functionName: 'read', args: [3n], callsiteId: rootToLeft },
        { contract: right.contract, functionName: 'read', args: [3n], callsiteId: rootToRight },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(builder.inputs.length).toBeGreaterThanOrEqual(3);
    expect(rootArtifact.messageBus?.handlers.find((handler) => handler.name === 'read')?.eligible)
      .toBe(true);
    expect(vmAccepts(builder)).toBe(true);

    const transaction = builder.buildLibauthTransaction();
    for (const { artifact, categoryId, name } of [
      { artifact: rootArtifact, categoryId: rootSetup.categoryId, name: 'Root' },
      { artifact: left.artifact, categoryId: left.setup.categoryId, name: 'Left' },
      { artifact: right.artifact, categoryId: right.setup.categoryId, name: 'Right' },
    ]) {
      const routeInputIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
        && input.unlocker.contract.artifact.contractName === artifact.contractName
        && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
      expect(routeInputIndex, name).toBeGreaterThanOrEqual(0);
      const routeUnlocker = builder.inputs[routeInputIndex]!.unlocker;
      if (!('params' in routeUnlocker)) throw new Error(`${name} route has no parameters`);
      const returnWitnessIndex = artifact.messageBus!.route.inputs.findIndex(
        (input) => input.name === '__internal__returnOutputIdx',
      );
      expect(returnWitnessIndex, name).toBeGreaterThanOrEqual(0);
      const absoluteReturn = Number(routeUnlocker.params[returnWitnessIndex]! as bigint);
      expect(absoluteReturn, name).toBeGreaterThanOrEqual(0);
      const returnOutput = transaction.outputs[absoluteReturn]!;
      expect(returnOutput.token, name).toMatchObject({
        category: hexToBin(categoryId),
        nft: { capability: 'none' },
      });
      expect(commitmentNonEmpty(returnOutput.token?.nft?.commitment), `${name} return`).toBe(true);
    }
    void binToHex;
  }, 180_000);
});
