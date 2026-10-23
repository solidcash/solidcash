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
 * Resource-free split rows publish selector-derived lifecycle authority. Compose authenticates
 * funding/created-master cardinality without serializing a V3 lifecycle transcript into the manifest.
 */
describe('kernel atomic split lifecycle compose', () => {
  it('admits and settles split(2) under messageBus.compose with observable created masters', async () => {
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
        function forkThreads(string label, int count) public split(count) {
          require(label.length > 0 && count > 0);
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
      lifecycleTopology: { version: 2, kind: 'split' },
    });
    expect(artifacts.Threads.messageBus?.verifierProgram?.lifecycle).toBe(true);
    expect(artifacts.Threads.messageBus?.atomicMessageBus?.protocolVersions).not.toContain(3);
    expect(artifacts.Threads.messageBus?.handlers.find((handler) => handler.name === 'callerBound'))
      .toMatchObject({ eligible: true });

    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<{
      contract: StatefulContract; category: string;
    }> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return {
        contract: StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId),
        category: setup.categoryId,
      };
    };
    const threads = await connect(artifacts.Threads);
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

    // Created masters are empty-commitment minting NFTs funded at the declared values. The preserved
    // master may also carry an empty commitment, so pin by funded satoshi amounts.
    const createdAmounts = canonical.outputs
      .filter((output) => output.token?.category === threads.category
        && output.token.nft?.capability === 'minting'
        && (output.token.nft.commitment ?? '') === ''
        && (output.amount === 1_000n || output.amount === 1_500n))
      .map((output) => output.amount)
      .sort((left, right) => Number(left - right));
    expect(createdAmounts).toEqual([1_000n, 1_500n]);

    const neutralFee = await createBareP2pkhFeeFunder(provider, 500_000n);
    await expect(messageBus.compose({
      preparedCalls: [
        {
          contract: threads.contract, functionName: 'callerBound',
          args: [hexToBin(coordinator.contract.inner.lockingBytecode)],
        },
        { contract: coordinator.contract, functionName: 'idle', args: [] },
      ],
      funder: neutralFee,
      changeAddress: neutralFee.unlocker.generateLockingBytecode(),
    }).build()).resolves.toBeTruthy();
  }, 180_000);

  it('refuses two split participants sharing one funding outpoint before VM', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`
      interface IA { function forkA(int count); }
      interface IB { function forkB(int count); }
      contract Root(address a, address b) {
        function run() public { IA(a).forkA(1); IB(b).forkB(1); require(true); }
      }
      contract A() { function forkA(int count) public split(count) { require(count > 0); } }
      contract B() { function forkB(int count) public split(count) { require(count > 0); } }
    `, KERNEL);

    for (const name of ['forkA', 'forkB'] as const) {
      const artifact = name === 'forkA' ? artifacts.A : artifacts.B;
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name)).toMatchObject({
        eligible: true,
        lifecycleTopology: { kind: 'split' },
      });
      expect(artifact.messageBus?.verifierProgram?.lifecycle).toBe(true);
    }

    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const a = await connect(artifacts.A);
    const b = await connect(artifacts.B);
    const root = await connect(artifacts.Root, [
      hexToBin(a.inner.lockingBytecode), hexToBin(b.inner.lockingBytecode),
    ]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const shared = await createBareP2pkhFeeFunder(provider, 4_000n);
    await expect(messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'run', args: [] },
        { contract: a, functionName: 'forkA', args: [1n] },
        { contract: b, functionName: 'forkB', args: [1n] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      lifecycleSplits: [
        { invocationIndex: 1, funders: [shared], createdValues: [1_000n] },
        { invocationIndex: 2, funders: [shared], createdValues: [1_000n] },
      ],
    }).build()).rejects.toThrow(/unique|duplicate|shared|outpoint/i);
  }, 180_000);
});
