import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel direct computed continuation outputs', () => {
  it.each([219, 400])('publishes a computed %i-byte value for a co-spent non-routed writer', async (length) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IStore { function update(uint key) external; }
      contract Store {
        mapping(uint => bytes) public records;
        function seed(uint key, bytes memory value) public {
          if (value.length > 1) { this.records[key] = value; }
        }
        function update(uint key) public {
          require(msg.sender != address(0));
          if (this.records[key].length > 1) { this.records[key] = this.records[key] + hex"21"; }
        }
      }
      contract Caller {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address store, uint key) public {
          IStore(store).update(key);
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    // The guard reads only the entry it writes, which the route replays at its key argument (D25): batchable.
    expect(artifacts.Store.messageBus?.handlers.find((handler) => handler.name === 'update')?.eligible).toBe(true);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x66), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const store = await getContractFactory(artifacts.Store, signer).deploy();
    const caller = await upgrades.deployProxy(getContractFactory(artifacts.Caller, signer), []);
    caller.implementation._registerResolvedExternal('IStore', store);
    const payload = new Uint8Array(length).fill(0x70);
    await expect(store.call.seed(7n, payload).send()).resolves.toBeDefined();

    await expect(caller.forward('run', [store.inner.lockingBytecode, 7n]).send()).resolves.toBeDefined();

    expect((await store.getEntries('records'))[0].value).toEqual(Uint8Array.from([...payload, 0x21]));
    expect((await caller.proxy.getState()).count).toBe(1n);
  }, 180_000);
});
