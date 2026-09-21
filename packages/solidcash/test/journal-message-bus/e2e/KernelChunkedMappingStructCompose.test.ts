import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
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
      }`, { ...KERNEL, solidityImportCompat: true });
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
        ...KERNEL, solidityImportCompat: true, messageBusKernel, messageBusGraphContext: true,
      });
      const coordinatorArtifact = compileString(coordinatorSource, {
        ...KERNEL, solidityImportCompat: true, messageBusKernel,
      });
      expect(artifact.messageBus?.convention)
        .toBe(messageBusKernel ? 'kernel-row-loop' : 'legacy-unroll');
      expect(artifact.messageBus?.fixedChunkableWritePolicy).toBeUndefined();
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
