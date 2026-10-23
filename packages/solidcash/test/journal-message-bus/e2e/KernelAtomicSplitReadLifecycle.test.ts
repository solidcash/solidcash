import { hexToBin } from '@bitauth/libauth';
import { type Artifact } from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  type TransactionBuilder,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  try {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
      vm.evaluate({ inputIndex, sourceOutputs, transaction }),
    ) === true);
  } catch {
    return false;
  }
};

/**
 * Read-bearing resource-free split preserves the fixed dataNft prefix while creating empty minting masters.
 */
describe('kernel atomic split read lifecycle compose', () => {
  it('admits and settles split(2) that reads fixed state under messageBus.compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`
      interface IThreads { function forkThreads(string label, int count); }
      interface IIdle { function idle(); }
      contract Coordinator(address threads) {
        function run(int count) public {
          IThreads(threads).forkThreads("run", count);
          require(count > 0);
        }
        function idle() public { require(true); }
      }
      contract Threads() {
        int public marker;
        function forkThreads(string label, int count) public split(count) {
          require(this.marker > 0 && label.length > 0 && count > 0);
        }
        function callerBound(address target) public {
          IIdle(target).idle();
          require(msg.sender == msg.sender);
        }
      }
    `, KERNEL);

    const fork = artifacts.Threads.messageBus?.handlers.find((handler) => handler.name === 'forkThreads');
    expect(fork).toMatchObject({
      eligible: true,
      lifecycleTopology: {
        version: 2,
        kind: 'split',
        resourcePrefix: { mode: 'preserve', dataNftCount: 1, nftIndices: [0] },
      },
    });
    expect(artifacts.Threads.messageBus?.verifierProgram?.lifecycle).toBe(true);
    expect(artifacts.Threads.abi.find((fn) => fn.name === 'forkThreads')?.blockLayout?.blockSize).toBe(2);

    const connect = async (
      artifact: Artifact,
      args: readonly unknown[] = [],
      stateValues: Record<string, bigint> = {},
    ): Promise<{
      contract: StatefulContract; category: string;
    }> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, stateValues, { saltContract: true },
      );
      return {
        contract: StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId),
        category: setup.categoryId,
      };
    };
    const threads = await connect(artifacts.Threads, [], { marker: 1n });
    const coordinator = await connect(artifacts.Coordinator, [hexToBin(threads.contract.inner.lockingBytecode)]);

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const first = await createBareP2pkhFeeFunder(provider, 2_000n);
    const second = await createBareP2pkhFeeFunder(provider, 3_000n);
    const canonical = await messageBus.compose({
      preparedCalls: [
        { contract: coordinator.contract, functionName: 'run', args: [2n] },
        { contract: threads.contract, functionName: 'forkThreads', args: ['run', 2n] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      lifecycleSplits: [{
        invocationIndex: 1, funders: [first, second], createdValues: [1_000n, 1_500n],
      }],
    }).build();
    expect(vmAccepts(canonical)).toBe(true);

    const createdAmounts = canonical.outputs
      .filter((output) => output.token?.category === threads.category
        && output.token.nft?.capability === 'minting'
        && (output.token.nft.commitment ?? '') === ''
        && (output.amount === 1_000n || output.amount === 1_500n))
      .map((output) => output.amount)
      .sort((left, right) => Number(left - right));
    expect(createdAmounts).toEqual([1_000n, 1_500n]);

    const dataInput = canonical.inputs.find((input) =>
      input.token?.category === threads.category && input.token.nft?.capability === 'mutable');
    const dataOutput = canonical.outputs.find((output) =>
      output.token?.category === threads.category && output.token.nft?.capability === 'mutable');
    expect(dataInput).toBeDefined();
    expect(dataOutput).toBeDefined();
    expect(dataOutput!.token!.nft!.commitment).toBe(dataInput!.token!.nft!.commitment);
    expect(dataOutput!.amount).toBe(dataInput!.satoshis);
  }, 180_000);
});
