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
  try {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    return transaction.inputs.every((_input, inputIndex) => {
      const result = vm.evaluate({ inputIndex, sourceOutputs, transaction }) as { error?: string };
      return result.error === undefined;
    });
  } catch {
    return false;
  }
};

/**
 * I4: Mid local scalar write beside sibling outState under recipe.
 *
 * Anchors:
 * - `KernelSiblingOutStateCompose` — Mid projects Leaf.outState (no Mid local write) green.
 * - Mid local write without outState (below) green.
 * - Combined shape uses complete-graph discovery of the exact write (`seen = projected`),
 *   without inferring an assignment from the visible integer argument.
 */
describe('kernel sibling outState + Mid local scalar', () => {
  it('settles Mid local write without outState under recipe', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const leafArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Leaf() {
        int stored;
        function write(int next) public { this.stored = next; require(true); }
      }`, KERNEL);
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, { stored: 0n }, { saltContract: true },
    );
    const leaf = StatefulContract.withCategory(
      leafBase.withCategory(hexToBin(leafSetup.categoryId)), leafSetup.categoryId,
    );

    const midArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ILeaf { function write(int next) external; }
      contract Mid() {
        int seen;
        function writeThenMark(address leaf, int next) public {
          ILeaf(leaf).write(next);
          this.seen = next;
          require(true);
        }
      }`, KERNEL);
    expect(midArtifact.messageBus?.handlers.find((entry) => entry.name === 'writeThenMark'))
      .toMatchObject({ eligible: true });
    const midBase = new Contract(midArtifact, [], { provider });
    const midSetup = await setupStatefulUtxos(
      provider, midBase, midArtifact.stateLayout!, { seen: 0n }, { saltContract: true },
    );
    const mid = StatefulContract.withCategory(
      midBase.withCategory(hexToBin(midSetup.categoryId)), midSetup.categoryId,
    );

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const builder = await messageBus.compose({
      calls: [
        mid.call.writeThenMark(leaf.inner.lockingBytecode, 17n),
        leaf.call.write(17n),
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();
    const mutable = builder.outputs
      .filter((output) => output.token?.nft?.capability === 'mutable')
      .map((output) => output.token!.nft!.commitment);
    expect(mutable.filter((commitment) => commitment === '0111')).toHaveLength(2);
  }, 180_000);

  it('settles Mid.seen beside Leaf.outState under recipe', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const leafArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Leaf() {
        int stored;
        function write(int next) public { this.stored = next; require(true); }
      }`, KERNEL);
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, { stored: 0n }, { saltContract: true },
    );
    const leaf = StatefulContract.withCategory(
      leafBase.withCategory(hexToBin(leafSetup.categoryId)), leafSetup.categoryId,
    );

    const midArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ILeaf {
        public int stored;
        function write(int next) external;
      }
      contract Mid() {
        int seen;
        function writeThenSee(address leaf, int next) public {
          ILeaf(leaf).write(next);
          int projected = ILeaf(leaf).outState.stored;
          this.seen = projected;
          require(projected == next);
          require(true);
        }
      }`, KERNEL);
    expect(midArtifact.messageBus?.handlers.find((entry) => entry.name === 'writeThenSee'))
      .toMatchObject({ eligible: true });
    const midBase = new Contract(midArtifact, [], { provider });
    const midSetup = await setupStatefulUtxos(
      provider, midBase, midArtifact.stateLayout!, { seen: 0n }, { saltContract: true },
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
    const mutable = builder.outputs
      .filter((output) => output.token?.nft?.capability === 'mutable')
      .map((output) => output.token!.nft!.commitment);
    expect(mutable.filter((commitment) => commitment === '0111')).toHaveLength(2);
    expect(vmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await mid.getState()).seen).toBe(17n);
    expect((await leaf.getState()).stored).toBe(17n);
  }, 180_000);
});
