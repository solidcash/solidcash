import { hexToBin } from '@bitauth/libauth';
import { type Artifact } from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  SignatureTemplate,
  type TransactionBuilder,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { alicePriv, alicePub } from '../../fixture/vars.js';
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
 * Resource-free split may share a V4 callManifest with a KTS-signed sibling. Lifecycle authority stays
 * selector-derived; the V4 participant suffix remains the neutral mode=0/count=0 spelling.
 */
describe('kernel lifecycle + V4 transaction-signature compose', () => {
  it('settles signed poke beside split(2) under one V4 messageBus.compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`
      interface IThreads { function forkThreads(string label, int count); }
      interface IVault { function poke(sig proof, int next); }
      contract Coordinator(address threads, address vault) {
        function run(int count, sig proof, int next) public {
          IVault(vault).poke(proof, next);
          IThreads(threads).forkThreads("run", count);
          require(count > 0);
        }
      }
      contract Threads() {
        function forkThreads(string label, int count) public split(count) {
          require(label.length > 0 && count > 0);
        }
        function idle() public { require(true); }
      }
      contract Vault(pubkey authority) {
        int public marker;
        function poke(sig proof, int next) public {
          require(checkSig(proof, authority));
          this.marker = next;
          require(true);
        }
      }
    `, KERNEL);

    expect(artifacts.Threads.messageBus?.handlers.find((handler) => handler.name === 'forkThreads'))
      .toMatchObject({ eligible: true, lifecycleTopology: { kind: 'split' } });
    expect(artifacts.Vault.messageBus?.handlers.find((handler) => handler.name === 'poke'))
      .toMatchObject({ eligible: true, usesTransactionSignature: true });
    expect(artifacts.Threads.messageBus?.atomicMessageBus?.protocolVersions).toEqual(
      expect.arrayContaining([1, 2, 4]),
    );
    expect(artifacts.Vault.messageBus?.atomicMessageBus?.protocolVersions).toEqual(
      expect.arrayContaining([1, 2, 4]),
    );

    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<{
      contract: StatefulContract; category: string;
    }> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, artifact.contractName === 'Vault' ? { marker: 0n } : {},
        { saltContract: true },
      );
      return {
        contract: StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId),
        category: setup.categoryId,
      };
    };
    const threads = await connect(artifacts.Threads);
    const vault = await connect(artifacts.Vault, [alicePub]);
    const coordinator = await connect(artifacts.Coordinator, [
      hexToBin(threads.contract.inner.lockingBytecode),
      hexToBin(vault.contract.inner.lockingBytecode),
    ]);

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const first = await createBareP2pkhFeeFunder(provider, 2_000n);
    const second = await createBareP2pkhFeeFunder(provider, 3_000n);
    const proof = new SignatureTemplate(alicePriv);
    const canonical = await messageBus.compose({
      preparedCalls: [
        { contract: coordinator.contract, functionName: 'run', args: [2n, proof, 7n] },
        { contract: vault.contract, functionName: 'poke', args: [proof, 7n] },
        { contract: threads.contract, functionName: 'forkThreads', args: ['run', 2n] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      lifecycleSplits: [{
        invocationIndex: 2, funders: [first, second], createdValues: [1_000n, 1_500n],
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

    await canonical.send();
    const state = await vault.contract.getState();
    expect(state.marker).toBe(7n);
  }, 180_000);
});
