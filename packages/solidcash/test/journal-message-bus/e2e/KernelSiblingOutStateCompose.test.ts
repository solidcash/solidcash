import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
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

describe('kernel sibling outState under composition', () => {
  it('Mid projects Leaf.outState after Leaf.write in the same compose graph', async () => {
    // Cross-contract outState: Mid observes Leaf's post-write (PreCall is same shape with Register names).
    const provider = createMessageBusCapstoneTestProvider();

    const leafArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Leaf() {
        int stored;
        function write(int next) public {
          this.stored = next;
          require(true);
        }
      }`, KERNEL);
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, { stored: 0n }, { saltContract: true },
    );
    const leaf = StatefulContract.withCategory(
      leafBase.withCategory(hexToBin(leafSetup.categoryId)), leafSetup.categoryId,
    );

    // Match KernelPreCallOutStateCompose storeThenCompare: Mid projects Leaf.outState after the
    // shared write under recipe (no Mid local scalar write — that path still needs
    // VM repair under VM-validator-only finalization).
    const midArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ILeaf {
        public int stored;
        function write(int next) external;
      }
      contract Mid() {
        function writeThenSee(address leaf, int next) public {
          ILeaf(leaf).write(next);
          int projected = ILeaf(leaf).outState.stored;
          require(projected == next);
          require(true);
        }
      }`, KERNEL);
    expect(midArtifact.messageBus?.handlers.find((entry) => entry.name === 'writeThenSee'))
      .toMatchObject({ eligible: true });
    const midBase = new Contract(midArtifact, [], { provider });
    const midSetup = await setupStatefulUtxos(
      provider, midBase, midArtifact.stateLayout!, {}, { saltContract: true },
    );
    const mid = StatefulContract.withCategory(
      midBase.withCategory(hexToBin(midSetup.categoryId)), midSetup.categoryId,
    );

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      calls: [
        mid.call.writeThenSee(leaf.inner.lockingBytecode, 17n),
        leaf.call.write(17n),
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const midRoute = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Mid'
      && input.unlocker.abiFunction.name === midArtifact.messageBus!.route.name);
    const leafRoute = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Leaf'
      && input.unlocker.abiFunction.name === leafArtifact.messageBus!.route.name);
    expect(midRoute).toBeGreaterThanOrEqual(0);
    expect(leafRoute).toBeGreaterThanOrEqual(0);
    expect(midRoute).not.toBe(leafRoute);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await leaf.getState()).stored).toBe(17n);
  }, 180_000);
});
