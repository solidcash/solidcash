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

describe('kernel conditional multi continuation resource lanes under composition', () => {
  it.each([true, false])(
    'settles bool-param-activated second chunkable write when writeRight=%s',
    async (writeRight) => {
      const provider = createMessageBusCapstoneTestProvider();

      const storeArtifact = compileString(`pragma solidcash >=0.8.0;
        contract Store() {
          mapping(int => bytes) left;
          mapping(int => bytes) right;
          function set(int key, bytes leftValue, bytes rightValue, bool writeRight) public {
            this.left[key] = leftValue;
            if (writeRight) {
              this.right[key] = rightValue;
            }
            require(true);
          }
        }`, KERNEL);
      expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'set'))
        .toMatchObject({ eligible: true });
      expect(storeArtifact.abi.find((entry) => entry.name === 'set')
        ?.entryAccesses?.find((access) => access.collection === 'right')?.activation)
        .toMatchObject({ kind: 'source', source: { kind: 'forward', paramIndex: 3 } });
      // path-effect activation: compose consumes published multi-effect pathEffectSchedule for write selection.
      expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'set')
        ?.pathEffectSchedule).toMatchObject({
        version: 1,
        effects: expect.arrayContaining([
          expect.objectContaining({ kind: 'stateWrite' }),
          expect.objectContaining({
            kind: 'stateWrite',
            activation: expect.objectContaining({ kind: 'handlerInput' }),
          }),
        ]),
      });

      const storeBase = new Contract(storeArtifact, [], { provider });
      const storeSetup = await setupStatefulUtxos(
        provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
      );
      const store = StatefulContract.withCategory(
        storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
      );

      const callerArtifact = compileString(`pragma solidcash >=0.8.0;
        interface IStore {
          function set(int key, bytes leftValue, bytes rightValue, bool writeRight) external;
        }
        contract Caller() {
          function poke(
            address store, int key, bytes leftValue, bytes rightValue, bool writeRight
          ) public {
            IStore(store).set(key, leftValue, rightValue, writeRight);
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
        ?.externalCalls?.find((call) => call.functionName === 'set');
      expect(callsite?.callsiteId).toBeDefined();

      const seedLeft = new Uint8Array(20).fill(0x01);
      const seedRight = new Uint8Array(20).fill(0x02);
      await expect(store.call.set(3n, seedLeft, seedRight, true).send()).resolves.toBeDefined();

      const left = new Uint8Array(130).fill(0x71);
      const right = new Uint8Array(190).fill(0x82);
      const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
      const composition = messageBus.compose({
        preparedCalls: [{
          contract: caller,
          functionName: 'poke',
          args: [store.inner.lockingBytecode, 3n, left, right, writeRight],
        }, {
          contract: store,
          functionName: 'set',
          args: [3n, left, right, writeRight],
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
      const slot = slotHex(3n);
      expect(leftEntries.find((entry) => binToHex(entry.slot) === slot)?.value).toEqual(left);
      expect(rightEntries.find((entry) => binToHex(entry.slot) === slot)?.value)
        .toEqual(writeRight ? right : seedRight);
    },
    300_000,
  );
});
