import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
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

describe('kernel same-iteration bool selection under composition', () => {
  it.each([false, true])('settles pickRight=%s via messageBus.compose with only selected map written', async (pickRight) => {
    const provider = createMessageBusCapstoneTestProvider();

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => int) left;
        mapping(int => int) right;
        function choose(int n, bool pickRight) public {
          for (int i = 0; i < n; i = i + 1) {
            if (pickRight) {
              right[i] = i + 1;
            } else {
              left[i] = i + 1;
            }
          }
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'choose'))
      .toMatchObject({ eligible: true });
    expect(storeArtifact.abi.find((entry) => entry.name === 'choose')?.sortedUpsertLoopInfo?.length)
      .toBeGreaterThanOrEqual(2);

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function choose(int n, bool pickRight) external;
      }
      contract Caller() {
        function poke(address store, int n, bool pickRight) public {
          IStore(store).choose(n, pickRight);
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
      ?.externalCalls?.find((call) => call.functionName === 'choose');
    expect(callsite?.callsiteId).toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, 2n, pickRight],
      }, {
        contract: store,
        functionName: 'choose',
        args: [2n, pickRight],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const [leftEntries, rightEntries] = await Promise.all([
      store.getEntries('left'), store.getEntries('right'),
    ]);
    if (pickRight) {
      expect(leftEntries).toHaveLength(0);
      for (const key of [0n, 1n]) {
        expect(rightEntries.find((entry) => binToHex(entry.slot) === slotHex(key))?.value)
          .toBe(key + 1n);
      }
    } else {
      expect(rightEntries).toHaveLength(0);
      for (const key of [0n, 1n]) {
        expect(leftEntries.find((entry) => binToHex(entry.slot) === slotHex(key))?.value)
          .toBe(key + 1n);
      }
    }
  }, 300_000);
});
