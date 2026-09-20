import { hexToBin } from '@bitauth/libauth';
import { sha256, type Artifact } from '@solidcash/utils';
import { compileStringMulti } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus, type Utxo } from '../../../src/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

/**
 * Atomic merge changes participant cardinality. Diagnostic `lifecycleTopology` is published, but
 * the handler stays `KERNEL_LIFECYCLE`-ineligible until selector-derived authority and the full
 * input/output topology are authenticated, so compose fails closed before VM evaluation.
 */
describe('kernel atomic merge lifecycle compose fence', () => {
  it('compiles topology metadata then refuses messageBus.compose for merge', async () => {
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
      eligible: false,
      rejectionReason: 'KERNEL_LIFECYCLE',
      lifecycleTopology: { version: 2, kind: 'merge' },
    });
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

    await expect(messageBus.compose({
      preparedCalls: [
        { contract: coordinator.contract, functionName: 'run', args: [tag, 2n] },
        { contract: threads.contract, functionName: 'combine', args: [tag, 2n] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      lifecycleMerges: [{ invocationIndex: 1, consumedMasters: inputs }],
    }).build()).rejects.toThrow(
      /no compiled route|does not advertise selector-derived authority|KERNEL_LIFECYCLE/,
    );

    const ordinary = await messageBus.compose({
      preparedCalls: [
        { contract: coordinator.contract, functionName: 'rest', args: [] },
        { contract: threads.contract, functionName: 'idle', args: [] },
      ],
      funder: await createBareP2pkhFeeFunder(provider, 500_000n),
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();
    expect(ordinary.inputs.length).toBeGreaterThan(0);

    const wrong = { ...inputs[0], token: { ...inputs[0].token!, category: 'cd'.repeat(32) } };
    await expect(messageBus.compose({
      preparedCalls: [
        { contract: coordinator.contract, functionName: 'run', args: [tag, 2n] },
        { contract: threads.contract, functionName: 'combine', args: [tag, 2n] },
      ],
      funder: await createBareP2pkhFeeFunder(provider, 500_000n),
      changeAddress: fee.unlocker.generateLockingBytecode(),
      lifecycleMerges: [{ invocationIndex: 1, consumedMasters: [wrong, inputs[1]] }],
    }).build()).rejects.toThrow(
      /no compiled route|does not advertise selector-derived authority|KERNEL_LIFECYCLE/,
    );
  }, 180_000);
});
