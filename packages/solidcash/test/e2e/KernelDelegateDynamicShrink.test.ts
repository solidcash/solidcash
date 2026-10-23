import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel delegate dynamic-state shrink with external calls', () => {
  it.each([230, 350])('retires a tail chunk while updating a co-spent contract (%s payload bytes)', async (payloadBytes) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISink { function record(uint id) external; }
      contract Sink {
        uint public count;
        function initialize() public { this.count = 0; }
        function record(uint id) public { this.count += id + 1; }
      }
      contract Registry {
        struct Record { address owner; string payload; }
        Record[] public records;
        address sink;
        function initialize(address owner, string memory payload, address target) public {
          this.records.push(Record(owner, payload));
          this.sink = target;
        }
        function clear(uint id) public {
          ISink(this.sink).record(id);
          this.records[id].owner = address(0);
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x64), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const sink = await upgrades.deployProxy(getContractFactory(artifacts.Sink, signer), []);
    const payload = 'p'.repeat(payloadBytes);
    const registry = await upgrades.deployProxy(getContractFactory(artifacts.Registry, signer), [
      signer.getAddress(), payload, sink.proxy.inner.lockingBytecode,
    ]);
    registry.implementation._registerResolvedExternal('ISink', sink.proxy);
    const postChunkCount = Math.ceil((payloadBytes + 4) / 120);
    expect((await registry.proxy.getFullState()).dynamicChunkUtxos?.records).toHaveLength(postChunkCount + 1);

    await expect(registry.forward('clear', [0n]).send()).resolves.toBeDefined();

    const state = await registry.proxy.getFullState();
    expect(state.dynamicChunkUtxos?.records).toHaveLength(postChunkCount);
    expect(state.state.records).toMatchObject([{ owner: new Uint8Array(), payload }]);
    expect((await sink.proxy.getState()).count).toBe(1n);
  }, 180_000);
});
