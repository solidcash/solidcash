import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import {
  StatefulContract,
  readEventsFromChain,
} from '../../../src/stateful/index.js';
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

const slotHex = (key: bigint): string => binToHex(keyToSlotMulti([bigIntToVmNumber(key)]));

describe('kernel selected event beside journal mutation under composition', () => {
  it('settles two emitting participants after the complete event frame is balanced', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Callee() {
        event Seen(int value);
        function record(int value) public {
          emit Seen(value);
          require(true);
        }
      }`, KERNEL);
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const callee = StatefulContract.withCategory(
      calleeBase.withCategory(hexToBin(calleeSetup.categoryId)), calleeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ICallee { function record(int value) external; }
      contract Caller() {
        event Called(int value);
        function trigger(address callee, int value) public {
          emit Called(value);
          ICallee(callee).record(value);
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
    caller._registerResolvedExternal('ICallee', callee);
    const callsiteId = callerArtifact.abi.find((entry) => entry.name === 'trigger')
      ?.externalCalls?.find((call) => call.functionName === 'record')?.callsiteId;
    expect(callsiteId).toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller, functionName: 'trigger', args: [callee.inner.lockingBytecode, 7n],
      }, {
        contract: callee, functionName: 'record', args: [7n], callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const called = callerArtifact.events!.find((event) => event.name === 'Called')!;
    const seen = calleeArtifact.events!.find((event) => event.name === 'Seen')!;
    const callerEvents = await readEventsFromChain(
      provider, caller.getEventNftAddress(called.signature), callerSetup.categoryId,
      called, callerArtifact.structs,
    );
    const calleeEvents = await readEventsFromChain(
      provider, callee.getEventNftAddress(seen.signature), calleeSetup.categoryId,
      seen, calleeArtifact.structs,
    );
    expect(callerEvents.some((event) => event.values.value === 7n)).toBe(true);
    expect(calleeEvents.some((event) => event.values.value === 7n)).toBe(true);
  }, 120_000);

  it('skips unselected fixed event slots during semantic composition', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    // A conditional emit keeps its fixed event slot; a top-level one would stream in the trailing band.
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        event Touched(int indexed key);
        function touch(int key) public {
          if (key >= 0) { emit Touched(key); }
          require(true);
        }
        function leaveUntouched() public { require(true); }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.route.blockLayout?.slots.some((slot) => slot.kind === 'event'))
      .toBe(true);
    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function leaveUntouched() external; }
      contract Caller() {
        function poke(address store) public {
          IStore(store).leaveUntouched();
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
    const callsiteId = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'leaveUntouched')?.callsiteId;
    expect(callsiteId).toBeDefined();

    const inspectedEventIndices: number[][] = [];
    const discoverEvents = store._messageBusEventCommitmentsFromTransaction.bind(store);
    store._messageBusEventCommitmentsFromTransaction = (...args) => {
      inspectedEventIndices.push([...args[1]]);
      return discoverEvents(...args);
    };
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller, functionName: 'poke', args: [store.inner.lockingBytecode],
      }, {
        contract: store, functionName: 'leaveUntouched', args: [], callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(inspectedEventIndices).toEqual([]);
    expect(vmAccepts(builder)).toBe(true);
  }, 120_000);

  it.each([true, false])(
    'settles bool-param-selected emit beside mapping write when emitIt=%s',
    async (emitIt) => {
      const provider = createMessageBusCapstoneTestProvider();

      const storeArtifact = compileString(`pragma solidcash >=0.8.0;
        contract Store() {
          mapping(int => int) values;
          event Touched(int indexed key, int value);
          function set(int key, int value, bool emitIt) public {
            this.values[key] = value;
            if (emitIt) { emit Touched(key, value); }
            require(true);
          }
        }`, KERNEL);
      expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'set'))
        .toMatchObject({ eligible: true });

      const storeBase = new Contract(storeArtifact, [], { provider });
      const storeSetup = await setupStatefulUtxos(
        provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
      );
      const store = StatefulContract.withCategory(
        storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
      );

      const callerArtifact = compileString(`pragma solidcash >=0.8.0;
        interface IStore {
          function set(int key, int value, bool emitIt) external;
        }
        contract Caller() {
          function poke(address store, int key, int value, bool emitIt) public {
            IStore(store).set(key, value, emitIt);
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

      await expect(store.call.set(3n, 1n, false).send()).resolves.toBeDefined();

      const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
      const composition = messageBus.compose({
        preparedCalls: [{
          contract: caller,
          functionName: 'poke',
          args: [store.inner.lockingBytecode, 3n, 42n, emitIt],
        }, {
          contract: store,
          functionName: 'set',
          args: [3n, 42n, emitIt],
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

      const entries = await store.getEntries('values');
      expect(entries.find((entry) => binToHex(entry.slot) === slotHex(3n))?.value).toBe(42n);

      const event = storeArtifact.events!.find((candidate) => candidate.name === 'Touched')!;
      const decoded = await readEventsFromChain(
        provider,
        store.getEventNftAddress(event.signature),
        storeSetup.categoryId,
        event,
        storeArtifact.structs,
      );
      if (emitIt) {
        expect(decoded.some((row) => row.values.key === 3n && row.values.value === 42n)).toBe(true);
      } else {
        expect(decoded.some((row) => row.values.key === 3n && row.values.value === 42n)).toBe(false);
      }
    },
    300_000,
  );
});
