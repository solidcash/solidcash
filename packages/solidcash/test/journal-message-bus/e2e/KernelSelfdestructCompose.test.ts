import { binToHex, hexToBin } from '@bitauth/libauth';
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

const lockingHex = (value: string | Uint8Array): string => (
  typeof value === 'string' && !/^(?:[0-9a-fA-F]{2})+$/.test(value)
    ? value
    : binToHex(typeof value === 'string' ? hexToBin(value) : value).toLowerCase()
);

/**
 * Resource-free modifier-only selfdestruct publishes retirement topology. Compose reclaims the master
 * satoshis to an explicit recipient and leaves no minting NFT for the retired category.
 */
describe('kernel selfdestruct compose', () => {
  it('admits and settles kill() under messageBus.compose with retired category and recipient reclaim', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`
      interface IVictim {
        function kill();
        function idle();
      }
      contract Coordinator(address victim) {
        function run() public {
          IVictim(victim).kill();
          require(true);
        }
        function rest() public {
          IVictim(victim).idle();
          require(true);
        }
      }
      contract Victim() {
        function kill() public selfdestruct { require(true); }
        function idle() public { require(true); }
      }
    `, KERNEL);

    const kill = artifacts.Victim.messageBus?.handlers.find((handler) => handler.name === 'kill');
    expect(kill).toMatchObject({
      eligible: true,
      lifecycleTopology: { version: 2, kind: 'selfdestruct' },
    });
    expect(artifacts.Victim.messageBus?.verifierProgram?.lifecycle).toBe(true);
    expect(artifacts.Victim.messageBus?.atomicMessageBus?.protocolVersions).not.toContain(3);
    expect(artifacts.Victim.messageBus?.handlers.find((handler) => handler.name === 'idle'))
      .toMatchObject({ eligible: true });

    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<{
      contract: StatefulContract; category: string; masterSats: bigint;
    }> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return {
        contract: StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId),
        category: setup.categoryId,
        masterSats: setup.masterUtxo.satoshis,
      };
    };
    const victim = await connect(artifacts.Victim);
    const coordinator = await connect(artifacts.Coordinator, [hexToBin(victim.contract.inner.lockingBytecode)]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const recipient = fee.unlocker.generateLockingBytecode();
    const recipientHex = lockingHex(recipient);

    const canonical = await messageBus.compose({
      preparedCalls: [
        { contract: coordinator.contract, functionName: 'run', args: [] },
        { contract: victim.contract, functionName: 'kill', args: [] },
      ],
      funder: fee,
      changeAddress: recipient,
      lifecycleSelfdestructs: [{ invocationIndex: 1, recipient }],
    }).build();
    expect(vmAccepts(canonical)).toBe(true);

    expect(canonical.outputs.every((output) =>
      !(output.token?.category === victim.category && output.token.nft?.capability === 'minting'))).toBe(true);

    const reclaim = canonical.outputs.find((output) =>
      output.token === undefined
      && lockingHex(output.to).toLowerCase() === recipientHex
      && output.amount === victim.masterSats);
    expect(reclaim).toBeDefined();

    await expect(messageBus.compose({
      preparedCalls: [
        { contract: coordinator.contract, functionName: 'rest', args: [] },
        { contract: victim.contract, functionName: 'idle', args: [] },
      ],
      funder: await createBareP2pkhFeeFunder(provider, 500_000n),
      changeAddress: recipient,
    }).build()).resolves.toBeTruthy();
  }, 180_000);
});
