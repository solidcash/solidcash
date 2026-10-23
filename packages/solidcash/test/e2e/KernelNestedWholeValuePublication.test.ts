import { encodePushdataValue } from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import type { PreparedAtomicMessageBusCall } from '../../src/message-bus/compose-prepared-invocation.js';
import type { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('nested whole-entry value publication', () => {
  it('publishes the complete value after a later nested writer of the same entry', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      struct Record { string note; uint revision; bool settled; }
      interface IStore {
        function advance(address relay, uint key) external;
        function settle(uint key) external;
      }
      interface IRelay { function finish(address store, uint key) external; }
      contract Store {
        mapping(uint => Record) records;
        function seed(uint key, Record memory value) public { this.records[key] = value; }
        function advance(address relay, uint key) public {
          this.records[key].revision = this.records[key].revision + 1;
          IRelay(relay).finish(address(this), key);
        }
        function settle(uint key) public { this.records[key].settled = true; }
      }
      contract Relay {
        function finish(address store, uint key) public { IStore(store).settle(key); }
      }
      contract Coordinator {
        uint count;
        function initialize() public { this.count = 0; }
        function run(address store, address relay, uint key) public {
          IStore(store).advance(relay, key);
          this.count = this.count + 1;
        }
      }`, {
      forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
      messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
      optimizeForCompilationSpeed: true, sortedMappingsAll: false,
    });
    const signer = new Signer(new Uint8Array(32).fill(0x67), provider);
    for (let index = 0; index < 24; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
    const store = await getContractFactory(artifacts.Store, signer).deploy();
    const relay = await getContractFactory(artifacts.Relay, signer).deploy();
    const coordinator = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
    store._registerResolvedExternal('IRelay', relay);
    relay._registerResolvedExternal('IStore', store);
    coordinator.implementation._registerResolvedExternal('IStore', store);
    const note = 'nested record payload '.repeat(12);
    await store.call.seed(7n, [note, 5n, false]).send();
    const call = coordinator.forward('run', [store.inner.lockingBytecode, relay.inner.lockingBytecode, 7n]);
    const builder = await (call as unknown as {
      _applyOverrides(): Promise<StatefulTransactionBuilder & {
        __preparedAtomicCalls?: readonly PreparedAtomicMessageBusCall[];
      }>;
    })._applyOverrides();
    const calls = builder.__preparedAtomicCalls;
    expect(calls).toBeDefined();
    const writers = calls!.filter((entry) => entry.contract.categoryId === store.categoryId);
    expect(writers.map((entry) => entry.functionName)).toEqual(['advance', 'settle']);
    const productions = writers.flatMap((entry) => entry.valueChunkProductions ?? []);
    expect(productions).toHaveLength(1);
    const terminal = writers.at(-1)!;
    expect(terminal.producerPath?.status).toBe('complete');
    expect(productions[0].claim.producer.sourcePath).toEqual(
      terminal.producerPath?.status === 'complete' ? terminal.producerPath.context.sourcePath : undefined,
    );
    expect(productions[0].value).toEqual(encodePushdataValue(
      { note, revision: 6n, settled: true }, 'Record', artifacts.Store.structs,
    ));
    // Inspect publication before composition: the same prepared graph is what atomic send consumes.
    // Refreshing an earlier row must retain the complete terminal value on the later nested writer.
    expect(writers[0].resolveValueChunkProductionsFromArgs!(writers[0].args)).toEqual([]);
    const refreshed = terminal.resolveValueChunkProductionsFromArgs!(terminal.args);
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0].value).toEqual(productions[0].value);
    expect(writers[0].resolveValueChunkProductionsFromResults!(writers[0].args, new Map())).toEqual([]);
    const refreshedResults = terminal.resolveValueChunkProductionsFromResults!(terminal.args, new Map());
    expect(refreshedResults).toHaveLength(1);
    expect(refreshedResults[0].value).toEqual(productions[0].value);
  }, 180_000);
});
