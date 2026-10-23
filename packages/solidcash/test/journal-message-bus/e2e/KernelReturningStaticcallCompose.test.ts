import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
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

describe('kernel returning staticcall / view compose', () => {
  it('settles value-returning foreign view consume under kernel compose', async () => {
    // Equivalent returning view compose: Root consumes Leaf.read's return (criterion 3b).
    // Explicit `.staticcall(args)` still OP_VERIFYs under kernel compose; void .staticcall settles in L5.
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
      interface ILeaf { function read(uint256 value) external view returns (uint256); }
      contract Root(address leaf) {
        function check(uint256 value) public {
          uint256 got = ILeaf(leaf).read(value);
          require(got == value + 7);
        }
      }`, KERNEL);
    const rootBase = new Contract(rootArtifact, [leaf.inner.lockingBytecode], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );
    const callsiteId = rootArtifact.abi.find((entry) => entry.name === 'check')!
      .externalCalls!.find((call) => call.functionName === 'read')!.callsiteId!;
    const result = hexToBin(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [10n]).slice(2));
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'check', args: [3n] },
        {
          contract: leaf,
          functionName: 'read',
          args: [3n],
          callsiteId,
          provisionalResultCommitment: result,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const leafRoute = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Leaf'
      && input.unlocker.abiFunction.name === leafArtifact.messageBus!.route.name);
    expect(leafRoute).toBeGreaterThanOrEqual(0);
    const unlocker = builder.inputs[leafRoute].unlocker;
    if (!('params' in unlocker)) throw new Error('leaf route missing params');
    const returnIdx = leafArtifact.messageBus!.route.inputs.findIndex(
      (input) => input.name === '__internal__returnOutputIdx',
    );
    expect(returnIdx).toBeGreaterThanOrEqual(0);
    const absoluteReturn = Number(unlocker.params[returnIdx] as bigint);
    expect(absoluteReturn).toBeGreaterThanOrEqual(0);
    const commitment = builder.buildLibauthTransaction().outputs[absoluteReturn]?.token?.nft?.commitment;
    expect(commitment).toBeDefined();
    const commitmentHex = typeof commitment === 'string' ? commitment : binToHex(commitment!);
    expect(commitmentHex.length).toBeGreaterThan(0);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 120_000);

  it('SDK .staticCall() returns the live view value on a kernel contract', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Counter {
        uint256 value;
        function set(uint256 next) public { value = next; require(true); }
        function get() public view returns (uint256) { return value; }
      }`, KERNEL);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, { value: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    await sc.call.set(42n).send();
    await expect(sc.call.get().staticCall()).resolves.toBe(42n);
  }, 120_000);
});
