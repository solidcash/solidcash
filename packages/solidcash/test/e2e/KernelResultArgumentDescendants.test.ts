import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel result-dependent descendant arguments', () => {
  it.each([true, false])('refreshes a descendant raw-call argument (fast compilation: %s)', async (optimizeForCompilationSpeed) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISource {
        function set(uint value) external;
        function read() external returns (uint);
      }
      interface IRelay { function forward(uint value) external; }
      interface ISink { function record(uint value) external returns (bool); }
      contract Source {
        uint public stored;
        function set(uint next) public { this.stored = next; }
        function read() public returns (uint) { return this.stored; }
      }
      contract Sink {
        uint public stored;
        function record(uint next) public returns (bool) { this.stored = next; return true; }
      }
      contract Relay(address sink) {
        uint public count;
        function forward(uint value) public {
          sink.call(abi.encodeCall(ISink.record, (value)));
          this.count += 1;
        }
      }
      contract Coordinator {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address source, address relay) public {
          ISource(source).set(80);
          uint value = ISource(source).read();
          IRelay(relay).forward(value);
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x72), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const source = await getContractFactory(artifacts.Source, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const relay = await getContractFactory(artifacts.Relay, signer).deploy(sink.inner.lockingBytecode);
    relay._registerResolvedExternal('ISink', sink);
    const coordinator = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
    coordinator.implementation._registerResolvedExternal('ISource', source);
    coordinator.implementation._registerResolvedExternal('IRelay', relay);
    await source.call.set(100n).send();
    await coordinator.forward('run', [source.inner.lockingBytecode, relay.inner.lockingBytecode]).send();
    expect((await source.getState()).stored).toBe(80n);
    expect((await sink.getState()).stored).toBe(80n);
    expect((await relay.getState()).count).toBe(1n);
    expect((await coordinator.proxy.getState()).count).toBe(1n);
  }, 180_000);
});
