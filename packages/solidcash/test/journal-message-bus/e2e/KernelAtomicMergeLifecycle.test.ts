import { hexToBin } from '@bitauth/libauth';
import { sha256, type Artifact } from '@solidcash/utils';
import { compileStringMulti } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, StatefulContract, messageBus, type ContractUnlocker, type TransactionBuilder, type Utxo,
} from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

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

// Post-beta protocol work: merge changes participant cardinality and remains fenced as KERNEL_LIFECYCLE until
// selector-derived authority and the complete input/output topology are authenticated by the row protocol.
describe.skip('kernel atomic merge lifecycle (post-beta)', () => {
  it('consumes exact category masters with non-dispatch tails and preserves one survivor', async () => {
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
    `, { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
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

    const originalCategory = canonical.inputs[mergeBase + 1].token!.category;
    canonical.inputs[mergeBase + 1].token!.category = 'ab'.repeat(32);
    expect(vmAccepts(canonical)).toBe(false);
    canonical.inputs[mergeBase + 1].token!.category = originalCategory;

    const originalCapability = canonical.inputs[mergeBase + 1].token!.nft!.capability;
    canonical.inputs[mergeBase + 1].token!.nft!.capability = 'mutable';
    expect(vmAccepts(canonical)).toBe(false);
    canonical.inputs[mergeBase + 1].token!.nft!.capability = originalCapability;

    const originalTailUnlocker = canonical.inputs[mergeBase + 1].unlocker;
    canonical.inputs[mergeBase + 1].unlocker = {
      ...originalTailUnlocker,
      generateLockingBytecode: () => Uint8Array.of(0x51),
    };
    expect(vmAccepts(canonical)).toBe(false);
    canonical.inputs[mergeBase + 1].unlocker = originalTailUnlocker;

    const routeUnlocker = originalTailUnlocker as ContractUnlocker;
    const ownerParameter = routeUnlocker.abiFunction.inputs.findIndex(
      (input) => input.name === '__internal__lifecycleOwnerInput',
    );
    expect(ownerParameter).toBeGreaterThanOrEqual(0);
    const replayArgs = [...routeUnlocker.params];
    replayArgs[ownerParameter] = BigInt(mergeBase + 1);
    canonical.inputs[mergeBase + 1].unlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin('53434231'),
    )(...replayArgs);
    expect(vmAccepts(canonical)).toBe(false);
    canonical.inputs[mergeBase + 1].unlocker = originalTailUnlocker;

    const survivorToken = canonical.outputs[mergeBase].token!;
    canonical.outputs[mergeBase].token = { ...survivorToken, amount: 7n };
    canonical.outputs[mergeBase + 1].token = {
      category: threads.category, amount: 1n,
    };
    expect(vmAccepts(canonical)).toBe(false);
    canonical.outputs[mergeBase].token = survivorToken;
    delete canonical.outputs[mergeBase + 1].token;

    const originalSurvivorCategory = survivorToken.category;
    survivorToken.category = 'ef'.repeat(32);
    expect(vmAccepts(canonical)).toBe(false);
    survivorToken.category = originalSurvivorCategory;

    const originalSurvivorCommitment = survivorToken.nft!.commitment;
    survivorToken.nft!.commitment = '01';
    expect(vmAccepts(canonical)).toBe(false);
    survivorToken.nft!.commitment = originalSurvivorCommitment;

    survivorToken.amount = 7n;
    expect(vmAccepts(canonical)).toBe(false);
    survivorToken.amount = 8n;

    const ordinary = await messageBus.compose({
      preparedCalls: [
        { contract: coordinator.contract, functionName: 'rest', args: [] },
        { contract: threads.contract, functionName: 'idle', args: [] },
      ],
      funder: await createBareP2pkhFeeFunder(provider, 500_000n),
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();
    expect(vmAccepts(ordinary)).toBe(true);

    const wrong = { ...inputs[0], token: { ...inputs[0].token!, category: 'cd'.repeat(32) } };
    await expect(messageBus.compose({
      preparedCalls: [
        { contract: coordinator.contract, functionName: 'run', args: [tag, 2n] },
        { contract: threads.contract, functionName: 'combine', args: [tag, 2n] },
      ],
      funder: await createBareP2pkhFeeFunder(provider, 500_000n),
      changeAddress: fee.unlocker.generateLockingBytecode(),
      lifecycleMerges: [{ invocationIndex: 1, consumedMasters: [wrong, inputs[1]] }],
    }).build()).rejects.toThrow(/exact category master/);
  }, 180_000);
});
