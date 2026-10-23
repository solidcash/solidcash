import { hexToBin } from '@bitauth/libauth';
import { sha256, type Artifact } from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  type TransactionBuilder,
  type Utxo,
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
 * Resource-free merge rows publish selector-derived lifecycle authority. Compose authenticates
 * consumed-master cardinality and consolidates token amounts onto the surviving master.
 */
describe('kernel atomic merge lifecycle compose', () => {
  it('admits and settles merge(2) under messageBus.compose with consolidated survivor amount', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`
      interface IThreads {
        function combine(bytes32 tag, int count);
        function idle();
      }
      contract Coordinator(address threads) {
        function run(bytes32 tag, int count) public {
          IThreads(threads).combine(tag, count);
          require(count > 0);
        }
        function rest() public {
          IThreads(threads).idle();
          require(true);
        }
      }
      contract Threads() {
        function combine(bytes32 tag, int count) public merge(count) {
          require(true);
        }
        function idle() public { require(true); }
      }
    `, KERNEL);

    const combine = artifacts.Threads.messageBus?.handlers.find((handler) => handler.name === 'combine');
    expect(combine).toMatchObject({
      eligible: true,
      lifecycleTopology: { version: 2, kind: 'merge' },
    });
    expect(artifacts.Threads.messageBus?.verifierProgram?.lifecycle).toBe(true);
    expect(artifacts.Threads.messageBus?.atomicMessageBus?.protocolVersions).not.toContain(3);
    expect(artifacts.Threads.messageBus?.handlers.find((handler) => handler.name === 'idle'))
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
    const consumed = (ordinal: number, amount: bigint): Utxo => ({
      txid: ordinal.toString(16).padStart(64, '0'), vout: ordinal, satoshis: 2_000n + BigInt(ordinal),
      token: {
        category: threads.category, amount,
        nft: { capability: 'minting', commitment: ordinal.toString(16).padStart(2, '0') },
      },
    });
    const inputs = [consumed(17, 3n), consumed(18, 5n)];
    const tag = sha256(new TextEncoder().encode('merge'));
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);

    const canonical = await messageBus.compose({
      preparedCalls: [
        { contract: coordinator.contract, functionName: 'run', args: [tag, 2n] },
        { contract: threads.contract, functionName: 'combine', args: [tag, 2n] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      lifecycleMerges: [{ invocationIndex: 1, consumedMasters: inputs }],
    }).build();
    expect(vmAccepts(canonical)).toBe(true);

    const mergeBase = canonical.inputs.findIndex((input) =>
      input.token?.category === threads.category && input.token.nft?.capability === 'minting');
    expect(mergeBase).toBeGreaterThan(0);
    expect(canonical.outputs[mergeBase].token?.amount).toBe(8n);
    expect(canonical.outputs.slice(mergeBase + 1, mergeBase + 3).every((output) => output.token === undefined))
      .toBe(true);

    const ordinary = await messageBus.compose({
      preparedCalls: [
        { contract: coordinator.contract, functionName: 'rest', args: [] },
        { contract: threads.contract, functionName: 'idle', args: [] },
      ],
      funder: await createBareP2pkhFeeFunder(provider, 500_000n),
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();
    expect(ordinary.inputs.length).toBeGreaterThan(0);
    expect(vmAccepts(ordinary)).toBe(true);

    const wrong = { ...inputs[0], token: { ...inputs[0].token!, category: 'cd'.repeat(31) + '32' } };
    await expect(messageBus.compose({
      preparedCalls: [
        { contract: coordinator.contract, functionName: 'run', args: [tag, 2n] },
        { contract: threads.contract, functionName: 'combine', args: [tag, 2n] },
      ],
      funder: await createBareP2pkhFeeFunder(provider, 500_000n),
      changeAddress: fee.unlocker.generateLockingBytecode(),
      lifecycleMerges: [{ invocationIndex: 1, consumedMasters: [wrong, inputs[1]] }],
    }).build()).rejects.toThrow(/exact category master|category/);
  }, 180_000);
});
