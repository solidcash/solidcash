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
 * Read-bearing merge preserves the fixed dataNft prefix on the surviving master. Consumed masters take the
 * route non-dispatch arm (after the prefix) so they do not re-enter the handler body.
 */
describe('kernel atomic merge read lifecycle compose', () => {
  it('admits and settles merge(2) that reads fixed state under messageBus.compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`
      interface IThreads { function combine(bytes32 tag, int count); }
      interface IIdle { function idle(); }
      contract Coordinator(address threads) {
        function run(bytes32 tag, int count) public {
          IThreads(threads).combine(tag, count);
          require(count > 0);
        }
        function rest() public { require(true); }
      }
      contract Threads() {
        int public marker;
        function combine(bytes32 tag, int count) public merge(count) {
          require(this.marker > 0 && count > 0);
        }
        function idle() public { require(true); }
      }
    `, KERNEL);

    const combine = artifacts.Threads.messageBus?.handlers.find((handler) => handler.name === 'combine');
    expect(combine).toMatchObject({
      eligible: true,
      lifecycleTopology: {
        version: 2,
        kind: 'merge',
        resourcePrefix: { mode: 'preserve', dataNftCount: 1, nftIndices: [0] },
      },
    });
    expect(artifacts.Threads.messageBus?.verifierProgram?.lifecycle).toBe(true);
    expect(artifacts.Threads.abi.find((fn) => fn.name === 'combine')?.blockLayout?.blockSize).toBe(2);

    const connect = async (
      artifact: Artifact,
      args: readonly unknown[] = [],
      stateValues: Record<string, bigint> = {},
    ): Promise<{ contract: StatefulContract; category: string }> => {
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
    const consumed = (ordinal: number, amount: bigint): Utxo => ({
      txid: ordinal.toString(16).padStart(64, '0'), vout: ordinal, satoshis: 2_000n + BigInt(ordinal),
      token: {
        category: threads.category, amount,
        nft: { capability: 'minting', commitment: ordinal.toString(16).padStart(2, '0') },
      },
    });
    const inputs = [consumed(17, 3n), consumed(18, 5n)];
    const tag = sha256(new TextEncoder().encode('merge-read'));
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
    expect(mergeBase).toBeGreaterThanOrEqual(0);
    expect(canonical.outputs[mergeBase].token?.amount).toBe(8n);

    const dataOffset = mergeBase + 1;
    expect(canonical.inputs[dataOffset].token?.nft?.capability).toBe('mutable');
    expect(canonical.outputs[dataOffset].token?.nft?.capability).toBe('mutable');
    expect(canonical.outputs[dataOffset].token!.nft!.commitment)
      .toBe(canonical.inputs[dataOffset].token!.nft!.commitment);
  }, 180_000);
});
