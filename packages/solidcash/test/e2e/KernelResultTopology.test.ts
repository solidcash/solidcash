import { binToHex } from '@bitauth/libauth';
import { compileStringMulti } from 'solidc';
import { describe, expect, it } from 'vitest';
import { getContractFactory, Signer, upgrades } from '../../src/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel result-dependent call topology', () => {
  it.each([true, false])('selects the branch after an earlier write (choice: %s)', async (choice) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IFlag { function set(bool choice) external; function read() external view returns (bool); }
      interface ILeft { function accept(uint marker) external; }
      interface IRight { function accept(uint marker) external; }
      interface ISink { function record(uint value) external; }
      interface IRouter { function route() external; }
      contract Flag {
        bool public choice;
        function set(bool next) public { this.choice = next; }
        function read() public view returns (bool) { return this.choice; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Left(address sink) {
        uint public marker;
        function accept(uint next) public { this.marker = next; ISink(sink).record(next); }
      }
      contract Right(address sink) {
        uint public marker;
        function accept(uint next) public { this.marker = next; ISink(sink).record(next * 2); }
      }
      contract Router(address flag, address left, address right, address sink) {
        uint public count;
        function route() public {
          bool choice = IFlag(flag).read();
          if (choice) { ILeft(left).accept(7); }
          else { IRight(right).accept(9); }
          for (uint i = 0; i < 3; i++) {
            if (choice ? i != 1 : i == 1) { ISink(sink).record(i + 1); }
          }
          this.count += 1;
        }
      }
      contract Coordinator {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address flag, address router, bool choice) public {
          IFlag(flag).set(choice);
          IRouter(router).route();
          this.count += 1;
        }
      }`, { forceStateful: true, solidityImportCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x73), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const flag = await getContractFactory(artifacts.Flag, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const left = await getContractFactory(artifacts.Left, signer).deploy(sink.inner.lockingBytecode);
    const right = await getContractFactory(artifacts.Right, signer).deploy(sink.inner.lockingBytecode);
    left._registerResolvedExternal('ISink', sink);
    right._registerResolvedExternal('ISink', sink);
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      flag.inner.lockingBytecode, left.inner.lockingBytecode, right.inner.lockingBytecode,
      sink.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IFlag', flag);
    router._registerResolvedExternal('ILeft', left);
    router._registerResolvedExternal('IRight', right);
    router._registerResolvedExternal('ISink', sink);
    const coordinator = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
    coordinator.implementation._registerResolvedExternal('IFlag', flag);
    coordinator.implementation._registerResolvedExternal('IRouter', router);
    await flag.call.set(!choice).send();
    await coordinator.forward('run', [flag.inner.lockingBytecode, router.inner.lockingBytecode, choice]).send();
    expect((await flag.getState()).choice).toBe(choice);
    expect((await left.getState()).marker).toBe(choice ? 7n : 0n);
    expect((await right.getState()).marker).toBe(choice ? 0n : 9n);
    expect((await router.getState()).count).toBe(1n);
    expect((await coordinator.proxy.getState()).count).toBe(1n);
    expect((await sink.getState()).total).toBe(choice ? 11n : 20n);
    expect((await sink.getState()).count).toBe(choice ? 3n : 2n);
  }, 180_000);

  it('composes reached inner-loop rows for one outer occurrence', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISink { function record(uint value) external; }
      interface IRouter { function route(uint[] memory values) external; }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address sink) {
        uint public count;
        function route(uint[] memory values) public {
          for (uint i = 0; i < values.length; i++) {
            for (uint j = 0; j < 2; j++) {
              ISink(sink).record(values[i] + j);
            }
          }
          this.count += 1;
        }
      }
      contract Coordinator(address router) {
        uint public count;
        function run(uint[] memory values) public {
          IRouter(router).route(values);
          this.count += 1;
        }
      }`, { forceStateful: true, solidityImportCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x75), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(sink.inner.lockingBytecode);
    router._registerResolvedExternal('ISink', sink);
    const coordinator = await getContractFactory(artifacts.Coordinator, signer).deploy(router.inner.lockingBytecode);
    coordinator._registerResolvedExternal('IRouter', router);
    const receipt = await coordinator.call.run([7n]).send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect((await sink.getState()).total).toBe(15n);
    expect((await sink.getState()).count).toBe(2n);
    expect((await router.getState()).count).toBe(1n);
    expect((await coordinator.getState()).count).toBe(1n);
  }, 180_000);
});
