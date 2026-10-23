import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel direct handler witness ABI', () => {
  it('keeps caller identity coordinates aligned for a non-routed chunkable writer', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IStore { function write(uint key, string memory value) external; }
      contract Store {
        mapping(uint => string) public left;
        mapping(uint => string) public right;
        function write(uint key, string memory value) public {
          require(msg.sender != address(0));
          this.left[key] = value;
          if (value.length > 1) { this.right[key] = value; }
        }
      }
      contract Caller {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address store, uint key, string memory value) public {
          IStore(store).write(key, value);
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    expect(artifacts.Store.messageBus?.handlers.find((handler) => handler.name === 'write')?.eligible).toBe(false);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x65), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const store = await getContractFactory(artifacts.Store, signer).deploy();
    const caller = await upgrades.deployProxy(getContractFactory(artifacts.Caller, signer), []);
    caller.implementation._registerResolvedExternal('IStore', store);

    await expect(caller.forward('run', [store.inner.lockingBytecode, 7n, 'retained text']).send())
      .resolves.toBeDefined();

    expect((await store.getEntries('left'))[0].value).toBe('retained text');
    expect((await store.getEntries('right'))[0].value).toBe('retained text');
    expect((await caller.proxy.getState()).count).toBe(1n);
  }, 180_000);
});
