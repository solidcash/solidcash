import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel filtered-loop descendant arguments', () => {
  it.each([0n, 1n])('refreshes a raw grandchild after removing source iteration %s', async (skip) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISelection { function set(uint skip) external; function read() external view returns (uint); }
      interface IRelay { function forward(uint value) external; }
      interface ISink { function record(uint value) external returns (bool); }
      interface IRouter { function route() external; }
      contract Selection {
        uint public skip;
        function set(uint next) public { this.skip = next; }
        function read() public view returns (uint) { return this.skip; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public returns (bool) { this.total += value; this.count += 1; return true; }
      }
      contract Relay(address sink) {
        uint public total;
        function forward(uint value) public {
          sink.call(abi.encodeCall(ISink.record, (value)));
          this.total += value;
        }
      }
      contract Router(address selection, address relay) {
        uint public count;
        function route() public {
          uint skip = ISelection(selection).read();
          for (uint i = 0; i < 3; i++) {
            if (i != skip) { IRelay(relay).forward(i + 1); }
          }
          this.count += 1;
        }
      }
      contract Coordinator {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address selection, address router, uint skip) public {
          ISelection(selection).set(skip);
          IRouter(router).route();
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x74), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const selection = await getContractFactory(artifacts.Selection, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const relay = await getContractFactory(artifacts.Relay, signer).deploy(sink.inner.lockingBytecode);
    relay._registerResolvedExternal('ISink', sink);
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      selection.inner.lockingBytecode, relay.inner.lockingBytecode,
    );
    router._registerResolvedExternal('ISelection', selection);
    router._registerResolvedExternal('IRelay', relay);
    const coordinator = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
    coordinator.implementation._registerResolvedExternal('ISelection', selection);
    coordinator.implementation._registerResolvedExternal('IRouter', router);
    await selection.call.set(3n).send();
    await coordinator.forward('run', [selection.inner.lockingBytecode, router.inner.lockingBytecode, skip]).send();
    expect((await selection.getState()).skip).toBe(skip);
    expect((await relay.getState()).total).toBe(5n - skip);
    expect((await sink.getState()).total).toBe(5n - skip);
    expect((await sink.getState()).count).toBe(2n);
    expect((await router.getState()).count).toBe(1n);
    expect((await coordinator.proxy.getState()).count).toBe(1n);
  }, 180_000);
});
