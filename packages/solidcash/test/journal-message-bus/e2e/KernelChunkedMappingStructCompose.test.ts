import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString, compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../../src/index.js';
import {
  StatefulContract,
  getContractFactory,
  upgrades,
} from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('kernel chunked mapping struct composition', () => {
  it('derives the mapping struct at the intermediate row epoch', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const tail = 'row-epoch-payload';
    const artifacts = compileStringMulti(`pragma solidity ^0.8.0;
      struct Record { uint256 stable; uint256 phase; string tail; }
      interface IObserver {
        function inspect(uint256 key, uint256 during, uint256 finalValue) external;
      }
      interface IStore {
        function read(uint256 key) external returns (Record memory);
        function finish(uint256 key, uint256 finalValue) external;
      }
      contract Store {
        mapping(uint256 => Record) private records;
        function seed(uint256 key, string memory tail) public {
          records[key] = Record(11, 1, tail);
        }
        function mutate(
          uint256 key, address observer, uint256 during, uint256 finalValue
        ) public {
          records[key].phase = during;
          IObserver(observer).inspect(key, during, finalValue);
        }
        function read(uint256 key) public view returns (Record memory) { return records[key]; }
        function finish(uint256 key, uint256 finalValue) public { records[key].phase = finalValue; }
        function check(uint256 key, uint256 finalValue, string memory tail) public view {
          Record memory current = records[key];
          require(current.stable == 11 && current.phase == finalValue && current.tail == tail);
        }
      }
      contract Observer(address store) {
        function inspect(uint256 key, uint256 during, uint256 finalValue) public {
          Record memory current = IStore(store).read(key);
          require(current.stable == 11 && current.phase == during
            && current.tail == "${tail}");
          IStore(store).finish(key, finalValue);
        }
      }`, { ...KERNEL, evmCompat: true });

    const storeBase = new Contract(artifacts.Store, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, artifacts.Store.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    const observerBase = new Contract(
      artifacts.Observer, [store.inner.lockingBytecode], { provider },
    );
    const observerSetup = await setupStatefulUtxos(
      provider, observerBase, artifacts.Observer.stateLayout!, {}, { saltContract: true },
    );
    const observer = StatefulContract.withCategory(
      observerBase.withCategory(hexToBin(observerSetup.categoryId)), observerSetup.categoryId,
    );
    store._registerResolvedExternal('IObserver', observer);
    observer._registerResolvedExternal('IStore', store);
    await store.call.seed(7n, tail).send();

    const inspectCallsite = artifacts.Store.abi.find((entry) => entry.name === 'mutate')!
      .externalCalls!.find((call) => call.functionName === 'inspect')!.callsiteId!;
    const inspectCalls = artifacts.Observer.abi.find((entry) => entry.name === 'inspect')!.externalCalls!;
    const readCallsite = inspectCalls.find((call) => call.functionName === 'read')!.callsiteId!;
    const finishCallsite = inspectCalls.find((call) => call.functionName === 'finish')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        {
          contract: store,
          functionName: 'mutate',
          args: [7n, observer.inner.lockingBytecode, 20n, 30n],
        },
        {
          contract: observer,
          functionName: 'inspect',
          args: [7n, 20n, 30n],
          callsiteId: inspectCallsite,
        },
        {
          contract: store,
          functionName: 'read',
          args: [7n],
          callsiteId: readCallsite,
        },
        {
          contract: store,
          functionName: 'finish',
          args: [7n, 30n],
          callsiteId: finishCallsite,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await expect(store.call.check(7n, 30n, tail).send()).resolves.toBeDefined();
  }, 180_000);

  it('derives an ABI struct return from a chunked mapping entry', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const note = 'authenticated mapping payload '.repeat(10);
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { string note; uint256 value; }
      contract Store {
        mapping(uint256 => Record) records;
        function seed(uint256 key) public {
          records[key] = Record("${note}", 7);
        }
        function read(uint256 key) public view returns (Record memory) { return records[key]; }
      }`, { ...KERNEL, evmCompat: true });
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    await store.call.seed(4n).send();
    const result = await store.call.read(4n).staticCall() as { note: string; value: bigint };
    expect(result.note).toBe(note);
    expect(result.value).toBe(7n);
  }, 180_000);

  it('settles and returns a graph-produced oversized scalar struct insert', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const probeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Probe() {
        uint256 counter;
        function read() public returns (uint256) {
          this.counter = this.counter + 1;
          return this.counter;
        }
      }`, {
      ...KERNEL, messageBusGraphContext: true,
    });
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const writerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function read() external returns (uint256); }
      struct Record { string note; uint256 value; }
      contract Writer() {
        mapping(uint256 => Record) records;
        function write(address probe, uint256 key) public returns (uint256) {
          uint256 value = IProbe(probe).read();
          this.records[key] = Record("${'long record payload '.repeat(14)}", value);
          return value;
        }
      }`, KERNEL);
    expect(writerArtifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(writerArtifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(writerArtifact.bytecode.replace(/\s+/g, '')).toContain('OP_INVOKE');
    expect(writerArtifact.stateLayout?.collections?.find((collection) => collection.name === 'records'))
      .toMatchObject({ chunkableValue: true, valueType: 'Record' });
    const writerBase = new Contract(writerArtifact, [], { provider });
    const writerSetup = await setupStatefulUtxos(
      provider, writerBase, writerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const writer = StatefulContract.withCategory(
      writerBase.withCategory(hexToBin(writerSetup.categoryId)), writerSetup.categoryId,
    );
    writer._registerResolvedExternal('IProbe', probe);
    const callsite = writerArtifact.abi.find((entry) => entry.name === 'write')
      ?.externalCalls?.find((call) => call.functionName === 'read');
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: writer,
        functionName: 'write',
        args: [probe.inner.lockingBytecode, 7n],
      }, {
        contract: probe,
        functionName: 'read',
        args: [],
        callsiteId: callsite!.callsiteId,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await probe.getState()).counter).toBe(1n);
  }, 180_000);

  it('settles an existing chunked struct fixed-array update before a wide external result', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`pragma solidity ^0.8.0;
      interface IProbe { function values() external returns (uint256[5] memory); }
      interface IStore { function release(uint256 key) external; }
      struct Record {
        address principal;
        uint64 delay;
        address counterparty;
        uint64 opened;
        address venue;
        uint256 rate;
        uint64 deadline;
        address asset;
        uint16 status;
        int16[2] consensus;
        uint16[4] split;
        uint256 quantity;
        string reference;
      }
      contract Probe {
        function values() public pure returns (uint256[5] memory result) {
          result[0] = 1; result[1] = 2; result[2] = 3; result[3] = 4; result[4] = 5;
        }
      }
      contract Store(address probe) {
        mapping(uint256 => Record) records;
        function seed(uint256 key) public {
          records[key] = Record(
            probe, 7, probe, 11, probe, 13, 17, probe, 19,
            [int16(0), int16(1)], [uint16(1), uint16(2), uint16(3), uint16(4)],
            23, "${'fixed array entry payload '.repeat(2)}"
          );
        }
        function release(uint256 key) public {
          Record memory current = records[key];
          current.consensus[0] = 1;
          current.consensus[1] = 1;
          records[key].consensus = current.consensus;
          uint256[5] memory result = IProbe(probe).values();
          require(result[4] == 5);
        }
        function check(uint256 key) public view {
          Record memory current = records[key];
          require(current.consensus[0] == 1 && current.consensus[1] == 1);
        }
      }
      contract Coordinator {
        uint256 count;
        function initialize() public { this.count = 0; }
        function run(address store, uint256 key) public {
          IStore(store).release(key);
          this.count = this.count + 1;
        }
      }`, { ...KERNEL, evmCompat: true });
    const probeBase = new Contract(artifacts.Probe, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, artifacts.Probe.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );
    const storeBase = new Contract(artifacts.Store, [probe.inner.lockingBytecode], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, artifacts.Store.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
      { externals: { IProbe: probe } },
    );
    await store.call.seed(1n).send();
    const signer = new Signer(new Uint8Array(32).fill(0x76), provider);
    for (let index = 0; index < 20; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }
    const coordinator = await upgrades.deployProxy(
      getContractFactory(artifacts.Coordinator, signer), [],
    );
    coordinator.implementation._registerResolvedExternal('IStore', store);
    const coordinatorDelegate = artifacts.Coordinator.delegateArtifact!;
    const releaseCallsite = coordinatorDelegate.abi.find((entry) => entry.name === 'run')!
      .externalCalls!.find((call) => call.functionName === 'release')!.callsiteId!;
    const valuesCallsite = artifacts.Store.abi.find((entry) => entry.name === 'release')!
      .externalCalls!.find((call) => call.functionName === 'values')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: coordinator.proxy,
        functionName: 'run',
        args: [store.inner.lockingBytecode, 1n],
        executionArtifact: coordinator.implementation.inner.artifact,
        executor: coordinator.implementation,
      }, {
        contract: store, functionName: 'release', args: [1n], callsiteId: releaseCallsite,
      }, {
        contract: probe, functionName: 'values', args: [], callsiteId: valuesCallsite,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await expect(store.call.check(1n).send()).resolves.toBeDefined();
  }, 180_000);

  it('threads two whole-entry chunkable transitions through one pending value', async () => {
    const storeSource = `pragma solidity ^0.8.0;
      struct Record { string note; uint256 revision; bool settled; }
      contract Store {
        mapping(uint256 => Record) records;
        function replace(uint256 key, string memory note, uint256 revision) public {
          records[key] = Record(note, revision, false);
        }
        function settle(uint256 key) public {
          Record memory current = records[key];
          current.settled = true;
          records[key] = current;
        }
        function check(uint256 key, string memory note, uint256 revision) public view {
          Record memory current = records[key];
          require(current.note == note && current.revision == revision && current.settled);
        }
      }`;
    const coordinatorSource = `pragma solidity ^0.8.0;
      interface IStore {
        function replace(uint256 key, string memory note, uint256 revision) external;
        function settle(uint256 key) external;
      }
      contract Coordinator {
        function update(address store, uint256 key, string memory note, uint256 revision) public {
          IStore(store).replace(key, note, revision);
          IStore(store).settle(key);
        }
      }`;
    const note = 'pooled whole-entry continuation '.repeat(8);
    const observations = [];
    for (const messageBusKernel of [true, false]) {
      const artifact = compileString(storeSource, {
        ...KERNEL, evmCompat: true, messageBusKernel, messageBusGraphContext: true,
      });
      const coordinatorArtifact = compileString(coordinatorSource, {
        ...KERNEL, evmCompat: true, messageBusKernel,
      });
      expect(artifact.messageBus?.convention)
        .toBe(messageBusKernel ? 'kernel-row-loop' : 'legacy-unroll');
      expect(artifact.messageBus?.fixedChunkableWritePolicy).toEqual(messageBusKernel
        ? expect.objectContaining({ version: 1, maximumRows: 1 })
        : undefined);
      expect(['replace', 'settle'].map((name) =>
        artifact.messageBus?.handlers.find((handler) => handler.name === name)?.eligible))
        .toEqual([true, true]);
      expect(encodePushdataValue(
        { note, revision: 7n, settled: true }, 'Record', artifact.structs,
      ).length).toBeGreaterThan(60);

      const provider = createMessageBusCapstoneTestProvider();
      const base = new Contract(artifact, [], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, {}, { saltContract: true },
      );
      const store = StatefulContract.withCategory(
        base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
      );
      const coordinatorBase = new Contract(coordinatorArtifact, [], { provider });
      const coordinatorSetup = await setupStatefulUtxos(
        provider, coordinatorBase, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
      );
      const coordinator = StatefulContract.withCategory(
        coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
        { externals: { IStore: store } },
      );
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      const composition = messageBus.compose({
        calls: [
          coordinator.call.update(store.inner.lockingBytecode, 5n, note, 7n),
          store.call.replace(5n, note, 7n),
          store.call.settle(5n),
        ],
        funder,
        changeAddress: funder.unlocker.generateLockingBytecode(),
      });
      await expect(composition.send()).resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      await expect(store.call.check(5n, note, 7n).send()).resolves.toBeDefined();
      observations.push(await store.getState());
    }
    expect(observations).toHaveLength(2);
  }, 300_000);
});
