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

describe('kernel multi continuation resource lanes under composition', () => {
  it('settles one participant writing two distinct chunkable collections under compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) left;
        mapping(int => bytes) right;
        function set(int key, bytes leftValue, bytes rightValue) public {
          this.left[key] = leftValue;
          this.right[key] = rightValue;
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'set'))
      .toMatchObject({ eligible: true });
    expect(storeArtifact.abi.find((entry) => entry.name === 'set')?.entryAccesses).toHaveLength(2);

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function set(int key, bytes leftValue, bytes rightValue) external;
      }
      contract Caller() {
        function poke(address store, int key, bytes leftValue, bytes rightValue) public {
          IStore(store).set(key, leftValue, rightValue);
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

    // Seed both keys with short values first so compose performs UPDATEs (not dual empty-map INSERTs),
    // then overwrite with chunk-backed payloads under the nested Caller→Store graph.
    const seedLeft = new Uint8Array(20).fill(0x01);
    const seedRight = new Uint8Array(20).fill(0x02);
    await expect(store.call.set(3n, seedLeft, seedRight).send()).resolves.toBeDefined();

    const left = new Uint8Array(130).fill(0x71);
    const right = new Uint8Array(190).fill(0x82);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, 3n, left, right],
      }, {
        contract: store,
        functionName: 'set',
        args: [3n, left, right],
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
    expect(rightEntries.find((entry) => binToHex(entry.slot) === slot)?.value).toEqual(right);
  }, 300_000);

  it('builds and sends two cold chunkable collection inserts through typed graph discovery', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) left;
        mapping(int => bytes) right;
        function set(int key, bytes leftValue, bytes rightValue) public {
          this.left[key] = leftValue;
          this.right[key] = rightValue;
          require(true);
        }
      }`, KERNEL);
    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function set(int key, bytes leftValue, bytes rightValue) external; }
      contract Caller() {
        function poke(address store, int key, bytes leftValue, bytes rightValue) public {
          IStore(store).set(key, leftValue, rightValue);
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
    const left = new Uint8Array(130).fill(0x71);
    const right = new Uint8Array(190).fill(0x82);
    const call = caller.call.poke(store.inner.lockingBytecode, 3n, left, right);
    expect(vmAccepts(await call.build())).toBe(true);
    await expect(call.send()).resolves.toBeDefined();
    const [leftEntries, rightEntries] = await Promise.all([
      store.getEntries('left'), store.getEntries('right'),
    ]);
    expect(leftEntries.find((entry) => binToHex(entry.slot) === slotHex(3n))?.value).toEqual(left);
    expect(rightEntries.find((entry) => binToHex(entry.slot) === slotHex(3n))?.value).toEqual(right);
  }, 300_000);

  it('settles two keys in one chunkable collection as two resource bands under compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) values;
        function setPair(int firstKey, bytes firstValue, int secondKey, bytes secondValue) public {
          this.values[firstKey] = firstValue;
          this.values[secondKey] = secondValue;
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'setPair'))
      .toMatchObject({ eligible: true });
    expect(storeArtifact.abi.find((entry) => entry.name === 'setPair')?.entryAccesses).toHaveLength(2);

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function setPair(int firstKey, bytes firstValue, int secondKey, bytes secondValue) external;
      }
      contract Caller() {
        function poke(
          address store, int firstKey, bytes firstValue, int secondKey, bytes secondValue
        ) public {
          IStore(store).setPair(firstKey, firstValue, secondKey, secondValue);
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
      ?.externalCalls?.find((call) => call.functionName === 'setPair');

    const seed = new Uint8Array(16).fill(0x0a);
    await expect(store.call.setPair(1n, seed, 2n, seed).send()).resolves.toBeDefined();

    const first = new Uint8Array(130).fill(0x11);
    const second = new Uint8Array(160).fill(0x22);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, 1n, first, 2n, second],
      }, {
        contract: store,
        functionName: 'setPair',
        args: [1n, first, 2n, second],
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
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(1n))?.value).toEqual(first);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(2n))?.value).toEqual(second);
  }, 300_000);

  it('builds and sends two cold keys in one chunkable collection through typed discovery', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) values;
        function setPair(int firstKey, bytes firstValue, int secondKey, bytes secondValue) public {
          this.values[firstKey] = firstValue;
          this.values[secondKey] = secondValue;
          require(true);
        }
      }`, KERNEL);
    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function setPair(int firstKey, bytes firstValue, int secondKey, bytes secondValue) external;
      }
      contract Caller() {
        function poke(address store, int firstKey, bytes firstValue, int secondKey, bytes secondValue) public {
          IStore(store).setPair(firstKey, firstValue, secondKey, secondValue);
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
    const first = new Uint8Array(130).fill(0x11);
    const second = new Uint8Array(160).fill(0x22);
    const call = caller.call.poke(store.inner.lockingBytecode, 1n, first, 2n, second);
    expect(vmAccepts(await call.build())).toBe(true);
    await expect(call.send()).resolves.toBeDefined();
    const entries = await store.getEntries('values');
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(1n))?.value).toEqual(first);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(2n))?.value).toEqual(second);
  }, 300_000);

  it('builds and sends three cold keys sharing one sorted predecessor through typed discovery', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) values;
        function setTriple(int a, bytes av, int b, bytes bv, int c, bytes cv) public {
          this.values[a] = av;
          this.values[b] = bv;
          this.values[c] = cv;
          require(true);
        }
      }`, KERNEL);
    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function setTriple(int a, bytes av, int b, bytes bv, int c, bytes cv) external;
      }
      contract Caller() {
        function poke(address store, int a, bytes av, int b, bytes bv, int c, bytes cv) public {
          IStore(store).setTriple(a, av, b, bv, c, cv);
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
    const first = new Uint8Array(130).fill(0x11);
    const second = new Uint8Array(160).fill(0x22);
    const third = new Uint8Array(190).fill(0x33);
    const call = caller.call.poke(store.inner.lockingBytecode, 1n, first, 2n, second, 3n, third);
    expect(vmAccepts(await call.build())).toBe(true);
    await expect(call.send()).resolves.toBeDefined();
    const entries = await store.getEntries('values');
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(1n))?.value).toEqual(first);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(2n))?.value).toEqual(second);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(3n))?.value).toEqual(third);
  }, 300_000);

  it('builds and sends cold keys across two sorted predecessor gaps through typed discovery', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) values;
        function setOne(int key, bytes value) public {
          this.values[key] = value;
          require(true);
        }
        function setTriple(int a, bytes av, int b, bytes bv, int c, bytes cv) public {
          this.values[a] = av;
          this.values[b] = bv;
          this.values[c] = cv;
          require(true);
        }
      }`, KERNEL);
    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    await expect(store.call.setOne(4n, new Uint8Array(12).fill(0x44)).send()).resolves.toBeDefined();
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function setTriple(int a, bytes av, int b, bytes bv, int c, bytes cv) external;
      }
      contract Caller() {
        function poke(address store, int a, bytes av, int b, bytes bv, int c, bytes cv) public {
          IStore(store).setTriple(a, av, b, bv, c, cv);
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
    // Slot hashes for 1 and 3 precede 4; slot 7 follows it.
    const first = new Uint8Array(130).fill(0x11);
    const second = new Uint8Array(160).fill(0x33);
    const third = new Uint8Array(190).fill(0x77);
    const call = caller.call.poke(store.inner.lockingBytecode, 1n, first, 3n, second, 7n, third);
    expect(vmAccepts(await call.build())).toBe(true);
    await expect(call.send()).resolves.toBeDefined();
    const entries = await store.getEntries('values');
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(1n))?.value).toEqual(first);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(3n))?.value).toEqual(second);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(4n))?.value).toEqual(new Uint8Array(12).fill(0x44));
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(7n))?.value).toEqual(third);
  }, 300_000);

  it('builds and sends an updated predecessor with a cold successor through typed discovery', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) values;
        function setOne(int key, bytes value) public {
          this.values[key] = value;
          require(true);
        }
        function setPair(int firstKey, bytes firstValue, int secondKey, bytes secondValue) public {
          this.values[firstKey] = firstValue;
          this.values[secondKey] = secondValue;
          require(true);
        }
      }`, KERNEL);
    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    await expect(store.call.setOne(4n, new Uint8Array(12).fill(0x44)).send()).resolves.toBeDefined();
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function setPair(int firstKey, bytes firstValue, int secondKey, bytes secondValue) external;
      }
      contract Caller() {
        function poke(address store, int firstKey, bytes firstValue, int secondKey, bytes secondValue) public {
          IStore(store).setPair(firstKey, firstValue, secondKey, secondValue);
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
    const updated = new Uint8Array(130).fill(0x44);
    const inserted = new Uint8Array(160).fill(0x77);
    const call = caller.call.poke(store.inner.lockingBytecode, 4n, updated, 7n, inserted);
    expect(vmAccepts(await call.build())).toBe(true);
    await expect(call.send()).resolves.toBeDefined();
    const entries = await store.getEntries('values');
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(4n))?.value).toEqual(updated);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(7n))?.value).toEqual(inserted);
  }, 300_000);

  it('updates one sorted predecessor while inserting two cold successors through typed discovery', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) values;
        function setOne(int key, bytes value) public {
          this.values[key] = value;
          require(true);
        }
        function setTriple(int a, bytes av, int b, bytes bv, int c, bytes cv) public {
          this.values[a] = av;
          this.values[b] = bv;
          this.values[c] = cv;
          require(true);
        }
      }`, KERNEL);
    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    await expect(store.call.setOne(4n, new Uint8Array(12).fill(0x44)).send()).resolves.toBeDefined();
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function setTriple(int a, bytes av, int b, bytes bv, int c, bytes cv) external;
      }
      contract Caller() {
        function poke(address store, int a, bytes av, int b, bytes bv, int c, bytes cv) public {
          IStore(store).setTriple(a, av, b, bv, c, cv);
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
    const updated = new Uint8Array(130).fill(0x44);
    const firstInsert = new Uint8Array(160).fill(0x77);
    const secondInsert = new Uint8Array(190).fill(0x88);
    const call = caller.call.poke(
      store.inner.lockingBytecode, 4n, updated, 7n, firstInsert, 12n, secondInsert,
    );
    expect(vmAccepts(await call.build())).toBe(true);
    await expect(call.send()).resolves.toBeDefined();
    const entries = await store.getEntries('values');
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(4n))?.value).toEqual(updated);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(7n))?.value).toEqual(firstInsert);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(12n))?.value).toEqual(secondInsert);
  }, 300_000);

  it('inserts two cold keys within one non-HEAD sorted gap through typed discovery', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) values;
        function setOne(int key, bytes value) public {
          this.values[key] = value;
          require(true);
        }
        function setPair(int firstKey, bytes firstValue, int secondKey, bytes secondValue) public {
          this.values[firstKey] = firstValue;
          this.values[secondKey] = secondValue;
          require(true);
        }
      }`, KERNEL);
    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    const originalPredecessor = new Uint8Array(12).fill(0x44);
    const originalSuccessor = new Uint8Array(12).fill(0x77);
    await expect(store.call.setOne(4n, originalPredecessor).send()).resolves.toBeDefined();
    await expect(store.call.setOne(7n, originalSuccessor).send()).resolves.toBeDefined();
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function setPair(int firstKey, bytes firstValue, int secondKey, bytes secondValue) external;
      }
      contract Caller() {
        function poke(address store, int firstKey, bytes firstValue, int secondKey, bytes secondValue) public {
          IStore(store).setPair(firstKey, firstValue, secondKey, secondValue);
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
    // Numeric slot order is 4 < 6 < 12 < 7; both new keys share predecessor 4.
    const first = new Uint8Array(130).fill(0x66);
    const second = new Uint8Array(160).fill(0x12);
    const call = caller.call.poke(store.inner.lockingBytecode, 6n, first, 12n, second);
    expect(vmAccepts(await call.build())).toBe(true);
    await expect(call.send()).resolves.toBeDefined();
    const entries = await store.getEntries('values');
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(4n))?.value).toEqual(originalPredecessor);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(6n))?.value).toEqual(first);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(12n))?.value).toEqual(second);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(7n))?.value).toEqual(originalSuccessor);
  }, 300_000);

  it('updates a sorted predecessor while inserting before its existing successor', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) values;
        function setOne(int key, bytes value) public {
          this.values[key] = value;
          require(true);
        }
        function setPair(int firstKey, bytes firstValue, int secondKey, bytes secondValue) public {
          this.values[firstKey] = firstValue;
          this.values[secondKey] = secondValue;
          require(true);
        }
      }`, KERNEL);
    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    const originalSuccessor = new Uint8Array(12).fill(0x77);
    await expect(store.call.setOne(4n, new Uint8Array(12).fill(0x44)).send()).resolves.toBeDefined();
    await expect(store.call.setOne(7n, originalSuccessor).send()).resolves.toBeDefined();
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function setPair(int firstKey, bytes firstValue, int secondKey, bytes secondValue) external;
      }
      contract Caller() {
        function poke(address store, int firstKey, bytes firstValue, int secondKey, bytes secondValue) public {
          IStore(store).setPair(firstKey, firstValue, secondKey, secondValue);
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
    const updated = new Uint8Array(130).fill(0x44);
    const inserted = new Uint8Array(160).fill(0x12);
    const call = caller.call.poke(store.inner.lockingBytecode, 4n, updated, 12n, inserted);
    expect(vmAccepts(await call.build())).toBe(true);
    await expect(call.send()).resolves.toBeDefined();
    const entries = await store.getEntries('values');
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(4n))?.value).toEqual(updated);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(12n))?.value).toEqual(inserted);
    expect(entries.find((entry) => binToHex(entry.slot) === slotHex(7n))?.value).toEqual(originalSuccessor);
  }, 300_000);

  it('routes typed cold-key inserts to the runtime-selected callee bytecode', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const source = (check: string): string => `pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) values;
        function setPair(int firstKey, bytes firstValue, int secondKey, bytes secondValue) public {
          this.values[firstKey] = firstValue;
          this.values[secondKey] = secondValue;
          require(${check});
        }
      }`;
    const defaultArtifact = compileString(source('true'), KERNEL);
    const selectedArtifact = compileString(source('firstKey >= 0'), KERNEL);
    const defaultBase = new Contract(defaultArtifact, [], { provider });
    const selectedBase = new Contract(selectedArtifact, [], { provider });
    const defaultSetup = await setupStatefulUtxos(
      provider, defaultBase, defaultArtifact.stateLayout!, {}, { saltContract: true },
    );
    const selectedSetup = await setupStatefulUtxos(
      provider, selectedBase, selectedArtifact.stateLayout!, {}, { saltContract: true },
    );
    const defaultStore = StatefulContract.withCategory(
      defaultBase.withCategory(hexToBin(defaultSetup.categoryId)), defaultSetup.categoryId,
    );
    const selectedStore = StatefulContract.withCategory(
      selectedBase.withCategory(hexToBin(selectedSetup.categoryId)), selectedSetup.categoryId,
    );
    expect(defaultStore.inner.lockingBytecode).not.toBe(selectedStore.inner.lockingBytecode);
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function setPair(int firstKey, bytes firstValue, int secondKey, bytes secondValue) external;
      }
      contract Caller() {
        function poke(address store, int firstKey, bytes firstValue, int secondKey, bytes secondValue) public {
          IStore(store).setPair(firstKey, firstValue, secondKey, secondValue);
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
    caller._registerResolvedExternal('IStore', defaultStore);
    caller.registerExternalArray('IStore', [defaultStore, selectedStore]);
    const first = new Uint8Array(130).fill(0x11);
    const second = new Uint8Array(160).fill(0x22);
    const call = caller.call.poke(selectedStore.inner.lockingBytecode, 1n, first, 2n, second);
    expect(vmAccepts(await call.build())).toBe(true);
    await expect(call.send()).resolves.toBeDefined();
    const selectedEntries = await selectedStore.getEntries('values');
    expect(selectedEntries.find((entry) => binToHex(entry.slot) === slotHex(1n))?.value).toEqual(first);
    expect(selectedEntries.find((entry) => binToHex(entry.slot) === slotHex(2n))?.value).toEqual(second);
    const defaultEntries = await defaultStore.getEntries('values');
    expect(defaultEntries.find((entry) => binToHex(entry.slot) === slotHex(1n))).toBeUndefined();
    expect(defaultEntries.find((entry) => binToHex(entry.slot) === slotHex(2n))).toBeUndefined();
  }, 300_000);

  it('publishes a second resource beside the terminal primary band under compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    // Same-key double-assign collapses in the ABI to the terminal value; keep one write per resource so
    // both continuation bands remain authenticated under ordered claims (terminal-per-resource selection
    // remains covered by compose's mutation-ordinal filter).
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) primary;
        mapping(int => bytes) secondary;
        function rewrite(int key, bytes terminal, bytes other) public {
          this.primary[key] = terminal;
          this.secondary[key] = other;
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'rewrite'))
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
        function rewrite(int key, bytes terminal, bytes other) external;
      }
      contract Caller() {
        function poke(address store, int key, bytes terminal, bytes other) public {
          IStore(store).rewrite(key, terminal, other);
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
      ?.externalCalls?.find((call) => call.functionName === 'rewrite');

    const seed = new Uint8Array(16).fill(0x21);
    await expect(store.call.rewrite(9n, seed, seed).send()).resolves.toBeDefined();

    const terminal = new Uint8Array(150).fill(0x32);
    const other = new Uint8Array(170).fill(0x33);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, 9n, terminal, other],
      }, {
        contract: store,
        functionName: 'rewrite',
        args: [9n, terminal, other],
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

    const [primaryEntries, secondaryEntries] = await Promise.all([
      store.getEntries('primary'), store.getEntries('secondary'),
    ]);
    const slot = slotHex(9n);
    expect(primaryEntries.find((entry) => binToHex(entry.slot) === slot)?.value).toEqual(terminal);
    expect(secondaryEntries.find((entry) => binToHex(entry.slot) === slot)?.value).toEqual(other);
  }, 300_000);
});
