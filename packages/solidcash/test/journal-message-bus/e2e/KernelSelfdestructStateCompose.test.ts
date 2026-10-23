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
 * Modifier-only selfdestruct on a fixed-scalar contract consumes master+dataNft and reclaims sats.
 */
describe('kernel selfdestruct state compose', () => {
  it('admits and settles kill() with fixed dataNft under messageBus.compose', async () => {
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
        int public dust;
        function kill() public selfdestruct { require(true); }
        function idle() public { require(true); }
      }
    `, KERNEL);

    const kill = artifacts.Victim.messageBus?.handlers.find((handler) => handler.name === 'kill');
    expect(kill).toMatchObject({
      eligible: true,
      lifecycleTopology: {
        version: 2,
        kind: 'selfdestruct',
        resourcePrefix: { mode: 'consume', dataNftCount: 1, nftIndices: [0] },
      },
    });
    expect(artifacts.Victim.messageBus?.verifierProgram?.lifecycle).toBe(true);
    expect(artifacts.Victim.abi.find((fn) => fn.name === 'kill')?.blockLayout?.blockSize).toBe(2);

    const mappingFence = compileStringMulti(`
      contract MappingVictim() {
        mapping(bytes20 => int) public balances;
        function kill() public selfdestruct { require(true); }
        function idle() public { require(true); }
      }
    `, KERNEL);
    expect(mappingFence.MappingVictim.messageBus?.handlers.find((handler) => handler.name === 'kill'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });

    const eventFence = compileStringMulti(`
      contract EventVictim() {
        event Ping();
        int public marker;
        function kill() public selfdestruct { require(true); }
        function idle() public { require(true); }
      }
    `, KERNEL);
    expect(eventFence.EventVictim.messageBus?.handlers.find((handler) => handler.name === 'kill'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });

    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<{
      contract: StatefulContract; category: string; masterSats: bigint; dataSats: bigint;
    }> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      const dataSats = setup.dataNftUtxos?.[0]?.satoshis ?? 0n;
      return {
        contract: StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId),
        category: setup.categoryId,
        masterSats: setup.masterUtxo.satoshis,
        dataSats,
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

    // Participant minting/data NFTs are retired. The message-bus verifier NFT keeps the category with a
    // mutable capability and an L3V1 commitment prefix — that is not a revived state UTXO.
    expect(canonical.outputs.every((output) =>
      !(output.token?.category === victim.category && output.token.nft?.capability === 'minting')))
      .toBe(true);
    expect(canonical.outputs.every((output) =>
      !(output.token?.category === victim.category
        && output.token.nft?.capability === 'mutable'
        && !(output.token.nft.commitment ?? '').startsWith('4c335631'))))
      .toBe(true);

    const reclaimAmounts = canonical.outputs
      .filter((output) => output.token === undefined
        && lockingHex(output.to).toLowerCase() === recipientHex
        && (output.amount === victim.masterSats || output.amount === victim.dataSats))
      .map((output) => output.amount)
      .sort((left, right) => Number(left - right));
    expect(reclaimAmounts).toEqual(
      [victim.dataSats, victim.masterSats].sort((left, right) => Number(left - right)),
    );
  }, 180_000);
});
