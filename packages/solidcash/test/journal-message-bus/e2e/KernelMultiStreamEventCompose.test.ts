import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { encodeEventCommitment } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
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
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

const slotHex = (key: bigint): string => binToHex(keyToSlotMulti([bigIntToVmNumber(key)]));

describe('kernel unconditional emit beside two mutation streams', () => {
  it('settles writeEmit via messageBus.compose with both maps and events', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        event Tick(int i);
        mapping(int => int) left;
        mapping(int => int) right;
        function writeEmit(int n) public {
          for (int i = 0; i < n; i = i + 1) {
            left[i] = i;
            right[i] = i + 10;
            emit Tick(i);
          }
          require(true);
        }
      }`, KERNEL);
    const abi = storeArtifact.abi.find((entry) => entry.name === 'writeEmit')!;
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'writeEmit'))
      .toMatchObject({ eligible: true });
    expect(abi.sortedUpsertLoopInfo).toHaveLength(2);
    expect(abi.runtimeLoopEvents?.length).toBeGreaterThan(0);

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function writeEmit(int n) external;
      }
      contract Caller() {
        function poke(address store, int n) public {
          IStore(store).writeEmit(n);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IStore', store);

    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'writeEmit');
    expect(callsite?.callsiteId).toBeDefined();

    // Seed INSERT via direct call; compose settles the UPDATE path.
    await expect(store.call.writeEmit(2n).send()).resolves.toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, 2n],
      }, {
        contract: store,
        functionName: 'writeEmit',
        args: [2n],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    const transaction = builder.buildLibauthTransaction();
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const [leftEntries, rightEntries] = await Promise.all([
      store.getEntries('left'), store.getEntries('right'),
    ]);
    for (const key of [0n, 1n]) {
      expect(leftEntries.find((entry) => binToHex(entry.slot) === slotHex(key))?.value).toBe(key);
      expect(rightEntries.find((entry) => binToHex(entry.slot) === slotHex(key))?.value).toBe(key + 10n);
    }

    const event = storeArtifact.events!.find((candidate) => candidate.name === 'Tick')!;
    const expectedCommitments = [0n, 1n].map((value) =>
      binToHex(encodeEventCommitment(event.parameters, [value], storeArtifact.structs)));
    const eventOutputs = transaction.outputs.filter((output) => output.token?.nft?.capability === 'none');
    expect(eventOutputs.map((output) => binToHex(output.token!.nft!.commitment as Uint8Array)))
      .toEqual(expect.arrayContaining(expectedCommitments));
  }, 300_000);
});
