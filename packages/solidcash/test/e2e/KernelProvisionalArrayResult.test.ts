import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel provisional fixed-array result', () => {
  it.each([true, false])('authenticates a state-dependent array result (fast compilation: %s)', async (optimizeForCompilationSpeed) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISource {
        function arm() external;
        function measure() external returns (uint[2] memory);
      }
      interface ISink { function record(uint first, uint second) external; }
      contract Source {
        bool public ready;
        function arm() public { this.ready = true; }
        function measure() public returns (uint[2] memory) {
          require(this.ready, "not ready");
          this.ready = false;
          return [7, 9];
        }
      }
      contract Sink {
        uint public first;
        uint public second;
        function record(uint a, uint b) public { this.first = a; this.second = b; }
      }
      contract Coordinator {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address source, address sink) public {
          ISource(source).arm();
          uint[2] memory values = ISource(source).measure();
          ISink(sink).record(values[0], values[1]);
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x71), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const source = await getContractFactory(artifacts.Source, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const coordinator = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
    coordinator.implementation._registerResolvedExternal('ISource', source);
    coordinator.implementation._registerResolvedExternal('ISink', sink);
    expect((await source.getState()).ready).toBe(false);
    await coordinator.forward('run', [source.inner.lockingBytecode, sink.inner.lockingBytecode]).send();
    expect(await sink.getState()).toMatchObject({ first: 7n, second: 9n });
    expect((await source.getState()).ready).toBe(false);
    expect((await coordinator.proxy.getState()).count).toBe(1n);
  }, 180_000);
});
